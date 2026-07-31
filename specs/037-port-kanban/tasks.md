---
description: 'Task list for the Kanban port'
---

# Tasks: Kanban

**Input**: Design documents from `/specs/037-port-kanban/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/kanban-api.md, quickstart.md

**Tests**: MANDATORY (constitution Principle III / VII). All tests live in the colocated
`src/lib/components/ui/kanban/kanban.test.ts`, backed by the `kanban.test.svelte` render harness, and
must be written and failing before the corresponding implementation module exists.

**Reuse constraint**: The drag engine is **not** reimplemented. `KanbanDndState` subclasses `DndState`
imported from `$lib/components/ui/sortable/index.js` and overrides only `move()`. No file under
`src/lib/components/ui/sortable/**` is created, edited, or otherwise touched by any task below.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps the task to the user story/stories it proves (US1–US5, spec.md)
- Every task names an exact repository-root-relative file path

---

## Phase 1: Setup

**Purpose**: Confirm the reuse surface, scaffold the two directories, stub the registry entry.

- [X] T001 Verify `src/lib/components/ui/sortable/index.ts` exports the full reuse surface data-model.md
      §1 requires — `DndState`, `DragSession`, `DndNodeEntry`, `DndStateProps`, `closestCenter`,
      `closestCorners`, `arrayMove`, `toClientRect`, `translate3d`, `verticalListSortingStrategy`,
      `horizontalListSortingStrategy`, `UniqueIdentifier`, `ClientRect`, `Coordinates`,
      `SortableModifier`, `SortableStrategy`, `SortableCollisionDetection` — and that
      `src/lib/components/ui/direction-provider/index.ts` exports `useDirection`/`Direction`. Read-only
      check; record any gap as a blocker before Phase 3 starts (none expected — all names already exist).
- [X] T002 [P] Create the empty component directory `src/lib/components/ui/kanban/` (no files yet — the
      directory that Phase 3–5 tasks populate).
- [X] T003 [P] Create the empty docs route directory `src/routes/docs/components/kanban/` (no files yet
      — populated by T025).
- [X] T004 Append a stub `registry:ui` entry named `"kanban"` (`name`, `type`, `title`, `description`,
      `"registryDependencies": ["sortable", "direction-provider"]`, `"dependencies": ["bits-ui"]`,
      `"files": []`) to the `items` array in `registry.json` at the repository root. T026 replaces the
      empty `files` array with the full 11-file list once every source file exists.

**Checkpoint**: reuse surface confirmed, folders exist, registry stub present — implementation may begin.

---

## Phase 2: Tests (write first, must fail before Phase 3)

**Purpose**: Encode every behavioural area constitution III mandates, plus the pure collision/geometry
and props surfaces, before any implementation module exists (Principle VII).

- [X] T005 [P] Create the render harness `src/lib/components/ui/kanban/kanban.test.svelte` — a bindable
      `value` board harness rendering `<Kanban><Kanban.Board>{#each columns}<Kanban.Column>{#each
      items}<Kanban.Item>…` with typed snippets for column/item content, an overlay slot, and bare
      single-part render helpers (`Kanban.Board`/`Column`/`Item`/`ColumnHandle`/`ItemHandle`/`Overlay`
      rendered with no ancestor) for the out-of-provider throw tests in T009. Imports every part
      directly from its `.svelte` file (e.g. `./kanban.svelte`, `./kanban-board.svelte`), never from
      `./index.js`, so the harness — and the whole test suite — compiles before the T024 barrel exists.
- [X] T006 [US2] [US3] Add collision & keyboard-geometry unit tests (plan test group A) to
      `src/lib/components/ui/kanban/kanban.test.ts`, importing directly from `kanban-collision.ts`
      (no rendering): `pointerWithin` hit/miss, `rectIntersection` ranking by overlap area,
      `getFirstCollision`, `closestCenterAmong`, `filterByDirection` for all four arrow keys against
      upstream's four inequalities (contract §9), and `resolveKanbanArrowTarget` covering item→item in
      the same column, item→item across columns, item→**empty** column, column→column, a disabled
      candidate being skipped rather than aborting (R-06), and RTL inversion of `ArrowLeft`/`ArrowRight`.
- [X] T007 [US4] Add accessibility roles-and-names tests (plan test group B) to
      `src/lib/components/ui/kanban/kanban.test.ts` using the T005 harness: `data-slot` on all seven
      parts; the §7 activator attribute set (`role="button"` only on a `<div>` activator, `tabindex`,
      `aria-roledescription="draggable"`, `aria-describedby`, `aria-disabled`, `aria-pressed`) on the
      column/item when `asHandle` and on each handle otherwise (FR-018); `aria-controls` pointing at the
      column's/item's own id; `aria-describedby` resolving to the instructions element and its documented
      text (contract §10); the live region's `role="status"`, `aria-live="assertive"`, `aria-atomic`;
      `aria-orientation`/`data-orientation` on the board; and every row of the upstream
      `DataAttributesTable` (contract §11): `data-disabled` present on a disabled `Kanban.Column`,
      `Kanban.ColumnHandle`, `Kanban.Item` and `Kanban.ItemHandle` and **absent** — not `"false"` —
      when enabled; `data-dragging` present on the dragged column/item **and on its handle** for the
      duration of a pointer drag and of a keyboard drag, and absent before pick-up and after drop;
      `data-value` on `Column`/`Item`; `data-variant`/`data-dragging` on the overlay. Every boolean
      asserted with `toHaveAttribute` for presence and `not.toHaveAttribute` for absence, proving the
      `cond ? '' : undefined` spelling.
- [X] T008 [US1] [US2] [US3] [US5] Add props-surface tests (plan test group C) to
      `src/lib/components/ui/kanban/kanban.test.ts`: `orientation` flipping the board's axis and class
      list; `getItemValue` for object items; `modifiers` invoked during a drag; `flatCursor` toggling
      `data-flat-cursor` and the cursor classes; `asHandle` on both column and item; `disabled` on
      column, item, and each handle; `container` on `Kanban.Overlay`; caller `class` merged last;
      `...restProps` spread onto the rendered element; `ref` bound via `bind:this`; the `child` snippet
      receiving the merged props (including the registration attachment, so a `child`-rendered item is
      still draggable) — proving a caller-supplied element retains registration, drag activation and
      every documented data attribute (FR-021); `strategy` accepted and asserted as a documented no-op
      (R-08).
- [X] T009 [US1] [US2] [US3] [US4] [US5] Add guard-rail and edge-case tests (plan test group D) to
      `src/lib/components/ui/kanban/kanban.test.ts` using the T005 bare-part helpers: all nine throw
      cases (R-13's eight message forms, with the generic within-`<Kanban>` form covering both `Board`
      and `Overlay`) —
      `Kanban.Board`/`Column`/`Item`/`ColumnHandle`/`ItemHandle`/`Overlay` outside their required
      ancestor (`expect(() => render(...)).toThrow(/within/)`), an empty-string `Column`/`Item` `value`
      (`/empty string/`), and an object item with no `getItemValue` (`/getItemValue/`); a `disabled`
      column or item cannot be picked up by pointer or keyboard and is never a drop target while its
      siblings keep working; a column left empty after its last item is dragged out remains a valid,
      rendered drop target.
- [X] T010 [US4] Add keyboard-interaction tests including cross-column movement and its announcements
      (plan test group E; FR-005–FR-007, SC-004, SC-008) to
      `src/lib/components/ui/kanban/kanban.test.ts`, driven through `user-event`, one test per row of
      contract §9: `Space`/`Enter` pick-up on an item handle and on a column handle (asserting the
      pick-up announcement, position, and total count); arrow movement within a column;
      **`ArrowRight`/`ArrowLeft` moving the drop target into an adjacent column, including into an empty
      one, regardless of the board's configured `orientation`**; `Enter`/`Space` dropping and committing;
      `Escape` cancelling with no commit; `Tab` swallowed mid-drag; focus retained across the commit.
      Each case asserts **both** the resulting `value` **and** the live-region text, covering all four
      announcement forms of contract §10 (pick-up, same-column move, cross-column `… in <column>` move,
      drop, cancel). Additionally assert the override surface (FR-020, contract §10): supplying
      `accessibility={{ announcements: { onDragStart } }}` replaces only the pick-up text while the
      target-change, drop and cancel announcements keep their documented defaults, and
      `accessibility={{ screenReaderInstructions: { draggable: '…' } }}` replaces the text of the
      `data-slot="kanban-instructions"` element that every activator's `aria-describedby` resolves to.
- [X] T011 [US1] [US2] [US3] Add pointer-drag commit tests (plan test group F, pointer half) to
      `src/lib/components/ui/kanban/kanban.test.ts`, installing a local `stubRects()` helper in the same
      file to give deterministic `getBoundingClientRect` values (jsdom performs no layout): a
      `user-event` pointer drag past a neighbour in the same column commits the reorder; a drag into
      another column commits the cross-column move on `onDragOver` (item absent from the source list,
      present in the destination list); a drop into an empty column leaves that column with only the
      dropped item; a column drag by its handle reorders `Object.keys(value)` with every item list
      intact; a release outside every target commits nothing.
- [X] T012 [US1] [US2] Add controlled-vs-uncontrolled state tests (plan test group F, state half) to
      `src/lib/components/ui/kanban/kanban.test.ts`: `defaultValue` seeds the board and internal
      interaction updates it (uncontrolled); passing `value` makes the parent authoritative and
      `onValueChange` fires with the next value while a declining setter leaves the board unchanged
      (controlled); `onMove` suppresses the default same-column-drop commit and receives
      `{ active, over, activeIndex, overIndex }`; and `onDragStart`, `onDragMove`, `onDragOver`,
      `onDragEnd` and `onDragCancel` each fire at their documented stage with the `{ active, over }`
      payload of data-model.md §5 — asserted with `vi.fn()` spies for a pointer drag that commits, and
      for a keyboard drag cancelled with `Escape` (which must fire `onDragCancel` and never
      `onDragEnd`) (FR-019).
- [X] T013 [US4] Add RTL tests (plan test group F, RTL half; SC-005) to
      `src/lib/components/ui/kanban/kanban.test.ts`: with `dir="rtl"` supplied both directly as a prop
      and inherited through `DirectionProvider`, `ArrowLeft`/`ArrowRight` invert during keyboard
      cross-column movement (reusing T010's cases with the direction flipped) and a pointer drag that
      moved right in LTR now moves left.
- [X] T013a [US5] Add overlay tests (plan test group G; FR-011, US5 acceptance scenarios 1-3) to
      `src/lib/components/ui/kanban/kanban.test.ts` using the T005 harness and `stubRects()`: no
      `[data-slot="kanban-overlay"]` node exists while no drag is in progress; during an item drag the
      portalled overlay exists with `data-variant="item"` and `data-dragging`, and its
      `children({ value, variant })` snippet receives that item's identifier and `variant === 'item'`;
      during a column drag by its handle the overlay receives the column's identifier and
      `variant === 'column'` and renders the column preview; the overlay is removed on drop and on
      `Escape`; a `container` element portals it there instead of `document.body`; a `<Kanban.Item>`
      rendered inside the overlay neither registers nor drags.

**Checkpoint**: `kanban.test.ts` and `kanban.test.svelte` exist and every test fails (no implementation
module exists yet) — Phase 3 may begin.

---

## Phase 3: Core component files

**Purpose**: One task per exported subcomponent in plan.md's Public API section, plus the three modules
underneath them, built bottom-up so each file only imports what already exists.

- [X] T014 Implement `src/lib/components/ui/kanban/kanban-collision.ts` — pure, rune-free:
      `pointerWithin`, `rectIntersection`, `getFirstCollision`, `closestCenterAmong`,
      `filterByDirection`, `resolveKanbanArrowTarget`, and the `KanbanArrowKey`/`KanbanDroppable` types
      (contract §9, data-model.md §3). Depends on T006 existing and failing.
- [X] T015 Implement `src/lib/components/ui/kanban/kanban-dnd.svelte.ts` — `KanbanDndState extends
      DndState` (imported from `$lib/components/ui/sortable/index.js`), overriding only `move()` to
      resolve the drop target through a `resolveOverId(session, pointer)` prop reconstructed as
      `initialCoordinates + delta` (R-05, data-model.md §3); every other member (sensors, activation
      constraints, pointer capture, `moveToIndex`, `end`, `cancel`, `destroy`, the keyboard machine) is
      inherited unchanged. Depends on T014.
- [X] T016 Implement `src/lib/components/ui/kanban/kanban.svelte.ts` — `KanbanRootState`,
      `KanbanColumnState`, `KanbanItemState` (data-model.md §3), the five `Symbol`-keyed contexts with
      throwing getters (`setKanbanContext`/`getKanbanContext`,
      `setKanbanColumnContext`/`getKanbanColumnContext`, `setKanbanItemContext`/`getKanbanItemContext`,
      plus the board/overlay presence flags, data-model.md §4), `DEFAULT_KANBAN_ANNOUNCEMENTS` and the
      verbatim upstream announcement builders (contract §10), and the `KanbanValue`, `KanbanDragEvent`,
      `KanbanMoveEvent`, `KanbanAccessibility`, `KanbanAnnouncements`, `KanbanAnnouncementArgs`,
      `KanbanOrientation` and `KanbanOverlayVariant` types (data-model.md §5); and a `useKanbanItem()`
      helper mirroring the `sortable` barrel's `useSortable()` (contract §13). Depends on T015.
- [X] T017 Implement the root `src/lib/components/ui/kanban/kanban.svelte` (`<script lang="ts"
      generics="T">`) — renders no element of its own; constructs `KanbanRootState`/`KanbanDndState`,
      publishes the root context, renders the `role="status" aria-live="assertive" aria-atomic="true"
      data-slot="kanban-live-region"` and `data-slot="kanban-instructions"` `sr-only` nodes; exports
      `KanbanRootProps`/`KanbanProps` from the module script with every prop and default of contract §2,
      `value`/`ref` as `$bindable`; throws `` `getItemValue` is required when using array of objects ``
      on the first unresolvable object item. Depends on T016.
- [X] T018 [P] Implement `src/lib/components/ui/kanban/kanban-board.svelte` (`Kanban.Board`, contract
      §3) — `<div data-slot="kanban-board" data-orientation aria-orientation>`,
      `flex size-full gap-4` + `flex-row`/`flex-col` by orientation, `ref`/`class`/`child`/`children`/
      `...restProps`; throws `` `<Kanban.Board>` must be used within `<Kanban>`. ``. Depends on T017.
- [X] T019 [P] Implement `src/lib/components/ui/kanban/kanban-column.svelte` (`Kanban.Column`, contract
      §4) — required `value`, `asHandle`, `disabled`, `ref`/`class`/`style`/`child`/`children`/
      `...restProps`; `data-slot="kanban-column"`, `data-value`, `data-disabled`, `data-dragging`,
      `data-flat-cursor`; the §7 activator attributes and pointer/keyboard activators when `asHandle`
      and not disabled; throws on an empty-string `value` and outside `Board`/`Overlay`. Depends on T017.
- [X] T020 [P] Implement `src/lib/components/ui/kanban/kanban-column-handle.svelte`
      (`Kanban.ColumnHandle`, contract §5) — `disabled` defaulting to the column's,
      `ref`/`class`/`child`/`children`/`...restProps`; renders
      `<button type="button" aria-controls={column.id} data-slot="kanban-column-handle">` with the §7
      activator attributes; throws `` `<Kanban.ColumnHandle>` must be used within `<Kanban.Column>`. ``.
      Depends on T017.
- [X] T021 [P] Implement `src/lib/components/ui/kanban/kanban-item.svelte` (`Kanban.Item`, contract §6)
      — mirrors T019 with `data-slot="kanban-item"` and the item's focus-visible ring classes; throws on
      an empty-string `value` and outside `Board`/`Overlay`. Depends on T017.
- [X] T022 [P] Implement `src/lib/components/ui/kanban/kanban-item-handle.svelte` (`Kanban.ItemHandle`,
      contract §6) — mirrors T020 with `data-slot="kanban-item-handle"` and `aria-controls={item.id}`;
      throws `` `<Kanban.ItemHandle>` must be used within `<Kanban.Item>`. ``. Depends on T017.
- [X] T023 [P] Implement `src/lib/components/ui/kanban/kanban-overlay.svelte` (`Kanban.Overlay`,
      contract §8) — `container`/`class`/`children({ value, variant })`/`...restProps`; renders nothing
      while `activeId === null`, otherwise portals (via `bits-ui` `Portal`)
      `<div data-slot="kanban-overlay" data-dragging data-variant data-flat-cursor aria-hidden="true">`
      positioned over the active element's pick-up rect and translated by the session transform;
      `variant` is `'column'` when the active id is a key of `value`, else `'item'`; publishes the
      overlay context; throws `` `<Kanban.Overlay>` must be used within `<Kanban>`. ``. Depends on T017.

**Checkpoint**: all seven parts and three supporting modules exist; T006–T009 should now pass (T010–T013,
T013a depend on drag interaction being wired up, which is complete by the end of this phase). Because
T005's harness imports every part directly rather than from the barrel, T006–T009 can pass here even
though the T024 barrel does not exist yet.

---

## Phase 4: Barrel and types

- [X] T024 Create `src/lib/components/ui/kanban/index.ts` — export all seven parts as short names
      (`Root`, `Board`, `Column`, `ColumnHandle`, `Item`, `ItemHandle`, `Overlay`) and prefixed aliases
      (`Kanban`, `KanbanBoard`, `KanbanColumn`, `KanbanColumnHandle`, `KanbanItem`, `KanbanItemHandle`,
      `KanbanOverlay`); re-export every prop and child-props type from contract §13
      (`KanbanRootProps`/`KanbanProps`, `KanbanBoardProps`, `KanbanBoardChildProps`,
      `KanbanColumnProps`, `KanbanColumnChildProps`, `KanbanColumnHandleProps`,
      `KanbanColumnHandleChildProps`, `KanbanItemProps`, `KanbanItemChildProps`,
      `KanbanItemHandleProps`, `KanbanItemHandleChildProps`, `KanbanOverlayProps`); re-export
      `KanbanRootState`, `KanbanColumnState`, `KanbanItemState`, `KanbanDndState`, `useKanbanItem`, the
      context getters/setters, `DEFAULT_KANBAN_ANNOUNCEMENTS`, and the event/value types including
      `type KanbanOrientation` and `type KanbanOverlayVariant`; re-export `kanban-collision.ts`'s
      `pointerWithin`, `rectIntersection`, `getFirstCollision`, `closestCenterAmong`,
      `filterByDirection`, `resolveKanbanArrowTarget`, `type KanbanArrowKey`, `type KanbanDroppable`
      (R-19). Depends on T017–T023.

**Checkpoint**: all remaining test groups (T010–T013, T013a) should now pass against the complete
implementation. Any test that imports from `./index.js` rather than a part file directly cannot pass
before this checkpoint, since T024 is the first task that creates the barrel.

---

## Phase 5: Demo route

- [X] T025 Create `src/routes/docs/components/kanban/+page.svelte` — two `<ComponentPreview>` sections
      mirroring `.reference/diceui/docs/registry/bases/radix/examples/kanban-demo.tsx` (US1–US4:
      `getItemValue`, `asHandle`, a `ColumnHandle` composed onto `Button` via `child`, a fixed overlay)
      and `kanban-dynamic-overlay-demo.tsx` (US5: `children({ value, variant })` rendering a full column
      preview for a column drag and a card for an item drag); plus an API Reference block with seven
      props tables (Root, Board, Column, ColumnHandle, Item, ItemHandle, Overlay), a data-attributes
      table (contract §11), and a keyboard table (contract §9), following the pattern already used by
      `src/routes/docs/components/sortable/+page.svelte`. Demo state held in the page with runes; no
      `+page.ts`. Depends on T024.

---

## Phase 6: Registry entry and docs polish

- [X] T026 Replace the `"files": []` stub added in T004 with the full 11-entry `registry:ui` file list
      for `"kanban"` in `registry.json` (contract §14: `index.ts`, `kanban-collision.ts`,
      `kanban-dnd.svelte.ts`, `kanban.svelte.ts`, `kanban.svelte`, `kanban-board.svelte`,
      `kanban-column.svelte`, `kanban-column-handle.svelte`, `kanban-item.svelte`,
      `kanban-item-handle.svelte`, `kanban-overlay.svelte` — the two test files are excluded). Depends
      on T024, T025.
- [X] T027 Run `pnpm run registry:build` to regenerate the `static/r/kanban.json` registry artifact from
      the T026 entry. Depends on T026.

---

## Phase 7: Verification (MANDATORY — Principle VII)

**Purpose**: The feature is not complete until every gate is green with no suppression
(`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `.skip`/`.todo`, `as any`, a
deleted assertion, or a loosened config). Fix the root cause instead.

- [X] T028 Run `pnpm run format` (shadcn/generator output is not Prettier-formatted) across every file
      touched in Phases 1–6, then re-run `src/lib/components/ui/sortable/sortable.test.ts` unmodified as
      the R-02 regression guard for `KanbanDndState`'s subclassing of `DndState`.
- [X] T029 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, and
      fix everything that fails.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Tests (Phase 2)**: depends on Setup (T002/T003 create the folders the test files live in). T005 has
  no further dependency; T006–T013, T013a depend on T005 for the harness/bare-part helpers except T006,
  which only imports pure functions and needs no harness.
- **Core component files (Phase 3)**: depends on Phase 2 existing (tests must be written and failing
  first). Strict internal chain T014 → T015 → T016 → T017, then T018–T023 fan out from T017.
- **Barrel and types (Phase 4)**: depends on all of Phase 3 (T017–T023).
- **Demo route (Phase 5)**: depends on Phase 4 (T024).
- **Registry entry and docs polish (Phase 6)**: depends on Phase 4 and Phase 5 (T024, T025).
- **Verification (Phase 7)**: depends on everything above (Phases 1–6).

### Parallel opportunities

- T002 and T003 (different, empty directories).
- T005 (harness file) has no code dependency on the other Phase 2 tasks, but T006–T013, T013a all edit
  the single `kanban.test.ts` file and so run **sequentially**, not in parallel, regardless of the `[P]`
  marker convention — same-file tasks are never `[P]`.
- T018–T023 (six parts, six separate files, each depending only on the already-complete T017) run in
  parallel.

### User story coverage

- **US1** (within-column reorder, P1): T008, T009, T011, T012.
- **US2** (cross-column move, P1): T006, T008, T009, T011, T012.
- **US3** (column reorder, P2): T006, T008, T009, T011.
- **US4** (keyboard operation, P1): T007, T009, T010, T013.
- **US5** (overlay preview, P2): T008, T009, T013a.

---

## Implementation Strategy

### MVP first

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Tests) — all fail, confirming nothing is implemented yet.
3. Complete Phase 3 through T017 + T019 + T021 (root, Board is required for both — actually Board is
   T018) — i.e. T014–T019 and T021 give within-column reordering (US1) a working vertical slice:
   `Kanban` + `Board` + `Column` + `Item` with pointer and keyboard drag inside one column.
4. **STOP and VALIDATE**: run T006, T008 (subset), T009 (subset), T011 (same-column case), T012 against
   just that slice.

### Incremental delivery

1. Setup + Tests written and red → foundation ready.
2. T014–T021 (root, board, column, item) → US1 green → cross-column commit logic in `kanban.svelte.ts`
   already present (it's one state module) → US2 green for the same slice.
3. T020 (`ColumnHandle`) → US3 green.
4. T010/T013 keyboard + RTL suites exercise the same parts already built → US4 green once T014–T021 land
   (no additional component file needed — keyboard is a mode of the same drag engine).
5. T023 (`Overlay`) → T013a exercises it → US5 green.
6. T024–T027 → barrel, demo, registry — installable and documented.
7. T028–T029 → Verification.

---

## Notes

- `[P]` tasks touch different files with no incomplete dependency; tasks sharing `kanban.test.ts` or
  `kanban.svelte.ts` are always sequential even when listed near each other.
- Every `it` in `kanban.test.ts` must assert at least once (`expect.requireAssertions` is on,
  `vite.config.ts`).
- Do not touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json`, `.port-logs/`,
  or any file under `src/lib/components/ui/sortable/**`.
- Do not run git commands — the orchestrator owns the working tree.
- Stop at the Phase 3 checkpoint (end of T021) to validate US1 independently before continuing, per the
  Implementation Strategy above.

---

## Phase 8: Convergence

**Purpose**: Close the gaps found by auditing the implemented port against spec.md, plan.md,
contracts/kanban-api.md and research.md. Appended by `/speckit-converge`; the four quality gates of
Phase 7 must be re-run green after every task below.

- [X] T030 [US1] [US4] Restore the board on cancel in
      `src/lib/components/ui/kanban/kanban.svelte.ts` per FR-005, US1 acceptance scenario 3 and US4
      acceptance scenario 4 (contradicts). `#onSessionCancel` commits nothing, but `#commitOver` has
      already published the same-column `arrayMove` and the cross-column move while the drag was still
      running, so `Escape` leaves the item where the mid-drag commit put it instead of returning it to
      its original column and position — FR-005 requires `Escape` to "cancel the operation and restore
      its original position". Snapshot `value` in `#onSessionStart` and republish that snapshot from
      `#onSessionCancel` when at least one mid-drag commit occurred (leaving the no-commit case
      publishing nothing, so a controlled parent is not notified of a no-op). Upstream does not restore,
      so record the restore as an *Added beyond upstream* entry in research.md R-18's divergence
      register. Then add the missing cases to
      `src/lib/components/ui/kanban/kanban.test.ts`: `Escape` after `{ArrowDown}` inside one column
      returns the column to its original order, and `Escape` after a pointer drag that already crossed
      into another column returns the item to its source column — the existing `Escape` test drags a
      *column*, which has no mid-drag commit and therefore never exercised either path.
- [X] T031 [US4] Add the missing activator ARIA-state assertions to
      `src/lib/components/ui/kanban/kanban.test.ts` per FR-018, SC-008 and T007 (partial). `aria-disabled`
      appears nowhere in the suite, and `tabindex` is only ever asserted present on an enabled activator,
      so two rows of the contract §7 table — `aria-disabled` `"true"` when disabled and absent otherwise,
      and `tabindex` absent when disabled — have no coverage even though T007 names both, and SC-008
      requires 100% of the documented ARIA states to be tested. Assert both on a disabled
      `Kanban.Column`/`Kanban.Item` under `asHandle` and on a disabled `Kanban.ColumnHandle`/
      `Kanban.ItemHandle`, using `toHaveAttribute` for presence and `not.toHaveAttribute` for absence;
      additionally assert that a handle `<button>` carries no `role="button"`, the third §7 row
      ("`role` — only when the activator is a `<div>`") that currently has no direct assertion.
- [X] T032 [US1] Reconcile the `onMove` short-circuit in `#commitOver` in
      `src/lib/components/ui/kanban/kanban.svelte.ts` with contract §12 and research R-07 (contradicts).
      Both artifacts state that the same-column `onDragOver` reorder publishes "through `onValueChange`
      only — never `onMove`", i.e. the mid-drag commit is unconditional and `onMove` intercepts only the
      drop; the implementation instead returns early whenever `onMove` is supplied, so a consumer using
      `onMove` gets no live reflow at all during a same-column drag. The in-source comment claims the
      departure is "recorded in the plan's divergence register", but R-18 does not contain it. Either
      restore the unconditional mid-drag commit while keeping `onMove` firing at the drop (note that
      `#commitOver` sets `session.overId = activeId` after a commit, which currently makes `#commitEnd`
      find `activeIndex === overIndex` and return before calling `onMove` — resolve that so `onMove`
      still receives its `{ active, over, activeIndex, overIndex }` payload), and update the T012
      expectation accordingly; or, if the engine genuinely cannot support it, add the suppression to
      R-18's divergence register and to spec.md § Assumptions as a named behavioural divergence.
- [X] T033 [US3] Add a `Kanban.Column` `child`-snippet test to
      `src/lib/components/ui/kanban/kanban.test.ts` per FR-021 and T008 (missing). FR-021 requires
      *every* rendered part to allow a caller-supplied element while retaining registration, drag
      activation and every documented data attribute, and `kanban.test.svelte` already implements a
      `columnAsChild` branch — but no test ever selects it, so only the item and the two handles are
      covered. Render with `columnAsChild: true` and assert the caller's element carries
      `data-slot="kanban-column"` and `data-value`, and that the column is still registered and
      draggable purely through the spread props (pick it up and assert the pick-up announcement plus
      `data-dragging`), mirroring the existing item `child` test.
- [X] T034 Apply the documented `strategy` default in
      `src/lib/components/ui/kanban/kanban.svelte` per contract §2 and plan.md § Public API (partial).
      The prop is destructured with no default, so `KanbanRootState.strategy` — which the barrel exposes
      and a consumer can read off the context exactly as upstream reads it off its own — is `undefined`,
      while contract §2, plan.md's Public API table and the docs prop table all document the default as
      `verticalListSortingStrategy`. Default it to `verticalListSortingStrategy` (already exported from
      `$lib/components/ui/sortable/index.js`), keeping the prop the documented no-op it is upstream
      (R-08), and extend the existing "accepts strategy as the documented no-op" test to assert the
      default is what the context reports when the consumer passes nothing.

**Checkpoint**: re-run `pnpm run format`, `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run`
and `pnpm run build`, plus `src/lib/components/ui/sortable/sortable.test.ts` unmodified as the standing
R-02 regression guard.
