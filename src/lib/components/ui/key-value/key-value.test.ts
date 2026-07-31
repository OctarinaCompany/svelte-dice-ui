import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { parseKeyValueText, stripSurroundingQuotes } from './index.js';
import Harness, { type KeyValueHarnessProps } from './key-value.test.svelte';

type Field = 'key' | 'value';
type Control = HTMLInputElement | HTMLTextAreaElement;

function renderKeyValue(props: KeyValueHarnessProps = {}) {
	return render(Harness, { props });
}

function rows(): HTMLElement[] {
	return screen.queryAllByTestId('item');
}

function row(index: number): HTMLElement {
	const element = rows()[index];
	if (!element) throw new Error(`no row at index ${index}`);
	return element;
}

function fieldWrapper(index: number, field: Field): HTMLElement {
	const element = row(index).querySelector<HTMLElement>(`[data-slot="key-value-${field}-input"]`);
	if (!element) throw new Error(`row ${index} has no ${field} field`);
	return element;
}

function preview(index: number, field: Field): HTMLElement | null {
	return row(index).querySelector<HTMLElement>(`[data-slot="key-value-${field}-input-preview"]`);
}

function control(index: number, field: Field): Control | null {
	return row(index).querySelector<Control>(`[data-slot="key-value-${field}-input-control"]`);
}

function bySlot(slot: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function queryBySlot(slot: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
}

/**
 * Focus and text selection both happen on a scheduled animation frame (`editable` research R-03),
 * so every assertion about them polls rather than assuming one flush is enough.
 */
async function openField(
	user: ReturnType<typeof userEvent.setup>,
	index: number,
	field: Field
): Promise<Control> {
	const target = preview(index, field);
	if (target) await user.click(target);

	return vi.waitFor(() => {
		const element = control(index, field);
		expect(element).not.toBeNull();
		expect(element).toHaveFocus();
		return element as Control;
	});
}

/** Enter edit mode on a field, replace its whole text, and hand the control back. */
async function typeField(
	user: ReturnType<typeof userEvent.setup>,
	index: number,
	field: Field,
	text: string
): Promise<Control> {
	const element = await openField(user, index, field);
	await user.clear(element);
	if (text !== '') await user.type(element, text);
	return element;
}

/** Focus is restored one scheduled frame after a list mutation, so it has to be polled for. */
function waitForActiveField(index: number, field: Field) {
	return vi.waitFor(() => expect(control(index, field)).toHaveFocus());
}

const THREE_ROWS = [
	{ id: '1', key: 'ALPHA', value: 'one' },
	{ id: '2', key: 'BETA', value: 'two' },
	{ id: '3', key: 'GAMMA', value: 'three' }
];

// ---------------------------------------------------------------------------
// T004 — roles, accessible names, ARIA and the documented attribute surface
// ---------------------------------------------------------------------------

describe('KeyValue roles and ARIA', () => {
	it('renders the documented roles and slots', () => {
		renderKeyValue({ defaultValue: THREE_ROWS });

		const root = screen.getByTestId('root');
		expect(root).toHaveAttribute('data-slot', 'key-value');

		const list = screen.getByRole('list');
		expect(list).toBe(screen.getByTestId('list'));
		expect(list).toHaveAttribute('data-slot', 'key-value-list');

		const listitems = screen.getAllByRole('listitem');
		expect(listitems).toHaveLength(3);
		for (const item of listitems) {
			expect(item).toHaveAttribute('data-slot', 'key-value-item');
		}

		expect(fieldWrapper(0, 'key')).toHaveAttribute('role', 'group');
		expect(fieldWrapper(0, 'value')).toHaveAttribute('role', 'group');
		expect(preview(0, 'key')).toHaveAttribute('data-slot', 'key-value-key-input-preview');
		expect(preview(0, 'value')).toHaveAttribute('data-slot', 'key-value-value-input-preview');
	});

	it('gives the remove and add controls their accessible names (FR-022)', () => {
		renderKeyValue({ defaultValue: THREE_ROWS });

		expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(3);
		expect(screen.getByRole('button', { name: /add/i })).toHaveAttribute(
			'data-slot',
			'key-value-add'
		);
	});

	it('shows the default "Key" and "Value" placeholders on preview and control (FR-017)', async () => {
		const user = userEvent.setup();
		renderKeyValue();

		expect(preview(0, 'key')).toHaveTextContent('Key');
		expect(preview(0, 'value')).toHaveTextContent('Value');

		expect(await openField(user, 0, 'key')).toHaveAttribute('placeholder', 'Key');
	});

	it('changes the key and value placeholders independently (FR-017)', () => {
		renderKeyValue({ keyPlaceholder: 'KEY', valuePlaceholder: 'value' });

		expect(preview(0, 'key')).toHaveTextContent('KEY');
		expect(preview(0, 'value')).toHaveTextContent('value');
	});

	it('lets a caller-supplied placeholder win over the root default', () => {
		renderKeyValue({ keyPlaceholder: 'KEY', keyInputPlaceholder: 'name' });

		expect(preview(0, 'key')).toHaveTextContent('name');
		expect(preview(0, 'value')).toHaveTextContent('Value');
	});

	it('wires an error to its field on both the control and the preview (SC-004)', async () => {
		const user = userEvent.setup();
		renderKeyValue({
			defaultValue: [{ id: '1', key: '', value: '' }],
			onKeyValidate: (key) => (key === 'BAD' ? 'Bad key' : undefined)
		});

		const keyControl = await typeField(user, 0, 'key', 'BAD');

		const error = await screen.findByRole('alert');
		expect(error).toHaveAttribute('data-slot', 'key-value-error');
		expect(error).toHaveAttribute('data-field', 'key');
		expect(error).toHaveTextContent('Bad key');

		expect(keyControl).toHaveAttribute('aria-invalid', 'true');
		expect(keyControl).toHaveAttribute('aria-describedby', error.id);

		// The association has to survive the field leaving edit mode, which is when only the preview
		// is in the accessibility tree.
		await user.click(screen.getByTestId('outside'));
		await vi.waitFor(() => expect(preview(0, 'key')).not.toBeNull());
		expect(preview(0, 'key')).toHaveAttribute('aria-invalid', 'true');
		expect(preview(0, 'key')).toHaveAttribute('aria-describedby', error.id);
	});

	it('renders no error element while the row is valid', () => {
		renderKeyValue({ defaultValue: THREE_ROWS });

		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(queryBySlot('key-value-error')).toBeNull();
	});

	it('exposes data-disabled, data-readonly and data-invalid on the root only when they hold', () => {
		const { unmount } = renderKeyValue({ defaultValue: THREE_ROWS });

		expect(screen.getByTestId('root')).not.toHaveAttribute('data-disabled');
		expect(screen.getByTestId('root')).not.toHaveAttribute('data-readonly');
		expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
		unmount();

		renderKeyValue({
			defaultValue: [{ id: '1', key: '', value: '' }],
			disabled: true,
			readOnly: true
		});
		expect(screen.getByTestId('root')).toHaveAttribute('data-disabled', '');
		expect(screen.getByTestId('root')).toHaveAttribute('data-readonly', '');
		// `data-invalid` is driven by the error record, so it needs a real edit to appear.
		expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
	});

	it('marks exactly the newly added row as highlighted (FR-021)', async () => {
		const user = userEvent.setup();
		renderKeyValue({ defaultValue: THREE_ROWS });

		for (const item of rows()) {
			expect(item).not.toHaveAttribute('data-highlighted');
		}

		await user.click(screen.getByTestId('add'));

		await vi.waitFor(() => expect(rows()).toHaveLength(4));
		expect(rows().map((item) => item.hasAttribute('data-highlighted'))).toEqual([
			false,
			false,
			false,
			true
		]);
	});

	it('throws the documented error for every part used outside its provider (FR-016)', () => {
		expect(() => renderKeyValue({ mode: 'bare-list' })).toThrow(/within/);
		expect(() => renderKeyValue({ mode: 'bare-add' })).toThrow(/within/);
		expect(() => renderKeyValue({ mode: 'bare-item' })).toThrow(/within/);
		expect(() => renderKeyValue({ mode: 'bare-key-input' })).toThrow(/within/);
		expect(() => renderKeyValue({ mode: 'bare-value-input' })).toThrow(/within/);
		expect(() => renderKeyValue({ mode: 'bare-remove' })).toThrow(/within/);
		expect(() => renderKeyValue({ mode: 'bare-error' })).toThrow(/within/);
	});

	it('names both the part and its required ancestor in the thrown message', () => {
		expect(() => renderKeyValue({ mode: 'bare-list' })).toThrow(
			'`<KeyValue.List>` must be used within `<KeyValue.Root>`.'
		);
		expect(() => renderKeyValue({ mode: 'bare-add' })).toThrow(
			'`<KeyValue.Add>` must be used within `<KeyValue.Root>`.'
		);
		expect(() => renderKeyValue({ mode: 'bare-key-input' })).toThrow(
			'`<KeyValue.KeyInput>` must be used within `<KeyValue.List>`.'
		);
	});
});

// ---------------------------------------------------------------------------
// T004a — orientation (FR-013, divergence D-6)
// ---------------------------------------------------------------------------

describe('KeyValue orientation', () => {
	it('lays the list out vertically by default', () => {
		renderKeyValue({ defaultValue: THREE_ROWS });

		const list = screen.getByTestId('list');
		expect(list).toHaveAttribute('data-orientation', 'vertical');
		expect(list).toHaveClass('flex-col');
		expect(list).not.toHaveClass('flex-row');
	});

	it('lays the list out horizontally when asked', () => {
		renderKeyValue({ defaultValue: THREE_ROWS, orientation: 'horizontal' });

		const list = screen.getByTestId('list');
		expect(list).toHaveAttribute('data-orientation', 'horizontal');
		expect(list).toHaveClass('flex-row');
		expect(list).not.toHaveClass('flex-col');
	});

	it('never emits aria-orientation on the list (divergence D-6)', () => {
		const { unmount } = renderKeyValue({ orientation: 'horizontal' });
		expect(screen.getByTestId('list')).not.toHaveAttribute('aria-orientation');
		unmount();

		renderKeyValue({ orientation: 'vertical' });
		expect(screen.getByTestId('list')).not.toHaveAttribute('aria-orientation');
	});

	it('keeps roles and tab order identical in both orientations', async () => {
		const user = userEvent.setup();
		renderKeyValue({ defaultValue: [THREE_ROWS[0]], orientation: 'horizontal' });

		expect(screen.getByRole('list')).toBeInTheDocument();
		expect(screen.getAllByRole('listitem')).toHaveLength(1);

		await user.tab();
		await waitForActiveField(0, 'key');

		await user.tab();
		await waitForActiveField(0, 'value');

		await user.tab();
		expect(screen.getByTestId('remove')).toHaveFocus();

		await user.tab();
		expect(screen.getByTestId('add')).toHaveFocus();
	});
});

// ---------------------------------------------------------------------------
// T005 — keyboard (MDX `key-value.mdx:230-249`)
// ---------------------------------------------------------------------------

describe('KeyValue with the keyboard', () => {
	it('enters edit mode on Tab and selects the field text', async () => {
		const user = userEvent.setup();
		renderKeyValue({ defaultValue: [THREE_ROWS[0]] });

		await user.tab();

		const keyControl = await vi.waitFor(() => {
			const element = control(0, 'key');
			expect(element).toHaveFocus();
			expect(element?.selectionStart).toBe(0);
			expect(element?.selectionEnd).toBe('ALPHA'.length);
			return element as Control;
		});
		expect(keyControl).toHaveValue('ALPHA');
	});

	it('tabs from the key field to the value field to the remove and add buttons', async () => {
		const user = userEvent.setup();
		renderKeyValue({ defaultValue: [THREE_ROWS[0]] });

		await user.tab();
		await waitForActiveField(0, 'key');

		await user.tab();
		await waitForActiveField(0, 'value');
		expect(control(0, 'value')).toHaveValue('one');

		await user.tab();
		expect(screen.getByTestId('remove')).toHaveFocus();

		await user.tab();
		expect(screen.getByTestId('add')).toHaveFocus();
	});

	it('submits the field being edited on Enter', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderKeyValue({ defaultValue: [THREE_ROWS[0]], onValueChange });

		await typeField(user, 0, 'key', 'RENAMED');
		await user.keyboard('{Enter}');

		await vi.waitFor(() => expect(control(0, 'key')).toBeNull());
		expect(preview(0, 'key')).toHaveTextContent('RENAMED');
		expect(onValueChange.mock.lastCall?.[0]).toEqual([{ id: '1', key: 'RENAMED', value: 'one' }]);
	});

	it('submits a value-field edit on Enter rather than inserting a newline (divergence D-2)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderKeyValue({ defaultValue: [THREE_ROWS[0]], onValueChange });

		await typeField(user, 0, 'value', 'edited');
		await user.keyboard('{Enter}');

		await vi.waitFor(() => expect(control(0, 'value')).toBeNull());
		expect(preview(0, 'value')).toHaveTextContent('edited');
		expect(onValueChange.mock.lastCall?.[0]).toEqual([{ id: '1', key: 'ALPHA', value: 'edited' }]);
	});

	it('restores the text the edit started with on Escape', async () => {
		const user = userEvent.setup();
		renderKeyValue({ defaultValue: [THREE_ROWS[0]] });

		await typeField(user, 0, 'key', 'THROWAWAY');
		expect(control(0, 'key')).toHaveValue('THROWAWAY');

		await user.keyboard('{Escape}');

		// The field is open exactly while it has focus (`triggerMode="focus"`), so a cancel restores
		// the text and hands focus straight back rather than stranding it on `<body>`.
		await vi.waitFor(() => {
			expect(control(0, 'key')).toHaveValue('ALPHA');
			expect(control(0, 'key')).toHaveFocus();
		});
	});

	it('trims a field on write and keeps the control in lockstep (FR-005, research R-13)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderKeyValue({ defaultValue: [{ id: '1', key: '', value: '' }], onValueChange });

		const keyControl = await typeField(user, 0, 'key', 'API_KEY ');

		expect(onValueChange.mock.lastCall?.[0]).toEqual([{ id: '1', key: 'API_KEY', value: '' }]);
		expect(keyControl).toHaveValue('API_KEY');
	});

	it('keeps the whitespace when trim is off', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderKeyValue({
			defaultValue: [{ id: '1', key: '', value: '' }],
			trim: false,
			onValueChange
		});

		const keyControl = await typeField(user, 0, 'key', 'API_KEY ');

		expect(onValueChange.mock.lastCall?.[0]).toEqual([{ id: '1', key: 'API_KEY ', value: '' }]);
		expect(keyControl).toHaveValue('API_KEY ');
	});

	it('splits a multi-line paste made with the keyboard into one row per line', async () => {
		const user = userEvent.setup();
		renderKeyValue();

		await openField(user, 0, 'key');
		await user.paste('API_KEY=sk-1\nPORT=3000');

		await vi.waitFor(() => expect(rows()).toHaveLength(2));
		expect(preview(0, 'key') ?? control(0, 'key')).toHaveTextContent('API_KEY');
	});
});

// ---------------------------------------------------------------------------
// T006 — controlled and uncontrolled (FR-001)
// ---------------------------------------------------------------------------

describe('KeyValue controlled and uncontrolled', () => {
	it('seeds exactly one empty row when neither value nor defaultValue is given', () => {
		renderKeyValue();

		expect(rows()).toHaveLength(1);
		expect(preview(0, 'key')).toHaveTextContent('Key');
		expect(preview(0, 'value')).toHaveTextContent('Value');
	});

	it('honours an explicitly empty defaultValue as zero rows', () => {
		renderKeyValue({ defaultValue: [] });

		expect(rows()).toHaveLength(0);
	});

	it('lets interaction update an uncontrolled list in place', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderKeyValue({ defaultValue: [THREE_ROWS[0]], onValueChange });

		await user.click(screen.getByTestId('add'));
		await vi.waitFor(() => expect(rows()).toHaveLength(2));

		await typeField(user, 1, 'key', 'NEW');

		expect(onValueChange.mock.lastCall?.[0]).toEqual([
			{ id: '1', key: 'ALPHA', value: 'one' },
			{ id: expect.any(String), key: 'NEW', value: '' }
		]);
	});

	it('never moves on its own while an authoritative parent declines the write', async () => {
		const user = userEvent.setup();
		const onDeclinedValue = vi.fn();
		renderKeyValue({
			binding: 'function',
			authoritativeValue: [THREE_ROWS[0]],
			onDeclinedValue
		});

		await user.click(screen.getByTestId('add'));

		expect(rows()).toHaveLength(1);
		expect(onDeclinedValue).toHaveBeenCalledTimes(1);
		expect(onDeclinedValue.mock.lastCall?.[0]).toEqual([
			{ id: '1', key: 'ALPHA', value: 'one' },
			{ id: expect.any(String), key: '', value: '' }
		]);
	});

	it('reports every change through onValueChange when value is passed as a plain prop', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderKeyValue({ binding: 'prop', value: [THREE_ROWS[0]], onValueChange });

		await user.click(screen.getByTestId('add'));

		expect(onValueChange).toHaveBeenCalledTimes(1);
		expect(onValueChange.mock.lastCall?.[0]).toHaveLength(2);
	});

	it('lets a bound value be moved by interaction', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderKeyValue({ binding: 'value', value: [THREE_ROWS[0]], onValueChange });

		await user.click(screen.getByTestId('add'));

		await vi.waitFor(() => expect(rows()).toHaveLength(2));
		expect(onValueChange).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// T007 — right-to-left (FR-014)
// ---------------------------------------------------------------------------

describe('KeyValue in RTL', () => {
	it('marks the root and every field as right-to-left', () => {
		renderKeyValue({ dir: 'rtl', defaultValue: [THREE_ROWS[0]] });

		expect(screen.getByTestId('root')).toHaveAttribute('dir', 'rtl');
		expect(fieldWrapper(0, 'key')).toHaveAttribute('dir', 'rtl');
		expect(fieldWrapper(0, 'value')).toHaveAttribute('dir', 'rtl');
	});

	it('inherits the direction from a surrounding DirectionProvider', () => {
		renderKeyValue({ mode: 'with-direction-provider', providerDir: 'rtl' });

		expect(screen.getByTestId('root')).toHaveAttribute('dir', 'rtl');
		expect(fieldWrapper(0, 'key')).toHaveAttribute('dir', 'rtl');
	});

	it('keeps the row in key / value / remove order, so only the visual order mirrors', () => {
		renderKeyValue({ dir: 'rtl', defaultValue: [THREE_ROWS[0]] });

		// `dir="rtl"` is what mirrors a flex row visually; the DOM order — and therefore the tab
		// order — is deliberately untouched.
		const item = row(0);
		const order = Array.from(item.querySelectorAll('[data-slot]'))
			.map((element) => element.getAttribute('data-slot'))
			.filter(
				(slot) =>
					slot === 'key-value-key-input' ||
					slot === 'key-value-value-input' ||
					slot === 'key-value-remove'
			);
		expect(order).toEqual(['key-value-key-input', 'key-value-value-input', 'key-value-remove']);
	});

	it('parses, validates, adds and removes byte-identically to the LTR case', async () => {
		const user = userEvent.setup();
		const onKeyValidate = vi.fn((key: string) => (key === 'BAD' ? 'Bad key' : undefined));
		renderKeyValue({ dir: 'rtl', onKeyValidate });

		await openField(user, 0, 'key');
		await user.paste('A=1\nB=2\nC=3');
		await vi.waitFor(() => expect(rows()).toHaveLength(3));

		await user.click(screen.getByTestId('add'));
		await vi.waitFor(() => expect(rows()).toHaveLength(4));

		await typeField(user, 3, 'key', 'BAD');
		expect(await screen.findByRole('alert')).toHaveTextContent('Bad key');

		await user.click(screen.getAllByTestId('remove')[3]);
		await vi.waitFor(() => expect(rows()).toHaveLength(3));
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// T008 — add, remove and focus management (FR-002, FR-003, FR-004, FR-019)
// ---------------------------------------------------------------------------

describe('KeyValue add and remove', () => {
	it('appends an empty row and moves focus into its key field (FR-002)', async () => {
		const user = userEvent.setup();
		const onAdd = vi.fn();
		renderKeyValue({ defaultValue: [THREE_ROWS[0]], onAdd });

		await user.click(screen.getByTestId('add'));

		await vi.waitFor(() => expect(rows()).toHaveLength(2));
		await waitForActiveField(1, 'key');
		expect(control(1, 'key')).toHaveValue('');

		expect(onAdd).toHaveBeenCalledTimes(1);
		expect(onAdd.mock.lastCall?.[0]).toEqual({ id: expect.any(String), key: '', value: '' });
	});

	it('moves focus to the next row after removing a middle row (US1.3)', async () => {
		const user = userEvent.setup();
		const onRemove = vi.fn();
		renderKeyValue({ defaultValue: THREE_ROWS, onRemove });

		await user.click(screen.getAllByTestId('remove')[1]);

		await vi.waitFor(() => expect(rows()).toHaveLength(2));
		await waitForActiveField(1, 'key');
		expect(control(1, 'key')).toHaveValue('GAMMA');

		expect(onRemove).toHaveBeenCalledTimes(1);
		expect(onRemove.mock.lastCall?.[0]).toEqual({ id: '2', key: 'BETA', value: 'two' });
	});

	it('moves focus to the previous row after removing the last row (US1.3)', async () => {
		const user = userEvent.setup();
		renderKeyValue({ defaultValue: THREE_ROWS });

		await user.click(screen.getAllByTestId('remove')[2]);

		await vi.waitFor(() => expect(rows()).toHaveLength(2));
		await waitForActiveField(1, 'key');
		expect(control(1, 'key')).toHaveValue('BETA');
	});

	it("keeps every surviving row's data when one is removed", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderKeyValue({ defaultValue: THREE_ROWS, onValueChange });

		await user.click(screen.getAllByTestId('remove')[0]);

		expect(onValueChange.mock.lastCall?.[0]).toEqual([THREE_ROWS[1], THREE_ROWS[2]]);
	});

	it('refuses removal at minItems and disables every remove control (US1.4)', async () => {
		const user = userEvent.setup();
		const onRemove = vi.fn();
		renderKeyValue({ defaultValue: THREE_ROWS, minItems: 3, onRemove });

		for (const button of screen.getAllByTestId('remove')) {
			expect(button).toBeDisabled();
		}

		await user.click(screen.getAllByTestId('remove')[0]);

		expect(rows()).toHaveLength(3);
		expect(onRemove).not.toHaveBeenCalled();
	});

	it('refuses adding at maxItems and disables the add control (US1.5)', async () => {
		const user = userEvent.setup();
		const onAdd = vi.fn();
		renderKeyValue({ defaultValue: THREE_ROWS, maxItems: 3, onAdd });

		expect(screen.getByTestId('add')).toBeDisabled();

		await user.click(screen.getByTestId('add'));

		expect(rows()).toHaveLength(3);
		expect(onAdd).not.toHaveBeenCalled();
	});

	it("drops the removed row's error so no later row inherits it", async () => {
		const user = userEvent.setup();
		renderKeyValue({
			defaultValue: [
				{ id: '1', key: 'ALPHA', value: 'one' },
				{ id: '2', key: 'BETA', value: 'two' }
			],
			onKeyValidate: (key) => (key === 'BAD' ? 'Bad key' : undefined)
		});

		await typeField(user, 0, 'key', 'BAD');
		expect(await screen.findByRole('alert')).toHaveTextContent('Bad key');
		expect(screen.getByTestId('root')).toHaveAttribute('data-invalid', '');

		await user.click(screen.getAllByTestId('remove')[0]);

		await vi.waitFor(() => expect(rows()).toHaveLength(1));
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
	});

	it('fires neither callback while the list is disabled', async () => {
		const user = userEvent.setup();
		const onAdd = vi.fn();
		const onRemove = vi.fn();
		renderKeyValue({ defaultValue: THREE_ROWS, disabled: true, onAdd, onRemove });

		expect(screen.getByTestId('add')).toBeDisabled();
		for (const button of screen.getAllByTestId('remove')) {
			expect(button).toBeDisabled();
		}

		await user.click(screen.getByTestId('add'));
		await user.click(screen.getAllByTestId('remove')[0]);

		expect(rows()).toHaveLength(3);
		expect(onAdd).not.toHaveBeenCalled();
		expect(onRemove).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// T009 — paste (FR-006, US2)
// ---------------------------------------------------------------------------

describe('parseKeyValueText', () => {
	it('splits KEY=VALUE lines on the first equals sign', () => {
		expect(parseKeyValueText('API_KEY=sk-1234567890\nPORT=3000', { stripQuotes: true })).toEqual([
			{ key: 'API_KEY', value: 'sk-1234567890' },
			{ key: 'PORT', value: '3000' }
		]);
	});

	it('keeps every later separator in the value', () => {
		expect(parseKeyValueText('URL=https://host:5432/db?a=b', { stripQuotes: true })).toEqual([
			{ key: 'URL', value: 'https://host:5432/db?a=b' }
		]);
	});

	it('splits KEY: VALUE lines when there is no equals sign', () => {
		expect(
			parseKeyValueText('DATABASE_URL: postgresql://localhost:5432', { stripQuotes: true })
		).toEqual([{ key: 'DATABASE_URL', value: 'postgresql://localhost:5432' }]);
	});

	it('splits tab- and multi-space-separated lines last', () => {
		expect(parseKeyValueText('API_KEY\tsk-1\nPORT   3000', { stripQuotes: true })).toEqual([
			{ key: 'API_KEY', value: 'sk-1' },
			{ key: 'PORT', value: '3000' }
		]);
	});

	it('prefers = over : over whitespace, per line', () => {
		expect(parseKeyValueText('A:1=2\nB\t3:4\nC\td e', { stripQuotes: true })).toEqual([
			// `=` wins over the `:` earlier in the line …
			{ key: 'A:1', value: '2' },
			// … and `:` wins over the tab earlier in the line …
			{ key: 'B\t3', value: '4' },
			// … leaving the whitespace branch for lines with neither.
			{ key: 'C', value: 'd e' }
		]);
	});

	it('drops blank lines, lines with no separator and lines with an empty key', () => {
		expect(parseKeyValueText('A=1\n\nnoseparator\n   \n=2', { stripQuotes: true })).toEqual([
			{ key: 'A', value: '1' }
		]);
	});

	it('strips one matching pair of surrounding quotes when asked', () => {
		expect(parseKeyValueText('A="quoted"\nB=\'also\'', { stripQuotes: true })).toEqual([
			{ key: 'A', value: 'quoted' },
			{ key: 'B', value: 'also' }
		]);
		expect(parseKeyValueText('A="quoted"', { stripQuotes: false })).toEqual([
			{ key: 'A', value: '"quoted"' }
		]);
	});
});

describe('stripSurroundingQuotes', () => {
	it('returns the text untouched when stripping is off', () => {
		expect(stripSurroundingQuotes('  "kept"  ', false)).toBe('  "kept"  ');
	});

	it('trims and unwraps matching quotes when stripping is on', () => {
		expect(stripSurroundingQuotes('  "value"  ', true)).toBe('value');
		expect(stripSurroundingQuotes("  'value'  ", true)).toBe('value');
		expect(stripSurroundingQuotes('  "mismatched\'  ', true)).toBe('"mismatched\'');
		expect(stripSurroundingQuotes('  plain  ', true)).toBe('plain');
	});
});

describe('KeyValue paste', () => {
	it('replaces an empty row with the parsed rows (US2.1)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderKeyValue({ onValueChange });

		await openField(user, 0, 'key');
		await user.paste('API_KEY=sk-1\nPORT=3000');

		await vi.waitFor(() => expect(rows()).toHaveLength(2));
		expect(onValueChange.mock.lastCall?.[0]).toEqual([
			{ id: expect.any(String), key: 'API_KEY', value: 'sk-1' },
			{ id: expect.any(String), key: 'PORT', value: '3000' }
		]);
	});

	it('inserts the parsed rows after a row that already has content (US2.3)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderKeyValue({
			defaultValue: [
				{ id: '1', key: 'FIRST', value: 'a' },
				{ id: '2', key: 'LAST', value: 'z' }
			],
			onValueChange
		});

		await openField(user, 0, 'key');
		await user.paste('MID_ONE=1\nMID_TWO=2');

		await vi.waitFor(() => expect(rows()).toHaveLength(4));
		expect(onValueChange.mock.lastCall?.[0]).toEqual([
			{ id: '1', key: 'FIRST', value: 'a' },
			{ id: expect.any(String), key: 'MID_ONE', value: '1' },
			{ id: expect.any(String), key: 'MID_TWO', value: '2' },
			{ id: '2', key: 'LAST', value: 'z' }
		]);
	});

	it('truncates a paste that would exceed maxItems (US2.4)', async () => {
		const user = userEvent.setup();
		renderKeyValue({ maxItems: 2 });

		await openField(user, 0, 'key');
		await user.paste('A=1\nB=2\nC=3\nD=4');

		await vi.waitFor(() => expect(rows()).toHaveLength(2));
		expect(screen.getByTestId('add')).toBeDisabled();
	});

	it('leaves a single-line paste to the browser (US2.5)', async () => {
		const user = userEvent.setup();
		const onPaste = vi.fn();
		let pasteEvent: ClipboardEvent | undefined;
		renderKeyValue({
			onPaste,
			onKeyInputPaste: (event) => {
				pasteEvent = event;
			}
		});

		const keyControl = await openField(user, 0, 'key');
		await user.paste('SINGLE=line');

		expect(rows()).toHaveLength(1);
		expect(pasteEvent?.defaultPrevented).toBe(false);
		expect(onPaste).not.toHaveBeenCalled();
		expect(keyControl).toHaveValue('SINGLE=line');
	});

	it('leaves a multi-line paste alone when enablePaste is off (US2.6)', async () => {
		const user = userEvent.setup();
		const onPaste = vi.fn();
		renderKeyValue({ enablePaste: false, onPaste });

		await openField(user, 0, 'key');
		await user.paste('A=1\nB=2');

		expect(rows()).toHaveLength(1);
		expect(onPaste).not.toHaveBeenCalled();
	});

	it('lets the caller preventDefault the built-in handling', async () => {
		const user = userEvent.setup();
		const onPaste = vi.fn();
		renderKeyValue({
			onPaste,
			onKeyInputPaste: (event) => {
				event.preventDefault();
			}
		});

		await openField(user, 0, 'key');
		await user.paste('A=1\nB=2');

		expect(rows()).toHaveLength(1);
		expect(onPaste).not.toHaveBeenCalled();
	});

	it('reports an intercepted paste once, with the event and the parsed rows (FR-019)', async () => {
		const user = userEvent.setup();
		const onPaste = vi.fn();
		renderKeyValue({ onPaste });

		await openField(user, 0, 'key');
		await user.paste('A=1\nB=2');

		await vi.waitFor(() => expect(rows()).toHaveLength(2));
		expect(onPaste).toHaveBeenCalledTimes(1);
		expect(onPaste.mock.lastCall?.[0]).toBeInstanceOf(Event);
		expect(onPaste.mock.lastCall?.[1]).toEqual([
			{ id: expect.any(String), key: 'A', value: '1' },
			{ id: expect.any(String), key: 'B', value: '2' }
		]);
	});

	it('moves focus into the last inserted row', async () => {
		const user = userEvent.setup();
		renderKeyValue();

		await openField(user, 0, 'key');
		await user.paste('A=1\nB=2\nC=3');

		await vi.waitFor(() => expect(rows()).toHaveLength(3));
		await waitForActiveField(2, 'key');
		expect(control(2, 'key')).toHaveValue('C');
	});
});

// ---------------------------------------------------------------------------
// T010 — validation, duplicates, guard rails and forms (FR-007 … FR-012)
// ---------------------------------------------------------------------------

describe('KeyValue validation', () => {
	it('shows a key error and a value error independently of each other (US3.1, US3.2)', async () => {
		const user = userEvent.setup();
		renderKeyValue({
			defaultValue: [{ id: '1', key: '', value: '' }],
			onKeyValidate: (key) => (/^[A-Z_]+$/.test(key) ? undefined : 'Must be uppercase'),
			onValueValidate: (value) => (value.length >= 3 ? undefined : 'Too short')
		});

		await typeField(user, 0, 'value', 'ab');

		await vi.waitFor(() => expect(screen.getByTestId('value-error')).toBeInTheDocument());
		expect(screen.getByTestId('value-error')).toHaveTextContent('Too short');
		// The key is empty and its validator rejects it, so both errors coexist on the same row.
		expect(screen.getByTestId('key-error')).toHaveTextContent('Must be uppercase');

		await typeField(user, 0, 'key', 'GOOD');
		await typeField(user, 0, 'value', 'long enough');

		await vi.waitFor(() => expect(screen.queryByTestId('key-error')).not.toBeInTheDocument());
		expect(screen.queryByTestId('value-error')).not.toBeInTheDocument();
	});

	it('flags the later occurrence of a duplicate non-empty key (US3.3)', async () => {
		const user = userEvent.setup();
		renderKeyValue({
			defaultValue: [
				{ id: '1', key: 'API_KEY', value: 'a' },
				{ id: '2', key: '', value: '' }
			]
		});

		await typeField(user, 1, 'key', 'API_KEY');

		const errors = await screen.findAllByRole('alert');
		expect(errors).toHaveLength(1);
		expect(errors[0]).toHaveTextContent('Duplicate key');
		expect(row(1)).toContainElement(errors[0]);
	});

	it('never collides two empty keys', async () => {
		const user = userEvent.setup();
		renderKeyValue({
			defaultValue: [
				{ id: '1', key: '', value: '' },
				{ id: '2', key: '', value: '' }
			]
		});

		await typeField(user, 1, 'key', 'X');
		await typeField(user, 1, 'key', '');

		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('suppresses the duplicate check when allowDuplicateKeys is set (US3.4)', async () => {
		const user = userEvent.setup();
		renderKeyValue({
			allowDuplicateKeys: true,
			defaultValue: [
				{ id: '1', key: 'API_KEY', value: 'a' },
				{ id: '2', key: '', value: '' }
			]
		});

		await typeField(user, 1, 'key', 'API_KEY');

		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('marks the whole list invalid while any row errors, and valid again once it clears (US3.5)', async () => {
		const user = userEvent.setup();
		renderKeyValue({
			defaultValue: [{ id: '1', key: '', value: '' }],
			onKeyValidate: (key) => (key === 'BAD' ? 'Bad key' : undefined)
		});

		expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');

		await typeField(user, 0, 'key', 'BAD');
		await vi.waitFor(() => expect(screen.getByTestId('root')).toHaveAttribute('data-invalid', ''));

		await typeField(user, 0, 'key', 'GOOD');
		await vi.waitFor(() => expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid'));
	});
});

describe('KeyValue guard rails', () => {
	it('keeps values visible but every interaction inert while disabled (FR-010)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderKeyValue({ defaultValue: [THREE_ROWS[0]], disabled: true, onValueChange });

		expect(preview(0, 'key')).toHaveTextContent('ALPHA');
		expect(preview(0, 'value')).toHaveTextContent('one');
		expect(preview(0, 'key')).toHaveAttribute('aria-disabled', 'true');

		await user.click(preview(0, 'key') as HTMLElement);

		expect(control(0, 'key')).toBeNull();
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('keeps values visible and refuses edits and pastes while read-only (FR-010)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onPaste = vi.fn();
		renderKeyValue({ defaultValue: [THREE_ROWS[0]], readOnly: true, onValueChange, onPaste });

		// A read-only `editable` renders its control permanently and inert, so the value stays visible.
		const keyControl = control(0, 'key') as HTMLInputElement;
		expect(keyControl).toHaveValue('ALPHA');
		expect(keyControl).toHaveAttribute('readonly');

		keyControl.focus();
		await user.paste('A=1\nB=2');

		expect(rows()).toHaveLength(1);
		expect(onPaste).not.toHaveBeenCalled();
		expect(onValueChange).not.toHaveBeenCalled();
		expect(screen.getByTestId('add')).toBeDisabled();
		expect(screen.getByTestId('remove')).toBeDisabled();
	});

	it('makes only the field that opts out inert, leaving its siblings interactive (FR-010)', async () => {
		const user = userEvent.setup();
		renderKeyValue({ defaultValue: [THREE_ROWS[0]], keyDisabled: true });

		await user.click(preview(0, 'key') as HTMLElement);
		expect(control(0, 'key')).toBeNull();

		const valueControl = await openField(user, 0, 'value');
		expect(valueControl).toBeInTheDocument();
		expect(screen.getByTestId('remove')).toBeEnabled();
	});

	it("OR-s a per-field required with the root's (FR-011)", async () => {
		const user = userEvent.setup();
		const { unmount } = renderKeyValue({ defaultValue: [THREE_ROWS[0]], required: true });

		expect(await openField(user, 0, 'key')).toBeRequired();
		expect(await openField(user, 0, 'value')).toBeRequired();
		unmount();

		renderKeyValue({ defaultValue: [THREE_ROWS[0]], keyRequired: true });
		expect(await openField(user, 0, 'key')).toBeRequired();
		expect(await openField(user, 0, 'value')).not.toBeRequired();
	});

	it("caps the value field's height at maxRows and lets it scroll (FR-018)", async () => {
		const user = userEvent.setup();
		renderKeyValue({ defaultValue: [THREE_ROWS[0]], maxRows: 3 });

		const valueControl = await openField(user, 0, 'value');

		// jsdom folds the `3 * 1.5em` the component writes into `4.5em` as it parses the declaration.
		expect(valueControl.getAttribute('style')).toMatch(/max-height:\s*calc\([^)]*1rem\)/);
		expect(valueControl).toHaveClass('overflow-y-auto');
	});

	it('leaves the value field uncapped with no maxRows', async () => {
		const user = userEvent.setup();
		renderKeyValue({ defaultValue: [THREE_ROWS[0]] });

		const valueControl = await openField(user, 0, 'value');

		expect(valueControl).not.toHaveClass('overflow-y-auto');
		expect(valueControl.getAttribute('style')).toBeNull();
	});
});

describe('KeyValue in a form', () => {
	function form(): HTMLFormElement {
		return screen.getByTestId('form') as HTMLFormElement;
	}

	it('submits the rows as JSON under its name (FR-012)', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderKeyValue({
			mode: 'with-form',
			name: 'env',
			defaultValue: [THREE_ROWS[0]],
			onValueChange
		});

		expect(new FormData(form()).get('env')).toBe(JSON.stringify([THREE_ROWS[0]]));

		await user.click(screen.getByTestId('add'));
		await vi.waitFor(() => expect(rows()).toHaveLength(2));

		// The appended row's id is minted internally, so the expectation is the list the component
		// itself reported — the point being that the form value is that list, serialised as JSON.
		expect(new FormData(form()).get('env')).toBe(JSON.stringify(onValueChange.mock.lastCall?.[0]));
	});

	it('produces no form entry when no name is given', () => {
		renderKeyValue({ mode: 'with-form', defaultValue: [THREE_ROWS[0]] });

		expect(new FormData(form()).get('env')).toBeNull();
		expect(bySlot('key-value-form-input')).not.toHaveAttribute('name');
	});

	it('renders no form control at all outside a form', () => {
		renderKeyValue({ defaultValue: [THREE_ROWS[0]], name: 'env' });

		expect(queryBySlot('key-value-form-input')).toBeNull();
	});

	it('marks the submitted control disabled, required and read-only with the root', () => {
		renderKeyValue({
			mode: 'with-form',
			name: 'env',
			required: true,
			disabled: true,
			readOnly: true
		});

		const formInput = bySlot('key-value-form-input');
		expect(formInput).toBeDisabled();
		expect(formInput).toBeRequired();
		expect(formInput).toHaveAttribute('readonly');
	});
});

// ---------------------------------------------------------------------------
// T027 — the value field forwards the caller's own event handlers
// ---------------------------------------------------------------------------

describe('KeyValue value field event forwarding', () => {
	it("runs a caller's oninput on every keystroke (contracts: KeyValue.ValueInput)", async () => {
		const user = userEvent.setup();
		const oninput = vi.fn();
		renderKeyValue({
			defaultValue: [{ id: '1', key: 'ALPHA', value: '' }],
			onValueInputInput: oninput
		});

		const valueControl = await openField(user, 0, 'value');
		await user.type(valueControl, 'abc');

		expect(oninput).toHaveBeenCalledTimes(3);
		expect(oninput.mock.lastCall?.[0]).toBeInstanceOf(Event);
		// The caller's handler runs *before* `editable`'s, so it never suppresses the write.
		expect(valueControl).toHaveValue('abc');
	});

	it("lets a caller's onkeydown see Enter", async () => {
		const user = userEvent.setup();
		const onkeydown = vi.fn();
		renderKeyValue({
			defaultValue: [THREE_ROWS[0]],
			onValueInputKeydown: onkeydown
		});

		await openField(user, 0, 'value');
		await user.keyboard('{Enter}');

		const keys = onkeydown.mock.calls.map((call) => (call[0] as KeyboardEvent).key);
		expect(keys).toContain('Enter');
	});

	it("runs a caller's onblur when the field is left", async () => {
		const user = userEvent.setup();
		const onblur = vi.fn();
		renderKeyValue({ defaultValue: [THREE_ROWS[0]], onValueInputBlur: onblur });

		await openField(user, 0, 'value');
		await user.click(screen.getByTestId('outside'));

		expect(onblur).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// T028 — the value field's ARIA wiring (FR-007, SC-004)
// ---------------------------------------------------------------------------

describe('KeyValue value field ARIA', () => {
	it('wires a value error to both the value control and its preview (SC-004)', async () => {
		const user = userEvent.setup();
		renderKeyValue({
			defaultValue: [{ id: '1', key: 'ALPHA', value: '' }],
			onValueValidate: (value) => (value === 'BAD' ? 'Bad value' : undefined)
		});

		const valueControl = await typeField(user, 0, 'value', 'BAD');

		const error = await screen.findByTestId('value-error');
		expect(error).toHaveAttribute('role', 'alert');
		expect(error).toHaveAttribute('data-field', 'value');
		expect(valueControl).toHaveAttribute('aria-invalid', 'true');
		expect(valueControl).toHaveAttribute('aria-describedby', error.id);

		// The association has to survive the field leaving edit mode, which is when only the preview
		// is in the accessibility tree.
		await user.click(screen.getByTestId('outside'));
		await vi.waitFor(() => expect(preview(0, 'value')).not.toBeNull());
		expect(preview(0, 'value')).toHaveAttribute('aria-invalid', 'true');
		expect(preview(0, 'value')).toHaveAttribute('aria-describedby', error.id);
	});

	it('stops marking the value field invalid once it validates', async () => {
		const user = userEvent.setup();
		renderKeyValue({
			defaultValue: [{ id: '1', key: 'ALPHA', value: '' }],
			onValueValidate: (value) => (value === 'BAD' ? 'Bad value' : undefined)
		});

		await typeField(user, 0, 'value', 'BAD');
		expect(await screen.findByTestId('value-error')).toBeInTheDocument();

		const valueControl = await typeField(user, 0, 'value', 'GOOD');

		await vi.waitFor(() => expect(screen.queryByTestId('value-error')).not.toBeInTheDocument());
		// `aria-invalid` is a tri-state string attribute, and `editable` always emits it on its
		// control, so a valid field reads `"false"` rather than dropping the attribute; the
		// description, which only exists while there is an error to point at, does disappear.
		expect(valueControl).not.toHaveAttribute('aria-invalid', 'true');
		expect(valueControl).not.toHaveAttribute('aria-describedby');

		await user.click(screen.getByTestId('outside'));
		await vi.waitFor(() => expect(preview(0, 'value')).not.toBeNull());
		expect(preview(0, 'value')).not.toHaveAttribute('aria-invalid', 'true');
		expect(preview(0, 'value')).not.toHaveAttribute('aria-describedby');
	});
});

// ---------------------------------------------------------------------------
// T029 — `enablePaste` gates the caller's handler too (upstream `key-value.tsx:481-484`)
// ---------------------------------------------------------------------------

describe('KeyValue paste handler ordering', () => {
	it("never runs the caller's onpaste while enablePaste is off", async () => {
		const user = userEvent.setup();
		const onKeyInputPaste = vi.fn();
		renderKeyValue({ enablePaste: false, onKeyInputPaste });

		await openField(user, 0, 'key');
		await user.paste('A=1\nB=2');

		expect(onKeyInputPaste).not.toHaveBeenCalled();
		expect(rows()).toHaveLength(1);
	});

	it("runs the caller's onpaste ahead of the built-in row splitting", async () => {
		const user = userEvent.setup();
		let rowsWhenCalled: number | undefined;
		renderKeyValue({
			onKeyInputPaste: () => {
				rowsWhenCalled = rows().length;
			}
		});

		await openField(user, 0, 'key');
		await user.paste('A=1\nB=2');

		await vi.waitFor(() => expect(rows()).toHaveLength(2));
		expect(rowsWhenCalled).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// T030 — the whole list is buildable without a pointer (SC-001)
// ---------------------------------------------------------------------------

describe('KeyValue with the keyboard alone', () => {
	it('builds five rows and prunes one without a single pointer event (SC-001)', async () => {
		const user = userEvent.setup();
		renderKeyValue({ defaultValue: [{ id: '1', key: '', value: '' }] });

		/** Walk the remaining stops of row `index` — value field, remove — out to the add button. */
		async function tabOutToAdd(index: number) {
			await user.tab();
			await waitForActiveField(index, 'value');
			await user.tab();
			expect(screen.getAllByTestId('remove')[index]).toHaveFocus();
			await user.tab();
			expect(screen.getByTestId('add')).toHaveFocus();
		}

		await user.tab();
		await waitForActiveField(0, 'key');
		await user.keyboard('API_KEY');
		await tabOutToAdd(0);

		// `Enter` and `Space` both activate the add button, and each activation appends a row whose
		// key field takes focus already in edit mode — so the next key is typed straight into it.
		for (const activation of ['{Enter}', ' ', '{Enter}', ' ']) {
			const appendedIndex = rows().length;

			await user.keyboard(activation);

			await vi.waitFor(() => expect(rows()).toHaveLength(appendedIndex + 1));
			await waitForActiveField(appendedIndex, 'key');
			await user.keyboard(`KEY_${appendedIndex}`);
			await tabOutToAdd(appendedIndex);
		}

		expect(rows()).toHaveLength(5);
		expect(preview(4, 'key')).toHaveTextContent('KEY_4');

		// Shift+Tab from the add button lands on the last row's remove control; activating it from
		// the keyboard removes that row and hands focus to the previous row's key field (US1.3).
		await user.tab({ shift: true });
		expect(screen.getAllByTestId('remove')[4]).toHaveFocus();

		await user.keyboard('{Enter}');

		await vi.waitFor(() => expect(rows()).toHaveLength(4));
		await waitForActiveField(3, 'key');
	});
});
