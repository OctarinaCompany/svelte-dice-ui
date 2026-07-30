import { describe, expect, it } from 'vitest';

import { createIntervalTree } from './masonry-interval-tree.js';
import {
	createPositioner,
	resolveColumnCount,
	resolveColumnWidth,
	type Positioner,
	type PositionerOptions
} from './masonry-positioner.js';

// ---------------------------------------------------------------------------
// Helpers
//
// Every assertion here is DOM-free: heights are fed straight into the positioner in index order,
// exactly the order `MasonryState` guarantees (research R-04), and the resulting
// `{ top, left, columnIndex }` triples are compared against the algorithm contract in
// `contracts/public-api.md` §5. This is the SC-001 upstream-parity floor.
// ---------------------------------------------------------------------------

/** Feed `heights` into a fresh positioner in index order and hand it back. */
function seed(options: PositionerOptions, heights: number[]): Positioner {
	const positioner = createPositioner(options);
	heights.forEach((height, index) => positioner.set(index, height));
	return positioner;
}

/** The `columnIndex` assigned to every seeded item, in index order. */
function columnsOf(positioner: Positioner, count: number): number[] {
	return Array.from({ length: count }, (_, index) => positioner.get(index)?.columnIndex ?? -1);
}

/** The `top` assigned to every seeded item, in index order. */
function topsOf(positioner: Positioner, count: number): number[] {
	return Array.from({ length: count }, (_, index) => positioner.get(index)?.top ?? -1);
}

/** The leading-edge offset assigned to every seeded item, in index order. */
function leftsOf(positioner: Positioner, count: number): number[] {
	return Array.from({ length: count }, (_, index) => positioner.get(index)?.left ?? -1);
}

// ---------------------------------------------------------------------------
// Column derivation (T004)
// ---------------------------------------------------------------------------

describe('resolveColumnCount / resolveColumnWidth (T004)', () => {
	it('derives the column count and width from the container width', () => {
		const options: PositionerOptions = { width: 620, columnWidth: 200, columnGap: 0 };

		expect(resolveColumnCount(options)).toBe(3);
		expect(resolveColumnWidth(options)).toBe(206);
	});

	it('accounts for the column gap on both sides of the derivation', () => {
		const options: PositionerOptions = { width: 632, columnWidth: 200, columnGap: 16 };

		// floor((632 + 16) / (200 + 16)) === 3, then floor((632 - 16 * 2) / 3) === 200.
		expect(resolveColumnCount(options)).toBe(3);
		expect(resolveColumnWidth(options)).toBe(200);
	});

	it('falls back to a single column when the container is narrower than one column', () => {
		const options: PositionerOptions = { width: 100, columnWidth: 200 };

		expect(resolveColumnCount(options)).toBe(1);
		expect(resolveColumnWidth(options)).toBe(100);
	});

	it('never derives zero columns from a zero width', () => {
		expect(resolveColumnCount({ width: 0, columnWidth: 200 })).toBe(1);
		expect(resolveColumnWidth({ width: 0, columnWidth: 200 })).toBe(0);
	});

	it('caps the derived count with maxColumnCount', () => {
		expect(resolveColumnCount({ width: 1200, columnWidth: 200 })).toBe(6);
		expect(resolveColumnCount({ width: 1200, columnWidth: 200, maxColumnCount: 2 })).toBe(2);
	});

	it('lets an explicit columnCount win over the width-derived count', () => {
		expect(resolveColumnCount({ width: 1200, columnWidth: 200, columnCount: 3 })).toBe(3);
		expect(resolveColumnWidth({ width: 1200, columnWidth: 200, columnCount: 3 })).toBe(400);
	});

	it('makes maxColumnCount inert once columnCount is explicit', () => {
		expect(
			resolveColumnCount({ width: 1200, columnWidth: 200, columnCount: 3, maxColumnCount: 2 })
		).toBe(3);
	});

	it('exposes the same derivation on the created positioner', () => {
		const positioner = createPositioner({ width: 620, columnWidth: 200 });

		expect(positioner.columnCount).toBe(3);
		expect(positioner.columnWidth).toBe(206);
	});

	it('defaults columnWidth to 200 and the gaps to 0', () => {
		const positioner = createPositioner({ width: 620 });

		expect(positioner.columnCount).toBe(3);
		expect(positioner.columnWidth).toBe(206);
	});
});

// ---------------------------------------------------------------------------
// Default (shortest-column) assignment — US1 (T004)
// ---------------------------------------------------------------------------

describe('createPositioner default assignment (T004, US1)', () => {
	const OPTIONS: PositionerOptions = { width: 620, columnWidth: 200, columnGap: 0 };
	const HEIGHTS = [100, 200, 150, 50, 300, 120];

	it('places every item in the then-shortest column', () => {
		const positioner = seed(OPTIONS, HEIGHTS);

		expect(columnsOf(positioner, HEIGHTS.length)).toEqual([0, 1, 2, 0, 0, 2]);
	});

	it('stacks each item under the current height of its column', () => {
		const positioner = seed(OPTIONS, HEIGHTS);

		expect(topsOf(positioner, HEIGHTS.length)).toEqual([0, 0, 0, 100, 150, 150]);
	});

	it('offsets each item from the leading edge by columnIndex * (columnWidth + columnGap)', () => {
		const positioner = seed(OPTIONS, HEIGHTS);

		expect(leftsOf(positioner, HEIGHTS.length)).toEqual([0, 206, 412, 0, 0, 412]);
	});

	it('breaks a tie by taking the lowest column index', () => {
		// Every column is 0 tall, so all three are tied on the very first item.
		const positioner = seed(OPTIONS, [10]);
		expect(positioner.get(0)?.columnIndex).toBe(0);

		// Item 4 sees columns [150, 200, 150] — the lowest of the two tied indices wins.
		const tied = seed(OPTIONS, HEIGHTS);
		expect(tied.get(4)?.columnIndex).toBe(0);
	});

	it('records the measured height and counts one interval per item', () => {
		const positioner = seed(OPTIONS, HEIGHTS);

		expect(positioner.get(2)?.height).toBe(150);
		expect(positioner.size()).toBe(HEIGHTS.length);
		expect(positioner.all()).toHaveLength(HEIGHTS.length);
	});

	it('treats an omitted height as zero', () => {
		const positioner = createPositioner(OPTIONS);
		positioner.set(0);

		expect(positioner.get(0)).toEqual({ top: 0, left: 0, height: 0, columnIndex: 0 });
	});

	it('returns undefined for an index that was never set', () => {
		const positioner = seed(OPTIONS, HEIGHTS);

		expect(positioner.get(HEIGHTS.length)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Gaps (T004)
// ---------------------------------------------------------------------------

describe('createPositioner gap handling (T004)', () => {
	it('uses the column gap horizontally and the row gap vertically', () => {
		const positioner = seed(
			{ width: 632, columnWidth: 200, columnGap: 16, rowGap: 24 },
			[100, 100, 100, 100]
		);

		// Horizontal step is columnWidth + columnGap === 216.
		expect(leftsOf(positioner, 4)).toEqual([0, 216, 432, 0]);
		// Vertical step is height + rowGap === 124.
		expect(topsOf(positioner, 4)).toEqual([0, 0, 0, 124]);
	});

	it('falls back to the column gap when no row gap is given', () => {
		const positioner = seed({ width: 632, columnWidth: 200, columnGap: 16 }, [100, 100, 100, 100]);

		expect(topsOf(positioner, 4)).toEqual([0, 0, 0, 116]);
	});

	it('behaves as gap 0 when both gaps are omitted', () => {
		const positioner = seed({ width: 600, columnWidth: 200 }, [100, 100, 100, 100]);

		expect(leftsOf(positioner, 4)).toEqual([0, 200, 400, 0]);
		expect(topsOf(positioner, 4)).toEqual([0, 0, 0, 100]);
	});
});

// ---------------------------------------------------------------------------
// Linear assignment — US2 (T004)
// ---------------------------------------------------------------------------

describe('createPositioner linear assignment (T004, US2)', () => {
	it('assigns columns round-robin when every item is the same height', () => {
		const positioner = seed(
			{ width: 800, columnWidth: 200, linear: true },
			[100, 100, 100, 100, 100, 100]
		);

		expect(positioner.columnCount).toBe(4);
		expect(columnsOf(positioner, 6)).toEqual([0, 1, 2, 3, 0, 1]);
	});

	it('wraps to the next row once the round-robin cycle completes', () => {
		const positioner = seed(
			{ width: 800, columnWidth: 200, linear: true },
			[100, 100, 100, 100, 100, 100]
		);

		expect(topsOf(positioner, 6)).toEqual([0, 0, 0, 0, 100, 100]);
	});

	it('falls back to the shortest column once the preferred one exceeds the 2.5x threshold', () => {
		// Column 0 is 1000 tall, column 1 is 10 tall. Item 2 prefers column 0 (2 % 2 === 0) but
		// 1000 + 10 > 10 + 10 * 2.5, so it drops to the shortest column instead.
		const positioner = seed({ width: 400, columnWidth: 200, linear: true }, [1000, 10, 10]);

		expect(columnsOf(positioner, 3)).toEqual([0, 1, 1]);
		expect(topsOf(positioner, 3)).toEqual([0, 0, 10]);
	});

	it('keeps the preferred column while it stays inside the threshold', () => {
		// Column 0 is 20 tall, column 1 is 10 tall; item 2 prefers column 0 and 20 + 10 <= 10 + 25.
		const positioner = seed({ width: 400, columnWidth: 200, linear: true }, [20, 10, 10]);

		expect(columnsOf(positioner, 3)).toEqual([0, 1, 0]);
	});

	it('keeps source order where the default algorithm would not', () => {
		const options: PositionerOptions = { width: 400, columnWidth: 200 };

		expect(columnsOf(seed({ ...options, linear: true }, [20, 10, 10]), 3)).toEqual([0, 1, 0]);
		expect(columnsOf(seed(options, [20, 10, 10]), 3)).toEqual([0, 1, 1]);
	});
});

// ---------------------------------------------------------------------------
// update() re-flow (T004)
// ---------------------------------------------------------------------------

describe('createPositioner update (T004)', () => {
	const OPTIONS: PositionerOptions = { width: 400, columnWidth: 200 };

	it('re-flows later items in the affected column', () => {
		const positioner = seed(OPTIONS, [100, 100, 100, 100]);
		expect(topsOf(positioner, 4)).toEqual([0, 0, 100, 100]);

		positioner.update([1, 400]);

		expect(positioner.get(1)?.height).toBe(400);
		expect(topsOf(positioner, 4)).toEqual([0, 0, 100, 400]);
	});

	it('leaves the untouched column exactly where it was', () => {
		const positioner = seed(OPTIONS, [100, 100, 100, 100]);

		positioner.update([1, 400]);

		expect(positioner.get(0)?.top).toBe(0);
		expect(positioner.get(2)?.top).toBe(100);
		expect(positioner.get(2)?.columnIndex).toBe(0);
	});

	it('accepts several index/height pairs at once', () => {
		const positioner = seed(OPTIONS, [100, 100, 100, 100]);

		positioner.update([0, 300, 1, 400]);

		expect(topsOf(positioner, 4)).toEqual([0, 0, 300, 400]);
	});

	it('ignores an index that was never measured', () => {
		const positioner = seed(OPTIONS, [100, 100]);

		expect(() => positioner.update([9, 400])).not.toThrow();
		expect(topsOf(positioner, 2)).toEqual([0, 0]);
	});

	it('keeps the re-flowed extents searchable through range()', () => {
		const positioner = seed(OPTIONS, [100, 100, 100, 100]);
		positioner.update([1, 400]);

		const seen: number[] = [];
		positioner.range(390, 420, (index) => seen.push(index));

		expect(seen).toContain(3);
		expect(seen).not.toContain(2);
	});
});

// ---------------------------------------------------------------------------
// range / estimateHeight / shortestColumn (T004)
// ---------------------------------------------------------------------------

describe('createPositioner range and estimation (T004)', () => {
	const OPTIONS: PositionerOptions = { width: 400, columnWidth: 200 };

	it('reports every item whose extent overlaps the queried window', () => {
		const positioner = seed(OPTIONS, [100, 100, 100, 100]);

		const seen: number[] = [];
		positioner.range(0, 50, (index) => seen.push(index));

		expect(seen.sort()).toEqual([0, 1]);
	});

	it('hands the caller the item left and top', () => {
		const positioner = seed(OPTIONS, [100, 100]);

		const reported = new Map<number, { left: number; top: number }>();
		positioner.range(0, 1000, (index, left, top) => reported.set(index, { left, top }));

		expect(reported.get(0)).toEqual({ left: 0, top: 0 });
		expect(reported.get(1)).toEqual({ left: 200, top: 0 });
	});

	it('reports the tallest column once everything is measured', () => {
		const positioner = seed(OPTIONS, [100, 300]);

		expect(positioner.estimateHeight(2, 300)).toBe(300);
	});

	it('extrapolates the remaining items from the default item height', () => {
		const positioner = seed(OPTIONS, [100, 300]);

		// 2 unmeasured items over 2 columns => one more row of 300.
		expect(positioner.estimateHeight(4, 300)).toBe(600);
	});

	it('reports the shortest column height', () => {
		const positioner = seed(OPTIONS, [100, 300]);

		expect(positioner.shortestColumn()).toBe(100);
	});

	it('reports the single column height when there is only one column', () => {
		const positioner = seed({ width: 100, columnWidth: 200 }, [100]);

		expect(positioner.shortestColumn()).toBe(100);
	});
});

// ---------------------------------------------------------------------------
// Interval tree (T004)
// ---------------------------------------------------------------------------

describe('createIntervalTree (T004)', () => {
	it('finds every interval overlapping the queried window', () => {
		const tree = createIntervalTree();
		tree.insert(0, 100, 0);
		tree.insert(100, 200, 1);
		tree.insert(300, 400, 2);

		const seen: number[] = [];
		tree.search(50, 150, (index) => seen.push(index));

		expect(seen.sort()).toEqual([0, 1]);
	});

	it('hands the callback the interval low bound', () => {
		const tree = createIntervalTree();
		tree.insert(120, 220, 7);

		const lows: number[] = [];
		tree.search(0, 1000, (_index, low) => lows.push(low));

		expect(lows).toEqual([120]);
	});

	it('counts intervals rather than tree nodes', () => {
		const tree = createIntervalTree();
		tree.insert(0, 100, 0);
		tree.insert(0, 150, 1);

		expect(tree.size).toBe(2);
	});

	it('ignores a duplicate index at the same low bound', () => {
		const tree = createIntervalTree();
		tree.insert(0, 100, 0);
		tree.insert(0, 100, 0);

		expect(tree.size).toBe(1);
	});

	it('removes an interval and stops reporting it', () => {
		const tree = createIntervalTree();
		tree.insert(0, 100, 0);
		tree.insert(100, 200, 1);
		tree.remove(0);

		const seen: number[] = [];
		tree.search(0, 1000, (index) => seen.push(index));

		expect(seen).toEqual([1]);
		expect(tree.size).toBe(1);
	});

	it('ignores removing an index it never held', () => {
		const tree = createIntervalTree();
		tree.insert(0, 100, 0);

		expect(() => tree.remove(42)).not.toThrow();
		expect(tree.size).toBe(1);
	});

	it('stays consistent across many inserts and removals', () => {
		const tree = createIntervalTree();
		for (let index = 0; index < 200; index++) {
			tree.insert(index * 10, index * 10 + 5, index);
		}
		expect(tree.size).toBe(200);

		for (let index = 0; index < 200; index += 2) {
			tree.remove(index);
		}
		expect(tree.size).toBe(100);

		const seen: number[] = [];
		tree.search(0, 45, (index) => seen.push(index));
		expect(seen.sort((a, b) => a - b)).toEqual([1, 3]);
	});
});
