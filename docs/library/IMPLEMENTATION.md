# VOID Library: implementation checkpoints

Scope approved 2026-11-19. Library belongs to VOID, with explicit source selection for Mind Mini. The standalone VOID Mind repository is unchanged.

## Acceptance contract

- Import explicitly selected folders or Markdown/TXT/PDF files; never write to originals. Support PDFs with selectable text; explain scans, encrypted, malformed or unreadable files.
- Persist source registrations, extracted passages, searchable text and notes locally. Browse, filter and search without any model, network service or downloads.
- Read results at their actual page or line range, with document identity and snapshot provenance. Sources are data, never instructions or executable markup.
- Index incrementally outside the UI thread, with observable progress, cancellation, atomic document replacement, bounded inputs, and recovery after interrupted work. Detect updates and deletions without silently serving old text as current.
- Send only explicitly chosen passages to the existing local provider, within a measured context budget. Preserve source snapshots with answers, expose clickable references and validate citation identifiers. Do not claim a model citation proves semantic correctness.
- Save notes linked to source snapshots; preserve notes when an original moves/disappears. Remove individual sources and provide complete Library data removal without touching originals or unrelated VOID data.
- Keep shared Base UI primitives, Urbanist/Barlow, glacial black/white, keyboard flows, reduced motion and usable 720x560 layout.
- Validate extraction, search relevance, persistence, updates/deletions, failures, cancellation, references, context boundaries and performance against a reproducible synthetic collection. Record native/manual acceptance in a GitHub issue; no desktop control.

## Checkpoints

1. Native local foundation: SQLite/FTS5, extraction, stable passages, incremental/recoverable indexing and storage tests.
2. Background command boundary: native file selection, bounded filesystem traversal, progress/cancel/restart and maintenance commands.
3. Library interface: source management, search, reader, notes, empty/error/loading states, compact layout.
4. Mind integration: explicit attachments, context budgeting, persistent source snapshots, reference navigation and save-answer notes.
5. Full verification: reproducible collection and measurements, unit/native/headless suites, visual inspection, documented limitations and manual acceptance issue. Commit cohesive checkpoints.

## Architecture decisions

- A small Rust `void-library` crate owns durable Library data and extraction. Tauri is an adapter; the crate is testable without launching a WebView.
- SQLite bundled with the application provides transactions and FTS5. No embedding model or extra inference is required for search.
- Library data lives under the application's local data directory, separately from existing conversation/settings storage. The source files stay in place.
- A document update commits its metadata and all passages atomically. Hashes identify indexed snapshots; passage locations refer to those exact snapshots.
- Registration never grants recursive access outside the selected root. Symlinks/reparse points are skipped. Limits and skipped/error counts must be visible.
- Search treats user text as literal terms, not raw FTS syntax. No externally supplied SQL is executed.
- PDF extraction is local and page-aware, using a pinned Rust dependency. No OCR in this phase.

## Evidence

Checkpoint 1: native core implemented. `cargo test --manifest-path desktop/library-core/Cargo.toml -- --nocapture` passes 11 tests on Windows. A Unix-only symlink isolation test is included for the Linux runner. Coverage includes UTF-8/UTF-16, binary/empty text, bounded chunks with line locations, two-page selectable PDF and page identity, unreadable/empty PDF errors, persistence, accent-aware literal search, incremental updates/deletion/restoration, stable unchanged passage IDs, atomic rollback, cancellation/resume, note snapshot preservation and logical data removal, overlapping selections, oversized PDFs, future schema rejection and a 300-document synthetic baseline.

Observed debug-build baseline on the development machine (2026-11-19): 300 generated Markdown files, 872 ms index time, three query samples 1,255 / 935 / 882 microseconds, 385,024 database bytes. These are reproducible controlled measurements, not a UI/native-app or broad performance claim. Memory and realistic mixed-document measurements remain pending.

Still pending: background command adapter, UI, attachment/reference integration, full evaluation, native manual issue and final acceptance audit. PDF cancellation is currently cooperative at file boundaries. The core does not yet bound parser CPU time or decompression memory independently; this must be addressed or explicitly constrained before acceptance.


Checkpoint 2 (native adapter): Tauri commands now wrap the core in blocking-worker tasks; indexing owns an independent thread with progress, cooperative cancellation, concurrency gating and shutdown cancellation. The database is scoped to `app_data_dir()/library/library.sqlite`. Source registration, read/search/pagination, source snapshots, linked notes, source removal and clear operations are exposed. `cargo test --manifest-path desktop/src-tauri/Cargo.toml` passes 3 native tests, including a 100-file background job and rejection of a concurrent job. No WebView, picker or installed app was opened. CI now includes locked core tests on both Linux and Windows.


Checkpoint 3 (first interface pass): Library is a lazy-loaded VOID module with shared Base UI controls and scroll areas. Sources, literal full-text search, format filters, paginated documents/passages, a page/line reader, linked-note editing, confirmed removals and clear-data controls are implemented. Reader metadata and passages are loaded in one SQLite read transaction; bulk source registration is atomic. Reader keyboard entry/return and compact layout are covered. The browser-only preview explains native file access availability instead of pretending to index files.

Two headless Library tests pass against controlled native-command fixtures; desktop and 720x560 reader screenshots were inspected. Build and the existing 154 frontend unit tests pass. The complete expanded E2E suite passes: 21 tests, including the existing Mind, Orbit, Typing, Stacker and shell flows. The core now passes 12 Windows tests (plus a Unix-only symlink test included for CI), and native tests remain 3/3. Lint and the core Clippy check also pass. Native/manual acceptance is tracked at https://github.com/SCamposs/void/issues/14. No installed app, file picker or desktop surface has been controlled.

Remaining mandatory work: Mind Mini explicit selection/context/reference integration and saved-answer notes; source freshness behavior between refreshes; durable unfinished-note handling; PDF parser CPU/memory isolation; mixed corpus, memory/latency and failure evaluation; final native/frontend/CI verification and acceptance audit. Library is not release-ready yet.
