import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Row from './data-grid-row.svelte';
import Search from './data-grid-search.svelte';
import Harness, {
	HARNESS_ROWS,
	STATUS_OPTIONS,
	TAG_OPTIONS,
	type DataGridHarnessProps,
	type DataGridHarnessRow
} from './data-grid.test.svelte';
import {
	DataGridSearchState,
	DataGridSelectionState,
	DataGridVirtualizer,
	COLUMN_AUTO_FIT_PADDING,
	COLUMN_RESIZE_STEP,
	NON_NAVIGABLE_COLUMN_IDS,
	clampCellNumber,
	coercePastedValue,
	formatDateForDisplay,
	formatDateToString,
	formatFileSize,
	getCellKey,
	getColumnPinningStyle,
	getColumnVariant,
	getEmptyCellValue,
	getIsFileCellData,
	getIsInPopover,
	getIsSkippedPaste,
	getLineCount,
	getRowHeightValue,
	getScrollDirection,
	getUrlHref,
	matchSelectOption,
	parseCellKey,
	parseLocalDate,
	parseTsv,
	serializeCellsToTsv,
	type CellOpts,
	type DataGridState
} from './index.js';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('svelte-sonner', () => ({
	toast: {
		success: (...args: unknown[]) => toastSuccess(...args),
		error: (...args: unknown[]) => toastError(...args)
	}
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * bits-ui's scroll lock leaves `pointer-events: none` on `<body>` while a menu or dialog is open
 * and restores it a tick after `cleanup()`, which would make the next test's clicks throw.
 */
function resetBodyStyles(): void {
	document.body.style.pointerEvents = '';
	document.body.style.overflow = '';
}

let clipboardText = '';
const writeText = vi.fn(async (text: string) => {
	clipboardText = text;
});
const readText = vi.fn(async () => clipboardText);

/** jsdom implements no clipboard at all, so one is installed for the DOM-visible effects. */
function installClipboard(): void {
	Object.defineProperty(navigator, 'clipboard', {
		configurable: true,
		value: { writeText, readText }
	});
}

beforeEach(() => {
	resetBodyStyles();
	toastSuccess.mockClear();
	toastError.mockClear();
	writeText.mockClear();
	readText.mockClear();
	clipboardText = '';
	installClipboard();
});

afterEach(resetBodyStyles);

/**
 * `userEvent.setup()` installs a clipboard stub of its own, so the suite's stub is reinstalled
 * afterwards — otherwise a copy driven through the keyboard would land somewhere unobservable.
 */
function setupUser() {
	const user = userEvent.setup({ pointerEventsCheck: 0 });
	installClipboard();
	return user;
}

/** Query option for anything rendered inside a bits-ui floating layer (invisible under jsdom). */
const inLayer = { hidden: true } as const;

function layerItems(role: string): HTMLElement[] {
	return screen.queryAllByRole(role, inLayer);
}

function findLayerItem(role: string, text: string): HTMLElement | undefined {
	return layerItems(role).find((element) => (element.textContent ?? '').includes(text));
}

function layerItem(role: string, text: string): HTMLElement {
	const match = findLayerItem(role, text);
	if (!match) throw new Error(`No open-layer ${role} whose text contains "${text}".`);
	return match;
}

type HarnessResult = {
	grid: DataGridState<DataGridHarnessRow>;
};

function renderHarness(props: DataGridHarnessProps = {}): HarnessResult {
	let created: DataGridState<DataGridHarnessRow> | undefined;
	render(Harness, {
		props: {
			...props,
			onCreate: (grid) => {
				created = grid;
				props.onCreate?.(grid);
			}
		}
	});
	if (!created) throw new Error('The harness did not create a DataGridState.');
	return { grid: created };
}

function gridElement(): HTMLElement {
	return screen.getByRole('grid');
}

/** The cell wrapper for a position, matched on the `data-cell-key` the wrapper always emits. */
function cellWrapper(rowIndex: number, columnId: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`[data-cell-key="${rowIndex}:${columnId}"]`);
	if (!element) throw new Error(`No cell wrapper at ${rowIndex}:${columnId}.`);
	return element;
}

function queryCellWrapper(rowIndex: number, columnId: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-cell-key="${rowIndex}:${columnId}"]`);
}

/** Click a cell and wait for the focus/selection state it produces to settle. */
async function focusCell(
	user: ReturnType<typeof setupUser>,
	rowIndex: number,
	columnId: string
): Promise<void> {
	await user.click(cellWrapper(rowIndex, columnId));
	await tick();
}

/** The selected cell keys, sorted, so assertions do not depend on insertion order. */
function selectedKeys(grid: DataGridState<DataGridHarnessRow>): string[] {
	return [...grid.selection.selectedCells].sort();
}

function makeSelection(options?: {
	columnIds?: string[];
	rowCount?: number;
	single?: boolean;
	columnSelection?: boolean;
}) {
	const columnIds = options?.columnIds ?? ['a', 'b', 'c'];
	const rowCount = options?.rowCount ?? 4;
	return new DataGridSelectionState({
		getColumnIds: () => columnIds,
		getRowCount: () => rowCount,
		getEnableSingleCellSelection: () => options?.single ?? false,
		getEnableColumnSelection: () => options?.columnSelection ?? false
	});
}

function makeVirtualizer(options: {
	rowCount: number;
	rowHeight?: 'short' | 'medium' | 'tall' | 'extra-tall';
	overscan?: number;
}) {
	return new DataGridVirtualizer({
		getRowCount: () => options.rowCount,
		getRowHeight: () => options.rowHeight ?? 'short',
		getOverscan: () => options.overscan ?? 0,
		getScrollElement: () => null
	});
}

// ---------------------------------------------------------------------------
// 1. Pure utilities
// ---------------------------------------------------------------------------

describe('data-grid utils — cell keys', () => {
	it('round-trips a cell key', () => {
		expect(parseCellKey(getCellKey(7, 'name'))).toEqual({ rowIndex: 7, columnId: 'name' });
	});

	it('falls back for a malformed key', () => {
		expect(parseCellKey('nope')).toEqual({ rowIndex: 0, columnId: '' });
		expect(parseCellKey('x:name')).toEqual({ rowIndex: 0, columnId: '' });
	});

	it('exposes the non-navigable column ids', () => {
		expect([...NON_NAVIGABLE_COLUMN_IDS].sort()).toEqual(['actions', 'select']);
	});
});

describe('data-grid utils — parseTsv', () => {
	it('parses plain tab-separated rows', () => {
		expect(parseTsv('a\tb\nc\td', 2)).toEqual([
			['a', 'b'],
			['c', 'd']
		]);
	});

	it('honours quoted fields with embedded tabs and newlines', () => {
		const text = '"a\tb"\t"line1\nline2"\n"plain"\t"x""y"';
		expect(parseTsv(text, 2)).toEqual([
			['a\tb', 'line1\nline2'],
			['plain', 'x"y']
		]);
	});

	it('joins ragged lines until they reach the column count', () => {
		// Three columns: the second and third lines each carry one tab, so they are buffered and
		// joined into one row whose middle field holds the embedded newline.
		expect(parseTsv('p\tq\tr\na\tb\nc\td', 3)).toEqual([
			['p', 'q', 'r'],
			['a', 'b\nc', 'd']
		]);
	});

	it('drops a ragged line that never completes a row', () => {
		expect(parseTsv('a\tb\nc\nd\te', 2)).toEqual([
			['a', 'b'],
			['d', 'e']
		]);
	});

	it('uses the fallback column count when no tabs are present', () => {
		expect(parseTsv('one\ntwo', 1)).toEqual([['one'], ['two']]);
		expect(parseTsv('one\ntwo', 0)).toEqual([]);
	});
});

describe('data-grid utils — serializeCellsToTsv', () => {
	const values: Record<string, unknown> = {
		'0:name': 'Charlie',
		'0:amount': 30,
		'1:name': 'Alpha',
		'1:amount': 90,
		'0:tags': ['alpha']
	};

	const getCellValue = (rowIndex: number, columnId: string) => values[`${rowIndex}:${columnId}`];
	const getCellOpts = (columnId: string): CellOpts | undefined =>
		columnId === 'tags' ? { variant: 'multi-select', options: [] } : { variant: 'short-text' };

	it('serializes row-major and column-major in index order', () => {
		const result = serializeCellsToTsv({
			cellKeys: ['1:amount', '0:name', '1:name', '0:amount'],
			getCellValue,
			getCellOpts
		});

		expect(result?.tsv).toBe('30\tCharlie\n90\tAlpha');
	});

	it('JSON-encodes multi-select and file values', () => {
		const result = serializeCellsToTsv({ cellKeys: ['0:tags'], getCellValue, getCellOpts });
		expect(result?.tsv).toBe('["alpha"]');
	});

	it('drops non-navigable columns and returns null when nothing is left', () => {
		expect(
			serializeCellsToTsv({ cellKeys: ['0:select', '0:actions'], getCellValue, getCellOpts })
		).toBeNull();
	});
});

describe('data-grid utils — coercePastedValue', () => {
	function value(raw: string, opts: CellOpts | undefined): unknown {
		const result = coercePastedValue(raw, opts);
		if (getIsSkippedPaste(result)) throw new Error(`Expected "${raw}" not to be skipped.`);
		return result.value;
	}

	function skipped(raw: string, opts: CellOpts | undefined): boolean {
		return getIsSkippedPaste(coercePastedValue(raw, opts));
	}

	it('coerces numbers and skips non-numeric text', () => {
		expect(value('12.5', { variant: 'number' })).toBe(12.5);
		expect(value('', { variant: 'number' })).toBeNull();
		expect(skipped('abc', { variant: 'number' })).toBe(true);
	});

	it('coerces the documented booleans and skips anything else', () => {
		expect(value('yes', { variant: 'checkbox' })).toBe(true);
		expect(value('0', { variant: 'checkbox' })).toBe(false);
		expect(value('', { variant: 'checkbox' })).toBe(false);
		expect(skipped('maybe', { variant: 'checkbox' })).toBe(true);
	});

	it('coerces dates and skips unparseable ones', () => {
		expect(value('2024-03-01', { variant: 'date' })).toBeInstanceOf(Date);
		expect(value('', { variant: 'date' })).toBeNull();
		expect(skipped('not-a-date', { variant: 'date' })).toBe(true);
	});

	it('matches select options by value or label and skips unknown ones', () => {
		const opts: CellOpts = { variant: 'select', options: STATUS_OPTIONS };
		expect(value('Done', opts)).toBe('done');
		expect(value('', opts)).toBe('');
		expect(skipped('archived', opts)).toBe(true);
	});

	it('accepts a JSON array or a comma list for multi-select', () => {
		const opts: CellOpts = { variant: 'multi-select', options: TAG_OPTIONS };
		expect(value('["alpha","beta"]', opts)).toEqual(['alpha', 'beta']);
		expect(value('Alpha, Gamma', opts)).toEqual(['alpha', 'gamma']);
		expect(skipped('nope', opts)).toBe(true);
	});

	it('validates file payloads', () => {
		const opts: CellOpts = { variant: 'file' };
		expect(value('', opts)).toEqual([]);
		expect(value('[{"id":"a","name":"a.txt","size":1,"type":"text/plain"}]', opts)).toEqual([
			{ id: 'a', name: 'a.txt', size: 1, type: 'text/plain' }
		]);
		expect(skipped('[{"nope":1}]', opts)).toBe(true);
		expect(skipped('oops', opts)).toBe(true);
	});

	it('accepts urls and bare domains but skips structured payloads', () => {
		const opts: CellOpts = { variant: 'url' };
		expect(value('https://svelte.dev', opts)).toBe('https://svelte.dev');
		expect(value('example.com/path', opts)).toBe('example.com/path');
		expect(value('', opts)).toBe('');
		expect(skipped('[1]', opts)).toBe(true);
		expect(skipped('not a url', opts)).toBe(true);
	});

	it('humanises JSON payloads pasted into a text cell', () => {
		expect(value('["a","b"]', { variant: 'short-text' })).toBe('a, b');
		expect(value('true', { variant: 'short-text' })).toBe('Checked');
		expect(value('plain', undefined)).toBe('plain');
	});
});

describe('data-grid utils — values and formatting', () => {
	it('returns the documented empty value per variant', () => {
		expect(getEmptyCellValue('multi-select')).toEqual([]);
		expect(getEmptyCellValue('file')).toEqual([]);
		expect(getEmptyCellValue('number')).toBeNull();
		expect(getEmptyCellValue('date')).toBeNull();
		expect(getEmptyCellValue('checkbox')).toBe(false);
		expect(getEmptyCellValue('short-text')).toBe('');
		expect(getEmptyCellValue(undefined)).toBe('');
	});

	it('clamps a number into the bounds its column declared', () => {
		expect(clampCellNumber(5000, { min: 0, max: 1000 })).toBe(1000);
		expect(clampCellNumber(-20, { min: 0, max: 1000 })).toBe(0);
		expect(clampCellNumber(42, { min: 0, max: 1000 })).toBe(42);
		expect(clampCellNumber(5000, { min: 0 })).toBe(5000);
		expect(clampCellNumber(-20, { max: 1000 })).toBe(-20);
		expect(clampCellNumber(42, undefined)).toBe(42);
		expect(clampCellNumber(null, { min: 0, max: 1000 })).toBeNull();
		expect(clampCellNumber(Number.NaN, { min: 0 })).toBeNull();
	});

	it('rejects dangerous url protocols and prefixes bare domains', () => {
		expect(getUrlHref('javascript:alert(1)')).toBe('');
		expect(getUrlHref('data:text/html,x')).toBe('');
		expect(getUrlHref('vbscript:x')).toBe('');
		expect(getUrlHref('file:///etc/passwd')).toBe('');
		expect(getUrlHref('https://svelte.dev')).toBe('https://svelte.dev');
		expect(getUrlHref('example.com')).toBe('http://example.com');
		expect(getUrlHref('   ')).toBe('');
	});

	it('rejects a date the Date constructor would silently correct', () => {
		expect(parseLocalDate('2024-02-30')).toBeNull();
		expect(parseLocalDate('2024-03-01')?.getDate()).toBe(1);
		expect(parseLocalDate(null)).toBeNull();
		expect(parseLocalDate(42)).toBeNull();
	});

	it('round-trips a local date without timezone drift', () => {
		const date = parseLocalDate('2024-12-31');
		expect(date).not.toBeNull();
		expect(formatDateToString(date as Date)).toBe('2024-12-31');
	});

	it('echoes an unparseable date back verbatim', () => {
		expect(formatDateForDisplay('later')).toBe('later');
		expect(formatDateForDisplay(null)).toBe('');
	});

	it('maps row heights to pixels and line counts', () => {
		expect(getRowHeightValue('short')).toBe(36);
		expect(getRowHeightValue('medium')).toBe(56);
		expect(getRowHeightValue('tall')).toBe(76);
		expect(getRowHeightValue('extra-tall')).toBe(96);
		expect([
			getLineCount('short'),
			getLineCount('medium'),
			getLineCount('tall'),
			getLineCount('extra-tall')
		]).toEqual([1, 2, 3, 4]);
	});

	it('formats file sizes', () => {
		expect(formatFileSize(0)).toBe('0 B');
		expect(formatFileSize(2048)).toBe('2 KB');
		expect(formatFileSize(Number.NaN)).toBe('0 B');
	});

	it('guards file cell payloads', () => {
		expect(getIsFileCellData({ id: 'a', name: 'a', size: 1, type: 't' })).toBe(true);
		expect(getIsFileCellData({ id: 'a' })).toBe(false);
		expect(getIsFileCellData(null)).toBe(false);
	});

	it('matches select options exactly, then case-insensitively', () => {
		expect(matchSelectOption('done', STATUS_OPTIONS)).toBe('done');
		expect(matchSelectOption('DONE', STATUS_OPTIONS)).toBe('done');
		expect(matchSelectOption('In Progress', STATUS_OPTIONS)).toBe('in-progress');
		expect(matchSelectOption('nope', STATUS_OPTIONS)).toBeUndefined();
	});

	it('names each column variant', () => {
		expect(getColumnVariant('number')?.label).toBe('Number');
		expect(getColumnVariant('multi-select')?.label).toBe('Multi-select');
		expect(getColumnVariant(undefined)).toBeNull();
	});

	it('maps a navigation direction onto a horizontal scroll direction', () => {
		expect(getScrollDirection('pageleft')).toBe('left');
		expect(getScrollDirection('pageright')).toBe('right');
		expect(getScrollDirection('home')).toBe('home');
		expect(getScrollDirection('up')).toBeUndefined();
	});

	it('recognises cell editors and floating layers', () => {
		const editor = document.createElement('div');
		editor.setAttribute('data-grid-cell-editor', '');
		const inner = document.createElement('span');
		editor.append(inner);
		expect(getIsInPopover(inner)).toBe(true);
		expect(getIsInPopover(document.createElement('div'))).toBe(false);
		expect(getIsInPopover('nope')).toBe(false);
	});
});

describe('data-grid utils — getColumnPinningStyle', () => {
	it('sticks a left pin to the physical left under ltr', () => {
		const { grid } = renderHarness({
			minimalColumns: true,
			initialState: { columnPinning: { left: ['name'], right: [] } }
		});
		const column = grid.table.getColumn('name');
		expect(column).toBeDefined();

		const style = getColumnPinningStyle({ column: column!, dir: 'ltr', withBorder: true });
		expect(style).toContain('left: 0px');
		expect(style).toContain('position: sticky');
		expect(style).toContain('-4px 0 4px -4px var(--border) inset');
	});

	it('swaps which physical edge a pin sticks to under rtl', () => {
		const { grid } = renderHarness({
			minimalColumns: true,
			initialState: { columnPinning: { left: ['name'], right: [] } }
		});
		const column = grid.table.getColumn('name');
		const style = getColumnPinningStyle({ column: column!, dir: 'rtl', withBorder: true });

		expect(style).toContain('right: 0px');
		expect(style).not.toContain('left:');
		expect(style).toContain('4px 0 4px -4px var(--border) inset');
	});

	it('leaves an unpinned column relative', () => {
		const { grid } = renderHarness({ minimalColumns: true });
		const column = grid.table.getColumn('amount');
		const style = getColumnPinningStyle({ column: column! });

		expect(style).toContain('position: relative');
		expect(style).toContain('opacity: 1');
	});
});

// ---------------------------------------------------------------------------
// 2. DataGridSelectionState
// ---------------------------------------------------------------------------

describe('DataGridSelectionState', () => {
	it('normalises a rectangle whose corners are given in any order', () => {
		const selection = makeSelection();
		selection.selectRange({ rowIndex: 2, columnId: 'c' }, { rowIndex: 0, columnId: 'a' });

		expect([...selection.selectedCells].sort()).toEqual([
			'0:a',
			'0:b',
			'0:c',
			'1:a',
			'1:b',
			'1:c',
			'2:a',
			'2:b',
			'2:c'
		]);
		expect(selection.size).toBe(9);
		expect(selection.selectionRange).toEqual({
			start: { rowIndex: 2, columnId: 'c' },
			end: { rowIndex: 0, columnId: 'a' }
		});
	});

	it('toggles a single cell in and out and drops the rectangle', () => {
		const selection = makeSelection();
		selection.selectRange({ rowIndex: 0, columnId: 'a' }, { rowIndex: 1, columnId: 'b' });

		selection.toggleCell({ rowIndex: 3, columnId: 'c' });
		expect(selection.has(3, 'c')).toBe(true);
		expect(selection.selectionRange).toBeNull();

		selection.toggleCell({ rowIndex: 3, columnId: 'c' });
		expect(selection.has(3, 'c')).toBe(false);
	});

	it('selects every cell of every row', () => {
		const selection = makeSelection({ columnIds: ['a', 'b'], rowCount: 2 });
		selection.selectAll();

		expect([...selection.selectedCells].sort()).toEqual(['0:a', '0:b', '1:a', '1:b']);
		expect(selection.selectionRange).toEqual({
			start: { rowIndex: 0, columnId: 'a' },
			end: { rowIndex: 1, columnId: 'b' }
		});
	});

	it('no-ops select-all on an empty grid', () => {
		const selection = makeSelection({ rowCount: 0 });
		selection.selectAll();
		expect(selection.size).toBe(0);
	});

	it('selects a column only when column selection is enabled', () => {
		const off = makeSelection({ columnSelection: false });
		off.selectColumn('b');
		expect(off.size).toBe(0);

		const on = makeSelection({ columnIds: ['a', 'b'], rowCount: 2, columnSelection: true });
		on.selectColumn('b');
		expect([...on.selectedCells].sort()).toEqual(['0:b', '1:b']);
	});

	it('collapses every selection to one cell under enableSingleCellSelection', () => {
		const selection = makeSelection({ single: true });
		selection.selectRange({ rowIndex: 0, columnId: 'a' }, { rowIndex: 2, columnId: 'c' });
		expect([...selection.selectedCells]).toEqual(['2:c']);

		selection.toggleCell({ rowIndex: 1, columnId: 'b' });
		expect([...selection.selectedCells]).toEqual(['1:b']);
	});

	it('arms a drag without selecting the seed cell', () => {
		const selection = makeSelection();
		selection.beginDrag({ rowIndex: 1, columnId: 'b' });

		expect(selection.size).toBe(0);
		expect(selection.isSelecting).toBe(true);
		expect(selection.selectionRange?.start).toEqual({ rowIndex: 1, columnId: 'b' });
	});

	it('clears everything', () => {
		const selection = makeSelection();
		selection.selectAll();
		selection.clear();

		expect(selection.size).toBe(0);
		expect(selection.selectionRange).toBeNull();
		expect(selection.isSelecting).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// 3. DataGridVirtualizer
// ---------------------------------------------------------------------------

describe('DataGridVirtualizer', () => {
	it('windows against the scroll offset and viewport height', () => {
		const virtualizer = makeVirtualizer({ rowCount: 100 });
		virtualizer.viewportHeight = 360;
		virtualizer.scrollTop = 360;

		expect(virtualizer.startIndex).toBe(10);
		expect(virtualizer.endIndex).toBe(20);
		expect(virtualizer.virtualItems).toHaveLength(11);
		expect(virtualizer.virtualItems[0]).toEqual({ index: 10, start: 360, size: 36 });
		expect(virtualizer.totalSize).toBe(3600);
	});

	it('grows the window by the overscan on both sides', () => {
		const virtualizer = makeVirtualizer({ rowCount: 100, overscan: 3 });
		virtualizer.viewportHeight = 360;
		virtualizer.scrollTop = 360;

		expect(virtualizer.startIndex).toBe(7);
		expect(virtualizer.endIndex).toBe(23);
	});

	it('clamps at both ends', () => {
		const virtualizer = makeVirtualizer({ rowCount: 5, overscan: 4 });
		virtualizer.viewportHeight = 1000;
		virtualizer.scrollTop = 0;

		expect(virtualizer.startIndex).toBe(0);
		expect(virtualizer.endIndex).toBe(4);
	});

	it('reports an empty window for an empty grid', () => {
		const virtualizer = makeVirtualizer({ rowCount: 0 });
		expect(virtualizer.startIndex).toBe(0);
		expect(virtualizer.endIndex).toBe(-1);
		expect(virtualizer.virtualItems).toEqual([]);
		expect(virtualizer.totalSize).toBe(0);
	});

	it('sizes rows from each row-height preset', () => {
		for (const [preset, size] of [
			['short', 36],
			['medium', 56],
			['tall', 76],
			['extra-tall', 96]
		] as const) {
			const virtualizer = makeVirtualizer({ rowCount: 10, rowHeight: preset });
			expect(virtualizer.rowHeightValue).toBe(size);
			expect(virtualizer.totalSize).toBe(size * 10);
		}
	});

	it('aligns scrollToIndex to start, center and end', () => {
		const virtualizer = makeVirtualizer({ rowCount: 100 });
		virtualizer.viewportHeight = 360;

		virtualizer.scrollToIndex(50, { align: 'start' });
		expect(virtualizer.scrollTop).toBe(1800);

		virtualizer.scrollToIndex(50, { align: 'center' });
		expect(virtualizer.scrollTop).toBe(1800 - 180 + 18);

		virtualizer.scrollToIndex(50, { align: 'end' });
		expect(virtualizer.scrollTop).toBe(1800 - 360 + 36);
	});

	it('clamps scrollToIndex to the scrollable range and no-ops when empty', () => {
		const virtualizer = makeVirtualizer({ rowCount: 10 });
		virtualizer.viewportHeight = 360;
		virtualizer.scrollToIndex(9, { align: 'start' });
		expect(virtualizer.scrollTop).toBe(0);

		const empty = makeVirtualizer({ rowCount: 0 });
		empty.scrollToIndex(3);
		expect(empty.scrollTop).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// 4. DataGridSearchState
// ---------------------------------------------------------------------------

function makeSearch(values: Record<string, unknown>, columnIds: string[], rowCount: number) {
	const scrolled: number[] = [];
	const focused: string[] = [];
	const search = new DataGridSearchState({
		getRowCount: () => rowCount,
		getColumnIds: () => columnIds,
		getCellValue: (rowIndex, columnId) => values[`${rowIndex}:${columnId}`],
		scrollToIndex: (rowIndex) => scrolled.push(rowIndex),
		focusCell: (rowIndex, columnId) => focused.push(getCellKey(rowIndex, columnId)),
		restoreFocus: () => focused.push('container')
	});
	return { search, scrolled, focused };
}

describe('DataGridSearchState', () => {
	const values = {
		'0:name': 'Charlie',
		'1:name': 'Alpha',
		'2:name': 'Chase',
		'0:note': 'chalk',
		'1:note': 'beta',
		'2:note': 'gamma'
	};

	it('debounces setQuery into a search', async () => {
		vi.useFakeTimers();
		try {
			const { search } = makeSearch(values, ['name', 'note'], 3);
			search.setQuery('ch');

			expect(search.query).toBe('ch');
			expect(search.matches).toEqual([]);

			vi.advanceTimersByTime(149);
			expect(search.matches).toEqual([]);

			vi.advanceTimersByTime(1);
			expect(search.matches).toHaveLength(3);
		} finally {
			vi.useRealTimers();
		}
	});

	it('collects matches row-major and seeds the cursor', () => {
		const { search, scrolled } = makeSearch(values, ['name', 'note'], 3);
		search.search('ch');

		expect(search.matches).toEqual([
			{ rowIndex: 0, columnId: 'name' },
			{ rowIndex: 0, columnId: 'note' },
			{ rowIndex: 2, columnId: 'name' }
		]);
		expect(search.matchIndex).toBe(0);
		expect(scrolled).toEqual([0]);
		expect([...(search.matchesByRow?.get(0) ?? [])].sort()).toEqual(['name', 'note']);
	});

	it('wraps at both ends', () => {
		const { search } = makeSearch(values, ['name', 'note'], 3);
		search.search('ch');

		search.prev();
		expect(search.matchIndex).toBe(2);
		search.next();
		expect(search.matchIndex).toBe(0);
		search.next();
		expect(search.matchIndex).toBe(1);
	});

	it('answers isMatch and isActiveMatch', () => {
		const { search } = makeSearch(values, ['name', 'note'], 3);
		search.search('ch');

		expect(search.isMatch(0, 'name')).toBe(true);
		expect(search.isMatch(1, 'name')).toBe(false);
		expect(search.isActiveMatch(0, 'name')).toBe(true);
		expect(search.isActiveMatch(0, 'note')).toBe(false);
	});

	it('clears matches for a blank query', () => {
		const { search } = makeSearch(values, ['name'], 3);
		search.search('ch');
		search.search('   ');

		expect(search.matches).toEqual([]);
		expect(search.matchIndex).toBe(-1);
		expect(search.matchesByRow).toBeNull();
	});

	it('focuses the last active match when it closes', () => {
		const { search, focused } = makeSearch(values, ['name'], 3);
		search.setOpen(true);
		search.search('ch');
		search.next();
		search.setOpen(false);

		expect(search.open).toBe(false);
		expect(search.query).toBe('');
		expect(focused).toEqual(['2:name']);
	});

	it('restores container focus when it closes with no match', () => {
		const { search, focused } = makeSearch(values, ['name'], 3);
		search.setOpen(true);
		search.setOpen(false);
		expect(focused).toEqual(['container']);
	});
});

// ---------------------------------------------------------------------------
// 5. Clipboard
// ---------------------------------------------------------------------------

describe('DataGridClipboardState', () => {
	it('writes the focused cell to the clipboard and toasts', async () => {
		const { grid } = renderHarness({ minimalColumns: true });
		grid.focusedCell = { rowIndex: 0, columnId: 'name' };

		await grid.clipboard.copy();

		expect(writeText).toHaveBeenCalledWith('Charlie');
		expect(toastSuccess).toHaveBeenCalledWith('1 cell copied');
	});

	it('writes the whole selection row-major', async () => {
		const { grid } = renderHarness({ minimalColumns: true });
		grid.focusedCell = { rowIndex: 0, columnId: 'name' };
		grid.selection.selectRange(
			{ rowIndex: 0, columnId: 'name' },
			{ rowIndex: 1, columnId: 'amount' }
		);

		await grid.clipboard.copy();

		expect(writeText).toHaveBeenCalledWith('Charlie\t30\nAlpha\t90');
		expect(toastSuccess).toHaveBeenCalledWith('4 cells copied');
	});

	it('marks the source cells on cut and clears them once a paste lands', async () => {
		const { grid } = renderHarness({ minimalColumns: true, enablePaste: true });
		grid.focusedCell = { rowIndex: 0, columnId: 'name' };

		await grid.clipboard.cut();
		expect(grid.clipboard.isCut(0, 'name')).toBe(true);
		expect(toastSuccess).toHaveBeenCalledWith('1 cell cut');

		grid.focusedCell = { rowIndex: 2, columnId: 'name' };
		await grid.clipboard.paste();
		await tick();

		expect(grid.clipboard.cutCells.size).toBe(0);
		expect(grid.rows[2]?.original.name).toBe('Charlie');
		expect(grid.rows[0]?.original.name).toBe('');
	});

	it('refuses to cut while readOnly', async () => {
		const { grid } = renderHarness({ minimalColumns: true, readOnly: true });
		grid.focusedCell = { rowIndex: 0, columnId: 'name' };

		await grid.clipboard.cut();

		expect(writeText).not.toHaveBeenCalled();
		expect(grid.clipboard.cutCells.size).toBe(0);
	});

	it('raises the paste dialog when the paste overruns the grid', async () => {
		const onRowsAdd = vi.fn();
		const { grid } = renderHarness({ minimalColumns: true, enablePaste: true, onRowsAdd });
		clipboardText = 'a\nb\nc\nd';
		grid.focusedCell = { rowIndex: 1, columnId: 'name' };

		await grid.clipboard.paste();

		expect(grid.clipboard.pasteDialog).toEqual({
			open: true,
			rowsNeeded: 2,
			clipboardText: 'a\nb\nc\nd'
		});
		expect(onRowsAdd).not.toHaveBeenCalled();
	});

	it('pastes only what fits when the dialog is answered without expanding', async () => {
		const { grid } = renderHarness({ minimalColumns: true, enablePaste: true });
		clipboardText = 'x\ny\nz\nw';
		grid.focusedCell = { rowIndex: 1, columnId: 'name' };

		await grid.clipboard.paste();
		await grid.clipboard.paste(false);
		await tick();

		expect(grid.rows[1]?.original.name).toBe('x');
		expect(grid.rows[2]?.original.name).toBe('y');
		expect(grid.clipboard.pasteDialog.open).toBe(false);
		expect(toastSuccess).toHaveBeenCalledWith('2 cells pasted');
	});

	it('awaits onPaste before writing the data', async () => {
		const order: string[] = [];
		const { grid } = renderHarness({
			minimalColumns: true,
			enablePaste: true,
			onPaste: () => order.push('paste'),
			onDataChange: () => order.push('change')
		});
		clipboardText = 'zed';
		grid.focusedCell = { rowIndex: 0, columnId: 'name' };

		await grid.clipboard.paste();
		await tick();

		expect(order).toEqual(['paste', 'change']);
	});

	it('reports skipped cells', async () => {
		const { grid } = renderHarness({ minimalColumns: true, enablePaste: true });
		clipboardText = 'ok\tnot-a-number';
		grid.focusedCell = { rowIndex: 0, columnId: 'name' };

		await grid.clipboard.paste();
		await tick();

		expect(toastSuccess).toHaveBeenCalledWith('1 cell pasted, 1 skipped');
	});

	it('reports a paste in which everything was rejected', async () => {
		const { grid } = renderHarness({ minimalColumns: true, enablePaste: true });
		clipboardText = 'nope';
		grid.focusedCell = { rowIndex: 0, columnId: 'amount' };

		await grid.clipboard.paste();
		await tick();

		expect(toastError).toHaveBeenCalledWith('1 cell skipped pasting for invalid data');
	});

	it('refuses to paste while readOnly', async () => {
		const onDataChange = vi.fn();
		const { grid } = renderHarness({
			minimalColumns: true,
			enablePaste: true,
			readOnly: true,
			onDataChange
		});
		clipboardText = 'zed';
		grid.focusedCell = { rowIndex: 0, columnId: 'name' };

		await grid.clipboard.paste();

		expect(onDataChange).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// 6. Roles and ARIA
// ---------------------------------------------------------------------------

describe('DataGrid — roles and ARIA', () => {
	it('exposes the grid pattern', () => {
		renderHarness({ minimalColumns: true });

		const grid = gridElement();
		expect(grid).toHaveAccessibleName('Data grid');
		expect(grid).toHaveAttribute('aria-rowcount', '3');
		expect(grid).toHaveAttribute('aria-colcount', '3');
		expect(grid).toHaveAttribute('tabindex', '0');
	});

	it('counts the add-row affordance in aria-rowcount', () => {
		renderHarness({ minimalColumns: true, onRowAdd: () => ({ rowIndex: 3 }) });
		expect(gridElement()).toHaveAttribute('aria-rowcount', '4');
	});

	it('renders the header, body and footer rowgroups', () => {
		renderHarness({ minimalColumns: true, onRowAdd: () => null });
		expect(screen.getAllByRole('rowgroup')).toHaveLength(3);
	});

	it('numbers body rows from aria-rowindex 2 and marks selection', () => {
		renderHarness({ minimalColumns: true });

		const rows = document.querySelectorAll('[data-slot="data-grid-row"]');
		expect(rows).toHaveLength(3);
		expect(rows[0]).toHaveAttribute('aria-rowindex', '2');
		expect(rows[2]).toHaveAttribute('aria-rowindex', '4');
		expect(rows[0]).toHaveAttribute('aria-selected', 'false');
	});

	it('numbers the footer row after the last body row', () => {
		renderHarness({ minimalColumns: true, onRowAdd: () => null });
		const footerRow = document.querySelector('[data-slot="data-grid-add-row"]');
		expect(footerRow).toHaveAttribute('aria-rowindex', '5');
	});

	it('marks column headers with aria-colindex and aria-sort', () => {
		renderHarness({
			minimalColumns: true,
			initialState: { sorting: [{ id: 'name', desc: true }] }
		});

		const headers = screen.getAllByRole('columnheader');
		expect(headers[0]).toHaveAttribute('aria-colindex', '1');
		expect(headers[0]).toHaveAttribute('aria-sort', 'descending');
		expect(headers[1]).toHaveAttribute('aria-sort', 'none');
	});

	it('marks cells with aria-colindex', () => {
		renderHarness({ minimalColumns: true });
		const cells = screen.getAllByRole('gridcell');
		expect(cells[0]).toHaveAttribute('aria-colindex', '1');
		expect(cells[1]).toHaveAttribute('aria-colindex', '2');
	});

	it('exposes each resizer as a separator with its value range', () => {
		renderHarness({ minimalColumns: true });
		const separator = screen.getAllByRole('separator')[0];

		expect(separator).toHaveAccessibleName('Resize Name column');
		expect(separator).toHaveAttribute('aria-orientation', 'vertical');
		expect(separator).toHaveAttribute('aria-valuenow', '150');
		expect(separator).toHaveAttribute('aria-valuemin', '60');
		expect(separator).toHaveAttribute('aria-valuemax', '800');
	});

	it('names the add-row cell', () => {
		renderHarness({ minimalColumns: true, onRowAdd: () => null });
		expect(screen.getByRole('gridcell', { name: 'Add row' })).toBeInTheDocument();
	});

	it('exposes the search box and its controls', async () => {
		const user = setupUser();
		renderHarness({ minimalColumns: true, enableSearch: true });

		gridElement().focus();
		await user.keyboard('{Control>}f{/Control}');

		expect(screen.getByRole('search')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Previous match' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Next match' })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Close search' })).toBeInTheDocument();
		expect(screen.getByLabelText('Find in table')).toBeInTheDocument();
	});

	it('keeps exactly one cell wrapper in the tab order and moves it with focus', async () => {
		const user = setupUser();
		renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'name');

		const focusable = [...document.querySelectorAll('[data-cell-key]')].filter(
			(element) => element.getAttribute('tabindex') === '0'
		);
		expect(focusable).toHaveLength(1);
		expect(focusable[0]).toBe(cellWrapper(0, 'name'));

		await user.keyboard('{ArrowDown}');
		await tick();
		expect(cellWrapper(1, 'name')).toHaveAttribute('tabindex', '0');
		expect(cellWrapper(0, 'name')).toHaveAttribute('tabindex', '-1');
	});
});

// ---------------------------------------------------------------------------
// 7. Keyboard
// ---------------------------------------------------------------------------

describe('DataGrid — keyboard navigation', () => {
	it('moves with the arrow keys, clamped at both edges', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'name');
		await user.keyboard('{ArrowUp}');
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'name' });

		await user.keyboard('{ArrowLeft}');
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'name' });

		await user.keyboard('{ArrowRight}{ArrowDown}');
		expect(grid.focusedCell).toEqual({ rowIndex: 1, columnId: 'amount' });
	});

	it('moves to the first and last navigable column with Home and End', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 1, 'amount');
		await user.keyboard('{End}');
		expect(grid.focusedCell).toEqual({ rowIndex: 1, columnId: 'active' });

		await user.keyboard('{Home}');
		expect(grid.focusedCell).toEqual({ rowIndex: 1, columnId: 'name' });
	});

	it('jumps to the first and last cell with Mod+Home and Mod+End', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 1, 'amount');
		await user.keyboard('{Control>}{End}{/Control}');
		expect(grid.focusedCell).toEqual({ rowIndex: 2, columnId: 'active' });

		await user.keyboard('{Control>}{Home}{/Control}');
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'name' });
	});

	it('jumps within a column with Mod+Arrow and within a row with Mod+Arrow', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'amount');
		await user.keyboard('{Control>}{ArrowDown}{/Control}');
		expect(grid.focusedCell).toEqual({ rowIndex: 2, columnId: 'amount' });

		await user.keyboard('{Control>}{ArrowUp}{/Control}');
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'amount' });

		await user.keyboard('{Control>}{ArrowRight}{/Control}');
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'active' });

		await user.keyboard('{Control>}{ArrowLeft}{/Control}');
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'name' });
	});

	it('pages vertically with PageUp/PageDown and Alt+Arrow', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'name');
		await user.keyboard('{PageDown}');
		expect(grid.focusedCell).toEqual({ rowIndex: 2, columnId: 'name' });

		await user.keyboard('{PageUp}');
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'name' });

		await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
		expect(grid.focusedCell).toEqual({ rowIndex: 2, columnId: 'name' });

		await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'name' });
	});

	it('pages horizontally with Alt+PageUp/PageDown', async () => {
		const user = setupUser();
		const { grid } = renderHarness();

		await focusCell(user, 0, 'name');
		await user.keyboard('{Alt>}{PageDown}{/Alt}');
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'status' });

		await user.keyboard('{Alt>}{PageUp}{/Alt}');
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'name' });
	});

	it('moves with Tab and Shift+Tab', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'name');
		await user.keyboard('{Tab}');
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'amount' });

		await user.keyboard('{Shift>}{Tab}{/Shift}');
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'name' });
	});
});

describe('DataGrid — keyboard selection', () => {
	it('extends the rectangle with Shift+Arrow', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'name');
		await user.keyboard('{Shift>}{ArrowDown}{ArrowRight}{/Shift}');

		expect(selectedKeys(grid)).toEqual(['0:amount', '0:name', '1:amount', '1:name']);
	});

	it('extends to the row extremities with Mod+Shift+Arrow', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 1, 'name');
		await user.keyboard('{Control>}{Shift>}{ArrowUp}{/Shift}{/Control}');
		expect(selectedKeys(grid)).toEqual(['0:name', '1:name']);

		await user.keyboard('{Control>}{Shift>}{ArrowDown}{/Shift}{/Control}');
		expect(selectedKeys(grid)).toEqual(['1:name', '2:name']);
	});

	it('extends to the column extremities with Mod+Shift+Arrow', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'amount');
		await user.keyboard('{Control>}{Shift>}{ArrowRight}{/Shift}{/Control}');
		expect(selectedKeys(grid)).toEqual(['0:active', '0:amount']);

		await user.keyboard('{Control>}{Shift>}{ArrowLeft}{/Shift}{/Control}');
		expect(selectedKeys(grid)).toEqual(['0:amount', '0:name']);
	});

	it('selects everything with Mod+A', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'name');
		await user.keyboard('{Control>}a{/Control}');

		expect(grid.selection.size).toBe(9);
	});

	it('clears the selection with Escape, then blurs the cell', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'name');
		await user.keyboard('{Control>}a{/Control}');
		await user.keyboard('{Escape}');
		expect(grid.selection.size).toBe(0);
		expect(grid.focusedCell).not.toBeNull();

		await user.keyboard('{Escape}');
		expect(grid.focusedCell).toBeNull();
	});

	it('toggles one cell with Mod+click and extends from focus with Shift+click', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'name');
		await user.keyboard('{Control>}');
		await user.click(cellWrapper(2, 'amount'));
		await user.keyboard('{/Control}');
		expect(grid.selection.has(2, 'amount')).toBe(true);

		grid.selection.clear();
		grid.focusedCell = { rowIndex: 0, columnId: 'name' };
		await user.keyboard('{Shift>}');
		await user.click(cellWrapper(1, 'amount'));
		await user.keyboard('{/Shift}');

		expect(selectedKeys(grid)).toEqual(['0:amount', '0:name', '1:amount', '1:name']);
	});

	it('leaves Shift+Tab as navigation, never selection', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'amount');
		await user.keyboard('{Shift>}{Tab}{/Shift}');

		expect(grid.selection.size).toBe(0);
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'name' });
	});
});

describe('DataGrid — keyboard editing and clipboard', () => {
	it('starts editing on Enter, F2, Space and a printable character', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'name');
		await user.keyboard('{Enter}');
		expect(grid.editingCell).toEqual({ rowIndex: 0, columnId: 'name' });

		await user.keyboard('{Escape}');
		await tick();
		await user.keyboard('{F2}');
		expect(grid.editingCell).toEqual({ rowIndex: 0, columnId: 'name' });

		await user.keyboard('{Escape}');
		await tick();
		await user.keyboard('x');
		expect(grid.editingCell).toEqual({ rowIndex: 0, columnId: 'name' });
	});

	it('commits on Enter and moves one row down', async () => {
		const user = setupUser();
		const onDataChange = vi.fn();
		const { grid } = renderHarness({ minimalColumns: true, onDataChange });

		await focusCell(user, 0, 'name');
		await user.keyboard('{Enter}');
		await tick();
		await user.keyboard('Zed{Enter}');
		await tick();

		expect(onDataChange).toHaveBeenCalled();
		expect(grid.rows[0]?.original.name).toBe('CharlieZed');
		expect(grid.focusedCell).toEqual({ rowIndex: 1, columnId: 'name' });
		expect(grid.editingCell).toBeNull();
	});

	it('discards on Escape', async () => {
		const user = setupUser();
		const onDataChange = vi.fn();
		const { grid } = renderHarness({ minimalColumns: true, onDataChange });

		await focusCell(user, 0, 'name');
		await user.keyboard('{Enter}');
		await tick();
		await user.keyboard('Zed{Escape}');
		await tick();

		expect(onDataChange).not.toHaveBeenCalled();
		expect(grid.rows[0]?.original.name).toBe('Charlie');
		expect(grid.editingCell).toBeNull();
	});

	it('clears the focused cell with Delete and the selection with Backspace', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'name');
		await user.keyboard('{Delete}');
		await tick();
		expect(grid.rows[0]?.original.name).toBe('');

		grid.selection.selectRange(
			{ rowIndex: 1, columnId: 'name' },
			{ rowIndex: 1, columnId: 'amount' }
		);
		await user.keyboard('{Backspace}');
		await tick();

		expect(grid.rows[1]?.original.name).toBe('');
		expect(grid.rows[1]?.original.amount).toBeNull();
		expect(grid.selection.size).toBe(0);
	});

	it('copies with Mod+C and cuts with Mod+X', async () => {
		const user = setupUser();
		renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'name');
		await user.keyboard('{Control>}c{/Control}');
		await waitFor(() => expect(writeText).toHaveBeenCalledWith('Charlie'));

		await user.keyboard('{Control>}x{/Control}');
		await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('1 cell cut'));
	});

	it('ignores Mod+V when enablePaste is not set', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });
		clipboardText = 'Zed';

		await focusCell(user, 0, 'name');
		await user.keyboard('{Control>}v{/Control}');
		await tick();

		expect(readText).not.toHaveBeenCalled();
		expect(grid.rows[0]?.original.name).toBe('Charlie');
	});

	it('pastes with Mod+V when enablePaste is set', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true, enablePaste: true });
		clipboardText = 'Zed';

		await focusCell(user, 0, 'name');
		await user.keyboard('{Control>}v{/Control}');

		await waitFor(() => expect(grid.rows[0]?.original.name).toBe('Zed'));
	});
});

// ---------------------------------------------------------------------------
// 8. Uncontrolled
// ---------------------------------------------------------------------------

describe('DataGrid — uncontrolled', () => {
	it('seeds sorting from initialState', () => {
		const { grid } = renderHarness({
			minimalColumns: true,
			initialState: { sorting: [{ id: 'name', desc: false }] }
		});

		expect(grid.sorting).toEqual([{ id: 'name', desc: false }]);
		expect(grid.rows.map((row) => row.original.name)).toEqual(['Alpha', 'Charlie', 'Echo']);
	});

	it('seeds column pinning from initialState', () => {
		const { grid } = renderHarness({
			minimalColumns: true,
			initialState: { columnPinning: { left: ['name'], right: [] } }
		});

		expect(grid.table.getColumn('name')?.getIsPinned()).toBe('left');
	});

	it('moves its own state when a cell is edited', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 1, 'active');
		await user.keyboard(' ');
		await tick();

		expect(grid.rows[1]?.original.active).toBe(false);
	});

	it('seeds the shortcuts dialog from defaultOpen', () => {
		renderHarness({ minimalColumns: true, withShortcuts: true, shortcutsDefaultOpen: true });
		expect(screen.getByRole('dialog', inLayer)).toBeInTheDocument();
	});

	it('focuses the first navigable cell when autoFocus is true', async () => {
		const { grid } = renderHarness({ minimalColumns: true, autoFocus: true });
		await tick();
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'name' });
	});

	it('focuses the named cell when autoFocus is an object', async () => {
		const { grid } = renderHarness({
			minimalColumns: true,
			autoFocus: { rowIndex: 1, columnId: 'amount' }
		});
		await tick();
		expect(grid.focusedCell).toEqual({ rowIndex: 1, columnId: 'amount' });
	});

	it('does not focus anything when autoFocus is false or the grid is empty', async () => {
		const off = renderHarness({ minimalColumns: true, autoFocus: false });
		await tick();
		expect(off.grid.focusedCell).toBeNull();

		const empty = renderHarness({ minimalColumns: true, rows: [], autoFocus: true });
		await tick();
		expect(empty.grid.focusedCell).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// 9. Controlled
// ---------------------------------------------------------------------------

describe('DataGrid — controlled', () => {
	it('lets the parent own the table state', () => {
		const { grid } = renderHarness({
			minimalColumns: true,
			state: { sorting: [{ id: 'name', desc: true }] }
		});

		expect(grid.rows.map((row) => row.original.name)).toEqual(['Echo', 'Charlie', 'Alpha']);

		grid.sorting = [];
		expect(grid.rows.map((row) => row.original.name)).toEqual(['Echo', 'Charlie', 'Alpha']);
	});

	it('reports the resolved sorting, never an updater', async () => {
		const onSortingChange = vi.fn();
		const { grid } = renderHarness({ minimalColumns: true, onSortingChange });

		grid.table.setSorting([{ id: 'name', desc: true }]);
		await tick();

		expect(onSortingChange).toHaveBeenCalledWith([{ id: 'name', desc: true }]);
	});

	it('fires onDataChange with the full next array and never mutates the input', async () => {
		const user = setupUser();
		const onDataChange = vi.fn();
		const rows = HARNESS_ROWS.map((row) => ({ ...row }));
		const snapshot = JSON.stringify(rows);

		renderHarness({ minimalColumns: true, rows, onDataChange, applyDataChange: false });

		await focusCell(user, 0, 'name');
		await user.keyboard('{Delete}');
		await tick();

		expect(onDataChange).toHaveBeenCalledTimes(1);
		const next = onDataChange.mock.calls[0]?.[0] as DataGridHarnessRow[];
		expect(next).toHaveLength(3);
		expect(next[0]?.name).toBe('');
		expect(next[1]).toBe(rows[1]);
		expect(JSON.stringify(rows)).toBe(snapshot);
	});

	it('emits exactly one onDataChange for a batch of updates', async () => {
		const user = setupUser();
		const onDataChange = vi.fn();
		const { grid } = renderHarness({ minimalColumns: true, onDataChange });

		await focusCell(user, 0, 'name');
		grid.selection.selectRange(
			{ rowIndex: 0, columnId: 'name' },
			{ rowIndex: 2, columnId: 'amount' }
		);
		await user.keyboard('{Delete}');
		await tick();

		expect(onDataChange).toHaveBeenCalledTimes(1);
	});

	it('honours bind:open on the shortcuts dialog', async () => {
		const onShortcutsOpenChange = vi.fn();
		renderHarness({
			minimalColumns: true,
			withShortcuts: true,
			shortcutsOpen: true,
			onShortcutsOpenChange
		});

		expect(screen.getByRole('dialog', inLayer)).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// 10. RTL
// ---------------------------------------------------------------------------

describe('DataGrid — RTL', () => {
	it('inverts the horizontal arrows', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true, dir: 'rtl' });

		await focusCell(user, 0, 'amount');
		await user.keyboard('{ArrowLeft}');
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'active' });

		await user.keyboard('{ArrowRight}');
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'amount' });
	});

	it('keeps Tab advancing the logical column while inverting it visually', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true, dir: 'rtl' });

		// Tab maps to `left` under RTL and `left` then steps the column index *up*, so the logical
		// order is unchanged while the visual movement flips with the row's writing direction —
		// the same double inversion upstream performs.
		await focusCell(user, 0, 'amount');
		await user.keyboard('{Tab}');
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'active' });

		await user.keyboard('{Shift>}{Tab}{/Shift}');
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'amount' });
	});

	it('selects to the last column with Mod+Shift+ArrowLeft', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true, dir: 'rtl' });

		await focusCell(user, 0, 'name');
		await user.keyboard('{Control>}{Shift>}{ArrowLeft}{/Shift}{/Control}');

		expect(selectedKeys(grid)).toEqual(['0:active', '0:amount', '0:name']);
	});

	it('falls back to the document direction when no dir is given', async () => {
		const user = setupUser();
		document.documentElement.dir = 'rtl';
		try {
			const { grid } = renderHarness({ minimalColumns: true });
			await tick();

			expect(grid.dir).toBe('rtl');
			await focusCell(user, 0, 'amount');
			await user.keyboard('{ArrowLeft}');
			expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'active' });
		} finally {
			document.documentElement.dir = '';
		}
	});
});

// ---------------------------------------------------------------------------
// 11. Guard rails and edge cases
// ---------------------------------------------------------------------------

describe('DataGrid — guard rails', () => {
	it('blocks editing, clearing and cutting while readOnly, but keeps navigation', async () => {
		const user = setupUser();
		const onDataChange = vi.fn();
		const { grid } = renderHarness({ minimalColumns: true, readOnly: true, onDataChange });

		await focusCell(user, 0, 'name');
		await user.keyboard('{Enter}');
		expect(grid.editingCell).toBeNull();

		await user.keyboard('{Delete}');
		await tick();
		expect(onDataChange).not.toHaveBeenCalled();

		await user.keyboard('{ArrowDown}');
		expect(grid.focusedCell).toEqual({ rowIndex: 1, columnId: 'name' });

		await user.keyboard('{Control>}a{/Control}');
		expect(grid.selection.size).toBe(9);
	});

	it('does not toggle a checkbox cell while readOnly', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true, readOnly: true });

		await focusCell(user, 1, 'active');
		await user.keyboard(' ');
		await tick();

		expect(grid.rows[1]?.original.active).toBe(true);
	});

	it('never deletes rows while readOnly', async () => {
		const user = setupUser();
		const onRowsDelete = vi.fn();
		renderHarness({ minimalColumns: true, readOnly: true, onRowsDelete });

		await focusCell(user, 0, 'name');
		await user.keyboard('{Control>}{Backspace}{/Control}');
		await tick();

		expect(onRowsDelete).not.toHaveBeenCalled();
	});

	it('renders an empty grid without error and no-ops select-all', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true, rows: [] });

		expect(gridElement()).toHaveAttribute('aria-rowcount', '0');
		expect(queryCellWrapper(0, 'name')).toBeNull();

		gridElement().focus();
		await user.keyboard('{Control>}a{/Control}');
		expect(grid.selection.size).toBe(0);
	});

	it('no-ops horizontal navigation with a single navigable column', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ singleColumn: true });

		await focusCell(user, 0, 'name');
		await user.keyboard('{ArrowRight}{ArrowLeft}{End}{Home}');

		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'name' });
	});

	it('disables keyboard navigation when no column is navigable', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ noNavigableColumns: true });

		expect(grid.navigableColumnIds).toEqual([]);

		gridElement().focus();
		await user.keyboard('{ArrowDown}');
		expect(grid.focusedCell).toBeNull();
	});

	it('throws the documented error for every part used outside the root', () => {
		const rows = HARNESS_ROWS;
		expect(() =>
			render(Row, {
				props: {
					// The props are irrelevant: the context lookup throws during initialisation.
					row: undefined as never,
					rowIndex: 0,
					top: 0
				}
			})
		).toThrow(/`<DataGrid\.Row>` must be used within `<DataGrid\.Root>`\./);

		expect(() => render(Search, { props: {} })).toThrow(
			/`<DataGrid\.Search>` must be used within `<DataGrid\.Root>`\./
		);
		expect(rows).toHaveLength(3);
	});
});

// ---------------------------------------------------------------------------
// 12. Cell variants
// ---------------------------------------------------------------------------

describe('DataGrid — cell variants', () => {
	it('renders every variant with its own slot', () => {
		renderHarness();

		for (const slot of [
			'short-text',
			'long-text',
			'number',
			'url',
			'checkbox',
			'select',
			'multi-select',
			'date',
			'file'
		]) {
			expect(
				document.querySelector(`[data-slot="data-grid-${slot}-cell"]`),
				`missing ${slot} cell`
			).not.toBeNull();
		}
	});

	it('shows each variant s display value', () => {
		renderHarness();

		expect(cellWrapper(0, 'name')).toHaveTextContent('Charlie');
		expect(cellWrapper(0, 'amount')).toHaveTextContent('30');
		expect(cellWrapper(0, 'status')).toHaveTextContent('Todo');
		expect(cellWrapper(0, 'tags')).toHaveTextContent('Alpha');
		expect(cellWrapper(1, 'files')).toHaveTextContent('report.pdf');
		expect(cellWrapper(0, 'website').querySelector('a')).toHaveAttribute(
			'href',
			'http://example.com'
		);
	});

	it('neutralises a dangerous url', () => {
		renderHarness({
			rows: [{ ...HARNESS_ROWS[0]!, website: 'javascript:alert(1)' }]
		});

		const link = cellWrapper(0, 'website').querySelector('a');
		expect(link).toHaveAttribute('href', '');
		expect(link).toHaveAttribute('data-invalid', '');
	});

	it('edits a number cell and commits on Enter', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'amount');
		await user.keyboard('{Enter}');
		await tick();

		const input = within(cellWrapper(0, 'amount')).getByRole('spinbutton');
		await user.clear(input);
		await user.type(input, '55');
		await user.keyboard('{Enter}');
		await tick();

		expect(grid.rows[0]?.original.amount).toBe(55);
	});

	it('honours min, max and step on a number cell, clamping what it commits', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'amount');
		await user.keyboard('{Enter}');
		await tick();

		const input = within(cellWrapper(0, 'amount')).getByRole('spinbutton');
		expect(input).toHaveAttribute('min', '0');
		expect(input).toHaveAttribute('max', '1000');
		expect(input).toHaveAttribute('step', '5');

		// The attributes alone do not constrain a typed value — the commit has to.
		await user.clear(input);
		await user.type(input, '5000');
		await user.keyboard('{Enter}');
		await tick();

		expect(grid.rows[0]?.original.amount).toBe(1000);
		expect(cellWrapper(0, 'amount')).toHaveTextContent('1000');
	});

	it('clamps a number cell up to the column minimum', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'amount');
		await user.keyboard('{Enter}');
		await tick();

		const input = within(cellWrapper(0, 'amount')).getByRole('spinbutton');
		await user.clear(input);
		await user.type(input, '-20');
		await user.keyboard('{Enter}');
		await tick();

		expect(grid.rows[0]?.original.amount).toBe(0);
	});

	it('toggles a checkbox cell without an edit mode', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'active');
		await user.keyboard(' ');
		await tick();

		expect(grid.rows[0]?.original.active).toBe(true);
		expect(grid.editingCell).toBeNull();
	});

	it('toggles a checkbox cell on F2 and keeps the keyboard alive', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'active');
		await user.keyboard('{F2}');
		await tick();

		expect(grid.rows[0]?.original.active).toBe(true);
		expect(grid.editingCell).toBeNull();

		await user.keyboard('{ArrowDown}');
		await tick();
		expect(grid.focusedCell).toEqual({ rowIndex: 1, columnId: 'active' });
	});

	it('swallows a printable character on a checkbox cell', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'active');
		await user.keyboard('a');
		await tick();

		expect(grid.rows[0]?.original.active).toBe(false);
		expect(grid.editingCell).toBeNull();

		await user.keyboard('{ArrowDown}');
		await tick();
		expect(grid.focusedCell).toEqual({ rowIndex: 1, columnId: 'active' });
	});

	it('opens the select editor and commits a choice', async () => {
		const user = setupUser();
		const { grid } = renderHarness();

		await focusCell(user, 0, 'status');
		await user.keyboard('{Enter}');
		await tick();

		const editor = within(cellWrapper(0, 'status')).getByRole('listbox');
		await user.click(within(editor).getByText('Done'));
		await tick();

		expect(grid.rows[0]?.original.status).toBe('done');
		expect(grid.editingCell).toBeNull();
	});

	it('toggles multi-select values and clears them all', async () => {
		const user = setupUser();
		const { grid } = renderHarness();

		await focusCell(user, 0, 'tags');
		await user.keyboard('{Enter}');
		await tick();

		const editor = within(cellWrapper(0, 'tags')).getByRole('listbox');
		await user.click(within(editor).getByText('Beta'));
		await tick();
		expect(grid.rows[0]?.original.tags).toEqual(['alpha', 'beta']);

		await user.click(within(cellWrapper(0, 'tags')).getByText('Clear all'));
		await tick();
		expect(grid.rows[0]?.original.tags).toEqual([]);
	});

	it('opens the date editor and writes a YYYY-MM-DD value', async () => {
		const user = setupUser();
		const { grid } = renderHarness();

		await focusCell(user, 0, 'dueDate');
		await user.keyboard('{Enter}');
		await tick();

		const editor = within(cellWrapper(0, 'dueDate')).getByRole('application');
		await user.click(within(editor).getByText('15'));
		await tick();

		expect(grid.rows[0]?.original.dueDate).toBe('2024-03-15');
		expect(grid.editingCell).toBeNull();
	});

	it('edits a long-text cell in a popover editor and commits with Mod+Enter', async () => {
		const user = setupUser();
		const { grid } = renderHarness();

		await focusCell(user, 0, 'description');
		await user.keyboard('{Enter}');
		await tick();

		const textarea = within(cellWrapper(0, 'description')).getByRole('textbox');
		await user.type(textarea, '!');
		await user.keyboard('{Control>}{Enter}{/Control}');
		await tick();

		expect(grid.rows[0]?.original.description).toBe('first row notes!');
		expect(grid.editingCell).toBeNull();
	});

	it('discards a long-text edit on Escape', async () => {
		const user = setupUser();
		const { grid } = renderHarness();

		await focusCell(user, 0, 'description');
		await user.keyboard('{Enter}');
		await tick();

		const textarea = within(cellWrapper(0, 'description')).getByRole('textbox');
		await user.type(textarea, 'nope');
		await user.keyboard('{Escape}');
		await tick();

		expect(grid.rows[0]?.original.description).toBe('first row notes');
	});

	it('opens the file editor and removes a stored file', async () => {
		const user = setupUser();
		const onFilesDelete = vi.fn();
		const { grid } = renderHarness({ onFilesDelete });

		await focusCell(user, 1, 'files');
		await user.keyboard('{Enter}');
		await tick();

		await user.click(
			within(cellWrapper(1, 'files')).getByRole('button', { name: 'Remove report.pdf' })
		);
		await tick();

		expect(onFilesDelete).toHaveBeenCalledWith({
			fileIds: ['f1'],
			rowIndex: 1,
			columnId: 'files'
		});
		expect(grid.rows[1]?.original.files).toEqual([]);
	});

	it('refuses to open an editor while readOnly', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ readOnly: true });

		for (const columnId of ['name', 'description', 'status', 'tags', 'dueDate', 'files']) {
			await focusCell(user, 0, columnId);
			await user.keyboard('{Enter}');
			expect(grid.editingCell, `${columnId} opened an editor`).toBeNull();
		}
	});
});

// ---------------------------------------------------------------------------
// 13. Row management and the context menu
// ---------------------------------------------------------------------------

describe('DataGrid — row management', () => {
	it('focuses the cell onRowAdd names', async () => {
		const user = setupUser();
		let rows = HARNESS_ROWS.map((row) => ({ ...row }));
		const onRowAdd = vi.fn(() => {
			rows = [...rows, { ...HARNESS_ROWS[0]!, id: 'r4', name: 'New' }];
			return { rowIndex: 3, columnId: 'amount' };
		});

		const { grid } = renderHarness({ minimalColumns: true, rows, onRowAdd });

		await user.click(screen.getByRole('gridcell', { name: 'Add row' }));
		await tick();

		expect(onRowAdd).toHaveBeenCalled();
		expect(grid.focusedCell).toEqual({ rowIndex: 2, columnId: 'amount' });
	});

	it('adds a row with Shift+Enter', async () => {
		const user = setupUser();
		const onRowAdd = vi.fn(() => null);
		renderHarness({ minimalColumns: true, onRowAdd });

		await focusCell(user, 0, 'name');
		await user.keyboard('{Shift>}{Enter}{/Shift}');
		await tick();

		expect(onRowAdd).toHaveBeenCalled();
	});

	it('deletes the selected rows with Mod+Backspace and re-focuses', async () => {
		const user = setupUser();
		const onRowsDelete = vi.fn();
		const { grid } = renderHarness({ minimalColumns: true, onRowsDelete });

		await focusCell(user, 1, 'name');
		await user.keyboard('{Control>}{Backspace}{/Control}');
		await tick();

		expect(onRowsDelete).toHaveBeenCalledWith([HARNESS_ROWS[1]], [1]);
		expect(grid.focusedCell).toEqual({ rowIndex: 1, columnId: 'name' });
	});

	it('offers Copy, Cut, Clear and Delete rows on right-click', async () => {
		const user = setupUser();
		const onRowsDelete = vi.fn();
		const { grid } = renderHarness({ minimalColumns: true, onRowsDelete });

		await focusCell(user, 0, 'name');
		await user.pointer({ keys: '[MouseRight]', target: cellWrapper(0, 'name') });
		await tick();

		expect(grid.contextMenu.open).toBe(true);
		expect(findLayerItem('menuitem', 'Copy')).toBeDefined();
		expect(findLayerItem('menuitem', 'Cut')).toBeDefined();
		expect(findLayerItem('menuitem', 'Clear')).toBeDefined();
		expect(findLayerItem('menuitem', 'Delete rows')).toBeDefined();
	});

	it('omits Delete rows when onRowsDelete was not provided', async () => {
		const user = setupUser();
		renderHarness({ minimalColumns: true });

		await focusCell(user, 0, 'name');
		await user.pointer({ keys: '[MouseRight]', target: cellWrapper(0, 'name') });
		await tick();

		expect(findLayerItem('menuitem', 'Delete rows')).toBeUndefined();
	});

	it('scopes Clear to the right-clicked cell', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await user.pointer({ keys: '[MouseRight]', target: cellWrapper(2, 'name') });
		await tick();
		await user.click(layerItem('menuitem', 'Clear'));
		await tick();

		expect(grid.rows[2]?.original.name).toBe('');
		expect(grid.rows[0]?.original.name).toBe('Charlie');
		expect(toastSuccess).toHaveBeenCalledWith('1 cell cleared');
	});

	it('disables Cut and Clear while readOnly', async () => {
		const user = setupUser();
		renderHarness({ minimalColumns: true, readOnly: true });

		await user.pointer({ keys: '[MouseRight]', target: cellWrapper(0, 'name') });
		await tick();

		expect(layerItem('menuitem', 'Cut')).toHaveAttribute('data-disabled');
		expect(layerItem('menuitem', 'Clear')).toHaveAttribute('data-disabled');
	});
});

// ---------------------------------------------------------------------------
// 14. Keyboard shortcuts dialog
// ---------------------------------------------------------------------------

describe('DataGrid — keyboard shortcuts dialog', () => {
	function dialogText(): string {
		return screen.getByRole('dialog', inLayer).textContent ?? '';
	}

	/** The dialog's own filter field, scoped so a torn-down dialog can never be typed into. */
	function filterField(): HTMLElement {
		return within(screen.getByRole('dialog', inLayer)).getByLabelText('Search shortcuts');
	}

	it('opens on Mod+/', async () => {
		const user = setupUser();
		renderHarness({ minimalColumns: true, withShortcuts: true });

		expect(screen.queryByRole('dialog', inLayer)).toBeNull();
		gridElement().focus();
		await user.keyboard('{Control>}/{/Control}');
		await tick();

		expect(screen.getByRole('dialog', inLayer)).toBeInTheDocument();
	});

	it('renders the always-on groups and omits Search by default', () => {
		renderHarness({ minimalColumns: true, withShortcuts: true, shortcutsDefaultOpen: true });

		const text = dialogText();
		expect(text).toContain('Navigation');
		expect(text).toContain('Selection');
		expect(text).toContain('Editing');
		expect(text).toContain('Sorting');
		expect(text).toContain('General');
		expect(text).not.toContain('Open search');
	});

	it('adds the Search group when enableSearch is set', () => {
		renderHarness({
			minimalColumns: true,
			withShortcuts: true,
			shortcutsDefaultOpen: true,
			shortcutsEnableSearch: true
		});

		expect(dialogText()).toContain('Open search');
	});

	it('adds one Editing row per optional capability', () => {
		renderHarness({
			minimalColumns: true,
			withShortcuts: true,
			shortcutsDefaultOpen: true,
			shortcutsEnablePaste: true,
			shortcutsEnableRowAdd: true,
			shortcutsEnableRowsDelete: true,
			shortcutsEnableUndoRedo: true
		});

		const text = dialogText();
		expect(text).toContain('Paste cells');
		expect(text).toContain('Insert row below');
		expect(text).toContain('Delete selected rows');
		expect(text).toContain('Undo');
		expect(text).toContain('Redo');
	});

	it('filters the visible shortcuts as the user types', async () => {
		const user = setupUser();
		renderHarness({ minimalColumns: true, withShortcuts: true, shortcutsDefaultOpen: true });

		await user.type(filterField(), 'select all');
		await tick();

		const text = dialogText();
		expect(text).toContain('Select all cells');
		expect(text).not.toContain('Move to first column');
	});

	it('shows the empty state when nothing matches', async () => {
		const user = setupUser();
		renderHarness({ minimalColumns: true, withShortcuts: true, shortcutsDefaultOpen: true });

		await user.type(filterField(), 'zzzz');
		await tick();

		expect(dialogText()).toContain('No shortcuts found');
	});
});

// ---------------------------------------------------------------------------
// 15. Column header and resizer
// ---------------------------------------------------------------------------

describe('DataGrid — column header', () => {
	async function openHeaderMenu(user: ReturnType<typeof setupUser>, label: string): Promise<void> {
		const trigger = screen
			.getAllByRole('columnheader')
			.map((header) => header.querySelector<HTMLElement>('[data-slot="data-grid-column-header"]'))
			.find((element) => (element?.textContent ?? '').includes(label));
		if (!trigger) throw new Error(`No column header for "${label}".`);
		await user.click(trigger);
		await tick();
	}

	it('cycles sorting through ascending, descending and none', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await openHeaderMenu(user, 'Name');
		await user.click(layerItem('menuitemcheckbox', 'Sort asc'));
		await tick();
		expect(grid.sorting).toEqual([{ id: 'name', desc: false }]);
		expect(screen.getAllByRole('columnheader')[0]).toHaveAttribute('aria-sort', 'ascending');

		await openHeaderMenu(user, 'Name');
		await user.click(layerItem('menuitemcheckbox', 'Sort desc'));
		await tick();
		expect(grid.sorting).toEqual([{ id: 'name', desc: true }]);
		expect(screen.getAllByRole('columnheader')[0]).toHaveAttribute('aria-sort', 'descending');

		await openHeaderMenu(user, 'Name');
		await user.click(layerItem('menuitem', 'Remove sort'));
		await tick();
		expect(grid.sorting).toEqual([]);
		expect(screen.getAllByRole('columnheader')[0]).toHaveAttribute('aria-sort', 'none');
	});

	it('pins and unpins a column', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await openHeaderMenu(user, 'Name');
		await user.click(layerItem('menuitem', 'Pin to left'));
		await tick();
		expect(grid.table.getColumn('name')?.getIsPinned()).toBe('left');

		await openHeaderMenu(user, 'Name');
		await user.click(layerItem('menuitem', 'Unpin from left'));
		await tick();
		expect(grid.table.getColumn('name')?.getIsPinned()).toBe(false);
	});

	it('hides a column', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		await openHeaderMenu(user, 'Amount');
		await user.click(layerItem('menuitem', 'Hide column'));
		await tick();

		expect(grid.table.getColumn('amount')?.getIsVisible()).toBe(false);
		expect(queryCellWrapper(0, 'amount')).toBeNull();
	});

	it('selects the whole column on a header click when enableColumnSelection is set', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true, enableColumnSelection: true });

		await openHeaderMenu(user, 'Name');
		expect(selectedKeys(grid)).toEqual(['0:name', '1:name', '2:name']);
	});

	it('auto-fits a column to its widest rendered cell on a resizer double-click', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		grid.table.setColumnSizing({ name: 400 });
		await tick();
		expect(grid.table.getColumn('name')?.getSize()).toBe(400);

		// jsdom lays nothing out, so the measured content widths are stubbed onto the cells the
		// resizer reads out of the grid's registry.
		for (const [rowIndex, width] of [200, 310, 120].entries()) {
			Object.defineProperty(cellWrapper(rowIndex, 'name'), 'scrollWidth', {
				configurable: true,
				value: width
			});
		}

		await user.dblClick(screen.getAllByRole('separator')[0]!);
		await tick();

		expect(grid.table.getColumn('name')?.getSize()).toBe(310 + COLUMN_AUTO_FIT_PADDING);
	});

	it('clamps a resizer auto-fit at the column minimum', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		grid.table.setColumnSizing({ name: 400 });
		await tick();

		// Every unstubbed `scrollWidth` is 0 under jsdom, so the clamp is what decides the result.
		await user.dblClick(screen.getAllByRole('separator')[0]!);
		await tick();

		expect(grid.table.getColumn('name')?.getSize()).toBe(60);
	});

	it('resizes a column from the keyboard', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });
		const column = () => grid.table.getColumn('name');

		screen.getAllByRole('separator')[0]!.focus();

		await user.keyboard('{ArrowRight}');
		await tick();
		expect(column()?.getSize()).toBe(150 + COLUMN_RESIZE_STEP);

		await user.keyboard('{ArrowLeft}{ArrowLeft}');
		await tick();
		expect(column()?.getSize()).toBe(150 - COLUMN_RESIZE_STEP);

		await user.keyboard('{Home}');
		await tick();
		expect(column()?.getSize()).toBe(60);

		await user.keyboard('{End}');
		await tick();
		expect(column()?.getSize()).toBe(800);

		// Escape restores the width the handle was focused at.
		await user.keyboard('{Escape}');
		await tick();
		expect(column()?.getSize()).toBe(150);
	});

	it('commits a keyboard resize with Enter so Escape no longer reverts it', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true });

		screen.getAllByRole('separator')[0]!.focus();

		await user.keyboard('{ArrowRight}{Enter}{Escape}');
		await tick();

		expect(grid.table.getColumn('name')?.getSize()).toBe(150 + COLUMN_RESIZE_STEP);
	});

	it('inverts the resize arrows under dir="rtl"', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true, dir: 'rtl' });

		screen.getAllByRole('separator')[0]!.focus();

		await user.keyboard('{ArrowLeft}');
		await tick();
		expect(grid.table.getColumn('name')?.getSize()).toBe(150 + COLUMN_RESIZE_STEP);

		await user.keyboard('{ArrowRight}');
		await tick();
		expect(grid.table.getColumn('name')?.getSize()).toBe(150);
	});
});

// ---------------------------------------------------------------------------
// 16. Row selection
// ---------------------------------------------------------------------------

describe('DataGrid — row selection', () => {
	it('keeps a select column out of the navigation axis', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true, withSelectColumn: true });

		expect(grid.columnIds).toContain('select');
		expect(grid.navigableColumnIds).toEqual(['name', 'amount', 'active']);

		await focusCell(user, 0, 'amount');
		await user.keyboard('{ArrowLeft}');
		await tick();
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'name' });

		// `name` is the first navigable column: arrowing left again must not step into `select`.
		await user.keyboard('{ArrowLeft}');
		await tick();
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'name' });
	});

	it('marks a selected row and reports the resolved selection', async () => {
		const onRowSelectionChange = vi.fn();
		const { grid } = renderHarness({
			minimalColumns: true,
			withSelectColumn: true,
			onRowSelectionChange
		});

		grid.selectRow('r1', true, false);
		await tick();

		const rows = document.querySelectorAll('[data-slot="data-grid-row"]');
		expect(rows[0]).toHaveAttribute('aria-selected', 'true');
		expect(rows[1]).toHaveAttribute('aria-selected', 'false');
		expect(onRowSelectionChange).toHaveBeenCalledWith({ r1: true });
	});

	it('extends the row selection from the last clicked row on shift', async () => {
		const onRowSelectionChange = vi.fn();
		const { grid } = renderHarness({
			minimalColumns: true,
			withSelectColumn: true,
			onRowSelectionChange
		});

		grid.selectRow('r1', true, false);
		grid.selectRow('r3', true, true);
		await tick();

		expect(grid.rowSelection).toEqual({ r1: true, r2: true, r3: true });
		expect(onRowSelectionChange).toHaveBeenLastCalledWith({ r1: true, r2: true, r3: true });
		for (const row of document.querySelectorAll('[data-slot="data-grid-row"]')) {
			expect(row).toHaveAttribute('aria-selected', 'true');
		}
	});

	it('numbers rows from one for the select column label', () => {
		const { grid } = renderHarness({ minimalColumns: true, withSelectColumn: true });

		expect(grid.getVisualRowIndex('r1')).toBe(1);
		expect(grid.getVisualRowIndex('r3')).toBe(3);
		expect(grid.getVisualRowIndex('nope')).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// 17. Layout options
// ---------------------------------------------------------------------------

describe('DataGrid — layout options', () => {
	function cellContainer(columnId: string): HTMLElement {
		const element = document.querySelector<HTMLElement>(
			`[data-slot="data-grid-cell-container"][data-column-id="${columnId}"]`
		);
		if (!element) throw new Error(`No cell container for "${columnId}".`);
		return element;
	}

	it('grows every column but select when stretchColumns is set', () => {
		renderHarness({ minimalColumns: true, withSelectColumn: true, stretchColumns: true });

		expect(cellContainer('name').className).toContain('grow');
		expect(cellContainer('amount').className).toContain('grow');
		expect(cellContainer('select').className).not.toContain('grow');
	});

	it('leaves columns at their own width without stretchColumns', () => {
		renderHarness({ minimalColumns: true, withSelectColumn: true });
		expect(cellContainer('name').className).not.toContain('grow');
	});

	it('renders each row-height preset and reports the change', async () => {
		const onRowHeightChange = vi.fn();
		const { grid } = renderHarness({ minimalColumns: true, onRowHeightChange });

		const row = () => document.querySelector<HTMLElement>('[data-slot="data-grid-row"]');
		expect(row()).toHaveStyle({ height: '36px' });

		const presets = [
			['medium', 56],
			['tall', 76],
			['extra-tall', 96],
			['short', 36]
		] as const;

		for (const [preset, pixels] of presets) {
			grid.setRowHeight(preset);
			await tick();

			expect(grid.rowHeight).toBe(preset);
			expect(row()).toHaveStyle({ height: `${pixels}px` });
			expect(onRowHeightChange).toHaveBeenCalledWith(preset);
		}
	});
});

// ---------------------------------------------------------------------------
// 18. Single cell selection
// ---------------------------------------------------------------------------

describe('DataGrid — enableSingleCellSelection', () => {
	it('selects exactly the clicked cell', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true, enableSingleCellSelection: true });

		await focusCell(user, 0, 'name');

		expect(selectedKeys(grid)).toEqual(['0:name']);
		expect(grid.focusedCell).toEqual({ rowIndex: 0, columnId: 'name' });
	});

	it('never grows the selection past one cell with shift+click', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true, enableSingleCellSelection: true });

		await focusCell(user, 0, 'name');

		await user.keyboard('{Shift>}');
		await user.click(cellWrapper(2, 'amount'));
		await user.keyboard('{/Shift}');
		await tick();

		expect(selectedKeys(grid)).toEqual(['2:amount']);
	});

	it('never grows the selection past one cell with shift+arrow', async () => {
		const user = setupUser();
		const { grid } = renderHarness({ minimalColumns: true, enableSingleCellSelection: true });

		await focusCell(user, 0, 'name');

		await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
		await tick();
		expect(selectedKeys(grid)).toEqual(['1:name']);

		await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
		await tick();
		expect(selectedKeys(grid)).toEqual(['1:amount']);
	});
});
