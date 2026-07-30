import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
	CHECKBOX_GROUP_ORIENTATIONS,
	getDataState,
	toValidationMessage,
	type CheckboxGroupValidationResult
} from './index.js';
import Harness, { type CheckboxGroupHarnessProps } from './checkbox-group.test.svelte';

function renderGroup(props: CheckboxGroupHarnessProps = {}) {
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

/** The hidden native checkbox belonging to the item whose `value` is `itemValue`. */
function inputFor(itemValue: string): HTMLInputElement {
	const input = document.querySelector<HTMLInputElement>(
		`input[data-slot="checkbox-group-item-input"][value="${itemValue}"]`
	);
	if (!input) throw new Error(`no hidden input was rendered for "${itemValue}"`);
	return input;
}

/**
 * Every id referenced by `attribute` on `element`, and whether each one resolves to a rendered
 * element — the shape `axe`'s `aria-valid-attr-value` rule checks (research R-08).
 */
function idrefs(element: HTMLElement, attribute: 'aria-labelledby' | 'aria-describedby') {
	const raw = element.getAttribute(attribute);
	if (raw === null) return { raw, ids: [] as string[], allResolve: true };
	const ids = raw.split(/\s+/).filter(Boolean);
	return { raw, ids, allResolve: ids.every((id) => document.getElementById(id) !== null) };
}

function checkbox(name: string): HTMLElement {
	return screen.getByRole('checkbox', { name });
}

// ---------------------------------------------------------------------------
// T006 — roles, names and ARIA wiring (quickstart V-1, V-2, V-9)
// ---------------------------------------------------------------------------

describe('CheckboxGroup accessibility (T006, V-1/V-2/V-9)', () => {
	it('exposes the pure helpers the parts derive their attributes from', () => {
		expect(CHECKBOX_GROUP_ORIENTATIONS).toEqual(['vertical', 'horizontal']);
		expect(getDataState(true)).toBe('checked');
		expect(getDataState(false)).toBe('unchecked');
		expect(toValidationMessage('Too many')).toBe('Too many');
		expect(toValidationMessage(['a', 'b'])).toBe('a b');
		expect(toValidationMessage(undefined)).toBeUndefined();
	});

	it('names the group from its label and exposes the documented roles', () => {
		renderGroup();

		const group = screen.getByRole('group', { name: 'Favorite tricks' });
		expect(group).toHaveAttribute('data-slot', 'checkbox-group');
		expect(screen.getByText('Select your favorite tricks')).toBeInTheDocument();

		const checkboxes = screen.getAllByRole('checkbox');
		expect(checkboxes).toHaveLength(3);
		for (const item of checkboxes) {
			expect(item).toHaveAttribute('type', 'button');
			expect(item).toHaveAttribute('aria-checked', 'false');
			expect(item).toHaveAttribute('aria-disabled', 'false');
			expect(item).toHaveAttribute('data-state', 'unchecked');
		}
	});

	it('defaults both orientation attributes to vertical on the group, list and items', () => {
		renderGroup();

		const group = screen.getByRole('group', { name: 'Favorite tricks' });
		expect(group).toHaveAttribute('aria-orientation', 'vertical');
		expect(group).toHaveAttribute('data-orientation', 'vertical');
		expect(bySlot('checkbox-group-list')).toHaveAttribute('data-orientation', 'vertical');
		for (const item of allBySlot('checkbox-group-item')) {
			expect(item).toHaveAttribute('data-orientation', 'vertical');
		}
	});

	it('points aria-labelledby and aria-describedby only at rendered ids', () => {
		renderGroup();

		const group = screen.getByRole('group', { name: 'Favorite tricks' });
		const labelledBy = idrefs(group, 'aria-labelledby');
		const describedBy = idrefs(group, 'aria-describedby');

		expect(labelledBy.ids).toEqual([bySlot('checkbox-group-label').id]);
		expect(describedBy.ids).toEqual([bySlot('checkbox-group-description').id]);
		expect(labelledBy.allResolve).toBe(true);
		expect(describedBy.allResolve).toBe(true);
	});

	it('drops aria-describedby entirely when no description or message is rendered', () => {
		renderGroup({ withDescription: false, withMessage: false });

		const group = screen.getByRole('group', { name: 'Favorite tricks' });
		expect(group).not.toHaveAttribute('aria-describedby');
	});

	it('drops aria-labelledby entirely when no label is rendered', () => {
		renderGroup({ withLabel: false });

		const group = screen.getByTestId('root');
		expect(group).not.toHaveAttribute('aria-labelledby');
		expect(idrefs(group, 'aria-describedby').allResolve).toBe(true);
	});

	it('leaves no dangling idref when hideOnError removes the description', async () => {
		const user = userEvent.setup();
		renderGroup({
			descriptionHideOnError: true,
			onValidate: () => 'Indy is not allowed'
		});

		const group = screen.getByRole('group', { name: 'Favorite tricks' });
		expect(idrefs(group, 'aria-describedby').ids).toEqual([
			bySlot('checkbox-group-description').id
		]);

		await user.click(checkbox('Kickflip'));

		expect(screen.queryByTestId('description')).not.toBeInTheDocument();
		const after = idrefs(group, 'aria-describedby');
		expect(after.ids).toEqual([bySlot('checkbox-group-message').id]);
		expect(after.allResolve).toBe(true);
	});

	it('renders no message text for an invalid group whose message has no content', () => {
		renderGroup({ invalid: true });

		const group = screen.getByRole('group', { name: 'Favorite tricks' });
		expect(group).toHaveAttribute('data-invalid', '');
		expect(screen.queryByTestId('message')).not.toBeInTheDocument();
		expect(idrefs(group, 'aria-describedby').allResolve).toBe(true);
	});

	it('describes the description by the label, and omits the idref when no label is rendered', () => {
		const { unmount } = renderGroup();
		expect(bySlot('checkbox-group-description')).toHaveAttribute(
			'aria-describedby',
			bySlot('checkbox-group-label').id
		);
		unmount();

		renderGroup({ withLabel: false });
		expect(bySlot('checkbox-group-description')).not.toHaveAttribute('aria-describedby');
	});
});

// ---------------------------------------------------------------------------
// T007 — keyboard and pointer interaction (quickstart V-6, V-7)
// ---------------------------------------------------------------------------

describe('CheckboxGroup keyboard and pointer (T007, V-6/V-7)', () => {
	it('makes every item its own tab stop, in document order', async () => {
		const user = userEvent.setup();
		renderGroup();
		const checkboxes = screen.getAllByRole('checkbox');

		await user.tab();
		expect(checkboxes[0]).toHaveFocus();
		await user.tab();
		expect(checkboxes[1]).toHaveFocus();
		await user.tab();
		expect(checkboxes[2]).toHaveFocus();
	});

	it('toggles the focused item with Space and keeps focus on it', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderGroup({ onValueChange });

		await user.tab();
		await user.keyboard(' ');
		expect(checkbox('Kickflip')).toHaveAttribute('aria-checked', 'true');
		expect(checkbox('Kickflip')).toHaveFocus();
		expect(onValueChange).toHaveBeenLastCalledWith(['kickflip']);

		await user.keyboard(' ');
		expect(checkbox('Kickflip')).toHaveAttribute('aria-checked', 'false');
		expect(onValueChange).toHaveBeenLastCalledWith([]);
	});

	it('neither toggles nor submits on Enter', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
		const onValueChange = vi.fn();
		renderGroup({ withForm: true, onSubmit, onValueChange });

		await user.tab();
		expect(checkbox('Kickflip')).toHaveFocus();

		await user.keyboard('{Enter}');
		expect(checkbox('Kickflip')).toHaveAttribute('aria-checked', 'false');
		expect(onValueChange).not.toHaveBeenCalled();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('toggles exactly once per click on the indicator glyph', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderGroup({ defaultValue: ['kickflip'], onValueChange });

		const indicator = screen
			.getByTestId('item-kickflip')
			.querySelector<HTMLElement>('[data-slot="checkbox-group-indicator"]');
		expect(indicator).not.toBeNull();
		await user.click(indicator!);

		expect(onValueChange).toHaveBeenCalledTimes(1);
		expect(onValueChange).toHaveBeenCalledWith([]);
		expect(checkbox('Kickflip')).toHaveAttribute('aria-checked', 'false');
	});

	it('checks then unchecks on two sequential clicks of the same item', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderGroup({ onValueChange });

		await user.click(checkbox('Kickflip'));
		expect(checkbox('Kickflip')).toHaveAttribute('aria-checked', 'true');

		await user.click(checkbox('Kickflip'));
		expect(checkbox('Kickflip')).toHaveAttribute('aria-checked', 'false');

		expect(onValueChange).toHaveBeenCalledTimes(2);
		expect(onValueChange).toHaveBeenNthCalledWith(1, ['kickflip']);
		expect(onValueChange).toHaveBeenNthCalledWith(2, []);
	});
});

// ---------------------------------------------------------------------------
// T008 — controlled and uncontrolled (quickstart V-3, V-4, V-5)
// ---------------------------------------------------------------------------

describe('CheckboxGroup value modes (T008, V-3/V-4/V-5)', () => {
	it('seeds itself from defaultValue and moves on its own when uncontrolled', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderGroup({ defaultValue: ['kickflip'], onValueChange });

		expect(checkbox('Kickflip')).toHaveAttribute('aria-checked', 'true');
		expect(checkbox('Heelflip')).toHaveAttribute('aria-checked', 'false');

		await user.click(checkbox('Heelflip'));

		expect(onValueChange).toHaveBeenCalledWith(['kickflip', 'heelflip']);
		expect(checkbox('Kickflip')).toHaveAttribute('aria-checked', 'true');
		expect(checkbox('Heelflip')).toHaveAttribute('aria-checked', 'true');
	});

	it('moves the parent binding and the rendered state together under bind:value', async () => {
		const user = userEvent.setup();
		const onValueBinding = vi.fn();
		renderGroup({ binding: 'value', value: ['kickflip'], onValueBinding });

		expect(checkbox('Kickflip')).toHaveAttribute('aria-checked', 'true');

		await user.click(checkbox('Heelflip'));

		expect(onValueBinding).toHaveBeenLastCalledWith(['kickflip', 'heelflip']);
		expect(checkbox('Heelflip')).toHaveAttribute('aria-checked', 'true');
	});

	it('stays put when an authoritative parent declines the write', async () => {
		const user = userEvent.setup();
		const onDeclinedValue = vi.fn();
		const onValueChange = vi.fn();
		renderGroup({
			binding: 'function',
			authoritative: ['kickflip'],
			onDeclinedValue,
			onValueChange
		});

		expect(checkbox('Kickflip')).toHaveAttribute('aria-checked', 'true');

		await user.click(checkbox('Heelflip'));

		expect(onDeclinedValue).toHaveBeenCalledWith(['kickflip', 'heelflip']);
		expect(onValueChange).toHaveBeenCalledWith(['kickflip', 'heelflip']);
		// The parent never wrote the new value back, so nothing rendered moves.
		expect(checkbox('Heelflip')).toHaveAttribute('aria-checked', 'false');
		expect(checkbox('Kickflip')).toHaveAttribute('aria-checked', 'true');
	});
});

// ---------------------------------------------------------------------------
// T009 — orientation and reading direction (quickstart V-12)
// ---------------------------------------------------------------------------

describe('CheckboxGroup orientation and direction (T009, V-12)', () => {
	it('propagates horizontal orientation to the group, list and every item', () => {
		renderGroup({ orientation: 'horizontal' });

		const group = screen.getByRole('group', { name: 'Favorite tricks' });
		expect(group).toHaveAttribute('data-orientation', 'horizontal');
		expect(group).toHaveAttribute('aria-orientation', 'horizontal');
		expect(bySlot('checkbox-group-list')).toHaveAttribute('data-orientation', 'horizontal');
		for (const item of allBySlot('checkbox-group-item')) {
			expect(item).toHaveAttribute('data-orientation', 'horizontal');
		}
	});

	it('renders an explicit rtl direction and keeps Tab order and Space unchanged', async () => {
		const user = userEvent.setup();
		renderGroup({ dir: 'rtl' });

		expect(screen.getByRole('group', { name: 'Favorite tricks' })).toHaveAttribute('dir', 'rtl');

		const checkboxes = screen.getAllByRole('checkbox');
		await user.tab();
		expect(checkboxes[0]).toHaveFocus();
		await user.tab();
		expect(checkboxes[1]).toHaveFocus();

		await user.keyboard(' ');
		expect(checkbox('Heelflip')).toHaveAttribute('aria-checked', 'true');
	});

	it('resolves rtl from a DirectionProvider ancestor when no dir prop is given', async () => {
		const user = userEvent.setup();
		renderGroup({ providerDir: 'rtl' });

		expect(screen.getByRole('group', { name: 'Favorite tricks' })).toHaveAttribute('dir', 'rtl');

		const checkboxes = screen.getAllByRole('checkbox');
		await user.tab();
		expect(checkboxes[0]).toHaveFocus();

		await user.keyboard(' ');
		expect(checkbox('Kickflip')).toHaveAttribute('aria-checked', 'true');
	});

	it('defaults to ltr with no provider and no dir prop', () => {
		renderGroup();
		expect(screen.getByRole('group', { name: 'Favorite tricks' })).toHaveAttribute('dir', 'ltr');
	});
});

// ---------------------------------------------------------------------------
// T010 — validation, guard rails and native form participation (V-8, V-10, V-11)
// ---------------------------------------------------------------------------

describe('CheckboxGroup validation (T010, V-8)', () => {
	it('drives the invalid state and message from onValidate, and clears it again', async () => {
		const user = userEvent.setup();
		const onValidate = vi.fn((value: string[]): CheckboxGroupValidationResult =>
			value.length > 2 ? 'Maximum 2 items allowed' : true
		);
		renderGroup({ onValidate });

		await user.click(checkbox('Kickflip'));
		await user.click(checkbox('Heelflip'));
		expect(onValidate).toHaveBeenCalledWith(['kickflip', 'heelflip']);
		expect(screen.queryByText('Maximum 2 items allowed')).not.toBeInTheDocument();

		await user.click(checkbox('FS 540'));
		expect(onValidate).toHaveBeenCalledWith(['kickflip', 'heelflip', 'fs-540']);
		expect(screen.getByText('Maximum 2 items allowed')).toBeInTheDocument();

		const group = screen.getByRole('group', { name: 'Favorite tricks' });
		expect(group).toHaveAttribute('data-invalid', '');
		expect(group).toHaveAttribute('aria-invalid', 'true');
		expect(bySlot('checkbox-group-list')).toHaveAttribute('data-invalid', '');
		for (const item of allBySlot('checkbox-group-item')) {
			expect(item).toHaveAttribute('data-invalid', '');
			expect(item).toHaveAttribute('aria-invalid', 'true');
		}

		await user.click(checkbox('FS 540'));
		expect(screen.queryByText('Maximum 2 items allowed')).not.toBeInTheDocument();
		expect(group).not.toHaveAttribute('data-invalid');
		expect(group).toHaveAttribute('aria-invalid', 'false');
	});

	it('joins an array validation message with a single space', async () => {
		const user = userEvent.setup();
		renderGroup({ onValidate: () => ['Pick fewer tricks.', 'Two is the maximum.'] });

		await user.click(checkbox('Kickflip'));

		expect(screen.getByTestId('message')).toHaveTextContent(
			'Pick fewer tricks. Two is the maximum.'
		);
	});

	it('prefers the validation message over the message fallback content', async () => {
		const user = userEvent.setup();
		renderGroup({
			invalid: true,
			messageFallback: 'Pick at least one trick.',
			onValidate: () => 'Kickflip is not allowed'
		});

		expect(screen.getByTestId('message')).toHaveTextContent('Pick at least one trick.');

		await user.click(checkbox('Kickflip'));
		expect(screen.getByTestId('message')).toHaveTextContent('Kickflip is not allowed');
	});
});

describe('CheckboxGroup guard rails (T010, V-10)', () => {
	it('disables every item, keeps it out of the tab order and fires no callback', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderGroup({ disabled: true, onValueChange });

		const checkboxes = screen.getAllByRole('checkbox');
		for (const item of checkboxes) {
			expect(item).toBeDisabled();
			expect(item).toHaveAttribute('aria-disabled', 'true');
			expect(item).toHaveAttribute('data-disabled', '');
		}
		expect(screen.getByRole('group', { name: 'Favorite tricks' })).toHaveAttribute(
			'data-disabled',
			''
		);

		await user.click(checkboxes[0]!);
		expect(onValueChange).not.toHaveBeenCalled();

		await user.tab();
		expect(checkboxes[0]).not.toHaveFocus();
	});

	it('disables a single item without disabling its siblings', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		renderGroup({
			onValueChange,
			items: [
				{ value: 'kickflip', label: 'Kickflip', disabled: true },
				{ value: 'heelflip', label: 'Heelflip' }
			]
		});

		expect(checkbox('Kickflip')).toBeDisabled();
		expect(checkbox('Heelflip')).not.toBeDisabled();

		await user.click(checkbox('Heelflip'));
		expect(onValueChange).toHaveBeenCalledWith(['heelflip']);
	});

	it('leaves a read-only group focusable but unchanged, with no callback', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const onValidate = vi.fn();
		renderGroup({ readOnly: true, defaultValue: ['kickflip'], onValueChange, onValidate });

		const group = screen.getByRole('group', { name: 'Favorite tricks' });
		expect(group).toHaveAttribute('aria-readonly', 'true');
		expect(group).toHaveAttribute('data-readonly', '');
		expect(checkbox('Kickflip')).toHaveAttribute('aria-checked', 'true');

		// Read-only items stay in the tab order — only the value is frozen.
		await user.tab();
		expect(checkbox('Kickflip')).toHaveFocus();

		await user.keyboard(' ');
		expect(checkbox('Kickflip')).toHaveAttribute('aria-checked', 'true');

		await user.click(checkbox('Kickflip'));
		expect(checkbox('Kickflip')).toHaveAttribute('aria-checked', 'true');
		expect(onValueChange).not.toHaveBeenCalled();
		expect(onValidate).not.toHaveBeenCalled();
	});

	it('renders a group with no items without error', () => {
		renderGroup({ items: [] });

		expect(screen.getByRole('group', { name: 'Favorite tricks' })).toBeInTheDocument();
		expect(screen.getByTestId('description')).toBeInTheDocument();
		expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
	});

	it.each([
		['bare-item', '<CheckboxGroup.Item>'],
		['bare-list', '<CheckboxGroup.List>'],
		['bare-label', '<CheckboxGroup.Label>'],
		['bare-description', '<CheckboxGroup.Description>'],
		['bare-message', '<CheckboxGroup.Message>'],
		['bare-indicator', '<CheckboxGroup.Indicator>']
	] as const)('throws when %s is rendered outside its provider', (mode, part) => {
		expect(() => renderGroup({ mode })).toThrow(`\`${part}\` must be used within`);
	});

	it('throws when the indicator is rendered outside an item', () => {
		expect(() => renderGroup({ mode: 'indicator-outside-item' })).toThrow(
			'`<CheckboxGroup.Indicator>` must be used within `<CheckboxGroup.Item>`.'
		);
	});
});

describe('CheckboxGroup native form participation (T010, V-11)', () => {
	it('blocks submission of an empty required group and allows it once an item is checked', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
		renderGroup({ withForm: true, required: true, onSubmit });

		const form = screen.getByTestId('form') as HTMLFormElement;
		const input = inputFor('kickflip');

		expect(input.required).toBe(true);
		expect(input.validity.valueMissing).toBe(true);
		expect(input).not.toHaveAttribute('hidden');
		expect(getComputedStyle(input).display).not.toBe('none');
		expect(form.checkValidity()).toBe(false);

		await user.click(screen.getByRole('button', { name: 'Submit' }));
		expect(onSubmit).not.toHaveBeenCalled();

		await user.click(checkbox('Kickflip'));
		expect(inputFor('kickflip').validity.valueMissing).toBe(false);
		expect(inputFor('heelflip').required).toBe(false);
		expect(form.checkValidity()).toBe(true);

		await user.click(screen.getByRole('button', { name: 'Submit' }));
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	it('submits every checked value under the group name', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
		renderGroup({ withForm: true, name: 'tricks', onSubmit });

		await user.click(checkbox('Kickflip'));
		await user.click(checkbox('FS 540'));

		const form = screen.getByTestId('form') as HTMLFormElement;
		expect(new FormData(form).getAll('tricks')).toEqual(['kickflip', 'fs-540']);
		expect(form.elements.namedItem('tricks')).not.toBeNull();
	});

	it("lets an item's own name override the group name", async () => {
		const user = userEvent.setup();
		renderGroup({
			withForm: true,
			name: 'tricks',
			items: [
				{ value: 'kickflip', label: 'Kickflip' },
				{ value: 'heelflip', label: 'Heelflip', name: 'flips' }
			]
		});

		await user.click(checkbox('Kickflip'));
		await user.click(checkbox('Heelflip'));

		const form = screen.getByTestId('form') as HTMLFormElement;
		const data = new FormData(form);
		expect(data.getAll('tricks')).toEqual(['kickflip']);
		expect(data.getAll('flips')).toEqual(['heelflip']);
	});

	it('restores defaultValue and clears the validation message on form reset', async () => {
		const user = userEvent.setup();
		renderGroup({
			withForm: true,
			withReset: true,
			name: 'tricks',
			defaultValue: ['kickflip'],
			onValidate: (value) => (value.includes('heelflip') ? 'Heelflip is not allowed' : true)
		});

		await user.click(checkbox('Heelflip'));
		expect(screen.getByText('Heelflip is not allowed')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Reset' }));

		expect(screen.queryByText('Heelflip is not allowed')).not.toBeInTheDocument();
		expect(checkbox('Kickflip')).toHaveAttribute('aria-checked', 'true');
		expect(checkbox('Heelflip')).toHaveAttribute('aria-checked', 'false');
		expect(new FormData(screen.getByTestId('form') as HTMLFormElement).getAll('tricks')).toEqual([
			'kickflip'
		]);
	});

	it('keeps the hidden inputs out of the accessibility tree and the tab order', () => {
		renderGroup({ withForm: true, name: 'tricks' });

		const inputs = allBySlot('checkbox-group-item-input');
		expect(inputs).toHaveLength(3);
		for (const input of inputs) {
			expect(input).toHaveAttribute('aria-hidden', 'true');
			expect(input).toHaveAttribute('tabindex', '-1');
		}
		// Only the three buttons are exposed as checkboxes.
		expect(screen.getAllByRole('checkbox')).toHaveLength(3);
	});

	it('hides the input when the group is not inside a form', async () => {
		renderGroup();
		await vi.waitFor(() => {
			expect(inputFor('kickflip')).toHaveAttribute('hidden');
		});
	});
});

// ---------------------------------------------------------------------------
// T010a — indicator presence and live-region announcement
// ---------------------------------------------------------------------------

describe('CheckboxGroup indicator and announcements (T010a)', () => {
	it('mounts the indicator only while the item is checked', async () => {
		const user = userEvent.setup();
		renderGroup();

		const item = screen.getByTestId('item-kickflip');
		expect(item.querySelector('[data-slot="checkbox-group-indicator"]')).toBeNull();

		await user.click(checkbox('Kickflip'));

		const indicator = item.querySelector('[data-slot="checkbox-group-indicator"]');
		expect(indicator).not.toBeNull();
		expect(indicator).toHaveAttribute('data-state', 'checked');
	});

	it('keeps a forceMount indicator mounted while unchecked', async () => {
		const user = userEvent.setup();
		renderGroup({ indicatorForceMount: true });

		const indicator = within(screen.getByTestId('item-kickflip')).getByTestId('indicator');
		expect(indicator).toHaveAttribute('data-state', 'unchecked');

		await user.click(checkbox('Kickflip'));
		expect(indicator).toHaveAttribute('data-state', 'checked');
	});

	it('marks the indicator disabled together with the group', () => {
		renderGroup({ disabled: true, indicatorForceMount: true });

		for (const indicator of allBySlot('checkbox-group-indicator')) {
			expect(indicator).toHaveAttribute('data-disabled', '');
		}
	});

	it('announces the description and message only when asked to', async () => {
		const user = userEvent.setup();
		const { unmount } = renderGroup({ invalid: true, messageFallback: 'Pick a trick.' });
		expect(screen.getByTestId('description')).toHaveAttribute('aria-live', 'off');
		expect(screen.getByTestId('message')).toHaveAttribute('aria-live', 'off');
		unmount();

		renderGroup({
			descriptionAnnounce: true,
			messageAnnounce: true,
			messageFallback: 'Pick a trick.',
			onValidate: () => 'Too many tricks'
		});
		expect(screen.getByTestId('description')).toHaveAttribute('aria-live', 'polite');

		await user.click(checkbox('Kickflip'));
		expect(screen.getByTestId('message')).toHaveAttribute('aria-live', 'polite');
	});

	it('removes and restores a hideOnError description as validity changes', async () => {
		const user = userEvent.setup();
		renderGroup({
			descriptionHideOnError: true,
			onValidate: (value) => (value.includes('kickflip') ? 'Kickflip is not allowed' : true)
		});

		expect(screen.getByTestId('description')).toBeInTheDocument();

		await user.click(checkbox('Kickflip'));
		expect(screen.queryByTestId('description')).not.toBeInTheDocument();

		await user.click(checkbox('Kickflip'));
		expect(screen.getByTestId('description')).toBeInTheDocument();
	});

	it('marks the description and message invalid alongside the group', async () => {
		const user = userEvent.setup();
		renderGroup({ onValidate: () => 'Too many tricks' });

		await user.click(checkbox('Kickflip'));

		expect(screen.getByTestId('description')).toHaveAttribute('data-invalid', '');
		expect(screen.getByTestId('description')).toHaveAttribute('aria-invalid', 'true');
		expect(screen.getByTestId('message')).toHaveAttribute('data-invalid', '');
	});
});

// ---------------------------------------------------------------------------
// T028/T029 — the `required` contract, at group and item level (FR-013, FR-014)
// ---------------------------------------------------------------------------

describe('CheckboxGroup required (T028, T029)', () => {
	it('marks every item required while a required group is empty, and clears them all once any one is checked', async () => {
		const user = userEvent.setup();
		renderGroup({ required: true });

		// A group-level `required` is satisfied by *any* member, so it is advertised on all of them.
		expect(allBySlot('checkbox-group-item')).toHaveLength(3);
		for (const item of allBySlot('checkbox-group-item')) {
			expect(item).toHaveAttribute('aria-required', 'true');
		}

		await user.click(checkbox('Heelflip'));

		for (const item of allBySlot('checkbox-group-item')) {
			expect(item).toHaveAttribute('aria-required', 'false');
		}
	});

	it("honours an item's own required prop in a group that is not required", async () => {
		const user = userEvent.setup();
		renderGroup({
			withForm: true,
			name: 'tricks',
			items: [
				{ value: 'kickflip', label: 'Kickflip', required: true },
				{ value: 'heelflip', label: 'Heelflip' }
			]
		});

		expect(checkbox('Kickflip')).toHaveAttribute('aria-required', 'true');
		expect(inputFor('kickflip').required).toBe(true);
		// An item's `required` is its own — it never leaks onto its siblings.
		expect(checkbox('Heelflip')).toHaveAttribute('aria-required', 'false');
		expect(inputFor('heelflip').required).toBe(false);

		await user.click(checkbox('Kickflip'));

		expect(checkbox('Kickflip')).toHaveAttribute('aria-required', 'false');
		expect(inputFor('kickflip').required).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// T030 — `data-disabled` on the four parts that expose it (FR-011/FR-012/FR-018/FR-019)
// ---------------------------------------------------------------------------

describe('CheckboxGroup disabled data attributes (T030)', () => {
	it('marks the label, list and description disabled alongside the group', () => {
		renderGroup({ disabled: true });

		expect(bySlot('checkbox-group-label')).toHaveAttribute('data-disabled', '');
		expect(bySlot('checkbox-group-list')).toHaveAttribute('data-disabled', '');
		expect(bySlot('checkbox-group-description')).toHaveAttribute('data-disabled', '');
	});

	it('marks the message disabled when a disabled group is also invalid', () => {
		// The message only enters the DOM for an invalid group that has something to say.
		renderGroup({ disabled: true, invalid: true, messageFallback: 'Pick at least one trick.' });

		expect(bySlot('checkbox-group-message')).toHaveAttribute('data-disabled', '');
	});

	it('omits data-disabled on all four parts while the group is enabled', () => {
		renderGroup({ invalid: true, messageFallback: 'Pick at least one trick.' });

		for (const slot of [
			'checkbox-group-label',
			'checkbox-group-list',
			'checkbox-group-description',
			'checkbox-group-message'
		]) {
			expect(bySlot(slot)).not.toHaveAttribute('data-disabled');
		}
	});
});

// ---------------------------------------------------------------------------
// T031 — the hidden input's readOnly mirror (FR-016) and generated item ids (FR-014)
// ---------------------------------------------------------------------------

describe('CheckboxGroup item details (T031)', () => {
	it("mirrors the group's readOnly onto every hidden input", () => {
		const { unmount } = renderGroup({ readOnly: true, withForm: true, name: 'tricks' });

		const inputs = allBySlot('checkbox-group-item-input');
		expect(inputs).toHaveLength(3);
		for (const input of inputs) {
			expect(input).toHaveAttribute('readonly');
		}
		unmount();

		renderGroup({ withForm: true, name: 'tricks' });
		for (const input of allBySlot('checkbox-group-item-input')) {
			expect(input).not.toHaveAttribute('readonly');
		}
	});

	it('gives every item a non-empty id that is unique across the group', () => {
		renderGroup();

		const ids = allBySlot('checkbox-group-item').map((item) => item.id);
		expect(ids).toHaveLength(3);
		for (const id of ids) {
			expect(id).not.toBe('');
		}
		expect(new Set(ids).size).toBe(3);
	});
});
