# Phase 1 Data Model: Kanban

**Feature**: `specs/037-port-kanban` | **Date**: 2026-07-31

State shape only. The public prop/attribute surface is in
[contracts/kanban-api.md](./contracts/kanban-api.md); the decisions behind each choice are in
[research.md](./research.md).

---

## 1. Reused types (imported, not redeclared)

From `$lib/components/ui/sortable/index.js`:

| Type / value                                                      | Used for                                       |
| ----------------------------------------------------------------- | ---------------------------------------------- |
| `UniqueIdentifier = string \| number`                             | column and item identifiers                    |
| `ClientRect`, `Coordinates`                                       | all geometry                                   |
| `SortableModifier`, `SortableStrategy`, `SortableCollisionDetection` | the `modifiers` / `strategy` props           |
| `toClientRect`, `translate3d`, `arrayMove`                        | measurement, transforms, reorders              |
| `closestCenter`, `closestCorners`                                 | R-05 cascade step 1/4 and R-06 ranking         |
| `DndState`, `DragSession`, `DndNodeEntry`, `DndStateProps`        | the engine subclassed in `kanban-dnd.svelte.ts` |

From `$lib/components/ui/direction-provider/index.js`: `useDirection`, `Direction`.

---

## 2. Entities

### Board (`value`)

```ts
type KanbanValue<T> = Record<UniqueIdentifier, T[]>;
```

An **ordered** map: `Object.keys(value)` is the column order, each array is that column's item order.
Both orders are consumer-owned; every commit replaces the whole record with a new object so
`$bindable` propagation and `onValueChange` fire once per commit.

| Field                | Derivation                                                          |
| -------------------- | -------------------------------------------------------------------- |
| `columns`            | `Object.keys(value)`                                                 |
| `items(columnId)`    | `value[columnId] ?? []`                                              |
| `itemValues`         | `Object.values(value).flat().map(getItemValue)`                      |
| `identifiers`        | `[...columns, ...itemValues]` — the engine's flat space (R-03)       |
| `isColumn(id)`       | `id in value`                                                        |
| `getColumn(id)`      | `id` if `isColumn(id)`, else the column whose items contain `id`, else `null` |

**Invariants**: a column id never equals an item id (R-03); an item belongs to exactly one column;
an empty column is still a valid, rendered drop target (spec edge case).

### Column

Rendered by `<Kanban.Column value=…>`. Runtime state per column: its own `$props.id()` (the
handle's `aria-controls` target), `disabled`, `isDragging` (`root.activeId === value`), the
registered DOM node, and the activator element.

### Item

Rendered by `<Kanban.Item value=…>`. Same runtime shape as Column, plus `containerId` — the column
value published by the enclosing `<Kanban.Column>` through the column context.

### Drag Preview (Overlay)

No persistent state. Derived per render from `root.activeId`:
`variant = root.isColumn(activeId) ? 'column' : 'item'`. Mounting one flips
`root.hasOverlay`, which suppresses the dragged element's own transform (R-07).

---

## 3. Runtime classes

All reactive inputs enter as **getter functions**; nothing is snapshotted in a constructor
(constitution I).

### `KanbanDndState extends DndState` — `kanban-dnd.svelte.ts`

```ts
type KanbanDndStateProps = DndStateProps & {
	/** Live client point of the pointer, reconstructed as initialCoordinates + delta (R-05). */
	readonly resolveOverId: (session: DragSession, pointer: Coordinates) => UniqueIdentifier | null;
};
```

| Member                    | Kind             | Notes                                                             |
| ------------------------- | ---------------- | ----------------------------------------------------------------- |
| `move(delta)`             | override         | writes `session.delta`, resolves the drop target through `resolveOverId`, fires `onOver` only on change, then `onMove` |
| everything else           | inherited        | sensors, activation constraints, pointer capture, `moveToIndex`, `end`, `cancel`, `destroy`, the keyboard machine |

The subclass keeps its own reference to the `onMove`/`onOver` hooks it was constructed with, because
the base stores them in a `#private` field.

### `KanbanRootState` — `kanban.svelte.ts`

```ts
type KanbanRootStateProps = {
	readonly getValue: () => Record<UniqueIdentifier, unknown[]>;
	readonly setValue: (next: Record<UniqueIdentifier, unknown[]>) => void;
	readonly getItemValue: (item: unknown) => UniqueIdentifier;
	readonly getOrientation: () => 'horizontal' | 'vertical';
	readonly getStrategy: () => SortableStrategy | undefined;   // stored, never read (R-08)
	readonly getModifiers: () => SortableModifier[] | undefined;
	readonly getFlatCursor: () => boolean;
	readonly getDir: () => Direction;
	readonly getAccessibility: () => KanbanAccessibility | undefined;
	readonly getOnMove: () => ((event: KanbanMoveEvent) => void) | undefined;
	readonly getOnDragStart: () => ((event: KanbanDragEvent) => void) | undefined;
	readonly getOnDragMove: () => ((event: KanbanDragEvent) => void) | undefined;
	readonly getOnDragOver: () => ((event: KanbanDragEvent) => void) | undefined;
	readonly getOnDragEnd: () => ((event: KanbanDragEvent) => void) | undefined;
	readonly getOnDragCancel: () => ((event: KanbanDragEvent) => void) | undefined;
	readonly id: string;
};
```

| Member                                   | Kind        | Purpose                                                   |
| ---------------------------------------- | ----------- | ---------------------------------------------------------- |
| `dnd`                                    | `KanbanDndState` | constructed once in the constructor                   |
| `columns`, `identifiers`                 | `$derived`  | R-03                                                      |
| `orientation`, `flatCursor`, `dir`       | `$derived`  | pass-throughs                                             |
| `activeId`, `overId`                     | getters     | delegate to `dnd` (which is assigned in the constructor, so a `$derived` field initialiser would be use-before-init — the pattern `SortableRootState` already uses) |
| `overlayCount` / `hasOverlay`            | `$state` / `$derived` | R-07 transform suppression                      |
| `announcement`                           | `$state`    | live-region text, written only on change (R-10)           |
| `instructions`                           | `$derived`  | overridable instruction text                              |
| `liveRegionId`, `instructionsId`         | `$derived`  | `${id}-live`, `${id}-instructions`                        |
| `#lastOverId`, `#hasMoved`               | plain fields | upstream's two refs (`kanban.tsx:220-221`)               |
| `isColumn(id)` / `getColumn(id)` / `positionOf(id)` / `countFor(id)` | methods | the announcement and commit maths |
| `resolveOverId(session, pointer)`        | method      | the R-05 cascade                                          |
| `resolveArrowTarget(key, session)`       | method      | the R-06 resolver, returns an index into `identifiers`    |
| `getDragTransform(id)`                   | method      | `null` unless `id === activeId`; `null` when `hasOverlay`; else `session.transform` (R-07) |
| `announce(text)`                         | method      | change-guarded live-region write                          |

Session hooks, wired into `KanbanDndState` at construction:

| Hook        | Effect                                                                          |
| ----------- | -------------------------------------------------------------------------------- |
| `onStart`   | fire `onDragStart`, announce pick-up                                             |
| `onMove`    | fire `onDragMove`, announce (reuses the over builder)                            |
| `onOver`    | fire `onDragOver`, **commit** the same-column `arrayMove` or the cross-column move (R-07), announce |
| `onEnd`     | `over === null` → announce, commit nothing; else fire `onDragEnd`, commit the column reorder or the same-column `arrayMove` through `onMove ?? onValueChange`, announce, retain focus for keyboard drags |
| `onCancel`  | fire `onDragCancel`, announce, reset `#lastOverId`/`#hasMoved`                    |
| `onArrowKey`| `resolveArrowTarget`                                                             |

### `KanbanColumnState` / `KanbanItemState` — `kanban.svelte.ts`

One class each, same shape (they differ only in what `register()` passes as `containerId` and in
which context they publish):

```ts
type KanbanPartStateProps = {
	readonly root: KanbanRootState;
	readonly getValue: () => UniqueIdentifier;
	readonly getDisabled: () => boolean;
	/** A part rendered inside <Kanban.Overlay> is a preview: it never registers and never drags. */
	readonly inOverlay: boolean;
	readonly id: string;
};
```

| Member                     | Kind       | Notes                                                      |
| -------------------------- | ---------- | ----------------------------------------------------------- |
| `node`, `activator`        | `$state`   | bound by the part / set by its handle                       |
| `value`, `disabled`        | `$derived` |                                                             |
| `isDragging`               | `$derived` | `!inOverlay && root.activeId === value`                     |
| `transform`                | `$derived` | `inOverlay ? null : root.getDragTransform(value)`           |
| `activatorAttrs`           | `$derived` | R-11 attribute set                                          |
| `register(node, containerId)` | method  | delegates to `root.dnd.register`, returns the unregister thunk |
| `onActivatorPointerDown` / `onActivatorKeydown` | methods | guard on `disabled`/`inOverlay`/an open session, then `startPointerDrag` / `startKeyboardDrag` |

`KanbanItemState` additionally exposes `containerId` (from the column context).

---

## 4. Contexts — `Symbol` keys, throwing getters

| Key                        | Set by            | Value                                | Getter throws when missing            |
| -------------------------- | ----------------- | ------------------------------------ | ------------------------------------- |
| `Symbol('kanban')`         | `<Kanban>`        | `KanbanRootState`                    | `` `<Part>` must be used within `<Kanban>`. `` (part name passed by the caller) |
| `Symbol('kanban-board')`   | `<Kanban.Board>`  | `true`                               | consulted with `has…`, not thrown directly |
| `Symbol('kanban-column')`  | `<Kanban.Column>` | `KanbanColumnState`                  | `` `<Kanban.ColumnHandle>` must be used within `<Kanban.Column>`. `` |
| `Symbol('kanban-item')`    | `<Kanban.Item>`   | `KanbanItemState`                    | `` `<Kanban.ItemHandle>` must be used within `<Kanban.Item>`. `` |
| `Symbol('kanban-overlay')` | `<Kanban.Overlay>`| `true`                               | consulted with `has…`                 |

`<Kanban.Column>` and `<Kanban.Item>` require board **or** overlay context and throw the combined
message when neither is present (R-13).

---

## 5. Event payloads

```ts
type KanbanDragEvent = { active: { id: UniqueIdentifier }; over: { id: UniqueIdentifier } | null };
type KanbanMoveEvent = KanbanDragEvent & { activeIndex: number; overIndex: number };

type KanbanAnnouncementArgs = {
	value: UniqueIdentifier;      // the active id
	variant: 'column' | 'item';
	position: number;             // 1-based, in the *current* value (R-10)
	total: number;
	column: UniqueIdentifier | null;      // destination column, or null
	changedColumn: boolean;
};

type KanbanAccessibility = {
	announcements?: Partial<KanbanAnnouncements>;
	screenReaderInstructions?: { draggable: string };
};
```

`activeIndex`/`overIndex` are indices **within the affected list**: `Object.keys(value)` for a column
reorder, the column's item array for a same-column reorder — matching `kanban.tsx:394-395, 431-436`.

---

## 6. State transitions

```
idle ──activator pointerdown (5 px / 250 ms hold)──▶ dragging(pointer)
idle ──activator Space|Enter───────────────────────▶ dragging(keyboard)

dragging ──pointermove / Arrow*──▶ dragging          [overId may change → onOver → value may commit]
dragging ──pointerup over a target / Space|Enter──▶ committed → idle
dragging ──pointerup over nothing (overId === null)─▶ idle          [no commit, FR-013]
dragging ──Escape / pointercancel─────────────────▶ cancelled → idle [no commit]
dragging ──active id disappears from value────────▶ cancelled → idle
```

Guards: a `disabled` column or item never enters `dragging` (FR-010); a part `inOverlay` never
registers, so it can never be the active or the over node; `Tab` is swallowed while dragging so focus
cannot leave a grabbed element.
