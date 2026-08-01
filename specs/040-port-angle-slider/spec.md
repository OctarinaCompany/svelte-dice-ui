# Feature Specification: Port Angle Slider

**Feature Branch**: `040-port-angle-slider`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Angle Slider\" (slug: angle-slider) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Pick a single angle with pointer or keyboard (Priority: P1)

A person building a form needs to let their users choose a rotation, direction, or orientation value
(for example, "rotate this image 45°" or "set the wind direction"). They drop the Angle Slider
component into their page, optionally seed it with a starting angle, and their users can either drag
the round thumb around the circular track or focus it and use the keyboard to change the value. The
current value is shown as readable text next to the dial.

**Why this priority**: This is the entire reason the component exists — a single controllable angle
value with a circular, intuitive interaction model that a straight-line slider cannot express. Without
this, there is no component.

**Independent Test**: Render the component with a `defaultValue`, drag the thumb to a new pointer
position, and confirm the displayed value and the value passed to the parent both update to the value
implied by the pointer's angle from the dial's centre. Can be fully tested without any other user
story.

**Acceptance Scenarios**:

1. **Given** an Angle Slider with `defaultValue={[0]}`, `min={0}`, `max={360}` and the default
   `startAngle` (which puts the minimum at 12 o'clock and sweeps clockwise), **When** the user drags
   the thumb to the pointer position directly above centre, **Then** the displayed value and emitted
   value are `0°`; **When** the user drags directly right of centre, **Then** the value reads `90°`
   (or the value nearest to it allowed by `step`).
2. **Given** the same slider, **When** the user drags the thumb to the pointer position directly below
   centre, **Then** the value reads `180°`; **When** the user drags directly left of centre, **Then**
   the value reads `270°`.
3. **Given** the same slider, **When** the user drags the pointer across the seam where the dial wraps
   from its highest angle back to its lowest (e.g. from just under 360° to just over 0°), **Then** the
   value changes smoothly to the nearest allowed angle on the other side of the seam, with no jump to
   an unrelated value.
4. **Given** a focused thumb, **When** the user presses `ArrowRight` or `ArrowUp`, **Then** the value
   increases by one `step`; **When** the user presses `ArrowLeft` or `ArrowDown`, **Then** the value
   decreases by one `step`.
5. **Given** a focused thumb, **When** the user presses `PageUp`, **Then** the value increases by ten
   steps; **When** the user presses `PageDown`, **Then** the value decreases by ten steps; **When**
   the user holds `Shift` while pressing any arrow key, **Then** the value changes by ten steps in that
   arrow's direction.
6. **Given** a focused thumb, **When** the user presses `Home`, **Then** the value is set to the
   configured minimum; **When** the user presses `End`, **Then** the value is set to the configured
   maximum.
7. **Given** a slider used inside a `<form>`, **When** the form is submitted, **Then** the current
   angle value is included in the submitted form data under the slider's `name`.

---

### User Story 2 - Select an angular range with two thumbs (Priority: P2)

A person needs to express a span of angles rather than a single point (for example, "highlight the arc
between 90° and 270°" or "the acceptable tolerance is ±15° around a target"). They render the slider
with two starting values, and the visible arc between the two thumbs fills in to show the selected
range. Both thumbs are independently draggable and keyboard-navigable, and the component prevents the
thumbs from crossing closer than a configured minimum separation.

**Why this priority**: Range selection is a documented, first-class mode of the upstream component and
is exercised by its own upstream example, but a consumer can ship a fully working single-value angle
picker (P1) before this mode is needed.

**Independent Test**: Render the component with two values, drag one thumb toward the other, and
confirm it stops at the configured minimum step separation instead of crossing or landing closer than
allowed; confirm the filled arc always spans exactly between the two current values.

**Acceptance Scenarios**:

1. **Given** an Angle Slider with `defaultValue={[90, 270]}`, **Then** two independently focusable
   thumbs are rendered and the arc between them is visually filled.
2. **Given** the same slider with `minStepsBetweenThumbs={2}` and `step={5}`, **When** the user drags
   one thumb toward the other, **Then** the drag stops once the two values are exactly 10° apart and
   does not allow them to cross.
3. **Given** the two-thumb slider, **When** the user tabs to the second thumb and presses `ArrowRight`,
   **Then** only the second thumb's value changes; the first thumb's value is unaffected.
4. **Given** the two-thumb slider used inside a `<form>`, **When** the form is submitted, **Then**
   both values are included in the submitted form data under the same field name, in array form.

---

### User Story 3 - Configure the dial's geometry, direction, and read-only/disabled states (Priority: P3)

A person needs the dial to fit their design and their app's semantics: a smaller or larger dial, a
partial arc instead of a full circle, a value that increases in the opposite rotational direction, a
right-to-left page layout, or a slider that is temporarily locked (read-only) or fully non-interactive
(disabled).

**Why this priority**: These are documented configuration knobs and states, not a distinct interaction
model — they refine how User Stories 1 and 2 render and respond, so they are valuable but not
blocking for an initial usable component.

**Independent Test**: Render the component with `startAngle`/`endAngle` narrower than a full circle and
confirm the track only draws that arc; render with `inverted` and confirm arrow-key direction flips;
render with `dir="rtl"` and confirm the left/right arrow keys swap meaning; render with `disabled` and
`readOnly` and confirm pointer and keyboard interaction is suppressed in each case as documented below.

**Acceptance Scenarios**:

1. **Given** `startAngle={-90}` and `endAngle={90}`, **Then** the visible track only draws the half
   circle between those two angles, not a full circle.
2. **Given** `inverted`, **When** the user presses `ArrowRight`, **Then** the value decreases instead
   of increasing.
3. **Given** `dir="rtl"`, **When** the user presses `ArrowRight`, **Then** the value decreases (the
   same effective direction as `ArrowLeft` in `dir="ltr"`); `ArrowUp`/`ArrowDown` are unaffected by
   direction.
4. **Given** `disabled`, **When** the user attempts to drag the thumb or focus and press an arrow key,
   **Then** the value does not change, the thumb is not part of the tab order, and the hidden form
   input is disabled so it is excluded from form submission.
5. **Given** `readOnly`, **When** the user attempts to drag the thumb or press an arrow key, **Then**
   the value does not change, but the thumb remains focusable and the hidden form input still
   participates in form submission with its current value.

---

### Edge Cases

- Dragging the pointer to the exact centre of the dial (where angle is mathematically undefined):
  the last valid angle is retained; the pointer offset is never divided in a way that produces `NaN`
  or `Infinity` in the emitted value.
- `min`/`max`/`step` combinations where the maximum is not an exact multiple of `step` from the
  minimum: values still snap to the nearest step and stay clamped within `[min, max]`.
- A `step` with decimal places (e.g. `0.5`): displayed and emitted values are rounded to the same
  number of decimal places as `step`, avoiding floating-point artifacts like `44.999999999999993`.
- Two thumbs given identical initial values with `minStepsBetweenThumbs > 0`: the component still
  renders both thumbs; the first drag or key press that would violate the minimum separation is
  rejected rather than crashing.
- `startAngle`/`endAngle` describing a full 360° sweep (`endAngle - startAngle >= 359`, in either
  order): the track renders as a continuous circle instead of an arc with visible endpoints.
- The pointer leaves the slider's bounding box mid-drag: the drag continues to track the pointer
  (pointer capture) and the value keeps updating from the pointer's angle relative to the dial centre
  until the pointer is released.
- `value` (controlled) is supplied without `onValueChange`: dragging or pressing keys does not move
  the thumb, matching standard controlled-component behaviour elsewhere in this design system.
- The component is used with only one thumb rendered for a two-value array, or more thumbs than
  values: only thumbs with a defined value at their index render; extra thumb elements render nothing.
- The page is scrolled or the dial is resized between renders: angle-to-position and pointer-to-angle
  math is re-derived from the dial's live bounding box on every pointer event, never cached across
  renders.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST render a circular (or partial-arc) dial with one or more draggable
  thumbs, each thumb representing one numeric value in an ordered `value`/`defaultValue` array.
- **FR-002**: The component MUST support both controlled (`value` + `onValueChange`) and uncontrolled
  (`defaultValue`) usage, consistent with every other value-bearing component already ported in this
  project.
- **FR-003**: The component MUST derive the angle for a pointer interaction from the pointer's
  position relative to the dial's own centre, using an arctangent of the pointer's vertical and
  horizontal offset from that centre, then convert that angle into a value within `[min, max]`.
- **FR-004**: The component MUST snap every value — whether produced by pointer drag or keyboard
  interaction — to the nearest multiple of `step` from `min`, and MUST clamp the result to
  `[min, max]`.
- **FR-005**: The component MUST support `min`, `max`, and `step`, each with the same defaults as
  upstream (`min = 0`, `max = 100`, `step = 1`).
- **FR-006**: When two or more thumbs are present, the component MUST keep the underlying values
  sorted ascending regardless of which thumb was moved, and MUST enforce `minStepsBetweenThumbs`
  (in units of `step`) so that no drag or key press is allowed to bring two thumbs closer together
  than that minimum, or to cross them.
- **FR-007**: The component MUST support `startAngle` and `endAngle` (defaults `-90` and `270`,
  i.e. a full circle starting at the top) to describe a full or partial arc, and MUST render the
  track, the filled range, and thumb positions consistently with that arc.
- **FR-008**: The component MUST support `size` (dial radius) and `thickness` (track stroke width)
  props that scale the rendered dial, with the same defaults as upstream (`size = 60`,
  `thickness = 8`).
- **FR-009**: The component MUST support an `inverted` prop that reverses the mapping from value to
  angular position, and correspondingly reverses which arrow-key direction increases the value.
- **FR-010**: The component MUST respond to `ArrowUp`/`ArrowRight` (increase by one step),
  `ArrowDown`/`ArrowLeft` (decrease by one step), `PageUp` (increase by ten steps), `PageDown`
  (decrease by ten steps), `Shift` + any arrow key (ten steps in that arrow's direction), `Home`
  (jump the active thumb to `min`), and `End` (jump the active thumb to `max`), matching the upstream
  keyboard table exactly.
- **FR-011**: Under a right-to-left layout, the component MUST invert the meaning of `ArrowLeft` and
  `ArrowRight` (so that the visually "increase" direction stays consistent with the rendered dial),
  while `ArrowUp`/`ArrowDown` keep their meaning. The component MUST resolve its layout direction from
  this project's existing direction context when the consumer does not explicitly pass one, and MUST
  allow a `dir` prop to override that inherited direction, matching upstream.
- **FR-012**: The component MUST support a `disabled` state (default `off`) in which pointer dragging,
  keyboard interaction, and focus via `Tab` are all suppressed, the dial is visually indicated as
  disabled, and any hidden form input the component renders is excluded from form submission.
- **FR-013**: The component MUST support a `readOnly` state (default `off`) in which pointer dragging
  and keyboard value changes are suppressed, but the thumb remains focusable and its current value
  continues to participate in form submission. This state is not present in the upstream React
  component; see Assumptions for why it is added here.
- **FR-014**: The component MUST expose a value-commit callback that fires once per discrete
  interaction (once per completed drag, once per key press that changes the value) — not on every
  intermediate pointer-move — mirroring upstream's separate "value changed" vs. "value committed"
  callbacks.
- **FR-015**: The component MUST render its current value(s) as accessible, readable text, using a
  `°` unit suffix by default, and MUST accept a custom formatting function so a consumer can override
  how the value is displayed (e.g. a different unit or precision).
- **FR-016**: The component MUST render a visually hidden native input per thumb when used inside a
  `<form>` (or when an explicit `form` prop is given), carrying the thumb's current numeric value so
  the value participates in native form submission and validation, named after the component's `name`
  prop (with an array-style suffix when more than one thumb is present), without requiring the
  consumer to install or reference any additional package for this behaviour.
- **FR-017**: Each interactive thumb MUST expose the ARIA `slider` role with accurate
  `aria-valuemin`, `aria-valuenow`, `aria-valuemax`, and `aria-orientation="vertical"` (matching
  upstream), and MUST be reachable via `Tab` in document order (except while `disabled`).
- **FR-018**: The component MUST expose the same data-state styling hooks as upstream (a
  slider-level disabled indicator, and per-part slot identifiers) so consumers can target internal
  parts with CSS, and MUST additionally expose a read-only indicator for the state added in FR-013.
- **FR-019**: The component MUST be installable and documented exactly like every other component in
  this project's registry: source under the project's UI alias directory with an index barrel,
  registered in `registry.json`, and demonstrated on a docs route that exercises every example shown
  on the upstream documentation page (default single value, controlled with imperative actions,
  two-thumb range, multiple visual themes, and form integration).
- **FR-020**: The component's pointer-driven value updates MUST NOT feed back into the same
  measurement the pointer offset is computed from within a single reactive update — i.e. reading the
  dial's bounding box and writing the value that could change that bounding box's on-screen thumb
  position must not happen inside the same effect such that the write re-triggers the read.

### Key Entities

- **Angle Slider value set**: An ordered array of one or more numeric angle values (in the caller's
  chosen unit, semantically degrees), each bounded by `min` and `max` and aligned to `step`. A single
  entry represents one selectable angle; two or more entries represent an angular range or a set of
  independently draggable points, kept sorted ascending.
- **Dial geometry**: The visual description of the circular control — its centre, radius (`size`),
  stroke thickness (`thickness`), and the start/end angles (`startAngle`/`endAngle`) bounding the arc
  that values are mapped onto. Distinct from the value set; geometry determines how a value is drawn
  and how a pointer position is read back into a value.
- **Active thumb**: The single thumb, among possibly several, currently targeted by an in-progress
  drag or by keyboard focus. Interaction (pointer or key) always affects exactly this thumb's entry in
  the value set.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can add a working single-value angle picker to a page by composing five
  documented parts, with no additional configuration required beyond optional `min`/`max`/`step`.
- **SC-002**: Dragging the pointer anywhere around the dial, including across the seam where the
  dial's highest and lowest angles meet, always produces a value that is within one `step` of the
  angle mathematically implied by the pointer's position relative to the dial's centre — verified
  across all four quadrants and the seam.
- **SC-003**: Every keyboard interaction documented upstream (arrow keys, `Shift`+arrow, `Page`
  keys, `Home`, `End`) produces the exact documented value change, in both left-to-right and
  right-to-left layouts, with correct inversion under RTL.
- **SC-004**: A slider embedded in a native or library-driven form submits the exact current value(s)
  under the correct field name, with no manual synchronisation code required from the consumer, and
  its hidden input(s) reflect the submitted value(s) exactly, including for a two-thumb range.
- **SC-005**: A screen-reader user can determine each thumb's role, current value, minimum, and
  maximum without sighted assistance, and can operate the slider entirely from the keyboard.
- **SC-006**: The documentation page for this component renders every example shown on the upstream
  documentation page (default, controlled, range, themed variants, form integration) without visual
  or behavioural regressions from the upstream demos.
- **SC-007**: Setting `disabled` or `readOnly` visibly and functionally suppresses interaction as
  specified in FR-012/FR-013, verified by automated tests, with zero possibility of a value change
  slipping through either pointer or keyboard paths.

## Assumptions

- **`readOnly` prop added, no upstream equivalent**: The upstream React `angle-slider.tsx` has no
  `readOnly` prop — only `disabled`. The task guidance for this port explicitly requires a read-only
  state (thumb stays focusable and still submits with the form, but cannot be changed), which matches
  the WAI-ARIA Authoring Practices slider pattern's distinction between `aria-disabled` and
  `aria-readonly`. This is a deliberate, additive divergence from upstream: it introduces a new prop
  rather than renaming or removing an existing one, so it does not break upstream API parity for any
  prop that does exist upstream.
- **`asChild`/`Slot` polymorphism dropped**: Upstream's `AngleSlider`, `AngleSliderThumb`, and
  `AngleSliderValue` accept `asChild` to swap their rendered element via Radix's `Slot` primitive.
  Svelte has no direct equivalent to `React.Children`-based slot merging; per this project's existing
  convention (`CLAUDE.md` §10, `dialog-content.svelte`), any part that upstream makes polymorphic via
  `asChild` is exposed here as a `child` snippet instead, preserving the same practical capability
  (rendering a different underlying element) without reimplementing `Slot`.
- **Global store + `useSyncExternalStore` → a state class in `.svelte.ts`**: Upstream implements
  cross-part communication with a hand-rolled pub/sub store consumed through
  `React.useSyncExternalStore`, because React has no first-class fine-grained reactivity primitive.
  This is a React-only implementation detail, not an observable part of the documented API; it is
  ported as a single reactive state class (per this project's `.svelte.ts` convention) shared through
  Svelte context, which is Svelte's direct equivalent of "a store several components read and write."
- **`useComposedRefs`/`useIsomorphicLayoutEffect`/`useLazyRef` dropped**: These are upstream React
  ref/effect-timing utility hooks with no observable effect on the documented component API. Their
  Svelte equivalents are native language features already used throughout this project
  (`ref = $bindable(null)` + `bind:this`, and plain `$effect`/`$effect.pre`), so no direct port of
  these utility hooks is needed.
- **`VisuallyHiddenInput` ported as an internal part, not a shared dependency**: Per the task
  guidance, the hidden-input behaviour upstream imports from
  `components/visually-hidden-input.tsx` is folded directly into this component's thumb part rather
  than added as a separate shared component or an external dependency, since this is the only ported
  component that currently needs it.
- **Direction (`dir`) resolution**: Upstream resolves `dir` through Radix's `Direction` primitive
  (`DirectionPrimitive.useDirection`), falling back to a document-level direction provider when no
  explicit `dir` prop is given. This project's equivalent is `bits-ui`'s direction context (already
  the project's chosen headless primitive library for this kind of cross-cutting concern); this port
  composes that existing context instead of re-implementing a direction provider, with an explicit
  `dir` prop able to override it, matching upstream's override behaviour.
- **RTL inverts the horizontal arrow keys; upstream does not**: upstream's `onKeyDown`
  (`angle-slider.tsx:449-486`) never consults the resolved direction - it reads `dir` only to stamp
  it on the root element, so `ArrowRight` increases under `dir="rtl"` exactly as under `dir="ltr"`.
  Constitution Principle III ("horizontal navigation MUST invert under `dir="rtl"`"), FR-011 and the
  WAI-ARIA Authoring Practices slider pattern all require the inversion, so `ArrowLeft`/`ArrowRight`
  are swapped when the resolved direction is `rtl`, while `ArrowUp`/`ArrowDown`/`PageUp`/`PageDown`/
  `Home`/`End` are unaffected. This is an additive divergence (research.md D-01): it cannot change
  behaviour for any consumer who never sets `dir="rtl"`, and it replaces no upstream prop or callback.
- **Only the Radix/base variant is in scope**: Dice UI's registry structure separates a `radix` base
  (used here) from other bases for the same component name. Only
  `docs/registry/bases/radix/ui/angle-slider.tsx` and its documented examples are in scope for this
  port; no other base variant of "Angle Slider" is ported.
- **Animation library in the "Controlled" example is not a dependency of the component**: The
  upstream `angle-slider-controlled-demo.tsx` example uses the `motion` package purely to animate the
  demo's own reset/randomize buttons (smoothing the value between two points), not as part of the
  Angle Slider component itself. This port reproduces the same visible easing behaviour in the demo
  page using this project's own means, without adding `motion` (or any animation library) as a new
  project dependency, since the component itself has no dependency on it upstream.
- **Form-library demo simplified to the project's own form primitives**: The upstream
  `angle-slider-form-demo.tsx` example wires the component to `react-hook-form` and `zod`, which are
  React-specific form libraries with no bearing on the Angle Slider component's own contract (FR-016
  already covers native form participation via the hidden input). The ported demo page reproduces the
  same user-visible scenario — two sliders inside a form, submitted together — using this project's
  own existing form-adjacent building blocks, without adding either library as a new dependency.
- **Acceptance scenarios US1-1/US1-2 corrected to the upstream formula's quadrants**: these two
  scenarios originally asserted `0°` for a pointer directly right of centre and `90°` for directly
  below. Upstream derives the value as `atan2(deltaY, deltaX)`, normalised to `[0, 360)` and then
  rotated by `-startAngle`; with the default `startAngle = -90` that puts the minimum at 12 o'clock
  and sweeps clockwise, so directly right is `90°` and directly below is `180°`. The original numbers
  were one quadrant out of phase with the arithmetic this port is required to reproduce exactly, and
  would have been baked into the test suite as a 90° phase error.
- **Keyboard direction follows the upstream MDX, not the upstream source**: the source
  (`angle-slider.tsx:473-476`) treats `ArrowUp` and `PageUp` as *decrease* keys. The upstream MDX
  keyboard table, FR-010 above, and the WAI-ARIA Authoring Practices slider pattern all specify that
  `ArrowUp`/`ArrowRight` and `PageUp` *increase*. The MDX is the API contract under Principle II, and
  a slider whose Up arrow decreases is a screen-reader defect under Principle III, so the MDX
  behaviour is implemented and the source's sign is treated as an upstream bug.
- **`Home`/`End` act on the active thumb**: upstream hardcodes `Home` to index `0` and `End` to the
  last index regardless of which thumb is focused. FR-010 and the WAI-ARIA pattern specify the
  focused thumb. The two are identical for the single-thumb case in every upstream demo and differ
  only for a focused second thumb in a range; the accessible behaviour is implemented.
- **Degenerate pointer geometry retains the value**: `Math.atan2(0, 0)` is `0` in JavaScript rather
  than `NaN`, so upstream silently snaps the value to `startAngle` when the pointer lands exactly on
  the dial's centre. Per this spec's Edge Cases the port instead leaves the value unchanged for a
  centre-of-dial pointer and for a zero-sized bounding box (a collapsed or hidden dial), which is an
  additive guard that cannot change behaviour for any real interaction.
- **Additive ARIA on the thumb and the hidden input**: a disabled thumb also carries
  `aria-disabled="true"` (upstream relies on the absent `tabindex` alone, which announces no state at
  all), and the hidden form input carries `aria-hidden="true"` with `tabindex="-1"` so an unlabelled
  numeric input does not appear in the accessibility tree beside every thumb. The latter follows the
  precedent already set by `tags-input.svelte` in this repository.
- **Value display unit stays `°` (degrees) by default**: Upstream defaults `AngleSliderValue`'s `unit`
  prop to `"°"` and the values themselves are unitless numbers that the consumer interprets as
  degrees. This port keeps that same default and the same "unitless number, degree-styled display"
  convention rather than introducing a typed unit system, since no upstream documentation suggests
  one.
- **The filled range honours `inverted`; upstream's does not**: `AngleSliderRange`
  (`angle-slider.tsx:674-679`) derives its percent without the `inverted` branch that
  `getAngleFromValue` applies to every thumb, so an inverted upstream dial draws its arc on the
  opposite side of the dial from its own thumbs. FR-009 requires `inverted` to reverse the
  value↔angular-position mapping wholesale, so the range uses the same conversion as the thumb
  (research.md D-10, corrective).
