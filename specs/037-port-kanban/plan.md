# Implementation Plan: Kanban

**Branch**: `037-port-kanban` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/037-port-kanban/spec.md`

## Summary

Port Dice UI's `kanban` (a 1105-line React registry component built on `@dnd-kit`) to Svelte 5 as
`src/lib/components/ui/kanban/`: seven composable parts (`Kanban`, `Board`, `Column`, `ColumnHandle`,
`Item`, `ItemHandle`, `Overlay`) that reorder items inside a column, move them **between** columns,
reorder whole columns, and do all three by pointer, touch or keyboard with screen-reader
announcements at every step.

**Technical approach.** The drag engine is not rewritten. `sortable` already ships a sensor-agnostic
`DndState`/`DragSession` pair plus pure geometry, written for exactly this reuse; `kanban` imports
both from `$lib/components/ui/sortable/index.js` and declares the edge as a `registryDependency`. Two
of the engine's behaviours are wrong for a board and are unreachable from outside (`#resolveOver`
returns `null` the moment the dragged rect leaves its own parent — which would kill every
cross-column drag — and it narrows candidates to one collision function), so `KanbanDndState extends
DndState` overrides exactly one public method, `move()`. Sensors, activation constraints, pointer
capture, the keyboard session machine and teardown are all inherited unchanged, and **no file under
`sortable/` is modified** (research R-02). On top of that sit `kanban-collision.ts` (pure, rune-free:
`pointerWithin`, `rectIntersection`, `getFirstCollision`, the absolute-direction arrow filter) and
`kanban.svelte.ts` (`KanbanRootState` / `KanbanColumnState` / `KanbanItemState`, five `Symbol`-keyed
contexts with throwing getters, the verbatim upstream announcement builders). The overlay portals
through `bits-ui` `Portal`. Zero new npm dependencies.

Decision log in [research.md](./research.md) (19 decisions); state shape in
[data-model.md](./data-model.md); the exhaustive API, keyboard, announcement, `data-*`, registry and
demo contracts in [contracts/kanban-api.md](./contracts/kanban-api.md).

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`), Svelte 5.56 (runes forced on in
`vite.config.ts`), SvelteKit 2.63

**Primary Dependencies**: `bits-ui` ^2.18 (`Portal` — the only external primitive composed);
`tailwind-variants` / `clsx` / `tailwind-merge` via `cn()`; `@lucide/svelte` ^1.27
(`GripVerticalIcon`, docs route only). Existing UI components reused: **`sortable`** (drag engine +
geometry) and **`direction-provider`** (`useDirection`), plus `button`, `badge` and `table` on the
docs route only. **No new npm dependency**: `@dnd-kit/core`, `@dnd-kit/sortable`,
`@dnd-kit/modifiers`, `@dnd-kit/utilities`, `radix-ui` (`Slot`), `react-dom` (`createPortal`) and
`@/lib/compose-refs` are all replaced (research R-01, R-09, R-16, R-17).

**Storage**: N/A

**Testing**: Vitest 4 (jsdom, `globals: false`, `expect.requireAssertions`) +
`@testing-library/svelte` + `@testing-library/user-event`; colocated at
`src/lib/components/ui/kanban/kanban.test.ts` with a `kanban.test.svelte` harness for snippets,
`{#each}`, bindings and bare-part guard cases. jsdom performs no layout, so a local `stubRects()`
helper installs deterministic `getBoundingClientRect` values for the geometry-dependent cases, and
`kanban-collision.ts` is unit-tested directly on hand-authored rects. `tests/setup.ts` is **not**
modified (research R-15). `sortable`'s existing suite is the regression guard for R-02 and must stay
green untouched.

**Target Platform**: Modern evergreen browsers (Pointer Events, `setPointerCapture`,
`getBoundingClientRect`), server-rendered by SvelteKit and hydrated — every DOM/listener touch lives
inside an `$effect`, an attachment or an event handler, never at module scope.

**Performance Goals**: one state write per pointer frame; drop-target resolution measures rects live
(reproducing dnd-kit's `MeasuringStrategy.Always`, required because `value` mutates mid-drag) but
touches only registered nodes; the live region is written only when the announced text changes; no
`$state` is written from an `$effect` where a `$derived` would do.

**Constraints**: no `any`, no suppression comments; semantic Tailwind tokens only (upstream's
`bg-zinc-100 dark:bg-zinc-900` maps to `bg-muted`); every part carries `data-slot` and exposes its
state as `data-*` written `cond ? '' : undefined`; `class` merged last through `cn()`; every
`$effect` returns a teardown for every listener/timer/registration it starts;
`src/lib/components/ui/sortable/**` is read-only for this feature.

**Scale/Scope**: 7 `.svelte` parts + 1 state module + 1 engine subclass + 1 pure collision module +
1 barrel = **11 registry files**; 2 test-only files; 1 docs route with 2 example sections + 7 props
tables + a data-attributes table + a keyboard table; 1 `registry.json` entry.

## Constitution Check

_GATE: passed before Phase 0 research; re-checked after Phase 1 design (note below the table)._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                                                                                                                                             |
| ---- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `KanbanDndState`, `KanbanRootState`, `KanbanColumnState`, `KanbanItemState` in `.svelte.ts` modules using `$state`/`$derived`/`$derived.by`; props via `$props()` with `generics="T"`; `value`/`ref` via `$bindable`; snippets only. No store, no `export let`, no `createEventDispatcher`, no `$:`, no `<slot>`. Reactive inputs enter every class as getter functions (data-model §3). |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | All 7 parts, every documented prop and default, every `DataAttributesTable` row, every `KeyboardShortcutsTable` row, all nine runtime throw cases and the four announcement strings ported verbatim (contract §2-§12). Upstream JSDoc, including `@default`, is copied onto the prop types. Every divergence is in spec § Assumptions, research R-18 and the register below. |
| III  | Accessibility Is a MUST             | PASS    | dnd-kit's full draggable ARIA set reproduced (`role="button"`, `tabindex`, `aria-roledescription="draggable"`, `aria-describedby`, `aria-disabled`, `aria-pressed`) plus `aria-controls` on both handles; `role="status" aria-live="assertive"` live region + upfront instructions; the eight-row keyboard table driven through `user-event`; **cross-column keyboard movement and its announcements each get their own tests** (test plan groups E/F); RTL inversion, controlled, uncontrolled, `disabled` guard rails and all seven throws asserted. |
| IV   | Composition Over Reimplementation   | PASS    | The drag engine is **not** rewritten — `sortable`'s `DndState`/`DragSession` and pure geometry are imported and subclassed (R-01/R-02); `bits-ui` `Portal` elevates the overlay; `direction-provider` resolves `dir`; `button`/`badge` are composed on the docs route through the `child` snippet. The one bespoke surface is justified below.                            |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file `kanban-<part>.svelte` with the root at `kanban.svelte`, logic in `.svelte.ts`/`.ts` siblings, `index.ts` barrel with short + prefixed names + types, `.js` import extensions, **one** `registry:ui` entry of 11 files (contract §14), no import from `src/routes/**` or `$lib/components/docs/**`.                                        |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Prop types exported from `<script lang="ts" module>`, DOM props derived from `WithElementRef<HTMLAttributes<…>>`; root generic via `generics="T"`; `unknown` (never `any`) at the single erased boundary — the context value shared by a generic root, the pattern `sortable` established. No ignore comment, no config change.                                          |
| VII  | Green Gate Before Commit            | PASS    | `format → check → lint → test:unit --run → build` scheduled as the final phase ([quickstart.md](./quickstart.md) §1), plus a targeted re-run of `sortable.test.ts` as the R-02 regression guard. `stubRects()` is a layout fixture for something jsdom does not implement, not an assertion or a config relaxation.                                                       |
| VIII | Styling Discipline                  | PASS    | `cn()` everywhere with `class` merged last; upstream's class lists ported unchanged except `bg-zinc-100 dark:bg-zinc-900 → bg-muted` (R-14, the mapping `sortable` already used); no `space-*`; `size-*` where width and height match; no manual `z-index` — the overlay's elevation comes from the portal; every part carries `data-slot` and its state as `data-*`.     |
| IX   | Every Component Is Documented       | PASS    | `/docs/components/kanban` gets one `<ComponentPreview>` per upstream example file — `kanban-demo.tsx` and `kanban-dynamic-overlay-demo.tsx` (these are the only two; the MDX shows no further examples) — plus seven props tables, a data-attributes table and a keyboard table. Demo state held in the page with runes; no `+page.ts`.                                    |
| X    | One Feature Directory Per Component | PASS    | All artefacts under `specs/037-port-kanban/`; the port writes only into `src/lib/components/ui/kanban/`, `src/routes/docs/components/kanban/` and `registry.json`; `sortable` is consumed, never edited (R-02); no git write command is run by any phase.                                                                                                                |

**Post-design re-check**: Phase 1 introduced no new violation. Three decisions were re-examined:

- **(IV)** subclassing `DndState` rather than editing it keeps the reuse real *and* keeps `sortable`'s
  shipped registry files untouched; the override replaces exactly the seam upstream itself overrides
  (`collisionDetection`), so it adds no bespoke sensor, registry or activation logic.
- **(II)** three upstream `return`s inside `coordinateGetter`'s filter loop abort arrow-key resolution
  on any board with a populated column (R-06). Reproducing that bug would make FR-005/FR-006 and user
  story 4 unimplementable and contradict upstream's own MDX keyboard table, so the loop skips instead
  of aborting. Recorded as a divergence, not silent drift.
- **(VIII)** `data-flat-cursor`, `data-value` and `data-variant` are added beyond the MDX's
  `DataAttributesTable` because Principle VIII requires component state to be styleable from outside;
  additions never remove a documented attribute.

**Bespoke behaviour justification (Principle IV)**: one item.

1. **Kanban-specific drop-target resolution** — `kanban-collision.ts` +
   `KanbanDndState.move()`. Primitives evaluated:
   - `src/lib/components/ui/sortable` — **composed, not replaced**: sensors, activation constraints
     (5 px mouse / 250 ms touch), pointer capture, the droppable registry, the `Enter`/`Space`/
     `Escape`/`Tab` keyboard machine, `moveToIndex`, `destroy()` teardown, `closestCenter`,
     `closestCorners`, `arrayMove`, `toClientRect`, `translate3d` and every geometry type are all
     imported and reused. What it cannot provide: its `#resolveOver` deliberately confines a drag to
     the dragged node's parent element (`036-port-sortable` research R-24 — "cross-region dragging is
     out of scope"), which is the exact capability a kanban board is defined by, and it applies a
     single collision function where upstream kanban runs a four-step cascade that discriminates
     columns from items.
   - `bits-ui` 2.18 — no drag-and-drop surface at all (no draggable, droppable, sensor, collision
     detection or drag overlay); its only relevant export, `Portal`, **is** composed.
   - Nothing else under `src/lib/components/ui/*` models a multi-container drag.

   Scope of the bespoke code: one overridden method plus six pure functions over plain rects. No
   second sensor, no second registry, no second keyboard machine.

**Divergence register** (all also in spec § Assumptions and research R-18). *Not ported* (dnd-kit-only
surface reached through `DndContextProps`): `sensors`, `measuring`, `autoScroll`, `cancelDrop`,
`collisionDetection` (upstream `Omit`s it), `DragOverlay`'s `dropAnimation`/`adjustScale`/
`transition`/`zIndex`/`wrapperElement`, `accessibility.container`, and `activatorEvent.defaultPrevented`
as an opt-out — the drag event is narrowed to `{ active, over }` and `onMove` is the interception
point. *Behavioural*: the three `coordinateGetter` aborts become skips (R-06); its `"placeholder"` and
`+20/+74 px` container offsets are dropped because this port resolves an index, not a coordinate
(R-06); settled items get no sorting-strategy transform or transition, because `value` already
reordered (R-07); `strategy` is accepted and read by nothing, **exactly as upstream** (R-08);
`pointerWithin` is reconstructed from `initialCoordinates + delta` (R-05); `asChild` becomes the
`child` snippet (R-17). *Added* beyond upstream: `defaultValue` (uncontrolled mode), `dir` + RTL arrow
inversion (FR-014), `data-flat-cursor` / `data-value` / `data-variant` / `data-slot`, and per-builder
`accessibility.announcements` overrides.

## Project Structure

### Documentation (this feature)

```text
specs/037-port-kanban/
├── plan.md                        # This file
├── research.md                    # Phase 0 — 19 decisions, zero NEEDS CLARIFICATION remaining
├── data-model.md                  # Phase 1 — value shape, the four runtime classes, contexts, transitions
├── quickstart.md                  # Phase 1 — how to run and verify
├── contracts/
│   └── kanban-api.md              # Phase 1 — exhaustive API, keyboard, announcements, registry, demo
├── checklists/requirements.md     # from /speckit-specify
└── tasks.md                       # Phase 2 — created by /speckit-tasks, NOT by this command
```

### Source Code (repository root)

```text
src/lib/components/ui/kanban/
├── index.ts                       # barrel: 7 parts (short + prefixed) + prop types + state + collision helpers
├── kanban-collision.ts            # pure, rune-free: pointerWithin, rectIntersection, getFirstCollision,
│                                  #   closestCenterAmong, filterByDirection, resolveKanbanArrowTarget
│                                  #   ← the module this port EXPORTS for later components (R-19)
├── kanban-dnd.svelte.ts           # KanbanDndState extends sortable's DndState; overrides move() only
├── kanban.svelte.ts               # KanbanRootState / KanbanColumnState / KanbanItemState,
│                                  #   5 Symbol contexts, DEFAULT_KANBAN_ANNOUNCEMENTS
├── kanban.svelte                  # Root         ← kanban.tsx:204-640  (DndContext + provider)
├── kanban-board.svelte            # Board        ← kanban.tsx:649-685
├── kanban-column.svelte           # Column       ← kanban.tsx:720-829
├── kanban-column-handle.svelte    # ColumnHandle ← kanban.tsx:835-871
├── kanban-item.svelte             # Item         ← kanban.tsx:901-990
├── kanban-item-handle.svelte      # ItemHandle   ← kanban.tsx:996-1032
├── kanban-overlay.svelte          # Overlay      ← kanban.tsx:1057-1094 (DragOverlay + createPortal)
├── kanban.test.svelte             # test-only harness (snippets, {#each}, bindings, bare parts, RTL)
└── kanban.test.ts                 # colocated tests (NOT listed in registry.json)

src/routes/docs/components/kanban/
└── +page.svelte                   # 2 <ComponentPreview> sections + 7 props tables + data/keyboard tables

registry.json                      # append exactly one registry:ui entry (contract §14)
```

**Structure Decision**: seven parts, one file each, named `kanban-<part>.svelte` with the root at
`kanban.svelte`, mapping 1:1 onto the upstream functions listed above. Non-markup logic is split
three ways so the reusable and the bespoke parts are separable by inspection: pure maths with no
runes (`kanban-collision.ts`, precedent `sortable-geometry.ts` / `masonry-positioner.ts`), the engine
extension (`kanban-dnd.svelte.ts`), and the component's own semantics (`kanban.svelte.ts`). The demo
route segment (`kanban`), the folder slug (`kanban`) and the registry item name (`kanban`) are
identical, so the docs sidebar links resolve by construction.

## Public API

Full detail — every default, every class string, every attribute — is in
[contracts/kanban-api.md](./contracts/kanban-api.md). Summary, derived from `kanban.tsx`:

### `Kanban` (Root) — renders no element; `<script lang="ts" generics="T">`

| Prop | Type | Default | Bindable |
| ---- | ---- | ------- | -------- |
| `value` | `Record<UniqueIdentifier, T[]>` | `undefined` | **yes** |
| `defaultValue` | `Record<UniqueIdentifier, T[]>` | `{}` | no |
| `onValueChange` | `(columns: Record<UniqueIdentifier, T[]>) => void` | — | no |
| `getItemValue` | `(item: T) => UniqueIdentifier` | — | no |
| `onMove` | `(event: KanbanMoveEvent) => void` | — | no |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | no |
| `strategy` | `SortableStrategy` | `verticalListSortingStrategy` | no |
| `modifiers` | `SortableModifier[]` | `undefined` | no |
| `flatCursor` | `boolean` | `false` | no |
| `dir` | `'ltr' \| 'rtl'` | inherited | no |
| `id` | `string` | `$props.id()` | no |
| `accessibility` | `KanbanAccessibility` | — | no |
| `onDragStart` / `onDragMove` / `onDragOver` / `onDragEnd` / `onDragCancel` | `(event: KanbanDragEvent) => void` | — | no |

Snippets: `children`. Callbacks: the five drag hooks plus `onValueChange` / `onMove`. Throws
`` `getItemValue` is required when using array of objects ``. `strategy` is accepted and applied to
nothing — upstream stores it and never reads it (R-08). Renders two `sr-only` nodes: the
`role="status" aria-live="assertive"` live region and the instructions element.

### `Kanban.Board`

`ref` (**bindable**), `class`, `...restProps`. Snippets: `children`, `child({ props })`. No
callbacks. Element `<div data-slot="kanban-board" data-orientation aria-orientation>`; layout
`flex size-full gap-4` + `flex-row`/`flex-col` by orientation. Throws outside `<Kanban>`.

### `Kanban.Column`

`value: UniqueIdentifier` (required), `asHandle?: boolean` (`false`), `disabled?: boolean` (`false`),
`ref` (**bindable**), `class`, `style`, `...restProps`. Snippets: `children`, `child({ props })`. No
callbacks. Data: `data-slot`, `data-value`, `data-disabled`, `data-dragging`, `data-flat-cursor`.
Throws on an empty-string `value` and outside `Board`/`Overlay`.

### `Kanban.ColumnHandle`

`disabled?: boolean` (defaults to the column's), `ref` (**bindable**), `class`, `...restProps`.
Snippets: `children`, `child({ props })`. Renders
`<button type="button" aria-controls={column.id}>`. Data: `data-slot`, `data-disabled`,
`data-dragging`, `data-flat-cursor`. Throws outside `Column`.

### `Kanban.Item`

`value: UniqueIdentifier` (required), `asHandle?: boolean` (`false`), `disabled?: boolean` (`false`),
`ref` (**bindable**), `class`, `style`, `...restProps`. Snippets: `children`, `child({ props })`. No
callbacks. Data: `data-slot`, `data-value`, `data-disabled`, `data-dragging`, `data-flat-cursor`.
Throws on an empty-string `value` and outside `Board`/`Overlay`.

### `Kanban.ItemHandle`

`disabled?: boolean` (defaults to the item's), `ref` (**bindable**), `class`, `...restProps`.
Snippets: `children`, `child({ props })`. Renders `<button type="button" aria-controls={item.id}>`.
Data as `ColumnHandle`. Throws outside `Item`.

### `Kanban.Overlay`

`container?: Element | DocumentFragment | string | null` (`document.body`), `class`, `...restProps`.
Snippet: `children({ value, variant })` — one snippet covering both upstream forms (fixed content, or
content computed from the active identifier and whether it is a `'column'` or an `'item'`). No
callbacks. Throws outside `<Kanban>`.

### Shared module this port exports for reuse (deliverable 5, R-19)

`kanban-collision.ts`, re-exported from the barrel: `pointerWithin`, `rectIntersection`,
`getFirstCollision`, `closestCenterAmong`, `filterByDirection`, `resolveKanbanArrowTarget`, plus the
`KanbanArrowKey` and `KanbanDroppable` types. Pure, rune-free and component-agnostic, so any later
multi-container drag component (swimlanes, tree, dual-list picker) composes it instead of re-deriving
the absolute-direction filter. `KanbanDndState` and the three state classes are exported alongside it
so a consumer can build their own part.

### What this port consumes (the reuse edge)

From `$lib/components/ui/sortable/index.js`: `DndState`, `DragSession`, `DndNodeEntry`,
`DndStateProps`, `closestCenter`, `closestCorners`, `arrayMove`, `toClientRect`, `translate3d`,
`verticalListSortingStrategy`, `horizontalListSortingStrategy` and the `UniqueIdentifier` /
`ClientRect` / `Coordinates` / `SortableModifier` / `SortableStrategy` /
`SortableCollisionDetection` types. From `$lib/components/ui/direction-provider/index.js`:
`useDirection`. Recorded in the registry as
`"registryDependencies": ["sortable", "direction-provider"]`.

## Implementation phases

Ordering is dependency-driven; `/speckit-tasks` expands this into `tasks.md`, which is then the
authoritative ordering.

| # | Phase | Deliverable | Depends on |
| - | ----- | ----------- | ---------- |
| 1 | Setup | Confirm the reuse surface actually exported by `sortable/index.ts`; create the empty component + docs folders; `registry.json` stub | — |
| 2 | Tests | `kanban.test.svelte` harness + `kanban.test.ts` (groups A-F), written and failing before any implementation module exists | 1 |
| 3 | Core modules | `kanban-collision.ts` (pure) → `kanban-dnd.svelte.ts` (`move()` override) → `kanban.svelte.ts` (state classes, 5 `Symbol` contexts, announcement builders) | 2 |
| 4 | Parts | `kanban.svelte` → `kanban-board.svelte` → `kanban-column.svelte` → `kanban-column-handle.svelte` → `kanban-item.svelte` → `kanban-item-handle.svelte` → `kanban-overlay.svelte` | 3 |
| 5 | Barrel and types | `index.ts` exporting both usage styles, all prop/child-props types, the state classes and the reusable collision module | 4 |
| 6 | Demo route | `src/routes/docs/components/kanban/+page.svelte` — 2 example sections + 7 props tables + data-attributes and keyboard tables | 5 |
| 7 | Registry | Append the `registry.json` entry, run `pnpm run registry:build` | 5, 6 |
| 8 | Verification | `format → check → lint → test:unit --run → build` green with no suppression, plus a targeted `sortable.test.ts` run as the R-02 regression guard | 2-7 |

## Test plan

Colocated at `src/lib/components/ui/kanban/kanban.test.ts` with the `kanban.test.svelte` harness,
grouped to cover every area constitution III makes mandatory. Every `it` asserts
(`expect.requireAssertions`).

- **A. Collision and keyboard geometry (pure)** — `pointerWithin` hit/miss; `rectIntersection`
  ranking by overlap area; `getFirstCollision`; `closestCenterAmong`; `filterByDirection` for all four
  keys against upstream's four inequalities; `resolveKanbanArrowTarget` covering item→item in the same
  column, item→item across columns, item→**empty** column, column→column, disabled candidates skipped
  (not aborting — the R-06 divergence), and RTL inversion of `ArrowLeft`/`ArrowRight`.
- **B. Rendering, roles and ARIA** — `data-slot` on all seven parts; the §7 activator attribute set
  on the column/item when `asHandle` and on each handle otherwise; `aria-controls` → the column's /
  item's own id; `aria-describedby` → the instructions element, which exists and carries the
  documented text; the live region's `role`/`aria-live`/`aria-atomic`; `aria-orientation` and
  `data-orientation` on the board.
- **C. Props** — every row of contract §2-§8: `orientation` flipping the board's axis;
  `getItemValue` for object items; `modifiers` invoked; `flatCursor` → `data-flat-cursor` + cursor
  classes; `asHandle` on both column and item; `disabled` on column, item and each handle;
  `container` on the overlay; `class` merged last; `...restProps` spread; `ref` bound; `child`
  receiving the merged props (including the registration attachment, so a `child`-rendered item is
  still draggable); `strategy` accepted without effect (asserted as the documented upstream no-op).
- **D. Guard rails and throws** — all nine throw cases of R-13 (R-13's eight message forms, with the
  generic within-`<Kanban>` form covering both `Board` and `Overlay`) through
  `expect(() => render(...)).toThrow(/within/)` (and `/empty string/`, `/getItemValue/`); a disabled
  column or item cannot be picked up by pointer or keyboard and is never a drop target, while its
  siblings keep working.
- **E. Keyboard — including cross-column movement and its announcements (US4, FR-005-FR-007,
  SC-004, SC-008)** — one test per row of contract §9: `Space` and `Enter` pick-up on an item handle
  and on a column handle; arrow movement within a column; **`ArrowRight`/`ArrowLeft` moving the drop
  target into an adjacent column**, including into an empty one; `Enter`/`Space` dropping and
  committing; `Escape` cancelling with no commit; `Tab` swallowed mid-drag; focus retained across the
  commit. Each asserts **both** the resulting `value` **and** the live-region text, so the four
  announcement forms of contract §10 — pick-up, same-column move, `… in <column>` cross-column move,
  drop and cancel — are each covered by an explicit expectation.
- **F. Pointer, controlled/uncontrolled, RTL** — with `stubRects()`: a `user-event` pointer drag
  past a neighbour in the same column committing the reorder; a drag into another column committing
  the cross-column move on `onDragOver` (item absent from the source, present in the destination); a
  drop into an empty column; a column drag by its handle reordering `Object.keys(value)` with every
  item list intact; a release outside every target committing nothing; `defaultValue` seeding and
  self-updating; `value` + `onValueChange` leaving the parent authoritative (a declining setter leaves
  the board unchanged); `onMove` suppressing the default commit; `dir="rtl"` supplied both as a prop
  and through `DirectionProvider`, inverting `ArrowLeft`/`ArrowRight` (SC-005).
- **G. Overlay (US5, FR-011)** — with `stubRects()`: nothing rendered while no drag is in progress;
  during an item drag a portalled `[data-slot="kanban-overlay"]` exists, carries `data-variant="item"`
  and `data-dragging`, and invokes `children({ value, variant })` with the dragged item's identifier;
  during a column drag it carries `data-variant="column"` and receives the column's identifier; the
  overlay is removed on drop and on `Escape`; `container` portals it into the supplied element; a
  `<Kanban.Column>`/`<Kanban.Item>` rendered inside it is an inert preview that never registers;
  mounting an overlay suppresses the dragged element's own transform (R-07).

## Complexity Tracking

> No constitution violation is carried forward. The single principle with genuine tension — IV,
> Composition Over Reimplementation — is satisfied through its written-justification clause above:
> the primitives were evaluated and named, `sortable`'s engine is composed rather than duplicated,
> and the bespoke surface is one overridden method plus six pure functions. Principles II, VI and VII
> are unaffected.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | none      | —          | —                                      |
