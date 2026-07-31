# Feature Specification: Kanban

**Feature Branch**: `037-port-kanban`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Kanban\" (slug: kanban) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Reorder items within a column by dragging (Priority: P1)

A user managing a task board drags a card up or down within its own column to change its priority
order, and the new order is reflected immediately.

**Why this priority**: This is the smallest unit of value a kanban board provides — without
within-column reordering the board is just a static list grouped by column.

**Independent Test**: Render a board with one column containing several items; drag an item to a
different position within the same column; verify the column's item order updates and the item
that was dropped-on shifts to make room.

**Acceptance Scenarios**:

1. **Given** a column with items A, B, C in that order, **When** the user drags item C and drops it
   between A and B, **Then** the column's order becomes C, A, B.
2. **Given** a drag has started, **When** the user releases the pointer over empty space outside any
   column, **Then** the board returns to its pre-drag order and nothing changes.
3. **Given** a drag has started, **When** the user presses `Escape`, **Then** the drag is cancelled
   and the item returns to its original position.

---

### User Story 2 - Move items across columns by dragging (Priority: P1)

A user drags a card out of one column (e.g. "In Progress") and drops it into another (e.g. "Done")
to reflect a change in status, at any position within the destination column.

**Why this priority**: Moving work between stages is the defining interaction of a kanban board;
without it the component is only a set of independent sortable lists.

**Independent Test**: Render a board with two columns; drag an item from the first column and drop
it into the second column; verify the item is removed from the first column's list and appears in
the second column's list at the dropped position.

**Acceptance Scenarios**:

1. **Given** column "todo" has items [1, 2] and column "done" has items [3], **When** the user drags
   item 1 from "todo" and drops it at the end of "done", **Then** "todo" becomes [2] and "done"
   becomes [3, 1].
2. **Given** an item is being dragged over a column that is currently empty, **When** the user drops
   it there, **Then** that column now contains only the dropped item.
3. **Given** an item is dragged from one column toward another, **When** the pointer is released
   without ever entering a valid drop target, **Then** the operation is cancelled and both columns
   keep their original contents.

---

### User Story 3 - Reorder whole columns by dragging (Priority: P2)

A user drags an entire column (via its dedicated handle) to change the left-to-right (or top-to-
bottom) order of the board's stages.

**Why this priority**: Column order is set up once and rarely changed; it is valuable but not
required for the board's day-to-day task-tracking use.

**Independent Test**: Render a board with three columns; drag the middle column's handle and drop it
at the first position; verify the board's column order updates while each column's own items are
unaffected.

**Acceptance Scenarios**:

1. **Given** columns in order [backlog, inProgress, done], **When** the user drags the "done" column
   and drops it before "backlog", **Then** the order becomes [done, backlog, inProgress] and every
   column's item list is unchanged.
2. **Given** a column is marked disabled, **When** the user attempts to drag its handle, **Then** no
   drag starts and the column order does not change.

---

### User Story 4 - Operate the board entirely by keyboard (Priority: P1)

A keyboard-only or screen-reader user tabs to a card or column handle, picks it up with `Enter` or
`Space`, moves it with the arrow keys — including across columns — drops it with `Enter`/`Space`
again, and hears a spoken status update at every step.

**Why this priority**: Accessibility parity is a non-negotiable requirement of this project
(constitution Principle III); a kanban board that cannot be operated without a pointer fails that
requirement outright, so this ships alongside the pointer-driven stories, not after them.

**Independent Test**: With no pointer input, tab to an item's handle, press `Enter` to pick it up,
press the arrow key toward an adjacent column, press `Enter` to drop, and assert the item moved to
that column and that an `aria-live` region announced pick-up, the move, and the drop.

**Acceptance Scenarios**:

1. **Given** an item handle has focus, **When** the user presses `Space`, **Then** the item is
   picked up and a live region announces which item was grabbed, its position, and the total count.
2. **Given** an item is picked up, **When** the user presses the arrow key pointing toward a card in
   an adjacent column, **Then** the drop target moves into that column regardless of the board's
   configured layout orientation, and the live region announces the new position and destination
   column.
3. **Given** an item is picked up, **When** the user presses `Enter` again, **Then** the item drops
   at the announced position, the board updates, and the live region announces the final drop.
4. **Given** an item is picked up, **When** the user presses `Escape`, **Then** the drag is cancelled,
   the item returns to its original column and position, and the live region announces the
   cancellation.
5. **Given** a column handle has focus, **When** the user presses `Space`, moves with the arrow keys,
   and presses `Space` again, **Then** the column reorders the same way a pointer drag would, with
   matching announcements.

---

### User Story 5 - Preview the dragged card or column with an overlay (Priority: P2)

While dragging, the user sees a floating preview of the item or column following the pointer/focus,
including a preview whose content is computed per-drag (e.g. showing the full card for an item but a
whole mini-column for a column drag).

**Why this priority**: The overlay is a visual affordance that meaningfully improves the drag
experience but the board is fully usable — and independently testable — without it.

**Independent Test**: Start a drag on an item and assert an overlay element is present showing that
item's content; start a drag on a column and assert the overlay instead shows that column's content;
release and assert the overlay is removed.

**Acceptance Scenarios**:

1. **Given** no drag is in progress, **Then** no overlay content is rendered.
2. **Given** an item is being dragged, **When** the overlay's content is a function of the dragged
   value, **Then** it receives that item's identifier and a "item" variant and renders accordingly.
3. **Given** a column is being dragged, **When** the overlay's content is a function of the dragged
   value, **Then** it receives that column's identifier and a "column" variant and renders that
   column's own preview.

---

### Edge Cases

- What happens when an item or column value is an empty string? The part rejects it with a
  descriptive error at render time (matches upstream), since an empty identifier cannot be
  distinguished from "no value".
- What happens when the board's items are objects rather than primitives and no identifier extractor
  is supplied? Rendering throws a descriptive error the first time an object item is encountered,
  because there is no reasonable default identifier for an arbitrary object.
- What happens when the item being dragged is disabled? It cannot be picked up by pointer or
  keyboard; every other item/column keeps working normally.
- What happens when a column becomes empty after its last item is dragged out? The column remains
  rendered as a valid, empty drop target.
- What happens when a part (`Column`, `Item`, `ColumnHandle`, `ItemHandle`, `Overlay`) is rendered
  outside its required ancestor? Rendering throws an error naming both the part and the ancestor it
  requires.
- What happens under a right-to-left layout? Horizontal pointer and keyboard directions (dragging
  left/right, `ArrowLeft`/`ArrowRight`) invert to match the mirrored visual layout.
- What happens when a drop target is momentarily unreachable (e.g. the pointer is dragged clear of
  every column)? The operation is treated the same as a drop outside any target: nothing changes.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The board MUST render from a single value describing an ordered set of columns, each
  holding an ordered list of items, and MUST notify consumers of the updated value after every
  reorder or move.
- **FR-002**: Users MUST be able to reorder items within a column by pointer drag and drop.
- **FR-003**: Users MUST be able to move an item from one column to any position in a different
  column by pointer drag and drop.
- **FR-004**: Users MUST be able to reorder whole columns by pointer drag and drop, using a dedicated
  column drag handle.
- **FR-005**: Every pointer-driven interaction in FR-002 through FR-004 MUST have a keyboard
  equivalent: `Enter`/`Space` picks up and drops the focused item or column, the arrow keys move it,
  and `Escape` cancels the operation and restores its original position.
- **FR-006**: Keyboard movement across columns MUST resolve to the nearest valid item or column in
  the pressed arrow's absolute screen direction (up, down, left, right), independent of the board's
  configured layout orientation.
- **FR-007**: The board MUST expose an `aria-live` announcement at pick-up, at every change of drop
  target, and at drop or cancellation, each naming the item or column, its position, the total count,
  and — when an item changes columns — the destination column.
- **FR-008**: Items and columns MUST support an optional dedicated handle sub-part that exclusively
  activates dragging, and MUST also support making the entire item or column itself the drag
  activator when no separate handle is used.
- **FR-009**: The board MUST accept items that are primitive values (using the item itself as its
  identifier) or items that are objects (using a required identifier-extractor callback), and MUST
  raise a descriptive error if an object item is used without that callback.
- **FR-010**: Disabling an individual item or column MUST prevent it from being picked up by pointer
  or keyboard, without affecting any other item or column.
- **FR-011**: The board MUST support an optional floating overlay that previews the item or column
  currently being dragged, including a mode where the preview's content is computed per-drag from the
  dragged value and whether it is an item or a column.
- **FR-012**: The board MUST support a configurable layout orientation (horizontal or vertical, default
  horizontal) that controls both the columns' layout axis and the items' sort axis.
- **FR-013**: Dropping outside every valid target MUST cancel the operation and leave the board
  unchanged, whether triggered by pointer release or keyboard cancellation.
- **FR-014**: Under a right-to-left layout, horizontal pointer and keyboard directions MUST invert to
  match the mirrored visual order, consistent with the project's existing direction context.
- **FR-015**: Rendering a column, item, column handle, item handle, or overlay part outside its
  required ancestor MUST throw an error naming both the part and the required ancestor.
- **FR-016**: An empty-string item or column value MUST be rejected with a descriptive error rather
  than silently accepted.
- **FR-017**: The component MUST be distributed as an installable, source-based registry item under
  the project's UI component alias, with a public API (parts, props, callbacks, data attributes)
  matching the upstream component, and MUST ship a documentation page exercising every example shown
  on the upstream docs page.
- **FR-018**: Every drag activator — a dedicated handle, or the item or column itself when it acts as
  its own activator — MUST expose the draggable ARIA contract: an operable role and tab stop (a
  button role when the activator is not already a button element, and a tab stop when enabled), a
  role description identifying it as draggable, a description association pointing at the board's
  up-front keyboard instructions, a disabled state while it cannot be picked up, a pressed state
  while its item or column is grabbed, and — on a dedicated handle — a control association naming the
  item or column it operates.
- **FR-019**: The board MUST expose an observation hook for each stage of a drag — start, movement,
  change of drop target, end, and cancellation — each invoked with the identifier of the item or
  column being dragged and the identifier of the current drop target (or none), and MUST additionally
  expose a move hook that intercepts and replaces the default commit when the drag is dropped.
- **FR-020**: Each spoken announcement, and the up-front screen-reader instruction text, MUST be
  individually overridable by the consumer; any announcement the consumer does not override MUST keep
  its documented default text.
- **FR-021**: Every rendered part (column, item, and their handles) MUST allow the consumer to
  substitute their own underlying element while retaining registration, drag activation, and every
  documented data attribute.

### Key Entities

- **Board**: The overall kanban surface. Holds the ordered map of columns to their items, the current
  in-progress drag (if any), and the layout orientation.
- **Column**: A named, ordered group of items within the board. Can itself be dragged to reorder
  columns, and can be individually disabled.
- **Item**: A single unit of work belonging to exactly one column at a time. Identified either by its
  own primitive value or by an extracted identifier when items are objects. Can be individually
  disabled.
- **Drag Preview (Overlay)**: A transient, optional visual stand-in for whichever item or column is
  currently being dragged, shown only while a drag is in progress.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can reorder two items within a column via pointer drag and see the new order
  reflected as soon as they release the pointer.
- **SC-002**: A user can move an item from one column to another via pointer drag, with the item
  appearing only in the destination column immediately after the drop.
- **SC-003**: A user can reorder entire columns via pointer drag without any item leaving its
  original column.
- **SC-004**: A keyboard-only user can complete a full pick-up → cross-column move → drop cycle
  without ever using a pointer, and a spoken status update is available at each of those three steps.
- **SC-005**: In a right-to-left layout, every directional interaction (drag direction and arrow-key
  direction) that moved right in a left-to-right layout now moves left, and vice versa.
- **SC-006**: The component can be installed into a consuming project through this project's own
  component registry, the same way any first-party component is installed, with no manual
  post-install source edits.
- **SC-007**: Both upstream example boards (the standard board and the dynamic-overlay board) have a
  working, equivalent demonstration on this project's documentation site.
- **SC-008**: 100% of the upstream-documented keyboard interactions, ARIA roles/states, and
  cross-column keyboard movement with its announcements are covered by automated tests.

## Assumptions _(mandatory)_

- Only one upstream variant of Kanban exists at the pinned commit (under the "radix" base;
  `.reference/diceui` has no separate non-Radix "base" kanban) — this port targets that single
  variant, matching the constitution's pinned-commit rule.
- Per constitution Principle IV (Composition Over Reimplementation) and the explicit component
  guidance for this port, drag-and-drop is implemented by reusing this repository's existing
  sensor-agnostic drag engine (the `DndState`/`DragSession` module already exported for the `sortable`
  component), not by re-implementing pointer/keyboard sensors, collision detection, or activation
  constraints a second time. Only kanban-specific behaviour (cross-container moves, column-level
  dragging, the absolute-direction arrow mapping in FR-006, and kanban's own announcement text) is
  new code.
- Upstream's `coordinateGetter` resolves arrow keys to the closest item/column in the pressed
  screen direction regardless of the configured orientation — this is a deliberate divergence from
  `sortable`'s orientation-relative arrow mapping (where `ArrowUp`/`ArrowDown` only apply in a
  vertical list) and is reproduced as its own resolution rule on top of the shared drag engine,
  because a kanban board's columns and items occupy two axes at once.
- Upstream's `KanbanProps.value` is a required, always-controlled prop with no documented
  uncontrolled/`defaultValue` mode. Per this project's convention (every value-bearing prop is
  `$bindable` with a `defaultValue` fallback), the Svelte port still exposes `value` as bindable with
  an empty-object `defaultValue`, so the component can additionally be used uncontrolled like every
  other ported component — this is an additive divergence, not a removal of upstream capability.
- Upstream's conditional `getItemValue` requirement (required only when the item type is an object)
  is a TypeScript conditional type with no direct Svelte prop-type equivalent; parity is delivered by
  keeping `getItemValue` optional in the prop type and preserving upstream's runtime error the first
  time an object item is encountered without it (FR-009), matching upstream's own runtime behaviour.
- Upstream's `asChild`/Radix `Slot` composition and its function-as-`children` overlay content map to
  this project's `child` snippet and typed content snippets respectively, per the project's React →
  Svelte translation table; no Radix `Slot` equivalent is introduced.
- Upstream's `forwardRef`/`useComposedRefs` map to this project's `ref = $bindable(null)` plus
  `bind:this` pattern; no ref-composition utility is ported as a standalone module.
- The overlay's `ReactDOM.createPortal` to `document.body` is reproduced using this project's existing
  portal/overlay approach already established by the `sortable` component's own overlay part, rather
  than introducing a second portal mechanism.
- Only the two upstream example files (the standard board and the dynamic-overlay board) are in scope
  for the documentation page; no additional demos beyond what upstream documents are added.
- Upstream's dnd-kit-only surface reached through `DndContextProps` is **not ported**, because this
  port has no dnd-kit: `sensors`, `measuring`, `autoScroll`, `cancelDrop`, `collisionDetection`
  (upstream `Omit`s it anyway), `DragOverlay`'s `dropAnimation` / `adjustScale` / `transition` /
  `zIndex` / `wrapperElement`, `accessibility.container`, and `activatorEvent.defaultPrevented` as a
  per-handler opt-out — the drag event is narrowed to `{ active, over }` and `onMove` is the
  documented interception point instead.
- Upstream's arrow-key resolver aborts the whole resolution when it meets a disabled droppable, an
  unmeasured droppable, or a populated column during an item drag; because its loop walks every
  registered droppable, that disables keyboard movement outright on any populated board and
  contradicts upstream's own documented keyboard table, so this port skips such an entry and keeps
  scanning. Its `"placeholder"` and `+20/+74 px` container coordinate offsets are dropped because
  this port resolves an index, not a coordinate, and derives the delta from measured rects.
- Settled (non-dragged) items receive no sorting-strategy transform and no `transition: transform
  200ms`. The value array has already been reordered mid-drag, so a transform on a settled item would
  double-count the move; upstream only survives this because dnd-kit re-measures on every mutation and
  the recomputed transform collapses to zero. A purely visual difference.
- `strategy` is accepted, typed and documented but read by nothing — upstream stores it on its context
  and never consumes it either (its Board and Column derive their strategy from `orientation`).
  Dropping the prop would break parity for a consumer who passes it; applying it would be invented
  behaviour.
- `onMove` intercepts the column reorder, which is only ever committed on drop, but **reports** the
  same-column item reorder rather than suppressing it. `onDragOver` commits that reorder while the
  drag is still running — unconditionally and through `onValueChange` only, which is what makes the
  board reflow under the pointer — so by the time the drop arrives there is nothing left to suppress;
  `onMove` then receives the net `{ activeIndex, overIndex }` of the whole drag. Making `onMove`
  suppress it instead would cost every consumer who supplies `onMove` the live reflow that defines a
  kanban board.
- Added beyond upstream: restoring the board on cancel — `Escape` and a pointer cancel republish the
  board as it stood at pick-up whenever a mid-drag commit already happened, as FR-005 requires;
  upstream's `onDragCancel` only clears the active id and leaves the item where the mid-drag commit
  put it. A cancel with nothing to undo publishes nothing.
- Added beyond upstream: `dir` plus inversion of horizontal pointer and arrow-key directions under
  RTL (FR-014, required by constitution Principle III); the `data-value`, `data-flat-cursor`,
  `data-variant` and `data-slot` attributes on every part (constitution Principle VIII — component
  state must be styleable from outside, and additions never remove a documented attribute);
  per-builder `accessibility.announcements` overrides; and the overlay's `container` prop accepting a
  CSS-selector string in addition to upstream's `Element | DocumentFragment | null`.
