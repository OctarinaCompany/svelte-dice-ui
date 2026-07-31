# Feature Specification: Data Table

**Feature Branch**: `038-port-data-table`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Data Table\" (slug: data-table) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse, sort and page through tabular data (Priority: P1)

A developer drops the Data Table into a page backed by an array of records and a set of column
definitions. End users see the records rendered as rows, can sort any sortable column ascending or
descending (and reset that sort), and can page through the data set using page-size and next/previous
/first/last controls.

**Why this priority**: This is the floor of the component's value — without rendering, sorting, and
pagination there is no data table, only a static grid.

**Independent Test**: Render `DataTable` with a `table` instance built from a handful of rows and three
columns (one sortable, one not). Verify rows render with the correct cell values, that clicking a
sortable column header cycles ascending → descending → unsorted, and that pagination controls move
between pages and change the visible row count when the page size changes.

**Acceptance Scenarios**:

1. **Given** a table with 25 rows and a page size of 10, **When** the component mounts, **Then** exactly
   10 rows are visible and the pagination summary reads "Page 1 of 3".
2. **Given** a sortable column showing unsorted state, **When** its header menu's "Asc" item is
   activated, **Then** rows reorder ascending by that column and the header shows an ascending
   indicator; activating "Desc" next reorders descending, and "Reset" returns to the unsorted order.
3. **Given** page 1 of a multi-page table, **When** the "Go to next page" control is activated, **Then**
   page 2's rows render and the "previous page" control becomes enabled.
4. **Given** a table with zero rows, **When** the component mounts, **Then** a single "No results." row
   spans all columns instead of an empty body.

---

### User Story 2 - Filter, hide columns and select rows (Priority: P2)

A developer enables per-column filtering and hiding. End users narrow the row set with a text filter, a
numeric range, a date (or date range), and single/multi-select facets shown as compact toggle buttons
with counts; they reset all active filters at once; they show or hide individual columns through a
"View" menu; and they select one or more rows via checkboxes, seeing a live "N of M row(s) selected"
count and, when any row is selected, an optional action bar surface above the pagination row.

**Why this priority**: Filtering, column visibility and row selection are the features that make the
table usable at real-world data volumes, but a table is already independently valuable (P1) without
them.

**Independent Test**: Render `DataTable` with a toolbar over a data set that has one text-filterable
column, one multi-select-filterable column with distinct facet values, and a selection column. Verify
typing into the text filter narrows visible rows, toggling a facet option narrows rows and shows a
count badge, "Reset" clears all filters and re-shows every row, toggling a column off in the view menu
removes its cells and header, and selecting rows updates the selection count and reveals the action bar.

**Acceptance Scenarios**:

1. **Given** a text-filterable "Title" column, **When** the user types a substring into its filter
   input, **Then** only rows whose title contains that substring (case-insensitively) remain visible.
2. **Given** a multi-select-filterable "Status" column with options Active/Inactive, **When** the user
   toggles "Active" in the facet popover, **Then** only Active rows remain, the facet trigger shows a
   badge for the selected option, and toggling it off restores all rows.
3. **Given** at least one active filter, **When** the user activates "Reset filters", **Then** every
   column filter clears and the row set returns to unfiltered.
4. **Given** the column view menu, **When** the user toggles a column off, **Then** that column's header
   and cells disappear from the table without altering row data or other columns' state.
5. **Given** no rows selected, **When** the user checks two row checkboxes, **Then** the selection
   summary reads "2 of N row(s) selected" and, if an action bar was supplied, it becomes visible;
   unchecking both hides it again.
6. **Given** some but not all rows on the page selected, **When** the user inspects the "select all"
   header checkbox, **Then** it shows an indeterminate state; activating it selects every row on the
   current page.

---

### User Story 3 - Reorder, pin and range/date-range filter columns (Priority: P3)

A developer additionally enables column reordering (drag to reorder columns in the view menu or header
row), column pinning (keep a column fixed to the left or right edge while the rest of the table scrolls
horizontally), and richer filter types: a slider-based numeric range filter with a unit label, and a
single-date or date-range filter with a calendar popover.

**Why this priority**: These are power-user affordances upstream documents but that most tables ship
without; they build on the P1/P2 foundation and can be added independently of it.

**Independent Test**: Render a table with one range-filterable numeric column (with a unit) and one
date-range-filterable column, plus a column marked pinned. Verify the slider filter narrows rows to the
selected numeric range and shows the unit, the date filter narrows rows to the selected range and
displays the formatted range in its trigger, and the pinned column stays visually fixed (via a stable
`data-pinned` state) while other columns scroll under/over it.

**Acceptance Scenarios**:

1. **Given** a range filter with facet-derived min/max, **When** the user drags the slider or edits the
   "from"/"to" number inputs, **Then** the filter value updates to the chosen `[min, max]` pair and only
   rows within that range remain visible.
2. **Given** a date-range filter, **When** the user picks a start and end date in the calendar popover,
   **Then** the trigger displays the formatted range and only rows whose date falls within it remain
   visible; clearing the filter (via its reset control) restores all rows.
3. **Given** a column configured as pinned to the right, **When** the table is scrolled horizontally,
   **Then** that column remains at the visible right edge above the scrolling content.
4. **Given** a loading state before data resolves, **When** a skeleton placeholder is rendered with a
   given column and row count, **Then** it displays that many placeholder header cells and body rows
   without live data or interactive controls.

---

### Edge Cases

- A column with no `meta.variant` and `enableColumnFilter` unset MUST NOT render a filter control in the
  toolbar and MUST NOT count toward the "Reset filters" visibility check.
- A column with `enableSorting: false` and `enableHiding: false` (e.g., a selection or actions column)
  renders its header as plain text/content with no dropdown menu, no sort indicator, and is absent from
  the "View" column-visibility list.
- Selecting "Reset" on a per-column sort/filter menu when nothing is applied MUST NOT throw and MUST be
  a no-op (the reset action itself is only shown once that column has an active sort/filter).
- A multi-select facet filter with more than two selected options collapses to a single "N selected"
  badge instead of listing every option, to avoid overflowing the toolbar.
- Narrowing a text/number filter to a value that matches zero rows renders the "No results." empty
  state, not an error.
- Changing the page size while on a page beyond the new last page clamps to the last valid page instead
  of showing an empty page.
- Under `dir="rtl"`, pagination's "first/previous/next/last" controls and any horizontal filter-menu
  navigation invert direction to match reading order.
- Toggling row selection is unaffected by an active filter narrowing the row set: a previously selected
  row that scrolls out of the filtered view remains selected (selection state is keyed by row id, not by
  visible position).
- A slider filter's "from" input cannot be dragged above its own "to" value (and vice versa); out-of-
  range keyboard/typed input is ignored rather than producing an inverted range.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST accept a caller-supplied, headless table instance (rows, column
  definitions, and derived state) and render it as a header, body, and empty-state row, mirroring
  upstream's `DataTable` root.
- **FR-002**: Each sortable column's header MUST expose a menu offering ascending sort, descending sort,
  and — only once a sort is active on that column — a reset action; the trigger MUST show an
  unsorted/ascending/descending indicator reflecting current state.
- **FR-003**: Each hideable column's header menu MUST offer a "Hide" action; a separate "View" control
  MUST list every hideable column with its current visibility and MUST toggle visibility on selection,
  and MUST support searching/filtering that list by column label.
- **FR-004**: The toolbar MUST render one filter control per column that has `enableColumnFilter` set,
  chosen by that column's declared filter variant (text, number, range, date, date range, boolean, select,
  multi-select — `boolean` is a valid variant carried by the operator tables for which, as upstream, the
  standard toolbar renders no control), and MUST render a "Reset filters" control, visible only while at
  least one filter is active, that clears every column filter in one action.
- **FR-005**: The text and number filter controls MUST update the column's filter value on every input
  change; the number filter MUST support an optional unit label rendered inside the control.
- **FR-006**: The range (slider) filter control MUST derive its minimum/maximum bounds from either an
  explicit configured range or the column's faceted min/max values, MUST let the user set the low and
  high bound via paired numeric inputs and a two-thumb slider kept in sync with each other, and MUST
  expose a control that clears the filter.
- **FR-007**: The date filter control MUST support both a single-date mode and a range mode (start and
  end date) via a calendar popover, MUST display the chosen date(s) formatted in its trigger, and MUST
  expose a control that clears the filter.
- **FR-008**: The select and multi-select filter controls MUST show a searchable list of options (each
  optionally carrying an icon and an occurrence count), MUST let the user toggle one (select) or several
  (multi-select) options, MUST reflect the current selection as compact badges (collapsing to a "N
  selected" summary beyond two selections) on the trigger, and MUST expose a control that clears the
  filter.
- **FR-009**: The component MUST expose row selection through the table instance — per-row and per-page
  toggling, an indeterminate state when only some rows on the page are selected, and a live count of
  selected rows against the total filtered row count rendered in the pagination row. As upstream, the
  checkbox column itself is a consumer-authored column definition; the documentation MUST show the exact
  recipe (header checkbox `aria-label="Select all"` bound to `table.getIsAllPageRowsSelected()`/
  `getIsSomePageRowsSelected()` calling `toggleAllPageRowsSelected`, cell checkbox `aria-label="Select row"`
  bound to `row.getIsSelected()` calling `row.toggleSelected`, `enableSorting: false`, `enableHiding: false`).
- **FR-010**: The component MUST accept an optional action-bar region that becomes visible exactly when
  at least one row is selected, and MUST NOT manage the action bar's own contents.
- **FR-011**: Pagination controls MUST let the user change the page size from a configurable list of
  options, navigate to the first, previous, next, and last page, disable previous/first when already on
  the first page and next/last when on the last page, and display the current page and total page
  count.
- **FR-012**: The component MUST support pinning a column to the left or right edge of the table so it
  remains visually fixed while the rest of the table's columns scroll, exposed through a stable
  `data-pinned` state rather than inline positioning the consumer must compute.
- **FR-013**: A loading/skeleton variant MUST render a configurable number of placeholder header cells
  and body rows (and, optionally, placeholder filter and pagination controls) with no live data,
  interactive controls, or event handlers.
- **FR-014**: All interactive controls (sort menu, view menu, filter popovers, pagination buttons,
  selection checkboxes) MUST be reachable and operable by keyboard alone, MUST expose the ARIA roles,
  states, and accessible names their visible affordance implies, and MUST invert any horizontal
  direction-dependent behaviour under `dir="rtl"`.
- **FR-015**: Every filter/sort/selection/pagination/visibility state change MUST be exposed through the
  underlying table instance so a consuming application can read or externally drive that state (for
  example, to synchronize it with the page URL) without the component itself owning that concern.
- **FR-016**: The component MUST ship as installable source under the project's UI component directory
  with an index barrel, be registered in the project's component registry, and have a demo page
  exercising every scenario shown on the upstream documentation page.

### Key Entities

- **Column definition**: Identifies one table column — its id, data accessor, optional custom header/
  cell rendering, and `meta` (display label, filter placeholder, filter variant, select/multi-select
  options with optional icon and count, numeric/date range bounds, unit label, icon) plus per-column
  capability flags (filterable, sortable, hideable).
- **Table instance**: The headless state and derived row/column model (visible rows, header groups,
  sorting state, column filters, column visibility, row selection, pagination state, faceted values,
  pinning) that every Data Table subcomponent reads from and writes to; owned by the consuming
  application, not by the Data Table component itself.
- **Filter option**: One selectable value for a select/multi-select filter — a label, a value, an
  optional icon, and an optional occurrence count shown alongside it.
- **Selection state**: The set of currently selected row identifiers, independent of which rows are
  currently visible under active filters or pagination.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can render a working, sortable, paginated table from an array of records and a
  column list in under 10 lines of page code, matching the upstream "Layout" example's shape.
- **SC-002**: Every keyboard interaction and ARIA role documented upstream for the nine in-scope
  subcomponents is reproduced and covered by an automated test; zero accessibility-related regressions
  are introduced relative to the upstream behaviour.
- **SC-003**: All nine upstream subcomponents (table root, column header, toolbar, faceted filter, date
  filter, slider filter, pagination, view options, skeleton) render correctly with `dir="rtl"` with no
  visual or interaction inversion missing.
- **SC-004**: The demo page exercises sorting, every filter variant, column hiding, row selection with an
  action bar, column pinning, and the loading skeleton — one section per upstream example — so a reader
  can validate parity without leaving the docs site.
- **SC-005**: 100% of the functional requirements above have at least one colocated automated test
  proving the behaviour, and the full quality-gate suite (format, type-check, lint, unit tests, build)
  passes with zero suppressions.

## Assumptions

- **Headless table engine**: Upstream is built on `@tanstack/react-table`. This port uses
  `@tanstack/table-core` (the framework-agnostic engine `@tanstack/react-table` itself wraps) driven from
  Svelte state, since no official Svelte adapter package is required — `table-core`'s `createTable` /
  `Table.setOptions` pattern is framework-agnostic by design. This preserves the column-definition API,
  row models, sorting/filtering/pagination algorithms, and faceting exactly, which is the part of the
  upstream contract most valuable to reproduce byte-for-byte.
- **`useDataTable` hook → state class, minus URL persistence**: Upstream's `useDataTable` hook bundles
  three concerns: (a) constructing the `table-core` instance and wiring its callbacks, (b) owning
  sorting/pagination/filter/selection/visibility state, and (c) persisting that state into the URL query
  string via `nuqs`, a Next.js-specific library. This port reproduces (a) and (b) as a `.svelte.ts` state
  class per §10 of `CLAUDE.md`. It does **not** reproduce (c): `nuqs` has no SvelteKit equivalent in this
  project, and per Principle IV (Composition over Reimplementation) this is exactly the kind of
  environment-specific glue a consuming application should own. Instead, FR-015 requires every state
  change to flow through the table instance's standard callbacks so a consuming SvelteKit app can compose
  its own `$page.url` / `goto`-based persistence on top, exactly as an upstream consumer would compose
  `nuqs` on top of `useDataTable`. This divergence is a deliberate scope boundary, not a missing feature.
- **`DataTableSortList`, `DataTableFilterList`, `DataTableFilterMenu`, `DataTableAdvancedToolbar` are out
  of scope**: The upstream docs page references these as separately installable registry items, but none
  of their source, types, or examples are vendored under `.reference/diceui` (only the nine components
  enumerated in SC-003, matching the base `DataTableToolbar` flow, are present). Per the constitution's
  pinned-commit rule, only vendored material is portable; these four are left for a future, separately
  scoped port if their source is vendored later.

  Consequently the three shortcuts listed in the upstream MDX § Accessibility — `Ctrl/Cmd + Shift + F`
  (toggle the filter menu), `Ctrl/Cmd + Shift + S` (toggle the sort menu) and `Backspace`/`Delete` (remove
  the focused, or last applied, filter/sort item) — are also out of scope: they are handled by
  `DataTableFilterMenu`/`DataTableFilterList`/`DataTableSortList`, and no vendored in-scope file
  (`components/data-table/*.tsx`, `hooks/use-data-table.ts`) registers a `ctrlKey`/`metaKey`/`shiftKey`
  handler. They ship with those components if their source is vendored later.
- **Range/slider filter primitive**: The upstream slider filter composes a `Slider` primitive not
  currently in this project's shadcn base set. Per Principle IV, the plan phase will add it as a
  standard shadcn-svelte base primitive (matching how `calendar`, `command`, and `popover` were already
  added for other filters) rather than hand-rolling drag behaviour inside the data table port.
  Composition candidates already in the project — `combobox` (search/select popovers), `badge-overflow`
  (collapsing selected-facet badges), `checkbox-group` (multi-select semantics), and `sortable`
  (drag-to-reorder) — are used wherever their behaviour matches, per the component-specific guidance for
  this port.
- **Column reordering**: Upstream's docs page and vendored source do not show a drag-to-reorder column
  UI in the base `DataTableToolbar`/`DataTable` flow (`table-core`'s `columnOrder` state exists but no
  vendored component drives it via drag). User Story 3's "reorder" affordance is therefore scoped to
  composing the existing `sortable` component against `table-core`'s `columnOrder` state in the view
  options list (reordering via that list), not a bespoke drag handle on the header row itself.
- **Row height / virtualization**: Not documented upstream for this component and not required; the
  table renders all rows in the current page's row model directly, matching upstream.
- **Server-side vs. client-side data**: Per upstream, `pageCount` and the row model can be driven either
  by a server-provided page count and pre-filtered rows, or by fully client-side filtering. This is a
  consumer choice mediated entirely through the table instance's options (`manualPagination`,
  `manualSorting`, `manualFiltering`) and is out of this component's scope to prescribe.
