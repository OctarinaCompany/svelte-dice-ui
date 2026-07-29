# Feature Specification: Port the Gauge component

**Feature Branch**: `008-port-gauge`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Gauge\" (slug: gauge) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Compose a labeled gauge from its parts (Priority: P1)

A developer building a dashboard imports the gauge parts and composes a track, a filled range, a
value readout and a label to show a single metric (e.g. "CPU usage: 45%") on a circular arc.

**Why this priority**: This is the primary, documented way to use the component (the "Layout"
section of the upstream docs) and every other example builds on it. Without it there is no usable
component.

**Independent Test**: Render `<Gauge>` with a numeric `value` and its `Indicator` > `Track`/`Range`
children plus a `ValueText` and a `Label`, and confirm the arc fill, the displayed value text and the
visible label all match the given value/min/max.

**Acceptance Scenarios**:

1. **Given** a gauge with `value={45}`, `min={0}`, `max={100}` and default angles, **When** it
   renders, **Then** the range arc is filled to 45% of the arc length, the value text reads "45",
   and the element exposes `role="meter"` with `aria-valuenow="45"`, `aria-valuemin="0"`,
   `aria-valuemax="100"`.
2. **Given** a `<Gauge.Label>` child, **When** the gauge renders, **Then** the root's
   `aria-labelledby` points at the label's id and the label is visually placed below the arc.
3. **Given** no `value` prop (or `value={null}`), **When** the gauge renders, **Then** it is in the
   `indeterminate` state (`data-state="indeterminate"`), `aria-valuenow` is omitted, and no
   `aria-describedby` is set because there is no value text.

---

### User Story 2 - Customize size, thickness, angles and the value's text (Priority: P2)

A developer adapts the gauge to different contexts: a small compact gauge in a table cell, a large
one on a summary card, a semi-circle or three-quarter-circle dial instead of a full circle, and a
custom value formatter (percentage sign, fraction, or an arbitrary unit).

**Why this priority**: Documented as the "Sizes" and "Variants" examples upstream; this is the
second most common integration need after the basic composition and is required for dashboard/KPI
use cases explicitly called out in the component's description.

**Independent Test**: Render several gauges with different `size`, `thickness`, `startAngle`,
`endAngle` and `getValueText` props side by side and confirm each renders its own arc geometry,
stroke width and formatted text independently of the others.

**Acceptance Scenarios**:

1. **Given** `size={180}` and `thickness={12}`, **When** the gauge renders, **Then** its SVG
   viewBox/width/height are `180` and the track/range stroke width is `12`.
2. **Given** `startAngle={-90}` and `endAngle={90}` (a semi-circle), **When** the gauge renders,
   **Then** the track and range arc paths span exactly that 180° sweep and the value text is
   vertically centered on the visual bounds of that arc, not the full circle's geometric center.
3. **Given** `startAngle={0}` and `endAngle={360}` (a full circle), **When** the gauge renders,
   **Then** the arc path is drawn as two joined semicircles so the SVG renders a closed ring.
4. **Given** a custom `getValueText={(value, min, max) => \`${value}/${max}\`}`, **When**
   `value={75}` and `max={100}`, **Then** the value text reads "75/100" instead of the default
   rounded-percentage text.

---

### User Story 3 - Theme track/range/text/label independently and animate value changes (Priority: P3)

A developer applies status colors (e.g. green for healthy, amber for warning, red for critical) to
different gauge instances and updates `value` over time (e.g. polling a metric), relying on the
range arc to animate smoothly to its new length.

**Why this priority**: Documented as the "Colors" example and the theming/animation notes upstream;
important for real dashboards but not required for the component to be minimally usable.

**Independent Test**: Render a gauge, change its `value` prop, and confirm the range arc's fill
transitions rather than jumping, and that overriding each part's `class` changes only that part's
color via `currentColor`.

**Acceptance Scenarios**:

1. **Given** a mounted gauge with `value={20}`, **When** `value` changes to `value={80}`, **Then**
   the range arc's stroke-dashoffset transitions over time rather than updating instantly.
2. **Given** a custom `class` on `Gauge.Track`, `Gauge.Range`, `Gauge.ValueText` and `Gauge.Label`,
   **When** the gauge renders, **Then** each part's color reflects only its own override and the
   others are unaffected.

---

### Edge Cases

- `value` outside `[min, max]` MUST be clamped to `min` or `max` for rendering purposes rather than
  rejected; the reachable state stays "loading" or "complete" accordingly.
- A non-finite or non-positive `max` MUST fall back to the default maximum of `100`, and a resolved
  `max <= min` MUST be corrected to `min + 1`, matching the behaviour already established for the
  ported Circular Progress component.
- `startAngle`/`endAngle` describing a sweep of `0°` (start equals end) MUST still render a
  degenerate (effectively invisible) arc without throwing.
- A sweep whose absolute difference is `>= 360°` MUST render as a full closed ring (two joined
  semicircle path segments), matching the upstream `describeArc` full-circle branch.
- `thickness >= size` is an unsupported but non-fatal configuration; the component still renders
  (radius floors at `0`) and a developer-only warning is logged, matching the Circular Progress
  precedent.
- Rendering any non-root part (`Gauge.Indicator`, `Gauge.Track`, `Gauge.Range`, `Gauge.ValueText`,
  `Gauge.Label`) outside a `Gauge.Root` MUST throw a descriptive error naming both the part and the
  required root.
- In a right-to-left document, the gauge's arc geometry (defined in absolute angle degrees measured
  clockwise from 12 o'clock) and its value-fill direction MUST NOT mirror, matching upstream (angles
  are not a directional/logical property); only the label/value-text's text alignment follows the
  ambient `dir`.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The gauge root MUST accept a `value` that is a number, `null`, or `undefined`; `null`/
  `undefined` MUST produce the `indeterminate` state.
- **FR-002**: The gauge root MUST accept `min` (default `0`) and `max` (default `100`) bounds, clamp
  an out-of-range `value` into `[min, max]`, and derive `state` as `indeterminate` (no value),
  `complete` (`value === max`), or `loading` (otherwise).
- **FR-003**: The gauge root MUST accept `size` (default `120`, pixels) and `thickness` (default `8`,
  pixels) and derive the SVG's radius as `max(0, (size - thickness) / 2)` and center as `size / 2`.
- **FR-004**: The gauge root MUST accept `startAngle` (default `0`) and `endAngle` (default `360`),
  both measured in degrees clockwise from the 12 o'clock position, and use them to compute the arc
  path shared by the track and the range.
- **FR-005**: The gauge root MUST accept a `getValueText(value, min, max)` formatter (default:
  rounded percentage of `value` within `[min, max]` as a bare number string, e.g. `"45"`) and expose
  its result as both the accessible value text and the default rendered content of `Gauge.ValueText`.
- **FR-006**: The gauge root MUST expose `role="meter"` with `aria-valuemin`, `aria-valuemax`, and,
  only when a value is present, `aria-valuenow` and `aria-valuetext`; it MUST expose
  `aria-labelledby` when a `Gauge.Label` part is rendered, and `aria-describedby` when a value text
  is present.
- **FR-007**: The gauge root MUST expose `data-state`, `data-value` (omitted when indeterminate),
  `data-max`, `data-min`, and `data-percentage` (omitted when indeterminate; a decimal in `[0, 1]`
  otherwise) as data attributes on the root, mirrored on `Gauge.Indicator` and `Gauge.Range` as
  documented, and `data-state` alone on `Gauge.Track`, `Gauge.ValueText`, and `Gauge.Label`.
- **FR-008**: `Gauge.Indicator` MUST render an `svg` sized to `size × size` with a `viewBox` of
  `0 0 size size`, hidden from assistive technology (`aria-hidden`), containing the track and range.
- **FR-009**: `Gauge.Track` MUST render the full arc (from `startAngle` to `endAngle`) as a static,
  unfilled stroke path using `currentColor`, with a muted default color.
- **FR-010**: `Gauge.Range` MUST render the same arc path as the track, filled proportionally to the
  current percentage via a dash-array/dash-offset technique, animate stroke-dashoffset changes over
  time (except while indeterminate, where the offset stays `0`), and use `currentColor` with a
  primary-toned default color.
- **FR-011**: `Gauge.ValueText` MUST render, by default, the formatted value text, vertically
  positioned at the visual center of the arc's bounding box (not the geometric circle center for
  partial arcs), and MUST accept custom children to override the displayed content. Its `id` MUST
  always be emitted, even when custom children are supplied or the gauge is indeterminate; the root's
  `aria-describedby` follows the computed value text per FR-006 (present only when a value text
  exists), independent of whether custom children are also rendered.
- **FR-012**: `Gauge.Label` MUST render optional descriptive text below the gauge and MUST be linkable
  from the root via `aria-labelledby` when present.
- **FR-013**: A combined entry point MUST exist that renders `Root > Indicator > Track + Range` plus
  `ValueText` in one component, accepting the same props as the root, for consumers who do not need
  to customize individual parts.
- **FR-014**: Every part except the root MUST throw a descriptive error identifying itself and the
  required root when rendered outside a `Gauge.Root`.
- **FR-015**: Every part MUST accept a `class` prop that is merged with (and can override) the part's
  default styling, and MUST forward unrecognized attributes to its rendered element.
- **FR-016**: The root and `Gauge.ValueText` and `Gauge.Label` MUST each support rendering onto a
  caller-supplied element via a `child` snippet, in place of upstream's `asChild`/`Slot`.
- **FR-017**: The component MUST ship as source under the project's UI component directory with an
  index barrel exporting every part (short names, prefixed aliases, and prop types), and MUST be
  registered as an installable entry in the project's component registry.
- **FR-018**: A documentation page MUST demonstrate every example shown on the upstream docs page:
  the default layout, multiple sizes, multiple color themes, and multiple arc variants (semi-circle,
  three-quarter circle, full circle).
- **FR-019**: The arc-geometry math (radius/center derivation) MUST reuse the helper already exported
  for the Circular Progress component rather than re-deriving it; the additional angle-to-path
  computation this component needs (translating `startAngle`/`endAngle` into an SVG arc `d` string,
  including the full-circle two-semicircle case, and locating the arc's visual vertical center) MUST
  be added as reusable, unit-testable functions rather than inlined in a component file.
- **FR-020**: In development builds only, the gauge root MUST log a diagnostic and fall back safely
  when given an invalid `max` (non-finite or `<= 0` → console error, default `100` used), an invalid
  `value` (finite but outside `[min, max]` → console error, value clamped), or `thickness >= size`
  (console warning, still renders). Production builds MUST emit nothing. These diagnostics MUST NOT
  alter the rendered output beyond the documented fallbacks.
- **FR-021**: The gauge MUST be a read-only, non-interactive display widget: no part may be focusable
  (no `tabindex` on the root or any part, `focusable="false"` on the indicator `svg`), no part may
  handle keyboard input, and no key press may change any exposed value, ARIA attribute or data
  attribute. Keyboard focus MUST pass over the gauge to the next focusable element in document order.

### Key Entities

- **Gauge state**: The derived, read-only reactive model shared by all parts of one gauge instance —
  clamped `value`, resolved `min`/`max`, `state` (`indeterminate`/`loading`/`complete`), `percentage`,
  formatted `valueText`, arc geometry (`radius`, `center`, `size`, `thickness`, `startAngle`,
  `endAngle`, `arcLength`, the arc's visual vertical center), and the ids used to wire
  `aria-labelledby`/`aria-describedby`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can render a fully labeled, accessible gauge showing a metric by composing
  no more than six documented parts (or one combined part), with zero additional markup required for
  correct ARIA wiring.
- **SC-002**: 100% of the upstream documentation's examples (default layout, sizes, colors, variants)
  have an equivalent, visually verifiable demo section in this project's docs site.
- **SC-003**: 100% of the upstream component's documented props, data attributes, and ARIA attributes
  are reproduced and covered by automated tests.
- **SC-004**: Changing a gauge's `value` at runtime visibly animates the filled arc to its new
  position without a full re-render flash, matching the upstream transition behaviour.
- **SC-005**: The component passes every project quality gate (formatting, type-checking, linting,
  unit tests, production build) with no suppressed checks.

## Assumptions _(mandatory)_

- Only the Radix-based upstream variant (`docs/registry/bases/radix/ui/gauge.tsx`) is ported, matching
  the project's established `circular-progress` precedent (also ported from the `radix` base rather
  than the plain `base` variant); the `base` (non-Radix) variant under
  `.reference/diceui/docs/registry/bases/base/ui/gauge.tsx` is not separately ported since both bases
  expose the same `GaugeProps` API and this repo does not ship a Radix-flavoured/Base-flavoured split.
- Upstream's `asChild` (Radix `Slot`) on the root, `GaugeValueText`, and `GaugeLabel` has no Svelte
  equivalent and is replaced by an optional `child` snippet, matching the pattern already used by
  `circular-progress` and other ported parts in this repo.
- Upstream renders the arc-geometry radius/center from `size`/`thickness` using the same formula
  already implemented and exported as `getRingGeometry` for `circular-progress`; this port imports
  and reuses that helper instead of re-deriving `radius`/`center`. The angle-sweep-to-SVG-path math
  (`describeArc`/`polarToCartesian`, the full-circle two-semicircle special case, and the arc's
  visual-center-Y calculation for `GaugeValueText` positioning) does not exist yet anywhere in this
  repo — because `circular-progress` is always a full ring drawn with a plain `<circle>` and never
  needed an arc path — so this port adds those functions, colocated with the existing ring-geometry
  helper so future arc-shaped components can reuse them the same way this port reuses
  `getRingGeometry`.
- The upstream MDX's `GaugeCombined label="Performance"` usage example is inconsistent with the
  documented `GaugeProps` type (which has no `label` field) and with the component's own source
  (`GaugeCombined` spreads only `GaugeProps` into `Gauge`, and `Gauge` does not accept `label`). This
  is treated as a documentation error upstream; the combined part in this port accepts the same props
  as the root (no `label` shortcut) and a caller wanting a label composes `Gauge.Label` alongside it,
  the same way the "Layout" code sample and every demo file in this repository's reference actually do
  it.
- `getValueText`'s upstream default returns a bare rounded-percentage string (e.g. `"45"`, no `%`
  suffix) per the source (`getDefaultValueText`); this is reproduced verbatim even though the MDX
  prose describes it loosely as "displays the percentage value."
- Development-only console diagnostics for an invalid `max`, an invalid `value`, and
  `thickness >= size` are reproduced behind the project's existing dev-only guard convention
  (matching `circular-progress`'s `import.meta.env.DEV` checks), since they are documented upstream
  behaviour (Notes section) but are not part of the accessible/visual contract.
- Upstream angles are absolute geometry (clockwise degrees from 12 o'clock) with no built-in RTL
  mirroring in the reference implementation; per this project's i18n parity requirement this is
  followed as-is (angles do not flip under `dir="rtl"`), since flipping them would be a behavioural
  addition not present upstream and the component has no independent "logical direction" concept to
  map angles onto (unlike e.g. a horizontal slider).
- The four documented example files (`gauge-demo`, `gauge-sizes-demo`, `gauge-colors-demo`,
  `gauge-variants-demo`) drive the docs page section-for-section; the upstream demos' use of the
  `motion/react` animation library and `useInView`/`useSpring` for entrance/counting animation is
  reproduced using this project's existing Svelte 5 rune-based approach (plain reactive state driving
  the value prop over time via `setTimeout`/`setInterval`, matching how other ported components with
  animated demos already do this in this repo) rather than pulling in a new animation dependency,
  since the animation is a demo-only embellishment and not part of the component's documented API.
- Status/theme colors used in the "Colors" example (emerald/amber/red/sky in the upstream demo) are
  adapted to this project's semantic tokens per `CLAUDE.md` §6 (`success`/`warning`/`destructive`/
  `info`) rather than copied as raw Tailwind palette classes.
