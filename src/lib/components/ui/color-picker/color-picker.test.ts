import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	Area,
	AlphaSlider,
	Content,
	EyeDropper,
	FormatSelect,
	HueSlider,
	Input,
	InputField,
	Swatch,
	Trigger,
	type EyeDropperApi
} from './index.js';
import Harness, { type ColorPickerHarnessProps } from './color-picker.test.svelte';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** The reference colour used by the upstream docs and demos. */
const BLUE = '#3b82f6';

function renderPicker(props: ColorPickerHarnessProps = {}) {
	return render(Harness, { props });
}

/** Everything inside the panel is always mounted in `inline` mode — no portal, no floating layer. */
function renderInline(props: ColorPickerHarnessProps = {}) {
	return renderPicker({ inline: true, defaultValue: BLUE, ...props });
}

function querySlot(slot: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
}

function bySlot(slot: string): HTMLElement {
	const element = querySlot(slot);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function area(): HTMLElement {
	return screen.getByTestId('area');
}

function field(label: string): HTMLInputElement {
	const element = screen.getByLabelText(label);
	if (!(element instanceof HTMLInputElement)) {
		throw new Error(`the "${label}" field did not render an <input>`);
	}
	return element;
}

/** The thumb of a `bits-ui` slider carries the `role="slider"` semantics, not its root. */
function thumb(slot: 'hue' | 'alpha'): HTMLElement {
	return bySlot(`color-picker-${slot}-slider-thumb`);
}

/**
 * jsdom performs no layout, so every `getBoundingClientRect()` answers with an all-zero box and the
 * area's pointer maths would have nothing to divide by. Every pointer test states the geometry it
 * is pretending to have.
 */
function stubRect(element: HTMLElement, rect: Partial<DOMRect>): void {
	const full = { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, ...rect };
	vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
		...full,
		toJSON: () => full
	} as DOMRect);
}

function drag(element: HTMLElement, clientX: number, clientY: number): void {
	fireEvent.pointerDown(element, { pointerId: 1, clientX, clientY });
	fireEvent.pointerMove(element, { pointerId: 1, clientX, clientY });
	fireEvent.pointerUp(element, { pointerId: 1, clientX, clientY });
}

/** Open the popover from the trigger and wait for the floating content to mount. */
async function openPanel(user: ReturnType<typeof userEvent.setup>): Promise<void> {
	await user.click(screen.getByTestId('trigger'));
	await waitFor(() => expect(querySlot('color-picker-content')).not.toBeNull());
}

/** Install a fake `window.EyeDropper` that always resolves to `hex`. */
function stubEyeDropper(hex: string) {
	const open = vi.fn(async () => ({ sRGBHex: hex }));
	class FakeEyeDropper implements EyeDropperApi {
		open = open;
	}
	vi.stubGlobal('EyeDropper', FakeEyeDropper);
	window.EyeDropper = FakeEyeDropper as unknown as NonNullable<typeof window.EyeDropper>;
	return open;
}

afterEach(() => {
	delete window.EyeDropper;
	vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// roles, ARIA and accessible names (T005)
// ---------------------------------------------------------------------------

describe('roles and ARIA', () => {
	it('renders the trigger as a button reporting the popover state', async () => {
		const user = userEvent.setup();
		renderPicker({ defaultValue: BLUE });

		const trigger = screen.getByTestId('trigger');
		expect(trigger.tagName).toBe('BUTTON');
		expect(trigger).toHaveAttribute('type', 'button');
		expect(trigger).toHaveAttribute('aria-expanded', 'false');

		await openPanel(user);
		expect(trigger).toHaveAttribute('aria-expanded', 'true');
	});

	it('renders the popover content as a dialog, and the inline content as a plain container', async () => {
		const user = userEvent.setup();
		renderPicker({ defaultValue: BLUE });
		await openPanel(user);

		const content = bySlot('color-picker-content');
		expect(content).toHaveAttribute('role', 'dialog');
		expect(content).not.toHaveAttribute('data-inline');
	});

	it('marks the inline content with data-inline and gives it no dialog semantics', () => {
		renderInline();

		const content = bySlot('color-picker-content');
		expect(content).toHaveAttribute('data-inline', '');
		expect(content).not.toHaveAttribute('role');
	});

	it('exposes the area as a slider on the saturation axis with a describing valuetext', () => {
		renderInline();

		expect(area()).toHaveAttribute('role', 'slider');
		expect(area()).toHaveAttribute('aria-valuemin', '0');
		expect(area()).toHaveAttribute('aria-valuemax', '100');
		expect(area()).toHaveAttribute('aria-valuenow', '76');
		expect(area()).toHaveAttribute('aria-valuetext', 'Saturation 76%, brightness 96%, #3b82f6');
		expect(area()).toHaveAttribute('aria-orientation', 'horizontal');
		expect(area()).toHaveAttribute('aria-label', 'Saturation and brightness');
		expect(area()).toHaveAttribute('tabindex', '0');
	});

	it('recomputes the area valuetext in the active format', () => {
		renderInline({ defaultFormat: 'rgb' });

		expect(area()).toHaveAttribute(
			'aria-valuetext',
			'Saturation 76%, brightness 96%, rgb(59, 130, 246)'
		);
	});

	it('names both slider thumbs and gives each a unit-bearing valuetext', () => {
		renderInline();

		expect(thumb('hue')).toHaveAttribute('role', 'slider');
		expect(thumb('hue')).toHaveAttribute('aria-label', 'Hue');
		expect(thumb('hue')).toHaveAttribute('aria-valuenow', '217');
		expect(thumb('hue')).toHaveAttribute('aria-valuetext', '217 degrees');
		expect(thumb('hue')).toHaveAttribute('aria-valuemax', '360');

		expect(thumb('alpha')).toHaveAttribute('role', 'slider');
		expect(thumb('alpha')).toHaveAttribute('aria-label', 'Alpha');
		expect(thumb('alpha')).toHaveAttribute('aria-valuetext', '100%');
		expect(thumb('alpha')).toHaveAttribute('aria-valuemax', '100');
	});

	it('exposes the format select as a combobox offering exactly the four formats', async () => {
		const user = userEvent.setup();
		renderInline();

		const trigger = screen.getByTestId('format');
		expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
		expect(trigger).toHaveAccessibleName('Color format');
		expect(trigger).toHaveTextContent('HEX');

		await user.click(trigger);
		await waitFor(() => expect(querySlot('color-picker-format-select')).not.toBeNull());

		const listbox = bySlot('color-picker-format-select');
		const options = within(listbox).getAllByRole('option', { hidden: true });
		expect(options.map((option) => option.textContent?.trim())).toEqual([
			'HEX',
			'RGB',
			'HSL',
			'HSB'
		]);
	});

	it('labels every input field of every format exactly as upstream does', () => {
		const { unmount } = renderInline();
		expect(field('Hex color value')).toHaveValue(BLUE);
		expect(field('Alpha transparency percentage')).toHaveValue('100');
		unmount();

		const rgb = renderInline({ defaultFormat: 'rgb' });
		expect(field('Red color component (0-255)')).toHaveValue('59');
		expect(field('Green color component (0-255)')).toHaveValue('130');
		expect(field('Blue color component (0-255)')).toHaveValue('246');
		rgb.unmount();

		const hsl = renderInline({ defaultFormat: 'hsl' });
		expect(field('Hue degree (0-360)')).toHaveValue('217');
		expect(field('Saturation percentage (0-100)')).toHaveValue('91');
		expect(field('Lightness percentage (0-100)')).toHaveValue('60');
		hsl.unmount();

		renderInline({ defaultFormat: 'hsb' });
		expect(field('Brightness percentage (0-100)')).toHaveValue('96');
	});

	it('marks every field with its channel and drops the alpha field on request', () => {
		const { unmount } = renderInline({ defaultFormat: 'rgb' });
		expect(
			Array.from(document.querySelectorAll('[data-slot="color-picker-input"]')).map((input) =>
				input.getAttribute('data-channel')
			)
		).toEqual(['r', 'g', 'b', 'a']);
		unmount();

		renderInline({ defaultFormat: 'rgb', withoutAlpha: true });
		expect(screen.queryByLabelText('Alpha transparency percentage')).toBeNull();
	});

	it('renders a lone unwrapped hex field for hex without alpha, matching upstream', () => {
		renderInline({ withoutAlpha: true });

		expect(querySlot('color-picker-input-wrapper')).toBeNull();
		expect(field('Hex color value')).toHaveClass('font-mono');
	});

	it('describes the swatch as an image naming the current colour', () => {
		renderInline();

		const swatch = screen.getByTestId('swatch');
		expect(swatch).toHaveAttribute('role', 'img');
		expect(swatch).toHaveAccessibleName(`Current color: ${BLUE}`);
	});

	it('announces an empty picker as having no colour selected', () => {
		renderInline({ defaultValue: '' });

		expect(screen.getByTestId('swatch')).toHaveAccessibleName('No color selected');
	});

	it('names the eyedropper button, which upstream leaves unnamed', () => {
		stubEyeDropper('#10b981');
		renderInline();

		expect(screen.getByTestId('eye-dropper')).toHaveAccessibleName('Pick a color from the screen');
	});
});

// ---------------------------------------------------------------------------
// keyboard (T006)
// ---------------------------------------------------------------------------

describe('keyboard', () => {
	it('opens the popover with Enter and with Space, and moves focus inside', async () => {
		const user = userEvent.setup();
		const { unmount } = renderPicker({ defaultValue: BLUE });

		screen.getByTestId('trigger').focus();
		await user.keyboard('{Enter}');
		await waitFor(() => expect(querySlot('color-picker-content')).not.toBeNull());
		await waitFor(() =>
			expect(bySlot('color-picker-content').contains(document.activeElement)).toBe(true)
		);
		unmount();

		renderPicker({ defaultValue: BLUE });
		screen.getByTestId('trigger').focus();
		await user.keyboard(' ');
		await waitFor(() => expect(querySlot('color-picker-content')).not.toBeNull());
	});

	it('closes on Escape and returns focus to the trigger', async () => {
		const user = userEvent.setup();
		renderPicker({ defaultValue: BLUE });

		await openPanel(user);
		await user.keyboard('{Escape}');

		await waitFor(() => expect(querySlot('color-picker-content')).toBeNull());
		await waitFor(() => expect(screen.getByTestId('trigger')).toHaveFocus());
	});

	it('moves saturation with the horizontal arrows and brightness with the vertical ones', async () => {
		const user = userEvent.setup();
		renderInline();

		area().focus();
		await user.keyboard('{ArrowRight}');
		expect(area()).toHaveAttribute('aria-valuenow', '77');

		await user.keyboard('{ArrowLeft}{ArrowLeft}');
		expect(area()).toHaveAttribute('aria-valuenow', '75');

		await user.keyboard('{ArrowDown}');
		expect(area()).toHaveAttribute('aria-valuetext', expect.stringContaining('brightness 95%'));

		await user.keyboard('{ArrowUp}');
		expect(area()).toHaveAttribute('aria-valuetext', expect.stringContaining('brightness 96%'));
	});

	it('honours a custom step and uses shiftStep while Shift is held', async () => {
		const user = userEvent.setup();
		renderInline({ step: 5, shiftStep: 25 });

		area().focus();
		await user.keyboard('{ArrowRight}');
		expect(area()).toHaveAttribute('aria-valuenow', '81');

		await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
		expect(area()).toHaveAttribute('aria-valuenow', '56');
	});

	it('snaps saturation to the ends with Home and End', async () => {
		const user = userEvent.setup();
		renderInline();

		area().focus();
		await user.keyboard('{Home}');
		expect(area()).toHaveAttribute('aria-valuenow', '0');

		await user.keyboard('{End}');
		expect(area()).toHaveAttribute('aria-valuenow', '100');
	});

	it('moves brightness by shiftStep with PageUp and PageDown, clamped to 0..100', async () => {
		const user = userEvent.setup();
		renderInline({ defaultValue: '#3b82f6', shiftStep: 10 });

		area().focus();
		await user.keyboard('{PageDown}');
		expect(area()).toHaveAttribute('aria-valuetext', expect.stringContaining('brightness 86%'));

		await user.keyboard('{PageUp}{PageUp}{PageUp}');
		expect(area()).toHaveAttribute('aria-valuetext', expect.stringContaining('brightness 100%'));

		await user.keyboard(
			'{PageDown}{PageDown}{PageDown}{PageDown}{PageDown}{PageDown}{PageDown}{PageDown}{PageDown}{PageDown}{PageDown}'
		);
		expect(area()).toHaveAttribute('aria-valuetext', expect.stringContaining('brightness 0%'));
	});

	it('prevents the default scroll for every key it handles, and only those', () => {
		renderInline();

		for (const key of [
			'ArrowLeft',
			'ArrowRight',
			'ArrowUp',
			'ArrowDown',
			'Home',
			'End',
			'PageUp',
			'PageDown'
		]) {
			const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
			area().dispatchEvent(event);
			expect(event.defaultPrevented).toBe(true);
		}

		const untouched = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
		area().dispatchEvent(untouched);
		expect(untouched.defaultPrevented).toBe(false);
	});

	it('drives the hue slider across its whole range from the keyboard', async () => {
		const user = userEvent.setup();
		renderInline();

		thumb('hue').focus();
		await user.keyboard('{ArrowRight}');
		expect(thumb('hue')).toHaveAttribute('aria-valuenow', '218');

		await user.keyboard('{Home}');
		expect(thumb('hue')).toHaveAttribute('aria-valuenow', '0');

		await user.keyboard('{End}');
		expect(thumb('hue')).toHaveAttribute('aria-valuenow', '360');
	});

	it('drives the alpha slider across its whole range from the keyboard', async () => {
		const user = userEvent.setup();
		renderInline();

		thumb('alpha').focus();
		await user.keyboard('{Home}');
		expect(thumb('alpha')).toHaveAttribute('aria-valuenow', '0');
		expect(thumb('alpha')).toHaveAttribute('aria-valuetext', '0%');

		await user.keyboard('{ArrowRight}{ArrowRight}');
		expect(thumb('alpha')).toHaveAttribute('aria-valuenow', '2');

		await user.keyboard('{End}');
		expect(thumb('alpha')).toHaveAttribute('aria-valuenow', '100');
	});

	it('walks the panel with Tab in DOM order and back again with Shift+Tab', async () => {
		const user = userEvent.setup();
		stubEyeDropper('#10b981');
		renderInline();

		// jsdom gives the floating popover wrapper `visibility: hidden`, which `userEvent` treats as
		// unfocusable, so the traversal is exercised in `inline` mode — the same parts, the same DOM
		// order, no floating layer. The trigger's own activation is covered above.
		area().focus();
		const order = [
			screen.getByTestId('eye-dropper'),
			thumb('hue'),
			thumb('alpha'),
			screen.getByTestId('format'),
			field('Hex color value'),
			field('Alpha transparency percentage')
		];

		for (const element of order) {
			await user.tab();
			expect(element).toHaveFocus();
		}

		for (const element of order.slice(0, -1).reverse()) {
			await user.tab({ shift: true });
			expect(element).toHaveFocus();
		}

		await user.tab({ shift: true });
		expect(area()).toHaveFocus();
	});
});

// ---------------------------------------------------------------------------
// controlled and uncontrolled (T007)
// ---------------------------------------------------------------------------

describe('controlled and uncontrolled', () => {
	it('seeds from defaultValue and then moves on its own', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderInline({ defaultValue: BLUE, onValueChange });

		expect(field('Hex color value')).toHaveValue(BLUE);

		area().focus();
		await user.keyboard('{Home}');

		expect(onValueChange).toHaveBeenCalledWith('#f5f5f5');
		expect(field('Hex color value')).toHaveValue('#f5f5f5');
	});

	it('defaults to black when neither value nor defaultValue is given', () => {
		renderInline({ defaultValue: undefined });

		expect(field('Hex color value')).toHaveValue('#000000');
	});

	it('seeds from defaultOpen and closes internally', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderPicker({ defaultOpen: true, onOpenChange });

		await waitFor(() => expect(querySlot('color-picker-content')).not.toBeNull());

		await user.keyboard('{Escape}');
		await waitFor(() => expect(querySlot('color-picker-content')).toBeNull());
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('seeds from defaultFormat and switches internally through the select', async () => {
		const user = userEvent.setup();
		const onFormatChange = vi.fn();
		renderInline({ defaultFormat: 'hex', onFormatChange });

		await user.click(screen.getByTestId('format'));
		await waitFor(() => expect(querySlot('color-picker-format-select')).not.toBeNull());
		await user.click(within(bySlot('color-picker-format-select')).getByText('RGB'));

		await waitFor(() => expect(onFormatChange).toHaveBeenCalledWith('rgb'));
		await waitFor(() =>
			expect(screen.queryByLabelText('Red color component (0-255)')).not.toBeNull()
		);
	});

	it('lets a bound parent accept every colour change', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderInline({ binding: 'value', value: BLUE, onValueChange });

		area().focus();
		await user.keyboard('{End}');

		expect(onValueChange).toHaveBeenCalledWith('#005ef5');
		expect(field('Hex color value')).toHaveValue('#005ef5');
	});

	it('leaves the colour where it was when the parent declines the write', async () => {
		const user = userEvent.setup();
		const onDeclinedValue = vi.fn();
		renderInline({ binding: 'function', authoritativeValue: BLUE, onDeclinedValue });

		expect(field('Hex color value')).toHaveValue(BLUE);

		area().focus();
		await user.keyboard('{Home}');

		expect(onDeclinedValue).toHaveBeenCalledWith('#f5f5f5');
		expect(field('Hex color value')).toHaveValue(BLUE);
		expect(area()).toHaveAttribute('aria-valuenow', '76');
	});

	it('adopts a colour handed in from outside, in any notation', async () => {
		const { rerender } = renderInline({ binding: 'controlled', value: BLUE });

		expect(field('Hex color value')).toHaveValue(BLUE);

		await rerender({ inline: true, binding: 'controlled', value: 'rgb(16, 185, 129)' });
		await waitFor(() => expect(field('Hex color value')).toHaveValue('#10b981'));

		await rerender({ inline: true, binding: 'controlled', value: 'hsl(217, 91%, 60%)' });
		await waitFor(() => expect(field('Hex color value')).toHaveValue('#3c83f6'));
	});

	it('keeps the current alpha when the incoming notation carries none', async () => {
		const { rerender } = renderInline({ binding: 'controlled', value: 'rgba(59, 130, 246, 0.5)' });

		expect(field('Alpha transparency percentage')).toHaveValue('50');

		await rerender({ inline: true, binding: 'controlled', value: '#10b981' });
		await waitFor(() => expect(field('Hex color value')).toHaveValue('#10b981'));
		expect(field('Alpha transparency percentage')).toHaveValue('50');
	});

	it('does not fire onValueChange for an open or a format change', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderPicker({ defaultValue: BLUE, onValueChange });

		await openPanel(user);
		expect(onValueChange).not.toHaveBeenCalled();

		await user.click(screen.getByTestId('format'));
		await waitFor(() => expect(querySlot('color-picker-format-select')).not.toBeNull());
		await user.click(within(bySlot('color-picker-format-select')).getByText('HSL'));

		await waitFor(() => expect(screen.queryByLabelText('Hue degree (0-360)')).not.toBeNull());
		expect(onValueChange).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// RTL (T008)
// ---------------------------------------------------------------------------

describe('right-to-left', () => {
	it('inverts the area’s horizontal arrows under dir="rtl"', async () => {
		const user = userEvent.setup();
		renderInline({ dir: 'rtl' });

		area().focus();
		await user.keyboard('{ArrowRight}');
		expect(area()).toHaveAttribute('aria-valuenow', '75');

		await user.keyboard('{ArrowLeft}{ArrowLeft}');
		expect(area()).toHaveAttribute('aria-valuenow', '77');
	});

	it('inverts the area’s horizontal arrows under a <DirectionProvider dir="rtl">', async () => {
		const user = userEvent.setup();
		renderInline({ providerDir: 'rtl' });

		area().focus();
		await user.keyboard('{ArrowRight}');
		expect(area()).toHaveAttribute('aria-valuenow', '75');
	});

	it('leaves the vertical arrows alone under rtl', async () => {
		const user = userEvent.setup();
		renderInline({ dir: 'rtl' });

		area().focus();
		await user.keyboard('{ArrowUp}');
		expect(area()).toHaveAttribute('aria-valuetext', expect.stringContaining('brightness 97%'));
	});

	it('mirrors the area’s pointer mapping and its crosshair under rtl', () => {
		const { unmount } = renderInline();
		stubRect(area(), { left: 0, top: 0, width: 200, height: 100 });
		drag(area(), 50, 50);
		expect(area()).toHaveAttribute('aria-valuenow', '25');
		// The crosshair, not only the value: an unmirrored layer would report 75 here and paint the
		// thumb on the opposite edge from the finger.
		expect(bySlot('color-picker-area-thumb')).toHaveStyle({ left: '25%', top: '50%' });
		unmount();

		renderInline({ dir: 'rtl' });
		stubRect(area(), { left: 0, top: 0, width: 200, height: 100 });
		drag(area(), 50, 50);
		expect(area()).toHaveAttribute('aria-valuenow', '75');

		const crosshair = bySlot('color-picker-area-thumb');
		expect(crosshair).toHaveStyle({ right: '75%', top: '50%' });
		expect(crosshair.style.left).toBe('');
	});

	it('mirrors the area’s saturation gradient under rtl', () => {
		const { unmount } = renderInline();
		expect(bySlot('color-picker-area-saturation').getAttribute('style')).toContain(
			'linear-gradient(to right, rgb(255, 255, 255), transparent)'
		);
		unmount();

		renderInline({ dir: 'rtl' });
		expect(bySlot('color-picker-area-saturation').getAttribute('style')).toContain(
			'linear-gradient(to left, rgb(255, 255, 255), transparent)'
		);
		// The brightness axis is unaffected — only the horizontal axis mirrors.
		expect(bySlot('color-picker-area-brightness').getAttribute('style')).toContain('to bottom');
	});

	it('mirrors both slider tracks under rtl, so each thumb sits over its own colour', () => {
		const { unmount } = renderInline();
		expect(bySlot('color-picker-hue-slider').getAttribute('style')).toContain(
			'linear-gradient(to right, rgb(255, 0, 0) 0%'
		);
		expect(bySlot('color-picker-alpha-slider').getAttribute('style')).toContain(
			'linear-gradient(to right, transparent, rgb(59, 130, 246))'
		);
		unmount();

		renderInline({ dir: 'rtl' });
		expect(bySlot('color-picker-hue-slider').getAttribute('style')).toContain(
			'linear-gradient(to left, rgb(255, 0, 0) 0%'
		);
		expect(bySlot('color-picker-alpha-slider').getAttribute('style')).toContain(
			'linear-gradient(to left, transparent, rgb(59, 130, 246))'
		);
	});

	it('inverts both sliders under rtl', async () => {
		const user = userEvent.setup();
		renderInline({ dir: 'rtl' });

		thumb('hue').focus();
		await user.keyboard('{ArrowRight}');
		expect(thumb('hue')).toHaveAttribute('aria-valuenow', '216');

		thumb('alpha').focus();
		await user.keyboard('{ArrowRight}');
		expect(thumb('alpha')).toHaveAttribute('aria-valuenow', '99');
	});
});

// ---------------------------------------------------------------------------
// child snippets (T008a)
// ---------------------------------------------------------------------------

describe('child snippets', () => {
	it('renders the root onto the caller’s element with the merged props', () => {
		renderInline({ mode: 'root-child' });

		const root = document.querySelector('[data-child-slot="root"]');
		expect(root?.tagName).toBe('SECTION');
		expect(root).toHaveAttribute('data-slot', 'color-picker');
		expect(root).toHaveAttribute('data-inline', '');
		expect(document.querySelector('div[data-slot="color-picker"]')).toBeNull();
	});

	it('renders the trigger onto the caller’s element and still opens the popover', async () => {
		const user = userEvent.setup();
		renderPicker({ mode: 'trigger-child', defaultValue: BLUE });

		const trigger = document.querySelector('[data-child-slot="trigger"]');
		expect(trigger).toHaveAttribute('data-slot', 'color-picker-trigger');
		expect(trigger).toHaveAttribute('aria-expanded', 'false');

		await user.click(trigger as HTMLElement);
		await waitFor(() => expect(querySlot('color-picker-content')).not.toBeNull());
		expect(trigger).toHaveAttribute('aria-expanded', 'true');
	});

	it('renders the inline content onto the caller’s element', () => {
		renderInline({ mode: 'content-child' });

		const content = document.querySelector('[data-child-slot="content"]');
		expect(content?.tagName).toBe('SECTION');
		expect(content).toHaveAttribute('data-slot', 'color-picker-content');
		expect(content).toHaveAttribute('data-inline', '');
		expect(area()).toBeInTheDocument();
	});

	it('renders the area onto the caller’s element, keyboard model intact', async () => {
		const user = userEvent.setup();
		renderInline({ mode: 'area-child' });

		const custom = document.querySelector('[data-child-slot="area"]');
		expect(custom?.tagName).toBe('SECTION');
		expect(custom).toHaveAttribute('role', 'slider');
		expect(custom).toHaveAttribute('aria-valuenow', '76');
		expect(querySlot('color-picker-area-thumb')).toBeNull();

		(custom as HTMLElement).focus();
		await user.keyboard('{Home}');
		expect(custom).toHaveAttribute('aria-valuenow', '0');
	});

	it('renders the swatch onto the caller’s element, accessible name intact', () => {
		renderInline({ mode: 'swatch-child' });

		const swatch = document.querySelector('[data-child-slot="swatch"]');
		expect(swatch?.tagName).toBe('SPAN');
		expect(swatch).toHaveAttribute('data-slot', 'color-picker-swatch');
		expect(swatch).toHaveAccessibleName(`Current color: ${BLUE}`);
	});

	it('renders the eyedropper onto the caller’s element and still samples', async () => {
		const user = userEvent.setup();
		const open = stubEyeDropper('#10b981');
		renderInline({ mode: 'eye-dropper-child' });

		const button = document.querySelector('[data-child-slot="eye-dropper"]');
		expect(button).toHaveAttribute('data-slot', 'color-picker-eye-dropper');

		await user.click(button as HTMLElement);
		await waitFor(() => expect(open).toHaveBeenCalled());
		await waitFor(() => expect(field('Hex color value')).toHaveValue('#10b981'));
	});

	it('renders the format select trigger onto the caller’s element', () => {
		renderInline({ mode: 'format-select-child' });

		const trigger = document.querySelector('[data-child-slot="format-select"]');
		expect(trigger).toHaveAttribute('data-slot', 'color-picker-format-select-trigger');
		expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
		expect(trigger).toHaveAccessibleName('Color format');
	});

	it('leaves ref null in child mode, matching the color-swatch precedent', () => {
		// `<ColorPicker.Input>` and `<ColorPicker.InputField>` have no `child` snippet: upstream's
		// `InputGroupItem` has no `asChild`, and an `<input>` has no children to slot into. They stay
		// composable through the barrel instead, which is what the exported `InputField` is for.
		renderInline({ mode: 'root-child' });
		expect(document.querySelector('div[data-slot="color-picker"]')).toBeNull();
		expect(document.querySelector('[data-child-slot="root"]')).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// edge cases and guard rails (T009)
// ---------------------------------------------------------------------------

describe('input validation', () => {
	it('rejects an invalid hex and resynchronises the field on blur', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderInline({ onValueChange });

		const hex = field('Hex color value');
		await user.clear(hex);
		// Not `#3b82f`: its own prefix `#3b8` is a valid three-digit shorthand, so the picker would
		// legitimately commit halfway through. This text is invalid at every prefix.
		await user.type(hex, 'oops');

		expect(hex).toHaveValue('oops');
		expect(onValueChange).not.toHaveBeenCalled();
		expect(screen.getByTestId('swatch')).toHaveAccessibleName(`Current color: ${BLUE}`);

		await user.tab();
		expect(hex).toHaveValue(BLUE);
	});

	it('rejects a five-digit hex pasted in one go', async () => {
		const onValueChange = vi.fn();
		renderInline({ onValueChange });

		const hex = field('Hex color value');
		await fireEvent.input(hex, { target: { value: '#3b82f' } });

		expect(onValueChange).not.toHaveBeenCalled();
		expect(area()).toHaveAttribute('aria-valuetext', expect.stringContaining(BLUE));

		await fireEvent.blur(hex);
		expect(hex).toHaveValue(BLUE);
	});

	it('accepts a valid hex and moves every other part with it', async () => {
		const user = userEvent.setup();
		renderInline();

		const hex = field('Hex color value');
		await user.clear(hex);
		await user.type(hex, '#10b981');

		expect(area()).toHaveAttribute('aria-valuetext', expect.stringContaining('#10b981'));
		expect(thumb('hue')).toHaveAttribute('aria-valuenow', '160');
	});

	it('rejects an out-of-range numeric channel and snaps back on blur', async () => {
		const user = userEvent.setup();
		renderInline({ defaultFormat: 'rgb' });

		const red = field('Red color component (0-255)');
		await user.clear(red);
		await user.type(red, '300');

		// `30` is accepted on the way to `300`; `300` itself is out of range and changes nothing.
		expect(red).toHaveValue('300');
		expect(field('Green color component (0-255)')).toHaveValue('130');

		await user.tab();
		expect(red).toHaveValue('30');
	});

	it('commits each hsl channel through its own conversion', async () => {
		renderInline({ defaultFormat: 'hsl' });

		const lightness = field('Lightness percentage (0-100)');
		// A single edit rather than `user.type`: every keystroke commits, so typing `20` would pass
		// through `l = 2`, where the whole-unit rounding of an almost-black colour genuinely pushes
		// the saturation to 100. Upstream commits per keystroke and drifts identically.
		await fireEvent.input(lightness, { target: { value: '20' } });

		expect(lightness).toHaveValue('20');
		expect(field('Hue degree (0-360)')).toHaveValue('217');
		expect(field('Saturation percentage (0-100)')).toHaveValue('90');
	});

	it('commits the alpha channel as a percentage', async () => {
		const user = userEvent.setup();
		renderInline();

		const alpha = field('Alpha transparency percentage');
		await user.clear(alpha);
		await user.type(alpha, '40');

		expect(thumb('alpha')).toHaveAttribute('aria-valuenow', '40');
	});
});

describe('pointer geometry', () => {
	it('maps a pointer position onto saturation and brightness', () => {
		renderInline();
		stubRect(area(), { left: 0, top: 0, width: 200, height: 100 });

		drag(area(), 100, 25);

		expect(area()).toHaveAttribute('aria-valuenow', '50');
		expect(area()).toHaveAttribute('aria-valuetext', expect.stringContaining('brightness 75%'));
	});

	it('clamps rather than erroring when the pointer leaves the rect', () => {
		renderInline();
		stubRect(area(), { left: 0, top: 0, width: 200, height: 100 });

		drag(area(), -500, -500);
		expect(area()).toHaveAttribute('aria-valuenow', '0');
		expect(area()).toHaveAttribute('aria-valuetext', expect.stringContaining('brightness 100%'));

		drag(area(), 5000, 5000);
		expect(area()).toHaveAttribute('aria-valuenow', '100');
		expect(area()).toHaveAttribute('aria-valuetext', expect.stringContaining('brightness 0%'));
	});

	it('marks the area while a drag is in flight and only follows a captured pointer', () => {
		renderInline();
		stubRect(area(), { left: 0, top: 0, width: 200, height: 100 });

		fireEvent.pointerMove(area(), { pointerId: 1, clientX: 200, clientY: 0 });
		expect(area()).toHaveAttribute('aria-valuenow', '76');
		expect(area()).not.toHaveAttribute('data-dragging');

		fireEvent.pointerDown(area(), { pointerId: 1, clientX: 0, clientY: 100 });
		expect(area()).toHaveAttribute('data-dragging', '');
		fireEvent.pointerMove(area(), { pointerId: 1, clientX: 200, clientY: 0 });
		expect(area()).toHaveAttribute('aria-valuenow', '100');

		fireEvent.pointerUp(area(), { pointerId: 1, clientX: 200, clientY: 0 });
		expect(area()).not.toHaveAttribute('data-dragging');
	});
});

describe('format switching', () => {
	it('round-trips the colour through every format within one unit per channel', async () => {
		// bits-ui's select leaves `pointer-events: none` on the document while it closes, and this
		// test reopens it four times in a row faster than that unwinds.
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const onValueChange = vi.fn();
		renderInline({ defaultValue: BLUE, onValueChange });

		async function switchTo(label: string) {
			await user.click(screen.getByTestId('format'));
			await waitFor(() => expect(querySlot('color-picker-format-select')).not.toBeNull());
			await user.click(within(bySlot('color-picker-format-select')).getByText(label));
			await waitFor(() => expect(querySlot('color-picker-format-select')).toBeNull());
		}

		await switchTo('RGB');
		await switchTo('HSL');
		await switchTo('HSB');
		await switchTo('HEX');

		expect(field('Hex color value')).toHaveValue(BLUE);
		expect(onValueChange).not.toHaveBeenCalled();
	});
});

describe('transparency', () => {
	it('keeps the checkerboard behind a fully transparent colour', async () => {
		const user = userEvent.setup();
		renderInline();

		thumb('alpha').focus();
		await user.keyboard('{Home}');

		const swatch = screen.getByTestId('swatch');
		expect(swatch).toHaveAttribute('data-transparent', '');
		expect(swatch.getAttribute('style')).toContain('repeating-conic-gradient');
	});
});

describe('disabled and readOnly', () => {
	it('suppresses every pointer and keyboard mutation when disabled', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		stubEyeDropper('#10b981');
		renderInline({ disabled: true, onValueChange });

		expect(screen.getByTestId('root')).toHaveAttribute('data-disabled', '');
		expect(area()).toHaveAttribute('data-disabled', '');
		expect(area()).toHaveAttribute('aria-disabled', 'true');
		expect(area()).toHaveAttribute('tabindex', '-1');
		expect(bySlot('color-picker-hue-slider')).toHaveAttribute('data-disabled', '');
		expect(bySlot('color-picker-alpha-slider')).toHaveAttribute('data-disabled', '');
		expect(screen.getByTestId('eye-dropper')).toBeDisabled();
		expect(screen.getByTestId('swatch')).toHaveAttribute('data-disabled', '');
		expect(field('Hex color value')).toBeDisabled();
		expect(screen.getByTestId('format')).toBeDisabled();

		stubRect(area(), { left: 0, top: 0, width: 200, height: 100 });
		drag(area(), 0, 100);
		await user.keyboard('{ArrowLeft}');

		expect(onValueChange).not.toHaveBeenCalled();
		expect(area()).toHaveAttribute('aria-valuenow', '76');
	});

	it('suppresses every colour mutation when read-only while staying focusable', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderInline({ readOnly: true, onValueChange });

		expect(screen.getByTestId('root')).toHaveAttribute('data-readonly', '');
		expect(area()).toHaveAttribute('data-readonly', '');
		expect(area()).toHaveAttribute('tabindex', '0');
		expect(field('Hex color value')).toHaveAttribute('readonly');

		area().focus();
		expect(area()).toHaveFocus();
		await user.keyboard('{Home}');

		stubRect(area(), { left: 0, top: 0, width: 200, height: 100 });
		drag(area(), 0, 100);

		expect(onValueChange).not.toHaveBeenCalled();
		expect(area()).toHaveAttribute('aria-valuenow', '76');
	});

	it('ORs the trigger’s own disabled with the picker’s', () => {
		renderPicker({ disabled: true });

		expect(screen.getByTestId('trigger')).toBeDisabled();
		expect(screen.getByTestId('trigger')).toHaveAttribute('data-disabled', '');
	});

	it('leaves both slider thumbs focusable and inert when read-only', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderInline({ readOnly: true, onValueChange });

		thumb('hue').focus();
		expect(thumb('hue')).toHaveFocus();
		await user.keyboard('{ArrowRight}{End}');
		expect(thumb('hue')).toHaveAttribute('aria-valuenow', '217');

		thumb('alpha').focus();
		expect(thumb('alpha')).toHaveFocus();
		await user.keyboard('{ArrowLeft}{Home}');
		expect(thumb('alpha')).toHaveAttribute('aria-valuenow', '100');

		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('swallows an eyedropper pick when read-only', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const open = stubEyeDropper('#10b981');
		renderInline({ readOnly: true, onValueChange });

		await user.click(screen.getByTestId('eye-dropper'));

		await waitFor(() => expect(open).toHaveBeenCalled());
		expect(onValueChange).not.toHaveBeenCalled();
		expect(field('Hex color value')).toHaveValue(BLUE);
	});

	it('marks every inherited part with data-readonly', () => {
		stubEyeDropper('#10b981');
		// The trigger and the swatch live outside the panel, so they are asserted in popover mode,
		// where none of the panel parts are mounted.
		const { unmount } = renderPicker({ readOnly: true, defaultValue: BLUE });
		expect(screen.getByTestId('trigger')).toHaveAttribute('data-readonly', '');
		expect(screen.getByTestId('swatch')).toHaveAttribute('data-readonly', '');
		unmount();

		renderInline({ readOnly: true });
		expect(bySlot('color-picker-hue-slider')).toHaveAttribute('data-readonly', '');
		expect(bySlot('color-picker-alpha-slider')).toHaveAttribute('data-readonly', '');
		expect(screen.getByTestId('eye-dropper')).toHaveAttribute('data-readonly', '');
		expect(screen.getByTestId('format')).toHaveAttribute('data-readonly', '');
	});

	it('leaves data-readonly off a picker that is merely disabled', () => {
		renderInline({ disabled: true });

		expect(screen.getByTestId('root')).not.toHaveAttribute('data-readonly');
		expect(bySlot('color-picker-hue-slider')).not.toHaveAttribute('data-readonly');
		expect(bySlot('color-picker-alpha-slider')).not.toHaveAttribute('data-readonly');
		expect(screen.getByTestId('swatch')).not.toHaveAttribute('data-readonly');
	});
});

// ---------------------------------------------------------------------------
// the context accessor (T034)
// ---------------------------------------------------------------------------

describe('context accessor', () => {
	it('hands a custom part the whole picker state, reactively', async () => {
		const user = userEvent.setup();
		renderInline({ withConsumer: true });

		expect(screen.getByTestId('consumer-rgb')).toHaveTextContent('rgb(59, 130, 246)');
		expect(screen.getByTestId('consumer-hsv')).toHaveTextContent('hsv(217, 76, 96)');
		expect(screen.getByTestId('consumer-hue')).toHaveTextContent('217');
		expect(screen.getByTestId('consumer-alpha')).toHaveTextContent('1');
		expect(screen.getByTestId('consumer-format')).toHaveTextContent('hex');

		area().focus();
		await user.keyboard('{Home}');

		expect(screen.getByTestId('consumer-rgb')).toHaveTextContent('rgb(245, 245, 245)');
		expect(screen.getByTestId('consumer-hsv')).toHaveTextContent('hsv(217, 0, 96)');

		thumb('alpha').focus();
		await user.keyboard('{Home}');
		expect(screen.getByTestId('consumer-alpha')).toHaveTextContent('0');
	});

	it('re-renders the custom part when the format and the popover state move', async () => {
		const user = userEvent.setup();
		renderPicker({ defaultValue: BLUE, defaultFormat: 'hsl', withConsumer: true });

		expect(screen.getByTestId('consumer-format')).toHaveTextContent('hsl');
		expect(screen.getByTestId('consumer-open')).toHaveTextContent('closed');

		await openPanel(user);
		expect(screen.getByTestId('consumer-open')).toHaveTextContent('open');

		await user.keyboard('{Escape}');
		await waitFor(() => expect(screen.getByTestId('consumer-open')).toHaveTextContent('closed'));
	});
});

// ---------------------------------------------------------------------------
// modal (T033)
// ---------------------------------------------------------------------------

describe('modal', () => {
	it('leaves the page interactive and focus free by default', async () => {
		const user = userEvent.setup();
		renderPicker({ defaultValue: BLUE, withOuterInputs: true });

		await openPanel(user);

		// `preventScroll` is what locks the body; bits-ui applies both declarations together.
		expect(document.body.style.overflow).not.toBe('hidden');
		expect(document.body.style.pointerEvents).not.toBe('none');

		const outside = screen.getByTestId('after');
		outside.focus();
		expect(outside).toHaveFocus();
	});

	it('traps focus and locks the page behind a modal picker', async () => {
		const user = userEvent.setup();
		const { unmount } = renderPicker({ defaultValue: BLUE, modal: true, withOuterInputs: true });

		await openPanel(user);

		// bits-ui schedules the lock a tick after the content mounts.
		await waitFor(() => expect(document.body.style.overflow).toBe('hidden'));
		expect(document.body.style.pointerEvents).toBe('none');

		const content = bySlot('color-picker-content');
		screen.getByTestId('after').focus();
		await waitFor(() => expect(content.contains(document.activeElement)).toBe(true));

		unmount();
		await waitFor(() => expect(document.body.style.overflow).not.toBe('hidden'));
	});
});

describe('provider guard rails', () => {
	// Each part is mounted through its own thunk rather than passed to `it.each` as a component: the
	// nine components have nine unrelated prop types, and a mixed tuple array would collapse them
	// into a union no single `render` call can satisfy.
	const parts: [string, () => void][] = [
		['Trigger', () => render(Trigger)],
		['Content', () => render(Content)],
		['Area', () => render(Area)],
		['HueSlider', () => render(HueSlider)],
		['AlphaSlider', () => render(AlphaSlider)],
		['Swatch', () => render(Swatch)],
		['EyeDropper', () => render(EyeDropper)],
		['FormatSelect', () => render(FormatSelect)],
		['Input', () => render(Input)],
		['InputField', () => render(InputField, { props: { channel: 'hex' } })]
	];

	it.each(parts)('throws when <ColorPicker.%s> is rendered with no root', (name, mount) => {
		expect(mount).toThrow(
			new RegExp(`\`<ColorPicker\\.${name}>\` must be used within \`<ColorPicker\\.Root>\`\\.`)
		);
	});
});

describe('eyedropper', () => {
	beforeEach(() => {
		delete window.EyeDropper;
	});

	it('renders nothing at all when the browser has no EyeDropper', () => {
		renderInline();

		expect(screen.queryByTestId('eye-dropper')).toBeNull();
		expect(querySlot('color-picker-eye-dropper')).toBeNull();
	});

	it('samples a colour and preserves the current alpha', async () => {
		const user = userEvent.setup();
		const open = stubEyeDropper('#10b981');
		renderInline({ binding: 'controlled', value: 'rgba(59, 130, 246, 0.5)' });

		await user.click(screen.getByTestId('eye-dropper'));

		await waitFor(() => expect(open).toHaveBeenCalled());
		await waitFor(() => expect(field('Hex color value')).toHaveValue('#10b981'));
		expect(field('Alpha transparency percentage')).toHaveValue('50');
	});

	it('swallows a cancelled pick with a warning, leaving the colour untouched', async () => {
		const user = userEvent.setup();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		class FailingEyeDropper {
			open = vi.fn(async () => {
				throw new Error('aborted');
			});
		}
		window.EyeDropper = FailingEyeDropper as unknown as NonNullable<typeof window.EyeDropper>;

		renderInline();
		await user.click(screen.getByTestId('eye-dropper'));

		await waitFor(() => expect(warn).toHaveBeenCalledWith('EyeDropper error:', expect.any(Error)));
		expect(field('Hex color value')).toHaveValue(BLUE);
	});
});

describe('form integration', () => {
	it('submits the colour as hex under the given name, even unopened', async () => {
		const user = userEvent.setup();
		const onSubmitValue = vi.fn();
		renderPicker({ withForm: true, name: 'primaryColor', defaultValue: BLUE, onSubmitValue });

		const input = bySlot('color-picker-form-input');
		expect(input).toHaveAttribute('type', 'hidden');
		expect(input).toHaveAttribute('name', 'primaryColor');
		expect(input).toHaveValue(BLUE);

		await user.click(screen.getByTestId('submit'));
		expect(onSubmitValue).toHaveBeenCalledWith(BLUE);
	});

	it('keeps the hidden input in step with the colour without the popover ever opening', async () => {
		const user = userEvent.setup();
		renderPicker({
			withForm: true,
			inline: true,
			name: 'primaryColor',
			defaultValue: BLUE
		});

		area().focus();
		await user.keyboard('{Home}');

		expect(bySlot('color-picker-form-input')).toHaveValue('#f5f5f5');
	});

	it('mirrors required, disabled and readOnly onto the hidden input', () => {
		renderPicker({
			withForm: true,
			inline: true,
			name: 'primaryColor',
			required: true,
			disabled: true,
			readOnly: true
		});

		const input = bySlot('color-picker-form-input');
		expect(input).toHaveAttribute('required');
		expect(input).toBeDisabled();
		expect(input).toHaveAttribute('readonly');
	});

	it('renders no hidden input outside a form', () => {
		renderInline({ name: 'primaryColor' });

		expect(querySlot('color-picker-form-input')).toBeNull();
	});
});
