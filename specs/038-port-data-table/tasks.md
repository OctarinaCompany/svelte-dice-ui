---
description: 'Task list for the Data Table port'
---

# Tasks: Data Table

**Input**: Design documents from `/specs/038-port-data-table/` (plan.md, spec.md, research.md, data-model.md, contracts/public-api.md, quickstart.md)

**Tests**: Tests are MANDATORY (Constitution Principle III / CLAUDE.md §7). Every behavioural area —
roles & ARIA, keyboard, uncontrolled, controlled, RTL, guard rails/edge cases — must be asserted in the
colocated `src/lib/components/ui/data-table/data-table.test.ts`, driven through the
`data-table.test.svelte` harness. `expect.requireAssertions` is on; `globals: false`.

**Organization**: Phase order follows this feature's explicit tasking brief — Setup → Tests → Core
component files → Barrel and types → Demo route → Registry entry and docs polish → Verification — with
`[US1]`/`[US2]`/`[US3]` story labels attached to every task that maps to one of the three user stories in
`spec.md` (P1 browse/sort/page, P2 filter/hide/select, P3 reorder/pin/range-date-filter).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps the task to `spec.md`'s US1/US2/US3 (omitted for Setup/Foundation/cross-cutting tasks)
- Every task names its exact file path(s)

## Path Conventions

- **Component source**: `src/lib/components/ui/data-table/`
- **Tests**: colocated at `src/lib/components/ui/data-table/data-table.test.ts` (+ harness `data-table.test.svelte`)
- **Demo route**: `src/routes/docs/components/data-table/+page.svelte`
- **Registry**: `registry.json` at the repository root

---

## Phase 1: Setup

**Purpose**: Add the new dependency and stand up the folder + registry stub the rest of the port fills in.

- [X] T001 Run `pnpm add -D @tanstack/table-core@^8.21.3` to add the pinned devDependency (updates `package.json` / `pnpm-lock.yaml`)
- [X] T002 [P] Create the `src/lib/components/ui/data-table/` folder and append a stub `registry:ui` item named `"data-table"` to `registry.json` (`title: "Data Table"`, `description`, `registryDependencies: ["table", "dropdown-menu", "popover", "command", "select", "button", "input", "label", "badge", "separator", "checkbox", "skeleton", "calendar", "direction-provider", "sortable"]`, `dependencies: ["@tanstack/table-core", "bits-ui", "@internationalized/date"]`, `files: []` — populated in T028)

**Checkpoint**: Dependency installed, folder exists, registry stub present.

---

## Phase 2: Tests (MANDATORY — write first, confirm they fail before Phase 3 implementation)

**Purpose**: One test task per behavioural area from CLAUDE.md §7 / spec.md Testing Plan, all colocated in
`data-table.test.ts` against the shared harness. Every task in this phase touches the same test file (or
the harness it depends on), so none run in parallel with each other.

- [X] T003 [P] Create the test harness `src/lib/components/ui/data-table/data-table.test.svelte`: wraps `createDataTable` over a fixture row array + `DataTableColumnDef[]` (sortable/hideable/filterable columns of each `FilterVariant`, a selection column matching FR-009's recipe — header `Checkbox` `aria-label="Select all"` with `indeterminate` from `getIsSomePageRowsSelected()`, cell `Checkbox` `aria-label="Select row"`, `enableSorting:false`, `enableHiding:false` —, a pinned column), renders `DataTable.Root` with `Toolbar`, `ViewOptions`, `Pagination` and an `actionBar` snippet, and accepts props so a test can drive `dir`, `disabled`, initial state and controlled `state`
- [X] T004 [US1] Write accessibility roles & names tests in `src/lib/components/ui/data-table/data-table.test.ts`: `table`/`rowgroup`/`row`/`columnheader`/`cell` roles from the composed `table`, `role="toolbar"` + `aria-orientation="horizontal"`, View trigger `role="combobox"` + `aria-label="Toggle columns"`, `aria-label` on all four pagination buttons and every "Clear … filter" affordance, header-menu Asc/Desc/Hide exposed as `menuitemcheckbox` with `aria-checked` tracking `column.getIsSorted()` / `!column.getIsVisible()` and Reset exposed as a plain `menuitem`, select-all checkbox `aria-label="Select all"` with `indeterminate`, and the empty-state single cell with `colspan` = column count (spec Testing Plan area 1; expected to fail until Phase 3/4 land)
- [X] T005 [US1] Write keyboard interaction tests in `src/lib/components/ui/data-table/data-table.test.ts` via `user-event`: `Enter`/`Space` opens the column header menu, `ArrowDown`/`ArrowUp` moves between Asc/Desc/Reset/Hide, `Escape` closes and restores focus, `Tab` order across toolbar → view → table → pagination, command list `ArrowDown`/`Enter` toggles a facet, slider thumbs respond to `ArrowLeft`/`ArrowRight`/`Home`/`End`, `Enter` on a pagination button pages, and, for each of the faceted/date/slider filters, `Tab` reaches the sibling `Clear <title> filter` button and `Enter` clears the column filter without opening the popover (FR-014, Divergence 14) (spec Testing Plan area 2)
- [X] T006 [US2] Write uncontrolled vs controlled state tests in `src/lib/components/ui/data-table/data-table.test.ts`: `createDataTable({ initialState: {...} })` seeds sorting/pagination/columnVisibility/columnPinning and internal interaction updates it (uncontrolled); writing `state.sorting = …` / `state.pagination = …` from outside re-renders, passing `state:` in the options makes the caller authoritative, and every `on*Change` fires exactly once with the resolved next value without the component moving on its own (spec Testing Plan areas 3–4)
- [X] T007 [US3] Write RTL tests in `src/lib/components/ui/data-table/data-table.test.ts`: under `dir="rtl"` (bare `dir` attribute and `DirectionProvider`) the pagination first/previous/next/last chevrons invert while their `aria-label`s and `disabled` logic do not, and popover/menu horizontal navigation inverts via the composed primitives, exercised across all nine subcomponents (spec Testing Plan area 5, SC-003)
- [X] T008 Write guard-rail and edge-case tests in `src/lib/components/ui/data-table/data-table.test.ts`: `disabled` on `ViewOptions` suppresses opening; a column with `enableSorting:false`+`enableHiding:false` renders plain text with no menu and is absent from the View list; a column with no `meta.variant` renders no filter control and doesn't count toward "Reset filters"; a column whose `meta.variant` is `boolean` renders no toolbar control while still resolving `getFilterOperators('boolean')` to `dataTableConfig.booleanOperators`; "Reset" on an unapplied sort/filter is a no-op; a 3+ option multi-select facet collapses to an "N selected" badge; a zero-match filter renders "No results."; shrinking page size past the current page clamps to the last valid page; row selection survives a filter narrowing the visible rows; a slider "from" cannot exceed "to"; a right-pinned column's cells carry `data-pinned="right"` and a `style` containing `position: sticky`; and `getDataTableContext()` throws `` `<DataTable.Toolbar>` must be used within `<DataTable.Root>` or given a `table` prop. `` asserted with `toThrow(/within/)` (spec Testing Plan area 6, spec.md Edge Cases). Also add pure-helper unit tests for `data-table-utils.ts` in the same file: `getColumnPinningStyle` for left/right/last-left/first-right, with and without `withBorder`, `getValidFilters`, `parseValuesAsNumbers`, `getSliderRange` step buckets, and date parse/format round-trips

**Checkpoint**: `pnpm run test:unit -- --run` fails (component files don't exist yet) — this is expected; proceed to Phase 3.

---

## Phase 3: Core component files — Foundation (blocks every user story)

**Purpose**: The non-visual modules every subcomponent imports. Must be complete before any US phase below.

- [X] T009 Create `src/lib/components/ui/data-table/types.ts`: `Option`, `FilterVariant`, `FilterOperator`, `JoinOperator`, `DataTableColumnDef<TData, TValue>`, `DataTableInitialState<TData>`, `ExtendedColumnSort<TData>`, `ExtendedColumnFilter<TData>`, `DataTableRowAction<TData>`, `CreateDataTableOptions<TData>`, and the `declare module '@tanstack/table-core'` augmentation of `ColumnMeta`/`TableMeta` (per data-model.md §1, §5)
- [X] T010 [US2] Create `src/lib/components/ui/data-table/data-table-config.ts`: `dataTableConfig` (operator tables per `FilterVariant`, sort-order labels, filter-variant list) ported from `docs/config/data-table.ts` (depends on T009 for the shared types)
- [X] T011 Create `src/lib/components/ui/data-table/data-table-utils.ts`: `getColumnPinningStyle({ column, withBorder = false })` (returning a CSS text string; `withBorder` adds upstream's `-4px 0 4px -4px var(--border) inset` / `4px 0 4px -4px var(--border) inset` on the last left-pinned / first right-pinned column), `getFilterOperators`, `getDefaultFilterOperator`, `getValidFilters`, `formatDate`, `parseAsDate`, `parseColumnFilterValue`, `getIsDateRange`, `toDateValue`/`fromDateValue`, `parseValuesAsNumbers`, `getIsValidRange`, `getSliderRange` as pure functions with no runes, ported from `docs/lib/data-table.ts` + `docs/lib/format.ts` + the date/slider filters' local helpers (depends on T009, T010)
- [X] T012 Create `src/lib/components/ui/data-table/data-table.svelte.ts`: `DataTableState<TData>` class (seven `$state.raw` slices — `sorting`, `columnFilters`, `columnVisibility`, `rowSelection`, `pagination`, `columnPinning`, `columnOrder` — plus `$derived` `table`, `rows`, `headerGroups`, `pageCount`, `selectedRowCount`, `filteredRowCount`, `isFiltered`), `createDataTable<TData>(options)`, and the `Symbol`-keyed `setDataTableContext`/`getDataTableContext` pair that throws `` `<DataTable.Toolbar>` must be used within `<DataTable.Root>` or given a `table` prop. `` ported from `docs/hooks/use-data-table.ts` (depends on T009, T011; reactive getters passed to `createTable`'s options per research D-02 — no `$effect`, no version counter)

**Checkpoint**: Foundation ready — every US phase below can proceed.

---

## Phase 4: Core component files — User Story 1: Browse, sort and page (P1) 🎯 MVP

**Goal**: Render rows from a caller-supplied table instance, sort via the column header menu, and page
through results.

**Independent Test**: Render `DataTable` with a `table` built from a handful of rows and three columns
(one sortable, one not); verify rows render, header-menu Asc/Desc/Reset cycles the sort, and pagination
controls move between pages and react to page-size changes (spec.md US1 Independent Test).

- [X] T013 [P] [US1] Create `src/lib/components/ui/data-table/data-table-flex-render.svelte`: `DataTableFlexRender` component with `template: string | number | Snippet<[TContext]> | undefined`, `context: TContext`, `fallback?: string` props, switching on `typeof template` and `{@render}`-ing a snippet template (translation of upstream's `flexRender()`, justification 4 in plan.md)
- [X] T015 [P] [US1] Create `src/lib/components/ui/data-table/data-table-column-header.svelte`: `ColumnHeader`/`DataTableColumnHeader` with required `column`/`label` props, a `dropdown-menu` trigger showing the current sort indicator, Asc/Desc items (`column.toggleSorting`), a Reset item shown only while sorted (`column.clearSorting()`), a Hide item shown only while `column.getCanHide()`, and a plain-text fallback when `enableSorting:false` and `enableHiding:false` (depends on T012)
- [X] T016 [P] [US1] Create `src/lib/components/ui/data-table/data-table-pagination.svelte`: `Pagination`/`DataTablePagination` with `table?` (context fallback) and `pageSizeOptions?: number[] = [10, 20, 30, 40, 50]`, page-size `select`, first/previous/next/last `button`s with `aria-label`s that disable at the first/last page and invert their icon under `dir="rtl"`, and the "Page X of Y" / "N of M row(s) selected" summary (depends on T012)
- [X] T014 [US1] Create `src/lib/components/ui/data-table/data-table.svelte`: `Root`/`DataTable` with required `table: Table<TData>` prop (published to context via `setDataTableContext`), `actionBar?`/`children?` snippets and `data-slot="data-table"`; renders, in order, `children` → the composed bordered `table`/`table-header`/`table-body` (one `<tr>` per header group and per row, cells/headers via `FlexRender`, `data-state="selected"` on selected rows, `colspan={header.colSpan}`, placeholder headers render nothing) → `<Pagination />` → `actionBar`, the last rendered **only** when `table.getFilteredSelectedRowModel().rows.length > 0` (FR-010, contracts/public-api.md § Root); plus the "No results." empty-state row spanning `table.getAllColumns().length` (depends on T012, T013, T016)

**Checkpoint**: US1 is independently functional — rows render, sort, and page. Confirm T004–T006 (the
US1-tagged tests) now pass for this slice.

---

## Phase 5: Core component files — User Story 2: Filter, hide columns and select rows (P2)

**Goal**: Toolbar-driven text/number/select/multi-select filtering, a "Reset filters" control, a "View"
column-visibility menu, and row selection with a live count and optional action bar.

**Independent Test**: Render `DataTable` with a toolbar over data with one text-filterable column, one
multi-select-filterable column with facet values, and a selection column; verify the text filter narrows
rows, a facet toggle narrows rows and shows a count badge, "Reset" restores every row, hiding a column via
the View menu removes its header/cells, and selecting rows updates the count and reveals the action bar
(spec.md US2 Independent Test).

- [X] T017 [P] [US2] Create `src/lib/components/ui/data-table/data-table-view-options.svelte`: `ViewOptions`/`DataTableViewOptions` with `table?`, `disabled? = false`, `open? = false` (`$bindable`), `align? = 'end'`, `onOpenChange?`, a `popover` + `command` combobox (`role="combobox"`, `aria-label="Toggle columns"`) listing every column with a defined `accessorFn` and `getCanHide()`, searchable by label, toggling visibility on select (depends on T012; `reorderable` branch deferred to T024)
- [X] T018 [P] [US2] Create `src/lib/components/ui/data-table/data-table-faceted-filter.svelte`: `FacetedFilter`/`DataTableFacetedFilter` with `column?`, `title?`, required `options: Option[]`, `multiple? = false`, `open? = false` (`$bindable`), `onOpenChange?`; a `popover` + `command` list of options (icon + label + right-aligned count), selection toggling via `multiple`, trigger badges (≤2 individually, "N selected" at 3+, Edge Case 4), and a clear control (depends on T012)
- [X] T019 [US2] Create `src/lib/components/ui/data-table/data-table-toolbar-filter.svelte`: `ToolbarFilter`/`DataTableToolbarFilter` with required `column: Column<TData>`, dispatching on `column.columnDef.meta.variant` — `text`/`number` rendered inline as an `input` (`number` with an optional unit suffix from `meta.unit`), `select`/`multiSelect` delegated to `FacetedFilter` built from `column.columnDef.meta.options` (depends on T018; `range`/`date`/`dateRange` routing added in T025)
- [X] T020 [US2] Create `src/lib/components/ui/data-table/data-table-toolbar.svelte`: `Toolbar`/`DataTableToolbar` with `table?` (context fallback), `children?`, `role="toolbar"` + `aria-orientation="horizontal"`, rendering one `ToolbarFilter` per column with `enableColumnFilter` set, a "Reset filters" button visible only while `table.getState().columnFilters.length > 0` (`table.resetColumnFilters()`), and slotting `ViewOptions` (depends on T017, T019)

**Checkpoint**: US1 + US2 both independently functional. Confirm T004–T006 fully pass and the filter/select
assertions in T008 pass for this slice.

---

## Phase 6: Core component files — User Story 3: Reorder, pin and range/date filter columns (P3)

**Goal**: Slider-based range filtering with a unit label, single/range date filtering via a calendar
popover, column pinning exposed as stable `data-pinned` state, drag-to-reorder columns in the View list,
and a loading skeleton.

**Independent Test**: Render a table with a range-filterable numeric column (with a unit), a
date-range-filterable column, and a pinned column; verify the slider filter narrows to the chosen range and
shows the unit, the date filter narrows to the chosen range and displays it formatted in its trigger, the
pinned column stays visually fixed via `data-pinned`, and the skeleton renders the configured placeholder
counts with no live data (spec.md US3 Independent Test).

- [X] T021 [P] [US3] Create `src/lib/components/ui/data-table/data-table-slider-filter.svelte`: `SliderFilter`/`DataTableSliderFilter` with required `column: Column<TData, unknown>`, `title?`, `open? = false` (`$bindable`), `onOpenChange?`; bounds from `meta.range` or `column.getFacetedMinMaxValues()` (`getSliderRange`), a `bits-ui` `Slider` two-thumb range kept in sync with paired numeric "from"/"to" inputs (from ≤ to enforced per Edge Case 9), the `meta.unit` suffix, and a clear control (depends on T011, T012)
- [X] T022 [P] [US3] Create `src/lib/components/ui/data-table/data-table-date-filter.svelte`: `DateFilter`/`DataTableDateFilter` with required `column: Column<TData, unknown>`, `title?`, `multiple? = false`, `open? = false` (`$bindable`), `onOpenChange?`; a `popover` + local `calendar` wrapper (single date when `multiple:false`, range when `true`), the trigger showing the formatted date(s) via `formatDate`, converting `@internationalized/date` `DateValue`s to/from epoch-ms filter values via `toDateValue`/`fromDateValue`, and a clear control (depends on T011, T012)
- [X] T023 [P] [US3] Create `src/lib/components/ui/data-table/data-table-skeleton.svelte`: `Skeleton`/`DataTableSkeleton` with required `columnCount: number`, `rowCount? = 10`, `filterCount? = 0`, `cellWidths?: string[] = ['auto']`, `withViewOptions? = true`, `withPagination? = true`, `shrinkZero? = false`, rendering that many placeholder header cells / body rows / filter controls with the `skeleton` primitive, no live data, no interactive controls, no event handlers
- [X] T024 [US3] Add the `reorderable?: boolean = false` branch to `src/lib/components/ui/data-table/data-table-view-options.svelte`: when `true`, compose `sortable` over `table.getState().columnOrder` so dragging a row in the View list calls `table.setColumnOrder(arrayMove(prev, from, to))`; default `false` reproduces upstream exactly (depends on T017)
- [X] T025 [US3] Update `src/lib/components/ui/data-table/data-table-toolbar-filter.svelte` to route `meta.variant === 'range'` to `SliderFilter` and `'date'`/`'dateRange'` to `DateFilter` (depends on T019, T021, T022)
- [X] T024a [US3] Apply column pinning in `src/lib/components/ui/data-table/data-table.svelte`: on every `<th>` and `<td>` emit `style={getColumnPinningStyle({ column })}` (T011) plus `data-pinned={column.getIsPinned() || undefined}` and `data-pinned-edge={(column.getIsPinned() === 'left' && column.getIsLastColumn('left')) || (column.getIsPinned() === 'right' && column.getIsFirstColumn('right')) ? '' : undefined}`, satisfying FR-012 and research D-08 (depends on T011, T014)

**Checkpoint**: All three user stories independently functional. Confirm T004–T008 pass in full, including
RTL (T007), pinning (T024a) and every guard rail/edge case (T008).

---

## Phase 7: Barrel and types

- [X] T026 Create `src/lib/components/ui/data-table/index.ts`: import every part from T013–T025 and export short names + `DataTable*` aliases + every `…Props` type, plus re-export `Option`, `FilterVariant`, `FilterOperator`, `JoinOperator`, `DataTableColumnDef`, `DataTableInitialState`, `ExtendedColumnSort`, `ExtendedColumnFilter`, `DataTableRowAction`, `CreateDataTableOptions`, `DataTableState`, `createDataTable`, `setDataTableContext`, `getDataTableContext` (from T012), `dataTableConfig`/`DataTableConfig` (from T010), and `getColumnPinningStyle`/`getFilterOperators`/`getDefaultFilterOperator`/`getValidFilters`/`formatDate` (from T011), per plan.md "Shared modules exported for later components to reuse" (depends on T009–T025 all existing, and T024a)

---

## Phase 8: Demo route

- [X] T027 Create `src/routes/docs/components/data-table/+page.svelte`: one `ComponentPreview` per upstream `data-table-demo.tsx` surface — sortable/paginated layout (US1), text/number/select/multi-select filters + column hiding + row selection with action bar (US2), range/date filters + column pinning + `reorderable` view options + loading skeleton (US3) — plus a props table, using `createDataTable` with local `$state` fixture data/columns; the row-selection column MUST follow FR-009's exact recipe (header `Checkbox` `aria-label="Select all"` with `indeterminate` from `getIsSomePageRowsSelected()`, cell `Checkbox` `aria-label="Select row"`, `enableSorting:false`, `enableHiding:false`) (depends on T026)

---

## Phase 9: Registry entry and docs polish

- [X] T028 Populate the `data-table` registry.json item's `files` array (stub added in T002) with every file under `src/lib/components/ui/data-table/` **except** `data-table.test.ts` and `data-table.test.svelte`: `index.ts`, `types.ts`, `data-table-config.ts`, `data-table-utils.ts`, `data-table.svelte.ts`, `data-table.svelte`, `data-table-flex-render.svelte`, `data-table-column-header.svelte`, `data-table-toolbar.svelte`, `data-table-toolbar-filter.svelte`, `data-table-faceted-filter.svelte`, `data-table-date-filter.svelte`, `data-table-slider-filter.svelte`, `data-table-view-options.svelte`, `data-table-pagination.svelte`, `data-table-skeleton.svelte` (each `type: "registry:ui"`), and verify `registryDependencies`/`dependencies` match contracts/public-api.md § Registry entry exactly — `dependencies` MUST contain `@tanstack/table-core`, `bits-ui` and `@internationalized/date` (quickstart V7) (depends on T026, T027)
- [X] T029 Run `pnpm run registry:build` to regenerate `static/r/data-table.json` and the registry index (depends on T028)

---

## Phase 10: Verification (MANDATORY — Principle VII, Green Gate Before Commit)

- [X] T030 Run `pnpm run format` (shadcn/generator output is not Prettier-formatted) and commit the formatting to every file touched in T001–T029
- [X] T031 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, and fix everything that fails — no suppressions (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, deleted assertions, loosened configs); fix the root cause

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Tests (Phase 2)**: depends on Setup (T002 folder must exist); T003 harness before T004–T008; expected to fail until Phase 3–6 land
- **Foundation (Phase 3, T009–T012)**: depends on Setup; blocks every user-story phase
- **US1 (Phase 4)**, **US2 (Phase 5)**, **US3 (Phase 6)**: each depends on Phase 3; independently testable once its own phase completes (US2's toolbar-filter and US3's view-options edits touch files US1/US2 created, but each phase's *Independent Test* only exercises that phase's own scenario)
- **Barrel (Phase 7)**: depends on every part existing (T009–T025, T024a)
- **Demo route (Phase 8)**: depends on the barrel (T026)
- **Registry (Phase 9)**: depends on the barrel and demo route (T026, T027)
- **Verification (Phase 10)**: depends on everything above; always last

### Within-file sequencing (never parallel)

- T009 → T010 → T011 → T012 (each imports the previous)
- T017 and T024 (both edit `data-table-view-options.svelte`) — sequential
- T019 and T025 (both edit `data-table-toolbar-filter.svelte`) — sequential
- T004–T008 (all edit `data-table.test.ts`) — sequential, after T003

### Parallel Opportunities

- Setup: T002 can run alongside T001
- Tests: none — T003 needs the folder from T002, and T004–T008 all edit `data-table.test.ts` and must follow T003 sequentially
- Foundation: none — T009→T010→T011→T012 is a strict chain
- US1: T013 and T015 in parallel; T016 after T012; T014 last (it renders Pagination and depends on T012, T013, T016)
- US2: T017 and T018 in parallel (different files); T019 depends on T018; T020 depends on T017 + T019
- US3: T021, T022, T023 in parallel (three independent new files); T024 and T025 are sequential edits to existing files; T024a depends on T011 and T014 (US1)

---

## Parallel Example: User Story 2

```bash
# After Foundation (Phase 3) completes, launch these together:
Task: "Create data-table-view-options.svelte" (T017)
Task: "Create data-table-faceted-filter.svelte" (T018)
# Then, once T018 finishes:
Task: "Create data-table-toolbar-filter.svelte" (T019, depends on T018)
# Then, once T017 and T019 finish:
Task: "Create data-table-toolbar.svelte" (T020, depends on T017 + T019)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2 tests T003–T005 (harness + US1-tagged tests)
3. Phase 3: Foundation
4. Phase 4: User Story 1
5. **STOP and VALIDATE**: T004–T006's US1 assertions pass; render the demo fixture manually

### Incremental Delivery

1. Setup + Foundation → foundation ready
2. Add US1 (Phase 4) → validate independently → MVP
3. Add US2 (Phase 5) → validate independently
4. Add US3 (Phase 6) → validate independently
5. Barrel (Phase 7) → Demo route (Phase 8) → Registry (Phase 9) → Verification (Phase 10)

---

## Notes

- [P] tasks touch different files with no dependency on an incomplete task
- [Story] labels map tasks to spec.md's US1/US2/US3 for traceability; Setup/Foundation/Barrel/Demo/Registry/Verification tasks carry no label because they are cross-cutting
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X)
- Do NOT touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json` or `.port-logs/`
- Zero suppressions permitted at any gate (Principle VI/VII)
</content>

---

## Phase 11: Convergence

**Purpose**: Close the gaps found by `/speckit-converge` between `spec.md` / `plan.md` /
`contracts/public-api.md` and the implemented port. Ordered HIGH first. No constitution MUST
principle is violated; all five quality gates are currently green.

- [X] T032 Accept and forward `...restProps` to `Popover.Content` in `src/lib/components/ui/data-table/data-table-view-options.svelte` per contracts/public-api.md § DataTableViewOptions ("`align` … Plus every other `Popover.Content` prop via rest") and plan.md § Public API. `DataTableViewOptionsProps` currently declares a closed prop set (`table`, `disabled`, `reorderable`, `open`, `onOpenChange`, `align`, `ref`, `class`), so a consumer cannot pass `side`, `sideOffset`, `avoidCollisions` or any other content prop that upstream exposes through `DataTableViewOptionsProps<TData> extends React.ComponentProps<typeof PopoverContent>`; widen the prop type (e.g. over the popover content props), spread the rest onto `<Popover.Content>` after `align`/`class`, and assert the forwarding in `data-table.test.ts` (partial)
- [X] T033 Spread `...restProps` onto the rendered element of the four remaining parts that omit it — `src/lib/components/ui/data-table/data-table-faceted-filter.svelte`, `data-table-date-filter.svelte`, `data-table-slider-filter.svelte` and `data-table-toolbar-filter.svelte` — per contracts/public-api.md § Conventions ("Every part accepts `ref?`, `class?` … and spreads `...restProps` onto the element named in its 'Element' row") and CLAUDE.md §4. Each currently destructures a fixed prop list with no rest, so any additional attribute a caller passes is silently dropped; the rest goes on the `Popover.Trigger` for the three filters and on the rendered control for `ToolbarFilter` (partial)
- [X] T034 Add the two missing filter-variant surfaces to `src/routes/docs/components/data-table/+page.svelte` per SC-004 and quickstart V6 ("the demo page exercises … every filter variant"). The page currently demonstrates `text`, `multiSelect`, `range`, `date` and `dateRange` only: no column declares `meta.variant: 'number'` (with a `meta.unit` suffix, FR-005) or `meta.variant: 'select'` (single-select facet, FR-008). Add both to an existing toolbar example — or a new `<ComponentPreview>` — with matching `filterFn`s so the controls actually narrow the rows (missing)
- [X] T035 Extend the RTL `describe` block in `src/lib/components/ui/data-table/data-table.test.ts` to the three subcomponents it skips, per SC-003 ("All nine upstream subcomponents (table root, column header, toolbar, faceted filter, date filter, slider filter, pagination, view options, skeleton) render correctly with `dir="rtl"`"). Today only the root, column header, toolbar, faceted filter, view options and pagination are asserted under `dir="rtl"`; add assertions that `DataTableDateFilter` and `DataTableSliderFilter` open and commit a value under RTL (the slider through its `ArrowLeft`/`ArrowRight` keyboard path, whose meaning inverts) and that `DataTableSkeleton` renders its placeholder counts under RTL (partial)
- [X] T036 Remove `isColumnTemplateSnippet` from `src/lib/components/ui/data-table/data-table-utils.ts`, or wire it into `data-table-flex-render.svelte` and export it from the barrel, per plan.md § "Shared modules exported for later components to reuse". It is exported from the utils module but referenced nowhere — `data-table-flex-render.svelte` declares its own local `isSnippet` guard — and it appears in neither `index.ts` nor the contract's exported-helpers list, so it currently ships as dead source in the registry payload (unrequested)

**Checkpoint**: re-run `pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build`; all five must stay green with zero suppressions.
