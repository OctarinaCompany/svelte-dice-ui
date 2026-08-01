# Contract: Public API

The exhaustive surface of `src/lib/components/ui/data-grid/index.ts`. Anything not listed here is
private to the folder. Prop tables give **name · type · default · bindable**; snippets and callbacks
are listed per component. `TData extends RowData` everywhere.

Consumers import either way:

```ts
import * as DataGrid from '$lib/components/ui/data-grid/index.js'; // DataGrid.Root, DataGrid.Cell
import { DataGrid, DataGridRow, createDataGrid } from '$lib/components/ui/data-grid/index.js';
```

---

## `createDataGrid<TData>(options): DataGridState<TData>`

Upstream: `useDataGrid`. Must be called during component initialisation.

### `CreateDataGridOptions<TData>`

| Name                        | Type                                                                                                       | Default   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- | --------- |
| `data`                      | `TData[] \| (() => TData[])`                                                                               | required  |
| `columns`                   | `DataGridColumnDef<TData>[] \| (() => DataGridColumnDef<TData>[])`                                          | required  |
| `getRowId`                  | `(row: TData, index: number, parent?: Row<TData>) => string`                                                | —         |
| `defaultColumn`             | `Partial<ColumnDef<TData>>`                                                                                 | `{ minSize: 60, maxSize: 800 }` |
| `initialState`              | `DataGridInitialState`                                                                                      | —         |
| `state`                     | `Partial<TableState> \| (() => Partial<TableState>)`                                                        | —         |
| `onDataChange`              | `(data: TData[]) => void`                                                                                   | —         |
| `onRowAdd`                  | `(event?: MouseEvent) => Partial<CellPosition> \| Promise<Partial<CellPosition> \| null> \| null \| void`    | —         |
| `onRowsAdd`                 | `(count: number) => void \| Promise<void>`                                                                  | —         |
| `onRowsDelete`              | `(rows: TData[], rowIndices: number[]) => void \| Promise<void>`                                            | —         |
| `onPaste`                   | `(updates: CellUpdate[]) => void \| Promise<void>`                                                          | —         |
| `onFilesUpload`             | `(params: { files: File[]; rowIndex: number; columnId: string }) => Promise<FileCellData[]>`                 | —         |
| `onFilesDelete`             | `(params: { fileIds: string[]; rowIndex: number; columnId: string }) => void \| Promise<void>`               | —         |
| `onSortingChange`           | `(sorting: SortingState) => void`                                                                           | —         |
| `onColumnFiltersChange`     | `(filters: ColumnFiltersState) => void`                                                                     | —         |
| `onRowSelectionChange`      | `(rowSelection: RowSelectionState) => void`                                                                 | —         |
| `onRowHeightChange`         | `(rowHeight: RowHeightValue) => void`                                                                       | —         |
| `rowHeight`                 | `RowHeightValue`                                                                                            | `'short'` |
| `overscan`                  | `number`                                                                                                    | `6`       |
| `dir`                       | `Direction`                                                                                                 | ambient   |
| `autoFocus`                 | `boolean \| Partial<CellPosition>`                                                                          | `false`   |
| `enableSingleCellSelection` | `boolean`                                                                                                   | `false`   |
| `enableColumnSelection`     | `boolean`                                                                                                   | `false`   |
| `enableSearch`              | `boolean`                                                                                                   | `false`   |
| `enablePaste`               | `boolean`                                                                                                   | `false`   |
| `readOnly`                  | `boolean`                                                                                                   | `false`   |

### `DataGridState<TData>` — readable fields

`table`, `rows`, `columnIds`, `navigableColumnIds`, `columnSizeVars`, `cellSelectionMap`,
`dir`, `readOnly`, `rowHeight`, `focusedCell`, `editingCell`, `contextMenu`,
`selection`, `clipboard`, `search` (`undefined` unless `enableSearch`), `virtualizer`.

### `DataGridState<TData>` — methods

| Method                                            | Returns              | Notes                                                    |
| ------------------------------------------------- | -------------------- | -------------------------------------------------------- |
| `focusCell(rowIndex, columnId)`                   | `void`               | sets focus, clears editing, focuses the DOM cell          |
| `blurCell()`                                      | `void`               | clears focus and editing                                 |
| `navigateCell(direction: NavigationDirection)`    | `void`               | clamped, RTL-aware, scrolls into view                    |
| `startEditing(rowIndex, columnId)`                | `void`               | no-op when `readOnly`                                    |
| `stopEditing(opts?: { moveToNextRow?; direction? })` | `void`            | commit is the caller's job; this only moves focus        |
| `updateData(updates: CellUpdate \| CellUpdate[])` | `void`               | one `onDataChange` per call                              |
| `clearCells(cellKeys: string[])`                  | `void`               | writes each variant's empty value                        |
| `addRow(event?)`                                  | `Promise<void>`      | awaits `onRowAdd`, then scrolls/focuses its return       |
| `deleteRows(rowIndices: number[])`                | `Promise<void>`      | awaits `onRowsDelete`, then re-focuses                   |
| `setRowHeight(value)`                             | `void`               | fires `onRowHeightChange`                                |
| `selectRow(rowId, selected, shiftKey)`            | `void`               | shift-click range across rows                            |
| `selectColumn(columnId)`                          | `void`               | honours `enableColumnSelection`                          |
| `handleKeydown(event: KeyboardEvent)`             | `void`               | the whole grid key contract                              |
| `registerCell(rowIndex, columnId, el \| null)`    | `void`               | DOM registry for focus/scroll                            |
| `registerRow(rowIndex, el \| null)`               | `void`               | DOM registry                                             |
| `getIsCellSelected(rowIndex, columnId)`           | `boolean`            |                                                          |
| `getIsSearchMatch(rowIndex, columnId)`            | `boolean`            |                                                          |
| `getIsActiveSearchMatch(rowIndex, columnId)`      | `boolean`            |                                                          |
| `getVisualRowIndex(rowId)`                        | `number \| undefined`|                                                          |

---

## Components

Common to every component: `ref` is `$bindable(null)` and applied with `bind:this`; `class` is
merged last through `cn()`; `...restProps` is spread onto the rendered element; each carries its
`data-slot`.

### `Root` / `DataGrid` — `data-grid.svelte`

`data-slot="data-grid-wrapper"` on the outer div, `data-slot="data-grid"` on `role="grid"`.

| Prop             | Type                             | Default    | Bindable |
| ---------------- | -------------------------------- | ---------- | -------- |
| `grid`           | `DataGridState<TData>`           | required   | no       |
| `dir`            | `Direction`                      | `grid.dir` | no       |
| `height`         | `number`                         | `600`      | no       |
| `stretchColumns` | `boolean`                        | `false`    | no       |
| `ref`            | `HTMLDivElement \| null`         | `null`     | **yes**  |
| `class`          | `string`                         | —          | no       |
| …rest            | `HTMLAttributes<HTMLDivElement>` | —          | no       |

Snippets: `children?: Snippet`; `row?: Snippet<[{ row: Row<TData>; rowIndex: number; top: number }]>`;
`empty?: Snippet`.

ARIA: `role="grid"`, `aria-label="Data grid"`, `aria-rowcount={rows.length + (onRowAdd ? 1 : 0)}`,
`aria-colcount={columns.length}`, `tabindex="0"`. Header `role="rowgroup"` (sticky), body
`role="rowgroup"`, footer `role="rowgroup"` with a `role="gridcell" tabindex="0"` "Add row" cell
rendered only when `onRowAdd` was provided and `readOnly` is false.

### `Row` / `DataGridRow` — `data-slot="data-grid-row"`

`grid?`, `row: Row<TData>`, `rowIndex: number`, `top: number`, `ref` (bindable), `class`, …rest.
Snippet: `cell?: Snippet<[{ cell: Cell<TData, unknown>; colIndex: number }]>`.
ARIA: `role="row"`, `aria-rowindex={rowIndex + 2}`, `aria-selected={row.getIsSelected()}`,
`data-index={rowIndex}`. Each cell container is `role="gridcell"` with `aria-colindex={colIndex + 1}`
and `data-slot="data-grid-cell-container"`.

### `Cell` / `DataGridCell` — `grid?`, `cell`, `rowIndex`, `columnId`

Routes on `cell.column.columnDef.meta?.cell?.variant`; unknown/absent → short text.

### `CellWrapper` / `DataGridCellWrapper` — `data-slot="data-grid-cell-wrapper"`

`grid?`, `cell`, `rowIndex`, `columnId`, `rowHeight`, `isEditing`, `isFocused`, `isSelected`,
`isSearchMatch`, `isActiveSearchMatch`, `readOnly`, `ref` (bindable), `class`, `onclick?`,
`onkeydown?`, …rest, `children?: Snippet`.

`role="button"`, `tabindex={isFocused && !isEditing ? 0 : -1}`. Data attributes (all
`cond ? '' : undefined`): `data-editing`, `data-focused`, `data-selected`, `data-search-match`,
`data-active-search-match`, `data-cut`, `data-readonly`.

### Cell variants — `DataGridCellProps<TData>`

`ShortTextCell`, `LongTextCell`, `NumberCell`, `UrlCell`, `CheckboxCell`, `SelectCell`,
`MultiSelectCell`, `DateCell`, `FileCell`. Props: `grid?`, `cell`, `rowIndex`, `columnId`,
`rowHeight`, `isEditing` (absent on `CheckboxCell`), `isFocused`, `isSelected`, `isSearchMatch`,
`isActiveSearchMatch`, `readOnly`. `data-slot="data-grid-<variant>-cell"`; the resting content
carries `data-slot="data-grid-cell-content"` so the line-clamp selectors work.

### `ColumnHeader` / `DataGridColumnHeader` — `grid?`, `header`, `class`, …rest

Menu items: Sort asc, Sort desc, Remove sort (when sorted) — only if `column.getCanSort()`;
Pin/Unpin to left, Pin/Unpin to right — only if `column.getCanPin()`; Hide column — only if
`column.getCanHide()`.

### `ColumnResizer` / `DataGridColumnResizer` — `header`, `label`

`role="separator"`, `aria-orientation="vertical"`, `aria-label={`Resize ${label} column`}`,
`aria-valuenow/min/max`, `tabindex="0"`. Double-click resets the size.

### `ContextMenu` / `DataGridContextMenu` — `grid?`

Copy · Cut (disabled when `readOnly`) · Clear (disabled when `readOnly`) · separator + Delete rows
(rendered only when `onRowsDelete` was provided). Anchored at the stored `(x, y)` through a
1×1 invisible fixed-position trigger, matching upstream.

### `PasteDialog` / `DataGridPasteDialog` — `grid?`

Title "Do you want to add more rows?"; description naming `rowsNeeded`; radio group "Create new
rows" (default checked) / "Keep current rows"; Cancel and Continue.

### `Search` / `DataGridSearch` — `search?: DataGridSearchState`, `class`, …rest

`role="search"`. Input `placeholder="Find in table..."`, 150 ms debounce; buttons labelled
"Previous match", "Next match", "Close search" (Previous/Next disabled when there are no matches);
status text `{matchIndex + 1} of {matches.length}` / `No results` / `Type to search`.

### `KeyboardShortcuts` / `DataGridKeyboardShortcuts`

| Prop               | Type                      | Default | Bindable |
| ------------------ | ------------------------- | ------- | -------- |
| `open`             | `boolean`                 | —       | **yes**  |
| `defaultOpen`      | `boolean`                 | `false` | no       |
| `onOpenChange`     | `(open: boolean) => void` | —       | no       |
| `enableSearch`     | `boolean`                 | `false` | no       |
| `enableUndoRedo`   | `boolean`                 | `false` | no       |
| `enablePaste`      | `boolean`                 | `false` | no       |
| `enableRowAdd`     | `boolean`                 | `false` | no       |
| `enableRowsDelete` | `boolean`                 | `false` | no       |

Groups: Navigation, Selection, Editing, Search (`enableSearch`), Sorting, General; the flag-gated
groups/rows are omitted when their flag is false. Its own input filters by description or key text.

### `ShortcutCard` / `DataGridShortcutCard` — `keys: string[]`, `description: string`

---

## Pure utilities (`data-grid-utils.ts`)

| Function                                                     | Signature summary                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| `getCellKey(rowIndex, columnId)`                             | `` `${rowIndex}:${columnId}` ``                                       |
| `parseCellKey(key)`                                          | `Required<CellPosition>`; malformed → `{ rowIndex: 0, columnId: '' }` |
| `parseTsv(text, fallbackColumnCount)`                        | `string[][]`; honours quoted fields with embedded tabs/newlines       |
| `serializeCellsToTsv({ cellKeys, rows, getCellOpts })`       | `{ tsv: string; cellKeys: string[] } \| null`, row-major              |
| `coercePastedValue(raw, cellOpts)`                           | `{ value: unknown } \| { skip: true }`                                |
| `getEmptyCellValue(variant)`                                 | `'' \| null \| false \| []`                                           |
| `getRowHeightValue(rowHeight)` / `getLineCount(rowHeight)`   | `number`                                                              |
| `matchSelectOption(value, options)`                          | `string \| undefined` (exact, then case-insensitive value, then label) |
| `getIsFileCellData(item)`                                    | type guard                                                            |
| `getIsInPopover(element)`                                    | `boolean` — cell editor / popover / dropdown content                  |
| `getUrlHref(url)`                                            | `''` for `javascript:` / `data:` / `vbscript:` / `file:`; adds `http://` |
| `parseLocalDate(value)` / `formatDateToString(date)` / `formatDateForDisplay(value)` | date round-trip without timezone drift        |
| `formatFileSize(bytes)` / `getFileIcon(type)`                | file-cell display                                                     |
| `getColumnVariant(variant)`                                  | `{ icon, label } \| null` for the header                              |
| `getColumnPinningStyle({ column, dir, withBorder })`         | inline style string; swaps `left`/`right` under RTL                   |
| `getColumnBorderVisibility({ column, nextColumn, isLastColumn })` | `{ showStartBorder, showEndBorder }`                             |
| `getScrollDirection(direction)`                              | `'left' \| 'right' \| 'home' \| 'end' \| undefined`                   |
| `scrollCellIntoView(params)`                                 | horizontal scroll accounting for pinned-column widths and RTL         |
| `NON_NAVIGABLE_COLUMN_IDS`                                   | `ReadonlySet<string>` = `{ 'select', 'actions' }`                     |

---

## Context

`setDataGridContext(state)` · `getDataGridContext<TData>()` · `hasDataGridContext()`, behind
`Symbol('data-grid')`. `getDataGridContext()` throws:

```text
`<DataGrid.Row>` must be used within `<DataGrid.Root>`.
```

with the calling part's name substituted. Every part that reads context throws this documented
error, and that throw is asserted in the test suite.

---

## Registry entry

```jsonc
{
  "name": "data-grid",
  "type": "registry:ui",
  "title": "Data Grid",
  "description": "A high-performance editable data grid with virtualization, keyboard navigation, cell selection, clipboard support and nine cell variants.",
  "registryDependencies": [
    "badge", "badge-overflow", "button", "calendar", "checkbox", "command", "dialog",
    "direction-provider", "dropdown-menu", "file-upload", "input", "popover", "select",
    "separator", "skeleton", "sonner", "textarea", "tooltip"
  ],
  "dependencies": ["@tanstack/table-core", "bits-ui", "@internationalized/date", "svelte-sonner"],
  "files": [ /* every file in the folder except data-grid.test.ts and data-grid.test.svelte */ ]
}
```
