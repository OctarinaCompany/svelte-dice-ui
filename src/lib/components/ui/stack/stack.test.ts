import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { STACK_SIDES } from './index.js';
import Harness, { type StackHarnessProps, type StackHarnessRefs } from './stack.test.svelte';

// ---------------------------------------------------------------------------
// Helpers
//
// Stack carries no ARIA role — it is a presentational cascade and upstream assigns none (research
// R-11) — so elements are located by `data-slot`, exactly as the upstream selectors do.
// ---------------------------------------------------------------------------

function bySlot(container: HTMLElement, slot: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function allBySlot(container: HTMLElement, slot: string): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`));
}

function rootOf(container: HTMLElement): HTMLElement {
	return bySlot(container, 'stack');
}

function wrappersOf(container: HTMLElement): HTMLElement[] {
	return allBySlot(container, 'stack-item-wrapper');
}

function cardsOf(container: HTMLElement): HTMLElement[] {
	return allBySlot(container, 'stack-item');
}

function styleOf(element: HTMLElement): string {
	return element.getAttribute('style') ?? '';
}

/** Read one declaration straight off the `style` attribute, so the raw string is what is asserted. */
function decl(element: HTMLElement, name: string): string {
	const match = new RegExp(`(?:^|;)\\s*${name}:\\s*([^;]+);`).exec(styleOf(element));
	if (!match) throw new Error(`${name} is not declared in style="${styleOf(element)}"`);
	return match[1].trim();
}

const ITEMS_5 = ['one', 'two', 'three', 'four', 'five'];
const ITEMS_3 = ['one', 'two', 'three'];
const ITEMS_2 = ['one', 'two'];

/** The default `gap` / `scale` / `offset` from `types/radix/stack.ts`. */
const GAP = 8;
const SCALE = 0.05;
const OFFSET = 10;

/**
 * jsdom performs no layout, so every `getBoundingClientRect()` is all-zero and therefore every
 * measured natural size is `0`. The expanded translation reduces to `index * gap` (quickstart
 * "jsdom caveat"); this is asserted rather than stubbed.
 */
function expandedTranslate(index: number, gap = GAP): string {
	return `${index * gap}px`;
}

function renderStack(props: StackHarnessProps) {
	return render(Harness, { props });
}

// ---------------------------------------------------------------------------
// Roles, names and the provider guard rail (T004 — US1, quickstart 12 & 14)
// ---------------------------------------------------------------------------

describe('Stack roles and names (T004)', () => {
	it('keeps a button inside a collapsed, non-front item queryable by role', () => {
		renderStack({ items: ITEMS_5, expandOnHover: true, withButton: true });

		// Item 4 is past `itemCount` and therefore `data-visible="false"`, but visibility is expressed
		// with `opacity` and `pointer-events`, never `display:none` or `aria-hidden` (research R-11).
		expect(screen.getByRole('button', { name: 'Action five' })).toBeInTheDocument();
	});

	it('never hides an invisible item from assistive technology', () => {
		const { container } = renderStack({ items: ITEMS_5, expandOnHover: true, withButton: true });

		const wrapper = wrappersOf(container)[4];
		expect(wrapper).toHaveAttribute('data-visible', 'false');
		expect(wrapper).not.toHaveAttribute('aria-hidden');
		expect(wrapper).not.toHaveAttribute('hidden');
		expect(wrapper.className).not.toContain('hidden');
	});

	it('assigns no ARIA role to the root, the wrapper or the card', () => {
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true });

		expect(rootOf(container)).not.toHaveAttribute('role');
		expect(wrappersOf(container)[0]).not.toHaveAttribute('role');
		expect(cardsOf(container)[0]).not.toHaveAttribute('role');
	});

	it('throws when `<Stack.Item>` is rendered without a `<Stack.Root>` ancestor', () => {
		expect(() => renderStack({ mode: 'bare-item' })).toThrow(
			/`<Stack\.Item>` must be used within `<Stack\.Root>`/
		);
	});
});

// ---------------------------------------------------------------------------
// Pointer-driven interaction and tab reachability (T005 — US1, quickstart 1-3 & 14)
// ---------------------------------------------------------------------------

describe('Stack interaction (T005)', () => {
	it('lets the keyboard reach a button inside a collapsed, non-front item', async () => {
		const user = userEvent.setup();
		renderStack({ items: ITEMS_3, expandOnHover: true, withButton: true });

		await user.tab();
		await user.tab();
		await user.tab();

		expect(screen.getByRole('button', { name: 'Action three' })).toHaveFocus();
	});

	it('expands on hover when `expandOnHover` is set', async () => {
		const user = userEvent.setup();
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true });

		expect(rootOf(container)).toHaveAttribute('data-state', 'collapsed');

		await user.hover(rootOf(container));

		expect(rootOf(container)).toHaveAttribute('data-state', 'expanded');
	});

	it('collapses again when the pointer leaves', async () => {
		const user = userEvent.setup();
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true });

		await user.hover(rootOf(container));
		await user.unhover(rootOf(container));

		expect(rootOf(container)).toHaveAttribute('data-state', 'collapsed');
	});
});

// ---------------------------------------------------------------------------
// The expansion state machine and its rendered geometry (T006 — US1/US2, quickstart 1-5, 15)
//
// Stack has no `value`/`defaultValue`/`onValueChange`/`disabled` upstream, so the
// controlled-vs-uncontrolled test area is satisfied by its nearest equivalents: the internal state
// machine, and `expandOnHover={false}` as the "the component must not move on its own" case
// (plan.md, Note on Principle III).
// ---------------------------------------------------------------------------

describe('Stack collapsed geometry (T006)', () => {
	it('lays every item out from the documented collapsed formulas', () => {
		const { container } = renderStack({ items: ITEMS_5, expandOnHover: true });

		expect(rootOf(container)).toHaveAttribute('data-state', 'collapsed');
		expect(rootOf(container)).toHaveAttribute('data-expanded', 'false');

		const wrappers = wrappersOf(container);
		expect(wrappers).toHaveLength(5);

		wrappers.forEach((wrapper, index) => {
			expect(wrapper).toHaveAttribute('data-index', String(index));
			expect(wrapper).toHaveAttribute('data-front', index === 0 ? 'true' : 'false');
			expect(wrapper).toHaveAttribute('data-expanded', 'false');
			expect(decl(wrapper, '--translate')).toBe(`${index * OFFSET}px`);
			expect(decl(wrapper, '--item-scale')).toBe(String(1 - index * SCALE));
			expect(decl(wrapper, 'z-index')).toBe(String(ITEMS_5.length - index));
		});
	});

	it('dims and disables every item past `itemCount` while collapsed', () => {
		const { container } = renderStack({ items: ITEMS_5, expandOnHover: true });

		const wrappers = wrappersOf(container);

		for (const index of [0, 1, 2]) {
			expect(wrappers[index]).toHaveAttribute('data-visible', 'true');
			expect(decl(wrappers[index], 'opacity')).toBe(String(1 - index * 0.15));
			expect(wrappers[index].className).not.toContain('pointer-events-none');
		}

		for (const index of [3, 4]) {
			expect(wrappers[index]).toHaveAttribute('data-visible', 'false');
			expect(decl(wrappers[index], 'opacity')).toBe('0');
			expect(wrappers[index]).toHaveClass('pointer-events-none');
		}
	});

	it('marks the front card and the cards behind it', () => {
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true });

		const cards = cardsOf(container);
		expect(cards[0]).toHaveAttribute('data-position', 'front');
		expect(cards[0]).toHaveAttribute('data-state', 'collapsed');
		expect(cards[1]).toHaveAttribute('data-position', 'back');
		expect(cards[2]).toHaveAttribute('data-position', 'back');
	});
});

describe('Stack expansion (T006)', () => {
	it('fans every item out on hover', async () => {
		const user = userEvent.setup();
		const { container } = renderStack({ items: ITEMS_5, expandOnHover: true });

		await user.hover(rootOf(container));

		expect(rootOf(container)).toHaveAttribute('data-state', 'expanded');
		expect(rootOf(container)).toHaveAttribute('data-expanded', 'true');

		wrappersOf(container).forEach((wrapper, index) => {
			expect(wrapper).toHaveAttribute('data-expanded', 'true');
			expect(wrapper).toHaveAttribute('data-visible', 'true');
			expect(decl(wrapper, '--item-scale')).toBe('1');
			expect(decl(wrapper, '--translate')).toBe(expandedTranslate(index));
			expect(decl(wrapper, 'opacity')).toBe('1');
		});

		for (const card of cardsOf(container)) {
			expect(card).toHaveAttribute('data-state', 'expanded');
		}
	});

	it('restores the collapsed geometry when the pointer leaves', async () => {
		const user = userEvent.setup();
		const { container } = renderStack({ items: ITEMS_5, expandOnHover: true });

		await user.hover(rootOf(container));
		await user.unhover(rootOf(container));

		expect(rootOf(container)).toHaveAttribute('data-expanded', 'false');

		wrappersOf(container).forEach((wrapper, index) => {
			expect(wrapper).toHaveAttribute('data-expanded', 'false');
			expect(decl(wrapper, '--translate')).toBe(`${index * OFFSET}px`);
			expect(decl(wrapper, '--item-scale')).toBe(String(1 - index * SCALE));
		});
	});

	it('defers the collapse while a pointer is held down, and releases it on a document pointerup', async () => {
		const user = userEvent.setup();
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true });

		await user.hover(rootOf(container));
		await fireEvent.pointerDown(rootOf(container));
		await user.unhover(rootOf(container));

		expect(rootOf(container)).toHaveAttribute('data-state', 'expanded');

		// Deliberately dispatched on `document`, not on the root: upstream only listens on the root, so
		// releasing outside the stack strands `isInteracting` at `true` and the stack can never
		// collapse again. The document-level listener is divergence D-04 (research R-06), and only a
		// pointerup that never reaches the root can prove it exists.
		await fireEvent.pointerUp(document);

		await user.hover(rootOf(container));
		await user.unhover(rootOf(container));

		expect(rootOf(container)).toHaveAttribute('data-state', 'collapsed');
	});

	it('never moves when `expandOnHover` is omitted', async () => {
		const user = userEvent.setup();
		const { container } = renderStack({ items: ITEMS_3 });

		await user.hover(rootOf(container));
		expect(rootOf(container)).toHaveAttribute('data-state', 'collapsed');

		await user.pointer({ target: rootOf(container), coords: { clientX: 4, clientY: 4 } });
		expect(rootOf(container)).toHaveAttribute('data-state', 'collapsed');

		await user.unhover(rootOf(container));
		expect(rootOf(container)).toHaveAttribute('data-state', 'collapsed');
		expect(rootOf(container)).toHaveAttribute('data-expanded', 'false');
	});

	it('never moves when `expandOnHover` is explicitly false', async () => {
		const user = userEvent.setup();
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: false });

		await user.hover(rootOf(container));

		expect(rootOf(container)).toHaveAttribute('data-state', 'collapsed');
		expect(decl(wrappersOf(container)[1], '--translate')).toBe(`${OFFSET}px`);
	});

	it('runs a caller `onmouseenter` first and skips its own expansion when it prevents the default', async () => {
		const onmouseenter = vi.fn((event: MouseEvent) => event.preventDefault());
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true, onmouseenter });

		// `userEvent.hover` dispatches a non-cancelable `mouseenter`, on which `preventDefault()` is a
		// no-op by specification, so the composition contract can only be exercised with an explicitly
		// cancelable event.
		await fireEvent.mouseEnter(rootOf(container), { cancelable: true });

		expect(onmouseenter).toHaveBeenCalledTimes(1);
		expect(rootOf(container)).toHaveAttribute('data-state', 'collapsed');
	});

	it('runs a caller `onmouseenter` and then expands when it does not prevent the default', async () => {
		const onmouseenter = vi.fn();
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true, onmouseenter });

		await fireEvent.mouseEnter(rootOf(container), { cancelable: true });

		expect(onmouseenter).toHaveBeenCalledTimes(1);
		expect(rootOf(container)).toHaveAttribute('data-state', 'expanded');
	});
});

// ---------------------------------------------------------------------------
// The five composed event handlers (T018/T019 — FR-008, FR-013,
// contracts/public-api.md §"Composed event handlers")
//
// `<Stack.Root>` runs the caller's handler first and only then its own logic, unless the caller
// called `preventDefault()`. Each case below proves both halves at once: the handler records the
// `data-state` it observes *while it runs* (still the pre-change value, so it ran first), and the
// assertion after dispatch shows the stack's own behaviour was suppressed.
//
// `mouseenter`, `mouseleave`, `pointerenter` and `pointerleave` are non-cancelable by specification,
// so `preventDefault()` on them is a no-op and the contract can only be exercised through an
// explicitly cancelable event — hence `fireEvent` with `cancelable: true` rather than `userEvent`.
// ---------------------------------------------------------------------------

/** Records the `data-state` visible at handler time, then optionally cancels the event. */
function observer(observed: (string | null)[], prevent: boolean) {
	return (event: Event & { currentTarget: HTMLElement }) => {
		observed.push(event.currentTarget.getAttribute('data-state'));
		if (prevent) event.preventDefault();
	};
}

describe('Stack composed handlers (T018, T019)', () => {
	it('expands on `mousemove` when `expandOnHover` is set', async () => {
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true });

		const root = rootOf(container);
		expect(root).toHaveAttribute('data-state', 'collapsed');

		await fireEvent.mouseMove(root, { cancelable: true });

		expect(root).toHaveAttribute('data-state', 'expanded');
		expect(root).toHaveAttribute('data-expanded', 'true');
	});

	it('runs a caller `onmousemove` first and skips its own expansion when it prevents the default', async () => {
		const observed: (string | null)[] = [];
		const onmousemove = vi.fn(observer(observed, true));
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true, onmousemove });

		await fireEvent.mouseMove(rootOf(container), { cancelable: true });

		expect(onmousemove).toHaveBeenCalledTimes(1);
		expect(observed).toEqual(['collapsed']);
		expect(rootOf(container)).toHaveAttribute('data-state', 'collapsed');
	});

	it('runs a caller `onmouseleave` first and skips its own collapse when it prevents the default', async () => {
		const user = userEvent.setup();
		const observed: (string | null)[] = [];
		const onmouseleave = vi.fn(observer(observed, true));
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true, onmouseleave });

		const root = rootOf(container);
		await user.hover(root);
		expect(root).toHaveAttribute('data-state', 'expanded');

		await fireEvent.mouseLeave(root, { cancelable: true });

		expect(onmouseleave).toHaveBeenCalledTimes(1);
		expect(observed).toEqual(['expanded']);
		expect(root).toHaveAttribute('data-state', 'expanded');
	});

	it('runs a caller `onpointerdown` first and never opens the press when it prevents the default', async () => {
		const user = userEvent.setup();
		const observed: (string | null)[] = [];
		const onpointerdown = vi.fn(observer(observed, true));
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true, onpointerdown });

		const root = rootOf(container);
		await user.hover(root);
		await fireEvent.pointerDown(root, { cancelable: true });

		expect(onpointerdown).toHaveBeenCalledTimes(1);
		expect(observed).toEqual(['expanded']);

		// The mirror of the deferral case: no press was opened, so the collapse is not held back.
		await user.unhover(root);
		expect(root).toHaveAttribute('data-state', 'collapsed');
	});

	it('runs a caller `onpointerup` first and holds the press open when it prevents the default', async () => {
		const user = userEvent.setup();
		const observed: (string | null)[] = [];
		const onpointerup = vi.fn(observer(observed, true));
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true, onpointerup });

		const root = rootOf(container);
		await user.hover(root);
		await fireEvent.pointerDown(root, { cancelable: true });
		// The release also reaches the document-level fallback (divergence D-04) as it bubbles, so this
		// additionally pins down that the fallback honours the caller's `preventDefault()` rather than
		// overruling the handler it just travelled through.
		await fireEvent.pointerUp(root, { cancelable: true });

		expect(onpointerup).toHaveBeenCalledTimes(1);
		expect(observed).toEqual(['expanded']);

		await user.unhover(root);
		expect(root).toHaveAttribute('data-state', 'expanded');

		// Control: the identical sequence with a handler that lets the default through does end the
		// press, so it is the `preventDefault()` and nothing else that kept the stack open above.
		const control = renderStack({
			items: ITEMS_3,
			expandOnHover: true,
			onpointerup: vi.fn(observer([], false))
		});
		const controlRoot = rootOf(control.container);
		await user.hover(controlRoot);
		await fireEvent.pointerDown(controlRoot, { cancelable: true });
		await fireEvent.pointerUp(controlRoot, { cancelable: true });
		await user.unhover(controlRoot);

		expect(controlRoot).toHaveAttribute('data-state', 'collapsed');
	});
});

describe('Stack custom properties (T006)', () => {
	it('publishes `--gap`, `--offset` and `--scale` from the props', () => {
		const { container } = renderStack({ items: ITEMS_3, gap: 12, scale: 0.1, offset: 20 });

		const root = rootOf(container);
		expect(decl(root, '--gap')).toBe('12px');
		expect(decl(root, '--offset')).toBe('20px');
		expect(decl(root, '--scale')).toBe('0.1');
		expect(decl(wrappersOf(container)[1], '--translate')).toBe('20px');
	});

	it('appends a caller `style` last, so the caller wins', () => {
		const { container } = renderStack({ items: ITEMS_3, style: '--gap: 99px; color: red;' });

		// A duplicated declaration resolves to the last one written, so `--gap: 99px` surviving is
		// exactly the proof that the caller's string is appended after the component's — had it been
		// prepended, the stack's own `8px` would be the one left standing.
		const root = rootOf(container);
		expect(decl(root, '--gap')).toBe('99px');
		expect(decl(root, 'color')).toBe('red');
		expect(decl(root, '--offset')).toBe('10px');
		expect(decl(root, '--scale')).toBe(String(SCALE));
	});
});

// ---------------------------------------------------------------------------
// RTL and `side` (T007 — US3, quickstart 6 & 11)
// ---------------------------------------------------------------------------

describe('Stack RTL (T007)', () => {
	it('renders identical geometry under `dir="rtl"`', () => {
		const ltr = renderStack({ items: ITEMS_5, expandOnHover: true, dir: 'ltr' });
		const rtl = renderStack({ items: ITEMS_5, expandOnHover: true, dir: 'rtl' });

		const ltrWrappers = wrappersOf(ltr.container);
		const rtlWrappers = wrappersOf(rtl.container);

		rtlWrappers.forEach((wrapper, index) => {
			expect(styleOf(wrapper)).toBe(styleOf(ltrWrappers[index]));
			expect(wrapper.getAttribute('data-index')).toBe(
				ltrWrappers[index].getAttribute('data-index')
			);
			expect(wrapper.getAttribute('data-visible')).toBe(
				ltrWrappers[index].getAttribute('data-visible')
			);
			expect(wrapper.getAttribute('data-front')).toBe(
				ltrWrappers[index].getAttribute('data-front')
			);
		});
	});

	it('anchors the wrapper with logical inline properties, never physical ones', () => {
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true, dir: 'rtl' });

		const wrapper = wrappersOf(container)[0];
		expect(wrapper).toHaveClass('start-0');
		expect(wrapper).toHaveClass('after:start-0');
		expect(wrapper.className).not.toContain('left-0');
	});
});

describe('Stack side (T007)', () => {
	it('exposes both documented sides', () => {
		expect(STACK_SIDES).toEqual(['top', 'bottom']);
	});

	it('anchors and negates the translation for `side="top"`', () => {
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true, side: 'top' });

		const wrapper = wrappersOf(container)[1];
		expect(wrapper).toHaveClass('top-0');
		expect(wrapper).toHaveClass('origin-top');
		expect(wrapper).toHaveClass('translate-y-[calc(var(--translate)*-1)]');
		expect(wrapper.className).not.toContain('origin-bottom');
	});

	it('anchors the default `side="bottom"` the other way and leaves everything else identical', () => {
		const top = renderStack({ items: ITEMS_3, expandOnHover: true, side: 'top' });
		const bottom = renderStack({ items: ITEMS_3, expandOnHover: true, side: 'bottom' });

		const bottomWrapper = wrappersOf(bottom.container)[1];
		expect(bottomWrapper).toHaveClass('bottom-0');
		expect(bottomWrapper).toHaveClass('origin-bottom');
		expect(bottomWrapper).toHaveClass('translate-y-[var(--translate)]');

		const topWrapper = wrappersOf(top.container)[1];
		expect(styleOf(bottomWrapper)).toBe(styleOf(topWrapper));
		for (const attribute of ['data-index', 'data-front', 'data-visible', 'data-expanded']) {
			expect(bottomWrapper.getAttribute(attribute)).toBe(topWrapper.getAttribute(attribute));
		}
	});
});

// ---------------------------------------------------------------------------
// Edge cases, motion and composition (T008 — quickstart 7-10, 13; FR-020)
// ---------------------------------------------------------------------------

describe('Stack edge cases (T008)', () => {
	it('renders every item when there are fewer children than `itemCount`', () => {
		const { container } = renderStack({ items: ITEMS_2, expandOnHover: true });

		const wrappers = wrappersOf(container);
		expect(wrappers).toHaveLength(2);
		expect(wrappers[0]).toHaveAttribute('data-visible', 'true');
		expect(wrappers[1]).toHaveAttribute('data-visible', 'true');
		expect(decl(wrappers[0], 'z-index')).toBe('2');
		expect(decl(wrappers[1], 'z-index')).toBe('1');
	});

	it('honours `expandedItemCount` while expanded', async () => {
		const user = userEvent.setup();
		const { container } = renderStack({
			items: ITEMS_5,
			expandOnHover: true,
			expandedItemCount: 2
		});

		await user.hover(rootOf(container));

		const wrappers = wrappersOf(container);
		expect(wrappers[0]).toHaveAttribute('data-visible', 'true');
		expect(wrappers[1]).toHaveAttribute('data-visible', 'true');

		for (const index of [2, 3, 4]) {
			expect(wrappers[index]).toHaveAttribute('data-visible', 'false');
			expect(decl(wrappers[index], 'opacity')).toBe('0');
			expect(wrappers[index]).toHaveClass('pointer-events-none');
		}
	});

	it('renumbers the remaining items when the front one is removed', async () => {
		const props: StackHarnessProps = { items: ITEMS_3, expandOnHover: true };
		const { container, rerender } = renderStack(props);

		expect(wrappersOf(container)).toHaveLength(3);

		await rerender({ ...props, items: ITEMS_3.slice(1) });

		const wrappers = wrappersOf(container);
		expect(wrappers).toHaveLength(2);
		expect(wrappers[0]).toHaveAttribute('data-index', '0');
		expect(wrappers[0]).toHaveAttribute('data-front', 'true');
		expect(wrappers[1]).toHaveAttribute('data-index', '1');
		expect(wrappers[1]).toHaveAttribute('data-front', 'false');
		expect(decl(wrappers[0], 'z-index')).toBe('2');
		expect(decl(wrappers[1], 'z-index')).toBe('1');
		expect(decl(wrappers[0], '--translate')).toBe('0px');
		expect(decl(wrappers[1], '--translate')).toBe(`${OFFSET}px`);
	});

	it('drops the transition under `prefers-reduced-motion` on both the wrapper and the card', () => {
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true });

		// The fan-out is a declared CSS transition over the two custom properties, not an instant class
		// swap — so the transition utilities have to be asserted alongside their `motion-reduce`
		// counterpart, or "reduced motion collapses it to an instant change" would be vacuous (SC-003).
		const wrapper = wrappersOf(container)[0];
		expect(wrapper).toHaveClass('transition-all', 'duration-300', 'ease-out');
		expect(wrapper).toHaveClass('motion-reduce:transition-none');

		const card = cardsOf(container)[0];
		expect(card).toHaveClass('transition-shadow', 'duration-200');
		expect(card).toHaveClass('motion-reduce:transition-none');
	});

	it('keeps the gap hoverable with an `::after` bridge that only grows while expanded', async () => {
		const user = userEvent.setup();
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true });

		const wrapper = wrappersOf(container)[1];
		for (const utility of [
			'after:absolute',
			'after:bottom-full',
			'after:start-0',
			"after:content-['']",
			'after:w-full'
		]) {
			expect(wrapper).toHaveClass(utility);
		}
		expect(wrapper.className).not.toContain('after:h-[calc(var(--gap)+1px)]');

		await user.hover(rootOf(container));

		expect(wrappersOf(container)[1]).toHaveClass('after:h-[calc(var(--gap)+1px)]');
	});

	it('bridges from the other edge for `side="top"`', () => {
		const { container } = renderStack({ items: ITEMS_3, expandOnHover: true, side: 'top' });

		const wrapper = wrappersOf(container)[1];
		expect(wrapper).toHaveClass('after:top-full');
		expect(wrapper.className).not.toContain('after:bottom-full');
	});

	it('merges a caller `class` last on both parts', () => {
		const { container } = renderStack({
			items: ITEMS_3,
			expandOnHover: true,
			class: 'w-[360px]',
			itemClass: 'p-8'
		});

		const root = rootOf(container);
		expect(root).toHaveClass('w-[360px]');
		expect(root.className).not.toContain('w-full');
		expect(root).toHaveClass('relative');

		// Only the conflicting utility is dropped: the card stays the self-contained surface FR-011
		// describes — rounded, bordered, filled, with a resting shadow that lifts on hover.
		const card = cardsOf(container)[0];
		expect(card).toHaveClass('p-8');
		expect(card.className).not.toContain('p-4');
		expect(card).toHaveClass('rounded-lg', 'border', 'bg-card', 'shadow-sm', 'hover:shadow-md');
	});

	it('forwards a caller `style` to the card', () => {
		const { container } = renderStack({ items: ITEMS_3, itemStyle: 'color: red;' });

		expect(styleOf(cardsOf(container)[0])).toBe('color: red;');
	});
});

// ---------------------------------------------------------------------------
// Degenerate and dynamic stacks (T021/T022 — spec.md edge cases "Zero or one child" and
// "Children added or removed at runtime", FR-016)
// ---------------------------------------------------------------------------

describe('Stack degenerate stacks (T021)', () => {
	it('renders the root and nothing else when it has no children', () => {
		const { container } = renderStack({ items: [], expandOnHover: true });

		const root = rootOf(container);
		expect(root).toHaveAttribute('data-state', 'collapsed');
		expect(decl(root, '--gap')).toBe(`${GAP}px`);
		expect(wrappersOf(container)).toHaveLength(0);
		expect(cardsOf(container)).toHaveLength(0);
	});

	it('lays a single child out flat, with no offset, scale-down or dimming', () => {
		const { container } = renderStack({ items: ['only'], expandOnHover: true });

		const wrapper = wrappersOf(container)[0];
		expect(wrapper).toHaveAttribute('data-index', '0');
		expect(wrapper).toHaveAttribute('data-front', 'true');
		expect(wrapper).toHaveAttribute('data-visible', 'true');
		expect(decl(wrapper, '--translate')).toBe('0px');
		expect(decl(wrapper, '--item-scale')).toBe('1');
		expect(decl(wrapper, 'z-index')).toBe('1');
		expect(decl(wrapper, 'opacity')).toBe('1');
	});

	it('expands and collapses a single-child stack without error', async () => {
		const user = userEvent.setup();
		const { container } = renderStack({ items: ['only'], expandOnHover: true });

		const root = rootOf(container);
		await user.hover(root);

		expect(root).toHaveAttribute('data-state', 'expanded');
		// There is nothing in front of the only item, so expanding moves it nowhere.
		expect(decl(wrappersOf(container)[0], '--translate')).toBe(expandedTranslate(0));

		await user.unhover(root);

		expect(root).toHaveAttribute('data-state', 'collapsed');
	});
});

describe('Stack runtime item changes (T022)', () => {
	it('registers an appended item in document order and renumbers the stack', async () => {
		const props: StackHarnessProps = { items: ITEMS_2, expandOnHover: true };
		const { container, rerender } = renderStack(props);

		expect(wrappersOf(container)).toHaveLength(2);

		await rerender({ ...props, items: ITEMS_3 });

		const wrappers = wrappersOf(container);
		expect(wrappers).toHaveLength(3);

		wrappers.forEach((wrapper, index) => {
			expect(wrapper).toHaveAttribute('data-index', String(index));
			// The new item joins the back of the stack, so the front flag has not moved.
			expect(wrapper).toHaveAttribute('data-front', index === 0 ? 'true' : 'false');
			// Everything still fits inside the default `itemCount={3}`.
			expect(wrapper).toHaveAttribute('data-visible', 'true');
			expect(decl(wrapper, '--translate')).toBe(`${index * OFFSET}px`);
			// `z-index` counts down from the new total, so the added item did not steal the top slot.
			expect(decl(wrapper, 'z-index')).toBe(String(ITEMS_3.length - index));
		});
	});
});

describe('Stack child snippets (T008)', () => {
	it('hands the root snippet a payload that reproduces the default rendering', async () => {
		const user = userEvent.setup();
		let refs: StackHarnessRefs = { root: null, item: null };
		const { container } = renderStack({
			mode: 'root-child',
			items: ITEMS_3,
			expandOnHover: true,
			onRefs: (next) => {
				refs = next;
			}
		});

		const rendered = container.querySelector<HTMLElement>('[data-testid="root-child"]');
		expect(rendered).not.toBeNull();
		expect(rendered).toHaveAttribute('data-slot', 'stack');
		expect(rendered).toHaveAttribute('data-state', 'collapsed');
		expect(rendered).toHaveAttribute('data-expanded', 'false');
		expect(rendered).toHaveClass('relative', 'w-full');
		expect(decl(rendered as HTMLElement, '--gap')).toBe('8px');

		// The snippet owns the subtree, so `children` is not rendered by the root and `ref` stays null.
		expect(cardsOf(container)).toHaveLength(0);
		expect(refs.root).toBeNull();

		// The composed handlers travel in the payload, so the spread element behaves like the default.
		await user.hover(rendered as HTMLElement);
		expect(rendered).toHaveAttribute('data-state', 'expanded');
	});

	it('hands the item snippet a payload that replaces only the card', () => {
		let refs: StackHarnessRefs = { root: null, item: null };
		const { container } = renderStack({
			mode: 'item-child',
			items: ITEMS_3,
			expandOnHover: true,
			onRefs: (next) => {
				refs = next;
			}
		});

		const rendered = container.querySelector<HTMLElement>('[data-testid="item-child"]');
		expect(rendered).not.toBeNull();
		expect(rendered).toHaveAttribute('data-slot', 'stack-item');
		expect(rendered).toHaveAttribute('data-index', '0');
		expect(rendered).toHaveAttribute('data-position', 'front');
		expect(rendered).toHaveAttribute('data-state', 'collapsed');
		expect(rendered).toHaveClass('bg-card');

		// The positioning wrapper is always a plain `div` and still surrounds the replaced card.
		expect(wrappersOf(container)).toHaveLength(3);
		expect(rendered?.parentElement).toHaveAttribute('data-slot', 'stack-item-wrapper');
		expect(container.querySelectorAll('[data-testid="item-child"]')).toHaveLength(1);
		expect(refs.item).toBeNull();
	});

	it('binds `ref` to the card in the default rendering', () => {
		let refs: StackHarnessRefs = { root: null, item: null };
		const { container } = renderStack({
			items: ITEMS_3,
			onRefs: (next) => {
				refs = next;
			}
		});

		expect(refs.root).toBe(rootOf(container));
		expect(refs.item).toBe(cardsOf(container)[0]);
	});
});
