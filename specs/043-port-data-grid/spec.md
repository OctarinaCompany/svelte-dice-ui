# Feature Specification: Data Grid

**Feature Branch**: `043-port-data-grid`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Data Grid\" (slug: data-grid) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse and edit tabular data like a spreadsheet (Priority: P1)

A consumer renders a data grid bound to an array of row objects and column definitions. Rows and
columns display in a scrollable grid. The consumer edits a cell's content in place — text, a
number, a checkbox, a single- or multi-select, a date, a URL, or a set of files — and the edit is
written back to their data through a single change callback, exactly as if they were using a
spreadsheet.

**Why this priority**: This is the entire reason the component exists. Without in-place, typed
cell editing over an arbitrary column set, "data grid" reduces to the read-only `data-table`
component that is already ported.

**Independent Test**: Render the grid with a handful of rows and one column per cell variant
(short text, long text, number, url, checkbox, select, multi-select, date, file). Double-click a
cell, change its value, commit the edit, and confirm the row object passed to the change callback
reflects the new value while every other row is unchanged.

**Acceptance Scenarios**:

1. **Given** a grid bound to an array of rows, **When** the consumer double-clicks a short-text
   cell and types a new value then presses Enter, **Then** the change callback receives the full
   data array with only that cell's field updated and the grid exits edit mode.
2. **Given** a select-variant cell with a fixed set of options, **When** the consumer opens the
   cell editor, **Then** only the configured options are selectable and choosing one commits that
   option's value.
3. **Given** a checkbox-variant cell, **When** the consumer activates the cell with Space or a
   click, **Then** the boolean value toggles without entering a separate edit mode.
4. **Given** a number-variant cell configured with `min`, `max`, and `step`, **When** the consumer
   types a value outside the configured bounds, **Then** the committed value is clamped or the edit
   is rejected, matching the configured constraint.
5. **Given** the grid's `readOnly` prop is set, **When** the consumer double-clicks, presses Enter,
   or types over any cell, **Then** no editor opens and no data changes.

---

### User Story 2 - Navigate and select cells with the keyboard, like Excel (Priority: P2)

A consumer with only a keyboard moves a focus indicator between cells with the arrow keys, jumps to
row/column/grid extremities, and extends a rectangular multi-cell selection with Shift, matching
the interaction model of a spreadsheet.

**Why this priority**: Keyboard-driven navigation and selection is the mechanism every other
feature (editing, clipboard, row deletion) builds on, and it is the accessibility baseline for a
grid widget per the WAI-ARIA APG.

**Independent Test**: Render a grid with several rows/columns, focus a cell, and drive every
documented navigation and selection key. Assert the focused cell and the selected-cell set update
exactly as documented, including at the grid boundaries where movement must clamp rather than wrap
or error.

**Acceptance Scenarios**:

1. **Given** a cell is focused, **When** the consumer presses ArrowRight/ArrowLeft/ArrowUp/ArrowDown,
   **Then** focus moves one cell in that direction, clamping at the grid edge instead of wrapping.
2. **Given** a cell is focused, **When** the consumer presses Tab or Shift+Tab, **Then** focus moves
   to the next or previous navigable cell.
3. **Given** a cell is focused, **When** the consumer presses Ctrl/Cmd+Home or Ctrl/Cmd+End,
   **Then** focus jumps to the first or last navigable cell in the grid.
4. **Given** a cell is focused, **When** the consumer holds Shift and presses an arrow key,
   **Then** the selection extends into a rectangular range anchored at the previously focused cell.
5. **Given** a rectangular selection exists, **When** the consumer presses Escape, **Then** the
   selection clears (and if a cell was mid-edit, editing is cancelled first, on a second Escape the
   selection clears); **when** no selection exists, **then** Escape blurs the focused cell instead.
6. **Given** `dir="rtl"` is active, **When** the consumer presses ArrowLeft/ArrowRight, **Then**
   the navigation direction inverts to match right-to-left reading order.
7. **Given** the grid contains 10,000+ rows, **When** the consumer navigates past the currently
   rendered viewport, **Then** the target row is scrolled into view and focused without rendering
   all rows at once.

---

### User Story 3 - Copy, cut, and paste cell ranges to and from a spreadsheet (Priority: P3)

A consumer selects a range of cells, copies it, and pastes it into an external spreadsheet
application, and can also paste tab-separated data copied from a spreadsheet back into the grid,
including pasting more rows than currently exist.

**Why this priority**: Clipboard interoperability is what makes the grid feel like a first-class
spreadsheet surface rather than a form; it depends on User Stories 1 and 2 being complete first.

**Independent Test**: Drive the pure parse/serialize helpers directly (TSV in, TSV out) with
representative fixtures — quoted fields, embedded newlines and tabs, ragged rows, non-text cell
variants (booleans, dates, multi-select JSON, file JSON) — and separately assert, through the state
class, that a completed paste produces the expected set of cell updates and, when more rows are
pasted than exist, that a "not enough rows" dialog state is entered instead of silently dropping
data.

**Acceptance Scenarios**:

1. **Given** a rectangular cell selection, **When** the consumer presses Ctrl/Cmd+C, **Then** the
   selected cells are serialized to tab-separated values in row-major order and written to the
   clipboard.
2. **Given** a rectangular cell selection, **When** the consumer presses Ctrl/Cmd+X, **Then** the
   cells are copied to the clipboard and visually marked as cut; the underlying data is not cleared
   until a paste target is chosen.
3. **Given** clipboard text with more data rows than remain below the focused cell, **When** the
   consumer pastes and the grid was configured to add rows on demand, **Then** a confirmation
   dialog reports how many additional rows are needed before the paste proceeds.
4. **Given** clipboard text with more data rows than remain, **When** the consumer confirms adding
   rows, **Then** the requested number of rows is created first and the paste then fills them.
5. **Given** clipboard text containing a value that fails a target column's variant validation
   (e.g. non-numeric text into a number cell), **When** the paste is applied, **Then** that cell is
   skipped, the rest of the paste is applied, and the consumer is informed how many cells were
   skipped.
6. **Given** a cell range was cut, **When** the consumer pastes it elsewhere, **Then** the source
   cells are cleared to each column's empty value for its variant once the paste completes.
7. **Given** the grid's `readOnly` prop is set or `enablePaste` is not set, **When** the consumer
   presses Ctrl/Cmd+V, **Then** no paste occurs.

---

### User Story 4 - Find matching cells with in-grid search (Priority: P4)

A consumer opens a search box over the grid, types a query, and steps through every cell whose
value contains that query, with the grid scrolling and focusing each match in turn.

**Why this priority**: Search is a documented, independently switchable feature (`enableSearch`)
that does not gate any other capability.

**Independent Test**: Render a grid with known cell values, enable search, open it with Ctrl/Cmd+F,
type a query that matches several cells across different rows, and step forward and backward
through matches, asserting the active match position and wrap-around behavior at the ends of the
match list.

**Acceptance Scenarios**:

1. **Given** `enableSearch` is set, **When** the consumer presses Ctrl/Cmd+F, **Then** a search
   input opens and receives focus.
2. **Given** the search box is open with a query typed, **When** matches exist, **Then** every
   matching cell is visually flagged and the first match becomes the active match.
3. **Given** an active search with multiple matches, **When** the consumer presses Enter or
   Shift+Enter, **Then** the active match advances to the next or previous match, wrapping around
   at either end, and the grid scrolls that match into view and focuses it.
4. **Given** the search box is open, **When** the consumer presses Escape, **Then** the search
   closes, the query and matches clear, and focus returns to the grid at the last active match if
   one existed.

---

### User Story 5 - Manage rows and act on selections via context menu (Priority: P5)

A consumer adds new rows to the grid, deletes selected rows via keyboard shortcut or right-click
menu, and uses the same right-click menu for copy/cut/clear actions scoped to the current
selection.

**Why this priority**: Row lifecycle management and the context menu are additive conveniences
layered on the selection and clipboard primitives from User Stories 2–3; they are not required for
the grid to be usable as a read/edit surface.

**Independent Test**: Provide `onRowAdd` and `onRowsDelete` callbacks, trigger row addition and
deletion through both the documented keyboard shortcuts and the context menu, and assert the
callbacks receive the expected row data/indices and that focus lands on a sensible cell afterward.

**Acceptance Scenarios**:

1. **Given** `onRowAdd` is provided, **When** the consumer triggers the add-row affordance,
   **Then** the callback fires and, if it returns a target cell position, that cell receives focus
   once the new row renders.
2. **Given** one or more rows are selected and `onRowsDelete` is provided, **When** the consumer
   presses Ctrl/Cmd+Backspace or Ctrl/Cmd+Delete, **Then** the callback receives the selected row
   objects and their indices, and focus moves to a remaining row at the same position.
3. **Given** `onRowsDelete` is not provided, **When** the consumer opens the context menu, **Then**
   the delete-rows action is absent from the menu.
4. **Given** a cell or range is right-clicked, **When** the context menu opens, **Then** it offers
   Copy, Cut, and Clear scoped to the current selection (or the right-clicked cell if nothing is
   selected).
5. **Given** the Delete or Backspace key is pressed with cells selected, **When** the grid is not
   read-only, **Then** every selected cell's value resets to its column variant's empty value.

---

### User Story 6 - Discover keyboard shortcuts (Priority: P6)

A consumer opens a searchable reference dialog listing every keyboard shortcut the grid currently
supports, scoped to the features that are actually enabled (search, paste, row add/delete).

**Why this priority**: Discoverability closes the loop on User Stories 2–5 — without it, the
keyboard-first interaction model is opaque to a first-time user — but it depends on those stories
existing first.

**Independent Test**: Render the shortcuts dialog standalone with each combination of
`enableSearch`/`enablePaste`/`enableRowAdd`/`enableRowsDelete`/`enableUndoRedo` and assert only the
applicable shortcut groups render, and that typing into the dialog's own search field filters the
list.

**Acceptance Scenarios**:

1. **Given** the shortcuts dialog is opened (Ctrl/Cmd+/), **When** no optional feature flags are
   set, **Then** the Navigation, Selection, Editing, Sorting and General groups are listed and the
   Search group is absent.
2. **Given** `enableSearch` is set on the dialog, **When** it opens, **Then** search-related
   shortcuts (Ctrl/Cmd+F, Enter, Shift+Enter to cycle matches) are included.
3. **Given** the dialog is open, **When** the consumer types into its filter field, **Then** only
   shortcuts whose description or keys match the query remain visible.

---

### Edge Cases

- An empty `data` array MUST render an empty grid body without errors, and Ctrl/Cmd+End,
  select-all, and paste-target calculations MUST no-op safely rather than throwing.
- A column list with a single navigable column MUST allow left/right navigation to no-op instead of
  losing focus.
- Pasting into a `readOnly` grid, or with `enablePaste` unset, MUST be a no-op; the documented
  keyboard shortcut MUST NOT throw.
- Pasting a value into a `select`/`multi-select` cell that does not match any configured option
  (case-insensitively, by value or label) MUST be treated as invalid and skipped, per User Story 3
  scenario 5.
- Pasting into a `file`-variant cell is unsupported for upload (no `onFilesUpload` context during a
  raw paste); pasted file-cell content MUST validate against the existing `FileCellData` shape and
  otherwise be skipped, matching upstream.
- Clicking a cell with Ctrl/Cmd held toggles that single cell in/out of a multi-cell selection
  without altering the rest of the selection.
- Shift-clicking a cell before any cell has been focused MUST fall back to treating the shift-click
  as a plain focus (there is no anchor to extend from).
- Deleting the row that currently holds focus MUST re-focus the row that now occupies that row's
  former index (or the new last row, if the deleted row was last).
- Column pinning combined with `dir="rtl"` MUST mirror which physical edge ("left"/"right" pin
  values keep their semantic meaning; the rendered side flips) columns stick to, matching upstream's
  `getColumnPinningStyle` behavior.
- Typing a printable character while a cell is focused (not editing) MUST start editing that cell
  and seed the editor with the typed character, except for `checkbox`-variant cells and when the
  grid is `readOnly`.
- A grid with zero navigable columns (e.g. only a `select`/`actions`-style non-navigable column)
  MUST disable keyboard navigation without erroring.

## Requirements _(mandatory)_

### Functional Requirements

**Grid structure & rendering**

- **FR-001**: The grid MUST render a header row, a virtualized body of data rows, and MUST support
  an optional row-add affordance in the footer when a row-add capability is configured.
- **FR-002**: The grid MUST virtualize rows so that only rows near the visible viewport (plus a
  configurable overscan) are mounted, so that grids of 10,000+ rows remain responsive.
- **FR-003**: The grid MUST accept a fixed pixel `height` (defaulting to 600) and MUST support an
  option to stretch columns to fill the available width instead of using each column's configured
  size.
- **FR-004**: The grid MUST support per-row height presets (`short`, `medium`, `tall`,
  `extra-tall`), each mapping to both a fixed row pixel height and a maximum number of visible text
  lines inside a cell.
- **FR-005**: Columns MUST support resizing by dragging a resize handle, and double-clicking the
  handle MUST auto-fit the column to its content, subject to a configured `minSize`.
- **FR-006**: Columns MUST support being pinned to the left or right edge of the grid, remaining
  visible while the rest of the grid scrolls horizontally, and MUST support being hidden. Column
  **reordering** is exposed only as a `initialState.columnOrder` / `state.columnOrder` passthrough
  to the table core — the drag-and-drop reorder UI lives in the out-of-scope view menu (see
  Assumptions).
- **FR-007**: The grid MUST support ascending/descending/unsorted column sorting driven from the
  column header, and MUST support column filtering when a column declares a filter function.

**Cell variants**

- **FR-008**: The grid MUST ship the following cell variants, each reading and writing its
  column's value in the shape upstream documents: short text (single line, inline editable),
  long text (multi-line, edited in a popover with auto-save), number (with optional `min`, `max`,
  `step`), URL (validated, rendered as a clickable link when not editing), checkbox (boolean,
  toggled without a separate edit mode), single select (from a configured option list), multi
  select (from a configured option list, rendered as badges), date (calendar popover picker), and
  file (upload/list/delete against consumer-provided `onFilesUpload`/`onFilesDelete` handlers, with
  configurable `maxFileSize`, `maxFiles`, `accept`, and `multiple`).
- **FR-009**: Every cell variant MUST be built by composing a shared cell-wrapper part that
  supplies focus ring, selection highlighting, search-match highlighting, click/double-click/
  keyboard handling, and edit-mode triggering, so that a consumer can build a custom variant with
  the same guarantees by composing the same wrapper.
- **FR-010**: A column MUST select its variant declaratively through column metadata, and the grid
  MUST route each cell to the matching variant renderer at render time.

**Focus, selection & navigation**

- **FR-011**: The grid MUST track a single focused cell position and MUST render a visible focus
  indicator on it.
- **FR-011a**: The grid MUST implement a roving tabindex: the grid container is in the tab order
  (`tabindex="0"`), rows and cell containers are `tabindex="-1"`, and exactly one cell wrapper is
  `tabindex="0"` — the focused, non-editing cell — every other cell wrapper being `tabindex="-1"`,
  so a single Tab stop enters the grid and arrow keys move within it.
- **FR-012**: The grid MUST support single-cell and rectangular multi-cell selection via mouse drag,
  Shift+click (range from the last focused cell), and Ctrl/Cmd+click (toggle a single cell in/out
  of the current selection).
- **FR-012a**: The grid MUST expose an option that reduces selection to a single cell
  (`enableSingleCellSelection`): with it set, a plain click selects exactly the clicked cell and
  range/extend interactions never grow beyond one cell. Column selection by header interaction MUST
  occur only when the column-selection option is set. A paste MUST additionally invoke an optional
  paste callback with the resolved cell updates before the data-change notification fires.
- **FR-013**: The grid MUST support every keyboard navigation command upstream documents: arrow
  keys, Tab/Shift+Tab, Home/End, Ctrl/Cmd+Home/End, Ctrl/Cmd+Arrow (row/column extremity in one
  axis), Page Up/Down (page of rows), Alt+ArrowUp/ArrowDown (page of rows), and Alt+Page Up/Down
  (page of columns), all clamping at grid boundaries rather than wrapping.
- **FR-014**: The grid MUST support every keyboard selection-extension command upstream documents:
  Shift+Arrow (extend by one cell), Ctrl/Cmd+Shift+Arrow (extend to a row/column extremity),
  Ctrl/Cmd+A (select all cells), and Escape (cancel an in-progress edit first if one exists,
  otherwise clear the selection if one exists, otherwise blur the focused cell).
- **FR-015**: When the focused or newly selected cell is outside the currently rendered viewport,
  the grid MUST scroll it into view before or as it receives focus.
- **FR-016**: All navigation and selection direction MUST invert horizontally when the grid's
  resolved text direction is right-to-left.
- **FR-017**: An optional column-selection mode MUST let the consumer select an entire column by
  interacting with its header. The grid MUST additionally support consumer-supplied row-selection
  columns: a column whose id is `select` MUST be treated as non-navigable, and row checkbox
  interaction MUST route through the grid's row-selection API so shift-click selects a contiguous
  range of rows. The ready-made `getDataGridSelectColumn` helper itself is out of scope (see
  Assumptions); consumers supply their own column definition.

**Editing**

- **FR-018**: A cell MUST enter edit mode on Enter, F2, Space, double-click, or typing a printable
  character while focused (except for the checkbox variant, which toggles immediately on Enter, F2
  or Space), and MUST exit edit mode on Enter (committing and, unless otherwise directed, moving
  focus down one row), Tab (committing and moving to the next cell), Ctrl/Cmd+Enter while editing a
  long-text cell (committing and closing its popover), or Escape (discarding the in-progress edit).
- **FR-019**: Shift+Enter, when a row-add capability is configured, MUST insert a new row below the
  currently focused row instead of moving focus down.
- **FR-020**: All committed edits MUST flow through a single data-change notification carrying the
  full updated row array, so the consumer's own state remains the single source of truth.
- **FR-021**: When the grid's `readOnly` flag is set, no cell MUST enter edit mode, toggle, or
  otherwise accept a value change through any input method (keyboard, mouse, paste).

**Clipboard**

- **FR-022**: Copying a selection MUST serialize every selected cell to tab-separated values in
  row-major order, using each cell's display-appropriate text (JSON for multi-select/file values,
  ISO date strings for date values, plain string otherwise), and MUST write that text to the
  clipboard.
- **FR-023**: Cutting a selection MUST perform the same serialization and clipboard write as
  copying, and MUST visually mark the cut cells until a paste target is chosen or the cut is
  otherwise cancelled; the cut cells' underlying values are only cleared once a paste completes.
- **FR-024**: Pasting tab-separated clipboard text MUST parse it into a rectangular block (honoring
  quoted fields containing embedded tabs/newlines) and apply it starting at the focused cell,
  advancing through navigable columns and rows in document order.
- **FR-025**: Each pasted value MUST be validated and coerced per the target column's cell variant
  (number parsed and range-agnostic, checkbox against a recognized truthy/falsy vocabulary, date
  parsed to a valid calendar date, select/multi-select matched case-insensitively against
  configured options, file cells validated against the file-cell-data shape, URL validated as an
  absolute or bare-domain URL); a value that fails validation for its target cell MUST be skipped
  without aborting the rest of the paste.
- **FR-026**: When a paste would extend past the last existing row and the grid was configured with
  a bulk row-add capability, the grid MUST prompt the consumer with the number of additional rows
  required before proceeding, rather than silently truncating or silently creating rows.
- **FR-027**: After a successful paste, the grid MUST select the pasted range and report to the
  consumer how many cells were updated and, if any, how many were skipped for failing validation.

**Row management & context menu**

- **FR-028**: When a row-add capability is configured, the grid MUST expose an affordance (footer
  action and/or Shift+Enter) to add a row, and MUST focus the position the consumer's callback
  requests once the new row is rendered.
- **FR-029**: When a row-delete capability is configured, the grid MUST let the consumer delete the
  currently selected row(s) via keyboard shortcut (Ctrl/Cmd+Backspace or Ctrl/Cmd+Delete) or via the
  context menu, passing both the row data and row indices to the consumer's callback.
- **FR-030**: Right-clicking a cell MUST open a context menu offering Copy, Cut, and Clear scoped to
  the current selection (or the right-clicked cell alone if nothing is selected), plus a
  Delete-rows action when row deletion is configured; each action MUST be disabled/absent rather
  than erroring when its prerequisite (a selection, a delete capability) is missing.
- **FR-031**: Delete or Backspace, with one or more cells selected and the grid not read-only, MUST
  reset every selected cell to its column variant's defined empty value.

**Search**

- **FR-032**: When search is enabled, Ctrl/Cmd+F MUST open a search input; typing a query MUST find
  every cell whose stringified value contains the query (case-insensitively) and flag all matches.
- **FR-033**: Enter and Shift+Enter, while search is open, MUST step the active match forward or
  backward through the match list, wrapping at either end, scrolling the new active match into view
  and focusing it.
- **FR-034**: Escape, while search is open, MUST close the search input, clear the query and match
  list, and return focus to the grid at the last active match's cell if one existed.

**Keyboard shortcuts reference**

- **FR-035**: The grid MUST ship a searchable dialog listing every currently applicable keyboard
  shortcut, grouped by category (Navigation, Selection, Editing, Search, Sorting, General), opened
  via Ctrl/Cmd+/. Navigation, Selection, Editing, Sorting and General MUST always render; the
  Search group MUST render only when `enableSearch` is set; `enablePaste`, `enableRowAdd`,
  `enableRowsDelete` and `enableUndoRedo` MUST add their individual shortcut rows to the Editing
  group and MUST omit them when unset.

**Cross-cutting**

- **FR-036**: All grid interactions (navigation, selection, editing, clipboard, search, row
  management, context menu) MUST be fully operable via keyboard alone, per the WAI-ARIA APG grid
  pattern, in addition to mouse/pointer interaction.
- **FR-037**: The grid MUST expose an `autoFocus` option that, on mount, focuses either the first
  navigable cell (`true`) or a specific consumer-provided cell position.
- **FR-038**: The grid's text direction MUST resolve from an explicit `dir` prop or, absent one,
  from the project's ambient direction context, and every directional behavior (navigation,
  selection extension, column pinning, horizontal scroll) MUST respect the resolved direction.
- **FR-039**: The grid MUST expose the same building blocks upstream does — grid root, row, cell
  (variant router), cell wrapper, individual cell variants, column header, context menu, paste
  dialog, keyboard-shortcuts dialog, and search — each independently composable and each carrying
  its own `data-slot` for styling.

### Key Entities

- **Grid data row**: An arbitrary consumer-owned object; the grid never mutates it directly and
  instead reports whole-array replacements through its data-change callback. Identified by a
  consumer-supplied row-id function when one is provided, otherwise by row position.
- **Column definition**: Describes one field of the row shape — its accessor, header label, cell
  variant and that variant's options (min/max/step, select options, file constraints, etc.),
  minimum size, and whether it participates in sorting/filtering/pinning/hiding.
- **Cell position**: A (row index, column id) pair identifying one grid cell; the unit of focus,
  editing, and the corners of a selection range.
- **Selection range**: A rectangular block of cell positions described by its two corners, plus the
  derived set of individual cell keys it covers.
- **Cell update**: A (row index, column id, new value) triple produced by editing, pasting, or
  clearing a cell, batched and applied together when multiple cells change from a single action.
- **Search match set**: The ordered list of cell positions whose value currently contains the
  active search query, plus which one of them is the active match.
- **Paste-dialog state**: Whether the "not enough rows" confirmation is open, how many additional
  rows a pending paste requires, and the clipboard text waiting to be applied once rows exist.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A consumer can go from an array of data plus column definitions to a fully editable
  grid — covering all nine documented cell variants — using only the component's public API,
  without writing any custom cell-rendering code.
- **SC-002**: Every keyboard shortcut documented on the upstream Data Grid page (navigation,
  selection, editing, search, and general shortcuts) produces the documented outcome when exercised
  against the ported component.
- **SC-003**: A grid holding 10,000 rows remains interactive — scrolling, navigating, and editing a
  cell all complete within a normal single input's response time — because only viewport-adjacent
  rows are mounted at once.
- **SC-004**: Data copied from the grid pastes correctly into an external spreadsheet application
  as a rectangular block of values, and tab-separated data copied from a spreadsheet pastes back
  into the grid with each cell coerced to its column's expected type.
- **SC-005**: Every interaction reachable by mouse (click, double-click, drag-select, right-click,
  drag-resize) has a keyboard-only equivalent that reaches the same end state.
- **SC-006**: With the grid's direction set to right-to-left, every directional interaction
  (arrow-key navigation, selection extension, column pinning, horizontal auto-scroll) mirrors
  correctly with no additional configuration beyond setting the direction.
- **SC-007**: Setting the grid to read-only prevents every data-modifying interaction (typing,
  pasting, clearing, row deletion) while leaving navigation, selection, and search fully usable.

## Assumptions

- **Scope boundary — core grid only, no toolbar menus.** The task's component-specific guidance
  enumerates the subcomponents the plan should schedule: grid root, row, cell, cell wrapper, cell
  variants, column header, context menu, paste dialog, keyboard shortcuts, and search. That list
  deliberately omits `DataGridSortMenu`, `DataGridFilterMenu`, `DataGridRowHeightMenu`,
  `DataGridViewMenu`, `getDataGridSelectColumn`, `DataGridSkeleton`, and `useDataGridUndoRedo` —
  each of which upstream ships and documents as a **separately installable, optional** package
  (`npx shadcn@latest add "@diceui/data-grid-sort-menu"`, etc.), distinct from the core
  `@diceui/data-grid` install. This port covers the core install only; the optional companions are
  out of scope for this feature and may be ported as their own features later. Sorting, filtering,
  column pinning/hiding/resizing, and row-height selection remain available through the ported
  grid's props and column configuration (FR-004, FR-006, FR-007) even without their dedicated
  toolbar menu UIs — a consumer can still drive them programmatically or with their own controls.
- **Demo scope.** Only one upstream demo file exists for this component
  (`data-grid-demo.tsx`), unlike most other ports which have several `<slug>-*-demo.tsx` files. The
  Svelte demo page reproduces that single example (grid + row-add + paste + keyboard-shortcuts
  dialog) rather than inventing additional demo sections; the "one section per upstream demo file"
  convention in `CLAUDE.md` §8 is satisfied by that single section. Upstream's demo itself binds
  only six of the nine cell variants (short text, select, checkbox, number, date — no long text,
  url, multi-select or file) at `height={340}`, plus a `select` column produced by the out-of-scope
  `getDataGridSelectColumn` (see FR-017). The Svelte demo extends upstream's column set to exercise
  all nine cell variants — better documentation value for a component whose entire point is its
  variant set — and pins the first data column instead of a `select` column, at the upstream
  `height={340}`.
- **`sonner` toast feedback.** Upstream reports clipboard and paste outcomes ("3 cells copied",
  "2 cells pasted, 1 skipped") via the `sonner` toast library, which this project already has
  installed as a shadcn-svelte primitive (`src/lib/components/ui/sonner`). The port reuses that
  existing primitive rather than inventing a new notification mechanism.
- **TanStack Table Svelte adapter.** Upstream builds on `@tanstack/react-table` with
  `@tanstack/react-virtual`. Per the task's guidance and to match the already-ported `data-table`
  component, this port builds on `@tanstack/table-core` (the framework-agnostic core the existing
  `data-table` component already depends on) plus a Svelte-idiomatic virtualization approach
  (`@tanstack/svelte-virtual` if compatible with this project's TanStack Table version, otherwise an
  equivalent windowing implementation), rather than pulling in any React-specific TanStack package.
- **State store → state class(es).** Upstream's `useDataGrid` hook hand-rolls a
  `useSyncExternalStore`-based store to batch and notify state changes across many pieces of state
  (sorting, selection, focus, editing, search, paste dialog, etc.). Per `CLAUDE.md` §4/§5, this
  becomes one or more `$state`-based state classes in `data-grid.svelte.ts`, split by concern
  (selection/navigation, editing, clipboard, search) but coordinated through one root state object
  so batched updates remain atomic, sharing context the same way the existing `data-table` state
  class is shared.
- **File-cell upload wiring.** `onFilesUpload`/`onFilesDelete` are consumer-supplied async
  callbacks with no default implementation upstream; the port reproduces the same callback-shaped
  contract and does not add a default upload backend.
- **Undo/redo omission follow-on.** Because `useDataGridUndoRedo` is out of scope (see the scope
  boundary above), `DataGridKeyboardShortcuts`' `enableUndoRedo` flag and its associated shortcut
  group are ported as dead-but-documented props (they exist on the type, and the dialog still hides
  the group when the flag is false) so a future port of the undo/redo package can wire them up
  without changing this component's public API.
- **RTL context.** "The project's existing direction context" (per the task's I18n requirement)
  refers to the shadcn-svelte `Direction`/`DirectionProvider` primitive already vendored under
  `.reference/diceui/docs/registry/bases/radix/ui/direction.tsx` and expected to already exist (or
  be added as a dependency, per `registryDependencies`) in `src/lib/components/ui/`; if it is not
  yet present in this repository's `src/lib/components/ui/`, the plan MUST add it as a prerequisite
  rather than hand-rolling a parallel direction mechanism.
- **Clipboard API availability.** Copy/cut/paste use the async Clipboard API
  (`navigator.clipboard`), matching upstream. Because jsdom implements no clipboard, per the task's
  guidance the test suite drives the TSV parse/serialize helpers and the selection/paste state-class
  logic directly (pure functions and state-class methods), and separately asserts the DOM-visible
  effects that don't require an actual clipboard (cut-cell highlighting, toast feedback, paste
  dialog open state) using mocked clipboard read/write.
- **Pointer-geometry selection.** Drag-to-select (mouse-down on one cell, mouse-move over another)
  is geometry jsdom cannot simulate realistically. Per the task's guidance, the range-selection
  arithmetic (given a start and end cell position, compute the covered cell set) is tested against
  the state class directly with synthetic positions; DOM tests cover only what jsdom can actually
  produce — discrete click/keydown events — including click, Ctrl/Cmd+click, and Shift+click
  selection paths.

### API divergences from upstream (recorded per Constitution Principle II)

Established during planning; the full table with rationale is in `plan.md` § Divergences.

- **D1 — hook return value → state object.** Upstream's `useDataGrid` returns twenty values
  (`dataGridRef`, `headerRef`, `rowMapRef`, `footerRef`, `virtualItems`, `measureElement`,
  `columnSizeVars`, `cellSelectionMap`, `tableMeta`, …) that the consumer spreads onto `<DataGrid>`.
  Here `createDataGrid(options)` returns a single `DataGridState` object and the root takes one
  `grid` prop; every other part reads the state from a Symbol context. Refs and virtual items are
  class fields in Svelte, so threading them as props would be a transliteration.
- **D2 — `TableMeta` callbacks → state methods.** Upstream hangs twenty-five callbacks off
  `table.options.meta` and reads them from every cell. `meta` is a plain object handed to
  `createTable` and is not reactive; the same callbacks become methods on `DataGridState`,
  published through context.
- **D3 — `@tanstack/react-virtual` → bespoke `DataGridVirtualizer`.** Row heights are fixed per
  `rowHeight` preset, so windowing is arithmetic; a new npm dependency whose value is dynamic
  `ResizeObserver` measurement would be inert under jsdom. Behaviour (`overscan`, `scrollToIndex`
  with `start`/`center`/`end` alignment, total size) is reproduced.
- **D4 — one file per cell variant.** Upstream ships nine components in
  `data-grid-cell-variants.tsx`; `CLAUDE.md` §3 forbids two components in one `.svelte` file, so
  each becomes its own file. Export names are unchanged.
- **D5 — `onRowSelectionChange` receives the resolved value**, not a TanStack `Updater`, matching
  the already-ported `data-table`. Same for `onSortingChange` and `onColumnFiltersChange`.
- **D6 — `Kbd`/`KbdGroup` replaced by a token-styled `<kbd>`.** The shadcn `kbd` primitive is not
  installed in this repository and `shadcn-svelte add` is forbidden mid-port (`CLAUDE.md` §1), so
  the shortcuts dialog renders `data-slot="data-grid-kbd"` elements styled with semantic tokens.
- **D7 — search-highlight colours use the `warning` token.** Upstream's
  `bg-yellow-100 dark:bg-yellow-900/30` and `bg-orange-200 dark:bg-orange-900/50` become
  `bg-warning/15` and `bg-warning/35`, per the status-colour mapping in `CLAUDE.md` §6, because raw
  palette colours and manual `dark:` overrides are forbidden.
- **D8 — no `document.execCommand`.** Upstream seeds the long-text editor with the typed character
  via `execCommand('insertText')` so it joins the textarea's native undo stack. `execCommand` is
  deprecated and unimplemented in jsdom; the port assigns the value and positions the caret. The
  only observable difference is the browser's internal undo history inside that textarea.
- **D9 — the shortcuts dialog's `open` is bindable.** Upstream keeps it in component-local state;
  Constitution Principle III requires a controlled and an uncontrolled mode for value-bearing props,
  so the port adds `open` (`$bindable`), `defaultOpen` and `onOpenChange`. The uncontrolled default
  matches upstream exactly.
- **D10 — `overscan` default follows upstream's implementation, not its JSDoc.** Upstream's
  `UseDataGridProps.overscan` is documented `@default 3` but the hook destructures
  `overscan = OVERSCAN` with `const OVERSCAN = 6`. The port ships `6` (observable parity) and its
  JSDoc reads `@default 6`, with this note recording the upstream doc discrepancy.
