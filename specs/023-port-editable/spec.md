# Feature Specification: Port Editable

**Feature Branch**: `023-port-editable`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Editable\" (slug: editable) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Edit text in place with the mouse (Priority: P1)

A person viewing a piece of text (a title, a todo item, a form field) clicks it, sees it turn into a
focused, fully-selected text field, changes the text, and confirms with a "Save" button. If they instead
click "Cancel", the original text comes back untouched.

**Why this priority**: Click-to-edit-then-confirm/cancel is the entire reason this component exists —
without it, this is just a text input with extra markup.

**Independent Test**: Render the component standalone with an uncontrolled `defaultValue`, click the
preview text, confirm an input appears focused with its text selected, change the text and click the
submit button, and confirm the preview shows the new text. Repeat, but click cancel instead, and confirm
the preview shows the original text.

**Acceptance Scenarios**:

1. **Given** an uncontrolled editable field showing "Initial Value", **When** the user clicks the preview,
   **Then** the preview is replaced by a text input focused with its entire content selected, and the
   preview is removed from the accessibility tree.
2. **Given** an active edit with changed text, **When** the user clicks the submit button, **Then** the new
   value replaces the old one, edit mode ends, and the preview (showing the new value) reappears.
3. **Given** an active edit with changed text, **When** the user clicks the cancel button, **Then** the
   field reverts to the value it had when edit mode was entered, edit mode ends, and the preview reappears
   showing the original value.

---

### User Story 2 - Edit text in place with the keyboard (Priority: P1)

A keyboard-only user tabs to the field's trigger, presses `Enter` to start editing, types a correction,
and presses `Enter` again to save — or presses `Escape` to discard the change and return focus to where
they started.

**Why this priority**: Full keyboard operability (entering edit mode, submitting, cancelling, and focus
restoration) is documented as a first-class interaction pattern upstream and is required for accessibility
parity; it is equally load-bearing as the pointer flow in User Story 1.

**Independent Test**: Render the component, focus the preview/trigger, press `Enter`, confirm the input is
focused and selected, type new text, press `Enter`, and confirm the value is committed. Repeat with
`Escape` instead and confirm the value reverts and focus returns to the trigger/preview element that had
focus before edit mode started.

**Acceptance Scenarios**:

1. **Given** a focused preview (default `triggerMode="click"` also accepts `Enter` on the focused
   preview), **When** the user presses `Enter`, **Then** edit mode starts the same way a click would.
2. **Given** an active edit, **When** the user presses `Enter` inside the input, **Then** the current input
   text is submitted as the new value and edit mode ends.
3. **Given** an active edit, **When** the user presses `Escape` inside the input, **Then** the value
   reverts to what it was when edit mode was entered, edit mode ends, and focus returns to the trigger
   element (the preview, or an external `EditableTrigger`, whichever last had focus before entering edit
   mode).
4. **Given** edit mode is entered via `Enter` on the preview, **When** the input first appears, **Then** it
   is focused and its full text content is selected, exactly as the pointer flow does.

---

### User Story 3 - Choose how editing starts and read the current state visually (Priority: P2)

A developer composing the field into different UIs picks whether editing starts on a single click, a
double click, or simply focusing the preview, and can style the field differently for its empty, disabled,
read-only, invalid, and required states without writing any state-tracking code themselves.

**Why this priority**: The three trigger modes and the documented data-attribute/ARIA state surface are
what make the primitive reusable across the upstream examples (default, double-click, todo list, form);
they are configuration on top of the core edit/submit/cancel loop from User Stories 1–2, not the loop
itself.

**Independent Test**: Render the component with `triggerMode="dblclick"`, confirm a single click does not
start editing and a double click does. Separately render with an empty value and confirm the preview shows
the placeholder and carries `data-empty`; render with `disabled` and confirm no interaction starts editing;
render with `readOnly` and confirm the input is permanently shown, editable-looking but inert.

**Acceptance Scenarios**:

1. **Given** `triggerMode="dblclick"`, **When** the user single-clicks the preview, **Then** nothing
   happens; **When** the user double-clicks it, **Then** edit mode starts.
2. **Given** `triggerMode="focus"`, **When** the preview receives focus (by any means, including `Tab`),
   **Then** edit mode starts immediately.
3. **Given** an empty value and a `placeholder`, **When** rendered outside edit mode, **Then** the preview
   displays the placeholder text and carries `data-empty`.
4. **Given** `disabled`, **When** the user clicks, double-clicks, or focuses the preview (matching the
   active `triggerMode`), **Then** edit mode never starts, and every part reflects `data-disabled`.
5. **Given** `readOnly`, **When** the component renders, **Then** the input is always shown (the preview
   never is) but is inert: it accepts focus and text selection but rejects value changes, and the root and
   input reflect the read-only state via their documented data attribute / `readonly` attribute.

---

### User Story 4 - Compose triggers, toolbar, and label around the field (Priority: P3)

A developer adds an external "Edit" button (an `EditableTrigger` placed outside the preview/input area), a
toolbar with explicit "Save"/"Cancel" buttons, and a label associated with the field — and everything stays
in sync with the field's edit state without extra wiring.

**Why this priority**: This is compositional sugar on top of the core state machine (Stories 1–2): every
upstream example composes at least one of these parts, but the field is fully usable with just a preview
and input, so this ranks below the interaction core and its configuration knobs.

**Independent Test**: Render the component with an external `EditableTrigger` outside the area, a
`EditableToolbar` containing `EditableCancel`/`EditableSubmit`, and an `EditableLabel`. Click the external
trigger and confirm edit mode starts; confirm the label is associated with the input via
`aria-labelledby`/`for`; confirm the toolbar buttons are only present while editing (or while `readOnly`).

**Acceptance Scenarios**:

1. **Given** an `EditableTrigger` rendered outside `EditableArea`, **When** the user activates it (per the
   active `triggerMode`), **Then** edit mode starts exactly as activating the preview would, and the
   trigger is hidden once editing starts unless it opts into `forceMount`.
2. **Given** an `EditableLabel`, **When** the field renders, **Then** the label's `for`/id wiring points at
   the input's id, and the label carries `data-disabled`/`data-invalid`/`data-required` mirroring the
   root's corresponding props.
3. **Given** an `EditableToolbar` with `EditableCancel` and `EditableSubmit`, **When** the field is not
   editing and not read-only, **Then** neither button is present in the accessibility tree; once editing
   starts, both appear and each performs its documented action.

---

### Edge Cases

- Blurring the input (moving focus away without pressing `Enter` or `Escape`) submits the current input
  text as the new value, exactly like pressing `Enter` — **except** when the blur's `relatedTarget` is the
  trigger or the cancel button, in which case no submit happens (those parts own the resulting state
  change themselves, and the trigger/cancel logic would otherwise race the blur-submit).
- `autosize` grows the input to fit its content (width for the default single-line input, height if the
  consumer supplies a multi-line `textarea`-style input) as the user types, recalculated on every value
  change and once when edit mode starts.
- `maxLength` caps the number of characters the input accepts, mirroring the native `maxlength` attribute.
- With no `defaultValue`/`value`, the field starts empty; if a `placeholder` is also supplied, the preview
  shows it and carries `data-empty` until a non-empty value is submitted.
- Controlled `value`/`editing` make the parent authoritative in the two forms this project supports: a
  plain `bind:value`/`bind:editing` writes the next value through to the parent and the display follows,
  while a bare `value`/`editing` prop (or a function binding that declines the write) leaves the rendered
  output unchanged until the parent feeds a new value in — in both forms `onValueChange`/`onEditingChange`
  fire with the next value.
- Submitting an unchanged value (input text equals the value edit mode started with) still calls `onSubmit`
  and exits edit mode — submission is not conditional on the value having actually changed.
- Rendering `EditableLabel`, `EditableArea`, `EditablePreview`, `EditableInput`, `EditableTrigger`,
  `EditableToolbar`, `EditableCancel`, or `EditableSubmit` outside an `Editable` root throws a descriptive
  error naming the missing part and the required ancestor.
- A `name` prop makes the field's current value submit with the enclosing `<form>` through a
  form-associated input, even while the visible input/preview carry no `name` themselves; a `required`
  field with an empty value fails native form validation the same way an empty required text input would.
- With `dir="rtl"`, the area and input reflect `dir="rtl"` so text entry, selection, and caret behaviour
  follow the right-to-left convention; no keyboard mapping needs to invert (the component has no
  left/right-sensitive keys), unlike components with horizontal arrow-key navigation.
- Toggling `readOnly` while a field is mid-edit forces it back to the always-shown, inert input state (the
  preview never reappears while `readOnly` is set, matching upstream's `if (editing || context.readOnly)
  return null` guard on the preview).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST be usable as a compound API composed of a root, an optional label, an
  area wrapping a preview and an input, an optional external trigger, and an optional toolbar with cancel
  and submit buttons — matching upstream's `Editable` / `EditableLabel` / `EditableArea` /
  `EditablePreview` / `EditableInput` / `EditableTrigger` / `EditableToolbar` / `EditableCancel` /
  `EditableSubmit` composition.
- **FR-002**: The root MUST support both uncontrolled (`defaultValue`) and controlled (`value` +
  `onValueChange`) usage of the text value, and both uncontrolled (`defaultEditing`) and controlled
  (`editing` + `onEditingChange`) usage of the edit-mode state, following this project's `$bindable`
  convention for both. In controlled mode a plain `bind:value`/`bind:editing` writes the next value
  through to the parent and the display follows; a bare `value`/`editing` prop (or a function binding
  that declines the write) leaves the rendered output unchanged until the parent feeds a new value in. In
  both forms `onValueChange`/`onEditingChange` fire with the next value.
- **FR-003**: Activating the preview (or an external trigger) per the active `triggerMode` MUST enter edit
  mode: it MUST record the value at that moment as the value to restore on cancel, set editing to true, and
  call `onEdit`. It MUST NOT do anything if `disabled` or `readOnly` is set.
- **FR-004**: The root MUST accept a `triggerMode` prop (`"click"` | `"dblclick"` | `"focus"`, default
  `"click"`) that selects which preview interaction (plus `Enter` on a focused preview, per FR-008) enters
  edit mode; the other two interactions MUST have no effect on edit state.
- **FR-005**: While in edit mode, the preview MUST NOT render (removed from the DOM and accessibility
  tree, not merely hidden) and the input MUST render in its place, focused with its content fully selected
  on the same animation frame edit mode starts, with `autosize` (FR-011) applied immediately if enabled.
  While `readOnly` is set, the input MUST always render (never the preview), regardless of edit state.
- **FR-006**: Submitting (via `Enter` in the input, the submit button, or blur per the Edge Cases section)
  MUST set the value to the input's current text, set editing to false, and call `onSubmit` with that
  value — even when the value is unchanged from what editing started with.
- **FR-007**: Cancelling (via `Escape` in the input or the cancel button) MUST restore the value to what it
  was when edit mode was entered, set editing to false, call `onCancel`, and return focus to the element
  that triggered edit mode (the preview, or an external `EditableTrigger` if that is what was activated).
- **FR-008**: The preview MUST respond to `Enter` by entering edit mode when it has focus, independent of
  `triggerMode`, unless `disabled` or `readOnly` is set (matching upstream's dedicated `onKeyDown`
  handling on the preview, which composes with — and can be short-circuited by — an optional
  `onEnterKeyDown` root callback).
- **FR-009**: The root MUST accept an `onEscapeKeyDown` callback invoked before the built-in cancel
  behaviour when `Escape` is pressed in the input; if the callback marks the event as handled (calls
  `preventDefault()`), the built-in cancel MUST be skipped, matching FR-008's `onEnterKeyDown` composition
  pattern.
- **FR-009a**: `Tab` MUST move focus natively and MUST NOT be intercepted by any part. Tabbing out of the
  input MUST follow the blur rules (commit the current text), except when focus lands on the trigger or
  the cancel button, and tabbing onto the preview MUST enter edit mode when `triggerMode="focus"`.
- **FR-010**: The root MUST accept `disabled`, `readOnly`, `required`, and `invalid` props. `disabled` MUST
  suppress every interaction (entering edit mode, submitting, cancelling) across all parts and MUST be
  reflected as `data-disabled` on the label, area, preview, input, and trigger. `readOnly` MUST keep the
  input permanently rendered and focusable while suppressing value changes and MUST be reflected as
  `data-readonly` on the preview (when it would otherwise render) and on the input's native `readonly`
  attribute. `required`/`invalid` MUST be reflected as `data-required`/`data-invalid` on the label and, for
  `invalid`, as `aria-invalid` on the input.
- **FR-011**: The root MUST accept an `autosize` prop (default `false`); when enabled, the input MUST grow
  to fit its current text content, recalculated on every value change and once when edit mode starts, and
  MUST carry a distinct width-auto styling class from the default full-width input.
- **FR-012**: The root MUST accept a `maxLength` prop applied to the input as the native character-count
  cap.
- **FR-013**: The root MUST accept a `placeholder` prop shown by the preview (with `data-empty` set) when
  the value is empty, and passed through to the input as its native placeholder.
- **FR-014**: The external trigger part (`EditableTrigger`) MUST enter edit mode when activated per the
  active `triggerMode` (click or double-click; a `triggerMode="focus"` root still exposes the trigger as a
  click/double-click activator per upstream, since focus-triggering an explicit button is not meaningful),
  MUST be hidden while editing or while `readOnly` unless it opts into a `forceMount` prop that keeps it
  present, and MUST reflect `data-disabled`/`data-readonly`.
- **FR-015**: The toolbar part (`EditableToolbar`) MUST accept an `orientation` prop (`"horizontal"` |
  `"vertical"`, default `"horizontal"`) reflected as `aria-orientation` and applied as a layout direction
  class.
- **FR-016**: The cancel and submit button parts MUST be hidden (removed from the DOM) unless the field is
  editing or `readOnly`, MUST perform their respective FR-007/FR-006 action when activated, and MUST do
  nothing if `disabled` or `readOnly` is set.
- **FR-017**: The component MUST submit the current text value through a visually-hidden, form-associated
  input carrying `name` (when supplied), `disabled`, `readOnly`, and `required`, so native and library form handling
  observes the value and native `required` validation blocks submission of an empty, required field —
  without requiring the visible preview/input to carry `name` themselves.
- **FR-018**: Rendering `EditableLabel`, `EditableArea`, `EditablePreview`, `EditableInput`,
  `EditableTrigger`, `EditableToolbar`, `EditableCancel`, or `EditableSubmit` outside an `Editable` root
  MUST throw an error identifying both the part and the required ancestor.
- **FR-019**: The component MUST render correctly under `dir="rtl"`: the area and input reflect
  `dir="rtl"` for correct text flow and selection, matching upstream's direction-aware rendering (the
  component has no left/right-sensitive keyboard interaction to invert).
- **FR-020**: The component MUST ship as an installable registry item under the project's UI component
  directory with a public barrel export, and a documentation page MUST demonstrate every example shown on
  the upstream docs page: the default layout, the double-click trigger mode, the autosize input, the todo
  list composition, and the form-integrated composition (adapted to this project's existing form/label
  primitives per the Assumptions section).
- **FR-021**: The component MUST expose the upstream role and ARIA surface: the preview MUST carry
  `role="button"`, be focusable (`tabindex="0"`) unless `disabled`/`readOnly`, and reflect `aria-disabled`
  when `disabled` or `readOnly`; the area MUST carry `role="group"`; the toolbar MUST carry
  `role="toolbar"` with `aria-orientation`; the trigger, cancel, submit and toolbar parts MUST carry
  `aria-controls` pointing at the root's rendered `id`; the label MUST carry an `id` and a `for` targeting
  the input's `id`, and the input MUST carry `aria-labelledby` targeting the label's `id`, so the field
  always has an accessible name.

### Key Entities

- **Value**: The current text content of the field — a single string, controlled or uncontrolled, restored
  on cancel and committed on submit.
- **Editing state**: Whether the field is currently showing its input (true) or its preview (false),
  controlled or uncontrolled, independent of the value itself.
- **Restore value**: The value captured at the moment edit mode was entered, used to revert the field when
  the user cancels; not exposed as a prop, but its behaviour (revert-on-cancel) is part of the documented
  contract.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A person can enter edit mode, change text, and either save or discard the change using only
  the keyboard — `Enter`/click/double-click/focus (per `triggerMode`) to start, `Enter` to submit, `Escape`
  to cancel — with zero pointer interaction required and focus always ending up in a predictable,
  documented place.
- **SC-002**: Entering edit mode always focuses the input and selects its full text in the same interaction
  (no extra click or keypress needed to start typing over the existing value), in 100% of trigger-mode
  configurations.
- **SC-003**: Cancelling an edit always restores the exact value the field had before edit mode started,
  with zero cases of a partially-applied or lost value, and returns focus to the element that started the
  edit.
- **SC-004**: The component passes an automated accessibility and keyboard-interaction test suite that
  covers every interaction listed in the Requirements section, with zero regressions against the upstream
  component's documented behaviour (upstream's test file assertions all have a corresponding covered
  case).
- **SC-005**: The demo page documents every prop of all nine parts (`Editable`, `EditableLabel`,
  `EditableArea`, `EditablePreview`, `EditableInput`, `EditableTrigger`, `EditableToolbar`,
  `EditableCancel`, `EditableSubmit`), so a developer already familiar with the upstream Dice UI `Editable`
  can compose the Svelte version correctly using only this project's documentation page.

## Assumptions _(mandatory)_

- Only the `radix` upstream base variant
  (`.reference/diceui/docs/registry/bases/radix/ui/editable.tsx`) is ported, consistent with this
  project's established pattern of porting the Radix-family upstream variant, since the project's existing
  primitives are built on `bits-ui` (the same primitive family). The `base` variant
  (`.reference/diceui/docs/registry/bases/base/ui/editable.tsx`) exists upstream but is out of scope, same
  as prior ports (e.g. tags-input) that had both a `base` and `radix` source.
- Upstream's internal `Store` (a hand-rolled `useSyncExternalStore`-based publish/subscribe object holding
  `{ value, editing }`, used so every part re-renders only on the slice of state it reads) has no purpose
  in Svelte 5: `$state`/`$derived` already provide fine-grained, subscription-free reactivity. It is
  re-expressed as plain `$state` fields on an `EditableState` class in `editable.svelte.ts`, per CLAUDE.md
  §10's guidance that a custom hook/store becomes a state class. `useStore`/`useEditable` (the exported
  hook for reading `{ value, editing }` from outside the compound parts) is not ported as a separate public
  export; consumers needing that data use `bind:value`/`bind:editing` on the root instead, which is the
  project's established two-way-binding idiom and covers the same use case (upstream's own examples never
  call `useEditable` directly).
- Upstream's `asChild`/`Slot` prop (present on every part) has no direct Svelte 5 equivalent. Per CLAUDE.md
  §10, it is replaced by a `child` snippet prop on each part (matching `dialog-content.svelte`'s
  established pattern), letting a consumer render `EditableTrigger`/`EditableSubmit`/`EditableCancel` etc.
  as, e.g., the project's own `Button` while the part still owns its behaviour/attributes. The
  `editable-form-demo`/`editable-todo-list-demo` examples (which wrap the trigger/submit/cancel buttons in
  `asChild` around a `Button`) are reproduced this way on the demo page.
- Upstream associates the value with a form through `VisuallyHiddenInput type="hidden"`. This port renders
  a clipped `<input type="text" data-slot="editable-form-input">` instead, matching the pattern already
  established by `tags-input`, `time-picker`, and `phone-input` in this repository, because `type="hidden"`
  inputs are excluded from native constraint validation and FR-017's `required` block would otherwise be
  unreachable.
- Upstream's `useIsomorphicLayoutEffect`-driven focus/select/autosize-on-edit-start effect is ported per
  CLAUDE.md §10's translation table as an `$effect.pre` (DOM measurement/focus before paint), using
  `requestAnimationFrame` + a cleanup that cancels it, exactly mirroring upstream's own
  frame-scheduling/cancellation to avoid a focus race with the just-mounted input.
- Upstream's `React.useId()`-generated `rootId`/`inputId`/`labelId` are reproduced using `$props.id()` per
  CLAUDE.md §10, preserving the same `aria-controls`/`aria-labelledby`/`htmlFor` wiring documented upstream.
- The `editable-form-demo` example's `react-hook-form` + `zod` + upstream's own `Form`/`FormField`
  primitives have no installed equivalent in this repository (no form-validation-library dependency exists
  here). The demo page reproduces the same visual/behavioural composition — two `Editable` fields with
  `invalid` states, external trigger buttons, and a toolbar — driven by plain Svelte `$state` and simple
  manual validation instead of a form library, since porting or introducing a form-validation library is
  out of scope for this feature and only the `Editable`-specific composition pattern needs to be
  demonstrated.
- Upstream's `EditablePreview`/`EditableInput`/etc. all destructure and forward native event handler props
  (`onClick`, `onDoubleClick`, `onFocus`, `onKeyDown`, `onBlur`, `onChange`) ahead of the component's own
  handling, calling the caller's handler first and honoring `event.preventDefault()` to skip the built-in
  behaviour. This is reproduced by accepting the same native event props through `...restProps` and
  invoking them before the built-in logic, matching this project's existing convention (e.g. `tags-input`'s
  `onEnterKeyDown`/`onEscapeKeyDown` composition) rather than introducing new dedicated callback props for
  every native event.
- Upstream's `onCancel` (`editable.tsx:240-245`) reverts the value and leaves edit mode but restores focus
  nowhere — the just-unmounted input drops focus to `<body>`. This port restores focus to the element that
  started the edit (the external `EditableTrigger` if it was used, otherwise the preview), because
  FR-007/SC-003 and predictable focus order require it. An addition; no upstream behaviour is removed.
- Upstream places the root's `maxLength` into context (`editable.tsx:274`) but `EditableInput` reads only
  its own `maxLength` prop (`:648`), leaving the documented root prop dead. This port applies
  `maxLength ?? root.maxLength` on the input so the root prop documented in the MDX actually works.
- Upstream computes `rootId = id ?? useId()` and hands it to four parts as `aria-controls`, yet renders
  `id={id}` on the root (`editable.tsx:314`), so `aria-controls` dangles whenever the caller passes no
  `id`. This port always renders the resolved id on the root.
- Upstream's `EditableTrigger` attaches no handler at all when `triggerMode="focus"` (`editable.tsx:692-693`),
  rendering an inert button. This port activates the trigger on click for both `"click"` and `"focus"`, and
  on double click for `"dblclick"` (FR-014).
- Upstream's `EditableToolbar` sets only `aria-orientation` (`editable.tsx:719`) with no data attribute
  reflecting orientation. This port also emits `data-orientation={orientation}`, because this project's
  styling discipline (CLAUDE.md §6) requires every piece of component state to be exposed as a `data-*`
  attribute so consumers can style it. An addition; no upstream behaviour is removed.
- Upstream's `EditableCancel`/`EditableSubmit` emit no state data attributes (`editable.tsx:763-770`,
  `:805-812`). This port has both emit `data-disabled`/`data-readonly`, since both buttons render while
  `readOnly` and the same data-attribute-exposure rule applies. An addition.
- Upstream commits `Enter` inside the input without calling `event.preventDefault()` (`editable.tsx:600-602`).
  This port calls `event.preventDefault()` before submitting, because inside a `<form>` (FR-017 puts the
  field inside a form by design) the un-prevented `Enter` also triggers implicit native form submission,
  double-handling the commit.
