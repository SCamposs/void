use crate::{
    extract,
    models::{IndexProgress, Root},
    storage::{now, Library},
    Result,
};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs::{self, File, Metadata},
    io::Read,
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
};

pub const MAX_ENTRIES: usize = 50_000;
pub const MAX_DEPTH: usize = 32;

pub fn is_link(metadata: &Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return true;
        }
    }
    metadata.file_type().is_symlink()
}

fn cancelled(cancel: &AtomicBool) -> bool {
    cancel.load(Ordering::Relaxed)
}

struct Discovery {
    paths: Vec<PathBuf>,
    complete: bool,
    entries: usize,
    skipped: usize,
    errors: usize,
}

fn discover(root: &Root, cancel: &AtomicBool) -> Discovery {
    let mut result = Discovery {
        paths: Vec::new(),
        complete: true,
        entries: 0,
        skipped: 0,
        errors: 0,
    };
    let base = Path::new(&root.path);
    let mut pending = vec![(base.to_path_buf(), 0)];
    while let Some((path, depth)) = pending.pop() {
        if cancelled(cancel) {
            result.complete = false;
            break;
        }
        result.entries += 1;
        if result.entries > MAX_ENTRIES {
            result.complete = false;
            result.skipped += 1;
            break;
        }
        let metadata = match fs::symlink_metadata(&path) {
            Ok(value) => value,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(_) => {
                result.complete = false;
                result.errors += 1;
                continue;
            }
        };
        if is_link(&metadata) {
            result.skipped += 1;
            continue;
        }
        let canonical = match path.canonicalize() {
            Ok(value) => value,
            Err(_) => {
                result.complete = false;
                result.errors += 1;
                continue;
            }
        };
        if (root.directory && !canonical.starts_with(base))
            || (!root.directory && canonical != base)
        {
            result.skipped += 1;
            continue;
        }
        if metadata.is_dir() {
            if depth >= MAX_DEPTH {
                result.complete = false;
                result.skipped += 1;
                continue;
            }
            match fs::read_dir(&path) {
                Ok(children) => {
                    // Bound queued entries as well as visited entries, including unsupported files.
                    for child in children {
                        if cancelled(cancel) {
                            result.complete = false;
                            break;
                        }
                        if pending.len() + result.entries >= MAX_ENTRIES {
                            result.complete = false;
                            result.skipped += 1;
                            break;
                        }
                        match child {
                            Ok(child) => pending.push((child.path(), depth + 1)),
                            Err(_) => {
                                result.complete = false;
                                result.errors += 1;
                            }
                        }
                    }
                }
                Err(_) => {
                    result.complete = false;
                    result.errors += 1;
                }
            }
        } else if metadata.is_file() && extract::kind(&path).is_some() {
            result.paths.push(canonical);
        } else {
            result.skipped += 1;
        }
    }
    result.paths.sort();
    result
}

fn read_source(path: &Path) -> Result<Vec<u8>> {
    let file = File::open(path)
        .map_err(|_| "Original file could not be opened. Check its permissions.".to_string())?;
    let limit = if extract::kind(path) == Some("pdf") {
        extract::MAX_PDF_BYTES
    } else {
        extract::MAX_FILE_BYTES
    };
    if file.metadata().map_err(|e| e.to_string())?.len() > limit {
        return Err(format!(
            "File exceeds the {} MiB indexing limit.",
            limit / 1024 / 1024
        ));
    }
    let mut bytes = Vec::new();
    file.take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Original file could not be read.".to_string())?;
    if bytes.len() as u64 > limit {
        return Err("File grew beyond its indexing limit while being read.".into());
    }
    Ok(bytes)
}

/// Documents commit independently. An interrupted run can be repeated: unchanged hashes retain passage IDs.
pub fn refresh(
    library: &mut Library,
    cancel: &AtomicBool,
    mut update: impl FnMut(&IndexProgress),
) -> Result<IndexProgress> {
    let mut progress = IndexProgress {
        phase: "running".into(),
        started_at: now(),
        ..Default::default()
    };
    update(&progress);
    let mut incomplete = false;
    for root in library.roots()? {
        if cancelled(cancel) {
            break;
        }
        progress.current = root.label.clone();
        progress.detail = "Scanning selected source…".into();
        update(&progress);
        let discovery = discover(&root, cancel);
        progress.skipped += discovery.skipped;
        progress.errors += discovery.errors;
        if !discovery.complete {
            incomplete = true;
            progress.detail =
                "Source scan was incomplete. Existing entries outside this scan were retained."
                    .into();
        }
        let mut seen = HashSet::new();
        for path in discovery.paths {
            if cancelled(cancel) {
                break;
            }
            let path_string = path
                .to_str()
                .ok_or("A source path is not Unicode.")?
                .to_string();
            seen.insert(path_string.clone());
            progress.visited += 1;
            progress.current = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            update(&progress);
            let kind = extract::kind(&path).unwrap_or("txt");
            match read_source(&path) {
                Ok(bytes) => {
                    let fingerprint = format!("{:x}", Sha256::digest(&bytes));
                    if library.fingerprint(&path_string)?.as_deref() == Some(&fingerprint) {
                        progress.unchanged += 1;
                    } else {
                        let result = extract::extract(&path, &bytes);
                        if cancelled(cancel) {
                            break;
                        }
                        if result.is_ok() {
                            progress.indexed += 1;
                        } else {
                            progress.errors += 1;
                        }
                        library.replace_document(
                            root.id,
                            &path_string,
                            kind,
                            &fingerprint,
                            bytes.len() as u64,
                            result,
                        )?;
                    }
                }
                Err(error) => {
                    progress.errors += 1;
                    library.replace_document(root.id, &path_string, kind, "", 0, Err(error))?;
                }
            }
            update(&progress);
        }
        if discovery.complete && !cancelled(cancel) {
            let mut offset = 0;
            loop {
                let documents = library.documents(Some(root.id), offset)?;
                if documents.is_empty() {
                    break;
                }
                for document in &documents {
                    if !seen.contains(&document.path) && document.status != "missing" {
                        library.mark_missing(document.id)?;
                        progress.missing += 1;
                    }
                }
                offset += documents.len() as u32;
            }
        }
    }
    progress.phase = if cancelled(cancel) {
        "cancelled"
    } else if incomplete {
        "partial"
    } else {
        "complete"
    }
    .into();
    progress.detail = if cancelled(cancel) {
        "Completed documents were kept. Refresh to resume.".into()
    } else if incomplete {
        "Some entries could not be scanned, or a safety limit was reached. Existing unscanned entries were retained.".into()
    } else {
        String::new()
    };
    progress.finished_at = Some(now());
    progress.current.clear();
    update(&progress);
    Ok(progress)
}
