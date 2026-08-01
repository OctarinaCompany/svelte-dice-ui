# Implementation Plan: Data Grid

**Branch**: `043-port-data-grid` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/043-port-data-grid/spec.md`

## Summary

Port Dice UI's **Data Grid** — a virtualized, spreadsheet-like editable grid — to Svelte 5 runes,
shipped as one shadcn-svelte registry item `data-grid`.

Upstream is a React hook (`useDataGrid`, 3541 lines) that owns a hand-rolled
`useSyncExternalStore` store holding **fourteen** slices (sorting, filters, row selection, cell
selection, focus, editing, cut cells, context menu, search query/matches/index/open, last clicked
row, paste dialog), plus a pure helper module (`lib/data-grid.ts`), a type module
(`types/data-grid.ts`) and ten components. The technical approach:

1. **The store becomes runes.** `useSyncExternalStore` + `store.batch()` disappears entirely —
   Svelte's fine-grained reactivity already batches, and `$derived` replaces every `useMemo`
   selector. The state lands in five classes in `.svelte.ts` modules, split by concern and
   coordinated by one root `DataGridState`, mirroring the split the already-ported
   `data-table` established (`DataTableState` + `createDataTable` + Symbol context).
2. **The table stays TanStack.** `createTable` from `@tanstack/table-core` with reactive getters
   installed on `table.options` — the exact bridge `data-table/data-table.svelte.ts` already uses
   and proved. No React TanStack package, no new npm dependency.
3. **The 20-prop plumbing collapses.** Upstream threads `dataGridRef`, `headerRef`, `rowMapRef`,
   `virtualItems`, `measureElement`, `cellSelectionMap`, `columnSizeVars`, `tableMeta`… from hook
   to component. In Svelte those are all fields on the state object, so `<DataGrid.Root>` takes a
   single `grid` prop and every part reads the rest from a Symbol context.
4. **Virtualization is bespoke and tiny.** Rows have a *known* fixed height per `rowHeight` preset,
   so a ~120-line windowing class replaces `@tanstack/react-virtual` (justification below).
5. **Clipboard and range arithmetic are pure functions**, extracted out of the state classes so the
   test suite can drive them directly — jsdom has neither a clipboard nor layout geometry.

Scope is the **core install only** (`@diceui/data-grid`); the separately-installable toolbar menus,
select-column helper, skeleton and undo/redo hook are out of scope per spec Assumptions.

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`), Svelte 5.56 (runes forced on
repo-wide in `vite.config.ts`)

**Primary Dependencies**: `@tanstack/table-core` ^8.21.3 (already installed — the `data-table` port
depends on it), `bits-ui` ^2.18.1, `@lucide/svelte` ^1.27.0, `svelte-sonner` ^1.1.1,
`tailwind-variants` ^3.3.0, `@internationalized/date` ^3.12.2 (Calendar). **Zero new npm
dependencies** — see research R-01.

**Existing primitives composed**: `$lib/components/ui/` — `badge`, `badge-overflow`, `button`,
`calendar`, `checkbox`, `command`, `context-menu`, `dialog`, `direction-provider`, `dropdown-menu`,
`file-upload`, `input`, `popover`, `radio-group`, `select`, `separator`, `skeleton`, `sonner`,
`textarea`, `tooltip`.

**Storage**: N/A — the consumer owns the data array; the grid reports whole-array replacements
through `onDataChange`.

**Testing**: Vitest 4 (jsdom) + `@testing-library/svelte` 5 + `@testing-library/user-event` 14,
`expect.requireAssertions` on, `globals: false`. Setup at `tests/setup.ts` (jest-dom, `cleanup()`,
`ResizeObserver` / `matchMedia` / pointer-capture / `scrollIntoView` shims).

**Target Platform**: SvelteKit 2 web app + shadcn-svelte registry consumers (SSR-safe: every
`window` / `navigator` / `document` read is inside `$effect` or an event handler).

**Project Type**: Component library (source-distributed registry item).

**Performance Goals**: 10 000-row grid stays interactive (SC-003) — only viewport-adjacent rows are
mounted (`overscan` default 6); cell-selection lookups are O(1) through a `Set<string>` of
`"rowIndex:columnId"` keys and a per-row `Map<number, Set<string>>` projection.

**Constraints**: No `any`, no suppressions, no `shadcn-svelte add` mid-port, semantic Tailwind
tokens only, every part carries `data-slot`, RTL must mirror every directional behaviour.

**Scale/Scope**: The largest port in the repo — 9 cell variants, ~24 source files, ~40 documented
props, ~30 keyboard bindings.

## Constitution Check

_GATE: evaluated before Phase 0 research, re-evaluated after Phase 1 design (both PASS)._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                             |
| ---- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect`/`$props`/`$bindable` + snippets only; all reactive logic in five `.svelte.ts` modules; `useSyncExternalStore` store dropped, no stores/`export let`/dispatchers |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | Every file under `.reference/diceui/docs/{components/data-grid,hooks/use-data-grid.ts,lib/data-grid.ts,types/data-grid.ts,types/radix/data-grid.ts}` + the MDX read at the pinned commit; all 9 divergences recorded in spec Assumptions |
| III  | Accessibility Is a MUST             | PASS    | WAI-ARIA grid pattern (`role="grid"`, `rowgroup`, `row`, `columnheader`, `gridcell`, `aria-rowcount`/`colcount`/`rowindex`/`colindex`/`sort`/`selected`); all ~30 keys mapped in contracts; RTL inversion for navigation, selection, pinning and scroll; six required test areas planned in §Tests |
| IV   | Composition Over Reimplementation   | PASS    | 18 existing `ui/*` primitives composed; 3 bespoke behaviours justified in writing below                                                                                              |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `src/lib/components/ui/data-grid/`, one part per file, `index.ts` barrel with short + prefixed names + types, `.js` extensions, one `registry:ui` entry, zero imports from `src/routes/**` or `$lib/components/docs/**` |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Generic `<TData extends RowData>` throughout; `unknown` + narrowing where upstream used loose casts; module-script `export type`; no `any`, no ignore comments, no config edits        |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit --run` → `build` scheduled as the final task; no `.skip`/`.todo`                                                                             |
| VIII | Styling Discipline                  | PASS    | `cn()` + `tv()`; upstream's `bg-yellow-100 dark:bg-yellow-900/30` / `bg-orange-200` search highlights map to `bg-warning/15` and `bg-warning/35` (CLAUDE.md §6 status-token table); `data-slot` on every part; booleans written `cond ? '' : undefined` |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/data-grid/+page.svelte`; one `<ComponentPreview>` per upstream demo file (`data-grid-demo.tsx` is the only one) plus a props table                        |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/043-port-data-grid/`; no git write commands; no writes to `.reference/`, `scripts/`, `.port-*`                                                             |

**Bespoke behaviour justification (Principle IV)** — three items, each with the primitive evaluated:

1. **Row virtualization** (`data-grid-virtualizer.svelte.ts`, ~120 lines).
   _Evaluated_: `bits-ui` — has no virtualizer of any kind; `$lib/components/ui/listbox` — its
   `virtual` flag means *virtual focus* (`aria-activedescendant`), not windowing;
   `@tanstack/virtual-core` — would be a new npm dependency, and its value proposition is *dynamic*
   measurement via `ResizeObserver`, which is inert under jsdom (every rect is 0) and unnecessary
   here because `getRowHeightValue(rowHeight)` gives an exact fixed row height. _Capability lacking_:
   nothing in the repo maps a scroll offset + container height to a `[startIndex, endIndex]` window.
   The class is a pure function of `(scrollTop, viewportHeight, rowHeight, rowCount, overscan)` and
   is therefore fully unit-testable without layout.

2. **Cell-range selection state machine** (`data-grid-selection.svelte.ts`).
   _Evaluated_: `bits-ui` — offers single/multiple *item* selection (Listbox, Select), not a
   two-dimensional rectangular cell range with anchor/edge semantics; `$lib/components/ui/table` —
   presentational only. _Capability lacking_: no primitive models a `{start, end}` cell rectangle,
   Ctrl-click toggling, or Ctrl+Shift+Arrow extend-to-extremity.

3. **TSV clipboard parse/serialize + per-variant coercion** (`data-grid-utils.ts`, pure).
   _Evaluated_: nothing in `bits-ui` or `ui/*` touches the clipboard. _Capability lacking_: the
   quoted-field/embedded-newline TSV parser and the nine per-variant validation rules are upstream
   domain logic with no primitive equivalent. Ported verbatim from `lib/data-grid.ts` and the
   `onCellsPaste` switch, extracted into pure functions so tests can drive them without a clipboard.

Everything else is composed: Popover/Select/Command/Calendar/Checkbox/Textarea/Badge for the cell
editors, DropdownMenu for the context menu and column header menu, Dialog for the paste and
shortcuts dialogs, `direction-provider`'s `useDirection()` for RTL, `badge-overflow` for the
multi-select badge truncation, `file-upload` for the file cell's dropzone/validation, `svelte-sonner`
for toasts.

## Project Structure

### Documentation (this feature)

```text
specs/043-port-data-grid/
├── plan.md              # This file
├── research.md          # Phase 0 output — 10 decisions
├── data-model.md        # Phase 1 output — entities + state transitions
├── quickstart.md        # Phase 1 output — validation guide
├── contracts/
│   ├── public-api.md    # every export, prop, snippet, callback
│   └── keyboard.md      # the full key → action contract, LTR and RTL
├── checklists/
│   └── requirements.md  # written by /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/data-grid/
├── index.ts                              # barrel: short names + DataGrid* aliases + types + helpers
├── types.ts                              # ← types/data-grid.ts + types/radix/data-grid.ts
├── data-grid-utils.ts                    # ← lib/data-grid.ts + extracted paste/serialize helpers (pure)
├── data-grid.svelte.ts                   # DataGridState + createDataGrid + Symbol context  ← useDataGrid (core)
├── data-grid-selection.svelte.ts         # DataGridSelectionState                            ← useDataGrid (selection/nav)
├── data-grid-clipboard.svelte.ts         # DataGridClipboardState                            ← useDataGrid (copy/cut/paste)
├── data-grid-search.svelte.ts            # DataGridSearchState                               ← useDataGrid (search)
├── data-grid-virtualizer.svelte.ts       # DataGridVirtualizer                               ← @tanstack/react-virtual
├── data-grid.svelte                      # Root                    ← data-grid.tsx
├── data-grid-row.svelte                  # Row                     ← data-grid-row.tsx
├── data-grid-cell.svelte                 # variant router          ← data-grid-cell.tsx
├── data-grid-cell-wrapper.svelte         # shared cell shell       ← data-grid-cell-wrapper.tsx
├── data-grid-short-text-cell.svelte      # ┐
├── data-grid-long-text-cell.svelte       # │
├── data-grid-number-cell.svelte          # │
├── data-grid-url-cell.svelte             # │
├── data-grid-checkbox-cell.svelte        # ├ ← data-grid-cell-variants.tsx (9 exports, one file each:
├── data-grid-select-cell.svelte          # │    CLAUDE.md §3 forbids two components in one .svelte file)
├── data-grid-multi-select-cell.svelte    # │
├── data-grid-date-cell.svelte            # │
├── data-grid-file-cell.svelte            # ┘
├── data-grid-column-header.svelte        # ┐ ← data-grid-column-header.tsx
├── data-grid-column-resizer.svelte       # ┘
├── data-grid-context-menu.svelte         #   ← data-grid-context-menu.tsx
├── data-grid-paste-dialog.svelte         #   ← data-grid-paste-dialog.tsx
├── data-grid-keyboard-shortcuts.svelte   # ┐ ← data-grid-keyboard-shortcuts.tsx
├── data-grid-shortcut-card.svelte        # ┘
├── data-grid-search.svelte               #   ← data-grid-search.tsx
├── data-grid.test.svelte                 # test-only harness (mirrors data-table.test.svelte)
└── data-grid.test.ts                     # colocated tests (NOT listed in registry.json)

src/routes/docs/components/data-grid/
└── +page.svelte                          # one <ComponentPreview> per upstream demo file + props table

registry.json                             # append exactly one registry:ui entry named "data-grid"
```

**Structure Decision**: 28 source files + 1 demo route + 1 registry entry. Folder slug
`data-grid` == demo route segment `data-grid` == registry item name `data-grid`. Every upstream file
maps to at least one file above; the only 1→N split is `data-grid-cell-variants.tsx` (nine exported
components → nine `.svelte` files, forced by CLAUDE.md §3) and `data-grid-column-header.tsx`
(header + resizer). `data-grid.test.svelte` is a test-only harness (the pattern
`data-table.test.svelte` already established) needed because `createDataGrid()` calls runes and must
run during component initialisation; it is excluded from `registry.json`.

## Public API

Every export of `src/lib/components/ui/data-grid/index.ts`. Types are exported from each part's
`<script lang="ts" module>` and re-exported by the barrel. `TData extends RowData` throughout.

### 1. `createDataGrid<TData>(options): DataGridState<TData>` ← `useDataGrid`

Called during component initialisation. Options — every one carries its upstream JSDoc verbatim:

| Option                     | Type                                                                                    | Default   | Notes                                                             |
| -------------------------- | --------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------- |
| `data`                     | `TData[] \| (() => TData[])`                                                            | required  | getter form keeps it reactive (matches `createDataTable`)         |
| `columns`                  | `DataGridColumnDef<TData>[] \| (() => DataGridColumnDef<TData>[])`                       | required  | `meta.cell` selects the variant, `meta.label` the header label    |
| `getRowId`                 | `(row, index, parent?) => string`                                                        | —         | passthrough to table-core                                         |
| `defaultColumn`            | `Partial<ColumnDef<TData>>`                                                              | `{ minSize: 60, maxSize: 800 }` | merged over the port's defaults                 |
| `initialState`             | `DataGridInitialState`                                                                   | —         | `sorting`, `columnFilters`, `rowSelection`, `columnPinning`, …    |
| `state`                    | `Partial<TableState> \| (() => Partial<TableState>)`                                     | —         | controlled override, wins over internal slices                    |
| `onDataChange`             | `(data: TData[]) => void`                                                                | —         | receives the **full** updated array                               |
| `onRowAdd`                 | `(event?: MouseEvent) => Partial<CellPosition> \| Promise<Partial<CellPosition> \| null> \| null \| void` | — | return value = cell to focus; `null` suppresses focus |
| `onRowsAdd`                | `(count: number) => void \| Promise<void>`                                               | —         | bulk add for paste expansion                                      |
| `onRowsDelete`             | `(rows: TData[], rowIndices: number[]) => void \| Promise<void>`                          | —         | presence enables the delete affordances                           |
| `onPaste`                  | `(updates: CellUpdate[]) => void \| Promise<void>`                                       | —         | fires before `onDataChange` for a paste                           |
| `onFilesUpload`            | `(p: { files: File[]; rowIndex: number; columnId: string }) => Promise<FileCellData[]>`   | —         | file cell upload                                                  |
| `onFilesDelete`            | `(p: { fileIds: string[]; rowIndex: number; columnId: string }) => void \| Promise<void>` | —         | file cell delete                                                  |
| `onSortingChange`          | `(sorting: SortingState) => void`                                                        | —         | resolved value, never the updater                                 |
| `onColumnFiltersChange`    | `(filters: ColumnFiltersState) => void`                                                  | —         | resolved value                                                    |
| `onRowSelectionChange`     | `(selection: RowSelectionState) => void`                                                 | —         | resolved value (Divergence 5)                                     |
| `onRowHeightChange`        | `(rowHeight: RowHeightValue) => void`                                                    | —         |                                                                   |
| `rowHeight`                | `RowHeightValue`                                                                         | `'short'` | `short` 36px/1 line · `medium` 56/2 · `tall` 76/3 · `extra-tall` 96/4 |
| `overscan`                 | `number`                                                                                 | `6`       | rows rendered outside the viewport                                |
| `dir`                      | `Direction`                                                                              | ambient   | falls back to `useDirection()` from `direction-provider`          |
| `autoFocus`                | `boolean \| Partial<CellPosition>`                                                       | `false`   | `true` → first navigable cell                                     |
| `enableSingleCellSelection`| `boolean`                                                                                | `false`   |                                                                   |
| `enableColumnSelection`    | `boolean`                                                                                | `false`   | header click selects the whole column                             |
| `enableSearch`             | `boolean`                                                                                | `false`   | Ctrl/Cmd+F                                                        |
| `enablePaste`              | `boolean`                                                                                | `false`   | Ctrl/Cmd+V                                                        |
| `readOnly`                 | `boolean`                                                                                | `false`   | blocks every mutation path                                        |

`DataGridState<TData>` public surface (all `$state`/`$derived`-backed, all readable from context):

`table`, `columnIds`, `navigableColumnIds`, `rows`, `dir`, `readOnly`, `rowHeight`,
`focusedCell`, `editingCell`, `contextMenu`, `pasteDialog`, `columnSizeVars`, `cellSelectionMap`,
`selection` (`DataGridSelectionState`), `search` (`DataGridSearchState` — `undefined` unless
`enableSearch`), `clipboard` (`DataGridClipboardState`), `virtualizer` (`DataGridVirtualizer`),
and the methods `focusCell`, `blurCell`, `navigateCell`, `startEditing`, `stopEditing`,
`updateData`, `clearCells`, `addRow`, `deleteRows`, `setRowHeight`, `selectRow`, `handleKeydown`,
`registerCell`, `registerRow`, `getIsCellSelected`, `getIsSearchMatch`, `getIsActiveSearchMatch`,
`getVisualRowIndex`.

### 2. `<DataGrid.Root>` ← `DataGrid` — `data-slot="data-grid"` / `"data-grid-wrapper"`

| Prop             | Type                     | Default    | Bindable |
| ---------------- | ------------------------ | ---------- | -------- |
| `grid`           | `DataGridState<TData>`   | required   | no       |
| `dir`            | `Direction`              | `grid.dir` | no       |
| `height`         | `number`                 | `600`      | no       |
| `stretchColumns` | `boolean`                | `false`    | no       |
| `ref`            | `HTMLDivElement \| null` | `null`     | **yes**  |
| `class`          | `string`                 | —          | no       |
| …rest            | `HTMLAttributes<HTMLDivElement>` | —  | no       |

Snippets: `children?: Snippet` (rendered after the grid, for toolbars/overlays),
`row?: Snippet<[{ row: Row<TData>; rowIndex: number; top: number }]>` (override row rendering),
`empty?: Snippet` (rendered inside the body when `rows.length === 0`).
Callbacks: none of its own — everything flows through `createDataGrid` options.

### 3. `<DataGrid.Row>` ← `DataGridRow` — `data-slot="data-grid-row"`

`grid?` (context default), `row: Row<TData>`, `rowIndex: number`, `top: number`, `ref` (bindable),
`class`, …rest. Snippet: `cell?: Snippet<[{ cell: Cell<TData, unknown>; colIndex: number }]>`.

### 4. `<DataGrid.Cell>` ← `DataGridCell` — `data-slot="data-grid-cell"`

`grid?`, `cell: Cell<TData, unknown>`, `rowIndex: number`, `columnId: string`. Routes on
`cell.column.columnDef.meta?.cell?.variant`, defaulting to short text.

### 5. `<DataGrid.CellWrapper>` ← `DataGridCellWrapper` — `data-slot="data-grid-cell-wrapper"`

`grid?`, `cell`, `rowIndex`, `columnId`, `rowHeight`, `isEditing`, `isFocused`, `isSelected`,
`isSearchMatch`, `isActiveSearchMatch`, `readOnly`, `ref` (bindable), `class`, `onkeydown`,
`onclick`, …rest, `children?: Snippet`. Emits `data-editing` / `data-focused` / `data-selected` /
`data-search-match` / `data-active-search-match` / `data-cut` as `'' | undefined`.

### 6. Cell variants — `data-slot="data-grid-<variant>-cell"`

`ShortTextCell`, `LongTextCell`, `NumberCell`, `UrlCell`, `CheckboxCell`, `SelectCell`,
`MultiSelectCell`, `DateCell`, `FileCell`. All take the same `DataGridCellProps<TData>`
(`CheckboxCell` ignores `isEditing`, matching upstream's `Omit`).

### 7. `<DataGrid.ColumnHeader>` ← `DataGridColumnHeader` — `data-slot="data-grid-column-header"`

`grid?`, `header: Header<TData, unknown>`, `class`, …rest. Renders variant icon + tooltip, label,
sort asc/desc/remove, pin left/right/unpin, hide column, and `<DataGrid.ColumnResizer>` when
`column.getCanResize()`.

### 8. `<DataGrid.ColumnResizer>` — `data-slot="data-grid-column-resizer"`

`header`, `label`. `role="separator"`, `aria-orientation="vertical"`,
`aria-label="Resize {label} column"`, `aria-valuenow/min/max`, `tabindex=0`; double-click resets size.

### 9. `<DataGrid.ContextMenu>` ← `DataGridContextMenu` — `data-slot="data-grid-context-menu"`

`grid?`. Copy · Cut · Clear · (Delete rows, only when `onRowsDelete` was provided). Cut and Clear
are `disabled` when `readOnly`.

### 10. `<DataGrid.PasteDialog>` ← `DataGridPasteDialog` — `data-slot="data-grid-paste-dialog"`

`grid?`. Radio choice "Create new rows" (default) / "Keep current rows", Cancel and Continue.

### 11. `<DataGrid.Search>` ← `DataGridSearch` — `data-slot="data-grid-search"`, `role="search"`

`search?: DataGridSearchState` (context default), `class`, …rest. Input (150 ms debounce),
Previous/Next match buttons, Close button, and the `n of m` / `No results` / `Type to search` status.

### 12. `<DataGrid.KeyboardShortcuts>` ← `DataGridKeyboardShortcuts` — `data-slot="data-grid-keyboard-shortcuts"`

| Prop               | Type      | Default | Bindable |
| ------------------ | --------- | ------- | -------- |
| `open`             | `boolean` | —       | **yes**  |
| `defaultOpen`      | `boolean` | `false` | no       |
| `onOpenChange`     | `(open: boolean) => void` | — | no |
| `enableSearch`     | `boolean` | `false` | no       |
| `enableUndoRedo`   | `boolean` | `false` | no       |
| `enablePaste`      | `boolean` | `false` | no       |
| `enableRowAdd`     | `boolean` | `false` | no       |
| `enableRowsDelete` | `boolean` | `false` | no       |

Opens on Ctrl/Cmd+`/`; groups Navigation, Selection, Editing, Search, Sorting, General, filtered by
its own search field.

### 13. `<DataGrid.ShortcutCard>` — `keys: string[]`, `description: string`.

### 14. Exported state classes, context helpers and pure utilities

`DataGridState`, `DataGridSelectionState`, `DataGridClipboardState`, `DataGridSearchState`,
`DataGridVirtualizer`, `createDataGrid`, `setDataGridContext`, `getDataGridContext`,
`hasDataGridContext`; and from `data-grid-utils.ts`: `getCellKey`, `parseCellKey`, `parseTsv`,
`serializeCellsToTsv`, `coercePastedValue`, `getEmptyCellValue`, `getRowHeightValue`,
`getLineCount`, `matchSelectOption`, `getIsFileCellData`, `getIsInPopover`, `getUrlHref`,
`parseLocalDate`, `formatDateToString`, `formatDateForDisplay`, `formatFileSize`, `getFileIcon`,
`getColumnVariant`, `getColumnPinningStyle`, `getColumnBorderVisibility`, `getScrollDirection`,
`scrollCellIntoView`, `NON_NAVIGABLE_COLUMN_IDS`.

Types: `CellPosition`, `CellRange`, `CellUpdate`, `CellOpts`, `CellSelectOption`, `FileCellData`,
`SelectionState`, `SearchState`, `ContextMenuState`, `PasteDialogState`, `NavigationDirection`,
`RowHeightValue`, `Direction`, `DataGridColumnDef`, `DataGridInitialState`, `CreateDataGridOptions`,
and one `Props` type per component.

The barrel exports both namespace-friendly short names (`Root`, `Row`, `Cell`, `CellWrapper`,
`ShortTextCell`, …, `Search`, `ContextMenu`, `PasteDialog`, `KeyboardShortcuts`) and prefixed
aliases (`DataGrid`, `DataGridRow`, `DataGridCell`, …), exactly like `ui/data-table/index.ts`.

## Divergences from upstream (all recorded in spec.md § Assumptions)

| # | Upstream                                              | Here                                                                     | Reason                                                                                  |
| - | ----------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 1 | `useDataGrid` returns 20 props spread onto `<DataGrid>` | `createDataGrid()` returns `DataGridState`; `<DataGrid.Root grid={…}>`   | refs/virtual items/maps are class fields in Svelte; parts read a Symbol context           |
| 2 | `TableMeta` carries 25 callbacks                      | same callbacks are methods on `DataGridState`                            | `table.options.meta` is not reactive in table-core; context is                            |
| 3 | `@tanstack/react-virtual`                             | bespoke `DataGridVirtualizer`                                            | zero-new-dependency rule + fixed row heights + jsdom testability (Principle IV item 1)   |
| 4 | `data-grid-cell-variants.tsx` (9 components, 1 file)  | 9 `.svelte` files                                                        | CLAUDE.md §3                                                                              |
| 5 | `onRowSelectionChange(updater)`                       | `onRowSelectionChange(resolvedValue)`                                    | matches the ported `data-table`; updaters are a React idiom                               |
| 6 | `Kbd` / `KbdGroup` shadcn primitives                  | a `data-slot="data-grid-kbd"` `<kbd>` styled with tokens                 | `kbd` is not installed and `shadcn-svelte add` is forbidden mid-port (CLAUDE.md §1)      |
| 7 | `bg-yellow-100 dark:bg-yellow-900/30` / `bg-orange-200` search highlight | `bg-warning/15` / `bg-warning/35`                     | Principle VIII forbids raw palette colours and manual `dark:`                            |
| 8 | `contentEditable` + `document.execCommand('insertText')` seeding | `contenteditable` + Range/Selection seeding, no `execCommand` | `execCommand` is deprecated and unimplemented in jsdom; behaviour is identical            |
| 9 | `DataGridKeyboardShortcuts` holds `open` internally    | `open` is `$bindable` with `defaultOpen`/`onOpenChange`                  | Constitution III requires a controlled **and** uncontrolled mode for value-bearing props  |
| 10 | JSDoc `@default 3` vs `const OVERSCAN = 6`            | `overscan` defaults to `6`                                                | implementation parity wins; discrepancy recorded per Principle II                         |

## Implementation phases (what `/speckit-tasks` will expand)

**P0 — Foundations (blocking).** `types.ts`; `data-grid-utils.ts` (pure port of `lib/data-grid.ts`
+ `serializeCellsToTsv` + `coercePastedValue` extracted from the hook). Unit tests for `parseTsv`
(quoted fields, embedded tabs/newlines, ragged rows, fallback column count), `coercePastedValue`
(all nine variants incl. skip paths), `getEmptyCellValue`, `getUrlHref` (dangerous protocols),
`parseLocalDate` (Feb 30 rejection), `getColumnPinningStyle` under RTL.

**P1 — State (US1, US2).** `data-grid-virtualizer.svelte.ts`; `data-grid-selection.svelte.ts`
(range arithmetic, Ctrl-click toggle, select-all, select-column, navigation math incl. RTL and
clamping); `data-grid.svelte.ts` (`DataGridState`, table bridge, focus/editing, `updateData`,
`clearCells`, `addRow`, `deleteRows`, `handleKeydown`, context). Tests drive the classes directly.

**P2 — Structure (US1, US2).** `data-grid.svelte`, `data-grid-row.svelte`,
`data-grid-cell-wrapper.svelte`, `data-grid-cell.svelte`, `data-grid-column-header.svelte`,
`data-grid-column-resizer.svelte`, `data-grid.test.svelte`. Tests: roles/ARIA, focus ring,
keyboard navigation through `userEvent`, RTL inversion, `readOnly` guard rails, provider-less throw.

**P3 — Cell variants (US1).** Nine variant files, in the order short-text → number → checkbox →
url → select → multi-select → date → long-text → file. Tests per variant: display, enter/exit edit,
commit on Enter/Tab, discard on Escape, `readOnly` no-op.

**P4 — Clipboard (US3).** `data-grid-clipboard.svelte.ts`, `data-grid-paste-dialog.svelte`.
Tests: helpers driven directly; `navigator.clipboard` stubbed with `vi.fn()` for the DOM-visible
effects (cut marking, dialog open/rowsNeeded, toast text, post-paste selection).

**P5 — Search (US4).** `data-grid-search.svelte.ts`, `data-grid-search.svelte`.

**P6 — Row management + context menu (US5).** `data-grid-context-menu.svelte`; the row-add footer
cell and Shift+Enter / Ctrl+Backspace paths in `DataGridState`.

**P7 — Shortcuts dialog (US6).** `data-grid-keyboard-shortcuts.svelte`,
`data-grid-shortcut-card.svelte`.

**P8 — Packaging.** `index.ts` barrel; demo route; `registry.json` entry; `pnpm run registry:build`;
the four quality gates.

## Tests (Constitution III — all six areas)

Colocated at `src/lib/components/ui/data-grid/data-grid.test.ts`, driven through
`data-grid.test.svelte` (a harness component, because `createDataGrid()` calls runes).

1. **Roles & ARIA** — `role="grid"` with `aria-label`, `aria-rowcount`, `aria-colcount`;
   `rowgroup` header/body/footer; `row` with `aria-rowindex` and `aria-selected`; `columnheader`
   with `aria-colindex` and `aria-sort` (`ascending`/`descending`/`none`); `gridcell` with
   `aria-colindex`; resizer `separator` with `aria-valuenow/min/max`; search `role="search"`;
   accessible names for Previous match / Next match / Close search / Add row.
2. **Keyboard** — every binding in `contracts/keyboard.md` through `userEvent`: arrows, Tab/Shift+Tab,
   Home/End, Ctrl+Home/End, Ctrl+Arrow, PageUp/Down, Alt+PageUp/Down, Shift+Arrow,
   Ctrl+Shift+Arrow, Ctrl+A, Escape (edit → selection → blur), Enter, F2, Space, printable
   characters, Shift+Enter, Delete/Backspace, Ctrl+Backspace/Delete, Ctrl+C/X/V, Ctrl+F, Ctrl+`/`.
3. **Uncontrolled** — `defaultOpen` on the shortcuts dialog; `initialState.sorting`/`columnPinning`;
   internal edits move the grid's own state.
4. **Controlled** — `bind:open`; `state` option makes the parent authoritative; `onDataChange`
   fires with the full next array and the component does not mutate the input array.
5. **RTL** — with `dir="rtl"`: ArrowLeft/ArrowRight invert, Tab/Shift+Tab invert,
   Ctrl+Shift+ArrowLeft selects to the *last* column, `getColumnPinningStyle` swaps `left`/`right`.
6. **Guard rails** — `readOnly` blocks edit start, toggle, clear, cut, paste and row delete while
   leaving navigation, selection and search working; `<DataGrid.Row>` / `<DataGrid.Cell>` /
   `<DataGrid.Search>` rendered outside `<DataGrid.Root>` throw
   ``expect(() => render(...)).toThrow(/must be used within `<DataGrid.Root>`/)``.

**jsdom boundaries (spec Assumptions, restated as test policy).** Range arithmetic, TSV
parse/serialize, paste coercion, virtual-window computation and navigation math are tested against
the state classes and pure functions with synthetic inputs. DOM tests cover only what jsdom can
produce: discrete `click` / `keydown` / `contextmenu` events, attribute and text assertions, and a
`vi.fn()`-stubbed `navigator.clipboard`. Drag-to-select geometry and `getBoundingClientRect`-driven
auto-scroll are asserted through the state classes, never through synthetic mouse geometry.

## Complexity Tracking

> No Constitution Check violations. The three bespoke behaviours are justified in the Principle IV
> section above rather than carried as violations, and every API divergence is recorded in
> spec.md § Assumptions per Principle II. This table is intentionally empty.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | none      | —          | —                                      |
