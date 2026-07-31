import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import { findAdjacentIndex, splitByDelimiter } from './index.js';
import Harness, {
	TAGS_INPUT_PLACEHOLDER,
	type TagsInputHarnessProps
} from './tags-input.test.svelte';

const TRICKS = ['kickflip', 'heelflip', 'fs-540'];

function renderTagsInput(props: TagsInputHarnessProps = {}) {
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

function queryBySlot(slot: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
}

function textInput(): HTMLInputElement {
	return screen.getByPlaceholderText(TAGS_INPUT_PLACEHOLDER);
}

function itemFor(tag: string): HTMLElement {
	return screen.getByTestId(`item-${tag}`);
}

function deleteFor(tag: string): HTMLElement {
	return screen.getByLabelText(`Remove ${tag}`);
}

/** The tag values, in document order, the component is currently rendering. */
function renderedTags(): string[] {
	return allBySlot('tags-input-item-text').map((element) => element.textContent ?? '');
}

/** The index of the single highlighted tag, or `null`. */
function highlightedIndex(): number | null {
	const index = allBySlot('tags-input-item').findIndex((item) =>
		item.hasAttribute('data-highlighted')
	);
	return index === -1 ? null : index;
}

/**
 * The root clears the highlight from a `requestAnimationFrame` so focus can settle on the new target
 * first (research R-04), so a blur assertion has to wait one frame and one flush.
 */
async function settleBlur(): Promise<void> {
	await new Promise<void>((resolve) => {
		requestAnimationFrame(() => resolve());
	});
	await tick();
}

// ---------------------------------------------------------------------------
// Pure helpers (T015 — the traversal every navigation assertion below rides on)
// ---------------------------------------------------------------------------

describe('tags-input pure helpers', () => {
	it('splits on the delimiter, trims each candidate and drops the empties', () => {
		expect(splitByDelimiter('kickflip, heelflip ,, fs-540', ',')).toEqual([
			'kickflip',
			'heelflip',
			'fs-540'
		]);
		expect(splitByDelimiter('   ', ',')).toEqual([]);
		expect(splitByDelimiter('kickflip;heelflip', ';')).toEqual(['kickflip', 'heelflip']);
	});

	it('walks to the adjacent enabled index, wrapping only when looping', () => {
		const enabled = () => true;

		expect(
			findAdjacentIndex({
				current: null,
				count: 3,
				direction: 'prev',
				loop: false,
				isEnabled: enabled
			})
		).toBe(2);
		expect(
			findAdjacentIndex({
				current: null,
				count: 3,
				direction: 'next',
				loop: false,
				isEnabled: enabled
			})
		).toBe(0);
		expect(
			findAdjacentIndex({
				current: 0,
				count: 3,
				direction: 'prev',
				loop: false,
				isEnabled: enabled
			})
		).toBeNull();
		expect(
			findAdjacentIndex({ current: 0, count: 3, direction: 'prev', loop: true, isEnabled: enabled })
		).toBe(2);
		expect(
			findAdjacentIndex({ current: 2, count: 3, direction: 'next', loop: true, isEnabled: enabled })
		).toBe(0);
		expect(
			findAdjacentIndex({
				current: 2,
				count: 3,
				direction: 'next',
				loop: false,
				isEnabled: enabled
			})
		).toBeNull();
	});

	it('skips disabled indices and returns null when nothing is enabled', () => {
		// Real value indices, not enabled *positions* — upstream's `findNextEnabledIndex` maps the
		// latter onto the former and is off by the shift once an item is disabled (divergence D-5).
		const skipMiddle = (index: number) => index !== 1;

		expect(
			findAdjacentIndex({
				current: 2,
				count: 3,
				direction: 'prev',
				loop: false,
				isEnabled: skipMiddle
			})
		).toBe(0);
		expect(
			findAdjacentIndex({
				current: 0,
				count: 3,
				direction: 'next',
				loop: false,
				isEnabled: skipMiddle
			})
		).toBe(2);
		expect(
			findAdjacentIndex({
				current: null,
				count: 3,
				direction: 'prev',
				loop: false,
				isEnabled: skipMiddle
			})
		).toBe(2);
		expect(
			findAdjacentIndex({
				current: 1,
				count: 3,
				direction: 'next',
				loop: false,
				isEnabled: skipMiddle
			})
		).toBe(2);
		expect(
			findAdjacentIndex({
				current: 1,
				count: 3,
				direction: 'prev',
				loop: false,
				isEnabled: skipMiddle
			})
		).toBe(0);
		expect(
			findAdjacentIndex({
				current: 0,
				count: 3,
				direction: 'next',
				loop: false,
				isEnabled: () => false
			})
		).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// T004 — roles, ARIA wiring and the data-attribute contract
// ---------------------------------------------------------------------------

describe('TagsInput accessibility (T004)', () => {
	it('renders the documented data-slots and leaves every false flag absent', () => {
		renderTagsInput({ defaultValue: ['kickflip'] });

		const root = screen.getByTestId('root');
		expect(root).toHaveAttribute('data-slot', 'tags-input');
		expect(root).toHaveAttribute('dir', 'ltr');
		expect(root).not.toHaveAttribute('data-disabled');
		expect(root).not.toHaveAttribute('data-invalid');
		expect(root).not.toHaveAttribute('data-readonly');

		expect(bySlot('tags-input-label')).toBeInTheDocument();
		expect(bySlot('tags-input-input')).toBe(textInput());
		expect(bySlot('tags-input-item')).toBe(itemFor('kickflip'));
		expect(bySlot('tags-input-item-text')).toBeInTheDocument();
		expect(bySlot('tags-input-item-delete')).toBe(deleteFor('kickflip'));
		expect(bySlot('tags-input-clear')).toBeInTheDocument();
	});

	it('associates the label with the input and names it', () => {
		renderTagsInput();

		const label = bySlot('tags-input-label');
		const field = textInput();

		expect(label).toHaveAttribute('for', field.id);
		expect(field).toHaveAttribute('aria-labelledby', label.id);
		expect(screen.getByLabelText('Tricks')).toBe(field);
	});

	it('omits aria-labelledby entirely while no label is mounted (D-6)', () => {
		renderTagsInput({ withLabel: false });

		expect(textInput()).not.toHaveAttribute('aria-labelledby');
	});

	it('emits the input contract', () => {
		renderTagsInput();

		const field = textInput();
		expect(field).toHaveAttribute('type', 'text');
		expect(field).toHaveAttribute('autocapitalize', 'off');
		expect(field).toHaveAttribute('autocomplete', 'off');
		expect(field).toHaveAttribute('autocorrect', 'off');
		expect(field).toHaveAttribute('spellcheck', 'false');
		expect(field).toHaveAttribute('aria-readonly', 'false');
		expect(field).toHaveAttribute('dir', 'ltr');
		expect(field).not.toHaveAttribute('data-invalid');
		expect(field).not.toBeDisabled();
	});

	it('emits the item, item text and item delete contract', () => {
		renderTagsInput({ defaultValue: ['kickflip'] });

		const item = itemFor('kickflip');
		const text = bySlot('tags-input-item-text');
		const remove = deleteFor('kickflip');

		expect(item).toHaveAttribute('aria-labelledby', text.id);
		expect(item).toHaveAttribute('aria-current', 'false');
		expect(item).toHaveAttribute('aria-disabled', 'false');
		expect(item).toHaveAttribute('data-state', 'inactive');
		expect(item).not.toHaveAttribute('data-highlighted');
		expect(item).not.toHaveAttribute('data-editing');
		expect(item).not.toHaveAttribute('data-editable');
		expect(item).not.toHaveAttribute('data-disabled');

		// No children, so the text falls back to `displayValue(item.value)`.
		expect(text).toHaveTextContent('kickflip');

		expect(remove).toHaveAttribute('type', 'button');
		expect(remove).toHaveAttribute('tabindex', '-1');
		expect(remove).toHaveAttribute('aria-labelledby', text.id);
		expect(remove).toHaveAttribute('aria-controls', item.id);
		expect(remove).toHaveAttribute('aria-current', 'false');
		expect(remove).toHaveAttribute('data-state', 'inactive');
		// No children, so it falls back to the `X` icon from `@lucide/svelte`.
		expect(remove.querySelector('svg')).not.toBeNull();
	});

	it('drops the delete button out of the roving tabindex when its item is disabled', () => {
		renderTagsInput({ defaultValue: ['kickflip'], disabledValues: ['kickflip'] });

		const remove = deleteFor('kickflip');
		// `tabindex={disabled ? undefined : -1}`: an enabled tag's delete button is reachable only
		// through its tag, while a disabled one falls back to the button's own default.
		expect(remove).not.toHaveAttribute('tabindex');
		expect(remove).toHaveAttribute('data-disabled', '');
		expect(remove).toHaveAttribute('data-state', 'inactive');
	});

	it('emits the clear contract and marks it editable when the root is', () => {
		renderTagsInput({ defaultValue: ['kickflip'], editable: true });

		const clear = screen.getByTestId('clear');
		expect(clear).toHaveAttribute('type', 'button');
		expect(clear).toHaveAttribute('aria-disabled', 'false');
		expect(clear).toHaveAttribute('data-state', 'visible');
		expect(clear).not.toHaveAttribute('data-disabled');

		expect(itemFor('kickflip')).toHaveAttribute('data-editable', '');
	});

	it('reflects disabled on the root, the items, the delete buttons and the clear button', () => {
		renderTagsInput({ defaultValue: ['kickflip'], disabled: true });

		expect(screen.getByTestId('root')).toHaveAttribute('data-disabled', '');
		// The input carries the native `disabled` attribute rather than a redundant data attribute —
		// contract §4 gives it `data-invalid` only.
		expect(textInput()).toBeDisabled();
		expect(itemFor('kickflip')).toHaveAttribute('data-disabled', '');
		expect(itemFor('kickflip')).toHaveAttribute('aria-disabled', 'true');
		expect(deleteFor('kickflip')).toHaveAttribute('data-disabled', '');
		expect(screen.getByTestId('clear')).toHaveAttribute('data-disabled', '');
		expect(screen.getByTestId('clear')).toHaveAttribute('aria-disabled', 'true');
	});

	it('reflects readOnly on the root and the input', () => {
		renderTagsInput({ defaultValue: ['kickflip'], readOnly: true });

		expect(screen.getByTestId('root')).toHaveAttribute('data-readonly', '');
		expect(textInput()).toHaveAttribute('readonly');
		expect(textInput()).toHaveAttribute('aria-readonly', 'true');
	});
});

// ---------------------------------------------------------------------------
// T005 — the keyboard state machine
// ---------------------------------------------------------------------------

describe('TagsInput keyboard (T005)', () => {
	async function setup(props: TagsInputHarnessProps = {}) {
		const user = userEvent.setup();
		renderTagsInput({ defaultValue: [...TRICKS], ...props });
		await user.click(textInput());
		return user;
	}

	it('walks the highlight toward the start with ArrowLeft and stops at the first tag', async () => {
		const user = await setup();

		await user.keyboard('{ArrowLeft}');
		expect(highlightedIndex()).toBe(2);
		expect(itemFor('fs-540')).toHaveAttribute('data-state', 'active');
		expect(itemFor('fs-540')).toHaveAttribute('aria-current', 'true');

		await user.keyboard('{ArrowLeft}');
		expect(highlightedIndex()).toBe(1);

		await user.keyboard('{ArrowLeft}');
		expect(highlightedIndex()).toBe(0);

		// `loop` defaults to false, so the traversal stops at the boundary.
		await user.keyboard('{ArrowLeft}');
		expect(highlightedIndex()).toBe(0);
	});

	it('walks back toward the end with ArrowRight and releases the caret past the last tag', async () => {
		const user = await setup();

		await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
		expect(highlightedIndex()).toBe(0);

		await user.keyboard('{ArrowRight}');
		expect(highlightedIndex()).toBe(1);

		await user.keyboard('{ArrowRight}{ArrowRight}');
		expect(highlightedIndex()).toBeNull();
		expect(textInput().selectionStart).toBe(0);
		expect(textInput().selectionEnd).toBe(0);
	});

	it('wraps in both directions when loop is set', async () => {
		const user = await setup({ loop: true });

		await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
		expect(highlightedIndex()).toBe(0);

		await user.keyboard('{ArrowLeft}');
		expect(highlightedIndex()).toBe(2);

		await user.keyboard('{ArrowRight}');
		expect(highlightedIndex()).toBe(0);
	});

	it('jumps to the first and last tag with Home and End', async () => {
		const user = await setup();

		await user.keyboard('{ArrowLeft}');
		await user.keyboard('{Home}');
		expect(highlightedIndex()).toBe(0);

		await user.keyboard('{End}');
		expect(highlightedIndex()).toBe(2);
	});

	it('leaves Home and End alone while no tag is highlighted', async () => {
		const user = await setup();

		await user.keyboard('{Home}{End}');
		expect(highlightedIndex()).toBeNull();
	});

	it('clears the highlight and resets the caret on Escape', async () => {
		const user = await setup();

		await user.keyboard('{ArrowLeft}');
		expect(highlightedIndex()).toBe(2);

		await user.keyboard('{Escape}');
		expect(highlightedIndex()).toBeNull();
		expect(textInput().selectionStart).toBe(0);
	});

	it('highlights the last tag on the first Backspace and removes it on the second', async () => {
		const onValueChange = vi.fn();
		const user = await setup({ onValueChange });

		await user.keyboard('{Backspace}');
		expect(highlightedIndex()).toBe(2);
		expect(onValueChange).not.toHaveBeenCalled();

		await user.keyboard('{Backspace}');
		expect(onValueChange).toHaveBeenCalledWith(['kickflip', 'heelflip']);
		expect(renderedTags()).toEqual(['kickflip', 'heelflip']);
		expect(highlightedIndex()).toBe(1);
	});

	it('removes the highlighted tag on Delete and highlights the adjacent one', async () => {
		const user = await setup();

		await user.keyboard('{ArrowLeft}{ArrowLeft}');
		expect(highlightedIndex()).toBe(1);

		await user.keyboard('{Delete}');
		expect(renderedTags()).toEqual(['kickflip', 'fs-540']);
		expect(highlightedIndex()).toBe(0);
	});

	it('clears the highlight and refocuses the input when the first tag is removed', async () => {
		const user = await setup({ defaultValue: ['kickflip'] });

		await user.keyboard('{Backspace}{Backspace}');
		expect(renderedTags()).toEqual([]);
		expect(highlightedIndex()).toBeNull();
		expect(document.activeElement).toBe(textInput());
	});

	it('clears the highlight as soon as a printable character is typed', async () => {
		const user = await setup();

		await user.keyboard('{ArrowLeft}');
		expect(highlightedIndex()).toBe(2);

		await user.keyboard('o');
		expect(highlightedIndex()).toBeNull();
		expect(textInput()).toHaveValue('o');
	});

	it('ignores navigation while the caret is not at the start of the text', async () => {
		const user = await setup();

		await user.type(textInput(), 'ollie');
		await user.keyboard('{ArrowLeft}');
		expect(highlightedIndex()).toBeNull();

		// The ArrowLeft above moved the caret from 5 to 4 instead of highlighting a tag, so Backspace
		// deletes the character it now sits behind rather than touching the tag list.
		await user.keyboard('{Backspace}');
		expect(renderedTags()).toEqual(TRICKS);
		expect(textInput()).toHaveValue('olle');
	});

	it('ignores navigation with no tags at all', async () => {
		const user = await setup({ defaultValue: [] });

		await user.keyboard('{ArrowLeft}{Backspace}{Home}{End}');
		expect(allBySlot('tags-input-item')).toHaveLength(0);
	});

	it('skips per-item-disabled tags while navigating (D-5)', async () => {
		const user = await setup({ disabledValues: ['heelflip'] });

		await user.keyboard('{ArrowLeft}');
		expect(highlightedIndex()).toBe(2);

		await user.keyboard('{ArrowLeft}');
		expect(highlightedIndex()).toBe(0);

		await user.keyboard('{ArrowRight}');
		expect(highlightedIndex()).toBe(2);
	});

	it('adds a tag on Enter, clears the input and leaves nothing highlighted', async () => {
		const user = await setup({ defaultValue: [] });

		await user.keyboard('{ArrowLeft}');
		await user.type(textInput(), 'ollie{Enter}');

		expect(renderedTags()).toEqual(['ollie']);
		expect(textInput()).toHaveValue('');
		expect(highlightedIndex()).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// T006 — uncontrolled behaviour and the guard rails
// ---------------------------------------------------------------------------

describe('TagsInput uncontrolled (T006)', () => {
	it('seeds from defaultValue and appends a trimmed tag on Enter', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderTagsInput({ defaultValue: ['kickflip'], onValueChange });

		expect(renderedTags()).toEqual(['kickflip']);

		await user.type(textInput(), '  heelflip  {Enter}');

		expect(onValueChange).toHaveBeenCalledWith(['kickflip', 'heelflip']);
		expect(renderedTags()).toEqual(['kickflip', 'heelflip']);
		expect(textInput()).toHaveValue('');
	});

	it('removes the last tag with two Backspace presses and keeps focus on the input', async () => {
		const user = userEvent.setup();
		renderTagsInput({ defaultValue: ['kickflip', 'heelflip'] });

		await user.click(textInput());
		await user.keyboard('{Backspace}{Backspace}');

		expect(renderedTags()).toEqual(['kickflip']);
		expect(document.activeElement).toBe(textInput());
	});

	it('suppresses every interaction while disabled', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderTagsInput({ defaultValue: ['kickflip'], disabled: true, onValueChange });

		await user.click(deleteFor('kickflip'));
		await user.click(screen.getByTestId('clear'));

		expect(renderedTags()).toEqual(['kickflip']);
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('keeps the input focusable but inert while readOnly', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderTagsInput({ defaultValue: ['kickflip'], readOnly: true, onValueChange });

		await user.click(textInput());
		expect(document.activeElement).toBe(textInput());

		await user.keyboard('heelflip{Enter}');
		await user.click(deleteFor('kickflip'));
		await user.click(screen.getByTestId('clear'));

		expect(renderedTags()).toEqual(['kickflip']);
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('never opens the edit field while readOnly, even when editable', async () => {
		const user = userEvent.setup();
		renderTagsInput({ defaultValue: ['kickflip'], readOnly: true, editable: true });

		await user.dblClick(itemFor('kickflip'));

		expect(queryBySlot('tags-input-item-edit')).toBeNull();
		expect(itemFor('kickflip')).not.toHaveAttribute('data-editing');

		// The keyboard route into editing is guarded the same way.
		await user.click(textInput());
		await user.keyboard('{ArrowLeft}{Enter}');

		expect(queryBySlot('tags-input-item-edit')).toBeNull();
		expect(itemFor('kickflip')).not.toHaveAttribute('data-editing');
	});
});

// ---------------------------------------------------------------------------
// T007 — controlled behaviour
// ---------------------------------------------------------------------------

describe('TagsInput controlled (T007)', () => {
	it('moves a parent that accepts the write', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderTagsInput({ binding: 'value', value: ['kickflip'], onValueChange });

		await user.type(textInput(), 'heelflip{Enter}');

		expect(onValueChange).toHaveBeenCalledWith(['kickflip', 'heelflip']);
		expect(renderedTags()).toEqual(['kickflip', 'heelflip']);
	});

	it('never moves on its own when the parent declines the write', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onDeclinedValue = vi.fn();
		renderTagsInput({
			binding: 'function',
			authoritative: ['kickflip'],
			onDeclinedValue,
			onValueChange
		});

		await user.type(textInput(), 'heelflip{Enter}');

		expect(onDeclinedValue).toHaveBeenCalledWith(['kickflip', 'heelflip']);
		expect(onValueChange).toHaveBeenCalledWith(['kickflip', 'heelflip']);
		expect(renderedTags()).toEqual(['kickflip']);

		await user.click(deleteFor('kickflip'));

		expect(onValueChange).toHaveBeenLastCalledWith([]);
		expect(renderedTags()).toEqual(['kickflip']);
	});
});

// ---------------------------------------------------------------------------
// T008 — RTL
// ---------------------------------------------------------------------------

describe('TagsInput RTL (T008)', () => {
	async function setupRtl(props: TagsInputHarnessProps = {}) {
		const user = userEvent.setup();
		renderTagsInput({ defaultValue: [...TRICKS], dir: 'rtl', ...props });
		await user.click(textInput());
		return user;
	}

	it('resolves the direction from a DirectionProvider ancestor', () => {
		renderTagsInput({ providerDir: 'rtl' });

		expect(screen.getByTestId('root')).toHaveAttribute('dir', 'rtl');
		expect(textInput()).toHaveAttribute('dir', 'rtl');
	});

	it('inverts the horizontal arrows', async () => {
		const user = await setupRtl();

		await user.keyboard('{ArrowRight}');
		expect(highlightedIndex()).toBe(2);

		await user.keyboard('{ArrowRight}');
		expect(highlightedIndex()).toBe(1);

		await user.keyboard('{ArrowLeft}');
		expect(highlightedIndex()).toBe(2);

		// Past the last tag the highlight is released and the caret goes home, exactly as ArrowRight
		// does under `ltr`.
		await user.keyboard('{ArrowLeft}');
		expect(highlightedIndex()).toBeNull();
		expect(textInput().selectionStart).toBe(0);
	});

	it('leaves Home, End, Escape and Backspace unchanged', async () => {
		const user = await setupRtl();

		await user.keyboard('{ArrowRight}{Home}');
		expect(highlightedIndex()).toBe(0);

		await user.keyboard('{End}');
		expect(highlightedIndex()).toBe(2);

		await user.keyboard('{Delete}');
		expect(renderedTags()).toEqual(['kickflip', 'heelflip']);

		await user.keyboard('{Escape}');
		expect(highlightedIndex()).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// T009 — pointer interaction
// ---------------------------------------------------------------------------

describe('TagsInput pointer interaction (T009)', () => {
	it('removes only the clicked tag through its delete button', async () => {
		const user = userEvent.setup();
		renderTagsInput({ defaultValue: [...TRICKS] });

		await user.click(deleteFor('heelflip'));

		expect(renderedTags()).toEqual(['kickflip', 'fs-540']);
	});

	it('clears every tag in one change and returns focus to the input', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderTagsInput({ defaultValue: [...TRICKS], onValueChange });

		await user.click(screen.getByTestId('clear'));

		expect(onValueChange).toHaveBeenCalledTimes(1);
		expect(onValueChange).toHaveBeenCalledWith([]);
		expect(renderedTags()).toEqual([]);
		expect(document.activeElement).toBe(textInput());
	});

	it('keeps the clear button out of the tree while the list is empty', () => {
		renderTagsInput({ defaultValue: [] });

		expect(screen.queryByTestId('clear')).toBeNull();
		expect(queryBySlot('tags-input-clear')).toBeNull();
	});

	it('keeps a force-mounted clear button rendered but reported invisible', () => {
		renderTagsInput({ defaultValue: [], clearForceMount: true });

		const clear = screen.getByTestId('clear');
		expect(clear).toBeInTheDocument();
		expect(clear).toHaveAttribute('data-state', 'invisible');
	});

	it('hands the clear attributes to the caller element in child mode', async () => {
		const user = userEvent.setup();
		renderTagsInput({ defaultValue: ['kickflip'], clearAsChild: true });

		const clear = screen.getByTestId('clear-child');
		expect(clear).toHaveAttribute('data-slot', 'tags-input-clear');
		expect(clear).toHaveAttribute('data-state', 'visible');
		expect(clear).not.toHaveAttribute('data-disabled');
		expect(allBySlot('tags-input-clear')).toEqual([clear]);

		await user.click(clear);
		expect(renderedTags()).toEqual([]);
	});

	it('highlights a tag when it is clicked without removing it', async () => {
		const user = userEvent.setup();
		renderTagsInput({ defaultValue: [...TRICKS] });

		await user.click(screen.getByText('heelflip'));

		expect(itemFor('heelflip')).toHaveAttribute('data-highlighted', '');
		expect(itemFor('heelflip')).toHaveAttribute('aria-current', 'true');
		expect(renderedTags()).toEqual(TRICKS);
	});

	it('focuses the text input when the root padding is clicked', async () => {
		const user = userEvent.setup();
		renderTagsInput({ defaultValue: ['kickflip'] });

		await user.click(screen.getByTestId('list'));

		expect(document.activeElement).toBe(textInput());
	});

	it('clears the highlight when focus leaves the component', async () => {
		const user = userEvent.setup();
		renderTagsInput({ defaultValue: [...TRICKS], withClear: false });

		await user.click(textInput());
		await user.keyboard('{ArrowLeft}');
		expect(highlightedIndex()).toBe(2);

		await user.tab();
		expect(document.activeElement).toBe(screen.getByTestId('outside'));

		await settleBlur();
		expect(highlightedIndex()).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// T010 — validation, dedupe, max and addOnPaste
// ---------------------------------------------------------------------------

describe('TagsInput validation (T010)', () => {
	it('swallows a duplicate, reports it and marks the field invalid', async () => {
		const user = userEvent.setup();
		const onInvalid = vi.fn();
		const onValueChange = vi.fn();
		renderTagsInput({ defaultValue: ['kickflip'], onInvalid, onValueChange });

		await user.type(textInput(), 'kickflip{Enter}');

		expect(onInvalid).toHaveBeenCalledWith('kickflip');
		expect(onValueChange).not.toHaveBeenCalled();
		expect(renderedTags()).toEqual(['kickflip']);
		// A duplicate returns `true` upstream so the input still clears (research R-08 / FR-003).
		expect(textInput()).toHaveValue('');
		expect(screen.getByTestId('root')).toHaveAttribute('data-invalid', '');
		expect(textInput()).toHaveAttribute('data-invalid', '');

		await user.type(textInput(), 'heelflip{Enter}');

		expect(renderedTags()).toEqual(['kickflip', 'heelflip']);
		expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
		expect(textInput()).not.toHaveAttribute('data-invalid');
	});

	it('rejects a candidate onValidate refuses', async () => {
		const user = userEvent.setup();
		const onValidate = vi.fn((value: string) => value.length > 2);
		const onInvalid = vi.fn();
		renderTagsInput({ onValidate, onInvalid });

		await user.type(textInput(), 'ol{Enter}');

		expect(onValidate).toHaveBeenCalledWith('ol');
		expect(onInvalid).toHaveBeenCalledWith('ol');
		expect(renderedTags()).toEqual([]);
		expect(screen.getByTestId('root')).toHaveAttribute('data-invalid', '');
	});

	it('rejects an add past max with the raw, untrimmed text', async () => {
		const user = userEvent.setup();
		const onValidate = vi.fn(() => true);
		const onInvalid = vi.fn();
		renderTagsInput({ defaultValue: ['kickflip', 'heelflip'], max: 2, onValidate, onInvalid });

		await user.type(textInput(), ' ollie {Enter}');

		expect(onInvalid).toHaveBeenCalledWith(' ollie ');
		expect(onValidate).not.toHaveBeenCalled();
		expect(renderedTags()).toEqual(['kickflip', 'heelflip']);

		// Upstream parity, deliberately: the cap is a capacity limit, not an input-validity failure,
		// so neither the root nor the input picks up the invalid state (FR-015).
		expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
		expect(textInput()).not.toHaveAttribute('data-invalid');
	});

	it('splits, dedupes and validates a paste in a single change', async () => {
		const user = userEvent.setup();
		const onValidate = vi.fn((value: string) => value !== 'ollie');
		const onInvalid = vi.fn();
		const onValueChange = vi.fn();
		renderTagsInput({
			defaultValue: ['kickflip'],
			addOnPaste: true,
			onValidate,
			onInvalid,
			onValueChange
		});

		await user.click(textInput());
		await user.paste('heelflip, kickflip , heelflip, ollie');

		expect(onValueChange).toHaveBeenCalledTimes(1);
		expect(onValueChange).toHaveBeenCalledWith(['kickflip', 'heelflip']);
		// One report for the candidate that was already present, and none for the `onValidate`
		// rejection — upstream's paste path filters those silently (research R-08).
		expect(onInvalid).toHaveBeenCalledTimes(1);
		expect(onInvalid).toHaveBeenCalledWith('kickflip');
		// The paste path never touches the invalid flag, and never falls back to a native insertion.
		expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
		expect(textInput()).toHaveValue('');
	});

	it('rejects an over-max paste in full', async () => {
		const user = userEvent.setup();
		const onInvalid = vi.fn();
		const onValueChange = vi.fn();
		renderTagsInput({
			defaultValue: ['kickflip', 'heelflip'],
			max: 2,
			addOnPaste: true,
			onInvalid,
			onValueChange
		});

		await user.click(textInput());
		await user.paste('ollie, indy, nollie');

		expect(onInvalid).toHaveBeenCalledWith('ollie, indy, nollie');
		expect(onValueChange).not.toHaveBeenCalled();
		expect(renderedTags()).toEqual(['kickflip', 'heelflip']);
	});

	it('leaves a paste alone unless addOnPaste is set', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderTagsInput({ onValueChange });

		await user.click(textInput());
		await user.paste('ollie, indy');

		expect(onValueChange).not.toHaveBeenCalled();
		expect(textInput()).toHaveValue('ollie, indy');
	});
});

// ---------------------------------------------------------------------------
// T011 — delimiter on type, addOnTab and blurBehavior
// ---------------------------------------------------------------------------

describe('TagsInput delimiter, addOnTab and blurBehavior (T011)', () => {
	it('commits the typed text when the delimiter is typed last', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderTagsInput({ defaultValue: ['kickflip'], onValueChange });

		await user.type(textInput(), 'heelflip,');

		expect(onValueChange).toHaveBeenCalledWith(['kickflip', 'heelflip']);
		expect(renderedTags()).toEqual(['kickflip', 'heelflip']);
		expect(textInput()).toHaveValue('');
	});

	it('commits nothing when the delimiter is not the last character', async () => {
		const onValueChange = vi.fn();
		renderTagsInput({ onValueChange });

		// A bulk value change (an IME commit, an autofill) is the only way the delimiter lands in the
		// middle: typing it character by character would commit on the delimiter keystroke itself.
		await fireEvent.input(textInput(), { target: { value: 'kickflip,heelflip' } });

		expect(onValueChange).not.toHaveBeenCalled();
		expect(textInput()).toHaveValue('kickflip,heelflip');
	});

	it('honours a custom delimiter and ignores the default one', async () => {
		const user = userEvent.setup();
		renderTagsInput({ delimiter: ';' });

		await user.type(textInput(), 'kickflip,');
		expect(renderedTags()).toEqual([]);
		expect(textInput()).toHaveValue('kickflip,');

		await user.type(textInput(), ';');
		expect(renderedTags()).toEqual(['kickflip,']);
		expect(textInput()).toHaveValue('');
	});

	it('adds on Tab and stays put when addOnTab is set', async () => {
		const user = userEvent.setup();
		renderTagsInput({ addOnTab: true, withClear: false });

		await user.type(textInput(), 'kickflip');
		await user.tab();

		expect(renderedTags()).toEqual(['kickflip']);
		expect(document.activeElement).toBe(textInput());
	});

	it('moves focus normally on Tab by default', async () => {
		const user = userEvent.setup();
		renderTagsInput({ withClear: false });

		await user.type(textInput(), 'kickflip');
		await user.tab();

		expect(renderedTags()).toEqual([]);
		expect(document.activeElement).toBe(screen.getByTestId('outside'));
	});

	it('leaves the typed text in place on blur by default', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderTagsInput({ onValueChange, withClear: false });

		await user.type(textInput(), 'kickflip');
		await user.tab();

		expect(onValueChange).not.toHaveBeenCalled();
		expect(textInput()).toHaveValue('kickflip');
	});

	it('commits the typed text on blur when blurBehavior is "add"', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderTagsInput({ blurBehavior: 'add', onValueChange, withClear: false });

		await user.type(textInput(), 'kickflip');
		await user.tab();

		expect(onValueChange).toHaveBeenCalledWith(['kickflip']);
		expect(textInput()).toHaveValue('');
	});

	it('discards the typed text on blur when blurBehavior is "clear"', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderTagsInput({ blurBehavior: 'clear', onValueChange, withClear: false });

		await user.type(textInput(), 'kickflip');
		await user.tab();

		expect(onValueChange).not.toHaveBeenCalled();
		expect(textInput()).toHaveValue('');
	});
});

// ---------------------------------------------------------------------------
// T012 — in-place editing
// ---------------------------------------------------------------------------

describe('TagsInput editing (T012)', () => {
	it('opens a focused, pre-filled edit field on double click', async () => {
		const user = userEvent.setup();
		renderTagsInput({ defaultValue: ['kickflip'], editable: true });

		await user.dblClick(itemFor('kickflip'));

		const field = bySlot('tags-input-item-edit') as HTMLInputElement;
		expect(field).toHaveValue('kickflip');
		expect(document.activeElement).toBe(field);
		expect(itemFor('kickflip')).toHaveAttribute('data-editing', '');
		// The delete button is not rendered for the tag being edited.
		expect(screen.queryByLabelText('Remove kickflip')).toBeNull();
	});

	it('replaces the tag in place when the edit is committed (D-4)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderTagsInput({ defaultValue: ['kickflip'], editable: true, onValueChange });

		await user.dblClick(itemFor('kickflip'));
		const field = bySlot('tags-input-item-edit');
		await user.clear(field);
		await user.type(field, 'heelflip{Enter}');

		// Upstream's own test expects `["kickflip", "heelflip"]` here and calls the append out in a
		// comment; the MDX, `onItemUpdate` and spec FR-009 all specify replacement (research R-09).
		expect(onValueChange).toHaveBeenLastCalledWith(['heelflip']);
		expect(renderedTags()).toEqual(['heelflip']);
		expect(queryBySlot('tags-input-item-edit')).toBeNull();
		expect(itemFor('heelflip')).toHaveAttribute('data-highlighted', '');
	});

	it('enters edit mode from the keyboard with Enter on a highlighted tag', async () => {
		const user = userEvent.setup();
		renderTagsInput({ defaultValue: ['kickflip'], editable: true });

		await user.click(textInput());
		await user.keyboard('{ArrowLeft}{Enter}');

		expect(bySlot('tags-input-item-edit')).toHaveValue('kickflip');
	});

	it('discards the edit and re-highlights the tag on Escape', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderTagsInput({ defaultValue: ['kickflip'], editable: true, onValueChange });

		await user.dblClick(itemFor('kickflip'));
		const field = bySlot('tags-input-item-edit');
		await user.clear(field);
		await user.type(field, 'heelflip{Escape}');

		expect(onValueChange).not.toHaveBeenCalled();
		expect(renderedTags()).toEqual(['kickflip']);
		expect(queryBySlot('tags-input-item-edit')).toBeNull();
		expect(itemFor('kickflip')).toHaveAttribute('data-highlighted', '');
		expect(document.activeElement).toBe(textInput());
	});

	it('discards the edit and re-highlights the tag on blur', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderTagsInput({ defaultValue: ['kickflip'], editable: true, onValueChange });

		await user.dblClick(itemFor('kickflip'));
		const field = bySlot('tags-input-item-edit');
		await user.clear(field);
		await user.type(field, 'heelflip');

		// Blur by moving focus to the text input; unlike Escape, the edit field never pulls focus back.
		await user.click(textInput());
		await settleBlur();

		expect(onValueChange).not.toHaveBeenCalled();
		expect(renderedTags()).toEqual(['kickflip']);
		expect(queryBySlot('tags-input-item-edit')).toBeNull();
		expect(itemFor('kickflip')).toHaveAttribute('data-highlighted', '');
	});

	it('does nothing on double click while editable is unset', async () => {
		const user = userEvent.setup();
		renderTagsInput({ defaultValue: ['kickflip'] });

		await user.dblClick(itemFor('kickflip'));

		expect(queryBySlot('tags-input-item-edit')).toBeNull();
	});

	it('suppresses selection, editing and deletion for a per-item-disabled tag only', async () => {
		const user = userEvent.setup();
		renderTagsInput({
			defaultValue: ['kickflip', 'heelflip'],
			editable: true,
			disabledValues: ['kickflip']
		});

		await user.dblClick(itemFor('kickflip'));
		expect(queryBySlot('tags-input-item-edit')).toBeNull();
		expect(itemFor('kickflip')).not.toHaveAttribute('data-highlighted');

		await user.click(deleteFor('kickflip'));
		expect(renderedTags()).toEqual(['kickflip', 'heelflip']);

		await user.dblClick(itemFor('heelflip'));
		expect(bySlot('tags-input-item-edit')).toHaveValue('heelflip');
	});

	it('keeps displayValue render-only when an edit is committed (D-3)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderTagsInput({
			defaultValue: ['kickflip'],
			editable: true,
			displayValue: (value: string) => value.toUpperCase(),
			onValueChange
		});

		expect(renderedTags()).toEqual(['KICKFLIP']);

		await user.dblClick(itemFor('kickflip'));
		const field = bySlot('tags-input-item-edit');
		expect(field).toHaveValue('KICKFLIP');

		await user.clear(field);
		await user.type(field, 'heelflip{Enter}');

		expect(onValueChange).toHaveBeenLastCalledWith(['heelflip']);
		expect(renderedTags()).toEqual(['HEELFLIP']);

		// The stored value is the raw `heelflip`, so the display string is not a duplicate of it.
		await user.type(textInput(), 'HEELFLIP{Enter}');
		expect(onValueChange).toHaveBeenLastCalledWith(['heelflip', 'HEELFLIP']);
	});
});

// ---------------------------------------------------------------------------
// T013 — the throwing providers
// ---------------------------------------------------------------------------

describe('TagsInput providers (T013)', () => {
	it.each([
		['bare-label', /<TagsInput\.Label>.+<TagsInput\.Root>/],
		['bare-input', /<TagsInput\.Input>.+<TagsInput\.Root>/],
		['bare-item', /<TagsInput\.Item>.+<TagsInput\.Root>/],
		['bare-clear', /<TagsInput\.Clear>.+<TagsInput\.Root>/]
	] as const)('throws when %s is rendered without a root', (mode, message) => {
		expect(() => renderTagsInput({ mode })).toThrow(/within/);
		expect(() => renderTagsInput({ mode })).toThrow(message);
	});

	it.each([
		['bare-item-text', /<TagsInput\.ItemText>.+<TagsInput\.Item>/],
		['bare-item-delete', /<TagsInput\.ItemDelete>.+<TagsInput\.Item>/],
		['item-text-without-item', /<TagsInput\.ItemText>.+<TagsInput\.Item>/],
		['item-delete-without-item', /<TagsInput\.ItemDelete>.+<TagsInput\.Item>/]
	] as const)('throws when %s is rendered without an item', (mode, message) => {
		expect(() => renderTagsInput({ mode })).toThrow(/within/);
		expect(() => renderTagsInput({ mode })).toThrow(message);
	});
});

// ---------------------------------------------------------------------------
// T014 — form integration
// ---------------------------------------------------------------------------

describe('TagsInput form integration (T014)', () => {
	function formInput(): HTMLInputElement {
		return bySlot('tags-input-form-input') as HTMLInputElement;
	}

	it('carries the comma-joined tag list into the form data', async () => {
		const user = userEvent.setup();
		renderTagsInput({ withForm: true, name: 'tags', defaultValue: ['kickflip', 'heelflip'] });

		const form = screen.getByTestId('form') as HTMLFormElement;
		expect(formInput()).toHaveValue('kickflip,heelflip');
		expect(new FormData(form).get('tags')).toBe('kickflip,heelflip');

		await user.type(textInput(), 'fs-540{Enter}');

		expect(new FormData(form).get('tags')).toBe('kickflip,heelflip,fs-540');
	});

	it('dispatches a bubbling input event on every change', async () => {
		const user = userEvent.setup();
		renderTagsInput({ withForm: true, name: 'tags', defaultValue: [] });

		const onInput = vi.fn();
		formInput().addEventListener('input', onInput);

		await user.type(textInput(), 'kickflip{Enter}');

		expect(onInput).toHaveBeenCalledTimes(1);
		expect(formInput()).toHaveValue('kickflip');
	});

	it('blocks submission while a required tags input is empty', async () => {
		const user = userEvent.setup();
		renderTagsInput({ withForm: true, name: 'tags', required: true, defaultValue: [] });

		const form = screen.getByTestId('form') as HTMLFormElement;
		expect(formInput()).toBeRequired();
		expect(form.reportValidity()).toBe(false);

		await user.type(textInput(), 'kickflip{Enter}');

		expect(form.reportValidity()).toBe(true);
	});

	it('blocks submission for a required tags input with no name (D-7)', () => {
		renderTagsInput({ withForm: true, required: true, defaultValue: [] });

		const form = screen.getByTestId('form') as HTMLFormElement;
		// A form ancestor is the only condition — without the control there would be nothing for
		// constraint validation to fail on.
		expect(formInput()).toBeRequired();
		expect(formInput()).not.toHaveAttribute('name');
		expect(form.reportValidity()).toBe(false);
	});

	it('reflects disabled onto the hidden input', () => {
		renderTagsInput({ withForm: true, name: 'tags', disabled: true, defaultValue: ['kickflip'] });

		expect(formInput()).toBeDisabled();
	});

	it('renders no hidden input outside a form', () => {
		renderTagsInput({ name: 'tags', defaultValue: ['kickflip'] });

		expect(queryBySlot('tags-input-form-input')).toBeNull();
	});
});
