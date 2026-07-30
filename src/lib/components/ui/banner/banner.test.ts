import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BANNER_VARIANTS, BannersState, bannerVariants } from './index.js';
import Harness, { type BannerHarnessEvent, type BannerHarnessRefs } from './banner.test.svelte';

// ---------------------------------------------------------------------------
// Stubs (research R-17)
//
// jsdom measures nothing: `getBoundingClientRect` always returns a zero rect, so every queued
// banner's height, offset and transform would collapse to 0px. A fixed-height stub, restored in
// `afterEach`, is what makes the enter/exit choreography assertable.
// ---------------------------------------------------------------------------

const BANNER_HEIGHT = 48;

function installStubs() {
	vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
		height: BANNER_HEIGHT,
		width: 320,
		top: 0,
		left: 0,
		right: 320,
		bottom: BANNER_HEIGHT,
		x: 0,
		y: 0,
		toJSON() {
			return this;
		}
	});
}

beforeEach(() => {
	installStubs();
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

function bySlot(container: HTMLElement, slot: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function allBySlot(container: HTMLElement, slot: string): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`));
}

// ---------------------------------------------------------------------------
// BannersState — pure unit tests (T008, US2)
//
// Exercised directly against the exported class rather than through rendering: ordering, the
// `maxVisible` cap, timer-driven auto-dismiss and `clearBanners` are all observable on plain state,
// and a `.ts` unit test is the most direct way to pin the exact upstream algorithm (data-model §3).
// ---------------------------------------------------------------------------

describe('BannersState ordering, cap and lifecycle (T008, US2)', () => {
	function contentSnippet() {
		return (() => {}) as unknown as Parameters<BannersState['addBanner']>[0]['content'];
	}

	it('inserts before the first entry whose priority is lower, keeping ties in insertion order', () => {
		const state = new BannersState({ getMaxVisible: () => 10 });
		const content = contentSnippet();

		state.addBanner({ content, priority: 0 });
		state.addBanner({ content, priority: 10 });
		state.addBanner({ content, priority: 5 });

		expect(state.banners.map((b) => b.priority)).toEqual([10, 5, 0]);
	});

	it('preserves insertion order for equal or unspecified priority', () => {
		const state = new BannersState({ getMaxVisible: () => 10 });
		const content = contentSnippet();

		const first = state.addBanner({ content });
		const second = state.addBanner({ content });

		expect(state.banners.map((b) => b.id)).toEqual([first, second]);
	});

	it('caps visibleBanners at maxVisible and promotes the next banner on removal', () => {
		const state = new BannersState({ getMaxVisible: () => 1 });
		const content = contentSnippet();

		const first = state.addBanner({ content });
		state.addBanner({ content });

		expect(state.visibleBanners.map((b) => b.id)).toEqual([first]);

		state.removeBanner(first);
		expect(state.banners).toHaveLength(1);
		expect(state.visibleBanners).toHaveLength(1);
	});

	it('auto-dismisses via duration by flipping removing, not by removing the entry directly', () => {
		vi.useFakeTimers();
		const state = new BannersState({ getMaxVisible: () => 10 });
		const content = contentSnippet();

		const id = state.addBanner({ content, duration: 50 });
		expect(state.isRemoving(id)).toBe(false);

		vi.advanceTimersByTime(50);
		expect(state.isRemoving(id)).toBe(true);
		expect(state.banners).toHaveLength(1);
	});

	it('never auto-dismisses without a duration', () => {
		vi.useFakeTimers();
		const state = new BannersState({ getMaxVisible: () => 10 });
		const content = contentSnippet();

		const id = state.addBanner({ content });
		vi.advanceTimersByTime(10_000);

		expect(state.isRemoving(id)).toBe(false);
		expect(state.banners).toHaveLength(1);
	});

	it('is a no-op for removeBanner on an unknown id', () => {
		const state = new BannersState({ getMaxVisible: () => 10 });
		expect(() => state.removeBanner('missing')).not.toThrow();
	});

	it('fires onDismiss from removeBanner', () => {
		const state = new BannersState({ getMaxVisible: () => 10 });
		const onDismiss = vi.fn();
		const id = state.addBanner({ content: contentSnippet(), onDismiss });

		state.removeBanner(id);

		expect(onDismiss).toHaveBeenCalledOnce();
		expect(state.banners).toHaveLength(0);
	});

	it('clearBanners empties the queue, cancels timers and fires no onDismiss', () => {
		vi.useFakeTimers();
		const state = new BannersState({ getMaxVisible: () => 10 });
		const onDismiss = vi.fn();

		state.addBanner({ content: contentSnippet(), onDismiss, duration: 50 });
		state.addBanner({ content: contentSnippet(), onDismiss });

		state.clearBanners();
		expect(state.banners).toHaveLength(0);

		vi.advanceTimersByTime(1000);
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it('setHeight/removeHeight short-circuit on an unchanged value and drive offsetOf/totalHeight', () => {
		const state = new BannersState({ getMaxVisible: () => 10 });
		const first = state.addBanner({ content: contentSnippet() });
		const second = state.addBanner({ content: contentSnippet(), priority: 1 });

		// `second` sorts before `first` (higher priority).
		expect(state.offsetOf(second)).toBe(0);
		state.setHeight(second, 40);
		expect(state.offsetOf(first)).toBe(40);
		expect(state.totalHeight).toBe(40);

		state.removeHeight(second);
		expect(state.offsetOf(first)).toBe(0);
	});

	it('destroy clears every pending timer', () => {
		vi.useFakeTimers();
		const state = new BannersState({ getMaxVisible: () => 10 });
		const onDismiss = vi.fn();
		state.addBanner({ content: contentSnippet(), onDismiss, duration: 50 });

		state.destroy();
		vi.advanceTimersByTime(1000);

		expect(onDismiss).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Controlled / uncontrolled (T004, US1, FR-002, SC-001, contract §8)
// ---------------------------------------------------------------------------

describe('Banner controlled / uncontrolled (T004, US1)', () => {
	it('is visible on first render with no open prop', () => {
		const { container } = render(Harness);

		expect(bySlot(container, 'banner')).toHaveAttribute('data-state', 'open');
	});

	it('uncontrolled: closing hides the banner and fires onOpenChange(false) once', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		const { container } = render(Harness, { props: { onOpenChange } });

		await user.click(within(container).getByRole('button', { name: /close/i }));

		expect(container.querySelector('[data-slot="banner"]')).toBeNull();
		expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
	});

	it('bind:open: closing updates the bound value and fires the same callback', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		const { container } = render(Harness, { props: { open: true, onOpenChange } });

		await user.click(within(container).getByRole('button', { name: /close/i }));

		expect(container.querySelector('[data-slot="banner"]')).toBeNull();
		expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
	});

	it('open={false} renders nothing; flipping to true renders again', async () => {
		const { container, rerender } = render(Harness, { props: { open: false } });
		expect(container.querySelector('[data-slot="banner"]')).toBeNull();

		await rerender({ open: true });
		expect(bySlot(container, 'banner')).toBeInTheDocument();
	});

	it('dismissible=false disables the close control and suppresses the callback', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		const { container } = render(Harness, { props: { dismissible: false, onOpenChange } });

		const close = within(container).getByRole('button', { name: /close/i });
		expect(close).toBeDisabled();

		await user.click(close);
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(bySlot(container, 'banner')).toBeInTheDocument();
	});

	it('an explicit disabled on Banner.Close wins over dismissible', () => {
		const { container } = render(Harness, { props: { dismissible: true, closeDisabled: true } });

		expect(within(container).getByRole('button', { name: /close/i })).toBeDisabled();
	});

	it('a caller onclick calling preventDefault suppresses the close', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		const onCloseClick = vi.fn((event: MouseEvent) => event.preventDefault());
		const { container } = render(Harness, { props: { onOpenChange, onCloseClick } });

		await user.click(within(container).getByRole('button', { name: /close/i }));

		expect(onCloseClick).toHaveBeenCalledOnce();
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(bySlot(container, 'banner')).toBeInTheDocument();
	});

	it('standalone onDismiss never fires and standalone duration never auto-dismisses (R-18)', () => {
		vi.useFakeTimers();
		const onDismiss = vi.fn();
		const { container } = render(Harness, { props: { onDismiss, duration: 10 } });

		vi.advanceTimersByTime(10_000);

		expect(onDismiss).not.toHaveBeenCalled();
		expect(bySlot(container, 'banner')).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Accessibility roles and names (T005, US1)
// ---------------------------------------------------------------------------

describe('Banner accessibility roles and names (T005, US1)', () => {
	it('exposes role=status and aria-live=polite', () => {
		const { container } = render(Harness);
		const banner = bySlot(container, 'banner');

		expect(banner).toHaveAttribute('role', 'status');
		expect(banner).toHaveAttribute('aria-live', 'polite');
	});

	it('carries data-slot on every part', () => {
		const { container } = render(Harness);

		for (const slot of [
			'banner',
			'banner-icon',
			'banner-content',
			'banner-title',
			'banner-description',
			'banner-actions',
			'banner-close'
		]) {
			expect(bySlot(container, slot)).toBeInTheDocument();
		}
	});

	it('throws when Banner.Close is rendered outside Banner.Root', () => {
		expect(() => render(Harness, { props: { mode: 'bare-close' } })).toThrow(
			'`<Banner.Close>` must be used within `<Banner.Root>`.'
		);
	});

	it('the default close control is reachable by its accessible name', () => {
		const { container } = render(Harness);
		expect(within(container).getByRole('button', { name: /close/i })).toBeInTheDocument();
	});

	it('a caller aria-label replaces the accessible name', () => {
		const { container } = render(Harness, { props: { closeAriaLabel: 'Dismiss banner' } });
		expect(within(container).getByRole('button', { name: 'Dismiss banner' })).toBeInTheDocument();
	});

	it('custom children do not leave the close button nameless', () => {
		const { container } = render(Harness, { props: { closeChildren: true } });
		const close = within(container).getByTestId('close-children').closest('button');
		expect(close).not.toBeNull();
	});

	it('custom children with no explicit aria-label derive the accessible name from that content, not "Close" (T029)', () => {
		const { container } = render(Harness, { props: { closeChildren: true } });
		expect(within(container).getByRole('button', { name: 'x' })).toBeInTheDocument();
		expect(within(container).queryByRole('button', { name: /^close$/i })).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Keyboard interactions (T006, US1)
// ---------------------------------------------------------------------------

describe('Banner keyboard interactions (T006, US1)', () => {
	it('reaches the action button and then Banner.Close by Tab, and walks back with Shift+Tab', async () => {
		const user = userEvent.setup();
		render(Harness, { props: { withActionButton: true } });

		await user.tab();
		expect(screen.getByTestId('action-button')).toHaveFocus();
		await user.tab();
		expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();
		await user.tab({ shift: true });
		expect(screen.getByTestId('action-button')).toHaveFocus();
	});

	it('activates the focused close control with Enter', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		render(Harness, { props: { onOpenChange } });

		screen.getByRole('button', { name: /close/i }).focus();
		await user.keyboard('{Enter}');

		expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
	});

	it('activates the focused close control with Space', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		render(Harness, { props: { onOpenChange } });

		screen.getByRole('button', { name: /close/i }).focus();
		await user.keyboard('[Space]');

		expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
	});

	it('does not move focus when the banner appears', () => {
		render(Harness);
		expect(document.activeElement).toBe(document.body);
	});
});

// ---------------------------------------------------------------------------
// RTL (T007, US3, FR-020, SC-005, R-13)
// ---------------------------------------------------------------------------

describe('Banner RTL (T007, US3)', () => {
	it('renders byte-identical markup under dir="rtl" and dir="ltr"', () => {
		const ltr = render(Harness, { props: { dir: 'ltr' } });
		const rtl = render(Harness, { props: { dir: 'rtl' } });

		expect(bySlot(rtl.container, 'banner').outerHTML).toBe(
			bySlot(ltr.container, 'banner').outerHTML
		);
	});

	it('carries no physically-sided utility class', () => {
		const { container } = render(Harness);

		for (const slot of ['banner', 'banner-icon', 'banner-content', 'banner-actions']) {
			const classList = bySlot(container, slot).className;
			expect(classList).not.toMatch(/(?:^|\s)(ml|mr|pl|pr|left|right|text-left|text-right)-/);
		}
	});

	it('keeps icon → content → actions → close in DOM order', () => {
		const { container } = render(Harness, { props: { withActionButton: true } });
		const banner = bySlot(container, 'banner');
		const slots = Array.from(banner.children).map((el) => el.getAttribute('data-slot'));

		expect(slots).toEqual(['banner-icon', 'banner-content', 'banner-actions']);
		const actions = bySlot(container, 'banner-actions');
		expect(Array.from(actions.children).at(-1)).toHaveAttribute('data-slot', 'banner-close');
	});
});

// ---------------------------------------------------------------------------
// Variants (T007a, US3, FR-004)
// ---------------------------------------------------------------------------

describe('Banner variants (T007a, US3)', () => {
	it.each(BANNER_VARIANTS)('applies the exact class row and data-variant for "%s"', (variant) => {
		const { container } = render(Harness, { props: { variant } });
		const banner = bySlot(container, 'banner');

		expect(banner).toHaveAttribute('data-variant', variant);
		expect(banner.className).toBe(bannerVariants({ variant }));
	});

	it('carries motion-reduce:transition-none on the base class', () => {
		const { container } = render(Harness);
		expect(bySlot(container, 'banner').className).toContain('motion-reduce:transition-none');
	});
});

// ---------------------------------------------------------------------------
// Snippets, ref and child mode (T009)
// ---------------------------------------------------------------------------

describe('Banner snippets, ref and child mode (T009)', () => {
	it('binds every part ref to the element carrying its data-slot', () => {
		let seen: BannerHarnessRefs | undefined;
		const { container } = render(Harness, {
			props: { withActionButton: true, onRefs: (r) => (seen = r) }
		});

		expect(seen?.root).toBe(bySlot(container, 'banner'));
		expect(seen?.icon).toBe(bySlot(container, 'banner-icon'));
		expect(seen?.content).toBe(bySlot(container, 'banner-content'));
		expect(seen?.title).toBe(bySlot(container, 'banner-title'));
		expect(seen?.description).toBe(bySlot(container, 'banner-description'));
		expect(seen?.actions).toBe(bySlot(container, 'banner-actions'));
		expect(seen?.close).toBe(bySlot(container, 'banner-close'));
	});

	it('renders the caller element for root child mode and keeps ref null', () => {
		let seen: BannerHarnessRefs | undefined;
		const { container } = render(Harness, {
			props: { rootChild: true, onRefs: (r) => (seen = r) }
		});

		const root = container.querySelector('[data-testid="root-child"]');
		expect(root?.tagName).toBe('SECTION');
		expect(root).toHaveAttribute('data-slot', 'banner');
		expect(root).toHaveAttribute('role', 'status');
		expect(seen?.root).toBeNull();
	});

	it('renders the caller element for icon, content and actions child mode', () => {
		const { container } = render(Harness, {
			props: { iconChild: true, contentChild: true, actionsChild: true }
		});

		expect(container.querySelector('[data-testid="icon-child"]')).toHaveAttribute(
			'data-slot',
			'banner-icon'
		);
		expect(container.querySelector('[data-testid="content-child"]')).toHaveAttribute(
			'data-slot',
			'banner-content'
		);
		expect(container.querySelector('[data-testid="actions-child"]')).toHaveAttribute(
			'data-slot',
			'banner-actions'
		);
	});

	it('renders a content part with no provider ancestor without throwing', () => {
		expect(() => render(Harness, { props: { iconChild: false } })).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Guard rails (T005/T007a — getBannersContext outside a provider)
// ---------------------------------------------------------------------------

describe('Banner queue guard rails', () => {
	it('getBannersContext throws, naming both the consumer and Banner.Queue', () => {
		expect(() => render(Harness, { props: { mode: 'bare-queue-controls' } })).toThrow(
			'`<BannerControls>` must be used within `<Banner.Queue>`.'
		);
	});

	it('a component inside a real Banner.Queue resolves the context without throwing', () => {
		expect(() => render(Harness, { props: { mode: 'queue', specs: [] } })).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Positioning, strategy and queue rendering (T007a/T008, US2/US3)
// ---------------------------------------------------------------------------

describe('Banner queue positioning and rendering (T007a/T008, US2/US3)', () => {
	function settle() {
		vi.advanceTimersByTime(0);
		flushSync();
	}

	async function wait(ms: number) {
		await new Promise((resolve) => setTimeout(resolve, ms));
		flushSync();
	}

	beforeEach(() => {
		vi.useFakeTimers();
	});

	it('renders no banner-container when the queue is empty', () => {
		const { container } = render(Harness, { props: { mode: 'queue', specs: [] } });
		expect(container.querySelector('[data-slot="banner-container"]')).toBeNull();
	});

	it('registers a declarative Banner as exactly one queued-banner with no banner slot of its own', () => {
		const { container } = render(Harness, {
			props: { mode: 'queue', strategy: 'static', specs: [{ key: 'a' }] }
		});
		settle();

		expect(container.querySelector('[data-slot="banner"]')).toBeNull();
		expect(allBySlot(container, 'queued-banner')).toHaveLength(1);
	});

	it('side="bottom" sets data-side and bottom-0 on the container', () => {
		const { container } = render(Harness, {
			props: { mode: 'queue', strategy: 'static', side: 'bottom', specs: [{ key: 'a' }] }
		});
		settle();

		const stack = bySlot(container, 'banner-container');
		expect(stack).toHaveAttribute('data-side', 'bottom');
		expect(stack.className).toContain('bottom-0');
	});

	it('renders the container inline for the static strategy', () => {
		const { container } = render(Harness, {
			props: { mode: 'queue', strategy: 'static', specs: [{ key: 'a' }] }
		});
		settle();

		const stack = bySlot(container, 'banner-container');
		expect(stack).toHaveAttribute('data-strategy', 'static');
		expect(stack.className).toContain('relative');
		expect(container.contains(stack)).toBe(true);
	});

	it('portals the container to document.body for the fixed strategy', () => {
		const { container } = render(Harness, {
			props: { mode: 'queue', strategy: 'fixed', specs: [{ key: 'a' }] }
		});
		settle();

		const stack = document.body.querySelector('[data-slot="banner-container"]');
		expect(stack).not.toBeNull();
		expect(container.contains(stack)).toBe(false);
	});

	it('portals the container into an explicit Element container target (T031)', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);

		try {
			const { container } = render(Harness, {
				props: { mode: 'queue', strategy: 'fixed', container: target, specs: [{ key: 'a' }] }
			});
			settle();

			const stack = target.querySelector('[data-slot="banner-container"]');
			expect(stack).not.toBeNull();
			expect(container.contains(stack)).toBe(false);
		} finally {
			target.remove();
		}
	});

	it('portals the container into a CSS-selector container target (T031)', () => {
		const target = document.createElement('div');
		target.id = 'banner-portal-target';
		document.body.appendChild(target);

		try {
			const { container } = render(Harness, {
				props: {
					mode: 'queue',
					strategy: 'fixed',
					container: '#banner-portal-target',
					specs: [{ key: 'a' }]
				}
			});
			settle();

			const stack = target.querySelector('[data-slot="banner-container"]');
			expect(stack).not.toBeNull();
			expect(container.contains(stack)).toBe(false);
		} finally {
			target.remove();
		}
	});

	it('carries upstream data-mounted/data-removed/data-front/data-index on queued banners (T030)', async () => {
		vi.useRealTimers();
		const user = userEvent.setup();
		const { container } = render(Harness, {
			props: {
				mode: 'queue',
				strategy: 'static',
				maxVisible: 2,
				specs: [
					{ key: 'a', priority: 1 },
					{ key: 'b', priority: 0 }
				]
			}
		});
		await wait(100);

		const queued = allBySlot(container, 'queued-banner');
		expect(queued).toHaveLength(2);
		expect(queued[0]).toHaveAttribute('data-front', 'true');
		expect(queued[0]).toHaveAttribute('data-index', '0');
		expect(queued[0]).toHaveAttribute('data-mounted', 'true');
		expect(queued[0]).toHaveAttribute('data-removed', 'false');
		expect(queued[1]).toHaveAttribute('data-front', 'false');
		expect(queued[1]).toHaveAttribute('data-index', '1');
		expect(queued[1]).toHaveAttribute('data-mounted', 'true');
		expect(queued[1]).toHaveAttribute('data-removed', 'false');

		await user.click(screen.getByTestId('close-a'));
		expect(bySlot(container, 'queued-banner')).toHaveAttribute('data-removed', 'true');
	});

	it('side="bottom" flips the queued banner transform to a negative offset (T032)', async () => {
		vi.useRealTimers();
		const { container } = render(Harness, {
			props: {
				mode: 'queue',
				strategy: 'static',
				side: 'bottom',
				maxVisible: 2,
				specs: [
					{ key: 'a', priority: 1 },
					{ key: 'b', priority: 0 }
				]
			}
		});
		await wait(100);

		const queued = allBySlot(container, 'queued-banner');
		expect(queued[0].style.transform).toMatch(/^translateY\(-?0px\)$/);
		expect(queued[1].style.transform).toBe(`translateY(-${BANNER_HEIGHT}px)`);
	});

	it('caps visible banners at maxVisible and reveals the next one after dismissal', async () => {
		vi.useRealTimers();
		const user = userEvent.setup();
		const { container } = render(Harness, {
			props: {
				mode: 'queue',
				maxVisible: 1,
				strategy: 'static',
				specs: [
					{ key: 'a', priority: 1 },
					{ key: 'b', priority: 0 }
				]
			}
		});
		flushSync();

		expect(allBySlot(container, 'queued-banner')).toHaveLength(1);
		expect(screen.getByTestId('icon-a')).toBeInTheDocument();

		await user.click(screen.getByTestId('close-a'));
		await wait(500);

		expect(container.querySelector('[data-testid="icon-a"]')).toBeNull();
		expect(screen.getByTestId('icon-b')).toBeInTheDocument();
	});

	it('marks a closing banner data-state=closed while still mounted, then removes it', async () => {
		vi.useRealTimers();
		const user = userEvent.setup();
		const { container } = render(Harness, {
			props: { mode: 'queue', strategy: 'static', specs: [{ key: 'a' }] }
		});
		flushSync();

		await user.click(screen.getByTestId('close-a'));
		expect(bySlot(container, 'queued-banner')).toHaveAttribute('data-state', 'closed');
		expect(bySlot(container, 'queued-banner')).toBeInTheDocument();

		await wait(500);

		expect(container.querySelector('[data-slot="queued-banner"]')).toBeNull();
	});

	it('auto-dismisses via duration and calls onDismiss then onOpenChange(false)', () => {
		const events: BannerHarnessEvent[] = [];
		render(Harness, {
			props: {
				mode: 'queue',
				strategy: 'static',
				specs: [{ key: 'a', duration: 50 }],
				onQueueEvent: (event: BannerHarnessEvent) => events.push(event)
			}
		});
		flushSync();

		// Two steps, flushing between them: the `duration` timer's callback writes `removing`, which
		// only schedules the 400ms exit timer once the resulting effect has actually run.
		vi.advanceTimersByTime(50);
		flushSync();
		vi.advanceTimersByTime(400);
		flushSync();

		expect(events).toContainEqual({ key: 'a', type: 'dismiss' });
		expect(events).toContainEqual({ key: 'a', type: 'openChange', open: false });
	});

	it('destroying a registered Banner removes its queue entry and fires the dismissal callbacks', async () => {
		vi.useRealTimers();
		const events: BannerHarnessEvent[] = [];
		const { container, rerender } = render(Harness, {
			props: {
				mode: 'queue',
				strategy: 'static',
				specs: [{ key: 'a' }],
				onQueueEvent: (event: BannerHarnessEvent) => events.push(event)
			}
		});
		flushSync();
		expect(allBySlot(container, 'queued-banner')).toHaveLength(1);

		await rerender({
			mode: 'queue',
			strategy: 'static',
			specs: [{ key: 'a', mounted: false }],
			onQueueEvent: (event: BannerHarnessEvent) => events.push(event)
		});

		expect(container.querySelector('[data-slot="queued-banner"]')).toBeNull();
		expect(events).toContainEqual({ key: 'a', type: 'dismiss' });
		expect(events).toContainEqual({ key: 'a', type: 'openChange', open: false });
	});
});
