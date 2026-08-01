# Feature Specification: Port Mention Component

**Feature Branch**: `042-port-mention`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Mention\" (slug: mention) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Trigger a mention and pick one from the list (Priority: P1)

A user is typing free-form text in a field (a message, a comment, a note) and types the trigger
character (`@` by default). A small popup list of mentionable people/items appears anchored near
the text caret. As they keep typing, the list narrows to items matching what they typed. They pick
one — by mouse or keyboard — and the trigger character plus their search text is replaced in the
field by the trigger character plus the item's display label, followed by a space, with the rest of
their typed text left untouched.

**Why this priority**: This is the entire reason the component exists. Without it there is no
mention feature at all.

**Independent Test**: Render a mention field with a static list of items and type the trigger
character followed by a partial name. Verify the popup opens, verify the item list narrows to
matches, select an item, and verify the field's text now reads `<trigger><label> ` with everything
that was typed before the trigger and after the search text preserved exactly.

**Acceptance Scenarios**:

1. **Given** an empty, focused mention field, **When** the user types the trigger character,
   **Then** the popup opens anchored near the caret and shows every enabled item.
2. **Given** an open popup with the user's search text after the trigger, **When** the text changes,
   **Then** the visible items narrow to those matching the search text using the default matcher
   (fuzzy unless `exactMatch` is set).
3. **Given** an open popup with a highlighted item, **When** the user clicks a different item,
   **Then** that item becomes selected instead: the input text is replaced with `<trigger><label> ` at
   the trigger's position, the popup closes, the caret lands immediately after the inserted space, and
   focus stays on the field.
4. **Given** text already exists before and after the point where a mention is inserted, **When** a
   selection completes, **Then** the text before the trigger and the text after the original caret
   position are both preserved byte-for-byte around the newly spliced mention text.
5. **Given** an item declares a `label` different from its `value`, **When** it is selected, **Then**
   the inserted text uses the `label`, while the component's selected-value list receives the `value`.

---

### User Story 2 - Operate the mention popup entirely by keyboard (Priority: P1)

A keyboard-only or screen-reader user triggers the mention popup, moves the highlight with arrow
keys, jumps to the first/last item, selects with `Enter`, and dismisses the popup with `Escape`
without losing their place in the surrounding text.

**Why this priority**: Accessibility parity is a non-negotiable project principle for every input
control, and mention fields are typically used inside chat/comment composers where keyboard-only use
is the norm.

**Independent Test**: Using only keyboard input, trigger the popup, move the highlight with
`ArrowDown`/`ArrowUp`, jump with `Home`/`End`, confirm `role`, `aria-expanded`, `aria-controls`, and
`aria-activedescendant` update at each step (queried by `data-slot` for the popup content itself,
since the anchored layer is not visible to `getByRole` in the test environment), then select with
`Enter` and confirm the field's caret ends up right after the inserted mention.

**Acceptance Scenarios**:

1. **Given** an open popup, **When** the user presses `ArrowDown`/`ArrowUp` repeatedly, **Then** the
   highlight moves forward/backward through the visible items one at a time, stopping at the boundary
   unless the component is configured to loop.
2. **Given** an open popup, **When** the user presses `Home` or `End`, **Then** the highlight jumps to
   the first or last visible item respectively.
3. **Given** an open popup with a highlighted item, **When** the user presses `Enter`, **Then** that
   item is selected exactly as if it had been clicked.
4. **Given** an open popup whose highlight has been cleared (every visible item is disabled, or the
   highlight was cleared by filtering), **When** the user presses `Enter`, **Then** the popup closes
   without selecting anything and without preventing the newline/default behavior the host element
   would otherwise apply.
5. **Given** an open popup, **When** the user presses `Escape`, **Then** the popup closes, no value
   changes, and focus remains on the field.
6. **Given** a focused field, **Then** it exposes `role="combobox"`, `aria-expanded`, `aria-controls`
   pointing at the popup's listbox id, `aria-autocomplete="list"`, and — whenever an item is
   highlighted — `aria-activedescendant` pointing at that item's id; the popup exposes
   `role="listbox"`; each item exposes `role="option"` and `aria-selected` reflecting whether its
   value is part of the current selection.

---

### User Story 3 - Trigger detection respects word boundaries (Priority: P1)

A user typing an email address, a password, or any text containing the trigger character mid-word
(e.g. `name@domain`) does not have the mention popup pop open uninvited. The popup only opens when
the trigger character starts a fresh "word" — preceded by nothing, a space, or a newline — and only
stays relevant while the text after it contains no space.

**Why this priority**: This is called out explicitly as one of the two hardest parts of the port and
is the single most user-visible correctness bug if done wrong — an uninvited popup while typing an
email address is a severe, immediately-noticed defect.

**Independent Test**: Type `contact me at foo@bar.com please` into a mention field one character at a
time and assert the popup never opens at the `@` inside `foo@bar.com`. Separately, type a leading
`@` at the very start of an empty field, or after a space, and assert the popup does open.

**Acceptance Scenarios**:

1. **Given** an empty field, **When** the user types the trigger character as the very first
   character, **Then** the popup opens.
2. **Given** existing text ending in a space, **When** the user types the trigger character next,
   **Then** the popup opens.
3. **Given** existing non-space text with no trailing space, **When** the user types the trigger
   character immediately after it (no space in between), **Then** the popup does NOT open, because the
   trigger character is part of continuous text rather than starting a new word.
4. **Given** an open popup with search text after the trigger, **When** the user types a space,
   **Then** the popup closes, because the search text may no longer contain whitespace.
5. **Given** the caret is placed inside or after an already-inserted mention's text, **When** the
   caret is moved without changing the text, **Then** the popup does not re-open for that mention's own
   trigger character.
6. **Given** the caret sits immediately before existing non-space text (not a newline, a space, or
   another trigger character) that is not part of an existing mention span, **When** the user types the
   trigger character at that position, **Then** the popup does NOT open, because interfering text
   immediately follows the caret.

---

### User Story 4 - Configure the trigger character and the matching logic (Priority: P2)

An integrator wants mentions triggered by a character other than `@` (e.g. `#` for tagging or `/` for
slash-commands), and/or wants full control over how the typed search text is matched against
available items (e.g. "starts with" instead of fuzzy matching), replacing the built-in matcher
entirely.

**Why this priority**: Both are documented, first-class upstream props exercised by dedicated
examples, and are common product requirements (slash-command palettes, hashtags), but they are
configuration on top of the User Story 1–3 behavior rather than required for a minimally usable
mention field.

**Independent Test**: Render a mention field with `trigger="#"` and verify only `#` opens the popup
(typing `@` does nothing). Separately, render a field with a custom `onFilter` callback that only
keeps items whose value starts with the typed text, and verify the visible items reflect exactly that
function's output rather than the built-in fuzzy/exact matcher.

**Acceptance Scenarios**:

1. **Given** a mention field configured with a non-default trigger character, **When** the user types
   that character at a word boundary, **Then** the popup opens exactly as it would with the default
   `@`; typing the default `@` character does nothing.
2. **Given** a mention field configured with a custom filter function, **When** the user types search
   text, **Then** the visible items are exactly the custom function's return value, and the built-in
   fuzzy/exact matcher is never invoked.
3. **Given** a mention field configured with `exactMatch` and no custom filter, **When** the user
   types search text, **Then** only items whose value contains the search text as an exact substring
   (case-insensitive) remain visible, instead of the default fuzzy match.
4. **Given** a custom filter (or the built-in matcher) narrows the visible items to zero while the
   popup is open, **Then** the popup automatically closes and the highlight clears.

---

### User Story 5 - Edit and remove inserted mentions as atomic units (Priority: P2)

A user backspaces over an inserted mention, selects and deletes a range of text that overlaps one or
more mentions, or arrow-keys past a mention. In every case the mention is treated as a single,
indivisible unit of text rather than being partially edited into garbled text, and removing a mention
from the text also removes its value from the component's selected-value list.

**Why this priority**: This is core to the "mentions are structured data, not plain text" premise of
the component; without it, mentions silently desynchronize from the field's text after any edit,
which is a correctness defect a shipped component cannot have — but it is layered on top of the
insertion behavior in User Story 1.

**Independent Test**: Insert a mention into a field with surrounding text, place the caret immediately
after it, and press `Backspace`; verify the entire mention text disappears in one step and the
component's value list no longer contains it. Separately, select a text range spanning the mention and
press `Delete`; verify the same result.

**Acceptance Scenarios**:

1. **Given** the caret is immediately after an inserted mention (or after its trailing space), **When**
   the user presses `Backspace`, **Then** the entire mention's text is removed as one unit and its
   value is removed from the selection list.
2. **Given** the caret is inside an inserted mention's text, **When** the user presses `Backspace`,
   **Then** the entire mention is removed, not just the character before the caret.
3. **Given** a text selection overlaps one or more inserted mentions, **When** the user presses
   `Backspace` or `Delete`, **Then** every overlapping mention is removed along with the selected
   text, and each removed mention's value leaves the selection list.
4. **Given** the caret sits immediately adjacent to an inserted mention with no selection, **When**
   the user presses `ArrowLeft` or `ArrowRight`, **Then** the caret jumps over the whole mention in one
   step rather than moving through it character by character.
5. **Given** a mention is removed by any of the above, **Then** the positions of every other mention
   still present in the text are updated to stay correct for subsequent edits.

---

### User Story 6 - Right-to-left layout support (Priority: P3)

A user viewing the application in a right-to-left language sees the mention field and its popup
mirrored correctly, and the popup still anchors to the correct visual position relative to the caret.

**Why this priority**: Internationalization is required by project convention, but is additive polish
once the core interaction model (P1) and secondary capabilities (P2) are correct.

**Independent Test**: Render a mention field with `dir="rtl"` (or inside the project's existing
direction context set to RTL) and verify the field and popup content both carry `dir="rtl"`.

**Acceptance Scenarios**:

1. **Given** the mention direction is set to `rtl`, **Then** the field and the popup content each
   carry `dir="rtl"`, and the popup's horizontal alignment mirrors (a `start`-aligned popup renders
   visually on the right instead of the left).
2. **Given** no explicit direction is set, **When** the component is rendered inside the project's
   ambient direction context set to RTL, **Then** the mention field still renders right-to-left
   without an explicit `dir` prop on the component itself.

---

### Edge Cases

- Typing into a `disabled` or `readonly` field MUST NOT open the popup, filter items, splice a
  mention, or change the value; a `readonly` field's popup, if already open from before the field
  became read-only, stays visible, but highlight movement and selection become inert — no keyboard or
  pointer interaction changes the highlight or the value.
- A cut or paste operation that fully or partially overlaps one or more inserted mentions removes
  those mentions from the value list the same as an explicit delete.
- Pasting text that itself contains the trigger character followed by a name matching an available
  item converts that portion of the pasted text into a real mention (matched against the currently
  registered items, case- and separator-insensitive); pasted text containing the trigger character
  with no matching item is inserted as literal text instead.
- An item's `value` MUST NOT be an empty string; this is flagged during development the same as
  upstream (a thrown error), not silently ignored.
- Using `MentionLabel`, `MentionInput`, `MentionContent`/`MentionPortal`, or `MentionItem` outside a
  `Mention` root throws a documented error naming both the part and the required provider.
- A mention field rendered with a form field `name` inside a native `<form>` submits its current
  selected-value list via a visually hidden input, honoring `disabled` and `required`.
- When the field is a multi-line `textarea`-backed input, the popup anchors to the caret's actual
  line/column position (accounting for text wrapping), not to a fixed position relative to the field
  as a whole.

## Requirements _(mandatory)_

### Functional Requirements

**Composition & structure**

- **FR-001**: The component MUST ship as a set of composable parts — root, label, input, portal,
  content (popup), and item — mirroring the upstream part list, so consumers compose only the parts
  they need.
- **FR-002**: Each part MUST be usable both through a namespace import (`Mention.Root`,
  `Mention.Item`, …) and through individually named exports (`MentionRoot`, `MentionItem`, …),
  consistent with every other ported component in this project.
- **FR-003**: The field part MUST render as a native text input by default and MUST support being
  rendered as a multi-line `textarea` instead via a `child` snippet, matching upstream's `asChild`
  escape hatch used in every upstream demo.
- **FR-003a**: Each inserted mention MUST be visually distinguished inside the field by an overlay
  segment carrying a `data-tag` attribute, so consumers can style mentions from the root (the styling
  API the upstream documentation exposes). The overlay MUST stay aligned with the field's text as the
  field is scrolled, resized or restyled, MUST NOT capture pointer events or text selection, and MUST
  be updated whenever the mention list changes.

**Triggering and insertion (User Story 1)**

- **FR-004**: The root MUST support a configurable single trigger character (default `@`) that opens
  the popup when typed at a word boundary (edge case and User Story 3 define "word boundary"
  precisely): preceded by nothing, a space, or a newline, and not itself already inside an existing
  mention's span. The popup MUST also stay closed when the caret is immediately followed by
  non-separator text (any character other than a space, a newline, or the trigger character) that is
  not part of an existing mention span.
- **FR-005**: While the popup is open, the text between the trigger and the caret MUST be treated as
  the live search term; the term MUST become empty immediately when the trigger is typed with the
  caret right after it, and the popup MUST close the moment that term would contain a space.
- **FR-006**: Selecting an item (by click or by `Enter`) MUST replace the text from the trigger
  character through the caret with `<trigger><item label> ` (trigger, label, one trailing space),
  MUST leave every character before the trigger and every character after the original caret
  untouched, MUST append the item's `value` to the selection value list, MUST close the popup, and
  MUST place the caret immediately after the inserted space.
- **FR-007**: An item's displayed label MAY differ from its `value` (the value is what participates in
  the selection list and filtering; the label is what gets inserted into the text and shown in the
  popup, defaulting to the value when no label is given).
- **FR-008**: The root MUST support the selected-value list both as a controlled `value` +
  `onValueChange` pair and as an uncontrolled list seeded from a `defaultValue`.
- **FR-009**: The root MUST support the field's raw text both as a controlled `inputValue` +
  `onInputValueChange` pair and as an uncontrolled string, independent of the structured selected-value
  list.
- **FR-010**: The root MUST support a controlled `open`/`defaultOpen` popup-visibility pair with an
  `onOpenChange` callback, independent of the value and input-text state.
- **FR-010a**: The root MUST support a `modal` flag (default `false`). When set, an open popup MUST
  block pointer interaction outside the popup and lock background scrolling, and `Tab` MUST select the
  highlighted item instead of dismissing the popup; when unset, outside pointer interaction and
  scrolling behave normally.

**Filtering (User Story 4)**

- **FR-011**: Typed search text MUST filter the visible items using fuzzy matching by default, with an
  opt-in `exactMatch` mode for case-insensitive substring matching.
- **FR-012**: Consumers MUST be able to supply a custom filter function that fully replaces the
  built-in matching logic; when supplied, `exactMatch` MUST be ignored, matching upstream.
- **FR-013**: If filtering narrows the visible item count to zero while the popup is open, the popup
  MUST close automatically and the highlight MUST clear.
- **FR-013a**: Opening the popup MUST highlight the first enabled, visible item automatically; if no
  enabled item is visible the highlight MUST stay clear. A request to open MUST be ignored while a
  non-empty search term matches zero items.

**Keyboard & accessibility (User Story 2)**

- **FR-014**: `ArrowDown`/`ArrowUp` MUST move the highlight to the next/previous visible item while
  the popup is open, stopping at the boundary by default; when the root is configured to loop,
  movement past the last item wraps to the first and vice versa.
- **FR-015**: `Home`/`End` MUST move the highlight to the first/last visible item while the popup is
  open (unless a platform modifier key is held, in which case native behavior is preserved).
- **FR-016**: `Enter` MUST select the currently highlighted item if one exists; if none is highlighted,
  it MUST close the popup without changing the value or preventing default key behavior.
- **FR-017**: `Escape` MUST close the popup, clear the highlight, and MUST NOT change the value or move
  focus away from the field.
- **FR-017a**: While the popup is open, `Tab` MUST close the popup and allow focus to move to the next
  focusable element by default; when the root is configured as `modal`, `Tab` MUST instead select the
  currently highlighted item and MUST NOT move focus.
- **FR-018**: The field MUST expose `role="combobox"`, `aria-expanded`, `aria-controls` referencing the
  popup's listbox id, `aria-autocomplete="list"`, `aria-labelledby` referencing the label part's id,
  `aria-disabled` and `aria-readonly` reflecting those states, browser autocomplete disabled, and -
  whenever an item is highlighted - `aria-activedescendant` referencing that item's id.
- **FR-019**: The popup content MUST expose `role="listbox"` with `aria-orientation="vertical"` and the
  id referenced by the field's `aria-controls`; each item MUST expose `role="option"` with
  `aria-selected` reflecting whether its value is in the current selection list.
- **FR-019a**: The Content part MUST re-expose upstream's documented positioning props (`side`,
  `sideOffset`, `align`, `alignOffset`, `collisionBoundary`, `collisionPadding`, `sticky`, `strategy`,
  `avoidCollisions`, `fitViewport`, `forceMount`, `hideWhenDetached`, `trackAnchor`, `onEscapeKeyDown`,
  `onPointerDownOutside`) with upstream's defaults, and MUST emit `data-side`/`data-align` reflecting
  the resolved placement plus the three documented CSS custom properties
  (`--dice-transform-origin`, `--dice-available-width`, `--dice-available-height`) so consumers can
  style around the resolved position and available space.
- **FR-020**: The label part MUST associate itself with the field via matching `id`/`for` so assistive
  technology announces the field's accessible name.
- **FR-021**: An item MAY be marked `disabled`: it MUST be excluded from highlight movement, MUST NOT
  be selectable by click or `Enter`, and MUST expose that state as a data attribute.
- **FR-021a**: Moving the pointer over an enabled item MUST move the highlight to that item, the same
  as if it had been reached by keyboard.

**Atomic mention editing (User Story 5)**

- **FR-022**: The component MUST track, for every inserted mention, its text span (start/end offset)
  within the field's current text, kept correct across every subsequent edit (typing, cut, paste,
  deletion elsewhere in the text).
- **FR-022a**: A pointer-down inside an already-inserted mention's text MUST prevent the default caret
  placement and instead snap the caret to the end of that mention.
- **FR-023**: `Backspace` with the caret exactly at the end of, or inside, an inserted mention (no
  selection) MUST remove that mention's entire text - plus its trailing space when one is present - as
  one edit, and MUST remove its value from the selection list.
- **FR-023a**: `Backspace` with the caret immediately after a mention's trailing space MUST remove only
  that space and leave the mention and its value intact; a subsequent `Backspace` then removes the whole
  mention per FR-023.
- **FR-023b**: `Meta`/`Ctrl` + `Backspace` MUST remove the nearest mention that ends at or before the
  caret when only whitespace separates them, skipping the trailing-space step of FR-023a.
- **FR-023c**: `Delete` with the caret immediately adjacent to, or inside, an inserted mention (with no
  selection) MUST remove that mention's entire text as one edit and MUST remove its value from the
  selection list.
- **FR-024**: `Backspace` or `Delete` with an active text selection that overlaps one or more inserted
  mentions MUST remove all overlapping mentions' text along with the selected range in one edit, and
  MUST remove each affected value from the selection list.
- **FR-025**: `ArrowLeft`/`ArrowRight` with no active selection and the caret immediately adjacent to an
  inserted mention MUST move the caret to the far side of that mention in a single step rather than
  entering it character by character; holding a platform modifier key MUST jump to the mention's exact
  start/end boundary.
- **FR-026**: Cutting or pasting a selection that overlaps one or more inserted mentions MUST remove
  those mentions' values from the selection list the same as an explicit delete.

**Disabled, read-only, and form integration**

- **FR-027**: A `disabled` root state MUST prevent opening the popup, filtering, typing-driven changes,
  and selection across every part.
- **FR-028**: A `readonly` root state MUST prevent the value from changing via typing or selection and
  MUST make highlight movement inert, while still allowing an already-open popup to stay visible.
- **FR-029**: When rendered with a form field `name` inside a native form, the component MUST submit
  its current selected-value list via a visually hidden form input honoring `disabled` and `required`.

**Internationalization (User Story 6)**

- **FR-030**: The component MUST support an explicit right-to-left layout mode that mirrors the field
  and popup content and inverts the popup's horizontal alignment, and MUST fall back to the project's
  existing ambient direction context when no explicit direction is supplied.

**Distribution & documentation**

- **FR-031**: The component MUST be installable from the project's own component registry the same way
  every other first-party component is, with a single registry entry listing every source file.
- **FR-032**: A documentation/demo page MUST exist exercising, at minimum, each upstream example:
  default mention list, a custom trigger character, and a custom filter function.

### Key Entities

- **Mention field value**: An ordered list of selected item identifiers (`value`s), independent of
  the field's raw text, settable as controlled or uncontrolled state.
- **Field text**: The raw string content of the input/textarea, which contains the trigger character
  plus each mention's inserted label as ordinary substrings, tracked alongside a parallel list of
  mention spans (see below) so those substrings can be treated as atomic units.
- **Item (option)**: A selectable entry with a required non-empty `value`, a display `label`
  (defaulting to the value), and an optional disabled state.
- **Mention span**: The tracked `{ value, start, end }` record for one inserted mention's position
  within the current field text, kept in sync across edits so it can be located, atomically edited, or
  removed.
- **Filter state**: The current search term (the text between the trigger and the caret while the
  popup is open) plus the derived set of currently visible items, produced by the built-in matcher, a
  consumer-supplied filter function, or `exactMatch` substring matching.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can trigger the popup, filter down to one of 20 items, and insert it using only
  the keyboard in under 10 key presses (typing the trigger, typing search text, `Enter`).
- **SC-002**: 100% of the keyboard interactions listed in User Story 2 (`ArrowDown`, `ArrowUp`,
  `Home`, `End`, `Enter`, `Tab`, `Escape`) produce the documented outcome when automatically tested.
- **SC-003**: Typing the trigger character inside continuous non-space text (e.g. an email address)
  never opens the popup, verified across at least the three boundary cases in User Story 3's
  acceptance scenarios by automated test.
- **SC-004**: Every state a screen-reader user needs — whether the popup is open, which item is
  highlighted, and which are selected — is exposed through the ARIA attributes asserted in the
  roles-and-ARIA test area (`aria-expanded`, `aria-controls`, `aria-activedescendant`,
  `role="option"` + `aria-selected`), independent of any visual/color cue.
- **SC-005**: After inserting a mention into text with content both before and after the insertion
  point, the text before and after is byte-for-byte identical to before the insertion, verified by
  automated test for at least one non-trivial (non-empty-field) case.
- **SC-006**: Removing an inserted mention (via `Backspace`, `Delete`, or an overlapping selection
  delete) always removes it as a single atomic edit and always keeps the selection value list in sync
  with the mentions still present in the text, verified by automated test for at least the
  caret-adjacent, caret-inside, and selection-overlap cases.
- **SC-007**: Every example shown on the upstream documentation page has a directly corresponding,
  working demo section on this project's documentation site.
- **SC-008**: Under `dir="rtl"`, the field and popup content each carry `dir="rtl"`, verified
  automatically rather than by sighted review.
- **SC-009**: The component is installable into a fresh consumer project through the project's
  registry in a single command, with zero manual follow-up edits required to reach a working state.

## Assumptions

- **Positioning is delegated to bits-ui's anchored-layer primitive, driven by a virtual/synthetic
  anchor rather than the field element itself.** Upstream computes a virtual `DOMRect` at the caret's
  visual position (accounting for line wrapping and RTL) and hands it to `@floating-ui/react` as the
  anchor. This port keeps the same virtual-anchor caret-position math (there is no equivalent
  first-party primitive for "anchor a popover to an arbitrary point inside a text field") but delegates
  the actual floating/collision/portal mechanics to bits-ui's popover-style anchored layer, per
  Constitution Principle IV (Composition Over Reimplementation) — bits-ui has no built-in caret-tracking
  positioning, so only that narrow piece is bespoke.
- **`MentionPortal` maps to bits-ui's portal primitive rather than a hand-rolled `createPortal`
  wrapper.** Same composition rule as above; the upstream part list and its behavior (render content
  outside the DOM hierarchy into a caller-chosen container) are preserved.
- **The upstream `Mention` package (radix base) is the source of truth, not the plain "base" tree.**
  `.reference/diceui/packages/mention` is the only standalone Mention package upstream ships (there is
  no `docs/registry/bases/base/ui/mention.tsx` counterpart); `docs/registry/bases/radix/ui/mention.tsx`
  is confirmed to be a thin re-export wrapper around it, per the task brief. This spec is written
  against the standalone package's behavior and its test file.
- **`asChild` → a `child` snippet on the input part.** React's `asChild`/`Slot` pattern (used in every
  upstream demo to render the field as a `<textarea>` instead of an `<input>`) has no Svelte
  equivalent; per the project's established translation table this becomes a `child` snippet, matching
  `dialog-content.svelte` and other ported components. FR-003 covers this.
- **`onFilter`/`exactMatch` unresolved-precedence rule matches upstream exactly.** Upstream's own doc
  comment states `exactMatch` is ignored whenever `onFilter` is supplied; FR-012 codifies that as
  binding behavior rather than an implementation detail, since it is directly observable by a
  consumer.
- **Multi-character triggers are out of scope.** Upstream's `trigger` prop and every example use a
  single character (`@`, `#`, `/`); the word-boundary and text-splicing algorithms described in FR-004
  through FR-006 are specified in terms of a single trigger character, matching upstream's actual
  contract (its type is `string` but every consumer-facing example and the boundary-detection logic in
  `mention-input.tsx` assume length 1). Supporting longer trigger strings would be a feature beyond
  parity, not a port.
- **Paste-driven mention reconstruction (edge case) matches upstream's best-effort behavior, not exact
  matching.** Upstream's paste handler normalizes case/whitespace/separators and greedily matches the
  longest word-combination against currently registered (visible) items; this spec requires the same
  best-effort behavior rather than a stricter contract, since upstream itself does not guarantee every
  pasted mention-like substring resolves to a real mention.
- **`VisuallyHiddenInput`/native form participation maps to a plain visually-hidden `<input>` element**,
  consistent with how other ported components (e.g. `tags-input`, `combobox`) already implement form
  participation in this project, rather than depending on an upstream-only shared helper.
- **RTL popup-alignment mirroring reuses the existing project direction context** (already used by
  other anchored-layer components such as `combobox`/`select`), rather than reproducing upstream's
  bespoke `dir`-aware align-flipping logic from scratch.
- Standard defaults are used for anything not explicitly covered above (popover collision handling,
  positioning offsets, focus-visible styling) — these follow the same headless-primitive composition
  already used by every other popover-based component in this project (select, dropdown-menu, popover,
  combobox) rather than being reproduced as bespoke Mention logic.
- **The popup's documented CSS variables are produced by the composed primitive.** `--dice-transform-origin`,
  `--dice-available-width` and `--dice-available-height` are aliased onto the anchored layer's own
  `--bits-popover-*` variables, carrying the same values under the upstream names (divergence D-4).
- **`fitViewport` is expressed as max-width/max-height off the available-space variables** rather than a
  floating-ui `size` middleware, because the composed primitive exposes no `size` hook; the observable
  clamping is the same (divergence D-5).
- **Items expose `data-value`.** The upstream source omits it while the upstream MDX documents
  `[data-value]` as part of the item's styling API; this port follows the documented contract, which is
  additive (divergence D-7).
- **Line-height measurement is guarded with `Number.isFinite`.** Upstream's `Number.parseInt(...) ?? offsetHeight`
  never catches `NaN`; this port keeps the intended fallback (divergence D-9).
- **Frame-hopping uses the framework's flush point.** Upstream's `requestAnimationFrame` hops become
  `await tick()`, which is deterministic in the test environment (divergence D-10).
- **Fuzzy/exact/custom filtering reuses this project's already-ported filter module** instead of the
  upstream shared package, with an identical scoring contract (divergence D-11).
