---
description: 'Task list for the Sortable port'
---

# Tasks: Sortable

**Input**: Design documents from `/specs/036-port-sortable/` (plan.md, spec.md, research.md, data-model.md, contracts/sortable-api.md, quickstart.md)

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/sortable-api.md

**Tests**: Tests are MANDATORY (constitution Principle III / VII). Every colocated test lives at `src/lib/components/ui/sortable/sortable.test.ts`, using the `sortable.test.svelte` composition harness, and must be written and failing before the implementation files in Phase 3 exist.

**Organization**: Phases are ordered Setup → Tests → Core component files → Barrel and types → Demo route → Registry entry and docs polish → Verification, per the component-specific instructions for this port. Each task still carries a `[US1]`/`[US2]`/`[US3]` label where it maps to a specific user story from spec.md, so story-level traceability and independent-test coverage are still visible even though the phases are organized by layer (Setup → drag engine → parts → docs), which is the correct dependency order for a component whose parts cannot compile or be tested against a nonexistent shared engine.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task serves — `US1` (pointer drag, P1), `US2` (keyboard, P1), `US3` (handle/overlay/primitive values, P2). Tasks with no story label are foundational (engine/state) or cross-cutting (setup, barrel, docs, registry, gates).

## Path Conventions

- **Component source**: `src/lib/components/ui/sortable/` — 5 parts, `sortable-geometry.ts`, `sortable-dnd.svelte.ts`, `sortable.svelte.ts`, `index.ts`
- **Tests**: colocated at `src/lib/components/ui/sortable/sortable.test.ts` + `sortable.test.svelte` harness (not shipped in the registry)
- **Demo route**: `src/routes/docs/components/sortable/+page.svelte`
- **Registry**: `registry.json` at the repository root

---

## Phase 1: Setup

**Purpose**: Confirm the dependency surface and stand up the empty component folder + a registry stub, so every later phase has somewhere to write.

- [X] T001 Confirm no new npm dependency is required: check `package.json` for `bits-ui` (`^2.18`, for `Portal`) and the existing `src/lib/components/ui/{button,direction-provider}` folders. Do not run `pnpm add` or `shadcn-svelte add` — this is a read-only confirmation, no file changes (research R-01/R-09/R-25).
- [X] T002 [P] Create the empty component directory `src/lib/components/ui/sortable/` and the empty docs route directory `src/routes/docs/components/sortable/` (no files yet beyond what later tasks create), matching `plan.md` "Project Structure".
- [X] T003 [P] Append a stub entry for `sortable` to the root `registry.json` `items` array: `name: "sortable"`, `type: "registry:ui"`, `title: "Sortable"`, `description: "A drag and drop sortable component for reordering items."`, `registryDependencies: ["direction-provider"]`, `dependencies: ["bits-ui"]`, `files: []` (populated by T023). `button` is not a registry dependency — the handle renders a native `<button type="button">` with its own class list, not this project's `Button` component (plan.md "Bespoke behaviour justification", spec §Assumptions). This is the only edit to `registry.json` until T023.

**Checkpoint**: folders exist, `registry.json` has a placeholder entry, dependency surface confirmed.

---

## Phase 2: Tests (write first — MANDATORY, Principle III/VII)

**Purpose**: Author the full colocated test suite against contracts/sortable-api.md and data-model.md §4 *before* any implementation module exists. These tests MUST fail (or fail to compile against missing modules) until Phase 3 lands; do not skip or `.todo` any of them to make them pass early.

- [X] T004 [P] Create the composition test harness `src/lib/components/ui/sortable/sortable.test.svelte`: a thin wrapper that mounts `Sortable.Root` + `Sortable.Content` + a caller-supplied set of `Sortable.Item`/`ItemHandle`/`Overlay` (via snippet/props) plus bare-part variants (an `Item` alone, a `Content` alone, an `ItemHandle` alone, an `Overlay` alone) so `sortable.test.ts` can render both full compositions and the out-of-provider guard-rail cases without repeating markup per test.
- [X] T005 Write the geometry pure-unit-test suite (plan.md Test plan group A) in `src/lib/components/ui/sortable/sortable.test.ts`, importing directly from `./sortable-geometry.ts` (no DOM, no Svelte render): `closestCenter`/`closestCorners` ranking on hand-authored `ClientRect`s; each of `verticalListSortingStrategy`/`horizontalListSortingStrategy`/`rectSortingStrategy`'s transform for an item before/at/after the active index; each of `restrictToVerticalAxis`/`restrictToHorizontalAxis`/`restrictToParentElement`'s clamp; `arrayMove` including a no-op and an out-of-range index; `resolveKeyboardIndex` across all four arrow keys × the three orientations × both `dir` values, plus the disabled-candidate-skip rule and the degenerate/zero-area-rect fallback (data-model.md §1 rules 1–5).
- [X] T006 Write the accessibility roles-and-names test suite (contract §10 data attributes, §5–§7 activator attributes) in `src/lib/components/ui/sortable/sortable.test.ts`, using the T004 harness: `data-slot` present on all five parts and on the root's live region (`sortable-live-region`) and instructions element (`sortable-instructions`); `data-orientation` present on `Content` for all three orientations; the R-11 activator attribute set (`role="button"`, `tabindex="0"`, `aria-roledescription="sortable"`, `aria-describedby`) present on the `Item` when `asHandle` and on the `ItemHandle` otherwise (and absent from the non-activator part); `aria-pressed="true"` on the activator while dragging and absent (or `"false"`) once dropped; `aria-controls` on the handle equals the owning item's id; `aria-describedby` on the activator resolves to the instructions element's id, and that element's text matches the orientation-branched instructions string verbatim (contract §9); the live region's `role="status"`, `aria-live="assertive"`, `aria-atomic="true"`; the `accessibility` prop (FR-020, contract §2/§3, research R-10) merges per key — supplying only `accessibility.announcements.onDragStart` replaces the pick-up announcement while the move/drop/cancel announcements keep their default text, and `accessibility.screenReaderInstructions.draggable` replaces the instructions element's text while leaving its id and `aria-describedby` wiring intact.
- [X] T007 Write the props and data-attribute test suite (contract §3–§7, §10) in `src/lib/components/ui/sortable/sortable.test.ts`: `orientation`'s per-orientation default `modifiers`/`strategy`/`collisionDetection` are observable through behaviour (contract §3 table); explicit `strategy`/`collisionDetection`/`modifiers` overrides on the root and a per-`Content` `strategy` override are invoked instead of the default; two `Sortable.Content` regions rendered inside one root (FR-021-adjacent multi-region composition, spec Edge Cases, MDX "Multiple `SortableContent` components can be used within a `Sortable` component") register against the same identifier space, each region's own `strategy` override applies independently, and a drag stays within its originating region; `flatCursor` sets `data-flat-cursor` on `Item`, `ItemHandle` **and** `Overlay` (FR-017) and swaps each one's cursor classes (the overlay keeps `cursor-grabbing` only when not `flatCursor`); `Content`'s `withoutSlot` (FR-021) renders its children with no wrapping element; `Item`'s `asHandle` and `disabled` and `ItemHandle`'s `disabled` (inheriting the item's, explicit value winning) are reflected in `data-disabled`/`aria-disabled`; `Overlay`'s `container` prop resolves the portal target (an `Element`, a `DocumentFragment`, a selector string, and the `document.body` default); `class` from the caller is merged last via `cn()` on `Content`/`Item`/`ItemHandle`/`Overlay`; `...restProps` spreads onto each part's rendered element; `ref` binds the underlying element on `Content`/`Item`/`ItemHandle`; the `child` snippet on `Content`/`Item`/`ItemHandle` receives the merged props object instead of the default element; the five lifecycle callbacks `onDragStart`/`onDragMove`/`onDragOver`/`onDragEnd`/`onDragCancel` (FR-019, contract §3) each fire with the narrowed `{ active, over }` payload at the documented moment — `onDragStart` on pick-up (pointer and keyboard), `onDragMove` on each move, `onDragOver` only when the `over` target changes, `onDragEnd` before the reorder is committed, and `onDragCancel` on `Escape`, on a drop outside any droppable, and on mid-drag removal of the active item.
- [X] T008 [P] [US1] Write the controlled-vs-uncontrolled test suite (FR-001, spec User Story 1 AS-2) in `src/lib/components/ui/sortable/sortable.test.ts`: `defaultValue` seeds the list once and an uncontrolled drag updates the root's own state; passing `value` + `onValueChange` leaves the parent authoritative — a parent that declines to update `value` in its `onValueChange` handler leaves the rendered order unchanged after a committed drag; `onMove` (FR-005) suppresses the default array splice and `onValueChange` is not called when `onMove` is supplied.
- [X] T009 [US2] Write the keyboard-interaction test suite (contract §8, FR-007, spec User Story 2) in `src/lib/components/ui/sortable/sortable.test.ts`, driven entirely through `@testing-library/user-event`, one case per contract §8 row: `Space` and `Enter` pick up a focused activator and emit the drag-start announcement with `preventDefault()` observed; `ArrowUp`/`ArrowDown` move one position in `vertical` and `mixed`, `ArrowLeft`/`ArrowRight` move one position in `horizontal` and `mixed`; the orthogonal arrow keys are ignored in `vertical` and `horizontal`; `Tab` is swallowed while a drag is active and moves focus between activators when idle; `Space`/`Enter` again drops and commits the reorder; `Escape` cancels with no commit; focus remains on the activator across pick-up, move and drop. Each case asserts both the resulting item order and the live-region text (contract §9), which is how SC-003 is verified for the keyboard path.
- [X] T010 [US2] Write the RTL test suite (FR-015, spec User Story 2 AS-5, SC-006) in `src/lib/components/ui/sortable/sortable.test.ts`: with `dir="rtl"` set via the root's `dir` prop and, separately, via an ambient `DirectionProvider`, `ArrowLeft`/`ArrowRight` invert for `horizontal` and `mixed` orientation (moving toward the visual left/right consistently) while `vertical` orientation's `ArrowUp`/`ArrowDown` behaviour is unaffected by `dir`.
- [X] T011 Write the edge-cases and guard-rails test suite (contract §3/§4/§5/§6/§7 throws, data-model.md §4, spec Edge Cases) in `src/lib/components/ui/sortable/sortable.test.ts`, using `expect(() => render(...)).toThrow(/within/)` per contract: rendering `Content`, `Item`, `ItemHandle`, or `Overlay` outside their required ancestor throws the exact message named in contract §4/§5/§6/§7; `Item` inside neither `Content` nor `Overlay` throws the two-ancestor message (data-model.md §3 Contexts); an `Item` with `value=""` throws `` `SortableItem` value cannot be an empty string `` (FR-014); a root given an object-array `value` with no `getItemValue` throws `` `getItemValue` is required when using array of objects `` (FR-003) while the same array with `getItemValue` supplied does not; a `disabled` item cannot be picked up by pointer or keyboard and is never resolved as a drop target (FR-009); removing the active item from `value` mid-drag cancels the session with no commit (research R-21); an empty list and a single-item list render without error and produce no reorder on interaction.
- [X] T012 [P] [US1] [US3] Write the pointer-drag, touch-drag, drag-handle, dynamic-overlay and primitive-values test suite (plan.md Test plan group F, spec User Story 1 AS-1/AS-3, User Story 3, FR-006) in `src/lib/components/ui/sortable/sortable.test.ts`: implement a `stubRects()` test helper in this file that installs deterministic `getBoundingClientRect` values on a set of elements (per plan.md Technical Context — jsdom performs no layout); a `user-event` pointer drag past a neighbour commits the reorder and shows no residual `data-dragging` on the previously-dragged item after release, and the rendered overlay element carries `data-dragging=""` while that drag is in progress; using fake timers and a `user-event` pointer sequence with `pointerType: 'touch'` (FR-006), a tap or a quick move below the activation constraint does not start a drag, and a press-and-hold past the activation delay followed by a move does; a pointer release outside any droppable commits nothing and announces "Sortable item ... dropped. No changes were made." (contract §9); an `Item` configured `asHandle={false}` with a separate `ItemHandle` only starts a drag from the handle, not the rest of the item body (User Story 3 AS-1); an `Overlay` with `children({ value })` renders a floating preview whose content is driven by the active item's identifier, appears only while dragging, and is removed on drop or cancel (User Story 3 AS-2); a `string[]`/`number[]` list with no `getItemValue` reorders correctly using each item's own value as its identifier (User Story 3 AS-3).

**Checkpoint**: the full test suite exists and fails to compile/run because no implementation module exists yet — expected at this point.

---

## Phase 3: Core component files

**Purpose**: Implement the pure geometry layer, the reusable drag engine, the component's own state/contexts, and the five exported parts from plan.md's Public API section, so the tests written in Phase 2 start passing.

- [X] T013 [P] Implement `src/lib/components/ui/sortable/sortable-geometry.ts` (no runes, no DOM writes — data-model.md §1, contract §2, kanban-reusable): `UniqueIdentifier`, `Coordinates`, `ClientRect`, `SortableOrientation`, `SortableCollision`, `SortableCollisionDetection`, `SortableModifier`, `SortableStrategyArgs`, `SortableStrategy` types; `toClientRect`, `translate3d`, `arrayMove`, `closestCenter`, `closestCorners`, `verticalListSortingStrategy`, `horizontalListSortingStrategy`, `rectSortingStrategy`, `restrictToVerticalAxis`, `restrictToHorizontalAxis`, `restrictToParentElement`, `resolveKeyboardIndex` (data-model.md §1 rules 1–5, RTL mirror first, axis filter, mixed nearest-candidate, list-orientation nearest-index, disabled skip, degenerate-rect fallback), `SORTABLE_ORIENTATIONS`.
- [X] T014 Implement `src/lib/components/ui/sortable/sortable-dnd.svelte.ts` (depends on T013; runes; sensor-agnostic engine, kanban-reusable): `DndNodeEntry`/`DndNodeKind`/`DragActivator`/`DragSource` types; the plain `Map<UniqueIdentifier, DndNodeEntry>` registry (not a `SvelteMap` — research R-19); the `DragSession` class (`activeId`, `source`, `activatorEvent`, `initialIndex`, `initialCoordinates`, `activeRect`, `containerRect`, `rects`, `$state` `delta`/`overId`/`cancelled`, `$derived transform`); the `DndState` class (`session` `$state`, `$derived activeId`/`overId`, `isDragging`, `register`, `getRect`, `startPointerDrag` with the R-03 pointer/touch activation constraints, `startKeyboardDrag`, `move`, `moveToIndex`, `end`, `cancel`, `destroy`). `destroy()` must release every one of the three long-lived resources (document `pointermove`/`pointerup`/`pointercancel`/`keydown` listeners, the touch-activation `setTimeout`, pointer capture) — do not start any of them outside a caller-owned `$effect`/event handler.
- [X] T015 Implement `src/lib/components/ui/sortable/sortable.svelte.ts` (depends on T014; runes; data-model.md §3): `SortableRootStateProps` (all reactive inputs as getter functions), `SortableRootState` (`dnd`, `$derived items`/`count`/`orientation`/`config`/`flatCursor`/`dir`/`activeId`/`overId`/`activeIndex`/`overIndex`/`instructions`/`liveRegionId`/`instructionsId`, `$state overlayCount`/`announcement`, `$derived hasOverlay`, `indexOf`, `getItemTransform` (R-06/R-08: `null` idle, strategy transform for non-active items, `null`-when-overlay-mounted or clamped-delta for the active item), `getOverlayTransform`, `announce`, session verb methods); `SortableItemStateProps`/`SortableItemState` (`value`/`index`/`disabled`/`isDragging`/`transform`/`id` `$derived`, `node` `$state`, `activatorAttrs`, `setActivator`); the four `Symbol`-keyed contexts (`setSortableContext`/`getSortableContext`, `setSortableContentContext`/presence check, `setSortableItemContext`/`getSortableItemContext`, `setSortableOverlayContext`/presence check) each throwing the exact message from data-model.md §3 Contexts table naming both the misused part and the required provider; the `getItemValue` object-array guard (FR-003) evaluated where the raw `value` is in scope, before `SortableRootState` is constructed; the single `$effect` that cancels an open session when `items` no longer contains `activeId` (research R-21), reading only external state so it cannot loop; `SortableAnnouncements`/`SortableAccessibility`/`SortableDragEvent`/`SortableMoveEvent` types and the announcement text builders verbatim from contract §9; `useSortable` convenience export per the barrel contract §1.
- [X] T016 [P] [US1] Implement `src/lib/components/ui/sortable/sortable.svelte` (Root, depends on T015; contract §3): `<script lang="ts" generics="T">`, `SortableRootProps<T>` exported from the module script; props `value` (`$bindable`), `defaultValue`, `onValueChange`, `getItemValue`, `onMove`, `orientation`, `strategy`, `collisionDetection`, `modifiers`, `flatCursor`, `dir`, `id` (`$props.id()` default), `accessibility`, `onDragStart`/`onDragMove`/`onDragOver`/`onDragEnd`/`onDragCancel`, `children`; renders **no** wrapper element — only `{@render children?.()}` followed by the live region (`role="status" aria-live="assertive" aria-atomic="true" data-slot="sortable-live-region"`) and the instructions element (`data-slot="sortable-instructions"`), exactly the markup in contract §3 "Rendered output"; runs the `getItemValue` guard and throws its exact message before constructing `SortableRootState`; calls `setSortableContext`.
- [X] T017 [P] [US1] Implement `src/lib/components/ui/sortable/sortable-content.svelte` (depends on T015; contract §4): `SortableContentProps` — `strategy` (defaults to the root's), `withoutSlot` (`false`), `ref` (`$bindable(null)`), `child` snippet, `children`, `class`, `...restProps`; element `<div data-slot="sortable-content" data-orientation={orientation}>` unless `withoutSlot`, in which case only `children`/`child` render; calls `getSortableContext()` and throws `` `<Sortable.Content>` must be used within `<Sortable>`. `` when absent; calls `setSortableContentContext`.
- [X] T018 [P] [US1] Implement `src/lib/components/ui/sortable/sortable-item.svelte` (depends on T015; contract §5): `SortableItemProps` — `value` (required `UniqueIdentifier`), `asHandle` (`false`), `disabled` (`false`), `ref` (`$bindable(null)`), `child` snippet, `children`, `class`, `style` merged after the transform/transition style, `...restProps`; throws `` `<Sortable.Item>` must be used within `<Sortable.Content>` or `<Sortable.Overlay>`. `` when neither context is present, and `` `SortableItem` value cannot be an empty string `` when `value === ''`; always-present attributes `data-slot="sortable-item"`, `id`, `data-dragging`, `data-disabled`, `data-flat-cursor`, `style` transform/transition; the R-11 activator attribute set plus pointer/keyboard activation listeners when `asHandle && !disabled`; the exact class list from contract §5 "Classes".
- [X] T019 [P] [US3] Implement `src/lib/components/ui/sortable/sortable-item-handle.svelte` (depends on T015; contract §6): `SortableItemHandleProps` — `disabled` (defaults to the item's, explicit value wins), `ref` (`$bindable(null)`), `child` snippet, `children`, `class`, `...restProps`; `<button type="button">` with `data-slot="sortable-item-handle"`, `aria-controls={item.id}`, `data-dragging`, `data-disabled`, `data-flat-cursor`, the native `disabled` attribute, and — when not disabled — the R-11 activation attributes minus `role`; throws `` `<Sortable.ItemHandle>` must be used within `<Sortable.Item>`. `` outside `Item`; the exact class list from contract §6 "Classes".
- [X] T020 [P] [US3] Implement `src/lib/components/ui/sortable/sortable-overlay.svelte` (depends on T015; contract §7): `SortableOverlayProps` — `container` (`document.body` default, also for `null`), `class`, `children` (`Snippet<[{ value: UniqueIdentifier }]>`, covering both the fixed-content and per-item-content upstream forms), `...restProps`; renders only while a drag is active, portaled via `bits-ui` `Portal` (bridging a `DocumentFragment` container the same way `action-bar-portal.svelte` does — research R-09); floating element carries `data-slot="sortable-overlay"`, `data-dragging=""`, `aria-hidden="true"`, `pointer-events-none`, `position: fixed` at the active item's snapshot rect, modifier-clamped `translate3d(...)`; calls `setSortableOverlayContext` so an `Item` can render inside it; throws `` `<Sortable.Overlay>` must be used within `<Sortable>`. `` outside `Sortable`.

**Checkpoint**: all five parts, the engine and the geometry layer exist; Phase 2's tests should now compile and the vast majority should pass.

---

## Phase 4: Barrel and types

- [X] T021 Implement `src/lib/components/ui/sortable/index.ts` (depends on T013–T020) exactly per contract §1: import the five parts; re-export their prop types (`SortableRootProps`/`SortableChildProps`, `SortableContentProps`/`SortableContentChildProps`, `SortableItemProps`/`SortableItemChildProps`, `SortableItemHandleProps`/`SortableItemHandleChildProps`, `SortableOverlayProps`) from each part's `.svelte`; re-export `SortableItemState`, `SortableRootState`, `getSortableContext`, `getSortableItemContext`, `setSortableContext`, `setSortableItemContext`, `useSortable` and the `SortableAnnouncements`/`SortableAccessibility`/`SortableDragEvent`/`SortableItemStateProps`/`SortableMoveEvent`/`SortableOrientation`/`SortableRootStateProps` types from `./sortable.svelte.js`; re-export `DndState`, `DragSession`, `DndNodeEntry`, `DndNodeKind`, `DragActivator`, `DragSource` from `./sortable-dnd.svelte.js`; re-export `SORTABLE_ORIENTATIONS`, `arrayMove`, `closestCenter`, `closestCorners`, `horizontalListSortingStrategy`, `rectSortingStrategy`, `resolveKeyboardIndex`, `restrictToHorizontalAxis`, `restrictToParentElement`, `restrictToVerticalAxis`, `toClientRect`, `translate3d`, `verticalListSortingStrategy` and the `ClientRect`/`Coordinates`/`SortableCollision`/`SortableCollisionDetection`/`SortableModifier`/`SortableStrategy`/`SortableStrategyArgs`/`UniqueIdentifier` types from `./sortable-geometry.js`; export `Root`/`Content`/`Item`/`ItemHandle`/`Overlay` plus the `Sortable`/`SortableContent`/`SortableItem`/`SortableItemHandle`/`SortableOverlay` aliases. Every internal import uses the `.js` extension.

**Checkpoint**: both `import * as Sortable from '.../index.js'` and `import { Sortable, SortableItem } from '.../index.js'` usage styles work; the full Phase 2 test suite should now pass (`pnpm run test:unit -- --run src/lib/components/ui/sortable`).

---

## Phase 5: Demo route

- [X] T022 Implement `src/routes/docs/components/sortable/+page.svelte` (depends on T021; contract §12), with demo state held in the page via runes and no `+page.ts`: a `<ComponentPreview>` "Default" section mirroring `sortable-demo.tsx` (object array + `getItemValue`, `orientation="mixed"`, `Sortable.Item` with a `child` snippet and `asHandle`, a fixed `Sortable.Overlay`); a "With Dynamic Overlay" section mirroring `sortable-dynamic-overlay-demo.tsx` (`{#snippet children({ value })}` on `Overlay` rendering the matching item); a "With Handle" section mirroring `sortable-handle-demo.tsx` (`Content` with `child` onto `Table.Body`, `Item` with `child` onto `Table.Row`, `ItemHandle` with `child` onto `Button` + `GripVerticalIcon` from `@lucide/svelte`, default `vertical` orientation); a "With Primitive Values" section mirroring `sortable-primitive-values-demo.tsx` (`string[]` with no `getItemValue`, `Item` rendered inside the `Overlay` snippet); an "Orientation" section (SC-005) switching one list between `vertical`/`horizontal`/`mixed` from a single control; an "RTL" section (SC-006/FR-015) wrapping a horizontal list in `DirectionProvider dir="rtl"`; five props tables (`Sortable`, `Content`, `Item`, `ItemHandle`, `Overlay`), each row `{ prop, type, default, description }`, rendered with `$lib/components/ui/table`.

**Checkpoint**: `/docs/components/sortable` renders all six sections; this is verified by a green `pnpm run build` in Phase 7 (the pipeline never starts a dev server).

---

## Phase 6: Registry entry and docs polish

- [X] T023 Replace the `files: []` stub in the `sortable` entry of `registry.json` (added in T003) with the nine files from contract §11, in order: `src/lib/components/ui/sortable/index.ts`, `sortable-geometry.ts`, `sortable-dnd.svelte.ts`, `sortable.svelte.ts`, `sortable.svelte`, `sortable-content.svelte`, `sortable-item.svelte`, `sortable-item-handle.svelte`, `sortable-overlay.svelte`, each `{ "path": "...", "type": "registry:ui" }`. Do not list `sortable.test.ts` or `sortable.test.svelte`.
- [X] T024 Run `pnpm run registry:build` and confirm `static/r/sortable.json` is written with the nine files from T023, `$lib/...` imports rewritten to registry placeholders, and no reference to either test file; confirm via `node -e "const r=require('./registry.json');const i=r.items.find(x=>x.name==='sortable');if(!i)throw new Error('missing');console.log(i.type,i.files.length)"` printing `registry:ui 9` (quickstart.md §3).

**Checkpoint**: the component is installable through the registry exactly like every other first-party component (SC-007, FR-018).

---

## Phase 7: Verification (MANDATORY — Principle VII)

**Purpose**: The feature is not complete until every gate is green. No suppressions (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, deleted assertions, loosened configs) may be used to reach green — fix the root cause.

- [X] T025 Run `pnpm run format` across the whole repository (shadcn/generator-style output is not Prettier-formatted) and leave the reformatted files in the working tree — the orchestrator owns git; do not run any git write command.
- [X] T026 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, and fix everything that fails.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Tests (Phase 2)**: Depends on Setup (the folders from T002 must exist); T004's harness and T005's geometry suite need nothing from later phases and are written first; T006–T012 all extend the same `sortable.test.ts` file and so run sequentially against each other even though several are tagged `[P]` relative to non-file-conflicting work elsewhere.
- **Core component files (Phase 3)**: Depends on Tests existing (T005–T012 define the contract the implementation must satisfy) — T013 → T014 → T015 is a strict chain (geometry, then engine, then component state); T016–T020 (the five parts) all depend only on T015 and are mutually parallel.
- **Barrel and types (Phase 4)**: Depends on all of Phase 3 (T013–T020).
- **Demo route (Phase 5)**: Depends on Phase 4 (T021) — the demo imports only through the barrel.
- **Registry entry and docs polish (Phase 6)**: Depends on Phase 4 and Phase 5 (T021, T022) — the file list must match what actually exists.
- **Verification (Phase 7)**: Depends on everything above; always the last phase.

### User Story Coverage

- **US1 (pointer drag, P1)**: T008, T012 (tests) + T016, T017, T018 (Root/Content/Item implementation). Independently testable once T004–T008, T012, T013–T018, T021 are done.
- **US2 (keyboard, P1)**: T009, T010 (tests) — served by the same T013–T018 implementation (the keyboard sensor lives in the shared engine/state, not a separate part). Independently testable once T004, T005, T009, T010, T013–T018, T021 are done.
- **US3 (handle, overlay, primitive values, P2)**: T012 (tests, shared with US1) + T019, T020 (ItemHandle/Overlay implementation). Independently testable once T004, T012, T013–T021 are done.

### Parallel Opportunities

- T002 and T003 (Setup) run in parallel.
- T004 (test harness file) runs in parallel with the start of T005 (different files); T006–T012 then proceed sequentially within `sortable.test.ts`.
- T013 (geometry) has no dependency and can start as soon as Phase 2 is underway, but per the "Tests" gate should not be *implemented to pass* until the tests exist — write T013 after T005 lands so the geometry tests are the acceptance target.
- T016, T017, T018, T019, T020 (the five parts) are all `[P]` once T015 is done.

---

## Parallel Example: Phase 3 parts

```bash
# Once T015 (sortable.svelte.ts) is complete, launch all five parts together:
Task: "Implement sortable.svelte (Root) in src/lib/components/ui/sortable/sortable.svelte"
Task: "Implement sortable-content.svelte in src/lib/components/ui/sortable/sortable-content.svelte"
Task: "Implement sortable-item.svelte in src/lib/components/ui/sortable/sortable-item.svelte"
Task: "Implement sortable-item-handle.svelte in src/lib/components/ui/sortable/sortable-item-handle.svelte"
Task: "Implement sortable-overlay.svelte in src/lib/components/ui/sortable/sortable-overlay.svelte"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2 — both P1)

1. Complete Phase 1: Setup.
2. Complete Phase 2 tests T004–T011 (T012 can trail slightly since it also covers US3, but write it before implementing T019/T020).
3. Complete Phase 3 T013–T018 (geometry, engine, state, Root/Content/Item — no handle or overlay yet).
4. Complete Phase 4 (T021, barrel — omit `ItemHandle`/`Overlay` exports only if truly staging incrementally; in practice all five parts ship together since the barrel contract lists all five).
5. **STOP and VALIDATE**: pointer and keyboard reordering both work end-to-end against the Default composition without a handle or overlay.

### Incremental Delivery

1. Setup + Tests (T001–T012) → full acceptance contract captured as failing tests.
2. Core component files (T013–T020) → tests go green story by story (US1/US2 first via T016–T018, then US3 via T019–T020).
3. Barrel (T021) → both import styles work; full suite green.
4. Demo route (T022) → all four upstream compositions plus Orientation and RTL sections visible.
5. Registry (T023–T024) → installable exactly like every other component.
6. Verification (T025–T026) → green gate, feature done.

---

## Notes

- `[P]` tasks touch different files and have no incomplete-task dependency; tasks touching `sortable.test.ts` are never `[P]` with each other.
- `[US1]`/`[US2]`/`[US3]` labels map each task to its user story for traceability even though phases are organized by layer, not by story, per this port's component-specific instructions (the shared drag engine underlies every story and cannot be split per-story without breaking the dependency order).
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X).
- `sortable-geometry.ts` and `sortable-dnd.svelte.ts` (T013, T014) are written to be imported unchanged by the upcoming `kanban` port (research R-02) — do not add `sortable`-specific knowledge (item values, orientation, announcements) into either file.

---

## Phase 8: Convergence

**Purpose**: Close the gaps found by auditing the implemented port against spec.md, plan.md, tasks.md and contracts/sortable-api.md. Both items are unasserted behaviour, not unimplemented behaviour — the code paths exist and are correct, so these tasks add assertions to `src/lib/components/ui/sortable/sortable.test.ts` and must not change any implementation file. No suppression may be used to reach green (Principle VII).

- [X] T027 Assert the drag lifecycle callbacks for a **pointer-driven** drag in `src/lib/components/ui/sortable/sortable.test.ts` per FR-019 (partial): every existing lifecycle assertion (the "fires the five lifecycle callbacks at the documented moments" and "fires onDragCancel on escape" cases) is driven through the keyboard-only `grab()` helper, so the pointer half of FR-019's "They MUST fire for pointer-driven and keyboard-driven drags alike" and of T007's "`onDragStart` on pick-up (pointer and keyboard)" is unasserted. Add a case that uses `stubVerticalLayout()` plus the existing `press`/`movePointer`/`release` helpers to drag an item past a neighbour and asserts `onDragStart` fires once on activation with the narrowed `{ active, over }` payload, `onDragMove` fires on the move frames, `onDragOver` fires only when the `over` target changes, and `onDragEnd` fires with the final `over` before `onValueChange` (compare `mock.invocationCallOrder`, as the keyboard case already does).
- [X] T028 Assert `onDragCancel` on a drop outside any droppable in `src/lib/components/ui/sortable/sortable.test.ts` per FR-019 (missing): FR-019 requires drag-cancel to fire "on a drop outside any droppable" and `sortable.svelte.ts` routes that case to `onDragCancel` while keeping upstream's "dropped. No changes were made." announcement, but the existing "commits nothing when released outside every droppable" case asserts only `onValueChange` and the live-region text. Extend that case (or add one beside it) to pass an `onDragCancel` spy and assert it is called once with `{ active: { id: 'a' }, over: null }`, and that `onDragEnd` is **not** called for that release.

**Checkpoint**: run `pnpm run format`, then `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build` again — all five must stay green.
