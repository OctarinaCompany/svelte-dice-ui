import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	ComboboxFilterStore,
	createFilter,
	normalizeWithGaps,
	scoreItem,
	getProgressState,
	isValidProgressMax,
	isValidProgressValue
} from './index.js';
import Harness, {
	COMBOBOX_OPTIONS,
	COMBOBOX_PLACEHOLDER,
	type ComboboxHarnessOption,
	type ComboboxHarnessProps
} from './combobox.test.svelte';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function renderCombobox(props: ComboboxHarnessProps = {}) {
	return render(Harness, { props });
}

function bySlot(slot: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function queryBySlot(slot: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
}

function allBySlot(slot: string): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`));
}

function textInput(): HTMLInputElement {
	return screen.getByPlaceholderText(COMBOBOX_PLACEHOLDER) as HTMLInputElement;
}

/**
 * The popover lives in a portal and, in jsdom, inside a wrapper floating-ui may report as hidden,
 * so the list is always located through `data-slot` — which is also how a consumer styles it.
 */
function optionElements(): HTMLElement[] {
	return allBySlot('combobox-item');
}

function optionLabels(): string[] {
	return optionElements().map((element) => element.textContent?.trim() ?? '');
}

function highlightedOption(): HTMLElement | null {
	return document.querySelector<HTMLElement>('[data-slot="combobox-item"][data-highlighted]');
}

function highlightedLabel(): string | null {
	return highlightedOption()?.textContent?.trim() ?? null;
}

function highlightedBadge(): HTMLElement | null {
	return document.querySelector<HTMLElement>('[data-slot="combobox-badge-item"][data-highlighted]');
}

async function waitForList(): Promise<HTMLElement> {
	await waitFor(() => expect(queryBySlot('combobox-content')).not.toBeNull());
	return bySlot('combobox-content');
}

/** Open the popover from the trigger and wait for the list — and for the input to get focus back. */
async function openFromTrigger(user: ReturnType<typeof userEvent.setup>): Promise<void> {
	await user.click(screen.getByTestId('trigger'));
	await waitForList();
	await waitFor(() => expect(document.activeElement).toBe(textInput()));
}

/**
 * Focus the input with the caret collapsed at position 0.
 *
 * Deliberately not a `userEvent` click: `bits-ui`'s scroll lock blanks `pointer-events` on the body
 * for a modal popover, which makes every pointer interaction impossible while one is open. Focus is
 * what the interaction actually needs, and the keyboard is never blocked.
 */
async function focusInput(): Promise<HTMLInputElement> {
	const element = textInput();
	element.focus();
	element.setSelectionRange(0, 0);
	await tick();
	return element;
}

afterEach(() => {
	// `bits-ui` restores the body styles its scroll lock sets on a later tick than `cleanup()`, so
	// reset them here rather than let one modal test make the next test's clicks impossible.
	document.body.style.pointerEvents = '';
	document.body.style.overflow = '';
});

const DISABLED_MIDDLE: ComboboxHarnessOption[] = [
	{ value: 'kickflip', label: 'Kickflip' },
	{ value: 'kickturn', label: 'Kickturn', disabled: true },
	{ value: 'heelflip', label: 'Heelflip' }
];

/**
 * The `Home`/`End`/`PageUp`/`PageDown` fixture: a disabled option at *each* end, where a move that
 * merely clamps to the first or last registered item would land on one of them.
 */
const DISABLED_EDGES: ComboboxHarnessOption[] = [
	{ value: 'ollie', label: 'Ollie', disabled: true },
	{ value: 'kickflip', label: 'Kickflip' },
	{ value: 'heelflip', label: 'Heelflip' },
	{ value: 'nollie', label: 'Nollie', disabled: true }
];

// ---------------------------------------------------------------------------
// T011 — the pure filter module, with no rendering at all
// ---------------------------------------------------------------------------

describe('combobox filter module (T011)', () => {
	it('normalises case, punctuation, separators and whitespace away', () => {
		expect(normalizeWithGaps('Fuzzy-Search v2')).toBe('fuzzysearchv2');
		expect(normalizeWithGaps('FS 540')).toBe('fs540');
		expect(normalizeWithGaps('')).toBe('');
		// A string that normalises to nothing gets upstream's non-matching sentinel rather than the
		// empty string, which every matcher would otherwise treat as "matches anything".
		expect(normalizeWithGaps('***')).toBe('\u0000');
	});

	it('answers the four matchers, with an empty needle always matching', () => {
		const filter = createFilter({ sensitivity: 'base', gapMatch: true });

		expect(filter.startsWith('kickflip', 'kick')).toBe(true);
		expect(filter.startsWith('kickflip', 'flip')).toBe(false);
		expect(filter.endsWith('kickflip', 'flip')).toBe(true);
		expect(filter.endsWith('kickflip', 'kick')).toBe(false);
		expect(filter.contains('kickflip', 'ckf')).toBe(true);
		// `kp` is the discriminator: the letters occur in order but never adjacently.
		expect(filter.contains('kickflip', 'kp')).toBe(false);
		expect(filter.fuzzy('kickflip', 'kp')).toBe(true);
		expect(filter.fuzzy('kickflip', 'pk')).toBe(false);

		for (const matcher of [filter.startsWith, filter.endsWith, filter.contains, filter.fuzzy]) {
			expect(matcher('kickflip', '')).toBe(true);
		}
	});

	it('matches across separators only when gapMatch is on', () => {
		expect(createFilter({ gapMatch: true }).contains('FS 540', 'fs5')).toBe(true);
		expect(createFilter({ gapMatch: false }).contains('FS 540', 'fs5')).toBe(false);
	});

	it('scores 2 exact, 1.5 prefix, 1 matcher hit and 0 for no match', () => {
		expect(scoreItem('kickflip', 'kickflip')).toBe(2);
		expect(scoreItem('kickflip', 'kick')).toBe(1.5);
		expect(scoreItem('kickflip', 'kp')).toBe(1);
		expect(scoreItem('kickflip', 'zz')).toBe(0);
		// An empty term filters nothing out; an empty value never matches.
		expect(scoreItem('kickflip', '')).toBe(1);
		expect(scoreItem('', 'kick')).toBe(0);
	});

	it('lets exactMatch and onFilter replace the built-in matcher', () => {
		expect(scoreItem('kickflip', 'kp', { exactMatch: true })).toBe(0);
		expect(scoreItem('kickflip', 'ckf', { exactMatch: true })).toBe(1);

		const onFilter = vi.fn((options: string[], term: string) =>
			options.filter((option) => option.endsWith(term))
		);
		expect(scoreItem('kickflip', 'flip', { onFilter })).toBe(1);
		expect(scoreItem('boardslide', 'flip', { onFilter })).toBe(0);
		expect(onFilter).toHaveBeenCalledWith(['kickflip'], 'flip');
	});

	it('runs the store over the whole item set and records group visibility', () => {
		const items = [
			{ value: 'kickflip', groupId: 'flips' },
			{ value: 'heelflip', groupId: 'flips' },
			{ value: 'boardslide', groupId: 'grinds' }
		];

		const store = new ComboboxFilterStore('flip').run(items);

		expect(store.itemCount).toBe(2);
		expect(store.isItemVisible('kickflip')).toBe(true);
		expect(store.isItemVisible('boardslide')).toBe(false);
		expect(store.isGroupVisible('flips')).toBe(true);
		expect(store.isGroupVisible('grinds')).toBe(false);
		expect(store.isGroupVisible('grinds', true)).toBe(true);
		expect(store.isListEmpty()).toBe(false);
	});

	it('treats a blank search and manualFiltering as "everything is visible"', () => {
		const items = [{ value: 'kickflip' }, { value: 'heelflip' }];

		const blank = new ComboboxFilterStore('').run(items);
		expect(blank.itemCount).toBe(2);
		expect(blank.isItemVisible('anything')).toBe(true);
		expect(blank.isListEmpty()).toBe(false);

		const manual = new ComboboxFilterStore('zzz').run(items, { manualFiltering: true });
		expect(manual.itemCount).toBe(2);
		expect(manual.isItemVisible('kickflip')).toBe(true);
	});

	it('reports an empty list only for a non-blank search that matched nothing', () => {
		const store = new ComboboxFilterStore('zzz').run([{ value: 'kickflip' }]);

		expect(store.itemCount).toBe(0);
		expect(store.isListEmpty()).toBe(true);
		expect(new ComboboxFilterStore('   ').run([]).isListEmpty()).toBe(false);
		// `keepVisible` forces the empty state on regardless, which is what async filtering needs.
		expect(new ComboboxFilterStore('').run([{ value: 'a' }]).isListEmpty(true)).toBe(true);
	});

	it('keeps scoring past the 250-item batch boundary', () => {
		const items = Array.from({ length: 600 }, (_, index) => ({ value: `trick-${index}` }));

		const store = new ComboboxFilterStore('trick').run(items);

		expect(store.itemCount).toBe(600);
		expect(store.isItemVisible('trick-599')).toBe(true);
	});

	it('degrades an invalid progress max and value the way upstream does', () => {
		expect(isValidProgressMax(100)).toBe(true);
		expect(isValidProgressMax(0)).toBe(false);
		expect(isValidProgressMax(Number.NaN)).toBe(false);
		expect(isValidProgressValue(50, 100)).toBe(true);
		expect(isValidProgressValue(150, 100)).toBe(false);
		expect(isValidProgressValue(null, 100)).toBe(false);
		expect(getProgressState(null, 100)).toBe('indeterminate');
		expect(getProgressState(40, 100)).toBe('loading');
		expect(getProgressState(100, 100)).toBe('complete');
	});
});

// ---------------------------------------------------------------------------
// T004 — roles, names and ARIA wiring
// ---------------------------------------------------------------------------

describe('Combobox accessibility (T004)', () => {
	it('emits the documented input contract and associates it with its label', () => {
		renderCombobox();

		const input = textInput();
		const label = screen.getByTestId('label');

		expect(input).toHaveAttribute('role', 'combobox');
		expect(input).toHaveAttribute('aria-autocomplete', 'list');
		expect(input).toHaveAttribute('aria-expanded', 'false');
		expect(input).toHaveAttribute('aria-disabled', 'false');
		expect(input).toHaveAttribute('aria-readonly', 'false');
		expect(input).toHaveAttribute('autocomplete', 'off');
		expect(input).toHaveAttribute('spellcheck', 'false');
		expect(input).toHaveAttribute('data-slot', 'combobox-input');
		expect(input).not.toHaveAttribute('aria-activedescendant');

		expect(label).toHaveAttribute('for', input.id);
		expect(input).toHaveAttribute('aria-labelledby', label.id);
		expect(screen.getByLabelText('Tricks')).toBe(input);
	});

	it('emits the anchor, trigger and root contract', () => {
		renderCombobox();

		const root = screen.getByTestId('root');
		const anchor = screen.getByTestId('anchor');
		const trigger = screen.getByTestId('trigger');

		expect(root).toHaveAttribute('data-slot', 'combobox');
		expect(root).toHaveAttribute('data-state', 'closed');
		expect(root).not.toHaveAttribute('data-disabled');

		expect(anchor).toHaveAttribute('data-slot', 'combobox-anchor');
		expect(anchor).toHaveAttribute('data-anchor', '');
		expect(anchor).toHaveAttribute('data-state', 'closed');
		expect(anchor).toHaveAttribute('dir', 'ltr');
		expect(anchor).not.toHaveAttribute('data-focused');

		expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
		expect(trigger).toHaveAttribute('aria-expanded', 'false');
		expect(trigger).toHaveAttribute('aria-controls', textInput().getAttribute('aria-controls'));
		expect(trigger).toHaveAttribute('tabindex', '-1');
		expect(trigger).toHaveAttribute('data-slot', 'combobox-trigger');
	});

	it('points aria-controls at the rendered listbox once it opens', async () => {
		const user = userEvent.setup();
		renderCombobox();

		await openFromTrigger(user);

		const content = bySlot('combobox-content');
		expect(content).toHaveAttribute('role', 'listbox');
		expect(content.id).toBe(textInput().getAttribute('aria-controls'));
		expect(content).toHaveAttribute('data-state', 'open');
		expect(content).toHaveAttribute('dir', 'ltr');
		expect(textInput()).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'true');
	});

	it('emits the item contract and never announces selection by colour alone', async () => {
		renderCombobox({ defaultValue: 'kickflip', defaultOpen: true });
		await waitForList();

		const selected = screen.getByTestId('item-kickflip');
		const other = screen.getByTestId('item-heelflip');

		expect(selected).toHaveAttribute('role', 'option');
		expect(selected).toHaveAttribute('aria-selected', 'true');
		expect(selected).toHaveAttribute('aria-disabled', 'false');
		expect(selected).toHaveAttribute('data-dice-collection-item', '');
		expect(selected).toHaveAttribute('data-state', 'checked');
		expect(selected).toHaveAttribute('tabindex', '-1');
		// FR-034: an accompanying indicator, not a colour, is what carries the selection.
		expect(selected.querySelector('[data-slot="combobox-item-indicator"]')).not.toBeNull();

		const text = selected.querySelector('[data-slot="combobox-item-text"]');
		expect(selected).toHaveAttribute('aria-labelledby', text?.id ?? '');

		expect(other).toHaveAttribute('aria-selected', 'false');
		expect(other).toHaveAttribute('data-state', 'unchecked');
		expect(other.querySelector('[data-slot="combobox-item-indicator"]')).toBeNull();
	});

	it('labels each group with its own group label', async () => {
		renderCombobox({ defaultOpen: true, withGroups: true });
		await waitForList();

		const group = screen.getByTestId('group-Flips');
		const groupLabel = screen.getByTestId('group-label-Flips');

		expect(group).toHaveAttribute('role', 'group');
		expect(group).toHaveAttribute('aria-labelledby', groupLabel.id);
		expect(group).toHaveAttribute('data-slot', 'combobox-group');
		expect(groupLabel).toHaveTextContent('Flips');
	});

	it('announces the empty state politely', async () => {
		const user = userEvent.setup();
		renderCombobox();

		await user.type(textInput(), 'zzz');
		await waitForList();

		const empty = await waitFor(() => bySlot('combobox-empty'));
		expect(empty).toHaveAttribute('role', 'status');
		expect(empty).toHaveAttribute('aria-live', 'polite');
		expect(empty).toHaveAttribute('aria-atomic', 'true');
		expect(empty).toHaveAttribute('data-state', 'empty');
	});

	it('marks the separator decorative', async () => {
		renderCombobox({ defaultOpen: true, withSeparator: true });
		await waitForList();

		const separator = bySlot('combobox-separator');
		expect(separator).toHaveAttribute('role', 'separator');
		expect(separator).toHaveAttribute('aria-hidden', 'true');
	});

	it('exposes the loading progress bar', async () => {
		renderCombobox({ defaultOpen: true, withLoading: true, loadingValue: 40 });
		await waitForList();

		const progress = bySlot('combobox-loading');
		expect(progress).toHaveAttribute('role', 'progressbar');
		expect(progress).toHaveAttribute('aria-label', 'Loading tricks');
		expect(progress).toHaveAttribute('aria-valuemin', '0');
		expect(progress).toHaveAttribute('aria-valuemax', '100');
		expect(progress).toHaveAttribute('aria-valuenow', '40');
		expect(progress).toHaveAttribute('data-state', 'loading');
	});

	it('exposes the badge list and its badges as a multi-selectable listbox', () => {
		renderCombobox({ multiple: true, defaultValue: ['kickflip', 'heelflip'] });

		const badgeList = screen.getByTestId('badge-list');
		expect(badgeList).toHaveAttribute('role', 'listbox');
		expect(badgeList).toHaveAttribute('aria-multiselectable', 'true');
		expect(badgeList).toHaveAttribute('aria-orientation', 'horizontal');
		expect(badgeList).toHaveAttribute('data-orientation', 'horizontal');

		const first = screen.getByTestId('badge-kickflip');
		expect(first).toHaveAttribute('role', 'option');
		expect(first).toHaveAttribute('aria-selected', 'false');
		expect(first).toHaveAttribute('aria-disabled', 'false');
		expect(first).toHaveAttribute('aria-orientation', 'horizontal');
		expect(first).toHaveAttribute('aria-posinset', '1');
		expect(first).toHaveAttribute('aria-setsize', '2');

		const second = screen.getByTestId('badge-heelflip');
		expect(second).toHaveAttribute('aria-posinset', '2');

		const remove = screen.getByTestId('badge-delete-kickflip');
		expect(remove).toHaveAttribute('aria-controls', first.id);
		expect(remove).toHaveAttribute('tabindex', '-1');
	});

	it('leaves aria-posinset and aria-setsize off the list options', async () => {
		// Upstream sets neither on `<Combobox.Item>` — only on the badges.
		renderCombobox({ defaultOpen: true });
		await waitForList();

		const option = screen.getByTestId('item-kickflip');
		expect(option).not.toHaveAttribute('aria-posinset');
		expect(option).not.toHaveAttribute('aria-setsize');
	});

	it('moves aria-activedescendant onto the highlighted option', async () => {
		const user = userEvent.setup();
		renderCombobox();

		await focusInput();
		await user.keyboard('{ArrowDown}');

		await waitFor(() => expect(highlightedOption()).not.toBeNull());
		expect(textInput()).toHaveAttribute('aria-activedescendant', highlightedOption()?.id ?? '');
	});

	it('reports disabled through ARIA and the data attributes', () => {
		renderCombobox({ disabled: true });

		expect(textInput()).toHaveAttribute('aria-disabled', 'true');
		expect(textInput()).toBeDisabled();
		expect(screen.getByTestId('root')).toHaveAttribute('data-disabled', '');
		expect(screen.getByTestId('anchor')).toHaveAttribute('data-disabled', '');
		expect(screen.getByTestId('trigger')).toHaveAttribute('data-disabled', '');
	});

	it('reports readOnly through ARIA', () => {
		renderCombobox({ readOnly: true });

		expect(textInput()).toHaveAttribute('aria-readonly', 'true');
		expect(textInput()).toHaveAttribute('readonly');
	});

	it('emits the arrow contract inside the content', async () => {
		renderCombobox({ defaultOpen: true, withArrow: true });
		await waitForList();

		const arrow = bySlot('combobox-arrow');
		expect(arrow).toHaveAttribute('data-side', 'bottom');
		expect(arrow).toHaveAttribute('data-align', 'start');
		expect(arrow).toHaveAttribute('data-state', 'open');
		expect(arrow).toHaveAttribute('aria-hidden', 'true');
	});

	it('aliases the documented CSS variables onto the popover', async () => {
		renderCombobox({ defaultOpen: true });
		const content = await waitForList();

		const style = content.getAttribute('style') ?? '';
		for (const variable of [
			'--dice-transform-origin',
			'--dice-anchor-width',
			'--dice-anchor-height',
			'--dice-available-width',
			'--dice-available-height'
		]) {
			expect(style).toContain(variable);
		}
	});
});

// ---------------------------------------------------------------------------
// T005 — keyboard interaction
// ---------------------------------------------------------------------------

describe('Combobox keyboard (T005)', () => {
	it('opens and filters as soon as a character is typed', async () => {
		const user = userEvent.setup();
		renderCombobox();

		await user.type(textInput(), 'flip');
		await waitForList();

		await waitFor(() => expect(optionLabels()).toEqual(['Kickflip', 'Heelflip', 'Hardflip']));
		expect(textInput()).toHaveAttribute('aria-expanded', 'true');
		expect(textInput()).toHaveValue('flip');
	});

	it('opens on ArrowDown and highlights the first option, then walks the list', async () => {
		const user = userEvent.setup();
		renderCombobox();

		await focusInput();
		await user.keyboard('{ArrowDown}');

		await waitFor(() => expect(highlightedLabel()).toBe('Kickflip'));

		await user.keyboard('{ArrowDown}');
		expect(highlightedLabel()).toBe('Heelflip');

		await user.keyboard('{ArrowUp}');
		expect(highlightedLabel()).toBe('Kickflip');
	});

	it('opens on ArrowUp and highlights the last option', async () => {
		const user = userEvent.setup();
		renderCombobox();

		await focusInput();
		await user.keyboard('{ArrowUp}');

		await waitFor(() => expect(highlightedLabel()).toBe('Boardslide'));
	});

	it('highlights the selected option when opening with a value already set', async () => {
		const user = userEvent.setup();
		renderCombobox({ defaultValue: 'hardflip' });

		await focusInput();
		await user.keyboard('{ArrowDown}');

		await waitFor(() => expect(highlightedLabel()).toBe('Hardflip'));
	});

	it('jumps to the first and last option with Home and End', async () => {
		const user = userEvent.setup();
		renderCombobox({ defaultOpen: true });
		await waitForList();

		await focusInput();
		await user.keyboard('{End}');
		await waitFor(() => expect(highlightedLabel()).toBe('Boardslide'));

		await user.keyboard('{Home}');
		expect(highlightedLabel()).toBe('Kickflip');
	});

	it('walks with PageUp and PageDown only in modal mode', async () => {
		const user = userEvent.setup();
		renderCombobox({ defaultOpen: true, modal: true });
		await waitForList();

		await focusInput();
		await user.keyboard('{ArrowDown}');
		await waitFor(() => expect(highlightedLabel()).toBe('Kickflip'));

		await user.keyboard('{PageDown}');
		expect(highlightedLabel()).toBe('Heelflip');
		await user.keyboard('{PageUp}');
		expect(highlightedLabel()).toBe('Kickflip');
	});

	it('leaves PageUp and PageDown inert without modal', async () => {
		const user = userEvent.setup();
		renderCombobox({ defaultOpen: true });
		await waitForList();

		await focusInput();
		await user.keyboard('{ArrowDown}');
		await waitFor(() => expect(highlightedLabel()).toBe('Kickflip'));

		await user.keyboard('{PageDown}');
		expect(highlightedLabel()).toBe('Kickflip');
	});

	it('selects the highlighted option with Enter and closes in single mode', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderCombobox({ onValueChange });

		await focusInput();
		await user.keyboard('{ArrowDown}{ArrowDown}');
		await waitFor(() => expect(highlightedLabel()).toBe('Heelflip'));

		await user.keyboard('{Enter}');

		expect(onValueChange).toHaveBeenCalledWith('heelflip');
		expect(textInput()).toHaveValue('Heelflip');
		await waitFor(() => expect(queryBySlot('combobox-content')).toBeNull());
	});

	it('reverts the text and closes when Enter lands on an empty list', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderCombobox({ onValueChange });

		// Select something first, so there is a label for `Enter` to fall back to.
		await focusInput();
		await user.keyboard('{ArrowDown}{Enter}');
		await waitFor(() => expect(textInput()).toHaveValue('Kickflip'));
		onValueChange.mockClear();

		await user.type(textInput(), 'zzz');
		await waitFor(() => expect(optionElements()).toHaveLength(0));

		await user.keyboard('{Enter}');

		await waitFor(() => expect(textInput()).toHaveValue('Kickflip'));
		await waitFor(() => expect(queryBySlot('combobox-content')).toBeNull());
		// The selection itself never moved.
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('reverts the text to the selected label and closes on Escape', async () => {
		const user = userEvent.setup();
		renderCombobox();

		await focusInput();
		await user.keyboard('{ArrowDown}{Enter}');
		await waitFor(() => expect(textInput()).toHaveValue('Kickflip'));

		await user.type(textInput(), 'zz');
		await waitForList();

		await user.keyboard('{Escape}');

		await waitFor(() => expect(textInput()).toHaveValue('Kickflip'));
		await waitFor(() => expect(queryBySlot('combobox-content')).toBeNull());
	});

	it('clears the text on Escape when nothing is selected', async () => {
		const user = userEvent.setup();
		renderCombobox();

		await user.type(textInput(), 'flip');
		await waitForList();

		await user.keyboard('{Escape}');

		await waitFor(() => expect(textInput()).toHaveValue(''));
	});

	it('closes on Tab and lets focus leave when not modal', async () => {
		const user = userEvent.setup();
		renderCombobox({ defaultOpen: true });
		await waitForList();

		await focusInput();
		await user.tab();

		await waitFor(() => expect(queryBySlot('combobox-content')).toBeNull());
		expect(document.activeElement).toBe(screen.getByTestId('outside'));
	});

	it('traps Tab while modal and open', async () => {
		const user = userEvent.setup();
		renderCombobox({ defaultOpen: true, modal: true });
		await waitForList();

		const input = await focusInput();
		await user.tab();

		expect(queryBySlot('combobox-content')).not.toBeNull();
		expect(document.activeElement).toBe(input);
	});

	it('skips disabled options while walking the list', async () => {
		const user = userEvent.setup();
		renderCombobox({ options: DISABLED_MIDDLE });

		await focusInput();
		await user.keyboard('{ArrowDown}');
		await waitFor(() => expect(highlightedLabel()).toBe('Kickflip'));

		await user.keyboard('{ArrowDown}');
		expect(highlightedLabel()).toBe('Heelflip');

		expect(screen.getByTestId('item-kickturn')).toHaveAttribute('aria-disabled', 'true');
		expect(screen.getByTestId('item-kickturn')).not.toHaveAttribute('data-highlighted');
	});

	it('changes no value when the only remaining match is disabled', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderCombobox({ options: DISABLED_MIDDLE, onValueChange });

		await user.type(textInput(), 'kickturn');
		await waitFor(() => expect(optionLabels()).toEqual(['Kickturn']));

		await user.keyboard('{Enter}');

		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('wraps only when loop is set', async () => {
		const user = userEvent.setup();
		renderCombobox({ defaultOpen: true, loop: true });
		await waitForList();

		await focusInput();
		await user.keyboard('{End}');
		await waitFor(() => expect(highlightedLabel()).toBe('Boardslide'));

		await user.keyboard('{ArrowDown}');
		expect(highlightedLabel()).toBe('Kickflip');
		await user.keyboard('{ArrowUp}');
		expect(highlightedLabel()).toBe('Boardslide');
	});

	it('stops at both boundaries when loop is off', async () => {
		const user = userEvent.setup();
		renderCombobox({ defaultOpen: true });
		await waitForList();

		await focusInput();
		await user.keyboard('{End}');
		await waitFor(() => expect(highlightedLabel()).toBe('Boardslide'));

		await user.keyboard('{ArrowDown}');
		expect(highlightedLabel()).toBe('Boardslide');

		await user.keyboard('{Home}{ArrowUp}');
		expect(highlightedLabel()).toBe('Kickflip');
	});

	it('walks the badges with ArrowLeft and back out with ArrowRight', async () => {
		const user = userEvent.setup();
		renderCombobox({ multiple: true, defaultValue: ['kickflip', 'heelflip'] });

		const input = await focusInput();

		await user.keyboard('{ArrowLeft}');
		expect(highlightedBadge()).toBe(screen.getByTestId('badge-heelflip'));

		await user.keyboard('{ArrowLeft}');
		expect(highlightedBadge()).toBe(screen.getByTestId('badge-kickflip'));

		await user.keyboard('{ArrowRight}');
		expect(highlightedBadge()).toBe(screen.getByTestId('badge-heelflip'));

		await user.keyboard('{ArrowRight}');
		expect(highlightedBadge()).toBeNull();
		expect(document.activeElement).toBe(input);
	});

	it('closes the popover and claims the last badge on ArrowLeft', async () => {
		const user = userEvent.setup();
		renderCombobox({ multiple: true, defaultValue: ['kickflip', 'heelflip'], defaultOpen: true });
		await waitForList();

		await focusInput();
		await user.keyboard('{ArrowLeft}');

		await waitFor(() => expect(queryBySlot('combobox-content')).toBeNull());
		expect(highlightedBadge()).toBe(screen.getByTestId('badge-heelflip'));
	});

	it('removes the highlighted badge with Enter', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderCombobox({ multiple: true, defaultValue: ['kickflip', 'heelflip'], onValueChange });

		await focusInput();
		await user.keyboard('{ArrowLeft}{Enter}');

		expect(onValueChange).toHaveBeenCalledWith(['kickflip']);
		expect(screen.queryByTestId('badge-heelflip')).toBeNull();
		expect(highlightedBadge()).toBeNull();
	});

	it.each(['{Backspace}', '{Delete}'] as const)(
		'removes the last badge with %s while the input is empty',
		async (key) => {
			const user = userEvent.setup();
			const onValueChange = vi.fn();
			renderCombobox({ multiple: true, defaultValue: ['kickflip', 'heelflip'], onValueChange });

			await focusInput();
			await user.keyboard(key);

			expect(onValueChange).toHaveBeenCalledWith(['kickflip']);
		}
	);

	it('removes the highlighted badge and steps back with Backspace', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderCombobox({
			multiple: true,
			defaultValue: ['kickflip', 'heelflip', 'hardflip'],
			onValueChange
		});

		await focusInput();
		await user.keyboard('{ArrowLeft}{ArrowLeft}');
		expect(highlightedBadge()).toBe(screen.getByTestId('badge-heelflip'));

		await user.keyboard('{Backspace}');

		expect(onValueChange).toHaveBeenCalledWith(['kickflip', 'hardflip']);
		expect(highlightedBadge()).toBe(screen.getByTestId('badge-kickflip'));
	});

	it('removes no badge while the input still holds text', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderCombobox({ multiple: true, defaultValue: ['kickflip', 'heelflip'], onValueChange });

		await user.type(textInput(), 'ki');
		onValueChange.mockClear();

		await user.keyboard('{Backspace}{Backspace}');

		expect(screen.getByTestId('badge-heelflip')).toBeInTheDocument();
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('opens with Enter when text is typed but the popover was closed', async () => {
		const user = userEvent.setup();
		renderCombobox();

		await user.type(textInput(), 'flip');
		await waitForList();
		await user.keyboard('{Escape}');
		await waitFor(() => expect(queryBySlot('combobox-content')).toBeNull());

		await user.type(textInput(), 'flip');
		await waitForList();
		expect(queryBySlot('combobox-content')).not.toBeNull();
	});
});

// ---------------------------------------------------------------------------
// T006 — uncontrolled state
// ---------------------------------------------------------------------------

describe('Combobox uncontrolled (T006)', () => {
	it('seeds the value and the input text from defaultValue in single mode', () => {
		renderCombobox({ defaultValue: 'kickflip' });

		expect(textInput()).toHaveValue('kickflip');
	});

	it('seeds the open state from defaultOpen', async () => {
		renderCombobox({ defaultOpen: true });

		await waitForList();
		expect(textInput()).toHaveAttribute('aria-expanded', 'true');
	});

	it('moves its own value when an option is clicked', async () => {
		const user = userEvent.setup();
		renderCombobox({ defaultOpen: true });
		await waitForList();

		await user.click(screen.getByTestId('item-heelflip'));

		await waitFor(() => expect(textInput()).toHaveValue('Heelflip'));
		await waitFor(() => expect(queryBySlot('combobox-content')).toBeNull());
	});

	it('accumulates values in multiple mode and keeps the popover open', async () => {
		const user = userEvent.setup();
		renderCombobox({ multiple: true, defaultOpen: true });
		await waitForList();

		await user.click(screen.getByTestId('item-kickflip'));
		await waitFor(() => expect(screen.getByTestId('badge-kickflip')).toBeInTheDocument());

		await user.click(screen.getByTestId('item-heelflip'));
		await waitFor(() => expect(screen.getByTestId('badge-heelflip')).toBeInTheDocument());

		expect(queryBySlot('combobox-content')).not.toBeNull();
		expect(textInput()).toHaveValue('');
	});

	it('toggles a value back off in multiple mode', async () => {
		const user = userEvent.setup();
		renderCombobox({ multiple: true, defaultValue: ['kickflip'], defaultOpen: true });
		await waitForList();

		await user.click(screen.getByTestId('item-kickflip'));

		await waitFor(() => expect(screen.queryByTestId('badge-kickflip')).toBeNull());
	});
});

// ---------------------------------------------------------------------------
// T007 — controlled state
// ---------------------------------------------------------------------------

describe('Combobox controlled (T007)', () => {
	it('reports the next value and lets an accepting parent move', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderCombobox({ binding: 'value', value: '', onValueChange, defaultOpen: true });
		await waitForList();

		await user.click(screen.getByTestId('item-hardflip'));

		expect(onValueChange).toHaveBeenCalledWith('hardflip');
		await waitFor(() => expect(textInput()).toHaveValue('Hardflip'));
	});

	it('never moves on its own when the parent declines the write', async () => {
		const user = userEvent.setup();
		const onDeclinedValue = vi.fn();
		renderCombobox({
			binding: 'function',
			authoritative: ['kickflip'],
			multiple: true,
			onDeclinedValue,
			defaultOpen: true
		});
		await waitForList();

		await user.click(screen.getByTestId('item-heelflip'));

		expect(onDeclinedValue).toHaveBeenCalledWith(['kickflip', 'heelflip']);
		// The parent kept its own array, so the rendered badges never moved.
		expect(screen.getByTestId('badge-kickflip')).toBeInTheDocument();
		expect(screen.queryByTestId('badge-heelflip')).toBeNull();
	});

	it('reports every open-state change', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderCombobox({ onOpenChange });

		await openFromTrigger(user);
		expect(onOpenChange).toHaveBeenLastCalledWith(true);

		await user.click(screen.getByTestId('trigger'));
		await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false));
	});

	it('reports every input-value change', async () => {
		const user = userEvent.setup();
		const onInputValueChange = vi.fn();
		renderCombobox({ onInputValueChange });

		await user.type(textInput(), 'ki');

		expect(onInputValueChange).toHaveBeenNthCalledWith(1, 'k');
		expect(onInputValueChange).toHaveBeenNthCalledWith(2, 'ki');
	});
});

// ---------------------------------------------------------------------------
// T008 — RTL
// ---------------------------------------------------------------------------

describe('Combobox RTL (T008)', () => {
	it('puts dir on the anchor, the input, the trigger and the popover', async () => {
		renderCombobox({ dir: 'rtl', defaultOpen: true });
		await waitForList();

		expect(screen.getByTestId('anchor')).toHaveAttribute('dir', 'rtl');
		expect(textInput()).toHaveAttribute('dir', 'rtl');
		expect(screen.getByTestId('trigger')).toHaveAttribute('dir', 'rtl');
		expect(bySlot('combobox-content')).toHaveAttribute('dir', 'rtl');
	});

	it('resolves the direction from a DirectionProvider ancestor', () => {
		renderCombobox({ providerDir: 'rtl' });

		expect(textInput()).toHaveAttribute('dir', 'rtl');
		expect(screen.getByTestId('anchor')).toHaveAttribute('dir', 'rtl');
	});

	it('inverts the badge arrows so ArrowRight reaches the badges', async () => {
		const user = userEvent.setup();
		renderCombobox({ dir: 'rtl', multiple: true, defaultValue: ['kickflip', 'heelflip'] });

		const input = await focusInput();

		await user.keyboard('{ArrowRight}');
		expect(highlightedBadge()).toBe(screen.getByTestId('badge-heelflip'));

		await user.keyboard('{ArrowRight}');
		expect(highlightedBadge()).toBe(screen.getByTestId('badge-kickflip'));

		await user.keyboard('{ArrowLeft}');
		expect(highlightedBadge()).toBe(screen.getByTestId('badge-heelflip'));

		await user.keyboard('{ArrowLeft}');
		expect(highlightedBadge()).toBeNull();
		expect(document.activeElement).toBe(input);
	});

	it('leaves the vertical keys unchanged under RTL', async () => {
		const user = userEvent.setup();
		renderCombobox({ dir: 'rtl', defaultOpen: true });
		await waitForList();

		await focusInput();
		await user.keyboard('{ArrowDown}');

		await waitFor(() => expect(highlightedLabel()).toBe('Kickflip'));
	});
});

// ---------------------------------------------------------------------------
// T009 — guard rails and structural edge cases
// ---------------------------------------------------------------------------

describe('Combobox guard rails (T009)', () => {
	it('suppresses every interaction while disabled', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onOpenChange = vi.fn();
		renderCombobox({ disabled: true, onValueChange, onOpenChange, cancelForceMount: true });

		await user.click(screen.getByTestId('trigger'));
		await user.type(textInput(), 'flip');
		await user.click(screen.getByTestId('cancel'));

		expect(queryBySlot('combobox-content')).toBeNull();
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(onValueChange).not.toHaveBeenCalled();
		expect(textInput()).toHaveValue('');
	});

	it('keeps a readOnly combobox navigable but inert', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderCombobox({ readOnly: true, defaultOpen: true, onValueChange });
		await waitForList();

		await focusInput();
		await user.keyboard('{ArrowDown}');
		await waitFor(() => expect(highlightedLabel()).toBe('Kickflip'));

		await user.keyboard('{Enter}');
		expect(onValueChange).not.toHaveBeenCalled();

		await user.click(screen.getByTestId('item-heelflip'));
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('throws for an item with an empty value', () => {
		expect(() => renderCombobox({ mode: 'empty-item-value' })).toThrow(
			'`<Combobox.Item>` value cannot be an empty string.'
		);
	});

	it.each([
		['bare-label', '<Combobox.Label>'],
		['bare-anchor', '<Combobox.Anchor>'],
		['bare-trigger', '<Combobox.Trigger>'],
		['bare-input', '<Combobox.Input>'],
		['bare-cancel', '<Combobox.Cancel>'],
		['bare-badge-list', '<Combobox.BadgeList>'],
		['bare-badge-item', '<Combobox.BadgeItem>'],
		['bare-badge-item-delete', '<Combobox.BadgeItemDelete>'],
		['bare-portal', '<Combobox.Portal>'],
		['bare-content', '<Combobox.Content>'],
		['bare-arrow', '<Combobox.Arrow>'],
		['bare-loading', '<Combobox.Loading>'],
		['bare-empty', '<Combobox.Empty>'],
		['bare-group', '<Combobox.Group>'],
		['bare-item', '<Combobox.Item>'],
		['bare-separator', '<Combobox.Separator>']
	] as const)('throws when %s is rendered with no root', (mode, part) => {
		expect(() => renderCombobox({ mode })).toThrow(
			`\`${part}\` must be used within \`<Combobox.Root>\`.`
		);
	});

	it.each([
		['bare-group-label', '`<Combobox.GroupLabel>` must be used within `<Combobox.Group>`.'],
		[
			'group-label-without-group',
			'`<Combobox.GroupLabel>` must be used within `<Combobox.Group>`.'
		],
		['bare-item-text', '`<Combobox.ItemText>` must be used within `<Combobox.Item>`.'],
		['item-text-without-item', '`<Combobox.ItemText>` must be used within `<Combobox.Item>`.'],
		['bare-item-indicator', '`<Combobox.ItemIndicator>` must be used within `<Combobox.Item>`.'],
		[
			'item-indicator-without-item',
			'`<Combobox.ItemIndicator>` must be used within `<Combobox.Item>`.'
		],
		[
			'badge-item-without-badge-list',
			'`<Combobox.BadgeItem>` must be used within `<Combobox.BadgeList>`.'
		],
		[
			'badge-item-delete-without-badge-item',
			'`<Combobox.BadgeItemDelete>` must be used within `<Combobox.BadgeItem>`.'
		],
		['arrow-without-content', '`<Combobox.Arrow>` must be used within `<Combobox.Content>`.']
	] as const)('throws for %s without its nearer provider', (mode, message) => {
		expect(() => renderCombobox({ mode })).toThrow(message);
	});

	it('leaves the popover open while the last badge is removed', async () => {
		const user = userEvent.setup();
		renderCombobox({ multiple: true, defaultValue: ['kickflip'], defaultOpen: true });
		await waitForList();

		await user.click(screen.getByTestId('badge-delete-kickflip'));

		await waitFor(() => expect(screen.queryByTestId('badge-list')).toBeNull());
		expect(queryBySlot('combobox-content')).not.toBeNull();
	});

	it('never selects or highlights a disabled option on click', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onSelect = vi.fn();
		renderCombobox({ options: DISABLED_MIDDLE, defaultOpen: true, onValueChange, onSelect });
		await waitForList();

		await user.click(screen.getByTestId('item-kickturn'));

		expect(onValueChange).not.toHaveBeenCalled();
		expect(onSelect).not.toHaveBeenCalled();
		expect(screen.getByTestId('item-kickturn')).not.toHaveAttribute('data-highlighted');
	});

	it('fires onSelect exactly once per successful selection', async () => {
		const user = userEvent.setup();
		const onSelect = vi.fn();
		renderCombobox({ defaultOpen: true, onSelect });
		await waitForList();

		await user.click(screen.getByTestId('item-kickflip'));

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith('kickflip');
	});

	it('opens on focus with openOnFocus', async () => {
		const user = userEvent.setup();
		renderCombobox({ openOnFocus: true });

		await user.click(textInput());

		await waitForList();
		expect(textInput()).toHaveAttribute('aria-expanded', 'true');
	});

	it.each([
		['readOnly', { readOnly: true }],
		['disabled', { disabled: true }]
	] as const)('never opens on focus while %s', async (_name, props) => {
		const user = userEvent.setup();
		renderCombobox({ openOnFocus: true, ...props });

		await user.click(textInput());

		expect(queryBySlot('combobox-content')).toBeNull();
	});

	it('restores the selected label on blur and clears when nothing is selected', async () => {
		const user = userEvent.setup();
		renderCombobox({ defaultOpen: true });
		await waitForList();

		await user.click(screen.getByTestId('item-kickflip'));
		await waitFor(() => expect(textInput()).toHaveValue('Kickflip'));

		await user.type(textInput(), 'zz');
		await user.click(screen.getByTestId('outside'));
		await waitFor(() => expect(textInput()).toHaveValue('Kickflip'));
	});

	it('clears typed text on blur when nothing is selected', async () => {
		const user = userEvent.setup();
		renderCombobox();

		await user.type(textInput(), 'flip');
		await user.click(screen.getByTestId('outside'));

		await waitFor(() => expect(textInput()).toHaveValue(''));
	});

	it('keeps typed text on blur with preserveInputOnBlur', async () => {
		const user = userEvent.setup();
		renderCombobox({ preserveInputOnBlur: true });

		await user.type(textInput(), 'flip');
		await user.click(screen.getByTestId('outside'));

		await waitFor(() => expect(textInput()).toHaveValue('flip'));
	});

	it('clears the badge highlight when focus leaves the input', async () => {
		const user = userEvent.setup();
		renderCombobox({ multiple: true, defaultValue: ['kickflip', 'heelflip'] });

		await focusInput();
		await user.keyboard('{ArrowLeft}');
		expect(highlightedBadge()).not.toBeNull();

		await user.click(screen.getByTestId('outside'));

		await waitFor(() => expect(highlightedBadge()).toBeNull());
	});
});

// ---------------------------------------------------------------------------
// T010 — filtering and form integration
// ---------------------------------------------------------------------------

describe('Combobox filtering (T010)', () => {
	it('narrows fuzzily by default', async () => {
		const user = userEvent.setup();
		renderCombobox();

		// `kp` occurs in `kickflip` in order but never adjacently — only fuzzy matching finds it.
		await user.type(textInput(), 'kp');
		await waitForList();

		await waitFor(() => expect(optionLabels()).toEqual(['Kickflip']));
	});

	it('narrows more strictly with exactMatch', async () => {
		const user = userEvent.setup();
		renderCombobox({ exactMatch: true });

		await user.type(textInput(), 'kp');
		await waitForList();

		await waitFor(() => expect(optionLabels()).toEqual([]));
		expect(queryBySlot('combobox-empty')).not.toBeNull();
	});

	it('lets onFilter replace the built-in matcher entirely', async () => {
		const user = userEvent.setup();
		const onFilter = vi.fn((options: string[], term: string) =>
			options.filter((option) => option.endsWith(term))
		);
		renderCombobox({ onFilter });

		await user.type(textInput(), 'flip');
		await waitForList();

		await waitFor(() => expect(optionLabels()).toEqual(['Kickflip', 'Heelflip', 'Hardflip']));
		expect(onFilter).toHaveBeenCalled();
	});

	it('bypasses every built-in filter with manualFiltering', async () => {
		const user = userEvent.setup();
		renderCombobox({ manualFiltering: true });

		await user.type(textInput(), 'zzz');
		await waitForList();

		await waitFor(() => expect(optionLabels()).toHaveLength(COMBOBOX_OPTIONS.length));
	});

	it('still bypasses filtering when manualFiltering and onFilter are combined', async () => {
		const user = userEvent.setup();
		const onFilter = vi.fn(() => [] as string[]);
		renderCombobox({ manualFiltering: true, onFilter });

		await user.type(textInput(), 'zzz');
		await waitForList();

		await waitFor(() => expect(optionLabels()).toHaveLength(COMBOBOX_OPTIONS.length));
	});

	it('hides a group with no surviving item and brings it back when the search clears', async () => {
		const user = userEvent.setup();
		renderCombobox({ withGroups: true, withSeparator: true });

		const input = textInput();
		await user.type(input, 'board');
		await waitForList();

		// The group is taken out of the layout and the accessibility tree rather than unmounted, so
		// its items stay registered and the group can come back (a recorded divergence).
		await waitFor(() => expect(screen.getByTestId('group-Flips')).toHaveAttribute('hidden'));
		expect(screen.getByTestId('group-Grinds')).not.toHaveAttribute('hidden');
		// Every separator drops out while a search is active.
		expect(screen.queryAllByTestId('separator')).toHaveLength(0);

		await user.clear(input);

		await waitFor(() => expect(screen.getByTestId('group-Flips')).not.toHaveAttribute('hidden'));
		expect(screen.queryAllByTestId('separator')).toHaveLength(2);
	});

	it('keeps a force-mounted separator visible while a search is active', async () => {
		const user = userEvent.setup();
		renderCombobox({ withSeparator: true, separatorKeepVisible: true });

		await user.type(textInput(), 'flip');
		await waitForList();

		expect(screen.getByTestId('separator')).toBeInTheDocument();
	});

	it('renders the empty state only for a search that matched nothing', async () => {
		const user = userEvent.setup();
		renderCombobox({ defaultOpen: true });
		await waitForList();

		expect(queryBySlot('combobox-empty')).toBeNull();

		await user.type(textInput(), 'zzz');
		await waitFor(() => expect(queryBySlot('combobox-empty')).not.toBeNull());
	});

	it('keeps the empty state mounted with keepVisible', async () => {
		renderCombobox({ defaultOpen: true, emptyKeepVisible: true });
		await waitForList();

		expect(queryBySlot('combobox-empty')).not.toBeNull();
	});

	it('highlights the first item on open and again after each re-filter with autoHighlight', async () => {
		const user = userEvent.setup();
		renderCombobox({ autoHighlight: true });

		await openFromTrigger(user);
		await waitFor(() => expect(highlightedLabel()).toBe('Kickflip'));

		await user.type(textInput(), 'heel');
		await waitFor(() => expect(highlightedLabel()).toBe('Heelflip'));
	});

	it('renders the cancel button only when the input holds text, and clears on click', async () => {
		const user = userEvent.setup();
		renderCombobox();

		expect(screen.queryByTestId('cancel')).toBeNull();

		const input = textInput();
		await user.type(input, 'flip');
		await waitForList();
		await waitFor(() => expect(screen.getByTestId('cancel')).toBeInTheDocument());

		await user.click(screen.getByTestId('cancel'));

		await waitFor(() => expect(textInput()).toHaveValue(''));
		// Clearing resets the filter search too, so the whole list comes back.
		await waitFor(() => expect(optionLabels()).toHaveLength(COMBOBOX_OPTIONS.length));
		await waitFor(() => expect(document.activeElement).toBe(textInput()));
	});

	it('force-mounts the cancel button while the input is empty', () => {
		renderCombobox({ cancelForceMount: true });

		expect(screen.getByTestId('cancel')).toBeInTheDocument();
	});

	it('keeps the loading bar unmounted while the popover is closed', () => {
		renderCombobox({ withLoading: true, loadingValue: 40 });

		expect(queryBySlot('combobox-loading')).toBeNull();
	});

	it('unmounts the loading bar once the progress is complete', async () => {
		renderCombobox({ withLoading: true, defaultOpen: true, loadingValue: 100, loadingMax: 100 });
		await waitForList();

		expect(queryBySlot('combobox-loading')).toBeNull();
	});

	it('degrades an out-of-range loading value to indeterminate', async () => {
		renderCombobox({ withLoading: true, defaultOpen: true, loadingValue: 150 });
		await waitForList();

		const progress = bySlot('combobox-loading');
		expect(progress).toHaveAttribute('data-state', 'indeterminate');
		expect(progress).not.toHaveAttribute('aria-valuenow');
	});

	it('degrades a non-positive loading max to 100', async () => {
		renderCombobox({ withLoading: true, defaultOpen: true, loadingValue: 40, loadingMax: 0 });
		await waitForList();

		expect(bySlot('combobox-loading')).toHaveAttribute('aria-valuemax', '100');
	});
});

describe('Combobox form integration (T010)', () => {
	function formInput(): HTMLInputElement {
		return bySlot('combobox-form-input') as HTMLInputElement;
	}

	it('carries the joined value into the form data', async () => {
		const user = userEvent.setup();
		renderCombobox({
			withForm: true,
			name: 'tricks',
			multiple: true,
			defaultValue: ['kickflip'],
			defaultOpen: true
		});
		await waitForList();

		const form = screen.getByTestId('form') as HTMLFormElement;
		expect(new FormData(form).get('tricks')).toBe('kickflip');

		await user.click(screen.getByTestId('item-heelflip'));

		await waitFor(() => expect(new FormData(form).get('tricks')).toBe('kickflip,heelflip'));
	});

	it('blocks submission while a required combobox is empty', async () => {
		const user = userEvent.setup();
		renderCombobox({ withForm: true, name: 'tricks', required: true, defaultOpen: true });
		await waitForList();

		const form = screen.getByTestId('form') as HTMLFormElement;
		expect(formInput()).toBeRequired();
		expect(form.reportValidity()).toBe(false);

		await user.click(screen.getByTestId('item-kickflip'));

		await waitFor(() => expect(form.reportValidity()).toBe(true));
	});

	it('mirrors disabled and readOnly onto the hidden control', () => {
		renderCombobox({ withForm: true, name: 'tricks', disabled: true, readOnly: true });

		expect(formInput()).toBeDisabled();
		expect(formInput()).toHaveAttribute('readonly');
	});
});

// ---------------------------------------------------------------------------
// T038 — the forceMount escape hatch on every part that has one
// ---------------------------------------------------------------------------

describe('Combobox forceMount (T038)', () => {
	it('keeps the popover mounted while it is closed', async () => {
		renderCombobox({ contentForceMount: true });

		const content = await waitForList();
		expect(content).toHaveAttribute('data-state', 'closed');
		expect(textInput()).toHaveAttribute('aria-expanded', 'false');
		// The list is still the element `aria-controls` resolves to, so the wiring survives too.
		expect(content.id).toBe(textInput().getAttribute('aria-controls'));
	});

	it('keeps a group visible once a search has hidden every item in it', async () => {
		const user = userEvent.setup();
		renderCombobox({ withGroups: true, groupForceMount: true });

		await user.type(textInput(), 'board');
		await waitForList();
		await waitFor(() => expect(optionLabels()).toEqual(['Boardslide']));

		const emptied = screen.getByTestId('group-Flips');
		expect(emptied).not.toHaveAttribute('hidden');
		expect(emptied).not.toHaveAttribute('data-hidden');
		expect(emptied).not.toHaveAttribute('aria-hidden');
	});

	it('renders the badge list while nothing is selected', () => {
		renderCombobox({ multiple: true, badgeListForceMount: true });

		const badgeList = screen.getByTestId('badge-list');
		expect(badgeList).toBeInTheDocument();
		expect(badgeList).toHaveAttribute('role', 'listbox');
		expect(allBySlot('combobox-badge-item')).toHaveLength(0);
	});

	it('renders the item indicator on an option that is not selected', async () => {
		renderCombobox({ defaultOpen: true, defaultValue: 'kickflip', itemIndicatorForceMount: true });
		await waitForList();

		const unselected = screen.getByTestId('item-heelflip');
		expect(unselected).toHaveAttribute('aria-selected', 'false');
		expect(unselected.querySelector('[data-slot="combobox-item-indicator"]')).not.toBeNull();
		expect(allBySlot('combobox-item-indicator')).toHaveLength(COMBOBOX_OPTIONS.length);
	});
});

// ---------------------------------------------------------------------------
// T039 — the modal scroll lock the content requests
// ---------------------------------------------------------------------------

describe('Combobox modal scroll lock (T039)', () => {
	it('locks the body scroll while a modal popover is open', async () => {
		renderCombobox({ modal: true, defaultOpen: true });
		await waitForList();

		// Asserted before this file's `afterEach` resets the styles `bits-ui` sets.
		await waitFor(() => expect(document.body.style.pointerEvents).toBe('none'));
		expect(document.body).toHaveStyle({ overflow: 'hidden' });
	});

	it('leaves the body alone while a non-modal popover is open', async () => {
		renderCombobox({ defaultOpen: true });
		await waitForList();

		expect(document.body.style.pointerEvents).toBe('');
		expect(document.body.style.overflow).toBe('');
	});
});

// ---------------------------------------------------------------------------
// T040/T041 — where the focus lands after a pointer interaction
// ---------------------------------------------------------------------------

describe('Combobox focus retention (T040, T041)', () => {
	it('returns focus to the input after a badge is deleted by click', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderCombobox({ multiple: true, defaultValue: ['kickflip', 'heelflip'], onValueChange });

		await user.click(screen.getByTestId('badge-delete-kickflip'));

		expect(onValueChange).toHaveBeenCalledWith(['heelflip']);
		await waitFor(() => expect(document.activeElement).toBe(textInput()));
	});

	it('keeps focus in the input when an option is clicked in single mode', async () => {
		const user = userEvent.setup();
		renderCombobox({ defaultOpen: true });
		await waitForList();

		await user.click(screen.getByTestId('item-heelflip'));

		await waitFor(() => expect(queryBySlot('combobox-content')).toBeNull());
		expect(document.activeElement).toBe(textInput());
	});

	it('keeps focus in the input when an option is clicked in multiple mode', async () => {
		const user = userEvent.setup();
		renderCombobox({ multiple: true, defaultOpen: true });
		await waitForList();

		await user.click(screen.getByTestId('item-kickflip'));

		await waitFor(() => expect(screen.getByTestId('badge-kickflip')).toBeInTheDocument());
		// The popover stays open in multiple mode, so the item still holds the DOM focus it took.
		expect(queryBySlot('combobox-content')).not.toBeNull();
		expect(document.activeElement).toBe(textInput());
	});
});

// ---------------------------------------------------------------------------
// T042 — every highlight move skips disabled options
// ---------------------------------------------------------------------------

describe('Combobox disabled-edge navigation (T042)', () => {
	it('lands Home and End on an enabled option', async () => {
		const user = userEvent.setup();
		renderCombobox({ options: DISABLED_EDGES, defaultOpen: true });
		await waitForList();

		await focusInput();
		await user.keyboard('{End}');
		await waitFor(() => expect(highlightedLabel()).toBe('Heelflip'));

		await user.keyboard('{Home}');
		expect(highlightedLabel()).toBe('Kickflip');

		expect(screen.getByTestId('item-ollie')).not.toHaveAttribute('data-highlighted');
		expect(screen.getByTestId('item-nollie')).not.toHaveAttribute('data-highlighted');
	});

	it('lands PageUp and PageDown on an enabled option', async () => {
		const user = userEvent.setup();
		// `loop` is what makes the assertion sharp: a wrap that walked the registered items rather
		// than the enabled ones would land on a disabled edge instead of the far enabled option.
		renderCombobox({ options: DISABLED_EDGES, defaultOpen: true, modal: true, loop: true });
		await waitForList();

		await focusInput();
		await user.keyboard('{End}');
		await waitFor(() => expect(highlightedLabel()).toBe('Heelflip'));

		await user.keyboard('{PageDown}');
		expect(highlightedLabel()).toBe('Kickflip');

		await user.keyboard('{PageUp}');
		expect(highlightedLabel()).toBe('Heelflip');
	});

	it('lands the autoHighlight open highlight on an enabled option', async () => {
		const user = userEvent.setup();
		renderCombobox({ options: DISABLED_EDGES, autoHighlight: true });

		await openFromTrigger(user);

		await waitFor(() => expect(highlightedLabel()).toBe('Kickflip'));
		expect(screen.getByTestId('item-ollie')).not.toHaveAttribute('data-highlighted');
	});
});

// ---------------------------------------------------------------------------
// T043 — the rest of the trigger contract
// ---------------------------------------------------------------------------

describe('Combobox trigger contract (T043)', () => {
	it('leaves the caret at the end of the input', async () => {
		const user = userEvent.setup();
		renderCombobox({ defaultValue: 'kickflip' });

		const input = await focusInput();
		expect(input.selectionStart).toBe(0);

		await openFromTrigger(user);

		await waitFor(() => expect(input.selectionStart).toBe(input.value.length));
		expect(input.selectionEnd).toBe(input.value.length);
		expect(input.value).toBe('kickflip');
	});

	it('highlights the selected option when a value is already set', async () => {
		const user = userEvent.setup();
		renderCombobox({ defaultValue: 'hardflip' });

		await openFromTrigger(user);

		await waitFor(() => expect(highlightedLabel()).toBe('Hardflip'));
	});

	it('highlights the first option with autoHighlight and no value', async () => {
		const user = userEvent.setup();
		renderCombobox({ autoHighlight: true });

		await openFromTrigger(user);

		await waitFor(() => expect(highlightedLabel()).toBe('Kickflip'));
	});

	it('highlights nothing with neither a value nor autoHighlight', async () => {
		const user = userEvent.setup();
		renderCombobox();

		await openFromTrigger(user);

		expect(highlightedOption()).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// T044 — the vertical badge list
// ---------------------------------------------------------------------------

describe('Combobox badge list orientation (T044)', () => {
	it('reports vertical on the list and on every badge', () => {
		renderCombobox({
			multiple: true,
			defaultValue: ['kickflip', 'heelflip'],
			badgeListOrientation: 'vertical'
		});

		const badgeList = screen.getByTestId('badge-list');
		expect(badgeList).toHaveAttribute('aria-orientation', 'vertical');
		expect(badgeList).toHaveAttribute('data-orientation', 'vertical');

		for (const value of ['kickflip', 'heelflip']) {
			const badge = screen.getByTestId(`badge-${value}`);
			expect(badge).toHaveAttribute('aria-orientation', 'vertical');
			expect(badge).toHaveAttribute('data-orientation', 'vertical');
		}
	});
});

// ---------------------------------------------------------------------------
// T045 — the anchor's focus behaviour
// ---------------------------------------------------------------------------

describe('Combobox anchor focus (T045)', () => {
	it('moves focus to the input when the anchor itself is clicked', async () => {
		const user = userEvent.setup();
		renderCombobox();

		screen.getByTestId('outside').focus();

		await user.click(screen.getByTestId('anchor'));

		await waitFor(() => expect(document.activeElement).toBe(textInput()));
	});

	it('leaves focus where it was with preventInputFocus', async () => {
		const user = userEvent.setup();
		renderCombobox({ preventInputFocus: true });

		const outside = screen.getByTestId('outside');
		outside.focus();

		await user.click(screen.getByTestId('anchor'));

		expect(document.activeElement).toBe(outside);
	});

	it('marks itself focused for as long as the focus is inside it', async () => {
		renderCombobox();

		const anchor = screen.getByTestId('anchor');
		expect(anchor).not.toHaveAttribute('data-focused');

		await focusInput();
		expect(anchor).toHaveAttribute('data-focused', '');

		screen.getByTestId('outside').focus();
		await tick();
		expect(anchor).not.toHaveAttribute('data-focused');
	});
});

// ---------------------------------------------------------------------------
// T046 — the portal's caller-chosen container
// ---------------------------------------------------------------------------

describe('Combobox portal (T046)', () => {
	it('portals the popover out of the root by default', async () => {
		renderCombobox({ defaultOpen: true });
		const content = await waitForList();

		expect(screen.getByTestId('root').contains(content)).toBe(false);
		expect(document.body.contains(content)).toBe(true);
	});

	it('portals the popover into a caller-supplied container', async () => {
		const container = document.createElement('div');
		document.body.append(container);

		try {
			renderCombobox({ defaultOpen: true, portalTo: container });
			const content = await waitForList();

			expect(container.contains(content)).toBe(true);
		} finally {
			container.remove();
		}
	});

	it('leaves the popover in place with a disabled portal', async () => {
		renderCombobox({ defaultOpen: true, portalDisabled: true });
		const content = await waitForList();

		expect(screen.getByTestId('root').contains(content)).toBe(true);
	});
});
