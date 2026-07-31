# Feature Specification: Sortable

**Feature Branch**: `036-port-sortable`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Sortable\" (slug: sortable) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Reorder a list by dragging (Priority: P1)

A user viewing a list of items (a card grid, a table, a tag list) drags an item with a pointer or
touch input and drops it at a new position; the list re-renders in the new order and the app is told
about the change.

**Why this priority**: This is the entire purpose of the component. Without pointer-driven reordering
there is no product to ship.

**Independent Test**: Render a list of 4+ items inside the composed parts, press and drag one item
past a neighbour, release, and confirm the neighbour list order changed and the app's `value`/
`onValueChange` reflects the new order.

**Acceptance Scenarios**:

1. **Given** a list of items rendered in `SortableContent`, **When** the user presses down on an
   item and drags it past a neighbouring item, **Then** the dragged item visually swaps position with
   that neighbour before release.
2. **Given** an in-progress drag, **When** the user releases the pointer over a valid position,
   **Then** the list's order is committed: an uncontrolled list updates itself and a controlled list
   fires its change callback with the new order, and the previously dragged item shows no residual
   "dragging" state.
3. **Given** an in-progress drag, **When** the user releases the pointer outside any droppable area,
   **Then** the item returns to its last committed position and no change callback fires.
4. **Given** an item marked disabled, **When** the user attempts to press and drag it, **Then** the
   item does not become draggable and the list order is unchanged.

---

### User Story 2 - Reorder a list with the keyboard only (Priority: P1)

A keyboard-only or screen-reader user tabs to an item, picks it up, moves it with the arrow keys, and
drops it, hearing an announcement at each step, without ever touching a pointer device.

**Why this priority**: Equal priority to User Story 1 — a sortable list that cannot be operated without
a pointer fails the project's accessibility bar (§Accessibility parity) and would ship a defect on
day one, not a follow-up.

**Independent Test**: Tab to a sortable item, press Space/Enter to grab it, press the arrow key for the
list's orientation to move it one position, press Space/Enter to drop, and confirm the order changed
and matching announcements were exposed to assistive technology at each step.

**Acceptance Scenarios**:

1. **Given** focus is on a sortable item (or its handle, when the item uses one), **When** the user
   presses Space or Enter, **Then** the item is picked up and an announcement reports the item's label
   and its current position out of the total count.
2. **Given** an item is picked up and the list orientation is vertical, **When** the user presses
   ArrowUp or ArrowDown, **Then** the item moves one position up or down and an announcement reports
   the new position; horizontal orientation responds to ArrowLeft/ArrowRight instead, and mixed
   orientation responds to any arrow key using nearest-position detection.
3. **Given** an item is picked up, **When** the user presses Space or Enter again, **Then** the item
   is dropped at its current position, the order change is committed exactly as in a pointer drop, and
   an announcement confirms the final position.
4. **Given** an item is picked up, **When** the user presses Escape, **Then** the item returns to its
   original position, no order change is committed, and an announcement confirms the cancellation.
5. **Given** the document is set to a right-to-left direction, **When** the user presses ArrowLeft or
   ArrowRight on a horizontally- or mixed-oriented list, **Then** the direction of movement is mirrored
   relative to the visual layout, consistent with the project's other directional components.

---

### User Story 3 - Compose a drag handle, overlay, and object/primitive item values (Priority: P2)

A developer building a feature (e.g. a trick list, a table row list, a tag list) wants to restrict
dragging to a handle element, show a floating preview of the dragged item while it moves, and use
either plain strings/numbers or full objects as the underlying list data.

**Why this priority**: These are documented, commonly used compositions (three of the four upstream
examples exercise them) but the list is still usable — just whole-row-draggable, with no floating
preview — without them, so they rank below the two P1 stories.

**Independent Test**: Render the handle example, confirm dragging only initiates from the handle and
not the rest of the row; render the dynamic-overlay example, confirm a floating preview follows the
pointer during a drag and disappears on drop; render the primitive-values example, confirm no
identifier-extraction callback is required.

**Acceptance Scenarios**:

1. **Given** an item configured to use a drag handle, **When** the user presses and drags anywhere on
   the item body outside the handle, **Then** no drag starts; **When** the user presses and drags the
   handle itself, **Then** the drag starts normally.
2. **Given** a list configured with a floating overlay, **When** an item is being dragged, **Then** a
   visual copy of that item (or of custom content the developer supplies, driven by the identifier of
   the active item) follows the pointer/keyboard-driven position, appears above all other content, and
   is removed the moment the drag ends or is cancelled.
3. **Given** a list backed by an array of plain strings or numbers, **When** the developer renders the
   list without supplying an identifier-extraction function, **Then** each item's own value is used as
   its identifier and reordering works exactly as with an object array that does supply one.
4. **Given** a list backed by an array of objects without supplying an identifier-extraction function,
   **When** the component mounts, **Then** it raises a clear developer-facing error identifying that
   the function is required for object arrays.

---

### Edge Cases

- An item is added to or removed from the underlying array while a drag is in progress — the active
  drag is treated as cancelled rather than operating on stale indices.
- Two `SortableContent` regions are composed inside a single `Sortable` root (documented upstream as
  supported) — items can be inspected as one shared identifier space; cross-region dragging between
  the two regions is out of scope for this port (upstream itself only demonstrates one region per
  root, and the multi-region cross-drag path is not covered by any upstream example, test, or MDX
  prose — see Assumptions).
- An `Item` is rendered with an empty-string value — a clear developer-facing error is raised, matching
  upstream, because the empty string cannot be reliably distinguished from "no value" by identifier
  comparisons.
- An `Item` or `ItemHandle` is rendered outside of its required ancestor (`Content`/`Overlay` for
  `Item`; `Root` for any part) — a clear developer-facing error names both the misused part and the
  required ancestor.
- The list has a single item, or is empty — no drag can produce a reorder; the component renders
  without error and announces nothing on interaction with a lone item beyond pick-up/drop of itself.
- The mixed orientation is used with a non-grid, purely linear layout — nearest-position collision
  detection still applies; the visual result depends on the developer's chosen layout, which is their
  responsibility, not the component's.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST accept a controlled `value` array of the developer's own item type
  and an `onValueChange` callback, and MUST also work in an uncontrolled mode seeded once by a
  `defaultValue`-style initial value, consistent with every other ported component's controlled/
  uncontrolled convention.
- **FR-002**: The component MUST derive a unique identifier for each item via a developer-supplied
  extraction function when items are objects, and MUST use the item's own value as its identifier when
  items are primitives (string or number) and no extraction function is supplied.
- **FR-003**: The component MUST raise a clear, developer-facing error at first render when items are
  objects and no identifier-extraction function was supplied.
- **FR-004**: The component MUST support three list orientations — vertical, horizontal, and mixed
  (grid-like, any direction) — each with the collision-detection and axis-restriction behaviour
  documented upstream for that orientation, and MUST allow a developer to override the default
  collision detection.
- **FR-005**: The component MUST let a developer intercept a completed reorder via an `onMove`-style
  callback that receives the source and destination positions, bypassing the default automatic
  array-splice behaviour when supplied.
- **FR-006**: Dragging MUST be operable with a pointer (mouse) and with touch input, reproducing
  upstream's press-and-hold-then-drag activation behaviour so that ordinary taps and scrolls are not
  misinterpreted as drags.
- **FR-007**: Dragging MUST be fully operable from the keyboard alone: Space or Enter picks up the
  focused item, the orientation-appropriate arrow keys move it one position at a time (mixed
  orientation accepts any arrow key and resolves the nearest valid position), Space or Enter again
  drops it and commits the reorder, and Escape cancels the drag and restores the original position.
- **FR-008**: Every meaningful drag lifecycle event (pick up, move, drop with a change, drop with no
  change, cancel) MUST produce a screen-reader announcement describing the acted-on item and its
  position out of the total item count, and MUST provide upfront screen-reader instructions describing
  how to operate the widget, matching or exceeding upstream's announcement text.
- **FR-009**: An item MUST support a `disabled` state that prevents it from being picked up by pointer,
  touch, or keyboard, is reflected as a `disabled` state attribute on the item (and on its handle, when
  used), while still allowing other items to be reordered around it.
- **FR-010**: An item MUST optionally restrict drag activation to a dedicated handle sub-part; when a
  handle is present, only interacting with the handle initiates a drag, and the handle inherits the
  item's disabled state unless a developer explicitly overrides it.
- **FR-011**: The component MUST support an optional floating overlay that renders a preview of the
  actively dragged item (either a fixed snippet or one that receives the active item's identifier to
  render custom per-item content), appears only while a drag is active, and is removed as soon as the
  drag ends or is cancelled.
- **FR-012**: Every part MUST expose the state a developer needs to style it — at minimum, a dragging
  state on the active item (and its handle) and a disabled state on any disabled item (and its
  handle) — through inspectable state attributes, following this project's existing `data-*`
  attribute convention.
- **FR-013**: Using `Item`, `ItemHandle`, `Content`, or `Overlay` outside of their required ancestor
  MUST raise a clear, developer-facing error naming both the misused part and the required ancestor,
  matching this project's existing context-provider error convention.
- **FR-014**: Rendering an `Item` with an empty-string identifier MUST raise a clear, developer-facing
  error, matching upstream.
- **FR-015**: The component MUST support right-to-left layouts: in a right-to-left context, the
  keyboard directions for horizontal and mixed-orientation movement MUST mirror so that ArrowLeft and
  ArrowRight continue to match the visually-left and visually-right neighbour, consistent with how
  every other directional component in this project handles `dir="rtl"`.
- **FR-016**: Every part that renders an element (the content region, an item and its handle) MUST
  accept the same escape hatches this project's other ported components offer for supplying custom
  markup on that element (a custom element/component in place of the default), so a developer can
  compose the sortable behaviour onto an existing element (a table row, an existing card) without an
  extra wrapping element. The root renders no element of its own, and the overlay's floating element
  is component-owned, so neither offers this escape hatch.
- **FR-017**: A developer MUST be able to opt an item, its handle, and the drag overlay out of the
  drag-affordance pointer cursor styling (grab/grabbing) in favour of a neutral cursor, for cases
  where the drag affordance would be visually redundant or misleading.
- **FR-018**: The component MUST be installable and documented exactly like this project's other
  first-party UI components: source under the project's UI component directory with an index barrel,
  one registry entry, and one demo page exercising every documented example.
- **FR-019**: The component MUST expose the five drag-lifecycle notification callbacks upstream
  documents — drag start, drag move, drag over-target change, drag end and drag cancel — each
  receiving the active item and the current drop target (or nothing, when there is none). They MUST
  fire for pointer-driven and keyboard-driven drags alike, drag-end MUST fire before the reorder is
  committed, and drag-cancel MUST fire on Escape, on a drop outside any droppable, and when the
  active item is removed from the list mid-drag.
- **FR-020**: A developer MUST be able to override the screen-reader text without forking the
  component: each of the five announcement builders (pick up, move, over, drop, cancel) and the
  upfront instructions text MUST be individually replaceable, with any builder left unsupplied
  falling back to the component's default text.
- **FR-021**: The content region MUST support rendering its items with no wrapping element at all, for
  layouts (table bodies, existing grids) where an extra wrapper would break the parent's layout
  contract.

### Key Entities

- **Sortable list**: An ordered collection of developer-owned items (objects or primitives), plus the
  identifier-extraction rule used to tell items apart, the current orientation, and which item (if any)
  is currently being dragged.
- **Sortable item**: One entry in the list — its underlying value, its position, whether it is
  disabled, whether it is currently being dragged, and whether it uses a dedicated handle.
- **Drag session**: The transient state that exists only while a drag is active — the identifier of
  the item being dragged, its position at pick-up, its current candidate position, and whether the
  session will end in a committed reorder or a cancellation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can reorder any two items in a list by dragging with a pointer, and the new order
  is reflected in the rendered list and reported to the hosting application, in a single drag gesture
  with no page reload.
- **SC-002**: A keyboard-only user can move any item to any other valid position in the list and commit
  or cancel that move, using only Tab, Space/Enter, the arrow keys, and Escape, with no pointer input
  at any point.
- **SC-003**: Every pick-up, move, drop, and cancel during a drag produces an announcement a screen
  reader can speak, verified by inspecting the exposed accessible announcement text during automated
  testing.
- **SC-004**: All four upstream-documented usage patterns (default composition, drag handle, dynamic
  overlay, primitive values) render and are fully operable on the project's demo page, matching the
  behaviour described in the upstream documentation.
- **SC-005**: Reordering is available on the same list in vertical, horizontal, and mixed layouts
  without changing any code other than the orientation setting.
- **SC-006**: In a right-to-left layout, horizontal keyboard reordering feels mirrored rather than
  reversed-and-confusing: moving an item "toward the start" always uses the same visual arrow key
  users already associate with "start" elsewhere in the project.
- **SC-007**: The component is installable through the project's own component registry the same way
  every other first-party component is, with no manual post-install steps beyond what the registry
  already automates for other components.

## Assumptions

- **Cross-region dragging out of scope**: Upstream's `SortableContent` supports being used more than
  once inside a single `Sortable` root, but neither the upstream source, its test file, nor any of the
  four documented examples demonstrate dragging an item from one `SortableContent` region into another
  — every example nests exactly one `SortableContent`. This port reproduces multi-region composition
  (multiple `Content` parts sharing one root's identifier space) but treats dragging an item across
  region boundaries as out of scope, matching the coverage upstream actually ships and validates.
- **No React-only escape hatch carried over**: upstream's overlay renders through a React portal into
  `document.body` by default. This port keeps the "float above everything, remove on drag end"
  behaviour but replaces the React-specific portal mechanism with whatever elevated-rendering approach
  this project's other overlay-style components (e.g. dialog, popover, drawer) already use, so the
  behaviour is preserved without a React compatibility shim.
- **DnD engine is an implementation decision, not a spec decision**: upstream is built on the
  React-only `@dnd-kit` family of packages. This spec describes the required pointer, touch, and
  keyboard behaviour, announcements, and states independent of any particular engine; the choice of
  a Svelte-ecosystem drag library versus a bespoke pointer/keyboard implementation — and the design of
  the reusable drag-core module the upcoming `kanban` port will also depend on — is a planning-phase
  decision, made and justified in this feature's plan, not in this spec.
- **`getItemValue` typing simplification**: upstream uses a conditional TypeScript type to force
  `getItemValue` to be required only when `T` is inferred as an object type, which has no direct
  Svelte/TypeScript equivalent without generic component type parameters behaving identically to
  React's. This port keeps `getItemValue` an always-optional prop at the type level and instead
  enforces the "required for object arrays" rule at runtime (FR-003), matching upstream's actual
  runtime behaviour and its documented error message.
- **Drag activation thresholds**: upstream relies on `@dnd-kit`'s default pointer/touch sensor
  activation constraints (small movement/delay thresholds that distinguish a tap or scroll from a
  drag) without documenting exact numbers in the MDX. This port reproduces the same intent — ordinary
  taps and scrolls must not start a drag — using whichever thresholds its chosen implementation
  provides or a reasonable default informed by platform conventions, rather than matching an
  undocumented exact millisecond/pixel value.
- **dnd-kit-only props not ported**: upstream's `Sortable` inherits `DndContextProps`. The following
  carry no meaning outside React + `@dnd-kit` and are deliberately not ported: `sensors` (the sensor
  set is fixed; activation is tuned per pointer type), `measuring` (this port snapshots rects at drag
  start and re-measures on `over` change, so there is no measuring-strategy matrix), `autoScroll`
  (auto-scrolling during a drag is out of scope for this port), `cancelDrop` (no upstream example, no
  MDX row, no requirement), and `accessibility.container` (the live region renders inside the root's
  own output). `Sortable.Overlay` likewise drops `dropAnimation`, `wrapperElement`, `zIndex`,
  `adjustScale` and `transition`: the overlay unmounts immediately on drop, which is what FR-011
  requires.
- **No `defaultPrevented` opt-out on lifecycle callbacks**: upstream reads
  `event.activatorEvent.defaultPrevented` inside its own `onDragStart`/`onDragEnd`/`onDragCancel`
  handlers (sortable.tsx:163, 174, 200) and skips its internal state update and reorder commit when a
  consumer calls `preventDefault()` on the activator event. This port narrows the event payload to
  `{ active, over }` (FR-019) and therefore drops that opt-out: the lifecycle callbacks are pure
  notifications and can no longer veto the commit. A consumer that needs to intercept a reorder uses
  `onMove` (FR-005), which is the supported and documented interception point.
- **Drag event payloads narrowed**: upstream's `DragStartEvent`/`DragEndEvent` are passed verbatim to
  `onDragStart`/`onDragMove`/`onDragOver`/`onDragEnd`/`onDragCancel`/`onMove`. This port narrows them
  to `{ active, over }` (plus `activeIndex`/`overIndex` for `onMove`), because the remaining members
  (`delta`, `collisions`, `activatorEvent`) are dnd-kit internals with no equivalent here.
- **Sorting/collision/modifier prop types replaced**: the `strategy`, `collisionDetection` and
  `modifiers` props keep their upstream names and their per-orientation defaults, but their function
  signatures are this port's own types rather than dnd-kit's.
- **`asChild` becomes the `child` snippet**: every upstream `asChild` prop (`Content`, `Item`,
  `ItemHandle`) is replaced by this project's `child` snippet convention (FR-016), matching every
  other ported component in this repository.
- **Props added beyond upstream**: `defaultValue` (uncontrolled mode, FR-001, required by this
  project's controlled/uncontrolled convention), `dir` (RTL, FR-015, required because every other
  directional component in this repository takes it), and the `data-flat-cursor` attribute (makes the
  existing `flatCursor` prop styleable from outside, FR-012/FR-017).
- **Handle is a native button, not the `Button` component**: the upstream MDX prose says the handle
  "extends the base `Button` component", but the upstream source renders a plain
  `<button type="button">` with its own class list and no button variants. This port follows the
  source; consumers who want button styling compose `Button` through the handle's `child` snippet, as
  the handle demo does.
