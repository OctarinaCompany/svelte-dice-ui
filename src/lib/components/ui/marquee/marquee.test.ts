import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as Marquee from './index.js';
import {
	computeAutoFillMultiplier,
	computeMarqueeDuration,
	MARQUEE_EDGE_SIZES,
	MARQUEE_ORIENTATIONS,
	MARQUEE_SIDES,
	observeMarqueeSizes,
	resolveGap,
	resolveLoopCount,
	sideToOrientation
} from './index.js';
import Harness, { type MarqueeHarnessRefs } from './marquee.test.svelte';

// ---------------------------------------------------------------------------
// Helpers
//
// `role="marquee"` is a valid ARIA 1.2 live-region role, but Testing Library's `getByRole` support
// for rarely-used live-region roles has been inconsistent across versions, so elements are located
// by `data-slot` and the role is asserted as an attribute (research R-05).
// ---------------------------------------------------------------------------

function bySlot(container: HTMLElement, slot: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function allBySlot(container: HTMLElement, slot: string): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`));
}

function byTestId(container: HTMLElement, testId: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
	if (!element) throw new Error(`no element with data-testid="${testId}" was rendered`);
	return element;
}

/** The announced track and its decorative clone, in document order. */
function tracks(container: HTMLElement): HTMLElement[] {
	return allBySlot(container, 'marquee-content');
}

function styleOf(element: HTMLElement): string {
	return element.getAttribute('style') ?? '';
}

/** Read one `--marquee-*` declaration straight off the `style` attribute. */
function customProperty(element: HTMLElement, name: string): string {
	const match = new RegExp(`${name}:\\s*([^;]+);`).exec(styleOf(element));
	if (!match) throw new Error(`${name} is not declared in style="${styleOf(element)}"`);
	return match[1].trim();
}

/** Every rendered copy of `text` that is not inside an `aria-hidden` subtree. */
function announcedCopies(container: HTMLElement, text: string): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>('[data-slot="marquee-item"]')).filter(
		(element) => element.textContent?.trim() === text && !element.closest('[aria-hidden="true"]')
	);
}

const ITEMS = ['Alpha', 'Beta'];

// ---------------------------------------------------------------------------
// Roles and ARIA (T010)
// ---------------------------------------------------------------------------

describe('Marquee roles and ARIA (T010)', () => {
	it('renders the root as a marquee live region inside a grid wrapper', () => {
		const { container } = render(Harness, { props: { items: ITEMS } });

		const wrapper = bySlot(container, 'marquee-wrapper');
		expect(wrapper).toHaveClass('grid');

		const root = bySlot(container, 'marquee');
		expect(root).toHaveAttribute('role', 'marquee');
		expect(root).toHaveAttribute('aria-live', 'off');
		expect(root).toHaveAttribute('data-orientation', 'horizontal');
		expect(root).toHaveAttribute('data-side', 'left');
		expect(root.parentElement).toBe(wrapper);
	});

	it('renders exactly two content tracks, both carrying the root orientation', () => {
		const { container } = render(Harness, { props: { items: ITEMS } });

		const [announced, clone] = tracks(container);
		expect(tracks(container)).toHaveLength(2);
		expect(announced).toHaveAttribute('data-orientation', 'horizontal');
		expect(clone).toHaveAttribute('data-orientation', 'horizontal');
	});

	it('marks only the second track as the decorative clone', () => {
		const { container } = render(Harness, { props: { items: ITEMS } });

		const [announced, clone] = tracks(container);
		expect(announced).not.toHaveAttribute('data-clone');
		expect(announced).not.toHaveAttribute('role');
		expect(announced).not.toHaveAttribute('aria-hidden');
		expect(clone).toHaveAttribute('data-clone', '');
		expect(clone).toHaveAttribute('role', 'presentation');
		expect(clone).toHaveAttribute('aria-hidden', 'true');
	});

	it('exposes each item text to the accessibility tree exactly once', () => {
		const { container } = render(Harness, { props: { items: ITEMS } });

		expect(allBySlot(container, 'marquee-item')).toHaveLength(4);
		expect(announcedCopies(container, 'Alpha')).toHaveLength(1);
		expect(announcedCopies(container, 'Beta')).toHaveLength(1);
	});

	it('forwards an aria-label and arbitrary restProps to the root element', () => {
		const { container } = render(Harness, {
			props: {
				items: ITEMS,
				'aria-label': 'Skateboard tricks showcase',
				id: 'tricks',
				'data-testid': 'marquee-root'
			}
		});

		const root = byTestId(container, 'marquee-root');
		expect(root).toHaveAttribute('aria-label', 'Skateboard tricks showcase');
		expect(root).toHaveAttribute('id', 'tricks');
		expect(root).toHaveAttribute('data-slot', 'marquee');
	});
});

// ---------------------------------------------------------------------------
// Copy count, measurement and edge cases (T011)
// ---------------------------------------------------------------------------

/** A controllable `ResizeObserver`; `tests/setup.ts` installs a no-op shim that never fires. */
class MockResizeObserver implements ResizeObserver {
	readonly targets: Element[] = [];
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
		this.targets.length = 0;
	}

	/** Test-only: run the observed callback as though both boxes had resized. */
	notify(): void {
		this.#callback([], this);
	}
}

let observers: MockResizeObserver[] = [];

function rect(width: number, height: number): DOMRect {
	return {
		width,
		height,
		x: 0,
		y: 0,
		top: 0,
		left: 0,
		right: width,
		bottom: height,
		toJSON: () => ({})
	} as DOMRect;
}

describe('Marquee copy count and measurement (T011)', () => {
	const ORIGINAL_RESIZE_OBSERVER = globalThis.ResizeObserver;

	/** Sizes the stubbed `getBoundingClientRect` reports, mutable within a test. */
	let rootSize = { width: 0, height: 0 };
	let contentSize = { width: 0, height: 0 };

	beforeEach(() => {
		observers = [];
		rootSize = { width: 300, height: 300 };
		contentSize = { width: 100, height: 100 };

		// jsdom performs no layout — every box measures 0 × 0 and `ResizeObserver` never fires, so
		// without these stand-ins the component would stay on its unmeasured branch forever and
		// neither the auto-fill multiplier nor a size-driven duration could be asserted (research
		// R-09, the same approach `badge-overflow.test.ts` takes).
		vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
			this: Element
		) {
			const size = this.getAttribute('data-slot') === 'marquee' ? rootSize : contentSize;
			return rect(size.width, size.height);
		});

		globalThis.ResizeObserver = MockResizeObserver;
	});

	afterEach(() => {
		// The global `afterEach` restores `vi.spyOn`; a plain assignment needs undoing here.
		globalThis.ResizeObserver = ORIGINAL_RESIZE_OBSERVER;
	});

	it('renders exactly two copies of the children with autoFill off', () => {
		const { container } = render(Harness, { props: { items: ITEMS } });

		expect(allBySlot(container, 'marquee-item')).toHaveLength(ITEMS.length * 2);
		// Measured 100px of content inside a 300px container, no autoFill ⇒ rootSize / speed.
		expect(customProperty(bySlot(container, 'marquee'), '--marquee-duration')).toBe('6s');
	});

	it('duplicates content and stretches the duration when autoFill is on', () => {
		const { container } = render(Harness, { props: { items: ITEMS, autoFill: true } });

		// multiplier = ceil(300 / 100) = 3, rendered on both tracks ⇒ 2 × 3 copies.
		expect(allBySlot(container, 'marquee-item')).toHaveLength(ITEMS.length * 2 * 3);
		expect(customProperty(bySlot(container, 'marquee'), '--marquee-duration')).toBe('6s');
	});

	it('recomputes the duration when the observer reports new sizes', async () => {
		const { container } = render(Harness, { props: { items: ITEMS } });
		const root = bySlot(container, 'marquee');
		expect(customProperty(root, '--marquee-duration')).toBe('6s');

		contentSize = { width: 500, height: 500 };
		for (const observer of observers) observer.notify();
		flushSync();

		// Content (500px) now exceeds the container (300px) ⇒ contentSize / speed.
		expect(customProperty(root, '--marquee-duration')).toBe('10s');
	});

	it('observes both the root and the inner measured track', () => {
		const { container } = render(Harness, { props: { items: ITEMS } });

		const observed = observers.flatMap((observer) => observer.targets);
		expect(observed).toContain(bySlot(container, 'marquee'));
		const inner = tracks(container)[0].firstElementChild;
		expect(observed).toContain(inner);
	});

	it('falls back to the unmeasured duration when a box measures zero', () => {
		rootSize = { width: 0, height: 0 };
		contentSize = { width: 0, height: 0 };

		const plain = render(Harness, { props: { items: ITEMS } });
		expect(customProperty(bySlot(plain.container, 'marquee'), '--marquee-duration')).toBe('40s');
		plain.unmount();

		const filled = render(Harness, { props: { items: ITEMS, autoFill: true } });
		expect(customProperty(bySlot(filled.container, 'marquee'), '--marquee-duration')).toBe('20s');
		expect(allBySlot(filled.container, 'marquee-item')).toHaveLength(ITEMS.length * 2);
	});

	it('renders both tracks without throwing when there are no children', () => {
		const { container } = render(Harness, { props: { items: [] } });

		expect(tracks(container)).toHaveLength(2);
		expect(allBySlot(container, 'marquee-item')).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Reduced motion (T012)
// ---------------------------------------------------------------------------

describe('Marquee reduced motion (T012)', () => {
	it('guards both animated tracks with motion-reduce:animate-none', () => {
		const { container } = render(Harness, { props: { items: ITEMS } });

		for (const track of tracks(container)) {
			expect(track).toHaveClass('motion-reduce:animate-none');
		}
		expect(bySlot(container, 'marquee')).toHaveClass('motion-reduce:animate-none');
	});

	it('keeps every item in the DOM, so the pause never hides content', () => {
		const { container } = render(Harness, { props: { items: ITEMS } });

		expect(allBySlot(container, 'marquee-item')).toHaveLength(ITEMS.length * 2);
		for (const item of allBySlot(container, 'marquee-item')) {
			expect(item).not.toHaveAttribute('hidden');
		}
	});
});

// ---------------------------------------------------------------------------
// Pure helpers (T013)
// ---------------------------------------------------------------------------

describe('Marquee pure helpers (T013)', () => {
	it('maps every side to its orientation', () => {
		expect(sideToOrientation('left')).toBe('horizontal');
		expect(sideToOrientation('right')).toBe('horizontal');
		expect(sideToOrientation('top')).toBe('vertical');
		expect(sideToOrientation('bottom')).toBe('vertical');
		expect(MARQUEE_SIDES).toEqual(['left', 'right', 'top', 'bottom']);
		expect(MARQUEE_ORIENTATIONS).toEqual(['horizontal', 'vertical']);
		expect(MARQUEE_EDGE_SIZES).toEqual(['default', 'sm', 'lg']);
	});

	it('resolves a numeric gap to pixels and passes a string through', () => {
		expect(resolveGap(16)).toBe('16px');
		expect(resolveGap(0)).toBe('0px');
		expect(resolveGap('1rem')).toBe('1rem');
		expect(resolveGap('2em')).toBe('2em');
	});

	it('resolves the loop count, treating 0 and non-finite values as infinite', () => {
		expect(resolveLoopCount(0)).toBe('infinite');
		expect(resolveLoopCount(Number.POSITIVE_INFINITY)).toBe('infinite');
		expect(resolveLoopCount(Number.NaN)).toBe('infinite');
		expect(resolveLoopCount(3)).toBe('3');
		expect(resolveLoopCount(1)).toBe('1');
	});

	it('covers all six duration branches, including the speed floor', () => {
		// Unmeasured.
		expect(
			computeMarqueeDuration({ rootSize: 0, contentSize: 0, speed: 50, autoFill: false })
		).toBe(40);
		expect(computeMarqueeDuration({ rootSize: 0, contentSize: 0, speed: 50, autoFill: true })).toBe(
			20
		);
		expect(
			computeMarqueeDuration({ rootSize: 300, contentSize: 0, speed: 50, autoFill: false })
		).toBe(40);
		// Measured, autoFill: contentSize × multiplier / speed.
		expect(
			computeMarqueeDuration({ rootSize: 300, contentSize: 100, speed: 50, autoFill: true })
		).toBe(6);
		// Measured, no autoFill: the larger of the two sizes / speed.
		expect(
			computeMarqueeDuration({ rootSize: 300, contentSize: 100, speed: 50, autoFill: false })
		).toBe(6);
		expect(
			computeMarqueeDuration({ rootSize: 100, contentSize: 500, speed: 50, autoFill: false })
		).toBe(10);

		// The speed floor keeps both degenerate speeds finite and positive.
		for (const speed of [0, -10]) {
			const duration = computeMarqueeDuration({
				rootSize: 300,
				contentSize: 100,
				speed,
				autoFill: false
			});
			expect(Number.isFinite(duration)).toBe(true);
			expect(duration).toBeGreaterThan(0);
		}
	});

	it('computes the auto-fill multiplier, guarding a zero-size content track', () => {
		expect(computeAutoFillMultiplier(300, 100, true)).toBe(3);
		expect(computeAutoFillMultiplier(300, 250, true)).toBe(2);
		expect(computeAutoFillMultiplier(300, 400, true)).toBe(1);
		expect(computeAutoFillMultiplier(300, 0, true)).toBe(1);
		expect(computeAutoFillMultiplier(300, 100, false)).toBe(1);
	});

	it('no-ops without a ResizeObserver and disconnects on teardown', () => {
		const root = document.createElement('div');
		const content = document.createElement('div');

		vi.stubGlobal('ResizeObserver', undefined);
		const sizes: unknown[] = [];
		const noop = observeMarqueeSizes(root, content, (next) => sizes.push(next));
		expect(sizes).toHaveLength(0);
		expect(() => noop()).not.toThrow();
		vi.unstubAllGlobals();

		observers = [];
		vi.stubGlobal('ResizeObserver', MockResizeObserver);
		const teardown = observeMarqueeSizes(root, content, (next) => sizes.push(next));
		expect(sizes).toHaveLength(1);
		expect(observers[0].targets).toEqual([root, content]);
		teardown();
		expect(observers[0].targets).toHaveLength(0);
		vi.unstubAllGlobals();
	});
});

// ---------------------------------------------------------------------------
// Guard rails (T014)
// ---------------------------------------------------------------------------

describe('Marquee guard rails (T014)', () => {
	it('throws when Marquee.Content is rendered without Marquee.Root', () => {
		expect(() => render(Harness, { props: { mode: 'bare-content' } })).toThrow(
			/must be used within/
		);
	});

	it('names both the part and the provider in the thrown message', () => {
		expect(() => render(Harness, { props: { mode: 'bare-content' } })).toThrow(
			'`<Marquee.Content>` must be used within `<Marquee.Root>`.'
		);
	});

	it('renders Marquee.Item and Marquee.Edge standalone, matching upstream (R-07)', () => {
		const item = render(Harness, { props: { mode: 'bare-item', items: ITEMS } });
		expect(bySlot(item.container, 'marquee-item')).toHaveTextContent('Alpha');
		item.unmount();

		const edge = render(Harness, { props: { mode: 'bare-edge' } });
		expect(bySlot(edge.container, 'marquee-edge')).toHaveAttribute('data-side', 'left');
	});
});

// ---------------------------------------------------------------------------
// Bindings (T014a)
// ---------------------------------------------------------------------------

describe('Marquee bindings (T014a)', () => {
	function capture(props: Record<string, unknown>) {
		let refs: MarqueeHarnessRefs = { root: null, content: null, item: null, edge: null };
		const result = render(Harness, {
			props: { ...props, onRefs: (next: MarqueeHarnessRefs) => (refs = next) }
		});
		return { ...result, refs: () => refs };
	}

	it('binds ref to the element carrying each part’s data-slot', () => {
		const { container, refs } = capture({ items: ITEMS, withEdges: true });

		expect(refs().root).toBe(bySlot(container, 'marquee'));
		expect(refs().edge).toBe(bySlot(container, 'marquee-edge'));
		// `Marquee.Content` renders its `children` snippet once per copy, so an item binding inside
		// that snippet resolves to one of the rendered copies rather than a single element.
		expect(allBySlot(container, 'marquee-item')).toContain(refs().item);
		expect(refs().item).toHaveAttribute('data-slot', 'marquee-item');
	});

	it('binds a single Marquee.Item’s ref to its own element', () => {
		const { container, refs } = capture({ items: ITEMS, mode: 'bare-item' });

		expect(refs().item).toBe(bySlot(container, 'marquee-item'));
	});

	it('binds Marquee.Content’s ref to the inner measured track, not the animated wrapper', () => {
		const { container, refs } = capture({ items: ITEMS });

		const [announced, clone] = tracks(container);
		const inner = refs().content;
		expect(inner).not.toBeNull();
		expect(inner).not.toBe(announced);
		expect(inner).not.toBe(clone);
		expect(inner?.parentElement).toBe(announced);
		// The measured track holds exactly one copy of the children.
		expect(inner?.querySelectorAll('[data-slot="marquee-item"]')).toHaveLength(ITEMS.length);
	});

	it('leaves the root’s ref null in child mode', () => {
		const { container, refs } = capture({ items: ITEMS, mode: 'root-child' });

		expect(byTestId(container, 'root-child')).toHaveAttribute('data-slot', 'marquee');
		expect(refs().root).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Keyboard pause (T019)
// ---------------------------------------------------------------------------

describe('Marquee keyboard pause (T019)', () => {
	it('puts the root in the tab order with a focus ring when pauseOnKeyboard is on', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: { items: ITEMS } });

		const root = bySlot(container, 'marquee');
		expect(root).toHaveAttribute('tabindex', '0');
		expect(root).toHaveClass(
			'rounded-md',
			'focus-visible:ring-[3px]',
			'focus-visible:ring-ring/50'
		);

		await user.tab();
		expect(root).toHaveFocus();
	});

	it('toggles data-paused on Space and prevents the key’s default', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: { items: ITEMS } });

		const root = bySlot(container, 'marquee');
		// Read `defaultPrevented` once the event has bubbled past the component's handler. `user.tab()`
		// dispatches a keydown of its own, so only Space presses are recorded.
		const seen: boolean[] = [];
		const onKeydown = (event: KeyboardEvent) => {
			if (event.key === ' ') seen.push(event.defaultPrevented);
		};
		document.addEventListener('keydown', onKeydown);

		await user.tab();
		expect(root).not.toHaveAttribute('data-paused');

		await user.keyboard(' ');
		expect(root).toHaveAttribute('data-paused', '');
		expect(root).toHaveClass('[&_*]:[animation-play-state:paused]');

		await user.keyboard(' ');
		expect(root).not.toHaveAttribute('data-paused');

		expect(seen).toEqual([true, true]);
		document.removeEventListener('keydown', onKeydown);
	});

	it('ignores every other key', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: { items: ITEMS } });

		const root = bySlot(container, 'marquee');
		await user.tab();

		await user.keyboard('{Enter}{ArrowRight}{Escape}');
		expect(root).not.toHaveAttribute('data-paused');
	});

	it('keeps the root out of the tab order and inert to Space when pauseOnKeyboard is off', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: { items: ITEMS, pauseOnKeyboard: false } });

		const root = bySlot(container, 'marquee');
		expect(root).not.toHaveAttribute('tabindex');
		expect(root).not.toHaveClass('focus-visible:ring-[3px]');

		await user.tab();
		expect(root).not.toHaveFocus();

		// `userEvent` cannot type into an element that is not focusable, which is exactly the state
		// under test, so the key is dispatched straight at the root instead.
		root.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
		expect(root).not.toHaveAttribute('data-paused');
	});
});

// ---------------------------------------------------------------------------
// Hover pause (T020)
// ---------------------------------------------------------------------------

describe('Marquee hover pause (T020)', () => {
	it('turns the root into a group and pauses both tracks on hover and on focus-within', () => {
		const { container } = render(Harness, { props: { items: ITEMS, pauseOnHover: true } });

		const root = bySlot(container, 'marquee');
		expect(root).toHaveClass('group');
		expect(root).toHaveAttribute('data-pause-on-hover', '');

		for (const track of tracks(container)) {
			expect(track).toHaveClass('group-hover:[animation-play-state:paused]');
			expect(track).toHaveClass('group-focus-within:[animation-play-state:paused]');
		}
	});

	it('stays paused while either the hover or the keyboard condition holds (T041)', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, {
			props: { items: ITEMS, pauseOnHover: true, pauseOnKeyboard: true }
		});

		const root = bySlot(container, 'marquee');
		expect(root).not.toHaveClass('[&_*]:[animation-play-state:paused]');

		await user.tab();
		await user.keyboard(' ');

		// Keyboard pause holds: the root pauses every descendant animation outright, while both
		// hover conditions stay declared on the tracks — the two mechanisms are independent.
		expect(root).toHaveClass('[&_*]:[animation-play-state:paused]', 'group');
		for (const track of tracks(container)) {
			expect(track).toHaveClass('group-hover:[animation-play-state:paused]');
			expect(track).toHaveClass('group-focus-within:[animation-play-state:paused]');
		}

		await user.keyboard(' ');

		// Only the keyboard pause is dropped; hover and focus-within can still pause on their own,
		// so releasing one condition never releases the other.
		expect(root).not.toHaveClass('[&_*]:[animation-play-state:paused]');
		expect(root).toHaveAttribute('data-pause-on-hover', '');
		for (const track of tracks(container)) {
			expect(track).toHaveClass('group-hover:[animation-play-state:paused]');
			expect(track).toHaveClass('group-focus-within:[animation-play-state:paused]');
		}
	});

	it('omits the group and the pause classes when pauseOnHover is off', () => {
		const { container } = render(Harness, { props: { items: ITEMS } });

		const root = bySlot(container, 'marquee');
		expect(root).not.toHaveClass('group');
		expect(root).not.toHaveAttribute('data-pause-on-hover');

		for (const track of tracks(container)) {
			expect(track).not.toHaveClass('group-hover:[animation-play-state:paused]');
			expect(track).not.toHaveClass('group-focus-within:[animation-play-state:paused]');
		}
	});
});

// ---------------------------------------------------------------------------
// Composed onkeydown (T021)
// ---------------------------------------------------------------------------

describe('Marquee composed onkeydown (T021)', () => {
	it('runs a caller-supplied onkeydown alongside the pause toggle', async () => {
		const user = userEvent.setup();
		const onkeydown = vi.fn();
		const { container } = render(Harness, { props: { items: ITEMS, onkeydown } });

		const root = bySlot(container, 'marquee');
		await user.tab();
		await user.keyboard(' ');

		expect(onkeydown).toHaveBeenCalledTimes(1);
		expect(root).toHaveAttribute('data-paused', '');
	});

	it('still forwards other keys to a caller-supplied onkeydown', async () => {
		const user = userEvent.setup();
		const onkeydown = vi.fn();
		const { container } = render(Harness, { props: { items: ITEMS, onkeydown } });

		await user.tab();
		await user.keyboard('{Enter}');

		expect(onkeydown).toHaveBeenCalledTimes(1);
		expect(bySlot(container, 'marquee')).not.toHaveAttribute('data-paused');
	});
});

// ---------------------------------------------------------------------------
// Internal pause state (T022)
// ---------------------------------------------------------------------------

describe('Marquee internal pause state (T022)', () => {
	it('starts unpaused, flips on Space, and survives an unrelated prop change', async () => {
		const user = userEvent.setup();
		const { container, rerender } = render(Harness, { props: { items: ITEMS, speed: 50 } });

		const root = bySlot(container, 'marquee');
		expect(root).not.toHaveAttribute('data-paused');

		await user.tab();
		await user.keyboard(' ');
		expect(root).toHaveAttribute('data-paused', '');

		// There is no controllable `paused` prop upstream (research R-08), so the only way this could
		// reset is the component moving on its own — which it must not.
		await rerender({ items: ITEMS, speed: 120 });
		expect(bySlot(container, 'marquee')).toHaveAttribute('data-paused', '');
		expect(customProperty(bySlot(container, 'marquee'), '--marquee-duration')).not.toBe('40s');
	});
});

// ---------------------------------------------------------------------------
// Orientation (T024)
// ---------------------------------------------------------------------------

describe('Marquee orientation (T024)', () => {
	it('scrolls vertically for side="top" and side="bottom"', () => {
		for (const [side, animation] of [
			['top', 'animate-marquee-up'],
			['bottom', 'animate-marquee-down']
		] as const) {
			const { container, unmount } = render(Harness, { props: { items: ITEMS, side } });

			const root = bySlot(container, 'marquee');
			expect(root).toHaveAttribute('data-orientation', 'vertical');
			expect(root).toHaveAttribute('data-side', side);
			expect(root).toHaveClass('h-full', 'flex-col');
			expect(root).not.toHaveClass('w-full');

			for (const track of tracks(container)) {
				expect(track).toHaveAttribute('data-orientation', 'vertical');
				expect(track).toHaveClass('min-h-full', 'min-w-auto', 'flex-col', animation);
			}
			expect(tracks(container)[0]).toHaveClass('mb-(--marquee-gap)');

			unmount();
		}
	});

	it('scrolls horizontally for side="left" and side="right"', () => {
		for (const [side, animation] of [
			['left', 'animate-marquee-left'],
			['right', 'animate-marquee-right']
		] as const) {
			const { container, unmount } = render(Harness, { props: { items: ITEMS, side } });

			const root = bySlot(container, 'marquee');
			expect(root).toHaveAttribute('data-orientation', 'horizontal');
			expect(root).toHaveClass('w-full');
			expect(root).not.toHaveClass('flex-col');

			for (const track of tracks(container)) {
				expect(track).toHaveAttribute('data-orientation', 'horizontal');
				expect(track).toHaveClass('min-w-full', animation);
				expect(track).not.toHaveClass('flex-col');
			}
			expect(tracks(container)[0]).toHaveClass('mr-(--marquee-gap)');

			unmount();
		}
	});
});

// ---------------------------------------------------------------------------
// Direction resolution (T025)
// ---------------------------------------------------------------------------

describe('Marquee direction resolution (T025)', () => {
	it('defaults to ltr with no dir prop and no provider', () => {
		const { container } = render(Harness, { props: { items: ITEMS } });

		expect(bySlot(container, 'marquee')).toHaveAttribute('dir', 'ltr');
		expect(tracks(container)[0]).toHaveClass('animate-marquee-left');
	});

	it('mirrors a horizontal marquee inside a <DirectionProvider dir="rtl">', () => {
		for (const [side, animation] of [
			['left', 'animate-marquee-left-rtl'],
			['right', 'animate-marquee-right-rtl']
		] as const) {
			const { container, unmount } = render(Harness, {
				props: { items: ITEMS, mode: 'rtl-provider', side }
			});

			expect(bySlot(container, 'marquee')).toHaveAttribute('dir', 'rtl');
			for (const track of tracks(container)) {
				expect(track).toHaveClass(animation);
			}
			expect(tracks(container)[0]).toHaveClass('ml-(--marquee-gap)');
			expect(tracks(container)[0]).not.toHaveClass('mr-(--marquee-gap)');

			unmount();
		}
	});

	it('lets an explicit dir prop override an ltr provider', () => {
		const { container } = render(Harness, {
			props: { items: ITEMS, mode: 'rtl-provider', providerDir: 'ltr', dir: 'rtl' }
		});

		expect(bySlot(container, 'marquee')).toHaveAttribute('dir', 'rtl');
		expect(tracks(container)[0]).toHaveClass('animate-marquee-left-rtl');
	});

	it('falls back to an ambient DOM dir when there is no prop and no provider (T040)', async () => {
		// Third link of the documented chain: `dir` prop → `<DirectionProvider>` → ambient DOM `dir` →
		// `"ltr"`. `useDirection` anchors its DOM walk on `document.documentElement` by default, so the
		// attribute goes there and is restored whatever the assertions do.
		const previousDir = document.documentElement.getAttribute('dir');
		document.documentElement.setAttribute('dir', 'rtl');

		try {
			const { container } = render(Harness, { props: { items: ITEMS } });

			// The DOM fallback is resolved inside an effect, so it lands one flush after first render.
			await vi.waitFor(() => {
				expect(bySlot(container, 'marquee')).toHaveAttribute('dir', 'rtl');
			});

			for (const track of tracks(container)) {
				expect(track).toHaveClass('animate-marquee-left-rtl');
			}
			expect(tracks(container)[0]).toHaveClass('ml-(--marquee-gap)');
			expect(tracks(container)[0]).not.toHaveClass('mr-(--marquee-gap)');
		} finally {
			if (previousDir === null) document.documentElement.removeAttribute('dir');
			else document.documentElement.setAttribute('dir', previousDir);
		}
	});

	it('leaves a vertical marquee unaffected by direction', () => {
		const { container } = render(Harness, {
			props: { items: ITEMS, mode: 'rtl-provider', side: 'top' }
		});

		expect(bySlot(container, 'marquee')).toHaveAttribute('dir', 'rtl');
		for (const track of tracks(container)) {
			expect(track).toHaveClass('animate-marquee-up');
		}
		expect(tracks(container)[0]).toHaveClass('mb-(--marquee-gap)');
	});
});

// ---------------------------------------------------------------------------
// reverse (T026)
// ---------------------------------------------------------------------------

describe('Marquee reverse (T026)', () => {
	it('reverses the animation independently of the side-derived keyframes', () => {
		const { container } = render(Harness, { props: { items: ITEMS, reverse: true } });

		for (const track of tracks(container)) {
			expect(track).toHaveClass('[animation-direction:reverse]', 'animate-marquee-left');
			expect(styleOf(track)).toContain('animation-direction: reverse');
		}
	});

	it('flips independently of RTL mirroring', () => {
		const { container } = render(Harness, {
			props: { items: ITEMS, mode: 'rtl-provider', reverse: true }
		});

		for (const track of tracks(container)) {
			expect(track).toHaveClass('[animation-direction:reverse]', 'animate-marquee-left-rtl');
		}
	});

	it('declares the normal direction when reverse is off', () => {
		const { container } = render(Harness, { props: { items: ITEMS } });

		for (const track of tracks(container)) {
			expect(track).not.toHaveClass('[animation-direction:reverse]');
			expect(styleOf(track)).toContain('animation-direction: normal');
		}
	});
});

// ---------------------------------------------------------------------------
// Marquee.Edge (T027)
// ---------------------------------------------------------------------------

describe('Marquee.Edge (T027)', () => {
	it('renders a decorative, non-interactive overlay for every side', () => {
		for (const side of MARQUEE_SIDES) {
			const { container, unmount } = render(Harness, {
				props: { mode: 'bare-edge', edgeSide: side }
			});

			const edge = bySlot(container, 'marquee-edge');
			expect(edge).toHaveAttribute('data-side', side);
			expect(edge).toHaveAttribute('data-size', 'default');
			expect(edge).toHaveAttribute('aria-hidden', 'true');
			expect(edge).toHaveClass('pointer-events-none', 'absolute');

			unmount();
		}
	});

	it('sizes the gradient along the axis implied by side', () => {
		const table = [
			{ side: 'left', size: 'sm', expected: 'w-1/6' },
			{ side: 'left', size: 'default', expected: 'w-1/4' },
			{ side: 'right', size: 'lg', expected: 'w-1/3' },
			{ side: 'top', size: 'sm', expected: 'h-1/6' },
			{ side: 'bottom', size: 'default', expected: 'h-1/4' },
			{ side: 'top', size: 'lg', expected: 'h-1/3' }
		] as const;

		for (const row of table) {
			const { container, unmount } = render(Harness, {
				props: { mode: 'bare-edge', edgeSide: row.side, edgeSize: row.size }
			});

			const edge = bySlot(container, 'marquee-edge');
			expect(edge).toHaveClass(row.expected);
			expect(edge).toHaveAttribute('data-size', row.size);

			unmount();
		}
	});

	it('merges a caller class last and renders inside the root alongside the tracks', () => {
		const { container } = render(Harness, {
			props: { items: ITEMS, withEdges: true, edgeClass: 'edge-extra' }
		});

		const edges = allBySlot(container, 'marquee-edge');
		expect(edges).toHaveLength(2);
		expect(edges[0]).toHaveClass('edge-extra');
		expect(edges[0].parentElement).toBe(bySlot(container, 'marquee'));
	});
});

// ---------------------------------------------------------------------------
// child composition (T028)
// ---------------------------------------------------------------------------

describe('Marquee child composition (T028)', () => {
	it('hands the root’s merged payload to its child snippet', () => {
		const { container } = render(Harness, { props: { items: ITEMS, mode: 'root-child' } });

		const child = byTestId(container, 'root-child');
		expect(child).toHaveAttribute('data-slot', 'marquee');
		expect(child).toHaveAttribute('role', 'marquee');
		expect(child).toHaveAttribute('aria-live', 'off');
		expect(child).toHaveAttribute('dir', 'ltr');
		expect(child).toHaveAttribute('tabindex', '0');
		expect(child).toHaveClass('relative', 'flex', 'overflow-hidden');
		expect(styleOf(child)).toContain('--marquee-duration');
		// The default element is suppressed: the wrapper's only child is the caller's.
		expect(bySlot(container, 'marquee')).toBe(child);
	});

	it('hands the content payload to its child snippet and still renders the clone', () => {
		const { container } = render(Harness, {
			props: { items: ITEMS, mode: 'content-child', contentClass: 'content-extra' }
		});

		const child = byTestId(container, 'content-child');
		expect(child).toHaveAttribute('data-slot', 'marquee-content');
		expect(child).toHaveAttribute('data-orientation', 'horizontal');
		expect(child).toHaveClass('content-extra', 'animate-marquee-left');
		expect(tracks(container)).toHaveLength(2);
		expect(tracks(container)[1]).toHaveAttribute('data-clone', '');
	});

	it('hands the item payload to its child snippet', () => {
		const { container } = render(Harness, { props: { items: ITEMS, mode: 'item-child' } });

		const child = byTestId(container, 'item-child');
		expect(child).toHaveAttribute('data-slot', 'marquee-item');
		expect(child).toHaveClass('shrink-0');
	});

	it('hands the edge payload to its child snippet', () => {
		const { container } = render(Harness, {
			props: { mode: 'edge-child', edgeSide: 'right', edgeSize: 'lg' }
		});

		const child = byTestId(container, 'edge-child');
		expect(child).toHaveAttribute('data-slot', 'marquee-edge');
		expect(child).toHaveAttribute('data-side', 'right');
		expect(child).toHaveAttribute('data-size', 'lg');
		expect(child).toHaveAttribute('aria-hidden', 'true');
		expect(child).toHaveClass('w-1/3');
	});
});

// ---------------------------------------------------------------------------
// Props, style and class composition (T029)
// ---------------------------------------------------------------------------

describe('Marquee props and style composition (T029)', () => {
	it('publishes the four custom properties from speed, delay, gap and loopCount', () => {
		const { container } = render(Harness, {
			props: { items: ITEMS, speed: 100, delay: 2, gap: '2rem', loopCount: 3 }
		});

		const root = bySlot(container, 'marquee');
		expect(customProperty(root, '--marquee-duration')).toBe('20s');
		expect(customProperty(root, '--marquee-gap')).toBe('2rem');
		expect(customProperty(root, '--marquee-delay')).toBe('2s');
		expect(customProperty(root, '--marquee-loop-count')).toBe('3');
	});

	it('emits a numeric gap in pixels', () => {
		const { container } = render(Harness, { props: { items: ITEMS, gap: 16 } });

		expect(customProperty(bySlot(container, 'marquee'), '--marquee-gap')).toBe('16px');
	});

	it('keeps the duration finite and positive for speed 0 and a negative speed', () => {
		for (const speed of [0, -10]) {
			const { container, unmount } = render(Harness, { props: { items: ITEMS, speed } });

			const duration = customProperty(bySlot(container, 'marquee'), '--marquee-duration');
			expect(duration).toMatch(/^\d+(\.\d+)?s$/);
			expect(Number.parseFloat(duration)).toBeGreaterThan(0);

			unmount();
		}
	});

	it('treats loopCount 0 and Infinity as infinite', () => {
		for (const loopCount of [0, Number.POSITIVE_INFINITY]) {
			const { container, unmount } = render(Harness, { props: { items: ITEMS, loopCount } });

			expect(customProperty(bySlot(container, 'marquee'), '--marquee-loop-count')).toBe('infinite');

			unmount();
		}
	});

	it('appends the caller style after the custom properties on the root', () => {
		const { container } = render(Harness, {
			props: { items: ITEMS, style: 'color: rgb(1, 2, 3)' }
		});

		expect(styleOf(bySlot(container, 'marquee'))).toMatch(
			/--marquee-loop-count:[^;]*;.*color: rgb\(1, 2, 3\)/
		);
	});

	it('puts the caller style before the animation longhands on the content', () => {
		const { container } = render(Harness, {
			props: { items: ITEMS, contentStyle: 'color: rgb(4, 5, 6)' }
		});

		expect(styleOf(tracks(container)[0])).toMatch(
			/color: rgb\(4, 5, 6\).*animation-duration: var\(--marquee-duration\)/
		);
	});

	it('merges a caller class last on every part', () => {
		const { container } = render(Harness, {
			props: {
				items: ITEMS,
				withEdges: true,
				class: 'root-extra',
				contentClass: 'content-extra',
				itemClass: 'item-extra',
				edgeClass: 'edge-extra'
			}
		});

		expect(bySlot(container, 'marquee')).toHaveClass('root-extra');
		for (const track of tracks(container)) {
			expect(track).toHaveClass('content-extra');
		}
		expect(bySlot(container, 'marquee-item')).toHaveClass('item-extra', 'shrink-0');
		expect(bySlot(container, 'marquee-edge')).toHaveClass('edge-extra');
	});

	it('lands restProps only on the announced track, never on the clone', () => {
		const { container } = render(Harness, { props: { items: ITEMS, contentClass: 'x' } });

		const [announced, clone] = tracks(container);
		expect(announced).toHaveAttribute('data-orientation');
		expect(clone).toHaveAttribute('data-clone', '');
		expect(clone).not.toHaveAttribute('id');
	});

	it('exposes both the short names and the Marquee* aliases from the barrel', () => {
		expect(Marquee.Root).toBeDefined();
		expect(Marquee.Content).toBeDefined();
		expect(Marquee.Item).toBeDefined();
		expect(Marquee.Edge).toBeDefined();

		expect(Marquee.Marquee).toBe(Marquee.Root);
		expect(Marquee.MarqueeContent).toBe(Marquee.Content);
		expect(Marquee.MarqueeItem).toBe(Marquee.Item);
		expect(Marquee.MarqueeEdge).toBe(Marquee.Edge);

		expect(Marquee.marqueeContentVariants).toBeInstanceOf(Function);
		expect(Marquee.marqueeEdgeVariants).toBeInstanceOf(Function);
	});
});
