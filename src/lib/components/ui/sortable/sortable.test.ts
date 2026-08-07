import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import {
	arrayMove,
	closestCenter,
	closestCorners,
	horizontalListSortingStrategy,
	layoutParentOf,
	rectSortingStrategy,
	resolveKeyboardIndex,
	restrictToHorizontalAxis,
	restrictToParentElement,
	restrictToVerticalAxis,
	SORTABLE_ORIENTATIONS,
	toClientRect,
	translate3d,
	verticalListSortingStrategy,
	type ClientRect,
	type Coordinates,
	type SortableCollisionDetection,
	type SortableModifier,
	type SortableOrientation,
	type SortableStrategy
} from './sortable-geometry.js';
import Harness, {
	type SortableHarnessProps,
	type SortableHarnessRefs
} from './sortable.test.svelte';

// ---------------------------------------------------------------------------
// Helpers
//
// Elements are located by `data-slot` rather than by role: the item is only a `role="button"` when
// it is the activator, and the overlay is portalled outside the render container entirely.
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

/** The identifiers of the rendered items, in DOM order. */
function itemValues(container: HTMLElement): string[] {
	return allBySlot(container, 'sortable-item').map((item) => item.getAttribute('data-value') ?? '');
}

function itemFor(container: HTMLElement, value: string): HTMLElement {
	const item = container.querySelector<HTMLElement>(
		`[data-slot="sortable-item"][data-value="${value}"]`
	);
	if (!item) throw new Error(`no sortable item with value "${value}" was rendered`);
	return item;
}

/** The element a drag actually starts from: the handle when there is one, else the item. */
function activatorFor(container: HTMLElement, value: string): HTMLElement {
	const item = itemFor(container, value);
	return maybeBySlot(item, 'sortable-item-handle') ?? item;
}

function liveText(container: HTMLElement): string {
	return bySlot(container, 'sortable-live-region').textContent?.trim() ?? '';
}

function instructionsText(container: HTMLElement): string {
	return bySlot(container, 'sortable-instructions').textContent?.trim() ?? '';
}

function overlayElement(): HTMLElement | null {
	return maybeBySlot(document.body, 'sortable-overlay');
}

/** jsdom performs no layout, so geometry-dependent cases install their own boxes. */
function stubRect(element: Element, rect: ClientRect): void {
	const domRect = { ...rect, x: rect.left, y: rect.top, toJSON: () => rect } as DOMRect;
	vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(domRect);
}

/** A single-column list: boxes of `size` px, stacked inside their content element. */
function stubVerticalLayout(container: HTMLElement, size = 50): void {
	const items = allBySlot(container, 'sortable-item');
	stubRect(bySlot(container, 'sortable-content'), rectOf(0, 0, 200, size * items.length));
	items.forEach((item, index) => stubRect(item, rectOf(0, index * size, 200, size)));
}

/** A single-row list: boxes of `size` px, laid side by side inside their content element. */
function stubHorizontalLayout(container: HTMLElement, size = 100): void {
	const items = allBySlot(container, 'sortable-item');
	stubRect(bySlot(container, 'sortable-content'), rectOf(0, 0, size * items.length, 50));
	items.forEach((item, index) => stubRect(item, rectOf(index * size, 0, size, 50)));
}

type Driver = ReturnType<typeof userEvent.setup>;

function renderHarness(props: SortableHarnessProps = {}) {
	return render(Harness, { props });
}

async function press(user: Driver, target: HTMLElement, x: number, y: number): Promise<void> {
	await user.pointer({ keys: '[MouseLeft>]', target, coords: { clientX: x, clientY: y } });
}

async function movePointer(user: Driver, target: HTMLElement, x: number, y: number): Promise<void> {
	await user.pointer({ target, coords: { clientX: x, clientY: y } });
}

async function release(user: Driver, target: HTMLElement): Promise<void> {
	await user.pointer({ keys: '[/MouseLeft]', target });
}

/** Focus an activator and pick it up with the keyboard. */
async function grab(user: Driver, activator: HTMLElement): Promise<void> {
	activator.focus();
	await user.keyboard(' ');
}

// ---------------------------------------------------------------------------
// T005 — geometry (pure, no DOM, no render)
// ---------------------------------------------------------------------------

describe('sortable-geometry: collision detection (T005)', () => {
	const droppables = [
		{ id: 'a', rect: rectOf(0, 0, 100, 100) },
		{ id: 'b', rect: rectOf(0, 100, 100, 100) },
		{ id: 'c', rect: rectOf(0, 200, 100, 100) }
	];

	it('ranks droppables nearest-centre first', () => {
		const collisions = closestCenter({ collisionRect: rectOf(0, 90, 100, 100), droppables });
		expect(collisions.map((collision) => collision.id)).toEqual(['b', 'a', 'c']);
	});

	it('reports the centre distance it ranked on', () => {
		const [nearest] = closestCenter({ collisionRect: rectOf(0, 100, 100, 100), droppables });
		expect(nearest).toEqual({ id: 'b', distance: 0 });
	});

	it('ranks droppables by summed corner distance', () => {
		const collisions = closestCorners({ collisionRect: rectOf(0, 210, 100, 100), droppables });
		expect(collisions.map((collision) => collision.id)).toEqual(['c', 'b', 'a']);
	});

	it('sums all four corners rather than only the centre', () => {
		const [nearest] = closestCorners({ collisionRect: rectOf(0, 110, 100, 100), droppables });
		expect(nearest.distance).toBe(40);
	});
});

describe('sortable-geometry: sorting strategies (T005)', () => {
	const rects = [rectOf(0, 0, 100, 50), rectOf(0, 50, 100, 50), rectOf(0, 100, 100, 50)];
	const columns = [rectOf(0, 0, 50, 100), rectOf(50, 0, 50, 100), rectOf(100, 0, 50, 100)];

	it('moves the active item to the far edge of its target slot (vertical)', () => {
		expect(
			verticalListSortingStrategy({
				index: 0,
				activeIndex: 0,
				overIndex: 2,
				rects,
				activeRect: rects[0]
			})
		).toEqual({ x: 0, y: 100 });
	});

	it('shifts the items between the source and the target back by one slot (vertical)', () => {
		expect(
			verticalListSortingStrategy({
				index: 1,
				activeIndex: 0,
				overIndex: 2,
				rects,
				activeRect: rects[0]
			})
		).toEqual({ x: 0, y: -50 });
	});

	it('leaves items outside the moved range where they are (vertical)', () => {
		expect(
			verticalListSortingStrategy({
				index: 2,
				activeIndex: 0,
				overIndex: 1,
				rects,
				activeRect: rects[0]
			})
		).toEqual({ x: 0, y: 0 });
	});

	it('shifts items forward when the active item moves up (vertical)', () => {
		expect(
			verticalListSortingStrategy({
				index: 1,
				activeIndex: 2,
				overIndex: 0,
				rects,
				activeRect: rects[2]
			})
		).toEqual({ x: 0, y: 50 });
	});

	it('works on the inline axis (horizontal)', () => {
		expect(
			horizontalListSortingStrategy({
				index: 1,
				activeIndex: 0,
				overIndex: 2,
				rects: columns,
				activeRect: columns[0]
			})
		).toEqual({ x: -50, y: 0 });
	});

	it('returns null when the active rect is unknown (horizontal)', () => {
		expect(
			horizontalListSortingStrategy({
				index: 0,
				activeIndex: 5,
				overIndex: 1,
				rects: [],
				activeRect: null
			})
		).toBeNull();
	});

	it('moves every item into the slot it would occupy after the reorder (rect)', () => {
		const grid = [rectOf(0, 0, 100, 100), rectOf(100, 0, 100, 100), rectOf(200, 0, 100, 100)];
		const transforms = grid.map((_, index) =>
			rectSortingStrategy({ index, activeIndex: 0, overIndex: 2, rects: grid, activeRect: grid[0] })
		);
		expect(transforms).toEqual([
			{ x: 200, y: 0 },
			{ x: -100, y: 0 },
			{ x: -100, y: 0 }
		]);
	});
});

describe('sortable-geometry: modifiers (T005)', () => {
	const transform: Coordinates = { x: 20, y: 30 };
	const activeRect = rectOf(0, 0, 100, 50);
	const containerRect = rectOf(0, 0, 100, 200);

	it('drops the inline component', () => {
		expect(restrictToVerticalAxis({ transform, activeRect, containerRect })).toEqual({
			x: 0,
			y: 30
		});
	});

	it('drops the block component', () => {
		expect(restrictToHorizontalAxis({ transform, activeRect, containerRect })).toEqual({
			x: 20,
			y: 0
		});
	});

	it('clamps a transform that would leave the parent through the top', () => {
		expect(
			restrictToParentElement({ transform: { x: 0, y: -30 }, activeRect, containerRect })
		).toEqual({ x: 0, y: 0 });
	});

	it('clamps a transform that would leave the parent through the bottom', () => {
		expect(
			restrictToParentElement({ transform: { x: 0, y: 400 }, activeRect, containerRect })
		).toEqual({ x: 0, y: 150 });
	});

	it('passes the transform through when there is nothing to clamp against', () => {
		expect(restrictToParentElement({ transform, activeRect: null, containerRect: null })).toEqual(
			transform
		);
	});
});

describe('sortable-geometry: helpers (T005)', () => {
	it('moves an element and returns a new array', () => {
		const source = [1, 2, 3, 4];
		expect(arrayMove(source, 0, 2)).toEqual([2, 3, 1, 4]);
	});

	it('treats a same-index move as a no-op copy', () => {
		const source = [1, 2, 3];
		const next = arrayMove(source, 1, 1);
		expect(next).toEqual(source);
	});

	it('returns an unchanged copy for an out-of-range index', () => {
		const source = [1, 2, 3];
		expect(arrayMove(source, 7, 0)).toEqual(source);
	});

	it('formats a transform as a translate3d declaration', () => {
		expect(translate3d({ x: 1, y: -2 })).toBe('translate3d(1px, -2px, 0)');
	});

	it('formats nothing at all when there is no transform', () => {
		expect(translate3d(null)).toBeUndefined();
	});

	it('snapshots an element box as a plain object', () => {
		const element = document.createElement('div');
		stubRect(element, rectOf(5, 10, 20, 30));
		expect(toClientRect(element)).toEqual(rectOf(5, 10, 20, 30));
	});

	it('lists the three orientations in upstream order', () => {
		expect(SORTABLE_ORIENTATIONS).toEqual(['vertical', 'horizontal', 'mixed']);
	});

	it('walks past a display:contents wrapper to find the laid-out parent', () => {
		// `bits-ui`'s `Command.Item` interposes exactly this wrapper. It generates no box, so
		// measuring it as the drag container clamped every transform to the viewport origin.
		const container = document.createElement('div');
		const wrapper = document.createElement('div');
		wrapper.style.display = 'contents';
		const item = document.createElement('div');
		container.append(wrapper);
		wrapper.append(item);
		document.body.append(container);

		try {
			expect(layoutParentOf(item)).toBe(container);
		} finally {
			container.remove();
		}
	});

	it('keeps a parent that generates a box of its own', () => {
		const container = document.createElement('div');
		const item = document.createElement('div');
		container.append(item);
		document.body.append(container);

		try {
			expect(layoutParentOf(item)).toBe(container);
		} finally {
			container.remove();
		}
	});
});

describe('sortable-geometry: resolveKeyboardIndex (T005)', () => {
	const flat = ['a', 'b', 'c', 'd'].map((id) => ({ id, disabled: false, rect: null }));

	const cases: {
		orientation: SortableOrientation;
		dir: 'ltr' | 'rtl';
		key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
		expected: number | null;
	}[] = [
		{ orientation: 'vertical', dir: 'ltr', key: 'ArrowUp', expected: 0 },
		{ orientation: 'vertical', dir: 'ltr', key: 'ArrowDown', expected: 2 },
		{ orientation: 'vertical', dir: 'ltr', key: 'ArrowLeft', expected: null },
		{ orientation: 'vertical', dir: 'ltr', key: 'ArrowRight', expected: null },
		{ orientation: 'vertical', dir: 'rtl', key: 'ArrowUp', expected: 0 },
		{ orientation: 'vertical', dir: 'rtl', key: 'ArrowDown', expected: 2 },
		{ orientation: 'vertical', dir: 'rtl', key: 'ArrowLeft', expected: null },
		{ orientation: 'vertical', dir: 'rtl', key: 'ArrowRight', expected: null },
		{ orientation: 'horizontal', dir: 'ltr', key: 'ArrowLeft', expected: 0 },
		{ orientation: 'horizontal', dir: 'ltr', key: 'ArrowRight', expected: 2 },
		{ orientation: 'horizontal', dir: 'ltr', key: 'ArrowUp', expected: null },
		{ orientation: 'horizontal', dir: 'ltr', key: 'ArrowDown', expected: null },
		{ orientation: 'horizontal', dir: 'rtl', key: 'ArrowLeft', expected: 2 },
		{ orientation: 'horizontal', dir: 'rtl', key: 'ArrowRight', expected: 0 },
		{ orientation: 'horizontal', dir: 'rtl', key: 'ArrowUp', expected: null },
		{ orientation: 'horizontal', dir: 'rtl', key: 'ArrowDown', expected: null },
		{ orientation: 'mixed', dir: 'ltr', key: 'ArrowUp', expected: 0 },
		{ orientation: 'mixed', dir: 'ltr', key: 'ArrowDown', expected: 2 },
		{ orientation: 'mixed', dir: 'ltr', key: 'ArrowLeft', expected: 0 },
		{ orientation: 'mixed', dir: 'ltr', key: 'ArrowRight', expected: 2 },
		{ orientation: 'mixed', dir: 'rtl', key: 'ArrowUp', expected: 0 },
		{ orientation: 'mixed', dir: 'rtl', key: 'ArrowDown', expected: 2 },
		{ orientation: 'mixed', dir: 'rtl', key: 'ArrowLeft', expected: 2 },
		{ orientation: 'mixed', dir: 'rtl', key: 'ArrowRight', expected: 0 }
	];

	for (const { orientation, dir, key, expected } of cases) {
		it(`resolves ${key} in ${orientation}/${dir} to ${expected}`, () => {
			expect(
				resolveKeyboardIndex({ key, orientation, dir, activeIndex: 1, candidates: flat })
			).toBe(expected);
		});
	}

	it('skips disabled candidates when stepping', () => {
		const candidates = [
			{ id: 'a', disabled: false, rect: null },
			{ id: 'b', disabled: true, rect: null },
			{ id: 'c', disabled: false, rect: null }
		];
		expect(
			resolveKeyboardIndex({
				key: 'ArrowDown',
				orientation: 'vertical',
				dir: 'ltr',
				activeIndex: 0,
				candidates
			})
		).toBe(2);
	});

	it('returns null when there is nothing left in that direction', () => {
		expect(
			resolveKeyboardIndex({
				key: 'ArrowUp',
				orientation: 'vertical',
				dir: 'ltr',
				activeIndex: 0,
				candidates: flat
			})
		).toBeNull();
	});

	it('picks the nearest centre in the pressed direction for a grid', () => {
		const grid = [
			{ id: 'a', disabled: false, rect: rectOf(0, 0, 100, 100) },
			{ id: 'b', disabled: false, rect: rectOf(100, 0, 100, 100) },
			{ id: 'c', disabled: false, rect: rectOf(0, 100, 100, 100) },
			{ id: 'd', disabled: false, rect: rectOf(100, 100, 100, 100) }
		];
		expect(
			resolveKeyboardIndex({
				key: 'ArrowRight',
				orientation: 'mixed',
				dir: 'ltr',
				activeIndex: 0,
				candidates: grid
			})
		).toBe(1);
		expect(
			resolveKeyboardIndex({
				key: 'ArrowDown',
				orientation: 'mixed',
				dir: 'ltr',
				activeIndex: 0,
				candidates: grid
			})
		).toBe(2);
		expect(
			resolveKeyboardIndex({
				key: 'ArrowUp',
				orientation: 'mixed',
				dir: 'ltr',
				activeIndex: 0,
				candidates: grid
			})
		).toBeNull();
	});

	it('mirrors the grid geometry under rtl', () => {
		const grid = [
			{ id: 'a', disabled: false, rect: rectOf(100, 0, 100, 100) },
			{ id: 'b', disabled: false, rect: rectOf(0, 0, 100, 100) }
		];
		expect(
			resolveKeyboardIndex({
				key: 'ArrowRight',
				orientation: 'mixed',
				dir: 'rtl',
				activeIndex: 0,
				candidates: grid
			})
		).toBe(1);
	});

	it('falls back to index stepping when no rect discriminates', () => {
		const degenerate = ['a', 'b', 'c'].map((id) => ({
			id,
			disabled: false,
			rect: rectOf(0, 0, 0, 0)
		}));
		expect(
			resolveKeyboardIndex({
				key: 'ArrowRight',
				orientation: 'mixed',
				dir: 'ltr',
				activeIndex: 0,
				candidates: degenerate
			})
		).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// T006 — roles, names and announcements
// ---------------------------------------------------------------------------

describe('Sortable accessibility wiring (T006)', () => {
	it('renders a data-slot on every part', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ withHandle: true, asHandle: false, withOverlay: true });

		expect(bySlot(container, 'sortable-content')).toBeInTheDocument();
		expect(allBySlot(container, 'sortable-item')).toHaveLength(4);
		expect(allBySlot(container, 'sortable-item-handle')).toHaveLength(4);
		expect(bySlot(container, 'sortable-live-region')).toBeInTheDocument();
		expect(bySlot(container, 'sortable-instructions')).toBeInTheDocument();

		await grab(user, activatorFor(container, 'a'));
		expect(overlayElement()).not.toBeNull();
	});

	it.each(['vertical', 'horizontal', 'mixed'] as const)(
		'exposes data-orientation="%s" on the content region',
		(orientation) => {
			const { container } = renderHarness({ orientation });
			expect(bySlot(container, 'sortable-content')).toHaveAttribute(
				'data-orientation',
				orientation
			);
		}
	);

	it('puts the draggable attribute set on the item when it is the activator', () => {
		const { container } = renderHarness({ asHandle: true });
		const item = itemFor(container, 'a');

		expect(item).toHaveAttribute('role', 'button');
		expect(item).toHaveAttribute('tabindex', '0');
		expect(item).toHaveAttribute('aria-roledescription', 'sortable');
		expect(item).toHaveAttribute('aria-describedby', bySlot(container, 'sortable-instructions').id);
	});

	it('puts the draggable attribute set on the handle instead, and not on the item', () => {
		const { container } = renderHarness({ asHandle: false, withHandle: true });
		const item = itemFor(container, 'a');
		const handle = bySlot(item, 'sortable-item-handle');

		expect(item).not.toHaveAttribute('role');
		expect(item).not.toHaveAttribute('aria-roledescription');
		expect(handle).toHaveAttribute('aria-roledescription', 'sortable');
		expect(handle).toHaveAttribute(
			'aria-describedby',
			bySlot(container, 'sortable-instructions').id
		);
	});

	it('points the handle at the item it controls', () => {
		const { container } = renderHarness({ asHandle: false, withHandle: true });
		const item = itemFor(container, 'a');
		expect(bySlot(item, 'sortable-item-handle')).toHaveAttribute('aria-controls', item.id);
	});

	it('marks the activator pressed while dragging and releases it on drop', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		const activator = activatorFor(container, 'a');

		await grab(user, activator);
		expect(activator).toHaveAttribute('aria-pressed', 'true');

		await user.keyboard(' ');
		expect(activator).not.toHaveAttribute('aria-pressed');
	});

	it('renders an assertive live region', () => {
		const { container } = renderHarness();
		const live = bySlot(container, 'sortable-live-region');

		expect(live).toHaveAttribute('role', 'status');
		expect(live).toHaveAttribute('aria-live', 'assertive');
		expect(live).toHaveAttribute('aria-atomic', 'true');
	});

	it.each([
		['vertical', 'up and down'],
		['horizontal', 'left and right'],
		['mixed', 'arrow']
	] as const)('branches the instructions text for %s', (orientation, words) => {
		const { container } = renderHarness({ orientation });
		expect(instructionsText(container)).toBe(
			`To pick up a sortable item, press space or enter. While dragging, use the ${words} keys to move the item. Press space or enter again to drop the item in its new position, or press escape to cancel.`
		);
	});

	it('merges announcement overrides per key', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({
			accessibility: { announcements: { onDragStart: () => 'custom pick up' } }
		});

		await grab(user, activatorFor(container, 'a'));
		expect(liveText(container)).toBe('custom pick up');

		await user.keyboard('{Escape}');
		expect(liveText(container)).toBe(
			'Sorting cancelled. Sortable item "a" returned to position 1 of 4.'
		);
	});

	it('replaces the instructions text while keeping the describedby wiring', () => {
		const { container } = renderHarness({
			accessibility: { screenReaderInstructions: { draggable: 'custom instructions' } }
		});
		const instructions = bySlot(container, 'sortable-instructions');

		expect(instructionsText(container)).toBe('custom instructions');
		expect(itemFor(container, 'a')).toHaveAttribute('aria-describedby', instructions.id);
	});
});

// ---------------------------------------------------------------------------
// T007 — props and data attributes
// ---------------------------------------------------------------------------

describe('Sortable props and data attributes (T007)', () => {
	it('applies the vertical orientation default modifiers to the dragged item', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ orientation: 'vertical' });
		stubVerticalLayout(container);
		const item = itemFor(container, 'a');

		await press(user, item, 10, 25);
		await movePointer(user, item, 90, 60);

		// `restrictToVerticalAxis` is in the vertical default list, so the inline delta is dropped.
		expect(item.getAttribute('style')).toContain('translate3d(0px, 35px, 0)');
		await release(user, item);
	});

	it('applies the horizontal orientation default modifiers to the dragged item', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ orientation: 'horizontal' });
		stubHorizontalLayout(container);
		const item = itemFor(container, 'a');

		await press(user, item, 10, 25);
		await movePointer(user, item, 60, 40);

		expect(item.getAttribute('style')).toContain('translate3d(50px, 0px, 0)');
		await release(user, item);
	});

	it('invokes an explicit strategy instead of the orientation default', async () => {
		const user = userEvent.setup();
		const strategy = vi.fn<SortableStrategy>(() => ({ x: 7, y: 9 }));
		const { container } = renderHarness({ strategy });

		await grab(user, activatorFor(container, 'a'));

		expect(strategy).toHaveBeenCalled();
		expect(itemFor(container, 'b').getAttribute('style')).toContain('translate3d(7px, 9px, 0)');
	});

	it('invokes an explicit collision detection instead of the orientation default', async () => {
		const user = userEvent.setup();
		const collisionDetection = vi.fn<SortableCollisionDetection>(() => []);
		const { container } = renderHarness({ collisionDetection });
		stubVerticalLayout(container);
		const item = itemFor(container, 'a');

		await press(user, item, 10, 25);
		await movePointer(user, item, 10, 75);

		expect(collisionDetection).toHaveBeenCalled();
		await release(user, item);
	});

	it('replaces the default modifier list wholesale', async () => {
		const user = userEvent.setup();
		const modifier = vi.fn<SortableModifier>(({ transform }) => transform);
		const { container } = renderHarness({ modifiers: [modifier] });
		stubVerticalLayout(container);
		const item = itemFor(container, 'a');

		await press(user, item, 10, 25);
		await movePointer(user, item, 90, 60);

		expect(modifier).toHaveBeenCalled();
		// Nothing clamps the inline axis now, so the raw delta survives.
		expect(item.getAttribute('style')).toContain('translate3d(80px, 35px, 0)');
		await release(user, item);
	});

	it('gives each content region its own strategy override', async () => {
		const user = userEvent.setup();
		const first = vi.fn<SortableStrategy>(() => ({ x: 1, y: 1 }));
		const second = vi.fn<SortableStrategy>(() => ({ x: 2, y: 2 }));
		const { container } = renderHarness({
			mode: 'multi-region',
			contentStrategy: first,
			secondContentStrategy: second
		});

		await grab(user, activatorFor(container, 'a'));

		expect(itemFor(container, 'b').getAttribute('style')).toContain('translate3d(1px, 1px, 0)');
		expect(itemFor(container, 'c').getAttribute('style')).toContain('translate3d(2px, 2px, 0)');
	});

	it('keeps a drag inside the region it started in', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const { container } = renderHarness({ mode: 'multi-region', onValueChange });

		// Region one holds a and b; ArrowDown from a can only reach b.
		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
		await user.keyboard(' ');

		expect(onValueChange).toHaveBeenCalledWith([
			expect.objectContaining({ id: 'b' }),
			expect.objectContaining({ id: 'a' }),
			expect.objectContaining({ id: 'c' }),
			expect.objectContaining({ id: 'd' })
		]);
	});

	it('flags a flat cursor on the item, the handle and the overlay', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({
			flatCursor: true,
			asHandle: false,
			withHandle: true,
			withOverlay: true
		});
		const item = itemFor(container, 'a');
		const handle = bySlot(item, 'sortable-item-handle');

		expect(item).toHaveAttribute('data-flat-cursor', '');
		expect(handle).toHaveAttribute('data-flat-cursor', '');
		expect(item.className).toContain('cursor-default');
		expect(handle.className).toContain('cursor-default');

		await grab(user, handle);
		const overlay = overlayElement();
		expect(overlay).toHaveAttribute('data-flat-cursor', '');
		expect(overlay?.className).not.toContain('cursor-grabbing');
	});

	it('keeps the grabbing cursor on the overlay when flatCursor is off', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ withOverlay: true });

		await grab(user, activatorFor(container, 'a'));
		expect(overlayElement()?.className).toContain('cursor-grabbing');
	});

	it('renders no element at all for withoutSlot', () => {
		const { container } = renderHarness({ withoutSlot: true });

		expect(maybeBySlot(container, 'sortable-content')).toBeNull();
		expect(itemValues(container)).toEqual(['a', 'b', 'c', 'd']);
	});

	it('reflects a disabled item on the item and its handle', () => {
		const { container } = renderHarness({
			asHandle: false,
			withHandle: true,
			items: [
				{ id: 'a', label: 'A', disabled: true },
				{ id: 'b', label: 'B' }
			]
		});
		const item = itemFor(container, 'a');
		const handle = bySlot(item, 'sortable-item-handle');

		expect(item).toHaveAttribute('data-disabled', '');
		expect(handle).toHaveAttribute('data-disabled', '');
		expect(handle).toHaveAttribute('aria-disabled', 'true');
		expect(handle).toBeDisabled();
	});

	it('marks a disabled item that is its own activator as unavailable', () => {
		const { container } = renderHarness({
			asHandle: true,
			items: [{ id: 'a', label: 'A', disabled: true }]
		});
		const item = itemFor(container, 'a');

		expect(item).toHaveAttribute('aria-disabled', 'true');
		expect(item).not.toHaveAttribute('tabindex');
	});

	it('lets an explicit handle disabled value win over the item’s', () => {
		const { container } = renderHarness({
			asHandle: false,
			withHandle: true,
			handleDisabled: false,
			items: [{ id: 'a', label: 'A', disabled: true }]
		});
		const handle = bySlot(itemFor(container, 'a'), 'sortable-item-handle');

		expect(handle).not.toBeDisabled();
		expect(handle).not.toHaveAttribute('data-disabled');
	});

	it.each([
		['an element', 'element'],
		['a document fragment', 'fragment'],
		['a selector string', 'selector'],
		['document.body by default', 'default']
	] as const)('resolves the overlay container from %s', async (_label, kind) => {
		const user = userEvent.setup();
		const host = document.createElement('div');
		host.id = 'overlay-host';
		document.body.appendChild(host);
		const fragment = document.createDocumentFragment();

		const container =
			kind === 'element'
				? host
				: kind === 'fragment'
					? fragment
					: kind === 'selector'
						? '#overlay-host'
						: undefined;

		const rendered = renderHarness({ withOverlay: true, overlayContainer: container });
		await grab(user, activatorFor(rendered.container, 'a'));

		const target = kind === 'fragment' ? fragment : kind === 'default' ? document.body : host;
		expect(maybeBySlot(target, 'sortable-overlay')).not.toBeNull();
		host.remove();
	});

	it('merges the caller class last on every part that renders an element', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({
			asHandle: false,
			withHandle: true,
			withOverlay: true,
			contentClass: 'content-custom',
			itemClass: 'item-custom',
			handleClass: 'handle-custom',
			overlayClass: 'overlay-custom'
		});

		expect(bySlot(container, 'sortable-content').className).toContain('content-custom');
		expect(itemFor(container, 'a').className).toContain('item-custom');
		expect(bySlot(itemFor(container, 'a'), 'sortable-item-handle').className).toContain(
			'handle-custom'
		);

		await grab(user, activatorFor(container, 'a'));
		expect(overlayElement()?.className).toContain('overlay-custom');
	});

	it('appends the caller style after the component transform', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ itemStyle: 'outline: 1px solid red;' });

		await grab(user, activatorFor(container, 'a'));
		const style = itemFor(container, 'b').getAttribute('style') ?? '';

		expect(style.indexOf('transform:')).toBeLessThan(style.indexOf('outline:'));
	});

	it('spreads restProps onto each rendered element', () => {
		const { container } = renderHarness();
		expect(bySlot(container, 'sortable-content')).toHaveAttribute('data-testid', 'content');
		expect(itemFor(container, 'a')).toHaveAttribute('data-value', 'a');
	});

	it('binds ref on the content, the item and the handle', async () => {
		const onRefs = vi.fn<(refs: SortableHarnessRefs) => void>();
		const { container } = renderHarness({ asHandle: false, withHandle: true, onRefs });
		await tick();

		const refs = onRefs.mock.lastCall?.[0];
		expect(refs?.content).toBe(bySlot(container, 'sortable-content'));
		expect(refs?.item).toBe(itemFor(container, 'a'));
		expect(refs?.handle).toBe(bySlot(itemFor(container, 'a'), 'sortable-item-handle'));
	});

	it('hands the merged props to the content child snippet', () => {
		const { container } = renderHarness({ contentAsChild: true });
		const section = container.querySelector<HTMLElement>('[data-testid="content-child"]');

		expect(section).toHaveAttribute('data-slot', 'sortable-content');
		expect(section).toHaveAttribute('data-orientation', 'vertical');
	});

	it('hands the merged props to the item and handle child snippets', () => {
		const { container } = renderHarness({
			asHandle: false,
			withHandle: true,
			itemAsChild: false,
			handleAsChild: true
		});
		const handle = container.querySelector<HTMLElement>('[data-testid="handle-child"]');
		expect(handle).toHaveAttribute('data-slot', 'sortable-item-handle');
		expect(handle).toHaveAttribute('aria-roledescription', 'sortable');
	});

	it('registers an item rendered through its own child element', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const { container } = renderHarness({ itemAsChild: true, onValueChange });

		const article = container.querySelectorAll<HTMLElement>('[data-testid="item-child"]')[0];
		await grab(user, article);
		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');

		expect(onValueChange).toHaveBeenCalledTimes(1);
	});

	it('fires the five lifecycle callbacks at the documented moments', async () => {
		const user = userEvent.setup();
		const onDragStart = vi.fn();
		const onDragMove = vi.fn();
		const onDragOver = vi.fn();
		const onDragEnd = vi.fn();
		const onDragCancel = vi.fn();
		const onValueChange = vi.fn();
		const { container } = renderHarness({
			onDragStart,
			onDragMove,
			onDragOver,
			onDragEnd,
			onDragCancel,
			onValueChange
		});

		await grab(user, activatorFor(container, 'a'));
		expect(onDragStart).toHaveBeenCalledWith({ active: { id: 'a' }, over: { id: 'a' } });

		await user.keyboard('{ArrowDown}');
		expect(onDragOver).toHaveBeenCalledWith({ active: { id: 'a' }, over: { id: 'b' } });
		expect(onDragMove).toHaveBeenCalledTimes(1);

		// A second ArrowDown changes the target again, so over fires once more.
		await user.keyboard('{ArrowDown}');
		expect(onDragOver).toHaveBeenCalledTimes(2);
		expect(onDragMove).toHaveBeenCalledTimes(2);

		await user.keyboard(' ');
		expect(onDragEnd).toHaveBeenCalledWith({ active: { id: 'a' }, over: { id: 'c' } });
		expect(onDragEnd.mock.invocationCallOrder[0]).toBeLessThan(
			onValueChange.mock.invocationCallOrder[0]
		);
		expect(onDragCancel).not.toHaveBeenCalled();
	});

	it('fires the same lifecycle callbacks for a pointer drag (T027)', async () => {
		const user = userEvent.setup();
		const onDragStart = vi.fn();
		const onDragMove = vi.fn();
		const onDragOver = vi.fn();
		const onDragEnd = vi.fn();
		const onDragCancel = vi.fn();
		const onValueChange = vi.fn();
		const { container } = renderHarness({
			onDragStart,
			onDragMove,
			onDragOver,
			onDragEnd,
			onDragCancel,
			onValueChange
		});
		stubVerticalLayout(container);
		const item = itemFor(container, 'a');

		// Pressing alone is not a drag: the 5 px activation constraint has not been met yet.
		await press(user, item, 10, 25);
		expect(onDragStart).not.toHaveBeenCalled();

		// 10 px clears the constraint, so the session opens — still over itself, as at keyboard pick-up.
		await movePointer(user, item, 10, 35);
		expect(onDragStart).toHaveBeenCalledTimes(1);
		expect(onDragStart).toHaveBeenCalledWith({ active: { id: 'a' }, over: { id: 'a' } });
		expect(onDragMove).toHaveBeenCalled();
		expect(onDragOver).not.toHaveBeenCalled();

		const movesBeforeCrossing = onDragMove.mock.calls.length;
		await movePointer(user, item, 10, 75);

		expect(onDragMove.mock.calls.length).toBeGreaterThan(movesBeforeCrossing);
		expect(onDragOver).toHaveBeenCalledTimes(1);
		expect(onDragOver).toHaveBeenCalledWith({ active: { id: 'a' }, over: { id: 'b' } });

		await release(user, item);

		expect(onDragEnd).toHaveBeenCalledWith({ active: { id: 'a' }, over: { id: 'b' } });
		expect(onDragEnd.mock.invocationCallOrder[0]).toBeLessThan(
			onValueChange.mock.invocationCallOrder[0]
		);
		expect(onDragCancel).not.toHaveBeenCalled();
	});

	it('fires onDragCancel on escape', async () => {
		const user = userEvent.setup();
		const onDragCancel = vi.fn();
		const { container } = renderHarness({ onDragCancel });

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{Escape}');

		expect(onDragCancel).toHaveBeenCalledWith({ active: { id: 'a' }, over: { id: 'a' } });
	});
});

// ---------------------------------------------------------------------------
// T008 — controlled and uncontrolled
// ---------------------------------------------------------------------------

describe('Sortable value modes (T008)', () => {
	it('seeds itself from defaultValue and moves its own state', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const { container } = renderHarness({ valueMode: 'uncontrolled', onValueChange });

		await grab(user, activatorFor(container, 'a'));
		expect(liveText(container)).toBe(
			'Grabbed sortable item "a". Current position is 1 of 4. Use arrow keys to move, space to drop.'
		);

		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');
		expect(onValueChange).toHaveBeenCalledTimes(1);

		// The root now owns [b, a, c, d]; grabbing `a` again reports its new position.
		await grab(user, activatorFor(container, 'a'));
		expect(liveText(container)).toBe(
			'Grabbed sortable item "a". Current position is 2 of 4. Use arrow keys to move, space to drop.'
		);
	});

	it('updates the bound array when the parent binds it', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ valueMode: 'bound' });

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');

		expect(itemValues(container)).toEqual(['b', 'a', 'c', 'd']);
	});

	it('leaves the parent authoritative when its setter declines the write', async () => {
		const user = userEvent.setup();
		const onDeclinedValue = vi.fn();
		const { container } = renderHarness({ valueMode: 'declined', onDeclinedValue });

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');

		expect(onDeclinedValue).toHaveBeenCalledTimes(1);
		expect(itemValues(container)).toEqual(['a', 'b', 'c', 'd']);
	});

	it('lets onMove suppress both the splice and onValueChange', async () => {
		const user = userEvent.setup();
		const onMove = vi.fn();
		const onValueChange = vi.fn();
		const { container } = renderHarness({ onMove, onValueChange });

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');

		expect(onMove).toHaveBeenCalledWith({
			active: { id: 'a' },
			over: { id: 'b' },
			activeIndex: 0,
			overIndex: 1
		});
		expect(onValueChange).not.toHaveBeenCalled();
		expect(itemValues(container)).toEqual(['a', 'b', 'c', 'd']);
	});
});

// ---------------------------------------------------------------------------
// T009 — keyboard interaction
// ---------------------------------------------------------------------------

describe('Sortable keyboard interaction (T009)', () => {
	it.each([' ', '{Enter}'] as const)('picks the item up with %s', async (key) => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		const activator = activatorFor(container, 'a');

		activator.focus();
		await user.keyboard(key);

		expect(activator).toHaveAttribute('aria-pressed', 'true');
		expect(liveText(container)).toBe(
			'Grabbed sortable item "a". Current position is 1 of 4. Use arrow keys to move, space to drop.'
		);
	});

	it('prevents the default action of the pick-up key', () => {
		const { container } = renderHarness();
		const activator = activatorFor(container, 'a');

		const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
		activator.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
	});

	it.each([
		['ArrowDown', ['b', 'a', 'c', 'd']],
		['ArrowUp', ['a', 'b', 'c', 'd']]
	] as const)('moves one position with %s in a vertical list', async (key, expected) => {
		const user = userEvent.setup();
		const { container } = renderHarness({ orientation: 'vertical' });

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard(`{${key}}`);
		await user.keyboard(' ');

		expect(itemValues(container)).toEqual(expected);
	});

	it('announces the new position while moving', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{ArrowDown}');

		expect(liveText(container)).toBe('Sortable item "a" is moving down to position 2 of 4.');
	});

	it('ignores the orthogonal axis in a vertical list', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ orientation: 'vertical' });

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{ArrowRight}');
		await user.keyboard(' ');

		expect(itemValues(container)).toEqual(['a', 'b', 'c', 'd']);
	});

	it('moves with the inline arrows in a horizontal list', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ orientation: 'horizontal' });

		await grab(user, activatorFor(container, 'b'));
		await user.keyboard('{ArrowLeft}');
		await user.keyboard(' ');

		expect(itemValues(container)).toEqual(['b', 'a', 'c', 'd']);
	});

	it('ignores the orthogonal axis in a horizontal list', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ orientation: 'horizontal' });

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');

		expect(itemValues(container)).toEqual(['a', 'b', 'c', 'd']);
	});

	it('accepts every arrow key in a mixed list', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ orientation: 'mixed' });

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{ArrowRight}');
		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');

		expect(itemValues(container)).toEqual(['b', 'c', 'a', 'd']);
	});

	it('commits the reorder and announces the drop', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{ArrowDown}');
		await user.keyboard('{Enter}');

		expect(itemValues(container)).toEqual(['b', 'a', 'c', 'd']);
		expect(liveText(container)).toBe('Sortable item "a" dropped at position 2 of 4.');
	});

	it('cancels with escape without committing anything', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const { container } = renderHarness({ onValueChange });

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{ArrowDown}');
		await user.keyboard('{Escape}');

		expect(onValueChange).not.toHaveBeenCalled();
		expect(itemValues(container)).toEqual(['a', 'b', 'c', 'd']);
		expect(liveText(container)).toBe(
			'Sorting cancelled. Sortable item "a" returned to position 1 of 4.'
		);
	});

	it('swallows Tab while a drag is active and keeps focus on the activator', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		const activator = activatorFor(container, 'a');

		await grab(user, activator);
		await user.tab();

		expect(document.activeElement).toBe(activator);
	});

	it('moves focus between activators when idle', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();

		activatorFor(container, 'a').focus();
		await user.tab();

		expect(document.activeElement).toBe(activatorFor(container, 'b'));
	});

	it('keeps focus on the activator across the reorder', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness();
		const activator = activatorFor(container, 'a');

		await grab(user, activator);
		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');

		expect(document.activeElement).toBe(activatorFor(container, 'a'));
	});
});

// ---------------------------------------------------------------------------
// T010 — RTL
// ---------------------------------------------------------------------------

describe('Sortable right-to-left (T010)', () => {
	it.each([
		['horizontal', 'ArrowLeft', ['b', 'a', 'c', 'd']],
		['horizontal', 'ArrowRight', ['a', 'b', 'c', 'd']],
		['mixed', 'ArrowLeft', ['b', 'a', 'c', 'd']],
		['mixed', 'ArrowRight', ['a', 'b', 'c', 'd']]
	] as const)('inverts %s %s through the dir prop', async (orientation, key, expected) => {
		const user = userEvent.setup();
		const { container } = renderHarness({ orientation, dir: 'rtl' });

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard(`{${key}}`);
		await user.keyboard(' ');

		expect(itemValues(container)).toEqual(expected);
	});

	it('inverts through an ambient DirectionProvider', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({
			mode: 'rtl-provider',
			providerDir: 'rtl',
			orientation: 'horizontal'
		});

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{ArrowLeft}');
		await user.keyboard(' ');

		expect(itemValues(container)).toEqual(['b', 'a', 'c', 'd']);
	});

	it('leaves a vertical list unaffected by direction', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ orientation: 'vertical', dir: 'rtl' });

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');

		expect(itemValues(container)).toEqual(['b', 'a', 'c', 'd']);
	});
});

// ---------------------------------------------------------------------------
// T011 — edge cases and guard rails
// ---------------------------------------------------------------------------

describe('Sortable guard rails (T011)', () => {
	it.each([
		['bare-content', '`<Sortable.Content>` must be used within `<Sortable>`.'],
		[
			'bare-item',
			'`<Sortable.Item>` must be used within `<Sortable.Content>` or `<Sortable.Overlay>`.'
		],
		['bare-item-handle', '`<Sortable.ItemHandle>` must be used within `<Sortable.Item>`.'],
		['bare-overlay', '`<Sortable.Overlay>` must be used within `<Sortable>`.']
	] as const)('throws when %s is rendered outside its provider', (mode, message) => {
		expect(() => renderHarness({ mode })).toThrow(message);
	});

	it('throws when an item sits under the root but outside a content region', () => {
		expect(() => renderHarness({ mode: 'item-outside-content' })).toThrow(/within/);
	});

	it('throws for an empty-string item value', () => {
		expect(() => renderHarness({ mode: 'empty-item-value' })).toThrow(
			'`SortableItem` value cannot be an empty string'
		);
	});

	it('throws for an object array with no getItemValue', () => {
		expect(() => renderHarness({ withGetItemValue: false })).toThrow(
			'`getItemValue` is required when using array of objects'
		);
	});

	it('accepts the same object array once getItemValue is supplied', () => {
		const { container } = renderHarness({ withGetItemValue: true });
		expect(itemValues(container)).toEqual(['a', 'b', 'c', 'd']);
	});

	it('refuses to pick up a disabled item with the keyboard', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({
			items: [
				{ id: 'a', label: 'A', disabled: true },
				{ id: 'b', label: 'B' }
			]
		});

		await grab(user, itemFor(container, 'a'));

		expect(liveText(container)).toBe('');
		expect(itemFor(container, 'a')).not.toHaveAttribute('aria-pressed');
	});

	it('refuses to pick up a disabled item with the pointer', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({
			items: [
				{ id: 'a', label: 'A', disabled: true },
				{ id: 'b', label: 'B' }
			]
		});
		stubVerticalLayout(container);
		const item = itemFor(container, 'a');

		await press(user, item, 10, 25);
		await movePointer(user, item, 10, 75);

		expect(overlayElement()).toBeNull();
		expect(liveText(container)).toBe('');
		await release(user, item);
	});

	it('never resolves a disabled item as a drop target', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({
			items: [
				{ id: 'a', label: 'A' },
				{ id: 'b', label: 'B', disabled: true },
				{ id: 'c', label: 'C' },
				{ id: 'd', label: 'D' }
			]
		});

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');

		expect(itemValues(container)).toEqual(['b', 'c', 'a', 'd']);
	});

	it('cancels the session when the active item is removed mid-drag', async () => {
		const user = userEvent.setup();
		const onDragCancel = vi.fn();
		const onValueChange = vi.fn();
		const { container } = renderHarness({
			removeActiveOnDragStart: true,
			onDragCancel,
			onValueChange
		});

		await grab(user, activatorFor(container, 'a'));

		expect(onDragCancel).toHaveBeenCalledTimes(1);
		expect(onValueChange).not.toHaveBeenCalled();
		expect(liveText(container)).toBe(
			'Sorting cancelled. Sortable item "a" returned to position 1 of 3.'
		);
	});

	it('renders an empty list without error', () => {
		const { container } = renderHarness({ items: [] });
		expect(itemValues(container)).toEqual([]);
	});

	it('produces no reorder in a single-item list', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const { container } = renderHarness({ items: [{ id: 'a', label: 'A' }], onValueChange });

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');

		expect(onValueChange).not.toHaveBeenCalled();
		expect(liveText(container)).toBe('Sortable item "a" dropped at position 1 of 1.');
	});
});

// ---------------------------------------------------------------------------
// T012 — pointer, touch, handle, overlay and primitive values
// ---------------------------------------------------------------------------

describe('Sortable pointer dragging (T012)', () => {
	it('commits a reorder when dragged past a neighbour', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const { container } = renderHarness({ onValueChange });
		stubVerticalLayout(container);
		const item = itemFor(container, 'a');

		await press(user, item, 10, 25);
		await movePointer(user, item, 10, 35);
		await movePointer(user, item, 10, 75);
		await release(user, item);

		expect(onValueChange).toHaveBeenCalledTimes(1);
		expect(itemValues(container)).toEqual(['b', 'a', 'c', 'd']);
		expect(itemFor(container, 'a')).not.toHaveAttribute('data-dragging');
	});

	it('swallows the click the browser synthesises when a drag releases', async () => {
		const user = userEvent.setup();
		const onClick = vi.fn();
		const { container } = renderHarness();
		stubVerticalLayout(container);
		const item = itemFor(container, 'a');
		item.addEventListener('click', onClick);

		await press(user, item, 10, 25);
		await movePointer(user, item, 10, 35);
		await movePointer(user, item, 10, 75);
		await release(user, item);

		// Without this the drop also *activates* the row it moved — which is how dragging a column in
		// the data table's `View` list used to toggle that column's visibility.
		expect(onClick).not.toHaveBeenCalled();
		expect(itemValues(container)).toEqual(['b', 'a', 'c', 'd']);
	});

	it('leaves an ordinary click on an item alone', async () => {
		const user = userEvent.setup();
		const onClick = vi.fn();
		const { container } = renderHarness();
		stubVerticalLayout(container);
		const item = itemFor(container, 'a');
		item.addEventListener('click', onClick);

		// No movement, so no session is ever opened and nothing is armed to swallow.
		await press(user, item, 10, 25);
		await release(user, item);

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('leaves the click after a keyboard drag alone', async () => {
		const user = userEvent.setup();
		const onClick = vi.fn();
		const { container } = renderHarness();
		const item = itemFor(container, 'a');
		item.addEventListener('click', onClick);

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');

		// A keyboard drop is not followed by a synthesised click, so arming the suppressor there
		// would only strand it — ready to eat the user's next real click.
		await user.click(item);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('shows a dragging overlay for the duration of the drag only', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ withOverlay: true });
		stubVerticalLayout(container);
		const item = itemFor(container, 'a');

		await press(user, item, 10, 25);
		await movePointer(user, item, 10, 75);

		const overlay = overlayElement();
		expect(overlay).toHaveAttribute('data-dragging', '');
		expect(overlay).toHaveAttribute('aria-hidden', 'true');

		await release(user, item);
		expect(overlayElement()).toBeNull();
	});

	it('does not start a drag below the movement threshold', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ withOverlay: true });
		stubVerticalLayout(container);
		const item = itemFor(container, 'a');

		await press(user, item, 10, 25);
		await movePointer(user, item, 12, 27);

		expect(overlayElement()).toBeNull();
		await release(user, item);
	});

	it('commits nothing when released outside every droppable', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onDragEnd = vi.fn();
		const onDragCancel = vi.fn();
		const { container } = renderHarness({ modifiers: [], onValueChange, onDragEnd, onDragCancel });
		stubVerticalLayout(container);
		const item = itemFor(container, 'a');

		await press(user, item, 10, 25);
		await movePointer(user, item, 10, 35);
		await movePointer(user, item, 10, 900);
		await release(user, item);

		expect(onValueChange).not.toHaveBeenCalled();
		expect(liveText(container)).toBe('Sortable item "a" dropped. No changes were made.');

		// T028 — a release with nothing under it is a cancellation, not an end, even though the
		// announcement keeps upstream's "dropped, no changes were made" wording.
		expect(onDragCancel).toHaveBeenCalledTimes(1);
		expect(onDragCancel).toHaveBeenCalledWith({ active: { id: 'a' }, over: null });
		expect(onDragEnd).not.toHaveBeenCalled();
	});

	it('starts a touch drag only after the activation delay', async () => {
		vi.useFakeTimers();
		try {
			const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
			const { container } = renderHarness({ withOverlay: true });
			stubVerticalLayout(container);
			const item = itemFor(container, 'a');

			// A finger that moves before the hold elapses is scrolling, not dragging.
			await user.pointer({
				keys: '[TouchA>]',
				target: item,
				coords: { clientX: 10, clientY: 25 }
			});
			await user.pointer({
				pointerName: 'TouchA',
				target: item,
				coords: { clientX: 10, clientY: 75 }
			});
			expect(overlayElement()).toBeNull();
			await user.pointer({ keys: '[/TouchA]', target: item });

			await user.pointer({
				keys: '[TouchA>]',
				target: item,
				coords: { clientX: 10, clientY: 25 }
			});
			vi.advanceTimersByTime(300);
			await user.pointer({
				pointerName: 'TouchA',
				target: item,
				coords: { clientX: 10, clientY: 75 }
			});
			expect(overlayElement()).not.toBeNull();
			await user.pointer({ keys: '[/TouchA]', target: item });

			expect(itemValues(container)).toEqual(['b', 'a', 'c', 'd']);
		} finally {
			vi.useRealTimers();
		}
	});

	it('starts a drag only from the handle when one is present', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({
			asHandle: false,
			withHandle: true,
			withOverlay: true
		});
		stubVerticalLayout(container);
		const item = itemFor(container, 'a');

		await press(user, item, 10, 25);
		await movePointer(user, item, 10, 75);
		expect(overlayElement()).toBeNull();
		await release(user, item);

		const handle = bySlot(item, 'sortable-item-handle');
		await press(user, handle, 10, 25);
		await movePointer(user, handle, 10, 75);
		expect(overlayElement()).not.toBeNull();
		await release(user, handle);

		expect(itemValues(container)).toEqual(['b', 'a', 'c', 'd']);
	});

	it('drives the overlay content from the active identifier', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ withOverlay: true, dynamicOverlay: true });

		expect(document.body.querySelector('[data-testid="overlay-preview"]')).toBeNull();

		await grab(user, activatorFor(container, 'c'));
		expect(document.body.querySelector('[data-testid="overlay-preview"]')).toHaveTextContent(
			'Pizza Guy'
		);

		await user.keyboard('{Escape}');
		expect(document.body.querySelector('[data-testid="overlay-preview"]')).toBeNull();
	});

	it('renders a sortable item inside the overlay', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ withOverlay: true, overlayItem: true });

		await grab(user, activatorFor(container, 'a'));

		const preview = document.body.querySelector('[data-testid="overlay-item"]');
		expect(preview).toHaveAttribute('data-slot', 'sortable-item');
		expect(preview).not.toHaveAttribute('data-dragging');
	});

	it('leaves the drag source in place while an overlay is mounted', async () => {
		const user = userEvent.setup();
		const { container } = renderHarness({ withOverlay: true });
		stubVerticalLayout(container);
		const item = itemFor(container, 'a');

		await press(user, item, 10, 25);
		await movePointer(user, item, 10, 75);

		expect(item.getAttribute('style') ?? '').not.toContain('translate3d');
		await release(user, item);
	});

	it('reorders a primitive array with no getItemValue', async () => {
		const user = userEvent.setup();
		const onPrimitiveValueChange = vi.fn();
		const { container } = renderHarness({ mode: 'primitive', onPrimitiveValueChange });

		await grab(user, activatorFor(container, 'a'));
		await user.keyboard('{ArrowDown}');
		await user.keyboard(' ');

		expect(onPrimitiveValueChange).toHaveBeenCalledWith(['b', 'a', 'c', 'd']);
		expect(itemValues(container)).toEqual(['b', 'a', 'c', 'd']);
	});
});
