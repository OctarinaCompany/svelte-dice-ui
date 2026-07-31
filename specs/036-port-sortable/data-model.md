# Phase 1 Data Model: Sortable

**Feature**: `036-port-sortable` | **Date**: 2026-07-31

Maps the spec's three Key Entities (Sortable list, Sortable item, Drag session) onto the runtime
shapes. Four modules hold state; two of them are the reusable core `kanban` will import.

```
sortable-geometry.ts      pure functions + types      no runes, no DOM writes
sortable-dnd.svelte.ts    DndState, DragSession       runes; engine, sensor-agnostic
sortable.svelte.ts        SortableRootState,          runes; the component's own semantics
                          SortableItemState, contexts
*.svelte                  props → getters → state     no logic beyond attribute assembly
```

---

## 1. `sortable-geometry.ts` — pure layer

Rune-free so it is unit-testable without a DOM (research R-22) and reusable verbatim by `kanban`.

| Export                             | Signature | Notes |
| ---------------------------------- | --------- | ----- |
| `UniqueIdentifier`                 | `string \| number` | |
| `Coordinates`                      | `{ x, y }` | |
| `ClientRect`                       | `{ top, left, right, bottom, width, height }` | Plain object; never a live `DOMRect`. |
| `toClientRect(el)`                 | `(el: Element) => ClientRect` | Snapshot of `getBoundingClientRect()`. |
| `translate3d(t)`                   | `(t: Coordinates \| null) => string \| undefined` | Replaces `CSS.Translate.toString`. |
| `arrayMove(array, from, to)`       | `<T>(a: T[], from: number, to: number) => T[]` | Pure; out-of-range indices return a copy unchanged. |
| `closestCenter`                    | `SortableCollisionDetection` | Centre-distance ranking. |
| `closestCorners`                   | `SortableCollisionDetection` | Summed corner-distance ranking. |
| `verticalListSortingStrategy`      | `SortableStrategy` | |
| `horizontalListSortingStrategy`    | `SortableStrategy` | |
| `rectSortingStrategy`              | `SortableStrategy` | dnd-kit's `SortableContext` default; used for `mixed`. |
| `restrictToVerticalAxis`           | `SortableModifier` | |
| `restrictToHorizontalAxis`         | `SortableModifier` | |
| `restrictToParentElement`          | `SortableModifier` | Clamps against `containerRect`. |
| `resolveKeyboardIndex(args)`       | see below | The keyboard sensor's whole decision. |
| `SORTABLE_ORIENTATIONS`            | `readonly ['vertical', 'horizontal', 'mixed']` | |

### `resolveKeyboardIndex`

```ts
type ResolveKeyboardIndexArgs = {
	key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
	orientation: SortableOrientation;
	dir: 'ltr' | 'rtl';
	activeIndex: number;
	/** One entry per item in the root's `items` array, in that order. */
	candidates: { id: UniqueIdentifier; disabled: boolean; rect: ClientRect | null }[];
};

/** The index to move to, or `null` when the key does not apply or no target exists. */
function resolveKeyboardIndex(args: ResolveKeyboardIndexArgs): number | null;
```

Rules (research R-04), in order:

1. RTL mirror: for `horizontal` and `mixed`, `ArrowLeft` ↔ `ArrowRight` when `dir === 'rtl'`.
2. Axis filter: `vertical` ignores horizontal keys; `horizontal` ignores vertical keys; `mixed`
   accepts all four.
3. `mixed` + non-degenerate rects: pick the nearest enabled candidate whose centre lies strictly in
   the pressed direction (compared on the dominant axis, tie-broken by total centre distance).
4. Otherwise (list orientations, or every rect degenerate/zero-area): step to the nearest enabled
   index in the key's direction (`-1` for up/left, `+1` for down/right), skipping disabled
   candidates.
5. No candidate → `null` (the item does not move; no announcement).

**State transition**: this function is total and side-effect free; it never reads the DOM.

---

## 2. `sortable-dnd.svelte.ts` — engine layer

### `DndNodeEntry` (registry record)

| Field         | Type                              | Notes |
| ------------- | --------------------------------- | ----- |
| `id`          | `UniqueIdentifier`                | Item value, or container id. |
| `kind`        | `'item' \| 'container'`           | `kanban` registers both; `sortable` registers `'item'` only, plus one container. |
| `containerId` | `UniqueIdentifier \| null`        | Which `Content`/column owns it. Seam for `kanban` (research R-02). |
| `node`        | `HTMLElement`                     | |
| `disabled`    | `() => boolean`                   | Getter — a disabled entry is neither draggable nor droppable. |

Stored in a **plain `Map<UniqueIdentifier, DndNodeEntry>`**, not a `SvelteMap` (research R-19).
Registration returns its own unregister function and is driven from each part's `$effect` teardown.

### `DragSession` (the spec's "Drag session" entity)

| Field                | Type                                        | Reactive | Notes |
| -------------------- | ------------------------------------------- | -------- | ----- |
| `activeId`           | `UniqueIdentifier`                          | —        | Fixed for the session's lifetime. |
| `source`             | `'pointer' \| 'keyboard'`                   | —        | |
| `activatorEvent`     | `PointerEvent \| KeyboardEvent`             | —        | |
| `initialIndex`       | `number`                                    | —        | Position at pick-up; the cancel announcement's number. |
| `initialCoordinates` | `Coordinates`                               | —        | Pointer origin, or the active node's centre for keyboard. |
| `activeRect`         | `ClientRect \| null`                        | —        | Snapshot at pick-up. |
| `containerRect`      | `ClientRect \| null`                        | —        | The **active node's parent element** rect (research R-07). |
| `rects`              | `Map<UniqueIdentifier, ClientRect>`         | —        | Snapshot of every registered droppable at pick-up; re-measured on `over` change. |
| `delta`              | `Coordinates`                               | `$state` | Raw pointer delta, pre-modifier. |
| `overId`             | `UniqueIdentifier \| null`                  | `$state` | Current drop target. |
| `cancelled`          | `boolean`                                   | `$state` | Set by `Escape` / mid-drag removal, read by the end handler. |

`transform` — the modifier-clamped delta — is `$derived` from `delta` + the modifier list, never
stored.

**Lifecycle** (state machine):

```
idle ──activate(pointer ≥5px | touch hold 250ms | Space/Enter)──▶ dragging
dragging ──pointermove / arrow key──▶ dragging   (delta, overId updated; announcements on change)
dragging ──pointerup / Space / Enter──▶ commit ──▶ idle
dragging ──Escape / pointercancel / active id removed──▶ cancel ──▶ idle
```

Every transition emits exactly one announcement (research R-10) and calls at most one lifecycle
callback.

### `DndState`

| Member                              | Kind      | Notes |
| ----------------------------------- | --------- | ----- |
| `session`                           | `$state`  | `DragSession \| null`. |
| `activeId`                          | `$derived`| `session?.activeId ?? null`. |
| `overId`                            | `$derived`| |
| `isDragging(id)`                    | method    | |
| `register(entry)`                   | method    | Returns an unregister thunk. |
| `getRect(id)`                       | method    | Live measure; used at pick-up and on re-measure. |
| `startPointerDrag(entry, event)`    | method    | Applies the activation constraint before opening a session. |
| `startKeyboardDrag(entry, event)`   | method    | |
| `move(coordinates)`                 | method    | Updates `delta`, runs modifiers, runs collision detection, updates `overId`. |
| `moveToIndex(index)`                | method    | Keyboard path: sets `overId` from the resolved index. |
| `end()` / `cancel()`                | methods   | |
| `destroy()`                         | method    | Removes every document listener, clears the touch-hold timer, releases pointer capture. |

**Teardown contract** (constitution I, `$effect` rule): `DndState` owns exactly three
long-lived resources — the `pointermove`/`pointerup`/`pointercancel`/`keydown` document listeners,
the touch-activation `setTimeout`, and the pointer capture. All three are released by `destroy()`,
which the root calls from `$effect(() => () => dnd.destroy())`.

The engine holds **no** knowledge of `value`, `getItemValue`, orientation or announcements — those
are injected as getter functions by `SortableRootState`, which is what lets `kanban` reuse it.

---

## 3. `sortable.svelte.ts` — component layer

### `SortableRootStateProps` (all reactive inputs as getters)

```ts
type SortableRootStateProps = {
	readonly getItems: () => UniqueIdentifier[];
	readonly getCount: () => number;
	readonly getOrientation: () => SortableOrientation;
	readonly getStrategy: () => SortableStrategy | undefined;
	readonly getCollisionDetection: () => SortableCollisionDetection | undefined;
	readonly getModifiers: () => SortableModifier[] | undefined;
	readonly getFlatCursor: () => boolean;
	readonly getDir: () => Direction;
	readonly getAccessibility: () => SortableAccessibility | undefined;
	readonly commit: (activeIndex: number, overIndex: number, event: SortableDragEvent) => void;
	readonly getOnDragStart: () => ((event: SortableDragEvent) => void) | undefined;
	readonly getOnDragMove: () => ((event: SortableDragEvent) => void) | undefined;
	readonly getOnDragOver: () => ((event: SortableDragEvent) => void) | undefined;
	readonly getOnDragEnd: () => ((event: SortableDragEvent) => void) | undefined;
	readonly getOnDragCancel: () => ((event: SortableDragEvent) => void) | undefined;
	/** The one `$props.id()` the live region and instructions ids derive from. */
	readonly id: string;
};
```

### `SortableRootState`

| Member                  | Kind       | Derivation |
| ----------------------- | ---------- | ---------- |
| `dnd`                   | field      | The `DndState` instance. |
| `items`                 | `$derived` | `props.getItems()` — the identifier space (research R-20). |
| `count`                 | `$derived` | `items.length`. |
| `orientation`           | `$derived` | |
| `config`                | `$derived` | `{ modifiers, strategy, collisionDetection }` after applying the per-orientation defaults and the prop overrides. |
| `flatCursor`, `dir`     | `$derived` | |
| `activeId`, `overId`    | `$derived` | Delegated to `dnd`. |
| `activeIndex`, `overIndex` | `$derived` | `items.indexOf(...)`, `-1` when absent. |
| `overlayCount`          | `$state`   | Incremented/decremented by each mounted `Overlay`; drives research R-08. |
| `hasOverlay`            | `$derived` | `overlayCount > 0`. |
| `announcement`          | `$state`   | The live region's text. |
| `instructions`          | `$derived` | Orientation-branched text, overridable. |
| `liveRegionId`, `instructionsId` | `$derived` | `` `${id}-live` ``, `` `${id}-instructions` `` |
| `indexOf(value)`        | method     | |
| `getItemTransform(value)` | method   | Applies research R-06/R-08: `null` when idle; strategy transform for non-active items; `null` (overlay mounted) or clamped delta (no overlay) for the active item. |
| `getOverlayTransform()` | method     | Modifier-clamped delta for the floating element. |
| `announce(kind, …)`     | method     | Builds the text (default or overridden) and writes `announcement`. |
| `onEscape()` etc.       | methods    | Session verbs the parts call. |

**Guard executed at construction** (FR-003): if `items` is non-empty and the first raw value is a
non-null `object` while `getItemValue` was not supplied, throw
`` `getItemValue` is required when using array of objects ``. Implemented in the root component,
where the raw `value` is in scope, before the state class is constructed.

**Reaction to mid-drag mutation** (FR/edge case, research R-21): a single `$effect` in the root
watches `activeId` and `items`; when a session is open and `items` no longer contains `activeId`, it
calls `dnd.cancel()`. It writes no state it reads (`items` and `activeId` are both external), so no
loop.

### `SortableItemState`

| Member          | Kind       | Derivation |
| --------------- | ---------- | ---------- |
| `value`         | `$derived` | The item's `value` prop. |
| `index`         | `$derived` | `root.indexOf(value)`. |
| `disabled`      | `$derived` | The item's `disabled` prop. |
| `isDragging`    | `$derived` | `root.activeId === value`. |
| `transform`     | `$derived` | `root.getItemTransform(value)`. |
| `id`            | `$derived` | The item's `$props.id()` — the handle's `aria-controls` target. |
| `activatorAttrs`| `$derived` | The R-11 attribute set, or `{}` when disabled. |
| `node`          | `$state`   | The rendered element, bound by the part; drives registration. |
| `setActivator(el)` | method  | Records which element starts a drag (item when `asHandle`, else the handle). |

### Contexts (constitution §5)

| Key (Symbol)          | Set by            | Read by                     | Throw message |
| --------------------- | ----------------- | --------------------------- | ------------- |
| `Symbol('sortable')`  | `Sortable`        | `Content`, `Item`, `ItemHandle`, `Overlay` | `` `<Sortable.{Part}>` must be used within `<Sortable>`. `` |
| `Symbol('sortable-content')` | `Content`  | `Item` (presence check)     | — (combined with the overlay check) |
| `Symbol('sortable-item')`    | `Item`     | `ItemHandle`                | `` `<Sortable.ItemHandle>` must be used within `<Sortable.Item>`. `` |
| `Symbol('sortable-overlay')` | `Overlay`  | `Item` (presence check)     | — |

`Item` requires **either** the content **or** the overlay context and throws
`` `<Sortable.Item>` must be used within `<Sortable.Content>` or `<Sortable.Overlay>`. `` when
neither is present (upstream sortable.tsx:395-399).

---

## 4. Validation rules

| Rule | Where | Message / effect |
| ---- | ----- | ---------------- |
| Object array without `getItemValue` | Root init | throws (FR-003) |
| `Item value === ''`                 | Item init | throws (FR-014) |
| Part outside its provider           | Part init | throws (FR-013) |
| Disabled item                       | Engine    | never draggable, never a drop target (FR-009) |
| `activeIndex === overIndex` or no `over` | Commit | no `onValueChange`, no `onMove`, "No changes were made." announcement |
| Active id removed mid-drag          | Root `$effect` | session cancelled (research R-21) |
| Empty or single-item list           | Engine    | pick-up and drop succeed; no reorder is possible |
