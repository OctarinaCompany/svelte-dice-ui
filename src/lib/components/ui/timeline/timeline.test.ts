import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';

import * as Timeline from './index.js';
import {
	getTimelineItemStatus,
	sortByDocumentPosition,
	TIMELINE_ORIENTATIONS,
	TIMELINE_STATUSES,
	TIMELINE_VARIANTS
} from './index.js';
import Harness, { type TimelineHarnessItem } from './timeline.test.svelte';

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

const items3: TimelineHarnessItem[] = [
	{
		id: 'a',
		title: 'Alpha',
		description: 'Alpha desc',
		date: 'January 1, 2025',
		dateTime: '2025-01-01'
	},
	{
		id: 'b',
		title: 'Beta',
		description: 'Beta desc',
		date: 'February 1, 2025',
		dateTime: '2025-02-01'
	},
	{
		id: 'c',
		title: 'Gamma',
		description: 'Gamma desc',
		date: 'March 1, 2025',
		dateTime: '2025-03-01'
	}
];

const items4: TimelineHarnessItem[] = [
	...items3,
	{
		id: 'd',
		title: 'Delta',
		description: 'Delta desc',
		date: 'April 1, 2025',
		dateTime: '2025-04-01'
	}
];

describe('Timeline roles and ARIA (T-01, T-02, T-03, T-04)', () => {
	it('renders the root as role="list" carrying data-orientation and no aria-orientation, and items as role="listitem" in source order (T-01)', () => {
		const { container } = render(Harness, { props: { items: items3, orientation: 'horizontal' } });

		const root = screen.getByRole('list');
		expect(root).toHaveAttribute('data-orientation', 'horizontal');
		expect(root).not.toHaveAttribute('aria-orientation');

		const listItems = screen.getAllByRole('listitem');
		expect(listItems).toHaveLength(3);
		expect(listItems.map((el) => el.id)).toEqual(['a', 'b', 'c']);
		void container;
	});

	it('marks only the item at activeIndex with aria-current="step", and none when unset (T-02)', async () => {
		const { container, rerender } = render(Harness, { props: { items: items3, activeIndex: 1 } });

		const listItems = screen.getAllByRole('listitem');
		expect(listItems[0]).not.toHaveAttribute('aria-current');
		expect(listItems[1]).toHaveAttribute('aria-current', 'step');
		expect(listItems[2]).not.toHaveAttribute('aria-current');

		await rerender({ items: items3, activeIndex: undefined });
		for (const item of screen.getAllByRole('listitem')) {
			expect(item).not.toHaveAttribute('aria-current');
		}
		void container;
	});

	it('marks connectors aria-hidden and excludes them from the accessibility tree (T-03)', () => {
		const { container } = render(Harness, { props: { items: items3 } });

		const connectors = allBySlot(container, 'timeline-connector');
		expect(connectors).toHaveLength(2);
		for (const connector of connectors) {
			expect(connector).toHaveAttribute('aria-hidden', 'true');
			expect(connector).not.toHaveAttribute('role');
		}
	});

	it('renders Title/Description/Time text reachable, with <time> datetime distinct from its text (T-04)', () => {
		const { container } = render(Harness, { props: { items: items3 } });

		expect(screen.getByText('Alpha')).toBeInTheDocument();
		expect(screen.getByText('Alpha desc')).toBeInTheDocument();
		const time = container.querySelector('time');
		expect(time).not.toBeNull();
		expect(time).toHaveAttribute('datetime', '2025-01-01');
		expect(time?.textContent).toBe('January 1, 2025');
	});
});

describe('Timeline uncontrolled/controlled activeIndex (T-05, T-06, T-07)', () => {
	it('defaults every item to "pending" with no activeIndex, unaffected by interaction (T-05)', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: { items: items3 } });

		const listItems = screen.getAllByRole('listitem');
		for (const item of listItems) {
			expect(item).toHaveAttribute('data-status', 'pending');
		}

		await user.click(listItems[1]);
		for (const item of screen.getAllByRole('listitem')) {
			expect(item).toHaveAttribute('data-status', 'pending');
		}
		void container;
	});

	it('derives completed/active/pending from activeIndex and recomputes on rerender (T-06)', async () => {
		const { rerender } = render(Harness, { props: { items: items4, activeIndex: 2 } });

		expect(screen.getAllByRole('listitem').map((el) => el.dataset.status)).toEqual([
			'completed',
			'completed',
			'active',
			'pending'
		]);

		await rerender({ items: items4, activeIndex: 0 });

		expect(screen.getAllByRole('listitem').map((el) => el.dataset.status)).toEqual([
			'active',
			'pending',
			'pending',
			'pending'
		]);
	});

	it('yields a valid status for an out-of-range activeIndex (T-07)', () => {
		const { rerender } = render(Harness, { props: { items: items4, activeIndex: -1 } });
		expect(screen.getAllByRole('listitem').every((el) => el.dataset.status === 'pending')).toBe(
			true
		);

		return rerender({ items: items4, activeIndex: 9 }).then(() => {
			expect(screen.getAllByRole('listitem').every((el) => el.dataset.status === 'completed')).toBe(
				true
			);
		});
	});
});

describe('Timeline connectors (T-08, T-09)', () => {
	it('renders one connector fewer than the item count, none after the last, unless forceMount (T-08)', () => {
		const { container, unmount } = render(Harness, { props: { items: items3 } });
		expect(allBySlot(container, 'timeline-connector')).toHaveLength(2);
		unmount();

		const forced = render(Harness, { props: { items: items3, connectorForceMount: true } });
		expect(allBySlot(forced.container, 'timeline-connector')).toHaveLength(3);
	});

	it("marks data-completed on a connector iff the next item is completed/active, and data-status is the owning item's (T-09)", () => {
		const { container } = render(Harness, { props: { items: items3, activeIndex: 1 } });

		const connectors = allBySlot(container, 'timeline-connector');
		// item 0 (completed) -> connector to item 1 (active): completed
		expect(connectors[0]).toHaveAttribute('data-completed', '');
		expect(connectors[0]).toHaveAttribute('data-status', 'completed');
		// item 1 (active) -> connector to item 2 (pending): not completed
		expect(connectors[1]).not.toHaveAttribute('data-completed');
		expect(connectors[1]).toHaveAttribute('data-status', 'active');
	});
});

describe('Timeline live DOM order (T-10)', () => {
	it('recomputes every data-status and connector count after inserting then removing items', async () => {
		const { rerender, container } = render(Harness, { props: { items: items3, activeIndex: 1 } });
		expect(allBySlot(container, 'timeline-connector')).toHaveLength(2);

		await rerender({ items: items4, activeIndex: 1 });
		expect(allBySlot(container, 'timeline-connector')).toHaveLength(3);
		expect(screen.getAllByRole('listitem').map((el) => el.dataset.status)).toEqual([
			'completed',
			'active',
			'pending',
			'pending'
		]);

		const withoutSecond = [items4[0], items4[2], items4[3]];
		await rerender({ items: withoutSecond, activeIndex: 1 });
		expect(allBySlot(container, 'timeline-connector')).toHaveLength(2);
		expect(screen.getAllByRole('listitem').map((el) => el.id)).toEqual(['a', 'c', 'd']);
		expect(screen.getAllByRole('listitem').map((el) => el.dataset.status)).toEqual([
			'completed',
			'active',
			'pending'
		]);
	});
});

describe('Timeline orientation, variant, RTL (T-11, T-12, T-13)', () => {
	it('sets data-orientation/data-variant on the root, and data-alternate-right on odd items only under alternate (T-11)', () => {
		for (const orientation of TIMELINE_ORIENTATIONS) {
			for (const variant of TIMELINE_VARIANTS) {
				const { container, unmount } = render(Harness, {
					props: { items: items3, orientation, variant }
				});

				const root = screen.getByRole('list');
				expect(root).toHaveAttribute('data-orientation', orientation);
				expect(root).toHaveAttribute('data-variant', variant);

				const listItems = screen.getAllByRole('listitem');
				for (const [index, item] of listItems.entries()) {
					expect(item).toHaveAttribute('data-orientation', orientation);
					if (variant === 'alternate' && index % 2 === 1) {
						expect(item).toHaveAttribute('data-alternate-right', '');
					} else {
						expect(item).not.toHaveAttribute('data-alternate-right');
					}
				}
				unmount();
				void container;
			}
		}
	});

	it('resolves dir from an explicit prop, a wrapping DirectionProvider, and prefers the explicit prop (T-12)', () => {
		const explicit = render(Harness, { props: { items: items3, dir: 'rtl' } });
		expect(screen.getByRole('list')).toHaveAttribute('dir', 'rtl');
		for (const item of screen.getAllByRole('listitem')) {
			expect(item).toHaveAttribute('dir', 'rtl');
		}
		explicit.unmount();

		const provided = render(Harness, { props: { items: items3, wrapInRtlProvider: true } });
		expect(screen.getByRole('list')).toHaveAttribute('dir', 'rtl');
		provided.unmount();

		render(Harness, {
			props: { items: items3, dir: 'ltr', wrapInRtlProvider: true }
		});
		expect(screen.getByRole('list')).toHaveAttribute('dir', 'ltr');
	});

	it('uses only logical utility classes in the alternate variant, no physical equivalents (T-13)', () => {
		const { container } = render(Harness, {
			props: { items: items3, variant: 'alternate', orientation: 'vertical' }
		});

		const classNames = [
			bySlot(container, 'timeline-item').className,
			bySlot(container, 'timeline-dot').className,
			bySlot(container, 'timeline-connector').className,
			bySlot(container, 'timeline-content').className
		].join(' ');

		expect(classNames).toMatch(/(ms-auto|pe-6|ps-6|-start-|-end-)/);
		expect(classNames).not.toMatch(/ml-auto|pr-6|pl-6|text-right|-left-\[|-right-\[/);
	});
});

describe('Timeline guard rails (T-14, T-15)', () => {
	it('throws /must be used within/ when Item/Dot/Connector/Content render with no ancestor', () => {
		expect(() => render(Harness, { props: { mode: 'bare-item' } })).toThrow(/must be used within/);
		expect(() => render(Harness, { props: { mode: 'bare-dot' } })).toThrow(/must be used within/);
		expect(() => render(Harness, { props: { mode: 'bare-connector' } })).toThrow(
			/must be used within/
		);
		expect(() => render(Harness, { props: { mode: 'bare-content' } })).toThrow(
			/must be used within/
		);
	});

	it('throws /must be used within/ when Dot/Connector/Content render inside Root but outside Item', () => {
		expect(() => render(Harness, { props: { mode: 'itemless-dot' } })).toThrow(
			/must be used within/
		);
		expect(() => render(Harness, { props: { mode: 'itemless-connector' } })).toThrow(
			/must be used within/
		);
		expect(() => render(Harness, { props: { mode: 'itemless-content' } })).toThrow(
			/must be used within/
		);
	});

	it('renders Header/Title/Description/Time standalone without throwing (T-15)', () => {
		const label = createRawSnippet(() => ({ render: () => `<span>hi</span>` }));
		expect(() => render(Timeline.Header, { props: { children: label } })).not.toThrow();
		expect(() => render(Timeline.Title, { props: { children: label } })).not.toThrow();
		expect(() => render(Timeline.Description, { props: { children: label } })).not.toThrow();
		expect(() => render(Timeline.Time, { props: { children: label } })).not.toThrow();
	});
});

describe('Timeline keyboard inertness (T-16)', () => {
	it('changes no data-status, aria-current or connector count on any key press', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: { items: items3, activeIndex: 1 } });

		const before = screen.getAllByRole('listitem').map((el) => ({
			status: el.dataset.status,
			current: el.getAttribute('aria-current')
		}));
		const connectorCountBefore = allBySlot(container, 'timeline-connector').length;

		await user.click(container);
		for (const key of [
			'{ArrowLeft}',
			'{ArrowRight}',
			'{ArrowUp}',
			'{ArrowDown}',
			'{Home}',
			'{End}',
			'{Enter}',
			'{Escape}',
			'{Tab}'
		]) {
			await user.keyboard(key);
		}

		const after = screen.getAllByRole('listitem').map((el) => ({
			status: el.dataset.status,
			current: el.getAttribute('aria-current')
		}));
		expect(after).toEqual(before);
		expect(allBySlot(container, 'timeline-connector')).toHaveLength(connectorCountBefore);
	});
});

describe('Timeline styling, composition and barrel (T-17 to T-23)', () => {
	it('carries data-slot on every part and lets a caller class survive and win (T-17)', () => {
		const { container } = render(Harness, {
			props: {
				items: items3,
				class: 'root-extra',
				itemClass: 'item-extra',
				dotClass: 'dot-extra',
				connectorClass: 'connector-extra',
				contentClass: 'content-extra'
			}
		});

		expect(bySlot(container, 'timeline').classList.contains('root-extra')).toBe(true);
		expect(bySlot(container, 'timeline-item').classList.contains('item-extra')).toBe(true);
		expect(bySlot(container, 'timeline-dot').classList.contains('dot-extra')).toBe(true);
		expect(bySlot(container, 'timeline-connector').classList.contains('connector-extra')).toBe(
			true
		);
		expect(bySlot(container, 'timeline-content').classList.contains('content-extra')).toBe(true);
		expect(bySlot(container, 'timeline-header')).toBeInTheDocument();
		expect(bySlot(container, 'timeline-title')).toBeInTheDocument();
		expect(bySlot(container, 'timeline-description')).toBeInTheDocument();
		expect(bySlot(container, 'timeline-time')).toBeInTheDocument();
	});

	it('carries both CSS-variable declarations on the root, surviving a caller override (T-18)', () => {
		const { container } = render(Harness, {
			props: { items: items3, class: '[--timeline-dot-size:2rem]' }
		});

		const root = bySlot(container, 'timeline');
		expect(root.className).toMatch(/--timeline-dot-size/);
		expect(root.className).toMatch(/--timeline-connector-thickness/);
		expect(root.className).toContain('[--timeline-dot-size:2rem]');
	});

	it('gives the child snippet the merged props with ref null, and lets a child-rendered item still register (T-19)', () => {
		const rootChildRender = render(Harness, { props: { items: items3, mode: 'root-child' } });
		const rootChild = byTestId(rootChildRender.container, 'root-child');
		expect(rootChild).toHaveAttribute('data-slot', 'timeline');
		rootChildRender.unmount();

		const dotChildRender = render(Harness, { props: { items: items3, mode: 'dot-child' } });
		expect(byTestId(dotChildRender.container, 'dot-child')).toHaveAttribute(
			'data-slot',
			'timeline-dot'
		);
		dotChildRender.unmount();

		const connectorChildRender = render(Harness, {
			props: { items: items3, mode: 'connector-child' }
		});
		expect(byTestId(connectorChildRender.container, 'connector-child')).toHaveAttribute(
			'data-slot',
			'timeline-connector'
		);
		connectorChildRender.unmount();

		const contentChildRender = render(Harness, { props: { items: items3, mode: 'content-child' } });
		expect(byTestId(contentChildRender.container, 'content-child')).toHaveAttribute(
			'data-slot',
			'timeline-content'
		);
		contentChildRender.unmount();

		const itemChildRender = render(Harness, {
			props: { items: items3, mode: 'item-child', activeIndex: 1 }
		});
		const itemChild = byTestId(itemChildRender.container, 'item-child-b');
		expect(itemChild).toHaveAttribute('data-slot', 'timeline-item');
		// Item "b" (activeIndex 1, "active") is registered only through the child snippet's
		// `register` hook; its predecessor's ("a") connector still derives `data-completed` from it.
		const connectors = allBySlot(itemChildRender.container, 'timeline-connector');
		expect(connectors[0]).toHaveAttribute('data-completed', '');
	});

	it('binds ref to the <ol>/<li>/<div>/<time> node for each part (T-20)', () => {
		const { container } = render(Harness, { props: { items: items3 } });
		expect(bySlot(container, 'timeline').tagName).toBe('OL');
		expect(bySlot(container, 'timeline-item').tagName).toBe('LI');
		expect(bySlot(container, 'timeline-dot').tagName).toBe('DIV');
		expect(bySlot(container, 'timeline-content').tagName).toBe('DIV');
		expect(container.querySelector('time')?.tagName).toBe('TIME');
	});

	it('reaches arbitrary restProps (id, aria-label, data-testid) on the root (T-21)', () => {
		const { container } = render(Harness, {
			props: { items: items3, id: 'my-timeline', 'data-testid': 'timeline-root' }
		});

		const root = byTestId(container, 'timeline-root');
		expect(root).toHaveAttribute('id', 'my-timeline');
	});

	it('exposes all nine short names and Timeline* aliases from a namespace import (T-22)', () => {
		expect(Timeline.Root).toBeDefined();
		expect(Timeline.Item).toBeDefined();
		expect(Timeline.Dot).toBeDefined();
		expect(Timeline.Connector).toBeDefined();
		expect(Timeline.Content).toBeDefined();
		expect(Timeline.Header).toBeDefined();
		expect(Timeline.Title).toBeDefined();
		expect(Timeline.Description).toBeDefined();
		expect(Timeline.Time).toBeDefined();

		expect(Timeline.Timeline).toBe(Timeline.Root);
		expect(Timeline.TimelineItem).toBe(Timeline.Item);
		expect(Timeline.TimelineDot).toBe(Timeline.Dot);
		expect(Timeline.TimelineConnector).toBe(Timeline.Connector);
		expect(Timeline.TimelineContent).toBe(Timeline.Content);
		expect(Timeline.TimelineHeader).toBe(Timeline.Header);
		expect(Timeline.TimelineTitle).toBe(Timeline.Title);
		expect(Timeline.TimelineDescription).toBe(Timeline.Description);
		expect(Timeline.TimelineTime).toBe(Timeline.Time);
	});

	it('matches the documented truth table for getTimelineItemStatus and sortByDocumentPosition (T-23)', () => {
		expect(getTimelineItemStatus(0, undefined)).toBe('pending');
		expect(getTimelineItemStatus(0, 1)).toBe('completed');
		expect(getTimelineItemStatus(1, 1)).toBe('active');
		expect(getTimelineItemStatus(2, 1)).toBe('pending');
		for (const status of TIMELINE_STATUSES) {
			expect(TIMELINE_STATUSES.includes(status)).toBe(true);
		}

		const a = document.createElement('div');
		const b = document.createElement('div');
		document.body.append(a, b);
		expect(sortByDocumentPosition([{ element: b }, { element: a }])).toEqual([
			{ element: a },
			{ element: b }
		]);
		expect(sortByDocumentPosition([{ element: null }, { element: a }])[0]).toEqual({
			element: null
		});
		a.remove();
		b.remove();
	});
});

describe('Timeline teardown and edge cases (T-24, T-25)', () => {
	it('removes an unmounted item from the collection, and unmounting the root throws nothing', async () => {
		const { rerender, unmount, container } = render(Harness, {
			props: { items: items3, activeIndex: 1 }
		});
		expect(screen.getAllByRole('listitem')).toHaveLength(3);

		await rerender({ items: [items3[0], items3[2]], activeIndex: 1 });
		expect(screen.getAllByRole('listitem').map((el) => el.id)).toEqual(['a', 'c']);
		expect(screen.getAllByRole('listitem')[1]).toHaveAttribute('data-status', 'active');

		expect(() => unmount()).not.toThrow();
		void container;
	});

	it('renders an empty list with no items, and a single item with no connector (T-25)', () => {
		const empty = render(Harness, { props: { items: [] } });
		expect(within(empty.container).queryAllByRole('listitem')).toHaveLength(0);
		expect(empty.container.querySelector('ol')).not.toBeNull();
		empty.unmount();

		const single = render(Harness, { props: { items: [items3[0]] } });
		expect(within(single.container).getAllByRole('listitem')).toHaveLength(1);
		expect(allBySlot(single.container, 'timeline-connector')).toHaveLength(0);
	});
});
