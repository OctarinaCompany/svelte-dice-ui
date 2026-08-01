import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
	verticalListSortingStrategy,
	type ClientRect,
	type SortableModifier,
	type SortableStrategy
} from '$lib/components/ui/sortable/index.js';

import {
	closestCenterAmong,
	filterByDirection,
	getFirstCollision,
	pointerWithin,
	rectIntersection,
	resolveKanbanArrowTarget,
	type KanbanDroppable
} from './kanban-collision.js';
import Harness, {
	KANBAN_HARNESS_COLUMNS,
	type KanbanHarnessProps,
	type KanbanHarnessRefs,
	type KanbanHarnessValue
} from './kanban.test.svelte';

// ---------------------------------------------------------------------------
// Helpers
//
// Elements are located by `data-slot` rather than by role: a column or item is only a
// `role="button"` when it is the activator, and the overlay is portalled outside the render
// container entirely.
// ---------------------------------------------------------------------------

function rectOf(left: number, top: number, width: number, height: number): ClientRect {
	return { left, top, width, height, right: left + width, bottom: top + height };
}

function bySlot(root: ParentNode, slot: string): HTMLElement {
	const element = root.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function allBySlot(root: ParentNode, slot: string): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`));
}

function maybeBySlot(root: ParentNode, slot: string): HTMLElement | null {
	return root.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
}

function columnFor(container: HTMLElement, value: string): HTMLElement {
	const column = container.querySelector<HTMLElement>(
		`[data-slot="kanban-column"][data-value="${value}"]`
	);
	if (!column) throw new Error(`no kanban column with value "${value}" was rendered`);
	return column;
}

function itemFor(container: HTMLElement, value: string): HTMLElement {
	const item = container.querySelector<HTMLElement>(
		`[data-slot="kanban-item"][data-value="${value}"]`
	);
	if (!item) throw new Error(`no kanban item with value "${value}" was rendered`);
	return item;
}

/** The rendered column order, which is `Object.keys(value)`. */
function columnValues(container: HTMLElement): string[] {
	return allBySlot(container, 'kanban-column').map(
		(column) => column.getAttribute('data-value') ?? ''
	);
}

/** The rendered item order inside one column. */
function itemValues(container: HTMLElement, column: string): string[] {
	return allBySlot(columnFor(container, column), 'kanban-item').map(
		(item) => item.getAttribute('data-value') ?? ''
	);
}

/** The whole board as the harness renders it — the DOM counterpart of `value`. */
function boardOrder(container: HTMLElement): Record<string, string[]> {
	return Object.fromEntries(
		columnValues(container).map((column) => [column, itemValues(container, column)])
	);
}

function liveText(container: HTMLElement): string {
	return bySlot(container, 'kanban-live-region').textContent?.trim() ?? '';
}

function instructionsText(container: HTMLElement): string {
	return bySlot(container, 'kanban-instructions').textContent?.trim() ?? '';
}

function overlayElement(): HTMLElement | null {
	return maybeBySlot(document.body, 'kanban-overlay');
}

function asDomRect(rect: ClientRect): DOMRect {
	return { ...rect, x: rect.left, y: rect.top, toJSON: () => rect } as DOMRect;
}

/** jsdom performs no layout, so geometry-dependent cases install their own boxes. */
function stubRect(element: Element, rect: ClientRect): void {
	vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(asDomRect(rect));
}

/**
 * Like {@link stubRects}, but every box is derived from where the element sits in the DOM *now*, so
 * a reorder genuinely moves it. The layout animation is measured geometry — a frozen box reports the
 * same rect before and after a reorder, which is a zero delta and therefore no animation at all.
 */
function stubLiveRects(container: HTMLElement): void {
	stubRect(bySlot(container, 'kanban-board'), rectOf(0, 0, 900, 400));

	const columnIndexOf = (column: HTMLElement) =>
		allBySlot(container, 'kanban-column').indexOf(column);

	for (const column of allBySlot(container, 'kanban-column')) {
		vi.spyOn(column, 'getBoundingClientRect').mockImplementation(() =>
			asDomRect(rectOf(columnIndexOf(column) * 300, 0, 300, 400))
		);
	}

	for (const item of allBySlot(container, 'kanban-item')) {
		vi.spyOn(item, 'getBoundingClientRect').mockImplementation(() => {
			const owner = item.closest('[data-slot="kanban-column"]');
			if (!(owner instanceof HTMLElement)) return asDomRect(rectOf(0, 0, 0, 0));
			const left = columnIndexOf(owner) * 300 + 10;
			return asDomRect(
				rectOf(left, 50 + allBySlot(owner, 'kanban-item').indexOf(item) * 70, 280, 60)
			);
		});
	}
}

/**
 * Three 300 px columns side by side, each holding 60 px cards stacked 70 px apart.
 *
 * `mirrored` lays the same columns out right to left, which is what a real `dir="rtl"` board does
 * and what makes "the drag that went right now goes left" a geometric assertion.
 */
function stubRects(container: HTMLElement, options: { mirrored?: boolean } = {}): void {
	stubRect(bySlot(container, 'kanban-board'), rectOf(0, 0, 900, 400));

	const columns = allBySlot(container, 'kanban-column');
	columns.forEach((column, index) => {
		const slot = options.mirrored ? columns.length - 1 - index : index;
		const left = slot * 300;
		stubRect(column, rectOf(left, 0, 300, 400));
		allBySlot(column, 'kanban-item').forEach((item, itemIndex) => {
			stubRect(item, rectOf(left + 10, 50 + itemIndex * 70, 280, 60));
		});
	});
}

type Driver = ReturnType<typeof userEvent.setup>;

function renderHarness(props: KanbanHarnessProps = {}) {
	return render(Harness, { props });
}

async function press(user: Driver, target: HTMLElement, x: number, y: number): Promise<void> {
	await user.pointer({ keys: '[MouseLeft>]', target, coords: { clientX: x, clientY: y } });
}

/**
 * Moves are dispatched on `document.body` rather than on the dragged element: a cross-column commit
 * re-creates that element in another `{#each}` block, and a detached node's events never reach the
 * engine's document listeners.
 */
async function movePointer(user: Driver, x: number, y: number): Promise<void> {
	await user.pointer({ target: document.body, coords: { clientX: x, clientY: y } });
}

async function release(user: Driver): Promise<void> {
	await user.pointer({ keys: '[/MouseLeft]', target: document.body });
}

/** Focus an activator and pick it up with the keyboard. */
async function grab(user: Driver, activator: HTMLElement): Promise<void> {
	activator.focus();
	await user.keyboard(' ');
}

/** The element a column drag starts from: its handle when there is one, else the column. */
function columnActivator(container: HTMLElement, value: string): HTMLElement {
	const column = columnFor(container, value);
	return maybeBySlot(column, 'kanban-column-handle') ?? column;
}

/** The element an item drag starts from: its handle when there is one, else the item. */
function itemActivator(container: HTMLElement, value: string): HTMLElement {
	const item = itemFor(container, value);
	return maybeBySlot(item, 'kanban-item-handle') ?? item;
}

function droppable(
	id: string,
	rect: ClientRect,
	extra: Partial<KanbanDroppable> = {}
): KanbanDroppable {
	return { id, rect, isColumn: false, isEmpty: false, disabled: false, columnId: null, ...extra };
}

// ---------------------------------------------------------------------------
// T006 — collision and keyboard geometry (pure, no DOM, no render)
// ---------------------------------------------------------------------------

describe('kanban-collision: pointerWithin (T006)', () => {
	const droppables = [
		{ id: 'todo', rect: rectOf(0, 0, 300, 400) },
		{ id: 'a', rect: rectOf(10, 50, 280, 60) },
		{ id: 'b', rect: rectOf(10, 120, 280, 60) }
	];

	it('keeps only the droppables the pointer is inside', () => {
		const hits = pointerWithin({ x: 150, y: 150 }, droppables);
		expect(hits.map((hit) => hit.id)).toEqual(['b', 'todo']);
	});

	it('ranks the tightest box around the pointer first', () => {
		const [nearest] = pointerWithin({ x: 150, y: 80 }, droppables);
		expect(nearest.id).toBe('a');
	});

	it('reports no hit at all when the pointer is outside every box', () => {
		expect(pointerWithin({ x: 2000, y: 2000 }, droppables)).toEqual([]);
	});
});

describe('kanban-collision: rectIntersection (T006)', () => {
	const droppables = [
		{ id: 'a', rect: rectOf(0, 0, 100, 100) },
		{ id: 'b', rect: rectOf(50, 0, 100, 100) },
		{ id: 'c', rect: rectOf(400, 0, 100, 100) }
	];

	it('ranks droppables by overlap area, largest first', () => {
		const hits = rectIntersection(rectOf(40, 0, 100, 100), droppables);
		expect(hits.map((hit) => hit.id)).toEqual(['b', 'a']);
	});

	it('reports the overlap area it ranked on', () => {
		const [nearest] = rectIntersection(rectOf(50, 0, 100, 100), droppables);
		expect(nearest).toEqual({ id: 'b', value: 10000 });
	});

	it('drops droppables that only touch along an edge', () => {
		expect(rectIntersection(rectOf(100, 0, 10, 100), [droppables[0]])).toEqual([]);
	});
});

describe('kanban-collision: getFirstCollision and closestCenterAmong (T006)', () => {
	it('returns the identifier of the best-ranked collision', () => {
		expect(
			getFirstCollision([
				{ id: 'b', value: 3 },
				{ id: 'a', value: 1 }
			])
		).toBe('b');
	});

	it('returns null when nothing collided', () => {
		expect(getFirstCollision([])).toBeNull();
	});

	it('picks the nearest centre among the candidates', () => {
		const candidates = [
			{ id: 'a', rect: rectOf(0, 0, 100, 100) },
			{ id: 'b', rect: rectOf(0, 200, 100, 100) }
		];
		expect(closestCenterAmong(rectOf(0, 150, 100, 100), candidates)).toBe('b');
	});

	it('returns null when there is no candidate to rank', () => {
		expect(closestCenterAmong(rectOf(0, 0, 10, 10), [])).toBeNull();
	});
});

describe('kanban-collision: filterByDirection (T006)', () => {
	const collisionRect = rectOf(100, 100, 100, 100);
	const candidates = [
		droppable('above', rectOf(100, 0, 100, 100)),
		droppable('below', rectOf(100, 200, 100, 100)),
		droppable('left', rectOf(0, 100, 100, 100)),
		droppable('right', rectOf(200, 100, 100, 100))
	];

	it.each([
		['ArrowUp', ['above']],
		['ArrowDown', ['below']],
		['ArrowLeft', ['left']],
		['ArrowRight', ['right']]
	] as const)('keeps only the candidates %s can reach', (key, expected) => {
		expect(filterByDirection(key, collisionRect, candidates).map((entry) => entry.id)).toEqual(
			expected
		);
	});
});

describe('kanban-collision: resolveKanbanArrowTarget (T006)', () => {
	const board = {
		todo: droppable('todo', rectOf(0, 0, 300, 400), { isColumn: true, columnId: 'todo' }),
		doing: droppable('doing', rectOf(300, 0, 300, 400), { isColumn: true, columnId: 'doing' }),
		done: droppable('done', rectOf(600, 0, 300, 400), {
			isColumn: true,
			isEmpty: true,
			columnId: 'done'
		}),
		a: droppable('a', rectOf(10, 50, 280, 60), { columnId: 'todo' }),
		b: droppable('b', rectOf(10, 120, 280, 60), { columnId: 'todo' }),
		c: droppable('c', rectOf(10, 190, 280, 60), { columnId: 'todo' }),
		d: droppable('d', rectOf(310, 50, 280, 60), { columnId: 'doing' })
	};
	const droppables = Object.values(board);

	function resolve(
		key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
		overrides: Partial<Parameters<typeof resolveKanbanArrowTarget>[0]> = {}
	) {
		return resolveKanbanArrowTarget({
			key,
			dir: 'ltr',
			activeId: 'a',
			activeIsColumn: false,
			collisionRect: board.a.rect,
			droppables,
			...overrides
		});
	}

	it('moves an item to its neighbour in the same column', () => {
		expect(resolve('ArrowDown')).toBe('b');
	});

	it('moves an item into the next column', () => {
		expect(resolve('ArrowRight')).toBe('d');
	});

	it('moves an item into an empty column', () => {
		expect(resolve('ArrowRight', { collisionRect: rectOf(310, 50, 280, 60) })).toBe('done');
	});

	it('never targets a populated column while an item is dragged', () => {
		expect(resolve('ArrowRight')).not.toBe('doing');
	});

	it('moves a column to the next column, never to an item', () => {
		expect(
			resolve('ArrowRight', {
				activeId: 'todo',
				activeIsColumn: true,
				collisionRect: board.todo.rect
			})
		).toBe('doing');
	});

	it('skips a disabled candidate instead of aborting the whole resolution', () => {
		const disabled = droppables.map((entry) =>
			entry.id === 'b' ? { ...entry, disabled: true } : entry
		);
		expect(resolve('ArrowDown', { droppables: disabled })).toBe('c');
	});

	it('never resolves to the dragged identifier itself', () => {
		expect(resolve('ArrowUp', { activeId: 'b', collisionRect: board.b.rect })).toBe('a');
	});

	it('returns null when nothing lies the way the key points', () => {
		expect(resolve('ArrowDown', { activeId: 'c', collisionRect: board.c.rect })).toBeNull();
	});

	it('inverts ArrowLeft and ArrowRight under rtl', () => {
		expect(resolve('ArrowLeft', { dir: 'rtl' })).toBe('d');
		expect(resolve('ArrowRight', { dir: 'rtl' })).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// T007 — rendering, roles, ARIA and data attributes
// ---------------------------------------------------------------------------

describe('Kanban accessibility wiring (T007)', () => {
	it('renders a data-slot on every part', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ withItemHandle: true, withOverlay: true });

		expect(bySlot(container, 'kanban-board')).toBeInTheDocument();
		expect(allBySlot(container, 'kanban-column')).toHaveLength(3);
		expect(allBySlot(container, 'kanban-column-handle')).toHaveLength(3);
		expect(allBySlot(container, 'kanban-item')).toHaveLength(4);
		expect(allBySlot(container, 'kanban-item-handle')).toHaveLength(4);
		expect(bySlot(container, 'kanban-live-region')).toBeInTheDocument();
		expect(bySlot(container, 'kanban-instructions')).toBeInTheDocument();

		stubRects(container);
		await grab(user, itemActivator(container, 'a'));
		expect(overlayElement()).not.toBeNull();
	});

	it.each(['horizontal', 'vertical'] as const)(
		'exposes the %s orientation on the board',
		(orientation) => {
			const { container } = renderHarness({ orientation });
			const board = bySlot(container, 'kanban-board');

			expect(board).toHaveAttribute('data-orientation', orientation);
			expect(board).toHaveAttribute('aria-orientation', orientation);
		}
	);

	it('puts the draggable attribute set on the item when it is the activator', () => {
		const { container } = renderHarness({ itemAsHandle: true });
		const item = itemFor(container, 'a');

		expect(item).toHaveAttribute('role', 'button');
		expect(item).toHaveAttribute('tabindex', '0');
		expect(item).toHaveAttribute('aria-roledescription', 'draggable');
		expect(item).toHaveAttribute('aria-describedby', bySlot(container, 'kanban-instructions').id);
	});

	it('puts the draggable attribute set on the column when it is the activator', () => {
		const { container } = renderHarness({ columnAsHandle: true, withColumnHandle: false });
		const column = columnFor(container, 'todo');

		expect(column).toHaveAttribute('role', 'button');
		expect(column).toHaveAttribute('aria-roledescription', 'draggable');
		expect(column).toHaveAttribute('aria-describedby', bySlot(container, 'kanban-instructions').id);
	});

	it('puts the draggable attribute set on the handles instead, and not on the item', () => {
		const { container } = renderHarness({ itemAsHandle: false, withItemHandle: true });
		const item = itemFor(container, 'a');
		const handle = bySlot(item, 'kanban-item-handle');

		expect(item).not.toHaveAttribute('role');
		expect(item).not.toHaveAttribute('aria-roledescription');
		expect(handle).toHaveAttribute('aria-roledescription', 'draggable');
		expect(handle).toHaveAttribute('aria-describedby', bySlot(container, 'kanban-instructions').id);
	});

	it('carries no redundant role on a handle, only on a div activator', () => {
		const { container } = renderHarness({ withItemHandle: true, columnAsHandle: true });
		const column = columnFor(container, 'todo');
		const item = itemFor(container, 'a');

		// The `<button>` handles are already buttons, so `role` would be redundant (research R-11).
		expect(bySlot(column, 'kanban-column-handle')).not.toHaveAttribute('role');
		expect(bySlot(item, 'kanban-item-handle')).not.toHaveAttribute('role');
		// The `<div>` activators do need it.
		expect(column).toHaveAttribute('role', 'button');
		expect(item).toHaveAttribute('role', 'button');
	});

	it('marks a disabled column and item activator and takes it out of the tab order', () => {
		const { container } = renderHarness({
			columnAsHandle: true,
			withColumnHandle: false,
			itemAsHandle: true,
			disabledColumns: ['todo'],
			disabledItems: ['a']
		});
		const column = columnFor(container, 'todo');
		const item = itemFor(container, 'a');

		expect(column).toHaveAttribute('aria-disabled', 'true');
		expect(column).not.toHaveAttribute('tabindex');
		expect(item).toHaveAttribute('aria-disabled', 'true');
		expect(item).not.toHaveAttribute('tabindex');

		// An enabled sibling keeps the tab stop and carries no `aria-disabled` at all.
		expect(columnFor(container, 'doing')).not.toHaveAttribute('aria-disabled');
		expect(columnFor(container, 'doing')).toHaveAttribute('tabindex', '0');
		expect(itemFor(container, 'b')).not.toHaveAttribute('aria-disabled');
		expect(itemFor(container, 'b')).toHaveAttribute('tabindex', '0');
	});

	it('marks a disabled handle and takes it out of the tab order', () => {
		const disabled = renderHarness({
			withItemHandle: true,
			columnHandleDisabled: true,
			itemHandleDisabled: true
		});
		const disabledColumnHandle = bySlot(
			columnFor(disabled.container, 'todo'),
			'kanban-column-handle'
		);
		const disabledItemHandle = bySlot(itemFor(disabled.container, 'a'), 'kanban-item-handle');

		expect(disabledColumnHandle).toHaveAttribute('aria-disabled', 'true');
		expect(disabledColumnHandle).not.toHaveAttribute('tabindex');
		expect(disabledItemHandle).toHaveAttribute('aria-disabled', 'true');
		expect(disabledItemHandle).not.toHaveAttribute('tabindex');

		const enabled = renderHarness({ withItemHandle: true });
		const enabledItemHandle = bySlot(itemFor(enabled.container, 'a'), 'kanban-item-handle');

		expect(enabledItemHandle).not.toHaveAttribute('aria-disabled');
		expect(enabledItemHandle).toHaveAttribute('tabindex', '0');
	});

	it('points each handle at the column or item it controls', () => {
		const { container } = renderHarness({ withItemHandle: true });
		const column = columnFor(container, 'todo');
		const item = itemFor(container, 'a');

		expect(bySlot(column, 'kanban-column-handle')).toHaveAttribute('aria-controls', column.id);
		expect(bySlot(item, 'kanban-item-handle')).toHaveAttribute('aria-controls', item.id);
	});

	it('marks the activator pressed while dragging and releases it on drop', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);
		const activator = itemActivator(container, 'a');

		await grab(user, activator);
		expect(activator).toHaveAttribute('aria-pressed', 'true');

		await user.keyboard(' ');
		expect(itemActivator(container, 'a')).not.toHaveAttribute('aria-pressed');
	});

	it('renders an assertive live region and the upfront instructions', () => {
		const { container } = renderHarness();
		const live = bySlot(container, 'kanban-live-region');

		expect(live).toHaveAttribute('role', 'status');
		expect(live).toHaveAttribute('aria-live', 'assertive');
		expect(live).toHaveAttribute('aria-atomic', 'true');
		expect(instructionsText(container)).toBe(
			'To pick up a kanban item or column, press space or enter. While dragging, use the arrow keys to move the item. Press space or enter again to drop the item in its new position, or press escape to cancel.'
		);
	});

	it('exposes data-value on every column and item', () => {
		const { container } = renderHarness();

		expect(columnValues(container)).toEqual(['todo', 'doing', 'done']);
		expect(itemValues(container, 'todo')).toEqual(['a', 'b', 'c']);
	});

	it('omits data-disabled entirely while a column and its handle are enabled', () => {
		const { container } = renderHarness();
		const column = columnFor(container, 'todo');

		expect(column).not.toHaveAttribute('data-disabled');
		expect(bySlot(column, 'kanban-column-handle')).not.toHaveAttribute('data-disabled');
	});

	it('marks a disabled column and its handle without writing "false"', () => {
		const { container } = renderHarness({ disabledColumns: ['todo'] });
		const column = columnFor(container, 'todo');

		expect(column).toHaveAttribute('data-disabled', '');
		expect(bySlot(column, 'kanban-column-handle')).toHaveAttribute('data-disabled', '');
		expect(columnFor(container, 'doing')).not.toHaveAttribute('data-disabled');
	});

	it('marks a disabled item and its handle without writing "false"', () => {
		const { container } = renderHarness({ withItemHandle: true, disabledItems: ['a'] });
		const item = itemFor(container, 'a');

		expect(item).toHaveAttribute('data-disabled', '');
		expect(bySlot(item, 'kanban-item-handle')).toHaveAttribute('data-disabled', '');
		expect(itemFor(container, 'b')).not.toHaveAttribute('data-disabled');
	});

	it('flags the dragged item and its handle for the duration of a keyboard drag', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ itemAsHandle: false, withItemHandle: true });
		stubRects(container);

		expect(itemFor(container, 'a')).not.toHaveAttribute('data-dragging');

		await grab(user, itemActivator(container, 'a'));
		expect(itemFor(container, 'a')).toHaveAttribute('data-dragging', '');
		expect(bySlot(itemFor(container, 'a'), 'kanban-item-handle')).toHaveAttribute(
			'data-dragging',
			''
		);

		await user.keyboard('{Escape}');
		expect(itemFor(container, 'a')).not.toHaveAttribute('data-dragging');
	});

	it('flags the dragged column and its handle for the duration of a pointer drag', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);
		const handle = columnActivator(container, 'todo');

		await press(user, handle, 20, 20);
		await movePointer(user, 320, 20);

		expect(columnFor(container, 'todo')).toHaveAttribute('data-dragging', '');
		expect(handle).toHaveAttribute('data-dragging', '');

		await release(user);
		expect(columnFor(container, 'todo')).not.toHaveAttribute('data-dragging');
	});
});

// ---------------------------------------------------------------------------
// T008 — props
// ---------------------------------------------------------------------------

describe('Kanban props (T008)', () => {
	it('lays the board out along the configured axis', () => {
		const horizontal = renderHarness({ orientation: 'horizontal' });
		expect(bySlot(horizontal.container, 'kanban-board').className).toContain('flex-row');

		const vertical = renderHarness({ orientation: 'vertical' });
		expect(bySlot(vertical.container, 'kanban-board').className).toContain('flex-col');
	});

	it('resolves object items through getItemValue', () => {
		const { container } = renderHarness();
		expect(itemValues(container, 'doing')).toEqual(['d']);
	});

	it('uses the items themselves as identifiers for primitive arrays', () => {
		const { container } = renderHarness({ mode: 'primitive' });
		expect(itemValues(container, 'todo')).toEqual(['a', 'b', 'c']);
	});

	it('runs the supplied modifiers over the drag transform', async () => {
		const user = userEvent.setup();
		const modifier = vi.fn<SortableModifier>(() => ({ x: 7, y: 9 }));
		const { container } = renderHarness({ modifiers: [modifier] });
		stubRects(container);
		const item = itemFor(container, 'a');

		await press(user, item, 150, 80);
		await movePointer(user, 150, 150);

		expect(modifier).toHaveBeenCalled();
		expect(itemFor(container, 'a').getAttribute('style')).toContain('translate3d(7px, 9px, 0)');
		await release(user);
	});

	it('accepts strategy as the documented no-op it is upstream', async () => {
		const user = userEvent.setup();
		const strategy = vi.fn<SortableStrategy>(() => ({ x: 1, y: 1 }));
		let supplied: SortableStrategy | undefined;
		const { container } = renderHarness({ strategy, onStrategy: (next) => (supplied = next) });
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');

		// Published on the context for a consumer to read, and applied to nothing.
		expect(supplied).toBe(strategy);
		expect(strategy).not.toHaveBeenCalled();
		expect(itemValues(container, 'todo')).toEqual(['b', 'a', 'c']);
	});

	it('defaults strategy to verticalListSortingStrategy on the context', () => {
		let reported: SortableStrategy | undefined;
		renderHarness({ onStrategy: (next) => (reported = next) });

		expect(reported).toBe(verticalListSortingStrategy);
	});

	it('flags a flat cursor on every part and swaps the cursor classes', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({
			flatCursor: true,
			withItemHandle: true,
			withOverlay: true
		});
		stubRects(container);
		const column = columnFor(container, 'todo');
		const item = itemFor(container, 'a');

		expect(column).toHaveAttribute('data-flat-cursor', '');
		expect(item).toHaveAttribute('data-flat-cursor', '');
		expect(bySlot(column, 'kanban-column-handle')).toHaveAttribute('data-flat-cursor', '');
		expect(bySlot(item, 'kanban-item-handle')).toHaveAttribute('data-flat-cursor', '');
		expect(item.className).toContain('cursor-default');
		expect(item.className).not.toContain('cursor-grab');

		await grab(user, itemActivator(container, 'a'));
		expect(overlayElement()).toHaveAttribute('data-flat-cursor', '');
	});

	it('keeps the grab affordance when flatCursor is off', () => {
		const { container } = renderHarness();
		const item = itemFor(container, 'a');

		expect(item).not.toHaveAttribute('data-flat-cursor');
		expect(item.className).toContain('cursor-grab');
	});

	it('makes the column its own activator under asHandle', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ columnAsHandle: true, withColumnHandle: false });
		stubRects(container);

		await grab(user, columnFor(container, 'todo'));
		expect(liveText(container)).toBe('Picked up column at position 1 of 3');
	});

	it('honours an explicit disabled on each handle', () => {
		const { container } = renderHarness({
			withItemHandle: true,
			columnHandleDisabled: true,
			itemHandleDisabled: true
		});

		expect(bySlot(columnFor(container, 'todo'), 'kanban-column-handle')).toBeDisabled();
		expect(bySlot(itemFor(container, 'a'), 'kanban-item-handle')).toBeDisabled();
	});

	it('merges the caller class last and spreads restProps onto the element', () => {
		const { container } = renderHarness({
			boardClass: 'board-class',
			columnClass: 'column-class',
			itemClass: 'item-class'
		});
		const board = bySlot(container, 'kanban-board');

		expect(board).toHaveAttribute('data-testid', 'board');
		expect(board.className.endsWith('board-class')).toBe(true);
		expect(columnFor(container, 'todo').className.endsWith('column-class')).toBe(true);
		expect(itemFor(container, 'a').className.endsWith('item-class')).toBe(true);
	});

	it('keeps the caller style after the drag transform', () => {
		const { container } = renderHarness({ itemStyle: 'outline: 1px solid red;' });
		expect(itemFor(container, 'a').getAttribute('style')).toContain('outline: 1px solid red;');
	});

	it('binds every ref through bind:this', () => {
		let refs: KanbanHarnessRefs | undefined;
		renderHarness({ withItemHandle: true, onRefs: (next) => (refs = next) });

		expect(refs?.board).toBeInstanceOf(HTMLDivElement);
		expect(refs?.column).toBeInstanceOf(HTMLDivElement);
		expect(refs?.columnHandle).toBeInstanceOf(HTMLButtonElement);
		expect(refs?.item).toBeInstanceOf(HTMLDivElement);
		expect(refs?.itemHandle).toBeInstanceOf(HTMLButtonElement);
	});

	it('hands the child snippet the merged props, registration attachment included', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ itemAsChild: true });
		const child = container.querySelector<HTMLElement>('[data-testid="item-child"]');

		expect(child).toHaveAttribute('data-slot', 'kanban-item');
		expect(child).toHaveAttribute('data-value', 'a');

		stubRects(container);
		await grab(user, itemFor(container, 'a'));

		// Registered and draggable purely through the spread props, with no `bind:this`.
		expect(liveText(container)).toBe('Picked up item at position 1 of 3');
		expect(itemFor(container, 'a')).toHaveAttribute('data-dragging', '');
	});

	it('hands the column child snippet the merged props, registration attachment included', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ columnAsChild: true, columnAsHandle: true });
		const child = container.querySelector<HTMLElement>('[data-testid="column-child"]');

		expect(child).toHaveAttribute('data-slot', 'kanban-column');
		expect(child).toHaveAttribute('data-value', 'todo');

		stubRects(container);
		await grab(user, columnFor(container, 'todo'));

		// Registered and draggable purely through the spread props, with no `bind:this`.
		expect(liveText(container)).toBe('Picked up column at position 1 of 3');
		expect(columnFor(container, 'todo')).toHaveAttribute('data-dragging', '');
	});

	it('hands each handle child snippet the merged props', () => {
		const { container } = renderHarness({
			withItemHandle: true,
			columnHandleAsChild: true,
			itemHandleAsChild: true
		});

		expect(container.querySelector('[data-testid="column-handle-child"]')).toHaveAttribute(
			'data-slot',
			'kanban-column-handle'
		);
		expect(container.querySelector('[data-testid="item-handle-child"]')).toHaveAttribute(
			'data-slot',
			'kanban-item-handle'
		);
	});
});

// ---------------------------------------------------------------------------
// T009 — guard rails and edge cases
// ---------------------------------------------------------------------------

describe('Kanban guard rails (T009)', () => {
	it.each([
		['bare-board', /`<Kanban.Board>` must be used within `<Kanban>`/],
		['bare-overlay', /`<Kanban.Overlay>` must be used within `<Kanban>`/],
		['bare-column', /within/],
		['bare-item', /within/],
		['bare-column-handle', /`<Kanban.ColumnHandle>` must be used within `<Kanban.Column>`/],
		['bare-item-handle', /`<Kanban.ItemHandle>` must be used within `<Kanban.Item>`/]
	] as const)('throws when %s is rendered outside its provider', (mode, message) => {
		expect(() => renderHarness({ mode })).toThrow(message);
	});

	it('throws when a column is rendered outside the board and the overlay', () => {
		expect(() => renderHarness({ mode: 'column-outside-board' })).toThrow(
			/`<Kanban.Column>` must be used within `<Kanban.Board>` or `<Kanban.Overlay>`/
		);
	});

	it('throws when an item is rendered outside the board and the overlay', () => {
		expect(() => renderHarness({ mode: 'item-outside-board' })).toThrow(
			/`<Kanban.Item>` must be used within `<Kanban.Board>` or `<Kanban.Overlay>`/
		);
	});

	it('throws on an empty-string column value', () => {
		expect(() => renderHarness({ mode: 'empty-column-value' })).toThrow(/empty string/);
	});

	it('throws on an empty-string item value', () => {
		expect(() => renderHarness({ mode: 'empty-item-value' })).toThrow(/empty string/);
	});

	it('throws when object items are used without getItemValue', () => {
		expect(() => renderHarness({ mode: 'object-without-getter' })).toThrow(/getItemValue/);
	});

	it('refuses to pick a disabled item up by pointer or keyboard', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ disabledItems: ['a'] });
		stubRects(container);
		const item = itemFor(container, 'a');

		await grab(user, item);
		expect(liveText(container)).toBe('');

		await press(user, item, 150, 80);
		await movePointer(user, 150, 150);
		expect(liveText(container)).toBe('');
		await release(user);

		// A sibling in the same column still works.
		await grab(user, itemActivator(container, 'b'));
		expect(liveText(container)).toBe('Picked up item at position 2 of 3');
	});

	it('refuses to pick a disabled column up', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ disabledColumns: ['todo'] });
		stubRects(container);

		await grab(user, columnActivator(container, 'todo'));
		expect(liveText(container)).toBe('');

		await grab(user, columnActivator(container, 'doing'));
		expect(liveText(container)).toBe('Picked up column at position 2 of 3');
	});

	it('never resolves a disabled item as a drop target', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ disabledItems: ['b'] });
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowDown}');

		// `b` sits directly below `a`, so skipping it is only possible because it is disabled.
		expect(itemValues(container, 'todo')).toEqual(['b', 'c', 'a']);
	});

	it('keeps a column that was emptied mid-drag a valid drop target', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		// `doing` holds only `d`; move it out and the column is left empty but still rendered.
		await grab(user, itemActivator(container, 'd'));
		await user.keyboard('{ArrowRight}');
		await user.keyboard(' ');
		expect(boardOrder(container)).toEqual({ todo: ['a', 'b', 'c'], doing: [], done: ['d'] });

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowRight}');
		await user.keyboard(' ');
		expect(boardOrder(container)).toEqual({ todo: ['b', 'c'], doing: ['a'], done: ['d'] });
	});
});

// ---------------------------------------------------------------------------
// T010 — keyboard, cross-column movement and announcements
// ---------------------------------------------------------------------------

describe('Kanban keyboard interaction (T010)', () => {
	it.each([' ', '{Enter}'] as const)('picks an item up with "%s"', async (key) => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		itemActivator(container, 'b').focus();
		await user.keyboard(key);

		expect(liveText(container)).toBe('Picked up item at position 2 of 3');
	});

	it.each([' ', '{Enter}'] as const)('picks a column up with "%s"', async (key) => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		columnActivator(container, 'doing').focus();
		await user.keyboard(key);

		expect(liveText(container)).toBe('Picked up column at position 2 of 3');
	});

	it('moves an item within its column and announces the new position', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowDown}');

		expect(itemValues(container, 'todo')).toEqual(['b', 'a', 'c']);
		expect(liveText(container)).toBe('item is now at position 2 of 3');
	});

	it('moves an item back up again', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await grab(user, itemActivator(container, 'c'));
		await user.keyboard('{ArrowUp}');

		expect(itemValues(container, 'todo')).toEqual(['a', 'c', 'b']);
		expect(liveText(container)).toBe('item is now at position 2 of 3');
	});

	it.each(['horizontal', 'vertical'] as const)(
		'moves an item into the adjacent column with ArrowRight under %s orientation',
		async (orientation) => {
			const user = userEvent.setup();
			const { container } = renderHarness({ orientation });
			stubRects(container);

			await grab(user, itemActivator(container, 'a'));
			await user.keyboard('{ArrowRight}');

			expect(boardOrder(container)).toEqual({ todo: ['b', 'c'], doing: ['d', 'a'], done: [] });
			expect(liveText(container)).toBe('item is now at position 2 of 2 in doing');
		}
	);

	it('moves an item on into an empty column', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowRight}{ArrowRight}');

		expect(boardOrder(container)).toEqual({ todo: ['b', 'c'], doing: ['d'], done: ['a'] });
		expect(liveText(container)).toBe('item is now at position 1 of 1 in done');
	});

	it('moves an item back to the left again', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await grab(user, itemActivator(container, 'd'));
		await user.keyboard('{ArrowLeft}');

		expect(boardOrder(container).todo).toEqual(['a', 'b', 'c', 'd']);
		expect(liveText(container)).toBe('item is now at position 4 of 4 in todo');
	});

	it('moves a column and announces its new position', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await grab(user, columnActivator(container, 'todo'));
		await user.keyboard('{ArrowRight}');

		expect(liveText(container)).toBe('column is now at position 2 of 3');
		// A column reorder is only committed on drop.
		expect(columnValues(container)).toEqual(['todo', 'doing', 'done']);
	});

	it.each([' ', '{Enter}'] as const)('drops and commits with "%s"', async (key) => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await grab(user, columnActivator(container, 'todo'));
		await user.keyboard('{ArrowRight}');
		await user.keyboard(key);

		expect(columnValues(container)).toEqual(['doing', 'todo', 'done']);
		expect(itemValues(container, 'todo')).toEqual(['a', 'b', 'c']);
		expect(liveText(container)).toBe('column was dropped at position 2 of 3');
	});

	it('announces the destination column when an item is dropped after changing column', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowRight}');
		await user.keyboard(' ');

		expect(liveText(container)).toBe('item was dropped at position 2 of 2 in doing');
	});

	it('cancels with Escape, committing nothing', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await grab(user, columnActivator(container, 'todo'));
		await user.keyboard('{ArrowRight}');
		await user.keyboard('{Escape}');

		expect(columnValues(container)).toEqual(['todo', 'doing', 'done']);
		expect(liveText(container)).toBe('Dragging was cancelled. column was dropped.');
	});

	it('restores the original order when a same-column keyboard drag is cancelled', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowDown}');
		// `onDragOver` already committed the reorder, so the cancel has something to undo.
		expect(itemValues(container, 'todo')).toEqual(['b', 'a', 'c']);

		await user.keyboard('{Escape}');

		expect(itemValues(container, 'todo')).toEqual(['a', 'b', 'c']);
		expect(liveText(container)).toBe('Dragging was cancelled. item was dropped.');
	});

	it('restores the source column when a cross-column pointer drag is cancelled', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await press(user, itemFor(container, 'a'), 150, 80);
		await movePointer(user, 450, 80);
		expect(boardOrder(container)).toEqual({ todo: ['b', 'c'], doing: ['d', 'a'], done: [] });

		await user.keyboard('{Escape}');

		expect(boardOrder(container)).toEqual({ todo: ['a', 'b', 'c'], doing: ['d'], done: [] });
		await release(user);
	});

	it('publishes nothing when a cancel has no mid-drag commit to undo', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn<(columns: KanbanHarnessValue) => void>();
		const { container } = renderHarness({ onValueChange });
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{Escape}');

		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('swallows Tab while dragging so focus cannot leave the grabbed item', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);
		const activator = itemActivator(container, 'a');

		await grab(user, activator);
		await user.keyboard('{Tab}');

		expect(document.activeElement).toBe(activator);
	});

	it('retains focus on the activator across the commit', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');

		expect(document.activeElement).toBe(itemActivator(container, 'a'));
	});

	it('retains focus across a commit that re-creates the element in another column', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowRight}');
		await user.keyboard(' ');

		expect(itemValues(container, 'doing')).toEqual(['d', 'a']);
		expect(document.activeElement).toBe(itemActivator(container, 'a'));
	});

	it('replaces only the overridden announcement builder', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({
			accessibility: { announcements: { onDragStart: () => 'custom pick up' } }
		});
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		expect(liveText(container)).toBe('custom pick up');

		await user.keyboard('{ArrowRight}');
		expect(liveText(container)).toBe('item is now at position 2 of 2 in doing');

		await user.keyboard(' ');
		expect(liveText(container)).toBe('item was dropped at position 2 of 2 in doing');
	});

	it('replaces the instructions text while keeping the describedby wiring', () => {
		const { container } = renderHarness({
			accessibility: { screenReaderInstructions: { draggable: 'custom instructions' } }
		});
		const instructions = bySlot(container, 'kanban-instructions');

		expect(instructionsText(container)).toBe('custom instructions');
		expect(itemFor(container, 'a')).toHaveAttribute('aria-describedby', instructions.id);
	});
});

// ---------------------------------------------------------------------------
// T011 — pointer drags
// ---------------------------------------------------------------------------

describe('Kanban pointer drags (T011)', () => {
	it('reorders inside a column when dragged past a neighbour', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await press(user, itemFor(container, 'a'), 150, 80);
		await movePointer(user, 150, 150);
		await release(user);

		expect(itemValues(container, 'todo')).toEqual(['b', 'a', 'c']);
	});

	it('opens a gap while a column is dragged, before anything is dropped', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await grab(user, columnActivator(container, 'todo'));
		await user.keyboard('{ArrowRight}');

		// Nothing is committed yet: a column reorder only lands on drop, exactly as upstream's
		// `onDragOver` leaves it alone. The movement during the gesture is purely visual.
		expect(columnValues(container)).toEqual(['todo', 'doing', 'done']);
		// The column being crossed has already slid into the slot the dragged one vacated…
		expect(columnFor(container, 'doing').getAttribute('style')).toContain(
			'translate3d(-300px, 0px, 0)'
		);
		expect(columnFor(container, 'doing').getAttribute('style')).toContain('transition: transform');
		// …and the one beyond the target is untouched.
		expect(columnFor(container, 'done').getAttribute('style') ?? '').not.toContain('translate3d');
	});

	it('inverts a displaced sibling, then hands it a transform transition', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubLiveRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowDown}');

		// `a` and `b` swapped, so `b` climbed one 70px slot. FLIP puts it back where it was painted…
		await vi.waitFor(() => {
			expect(itemFor(container, 'b').getAttribute('style')).toContain('translate3d(0px, 70px, 0)');
		});
		// …and the dragged item is never inverted. It carries a transform of its own — the drag one,
		// following the pointer — so the discriminator is the transition, which only FLIP adds.
		expect(itemFor(container, 'a').getAttribute('style') ?? '').not.toContain('transition');

		// …then the offset is released under a transition, which is what makes the move visible.
		await vi.waitFor(() => {
			const style = itemFor(container, 'b').getAttribute('style') ?? '';
			expect(style).toContain('transition: transform');
			expect(style).not.toContain('translate3d');
		});
	});

	it('leaves an undisturbed sibling alone', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubLiveRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowDown}');

		// Only `a` and `b` trade places; `c` keeps its slot and must not be animated.
		await vi.waitFor(() => {
			expect(itemFor(container, 'b').getAttribute('style')).toContain('translate3d');
		});
		expect(itemFor(container, 'c').getAttribute('style') ?? '').not.toContain('translate3d');
	});

	it('holds the order still while the pointer does not move', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await press(user, itemFor(container, 'a'), 150, 80);
		await movePointer(user, 150, 150);

		const settled = itemValues(container, 'todo');
		expect(settled).toEqual(['b', 'a', 'c']);

		// Re-resolving the same pointer position must be a no-op. Committing the reorder used to park
		// the drop target on the dragged identifier, which guaranteed the next resolution differed and
		// swapped the same pair straight back — so the board oscillated on every frame of a held drag
		// and landed wherever the last frame's parity left it.
		for (let frame = 0; frame < 4; frame++) {
			await movePointer(user, 150, 150);
			expect(itemValues(container, 'todo')).toEqual(settled);
		}

		await release(user);
		expect(itemValues(container, 'todo')).toEqual(settled);
	});

	it('commits the cross-column move as soon as the target changes', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await press(user, itemFor(container, 'a'), 150, 80);
		await movePointer(user, 450, 80);

		// Already committed, before the pointer is released.
		expect(boardOrder(container)).toEqual({ todo: ['b', 'c'], doing: ['d', 'a'], done: [] });

		await release(user);
		expect(boardOrder(container)).toEqual({ todo: ['b', 'c'], doing: ['d', 'a'], done: [] });
	});

	it('drops into an empty column', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await press(user, itemFor(container, 'a'), 150, 80);
		await movePointer(user, 750, 200);
		await release(user);

		expect(boardOrder(container)).toEqual({ todo: ['b', 'c'], doing: ['d'], done: ['a'] });
	});

	it('reorders columns when one is dragged by its handle', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await press(user, columnActivator(container, 'todo'), 20, 20);
		await movePointer(user, 320, 20);
		await release(user);

		expect(columnValues(container)).toEqual(['doing', 'todo', 'done']);
		expect(boardOrder(container)).toEqual({ doing: ['d'], todo: ['a', 'b', 'c'], done: [] });
	});

	it('commits nothing when released outside every target', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		stubRects(container);

		await press(user, itemFor(container, 'a'), 150, 80);
		await movePointer(user, 2000, 2000);
		await release(user);

		expect(boardOrder(container)).toEqual({ todo: ['a', 'b', 'c'], doing: ['d'], done: [] });
	});
});

// ---------------------------------------------------------------------------
// T012 — controlled, uncontrolled and the callback surface
// ---------------------------------------------------------------------------

describe('Kanban controlled and uncontrolled state (T012)', () => {
	it('seeds an uncontrolled board from defaultValue and moves it internally', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ valueMode: 'uncontrolled' });
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');

		// The harness renders its own static copy, so the move is observable through the live region.
		expect(liveText(container)).toBe('item was dropped at position 2 of 3');
		expect(itemValues(container, 'todo')).toEqual(['a', 'b', 'c']);
	});

	it('reports every commit through onValueChange when bound', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn<(columns: KanbanHarnessValue) => void>();
		const { container } = renderHarness({ onValueChange });
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');

		expect(onValueChange).toHaveBeenCalledTimes(1);
		expect(Object.keys(onValueChange.mock.calls[0][0])).toEqual(['todo', 'doing', 'done']);
		expect(onValueChange.mock.calls[0][0].todo.map((task) => task.id)).toEqual(['b', 'a', 'c']);
	});

	it('leaves a declining parent authoritative', async () => {
		const user = userEvent.setup();
		const onDeclinedValue = vi.fn<(columns: KanbanHarnessValue) => void>();
		const { container } = renderHarness({ valueMode: 'declined', onDeclinedValue });
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowDown}');

		expect(onDeclinedValue).toHaveBeenCalled();
		expect(onDeclinedValue.mock.calls[0][0].todo.map((task) => task.id)).toEqual(['b', 'a', 'c']);
		// The board never moved, so the announcement still reports the original position.
		expect(liveText(container)).toBe('item is now at position 1 of 3');
		expect(itemValues(container, 'todo')).toEqual(['a', 'b', 'c']);
	});

	it('reflows a same-column drag live and reports the net move to onMove at the drop', async () => {
		const user = userEvent.setup();
		const onMove = vi.fn();
		const onValueChange = vi.fn();
		const { container } = renderHarness({ onMove, onValueChange });
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowDown}');

		// The mid-drag reorder publishes through `onValueChange` unconditionally, never through
		// `onMove` (contract §12) — supplying `onMove` must not cost the consumer the live reflow.
		expect(onValueChange).toHaveBeenCalledTimes(1);
		expect(itemValues(container, 'todo')).toEqual(['b', 'a', 'c']);
		expect(onMove).not.toHaveBeenCalled();

		await user.keyboard(' ');

		// The drop has nothing left to splice, so `onMove` reports the move the drag amounts to:
		// from the index the item was picked up at, to the one it ended on.
		expect(onMove).toHaveBeenCalledWith({
			active: { id: 'a' },
			over: { id: 'b' },
			activeIndex: 0,
			overIndex: 1
		});
		expect(onValueChange).toHaveBeenCalledTimes(1);
		expect(itemValues(container, 'todo')).toEqual(['b', 'a', 'c']);
	});

	it('reports one net move for a run of same-column arrow keys', async () => {
		const user = userEvent.setup();
		const onMove = vi.fn();
		const { container } = renderHarness({ onMove });
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowDown}{ArrowDown}');
		await user.keyboard(' ');

		expect(onMove).toHaveBeenCalledTimes(1);
		expect(onMove).toHaveBeenCalledWith({
			active: { id: 'a' },
			over: { id: 'c' },
			activeIndex: 0,
			overIndex: 2
		});
	});

	it('routes a column drop through onMove instead of committing', async () => {
		const user = userEvent.setup();
		const onMove = vi.fn();
		const { container } = renderHarness({ onMove });
		stubRects(container);

		await grab(user, columnActivator(container, 'todo'));
		await user.keyboard('{ArrowRight}');
		await user.keyboard(' ');

		expect(onMove).toHaveBeenCalledWith({
			active: { id: 'todo' },
			over: { id: 'doing' },
			activeIndex: 0,
			overIndex: 1
		});
		expect(columnValues(container)).toEqual(['todo', 'doing', 'done']);
	});

	it('fires every drag hook at its documented stage for a committing pointer drag', async () => {
		const user = userEvent.setup();
		const onDragStart = vi.fn();
		const onDragMove = vi.fn();
		const onDragOver = vi.fn();
		const onDragEnd = vi.fn();
		const onDragCancel = vi.fn();
		const { container } = renderHarness({
			onDragStart,
			onDragMove,
			onDragOver,
			onDragEnd,
			onDragCancel
		});
		stubRects(container);

		await press(user, itemFor(container, 'a'), 150, 80);
		await movePointer(user, 150, 150);
		await release(user);

		expect(onDragStart).toHaveBeenCalledWith({ active: { id: 'a' }, over: { id: 'a' } });
		expect(onDragMove).toHaveBeenCalled();
		expect(onDragOver).toHaveBeenCalledWith({ active: { id: 'a' }, over: { id: 'b' } });
		// `over` is the drop target the pointer actually ended on, exactly as dnd-kit reports it to
		// upstream's `onDragEnd` — it is never rewritten to the dragged identifier.
		expect(onDragEnd).toHaveBeenCalledWith({ active: { id: 'a' }, over: { id: 'b' } });
		expect(onDragCancel).not.toHaveBeenCalled();
	});

	it('fires onDragCancel and never onDragEnd for a cancelled keyboard drag', async () => {
		const user = userEvent.setup();
		const onDragEnd = vi.fn();
		const onDragCancel = vi.fn();
		const { container } = renderHarness({ onDragEnd, onDragCancel });
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{Escape}');

		expect(onDragCancel).toHaveBeenCalledWith({ active: { id: 'a' }, over: { id: 'a' } });
		expect(onDragEnd).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// T013 — RTL
// ---------------------------------------------------------------------------

describe('Kanban right-to-left (T013)', () => {
	it('inverts ArrowLeft and ArrowRight for a dir prop', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ dir: 'rtl' });
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowLeft}');

		expect(boardOrder(container)).toEqual({ todo: ['b', 'c'], doing: ['d', 'a'], done: [] });
		expect(liveText(container)).toBe('item is now at position 2 of 2 in doing');
	});

	it('inverts the horizontal arrows inherited through DirectionProvider', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ mode: 'rtl-provider', providerDir: 'rtl' });
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowRight}');

		// `ArrowRight` now points at nothing: `todo` is the right-most column in reading order.
		expect(boardOrder(container)).toEqual({ todo: ['a', 'b', 'c'], doing: ['d'], done: [] });
	});

	it('leaves the vertical arrows untouched under rtl', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ dir: 'rtl' });
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		await user.keyboard('{ArrowDown}');

		expect(itemValues(container, 'todo')).toEqual(['b', 'a', 'c']);
	});

	it('follows the mirrored geometry for a pointer drag', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ dir: 'rtl' });
		stubRects(container, { mirrored: true });

		// `todo` now sits on the right, so reaching `doing` means dragging leftwards.
		await press(user, itemFor(container, 'a'), 750, 80);
		await movePointer(user, 450, 80);
		await release(user);

		expect(boardOrder(container)).toEqual({ todo: ['b', 'c'], doing: ['d', 'a'], done: [] });
	});
});

// ---------------------------------------------------------------------------
// T013a — the overlay
// ---------------------------------------------------------------------------

describe('Kanban overlay (T013a)', () => {
	it('renders nothing while no drag is in progress', () => {
		renderHarness({ withOverlay: true });
		expect(overlayElement()).toBeNull();
	});

	it('portals an item preview carrying the active identifier and variant', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ withOverlay: true, dynamicOverlay: true });
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));

		const overlay = overlayElement();
		expect(overlay).toHaveAttribute('data-variant', 'item');
		expect(overlay).toHaveAttribute('data-dragging', '');
		expect(overlay).toHaveAttribute('aria-hidden', 'true');
		expect(overlay?.querySelector('[data-testid="overlay-preview"]')?.textContent).toBe(
			'Add authentication'
		);
	});

	it('portals a column preview when a column is dragged by its handle', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({
			withOverlay: true,
			dynamicOverlay: true,
			overlayColumnPreview: true
		});
		stubRects(container);

		await grab(user, columnActivator(container, 'todo'));

		const overlay = overlayElement();
		expect(overlay).toHaveAttribute('data-variant', 'column');
		expect(overlay?.querySelector('[data-testid="overlay-column"]')).toBeInTheDocument();
	});

	it('never registers or drags a part rendered inside the overlay', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({
			withOverlay: true,
			dynamicOverlay: true,
			overlayColumnPreview: true
		});
		stubRects(container);

		await grab(user, columnActivator(container, 'todo'));
		const preview = overlayElement()?.querySelector<HTMLElement>('[data-testid="overlay-column"]');

		expect(preview).not.toHaveAttribute('data-dragging');
		// Only the board's own columns are counted; the preview is inert.
		expect(allBySlot(container, 'kanban-column')).toHaveLength(3);
	});

	it('removes the overlay on drop and on Escape', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ withOverlay: true });
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		expect(overlayElement()).not.toBeNull();
		await user.keyboard(' ');
		expect(overlayElement()).toBeNull();

		await grab(user, itemActivator(container, 'b'));
		expect(overlayElement()).not.toBeNull();
		await user.keyboard('{Escape}');
		expect(overlayElement()).toBeNull();
	});

	it('portals into the supplied container instead of the body', async () => {
		const user = userEvent.setup();
		const target = document.createElement('div');
		target.id = 'overlay-host';
		document.body.append(target);

		const { container } = renderHarness({ withOverlay: true, overlayContainer: target });
		stubRects(container);

		await grab(user, itemActivator(container, 'a'));
		expect(maybeBySlot(target, 'kanban-overlay')).not.toBeNull();

		await user.keyboard('{Escape}');
		target.remove();
	});

	it('suppresses the dragged element transform while an overlay is mounted', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ withOverlay: true });
		stubRects(container);

		await press(user, itemFor(container, 'a'), 150, 80);
		await movePointer(user, 150, 150);

		expect(itemFor(container, 'a').getAttribute('style') ?? '').not.toContain('translate3d');
		expect(overlayElement()?.getAttribute('style')).toContain('translate3d');
		await release(user);
	});

	it('keeps the harness board untouched by the preview render', () => {
		const { container } = renderHarness({ withOverlay: true });
		expect(Object.keys(KANBAN_HARNESS_COLUMNS)).toEqual(columnValues(container));
	});
});
