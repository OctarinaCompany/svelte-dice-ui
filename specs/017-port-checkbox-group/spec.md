# Feature Specification: Checkbox Group Component Port

**Feature Branch**: `017-port-checkbox-group`

**Created**: 2026-07-30

**Status**: Draft

**Input**: User description: "Port the Dice UI React component 'Checkbox Group' (slug: checkbox-group) to
this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Select multiple related options as a labelled group (Priority: P1)

A user filling out a form sees a set of related checkboxes under a shared label (e.g. "Favorite tricks"),
can check and uncheck any number of them independently, and the group as a whole is announced to assistive
technology as a single labelled unit rather than a set of unrelated checkboxes.

**Why this priority**: This is the component's entire purpose — grouped, multi-select checkboxes with a
shared accessible name. Without it there is no checkbox group, just individually-rendered checkboxes.

**Independent Test**: Render a group with a label and three items, none checked. Verify the group exposes
its accessible name from the label, that each item exposes `role="checkbox"` and starts unchecked, that
clicking one item checks only that item, and that clicking a second item leaves the first checked.

**Acceptance Scenarios**:

1. **Given** a checkbox group with a label and three items, **When** the page renders, **Then** the group is
   exposed with `role="group"` and an accessible name equal to the label's text, and each item is exposed
   as `role="checkbox"` with `aria-checked="false"`.
2. **Given** a checkbox group with no items checked, **When** the user clicks an unchecked item, **Then**
   that item becomes checked (`aria-checked="true"`) and no other item's state changes.
3. **Given** a checkbox group with one item checked, **When** the user clicks that checked item, **Then**
   it becomes unchecked and the group's value no longer includes it.
4. **Given** a checkbox group rendered uncontrolled with a `defaultValue`, **When** the page first renders,
   **Then** exactly the items named in `defaultValue` start checked.
5. **Given** a checkbox group rendered controlled with `value` and `onValueChange`, **When** the user clicks
   an item, **Then** the component calls back with the next value but the rendered checked state does not
   change until the caller supplies the updated `value`.

---

### User Story 2 - Operate the group entirely from the keyboard (Priority: P1)

A keyboard-only user tabs to each checkbox item in document order (the group does not trap focus in a
roving-tabindex pattern — every item is its own stop) and toggles each one with the `Space` key, exactly as
a native checkbox would behave.

**Why this priority**: Accessibility parity is a non-negotiable project principle, and this component
establishes the project's form-control conventions — a checkbox group unusable from the keyboard is not
shippable and would set the wrong precedent for every later form component.

**Independent Test**: Render three items and drive the page purely with `Tab` and `Space` via `userEvent`,
asserting focus and checked state after each key press.

**Acceptance Scenarios**:

1. **Given** focus outside the group, **When** the user presses `Tab`, **Then** focus lands on the first
   item in document order.
2. **Given** focus on an unchecked item, **When** the user presses `Space`, **Then** that item becomes
   checked and focus remains on it.
3. **Given** focus on a checked item, **When** the user presses `Space` again, **Then** that item becomes
   unchecked.
4. **Given** focus on an item, **When** the user presses `Tab`, **Then** focus moves to the next item (or
   the next focusable element after the last item), never skipping a non-disabled item.
5. **Given** focus on an item inside a `<form>`, **When** the user presses `Enter`, **Then** the form is not
   submitted and the item's checked state does not change (checkbox items only respond to `Space` and
   pointer activation, matching native `<input type="checkbox">` behaviour).

---

### User Story 3 - Validate the group and submit it as part of a native form (Priority: P1)

A developer places a checkbox group inside a `<form>`, marks it `required`, and optionally supplies a
validation function; an end user who submits the form without satisfying the requirement sees the group
marked invalid with an associated error message and the browser's native form submission is blocked, while
a user who submits a valid selection succeeds and each checked item's `value` is submitted under the given
field `name`.

**Why this priority**: This component is explicitly the one that establishes the project's form
conventions (hidden native inputs, `name`/`required`/`disabled` propagation, `data-invalid`,
label/description/error wiring) — later ported form components copy this pattern, so it must be correct and
fully covered now, but the group is still independently useful without validation (P1 covers select/toggle;
this adds the form-integration layer on top).

**Independent Test**: Render a group inside a `<form>` with `required` and a submit button; assert
submitting with nothing selected does not fire the form's submit handler, then select an item and assert it
does. Separately, render a group with an `onValidate` callback that rejects a specific combination and
assert the message region appears with the returned text and `data-invalid`/`aria-invalid` are set on the
group and the offending items.

**Acceptance Scenarios**:

1. **Given** a checkbox group with `required` and no item checked, inside a `<form>`, **When** the form is
   submitted, **Then** native constraint validation blocks submission.
2. **Given** the same form, **When** the user checks at least one item and submits, **Then** the form's
   submit handler runs.
3. **Given** a checkbox group with `name="tricks"` and two items checked, **When** the form is submitted,
   **Then** the submitted form data contains one entry per checked item's `value` under the field name
   `tricks`.
4. **Given** a checkbox group with an `onValidate` callback that returns an error string for a given value
   set, **When** the user's selection produces that value set, **Then** the group and its list expose
   `data-invalid`/`aria-invalid`, each item exposes `data-invalid`, and an error message region renders the
   returned text and is referenced by the group's `aria-describedby`.
5. **Given** the same invalid group, **When** the user changes the selection so `onValidate` returns
   `true`/`null`, **Then** the invalid state and message region both clear.
6. **Given** a checkbox group with `disabled`, **When** the user clicks or tabs to any item, **Then** every
   item reports itself disabled, is excluded from the tab order, and no click toggles it.
7. **Given** a checkbox group with `readOnly`, **When** the user clicks an item, **Then** the item's checked
   state and accessible state (`aria-checked`) are unchanged and `onValueChange` does not fire, but the
   items remain focusable (read-only, not disabled).

---

### Edge Cases

- A group rendered with zero items renders its label, description, and (empty) list without error.
- Rapid repeated clicks on the same item each register as exactly one toggle, and a "phantom double
  toggle" caused by event bubbling from an item's indicator into the item's own click handler must not
  occur. (Upstream defends this with a 50 ms click debounce; see Assumptions for why the port proves
  the invariant instead of reproducing the timer.)
- Resetting the enclosing native `<form>` (a `type="reset"` button) restores the group to its
  `defaultValue` and clears any active validation message, matching a native `<input type="checkbox">`'s
  reset behaviour.
- A `CheckboxGroupDescription` rendered with `hideOnError` disappears while the group is invalid and
  reappears once the group becomes valid again.
- A `CheckboxGroupMessage` with no children and no returned validation string renders nothing (there is no
  message to show) even while otherwise invalid via the `invalid` prop.
- Using `CheckboxGroupItem`, `CheckboxGroupIndicator`, `CheckboxGroupList`, `CheckboxGroupLabel`,
  `CheckboxGroupDescription`, or `CheckboxGroupMessage` outside of a `CheckboxGroupRoot` raises a clear
  error naming both the part and the required root.
- Right-to-left context (`dir="rtl"`): the group's `dir` attribute reflects the active direction and
  `orientation="horizontal"` lays items out in reading order (last item visually first), matching the
  project's existing direction-context convention; RTL does not change which key toggles an item (`Space`
  still toggles focus, arrow keys are not part of this widget's keyboard contract — see Assumptions).
- An item's `required` prop combined with the group's `required` prop: an item is only individually
  required by its own `required` prop, or when the group is `required` and the group's value is still
  empty — once any item in the group is checked, `required` no longer forces every remaining unchecked
  item's hidden input to be required (matches upstream's per-item required derivation).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST render as a compound set of parts — a root, a label, a description, a
  list, an item, an indicator, and a validation message — installable and importable together from one
  module, matching the upstream `CheckboxGroup` / `CheckboxGroupLabel` / `CheckboxGroupDescription` /
  `CheckboxGroupList` / `CheckboxGroupItem` / `CheckboxGroupIndicator` / `CheckboxGroupMessage` part names.
- **FR-002**: The root MUST support both uncontrolled (`defaultValue`, an array of checked item values) and
  controlled (`value` + `onValueChange`) operation, and MUST additionally expose `value` as a two-way
  bindable value for Svelte consumers.
- **FR-003**: The root MUST support an `onValidate` callback invoked with the next value on every change,
  whose return value determines validity: a returned string or array of strings marks the group invalid and
  becomes the message text; `true` or a nullish return marks the group valid.
- **FR-004**: The root MUST support an `invalid` prop that forces the invalid state independently of
  `onValidate`; the effective invalid state is `invalid` OR "a validation message is currently set".
- **FR-005**: The root MUST support a `disabled` prop that propagates to every item (each item is
  individually disabled when the group is disabled, in addition to its own `disabled` prop) and is
  reflected on the group as `data-disabled`.
- **FR-006**: The root MUST support a `readOnly` prop that suppresses all value changes from item
  interaction (clicks do not toggle, `onValueChange`/`onValidate` do not fire) while leaving items focusable
  and their visual/ARIA checked state unchanged from their current value.
- **FR-007**: The root MUST support a `required` prop; when set and the group's value is empty, every item
  MUST be treated as individually required for native form validation, and this requirement MUST clear as
  soon as at least one item is checked.
- **FR-008**: The root MUST support a `dir` prop (`"ltr" | "rtl"`, resolved from the project's existing
  direction context when not explicitly supplied) and reflect it as the rendered `dir` attribute.
- **FR-009**: The root MUST support an `orientation` prop (`"vertical" | "horizontal"`, default
  `"vertical"`) and expose it as `data-orientation` and `aria-orientation` on the group, and as
  `data-orientation` on the list and each item.
- **FR-010**: The root MUST expose `role="group"`, `aria-labelledby` referencing the label, `aria-describedby`
  referencing the description (and additionally the message when invalid), `aria-readonly` reflecting
  `readOnly`, `aria-invalid` and `data-invalid` reflecting the effective invalid state, and `data-readonly`
  reflecting `readOnly`.
- **FR-011**: The label part MUST render as a `<label>`-equivalent element associated with the group (not a
  single control) and expose `data-disabled` matching the group's disabled state.
- **FR-012**: The list part MUST render as a labelled container (`role="group"`) for item parts and expose
  `data-orientation`, `data-invalid` and `data-disabled` matching the group.
- **FR-013**: Each item MUST require a `value` prop identifying it within the group's value array, and MUST
  support its own `disabled` and `required` props layered on top of the group's.
- **FR-014**: Each item MUST render with `role="checkbox"`, `type="button"`, a generated `id`, `aria-checked`
  reflecting whether its `value` is present in the group's value, `aria-disabled`, `aria-invalid` (from the
  group), `aria-required` (per FR-007), and data attributes `data-state` (`"checked" | "unchecked"`),
  `data-orientation`, `data-disabled`, and `data-invalid`.
- **FR-015**: Each item MUST toggle its checked state on click (respecting `disabled` and the group's
  `readOnly`) and on `Space` while focused (native button activation); pressing `Enter` while an item has
  focus MUST NOT toggle it or submit an enclosing form, matching native `<input type="checkbox">` behaviour.
- **FR-016**: Each item MUST participate in native HTML form submission and constraint validation by
  rendering an associated hidden native checkbox input that mirrors its `checked`, `disabled`, `required`
  (per FR-007), and the group's `name`/`readOnly`, and that resets to the group's `defaultValue` when the
  enclosing form is reset.
- **FR-017**: The indicator part MUST render only while its item is checked (default) and MUST support a
  `forceMount`-equivalent option that keeps it present but visually reflects the unchecked state via
  `data-state`.
- **FR-018**: The description part MUST support an `announce` prop controlling whether it is announced
  immediately on render (`aria-live="polite"` vs `"off"`) and a `hideOnError` prop that removes it from the
  document while the group is invalid, and MUST expose `data-disabled`/`data-invalid` matching the group and
  `aria-describedby` referencing the group's label while a label is rendered (upstream parity, omitted when
  no label is registered).
- **FR-019**: The message part MUST render nothing while the group is valid; while invalid it MUST render
  the `onValidate`-supplied message (joining an array of strings with a space) or, if none was supplied, its
  own children, and MUST render no element at all when neither is present. It MUST support the same
  `announce` prop as the description and expose `data-disabled`/`data-invalid`.
- **FR-020**: The component MUST be usable in a right-to-left document (`dir="rtl"`) without breaking layout
  or keyboard order, per the project's existing direction-context convention.
- **FR-021**: The component MUST ship as source under the project's UI component directory with an index
  barrel exporting namespaced and prefixed names plus their prop types, and MUST be registered in the
  project's component registry so it is installable the same way as any other listed component.
- **FR-022**: A documentation demo page MUST exist exercising: the default example (with visible label,
  description, and custom indicator icon), the animated-indicator example, the horizontal-orientation
  example, the validation example (label, description with `hideOnError`, and message), and the
  shift-click multi-selection example — one section per upstream demo file
  (`checkbox-group{,-animated,-horizontal,-validation,-multi-selection}-demo.tsx`), mirroring them
  one-for-one.
- **FR-023**: Using `CheckboxGroupItem`, `CheckboxGroupIndicator`, `CheckboxGroupList`,
  `CheckboxGroupLabel`, `CheckboxGroupDescription`, or `CheckboxGroupMessage` outside of a
  `CheckboxGroupRoot` MUST raise a clear error naming both the part and the required root.

### Key Entities

- **Checkbox Group Root**: The compound component's state owner. Holds the checked-values array (controlled
  or uncontrolled), `disabled`, `readOnly`, `required`, `dir`, `orientation`, and the current validation
  message; computes the group's overall invalid state and generates the shared ids that link the label,
  description, and message to the group.
- **Checkbox Group Item**: A single selectable option identified by its `value`; derives its own checked
  state from membership in the root's value array and its own effective disabled/required state from the
  combination of its own props and the root's.
- **Checkbox Group Indicator**: The (optionally always-present) visual marker for an item's checked state,
  scoped to its parent item.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A keyboard-only user can reach every item in the group, toggle any of them, and submit the
  enclosing form successfully, without ever touching a pointing device.
- **SC-002**: Every prop, ARIA attribute, data attribute, and keyboard interaction documented on the
  upstream Checkbox Group page has a corresponding, passing automated test in this project.
- **SC-003**: The demo page renders all five upstream examples (default, animated indicator, horizontal
  orientation, validation, and shift-click multi-selection) — one `<ComponentPreview>` section per upstream
  demo file — and each is independently interactive without console errors.
- **SC-004**: A checkbox group placed inside a native `<form>` with `required` and/or `name` participates
  correctly in that form's submission and constraint validation with no extra developer wiring beyond the
  documented props.
- **SC-005**: A consumer of this repository's component registry can install the Checkbox Group with one
  command and use it by composing the seven exported parts, with no additional configuration beyond what
  the demo page shows.
- **SC-006**: The component reads and behaves correctly in a right-to-left document: no layout overlap and
  no broken focus order.

## Assumptions _(mandatory)_

- **`bits-ui`'s `Checkbox.Group`/`Checkbox.Root` were evaluated and rejected; the item is bespoke**
  (revised during planning after reading `bits-ui@2.18.1`'s source — supersedes the earlier assumption
  that the item would compose `Checkbox.Root`). Four capabilities the primitive lacks are load-bearing
  here: (1) the child owns `checked` and pushes it into the group, so a change cannot be vetoed — which
  `readOnly` (FR-006) and an authoritative controlled parent (US1 AS-5) both require; (2) its group
  `required` marks *every* checkbox required, where this component requires *at least one* (FR-007);
  (3) its hidden input renders only when a `name` is set, while this component needs one whenever it is
  inside a form so `required` alone blocks submission (FR-016, US3 AS-1); (4) it has no form-`reset`
  hook, no `onValidate`/`invalid`/message surface, and emits no `aria-invalid`/`data-invalid`/
  `data-orientation`. The `<button role="checkbox">` and its visually-hidden `<input type="checkbox">`
  are therefore written here (~25 lines of attributes plus the form plumbing), with the full
  primitive-by-primitive justification recorded in `plan.md`. Everything that *can* be composed is:
  direction resolution uses this repo's `useDirection()`, the group label uses `bits-ui`'s `Label.Root`,
  and the indicator glyph uses `@lucide/svelte`. Zero new npm dependencies.
- **No 50 ms click debounce**: upstream's `lastClickTimeRef` guard exists because React's synthetic
  event delegation over Radix's `Primitive` composition can deliver an indicator click twice. In Svelte
  the item's handler is one native listener on the `<button>`, so a click on the indicator bubbles to it
  as a single event and the phantom cannot occur; reproducing the window would instead swallow a genuine
  check-then-uncheck double click (millisecond-resolution timestamps make that a real failure, not a
  theoretical one). The invariant the debounce protected is asserted directly instead: one toggle per
  click, including clicks that land on the indicator.
- **Item content model — `children` is the label, `indicator` is a snippet**: upstream ships two
  incompatible content models (its package test puts the item's text *inside* the button; its shadcn
  registry item puts the text outside, in a wrapping `<label>`, leaving the `<button>` with no accessible
  name, since HTML-AAM names a `button` from its subtree and not from a wrapping label). This port takes
  one model: the item's `children` render inside the button (so the accessible name comes from content),
  beside a `[data-slot="checkbox-group-item-box"]` element whose contents come from an optional
  `indicator` snippet defaulting to `<CheckboxGroup.Indicator />`. Consumer markup is therefore identical
  to the upstream registry demos (`<CheckboxGroupItem value="indy">Indy</CheckboxGroupItem>`), the
  `Indicator` part keeps its documented `forceMount`/`data-state` contract, and no control-less `<label>`
  is authored (which `svelte-check` would flag `a11y_label_has_associated_control` — unsuppressable).
- **`name` is accepted on the root as well as on each item**: upstream reads `name` only from the item's
  own props, while FR-016 and US3 AS-3 describe a group-level `name`. The port supports both, with the
  item's own `name` winning (`item.name ?? group.name`) — a strict superset that leaves upstream-shaped
  code working.
- **`aria-labelledby`/`aria-describedby` never dangle**: upstream emits
  `aria-describedby="<descriptionId> "` unconditionally, which points at a missing element whenever no
  description is rendered — including the moment `hideOnError` removes it. Here, the label, description
  and message register their ids while they are actually rendered, and the root derives both attributes
  from those registrations, omitting them entirely when nothing is registered.
- **Controlled mode is expressed by binding**: `bind:value` gives a parent that accepts every change;
  Svelte's function binding `bind:value={() => value, (next) => …}` gives the authoritative parent of
  US1 AS-5 — the root keeps no shadow copy of `value`, so a setter that declines the write leaves the
  rendered state untouched. Passing `value` unbound (with `onValueChange`) seeds the value and then
  self-updates, because a Svelte `$bindable` prop cannot detect whether it was bound; this is documented
  on the demo page and in the barrel's JSDoc.
- **The animated example is included**: the constitution binds demo sections to upstream demo *files*,
  of which there are five. Upstream's animated indicator asks consumers to add a `stroke-dashoffset`
  keyframe to `tailwind.config.ts` (a Tailwind v3 instruction); the port keeps the equivalent keyframes
  in the demo page's scoped `<style>` block rather than in the project's global `src/app.css`, so nothing
  is added to the registry payload or the shared theme.
- **`onValueChange` keeps its name and gains a bindable `value`**: per CLAUDE.md §10's rule for
  `onValueChange`-style callbacks, `value` becomes `$bindable`, and `onValueChange` still fires on every
  change so existing upstream-style consumers translate directly. `onValidate` keeps its exact upstream
  name and signature (`(value: string[]) => string | string[] | true | null | undefined`).
- **`asChild` is out of scope for this port**: upstream's `checkbox-group` package (unlike some other
  ported components) does not expose `asChild`/`Slot` polymorphism on any of its parts in the read source,
  so no `child`-snippet equivalent is added; every part renders its own fixed element.
- **The shift-click multi-selection example is application-level, not a component prop**: upstream's
  `checkbox-group-multi-selection-demo.tsx` implements shift-range-select entirely with a local
  `useShiftMultiSelect` hook layered on top of the group's plain `value`/`onValueChange` — the
  `CheckboxGroup` component itself has no shift-select-specific prop or callback. This port reproduces the
  same pattern as page-level logic in the demo route (a `.svelte.ts` helper, not a change to the
  component's public API), matching upstream's own scope boundary.
- **Keyboard contract is Tab + Space only**: neither the upstream MDX keyboard table nor the source wires
  arrow-key roving between items — each `CheckboxGroupItem` is an independent tab stop, exactly like a set
  of native `<input type="checkbox">` elements. This is intentional (distinguishing it from `RadioGroup`,
  which does roving-tabindex single-selection) and is not treated as a gap to fill.
- **Validation surfaces through the project's existing `data-invalid`/`aria-invalid` form convention**: per
  `.agents/skills/shadcn-svelte/rules/forms.md`, invalid state is exposed as both `data-invalid` (styling
  hook for labels/descriptions) and `aria-invalid`/`disabled` (control-level). This component is the first
  to establish that pattern for a compound, multi-control field; later form ports (`RadioGroup`-alikes,
  custom inputs) follow the same convention this port sets.
- **RTL**: the project's existing direction context (already used by other ported components, e.g. the
  `direction-provider`) supplies the resolved `dir` when the root does not receive an explicit `dir` prop,
  matching upstream's `useDirection` behaviour; no additional mirroring logic is added beyond what that
  shared context already provides.
- **Attribute superset over upstream (recorded per Principle II)**: four attributes are emitted that
  upstream does not, each justified and each covered by an assertion — `aria-invalid` and `data-readonly`
  on the root (upstream surfaces invalid only as `data-invalid` and read-only only as `aria-readonly`, so
  neither state is exposed consistently with this project's dual `data-invalid`/`aria-invalid` form
  convention), `data-disabled` on the list (Principle VIII: every piece of state is exposed as a `data-*`
  hook on every part), and `aria-required` on each item (upstream exposes required only through the
  `aria-hidden` hidden input, so the requirement is never announced). No upstream attribute is dropped.
- **An empty message renders no element**: upstream returns its `<div>` whenever the group is invalid, even
  with no validation message and no children, leaving an empty element that the root's `aria-describedby`
  still references. Here the part renders nothing unless it has content, and the root omits `messageId`
  from `aria-describedby` while it is unrendered — the same no-dangling-idref rule already applied to the
  description.
- **The hidden input is value-mirrored, not click-re-dispatched**: upstream's item re-dispatches its click
  onto the hidden input via a `VisuallyHiddenInput` (`control`/`bubbles`) and calls `event.stopPropagation()`
  inside a form so exactly one native event reaches the form per interaction. This port instead binds the
  hidden input's `checked` directly to the item's derived state — no click re-dispatch, no
  `stopPropagation`. FR-016's native form participation therefore rests entirely on constraint validation
  (`required`/`checkValidity`) and `FormData` serialization of the mirrored `checked`/`name`/`value`, not on
  any event bubbling from the hidden input; nothing here depends on the hidden input ever receiving its own
  `click`/`change` event.
