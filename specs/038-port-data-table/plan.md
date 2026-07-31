# Implementation Plan: Data Table

**Branch**: `038-port-data-table` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/038-port-data-table/spec.md`

## Summary

Port Dice UI's React **Data Table** — nine files under `.reference/diceui/docs/components/data-table/`
plus the `useDataTable` hook, `lib/data-table.ts`, `config/data-table.ts` and `types/(radix/)data-table.ts`
— to `src/lib/components/ui/data-table/` as a Svelte 5 runes component set.

Technical approach: keep the headless engine **byte-for-byte** by depending on
`@tanstack/table-core` (the framework-agnostic package `@tanstack/react-table` itself wraps), and write
the framework adapter ourselves as a runes state class. The adapter is one idea: the options object
handed to `createTable` carries **reactive getters** (`get data()`, `get state()`, …) that read `$state`
slices, so every `table.getState()` / `getRowModel()` / `column.getIsSorted()` call made inside Svelte
markup registers a fine-grained dependency and re-runs on change — no version counter, no table
re-creation, no store. Upstream's `nuqs` URL persistence is dropped (spec Assumptions) and replaced by
plain callback props plus writable state slices, so a consuming SvelteKit app can drive persistence.

Everything above the engine is composed from primitives already in the repo (`table`, `dropdown-menu`,
`popover`, `command`, `select`, `button`, `input`, `label`, `badge`, `separator`, `checkbox`, `skeleton`,
`calendar`, `sortable`, `direction-provider`) plus one bits-ui primitive with no local wrapper
(`Slider`). Nine subcomponents ship, mirroring upstream's file split.

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`) on Svelte 5.56 / SvelteKit 2.63,
runes forced on repo-wide via `vite.config.ts`.

**Primary Dependencies**: `@tanstack/table-core@^8.21.3` (**new** — see Research D-01), `bits-ui@^2.18.1`
(Slider, Popover, DropdownMenu, Command, Select, Calendar under the local wrappers),
`@internationalized/date@^3.12.2` (already present; the `calendar` wrapper's value type),
`@lucide/svelte@^1.27.0` (icons), `tailwind-variants` + `clsx`/`tailwind-merge` via `cn()`.

**Storage**: N/A — all state is in-memory and owned by the caller's `DataTableState` instance.

**Testing**: Vitest 4 (jsdom) + `@testing-library/svelte` 5 + `@testing-library/user-event` 14,
colocated at `src/lib/components/ui/data-table/data-table.test.ts` driven through a
`data-table.test.svelte` harness. `expect.requireAssertions` is on; `globals: false`.

**Target Platform**: Browser (SSR-safe: no top-level `document`/`window` access; `createTable` runs in
both environments, all DOM measurement lives in `$effect`).

**Project Type**: shadcn-svelte registry component + SvelteKit docs route.

**Performance Goals**: `table-core`'s own memoisation is preserved (the table instance is created once
and only its options object is replaced), so a sort/filter/page change recomputes exactly the row models
whose dependencies changed. Target: no re-creation of the table instance on any state change; no
`$effect` in the hot path of rendering rows.

**Constraints**: Zero suppressions (`any`, `@ts-*`, `eslint-disable`, `svelte-ignore` are constitution
violations); no `shadcn-svelte add` mid-port; no manual `dark:`, no `space-*`, semantic tokens only; no
imports from `src/routes/**` or `src/lib/components/docs/**` into the component folder.

**Scale/Scope**: 11 `.svelte` parts, 5 `.ts`/`.svelte.ts` modules, 1 barrel, 1 test harness + 1 test
file, 1 demo route, 1 `registry.json` entry. Upstream surface: 9 components + 1 hook + 3 support modules.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict  | Evidence                                                                                                                                                                                                                                        |
| ---- | ----------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | **PASS** | `useDataTable` → `DataTableState` class in `data-table.svelte.ts` using `$state.raw`/`$derived`; every part uses `$props()` + `$bindable` + snippets. No stores, no `export let`, no `createEventDispatcher`, no `<slot>`. React `useMemo`/`useCallback` are dropped, not transliterated. |
| II   | Upstream Parity (NON-NEGOTIABLE)    | **PASS** | All 9 upstream components, `useDataTable`, `lib/data-table.ts`, `config/data-table.ts`, `types/data-table.ts`, `types/radix/data-table.ts` and `data-table.mdx` read at the pinned commit. Every prop, default and `@default` JSDoc reproduced in the Public API contract; every divergence listed in "Divergences" below and already anchored in spec Assumptions. |
| III  | Accessibility Is a MUST             | **PASS** | ARIA surface enumerated in the Public API contract (`role="toolbar"` + `aria-orientation`, `role="combobox"` on the View trigger, `aria-label` on every icon-only control, `data-state=selected` rows, checkbox `indeterminate`). Keyboard comes from the composed primitives (menu/popover/command/select roving focus) and is asserted through `user-event`; RTL asserted for pagination via `useDirection`. Test areas §7 enumerated in Testing Plan below. |
| IV   | Composition Over Reimplementation   | **PASS** | 13 existing `src/lib/components/ui/*` components composed; one bits-ui primitive (`Slider`) composed directly because no local wrapper exists and `shadcn-svelte add` is forbidden. Bespoke code is limited to the table-core↔runes adapter and the pinning-style calculator — both justified below. |
| V    | shadcn-svelte Distribution Model    | **PASS** | One folder `src/lib/components/ui/data-table/`, one part per file, `index.ts` barrel with short names + `DataTable*` aliases + prop types, `.js` extensions on every intra-repo import, exactly one `registry:ui` entry appended to `registry.json`, `pnpm run registry:build` scheduled. No import from `src/routes/**` or `src/lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | **PASS** | Generic `<TData>` threaded through every part; `ColumnMeta`/`TableMeta` extended via `declare module '@tanstack/table-core'`; template values typed `string \| number \| Snippet<[…Context]>`; `unknown` + narrowing used where upstream used `as`. Zero `any`, zero ignore comments, zero config edits. |
| VII  | Green Gate Before Commit            | **PASS** | `pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final task; no `.skip`/`.todo`; `pnpm add -D @tanstack/table-core@^8.21.3` runs before the gates. |
| VIII | Styling Discipline                  | **PASS** | `cn()` everywhere, caller `class` merged last, `tv()` not needed (no multi-variant part). Semantic tokens only — upstream has no palette colours in these files. `data-slot="data-table-*"` on every part; state exposed as `data-state`, `data-pinned`, `data-pinned-edge`, `data-sorted`, `data-filtered`, `data-selected`, `data-multiple`, written `cond ? '' : undefined`. No `z-index` on overlays (Popover/DropdownMenu own theirs); the pinned-column `z-index: 1` is on a `<th>`/`<td>`, not an overlay. |
| IX   | Every Component Is Documented       | **PASS** | Upstream ships exactly one example file, `registry/bases/radix/examples/data-table-demo.tsx`. The demo route reproduces it *and* adds one `<ComponentPreview>` per SC-004 surface (filters, pinning, selection + action bar, skeleton) plus a props table, as the spec requires. |
| X    | One Feature Directory Per Component | **PASS** | All artifacts written to `specs/038-port-data-table/`; no git write commands; no edits to `.reference/`, `scripts/`, `.port-*`, `.claude/settings*`, `.specify/scripts/`. |

**Bespoke behaviour justification (Principle IV)**:

1. **table-core ↔ runes adapter (`DataTableState` in `data-table.svelte.ts`).** Evaluated: `bits-ui`
   (no data-grid/table state primitive at all), `src/lib/components/ui/table` (presentational `<table>`
   markup only, zero state), the existing `sortable` state class (sorts a flat item array by drag, not a
   column/row model). None supplies sorting + faceted filtering + pagination + row selection + pinning
   over a column-def model. Upstream's own engine is `@tanstack/react-table`, whose entire non-React
   half is the published `@tanstack/table-core`; the only thing missing is the ~120-line framework
   adapter. Writing that adapter *is* the composition-maximising choice — the alternative is
   re-implementing TanStack Table.
2. **`getColumnPinningStyle` (in `data-table-utils.ts`).** Evaluated: Tailwind `sticky left-*` utilities
   — they cannot express `left: ${column.getStart('left')}px`, a value that depends on the runtime widths
   of the preceding pinned columns. Upstream computes it in JS for the same reason. Ported as a pure
   function returning a `style` string, paired with `data-pinned`/`data-pinned-edge` so consumers can
   restyle without recomputing offsets (FR-012).
3. **Slider composed from `bits-ui` directly** (not bespoke). `src/lib/components/ui/slider` does not
   exist and Principle IV forbids `shadcn-svelte add` mid-port; `bits-ui`'s `Slider` is step 2 of the
   sourcing order and provides the two-thumb range, keyboard (`Arrow*`/`Home`/`End`/`PageUp`/`PageDown`)
   and RTL behaviour upstream's `Slider` provided. A thin styled markup wrapper lives inside
   `data-table-slider-filter.svelte`; no drag logic is hand-rolled. This supersedes the spec Assumption
   that said the plan would add a shadcn base `slider` component — doing so would violate Principle IV.
4. **`DataTableFlexRender`.** React's `flexRender()` is a *function* that renders a component or a
   string. Svelte has no function-call rendering; the equivalent is a component that switches on the
   template's type and `{@render}`s a snippet. There is no primitive for this by construction.

## Divergences from upstream (Principle II bookkeeping)

Each is either already recorded in `spec.md` § Assumptions (marked ✔) or added here with its reason.

| # | Upstream                                                                                                | Here                                                                                                                              | Reason                                                                                                                       |
| - | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1 | `@tanstack/react-table`                                                                                 | `@tanstack/table-core` + local adapter                                                                                            | ✔ spec Assumption 1. Same engine, framework half rewritten.                                                                  |
| 2 | `useDataTable` persists state to the URL via `nuqs`                                                     | `createDataTable` owns state; callbacks + writable slices expose it (FR-015)                                                      | ✔ spec Assumption 2. `nuqs` is Next-only.                                                                                    |
| 3 | `manualPagination`/`manualSorting`/`manualFiltering` hard-coded `true`                                  | options, default `false`                                                                                                         | ✔ spec Assumption "Server-side vs client-side". Upstream hard-codes `true` **because** nuqs round-trips through the server; without nuqs `true` would make sorting/filtering/paging inert. All three remain settable to `true`. |
| 4 | `pageCount` required                                                                                    | optional, `@default -1`                                                                                                          | Follows from #3: with client-side pagination `table-core` derives the page count. Passing it still wins.                      |
| 5 | `queryKeys`, `history`, `debounceMs`, `throttleMs`, `clearOnDefault`, `scroll`, `shallow`, `startTransition`, `enableAdvancedFilter` | dropped                                                                                                                          | All are nuqs/React-transition options; nothing left to configure once #2 applies. `enableAdvancedFilter` only gates the four un-vendored advanced components (✔ spec Assumption 3). |
| 6 | `DataTableSortList`, `DataTableFilterList`, `DataTableFilterMenu`, `DataTableAdvancedToolbar`            | out of scope                                                                                                                     | ✔ spec Assumption 3 — not vendored at the pinned commit.                                                                     |
| 7 | `types/radix/data-table.ts` names the column-header prop `title`; the component and the demo use `label` | `label`                                                                                                                          | Source + only call-site win over the stale type file.                                                                        |
| 8 | Popover `open` held in `useState` (Faceted) / uncontrolled (Date, Slider, View)                          | `open?: boolean` `$bindable` on all four                                                                                         | Constitution §4: every value-bearing prop is `$bindable`. Purely additive; omitting it reproduces upstream exactly.           |
| 9 | Every subcomponent takes `table` as a required prop                                                      | `table` optional on `Toolbar`/`ViewOptions`/`Pagination`, falling back to the context `DataTable` root sets                        | Svelte context is the §5 translation of prop-drilling; upstream call-sites still work verbatim because the prop still wins. `getDataTableContext()` throws the documented error when neither is present. |
| 10 | Private `DataTableToolbarFilter` (module-local)                                                          | exported as `DataTable.ToolbarFilter`                                                                                            | One part per file (Principle V) makes it a file; exporting it is free and lets consumers place a single filter outside the toolbar. |
| 11 | Calendar values are JS `Date` (`react-day-picker`)                                                       | `@internationalized/date` `DateValue` internally; **the column filter value stays epoch milliseconds**                            | The local `calendar` wrapper is bits-ui based. The filter-value contract — the thing a consumer sees — is unchanged.          |
| 12 | No column reordering UI                                                                                  | `DataTableViewOptions` gains `reorderable?: boolean` `@default false`, composing `sortable` over `columnOrder`                     | ✔ spec Assumption "Column reordering" + User Story 3. Default `false` ⇒ upstream-identical unless opted in.                   |
| 13 | `flexRender(template, ctx)`                                                                              | `<DataTable.FlexRender template={…} context={…} />`, template `string \| number \| Snippet<[Ctx]>`                                 | React function-rendering has no Svelte equivalent (justification 4 above).                                                   |
| 14 | Clear-filter affordance is a `div role="button" tabIndex={0}` with an `onClick` only, nested inside the trigger `<button>` (faceted, date and slider filters) | a sibling `<button type="button">` outside the trigger, same `aria-label`/icon/position | Upstream's control is not keyboard-operable and nests interactive content inside a button (Principle III, FR-014); reproducing it would emit Svelte a11y warnings that the zero-warning `check` gate forbids silencing. |
| 15 | Pagination chevrons are hard-coded LTR; no direction handling anywhere upstream | `useDirection()` mirrors the four chevron icons under `dir="rtl"` and the root emits `data-dir`; labels, DOM order and disabled logic unchanged | Constitution III / CLAUDE.md §7 make RTL inversion a mandatory, asserted behaviour (SC-003, research D-09). Purely visual and additive — LTR output is byte-identical to upstream. |

## Project Structure

### Documentation (this feature)

```text
specs/038-port-data-table/
├── plan.md              # This file
├── research.md          # Phase 0 output — 10 decisions
├── data-model.md        # Phase 1 output — entities + state transitions
├── quickstart.md        # Phase 1 output — runnable validation guide
├── contracts/
│   └── public-api.md    # Phase 1 output — every export, prop, snippet, callback, data-attribute
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/data-table/
├── index.ts                          # barrel: short names + DataTable* aliases + every prop/state type
├── types.ts                          # Option, FilterVariant/Operator/JoinOperator, ColumnMeta + TableMeta
│                                     #   augmentation of '@tanstack/table-core', DataTableColumnDef,
│                                     #   ExtendedColumnSort/Filter, DataTableRowAction
│                                     #   ← docs/types/data-table.ts + docs/types/radix/data-table.ts
├── data-table-config.ts              # dataTableConfig: operator/sort-order/variant tables
│                                     #   ← docs/config/data-table.ts
├── data-table-utils.ts               # getColumnPinningStyle, getFilterOperators,
│                                     #   getDefaultFilterOperator, getValidFilters, formatDate,
│                                     #   parseAsDate, parseColumnFilterValue, getIsDateRange,
│                                     #   toDateValue/fromDateValue, parseValuesAsNumbers,
│                                     #   getIsValidRange, getSliderRange (pure, no runes)
│                                     #   ← docs/lib/data-table.ts + docs/lib/format.ts + local helpers
│                                     #     hoisted out of the date/slider filters
├── data-table.svelte.ts              # DataTableState + createDataTable() + Symbol context
│                                     #   (setDataTableContext / getDataTableContext, throwing)
│                                     #   ← docs/hooks/use-data-table.ts
├── data-table.svelte                 # Root                    ← data-table.tsx
├── data-table-flex-render.svelte     # template renderer        ← flexRender() (no upstream file)
├── data-table-column-header.svelte   #                          ← data-table-column-header.tsx
├── data-table-toolbar.svelte         #                          ← data-table-toolbar.tsx (outer)
├── data-table-toolbar-filter.svelte  #                          ← data-table-toolbar.tsx (inner, private)
├── data-table-faceted-filter.svelte  #                          ← data-table-faceted-filter.tsx
├── data-table-date-filter.svelte     #                          ← data-table-date-filter.tsx
├── data-table-slider-filter.svelte   #                          ← data-table-slider-filter.tsx
├── data-table-view-options.svelte    #                          ← data-table-view-options.tsx
├── data-table-pagination.svelte      #                          ← data-table-pagination.tsx
├── data-table-skeleton.svelte        #                          ← data-table-skeleton.tsx
├── data-table.test.svelte            # test harness (NOT in registry.json)
└── data-table.test.ts                # colocated tests          (NOT in registry.json)

src/routes/docs/components/data-table/
└── +page.svelte                      # ComponentPreview per SC-004 surface + props table

registry.json                         # append exactly one registry:ui entry named "data-table"
package.json                          # + devDependency @tanstack/table-core ^8.21.3
```

**Structure Decision**: folder slug `data-table` == demo route segment `data-table` == registry item
name `data-table`. Every upstream file maps to exactly one file above (see the `←` annotations); the two
files with no upstream counterpart (`data-table-flex-render.svelte`, `data-table.test.svelte`) are the
React-function-rendering translation and the test harness. `data-table-utils.ts` and
`data-table-config.ts` are pure `.ts` (no runes) — the same pattern as `sortable-geometry.ts` and
`kanban-collision.ts`.

## Public API

Derived from `.reference/diceui/docs/components/data-table/*.tsx`,
`docs/hooks/use-data-table.ts`, `docs/types/radix/data-table.ts` and
`docs/content/docs/components/radix/data-table.mdx` at the pinned commit. `TData` is the row type.
Full detail — including every `data-*` attribute, ARIA attribute and rendered element — is in
[contracts/public-api.md](./contracts/public-api.md).

### `createDataTable<TData>(options): DataTableState<TData>` — `data-table.svelte.ts`

Replaces `useDataTable`. Must be called during component initialisation (it creates `$state`).

| Option                    | Type                                                                     | Default            | Notes                                        |
| ------------------------- | ------------------------------------------------------------------------ | ------------------ | -------------------------------------------- |
| `data`                    | `TData[] \| (() => TData[])`                                             | — (required)       | A getter keeps the rows reactive             |
| `columns`                 | `DataTableColumnDef<TData>[] \| (() => DataTableColumnDef<TData>[])`     | — (required)       |                                              |
| `pageCount`               | `number`                                                                 | `-1`               | Divergence 4                                 |
| `initialState`            | `DataTableInitialState<TData>`                                           | `{}`               | `sorting` typed `ExtendedColumnSort<TData>[]` |
| `state`                   | `Partial<TableState>`                                                    | `undefined`        | Controlled override, merged last             |
| `getRowId`                | `(row: TData, index: number, parent?: Row<TData>) => string`             | `undefined`        |                                              |
| `defaultColumn`           | `Partial<ColumnDef<TData>>`                                              | see Research D-03  |                                              |
| `enableRowSelection`      | `boolean \| ((row: Row<TData>) => boolean)`                              | `true`             |                                              |
| `manualPagination`        | `boolean`                                                                | `false`            | Divergence 3                                 |
| `manualSorting`           | `boolean`                                                                | `false`            | Divergence 3                                 |
| `manualFiltering`         | `boolean`                                                                | `false`            | Divergence 3                                 |
| `meta`                    | `TableMeta<TData>`                                                       | `undefined`        |                                              |
| `onSortingChange`         | `(sorting: SortingState) => void`                                        | `undefined`        | Called with the **resolved** next state       |
| `onColumnFiltersChange`   | `(filters: ColumnFiltersState) => void`                                  | `undefined`        |                                              |
| `onPaginationChange`      | `(pagination: PaginationState) => void`                                  | `undefined`        |                                              |
| `onRowSelectionChange`    | `(selection: RowSelectionState) => void`                                 | `undefined`        |                                              |
| `onColumnVisibilityChange`| `(visibility: VisibilityState) => void`                                  | `undefined`        |                                              |
| `onColumnPinningChange`   | `(pinning: ColumnPinningState) => void`                                  | `undefined`        |                                              |
| `onColumnOrderChange`     | `(order: ColumnOrderState) => void`                                      | `undefined`        |                                              |

`DataTableState<TData>` members — `readonly table: Table<TData>` plus seven **read/write** `$state.raw`
slices (`sorting`, `columnFilters`, `columnVisibility`, `rowSelection`, `pagination`, `columnPinning`,
`columnOrder`) and the read-only deriveds `rows`, `headerGroups`, `pageCount`, `selectedRowCount`,
`filteredRowCount`, `isFiltered`. Writing a slice is the "controlled" path (FR-015); every internal
mutation goes through the same setter, so a `$effect` on a slice sees every change exactly once.

### Components

Legend: **B** = `$bindable`. Every part also accepts `ref` (B, `$bindable(null)`), `class`, and spreads
`...restProps` onto its rendered element.

| Component (alias)                     | Props (name : type = default)                                                                                                                                                                                                                                             | Snippets                    | Callbacks                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------- |
| `Root` (`DataTable`)                  | `table: Table<TData>` — required                                                                                                                                                                                                                                          | `actionBar?`, `children?`   | —                                |
| `FlexRender` (`DataTableFlexRender`)  | `template: string \| number \| Snippet<[TContext]> \| undefined`; `context: TContext`; `fallback?: string`                                                                                                                                                                 | —                           | —                                |
| `ColumnHeader` (`DataTableColumnHeader`) | `column: Column<TData, TValue>` — required; `label: string` — required                                                                                                                                                                                                 | —                           | —                                |
| `Toolbar` (`DataTableToolbar`)        | `table?: Table<TData>` (falls back to context)                                                                                                                                                                                                                            | `children?`                 | —                                |
| `ToolbarFilter` (`DataTableToolbarFilter`) | `column: Column<TData>` — required                                                                                                                                                                                                                                   | —                           | —                                |
| `FacetedFilter` (`DataTableFacetedFilter`) | `column?: Column<TData, TValue>`; `title?: string`; `options: Option[]` — required; `multiple?: boolean = false`; `open?: boolean = false` **B**                                                                                                                     | —                           | `onOpenChange?: (open) => void`  |
| `DateFilter` (`DataTableDateFilter`)  | `column: Column<TData, unknown>` — required; `title?: string`; `multiple?: boolean = false`; `open?: boolean = false` **B**                                                                                                                                                | —                           | `onOpenChange?`                  |
| `SliderFilter` (`DataTableSliderFilter`) | `column: Column<TData, unknown>` — required; `title?: string`; `open?: boolean = false` **B**                                                                                                                                                                           | —                           | `onOpenChange?`                  |
| `ViewOptions` (`DataTableViewOptions`) | `table?: Table<TData>`; `disabled?: boolean = false`; `reorderable?: boolean = false`; `open?: boolean = false` **B**; `align?: 'start' \| 'center' \| 'end' = 'end'` (+ every other `PopoverContent` prop via rest)                                                       | —                           | `onOpenChange?`                  |
| `Pagination` (`DataTablePagination`)  | `table?: Table<TData>`; `pageSizeOptions?: number[] = [10, 20, 30, 40, 50]`                                                                                                                                                                                                | —                           | —                                |
| `Skeleton` (`DataTableSkeleton`)      | `columnCount: number` — required; `rowCount?: number = 10`; `filterCount?: number = 0`; `cellWidths?: string[] = ['auto']`; `withViewOptions?: boolean = true`; `withPagination?: boolean = true`; `shrinkZero?: boolean = false`                                           | —                           | —                                |

### Types, values and helpers exported from the barrel

`Option`, `FilterVariant`, `FilterOperator`, `JoinOperator`, `DataTableColumnDef<TData, TValue>`,
`DataTableInitialState<TData>`, `ExtendedColumnSort<TData>`, `ExtendedColumnFilter<TData>`,
`DataTableRowAction<TData>`, `CreateDataTableOptions<TData>`, `DataTableState`, `createDataTable`,
`setDataTableContext`, `getDataTableContext`, `dataTableConfig`, `DataTableConfig`,
`getColumnPinningStyle`, `getFilterOperators`, `getDefaultFilterOperator`, `getValidFilters`,
`formatDate`, plus one `…Props` type per component.

### Shared modules exported for later components to reuse

`data-table-config.ts`, `data-table-utils.ts` and `types.ts` are re-exported from the barrel precisely
so the four out-of-scope advanced components (`DataTableSortList`, `DataTableFilterList`,
`DataTableFilterMenu`, `DataTableAdvancedToolbar`, spec Assumption 3) and any future data-grid port can
consume the operator tables, the filter-validity helper and the `ColumnMeta` augmentation without
duplicating them. The `ColumnMeta`/`TableMeta` module augmentation in `types.ts` is global once the file
is imported — that is the single source of truth for `meta.variant`, `meta.options`, `meta.range`,
`meta.unit`, `meta.label`, `meta.placeholder`, `meta.icon`.

## Implementation order (what `/speckit-tasks` should expand)

1. **Setup** — `pnpm add -D @tanstack/table-core@^8.21.3`; create the folder.
2. **Tests first** — the harness plus `data-table.test.ts` covering the six §7 areas are written next,
   *before* the foundation and the story phases, and are expected to fail until each story lands; each
   story's checkpoint re-runs them (see tasks.md Phase 2 and the Phase 4/5/6 checkpoints).
3. **Foundation (blocks everything)** — `types.ts` (incl. module augmentation) → `data-table-config.ts`
   → `data-table-utils.ts` → `data-table.svelte.ts` (`createDataTable`, `DataTableState`, context).
4. **US1 — browse/sort/page (P1)**: `data-table-flex-render.svelte` → `data-table-column-header.svelte`
   → `data-table-pagination.svelte` → `data-table.svelte`. Independently testable: renders rows, header
   menu cycles asc/desc/reset, pagination moves pages and clamps page size.
5. **US2 — filter/hide/select (P2)**: `data-table-view-options.svelte` →
   `data-table-faceted-filter.svelte` → `data-table-toolbar-filter.svelte` (text + number variants
   inline) → `data-table-toolbar.svelte`; the selection column and action bar are exercised through the
   root's `actionBar` snippet.
6. **US3 — range/date/pin/reorder (P3)**: `data-table-slider-filter.svelte` →
   `data-table-date-filter.svelte` → `data-table-skeleton.svelte` → the `reorderable` branch of
   `data-table-view-options.svelte` → wiring column pinning into `data-table.svelte`.
7. **Barrel** `index.ts` (after all parts exist).
8. **Docs route** `src/routes/docs/components/data-table/+page.svelte`.
9. **Registry** — append the entry, run `pnpm run registry:build`.
10. **Gates** — `format` → `check` → `lint` → `test:unit -- --run` → `build`, all green, zero suppressions.

## Testing Plan (Constitution III / §7, all six areas)

| Area                               | Coverage                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Roles & ARIA                    | `table`/`rowgroup`/`row`/`columnheader`/`cell` from the composed `table`; `role="toolbar"` + `aria-orientation="horizontal"`; View trigger `role="combobox"` + `aria-label="Toggle columns"`; `aria-label` on all four pagination buttons and on every "Clear … filter" affordance; header-menu Asc/Desc/Hide exposed as `menuitemcheckbox` with `aria-checked` tracking `column.getIsSorted()` / `!column.getIsVisible()`, and Reset exposed as a plain `menuitem`; select-all checkbox `aria-label="Select all"` with `indeterminate`; empty state renders one cell with `colspan` = column count. |
| 2. Keyboard                        | `Enter`/`Space` opens the header menu, `ArrowDown`/`ArrowUp` moves between Asc/Desc/Reset/Hide, `Escape` closes and restores focus; `Tab` order across toolbar → view → table → pagination; command list `ArrowDown`/`Enter` toggles a facet; slider thumbs respond to `ArrowLeft`/`ArrowRight`/`Home`/`End`; `Enter` on a pagination button pages. All through `user-event`, never `fireEvent` where `user-event` suffices. |
| 3. Uncontrolled                    | `createDataTable({ initialState: { sorting, pagination, columnVisibility, columnPinning } })` seeds the table and internal interaction updates it (sort click, page click, facet toggle, hide column).                                                                                                                       |
| 4. Controlled                      | Writing `state.sorting = …` / `state.pagination = …` from outside re-renders; passing `state:` in the options makes the caller authoritative; every `on*Change` fires exactly once with the resolved next value and the component does not move on its own when the caller ignores the callback.                                |
| 5. RTL                             | Under `dir="rtl"` (`DirectionProvider` and bare `dir` attribute) the pagination first/previous/next/last chevrons invert while their `aria-label`s and their `disabled` logic do not; popover/menu horizontal navigation inverts via the composed primitives.                                                                    |
| 6. Guard rails                     | `disabled` on `ViewOptions` suppresses opening; a column with `enableSorting:false` + `enableHiding:false` renders plain text with no menu; a column with no `meta.variant` renders no filter control; `Reset` is absent until a sort/filter exists; `getDataTableContext()` throws ``\`<DataTable.Toolbar>\` must be used within \`<DataTable.Root>\` or given a \`table\` prop.`` and the test asserts `toThrow(/within/)`. |

Plus unit tests for the pure helpers in `data-table-utils.ts` (pinning style for left/right/last-left/
first-right, `getValidFilters`, `parseValuesAsNumbers`, `getSliderRange` step buckets, date parse/format
round-trips) and for the slider guard rail in the spec's Edge Cases (`from` cannot exceed `to`).

## Post-Design Constitution Re-Check (after Phase 1)

Re-evaluated against `research.md`, `data-model.md`, `contracts/public-api.md` and `quickstart.md`.
All ten verdicts stand at **PASS**. Three points the design phase sharpened:

- **IV (Composition).** The design *reduced* bespoke surface twice: the spec's planned new base `slider`
  component became a direct `bits-ui` `Slider` composition (research D-04), and the reactivity bridge
  turned out to need no `$effect` and no version counter at all (research D-02) — the options object's
  getters carry it. Bespoke code is now three items: the ~120-line adapter, the pinning-style
  calculator, and `DataTableFlexRender`. Each has a written justification naming the primitive evaluated.
- **VIII (Styling).** The one `z-index` in the port (`z-index: 1` on a pinned `<th>`/`<td>`) is
  explicitly not on an overlay component and is upstream's own value; recorded in research D-08 so it
  reads as a decision rather than an oversight.
- **III (Accessibility).** Two coverage limitations are stated rather than hidden (research D-10):
  slider dragging is asserted through keyboard rather than synthetic pointer geometry, and column
  pinning through `data-pinned`/`style` rather than computed layout — both because jsdom reports
  zero-size rects. Everything else in §7's six areas is asserted directly.

No new violation surfaced; Complexity Tracking stays empty.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | —         | —          | —                                      |
