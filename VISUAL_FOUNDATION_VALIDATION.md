# VOID visual foundation transfer

Date: 2026-10-29. Scope: the shared visual foundation approved in VOID Mind, adapted to VOID. Individual module redesign and new provider/product features are outside this change.

## Delivered

- Shared black/glacial OKLCH tokens, locally bundled Urbanist headings/wordmark and Barlow body/control fonts. Font licenses ship under `public/licenses`.
- Source-owned Base UI buttons, text/multiline fields, custom portalled selects, switches/checks, sliders, number fields, disclosures, progress, tooltips, dialogs, scroll surfaces and keyboard-accessible file actions.
- Quiet Home/navigation, useful icons, an actual collapsing sidebar, searchable keyboard navigation, integrated titlebar and narrow native window permissions.
- Canonical mark/trace/fill, cold boot lighting, wordmark resolution and one short chromatic accent. Reduced motion removes the nonessential movement and waiting.
- VOID NSIS icons, header/sidebar and uninstaller header. Native installer page bodies remain native, matching the approved Mind installer scope.
- Removed App appearance and its old theme state/loading/migration. Legacy saved appearance values cannot alter the fixed new identity; navigation collapse remains functional. No existing user data is deleted for this change.

The original Typing/Stacker engines, Orbit renderer/shaders/audio and embedded Mind provider/store are unchanged. Module-facing changes replace shared controls and guard game shortcuts when focus is inside those controls or dialogs. Module-specific layouts, gameplay and capabilities remain for later work.

## Validation boundaries

Local lint, TypeScript, all 124 existing unit tests and the production frontend build passed. No desktop application, browser window or installer was opened on the user's PC for validation.

Headless Chromium validation runs only on isolated GitHub Actions Linux runners. It exercises desktop/compact navigation, keyboard dialogs, actual controlled field callbacks, persistence, disabled/default states, fixed identity despite legacy preferences, safe confirmation cancellation, numeric stepping, reduced motion and intro dismissal. The intro test completes the browser's real CSS animations to inspect terminal fill RGBA, checks the animation duration budget, and separately verifies automatic and Escape dismissal. This is a deterministic terminal-style check, not a claim of manually observing the exact timed animation on Windows.

The text palette was checked against the darkest and raised neutral surfaces using OKLCH-to-linear-sRGB relative luminance. The lowest tested ratios, against the raised surface, are 15.25:1 for primary text, 7.46:1 for muted text and 6.16:1 for the secondary/placeholder ramp. Disabled-state exceptions are not presented as ordinary text contrast results.

The workflow builds a Windows NSIS candidate with updater-artifact generation disabled only for validation. Production updater endpoints, signing workflow, version and release tags are unchanged. A candidate build is not a newly published signed production release.

## Manual acceptance

[Issue #2](https://github.com/SCamposs/void/issues/2) tracks native titlebar/window actions, DPI/font rendering, real installer/upgrade/uninstall behavior and final visual approval. CI screenshots/compilation do not substitute for those checks. [Issue #1](https://github.com/SCamposs/void/issues/1) separately tracks Windows artifact signing.

The sibling VOID Mind repository is reference material only for this transfer and remains unchanged. The existing local and remote VOID documentation commits were preserved when preparing the feature branch. The branch is named `mind-visual-foundation`, without a tooling prefix.

## CI receipts

The final application source at `7f11e22bdfb05f5e4eb53d2f91fc14337159eebe` passed both frontend and native-windows jobs in [run 40917452481](https://github.com/SCamposs/void/actions/runs/40917452481): lint, TypeScript, 124 unit tests, six browser scenarios, two native tests and NSIS packaging. CI screenshots of Home, Settings and the final white intro were inspected. No native installation or execution was performed.

The Windows candidate artifact is `VOID-visual-foundation-Windows-candidate`, containing `VOID_0.2.0-alpha_x64-setup.exe` (3,476,363 bytes). SHA-256: `1FB2689653CE5C95D510691E37BE117C5960072F8E85EF61DC9CCA408D5B8883`. A local ignored copy is under `desktop/.visual-qa/final-Windows-candidate/`; the artifact in the linked workflow is the downloadable receipt.

Earlier failed runs remain in the history. They exposed incorrect test expectations for a fresh unconfigured Mind screen and textual comparison of equivalent animated colors serialized in different CSS color spaces. The corrected checks retain real UI assertions and explicit RGBA/opacity requirements rather than ignoring failures.

Later runs also exposed a real integration regression when rapidly entering the accented word `rápido` in Typing. The invisible gameplay keystroke capture retains a native input, while visible form controls use the shared Base UI foundation. Selector focus returns directly to that capture. The final browser suite passes the fixed accented-word case; failed runs were not hidden or accepted through retries.
