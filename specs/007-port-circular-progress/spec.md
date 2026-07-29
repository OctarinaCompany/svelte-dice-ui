# Feature Specification: Port Circular Progress Component

**Feature Branch**: `007-port-circular-progress`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Circular Progress\" (slug: circular-progress) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Compose a circular progress indicator (Priority: P1)

A developer building a UI in this project wants to show completion progress (e.g. a file upload, a
multi-step task, a loading state) as a ring rather than a bar. They import the Circular Progress parts
from the project's UI component alias, compose the indicator with a track and a range circle, and pass a
numeric `value` between a `min` and `max`. The ring fills proportionally and a value-text label shows the
percentage.

**Why this priority**: This is the core purpose of the component — without a working determinate ring
driven by a numeric value, there is no usable component.

**Independent Test**: Render `CircularProgress` with `value={50}` (default `min=0`, `max=100`) and verify
the range circle's stroke-dashoffset reflects 50%, `role="progressbar"` is present with
`aria-valuenow="50"`, `aria-valuemin="0"`, `aria-valuemax="100"`, and the value-text shows "50%".

**Acceptance Scenarios**:

1. **Given** a `CircularProgress` with `value={0}`, **When** it renders, **Then** the range circle shows
   no fill, `aria-valuenow="0"`, and the value text reads "0%".
2. **Given** a `CircularProgress` with `value={100}` and default `max`, **When** it renders, **Then** the
   range circle shows a full ring, `aria-valuenow="100"`, and `data-state="complete"`.
3. **Given** a `CircularProgress` with `value={25}`, `min={0}`, `max={50}`, **When** it renders, **Then**
   `aria-valuenow="25"`, `aria-valuemax="50"`, and the value text reads "50%" (the value normalized against
   the custom range).
4. **Given** a caller-supplied `getValueText` function, **When** the component renders a determinate value,
   **Then** the value-text content is produced by that function instead of the default percentage
   formatter.

---

### User Story 2 - Show an indeterminate loading state (Priority: P1)

A developer does not yet know how long an operation will take (e.g. waiting on a network response) and
renders the component without a `value` (or with `value={null}`). The ring shows a continuously animated
segment instead of a fixed fill, and assistive technology is told progress is unknown rather than being
given a misleading fixed percentage.

**Why this priority**: Indeterminate progress is a documented, first-class state of the upstream
component and is explicitly called out as the accessibility contract to preserve (no `aria-valuenow` when
indeterminate). It ships in the same release as the determinate case because both states share one
component tree.

**Independent Test**: Render `CircularProgress` with no `value` prop and verify `role="progressbar"` is
present, `aria-valuenow` is **absent**, `data-state="indeterminate"` is on the root and on the range
circle, and the range circle's `stroke-dashoffset` equals `circumference * 0.75`.

**Acceptance Scenarios**:

1. **Given** a `CircularProgress` with `value` omitted, **When** it renders, **Then** `aria-valuenow` is
   not present in the DOM and `data-state="indeterminate"`.
2. **Given** a `CircularProgress` with `value={null}`, **When** it renders, **Then** the value-text
   sub-component renders no default text (only explicit `children`, if provided).
3. **Given** a user has requested reduced motion, **When** an indeterminate `CircularProgress` renders,
   **Then** the component's own animation rule is disabled inside `@media (prefers-reduced-motion: reduce)`
   while the ring remains visually present.

---

### User Story 3 - Theme and customize per-part styling (Priority: P2)

A developer wants the ring's track, filled range, and value text to use different colors (e.g. a
success/warning/destructive palette) than the component's defaults, and wants to control the ring's `size`
and stroke `thickness`. They pass `class` overrides to `Track`, `Range`, and `ValueText`, and `size`/
`thickness` props to the root.

**Why this priority**: Theming is documented as a first-class capability upstream (dedicated "Theming"
section, plus a "Colors" example) but the component is fully usable in its default look without it, so it
follows the two states above.

**Independent Test**: Render `CircularProgress` with `size={80}` and `thickness={6}`, and a `Track`/`Range`
with custom `class` values; verify the rendered SVG's `viewBox`/`width`/`height` reflect `size`, the
`circle` elements' `stroke-width` reflects `thickness`, and the custom classes are present alongside (not
instead of) the component's own default classes.

**Acceptance Scenarios**:

1. **Given** `size={80}` and `thickness={6}` on the root, **When** the component renders, **Then** the SVG
   indicator has `width="80" height="80" viewBox="0 0 80 80"` and both `circle` elements have
   `stroke-width="6"`.
2. **Given** a custom `class` on `CircularProgressTrack` and `CircularProgressRange`, **When** the
   component renders, **Then** both the component's own default classes and the caller's classes are
   present on the respective `circle` element.
3. **Given** no children are supplied to the root, **When** the "combined" convenience form is used,
   **Then** it renders the indicator (with track and range) and the value text in one composition,
   equivalent to composing the parts manually.

---

### Edge Cases

- `value` above `max` or below `min` is clamped into range (upstream logs a dev warning and clamps; this
  project surfaces the same clamped rendering without requiring a console-dependent test).
- `max <= min` is corrected to `min + 1` so a zero/negative range never produces `NaN` geometry.
- `thickness >= size` still renders (radius floors at 0) rather than throwing.
- Using any part (`Indicator`, `Track`, `Range`, `ValueText`) outside of `Root` throws a descriptive error
  naming both the part and `Root`.
- `min === max` after correction is treated as already covered by the `max <= min` correction above; no
  separate zero-division path remains since `max` is always forced to be greater than `min`.
- Right-to-left (`dir="rtl"`) rendering: the ring's visual sweep direction and the value-text's centered
  position must remain legible; because the indicator is a rotated SVG (not a horizontally mirrored
  layout), no directional logic is required beyond what the browser already does for the surrounding
  layout — verified by rendering under `dir="rtl"` and asserting no directional prop is required from the
  caller.
- A caller supplies `children` to `CircularProgressValueText` — the explicit children take precedence over
  the computed value text.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST expose a root part that establishes shared progress state (`value`,
  `min`, `max`, `size`, `thickness`, computed `state`, `radius`, `center`, `circumference`, `percentage`,
  and value text) for its descendant parts to consume, matching the upstream context contract.
- **FR-002**: The root part MUST render with `role="progressbar"`.
- **FR-003**: When `value` is a valid number within `[min, max]`, the root MUST render `aria-valuenow`
  equal to that value, `aria-valuemin` equal to `min`, and `aria-valuemax` equal to `max`.
- **FR-003a**: When `value` is determinate, the root MUST render `aria-valuetext` equal to the computed
  value text — the default `"{rounded percentage}%"` formatter, or the string returned by a
  caller-supplied `getValueText`.
- **FR-004**: When `value` is `null`/`undefined` or a non-finite number (indeterminate), the root MUST omit
  `aria-valuenow`, `aria-valuetext` and `aria-describedby` entirely while still rendering `aria-valuemin`
  and `aria-valuemax`.
- **FR-005**: The root MUST compute and expose a `data-state` of `"indeterminate"`, `"complete"` (value
  equals `max`), or `"loading"` (any other determinate value), and set this attribute on itself, the
  indicator part, the track part, the range part **and the value-text part** — the five parts for which
  upstream documents `[data-state]`.
- **FR-005a**: The component MUST reproduce the upstream data-attribute contract: `data-value` (the clamped
  value, absent when indeterminate), `data-min` and `data-max` on the root, indicator and range parts;
  `data-percentage` (a decimal in `[0, 1]`, absent when indeterminate) on the root and indicator parts; and
  a `data-slot` of `circular-progress`, `circular-progress-indicator`, `circular-progress-track`,
  `circular-progress-range` or `circular-progress-value-text` on the corresponding part.
- **FR-006**: The component MUST default `min` to `0`, `max` to `100`, `size` to `48`, and `thickness` to
  `4` when not supplied, matching upstream defaults.
- **FR-007**: An out-of-range `value` MUST be clamped to `min` or `max` (whichever boundary was exceeded)
  before it is used for rendering or exposed via `aria-valuenow`/`data-value`.
- **FR-008**: A supplied `min` that is not a finite number MUST fall back to `0`. A supplied `max` that is
  not a finite number greater than `0` MUST fall back to the default of `100`; a supplied `max` that is not
  greater than the effective `min` MUST fall back to `min + 1`. The post-condition `max > min` MUST always
  hold.
- **FR-009**: The component MUST accept a `getValueText(value, min, max)` callback prop that, when
  provided, replaces the default `"{rounded percentage}%"` formatter for the accessible value text and the
  rendered value-text content.
- **FR-010**: The component MUST expose a value-text part whose default content is the computed value text
  (or nothing, when indeterminate) and which accepts caller-supplied `children` that take precedence over
  the computed text.
- **FR-011**: The component MUST expose an indicator part (the SVG container) sized to `size` × `size` and
  visually rotated so the progress sweep starts at the top of the ring, matching upstream's rotation
  convention.
- **FR-012**: The component MUST expose a track part (a full background ring) and a range part (the
  filled progress ring) as separate composable pieces, both centered at `size / 2` with radius
  `max(0, (size - thickness) / 2)` and stroke width `thickness`.
- **FR-013**: The range part's fill MUST be driven by `stroke-dasharray`/`stroke-dashoffset` computed from
  the circle's circumference and the current `percentage`, producing a proportional visual fill for
  determinate values and a fixed partial arc for indeterminate values.
- **FR-014**: When `state` is `"indeterminate"`, the range part MUST carry a continuous rotation animation,
  and that animation MUST be suppressed for users who have requested reduced motion, while the ring itself
  remains visible.
- **FR-015**: The component MUST provide a single "combined" composition that renders the indicator (with
  track and range) and the value text in one component, for callers who do not need to customize individual
  parts.
- **FR-016**: Every non-root part MUST throw a descriptive error identifying both itself and the root part
  when rendered outside of the root's provided context.
- **FR-017**: The root part MUST accept an optional `label` and associate it with the progressbar via the
  appropriate ARIA labelling relationship (`aria-labelledby`) when a visible label element is rendered;
  when the state is determinate (i.e. a computed value text exists), the root MUST associate it via
  `aria-describedby`, regardless of whether the `ValueText` part is actually composed by the caller.
- **FR-018**: Every part MUST accept a `class` override from the caller and merge it with the part's own
  default classes (caller classes never fully replace the built-in styling contract, both apply together).
- **FR-019**: Every part MUST accept and forward standard HTML/SVG attributes not otherwise consumed by the
  component (e.g. `id`, `data-*`, event handlers) to its rendered element.
- **FR-020**: The component MUST be usable in both determinate (numeric `value`, updated by the caller over
  time) and indeterminate (`value` omitted or `null`) modes without requiring different markup — only the
  `value` prop changes.
- **FR-021**: The component MUST render correctly when an ancestor sets `dir="rtl"`, with no additional
  prop required from the caller to preserve legibility of the ring and value text.
- **FR-022**: The component MUST be distributed as source files under the project's UI component alias
  directory with an index barrel exporting all parts (short names, prefixed aliases, and prop types), and
  MUST be installable through the project's own component registry.
- **FR-023**: A documentation page MUST exist that exercises every example shown on the upstream docs page
  for this component (the default/animated demo, the interactive start/reset/force-indeterminate demo, and
  the multi-color theming demo) plus a Combined-form section demonstrating the `Combined` convenience
  component alongside the equivalent manual composition.
- **FR-024**: The root part and the value-text part MUST each expose a composition escape hatch equivalent
  to upstream's `asChild`: a `child` snippet that receives the component's full computed attribute payload
  for the caller to spread onto its own element. In `child` mode the component renders no element of its
  own, `children` (and the root's `label` element) are not rendered, and the part's `ref` stays `null`.
  No other part accepts `child`, matching upstream, where only these two declare `asChild`.

### Key Entities

- **Progress state**: The derived classification of a single progress reading — `indeterminate`,
  `loading`, or `complete` — computed from `value` and `max`. Drives ARIA attributes, `data-state`, and the
  range part's animation.
- **Progress range**: The numeric bounds (`min`, `max`) and current `value` within them, plus the derived
  `percentage` (0–1, or absent when indeterminate) used to compute the ring's visual fill and the default
  value text.
- **Ring geometry**: The derived geometric values (`radius`, `center`, `circumference`) computed from
  `size` and `thickness`, shared by the track and range parts so they render concentric circles.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can render a working determinate circular progress ring (root + indicator +
  track + range + value text) by composing five composable parts plus a `Combined` convenience component,
  with no custom SVG or geometry math required on the consuming side.
- **SC-002**: 100% of the upstream component's documented props, parts, data attributes, and ARIA
  attributes are reproduced and covered by automated tests.
- **SC-003**: Screen reader users receive an accurate progress announcement in both determinate mode
  (a specific percentage or custom text) and indeterminate mode (no false specific value announced), 100%
  of the time, verified via ARIA attribute assertions.
- **SC-004**: The three upstream example demos (default, interactive, colors) plus a Combined-form section
  are reproduced on this project's documentation site and are visually and behaviorally equivalent (ring
  fill, indeterminate animation, per-part color theming, and the Combined/manual composition equivalence
  all function).
- **SC-005**: The component renders with no visual or accessibility regression when the page direction is
  right-to-left, verified by an automated test.
- **SC-006**: The ported component is installable as a single registry entry, identical in installation
  experience to every other first-party component already shipped in this project's registry.

## Assumptions

- **Upstream base used**: The `radix` base variant of `circular-progress` (under
  `.reference/diceui/docs/registry/bases/radix/ui/circular-progress.tsx`) is the canonical source, per the
  task's explicit path. The `base` variant under `docs/registry/bases/base/ui/circular-progress.tsx` exists
  upstream too but is out of scope; both are behaviorally near-identical (the `base` variant differs mainly
  in its `asChild`/Slot implementation), so this decision does not lose functionality.
- **`asChild` / Slot polymorphism**: Upstream's `asChild` prop (backed by Radix's `Slot` primitive) is
  translated to this project's existing `child` snippet pattern (see `CLAUDE.md` §10 translation table:
  `asChild`/`Slot` → a `child` snippet), preserving the same polymorphic-render capability without a
  React-specific primitive.
- **`useId()`**: Upstream generates a `labelId` and a `valueTextId` via React's `useId()`. This is ported
  using Svelte's `$props.id()` (or the project's existing `useId` helper from `bits-ui`, per CLAUDE.md
  §10), preserving unique, SSR-safe IDs for the `aria-labelledby`/`aria-describedby` relationships.
- **Dev-only console warnings**: Upstream's `console.error`/`console.warn` calls for invalid `max`/`value`
  props (gated on `process.env.NODE_ENV !== "production"`) are a development-time debugging aid, not a
  user-facing behavior. They are preserved as a `dev`-guarded warning (Vite's `import.meta.env.DEV`) but are
  **not** part of the automated test surface — clamping behavior (the actual user-visible effect) is what
  is tested, per Edge Cases above.
- **Animation delivery**: Upstream ships the indeterminate spin animation as a `@theme`/`@keyframes` block
  the consumer must manually add to their global CSS. Per CLAUDE.md §6 (no changes to the Tailwind theme or
  global CSS is out of scope for this task, and every other port composes existing tokens), this port
  instead defines the equivalent keyframes as a scoped, component-local animation (not a global theme
  addition), so the component works out of the box without requiring a manual global CSS edit — matching
  the project's existing precedent of not requiring consumers to hand-edit `app.css` per component.
- **RTL behavior**: Because the indicator is an SVG rotated with a CSS transform (not a flex/grid layout
  with logical properties), the ring's sweep direction is not direction-dependent in the upstream
  implementation. This port preserves that behavior as-is (no `dir`-conditional transform) — matching
  upstream parity rather than inventing new RTL-specific mirroring that upstream does not have.
- **Combined convenience component**: Upstream's `CircularProgressCombined` is ported as an additional
  named export in the same barrel (not a separate top-level component family), since it is a fixed
  composition of the other parts with no independent state.
- **Motion-reduce handling**: Implemented via the standard `motion-reduce:`/`motion-safe:` Tailwind
  variants already used upstream, which this project's Tailwind v4 setup supports without configuration
  changes.
- **Indeterminate animation is not a class**: because the animation ships as a component-scoped `<style>`
  rule keyed on `[data-state='indeterminate']` (see "Animation delivery" above), there is no
  `animate-*`/`motion-reduce:*` utility class on the range element. The observable contract asserted in
  tests is `data-state="indeterminate"` plus `stroke-dashoffset === circumference * 0.75`, which is also
  the hook consumers style against.
