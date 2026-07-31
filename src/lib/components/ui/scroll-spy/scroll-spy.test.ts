import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { flushSync, tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import {
	DEFAULT_OFFSET,
	DEFAULT_ORIENTATION,
	DEFAULT_THRESHOLD,
	getDefaultScrollBehavior,
	pickTopmostEntry,
	SCROLL_SETTLE_DELAY,
	SCROLL_SPY_ORIENTATIONS,
	SectionRegistry
} from './index.js';
import Harness, {
	type ScrollSpyHarnessApi,
	type ScrollSpyHarnessProps
} from './scroll-spy.test.svelte';

// ---------------------------------------------------------------------------
// Upstream assertion checklist (T006)
//
// Ported from `.reference/diceui/docs/registry/bases/radix/test/scroll-spy.test.tsx`:
//
//  1. renders scroll spy with correct initial state ......... "renders three links ..." (T008)
//  2. changes active section when clicking on link .......... "fires onValueChange ..." (T012)
//  3. prevents default link behavior on click ............... "suppresses the browser's ..." (T012)
//  4. applies active state to correct link .................. "moves data-state ..." (T011)
//  5. supports controlled value ............................. controlled group (T014)
//  6. supports uncontrolled value with defaultValue ......... uncontrolled group (T011)
//  7. generates correct href for links ...................... "renders href ..." (T008)
//  8. sets correct id on sections ........................... "renders one id ..." (T008)
//  9. supports vertical orientation ......................... orientation group (T015)
// 10. supports horizontal orientation ....................... orientation group (T015)
// 11. calls custom onClick handler on link .................. "runs an integrator ..." (T012)
// 12. handles section registration and unregistration ....... teardown group (T018)
// 13. supports custom offset ................................ prop group (T009)
// 14. applies correct data attributes to links ............. "exposes data-slot ..." (T008)
// 15. applies correct data attributes to sections .......... "exposes data-slot ..." (T008)
// 16. handles multiple sections with same prefix ........... "renders href ..." (T008)
// 17. supports asChild prop on ScrollSpyLink ............... child-snippet group (T018a)
// 18. handles empty viewport ............................... guard-rail group (T017)
// 19. updates value when controlled prop changes ........... controlled group (T014)
//
// Upstream stubs `IntersectionObserver` but never fires it, so its passive-activation behaviour is
// untested. The stub below records each construction and exposes the callback, which lets the
// passive-activation (T010), settle-window (T012) and dynamic-registration (T018b) groups assert
// what upstream cannot (research R-10).
// ---------------------------------------------------------------------------

type ObserverCapture = {
	callback: IntersectionObserverCallback;
	options: IntersectionObserverInit | undefined;
	observed: Element[];
	disconnect: Mock<() => void>;
	instance: IntersectionObserver;
};

let observers: ObserverCapture[] = [];

class MockIntersectionObserver implements IntersectionObserver {
	readonly root: Element | Document | null;
	readonly rootMargin: string;
	readonly scrollMargin: string;
	readonly thresholds: readonly number[];
	readonly #capture: ObserverCapture;

	constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
		this.root = options?.root ?? null;
		this.rootMargin = options?.rootMargin ?? '';
		this.scrollMargin = options?.scrollMargin ?? '';
		this.thresholds = Array.isArray(options?.threshold)
			? options.threshold
			: [options?.threshold ?? 0];
		this.#capture = {
			callback,
			options,
			observed: [],
			disconnect: vi.fn(() => {}),
			instance: this
		};
		observers.push(this.#capture);
	}

	observe(target: Element): void {
		this.#capture.observed.push(target);
	}

	unobserve(target: Element): void {
		const index = this.#capture.observed.indexOf(target);
		if (index !== -1) this.#capture.observed.splice(index, 1);
	}

	disconnect(): void {
		this.#capture.disconnect();
		this.#capture.observed.length = 0;
	}

	takeRecords(): IntersectionObserverEntry[] {
		return [];
	}
}

/** Stands in for `window.scrollTo`, which jsdom declares but does not implement. */
let scrollToSpy: Mock<(options: ScrollToOptions) => void>;

function createScrollToSpy(): Mock<(options: ScrollToOptions) => void> {
	return vi.fn((options: ScrollToOptions) => {
		void options;
	});
}

beforeEach(() => {
	observers = [];
	scrollToSpy = createScrollToSpy();
	vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
	vi.stubGlobal('scrollTo', scrollToSpy);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bySlot(container: HTMLElement, slot: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function allBySlot(container: HTMLElement, slot: string): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`));
}

function setup(props: ScrollSpyHarnessProps = {}) {
	const result = render(Harness, { props });
	// The sections register in their own `$effect`, which bumps the registry version the root's
	// observer `$effect` depends on — so the observer only exists after a second flush.
	flushSync();
	return result;
}

function setupWithApi(props: ScrollSpyHarnessProps = {}) {
	let api: ScrollSpyHarnessApi | undefined;
	const result = setup({ ...props, registerApi: (next) => (api = next) });
	if (!api) throw new Error('the harness never published its imperative API');
	return { ...result, api };
}

function latestObserver(): ObserverCapture {
	const observer = observers.at(-1);
	if (!observer) throw new Error('no IntersectionObserver was constructed');
	return observer;
}

function rect(top: number): DOMRectReadOnly {
	return new DOMRect(0, top, 100, 100);
}

function entryFor(
	target: Element,
	isIntersecting: boolean,
	top: number
): IntersectionObserverEntry {
	return {
		target,
		isIntersecting,
		boundingClientRect: rect(top),
		intersectionRect: isIntersecting ? rect(top) : rect(0),
		intersectionRatio: isIntersecting ? 1 : 0,
		rootBounds: null,
		time: 0
	};
}

/** Fire the captured callback and let the wrapper's `requestAnimationFrame` batch land. */
async function fire(entries: IntersectionObserverEntry[]): Promise<void> {
	const observer = latestObserver();
	observer.callback(entries, observer.instance);
	await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
	await tick();
}

function links(container: HTMLElement): HTMLElement[] {
	return allBySlot(container, 'scroll-spy-link');
}

function sections(container: HTMLElement): HTMLElement[] {
	return allBySlot(container, 'scroll-spy-section');
}

function sectionById(container: HTMLElement, id: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-slot="scroll-spy-section"]#${id}`);
	if (!element) throw new Error(`no section with id="${id}" was rendered`);
	return element;
}

/** Replace an element's method with a spy without touching any prototype. */
function mockScrollTo(element: Element): Mock<(options: ScrollToOptions) => void> {
	const spy = vi.fn((options: ScrollToOptions) => {
		void options;
	});
	Object.defineProperty(element, 'scrollTo', { value: spy, configurable: true, writable: true });
	return spy;
}

function windowScrollTo(): Mock<(options: ScrollToOptions) => void> {
	return scrollToSpy;
}

function stubRect(element: Element, top: number): void {
	Object.defineProperty(element, 'getBoundingClientRect', {
		value: () => rect(top),
		configurable: true
	});
}

function fakeUser() {
	return userEvent.setup({ advanceTimers: (ms: number) => vi.advanceTimersByTime(ms) });
}

// ---------------------------------------------------------------------------
// Rendering and structure (T008, US1)
// ---------------------------------------------------------------------------

describe('ScrollSpy rendering and structure (T008)', () => {
	it('renders three links and three sections', () => {
		const { container } = setup({ defaultValue: 'section1' });

		expect(links(container)).toHaveLength(3);
		expect(sections(container)).toHaveLength(3);
	});

	it('renders the navigation container as a nav with an accessible name', () => {
		setup({ navLabel: 'Documentation sections' });

		const nav = screen.getByRole('navigation', { name: 'Documentation sections' });
		expect(nav.tagName).toBe('NAV');
	});

	it('renders every link with the link role', () => {
		setup();

		expect(screen.getAllByRole('link')).toHaveLength(3);
	});

	it('renders href="#id" on every link, including shared-prefix ids', () => {
		const { container } = setup({ sections: ['intro', 'introduction', 'intro-details'] });

		const [first, second, third] = links(container);
		expect(first).toHaveAttribute('href', '#intro');
		expect(second).toHaveAttribute('href', '#introduction');
		expect(third).toHaveAttribute('href', '#intro-details');
	});

	it('renders one id per section, matching its value', () => {
		const { container } = setup();

		expect(sections(container).map((section) => section.id)).toEqual([
			'section1',
			'section2',
			'section3'
		]);
	});

	it('exposes a data-slot on all five parts', () => {
		const { container } = setup();

		expect(bySlot(container, 'scroll-spy')).toBeInTheDocument();
		expect(bySlot(container, 'scroll-spy-nav')).toBeInTheDocument();
		expect(bySlot(container, 'scroll-spy-link')).toBeInTheDocument();
		expect(bySlot(container, 'scroll-spy-viewport')).toBeInTheDocument();
		expect(bySlot(container, 'scroll-spy-section')).toBeInTheDocument();
	});

	it('exposes data-orientation and data-state on every link', () => {
		const { container } = setup({ defaultValue: 'section1' });

		for (const link of links(container)) {
			expect(link).toHaveAttribute('data-slot', 'scroll-spy-link');
			expect(link).toHaveAttribute('data-orientation', 'horizontal');
			expect(link).toHaveAttribute('data-state');
		}
	});

	it('exposes data-orientation and an id on every section', () => {
		const { container } = setup();

		for (const section of sections(container)) {
			expect(section).toHaveAttribute('data-orientation', 'horizontal');
			expect(section).toHaveAttribute('id');
		}
	});

	it('marks exactly the active link with data-state="active" and aria-current', () => {
		const { container } = setup({ defaultValue: 'section2' });

		const [first, second, third] = links(container);
		expect(second).toHaveAttribute('data-state', 'active');
		expect(second).toHaveAttribute('aria-current', 'location');
		expect(first).toHaveAttribute('data-state', 'inactive');
		expect(first).not.toHaveAttribute('aria-current');
		expect(third).not.toHaveAttribute('aria-current');
	});
});

// ---------------------------------------------------------------------------
// Every prop (T009, US1)
// ---------------------------------------------------------------------------

describe('ScrollSpy props (T009)', () => {
	it('publishes the documented default constants', () => {
		expect(DEFAULT_ORIENTATION).toBe('horizontal');
		expect(DEFAULT_OFFSET).toBe(0);
		expect(DEFAULT_THRESHOLD).toBe(0.1);
		expect(SCROLL_SETTLE_DELAY).toBe(500);
		expect(SCROLL_SPY_ORIENTATIONS).toEqual(['horizontal', 'vertical']);
	});

	it('hands the default threshold and offset-derived rootMargin to the observer', () => {
		setup({ offset: 24 });

		expect(latestObserver().options).toMatchObject({
			rootMargin: '-24px 0px -70% 0px',
			threshold: DEFAULT_THRESHOLD
		});
	});

	it('lets an explicit rootMargin and threshold override the defaults', () => {
		setup({ rootMargin: '-10px 0px -50% 0px', threshold: [0, 0.5, 1] });

		expect(latestObserver().options).toMatchObject({
			rootMargin: '-10px 0px -50% 0px',
			threshold: [0, 0.5, 1]
		});
	});

	it('uses the window as the observer root when no scrollContainer is given', () => {
		setup();

		expect(latestObserver().options?.root ?? null).toBeNull();
	});

	it('uses the viewport element as the observer root when scrollContainer is given', () => {
		const { container } = setup({ useViewportAsContainer: true });

		expect(latestObserver().options?.root).toBe(bySlot(container, 'scroll-spy-viewport'));
	});

	it('scrolls the window, offset-adjusted, when no scrollContainer is given', async () => {
		const user = userEvent.setup();
		const { container } = setup({ offset: 20 });
		stubRect(sectionById(container, 'section2'), 80);

		await user.click(links(container)[1]);

		expect(windowScrollTo()).toHaveBeenCalledWith({ top: 60, behavior: 'smooth' });
	});

	it('scrolls the container, offset-adjusted by its own scrollTop, when one is given', async () => {
		const user = userEvent.setup();
		const { container } = setup({ useViewportAsContainer: true, offset: 20 });

		const viewport = bySlot(container, 'scroll-spy-viewport');
		stubRect(viewport, 10);
		Object.defineProperty(viewport, 'scrollTop', { value: 30, configurable: true });
		stubRect(sectionById(container, 'section2'), 60);
		const scrollTo = mockScrollTo(viewport);

		await user.click(links(container)[1]);

		expect(scrollTo).toHaveBeenCalledWith({ top: 60, behavior: 'smooth' });
		expect(windowScrollTo()).not.toHaveBeenCalled();
	});

	it('forwards an explicit scrollBehavior to the scroll call', async () => {
		const user = userEvent.setup();
		const { container } = setup({ scrollBehavior: 'auto' });

		await user.click(links(container)[1]);

		expect(windowScrollTo()).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
	});

	it('defaults scrollBehavior to "smooth" when reduced motion is not requested', () => {
		expect(getDefaultScrollBehavior()).toBe('smooth');
	});

	it('defaults scrollBehavior to "auto" under prefers-reduced-motion: reduce', async () => {
		const user = userEvent.setup();
		vi.stubGlobal('matchMedia', (query: string) => ({
			matches: query.includes('prefers-reduced-motion'),
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false
		}));

		expect(getDefaultScrollBehavior()).toBe('auto');

		const { container } = setup();
		await user.click(links(container)[1]);

		expect(windowScrollTo()).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
	});

	it('merges the caller class last on the root', () => {
		const { container } = setup({ class: 'border bg-background' });

		const root = bySlot(container, 'scroll-spy');
		expect(root).toHaveClass('flex', 'flex-row', 'border', 'bg-background');
	});

	it('spreads restProps onto the root element', () => {
		const { container } = setup({ 'data-testid': 'spy-root' });

		expect(bySlot(container, 'scroll-spy')).toHaveAttribute('data-testid', 'spy-root');
	});
});

// ---------------------------------------------------------------------------
// Passive activation through the observer (T010, US1, SC-001)
// ---------------------------------------------------------------------------

describe('ScrollSpy passive activation (T010)', () => {
	it('activates the topmost intersecting section of several', async () => {
		const { container } = setup({ defaultValue: 'section1' });

		await fire([
			entryFor(sectionById(container, 'section3'), true, 120),
			entryFor(sectionById(container, 'section2'), true, 40),
			entryFor(sectionById(container, 'section1'), true, 300)
		]);

		expect(links(container)[1]).toHaveAttribute('data-state', 'active');
	});

	it('ignores non-intersecting entries even when they are higher up', async () => {
		const { container } = setup({ defaultValue: 'section1' });

		await fire([
			entryFor(sectionById(container, 'section2'), false, -500),
			entryFor(sectionById(container, 'section3'), true, 10)
		]);

		expect(links(container)[2]).toHaveAttribute('data-state', 'active');
	});

	it('leaves the previous value in place when nothing intersects', async () => {
		const { container } = setup({ defaultValue: 'section1' });

		await fire([
			entryFor(sectionById(container, 'section2'), false, 10),
			entryFor(sectionById(container, 'section3'), false, 20)
		]);

		expect(links(container)[0]).toHaveAttribute('data-state', 'active');
	});

	it('ignores an entry whose id was never registered', async () => {
		const { container } = setup({ defaultValue: 'section1' });

		const stranger = document.createElement('div');
		stranger.id = 'not-registered';
		document.body.append(stranger);

		await fire([entryFor(stranger, true, 0)]);

		expect(links(container)[0]).toHaveAttribute('data-state', 'active');
		stranger.remove();
	});

	it('fires onValueChange for an observer-driven activation', async () => {
		const onValueChange = vi.fn();
		const { container } = setup({ defaultValue: 'section1', onValueChange });

		await fire([entryFor(sectionById(container, 'section3'), true, 5)]);

		expect(onValueChange).toHaveBeenCalledWith('section3');
	});

	it('picks the topmost entry as a pure reduction, and null for an empty set', () => {
		const a = document.createElement('div');
		const b = document.createElement('div');

		expect(pickTopmostEntry([entryFor(a, true, 90), entryFor(b, true, 10)])?.target).toBe(b);
		expect(pickTopmostEntry([entryFor(a, false, 10)])).toBeNull();
		expect(pickTopmostEntry([])).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Uncontrolled state (T011, US1)
// ---------------------------------------------------------------------------

describe('ScrollSpy uncontrolled state (T011)', () => {
	it('seeds the active link from defaultValue', () => {
		const { container } = setup({ defaultValue: 'section2' });

		expect(links(container)[1]).toHaveAttribute('data-state', 'active');
		expect(links(container)[0]).toHaveAttribute('data-state', 'inactive');
		expect(links(container)[2]).toHaveAttribute('data-state', 'inactive');
	});

	it('moves the active link when another one is clicked', async () => {
		const user = userEvent.setup();
		const { container } = setup({ defaultValue: 'section1' });

		await user.click(links(container)[2]);

		expect(links(container)[2]).toHaveAttribute('data-state', 'active');
		expect(links(container)[0]).toHaveAttribute('data-state', 'inactive');
	});

	it('activates no link when neither value nor defaultValue is given', () => {
		const { container } = setup();

		for (const link of links(container)) {
			expect(link).toHaveAttribute('data-state', 'inactive');
		}
	});
});

// ---------------------------------------------------------------------------
// Click to navigate (T012, US2)
// ---------------------------------------------------------------------------

describe('ScrollSpy click navigation (T012)', () => {
	it('suppresses the browser default navigation on click', () => {
		const { container } = setup({ defaultValue: 'section1' });

		const event = new MouseEvent('click', { bubbles: true, cancelable: true });
		links(container)[1].dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
	});

	it('fires onValueChange with the clicked id and activates it immediately', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const { container } = setup({ defaultValue: 'section1', onValueChange });

		await user.click(links(container)[1]);

		expect(onValueChange).toHaveBeenCalledWith('section2');
		expect(links(container)[1]).toHaveAttribute('data-state', 'active');
	});

	it('scrolls the tracked area on click', async () => {
		const user = userEvent.setup();
		const { container } = setup({ defaultValue: 'section1' });

		await user.click(links(container)[1]);

		expect(windowScrollTo()).toHaveBeenCalledTimes(1);
	});

	it('runs an integrator-supplied onclick in addition to the built-in behaviour', async () => {
		const user = userEvent.setup();
		const onLinkClick = vi.fn();
		const onValueChange = vi.fn();
		const { container } = setup({ defaultValue: 'section1', onLinkClick, onValueChange });

		await user.click(links(container)[1]);

		expect(onLinkClick).toHaveBeenCalledTimes(1);
		expect(onValueChange).toHaveBeenCalledWith('section2');
	});

	it('ignores observer entries while the post-click settle window is open', async () => {
		vi.useFakeTimers({
			toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame']
		});
		const user = fakeUser();
		const { container } = setup({ defaultValue: 'section1' });

		await user.click(links(container)[1]);
		expect(links(container)[1]).toHaveAttribute('data-state', 'active');

		const observer = latestObserver();
		observer.callback([entryFor(sectionById(container, 'section3'), true, 0)], observer.instance);
		vi.advanceTimersByTime(32);
		flushSync();

		expect(links(container)[1]).toHaveAttribute('data-state', 'active');
	});

	it('resumes observer-driven activation once the settle window has elapsed', async () => {
		vi.useFakeTimers({
			toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame']
		});
		const user = fakeUser();
		const { container } = setup({ defaultValue: 'section1' });

		await user.click(links(container)[1]);
		vi.advanceTimersByTime(SCROLL_SETTLE_DELAY + 1);

		const observer = latestObserver();
		observer.callback([entryFor(sectionById(container, 'section3'), true, 0)], observer.instance);
		vi.advanceTimersByTime(32);
		flushSync();

		expect(links(container)[2]).toHaveAttribute('data-state', 'active');
	});
});

// ---------------------------------------------------------------------------
// Keyboard navigation (T013, FR-019)
// ---------------------------------------------------------------------------

describe('ScrollSpy keyboard navigation (T013)', () => {
	it('moves focus through the links in document order with Tab', async () => {
		const user = userEvent.setup();
		const { container } = setup({ defaultValue: 'section1' });
		const [first, second, third] = links(container);

		await user.tab();
		expect(first).toHaveFocus();
		await user.tab();
		expect(second).toHaveFocus();
		await user.tab();
		expect(third).toHaveFocus();
	});

	it('activates the focused link with Enter', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const { container } = setup({ defaultValue: 'section1', onValueChange });

		links(container)[1].focus();
		await user.keyboard('{Enter}');

		expect(onValueChange).toHaveBeenCalledWith('section2');
		expect(links(container)[1]).toHaveAttribute('data-state', 'active');
	});

	// Native anchors have no `Space` activation behaviour — `Space` scrolls the page instead. The
	// upstream MDX keyboard table claims otherwise; the browser wins (research R-08).
	it('leaves the value untouched when Space is pressed on a focused link', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const { container } = setup({ defaultValue: 'section1', onValueChange });

		links(container)[1].focus();
		await user.keyboard(' ');

		expect(onValueChange).not.toHaveBeenCalled();
		expect(links(container)[0]).toHaveAttribute('data-state', 'active');
	});
});

// ---------------------------------------------------------------------------
// Controlled state (T014, US3)
// ---------------------------------------------------------------------------

describe('ScrollSpy controlled state (T014)', () => {
	it('keeps the parent authoritative: a click reports but does not move the value', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const { container } = setup({ controlled: true, initialValue: 'section1', onValueChange });

		await user.click(links(container)[1]);

		expect(onValueChange).toHaveBeenCalledWith('section2');
		expect(links(container)[0]).toHaveAttribute('data-state', 'active');
		expect(links(container)[1]).toHaveAttribute('data-state', 'inactive');
	});

	it('moves the active link when the parent changes value', async () => {
		const { container, api } = setupWithApi({ controlled: true, initialValue: 'section1' });

		api.setValue('section2');
		flushSync();
		await tick();

		expect(links(container)[1]).toHaveAttribute('data-state', 'active');
		expect(links(container)[0]).toHaveAttribute('data-state', 'inactive');
	});

	it('scrolls to the section when the parent changes value', async () => {
		const { api } = setupWithApi({ controlled: true, initialValue: 'section1' });
		expect(windowScrollTo()).not.toHaveBeenCalled();

		api.setValue('section3');
		flushSync();
		await tick();

		expect(windowScrollTo()).toHaveBeenCalledTimes(1);
	});

	it('does not scroll for the initial controlled value', () => {
		setup({ controlled: true, initialValue: 'section2' });

		expect(windowScrollTo()).not.toHaveBeenCalled();
	});

	it('does not move the value on its own when an observer entry arrives', async () => {
		const { container } = setupWithApi({ controlled: true, initialValue: 'section1' });

		await fire([entryFor(sectionById(container, 'section3'), true, 0)]);

		expect(links(container)[0]).toHaveAttribute('data-state', 'active');
	});
});

// ---------------------------------------------------------------------------
// Orientation (T015, US4)
// ---------------------------------------------------------------------------

describe('ScrollSpy orientation (T015)', () => {
	it('publishes the horizontal default on all five parts, with the upstream layout classes', () => {
		const { container } = setup();

		for (const slot of [
			'scroll-spy',
			'scroll-spy-nav',
			'scroll-spy-link',
			'scroll-spy-viewport',
			'scroll-spy-section'
		]) {
			expect(bySlot(container, slot)).toHaveAttribute('data-orientation', 'horizontal');
		}
		expect(bySlot(container, 'scroll-spy')).toHaveClass('flex', 'flex-row');
		expect(bySlot(container, 'scroll-spy-nav')).toHaveClass('flex', 'gap-2', 'flex-col');
	});

	it('publishes the vertical orientation on all five parts, inverting both axes', () => {
		const { container } = setup({ orientation: 'vertical' });

		for (const slot of [
			'scroll-spy',
			'scroll-spy-nav',
			'scroll-spy-link',
			'scroll-spy-viewport',
			'scroll-spy-section'
		]) {
			expect(bySlot(container, slot)).toHaveAttribute('data-orientation', 'vertical');
		}
		expect(bySlot(container, 'scroll-spy')).toHaveClass('flex', 'flex-col');
		expect(bySlot(container, 'scroll-spy-nav')).toHaveClass('flex', 'gap-2', 'flex-row');
	});
});

// ---------------------------------------------------------------------------
// RTL (T016, FR-015)
// ---------------------------------------------------------------------------

describe('ScrollSpy RTL support (T016)', () => {
	it('propagates an explicit dir="rtl" to the root, nav and viewport', () => {
		const { container } = setup({ dir: 'rtl' });

		expect(bySlot(container, 'scroll-spy')).toHaveAttribute('dir', 'rtl');
		expect(bySlot(container, 'scroll-spy-nav')).toHaveAttribute('dir', 'rtl');
		expect(bySlot(container, 'scroll-spy-viewport')).toHaveAttribute('dir', 'rtl');
	});

	it('honours a <DirectionProvider dir="rtl"> ancestor when no dir prop is set', () => {
		const { container } = setup({ mode: 'rtl-provider' });

		expect(bySlot(container, 'scroll-spy')).toHaveAttribute('dir', 'rtl');
		expect(bySlot(container, 'scroll-spy-nav')).toHaveAttribute('dir', 'rtl');
	});

	it('falls back to ltr with no provider and no dir prop', () => {
		const { container } = setup();

		expect(bySlot(container, 'scroll-spy')).toHaveAttribute('dir', 'ltr');
	});

	it('leaves link order and href values untouched in rtl', () => {
		const { container } = setup({ dir: 'rtl' });

		expect(links(container).map((link) => link.getAttribute('href'))).toEqual([
			'#section1',
			'#section2',
			'#section3'
		]);
	});
});

// ---------------------------------------------------------------------------
// Guard rails and edge cases (T017, FR-012, FR-014)
// ---------------------------------------------------------------------------

describe('ScrollSpy guard rails (T017)', () => {
	it.each(['Nav', 'Link', 'Viewport', 'Section'] as const)(
		'throws when %s is rendered outside a root',
		(barePart) => {
			expect(() => render(Harness, { props: { mode: 'bare-part', barePart } })).toThrow(
				/must be used within/
			);
		}
	);

	it('names both the part and its provider in the guard-rail message', () => {
		expect(() => render(Harness, { props: { mode: 'bare-part', barePart: 'Link' } })).toThrow(
			'`<ScrollSpy.Link>` must be used within `<ScrollSpy.Root>`.'
		);
	});

	it('never registers or observes a section whose value is empty', () => {
		const { container } = setup({ emptySection: true });

		const empty = container.querySelector('[data-testid="empty-section"]');
		expect(empty).toBeInTheDocument();
		expect(latestObserver().observed).toHaveLength(3);
		expect(latestObserver().observed).not.toContain(empty);
	});

	it('never activates a section whose value is empty', async () => {
		const { container } = setup({ defaultValue: 'section1', emptySection: true });
		const empty = container.querySelector('[data-testid="empty-section"]');
		if (!empty) throw new Error('the empty section was not rendered');

		await fire([entryFor(empty, true, -100)]);

		expect(links(container)[0]).toHaveAttribute('data-state', 'active');
	});

	it('still activates a link whose section is absent from the DOM, without scrolling', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const { container } = setup({ defaultValue: 'section1', orphanLink: 'nowhere', onValueChange });

		const orphan = container.querySelector<HTMLElement>('[data-testid="orphan-link"]');
		if (!orphan) throw new Error('the orphan link was not rendered');

		await user.click(orphan);

		expect(onValueChange).toHaveBeenCalledWith('nowhere');
		expect(orphan).toHaveAttribute('data-state', 'active');
		expect(windowScrollTo()).not.toHaveBeenCalled();
	});

	it('renders with an empty viewport and no sections at all', () => {
		const { container } = setup({ sections: [], defaultValue: '' });

		expect(bySlot(container, 'scroll-spy-viewport')).toBeInTheDocument();
		expect(sections(container)).toHaveLength(0);
		expect(observers).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Teardown (T018, FR-018)
// ---------------------------------------------------------------------------

describe('ScrollSpy teardown (T018)', () => {
	it('disconnects the observer, cancels the frame and clears the timeout on unmount', async () => {
		const user = userEvent.setup();
		const cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame');
		const clear = vi.spyOn(globalThis, 'clearTimeout');
		const { container, unmount } = setup({ defaultValue: 'section1' });

		// Positive assertion first, so the post-unmount check below cannot pass vacuously.
		await fire([entryFor(sectionById(container, 'section3'), true, 0)]);
		expect(links(container)[2]).toHaveAttribute('data-state', 'active');

		await user.click(links(container)[0]);
		const observer = latestObserver();
		observer.callback([entryFor(sectionById(container, 'section2'), true, 0)], observer.instance);

		unmount();

		expect(observer.disconnect).toHaveBeenCalled();
		expect(cancelFrame).toHaveBeenCalled();
		expect(clear).toHaveBeenCalled();
	});

	it('delivers no further activation after unmount', async () => {
		const onValueChange = vi.fn();
		const { container, unmount } = setup({ defaultValue: 'section1', onValueChange });

		await fire([entryFor(sectionById(container, 'section2'), true, 0)]);
		expect(onValueChange).toHaveBeenCalledWith('section2');

		const observer = latestObserver();
		onValueChange.mockClear();
		unmount();

		observer.callback([entryFor(document.createElement('div'), true, 0)], observer.instance);
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('removes every section element from the document on unmount', () => {
		const { unmount } = setup();

		expect(document.querySelectorAll('[data-slot="scroll-spy-section"]')).toHaveLength(3);
		unmount();
		expect(document.querySelectorAll('[data-slot="scroll-spy-section"]')).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// `child` snippet and `bind:ref` (T018a, FR-016)
// ---------------------------------------------------------------------------

describe('ScrollSpy child snippets and refs (T018a)', () => {
	it('exposes every part element through bind:ref in default mode', () => {
		const { api } = setupWithApi();

		const refs = api.getRefs();
		expect(refs.root).toHaveAttribute('data-slot', 'scroll-spy');
		expect(refs.nav).toHaveAttribute('data-slot', 'scroll-spy-nav');
		expect(refs.link).toHaveAttribute('data-slot', 'scroll-spy-link');
		expect(refs.viewport).toHaveAttribute('data-slot', 'scroll-spy-viewport');
		expect(refs.section).toHaveAttribute('data-slot', 'scroll-spy-section');
	});

	it('renders the caller element for the root and leaves ref null', () => {
		const { container, api } = setupWithApi({ mode: 'root-child' });

		const root = container.querySelector('[data-testid="root-child"]');
		expect(root).toHaveAttribute('data-slot', 'scroll-spy');
		expect(root).toHaveAttribute('data-orientation', 'horizontal');
		expect(root).toHaveAttribute('dir', 'ltr');
		expect(api.getRefs().root).toBeNull();
	});

	it('renders the caller element for the nav and leaves ref null', () => {
		const { container, api } = setupWithApi({ mode: 'nav-child' });

		const nav = container.querySelector('[data-testid="nav-child"]');
		expect(nav).toHaveAttribute('data-slot', 'scroll-spy-nav');
		expect(nav).toHaveAttribute('data-orientation', 'horizontal');
		expect(api.getRefs().nav).toBeNull();
	});

	it('renders the caller element for the viewport and leaves ref null', () => {
		const { container, api } = setupWithApi({ mode: 'viewport-child' });

		const viewport = container.querySelector('[data-testid="viewport-child"]');
		expect(viewport).toHaveAttribute('data-slot', 'scroll-spy-viewport');
		expect(viewport).toHaveAttribute('data-orientation', 'horizontal');
		expect(api.getRefs().viewport).toBeNull();
	});

	it('renders the caller element for a section and leaves ref null', () => {
		const { container, api } = setupWithApi({ mode: 'section-child' });

		const section = container.querySelector('[data-testid="section-child"]');
		expect(section).toHaveAttribute('data-slot', 'scroll-spy-section');
		expect(section).toHaveAttribute('id', 'section1');
		expect(api.getRefs().section).toBeNull();
	});

	it('renders the caller element for a link, carrying data-state but no href', () => {
		const { api } = setupWithApi({ mode: 'link-child', defaultValue: 'section1' });

		const button = screen.getByRole('button', { name: /custom section1/i });
		expect(button).toHaveAttribute('data-slot', 'scroll-spy-link');
		expect(button).toHaveAttribute('data-orientation', 'horizontal');
		expect(button).toHaveAttribute('data-state', 'active');
		expect(button).not.toHaveAttribute('href');
		expect(api.getRefs().link).toBeNull();
	});

	it('activates the section from a child-rendered link on click', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const { container } = setup({
			mode: 'link-child',
			defaultValue: 'section2',
			onValueChange
		});

		await user.click(screen.getByRole('button', { name: /custom section1/i }));

		expect(onValueChange).toHaveBeenCalledWith('section1');
		expect(links(container)[0]).toHaveAttribute('data-state', 'active');
	});
});

// ---------------------------------------------------------------------------
// Dynamic section registration (T018b, FR-018, research D-1)
// ---------------------------------------------------------------------------

describe('ScrollSpy dynamic section registration (T018b)', () => {
	it('re-creates the observer over the enlarged set when a section mounts later', async () => {
		const { container, api } = setupWithApi({ sections: ['section1', 'section2'] });

		const first = latestObserver();
		expect(first.observed).toHaveLength(2);

		api.setSections(['section1', 'section2', 'section3']);
		flushSync();
		await tick();

		expect(first.disconnect).toHaveBeenCalled();
		expect(latestObserver()).not.toBe(first);
		expect(latestObserver().observed).toHaveLength(3);
		expect(latestObserver().observed).toContain(sectionById(container, 'section3'));
	});

	it('unregisters a removed section so its entries can no longer activate it', async () => {
		const { container, api } = setupWithApi({
			sections: ['section1', 'section2', 'section3'],
			defaultValue: 'section1'
		});
		const removed = sectionById(container, 'section3');

		api.setSections(['section1', 'section2']);
		flushSync();
		await tick();

		expect(latestObserver().observed).toHaveLength(2);
		expect(latestObserver().observed).not.toContain(removed);

		await fire([entryFor(removed, true, -100)]);
		expect(links(container)[0]).toHaveAttribute('data-state', 'active');
	});

	it('does not bump the registry when the same id and element are registered again', () => {
		const registry = new SectionRegistry();
		const element = document.createElement('div');

		registry.register('a', element);
		const version = registry.snapshot().version;
		registry.register('a', element);

		expect(registry.snapshot().version).toBe(version);
		expect(registry.has('a')).toBe(true);
	});

	it('never registers a falsy id', () => {
		const registry = new SectionRegistry();

		registry.register('', document.createElement('div'));

		expect(registry.has('')).toBe(false);
		expect(registry.snapshot().elements).toHaveLength(0);
	});

	it('constructs no observer at all while nothing is registered', async () => {
		const { api } = setupWithApi({ sections: ['section1'] });
		expect(observers).toHaveLength(1);

		api.setSections([]);
		flushSync();
		await tick();
		await waitFor(() => expect(observers.at(-1)?.disconnect).toHaveBeenCalled());
	});
});

// ---------------------------------------------------------------------------
// Rapid repeated clicks (T038, SC-002, spec Edge Cases)
// ---------------------------------------------------------------------------

describe('ScrollSpy rapid repeated clicks (T038)', () => {
	/**
	 * Fire the captured callback under fake timers, where the wrapper's `requestAnimationFrame` batch
	 * is faked too. The 32 ms it burns counts against the settle window, so every timeline below
	 * budgets for it.
	 */
	function fireFake(entries: IntersectionObserverEntry[]): void {
		const observer = latestObserver();
		observer.callback(entries, observer.instance);
		vi.advanceTimersByTime(32);
		flushSync();
	}

	beforeEach(() => {
		vi.useFakeTimers({
			toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame']
		});
	});

	it('activates the second link when it is clicked inside the first click’s window', async () => {
		const user = fakeUser();
		const { container } = setup({ defaultValue: 'section1' });

		await user.click(links(container)[1]);
		vi.advanceTimersByTime(200);
		await user.click(links(container)[2]);

		expect(links(container)[2]).toHaveAttribute('data-state', 'active');
		expect(links(container)[1]).toHaveAttribute('data-state', 'inactive');
	});

	it('still ignores entries past the first click’s deadline but inside the second’s', async () => {
		const user = fakeUser();
		const { container } = setup({ defaultValue: 'section1' });

		// t≈0: window A closes at t≈500. t≈200: the second click clears A's timeout and opens window
		// B, closing at t≈700 — so only the latest window governs.
		await user.click(links(container)[1]);
		vi.advanceTimersByTime(200);
		await user.click(links(container)[2]);

		// t≈550 — past A's original deadline, still well inside B.
		vi.advanceTimersByTime(350);
		fireFake([entryFor(sectionById(container, 'section1'), true, 0)]);

		expect(links(container)[2]).toHaveAttribute('data-state', 'active');
		expect(links(container)[0]).toHaveAttribute('data-state', 'inactive');
	});

	it('resumes observer-driven activation only once the latest window has elapsed', async () => {
		const user = fakeUser();
		const { container } = setup({ defaultValue: 'section1' });

		await user.click(links(container)[1]);
		vi.advanceTimersByTime(200);
		await user.click(links(container)[2]);

		// t≈782 — past window B's t≈700 close, so passive tracking is live again.
		vi.advanceTimersByTime(550);
		fireFake([entryFor(sectionById(container, 'section1'), true, 0)]);

		expect(links(container)[0]).toHaveAttribute('data-state', 'active');
		expect(links(container)[2]).toHaveAttribute('data-state', 'inactive');
	});
});

// ---------------------------------------------------------------------------
// Focus visibility (T039, FR-019)
// ---------------------------------------------------------------------------

describe('ScrollSpy focus visibility (T039)', () => {
	/**
	 * The component styles no focus ring of its own, so the browser's native one on `<a href>` is the
	 * only focus indicator it has. Any of these utilities would remove it silently — guarding the
	 * class list is what keeps a future styling change from doing so (FR-019).
	 */
	const OUTLINE_SUPPRESSORS = [
		'outline-none',
		'focus:outline-none',
		'focus-visible:outline-none',
		'outline-0',
		'focus:outline-0',
		'focus-visible:outline-0'
	];

	it('leaves the native focus ring on a tabbed-to active link', async () => {
		const user = userEvent.setup();
		const { container } = setup({ defaultValue: 'section1' });

		await user.tab();

		const focused = links(container)[0];
		expect(focused).toHaveFocus();
		expect(focused).toHaveAttribute('data-state', 'active');
		for (const suppressor of OUTLINE_SUPPRESSORS) {
			expect(focused).not.toHaveClass(suppressor);
		}
	});

	it('leaves the native focus ring on a tabbed-to inactive link', async () => {
		const user = userEvent.setup();
		const { container } = setup({ defaultValue: 'section1' });

		await user.tab();
		await user.tab();

		const focused = links(container)[1];
		expect(focused).toHaveFocus();
		expect(focused).toHaveAttribute('data-state', 'inactive');
		for (const suppressor of OUTLINE_SUPPRESSORS) {
			expect(focused).not.toHaveClass(suppressor);
		}
	});
});
