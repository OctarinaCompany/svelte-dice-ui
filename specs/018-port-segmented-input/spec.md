# Feature Specification: Segmented Input

**Feature Branch**: `018-port-segmented-input`

**Created**: 2026-07-30

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Segmented Input\" (slug: segmented-input) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Enter structured data across connected fields (Priority: P1)

A person filling out a form (a name split into first/middle/last, a phone number, a mailing
address) sees a row (or column) of visually connected input fields that read as one control, types
into each field in turn, and submits the combined value.

**Why this priority**: This is the component's entire reason to exist — without a working set of
connected, independently-editable fields there is no segmented input.

**Independent Test**: Render a segmented input with three items and default values, type into each
field, and confirm each field's value updates independently and the fields render as one visually
joined group (first/last corners rounded, shared border, no double border between adjacent items).

**Acceptance Scenarios**:

1. **Given** a segmented input with three items, **When** the user types into the second item,
   **Then** only that item's value changes and the corresponding `onChange`/`value` binding for
   that item fires with the new value.
2. **Given** a segmented input with a single item, **When** it renders, **Then** the item has no
   joined-edge styling (it is visually isolated, matching a standalone input).
3. **Given** a segmented input with `orientation="vertical"`, **When** it renders three items,
   **Then** the items stack top to bottom with the shared-edge styling rotated to the vertical axis
   (shared top/bottom borders instead of left/right).

---

### User Story 2 - Move between segments with the keyboard (Priority: P2)

A keyboard user tabs into the segmented input and needs to move between its fields without
reaching for the mouse, using the arrow keys that match the input's orientation, in addition to
standard Tab/Shift+Tab field-to-field navigation.

**Why this priority**: Segmented inputs conventionally behave like a single composite control
(compare OTP inputs, date/time segments); arrow-key movement between segments is the expected
behavior for this widget shape under the WAI-ARIA Authoring Practices, and is the capability the
companion Time Picker component will depend on.

**Independent Test**: Render a horizontal segmented input with three items, focus the first item,
press the "next" arrow key twice, and confirm focus lands on the third item without altering any
item's value; repeat for a vertical segmented input using the up/down arrows.

**Acceptance Scenarios**:

1. **Given** a horizontal segmented input, **When** the first item is focused with its caret at the
   end of its text and nothing selected, and the user presses the arrow key that points toward the
   end of the group, **Then** focus moves to the next item to the right.
2. **Given** a horizontal segmented input rendered with `dir="rtl"` (or nested under the project's
   right-to-left direction context), **When** the first item is focused with its caret at the end
   of its text and nothing selected, and the user presses the same "toward the end" arrow key,
   **Then** focus moves to the next item on the visual left, mirroring the reading direction.
3. **Given** a vertical segmented input, **When** an item is focused, **Then** `ArrowUp`/`ArrowDown`
   (not `ArrowLeft`/`ArrowRight`) move focus between items.
4. **Given** any segmented input, **When** the first item is focused and the user presses the
   "toward the start" arrow key, **Then** focus stays on the first item (no wraparound); the same
   holds for the last item and the "toward the end" key.
5. **Given** any segmented input, **When** an item is focused and the user presses `Home` or `End`,
   **Then** focus moves to the first or last item respectively.
6. **Given** a segmented input where the currently focused item is disabled or the whole group is
   disabled, **When** the user presses an arrow key, **Then** focus does not move into or through
   the disabled item.

---

### User Story 3 - Paste a full value across every segment (Priority: P3)

A person copies a complete value from elsewhere (e.g. a phone number or a colour's three channel
values from a colour picker) and pastes it while focused on any one segment, and the value is
distributed one part per segment instead of dumped entirely into the focused field.

**Why this priority**: This turns a tedious "type into each box" chore into a single paste, and is
explicitly requested distribution behavior for this port; it is valuable but the component is
already usable without it (User Stories 1–2 stand alone).

**Independent Test**: Render a segmented input with three items, focus the first item, paste a
value containing three parts (e.g. separated by the same characters a user would naturally paste,
such as a run of digits or a delimited string), and confirm each item receives one part in order
starting from the focused item, with parts that exceed the remaining segments discarded and
segments left over that received no part left unchanged.

**Acceptance Scenarios**:

1. **Given** a segmented input with three items and the second item focused, **When** the user
   pastes a value that splits into three parts, **Then** the second item receives the first part,
   the third item receives the second part, and pasting stops at the last segment (the first item,
   before the focus point, is left unchanged and the third part is discarded).
2. **Given** a segmented input with three items and the first item focused, **When** the user
   pastes a value that splits into exactly three parts, **Then** each item receives exactly one
   part, in order, and focus moves to the last item that received a pasted part.
3. **Given** a segmented input item with `disabled` or `readOnly` set, **When** a paste would land
   on that item, **Then** that item's value is left unchanged and distribution continues to the
   next eligible item for any remaining parts.

---

### Edge Cases

- An item rendered without an explicit `position` in a group of one MUST be treated as
  `"isolated"`; in a group of two or more, the first and last items MUST be treated as `"first"`
  and `"last"` and everything between as `"middle"`, matching upstream's automatic position
  assignment.
- A caller MAY still pass an explicit `position` on an item to override the automatic assignment
  (matching upstream, where an explicit `position` prop wins over the computed one).
- Toggling `orientation` at runtime MUST re-flow both the layout direction and the shared-edge
  styling without requiring the caller to remount the group.
- A group marked `disabled` MUST disable every item that does not set its own `disabled={false}`
  override, mirroring upstream's per-item override of the group-level flag.
- A group marked `invalid` MUST mark every item `aria-invalid`/`data-invalid` (no per-item override
  exists upstream for `invalid`).
- Arrow-key and paste-distribution navigation MUST skip disabled items entirely (never focus them,
  never deliver a pasted part to them) but MUST still count them as occupying a position in the
  group for the purposes of `first`/`middle`/`last` styling.
- A paste event with fewer parts than remaining segments MUST fill only as many segments as it has
  parts and leave the rest untouched.
- A paste event with more parts than remaining segments MUST fill every remaining segment and
  silently discard the extra parts (no error, no exception).
- A paste whose content yields a single part (no separators, and no segment width forces a split)
  MUST be left entirely to the browser's native paste — the component MUST NOT intercept or
  redistribute it — so undo history, selection replacement and native input events behave exactly
  as in a plain input.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide a root group container that lays out its child items either
  horizontally (`orientation="horizontal"`, the default) or vertically (`orientation="vertical"`)
  and exposes `role="group"` with `aria-orientation` matching the active orientation.
- **FR-002**: The system MUST provide an item part that renders as a text input, accepts the same
  attributes a plain input accepts (placeholder, value, disabled, required, maxlength, inputmode,
  pattern, min, max, an accessible name, and change/input callbacks), and participates in the
  group's controlled/uncontrolled value flow for that item.
- **FR-003**: The system MUST automatically assign each item a position of `isolated` (a lone
  item), `first`, `middle`, or `last` based on the item's index among its siblings, unless the
  caller supplies an explicit position for that item.
- **FR-004**: The system MUST style adjacent items so they read as one joined control: shared
  borders between neighbours, rounded outer corners only at the group's two visual ends, and no
  visible double border at the shared edge, in both horizontal and vertical orientation.
- **FR-005**: The system MUST support three sizes (`sm`, `default`, `lg`) that scale every item's
  height and horizontal padding consistently across the group.
- **FR-006**: The system MUST let a caller mark the whole group `disabled`, `invalid`, or
  `required`, applying the corresponding state to every item by default; `disabled` and `required`
  MUST be overridable per item, `invalid` MUST NOT be overridable per item (matching upstream).
- **FR-007**: The system MUST expose the resolved `disabled`, `invalid`, `required`, `orientation`,
  and computed `position` as data attributes on the root and/or item elements so consumers can
  target every state with CSS, without requiring JavaScript introspection.
- **FR-008**: Every item MUST remain reachable and operable with `Tab` and `Shift+Tab`, following
  normal document tab order, exactly as upstream documents.
- **FR-009**: The system MUST additionally support moving focus between items with the arrow key
  that matches the group's orientation and reading direction: `ArrowRight`/`ArrowLeft` in
  horizontal LTR (inverted under RTL), and `ArrowDown`/`ArrowUp` in vertical orientation
  (irrespective of direction). (Rationale and its constitutional basis are recorded in
  Assumptions.) Arrow-key movement is **caret-boundary guarded**: because segments are editable
  text fields, the key moves focus only when the caret already sits at that edge of the segment's
  own text with nothing selected; otherwise the browser's own caret movement is left untouched
  (divergence D-07). `Home`/`End` (FR-011) are not guarded.
- **FR-010**: Arrow-key focus movement MUST NOT wrap past the first or last item, MUST skip
  disabled items, and MUST leave every item's value unchanged.
- **FR-011**: The system MUST support moving focus directly to the first or last item with `Home`
  and `End` respectively.
- **FR-012**: The system MUST respect the project's existing direction context (or an explicit
  `dir` prop on the root, which takes precedence) when determining which horizontal arrow key moves
  focus toward the end of the group, exactly like the upstream component's own direction resolution
  for layout.
- **FR-013**: The system MUST distribute a single pasted value across multiple items: a paste
  landing on a focused item MUST be split into one part per remaining item starting at the focused
  item, with each part assigned to one item in order, extra parts beyond the last item discarded,
  and items before the focused item left untouched.
- **FR-014**: Paste distribution MUST skip items that are disabled or read-only and MUST move focus
  to the last item that received a distributed part.
- **FR-014a**: The item MUST compose a caller-supplied key and paste handler with its own rather than
  replacing either: the caller's handler runs first, and if the caller cancels the event (calls
  `preventDefault()`), the component's segment navigation and paste distribution MUST be skipped
  entirely for that event. This veto is the documented opt-out for both behaviors added over
  upstream (FR-009…FR-014); no additional prop is introduced for it, keeping the prop surface at
  upstream parity.
- **FR-015**: The segment focus-navigation behavior (arrow-key movement, Home/End, wrap
  suppression, disabled-item skipping, direction awareness) MUST be implemented as a standalone,
  reusable unit that does not depend on any segmented-input-specific markup or state, so that a
  future Time Picker component can reuse the same navigation behavior for its own segments.
- **FR-016**: The system MUST support an escape hatch (matching upstream's `asChild`/child-snippet
  pattern used elsewhere in this project) on **both** the root and the item — upstream declares it
  on both parts — allowing a caller to render either as a different element while retaining that
  part's role, resolved state, data attributes, and context participation. For the item this
  includes its computed `position`, its resolved `disabled`/`required`, and its registration into
  the group (an item rendered through the escape hatch still occupies its index and remains
  reachable by keyboard navigation and paste distribution).
- **FR-017**: The system MUST be distributed as an installable item through the project's own
  component registry, with a public entry point that exports the root and item parts, mirroring
  every other first-party component already shipped in this way.
- **FR-018**: A demo page MUST exist exercising every example the upstream documentation shows for
  this component: a multi-field name-style input, a structured form input (e.g. phone number) that
  submits a combined value, a numeric multi-channel input (e.g. RGB colour channels), and a
  vertical-orientation input.

### Key Entities

- **Segmented Input Group**: The container for a set of connected fields. Key attributes: reading
  direction, orientation, size, disabled/invalid/required state, and the ordered collection of
  items it lays out and provides shared context to.
- **Segmented Input Item**: One field within the group. Key attributes: its own value, its resolved
  position (`isolated`/`first`/`middle`/`last`) within the group, and its own disabled/required
  overrides layered on top of the group's state.
- **Segment Navigation Behavior**: The reusable focus-and-paste-distribution logic shared across
  every group's items and intended for reuse by other segmented widgets (e.g. a future Time
  Picker): current focus index, orientation, direction, and the set of items eligible to receive
  focus or a pasted part.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer composing a three-field segmented input (e.g. a name or phone number
  form) can do so with the same number of component parts and props as the upstream React
  component, with no additional wrapper markup required to achieve the joined visual styling.
- **SC-002**: 100% of the keyboard interactions documented for this class of widget (Tab,
  Shift+Tab, orientation-matching arrow keys from a caret already at the segment's edge with no
  selection, Home, End) succeed in moving focus to the correct item on the first attempt, in both
  left-to-right and right-to-left reading direction; and an arrow key pressed with the caret inside
  a segment's text moves the caret rather than focus, 100% of the time.
- **SC-003**: Pasting a value that matches the number of remaining segments fills every remaining
  segment correctly in a single paste action, eliminating the need to type into each field
  individually.
- **SC-004**: Every example shown on the upstream documentation page (default, form, colour-channel,
  vertical) has a working, visually equivalent counterpart on this project's documentation site.
- **SC-005**: The component installs and renders correctly through the project's own registry
  installation path with zero manual edits required after installation.

## Assumptions

- Upstream's own demo copy for the vertical example ("Use arrow keys (up/down) to navigate between
  fields in vertical orientation") describes arrow-key segment navigation, but the vendored
  upstream `segmented-input.tsx` source does not actually implement it — only `Tab`/`Shift+Tab`
  are wired up, and the MDX "Keyboard Interactions" table lists only Tab. Per Principle III of the
  constitution (WAI-ARIA Authoring Practices as the floor when upstream is weaker) and the explicit
  component-specific guidance for this port, arrow-key navigation (with Home/End, no wraparound,
  disabled-item skipping, and direction-awareness) is added as a deliberate enhancement over the
  literal upstream implementation, not a divergence from it — it fulfils upstream's own documented
  intent.
- "Paste of a full value must distribute across segments" is not present in the upstream component
  at all (upstream leaves paste handling to the browser's default single-field behaviour). This is
  a deliberate enhancement requested for this port, modeled on the paste-distribution behaviour
  common to OTP/PIN-style segmented inputs, and is scoped to: split on any non-alphanumeric
  separators the pasted text contains, or on individual characters when the pasted text has no
  separators and is longer than one remaining segment expects — whichever the item's own
  constraints (e.g. `maxlength`) would naturally split it into. Each item receives at most as many
  characters as its own `maxlength`/expected width allows before advancing to the next item.
- The reusable focus-navigation module required by the "Extract the segment focus-navigation
  logic" guidance is a plain, markup-independent unit (a state class plus pure helper functions) so
  it can be imported by both this component and the future Time Picker component; it is not itself
  a rendered part and therefore is not exposed through the registry as a UI file, only as an
  implementation detail of the `segmented-input` package (and, later, the `time-picker` package).
- Upstream ships this component under both a "base" (plain) style and a "radix" style that differ
  only in which internal `Input` primitive they compose (`@/registry/bases/radix/ui/input` vs. the
  base one); this project has a single existing `input` component
  (`src/lib/components/ui/input`), so only one ported variant is produced, composing that existing
  `input` component rather than re-implementing an input primitive — consistent with Principle IV
  (Composition Over Reimplementation) and the base/radix distinction upstream itself draws for
  styling engine, not for behavior.
- Upstream's `asChild` (via Radix `Slot`) on the root maps to this project's existing `child`
  snippet pattern (see `dialog-content.svelte` and CLAUDE.md §10), not to a re-implemented slot
  primitive.
- The root's context value (`dir`, `orientation`, `size`, `disabled`, `invalid`, `required`) is
  shared via this project's Symbol-keyed context pattern (CLAUDE.md §5), matching every other
  compound component already ported, rather than upstream's bare React context object.
- Direction (`dir`) resolution composes the project's existing `direction-provider` component
  (`src/lib/components/ui/direction-provider`) for the ambient/context case, with an explicit `dir`
  prop on the root taking precedence — mirroring upstream's own `DirectionPrimitive.useDirection`
  fallback behavior of "explicit prop wins over ambient context."
- `invalid` has no ARIA-mandated announced state beyond `aria-invalid`; no additional live-region
  announcement is added, matching upstream's scope.
- Only the four documented examples (default/name, form/phone, RGB colour, vertical/address) are in
  scope for the demo page; no additional demos are invented beyond what upstream's docs page shows.

### Recorded divergences from upstream (Principle II)

Established during planning; rationale in `plan.md` and `research.md`.

- **D-01 — position counts items, not children.** Upstream derives `first`/`middle`/`last` from the
  length of `React.Children`, so any non-item child (a decorative element between two fields) shifts
  the computation and corrupts the joined-edge styling. This port counts only registered items.
  `React.Children` inspection has no Svelte equivalent, and the replacement is strictly better.
- **D-02 — position settles on mount.** Because items self-register from an effect, an item's
  resolved position is `"isolated"` for the first render frame and correct immediately after mount.
  Upstream computes it during the parent's render. No visible difference; tests must flush before
  asserting `data-position`.
- **D-03 — `ref` is not applied when the escape hatch is used.** Upstream's `asChild` forwards the
  ref onto the caller's element; a `child` snippet hands the caller the props and lets them own the
  element, so `bind:ref` is not populated in that case. This matches every other ported component in
  this project.
- **D-04 — `type="file"` is excluded from the item.** Upstream types the item as the unrestricted
  `React.ComponentProps<'input'>`. A file input has no caret, no `maxlength` and cannot receive a
  distributed paste part, and excluding it lets the item compose this project's existing input
  component without a type cast (which Principle VI forbids). Type-level restriction only.
- **D-05 — corner radius follows this project's input.** Upstream's vertical variants restore a
  `md` radius because upstream's input uses one; this project's input uses `lg`, so the restored
  corner uses `lg` to match the group's outer corners. Same visual intent, different token.
- **D-06 — logical border properties under RTL.** Upstream's variant table mixes logical spacing
  (`-ms-px`) with physical borders (`border-l-0`), so under `dir="rtl"` every seam renders a doubled
  border and the group's leading edge loses its border. This port uses the logical equivalents
  throughout, which is required by Principle III's RTL obligation and is asserted by a test.
- **D-07 — arrow-key navigation is caret-boundary guarded.** The segments are editable text fields.
  Focus moves to the neighbouring segment only when the caret already sits at that edge of the
  segment's own text with nothing selected; otherwise the browser's caret movement is left alone.
  Without this guard it would be impossible to edit the middle of a segment's text, which would
  contradict FR-002. `Home`/`End` are not guarded, matching FR-011 as written.
