# Feature Specification: Key Value

**Feature Branch**: `024-port-key-value`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Key Value\" (slug: key-value) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Build a list of key-value pairs (Priority: P1)

A person filling out a form (for example, environment variables for a project) needs to enter an
arbitrary number of key/value pairs: type a key, type its value, add another row when they need
one, and remove a row they no longer need.

**Why this priority**: This is the entire reason the component exists. Without add/remove/edit of
rows, there is no usable widget.

**Independent Test**: Render the component with one empty row. Type a key and a value into that
row, click "Add" to create a second empty row, fill it in, then click "Remove" on the first row.
The list ends up with exactly the second row's data and delivers value on its own with no other
feature enabled.

**Acceptance Scenarios**:

1. **Given** a freshly rendered list with one empty row, **When** the user types into the key
   field and the value field of that row, **Then** the row's key and value reflect what was typed
   and no other row is affected.
2. **Given** a list with one row, **When** the user activates the add control, **Then** a new
   empty row is appended to the end of the list and receives keyboard focus on its key field.
3. **Given** a list with two or more rows, **When** the user activates the remove control on a
   row, **Then** that row disappears from the list, the remaining rows keep their own data, and
   focus moves to a sensible neighboring control (the next row's key field, or the previous row's
   if the removed row was last).
4. **Given** a list at its configured minimum number of rows, **When** the user activates the
   remove control on the last remaining row, **Then** the row is not removed and the control is
   disabled/inert.
5. **Given** a list at its configured maximum number of rows, **When** the user activates the add
   control, **Then** no new row is added and the control is disabled/inert.

---

### User Story 2 - Paste multiple pairs at once (Priority: P2)

A person who already has a block of `KEY=VALUE` lines (for example copied from a `.env` file, a
YAML mapping, or a spreadsheet) wants to paste the whole block into one field and have it expand
into one row per line, instead of typing every pair by hand.

**Why this priority**: This is the feature upstream calls out as a headline capability and the one
most likely to save real time for the component's primary audience (developers entering
configuration data), but the component is fully usable for small lists without it.

**Independent Test**: Render the component with a single empty row, paste a multi-line block of
`KEY=VALUE` text into the key field, and confirm the list now contains one row per line with keys
and values split correctly, and that pasting a single-line value behaves like a normal paste (no
row splitting).

**Acceptance Scenarios**:

1. **Given** an empty row, **When** the user pastes a multi-line block where every line is
   `KEY=VALUE`, **Then** the empty row is replaced by one row per line, each with the key before
   `=` and the value after it.
2. **Given** an empty row, **When** the user pastes a multi-line block using `KEY: VALUE` or
   tab/multi-space-separated `KEY␣␣VALUE` formatting, **Then** the same one-row-per-line splitting
   occurs using that line's format.
3. **Given** a row that already has a key and/or value typed into it, **When** the user pastes a
   multi-line block into its key field, **Then** the existing row is preserved and the parsed rows
   are inserted immediately after it (not replacing it).
4. **Given** pasted content that would produce more rows than the configured maximum, **When** the
   paste is applied, **Then** only enough rows to reach the maximum are added and the rest of the
   pasted content is discarded.
5. **Given** a single-line clipboard value (no line breaks), **When** the user pastes it into a
   key or value field, **Then** it is inserted as ordinary text with no row splitting.
6. **Given** paste support has been turned off for the list, **When** the user pastes any content,
   **Then** the paste is treated as ordinary text entry with no row splitting.

---

### User Story 3 - Validate keys and values as the user types (Priority: P2)

A person configuring the list wants immediate feedback when a key or value does not meet the
rules for this particular list (for example, keys must be uppercase identifiers, or a value must
be at least a certain length), and wants duplicate keys flagged automatically.

**Why this priority**: Validation is what makes the component safe to use for data that will be
submitted somewhere; it is one tier below the raw add/remove/edit capability but is exercised on
every documented example that isn't the bare minimum.

**Independent Test**: Configure the list with a key-format rule and duplicate-key detection, type
an invalid key into a row, and confirm an inline error appears next to that row without affecting
other rows; then fix the key so it duplicates another row's key and confirm the duplicate error
appears instead.

**Acceptance Scenarios**:

1. **Given** a key-validation rule is configured, **When** the user types a key that fails the
   rule, **Then** an error message associated with that row's key field is shown and the field is
   marked invalid for assistive technology.
2. **Given** a value-validation rule is configured, **When** the user types a value that fails the
   rule, **Then** an error message associated with that row's value field is shown and the field is
   marked invalid, independently of whether the key in the same row is valid.
3. **Given** duplicate-key detection is enabled (the default) and two rows end up with the same
   non-empty key, **When** the second occurrence is typed, **Then** that row's key field shows a
   duplicate-key error.
4. **Given** duplicate-key detection has been explicitly disabled for the list, **When** two rows
   end up with the same key, **Then** no duplicate-key error is shown.
5. **Given** any row in the list currently has a validation error, **When** the list's overall
   validity is inspected, **Then** the list as a whole is marked invalid; once every error clears,
   the list is marked valid again.

---

### Edge Cases

- An empty key on a row is never flagged as a duplicate against another empty key on a different
  row — only non-empty keys collide.
- Removing a row clears any validation error recorded against that row so a stale error cannot
  reappear for a different row that later reuses focus.
- When the list is `disabled` or `readOnly`, none of add, remove, key edit, value edit, or paste
  is available, but the current values remain visible.
- When neither `value` nor `defaultValue` is supplied, exactly one empty row is seeded automatically
  so there is always something to type into; an explicitly empty `defaultValue` (`[]`) is honored as
  zero rows and is not re-seeded.
- Switching from uncontrolled to controlled usage (a caller starts passing a `value`) makes the
  caller's value authoritative from that point on, matching every other controlled/uncontrolled
  ported component in this project.
- In a right-to-left layout, row contents (key field, value field, remove button) read in
  mirrored order and the add control remains reachable in the same relative position as in a
  left-to-right layout.
- The list participates in native HTML forms: its current value is submitted under the field's
  `name` even though the visible controls are not native form fields themselves.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST render a list of rows, each holding one key and one value, and
  MUST support both an uncontrolled mode (seeded from an initial list of rows, or a single empty
  row when none is given) and a controlled mode (the caller supplies the current list of rows and
  is notified of every change).
- **FR-002**: Users MUST be able to add a new, empty row to the end of the list, and newly added
  rows MUST receive keyboard focus on their key field.
- **FR-003**: Users MUST be able to remove any row from the list, except that removal MUST be
  refused once the list is at its configured minimum row count (default: zero, i.e. no minimum is
  enforced by default).
- **FR-004**: The component MUST support a configured maximum row count; once reached, the add
  control MUST become unavailable and any paste that would exceed the maximum MUST be truncated to
  fit exactly the maximum.
- **FR-005**: Users MUST be able to edit the key and the value of any row independently through
  dedicated inputs, with each edit reflected immediately in that row's data and, when trimming is
  enabled (the default), leading/trailing whitespace removed from the stored value.
- **FR-006**: When paste support is enabled (the default), pasting multi-line clipboard content
  into a key field MUST be parsed into one row per non-blank line, recognizing `KEY=VALUE`,
  `KEY: VALUE`, and tab/multi-space-separated `KEY␣␣VALUE` formats (in that priority order per
  line), with surrounding quote characters optionally stripped from the parsed value when
  quote-stripping is enabled (the default). Single-line paste content MUST be inserted as ordinary
  text.
- **FR-007**: The component MUST support an optional per-row key validator and an optional
  per-row value validator, each re-evaluated on every relevant edit, whose returned message MUST
  be displayed next to the corresponding field and MUST mark that field invalid for assistive
  technology until the message clears.
- **FR-008**: The component MUST detect duplicate non-empty keys across rows by default and
  surface a duplicate-key error on the row containing the later occurrence; this detection MUST be
  possible to turn off for lists that intentionally allow repeated keys.
- **FR-009**: The component MUST expose an overall invalid state (true whenever any row currently
  has an error) in addition to each row's own error state.
- **FR-010**: The component MUST support `disabled` and `readOnly` states, at both the list level
  and (by inheriting from the list unless overridden) the level of an individual field or button,
  which suppress add, remove, and edit interactions while still displaying current values.
- **FR-011**: The component MUST support a `required` state that marks its fields and its
  submitted form value as required, for use inside native HTML forms and form-validation
  libraries.
- **FR-012**: The component MUST participate in native HTML form submission: when rendered inside
  a `<form>` (directly or via a `form` association) and given a field name, its current list of
  rows MUST be included in the submitted form data under that name; when rendered outside any
  form, no such hidden field is required.
- **FR-013**: The component MUST support a horizontal and a vertical row layout, exposed as an
  explicit orientation setting on the list, and both orientations MUST be usable with keyboard
  navigation and screen readers.
- **FR-014**: The component MUST support right-to-left rendering: row content order mirrors, and
  none of the component's own logic (paste parsing, validation, add/remove) depends on visual
  direction.
- **FR-015**: The component MUST allow every one of its parts (list container, row, key field,
  value field, remove control, add control, error message) to receive caller-supplied styling
  without breaking the built-in behaviour of that part, matching the composition patterns already
  used by every other ported component in this project.
- **FR-016**: Every part of the component (row list, row, key field, value field, remove control, add
  control, error message) MUST throw a clear, developer-facing error identifying both itself and
  its required ancestor when rendered outside that ancestor.
- **FR-017**: Placeholder text for the key field and the value field MUST each be independently
  configurable at the list level, with documented defaults ("Key" and "Value").
- **FR-018**: The value field MUST support multi-line input that grows with its content, with an
  optional maximum number of visible lines after which it becomes independently scrollable.
- **FR-019**: Callers MUST be able to observe, via callback, whenever a row is added, a row is
  removed, or a multi-line paste is parsed into new rows — each callback receiving the row(s)
  involved.
- **FR-020**: Inline editing of a row's key and value MUST be composed from this project's already
  ported inline-editing component rather than re-implemented, so that entering and leaving edit
  state, and the associated keyboard behaviour (submit and cancel), stay consistent with every
  other place in the project that edits text inline.
- **FR-021**: The component MUST expose its state as styling hooks on the parts the upstream
  documentation lists: the list container marks itself disabled, invalid and read-only; the row
  container exposes the configured orientation; and the individual row exposes a highlighted state
  that is present exactly for the row most recently added, removed-from or pasted-into (upstream's
  `focusedId`). Each boolean hook is absent, not empty-valued, when false.
- **FR-022**: The remove control MUST expose a default accessible name ("Remove") that a caller can
  override, because it renders as an icon-only button with no visible text; the add control's
  visible "Add" text serves as its own name.

### Key Entities

- **Key-Value Row**: One entry in the list — a stable identifier (so rows can be reordered,
  added, and removed without losing track of which row is which), a key string, and a value
  string. Rows are the unit of add, remove, and per-row validation.
- **Row Error State**: The current validation error(s) for a single row, keyed by which field
  (key or value) they apply to; absence of an entry for a row means that row is currently valid.
- **List Value**: The ordered collection of rows that the component manages as a whole; this is
  what controlled callers read and set, and what gets submitted with a surrounding form.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can build a five-row list of key-value pairs (typing every key and value by
  hand, adding rows as needed) using only the keyboard, without needing the mouse at any point.
- **SC-002**: A user with a ten-line `KEY=VALUE` block on their clipboard can populate a ten-row
  list with a single paste action, with every key and value split correctly.
- **SC-003**: A user who types an invalid key or a duplicate key sees the corresponding error
  message within the same interaction (no separate submit step needed) and it disappears as soon
  as they correct it.
- **SC-004**: A screen-reader user can identify, for any row, which field currently has an error
  and what the error message says, without additional navigation beyond reaching that field.
- **SC-005**: The component's documentation page lets a developer see and interact with every
  example the upstream documentation shows (default usage, paste support, validation, and
  form usage) without leaving the page.
- **SC-006**: A developer can install the component into a new project through this project's own
  component registry in one command, the same way they would install any other listed component.

## Assumptions _(mandatory)_

- Upstream ships this component only as a "base" (Tailwind + Radix primitives) registry item, not
  as a published npm package; there is no separate base-vs-radix behavioural split worth tracking
  here — both variants in `.reference/diceui` are functionally identical for this port's purposes,
  so the radix-flavoured source (`docs/registry/bases/radix/ui/key-value.tsx`) is treated as the
  single upstream contract, consistent with how other radix-based components in this repository
  have been ported.
- The upstream "With Form" example wires the component into React Hook Form + Zod, a React-only
  form library with no direct Svelte equivalent. The demo page reproduces the same user-visible
  behaviour (a labelled field, a submit action, and validation messages) using this project's
  existing form-adjacent primitives instead of porting React Hook Form itself — the requirement
  being ported is "the component works as a field inside a form and can be validated on submit,"
  not the specific form library.
- Upstream's `asChild` / Radix `Slot` composition escape hatch has no direct Svelte 5 equivalent.
  Per the project's established translation table, parts that upstream lets the caller replace via
  `asChild` are instead composed directly (callers wrap or extend the rendered element via normal
  Svelte props/classes/snippets), consistent with every other ported component — this is a
  mechanical framework-boundary substitution, not a behavioural gap, so it is not called out as a
  separate functional requirement.
- Upstream's internal `useSyncExternalStore`-backed store is an implementation detail of how React
  shares state across the compound components; the Svelte port's equivalent obligation is the
  state-class-plus-context pattern this project already uses everywhere else, so the spec describes
  the resulting *behaviour* (FR-001 through FR-019) rather than the store mechanism itself.
- "Composing the already-ported inline-editing component" (FR-020) is interpreted as: the key
  field and value field are editable-in-place using that component's open/preview/submit/cancel
  state machine, rather than being permanently-open plain `<input>`/`<textarea>` elements as in the
  upstream screenshots. This is a deliberate divergence from upstream's always-editable rendering,
  requested explicitly for this port; the documented keyboard interactions (Tab between fields,
  Enter to submit a row's current input, Escape to cancel it) are preserved as the contract that
  must still hold once editing is composed this way.
- Row identifiers are generated internally when a row is created (on initial seed, on add, or on
  parsing a paste) using the project's existing id-generation approach for other list-like ported
  components; upstream's use of `crypto.randomUUID()` is an implementation detail, not part of the
  public contract, so no specific id format is promised to callers.
- Minimum row count defaults to zero (matching upstream's `minItems = 0`), meaning by default a
  list can be emptied down to zero rows; maximum row count is unset by default (no upper bound)
  unless the caller configures one, also matching upstream.
- Trimming (`trim`) and quote-stripping (`stripQuotes`) both default to on, matching upstream,
  since these defaults are what every upstream example relies on implicitly.
- Duplicate-key detection defaults to on (`allowDuplicateKeys = false` upstream), matching
  upstream's default and the validation example.
- Focus management on remove (moving focus to a neighboring row's key field) is not spelled out
  explicitly in the upstream MDX or source beyond the general "Tab navigates between inputs"
  keyboard note; it is specified here (Acceptance Scenario US1.3) as a reasonable default so that
  removing a row never strands keyboard focus on a now-detached element, following the same
  focus-preservation principle already required of this project's other add/remove list
  components (for example Tags Input).
- In the value field, `Enter` submits the current edit rather than inserting a newline (upstream's
  `<Textarea>` inserts a newline). The upstream MDX keyboard table documents `Enter` as "Submit the
  current input value", and the composed inline-editing component binds `Enter` to submit; multi-line
  values still arrive by paste and still wrap and scroll. (Divergence D-2.)
- `data-slot="key-value-key-input"` / `"key-value-value-input"` mark each field's outer wrapper rather
  than the `<input>`/`<textarea>` itself, because the field is composed from the inline-editing
  component; two new slot names, `-preview` and `-control`, address the preview and the control.
  (Divergence D-3, replaces upstream's single slot on the input element.)
- Paste splitting is additionally suppressed while the list is `disabled` or `readOnly`; upstream gates
  only on `enablePaste`, but FR-010 requires read-only to suppress every mutation. (Divergence D-4.)
- `aria-orientation` is not emitted on the list container. Upstream sets it on `role="list"`, where it
  is not a supported ARIA property and is inert for assistive technology; `data-orientation` carries the
  orientation for styling and tests. (Divergence D-6.)
- The value submitted with a surrounding form is the JSON serialisation of the row array. Upstream hands
  the raw array to a hidden input, which serialises to `"[object Object],[object Object]"` and cannot
  round-trip. (Divergence D-7.)
- `readOnly` also disables the add and remove controls; upstream omits `readOnly` from both, so a
  read-only list could still be emptied one row at a time, contradicting FR-010. (Divergence D-9.)
- A `dir` prop is accepted on the list container, matching the convention every other ported component
  in this project uses for right-to-left support; upstream has no such prop and relies on inherited
  document direction. (Divergence D-10.)
- Upstream renders the remove control as an icon-only button with no accessible name. A default name is
  added here because Principle III makes accessible names mandatory; callers override it with their own
  `aria-label` or by passing visible children. (Divergence D-13.)
