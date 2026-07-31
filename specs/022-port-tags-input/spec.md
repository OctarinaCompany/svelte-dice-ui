# Feature Specification: Port Tags Input

**Feature Branch**: `022-port-tags-input`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Tags Input\" (slug: tags-input) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Type and remove tags with the keyboard (Priority: P1)

A person filling in a form types a value, presses `Enter` to turn it into a tag, and keeps typing more
values the same way. They can also remove the tag they just added, or any earlier one, without touching
the mouse.

**Why this priority**: Turning free text into discrete, removable tags via the keyboard is the entire
reason this component exists; without it, this is just a text input.

**Independent Test**: Render the component standalone with an empty, uncontrolled value, type text and
press `Enter`, and confirm a tag appears and the input clears. Then press `Backspace` twice from an empty
input (once to highlight the last tag, once more to remove it) and confirm the tag disappears and focus
returns to the input.

**Acceptance Scenarios**:

1. **Given** an empty, uncontrolled tags input, **When** the user types text and presses `Enter`, **Then**
   a new tag is appended to the value, the input is cleared, and no tag is left highlighted.
2. **Given** a tags input with existing tags and an empty, caret-at-start input, **When** the user presses
   `Backspace`, **Then** the last tag becomes highlighted (not yet removed); pressing `Backspace` or
   `Delete` again removes it and returns focus to the input.
3. **Given** a highlighted tag, **When** the user presses `ArrowLeft`/`ArrowRight` (or `ArrowRight`/
   `ArrowLeft` under `dir="rtl"`), **Then** the highlight moves to the previous/next tag; from the first
   tag, moving further clears the highlight and returns the caret to the input.
4. **Given** a highlighted tag, **When** the user presses `Home` or `End`, **Then** the highlight jumps to
   the first or last tag respectively, and pressing `Escape` clears the highlight and resets the caret to
   the start of the input.

---

### User Story 2 - Delete tags and clear the whole list by pointer (Priority: P1)

A person using a mouse or touch clicks a tag's delete button to remove just that tag, or clicks a "clear"
button to remove every tag at once.

**Why this priority**: Pointer-driven removal is the other half of the component's documented API
(`TagsInput.ItemDelete`, `TagsInput.Clear`) and is used in every upstream example; without it the
component only serves keyboard-only users.

**Independent Test**: Render the component with two pre-populated tags, click the delete button on one
tag, and confirm only that tag is removed. Then click the clear button and confirm the list empties and
`onValueChange` is called with `[]`.

**Acceptance Scenarios**:

1. **Given** a tag with a delete button, **When** the user clicks it, **Then** that tag is removed from
   the value, regardless of whether it was highlighted, and focus is not required to move to it first.
2. **Given** a non-empty tags input, **When** the user clicks the clear button, **Then** every tag is
   removed in one update and focus moves to the text input.
3. **Given** an empty tags input, **When** rendered without `forceMount`, **Then** the clear button is not
   present in the accessibility tree (it only appears once at least one tag exists).

---

### User Story 3 - Validate, deduplicate, and cap tags as they're added (Priority: P2)

A person adding tags is prevented from creating a duplicate of an existing tag or exceeding a maximum
count, and a caller-supplied validation rule (e.g. minimum length, forbidden words) blocks tags that don't
qualify, with a hook the consumer can use to surface feedback (e.g. a toast).

**Why this priority**: This is the documented "With Validation" example and a common real-world
requirement, but the component is fully usable for simple tag entry without it, so it ranks below the two
core interaction flows above.

**Independent Test**: Render the component with `max={2}` and an `onValidate` rejecting short strings,
`defaultValue={['a']}`. Attempt to add a duplicate of `'a'`, a value shorter than the validation rule, and
enough values to exceed `max`; confirm each is rejected and `onInvalid` fires with the offending value.

**Acceptance Scenarios**:

1. **Given** an existing tag `"a"`, **When** the user tries to add `"a"` again, **Then** the duplicate is
   rejected, `onInvalid` fires with `"a"`, and the tags input is marked invalid.
2. **Given** an `onValidate` callback that returns `false` for a given value, **When** the user tries to
   add that value, **Then** it is rejected the same way (invalid state + `onInvalid`) and not added.
3. **Given** `max={2}` and two existing tags, **When** the user tries to add a third, **Then** it is
   rejected and `onInvalid` fires, without needing `onValidate` to reject it.
4. **Given** `addOnPaste` is enabled, **When** the user pastes text containing the configured `delimiter`,
   **Then** the pasted text is split on that delimiter, trimmed, deduplicated against both itself and the
   existing value, filtered through `onValidate`, and every surviving value is added in one update
   (`onInvalid` fires once per rejected duplicate, and is not called for values `onValidate` rejects). A
   pasted batch that would exceed `max` is rejected in full — nothing is added and `onInvalid` fires once
   with the raw, untrimmed pasted text.

---

### User Story 4 - Edit an existing tag in place (Priority: P3)

A person who made a typo in an already-added tag double-clicks it (or highlights it and presses `Enter`)
to turn it into an editable text field, corrects the text, and confirms with `Enter` or discards with
`Escape`.

**Why this priority**: In-place editing (`editable`) is an explicitly opt-in, documented capability (the
"Editable" example), but it is not required for the component's baseline add/remove value proposition, so
it ranks last.

**Independent Test**: Render the component with `editable` and one pre-populated tag, double-click the
tag, confirm an editable text field appears pre-filled with the tag's text, change the text, press
`Enter`, and confirm the value updates.

**Acceptance Scenarios**:

1. **Given** `editable` is set and a tag is not disabled, **When** the user double-clicks it (or
   highlights it and presses `Enter`), **Then** the tag's text is replaced with an inline text field
   pre-filled with the tag's current text and focused with its content selected.
2. **Given** an active edit field, **When** the user changes the text and presses `Enter`, **Then** the
   edited value replaces the tag's value (subject to the same duplicate/validation rules as adding a new
   tag), the field closes, and the tag becomes highlighted again.
3. **Given** an active edit field, **When** the user presses `Escape`, **Then** the edit is discarded, the
   field closes showing the original text, the tag becomes highlighted, and focus returns to the text
   input.
4. **Given** `editable` is not set (the default), **When** the user double-clicks a tag, **Then** nothing
   happens — no edit field appears.

---

### Edge Cases

- Typing a character while a tag is highlighted clears the highlight (typing resumes normal text entry
  in the input rather than acting on the highlighted tag).
- Pressing `ArrowLeft`/`ArrowRight` while the input's caret is not at position 0 has no effect on
  highlighting — arrow-key tag navigation only engages when the caret is at the very start of the input
  text.
- With no tags in the list, `Backspace`/`Delete`/`ArrowLeft`/`Home`/`End` have no effect (there is nothing
  to highlight).
- `loop` set to `true` wraps navigation from the last tag back to the first (and vice versa) instead of
  stopping; the default (`false`) stops at the boundary and returns focus to the input.
- `blurBehavior` is unset by default: leaving the input with unsubmitted text neither adds nor clears it —
  the typed text simply stays in the input. `blurBehavior="add"` commits it as a new tag on blur (subject
  to the same validation as `Enter`); `blurBehavior="clear"` discards it.
- `disabled` suppresses every interaction (typing, deleting, clearing, editing) and is reflected as an
  inert, non-interactive state on the root, the input, every delete button, and the clear button.
- `readOnly` allows the input to be focused and its existing text selected, but suppresses adding,
  removing, and clearing tags; it is reflected as `data-readonly` on the root, matching upstream's
  `[data-readonly]` documentation.
- A caller-supplied `displayValue` function controls only what is rendered for a tag; the underlying value
  used for equality checks (duplicates, controlled `value`) remains the raw, untransformed value.
- Rendering `TagsInput.Input`, `TagsInput.Item`, `TagsInput.ItemText`, `TagsInput.ItemDelete`, or
  `TagsInput.Clear` outside a `TagsInput.Root` ancestor throws a descriptive error naming the missing part
  and the required ancestor.
- Submitting the enclosing `<form>` includes every tag value under `name` via a hidden, form-associated
  input; a `required` tags input with zero tags fails native form validation the same way an empty
  required text input would.
- With `dir="rtl"`, `ArrowLeft`/`ArrowRight` invert (left moves toward the end of the list, right moves
  toward the start), matching upstream's `dir`-aware key mapping.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST be usable as a compound API composed of a root, an optional label, one
  item per tag (with a text part and a delete-button part), a text input for adding new tags, and an
  optional clear-all button — matching upstream's `TagsInput` / `TagsInputLabel` / `TagsInputItem` /
  `TagsInputItemText` / `TagsInputItemDelete` / `TagsInputInput` / `TagsInputClear` composition.
- **FR-002**: The root MUST support both uncontrolled (`defaultValue`) and controlled (`value` +
  `onValueChange`) usage of the tag list, following this project's `$bindable` convention.
- **FR-003**: Pressing `Enter` in the input with non-empty text, or triggering the equivalent
  delimiter-on-type behaviour, MUST add a new tag: the value is checked against the max count, trimmed,
  checked against a caller-supplied `onValidate` predicate, checked for a duplicate in the existing value,
  and — only once all checks pass — appended to the value while the input is cleared. Any failed check
  MUST call `onInvalid` without adding the tag; the `onValidate` and duplicate rejections MUST additionally
  mark the tags input as invalid, while the max-count rejection MUST call `onInvalid` with the untrimmed
  text and MUST NOT set the invalid state (upstream parity — the cap is a capacity limit, not an
  input-validity failure). A duplicate hit still clears the input the same way upstream does, without
  adding it twice.
- **FR-004**: The root MUST accept a `max` prop capping the number of tags (default: unlimited); attempts
  to add a tag once the cap is reached MUST be rejected via `onInvalid`, called with the untrimmed text,
  without setting the invalid state (FR-003).
- **FR-005**: The root MUST accept an `addOnPaste` prop (default `false`); when enabled, pasting text into
  the input MUST split it on `delimiter` (default `","`), trim and deduplicate each candidate against both
  the pasted batch and the existing value, filter the survivors through `onValidate`, and add all
  surviving values in a single value update, without ever falling back to the browser's native paste
  insertion.
- **FR-006**: The root MUST accept an `addOnTab` prop (default `false`); when enabled and the input has
  text, pressing `Tab` MUST add the current input text as a tag (same validation path as `Enter`) instead
  of moving focus; when disabled, `Tab` MUST move focus normally.
- **FR-007**: The root MUST accept a `blurBehavior` prop (`"add"` | `"clear"` | unset); on input blur,
  `"add"` commits the current input text as a new tag (same validation as `Enter`), `"clear"` discards the
  input text, and the unset default leaves the input text untouched.
- **FR-008**: The component MUST support full keyboard tag navigation and removal from the input exactly
  as upstream documents: `ArrowLeft`/`ArrowRight` (inverted under `dir="rtl"`) move the highlight between
  tags only when the input's caret is at position 0, wrapping when `loop` is enabled; `Home`/`End` jump to
  the first/last tag; `Backspace`/`Delete` on a highlighted tag remove it and move the highlight to the
  adjacent tag (or clear it and focus the input when none remains); a caret-position-0 `Backspace` with no
  highlighted tag highlights the last tag without removing it; `Escape` clears any highlight/edit state
  and resets the input's caret to position 0; typing a character clears any active highlight.
- **FR-009**: The root MUST accept an `editable` prop (default `false`). When set, double-clicking a
  non-disabled tag, or pressing `Enter` while it is highlighted, MUST enter edit mode: the tag's text is
  replaced by a focused, content-selected text field pre-filled with its current value. Confirming with
  `Enter` MUST validate and commit the new value through the same duplicate/`onValidate`/`onInvalid` path
  as adding a tag; `Escape` or blurring the field MUST discard the edit, restore the original text, and
  return the tag to a highlighted (not editing) state.
- **FR-010**: Each tag item MUST expose a per-item `disabled` prop (in addition to the root's `disabled`)
  that independently suppresses that tag's selection, editing, and delete-button interaction while leaving
  the rest of the list interactive.
- **FR-011**: The delete-button part MUST remove its associated tag when activated, MUST be omitted from
  the render output while its tag is in edit mode, and MUST report its highlighted/disabled state via the
  documented data attributes.
- **FR-012**: The clear-all part MUST remove every tag in one update and return focus to the text input
  when activated, MUST be disabled (and inert) whenever the root is disabled, and MUST support a
  `forceMount` prop that keeps it present even when the tag list is empty (default: hidden when empty).
- **FR-013**: The root MUST accept a `displayValue` function (default: identity/`toString`) used to render
  each tag's text and to pre-fill its edit field, without affecting the raw value used for equality checks
  (duplicates, controlled `value`).
- **FR-014**: The root MUST accept `disabled` and `readOnly` props. `disabled` MUST suppress all
  interaction (typing, add, remove, clear, edit) across every part and MUST be reflected as
  `data-disabled` on the root, the input, item(s), the delete button(s), and the clear button, using this
  project's presence-based (`? '' : undefined`) convention. `readOnly` MUST allow focus and text selection
  on the input while suppressing add/remove/clear/edit, and MUST be reflected as `data-readonly` on the
  root and `aria-readonly` on the input.
- **FR-015**: The root MUST reflect an invalid-input state (set whenever the most recent add/edit attempt
  was rejected by `onValidate` or by the duplicate check — not by the max cap, and never by the paste path
  — and cleared on the next successful add/edit) as `data-invalid` on the root and on the text input.
- **FR-016**: The component MUST submit the current tag list through a visually-hidden, form-associated
  input carrying `name` (when supplied), `disabled`, and `required`, so native and library form handling
  observes the value and native `required` validation blocks submission of an empty, required tag list —
  without requiring the visible text input to carry `name` itself.
- **FR-017**: Rendering `TagsInput.Input`, `TagsInput.Item`, `TagsInput.ItemText`, `TagsInput.ItemDelete`,
  or `TagsInput.Clear` outside a `TagsInput.Root` ancestor MUST throw an error identifying both the part
  and the required ancestor.
- **FR-018**: The component MUST render correctly under `dir="rtl"`: the keyboard-navigation direction
  inverts per FR-008, and part layout follows logical (start/end) flow rather than a fixed
  left-to-right assumption.
- **FR-020**: Clicking the root's empty area (anywhere inside the root that is not a tag or the text
  input) MUST move focus to the text input without the root itself taking focus, and moving focus outside
  the root entirely MUST clear any tag highlight.
- **FR-019**: The component MUST ship as an installable registry item under the project's UI component
  directory with a public barrel export, and a documentation page MUST demonstrate every example shown on
  the upstream docs page: the default/basic layout, the editable example, the validation example, and (per
  the Assumptions section) the sortable-composition example adapted to this project's existing primitives.

### Key Entities

- **Tag value**: One entry in the tags input's value array — an opaque string the root tracks by
  reference/equality; display text is derived from it via `displayValue` but equality checks always use
  the raw value.
- **Highlighted index**: The single tag (if any) currently selected via keyboard or pointer navigation,
  distinct from edit mode; navigating, adding, removing, or activating edit mode all update or clear it.
- **Editing index**: The single tag (if any) currently rendered as an inline editable field, mutually
  exclusive with plain highlighting for that tag (a tag being edited is not shown as merely highlighted).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A person can add, navigate, and remove tags using only the keyboard — `Enter` to add,
  `ArrowLeft`/`ArrowRight`/`Home`/`End` to navigate, `Backspace`/`Delete` to remove — with zero pointer
  interaction required.
- **SC-002**: Pasting a comma-separated (or custom-delimiter) block of text with `addOnPaste` enabled adds
  every valid, non-duplicate value from that block in a single interaction, with zero values lost that
  should have been added and zero duplicates introduced.
- **SC-003**: Attempting to add a duplicate, an over-the-cap, or a caller-rejected value never mutates the
  tag list and always surfaces the same observable invalid-state signal (`onInvalid` + `data-invalid`),
  in 100% of rejected attempts.
- **SC-004**: The component passes an automated accessibility and keyboard-interaction test suite that
  covers every interaction listed in the Requirements section, with zero regressions against the upstream
  component's documented behaviour.
- **SC-005**: The demo page documents every prop of all six parts (`TagsInput`, `TagsInputLabel`,
  `TagsInputItem`, `TagsInputItemText`, `TagsInputItemDelete`, `TagsInputInput`, `TagsInputClear`), so a
  developer already familiar with the upstream Dice UI `TagsInput` can compose the Svelte version
  correctly using only this project's documentation page.

## Assumptions _(mandatory)_

- Both upstream sources are ported as the union described in the component-specific guidance: the
  standalone package (`.reference/diceui/packages/tags-input`) supplies the fuller behaviour set —
  keyboard editing (`editable`), paste splitting (`addOnPaste`), duplicate/max handling, and blur
  behaviour (`blurBehavior`) — while the registry component
  (`.reference/diceui/docs/registry/bases/radix/ui/tags-input.tsx`) supplies the styled composition
  (`TagsInputList` wrapper, default classes, icon-based delete/clear buttons) that this port's default
  demo styling follows, adapted to this project's semantic tokens per CLAUDE.md §6.
- `TagsInputList` (a plain styled `<div>` wrapper around the items and input in the registry component) is
  not ported as its own named part with a barrel export, because it carries no state or behaviour of its
  own — any consumer can reproduce it with a plain `<div>` — but the demo page reproduces its layout
  (wrapping) classes inline, matching upstream's visual structure.
- Only the `radix` upstream base variant is ported (both `packages/tags-input` and
  `docs/registry/bases/radix/ui/tags-input.tsx` are Radix-family sources), consistent with this project's
  established pattern of porting the Radix-based upstream variant, since the project's existing
  primitives are built on `bits-ui` (the same primitive family). No `base` (non-Radix) variant of
  `tags-input` exists upstream to consider.
- Upstream's `@diceui/shared` collection/context/controllable-state/direction/form-control helpers
  (`createContext`, `useControllableState`, `useDirection`, `useFormControl`, `useItemCollection`,
  `VisuallyHiddenInput`, `composeEventHandlers`, `useComposedRefs`) have no 1:1 Svelte equivalent and are
  re-expressed using this project's established conventions per CLAUDE.md §10: a `TagsInputState` class in
  `tags-input.svelte.ts` (holding highlighted/editing index, invalid-input flag, and the add/remove/update
  logic), a `Symbol`-keyed context (§5), `$bindable` props for `ref`/`value`, and a hidden form-associated
  input reused/adapted from whatever pattern the project's other form-integrated components (e.g.
  `checkbox-group`, `segmented-input`) already established. `getEnabledItems`/item-collection tracking
  (needed to skip per-item-`disabled` tags during keyboard navigation) is re-implemented directly in the
  state class over the root's own tag list rather than a generic DOM-collection abstraction, since the
  tags input's "items" are exactly its value array — a simpler, equivalent substitute with no behavioural
  loss.
- The root's upstream `children` prop, which may be a function receiving `{ value }` (a React
  render-prop pattern used so consumers can `.map()` the current value into `TagsInput.Item`s without
  their own state subscription), is exposed as a plain `Snippet` in this port. Svelte's reactivity means a
  consumer's own `{#each value as tag}` inside a normal `children` snippet already re-renders on every
  value change without needing the value threaded through a render-prop — the render-prop's only purpose
  in React. No behaviour is lost: the demo page and tests build the item list the idiomatic Svelte way
  (mapping over `bind:value` in the consumer), matching how every other list-shaped ported component in
  this project (e.g. `checkbox-group`) already composes its items.
- The "With Sortable" example (composing `TagsInput` with upstream's separate `Sortable` component) is
  documented on the demo page using this project's own drag/reorder-capable primitive if one already
  exists under `src/lib/components/ui/`; if none exists, the example is reproduced using simple pointer
  up/down reordering composed directly with `TagsInput.Item`, since porting an entire second component
  (`Sortable`) is out of scope for this feature and only the demonstrated composition pattern, not a new
  dependency, is required for documentation parity (FR-019).
- Upstream's `useId`-generated `id`/`inputId`/`labelId`/per-item `id`/`textId` are reproduced using
  Svelte's `$props.id()` per this project's translation table (CLAUDE.md §10), keeping the same
  `aria-labelledby`/`htmlFor` wiring documented upstream.
- The invalid-input state (`isInvalidInput` upstream) is a transient flag cleared on the next successful
  add/edit, not a persistent validity model; this matches upstream's own `useState<boolean>` behaviour and
  introduces no new validation semantics beyond what `onValidate`/`max`/duplicate-checking already define.
- Every `dark:`-prefixed and raw-palette class in the upstream registry component's default styling
  (`zinc-*`, `border-zinc-950`, etc.) is replaced with this project's semantic tokens per CLAUDE.md §6
  (e.g. `bg-accent`/`text-accent-foreground` for the highlighted-tag state, `ring-ring` for focus rings),
  since the tokens already flip for dark mode and raw palette colours are disallowed.
- Upstream's `TagsInputInput` emits `aria-labelledby={labelId}` unconditionally. This port emits it only
  while a `<TagsInput.Label>` is mounted (the Label registers itself with the root through
  `registerLabel()`, the pattern `checkbox-group` already established). Unconditionally pointing at an id
  that is absent from the document empties the input's accessible name and shadows any `aria-label` the
  caller supplies. Replaces upstream's static `aria-labelledby` on `TagsInputInput` (plan.md divergence D-6).
- Upstream associates the value with a form through `VisuallyHiddenInput type="hidden"`. This port renders
  a clipped `<input type="text" data-slot="tags-input-form-input">` instead, matching `checkbox-group`,
  because `type="hidden"` inputs are excluded from native constraint validation and FR-016's `required`
  block would otherwise be unreachable. Replaces upstream's `VisuallyHiddenInput` (plan.md divergence D-7).
- Upstream's `onItemUpdate` writes `displayValue(trimmedValue)` back into the value array when an edit is
  committed. This port stores the raw trimmed value, so `displayValue` stays render-only as FR-013 and the
  Edge Cases section require. Replaces upstream's `onItemUpdate` write-back (plan.md divergence D-3).
- Upstream's `TagsInputItem` distinguishes pointer type — it highlights on `click` for touch/pen and on
  `pointerup` for mouse. This port unifies both into a single `onpointerup` handler, since Svelte's pointer
  events already normalise touch/pen/mouse and the root's `onmousedown` `preventDefault()` (needed so the
  root never steals focus from the input) would otherwise race a separate `onclick`/`onmousedown` pair on
  the item. Replaces upstream's split `onclick`/`onpointerup` handling on `TagsInputItem`.
