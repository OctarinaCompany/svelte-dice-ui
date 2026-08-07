<script lang="ts">
	import type { CellContext, HeaderContext } from '@tanstack/table-core';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import CircleDashedIcon from '@lucide/svelte/icons/circle-dashed';
	import DollarSignIcon from '@lucide/svelte/icons/dollar-sign';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';

	import { ComponentPreview } from '$lib/components/docs/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as DataTable from '$lib/components/ui/data-table/index.js';
	import { createDataTable, type DataTableColumnDef } from '$lib/components/ui/data-table/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Table from '$lib/components/ui/table/index.js';

	type Project = {
		id: string;
		title: string;
		status: 'active' | 'paused' | 'inactive';
		priority: 'low' | 'medium' | 'high';
		budget: number;
		effort: number;
		startedAt: number;
		dueAt: number;
	};

	function day(month: number, date: number): number {
		return new Date(2024, month - 1, date).getTime();
	}

	const projects: Project[] = [
		{
			id: '1',
			title: 'Project Alpha',
			status: 'active',
			priority: 'high',
			budget: 50000,
			effort: 12,
			startedAt: day(1, 8),
			dueAt: day(4, 30)
		},
		{
			id: '2',
			title: 'Project Beta',
			status: 'inactive',
			priority: 'low',
			budget: 75000,
			effort: 30,
			startedAt: day(2, 12),
			dueAt: day(6, 14)
		},
		{
			id: '3',
			title: 'Project Gamma',
			status: 'active',
			priority: 'medium',
			budget: 25000,
			effort: 6,
			startedAt: day(3, 3),
			dueAt: day(5, 20)
		},
		{
			id: '4',
			title: 'Project Delta',
			status: 'paused',
			priority: 'high',
			budget: 100000,
			effort: 44,
			startedAt: day(3, 21),
			dueAt: day(9, 1)
		},
		{
			id: '5',
			title: 'Project Epsilon',
			status: 'active',
			priority: 'low',
			budget: 18000,
			effort: 3,
			startedAt: day(4, 2),
			dueAt: day(7, 11)
		},
		{
			id: '6',
			title: 'Project Zeta',
			status: 'inactive',
			priority: 'medium',
			budget: 62000,
			effort: 21,
			startedAt: day(5, 9),
			dueAt: day(8, 25)
		}
	];

	const statusOptions = [
		{ label: 'Active', value: 'active', icon: CheckCircle2Icon, count: 3 },
		{ label: 'Paused', value: 'paused', icon: CircleDashedIcon, count: 1 },
		{ label: 'Inactive', value: 'inactive', icon: XCircleIcon, count: 2 }
	];

	const priorityOptions = [
		{ label: 'Low', value: 'low', icon: ArrowDownIcon, count: 2 },
		{ label: 'Medium', value: 'medium', icon: ArrowRightIcon, count: 2 },
		{ label: 'High', value: 'high', icon: ArrowUpIcon, count: 2 }
	];

	const statusIcons = {
		active: CheckCircle2Icon,
		paused: CircleDashedIcon,
		inactive: XCircleIcon
	};

	const priorityIcons = {
		low: ArrowDownIcon,
		medium: ArrowRightIcon,
		high: ArrowUpIcon
	};

	// --- Example 1: browse, sort and page --------------------------------------

	const basicColumns: DataTableColumnDef<Project>[] = [
		{
			id: 'title',
			accessorKey: 'title',
			header: titleHeader,
			meta: { label: 'Title' }
		},
		{
			id: 'status',
			accessorKey: 'status',
			header: statusHeader,
			cell: statusCell,
			meta: { label: 'Status' }
		},
		{
			id: 'budget',
			accessorKey: 'budget',
			header: budgetHeader,
			cell: budgetCell,
			meta: { label: 'Budget' }
		}
	];

	const basic = createDataTable<Project>({
		data: () => projects,
		columns: () => basicColumns,
		getRowId: (row) => row.id,
		initialState: { sorting: [{ id: 'title', desc: false }], pagination: { pageSize: 3 } }
	});

	// --- Example 2: plain sortable headers ---------------------------------------

	// Upstream ships no dropdown-free header demo; this is the classic shadcn/ui data-table
	// recipe — a ghost button in the header snippet that cycles the sort — composed in the page
	// only, so the column header part stays untouched.
	const plainColumns: DataTableColumnDef<Project>[] = [
		{
			id: 'title',
			accessorKey: 'title',
			header: plainSortHeader,
			meta: { label: 'Title' }
		},
		{
			id: 'status',
			accessorKey: 'status',
			header: plainSortHeader,
			cell: statusCell,
			meta: { label: 'Status' }
		},
		{
			id: 'budget',
			accessorKey: 'budget',
			header: plainSortHeader,
			cell: budgetCell,
			meta: { label: 'Budget' }
		}
	];

	const plain = createDataTable<Project>({
		data: () => projects,
		columns: () => plainColumns,
		getRowId: (row) => row.id,
		initialState: { sorting: [{ id: 'title', desc: false }], pagination: { pageSize: 3 } }
	});

	// --- Example 3: filter, hide columns and select rows ------------------------

	const toolbarColumns: DataTableColumnDef<Project>[] = [
		{
			id: 'select',
			header: selectHeader,
			cell: selectCell,
			size: 32,
			enableSorting: false,
			enableHiding: false
		},
		{
			id: 'title',
			accessorKey: 'title',
			header: titleHeader,
			enableColumnFilter: true,
			meta: { label: 'Title', placeholder: 'Search titles...', variant: 'text' }
		},
		{
			id: 'status',
			accessorKey: 'status',
			header: statusHeader,
			cell: statusCell,
			enableColumnFilter: true,
			filterFn: (row, columnId, filterValue) =>
				Array.isArray(filterValue) && filterValue.includes(row.getValue(columnId)),
			meta: { label: 'Status', variant: 'multiSelect', options: statusOptions }
		},
		{
			id: 'priority',
			accessorKey: 'priority',
			header: priorityHeader,
			cell: priorityCell,
			enableColumnFilter: true,
			filterFn: (row, columnId, filterValue) =>
				Array.isArray(filterValue) && filterValue.includes(row.getValue(columnId)),
			meta: { label: 'Priority', variant: 'select', options: priorityOptions }
		},
		{
			id: 'budget',
			accessorKey: 'budget',
			header: budgetHeader,
			cell: budgetCell,
			enableColumnFilter: true,
			// The `number` variant writes the raw input string, so the comparison is stringified.
			filterFn: (row, columnId, filterValue) =>
				filterValue === '' || String(row.getValue(columnId)) === String(filterValue),
			meta: { label: 'Budget', placeholder: 'Budget', variant: 'number', unit: 'USD' }
		}
	];

	const withToolbar = createDataTable<Project>({
		data: () => projects,
		columns: () => toolbarColumns,
		getRowId: (row) => row.id,
		initialState: { pagination: { pageSize: 4 } }
	});

	// --- Example 4: search with match highlighting -------------------------------

	// Upstream ships no highlighting demo. Composed in the page only — the toolbar's text input and
	// the column's `filterFn` are untouched; the highlight is purely a `cell` snippet, so nothing
	// about it needs to live in the component.
	type Segment = { text: string; match: boolean };

	/**
	 * Splits `text` around every case-insensitive occurrence of `query`.
	 *
	 * An `indexOf` loop rather than a regex, so a query of `(` or `\` matches literally instead of
	 * throwing out of `new RegExp()`. Segments are sliced from the original string, which keeps the
	 * rendered casing; rendering them through the template rather than `{@html}` keeps cell data
	 * inert.
	 */
	function splitOnQuery(text: string, query: string): Segment[] {
		const needle = query.trim().toLowerCase();
		if (!needle) return [{ text, match: false }];
		const haystack = text.toLowerCase();
		// `toLowerCase` is not length-preserving for every character ('İ' becomes 'i' + U+0307), and
		// these are haystack indices sliced out of `text`. When the fold shifts them, no highlight
		// beats a misplaced one.
		if (haystack.length !== text.length) return [{ text, match: false }];
		const segments: Segment[] = [];
		let from = 0;
		let at = haystack.indexOf(needle);
		while (at !== -1) {
			if (at > from) segments.push({ text: text.slice(from, at), match: false });
			segments.push({ text: text.slice(at, at + needle.length), match: true });
			from = at + needle.length;
			at = haystack.indexOf(needle, from);
		}
		if (from < text.length) segments.push({ text: text.slice(from), match: false });
		return segments;
	}

	const searchColumns: DataTableColumnDef<Project>[] = [
		{
			id: 'title',
			accessorKey: 'title',
			header: titleHeader,
			cell: highlightedTitleCell,
			enableColumnFilter: true,
			meta: { label: 'Title', placeholder: 'Search titles...', variant: 'text' }
		},
		{
			id: 'status',
			accessorKey: 'status',
			header: statusHeader,
			cell: statusCell,
			meta: { label: 'Status' }
		},
		{
			id: 'budget',
			accessorKey: 'budget',
			header: budgetHeader,
			cell: budgetCell,
			meta: { label: 'Budget' }
		}
	];

	const search = createDataTable<Project>({
		data: () => projects,
		columns: () => searchColumns,
		getRowId: (row) => row.id,
		initialState: { pagination: { pageSize: 4 } }
	});

	// The *applied* filter drives the highlight — the same value the column's `filterFn` reads — so
	// the marks can never disagree with the rows that survived.
	const searchQuery = $derived.by(() => {
		const value = search.table.getColumn('title')?.getFilterValue();
		return typeof value === 'string' ? value : '';
	});

	// --- Example 5: range and date filters, pinning and reordering ---------------

	const advancedColumns: DataTableColumnDef<Project>[] = [
		{
			id: 'title',
			accessorKey: 'title',
			header: titleHeader,
			enableColumnFilter: true,
			meta: { label: 'Title', placeholder: 'Search titles...', variant: 'text' }
		},
		{
			id: 'effort',
			accessorKey: 'effort',
			header: effortHeader,
			cell: effortCell,
			enableColumnFilter: true,
			filterFn: 'inNumberRange',
			meta: { label: 'Effort', variant: 'range', range: [0, 50], unit: 'd' }
		},
		{
			id: 'startedAt',
			accessorKey: 'startedAt',
			header: startedHeader,
			cell: startedCell,
			enableColumnFilter: true,
			filterFn: (row, columnId, filterValue) =>
				typeof filterValue !== 'number' || row.getValue(columnId) === filterValue,
			meta: { label: 'Started', variant: 'date' }
		},
		{
			id: 'dueAt',
			accessorKey: 'dueAt',
			header: dueHeader,
			cell: dueCell,
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
			id: 'actions',
			header: actionsHeader,
			cell: actionsCell,
			size: 48,
			enableSorting: false,
			enableHiding: false
		}
	];

	const advanced = createDataTable<Project>({
		data: () => projects,
		columns: () => advancedColumns,
		getRowId: (row) => row.id,
		initialState: {
			columnPinning: { right: ['actions'] },
			pagination: { pageSize: 4 }
		}
	});

	// --- Example 6: selectable rows with a numbered pager -------------------------

	// Mirrors blocks.so's table-05 (github.com/ephraimduncan/blocks/blob/main/content/components/
	// tables/table-05.tsx), minus its search input: checkbox selection, status badges, a row
	// actions menu and a numbered pager with a per-page count. `DataTable.Root` always renders the
	// shared `DataTable.Pagination` footer, so this composes `Table.Root` and `DataTable.FlexRender`
	// directly — the same pieces `data-table.svelte` renders internally — to swap in the numbered
	// footer without touching the shared component.
	type OrderStatus = 'completed' | 'processing' | 'pending' | 'cancelled';

	type Order = {
		id: string;
		name: string;
		date: string;
		status: OrderStatus;
		amount: number;
	};

	const orders: Order[] = [
		{ id: '1', name: 'Project Alpha', date: 'Jan 15, 2024', status: 'completed', amount: 2500 },
		{ id: '2', name: 'Website Redesign', date: 'Feb 3, 2024', status: 'processing', amount: 4200 },
		{ id: '3', name: 'Mobile App MVP', date: 'Feb 18, 2024', status: 'pending', amount: 8750 },
		{ id: '4', name: 'Brand Identity', date: 'Mar 5, 2024', status: 'completed', amount: 1800 },
		{
			id: '5',
			name: 'Marketing Campaign',
			date: 'Mar 22, 2024',
			status: 'cancelled',
			amount: 3400
		},
		{
			id: '6',
			name: 'Analytics Dashboard',
			date: 'Apr 8, 2024',
			status: 'processing',
			amount: 5600
		},
		{
			id: '7',
			name: 'E-commerce Platform',
			date: 'Apr 25, 2024',
			status: 'pending',
			amount: 12000
		},
		{ id: '8', name: 'API Integration', date: 'May 10, 2024', status: 'completed', amount: 3200 }
	];

	// Upstream's emerald/amber/blue/rose classes, mapped onto the repo's status tokens
	// (CLAUDE.md §6) — "cancelled" reads as a failure state, so it takes `destructive` rather than
	// the meaningless decorative `rose` hue.
	const orderStatusConfig: Record<OrderStatus, { label: string; class: string }> = {
		completed: { label: 'Completed', class: 'border-0 bg-success/15 text-success' },
		processing: { label: 'Processing', class: 'border-0 bg-info/15 text-info' },
		pending: { label: 'Pending', class: 'border-0 bg-warning/15 text-warning' },
		cancelled: { label: 'Cancelled', class: 'border-0 bg-destructive/15 text-destructive' }
	};

	const orderPageSizeOptions = [5, 10, 20];

	const ordersColumns: DataTableColumnDef<Order>[] = [
		{
			id: 'select',
			header: orderSelectHeader,
			cell: orderSelectCell,
			size: 32,
			enableSorting: false,
			enableHiding: false
		},
		{
			id: 'name',
			accessorKey: 'name',
			header: 'Name',
			cell: orderNameCell
		},
		{
			id: 'date',
			accessorKey: 'date',
			header: 'Date'
		},
		{
			id: 'status',
			accessorKey: 'status',
			header: 'Status',
			cell: orderStatusCell
		},
		{
			id: 'amount',
			accessorKey: 'amount',
			header: orderAmountHeader,
			cell: orderAmountCell
		},
		{
			id: 'actions',
			// Blank, like upstream's header-less actions column — `DataTable.FlexRender` would
			// otherwise fall back to the column id ("actions") as visible text.
			header: '',
			cell: orderActionsCell,
			size: 32,
			enableSorting: false,
			enableHiding: false
		}
	];

	const ordersTable = createDataTable<Order>({
		data: () => orders,
		columns: () => ordersColumns,
		getRowId: (row) => row.id,
		initialState: { pagination: { pageSize: 5 } }
	});

	// --- Props tables ------------------------------------------------------------

	const createOptions = [
		{
			prop: 'data',
			type: 'TData[] | (() => TData[])',
			default: '—',
			description: 'The rows. Pass a getter to keep them reactive.'
		},
		{
			prop: 'columns',
			type: 'DataTableColumnDef<TData>[] | (() => …)',
			default: '—',
			description: 'The column definitions. `header` and `cell` are strings or snippets.'
		},
		{
			prop: 'pageCount',
			type: 'number',
			default: '-1',
			description: 'Total pages for server-driven paging. `-1` lets the table derive it.'
		},
		{
			prop: 'initialState',
			type: 'DataTableInitialState<TData>',
			default: '{}',
			description: 'Seeds the seven state slices.'
		},
		{
			prop: 'state',
			type: 'Partial<TableState> | (() => …)',
			default: 'undefined',
			description: 'Fully controlled state, merged last — the caller becomes authoritative.'
		},
		{
			prop: 'getRowId',
			type: '(row, index, parent?) => string',
			default: 'undefined',
			description: 'Stable row identity; row selection is keyed by it.'
		},
		{
			prop: 'enableRowSelection',
			type: 'boolean | ((row) => boolean)',
			default: 'true',
			description: 'Whether rows can be selected, optionally per row.'
		},
		{
			prop: 'manualPagination / manualSorting / manualFiltering',
			type: 'boolean',
			default: 'false',
			description: 'Hand paging, sorting or filtering to the server instead.'
		},
		{
			prop: 'on*Change',
			type: '(value) => void',
			default: 'undefined',
			description:
				'One per slice — sorting, columnFilters, pagination, rowSelection, columnVisibility, columnPinning, columnOrder. Called with the resolved next value.'
		}
	];

	const rootProps = [
		{
			prop: 'table',
			type: 'Table<TData>',
			default: '—',
			description: 'Required. Also published to context for the toolbar and pagination.'
		},
		{
			prop: 'actionBar',
			type: 'Snippet',
			default: '—',
			description: 'Rendered only while at least one filtered row is selected.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: 'Rendered above the table — where the toolbar goes.'
		}
	];

	const partProps = [
		{
			part: 'DataTable.Toolbar',
			prop: 'table',
			type: 'Table<TData>',
			default: 'context',
			description: 'One filter per filterable column, plus Reset filters and the View menu.'
		},
		{
			part: 'DataTable.ColumnHeader',
			prop: 'column, label',
			type: 'Column<TData, TValue>, string',
			default: '—',
			description: 'Sort/hide menu, or plain text when the column allows neither.'
		},
		{
			part: 'DataTable.FacetedFilter',
			prop: 'options, multiple, open',
			type: 'Option[], boolean, boolean',
			default: '—, false, false',
			description: 'Command-palette facet with badge summary. `open` is bindable.'
		},
		{
			part: 'DataTable.SliderFilter',
			prop: 'column, title, open',
			type: 'Column<TData>, string, boolean',
			default: '—, —, false',
			description: 'Two-thumb range with paired numeric inputs and a unit suffix.'
		},
		{
			part: 'DataTable.DateFilter',
			prop: 'column, title, multiple, open',
			type: 'Column<TData>, string, boolean, boolean',
			default: '—, —, false, false',
			description: 'Calendar popover. The filter value stays epoch milliseconds.'
		},
		{
			part: 'DataTable.ViewOptions',
			prop: 'disabled, reorderable, align, open',
			type: 'boolean, boolean, "start" | "center" | "end", boolean',
			default: 'false, false, "end", false',
			description:
				'Column visibility list; `reorderable` adds drag-to-reorder. A "Reset columns" row appears at the foot of the list once the view differs from `initialState`.'
		},
		{
			part: 'DataTable.Pagination',
			prop: 'table, pageSizeOptions',
			type: 'Table<TData>, number[]',
			default: 'context, [10, 20, 30, 40, 50]',
			description: 'Page-size select, page summary and four labelled paging buttons.'
		},
		{
			part: 'DataTable.Skeleton',
			prop: 'columnCount, rowCount, filterCount, cellWidths',
			type: 'number, number, number, string[]',
			default: '—, 10, 0, ["auto"]',
			description: 'Loading placeholder with no live data and no interactive controls.'
		}
	];

	const dataAttributes = [
		{ part: 'Root', attribute: 'data-slot', value: '"data-table"' },
		{ part: 'Body row', attribute: 'data-state', value: '"selected" while the row is selected.' },
		{ part: 'Header / body cell', attribute: 'data-pinned', value: '"left" | "right"' },
		{
			part: 'Header / body cell',
			attribute: 'data-pinned-edge',
			value: 'Present on the last left-pinned and first right-pinned column.'
		},
		{ part: 'Toolbar', attribute: 'data-filtered', value: 'Present while a filter is applied.' },
		{ part: 'ColumnHeader', attribute: 'data-sorted', value: '"asc" | "desc"' },
		{
			part: 'FacetedFilter / DateFilter',
			attribute: 'data-multiple',
			value: 'Present when multiple.'
		},
		{
			part: 'FacetedFilter / DateFilter / SliderFilter',
			attribute: 'data-selected',
			value: 'Present while the filter holds a value.'
		},
		{ part: 'ViewOptions', attribute: 'data-reorderable', value: 'Present when reorderable.' },
		{ part: 'Pagination', attribute: 'data-dir', value: '"ltr" | "rtl"' },
		{ part: 'Skeleton', attribute: 'data-loading', value: 'Always present.' }
	];
</script>

<svelte:head>
	<title>Data Table — svelte-dice-ui</title>
</svelte:head>

{#snippet titleHeader(ctx: HeaderContext<Project, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Title" />
{/snippet}

{#snippet statusHeader(ctx: HeaderContext<Project, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Status" />
{/snippet}

<!-- A dropdown-free sortable header: clicking it cycles ascending <-> descending directly.
	The label comes from the column's `meta.label`, so one snippet serves every column. -->
{#snippet plainSortHeader(ctx: HeaderContext<Project, unknown>)}
	{@const sorted = ctx.column.getIsSorted()}
	<Button
		variant="ghost"
		size="sm"
		class="-ms-2.5 [&_svg]:text-muted-foreground"
		data-sorted={sorted || undefined}
		onclick={() => ctx.column.toggleSorting(sorted === 'asc')}
	>
		{ctx.column.columnDef.meta?.label}
		{#if sorted === 'desc'}
			<ChevronDownIcon />
		{:else if sorted === 'asc'}
			<ChevronUpIcon />
		{:else}
			<ChevronsUpDownIcon />
		{/if}
	</Button>
{/snippet}

<!--
	`<mark>` rather than a styled span: it is the element the HTML spec defines for marking text of
	special relevance to the reader, NVDA announces it, and Windows High Contrast maps it to the
	Mark/MarkText system colours a span would lose. The class replaces its UA default (yellow on
	black), which no theme survives.
	Written on one line because whitespace between the blocks would land inside the cell text.
-->
{#snippet highlightedTitleCell(ctx: CellContext<Project, unknown>)}
	{@const segments = splitOnQuery(String(ctx.getValue()), searchQuery)}
	<!-- Keyed by index: the segments are derived from the query and regenerated whole on every
		change, so position is the only identity they have. -->
	{#each segments as segment, index (index)}{#if segment.match}<mark
				class="rounded-sm bg-highlight text-highlight-foreground">{segment.text}</mark
			>{:else}{segment.text}{/if}{/each}
{/snippet}

{#snippet statusCell(ctx: CellContext<Project, unknown>)}
	{@const status = ctx.row.original.status}
	{@const Icon = statusIcons[status]}
	<Badge variant="outline" class="capitalize">
		<Icon />
		{status}
	</Badge>
{/snippet}

{#snippet priorityHeader(ctx: HeaderContext<Project, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Priority" />
{/snippet}

{#snippet priorityCell(ctx: CellContext<Project, unknown>)}
	{@const priority = ctx.row.original.priority}
	{@const Icon = priorityIcons[priority]}
	<span class="flex items-center gap-1.5 capitalize">
		<Icon class="size-4 text-muted-foreground" />
		{priority}
	</span>
{/snippet}

{#snippet budgetHeader(ctx: HeaderContext<Project, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Budget" />
{/snippet}

{#snippet budgetCell(ctx: CellContext<Project, unknown>)}
	<span class="flex items-center gap-1">
		<DollarSignIcon class="size-4 text-muted-foreground" />
		{ctx.row.original.budget.toLocaleString('en-US')}
	</span>
{/snippet}

{#snippet effortHeader(ctx: HeaderContext<Project, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Effort" />
{/snippet}

{#snippet effortCell(ctx: CellContext<Project, unknown>)}
	{ctx.row.original.effort} d
{/snippet}

{#snippet startedHeader(ctx: HeaderContext<Project, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Started" />
{/snippet}

{#snippet startedCell(ctx: CellContext<Project, unknown>)}
	{DataTable.formatDate(ctx.row.original.startedAt)}
{/snippet}

{#snippet dueHeader(ctx: HeaderContext<Project, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Due" />
{/snippet}

{#snippet dueCell(ctx: CellContext<Project, unknown>)}
	{DataTable.formatDate(ctx.row.original.dueAt)}
{/snippet}

{#snippet actionsHeader(ctx: HeaderContext<Project, unknown>)}
	<DataTable.ColumnHeader column={ctx.column} label="Actions" />
{/snippet}

{#snippet actionsCell(ctx: CellContext<Project, unknown>)}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					aria-label={`Open ${ctx.row.original.title} menu`}
				>
					<MoreHorizontalIcon />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item>Edit</DropdownMenu.Item>
			<DropdownMenu.Item variant="destructive">Delete</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/snippet}

<!-- The selection column recipe: a labelled header checkbox that goes indeterminate while only
	some of the page's rows are selected, and a labelled checkbox in every row. -->
{#snippet selectHeader(ctx: HeaderContext<Project, unknown>)}
	<Checkbox
		aria-label="Select all"
		bind:checked={
			() => ctx.table.getIsAllPageRowsSelected(),
			(next) => ctx.table.toggleAllPageRowsSelected(next)
		}
		bind:indeterminate={() => ctx.table.getIsSomePageRowsSelected(), () => {}}
	/>
{/snippet}

{#snippet selectCell(ctx: CellContext<Project, unknown>)}
	<Checkbox
		aria-label="Select row"
		bind:checked={() => ctx.row.getIsSelected(), (next) => ctx.row.toggleSelected(next)}
	/>
{/snippet}

{#snippet orderSelectHeader(ctx: HeaderContext<Order, unknown>)}
	<Checkbox
		aria-label="Select all"
		bind:checked={
			() => ctx.table.getIsAllPageRowsSelected(),
			(next) => ctx.table.toggleAllPageRowsSelected(next)
		}
		bind:indeterminate={() => ctx.table.getIsSomePageRowsSelected(), () => {}}
	/>
{/snippet}

{#snippet orderSelectCell(ctx: CellContext<Order, unknown>)}
	<Checkbox
		aria-label="Select row"
		bind:checked={() => ctx.row.getIsSelected(), (next) => ctx.row.toggleSelected(next)}
	/>
{/snippet}

{#snippet orderNameCell(ctx: CellContext<Order, unknown>)}
	<span class="font-medium">{ctx.row.original.name}</span>
{/snippet}

{#snippet orderStatusCell(ctx: CellContext<Order, unknown>)}
	{@const config = orderStatusConfig[ctx.row.original.status]}
	<Badge variant="outline" class={config.class}>{config.label}</Badge>
{/snippet}

{#snippet orderAmountHeader()}
	<div class="text-right">Amount</div>
{/snippet}

{#snippet orderAmountCell(ctx: CellContext<Order, unknown>)}
	<div class="text-right font-medium">
		{ctx.row.original.amount.toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 0
		})}
	</div>
{/snippet}

{#snippet orderActionsCell(ctx: CellContext<Order, unknown>)}
	<div class="text-right">
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="icon"
						aria-label={`Open ${ctx.row.original.name} menu`}
					>
						<MoreHorizontalIcon />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Item>
					<EyeIcon />
					View details
				</DropdownMenu.Item>
				<DropdownMenu.Item>
					<PencilIcon />
					Edit
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item variant="destructive">
					<Trash2Icon />
					Delete
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
{/snippet}

<!-- "Show N entries" — blocks.so's page-size control, without its neighbouring search input
	(dropped per review). -->
{#snippet ordersPageSizeSelect()}
	{@const pageSize = ordersTable.table.getState().pagination.pageSize}
	<div class="flex items-center gap-2">
		<span class="text-sm text-muted-foreground">Show</span>
		<Select.Root
			type="single"
			value={String(pageSize)}
			onValueChange={(value) => ordersTable.table.setPageSize(Number(value))}
		>
			<Select.Trigger class="h-8 w-16" aria-label="Rows per page">
				{pageSize}
			</Select.Trigger>
			<Select.Content>
				<Select.Group>
					{#each orderPageSizeOptions as size (size)}
						<Select.Item value={String(size)} label={String(size)} />
					{/each}
				</Select.Group>
			</Select.Content>
		</Select.Root>
		<span class="text-sm text-muted-foreground">entries</span>
	</div>
{/snippet}

<!-- A numbered pager — "Showing X to Y of Z entries" plus one button per page — instead of
	`DataTable.Pagination`'s "Page X of Y" and first/prev/next/last chevrons. -->
{#snippet ordersFooter()}
	{@const pagination = ordersTable.table.getState().pagination}
	{@const filteredCount = ordersTable.filteredRowCount}
	{@const from = filteredCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1}
	{@const to = Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredCount)}
	{@const currentPage = pagination.pageIndex + 1}
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<p class="text-sm text-muted-foreground">
			Showing {from} to {to} of {filteredCount} entries
		</p>
		<div class="flex items-center gap-1">
			<Button
				aria-label="Previous page"
				variant="outline"
				size="icon"
				class="size-8"
				disabled={!ordersTable.table.getCanPreviousPage()}
				onclick={() => ordersTable.table.previousPage()}
			>
				<ChevronLeftIcon />
			</Button>
			{#each Array.from({ length: ordersTable.pageCount }, (_, i) => i + 1) as page (page)}
				<Button
					aria-label={`Go to page ${page}`}
					variant={currentPage === page ? 'default' : 'outline'}
					size="icon"
					class="size-8"
					onclick={() => ordersTable.table.setPageIndex(page - 1)}
				>
					{page}
				</Button>
			{/each}
			<Button
				aria-label="Next page"
				variant="outline"
				size="icon"
				class="size-8"
				disabled={!ordersTable.table.getCanNextPage()}
				onclick={() => ordersTable.table.nextPage()}
			>
				<ChevronRightIcon />
			</Button>
		</div>
	</div>
{/snippet}

{#snippet selectionActionBar()}
	<div
		class="flex items-center justify-between gap-3 rounded-lg border bg-background p-2 text-sm shadow-sm"
	>
		<span class="text-muted-foreground">
			{withToolbar.selectedRowCount} of {withToolbar.filteredRowCount} selected
		</span>
		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				onclick={() => withToolbar.table.toggleAllRowsSelected(false)}
			>
				Clear
			</Button>
			<Button variant="outline" size="sm">Export</Button>
		</div>
	</div>
{/snippet}

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Data Table</h1>
		<p class="text-muted-foreground">
			A powerful and flexible data table for displaying, filtering, sorting and paginating tabular
			data, built on <code>@tanstack/table-core</code>.
		</p>
	</div>

	<ComponentPreview
		title="Default"
		description="Rows render from a table built by createDataTable; the column header menu sorts and the pagination controls page."
		class="items-start"
	>
		<div class="w-full">
			<DataTable.Root table={basic.table} />
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="Plain sortable headers"
		description="Headers without the dropdown menu — clicking a header cycles the sort between ascending and descending. Upstream ships no such demo; this composes a ghost Button in the header snippet, leaving the column header part untouched."
		class="items-start"
	>
		<div class="w-full">
			<DataTable.Root table={plain.table} />
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="Toolbar, filters and row selection"
		description="A text filter, a multi-select facet, a single-select facet, a number filter with a unit suffix, the View menu, and an action bar that appears only while rows are selected. Upstream's own demo covers fewer of these — it filters on text and one facet only — so this example carries the extra variants."
		class="items-start"
	>
		<div class="w-full">
			<DataTable.Root table={withToolbar.table} actionBar={selectionActionBar}>
				<DataTable.Toolbar />
			</DataTable.Root>
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="Search with match highlighting"
		description="A single text filter, with the matched substring marked in the column it searches. Upstream ships no such demo; the highlight is composed in the page as a cell snippet — the toolbar input and the column's filterFn are untouched — and reads the applied filter value, so the marks can never disagree with the rows that survived it."
		class="items-start"
	>
		<div class="w-full">
			<DataTable.Root table={search.table}>
				<DataTable.Toolbar />
			</DataTable.Root>
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="Range and date filters, pinning and reordering"
		description="A slider filter with a unit, single-date and date-range filters, a right-pinned actions column, and a View menu whose list can be dragged to reorder the columns."
		class="items-start"
	>
		<div class="w-full">
			<DataTable.Root table={advanced.table}>
				<DataTable.Toolbar reorderable />
			</DataTable.Root>
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="Selectable rows with a numbered pager"
		description="Mirrors blocks.so's table-05 (github.com/ephraimduncan/blocks) — checkbox selection, status badges, a row actions menu and a numbered pager with a per-page count, without its search input. DataTable.Root always renders the shared Pagination footer, so this composes Table.Root and DataTable.FlexRender directly to swap in the numbered one."
		class="items-start"
	>
		<div class="w-full max-w-3xl space-y-4">
			{@render ordersPageSizeSelect()}
			<div class="overflow-hidden rounded-lg border">
				<Table.Root>
					<Table.Header>
						{#each ordersTable.headerGroups as headerGroup (headerGroup.id)}
							<Table.Row>
								{#each headerGroup.headers as header (header.id)}
									<Table.Head colspan={header.colSpan}>
										{#if !header.isPlaceholder}
											<DataTable.FlexRender
												template={header.column.columnDef.header}
												context={header.getContext()}
												fallback={header.column.id}
											/>
										{/if}
									</Table.Head>
								{/each}
							</Table.Row>
						{/each}
					</Table.Header>
					<Table.Body>
						{#if ordersTable.rows.length}
							{#each ordersTable.rows as row (row.id)}
								<Table.Row data-state={row.getIsSelected() ? 'selected' : undefined}>
									{#each row.getVisibleCells() as cell (cell.id)}
										<Table.Cell>
											<DataTable.FlexRender
												template={cell.column.columnDef.cell}
												context={cell.getContext()}
												fallback={String(cell.renderValue() ?? '')}
											/>
										</Table.Cell>
									{/each}
								</Table.Row>
							{/each}
						{:else}
							<Table.Row>
								<Table.Cell
									colspan={ordersTable.table.getAllColumns().length}
									class="h-24 text-center"
								>
									No results.
								</Table.Cell>
							</Table.Row>
						{/if}
					</Table.Body>
				</Table.Root>
			</div>
			{@render ordersFooter()}
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="Skeleton"
		description="A presentational placeholder for the loading state — no live data, no interactive controls."
		class="items-start"
	>
		<div class="w-full">
			<DataTable.Skeleton columnCount={4} rowCount={4} filterCount={2} />
		</div>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">createDataTable(options)</h3>
			<p class="text-sm text-muted-foreground">
				Creates the table instance and the seven writable state slices. Call it during component
				initialisation.
			</p>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Option</Table.Head>
						<Table.Head>Type</Table.Head>
						<Table.Head>Default</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each createOptions as row (row.prop)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.prop}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.type}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.default}</Table.Cell>
							<Table.Cell>{row.description}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">DataTable.Root</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Prop</Table.Head>
						<Table.Head>Type</Table.Head>
						<Table.Head>Default</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each rootProps as row (row.prop)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.prop}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.type}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.default}</Table.Cell>
							<Table.Cell>{row.description}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Parts</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Part</Table.Head>
						<Table.Head>Props</Table.Head>
						<Table.Head>Type</Table.Head>
						<Table.Head>Default</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each partProps as row (row.part)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.part}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.prop}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.type}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.default}</Table.Cell>
							<Table.Cell>{row.description}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Data Attributes</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Part</Table.Head>
						<Table.Head>Attribute</Table.Head>
						<Table.Head>Value</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each dataAttributes as row (row.part + row.attribute)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.part}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.attribute}</Table.Cell>
							<Table.Cell>{row.value}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</section>
</article>
