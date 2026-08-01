import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import Harness, {
	MENTION_OPTIONS,
	MENTION_PLACEHOLDER,
	type MentionHarnessOption,
	type MentionHarnessProps
} from './mention.test.svelte';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Width jsdom pretends every character has, so the caret hit tests have something to divide by. */
const CHAR_WIDTH = 8;

let restoreOffsetWidth: (() => void) | undefined;

beforeAll(() => {
	// jsdom performs no layout, so the off-screen measuring `<span>` reports `offsetWidth === 0` and
	// every caret hit test degenerates. A fixed per-character width is the smallest stand-in that
	// keeps `mention-caret.ts`'s arithmetic exercisable.
	const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
	Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
		configurable: true,
		get(this: HTMLElement) {
			return (this.textContent ?? '').length * CHAR_WIDTH;
		}
	});
	restoreOffsetWidth = () => {
		if (original) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', original);
		else Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth');
	};
});

afterAll(() => {
	restoreOffsetWidth?.();
});

afterEach(() => {
	// `bits-ui` restores the body styles its scroll lock sets on a later tick than `cleanup()`, so
	// reset them here rather than let one modal test make the next test's clicks impossible.
	document.body.style.pointerEvents = '';
	document.body.style.overflow = '';
});

function renderMention(props: MentionHarnessProps = {}) {
	return render(Harness, { props });
}

function queryBySlot(slot: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
}

function bySlot(slot: string): HTMLElement {
	const element = queryBySlot(slot);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function allBySlot(slot: string): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`));
}

function textField(): HTMLInputElement | HTMLTextAreaElement {
	return screen.getByPlaceholderText(MENTION_PLACEHOLDER) as HTMLInputElement | HTMLTextAreaElement;
}

/**
 * The popup lives in a portal and, in jsdom, inside a wrapper the floating layer reports as hidden,
 * so it is always located through `data-slot` — which is also how a consumer styles it. Roles are
 * still asserted, with `toHaveAttribute`, on the elements found this way.
 */
function itemElements(): HTMLElement[] {
	return allBySlot('mention-item');
}

function itemLabels(): string[] {
	return itemElements().map((element) => element.textContent?.trim() ?? '');
}

function highlightedItem(): HTMLElement | null {
	return document.querySelector<HTMLElement>('[data-slot="mention-item"][data-highlighted]');
}

function highlightedLabel(): string | null {
	return highlightedItem()?.textContent?.trim() ?? null;
}

function tagSegments(): string[] {
	return Array.from(document.querySelectorAll<HTMLElement>('[data-tag]')).map(
		(element) => element.textContent ?? ''
	);
}

async function waitForContent(): Promise<HTMLElement> {
	await waitFor(() => expect(queryBySlot('mention-content')).not.toBeNull());
	return bySlot('mention-content');
}

async function waitForClosed(): Promise<void> {
	await waitFor(() => expect(queryBySlot('mention-content')).toBeNull());
}

/** Focus the field and type `text`, then wait for the popup and its initial highlight. */
async function openWith(
	user: ReturnType<typeof userEvent.setup>,
	text: string
): Promise<HTMLElement> {
	const field = textField();
	field.focus();
	await user.keyboard(text);
	const content = await waitForContent();
	await waitFor(() => expect(highlightedItem()).not.toBeNull());
	return content;
}

const DISABLED_MIDDLE: MentionHarnessOption[] = [
	{ value: 'kickflip', text: 'Kickflip' },
	{ value: 'kickturn', text: 'Kickturn', disabled: true },
	{ value: 'heelflip', text: 'Heelflip' }
];

const ALL_DISABLED: MentionHarnessOption[] = [
	{ value: 'kickflip', text: 'Kickflip', disabled: true },
	{ value: 'heelflip', text: 'Heelflip', disabled: true }
];

// ---------------------------------------------------------------------------
// T007 — roles, ARIA and the highlighter overlay
// ---------------------------------------------------------------------------

describe('Mention accessibility (T007)', () => {
	it('renders the label and the field, and associates them both ways', () => {
		renderMention();

		const field = textField();
		const label = screen.getByText('Mention users');

		expect(label).toHaveAttribute('for', field.id);
		expect(field).toHaveAttribute('aria-labelledby', label.id);
		expect(field).toHaveAttribute('data-slot', 'mention-input');
	});

	it('exposes the documented combobox wiring while closed', () => {
		renderMention();

		const field = textField();
		expect(field).toHaveAttribute('role', 'combobox');
		expect(field).toHaveAttribute('aria-autocomplete', 'list');
		expect(field).toHaveAttribute('aria-expanded', 'false');
		expect(field).toHaveAttribute('autocomplete', 'off');
		expect(field).toHaveAttribute('aria-disabled', 'false');
		expect(field).toHaveAttribute('aria-readonly', 'false');
		expect(field).toHaveAttribute('data-state', 'closed');
		expect(queryBySlot('mention-content')).toBeNull();
	});

	it('wires aria-controls, the listbox role and aria-activedescendant once open', async () => {
		const user = userEvent.setup();
		renderMention();

		const content = await openWith(user, '@');
		const field = textField();

		expect(field).toHaveAttribute('aria-expanded', 'true');
		expect(field.getAttribute('aria-controls')).toBe(content.id);
		expect(content).toHaveAttribute('role', 'listbox');
		expect(content).toHaveAttribute('aria-orientation', 'vertical');

		const options = itemElements();
		expect(options).toHaveLength(MENTION_OPTIONS.length);
		for (const option of options) {
			expect(option).toHaveAttribute('role', 'option');
			expect(option).toHaveAttribute('aria-selected', 'false');
		}

		expect(field.getAttribute('aria-activedescendant')).toBe(highlightedItem()?.id);
	});

	it('reflects the selection on the chosen option', async () => {
		const user = userEvent.setup();
		renderMention();

		await openWith(user, '@');
		await user.keyboard('{Enter}');
		await waitForClosed();

		await openWith(user, ' @');
		const kickflip = screen.getByTestId('item-kickflip');
		expect(kickflip).toHaveAttribute('aria-selected', 'true');
		expect(kickflip).toHaveAttribute('data-selected', '');
		expect(kickflip).toHaveAttribute('data-value', 'kickflip');
	});

	it('reports the resolved placement and the documented CSS variables on the popup', async () => {
		const user = userEvent.setup();
		renderMention();

		const content = await openWith(user, '@');

		expect(content).toHaveAttribute('data-side');
		expect(content).toHaveAttribute('data-align');
		expect(content).toHaveAttribute('data-state', 'open');

		const style = content.getAttribute('style') ?? '';
		expect(style).toContain('--dice-transform-origin');
		expect(style).toContain('--dice-available-width');
		expect(style).toContain('--dice-available-height');
	});

	it('renders one data-tag segment per mention, and updates it on insert and on removal', async () => {
		const user = userEvent.setup();
		renderMention();

		await waitFor(() => expect(queryBySlot('mention-highlighter')).not.toBeNull());
		expect(tagSegments()).toEqual([]);

		await openWith(user, '@');
		await user.keyboard('{Enter}');
		await waitForClosed();

		await waitFor(() => expect(tagSegments()).toEqual(['@kickflip']));

		const field = textField();
		field.setSelectionRange(9, 9);
		await user.keyboard('{Backspace}');

		await waitFor(() => expect(tagSegments()).toEqual([]));
	});
});

// ---------------------------------------------------------------------------
// T006 — trigger detection, filtering and the whole keyboard contract
// ---------------------------------------------------------------------------

describe('Mention trigger detection (T006)', () => {
	it('opens on the trigger typed at the start of the field', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderMention({ onOpenChange });

		await openWith(user, '@');

		expect(onOpenChange).toHaveBeenCalledWith(true);
		expect(itemLabels()).toEqual(['Kickflip', 'Heelflip', 'FS 540']);
	});

	it('opens on the trigger typed after a space and after a newline', async () => {
		const user = userEvent.setup();
		renderMention();

		await openWith(user, 'hello @');
		expect(textField()).toHaveValue('hello @');

		await user.keyboard('{Escape}');
		await waitForClosed();

		await user.keyboard(' world @');
		await waitForContent();
		expect(textField()).toHaveValue('hello @ world @');
	});

	it('does not open on a trigger typed mid-word', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderMention({ onOpenChange });

		const field = textField();
		field.focus();
		await user.keyboard('foo@bar.com');
		await tick();

		expect(queryBySlot('mention-content')).toBeNull();
		expect(onOpenChange).not.toHaveBeenCalledWith(true);
	});

	it('does not open when non-separator text follows the caret', async () => {
		const user = userEvent.setup();
		renderMention();

		const field = textField();
		field.focus();
		await user.keyboard('end');
		field.setSelectionRange(0, 0);
		await user.keyboard('@');
		await tick();

		expect(field).toHaveValue('@end');
		expect(queryBySlot('mention-content')).toBeNull();
	});

	it('narrows the visible items as the search grows, and closes on a space', async () => {
		const user = userEvent.setup();
		renderMention();

		await openWith(user, '@');
		await user.keyboard('kck');
		await waitFor(() => expect(itemLabels()).toEqual(['Kickflip']));

		await user.keyboard(' ');
		await waitForClosed();
	});

	it('auto-highlights the first enabled visible item when it opens', async () => {
		const user = userEvent.setup();
		renderMention({ options: DISABLED_MIDDLE });

		await openWith(user, '@');
		expect(highlightedLabel()).toBe('Kickflip');
	});

	it('ignores a request to open while a non-empty search matches nothing (FR-013a)', async () => {
		const user = userEvent.setup();
		renderMention();

		await openWith(user, '@');
		await user.keyboard('zzz');
		await waitForClosed();
		expect(highlightedItem()).toBeNull();

		// The popup must stay shut while the search keeps matching nothing.
		await user.keyboard('q');
		await tick();
		expect(queryBySlot('mention-content')).toBeNull();
	});

	it('moves the highlight one item at a time and stops at the boundary', async () => {
		const user = userEvent.setup();
		renderMention();

		await openWith(user, '@');
		expect(highlightedLabel()).toBe('Kickflip');

		await user.keyboard('{ArrowDown}');
		expect(highlightedLabel()).toBe('Heelflip');

		await user.keyboard('{ArrowDown}{ArrowDown}');
		expect(highlightedLabel()).toBe('FS 540');

		await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
		expect(highlightedLabel()).toBe('Kickflip');
	});

	it('wraps at the boundary when loop is set', async () => {
		const user = userEvent.setup();
		renderMention({ loop: true });

		await openWith(user, '@');
		await user.keyboard('{ArrowUp}');
		expect(highlightedLabel()).toBe('FS 540');

		await user.keyboard('{ArrowDown}');
		expect(highlightedLabel()).toBe('Kickflip');
	});

	it('skips a disabled item in both directions and never highlights it', async () => {
		const user = userEvent.setup();
		renderMention({ options: DISABLED_MIDDLE });

		await openWith(user, '@');
		expect(screen.getByTestId('item-kickturn')).toHaveAttribute('data-disabled', '');

		await user.keyboard('{ArrowDown}');
		expect(highlightedLabel()).toBe('Heelflip');

		await user.keyboard('{ArrowUp}');
		expect(highlightedLabel()).toBe('Kickflip');
	});

	it('jumps to the first and last item with Home and End, but lets Ctrl/Cmd move the caret', async () => {
		const user = userEvent.setup();
		renderMention();

		await openWith(user, '@');

		await user.keyboard('{End}');
		expect(highlightedLabel()).toBe('FS 540');

		await user.keyboard('{Home}');
		expect(highlightedLabel()).toBe('Kickflip');

		await user.keyboard('{End}');
		expect(highlightedLabel()).toBe('FS 540');

		// Ctrl/Cmd + Home is native caret movement; the highlight must not follow it.
		await user.keyboard('{Control>}{Home}{/Control}');
		expect(highlightedLabel()).toBe('FS 540');
	});

	it('selects the highlighted item on Enter and splices at the trigger offset', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onInputValueChange = vi.fn();
		renderMention({ onValueChange, onInputValueChange });

		await openWith(user, '@');
		await user.keyboard('{ArrowDown}{Enter}');

		const field = textField();
		await waitFor(() => expect(field).toHaveValue('@heelflip '));
		expect(onValueChange).toHaveBeenLastCalledWith(['heelflip']);
		expect(onInputValueChange).toHaveBeenLastCalledWith('@heelflip ');
		expect(field.selectionStart).toBe(10);
	});

	it('leaves the text before the trigger and after the caret byte-for-byte intact (SC-005)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderMention({ onValueChange });

		const field = textField();
		field.focus();
		await user.keyboard('hello @kic end');
		await waitForClosed();

		// Type the missing "k" back inside the query, so " end" is still ahead of the caret.
		field.setSelectionRange(10, 10);
		await user.keyboard('k');
		await waitForContent();
		await waitFor(() => expect(highlightedItem()).not.toBeNull());
		expect(field).toHaveValue('hello @kick end');

		await user.keyboard('{Enter}');

		await waitFor(() => expect(field).toHaveValue('hello @kickflip  end'));
		expect(onValueChange).toHaveBeenLastCalledWith(['kickflip']);
	});

	it('supports a trigger in the middle of text and preserves the text between mentions', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderMention({ onValueChange });

		const field = textField();
		field.focus();

		await user.keyboard('@kickflip');
		await waitForContent();
		await waitFor(() => expect(highlightedItem()).not.toBeNull());
		await user.keyboard('{Enter}');
		await waitForClosed();

		await user.keyboard(' and then @heelflip');
		await waitForContent();
		await waitFor(() => expect(highlightedItem()).not.toBeNull());
		await user.keyboard('{Enter}');
		await waitForClosed();

		expect(field).toHaveValue('@kickflip  and then @heelflip ');
		expect(onValueChange).toHaveBeenLastCalledWith(['kickflip', 'heelflip']);
	});

	it('closes on Enter without consuming the key when nothing is highlighted (FR-013a)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderMention({ options: ALL_DISABLED, defaultOpen: true, onValueChange });

		await waitForContent();
		const field = textField();
		field.focus();
		expect(highlightedItem()).toBeNull();

		const seen: KeyboardEvent[] = [];
		const listener = (event: Event) => seen.push(event as KeyboardEvent);
		document.addEventListener('keydown', listener);
		await user.keyboard('{Enter}');
		document.removeEventListener('keydown', listener);

		await waitForClosed();
		expect(seen.at(-1)?.defaultPrevented).toBe(false);
		expect(onValueChange).not.toHaveBeenCalled();
		expect(field).toHaveValue('');
	});

	it('consumes ArrowDown while the popup is open', async () => {
		const user = userEvent.setup();
		renderMention();

		await openWith(user, '@');

		const seen: KeyboardEvent[] = [];
		const listener = (event: Event) => seen.push(event as KeyboardEvent);
		document.addEventListener('keydown', listener);
		await user.keyboard('{ArrowDown}');
		document.removeEventListener('keydown', listener);

		expect(seen.at(-1)?.defaultPrevented).toBe(true);
	});

	it('closes on Tab and lets focus move, while modal makes Tab select instead', async () => {
		const user = userEvent.setup();
		const { unmount } = renderMention();

		await openWith(user, '@');
		await user.keyboard('{Tab}');
		await waitForClosed();
		expect(textField()).toHaveValue('@');

		unmount();

		const onValueChange = vi.fn();
		renderMention({ modal: true, onValueChange });
		await openWith(user, '@');
		await user.keyboard('{Tab}');

		await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith(['kickflip']));
		expect(textField()).toHaveValue('@kickflip ');
	});

	it('closes on Escape without changing the value or moving focus', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderMention({ onValueChange });

		await openWith(user, '@kick');
		const field = textField();

		await user.keyboard('{Escape}');
		await waitForClosed();

		expect(field).toHaveValue('@kick');
		expect(onValueChange).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(field);
	});
});

// ---------------------------------------------------------------------------
// T006 — mentions behave as atomic units of text
// ---------------------------------------------------------------------------

describe('Mention atomic editing (T006)', () => {
	/** Insert `@kickflip ` and hand back the field. */
	async function withOneMention(
		user: ReturnType<typeof userEvent.setup>
	): Promise<HTMLInputElement | HTMLTextAreaElement> {
		const field = textField();
		field.focus();
		await user.keyboard('@kickflip');
		await waitForContent();
		await waitFor(() => expect(highlightedItem()).not.toBeNull());
		await user.keyboard('{Enter}');
		await waitForClosed();
		return field;
	}

	it('removes a whole mention with one Backspace at its end', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onInputValueChange = vi.fn();
		renderMention({ onValueChange, onInputValueChange });

		const field = await withOneMention(user);
		field.setSelectionRange(9, 9);
		await user.keyboard('{Backspace}');

		expect(field).toHaveValue('');
		expect(onValueChange).toHaveBeenLastCalledWith([]);
		expect(onInputValueChange).toHaveBeenLastCalledWith('');
	});

	it('removes only the trailing space on a plain Backspace behind it (FR-023a)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderMention({ onValueChange });

		const field = await withOneMention(user);
		onValueChange.mockClear();

		field.setSelectionRange(10, 10);
		await user.keyboard('{Backspace}');

		expect(field).toHaveValue('@kickflip');
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('removes the nearest preceding mention across whitespace with Ctrl/Cmd + Backspace (FR-023b)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onInputValueChange = vi.fn();
		renderMention({ onValueChange, onInputValueChange });

		const field = await withOneMention(user);
		await user.keyboard('some text');
		expect(field).toHaveValue('@kickflip some text');

		// One space past the mention: a plain Backspace would take only the space, while Ctrl/Cmd
		// skips that step and takes the whole mention.
		field.setSelectionRange(10, 10);
		await user.keyboard('{Control>}{Backspace}{/Control}');

		expect(field).toHaveValue('some text');
		expect(onValueChange).toHaveBeenLastCalledWith([]);
		expect(onInputValueChange).toHaveBeenLastCalledWith('some text');
	});

	it('removes a mention in the middle of the text and re-bases the ones after it', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onInputValueChange = vi.fn();
		renderMention({ onValueChange, onInputValueChange });

		const field = await withOneMention(user);
		await user.keyboard('and @heelflip');
		await waitForContent();
		await waitFor(() => expect(highlightedItem()).not.toBeNull());
		await user.keyboard('{Enter}');
		await waitForClosed();

		expect(field).toHaveValue('@kickflip and @heelflip ');

		field.setSelectionRange(9, 9);
		await user.keyboard('{Control>}{Backspace}{/Control}');

		expect(field).toHaveValue('and @heelflip ');
		expect(onValueChange).toHaveBeenLastCalledWith(['heelflip']);
		expect(onInputValueChange).toHaveBeenLastCalledWith('and @heelflip ');
		await waitFor(() => expect(tagSegments()).toEqual(['@heelflip']));
	});

	it('removes a whole mention with one Backspace from inside its text (SC-006)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onInputValueChange = vi.fn();
		renderMention({ onValueChange, onInputValueChange });

		const field = await withOneMention(user);
		await user.keyboard('rest');
		expect(field).toHaveValue('@kickflip rest');
		onValueChange.mockClear();

		// Inside `@kickflip`, between the `k` and the `i`.
		field.setSelectionRange(5, 5);
		await user.keyboard('{Backspace}');

		expect(field).toHaveValue('rest');
		expect(onValueChange).toHaveBeenLastCalledWith([]);
		expect(onInputValueChange).toHaveBeenLastCalledWith('rest');
		await waitFor(() => expect(tagSegments()).toEqual([]));
	});

	it('removes a whole mention with one Delete from the caret in front of it (FR-023c)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onInputValueChange = vi.fn();
		renderMention({ onValueChange, onInputValueChange });

		const field = await withOneMention(user);
		await user.keyboard('rest');
		expect(field).toHaveValue('@kickflip rest');
		onValueChange.mockClear();

		// Caret-adjacent: immediately before the trigger character.
		field.setSelectionRange(0, 0);
		await user.keyboard('{Delete}');

		expect(field).toHaveValue('rest');
		expect(onValueChange).toHaveBeenLastCalledWith([]);
		expect(onInputValueChange).toHaveBeenLastCalledWith('rest');
		await waitFor(() => expect(tagSegments()).toEqual([]));
	});

	it('removes a whole mention with one Delete from inside its text (FR-023c)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderMention({ onValueChange });

		const field = await withOneMention(user);
		await user.keyboard('and @heelflip');
		await waitForContent();
		await waitFor(() => expect(highlightedItem()).not.toBeNull());
		await user.keyboard('{Enter}');
		await waitForClosed();
		expect(field).toHaveValue('@kickflip and @heelflip ');
		onValueChange.mockClear();

		// Caret-inside: between the `k` and the `i` of the first mention.
		field.setSelectionRange(5, 5);
		await user.keyboard('{Delete}');

		expect(field).toHaveValue('and @heelflip ');
		expect(onValueChange).toHaveBeenLastCalledWith(['heelflip']);
		// The survivor is re-based, so a second Delete in front of it takes the whole mention too.
		field.setSelectionRange(4, 4);
		await user.keyboard('{Delete}');

		expect(field).toHaveValue('and ');
		expect(onValueChange).toHaveBeenLastCalledWith([]);
	});

	it('removes every mention a selection overlaps, in one Delete', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderMention({ onValueChange });

		const field = await withOneMention(user);
		await user.keyboard('and @heelflip');
		await waitForContent();
		await waitFor(() => expect(highlightedItem()).not.toBeNull());
		await user.keyboard('{Enter}');
		await waitForClosed();

		field.setSelectionRange(0, 24);
		await user.keyboard('{Delete}');

		expect(field).toHaveValue('');
		expect(onValueChange).toHaveBeenLastCalledWith([]);
	});

	it('jumps over an adjacent mention with the arrow keys, and to its exact edge with Ctrl/Cmd', async () => {
		const user = userEvent.setup();
		renderMention();

		const field = await withOneMention(user);
		expect(field).toHaveValue('@kickflip ');

		// Caret at the mention's end: ArrowLeft steps over the whole mention in one move.
		field.setSelectionRange(9, 9);
		await user.keyboard('{ArrowLeft}');
		expect(field.selectionStart).toBe(0);

		// From the start, ArrowRight steps back over it.
		await user.keyboard('{ArrowRight}');
		expect(field.selectionStart).toBe(9);

		// Ctrl/Cmd jumps to the exact boundary rather than one position at a time.
		field.setSelectionRange(10, 10);
		await user.keyboard('{Control>}{ArrowLeft}{/Control}');
		expect(field.selectionStart).toBe(0);
	});

	it('drops a mention that a cut removes', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderMention({ onValueChange });

		const field = await withOneMention(user);
		onValueChange.mockClear();

		field.setSelectionRange(0, 10);
		await user.cut();

		await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith([]));
	});

	it('rebuilds mentions from pasted text and leaves the rest of it verbatim', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderMention({ onValueChange });

		const field = textField();
		field.focus();
		await user.paste('hey @kickflip and @heelflip');

		await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith(['kickflip', 'heelflip']));
		expect(field).toHaveValue('hey @kickflip and @heelflip');
		await waitFor(() => expect(tagSegments()).toEqual(['@kickflip', '@heelflip']));
		await waitForClosed();
	});

	it('keeps a pasted trigger that matches no item as plain text', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderMention({ onValueChange });

		const field = textField();
		field.focus();
		await user.paste('hey @nobody');

		await waitFor(() => expect(field).toHaveValue('hey @nobody'));
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('drops a mention a plain paste overwrites (FR-026)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onInputValueChange = vi.fn();
		renderMention({ onValueChange, onInputValueChange });

		const field = await withOneMention(user);
		await user.keyboard('rest');
		expect(field).toHaveValue('@kickflip rest');
		onValueChange.mockClear();

		// The pasted text carries no trigger, so nothing is rebuilt — the overwritten mention still
		// has to leave the value list with its text.
		field.setSelectionRange(0, 10);
		await user.paste('hey ');

		await waitFor(() => expect(field).toHaveValue('hey rest'));
		expect(onValueChange).toHaveBeenLastCalledWith([]);
		expect(onInputValueChange).toHaveBeenLastCalledWith('hey rest');
		await waitFor(() => expect(tagSegments()).toEqual([]));
	});

	it('swaps a mention out for a pasted one and re-bases the survivors (FR-026)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderMention({ onValueChange });

		const field = await withOneMention(user);
		await user.keyboard('and @heelflip');
		await waitForContent();
		await waitFor(() => expect(highlightedItem()).not.toBeNull());
		await user.keyboard('{Enter}');
		await waitForClosed();
		expect(field).toHaveValue('@kickflip and @heelflip ');
		onValueChange.mockClear();

		// Overwrite the first mention with a paste that inserts a different one.
		field.setSelectionRange(0, 10);
		await user.paste('@fs-540 ');

		await waitFor(() => expect(field).toHaveValue('@fs-540 and @heelflip '));
		expect(onValueChange).toHaveBeenLastCalledWith(['heelflip', 'fs-540']);
		await waitFor(() => expect(tagSegments()).toEqual(['@fs-540', '@heelflip']));
		await waitForClosed();

		// The survivor moved with the text: one Backspace at its new end still takes all of it.
		field.setSelectionRange(21, 21);
		await user.keyboard('{Backspace}');

		expect(field).toHaveValue('@fs-540 and ');
		expect(onValueChange).toHaveBeenLastCalledWith(['fs-540']);
	});

	it('snaps the caret to a mention end when the pointer lands inside it (FR-022a)', async () => {
		const user = userEvent.setup();
		renderMention();

		const field = await withOneMention(user);
		field.setSelectionRange(10, 10);

		await user.pointer({
			target: field,
			keys: '[MouseLeft]',
			coords: { clientX: 3 * CHAR_WIDTH, clientY: 0 }
		});
		await tick();

		expect(field.selectionStart).toBe(9);
	});
});

// ---------------------------------------------------------------------------
// T008 — controlled and uncontrolled
// ---------------------------------------------------------------------------

describe('Mention controlled and uncontrolled state (T008)', () => {
	it('seeds from defaultValue and moves on its own while uncontrolled', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderMention({ defaultValue: ['fs-540'], onValueChange });

		await openWith(user, '@');
		expect(screen.getByTestId('item-fs-540')).toHaveAttribute('aria-selected', 'true');

		await user.keyboard('{Enter}');
		await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith(['fs-540', 'kickflip']));
	});

	it('seeds the open state from defaultOpen and reports every transition', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderMention({ defaultOpen: true, onOpenChange });

		await waitForContent();

		const field = textField();
		field.focus();
		await user.keyboard('{Escape}');
		await waitForClosed();

		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});

	it('lets a bound parent drive the value, the open state and the text', async () => {
		const user = userEvent.setup();
		const onInputValueChange = vi.fn();
		renderMention({ binding: 'value', onInputValueChange });

		await openWith(user, '@');
		expect(screen.getByTestId('bound-open')).toHaveTextContent('open');

		await user.keyboard('{Enter}');
		await waitForClosed();

		// The harness renders its own state back out, so these assert `bind:` wrote *through* the
		// component rather than merely that a callback fired.
		await waitFor(() => expect(screen.getByTestId('bound-value')).toHaveTextContent('kickflip'));
		expect(screen.getByTestId('bound-input-value')).toHaveTextContent('@kickflip');
		expect(screen.getByTestId('bound-open')).toHaveTextContent('closed');
		expect(onInputValueChange).toHaveBeenLastCalledWith('@kickflip ');
	});

	it('leaves the rendered state where it was when a function binding declines the write', async () => {
		const user = userEvent.setup();
		const onDeclinedValue = vi.fn();
		renderMention({ binding: 'function', authoritative: [], onDeclinedValue });

		await openWith(user, '@');
		await user.keyboard('{Enter}');
		await waitForClosed();

		expect(onDeclinedValue).toHaveBeenLastCalledWith(['kickflip']);
		expect(screen.getByTestId('bound-value')).toHaveTextContent('');

		// The parent refused, so nothing in the component's own view of the value moved.
		await openWith(user, ' @');
		expect(screen.getByTestId('item-kickflip')).toHaveAttribute('aria-selected', 'false');
	});
});

// ---------------------------------------------------------------------------
// T009 — RTL
// ---------------------------------------------------------------------------

describe('Mention RTL (T009)', () => {
	it('mirrors the field, the popup and its alignment under dir="rtl"', async () => {
		const user = userEvent.setup();
		const { unmount } = renderMention();

		const ltrContent = await openWith(user, '@');
		const ltrAlign = ltrContent.getAttribute('data-align');
		expect(ltrAlign).toBe('start');
		unmount();

		renderMention({ dir: 'rtl' });
		const rtlContent = await openWith(user, '@');

		expect(textField()).toHaveAttribute('dir', 'rtl');
		expect(rtlContent).toHaveAttribute('dir', 'rtl');
		expect(rtlContent.getAttribute('data-align')).toBe('end');
	});

	it('takes the same direction from a DirectionProvider with no explicit dir prop', async () => {
		const user = userEvent.setup();
		renderMention({ providerDir: 'rtl' });

		const content = await openWith(user, '@');

		expect(textField()).toHaveAttribute('dir', 'rtl');
		expect(content).toHaveAttribute('dir', 'rtl');
		expect(content.getAttribute('data-align')).toBe('end');
	});
});

// ---------------------------------------------------------------------------
// T010 — filtering, guard rails and the surrounding edges
// ---------------------------------------------------------------------------

describe('Mention filtering (T010)', () => {
	it('fuzzy-matches by default', async () => {
		const user = userEvent.setup();
		renderMention();

		await openWith(user, '@');
		await user.keyboard('kck');
		await waitFor(() => expect(itemLabels()).toEqual(['Kickflip']));
	});

	it('does substring matching, case-insensitively, with exactMatch', async () => {
		const user = userEvent.setup();
		renderMention({ exactMatch: true });

		await openWith(user, '@');
		await user.keyboard('EEL');
		await waitFor(() => expect(itemLabels()).toEqual(['Heelflip']));
	});

	it('replaces the built-in matcher with onFilter, and ignores exactMatch alongside it', async () => {
		const user = userEvent.setup();
		const onFilter = vi.fn((options: string[], term: string) =>
			options.filter((option) => option.toLowerCase().startsWith(term.toLowerCase()))
		);
		renderMention({ onFilter, exactMatch: true });

		await openWith(user, '@');
		await user.keyboard('HEEL');

		await waitFor(() => expect(itemLabels()).toEqual(['Heelflip']));
		expect(onFilter).toHaveBeenCalled();

		// `exactMatch`'s substring rule would have kept "heelflip" for a mid-string term; the
		// starts-with callback does not.
		await user.keyboard('{Backspace>4/}flip');
		await waitForClosed();
	});

	it('closes and clears the highlight once the filter matches nothing', async () => {
		const user = userEvent.setup();
		renderMention();

		await openWith(user, '@');
		expect(highlightedItem()).not.toBeNull();

		await user.keyboard('zzzz');
		await waitForClosed();
		expect(highlightedItem()).toBeNull();
	});

	it('opens on a custom trigger character and not on the default one', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		renderMention({ trigger: '#', onOpenChange });

		const field = textField();
		field.focus();
		await user.keyboard('@');
		await tick();

		expect(queryBySlot('mention-content')).toBeNull();
		expect(onOpenChange).not.toHaveBeenCalledWith(true);

		await user.keyboard('{Backspace}#');
		await waitForContent();
		expect(onOpenChange).toHaveBeenCalledWith(true);
	});
});

describe('Mention guard rails (T010)', () => {
	it('suppresses every interaction while disabled', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderMention({ disabled: true, onValueChange });

		const field = textField();
		expect(field).toBeDisabled();
		expect(field).toHaveAttribute('aria-disabled', 'true');
		expect(bySlot('mention')).toHaveAttribute('data-disabled', '');
		expect(field).toHaveAttribute('data-disabled', '');

		field.focus();
		await user.keyboard('@kickflip');
		await tick();

		expect(field).toHaveValue('');
		expect(queryBySlot('mention-content')).toBeNull();
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('blocks value changes while readonly but still shows an open popup', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderMention({ readonly: true, defaultOpen: true, onValueChange });

		const content = await waitForContent();
		expect(content).toBeInTheDocument();

		const field = textField();
		expect(field).toHaveAttribute('readonly');
		expect(field).toHaveAttribute('aria-readonly', 'true');
		expect(field).toHaveAttribute('data-readonly', '');

		field.focus();

		// FR-028: highlight movement is inert too — by keyboard...
		expect(highlightedItem()).toBeNull();
		await user.keyboard('{ArrowDown}{ArrowUp}{Home}{End}');
		await tick();
		expect(highlightedItem()).toBeNull();

		// ...and by pointer, which must not be the one way back in.
		await user.hover(screen.getByTestId('item-heelflip'));
		await tick();
		expect(highlightedItem()).toBeNull();

		// Enter closes the popup here, so it comes last.
		await user.keyboard('@kickflip{Enter}');
		await tick();

		expect(field).toHaveValue('');
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('throws when an item is given an empty value', () => {
		expect(() => renderMention({ mode: 'empty-item-value' })).toThrow(
			/value cannot be an empty string/
		);
	});

	it.each([
		['bare-label', '<Mention.Label>'],
		['bare-input', '<Mention.Input>'],
		['bare-portal', '<Mention.Portal>'],
		['bare-content', '<Mention.Content>'],
		['bare-item', '<Mention.Item>']
	] as const)('throws when %s is used outside the root', (mode, part) => {
		expect(() => renderMention({ mode })).toThrow(
			`\`${part}\` must be used within \`<Mention.Root>\`.`
		);
	});

	it('does nothing when a disabled item is clicked or Entered', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderMention({ options: DISABLED_MIDDLE, onValueChange });

		await openWith(user, '@');
		const disabledItem = screen.getByTestId('item-kickturn');

		await user.click(disabledItem);
		await tick();

		expect(onValueChange).not.toHaveBeenCalled();
		expect(textField()).toHaveValue('@');
	});

	it('moves the highlight to an enabled item on pointer move (FR-021a)', async () => {
		const user = userEvent.setup();
		renderMention();

		await openWith(user, '@');
		expect(highlightedLabel()).toBe('Kickflip');

		await user.hover(screen.getByTestId('item-fs-540'));
		await tick();

		expect(highlightedLabel()).toBe('FS 540');
	});

	it('selects an item on click and returns focus to the field', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onInputValueChange = vi.fn();
		renderMention({ onValueChange, onInputValueChange });

		await openWith(user, '@');
		await user.click(screen.getByTestId('item-kickflip'));

		await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith(['kickflip']));
		expect(onInputValueChange).toHaveBeenLastCalledWith('@kickflip ');
		expect(textField()).toHaveValue('@kickflip ');
		expect(document.activeElement).toBe(textField());
	});

	it('locks page scrolling and outside pointer interaction only while a modal popup is open', async () => {
		const user = userEvent.setup();
		const { unmount } = renderMention({ modal: true });

		await openWith(user, '@');
		await waitFor(() => expect(document.body.style.overflow).toBe('hidden'));
		expect(document.body.style.pointerEvents).toBe('none');

		unmount();
		document.body.style.overflow = '';
		document.body.style.pointerEvents = '';

		renderMention();
		await openWith(user, '@');
		expect(document.body.style.overflow).toBe('');
		expect(document.body.style.pointerEvents).toBe('');
	});

	it('submits the value list through a hidden form control honouring disabled and required', async () => {
		const user = userEvent.setup();
		renderMention({ withForm: true, name: 'mentions', required: true });

		const formInput = bySlot('mention-form-input') as HTMLInputElement;
		expect(formInput).toHaveAttribute('name', 'mentions');
		expect(formInput).toBeRequired();
		expect(formInput).toHaveValue('');

		await openWith(user, '@');
		await user.keyboard('{Enter}');

		await waitFor(() => expect(formInput).toHaveValue('kickflip'));
	});

	it('drives a textarea rendered through the child snippet, keeping ref and every handler', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderMention({ asTextarea: true, onValueChange });

		const field = textField();
		expect(field.tagName).toBe('TEXTAREA');
		expect(field).toHaveAttribute('role', 'combobox');

		await openWith(user, 'line one\n@');
		await user.keyboard('{Enter}');

		await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith(['kickflip']));
		expect(field).toHaveValue('line one\n@kickflip ');
	});
});
