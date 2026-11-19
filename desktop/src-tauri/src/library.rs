use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{Manager, State};
use void_library::{index, models::*, storage::Library};

pub struct LibraryManager {
    path: PathBuf,
    gate: Mutex<()>,
    running: Arc<AtomicBool>,
    cancel: Arc<AtomicBool>,
    progress: Arc<Mutex<IndexProgress>>,
}

impl LibraryManager {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            gate: Mutex::new(()),
            running: Arc::new(AtomicBool::new(false)),
            cancel: Arc::new(AtomicBool::new(false)),
            progress: Arc::new(Mutex::new(IndexProgress::default())),
        }
    }
    pub fn cancel(&self) {
        self.cancel.store(true, Ordering::Relaxed);
    }
    fn open(&self) -> Result<Library, String> {
        Library::open(&self.path)
    }
    fn idle(&self) -> Result<(), String> {
        if self.running.load(Ordering::Acquire) {
            Err("Wait for indexing to finish, or cancel it first.".into())
        } else {
            Ok(())
        }
    }
    fn progress(&self) -> Result<IndexProgress, String> {
        self.progress
            .lock()
            .map(|p| p.clone())
            .map_err(|_| "Index status is unavailable.".into())
    }
    fn start(&self) -> Result<IndexProgress, String> {
        let _gate = self
            .gate
            .lock()
            .map_err(|_| "Library is busy.".to_string())?;
        self.idle()?;
        self.cancel.store(false, Ordering::Relaxed);
        let initial = IndexProgress {
            phase: "running".into(),
            started_at: void_library::storage::now(),
            ..Default::default()
        };
        *self
            .progress
            .lock()
            .map_err(|_| "Index status is unavailable.".to_string())? = initial.clone();
        self.running.store(true, Ordering::Release);
        let (path, cancel, progress, running) = (
            self.path.clone(),
            self.cancel.clone(),
            self.progress.clone(),
            self.running.clone(),
        );
        let spawn = std::thread::Builder::new()
            .name("void-library-index".into())
            .spawn(move || {
                let result = std::panic::catch_unwind(|| {
                    let mut library = Library::open(&path)?;
                    index::refresh(&mut library, &cancel, |next| {
                        if let Ok(mut value) = progress.lock() {
                            *value = next.clone();
                        }
                    })
                });
                if let Ok(mut value) = progress.lock() {
                    match result {
                        Ok(Ok(next)) => *value = next,
                        Ok(Err(error)) => {
                            value.phase = "error".into();
                            value.detail = error;
                            value.finished_at = Some(void_library::storage::now());
                        }
                        Err(_) => {
                            value.phase = "error".into();
                            value.detail =
                                "Indexing stopped unexpectedly. Refresh to resume completed work."
                                    .into();
                            value.finished_at = Some(void_library::storage::now());
                        }
                    }
                }
                running.store(false, Ordering::Release);
            });
        if let Err(error) = spawn {
            self.running.store(false, Ordering::Release);
            return Err(format!("Could not start indexing: {error}"));
        }
        Ok(initial)
    }
}

async fn read<T: Send + 'static>(
    app: tauri::AppHandle,
    action: impl FnOnce(Library) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || action(app.state::<LibraryManager>().open()?))
        .await
        .map_err(|_| "Library operation stopped unexpectedly.".to_string())?
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryOverview {
    roots: Vec<Root>,
    notes: Vec<Note>,
    progress: IndexProgress,
    storage_bytes: u64,
}

#[tauri::command]
pub async fn library_overview(app: tauri::AppHandle) -> Result<LibraryOverview, String> {
    let progress = app.state::<LibraryManager>().progress()?;
    read(app, move |library| {
        Ok(LibraryOverview {
            roots: library.roots()?,
            notes: library.notes()?,
            storage_bytes: library.storage_bytes()?,
            progress,
        })
    })
    .await
}

#[tauri::command]
pub async fn library_add_paths(
    app: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<Vec<Root>, String> {
    if paths.is_empty() || paths.len() > 32 {
        return Err("Choose between 1 and 32 sources at a time.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LibraryManager>();
        let _gate = state
            .gate
            .lock()
            .map_err(|_| "Library is busy.".to_string())?;
        state.idle()?;
        let library = state.open()?;
        library.add_roots(&paths.into_iter().map(PathBuf::from).collect::<Vec<_>>())
    })
    .await
    .map_err(|_| "Source registration stopped unexpectedly.".to_string())?
}

#[tauri::command]
pub fn library_refresh(state: State<'_, LibraryManager>) -> Result<IndexProgress, String> {
    state.start()
}
#[tauri::command]
pub fn library_cancel(state: State<'_, LibraryManager>) {
    state.cancel();
}
#[tauri::command]
pub fn library_progress(state: State<'_, LibraryManager>) -> Result<IndexProgress, String> {
    state.progress()
}

#[tauri::command]
pub async fn library_documents(
    app: tauri::AppHandle,
    root: Option<i64>,
    kind: Option<String>,
    offset: Option<u32>,
) -> Result<Vec<Document>, String> {
    read(app, move |library| {
        library.documents_filtered(root, kind.as_deref(), offset.unwrap_or(0))
    })
    .await
}
#[tauri::command]
pub async fn library_reader(
    app: tauri::AppHandle,
    document: i64,
    offset: Option<u32>,
) -> Result<ReaderPage, String> {
    read(app, move |library| {
        library.reader(document, offset.unwrap_or(0))
    })
    .await
}

#[tauri::command]
pub async fn library_document(app: tauri::AppHandle, id: i64) -> Result<Document, String> {
    read(app, move |library| library.document(id)).await
}

#[tauri::command]
pub async fn library_passages(
    app: tauri::AppHandle,
    document: i64,
    offset: Option<u32>,
) -> Result<Vec<Passage>, String> {
    read(app, move |library| {
        library.passages(document, offset.unwrap_or(0))
    })
    .await
}
#[tauri::command]
pub async fn library_search(
    app: tauri::AppHandle,
    query: String,
    root: Option<i64>,
    kind: Option<String>,
    offset: Option<u32>,
) -> Result<Vec<SearchHit>, String> {
    if query.chars().count() > 500 {
        return Err("Search is limited to 500 characters.".into());
    }
    read(app, move |library| {
        library.search(&query, root, kind.as_deref(), offset.unwrap_or(0))
    })
    .await
}
#[tauri::command]
pub async fn library_snapshots(
    app: tauri::AppHandle,
    passages: Vec<i64>,
) -> Result<Vec<SourceSnapshot>, String> {
    if passages.len() > 24 {
        return Err("Choose at most 24 passages.".into());
    }
    read(app, move |library| {
        passages
            .into_iter()
            .map(|id| library.snapshot(id))
            .collect()
    })
    .await
}
#[tauri::command]
pub async fn library_save_note(
    app: tauri::AppHandle,
    id: Option<i64>,
    title: String,
    content: String,
    sources: Vec<SourceSnapshot>,
) -> Result<Note, String> {
    read(app, move |library| {
        library.save_note(id, &title, &content, &sources)
    })
    .await
}
#[tauri::command]
pub async fn library_delete_note(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    read(app, move |library| library.delete_note(id)).await
}
#[tauri::command]
pub async fn library_remove_root(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LibraryManager>();
        let _gate = state
            .gate
            .lock()
            .map_err(|_| "Library is busy.".to_string())?;
        state.idle()?;
        state.open()?.remove_root(id)
    })
    .await
    .map_err(|_| "Removing this source stopped unexpectedly.".to_string())?
}
#[tauri::command]
pub async fn library_clear(app: tauri::AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LibraryManager>();
        let _gate = state
            .gate
            .lock()
            .map_err(|_| "Library is busy.".to_string())?;
        state.idle()?;
        state.open()?.clear()
    })
    .await
    .map_err(|_| "Clearing the Library stopped unexpectedly.".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn worker_commits_in_background_and_rejects_concurrent_start() {
        let path = std::env::temp_dir().join(format!(
            "void-library-worker-test-{}-{}",
            std::process::id(),
            void_library::storage::now()
        ));
        std::fs::create_dir(&path).unwrap();
        let sources = path.join("sources");
        std::fs::create_dir(&sources).unwrap();
        for i in 0..100 {
            std::fs::write(sources.join(format!("{i}.txt")), "fixture keyword").unwrap();
        }
        let manager = LibraryManager::new(path.join("library.sqlite"));
        manager.open().unwrap().add_root(&sources).unwrap();
        manager.start().unwrap();
        assert!(manager.start().is_err());
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(15);
        while manager.running.load(Ordering::Acquire) {
            assert!(
                std::time::Instant::now() < deadline,
                "worker did not finish"
            );
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        assert_eq!(manager.progress().unwrap().phase, "complete");
        assert_eq!(
            manager
                .open()
                .unwrap()
                .search("keyword", None, None, 0)
                .unwrap()
                .len(),
            40
        );
        // Delete only this test-created directory, after every database handle and worker has finished.
        let resolved = path.canonicalize().unwrap();
        assert!(resolved.starts_with(std::env::temp_dir().canonicalize().unwrap()));
        assert!(resolved
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("void-library-worker-test-"));
        std::fs::remove_dir_all(&resolved).unwrap();
    }
}
