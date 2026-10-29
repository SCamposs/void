# VOID shared visual foundation

## Direction

VOID adopts the approved VOID Mind visual language while retaining its modular product structure. Darkness is the environment; glacial light identifies content, action and focus. This phase changes the shell and shared presentation, not the specialized design or mechanics of Orbit, Typing, Stacker or embedded Mind.

## Sources of truth

- `desktop/src/app/styles/tokens.css`: black/glacial OKLCH palette, Urbanist display and Barlow body/control families, spacing, radii, motion and z-index.
- `desktop/src/app/components/ui/Controls.tsx`: source-owned Base UI compositions for buttons, fields, selects, checks, switches, sliders, numeric fields, disclosures, progress, scroll areas and tooltips. Modules share these implementations rather than styling native control behavior independently.
- `desktop/src/app/components/ui/Confirmation.tsx`: asynchronous, focus-contained destructive confirmations with cancellation focused by default.
- `desktop/src/app/styles/controls.css`: interaction states, portalled popup placement, custom scrollbars and reduced motion.
- `desktop/src/app/styles/shell.css`: titlebar, navigation, Home, Settings and shell adaptation of existing module chrome.
- `desktop/src/app/components/ui/VoidMark.tsx`: exact canonical path, unchanged from the original VOID logo. Boot uses the same path and resolves to glacial white.

Fonts are bundled locally. Urbanist belongs to wordmarks/headings; Barlow belongs to reading and controls; mono remains for code, identifiers and module-specific measures where appropriate. Placeholders use the same legible neutral ramp as secondary text. Disabled controls retain the ordinary cursor.

## Composition and interaction

Home uses open space and simple module rows rather than placeholder metrics or a dashboard card grid. Shared navigation has meaningful outline icons; the sidebar toggle changes its actual width. The titlebar provides drag space and narrow native minimize/maximize/close operations, without granting general command execution. Command navigation uses a Base UI Dialog with search focus and keyboard dismissal.

Selectors render through a portal above clipping containers, retain controlled values/disabled options, and use one selection vocabulary. Sliders/numeric fields expose semantic labels and keyboard control. Original module callbacks and persisted setting values are retained. Stacker ignores keyboard events from the new composite controls/dialogs so interacting with settings does not operate the game board.

The operating system still owns file pickers. Hidden file inputs remain native for explicit import; their visible actions follow VOID styling. Existing engine/rendering/gameplay layouts, provider capabilities and data formats are not redesigned here. This phase does not replace embedded Mind with the standalone Mind product.

## Installer and validation

NSIS uses the canonical VOID icon and the approved Mind header/sidebar artwork, generated from the identical shared mark. Native installer page bodies remain native, as approved previously. Production updater configuration/signing remains unchanged. The CI candidate temporarily disables updater-artifact generation for packaging validation only; it is not a signed production release.

The validation workflow runs unit/type/lint/build checks, headless browser interaction/screenshots on an isolated Linux runner, and Windows native tests/NSIS compilation. It never installs a package or interacts with a user's desktop. Native titlebar, installer/upgrade/uninstall, real Windows font/focus rendering and final visual acceptance require manual validation and are tracked separately. Automated evidence is not human visual approval.

## Next phase

Refine Orbit, Typing, Stacker and embedded Mind individually, using these shared primitives and tokens. Preserve their domain behavior while reviewing each layout and specialized interaction against its own purpose.
