import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MasonryState, type MasonryStateProps } from './index.js';
import Harness, { type MasonryHarnessItem } from './masonry.test.svelte';

// ---------------------------------------------------------------------------
// Stubs (research R-09)
//
// jsdom measures nothing: `offsetWidth`/`offsetHeight` are always 0, `documentElement.client*` is 0,
// and `tests/setup.ts` ships a no-op `ResizeObserver`. Masonry is a measurement-driven layout, so a
// suite that did not fake those three would silently assert on an empty layout. Everything below is
// installed per suite and restored in `afterEach` — no global config is touched.
// ---------------------------------------------------------------------------

const CLIENT_WIDTH = 620;
const CLIENT_HEIGHT = 500;

type PropertyBackup = { target: object; key: string; descriptor: PropertyDescriptor | undefined };

const backups: PropertyBackup[] = [];

function override(target: object, key: string, descriptor: PropertyDescriptor) {
	backups.push({ target, key, descriptor: Object.getOwnPropertyDescriptor(target, key) });
	Object.defineProperty(target, key, { configurable: true, ...descriptor });
}

function restoreOverrides() {
	while (backups.length > 0) {
		const backup = backups.pop();
		if (!backup) continue;
		if (backup.descriptor) Object.defineProperty(backup.target, backup.key, backup.descriptor);
		else Reflect.deleteProperty(backup.target, backup.key);
	}
}

/** Elements observed by the fake `ResizeObserver`, so a test can drive a content resize. */
const observed = new Set<Element>();
let notifyResize: ((entries: { target: Element }[]) => void) | null = null;

/** Pending `requestAnimationFrame` callbacks, flushed deterministically by {@link settle}. */
let frames: { id: number; callback: FrameRequestCallback }[] = [];
let nextFrameId = 1;

function setClientSize(width: number, height: number) {
	override(document.documentElement, 'clientWidth', { get: () => width });
	override(document.documentElement, 'clientHeight', { get: () => height });
}

function installStubs(width = CLIENT_WIDTH, height = CLIENT_HEIGHT) {
	setClientSize(width, height);

	// An item declares its own height through `data-test-height`; everything else measures as the
	// full document width, which is what a `width: 100%` masonry root does in a browser.
	override(HTMLElement.prototype, 'offsetHeight', {
		get(this: HTMLElement) {
			return Number(this.getAttribute('data-test-height') ?? 0);
		}
	});
	override(HTMLElement.prototype, 'offsetWidth', {
		get(this: HTMLElement) {
			const own = this.getAttribute('data-test-width');
			return own === null ? document.documentElement.clientWidth : Number(own);
		}
	});
	override(HTMLElement.prototype, 'offsetTop', { get: () => 0 });
	override(HTMLElement.prototype, 'offsetParent', { get: () => null });

	vi.stubGlobal(
		'ResizeObserver',
		class FakeResizeObserver {
			constructor(callback: (entries: { target: Element }[]) => void) {
				notifyResize = callback;
			}
			observe(element: Element) {
				observed.add(element);
			}
			unobserve(element: Element) {
				observed.delete(element);
			}
			disconnect() {
				observed.clear();
			}
		}
	);

	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		const id = nextFrameId++;
		frames.push({ id, callback });
		return id;
	});
	vi.stubGlobal('cancelAnimationFrame', (id: number) => {
		frames = frames.filter((frame) => frame.id !== id);
	});
}

/**
 * Run every pending frame, flushing reactive updates between rounds, until the layout stops
 * scheduling work. Each round measures one hidden batch, so a long list needs several.
 */
function settle(maxRounds = 60) {
	// Three quiet rounds rather than one: a structural change invalidates the positioner during a
	// flush, and the item effects that depend on it only re-report on the *next* one, so a single
	// empty frame queue does not mean the layout has converged.
	let quiet = 0;
	for (let round = 0; round < maxRounds && quiet < 3; round++) {
		flushSync();
		const pending = frames;
		frames = [];
		for (const frame of pending) frame.callback(0);
		quiet = pending.length === 0 ? quiet + 1 : 0;
	}
	flushSync();
}

/** Report a new height for an already-observed element and let the observer re-flow the layout. */
function resizeItem(element: HTMLElement, height: number) {
	element.setAttribute('data-test-height', String(height));
	notifyResize?.([{ target: element }]);
	settle();
}

function setScrollY(value: number) {
	override(window, 'scrollY', { get: () => value });
}

/**
 * Fake only the timer functions masonry debounces and throttles on.
 *
 * Vitest's default `toFake` set also swaps `requestAnimationFrame`, which would take the frame queue
 * away from {@link settle} and stall every layout pass in the test.
 */
function useTimers() {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

function bySlot(container: HTMLElement, slot: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function items(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>('[data-slot="masonry-item"]'));
}

function itemById(container: HTMLElement, id: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-item-id="${id}"]`);
	if (!element) throw new Error(`item "${id}" is not currently rendered`);
	return element;
}

function indicesOf(container: HTMLElement): number[] {
	return items(container)
		.map((element) => Number(element.getAttribute('data-index')))
		.sort((a, b) => a - b);
}

/**
 * `{ top, inset-inline-start, … }` read straight off an item's inline style. Svelte normalises the
 * `style` attribute it writes — one space after every `:` and `;` — so the reader tolerates both.
 */
function positionOf(element: HTMLElement) {
	const style = element.getAttribute('style') ?? '';
	const read = (property: string) => {
		const match = new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`).exec(style);
		return match ? match[1].trim() : undefined;
	};
	return {
		top: read('top'),
		start: read('inset-inline-start'),
		visibility: read('visibility'),
		width: read('width'),
		column: element.getAttribute('data-column-index')
	};
}

/** Six items whose heights land three per column at the default 620px / 3-column layout. */
const ITEMS: MasonryHarnessItem[] = [
	{ id: 'a', height: 100 },
	{ id: 'b', height: 200 },
	{ id: 'c', height: 150 },
	{ id: 'd', height: 50 },
	{ id: 'e', height: 300 },
	{ id: 'f', height: 120 }
];

function renderMasonry(props: Record<string, unknown> = {}) {
	const result = render(Harness, { props: { items: ITEMS, ...props } });
	settle();
	return result;
}

beforeEach(() => {
	frames = [];
	observed.clear();
	notifyResize = null;
	installStubs();
});

afterEach(() => {
	restoreOverrides();
	vi.unstubAllGlobals();
	vi.useRealTimers();
	frames = [];
});

// ---------------------------------------------------------------------------
// Structure, props and defaults (T006, US1)
// ---------------------------------------------------------------------------

describe('Masonry structure and defaults (T006, US1)', () => {
	it('renders the root, the sizing viewport and one element per item', () => {
		const { container } = renderMasonry();

		const root = bySlot(container, 'masonry');
		const viewport = bySlot(container, 'masonry-viewport');

		expect(root).toHaveAttribute('data-slot', 'masonry');
		expect(viewport.parentElement).toBe(root);
		expect(items(container)).toHaveLength(ITEMS.length);
	});

	it('gives the root the documented positioning declarations', () => {
		const { container } = renderMasonry();

		expect(bySlot(container, 'masonry')).toHaveAttribute(
			'style',
			'position: relative; width: 100%; height: 100%;'
		);
	});

	it('appends a caller style after its own declarations so the caller wins', () => {
		const { container } = renderMasonry({ style: 'height:50%;' });

		// Svelte collapses the duplicate declaration, keeping the one written last — the caller's.
		expect(bySlot(container, 'masonry').getAttribute('style')).toBe(
			'position: relative; width: 100%; height: 50%;'
		);
	});

	it('merges a caller class onto the root', () => {
		const { container } = renderMasonry({ class: 'bg-muted' });

		expect(bySlot(container, 'masonry')).toHaveClass('bg-muted');
	});

	it('forwards arbitrary restProps to the root element', () => {
		const { container } = renderMasonry({
			id: 'gallery',
			'aria-label': 'Tricks',
			'data-testid': 'root'
		});

		const root = bySlot(container, 'masonry');
		expect(root).toHaveAttribute('id', 'gallery');
		expect(root).toHaveAttribute('aria-label', 'Tricks');
		expect(root).toHaveAttribute('data-testid', 'root');
	});

	it('derives three 206px columns from the default columnWidth of 200', () => {
		const { container } = renderMasonry();

		expect(positionOf(itemById(container, 'a')).width).toBe('206px');
		expect(new Set(items(container).map((item) => item.getAttribute('data-column-index')))).toEqual(
			new Set(['0', '1', '2'])
		);
	});

	it('assigns every item to the then-shortest column, matching the pure algorithm', () => {
		const { container } = renderMasonry();

		expect(items(container).map((item) => item.getAttribute('data-column-index'))).toEqual([
			'0',
			'1',
			'2',
			'0',
			'0',
			'2'
		]);
	});

	it('positions items with top and the direction-agnostic inset-inline-start', () => {
		const { container } = renderMasonry();

		expect(positionOf(itemById(container, 'a'))).toMatchObject({
			top: '0px',
			start: '0px',
			visibility: 'visible'
		});
		expect(positionOf(itemById(container, 'd'))).toMatchObject({ top: '100px', start: '0px' });
		expect(positionOf(itemById(container, 'f'))).toMatchObject({ top: '150px', start: '412px' });
	});

	it('never writes a physical left offset', () => {
		const { container } = renderMasonry();

		for (const item of items(container)) {
			expect(item.getAttribute('style')).not.toMatch(/(?:^|;)left:/);
		}
	});

	it('sizes the viewport to the tallest column once everything is measured', () => {
		const { container } = renderMasonry();

		// Columns settle at 450 / 200 / 270 tall.
		expect(bySlot(container, 'masonry-viewport').getAttribute('style')).toContain(
			'height: 450px; max-height: 450px;'
		);
	});

	it('exposes data-index and data-column-index on every item', () => {
		const { container } = renderMasonry();

		expect(indicesOf(container)).toEqual([0, 1, 2, 3, 4, 5]);
		expect(itemById(container, 'a')).toHaveAttribute('data-index', '0');
		expect(itemById(container, 'a')).toHaveAttribute('data-column-index', '0');
	});

	it('carries no data-scrolling and no data-measuring at rest', () => {
		const { container } = renderMasonry();

		expect(bySlot(container, 'masonry')).not.toHaveAttribute('data-scrolling');
		for (const item of items(container)) {
			expect(item).not.toHaveAttribute('data-measuring');
		}
	});

	it('appends a caller item style after the positioning declarations, so the caller wins', () => {
		const { container } = renderMasonry({ itemStyle: 'top:999px;' });

		// Item `a` is positioned at top 0, but the caller's own `top` is written last and survives.
		expect(positionOf(itemById(container, 'a')).top).toBe('999px');
		expect(positionOf(itemById(container, 'a')).start).toBe('0px');
	});

	it('merges a caller item class', () => {
		const { container } = renderMasonry({ itemClass: 'rounded-md' });

		expect(itemById(container, 'a')).toHaveClass('rounded-md');
	});

	it('binds the root and the first item refs back to the caller', () => {
		const seen: { root: HTMLElement | null; item: HTMLElement | null }[] = [];
		const { container } = renderMasonry({
			onRefs: (refs: { root: HTMLElement | null; item: HTMLElement | null }) => seen.push(refs)
		});

		const last = seen.at(-1);
		expect(last?.root).toBe(bySlot(container, 'masonry'));
		expect(last?.item).toBe(itemById(container, 'a'));
	});
});

// ---------------------------------------------------------------------------
// Explicit column count — the controlled/uncontrolled analogue (T006, US1)
// ---------------------------------------------------------------------------

describe('Masonry column configuration (T006, US1)', () => {
	it('derives the column count from the container width by default', () => {
		const { container } = renderMasonry({ columnWidth: 300 });

		// floor(620 / 300) === 2 columns of floor(620 / 2) === 310.
		expect(positionOf(itemById(container, 'a')).width).toBe('310px');
		expect(itemById(container, 'c')).toHaveAttribute('data-column-index', '0');
	});

	it('lets an explicit columnCount win over the width-derived count', () => {
		const { container } = renderMasonry({ columnCount: 2 });

		expect(positionOf(itemById(container, 'a')).width).toBe('310px');
		expect(new Set(items(container).map((item) => item.getAttribute('data-column-index')))).toEqual(
			new Set(['0', '1'])
		);
	});

	it('caps the derived count with maxColumnCount', () => {
		const { container } = renderMasonry({ maxColumnCount: 2 });

		expect(positionOf(itemById(container, 'a')).width).toBe('310px');
	});

	it('makes maxColumnCount inert once columnCount is explicit', () => {
		const { container } = renderMasonry({ columnCount: 3, maxColumnCount: 2 });

		expect(positionOf(itemById(container, 'a')).width).toBe('206px');
		expect(new Set(items(container).map((item) => item.getAttribute('data-column-index')))).toEqual(
			new Set(['0', '1', '2'])
		);
	});

	it('applies an asymmetric gap on each axis independently', () => {
		const { container } = renderMasonry({ columnCount: 3, gap: { column: 16, row: 24 } });

		// floor((620 - 16 * 2) / 3) === 196, so the horizontal step is 196 + 16 === 212.
		expect(positionOf(itemById(container, 'b')).start).toBe('212px');
		// Item d follows item a (height 100) in column 0, offset by the 24px row gap.
		expect(positionOf(itemById(container, 'd')).top).toBe('124px');
	});

	it('treats a numeric gap as both axes', () => {
		const { container } = renderMasonry({ columnCount: 3, gap: 10 });

		expect(positionOf(itemById(container, 'b')).start).toBe('210px');
		expect(positionOf(itemById(container, 'd')).top).toBe('110px');
	});

	it('lays items out round-robin when linear is set', () => {
		const equal: MasonryHarnessItem[] = Array.from({ length: 6 }, (_, index) => ({
			id: `n${index}`,
			height: 100
		}));
		const { container } = renderMasonry({ items: equal, columnCount: 3, linear: true });

		expect(items(container).map((item) => item.getAttribute('data-column-index'))).toEqual([
			'0',
			'1',
			'2',
			'0',
			'1',
			'2'
		]);
	});
});

// ---------------------------------------------------------------------------
// child snippets (T006)
// ---------------------------------------------------------------------------

describe('Masonry child snippets (T006)', () => {
	it('renders the caller element for the root and hands it the documented payload', () => {
		const { container } = renderMasonry({ mode: 'root-child' });

		const root = container.querySelector<HTMLElement>('[data-testid="root-child"]');
		expect(root?.tagName).toBe('SECTION');
		expect(root).toHaveAttribute('data-slot', 'masonry');
		expect(root).toHaveAttribute('dir', 'ltr');
		expect(root).toHaveAttribute('style', 'position: relative; width: 100%; height: 100%;');
	});

	it('renders the caller element for an item and positions it exactly as the default div', () => {
		const { container } = renderMasonry({ mode: 'item-child' });

		const first = container.querySelector<HTMLElement>('[data-testid="item-child"]');
		expect(first?.tagName).toBe('ARTICLE');
		expect(first).toHaveAttribute('data-slot', 'masonry-item');
		expect(first).toHaveAttribute('data-index', '0');
		expect(positionOf(first as HTMLElement)).toMatchObject({
			top: '0px',
			start: '0px',
			visibility: 'visible',
			column: '0'
		});
	});

	it('keeps the rest of the list positioned identically when one item uses child', () => {
		const plain = renderMasonry();
		const childMode = renderMasonry({ mode: 'item-child' });

		expect(positionOf(itemById(childMode.container, 'd'))).toEqual(
			positionOf(itemById(plain.container, 'd'))
		);
	});
});

// ---------------------------------------------------------------------------
// Guard rails (T006)
// ---------------------------------------------------------------------------

describe('Masonry guard rails (T006)', () => {
	it('throws when Masonry.Item is rendered without Masonry.Root', () => {
		expect(() => render(Harness, { props: { mode: 'bare-item' } })).toThrow(/must be used within/);
	});

	it('names both the part and the provider in the thrown message', () => {
		expect(() => render(Harness, { props: { mode: 'bare-item' } })).toThrow(
			'`<Masonry.Item>` must be used within `<Masonry.Root>`.'
		);
	});
});

// ---------------------------------------------------------------------------
// Accessibility (T007)
//
// Upstream renders role-less `<div>`s for both parts, registers no `aria-*` and no key handler, and
// no WAI-ARIA pattern covers a flow layout (research R-11). The assertions below are therefore about
// the properties that *are* meaningful for a layout container.
// ---------------------------------------------------------------------------

describe('Masonry accessibility (T007)', () => {
	it('keeps both parts role-neutral divs', () => {
		const { container } = renderMasonry();

		const root = bySlot(container, 'masonry');
		expect(root.tagName).toBe('DIV');
		expect(root).not.toHaveAttribute('role');
		expect(root).not.toHaveAttribute('aria-hidden');

		for (const item of items(container)) {
			expect(item.tagName).toBe('DIV');
			expect(item).not.toHaveAttribute('role');
		}
	});

	it('adds no aria attributes of its own to the viewport', () => {
		const { container } = renderMasonry();

		const viewport = bySlot(container, 'masonry-viewport');
		expect(viewport).not.toHaveAttribute('role');
		expect(viewport.getAttributeNames().filter((name) => name.startsWith('aria-'))).toEqual([]);
	});

	it('reaches focusable content in source order, whatever column an item landed in', async () => {
		const user = userEvent.setup();
		const { container } = renderMasonry({ withFocusable: true });

		// Items a, b and c sit in columns 0, 1 and 2 respectively — DOM order still follows source.
		expect(itemById(container, 'b')).toHaveAttribute('data-column-index', '1');

		await user.tab();
		expect(document.activeElement).toHaveTextContent('focus a');
		await user.tab();
		expect(document.activeElement).toHaveTextContent('focus b');
		await user.tab();
		expect(document.activeElement).toHaveTextContent('focus c');
	});

	it('renders the hidden measurement batch out of the accessibility tree', () => {
		// No `settle()`: this is the state between the mount effect and the first scheduled frame,
		// which is exactly when the batch is on screen purely to be measured.
		const { container } = render(Harness, { props: { items: ITEMS } });

		const measuring = items(container);
		expect(measuring.length).toBeGreaterThan(0);
		for (const item of measuring) {
			expect(item).toHaveAttribute('data-measuring', '');
			expect(positionOf(item).visibility).toBe('hidden');
			expect(item).not.toBeVisible();
		}
	});

	it('drops data-measuring and makes the items visible once they are measured', () => {
		const { container } = render(Harness, { props: { items: ITEMS } });
		settle();

		for (const item of items(container)) {
			expect(item).not.toHaveAttribute('data-measuring');
			expect(item).toBeVisible();
		}
	});
});

// ---------------------------------------------------------------------------
// Keyboard (T008)
//
// Upstream's key map is empty, so parity means *nothing is intercepted*. Every key below must reach
// the caller's content with `defaultPrevented === false`.
// ---------------------------------------------------------------------------

describe('Masonry keyboard interactions (T008)', () => {
	const KEYS = [
		'{ArrowUp}',
		'{ArrowDown}',
		'{ArrowLeft}',
		'{ArrowRight}',
		'{Home}',
		'{End}',
		'{Enter}',
		'{Escape}',
		'[Space]'
	];

	it('intercepts no key pressed inside an item', async () => {
		const user = userEvent.setup();
		const { container } = renderMasonry({ withFocusable: true });

		const seen: { key: string; prevented: boolean }[] = [];
		container.addEventListener('keydown', (event) =>
			seen.push({ key: event.key, prevented: event.defaultPrevented })
		);

		await user.tab();
		for (const key of KEYS) await user.keyboard(key);

		expect(seen).toHaveLength(KEYS.length);
		expect(seen.every((entry) => !entry.prevented)).toBe(true);
	});

	it('leaves the layout untouched while keys are pressed', async () => {
		const user = userEvent.setup();
		const { container } = renderMasonry({ withFocusable: true });

		const before = positionOf(itemById(container, 'd'));
		await user.tab();
		for (const key of KEYS) await user.keyboard(key);

		expect(positionOf(itemById(container, 'd'))).toEqual(before);
	});

	it('lets Tab move focus out of the masonry instead of trapping it', async () => {
		const user = userEvent.setup();
		renderMasonry({ withFocusable: true });

		for (let press = 0; press <= ITEMS.length; press++) await user.tab();

		expect(document.activeElement).toBe(document.body);
	});
});

// ---------------------------------------------------------------------------
// RTL (T009, SC-005)
// ---------------------------------------------------------------------------

describe('Masonry RTL (T009)', () => {
	it('resolves ltr when no direction is declared anywhere', () => {
		const { container } = renderMasonry();

		expect(bySlot(container, 'masonry')).toHaveAttribute('dir', 'ltr');
	});

	it('writes the direction published by an ancestor DirectionProvider onto the root', () => {
		const { container } = renderMasonry({ mode: 'rtl-provider', providerDir: 'rtl' });

		expect(bySlot(container, 'masonry')).toHaveAttribute('dir', 'rtl');
	});

	it('lets an explicit dir prop win over the provider', () => {
		const { container } = renderMasonry({ mode: 'rtl-provider', providerDir: 'rtl', dir: 'ltr' });

		expect(bySlot(container, 'masonry')).toHaveAttribute('dir', 'ltr');
	});

	it('anchors items on inset-inline-start rather than a physical edge in rtl', () => {
		const { container } = renderMasonry({ mode: 'rtl-provider', providerDir: 'rtl' });

		for (const item of items(container)) {
			expect(item.getAttribute('style')).toContain('inset-inline-start:');
			expect(item.getAttribute('style')).not.toMatch(/(?:^|;)\s*(?:left|right):/);
		}
	});

	it('emits identical column assignments and offsets in rtl and ltr', () => {
		const ltr = renderMasonry();
		const rtl = renderMasonry({ mode: 'rtl-provider', providerDir: 'rtl' });

		for (const item of ITEMS) {
			expect(positionOf(itemById(rtl.container, item.id))).toEqual(
				positionOf(itemById(ltr.container, item.id))
			);
		}
	});
});

// ---------------------------------------------------------------------------
// Edge cases (T010)
// ---------------------------------------------------------------------------

describe('Masonry edge cases (T010)', () => {
	it('renders an empty list at zero height without erroring', () => {
		const { container } = renderMasonry({ items: [] });

		expect(items(container)).toHaveLength(0);
		expect(bySlot(container, 'masonry-viewport').getAttribute('style')).toContain(
			'height: 0px; max-height: 0px;'
		);
	});

	it('still renders exactly one column when the container is narrower than one', () => {
		setClientSize(100, CLIENT_HEIGHT);
		const { container } = renderMasonry({ columnWidth: 200 });

		expect(positionOf(itemById(container, 'a')).width).toBe('100px');
		for (const item of items(container)) {
			expect(item).toHaveAttribute('data-column-index', '0');
		}
	});

	it('behaves as gap 0 when gap is omitted', () => {
		const withoutGap = renderMasonry({ columnCount: 3 });
		const withZeroGap = renderMasonry({ columnCount: 3, gap: 0 });

		expect(positionOf(itemById(withoutGap.container, 'd'))).toEqual(
			positionOf(itemById(withZeroGap.container, 'd'))
		);
	});

	it('re-flows the remaining items when one is removed from the middle', async () => {
		const { container, rerender } = renderMasonry();
		expect(positionOf(itemById(container, 'd')).top).toBe('100px');

		const remaining = ITEMS.filter((item) => item.id !== 'c');
		await rerender({ items: remaining });
		settle();

		const fresh = render(Harness, { props: { items: remaining } });
		settle();

		for (const item of remaining) {
			expect(positionOf(itemById(container, item.id))).toEqual(
				positionOf(itemById(fresh.container, item.id))
			);
		}
	});

	it('appends an item inserted after mount to the end of the layout order', async () => {
		const { container, rerender } = renderMasonry();

		const inserted: MasonryHarnessItem[] = [
			...ITEMS.slice(0, 2),
			{ id: 'x', height: 80 },
			...ITEMS.slice(2)
		];
		await rerender({ items: inserted });
		settle();

		// Registration order, not source order: `x` registered last, so it lands after `f`.
		expect(itemById(container, 'x')).toHaveAttribute('data-index', '6');
		expect(itemById(container, 'f')).toHaveAttribute('data-index', '5');
	});

	it('lets an explicit index prop override registration order', async () => {
		const { container, rerender } = renderMasonry();

		const inserted: MasonryHarnessItem[] = [
			...ITEMS.slice(0, 2),
			{ id: 'x', height: 80, index: 2 },
			...ITEMS.slice(2)
		];
		await rerender({ items: inserted });
		settle();

		expect(itemById(container, 'x')).toHaveAttribute('data-index', '2');
	});

	it('re-flows later items in a column when one of them changes size', () => {
		const { container } = renderMasonry();
		expect(positionOf(itemById(container, 'd')).top).toBe('100px');

		// Item `a` heads column 0; `d` and `e` follow it there.
		resizeItem(itemById(container, 'a'), 400);

		expect(positionOf(itemById(container, 'd')).top).toBe('400px');
		expect(positionOf(itemById(container, 'e')).top).toBe('450px');
	});

	it('leaves the other columns alone when one item is re-measured', () => {
		const { container } = renderMasonry();
		const before = positionOf(itemById(container, 'b'));

		resizeItem(itemById(container, 'a'), 400);

		expect(positionOf(itemById(container, 'b'))).toEqual(before);
	});

	it('keeps the live item count bounded for a 200 item list', () => {
		const many: MasonryHarnessItem[] = Array.from({ length: 200 }, (_, index) => ({
			id: `i${index}`,
			height: 100
		}));
		const { container } = renderMasonry({ items: many });

		const rendered = items(container);
		expect(rendered.length).toBeGreaterThan(0);
		expect(rendered.length).toBeLessThan(many.length / 2);
	});

	it('shifts the visible index window as the page scrolls', () => {
		const many: MasonryHarnessItem[] = Array.from({ length: 200 }, (_, index) => ({
			id: `i${index}`,
			height: 100
		}));
		const { container } = renderMasonry({ items: many });
		expect(indicesOf(container)[0]).toBe(0);

		setScrollY(2000);
		window.dispatchEvent(new Event('scroll'));
		flushSync();
		settle();

		expect(indicesOf(container)[0]).toBeGreaterThan(0);
		expect(container.querySelector('[data-item-id="i0"]')).toBeNull();
	});

	it('marks the root data-scrolling for the throttle window and clears it once settled', () => {
		useTimers();
		const { container } = renderMasonry();

		setScrollY(500);
		window.dispatchEvent(new Event('scroll'));
		flushSync();
		expect(bySlot(container, 'masonry')).toHaveAttribute('data-scrolling', '');

		// The settle delay is 40 + 1000 / scrollFps, i.e. ~123ms at the default 12fps.
		vi.advanceTimersByTime(300);
		flushSync();
		expect(bySlot(container, 'masonry')).not.toHaveAttribute('data-scrolling');
	});

	it('replaces the fallback with the measured list once mounted', () => {
		const { container } = renderMasonry({ withFallback: true });

		expect(container.querySelector('[data-testid="masonry-fallback"]')).toBeNull();
		expect(bySlot(container, 'masonry-viewport')).toBeInTheDocument();
		expect(items(container)).toHaveLength(ITEMS.length);
	});
});

// ---------------------------------------------------------------------------
// SSR-safe first paint (T010, US3)
//
// The test environment compiles components for the DOM only, so the server pass is asserted on
// `MasonryState` — the single thing that gates it: `mounted` is `false` until the root's
// `$effect.pre` runs, and Svelte runs no effects on the server (research R-08).
// ---------------------------------------------------------------------------

describe('Masonry SSR fallback (T010, US3)', () => {
	function stateProps(overrides: Partial<MasonryStateProps> = {}): MasonryStateProps {
		return {
			getColumnWidth: () => 200,
			getColumnCount: () => undefined,
			getMaxColumnCount: () => undefined,
			getGap: () => 0,
			getItemHeight: () => 300,
			getDefaultWidth: () => undefined,
			getDefaultHeight: () => undefined,
			getOverscan: () => 2,
			getScrollFps: () => 12,
			getLinear: () => false,
			getDir: () => 'ltr',
			...overrides
		};
	}

	it('starts unmounted, so the first paint renders the fallback and measures nothing', () => {
		const state = new MasonryState(stateProps());

		expect(state.mounted).toBe(false);
		expect(state.isMeasuring(0)).toBe(false);
	});

	it('seeds the window size from defaultWidth and defaultHeight when there is no document', () => {
		vi.stubGlobal('document', undefined);
		const state = new MasonryState(
			stateProps({ getDefaultWidth: () => 800, getDefaultHeight: () => 600 })
		);

		expect(state.windowSize).toEqual({ width: 800, height: 600 });
	});

	it('treats both defaults as 0 when neither is declared and there is no document', () => {
		vi.stubGlobal('document', undefined);
		const state = new MasonryState(stateProps());

		expect(state.windowSize).toEqual({ width: 0, height: 0 });
	});

	it('estimates zero height for an empty, unmeasured list', () => {
		vi.stubGlobal('document', undefined);
		const state = new MasonryState(stateProps());

		expect(state.estimatedHeight).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Resize recompute (T010a, US1, FR-011/SC-004)
// ---------------------------------------------------------------------------

describe('Masonry resize recompute (T010a, US1)', () => {
	function columnIndices(container: HTMLElement): Set<string | null> {
		return new Set(items(container).map((item) => item.getAttribute('data-column-index')));
	}

	it('recomputes the column count after the debounced window resize', () => {
		useTimers();
		const { container } = renderMasonry();
		expect(columnIndices(container)).toEqual(new Set(['0', '1', '2']));

		setClientSize(400, CLIENT_HEIGHT);
		window.dispatchEvent(new Event('resize'));
		vi.advanceTimersByTime(300);
		flushSync();
		settle();

		expect(columnIndices(container)).toEqual(new Set(['0', '1']));
		expect(positionOf(itemById(container, 'a')).width).toBe('200px');
	});

	it('leaves no item unassigned after the recompute', () => {
		useTimers();
		const { container } = renderMasonry();

		setClientSize(400, CLIENT_HEIGHT);
		window.dispatchEvent(new Event('resize'));
		vi.advanceTimersByTime(300);
		flushSync();
		settle();

		expect(items(container)).toHaveLength(ITEMS.length);
		for (const item of items(container)) {
			expect(item).toHaveAttribute('data-column-index');
			expect(positionOf(item).top).toBeDefined();
		}
	});

	it('ignores a resize that has not yet cleared the debounce', () => {
		useTimers();
		const { container } = renderMasonry();

		setClientSize(400, CLIENT_HEIGHT);
		window.dispatchEvent(new Event('resize'));
		vi.advanceTimersByTime(200);
		flushSync();

		expect(columnIndices(container)).toEqual(new Set(['0', '1', '2']));
	});

	it('recomputes on orientationchange as well', () => {
		useTimers();
		const { container } = renderMasonry();

		setClientSize(400, CLIENT_HEIGHT);
		window.dispatchEvent(new Event('orientationchange'));
		vi.advanceTimersByTime(300);
		flushSync();
		settle();

		expect(columnIndices(container)).toEqual(new Set(['0', '1']));
	});
});

// ---------------------------------------------------------------------------
// The unmounted viewport branch (T026, US3, SC-002/FR-009)
//
// The suite above asserts the *replaced* half of the fallback contract: once the root has mounted,
// the fallback is gone. The half asserted here is the one that only exists before mount, which a
// full `<Masonry.Root>` render can never show because its `$effect.pre` flips `mounted` immediately.
// The harness therefore publishes a state that is never mounted and renders the internal viewport
// against it, which is the same branch a server render emits (research R-08).
// ---------------------------------------------------------------------------

describe('Masonry unmounted viewport (T026, US3)', () => {
	function renderViewport(props: Record<string, unknown> = {}) {
		const published: MasonryState[] = [];
		const result = render(Harness, {
			props: {
				mode: 'viewport-fallback',
				onState: (next: MasonryState) => published.push(next),
				...props
			}
		});

		const state = published.at(-1);
		if (!state) throw new Error('the harness published no MasonryState');
		return { ...result, state };
	}

	it('renders the fallback, and nothing else, while the state is unmounted', () => {
		const { container, state } = renderViewport({ withFallback: true });

		expect(state.mounted).toBe(false);
		expect(container.querySelector('[data-testid="masonry-fallback"]')).toBeInTheDocument();
		expect(container.querySelector('[data-slot="masonry-viewport"]')).toBeNull();
		expect(container.querySelector('[data-testid="viewport-children"]')).toBeNull();
	});

	it('swaps the fallback for the sized viewport the moment mounted flips to true', () => {
		const { container, state } = renderViewport({ withFallback: true });

		state.mounted = true;
		flushSync();

		expect(container.querySelector('[data-testid="masonry-fallback"]')).toBeNull();
		expect(bySlot(container, 'masonry-viewport')).toBeInTheDocument();
		expect(container.querySelector('[data-testid="viewport-children"]')).toBeInTheDocument();
	});

	it('still renders an empty zero-height viewport when unmounted with no fallback', () => {
		const { container, state } = renderViewport();

		expect(state.mounted).toBe(false);
		expect(container.querySelector('[data-testid="masonry-fallback"]')).toBeNull();
		expect(bySlot(container, 'masonry-viewport').getAttribute('style')).toContain(
			'height: 0px; max-height: 0px;'
		);
		expect(items(container)).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// itemHeight, overscan and scrollFps (T027, FR-006/FR-008/FR-013)
//
// `defaultWidth`/`defaultHeight` are deliberately absent: `readDocumentSize()` only consults them
// when `document` is `undefined`, which no jsdom component render can reproduce. They stay covered
// by the state-level assertions in the SSR block above.
// ---------------------------------------------------------------------------

describe('Masonry windowing props (T027)', () => {
	/** Long enough that the overscan window, not the list length, decides what stays mounted. */
	const MANY: MasonryHarnessItem[] = Array.from({ length: 200 }, (_, index) => ({
		id: `i${index}`,
		height: 100
	}));

	function viewportHeight(container: HTMLElement): number {
		const style = bySlot(container, 'masonry-viewport').getAttribute('style') ?? '';
		const match = /(?:^|;)\s*height:\s*(\d+)px/.exec(style);
		if (!match) throw new Error(`the viewport carries no height: "${style}"`);
		return Number(match[1]);
	}

	it('mounts fewer items for a smaller overscan and more for a larger one', () => {
		const tight = renderMasonry({ items: MANY, overscan: 1 });
		const base = renderMasonry({ items: MANY });
		const wide = renderMasonry({ items: MANY, overscan: 4 });

		// The window is `viewportHeight * overscan` tall, so the mounted count tracks it directly.
		expect(items(tight.container).length).toBeLessThan(items(base.container).length);
		expect(items(wide.container).length).toBeGreaterThan(items(base.container).length);
	});

	it('extrapolates the unmeasured remainder of the list from itemHeight', () => {
		const base = renderMasonry({ items: MANY });
		const taller = renderMasonry({ items: MANY, itemHeight: 600 });

		// Only the overscan window is ever measured, so the estimate is dominated by the remainder.
		expect(items(base.container).length).toBeLessThan(MANY.length);
		expect(viewportHeight(taller.container)).toBeGreaterThan(viewportHeight(base.container));
	});

	it('holds data-scrolling for the settle window scrollFps derives', () => {
		useTimers();
		const { container } = renderMasonry({ scrollFps: 4 });

		setScrollY(500);
		window.dispatchEvent(new Event('scroll'));
		flushSync();
		expect(bySlot(container, 'masonry')).toHaveAttribute('data-scrolling', '');

		// Past the default 12fps window of 40 + 1000 / 12 ≈ 123ms, short of this root's own
		// 40 + 1000 / 4 === 290ms.
		vi.advanceTimersByTime(150);
		flushSync();
		expect(bySlot(container, 'masonry')).toHaveAttribute('data-scrolling', '');

		vi.advanceTimersByTime(200);
		flushSync();
		expect(bySlot(container, 'masonry')).not.toHaveAttribute('data-scrolling');
	});
});

// ---------------------------------------------------------------------------
// The viewport's data-version (T028)
//
// Documented as externally-styleable state in `contracts/public-api.md` §3: it is the RAF-coalesced
// invalidation token, so a consumer can key an animation off a re-flow having happened.
// ---------------------------------------------------------------------------

describe('Masonry viewport data-version (T028)', () => {
	function versionOf(container: HTMLElement): number {
		const value = bySlot(container, 'masonry-viewport').getAttribute('data-version');
		if (value === null) throw new Error('the viewport carries no data-version');
		return Number(value);
	}

	it('omits data-version entirely while the state is unmounted', () => {
		const { container } = render(Harness, { props: { mode: 'viewport-fallback' } });

		expect(bySlot(container, 'masonry-viewport')).not.toHaveAttribute('data-version');
	});

	it('publishes data-version once the root has mounted and measured', () => {
		const { container } = renderMasonry();

		expect(bySlot(container, 'masonry-viewport')).toHaveAttribute('data-version');
	});

	it('increases data-version when a re-measure re-flows the layout', () => {
		const { container } = renderMasonry();
		const before = versionOf(container);

		resizeItem(itemById(container, 'a'), 400);

		expect(versionOf(container)).toBeGreaterThan(before);
	});
});
