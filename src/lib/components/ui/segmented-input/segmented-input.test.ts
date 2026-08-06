import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import {
	resolveSegmentIntent,
	resolveSegmentPosition,
	SEGMENT_ORIENTATIONS,
	SEGMENT_POSITIONS,
	SEGMENTED_INPUT_ORIENTATIONS,
	SEGMENTED_INPUT_SIZES,
	SegmentNavigation,
	segmentedInputItemVariants,
	splitPastedValue,
	type SegmentEntryMeta
} from './index.js';
import Harness, {
	SEGMENTED_INPUT_HARNESS_ITEMS,
	type SegmentedInputHarnessProps
} from './segmented-input.test.svelte';

function renderGroup(props: SegmentedInputHarnessProps = {}) {
	return render(Harness, { props });
}

function bySlot(slot: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function allBySlot(slot: string): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`));
}

/** The rendered `<input>` of the item at `index`, in document order. */
function itemAt(index: number): HTMLInputElement {
	const input = document.querySelectorAll<HTMLInputElement>('[data-slot="segmented-input-item"]')[
		index
	];
	if (!input) throw new Error(`no segmented-input item at index ${index}`);
	return input;
}

function positions(): (string | null)[] {
	return allBySlot('segmented-input-item').map((item) => item.getAttribute('data-position'));
}

/** Register `count` detached-then-attached inputs with a bare navigation instance (V-46). */
function mountStandaloneSegments(count: number) {
	const container = document.createElement('div');
	document.body.append(container);

	const elements = Array.from({ length: count }, () => {
		const input = document.createElement('input');
		container.append(input);
		return input;
	});

	return { container, elements };
}

// ---------------------------------------------------------------------------
// T005 — the pure helpers, with no DOM at all (quickstart V-43, V-44, V-45)
// ---------------------------------------------------------------------------

describe('segment-navigation pure helpers (T005, V-43/V-44/V-45)', () => {
	it('exposes the documented constant tuples', () => {
		expect(SEGMENT_ORIENTATIONS).toEqual(['horizontal', 'vertical']);
		expect(SEGMENT_POSITIONS).toEqual(['isolated', 'first', 'middle', 'last']);
		expect(SEGMENTED_INPUT_ORIENTATIONS).toEqual(['horizontal', 'vertical']);
		expect(SEGMENTED_INPUT_SIZES).toEqual(['default', 'sm', 'lg']);
	});

	it.each([
		[-1, 3, 'isolated'],
		[-1, 0, 'isolated'],
		[0, 0, 'isolated'],
		[0, 1, 'isolated'],
		[0, 2, 'first'],
		[1, 2, 'last'],
		[0, 3, 'first'],
		[1, 3, 'middle'],
		[2, 3, 'last'],
		[2, 5, 'middle'],
		[4, 5, 'last']
	] as const)('resolveSegmentPosition(%i, %i) is %s', (index, count, expected) => {
		expect(resolveSegmentPosition(index, count)).toBe(expected);
	});

	it.each([
		['ArrowRight', 'horizontal', 'ltr', 'next'],
		['ArrowLeft', 'horizontal', 'ltr', 'previous'],
		['ArrowRight', 'horizontal', 'rtl', 'previous'],
		['ArrowLeft', 'horizontal', 'rtl', 'next'],
		['ArrowUp', 'horizontal', 'ltr', null],
		['ArrowDown', 'horizontal', 'ltr', null],
		['ArrowUp', 'horizontal', 'rtl', null],
		['ArrowDown', 'horizontal', 'rtl', null],
		['ArrowDown', 'vertical', 'ltr', 'next'],
		['ArrowUp', 'vertical', 'ltr', 'previous'],
		['ArrowDown', 'vertical', 'rtl', 'next'],
		['ArrowUp', 'vertical', 'rtl', 'previous'],
		['ArrowLeft', 'vertical', 'ltr', null],
		['ArrowRight', 'vertical', 'ltr', null],
		['ArrowLeft', 'vertical', 'rtl', null],
		['ArrowRight', 'vertical', 'rtl', null],
		['Home', 'horizontal', 'ltr', 'first'],
		['Home', 'vertical', 'rtl', 'first'],
		['End', 'horizontal', 'rtl', 'last'],
		['End', 'vertical', 'ltr', 'last'],
		['Tab', 'horizontal', 'ltr', null],
		['Enter', 'vertical', 'ltr', null],
		['a', 'horizontal', 'ltr', null]
	] as const)('resolveSegmentIntent(%s, %s, %s) is %s', (key, orientation, dir, expected) => {
		expect(resolveSegmentIntent(key, orientation, dir)).toBe(expected);
	});

	it.each([
		// Every row of research.md R-10's worked-example table.
		['+1 555 1234567', [undefined, 3, 7], ['+1', '555', '1234567']],
		['5551234567', [3, 7], ['555', '1234567']],
		['255, 128, 0', [undefined, undefined, undefined], ['255', '128', '0']],
		['Ada Byron King', [undefined, undefined, undefined], ['Ada', 'Byron', 'King']],
		['Lovelace', [undefined, undefined, undefined], ['Lovelace']],
		['ab cd ef gh', [undefined, undefined], ['ab', 'cd']],
		// Blank, whitespace-only and more-parts-than-segments.
		['', [undefined, undefined], []],
		['   ', [undefined, undefined], []],
		['a b c', [undefined], ['a']],
		// Truncation to each segment's own width, on both paths.
		['abcd ef', [2, undefined], ['ab', 'ef']],
		['1234567', [2, undefined], ['12', '34567']],
		['12345', [undefined, 3], ['12345']]
	] as const)('splitPastedValue(%j, %j) is %j', (text, maxLengths, expected) => {
		expect(splitPastedValue(text, maxLengths)).toEqual(expected);
	});

	it('never returns more parts than there are segments, nor an over-long part', () => {
		const parts = splitPastedValue('one two three four', [2, 3, undefined]);
		expect(parts).toHaveLength(3);
		expect(parts[0]).toBe('on');
		expect(parts[1]).toBe('two');
		expect(parts[2]).toBe('three');
	});

	it('keeps the seam classes logical so they survive `dir="rtl"` (D-06)', () => {
		expect(segmentedInputItemVariants({ position: 'middle' })).toContain('border-s-0');
		expect(segmentedInputItemVariants({ position: 'last' })).toContain('border-s-0');
		expect(segmentedInputItemVariants({ position: 'middle' })).not.toContain('border-l-0');
		expect(segmentedInputItemVariants({ position: 'first' })).toContain('rounded-e-none');
		expect(segmentedInputItemVariants({ position: 'last', orientation: 'vertical' })).toContain(
			'rounded-s-lg'
		);
		expect(segmentedInputItemVariants({ size: 'lg' })).toContain('h-9');
	});
});

// ---------------------------------------------------------------------------
// T006 — roles, ARIA, structure, position and inheritance (V-1…V-14)
// ---------------------------------------------------------------------------

describe('SegmentedInput accessibility and structure (T006, V-1/V-2/V-3/V-4)', () => {
	it('renders a group whose orientation is exposed to ARIA and to CSS', () => {
		renderGroup();

		const root = screen.getByRole('group');
		expect(root).toHaveAttribute('data-slot', 'segmented-input');
		expect(root).toHaveAttribute('aria-orientation', 'horizontal');
		expect(root).toHaveAttribute('data-orientation', 'horizontal');
		expect(root.className).toContain('flex-row');
	});

	it('switches both the ARIA and the layout axis when vertical', () => {
		renderGroup({ orientation: 'vertical' });

		const root = screen.getByRole('group');
		expect(root).toHaveAttribute('aria-orientation', 'vertical');
		expect(root).toHaveAttribute('data-orientation', 'vertical');
		expect(root.className).toContain('flex-col');
		expect(allBySlot('segmented-input-item')[1]).toHaveAttribute('data-orientation', 'vertical');
	});

	it('renders one named textbox per item', () => {
		renderGroup();

		for (const item of SEGMENTED_INPUT_HARNESS_ITEMS) {
			expect(screen.getByRole('textbox', { name: item.label })).toHaveAttribute(
				'data-slot',
				'segmented-input-item'
			);
		}
		expect(allBySlot('segmented-input-item')).toHaveLength(3);
	});

	it('forwards every native input attribute untouched', () => {
		renderGroup({
			items: [
				{
					label: 'Area code',
					placeholder: '555',
					maxlength: 3,
					inputmode: 'numeric',
					pattern: '[0-9]*',
					min: '0',
					max: '255',
					name: 'area',
					readonly: true
				}
			]
		});

		const input = screen.getByRole('textbox', { name: 'Area code' });
		expect(input).toHaveAttribute('placeholder', '555');
		expect(input).toHaveAttribute('maxlength', '3');
		expect(input).toHaveAttribute('inputmode', 'numeric');
		expect(input).toHaveAttribute('pattern', '[0-9]*');
		expect(input).toHaveAttribute('min', '0');
		expect(input).toHaveAttribute('max', '255');
		expect(input).toHaveAttribute('name', 'area');
		expect(input).toHaveAttribute('readonly');
	});

	it('leaves the state attributes absent while the flags are false', () => {
		renderGroup();

		const root = screen.getByRole('group');
		expect(root).not.toHaveAttribute('data-disabled');
		expect(root).not.toHaveAttribute('data-invalid');
		expect(root).not.toHaveAttribute('data-required');

		const item = itemAt(0);
		expect(item).not.toHaveAttribute('data-disabled');
		expect(item).not.toHaveAttribute('aria-invalid');
		expect(item).not.toHaveAttribute('aria-required');
		expect(item).not.toBeDisabled();
		expect(item).not.toBeRequired();
	});

	it('propagates disabled, invalid and required to the root and to every item', () => {
		renderGroup({ disabled: true, invalid: true, required: true });

		const root = screen.getByRole('group');
		expect(root).toHaveAttribute('data-disabled', '');
		expect(root).toHaveAttribute('data-invalid', '');
		expect(root).toHaveAttribute('data-required', '');

		for (const item of allBySlot('segmented-input-item')) {
			expect(item).toHaveAttribute('data-disabled', '');
			expect(item).toHaveAttribute('data-invalid', '');
			expect(item).toHaveAttribute('data-required', '');
			expect(item).toHaveAttribute('aria-invalid', 'true');
			expect(item).toHaveAttribute('aria-required', 'true');
			expect(item).toBeDisabled();
			expect(item).toBeRequired();
		}
	});
});

describe('SegmentedInput position assignment (T006, V-5/V-6/V-7/V-8/V-9)', () => {
	it('marks a lone item isolated', async () => {
		renderGroup({ items: [{ label: 'Only' }] });
		await tick();

		expect(itemAt(0)).toHaveAttribute('data-position', 'isolated');
	});

	it('derives first / middle / last in document order', async () => {
		renderGroup();
		await tick();

		expect(positions()).toEqual(['first', 'middle', 'last']);
	});

	it('lets an explicit position win over the derived one', async () => {
		renderGroup({
			items: [
				{ label: 'First name' },
				{ label: 'Middle name', position: 'last' },
				{ label: 'Last name' }
			]
		});
		await tick();

		expect(positions()).toEqual(['first', 'last', 'last']);
	});

	it('re-derives positions when an item is added, without remounting', async () => {
		const { rerender } = renderGroup();
		await tick();
		expect(positions()).toEqual(['first', 'middle', 'last']);

		const before = itemAt(2);
		await rerender({ withExtraItem: true });
		await tick();

		expect(positions()).toEqual(['first', 'middle', 'middle', 'last']);
		expect(itemAt(2)).toBe(before);
	});

	it('keeps a disabled item in the index, so its neighbours keep their positions', async () => {
		renderGroup({
			items: [
				{ label: 'First name' },
				{ label: 'Middle name', disabled: true },
				{ label: 'Last name' }
			]
		});
		await tick();

		expect(positions()).toEqual(['first', 'middle', 'last']);
		expect(itemAt(1)).toBeDisabled();
	});

	it('carries logical seam classes and merges the caller class last', async () => {
		renderGroup({ items: [{ label: 'First name' }, { label: 'Last name', class: 'w-20' }] });
		await tick();

		expect(itemAt(0).className).toContain('rounded-e-none');
		expect(itemAt(1).className).toContain('border-s-0');
		expect(itemAt(1).className).not.toContain('border-l-0');
		expect(itemAt(1).className).toContain('w-20');
	});

	it('keeps the seam classes logical under dir="rtl" (D-06)', async () => {
		renderGroup({ dir: 'rtl' });
		await tick();

		expect(itemAt(1).className).toContain('border-s-0');
		expect(itemAt(2).className).toContain('border-s-0');
		expect(itemAt(1).className).not.toContain('border-l-0');
	});

	it('restores the joined edge with logical borders when vertical', async () => {
		renderGroup({ orientation: 'vertical' });
		await tick();

		expect(itemAt(0).className).toContain('rounded-e-lg');
		expect(itemAt(1).className).toContain('border-t-0');
		expect(itemAt(2).className).toContain('rounded-s-lg');
	});

	it('re-flows the axis and the seams when orientation is toggled after mount', async () => {
		const { rerender } = renderGroup();
		await tick();

		const mounted = allBySlot('segmented-input-item');
		expect(mounted[0].className).toContain('rounded-e-none');

		await rerender({ orientation: 'vertical' });
		await tick();

		const root = screen.getByRole('group');
		expect(root).toHaveAttribute('aria-orientation', 'vertical');
		expect(root).toHaveAttribute('data-orientation', 'vertical');
		expect(root.className).toContain('flex-col');

		expect(itemAt(0).className).toContain('rounded-e-lg');
		expect(itemAt(1).className).toContain('border-t-0');
		expect(itemAt(2).className).toContain('rounded-s-lg');
		expect(itemAt(1)).toHaveAttribute('data-orientation', 'vertical');

		// The same three elements, re-styled in place: a remount would lose focus and caret state.
		expect(allBySlot('segmented-input-item')).toEqual(mounted);
		expect(positions()).toEqual(['first', 'middle', 'last']);
	});
});

describe('SegmentedInput sizes (T006, V-10)', () => {
	it.each([
		['sm', 'h-7'],
		['default', 'h-8'],
		['lg', 'h-9']
	] as const)('applies the %s size to every item', async (size, height) => {
		const { rerender } = renderGroup({ size });
		await tick();

		for (const item of allBySlot('segmented-input-item')) {
			expect(item.className).toContain(height);
		}

		await rerender({ size, withExtraItem: true });
		await tick();
		expect(itemAt(3).className).toContain(height);
	});
});

describe('SegmentedInput inheritance and guard rails (T006, V-11/V-12/V-13/V-14)', () => {
	it('lets an item opt out of a disabled group', async () => {
		const user = userEvent.setup();
		renderGroup({
			disabled: true,
			items: [{ label: 'First name' }, { label: 'Middle name', disabled: false }]
		});

		expect(itemAt(0)).toBeDisabled();
		expect(itemAt(1)).not.toBeDisabled();

		await user.type(itemAt(1), 'ok');
		expect(itemAt(1)).toHaveValue('ok');
	});

	it('lets an item opt out of a required group', () => {
		renderGroup({
			required: true,
			items: [{ label: 'First name' }, { label: 'Middle name', required: false }]
		});

		expect(itemAt(0)).toBeRequired();
		expect(itemAt(0)).toHaveAttribute('aria-required', 'true');
		expect(itemAt(1)).not.toBeRequired();
		expect(itemAt(1)).not.toHaveAttribute('aria-required');
	});

	it('marks every item invalid from the group, with no per-item override', () => {
		renderGroup({ invalid: true, items: [{ label: 'First name' }, { label: 'Middle name' }] });

		for (const item of allBySlot('segmented-input-item')) {
			expect(item).toHaveAttribute('aria-invalid', 'true');
			expect(item).toHaveAttribute('data-invalid', '');
		}
	});

	it('ignores typing into a disabled item', async () => {
		const user = userEvent.setup();
		const onItemInput = vi.fn();
		renderGroup({ disabled: true, onItemInput });

		await user.type(itemAt(0), 'nope');

		expect(itemAt(0)).toHaveValue('');
		expect(onItemInput).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// T007 — controlled / uncontrolled (V-36, V-37, V-38)
// ---------------------------------------------------------------------------

describe('SegmentedInput value handling (T007, V-36/V-37/V-38)', () => {
	it('accepts typing while uncontrolled and reports it through oninput', async () => {
		const user = userEvent.setup();
		const onItemInput = vi.fn();
		renderGroup({ onItemInput });

		await user.type(itemAt(1), 'Ada');

		expect(itemAt(1)).toHaveValue('Ada');
		expect(onItemInput).toHaveBeenLastCalledWith(1, 'Ada');
	});

	it('moves the parent state through bind:value in both directions', async () => {
		const user = userEvent.setup();
		const onValuesBinding = vi.fn();
		const { rerender } = renderGroup({
			binding: 'value',
			values: ['', '', ''],
			onValuesBinding
		});

		await user.type(itemAt(0), 'Ada');
		expect(onValuesBinding).toHaveBeenLastCalledWith(['Ada', '', '']);

		await rerender({ binding: 'value', values: ['Byron', '', ''] });
		expect(itemAt(0)).toHaveValue('Byron');
	});

	it('keeps a declining function binding authoritative', async () => {
		const user = userEvent.setup();
		const onDeclinedValue = vi.fn();
		renderGroup({
			binding: 'function',
			authoritative: ['pinned', '', ''],
			onDeclinedValue
		});

		expect(itemAt(0)).toHaveValue('pinned');

		await user.type(itemAt(0), 'X');

		expect(onDeclinedValue).toHaveBeenCalledWith(0, 'pinnedX');
		expect(itemAt(0)).toHaveValue('pinned');
	});
});

// ---------------------------------------------------------------------------
// T008 — keyboard segment navigation (V-15…V-23)
// ---------------------------------------------------------------------------

describe('SegmentedInput keyboard navigation (T008, V-15…V-23)', () => {
	it('walks the items in document order with Tab and Shift+Tab', async () => {
		const user = userEvent.setup();
		renderGroup({ withOuterInputs: true });

		screen.getByTestId('before').focus();

		await user.tab();
		expect(itemAt(0)).toHaveFocus();
		await user.tab();
		expect(itemAt(1)).toHaveFocus();
		await user.tab();
		expect(itemAt(2)).toHaveFocus();
		await user.tab();
		expect(screen.getByTestId('after')).toHaveFocus();

		await user.tab({ shift: true });
		expect(itemAt(2)).toHaveFocus();
	});

	it('moves forward with ArrowRight in a horizontal LTR group without changing values', async () => {
		const user = userEvent.setup();
		renderGroup();

		await user.click(itemAt(0));
		await user.keyboard('{ArrowRight}');
		expect(itemAt(1)).toHaveFocus();
		await user.keyboard('{ArrowRight}');
		expect(itemAt(2)).toHaveFocus();

		for (const item of allBySlot('segmented-input-item')) {
			expect(item).toHaveValue('');
		}
	});

	it('never wraps around either edge', async () => {
		const user = userEvent.setup();
		renderGroup();

		await user.click(itemAt(0));
		await user.keyboard('{ArrowLeft}');
		expect(itemAt(0)).toHaveFocus();

		await user.click(itemAt(2));
		await user.keyboard('{ArrowRight}');
		expect(itemAt(2)).toHaveFocus();
	});

	it('uses the vertical axis only when the group is vertical', async () => {
		const user = userEvent.setup();
		renderGroup({ orientation: 'vertical' });

		await user.click(itemAt(0));
		await user.keyboard('{ArrowDown}');
		expect(itemAt(1)).toHaveFocus();

		await user.keyboard('{ArrowRight}');
		expect(itemAt(1)).toHaveFocus();
		await user.keyboard('{ArrowLeft}');
		expect(itemAt(1)).toHaveFocus();

		await user.keyboard('{ArrowUp}');
		expect(itemAt(0)).toHaveFocus();
	});

	it('ignores the vertical arrows while horizontal', async () => {
		const user = userEvent.setup();
		renderGroup();

		await user.click(itemAt(1));
		await user.keyboard('{ArrowDown}');
		expect(itemAt(1)).toHaveFocus();
		await user.keyboard('{ArrowUp}');
		expect(itemAt(1)).toHaveFocus();
	});

	it.each(['horizontal', 'vertical'] as const)(
		'jumps to the edges with Home and End (%s)',
		async (orientation) => {
			const user = userEvent.setup();
			renderGroup({ orientation });

			await user.click(itemAt(1));
			await user.keyboard('{Home}');
			expect(itemAt(0)).toHaveFocus();

			await user.keyboard('{End}');
			expect(itemAt(2)).toHaveFocus();
		}
	);

	it('skips a disabled segment', async () => {
		const user = userEvent.setup();
		renderGroup({
			items: [
				{ label: 'First name' },
				{ label: 'Middle name', disabled: true },
				{ label: 'Last name' }
			]
		});

		await user.click(itemAt(0));
		await user.keyboard('{ArrowRight}');
		expect(itemAt(2)).toHaveFocus();

		await user.keyboard('{ArrowLeft}');
		expect(itemAt(0)).toHaveFocus();
	});

	it('leaves mid-text caret movement to the browser (D-07)', async () => {
		const user = userEvent.setup();
		renderGroup();

		await user.click(itemAt(0));
		await user.keyboard('abc');
		itemAt(0).setSelectionRange(1, 1);

		await user.keyboard('{ArrowRight}');
		expect(itemAt(0)).toHaveFocus();

		itemAt(0).setSelectionRange(3, 3);
		await user.keyboard('{ArrowRight}');
		expect(itemAt(1)).toHaveFocus();
	});

	it('moves focus nowhere when every segment of the group is disabled', async () => {
		// A disabled `<input>` cannot be clicked or typed into, so `userEvent` cannot deliver this
		// keystroke at all. The event is dispatched instead, and the enabled group is asserted first
		// so the disabled result cannot pass for the wrong reason — a key that never reached us.
		function pressArrowRight(): boolean {
			const event = new KeyboardEvent('keydown', {
				key: 'ArrowRight',
				bubbles: true,
				cancelable: true
			});
			itemAt(0).dispatchEvent(event);
			return event.defaultPrevented;
		}

		const { rerender } = renderGroup();
		await tick();

		itemAt(0).focus();
		expect(pressArrowRight()).toBe(true);
		expect(itemAt(1)).toHaveFocus();

		await rerender({ disabled: true });
		await tick();

		const focused = document.activeElement;
		expect(pressArrowRight()).toBe(false);
		expect(document.activeElement).toBe(focused);
	});

	it('lets a caller onkeydown veto segment navigation', async () => {
		const user = userEvent.setup();
		renderGroup({ preventKeydown: true });

		await user.click(itemAt(0));
		await user.keyboard('{ArrowRight}');
		expect(itemAt(0)).toHaveFocus();
		await user.keyboard('{End}');
		expect(itemAt(0)).toHaveFocus();
	});
});

// ---------------------------------------------------------------------------
// T009 — direction (V-24…V-27)
// ---------------------------------------------------------------------------

describe('SegmentedInput direction (T009, V-24…V-27)', () => {
	it('inverts the horizontal arrows under dir="rtl"', async () => {
		const user = userEvent.setup();
		renderGroup({ dir: 'rtl' });

		expect(screen.getByRole('group')).toHaveAttribute('dir', 'rtl');

		await user.click(itemAt(0));
		await user.keyboard('{ArrowLeft}');
		expect(itemAt(1)).toHaveFocus();
		await user.keyboard('{ArrowRight}');
		expect(itemAt(0)).toHaveFocus();

		await user.keyboard('{ArrowRight}');
		expect(itemAt(0)).toHaveFocus();
	});

	it('resolves the direction from a surrounding DirectionProvider', async () => {
		const user = userEvent.setup();
		renderGroup({ providerDir: 'rtl' });

		expect(screen.getByRole('group')).toHaveAttribute('dir', 'rtl');

		await user.click(itemAt(0));
		await user.keyboard('{ArrowLeft}');
		expect(itemAt(1)).toHaveFocus();
	});

	it('lets an explicit dir beat the surrounding provider', async () => {
		const user = userEvent.setup();
		renderGroup({ providerDir: 'rtl', dir: 'ltr' });

		expect(screen.getByRole('group')).toHaveAttribute('dir', 'ltr');

		await user.click(itemAt(0));
		await user.keyboard('{ArrowRight}');
		expect(itemAt(1)).toHaveFocus();
	});

	it('leaves the vertical arrows unaffected by direction', async () => {
		const user = userEvent.setup();
		renderGroup({ orientation: 'vertical', dir: 'rtl' });

		await user.click(itemAt(0));
		await user.keyboard('{ArrowDown}');
		expect(itemAt(1)).toHaveFocus();
		await user.keyboard('{ArrowUp}');
		expect(itemAt(0)).toHaveFocus();
	});
});

// ---------------------------------------------------------------------------
// T010 — paste distribution (V-28…V-35)
// ---------------------------------------------------------------------------

describe('SegmentedInput paste distribution (T010, V-28…V-35)', () => {
	it('spreads a separated value across the whole group', async () => {
		const user = userEvent.setup();
		renderGroup();

		await user.click(itemAt(0));
		await user.paste('Ada Byron King');

		expect(itemAt(0)).toHaveValue('Ada');
		expect(itemAt(1)).toHaveValue('Byron');
		expect(itemAt(2)).toHaveValue('King');
		expect(itemAt(2)).toHaveFocus();
	});

	it('starts at the focused segment and discards the overflow', async () => {
		const user = userEvent.setup();
		renderGroup();

		await user.click(itemAt(1));
		await user.paste('Ada Byron King');

		expect(itemAt(0)).toHaveValue('');
		expect(itemAt(1)).toHaveValue('Ada');
		expect(itemAt(2)).toHaveValue('Byron');
		expect(itemAt(2)).toHaveFocus();
	});

	it('leaves surplus segments untouched when there are fewer parts', async () => {
		const user = userEvent.setup();
		renderGroup({
			items: [
				{ label: 'First name' },
				{ label: 'Middle name' },
				{ label: 'Last name', value: 'King' }
			]
		});

		await user.click(itemAt(0));
		await user.paste('Ada Byron');

		expect(itemAt(0)).toHaveValue('Ada');
		expect(itemAt(1)).toHaveValue('Byron');
		expect(itemAt(2)).toHaveValue('King');
		expect(itemAt(1)).toHaveFocus();
	});

	it('splits an unseparated value on each segment maxlength', async () => {
		const user = userEvent.setup();
		renderGroup({
			items: [
				{ label: 'Country code' },
				{ label: 'Area code', maxlength: 3 },
				{ label: 'Phone number', maxlength: 7 }
			]
		});

		await user.click(itemAt(1));
		await user.paste('5551234567');

		expect(itemAt(0)).toHaveValue('');
		expect(itemAt(1)).toHaveValue('555');
		expect(itemAt(2)).toHaveValue('1234567');
		expect(itemAt(2)).toHaveFocus();
	});

	it('skips a read-only segment and continues past it', async () => {
		const user = userEvent.setup();
		renderGroup({
			items: [
				{ label: 'First name' },
				{ label: 'Middle name', readonly: true, value: 'kept' },
				{ label: 'Last name' }
			]
		});

		await user.click(itemAt(0));
		await user.paste('Ada Byron King');

		expect(itemAt(0)).toHaveValue('Ada');
		expect(itemAt(1)).toHaveValue('kept');
		expect(itemAt(2)).toHaveValue('Byron');
		expect(itemAt(2)).toHaveFocus();
	});

	it('skips a disabled segment and continues past it', async () => {
		const user = userEvent.setup();
		renderGroup({
			items: [
				{ label: 'First name' },
				{ label: 'Middle name', disabled: true, value: 'kept' },
				{ label: 'Last name' }
			]
		});

		await user.click(itemAt(0));
		await user.paste('Ada Byron King');

		expect(itemAt(1)).toBeDisabled();
		expect(itemAt(0)).toHaveValue('Ada');
		expect(itemAt(1)).toHaveValue('kept');
		expect(itemAt(2)).toHaveValue('Byron');
		expect(itemAt(2)).toHaveFocus();
	});

	it('leaves a single-part paste to the browser', async () => {
		const user = userEvent.setup();
		renderGroup();

		await user.click(itemAt(0));
		await user.paste('Lovelace');

		expect(itemAt(0)).toHaveValue('Lovelace');
		expect(itemAt(1)).toHaveValue('');
		expect(itemAt(0)).toHaveFocus();
	});

	it('lets a caller onpaste veto the distribution', async () => {
		const user = userEvent.setup();
		renderGroup({
			preventPaste: true,
			items: [{ label: 'First name', value: 'kept' }, { label: 'Middle name' }]
		});

		await user.click(itemAt(0));
		await user.paste('Ada Byron');

		expect(itemAt(0)).toHaveValue('kept');
		expect(itemAt(1)).toHaveValue('');
		expect(itemAt(0)).toHaveFocus();
	});

	it('reports every written segment through oninput and through bind:value', async () => {
		const user = userEvent.setup();
		const onItemInput = vi.fn();
		const onValuesBinding = vi.fn();
		renderGroup({ binding: 'value', values: ['', '', ''], onItemInput, onValuesBinding });

		await user.click(itemAt(0));
		await user.paste('Ada Byron King');

		expect(onItemInput.mock.calls).toEqual([
			[0, 'Ada'],
			[1, 'Byron'],
			[2, 'King']
		]);
		expect(onValuesBinding).toHaveBeenLastCalledWith(['Ada', 'Byron', 'King']);
	});

	it('cannot write past a declining function binding', async () => {
		const user = userEvent.setup();
		const onDeclinedValue = vi.fn();
		renderGroup({
			binding: 'function',
			authoritative: ['pinned', 'also-pinned', ''],
			onDeclinedValue
		});

		await user.click(itemAt(0));
		await user.paste('Ada Byron King');

		expect(onDeclinedValue).toHaveBeenCalledWith(0, 'Ada');
		expect(onDeclinedValue).toHaveBeenCalledWith(1, 'Byron');
		expect(itemAt(0)).toHaveValue('pinned');
		expect(itemAt(1)).toHaveValue('also-pinned');
	});
});

// ---------------------------------------------------------------------------
// T011 — composition, refs, provider guard and the standalone module
// (V-39, V-40, V-41, V-42, V-46)
// ---------------------------------------------------------------------------

describe('SegmentedInput composition and guard rails (T011, V-39…V-42)', () => {
	it('renders the root onto the caller element through the child snippet', () => {
		renderGroup({ mode: 'root-child', orientation: 'vertical', invalid: true, class: 'w-64' });

		const root = screen.getByRole('group');
		expect(root.tagName).toBe('SECTION');
		expect(root).toHaveAttribute('data-child-slot', 'root');
		expect(root).toHaveAttribute('data-slot', 'segmented-input');
		expect(root).toHaveAttribute('aria-orientation', 'vertical');
		expect(root).toHaveAttribute('data-invalid', '');
		expect(root).toHaveAttribute('dir', 'ltr');
		expect(root.className).toContain('flex-col');
		expect(root.className).toContain('w-64');
		expect(document.querySelector('div[data-slot="segmented-input"]')).toBeNull();
	});

	it('renders the item onto the caller element through the child snippet', async () => {
		renderGroup({ mode: 'item-child', required: true });
		await tick();

		const item = screen.getByRole('textbox', { name: 'First name' });
		expect(item).toHaveAttribute('data-child-slot', 'item');
		expect(item).toHaveAttribute('data-slot', 'segmented-input-item');
		expect(item).toHaveAttribute('data-orientation', 'horizontal');
		expect(item).toBeRequired();
		expect(item).toHaveAttribute('aria-required', 'true');
		// The caller owns the element, so `ref` stays null (D-03) — but the attachment carried in the
		// merged props still registers it, so it keeps a computed position rather than "isolated".
		expect(positions()).toEqual(['first', 'middle', 'last']);
	});

	it('navigates and takes a distributed paste through child-rendered segments', async () => {
		const user = userEvent.setup();
		const onItemInput = vi.fn();
		renderGroup({ mode: 'item-child', onItemInput });
		await tick();

		await user.click(itemAt(0));
		await user.keyboard('{ArrowRight}');
		expect(itemAt(1)).toHaveFocus();

		await user.keyboard('{Home}');
		await user.paste('Ada Byron King');

		expect(itemAt(0)).toHaveValue('Ada');
		expect(itemAt(1)).toHaveValue('Byron');
		expect(itemAt(2)).toHaveValue('King');
		expect(itemAt(2)).toHaveFocus();
		expect(onItemInput.mock.calls).toEqual([
			[0, 'Ada'],
			[1, 'Byron'],
			[2, 'King']
		]);
	});

	it('binds ref to the rendered div on the root and to the input on the item', async () => {
		const onRootRef = vi.fn();
		const onItemRef = vi.fn();
		renderGroup({ onRootRef, onItemRef });
		await tick();

		expect(onRootRef).toHaveBeenLastCalledWith(bySlot('segmented-input'));
		expect(onRootRef.mock.lastCall?.[0]).toBeInstanceOf(HTMLDivElement);
		expect(onItemRef).toHaveBeenLastCalledWith(itemAt(0));
		expect(onItemRef.mock.lastCall?.[0]).toBeInstanceOf(HTMLInputElement);
	});

	it('throws when an item is rendered outside a root', () => {
		expect(() => renderGroup({ mode: 'bare-item' })).toThrow(
			'`<SegmentedInput.Item>` must be used within `<SegmentedInput.Root>`.'
		);
	});

	it('names both parts in the provider error', () => {
		expect(() => renderGroup({ mode: 'bare-item' })).toThrow(/within/);
	});
});

describe('SegmentNavigation without any SegmentedInput markup (T011, V-46)', () => {
	function meta(element: HTMLInputElement, overrides: Partial<SegmentEntryMeta> = {}) {
		return {
			getDisabled: () => false,
			getReadOnly: () => false,
			getMaxLength: () => undefined,
			setValue: (next: string) => {
				element.value = next;
			},
			...overrides
		};
	}

	it('registers, orders and moves focus over hand-built inputs', () => {
		const nav = new SegmentNavigation({
			getOrientation: () => 'horizontal',
			getDir: () => 'ltr'
		});
		const { container, elements } = mountStandaloneSegments(3);

		elements.forEach((element, index) => nav.register(`s${index}`, element, meta(element)));

		expect(nav.count).toBe(3);
		expect(nav.indexOf('s1')).toBe(1);
		expect(nav.positionOf('s0')).toBe('first');
		expect(nav.positionOf('s1')).toBe('middle');
		expect(nav.positionOf('s2')).toBe('last');
		expect(nav.positionOf('unknown')).toBe('isolated');

		elements[0].focus();
		const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
		nav.onKeydown(event, 's0');

		expect(event.defaultPrevented).toBe(true);
		expect(elements[1]).toHaveFocus();

		nav.onKeydown(new KeyboardEvent('keydown', { key: 'End', cancelable: true }), 's1');
		expect(elements[2]).toHaveFocus();

		nav.focusAt(0, 'start');
		expect(elements[0]).toHaveFocus();

		nav.unregister('s2');
		expect(nav.count).toBe(2);
		expect(nav.positionOf('s1')).toBe('last');

		container.remove();
	});

	it('respects the direction getter it was constructed with', () => {
		let dir: 'ltr' | 'rtl' = 'ltr';
		const nav = new SegmentNavigation({
			getOrientation: () => 'horizontal',
			getDir: () => dir
		});
		const { container, elements } = mountStandaloneSegments(2);
		elements.forEach((element, index) => nav.register(`s${index}`, element, meta(element)));

		elements[0].focus();
		dir = 'rtl';
		nav.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true }), 's0');
		expect(elements[1]).toHaveFocus();

		container.remove();
	});
});
