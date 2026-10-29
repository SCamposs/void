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

Boot also carries Mind's restrained identity moment: canonical trace/fill, a cold bloom, wordmark resolution and one brief chromatic separation. The action to skip stays at the lower edge. All of this resolves immediately under reduced motion; it is not continuous decoration or configurable legacy texture.

## Composition and interaction

Home uses open space and simple module rows rather than placeholder metrics or a dashboard card grid. Shared navigation has meaningful outline icons; the sidebar toggle changes its actual width. The titlebar provides drag space and narrow native minimize/maximize/close operations, without granting general command execution. Command navigation uses a Base UI Dialog with search focus and keyboard dismissal.

Selectors render through a portal above clipping containers, retain controlled values/disabled options, and use one selection vocabulary. Sliders/numeric fields expose semantic labels and keyboard control. Original module callbacks and persisted setting values are retained. Stacker ignores keyboard events from the new composite controls/dialogs so interacting with settings does not operate the game board.

The operating system still owns file pickers. Hidden file inputs remain native for explicit import; their visible actions follow VOID styling. Existing engine/rendering/gameplay layouts, provider capabilities and data formats are not redesigned here. This phase does not replace embedded Mind with the standalone Mind product.

Typing's invisible gameplay keystroke capture also remains a native input, preserving its original caret/IME semantics and avoiding form styling on a screen-reader-only element. Its visible selectors/actions use the shared Base UI components, with an explicit focus destination back to the capture field after a selector closes.

## Installer and validation

NSIS uses the canonical VOID icon and the approved Mind header/sidebar artwork, generated from the identical shared mark. Native installer page bodies remain native, as approved previously. Installation is explicitly per-user; updates run quietly on Windows after consent in a branded dialog. Checks run at startup and hourly unless Settings selects manual-only mode. Download progress is real and unknown size stays indeterminate. The existing VOID updater key is retained, with signed DEB/AppImage routes matching the installed Linux package. Native install/restart acceptance remains tracked separately. The CI candidate temporarily disables updater-artifact generation for packaging validation only; it is not a production release.

The validation workflow runs unit/type/lint/build checks, headless browser interaction/screenshots on an isolated Linux runner, and Windows native tests/NSIS compilation. It never installs a package or interacts with a user's desktop. Native titlebar, installer/upgrade/uninstall, real Windows font/focus rendering and final visual acceptance require manual validation and are tracked separately. Automated evidence is not human visual approval.

## Next phase

Refine Orbit, Typing, Stacker and embedded Mind individually, using these shared primitives and tokens. Preserve their domain behavior while reviewing each layout and specialized interaction against its own purpose.

### Orbit settings: first module pass

The first refinement is limited to Orbit's floating settings and action controls. The overflow came from a 150px shell override inside a 128px grid column. Orbit now owns a shrinkable field grid; the shell no longer sets its field widths. The panel uses shared color, spacing, radius and font tokens, consistent icons/tooltips, and a controlled Base UI Popover with collision-aware portal placement. Select options remain portalled and can extend outside the panel while staying inside the window.

Base UI owns outside dismissal and layered Escape/focus behavior; the old module-wide Escape listener is removed. An unavailable-microphone notice lives inside the open panel, avoiding a second overlapping floating message. Rendering, simulation, quality selection, audio analysis and settings storage contracts remain unchanged. Browser checks run only on isolated CI, including field containment, supported small windows, text scaling, nested menus, persistence and a simulated denied-permission state. Native DPI and actual microphone permission/device behavior remain manual acceptance.

Source `b0627bd` on `orbit-settings-polish` passed lint, TypeScript, 129 unit tests, production build, eight browser scenarios, Windows native tests and NSIS candidate packaging in [CI 40930690426](https://github.com/SCamposs/void/actions/runs/40930690426). Screenshots were inspected at 1280×800 and 720×560, including increased text size and the denied-permission fixture. This is a branch checkpoint, not part of the published v0.3.0-alpha installer. No application/browser/installer was launched on the user's PC. Native DPI/permission acceptance is listed in [issue #2](https://github.com/SCamposs/void/issues/2).

## Fixed identity amendment

The App appearance customization section was removed at the maintainer's request. The new identity is fixed by shared tokens rather than by the old theme settings. The shell no longer reads, migrates or writes legacy appearance preferences, and importing an older backup cannot restyle the application. Navigation collapse remains a functional preference. Specialized module controls remain within their existing scope.
