---
description: 'Task list for the Data Grid port'
---

# Tasks: Data Grid

**Input**: Design documents from `specs/043-port-data-grid/` (plan.md, spec.md, research.md, data-model.md, contracts/public-api.md, contracts/keyboard.md, quickstart.md)

**Tests**: MANDATORY per Constitution Principle III. All tests are colocated at
`src/lib/components/ui/data-grid/data-grid.test.ts`, driven through the rune-initialising harness
`src/lib/components/ui/data-grid/data-grid.test.svelte` (the pattern `data-table.test.svelte`
established), per plan.md §Tests.

**Organization**: Phase order is fixed by the task brief — Setup → Tests → Core component files →
Barrel and types → Demo route → Registry entry and docs polish → Verification — rather than the
default per-user-story phase grouping. Each implementation/test task still carries a `[Story]` tag
(US1–US6, from spec.md) for traceability back to the user stories it serves; structural glue that
serves the whole grid equally is left untagged, mirroring how the template leaves Setup/Polish
tasks untagged.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 (browse/edit), US2 (keyboard nav/selection), US3 (clipboard), US4 (search),
  US5 (row management/context menu), US6 (shortcuts dialog)
- Every task names its exact file path

## Path Conventions

- Component source: `src/lib/components/ui/data-grid/`
- Tests: colocated at `src/lib/components/ui/data-grid/data-grid.test.ts` (+ harness `data-grid.test.svelte`)
- Demo route: `src/routes/docs/components/data-grid/+page.svelte`
- Registry: `registry.json` at the repository root

---

## Phase 1: Setup

**Purpose**: Confirm the zero-new-dependency premise and stub the registry entry.

- [X] T001 Verify every dependency the port needs is already installed — check `package.json` for
      `@tanstack/table-core`, `bits-ui`, `@lucide/svelte`, `svelte-sonner`, `tailwind-variants`,
      `@internationalized/date` — and confirm every composed primitive already exists under
      `src/lib/components/ui/` (`badge`, `badge-overflow`, `button`, `calendar`, `checkbox`,
      `command`, `context-menu`, `dialog`, `direction-provider`, `dropdown-menu`, `file-upload`,
      `input`, `popover`, `radio-group`, `select`, `separator`, `skeleton`, `sonner`, `textarea`,
      `tooltip`). No installs, no `shadcn-svelte add` — this is a confirmation task only
      (research.md R-01).
- [X] T002 [P] Append a stub `registry.json` entry named `"data-grid"` (`type: "registry:ui"`,
      `title`, `description`, empty `registryDependencies`/`dependencies` arrays, `files: [{ "path":
      "src/lib/components/ui/data-grid/index.ts", "type": "registry:ui" }]`) to the `items` array in
      `registry.json` at the repository root — a placeholder completed with the full file list in
      Phase 6 (T047).

**Checkpoint**: Dependencies confirmed, registry placeholder present — implementation can begin.

---

## Phase 2: Tests (write first — Constitution Principle III)

**Purpose**: Author every required test area against the not-yet-existing public API so the suite is
red before Phase 3 lands, then goes green component-by-component as Phase 3 proceeds.

> **NOTE**: These tests will not compile until the barrel (T045) exists — that is expected: they are
> written against the documented contract (contracts/public-api.md, contracts/keyboard.md,
> data-model.md), not against code that exists yet.

- [X] T003 [P] Create the test-only harness component
      `src/lib/components/ui/data-grid/data-grid.test.svelte` (mirrors
      `data-table/data-table.test.svelte`) — calls `createDataGrid(options)` during component
      initialisation (runes require this), exposes the resulting `DataGridState` and renders
      `<DataGrid.Root>` plus whichever parts a given test run needs, via props/snippets the test file
      controls.
- [X] T004 [US3] Write the pure-utils test suite in
      `src/lib/components/ui/data-grid/data-grid.test.ts` (new file) covering `parseTsv` (quoted
      fields, embedded tabs/newlines, ragged rows, fallback column count), `serializeCellsToTsv`,
      `coercePastedValue` for all nine variants including their skip paths, `getEmptyCellValue`,
      `getUrlHref` (dangerous protocols rejected), `parseLocalDate` (Feb 30 rejection),
      `getColumnPinningStyle` under `dir="rtl"`, `getCellKey`/`parseCellKey` round-tripping.
- [X] T005 [US2] Add the `DataGridSelectionState` test suite to
      `src/lib/components/ui/data-grid/data-grid.test.ts`: range arithmetic (`selectRange` with
      unordered corners), Ctrl/Cmd-click toggle, `selectAll`, `selectColumn`, and navigation math
      (arrow/Home/End/Ctrl+Home/Ctrl+End/PageUp/PageDown/Alt+PageUp/PageDown) including clamping and
      RTL inversion, driven directly against the state class per data-model.md §2.
- [X] T006 [US2] Add the `DataGridVirtualizer` test suite to
      `src/lib/components/ui/data-grid/data-grid.test.ts`: `startIndex`/`endIndex`/`virtualItems`/
      `totalSize` for representative `(scrollTop, viewportHeight, rowHeight, rowCount, overscan)`
      tuples across all four `RowHeightValue` presets, and `scrollToIndex` with `start`/`center`/`end`
      alignment.
- [X] T007 [US3] Add the `DataGridClipboardState` test suite to
      `src/lib/components/ui/data-grid/data-grid.test.ts`: `copy()`/`cut()` serialization with
      `navigator.clipboard` stubbed via `vi.fn()`, cut-cell marking, `paste()` entering
      `pasteDialog.open` with the correct `rowsNeeded` when the target overruns existing rows, and
      cut-source cells clearing to their column's empty value once a paste completes; and the toast
      text emitted for copy, cut, a clean paste and a paste with skipped cells, asserted against a
      `vi.fn()`-spied `toast` module (`N cells copied`, `N cells cut`, `N cells pasted`,
      `N cells pasted, M skipped`, `M cells skipped`, FR-027).
- [X] T008 [US4] Add the `DataGridSearchState` test suite to
      `src/lib/components/ui/data-grid/data-grid.test.ts`: `setQuery` debounced 150 ms into
      `search()`, `matches`/`matchIndex` population, `next()`/`prev()` wrap-around at both ends,
      `isMatch`/`isActiveMatch`.
- [X] T009 [US1] Add the roles & ARIA test suite to
      `src/lib/components/ui/data-grid/data-grid.test.ts`: `role="grid"` with `aria-label`,
      `aria-rowcount`/`aria-colcount`; `rowgroup` header/body/footer; `row` with `aria-rowindex`
      (`rowIndex + 2` for body rows, `rows.length + 2` for the footer row)/`aria-selected`;
      `columnheader` with `aria-colindex`/`aria-sort`; `gridcell` with `aria-colindex`; resizer
      `role="separator"` with `aria-orientation`/`aria-valuenow/min/max`; `role="search"`;
      accessible names for Previous match / Next match / Close search / Add row; roving tabindex —
      grid container `tabindex="0"`, rows/cell containers `tabindex="-1"`, exactly one cell wrapper
      `tabindex="0"` and it follows the focused cell (FR-011a).
- [X] T010 [US2] Add the keyboard-interaction test suite to
      `src/lib/components/ui/data-grid/data-grid.test.ts`, driven through `userEvent`, asserting
      every row of `contracts/keyboard.md` (navigation, selection, editing, clipboard, search,
      general) including the documented handler precedence order.
- [X] T011 [US1] Add the uncontrolled-state test suite to
      `src/lib/components/ui/data-grid/data-grid.test.ts`: `defaultOpen` seeds the shortcuts dialog,
      `initialState.sorting`/`initialState.columnPinning` seed the table, and internal edits move the
      grid's own state without any controlling prop; `autoFocus` (`true`,
      `{ rowIndex: 1, columnId: 'name' }`, and `false`) focuses the documented cell on mount and
      no-ops on an empty grid (FR-037).
- [X] T012 [US1] Add the controlled-state test suite to
      `src/lib/components/ui/data-grid/data-grid.test.ts`: `bind:open` on the shortcuts dialog, the
      `state` option makes the parent authoritative over `TableState`, and `onDataChange` fires with
      the full next array while the original input array is never mutated.
- [X] T013 [US2] Add the RTL test suite to `src/lib/components/ui/data-grid/data-grid.test.ts`:
      `dir="rtl"` inverts ArrowLeft/ArrowRight and Tab/Shift+Tab, `Ctrl+Shift+ArrowLeft` selects to
      the last column, and `getColumnPinningStyle` swaps which physical edge `"left"`/`"right"` stick to.
- [X] T014 [US1] Add the guard-rail / edge-case test suite to
      `src/lib/components/ui/data-grid/data-grid.test.ts`: `readOnly` blocks edit start, toggle,
      clear, cut, paste and row delete while navigation/selection/search keep working; an empty
      `data` array renders without error and makes Ctrl+End/select-all/paste-target no-ops; a single
      navigable column no-ops left/right instead of losing focus; zero navigable columns disables
      keyboard navigation without erroring; `<DataGrid.Row>`, `<DataGrid.Cell>` and
      `<DataGrid.Search>` rendered outside `<DataGrid.Root>` each throw
      `` /must be used within `<DataGrid.Root>`/ ``.
- [X] T015 [US1] Add the cell-variant test suite to
      `src/lib/components/ui/data-grid/data-grid.test.ts` covering all nine variants (short text,
      long text, number, url, checkbox, select, multi-select, date, file): display value, enter/exit
      edit mode, commit on Enter/Tab, discard on Escape, and `readOnly` no-op, per plan.md P3.
- [X] T016 [US5] Add the row-management & context-menu test suite to
      `src/lib/components/ui/data-grid/data-grid.test.ts`: `onRowAdd` focuses the cell its return
      value names; `onRowsDelete` fires with row data and indices via both Ctrl/Cmd+Backspace/Delete
      and the context menu, and focus lands on the row now occupying the deleted row's index; the
      delete-rows menu item is absent when `onRowsDelete` is not provided; Copy/Cut/Clear are scoped
      to the current selection (or the right-clicked cell alone).
- [X] T017 [US6] Add the keyboard-shortcuts-dialog test suite to
      `src/lib/components/ui/data-grid/data-grid.test.ts`: Navigation/Selection/Editing/Sorting/
      General groups render and Search is absent with no optional flags set; `enableSearch` adds the
      Search group; `enablePaste`/`enableRowAdd`/`enableRowsDelete`/`enableUndoRedo` each add their
      row to the Editing group; typing into the dialog's own filter field narrows the visible
      shortcuts.
- [X] T017a [US1] Add the column-header/resizer behaviour test suite to
      `src/lib/components/ui/data-grid/data-grid.test.ts`: sort cycles ascending → descending → none
      and updates `aria-sort`; pin left/right/unpin updates the pinning state and the resolved style
      side; hide removes the column; double-clicking the resizer resets to the auto-fit width
      clamped at `minSize` (FR-005/FR-006/FR-007).

**Checkpoint**: The full test contract exists and is red (compile errors against a nonexistent
barrel are expected, per the NOTE above). Phase 3 makes each suite's assertions pass, file by file;
every suite only *compiles* once the barrel (T045, Phase 4) exists.

---

## Phase 3: Core component files

### P0 — Foundations (blocking; every later file depends on these)

- [X] T018 [P] Create `src/lib/components/ui/data-grid/types.ts` — port `types/data-grid.ts` +
      `types/radix/data-grid.ts`: `CellPosition`, `CellRange`, `CellUpdate`, `CellOpts` (discriminated
      union on `variant`, all nine members per data-model.md §1), `CellSelectOption`, `FileCellData`,
      `SelectionState`, `SearchState`, `ContextMenuState`, `PasteDialogState`, `NavigationDirection`,
      `RowHeightValue`, `DataGridColumnDef<TData>` (module augmentation of `@tanstack/table-core`'s
      `ColumnMeta`), `DataGridInitialState` (including `columnOrder`), `CreateDataGridOptions<TData>`.
      Re-export `Direction` from `$lib/components/ui/direction-provider` rather than redeclaring it.
- [X] T019 Create `src/lib/components/ui/data-grid/data-grid-utils.ts` (depends on T018) — port
      `lib/data-grid.ts` plus `serializeCellsToTsv`/`coercePastedValue` extracted from the upstream
      hook: `getCellKey`, `parseCellKey`, `parseTsv`, `serializeCellsToTsv`, `coercePastedValue`,
      `getEmptyCellValue`, `getRowHeightValue`, `getLineCount`, `matchSelectOption`,
      `getIsFileCellData`, `getIsInPopover`, `getUrlHref`, `parseLocalDate`, `formatDateToString`,
      `formatDateForDisplay`, `formatFileSize`, `getFileIcon`, `getColumnVariant`,
      `getColumnPinningStyle`, `getColumnBorderVisibility`, `getScrollDirection`,
      `scrollCellIntoView`, `NON_NAVIGABLE_COLUMN_IDS`. Every function pure, per Principle IV item 3.

### P1 — State classes (US1, US2, US3, US4)

- [X] T020 [P] [US2] Create `src/lib/components/ui/data-grid/data-grid-virtualizer.svelte.ts`
      (depends on T019 for `getRowHeightValue`) — `DataGridVirtualizer` class:
      `scrollTop`/`viewportHeight` (`$state`), `startIndex`/`endIndex`/`virtualItems`/`totalSize`
      (`$derived`), `scrollToIndex(index, { align })`, per data-model.md §2 (Principle IV item 1 —
      bespoke, justified in plan.md).
- [X] T021 [P] [US2] Create `src/lib/components/ui/data-grid/data-grid-selection.svelte.ts`
      (depends on T019 for `getCellKey`) — `DataGridSelectionState` class: `selectedCells`,
      `selectionRange`, `isSelecting` (`$state`), `size` (`$derived`), and
      `selectRange(start, end, isSelecting?)`, `toggleCell(pos)`, `selectAll()`,
      `selectColumn(columnId)`, `clear()`, `has(rowIndex, columnId)`, per data-model.md §2
      (Principle IV item 2 — bespoke, justified in plan.md); `selectRange`/`toggleCell` collapse to a
      single cell when `enableSingleCellSelection` is set, and `selectColumn()` no-ops unless
      `enableColumnSelection` is set (FR-012a).
- [X] T022 [P] [US3] Create `src/lib/components/ui/data-grid/data-grid-clipboard.svelte.ts`
      (depends on T019 for `parseTsv`/`serializeCellsToTsv`/`coercePastedValue`) —
      `DataGridClipboardState` class: `cutCells`, `pasteDialog` (`$state.raw`), and
      `copy()`, `cut()`, `paste(expandRows = false)`, `setPasteDialogOpen(open)`, `isCut(key)`,
      implementing the paste flow in data-model.md §4; `onPaste(updates)` is awaited before
      `updateData` (FR-012a, data-model.md §Paste); every clipboard/paste outcome reports through
      `toast` from `svelte-sonner` (`$lib/components/ui/sonner`): `N cells copied`, `N cells cut`,
      `N cells pasted`, `N cells pasted, M skipped`, `M cells skipped` (FR-027, contracts/keyboard.md
      §Clipboard).
- [X] T023 [US4] Create `src/lib/components/ui/data-grid/data-grid-search.svelte.ts` (depends on
      T019 for case-insensitive matching and T020 for `scrollToIndex`) — `DataGridSearchState` class:
      `open`, `query`, `matchIndex` (`$state`), `matches` (`$state.raw`), `activeMatch`/`matchesByRow`
      (`$derived`), and `setOpen(open)`, `setQuery(query)` (150 ms debounce), `search(query)`,
      `next()`, `prev()`, `isMatch(rowIndex, columnId)`, `isActiveMatch(rowIndex, columnId)`.
- [X] T024 [US1] Create `src/lib/components/ui/data-grid/data-grid.svelte.ts` (depends on
      T018–T023) — `DataGridState<TData>` root class + `createDataGrid<TData>(options)` +
      `setDataGridContext`/`getDataGridContext`/`hasDataGridContext` (Symbol key, throwing getter per
      CLAUDE.md §5): the `@tanstack/table-core` bridge with reactive getters on `table.options`
      (mirroring `data-table.svelte.ts`), `sorting`/`columnFilters`/`rowSelection`/`rowHeight`/
      `focusedCell`/`editingCell`/`contextMenu`/`lastClickedRowId` state, `rows`/`columnIds`/
      `navigableColumnIds`/`columnSizeVars`/`cellSelectionMap`/`dir`/`readOnly` derived fields, the
      non-reactive `#cellMap`/`#rowMap` DOM registries, and the methods `focusCell`, `blurCell`,
      `navigateCell`, `startEditing`, `stopEditing`, `updateData`, `clearCells`, `addRow`,
      `deleteRows`, `setRowHeight`, `selectRow`, `handleKeydown` (precedence order from
      contracts/keyboard.md §Precedence), `registerCell`, `registerRow`, `getIsCellSelected`,
      `getIsSearchMatch`, `getIsActiveSearchMatch`, `getVisualRowIndex`, plus the `autoFocus` mount
      effect (FR-037): when `options.autoFocus === true` focus the first navigable cell, when it is
      a `Partial<CellPosition>` focus that cell (falling back to the first navigable column / row 0
      for a missing field), and no-op when `false`, `rows.length === 0` or
      `navigableColumnIds.length === 0`; the `columnOrder` state slice alongside `sorting`/
      `columnFilters` (FR-006).

**Checkpoint**: T004–T008 (utils/selection/virtualizer/clipboard/search test suites) should now
pass against T018–T024, once T045 (Phase 4) provides a compiling barrel.

### P2 — Structure (US1)

- [X] T025 [US1] Create `src/lib/components/ui/data-grid/data-grid-cell-wrapper.svelte` (depends
      on T024) — the shared cell shell: focus ring, selection/search-match highlighting
      (`bg-warning/15` / `bg-warning/35` per Divergence D7), click/double-click/keydown handling,
      edit-mode triggering, `data-slot="data-grid-cell-wrapper"`, `role="button"` and
      `tabindex={isFocused && !isEditing ? 0 : -1}` (roving tabindex, FR-011a), and the
      `data-editing`/`data-focused`/`data-selected`/`data-search-match`/`data-active-search-match`/
      `data-cut`/`data-readonly` boolean attributes written `? '' : undefined`; drag-to-select:
      `pointerdown` starts a range at that cell and sets `selection.isSelecting`, `pointerenter`
      while `isSelecting` extends it via `selectRange`, and a document-level `pointerup` ends it
      (FR-012). Under jsdom only the resulting `selectRange` arithmetic is asserted (T005), never
      synthetic pointer geometry.

### P3 — Cell variants (US1)

- [X] T026 [P] [US1] Create `src/lib/components/ui/data-grid/data-grid-short-text-cell.svelte`
      (depends on T025) — `data-slot="data-grid-short-text-cell"`, single-line inline-editable text.
- [X] T027 [P] [US1] Create `src/lib/components/ui/data-grid/data-grid-number-cell.svelte` (depends
      on T025) — `data-slot="data-grid-number-cell"`, honors `min`/`max`/`step` from `CellOpts`.
- [X] T028 [P] [US1] Create `src/lib/components/ui/data-grid/data-grid-checkbox-cell.svelte`
      (depends on T025) — `data-slot="data-grid-checkbox-cell"`, toggles on Space/click without a
      separate edit mode; `isEditing` prop ignored per the upstream `Omit`.
- [X] T029 [P] [US1] Create `src/lib/components/ui/data-grid/data-grid-url-cell.svelte` (depends
      on T025) — `data-slot="data-grid-url-cell"`, validated via `getUrlHref`, rendered as a link when
      not editing.
- [X] T030 [P] [US1] Create `src/lib/components/ui/data-grid/data-grid-select-cell.svelte` (depends
      on T025) — `data-slot="data-grid-select-cell"`, `$lib/components/ui/command` inside
      `$lib/components/ui/popover` over the configured `CellSelectOption[]`.
- [X] T031 [P] [US1] Create `src/lib/components/ui/data-grid/data-grid-multi-select-cell.svelte`
      (depends on T025) — `data-slot="data-grid-multi-select-cell"`, selections rendered with
      `$lib/components/ui/badge-overflow`.
- [X] T032 [P] [US1] Create `src/lib/components/ui/data-grid/data-grid-date-cell.svelte` (depends
      on T025) — `data-slot="data-grid-date-cell"`, `$lib/components/ui/calendar` in a popover,
      `parseLocalDate`/`formatDateToString`/`formatDateForDisplay` from `data-grid-utils.ts`.
- [X] T033 [P] [US1] Create `src/lib/components/ui/data-grid/data-grid-long-text-cell.svelte`
      (depends on T025) — `data-slot="data-grid-long-text-cell"`, multi-line popover editor with
      auto-save; seeds a typed character via Range/Selection positioning, never `execCommand`
      (Divergence D8).
- [X] T034 [P] [US1] Create `src/lib/components/ui/data-grid/data-grid-file-cell.svelte` (depends
      on T025) — `data-slot="data-grid-file-cell"`, `$lib/components/ui/file-upload` dropzone against
      `onFilesUpload`/`onFilesDelete`, honoring `maxFileSize`/`maxFiles`/`accept`/`multiple`.

### P2 — Structure (US1), continued

- [X] T035 [US1] Create `src/lib/components/ui/data-grid/data-grid-cell.svelte` (depends on
      T026–T034) — the variant router: reads `cell.column.columnDef.meta?.cell?.variant` and renders
      the matching variant component, defaulting to short text; `data-slot="data-grid-cell"`.
- [X] T036 [US1] Create `src/lib/components/ui/data-grid/data-grid-row.svelte` (depends on T035) —
      `data-slot="data-grid-row"`, `role="row"` with `aria-rowindex`/`aria-selected`, renders one
      `<DataGrid.Cell>` per navigable + non-navigable column via the `cell` snippet override point.
- [X] T037 [US1] Create `src/lib/components/ui/data-grid/data-grid-column-resizer.svelte` (depends
      on T024) — `data-slot="data-grid-column-resizer"`, `role="separator"`,
      `aria-orientation="vertical"`, `aria-label="Resize {label} column"`,
      `aria-valuenow`/`aria-valuemin`/`aria-valuemax`, `tabindex=0`, drag-to-resize, double-click
      auto-fit to content subject to `minSize`.
- [X] T038 [US1] Create `src/lib/components/ui/data-grid/data-grid-column-header.svelte` (depends
      on T037) — `data-slot="data-grid-column-header"`, `role="columnheader"` with `aria-colindex`/
      `aria-sort`, variant icon + tooltip, label, sort asc/desc/remove via `$lib/components/ui/button`,
      pin left/right/unpin and hide via `$lib/components/ui/dropdown-menu`, renders
      `<DataGrid.ColumnResizer>` when `column.getCanResize()`; header click calls
      `grid.selectColumn(column.id)` when `enableColumnSelection` is set (FR-012a).
- [X] T039 [US1] Create `src/lib/components/ui/data-grid/data-grid.svelte` (depends on T036, T038)
      — the Root: `data-slot="data-grid"`/`"data-grid-wrapper"`, `role="grid"` with `aria-label`/
      `aria-rowcount`/`aria-colcount`, `rowgroup` header/body/footer, fixed-pixel `height` (default
      `600`), `stretchColumns`, mounts only `virtualizer.virtualItems` rows plus `overscan`, footer
      row-add affordance when a row-add capability is configured, `children`/`row`/`empty` snippets,
      `ref` (`$bindable`), `{...restProps}`.

**Checkpoint**: T009–T015, T017a (roles/ARIA, keyboard, uncontrolled, controlled, RTL, guard-rail,
cell variant, column-header/resizer test suites) should now pass against T018–T039, once T045
(Phase 4) provides a compiling barrel.

### P4 — Clipboard (US3)

- [X] T040 [US3] Create `src/lib/components/ui/data-grid/data-grid-paste-dialog.svelte` (depends
      on T022, T024) — `data-slot="data-grid-paste-dialog"`, built on `$lib/components/ui/dialog` +
      `$lib/components/ui/radio-group`-equivalent choice: "Create new rows" (default) / "Keep
      current rows", Cancel and Continue, wired to `DataGridClipboardState.pasteDialog`.

### P5 — Search (US4)

- [X] T041 [US4] Create `src/lib/components/ui/data-grid/data-grid-search.svelte` (depends on
      T023) — `data-slot="data-grid-search"`, `role="search"`, input with 150 ms debounce via
      `DataGridSearchState.setQuery`, Previous/Next match buttons, Close button, `n of m` /
      `No results` / `Type to search` status text.

### P6 — Row management + context menu (US5)

- [X] T042 [US5] Create `src/lib/components/ui/data-grid/data-grid-context-menu.svelte` (depends
      on T024) — `data-slot="data-grid-context-menu"`, built on `$lib/components/ui/context-menu`:
      Copy, Cut, Clear (each scoped to the current selection or the right-clicked cell), Delete rows
      only when `onRowsDelete` was provided; Cut and Clear `disabled` when `readOnly`.

### P7 — Shortcuts dialog (US6)

- [X] T043 [P] [US6] Create `src/lib/components/ui/data-grid/data-grid-shortcut-card.svelte` — a
      leaf part: `keys: string[]`, `description: string`, renders each key as a
      `data-slot="data-grid-kbd"` `<kbd>` styled with semantic tokens (Divergence D6, no `kbd`
      primitive installed).
- [X] T044 [US6] Create `src/lib/components/ui/data-grid/data-grid-keyboard-shortcuts.svelte`
      (depends on T043) — `data-slot="data-grid-keyboard-shortcuts"`, built on
      `$lib/components/ui/dialog`: `open` (`$bindable`), `defaultOpen` (`false`), `onOpenChange`
      (Divergence D9), `enableSearch`/`enableUndoRedo`/`enablePaste`/`enableRowAdd`/
      `enableRowsDelete` flags gating which shortcut group renders, opens on Ctrl/Cmd+`/`, own filter
      field over Navigation/Selection/Editing/Search/Sorting/General groups.

**Checkpoint**: T016–T017 (row-management/context-menu, shortcuts-dialog test suites) should now
pass, once T045 (Phase 4) provides a compiling barrel. Every subcomponent in the plan's Public API
§2–13 has a task.

---

## Phase 4: Barrel and types

- [X] T045 Create `src/lib/components/ui/data-grid/index.ts` (depends on T018–T044 — every part and
      state module must exist) — barrel exporting both namespace-friendly short names (`Root`, `Row`,
      `Cell`, `CellWrapper`, `ShortTextCell`, `LongTextCell`, `NumberCell`, `UrlCell`,
      `CheckboxCell`, `SelectCell`, `MultiSelectCell`, `DateCell`, `FileCell`, `ColumnHeader`,
      `ColumnResizer`, `ContextMenu`, `PasteDialog`, `Search`, `KeyboardShortcuts`, `ShortcutCard`)
      and prefixed aliases (`DataGrid`, `DataGridRow`, `DataGridCell`, … `DataGridShortcutCard`),
      plus `createDataGrid`, `setDataGridContext`, `getDataGridContext`, `hasDataGridContext`,
      `DataGridState`, `DataGridSelectionState`, `DataGridClipboardState`, `DataGridSearchState`,
      `DataGridVirtualizer`, every pure helper from `data-grid-utils.ts` (§14 of plan.md's Public
      API), and every exported `Props`/entity type from `types.ts` and each part's module script —
      exactly the pattern in `src/lib/components/ui/data-table/index.ts`.

**Checkpoint**: `import * as DataGrid from '$lib/components/ui/data-grid/index.js'` resolves every
symbol the test suite and demo route need. All of Phase 2's tests should now be green.

---

## Phase 5: Demo route

- [X] T046 [US1] Create `src/routes/docs/components/data-grid/+page.svelte` (depends on T045) —
      one `<ComponentPreview>` reproducing the single upstream `data-grid-demo.tsx` (grid bound to
      sample rows covering all nine cell variants, row-add, paste, and the keyboard-shortcuts
      dialog), keeping demo state in `$state` runes on the page per the "Demo scope" Assumption in
      spec.md; page title `Data Grid — svelte-dice-ui`; no `"select"` column (out of scope, FR-017),
      pinning the first data column instead.

---

## Phase 6: Registry entry and docs polish

- [X] T047 Replace the Phase 1 stub in `registry.json` at the repository root with the complete
      `"data-grid"` entry (depends on T045, T046): `registryDependencies` for every composed
      `ui/*` primitive from plan.md §Existing primitives composed — including `context-menu` (T042)
      and `radio-group` (T040), both missing from the Phase 1 stub — `dependencies:
      ["@tanstack/table-core", "bits-ui", "@internationalized/date", "svelte-sonner"]` (already
      installed — listed for consumer installs, matching the shipped `data-table` entry), and a
      `files` array listing every file under `src/lib/components/ui/data-grid/` **except**
      `data-grid.test.ts` and `data-grid.test.svelte`, per CLAUDE.md §9.
- [X] T048 [P] Run `pnpm run registry:build` so `static/r/data-grid.json` is generated from the
      completed registry entry (T047).

---

## Phase 7: Verification

- [X] T049 Run `pnpm run format` (shadcn-style component output is not Prettier-formatted; this
      must run before the gates below per CLAUDE.md §1).
- [X] T050 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`,
      and fix everything that fails.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Tests (Phase 2)**: depends on Setup; T003 is independent, T004 depends on T003 (the harness),
  T005–T017a append to the same `data-grid.test.ts` file created by T004 and so run sequentially.
- **Core (Phase 3)**: depends on Tests existing (not passing). Internal order: P0 (T018→T019) blocks
  P1 (T020–T024) blocks P2/P3 (T025→T039, with T026–T034's P3 cell variants gating T035's P2 cell
  router) blocks P4/P5/P6/P7 (T040–T044), which only depend on P1's state classes and P2's
  `data-grid-cell-wrapper.svelte`/context, not on each other — except T043 (`ShortcutCard`), which
  has no dependency beyond existing primitives and can start as soon as Phase 1 is done.
- **Barrel (Phase 4)**: depends on every Phase 3 task.
- **Demo (Phase 5)**: depends on the barrel (T045).
- **Registry/docs (Phase 6)**: depends on the barrel and demo (T045, T046).
- **Verification (Phase 7)**: depends on everything above; always the last phase.

### Parallel opportunities

- T001 and T002 can run together (different concerns, no shared file).
- T003 (harness) can be authored while T001/T002 are still running.
- Within P0/P1: T020, T021 and T022 are mutually independent once T019 lands (T023 depends on T020,
  so it is not part of that parallel group).
- Within P3: T026–T034 (the nine cell variants) are fully independent once T025 (`CellWrapper`, P2)
  exists — the single largest parallelizable batch in this feature.
- T043 (`ShortcutCard`) has no dependency beyond primitives and can start as soon as Phase 1 is done
  (see the phase-dependency exemption above).
- T048 (`registry:build`) is a mechanical follow-on to T047 and could run immediately after.

### Parallel example: cell variants (P3)

```bash
# After T025 (data-grid-cell-wrapper.svelte) lands, launch together:
Task: "Create data-grid-short-text-cell.svelte"
Task: "Create data-grid-number-cell.svelte"
Task: "Create data-grid-checkbox-cell.svelte"
Task: "Create data-grid-url-cell.svelte"
Task: "Create data-grid-select-cell.svelte"
Task: "Create data-grid-multi-select-cell.svelte"
Task: "Create data-grid-date-cell.svelte"
Task: "Create data-grid-long-text-cell.svelte"
Task: "Create data-grid-file-cell.svelte"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 (Setup) → Phase 2 tests T003/T004/T009/T011/T012/T014/T015/T017a (the US1-relevant
   suites, accepting they stay red until their dependencies land) → Phase 3 P0/P1/P2/P3 (T018–T039)
   → Phase 4 barrel (T045, US1 symbols only need to resolve) → validate: render the grid, edit every
   cell variant, confirm `onDataChange` receives the full updated array.
2. Everything else (clipboard, search, row management, shortcuts dialog) layers on top without
   touching US1's files, per plan.md's divergence-free composition.

### Incremental delivery

Setup → Tests → P0/P1 state → P2/P3 structure + cell variants (US1 complete, demoable) → P4
clipboard (US3) → P5 search (US4) → P6 row management (US5) → P7 shortcuts dialog (US6) → Barrel →
Demo → Registry → Verification. Each of P4–P7 is additive and does not require re-touching
P2/P3's files.

---

## Notes

- Do not touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json` or
  `.port-logs/`, and do not run git commands — the orchestrator owns the working tree.
- No suppressions anywhere in Phase 7: no `@ts-ignore`, `@ts-expect-error`, `eslint-disable`,
  `svelte-ignore`, `.skip`, `.todo`, `as any`, deleted assertions, or loosened configs. Fix the root
  cause (CLAUDE.md, Constitution Principle VII).
- jsdom has neither a clipboard nor pointer/layout geometry: T007 stubs `navigator.clipboard` with
  `vi.fn()` and asserts DOM-visible effects only; T005's range arithmetic and T010's drag-adjacent
  cases are driven through `DataGridSelectionState` directly, never through synthetic mouse
  coordinates (spec.md Assumptions — "Clipboard API availability", "Pointer-geometry selection").

---

## Phase 8: Convergence

**Purpose**: Close the gaps a post-implementation audit found between the shipped code and
spec.md / plan.md / the contracts. Appended by `/speckit-converge`; every task names its source
requirement and its gap type.

- [X] T051 [US1] Stop a `checkbox`-variant cell from entering edit mode: in
      `src/lib/components/ui/data-grid/data-grid-checkbox-cell.svelte`, handle `F2` in
      `handleWrapperKeydown` the same way `Enter`/`Space` are handled (toggle, `preventDefault`,
      `stopPropagation`), and swallow a printable character without starting an edit. Today both keys
      fall through to `data-grid-cell-wrapper.svelte`'s edit trigger and call
      `grid.startEditing()`; because the checkbox wrapper is rendered with `isEditing={false}` nothing
      ever calls `stopEditing`, so `DataGridState.handleKeydown`'s `if (this.editingCell) return`
      guard swallows every subsequent key and the grid stops responding to the keyboard until the
      user clicks another cell. Add tests to
      `src/lib/components/ui/data-grid/data-grid.test.ts` asserting that `F2` toggles the value, that
      a printable character neither toggles nor sets `editingCell`, and that arrow navigation still
      works immediately after both — per FR-018 ("except for the checkbox variant, which toggles
      immediately on Enter, F2 or Space") and the Edge Case "Typing a printable character … except
      for `checkbox`-variant cells" (partial)
- [X] T052 [US1] Enforce a number column's configured constraints on commit in
      `src/lib/components/ui/data-grid/data-grid-number-cell.svelte`: `commit()` currently writes
      `Number(draft)` verbatim, and a `type="number"` input's `min`/`max` attributes do not clamp a
      typed value, so `5000` commits into a `max: 1000` column. Clamp the committed value to the
      column's `min`/`max` (or reject the edit), and replace the attribute-only assertion in
      `data-grid.test.ts` ("honours min, max and step on a number cell") with one that types an
      out-of-bounds value and asserts the committed result — per US1/AC4 (partial)
- [X] T053 [US1] Add a `file`-variant column to
      `src/routes/docs/components/data-grid/+page.svelte`: the demo binds eight of the nine cell
      variants (short-text ×2, select, multi-select, checkbox, number ×2, long-text, url, date) and
      omits `file` entirely, so `onFilesUpload`/`onFilesDelete` and the file-cell constraints
      (`maxFileSize`, `maxFiles`, `accept`, `multiple`) are undocumented on the demo page. Add the
      column with in-page mock upload/delete handlers that resolve locally — per spec.md § Assumptions
      "Demo scope" ("The Svelte demo extends upstream's column set to exercise all nine cell
      variants") and T046 (partial)
- [X] T054 [US2] Give column resizing a keyboard equivalent in
      `src/lib/components/ui/data-grid/data-grid-column-resizer.svelte`: the handle is already
      `role="separator"` with `tabindex={0}` and `aria-valuenow`/`aria-valuemin`/`aria-valuemax`, but
      carries no `onkeydown`, so a keyboard-only user can focus it and do nothing. Handle
      `ArrowLeft`/`ArrowRight` (one step, inverted under `dir="rtl"`), `Home`/`End` (min/max size) and
      `Enter`/`Escape` where they apply, writing through the same column-sizing state the drag handler
      uses, and assert it in `data-grid.test.ts` — per SC-005 ("Every interaction reachable by mouse
      … including drag-resize … has a keyboard-only equivalent") and FR-036 (missing)
- [X] T055 [US1] Make a resizer double-click auto-fit the column to its content in
      `src/lib/components/ui/data-grid/data-grid-column-resizer.svelte`: it currently calls
      `column.resetSize()`, which restores the column's *configured* size rather than measuring its
      widest rendered cell. Measure the mounted cells for that column, clamp the result to the
      column's `minSize` (and the table's `maxSize`), and assert the clamped result in
      `data-grid.test.ts` in place of the current reset-to-default assertion — per FR-005
      ("double-clicking the handle MUST auto-fit the column to its content, subject to a configured
      `minSize`"); note in the JSDoc that upstream's `resetSize()` matches its own docs' auto-fit
      claim only loosely (partial)
- [X] T056 [US5] Cover the row-selection API in
      `src/lib/components/ui/data-grid/data-grid.test.ts` using the harness's already-built but
      unused `withSelectColumn` and `onRowSelectionChange` props: assert that a column with id
      `select` is excluded from `navigableColumnIds` and skipped by arrow navigation, that
      `grid.selectRow(rowId, true, false)` marks that row's `<div role="row">` with
      `aria-selected="true"` and fires `onRowSelectionChange` with the resolved value, that
      `selectRow(..., shiftKey: true)` selects the contiguous range from the last-clicked row, and
      that `getVisualRowIndex` returns the 1-based position. No assertion currently exercises any of
      these — per FR-017 (missing)
- [X] T057 [US1] Assert the two grid layout options in
      `src/lib/components/ui/data-grid/data-grid.test.ts`: `stretchColumns` makes non-`select`
      column containers grow, and `setRowHeight(value)` both changes the rendered row height and
      fires `onRowHeightChange` for each of `short`/`medium`/`tall`/`extra-tall` (the harness already
      accepts `stretchColumns`, `rowHeight` and `onRowHeightChange`, and only the pure
      `getRowHeightValue`/`getLineCount` helpers are covered today) — per FR-003 and FR-004 (missing)
- [X] T058 [US2] Assert `enableSingleCellSelection` through a rendered grid in
      `src/lib/components/ui/data-grid/data-grid.test.ts` — a plain click selects exactly the clicked
      cell, and Shift+click plus Shift+Arrow never grow the selection beyond one cell. The flag is
      currently asserted only against `DataGridSelectionState` in isolation, so the wiring from
      `createDataGrid` through the click and keyboard paths is unverified — per FR-012a (missing)

**Checkpoint**: T051–T058 complete, then re-run the four quality gates (`pnpm run format`,
`pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run`, `pnpm run build`) and
`pnpm run registry:build` if any file list changed.
