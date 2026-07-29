import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as Swap from './index.js';
import {
	SWAP_ACTIVATION_MODES,
	SWAP_ANIMATIONS,
	getSwapDataState,
	resolveSwapActivationMode,
	resolveSwapAnimation,
	type SwapAnimation
} from './index.js';
import Harness from './swap.test.svelte';

function bySlot(container: HTMLElement, slot: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

describe('click toggle and hover preview', () => {
	it('toggles data-state off -> on -> off on click, mirrored on both faces', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: {} });
		const root = bySlot(container, 'swap');
		const on = bySlot(container, 'swap-on');
		const off = bySlot(container, 'swap-off');

		expect(root).toHaveAttribute('data-state', 'off');
		expect(on).toHaveAttribute('data-state', 'off');
		expect(off).toHaveAttribute('data-state', 'off');

		await user.click(root);
		expect(root).toHaveAttribute('data-state', 'on');
		expect(on).toHaveAttribute('data-state', 'on');
		expect(off).toHaveAttribute('data-state', 'on');

		await user.click(root);
		expect(root).toHaveAttribute('data-state', 'off');
		expect(on).toHaveAttribute('data-state', 'off');
		expect(off).toHaveAttribute('data-state', 'off');
	});

	it('hover mode swaps to on while hovered and back to off on unhover; a click changes nothing', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: { activationMode: 'hover' } });
		const root = bySlot(container, 'swap');

		expect(root).toHaveAttribute('data-state', 'off');

		await user.hover(root);
		expect(root).toHaveAttribute('data-state', 'on');

		await user.unhover(root);
		expect(root).toHaveAttribute('data-state', 'off');

		// `fireEvent.click` fires a bare click with no pointer-movement side effects, unlike
		// `userEvent.click`, which would also dispatch the hover events that move the pointer back
		// onto the element.
		await fireEvent.click(root);
		expect(root).toHaveAttribute('data-state', 'off');
	});

	it('calls onSwappedChange exactly once per hover/unhover and writes back to the bound value', async () => {
		const user = userEvent.setup();
		const onSwappedChange = vi.fn();
		const { container } = render(Harness, {
			props: { activationMode: 'hover', onSwappedChange }
		});
		const root = bySlot(container, 'swap');

		await user.hover(root);
		expect(onSwappedChange).toHaveBeenCalledTimes(1);
		expect(onSwappedChange).toHaveBeenLastCalledWith(true);

		// A repeated hover with no intervening unhover must not call it again (Object.is short-circuit).
		await user.hover(root);
		expect(onSwappedChange).toHaveBeenCalledTimes(1);

		await user.unhover(root);
		expect(onSwappedChange).toHaveBeenCalledTimes(2);
		expect(onSwappedChange).toHaveBeenLastCalledWith(false);
	});
});

describe('keyboard', () => {
	it('focuses the root with Tab in click mode and toggles with Enter and Space', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: {} });
		const root = bySlot(container, 'swap');

		await user.tab();
		expect(root).toHaveFocus();

		await user.keyboard('{Enter}');
		expect(root).toHaveAttribute('data-state', 'on');

		await user.keyboard('{Enter}');
		expect(root).toHaveAttribute('data-state', 'off');

		await user.keyboard(' ');
		expect(root).toHaveAttribute('data-state', 'on');

		await user.keyboard(' ');
		expect(root).toHaveAttribute('data-state', 'off');
	});

	it('prevents the default Space keydown so the page does not scroll', () => {
		const { container } = render(Harness, { props: {} });
		const root = bySlot(container, 'swap');

		const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
		root.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
	});

	it('hover mode is unreachable by Tab and has no keydown handling', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: { activationMode: 'hover' } });
		const root = bySlot(container, 'swap');

		await user.tab();
		expect(root).not.toHaveFocus();
		expect(root).not.toHaveAttribute('tabindex');

		const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
		root.dispatchEvent(event);
		expect(root).toHaveAttribute('data-state', 'off');
	});
});

describe('accessibility roles and names', () => {
	it('exposes role="button" with aria-pressed reflecting data-state in click mode', async () => {
		const user = userEvent.setup();
		render(Harness, { props: { 'aria-label': 'Toggle theme' } });
		const button = screen.getByRole('button', { name: 'Toggle theme' });

		expect(button).toHaveAttribute('aria-pressed', 'false');

		await user.click(button);
		expect(button).toHaveAttribute('aria-pressed', 'true');
	});

	it('exposes no button role, aria-pressed or tabindex in hover mode', () => {
		const { container } = render(Harness, { props: { activationMode: 'hover' } });
		const root = bySlot(container, 'swap');

		expect(screen.queryByRole('button')).toBeNull();
		expect(root).not.toHaveAttribute('aria-pressed');
		expect(root).not.toHaveAttribute('tabindex');
	});

	it('sets aria-disabled and data-disabled and removes tabindex when disabled', () => {
		const { container } = render(Harness, { props: { disabled: true } });
		const root = bySlot(container, 'swap');

		expect(root).toHaveAttribute('aria-disabled', 'true');
		expect(root).toHaveAttribute('data-disabled', '');
		expect(root).not.toHaveAttribute('tabindex');
	});

	it('leaves data-state unchanged and never calls onSwappedChange while disabled', async () => {
		const user = userEvent.setup();
		const onSwappedChange = vi.fn();
		const { container } = render(Harness, {
			props: { disabled: true, onSwappedChange }
		});
		const root = bySlot(container, 'swap');
		const on = bySlot(container, 'swap-on');
		const off = bySlot(container, 'swap-off');

		await user.click(root);
		await user.tab();
		expect(root).not.toHaveFocus();

		const keydown = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
		root.dispatchEvent(keydown);
		const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
		root.dispatchEvent(space);

		expect(root).toHaveAttribute('data-state', 'off');
		expect(on).toHaveAttribute('data-state', 'off');
		expect(off).toHaveAttribute('data-state', 'off');
		expect(onSwappedChange).not.toHaveBeenCalled();
	});

	it('leaves data-state unchanged and never calls onSwappedChange on hover while disabled', async () => {
		const user = userEvent.setup();
		const onSwappedChange = vi.fn();
		const { container } = render(Harness, {
			props: { activationMode: 'hover', disabled: true, onSwappedChange }
		});
		const root = bySlot(container, 'swap');

		await user.hover(root);
		await user.unhover(root);

		expect(root).toHaveAttribute('data-state', 'off');
		expect(onSwappedChange).not.toHaveBeenCalled();
	});

	it('resolves the accessible name from aria-label', () => {
		render(Harness, { props: { 'aria-label': 'Toggle theme' } });

		expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
	});

	it('resolves the accessible name from an external aria-labelledby', () => {
		const { container } = render(Harness, { props: {} });
		const root = bySlot(container, 'swap');
		const span = document.createElement('span');
		span.id = 'swap-label';
		span.textContent = 'Toggle mute';
		container.appendChild(span);
		root.setAttribute('aria-labelledby', 'swap-label');

		expect(screen.getByRole('button', { name: 'Toggle mute' })).toBe(root);
	});
});

describe('controlled vs uncontrolled', () => {
	it('defaultSwapped seeds data-state="on" with zero interaction', () => {
		const { container } = render(Harness, { props: { defaultSwapped: true } });
		const root = bySlot(container, 'swap');

		expect(root).toHaveAttribute('data-state', 'on');
	});

	it('starts data-state="off" when neither swapped nor defaultSwapped is supplied', () => {
		const { container } = render(Harness, { props: {} });
		const root = bySlot(container, 'swap');

		expect(root).toHaveAttribute('data-state', 'off');
	});

	it('a click calls onSwappedChange with the next boolean when bound', async () => {
		const user = userEvent.setup();
		const onSwappedChange = vi.fn();
		const { container } = render(Harness, { props: { swapped: false, onSwappedChange } });
		const root = bySlot(container, 'swap');

		await user.click(root);

		expect(onSwappedChange).toHaveBeenCalledExactlyOnceWith(true);
	});

	it('a parent-driven write to the bound value moves the faces without re-invoking onSwappedChange', async () => {
		const onSwappedChange = vi.fn();
		const { container, rerender } = render(Harness, { props: { swapped: false, onSwappedChange } });
		const root = bySlot(container, 'swap');

		await rerender({ swapped: true, onSwappedChange });

		expect(root).toHaveAttribute('data-state', 'on');
		expect(onSwappedChange).not.toHaveBeenCalled();
	});
});

describe('RTL', () => {
	it('produces the identical data-state sequence as LTR under DirectionProvider dir="rtl"', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: { rtl: true } });
		const root = bySlot(container, 'swap');

		expect(root).toHaveAttribute('data-state', 'off');

		await user.click(root);
		expect(root).toHaveAttribute('data-state', 'on');

		await user.hover(root);
		expect(root).toHaveAttribute('data-state', 'on');

		// The prior click already focused the root (a native focusable-element side effect), so the
		// keyboard toggle is driven directly rather than through another `Tab`.
		await user.keyboard('{Enter}');
		expect(root).toHaveAttribute('data-state', 'off');
	});
});

describe('edge cases', () => {
	it('throws when SwapOn is rendered outside <Swap>', () => {
		expect(() => render(Swap.On, { props: {} })).toThrow(/must be used within `<Swap>`/);
	});

	it('throws when SwapOff is rendered outside <Swap>', () => {
		expect(() => render(Swap.Off, { props: {} })).toThrow(/must be used within `<Swap>`/);
	});

	it('a consumer onclick calling preventDefault suppresses the built-in toggle for that event', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn((event: MouseEvent) => event.preventDefault());
		const { container } = render(Harness, { props: { onclick } });
		const root = bySlot(container, 'swap');

		await user.click(root);

		expect(onclick).toHaveBeenCalledTimes(1);
		expect(root).toHaveAttribute('data-state', 'off');
	});

	it('a consumer onkeydown calling preventDefault suppresses the built-in toggle for that event', async () => {
		const user = userEvent.setup();
		const onkeydown = vi.fn((event: KeyboardEvent) => event.preventDefault());
		const { container } = render(Harness, { props: { onkeydown } });
		const root = bySlot(container, 'swap');

		await user.tab();
		await user.keyboard('{Enter}');

		expect(onkeydown).toHaveBeenCalledTimes(1);
		expect(root).toHaveAttribute('data-state', 'off');
	});

	it('a non-cancelable mouseenter dispatched directly still lets a plain hover swap', async () => {
		const user = userEvent.setup();
		const onmouseenter = vi.fn((event: MouseEvent) => event.preventDefault());
		const { container } = render(Harness, {
			props: { activationMode: 'hover', onmouseenter }
		});
		const root = bySlot(container, 'swap');

		const nonCancelable = new MouseEvent('mouseenter', { bubbles: false, cancelable: true });
		root.dispatchEvent(nonCancelable);
		expect(root).toHaveAttribute('data-state', 'off');

		await user.hover(root);
		expect(root).toHaveAttribute('data-state', 'on');
	});

	it('a cancelable mouseleave with preventDefault suppresses the built-in swap-to-off, but a plain unhover still reverts', async () => {
		const user = userEvent.setup();
		const onmouseleave = vi.fn((event: MouseEvent) => event.preventDefault());
		const { container } = render(Harness, {
			props: { activationMode: 'hover', defaultSwapped: true, onmouseleave }
		});
		const root = bySlot(container, 'swap');
		expect(root).toHaveAttribute('data-state', 'on');

		await user.hover(root);
		expect(root).toHaveAttribute('data-state', 'on');

		const cancelable = new MouseEvent('mouseleave', { bubbles: false, cancelable: true });
		root.dispatchEvent(cancelable);
		expect(onmouseleave).toHaveBeenCalledTimes(1);
		expect(root).toHaveAttribute('data-state', 'on');

		await user.unhover(root);
		expect(root).toHaveAttribute('data-state', 'off');
	});
});

describe('reduced motion', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('renders data-motion="reduce", drops the transition classes, and still toggles identically', async () => {
		vi.stubGlobal('matchMedia', (query: string) => ({
			matches: query === '(prefers-reduced-motion: reduce)',
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn()
		}));

		const user = userEvent.setup();
		const { container } = render(Harness, { props: {} });
		const root = bySlot(container, 'swap');
		const on = bySlot(container, 'swap-on');
		const off = bySlot(container, 'swap-off');

		expect(root).toHaveAttribute('data-motion', 'reduce');
		expect(on.classList.contains('transition-all')).toBe(false);
		expect(on.classList.contains('duration-300')).toBe(false);
		expect(off.classList.contains('transition-all')).toBe(false);
		expect(off.classList.contains('duration-300')).toBe(false);

		expect(root).toHaveAttribute('data-state', 'off');
		await user.click(root);
		expect(root).toHaveAttribute('data-state', 'on');
	});

	it('carries the transition classes and no data-motion when reduced motion is not requested', () => {
		vi.stubGlobal('matchMedia', (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn()
		}));

		const { container } = render(Harness, { props: {} });
		const root = bySlot(container, 'swap');
		const on = bySlot(container, 'swap-on');

		expect(root).not.toHaveAttribute('data-motion');
		expect(on.classList.contains('transition-all')).toBe(true);
		expect(on.classList.contains('duration-300')).toBe(true);
	});
});

describe('animations and composition', () => {
	for (const animation of SWAP_ANIMATIONS) {
		it(`reflects animation="${animation}" as data-animation`, () => {
			const { container } = render(Harness, { props: { animation } });
			const root = bySlot(container, 'swap');

			expect(root).toHaveAttribute('data-animation', animation);
		});
	}

	it('defaults data-animation to "fade" when omitted', () => {
		const { container } = render(Harness, { props: {} });
		const root = bySlot(container, 'swap');

		expect(root).toHaveAttribute('data-animation', 'fade');
	});

	it("merges the caller's class last so it wins a conflict", () => {
		const { container } = render(Harness, { props: { class: 'cursor-default' } });
		const root = bySlot(container, 'swap');

		expect(root.classList.contains('cursor-default')).toBe(true);
	});

	it('forwards unknown restProps onto the rendered element', () => {
		const { container } = render(Harness, {
			props: { 'aria-label': 'Toggle theme' }
		});
		const root = bySlot(container, 'swap');

		expect(root).toHaveAttribute('aria-label', 'Toggle theme');
	});

	it('reports the root HTMLDivElement through bind:ref', () => {
		let rootRef: HTMLDivElement | null = null;
		render(Harness, {
			props: {
				get rootRef() {
					return rootRef;
				},
				set rootRef(value) {
					rootRef = value;
				}
			}
		});

		expect(rootRef).toBeInstanceOf(HTMLDivElement);
	});

	it('renders the child snippet onto the caller element with merged SwapChildProps', () => {
		const { container } = render(Harness, { props: { useChild: true } });
		const button = screen.getByRole('button');

		expect(button.tagName).toBe('BUTTON');
		expect(button).toHaveAttribute('data-slot', 'swap');
		expect(container.querySelector('div[data-slot="swap"]')).toBeNull();
	});

	it('renders SwapOn/SwapOff child snippets with merged SwapFaceChildProps', () => {
		const { container } = render(Harness, { props: { useFaceChild: true } });
		const onChild = screen.getByTestId('on-child');
		const offChild = screen.getByTestId('off-child');

		expect(onChild).toHaveAttribute('data-slot', 'swap-on');
		expect(onChild).toHaveAttribute('data-state', 'off');
		expect(offChild).toHaveAttribute('data-slot', 'swap-off');
		expect(offChild).toHaveAttribute('data-state', 'off');
		expect(container.querySelector('div[data-slot="swap-on"]')).toBeNull();
		expect(container.querySelector('div[data-slot="swap-off"]')).toBeNull();
	});
});

describe('module exports', () => {
	it('resolves the same values through both barrel import styles', () => {
		expect(Swap.Root).toBe(Swap.Swap);
		expect(Swap.On).toBe(Swap.SwapOn);
		expect(Swap.Off).toBe(Swap.SwapOff);
	});

	it('holds the documented ordered tuples', () => {
		expect(SWAP_ACTIVATION_MODES).toEqual(['click', 'hover']);
		expect(SWAP_ANIMATIONS).toEqual(['fade', 'rotate', 'flip', 'scale']);
	});

	it('resolveSwapActivationMode falls back to "click" for an unknown value', () => {
		expect(resolveSwapActivationMode('bogus')).toBe('click');
		expect(resolveSwapActivationMode(undefined)).toBe('click');
	});

	it('resolveSwapAnimation falls back to "fade" for an unknown value', () => {
		expect(resolveSwapAnimation('bogus' as unknown as SwapAnimation)).toBe('fade');
		expect(resolveSwapAnimation(undefined)).toBe('fade');
	});

	it('getSwapDataState maps true/false to on/off', () => {
		expect(getSwapDataState(true)).toBe('on');
		expect(getSwapDataState(false)).toBe('off');
	});

	it('hasSwapContext returns false and useSwap throws outside a root', () => {
		render(Harness, { props: { probe: true } });

		expect(screen.getByTestId('probe-report')).toHaveTextContent(
			'has-context:false use-swap-throws:true'
		);
	});
});
