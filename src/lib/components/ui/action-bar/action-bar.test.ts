import { buttonVariants } from '$lib/components/ui/button/index.js';
import { cn } from '$lib/utils.js';
import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	ACTION_BAR_ENTRY_FOCUS,
	ACTION_BAR_ITEM_SELECT,
	DEFAULT_ALIGN_OFFSET,
	DEFAULT_SIDE_OFFSET,
	FLOATING_ALIGNMENTS,
	FLOATING_ORIENTATIONS,
	FLOATING_SIDES,
	floatingSurfaceVariants,
	focusFirst,
	getDirectionAwareKey,
	getFocusIntent,
	getViewportEdgeStyle,
	wrapArray
} from './index.js';
import Harness, {
	ACTION_BAR_HARNESS_ITEMS,
	type ActionBarHarnessItem,
	type ActionBarHarnessProps
} from './action-bar.test.svelte';

/** Nodes a spec appended to `document.body` itself, torn down after testing-library's cleanup. */
const hosts: HTMLElement[] = [];

afterEach(() => {
	for (const host of hosts.splice(0)) host.remove();
});

function createHost(): HTMLElement {
	const host = document.createElement('div');
	document.body.appendChild(host);
	hosts.push(host);
	return host;
}

function renderBar(props: ActionBarHarnessProps = {}) {
	return render(Harness, { props });
}

/** The action bar is portalled outside the render container, so every query goes through `screen`. */
function toolbar(): HTMLElement {
	return screen.getByRole('toolbar');
}

function bySlot(slot: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function button(name: string): HTMLElement {
	return screen.getByRole('button', { name });
}

/** `style` is written with `setAttribute`, so the raw string is the reliable thing to assert on. */
function styleOf(element: HTMLElement): string {
	return element.getAttribute('style') ?? '';
}

/** Records every `keydown` that reaches the document, so `defaultPrevented` can be inspected. */
function recordKeydown(): { events: KeyboardEvent[]; stop: () => void } {
	const events: KeyboardEvent[] = [];
	const listener = (event: Event) => events.push(event as KeyboardEvent);
	document.addEventListener('keydown', listener);
	return { events, stop: () => document.removeEventListener('keydown', listener) };
}

const DISABLED_MIDDLE: readonly ActionBarHarnessItem[] = [
	{ key: 'duplicate', label: 'Duplicate' },
	{ key: 'archive', label: 'Archive', disabled: true },
	{ key: 'delete', label: 'Delete' }
];

// ---------------------------------------------------------------------------
// T008b — pure helpers of the two shared modules (FR-016, keyboard-map §helpers)
// ---------------------------------------------------------------------------

describe('action bar shared helpers (T008b, FR-016)', () => {
	it('enumerates the documented sides, alignments and orientations', () => {
		expect(FLOATING_SIDES).toEqual(['top', 'bottom']);
		expect(FLOATING_ALIGNMENTS).toEqual(['start', 'center', 'end']);
		expect(FLOATING_ORIENTATIONS).toEqual(['horizontal', 'vertical']);
		expect(DEFAULT_SIDE_OFFSET).toBe(16);
		expect(DEFAULT_ALIGN_OFFSET).toBe(0);
	});

	it('anchors a centred bar to the bottom edge by default', () => {
		expect(
			getViewportEdgeStyle({
				side: 'bottom',
				sideOffset: DEFAULT_SIDE_OFFSET,
				align: 'center',
				alignOffset: DEFAULT_ALIGN_OFFSET
			})
		).toBe('bottom: 16px; left: 50%; translate: -50% 0;');
	});

	it('anchors to the top edge for side="top"', () => {
		expect(
			getViewportEdgeStyle({ side: 'top', sideOffset: 16, align: 'center', alignOffset: 0 })
		).toBe('top: 16px; left: 50%; translate: -50% 0;');
	});

	it('measures align="start" from the left edge and drops the centring translate', () => {
		expect(
			getViewportEdgeStyle({ side: 'bottom', sideOffset: 16, align: 'start', alignOffset: 24 })
		).toBe('bottom: 16px; left: 24px;');
	});

	it('measures align="end" from the right edge', () => {
		expect(
			getViewportEdgeStyle({ side: 'bottom', sideOffset: 16, align: 'end', alignOffset: 24 })
		).toBe('bottom: 16px; right: 24px;');
	});

	it('emits a zero side offset verbatim', () => {
		expect(
			getViewportEdgeStyle({ side: 'bottom', sideOffset: 0, align: 'center', alignOffset: 0 })
		).toBe('bottom: 0px; left: 50%; translate: -50% 0;');
	});

	it('swaps only the two horizontal arrows, and only under rtl', () => {
		expect(getDirectionAwareKey('ArrowLeft', 'rtl')).toBe('ArrowRight');
		expect(getDirectionAwareKey('ArrowRight', 'rtl')).toBe('ArrowLeft');
		expect(getDirectionAwareKey('ArrowUp', 'rtl')).toBe('ArrowUp');
		expect(getDirectionAwareKey('Home', 'rtl')).toBe('Home');
		expect(getDirectionAwareKey('ArrowLeft', 'ltr')).toBe('ArrowLeft');
		expect(getDirectionAwareKey('ArrowRight', undefined)).toBe('ArrowRight');
	});

	it('rotates an array without losing or duplicating an entry', () => {
		expect(wrapArray(['a', 'b', 'c'], 0)).toEqual(['a', 'b', 'c']);
		expect(wrapArray(['a', 'b', 'c'], 1)).toEqual(['b', 'c', 'a']);
		expect(wrapArray(['a', 'b', 'c'], 2)).toEqual(['c', 'a', 'b']);
	});

	it('wraps a start index beyond the array length modulo its length', () => {
		expect(wrapArray(['a', 'b', 'c'], 4)).toEqual(['b', 'c', 'a']);
		expect(wrapArray([], 3)).toEqual([]);
	});

	it('maps every navigation key onto an intent for a horizontal group', () => {
		expect(getFocusIntent('ArrowLeft', 'horizontal', 'ltr')).toBe('prev');
		expect(getFocusIntent('ArrowRight', 'horizontal', 'ltr')).toBe('next');
		expect(getFocusIntent('Home', 'horizontal', 'ltr')).toBe('first');
		expect(getFocusIntent('End', 'horizontal', 'ltr')).toBe('last');
		expect(getFocusIntent('ArrowUp', 'horizontal', 'ltr')).toBeUndefined();
		expect(getFocusIntent('ArrowDown', 'horizontal', 'ltr')).toBeUndefined();
	});

	it('maps every navigation key onto an intent for a vertical group', () => {
		expect(getFocusIntent('ArrowUp', 'vertical', 'ltr')).toBe('prev');
		expect(getFocusIntent('ArrowDown', 'vertical', 'ltr')).toBe('next');
		expect(getFocusIntent('Home', 'vertical', 'ltr')).toBe('first');
		expect(getFocusIntent('End', 'vertical', 'ltr')).toBe('last');
		expect(getFocusIntent('ArrowLeft', 'vertical', 'ltr')).toBeUndefined();
		expect(getFocusIntent('ArrowRight', 'vertical', 'ltr')).toBeUndefined();
	});

	it('inverts the horizontal intents under rtl and leaves Home/End alone', () => {
		expect(getFocusIntent('ArrowLeft', 'horizontal', 'rtl')).toBe('next');
		expect(getFocusIntent('ArrowRight', 'horizontal', 'rtl')).toBe('prev');
		expect(getFocusIntent('Home', 'horizontal', 'rtl')).toBe('first');
		expect(getFocusIntent('End', 'horizontal', 'rtl')).toBe('last');
		expect(getFocusIntent('ArrowUp', 'vertical', 'rtl')).toBe('prev');
		expect(getFocusIntent('ArrowDown', 'vertical', 'rtl')).toBe('next');
	});

	it('returns no intent for a key the toolbar pattern does not own', () => {
		expect(getFocusIntent('Enter', 'horizontal', 'ltr')).toBeUndefined();
		expect(getFocusIntent(' ', 'horizontal', 'ltr')).toBeUndefined();
		expect(getFocusIntent('Tab', 'vertical', 'rtl')).toBeUndefined();
	});

	it('skips a candidate the browser refuses to focus', () => {
		const attached = createHost().appendChild(document.createElement('button'));
		const detached = document.createElement('button');

		focusFirst([detached, attached]);

		expect(attached).toHaveFocus();
	});

	it('does nothing when the first candidate is already the active element', () => {
		const host = createHost();
		const first = host.appendChild(document.createElement('button'));
		const second = host.appendChild(document.createElement('button'));
		second.focus();

		focusFirst([second, first]);

		expect(second).toHaveFocus();
	});

	it('exposes the upstream event names', () => {
		expect(ACTION_BAR_ITEM_SELECT).toBe('actionbar.itemSelect');
		expect(ACTION_BAR_ENTRY_FOCUS).toBe('actionbarFocusGroup.onEntryFocus');
	});
});

// ---------------------------------------------------------------------------
// T004 — roles, ARIA and accessible names (keyboard-map §Roles)
// ---------------------------------------------------------------------------

describe('ActionBar roles and ARIA (T004, FR-001/FR-007/FR-010/FR-013)', () => {
	it('renders a toolbar carrying every documented attribute', () => {
		renderBar({ open: true });

		const bar = toolbar();
		expect(bar).toHaveAttribute('aria-orientation', 'horizontal');
		expect(bar).toHaveAttribute('data-slot', 'action-bar');
		expect(bar).toHaveAttribute('data-side', 'bottom');
		expect(bar).toHaveAttribute('data-align', 'center');
		expect(bar).toHaveAttribute('data-orientation', 'horizontal');
		expect(bar).toHaveAttribute('dir', 'ltr');
	});

	it('reflects side, align and orientation onto the root data attributes', () => {
		renderBar({ open: true, side: 'top', align: 'end', orientation: 'vertical' });

		const bar = toolbar();
		expect(bar).toHaveAttribute('data-side', 'top');
		expect(bar).toHaveAttribute('data-align', 'end');
		expect(bar).toHaveAttribute('data-orientation', 'vertical');
		expect(bar).toHaveAttribute('aria-orientation', 'vertical');
	});

	it('reflects an explicit rtl direction onto the root and the group', () => {
		renderBar({ open: true, dir: 'rtl' });

		expect(toolbar()).toHaveAttribute('dir', 'rtl');
		expect(bySlot('action-bar-group')).toHaveAttribute('dir', 'rtl');
	});

	it('marks the group as a role="group" tab stop', async () => {
		renderBar({ open: true });
		await tick();

		const group = screen.getByRole('group');
		expect(group).toHaveAttribute('data-slot', 'action-bar-group');
		expect(group).toHaveAttribute('data-orientation', 'horizontal');
		expect(group).toHaveAttribute('tabindex', '0');
	});

	it('hides the separator from the accessibility tree while keeping its role', () => {
		renderBar({ open: true });

		const separator = bySlot('action-bar-separator');
		expect(separator).toHaveAttribute('role', 'separator');
		expect(separator).toHaveAttribute('aria-hidden', 'true');
		expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
	});

	it('lets the separator override the inherited orientation', () => {
		renderBar({ open: true, separatorOrientation: 'vertical' });

		expect(bySlot('action-bar-separator')).toHaveAttribute('aria-orientation', 'vertical');
	});

	it('renders arbitrary children inside the selection pill', () => {
		renderBar({ open: true, selectionText: '4 selected' });

		const selection = bySlot('action-bar-selection');
		expect(selection).toHaveTextContent('4 selected');
	});

	it('renders every item as a native button named by its content', () => {
		renderBar({ open: true });

		for (const item of ACTION_BAR_HARNESS_ITEMS) {
			const element = button(item.label);
			expect(element).toHaveAttribute('type', 'button');
			expect(element).toHaveAttribute('data-slot', 'action-bar-item');
		}
	});

	it('marks a disabled item disabled and keeps it out of the tab order', async () => {
		renderBar({ open: true, items: DISABLED_MIDDLE });
		await tick();

		const disabled = button('Archive');
		expect(disabled).toBeDisabled();
		expect(disabled).toHaveAttribute('tabindex', '-1');
	});

	it('gives the icon-only close control its own accessible name and tab stop', () => {
		renderBar({ open: true });

		const close = button('Close');
		expect(close).toHaveAttribute('type', 'button');
		expect(close).toHaveAttribute('data-slot', 'action-bar-close');
		expect(close).not.toHaveAttribute('tabindex');
	});
});

// ---------------------------------------------------------------------------
// T005 — controlled and uncontrolled open state (keyboard-map §Controlled)
// ---------------------------------------------------------------------------

describe('ActionBar open state (T005, FR-002)', () => {
	it('renders nothing when neither open nor defaultOpen is supplied', () => {
		const { container } = renderBar({ binding: 'none' });

		expect(screen.queryByRole('toolbar')).toBeNull();
		expect(container.querySelector('[data-slot="action-bar"]')).toBeNull();
		expect(document.querySelector('[data-slot="action-bar"]')).toBeNull();
	});

	it('seeds itself from defaultOpen and closes on item activation when uncontrolled', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderBar({ binding: 'none', defaultOpen: true, onOpenChange });

		expect(toolbar()).toBeInTheDocument();

		await user.click(button('Duplicate'));

		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(screen.queryByRole('toolbar')).toBeNull();
	});

	it('closes on the close button when uncontrolled', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderBar({ binding: 'none', defaultOpen: true, onOpenChange });

		await user.click(button('Close'));

		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(screen.queryByRole('toolbar')).toBeNull();
	});

	it('closes on Escape when uncontrolled and drops its listener afterwards', async () => {
		const user = userEvent.setup();
		const onEscapeKeyDown = vi.fn();
		renderBar({ binding: 'none', defaultOpen: true, onEscapeKeyDown });

		await user.keyboard('{Escape}');

		expect(onEscapeKeyDown).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('toolbar')).toBeNull();

		await user.keyboard('{Escape}');

		expect(onEscapeKeyDown).toHaveBeenCalledTimes(1);
	});

	it('moves the parent binding and the rendered state together under bind:open', async () => {
		const user = userEvent.setup();
		const onOpenBinding = vi.fn();
		renderBar({ open: true, onOpenBinding });

		await user.click(button('Duplicate'));

		expect(onOpenBinding).toHaveBeenLastCalledWith(false);
		expect(screen.queryByRole('toolbar')).toBeNull();
	});

	it('stays open when an authoritative parent declines the write', async () => {
		const user = userEvent.setup();
		const onDeclinedOpen = vi.fn();
		const onOpenChange = vi.fn();
		renderBar({ binding: 'function', authoritativeOpen: true, onDeclinedOpen, onOpenChange });

		expect(toolbar()).toBeInTheDocument();

		await user.click(button('Duplicate'));

		expect(onDeclinedOpen).toHaveBeenCalledWith(false);
		expect(onOpenChange).toHaveBeenCalledWith(false);
		// The parent never wrote the new value back, so the bar does not move on its own.
		expect(toolbar()).toBeInTheDocument();
	});

	it('reports the selection through onSelect before closing', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		const onclick = vi.fn();
		renderBar({
			binding: 'none',
			defaultOpen: true,
			items: [{ key: 'duplicate', label: 'Duplicate', onSelect, onclick }]
		});

		await user.click(button('Duplicate'));

		expect(onclick).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledTimes(1);
		const event = onSelect.mock.calls[0]?.[0] as CustomEvent;
		expect(event.type).toBe(ACTION_BAR_ITEM_SELECT);
		expect(event.bubbles).toBe(true);
		expect(event.cancelable).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// T006 — keyboard interaction, dir="ltr" (contracts/keyboard-map.md)
// ---------------------------------------------------------------------------

describe('ActionBar keyboard navigation, ltr (T006, FR-010/FR-011/FR-012)', () => {
	it('treats the group as a single tab stop and moves on to the close button', async () => {
		const user = userEvent.setup();
		renderBar({ open: true });
		await tick();

		await user.tab();
		expect(button('Duplicate')).toHaveFocus();

		await user.tab();
		expect(button('Close')).toHaveFocus();
	});

	it('re-enters the group at the item that last held the tab stop', async () => {
		const user = userEvent.setup();
		renderBar({ open: true, withSiblings: true });
		await tick();

		// Focusing rather than clicking, because activating an item also closes the bar.
		button('Archive').focus();
		await tick();
		expect(button('Archive')).toHaveAttribute('tabindex', '0');

		// The bar is portalled to the end of `document.body`, so the last in-container button is the
		// tab stop immediately before the group.
		screen.getByTestId('after').focus();
		await user.tab();

		expect(button('Archive')).toHaveFocus();
	});

	it('drops the group tab stop while an item is tabbing back out', async () => {
		renderBar({ open: true });
		await tick();

		const group = screen.getByRole('group');
		expect(group).toHaveAttribute('tabindex', '0');

		// `user-event` cannot express "the keydown without its focus move", and the whole point of
		// `isTabbingBackOut` is the tabindex the browser reads *during* that default action.
		await fireEvent.keyDown(button('Duplicate'), { key: 'Tab', shiftKey: true });
		expect(group).toHaveAttribute('tabindex', '-1');

		await fireEvent.focusOut(group);
		expect(group).toHaveAttribute('tabindex', '0');
	});

	it('walks forward with ArrowRight and wraps at the end by default', async () => {
		const user = userEvent.setup();
		renderBar({ open: true });
		await tick();

		button('Duplicate').focus();
		await user.keyboard('{ArrowRight}');
		expect(button('Archive')).toHaveFocus();

		await user.keyboard('{ArrowRight}');
		expect(button('Delete')).toHaveFocus();

		await user.keyboard('{ArrowRight}');
		expect(button('Duplicate')).toHaveFocus();
	});

	it('walks backward with ArrowLeft and wraps at the start by default', async () => {
		const user = userEvent.setup();
		renderBar({ open: true });
		await tick();

		button('Duplicate').focus();
		await user.keyboard('{ArrowLeft}');
		expect(button('Delete')).toHaveFocus();

		await user.keyboard('{ArrowLeft}');
		expect(button('Archive')).toHaveFocus();
	});

	it('stops at both ends when loop is false', async () => {
		const user = userEvent.setup();
		renderBar({ open: true, loop: false });
		await tick();

		button('Delete').focus();
		await user.keyboard('{ArrowRight}');
		expect(button('Delete')).toHaveFocus();

		button('Duplicate').focus();
		await user.keyboard('{ArrowLeft}');
		expect(button('Duplicate')).toHaveFocus();
	});

	it('jumps to the first and last items with Home and End', async () => {
		const user = userEvent.setup();
		renderBar({ open: true });
		await tick();

		button('Archive').focus();
		await user.keyboard('{End}');
		expect(button('Delete')).toHaveFocus();

		await user.keyboard('{Home}');
		expect(button('Duplicate')).toHaveFocus();
	});

	it('skips a disabled item while walking', async () => {
		const user = userEvent.setup();
		renderBar({ open: true, items: DISABLED_MIDDLE });
		await tick();

		button('Duplicate').focus();
		await user.keyboard('{ArrowRight}');

		expect(button('Delete')).toHaveFocus();
	});

	it('lands Home and End on the first and last enabled items', async () => {
		const user = userEvent.setup();
		renderBar({
			open: true,
			items: [
				{ key: 'duplicate', label: 'Duplicate', disabled: true },
				{ key: 'archive', label: 'Archive' },
				{ key: 'delete', label: 'Delete', disabled: true }
			]
		});
		await tick();

		button('Archive').focus();
		await user.keyboard('{Home}');
		expect(button('Archive')).toHaveFocus();

		await user.keyboard('{End}');
		expect(button('Archive')).toHaveFocus();
	});

	it('ignores the wrong-axis arrows in a horizontal group', async () => {
		const user = userEvent.setup();
		renderBar({ open: true });
		await tick();

		button('Duplicate').focus();
		await user.keyboard('{ArrowDown}');
		expect(button('Duplicate')).toHaveFocus();

		await user.keyboard('{ArrowUp}');
		expect(button('Duplicate')).toHaveFocus();
	});

	it('navigates a vertical group with ArrowDown and ArrowUp only', async () => {
		const user = userEvent.setup();
		renderBar({ open: true, orientation: 'vertical' });
		await tick();

		button('Duplicate').focus();
		await user.keyboard('{ArrowDown}');
		expect(button('Archive')).toHaveFocus();

		await user.keyboard('{ArrowUp}');
		expect(button('Duplicate')).toHaveFocus();

		await user.keyboard('{ArrowRight}');
		expect(button('Duplicate')).toHaveFocus();

		await user.keyboard('{ArrowLeft}');
		expect(button('Duplicate')).toHaveFocus();
	});

	it('preventDefaults a navigating arrow but never a modified one', async () => {
		const user = userEvent.setup();
		renderBar({ open: true });
		await tick();

		const recorder = recordKeydown();
		try {
			button('Duplicate').focus();
			await user.keyboard('{ArrowRight}');
			expect(button('Archive')).toHaveFocus();
			expect(recorder.events.at(-1)?.defaultPrevented).toBe(true);

			await user.keyboard('{Control>}{ArrowRight}{/Control}');
			expect(button('Archive')).toHaveFocus();
			expect(recorder.events.at(-1)?.defaultPrevented).toBe(false);

			await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
			expect(button('Archive')).toHaveFocus();
			expect(recorder.events.at(-1)?.defaultPrevented).toBe(false);

			await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
			expect(button('Archive')).toHaveFocus();
			expect(recorder.events.at(-1)?.defaultPrevented).toBe(false);

			await user.keyboard('{Meta>}{ArrowRight}{/Meta}');
			expect(button('Archive')).toHaveFocus();
			expect(recorder.events.at(-1)?.defaultPrevented).toBe(false);
		} finally {
			recorder.stop();
		}
	});

	it('activates the focused item with Enter through native button semantics', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		renderBar({
			binding: 'none',
			defaultOpen: true,
			items: [{ key: 'duplicate', label: 'Duplicate', onSelect }]
		});
		await tick();

		button('Duplicate').focus();
		await user.keyboard('{Enter}');

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('toolbar')).toBeNull();
	});

	it('activates the focused item with Space through native button semantics', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		renderBar({
			binding: 'none',
			defaultOpen: true,
			items: [{ key: 'duplicate', label: 'Duplicate', onSelect }]
		});
		await tick();

		button('Duplicate').focus();
		await user.keyboard(' ');

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('toolbar')).toBeNull();
	});

	it('preventDefaults a mousedown on a disabled item and keeps the tab stop where it was', async () => {
		renderBar({ open: true, items: DISABLED_MIDDLE });
		await tick();

		// Focusing rather than clicking, because activating an item also closes the bar.
		button('Duplicate').focus();
		await tick();
		expect(button('Duplicate')).toHaveAttribute('tabindex', '0');

		// `user-event` dispatches no mouse event at a disabled control, so this one branch is driven
		// by an explicit dispatch.
		const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
		button('Archive').dispatchEvent(event);
		await tick();

		expect(event.defaultPrevented).toBe(true);
		expect(button('Duplicate')).toHaveAttribute('tabindex', '0');
		expect(button('Archive')).toHaveAttribute('tabindex', '-1');
	});
});

// ---------------------------------------------------------------------------
// T007 — RTL inversion (keyboard-map §rtl, FR-005/FR-015)
// ---------------------------------------------------------------------------

describe('ActionBar keyboard navigation, rtl (T007, FR-005/FR-015)', () => {
	it('inverts the horizontal arrows under an explicit dir="rtl"', async () => {
		const user = userEvent.setup();
		renderBar({ open: true, dir: 'rtl' });
		await tick();

		button('Duplicate').focus();
		await user.keyboard('{ArrowLeft}');
		expect(button('Archive')).toHaveFocus();

		await user.keyboard('{ArrowRight}');
		expect(button('Duplicate')).toHaveFocus();
	});

	it('leaves Home and End in document order under rtl', async () => {
		const user = userEvent.setup();
		renderBar({ open: true, dir: 'rtl' });
		await tick();

		button('Archive').focus();
		await user.keyboard('{End}');
		expect(button('Delete')).toHaveFocus();

		await user.keyboard('{Home}');
		expect(button('Duplicate')).toHaveFocus();
	});

	it('inherits rtl from a DirectionProvider ancestor with no dir prop', async () => {
		const user = userEvent.setup();
		renderBar({ open: true, providerDir: 'rtl' });
		await tick();

		expect(toolbar()).toHaveAttribute('dir', 'rtl');

		button('Duplicate').focus();
		await user.keyboard('{ArrowLeft}');
		expect(button('Archive')).toHaveFocus();
	});
});

// ---------------------------------------------------------------------------
// T008 — edge cases, portalling and guard rails
// ---------------------------------------------------------------------------

describe('ActionBar portalling (T008, FR-001)', () => {
	it('mounts the toolbar under document.body, outside the render container', () => {
		const { container } = renderBar({ open: true });

		const bar = toolbar();
		expect(container).not.toContainElement(bar);
		expect(document.body).toContainElement(bar);
	});

	it('mounts the toolbar inside a caller-supplied element', () => {
		const host = createHost();
		renderBar({ open: true, portalContainer: host });

		expect(host.querySelector('[data-slot="action-bar"]')).not.toBeNull();
	});

	it('falls back to document.body for portalContainer={null}', () => {
		renderBar({ open: true, portalContainer: null });

		expect(document.body).toContainElement(toolbar());
	});

	it('portals into a DocumentFragment through a display:contents host', async () => {
		const fragment = document.createDocumentFragment();
		renderBar({ open: true, portalContainer: fragment });
		await tick();

		const host = fragment.firstElementChild as HTMLElement | null;
		expect(host).not.toBeNull();
		expect(host?.style.display).toBe('contents');
		expect(host?.querySelector('[data-slot="action-bar"]')).not.toBeNull();
	});

	it('removes the toolbar synchronously when open flips to false', async () => {
		const user = userEvent.setup();
		renderBar({ binding: 'none', defaultOpen: true });

		expect(document.querySelectorAll('[data-slot="action-bar"]')).toHaveLength(1);

		await user.click(button('Close'));

		expect(document.querySelectorAll('[data-slot="action-bar"]')).toHaveLength(0);
	});
});

describe('ActionBar edge cases (T008)', () => {
	it('keeps the bar open when onSelect calls preventDefault', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderBar({
			binding: 'none',
			defaultOpen: true,
			onOpenChange,
			items: [{ key: 'duplicate', label: 'Duplicate', onSelect: (event) => event.preventDefault() }]
		});

		await user.click(button('Duplicate'));

		expect(onOpenChange).not.toHaveBeenCalled();
		expect(toolbar()).toBeInTheDocument();
	});

	it('keeps the bar open when the item click handler calls preventDefault', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		const onOpenChange = vi.fn();
		renderBar({
			binding: 'none',
			defaultOpen: true,
			onOpenChange,
			items: [
				{
					key: 'duplicate',
					label: 'Duplicate',
					onSelect,
					onclick: (event) => event.preventDefault()
				}
			]
		});

		await user.click(button('Duplicate'));

		expect(onSelect).not.toHaveBeenCalled();
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(toolbar()).toBeInTheDocument();
	});

	it('keeps the bar open when the close handler calls preventDefault', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderBar({
			binding: 'none',
			defaultOpen: true,
			onOpenChange,
			onCloseClick: (event) => event.preventDefault()
		});

		await user.click(button('Close'));

		expect(onOpenChange).not.toHaveBeenCalled();
		expect(toolbar()).toBeInTheDocument();
	});

	it('keeps the bar open when onEscapeKeyDown calls preventDefault', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderBar({
			binding: 'none',
			defaultOpen: true,
			onOpenChange,
			onEscapeKeyDown: (event) => event.preventDefault()
		});

		await user.keyboard('{Escape}');

		expect(onOpenChange).not.toHaveBeenCalled();
		expect(toolbar()).toBeInTheDocument();
	});

	it('is not a tab stop when the group holds no focusable item', async () => {
		renderBar({ open: true, items: [] });
		await tick();

		expect(screen.getByRole('group')).toHaveAttribute('tabindex', '-1');
	});

	it('is not a tab stop when every item is disabled', async () => {
		renderBar({
			open: true,
			items: [
				{ key: 'duplicate', label: 'Duplicate', disabled: true },
				{ key: 'archive', label: 'Archive', disabled: true }
			]
		});
		await tick();

		expect(screen.getByRole('group')).toHaveAttribute('tabindex', '-1');
	});

	it('renders each part onto a caller-owned element through the child snippet', async () => {
		const onRefs = vi.fn();
		renderBar({
			open: true,
			rootChild: true,
			selectionChild: true,
			separatorChild: true,
			groupChild: true,
			closeChild: true,
			onRefs
		});
		await tick();

		expect(screen.getByTestId('root-child')).toHaveAttribute('role', 'toolbar');
		expect(screen.getByTestId('selection-child')).toHaveAttribute(
			'data-slot',
			'action-bar-selection'
		);
		expect(screen.getByTestId('separator-child')).toHaveAttribute('role', 'separator');
		expect(screen.getByTestId('group-child')).toHaveAttribute('role', 'group');
		expect(screen.getByTestId('close-child')).toHaveAttribute('data-slot', 'action-bar-close');
		// The caller owns every element, so no part populates `ref`.
		expect(onRefs).toHaveBeenLastCalledWith({
			root: null,
			selection: null,
			separator: null,
			group: null,
			item: expect.anything(),
			close: null
		});
	});

	it('leaves the group without a tab stop when its items render through child', async () => {
		renderBar({ open: true, itemChild: true });
		await tick();

		expect(screen.getByTestId('item-child')).toHaveAttribute('data-slot', 'action-bar-item');
		// A `child` item owns no element, so it never registers with the roving-focus collection.
		expect(screen.getByRole('group')).toHaveAttribute('tabindex', '-1');
	});
});

describe('ActionBar guard rails (T008, FR-014)', () => {
	it('throws when the group has no ActionBar ancestor', () => {
		expect(() => renderBar({ mode: 'bare-group' })).toThrow(
			/`<ActionBar.Group>` must be used within `<ActionBar>`/
		);
	});

	it('throws when an item has no ActionBar ancestor', () => {
		expect(() => renderBar({ mode: 'bare-item' })).toThrow(
			/`<ActionBar.Item>` must be used within `<ActionBar>`/
		);
	});

	it('throws when the close button has no ActionBar ancestor', () => {
		expect(() => renderBar({ mode: 'bare-close' })).toThrow(
			/`<ActionBar.Close>` must be used within `<ActionBar>`/
		);
	});

	it('throws when the separator has no ActionBar ancestor', () => {
		expect(() => renderBar({ mode: 'bare-separator' })).toThrow(
			/`<ActionBar.Separator>` must be used within `<ActionBar>`/
		);
	});

	it('throws when an item sits inside the bar but outside a group', () => {
		expect(() => renderBar({ open: true, mode: 'item-outside-group' })).toThrow(
			/`<ActionBar.Item>` must be used within `<ActionBar.Group>`/
		);
	});
});

// ---------------------------------------------------------------------------
// T008a — viewport positioning and the vertical layout (keyboard-map §Positioning)
// ---------------------------------------------------------------------------

describe('ActionBar positioning (T008a, FR-003/FR-004)', () => {
	it('docks to the bottom centre of the viewport by default', () => {
		renderBar({ open: true });

		expect(styleOf(toolbar())).toBe('bottom: 16px; left: 50%; translate: -50% 0;');
	});

	it('docks to the top edge for side="top"', () => {
		renderBar({ open: true, side: 'top' });

		expect(styleOf(toolbar())).toBe('top: 16px; left: 50%; translate: -50% 0;');
	});

	it('measures align="start" from the left edge with no centring translate', () => {
		renderBar({ open: true, align: 'start', alignOffset: 24 });

		expect(styleOf(toolbar())).toBe('bottom: 16px; left: 24px;');
	});

	it('measures align="end" from the right edge', () => {
		renderBar({ open: true, align: 'end', alignOffset: 24 });

		expect(styleOf(toolbar())).toBe('bottom: 16px; right: 24px;');
	});

	it('honours a zero side offset', () => {
		renderBar({ open: true, sideOffset: 0 });

		expect(styleOf(toolbar())).toBe('bottom: 0px; left: 50%; translate: -50% 0;');
	});

	it('lets a caller style win because it is applied last', () => {
		renderBar({ open: true, rootStyle: 'bottom: 99px;' });

		// Svelte re-serialises a spread `style`, collapsing the duplicated declaration onto the
		// winning value — which is the caller's, because theirs is appended after the edge style.
		const bar = toolbar();
		expect(styleOf(bar)).toContain('bottom: 99px');
		expect(styleOf(bar)).not.toContain('bottom: 16px');
		expect(bar.style.bottom).toBe('99px');
		// The declarations the caller did not override survive.
		expect(styleOf(bar)).toContain('left: 50%');
	});

	it('merges a caller class after the recipe', () => {
		renderBar({ open: true, rootClass: 'custom-bar' });

		expect(toolbar()).toHaveClass('custom-bar');
	});

	it('lays a vertical bar out as a column and stretches every item', () => {
		renderBar({ open: true, orientation: 'vertical' });

		expect(toolbar()).toHaveClass('flex-col');
		const group = bySlot('action-bar-group');
		expect(group).toHaveClass('flex-col', 'w-full', 'items-start');
		expect(button('Duplicate')).toHaveClass('w-full');
	});

	it('lays a horizontal bar out as a row', () => {
		renderBar({ open: true });

		expect(toolbar()).toHaveClass('flex-row');
		expect(bySlot('action-bar-group')).toHaveClass('items-center');
		expect(button('Duplicate')).not.toHaveClass('w-full');
	});
});

// ---------------------------------------------------------------------------
// T027 — the group's entry-focus contract (public-api §ActionBarGroup)
// ---------------------------------------------------------------------------

/** Records every `actionbarFocusGroup.onEntryFocus` reaching `group`, with the focus owner at dispatch. */
function recordEntryFocus(
	group: HTMLElement,
	onEvent?: (event: CustomEvent) => void
): { events: CustomEvent[]; activeAtDispatch: (Element | null)[] } {
	const events: CustomEvent[] = [];
	const activeAtDispatch: (Element | null)[] = [];
	group.addEventListener(ACTION_BAR_ENTRY_FOCUS, (event) => {
		events.push(event as CustomEvent);
		activeAtDispatch.push(document.activeElement);
		onEvent?.(event as CustomEvent);
	});
	return { events, activeAtDispatch };
}

describe('ActionBarGroup entry focus (T027, SC-003)', () => {
	it('dispatches a cancelable, non-bubbling entry-focus event before redirecting focus', async () => {
		renderBar({ open: true });
		await tick();

		const group = screen.getByRole('group');
		const entry = recordEntryFocus(group);

		group.focus();
		await tick();

		expect(entry.events).toHaveLength(1);
		expect(entry.events[0]?.type).toBe(ACTION_BAR_ENTRY_FOCUS);
		expect(entry.events[0]?.bubbles).toBe(false);
		expect(entry.events[0]?.cancelable).toBe(true);
		// Dispatched *before* the redirect: the group still owns focus at that instant.
		expect(entry.activeAtDispatch[0]).toBe(group);
		expect(button('Duplicate')).toHaveFocus();
	});

	it('redirects to the item that already owns the tab stop rather than the first one', async () => {
		renderBar({ open: true, withSiblings: true });
		await tick();

		button('Archive').focus();
		await tick();
		screen.getByTestId('after').focus();
		await tick();

		const group = screen.getByRole('group');
		const entry = recordEntryFocus(group);

		group.focus();
		await tick();

		expect(entry.events).toHaveLength(1);
		expect(button('Archive')).toHaveFocus();
	});

	it('leaves focus on the group when the entry-focus event is prevented', async () => {
		renderBar({ open: true });
		await tick();

		const group = screen.getByRole('group');
		const entry = recordEntryFocus(group, (event) => event.preventDefault());

		group.focus();
		await tick();

		expect(entry.events).toHaveLength(1);
		expect(group).toHaveFocus();
		for (const item of ACTION_BAR_HARNESS_ITEMS) {
			expect(button(item.label)).not.toHaveFocus();
		}
	});

	it('suppresses the entry redirect when focus follows a mousedown, then clears the flag', async () => {
		renderBar({ open: true });
		await tick();

		const group = screen.getByRole('group');
		const entry = recordEntryFocus(group);

		// A click landing on the group itself: upstream's `isClickFocus` branch, which must neither
		// announce an entry nor steal focus onto an item.
		await fireEvent.mouseDown(group);
		group.focus();
		await tick();

		expect(entry.events).toHaveLength(0);
		expect(group).toHaveFocus();

		// The flag is one-shot, so the next keyboard entry redirects again.
		button('Close').focus();
		await tick();
		group.focus();
		await tick();

		expect(entry.events).toHaveLength(1);
		expect(button('Duplicate')).toHaveFocus();
	});
});

// ---------------------------------------------------------------------------
// T028 — caller handlers run first and `defaultPrevented` short-circuits the part
// ---------------------------------------------------------------------------

/**
 * `focusin`/`focusout`/`focus` are not cancelable when the browser fires them, so the one thing a
 * real focus move cannot exercise is the `defaultPrevented` early-return. These specs dispatch the
 * same event shape with `cancelable: true` to reach that branch.
 */
function dispatchCancelableFocus(element: HTMLElement, type: 'focus' | 'focusin' | 'focusout') {
	element.dispatchEvent(new FocusEvent(type, { bubbles: type !== 'focus', cancelable: true }));
}

describe('ActionBarGroup caller handlers (T028, SC-003)', () => {
	it('forwards focusin, focusout and mousedown to the caller', async () => {
		const onGroupFocusIn = vi.fn();
		const onGroupFocusOut = vi.fn();
		const onGroupMouseDown = vi.fn();
		renderBar({ open: true, onGroupFocusIn, onGroupFocusOut, onGroupMouseDown });
		await tick();

		const group = screen.getByRole('group');
		await fireEvent.mouseDown(group);
		group.focus();
		await tick();
		button('Close').focus();
		await tick();

		expect(onGroupMouseDown).toHaveBeenCalledTimes(1);
		// One for the group entry, one for the redirect landing on the first item (`focusin` bubbles).
		expect(onGroupFocusIn).toHaveBeenCalled();
		expect(onGroupFocusOut).toHaveBeenCalled();
	});

	it('skips the entry redirect when the caller prevents focusin', async () => {
		const onGroupFocusIn = vi.fn((event: FocusEvent) => event.preventDefault());
		renderBar({ open: true, onGroupFocusIn });
		await tick();

		const group = screen.getByRole('group');
		const entry = recordEntryFocus(group);

		dispatchCancelableFocus(group, 'focusin');
		await tick();

		expect(onGroupFocusIn).toHaveBeenCalledTimes(1);
		expect(entry.events).toHaveLength(0);
		expect(button('Duplicate')).not.toHaveFocus();
	});

	it('keeps the tabbing-back-out flag when the caller prevents focusout', async () => {
		const onGroupFocusOut = vi.fn((event: FocusEvent) => event.preventDefault());
		renderBar({ open: true, onGroupFocusOut });
		await tick();

		const group = screen.getByRole('group');
		await fireEvent.keyDown(button('Duplicate'), { key: 'Tab', shiftKey: true });
		expect(group).toHaveAttribute('tabindex', '-1');

		dispatchCancelableFocus(group, 'focusout');
		await tick();

		expect(onGroupFocusOut).toHaveBeenCalledTimes(1);
		expect(group).toHaveAttribute('tabindex', '-1');
	});

	it('never sets the click-focus flag when the caller prevents mousedown', async () => {
		const onGroupMouseDown = vi.fn((event: MouseEvent) => event.preventDefault());
		renderBar({ open: true, onGroupMouseDown });
		await tick();

		const group = screen.getByRole('group');
		await fireEvent.mouseDown(group);
		group.focus();
		await tick();

		expect(onGroupMouseDown).toHaveBeenCalledTimes(1);
		// The flag was never set, so this still counts as a keyboard entry and redirects.
		expect(button('Duplicate')).toHaveFocus();
	});
});

describe('ActionBarItem caller handlers (T028, SC-003)', () => {
	it('claims the tab stop on focus and on mousedown, and forwards both to the caller', async () => {
		const onfocus = vi.fn();
		const onmousedown = vi.fn();
		renderBar({
			open: true,
			items: [
				{ key: 'duplicate', label: 'Duplicate' },
				{ key: 'archive', label: 'Archive', onfocus, onmousedown }
			]
		});
		await tick();

		button('Archive').focus();
		await tick();
		expect(onfocus).toHaveBeenCalledTimes(1);
		expect(button('Archive')).toHaveAttribute('tabindex', '0');

		button('Duplicate').focus();
		await tick();
		await fireEvent.mouseDown(button('Archive'));
		await tick();

		expect(onmousedown).toHaveBeenCalledTimes(1);
		expect(button('Archive')).toHaveAttribute('tabindex', '0');
		expect(button('Duplicate')).toHaveAttribute('tabindex', '-1');
	});

	it('leaves the tab stop alone when the caller prevents focus', async () => {
		const onfocus = vi.fn((event: FocusEvent) => event.preventDefault());
		renderBar({
			open: true,
			items: [
				{ key: 'duplicate', label: 'Duplicate' },
				{ key: 'archive', label: 'Archive', onfocus }
			]
		});
		await tick();

		button('Duplicate').focus();
		await tick();
		expect(button('Duplicate')).toHaveAttribute('tabindex', '0');

		dispatchCancelableFocus(button('Archive'), 'focus');
		await tick();

		expect(onfocus).toHaveBeenCalledTimes(1);
		expect(button('Archive')).toHaveAttribute('tabindex', '-1');
		expect(button('Duplicate')).toHaveAttribute('tabindex', '0');
	});

	it('leaves the tab stop alone when the caller prevents mousedown', async () => {
		const onmousedown = vi.fn((event: MouseEvent) => event.preventDefault());
		renderBar({
			open: true,
			items: [
				{ key: 'duplicate', label: 'Duplicate' },
				{ key: 'archive', label: 'Archive', onmousedown }
			]
		});
		await tick();

		button('Duplicate').focus();
		await tick();
		await fireEvent.mouseDown(button('Archive'));
		await tick();

		expect(onmousedown).toHaveBeenCalledTimes(1);
		expect(button('Archive')).toHaveAttribute('tabindex', '-1');
		expect(button('Duplicate')).toHaveAttribute('tabindex', '0');
	});

	it('performs no arrow navigation when the caller prevents keydown', async () => {
		const user = userEvent.setup();
		const onkeydown = vi.fn((event: KeyboardEvent) => event.preventDefault());
		renderBar({
			open: true,
			items: [
				{ key: 'duplicate', label: 'Duplicate', onkeydown },
				{ key: 'archive', label: 'Archive' }
			]
		});
		await tick();

		button('Duplicate').focus();
		await user.keyboard('{ArrowRight}');

		expect(onkeydown).toHaveBeenCalledTimes(1);
		expect(button('Duplicate')).toHaveFocus();
	});

	it('performs no shift-tab bookkeeping when the caller prevents keydown', async () => {
		const onkeydown = vi.fn((event: KeyboardEvent) => event.preventDefault());
		renderBar({ open: true, items: [{ key: 'duplicate', label: 'Duplicate', onkeydown }] });
		await tick();

		const group = screen.getByRole('group');
		await fireEvent.keyDown(button('Duplicate'), { key: 'Tab', shiftKey: true });

		expect(onkeydown).toHaveBeenCalledTimes(1);
		// `isTabbingBackOut` was never set, so the group keeps its tab stop.
		expect(group).toHaveAttribute('tabindex', '0');
	});
});

// ---------------------------------------------------------------------------
// T029 — the item composes the button primitive (FR-011)
// ---------------------------------------------------------------------------

describe('ActionBarItem button composition (T029, FR-011)', () => {
	it('defaults to the secondary variant at the small size', async () => {
		renderBar({ open: true });
		await tick();

		const item = button('Duplicate');
		expect(item.getAttribute('class')).toBe(
			cn(buttonVariants({ variant: 'secondary', size: 'sm' }))
		);
		expect(item).toHaveClass('bg-secondary', 'text-secondary-foreground', 'h-7');
		expect(item).toHaveAttribute('data-slot', 'action-bar-item');
		expect(item).toHaveAttribute('tabindex', '-1');
	});

	it('lets a caller variant and size replace the defaults without disturbing the item wiring', async () => {
		renderBar({
			open: true,
			orientation: 'vertical',
			items: [{ key: 'delete', label: 'Delete', variant: 'destructive', size: 'lg' }]
		});
		await tick();

		const item = button('Delete');
		expect(item.getAttribute('class')).toBe(
			cn(buttonVariants({ variant: 'destructive', size: 'lg' }), 'w-full')
		);
		expect(item).toHaveClass('text-destructive', 'h-9');
		expect(item).not.toHaveClass('bg-secondary');
		expect(item).not.toHaveClass('h-7');

		// Everything the item owns is untouched by the button variant it was handed.
		expect(item).toHaveAttribute('data-slot', 'action-bar-item');
		expect(item).toHaveClass('w-full');
		item.focus();
		await tick();
		expect(item).toHaveAttribute('tabindex', '0');
	});
});

// ---------------------------------------------------------------------------
// T030 — enter transition, exit half and reduced motion (FR-008)
// ---------------------------------------------------------------------------

const ENTER_CLASSES = [
	'animate-in',
	'fade-in-0',
	'zoom-in-95',
	'data-[side=bottom]:slide-in-from-bottom-4',
	'data-[side=top]:slide-in-from-top-4'
] as const;

const EXIT_CLASSES = [
	'data-[state=closed]:animate-out',
	'data-[state=closed]:fade-out-0',
	'data-[state=closed]:zoom-out-95',
	'data-[state=closed]:data-[side=bottom]:slide-out-to-bottom-4',
	'data-[state=closed]:data-[side=top]:slide-out-to-top-4'
] as const;

describe('ActionBar transition (T030, FR-008)', () => {
	it('enters with the documented animation and stands down under reduced motion', () => {
		renderBar({ open: true });

		expect(toolbar()).toHaveClass(...ENTER_CLASSES, 'motion-reduce:animate-none');
	});

	it('keeps both halves of the transition in the exported recipe', () => {
		const recipe = floatingSurfaceVariants({ orientation: 'horizontal' });

		for (const className of ENTER_CLASSES) expect(recipe).toContain(className);
		// The exit half is inert here — `ActionBar` unmounts synchronously (FR-001) — but a consumer
		// that keeps the surface mounted while closing gets a real exit animation from it (FR-016).
		for (const className of EXIT_CLASSES) expect(recipe).toContain(className);
		expect(recipe).toContain('motion-reduce:animate-none');
	});
});

// ---------------------------------------------------------------------------
// T031 — the CSS-selector portal target ([svelte] divergence over upstream)
// ---------------------------------------------------------------------------

describe('ActionBar portalContainer as a selector (T031)', () => {
	it('mounts the toolbar inside the element a CSS selector resolves to', () => {
		const host = createHost();
		host.id = 'action-bar-host';

		renderBar({ open: true, portalContainer: '#action-bar-host' });

		expect(host.querySelector('[data-slot="action-bar"]')).not.toBeNull();
		expect(host).toContainElement(toolbar());
	});
});

// ---------------------------------------------------------------------------
// T032 — ActionBarSelection is the one part with no provider requirement (FR-014)
// ---------------------------------------------------------------------------

describe('ActionBarSelection outside a provider (T032, FR-014)', () => {
	it('renders with no ActionBar ancestor instead of throwing', () => {
		expect(() => renderBar({ mode: 'bare-selection', selectionText: '3 selected' })).not.toThrow();

		const selection = bySlot('action-bar-selection');
		expect(selection).toHaveTextContent('3 selected');
	});
});
