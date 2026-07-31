<script lang="ts" module>
	import type {
		CellContext,
		ColumnFiltersState,
		ColumnOrderState,
		HeaderContext,
		PaginationState,
		RowSelectionState,
		SortingState,
		TableState,
		VisibilityState
	} from '@tanstack/table-core';

	import type {
		DataTableColumnDef,
		DataTableInitialState,
		DataTableState,
		Option
	} from './index.js';

	/** One fixture row. Every `FilterVariant` the toolbar can render has a field here. */
	export type DataTableHarnessRow = {
		id: string;
		title: string;
		status: string;
		priority: string;
		estimatedHours: number;
		score: number;
		createdAt: number;
		dueAt: number;
		archived: boolean;
		notes: string;
	};

	/** `2024-01-15`, `2024-02-15`, … in epoch milliseconds, so date assertions are deterministic. */
	function day(month: number, date: number): number {
		return new Date(2024, month - 1, date).getTime();
	}

	/** The default five rows. Deliberately unsorted so a sort click is observable. */
	export const HARNESS_ROWS: DataTableHarnessRow[] = [
		{
			id: 'r1',
			title: 'Charlie',
			status: 'todo',
			priority: 'low',
			estimatedHours: 4,
			score: 30,
			createdAt: day(1, 15),
			dueAt: day(3, 1),
			archived: false,
			notes: 'first'
		},
		{
			id: 'r2',
			title: 'Alpha',
			status: 'done',
			priority: 'high',
			estimatedHours: 12,
			score: 90,
			createdAt: day(2, 15),
			dueAt: day(4, 1),
			archived: true,
			notes: 'second'
		},
		{
			id: 'r3',
			title: 'Echo',
			status: 'todo',
			priority: 'medium',
			estimatedHours: 8,
			score: 60,
			createdAt: day(3, 15),
			dueAt: day(5, 1),
			archived: false,
			notes: 'third'
		},
		{
			id: 'r4',
			title: 'Bravo',
			status: 'in-progress',
			priority: 'low',
			estimatedHours: 20,
			score: 45,
			createdAt: day(4, 15),
			dueAt: day(6, 1),
			archived: false,
			notes: 'fourth'
		},
		{
			id: 'r5',
			title: 'Delta',
			status: 'done',
			priority: 'high',
			estimatedHours: 16,
			score: 75,
			createdAt: day(5, 15),
			dueAt: day(7, 1),
			archived: true,
			notes: 'fifth'
		}
	];

	/** Facet options for the `multiSelect` column. */
	export const STATUS_OPTIONS: Option[] = [
		{ label: 'Todo', value: 'todo', count: 2 },
		{ label: 'In Progress', value: 'in-progress', count: 1 },
		{ label: 'Done', value: 'done', count: 2 }
	];

	/** Facet options for the single-`select` column. */
	export const PRIORITY_OPTIONS: Option[] = [
		{ label: 'Low', value: 'low' },
		{ label: 'Medium', value: 'medium' },
		{ label: 'High', value: 'high' }
	];

	export type DataTableHarnessProps = {
		/** Rows handed to `createDataTable`. @default HARNESS_ROWS */
		rows?: DataTableHarnessRow[];
		/** Seeds the uncontrolled slices. */
		initialState?: DataTableInitialState<DataTableHarnessRow>;
		/** Fully controlled state, merged last — the caller becomes authoritative. */
		state?: Partial<TableState>;
		/** Hands the created state object back so a spec can read and write the slices. */
		onCreate?: (state: DataTableState<DataTableHarnessRow>) => void;
		/** Wrap the tree in `<div dir="…">`. */
		dir?: 'ltr' | 'rtl';
		/** Wrap the tree in `<DirectionProvider dir="…">` instead of a bare `dir` attribute. */
		withDirectionProvider?: boolean;
		/** Render `<DataTable.Toolbar>` above the table. @default true */
		withToolbar?: boolean;
		/** Pass an `actionBar` snippet to the root. @default true */
		withActionBar?: boolean;
		/**
		 * Render a standalone `<DataTable.ViewOptions>` instead of the toolbar, so `disabled` and
		 * `reorderable` can be driven without the toolbar rendering a second one.
		 * @default false
		 */
		withStandaloneViewOptions?: boolean;
		/** Forwarded to the standalone `<DataTable.ViewOptions>`. @default false */
		viewOptionsDisabled?: boolean;
		/** Forwarded to the standalone `<DataTable.ViewOptions>`. @default false */
		reorderable?: boolean;
		/** Drop the `select`, `archived`, `notes` and `actions` columns, for the minimal cases. */
		minimalColumns?: boolean;
		/**
		 * Render one probe per part that forwards `...restProps`, each carrying a `data-testid` a
		 * spec can look for on the element the part is contracted to spread onto.
		 * @default false
		 */
		withRestProbes?: boolean;
		onSortingChange?: (sorting: SortingState) => void;
		onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
		onPaginationChange?: (pagination: PaginationState) => void;
		onRowSelectionChange?: (selection: RowSelectionState) => void;
		onColumnVisibilityChange?: (visibility: VisibilityState) => void;
		onColumnOrderChange?: (order: ColumnOrderState) => void;
	};
</script>

<script lang="ts">
	import { untrack } from 'svelte';

	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import * as DataTable from './index.js';
	import { createDataTable } from './index.js';

	let {
		rows = HARNESS_ROWS,
		initialState,
		state: controlledState,
		onCreate,
		dir,
		withDirectionProvider = false,
		withToolbar = true,
		withActionBar = true,
		withStandaloneViewOptions = false,
		viewOptionsDisabled = false,
		reorderable = false,
		minimalColumns = false,
		withRestProbes = false,
		onSortingChange,
		onColumnFiltersChange,
		onPaginationChange,
		onRowSelectionChange,
		onColumnVisibilityChange,
		onColumnOrderChange
	}: DataTableHarnessProps = $props();

	type Row = DataTableHarnessRow;

	const allColumns: DataTableColumnDef<Row>[] = [
		{
			id: 'select',
			header: selectHeader,
			cell: selectCell,
			enableSorting: false,
			enableHiding: false,
			size: 32
		},
		{
			id: 'title',
			accessorKey: 'title',
			header: titleHeader,
			cell: titleCell,
			enableColumnFilter: true,
			meta: { label: 'Title', variant: 'text', placeholder: 'Search titles...' }
		},
		{
			id: 'status',
			accessorKey: 'status',
			header: statusHeader,
			enableColumnFilter: true,
			filterFn: (row, columnId, filterValue) =>
				Array.isArray(filterValue) && filterValue.includes(row.getValue(columnId)),
			meta: { label: 'Status', variant: 'multiSelect', options: STATUS_OPTIONS }
		},
		{
			id: 'priority',
			accessorKey: 'priority',
			header: priorityHeader,
			enableColumnFilter: true,
			filterFn: (row, columnId, filterValue) =>
				Array.isArray(filterValue) && filterValue.includes(row.getValue(columnId)),
			meta: { label: 'Priority', variant: 'select', options: PRIORITY_OPTIONS }
		},
		{
			id: 'estimatedHours',
			accessorKey: 'estimatedHours',
			header: hoursHeader,
			enableColumnFilter: true,
			filterFn: 'inNumberRange',
			meta: { label: 'Est. Hours', variant: 'range', range: [0, 24], unit: 'hrs' }
		},
		{
			id: 'score',
			accessorKey: 'score',
			header: scoreHeader,
			enableColumnFilter: true,
			filterFn: (row, columnId, filterValue) =>
				filterValue === '' || String(row.getValue(columnId)) === String(filterValue),
			meta: { label: 'Score', variant: 'number', unit: 'pts' }
		},
		{
			id: 'createdAt',
			accessorKey: 'createdAt',
			header: createdHeader,
			enableColumnFilter: true,
			filterFn: (row, columnId, filterValue) =>
				typeof filterValue !== 'number' || row.getValue(columnId) === filterValue,
			meta: { label: 'Created', variant: 'date' }
		},
		{
			id: 'dueAt',
			accessorKey: 'dueAt',
			header: dueHeader,
			enableColumnFilter: true,
			filterFn: (row, columnId, filterValue) => {
				if (!Array.isArray(filterValue)) return true;
				const value = Number(row.getValue(columnId));
				const [from, to] = filterValue;
				if (typeof from === 'number' && value < from) return false;
				if (typeof to === 'number' && value > to) return false;
				return true;
			},
			meta: { label: 'Due', variant: 'dateRange' }
		},
		{
			id: 'archived',
			accessorKey: 'archived',
			header: archivedHeader,
			enableColumnFilter: true,
			meta: { label: 'Archived', variant: 'boolean' }
		},
		{
			id: 'notes',
			accessorKey: 'notes',
			header: notesHeader,
			enableColumnFilter: true,
			meta: { label: 'Notes' }
		},
		{
			id: 'actions',
			header: actionsHeader,
			cell: actionsCell,
			enableSorting: false,
			enableHiding: false,
			size: 40
		}
	];

	const minimalIds = new Set(['title', 'status', 'estimatedHours']);
	const columns = $derived(
		minimalColumns ? allColumns.filter((column) => minimalIds.has(column.id ?? '')) : allColumns
	);

	const dataTable = createDataTable<Row>({
		data: () => rows,
		columns: () => columns,
		getRowId: (row) => row.id,
		initialState: untrack(() => initialState),
		state: () => controlledState ?? {},
		onSortingChange: (value) => onSortingChange?.(value),
		onColumnFiltersChange: (value) => onColumnFiltersChange?.(value),
		onPaginationChange: (value) => onPaginationChange?.(value),
		onRowSelectionChange: (value) => onRowSelectionChange?.(value),
		onColumnVisibilityChange: (value) => onColumnVisibilityChange?.(value),
		onColumnOrderChange: (value) => onColumnOrderChange?.(value)
	});

	untrack(() => onCreate?.(dataTable));
</script>

{#snippet selectHeader(ctx: HeaderContext<DataTableHarnessRow, unknown>)}
	<Checkbox
		aria-label="Select all"
		bind:checked={
			() => ctx.table.getIsAllPageRowsSelected(),
			(next) => ctx.table.toggleAllPageRowsSelected(next)
		}
		bind:indeterminate={() => ctx.table.getIsSomePageRowsSelected(), () => {}}
	/>
{/snippet}

{#snippet selectCell(ctx: CellContext<DataTableHarnessRow, unknown>)}
	<Checkbox
		aria-label="Select row"
		bind:checked={() => ctx.row.getIsSelected(), (next) => ctx.row.toggleSelected(next)}
	/>
{/snippet}

{#snippet titleHeader(ctx: HeaderContext<DataTableHarnessRow, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Title" />
{/snippet}

{#snippet titleCell(ctx: CellContext<DataTableHarnessRow, unknown>)}
	<span data-testid="title-cell">{ctx.row.original.title}</span>
{/snippet}

{#snippet statusHeader(ctx: HeaderContext<DataTableHarnessRow, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Status" />
{/snippet}

{#snippet priorityHeader(ctx: HeaderContext<DataTableHarnessRow, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Priority" />
{/snippet}

{#snippet hoursHeader(ctx: HeaderContext<DataTableHarnessRow, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Est. Hours" />
{/snippet}

{#snippet scoreHeader(ctx: HeaderContext<DataTableHarnessRow, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Score" />
{/snippet}

{#snippet createdHeader(ctx: HeaderContext<DataTableHarnessRow, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Created" />
{/snippet}

{#snippet dueHeader(ctx: HeaderContext<DataTableHarnessRow, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Due" />
{/snippet}

{#snippet archivedHeader(ctx: HeaderContext<DataTableHarnessRow, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Archived" />
{/snippet}

{#snippet notesHeader(ctx: HeaderContext<DataTableHarnessRow, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Notes" />
{/snippet}

{#snippet actionsHeader(ctx: HeaderContext<DataTableHarnessRow, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Actions" />
{/snippet}

{#snippet actionsCell(ctx: CellContext<DataTableHarnessRow, unknown>)}
	<button type="button" data-testid="row-action">Open {ctx.row.original.id}</button>
{/snippet}

{#snippet actionBar()}
	<div data-testid="action-bar">
		{dataTable.selectedRowCount} selected
	</div>
{/snippet}

<!--
	One probe per part that forwards `...restProps`. Each is rendered here rather than from the spec
	so the generic parts keep their concrete `DataTableHarnessRow` type — a bare `render(Part, …)`
	would widen `TData` to `unknown`.
-->
{#snippet restProbes()}
	{@const titleColumn = dataTable.table.getColumn('title')}
	{@const status = dataTable.table.getColumn('status')}
	{@const created = dataTable.table.getColumn('createdAt')}
	{@const hours = dataTable.table.getColumn('estimatedHours')}
	<div data-testid="rest-probes">
		<DataTable.ViewOptions table={dataTable.table} side="top" data-testid="view-options-content" />
		{#if status}
			<DataTable.FacetedFilter
				column={status}
				title="Status"
				options={STATUS_OPTIONS}
				data-testid="faceted-rest"
			/>
			<DataTable.ToolbarFilter column={status} data-testid="delegated-rest" />
		{/if}
		{#if created}
			<DataTable.DateFilter column={created} title="Created" data-testid="date-rest" />
		{/if}
		{#if hours}
			<DataTable.SliderFilter column={hours} title="Est. Hours" data-testid="slider-rest" />
		{/if}
		{#if titleColumn}
			<DataTable.ToolbarFilter column={titleColumn} data-testid="text-rest" />
		{/if}
	</div>
{/snippet}

{#snippet table()}
	<DataTable.Root table={dataTable.table} actionBar={withActionBar ? actionBar : undefined}>
		{#if withToolbar}
			<DataTable.Toolbar>
				<span data-testid="toolbar-child">extra</span>
			</DataTable.Toolbar>
		{:else if withStandaloneViewOptions}
			<DataTable.ViewOptions disabled={viewOptionsDisabled} {reorderable} />
		{/if}
	</DataTable.Root>
	{#if withRestProbes}
		{@render restProbes()}
	{/if}
{/snippet}

{#snippet body()}
	{#if dir}
		<div {dir}>{@render table()}</div>
	{:else}
		{@render table()}
	{/if}
{/snippet}

{#if withDirectionProvider}
	<DirectionProvider dir={dir ?? 'ltr'}>
		{@render body()}
	</DirectionProvider>
{:else}
	{@render body()}
{/if}
