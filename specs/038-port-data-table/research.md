# Phase 0 Research: Data Table

All Technical Context unknowns are resolved below. Upstream references are read at the pinned commit
`d9763d82530416dfa4c81c462387b55d06bae4ec` under `.reference/diceui`.

---

## D-01 — Headless engine: `@tanstack/table-core`, pinned `^8.21.3`

**Decision.** Add exactly one new npm dependency: `@tanstack/table-core@^8.21.3` (latest 8.x on the
registry, verified with `pnpm view @tanstack/table-core version` → `8.21.3`). Install as a
`devDependency`, matching how `bits-ui`, `@internationalized/date` and every other component dependency
is declared in this repo, and list it in the registry entry's `dependencies` array so the shadcn CLI
installs it for consumers.

**Rationale.** Upstream's entire data model — `ColumnDef`, `Column`, `Row`, `Header`, `Table`,
`getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`, `getPaginationRowModel`,
`getFacetedRowModel`, `getFacetedUniqueValues`, `getFacetedMinMaxValues`, `ColumnPinningState` — lives in
`@tanstack/table-core`. `@tanstack/react-table` re-exports all of it and adds ~150 lines: a
`useReactTable` hook and `flexRender`. Depending on `table-core` therefore reproduces the sorting,
filtering, pagination, faceting and pinning algorithms exactly, which is the part of the upstream
contract most worth preserving byte-for-byte (Principle II), and leaves us only the adapter to write
(D-02) and `flexRender` to translate (D-03).

**Alternatives considered.**

- _`@tanstack/svelte-table`._ The published v8 adapter is Svelte 4 (stores, `writable`, `$$props`) and
  would violate Principle I; the v9 line is pre-release and its API is not upstream's. Rejected.
- _Re-implement the engine._ Thousands of lines of audited sorting/filtering/faceting logic, guaranteed
  drift from upstream. Rejected under Principle IV.
- _Compose an existing local component._ `src/lib/components/ui/table` is presentational markup only;
  `sortable`'s state class reorders a flat array by drag. Neither models columns, rows or facets.

**Impact.** `package.json` gains one line; `registry.json` `dependencies: ["@tanstack/table-core"]`.
No other new dependency: `@internationalized/date` (date filter), `bits-ui` (Slider), `@lucide/svelte`
(icons) are already installed.

---

## D-02 — table-core ↔ runes bridge: reactive getters on the options object

**Decision.** Create the table instance **once** with `createTable(options)` and never re-create it.
Build `options` as a plain object whose `data`, `columns`, `pageCount` and `state` are **getter
properties** that read `$state.raw` slices held by `DataTableState`:

```ts
const options: TableOptionsResolved<TData> = {
  get data() { return resolveData(); },
  get columns() { return resolveColumns(); },
  get state() {
    return {
      sorting: self.sorting,
      columnFilters: self.columnFilters,
      columnVisibility: self.columnVisibility,
      rowSelection: self.rowSelection,
      pagination: self.pagination,
      columnPinning: self.columnPinning,
      columnOrder: self.columnOrder,
      ...controlledState()
    };
  },
  onSortingChange: (updater) => self.#set('sorting', updater),
  // …one per state slice
  onStateChange: () => {},        // required by TableOptionsResolved; unused
  renderFallbackValue: null,
  getCoreRowModel: getCoreRowModel(),
  /* filtered / sorted / paginated / faceted row models */
};
```

Every read path a Svelte template takes — `table.getRowModel()`, `table.getHeaderGroups()`,
`column.getIsSorted()`, `column.getFilterValue()`, `table.getState().pagination` — bottoms out in
`table.options.state`, i.e. in our getter, i.e. in a `$state` read. Because those reads happen *inside*
the template's or a `$derived`'s reactive scope, Svelte registers the dependency and re-runs on change.
Writes go the other way: table-core calls `onSortingChange(updater)`, we resolve the updater against the
current slice and assign — invalidating exactly the readers that touched that slice.

`table-core`'s `memo()` helper always evaluates its dependency function before checking the cache, so a
cache hit still performs the `$state` read; dependencies are never silently dropped.

**Rationale.** This is the smallest faithful translation of what `useReactTable` does (create once,
`setOptions` on every render, force a re-render from `onStateChange`) and it is strictly *better* than
that: instead of re-rendering the whole subtree, only the deriveds that read the changed slice re-run.
It needs no `$effect`, so there is no mutate-state-inside-effect hazard, and it satisfies the user
constraint "never mutate reactive state inside `$effect` where `$derived` would do".

**Alternatives considered.**

- _Version counter (`#version = $state(0)`, bumped in every `on*Change`, read by every subcomponent
  before calling table methods)._ This is React's `useReducer(() => ({}))` force-render transliterated.
  It works, but it makes every subcomponent depend on a magic signal, invalidates all of them on any
  change, and would leak into the public API for `DataTableColumnHeader`, which receives a bare `column`.
  Rejected — kept in reserve only if the getter approach proves insufficient during implementation.
- _Re-create the table on every state change (`$derived.by(() => createTable(opts))`)._ Throws away
  `table-core`'s memoisation caches on every keystroke and returns a new `Table` identity to consumers.
  Rejected on performance and identity grounds.
- _Return the table instance from a `$derived.by` that calls `setOptions` as a side effect._ Relies on
  Svelte propagating a derived whose value is reference-identical, and hides a write inside a derived.
  Rejected as fragile.

**Verification during implementation.** A dedicated test asserts that (a) assigning
`state.sorting = [{ id: 'title', desc: true }]` from outside re-orders the rendered rows, and (b) a
`$effect` observing `state.pagination` fires exactly once per page change — proving the dependency graph
is live in both directions.

---

## D-03 — `flexRender` → `DataTableFlexRender` + `Snippet` templates

**Decision.** Type column templates as
`string | number | Snippet<[HeaderContext<TData, TValue>]>` (resp. `CellContext`) in
`DataTableColumnDef`, and render them through a `data-table-flex-render.svelte` part:

```svelte
{#if template == null}{fallback ?? ''}
{:else if typeof template === 'string' || typeof template === 'number'}{template}
{:else}{@render template(context)}{/if}
```

To guarantee the `template == null` branch is reachable rather than shadowed by `table-core`'s built-in
default templates (`_getDefaultColumnDef()` supplies `header: props => props.header.column.id` and
`cell: props => props.renderValue()?.toString?.()`), `createDataTable` passes
`defaultColumn: { header: undefined, cell: undefined, ...userDefaultColumn }`. Object spread copies
explicit `undefined`, so the built-ins are overridden and any column without a template yields
`undefined`. The root then supplies `fallback={header.column.id}` for headers and the stringified cell
value for cells — identical output to table-core's defaults, but produced on our side where the type is
narrow.

**Fallback if that override does not take effect** (guard, verified by a test): keep the built-ins and
discriminate by identity against two sentinel functions we install in `defaultColumn` ourselves. Either
way the discrimination is by identity or by `typeof`, never by calling an unknown function — calling a
Svelte snippet with a context object would corrupt it, since snippets compile to
`($$anchor, ...args) => void`.

**Rationale.** A Svelte `Snippet<[T]>` is structurally assignable to table-core's
`ColumnDefTemplate<T> = string | ((props: T) => unknown)`, so consumer column definitions typecheck
against the upstream shape with no casts and no `any`. There is no runtime brand that distinguishes a
snippet from a plain function, so the type must carry the distinction — which is exactly what narrowing
`DataTableColumnDef` to `string | number | Snippet<[…]>` achieves.

**Alternatives considered.** A `component:` field plus `<svelte:component>` (deprecated in Svelte 5, and
column templates are inline in every upstream example); passing a string of HTML (unsafe, loses
interactivity); `createRawSnippet` at the call site (verbose for every column).

---

## D-04 — Range filter: compose `bits-ui`'s `Slider` directly

**Decision.** `data-table-slider-filter.svelte` imports `Slider` from `bits-ui` and renders the shadcn
markup (track / range / thumbs) inline with `cn()` and semantic tokens, wired as
`type="multiple"` with `bind:value` on a `[number, number]` tuple.

**Rationale.** Sourcing order (Principle IV): (1) no `src/lib/components/ui/slider` exists; (2) bits-ui
ships `Slider` with two-thumb range support, `Arrow*`/`Home`/`End`/`PageUp`/`PageDown` keyboard handling,
`aria-valuemin`/`max`/`now` and RTL inversion — everything upstream's `Slider` provided. Step (3),
bespoke drag logic, is not reached. Principle IV also forbids `shadcn-svelte add` mid-port, so this
**supersedes the spec Assumption** that said the plan would add a base `slider` component; the plan's
Divergence table records it.

**Consequence.** The registry entry lists no extra `registryDependencies` for the slider (bits-ui is
already in `dependencies`), and consumers who later run `shadcn-svelte add slider` get an independent
component — nothing in this port collides with it.

**Alternatives considered.** Two `<input type="range">` elements (no shared track, no range semantics,
thumbs can cross); hand-rolled pointer-drag (rejected outright by Principle IV).

---

## D-05 — Date filter: `@internationalized/date` inside, epoch milliseconds outside

**Decision.** The **column filter value stays exactly as upstream defines it** — a single epoch-ms
`number` in single mode, and a `[number | undefined, number | undefined]` tuple in range mode. Inside
`data-table-date-filter.svelte`, convert to and from the local `calendar` wrapper's `DateValue`
(`CalendarDate` / `DateRange`) with two helpers in `data-table-utils.ts`:

- `toDateValue(timestamp: number | string | undefined): CalendarDate | undefined`
- `fromDateValue(value: DateValue | undefined): number | undefined` — via `toDate(getLocalTimeZone())`

`formatDate` is ported verbatim from `docs/lib/format.ts` (`Intl.DateTimeFormat('en-US', { month:
'long', day: 'numeric', year: 'numeric' })`, empty string on invalid input) so trigger labels match
upstream character for character. `parseAsDate`, `parseColumnFilterValue` and `getIsDateRange` are
ported verbatim from `data-table-date-filter.tsx`.

**Rationale.** The filter value is the part consumers see and the part `getFilteredRowModel()` compares;
changing it would be genuine API drift. `DateValue` never escapes the component. Keeping the calendar on
the repo's existing bits-ui wrapper avoids pulling in a second date library (Principle IV).

**Note.** `Calendar` is `type="single"` in single mode and `type="range"` in range mode; both are
already supported by `src/lib/components/ui/calendar`, including `captionLayout="dropdown"` which
upstream uses.

---

## D-06 — Faceted filter and view options: compose `command` + `popover`, not `combobox`

**Decision.** `data-table-faceted-filter.svelte` and `data-table-view-options.svelte` compose
`src/lib/components/ui/popover` + `src/lib/components/ui/command` — a one-for-one match with upstream,
which uses `Popover` + `Command`/`CommandInput`/`CommandList`/`CommandEmpty`/`CommandGroup`/
`CommandItem`/`CommandSeparator`. `Badge` and `Separator` render the selected-value summary; `Button`
renders the dashed trigger.

**Rationale for rejecting the three components named in the port guidance.**

- **`combobox`.** The Dice UI Combobox is a form control: a text `Input` bound to a value, an anchored
  content list, badge items, and its own filtering/highlight state machine. Upstream's faceted filter is
  a *button-triggered command palette* whose value lives in the column, not in the widget, and whose
  trigger renders badges and a clear affordance. Adopting `combobox` would change the trigger's role
  (`combobox` input vs. `button`), the option role (`option` inside `listbox` — which `command` also
  provides), and the keyboard contract. Rejected: it would break parity to buy nothing `command`
  doesn't already give.
- **`badge-overflow`.** It measures container width and collapses badges that do not fit. Upstream's
  rule is purely cardinal — show every badge up to two, otherwise a single "N selected" badge — and is
  asserted by spec Edge Case 4 and FR-008. Substituting width-based collapsing would make the rendered
  output depend on layout measurement, which jsdom cannot reproduce, and would violate Principle II.
  Rejected.
- **`checkbox-group`.** Upstream's multi-select options are `CommandItem` rows (role `option`) with a
  check *glyph*, not `input[type=checkbox]` controls, and they live inside a searchable/filterable
  command list. `checkbox-group` would change the roles and lose the type-ahead. Rejected.

**Where composition *is* used**: `sortable` (D-07), `table`, `dropdown-menu`, `popover`, `command`,
`select`, `button`, `input`, `label`, `badge`, `separator`, `checkbox`, `skeleton`, `calendar`,
`direction-provider` — 15 existing components in total.

---

## D-07 — Column reordering: opt-in `reorderable` on `DataTableViewOptions`, composing `sortable`

**Decision.** `DataTableViewOptions` gains `reorderable?: boolean` (`@default false`). When `false` —
the default, and therefore the upstream-identical path — the column list is a plain `Command` list.
When `true`, the list is wrapped in `Sortable` + `SortableContent` + `SortableItem` +
`SortableItemHandle` (vertical orientation), whose `onValueChange` writes `table.setColumnOrder(next)`.

**Rationale.** Spec User Story 3 (P3) requires a reorder affordance and the spec's Assumptions already
scope it to "composing the existing `sortable` component against `table-core`'s `columnOrder` state in
the view options list". Upstream ships no reorder UI at all, so the feature must be additive and
default-off to keep Principle II parity intact. `sortable` already provides pointer + keyboard dragging,
live-region announcements and RTL handling; nothing is hand-rolled.

**Alternatives considered.** Drag handles on the header row (not in the spec's scope, and it would fight
column pinning's sticky positioning); native HTML5 drag-and-drop (no keyboard path, fails Principle III).

---

## D-08 — Column pinning: computed inline `style` plus `data-pinned` / `data-pinned-edge`

**Decision.** Port `getColumnPinningStyle({ column, withBorder })` from `docs/lib/data-table.ts` as a
pure function in `data-table-utils.ts` that returns a **CSS text string** (Svelte's `style` attribute
takes a string, not React's object). It reproduces upstream exactly: `position: sticky|relative`,
`left: ${column.getStart('left')}px` / `right: ${column.getAfter('right')}px`, `width`, `opacity .97`,
`background: var(--background)`, `z-index: 1` when pinned, and the inset box-shadow on the last
left-pinned / first right-pinned column when `withBorder`. The root additionally emits
`data-pinned="left" | "right"` and `data-pinned-edge="" ` (last-left / first-right) on every `<th>` and
`<td>`, satisfying FR-012's "stable `data-pinned` state rather than inline positioning the consumer must
compute".

**Rationale.** The offsets depend on the runtime widths of preceding pinned columns and cannot be
expressed as Tailwind utilities; upstream computes them in JS for the same reason. Principle VIII's
z-index prohibition covers *overlay* components (Dialog/Popover/Tooltip/Sheet), not a sticky table cell;
`z-index: 1` here is upstream's own value and is required for the pinned cell to paint over scrolling
siblings. Both facts are stated so the choice is reviewable.

**Alternatives considered.** A CSS custom property per column plus a Tailwind arbitrary value — same
inline write, more indirection. Dropping pinning — would fail FR-012 and User Story 3.

---

## D-09 — RTL: `useDirection()` for the pagination chevrons, composed primitives for the rest

**Decision.** `data-table-pagination.svelte` calls `useDirection({ element: () => ref })` from
`src/lib/components/ui/direction-provider` and swaps the four chevron icons
(`ChevronsLeft`/`ChevronLeft`/`ChevronRight`/`ChevronsRight` ⇄ their mirrors) when `current === 'rtl'`,
while `aria-label`s ("Go to first/previous/next/last page"), disabled logic and DOM order stay put. Every
other RTL concern — menu/popover/command horizontal arrow behaviour, popover side/align flipping, slider
thumb direction — is owned by the composed bits-ui primitives, which the repo already exercises under
`DirectionProvider`.

**Rationale.** SC-003 requires all eight subcomponents to work under `dir="rtl"`. `useDirection` is the
established repo-wide reader (`ltr` fallback, provider-aware, DOM-`dir` observing) used by `sortable`
and `kanban`; re-deriving direction locally would duplicate it.

---

## D-10 — Test strategy: one `.svelte` harness, jsdom-safe fixtures

**Decision.** Add `data-table.test.svelte`, a parameterised harness that accepts a fixture
(`rows`, `columns`, `initialState`, feature flags) and renders `DataTable` + `DataTableToolbar` +
`DataTableColumnHeader` snippets, mirroring the harness pattern already used by `action-bar`,
`badge-overflow`, `combobox` and `sortable`. `data-table.test.ts` renders that harness. Column templates
in tests are real snippets defined in the harness (not `createRawSnippet`) so the snippet branch of
`DataTableFlexRender` is exercised the way consumers use it; `createRawSnippet` is used only for the
`actionBar` snippet.

**jsdom notes.** `tests/setup.ts` already shims `ResizeObserver`, `matchMedia`, pointer capture and
`scrollIntoView` — enough for Popover, DropdownMenu, Command, Select, Calendar and Slider. Slider drag is
asserted through keyboard interaction (`ArrowRight` on a focused thumb), not synthetic pointer geometry,
because jsdom reports zero-size rects. Column pinning is asserted through `data-pinned` /
`data-pinned-edge` and the emitted `style` string rather than computed layout, for the same reason. Both
substitutions are noted here so the coverage limitation is explicit rather than silent.

**`expect.requireAssertions` is on** — every `it` asserts; no `.skip`, no `.todo`.
