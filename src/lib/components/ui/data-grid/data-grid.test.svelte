<script lang="ts" module>
	import type { RowSelectionState, SortingState, TableState } from '@tanstack/table-core';

	import type {
		CellPosition,
		CellUpdate,
		DataGridColumnDef,
		DataGridInitialState,
		DataGridState,
		FileCellData,
		RowHeightValue
	} from './index.js';

	/** One fixture row. Every one of the nine cell variants has a field here. */
	export type DataGridHarnessRow = {
		id: string;
		name: string;
		description: string;
		amount: number | null;
		website: string;
		active: boolean;
		status: string;
		tags: string[];
		dueDate: string | null;
		files: FileCellData[];
	};

	/** The default three rows. Deliberately unsorted so a sort click is observable. */
	export const HARNESS_ROWS: DataGridHarnessRow[] = [
		{
			id: 'r1',
			name: 'Charlie',
			description: 'first row notes',
			amount: 30,
			website: 'example.com',
			active: false,
			status: 'todo',
			tags: ['alpha'],
			dueDate: '2024-03-01',
			files: []
		},
		{
			id: 'r2',
			name: 'Alpha',
			description: 'second row notes',
			amount: 90,
			website: 'https://svelte.dev',
			active: true,
			status: 'done',
			tags: ['alpha', 'beta'],
			dueDate: '2024-04-01',
			files: [{ id: 'f1', name: 'report.pdf', size: 2048, type: 'application/pdf' }]
		},
		{
			id: 'r3',
			name: 'Echo',
			description: 'third row notes',
			amount: null,
			website: '',
			active: false,
			status: 'todo',
			tags: [],
			dueDate: null,
			files: []
		}
	];

	/** Options for the `status` column. */
	export const STATUS_OPTIONS = [
		{ label: 'Todo', value: 'todo' },
		{ label: 'In Progress', value: 'in-progress' },
		{ label: 'Done', value: 'done' }
	];

	/** Options for the `tags` column. */
	export const TAG_OPTIONS = [
		{ label: 'Alpha', value: 'alpha' },
		{ label: 'Beta', value: 'beta' },
		{ label: 'Gamma', value: 'gamma' }
	];

	export type DataGridHarnessProps = {
		/** Rows handed to `createDataGrid`. @default HARNESS_ROWS */
		rows?: DataGridHarnessRow[];
		/** Drop every column but `name`, `amount` and `active`. @default false */
		minimalColumns?: boolean;
		/** Render only the `name` column, for the single-navigable-column edge case. */
		singleColumn?: boolean;
		/** Render only a non-navigable `actions` column, for the zero-navigable edge case. */
		noNavigableColumns?: boolean;
		/** Prepend a non-navigable `select` column. @default false */
		withSelectColumn?: boolean;
		/** Seeds the uncontrolled table slices. */
		initialState?: DataGridInitialState;
		/** Fully controlled table state, merged last. */
		state?: Partial<TableState>;
		/** Hands the created state object back so a spec can drive it. */
		onCreate?: (grid: DataGridState<DataGridHarnessRow>) => void;
		dir?: 'ltr' | 'rtl';
		/** Wrap the tree in `<DirectionProvider>` instead of a bare `dir` attribute. */
		withDirectionProvider?: boolean;
		rowHeight?: RowHeightValue;
		overscan?: number;
		autoFocus?: boolean | Partial<CellPosition>;
		readOnly?: boolean;
		enableSearch?: boolean;
		enablePaste?: boolean;
		enableColumnSelection?: boolean;
		enableSingleCellSelection?: boolean;
		height?: number;
		stretchColumns?: boolean;
		/** Whether the harness applies `onDataChange` to its own copy of the rows. @default true */
		applyDataChange?: boolean;
		onDataChange?: (data: DataGridHarnessRow[]) => void;
		onRowAdd?: (event?: MouseEvent) => Partial<CellPosition> | null | void;
		onRowsAdd?: (count: number) => void;
		onRowsDelete?: (rows: DataGridHarnessRow[], rowIndices: number[]) => void;
		onPaste?: (updates: CellUpdate[]) => void;
		onFilesUpload?: (params: {
			files: File[];
			rowIndex: number;
			columnId: string;
		}) => Promise<FileCellData[]>;
		onFilesDelete?: (params: { fileIds: string[]; rowIndex: number; columnId: string }) => void;
		onSortingChange?: (sorting: SortingState) => void;
		onRowSelectionChange?: (selection: RowSelectionState) => void;
		onRowHeightChange?: (rowHeight: RowHeightValue) => void;
		/** Render `<DataGrid.KeyboardShortcuts>` inside the root. @default false */
		withShortcuts?: boolean;
		shortcutsOpen?: boolean;
		shortcutsDefaultOpen?: boolean;
		onShortcutsOpenChange?: (open: boolean) => void;
		shortcutsEnableSearch?: boolean;
		shortcutsEnableUndoRedo?: boolean;
		shortcutsEnablePaste?: boolean;
		shortcutsEnableRowAdd?: boolean;
		shortcutsEnableRowsDelete?: boolean;
	};

	/** Every fixture column, in render order. */
	function buildColumns(): DataGridColumnDef<DataGridHarnessRow>[] {
		return [
			{
				id: 'name',
				accessorKey: 'name',
				meta: { label: 'Name', cell: { variant: 'short-text' } }
			},
			{
				id: 'description',
				accessorKey: 'description',
				meta: { label: 'Description', cell: { variant: 'long-text' } }
			},
			{
				id: 'amount',
				accessorKey: 'amount',
				meta: { label: 'Amount', cell: { variant: 'number', min: 0, max: 1000, step: 5 } }
			},
			{
				id: 'website',
				accessorKey: 'website',
				meta: { label: 'Website', cell: { variant: 'url' } }
			},
			{
				id: 'active',
				accessorKey: 'active',
				meta: { label: 'Active', cell: { variant: 'checkbox' } }
			},
			{
				id: 'status',
				accessorKey: 'status',
				meta: { label: 'Status', cell: { variant: 'select', options: STATUS_OPTIONS } }
			},
			{
				id: 'tags',
				accessorKey: 'tags',
				meta: { label: 'Tags', cell: { variant: 'multi-select', options: TAG_OPTIONS } }
			},
			{
				id: 'dueDate',
				accessorKey: 'dueDate',
				meta: { label: 'Due date', cell: { variant: 'date' } }
			},
			{
				id: 'files',
				accessorKey: 'files',
				meta: { label: 'Files', cell: { variant: 'file', maxFiles: 3 } }
			}
		];
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';

	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import * as DataGrid from './index.js';
	import { createDataGrid } from './index.js';

	let {
		rows = HARNESS_ROWS,
		minimalColumns = false,
		singleColumn = false,
		noNavigableColumns = false,
		withSelectColumn = false,
		initialState,
		state: controlledState,
		onCreate,
		dir,
		withDirectionProvider = false,
		rowHeight,
		overscan,
		autoFocus,
		readOnly = false,
		enableSearch = false,
		enablePaste = false,
		enableColumnSelection = false,
		enableSingleCellSelection = false,
		height,
		stretchColumns = false,
		applyDataChange = true,
		onDataChange,
		onRowAdd,
		onRowsAdd,
		onRowsDelete,
		onPaste,
		onFilesUpload,
		onFilesDelete,
		onSortingChange,
		onRowSelectionChange,
		onRowHeightChange,
		withShortcuts = false,
		shortcutsOpen = $bindable(),
		shortcutsDefaultOpen = false,
		onShortcutsOpenChange,
		shortcutsEnableSearch = false,
		shortcutsEnableUndoRedo = false,
		shortcutsEnablePaste = false,
		shortcutsEnableRowAdd = false,
		shortcutsEnableRowsDelete = false
	}: DataGridHarnessProps = $props();

	/** The harness owns the data, exactly as a consumer would. */
	let data = $state.raw<DataGridHarnessRow[]>(untrack(() => rows));

	const minimalIds = new Set(['name', 'amount', 'active']);

	const columns = $derived.by(() => {
		if (noNavigableColumns) {
			return [{ id: 'actions', header: 'Actions' }] as DataGridColumnDef<DataGridHarnessRow>[];
		}

		const all = buildColumns();
		let picked = all;
		if (singleColumn) picked = all.filter((column) => column.id === 'name');
		else if (minimalColumns) picked = all.filter((column) => minimalIds.has(column.id ?? ''));

		if (!withSelectColumn) return picked;
		return [
			{
				id: 'select',
				header: 'Select',
				enableSorting: false
			} as DataGridColumnDef<DataGridHarnessRow>,
			...picked
		];
	});

	const grid = createDataGrid<DataGridHarnessRow>({
		data: () => data,
		columns: () => columns,
		getRowId: (row) => row.id,
		initialState: untrack(() => initialState),
		state: () => controlledState ?? {},
		rowHeight: untrack(() => rowHeight),
		overscan: untrack(() => overscan),
		dir: untrack(() => (withDirectionProvider ? undefined : dir)),
		autoFocus: untrack(() => autoFocus),
		readOnly,
		enableSearch: untrack(() => enableSearch),
		enablePaste: untrack(() => enablePaste),
		enableColumnSelection: untrack(() => enableColumnSelection),
		enableSingleCellSelection: untrack(() => enableSingleCellSelection),
		onDataChange: (next) => {
			if (applyDataChange) data = next;
			onDataChange?.(next);
		},
		onRowAdd: onRowAdd ? (event) => onRowAdd(event) : undefined,
		onRowsAdd: onRowsAdd ? (count) => onRowsAdd(count) : undefined,
		onRowsDelete: onRowsDelete ? (deleted, indices) => onRowsDelete(deleted, indices) : undefined,
		onPaste: onPaste ? (updates) => onPaste(updates) : undefined,
		onFilesUpload: onFilesUpload ? (params) => onFilesUpload(params) : undefined,
		onFilesDelete: onFilesDelete ? (params) => onFilesDelete(params) : undefined,
		onSortingChange: (sorting) => onSortingChange?.(sorting),
		onRowSelectionChange: (selection) => onRowSelectionChange?.(selection),
		onRowHeightChange: (value) => onRowHeightChange?.(value)
	});

	untrack(() => onCreate?.(grid));
</script>

{#snippet body()}
	<DataGrid.Root {grid} {dir} {height} {stretchColumns}>
		{#if withShortcuts}
			<DataGrid.KeyboardShortcuts
				bind:open={shortcutsOpen}
				defaultOpen={shortcutsDefaultOpen}
				onOpenChange={onShortcutsOpenChange}
				enableSearch={shortcutsEnableSearch}
				enableUndoRedo={shortcutsEnableUndoRedo}
				enablePaste={shortcutsEnablePaste}
				enableRowAdd={shortcutsEnableRowAdd}
				enableRowsDelete={shortcutsEnableRowsDelete}
			/>
		{/if}
	</DataGrid.Root>
{/snippet}

{#if withDirectionProvider}
	<DirectionProvider dir={dir ?? 'ltr'}>
		{@render body()}
	</DirectionProvider>
{:else}
	{@render body()}
{/if}
