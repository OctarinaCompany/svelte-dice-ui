# Phase 0 Research: Kanban

**Feature**: `specs/037-port-kanban` | **Date**: 2026-07-31

Upstream read at the pinned commit `d9763d82530416dfa4c81c462387b55d06bae4ec`:

- `.reference/diceui/docs/registry/bases/radix/ui/kanban.tsx` (1105 lines — the whole component)
- `.reference/diceui/docs/content/docs/components/radix/kanban.mdx` (API contract, data attributes,
  keyboard table)
- `.reference/diceui/docs/registry/bases/radix/examples/kanban-demo.tsx`
- `.reference/diceui/docs/registry/bases/radix/examples/kanban-dynamic-overlay-demo.tsx`

Local material read: `src/lib/components/ui/sortable/**` (the drag engine this port reuses),
`src/lib/components/ui/direction-provider/**`, `src/lib/components/ui/tags-input/**` and
`src/lib/components/ui/masonry/**` (convention samples), `CLAUDE.md`,
`.specify/memory/constitution.md`, `.agents/skills/shadcn-svelte/rules/{styling,composition,forms,icons}.md`.

There is **no upstream test file** for kanban (`.reference/diceui/docs/registry/bases/radix/test/`
has none for this component), so constitution III's "upstream assertions are the floor" resolves to
the MDX keyboard/data-attribute tables plus the source's own runtime throws.

Every entry below is a decision, not an open question. **Zero `NEEDS CLARIFICATION` remain.**

---

## R-01 — Drag engine: reuse `sortable`, write nothing new

**Decision**: `kanban` imports `DndState`, `DragSession`, `DndNodeEntry` from
`$lib/components/ui/sortable/index.js` (which re-exports `sortable-dnd.svelte.ts`) and the pure
geometry (`toClientRect`, `translate3d`, `arrayMove`, `closestCenter`, `closestCorners`, the two list
strategies, `ClientRect`/`Coordinates`/`UniqueIdentifier`/`SortableModifier`/`SortableStrategy`/
`SortableCollisionDetection` types) from the same barrel. `registry.json` records the edge as
`"registryDependencies": ["sortable", "direction-provider"]`.

**Rationale**: constitution IV and the explicit component guidance for this port. `sortable-dnd.svelte.ts`
was written for this: its header says it "knows nothing about `value`, `getItemValue`, orientation or
announcements — those are injected as getter functions by the component layer, which is what lets the
upcoming `kanban` port import this file unchanged". Everything expensive and audited — the mouse/pen
5 px activation constraint, the 250 ms touch hold, pointer capture, the document listener lifecycle,
the `Escape`/`Enter`/`Space`/`Tab` keyboard session machine, `destroy()` teardown — is reused verbatim.

**Alternatives considered**: a second bespoke engine inside `kanban/` (rejected — forbidden by the
port guidance and by constitution IV); `@dnd-kit/*` (React-only); `svelte-dnd-action` and
`@atlaskit/pragmatic-drag-and-drop` (already rejected on the record in `036-port-sortable/research.md`
R-01, and rejecting them again for `sortable` while adopting one for `kanban` would put two engines in
the repo).

---

## R-02 — How kanban extends the engine: subclass, do not edit `sortable`

**Decision**: `kanban-dnd.svelte.ts` defines `class KanbanDndState extends DndState` and overrides
exactly one public method, `move(delta)`. No file under `src/lib/components/ui/sortable/` is modified.

**Rationale**: two behaviours of the base `#resolveOver` are wrong for a kanban board and both are
unreachable from the outside because the method and the node registry are `#private`:

1. `#resolveOver` returns `null` as soon as the dragged rect stops intersecting
   `session.containerRect` (the dragged node's own `parentElement`). For a kanban item that parent is
   its column's item list, so the very first pixel outside the source column would resolve
   `over = null` and **no cross-column pointer drag could ever land** (FR-003 dead).
2. `#candidatesFor` narrows to `kind === 'item'` and applies one collision function to all of them.
   Kanban needs upstream's two-mode cascade (R-05).

`move()` is a prototype method called by the base's own private `#onPointerMove` handler, so a
subclass override participates through ordinary virtual dispatch: the sensors, the activation
constraints, pointer capture, the keyboard machine and teardown all keep running unchanged, while the
drop-target resolution — the one genuinely kanban-specific part, and the exact seam upstream itself
overrides via `collisionDetection` — is replaced.

`moveToIndex()` needs **no** override: it looks the target id up in `getItems()`, sets `overId`, and
derives the delta from `session.rects`. Given R-03's flat identifier space and R-04's registration
kind, that is already the correct keyboard behaviour.

**Alternatives considered**:

- _Add two opt-in props to `sortable-dnd.svelte.ts`_ (`getContainerRect`, and letting
  `kind === 'container'` entries be candidates). Both would be no-ops for `sortable`, so it is safe —
  but it edits a completed, tagged port's shipped registry files, forcing re-verification of
  `sortable` inside `kanban`'s feature directory, which constitution X exists to prevent. Rejected on
  blast radius, not on correctness. If a future component needs the same seam, promoting the override
  into the base is the right amendment — recorded here so that choice stays auditable.
- _Compose `DndState` by delegation instead of inheriting_ — would lose the sensors, since
  `startPointerDrag`/`#onPointerMove` are what call `move()`.

---

## R-03 — Identifier space: one flat list of column ids followed by item ids

**Decision**: `getItems()` returns `[...Object.keys(value), ...Object.values(value).flat().map(getItemValue)]`.
Columns and items share one identifier space, exactly as dnd-kit's single `DndContext` does upstream
(`over.id` is a column id or an item id and the code disambiguates with `id in value`).

**Rationale**: `DndState` resolves `moveToIndex(index)` and `session.initialIndex` against a single
ordered list. Upstream disambiguates the two kinds with the same `id in value` test, which this port
reproduces as `KanbanRootState.isColumn(id)`.

**Consequence**: column ids and item ids must not collide. Upstream has the same requirement (a
`Record` key that equals an item id would make `getColumn` return the column). Not guarded, matching
upstream.

---

## R-04 — Columns register as `kind: 'item'`, not `kind: 'container'`

**Decision**: `<Kanban.Column>` registers its element with `{ kind: 'item', containerId: null }`;
`<Kanban.Item>` registers with `{ kind: 'item', containerId: <column value> }`. The `'container'`
kind exported by `sortable-dnd.svelte.ts` is left unused.

**Rationale**: `DndState` consumes `kind` in exactly two private places, and both would silently
exclude a `'container'` entry: `#openSession` measures only `kind === 'item'` nodes into
`session.rects` (so columns would have no rect for the keyboard resolver or the overlay), and
`#candidatesFor` filters to `kind === 'item'`. Registering columns as items is what gets them
measured. Kanban then does its own column-vs-item discrimination through `containerId` and
`isColumn()`, which is strictly more information than `kind` carried.

**Alternatives considered**: registering as `'container'` and re-measuring columns live through the
public `getRect(id)` — works, but leaves `session.rects` inconsistent (items snapshotted, columns
live), which would make the keyboard tests depend on measurement timing.

---

## R-05 — Pointer collision detection: upstream's cascade, reproduced exactly

**Decision**: `kanban-collision.ts` implements, as pure functions over plain rects:
`pointerWithin`, `rectIntersection` (ranked by intersection area), `getFirstCollision`, and
`closestCenterAmong`. `KanbanDndState.move()` runs upstream's cascade
(`kanban.tsx:259-308`) verbatim:

1. active id is a column → `closestCenter` restricted to columns;
2. otherwise `pointerWithin(pointer)`, falling back to `rectIntersection(collisionRect)`;
3. no hit → return the remembered `lastOverId` (set to `activeId` once `hasMoved`), else nothing;
4. hit is a non-empty column → re-resolve with `closestCenter` among that column's items;
5. remember the result in `lastOverId`.

**Pointer coordinates are available**: `session.initialCoordinates` is the pointer origin at pick-up
and `move()` receives the raw delta, so `pointer = initialCoordinates + delta` reconstructs the live
client point that `pointerWithin` needs. This is why the cascade is a *full* parity port rather than a
rect-only approximation.

**Rects are measured live** (`toClientRect(entry.node)`), not read from the pick-up snapshot, which
reproduces upstream's `measuring: { droppable: { strategy: MeasuringStrategy.Always } }` — required,
because kanban mutates `value` mid-drag (R-07) and the layout changes underneath the pointer.

---

## R-06 — Keyboard: upstream's `coordinateGetter`, with its three abort bugs fixed

**Decision**: `resolveKanbanArrowTarget()` in `kanban-collision.ts` reproduces
`kanban.tsx:58-150`: filter every enabled droppable by the pressed key's **absolute screen
direction** relative to the dragged rect —

| Key          | Kept when                                            |
| ------------ | ---------------------------------------------------- |
| `ArrowDown`  | `collisionRect.top < rect.top`                       |
| `ArrowUp`    | `collisionRect.top > rect.top`                       |
| `ArrowLeft`  | `collisionRect.left >= rect.left + rect.width`       |
| `ArrowRight` | `collisionRect.left + collisionRect.width <= rect.left` |

— then rank the survivors with `closestCorners` and take the first. A non-empty column is not itself a
target while an **item** is being dragged (its items are); an empty column is. While a **column** is
being dragged, only columns are targets. The resolved id is mapped back to its index in R-03's flat
list and returned from `onArrowKey`, which `DndState.moveToIndex` then applies.

**Divergence — three `return`s become `continue`s.** Upstream's filter loop aborts the whole
resolution (`return;`) when it meets a disabled entry, an unmeasured entry, or a populated column
during an item drag (`kanban.tsx:70,74,82`). Since the loop walks *every* registered droppable, on any
real board the first populated column aborts arrow-key movement altogether. Reproducing that would
make FR-005/FR-006 and user story 4 unimplementable and would contradict the MDX's own keyboard table,
so this port skips the entry and keeps scanning. Recorded in the divergence register.

**Divergence — the `"placeholder"` and container offsets** (`kanban.tsx:127-144`, which nudge the
keyboard cursor by `+20 / +74` px into a column) are dropped: they exist to place a dnd-kit
*coordinate*, whereas this port resolves an *index* and lets `moveToIndex` compute the delta from
measured rects. Same observable result, no magic numbers.

**Addition — RTL.** dnd-kit's coordinate getter is direction-blind. FR-014/SC-005 require horizontal
inversion, so `ArrowLeft`/`ArrowRight` are swapped when the resolved direction is `rtl`, exactly as
`sortable` does. `dir` resolves through the existing `direction-provider` (`useDirection`).

---

## R-07 — Value mutation during the drag

**Decision**: reproduce upstream's split precisely.

- **`onDragOver`** (`kanban.tsx:320-378`): same column → `arrayMove` and publish; different columns →
  remove from the source column, **append to the end** of the destination column, publish, and set
  `hasMoved`. Both publish through `onValueChange` only — never `onMove`.
- **`onDragEnd`** (`kanban.tsx:380-465`): both ids are columns → `arrayMove` over `Object.keys(value)`
  and rebuild the record in the new key order, routing through `onMove` when supplied, else
  `onValueChange`; otherwise same-column → `arrayMove` routed the same way. A cross-column drop
  commits nothing here, because `onDragOver` already did it.
- **`onDragCancel`** and a drop with no `over`: clear the active id, commit nothing.

**Rationale**: this is the observable API (FR-001, FR-013, US1-3 acceptance scenarios) and the reason
the board visibly reflows mid-drag. Reproducing the split, rather than deferring everything to the
drop, is what makes "drop into an empty column" (US2 scenario 2) work at all.

**Consequence for item transforms**: because the array has already reordered, a sorting-strategy
transform on a settled item would double-count the move. Upstream survives this only because dnd-kit
re-measures on every mutation and the recomputed transform collapses to ~0. This port therefore
applies **no** strategy transform to non-dragged items; the dragged item gets the clamped pointer
delta when no overlay is mounted, and nothing when one is (the `sortable` overlay rule). The upstream
CSS `transition: transform 200ms` on settled items is dropped with it — a purely visual difference,
recorded in the divergence register.

---

## R-08 — `strategy` is accepted and, as upstream, never read

**Decision**: keep the `strategy` prop (type `SortableStrategy`, upstream default
`verticalListSortingStrategy`), store it on the root context, apply it to nothing.

**Rationale**: upstream puts `strategy` into `KanbanContextValue` (`kanban.tsx:199, 591`) and **no
consumer ever reads it** — `KanbanBoard` and `KanbanColumn` each pick
`horizontal|verticalListSortingStrategy` from `context.orientation` instead. Dropping the prop would
break parity for a consumer who passes it; applying it would be invented behaviour on top of R-07.
Documented in the props table and the MDX-parity notes so the no-op is not mistaken for a defect.

---

## R-09 — Overlay: `bits-ui` `Portal`, `sortable`'s host bridge, one snippet for both content forms

**Decision**: `<Kanban.Overlay>` renders through `bits-ui`'s `Portal`, defaulting to `document.body`,
accepting `container?: Element | DocumentFragment | string | null` with the same `display: contents`
host bridge `sortable-overlay.svelte` and `action-bar-portal.svelte` already use for the
`DocumentFragment` case. Content is a single snippet
`children?: Snippet<[{ value: UniqueIdentifier; variant: 'column' | 'item' }]>`, which covers both
upstream forms (a plain node, or the `({ value, variant }) => ...` function child). `variant` is
`'column'` when `activeId in value`, else `'item'`. The overlay publishes an overlay context so a
`<Kanban.Column>` or `<Kanban.Item>` rendered inside it is a **preview**: it neither registers nor
drags (this is what the dynamic-overlay demo needs).

**Dropped**: dnd-kit's `dropAnimation`/`defaultDropAnimationSideEffects` — no dnd-kit, no drop
animation pipeline; the overlay simply unmounts. `DragOverlay`'s dnd-kit-only props
(`adjustScale`, `transition`, `zIndex`, `wrapperElement`) are likewise not ported, matching the
decision already taken for `sortable`.

---

## R-10 — Announcements and screen-reader instructions

**Decision**: `KanbanRootState` owns a `role="status" aria-live="assertive" aria-atomic="true"`
`sr-only` live region plus an `sr-only` instructions element (`aria-describedby` target of every
activator), mirroring `sortable`. The five builders reproduce `kanban.tsx:479-583` **verbatim**,
including 1-based positions and the "in `<column>`" suffix that only appears when an item changed
column:

| Hook           | Text                                                            |
| -------------- | --------------------------------------------------------------- |
| `onDragStart`  | `Picked up {item\|column} at position {n} of {total}`            |
| `onDragOver`   | `{item\|column} is now at position {n} of {total}[ in {column}]` |
| `onDragEnd`    | `{item\|column} was dropped at position {n} of {total}[ in {column}]` |
| `onDragCancel` | `Dragging was cancelled. {item\|column} was dropped.`            |

Positions/totals are computed from the **current** `value` — i.e. after `onDragOver` has already moved
the item — which is upstream's behaviour and is what makes the cross-column announcement name the
destination column. `onDragMove` has no upstream text; it reuses the `onDragOver` builder.

The instructions string is upstream's `accessibility.screenReaderInstructions.draggable`
(`kanban.tsx:629-633`) with its template-literal indentation collapsed to single spaces — the
whitespace is an artefact of the source formatting, not content. Each builder is individually
overridable through `accessibility.announcements`, as in `sortable`.

Writes go through `announce()`, which only assigns when the text actually changed, so an unchanged
message does not re-trigger the live region.

---

## R-11 — Activator ARIA

**Decision**: the activator (the handle, or the column/item itself under `asHandle`) carries dnd-kit's
default draggable attribute set: `tabindex="0"`, `aria-roledescription="draggable"`,
`aria-describedby={instructionsId}`, `aria-disabled` when disabled, `aria-pressed="true"` while
dragging, and `role="button"` **only** when the activator is the `<div>` (a `<button>` handle already
has the role). Handles additionally carry `aria-controls` pointing at the column's / item's own
`$props.id()`, matching `kanban.tsx:854, 1014`.

**Rationale**: upstream passes dnd-kit's `attributes` straight through and never overrides
`roleDescription`, so the default `"draggable"` is the contract here — unlike `sortable`, which
upstream sets to `"sortable"`.

---

## R-12 — Controlled, uncontrolled, and the object-array guard

**Decision**: `value?: Record<UniqueIdentifier, T[]>` is `$bindable`, seeded once from
`defaultValue = {}` with the guarded `if (value === undefined) value = untrack(() => defaultValue)`
form `sortable` uses (a bare `??=` compiles to an unconditional assignment and would notify a
controlled parent of a change that never happened). `getItemValue` stays optional in the type — the
upstream conditional type `T extends object ? GetItemValue<T> : Partial<GetItemValue<T>>` has no
Svelte equivalent — and upstream's runtime throw is preserved:
`` `getItemValue` is required when using array of objects ``, raised on the first object item seen.

---

## R-13 — Runtime throws to reproduce

| Throw                                                                              | Upstream                |
| ---------------------------------------------------------------------------------- | ----------------------- |
| `` `KanbanBoard` must be used within `Kanban` `` (and the same for every part)      | `kanban.tsx:176-182`    |
| `` `KanbanColumn` must be used within `KanbanBoard` or `KanbanOverlay` ``           | `kanban.tsx:737-741`    |
| `` `KanbanColumn` value cannot be an empty string ``                                | `kanban.tsx:743-745`    |
| `` `KanbanColumnHandle` must be used within `KanbanColumn` ``                       | `kanban.tsx:699-707`    |
| `` `KanbanItem` must be used within `KanbanBoard` ``                                | `kanban.tsx:918-920`    |
| `` `KanbanItem` value cannot be an empty string ``                                  | `kanban.tsx:932-934`    |
| `` `KanbanItemHandle` must be used within `KanbanItem` ``                           | `kanban.tsx:886-892`    |
| `` `getItemValue` is required when using array of objects ``                        | `kanban.tsx:230-242`    |

Message wording is adapted to this repo's part names and back-tick style, as `sortable` did:
`` `<Kanban.Column>` must be used within `<Kanban.Board>` or `<Kanban.Overlay>`. `` Every one is
asserted with `expect(() => render(...)).toThrow(/within/)` (constitution III).

---

## R-14 — Styling map

Upstream classes are ported verbatim except where constitution VIII forbids them:

| Upstream (`kanban.tsx` / demos)      | Here                            | Why                                     |
| ------------------------------------ | ------------------------------- | --------------------------------------- |
| `bg-zinc-100 dark:bg-zinc-900` (column) | `bg-muted`                   | raw palette + manual `dark:` both banned |
| `focus-visible:ring-ring`            | unchanged                       | already a semantic token                |
| `data-dragging:cursor-grabbing`      | unchanged                       | already keyed off the data attribute     |
| demo `bg-card`, `text-muted-foreground` | unchanged                    | already semantic                        |

Booleans are written `cond ? '' : undefined` (upstream's `data-disabled={disabled}` renders
`data-disabled="false"` in React when `false`; this repo's `data-[disabled]` selectors require
absence). `data-flat-cursor` is added on every part so `flatCursor` is styleable from outside, as in
`sortable`.

---

## R-15 — Testing under jsdom

**Decision**: colocated `kanban.test.ts` plus a `kanban.test.svelte` harness (a `.ts` spec cannot
express `{#snippet child({ props })}`, keyed `{#each}`, `bind:value`, or a part with no provider).
jsdom performs no layout, so a local `stubRects()` helper installs deterministic
`getBoundingClientRect` values per element before geometry-dependent cases — the same technique
`sortable.test.ts` already uses. `tests/setup.ts` is **not** modified.

`kanban-collision.ts` is pure and is unit-tested directly with hand-authored rects, which is what
makes the cross-column keyboard contract (US4, SC-004, SC-008) assertable rather than assumed.

---

## R-16 — Zero new npm dependencies

`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`, `@dnd-kit/utilities`, `radix-ui`
(`Slot`), `react-dom` (`createPortal`) and `@/lib/compose-refs` are all replaced by: the `sortable`
engine (R-01), `bits-ui` `Portal` (R-09), the `child` snippet (R-17) and
`ref = $bindable(null)` + `bind:this` respectively. Runtime dependency surface: `bits-ui` (already
installed), `clsx`/`tailwind-merge` via `cn()`. `@lucide/svelte` (`GripVerticalIcon`) is used by the
docs route only.

---

## R-17 — `asChild` → the `child` snippet

Every upstream part that takes `asChild` (`Board`, `Column`, `ColumnHandle`, `Item`, `ItemHandle`)
gets a `child?: Snippet<[{ props: <Part>ChildProps }]>` whose payload includes the registration
attachment, so a caller-supplied element is still registered and draggable — the pattern
`sortable-item.svelte` established with `createAttachmentKey()`. Both upstream demos rely on it
(`KanbanColumnHandle asChild` onto `Button`, `KanbanItem asChild` onto a card `div`).

---

## R-18 — Divergence register (all also recorded in `spec.md` § Assumptions)

**Not ported** (dnd-kit-only surface reached through `DndContextProps`): `sensors`, `measuring`,
`autoScroll`, `cancelDrop`, `collisionDetection` (upstream `Omit`s it anyway), `DragOverlay`'s
`dropAnimation` / `adjustScale` / `transition` / `zIndex` / `wrapperElement`,
`accessibility.container`, and `activatorEvent.defaultPrevented` as an opt-out (the drag event is
narrowed to `{ active, over }`; `onMove` is the interception point).

**Behavioural**: the three `coordinateGetter` aborts become skips (R-06); the keyboard placeholder /
container pixel offsets are dropped (R-06); settled items get no strategy transform or transition
(R-07); `strategy` is accepted and unread, exactly as upstream (R-08); `pointerWithin` is
reconstructed from `initialCoordinates + delta` rather than from a dnd-kit pointer sensor (R-05);
after a mid-drag commit the session's drop target becomes the active identifier, which is the state
dnd-kit re-measures itself into and what stops the next resolution swapping the same pair straight
back. That last one has one visible consequence: `onMove` **reports** rather than intercepts a
same-column item drop. The reorder was already published by `onDragOver` — unconditionally, through
`onValueChange` only, as R-07 requires — so by the drop there is nothing left to suppress, and
`onMove` instead receives the net `{ activeIndex, overIndex }` of the whole drag. It still fully
intercepts the column reorder, which is only ever committed on drop.

**Added** beyond upstream: `defaultValue` (uncontrolled mode, project convention), `dir` +
RTL inversion (FR-014), `data-flat-cursor`, `data-slot` on every part, per-builder
`accessibility.announcements` overrides, and **restore on cancel** — `Escape` (or a pointer cancel)
republishes the board as it stood at pick-up whenever `onDragOver` already committed something, which
FR-005 requires ("cancel the operation and restore its original position") and upstream does not do:
its `onDragCancel` only clears the active id, leaving the item wherever the mid-drag commit put it. A
cancel with no mid-drag commit publishes nothing, so a controlled parent is never notified of a no-op.

---

## R-19 — What this port exports for reuse

`kanban-collision.ts` is pure, rune-free and component-agnostic: `pointerWithin`, `rectIntersection`,
`getFirstCollision`, `closestCenterAmong`, `filterByDirection`, `resolveKanbanArrowTarget`. It is
exported from the barrel alongside `KanbanDndState` so any later multi-container drag component
(swimlanes, a tree, a dual-list picker) composes it instead of re-deriving the direction filter. The
`Kanban*State` classes and both context accessors are exported too, so a consumer can build their own
part — the same surface `sortable/index.ts` exposes.
