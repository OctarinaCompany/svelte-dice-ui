# Feature Specification: Port Color Swatch Component

**Feature Branch**: `006-port-color-swatch`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Color Swatch\" (slug: color-swatch) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Display a color value at a glance (Priority: P1)

A developer drops a `ColorSwatch` into a page — next to a label, inside a palette list, or as part of
a form control — passing it a CSS color value (hex, rgb, rgba, hsl, hsla, or a named color). The
swatch renders a small, bordered, rounded box filled with that color so a user can visually confirm
what the value represents.

**Why this priority**: This is the sole reason the component exists — every other behaviour (size,
transparency handling, disabled state, missing-value state) is a variation on rendering one color
value correctly.

**Independent Test**: Render `ColorSwatch` with `color="#3b82f6"` and verify it exposes an image role
with an accessible name describing the color, and that its computed background reflects the supplied
value. Delivers value standalone as a static color indicator.

**Acceptance Scenarios**:

1. **Given** a `ColorSwatch` with `color="#3b82f6"`, **When** it renders, **Then** it exposes
   `role="img"` with an accessible name of "Color swatch: #3b82f6" and its fill visually matches that
   color.
2. **Given** a `ColorSwatch` with a named CSS color (`color="blue"`) or any other valid CSS color
   syntax (`rgb(...)`, `hsl(...)`), **When** it renders, **Then** the fill matches that color and the
   accessible name includes the exact value supplied.
3. **Given** a `ColorSwatch` with a value that is not a valid CSS color, **When** it renders, **Then**
   the swatch shows no fill (transparent) rather than an incorrect color, while still exposing an
   accessible name that includes the supplied value.

---

### User Story 2 - Communicate transparency visually (Priority: P2)

A developer displays a color that includes an alpha channel (`rgba(...)`, `hsla(...)`, an 8-digit
hex, or the `transparent` keyword) — for example inside a color picker's preview swatch. The swatch
automatically shows a checkerboard pattern behind the color so the degree of transparency is visible,
the same way image editors indicate transparency.

**Why this priority**: Transparency handling is the component's second most-documented behaviour and
is the reason a consumer would reach for this component instead of a plain colored `div` — but the
plain opaque case (User Story 1) must work first.

**Independent Test**: Render `ColorSwatch` with `color="rgba(59, 130, 246, 0.5)"` and verify the
rendered element's background includes both the requested color and a repeating checkerboard pattern.
Render the same case with `withoutTransparency` set and verify the checkerboard pattern is absent while
the color is still applied. Delivers value standalone as a transparency-aware preview.

**Acceptance Scenarios**:

1. **Given** a `ColorSwatch` with an alpha-inclusive color (`rgba`, `hsla`, 8-digit hex, or
   `transparent`), **When** it renders, **Then** a checkerboard pattern is visible behind the color.
2. **Given** the same alpha-inclusive color with `withoutTransparency` set, **When** it renders,
   **Then** the checkerboard pattern is suppressed and only the flat color is applied.
3. **Given** a fully opaque color (no alpha channel), **When** it renders, **Then** no checkerboard
   pattern appears regardless of the `withoutTransparency` setting.

---

### User Story 3 - Choose a size and a disabled state that fits the layout (Priority: P3)

A developer building a color palette list or a compact form control picks a `sm`, `default`, or `lg`
size to fit the swatch into the surrounding layout, and marks a swatch `disabled` when the color it
represents is not currently selectable (e.g. an out-of-gamut option in a picker).

**Why this priority**: Sizing and the disabled state are documented, testable variants layered on top
of the core rendering behaviour (User Story 1); they matter for real-world composition but are not
the reason the component exists.

**Independent Test**: Render three `ColorSwatch` instances with `size="sm"`, `size="default"`, and
`size="lg"` and verify each renders at its distinct, documented dimension. Render a `ColorSwatch` with
`disabled` set and verify it is visually de-emphasized, non-interactive, and exposes its disabled
state to assistive technology. Each is independently verifiable and deliverable.

**Acceptance Scenarios**:

1. **Given** three `ColorSwatch` instances with `size="sm"`, `size="default"`, and `size="lg"`,
   **When** they render, **Then** each occupies a distinct, progressively larger square footprint.
2. **Given** a `ColorSwatch` with `disabled` set, **When** it renders, **Then** it is reduced in
   opacity, does not respond to pointer interaction, and exposes its disabled state through an
   ARIA/data attribute.

---

### Edge Cases

- What happens when no color value is supplied at all? The swatch MUST render a distinct
  "no color selected" visual (a diagonal destructive-colored slash on a transparent field) and expose
  an accessible name of "No color selected" rather than silently rendering an empty box.
- How does the system handle a color string with leading/trailing whitespace? It MUST be trimmed
  before validation and display, so `"  #3b82f6  "` behaves identically to `"#3b82f6"`.
- How does the system handle an empty string (`color=""`)? It MUST be treated identically to no color
  value being supplied (the "no color selected" state), since a trimmed empty string carries no color
  information.
- How does the system handle right-to-left (`dir="rtl"`) contexts? The component has no directional
  content or layout of its own (a single square swatch), so no RTL-specific behaviour is required
  beyond inheriting `dir` from the project's existing direction context, which it does automatically
  by being a plain block element with no hard-coded physical-side styling.
- How does the system handle consumers who need to render the swatch as a different underlying
  element (e.g. a `<button>` inside a color picker trigger)? The component MUST support delegating its
  rendering to a caller-supplied element via the project's existing "render as child" composition
  pattern, matching upstream's `asChild` support.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST accept a `color` prop holding any valid CSS color string (hex, hex
  with alpha, `rgb()`, `rgba()`, `hsl()`, `hsla()`, `oklch()`, `color()`, a named color, or
  `transparent`) and render a rectangular swatch filled with that color.
- **FR-002**: The component MUST accept no `color` value (`undefined` or an empty/whitespace-only
  string) and render a distinct "no color selected" visual instead of an empty or incorrectly colored
  box.
- **FR-003**: The component MUST detect when the supplied `color` string is not a value the browser
  recognises as a valid CSS color and, in that case, render a fully transparent fill rather than
  passing the invalid value through as a literal background (which would otherwise fall back to
  whatever background happens to show through).
- **FR-004**: The component MUST detect when the supplied `color` includes an alpha/transparency
  channel (`rgba()`, `hsla()`, 8-digit hex, `transparent`, or any color function using slash-alpha
  syntax) and, by default, render a repeating checkerboard pattern behind the color so the degree of
  transparency is visible.
- **FR-005**: The component MUST accept a `withoutTransparency` flag that, when set, suppresses the
  checkerboard pattern and renders only the flat color, even when that color has an alpha channel.
- **FR-006**: The component MUST accept a `size` prop with the values `"sm"`, `"default"`, and `"lg"`,
  each rendering the swatch at a distinct, progressively larger fixed square footprint, defaulting to
  `"default"` when omitted.
- **FR-007**: The component MUST accept a `disabled` prop that, when set, visually de-emphasizes the
  swatch, prevents pointer interaction with it, and exposes the disabled state through both an
  ARIA-visible attribute and a stylable data attribute.
- **FR-008**: The component MUST expose an accessible image role with an accessible name that reads
  "Color swatch: `<value>`" when a color is supplied (using the exact, trimmed value the caller
  passed) and "No color selected" when it is not.
- **FR-009**: The component MUST expose a stylable data attribute identifying it as a color swatch
  part (`data-slot="color-swatch"`), for consumers who need to target it in custom styles, matching
  the upstream data-attribute contract.
- **FR-010**: The component MUST allow the caller to delegate its rendered element to a different
  underlying element or component (the project's "render as child" composition pattern), for use
  inside triggers, buttons, or other interactive wrappers, matching upstream's `asChild` support.
- **FR-011**: The component MUST allow the caller to pass through arbitrary HTML attributes (including
  `class` and `style`) to the rendered element. Caller-supplied classes MUST be merged after the
  component's own so they win; caller-supplied inline styles MUST be emitted after the component's own
  colour/transparency declarations, so the component's declarations are always present but a caller
  declaring the same property wins (matching upstream's `{...backgroundStyle, ...style}` spread order).
- **FR-012**: The color-parsing and color-classification logic used to detect validity and
  transparency (FR-003, FR-004) MUST live in a standalone, independently importable module, separate
  from the swatch's rendering code, so that other components needing the same color-format detection
  can reuse it without duplicating the logic.
- **FR-013**: The component MUST ship installable through the project's own component registry and
  documented on a demo page that exercises every example shown on the upstream documentation page
  (default usage, sizes, and transparency handling, including the `withoutTransparency` variant).

### Key Entities

- **Color Swatch**: A single visual unit representing one CSS color value. Attributes: the color
  value itself (or absence thereof), a size variant, a disabled flag, a transparency-display flag, and
  the derived visual/accessibility state (valid color / invalid color / no color / transparent /
  opaque) computed from those inputs.
- **Color format detector**: The reusable logic (not a visible UI element) that classifies a color
  string as CSS-valid or not, and as alpha-bearing (transparent) or not. Consumed by the Color Swatch
  today and intended for reuse by the future Color Picker component.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can render a correctly colored, appropriately sized swatch for any of the
  six documented CSS color formats (hex, hex+alpha, rgb, rgba, hsl/hsla, named color) by passing a
  single prop, with no additional configuration.
- **SC-002**: 100% of the upstream documentation page's examples (default usage, three sizes,
  transparency on/off) have a corresponding, visually working section on this project's demo page.
- **SC-003**: A screen reader user hears an accurate, value-specific description of the displayed
  color (or the absence of one) for every supported input, with no generic or missing announcement.
- **SC-004**: Passing an invalid or malformed color value never results in a visually broken swatch
  (unstyled box, thrown error, or console error) — it always falls back to the defined transparent
  state.
- **SC-005**: The colour-classification logic is packaged as a standalone module with no
  component-framework dependency of its own, so it resolves and runs in a plain script context with no
  UI runtime involved, and is shipped as an installable part of this component so another component can
  declare a dependency on it rather than reimplementing it. (Non-normative note: this is what will let
  the future Color Picker component reuse the module instead of duplicating it, but that reuse is
  verified by the Color Picker's own feature, not by this one.)

## Assumptions

- **Prop naming**: The upstream documentation's "Usage" code sample shows a `value` prop, but the
  upstream source, its type definitions, and every demo file consistently use a `color` prop. This
  spec follows the source/types/demos (the enforceable contract) and treats the `value` in the
  Usage snippet as a documentation typo; the ported component's prop is named `color`.
- **RTL scope**: The component is a single, non-directional square with no internal layout, text
  flow, or icon that could mirror — so "RTL support" for this component means it must not hard-code
  any physical-side (`left`/`right`) styling that would break under `dir="rtl"`, not that it exposes
  new directional behaviour. This is weaker than a typical APG widget requirement only because the
  widget itself has no directional content, not because parity is being relaxed.
- **"No color" visual**: Upstream renders a diagonal destructive-colored slash across a transparent
  field when no color is supplied. This is preserved as-is, mapped to the project's existing
  `destructive` design token (per `CLAUDE.md` §6) rather than a raw palette color.
- **Invalid-color detection mechanism**: Upstream detects CSS-color validity via the browser's
  `CSS.supports("color", value)` API, falling back to treating the value as valid when that API is
  unavailable (non-browser rendering). This project's port preserves the same detection mechanism and
  fallback behavior, since no alternative is documented and the browser API is the industry-standard
  way to validate arbitrary CSS color strings without a bundled color-parsing library.
- **`role="img"` vs interactive role**: The component always exposes `role="img"` (a static visual),
  never a button or other interactive role of its own — interactivity (e.g. opening a picker) is the
  responsibility of a wrapping trigger via the `asChild`/"render as child" pattern (FR-010), not the
  swatch itself. This matches upstream exactly.
- **Composition over reimplementation**: Per `CLAUDE.md` §10, "render as child" is implemented using
  this project's existing snippet-based `child` pattern (as already used by other ported components
  such as `dialog-content.svelte`), not a re-implementation of Radix's `Slot`.
- **Size values are fixed, not open-ended**: The three documented sizes (`sm`, `default`, `lg`) are
  the complete set; no arbitrary numeric sizing is in scope, matching upstream exactly.
- **Additional data attributes**: Upstream documents only `[data-disabled]` and `[data-slot]`. This port
  additionally emits `data-size`, `data-transparent` (present while the checkerboard is rendered) and
  `data-empty` (present in the "no color selected" state), because the project constitution requires every
  piece of component state to be exposed as a `data-*` attribute and the background lives in an inline
  style that no CSS selector can match on. The addition is a superset: every upstream attribute is still
  present with its upstream value, so no upstream-documented selector changes meaning.
- **Destructive token syntax**: Upstream writes the "no color selected" slash as `hsl(var(--destructive))`,
  which assumes a theme where `--destructive` holds bare HSL channels. In this project `--destructive` is a
  complete `oklch()` color, so the port emits `var(--destructive)` directly — the same token, the only
  spelling that produces a valid declaration here.
- **`role="img"` in `child` mode**: the merged payload always includes `role="img"`, matching upstream's
  Radix `Slot` behaviour (per the "Composition over reimplementation" assumption above). When a caller
  delegates rendering to an *interactive* element (a `<button>` picker trigger), `role="img"` on that
  element is disallowed by ARIA, so the caller MUST spread the payload first and then set its own
  `role`/`aria-label` (last wins), exactly as Radix's `Slot` lets child props win. The component documents
  and tests this override path rather than emitting a non-interactive role on an interactive element; the
  demo page uses a non-interactive wrapper.
- **Additive public exports**: beyond the `asChild`→`child`, destructive-token and extra-data-attribute
  divergences already listed above, the port's barrel also exports `colorSwatchVariants`,
  `COLOR_SWATCH_SIZES`, `resolveColorSwatchSize`, and the `color.ts` functions
  (`normalizeColorValue`/`isCssColor`/`hasAlpha`/`getColorBackgroundStyle`), none of which upstream exports
  from `color-swatch.tsx` (only `ColorSwatch` is exported there). `getColorBackgroundStyle` additionally
  accepts a non-upstream `checkerboardSize` option. These are all additive — the upstream `ColorSwatch`
  surface (props, rendered output, accessibility contract) is unchanged; the additions exist to satisfy
  FR-012/SC-005 (a reusable, importable color module) and repo styling conventions, not to alter upstream
  behaviour.
