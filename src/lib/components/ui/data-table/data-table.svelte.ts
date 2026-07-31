import {
	createTable,
	functionalUpdate,
	getCoreRowModel,
	getFacetedMinMaxValues,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type ColumnFiltersState,
	type ColumnOrderState,
	type ColumnPinningState,
	type HeaderGroup,
	type PaginationState,
	type Row,
	type RowData,
	type RowSelectionState,
	type SortingState,
	type Table,
	type TableOptionsResolved,
	type TableState,
	type Updater,
	type VisibilityState
} from '@tanstack/table-core';
import { getContext, hasContext, setContext } from 'svelte';

import type { CreateDataTableOptions, DataTableColumnDef } from './types.js';

/**
 * The runes half of `@tanstack/table-core` — the replacement for upstream's `useDataTable`
 * (and, underneath it, `useReactTable`).
 *
 * The table instance is created **once** and never re-created. Reactivity flows through
 * `table.options`: `data`, `columns` and `state` are redefined as getter properties that read the
 * `$state.raw` slices below, so every `table.getRowModel()` / `column.getIsSorted()` /
 * `table.getState()` call made inside a template or a `$derived` registers a fine-grained
 * dependency and re-runs when the slice it touched changes (research D-02).
 *
 * The getters have to be installed *after* `createTable`, because `createTable` merges the options
 * object it is handed with `{ ...defaultOptions, ...options }` — a spread evaluates getters and
 * copies their values, which would freeze the bridge at its initial state.
 */
export class DataTableState<TData extends RowData> {
	// The `$derived` fields below are lazy at runtime (evaluated on first read, by which point the
	// constructor has run), but svelte-check's static analysis cannot see that across the
	// constructor assignment — hence the definite-assignment assertion, matching the pattern in
	// `direction-provider.svelte.ts`.
	#options!: CreateDataTableOptions<TData>;

	/**
	 * The slices this class does not own — `expanded`, `grouping`, `globalFilter`, `columnSizing`,
	 * `rowPinning` and friends. Seeded from `table.initialState` and updated through
	 * `onStateChange`, so a feature this port does not surface still behaves normally.
	 */
	#restState = $state.raw<Partial<TableState>>({});

	/** Current sorting. Writing it is the controlled path; it does not re-fire `onSortingChange`. */
	sorting = $state.raw<SortingState>([]);
	/** Current column filters. */
	columnFilters = $state.raw<ColumnFiltersState>([]);
	/** Which columns are hidden. */
	columnVisibility = $state.raw<VisibilityState>({});
	/** Selected rows, keyed by row id. */
	rowSelection = $state.raw<RowSelectionState>({});
	/** Current page index and size. */
	pagination = $state.raw<PaginationState>({ pageIndex: 0, pageSize: 10 });
	/** Which columns are pinned left/right. */
	columnPinning = $state.raw<ColumnPinningState>({ left: [], right: [] });
	/** Explicit column order, when one has been set. */
	columnOrder = $state.raw<ColumnOrderState>([]);

	/**
	 * The table instance. Its identity is stable for the lifetime of this state object.
	 *
	 * Assigned in the constructor and read only from the lazy `$derived` fields below, which do not
	 * run at field-initialisation time — the assertion tells svelte-check the same.
	 */
	readonly table!: Table<TData>;

	/** `table.getRowModel().rows` — the rows of the current page. */
	readonly rows: Row<TData>[] = $derived(this.table.getRowModel().rows);
	/** `table.getHeaderGroups()`. */
	readonly headerGroups: HeaderGroup<TData>[] = $derived(this.table.getHeaderGroups());
	/** `table.getPageCount()`. */
	readonly pageCount: number = $derived(this.table.getPageCount());
	/** How many selected rows survive the current filters. */
	readonly selectedRowCount: number = $derived(
		this.table.getFilteredSelectedRowModel().rows.length
	);
	/** How many rows survive the current filters. */
	readonly filteredRowCount: number = $derived(this.table.getFilteredRowModel().rows.length);
	/** Whether at least one column filter is applied. */
	readonly isFiltered: boolean = $derived(this.columnFilters.length > 0);

	constructor(options: CreateDataTableOptions<TData>) {
		this.#options = options;

		const {
			data: _data,
			columns: _columns,
			state: _state,
			onSortingChange: _onSortingChange,
			onColumnFiltersChange: _onColumnFiltersChange,
			onColumnVisibilityChange: _onColumnVisibilityChange,
			onRowSelectionChange: _onRowSelectionChange,
			onPaginationChange: _onPaginationChange,
			onColumnPinningChange: _onColumnPinningChange,
			onColumnOrderChange: _onColumnOrderChange,
			initialState,
			pageCount = -1,
			defaultColumn,
			enableRowSelection = true,
			manualFiltering = false,
			manualPagination = false,
			manualSorting = false,
			...tableOptions
		} = options;

		const resolvedOptions: TableOptionsResolved<TData> = {
			...tableOptions,
			data: this.#resolveData(),
			columns: this.#resolveColumns(),
			initialState,
			// `-1` is the documented "unknown" default. table-core reads `options.pageCount ?? …`,
			// so it has to be handed `undefined` — passing `-1` through would make `getPageCount()`
			// answer `-1` forever and disable every paging control (Divergence 4).
			pageCount: pageCount < 0 ? undefined : pageCount,
			enableRowSelection,
			manualFiltering,
			manualPagination,
			manualSorting,
			// Upstream forces `enableColumnFilter: false` on every column, so only the columns that
			// opt in are filterable. `header`/`cell` are explicitly `undefined` so table-core's
			// built-in default templates do not shadow `DataTableFlexRender`'s fallback branch
			// (research D-03).
			defaultColumn: {
				header: undefined,
				cell: undefined,
				...defaultColumn,
				enableColumnFilter: false
			},
			state: {},
			onStateChange: (updater) => {
				this.#restState = functionalUpdate(updater, this.#getState());
			},
			onSortingChange: (updater) => this.#setSorting(updater),
			onColumnFiltersChange: (updater) => this.#setColumnFilters(updater),
			onColumnVisibilityChange: (updater) => this.#setColumnVisibility(updater),
			onRowSelectionChange: (updater) => this.#setRowSelection(updater),
			onPaginationChange: (updater) => this.#setPagination(updater),
			onColumnPinningChange: (updater) => this.#setColumnPinning(updater),
			onColumnOrderChange: (updater) => this.#setColumnOrder(updater),
			renderFallbackValue: null,
			getCoreRowModel: getCoreRowModel(),
			getFilteredRowModel: getFilteredRowModel(),
			getPaginationRowModel: getPaginationRowModel(),
			getSortedRowModel: getSortedRowModel(),
			getFacetedRowModel: getFacetedRowModel(),
			getFacetedUniqueValues: getFacetedUniqueValues(),
			getFacetedMinMaxValues: getFacetedMinMaxValues()
		};

		const table = createTable(resolvedOptions);
		this.table = table;

		// `table.initialState` is the caller's `initialState` merged with every feature's defaults,
		// so it is the one place that knows the resolved shape of every slice.
		this.sorting = table.initialState.sorting;
		this.columnFilters = table.initialState.columnFilters;
		this.columnVisibility = table.initialState.columnVisibility;
		this.rowSelection = table.initialState.rowSelection;
		this.pagination = table.initialState.pagination;
		this.columnPinning = table.initialState.columnPinning;
		this.columnOrder = table.initialState.columnOrder;

		Object.defineProperties(table.options, {
			data: { get: () => this.#resolveData(), enumerable: true, configurable: true },
			columns: { get: () => this.#resolveColumns(), enumerable: true, configurable: true },
			state: { get: () => this.#getState(), enumerable: true, configurable: true }
		});
	}

	#resolveData(): TData[] {
		const { data } = this.#options;
		return typeof data === 'function' ? data() : data;
	}

	#resolveColumns(): DataTableColumnDef<TData>[] {
		const { columns } = this.#options;
		return typeof columns === 'function' ? columns() : columns;
	}

	#resolveControlledState(): Partial<TableState> {
		const { state } = this.#options;
		if (state === undefined) return {};
		return typeof state === 'function' ? state() : state;
	}

	#getState(): TableState {
		return {
			...this.table.initialState,
			...this.#restState,
			sorting: this.sorting,
			columnFilters: this.columnFilters,
			columnVisibility: this.columnVisibility,
			rowSelection: this.rowSelection,
			pagination: this.pagination,
			columnPinning: this.columnPinning,
			columnOrder: this.columnOrder,
			...this.#resolveControlledState()
		};
	}

	// Each setter resolves the `Updater<T>` table-core hands it against the current slice, assigns
	// the slice, then calls the caller's `on…Change` with the **resolved next value** — never the
	// updater function (data-model.md § State transitions).

	#setSorting(updater: Updater<SortingState>): void {
		const next = functionalUpdate(updater, this.sorting);
		this.sorting = next;
		this.#options.onSortingChange?.(next);
	}

	#setColumnFilters(updater: Updater<ColumnFiltersState>): void {
		const next = functionalUpdate(updater, this.columnFilters);
		this.columnFilters = next;
		this.#options.onColumnFiltersChange?.(next);
	}

	#setColumnVisibility(updater: Updater<VisibilityState>): void {
		const next = functionalUpdate(updater, this.columnVisibility);
		this.columnVisibility = next;
		this.#options.onColumnVisibilityChange?.(next);
	}

	#setRowSelection(updater: Updater<RowSelectionState>): void {
		const next = functionalUpdate(updater, this.rowSelection);
		this.rowSelection = next;
		this.#options.onRowSelectionChange?.(next);
	}

	#setPagination(updater: Updater<PaginationState>): void {
		const next = functionalUpdate(updater, this.pagination);
		this.pagination = next;
		this.#options.onPaginationChange?.(next);
	}

	#setColumnPinning(updater: Updater<ColumnPinningState>): void {
		const next = functionalUpdate(updater, this.columnPinning);
		this.columnPinning = next;
		this.#options.onColumnPinningChange?.(next);
	}

	#setColumnOrder(updater: Updater<ColumnOrderState>): void {
		const next = functionalUpdate(updater, this.columnOrder);
		this.columnOrder = next;
		this.#options.onColumnOrderChange?.(next);
	}
}

/**
 * Create the table state. Must be called during component initialisation — it creates `$state`.
 *
 * @example
 * ```ts
 * const state = createDataTable({
 * 	data: () => rows,
 * 	columns: () => columns,
 * 	getRowId: (row) => row.id,
 * 	initialState: { sorting: [{ id: 'title', desc: true }] }
 * });
 * ```
 */
export function createDataTable<TData extends RowData>(
	options: CreateDataTableOptions<TData>
): DataTableState<TData> {
	return new DataTableState(options);
}

/** What `<DataTable.Root>` publishes so `Toolbar`, `ViewOptions` and `Pagination` can find it. */
export type DataTableContext<TData extends RowData> = {
	readonly table: Table<TData>;
};

const DATA_TABLE_CONTEXT_KEY = Symbol('data-table');

/** Publish the table instance. Called by `<DataTable.Root>`. */
export function setDataTableContext<TData extends RowData>(
	context: DataTableContext<TData>
): DataTableContext<TData> {
	return setContext(DATA_TABLE_CONTEXT_KEY, context);
}

/** Whether a `<DataTable.Root>` is present above the caller. */
export function hasDataTableContext(): boolean {
	return hasContext(DATA_TABLE_CONTEXT_KEY);
}

/**
 * Read the table published by `<DataTable.Root>`. Only `Toolbar`, `ViewOptions` and `Pagination`
 * call this, and only when their own `table` prop is omitted (plan.md Divergence 9).
 */
export function getDataTableContext<TData extends RowData>(): DataTableContext<TData> {
	if (!hasDataTableContext()) {
		throw new Error(
			'`<DataTable.Toolbar>` must be used within `<DataTable.Root>` or given a `table` prop.'
		);
	}
	return getContext<DataTableContext<TData>>(DATA_TABLE_CONTEXT_KEY);
}

/** One instance per `useDataTableInstance()` call. Resolves `table prop ?? context`. */
export class DataTableInstance<TData extends RowData> {
	#getTable!: () => Table<TData> | undefined;
	#context!: DataTableContext<TData> | undefined;

	readonly current: Table<TData> = $derived(this.#getTable() ?? this.#fallback());

	constructor(
		getTable: () => Table<TData> | undefined,
		context: DataTableContext<TData> | undefined
	) {
		this.#getTable = getTable;
		this.#context = context;
	}

	#fallback(): Table<TData> {
		if (this.#context) return this.#context.table;
		throw new Error(
			'`<DataTable.Toolbar>` must be used within `<DataTable.Root>` or given a `table` prop.'
		);
	}
}

/**
 * Resolve the table a part drives: its own `table` prop when given, otherwise the instance
 * `<DataTable.Root>` published (plan.md Divergence 9). Must be called during component
 * initialisation, and throws immediately when neither source is available.
 */
export function useDataTableInstance<TData extends RowData>(
	getTable: () => Table<TData> | undefined
): DataTableInstance<TData> {
	const context = getTable() === undefined ? getDataTableContext<TData>() : undefined;
	return new DataTableInstance(getTable, context);
}
