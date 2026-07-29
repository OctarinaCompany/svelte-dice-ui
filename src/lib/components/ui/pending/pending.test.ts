import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import * as Pending from './index.js';
import Harness from './pending.test.svelte';

describe('roles, ARIA and accessible name (S1)', () => {
	it('exposes aria-busy, aria-disabled and data-pending on the child while pending, without clobbering its own data-slot', async () => {
		const { rerender } = render(Harness, {
			props: { useWrapperChild: true, isPending: true }
		});

		const button = screen.getByRole('button', { name: 'Submit' });
		expect(button).toHaveAttribute('aria-busy', 'true');
		expect(button).toHaveAttribute('aria-disabled', 'true');
		expect(button).toHaveAttribute('data-pending', '');
		expect(button).toHaveAttribute('data-slot', 'button');
		expect(button).not.toHaveAttribute('disabled');
		expect(button).not.toHaveAttribute('tabindex');

		await rerender({ useWrapperChild: true, isPending: false });

		const idleButton = screen.getByRole('button', { name: 'Submit' });
		expect(idleButton).not.toHaveAttribute('aria-busy');
		expect(idleButton).not.toHaveAttribute('aria-disabled');
		expect(idleButton).not.toHaveAttribute('data-pending');
	});
});

describe('pointer prevention (S2)', () => {
	it.each(['pointerdown', 'pointerup', 'mousedown', 'mouseup'] as const)(
		'prevents the default of a cancelable %s event while pending',
		(eventType) => {
			render(Harness, { props: { isPending: true } });
			const button = screen.getByRole('button', { name: 'Submit' });

			const event = new Event(eventType, { bubbles: true, cancelable: true });
			button.dispatchEvent(event);

			expect(event.defaultPrevented).toBe(true);
		}
	);

	it('never calls a click handler spread before pendingProps while pending', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		render(Harness, { props: { isPending: true, onclick } });
		const button = screen.getByRole('button', { name: 'Submit' });

		await user.click(button);

		expect(onclick).not.toHaveBeenCalled();

		const event = new Event('click', { bubbles: true, cancelable: true });
		button.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	});
});

describe('keyboard prevention and focus retention (S3)', () => {
	it('keeps the element focusable and prevents only Enter/Space while pending', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		render(Harness, { props: { isPending: true, onclick } });
		const button = screen.getByRole('button', { name: 'Submit' });

		await user.tab();
		expect(button).toHaveFocus();

		await user.keyboard('{Enter}');
		await user.keyboard(' ');
		expect(onclick).not.toHaveBeenCalled();
		expect(button).toHaveFocus();

		for (const key of [
			'{ArrowLeft}',
			'{ArrowRight}',
			'{ArrowUp}',
			'{ArrowDown}',
			'{Home}',
			'{End}',
			'{Escape}'
		]) {
			await user.keyboard(key);
		}
		expect(button).toHaveFocus();

		await user.tab();
		expect(button).not.toHaveFocus();
	});
});

describe('form submission prevention (S1, SC-002, FR-004)', () => {
	it('prevents form submission via click and Enter while pending, and submits once idle', async () => {
		const user = userEvent.setup();
		const onsubmit = vi.fn();
		const { rerender } = render(Harness, { props: { useForm: true, isPending: true, onsubmit } });

		const submitButton = screen.getByRole('button', { name: 'Submit' });
		await user.click(submitButton);
		expect(onsubmit).not.toHaveBeenCalled();

		const textInput = screen.getByRole('textbox');
		await user.click(textInput);
		await user.keyboard('{Enter}');
		expect(onsubmit).not.toHaveBeenCalled();

		await rerender({ useForm: true, isPending: false, onsubmit });
		await user.type(screen.getByRole('textbox'), 'ok');
		await user.click(screen.getByRole('button', { name: 'Submit' }));
		expect(onsubmit).toHaveBeenCalledOnce();
	});
});

describe('idle spread safety (S4)', () => {
	it('fires a click handler spread last exactly once when not pending', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		render(Harness, { props: { isPending: false, onclick } });

		await user.click(screen.getByRole('button', { name: 'Submit' }));

		expect(onclick).toHaveBeenCalledOnce();
	});
});

describe('wrapper merge mode (S5, W-05)', () => {
	it('renders exactly one button with both its own and the pending attributes, no wrapper node', () => {
		const { container } = render(Harness, { props: { useWrapperChild: true, isPending: true } });

		expect(container.querySelectorAll('button')).toHaveLength(1);
		const button = screen.getByRole('button', { name: 'Submit' });
		expect(button).toHaveAttribute('data-slot', 'button');
		expect(button).toHaveAttribute('aria-busy', 'true');
	});

	it('produces the same id/aria-*/data-* attribute set via usePending, child mode and fallback mode', () => {
		const shared = { isPending: true, disabled: true, id: 'shared-id' };

		function attrs(element: Element) {
			return Array.from(element.attributes)
				.filter(({ name }) => name === 'id' || name.startsWith('aria-') || name.startsWith('data-'))
				.filter(({ name }) => name !== 'data-slot')
				.map(({ name, value }) => `${name}=${value}`)
				.sort();
		}

		const hook = render(Harness, { props: { ...shared } });
		const hookButton = within(hook.container).getByRole('button', { name: 'Submit' });

		const child = render(Harness, { props: { ...shared, useWrapperChild: true } });
		const childButton = within(child.container).getByRole('button', { name: 'Submit' });

		const fallback = render(Harness, { props: { ...shared, useWrapperChildren: true } });
		const fallbackSpan = fallback.container.querySelector('[data-slot="pending"]') as HTMLElement;

		expect(attrs(childButton)).toEqual(attrs(hookButton));
		expect(attrs(fallbackSpan)).toEqual(attrs(hookButton));
	});
});

describe('wrapper fallback mode (S6)', () => {
	it('hosts the attributes on a single contents span and suppresses the descendant interaction', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		const { container, rerender } = render(Harness, {
			props: { useWrapperChildren: true, isPending: true, onclick }
		});

		const spans = container.querySelectorAll('[data-slot="pending"]');
		expect(spans).toHaveLength(1);
		const span = spans[0] as HTMLElement;
		expect(span.tagName).toBe('SPAN');
		expect(span.classList.contains('contents')).toBe(true);
		expect(span).toHaveAttribute('aria-busy', 'true');
		expect(span).toHaveAttribute('aria-disabled', 'true');

		const button = screen.getByRole('button', { name: 'Submit' });
		expect(button).not.toHaveAttribute('data-slot', 'pending');
		expect(button).not.toHaveAttribute('aria-busy');
		expect(button).not.toHaveAttribute('aria-disabled');

		await user.click(button);
		expect(onclick).not.toHaveBeenCalled();

		await rerender({ useWrapperChildren: true, isPending: false, onclick });
		await user.click(screen.getByRole('button', { name: 'Submit' }));
		expect(onclick).toHaveBeenCalledOnce();
	});
});

describe('link and switch composition (S7)', () => {
	it('prevents navigation on a pending link while keeping href and focus', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		render(Harness, { props: { useLink: true, isPending: true, onclick } });

		const link = screen.getByRole('link', { name: 'Go' });
		expect(link).toHaveAttribute('href', '/x');

		await user.click(link);
		expect(onclick).not.toHaveBeenCalled();

		await user.tab();
		expect(link).toHaveFocus();
	});

	it('prevents toggling a pending switch while exposing data-pending, and toggles when idle', async () => {
		const user = userEvent.setup();
		const { rerender } = render(Harness, {
			props: { useSwitch: true, isPending: true, switchChecked: false }
		});

		const toggle = screen.getByRole('switch');
		expect(toggle).toHaveAttribute('data-pending', '');
		await user.click(toggle);
		expect(toggle).toHaveAttribute('aria-checked', 'false');

		await rerender({ useSwitch: true, isPending: false, switchChecked: false });
		const idleToggle = screen.getByRole('switch');
		expect(idleToggle).not.toHaveAttribute('data-pending');
		await user.click(idleToggle);
		expect(idleToggle).toHaveAttribute('aria-checked', 'true');
	});

	it('keeps a pending input focusable and typable while it carries aria-busy and data-pending', async () => {
		const user = userEvent.setup();
		render(Harness, { props: { useInput: true, isPending: true } });

		const input = screen.getByRole('textbox');
		expect(input).toHaveAttribute('aria-busy', 'true');
		expect(input).toHaveAttribute('data-pending', '');

		await user.tab();
		expect(input).toHaveFocus();

		await user.keyboard('hello');
		expect(input).toHaveValue('hello');
	});
});

describe('controlled/uncontrolled (S8)', () => {
	it('never shows pending attributes when isPending is omitted, and never changes on its own', async () => {
		const user = userEvent.setup();
		render(Harness, {});

		const button = screen.getByRole('button', { name: 'Submit' });
		expect(button).not.toHaveAttribute('aria-busy');
		expect(button).not.toHaveAttribute('data-pending');

		await user.click(button);
		expect(button).not.toHaveAttribute('aria-busy');
	});

	it('moves the pending attributes on rerender without remount, and never changes on its own', async () => {
		const { rerender } = render(Harness, { props: { isPending: false } });
		const button = screen.getByRole('button', { name: 'Submit' });
		expect(button).not.toHaveAttribute('data-pending');

		await rerender({ isPending: true });
		expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('data-pending', '');
		expect(screen.getByRole('button', { name: 'Submit' })).toBe(button);
	});
});

describe('disabled independence (S9, US3)', () => {
	it('shows only data-disabled when disabled is true and isPending is false, and clicks fire normally', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		render(Harness, { props: { disabled: true, isPending: false, onclick } });

		const button = screen.getByRole('button', { name: 'Submit' });
		expect(button).toHaveAttribute('data-disabled', '');
		expect(button).not.toHaveAttribute('data-pending');
		expect(button).not.toHaveAttribute('aria-busy');
		expect(button).not.toHaveAttribute('aria-disabled');

		await user.click(button);
		expect(onclick).toHaveBeenCalledOnce();
	});

	it('shows both attributes and prevents interaction when both disabled and pending are true', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		render(Harness, { props: { disabled: true, isPending: true, onclick } });

		const button = screen.getByRole('button', { name: 'Submit' });
		expect(button).toHaveAttribute('data-disabled', '');
		expect(button).toHaveAttribute('data-pending', '');

		await user.click(button);
		expect(onclick).not.toHaveBeenCalled();
	});
});

describe('id generation (S10, FR-007)', () => {
	it('uses an explicit id verbatim', () => {
		render(Harness, { props: { id: 'explicit-id' } });
		expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('id', 'explicit-id');
	});

	it('generates a stable pending-<n> id when omitted, unchanged across a rerender', async () => {
		const { rerender } = render(Harness, { props: { isPending: false } });
		const button = screen.getByRole('button', { name: 'Submit' });
		const generatedId = button.getAttribute('id');
		expect(generatedId).toMatch(/^pending-/);

		await rerender({ isPending: true });
		expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('id', generatedId!);
	});

	it('assigns different ids to two separate instances', () => {
		render(Harness, {});
		render(Harness, {});
		const buttons = screen.getAllByRole('button', { name: 'Submit' });
		const ids = buttons.map((button) => button.getAttribute('id'));
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('falls back to $props.id() on the wrapper when id is omitted', () => {
		render(Harness, { props: { useWrapperChild: true, isPending: false } });
		expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('id');
	});
});

describe('RTL (S11, FR-011)', () => {
	it('produces identical attributes and prevention behaviour under dir="rtl"', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		render(Harness, { props: { dir: 'rtl', isPending: true, onclick } });

		const button = screen.getByRole('button', { name: 'Submit' });
		expect(button).toHaveAttribute('aria-busy', 'true');
		expect(button).toHaveAttribute('data-pending', '');

		await user.click(button);
		expect(onclick).not.toHaveBeenCalled();

		await user.tab();
		expect(button).toHaveFocus();
		await user.keyboard('{ArrowLeft}');
		await user.keyboard('{ArrowRight}');
		expect(button).toHaveFocus();
	});
});

describe('guard rail: missing child (S12, W-06, W-07)', () => {
	it('throws a documented error when neither child nor children is supplied', () => {
		expect(() => render(Pending.Root, { props: { isPending: true } })).toThrow(
			/requires exactly one child/
		);
	});

	it('renders only the child snippet output when both child and children are supplied', () => {
		render(Harness, { props: { useBothChildren: true } });

		expect(screen.getByTestId('child-wins')).toBeInTheDocument();
		expect(screen.queryByTestId('children-loses')).not.toBeInTheDocument();
	});
});

describe('barrel surface (S13)', () => {
	it('exposes Root, the Pending alias, usePending, PendingState and createPendingId', () => {
		expect(Pending.Root).toBeDefined();
		expect(Pending.Pending).toBe(Pending.Root);
		expect(Pending.usePending).toBeDefined();
		expect(Pending.PendingState).toBeDefined();
		expect(Pending.createPendingId).toBeDefined();
	});

	it('yields distinct createPendingId() values on repeated calls', () => {
		const first = Pending.createPendingId();
		const second = Pending.createPendingId();
		expect(first).not.toBe(second);
	});
});
