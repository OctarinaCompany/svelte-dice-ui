# Contract: `data-table` public API

The interface this registry item exposes to consumers. Every entry is derived from the upstream files
listed in `plan.md` § Public API at the pinned commit. Divergence numbers refer to `plan.md`
§ Divergences.

Conventions for every component below:

- Props are declared in `<script lang="ts" module>` and exported as `DataTable<Part>Props`.
- Every part accepts `ref?: HTMLElement | null` (**bindable**, `$bindable(null)`, applied with
  `bind:this`), `class?: string` (merged **last** through `cn()`), and spreads `...restProps` onto the
  element named in its "Element" row.
- Every part carries `data-slot="data-table-<part>"`.
- Boolean data attributes are emitted `cond ? '' : undefined`.

---

## Module: `data-table.svelte.ts`

### `createDataTable<TData>(options: CreateDataTableOptions<TData>): DataTableState<TData>`

Replaces upstream `useDataTable`. Must be called during component initialisation.

```ts
import { createDataTable } from '$lib/components/ui/data-table/index.js';

const state = createDataTable({
	data: () => rows,
	columns: () => columns,
	getRowId: (row) => row.id,
	initialState: { sorting: [{ id: 'title', desc: true }], pagination: { pageSize: 10 } }
});
```

**Options** — see `plan.md` § Public API for the full table. Upstream options dropped with reason:
`queryKeys`, `history`, `debounceMs`, `throttleMs`, `clearOnDefault`, `scroll`, `shallow`,
`startTransition`, `enableAdvancedFilter` (Divergence 5).

**Returns `DataTableState<TData>`:**

| Member                                                                                                           | Kind                | Contract                                                                              |
| ---------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| `table`                                                                                                          | `readonly Table<TData>` | Stable identity for the lifetime of the instance; never re-created                 |
| `sorting`, `columnFilters`, `columnVisibility`, `rowSelection`, `pagination`, `columnPinning`, `columnOrder`      | read/write `$state.raw` | Assigning is the controlled path; assignment does **not** re-fire `on…Change`      |
| `rows`, `headerGroups`, `pageCount`, `selectedRowCount`, `filteredRowCount`, `isFiltered`                         | `readonly` `$derived`   | Convenience mirrors of the corresponding `table.*` calls                           |

### `setDataTableContext(state) / getDataTableContext()`

Symbol-keyed context (`Symbol('data-table')`). `DataTable` (Root) calls `setDataTableContext`.
`getDataTableContext()` throws when no provider is present:

> `` `<DataTable.Toolbar>` must be used within `<DataTable.Root>` or given a `table` prop. ``

Only `Toolbar`, `ViewOptions` and `Pagination` consult it, and only when their `table` prop is omitted
(Divergence 9).

---

## `DataTable` — Root (`data-table.svelte`)

**Element**: `<div>` — `class="flex w-full flex-col gap-2.5 overflow-auto"`.

| Prop        | Type              | Default | Bindable | Notes                                                        |
| ----------- | ----------------- | ------- | -------- | ------------------------------------------------------------ |
| `table`     | `Table<TData>`    | —       | no       | Required; also published to context                          |
| `actionBar` | `Snippet`         | —       | no       | Rendered **only** when `getFilteredSelectedRowModel().rows.length > 0` (FR-010) |
| `children`  | `Snippet`         | —       | no       | Rendered above the table — where the toolbar goes            |

**Renders**: `children` → bordered `Table.Root` (`Table.Header` with one `Table.Row` per header group,
`Table.Body` with one `Table.Row` per row) → `DataTablePagination` → `actionBar`.

| Emitted attribute                        | On                | Value                                                       |
| ---------------------------------------- | ----------------- | ----------------------------------------------------------- |
| `data-slot="data-table"`                 | root `div`        |                                                             |
| `data-state="selected"`                  | body `<tr>`       | when `row.getIsSelected()` (upstream `data-state`)          |
| `data-pinned="left" \| "right"`          | `<th>` / `<td>`   | from `column.getIsPinned()`                                 |
| `data-pinned-edge`                       | `<th>` / `<td>`   | `''` on the last left-pinned / first right-pinned column    |
| `style`                                  | `<th>` / `<td>`   | `getColumnPinningStyle({ column })`                         |
| `colspan`                                | `<th>`            | `header.colSpan`; placeholder headers render nothing        |

**Empty state**: when `getRowModel().rows.length === 0`, one `<tr>` with a single
`<td colspan={table.getAllColumns().length} class="h-24 text-center">No results.</td>` (FR-001,
Edge Case 5).

---

## `DataTableFlexRender` (`data-table-flex-render.svelte`)

No upstream file — the translation of React's `flexRender()` (Divergence 13).

| Prop       | Type                                                       | Default | Bindable |
| ---------- | ---------------------------------------------------------- | ------- | -------- |
| `template` | `string \| number \| Snippet<[TContext]> \| undefined`      | —       | no       |
| `context`  | `TContext`                                                 | —       | no       |
| `fallback` | `string`                                                   | `''`    | no       |

Renders nothing but its content — no wrapper element, no `data-slot`.

---

## `DataTableColumnHeader` (`data-table-column-header.svelte`)

**Element**: `DropdownMenu.Trigger` (a `<button>`), or a bare `<div>` in the non-interactive case.

| Prop     | Type                       | Default | Bindable | Notes                                                    |
| -------- | -------------------------- | ------- | -------- | -------------------------------------------------------- |
| `column` | `Column<TData, TValue>`    | —       | no       | Required                                                 |
| `label`  | `string`                   | —       | no       | Required. Upstream's type file says `title`; the source and the only call-site say `label` (Divergence 7) |

**Behaviour** (upstream, unchanged):

- `!getCanSort() && !getCanHide()` ⇒ renders `<div class={className}>{label}</div>` — no menu, no
  indicator (Edge Case 2).
- Otherwise a `DropdownMenu` whose trigger shows `label` plus `ChevronUp` (asc) / `ChevronDown` (desc) /
  `ChevronsUpDown` (unsorted), and whose content (`align="start"`, `w-28`) holds:
  - if `getCanSort()`: **Asc** and **Desc** as `DropdownMenu.CheckboxItem`s
    (`checked={getIsSorted() === 'asc' | 'desc'}`), and — only while `getIsSorted()` is truthy — a
    **Reset** `DropdownMenu.Item` calling `clearSorting()` (FR-002).
  - if `getCanHide()`: a **Hide** `DropdownMenu.CheckboxItem` (`checked={!getIsVisible()}`) calling
    `toggleVisibility(false)` (FR-003).

| Emitted attribute                     | Value                                      |
| ------------------------------------- | ------------------------------------------ |
| `data-slot="data-table-column-header"`|                                            |
| `data-sorted`                         | `'asc' \| 'desc'`, absent when unsorted     |
| `data-state="open"`                   | from `DropdownMenu.Trigger`                 |

---

## `DataTableToolbar` (`data-table-toolbar.svelte`)

**Element**: `<div role="toolbar" aria-orientation="horizontal">` —
`class="flex w-full items-start justify-between gap-2 p-1"`.

| Prop       | Type              | Default        | Bindable | Notes                                    |
| ---------- | ----------------- | -------------- | -------- | ---------------------------------------- |
| `table`    | `Table<TData>`    | from context   | no       | Divergence 9                             |
| `children` | `Snippet`         | —              | no       | Rendered on the right, before `ViewOptions` |

**Renders**: one `DataTableToolbarFilter` per column with `getCanFilter()`; then — only while
`table.getState().columnFilters.length > 0` — a `Button variant="outline" size="sm"` with
`aria-label="Reset filters"` and an `X` icon calling `table.resetColumnFilters()` (FR-004); then
`children`; then `<DataTableViewOptions table={table} align="end" />`.

| Emitted attribute                | Value                                              |
| -------------------------------- | -------------------------------------------------- |
| `data-slot="data-table-toolbar"` |                                                    |
| `data-filtered`                  | `''` when at least one column filter is active     |

---

## `DataTableToolbarFilter` (`data-table-toolbar-filter.svelte`)

Upstream's module-private `DataTableToolbarFilter`, promoted to a file and exported (Divergence 10).

| Prop     | Type              | Default | Bindable |
| -------- | ----------------- | ------- | -------- |
| `column` | `Column<TData>`   | —       | no       |

Switches on `column.columnDef.meta?.variant`; **renders nothing when the variant is absent** or is
`boolean` (Edge Case 1):

| Variant                | Renders                                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`                 | `Input` `class="h-8 w-40 lg:w-56"`, `placeholder = meta.placeholder ?? meta.label`, value ← `column.getFilterValue()`, `oninput → setFilterValue` |
| `number`               | `Input type="number" inputmode="numeric"` `class="h-8 w-[120px]"` (+`pr-8` with a unit); the unit renders in an absolutely-positioned `bg-accent` span (FR-005) |
| `range`                | `<DataTableSliderFilter column title={meta.label ?? column.id} />`                                                                               |
| `date` / `dateRange`   | `<DataTableDateFilter column title multiple={variant === 'dateRange'} />`                                                                        |
| `select` / `multiSelect` | `<DataTableFacetedFilter column title options={meta.options ?? []} multiple={variant === 'multiSelect'} />`                                    |

---

## `DataTableFacetedFilter` (`data-table-faceted-filter.svelte`)

**Element**: `Popover.Root` → `Popover.Trigger` (`Button variant="outline" size="sm"`, dashed border) →
`Popover.Content` (`w-50 p-0`, `align="start"`) containing `Command`.

| Prop           | Type                        | Default | Bindable | Notes                                       |
| -------------- | --------------------------- | ------- | -------- | ------------------------------------------- |
| `column`       | `Column<TData, TValue>`     | —       | no       | Optional upstream; renders inert without it |
| `title`        | `string`                    | —       | no       |                                             |
| `options`      | `Option[]`                  | —       | no       | Required                                    |
| `multiple`     | `boolean`                   | `false` | no       |                                             |
| `open`         | `boolean`                   | `false` | **yes**  | Divergence 8                                |
| `onOpenChange` | `(open: boolean) => void`   | —       | no       |                                             |

**Trigger content**: `XCircle` inside a `role="button" tabindex="0"` clear affordance with
`aria-label={`Clear ${title} filter`}` when anything is selected, else `PlusCircle`; then `title`; then,
when selected, a vertical `Separator`, a count `Badge` (`lg:hidden`), and either one `Badge` per selected
option (≤ 2) or a single `` `${n} selected` `` badge (≥ 3) (FR-008, Edge Case 4).

**Content**: `Command.Input placeholder={title}`, `Command.Empty` "No results found.", one
`Command.Item` per option (check box glyph, optional `option.icon`, truncated label, right-aligned
`option.count` when truthy), and — when anything is selected — a `Command.Separator` plus a centred
"Clear filters" item.

**Selection**: `multiple` ⇒ toggle membership, `setFilterValue(values.length ? values : undefined)`.
Single ⇒ `setFilterValue(isSelected ? undefined : [option.value])` and close the popover.

| Emitted attribute                        | Value                            |
| ---------------------------------------- | -------------------------------- |
| `data-slot="data-table-faceted-filter"`  | on the trigger                   |
| `data-multiple`                          | `''` when `multiple`             |
| `data-selected`                          | `''` when the selection is non-empty |
| `data-state="open" \| "closed"`          | from `Popover.Trigger`           |

---

## `DataTableDateFilter` (`data-table-date-filter.svelte`)

**Element**: `Popover.Root` → dashed `Button` trigger → `Popover.Content` (`w-auto p-0`,
`align="start"`) containing `Calendar`.

| Prop           | Type                       | Default | Bindable |
| -------------- | -------------------------- | ------- | -------- |
| `column`       | `Column<TData, unknown>`   | —       | no       |
| `title`        | `string`                   | —       | no       |
| `multiple`     | `boolean`                  | `false` | no       |
| `open`         | `boolean`                  | `false` | **yes**  |
| `onOpenChange` | `(open: boolean) => void`  | —       | no       |

**Filter value** (unchanged from upstream, Divergence 11): single ⇒ `number` (epoch ms);
`multiple` ⇒ `[from?, to?]` epoch-ms tuple, or `undefined` when both are empty.

**Trigger**: `XCircle` clear affordance (`aria-label={`Clear ${title} filter`}`) when a value exists,
else `CalendarIcon`; then `title`; then, when a value exists, a vertical `Separator` and the formatted
date — `formatDate(d)` in single mode, `` `${formatDate(from)} - ${formatDate(to)}` `` in range mode,
falling back to the single present endpoint. Placeholder text is "Select date" / "Select date range"
(FR-007).

**Calendar**: `type="single"` or `type="range"`, `captionLayout="dropdown"`, `autofocus` in range mode.

| Emitted attribute                     | Value                                   |
| ------------------------------------- | --------------------------------------- |
| `data-slot="data-table-date-filter"`  | on the trigger                          |
| `data-multiple`                       | `''` when `multiple`                    |
| `data-selected`                       | `''` when a date/range is set           |

---

## `DataTableSliderFilter` (`data-table-slider-filter.svelte`)

**Element**: `Popover.Root` → dashed `Button` trigger → `Popover.Content`
(`flex w-auto flex-col gap-4`, `align="start"`).

| Prop           | Type                       | Default | Bindable |
| -------------- | -------------------------- | ------- | -------- |
| `column`       | `Column<TData, unknown>`   | —       | no       |
| `title`        | `string`                   | —       | no       |
| `open`         | `boolean`                  | `false` | **yes**  |
| `onOpenChange` | `(open: boolean) => void`  | —       | no       |

**Bounds** (FR-006): `meta.range` when it is a valid `[min, max]`, otherwise
`column.getFacetedMinMaxValues()`, otherwise `[0, 100]`. Step buckets are upstream's:
`size ≤ 20 → 1`, `size ≤ 100 → ceil(size / 20)`, else `ceil(size / 50)`.

**Content**: the title; a `From` and a `to` numeric `Input` (both `sr-only`-labelled, `min`/`max`/
`aria-valuemin`/`aria-valuemax` set, unit suffix rendered in a `bg-accent` span when `meta.unit`); a
two-thumb bits-ui `Slider` with an `sr-only` label `` `${title} slider` ``; and a full-width
`Button variant="outline" size="sm"` with `aria-label={`Clear ${title} filter`}` reading "Clear".

**Guard rail** (Edge Case 9): the `from` input only commits when
`value >= min && value <= range[1]`; the `to` input only when `value <= max && value >= range[0]`;
out-of-range input is ignored rather than producing an inverted range.

**Filter value**: `[number, number]`, or `undefined` after Clear.

| Emitted attribute                       | Value                            |
| --------------------------------------- | -------------------------------- |
| `data-slot="data-table-slider-filter"`  | on the trigger                   |
| `data-selected`                         | `''` when a range is set         |

---

## `DataTableViewOptions` (`data-table-view-options.svelte`)

**Element**: `Popover.Root` → `Popover.Trigger` (`Button variant="outline" size="sm"`,
`role="combobox"`, `aria-label="Toggle columns"`, `Settings2` icon + "View",
`class="ml-auto hidden h-8 font-normal lg:flex"`) → `Popover.Content` (`w-44 p-0`) containing `Command`.

| Prop           | Type                                | Default | Bindable | Notes                          |
| -------------- | ----------------------------------- | ------- | -------- | ------------------------------ |
| `table`        | `Table<TData>`                      | context | no       | Divergence 9                   |
| `disabled`     | `boolean`                           | `false` | no       | Disables the trigger           |
| `reorderable`  | `boolean`                           | `false` | no       | Divergence 12 / research D-07  |
| `open`         | `boolean`                           | `false` | **yes**  |                                |
| `align`        | `'start' \| 'center' \| 'end'`      | `'end'` | no       | Plus every other `Popover.Content` prop via rest |
| `onOpenChange` | `(open: boolean) => void`           | —       | no       |                                |

**List**: columns with `typeof column.accessorFn !== 'undefined' && column.getCanHide()`;
`Command.Input placeholder="Search columns..."`, `Command.Empty` "No columns found.", one
`Command.Item` per column showing `meta.label ?? column.id` plus a `Check` icon at
`opacity-100`/`opacity-0`, selecting ⇒ `column.toggleVisibility(!column.getIsVisible())` (FR-003).

When `reorderable`, the list is wrapped in `Sortable`/`SortableContent`/`SortableItem` +
`SortableItemHandle`, and reordering calls `table.setColumnOrder(next)`.

| Emitted attribute                      | Value                        |
| -------------------------------------- | ---------------------------- |
| `data-slot="data-table-view-options"`  | on the trigger               |
| `data-reorderable`                     | `''` when `reorderable`      |

---

## `DataTablePagination` (`data-table-pagination.svelte`)

**Element**: `<div class="flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8">`.

| Prop              | Type              | Default                | Bindable |
| ----------------- | ----------------- | ---------------------- | -------- |
| `table`           | `Table<TData>`    | context                | no       |
| `pageSizeOptions` | `number[]`        | `[10, 20, 30, 40, 50]` | no       |

**Renders** (FR-009, FR-011):

1. `` `${selectedRowCount} of ${filteredRowCount} row(s) selected.` ``
2. "Rows per page" + a `Select` bound to `pagination.pageSize` (`side="top"`, one `Select.Item` per
   `pageSizeOptions` entry, inside a `Select.Group`).
3. `` `Page ${pageIndex + 1} of ${getPageCount()}` ``
4. Four icon `Button variant="outline" size="icon"`s with `aria-label`s "Go to first page",
   "Go to previous page", "Go to next page", "Go to last page"; first/previous `disabled` when
   `!getCanPreviousPage()`, next/last when `!getCanNextPage()`. First and last are `hidden lg:flex`.

**RTL** (research D-09): chevron icons mirror under `dir="rtl"`; labels, DOM order and disabled logic do
not change.

| Emitted attribute                     | Value                      |
| ------------------------------------- | -------------------------- |
| `data-slot="data-table-pagination"`   |                            |
| `data-dir`                            | `'ltr' \| 'rtl'`           |

---

## `DataTableSkeleton` (`data-table-skeleton.svelte`)

**Element**: `<div class="flex w-full flex-col gap-2.5 overflow-auto">`. Purely presentational — no
interactive controls, no event handlers (FR-013).

| Prop              | Type       | Default    | Bindable |
| ----------------- | ---------- | ---------- | -------- |
| `columnCount`     | `number`   | —          | no       |
| `rowCount`        | `number`   | `10`       | no       |
| `filterCount`     | `number`   | `0`        | no       |
| `cellWidths`      | `string[]` | `['auto']` | no       |
| `withViewOptions` | `boolean`  | `true`     | no       |
| `withPagination`  | `boolean`  | `true`     | no       |
| `shrinkZero`      | `boolean`  | `false`    | no       |

Cell widths cycle `cellWidths[index % cellWidths.length] ?? 'auto'`; `shrinkZero` sets `min-width` to the
same value instead of `auto`.

| Emitted attribute                    | Value                     |
| ------------------------------------ | ------------------------- |
| `data-slot="data-table-skeleton"`    |                           |
| `data-loading`                       | `''` (always)             |

---

## Barrel (`index.ts`)

```ts
export {
	Root, FlexRender, ColumnHeader, Toolbar, ToolbarFilter, FacetedFilter, DateFilter,
	SliderFilter, ViewOptions, Pagination, Skeleton,
	//
	Root as DataTable,
	FlexRender as DataTableFlexRender,
	ColumnHeader as DataTableColumnHeader,
	Toolbar as DataTableToolbar,
	ToolbarFilter as DataTableToolbarFilter,
	FacetedFilter as DataTableFacetedFilter,
	DateFilter as DataTableDateFilter,
	SliderFilter as DataTableSliderFilter,
	ViewOptions as DataTableViewOptions,
	Pagination as DataTablePagination,
	Skeleton as DataTableSkeleton
};
```

plus the value/type exports listed in `plan.md` § "Types, values and helpers exported from the barrel".
Both import styles must work:

```ts
import * as DataTable from '$lib/components/ui/data-table/index.js'; // DataTable.Root, DataTable.Toolbar
import { DataTable, DataTableToolbar } from '$lib/components/ui/data-table/index.js';
```

---

## Registry entry (`registry.json`)

```jsonc
{
	"name": "data-table",
	"type": "registry:ui",
	"title": "Data Table",
	"description": "A powerful and flexible data table for displaying, filtering, sorting, and paginating tabular data.",
	"registryDependencies": [
		"badge", "button", "calendar", "checkbox", "command", "dropdown-menu", "input", "label",
		"popover", "select", "separator", "skeleton", "table", "sortable", "direction-provider"
	],
	"dependencies": ["@tanstack/table-core", "bits-ui", "@internationalized/date"],
	"files": [/* every file in the folder except data-table.test.ts and data-table.test.svelte */]
}
```

`pnpm run registry:build` is run afterwards; output lands in `static/r/`.
