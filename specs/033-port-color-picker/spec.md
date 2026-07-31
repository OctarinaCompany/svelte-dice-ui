# Feature Specification: Color Picker

**Feature Branch**: `033-port-color-picker`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Color Picker\" (slug: color-picker) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Pick a color from a popover (Priority: P1)

A user filling out a settings form needs to choose a color. They open a compact swatch/button
trigger, and a popover appears with a 2D saturation/brightness area, a hue slider, an alpha
(transparency) slider, an eyedropper tool (where the browser supports it), a format selector, and
a text input showing the color in the selected notation. Adjusting any control updates every other
control and the swatch immediately, and the picker closes when the user presses Escape or clicks
outside, returning focus to the trigger.

**Why this priority**: This is the primary, most common way the component is used — as a
self-contained popover picker — and every other user story builds on this same set of parts.

**Independent Test**: Render `ColorPicker` with a trigger, content, area, sliders, eyedropper,
format select and input. Open the trigger, drag/keyboard-adjust the area and sliders, and confirm
the swatch, input text, and `onValueChange` callback all reflect the new color consistently.

**Acceptance Scenarios**:

1. **Given** a closed color picker with `defaultValue="#3b82f6"`, **When** the user activates the
   trigger with `Enter` or `Space`, **Then** the popover content opens and focus moves into it.
2. **Given** an open color picker, **When** the user drags or keyboard-navigates the 2D area,
   **Then** the saturation/brightness of the current color updates and the swatch, hue-locked
   background, and text input all reflect the new value.
3. **Given** an open color picker, **When** the user adjusts the hue slider, **Then** the area's
   background hue, the swatch, and the input value update to match.
4. **Given** an open color picker, **When** the user adjusts the alpha slider, **Then** the
   swatch shows the checkerboard-backed transparency and the input's alpha channel updates.
5. **Given** an open color picker, **When** the user presses `Escape`, **Then** the popover closes
   and focus returns to the trigger.
6. **Given** an open color picker, **When** the user changes the format select from `hex` to
   `rgb`, **Then** the input switches to showing separate red/green/blue/alpha fields for the same
   underlying color.

---

### User Story 2 - Pick a color inline without a popover (Priority: P2)

A user building a dashboard theme editor wants the color picker's area, sliders and input always
visible on the page rather than hidden behind a trigger, so it can sit inside a larger panel
alongside other always-visible controls.

**Why this priority**: The `inline` mode is a documented, commonly used variant (upstream ships a
dedicated example for it) but is not the default rendering path, so it follows the popover story.

**Independent Test**: Render `ColorPicker` with `inline` set and no `Trigger`/`Content`; confirm
the area, sliders and input render directly in the page flow with no popover semantics, and that
interacting with them updates the bound value the same way as the popover variant.

**Acceptance Scenarios**:

1. **Given** `inline` is set, **When** the component renders, **Then** the area, sliders, swatch
   and input appear directly in the page without any popover trigger, portal, or overlay behavior.
2. **Given** an inline color picker bound to external state, **When** the user adjusts any part,
   **Then** the external state updates via `onValueChange` exactly as it would in popover mode.

---

### User Story 3 - Use the color picker as a controlled form field (Priority: P3)

A developer wires the color picker into a form library, driving `value` from form state and
submitting it as a plain string alongside other fields, including in a native (non-JS) form
submission fallback.

**Why this priority**: Form integration and full external control are documented but are a
refinement over the two rendering modes above — most consumers start uncontrolled or with simple
external state before wiring up a form library.

**Independent Test**: Render a `<form>` containing a named, controlled `ColorPicker` plus a native
submit button; confirm the color's string value is present in the submitted form data under the
given `name`, and that setting `value` externally (without `onValueChange` reacting) keeps the
picker showing the externally supplied color.

**Acceptance Scenarios**:

1. **Given** a `ColorPicker` with `name="primaryColor"` inside a `<form>`, **When** the form is
   submitted, **Then** the submitted form data contains the current color string under that name.
2. **Given** a `ColorPicker` with a controlled `value` prop and no internal state change, **When**
   the parent re-renders with a new `value`, **Then** the picker displays the new externally
   supplied color instead of any locally adjusted one.
3. **Given** `disabled`, `readOnly`, or `required` is set, **When** the user attempts to interact
   with the trigger, area, sliders, or input, **Then** interaction is suppressed (`disabled`,
   `readOnly`) or the hidden form field reflects `required` for native validation, matching
   upstream's documented behavior for each flag.

---

### Edge Cases

- Typing an invalid or partial value into the text input (e.g. an incomplete hex string) MUST NOT
  update the color; the input keeps showing the last valid value once it loses focus.
- Dragging the pointer for the 2D area or a slider past the edge of the triggering element MUST
  clamp to the nearest valid value rather than erroring or producing an out-of-range value.
- The eyedropper control MUST NOT render at all in browsers without the native EyeDropper API,
  rather than rendering a disabled or broken button.
- Switching the display format (hex/rgb/hsl/hsb) MUST NOT change the underlying color value —
  only its textual representation.
- An alpha value of `0` MUST still render a distinguishable (checkerboard) swatch rather than an
  invisible one.
- With `dir="rtl"`, horizontal keyboard navigation on the 2D area and on the hue/alpha sliders MUST
  invert direction (e.g. the key that increases the value in `ltr` decreases it in `rtl`).
- Rendering any part (`Trigger`, `Content`, `Area`, `HueSlider`, `AlphaSlider`, `Swatch`,
  `EyeDropper`, `FormatSelect`, `Input`, `InputField`) outside of a `ColorPicker` root MUST throw a
  descriptive error naming both the part and the root.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The color picker MUST support both uncontrolled (`defaultValue`, internal state) and
  controlled (`value` + `onValueChange`) usage of its current color, defaulting to `#000000` when
  neither is supplied.
- **FR-002**: The color picker MUST support both uncontrolled (`defaultOpen`) and controlled
  (`open` + `onOpenChange`) usage of the popover's open state, MUST forward a `modal` flag (default
  `false`) that governs whether the open popover traps focus and blocks outside interaction, and
  MUST additionally offer an `inline` mode that renders its content directly in the page with no
  popover/overlay behavior at all.
- **FR-003**: The color picker MUST expose a display format of `hex`, `rgb`, `hsl`, or `hsb`,
  supporting both uncontrolled (`defaultFormat`) and controlled (`format` + `onFormatChange`) usage,
  defaulting to `hex`. Changing the format MUST only change how the color is displayed/edited, never
  the underlying color value.
- **FR-004**: A trigger part MUST open and close the popover on activation (click, `Enter`,
  `Space`), MUST support composing an arbitrary child element (e.g. a swatch or a button) as its
  visible content, and MUST honor `disabled` inherited from the root or set directly on the trigger.
- **FR-005**: A content part MUST render the picker's inner parts inside a popover when not
  `inline`, and as a plain, unstyled-position container when `inline`, in both cases without manual
  `z-index` management.
- **FR-006**: A 2D area part MUST let the user pick saturation and brightness/value simultaneously
  by pointer drag and by keyboard, MUST expose `role="slider"` semantics with a computed
  `aria-valuetext` describing the current color, and MUST support a coarser adjustment step when a
  modifier key (Shift) is held during keyboard navigation, matching the WAI-ARIA Authoring Practices
  slider pattern where upstream's own accessibility semantics are incomplete.
- **FR-007**: A hue slider part MUST let the user adjust hue across the full 0-360 degree range by
  pointer drag and by keyboard (arrow keys, Home, End, Page Up/Down), rendering a full-spectrum hue
  gradient as its track background.
- **FR-008**: An alpha slider part MUST let the user adjust the color's transparency from fully
  transparent to fully opaque by pointer drag and by keyboard, rendering a checkerboard-backed
  gradient from transparent to the current opaque color as its track background.
- **FR-009**: A swatch part MUST visually represent the current color, including a checkerboard
  pattern behind any color with less than full opacity, and MUST expose an accessible name
  describing the current color value (or that no color is selected).
- **FR-010**: An eyedropper part MUST let the user sample a color from anywhere on screen using the
  browser's native color-sampling capability when available, MUST update the current color from the
  sampled result while preserving the existing alpha, and MUST NOT render anything (not even a
  disabled control) when the browser lacks that capability.
- **FR-011**: A format-select part MUST let the user choose the active display format from the
  supported list (hex, rgb, hsl, hsb) via a listbox-style control.
- **FR-012**: An input part MUST render one or more text fields matching the active format
  (a combined hex+alpha pair by default, or separate numeric fields per channel for rgb/hsl/hsb),
  each field individually labeled for assistive technology, and MUST support an option to omit the
  alpha field entirely for consumers that don't need transparency.
- **FR-013**: Editing any input field with a valid value for its channel MUST update the current
  color and every other part in sync; an invalid or out-of-range value MUST be rejected without
  changing the current color.
- **FR-014**: The color picker MUST expose its current color as a plain 6-digit hex string —
  regardless of the active display format, matching upstream — suitable for native HTML form
  submission under a given field `name`, remaining synchronized with the current color even when
  the picker is never opened, and MUST support `disabled`, `readOnly`, and `required` semantics
  consistent with other form-integrated components in this project.
- **FR-015**: All interactive parts MUST honor `disabled` and `readOnly` inherited from the root (or
  set directly on the part). `disabled` suppresses pointer and keyboard interaction and is reflected
  visually and via `aria-disabled`/`data-disabled`; `readOnly` suppresses every colour mutation while
  leaving the parts focusable, and is reflected via `data-readonly`.
- **FR-016**: The color picker MUST support right-to-left layouts: pointer- and keyboard-driven
  horizontal navigation on the 2D area and on the hue/alpha sliders MUST invert direction when the
  resolved direction is `rtl`, consistent with the project's existing direction handling.
- **FR-017**: Every part MUST throw a descriptive error identifying both itself and the required
  `ColorPicker` root when rendered outside of one.
- **FR-018**: Keyboard interaction MUST match the upstream-documented set at minimum: `Tab`/
  `Shift+Tab` to move focus, `Enter`/`Space` to open the trigger, `Escape` to close and return focus
  to the trigger, and arrow keys (plus `Home`/`End`/Page Up/Down on sliders, and a larger step under
  Shift on the 2D area) to adjust values.
- **FR-019**: The color picker MUST support an `asChild`-equivalent composition pattern so consumers
  can render the trigger, content, area, and swatch as a custom element while keeping the
  component's behavior and accessibility wiring.
- **FR-020**: The color picker MUST expose its current reactive state (colour, hue, alpha, format and
  open state) to consumers through a single documented accessor, replacing upstream's exported
  selector hook, so a consumer can build additional parts against the same state.

### Key Entities

- **Color value**: The picker's single source of truth, represented externally as a CSS color
  string (hex by default) and internally tracked with enough precision (RGB + alpha, and a
  corresponding hue/saturation/brightness representation) to round-trip losslessly between the 2D
  area, the hue slider, the alpha slider, and every supported display format.
- **Display format**: One of `hex`, `rgb`, `hsl`, `hsb` — governs only how the color value is
  presented and edited in the input and format-select parts, never the stored color itself.
- **Open state**: Whether the popover (non-inline mode only) is currently visible.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can select a fully custom color using only pointer input (area drag + two
  slider drags) in under 10 seconds.
- **SC-002**: A user relying solely on the keyboard can open the picker, choose a color, and close
  it, using only the keys listed in FR-018, with no action requiring a pointer.
- **SC-003**: 100% of the documented upstream examples (default popover, inline, controlled state,
  form integration) are reproduced as working demo sections.
- **SC-004**: Switching between all four display formats never changes the resulting color string
  once converted back to the original format (round-trip accuracy within rounding tolerance of 1
  unit per channel).
- **SC-005**: Every interactive part remains fully operable and correctly labeled for assistive
  technology when audited against the WAI-ARIA slider and listbox patterns.
- **SC-006**: All keyboard and pointer interactions behave with correctly inverted directionality
  when the surrounding layout is right-to-left.

## Assumptions

- **EyeDropper API availability**: The `EyeDropper` part depends on the browser-native
  `window.EyeDropper` API (Chromium-based browsers only, per upstream's own documented browser
  support). No polyfill is added; the part renders nothing when the API is absent, exactly matching
  upstream behavior. This is a platform limitation, not a scope reduction.
- **Color conversion module**: Upstream's `color-picker.tsx` inlines its own hex/RGB/HSL/HSV
  parsing and formatting functions; the already-ported `color-swatch` module
  (`src/lib/components/ui/color-swatch/color.ts`) exports only swatch-background helpers
  (`normalizeColorValue`, `isCssColor`, `hasAlpha`, `getColorBackgroundStyle`), not numeric color
  conversion. Per the composition principle, the port reuses `getColorBackgroundStyle` (and its
  helpers) for the swatch's checkerboard/background rendering, and adds the numeric hex/RGB/HSL/HSV
  parsing and formatting functions upstream defines as a shared module colocated with this
  component, since no existing project module owns that responsibility. This is a structural
  divergence (upstream inlines the functions in one file; this port factors them into a pure,
  rune-free `color.ts` beside the state class in `color-picker.svelte.ts`, matching the
  `color-swatch` precedent of a pure module with its own spec) and not a behavioral one — the same
  conversions, rounding, and regex-based string parsing are reproduced.
- **State container**: Upstream implements a custom pub/sub store (`useSyncExternalStore`) so that
  deeply nested parts re-render independently. Per Principle I, this becomes a single reactive state
  class in `color-picker.svelte.ts`, exposed through Svelte context — runes provide the same
  fine-grained subscription upstream builds a custom store for, so no store abstraction is ported.
- **2D area accessibility**: Upstream's `ColorPickerArea` is pointer-only with no keyboard support
  and no ARIA role at all. Per Principle III (follow the WAI-ARIA Authoring Practices where upstream
  is weaker), this port adds `role="slider"`, `aria-valuemin`/`aria-valuemax`/`aria-valuenow` (on the
  saturation axis) plus a computed `aria-valuetext` describing the full color, and keyboard support
  (arrow keys with a larger step under Shift) that upstream does not have. This is a strict
  accessibility improvement, recorded here as required by the constitution rather than treated as
  silent scope creep.
- **`asChild` translation**: React's `asChild`/`Slot` composition (used on `Trigger`, `Content`,
  `Area`, `Swatch`, `EyeDropper`, `FormatSelect`) is translated to this project's `child` snippet
  pattern (see `dialog-content.svelte`), per the standard React → Svelte translation table.
- **Visually-hidden form input**: Upstream's `VisuallyHiddenInput` component (for native form
  submission of the color string) is a small, already-established pattern in this codebase (used by
  other form-integrated ported components); this port follows the same existing pattern rather than
  introducing a new one.
- **Controlled value parsing**: Upstream parses an incoming controlled `value` with `hexToRgb` only,
  while emitting `colorToString(color, format)` — so a consumer who wires `value` and `onValueChange`
  together (as upstream's own controlled and form demos do) feeds back an `rgb()`/`hsl()`/`hsb()`
  string that upstream's parser reads as black. This port parses controlled values with the
  `parseColorString` helper upstream already defines in the same file, falling back to `hexToRgb`,
  and preserves the current alpha when the incoming notation carries none. This fixes an upstream
  defect that `bind:value` would otherwise surface immediately; the hex-only path behaves identically.
- **Trigger element**: Upstream's demos use `<ColorPickerTrigger asChild><ColorPickerSwatch /></ColorPickerTrigger>`,
  which merges the trigger's props onto the swatch's `<div role="img">` — a trigger that is neither
  focusable nor activatable, contradicting upstream's own documented `Enter`/`Space` keyboard
  behavior. This port's `Trigger` renders a real `<button type="button">` (through the composed
  popover trigger) with the swatch as its content, and keeps a `child` snippet for consumers who
  want their own element. Accessibility improvement, required by FR-018 and SC-002.
- **RTL on the area**: Upstream's 2D area maps pointer x to saturation with no direction handling and
  has no keyboard at all. This port inverts both the pointer-x mapping and the horizontal arrow keys
  when the resolved direction is `rtl`, so the crosshair tracks the pointer in a mirrored layout
  (FR-016).
- **Input field draft buffer**: React re-renders a controlled input back to its last valid value for
  free, which is how upstream discards an invalid keystroke. Svelte does not rewrite a DOM value the
  state never changed, so each input field keeps a local draft that is reconciled to the canonical
  value on blur. Same observable outcome as upstream, and it is what makes the "keeps showing the
  last valid value once it loses focus" edge case above hold.
- **Slider primitive**: The shadcn-svelte `slider` component is not part of this repo's installed base
  set and `shadcn-svelte add` is forbidden mid-port, so the hue and alpha sliders compose the
  `bits-ui` `Slider` primitive directly — the same layer upstream composes (`radix-ui`'s
  `SliderPrimitive`). `bits-ui` has no separate `Track` part; its `Slider.Root` is the track, so
  upstream's track classes and gradients move onto the root. The thumbs additionally carry an
  `aria-label` and `aria-valuetext`, which upstream's unnamed thumbs lack.
- **Angle slider**: The reading list mentions `angle-slider.tsx` as related reference material, but
  no upstream color-picker part imports or depends on it — the hue slider is built on the linear
  `Slider` primitive, not the angle slider. It is therefore out of scope for this port and is not a
  component this feature creates or modifies.
- **`useColorPicker` selector hook**: Upstream exports `useStore as useColorPicker`, a selector hook
  letting consumers read a slice of the picker's internal store (`color-picker.tsx:441-450, 1677`).
  Runes subscribe automatically, so a selector hook has no Svelte analogue: it is replaced by
  `getColorPickerContext(consumerName)`, exported from `color-picker.svelte.ts` and re-exported by
  the barrel, which returns the reactive root state object (`rgb`, `hsv`, `hue`, `alpha`, `format`,
  `open`, and the mutators). Same capability, no selector argument. Recorded here per Principle II.
- **`readOnly` enforcement**: Upstream threads `readOnly` through its context but no part reads it —
  only `VisuallyHiddenInput` receives it (`color-picker.tsx:666-720`), so a read-only upstream picker
  is still fully editable. This port guards every mutator on `readOnly` (data-model.md §6), matching
  the `readOnly` semantics of the other form-integrated components in this repo (`editable`,
  `time-picker`). Behavioural divergence, recorded per Principle II.
- **3-digit hex**: Upstream's `parseColorString` accepts a 3-digit hex but hands it to `hexToRgb`,
  whose regex requires 6 digits, so `#abc` parses to black (`color-picker.tsx:85-95, 319-328`). This
  port expands 3-digit shorthand in `hexToRgb`, so both helpers agree. Upstream defect fix; the
  6-digit path behaves identically.
- **Form demo adaptation**: Upstream's `color-picker-form-demo.tsx` composes `react-hook-form`,
  `zod` and its own `Form`/`FormField` components over three colour fields. This repo installs none
  of those and `shadcn-svelte add` is forbidden mid-port, so the Form preview is rebuilt as a native
  `<form>` with three `ColorPicker`s bound to page-local runes, each carrying a `name`, hex-validated
  on submit and reporting the resulting `FormData` — same capability (colour picker as a validated
  form field), different form library. Divergence recorded per Principle II; it additionally
  exercises the `name`/hidden-input path that upstream's demo never reaches.
