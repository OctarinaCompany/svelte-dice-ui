import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { flushSync, tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Harness, { type ScrollerHarnessProps } from './scroller.test.svelte';
import {
	AUTO_SCROLL_INTERVAL,
	computeAxisOverflow,
	EMPTY_SCROLL_METRICS,
	getScrollerContext,
	observeScrollPosition,
	readScrollMetrics,
	Root,
	SCROLL_DIRECTIONS,
	SCROLLER_ORIENTATIONS,
	SCROLLER_TRIGGER_MODES,
	Scroller,
	ScrollerState,
	ScrollPositionState,
	setScrollerContext,
	type ScrollDirection,
	type ScrollMetrics
} from './index.js';

// ---------------------------------------------------------------------------
// Fixtures (research "Testing environment notes")
//
// jsdom performs no layout: `clientHeight`/`scrollHeight`/`scrollWidth` all report `0` and
// `scrollTop`/`scrollLeft` writes do not persist. Every component case therefore installs the six
// metrics as accessor properties backed by a plain object, so a write from `scrollByStep` is
// observable and a "scroll" can be simulated by mutating the box and dispatching `scroll` — the
// same technique `badge-overflow.test.ts` uses for widths.
// ---------------------------------------------------------------------------

/** A vertical scroller: 300px tall viewport over 1000px of content, no horizontal overflow. */
const VERTICAL: ScrollMetrics = {
	scrollTop: 0,
	scrollLeft: 0,
	clientWidth: 300,
	clientHeight: 300,
	scrollWidth: 300,
	scrollHeight: 1000
};

/** A horizontal scroller: 300px wide viewport over 1000px of content, no vertical overflow. */
const HORIZONTAL: ScrollMetrics = {
	scrollTop: 0,
	scrollLeft: 0,
	clientWidth: 300,
	clientHeight: 300,
	scrollWidth: 1000,
	scrollHeight: 300
};

/** Content that exactly fills the container on both axes. */
const EXACT_FIT: ScrollMetrics = {
	scrollTop: 0,
	scrollLeft: 0,
	clientWidth: 300,
	clientHeight: 300,
	scrollWidth: 300,
	scrollHeight: 300
};

/** The maximum scrollable distance of {@link VERTICAL} / {@link HORIZONTAL}. */
const MAX_DISTANCE = 700;

const EDGE_ATTRIBUTES = [
	'data-top-scroll',
	'data-bottom-scroll',
	'data-top-bottom-scroll',
	'data-left-scroll',
	'data-right-scroll',
	'data-left-right-scroll'
] as const;

function installMetrics(element: HTMLElement, initial: ScrollMetrics): ScrollMetrics {
	const box: ScrollMetrics = { ...initial };

	Object.defineProperty(element, 'scrollTop', {
		configurable: true,
		get: () => box.scrollTop,
		set: (value: number) => {
			box.scrollTop = value;
		}
	});
	Object.defineProperty(element, 'scrollLeft', {
		configurable: true,
		get: () => box.scrollLeft,
		set: (value: number) => {
			box.scrollLeft = value;
		}
	});
	for (const key of ['clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight'] as const) {
		Object.defineProperty(element, key, { configurable: true, get: () => box[key] });
	}

	return box;
}

/**
 * A controllable `ResizeObserver` double. `tests/setup.ts` installs a no-op shim (enough for the
 * component not to crash, not enough to drive it), so this one takes precedence for this file only.
 */
class MockResizeObserver implements ResizeObserver {
	readonly targets: Element[] = [];
	disconnectCount = 0;
	readonly #callback: ResizeObserverCallback;

	constructor(callback: ResizeObserverCallback) {
		this.#callback = callback;
		observers.push(this);
	}

	observe(target: Element): void {
		this.targets.push(target);
	}

	unobserve(target: Element): void {
		const index = this.targets.indexOf(target);
		if (index !== -1) this.targets.splice(index, 1);
	}

	disconnect(): void {
		this.disconnectCount++;
		this.targets.length = 0;
	}

	/** Test-only: run the observed callback as though the box had changed. */
	notify(): void {
		this.#callback([], this);
	}
}

let observers: MockResizeObserver[] = [];

const ORIGINAL_RESIZE_OBSERVER = globalThis.ResizeObserver;

beforeEach(() => {
	observers = [];
	globalThis.ResizeObserver = MockResizeObserver;
});

afterEach(() => {
	globalThis.ResizeObserver = ORIGINAL_RESIZE_OBSERVER;
	vi.useRealTimers();
});

function bySlot(slot: string): HTMLElement {
	const element = document.body.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function maybeSlot(slot: string): HTMLElement | null {
	return document.body.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
}

function navigationDirections(): string[] {
	return [...document.body.querySelectorAll('[data-slot="scroller-button"]')].map(
		(button) => button.getAttribute('data-direction') ?? ''
	);
}

function byDirection(direction: ScrollDirection): HTMLElement {
	const button = document.body.querySelector<HTMLElement>(
		`[data-slot="scroller-button"][data-direction="${direction}"]`
	);
	if (!button) throw new Error(`no navigation button for direction "${direction}"`);
	return button;
}

/** Which of the six mask attributes are currently set to `"true"`, in declaration order. */
function edgeAttributes(element: HTMLElement): string[] {
	return EDGE_ATTRIBUTES.filter((name) => element.getAttribute(name) === 'true');
}

function styleOf(element: HTMLElement): string {
	return element.getAttribute('style') ?? '';
}

/** Mount the harness, install metrics on the rendered scroller and run one measurement pass. */
async function setup(props: ScrollerHarnessProps = {}, metrics: ScrollMetrics = VERTICAL) {
	const result = render(Harness, { props });
	await tick();

	const element = bySlot('scroller');
	const box = installMetrics(element, metrics);
	element.dispatchEvent(new Event('scroll'));
	await tick();

	return { ...result, element, box };
}

/** Mutate the metrics box and notify the component exactly as a real scroll would. */
async function scrollTo(
	element: HTMLElement,
	box: ScrollMetrics,
	next: Partial<ScrollMetrics>
): Promise<void> {
	Object.assign(box, next);
	element.dispatchEvent(new Event('scroll'));
	await tick();
}

function fakeUser() {
	return userEvent.setup({ advanceTimers: (ms: number) => vi.advanceTimersByTime(ms) });
}

// ---------------------------------------------------------------------------
// Barrel surface (FR-011, contracts/public-api.md "Barrel")
// ---------------------------------------------------------------------------

describe('Scroller barrel', () => {
	it('exports the root under both the short name and the prefixed alias', () => {
		expect(Scroller).toBe(Root);
		expect(typeof Root).toBe('function');
	});

	it('re-exports the state class, the context helpers and the documented constants', () => {
		expect(typeof ScrollerState).toBe('function');
		expect(typeof ScrollPositionState).toBe('function');
		expect(typeof setScrollerContext).toBe('function');
		expect(typeof getScrollerContext).toBe('function');
		expect(SCROLLER_ORIENTATIONS).toEqual(['vertical', 'horizontal']);
		expect(SCROLLER_TRIGGER_MODES).toEqual(['press', 'hover', 'click']);
		expect(SCROLL_DIRECTIONS).toEqual(['up', 'down', 'left', 'right']);
		expect(AUTO_SCROLL_INTERVAL).toBe(50);
	});
});

// ---------------------------------------------------------------------------
// T005 — rendering, slots and every prop (quickstart rows 1–2)
// ---------------------------------------------------------------------------

describe('Scroller rendering and slots (T005)', () => {
	it('renders exactly one scroller element and its children', async () => {
		await setup({ itemCount: 3 });

		expect(document.body.querySelectorAll('[data-slot="scroller"]')).toHaveLength(1);
		expect(screen.getAllByTestId('item')).toHaveLength(3);
	});

	it('wraps the scroller and renders the navigation buttons before it when withNavigation is set', async () => {
		const { element } = await setup({ withNavigation: true });
		const wrapper = bySlot('scroller-wrapper');

		expect(wrapper).toHaveClass('relative', 'w-full');
		expect(wrapper).toContainElement(element);

		const down = byDirection('down');
		// `compareDocumentPosition` returns DOCUMENT_POSITION_FOLLOWING when `element` comes after.
		expect(down.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('renders no wrapper and no buttons when navigation is disabled', async () => {
		await setup();

		expect(maybeSlot('scroller-wrapper')).toBeNull();
		expect(navigationDirections()).toEqual([]);
	});
});

describe('Scroller props (T005)', () => {
	it('defaults to the vertical orientation and its overflow class', async () => {
		const { element } = await setup();

		expect(element).toHaveAttribute('data-orientation', 'vertical');
		expect(element).toHaveClass('overflow-y-auto');
	});

	it('switches to the horizontal orientation and its overflow class', async () => {
		const { element } = await setup({ orientation: 'horizontal' }, HORIZONTAL);

		expect(element).toHaveAttribute('data-orientation', 'horizontal');
		expect(element).toHaveClass('overflow-x-auto');
	});

	it('omits data-hide-scrollbar and the scrollbar-hiding classes by default', async () => {
		const { element } = await setup();

		expect(element).not.toHaveAttribute('data-hide-scrollbar');
		expect(element.className).not.toContain('scrollbar-width:none');
	});

	it('hides the native scrollbar through an attribute and three arbitrary properties', async () => {
		const { element } = await setup({ hideScrollbar: true });

		expect(element).toHaveAttribute('data-hide-scrollbar', '');
		expect(element.className).toContain('[-ms-overflow-style:none]');
		expect(element.className).toContain('[scrollbar-width:none]');
		expect(element.className).toContain('[&::-webkit-scrollbar]:hidden');
	});

	it('publishes the default shadow size as --scroll-shadow-size', async () => {
		const { element } = await setup();

		expect(styleOf(element)).toContain('--scroll-shadow-size: 40px;');
	});

	it('publishes a custom shadow size in pixels', async () => {
		const { element } = await setup({ size: 12 });

		expect(styleOf(element)).toContain('--scroll-shadow-size: 12px;');
	});

	it('shows the trailing cue with the default offset of 0', async () => {
		const { element } = await setup();

		expect(edgeAttributes(element)).toEqual(['data-bottom-scroll']);
	});

	it('suppresses a cue whose remaining hidden content sits below the offset', async () => {
		const { element, box } = await setup({ offset: 40 });
		await scrollTo(element, box, { scrollTop: MAX_DISTANCE - 30 });

		expect(edgeAttributes(element)).toEqual(['data-top-scroll']);
	});

	it('scrolls by the configured step on a click in click mode', async () => {
		const user = userEvent.setup();
		const { box } = await setup({
			withNavigation: true,
			scrollTriggerMode: 'click',
			scrollStep: 25
		});

		await user.click(byDirection('down'));

		expect(box.scrollTop).toBe(25);
	});

	it('defaults the step to 40 pixels', async () => {
		const user = userEvent.setup();
		const { box } = await setup({ withNavigation: true, scrollTriggerMode: 'click' });

		await user.click(byDirection('down'));

		expect(box.scrollTop).toBe(40);
	});

	it('accepts all three trigger modes and exposes the active one on the button', async () => {
		for (const mode of SCROLLER_TRIGGER_MODES) {
			const { unmount } = await setup({ withNavigation: true, scrollTriggerMode: mode });

			expect(byDirection('down')).toHaveAttribute('data-trigger-mode', mode);
			unmount();
		}
	});

	it('defaults the trigger mode to press', async () => {
		await setup({ withNavigation: true });

		expect(byDirection('down')).toHaveAttribute('data-trigger-mode', 'press');
	});

	it('resolves dir to ltr by default and honours an explicit dir prop', async () => {
		const { element, unmount } = await setup();
		expect(element).toHaveAttribute('dir', 'ltr');
		unmount();

		const rtl = await setup({ dir: 'rtl' });
		expect(rtl.element).toHaveAttribute('dir', 'rtl');
	});

	it('merges the caller class last so it can override the component classes', async () => {
		const { element } = await setup({ class: 'overflow-y-hidden p-4' });

		expect(element).toHaveClass('p-4', 'overflow-y-hidden');
		expect(element.className).not.toContain('overflow-y-auto');
	});

	it('appends the caller style after the custom property', async () => {
		const { element } = await setup({ style: 'color: rgb(1, 2, 3)' });

		// jsdom re-serialises the declaration list, hence the tolerated trailing semicolon; what is
		// pinned here is the order — the custom property first, so a caller declaration wins.
		expect(styleOf(element)).toMatch(/^--scroll-shadow-size: 40px;\s*color: rgb\(1, 2, 3\);?$/);
	});

	it('forwards arbitrary attributes to the rendered element', async () => {
		const { element } = await setup({ id: 'cards', 'data-testid': 'scroll-area' });

		expect(element).toHaveAttribute('id', 'cards');
		expect(element).toHaveAttribute('data-testid', 'scroll-area');
	});
});

// ---------------------------------------------------------------------------
// T006 — edge detection, `offset` asymmetry and the upstream quirks
// (quickstart rows 3–5, data-model "Edge attribute state machine")
// ---------------------------------------------------------------------------

describe('Scroller vertical edge detection (T006)', () => {
	it('exposes only the trailing cue at the top of the content', async () => {
		const { element } = await setup();

		expect(edgeAttributes(element)).toEqual(['data-bottom-scroll']);
	});

	it('exposes only the combined cue mid-scroll, with neither single attribute present', async () => {
		const { element, box } = await setup();
		await scrollTo(element, box, { scrollTop: 300 });

		expect(edgeAttributes(element)).toEqual(['data-top-bottom-scroll']);
		expect(element).not.toHaveAttribute('data-top-scroll');
		expect(element).not.toHaveAttribute('data-bottom-scroll');
	});

	it('exposes only the leading cue at the bottom of the content', async () => {
		const { element, box } = await setup();
		await scrollTo(element, box, { scrollTop: MAX_DISTANCE });

		expect(edgeAttributes(element)).toEqual(['data-top-scroll']);
	});

	it('exposes none of the six attributes when nothing overflows', async () => {
		const { element } = await setup({}, EXACT_FIT);

		expect(edgeAttributes(element)).toEqual([]);
	});

	it('recomputes on every dispatched scroll event', async () => {
		const { element, box } = await setup();

		await scrollTo(element, box, { scrollTop: 300 });
		expect(edgeAttributes(element)).toEqual(['data-top-bottom-scroll']);

		await scrollTo(element, box, { scrollTop: 0 });
		expect(edgeAttributes(element)).toEqual(['data-bottom-scroll']);
	});
});

describe('Scroller horizontal edge detection (T006)', () => {
	it('exposes only the right cue at the start of the content', async () => {
		const { element } = await setup({ orientation: 'horizontal' }, HORIZONTAL);

		expect(edgeAttributes(element)).toEqual(['data-right-scroll']);
	});

	it('exposes only the combined cue mid-scroll', async () => {
		const { element, box } = await setup({ orientation: 'horizontal' }, HORIZONTAL);
		await scrollTo(element, box, { scrollLeft: 300 });

		expect(edgeAttributes(element)).toEqual(['data-left-right-scroll']);
		expect(element).not.toHaveAttribute('data-left-scroll');
		expect(element).not.toHaveAttribute('data-right-scroll');
	});

	it('exposes only the left cue at the end of the content', async () => {
		const { element, box } = await setup({ orientation: 'horizontal' }, HORIZONTAL);
		await scrollTo(element, box, { scrollLeft: MAX_DISTANCE });

		expect(edgeAttributes(element)).toEqual(['data-left-scroll']);
	});
});

describe('Scroller offset asymmetry and upstream quirks (T006)', () => {
	it('drops the trailing cue below the offset while keeping the trailing button (research R-03)', async () => {
		const { element, box } = await setup({ offset: 40, withNavigation: true });
		await scrollTo(element, box, { scrollTop: MAX_DISTANCE - 30 });

		// The trailing *cue* applies the offset (`scrollTop + clientHeight + offset < scrollHeight`)…
		expect(element).not.toHaveAttribute('data-bottom-scroll');
		expect(element).not.toHaveAttribute('data-top-bottom-scroll');
		// …while the trailing *button* deliberately does not (`scrollTop + clientHeight <
		// scrollHeight`). Pinned so a future upstream re-sync notices a change.
		expect(navigationDirections()).toContain('down');
	});

	it('applies the offset to the leading cue and the leading button alike', async () => {
		const { element, box } = await setup({ offset: 40, withNavigation: true });
		await scrollTo(element, box, { scrollTop: 30 });

		expect(element).not.toHaveAttribute('data-top-scroll');
		expect(navigationDirections()).not.toContain('up');

		await scrollTo(element, box, { scrollTop: 50 });
		expect(edgeAttributes(element)).toEqual(['data-top-bottom-scroll']);
		expect(navigationDirections()).toContain('up');
	});

	it('still reports horizontal overflow on a vertical scroller (research R-09)', async () => {
		const { element, box } = await setup(
			{},
			{
				...VERTICAL,
				scrollWidth: 1000
			}
		);

		expect(edgeAttributes(element)).toEqual(['data-bottom-scroll', 'data-right-scroll']);

		await scrollTo(element, box, { scrollLeft: 300 });
		expect(edgeAttributes(element)).toEqual(['data-bottom-scroll', 'data-left-right-scroll']);
	});

	it('never reports vertical overflow on a horizontal scroller', async () => {
		const { element } = await setup(
			{ orientation: 'horizontal' },
			{
				...HORIZONTAL,
				scrollHeight: 1000
			}
		);

		expect(edgeAttributes(element)).toEqual(['data-right-scroll']);
	});
});

// ---------------------------------------------------------------------------
// T007 — navigation-button visibility (quickstart row 6, US2)
// ---------------------------------------------------------------------------

describe('Scroller navigation visibility (T007)', () => {
	it('shows only the direction that still hides content', async () => {
		await setup({ withNavigation: true });

		expect(navigationDirections()).toEqual(['down']);
	});

	it('shows both directions mid-scroll, in start-then-end order', async () => {
		const { element, box } = await setup({ withNavigation: true });
		await scrollTo(element, box, { scrollTop: 300 });

		expect(navigationDirections()).toEqual(['up', 'down']);
	});

	it('removes a direction once it is exhausted and restores it when content returns', async () => {
		const { element, box } = await setup({ withNavigation: true });

		await scrollTo(element, box, { scrollTop: MAX_DISTANCE });
		expect(navigationDirections()).toEqual(['up']);

		await scrollTo(element, box, { scrollTop: 0 });
		expect(navigationDirections()).toEqual(['down']);
	});

	it('renders the horizontal pair for a horizontal scroller', async () => {
		const { element, box } = await setup(
			{ orientation: 'horizontal', withNavigation: true },
			HORIZONTAL
		);

		expect(navigationDirections()).toEqual(['right']);

		await scrollTo(element, box, { scrollLeft: 300 });
		expect(navigationDirections()).toEqual(['left', 'right']);
	});

	it('renders no button for an axis with no overflow', async () => {
		await setup({ withNavigation: true }, EXACT_FIT);

		expect(navigationDirections()).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// T008 — trigger modes (quickstart row 7, US2)
// ---------------------------------------------------------------------------

describe('Scroller click trigger mode (T008)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it('scrolls exactly one step per click and no further', async () => {
		const user = fakeUser();
		const { box } = await setup({ withNavigation: true, scrollTriggerMode: 'click' });
		const down = byDirection('down');

		await user.click(down);
		expect(box.scrollTop).toBe(40);

		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 10);
		expect(box.scrollTop).toBe(40);

		await user.click(down);
		expect(box.scrollTop).toBe(80);
	});
});

describe('Scroller press trigger mode (T008)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it('does not scroll between pointerdown and the first interval tick', async () => {
		const user = fakeUser();
		const { box } = await setup({ withNavigation: true });

		await user.pointer({ keys: '[MouseLeft>]', target: byDirection('down') });

		expect(box.scrollTop).toBe(0);
	});

	it('repeats every AUTO_SCROLL_INTERVAL while held and stops on pointerup', async () => {
		const user = fakeUser();
		const { box } = await setup({ withNavigation: true });
		const down = byDirection('down');

		await user.pointer({ keys: '[MouseLeft>]', target: down });
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL);
		expect(box.scrollTop).toBe(40);

		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 2);
		expect(box.scrollTop).toBe(120);

		await user.pointer({ keys: '[/MouseLeft]', target: down });
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 5);
		expect(box.scrollTop).toBe(120);
	});

	it('stops when the pointer leaves the button while still held', async () => {
		const user = fakeUser();
		const { box } = await setup({ withNavigation: true });
		const down = byDirection('down');

		await user.pointer({ keys: '[MouseLeft>]', target: down });
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL);
		expect(box.scrollTop).toBe(40);

		await user.pointer({ target: document.body });
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 5);
		expect(box.scrollTop).toBe(40);
	});

	it('stops on pointercancel (divergence D-02)', async () => {
		const user = fakeUser();
		const { box } = await setup({ withNavigation: true });
		const down = byDirection('down');

		await user.pointer({ keys: '[MouseLeft>]', target: down });
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL);
		expect(box.scrollTop).toBe(40);

		down.dispatchEvent(new Event('pointercancel'));
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 5);
		expect(box.scrollTop).toBe(40);
	});

	it('treats a plain click as a no-op, matching upstream’s onClick override', async () => {
		const user = fakeUser();
		const { box } = await setup({ withNavigation: true });

		await user.click(byDirection('down'));
		expect(box.scrollTop).toBe(0);

		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 10);
		expect(box.scrollTop).toBe(0);
	});
});

describe('Scroller hover trigger mode (T008)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it('does not scroll between pointerenter and the first interval tick', async () => {
		const user = fakeUser();
		const { box } = await setup({ withNavigation: true, scrollTriggerMode: 'hover' });

		await user.hover(byDirection('down'));

		expect(box.scrollTop).toBe(0);
	});

	it('repeats while hovered and stops the instant the pointer leaves', async () => {
		const user = fakeUser();
		const { box } = await setup({ withNavigation: true, scrollTriggerMode: 'hover' });
		const down = byDirection('down');

		await user.hover(down);
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 2);
		expect(box.scrollTop).toBe(80);

		await user.unhover(down);
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 5);
		expect(box.scrollTop).toBe(80);
	});

	it('treats a plain click as a no-op in hover mode too', async () => {
		const user = fakeUser();
		const { box } = await setup({ withNavigation: true, scrollTriggerMode: 'hover' });
		const down = byDirection('down');

		await user.click(down);
		expect(box.scrollTop).toBe(0);

		await user.unhover(down);
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 10);
		expect(box.scrollTop).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// T009 — timer teardown (quickstart row 8, spec Edge Cases)
// ---------------------------------------------------------------------------

describe('Scroller auto-scroll teardown (T009)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it('clears the interval when the root unmounts mid-press', async () => {
		const user = fakeUser();
		const { box, unmount } = await setup({ withNavigation: true });

		await user.pointer({ keys: '[MouseLeft>]', target: byDirection('down') });
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL);
		expect(box.scrollTop).toBe(40);

		unmount();

		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 10);
		expect(box.scrollTop).toBe(40);
	});

	it('stops the repeat when the held direction becomes exhausted', async () => {
		const user = fakeUser();
		const { box } = await setup({ withNavigation: true }, { ...VERTICAL, scrollHeight: 400 });

		await user.pointer({ keys: '[MouseLeft>]', target: byDirection('down') });

		for (const expected of [40, 80, 120]) {
			vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL);
			await tick();
			expect(box.scrollTop).toBe(expected);
		}

		// 120 > the 100px of scrollable distance, so the direction is exhausted and its button —
		// which owns the interval — unmounts.
		expect(navigationDirections()).toEqual(['up']);

		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 10);
		expect(box.scrollTop).toBe(120);
	});
});

// ---------------------------------------------------------------------------
// T010 — keyboard interaction (quickstart row 9, FR-013, divergence D-04)
// ---------------------------------------------------------------------------

describe('Scroller navigation keyboard support (T010)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it('starts the press repeat on Enter keydown and stops it on keyup', async () => {
		const user = fakeUser();
		const { box } = await setup({ withNavigation: true });
		const down = byDirection('down');
		down.focus();

		await user.keyboard('[Enter>]');
		expect(box.scrollTop).toBe(0);

		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 2);
		expect(box.scrollTop).toBe(80);

		await user.keyboard('[/Enter]');
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 5);
		expect(box.scrollTop).toBe(80);
	});

	it('starts the press repeat on Space keydown and stops it on keyup', async () => {
		const user = fakeUser();
		const { box } = await setup({ withNavigation: true });
		const down = byDirection('down');
		down.focus();

		await user.keyboard('[Space>]');
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL);
		expect(box.scrollTop).toBe(40);

		await user.keyboard('[/Space]');
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 5);
		expect(box.scrollTop).toBe(40);
	});

	it('stops the press repeat when the button loses focus while the key is held', async () => {
		const user = fakeUser();
		const { box } = await setup({ withNavigation: true });
		const down = byDirection('down');
		down.focus();

		await user.keyboard('[Enter>]');
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL);
		expect(box.scrollTop).toBe(40);

		down.blur();
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 5);
		expect(box.scrollTop).toBe(40);
	});

	it('ignores keys other than Enter and Space in press mode', async () => {
		const user = fakeUser();
		const { box } = await setup({ withNavigation: true });
		byDirection('down').focus();

		await user.keyboard('[KeyA>]');
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 5);

		expect(box.scrollTop).toBe(0);
	});

	it('starts the hover repeat on focus and stops it on blur', async () => {
		const { box } = await setup({ withNavigation: true, scrollTriggerMode: 'hover' });
		const down = byDirection('down');

		down.focus();
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 2);
		expect(box.scrollTop).toBe(80);

		down.blur();
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 5);
		expect(box.scrollTop).toBe(80);
	});

	it('performs exactly one step per Enter in click mode', async () => {
		const user = fakeUser();
		const { box } = await setup({ withNavigation: true, scrollTriggerMode: 'click' });
		byDirection('down').focus();

		await user.keyboard('[Enter]');

		expect(box.scrollTop).toBe(40);
		vi.advanceTimersByTime(AUTO_SCROLL_INTERVAL * 10);
		expect(box.scrollTop).toBe(40);
	});
});

// ---------------------------------------------------------------------------
// T011 — roles and accessible names (quickstart row 10, FR-013, D-05, D-07)
// ---------------------------------------------------------------------------

describe('Scroller accessibility (T011)', () => {
	it('exposes each navigation button as a real button with a direction-specific name', async () => {
		const { element, box } = await setup({ withNavigation: true });
		await scrollTo(element, box, { scrollTop: 300 });

		const up = screen.getByRole('button', { name: 'Scroll up' });
		const down = screen.getByRole('button', { name: 'Scroll down' });

		expect(up).toHaveAttribute('type', 'button');
		expect(down).toHaveAttribute('type', 'button');
	});

	it('names the horizontal buttons after their direction', async () => {
		const { element, box } = await setup(
			{ orientation: 'horizontal', withNavigation: true },
			HORIZONTAL
		);
		await scrollTo(element, box, { scrollLeft: 300 });

		expect(screen.getByRole('button', { name: 'Scroll left' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Scroll right' })).toBeInTheDocument();
	});

	it('hides the chevron icon from assistive technology', async () => {
		await setup({ withNavigation: true });
		const icon = byDirection('down').querySelector('svg');

		expect(icon).toHaveAttribute('aria-hidden', 'true');
	});

	it('keeps a visible focus indicator on the navigation buttons (divergence D-05)', async () => {
		await setup({ withNavigation: true });

		expect(byDirection('down').className).toContain('focus-visible:ring-ring/50');
	});

	it('gives the scroll container no role and no tabindex of its own (divergence D-07)', async () => {
		const { element } = await setup();

		expect(element).not.toHaveAttribute('role');
		expect(element).not.toHaveAttribute('tabindex');
	});

	it('forwards a consumer-supplied role, tabindex and accessible name to the container', async () => {
		const { element } = await setup({
			role: 'region',
			tabindex: 0,
			'aria-label': 'Scrollable cards'
		});

		expect(element).toHaveAttribute('tabindex', '0');
		expect(screen.getByRole('region', { name: 'Scrollable cards' })).toBe(element);
	});
});

// ---------------------------------------------------------------------------
// T012 — RTL (quickstart row 11, divergence D-01, US3)
// ---------------------------------------------------------------------------

describe('Scroller RTL horizontal edges (T012)', () => {
	const RTL = {
		mode: 'default',
		orientation: 'horizontal',
		dir: 'rtl',
		withNavigation: true
	} as const;

	it('maps the logical start to the physical left edge at rest', async () => {
		const { element } = await setup(RTL, HORIZONTAL);

		expect(element).toHaveAttribute('dir', 'rtl');
		expect(edgeAttributes(element)).toEqual(['data-left-scroll']);
		expect(navigationDirections()).toEqual(['left']);
	});

	it('opens both edges once scrolled away from the logical start', async () => {
		const { element, box } = await setup(RTL, HORIZONTAL);
		// The CSS-standard RTL model runs `scrollLeft` from 0 down to -(scrollWidth - clientWidth).
		await scrollTo(element, box, { scrollLeft: -300 });

		expect(edgeAttributes(element)).toEqual(['data-left-right-scroll']);
		expect(navigationDirections()).toEqual(['left', 'right']);
	});

	it('maps the logical end to the physical right edge', async () => {
		const { element, box } = await setup(RTL, HORIZONTAL);
		await scrollTo(element, box, { scrollLeft: -MAX_DISTANCE });

		expect(edgeAttributes(element)).toEqual(['data-right-scroll']);
		expect(element).not.toHaveAttribute('data-left-scroll');
		expect(navigationDirections()).toEqual(['right']);
	});

	it('resolves rtl from an ancestor DirectionProvider as well as from the prop', async () => {
		const { element } = await setup(
			{
				mode: 'rtl-provider',
				providerDir: 'rtl',
				orientation: 'horizontal',
				withNavigation: true
			},
			HORIZONTAL
		);

		expect(element).toHaveAttribute('dir', 'rtl');
		expect(edgeAttributes(element)).toEqual(['data-left-scroll']);
		expect(navigationDirections()).toEqual(['left']);
	});

	it('leaves the vertical axis unaffected by dir', async () => {
		const { element, box } = await setup({ dir: 'rtl', withNavigation: true });

		expect(edgeAttributes(element)).toEqual(['data-bottom-scroll']);
		expect(navigationDirections()).toEqual(['down']);

		await scrollTo(element, box, { scrollTop: MAX_DISTANCE });
		expect(edgeAttributes(element)).toEqual(['data-top-scroll']);
		expect(navigationDirections()).toEqual(['up']);
	});
});

// ---------------------------------------------------------------------------
// T013 — element ownership: `child` snippet vs. the default `<div>` (rows 12–13)
// ---------------------------------------------------------------------------

describe('Scroller child snippet and ref (T013)', () => {
	it('hands the full attribute payload to the child snippet', async () => {
		const { element } = await setup({ mode: 'root-child', size: 24 }, HORIZONTAL);

		expect(element).toHaveAttribute('data-testid', 'root-child');
		expect(element).toHaveAttribute('data-slot', 'scroller');
		expect(element).toHaveAttribute('data-orientation', 'vertical');
		expect(element).toHaveAttribute('dir', 'ltr');
		expect(styleOf(element)).toContain('--scroll-shadow-size: 24px;');
		expect(element).toHaveClass('overflow-y-auto');
	});

	it('registers the consumer’s element, so cues still appear on it', async () => {
		const { element, box } = await setup({ mode: 'root-child' });

		expect(edgeAttributes(element)).toEqual(['data-bottom-scroll']);

		await scrollTo(element, box, { scrollTop: 300 });
		expect(edgeAttributes(element)).toEqual(['data-top-bottom-scroll']);
	});

	it('scrolls the consumer’s element from the navigation buttons', async () => {
		const user = userEvent.setup();
		const { box } = await setup({
			mode: 'root-child',
			withNavigation: true,
			scrollTriggerMode: 'click'
		});

		await user.click(byDirection('down'));

		expect(box.scrollTop).toBe(40);
	});

	it('does not render children in child mode', async () => {
		await setup({ mode: 'root-child', itemCount: 2 });

		expect(screen.queryAllByTestId('item')).toHaveLength(0);
		expect(screen.getAllByTestId('child-item')).toHaveLength(2);
	});

	it('populates ref in default mode and leaves it null in child mode', async () => {
		const refs: Array<HTMLDivElement | null> = [];
		const onRef = (ref: HTMLDivElement | null) => refs.push(ref);

		const { element, unmount } = await setup({ onRef });
		expect(refs.at(-1)).toBe(element);
		unmount();

		refs.length = 0;
		await setup({ mode: 'root-child', onRef });
		expect(refs.at(-1) ?? null).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// T014 — edge cases (quickstart row 14, spec "Edge Cases", SC-003)
// ---------------------------------------------------------------------------

describe('Scroller edge cases (T014)', () => {
	it('throws the documented error when the navigation button has no Scroller.Root ancestor', () => {
		expect(() => render(Harness, { props: { mode: 'bare-button' } })).toThrow(
			/must be used within `<Scroller\.Root>`/
		);
	});

	it('renders no cue and no button for content that exactly fills the container', async () => {
		const { element } = await setup({ withNavigation: true, hideScrollbar: true }, EXACT_FIT);

		expect(edgeAttributes(element)).toEqual([]);
		expect(navigationDirections()).toEqual([]);
		expect(maybeSlot('scroller-wrapper')).not.toBeNull();
	});

	it('observes the container and each of its element children', async () => {
		const { element } = await setup({ itemCount: 3 });
		const observer = observers.at(-1);

		expect(observer?.targets).toEqual([element, ...element.children]);
	});

	it('recomputes inside the resize notification itself, with no timer in between (SC-003)', async () => {
		const { element, box } = await setup({}, EXACT_FIT);
		expect(edgeAttributes(element)).toEqual([]);

		// A late-loading image growing the content: no scroll event fires, only the observer.
		box.scrollHeight = 1000;
		observers.at(-1)?.notify();
		flushSync();
		expect(edgeAttributes(element)).toEqual(['data-bottom-scroll']);

		// …and no stale attribute survives the reverse transition.
		box.scrollHeight = 300;
		observers.at(-1)?.notify();
		flushSync();
		expect(edgeAttributes(element)).toEqual([]);
	});

	it('keeps the observed child set current when children are added', async () => {
		const { element, rerender } = await setup({ itemCount: 2 });
		expect(observers.at(-1)?.targets).toHaveLength(3);

		await rerender({ itemCount: 4 });
		await tick();
		await tick();

		expect(observers.at(-1)?.targets).toEqual([element, ...element.children]);
		expect(observers.at(-1)?.targets).toHaveLength(5);
	});

	it('disconnects both observers and removes both listeners on unmount', async () => {
		const { element, unmount } = await setup();
		const observer = observers.at(-1);
		const removeEventListener = vi.spyOn(element, 'removeEventListener');
		const removeWindowListener = vi.spyOn(window, 'removeEventListener');

		unmount();

		expect(removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
		expect(removeWindowListener).toHaveBeenCalledWith('resize', expect.any(Function));
		expect(observer?.disconnectCount).toBeGreaterThanOrEqual(1);
	});
});

// ---------------------------------------------------------------------------
// T015 — the reusable detection module (quickstart row 15, FR-010)
// ---------------------------------------------------------------------------

describe('readScrollMetrics', () => {
	it('reads all six numbers off the element in one pass', () => {
		const element = document.createElement('div');
		installMetrics(element, { ...VERTICAL, scrollTop: 120, scrollLeft: -40, scrollWidth: 900 });

		expect(readScrollMetrics(element)).toEqual({
			scrollTop: 120,
			scrollLeft: -40,
			clientWidth: 300,
			clientHeight: 300,
			scrollWidth: 900,
			scrollHeight: 1000
		});
	});

	it('returns a fresh object every call, so a stored snapshot cannot tear', () => {
		const element = document.createElement('div');
		const box = installMetrics(element, VERTICAL);

		const first = readScrollMetrics(element);
		box.scrollTop = 200;
		const second = readScrollMetrics(element);

		expect(first).not.toBe(second);
		expect(first.scrollTop).toBe(0);
		expect(second.scrollTop).toBe(200);
	});

	it('seeds every field at zero before the first measurement', () => {
		expect(EMPTY_SCROLL_METRICS).toEqual({
			scrollTop: 0,
			scrollLeft: 0,
			clientWidth: 0,
			clientHeight: 0,
			scrollWidth: 0,
			scrollHeight: 0
		});
	});
});

describe('computeAxisOverflow', () => {
	it('reduces a scrollable vertical snapshot to distances and boundary flags', () => {
		expect(computeAxisOverflow({ ...VERTICAL, scrollTop: 100 }, 'vertical')).toEqual({
			scrollable: true,
			startDistance: 100,
			endDistance: 600,
			atStart: false,
			atEnd: false
		});
	});

	it('reports both boundaries and zero distances when the axis cannot scroll', () => {
		expect(computeAxisOverflow(EXACT_FIT, 'vertical')).toEqual({
			scrollable: false,
			startDistance: 0,
			endDistance: 0,
			atStart: true,
			atEnd: true
		});
	});

	it('treats the offset as the threshold for both boundaries', () => {
		const atStart = computeAxisOverflow({ ...VERTICAL, scrollTop: 40 }, 'vertical', { offset: 40 });
		expect(atStart.atStart).toBe(true);

		const past = computeAxisOverflow({ ...VERTICAL, scrollTop: 41 }, 'vertical', { offset: 40 });
		expect(past.atStart).toBe(false);

		const nearEnd = computeAxisOverflow({ ...VERTICAL, scrollTop: 670 }, 'vertical', {
			offset: 40
		});
		expect(nearEnd).toMatchObject({ endDistance: 30, atEnd: true });
	});

	it('normalises the horizontal axis for both scroll models', () => {
		const ltr = computeAxisOverflow({ ...HORIZONTAL, scrollLeft: 250 }, 'horizontal', {
			dir: 'ltr'
		});
		const rtl = computeAxisOverflow({ ...HORIZONTAL, scrollLeft: -250 }, 'horizontal', {
			dir: 'rtl'
		});

		expect(ltr.startDistance).toBe(250);
		expect(rtl.startDistance).toBe(250);
		expect(ltr).toEqual(rtl);
	});

	it('holds both documented invariants across the whole matrix', () => {
		const cases: Array<{ metrics: ScrollMetrics; offset: number }> = [];
		for (const metrics of [VERTICAL, HORIZONTAL, EXACT_FIT]) {
			for (const position of [0, 250, MAX_DISTANCE]) {
				for (const sign of [1, -1]) {
					cases.push({
						metrics: { ...metrics, scrollTop: position, scrollLeft: position * sign },
						offset: 0
					});
					cases.push({
						metrics: { ...metrics, scrollTop: position, scrollLeft: position * sign },
						offset: 40
					});
				}
			}
		}

		for (const { metrics, offset } of cases) {
			for (const axis of ['vertical', 'horizontal'] as const) {
				const scrollSize = axis === 'vertical' ? metrics.scrollHeight : metrics.scrollWidth;
				const clientSize = axis === 'vertical' ? metrics.clientHeight : metrics.clientWidth;
				const overflow = computeAxisOverflow(metrics, axis, { offset });

				expect(overflow.startDistance + overflow.endDistance).toBe(
					Math.max(0, scrollSize - clientSize)
				);
				if (!overflow.scrollable) {
					expect(overflow).toMatchObject({
						startDistance: 0,
						endDistance: 0,
						atStart: true,
						atEnd: true
					});
				}
			}
		}
	});
});

describe('observeScrollPosition', () => {
	it('measures once eagerly on subscribe', () => {
		const element = document.createElement('div');
		installMetrics(element, VERTICAL);
		const onChange = vi.fn();

		const teardown = observeScrollPosition(element, onChange);

		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenLastCalledWith(VERTICAL);
		teardown();
	});

	it('re-measures on a dispatched scroll event and on a window resize', () => {
		const element = document.createElement('div');
		const box = installMetrics(element, VERTICAL);
		const onChange = vi.fn();
		const teardown = observeScrollPosition(element, onChange);

		box.scrollTop = 120;
		element.dispatchEvent(new Event('scroll'));
		expect(onChange).toHaveBeenLastCalledWith({ ...VERTICAL, scrollTop: 120 });

		box.scrollTop = 240;
		window.dispatchEvent(new Event('resize'));
		expect(onChange).toHaveBeenLastCalledWith({ ...VERTICAL, scrollTop: 240 });

		teardown();
	});

	it('observes the element and its element children with a ResizeObserver', () => {
		const element = document.createElement('div');
		element.append(document.createElement('span'), document.createElement('span'));
		installMetrics(element, VERTICAL);
		const teardown = observeScrollPosition(element, () => {});

		expect(observers.at(-1)?.targets).toEqual([element, ...element.children]);

		teardown();
	});

	it('removes every listener and disconnects every observer on teardown', () => {
		const element = document.createElement('div');
		installMetrics(element, VERTICAL);
		const addEventListener = vi.spyOn(element, 'addEventListener');
		const removeEventListener = vi.spyOn(element, 'removeEventListener');
		const removeWindowListener = vi.spyOn(window, 'removeEventListener');
		const onChange = vi.fn();

		const teardown = observeScrollPosition(element, onChange);
		expect(addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));

		teardown();

		expect(removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
		expect(removeWindowListener).toHaveBeenCalledWith('resize', expect.any(Function));
		expect(observers.at(-1)?.disconnectCount).toBeGreaterThanOrEqual(1);

		onChange.mockClear();
		element.dispatchEvent(new Event('scroll'));
		expect(onChange).not.toHaveBeenCalled();
	});

	it('returns a no-op teardown with no window (SSR guard)', () => {
		const element = document.createElement('div');
		installMetrics(element, VERTICAL);
		const addEventListener = vi.spyOn(element, 'addEventListener');
		const onChange = vi.fn();

		vi.stubGlobal('window', undefined);
		try {
			const teardown = observeScrollPosition(element, onChange);
			expect(teardown).toBeInstanceOf(Function);
			expect(() => teardown()).not.toThrow();
		} finally {
			vi.unstubAllGlobals();
		}

		expect(onChange).not.toHaveBeenCalled();
		expect(addEventListener).not.toHaveBeenCalled();
	});
});

describe('ScrollPositionState', () => {
	it('starts on the empty seed, so nothing is reported as overflowing', () => {
		const state = new ScrollPositionState();

		expect(state.metrics).toEqual(EMPTY_SCROLL_METRICS);
		expect(state.vertical.scrollable).toBe(false);
		expect(state.horizontal.scrollable).toBe(false);
	});

	it('derives both axes from the assigned element on measure()', () => {
		const element = document.createElement('div');
		installMetrics(element, { ...VERTICAL, scrollTop: 100, scrollWidth: 1000 });

		const state = new ScrollPositionState({ getOffset: () => 40, getDir: () => 'ltr' });
		state.element = element;
		state.measure();

		expect(state.metrics.scrollTop).toBe(100);
		expect(state.vertical).toMatchObject({ startDistance: 100, endDistance: 600, atEnd: false });
		expect(state.horizontal).toMatchObject({ scrollable: true, startDistance: 0, atStart: true });
	});

	it('ignores measure() while no element is assigned', () => {
		const state = new ScrollPositionState();

		expect(() => state.measure()).not.toThrow();
		expect(state.metrics).toEqual(EMPTY_SCROLL_METRICS);
	});
});
