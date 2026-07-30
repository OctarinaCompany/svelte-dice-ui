import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	DEFAULT_ANIMATION_DURATION,
	DEFAULT_HOVER_CLOSE_DELAY,
	DEFAULT_ITEM_DELAY,
	DomOrderedCollection,
	getContentPosition,
	getDataState,
	getItemDelay,
	getOrientation,
	getTransformOrigin,
	SPEED_DIAL_SIDES,
	type SpeedDialInteractOutsideEvent
} from './index.js';
import Harness, {
	SPEED_DIAL_HARNESS_ITEMS,
	type SpeedDialHarnessItem,
	type SpeedDialHarnessProps,
	type SpeedDialHarnessRefs
} from './speed-dial.test.svelte';

afterEach(() => {
	vi.useRealTimers();
});

function renderDial(props: SpeedDialHarnessProps = {}) {
	return render(Harness, { props });
}

/** Fake timers plus the `advanceTimers` bridge, without which no `user-event` await ever elapses. */
function setupFakeTimers() {
	vi.useFakeTimers();
	return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

function bySlot(slot: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

/** `style` is written with `setAttribute`, so the raw string is the reliable thing to assert on. */
function styleOf(element: HTMLElement): string {
	return element.getAttribute('style') ?? '';
}

/**
 * `pointerType: 'touch'` is the one interaction `user-event` cannot express, so that single branch
 * is driven by an explicit dispatch (research R-14). `pointerType` is defined on the instance so the
 * helper works whether or not jsdom exposes a `PointerEvent` constructor.
 */
function dispatchPointerDown(target: Element, pointerType: string): void {
	const event =
		typeof PointerEvent === 'function'
			? new PointerEvent('pointerdown', { bubbles: true, cancelable: true })
			: new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'pointerType', { value: pointerType });
	target.dispatchEvent(event);
}

/**
 * `user-event` dispatches `mouseenter`/`mouseleave` non-cancelable, as the DOM spec requires, and
 * dispatches no mouse event at all at a disabled control — so every branch guarded by
 * `defaultPrevented`, and the disabled-trigger hover case, is driven by an explicit dispatch.
 */
function dispatchMouse(
	target: Element,
	type: 'mouseenter' | 'mouseleave',
	cancelable = true
): void {
	target.dispatchEvent(new MouseEvent(type, { bubbles: false, cancelable }));
}

// ---------------------------------------------------------------------------
// Pure helpers and the reusable collection (quickstart V-2)
// ---------------------------------------------------------------------------

describe('speed dial helpers (T009, V-2)', () => {
	it('maps the open flag onto the documented data-state values', () => {
		expect(getDataState(true)).toBe('open');
		expect(getDataState(false)).toBe('closed');
	});

	it('returns the transform origin opposite each side', () => {
		expect(getTransformOrigin('top')).toBe('bottom center');
		expect(getTransformOrigin('bottom')).toBe('top center');
		expect(getTransformOrigin('left')).toBe('right center');
		expect(getTransformOrigin('right')).toBe('left center');
	});

	it('treats top and bottom as vertical, left and right as horizontal', () => {
		expect(getOrientation('top')).toBe('vertical');
		expect(getOrientation('bottom')).toBe('vertical');
		expect(getOrientation('left')).toBe('horizontal');
		expect(getOrientation('right')).toBe('horizontal');
	});

	it('staggers forwards while opening and backwards while closing', () => {
		expect(getItemDelay(0, 3, true)).toBe(0);
		expect(getItemDelay(1, 3, true)).toBe(50);
		expect(getItemDelay(2, 3, true)).toBe(100);

		expect(getItemDelay(0, 3, false)).toBe(100);
		expect(getItemDelay(1, 3, false)).toBe(50);
		expect(getItemDelay(2, 3, false)).toBe(0);
	});

	it('handles the empty and single-item counts', () => {
		expect(getItemDelay(0, 1, true)).toBe(0);
		expect(getItemDelay(0, 1, false)).toBe(0);
		expect(getItemDelay(0, 0, true)).toBe(0);
		expect(getItemDelay(0, 0, false)).toBe(-DEFAULT_ITEM_DELAY);
	});

	it('emits the documented declarations per side, honouring the offset', () => {
		expect(getContentPosition('top', 8)).toBe('bottom: 100%; right: 0; margin-bottom: 8px;');
		expect(getContentPosition('bottom', 8)).toBe('top: 100%; right: 0; margin-top: 8px;');
		expect(getContentPosition('left', 16)).toBe('right: 100%; top: 0; margin-right: 16px;');
		expect(getContentPosition('right', 0)).toBe('left: 100%; top: 0; margin-left: 0px;');
	});
});

describe('DomOrderedCollection (T009, V-2)', () => {
	function makeTree(ids: string[]) {
		const container = document.createElement('div');
		const elements = ids.map((id) => {
			const element = document.createElement('div');
			element.id = id;
			container.append(element);
			return element;
		});
		document.body.append(container);
		return { container, elements };
	}

	it('returns entries in document order however they were registered', () => {
		const { container, elements } = makeTree(['a', 'b', 'c']);
		const collection = new DomOrderedCollection();

		collection.register('c', elements[2], undefined);
		collection.register('a', elements[0], undefined);
		collection.register('b', elements[1], undefined);

		expect(collection.elements()).toEqual(elements);
		expect(collection.size).toBe(3);

		container.remove();
	});

	it('builds one shared index map and drops unregistered ids', () => {
		const { container, elements } = makeTree(['a', 'b', 'c']);
		const collection = new DomOrderedCollection();

		collection.register('a', elements[0], undefined);
		collection.register('b', elements[1], undefined);
		collection.register('c', elements[2], undefined);

		expect([...collection.indexById.entries()]).toEqual([
			['a', 0],
			['b', 1],
			['c', 2]
		]);

		collection.unregister('b');

		expect([...collection.indexById.entries()]).toEqual([
			['a', 0],
			['c', 1]
		]);
		expect(collection.elements()).toEqual([elements[0], elements[2]]);

		container.remove();
	});

	it('ignores an element that is no longer attached, and unknown ids', () => {
		const { container, elements } = makeTree(['a']);
		const detached = document.createElement('div');
		const collection = new DomOrderedCollection();

		collection.register('a', elements[0], undefined);
		collection.register('detached', detached, undefined);
		collection.unregister('never-registered');

		expect(collection.elements()).toEqual([elements[0]]);

		container.remove();
	});

	it('carries per-entry metadata read at call time', () => {
		const { container, elements } = makeTree(['a', 'b']);
		const collection = new DomOrderedCollection<{ getDisabled: () => boolean }>();
		let bDisabled = false;

		collection.register('a', elements[0], { getDisabled: () => false });
		collection.register('b', elements[1], { getDisabled: () => bDisabled });

		expect(collection.ordered.filter((entry) => !entry.meta.getDisabled())).toHaveLength(2);

		bDisabled = true;

		expect(collection.ordered.filter((entry) => !entry.meta.getDisabled())).toHaveLength(1);

		container.remove();
	});
});

// ---------------------------------------------------------------------------
// Ported one-for-one from the upstream suite
// (.reference/diceui/docs/registry/bases/radix/test/speed-dial.test.tsx — all 17 assertions)
// ---------------------------------------------------------------------------

describe('SpeedDial — Basic Rendering (T004, US1, upstream test:44-66)', () => {
	it('renders speed dial with trigger', () => {
		renderDial();

		const trigger = screen.getByTestId('trigger');
		expect(trigger).toBeInTheDocument();
		expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
	});

	it('renders with correct data attributes when closed', () => {
		renderDial();

		expect(screen.getByTestId('trigger')).toHaveAttribute('data-state', 'closed');
	});

	it('does not render content when closed', () => {
		renderDial();

		expect(screen.queryByTestId('content')).not.toBeInTheDocument();
	});
});

describe('SpeedDial — Open/Close Behavior (T004, US1, upstream test:68-100)', () => {
	it('opens speed dial when trigger is clicked', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderDial({ onOpenChange });

		const trigger = screen.getByTestId('trigger');
		await user.click(trigger);

		expect(onOpenChange).toHaveBeenCalledWith(true);
		expect(trigger).toHaveAttribute('aria-expanded', 'true');
	});

	it('supports controlled open state', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		const { rerender } = renderDial({ open: false, onOpenChange });

		const trigger = screen.getByTestId('trigger');
		await user.click(trigger);

		expect(onOpenChange).toHaveBeenCalledWith(true);

		// The parent updating `open` is authoritative, exactly as upstream's rerender assertion.
		await rerender({ open: true, onOpenChange });

		expect(trigger).toHaveAttribute('aria-expanded', 'true');
	});
});

describe('SpeedDial — Disabled State (T004, US1, upstream test:102-121, 178-189)', () => {
	it('disables trigger when disabled prop is true', () => {
		renderDial({ disabled: true });

		expect(screen.getByTestId('trigger')).toBeDisabled();
	});

	it('does not open when disabled', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderDial({ disabled: true, onOpenChange });

		await user.click(screen.getByTestId('trigger'));

		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it('updates disabled state properly when prop changes', async () => {
		const { rerender } = renderDial({ disabled: false });

		const trigger = screen.getByTestId('trigger');
		expect(trigger).not.toBeDisabled();

		await rerender({ disabled: true });

		expect(trigger).toBeDisabled();
	});
});

describe('SpeedDial — ARIA Attributes (T004, US1, upstream test:123-143)', () => {
	it('has correct ARIA attributes on trigger', () => {
		renderDial();

		const trigger = screen.getByTestId('trigger');
		expect(trigger).toHaveAttribute('role', 'button');
		expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
		expect(trigger).toHaveAttribute('aria-controls');
	});

	it('updates aria-expanded when opening', async () => {
		const user = userEvent.setup();
		renderDial();

		const trigger = screen.getByTestId('trigger');
		await user.click(trigger);

		expect(trigger).toHaveAttribute('aria-expanded', 'true');
	});

	// T029: upstream only asserts the attribute is present; FR-013 and the APG menu-button pattern
	// require it to actually reference the content, so the id is resolved here.
	it('points aria-controls at the rendered content id (T029, FR-013)', () => {
		renderDial({ defaultOpen: true });

		const content = screen.getByTestId('content');
		expect(content.id).not.toBe('');
		expect(screen.getByTestId('trigger')).toHaveAttribute('aria-controls', content.id);
	});
});

describe('SpeedDial — O(n²) performance regression (T004, US1, SC-004, upstream test:145-176)', () => {
	it('handles many children efficiently', () => {
		const manyItems: SpeedDialHarnessItem[] = Array.from({ length: 50 }, (_, index) => ({
			key: `item-${index}`,
			label: `Action ${index}`
		}));

		const start = performance.now();
		renderDial({ defaultOpen: true, items: manyItems });
		const renderTime = performance.now() - start;

		expect(screen.getAllByRole('menuitem')).toHaveLength(50);
		expect(renderTime).toBeLessThan(1000);
	});
});

describe('SpeedDial — Rapid Toggle (T004, US1, upstream test:191-211)', () => {
	it('handles rapid open/close without errors', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderDial({ onOpenChange });

		const trigger = screen.getByTestId('trigger');
		await user.click(trigger);
		await user.click(trigger);
		await user.click(trigger);

		expect(onOpenChange).toHaveBeenCalledTimes(3);
		expect(onOpenChange).toHaveBeenNthCalledWith(1, true);
		expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
		expect(onOpenChange).toHaveBeenNthCalledWith(3, true);
	});
});

describe('SpeedDial — Action Selection (T004, US1, upstream test:213-283)', () => {
	it('prevents closing when onSelect prevents default', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		const onSelect = vi.fn((event: Event) => event.preventDefault());

		renderDial({
			open: true,
			onOpenChange,
			items: [{ key: 'home', label: 'Home', onSelect }]
		});

		await user.click(screen.getByTestId('action-home'));

		expect(onSelect).toHaveBeenCalled();
		expect(onOpenChange).not.toHaveBeenCalledWith(false);
	});

	it('supports disabled actions', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();

		renderDial({
			open: true,
			items: [{ key: 'home', label: 'Home', disabled: true, onSelect }]
		});

		const action = screen.getByTestId('action-home');
		expect(action).toBeDisabled();

		await user.click(action);

		expect(onSelect).not.toHaveBeenCalled();
	});

	it('closes the dial when nothing prevents the selection', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		const onSelect = vi.fn();

		renderDial({
			defaultOpen: true,
			onOpenChange,
			items: [{ key: 'home', label: 'Home', onSelect }]
		});

		await user.click(screen.getByTestId('action-home'));

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});

describe('SpeedDial — Side Variations (T004, US1/US3, upstream test:285-312)', () => {
	it.each(SPEED_DIAL_SIDES)('renders with side=%s', (side) => {
		renderDial({ open: true, side });

		const content = screen.getByTestId('content');
		expect(content).toBeInTheDocument();
		expect(content).toHaveAttribute('data-side', side);
	});

	it('applies correct orientation for vertical sides', () => {
		renderDial({ open: true, side: 'top' });

		expect(screen.getByTestId('content')).toHaveAttribute('aria-orientation', 'vertical');
	});

	it('applies correct orientation for horizontal sides', () => {
		renderDial({ open: true, side: 'left' });

		expect(screen.getByTestId('content')).toHaveAttribute('aria-orientation', 'horizontal');
	});
});

describe('SpeedDial — ForceMount (T004, US1, upstream test:314-339)', () => {
	it('keeps content mounted when forceMount is true', () => {
		renderDial({ open: false, forceMount: true });

		expect(screen.getByTestId('content')).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Keyboard and focus (T005, US2, quickstart V-4)
// ---------------------------------------------------------------------------

describe('SpeedDial keyboard interaction (T005, US2, V-4)', () => {
	it('opens on Enter and on Space when the trigger has focus', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderDial({ onOpenChange });

		const trigger = screen.getByTestId('trigger');
		trigger.focus();

		await user.keyboard('{Enter}');
		expect(onOpenChange).toHaveBeenNthCalledWith(1, true);

		await user.keyboard('{Escape}');
		trigger.focus();

		await user.keyboard(' ');
		expect(onOpenChange).toHaveBeenLastCalledWith(true);
	});

	it('closes on Escape and returns focus to the trigger from the trigger', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderDial({ defaultOpen: true, onOpenChange });

		const trigger = screen.getByTestId('trigger');
		trigger.focus();

		await user.keyboard('{Escape}');

		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(document.activeElement).toBe(trigger);
	});

	it('closes on Escape and returns focus to the trigger from an action', async () => {
		const user = userEvent.setup();
		renderDial({ defaultOpen: true });

		const action = screen.getByTestId('action-share');
		action.focus();
		expect(document.activeElement).toBe(action);

		await user.keyboard('{Escape}');

		expect(document.activeElement).toBe(screen.getByTestId('trigger'));
	});

	it('keeps the dial open when onEscapeKeyDown prevents default', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		const onEscapeKeyDown = vi.fn((event: KeyboardEvent) => event.preventDefault());

		renderDial({ defaultOpen: true, onOpenChange, onEscapeKeyDown });

		screen.getByTestId('trigger').focus();
		await user.keyboard('{Escape}');

		expect(onEscapeKeyDown).toHaveBeenCalled();
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(screen.getByTestId('content')).toBeInTheDocument();
	});

	it('closes when Tab leaves the last enabled action', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderDial({ defaultOpen: true, onOpenChange, withSiblings: true });

		screen.getByTestId('action-edit').focus();
		await user.tab();

		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(document.activeElement).toBe(screen.getByTestId('after'));
	});

	it('closes when Shift+Tab leaves the trigger, the first node of the composite', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderDial({ defaultOpen: true, onOpenChange, withSiblings: true });

		screen.getByTestId('trigger').focus();
		await user.tab({ shift: true });

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('needs two Shift+Tabs from the first action: the trigger comes first (research R-06)', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderDial({ defaultOpen: true, onOpenChange, withSiblings: true });

		screen.getByTestId('action-home').focus();
		await user.tab({ shift: true });

		expect(onOpenChange).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(screen.getByTestId('trigger'));

		await user.tab({ shift: true });

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('never treats a disabled action as the Tab boundary', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderDial({
			defaultOpen: true,
			onOpenChange,
			withSiblings: true,
			items: [
				{ key: 'home', label: 'Home' },
				{ key: 'share', label: 'Share' },
				{ key: 'edit', label: 'Edit', disabled: true }
			]
		});

		screen.getByTestId('action-share').focus();
		await user.tab();

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('does not throw on Tab or Escape with zero items', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderDial({ defaultOpen: true, onOpenChange, items: [] });

		const trigger = screen.getByTestId('trigger');
		// The empty container is still an exposed, still-empty menu (T030, spec Edge Cases).
		const content = screen.getByRole('menu');
		expect(content).toBe(screen.getByTestId('content'));
		expect(content).toHaveAttribute('aria-orientation', 'vertical');
		expect(screen.queryAllByRole('menuitem')).toHaveLength(0);

		trigger.focus();
		await user.keyboard('{Escape}');
		await user.tab();

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});

// ---------------------------------------------------------------------------
// Roles, accessible names, composition and guard rails (T006, quickstart V-7)
// ---------------------------------------------------------------------------

describe('SpeedDial roles and accessible names (T006, US1/US3, V-7)', () => {
	it('exposes the documented roles', () => {
		renderDial({ defaultOpen: true });

		expect(screen.getByRole('menu')).toHaveAttribute('aria-orientation', 'vertical');
		expect(screen.getAllByRole('menuitem')).toHaveLength(3);
		expect(screen.getByTestId('item-home')).toHaveAttribute('role', 'none');
	});

	it('names each action after its sibling label', () => {
		renderDial({ defaultOpen: true });

		const action = screen.getByTestId('action-share');
		const label = screen.getByTestId('label-share');

		expect(action).toHaveAttribute('aria-labelledby', label.id);
		expect(action).toHaveAccessibleName('Share');
	});

	it('keeps the accessible name when the label is sr-only', () => {
		renderDial({
			defaultOpen: true,
			items: [{ key: 'share', label: 'Share', srOnly: true }]
		});

		const label = screen.getByTestId('label-share');
		expect(label).toHaveClass('sr-only');
		expect(screen.getByTestId('action-share')).toHaveAccessibleName('Share');
	});

	it('carries a data-slot on every part', () => {
		renderDial({ defaultOpen: true });

		expect(bySlot('speed-dial')).toBe(screen.getByTestId('root'));
		expect(bySlot('speed-dial-trigger')).toBe(screen.getByTestId('trigger'));
		expect(bySlot('speed-dial-content')).toBe(screen.getByTestId('content'));
		expect(bySlot('speed-dial-item')).toBe(screen.getByTestId('item-home'));
		expect(bySlot('speed-dial-label')).toBe(screen.getByTestId('label-home'));
		expect(bySlot('speed-dial-action')).toBe(screen.getByTestId('action-home'));
	});

	it('merges the caller class last so it wins over the defaults', () => {
		renderDial({ defaultOpen: true, triggerClass: 'size-8', labelClass: 'px-8' });

		const trigger = screen.getByTestId('trigger');
		expect(trigger).toHaveClass('size-8');
		expect(trigger).not.toHaveClass('size-11');

		const label = screen.getByTestId('label-home');
		expect(label).toHaveClass('px-8');
		expect(label).not.toHaveClass('px-2');
	});

	it('omits data-disabled unless the dial is disabled', async () => {
		const { rerender } = renderDial();

		expect(screen.getByTestId('root')).not.toHaveAttribute('data-disabled');

		await rerender({ disabled: true });

		expect(screen.getByTestId('root')).toHaveAttribute('data-disabled', '');
	});
});

describe('SpeedDial child snippets (T006, US3, V-7)', () => {
	it('renders the root onto the caller element', () => {
		renderDial({ defaultOpen: true, rootChild: true });

		const rootChild = screen.getByTestId('root-child');
		expect(rootChild.tagName).toBe('SECTION');
		expect(rootChild).toHaveAttribute('data-slot', 'speed-dial');
		expect(rootChild).toHaveAttribute('data-state', 'open');
	});

	it('renders the trigger onto the caller element', () => {
		renderDial({ triggerChild: true });

		const triggerChild = screen.getByTestId('trigger-child');
		expect(triggerChild).toHaveAttribute('data-slot', 'speed-dial-trigger');
		expect(triggerChild).toHaveAttribute('aria-haspopup', 'menu');
		expect(triggerChild).toHaveClass('rounded-full');
	});

	it('renders the content onto the caller element', () => {
		renderDial({ defaultOpen: true, contentChild: true });

		const contentChild = screen.getByTestId('content-child');
		expect(contentChild.tagName).toBe('NAV');
		expect(contentChild).toHaveAttribute('role', 'menu');
		expect(contentChild).toHaveAttribute('data-side', 'top');
	});

	it('renders the item onto the caller element', () => {
		renderDial({ defaultOpen: true, itemChild: true });

		const itemChild = screen.getByTestId('item-child');
		expect(itemChild).toHaveAttribute('role', 'none');
		expect(styleOf(itemChild)).toContain('--speed-dial-delay: 0ms');
	});

	it('renders the action onto the caller element', () => {
		renderDial({ defaultOpen: true, actionChild: true });

		const actionChild = screen.getAllByTestId('action-child')[0];
		expect(actionChild).toHaveAttribute('role', 'menuitem');
		expect(actionChild).toHaveAttribute('data-slot', 'speed-dial-action');
	});

	it('renders the label onto the caller element', () => {
		renderDial({ defaultOpen: true, labelChild: true });

		const labelChild = screen.getAllByTestId('label-child')[0];
		expect(labelChild.tagName).toBe('EM');
		expect(labelChild).toHaveAttribute('data-slot', 'speed-dial-label');
	});
});

describe('SpeedDial guard rails (T006, V-7, FR-020)', () => {
	it('throws when the trigger has no root', () => {
		expect(() => renderDial({ mode: 'bare-trigger' })).toThrow(/within/);
	});

	it('throws when the content has no root', () => {
		expect(() => renderDial({ mode: 'bare-content' })).toThrow(/within/);
	});

	it('throws when the item has no root', () => {
		expect(() => renderDial({ mode: 'bare-item' })).toThrow(/within/);
	});

	it('throws when the action has no root', () => {
		expect(() => renderDial({ mode: 'bare-action' })).toThrow(/within/);
	});

	it('throws when the label has no item', () => {
		expect(() => renderDial({ mode: 'bare-label' })).toThrow(/within/);
	});

	it('renders an item inside the root but outside the content (research R-10)', () => {
		renderDial({ mode: 'item-outside-content' });

		const item = screen.getByTestId('orphan-item');
		expect(item).toHaveAttribute('data-state', 'closed');
		expect(styleOf(item)).toContain('--speed-dial-delay: 0ms');
		expect(screen.getByTestId('orphan-action')).toHaveAccessibleName('Orphan');
	});
});

describe('SpeedDial caller handlers run first (T006, FR-010a)', () => {
	it('lets the caller onclick suppress the toggle', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		const onTriggerClick = vi.fn((event: MouseEvent) => event.preventDefault());

		renderDial({ onOpenChange, onTriggerClick });

		await user.click(screen.getByTestId('trigger'));

		expect(onTriggerClick).toHaveBeenCalled();
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it('runs the caller onmouseenter and onmouseleave before the hover timers', async () => {
		const user = setupFakeTimers();
		const onOpenChange = vi.fn();
		const seen: string[] = [];

		renderDial({
			activationMode: 'hover',
			delay: 100,
			onOpenChange: (open) => {
				seen.push(`open:${open}`);
				onOpenChange(open);
			},
			onTriggerMouseEnter: () => seen.push('enter'),
			onTriggerMouseLeave: () => seen.push('leave')
		});

		const trigger = screen.getByTestId('trigger');
		await user.hover(trigger);
		await vi.advanceTimersByTimeAsync(200);
		await user.unhover(trigger);
		await vi.advanceTimersByTimeAsync(200);

		expect(seen).toEqual(['enter', 'open:true', 'leave', 'open:false']);
	});

	it('lets a cancelable mouseenter suppress the hover-open timer', async () => {
		setupFakeTimers();
		const onOpenChange = vi.fn();

		renderDial({
			activationMode: 'hover',
			delay: 100,
			onOpenChange,
			// `user-event` dispatches `mouseenter` non-cancelable, as the DOM spec requires, so the
			// guard is driven with an explicitly cancelable event — the only way to observe it.
			onTriggerMouseEnter: (event) => event.preventDefault()
		});

		screen
			.getByTestId('trigger')
			.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true }));
		await vi.advanceTimersByTimeAsync(500);

		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it('invokes the caller onpointerdowncapture, and preventDefault suppresses the inside-tree guard', async () => {
		const user = setupFakeTimers();
		const onOpenChange = vi.fn();
		const onRootPointerDownCapture = vi.fn((event: PointerEvent) => event.preventDefault());

		renderDial({ defaultOpen: true, onOpenChange, onRootPointerDownCapture });

		// Registration of the document listener is deferred one tick (upstream 741-743).
		await vi.advanceTimersByTimeAsync(1);
		await user.click(screen.getByTestId('trigger'));

		expect(onRootPointerDownCapture).toHaveBeenCalled();
		// Without the guard the press itself dismisses, and only then does the click toggle back open.
		expect(onOpenChange.mock.calls).toEqual([[false], [true]]);
	});

	it('keeps a press on the trigger from dismissing while the guard is active', async () => {
		const user = setupFakeTimers();
		const onOpenChange = vi.fn();
		const onInteractOutside = vi.fn();

		renderDial({ defaultOpen: true, onOpenChange, onInteractOutside });

		await vi.advanceTimersByTimeAsync(1);
		await user.click(screen.getByTestId('trigger'));

		expect(onInteractOutside).not.toHaveBeenCalled();
		expect(onOpenChange.mock.calls).toEqual([[false]]);
	});
});

// ---------------------------------------------------------------------------
// Controlled / uncontrolled and hover activation (T007, US3, quickstart V-6)
// ---------------------------------------------------------------------------

describe('SpeedDial controlled and uncontrolled state (T007, US3, FR-002)', () => {
	it('renders the content immediately when uncontrolled with defaultOpen', () => {
		renderDial({ defaultOpen: true });

		expect(screen.getByTestId('content')).toBeInTheDocument();
		expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'true');
	});

	it('propagates through bind:open in both directions', async () => {
		const user = userEvent.setup();
		const onOpenBinding = vi.fn();
		const { rerender } = renderDial({ onOpenBinding });

		expect(onOpenBinding).toHaveBeenLastCalledWith(false);

		// child → parent: the dial writes the bound prop back into the harness.
		await user.click(screen.getByTestId('trigger'));
		expect(onOpenBinding).toHaveBeenLastCalledWith(true);

		// parent → child: the harness's value wins again. The content lingers for the exit stagger, so
		// the trigger's state is what flips immediately.
		await rerender({ onOpenBinding, open: false });
		expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'false');
	});

	it('reports every transition through onOpenChange and lets the caller re-assert open', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		const { rerender } = renderDial({ open: true, onOpenChange });

		await user.click(screen.getByTestId('trigger'));
		expect(onOpenChange).toHaveBeenCalledWith(false);

		await rerender({ open: true, onOpenChange });
		expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'true');
	});
});

describe('SpeedDial hover activation (T007, US3, V-5)', () => {
	it('opens only after the configured delay and closes ~100 ms after leaving', async () => {
		const user = setupFakeTimers();
		const onOpenChange = vi.fn();
		renderDial({ activationMode: 'hover', delay: 300, onOpenChange });

		const trigger = screen.getByTestId('trigger');
		await user.hover(trigger);

		await vi.advanceTimersByTimeAsync(299);
		expect(onOpenChange).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(onOpenChange).toHaveBeenCalledWith(true);
		expect(screen.getByTestId('content')).toBeInTheDocument();

		await user.unhover(trigger);
		await vi.advanceTimersByTimeAsync(99);
		expect(onOpenChange).not.toHaveBeenCalledWith(false);

		await vi.advanceTimersByTimeAsync(1);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('cancels the pending close when the pointer moves into the content', async () => {
		const user = setupFakeTimers();
		const onOpenChange = vi.fn();
		renderDial({ activationMode: 'hover', delay: 50, onOpenChange });

		const trigger = screen.getByTestId('trigger');
		await user.hover(trigger);
		await vi.advanceTimersByTimeAsync(50);

		await user.unhover(trigger);
		await user.hover(screen.getByTestId('content'));
		await vi.advanceTimersByTimeAsync(500);

		expect(onOpenChange).not.toHaveBeenCalledWith(false);
		expect(screen.getByTestId('content')).toBeInTheDocument();
	});

	it('closes ~100 ms after the pointer leaves the content', async () => {
		const user = setupFakeTimers();
		const onOpenChange = vi.fn();
		renderDial({ activationMode: 'hover', delay: 50, onOpenChange });

		await user.hover(screen.getByTestId('trigger'));
		await vi.advanceTimersByTimeAsync(50);

		const content = screen.getByTestId('content');
		await user.hover(content);
		await user.unhover(content);
		await vi.advanceTimersByTimeAsync(100);

		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});

	it('never opens on hover in click mode', async () => {
		const user = setupFakeTimers();
		const onOpenChange = vi.fn();
		renderDial({ activationMode: 'click', delay: 10, onOpenChange });

		await user.hover(screen.getByTestId('trigger'));
		await vi.advanceTimersByTimeAsync(1000);

		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it('suppresses hover activation while disabled', async () => {
		const user = setupFakeTimers();
		const onOpenChange = vi.fn();
		renderDial({ activationMode: 'hover', delay: 10, disabled: true, onOpenChange });

		await user.hover(screen.getByTestId('trigger'));
		await vi.advanceTimersByTimeAsync(1000);

		expect(onOpenChange).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Pointer dismissal (T009, quickstart V-5)
// ---------------------------------------------------------------------------

describe('SpeedDial outside dismissal (T009, US1, V-5)', () => {
	it('closes on an outside click and reports the original event', async () => {
		const user = setupFakeTimers();
		const onOpenChange = vi.fn();
		const outside: SpeedDialInteractOutsideEvent[] = [];

		renderDial({
			defaultOpen: true,
			withSiblings: true,
			onOpenChange,
			onInteractOutside: (event) => outside.push(event)
		});

		await vi.advanceTimersByTimeAsync(1);
		await user.click(screen.getByTestId('after'));

		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(outside).toHaveLength(1);
		expect(outside[0].detail.originalEvent.type).toBe('pointerdown');
	});

	it('stays open when onInteractOutside prevents default', async () => {
		const user = setupFakeTimers();
		const onOpenChange = vi.fn();

		renderDial({
			defaultOpen: true,
			withSiblings: true,
			onOpenChange,
			onInteractOutside: (event) => event.preventDefault()
		});

		await vi.advanceTimersByTimeAsync(1);
		await user.click(screen.getByTestId('after'));

		expect(onOpenChange).not.toHaveBeenCalled();
		expect(screen.getByTestId('content')).toBeInTheDocument();
	});

	it('defers a touch press to the following click', async () => {
		setupFakeTimers();
		const onOpenChange = vi.fn();
		renderDial({ defaultOpen: true, withSiblings: true, onOpenChange });

		await vi.advanceTimersByTimeAsync(1);

		const outsideButton = screen.getByTestId('after');
		dispatchPointerDown(outsideButton, 'touch');

		expect(onOpenChange).not.toHaveBeenCalled();

		outsideButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('closes on a press inside the content that is not a registered node (research R-05)', async () => {
		const user = setupFakeTimers();
		const onOpenChange = vi.fn();
		const onInteractOutside = vi.fn();

		renderDial({ defaultOpen: true, onOpenChange, onInteractOutside });

		await vi.advanceTimersByTimeAsync(1);
		await user.click(screen.getByTestId('content'));

		expect(onInteractOutside).not.toHaveBeenCalled();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});

// ---------------------------------------------------------------------------
// Presence, animation and CSS custom properties (T009, quickstart V-6)
// ---------------------------------------------------------------------------

describe('SpeedDial presence and animation (T009, US1, V-6)', () => {
	it('keeps the content mounted for (n-1)*50 + 200 ms after closing, then removes it', async () => {
		const user = setupFakeTimers();
		renderDial({ defaultOpen: true });

		await user.click(screen.getByTestId('trigger'));

		const exitDuration =
			(SPEED_DIAL_HARNESS_ITEMS.length - 1) * DEFAULT_ITEM_DELAY + DEFAULT_ANIMATION_DURATION;

		await vi.advanceTimersByTimeAsync(exitDuration - 1);
		expect(screen.getByTestId('content')).toBeInTheDocument();

		await vi.advanceTimersByTimeAsync(2);
		expect(screen.queryByTestId('content')).not.toBeInTheDocument();
	});

	it('keeps a forceMounted content and only flips data-state', async () => {
		const user = setupFakeTimers();
		renderDial({ defaultOpen: true, forceMount: true });

		await vi.advanceTimersByTimeAsync(50);
		expect(screen.getByTestId('content')).toHaveAttribute('data-state', 'open');

		await user.click(screen.getByTestId('trigger'));
		await vi.advanceTimersByTimeAsync(1000);

		expect(screen.getByTestId('content')).toBeInTheDocument();
		expect(screen.getByTestId('content')).toHaveAttribute('data-state', 'closed');
	});

	it('flips the content data-state one frame after opening', async () => {
		renderDial({ defaultOpen: true });

		const content = screen.getByTestId('content');
		expect(content).toHaveAttribute('data-state', 'closed');

		await waitFor(() => expect(content).toHaveAttribute('data-state', 'open'));
	});

	it('exposes gap, offset and transform-origin as custom properties', () => {
		renderDial({ defaultOpen: true, gap: 12, offset: 20, side: 'left' });

		const style = styleOf(screen.getByTestId('content'));
		expect(style).toContain('--speed-dial-gap: 12px');
		expect(style).toContain('--speed-dial-offset: 20px');
		expect(style).toContain('--speed-dial-transform-origin: right center');
		expect(style).toContain('right: 100%');
		expect(style).toContain('margin-right: 20px');
	});

	it('lets the caller style override a component-set custom property', () => {
		renderDial({ defaultOpen: true, contentStyle: '--speed-dial-gap: 99px;' });

		const style = styleOf(screen.getByTestId('content'));
		expect(style.lastIndexOf('--speed-dial-gap: 99px')).toBeGreaterThan(
			style.indexOf('--speed-dial-gap: 8px')
		);
	});

	it('staggers item delays forwards while opening and backwards while closing', async () => {
		const user = setupFakeTimers();
		renderDial({ defaultOpen: true });

		await vi.advanceTimersByTimeAsync(50);

		expect(styleOf(screen.getByTestId('item-home'))).toContain('--speed-dial-delay: 0ms');
		expect(styleOf(screen.getByTestId('item-share'))).toContain('--speed-dial-delay: 50ms');
		expect(styleOf(screen.getByTestId('item-edit'))).toContain('--speed-dial-delay: 100ms');
		expect(styleOf(screen.getByTestId('item-home'))).toContain(
			'--speed-dial-animation-duration: 200ms'
		);

		await user.click(screen.getByTestId('trigger'));

		expect(styleOf(screen.getByTestId('item-home'))).toContain('--speed-dial-delay: 100ms');
		expect(styleOf(screen.getByTestId('item-share'))).toContain('--speed-dial-delay: 50ms');
		expect(styleOf(screen.getByTestId('item-edit'))).toContain('--speed-dial-delay: 0ms');
	});

	it('marks every item open once the content is animating', async () => {
		setupFakeTimers();
		renderDial({ defaultOpen: true });

		expect(screen.getByTestId('item-home')).toHaveAttribute('data-state', 'closed');

		await vi.advanceTimersByTimeAsync(50);

		expect(screen.getByTestId('item-home')).toHaveAttribute('data-state', 'open');
		expect(screen.getByTestId('item-home')).toHaveAttribute('data-side', 'top');
	});
});

// ---------------------------------------------------------------------------
// RTL (T008, quickstart V-8)
// ---------------------------------------------------------------------------

describe('SpeedDial in RTL (T008, US3, FR-017)', () => {
	it.each(SPEED_DIAL_SIDES)('keeps data-side unmirrored for side=%s', (side) => {
		renderDial({ open: true, side, dir: 'rtl' });

		const content = screen.getByTestId('content');
		expect(content).toHaveAttribute('data-side', side);
		expect(content).toHaveAttribute('aria-orientation', getOrientation(side));
		expect(content).toHaveAttribute('data-orientation', getOrientation(side));
	});

	it('runs the Tab-exit sequence identically', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderDial({ defaultOpen: true, dir: 'rtl', withSiblings: true, onOpenChange });

		screen.getByTestId('action-edit').focus();
		await user.tab();

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});

// ---------------------------------------------------------------------------
// Convergence coverage (T024-T032): documented behaviour that ships but had no assertion
// ---------------------------------------------------------------------------

describe('SpeedDial content hover handlers run first (T024, FR-010a)', () => {
	it('runs the caller onmouseenter and onmouseleave before the hover-close cancel and schedule', async () => {
		setupFakeTimers();
		const seen: string[] = [];

		renderDial({
			defaultOpen: true,
			activationMode: 'hover',
			onOpenChange: (open) => seen.push(`open:${open}`),
			onContentMouseEnter: () => seen.push('enter'),
			onContentMouseLeave: () => seen.push('leave')
		});

		const content = screen.getByTestId('content');
		dispatchMouse(content, 'mouseenter');
		dispatchMouse(content, 'mouseleave');
		await vi.advanceTimersByTimeAsync(DEFAULT_HOVER_CLOSE_DELAY);

		expect(seen).toEqual(['enter', 'leave', 'open:false']);
	});

	it('lets a cancelable content mouseenter suppress the hover-close cancel', async () => {
		setupFakeTimers();
		const onOpenChange = vi.fn();

		renderDial({
			defaultOpen: true,
			activationMode: 'hover',
			onOpenChange,
			onContentMouseEnter: (event) => event.preventDefault()
		});

		const content = screen.getByTestId('content');
		// Leaving schedules the close, and the suppressed re-entry must not cancel it.
		dispatchMouse(content, 'mouseleave');
		dispatchMouse(content, 'mouseenter');
		await vi.advanceTimersByTimeAsync(DEFAULT_HOVER_CLOSE_DELAY);

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('lets a cancelable content mouseleave suppress the hover-close schedule', async () => {
		setupFakeTimers();
		const onOpenChange = vi.fn();

		renderDial({
			defaultOpen: true,
			activationMode: 'hover',
			onOpenChange,
			onContentMouseLeave: (event) => event.preventDefault()
		});

		dispatchMouse(screen.getByTestId('content'), 'mouseleave');
		await vi.advanceTimersByTimeAsync(1000);

		expect(onOpenChange).not.toHaveBeenCalled();
	});
});

describe('SpeedDial action selection order (T025, FR-010, contracts §5)', () => {
	it('runs the caller onclick, then dispatches the selection, then closes', async () => {
		const user = userEvent.setup();
		const seen: string[] = [];

		renderDial({
			defaultOpen: true,
			onOpenChange: (open) => seen.push(`open:${open}`),
			items: [
				{
					key: 'home',
					label: 'Home',
					onclick: () => seen.push('click'),
					onSelect: () => seen.push('select')
				}
			]
		});

		await user.click(screen.getByTestId('action-home'));

		expect(seen).toEqual(['click', 'select', 'open:false']);
	});

	it('lets the caller onclick suppress both the selection and the close', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		const onSelect = vi.fn();
		const onclick = vi.fn((event: MouseEvent) => event.preventDefault());

		renderDial({
			defaultOpen: true,
			onOpenChange,
			items: [{ key: 'home', label: 'Home', onclick, onSelect }]
		});

		await user.click(screen.getByTestId('action-home'));

		expect(onclick).toHaveBeenCalledTimes(1);
		expect(onSelect).not.toHaveBeenCalled();
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it('keeps the dial open when onSelect prevents default, with the caller onclick still run', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		const onclick = vi.fn();
		const onSelect = vi.fn((event: Event) => event.preventDefault());

		renderDial({
			defaultOpen: true,
			onOpenChange,
			items: [{ key: 'home', label: 'Home', onclick, onSelect }]
		});

		await user.click(screen.getByTestId('action-home'));

		expect(onclick).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(screen.getByTestId('content')).toBeInTheDocument();
	});
});

describe('SpeedDial trigger disabled (T026, FR-006)', () => {
	it('disables the trigger alone, without marking the root disabled', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderDial({ triggerDisabled: true, onOpenChange });

		const trigger = screen.getByTestId('trigger');
		expect(trigger).toBeDisabled();
		expect(screen.getByTestId('root')).not.toHaveAttribute('data-disabled');

		await user.click(trigger);

		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it('suppresses hover activation from a disabled trigger', async () => {
		setupFakeTimers();
		const onOpenChange = vi.fn();
		renderDial({ triggerDisabled: true, activationMode: 'hover', delay: 10, onOpenChange });

		dispatchMouse(screen.getByTestId('trigger'), 'mouseenter');
		await vi.advanceTimersByTimeAsync(1000);

		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it('drops the disabled trigger from the Tab boundary, promoting the first action', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderDial({ defaultOpen: true, triggerDisabled: true, withSiblings: true, onOpenChange });

		// With an enabled trigger this takes two Shift+Tabs (research R-06). A disabled trigger is
		// filtered out of `enabledNodeElements()`, so the first action is the boundary and one does it.
		screen.getByTestId('action-home').focus();
		await user.tab({ shift: true });

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});

describe('SpeedDial ref bindings (T027, SC-002)', () => {
	/** The harness reports its bindings through an effect, so the last report is the settled one. */
	function captureRefs(props: SpeedDialHarnessProps, seen: SpeedDialHarnessRefs[]) {
		renderDial({ ...props, onRefs: (refs) => seen.push({ ...refs }) });
		return seen[seen.length - 1];
	}

	it('binds ref on every part to the rendered element', () => {
		const seen: SpeedDialHarnessRefs[] = [];
		const refs = captureRefs({ defaultOpen: true, items: [{ key: 'home', label: 'Home' }] }, seen);

		expect(refs.root).toBe(screen.getByTestId('root'));
		expect(refs.trigger).toBe(screen.getByTestId('trigger'));
		expect(refs.content).toBe(screen.getByTestId('content'));
		expect(refs.item).toBe(screen.getByTestId('item-home'));
		expect(refs.action).toBe(screen.getByTestId('action-home'));
		expect(refs.label).toBe(screen.getByTestId('label-home'));
	});

	it('leaves ref null in child mode, where the caller owns the element', () => {
		const seen: SpeedDialHarnessRefs[] = [];
		const refs = captureRefs(
			{
				defaultOpen: true,
				items: [{ key: 'home', label: 'Home' }],
				rootChild: true,
				triggerChild: true,
				contentChild: true,
				itemChild: true,
				actionChild: true,
				labelChild: true
			},
			seen
		);

		expect(screen.getByTestId('root-child')).toBeInTheDocument();
		expect(refs).toEqual({
			root: null,
			trigger: null,
			content: null,
			item: null,
			action: null,
			label: null
		});
	});
});

describe('SpeedDial click and hover timers coexist (T028, FR-004)', () => {
	it('cancels the pending hover timer on click without disabling hover for good', async () => {
		const user = setupFakeTimers();
		const onOpenChange = vi.fn();
		renderDial({ activationMode: 'hover', delay: 100, onOpenChange });

		const trigger = screen.getByTestId('trigger');

		// Hover arms the open timer; clicking halfway through opens immediately and cancels it.
		await user.hover(trigger);
		await vi.advanceTimersByTimeAsync(50);
		await user.click(trigger);
		expect(onOpenChange.mock.calls).toEqual([[true]]);

		// Closing again, then letting the cancelled timer's deadline pass: it must never fire.
		await user.click(trigger);
		await vi.advanceTimersByTimeAsync(500);
		expect(onOpenChange.mock.calls).toEqual([[true], [false]]);

		// Hover activation still works afterwards — the click cancelled a timer, not the mode.
		await user.unhover(trigger);
		await user.hover(trigger);
		await vi.advanceTimersByTimeAsync(100);

		expect(onOpenChange.mock.calls).toEqual([[true], [false], [true]]);
	});
});

describe('SpeedDial item style precedence (T031, FR-016a)', () => {
	it('lets the caller style override the item animation duration and delay', () => {
		renderDial({
			defaultOpen: true,
			itemStyle: '--speed-dial-animation-duration: 5ms; --speed-dial-delay: 999ms;'
		});

		// The middle item's stagger delay is 50ms whether the dial is opening or closing, so this
		// asserts precedence without depending on the animation frame.
		const style = styleOf(screen.getByTestId('item-share'));
		expect(style.lastIndexOf('--speed-dial-delay: 999ms')).toBeGreaterThan(
			style.indexOf('--speed-dial-delay: 50ms')
		);
		expect(style.lastIndexOf('--speed-dial-animation-duration: 5ms')).toBeGreaterThan(
			style.indexOf(`--speed-dial-animation-duration: ${DEFAULT_ANIMATION_DURATION}ms`)
		);
	});
});

describe('SpeedDial trigger and action props (T032, SC-002, contracts §2/§5)', () => {
	it('lets the caller override the generated trigger and action ids', () => {
		renderDial({
			defaultOpen: true,
			triggerId: 'my-trigger',
			items: [{ key: 'home', label: 'Home', id: 'my-action' }]
		});

		expect(screen.getByTestId('trigger')).toHaveAttribute('id', 'my-trigger');

		const action = screen.getByTestId('action-home');
		expect(action).toHaveAttribute('id', 'my-action');
		expect(action).toHaveAttribute('aria-labelledby', screen.getByTestId('label-home').id);
		expect(action).toHaveAccessibleName('Home');
	});

	it('forwards variant and size to the button composed by the trigger and the action', () => {
		renderDial({
			defaultOpen: true,
			triggerVariant: 'secondary',
			triggerSize: 'sm',
			actionVariant: 'ghost',
			actionSize: 'sm',
			items: [{ key: 'home', label: 'Home' }]
		});

		const trigger = screen.getByTestId('trigger');
		expect(trigger).toHaveClass('bg-secondary');
		expect(trigger).not.toHaveClass('bg-primary');
		expect(trigger).toHaveClass('gap-1', 'px-2.5');

		const action = screen.getByTestId('action-home');
		expect(action).toHaveClass('hover:bg-muted');
		expect(action).not.toHaveClass('border-border');
		expect(action).toHaveClass('gap-1', 'px-2.5');
	});
});
