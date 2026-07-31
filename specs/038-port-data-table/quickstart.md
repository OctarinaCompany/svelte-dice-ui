# Quickstart & Validation: Data Table

How to prove the port works, end to end. Details of the API live in
[contracts/public-api.md](./contracts/public-api.md); entity shapes live in
[data-model.md](./data-model.md); the reactivity design lives in [research.md](./research.md).

## Prerequisites

- Node + pnpm, dependencies installed (`pnpm install`).
- One new dependency for this feature:

  ```bash
  pnpm add -D @tanstack/table-core@^8.21.3
  ```

  Verify it resolved: `pnpm list @tanstack/table-core` prints `8.21.x`.

## Minimal usage (SC-001 — "under 10 lines of page code")

```svelte
<script lang="ts">
	import * as DataTable from '$lib/components/ui/data-table/index.js';
	import type { DataTableColumnDef } from '$lib/components/ui/data-table/index.js';

	type Project = { id: string; title: string; status: 'active' | 'inactive'; budget: number };

	const data: Project[] = [/* … */];
	const columns: DataTableColumnDef<Project>[] = [
		{ id: 'title', accessorKey: 'title', header: title, meta: { label: 'Title', variant: 'text' }, enableColumnFilter: true },
		{ id: 'budget', accessorKey: 'budget', meta: { label: 'Budget' } }
	];

	const state = DataTable.createDataTable({ data: () => data, columns: () => columns, getRowId: (row) => row.id });
</script>

{#snippet title({ column })}
	<DataTable.ColumnHeader {column} label="Title" />
{/snippet}

<DataTable.Root table={state.table}>
	<DataTable.Toolbar />
</DataTable.Root>
```

## Validation scenarios

Each maps to a user story / success criterion in `spec.md`. Run them against the demo route
(`pnpm run dev` is **not** used in the unattended pipeline — use `pnpm run build` plus the unit tests;
the manual steps below are for a human verifying locally).

### V1 — Browse, sort, page (User Story 1, FR-001/002/011)

1. `pnpm run test:unit -- --run src/lib/components/ui/data-table/data-table.test.ts`
2. Expected: with 25 rows and `pageSize: 10`, exactly 10 `row`s render and the summary reads
   "Page 1 of 3"; opening a sortable header's menu and choosing **Asc** → **Desc** → **Reset** cycles the
   order and the trigger indicator; "Go to next page" renders page 2 and enables "Go to previous page";
   a zero-row table renders one "No results." cell spanning every column.

### V2 — Filter, hide, select (User Story 2, FR-003/004/005/008/009/010)

1. Same test file, `describe('toolbar')` / `describe('selection')`.
2. Expected: typing in the text filter narrows rows case-insensitively; toggling a facet option narrows
   rows and adds a badge; "Reset filters" appears only while a filter is active and clears every filter;
   toggling a column off in **View** removes its header and cells; checking two rows updates
   "2 of N row(s) selected" and reveals the `actionBar` snippet; the select-all checkbox reports
   `indeterminate` when only some page rows are selected.

### V3 — Range, date, pinning, skeleton (User Story 3, FR-006/007/012/013)

1. Same test file, `describe('slider filter' | 'date filter' | 'pinning' | 'skeleton')`.
2. Expected: the slider filter's paired inputs and thumbs stay in sync and refuse an inverted range; the
   date filter's trigger shows the formatted date/range and its clear control restores every row; a
   pinned column's cells carry `data-pinned="right"` and a `style` containing `position: sticky`; the
   skeleton renders `columnCount` header cells and `rowCount` body rows with no buttons or inputs.

### V4 — Accessibility and RTL (SC-002, SC-003, FR-014)

1. Same test file, `describe('a11y')` / `describe('rtl')`.
2. Expected: every role/`aria-*`/accessible name listed in the contract is asserted; every documented key
   is driven through `user-event`; under `dir="rtl"` the pagination chevrons mirror while labels, DOM
   order and disabled logic do not.

### V5 — Controlled / uncontrolled state (FR-015)

1. Same test file, `describe('controlled')` / `describe('uncontrolled')`.
2. Expected: `initialState` seeds sorting/pagination/visibility/pinning and internal interaction updates
   them; assigning `state.sorting` from outside re-orders the rendered rows; each `on…Change` fires once
   with the resolved next value; when the caller ignores the callback and pins the state, the component
   does not move on its own.

### V6 — Docs route (SC-004, Principle IX)

1. `pnpm run build`
2. Expected: the build succeeds including `/docs/components/data-table`, and the page contains one
   `<ComponentPreview>` per SC-004 surface — the upstream `data-table-demo` reproduction, every filter
   variant, column hiding, row selection with an action bar, column pinning, the loading skeleton — plus
   a props table.

### V7 — Registry install shape (Principle V)

1. `pnpm run registry:build`
2. Expected: `static/r/data-table.json` exists, lists every component file except the two test files,
   and its `dependencies` include `@tanstack/table-core`.

## Quality gates (must all be green, in this order)

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

No gate may be made to pass by suppression — no `@ts-ignore`, `@ts-expect-error`, `eslint-disable`,
`svelte-ignore`, `as any`, `.skip`/`.todo`, deleted assertions, or loosened config. A gate that needs a
suppression means the design is wrong; fix the cause.
