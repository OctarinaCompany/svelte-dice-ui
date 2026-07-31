# Contract: `sortable` public API

**Feature**: `036-port-sortable` | **Phase**: 1 | **Source of truth**:
`.reference/diceui/docs/registry/bases/radix/ui/sortable.tsx` (577 lines) +
`.reference/diceui/docs/content/docs/components/radix/sortable.mdx` @
`d9763d82530416dfa4c81c462387b55d06bae4ec`.

This file is the acceptance contract for the port. Anything listed here must exist, with this name,
this type, this default and this behaviour.

---

## 1. Barrel — `src/lib/components/ui/sortable/index.ts`

```ts
import Root from './sortable.svelte';
import Content from './sortable-content.svelte';
import Item from './sortable-item.svelte';
import ItemHandle from './sortable-item-handle.svelte';
import Overlay from './sortable-overlay.svelte';

export type { SortableChildProps, SortableProps, SortableRootProps } from './sortable.svelte';
export type { SortableContentChildProps, SortableContentProps } from './sortable-content.svelte';
export type { SortableItemChildProps, SortableItemProps } from './sortable-item.svelte';
export type {
	SortableItemHandleChildProps,
	SortableItemHandleProps
} from './sortable-item-handle.svelte';
export type { SortableOverlayProps } from './sortable-overlay.svelte';

export {
	SortableItemState,
	SortableRootState,
	getSortableContext,
	getSortableItemContext,
	setSortableContext,
	setSortableItemContext,
	useSortable,
	type SortableAnnouncements,
	type SortableAccessibility,
	type SortableDragEvent,
	type SortableItemStateProps,
	type SortableMoveEvent,
	type SortableOrientation,
	type SortableRootStateProps
} from './sortable.svelte.js';

export {
	DndState,
	DragSession,
	type DndNodeEntry,
	type DndNodeKind,
	type DragActivator,
	type DragSource
} from './sortable-dnd.svelte.js';

export {
	SORTABLE_ORIENTATIONS,
	arrayMove,
	closestCenter,
	closestCorners,
	horizontalListSortingStrategy,
	rectSortingStrategy,
	resolveKeyboardIndex,
	restrictToHorizontalAxis,
	restrictToParentElement,
	restrictToVerticalAxis,
	toClientRect,
	translate3d,
	verticalListSortingStrategy,
	type ClientRect,
	type Coordinates,
	type SortableCollision,
	type SortableCollisionDetection,
	type SortableModifier,
	type SortableStrategy,
	type SortableStrategyArgs,
	type UniqueIdentifier
} from './sortable-geometry.js';

export {
	Root,
	Content,
	Item,
	ItemHandle,
	Overlay,
	//
	Root as Sortable,
	Content as SortableContent,
	Item as SortableItem,
	ItemHandle as SortableItemHandle,
	Overlay as SortableOverlay
};
```

Both usage styles must work:

```ts
import * as Sortable from '$lib/components/ui/sortable/index.js'; // Sortable.Root, Sortable.Item
import { Sortable, SortableItem } from '$lib/components/ui/sortable/index.js';
```

---

## 2. Shared types

```ts
/** dnd-kit's `UniqueIdentifier`. */
type UniqueIdentifier = string | number;

type Coordinates = { x: number; y: number };

type ClientRect = {
	top: number;
	left: number;
	right: number;
	bottom: number;
	width: number;
	height: number;
};

type SortableOrientation = 'vertical' | 'horizontal' | 'mixed';

type SortableCollision = { id: UniqueIdentifier; distance: number };

type SortableCollisionDetection = (args: {
	collisionRect: ClientRect;
	droppables: { id: UniqueIdentifier; rect: ClientRect }[];
}) => SortableCollision[];

type SortableModifier = (args: {
	transform: Coordinates;
	activeRect: ClientRect | null;
	containerRect: ClientRect | null;
}) => Coordinates;

type SortableStrategyArgs = {
	index: number;
	activeIndex: number;
	overIndex: number;
	rects: ClientRect[];
	activeRect: ClientRect | null;
};

type SortableStrategy = (args: SortableStrategyArgs) => Coordinates | null;

/** Narrowed `DragStartEvent` / `DragEndEvent` (research R-15). */
type SortableDragEvent = {
	active: { id: UniqueIdentifier };
	over: { id: UniqueIdentifier } | null;
};

type SortableMoveEvent = SortableDragEvent & { activeIndex: number; overIndex: number };

type SortableAnnouncements = {
	onDragStart: (event: { active: { id: UniqueIdentifier }; activeIndex: number; count: number }) => string;
	onDragMove: (event: SortableAnnouncementArgs) => string;
	onDragOver: (event: SortableAnnouncementArgs) => string;
	onDragEnd: (event: SortableAnnouncementArgs) => string;
	onDragCancel: (event: { active: { id: UniqueIdentifier }; activeIndex: number; count: number }) => string;
};

type SortableAccessibility = {
	announcements?: Partial<SortableAnnouncements>;
	screenReaderInstructions?: { draggable: string };
};
```

---

## 3. `Sortable` (Root) — `sortable.svelte`

`<script lang="ts" generics="T">`; the props type is `SortableRootProps<T>`, declared and exported
from the module script (repo precedent: `badge-overflow.svelte`).

**Renders no wrapper element** — upstream's `DndContext` renders only its children plus its
accessibility nodes, so the root renders `{@render children?.()}` followed by the live region and the
instructions element. It therefore has **no** `ref`, **no** `class` and **no** `child` prop.

| Prop                  | Type                                                     | Default        | Bindable | Notes |
| --------------------- | -------------------------------------------------------- | -------------- | -------- | ----- |
| `value`               | `T[]`                                                    | `undefined`    | **yes**  | Controlled list. Upstream required; optional here so `defaultValue` can seed it (R-14). |
| `defaultValue`        | `T[]`                                                    | `[]`           | no       | **Added** — uncontrolled seed, read once through `untrack`. |
| `onValueChange`       | `(items: T[]) => void`                                   | `undefined`    | no       | Fires with the spliced array on every committed reorder, in both modes. Not called when `onMove` is supplied. |
| `getItemValue`        | `(item: T) => UniqueIdentifier`                          | `undefined`    | no       | Required at runtime for object arrays (FR-003). For primitives the item is its own id. |
| `onMove`              | `(event: SortableMoveEvent) => void`                     | `undefined`    | no       | Intercepts the reorder; suppresses the default splice **and** `onValueChange` (FR-005). |
| `orientation`         | `SortableOrientation`                                    | `'vertical'`   | no       | Selects the default modifiers, strategy and collision detection. |
| `strategy`            | `SortableStrategy`                                       | per-orientation| no       | Overrides the sorting transform strategy. |
| `collisionDetection`  | `SortableCollisionDetection`                             | per-orientation| no       | Overrides collision detection (FR-004). |
| `modifiers`           | `SortableModifier[]`                                     | per-orientation| no       | Replaces the default modifier list wholesale. |
| `flatCursor`          | `boolean`                                                | `false`        | no       | Neutral cursor instead of grab/grabbing (FR-017). |
| `dir`                 | `'ltr' \| 'rtl'`                                         | inherited      | no       | **Added** — RTL (FR-015). Falls back to `DirectionProvider` → DOM `dir` → `ltr`. |
| `id`                  | `string`                                                 | `$props.id()`  | no       | Base id for the live region and instructions element. |
| `accessibility`       | `SortableAccessibility`                                  | `undefined`    | no       | Per-key override of the announcements and instructions. |
| `onDragStart`         | `(event: SortableDragEvent) => void`                     | `undefined`    | no       | Lifecycle passthrough. |
| `onDragMove`          | `(event: SortableDragEvent) => void`                     | `undefined`    | no       | Fires on every move frame. |
| `onDragOver`          | `(event: SortableDragEvent) => void`                     | `undefined`    | no       | Fires when the `over` target changes. |
| `onDragEnd`           | `(event: SortableDragEvent) => void`                     | `undefined`    | no       | Fires before the reorder is committed. |
| `onDragCancel`        | `(event: SortableDragEvent) => void`                     | `undefined`    | no       | Fires on `Escape`, on drop outside a droppable, and on mid-drag removal of the active item. |
| `children`            | `Snippet`                                                | —              | no       | Composition root. |

Defaults per orientation (upstream `orientationConfig`, sortable.tsx:45-61):

| `orientation` | `modifiers`                                           | `strategy`                      | `collisionDetection` |
| ------------- | ----------------------------------------------------- | ------------------------------- | -------------------- |
| `vertical`    | `[restrictToVerticalAxis, restrictToParentElement]`    | `verticalListSortingStrategy`   | `closestCenter`      |
| `horizontal`  | `[restrictToHorizontalAxis, restrictToParentElement]`  | `horizontalListSortingStrategy` | `closestCenter`      |
| `mixed`       | `[restrictToParentElement]`                            | `rectSortingStrategy`           | `closestCorners`     |

**Rendered output** (nothing else):

```svelte
{@render children?.()}
<div id="{uid}-live" role="status" aria-live="assertive" aria-atomic="true"
     data-slot="sortable-live-region" class="sr-only">{announcement}</div>
<div id="{uid}-instructions" data-slot="sortable-instructions" class="sr-only">{instructions}</div>
```

**Throws**: `` `getItemValue` is required when using array of objects `` — at first render when
`value[0]` is a non-null object and `getItemValue` was not supplied (upstream sortable.tsx:143-147).

---

## 4. `Sortable.Content` — `sortable-content.svelte`

| Prop           | Type                                          | Default     | Bindable | Notes |
| -------------- | --------------------------------------------- | ----------- | -------- | ----- |
| `strategy`     | `SortableStrategy`                            | root's      | no       | Per-region strategy override (upstream `strategyProp ?? context.strategy`). |
| `withoutSlot`  | `boolean`                                     | `false`     | no       | Renders children with **no** element at all. |
| `ref`          | `HTMLDivElement \| null`                      | `null`      | **yes**  | |
| `child`        | `Snippet<[{ props: SortableContentChildProps }]>` | `undefined` | no   | Replaces upstream `asChild`. |
| `children`     | `Snippet`                                     | —           | no       | |
| `class`        | `string`                                      | `undefined` | no       | Merged last through `cn()`. |
| `...restProps` | `HTMLAttributes<HTMLDivElement>`              | —           | no       | Spread onto the element. |

Element: `<div data-slot="sortable-content" data-orientation={orientation}>`.

**Throws**: `` `<Sortable.Content>` must be used within `<Sortable>`. ``

---

## 5. `Sortable.Item` — `sortable-item.svelte`

| Prop           | Type                                       | Default     | Bindable | Notes |
| -------------- | ------------------------------------------ | ----------- | -------- | ----- |
| `value`        | `UniqueIdentifier`                         | — (required)| no       | The item's identifier; must match one produced by `getItemValue`. |
| `asHandle`     | `boolean`                                  | `false`     | no       | The item itself is the drag activator. |
| `disabled`     | `boolean`                                  | `false`     | no       | Not draggable and not droppable (FR-009). |
| `ref`          | `HTMLDivElement \| null`                   | `null`      | **yes**  | |
| `child`        | `Snippet<[{ props: SortableItemChildProps }]>` | `undefined` | no   | Replaces upstream `asChild`. |
| `children`     | `Snippet`                                  | —           | no       | |
| `class`        | `string`                                   | `undefined` | no       | Merged last. |
| `style`        | `string`                                   | `undefined` | no       | Merged **after** the component's `transform`/`transition` (upstream `...style` spread order). |
| `...restProps` | `HTMLAttributes<HTMLDivElement>`           | —           | no       | |

**Attributes always present**

| Attribute                | Value                                                        |
| ------------------------ | ------------------------------------------------------------ |
| `data-slot`              | `"sortable-item"`                                            |
| `id`                     | the item's `$props.id()` — the handle's `aria-controls` target |
| `data-dragging`          | `''` while this item is the active drag source, else absent  |
| `data-disabled`          | `''` when `disabled`, else absent                            |
| `data-flat-cursor`       | `''` when the root's `flatCursor` is true, else absent        |
| `style`                  | `transform: translate3d(x, y, 0); transition: …` when a transform applies |

**Additional attributes when `asHandle && !disabled`** (research R-11): `role="button"`,
`tabindex="0"`, `aria-roledescription="sortable"`, `aria-describedby="{rootUid}-instructions"`,
`aria-disabled` when disabled, `aria-pressed="true"` while dragging, and the pointer/keyboard
activation listeners.

**Classes** (upstream sortable.tsx:457-468, unchanged):
`focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1`,
`touch-none select-none` when `asHandle`, `cursor-default` when `flatCursor`,
`data-dragging:cursor-grabbing` when not `flatCursor`, `cursor-grab` when idle + `asHandle` + not
`flatCursor`, `opacity-50` when dragging, `pointer-events-none opacity-50` when disabled.

**Throws**:

- `` `<Sortable.Item>` must be used within `<Sortable.Content>` or `<Sortable.Overlay>`. ``
- `` `SortableItem` value cannot be an empty string `` when `value === ''` (FR-014).

---

## 6. `Sortable.ItemHandle` — `sortable-item-handle.svelte`

| Prop           | Type                                             | Default             | Bindable | Notes |
| -------------- | ------------------------------------------------ | ------------------- | -------- | ----- |
| `disabled`     | `boolean`                                        | the item's `disabled` | no     | Explicit value wins (upstream `disabled ?? itemContext.disabled`). |
| `ref`          | `HTMLButtonElement \| null`                      | `null`              | **yes**  | |
| `child`        | `Snippet<[{ props: SortableItemHandleChildProps }]>` | `undefined`     | no       | Used by the handle demo to compose onto `<Button>`. |
| `children`     | `Snippet`                                        | —                   | no       | |
| `class`        | `string`                                         | `undefined`         | no       | Merged last. |
| `...restProps` | `HTMLButtonAttributes`                           | —                   | no       | |

Element: `<button type="button">` carrying `data-slot="sortable-item-handle"`,
`aria-controls={item.id}`, `data-dragging`, `data-disabled`, `data-flat-cursor`, the real `disabled`
attribute, and — when not disabled — the same activation attributes and listeners as R-11 (minus
`role`, since it is already a button).

**Classes**: `select-none disabled:pointer-events-none disabled:opacity-50` plus
`cursor-default` when `flatCursor`, else `cursor-grab data-dragging:cursor-grabbing`.

**Throws**: `` `<Sortable.ItemHandle>` must be used within `<Sortable.Item>`. ``

---

## 7. `Sortable.Overlay` — `sortable-overlay.svelte`

| Prop        | Type                                                 | Default          | Bindable | Notes |
| ----------- | ---------------------------------------------------- | ---------------- | -------- | ----- |
| `container` | `Element \| DocumentFragment \| string \| null`       | `document.body`  | no       | Portal target; `null` also means `document.body`. |
| `class`     | `string`                                             | `undefined`      | no       | Merged last onto the floating element. |
| `children`  | `Snippet<[{ value: UniqueIdentifier }]>`              | `undefined`      | no       | Covers **both** upstream forms: a plain `{#snippet}`/implicit children for a fixed preview, and `{#snippet children({ value })}` for a per-item preview. |
| `...restProps` | `HTMLAttributes<HTMLDivElement>`                  | —                | no       | |

Renders **only while a drag is active**. The floating element carries
`data-slot="sortable-overlay"`, `data-dragging=""`, `aria-hidden="true"`, `pointer-events-none`,
`position: fixed` with the active item's snapshot rect, and a modifier-clamped
`translate3d(...)`. It also provides the "inside an overlay" context that lets a
`Sortable.Item` be rendered inside it (the primitive-values demo does this).

**Throws**: `` `<Sortable.Overlay>` must be used within `<Sortable>`. ``

---

## 8. Keyboard contract (MDX §Accessibility, FR-007, US2)

| Key                       | Precondition            | Behaviour |
| ------------------------- | ----------------------- | --------- |
| `Tab`                     | —                       | Moves focus between activators (each has `tabindex="0"`). |
| `Space` / `Enter`         | activator focused, idle | Picks the item up. Emits the drag-start announcement. `preventDefault()`. |
| `Space` / `Enter`         | drag active             | Drops at the current position, commits the reorder, emits the drop announcement. |
| `Escape`                  | drag active             | Cancels; no reorder; emits the cancel announcement. |
| `ArrowUp` / `ArrowDown`   | drag active, `vertical` or `mixed` | Moves one position toward the previous/next enabled item. |
| `ArrowLeft` / `ArrowRight`| drag active, `horizontal` or `mixed` | Moves one position; **inverted under `dir="rtl"`**. |
| `ArrowLeft` / `ArrowRight`| drag active, `vertical` | Ignored. |
| `ArrowUp` / `ArrowDown`   | drag active, `horizontal` | Ignored. |
| `Tab`                     | drag active             | Swallowed — focus may not leave a grabbed item. |
| any other key             | drag active             | Passes through unchanged. |

Focus stays on the activator for the whole session, so the item keeps focus across the reorder.

---

## 9. Announcement contract (FR-008, SC-003) — verbatim from sortable.tsx:207-259

With `value` the current array, `n = value.length`, and indices 1-based:

| Event          | Text |
| -------------- | ---- |
| drag start     | `Grabbed sortable item "{id}". Current position is {i+1} of {n}. Use arrow keys to move, space to drop.` |
| drag over/move (over a droppable) | `Sortable item "{id}" moved {down\|up} to position {j+1} of {n}.` (`onDragOver`) / `Sortable item "{id}" is moving {down\|up} to position {j+1} of {n}.` (`onDragMove`) |
| drag over/move (no droppable)     | `Sortable item is no longer over a droppable area. Press escape to cancel.` |
| drag end (over a droppable)       | `Sortable item "{id}" dropped at position {j+1} of {n}.` |
| drag end (no droppable)           | `Sortable item "{id}" dropped. No changes were made.` |
| drag cancel                       | `Sorting cancelled. Sortable item "{id}" returned to position {i+1} of {n}.` |

`{down|up}` is `down` when `overIndex > activeIndex`, else `up`.

Instructions (`{uid}-instructions`), verbatim including the orientation branch:

> To pick up a sortable item, press space or enter. While dragging, use the **{up and down | left and
> right | arrow}** keys to move the item. Press space or enter again to drop the item in its new
> position, or press escape to cancel.

---

## 10. Data attributes (MDX §DataAttributesTable + FR-012)

| Part                    | Attribute          | Present when |
| ----------------------- | ------------------ | ------------ |
| `Sortable.Content`      | `data-slot`        | always (`sortable-content`) |
| `Sortable.Content`      | `data-orientation` | always |
| `Sortable.Item`         | `data-slot`        | always (`sortable-item`) |
| `Sortable.Item`         | `data-dragging`    | the item is being dragged |
| `Sortable.Item`         | `data-disabled`    | the item is disabled |
| `Sortable.Item`         | `data-flat-cursor` | the root's `flatCursor` is true |
| `Sortable.ItemHandle`   | `data-slot`        | always (`sortable-item-handle`) |
| `Sortable.ItemHandle`   | `data-dragging`    | the parent item is being dragged |
| `Sortable.ItemHandle`   | `data-disabled`    | the handle or its item is disabled |
| `Sortable.ItemHandle`   | `data-flat-cursor` | the root's `flatCursor` is true |
| `Sortable.Overlay`      | `data-slot`        | always (`sortable-overlay`) |
| `Sortable.Overlay`      | `data-dragging`    | always (it only exists during a drag) |
| root live region        | `data-slot`        | always (`sortable-live-region`) |
| root instructions       | `data-slot`        | always (`sortable-instructions`) |

Every boolean attribute is written `cond ? '' : undefined`.

---

## 11. Registry contract

```jsonc
{
	"name": "sortable",
	"type": "registry:ui",
	"title": "Sortable",
	"description": "A drag and drop sortable component for reordering items.",
	"registryDependencies": ["button", "direction-provider"],
	"dependencies": ["bits-ui"],
	"files": [
		{ "path": "src/lib/components/ui/sortable/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/sortable/sortable-geometry.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/sortable/sortable-dnd.svelte.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/sortable/sortable.svelte.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/sortable/sortable.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/sortable/sortable-content.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/sortable/sortable-item.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/sortable/sortable-item-handle.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/sortable/sortable-overlay.svelte", "type": "registry:ui" }
	]
}
```

`sortable.test.ts` and `sortable.test.svelte` are **not** listed. `pnpm run registry:build` is run
afterwards; output lands in `static/r/`.

---

## 12. Demo route contract — `/docs/components/sortable`

One `<ComponentPreview>` per upstream example file (constitution IX), plus props tables in the
`action-bar` page's style:

| Section              | Mirrors                              | Exercises |
| -------------------- | ------------------------------------ | --------- |
| Default              | `sortable-demo.tsx`                  | object array + `getItemValue`, `orientation="mixed"`, `Item` with `child` + `asHandle`, fixed `Overlay` |
| With Dynamic Overlay | `sortable-dynamic-overlay-demo.tsx`  | `{#snippet children({ value })}` on `Overlay` rendering the matching item |
| With Handle          | `sortable-handle-demo.tsx`           | `Content` with `child` onto `Table.Body`, `Item` with `child` onto `Table.Row`, `ItemHandle` with `child` onto `Button` + `GripVerticalIcon`, default `vertical` orientation |
| With Primitive Values| `sortable-primitive-values-demo.tsx` | `string[]` with no `getItemValue`, `Item` inside the `Overlay` snippet |

Plus, beyond the upstream example set but required by the spec's own success criteria:

| Section       | Requirement |
| ------------- | ----------- |
| Orientation   | SC-005 — the same list rendered `vertical` / `horizontal` / `mixed` from one control |
| RTL           | SC-006 / FR-015 — a `DirectionProvider dir="rtl"` horizontal list |

Props tables: one per part (`Sortable`, `Content`, `Item`, `ItemHandle`, `Overlay`), each row
`{ prop, type, default, description }`, rendered with `$lib/components/ui/table`.
