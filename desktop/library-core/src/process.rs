//! PDF decoding runs in a disposable process, before any Tauri/WebView initialization.
use crate::{extract, models::Passage, Result};
use std::{
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc,
    },
    time::{Duration, Instant},
};

pub const WORKER_ARG: &str = "--void-library-extract-v1";
pub const MEMORY_LIMIT: usize = 512 * 1024 * 1024;
const OUTPUT_LIMIT: u64 = 16 * 1024 * 1024;

pub struct ProcessExtractor {
    executable: PathBuf,
    timeout: Duration,
}
impl ProcessExtractor {
    pub fn new(executable: PathBuf) -> Self {
        Self {
            executable,
            timeout: Duration::from_secs(20),
        }
    }
    pub fn with_timeout(executable: PathBuf, timeout: Duration) -> Self {
        Self {
            executable,
            timeout,
        }
    }
    pub fn extract(&self, path: &Path, bytes: &[u8], cancel: &AtomicBool) -> Result<Vec<Passage>> {
        if extract::kind(path) != Some("pdf") {
            return extract::extract(path, bytes);
        }
        if bytes.len() as u64 > extract::MAX_PDF_BYTES {
            return Err("PDF exceeds the 8 MiB indexing limit.".into());
        }
        if cancel.load(Ordering::Relaxed) {
            return Err("Indexing cancelled.".into());
        }
        let mut command = Command::new(&self.executable);
        command
            .arg(WORKER_ARG)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut child = command
            .spawn()
            .map_err(|e| format!("Could not start the PDF reader: {e}"))?;
        #[cfg(windows)]
        let _job = match memory_job(child.id()) {
            Ok(job) => job,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(error);
            }
        };
        let mut input = child.stdin.take().ok_or("PDF input pipe is unavailable.")?;
        let output = child
            .stdout
            .take()
            .ok_or("PDF output pipe is unavailable.")?;
        let data = bytes.to_vec();
        let writer = std::thread::spawn(move || input.write_all(&data));
        let (tx, rx) = mpsc::channel();
        let reader = std::thread::spawn(move || {
            let mut bytes = Vec::new();
            let result = output
                .take(OUTPUT_LIMIT + 1)
                .read_to_end(&mut bytes)
                .map_err(|e| e.to_string())
                .and_then(|_| {
                    if bytes.len() as u64 > OUTPUT_LIMIT {
                        Err("PDF output exceeded its limit.".into())
                    } else {
                        Ok(bytes)
                    }
                });
            let _ = tx.send(result);
        });
        let started = Instant::now();
        let mut received = None;
        let status = loop {
            if cancel.load(Ordering::Relaxed) {
                break Err("Indexing cancelled.".to_string());
            }
            if started.elapsed() >= self.timeout {
                break Err("PDF reading exceeded 20 seconds. This document was skipped.".into());
            }
            if received.is_none() {
                if let Ok(result) = rx.try_recv() {
                    received = Some(result);
                }
            }
            if matches!(received, Some(Err(_))) {
                break Err("PDF output exceeded its limit or could not be read.".into());
            }
            match child.try_wait() {
                Ok(Some(status)) => break Ok(status),
                Ok(None) => std::thread::sleep(Duration::from_millis(10)),
                Err(error) => break Err(format!("PDF process failed: {error}")),
            }
        };
        // Always reap the process and close both pipes before joining I/O threads.
        let _ = child.kill();
        let _ = child.wait();
        let written = writer
            .join()
            .map_err(|_| "PDF input stopped unexpectedly.".to_string())?;
        reader
            .join()
            .map_err(|_| "PDF output stopped unexpectedly.".to_string())?;
        let status = status?;
        if !status.success() {
            return Err("PDF reader stopped unexpectedly or exceeded its memory limit. Other documents can still be indexed.".into());
        }
        written.map_err(|_| "PDF reader did not accept the document.".to_string())?;
        let output = received.unwrap_or_else(|| {
            rx.recv()
                .unwrap_or_else(|_| Err("PDF output was not received.".into()))
        })?;
        serde_json::from_slice::<Result<Vec<Passage>>>(&output)
            .map_err(|_| "PDF reader returned invalid data.".to_string())?
    }
}

pub fn worker_main() -> i32 {
    #[cfg(unix)]
    {
        let memory = libc::rlimit {
            rlim_cur: MEMORY_LIMIT as libc::rlim_t,
            rlim_max: MEMORY_LIMIT as libc::rlim_t,
        };
        let cpu = libc::rlimit {
            rlim_cur: 20,
            rlim_max: 20,
        };
        // The child has no threads or resources outside its pipes at this point.
        if unsafe { libc::setrlimit(libc::RLIMIT_AS, &memory) } != 0
            || unsafe { libc::setrlimit(libc::RLIMIT_CPU, &cpu) } != 0
        {
            return 2;
        }
    }
    let mut data = Vec::new();
    if std::io::stdin()
        .take(extract::MAX_PDF_BYTES + 1)
        .read_to_end(&mut data)
        .is_err()
    {
        return 2;
    }
    let result = extract::extract(Path::new("selected.pdf"), &data);
    if serde_json::to_writer(std::io::stdout().lock(), &result).is_err() {
        return 2;
    }
    0
}

#[cfg(windows)]
struct Job(windows_sys::Win32::Foundation::HANDLE);
#[cfg(windows)]
impl Drop for Job {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.0);
        }
    }
}
#[cfg(windows)]
fn memory_job(pid: u32) -> Result<Job> {
    use windows_sys::Win32::{
        Foundation::CloseHandle,
        System::{JobObjects::*, Threading::*},
    };
    // A fresh unnamed job owns only this child. Fail closed if the OS cannot enforce the limit.
    unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() {
            return Err("Could not create a bounded PDF reader.".into());
        }
        let owned = Job(job);
        let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        limits.BasicLimitInformation.LimitFlags =
            JOB_OBJECT_LIMIT_PROCESS_MEMORY | JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        limits.ProcessMemoryLimit = MEMORY_LIMIT;
        if SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &limits as *const _ as *const _,
            std::mem::size_of_val(&limits) as u32,
        ) == 0
        {
            return Err("Could not set the PDF reader memory limit.".into());
        }
        let process = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid);
        if process.is_null() {
            return Err("Could not bound the PDF process.".into());
        }
        let success = AssignProcessToJobObject(job, process);
        CloseHandle(process);
        if success == 0 {
            return Err("Could not isolate the PDF reader.".into());
        }
        Ok(owned)
    }
}
