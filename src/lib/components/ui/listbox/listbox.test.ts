import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	calculateGridLayout,
	findEnabledItem,
	getMaxItemValue,
	getMinItemValue,
	ListboxCollection,
	ListboxTypeahead,
	type ListboxItemData,
	type ListboxMountedItem
} from './index.js';
import Harness, {
	LISTBOX_GRID_OPTIONS,
	LISTBOX_OPTIONS,
	LISTBOX_TYPEAHEAD_OPTIONS,
	type ListboxHarnessOption,
	type ListboxHarnessProps
} from './listbox.test.svelte';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** The default list with a disabled option wedged into the middle, for the skip-over cases. */
const LISTBOX_DISABLED_MIDDLE_OPTIONS: readonly ListboxHarnessOption[] = [
	{ value: 'kickflip', label: 'Kickflip' },
	{ value: 'impossible', label: 'Impossible', disabled: true },
	{ value: 'heelflip', label: 'Heelflip' },
	{ value: 'fs-540', label: 'FS 540' }
];

function renderListbox(props: ListboxHarnessProps = {}) {
	return render(Harness, { props });
}

function listbox(): HTMLElement {
	return screen.getByRole('listbox');
}

function option(value: string): HTMLElement {
	return screen.getByTestId(`option-${value}`);
}

function allBySlot(slot: string): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`));
}

function queryBySlot(slot: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
}

/** The value of the option carrying the roving focus marker. */
function focusedValue(): string | null {
	const element = document.querySelector<HTMLElement>('[data-slot="listbox-item"][data-focused]');
	return element?.dataset.testid?.replace('option-', '') ?? null;
}

/** The value of the option carrying the pointer/keyboard highlight. */
function highlightedValue(): string | null {
	const element = document.querySelector<HTMLElement>(
		'[data-slot="listbox-item"][data-highlighted]'
	);
	return element?.dataset.testid?.replace('option-', '') ?? null;
}

function selectedValues(): string[] {
	return allBySlot('listbox-item')
		.filter((element) => element.hasAttribute('data-selected'))
		.map((element) => element.dataset.testid?.replace('option-', '') ?? '');
}

/**
 * Walk from the document body into the listbox with real `Tab` presses: the harness renders a
 * focusable button before the root, so the second `Tab` is the one that enters it.
 */
async function tabIntoListbox(user: ReturnType<typeof userEvent.setup>): Promise<void> {
	await user.tab();
	await user.tab();
	await tick();
}

/**
 * jsdom reports every `getBoundingClientRect()` as zero, which would make `calculateGridLayout` see
 * one row of N columns. Give each rendered option the rect it would have in a `columns`-wide CSS
 * grid so the `orientation="mixed"` geometry is deterministic (research R-07).
 */
function stubGrid(columns: number): void {
	allBySlot('listbox-item').forEach((element, index) => {
		const row = Math.floor(index / columns);
		const column = index % columns;
		const rect: DOMRect = {
			top: row * 50,
			bottom: row * 50 + 50,
			left: column * 100,
			right: column * 100 + 100,
			width: 100,
			height: 50,
			x: column * 100,
			y: row * 50,
			toJSON: () => ({})
		};
		element.getBoundingClientRect = () => rect;
	});
}

/** A `ListboxMountedItem` for the pure navigation helpers, which never touch the element. */
function fakeItem(value: string, disabled = false): ListboxMountedItem {
	return {
		element: document.createElement('div'),
		value,
		disabled,
		onSelect: undefined,
		groupId: undefined,
		textValue: value
	};
}

/** A registrable collection entry, with everything the collection itself never reads left empty. */
function collectionEntry(
	element: HTMLElement | null,
	value: string,
	{ disabled = false, groupId }: { disabled?: boolean; groupId?: string } = {}
): ListboxItemData {
	return { element, value, disabled, onSelect: undefined, groupId, textValue: value };
}

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// keyboard interaction — US2 FR-006..008, US3 FR-010..021, US4 FR-012..013
// ---------------------------------------------------------------------------

describe('Listbox keyboard interaction', () => {
	it('focuses the first enabled option when Tab enters the listbox', async () => {
		const user = userEvent.setup();
		renderListbox();

		await tabIntoListbox(user);

		expect(option('kickflip')).toHaveFocus();
	});

	it('moves focus with ArrowDown and ArrowUp in the default vertical orientation', async () => {
		const user = userEvent.setup();
		renderListbox();

		await tabIntoListbox(user);
		await user.keyboard('{ArrowDown}');
		expect(option('heelflip')).toHaveFocus();

		await user.keyboard('{ArrowDown}');
		expect(option('fs-540')).toHaveFocus();

		await user.keyboard('{ArrowUp}');
		expect(option('heelflip')).toHaveFocus();
	});

	it('stops at the boundaries when loop is off', async () => {
		const user = userEvent.setup();
		renderListbox();

		await tabIntoListbox(user);
		await user.keyboard('{ArrowUp}');

		expect(option('kickflip')).toHaveFocus();
	});

	it('wraps around both ends when loop is on', async () => {
		const user = userEvent.setup();
		renderListbox({ loop: true });

		await tabIntoListbox(user);
		await user.keyboard('{ArrowUp}');
		expect(option('fs-540')).toHaveFocus();

		await user.keyboard('{ArrowDown}');
		expect(option('kickflip')).toHaveFocus();
	});

	it('ignores the horizontal arrows in a vertical listbox', async () => {
		const user = userEvent.setup();
		renderListbox();

		await tabIntoListbox(user);
		await user.keyboard('{ArrowRight}{ArrowLeft}');

		expect(option('kickflip')).toHaveFocus();
	});

	it('moves focus with ArrowRight and ArrowLeft in a horizontal listbox', async () => {
		const user = userEvent.setup();
		renderListbox({ orientation: 'horizontal' });

		await tabIntoListbox(user);
		await user.keyboard('{ArrowRight}');
		expect(option('heelflip')).toHaveFocus();

		await user.keyboard('{ArrowLeft}');
		expect(option('kickflip')).toHaveFocus();
	});

	it('ignores the vertical arrows in a horizontal listbox', async () => {
		const user = userEvent.setup();
		renderListbox({ orientation: 'horizontal' });

		await tabIntoListbox(user);
		await user.keyboard('{ArrowDown}{ArrowUp}');

		expect(option('kickflip')).toHaveFocus();
	});

	it('navigates a mixed grid along both axes', async () => {
		const user = userEvent.setup();
		renderListbox({ orientation: 'mixed', options: LISTBOX_GRID_OPTIONS });
		stubGrid(3);

		await tabIntoListbox(user);
		expect(option('one')).toHaveFocus();

		await user.keyboard('{ArrowRight}');
		expect(option('two')).toHaveFocus();

		await user.keyboard('{ArrowDown}');
		expect(option('five')).toHaveFocus();

		await user.keyboard('{ArrowUp}');
		expect(option('two')).toHaveFocus();
	});

	it('wraps within the column of a looping mixed grid', async () => {
		const user = userEvent.setup();
		renderListbox({ orientation: 'mixed', loop: true, options: LISTBOX_GRID_OPTIONS });
		stubGrid(3);

		await tabIntoListbox(user);
		await user.keyboard('{ArrowDown}');
		expect(option('four')).toHaveFocus();

		await user.keyboard('{ArrowDown}');
		expect(option('one')).toHaveFocus();

		await user.keyboard('{ArrowUp}');
		expect(option('four')).toHaveFocus();
	});

	it('wraps along the row axis of a looping mixed grid', async () => {
		const user = userEvent.setup();
		renderListbox({ orientation: 'mixed', loop: true, options: LISTBOX_GRID_OPTIONS });
		stubGrid(3);

		await tabIntoListbox(user);
		expect(option('one')).toHaveFocus();

		// The row axis walks the flat collection rather than the grid, so it wraps at the ends of
		// the whole list — the same `findEnabledItem` wrap upstream uses.
		await user.keyboard('{ArrowLeft}');
		expect(option('six')).toHaveFocus();

		await user.keyboard('{ArrowRight}');
		expect(option('one')).toHaveFocus();

		// And within a row it is a plain step, crossing the row boundary on the way.
		await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
		expect(option('four')).toHaveFocus();
	});

	it('sends focus to the first and last option with Home and End', async () => {
		const user = userEvent.setup();
		renderListbox();

		await tabIntoListbox(user);
		await user.keyboard('{End}');
		expect(option('fs-540')).toHaveFocus();

		await user.keyboard('{Home}');
		expect(option('kickflip')).toHaveFocus();
	});

	it('treats PageDown and PageUp exactly like ArrowDown and ArrowUp', async () => {
		const user = userEvent.setup();
		renderListbox();

		await tabIntoListbox(user);
		await user.keyboard('{PageDown}');
		expect(option('heelflip')).toHaveFocus();

		await user.keyboard('{PageUp}');
		expect(option('kickflip')).toHaveFocus();
	});

	it('moves PageDown and PageUp one grid row, like the vertical arrows', async () => {
		const user = userEvent.setup();
		renderListbox({ orientation: 'mixed', options: LISTBOX_GRID_OPTIONS });
		stubGrid(3);

		await tabIntoListbox(user);
		await user.keyboard('{ArrowRight}');
		expect(option('two')).toHaveFocus();

		await user.keyboard('{PageDown}');
		expect(option('five')).toHaveFocus();

		await user.keyboard('{PageUp}');
		expect(option('two')).toHaveFocus();
	});

	it('selects the focused option with Enter and with Space', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderListbox({ onValueChange });

		await tabIntoListbox(user);
		await user.keyboard('{ArrowDown}{Enter}');
		expect(onValueChange).toHaveBeenLastCalledWith('heelflip');

		await user.keyboard('{ArrowDown}[Space]');
		expect(onValueChange).toHaveBeenLastCalledWith('fs-540');
	});

	it('clears focus and highlight with Escape without touching the selection', async () => {
		const user = userEvent.setup();
		renderListbox({ defaultValue: 'kickflip' });

		await tabIntoListbox(user);
		expect(focusedValue()).toBe('kickflip');

		await user.keyboard('{Escape}');
		await tick();

		expect(focusedValue()).toBeNull();
		expect(highlightedValue()).toBeNull();
		expect(selectedValues()).toEqual(['kickflip']);
	});

	it('returns focus to the root on Shift+Tab and restores the remembered option on Tab', async () => {
		const user = userEvent.setup();
		renderListbox();

		await tabIntoListbox(user);
		await user.keyboard('{ArrowDown}');
		expect(option('heelflip')).toHaveFocus();

		// Shift+Tab hands focus back to the root and drops the *active* focus; the browser's own
		// default action is then what carries on out of the listbox.
		await user.tab({ shift: true });
		await tick();
		expect(listbox()).toHaveFocus();
		expect(focusedValue()).toBeNull();

		await user.tab({ shift: true });
		await tick();
		expect(screen.getByTestId('before')).toHaveFocus();

		// The remembered option survived the round trip, so Tab lands back on it rather than first.
		await user.tab();
		await tick();
		expect(option('heelflip')).toHaveFocus();
	});

	it('leaves the listbox forwards on Tab', async () => {
		const user = userEvent.setup();
		renderListbox();

		await tabIntoListbox(user);
		await user.tab();

		expect(screen.getByTestId('after')).toHaveFocus();
	});

	it('jumps to the option whose text starts with the typed characters', async () => {
		const user = userEvent.setup();
		renderListbox({ options: LISTBOX_TYPEAHEAD_OPTIONS });

		await tabIntoListbox(user);
		await user.keyboard('h');
		expect(option('heelflip')).toHaveFocus();

		await user.keyboard('a');
		expect(option('hardflip')).toHaveFocus();
	});

	it('cycles through options sharing a first letter when it is repeated', async () => {
		const user = userEvent.setup();
		renderListbox({ options: LISTBOX_TYPEAHEAD_OPTIONS });

		await tabIntoListbox(user);
		await user.keyboard('h');
		expect(option('heelflip')).toHaveFocus();

		await user.keyboard('h');
		expect(option('hardflip')).toHaveFocus();

		await user.keyboard('h');
		expect(option('hospital-flip')).toHaveFocus();

		await user.keyboard('h');
		expect(option('heelflip')).toHaveFocus();
	});

	it('restarts the typeahead buffer after the 1000 ms reset window', async () => {
		vi.useFakeTimers();
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		renderListbox({ options: LISTBOX_TYPEAHEAD_OPTIONS });

		await tabIntoListbox(user);
		await user.keyboard('h');
		await user.keyboard('a');
		expect(option('hardflip')).toHaveFocus();

		await vi.advanceTimersByTimeAsync(1500);

		// A stale buffer would read "hah" and match nothing; a reset one reads "h" and cycles on.
		await user.keyboard('h');
		expect(option('hospital-flip')).toHaveFocus();
	});

	it('extends an in-progress typeahead buffer with a space rather than selecting', async () => {
		vi.useFakeTimers();
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		renderListbox({ binding: 'value', value: '' });

		await tabIntoListbox(user);
		// "FS 540" is only reachable past its space if the space joins the buffer instead of
		// selecting whatever the first word already landed on.
		await user.keyboard('fs 5');

		expect(option('fs-540')).toHaveFocus();
		expect(selectedValues()).toEqual([]);

		// Once the buffer resets, the same key is the selection key again.
		await vi.advanceTimersByTimeAsync(1500);
		await user.keyboard('[Space]');
		await tick();

		expect(selectedValues()).toEqual(['fs-540']);
	});

	it('selects every enabled option with Ctrl+A in multiple mode', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderListbox({ multiple: true, binding: 'value', value: [], onValueChange });

		await tabIntoListbox(user);
		await user.keyboard('{Control>}a{/Control}');
		await tick();

		expect(onValueChange).toHaveBeenCalledWith(['kickflip', 'heelflip', 'fs-540']);
		expect(selectedValues()).toEqual(['kickflip', 'heelflip', 'fs-540']);
	});

	it('selects every enabled option with Meta+A in multiple mode', async () => {
		const user = userEvent.setup();
		renderListbox({ multiple: true, binding: 'value', value: [] });

		await tabIntoListbox(user);
		await user.keyboard('{Meta>}a{/Meta}');
		await tick();

		expect(selectedValues()).toEqual(['kickflip', 'heelflip', 'fs-540']);
	});

	it('leaves a disabled option out of the Ctrl+A selection', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderListbox({
			multiple: true,
			binding: 'value',
			value: [],
			onValueChange,
			options: LISTBOX_DISABLED_MIDDLE_OPTIONS
		});

		await tabIntoListbox(user);
		await user.keyboard('{Control>}a{/Control}');
		await tick();

		expect(onValueChange).toHaveBeenCalledWith(['kickflip', 'heelflip', 'fs-540']);
		expect(selectedValues()).toEqual(['kickflip', 'heelflip', 'fs-540']);
		expect(option('impossible')).not.toHaveAttribute('data-selected');
	});

	it('leaves Ctrl+A alone in single-selection mode', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderListbox({ binding: 'value', value: '', onValueChange });

		await tabIntoListbox(user);
		await user.keyboard('{Control>}a{/Control}');
		await tick();

		expect(onValueChange).not.toHaveBeenCalled();
		expect(selectedValues()).toEqual([]);
	});

	it('grows and shrinks a range with Shift and the arrow keys in multiple mode', async () => {
		const user = userEvent.setup();
		renderListbox({ multiple: true, binding: 'value', value: [] });

		await tabIntoListbox(user);
		await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
		await tick();
		expect(selectedValues()).toEqual(['kickflip', 'heelflip']);

		await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
		await tick();
		expect(selectedValues()).toEqual(['kickflip', 'heelflip', 'fs-540']);

		await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
		await tick();
		expect(selectedValues()).toEqual(['kickflip', 'heelflip']);
	});

	it('excludes a disabled option from a range that spans it', async () => {
		const user = userEvent.setup();
		renderListbox({
			multiple: true,
			binding: 'value',
			value: [],
			options: LISTBOX_DISABLED_MIDDLE_OPTIONS
		});

		await tabIntoListbox(user);
		// The range is a contiguous slice of the *enabled* items, so growing across the disabled
		// option steps straight over it (research R-09).
		await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
		await tick();
		expect(option('heelflip')).toHaveFocus();
		expect(selectedValues()).toEqual(['kickflip', 'heelflip']);

		await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
		await tick();
		expect(selectedValues()).toEqual(['kickflip', 'heelflip', 'fs-540']);
		expect(option('impossible')).not.toHaveAttribute('data-selected');
	});

	it('treats Shift+arrow as a plain arrow in single-selection mode', async () => {
		const user = userEvent.setup();
		renderListbox({ binding: 'value', value: '' });

		await tabIntoListbox(user);
		await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
		await tick();

		expect(option('heelflip')).toHaveFocus();
		expect(selectedValues()).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// accessibility roles and names — US3 FR-017, US5 FR-023..024a, SC-003
// ---------------------------------------------------------------------------

describe('Listbox accessibility', () => {
	it('exposes the documented roles', async () => {
		renderListbox();
		await tick();

		expect(listbox()).toBeInTheDocument();
		expect(screen.getAllByRole('option')).toHaveLength(3);
	});

	it('reflects selection through aria-selected on every option', async () => {
		renderListbox({ defaultValue: 'kickflip' });
		await tick();

		expect(option('kickflip')).toHaveAttribute('aria-selected', 'true');
		expect(option('heelflip')).toHaveAttribute('aria-selected', 'false');
		expect(option('fs-540')).toHaveAttribute('aria-selected', 'false');
	});

	it('marks disabled options with aria-disabled and data-disabled', async () => {
		renderListbox({
			options: [...LISTBOX_OPTIONS, { value: 'impossible', label: 'Impossible', disabled: true }]
		});
		await tick();

		expect(option('impossible')).toHaveAttribute('aria-disabled', 'true');
		expect(option('impossible')).toHaveAttribute('data-disabled', '');
		expect(option('kickflip')).not.toHaveAttribute('aria-disabled');
	});

	it('marks a disabled root with aria-disabled, data-disabled and no tab stop', async () => {
		renderListbox({ disabled: true });
		await tick();

		expect(listbox()).toHaveAttribute('aria-disabled', 'true');
		expect(listbox()).toHaveAttribute('data-disabled', '');
		expect(listbox()).not.toHaveAttribute('tabindex');
	});

	it('is the single tab stop while enabled', async () => {
		renderListbox();
		await tick();

		expect(listbox()).toHaveAttribute('tabindex', '0');
		for (const element of allBySlot('listbox-item')) {
			expect(element).toHaveAttribute('tabindex', '-1');
		}
	});

	it('exposes aria-multiselectable only in multiple mode', async () => {
		const single = renderListbox();
		await tick();
		expect(listbox()).not.toHaveAttribute('aria-multiselectable');
		single.unmount();

		renderListbox({ multiple: true });
		await tick();
		expect(listbox()).toHaveAttribute('aria-multiselectable', 'true');
	});

	it('names each group with its group label', async () => {
		renderListbox({ withGroups: true });
		await tick();

		const groups = screen.getAllByRole('group');
		expect(groups).toHaveLength(2);

		const labelId = groups[0]?.getAttribute('aria-labelledby');
		expect(labelId).toBeTruthy();
		expect(document.getElementById(labelId ?? '')).toHaveTextContent('Basic Tricks');
	});

	it('navigates across group boundaries as if the grouping were not there', async () => {
		const user = userEvent.setup();
		renderListbox({ withGroups: true });

		await tabIntoListbox(user);
		await user.keyboard('{ArrowDown}{ArrowDown}');

		expect(option('fs-540')).toHaveFocus();
	});

	it('gives the active option real DOM focus', async () => {
		const user = userEvent.setup();
		renderListbox();

		await tabIntoListbox(user);

		expect(document.activeElement).toBe(option('kickflip'));
		expect(option('kickflip')).toHaveAttribute('data-focused', '');
	});

	it('mounts the item indicator only once its option is selected', async () => {
		const user = userEvent.setup();
		renderListbox({ binding: 'value', value: '' });
		await tick();

		expect(screen.queryByTestId('indicator-kickflip')).toBeNull();

		await user.click(option('kickflip'));
		await tick();

		expect(screen.getByTestId('indicator-kickflip')).toBeInTheDocument();
		expect(screen.getByTestId('indicator-kickflip')).toHaveAttribute('aria-hidden', 'true');
	});

	it('mounts every item indicator when forceMount is set', async () => {
		renderListbox({ itemIndicatorForceMount: true });
		await tick();

		expect(allBySlot('listbox-item-indicator')).toHaveLength(3);
		for (const element of allBySlot('listbox-item-indicator')) {
			expect(element).toHaveAttribute('aria-hidden', 'true');
		}
	});

	it('reflects the orientation on the root', async () => {
		const vertical = renderListbox();
		await tick();
		expect(listbox()).toHaveAttribute('data-orientation', 'vertical');
		vertical.unmount();

		const horizontal = renderListbox({ orientation: 'horizontal' });
		await tick();
		expect(listbox()).toHaveAttribute('data-orientation', 'horizontal');
		horizontal.unmount();

		renderListbox({ orientation: 'mixed' });
		await tick();
		expect(listbox()).toHaveAttribute('data-orientation', 'mixed');
	});

	it('applies the same attributes to caller-supplied elements in child mode', async () => {
		renderListbox({ asChild: true, withGroups: true, itemIndicatorForceMount: true });
		await tick();

		const root = listbox();
		expect(root.tagName).toBe('SECTION');
		expect(root).toHaveAttribute('data-slot', 'listbox');
		expect(root).toHaveAttribute('data-orientation', 'vertical');

		const group = screen.getAllByRole('group')[0];
		expect(group?.tagName).toBe('FIELDSET');
		expect(group).toHaveAttribute('data-slot', 'listbox-group');

		const label = screen.getByTestId('group-label-Basic Tricks');
		expect(label.tagName).toBe('H3');
		expect(label).toHaveAttribute('data-slot', 'listbox-group-label');
		expect(group).toHaveAttribute('aria-labelledby', label.id);

		const item = option('kickflip');
		expect(item.tagName).toBe('SPAN');
		expect(item).toHaveAttribute('role', 'option');
		expect(item).toHaveAttribute('aria-selected', 'false');

		const indicator = screen.getByTestId('indicator-kickflip');
		expect(indicator.tagName).toBe('I');
		expect(indicator).toHaveAttribute('aria-hidden', 'true');
	});

	it('still reaches child-mode options with the keyboard', async () => {
		const user = userEvent.setup();
		renderListbox({ asChild: true });

		await tabIntoListbox(user);
		expect(option('kickflip')).toHaveFocus();

		await user.keyboard('{ArrowDown}');
		expect(option('heelflip')).toHaveFocus();
	});
});

// ---------------------------------------------------------------------------
// pointer highlighting — FR-022
// ---------------------------------------------------------------------------

describe('Listbox pointer highlighting', () => {
	it('highlights the hovered option and moves the highlight with the pointer', async () => {
		const user = userEvent.setup();
		renderListbox();
		await tick();

		await user.hover(option('heelflip'));
		await tick();
		expect(option('heelflip')).toHaveAttribute('data-highlighted', '');

		await user.hover(option('kickflip'));
		await tick();
		expect(option('kickflip')).toHaveAttribute('data-highlighted', '');
		expect(option('heelflip')).not.toHaveAttribute('data-highlighted');
	});

	it('clears the highlight when the pointer leaves', async () => {
		const user = userEvent.setup();
		renderListbox();
		await tick();

		await user.hover(option('kickflip'));
		await tick();
		expect(option('kickflip')).toHaveAttribute('data-highlighted', '');

		await user.unhover(option('kickflip'));
		await tick();
		expect(option('kickflip')).not.toHaveAttribute('data-highlighted');
	});

	it('never highlights a disabled option', async () => {
		const user = userEvent.setup();
		renderListbox({
			options: [...LISTBOX_OPTIONS, { value: 'impossible', label: 'Impossible', disabled: true }]
		});
		await tick();

		await user.hover(option('impossible'));
		await tick();

		expect(option('impossible')).not.toHaveAttribute('data-highlighted');
	});

	it('keeps the highlight distinct from selection and from DOM focus', async () => {
		const user = userEvent.setup();
		renderListbox({ defaultValue: 'kickflip' });
		await tick();

		await user.hover(option('fs-540'));
		await tick();

		expect(highlightedValue()).toBe('fs-540');
		expect(selectedValues()).toEqual(['kickflip']);
		expect(option('fs-540')).not.toHaveFocus();
		expect(option('fs-540')).not.toHaveAttribute('data-focused');
	});
});

// ---------------------------------------------------------------------------
// controlled vs uncontrolled — US1 FR-003..004, US2 FR-005..006a, FR-027
// ---------------------------------------------------------------------------

describe('Listbox value state', () => {
	it('seeds an uncontrolled listbox from defaultValue', async () => {
		renderListbox({ defaultValue: 'heelflip' });
		await tick();

		expect(selectedValues()).toEqual(['heelflip']);
	});

	it('keeps uncontrolled selection across a re-render', async () => {
		const user = userEvent.setup();
		const { rerender } = renderListbox({ defaultValue: 'heelflip' });

		await user.click(option('fs-540'));
		await tick();
		expect(selectedValues()).toEqual(['fs-540']);

		await rerender({ defaultValue: 'heelflip' });
		await tick();

		expect(selectedValues()).toEqual(['fs-540']);
	});

	it('replaces the selection when a different option is clicked in single mode', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderListbox({ binding: 'value', value: 'kickflip', onValueChange });

		await user.click(option('heelflip'));
		await tick();

		expect(onValueChange).toHaveBeenCalledWith('heelflip');
		expect(selectedValues()).toEqual(['heelflip']);
	});

	it('clears the selection when the selected option is clicked again in single mode', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderListbox({ binding: 'value', value: 'kickflip', onValueChange });

		await user.click(option('kickflip'));
		await tick();

		expect(onValueChange).toHaveBeenCalledWith('');
		expect(selectedValues()).toEqual([]);
	});

	it('toggles options independently in multiple mode', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderListbox({ multiple: true, binding: 'value', value: [], onValueChange });

		await user.click(option('kickflip'));
		await tick();
		expect(onValueChange).toHaveBeenLastCalledWith(['kickflip']);

		await user.click(option('heelflip'));
		await tick();
		expect(onValueChange).toHaveBeenLastCalledWith(['kickflip', 'heelflip']);
		expect(selectedValues()).toEqual(['kickflip', 'heelflip']);

		await user.click(option('kickflip'));
		await tick();
		expect(onValueChange).toHaveBeenLastCalledWith(['heelflip']);
		expect(selectedValues()).toEqual(['heelflip']);
	});

	it('never moves on its own while an authoritative parent declines the write', async () => {
		const onDeclinedValue = vi.fn();
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderListbox({
			binding: 'function',
			authoritative: 'kickflip',
			onDeclinedValue,
			onValueChange
		});

		await user.click(option('heelflip'));
		await tick();

		expect(onDeclinedValue).toHaveBeenCalledWith('heelflip');
		expect(onValueChange).toHaveBeenCalledWith('heelflip');
		expect(selectedValues()).toEqual(['kickflip']);
	});

	it('fires the item onSelect with its own value before onValueChange', async () => {
		const onSelect = vi.fn();
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderListbox({ binding: 'value', value: '', onSelect, onValueChange });

		await user.click(option('heelflip'));
		await tick();

		expect(onSelect).toHaveBeenCalledWith('heelflip');
		expect(onSelect.mock.invocationCallOrder[0]).toBeLessThan(
			onValueChange.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
		);
	});

	it('fires the item onSelect from Enter and from Space', async () => {
		const onSelect = vi.fn();
		const user = userEvent.setup();
		renderListbox({ binding: 'value', value: '', onSelect });

		await tabIntoListbox(user);
		await user.keyboard('{Enter}');
		expect(onSelect).toHaveBeenCalledWith('kickflip');

		await user.keyboard('{ArrowDown}[Space]');
		expect(onSelect).toHaveBeenLastCalledWith('heelflip');
	});

	it('never fires onSelect for a disabled option or under a disabled root', async () => {
		const onSelect = vi.fn();
		const user = userEvent.setup();
		const disabledItem = renderListbox({
			onSelect,
			options: [{ value: 'impossible', label: 'Impossible', disabled: true }]
		});

		await user.click(option('impossible'));
		await tick();
		expect(onSelect).not.toHaveBeenCalled();
		disabledItem.unmount();

		renderListbox({ onSelect, disabled: true });
		await user.click(option('kickflip'));
		await tick();

		expect(onSelect).not.toHaveBeenCalled();
	});

	it('submits a single value through a hidden form input', async () => {
		const user = userEvent.setup();
		let submitted: string[] = [];
		renderListbox({
			withForm: true,
			name: 'trick',
			defaultValue: 'heelflip',
			onSubmit: (event) => {
				event.preventDefault();
				submitted = new FormData(event.currentTarget as HTMLFormElement).getAll(
					'trick'
				) as string[];
			}
		});
		await tick();

		await user.click(screen.getByRole('button', { name: 'Submit' }));

		expect(submitted).toEqual(['heelflip']);
	});

	it('submits every selected value under multiple through one input each', async () => {
		const user = userEvent.setup();
		let submitted: string[] = [];
		renderListbox({
			withForm: true,
			multiple: true,
			name: 'tricks',
			defaultValue: ['kickflip', 'fs-540'],
			onSubmit: (event) => {
				event.preventDefault();
				submitted = new FormData(event.currentTarget as HTMLFormElement).getAll(
					'tricks'
				) as string[];
			}
		});
		await tick();

		expect(allBySlot('listbox-form-input')).toHaveLength(2);

		await user.click(screen.getByRole('button', { name: 'Submit' }));

		expect(submitted).toEqual(['kickflip', 'fs-540']);
	});

	it('submits nothing while the listbox is disabled', async () => {
		const user = userEvent.setup();
		let submitted: string[] = [];
		renderListbox({
			withForm: true,
			name: 'trick',
			disabled: true,
			defaultValue: 'heelflip',
			onSubmit: (event) => {
				event.preventDefault();
				submitted = new FormData(event.currentTarget as HTMLFormElement).getAll(
					'trick'
				) as string[];
			}
		});
		await tick();

		await user.click(screen.getByRole('button', { name: 'Submit' }));

		expect(submitted).toEqual([]);
	});

	it('renders no hidden input outside a form', async () => {
		renderListbox({ name: 'trick', defaultValue: 'heelflip' });
		await tick();

		expect(queryBySlot('listbox-form-input')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// RTL — US6 FR-028, SC-006
// ---------------------------------------------------------------------------

describe('Listbox RTL', () => {
	it('inverts the horizontal arrows under an explicit dir="rtl"', async () => {
		const user = userEvent.setup();
		renderListbox({ dir: 'rtl', orientation: 'horizontal' });
		await tick();

		expect(listbox()).toHaveAttribute('dir', 'rtl');

		await tabIntoListbox(user);
		await user.keyboard('{ArrowLeft}');
		expect(option('heelflip')).toHaveFocus();

		await user.keyboard('{ArrowRight}');
		expect(option('kickflip')).toHaveFocus();
	});

	it('inherits rtl from an ambient DirectionProvider with no dir prop', async () => {
		const user = userEvent.setup();
		renderListbox({ providerDir: 'rtl', orientation: 'horizontal' });
		await tick();

		expect(listbox()).toHaveAttribute('dir', 'rtl');

		await tabIntoListbox(user);
		await user.keyboard('{ArrowLeft}');

		expect(option('heelflip')).toHaveFocus();
	});

	it('inverts only the row axis of an rtl mixed grid', async () => {
		const user = userEvent.setup();
		renderListbox({ dir: 'rtl', orientation: 'mixed', options: LISTBOX_GRID_OPTIONS });
		stubGrid(3);

		await tabIntoListbox(user);
		await user.keyboard('{ArrowLeft}');
		expect(option('two')).toHaveFocus();

		await user.keyboard('{ArrowDown}');
		expect(option('five')).toHaveFocus();

		await user.keyboard('{ArrowUp}');
		expect(option('two')).toHaveFocus();

		await user.keyboard('{ArrowRight}');
		expect(option('one')).toHaveFocus();
	});

	it('renders dir="ltr" by default', async () => {
		renderListbox();
		await tick();

		expect(listbox()).toHaveAttribute('dir', 'ltr');
	});
});

// ---------------------------------------------------------------------------
// edge cases and guard rails — FR-016, FR-025, FR-026, spec Edge Cases
// ---------------------------------------------------------------------------

describe('Listbox guard rails', () => {
	it('throws when an item is given an empty value', () => {
		expect(() => renderListbox({ mode: 'empty-item-value' })).toThrow(
			'ListboxItem value cannot be an empty string'
		);
	});

	it('throws when Item is used outside Listbox.Root', () => {
		expect(() => renderListbox({ mode: 'bare-item' })).toThrow(
			'`<Listbox.Item>` must be used within `<Listbox.Root>`.'
		);
	});

	it('throws when Group is used outside Listbox.Root', () => {
		expect(() => renderListbox({ mode: 'bare-group' })).toThrow(
			'`<Listbox.Group>` must be used within `<Listbox.Root>`.'
		);
	});

	it('throws when GroupLabel is used outside Listbox.Group', () => {
		expect(() => renderListbox({ mode: 'bare-group-label' })).toThrow(
			'`<Listbox.GroupLabel>` must be used within `<Listbox.Group>`.'
		);
		expect(() => renderListbox({ mode: 'group-label-without-group' })).toThrow(
			'`<Listbox.GroupLabel>` must be used within `<Listbox.Group>`.'
		);
	});

	it('throws when ItemIndicator is used outside Listbox.Item', () => {
		expect(() => renderListbox({ mode: 'bare-item-indicator' })).toThrow(
			'`<Listbox.ItemIndicator>` must be used within `<Listbox.Item>`.'
		);
		expect(() => renderListbox({ mode: 'item-indicator-without-item' })).toThrow(
			'`<Listbox.ItemIndicator>` must be used within `<Listbox.Item>`.'
		);
	});

	it('blocks focus, selection and keyboard handling while the root is disabled', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderListbox({ disabled: true, onValueChange });
		await tick();

		expect(option('kickflip')).toHaveAttribute('data-disabled', '');

		await user.click(option('kickflip'));
		await tick();
		expect(onValueChange).not.toHaveBeenCalled();

		await user.tab();
		await user.tab();
		await tick();

		expect(screen.getByTestId('after')).toHaveFocus();
		expect(focusedValue()).toBeNull();
	});

	it('skips a disabled option with every navigation key and with typeahead', async () => {
		const user = userEvent.setup();
		renderListbox({
			options: [
				{ value: 'kickflip', label: 'Kickflip' },
				{ value: 'impossible', label: 'Impossible', disabled: true },
				{ value: 'heelflip', label: 'Heelflip' }
			]
		});

		await tabIntoListbox(user);
		await user.keyboard('{ArrowDown}');
		expect(option('heelflip')).toHaveFocus();

		await user.keyboard('{End}');
		expect(option('heelflip')).toHaveFocus();

		await user.keyboard('{Home}');
		expect(option('kickflip')).toHaveFocus();

		await user.keyboard('{PageDown}');
		expect(option('heelflip')).toHaveFocus();

		await user.keyboard('i');
		expect(option('impossible')).not.toHaveFocus();
	});

	it('never selects a disabled option by click or by Enter', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderListbox({
			onValueChange,
			options: [{ value: 'impossible', label: 'Impossible', disabled: true }]
		});

		await user.click(option('impossible'));
		await tick();

		expect(onValueChange).not.toHaveBeenCalled();
		expect(selectedValues()).toEqual([]);
	});

	it('never throws when every option is disabled', async () => {
		const user = userEvent.setup();
		renderListbox({
			options: [
				{ value: 'kickflip', label: 'Kickflip', disabled: true },
				{ value: 'heelflip', label: 'Heelflip', disabled: true }
			]
		});

		await tabIntoListbox(user);
		await user.keyboard('{ArrowDown}{ArrowUp}{Home}{End}{PageDown}{Enter}{Escape}');
		await tick();

		expect(focusedValue()).toBeNull();
	});

	it('moves virtual state without calling focus or scrollIntoView on the options', async () => {
		const user = userEvent.setup();
		renderListbox({ virtual: true, binding: 'value', value: '' });
		await tick();

		const focusSpies = LISTBOX_OPTIONS.map((item) => vi.spyOn(option(item.value), 'focus'));
		const scrollSpies = LISTBOX_OPTIONS.map((item) =>
			vi.spyOn(option(item.value), 'scrollIntoView')
		);

		await tabIntoListbox(user);
		expect(focusedValue()).toBe('kickflip');

		await user.keyboard('{ArrowDown}');
		await tick();
		expect(focusedValue()).toBe('heelflip');
		expect(highlightedValue()).toBe('heelflip');

		await user.keyboard('{Enter}');
		await tick();
		expect(selectedValues()).toEqual(['heelflip']);

		for (const spy of [...focusSpies, ...scrollSpies]) {
			expect(spy).not.toHaveBeenCalled();
		}
	});
});

// ---------------------------------------------------------------------------
// exported navigation helpers
// ---------------------------------------------------------------------------

describe('Listbox navigation helpers', () => {
	it('walks to the next and previous enabled item', () => {
		const items = [fakeItem('a'), fakeItem('b', true), fakeItem('c')];

		expect(findEnabledItem(items, { startingIndex: 0 })?.value).toBe('c');
		expect(findEnabledItem(items, { startingIndex: 2, decrement: true })?.value).toBe('a');
	});

	it('wraps only when loop is on', () => {
		const items = [fakeItem('a'), fakeItem('b')];

		expect(findEnabledItem(items, { startingIndex: 1 })?.value).toBe('b');
		expect(findEnabledItem(items, { startingIndex: 1, loop: true })?.value).toBe('a');
	});

	it('reports the first and last enabled values', () => {
		const items = [fakeItem('a', true), fakeItem('b'), fakeItem('c'), fakeItem('d', true)];

		expect(getMinItemValue(items)).toBe('b');
		expect(getMaxItemValue(items)).toBe('c');
		expect(getMinItemValue([])).toBeNull();
		expect(getMaxItemValue([])).toBeNull();
	});

	it('treats anything but a mixed orientation as a single column', () => {
		const items = [fakeItem('a'), fakeItem('b'), fakeItem('c')];

		expect(calculateGridLayout(items, 'vertical')).toEqual({ columnCount: 1, rowCount: 3 });
		expect(calculateGridLayout(items, 'horizontal')).toEqual({ columnCount: 1, rowCount: 3 });
	});

	it('counts the columns of a mixed grid from the measured first row', () => {
		const items = [fakeItem('a'), fakeItem('b'), fakeItem('c'), fakeItem('d')];
		items.forEach((item, index) => {
			const top = index < 2 ? 0 : 100;
			item.element.getBoundingClientRect = () => ({ top, bottom: top + 50 }) as DOMRect;
		});

		expect(calculateGridLayout(items, 'mixed')).toEqual({ columnCount: 2, rowCount: 2 });
	});

	it('matches, narrows and cycles the typeahead buffer', () => {
		const typeahead = new ListboxTypeahead();
		const items = [
			{ ...fakeItem('kickflip'), textValue: 'Kickflip' },
			{ ...fakeItem('heelflip'), textValue: 'Heelflip' },
			{ ...fakeItem('hardflip'), textValue: 'Hardflip' }
		];

		expect(typeahead.handle('h', items, 'kickflip')).toBe('heelflip');
		expect(typeahead.handle('a', items, 'heelflip')).toBe('hardflip');

		typeahead.reset();
		expect(typeahead.search).toBe('');

		expect(typeahead.handle('h', items, 'heelflip')).toBe('hardflip');
		expect(typeahead.handle('h', items, 'hardflip')).toBe('heelflip');
	});
});

// ---------------------------------------------------------------------------
// the exported collection — reusable API for later ports
// ---------------------------------------------------------------------------

describe('Listbox collection', () => {
	it('registers, orders and groups items in the collection', () => {
		const collection = new ListboxCollection();
		const container = document.createElement('div');
		document.body.append(container);

		// Real connected nodes: `getItems()` orders through `compareDocumentPosition`.
		const [first, second, third] = ['a', 'b', 'c'].map((value) => {
			const element = document.createElement('div');
			element.dataset.value = value;
			container.append(element);
			return element;
		});

		// Registered out of document order, and one still-unmounted item on top.
		const unregisterThird = collection.register(collectionEntry(third, 'c', { groupId: 'g1' }));
		collection.register(collectionEntry(first, 'a', { groupId: 'g1' }));
		collection.register(collectionEntry(second, 'b', { disabled: true, groupId: 'g2' }));
		collection.register(collectionEntry(null, 'd', { groupId: 'g1' }));

		expect(collection.size).toBe(4);
		// Unmounted items are counted but never navigated to, and the rest come back in DOM order.
		expect(collection.getItems().map((item) => item.value)).toEqual(['a', 'b', 'c']);
		expect(collection.getEnabledItems().map((item) => item.value)).toEqual(['a', 'c']);
		// Group membership ignores mounting, so `d` is still one of `g1`'s values.
		expect(collection.getGroupValues('g1')).toEqual(['c', 'a', 'd']);
		expect(collection.getGroupValues('g2')).toEqual(['b']);

		unregisterThird();

		expect(collection.size).toBe(3);
		expect(collection.getItems().map((item) => item.value)).toEqual(['a', 'b']);
		expect(collection.getGroupValues('g1')).toEqual(['a', 'd']);

		container.remove();
	});
});
