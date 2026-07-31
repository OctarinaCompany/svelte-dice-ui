import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Harness, { type EditableHarnessProps } from './editable.test.svelte';

const INITIAL = 'Initial Value';
const NEXT = 'New Value';

function renderEditable(props: EditableHarnessProps = {}) {
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

function preview(): HTMLElement {
	return screen.getByTestId('preview');
}

function textbox(): HTMLInputElement {
	return screen.getByRole('textbox');
}

/**
 * Focus, selection and the autosize measurement all happen on a scheduled animation frame
 * (research R-03), so every assertion about them polls rather than assuming one flush is enough.
 */
function waitForFocusedSelection(value: string) {
	return vi.waitFor(() => {
		const input = textbox();
		expect(input).toHaveFocus();
		expect(input.selectionStart).toBe(0);
		expect(input.selectionEnd).toBe(value.length);
	});
}

/** Replace the input's whole text, whatever the current selection is. */
async function retype(user: ReturnType<typeof userEvent.setup>, text: string) {
	// Edit mode focuses and selects on a scheduled frame. Typing before that frame lands would let
	// its `select()` land mid-word and have the next keystroke replace everything typed so far — a
	// race no real user can lose, but one a test that types instantly can.
	await vi.waitFor(() => expect(textbox()).toHaveFocus());

	const input = textbox();
	await user.clear(input);
	await user.type(input, text);
}

// ---------------------------------------------------------------------------
// T004 — roles, ARIA and the accessible attribute surface
// ---------------------------------------------------------------------------

describe('Editable roles and ARIA', () => {
	it('renders the composed parts with their documented roles, ids and slots', () => {
		renderEditable();

		const root = screen.getByTestId('root');
		expect(root).toHaveAttribute('data-slot', 'editable');
		// The root carries no state attributes of its own — state lives on the parts.
		expect(root).not.toHaveAttribute('data-disabled');
		expect(root).not.toHaveAttribute('data-editing');
		expect(root).not.toHaveAttribute('data-readonly');

		const label = screen.getByTestId('label');
		expect(label).toHaveAttribute('data-slot', 'editable-label');
		expect(label).toHaveAttribute('id', `${root.id}-label`);
		expect(label).toHaveAttribute('for', `${root.id}-input`);
		expect(label).not.toHaveAttribute('data-disabled');
		expect(label).not.toHaveAttribute('data-invalid');
		expect(label).not.toHaveAttribute('data-required');

		const area = screen.getByTestId('area');
		expect(area).toHaveAttribute('role', 'group');
		expect(area).toHaveAttribute('data-slot', 'editable-area');
		expect(area).toHaveAttribute('dir', 'ltr');
		expect(area).not.toHaveAttribute('data-disabled');
		expect(area).not.toHaveAttribute('data-editing');

		const previewElement = preview();
		expect(previewElement).toHaveAttribute('role', 'button');
		expect(previewElement).toHaveAttribute('tabindex', '0');
		expect(previewElement).toHaveAttribute('aria-disabled', 'false');
		expect(previewElement).toHaveAttribute('data-slot', 'editable-preview');
		expect(previewElement).toHaveAttribute('data-empty', '');
		expect(previewElement).not.toHaveAttribute('data-disabled');
		expect(previewElement).not.toHaveAttribute('data-readonly');

		const toolbar = screen.getByTestId('toolbar');
		expect(toolbar).toHaveAttribute('role', 'toolbar');
		expect(toolbar).toHaveAttribute('data-slot', 'editable-toolbar');
		expect(toolbar).toHaveAttribute('aria-controls', root.id);
		expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
		expect(toolbar).toHaveAttribute('data-orientation', 'horizontal');

		// Neither action button, nor the input, exists before editing starts.
		expect(screen.queryByTestId('cancel')).not.toBeInTheDocument();
		expect(screen.queryByTestId('submit')).not.toBeInTheDocument();
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
	});

	it('resolves every aria-controls onto the root element even with no id prop (D-3)', async () => {
		const user = userEvent.setup();
		renderEditable({ mode: 'with-trigger', defaultValue: INITIAL });

		const root = screen.getByTestId('root');
		expect(root.id).not.toBe('');

		await user.click(preview());
		await screen.findByRole('textbox');

		const controllers = Array.from(document.querySelectorAll('[aria-controls]'));
		expect(controllers.length).toBeGreaterThan(0);
		for (const controller of controllers) {
			const id = controller.getAttribute('aria-controls') ?? '';
			expect(document.getElementById(id)).toBe(root);
		}
	});

	it('honours an explicit id for the root, input and label ids', () => {
		renderEditable({ id: 'fruit' });

		expect(screen.getByTestId('root')).toHaveAttribute('id', 'fruit');
		expect(screen.getByTestId('label')).toHaveAttribute('id', 'fruit-label');
		expect(screen.getByTestId('label')).toHaveAttribute('for', 'fruit-input');
		expect(screen.getByTestId('toolbar')).toHaveAttribute('aria-controls', 'fruit');
	});

	it('wires the label to the input in both directions once editing starts', async () => {
		const user = userEvent.setup();
		renderEditable({ defaultValue: INITIAL });

		await user.click(preview());

		const input = textbox();
		const label = screen.getByTestId('label');
		expect(label).toHaveAttribute('for', input.id);
		expect(input).toHaveAttribute('aria-labelledby', label.id);
	});
});

// ---------------------------------------------------------------------------
// T005 — the mouse path: edit, submit, cancel (upstream #2, #3)
// ---------------------------------------------------------------------------

describe('Editable with the mouse', () => {
	it('enters edit mode on click and swaps the preview for the input', async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		const onEditingChange = vi.fn();
		renderEditable({ defaultValue: INITIAL, onEdit, onEditingChange });

		const previewElement = preview();
		expect(previewElement).toHaveTextContent(INITIAL);
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

		await user.click(previewElement);

		expect(onEdit).toHaveBeenCalledTimes(1);
		expect(onEditingChange).toHaveBeenCalledWith(true);

		const input = textbox();
		expect(input).toHaveValue(INITIAL);
		expect(previewElement).not.toBeInTheDocument();
		expect(screen.getByTestId('area')).toHaveAttribute('data-editing', '');
	});

	it('commits the typed text through the submit button', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onEditingChange = vi.fn();
		const onSubmit = vi.fn();
		renderEditable({ defaultValue: INITIAL, onValueChange, onEditingChange, onSubmit });

		await user.click(preview());
		await retype(user, NEXT);
		expect(onValueChange).toHaveBeenCalledWith(NEXT);

		await user.click(screen.getByTestId('submit'));

		expect(onSubmit).toHaveBeenCalledWith(NEXT);
		expect(onEditingChange).toHaveBeenLastCalledWith(false);
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
		expect(preview()).toHaveTextContent(NEXT);
	});

	it('commits through the submit button’s own click handler', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		renderEditable({ defaultValue: INITIAL, onSubmit });

		await user.click(preview());
		await retype(user, NEXT);
		// A real pointer press on the button blurs the input first, and blur commits on its own
		// (research R-15 exempts only the trigger and cancel). Dispatching the click alone is what
		// isolates the submit button's handler.
		await fireEvent.click(screen.getByTestId('submit'));

		expect(onSubmit).toHaveBeenCalledExactlyOnceWith(NEXT);
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
		expect(preview()).toHaveTextContent(NEXT);
	});

	it('reverts to the original value through the cancel button', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();
		const onValueChange = vi.fn();
		renderEditable({ defaultValue: INITIAL, onCancel, onValueChange });

		await user.click(preview());
		await retype(user, 'Changed Value');
		expect(onValueChange).toHaveBeenCalledWith('Changed Value');

		await user.click(screen.getByTestId('cancel'));

		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
		expect(preview()).toHaveTextContent(INITIAL);
	});
});

// ---------------------------------------------------------------------------
// T006 — uncontrolled seeds, focus and selection
// ---------------------------------------------------------------------------

describe('Editable uncontrolled', () => {
	it('seeds from defaultValue and focuses and selects the whole text on edit start', async () => {
		const user = userEvent.setup();
		renderEditable({ defaultValue: INITIAL });

		expect(preview()).toHaveTextContent(INITIAL);

		await user.click(preview());
		await waitForFocusedSelection(INITIAL);
	});

	it('seeds edit mode from defaultEditing without reporting a change', async () => {
		const user = userEvent.setup();
		const onEditingChange = vi.fn();
		const onSubmit = vi.fn();
		renderEditable({ defaultValue: INITIAL, defaultEditing: true, onEditingChange, onSubmit });

		expect(textbox()).toHaveValue(INITIAL);
		expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
		expect(onEditingChange).not.toHaveBeenCalled();

		await user.click(screen.getByTestId('submit'));

		expect(onSubmit).toHaveBeenCalledWith(INITIAL);
		expect(onEditingChange).toHaveBeenCalledWith(false);
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
		expect(preview()).toHaveTextContent(INITIAL);
	});

	it('updates its own value when nothing is bound', async () => {
		const user = userEvent.setup();
		renderEditable({ defaultValue: INITIAL });

		await user.click(preview());
		await retype(user, NEXT);
		await user.click(screen.getByTestId('submit'));

		expect(preview()).toHaveTextContent(NEXT);
	});
});

// ---------------------------------------------------------------------------
// T007 — controlled: props, write-through bindings and a declining parent
// ---------------------------------------------------------------------------

describe('Editable controlled', () => {
	// Svelte 5 lets a component assign to a `$bindable` prop that the caller passed without
	// `bind:` — the write is local and the rendered output follows it, and the caller's prop wins
	// again as soon as it actually moves. The parent therefore stays authoritative through the value
	// it feeds back in (asserted here) or, absolutely, through a function binding that declines the
	// write (asserted below) — research R-02.
	it('reports every change and follows the value the parent feeds back in', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onEditingChange = vi.fn();
		const { rerender } = renderEditable({
			binding: 'prop',
			value: INITIAL,
			onValueChange,
			onEditingChange
		});

		await user.click(preview());
		expect(onEditingChange).toHaveBeenCalledWith(true);

		await retype(user, NEXT);
		expect(onValueChange).toHaveBeenLastCalledWith(NEXT);

		await user.click(screen.getByTestId('submit'));
		expect(onEditingChange).toHaveBeenLastCalledWith(false);

		await rerender({ binding: 'prop', value: 'Parent Value' });
		expect(preview()).toHaveTextContent('Parent Value');
	});

	it('follows a write-through bind:value immediately', async () => {
		const user = userEvent.setup();
		renderEditable({ binding: 'value', value: INITIAL });

		await user.click(preview());
		await retype(user, NEXT);
		await user.click(screen.getByTestId('submit'));

		expect(preview()).toHaveTextContent(NEXT);
	});

	it('follows a write-through bind:editing immediately', async () => {
		const user = userEvent.setup();
		const onEditingChange = vi.fn();
		renderEditable({ binding: 'editing', editing: false, defaultValue: INITIAL, onEditingChange });

		await user.click(preview());
		expect(onEditingChange).toHaveBeenCalledWith(true);
		expect(textbox()).toHaveValue(INITIAL);

		await user.click(screen.getByTestId('cancel'));
		expect(onEditingChange).toHaveBeenLastCalledWith(false);
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
	});

	it('leaves the rendered value put when the parent declines the value write', async () => {
		const user = userEvent.setup();
		const onDeclinedValue = vi.fn();
		const onSubmit = vi.fn();
		renderEditable({ binding: 'function', authoritativeValue: INITIAL, onDeclinedValue, onSubmit });

		await user.click(preview());
		await retype(user, NEXT);
		expect(onDeclinedValue).toHaveBeenLastCalledWith(NEXT);

		await user.click(screen.getByTestId('submit'));

		expect(onSubmit).toHaveBeenCalledWith(NEXT);
		// The parent never applied a single write, so the field is exactly where it started.
		expect(preview()).toHaveTextContent(INITIAL);
	});

	it('keeps the typed text in the DOM while a declining parent holds the state', async () => {
		// Divergence from research R-12's second claim: the `oninput` re-pin runs only on the
		// disabled / read-only path, so a declining parent does NOT get the DOM resynced. The input
		// keeps the caret and the typed text, and only the state (and the preview) stay put.
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		// The `with-form` composition makes the state readable mid-edit: the hidden form-associated
		// input carries the root's `value`, which the preview cannot show while the input is open.
		renderEditable({
			mode: 'with-form',
			binding: 'function',
			authoritativeValue: INITIAL,
			name: 'field',
			onSubmit
		});

		await user.click(preview());
		await retype(user, NEXT);

		// DOM: what was typed. State: what the parent insists on.
		expect(textbox()).toHaveValue(NEXT);
		expect(bySlot('editable-form-input')).toHaveValue(INITIAL);

		await user.click(screen.getByTestId('submit'));

		// `<Editable.Submit>` reads `root.inputElement?.value`, so it submits the DOM text, not state.
		expect(onSubmit).toHaveBeenCalledWith(NEXT);
		expect(preview()).toHaveTextContent(INITIAL);
	});

	it('leaves edit mode put when the parent declines the editing write', async () => {
		const user = userEvent.setup();
		const onDeclinedEditing = vi.fn();
		const onEdit = vi.fn();
		renderEditable({
			binding: 'function-editing',
			authoritativeEditing: false,
			value: INITIAL,
			onDeclinedEditing,
			onEdit
		});

		await user.click(preview());

		expect(onDeclinedEditing).toHaveBeenCalledWith(true);
		expect(onEdit).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
		expect(preview()).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// T008 — the keyboard path (upstream #4, #15b)
// ---------------------------------------------------------------------------

describe('Editable with the keyboard', () => {
	it('enters edit mode on Enter from the focused preview, whatever the trigger mode', async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		renderEditable({ defaultValue: INITIAL, triggerMode: 'dblclick', onEdit });

		await user.tab();
		expect(preview()).toHaveFocus();

		await user.keyboard('{Enter}');

		expect(onEdit).toHaveBeenCalledTimes(1);
		await waitForFocusedSelection(INITIAL);
	});

	it('lets onEnterKeyDown preventDefault suppress the preview edit', async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		const onEnterKeyDown = vi.fn((event: KeyboardEvent) => event.preventDefault());
		renderEditable({ defaultValue: INITIAL, onEnterKeyDown, onEdit });

		await user.tab();
		await user.keyboard('{Enter}');

		expect(onEnterKeyDown).toHaveBeenCalledTimes(1);
		expect(onEdit).not.toHaveBeenCalled();
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
	});

	it('submits on Enter inside the input', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		renderEditable({ defaultValue: INITIAL, onSubmit });

		await user.click(preview());
		await retype(user, NEXT);
		await user.keyboard('{Enter}');

		expect(onSubmit).toHaveBeenCalledWith(NEXT);
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
		expect(preview()).toHaveTextContent(NEXT);
	});

	it('cancels on Escape, reverts the value and restores focus to the preview', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();
		const onEscapeKeyDown = vi.fn();
		renderEditable({ defaultValue: INITIAL, onCancel, onEscapeKeyDown });

		await user.click(preview());
		await retype(user, NEXT);
		await user.keyboard('{Escape}');

		expect(onEscapeKeyDown).toHaveBeenCalledTimes(1);
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
		expect(preview()).toHaveTextContent(INITIAL);
		await vi.waitFor(() => expect(preview()).toHaveFocus());
	});

	it('lets onEscapeKeyDown preventDefault suppress the cancel', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();
		const onEscapeKeyDown = vi.fn((event: KeyboardEvent) => event.preventDefault());
		renderEditable({ defaultValue: INITIAL, onCancel, onEscapeKeyDown });

		await user.click(preview());
		await retype(user, NEXT);
		await user.keyboard('{Escape}');

		expect(onEscapeKeyDown).toHaveBeenCalledTimes(1);
		expect(onCancel).not.toHaveBeenCalled();
		expect(textbox()).toHaveValue(NEXT);
	});
});

// ---------------------------------------------------------------------------
// T009 — focus restoration toward an external trigger (D-1)
// ---------------------------------------------------------------------------

describe('Editable focus restoration', () => {
	it('returns focus to the external trigger that started the edit', async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		renderEditable({ mode: 'with-trigger', defaultValue: INITIAL, onEdit });

		await user.click(screen.getByTestId('trigger'));
		expect(onEdit).toHaveBeenCalledTimes(1);
		await waitForFocusedSelection(INITIAL);

		await user.keyboard('{Escape}');

		await vi.waitFor(() => expect(screen.getByTestId('trigger')).toHaveFocus());
		expect(preview()).not.toHaveFocus();
	});
});

// ---------------------------------------------------------------------------
// T010 — guard rails and the state surface (upstream #5–#10)
// ---------------------------------------------------------------------------

describe('Editable disabled', () => {
	it('suppresses every interaction and marks the label, area and preview', async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		renderEditable({ defaultValue: INITIAL, disabled: true, onEdit });

		const previewElement = preview();
		expect(previewElement).toHaveAttribute('data-disabled', '');
		expect(previewElement).toHaveAttribute('aria-disabled', 'true');
		expect(previewElement).not.toHaveAttribute('tabindex');
		expect(screen.getByTestId('label')).toHaveAttribute('data-disabled', '');
		expect(screen.getByTestId('area')).toHaveAttribute('data-disabled', '');

		await user.click(previewElement);
		await user.dblClick(previewElement);

		expect(onEdit).not.toHaveBeenCalled();
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
	});

	it('makes the submit and cancel buttons inert while mid-edit', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		const onCancel = vi.fn();
		renderEditable({
			defaultValue: INITIAL,
			defaultEditing: true,
			disabled: true,
			onSubmit,
			onCancel
		});

		await user.click(screen.getByTestId('submit'));
		await user.click(screen.getByTestId('cancel'));

		expect(onSubmit).not.toHaveBeenCalled();
		expect(onCancel).not.toHaveBeenCalled();
		expect(textbox()).toBeInTheDocument();
	});

	// The part's own prop is OR-ed with the root's, never a nullish fallback (upstream
	// `editable.tsx:533`), so `disabled={false}` cannot opt the input out of a disabled root.
	it('keeps the input disabled when its own disabled prop says otherwise (FR-010)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderEditable({
			defaultValue: INITIAL,
			defaultEditing: true,
			disabled: true,
			inputDisabled: false,
			onValueChange
		});

		const input = textbox();
		expect(input).toBeDisabled();

		await user.type(input, 'nope');

		expect(onValueChange).not.toHaveBeenCalled();
		expect(input).toHaveValue(INITIAL);
	});
});

describe('Editable read-only', () => {
	it('always shows an inert input and never a preview', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderEditable({ defaultValue: 'Read Only Value', readOnly: true, onValueChange });

		expect(screen.queryByTestId('preview')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /Read Only Value/i })).not.toBeInTheDocument();

		const input = textbox();
		expect(input).toHaveAttribute('readonly');
		expect(input).toHaveValue('Read Only Value');

		await user.type(input, 'nope');
		expect(onValueChange).not.toHaveBeenCalled();
		expect(input).toHaveValue('Read Only Value');
	});

	it('keeps the cancel and submit buttons mounted and inert', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		const onCancel = vi.fn();
		renderEditable({ defaultValue: INITIAL, readOnly: true, onSubmit, onCancel });

		const cancel = screen.getByTestId('cancel');
		const submit = screen.getByTestId('submit');
		expect(cancel).toHaveAttribute('data-readonly', '');
		expect(submit).toHaveAttribute('data-readonly', '');

		await user.click(submit);
		await user.click(cancel);

		expect(onSubmit).not.toHaveBeenCalled();
		expect(onCancel).not.toHaveBeenCalled();
	});

	// Same OR merge as the disabled case: without it the input would render writable while
	// `EditableRootState.setText` still dropped every keystroke, leaving the DOM ahead of the state.
	it('keeps the input read-only when its own readOnly prop says otherwise (FR-010)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderEditable({
			defaultValue: INITIAL,
			readOnly: true,
			inputReadOnly: false,
			onValueChange
		});

		const input = textbox();
		expect(input).toHaveAttribute('readonly');

		await user.type(input, 'nope');

		expect(onValueChange).not.toHaveBeenCalled();
		expect(input).toHaveValue(INITIAL);
	});
});

describe('Editable placeholder, maxLength and autosize', () => {
	it('shows the placeholder while empty, on the preview and on the input', async () => {
		const user = userEvent.setup();
		renderEditable({ placeholder: 'Enter a title' });

		const previewElement = preview();
		expect(previewElement).toHaveTextContent('Enter a title');
		expect(previewElement).toHaveAttribute('data-empty', '');

		await user.click(previewElement);

		const input = textbox();
		expect(input).toHaveAttribute('placeholder', 'Enter a title');
		expect(input).toHaveValue('');
	});

	it('caps the input at the root maxLength (D-2)', async () => {
		const user = userEvent.setup();
		renderEditable({ maxLength: 10 });

		await user.click(preview());

		expect(textbox()).toHaveAttribute('maxlength', '10');
	});

	it('gives the input a full-width class by default', async () => {
		const user = userEvent.setup();
		renderEditable({ defaultValue: INITIAL });

		await user.click(preview());

		expect(textbox()).toHaveClass('w-full');
		expect(textbox()).not.toHaveClass('w-auto');
	});

	it('switches the input to width-auto when autosize is set', async () => {
		const user = userEvent.setup();
		renderEditable({ defaultValue: INITIAL, autosize: true });

		await user.click(preview());

		expect(textbox()).toHaveClass('w-auto');
		expect(textbox()).not.toHaveClass('w-full');
	});

	it('measures the input width on edit start and on every change (FR-011)', async () => {
		const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth');
		// jsdom has no layout, so `scrollWidth` is always 0; a value that tracks the text is what
		// makes the recalculation observable at all.
		Object.defineProperty(Element.prototype, 'scrollWidth', {
			configurable: true,
			get(this: Element) {
				return this instanceof HTMLInputElement ? this.value.length * 10 : 0;
			}
		});

		try {
			const user = userEvent.setup();
			renderEditable({ defaultValue: 'Autosize', autosize: true });

			await user.click(preview());
			await vi.waitFor(() => expect(textbox().style.width).toBe('84px'));

			const input = textbox();
			input.setSelectionRange(input.value.length, input.value.length);
			await user.type(input, '!');

			expect(input).toHaveValue('Autosize!');
			expect(input.style.width).toBe('94px');
		} finally {
			if (descriptor) Object.defineProperty(Element.prototype, 'scrollWidth', descriptor);
		}
	});
});

describe('Editable trigger modes', () => {
	it('enters edit mode on a single click by default', async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		renderEditable({ defaultValue: INITIAL, triggerMode: 'click', onEdit });

		await user.click(preview());

		expect(onEdit).toHaveBeenCalledTimes(1);
		expect(textbox()).toBeInTheDocument();
	});

	it('requires a double click when triggerMode is dblclick', async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		renderEditable({ defaultValue: INITIAL, triggerMode: 'dblclick', onEdit });

		await user.click(preview());
		expect(onEdit).not.toHaveBeenCalled();
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

		await user.dblClick(preview());
		expect(onEdit).toHaveBeenCalledTimes(1);
		expect(textbox()).toBeInTheDocument();
	});

	it('enters edit mode on focus when triggerMode is focus', async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		renderEditable({ defaultValue: INITIAL, triggerMode: 'focus', onEdit });

		await user.tab();

		expect(onEdit).toHaveBeenCalledTimes(1);
		await waitForFocusedSelection(INITIAL);
	});
});

// ---------------------------------------------------------------------------
// T011 — RTL (upstream #12)
// ---------------------------------------------------------------------------

describe('Editable direction', () => {
	it('renders dir=rtl on the area, the input and the toolbar', async () => {
		const user = userEvent.setup();
		renderEditable({ defaultValue: INITIAL, dir: 'rtl' });

		await user.click(preview());

		expect(screen.getByTestId('area')).toHaveAttribute('dir', 'rtl');
		expect(textbox()).toHaveAttribute('dir', 'rtl');
		expect(screen.getByTestId('toolbar')).toHaveAttribute('dir', 'rtl');
	});

	it('inherits the direction from an ancestor DirectionProvider', async () => {
		const user = userEvent.setup();
		renderEditable({ mode: 'with-direction-provider', providerDir: 'rtl', defaultValue: INITIAL });

		expect(screen.getByTestId('area')).toHaveAttribute('dir', 'rtl');

		await user.click(preview());
		expect(textbox()).toHaveAttribute('dir', 'rtl');
	});
});

// ---------------------------------------------------------------------------
// T012 — composition: trigger, toolbar, child snippets (upstream #11)
// ---------------------------------------------------------------------------

describe('Editable composition', () => {
	it('enters edit mode from an external trigger and unmounts it while editing', async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		renderEditable({ mode: 'with-trigger', defaultValue: INITIAL, onEdit });

		const trigger = screen.getByTestId('trigger');
		expect(trigger).toHaveAttribute('type', 'button');
		expect(trigger).toHaveAttribute('data-slot', 'editable-trigger');
		expect(trigger).toHaveAttribute('aria-disabled', 'false');

		await user.click(trigger);

		expect(onEdit).toHaveBeenCalledTimes(1);
		expect(trigger).not.toBeInTheDocument();
		expect(textbox()).toBeInTheDocument();
	});

	it('keeps the trigger mounted with forceMount, carrying the read-only state', () => {
		renderEditable({
			mode: 'with-trigger',
			defaultValue: INITIAL,
			readOnly: true,
			triggerForceMount: true
		});

		const trigger = screen.getByTestId('trigger');
		expect(trigger).toBeInTheDocument();
		expect(trigger).toHaveAttribute('data-readonly', '');
		expect(trigger).toHaveAttribute('aria-disabled', 'true');
	});

	it('lays the toolbar out vertically on request (FR-015)', () => {
		renderEditable({ orientation: 'vertical' });

		const toolbar = screen.getByTestId('toolbar');
		expect(toolbar).toHaveAttribute('aria-orientation', 'vertical');
		expect(toolbar).toHaveAttribute('data-orientation', 'vertical');
		expect(toolbar).toHaveClass('flex-col');
	});

	it('renders the trigger, submit and cancel through the child snippet (D-6)', async () => {
		const user = userEvent.setup();
		const onEdit = vi.fn();
		const onSubmit = vi.fn();
		renderEditable({ mode: 'child-buttons', defaultValue: INITIAL, onEdit, onSubmit });

		const trigger = screen.getByTestId('trigger');
		expect(trigger).toHaveAttribute('data-slot', 'editable-trigger');
		expect(trigger).toHaveClass('inline-flex');

		await user.click(trigger);
		expect(onEdit).toHaveBeenCalledTimes(1);

		const submit = screen.getByTestId('submit');
		expect(submit).toHaveAttribute('data-slot', 'editable-submit');
		expect(submit).toHaveAttribute('type', 'button');

		await retype(user, NEXT);
		await user.click(submit);

		expect(onSubmit).toHaveBeenCalledWith(NEXT);
		expect(preview()).toHaveTextContent(NEXT);
	});

	it('keeps the blur guard working through a child-rendered cancel button (R-15)', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		const onCancel = vi.fn();
		renderEditable({ mode: 'child-buttons', defaultValue: INITIAL, onSubmit, onCancel });

		await user.click(preview());
		await retype(user, NEXT);
		await user.click(screen.getByTestId('cancel'));

		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onSubmit).not.toHaveBeenCalled();
		expect(preview()).toHaveTextContent(INITIAL);
	});
});

// ---------------------------------------------------------------------------
// T013 — invalid, required, blur submission, guard rails and the providers
// ---------------------------------------------------------------------------

describe('Editable validity flags', () => {
	it('reflects invalid on the label and the input (upstream #14)', async () => {
		const user = userEvent.setup();
		renderEditable({ defaultValue: INITIAL, invalid: true });

		expect(screen.getByTestId('label')).toHaveAttribute('data-invalid', '');

		await user.click(preview());
		expect(textbox()).toHaveAttribute('aria-invalid', 'true');
	});

	it('reflects required on the label and the input', async () => {
		const user = userEvent.setup();
		renderEditable({ defaultValue: INITIAL, required: true });

		expect(screen.getByTestId('label')).toHaveAttribute('data-required', '');

		await user.click(preview());
		const input = textbox();
		expect(input).toBeRequired();
		expect(input).toHaveAttribute('aria-required', 'true');
	});

	it('keeps the input required when its own required prop says otherwise (FR-010)', async () => {
		const user = userEvent.setup();
		renderEditable({ defaultValue: INITIAL, required: true, inputRequired: false });

		await user.click(preview());
		const input = textbox();
		expect(input).toBeRequired();
		expect(input).toHaveAttribute('aria-required', 'true');
	});
});

describe('Editable blur submission', () => {
	it('submits when focus leaves for an unrelated element (upstream #15)', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		renderEditable({ defaultValue: INITIAL, onSubmit });

		await user.click(preview());
		await retype(user, NEXT);
		await user.click(screen.getByTestId('outside'));

		expect(onSubmit).toHaveBeenCalledWith(NEXT);
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
		expect(preview()).toHaveTextContent(NEXT);
	});

	it('submits a blur that carries no related target at all', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		renderEditable({ defaultValue: INITIAL, onSubmit });

		await user.click(preview());
		await retype(user, NEXT);
		// The one place `fireEvent` is unavoidable: no gesture produces a null `relatedTarget`.
		await fireEvent.blur(textbox());

		expect(onSubmit).toHaveBeenCalledWith(NEXT);
	});

	it('does not submit a blur toward the cancel button', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		renderEditable({ defaultValue: INITIAL, onSubmit });

		await user.click(preview());
		await retype(user, NEXT);
		await fireEvent.blur(textbox(), { relatedTarget: screen.getByTestId('cancel') });

		expect(onSubmit).not.toHaveBeenCalled();
		expect(textbox()).toBeInTheDocument();
	});

	it('does not submit a blur toward the external trigger', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		renderEditable({
			mode: 'with-trigger',
			defaultValue: INITIAL,
			triggerForceMount: true,
			onSubmit
		});

		await user.click(preview());
		await retype(user, NEXT);
		await fireEvent.blur(textbox(), { relatedTarget: screen.getByTestId('trigger') });

		expect(onSubmit).not.toHaveBeenCalled();
		expect(textbox()).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// T032 — Tab as a documented key (FR-009a, SC-004, the MDX keyboard table)
// ---------------------------------------------------------------------------

/** Record `defaultPrevented` for every `Tab` keydown that reaches the document. */
function trackTabKeydowns(): { prevented: boolean[]; stop: () => void } {
	const prevented: boolean[] = [];
	const listener = (event: KeyboardEvent) => {
		if (event.key === 'Tab') prevented.push(event.defaultPrevented);
	};
	document.addEventListener('keydown', listener);
	return { prevented, stop: () => document.removeEventListener('keydown', listener) };
}

describe('Editable with Tab', () => {
	it('commits the typed text when Tab moves focus out of the component', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		// No toolbar: Cancel and Submit would otherwise be next in the tab order, and the R-15 guard
		// (exercised below) would suppress the commit this case is about.
		renderEditable({ defaultValue: INITIAL, withToolbar: false, onSubmit });
		const tabs = trackTabKeydowns();

		try {
			await user.click(preview());
			await retype(user, NEXT);
			await user.tab();
		} finally {
			tabs.stop();
		}

		expect(screen.getByTestId('outside')).toHaveFocus();
		// The input never intercepts `Tab` — the browser's own focus move is what triggers the blur.
		expect(tabs.prevented).toEqual([false]);
		expect(onSubmit).toHaveBeenCalledWith(NEXT);
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
		expect(preview()).toHaveTextContent(NEXT);
	});

	it('does not commit when Tab lands on the external trigger (R-15)', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		renderEditable({
			mode: 'with-trigger',
			defaultValue: INITIAL,
			triggerForceMount: true,
			onSubmit
		});

		await user.click(preview());
		await retype(user, NEXT);
		await user.tab();

		expect(screen.getByTestId('trigger')).toHaveFocus();
		expect(onSubmit).not.toHaveBeenCalled();
		expect(textbox()).toBeInTheDocument();
	});

	it('does not commit when Tab lands on the cancel button (R-15)', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		renderEditable({ defaultValue: INITIAL, onSubmit });

		await user.click(preview());
		await retype(user, NEXT);
		await user.tab();

		expect(screen.getByTestId('cancel')).toHaveFocus();
		expect(onSubmit).not.toHaveBeenCalled();
		expect(textbox()).toBeInTheDocument();
	});
});

describe('Editable change guards', () => {
	it('submits an unchanged value without reporting a value change (FR-006, R-01)', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		const onValueChange = vi.fn();
		renderEditable({ defaultValue: INITIAL, onSubmit, onValueChange });

		await user.click(preview());
		// The input takes focus on the scheduled frame, so `Enter` has to wait for it to land there.
		await waitForFocusedSelection(INITIAL);
		await user.keyboard('{Enter}');

		expect(onSubmit).toHaveBeenCalledWith(INITIAL);
		expect(onValueChange).not.toHaveBeenCalled();
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
	});

	it('reports each edit-mode transition exactly once', async () => {
		const user = userEvent.setup();
		const onEditingChange = vi.fn();
		renderEditable({ defaultValue: INITIAL, onEditingChange });

		await user.click(preview());
		expect(onEditingChange).toHaveBeenCalledExactlyOnceWith(true);

		// Enter in the input submits: one transition out, never two — even though blur and the
		// submit button can both reach `submit()` on the way (the `Object.is` guard, research R-01).
		await waitForFocusedSelection(INITIAL);
		await user.keyboard('{Enter}');
		expect(onEditingChange).toHaveBeenCalledTimes(2);
		expect(onEditingChange).toHaveBeenLastCalledWith(false);
	});

	it('pins the always-shown input when read-only is turned on mid-edit', async () => {
		const user = userEvent.setup();
		const { rerender } = renderEditable({ defaultValue: INITIAL });

		await user.click(preview());
		expect(textbox()).toBeInTheDocument();

		// Replacing the caller's props re-seeds an uncontrolled value from `defaultValue` — Svelte
		// hands a non-bound `$bindable` prop back to the parent on every props invalidation — so this
		// asserts what read-only owns: the input is pinned open and inert, and the preview never
		// returns however edit mode moves underneath it.
		await rerender({ defaultValue: INITIAL, readOnly: true });

		const input = textbox();
		expect(input).toHaveAttribute('readonly');
		expect(screen.queryByTestId('preview')).not.toBeInTheDocument();

		await user.keyboard('{Escape}');
		expect(textbox()).toBeInTheDocument();
	});
});

describe('Editable provider requirement', () => {
	const parts = [
		['bare-label', '<Editable.Label>'],
		['bare-area', '<Editable.Area>'],
		['bare-preview', '<Editable.Preview>'],
		['bare-input', '<Editable.Input>'],
		['bare-trigger', '<Editable.Trigger>'],
		['bare-toolbar', '<Editable.Toolbar>'],
		['bare-cancel', '<Editable.Cancel>'],
		['bare-submit', '<Editable.Submit>']
	] as const;

	for (const [mode, part] of parts) {
		it(`throws when ${part} is rendered with no root`, () => {
			expect(() => renderEditable({ mode })).toThrow(/within/);
			expect(() => renderEditable({ mode })).toThrow(part);
		});
	}

	it('gives every part its documented data-slot', async () => {
		const user = userEvent.setup();
		renderEditable({ mode: 'with-trigger', defaultValue: INITIAL, triggerForceMount: true });

		for (const slot of [
			'editable',
			'editable-label',
			'editable-area',
			'editable-preview',
			'editable-trigger',
			'editable-toolbar'
		]) {
			expect(bySlot(slot)).toBeInTheDocument();
		}

		await user.click(preview());

		for (const slot of ['editable-input', 'editable-cancel', 'editable-submit']) {
			expect(bySlot(slot)).toBeInTheDocument();
		}
	});
});

// ---------------------------------------------------------------------------
// T014 — form integration (upstream #13, FR-017, D-5)
// ---------------------------------------------------------------------------

describe('Editable in a form', () => {
	it('submits its value through a hidden form-associated input', async () => {
		const user = userEvent.setup();
		const onFormSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
		renderEditable({ mode: 'with-form', name: 'field', defaultValue: INITIAL, onFormSubmit });

		const formInput = bySlot('editable-form-input');
		expect(formInput).toHaveAttribute('name', 'field');
		expect(formInput).toHaveValue(INITIAL);
		expect(formInput).toHaveAttribute('aria-hidden', 'true');
		expect(formInput).toHaveAttribute('tabindex', '-1');

		const form = screen.getByTestId('form') as HTMLFormElement;
		expect(new FormData(form).get('field')).toBe(INITIAL);

		await user.click(screen.getByTestId('form-submit'));
		expect(onFormSubmit).toHaveBeenCalledTimes(1);
	});

	it('carries the submitted value into the form data', async () => {
		const user = userEvent.setup();
		renderEditable({ mode: 'with-form', name: 'field', defaultValue: INITIAL });

		await user.click(preview());
		await retype(user, NEXT);
		await user.click(screen.getByTestId('submit'));

		const form = screen.getByTestId('form') as HTMLFormElement;
		expect(new FormData(form).get('field')).toBe(NEXT);
	});

	it('blocks submission of an empty required field (D-5)', async () => {
		const user = userEvent.setup();
		renderEditable({ mode: 'with-form', name: 'field', required: true, defaultValue: '' });

		const form = screen.getByTestId('form') as HTMLFormElement;
		expect(form.checkValidity()).toBe(false);
		expect(form.reportValidity()).toBe(false);

		await user.click(preview());
		await retype(user, NEXT);
		await user.click(screen.getByTestId('submit'));

		expect(form.checkValidity()).toBe(true);
		expect(form.reportValidity()).toBe(true);
	});

	it('reflects disabled on the hidden input', () => {
		renderEditable({ mode: 'with-form', name: 'field', defaultValue: INITIAL, disabled: true });

		expect(bySlot('editable-form-input')).toBeDisabled();
	});

	it('renders no hidden input outside a form', () => {
		renderEditable({ defaultValue: INITIAL });

		expect(queryBySlot('editable-form-input')).toBeNull();
	});
});
