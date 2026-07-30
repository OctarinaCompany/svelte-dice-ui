import { describe, expect, it } from 'vitest';

import { ShiftMultiSelect } from './shift-multi-select.svelte.js';

const TRICKS = [
	{ label: 'Kickflip', value: 'kickflip' },
	{ label: 'Heelflip', value: 'heelflip' },
	{ label: 'Tre Flip', value: 'tre-flip' },
	{ label: 'Pizza Guy', value: 'pizza-guy' },
	{ label: 'FS 540', value: 'fs-540' },
	{ label: 'The 900', value: 'the-900' }
] as const;

type Trick = (typeof TRICKS)[number];

function createHelper() {
	return new ShiftMultiSelect<Trick>({
		items: TRICKS,
		getItemValue: (trick) => trick.value
	});
}

/** The two events `CheckboxGroup.List` forwards, which is all the helper ever sees of the keyboard. */
function shift(helper: ShiftMultiSelect<Trick>, type: 'keydown' | 'keyup') {
	helper.onShiftKeyDown(new KeyboardEvent(type, { key: 'Shift' }));
}

/** What the checkbox group hands to `onValueChange` when `value` is toggled. */
function toggled(current: readonly string[], value: string): string[] {
	return current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
}

describe('ShiftMultiSelect (T020a, R-13)', () => {
	it('takes a plain toggle as-is and records the anchor', () => {
		const helper = createHelper();

		helper.onValueChange(toggled(helper.value, 'tre-flip'));

		expect(helper.value).toEqual(['tre-flip']);
		expect(helper.lastSelected).toBe(2);
		expect(helper.isShiftPressed).toBe(false);
	});

	it('tracks the Shift key from keydown and keyup only', () => {
		const helper = createHelper();

		helper.onShiftKeyDown(new KeyboardEvent('keydown', { key: 'a' }));
		expect(helper.isShiftPressed).toBe(false);

		shift(helper, 'keydown');
		expect(helper.isShiftPressed).toBe(true);

		shift(helper, 'keyup');
		expect(helper.isShiftPressed).toBe(false);
	});

	it('selects every item between the anchor and the click, forwards', () => {
		const helper = createHelper();
		helper.onValueChange(toggled(helper.value, 'heelflip'));

		shift(helper, 'keydown');
		helper.onValueChange(toggled(helper.value, 'fs-540'));

		expect(helper.value).toEqual(['heelflip', 'tre-flip', 'pizza-guy', 'fs-540']);
		expect(helper.lastSelected).toBe(4);
	});

	it('selects every item between the anchor and the click, backwards', () => {
		const helper = createHelper();
		helper.onValueChange(toggled(helper.value, 'fs-540'));

		shift(helper, 'keydown');
		helper.onValueChange(toggled(helper.value, 'heelflip'));

		expect(helper.value).toEqual(['fs-540', 'heelflip', 'tre-flip', 'pizza-guy']);
		expect(helper.lastSelected).toBe(1);
	});

	it('clears the whole range when the clicked item was already selected', () => {
		const helper = createHelper();
		helper.onValueChange(toggled(helper.value, 'kickflip'));
		shift(helper, 'keydown');
		helper.onValueChange(toggled(helper.value, 'fs-540'));
		expect(helper.value).toHaveLength(5);

		// The anchor is now `fs-540` (index 4), so deselecting `tre-flip` (index 2) clears 2…4.
		helper.onValueChange(toggled(helper.value, 'tre-flip'));

		expect(helper.value).toEqual(['kickflip', 'heelflip']);
		expect(helper.lastSelected).toBe(2);
	});

	it('falls back to a plain toggle while Shift is held with no anchor yet', () => {
		const helper = createHelper();
		shift(helper, 'keydown');

		helper.onValueChange(toggled(helper.value, 'pizza-guy'));

		expect(helper.value).toEqual(['pizza-guy']);
		expect(helper.lastSelected).toBe(3);
	});

	it('ignores a change that moved nothing', () => {
		const helper = createHelper();
		helper.onValueChange(toggled(helper.value, 'kickflip'));
		shift(helper, 'keydown');

		helper.onValueChange(['kickflip']);

		expect(helper.value).toEqual(['kickflip']);
		expect(helper.lastSelected).toBe(0);
	});
});
