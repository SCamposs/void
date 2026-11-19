# Library acceptance evidence

Scope: the approved Library goal in `IMPLEMENTATION.md`, including explicit Mind Mini source selection. This is a development candidate, not a published release.

| Requirement | Authoritative evidence | Acceptance boundary |
| --- | --- | --- |
| Markdown/TXT/selectable PDF import; originals preserved | Core tests `text_locations_unicode_and_encodings_are_preserved`, `pdf_has_actual_page_numbers_and_clear_failures`, `import_search_persistence_and_originals_are_independent` | Synthetic, real extractors; complex real PDFs remain manual |
| Encrypted, malformed, textless, oversized files | Core password-protected, mixed-corpus and oversize tests | Failure text and continued indexing verified |
| Persistent local search, filters and exact page/line reader | Core persistence/filter/pagination tests; `e2e/library.spec.ts`; inspected desktop/720x560 screenshots | UI uses controlled IPC fixtures; core uses real SQLite/FTS5 |
| Incremental updates, deletion/restoration and source identity | Core refresh, source validation, unchanged-ID and original-file checks | Original freshness rechecked on reading and before inference |
| Background work, progress, cancellation and recovery | Tauri background-worker/concurrent-start test; core cancellation/resume and atomic-rollback tests | Actual installed-app close/restart acceptance in #14 |
| Bounded PDF decoding | Real subprocess test, deadline cleanup, malformed recovery, Windows Job Object and Unix limits | Optimized Windows executable passed headless pipe/page smoke; installed Linux/Windows cases in #14 |
| Explicit source selection; no automatic extra inference | Context/store tests, changed-source inference-block test and headless serialized-request assertion | Quoted data separated from system rules; not a proof a real model resists every malicious instruction |
| Context budget and retry behavior | Context overflow, detached-history source and retry-selection tests | Conservative byte estimate; current request/evidence never silently truncated |
| References and answer-linked notes | Identifier/code-preservation tests; browser opens saved reference and saves linked note | Identifier resolution is verified; semantic support and real-model answer quality remain manual |
| Notes and unfinished drafts | Core note persistence/search/pagination; draft isolation/quota tests; module-navigation recovery flow | Write failures surfaced; explicit discard/clear available |
| Source/data removal without touching originals or other modules | Core populated-clear test; note snapshot preservation; draft-key isolation; global module regression suite | Historical copies belonging to Mind conversations remain with those conversations |
| VOID visual/interaction standard | Shared controls/tokens/fonts; keyboard source reader and Base UI dialogs; full shell/module E2E and inspected screenshots | OS scaling, screen readers and installed rendering in #14 |
| Reproducible quality/performance evidence | 300-document baseline and mixed corpus; `measurements-windows.json`; `measure-library.ps1` | Controlled debug measurements, parent memory only; no broad hardware or model-quality claim |
| No new model/training/cloud subsystem | Library uses filesystem, bundled SQLite and local extractor; Mind reuses loopback provider | Existing GitHub updater remains unchanged |
| CI and packaging | [PR #15 checks](https://github.com/SCamposs/void/pull/15/checks) | Exact candidate must pass Linux core/frontend/security and Windows tests/NSIS build before completion |
| Manual acceptance recorded | [Issue #14](https://github.com/SCamposs/void/issues/14) | Open intentionally; no desktop control performed |

Local final verification commands:

```text
npm.cmd run lint --prefix desktop
npm.cmd test --prefix desktop
npm.cmd run build --prefix desktop
npx.cmd playwright test                 # working directory: desktop
cargo test --locked --manifest-path desktop/library-core/Cargo.toml
cargo clippy --manifest-path desktop/library-core/Cargo.toml --all-targets -- -D warnings
cargo test --locked --manifest-path desktop/src-tauri/Cargo.toml
node .github/scripts/check-security.cjs
node --test .github/scripts/release-security.test.cjs
```

Local counts at the candidate audit: 162 frontend unit tests, 19 core tests on Windows (plus one Unix-specific symlink test in Linux CI), 3 Tauri tests, 21 headless UI flows. The real-detector case in the local release-security suite is skipped without its CI tool; the CI security workflow installs the pinned detector. Signing keys, updater identity and release assets are unchanged.
