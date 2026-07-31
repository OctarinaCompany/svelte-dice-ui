# Phase 1 Data Model: Data Table

Entities are the four named in `spec.md` § Key Entities, expressed as the TypeScript shapes the port
exposes. All of them are declared in `src/lib/components/ui/data-table/types.ts` unless noted, and
re-exported from the barrel.

---

## 1. Column definition — `DataTableColumnDef<TData, TValue>`

Upstream: the `ColumnDef` object shown in `data-table.mdx` § API Reference § Column Definitions, plus the
`ColumnMeta` module augmentation in `docs/types/data-table.ts`.

Base type is `@tanstack/table-core`'s `ColumnDef<TData, TValue>` with the two template fields narrowed
so Svelte snippets are the render mechanism (research D-03):

| Field                | Type                                                         | Required | Notes                                                                  |
| -------------------- | ------------------------------------------------------------ | -------- | ---------------------------------------------------------------------- |
| `id`                 | `string`                                                     | yes¹     | Also the filter key; upstream documents it as required                 |
| `accessorKey`        | `keyof TData & string`                                       | yes¹     | Or `accessorFn`                                                        |
| `accessorFn`         | `(row: TData, index: number) => TValue`                      | no       | For nested data                                                        |
| `header`             | `string \| number \| Snippet<[HeaderContext<TData, TValue>]>`| no       | Absent ⇒ `DataTableFlexRender` falls back to `column.id`               |
| `cell`               | `string \| number \| Snippet<[CellContext<TData, TValue>]>`  | no       | Absent ⇒ falls back to the stringified cell value                      |
| `meta`               | `ColumnMeta<TData, TValue>` (below)                          | no       |                                                                        |
| `enableColumnFilter` | `boolean`                                                    | no       | `@default false` — set by `createDataTable`'s `defaultColumn`          |
| `enableSorting`      | `boolean`                                                    | no       | `@default true` (table-core)                                           |
| `enableHiding`       | `boolean`                                                    | no       | `@default true` (table-core)                                           |
| `size`               | `number`                                                     | no       | Used by `getColumnPinningStyle` for the pinned cell width              |

¹ "Required" per the upstream docs; `table-core` derives `id` from `accessorKey` when omitted, so the
type keeps table-core's own optionality and the docs page states the convention.

### `ColumnMeta<TData, TValue>` — module augmentation of `@tanstack/table-core`

Ported field-for-field from `docs/types/data-table.ts`:

| Field         | Type                              | Consumed by                                                              |
| ------------- | --------------------------------- | ------------------------------------------------------------------------ |
| `label`       | `string`                          | Column header label, filter titles, the View list, `data-table-toolbar`  |
| `placeholder` | `string`                          | Text/number filter placeholder (falls back to `label`)                   |
| `variant`     | `FilterVariant`                   | Chooses which filter control the toolbar renders; absent ⇒ **no control** |
| `options`     | `Option[]`                        | `select` / `multiSelect` variants                                        |
| `range`       | `[number, number]`                | `range` variant — overrides the faceted min/max                          |
| `unit`        | `string`                          | `number` and `range` variants — suffix rendered inside the control       |
| `icon`        | `Component<SVGAttributes<SVGSVGElement>>` | Column icon (upstream `React.FC<React.SVGProps<SVGSVGElement>>`)   |

### `TableMeta<TData>` — module augmentation

Upstream carries `queryKeys?: QueryKeys` for nuqs. `QueryKeys` is **retained as an exported type** for
API-shape parity and for the out-of-scope advanced components, but nothing in this port reads it (spec
Assumption 2).

### Validation rules (from the spec)

- No `meta.variant` **and** no `enableColumnFilter` ⇒ the toolbar renders nothing for the column and the
  column does not count toward "Reset filters" visibility (Edge Case 1).
- `enableSorting: false` **and** `enableHiding: false` ⇒ `DataTableColumnHeader` renders plain content,
  no menu, no sort indicator, and the column is absent from the View list (Edge Case 2).
- The View list only includes columns with a defined `accessorFn` **and** `getCanHide()` — upstream's
  filter, which is what excludes the `select` and `actions` columns.

---

## 2. Table instance — `Table<TData>` (owned by `DataTableState<TData>`)

Upstream: the object returned by `useReactTable`. Here it is created once by `createDataTable` and
exposed as `DataTableState.table` (research D-02). It is **read and written by every subcomponent** and
is the single carrier of FR-015.

### State slices (all `$state.raw`, all read/write on `DataTableState`)

| Slice              | Type                     | Seeded from                                    | Mutated by                                                   |
| ------------------ | ------------------------ | ---------------------------------------------- | ------------------------------------------------------------ |
| `sorting`          | `SortingState`           | `initialState.sorting` (`ExtendedColumnSort[]`) | Column header Asc/Desc/Reset                                 |
| `columnFilters`    | `ColumnFiltersState`     | `initialState.columnFilters`                    | Every filter control; cleared by toolbar "Reset"             |
| `columnVisibility` | `VisibilityState`        | `initialState.columnVisibility`                 | Header "Hide", View list                                     |
| `rowSelection`     | `RowSelectionState`      | `initialState.rowSelection`                     | Row / select-all checkboxes; keyed by row id, not by position |
| `pagination`       | `PaginationState`        | `initialState.pagination` (`pageSize` `@default 10`) | Page buttons, page-size select                          |
| `columnPinning`    | `ColumnPinningState`     | `initialState.columnPinning`                    | Consumer (no built-in pin UI upstream)                       |
| `columnOrder`      | `ColumnOrderState`       | `initialState.columnOrder`                      | `ViewOptions` when `reorderable` (research D-07)             |

### Derived read model (all `$derived` on `DataTableState`)

`rows` (`table.getRowModel().rows`), `headerGroups`, `pageCount`, `selectedRowCount`
(`getFilteredSelectedRowModel().rows.length`), `filteredRowCount` (`getFilteredRowModel().rows.length`),
`isFiltered` (`columnFilters.length > 0`).

### State transitions

| Trigger                                     | Transition                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Header menu **Asc**                         | `sorting → [{ id, desc: false }]` (`column.toggleSorting(false)`)                                       |
| Header menu **Desc**                        | `sorting → [{ id, desc: true }]`                                                                        |
| Header menu **Reset** (shown only if sorted) | `sorting → []` for that column (`column.clearSorting()`); a no-op when nothing is applied (Edge Case 3) |
| Header menu **Hide**                        | `columnVisibility[id] → false`                                                                          |
| Any filter control change                   | `columnFilters` gains/updates/removes `{ id, value }`; `value === undefined` removes the entry          |
| Toolbar **Reset**                           | `columnFilters → []` (`table.resetColumnFilters()`); the control is hidden while `columnFilters` is empty |
| Page button                                 | `pagination.pageIndex → 0 \| n±1 \| pageCount-1`; first/prev disabled at index 0, next/last at the last page |
| Page-size select                            | `pagination.pageSize → n`; table-core clamps `pageIndex` to the new last page (Edge Case 6)             |
| Row checkbox                                | `rowSelection[rowId] → true \| absent`                                                                  |
| Select-all checkbox                         | `toggleAllPageRowsSelected(v)` — indeterminate while `getIsSomePageRowsSelected()`                      |
| Filter narrowing the row set                | `rowSelection` is **unchanged** — keyed by row id, so off-view selections persist (Edge Case 8)         |
| `reorderable` drag                          | `columnOrder → arrayMove(prev, from, to)`                                                               |

Every transition resolves the `Updater<T>` table-core passes, assigns the slice, then invokes the
matching `on…Change` callback with the **resolved next value** — never the updater function.

---

## 3. Filter option — `Option`

Ported verbatim from `docs/types/data-table.ts`:

| Field   | Type                                        | Notes                                                              |
| ------- | ------------------------------------------- | ------------------------------------------------------------------ |
| `label` | `string`                                    | Rendered text; also what the badge summary shows                   |
| `value` | `string`                                    | What lands in `columnFilters[].value`                              |
| `count` | `number` (optional)                         | Occurrence count, right-aligned; rendered only when truthy         |
| `icon`  | `Component<SVGAttributes<SVGSVGElement>>` (optional) | React `React.FC<React.SVGProps<SVGSVGElement>>` → Svelte `Component` |

**Selection rules.** `multiple: false` ⇒ selecting sets `[option.value]` and closes the popover;
re-selecting the same option clears the filter. `multiple: true` ⇒ selecting toggles membership and the
filter becomes `undefined` once the set is empty. The trigger shows: nothing when empty; one badge per
option up to 2; a single "N selected" badge at 3+ (Edge Case 4); plus a count-only badge below the `lg`
breakpoint.

---

## 4. Selection state — `RowSelectionState`

`Record<string, boolean>` keyed by row id (`getRowId` when supplied, otherwise the row index as a
string). Independent of filtering and pagination: the summary reads
`getFilteredSelectedRowModel().rows.length` of `getFilteredRowModel().rows.length`, so it reports
selections within the current filter while the underlying record keeps every selected id (Edge Case 8).
`enableRowSelection` defaults to `true`, matching upstream's hard-coded value; passing a predicate
disables selection per row.

The root's `actionBar` snippet renders **exactly when** `getFilteredSelectedRowModel().rows.length > 0`
(FR-010); the root never inspects or manages its contents.

---

## 5. Supporting value types

| Type              | Values                                                                                                                                   | Source                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `FilterVariant`   | `text \| number \| range \| date \| dateRange \| boolean \| select \| multiSelect`                                                        | `data-table-config.ts`    |
| `FilterOperator`  | `iLike \| notILike \| eq \| ne \| inArray \| notInArray \| isEmpty \| isNotEmpty \| lt \| lte \| gt \| gte \| isBetween \| isRelativeToToday` | `data-table-config.ts` |
| `JoinOperator`    | `and \| or`                                                                                                                              | `data-table-config.ts`    |
| `ExtendedColumnSort<TData>` | `Omit<ColumnSort, 'id'> & { id: Extract<keyof TData, string> }`                                                                 | `types.ts`                |
| `ExtendedColumnFilter<TData>` | `{ id: Extract<keyof TData, string>; value: string \| string[]; variant: FilterVariant; operator: FilterOperator; filterId: string }` | `types.ts` — upstream extends `FilterItemSchema` from `lib/parsers.ts` (a Zod schema, not vendored); the fields are inlined as a plain interface, no new dependency |
| `DataTableRowAction<TData>` | `{ row: Row<TData>; variant: 'update' \| 'delete' }`                                                                            | `types.ts`                |

**Filter-value shapes by variant** (what lands in `columnFilters[].value`):

| Variant                | Value                                                       |
| ---------------------- | ----------------------------------------------------------- |
| `text`, `number`       | `string` (raw input value, `''` clears)                     |
| `range`                | `[number, number]`                                          |
| `date`                 | `number` (epoch ms)                                         |
| `dateRange`            | `[number \| undefined, number \| undefined]`                |
| `select`, `multiSelect`| `string[]` (`undefined` when empty)                         |
| `boolean`              | listed in `dataTableConfig.filterVariants` for the advanced components; the base toolbar renders no control (upstream `default: return null`) |
