use serde::{Deserialize, Serialize};
use std::{
    net::{Ipv4Addr, SocketAddrV4, TcpListener},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Default)]
pub struct MindRuntimeManager {
    process: Mutex<Option<ManagedRuntime>>,
}

struct ManagedRuntime {
    child: Child,
    executable_path: PathBuf,
    model_path: PathBuf,
    port: u16,
    started_at: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedRuntimeConfig {
    executable_path: String,
    model_path: String,
    port: u16,
    context: u32,
    gpu_layers: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedRuntimeStatus {
    running: bool,
    state: &'static str,
    executable_path: Option<String>,
    model_path: Option<String>,
    port: Option<u16>,
    started_at: Option<u64>,
    exit_code: Option<i32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidatedRuntimePaths {
    executable_path: String,
    model_path: String,
    port: u16,
}

impl ManagedRuntimeStatus {
    fn stopped(exit_code: Option<i32>) -> Self {
        Self {
            running: false,
            state: "stopped",
            executable_path: None,
            model_path: None,
            port: None,
            started_at: None,
            exit_code,
        }
    }
}

impl MindRuntimeManager {
    pub fn stop_for_shutdown(&self) {
        let Ok(mut guard) = self.process.lock() else {
            return;
        };
        if let Some(mut runtime) = guard.take() {
            let _ = runtime.child.kill();
            let _ = runtime.child.wait();
        }
    }
}

fn validate_port(port: u16) -> Result<(), String> {
    if port < 1024 {
        return Err("Managed runtime ports must be between 1024 and 65535.".into());
    }
    Ok(())
}

fn validate_executable_name(path: &Path) -> Result<(), String> {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if name != "llama-server" && name != "llama-server.exe" {
        return Err("Select the llama-server executable, not an arbitrary program.".into());
    }
    Ok(())
}

fn canonical_file(path: &str, kind: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path);
    let canonical = candidate
        .canonicalize()
        .map_err(|_| format!("The selected {kind} path does not exist or is inaccessible."))?;
    if !canonical.is_file() {
        return Err(format!("The selected {kind} path is not a file."));
    }
    Ok(canonical)
}

fn validate_config(config: &ManagedRuntimeConfig) -> Result<(PathBuf, PathBuf), String> {
    validate_port(config.port)?;
    if !(256..=1_048_576).contains(&config.context) {
        return Err("Context must be between 256 and 1048576 tokens.".into());
    }
    if !(-1..=999).contains(&config.gpu_layers) {
        return Err("GPU layers must be between -1 and 999.".into());
    }
    let executable = canonical_file(&config.executable_path, "runtime")?;
    validate_executable_name(&executable)?;
    let model = canonical_file(&config.model_path, "model")?;
    if model
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        != Some("gguf".into())
    {
        return Err("The selected model must be a GGUF file.".into());
    }
    Ok((executable, model))
}

fn ensure_port_available(port: u16) -> Result<(), String> {
    TcpListener::bind(SocketAddrV4::new(Ipv4Addr::LOCALHOST, port))
        .map(|listener| drop(listener))
        .map_err(|_| format!("Port {port} is already in use on 127.0.0.1."))
}

#[tauri::command]
pub fn mind_validate_runtime(
    config: ManagedRuntimeConfig,
) -> Result<ValidatedRuntimePaths, String> {
    let (executable, model) = validate_config(&config)?;
    ensure_port_available(config.port)?;
    Ok(ValidatedRuntimePaths {
        executable_path: executable.to_string_lossy().into_owned(),
        model_path: model.to_string_lossy().into_owned(),
        port: config.port,
    })
}

#[tauri::command]
pub fn mind_start_runtime(
    state: tauri::State<'_, MindRuntimeManager>,
    config: ManagedRuntimeConfig,
) -> Result<ManagedRuntimeStatus, String> {
    let (executable, model) = validate_config(&config)?;
    let mut guard = state
        .process
        .lock()
        .map_err(|_| "Runtime state is unavailable.".to_string())?;
    if let Some(runtime) = guard.as_mut() {
        if runtime
            .child
            .try_wait()
            .map_err(|error| error.to_string())?
            .is_none()
        {
            return Err("A managed llama-server process is already running.".into());
        }
        guard.take();
    }
    ensure_port_available(config.port)?;

    let mut command = Command::new(&executable);
    command
        .arg("--model")
        .arg(&model)
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--port")
        .arg(config.port.to_string())
        .arg("--ctx-size")
        .arg(config.context.to_string())
        .arg("--n-gpu-layers")
        .arg(config.gpu_layers.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let child = command
        .spawn()
        .map_err(|error| format!("Could not start llama-server: {error}"))?;
    let started_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_secs();
    *guard = Some(ManagedRuntime {
        child,
        executable_path: executable.clone(),
        model_path: model.clone(),
        port: config.port,
        started_at,
    });
    Ok(ManagedRuntimeStatus {
        running: true,
        state: "loading",
        executable_path: Some(executable.to_string_lossy().into_owned()),
        model_path: Some(model.to_string_lossy().into_owned()),
        port: Some(config.port),
        started_at: Some(started_at),
        exit_code: None,
    })
}

#[tauri::command]
pub fn mind_runtime_status(
    state: tauri::State<'_, MindRuntimeManager>,
) -> Result<ManagedRuntimeStatus, String> {
    let mut guard = state
        .process
        .lock()
        .map_err(|_| "Runtime state is unavailable.".to_string())?;
    let Some(runtime) = guard.as_mut() else {
        return Ok(ManagedRuntimeStatus::stopped(None));
    };
    if let Some(exit) = runtime
        .child
        .try_wait()
        .map_err(|error| error.to_string())?
    {
        let code = exit.code();
        guard.take();
        return Ok(ManagedRuntimeStatus::stopped(code));
    }
    Ok(ManagedRuntimeStatus {
        running: true,
        state: "loading",
        executable_path: Some(runtime.executable_path.to_string_lossy().into_owned()),
        model_path: Some(runtime.model_path.to_string_lossy().into_owned()),
        port: Some(runtime.port),
        started_at: Some(runtime.started_at),
        exit_code: None,
    })
}

#[tauri::command]
pub fn mind_stop_runtime(
    state: tauri::State<'_, MindRuntimeManager>,
) -> Result<ManagedRuntimeStatus, String> {
    let mut guard = state
        .process
        .lock()
        .map_err(|_| "Runtime state is unavailable.".to_string())?;
    if let Some(mut runtime) = guard.take() {
        runtime
            .child
            .kill()
            .map_err(|error| format!("Could not stop llama-server: {error}"))?;
        let exit = runtime.child.wait().map_err(|error| error.to_string())?;
        return Ok(ManagedRuntimeStatus::stopped(exit.code()));
    }
    Ok(ManagedRuntimeStatus::stopped(None))
}

#[cfg(test)]
mod tests {
    use super::{validate_executable_name, validate_port};
    use std::path::Path;

    #[test]
    fn rejects_privileged_ports() {
        assert!(validate_port(80).is_err());
        assert!(validate_port(8080).is_ok());
    }

    #[test]
    fn accepts_only_llama_server_executable_names() {
        assert!(validate_executable_name(Path::new("llama-server.exe")).is_ok());
        assert!(validate_executable_name(Path::new("powershell.exe")).is_err());
    }
}
