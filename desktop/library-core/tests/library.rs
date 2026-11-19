use std::{
    fs,
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
    time::Instant,
};
use tempfile::TempDir;
use void_library::{extract, index, models::Passage, storage::Library};

fn fixture() -> (TempDir, std::path::PathBuf, Library) {
    let temp = TempDir::new().unwrap();
    let sources = temp.path().join("sources");
    fs::create_dir(&sources).unwrap();
    let library = Library::open(&temp.path().join("library.sqlite")).unwrap();
    (temp, sources, library)
}
fn run(library: &mut Library) -> void_library::models::IndexProgress {
    index::refresh(library, &AtomicBool::new(false), |_| {}).unwrap()
}

/// Small valid, selectable-text PDF, assembled with exact xref byte offsets. No external generator.
fn pdf(pages: &[&str]) -> Vec<u8> {
    let mut objects = vec![
        "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
        String::new(),
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".into(),
    ];
    let mut kids = Vec::new();
    for (i, text) in pages.iter().enumerate() {
        let page_id = 4 + i * 2;
        kids.push(format!("{page_id} 0 R"));
        objects.push(format!("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents {} 0 R >>",page_id + 1));
        let text = text
            .replace('\\', "\\\\")
            .replace('(', "\\(")
            .replace(')', "\\)");
        let stream = format!("BT /F1 12 Tf 40 740 Td ({text}) Tj ET");
        objects.push(format!(
            "<< /Length {} >>\nstream\n{}\nendstream",
            stream.len(),
            stream
        ));
    }
    objects[1] = format!(
        "<< /Type /Pages /Kids [{}] /Count {} >>",
        kids.join(" "),
        pages.len()
    );
    let mut out = String::from("%PDF-1.4\n");
    let mut offsets = vec![0];
    for (i, object) in objects.iter().enumerate() {
        offsets.push(out.len());
        out.push_str(&format!("{} 0 obj\n{}\nendobj\n", i + 1, object));
    }
    let xref = out.len();
    out.push_str(&format!(
        "xref\n0 {}\n0000000000 65535 f \n",
        objects.len() + 1
    ));
    for offset in offsets.iter().skip(1) {
        out.push_str(&format!("{offset:010} 00000 n \n"));
    }
    out.push_str(&format!(
        "trailer\n<< /Root 1 0 R /Size {} >>\nstartxref\n{}\n%%EOF\n",
        objects.len() + 1,
        xref
    ));
    out.into_bytes()
}

#[test]
fn text_locations_unicode_and_encodings_are_preserved() {
    let text = "# Planejamento\r\n\r\nA revisão será na terça-feira.\r\n";
    let chunks = extract::extract(Path::new("nota.md"), text.as_bytes()).unwrap();
    assert_eq!(chunks[0].line_start, Some(1));
    assert_eq!(chunks[0].line_end, Some(3));
    assert!(chunks[0].text.contains("terça-feira"));
    let utf16: Vec<u8> = [0xff, 0xfe]
        .into_iter()
        .chain("Anotação local".encode_utf16().flat_map(u16::to_le_bytes))
        .collect();
    assert!(extract::extract(Path::new("note.txt"), &utf16).unwrap()[0]
        .text
        .contains("Anotação"));
    assert!(extract::extract(Path::new("binary.txt"), b"text\0binary").is_err());
    assert!(extract::extract(Path::new("empty.txt"), b" \n").is_err());
    let long = "ação ".repeat(1000);
    let chunks = extract::extract(Path::new("long.txt"), long.as_bytes()).unwrap();
    assert!(chunks.len() > 1);
    assert!(chunks.iter().all(|p| p.text.chars().count() <= 1600));
    assert_eq!(
        chunks
            .iter()
            .map(|p| p.text.as_str())
            .collect::<String>()
            .trim_end(),
        long.trim_end()
    );
}

#[test]
fn pdf_has_actual_page_numbers_and_clear_failures() {
    let chunks = extract::extract(
        Path::new("two.pdf"),
        &pdf(&["Project Juniper", "Budget approved: 42 units"]),
    )
    .unwrap();
    assert!(chunks
        .iter()
        .any(|p| p.page == Some(1) && p.text.contains("Juniper")));
    assert!(chunks
        .iter()
        .any(|p| p.page == Some(2) && p.text.contains("42 units")));
    assert!(extract::extract(Path::new("damaged.pdf"), b"not a pdf")
        .unwrap_err()
        .contains("could not be read"));
    assert!(extract::extract(Path::new("scan.pdf"), &pdf(&[""]))
        .unwrap_err()
        .contains("OCR"));
}

#[test]
fn import_search_persistence_and_originals_are_independent() {
    let (temp, sources, mut library) = fixture();
    let file = sources.join("decision.md");
    let content = "# Decisão\nA revisão do projeto Juniper começa na terça-feira.\nO orçamento é de 42 unidades.";
    fs::write(&file, content).unwrap();
    library.add_root(&sources).unwrap();
    let progress = run(&mut library);
    assert_eq!(progress.indexed, 1);
    let hits = library.search("revisao Juniper", None, None, 0).unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].passage.line_start, Some(1));
    assert_eq!(fs::read_to_string(&file).unwrap(), content);
    drop(library);
    let reopened = Library::open(&temp.path().join("library.sqlite")).unwrap();
    assert_eq!(
        reopened.search("orçamento", None, None, 0).unwrap().len(),
        1
    );
    assert!(reopened
        .search("Juniper OR nonexistent", None, None, 0)
        .unwrap()
        .is_empty());
    assert!(reopened.search("\" OR * NEAR() --", None, None, 0).is_ok());
    assert!(reopened.search("*", None, None, 0).unwrap().is_empty());
}

#[test]
fn refresh_keeps_unchanged_ids_and_replaces_changed_or_missing_sources() {
    let (_temp, sources, mut library) = fixture();
    let file = sources.join("plan.txt");
    fs::write(&file, "originalkeyword").unwrap();
    library.add_root(&sources).unwrap();
    run(&mut library);
    let old = library.search("originalkeyword", None, None, 0).unwrap()[0]
        .passage
        .id;
    assert_eq!(run(&mut library).unchanged, 1);
    assert_eq!(
        library.search("originalkeyword", None, None, 0).unwrap()[0]
            .passage
            .id,
        old
    );
    fs::write(&file, "replacementkeyword").unwrap();
    assert_eq!(run(&mut library).indexed, 1);
    assert!(library
        .search("originalkeyword", None, None, 0)
        .unwrap()
        .is_empty());
    assert!(library.snapshot(old).is_err());
    fs::remove_file(&file).unwrap();
    assert_eq!(run(&mut library).missing, 1);
    assert!(library
        .search("replacementkeyword", None, None, 0)
        .unwrap()
        .is_empty());
    assert_eq!(library.documents(None, 0).unwrap()[0].status, "missing");
    fs::write(&file, "restoredkeyword").unwrap();
    assert_eq!(run(&mut library).indexed, 1);
    assert_eq!(
        library
            .search("restoredkeyword", None, None, 0)
            .unwrap()
            .len(),
        1
    );
}

#[test]
fn failed_updates_remove_stale_search_but_keep_notes_and_snapshots() {
    let (_temp, sources, mut library) = fixture();
    let file = sources.join("note.txt");
    fs::write(&file, "The verified budget is 42 units.").unwrap();
    let root = library.add_root(&sources).unwrap();
    run(&mut library);
    let hit = library.search("budget", None, None, 0).unwrap().remove(0);
    let snapshot = library.snapshot(hit.passage.id).unwrap();
    library
        .save_note(
            None,
            "Budget decision",
            "Approved",
            std::slice::from_ref(&snapshot),
        )
        .unwrap();
    fs::write(&file, b"\0binary").unwrap();
    assert_eq!(run(&mut library).errors, 1);
    assert!(library.search("budget", None, None, 0).unwrap().is_empty());
    assert_eq!(library.documents(None, 0).unwrap()[0].status, "error");
    library.remove_root(root.id).unwrap();
    assert!(library.documents(None, 0).unwrap().is_empty());
    assert_eq!(library.notes().unwrap()[0].sources[0].text, snapshot.text);
    library.clear().unwrap();
    assert!(library.notes().unwrap().is_empty());
    assert!(library.roots().unwrap().is_empty());
    assert!(file.exists());
}

#[test]
fn cancelled_job_resumes_without_duplicate_passages() {
    let (_temp, sources, mut library) = fixture();
    for i in 0..12 {
        fs::write(
            sources.join(format!("{i:02}.txt")),
            format!("fixturetoken document {i}"),
        )
        .unwrap();
    }
    library.add_root(&sources).unwrap();
    let cancel = AtomicBool::new(false);
    let result = index::refresh(&mut library, &cancel, |p| {
        if p.indexed == 3 {
            cancel.store(true, Ordering::Relaxed);
        }
    })
    .unwrap();
    assert_eq!(result.phase, "cancelled");
    assert_eq!(result.indexed, 3);
    let result = run(&mut library);
    assert_eq!(result.indexed, 9);
    assert_eq!(result.unchanged, 3);
    assert_eq!(
        library.search("fixturetoken", None, None, 0).unwrap().len(),
        12
    );
}

#[test]
fn selection_rejects_overlap_and_unsupported_files() {
    let (_temp, sources, library) = fixture();
    let file = sources.join("note.txt");
    fs::write(&file, "fixture").unwrap();
    let root = library.add_root(&sources).unwrap();
    assert_eq!(library.add_root(&sources).unwrap().id, root.id);
    assert!(library.add_root(&file).is_err());
    let other = sources.parent().unwrap().join("unknown.exe");
    fs::write(&other, "fixture").unwrap();
    assert!(library.add_root(&other).is_err());
}

#[test]
fn atomic_document_replacement_rolls_back_on_constraint_failure() {
    let (_temp, sources, mut library) = fixture();
    let file = sources.join("note.txt");
    fs::write(&file, "original").unwrap();
    let root = library.add_root(&sources).unwrap();
    run(&mut library);
    let existing = library.documents(None, 0).unwrap().remove(0);
    let chunk = Passage {
        id: 0,
        document_id: 0,
        ordinal: 0,
        page: None,
        line_start: Some(1),
        line_end: Some(1),
        text: "replacement".into(),
    };
    assert!(library
        .replace_document(
            root.id + 100,
            file.canonicalize().unwrap().to_str().unwrap(),
            "txt",
            "changed",
            11,
            Ok(vec![chunk])
        )
        .is_err());
    assert_eq!(
        library.document(existing.id).unwrap().fingerprint,
        existing.fingerprint
    );
    assert_eq!(library.search("original", None, None, 0).unwrap().len(), 1);
}

#[test]
fn deterministic_collection_measures_search_quality_and_cost() {
    let (_temp, sources, mut library) = fixture();
    let topics = [
        ("juniper", "budget 42 units approved"),
        ("atlas", "launch on Friday"),
        ("cedar", "renewal every March"),
    ];
    for i in 0..300 {
        let (topic, fact) = topics[i % topics.len()];
        fs::write(
            sources.join(format!("document-{i:03}.md")),
            format!(
                "# Document {i}\nProject {topic}: {fact}.\n{}",
                "Supporting evidence. ".repeat(25)
            ),
        )
        .unwrap();
    }
    library.add_root(&sources).unwrap();
    let started = Instant::now();
    let progress = run(&mut library);
    let indexing = started.elapsed();
    assert_eq!(progress.indexed, 300);
    let mut latencies = Vec::new();
    for (topic, _) in topics {
        let started = Instant::now();
        let hits = library.search(topic, None, None, 0).unwrap();
        latencies.push(started.elapsed());
        assert_eq!(hits.len(), 40);
        assert!(hits.iter().all(|hit| hit.passage.text.contains(topic)));
    }
    eprintln!(
        "LIBRARY_BASELINE documents=300 index_ms={} search_us={:?} db_bytes={}",
        indexing.as_millis(),
        latencies.iter().map(|d| d.as_micros()).collect::<Vec<_>>(),
        library.storage_bytes().unwrap()
    );
}

#[test]
fn oversize_inputs_are_reported_and_do_not_prevent_other_documents() {
    let (_temp, sources, mut library) = fixture();
    fs::write(sources.join("valid.txt"), "usefulkeyword").unwrap();
    let large = fs::File::create(sources.join("oversize.pdf")).unwrap();
    large.set_len(extract::MAX_PDF_BYTES + 1).unwrap();
    library.add_root(&sources).unwrap();
    let progress = run(&mut library);
    assert_eq!(progress.indexed, 1);
    assert_eq!(progress.errors, 1);
    assert_eq!(
        library
            .search("usefulkeyword", None, None, 0)
            .unwrap()
            .len(),
        1
    );
    assert!(library
        .documents(None, 0)
        .unwrap()
        .iter()
        .any(|d| d.status == "error" && d.detail.contains("8 MiB")));
}

#[test]
fn future_database_versions_are_not_downgraded() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("future.sqlite");
    let connection = rusqlite::Connection::open(&path).unwrap();
    connection.execute_batch("PRAGMA user_version=99;").unwrap();
    drop(connection);
    assert!(Library::open(&path).err().unwrap().contains("newer VOID"));
    let connection = rusqlite::Connection::open(&path).unwrap();
    assert_eq!(
        connection
            .query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        99
    );
}

#[cfg(unix)]
#[test]
fn symbolic_links_never_expand_the_registered_source() {
    let (temp, sources, mut library) = fixture();
    let outside = temp.path().join("outside.txt");
    fs::write(&outside, "privateoutsidekeyword").unwrap();
    std::os::unix::fs::symlink(&outside, sources.join("link.txt")).unwrap();
    library.add_root(&sources).unwrap();
    let progress = run(&mut library);
    assert_eq!(progress.skipped, 1);
    assert!(library
        .search("privateoutsidekeyword", None, None, 0)
        .unwrap()
        .is_empty());
    assert!(library.add_root(&sources.join("link.txt")).is_err());
}

#[test]
fn bulk_registration_rolls_back_and_format_filter_applies_before_pagination() {
    let (_temp, sources, mut library) = fixture();
    let first = sources.join("first.txt");
    fs::write(&first, "first").unwrap();
    let wrong = sources.join("wrong.exe");
    fs::write(&wrong, "wrong").unwrap();
    assert!(library.add_roots(&[first, wrong]).is_err());
    assert!(library.roots().unwrap().is_empty());
    for i in 0..101 {
        fs::write(sources.join(format!("{i:03}.txt")), "text").unwrap();
    }
    fs::write(sources.join("z-final.md"), "# Final Markdown").unwrap();
    library.add_root(&sources).unwrap();
    run(&mut library);
    let filtered = library.documents_filtered(None, Some("md"), 0).unwrap();
    assert_eq!(filtered.len(), 1);
    assert_eq!(filtered[0].title, "z-final.md");
    let reader = library.reader(filtered[0].id, 0).unwrap();
    assert_eq!(reader.document.id, reader.passages[0].document_id);
}
