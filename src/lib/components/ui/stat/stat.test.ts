import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as Stat from './index.js';
import {
	STAT_INDICATOR_COLORS,
	STAT_INDICATOR_VARIANTS,
	STAT_TREND_DIRECTIONS,
	StatDescription,
	StatIndicator,
	StatLabel,
	StatSeparator,
	StatTrend,
	StatValue,
	resolveStatIndicatorColor,
	resolveStatIndicatorVariant,
	resolveStatTrendDirection,
	statIndicatorVariants,
	statTrendVariants,
	type StatIndicatorColor,
	type StatIndicatorVariant
} from './index.js';
import Harness from './stat.test.svelte';

/** Children as a snippet — the pattern every ported component's tests use. */
const text = (value: string) => createRawSnippet(() => ({ render: () => `<span>${value}</span>` }));

function bySlot(container: HTMLElement, slot: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

/** V-01: the container's own base utilities, verbatim from contracts/stat-public-api.md §5.1. */
const ROOT_CLASSES = [
	'grid',
	'grid-cols-[1fr_auto]',
	'gap-x-4',
	'gap-y-1',
	'rounded-lg',
	'border',
	'bg-card',
	'p-4',
	'text-card-foreground',
	'shadow-sm'
];

/** V-02: the container's child-targeting slot rules, verbatim from the contract. */
const ROOT_SLOT_RULES = [
	'**:data-[slot=stat-label]:col-span-1',
	'**:data-[slot=stat-value]:col-span-1',
	'**:data-[slot=stat-indicator]:col-start-2',
	'**:data-[slot=stat-indicator]:row-span-2',
	'**:data-[slot=stat-indicator]:row-start-1',
	'**:data-[slot=stat-indicator]:self-start',
	'**:data-[slot=stat-description]:col-span-2',
	'**:data-[slot=stat-separator]:col-span-2',
	'**:data-[slot=stat-trend]:col-span-2'
];

/** V-03. */
const LABEL_CLASSES = ['text-sm', 'font-medium', 'text-muted-foreground'];
/** V-04. */
const VALUE_CLASSES = ['text-2xl', 'font-semibold', 'tracking-tight'];
/** V-05. */
const DESCRIPTION_CLASSES = ['text-xs', 'text-muted-foreground'];

/** V-10: the indicator's base utilities. */
const INDICATOR_BASE_CLASSES = [
	'flex',
	'shrink-0',
	'items-center',
	'justify-center',
	'[&_svg]:pointer-events-none'
];

/** V-11: the indicator's per-`variant` class rows. */
const INDICATOR_VARIANT_CLASSES: Record<StatIndicatorVariant, string[]> = {
	default: ['text-muted-foreground', "[&_svg:not([class*='size-'])]:size-5"],
	icon: ['size-8', 'rounded-md', 'border', "[&_svg:not([class*='size-'])]:size-3.5"],
	badge: [
		'h-6',
		'min-w-6',
		'rounded-sm',
		'border',
		'px-1.5',
		'text-xs',
		'font-medium',
		"[&_svg:not([class*='size-'])]:size-3"
	],
	action: [
		'size-8',
		'cursor-pointer',
		'rounded-md',
		'transition-colors',
		'hover:bg-muted/50',
		"[&_svg:not([class*='size-'])]:size-4"
	]
};

/** V-12: the indicator's per-`color` class rows. */
const INDICATOR_COLOR_CLASSES: Record<StatIndicatorColor, string[]> = {
	default: ['bg-muted', 'text-muted-foreground'],
	success: ['border-success/20', 'bg-success/10', 'text-success'],
	info: ['border-info/20', 'bg-info/10', 'text-info'],
	warning: ['border-warning/20', 'bg-warning/10', 'text-warning'],
	error: ['border-destructive/20', 'bg-destructive/10', 'text-destructive']
};

/** V-20: the trend's base utilities. */
const TREND_BASE_CLASSES = [
	'inline-flex',
	'items-center',
	'gap-1',
	'text-xs',
	'font-medium',
	"[&_svg:not([class*='size-'])]:size-3",
	'[&_svg]:pointer-events-none',
	'[&_svg]:shrink-0'
];

describe('Stat', () => {
	it('renders a div carrying data-slot="stat"', () => {
		const { container } = render(Stat.Root, { props: { children: text('content') } });
		const root = bySlot(container, 'stat');

		expect(root.tagName).toBe('DIV');
	});

	it('carries every V-01 base class and every V-02 slot-targeting rule', () => {
		const { container } = render(Stat.Root, { props: { children: text('content') } });
		const root = bySlot(container, 'stat');

		for (const className of [...ROOT_CLASSES, ...ROOT_SLOT_RULES]) {
			expect(root.classList.contains(className)).toBe(true);
		}
	});

	it("merges the caller's class last so it wins a conflict", () => {
		const { container } = render(Stat.Root, {
			props: { class: 'rounded-none', children: text('content') }
		});
		const root = bySlot(container, 'stat');

		expect(root.classList.contains('rounded-none')).toBe(true);
		expect(root.classList.contains('rounded-lg')).toBe(false);
	});
});

describe('StatLabel', () => {
	it('renders with data-slot="stat-label" and every V-03 class', () => {
		const { container } = render(Stat.Label, { props: { children: text('Total Revenue') } });
		const label = bySlot(container, 'stat-label');

		expect(label.tagName).toBe('DIV');
		for (const className of LABEL_CLASSES) {
			expect(label.classList.contains(className)).toBe(true);
		}
	});

	it('renders outside Stat.Root without throwing (C-06)', () => {
		expect(() => render(StatLabel, { props: { children: text('Total Revenue') } })).not.toThrow();
	});
});

describe('StatValue', () => {
	it('renders with data-slot="stat-value" and every V-04 class', () => {
		const { container } = render(Stat.Value, { props: { children: text('$45,231') } });
		const value = bySlot(container, 'stat-value');

		expect(value.tagName).toBe('DIV');
		for (const className of VALUE_CLASSES) {
			expect(value.classList.contains(className)).toBe(true);
		}
	});

	it('carries no truncate, whitespace-nowrap or width class (V-07, spec Edge Cases)', () => {
		const longValue =
			'$45,231,908,127,364.99 across every downstream currency conversion ledger entry recorded this quarter';
		const { container } = render(Stat.Value, { props: { children: text(longValue) } });
		const value = bySlot(container, 'stat-value');

		for (const className of ['truncate', 'whitespace-nowrap', 'w-full', 'max-w-full']) {
			expect(value.classList.contains(className)).toBe(false);
		}
	});

	it('renders outside Stat.Root without throwing (C-06)', () => {
		expect(() => render(StatValue, { props: { children: text('$45,231') } })).not.toThrow();
	});
});

describe('StatDescription', () => {
	it('renders with data-slot="stat-description" and every V-05 class', () => {
		const { container } = render(Stat.Description, {
			props: { children: text('Total revenue generated in the current billing period') }
		});
		const description = bySlot(container, 'stat-description');

		expect(description.tagName).toBe('DIV');
		for (const className of DESCRIPTION_CLASSES) {
			expect(description.classList.contains(className)).toBe(true);
		}
	});

	it('renders outside Stat.Root without throwing (C-06)', () => {
		expect(() =>
			render(StatDescription, { props: { children: text('Supplementary context') } })
		).not.toThrow();
	});
});

describe('StatIndicator', () => {
	it('falls back to data-variant="default" and data-color="default" when unset', () => {
		const { container } = render(Stat.Indicator, { props: {} });
		const indicator = bySlot(container, 'stat-indicator');

		expect(indicator).toHaveAttribute('data-variant', 'default');
		expect(indicator).toHaveAttribute('data-color', 'default');
		for (const className of [
			...INDICATOR_VARIANT_CLASSES.default,
			...INDICATOR_COLOR_CLASSES.default
		]) {
			expect(indicator.classList.contains(className)).toBe(true);
		}
	});

	for (const variant of STAT_INDICATOR_VARIANTS) {
		for (const color of STAT_INDICATOR_COLORS) {
			it(`renders variant="${variant}" color="${color}" with the matching data attributes and classes`, () => {
				const { container } = render(Stat.Indicator, { props: { variant, color } });
				const indicator = bySlot(container, 'stat-indicator');

				expect(indicator).toHaveAttribute('data-variant', variant);
				expect(indicator).toHaveAttribute('data-color', color);

				// `color` is declared after `variant` in the tv() table (V-14), so it wins any
				// conflicting `text-*` utility — `statIndicatorVariants` itself is the source of
				// truth for which classes survive that merge (V-11/V-12).
				const expectedClasses = statIndicatorVariants({ variant, color }).split(' ');
				for (const className of expectedClasses) {
					expect(indicator.classList.contains(className)).toBe(true);
				}
				for (const className of INDICATOR_BASE_CLASSES) {
					expect(indicator.classList.contains(className)).toBe(true);
				}
			});
		}
	}

	it('never renders a dark: utility or a raw palette colour (V-15, Constitution VIII)', () => {
		for (const variant of STAT_INDICATOR_VARIANTS) {
			for (const color of STAT_INDICATOR_COLORS) {
				const { container } = render(Stat.Indicator, { props: { variant, color } });
				const indicator = bySlot(container, 'stat-indicator');

				for (const className of indicator.classList) {
					expect(className.startsWith('dark:')).toBe(false);
					expect(/(^|:)(green|blue|orange|red)-/.test(className)).toBe(false);
				}
			}
		}
	});

	it('renders outside Stat.Root without throwing (C-06)', () => {
		expect(() => render(StatIndicator, { props: {} })).not.toThrow();
	});
});

describe('StatTrend', () => {
	it('has no data-trend attribute when trend is unset, and renders the neutral classes', () => {
		const { container } = render(Stat.Trend, { props: { children: text('No change') } });
		const trend = bySlot(container, 'stat-trend');

		expect(trend).not.toHaveAttribute('data-trend');
		expect(trend.classList.contains('text-muted-foreground')).toBe(true);
	});

	for (const direction of STAT_TREND_DIRECTIONS) {
		it(`renders trend="${direction}" with the matching data attribute and classes`, () => {
			const { container } = render(Stat.Trend, {
				props: { trend: direction, children: text('change') }
			});
			const trend = bySlot(container, 'stat-trend');

			expect(trend).toHaveAttribute('data-trend', direction);
			for (const className of TREND_BASE_CLASSES) {
				expect(trend.classList.contains(className)).toBe(true);
			}
		});
	}

	it('renders text-success for up and text-destructive for down', () => {
		const { container: upContainer } = render(Stat.Trend, {
			props: { trend: 'up', children: text('up') }
		});
		expect(bySlot(upContainer, 'stat-trend').classList.contains('text-success')).toBe(true);

		const { container: downContainer } = render(Stat.Trend, {
			props: { trend: 'down', children: text('down') }
		});
		expect(bySlot(downContainer, 'stat-trend').classList.contains('text-destructive')).toBe(true);
	});

	it('renders outside Stat.Root without throwing (C-06)', () => {
		expect(() => render(StatTrend, { props: { children: text('change') } })).not.toThrow();
	});
});

describe('StatSeparator', () => {
	it('carries data-slot="stat-separator" and my-2, and defaults to role="separator"', () => {
		const { container } = render(Stat.Separator, { props: {} });
		const separator = bySlot(container, 'stat-separator');

		expect(separator.classList.contains('my-2')).toBe(true);
		expect(separator).toHaveAttribute('role', 'separator');
		expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
	});

	it('renders role="none" only when decorative is passed explicitly', () => {
		const { container } = render(Stat.Separator, { props: { decorative: true } });
		const separator = bySlot(container, 'stat-separator');

		expect(separator).toHaveAttribute('role', 'none');
	});

	it("merges a caller class='my-4' with my-2 rather than erasing it (C-30)", () => {
		const { container } = render(Stat.Separator, { props: { class: 'my-4' } });
		const separator = bySlot(container, 'stat-separator');

		expect(separator.classList.contains('my-4')).toBe(true);
	});

	it('renders correctly standalone, outside Stat.Root (spec Edge Cases, C-43)', () => {
		expect(() => render(StatSeparator, { props: {} })).not.toThrow();
	});
});

describe('pass-through: ref, class, restProps (C-01…C-04, C-40)', () => {
	it('populates every part ref through bind:ref/bind:this', () => {
		const { container } = render(Harness, {
			props: {
				label: 'Total Revenue',
				value: '$45,231',
				showIndicator: true,
				showTrend: true,
				showSeparator: true,
				description: 'Total revenue generated in the current billing period'
			}
		});

		expect(container.querySelector('[data-testid="ref-report"]')).toHaveTextContent(
			'root:div label:div indicator:div value:div trend:div separator:div description:div'
		);
	});

	it('lets a caller class win the conflicting axis over the component class (C-02, FR-012)', () => {
		const { container } = render(Stat.Root, {
			props: { class: 'p-8', children: text('content') }
		});
		const root = bySlot(container, 'stat');

		expect(root.classList.contains('p-8')).toBe(true);
		expect(root.classList.contains('p-4')).toBe(false);
	});

	it('forwards id, data-testid and an onclick handler onto every part (C-04, FR-013)', async () => {
		const user = userEvent.setup();
		let clicked = 0;
		const { container } = render(Stat.Root, {
			props: {
				id: 'revenue-stat',
				'data-testid': 'stat-root',
				onclick: () => {
					clicked += 1;
				},
				children: text('content')
			}
		});
		const root = bySlot(container, 'stat');

		expect(root).toHaveAttribute('id', 'revenue-stat');
		expect(root).toHaveAttribute('data-testid', 'stat-root');

		await user.click(root);

		expect(clicked).toBe(1);
	});
});

describe('order independence (FR-002, FR-010, C-40)', () => {
	it('renders identical data-slot sets and classes regardless of the order parts are composed in', () => {
		const orderA = createRawSnippet(() => ({
			render: () =>
				`<div><div data-slot="stat-label">Total Revenue</div><div data-slot="stat-indicator">icon</div><div data-slot="stat-value">$45,231</div></div>`
		}));
		const orderB = createRawSnippet(() => ({
			render: () =>
				`<div><div data-slot="stat-value">$45,231</div><div data-slot="stat-indicator">icon</div><div data-slot="stat-label">Total Revenue</div></div>`
		}));

		const { container: firstOrder } = render(Stat.Root, { props: { children: orderA } });
		const { container: secondOrder } = render(Stat.Root, { props: { children: orderB } });

		const firstRoot = bySlot(firstOrder, 'stat');
		const secondRoot = bySlot(secondOrder, 'stat');
		// The `**:` selector targets every descendant, not just direct children, so the extra
		// wrapper `<div>` `createRawSnippet` requires does not defeat slot-based placement.
		const firstSlots = [...firstRoot.querySelectorAll('[data-slot]')]
			.map((child) => child.getAttribute('data-slot'))
			.sort();
		const secondSlots = [...secondRoot.querySelectorAll('[data-slot]')]
			.map((child) => child.getAttribute('data-slot'))
			.sort();

		// Two differently-ordered renders of the same part set carry the same slots and the same
		// container slot-selector rules — order-independence is proven by CSS, not DOM position.
		expect(firstSlots).toEqual(secondSlots);
		for (const className of [...ROOT_CLASSES, ...ROOT_SLOT_RULES]) {
			expect(firstRoot.classList.contains(className)).toBe(true);
			expect(secondRoot.classList.contains(className)).toBe(true);
		}
	});

	it('renders a minimal card with only an indicator and a value without a broken grid', () => {
		const { container } = render(Harness, {
			props: { showIndicator: true, value: '3.2%' }
		});
		const root = bySlot(container, 'stat');

		for (const className of [...ROOT_CLASSES, ...ROOT_SLOT_RULES]) {
			expect(root.classList.contains(className)).toBe(true);
		}
		expect(root.querySelector('[data-slot="stat-indicator"]')).toBeInTheDocument();
		expect(root.querySelector('[data-slot="stat-value"]')).toBeInTheDocument();
		expect(root.querySelector('[data-slot="stat-label"]')).toBeNull();
	});

	it('renders a card with only StatIndicator and StatValue without throwing (spec Edge Cases)', () => {
		expect(() => render(Harness, { props: { showIndicator: true, value: '3.2%' } })).not.toThrow();
	});
});

describe('edge cases: unknown runtime values fall back to defaults', () => {
	it('normalises an unknown indicator variant/color to default', () => {
		expect(resolveStatIndicatorVariant('bogus')).toBe('default');
		expect(resolveStatIndicatorColor('bogus')).toBe('default');
		expect(resolveStatIndicatorColor('')).toBe('default');
	});

	it('normalises an unknown trend direction to neutral', () => {
		expect(resolveStatTrendDirection('bogus')).toBe('neutral');
		expect(resolveStatTrendDirection(undefined)).toBe('neutral');
	});

	it('renders the default indicator classes when handed an unknown value at runtime', () => {
		const { container } = render(Stat.Indicator, {
			props: { variant: 'bogus' as unknown as StatIndicatorVariant }
		});
		const indicator = bySlot(container, 'stat-indicator');

		expect(indicator).toHaveAttribute('data-variant', 'default');
		expect(indicator).toHaveAttribute('data-color', 'default');
	});

	it('renders the neutral trend classes when handed an unknown value at runtime', () => {
		const { container } = render(Stat.Trend, {
			props: { trend: 'bogus' as unknown as 'up', children: text('change') }
		});
		const trend = bySlot(container, 'stat-trend');

		expect(trend.classList.contains('text-muted-foreground')).toBe(true);
	});
});

describe('RTL (FR-014, C-42)', () => {
	it('mirrors the grid natively — the container class list is unchanged under dir="rtl"', () => {
		const rtl = document.body.appendChild(document.createElement('div'));
		rtl.setAttribute('dir', 'rtl');

		const { container } = render(Harness, {
			target: rtl,
			props: { label: 'Total Revenue', value: '$45,231', showIndicator: true }
		});
		const root = bySlot(container, 'stat');

		for (const className of [...ROOT_CLASSES, ...ROOT_SLOT_RULES]) {
			expect(root.classList.contains(className)).toBe(true);
		}

		const physical = [...root.classList].filter((className) =>
			/^(ml-|mr-|left-|right-|pl-|pr-|text-left|text-right)/.test(className)
		);
		expect(physical).toEqual([]);

		expect(root.querySelector('[data-slot="stat-indicator"]')).toBeInTheDocument();
	});
});

// jsdom never lays out the anchor/content pair floating-ui measures, so bits-ui's
// `hideWhenDetached` middleware keeps the floating wrapper's `visibility: hidden` regardless of
// `data-state` — `getByRole('menu')`, which excludes inaccessible elements, therefore never
// resolves here. Content and item state are asserted directly via `data-slot`/`data-state`
// instead of role queries. The body scroll-lock's closing transition is also async, so each test
// resets it to keep later `user.click`/`user.keyboard` calls from tripping on a stale
// `pointer-events: none` left on <body> by a still-settling previous test.
function findMenuContent(): HTMLElement | null {
	return document.querySelector('[data-slot="dropdown-menu-content"]');
}

describe('action indicator composed with a menu trigger (US2 scenario 3, SC-005, SC-008, C-41)', () => {
	afterEach(() => {
		document.body.style.pointerEvents = '';
	});

	it('exposes the trigger with the documented accessible name (FR-016, SC-008)', () => {
		render(Harness, {
			props: { showIndicator: true, useActionMenu: true, triggerLabel: 'Conversion rate actions' }
		});

		expect(screen.getByRole('button', { name: /conversion rate actions/i })).toBeInTheDocument();
	});

	it('renders the indicator as content inside the trigger button (research.md R4)', () => {
		render(Harness, {
			props: { showIndicator: true, useActionMenu: true }
		});
		const trigger = screen.getByRole('button', { name: /conversion rate actions/i });

		expect(trigger.tagName).toBe('BUTTON');
		const indicator = trigger.querySelector('[data-slot="stat-indicator"]');
		expect(indicator).toBeInTheDocument();
		expect(indicator).toHaveAttribute('data-variant', 'action');
	});

	it('opens the menu on pointer click', async () => {
		const user = userEvent.setup();
		render(Harness, { props: { showIndicator: true, useActionMenu: true } });
		const trigger = screen.getByRole('button', { name: /conversion rate actions/i });

		expect(trigger).toHaveAttribute('aria-expanded', 'false');

		await user.click(trigger);

		expect(trigger).toHaveAttribute('aria-expanded', 'true');
		expect(findMenuContent()).toHaveAttribute('data-state', 'open');
	});

	it('opens the menu on Enter and on Space', async () => {
		const user = userEvent.setup();
		render(Harness, { props: { showIndicator: true, useActionMenu: true } });
		const trigger = screen.getByRole('button', { name: /conversion rate actions/i });

		trigger.focus();
		await user.keyboard('{Enter}');
		expect(findMenuContent()).toHaveAttribute('data-state', 'open');
		await user.keyboard('{Escape}');

		trigger.focus();
		await user.keyboard(' ');
		expect(findMenuContent()).toHaveAttribute('data-state', 'open');
	});

	it('closes the menu on Escape', async () => {
		const user = userEvent.setup();
		render(Harness, { props: { showIndicator: true, useActionMenu: true } });
		const trigger = screen.getByRole('button', { name: /conversion rate actions/i });

		await user.click(trigger);
		expect(findMenuContent()).toHaveAttribute('data-state', 'open');

		await user.keyboard('{Escape}');

		expect(trigger).toHaveAttribute('aria-expanded', 'false');
		expect(findMenuContent()).toBeNull();
	});

	it('moves focus to the first menu item on ArrowDown', async () => {
		const user = userEvent.setup();
		render(Harness, { props: { showIndicator: true, useActionMenu: true } });
		const trigger = screen.getByRole('button', { name: /conversion rate actions/i });

		await user.click(trigger);
		await user.keyboard('{ArrowDown}');

		// Focus-management inside the menu settles asynchronously, so poll rather than assert
		// synchronously right after the keypress.
		await vi.waitFor(() => {
			const items = document.querySelectorAll('[data-slot="dropdown-menu-item"]');
			expect(items[0]).toHaveFocus();
		});
	});
});

describe('barrel (B-01…B-18)', () => {
	it('exposes every part under both its short and its prefixed name', () => {
		expect(Stat.Root).toBe(Stat.Stat);
		expect(Stat.Label).toBe(StatLabel);
		expect(Stat.Indicator).toBe(StatIndicator);
		expect(Stat.Value).toBe(StatValue);
		expect(Stat.Trend).toBe(StatTrend);
		expect(Stat.Separator).toBe(StatSeparator);
		expect(Stat.Description).toBe(StatDescription);
		expect(Stat.Label).toBe(Stat.StatLabel);
		expect(Stat.Indicator).toBe(Stat.StatIndicator);
		expect(Stat.Value).toBe(Stat.StatValue);
		expect(Stat.Trend).toBe(Stat.StatTrend);
		expect(Stat.Separator).toBe(Stat.StatSeparator);
		expect(Stat.Description).toBe(Stat.StatDescription);
	});

	it('holds the three tuples with exactly the documented members in order', () => {
		expect(STAT_INDICATOR_VARIANTS).toEqual(['default', 'icon', 'badge', 'action']);
		expect(STAT_INDICATOR_COLORS).toEqual(['default', 'success', 'info', 'warning', 'error']);
		expect(STAT_TREND_DIRECTIONS).toEqual(['up', 'down', 'neutral']);
	});

	it('exports statIndicatorVariants and statTrendVariants as callable functions returning the default rows', () => {
		const indicatorClasses = statIndicatorVariants().split(' ');
		for (const className of [
			...INDICATOR_BASE_CLASSES,
			...INDICATOR_VARIANT_CLASSES.default,
			...INDICATOR_COLOR_CLASSES.default
		]) {
			expect(indicatorClasses).toContain(className);
		}

		const trendClasses = statTrendVariants().split(' ');
		for (const className of [...TREND_BASE_CLASSES, 'text-muted-foreground']) {
			expect(trendClasses).toContain(className);
		}
	});
});
