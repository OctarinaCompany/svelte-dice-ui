# Phase 1 Data Model: Data Grid

Entities are the runtime shapes the component owns. Every type below lives in
`src/lib/components/ui/data-grid/types.ts` unless marked otherwise, and every one is exported from
the barrel (Principle VI: public prop types are exported).

---

## 1. Value types

### `Direction`

`'ltr' | 'rtl'` — re-exported from `$lib/components/ui/direction-provider`, not redeclared.

### `RowHeightValue`

`'short' | 'medium' | 'tall' | 'extra-tall'`.

| Value        | Row height (px) | Visible text lines |
| ------------ | --------------- | ------------------ |
| `short`      | 36              | 1                  |
| `medium`     | 56              | 2                  |
| `tall`       | 76              | 3                  |
| `extra-tall` | 96              | 4                  |

Read through `getRowHeightValue()` / `getLineCount()`. **Validation**: exhaustive `Record` lookup —
an unknown value is a type error, not a runtime fallback.

### `CellPosition`

`{ rowIndex: number; columnId: string }` — the unit of focus, editing, and the corners of a range.

**Validation**: `rowIndex` is an index into the *current row model* (post-sort, post-filter), not
into the source `data` array; `columnId` must be a member of `columnIds`. Navigation only ever
produces positions where `columnId ∈ navigableColumnIds`.

### `CellRange`

`{ start: CellPosition; end: CellPosition }` — anchor and moving edge. Unordered: `start` may be
below/right of `end`; the covered set is always the normalised rectangle.

### `CellUpdate`

`{ rowIndex: number; columnId: string; value: unknown }` — produced by editing, pasting, clearing
and cut-source-clearing. Batched: `updateData` accepts `CellUpdate | CellUpdate[]` and applies all
of them in one pass, emitting **one** `onDataChange`.

### `CellSelectOption`

`{ label: string; value: string; icon?: Component; count?: number }`.

### `CellOpts` (discriminated union on `variant`)

| `variant`      | Extra fields                                                   | Cell value type   | Empty value |
| -------------- | -------------------------------------------------------------- | ----------------- | ----------- |
| `short-text`   | —                                                              | `string`          | `''`        |
| `long-text`    | —                                                              | `string`          | `''`        |
| `number`       | `min?`, `max?`, `step?`                                        | `number \| null`  | `null`      |
| `url`          | —                                                              | `string \| null`  | `''`        |
| `checkbox`     | —                                                              | `boolean`         | `false`     |
| `select`       | `options: CellSelectOption[]`                                  | `string`          | `''`        |
| `multi-select` | `options: CellSelectOption[]`                                  | `string[]`        | `[]`        |
| `date`         | —                                                              | `string` (`YYYY-MM-DD`) | `null` |
| `file`         | `maxFileSize?`, `maxFiles?`, `accept?`, `multiple?`            | `FileCellData[]`  | `[]`        |

The "Empty value" column is `getEmptyCellValue(variant)` and is what Delete/Backspace, the context
menu's Clear, and cut-source clearing write.

### `FileCellData`

`{ id: string; name: string; size: number; type: string; url?: string }`.
**Validation**: `getIsFileCellData(x)` requires `id`, `name`, `size` and `type` to be present — the
guard a pasted `file` cell must pass.

### `NavigationDirection`

`'up' | 'down' | 'left' | 'right' | 'home' | 'end' | 'ctrl+up' | 'ctrl+down' | 'ctrl+home' | 'ctrl+end' | 'pageup' | 'pagedown' | 'pageleft' | 'pageright'`.

### `DataGridColumnDef<TData>`

`ColumnDef<TData>` from `@tanstack/table-core`, with `meta?: { label?: string; cell?: CellOpts }`.
Declared through a module augmentation of `@tanstack/table-core`'s `ColumnMeta`, so
`column.columnDef.meta.cell` is typed everywhere without a cast.

**Non-navigable columns**: `NON_NAVIGABLE_COLUMN_IDS = new Set(['select', 'actions'])`. These
participate in rendering and in `columnIds`, but never in `navigableColumnIds`, so focus, Tab order,
paste targeting and TSV serialization skip them.

---

## 2. State entities

### `DataGridState<TData>` — `data-grid.svelte.ts`

The root. Created by `createDataGrid(options)` during component initialisation; published via
`setDataGridContext`.

| Field                | Rune            | Meaning                                                            |
| -------------------- | --------------- | ------------------------------------------------------------------- |
| `table`              | plain (stable)  | the `@tanstack/table-core` instance                                |
| `sorting`            | `$state.raw`    | `SortingState`                                                     |
| `columnFilters`      | `$state.raw`    | `ColumnFiltersState`                                               |
| `rowSelection`       | `$state.raw`    | `RowSelectionState`                                                |
| `rowHeight`          | `$state`        | `RowHeightValue`                                                   |
| `focusedCell`        | `$state.raw`    | `CellPosition \| null`                                             |
| `editingCell`        | `$state.raw`    | `CellPosition \| null`                                             |
| `contextMenu`        | `$state.raw`    | `{ open, x, y }`                                                   |
| `lastClickedRowId`   | `$state.raw`    | `string \| null` — anchor for shift-click row selection            |
| `rows`               | `$derived`      | `table.getRowModel().rows`                                         |
| `columnIds`          | `$derived`      | ids from `columns` (`c.id ?? c.accessorKey`)                       |
| `navigableColumnIds` | `$derived`      | `columnIds` minus `NON_NAVIGABLE_COLUMN_IDS`                       |
| `columnSizeVars`     | `$derived`      | `{ '--header-<id>-size', '--col-<id>-size' }`                      |
| `cellSelectionMap`   | `$derived`      | `Map<rowIndex, Set<cellKey>>`                                      |
| `dir`                | `$derived`      | resolved through `useDirection()`                                  |
| `readOnly`           | `$derived`      | from options                                                        |
| `selection`          | plain           | `DataGridSelectionState`                                           |
| `clipboard`          | plain           | `DataGridClipboardState`                                           |
| `search`             | plain \| undef  | `DataGridSearchState` — only when `enableSearch`                   |
| `virtualizer`        | plain           | `DataGridVirtualizer`                                              |
| `#cellMap`           | plain `Map`     | `cellKey → HTMLElement`, non-reactive (DOM registry)                |
| `#rowMap`            | plain `Map`     | `rowIndex → HTMLElement`, non-reactive                              |
| `#focusGuard`        | plain `boolean` | suppresses focus restoration while an async re-render settles       |

The three DOM registries are deliberately **not** `$state` — they are write-only caches for focus
and scrolling, and making them reactive would re-run every consumer on every row mount.

### `DataGridSelectionState` — `data-grid-selection.svelte.ts`

| Field            | Rune         | Meaning                                        |
| ---------------- | ------------ | ---------------------------------------------- |
| `selectedCells`  | `$state.raw` | `Set<cellKey>`                                 |
| `selectionRange` | `$state.raw` | `CellRange \| null`                            |
| `isSelecting`    | `$state`     | a drag is in progress                          |
| `size`           | `$derived`   | `selectedCells.size`                           |

Methods: `selectRange(start, end, isSelecting?)`, `toggleCell(pos)`, `selectAll()`,
`selectColumn(columnId)`, `clear()`, `has(rowIndex, columnId)`.

### `DataGridClipboardState` — `data-grid-clipboard.svelte.ts`

| Field         | Rune         | Meaning                                                 |
| ------------- | ------------ | ------------------------------------------------------- |
| `cutCells`    | `$state.raw` | `Set<cellKey>` marked as cut, cleared on paste or copy   |
| `pasteDialog` | `$state.raw` | `{ open: boolean; rowsNeeded: number; clipboardText: string }` |

Methods: `copy()`, `cut()`, `paste(expandRows = false)`, `setPasteDialogOpen(open)`, `isCut(key)`.

### `DataGridSearchState` — `data-grid-search.svelte.ts`

| Field                | Rune         | Meaning                                     |
| -------------------- | ------------ | ------------------------------------------- |
| `open`               | `$state`     | search box visible                          |
| `query`              | `$state`     | the raw input value                         |
| `matches`            | `$state.raw` | `CellPosition[]` in row-major order         |
| `matchIndex`         | `$state`     | index into `matches`, `-1` when none        |
| `activeMatch`        | `$derived`   | `matches[matchIndex] ?? null`               |
| `matchesByRow`       | `$derived`   | `Map<rowIndex, Set<columnId>> \| null`      |

Methods: `setOpen(open)`, `setQuery(query)` (debounced 150 ms → `search`), `search(query)`,
`next()`, `prev()`, `isMatch(rowIndex, columnId)`, `isActiveMatch(rowIndex, columnId)`.

### `DataGridVirtualizer` — `data-grid-virtualizer.svelte.ts`

| Field            | Rune       | Meaning                                                 |
| ---------------- | ---------- | ------------------------------------------------------- |
| `scrollTop`      | `$state`   | written from the container's `scroll` handler           |
| `viewportHeight` | `$state`   | written from a `ResizeObserver` on the container        |
| `startIndex`     | `$derived` | `clamp(floor(scrollTop / h) - overscan, 0, count - 1)`  |
| `endIndex`       | `$derived` | `clamp(ceil((scrollTop + viewportHeight) / h) + overscan, 0, count - 1)` |
| `virtualItems`   | `$derived` | `{ index, start: index * h, size: h }[]`                |
| `totalSize`      | `$derived` | `count * h`                                             |

Method: `scrollToIndex(index, { align })`.

---

## 3. Relationships

```text
createDataGrid(options)
      │
      ▼
DataGridState ──(Symbol context)──▶ Root ─▶ Row ─▶ Cell ─▶ <variant>Cell ─▶ CellWrapper
      ├── table (@tanstack/table-core)          │                                  │
      ├── selection  ◀────────────── click / keydown / drag ──────────────────────┘
      ├── clipboard  ◀────────────── Ctrl+C / X / V, context menu
      ├── search     ◀────────────── Ctrl+F, Enter / Shift+Enter
      └── virtualizer ─▶ which rows Root renders

DataGridState.updateData(updates) ─▶ options.onDataChange(nextData)   // consumer owns the data
```

Data flows **out** only through callbacks: the grid never mutates a consumer row object. Every
mutation path (`updateData`, `clearCells`, paste, cut-clear) builds a new array with new row objects
for the touched rows and hands it to `onDataChange`.

---

## 4. State transitions

### Focus / editing

| From                   | Trigger                                            | To                        |
| ---------------------- | -------------------------------------------------- | ------------------------- |
| no focus               | click a cell / `autoFocus` / `scrollToRow`         | focused                   |
| focused                | arrow / Tab / Home / End / Page / Ctrl+… (clamped) | focused elsewhere         |
| focused                | Enter, F2, Space, printable char, double-click     | editing (blocked if `readOnly`; `checkbox` toggles instead) |
| focused                | click the **same** cell again                      | editing                   |
| editing                | Enter                                              | committed → focus one row down |
| editing                | Shift+Enter (with `onRowAdd`)                      | committed → new row added, focus follows the callback's return |
| editing                | Tab / Shift+Tab                                    | committed → focus next/previous cell (RTL-inverted) |
| editing                | Escape                                             | discarded → focused       |
| editing                | blur to outside the grid and not into a popover     | committed → focused       |
| focused                | Escape with a selection                            | selection cleared, still focused |
| focused                | Escape with no selection                           | no focus                  |
| any                    | mousedown outside the grid and outside a popover   | no focus, selection cleared |

### Selection

| From          | Trigger                             | To                                                            |
| ------------- | ----------------------------------- | ------------------------------------------------------------- |
| empty         | plain click                         | empty (focus only); `enableSingleCellSelection` → that one cell |
| any           | Ctrl/Cmd+click                      | that cell toggled in/out, range cleared                        |
| any           | Shift+click (focus exists)          | rectangle from `focusedCell` to the clicked cell               |
| any           | Shift+click (no focus)              | plain focus — there is no anchor to extend from                |
| any           | Shift+Arrow                         | rectangle from `range.start ?? focusedCell` to the moved edge   |
| any           | Ctrl/Cmd+Shift+Arrow                | rectangle extended to the row/column extremity (RTL-inverted)   |
| any           | Ctrl/Cmd+A                          | every cell of every row                                        |
| any           | header click + `enableColumnSelection` | every cell of that column                                   |
| any           | Escape / outside click / row delete | empty                                                          |
| any           | right-click an unselected cell      | just that cell, then the context menu opens                     |
| empty + drag  | mousedown → mouseenter → mouseup    | rectangle from the mousedown cell to the last entered cell      |

### Paste

```text
Ctrl+V ─▶ readOnly or !enablePaste ─▶ no-op
       └▶ read clipboard ─▶ parseTsv ─▶ rowsNeeded = startRow + pastedRows - rowCount
              ├ rowsNeeded > 0 and onRowAdd exists and not already confirmed
              │      └▶ pasteDialog = { open: true, rowsNeeded, clipboardText }   ── STOP
              └ otherwise
                   ├ expandRows → onRowsAdd(rowsNeeded) (or onRowAdd × n), await the row model
                   ├ per cell: coercePastedValue(raw, cellOpts) → value | SKIP
                   ├ append cut-source cells cleared to their empty value, clear cutCells
                   ├ onPaste(updates) → updateData(updates) → onDataChange(next)
                   ├ toast: "N cells pasted" / "N cells pasted, M skipped" / "M cells skipped…"
                   └ selectRange(start, end) over the pasted rectangle, restore focus
```

### Search

```text
Ctrl+F ─▶ open ─▶ type ─(150 ms debounce)─▶ search(query)
                                              ├ matches = every cell whose String(value) contains query (case-insensitive)
                                              ├ matchIndex = matches.length ? 0 : -1
                                              └ scrollToIndex(matches[0].rowIndex, { align: 'center' })
Enter        ─▶ matchIndex = (matchIndex + 1) % matches.length        ─▶ scroll + focus
Shift+Enter  ─▶ matchIndex = matchIndex - 1 < 0 ? last : matchIndex-1 ─▶ scroll + focus
Escape       ─▶ open = false, query = '', matches = [], matchIndex = -1,
                focusedCell = the last active match (if any), grid container focused
```

---

## 5. Invariants

1. `focusedCell.columnId ∈ navigableColumnIds` whenever `focusedCell !== null` and at least one
   navigable column exists.
2. `editingCell !== null` implies `focusedCell` equals it.
3. Navigation clamps: `0 ≤ rowIndex ≤ rows.length - 1`, `0 ≤ colIndex ≤ navigableColumnIds.length - 1`.
   Movement never wraps and never throws at a boundary.
4. `readOnly === true` implies no `editingCell`, no `CellUpdate` emitted, no row added or deleted,
   and no cut or paste — navigation, selection, copy and search remain fully available.
5. `selectedCells` only ever contains keys produced by `getCellKey`, so `parseCellKey` round-trips.
6. `rows.length === 0` makes select-all, Ctrl+End and paste-target computation no-ops, never errors.
7. `navigableColumnIds.length === 0` disables keyboard navigation entirely without erroring.
8. A rendered `virtualItem.index` always satisfies `0 ≤ index < rows.length`.
