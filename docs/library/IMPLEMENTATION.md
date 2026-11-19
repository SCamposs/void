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


Checkpoint 4 (Mind Mini integration): passages can be explicitly attached to the active conversation draft, deduplicated, inspected and removed. Mind storage schema 4 preserves source snapshots with both user and assistant messages, isolates draft selections by conversation and honors conversation retention. Prompt assembly places reference data in JSON in user messages with separate system instructions, uses conservative UTF-8 byte budgeting, removes only old complete turns when necessary, and rejects oversized current requests without silently truncating evidence. No extra inference or embedding calls are added.

Before inference, native validation checks the indexed passage identity and re-hashes the original; changed, removed or substituted sources stop generation. The reader checks originals too, displays stale-snapshot warnings and disables attaching stale passages. References use stable passage/hash IDs, link only to supplied snapshots, preserve code text, and warn about unmatched or absent references. Reference validity does not establish semantic support for a claim. Answers can be saved as linked Library notes. Saved reference dialogs keep the quoted text, original location and snapshot identity even after the original changes.

Controlled browser evidence covers selecting a passage, serialized prompt content, simulated streamed answer, reference opening and linked-note saving at compact size. This is not a real-model correctness claim. New unit/native coverage includes storage retention, source identity validation, adversarial instruction/data separation, context overflow, invalid references and freshness before model use. Mandatory remaining work includes bounded PDF execution, unfinished-note recovery, mixed-collection performance/memory and expanded failure testing, CI evidence and final completion audit.


Checkpoint 4 validation: build and lint pass; frontend unit tests 159/159, core native tests 13/13 (plus Unix-only test for CI), Tauri tests 3/3 and the five focused Library/Mind browser flows pass. The simulated request asserts that source rules stay in the system role and selected evidence reaches the user-data context. A separate regression test proves a changed source prevents the inference generator from starting. Compact citation screenshots were inspected. Original files are checked using the registered canonical path; substituted links are rejected.


Checkpoint 5 (resource isolation and unfinished notes): production PDF extraction now starts the same executable in an early headless worker mode, before Tauri/WebView initialization. Parent and worker communicate only through bounded pipes, with an 8 MiB PDF input limit, 16 MiB output limit and 20-second parent wall-clock deadline. Cancellation kills and reaps the child. Windows applies a fresh kill-on-close Job Object with a 512 MiB committed-memory limit before sending input; Unix workers set 512 MiB address-space and 20 CPU-second limits before parsing. Failure to apply OS limits fails closed. Text/Markdown remain in the bounded native indexing thread. The core worker helper exercises the identical decoder/transport independently of Tauri.

The isolated-reader regression verifies page identity, timeout cleanup, successful subsequent extraction, cancellation and malformed-PDF recovery. Core Clippy passes. The app compiles and its 3 native tests pass. The optimized Windows executable also passed a headless worker smoke check: valid PDF bytes were piped into the early worker branch and the expected page/text JSON was returned. The UI was not opened.

Unfinished notes now journal each edit synchronously to a dedicated local draft key, retain up to 20 drafts, restore after module navigation/restart, and distinguish saved notes from drafts. Saving removes only that note's draft; explicit discard and Library clear remove drafts after confirmation. Write failures are surfaced rather than reported as saved. Unit coverage checks independent draft recovery, scoped removal and quota failures; headless coverage restores an unfinished note after leaving the module. Settings explains which data its existing JSON backup covers, including the separate native Library storage.

Remaining: final mixed-corpus performance/memory evidence, release worker smoke, expanded fault cases and final CI/acceptance audit. The main goal remains active.


Controlled mixed-corpus evidence: `mixed_collection_evaluation_uses_real_extractors_and_all_search_pages` creates 90 Portuguese Markdown files, 60 English TXT files, six two-page selectable PDFs and three deliberate failures (malformed PDF, textless PDF, binary TXT). It uses the real bounded PDF subprocess, checks all result pages and exact expected counts/locations, and keeps the 300-document baseline intact. The Windows measurement is reproducible with `desktop/scripts/measure-library.ps1`; raw scoped results are in `measurements-windows.json`: 156 indexed/3 errors, 781 ms indexing, full paginated query samples 3,842 / 2,105 / 837 microseconds, 135,168 database bytes and 9,367,552 bytes parent peak working set. Parent/test RSS excludes PDF processes and WebView. The 512 MiB child ceiling is a safety bound, not measured consumption. These fixtures do not establish performance on arbitrary large or complex PDFs.


Final-audit corrections: note search now queries the whole notes table with Unicode case folding and bounded 40-result pages, instead of searching only the loaded recent list. A regression test reaches an old note beyond the first pages. A password-protected selectable PDF fixture verifies a clear encrypted-document failure without disclosing its text. Manual refresh always invalidates the reader/results even when a tiny indexing job finishes before progress polling starts. Core coverage is now 17 Windows tests plus the Unix-only symlink test.


Explicit-selection audit: prompt packing now uses only the target response's selected source snapshots. Removing an attachment prevents its full text from being resent through older user-message metadata. Regenerate/retry refreshes that response's selection from the current draft while preserving the original historical message snapshots. A regression test verifies both properties. This also makes an outdated-source error recoverable by removing the old attachment and selecting its replacement. Unknown hand-written Library reference links are rendered as unmatched text, and answer-note saving has an in-flight/duplicate-save guard.
