# VOID Product

## Register

product

## Users

VOID is for a solo desktop user who wants compact local tools with a distinctive, low-distraction interface. The app is used in focused sessions, often full-window, where keyboard flow matters but the product must still feel like a deliberate graphical desktop application.

## Product Purpose

VOID is a desktop-first shell for focused modules such as Typing, Orbit, Stacker, and Mind Mini. Success means each module is useful on its own while the whole application shares one visual language, one interaction vocabulary, and one standard of finish.

The product is local-first. It should make local capability feel calm and dependable, not expose implementation detail as decoration. Technical facts appear only when they help a person make a decision or recover from a problem.

## Brand Personality

Quiet, liminal, precise.

VOID should feel like a modern desktop instrument used in a dark room. The interface recedes until state, content, or an action needs attention. The exact VOID symbol, near-black environment, ice-white light, compact geometry, and restrained motion carry the identity.

VOID Mind is the approved reference for the next visual refinement of the parent application. It is a quality bar and a source of shared primitives, not a screen-for-screen template. VOID keeps its modular character and subtle monitor texture; it adopts Mind's clarity, typography, focus treatment, component discipline, and resistance to decorative noise.

## Anti-references

VOID must not become:

- a green terminal, hacker panel, or colorful cyberpunk dashboard
- a generic gray-card dashboard or rounded SaaS shell
- an interface covered in telemetry, internal status, or developer-facing labels
- a collection of native browser controls styled differently on each screen
- an AI-branded surface built from sparkles, magic wands, stars, or generic orbit imagery
- a showcase for scanlines, noise, glow, glitch, or animation at the expense of the active task
- a set of cloned VOID Mind screens that erase the purpose of each VOID module

## Approved Visual Direction

### Environment and light

- Large regions stay at or near absolute black. Panels use only enough tonal separation to explain structure.
- Ice-white is earned. Use it for the VOID identity, primary actions, current selection, focus, and important live state.
- Warm charcoal from the current VOID palette may remain where it supports the parent product's monitor character, but medium-gray application shells are not allowed.
- Borders are sparse hairlines. Do not outline every region or combine a decorative border with a wide soft shadow.
- Red and cyan are exceptional signals for error or a brief identity displacement. They are never permanent decorative accents.

### Typography

- Use bundled Urbanist for the VOID wordmark and headings, and bundled Barlow for body text and controls, matching VOID Mind. System sans is only a fallback. Fonts are served locally, without a font CDN.
- Reserve mono for code, short technical facts, counters, and rare identity labels. The whole interface must not read like a terminal.
- Keep the product scale compact and fixed. Use weight, spacing, and tone before increasing size.
- Long-form text stays between 65 and 75 characters per line with comfortable line height.
- Uppercase and wide tracking are identity tools, not default section labels.

### Geometry and spacing

- Use a small, repeatable radius vocabulary: 6px for controls and 10px for raised menus or bounded groups.
- Full pills are reserved for tags or controls whose shape communicates a distinct state.
- Prefer open composition, separators, and tonal layers over stacks of cards.
- Use a 4px base spacing rhythm, with 8, 12, 16, 24, 32, and 48px as the main steps.
- Dense does not mean cramped. Every screen must retain a clear reading path and reliable hit areas.

## Interaction Standard

### Focus

- Every keyboard-operable control has one visible focus treatment. Never show the browser ring and a custom ring at the same time.
- The default is a two-pixel ice-white outline with a three-pixel offset.
- Compact fields and select triggers may use a one-pixel outline with a two-pixel offset when the stronger ring would visually double the field edge.
- Composite controls use :focus-within on their outer boundary. Do not draw separate focus rectangles around both container and inner input.
- Focus must follow the actual geometry of the control and must never become a large rectangular box around unrelated content.

### Fields and composers

- Inputs use a near-black fill, a quiet neutral edge, legible placeholder text, and the shared focus treatment.
- A composer is one component. Text area, context controls, and send action share a boundary instead of looking like unrelated nested fields.
- Error, disabled, loading, and read-only states remain legible and are described with language, not color alone.

### Selects and popovers

- Do not ship the browser's default select appearance in branded surfaces.
- Use one shared select component for field and compact variants, with the same trigger, chevron, selected mark, option spacing, and state vocabulary.
- Popovers render above clipping containers, stay within the window, reposition on scroll or resize, and restore focus to the trigger when closed.
- Keyboard behavior includes Arrow keys, Home, End, Enter, Space, Escape, and Tab. Disabled options are skipped.

### Icons

- Icons describe actions or navigation. They do not decorate empty space.
- Use one coherent outline family and consistent optical sizing.
- Do not use sparkle, star, or magic-wand symbols to mean intelligence. The product's intelligence is expressed through behavior, language, and the VOID identity.
- An icon-only action needs an accessible name and a tooltip when its meaning is not immediately standard.

## Motion and Texture

- Most state transitions last 150 to 250ms with a decisive ease-out curve.
- Motion communicates entry, progress, selection, completion, or recovery. It is not ambient decoration.
- The exact VOID path may trace and fill during boot. Its final fill remains ice-white; it must never resolve to black or disappear into the background.
- Boot motion may include one short identity bloom or red/cyan displacement. Continuous glitch is prohibited.
- The parent VOID may retain subtle noise and scanlines, but texture must be stable, low-opacity, and subordinate to content.
- Every non-essential animation has a prefers-reduced-motion resolution that removes both movement and unnecessary waiting.

## Shared Component Direction

The visual refactor should centralize real repetition, not create abstractions for their own sake. Prioritize these shared primitives:

1. Button variants: primary, secondary, quiet, destructive, and icon-only.
2. Field frame: input, text area, search, and composite composer focus behavior.
3. Select control: field and compact variants with a portalled popover.
4. Popover surface: placement, edge avoidance, keyboard dismissal, and elevation.
5. Navigation item: default, hover, current, disabled, and compact modes.
6. Status language: loading, success, warning, error, offline, and unavailable.
7. VOID mark and BootIntro: one exact geometry with product-specific wordmark treatment.

Do not centralize a component until at least two surfaces need the same behavior. When two implementations differ only accidentally, converge them before adding variants.

## Module Adaptation

- **Shell:** adopt the calmer Mind typography, spacing rhythm, focus language, and shared controls first.
- **Typing:** keep words and rhythm dominant. Analysis controls remain progressively disclosed and compact.
- **Orbit:** preserve the visual simulation as the main surface. UI chrome stays quiet and uses the shared control vocabulary.
- **Stacker:** preserve immediate game feedback while removing arcade effects that compete with board state.
- **Mind Mini:** inherit shared primitives and the exact VOID identity, but keep a reduced scope distinct from the standalone VOID Mind product.
- **Updater and settings:** present decisions and recovery clearly. Internal release metadata appears only when it helps the user verify or troubleshoot an update.

## Accessibility and Inclusion

- Target WCAG 2.2 AA contrast for text, placeholders, controls, and focus indicators.
- All primary flows work with keyboard and pointer.
- Touch targets and icon buttons remain usable at compact desktop density.
- Reduced motion, zoom, smaller windows, long localized labels, empty data, and error states are part of the design, not follow-up work.
- Responsive behavior changes structure before content becomes cramped. Sidebars collapse, popovers reposition, and wide content scrolls internally when appropriate.

## Refactor Sequence

1. Inventory current tokens and repeated control patterns without changing module behavior.
2. Introduce the palette, typography, spacing, radius, motion, and z-index tokens.
3. Replace global focus rules and native branded selects with shared primitives.
4. Refactor the application shell and navigation.
5. Migrate one module at a time, starting with the least visually specialized surface.
6. Preserve Orbit, Typing, and Stacker behavior while adapting their chrome.
7. Validate every migrated surface at normal and small window sizes, with keyboard navigation and reduced motion.

## Definition of Visual Done

A migrated VOID surface is done when:

- it reads as part of the same product as VOID Mind without becoming a copy of it
- no default browser control, accidental focus rectangle, or inconsistent popover remains
- every interactive component has default, hover, focus, active, disabled, loading, and error behavior where applicable
- icons communicate real actions and avoid generic AI symbolism
- the exact VOID mark remains geometrically unchanged and resolves correctly in motion
- typography, spacing, radii, borders, and motion come from shared tokens
- the surface remains usable by keyboard, with reduced motion, at smaller supported window sizes
- visual validation confirms hierarchy and interaction states, while automated checks confirm that module behavior did not regress


## Current visual foundation scope

The 2026-10-29 transfer brings the approved Mind palette, fonts, shared Base UI primitives, focus/scrollbar states, application shell, custom titlebar and installer artwork into VOID. Existing module controls consume the shared primitives, while module engines, renderers, domain flows and specialized layouts remain for subsequent per-module work. See [DESIGN.md](DESIGN.md). No Mind account/provider features are copied into the embedded Mind module as part of this visual transfer.
