import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FlexRender from './data-table-flex-render.svelte';
import Skeleton from './data-table-skeleton.svelte';
import Toolbar from './data-table-toolbar.svelte';
import Harness, {
	HARNESS_ROWS,
	type DataTableHarnessProps,
	type DataTableHarnessRow
} from './data-table.test.svelte';
import {
	dataTableConfig,
	formatDate,
	fromDateValue,
	getColumnPinningStyle,
	getDefaultFilterOperator,
	getFilterOperators,
	getIsDateRange,
	getIsValidRange,
	getSliderRange,
	getValidFilters,
	parseAsDate,
	parseColumnFilterValue,
	parseValuesAsNumbers,
	toDateValue,
	type DataTableState,
	type ExtendedColumnFilter
} from './index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Body-style hygiene: `bits-ui`'s scroll lock leaves `pointer-events: none` on `<body>` while a
 * popover or menu is open and restores it a tick after `cleanup()`, which would make the next
 * test's clicks throw. The reset runs in `beforeEach` too, because Vitest unwinds `afterEach`
 * last-registered-first and `tests/setup.ts`'s `cleanup()` therefore re-leaks after this file's own
 * teardown — the same treatment `combobox` and `responsive-dialog` already apply.
 */
function resetBodyStyles(): void {
	document.body.style.pointerEvents = '';
	document.body.style.overflow = '';
}

beforeEach(resetBodyStyles);
afterEach(resetBodyStyles);

/**
 * A `user-event` session with the pointer-events assertion disabled, for the same reason: a
 * still-closing bits-ui layer blanks `pointer-events` on the body between two interactions in one
 * test, and jsdom never runs the animation that would clear it.
 */
function setupUser() {
	return userEvent.setup({ pointerEventsCheck: 0 });
}

/**
 * Query option for anything rendered inside a bits-ui floating layer.
 *
 * jsdom performs no layout, so floating-ui never resolves a popover's or menu's position and the
 * content keeps the `visibility: hidden` it is mounted with. The nodes are in the DOM and fully
 * interactive; they are simply outside the accessibility tree `getByRole` walks by default — the
 * same accommodation `phone-input`, `media-player` and `color-picker` already make.
 */
const inLayer = { hidden: true } as const;

/** Every element of `role` inside an open floating layer. */
function layerItems(role: string): HTMLElement[] {
	return screen.queryAllByRole(role, inLayer);
}

/**
 * One element of `role` inside an open layer, matched on its **text** rather than its accessible
 * name: `dom-accessibility-api` computes an empty name for a `visibility: hidden` subtree, so name
 * matching cannot be used for layer content in jsdom.
 */
function findLayerItem(role: string, text: string): HTMLElement | undefined {
	return layerItems(role).find((element) => (element.textContent ?? '').includes(text));
}

function layerItem(role: string, text: string): HTMLElement {
	const match = findLayerItem(role, text);
	if (!match) throw new Error(`No open-layer ${role} whose text contains "${text}".`);
	return match;
}

/** The open popover's content element. bits-ui gives it no `role`, so it is matched by slot. */
function popoverContent(): HTMLElement {
	const element = document.querySelector<HTMLElement>('[data-slot="popover-content"]');
	if (!element) throw new Error('No popover content is open.');
	return element;
}

/**
 * Let a freshly opened layer finish its open-auto-focus.
 *
 * bits-ui moves focus once, asynchronously, after a layer opens. Until that has happened any focus
 * a test sets inside the layer is taken back, so keyboard assertions have to wait it out.
 */
async function settleLayer(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 30));
}

/**
 * Open a filter popover and wait out its open-auto-focus.
 *
 * bits-ui moves focus into the content once, asynchronously. Until that has happened any focus a
 * spec sets inside the layer is taken straight back, so a fixed delay is a race: waiting for focus
 * to have actually landed inside the content is not.
 */
async function openFilterPopover(user: ReturnType<typeof setupUser>, title: string): Promise<void> {
	await user.click(filterTrigger(title));
	await waitFor(() => expect(popoverContent().contains(document.activeElement)).toBe(true));
}

type HarnessResult = {
	/** The `DataTableState` the harness created, so a spec can read and write its slices. */
	state: DataTableState<DataTableHarnessRow>;
};

function renderHarness(props: DataTableHarnessProps = {}): HarnessResult {
	let created: DataTableState<DataTableHarnessRow> | undefined;
	render(Harness, {
		props: {
			...props,
			onCreate: (state) => {
				created = state;
				props.onCreate?.(state);
			}
		}
	});
	if (!created) throw new Error('The harness did not create a DataTableState.');
	return { state: created };
}

/** Titles of the rows currently rendered, in order. */
function renderedTitles(): string[] {
	return screen.queryAllByTestId('title-cell').map((cell) => cell.textContent?.trim() ?? '');
}

function toolbar(): HTMLElement {
	return screen.getByRole('toolbar');
}

function pagination(): HTMLElement {
	const element = document.querySelector<HTMLElement>('[data-slot="data-table-pagination"]');
	if (!element) throw new Error('No pagination rendered.');
	return element;
}

/** The column header menu trigger inside the table (the toolbar has same-named controls). */
function headerTrigger(label: string): HTMLElement {
	return within(screen.getByRole('table')).getByRole('button', { name: label });
}

/** A toolbar filter trigger, matched on the title it starts with. */
function filterTrigger(title: string): HTMLElement {
	return within(toolbar()).getByRole('button', { name: new RegExp(`^${title}`) });
}

/** A pagination control. */
function pageButton(name: string): HTMLElement {
	return within(pagination()).getByRole('button', { name });
}

async function openHeaderMenu(user: ReturnType<typeof setupUser>, label: string): Promise<void> {
	await user.click(headerTrigger(label));
	expect(screen.getByRole('menu', inLayer)).toBeInTheDocument();
}

/** Open a column header menu and activate one of its items. */
async function chooseHeaderMenuItem(
	user: ReturnType<typeof setupUser>,
	label: string,
	item: string,
	role: 'menuitemcheckbox' | 'menuitem' = 'menuitemcheckbox'
): Promise<void> {
	await openHeaderMenu(user, label);
	await user.click(layerItem(role, item));
}

/** The lucide class suffix of the first icon inside an element, e.g. `chevrons-left`. */
function iconName(element: Element): string {
	const svg = element.querySelector('svg');
	const match = svg?.getAttribute('class')?.match(/lucide-([a-z-]+)$/);
	return match?.[1] ?? '';
}

// ---------------------------------------------------------------------------
// 1. Roles, names and ARIA
// ---------------------------------------------------------------------------

describe('DataTable — roles and ARIA', () => {
	it('renders the composed table roles', () => {
		renderHarness();

		const table = screen.getByRole('table');
		expect(within(table).getAllByRole('rowgroup')).toHaveLength(2);
		// One header row plus one row per fixture row.
		expect(within(table).getAllByRole('row')).toHaveLength(HARNESS_ROWS.length + 1);
		expect(within(table).getAllByRole('columnheader')).toHaveLength(11);
		expect(within(table).getAllByRole('cell')).toHaveLength(11 * HARNESS_ROWS.length);
	});

	it('marks the toolbar with a horizontal orientation', () => {
		renderHarness();

		expect(toolbar()).toHaveAttribute('aria-orientation', 'horizontal');
		expect(toolbar()).toHaveAttribute('data-slot', 'data-table-toolbar');
	});

	it('exposes the view options trigger as a labelled combobox', () => {
		renderHarness();

		const trigger = screen.getByRole('combobox', { name: 'Toggle columns' });
		expect(trigger).toHaveAttribute('data-slot', 'data-table-view-options');
	});

	it('labels all four pagination buttons', () => {
		renderHarness();

		for (const name of [
			'Go to first page',
			'Go to previous page',
			'Go to next page',
			'Go to last page'
		]) {
			expect(pageButton(name)).toBeInTheDocument();
		}
	});

	it('labels the clear affordance of every filter that has a value', async () => {
		const { state } = renderHarness();

		state.table.getColumn('status')?.setFilterValue(['todo']);
		state.table.getColumn('estimatedHours')?.setFilterValue([2, 10]);
		state.table.getColumn('createdAt')?.setFilterValue(HARNESS_ROWS[0].createdAt);
		await tick();

		expect(screen.getByRole('button', { name: 'Clear Status filter' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Clear Est. Hours filter' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Clear Created filter' })).toBeInTheDocument();
	});

	it('exposes Asc/Desc/Hide as menuitemcheckbox and Reset as a plain menuitem', async () => {
		const user = setupUser();
		renderHarness();

		await openHeaderMenu(user, 'Title');

		expect(layerItem('menuitemcheckbox', 'Asc')).toHaveAttribute('aria-checked', 'false');
		expect(layerItem('menuitemcheckbox', 'Desc')).toHaveAttribute('aria-checked', 'false');
		expect(layerItem('menuitemcheckbox', 'Hide')).toHaveAttribute('aria-checked', 'false');
		// Nothing is sorted yet, so there is nothing to reset (spec Edge Case 3).
		expect(findLayerItem('menuitem', 'Reset')).toBeUndefined();
	});

	it('tracks column.getIsSorted() in aria-checked and reveals Reset', async () => {
		const user = setupUser();
		const { state } = renderHarness();

		state.sorting = [{ id: 'title', desc: true }];
		await tick();
		await openHeaderMenu(user, 'Title');

		expect(layerItem('menuitemcheckbox', 'Desc')).toHaveAttribute('aria-checked', 'true');
		expect(layerItem('menuitemcheckbox', 'Asc')).toHaveAttribute('aria-checked', 'false');
		expect(layerItem('menuitem', 'Reset')).toBeInTheDocument();
	});

	it('labels the selection checkboxes and reports a mixed state', async () => {
		const user = setupUser();
		renderHarness();

		expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute(
			'aria-checked',
			'false'
		);

		await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]);
		expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute(
			'aria-checked',
			'mixed'
		);

		await user.click(screen.getByRole('checkbox', { name: 'Select all' }));
		expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute(
			'aria-checked',
			'true'
		);
	});

	it('spans the empty state across every column', async () => {
		const user = setupUser();
		renderHarness();

		await user.type(screen.getByPlaceholderText('Search titles...'), 'zzz');

		const cell = screen.getByRole('cell', { name: 'No results.' });
		expect(cell).toHaveAttribute('colspan', '11');
		expect(renderedTitles()).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// 2. Keyboard
// ---------------------------------------------------------------------------

describe('DataTable — keyboard', () => {
	it('opens the header menu with Enter and closes it with Escape, restoring focus', async () => {
		const user = setupUser();
		renderHarness();

		headerTrigger('Title').focus();
		await user.keyboard('{Enter}');
		expect(screen.getByRole('menu', inLayer)).toBeInTheDocument();

		await user.keyboard('{Escape}');
		await waitFor(() => expect(screen.queryByRole('menu', inLayer)).not.toBeInTheDocument());
		expect(headerTrigger('Title')).toHaveFocus();
	});

	it('opens the header menu with Space', async () => {
		const user = setupUser();
		renderHarness();

		headerTrigger('Title').focus();
		await user.keyboard('{ }');

		expect(screen.getByRole('menu', inLayer)).toBeInTheDocument();
	});

	it('moves between menu items with ArrowDown and ArrowUp', async () => {
		const user = setupUser();
		const { state } = renderHarness();

		state.sorting = [{ id: 'title', desc: false }];
		await tick();
		await openHeaderMenu(user, 'Title');
		await settleLayer();

		await user.keyboard('{ArrowDown}');
		expect(layerItem('menuitemcheckbox', 'Asc')).toHaveFocus();
		await user.keyboard('{ArrowDown}');
		expect(layerItem('menuitemcheckbox', 'Desc')).toHaveFocus();
		await user.keyboard('{ArrowDown}');
		expect(layerItem('menuitem', 'Reset')).toHaveFocus();
		await user.keyboard('{ArrowUp}');
		expect(layerItem('menuitemcheckbox', 'Desc')).toHaveFocus();
	});

	it('toggles a facet from the command list with ArrowDown and Enter', async () => {
		const user = setupUser();
		const { state } = renderHarness();

		await user.click(filterTrigger('Status'));
		await settleLayer();
		expect(layerItems('option')).toHaveLength(3);

		within(popoverContent()).getByPlaceholderText('Status').focus();
		await user.keyboard('{ArrowDown}{Enter}');

		expect(state.columnFilters).toHaveLength(1);
		expect(state.columnFilters[0].id).toBe('status');
	});

	it('moves the slider thumbs with ArrowRight, Home and End', async () => {
		const user = setupUser();
		const { state } = renderHarness();

		await openFilterPopover(user, 'Est. Hours');

		const thumbs = screen.getAllByRole('slider', inLayer);
		expect(thumbs).toHaveLength(2);

		thumbs[0].focus();
		// meta.range is [0, 24]; a 24-wide range gives a step of ceil(24 / 20) = 2.
		await user.keyboard('{ArrowRight}');
		expect(state.columnFilters).toEqual([{ id: 'estimatedHours', value: [2, 24] }]);

		await user.keyboard('{Home}');
		expect(state.columnFilters).toEqual([{ id: 'estimatedHours', value: [0, 24] }]);

		await user.keyboard('{End}');
		expect(state.columnFilters).toEqual([{ id: 'estimatedHours', value: [24, 24] }]);
	});

	it('pages with Enter on a pagination button', async () => {
		const user = setupUser();
		const { state } = renderHarness({
			initialState: { pagination: { pageIndex: 0, pageSize: 2 } }
		});

		pageButton('Go to next page').focus();
		await user.keyboard('{Enter}');

		expect(state.pagination.pageIndex).toBe(1);
		expect(pagination()).toHaveTextContent('Page 2 of 3');
	});

	it('reaches the sibling clear button with Tab and clears with Enter, without opening the popover', async () => {
		const user = setupUser();
		const { state } = renderHarness({ minimalColumns: true });

		state.table.getColumn('status')?.setFilterValue(['todo']);
		await tick();

		screen.getByPlaceholderText('Search titles...').focus();
		await user.tab();

		const clear = screen.getByRole('button', { name: 'Clear Status filter' });
		expect(clear).toHaveFocus();

		await user.keyboard('{Enter}');
		expect(state.columnFilters).toEqual([]);
		expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
	});

	it('places the view options trigger after the toolbar filters in tab order', async () => {
		const user = setupUser();
		renderHarness({ minimalColumns: true });

		screen.getByPlaceholderText('Search titles...').focus();
		await user.tab();
		expect(filterTrigger('Status')).toHaveFocus();
		await user.tab();
		expect(filterTrigger('Est. Hours')).toHaveFocus();
		await user.tab();
		expect(screen.getByRole('combobox', { name: 'Toggle columns' })).toHaveFocus();
		await user.tab();
		expect(headerTrigger('Title')).toHaveFocus();
	});

	it('orders the toolbar, the table and the pagination in that document order', () => {
		renderHarness();

		const table = screen.getByRole('table');
		expect(
			toolbar().compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		expect(
			table.compareDocumentPosition(pagination()) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// 3. Uncontrolled
// ---------------------------------------------------------------------------

describe('DataTable — uncontrolled', () => {
	it('seeds every slice from initialState', () => {
		const { state } = renderHarness({
			initialState: {
				sorting: [{ id: 'title', desc: false }],
				pagination: { pageIndex: 0, pageSize: 2 },
				columnVisibility: { notes: false },
				columnPinning: { left: ['select'], right: ['actions'] }
			}
		});

		expect(state.sorting).toEqual([{ id: 'title', desc: false }]);
		expect(state.pagination).toEqual({ pageIndex: 0, pageSize: 2 });
		expect(state.columnVisibility).toEqual({ notes: false });
		expect(state.columnPinning).toEqual({ left: ['select'], right: ['actions'] });
		expect(renderedTitles()).toEqual(['Alpha', 'Bravo']);
	});

	it('sorts from the header menu and resets from it', async () => {
		const user = setupUser();
		const { state } = renderHarness();

		expect(renderedTitles()).toEqual(['Charlie', 'Alpha', 'Echo', 'Bravo', 'Delta']);

		await chooseHeaderMenuItem(user, 'Title', 'Asc');
		expect(state.sorting).toEqual([{ id: 'title', desc: false }]);
		expect(renderedTitles()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);

		await chooseHeaderMenuItem(user, 'Title', 'Desc');
		expect(renderedTitles()).toEqual(['Echo', 'Delta', 'Charlie', 'Bravo', 'Alpha']);

		await chooseHeaderMenuItem(user, 'Title', 'Reset', 'menuitem');
		expect(state.sorting).toEqual([]);
		expect(renderedTitles()).toEqual(['Charlie', 'Alpha', 'Echo', 'Bravo', 'Delta']);
	});

	it('narrows the rows from the text filter and restores them from Reset filters', async () => {
		const user = setupUser();
		const { state } = renderHarness();

		expect(screen.queryByRole('button', { name: 'Reset filters' })).not.toBeInTheDocument();

		await user.type(screen.getByPlaceholderText('Search titles...'), 'a');
		expect(renderedTitles()).toEqual(['Charlie', 'Alpha', 'Bravo', 'Delta']);

		await user.click(screen.getByRole('button', { name: 'Reset filters' }));
		expect(state.columnFilters).toEqual([]);
		expect(renderedTitles()).toHaveLength(HARNESS_ROWS.length);
	});

	it('narrows the rows from a facet and marks the trigger selected', async () => {
		const user = setupUser();
		const { state } = renderHarness();

		await user.click(filterTrigger('Status'));
		await user.click(layerItem('option', 'Todo'));

		expect(state.columnFilters).toEqual([{ id: 'status', value: ['todo'] }]);
		expect(renderedTitles()).toEqual(['Charlie', 'Echo']);
		expect(filterTrigger('Status')).toHaveAttribute('data-selected', '');
		expect(filterTrigger('Status')).toHaveTextContent('Todo');
	});

	it('closes the popover and replaces the value in single-select mode', async () => {
		const user = setupUser();
		const { state } = renderHarness();

		await user.click(filterTrigger('Priority'));
		await user.click(layerItem('option', 'Low'));
		expect(state.columnFilters).toEqual([{ id: 'priority', value: ['low'] }]);
		await waitFor(() => expect(findLayerItem('option', 'Low')).toBeUndefined());

		await user.click(filterTrigger('Priority'));
		await user.click(layerItem('option', 'High'));
		expect(state.columnFilters).toEqual([{ id: 'priority', value: ['high'] }]);
	});

	it('hides a column from the header menu and restores it from the view options list', async () => {
		const user = setupUser();
		const { state } = renderHarness();

		await chooseHeaderMenuItem(user, 'Notes', 'Hide');
		expect(state.columnVisibility.notes).toBe(false);
		expect(within(screen.getByRole('table')).queryByRole('button', { name: 'Notes' })).toBeNull();

		await user.click(screen.getByRole('combobox', { name: 'Toggle columns' }));
		await user.click(layerItem('option', 'Notes'));
		expect(state.columnVisibility.notes).toBe(true);
	});

	it('pages, and clamps the page index when the page size grows', async () => {
		const user = setupUser();
		const { state } = renderHarness({
			initialState: { pagination: { pageIndex: 2, pageSize: 2 } }
		});

		expect(pagination()).toHaveTextContent('Page 3 of 3');
		expect(renderedTitles()).toEqual(['Delta']);

		await user.click(pageButton('Go to first page'));
		expect(state.pagination.pageIndex).toBe(0);

		state.table.setPageIndex(2);
		state.table.setPageSize(10);
		await tick();
		expect(state.pagination).toEqual({ pageIndex: 0, pageSize: 10 });
		expect(pagination()).toHaveTextContent('Page 1 of 1');
	});

	it('disables the paging buttons at each end', async () => {
		const user = setupUser();
		renderHarness({ initialState: { pagination: { pageIndex: 0, pageSize: 2 } } });

		expect(pageButton('Go to first page')).toBeDisabled();
		expect(pageButton('Go to previous page')).toBeDisabled();
		expect(pageButton('Go to next page')).toBeEnabled();

		await user.click(pageButton('Go to last page'));
		expect(pageButton('Go to next page')).toBeDisabled();
		expect(pageButton('Go to last page')).toBeDisabled();
		expect(pageButton('Go to previous page')).toBeEnabled();
	});

	it('changes the page size from the select', async () => {
		const user = setupUser();
		const { state } = renderHarness({
			initialState: { pagination: { pageIndex: 0, pageSize: 10 } }
		});

		await user.click(pageButton('Rows per page'));
		await user.click(layerItem('option', '20'));

		expect(state.pagination.pageSize).toBe(20);
	});

	it('reveals the action bar only while rows are selected', async () => {
		const user = setupUser();
		renderHarness();

		expect(screen.queryByTestId('action-bar')).not.toBeInTheDocument();

		await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]);
		expect(screen.getByTestId('action-bar')).toHaveTextContent('1 selected');
		expect(pagination()).toHaveTextContent('1 of 5 row(s) selected.');

		await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]);
		expect(screen.queryByTestId('action-bar')).not.toBeInTheDocument();
	});

	it('marks a selected row with data-state', async () => {
		const user = setupUser();
		renderHarness();

		await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]);

		const rows = within(screen.getByRole('table')).getAllByRole('row');
		expect(rows[1]).toHaveAttribute('data-state', 'selected');
		expect(rows[2]).not.toHaveAttribute('data-state');
	});
});

// ---------------------------------------------------------------------------
// 4. Controlled
// ---------------------------------------------------------------------------

describe('DataTable — controlled', () => {
	it('re-renders when a slice is written from outside', async () => {
		const { state } = renderHarness();

		state.sorting = [{ id: 'title', desc: false }];
		await tick();
		expect(renderedTitles()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);

		state.pagination = { pageIndex: 1, pageSize: 2 };
		await tick();
		expect(renderedTitles()).toEqual(['Charlie', 'Delta']);

		state.columnVisibility = { notes: false };
		await tick();
		expect(within(screen.getByRole('table')).queryByRole('button', { name: 'Notes' })).toBeNull();
	});

	it('makes the caller authoritative when `state` is passed, so the table never moves on its own', async () => {
		const user = setupUser();
		const onSortingChange = vi.fn();
		renderHarness({
			state: { sorting: [{ id: 'title', desc: true }] },
			onSortingChange
		});

		expect(renderedTitles()).toEqual(['Echo', 'Delta', 'Charlie', 'Bravo', 'Alpha']);

		await chooseHeaderMenuItem(user, 'Title', 'Asc');

		expect(onSortingChange).toHaveBeenCalledTimes(1);
		expect(onSortingChange).toHaveBeenCalledWith([{ id: 'title', desc: false }]);
		// The caller ignored the callback, so the rendered order is unchanged.
		expect(renderedTitles()).toEqual(['Echo', 'Delta', 'Charlie', 'Bravo', 'Alpha']);
	});

	it('calls every on*Change exactly once with the resolved next value', async () => {
		const user = setupUser();
		const onSortingChange = vi.fn();
		const onColumnFiltersChange = vi.fn();
		const onPaginationChange = vi.fn();
		const onRowSelectionChange = vi.fn();
		const onColumnVisibilityChange = vi.fn();

		const { state } = renderHarness({
			initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
			onSortingChange,
			onColumnFiltersChange,
			onPaginationChange,
			onRowSelectionChange,
			onColumnVisibilityChange
		});

		await chooseHeaderMenuItem(user, 'Title', 'Asc');
		expect(onSortingChange).toHaveBeenCalledTimes(1);
		expect(onSortingChange).toHaveBeenCalledWith([{ id: 'title', desc: false }]);

		// table-core's `autoResetPageIndex` queues a pagination reset after any sort or filter
		// change, so each step starts from a clean mock to assert *its own* single call.
		onPaginationChange.mockClear();
		await user.click(pageButton('Go to next page'));
		expect(onPaginationChange).toHaveBeenCalledTimes(1);
		expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 2 });

		await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]);
		expect(onRowSelectionChange).toHaveBeenCalledTimes(1);

		await chooseHeaderMenuItem(user, 'Notes', 'Hide');
		expect(onColumnVisibilityChange).toHaveBeenCalledTimes(1);
		expect(onColumnVisibilityChange).toHaveBeenCalledWith({ notes: false });

		state.table.getColumn('status')?.setFilterValue(['todo']);
		expect(onColumnFiltersChange).toHaveBeenCalledTimes(1);
		expect(onColumnFiltersChange).toHaveBeenCalledWith([{ id: 'status', value: ['todo'] }]);
	});

	it('does not re-fire a callback when the slice is assigned directly', async () => {
		const onSortingChange = vi.fn();
		const { state } = renderHarness({ onSortingChange });

		state.sorting = [{ id: 'title', desc: true }];
		await tick();

		expect(onSortingChange).not.toHaveBeenCalled();
		expect(renderedTitles()[0]).toBe('Echo');
	});

	it('keeps the derived read model in step with the slices', async () => {
		const user = setupUser();
		const { state } = renderHarness();

		expect(state.rows).toHaveLength(5);
		expect(state.pageCount).toBe(1);
		expect(state.isFiltered).toBe(false);
		expect(state.selectedRowCount).toBe(0);
		expect(state.headerGroups).toHaveLength(1);

		await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]);
		expect(state.selectedRowCount).toBe(1);

		state.table.getColumn('status')?.setFilterValue(['todo']);
		expect(state.isFiltered).toBe(true);
		expect(state.filteredRowCount).toBe(2);
	});

	it('keeps the table instance identity stable across state changes', async () => {
		const { state } = renderHarness();
		const instance = state.table;

		state.sorting = [{ id: 'title', desc: true }];
		await tick();
		state.pagination = { pageIndex: 0, pageSize: 2 };
		await tick();

		expect(state.table).toBe(instance);
	});
});

// ---------------------------------------------------------------------------
// 5. RTL
// ---------------------------------------------------------------------------

describe('DataTable — RTL', () => {
	it('mirrors the pagination chevrons under a bare dir attribute', () => {
		renderHarness({ dir: 'rtl', initialState: { pagination: { pageIndex: 1, pageSize: 2 } } });

		expect(pagination()).toHaveAttribute('data-dir', 'rtl');
		expect(iconName(pageButton('Go to first page'))).toBe('chevrons-right');
		expect(iconName(pageButton('Go to previous page'))).toBe('chevron-right');
		expect(iconName(pageButton('Go to next page'))).toBe('chevron-left');
		expect(iconName(pageButton('Go to last page'))).toBe('chevrons-left');
	});

	it('mirrors them under a DirectionProvider too', () => {
		renderHarness({ dir: 'rtl', withDirectionProvider: true });

		expect(pagination()).toHaveAttribute('data-dir', 'rtl');
		expect(iconName(pageButton('Go to last page'))).toBe('chevrons-left');
	});

	it('keeps the LTR chevrons when no direction is set', () => {
		renderHarness();

		expect(pagination()).toHaveAttribute('data-dir', 'ltr');
		expect(iconName(pageButton('Go to first page'))).toBe('chevrons-left');
	});

	it('leaves the labels, the DOM order and the disabled logic untouched under RTL', async () => {
		const user = setupUser();
		const { state } = renderHarness({
			dir: 'rtl',
			initialState: { pagination: { pageIndex: 0, pageSize: 2 } }
		});

		expect(pageButton('Go to previous page')).toBeDisabled();
		expect(pageButton('Go to next page')).toBeEnabled();

		await user.click(pageButton('Go to next page'));
		expect(state.pagination.pageIndex).toBe(1);
	});

	it('keeps every subcomponent operable under RTL', async () => {
		const user = setupUser();
		const { state } = renderHarness({ dir: 'rtl' });

		await chooseHeaderMenuItem(user, 'Title', 'Asc');
		expect(state.sorting).toEqual([{ id: 'title', desc: false }]);

		await user.click(filterTrigger('Status'));
		await user.click(layerItem('option', 'Done'));
		expect(state.columnFilters).toEqual([{ id: 'status', value: ['done'] }]);

		await user.click(screen.getByRole('combobox', { name: 'Toggle columns' }));
		expect(layerItem('option', 'Title')).toBeInTheDocument();
	});

	it('opens the date filter and commits a date under RTL', async () => {
		const user = setupUser();
		const { state } = renderHarness({ dir: 'rtl' });

		await user.click(filterTrigger('Created'));
		await settleLayer();

		const days = Array.from(
			popoverContent().querySelectorAll<HTMLElement>('[data-bits-day]:not([data-outside-month])')
		);
		expect(days.length).toBeGreaterThan(0);

		await user.click(days[0]);

		expect(state.columnFilters).toHaveLength(1);
		expect(state.columnFilters[0].id).toBe('createdAt');
		expect(typeof state.columnFilters[0].value).toBe('number');
		expect(filterTrigger('Created')).toHaveAttribute('data-selected', '');
	});

	it('inverts the slider filter arrow keys under RTL', async () => {
		const user = setupUser();
		const { state } = renderHarness({ dir: 'rtl' });

		await openFilterPopover(user, 'Est. Hours');

		expect(screen.getAllByRole('slider', inLayer)).toHaveLength(2);

		// Re-queried before each key: the value change re-renders the thumb list.
		const focusLowerThumb = () => screen.getAllByRole('slider', inLayer)[0].focus();

		// meta.range is [0, 24], so the step is ceil(24 / 20) = 2. Under RTL the horizontal pair
		// swaps meaning: ArrowLeft moves *up* the scale and ArrowRight moves back down — the mirror
		// image of the LTR case asserted in the keyboard suite.
		focusLowerThumb();
		await user.keyboard('{ArrowLeft}');
		expect(state.columnFilters).toEqual([{ id: 'estimatedHours', value: [2, 24] }]);

		focusLowerThumb();
		await user.keyboard('{ArrowRight}');
		expect(state.columnFilters).toEqual([{ id: 'estimatedHours', value: [0, 24] }]);
	});

	it('renders the skeleton placeholder counts under RTL', () => {
		// `render` takes no `container`, so the RTL ancestor is supplied as the base element the
		// container is appended to.
		const rtlRoot = document.createElement('div');
		rtlRoot.dir = 'rtl';
		document.body.appendChild(rtlRoot);

		try {
			const { container } = render(
				Skeleton,
				{ props: { columnCount: 3, rowCount: 2, filterCount: 2 } },
				{ baseElement: rtlRoot }
			);

			expect(container.closest('[dir="rtl"]')).toBe(rtlRoot);
			expect(within(rtlRoot).getAllByRole('columnheader')).toHaveLength(3);
			expect(within(rtlRoot).getAllByRole('cell')).toHaveLength(6);
			expect(within(rtlRoot).queryAllByRole('button')).toHaveLength(0);
		} finally {
			rtlRoot.remove();
		}
	});
});

// ---------------------------------------------------------------------------
// 6. Guard rails and edge cases
// ---------------------------------------------------------------------------

describe('DataTable — guard rails and edge cases', () => {
	it('suppresses the view options popover while disabled', async () => {
		const user = setupUser();
		renderHarness({
			withToolbar: false,
			withStandaloneViewOptions: true,
			viewOptionsDisabled: true
		});

		const trigger = screen.getByRole('combobox', { name: 'Toggle columns' });
		expect(trigger).toBeDisabled();

		await user.click(trigger);
		expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
	});

	it('reorders the columns from the view options list when reorderable', async () => {
		const user = setupUser();
		const onColumnOrderChange = vi.fn();
		const { state } = renderHarness({
			withToolbar: false,
			withStandaloneViewOptions: true,
			reorderable: true,
			onColumnOrderChange
		});

		const trigger = screen.getByRole('combobox', { name: 'Toggle columns' });
		expect(trigger).toHaveAttribute('data-reorderable', '');

		await user.click(trigger);
		// One drag handle per hideable accessor column.
		expect(screen.getAllByLabelText(/^Reorder /)).toHaveLength(9);

		state.table.setColumnOrder(['title', 'status', 'priority']);
		expect(onColumnOrderChange).toHaveBeenCalledWith(['title', 'status', 'priority']);
	});

	it('renders a non-sortable, non-hideable column as plain text and hides it from the view list', async () => {
		const user = setupUser();
		renderHarness();

		const actionsHeader = screen.getByText('Actions');
		expect(actionsHeader).toHaveAttribute('data-slot', 'data-table-column-header');
		expect(actionsHeader.tagName).toBe('DIV');

		await user.click(screen.getByRole('combobox', { name: 'Toggle columns' }));
		expect(layerItem('option', 'Title')).toBeInTheDocument();
		expect(findLayerItem('option', 'Actions')).toBeUndefined();
		expect(findLayerItem('option', 'Select')).toBeUndefined();
	});

	it('renders no control for a filterable column without a variant, and none for a boolean one', () => {
		const { state } = renderHarness();

		expect(within(toolbar()).queryByRole('button', { name: /^Notes/ })).not.toBeInTheDocument();
		expect(within(toolbar()).queryByRole('button', { name: /^Archived/ })).not.toBeInTheDocument();
		expect(state.table.getColumn('notes')?.getCanFilter()).toBe(true);
		expect(getFilterOperators('boolean')).toBe(dataTableConfig.booleanOperators);
	});

	it('renders the number filter with its unit suffix', () => {
		renderHarness();

		const input = screen.getByPlaceholderText('Score');
		expect(input).toHaveAttribute('type', 'number');
		expect(input.parentElement).toHaveTextContent('pts');
	});

	it('collapses three or more selected facet values into a single badge', async () => {
		const { state } = renderHarness();

		state.table.getColumn('status')?.setFilterValue(['todo', 'done']);
		await tick();
		expect(filterTrigger('Status')).toHaveTextContent('Todo');
		expect(filterTrigger('Status')).toHaveTextContent('Done');

		state.table.getColumn('status')?.setFilterValue(['todo', 'done', 'in-progress']);
		await tick();
		expect(filterTrigger('Status')).toHaveTextContent('3 selected');
		expect(filterTrigger('Status')).not.toHaveTextContent('Todo');
	});

	it('keeps row selection across a filter that hides the selected row', async () => {
		const user = setupUser();
		const { state } = renderHarness();

		// The first row is "Charlie", whose status is `todo`.
		await user.click(screen.getAllByRole('checkbox', { name: 'Select row' })[0]);
		expect(state.rowSelection).toEqual({ r1: true });

		state.table.getColumn('status')?.setFilterValue(['done']);
		await tick();
		expect(renderedTitles()).toEqual(['Alpha', 'Delta']);
		// The record still holds the off-view selection, while the summary reports the filtered view.
		expect(state.rowSelection).toEqual({ r1: true });
		expect(state.selectedRowCount).toBe(0);
	});

	it('ignores a slider entry that would invert the range', async () => {
		const user = setupUser();
		const { state } = renderHarness();

		await user.click(filterTrigger('Est. Hours'));
		await settleLayer();

		const from = screen.getByLabelText('From');
		expect(from).toHaveValue(0);

		// "06" is inside [0, 24] and lands on the step grid, so it commits.
		await user.type(from, '6');
		expect(state.columnFilters).toEqual([{ id: 'estimatedHours', value: [6, 24] }]);

		// "69" is beyond the current upper bound, so it is discarded rather than inverting the range.
		await user.type(from, '9');
		expect(state.columnFilters).toEqual([{ id: 'estimatedHours', value: [6, 24] }]);
	});

	it('clears the slider filter from the popover button', async () => {
		const user = setupUser();
		const { state } = renderHarness();

		state.table.getColumn('estimatedHours')?.setFilterValue([4, 12]);
		await tick();
		await user.click(filterTrigger('Est. Hours'));

		// `getByRole`'s name matching cannot be used here: an accessible name computed inside a
		// `visibility: hidden` subtree is empty, so the `aria-label` is queried directly.
		await user.click(within(popoverContent()).getByLabelText('Clear Est. Hours filter'));

		expect(state.columnFilters).toEqual([]);
	});

	it('formats the selected date range in the trigger and clears it', async () => {
		const user = setupUser();
		const { state } = renderHarness();

		state.table.getColumn('dueAt')?.setFilterValue([HARNESS_ROWS[0].dueAt, HARNESS_ROWS[2].dueAt]);
		await tick();

		const trigger = filterTrigger('Due');
		expect(trigger).toHaveTextContent('March 1, 2024 - May 1, 2024');
		expect(trigger).toHaveAttribute('data-multiple', '');
		expect(trigger).toHaveAttribute('data-selected', '');

		await user.click(screen.getByRole('button', { name: 'Clear Due filter' }));
		expect(state.columnFilters).toEqual([]);
	});

	it('formats a single selected date in the trigger', async () => {
		const { state } = renderHarness();

		state.table.getColumn('createdAt')?.setFilterValue(HARNESS_ROWS[0].createdAt);
		await tick();

		const trigger = filterTrigger('Created');
		expect(trigger).toHaveTextContent('January 15, 2024');
		expect(trigger).not.toHaveAttribute('data-multiple');
		expect(renderedTitles()).toEqual(['Charlie']);
	});

	it('exposes pinned columns through data-pinned and a sticky style', () => {
		renderHarness({
			initialState: { columnPinning: { left: ['select'], right: ['actions'] } }
		});

		const heads = within(screen.getByRole('table')).getAllByRole('columnheader');
		const first = heads[0];
		const last = heads[heads.length - 1];

		expect(first).toHaveAttribute('data-pinned', 'left');
		expect(first).toHaveAttribute('data-pinned-edge', '');
		expect(first.getAttribute('style')).toContain('position: sticky');
		expect(last).toHaveAttribute('data-pinned', 'right');
		expect(last).toHaveAttribute('data-pinned-edge', '');
		expect(last.getAttribute('style')).toContain('position: sticky');

		const middle = heads[1];
		expect(middle).not.toHaveAttribute('data-pinned');
		expect(middle.getAttribute('style')).toContain('position: relative');
	});

	it('throws the documented error when a part is used outside the root and without a table', () => {
		expect(() => render(Toolbar)).toThrow(/within/);
	});

	it('renders a purely presentational skeleton', () => {
		render(Skeleton, { props: { columnCount: 3, rowCount: 2, filterCount: 2 } });

		const root = document.querySelector('[data-slot="data-table-skeleton"]');
		expect(root).toHaveAttribute('data-loading', '');
		expect(screen.getAllByRole('columnheader')).toHaveLength(3);
		expect(screen.getAllByRole('cell')).toHaveLength(6);
		expect(screen.queryAllByRole('button')).toHaveLength(0);
	});

	it('sizes the skeleton cells and honours shrinkZero', () => {
		render(Skeleton, {
			props: { columnCount: 2, rowCount: 1, cellWidths: ['10rem'], shrinkZero: true }
		});

		const head = screen.getAllByRole('columnheader')[0];
		expect(head.getAttribute('style')).toContain('width: 10rem');
		expect(head.getAttribute('style')).toContain('min-width: 10rem');
	});
});

// ---------------------------------------------------------------------------
// 7. Rest-prop forwarding — contracts/public-api.md § Conventions
// ---------------------------------------------------------------------------

describe('DataTable — rest props', () => {
	it('forwards content props through the view options onto the popover content', async () => {
		const user = setupUser();
		// The probe passes `side="top"` as well, which only typechecks once the prop set is widened
		// over the popover content props — upstream's
		// `DataTableViewOptionsProps extends React.ComponentProps<typeof PopoverContent>`.
		renderHarness({ withToolbar: false, withRestProbes: true });

		await user.click(screen.getByRole('combobox', { name: 'Toggle columns' }));

		expect(popoverContent()).toHaveAttribute('data-testid', 'view-options-content');
	});

	it('spreads rest props onto the trigger of the faceted, date and slider filters', () => {
		renderHarness({ withToolbar: false, withRestProbes: true });

		expect(screen.getByTestId('faceted-rest')).toHaveAttribute(
			'data-slot',
			'data-table-faceted-filter'
		);
		expect(screen.getByTestId('date-rest')).toHaveAttribute('data-slot', 'data-table-date-filter');
		expect(screen.getByTestId('slider-rest')).toHaveAttribute(
			'data-slot',
			'data-table-slider-filter'
		);
	});

	it('spreads rest props onto the control the toolbar filter renders, inline or delegated', () => {
		renderHarness({ withToolbar: false, withRestProbes: true });

		expect(screen.getByTestId('text-rest')).toHaveAttribute('placeholder', 'Search titles...');
		expect(screen.getByTestId('delegated-rest')).toHaveAttribute(
			'data-slot',
			'data-table-faceted-filter'
		);
	});
});

// ---------------------------------------------------------------------------
// DataTableFlexRender — the translation of React's flexRender()
// ---------------------------------------------------------------------------

describe('DataTableFlexRender', () => {
	it('renders a string template', () => {
		render(FlexRender, { props: { template: 'Title', context: {} } });
		expect(document.body).toHaveTextContent('Title');
	});

	it('renders a numeric template', () => {
		render(FlexRender, { props: { template: 42, context: {} } });
		expect(document.body).toHaveTextContent('42');
	});

	it('falls back when the template is absent', () => {
		render(FlexRender, { props: { template: undefined, context: {}, fallback: 'fallback-id' } });
		expect(document.body).toHaveTextContent('fallback-id');
	});

	it('renders a snippet template, and falls back to the value when a column has none', () => {
		renderHarness();
		// The `title` column's cell is a snippet; `notes` has none and falls back to the raw value.
		expect(screen.getAllByTestId('title-cell')[0]).toHaveTextContent('Charlie');
		expect(screen.getByRole('table')).toHaveTextContent('first');
	});
});

// ---------------------------------------------------------------------------
// Pure helpers — data-table-utils.ts and data-table-config.ts
// ---------------------------------------------------------------------------

describe('data-table-utils', () => {
	it('computes the pinning style for both edges, with and without a border', () => {
		const { state } = renderHarness({
			initialState: { columnPinning: { left: ['select', 'title'], right: ['actions', 'notes'] } }
		});

		const select = state.table.getColumn('select');
		const title = state.table.getColumn('title');
		const actions = state.table.getColumn('actions');
		const status = state.table.getColumn('status');
		if (!select || !title || !actions || !status) throw new Error('missing fixture column');

		const selectStyle = getColumnPinningStyle({ column: select });
		expect(selectStyle).toContain('left: 0px');
		expect(selectStyle).toContain('position: sticky');
		expect(selectStyle).toContain('opacity: 0.97');
		expect(selectStyle).toContain('z-index: 1');
		expect(selectStyle).toContain('width: 32px');

		// Last left-pinned column with a border, and first right-pinned column with a border.
		expect(getColumnPinningStyle({ column: title, withBorder: true })).toContain(
			'box-shadow: -4px 0 4px -4px var(--border) inset'
		);
		expect(getColumnPinningStyle({ column: actions, withBorder: true })).toContain(
			'box-shadow: 4px 0 4px -4px var(--border) inset'
		);
		// Without `withBorder` neither edge draws a shadow.
		expect(getColumnPinningStyle({ column: title })).not.toContain('box-shadow');

		const unpinned = getColumnPinningStyle({ column: status });
		expect(unpinned).toContain('position: relative');
		expect(unpinned).toContain('opacity: 1');
		expect(unpinned).not.toContain('z-index');
	});

	it('maps every filter variant to its operator table', () => {
		expect(getFilterOperators('text')).toBe(dataTableConfig.textOperators);
		expect(getFilterOperators('number')).toBe(dataTableConfig.numericOperators);
		expect(getFilterOperators('range')).toBe(dataTableConfig.numericOperators);
		expect(getFilterOperators('date')).toBe(dataTableConfig.dateOperators);
		expect(getFilterOperators('dateRange')).toBe(dataTableConfig.dateOperators);
		expect(getFilterOperators('select')).toBe(dataTableConfig.selectOperators);
		expect(getFilterOperators('multiSelect')).toBe(dataTableConfig.multiSelectOperators);
		expect(getDefaultFilterOperator('text')).toBe('iLike');
		expect(getDefaultFilterOperator('multiSelect')).toBe('inArray');
	});

	it('keeps only the advanced filters that carry a value', () => {
		const filters: ExtendedColumnFilter<{ title: string }>[] = [
			{ id: 'title', value: '', variant: 'text', operator: 'iLike', filterId: 'a' },
			{ id: 'title', value: 'x', variant: 'text', operator: 'iLike', filterId: 'b' },
			{ id: 'title', value: [], variant: 'multiSelect', operator: 'inArray', filterId: 'c' },
			{ id: 'title', value: ['x'], variant: 'multiSelect', operator: 'inArray', filterId: 'd' },
			{ id: 'title', value: '', variant: 'text', operator: 'isEmpty', filterId: 'e' },
			{ id: 'title', value: '', variant: 'text', operator: 'isNotEmpty', filterId: 'f' }
		];

		expect(getValidFilters(filters).map((filter) => filter.filterId)).toEqual(['b', 'd', 'e', 'f']);
	});

	it('parses two-element numeric arrays and rejects everything else', () => {
		expect(parseValuesAsNumbers([1, 2])).toEqual([1, 2]);
		expect(parseValuesAsNumbers(['3', '4'])).toEqual([3, 4]);
		expect(parseValuesAsNumbers([1])).toBeUndefined();
		expect(parseValuesAsNumbers(['a', 'b'])).toBeUndefined();
		expect(parseValuesAsNumbers(undefined)).toBeUndefined();
		expect(getIsValidRange([1, 2])).toBe(true);
		expect(getIsValidRange(['1', 2])).toBe(false);
	});

	it('buckets the slider step by range size', () => {
		expect(getSliderRange([0, 10], undefined)).toEqual({ min: 0, max: 10, step: 1 });
		expect(getSliderRange([0, 20], undefined)).toEqual({ min: 0, max: 20, step: 1 });
		expect(getSliderRange([0, 100], undefined)).toEqual({ min: 0, max: 100, step: 5 });
		expect(getSliderRange([0, 500], undefined)).toEqual({ min: 0, max: 500, step: 10 });
		// No explicit range: the faceted min/max wins, then the [0, 100] default.
		expect(getSliderRange(undefined, [10, 30])).toEqual({ min: 10, max: 30, step: 1 });
		expect(getSliderRange(undefined, undefined)).toEqual({ min: 0, max: 100, step: 5 });
	});

	it('round-trips dates between epoch milliseconds and calendar values', () => {
		const timestamp = new Date(2024, 2, 1).getTime();

		expect(formatDate(timestamp)).toBe('March 1, 2024');
		expect(formatDate(undefined)).toBe('');
		expect(formatDate(Number.NaN)).toBe('');
		expect(parseAsDate(timestamp)?.getTime()).toBe(timestamp);
		expect(parseAsDate(String(timestamp))?.getTime()).toBe(timestamp);
		expect(parseAsDate(undefined)).toBeUndefined();

		const dateValue = toDateValue(timestamp);
		expect(dateValue?.toString()).toBe('2024-03-01');
		expect(fromDateValue(dateValue)).toBe(timestamp);
		expect(fromDateValue(undefined)).toBeUndefined();
		expect(toDateValue(undefined)).toBeUndefined();
	});

	it('normalises a column filter value into a timestamp list', () => {
		expect(parseColumnFilterValue(undefined)).toEqual([]);
		expect(parseColumnFilterValue(null)).toEqual([]);
		expect(parseColumnFilterValue(5)).toEqual([5]);
		expect(parseColumnFilterValue('5')).toEqual(['5']);
		expect(parseColumnFilterValue([1, '2', {}])).toEqual([1, '2', undefined]);
		expect(parseColumnFilterValue({})).toEqual([]);
	});

	it('distinguishes a calendar range from a list of dates', () => {
		expect(getIsDateRange({ start: undefined, end: undefined })).toBe(true);
		expect(getIsDateRange([])).toBe(false);
	});
});
