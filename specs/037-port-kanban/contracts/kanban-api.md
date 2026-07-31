# Contract: Kanban public API

**Feature**: `specs/037-port-kanban` | **Date**: 2026-07-31

The exhaustive, testable surface. Derived from
`.reference/diceui/docs/registry/bases/radix/ui/kanban.tsx` and
`.reference/diceui/docs/content/docs/components/radix/kanban.mdx` at the pinned commit. Line
references are to `kanban.tsx`.

Import styles, both supported:

```ts
import * as Kanban from '$lib/components/ui/kanban/index.js'; // Kanban.Root, Kanban.Column, …
import { Kanban, KanbanBoard, KanbanColumn } from '$lib/components/ui/kanban/index.js';
```

---

## 1. Parts

| This port             | Barrel short name | Upstream           | Element                    |
| --------------------- | ----------------- | ------------------ | -------------------------- |
| `kanban.svelte`       | `Root` / `Kanban` | `Kanban` (204)     | none (+ 2 `sr-only` nodes) |
| `kanban-board.svelte` | `Board`           | `KanbanBoard` (649)| `<div>`                    |
| `kanban-column.svelte`| `Column`          | `KanbanColumn` (720)| `<div>`                   |
| `kanban-column-handle.svelte` | `ColumnHandle` | `KanbanColumnHandle` (835) | `<button type="button">` |
| `kanban-item.svelte`  | `Item`            | `KanbanItem` (901) | `<div>`                    |
| `kanban-item-handle.svelte` | `ItemHandle`| `KanbanItemHandle` (996) | `<button type="button">` |
| `kanban-overlay.svelte`| `Overlay`        | `KanbanOverlay` (1057) | portalled `<div>`      |

---

## 2. `Kanban` (Root)

`<script lang="ts" generics="T">`. Renders **no element of its own** — upstream's `DndContext`
renders only its children plus dnd-kit's accessibility nodes.

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
| `onDragStart` | `(event: KanbanDragEvent) => void` | — | no |
| `onDragMove` | `(event: KanbanDragEvent) => void` | — | no |
| `onDragOver` | `(event: KanbanDragEvent) => void` | — | no |
| `onDragEnd` | `(event: KanbanDragEvent) => void` | — | no |
| `onDragCancel` | `(event: KanbanDragEvent) => void` | — | no |
| `children` | `Snippet` | — | no |

Snippets: `children`. Callbacks: the five drag hooks plus `onValueChange` / `onMove`.

- `strategy` is stored on the context and read by nothing — **upstream does the same**
  (set at 199/591, never consumed; `Board` and `Column` derive their strategy from `orientation`).
  Kept for API parity (R-08).
- Throws `` `getItemValue` is required when using array of objects `` on the first object item seen
  without `getItemValue` (230-242).
- Renders `<div role="status" aria-live="assertive" aria-atomic="true" data-slot="kanban-live-region" class="sr-only">`
  and `<div data-slot="kanban-instructions" class="sr-only">`.

---

## 3. `Kanban.Board`

| Prop | Type | Default | Bindable |
| ---- | ---- | ------- | -------- |
| `ref` | `HTMLDivElement \| null` | `null` | **yes** |
| `class` | `string` | — | no |
| `child` | `Snippet<[{ props: KanbanBoardChildProps }]>` | — | no |
| `children` | `Snippet` | — | no |
| `...restProps` | `HTMLAttributes<HTMLDivElement>` | — | — |

Element: `<div data-slot="kanban-board" data-orientation aria-orientation>` with
`cn('flex size-full gap-4', orientation === 'horizontal' ? 'flex-row' : 'flex-col', className)`
(670-681). Throws `` `<Kanban.Board>` must be used within `<Kanban>`. ``

---

## 4. `Kanban.Column`

| Prop | Type | Default | Bindable |
| ---- | ---- | ------- | -------- |
| `value` | `UniqueIdentifier` | — (required) | no |
| `asHandle` | `boolean` | `false` | no |
| `disabled` | `boolean` | `false` | no |
| `ref` | `HTMLDivElement \| null` | `null` | **yes** |
| `class` | `string` | — | no |
| `style` | `string` | — | no |
| `child` | `Snippet<[{ props: KanbanColumnChildProps }]>` | — | no |
| `children` | `Snippet` | — | no |
| `...restProps` | `HTMLAttributes<HTMLDivElement>` | — | — |

Element: `<div id={$props.id()} data-slot="kanban-column" data-value data-disabled data-dragging data-flat-cursor>`.
Classes (813-824, with R-14's `bg-zinc-*` → `bg-muted` mapping):
`flex size-full flex-col gap-2 rounded-lg border bg-muted p-2.5`, plus
`touch-none select-none` when `asHandle`, `cursor-default` when `flatCursor`,
`data-dragging:cursor-grabbing` otherwise, `cursor-grab` when idle + `asHandle` + not `flatCursor`,
`opacity-50` while dragging, `pointer-events-none opacity-50` when disabled, `className` last.

Throws `` `<Kanban.Column>` must be used within `<Kanban.Board>` or `<Kanban.Overlay>`. `` and
`` `<Kanban.Column>` value cannot be an empty string ``.

When `asHandle` and not disabled, the element additionally carries the §7 activator attributes and
the pointer/keyboard activators.

---

## 5. `Kanban.ColumnHandle`

| Prop | Type | Default | Bindable |
| ---- | ---- | ------- | -------- |
| `disabled` | `boolean` | the column's `disabled` | no |
| `ref` | `HTMLButtonElement \| null` | `null` | **yes** |
| `class` | `string` | — | no |
| `child` | `Snippet<[{ props: KanbanColumnHandleChildProps }]>` | — | no |
| `children` | `Snippet` | — | no |
| `...restProps` | `HTMLButtonAttributes` | — | — |

Element: `<button type="button" aria-controls={column.id} disabled data-slot="kanban-column-handle" data-disabled data-dragging data-flat-cursor>`
with `cn('select-none disabled:pointer-events-none disabled:opacity-50', flatCursor ? 'cursor-default' : 'cursor-grab data-dragging:cursor-grabbing', className)`
(861-868). Throws `` `<Kanban.ColumnHandle>` must be used within `<Kanban.Column>`. ``

---

## 6. `Kanban.Item` / `Kanban.ItemHandle`

Identical prop tables to §4 / §5 with `data-slot="kanban-item"` / `"kanban-item-handle"`,
`aria-controls={item.id}`, and the item's class list (975-986):
`focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1`
plus the same `asHandle`/`flatCursor`/`isDragging`/`disabled` branches.

Throws `` `<Kanban.Item>` must be used within `<Kanban.Board>` or `<Kanban.Overlay>`. ``,
`` `<Kanban.Item>` value cannot be an empty string ``, and
`` `<Kanban.ItemHandle>` must be used within `<Kanban.Item>`. ``

---

## 7. Activator attributes (R-11)

Applied to the handle, or to the column/item itself under `asHandle`:

| Attribute | Value |
| --------- | ----- |
| `role` | `"button"` — only when the activator is a `<div>` |
| `tabindex` | `0`, or absent when disabled |
| `aria-roledescription` | `"draggable"` (dnd-kit's default; upstream never overrides it) |
| `aria-describedby` | the root's instructions element id |
| `aria-disabled` | `"true"` when disabled, else absent |
| `aria-pressed` | `"true"` while this element's column/item is being dragged, else absent |
| `aria-controls` | on handles only → the column's / item's `id` |

---

## 8. `Kanban.Overlay`

| Prop | Type | Default | Bindable |
| ---- | ---- | ------- | -------- |
| `container` | `Element \| DocumentFragment \| string \| null` | `document.body` | no |
| `class` | `string` | — | no |
| `children` | `Snippet<[{ value: UniqueIdentifier; variant: 'column' \| 'item' }]>` | — | no |
| `...restProps` | `Omit<HTMLAttributes<HTMLDivElement>, 'children'>` | — | — |

Renders nothing while `activeId === null`. Otherwise portals
`<div data-slot="kanban-overlay" data-dragging data-variant data-flat-cursor aria-hidden="true" class={cn('pointer-events-none', !flatCursor && 'cursor-grabbing', className)}>`
positioned over the active element's pick-up rect and translated by the session transform.
`variant` is `'column'` when the active id is a key of `value`, else `'item'` (1071-1072).
Publishes the overlay context so a `<Kanban.Column>` / `<Kanban.Item>` inside it is an inert preview.
Throws `` `<Kanban.Overlay>` must be used within `<Kanban>`. ``

---

## 9. Keyboard contract (MDX `KeyboardShortcutsTable` + `coordinateGetter`)

| Key | Behaviour |
| --- | --------- |
| `Enter` / `Space` on an activator | Picks the column/item up. Announces pick-up. |
| `Enter` / `Space` while dragging | Drops at the current target and commits. |
| `ArrowUp` | Moves the drop target to the nearest candidate whose `rect.top` is above the dragged rect's top. |
| `ArrowDown` | …whose `rect.top` is below the dragged rect's top. |
| `ArrowLeft` | …that lies entirely to the left (`collisionRect.left >= rect.left + rect.width`). |
| `ArrowRight` | …that lies entirely to the right (`collisionRect.left + collisionRect.width <= rect.left`). |
| `Escape` | Cancels; announces the cancellation; republishes the board as it stood at pick-up when `onDragOver` already committed something (FR-005). |
| `Tab` while dragging | Swallowed — focus may not leave a grabbed element. |

Candidate rules (R-06): while an **item** is dragged, candidates are all enabled items plus **empty**
columns; while a **column** is dragged, candidates are the other enabled columns. Direction is
absolute (screen), independent of `orientation` (FR-006). Under `dir="rtl"`, `ArrowLeft` and
`ArrowRight` swap (FR-014).

---

## 10. Announcements (verbatim, 479-583)

| Moment | Text |
| ------ | ---- |
| pick-up | `Picked up item at position 2 of 3` / `Picked up column at position 1 of 3` |
| target change, same column | `item is now at position 3 of 3` |
| target change, new column | `item is now at position 1 of 2 in done` |
| target change, column drag | `column is now at position 2 of 3` |
| drop | `item was dropped at position 1 of 2 in done` / `item was dropped at position 3 of 3` |
| cancel | `Dragging was cancelled. item was dropped.` |

Positions are 1-based and computed against the **current** `value` (i.e. after the cross-column move
`onDragOver` already committed). Instructions text (629-633, whitespace collapsed):

> To pick up a kanban item or column, press space or enter. While dragging, use the arrow keys to
> move the item. Press space or enter again to drop the item in its new position, or press escape to
> cancel.

Each builder is individually overridable via `accessibility.announcements`; the instruction text via
`accessibility.screenReaderInstructions.draggable`.

---

## 11. Data attributes (MDX `DataAttributesTable` + this port's additions)

| Part | Attributes |
| ---- | ---------- |
| Board | `data-slot="kanban-board"`, `data-orientation`, `aria-orientation` |
| Column | `data-slot="kanban-column"`, `data-value`, `data-disabled`, `data-dragging`, `data-flat-cursor` |
| ColumnHandle | `data-slot="kanban-column-handle"`, `data-disabled`, `data-dragging`, `data-flat-cursor` |
| Item | `data-slot="kanban-item"`, `data-value`, `data-disabled`, `data-dragging`, `data-flat-cursor` |
| ItemHandle | `data-slot="kanban-item-handle"`, `data-disabled`, `data-dragging`, `data-flat-cursor` |
| Overlay | `data-slot="kanban-overlay"`, `data-variant`, `data-dragging`, `data-flat-cursor` |
| Root | `data-slot="kanban-live-region"`, `data-slot="kanban-instructions"` |

MDX documents `data-disabled` and `data-dragging` on the four inner parts; `data-value`,
`data-flat-cursor`, `data-variant` and every `data-slot` are this port's additions (constitution
VIII). All booleans are written `cond ? '' : undefined`.

---

## 12. Commit semantics (FR-001/002/003/004/013, R-07)

| Situation | Committed in | Result | Routed to |
| --------- | ------------ | ------ | --------- |
| item over another item, same column | `onDragOver` | `arrayMove(items, activeIndex, overIndex)` | `onValueChange` |
| item over an item/column in another column | `onDragOver` | removed from source, **appended** to destination | `onValueChange` |
| item dropped, same column | `onDragEnd` | already applied by `onDragOver` | `onMove` (reporting the net move) |
| column dropped on another column | `onDragEnd` | `arrayMove(Object.keys(value))`, record rebuilt in the new key order | `onMove ?? onValueChange` |
| dropped with `over === null` | — | nothing | nothing |
| `Escape` / pointer cancel | — | the pick-up snapshot, when `onDragOver` committed something | `onValueChange` |

The first row is unconditional: supplying `onMove` never suppresses the mid-drag reflow, so by the
drop the same-column `arrayMove` has already happened and `onMove` reports
`{ activeIndex, overIndex }` — the index the item was picked up at and the one it ended on — instead
of intercepting a splice that is no longer pending. `onMove` still fully intercepts the column
reorder, which is only ever committed on drop. Both are recorded in research R-18.

---

## 13. Barrel (`index.ts`)

Component exports — short names and prefixed aliases:
`Root/Kanban`, `Board/KanbanBoard`, `Column/KanbanColumn`, `ColumnHandle/KanbanColumnHandle`,
`Item/KanbanItem`, `ItemHandle/KanbanItemHandle`, `Overlay/KanbanOverlay`.

Prop and child-props types: `KanbanRootProps`, `KanbanProps` (alias), `KanbanBoardProps`,
`KanbanBoardChildProps`, `KanbanColumnProps`, `KanbanColumnChildProps`, `KanbanColumnHandleProps`,
`KanbanColumnHandleChildProps`, `KanbanItemProps`, `KanbanItemChildProps`, `KanbanItemHandleProps`,
`KanbanItemHandleChildProps`, `KanbanOverlayProps`.

State and helpers: `KanbanRootState`, `KanbanColumnState`, `KanbanItemState`, `KanbanDndState`,
`getKanbanContext`, `setKanbanContext`, `getKanbanColumnContext`, `getKanbanItemContext`,
`useKanbanItem`, `DEFAULT_KANBAN_ANNOUNCEMENTS`, and the types `KanbanValue`, `KanbanDragEvent`,
`KanbanMoveEvent`, `KanbanAccessibility`, `KanbanAnnouncements`, `KanbanAnnouncementArgs`,
`KanbanOrientation`, `KanbanOverlayVariant`.

Reusable pure module (R-19), re-exported from the barrel: `pointerWithin`, `rectIntersection`,
`getFirstCollision`, `closestCenterAmong`, `filterByDirection`, `resolveKanbanArrowTarget`,
`type KanbanArrowKey`, `type KanbanDroppable`.

---

## 14. `registry.json` entry

```jsonc
{
	"name": "kanban",
	"type": "registry:ui",
	"title": "Kanban",
	"description": "A drag and drop kanban board component for organizing items into columns.",
	"registryDependencies": ["sortable", "direction-provider"],
	"dependencies": ["bits-ui"],
	"files": [
		{ "path": "src/lib/components/ui/kanban/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/kanban/kanban-collision.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/kanban/kanban-dnd.svelte.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/kanban/kanban.svelte.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/kanban/kanban.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/kanban/kanban-board.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/kanban/kanban-column.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/kanban/kanban-column-handle.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/kanban/kanban-item.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/kanban/kanban-item-handle.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/kanban/kanban-overlay.svelte", "type": "registry:ui" }
	]
}
```

The two test files are **not** listed. `pnpm run registry:build` is run afterwards.

---

## 15. Demo route

`src/routes/docs/components/kanban/+page.svelte`, one `<ComponentPreview>` per upstream example:

| Section | Mirrors | Proves |
| ------- | ------- | ------ |
| Default | `kanban-demo.tsx` | US1-4, `getItemValue`, `asHandle`, `ColumnHandle` on `Button` via `child`, fixed overlay |
| Dynamic Overlay | `kanban-dynamic-overlay-demo.tsx` | US5 — `children({ value, variant })` rendering a whole column preview for a column drag and a card for an item drag |

Plus an API Reference block: seven props tables, a data-attributes table and a keyboard table (the
pattern `src/routes/docs/components/sortable/+page.svelte` already uses). Demo state lives in the page
with runes; no `+page.ts`.
