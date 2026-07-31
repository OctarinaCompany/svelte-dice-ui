# Phase 0 Research: Sortable

**Feature**: `036-port-sortable` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

Upstream, at the pinned commit `d9763d82530416dfa4c81c462387b55d06bae4ec`:

| Artefact  | Path                                                             | Size       |
| --------- | ---------------------------------------------------------------- | ---------- |
| Source    | `.reference/diceui/docs/registry/bases/radix/ui/sortable.tsx`    | 577 lines  |
| Docs      | `.reference/diceui/docs/content/docs/components/radix/sortable.mdx` | 258 lines |
| Demos     | `.reference/diceui/docs/registry/bases/radix/examples/sortable-{,dynamic-overlay-,handle-,primitive-values-}demo.tsx` | 4 files |
| Tests     | — none ship upstream for this component                           | —          |

The spec left three questions open for this phase (spec §Assumptions): the drag engine, the portal
mechanism, and the activation thresholds. All three are resolved below, together with 22 further
decisions the design needs. **No `[NEEDS CLARIFICATION]` marker remains anywhere in this feature.**

---

## R-01 — Drag engine: bespoke runes core, not a third-party Svelte DnD library

**Decision**: implement the drag-and-drop engine by hand, in this repository, as two files inside the
`sortable` folder: `sortable-geometry.ts` (pure, rune-free maths) and `sortable-dnd.svelte.ts` (the
rune state classes). Add **zero** npm dependencies.

**Rationale**:

1. Upstream's engine (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`,
   `@dnd-kit/utilities`) is React-only — it is built out of `useContext`, `useSyncExternalStore` and
   React refs. There is no Svelte build of it.
2. Constitution IV orders the sourcing: existing `src/lib/components/ui/*` → `bits-ui` → bespoke.
   **`bits-ui` 2.18 ships no drag-and-drop primitive at all** — no draggable, no droppable, no
   sensor, no collision detection, no sortable context. The only primitive it contributes here is
   `Portal`, which the overlay uses (R-09). There is nothing to compose for the drag itself.
3. The candidate libraries were evaluated and rejected:
   - **`svelte-dnd-action`** — a `use:` action over a whole zone that *mutates and re-emits the item
     array on a `consider`/`finalize` CustomEvent pair*. It owns the DOM ordering, which is
     incompatible with a compound-component API where `Sortable.Item` is authored by the consumer
     and identified by a `value` prop; it dispatches DOM CustomEvents (constitution I forbids the
     event-dispatch idiom as the public API); and its announcement text is fixed by the library, so
     upstream's exact announcement strings (FR-008) could not be reproduced.
   - **`@dnd-kit-svelte` / `dnd-kit-svelte`** — community forks, unversioned against dnd-kit v6,
     no Svelte 5 runes support in their published builds, and they would still not give us the
     `sortable` composition; a dependency with that risk profile cannot be pinned responsibly for a
     source-distributed registry.
   - **`@atlaskit/pragmatic-drag-and-drop`** — framework-agnostic and excellent, but it deliberately
     ships *no* sorting strategy, *no* collision detection and *no* keyboard sensor; every behaviour
     this component needs would still be bespoke, on top of a 3-package dependency.
4. Kanban is next and will reuse the core (R-02). Owning the core means the multi-container
   behaviour kanban needs can be designed in rather than worked around.

**Alternatives considered**: see above. **Consequence**: recorded in plan.md under "Bespoke
behaviour justification (Principle IV)" — this is the single largest bespoke area in the port.

---

## R-02 — The reusable core lives inside the `sortable` folder, and `kanban` depends on `sortable`

**Decision**: `sortable-geometry.ts` and `sortable-dnd.svelte.ts` live in
`src/lib/components/ui/sortable/`, are listed in the single `sortable` registry entry, and are
re-exported from `src/lib/components/ui/sortable/index.ts`. The future `kanban` port imports them as
`$lib/components/ui/sortable/index.js` and declares `"registryDependencies": ["sortable"]`.

**Rationale**: constitution V is explicit — a component lives in *exactly one* folder and appends
*exactly one* registry entry. Minting a second registry item (a `dnd` folder) from this feature
would append two entries from one port. The registry already models exactly this relationship:
`file-upload` declares `"registryDependencies": ["direction-provider"]` for shared infrastructure it
does not own. Consumers installing `kanban` also receive `sortable`; that is the standard shadcn
trade-off and is cheaper than the alternative failure mode, where the two components silently drift
apart.

**Alternatives considered**: (a) a standalone `dnd` registry item — rejected, two entries from one
port; (b) duplicating the engine into `kanban` — rejected, guarantees drift and doubles the
accessibility surface.

**What the core must expose for kanban** (kanban moves items *between* columns, and drags columns
themselves): the droppable registry is keyed by `id` and carries a `containerId` plus a
`type: 'item' | 'container'`, and collision detection is run over a caller-supplied subset of the
registry. Sortable registers one container and N items; kanban will register C containers and N
items without changing the core.

---

## R-03 — Sensors and activation constraints

**Decision**: one pointer sensor built on Pointer Events, discriminating on `event.pointerType`:

| Pointer type   | Activation constraint                              |
| -------------- | -------------------------------------------------- |
| `mouse`, `pen` | distance — 5 px of movement before the drag starts |
| `touch`        | delay — 250 ms hold, cancelled by 5 px of movement |

plus one keyboard sensor (R-04). A drag never starts from a secondary mouse button
(`event.button !== 0`), from a `[data-no-dnd]` subtree, or from a native interactive descendant
(`button`, `input`, `select`, `textarea`, `a[href]`, `[contenteditable]`) unless that element *is*
the activator.

**Rationale**: spec FR-006 requires that ordinary taps and scrolls not be read as drags, and the
spec's Assumptions delegate the exact numbers here. dnd-kit does not document numbers for a bare
`useSensor(MouseSensor)`/`useSensor(TouchSensor)`, but 5 px / 250 ms + 5 px are dnd-kit's own
documented recommended constraints and match the platform conventions used by the native HTML5 drag
threshold and by Android's touch-slop.

**Implementation note**: pointer capture is taken on the activator so the drag survives the pointer
leaving the element; `touch-action: none` is applied to the activator (upstream sets `touch-none`
when `asHandle`), and the sensor calls `preventDefault()` on `touchstart`-equivalents only *after*
activation, so a page scroll started before the delay elapses is never stolen.

---

## R-04 — Keyboard sensor: index-first, geometry-assisted

**Decision**: the keyboard sensor resolves an arrow key to a **target index in the root's items
array**, not to a pixel coordinate:

| Orientation  | Key                       | Target                                              |
| ------------ | ------------------------- | --------------------------------------------------- |
| `vertical`   | `ArrowUp` / `ArrowDown`   | previous / next enabled index                        |
| `horizontal` | `ArrowLeft` / `ArrowRight`| previous / next enabled index, **mirrored under RTL**|
| `mixed`      | any arrow                 | nearest enabled droppable whose centre lies in the pressed direction; **falls back to previous/next enabled index when no rect discriminates** |

`Space`/`Enter` picks up and drops; `Escape` cancels; `Tab` during an active keyboard drag is
swallowed (focus must not leave a grabbed item). Disabled items are not droppable, so "next enabled
index" skips them — which is exactly what dnd-kit's `sortableKeyboardCoordinates` does, since a
disabled `useSortable` is never registered as a droppable container.

**Rationale**: dnd-kit's `sortableKeyboardCoordinates` returns a *coordinate*, then runs the normal
collision pipeline over it. Reproducing that faithfully makes the keyboard path untestable in this
repo, because **jsdom performs no layout: every `getBoundingClientRect()` returns an all-zero
`DOMRect`**, so every centre-distance is 0 and collision detection cannot discriminate. Resolving to
an index first yields identical observable behaviour for list layouts (which is what `vertical` and
`horizontal` are), keeps the geometric path for `mixed` where it genuinely matters, and leaves the
whole keyboard interaction set (FR-007, US2, SC-002) assertable in jsdom. The fallback is not a test
hack — a degenerate-rect list is also what a keyboard user gets on a not-yet-laid-out or
`display: contents` container in a real browser.

**Alternatives considered**: coordinate-first with rect stubs in every keyboard test — rejected;
it would make each of the ~20 keyboard assertions depend on a hand-authored layout fixture, and the
`vertical` case would still degrade to index arithmetic anyway.

---

## R-05 — Collision detection

**Decision**: port two detectors as pure functions in `sortable-geometry.ts`:

- `closestCenter` — ranks droppables by the distance between the collision rect's centre and each
  droppable rect's centre. Default for `vertical` and `horizontal`.
- `closestCorners` — ranks by the summed distance between the four corresponding corners. Default
  for `mixed`.

Both take `{ collisionRect, droppables }` and return a `SortableCollision[]` sorted nearest-first,
so a caller-supplied `collisionDetection` prop (FR-004) is a drop-in replacement. This is upstream's
`orientationConfig[orientation].collisionDetection` mapping, unchanged.

**Rationale**: these two are the only detectors upstream references; `pointerWithin`,
`rectIntersection` and `getFirstCollision` are not used by `sortable.tsx` and are not ported.
Kanban's custom `collisionDetection` (kanban.tsx:112) is built from `closestCorners` + `closestCenter`,
so both are needed by the next port anyway.

---

## R-06 — Sorting strategies (the "swap before release" preview)

**Decision**: port three strategies as pure functions:

| Strategy                       | Used by                | Transform for item at `index`                                     |
| ------------------------------ | ---------------------- | ----------------------------------------------------------------- |
| `verticalListSortingStrategy`  | `orientation="vertical"` | `y` shifted by the active item's outer height, sign by direction |
| `horizontalListSortingStrategy`| `orientation="horizontal"` | `x` shifted by the active item's outer width               |
| `rectSortingStrategy`          | `orientation="mixed"`  | `{x, y}` = target slot rect origin − own rect origin              |

`orientationConfig.mixed.strategy` is `undefined` upstream, which makes dnd-kit's `SortableContext`
fall back to its own default, `rectSortingStrategy`. Porting that default explicitly (rather than
leaving `undefined`) preserves behaviour and removes a null branch.

**Rationale**: spec US1 AS-1 requires the dragged item to visually swap with its neighbour *before*
release; upstream never mutates `value` mid-drag, so this preview is entirely the strategy's
transform. Reproducing the three strategies is what makes that acceptance scenario true.

---

## R-07 — Modifiers

**Decision**: port three modifiers with the signature
`(args: { transform, activeRect, containerRect }) => Coordinates`:

- `restrictToVerticalAxis` → `{ x: 0, y }`
- `restrictToHorizontalAxis` → `{ x, y: 0 }`
- `restrictToParentElement` → clamps the transform so the translated active rect stays inside
  `containerRect`.

Defaults follow upstream exactly: `vertical` → `[restrictToVerticalAxis, restrictToParentElement]`,
`horizontal` → `[restrictToHorizontalAxis, restrictToParentElement]`, `mixed` →
`[restrictToParentElement]`. A caller-supplied `modifiers` array replaces the default wholesale, as
upstream's `modifiers ?? config.modifiers` does.

**`containerRect` definition**: dnd-kit's `restrictToParentElement` clamps against the *dragged
node's own parent element*, not against the `SortableContent` element. That distinction matters for
the handle demo, where `SortableContent` is `asChild`-ed onto `<TableBody>`, and for
`withoutSlot` (R-12) where no content element exists at all. The core therefore snapshots
`activeNode.parentElement.getBoundingClientRect()` at drag start.

---

## R-08 — Whether the drag source follows the pointer depends on the overlay

**Decision**: while a drag is active,

- **an `Overlay` is mounted** → the active item receives **no** transform; it stays in place with
  `data-dragging` (upstream styles it `opacity-50`) and the overlay is what follows the pointer;
- **no `Overlay` is mounted** → the active item receives the raw (modifier-clamped) pointer delta,
  so it follows the pointer itself.

Non-active items always receive their strategy transform (R-06).

**Rationale**: this is dnd-kit's `shouldDisplaceDragSource = !useDragOverlay` rule inside
`useSortable`, and without it either the item ghosts under the overlay (double image) or an
overlay-less list becomes undraggable-looking. The root state tracks a mounted-overlay count so the
rule is derived, not configured.

---

## R-09 — Overlay: `bits-ui` `Portal`, fixed positioning, no drop animation

**Decision**: `Sortable.Overlay` renders through `bits-ui`'s `Portal` (the project's existing portal
primitive, already wrapped by `action-bar-portal.svelte`, `dialog-portal.svelte`,
`combobox-portal.svelte`), defaulting to `document.body`, with the same
`Element | DocumentFragment | string | null` `container` prop upstream exposes — the
`DocumentFragment` case reuses the `display: contents` host trick already written for
`action-bar-portal.svelte`. The overlay element is `position: fixed`, sized and placed from the
active item's snapshot rect, translated by the modifier-clamped delta, and `pointer-events: none`.
It mounts on drag start and **unmounts immediately** on drop or cancel.

Upstream's `dropAnimation` (a `@dnd-kit/core` `DropAnimation` object with
`defaultDropAnimationSideEffects`) is **not** ported.

**Rationale**: spec FR-011 and US3 AS-2 require the overlay to appear only while a drag is active and
be "removed the moment the drag ends or is cancelled" — which is precisely the no-drop-animation
behaviour. Porting dnd-kit's drop animation would mean porting its keyframe/side-effect machinery for
a purely decorative 250 ms fade that the spec does not ask for. Recorded in the divergence register
(R-18).

---

## R-10 — Announcements, live region and screen-reader instructions

**Decision**: the root renders two visually-hidden elements (constitution VIII: `sr-only`, no
inline hidden-style object):

```html
<div id="{uid}-live" role="status" aria-live="assertive" aria-atomic="true" class="sr-only">…</div>
<div id="{uid}-instructions" class="sr-only">…</div>
```

The five announcement builders are copied **verbatim** from `sortable.tsx:207-248`, including
punctuation and the 1-based positions, and the instructions text from `sortable.tsx:250-259`
including its orientation branch (`"up and down"` / `"left and right"` / `"arrow"`). Every builder is
overridable through `accessibility.announcements`, and the instructions through
`accessibility.screenReaderInstructions`, exactly as upstream merges them.

`onDragMove`'s announcement is emitted **only when the resulting text changes** (i.e. when the `over`
target changes, or when the drag leaves/enters the droppable area) rather than on every pointer
frame; the `onDragMove` *callback prop* still fires on every frame.

**Rationale**: upstream registers an `onDragMove` announcement and dnd-kit invokes it on every
pointer move, writing the same string into an `aria-live="assertive"` region dozens of times a
second. Screen readers only speak a live region when its content changes, so the emitted text
sequence is identical either way; gating it removes a per-frame DOM write and makes the
announcement sequence deterministic enough to assert (SC-003). Recorded as a divergence.

---

## R-11 — The draggable ARIA attribute set is reproduced, not invented

**Decision**: the activator (the `Item` when `asHandle`, otherwise the `ItemHandle`) carries exactly
dnd-kit's `useSortable().attributes`:

| Attribute              | Value                                                     |
| ---------------------- | --------------------------------------------------------- |
| `role`                 | `"button"` (only when the element is not already a button) |
| `tabindex`             | `0`                                                        |
| `aria-disabled`        | `true` when disabled                                       |
| `aria-pressed`         | `true` while dragging, absent otherwise                    |
| `aria-roledescription` | `"sortable"`                                               |
| `aria-describedby`     | the root's `{uid}-instructions` id                         |

**Rationale**: constitution III requires the WAI-ARIA pattern and upstream parity; this set *is*
upstream's behaviour (`useSortable` overrides `useDraggable`'s default `roleDescription` of
`"draggable"` with `"sortable"`). `ItemHandle` renders a real `<button type="button">`, so `role` is
omitted there and `disabled` is a real attribute; upstream additionally wires
`aria-controls={itemContext.id}` on the handle, which is reproduced.

---

## R-12 — `asChild` → `child` snippet; `withoutSlot` retained

**Decision**: every part's `asChild` becomes the project's `child` snippet prop,
`child?: Snippet<[{ props: <Part>ChildProps }]>`, matching `file-upload`, `marquee` and `action-bar`:
in `child` mode the caller owns the element, `children` is not rendered, and `ref` stays `null`.
`SortableContent`'s `withoutSlot` boolean is kept verbatim — when `true` the part renders only its
children and no element at all.

**Rationale**: constitution II (every documented prop reproduced) and the established repo
translation of `asChild` (§10 of `CLAUDE.md`). `withoutSlot` is a documented upstream prop with a
direct Svelte meaning and no `Slot` dependency, so it survives unchanged.

**Consequence for the handle demo**: `Sortable.Content` is used with `child` onto `<Table.Body>` and
`Sortable.Item` with `child` onto `<Table.Row>`. Because the item's drag attributes are handed to the
caller through `props`, that composition works without an extra wrapper element (FR-016).

---

## R-13 — `getItemValue` and the two documented throws

**Decision**:

- `getItemValue?: (item: T) => UniqueIdentifier` is **always optional at the type level** (spec
  Assumptions), and the "required for array of objects" rule is enforced at runtime, at the first
  identifier extraction, with upstream's exact message:
  `` `getItemValue` is required when using array of objects ``.
- `Sortable.Item` throws `` `SortableItem` value cannot be an empty string `` during initialisation
  when `value === ''`.
- The provider guards throw with this repo's phrasing (naming both parts):
  `` `<Sortable.Item>` must be used within `<Sortable.Content>` or `<Sortable.Overlay>`. `` and
  `` `<Sortable.ItemHandle>` must be used within `<Sortable.Item>`. `` and
  `` `<Sortable.Content>` must be used within `<Sortable>`. ``

**Rationale**: React's conditional-type trick (`T extends object ? GetItemValue<T> : Partial<…>`) has
no Svelte equivalent — Svelte's `generics=` attribute cannot make a prop conditionally required —
so the runtime rule is the contract (FR-003, FR-014, FR-013). Upstream's own runtime check is the
same one.

**Where the object throw fires**: at Root initialisation for the first element of a non-empty
`value`, so the error surfaces on first render (FR-003) rather than on first drag.

---

## R-14 — Controlled and uncontrolled `value`

**Decision**: upstream's `value` is **required and controlled-only** (`value: T[]` with no
`defaultValue`). This port adds `defaultValue?: T[]` and makes `value` `$bindable`, seeded once with
the repo's established `if (value === undefined) value = untrack(() => defaultValue)` idiom, and
never with `??=` (which Svelte compiles to an unconditional write and would notify a controlled
parent of a change that never happened).

**Rationale**: FR-001 and constitution III's mandatory controlled/uncontrolled test areas. Adding an
optional `defaultValue` is a superset of upstream's API — a consumer passing only `value` +
`onValueChange` gets upstream's behaviour byte for byte. Recorded in the divergence register as an
addition.

**Known pitfall (memory)**: a non-bound `$bindable` prop is reset on props invalidation, so
uncontrolled state does not survive `rerender()` in `@testing-library/svelte`; the uncontrolled tests
drive interaction only and never call `rerender`.

---

## R-15 — `onMove` event shape

**Decision**:

```ts
type SortableMoveEvent = {
  active: { id: UniqueIdentifier };
  over: { id: UniqueIdentifier } | null;
  activeIndex: number;
  overIndex: number;
};
onMove?: (event: SortableMoveEvent) => void;
```

When `onMove` is supplied it is called *instead of* `onValueChange` and the component performs no
splice (FR-005); otherwise the component calls `onValueChange(arrayMove(value, activeIndex,
overIndex))` and writes the bound `value`.

**Rationale**: upstream spreads `DragEndEvent & { activeIndex, overIndex }`. `DragEndEvent`'s other
members (`delta`, `collisions`, `activatorEvent`) are dnd-kit internals; `active`/`over` are the two
a consumer can act on, and keeping them means an `onMove` handler reads the same as upstream's.
Recorded as a narrowing divergence.

---

## R-16 — RTL

**Decision**: the root takes `dir?: Direction` and resolves it through the repo's
`useDirection({ dir: () => dir, element: () => …})` reader (nearest `DirectionProvider` → DOM `[dir]`
→ `ltr`). Under `rtl`, `ArrowLeft`/`ArrowRight` are swapped for `horizontal` and `mixed` orientations
before index resolution (R-04); `vertical` is unaffected.

**Rationale**: FR-015, SC-006 and constitution III. Upstream inherits direction from dnd-kit's
implicit LTR assumption and offers no `dir` prop at all; every other directional component in this
repo takes `dir`, so parity with the *repo* is the stronger constraint here. Recorded as an addition.

---

## R-17 — Styling: tokens, `flatCursor`, and the demo palette

**Decision**: upstream's item classes are ported as-is except for the cursor logic, which becomes
`data-*`-driven so consumers can restyle it:

| Upstream (sortable.tsx:457-468)                  | Here                                                  |
| ------------------------------------------------- | ------------------------------------------------------ |
| `focus-visible:ring-ring` + offset                | unchanged (semantic token)                             |
| `touch-none select-none` when `asHandle`          | unchanged                                              |
| `cursor-default` when `flatCursor`                | unchanged, driven by `data-flat-cursor` on the item    |
| `data-dragging:cursor-grabbing`                   | unchanged                                              |
| `cursor-grab` when idle + `asHandle`              | unchanged                                              |
| `opacity-50` when dragging / disabled             | unchanged                                              |
| demo `bg-zinc-100 dark:bg-zinc-900`, `border-zinc-*` | `bg-muted` / `border-border` (docs page only; constitution VIII bans raw palette and manual `dark:`) |

`flatCursor` (FR-017) is a root prop, read by `Item` and `ItemHandle` from context, and is also
surfaced as `data-flat-cursor` on both so the cursor can be overridden from CSS.

---

## R-18 — Divergence register (props deliberately not ported)

Every entry below is a dnd-kit implementation detail with no meaning outside React + dnd-kit. All are
restated in plan.md and are consistent with spec §Assumptions.

| Upstream prop / behaviour            | Disposition                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `sensors` (`DndContextProps`)        | Dropped — the sensor set is fixed (R-03). Activation is tuned by pointer type, not by a sensor array. |
| `measuring` (`DndContextProps`)      | Dropped — measuring is snapshot-at-drag-start plus live re-measure on `over` change; there is no measuring-strategy matrix to configure. |
| `autoScroll` (`DndContextProps`)     | Dropped — dnd-kit's auto-scroll engine is not ported (R-23).                |
| `cancelDrop` (`DndContextProps`)     | Dropped — no upstream demo, no MDX row, no spec requirement.                |
| `dropAnimation` (`SortableOverlay`)  | Dropped — the overlay unmounts immediately, which is what FR-011 requires (R-09). |
| `DragOverlay`'s other props          | Dropped — `wrapperElement`, `zIndex`, `adjustScale`, `transition` are dnd-kit-only. |
| `DragEndEvent` extra members         | Narrowed to `{ active, over }` in every callback (R-15).                     |
| `strategy` / `modifiers` / `collisionDetection` types | Retyped to this port's own function signatures (R-05, R-06, R-07); the props themselves are kept. |
| `accessibility.container`            | Dropped — the live region renders inside the root's own fragment.            |
| **Added**: `defaultValue`            | Uncontrolled mode (R-14), required by FR-001 and constitution III.           |
| **Added**: `dir`                     | RTL (R-16), required by FR-015.                                             |
| **Added**: `data-flat-cursor`        | Makes `flatCursor` styleable from outside (R-17, constitution VIII).         |
| `asChild` → `child` snippet          | Standard repo translation (R-12).                                           |

---

## R-19 — The node registry is a plain `Map`, not a `SvelteMap`

**Decision**: `DndState` keeps registered draggable/droppable nodes in a plain `Map`, written from
each part's `$effect` and read only imperatively (during a drag, to measure rects). Reactive state —
`activeId`, `overId`, `delta`, the rect snapshot — lives in separate `$state` fields.

**Rationale**: writing to a `SvelteMap` inside an `$effect` that also reads it self-invalidates and
makes every sibling re-register on every registration (a known trap in this repo). Keeping the
registry non-reactive removes the cycle entirely instead of papering over it with `untrack`, and
nothing in the render path needs to react to *registration* — only to the drag session.

---

## R-20 — Item index comes from the root's `items` array, not from DOM order

**Decision**: `items = value.map(getItemValue)` on the root; an item's index is
`items.indexOf(value)`. Registration order and DOM order are irrelevant to indexing.

**Rationale**: it is upstream's model (`SortableContext items={context.items}`), it makes multiple
`Sortable.Content` regions share one identifier space for free (spec Edge Cases), and it means the
announcements' "position N of M" (FR-008) is computed from the same array the consumer owns. It also
removes any need for a DOM-order collection pass, which is where most ported collections go wrong.

---

## R-21 — Mid-drag mutation of `value` cancels the session

**Decision**: if the active id disappears from `items` while a drag is in progress, the session is
cancelled (`onDragCancel` fires, the cancel announcement is emitted, the overlay unmounts, no
reorder is committed). If `items` merely reorders or grows, the session survives and indices are
re-read from the new array.

**Rationale**: spec §Edge Cases requires exactly this ("the active drag is treated as cancelled
rather than operating on stale indices"). Guarding on the *active id's disappearance* rather than on
any array change keeps a controlled parent that re-creates its array each render from breaking every
drag.

---

## R-22 — Test strategy

**Decision**: colocated `sortable.test.ts` plus a `sortable.test.svelte` harness (the established
pattern — `marquee`, `masonry`, `file-upload`, `combobox` all ship one). The harness covers what a
`.ts` spec cannot express: `{#snippet child({ props })}`, keyed `{#each}` over items, `bind:value`,
`bind:ref`, a part rendered with no provider ancestor, and a `DirectionProvider` wrapper. A
test-only `stubRects()` helper installs deterministic `getBoundingClientRect` values on the rendered
nodes for the geometry-dependent cases (pointer drags, `mixed` orientation), because jsdom performs
no layout.

Pointer drags are driven through `@testing-library/user-event`'s `pointer()` API against the
Pointer Events the sensor listens for; keyboard interaction is driven through `user-event`'s
`keyboard()`/`tab()`. Neither `tests/setup.ts` nor any config is modified — jsdom ships
`PointerEvent` coverage sufficient for `user-event`'s pointer API, and `setPointerCapture` is already
shimmed in `tests/setup.ts`.

Pure geometry (`closestCenter`, `closestCorners`, the three strategies, the three modifiers,
`arrayMove`, the keyboard index resolver) is unit-tested directly against `sortable-geometry.ts` with
hand-authored rects — no DOM required, and it is where the RTL and `mixed` maths are pinned down.

---

## R-23 — Auto-scroll is out of scope

**Decision**: dragging near the edge of a scroll container does not auto-scroll.

**Rationale**: no functional requirement, no success criterion, no upstream demo and no MDX row
covers it; dnd-kit's auto-scroll is a substantial engine of its own (scrollable-ancestor discovery,
acceleration curves, per-axis thresholds). Adding it would be unrequested scope. Recorded here so
the omission is deliberate and auditable, and so `kanban` can plan for it explicitly if its own spec
asks.

---

## R-24 — Multiple `Content` regions share one identifier space; cross-region drag is out of scope

**Decision**: N `Sortable.Content` parts under one root all read the same `items` array and the same
droppable registry, so items are inspected as one shared space; an item dragged over a different
region resolves against that same flat list. Dragging *between* two roots, and any container-level
transfer semantics, are not implemented.

**Rationale**: spec §Edge Cases and §Assumptions fix this scope — upstream documents multi-`Content`
composition but ships no example, test or prose for cross-region transfer. The core's `containerId`
field (R-02) is the seam kanban will use for real cross-container moves.

---

## R-25 — Dependency audit

**Decision**: **zero new npm dependencies.** Nothing is added to `package.json`.

| Upstream dependency  | Replacement here                                                       |
| -------------------- | ----------------------------------------------------------------------- |
| `@dnd-kit/core`      | `sortable-dnd.svelte.ts` + `sortable-geometry.ts` (R-01)                |
| `@dnd-kit/sortable`  | ditto — strategies (R-06), keyboard resolver (R-04), `arrayMove`        |
| `@dnd-kit/modifiers` | ditto — three modifiers (R-07)                                          |
| `@dnd-kit/utilities` | `CSS.Translate.toString` → a 1-line `translate3d` formatter             |
| `radix-ui` (`Slot`)  | the `child` snippet pattern (R-12)                                      |
| `react-dom` (portal) | `bits-ui` `Portal` (R-09)                                               |
| `lucide-react`       | `@lucide/svelte` (`GripVerticalIcon`), docs page only — already installed |

The registry entry declares `"registryDependencies": ["button", "direction-provider"]` and
`"dependencies": ["bits-ui"]`; `@lucide/svelte` is a docs-route import only and is therefore not a
component dependency.
