import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Harness, {
	type BadgeOverflowHarnessProps,
	type BadgeOverflowHarnessTag
} from './badge-overflow.test.svelte';
import {
	BadgeOverflowState,
	computeVisibleSplit,
	DEFAULT_BADGE_GAP,
	DEFAULT_BADGE_HEIGHT,
	DEFAULT_OVERFLOW_BADGE_WIDTH,
	getPlaceholderCount,
	getPlaceholderHeight,
	observeResize,
	readContainerMetrics,
	resolveBadgeLabel
} from './index.js';

// ---------------------------------------------------------------------------
// Fixtures (research R-07)
//
// jsdom performs no layout: `offsetWidth`, `offsetHeight` and `clientWidth` all report `0` and
// `ResizeObserver` never fires. Without deterministic stand-ins the component would sit in its
// pre-measurement placeholder branch forever and none of FR-001/FR-006/FR-007 could be asserted.
// The stubs below make every badge width a pure function of its own text, so each expectation can
// be worked out by hand. `tests/setup.ts` and `vite.config.ts` are deliberately untouched.
// ---------------------------------------------------------------------------

const CHAR_WIDTH = 8;
const BADGE_PADDING = 16;
const BADGE_HEIGHT = 20;

/** The six tags shared by most cases. Widths: 56, 96, 72, 112, 88, 88. */
const TAGS = ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Shadcn UI', 'Radix UI'];

/** Upstream's multi-line demo list, used for the placeholder-slice table. */
const TECHNOLOGIES = [
	'React',
	'TypeScript',
	'Next.js',
	'Tailwind CSS',
	'Shadcn UI',
	'Radix UI',
	'Zustand',
	'React Query',
	'Prisma',
	'PostgreSQL',
	'Docker',
	'Kubernetes',
	'AWS',
	'Vercel',
	'GitHub Actions'
];

function widthForLabel(label: string): number {
	return BADGE_PADDING + label.length * CHAR_WIDTH;
}

/** The width one badge occupies on a line, including the gap that follows it. */
function widthWithGap(label: string): number {
	return widthForLabel(label) + DEFAULT_BADGE_GAP;
}

/** Per-test value returned by the stubbed `Element.prototype.clientWidth`. */
let containerWidth = 0;

/** Every {@link MockResizeObserver} constructed during the current test. */
let observers: MockResizeObserver[] = [];

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

	/** Test-only: run the observed callback as though the container had resized. */
	notify(): void {
		this.#callback([], this);
	}
}

const ORIGINAL_RESIZE_OBSERVER = globalThis.ResizeObserver;

beforeEach(() => {
	containerWidth = 0;
	observers = [];

	vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
		this: HTMLElement
	) {
		// Svelte keeps the template's own indentation in a text node, so the rendered text is
		// collapsed the way a browser would collapse it before it becomes a width.
		return widthForLabel((this.textContent ?? '').replace(/\s+/g, ' ').trim());
	});
	vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => BADGE_HEIGHT);
	vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(() => containerWidth);

	globalThis.ResizeObserver = MockResizeObserver;
});

afterEach(() => {
	// The global `afterEach` restores the `vi.spyOn` getters; a plain assignment needs undoing here.
	globalThis.ResizeObserver = ORIGINAL_RESIZE_OBSERVER;
});

/** Props change → DOM update → measurement effect → state write → re-render. */
async function settle(): Promise<void> {
	await tick();
	await tick();
}

async function renderHarness(props: BadgeOverflowHarnessProps, width: number) {
	containerWidth = width;
	const result = render(Harness, { props });
	await settle();
	return result;
}

async function resizeTo(width: number): Promise<void> {
	containerWidth = width;
	for (const observer of observers) observer.notify();
	await settle();
}

function bySlot(scope: HTMLElement, slot: string): HTMLElement {
	const element = scope.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function visibleContainer(scope: HTMLElement): HTMLElement {
	return bySlot(scope, 'badge-overflow');
}

function measureRow(scope: HTMLElement): HTMLElement {
	return bySlot(scope, 'badge-overflow-measure');
}

function badgeLabels(scope: HTMLElement): string[] {
	return [...scope.querySelectorAll('[data-testid="badge"]')].map(
		(badge) => badge.getAttribute('data-label') ?? ''
	);
}

function indicator(scope: HTMLElement): HTMLElement | null {
	return scope.querySelector<HTMLElement>('[data-slot="badge-overflow-indicator"]');
}

// ---------------------------------------------------------------------------
// Pure helpers (quickstart row 27)
// ---------------------------------------------------------------------------

describe('resolveBadgeLabel', () => {
	it('uses a primitive item as its own label', () => {
		expect(resolveBadgeLabel('React')).toBe('React');
		expect(resolveBadgeLabel(42)).toBe('42');
		expect(resolveBadgeLabel(true)).toBe('true');
	});

	it('uses the extractor when one is supplied', () => {
		expect(resolveBadgeLabel({ label: 'React', value: 'react' }, (tag) => tag.label)).toBe('React');
	});

	it('throws upstream’s verbatim message for an object item with no extractor', () => {
		expect(() => resolveBadgeLabel({ label: 'React' })).toThrow(
			'`getBadgeLabel` is required when using array of objects'
		);
	});

	it('throws the same message for null, reproducing typeof null === "object"', () => {
		expect(() => resolveBadgeLabel(null)).toThrow(
			'`getBadgeLabel` is required when using array of objects'
		);
	});
});

describe('readContainerMetrics', () => {
	it('parses the computed gap and horizontal padding, and nets the padding off clientWidth', () => {
		containerWidth = 200;
		const element = document.createElement('div');
		element.setAttribute('style', 'gap: 10px; padding-left: 12px; padding-right: 12px;');
		document.body.appendChild(element);

		expect(readContainerMetrics(element)).toEqual({ gap: 10, padding: 24, contentWidth: 176 });
	});

	it('falls back to the documented gap default when the computed gap is not a length', () => {
		containerWidth = 100;
		// A flex container with no `gap` set computes to `normal`, so `parseFloat` yields `NaN`.
		// Upstream writes that `NaN` straight back out; the port guards with `Number.isFinite`
		// and keeps the documented default of 4 (research R-02).
		const element = document.createElement('div');
		document.body.appendChild(element);

		expect(readContainerMetrics(element)).toEqual({
			gap: DEFAULT_BADGE_GAP,
			padding: 0,
			contentWidth: 100
		});
	});
});

describe('getPlaceholderCount / getPlaceholderHeight', () => {
	it('bounds the placeholder slice per upstream’s lineCount * 3 - (lineCount > 1 ? 1 : 0)', () => {
		expect(getPlaceholderCount(15, 1)).toBe(3);
		expect(getPlaceholderCount(15, 2)).toBe(5);
		expect(getPlaceholderCount(15, 3)).toBe(8);
	});

	it('never reports more placeholders than there are items', () => {
		expect(getPlaceholderCount(2, 3)).toBe(2);
		expect(getPlaceholderCount(0, 1)).toBe(0);
	});

	it('guesses a min-height of badgeHeight * lineCount + gap * (lineCount - 1)', () => {
		expect(getPlaceholderHeight(DEFAULT_BADGE_HEIGHT, DEFAULT_BADGE_GAP, 1)).toBe(20);
		expect(getPlaceholderHeight(DEFAULT_BADGE_HEIGHT, DEFAULT_BADGE_GAP, 2)).toBe(44);
		expect(getPlaceholderHeight(DEFAULT_BADGE_HEIGHT, DEFAULT_BADGE_GAP, 3)).toBe(68);
	});
});

describe('computeVisibleSplit', () => {
	function split(
		items: string[],
		widths: Array<[string, number]>,
		options: { containerWidth: number; lineCount?: number; overflowBadgeWidth?: number }
	) {
		return computeVisibleSplit({
			items,
			labels: items,
			badgeWidths: new Map(widths),
			containerWidth: options.containerWidth,
			badgeGap: DEFAULT_BADGE_GAP,
			overflowBadgeWidth: options.overflowBadgeWidth ?? DEFAULT_OVERFLOW_BADGE_WIDTH,
			lineCount: options.lineCount ?? 1
		});
	}

	it('short circuits to "everything visible" when the container has no measured width', () => {
		expect(split(['a'], [['a', 50]], { containerWidth: 0 })).toEqual({
			visibleItems: ['a'],
			hiddenCount: 0
		});
	});

	it('short circuits for an empty items list and for an unmeasured width map', () => {
		expect(split([], [['a', 50]], { containerWidth: 100 })).toEqual({
			visibleItems: [],
			hiddenCount: 0
		});
		expect(split(['a'], [], { containerWidth: 100 })).toEqual({
			visibleItems: ['a'],
			hiddenCount: 0
		});
	});

	it('skips a falsy item without counting it as hidden, verbatim from upstream', () => {
		// Upstream guards with `if (!item) continue`, so `''` is skipped entirely: it neither
		// consumes width nor becomes visible, yet it still counts toward `items.length`.
		const result = split(
			['', 'a'],
			[
				['', 8],
				['a', 50]
			],
			{ containerWidth: 100 }
		);
		expect(result.visibleItems).toEqual(['a']);
		expect(result.hiddenCount).toBe(1);
	});

	it('skips a label whose measured width is zero, verbatim from upstream', () => {
		// Upstream guards with `if (!badgeWidth) continue`, so a measured `0` is skipped too.
		const result = split(
			['a', 'b'],
			[
				['a', 0],
				['b', 40]
			],
			{ containerWidth: 100 }
		);
		expect(result.visibleItems).toEqual(['b']);
		expect(result.hiddenCount).toBe(1);
	});

	it('evaluates the final item against the full width, reserving no indicator space', () => {
		// `b` needs 44 on top of `a`'s 54. As the final item it is measured against the full 100…
		expect(
			split(
				['a', 'b'],
				[
					['a', 50],
					['b', 40]
				],
				{ containerWidth: 100 }
			)
		).toEqual({
			visibleItems: ['a', 'b'],
			hiddenCount: 0
		});
		// …but with one more item behind it, the same `b` is measured against 100 - 40 - 4 = 56 and
		// no longer fits. This asymmetry is upstream's shipped behaviour (research R-05); the
		// `use-badge-overflow.ts` hook's `pop()` correction is deliberately not adopted.
		expect(
			split(
				['a', 'b', 'c'],
				[
					['a', 50],
					['b', 40],
					['c', 8]
				],
				{ containerWidth: 100 }
			)
		).toEqual({ visibleItems: ['a'], hiddenCount: 2 });
	});

	it('pushes a badge wider than the whole container onto a fresh line while lines remain', () => {
		expect(
			split(
				['a', 'wide'],
				[
					['a', 50],
					['wide', 200]
				],
				{ containerWidth: 100, lineCount: 2 }
			)
		).toEqual({ visibleItems: ['a', 'wide'], hiddenCount: 0 });
	});

	it('breaks on the last line once a badge no longer fits', () => {
		expect(
			split(
				['a', 'wide', 'b'],
				[
					['a', 50],
					['wide', 200],
					['b', 40]
				],
				{ containerWidth: 100 }
			)
		).toEqual({ visibleItems: ['a'], hiddenCount: 2 });
	});
});

describe('observeResize', () => {
	it('observes the element and disconnects through the returned teardown', () => {
		const element = document.createElement('div');
		const onResize = vi.fn();

		const teardown = observeResize(element, onResize);
		expect(observers).toHaveLength(1);
		expect(observers[0].targets).toEqual([element]);

		observers[0].notify();
		expect(onResize).toHaveBeenCalledTimes(1);

		teardown();
		expect(observers[0].disconnectCount).toBe(1);
	});

	it('no-ops with a safe teardown when ResizeObserver is unavailable (SSR guard)', () => {
		const element = document.createElement('div');
		vi.stubGlobal('ResizeObserver', undefined);

		const teardown = observeResize(element, () => {
			throw new Error('the callback must never run without a ResizeObserver');
		});

		expect(teardown).toBeInstanceOf(Function);
		expect(() => teardown()).not.toThrow();
		vi.unstubAllGlobals();
	});
});

// ---------------------------------------------------------------------------
// Pre-measurement / SSR view (quickstart rows 3 and 4)
// ---------------------------------------------------------------------------

describe('BadgeOverflowState before the first measurement', () => {
	// `render()` from `svelte/server` cannot be used here: Vitest resolves the browser build of
	// every component (`svelteTesting()` sets the browser condition), so the server renderer has no
	// payload to write into, and `vite.config.ts` is off limits (quickstart.md §1). The substitute
	// is the `BadgeOverflow before the first measurement` block below, which asserts the rendered
	// `isMeasured === false` markup — the branch the server emits (research R-09) — off an
	// unflushed `mount()`. This block pins the state object that drives that markup.
	function placeholderState(lineCount: number) {
		return new BadgeOverflowState<string>({
			getItems: () => TECHNOLOGIES,
			getGetBadgeLabel: () => undefined,
			getLineCount: () => lineCount
		});
	}

	it('starts unmeasured, with upstream’s seeded metrics', () => {
		const state = placeholderState(1);
		expect(state.isMeasured).toBe(false);
		expect(state.badgeGap).toBe(DEFAULT_BADGE_GAP);
		expect(state.badgeHeight).toBe(DEFAULT_BADGE_HEIGHT);
		expect(state.overflowBadgeWidth).toBe(DEFAULT_OVERFLOW_BADGE_WIDTH);
		expect(state.hiddenCount).toBe(0);
	});

	it('bounds the placeholder slice and min-height for lineCount 1, 2 and 3', () => {
		const table = [
			{ lineCount: 1, count: 3, height: 20 },
			{ lineCount: 2, count: 5, height: 44 },
			{ lineCount: 3, count: 8, height: 68 }
		];

		for (const row of table) {
			const state = placeholderState(row.lineCount);
			expect(state.placeholderItems).toHaveLength(row.count);
			expect(state.placeholderItems).toEqual(TECHNOLOGIES.slice(0, row.count));
			expect(state.placeholderHeight).toBe(row.height);
		}
	});

	it('reports isEmpty for an empty items list', () => {
		const state = new BadgeOverflowState<string>({
			getItems: () => [],
			getGetBadgeLabel: () => undefined,
			getLineCount: () => 1
		});
		expect(state.isEmpty).toBe(true);
		expect(state.placeholderItems).toEqual([]);
	});
});

describe('BadgeOverflow before the first measurement', () => {
	const PLACEHOLDER_TABLE = [
		{ lineCount: 1, count: 3, height: 20 },
		{ lineCount: 2, count: 5, height: 44 },
		{ lineCount: 3, count: 8, height: 68 }
	];

	/**
	 * Mount by hand and do not flush, so the DOM can be read in its pre-measurement state.
	 *
	 * `render()` from `@testing-library/svelte` cannot show that state: it flushes pending effects
	 * before returning, so the measurement pass has already run by the time it hands back a
	 * container. `render()` from `svelte/server` cannot either — `svelteTesting()` in
	 * `vite.config.ts` sets the browser resolve condition, so the server renderer receives a client
	 * component and throws, and quickstart.md §1 forbids changing that config. A bare `mount()` is
	 * the one route to the `isMeasured === false` markup, which is the branch the server emits
	 * (research R-09).
	 */
	function mountUnflushed(props: BadgeOverflowHarnessProps) {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const app = mount(Harness, { target, props });

		return {
			root: bySlot(target, 'badge-overflow'),
			dispose: () => {
				void unmount(app);
				target.remove();
			}
		};
	}

	it('renders the bounded badge slice and no indicator, for lineCount 1, 2 and 3', () => {
		for (const row of PLACEHOLDER_TABLE) {
			containerWidth = 256;
			const { root, dispose } = mountUnflushed({
				items: TECHNOLOGIES,
				lineCount: row.lineCount
			});

			expect(root).not.toHaveAttribute('data-measured');
			expect(root).toHaveAttribute('data-line-count', String(row.lineCount));
			expect(badgeLabels(root)).toEqual(TECHNOLOGIES.slice(0, row.count));
			expect(badgeLabels(root)).toHaveLength(
				getPlaceholderCount(TECHNOLOGIES.length, row.lineCount)
			);
			expect(indicator(root)).toBeNull();

			dispose();
		}
	});

	it('reserves a min-height from the seeded metrics alongside the seeded gap', () => {
		for (const row of PLACEHOLDER_TABLE) {
			containerWidth = 256;
			const { root, dispose } = mountUnflushed({
				items: TECHNOLOGIES,
				lineCount: row.lineCount
			});

			expect(root.style.gap).toBe(`${DEFAULT_BADGE_GAP}px`);
			expect(root.style.minHeight).toBe(`${row.height}px`);
			// Nothing has been measured yet, so the guess comes from the seeds, not from the DOM.
			expect(root.style.minHeight).toBe(
				`${getPlaceholderHeight(DEFAULT_BADGE_HEIGHT, DEFAULT_BADGE_GAP, row.lineCount)}px`
			);

			dispose();
		}
	});

	it('swaps to the measured branch on the first flush', () => {
		containerWidth = 256;
		const { root, dispose } = mountUnflushed({ items: TECHNOLOGIES });

		expect(root).not.toHaveAttribute('data-measured');
		expect(root.style.minHeight).toBe('20px');
		expect(badgeLabels(root)).toHaveLength(3);

		flushSync();

		expect(root).toHaveAttribute('data-measured', '');
		expect(root.style.minHeight).toBe('');
		expect(indicator(root)).not.toBeNull();

		dispose();
	});
});

// ---------------------------------------------------------------------------
// Rendering and the core split (US1)
// ---------------------------------------------------------------------------

describe('BadgeOverflow rendering', () => {
	it('renders the measurement row with one child per item plus the overflow sample', async () => {
		const { container } = await renderHarness({ items: TAGS }, 256);
		const row = measureRow(container);

		expect(row.children).toHaveLength(TAGS.length + 1);
		expect(row).toHaveAttribute('aria-hidden', 'true');
		expect(badgeLabels(row)).toEqual(TAGS);
		expect(row.children[TAGS.length]).toHaveAttribute('data-count', '99');
		expect(row).toHaveClass('pointer-events-none', 'invisible', 'absolute', 'flex', 'flex-wrap');
	});

	it('exposes the documented data attributes and merges the caller class last', async () => {
		const { container } = await renderHarness({ items: TAGS, class: 'flex-nowrap border' }, 256);
		const root = visibleContainer(container);

		expect(root).toHaveAttribute('data-slot', 'badge-overflow');
		expect(root).toHaveAttribute('data-measured', '');
		expect(root).toHaveAttribute('data-line-count', '1');
		expect(root).toHaveAttribute('data-hidden-count', '4');
		expect(root).not.toHaveAttribute('data-empty');
		// `cn()` puts the caller last, so `flex-nowrap` wins the tailwind-merge conflict.
		expect(root).toHaveClass('flex', 'flex-nowrap', 'border');
		expect(root).not.toHaveClass('flex-wrap');
	});

	it('shows only the badges that fit, followed by one indicator carrying the hidden count', async () => {
		const { container } = await renderHarness({ items: TAGS }, 256);
		const root = visibleContainer(container);

		expect(badgeLabels(root)).toEqual(['React', 'TypeScript']);
		expect(root).toHaveAttribute('data-hidden-count', '4');

		const badge = indicator(root);
		expect(badge).toHaveAttribute('data-count', '4');
		expect(badge).toHaveTextContent('+4');
		expect(root.querySelectorAll('[data-slot="badge-overflow-indicator"]')).toHaveLength(1);
		// The indicator is always the last child of the container.
		expect(root.lastElementChild).toBe(badge);

		// SC-001: what is shown, plus the indicator, fits the measured width.
		const used = widthWithGap('React') + widthWithGap('TypeScript');
		expect(used + DEFAULT_OVERFLOW_BADGE_WIDTH).toBeLessThanOrEqual(256);
	});

	it('shows every badge and no indicator when the container is wide enough', async () => {
		const { container } = await renderHarness({ items: TAGS }, 2000);
		const root = visibleContainer(container);

		expect(badgeLabels(root)).toEqual(TAGS);
		expect(indicator(root)).toBeNull();
		expect(root).toHaveAttribute('data-hidden-count', '0');
	});

	it('keeps hidden-count equal to items.length minus the rendered badges', async () => {
		const { container } = await renderHarness({ items: TAGS }, 256);
		const root = visibleContainer(container);

		expect(Number(root.dataset.hiddenCount)).toBe(TAGS.length - badgeLabels(root).length);
	});
});

describe('BadgeOverflow resizing', () => {
	it('updates the split when the container resizes, with no prop change and no remount', async () => {
		const { container } = await renderHarness({ items: TAGS }, 256);
		const root = visibleContainer(container);
		expect(root).toHaveAttribute('data-hidden-count', '4');

		await resizeTo(2000);
		expect(root).toHaveAttribute('data-hidden-count', '0');
		expect(badgeLabels(root)).toEqual(TAGS);

		await resizeTo(256);
		expect(root).toHaveAttribute('data-hidden-count', '4');
		expect(badgeLabels(root)).toEqual(['React', 'TypeScript']);
		// The very same element throughout: the update is reactive, not a remount.
		expect(visibleContainer(container)).toBe(root);
	});

	it('creates exactly one observer and disconnects it once on unmount', async () => {
		const { unmount } = await renderHarness({ items: TAGS }, 256);
		expect(observers).toHaveLength(1);

		unmount();
		await settle();

		expect(observers[0].disconnectCount).toBe(1);
	});

	it('still measures once when the environment has no ResizeObserver', async () => {
		vi.stubGlobal('ResizeObserver', undefined);

		const { container } = await renderHarness({ items: TAGS }, 256);
		const root = visibleContainer(container);

		expect(root).toHaveAttribute('data-measured', '');
		expect(badgeLabels(root)).toEqual(['React', 'TypeScript']);
		vi.unstubAllGlobals();
	});
});

describe('BadgeOverflow items changes', () => {
	it('re-measures when the consumer adds and removes items', async () => {
		containerWidth = 290;
		const { container, rerender } = render(Harness, {
			props: { items: ['React', 'TypeScript'] } satisfies BadgeOverflowHarnessProps
		});
		await settle();

		const root = visibleContainer(container);
		expect(badgeLabels(root)).toEqual(['React', 'TypeScript']);
		expect(root).toHaveAttribute('data-hidden-count', '0');

		await rerender({ items: TAGS });
		await settle();
		expect(badgeLabels(root)).toEqual(['React', 'TypeScript', 'Next.js']);
		expect(root).toHaveAttribute('data-hidden-count', '3');

		await rerender({ items: ['React'] });
		await settle();
		expect(badgeLabels(root)).toEqual(['React']);
		expect(root).toHaveAttribute('data-hidden-count', '0');
	});
});

// ---------------------------------------------------------------------------
// Accessibility (Constitution III, research R-08)
// ---------------------------------------------------------------------------

describe('BadgeOverflow accessibility', () => {
	it('adds no role, no aria attribute and no tab stop to the visible container', async () => {
		const { container } = await renderHarness({ items: TAGS }, 256);
		const root = visibleContainer(container);

		expect(root).not.toHaveAttribute('role');
		expect(root).not.toHaveAttribute('tabindex');
		expect(
			[...root.attributes]
				.map((attribute) => attribute.name)
				.filter((name) => name.startsWith('aria-'))
		).toEqual([]);
	});

	it('leaves the tab sequence to the consumer’s badge markup, in DOM order', async () => {
		const user = userEvent.setup();
		const { container } = await renderHarness({ items: TAGS, interactiveBadges: true }, 2000);
		const root = visibleContainer(container);
		const buttons = [...root.querySelectorAll('button')];

		expect(buttons).toHaveLength(TAGS.length);

		// Scoped to the visible container on purpose: jsdom applies no Tailwind, so the measurement
		// row's `invisible` class does not remove its copy of the badges from the tab sequence the
		// way it does in a browser. What FR-017 pins down is that the component adds no tab stop of
		// its own and does not reorder the consumer's badges.
		buttons[0].focus();
		await user.tab();
		expect(buttons[1]).toHaveFocus();
		await user.tab();
		expect(buttons[2]).toHaveFocus();
	});
});

// ---------------------------------------------------------------------------
// Custom rendering and label resolution (US3)
// ---------------------------------------------------------------------------

describe('BadgeOverflow custom rendering', () => {
	it('renders the badge snippet for every visible item, in items order', async () => {
		const { container } = await renderHarness({ items: TAGS, lineCount: 2 }, 256);
		const root = visibleContainer(container);
		const badges = [...root.querySelectorAll('[data-testid="badge"]')];

		expect(badges.map((badge) => badge.tagName)).toEqual(Array(5).fill('SPAN'));
		expect(badges.map((badge) => badge.textContent)).toEqual([
			'React',
			'TypeScript',
			'Next.js',
			'Tailwind CSS',
			'Shadcn UI'
		]);
	});

	it('lets an overflow snippet replace the built-in indicator and receive the hidden count', async () => {
		const { container } = await renderHarness({ items: TAGS, customOverflow: true }, 256);
		const root = visibleContainer(container);

		expect(indicator(root)).toBeNull();
		const custom = root.querySelector('[data-testid="custom-overflow"]');
		expect(custom).toHaveAttribute('data-count', '4');
		expect(custom).toHaveTextContent('+4 more');
	});

	it('renders the sample overflow snippet at count 99 in the measurement row', async () => {
		const { container } = await renderHarness({ items: TAGS, customOverflow: true }, 256);
		const samples = measureRow(container).querySelectorAll('[data-testid="custom-overflow"]');

		expect(samples).toHaveLength(1);
		expect(samples[0]).toHaveAttribute('data-count', '99');
	});

	it('renders the default indicator with the outline-badge class set when no snippet is given', async () => {
		const { container } = await renderHarness({ items: TAGS }, 256);
		const badge = indicator(visibleContainer(container));

		expect(badge).toHaveClass(
			'inline-flex',
			'h-5',
			'w-fit',
			'shrink-0',
			'items-center',
			'justify-center',
			'rounded-4xl',
			'border',
			'border-border',
			'px-2',
			'py-0.5',
			'text-xs',
			'font-medium',
			'whitespace-nowrap',
			'text-foreground'
		);
	});

	it('uses primitive items as their own labels with no extractor', async () => {
		const { container } = await renderHarness({ items: [1, 22, 'three'] }, 2000);

		expect(badgeLabels(visibleContainer(container))).toEqual(['1', '22', 'three']);
	});

	it('throws upstream’s message when object items arrive without an extractor', () => {
		expect(() => render(Harness, { props: { items: [{ label: 'React' }] } })).toThrow(
			'`getBadgeLabel` is required when using array of objects'
		);
	});

	it('throws the same message for a null item', () => {
		expect(() => render(Harness, { props: { items: [null] } })).toThrow(
			'`getBadgeLabel` is required when using array of objects'
		);
	});

	it('uses the extractor for both the label and the measured width of object items', async () => {
		const tags: BadgeOverflowHarnessTag[] = TAGS.map((label) => ({
			label,
			value: label.toLowerCase()
		}));
		const { container } = await renderHarness(
			{
				items: tags,
				getBadgeLabel: (item) => (item as BadgeOverflowHarnessTag).label
			},
			256
		);
		const root = visibleContainer(container);

		// Same labels as the string case, therefore the same measured widths and the same split.
		expect(badgeLabels(root)).toEqual(['React', 'TypeScript']);
		expect(root).toHaveAttribute('data-hidden-count', '4');
	});
});

// ---------------------------------------------------------------------------
// lineCount (US2)
// ---------------------------------------------------------------------------

describe('BadgeOverflow lineCount', () => {
	it('defaults to a single line', async () => {
		const { container } = await renderHarness({ items: TAGS }, 256);

		expect(visibleContainer(container)).toHaveAttribute('data-line-count', '1');
	});

	it('fits progressively more badges as lineCount grows', async () => {
		const visibleCounts: number[] = [];

		for (const lineCount of [1, 2, 3]) {
			const { container, unmount } = await renderHarness({ items: TAGS, lineCount }, 256);
			const root = visibleContainer(container);

			expect(root).toHaveAttribute('data-line-count', String(lineCount));
			visibleCounts.push(badgeLabels(root).length);
			unmount();
		}

		expect(visibleCounts).toEqual([2, 5, 6]);
		expect(visibleCounts[1]).toBeGreaterThanOrEqual(visibleCounts[0]);
		expect(visibleCounts[2]).toBeGreaterThanOrEqual(visibleCounts[1]);
	});

	it('keeps every line within the container width at lineCount 2', async () => {
		const { container } = await renderHarness({ items: TAGS, lineCount: 2 }, 256);

		expect(badgeLabels(visibleContainer(container))).toEqual([
			'React',
			'TypeScript',
			'Next.js',
			'Tailwind CSS',
			'Shadcn UI'
		]);

		// Line 1 packs three badges, line 2 packs two plus the reserved indicator; SC-001 requires
		// neither to exceed 256.
		const firstLine = widthWithGap('React') + widthWithGap('TypeScript') + widthWithGap('Next.js');
		const secondLine = widthWithGap('Tailwind CSS') + widthWithGap('Shadcn UI');
		expect(firstLine).toBeLessThanOrEqual(256);
		expect(secondLine + DEFAULT_OVERFLOW_BADGE_WIDTH).toBeLessThanOrEqual(256);
	});

	it('keeps every line within the container width at lineCount 3, with items left over', async () => {
		// The six-item `TAGS` list all fits by lineCount 3, so SC-001's three-line guarantee needs a
		// list long enough to actually contend for the last line: upstream's 15 technologies.
		const { container } = await renderHarness({ items: TECHNOLOGIES, lineCount: 3 }, 256);
		const root = visibleContainer(container);
		const visible = badgeLabels(root);

		expect(visible).toEqual([
			'React',
			'TypeScript',
			'Next.js',
			'Tailwind CSS',
			'Shadcn UI',
			'Radix UI',
			'Zustand'
		]);
		expect(root).toHaveAttribute('data-hidden-count', String(TECHNOLOGIES.length - visible.length));
		expect(indicator(root)).toHaveAttribute('data-count', '8');

		// Line 1 packs React/TypeScript/Next.js, line 2 Tailwind CSS/Shadcn UI, line 3 Radix
		// UI/Zustand plus the reserved indicator. SC-001 requires none of the three to exceed 256.
		const firstLine = widthWithGap('React') + widthWithGap('TypeScript') + widthWithGap('Next.js');
		const secondLine = widthWithGap('Tailwind CSS') + widthWithGap('Shadcn UI');
		const thirdLine = widthWithGap('Radix UI') + widthWithGap('Zustand');
		expect(firstLine).toBeLessThanOrEqual(256);
		expect(secondLine).toBeLessThanOrEqual(256);
		expect(thirdLine + DEFAULT_OVERFLOW_BADGE_WIDTH).toBeLessThanOrEqual(256);
	});
});

// ---------------------------------------------------------------------------
// RTL (FR-012, SC-004)
// ---------------------------------------------------------------------------

describe('BadgeOverflow in RTL', () => {
	it('produces the same split and DOM order under dir="rtl"', async () => {
		const ltr = await renderHarness({ items: TAGS }, 256);
		const ltrRoot = visibleContainer(ltr.container);
		const ltrLabels = badgeLabels(ltrRoot);
		const ltrHidden = ltrRoot.getAttribute('data-hidden-count');
		ltr.unmount();

		const rtl = await renderHarness({ items: TAGS, rtl: true }, 256);
		const rtlRoot = visibleContainer(rtl.container);

		expect(badgeLabels(rtlRoot)).toEqual(ltrLabels);
		expect(rtlRoot.getAttribute('data-hidden-count')).toBe(ltrHidden);
		// The container inherits the ambient direction rather than declaring one of its own.
		expect(rtlRoot.closest('[dir="rtl"]')).not.toBeNull();
		expect(rtlRoot).not.toHaveAttribute('dir');
	});
});

// ---------------------------------------------------------------------------
// Edge cases (spec §Edge Cases)
// ---------------------------------------------------------------------------

describe('BadgeOverflow edge cases', () => {
	it('renders no badge and no indicator for an empty items list', async () => {
		const { container } = await renderHarness({ items: [] }, 256);
		const root = visibleContainer(container);

		expect(root).toHaveAttribute('data-empty', '');
		expect(root).toHaveAttribute('data-hidden-count', '0');
		expect(badgeLabels(root)).toEqual([]);
		expect(indicator(root)).toBeNull();
		// The measurement row still holds the overflow sample and nothing else.
		expect(measureRow(container).children).toHaveLength(1);
	});

	it('still renders the indicator when not even one badge fits', async () => {
		const { container } = await renderHarness({ items: TAGS }, 40);
		const root = visibleContainer(container);

		expect(badgeLabels(root)).toEqual([]);
		expect(indicator(root)).toHaveAttribute('data-count', String(TAGS.length));
	});

	it('measures duplicate labels once and still renders both badges', async () => {
		const { container } = await renderHarness({ items: ['React', 'React', 'TypeScript'] }, 256);
		const root = visibleContainer(container);

		expect(badgeLabels(root)).toEqual(['React', 'React', 'TypeScript']);
		expect(root).toHaveAttribute('data-hidden-count', '0');
	});

	it('shows every item with no indicator when the container measures zero width', async () => {
		const { container } = await renderHarness({ items: TAGS }, 0);
		const root = visibleContainer(container);

		expect(root).toHaveAttribute('data-measured', '');
		expect(root).toHaveAttribute('data-hidden-count', '0');
		expect(badgeLabels(root)).toEqual(TAGS);
		expect(indicator(root)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Prop composition (FR-009, FR-013, FR-014, FR-016)
// ---------------------------------------------------------------------------

describe('BadgeOverflow prop composition', () => {
	it('appends the caller style after the computed gap', async () => {
		const { container } = await renderHarness({ items: TAGS, style: 'outline-style: solid;' }, 256);
		const root = visibleContainer(container);

		expect(root.style.gap).toBe(`${DEFAULT_BADGE_GAP}px`);
		expect(root.style.outlineStyle).toBe('solid');
		expect(root.style.cssText.indexOf('gap')).toBeLessThan(
			root.style.cssText.indexOf('outline-style')
		);
	});

	it('nets the container’s own horizontal padding off the usable width', async () => {
		const bare = await renderHarness({ items: TAGS }, 290);
		expect(visibleContainer(bare.container)).toHaveAttribute('data-hidden-count', '3');
		bare.unmount();

		// 12px each side removes 24px of usable width, which costs one more badge (FR-009).
		const padded = await renderHarness(
			{ items: TAGS, style: 'padding-left: 12px; padding-right: 12px;' },
			290
		);
		expect(visibleContainer(padded.container)).toHaveAttribute('data-hidden-count', '4');
	});

	it('binds ref to the visible container', async () => {
		let boundRef: HTMLDivElement | null = null;
		containerWidth = 256;
		const { container } = render(Harness, {
			props: {
				items: TAGS,
				get ref() {
					return boundRef;
				},
				set ref(value) {
					boundRef = value;
				}
			}
		});
		await settle();

		expect(boundRef).toBeInstanceOf(HTMLDivElement);
		expect(boundRef).toBe(visibleContainer(container));
	});

	it('leaves ref null in child mode and renders the generated content inside the caller element', async () => {
		let boundRef: HTMLDivElement | null = null;
		containerWidth = 256;
		const { container } = render(Harness, {
			props: {
				items: TAGS,
				useChild: true,
				get ref() {
					return boundRef;
				},
				set ref(value) {
					boundRef = value;
				}
			}
		});
		await settle();

		expect(boundRef).toBeNull();

		const section = visibleContainer(container);
		expect(section.tagName).toBe('SECTION');
		expect(section).toHaveAttribute('data-testid', 'child-root');
		expect(section).toHaveAttribute('data-measured', '');
		expect(section).toHaveAttribute('data-line-count', '1');
		expect(section).toHaveAttribute('data-hidden-count', '4');
		expect(section).toHaveClass('flex', 'flex-wrap');
		expect(badgeLabels(section)).toEqual(['React', 'TypeScript']);
		expect(indicator(section)).toHaveAttribute('data-count', '4');
	});

	it('spreads arbitrary attributes and handlers onto the visible container only', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		const { container } = await renderHarness(
			{ items: TAGS, id: 'tags', 'data-testid': 'root', onclick },
			256
		);
		const root = visibleContainer(container);

		expect(root).toHaveAttribute('id', 'tags');
		expect(root).toHaveAttribute('data-testid', 'root');
		expect(measureRow(container)).not.toHaveAttribute('id');
		expect(measureRow(container)).not.toHaveAttribute('data-testid');

		await user.click(root);
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('accepts a primitive array without getBadgeLabel and an object array with it', async () => {
		// The compile-time half of this case lives in the harness (research R-03); this render
		// proves both branches also work at runtime.
		const { container } = await renderHarness({ items: ['React'], typingExercise: true }, 2000);

		expect(container.querySelectorAll('[data-slot="badge-overflow"]')).toHaveLength(3);
	});
});
