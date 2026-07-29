import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import * as Status from './index.js';
import {
	STATUS_VARIANTS,
	StatusIndicator,
	StatusLabel,
	resolveStatusVariant,
	statusVariants,
	type StatusVariant
} from './index.js';
import Harness from './status.test.svelte';

/** Children as a snippet — the pattern every ported component's tests use. */
const text = (value: string) => createRawSnippet(() => ({ render: () => `<span>${value}</span>` }));

/** The root's base utilities, verbatim from `contracts/status-public-api.md` §5. */
const BASE_CLASSES = [
	'inline-flex',
	'w-fit',
	'shrink-0',
	'items-center',
	'gap-1.5',
	'overflow-hidden',
	'whitespace-nowrap',
	'rounded-full',
	'border',
	'px-2.5',
	'py-1',
	'text-xs',
	'font-medium',
	'transition-colors'
];

/** The per-variant class rows, verbatim from `contracts/status-public-api.md` §5. */
const VARIANT_CLASSES: Record<StatusVariant, string[]> = {
	default: [
		'border-transparent',
		'bg-muted',
		'text-muted-foreground',
		'**:data-[slot=status-indicator]:bg-muted-foreground'
	],
	success: [
		'border-success/20',
		'bg-success/10',
		'text-success',
		'**:data-[slot=status-indicator]:bg-success'
	],
	error: [
		'border-destructive/20',
		'bg-destructive/10',
		'text-destructive',
		'**:data-[slot=status-indicator]:bg-destructive'
	],
	warning: [
		'border-warning/20',
		'bg-warning/10',
		'text-warning',
		'**:data-[slot=status-indicator]:bg-warning'
	],
	info: ['border-info/20', 'bg-info/10', 'text-info', '**:data-[slot=status-indicator]:bg-info']
};

/** The indicator's pseudo-element classes, verbatim from the contract. */
const INDICATOR_CLASSES = [
	'relative',
	'flex',
	'size-2',
	'shrink-0',
	'rounded-full',
	'before:absolute',
	'before:inset-0',
	'before:animate-ping',
	'before:rounded-full',
	'before:bg-inherit',
	'after:absolute',
	'after:inset-[2px]',
	'after:rounded-full',
	'after:bg-inherit'
];

/** Utilities that would hide the focus ring — none may ever reach a part (Constitution III). */
const FOCUS_SUPPRESSORS = ['outline-none', 'focus:outline-none', 'focus-visible:outline-none'];

/** Every `data-slot` the component renders, in markup order. */
const SLOTS = ['status', 'status-indicator', 'status-label'];

function bySlot(container: HTMLElement, slot: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

describe('Status', () => {
	it('renders a div carrying data-slot="status"', () => {
		const { container } = render(Status.Root, { props: { children: text('Online') } });
		const root = bySlot(container, 'status');

		expect(root.tagName).toBe('DIV');
		expect(root).toHaveAttribute('data-slot', 'status');
	});

	it('renders its children', () => {
		render(Status.Root, { props: { children: text('Online') } });

		expect(screen.getByText('Online')).toBeInTheDocument();
	});

	it('carries every base utility class', () => {
		const { container } = render(Status.Root, { props: { children: text('Online') } });
		const root = bySlot(container, 'status');

		for (const className of BASE_CLASSES) {
			expect(root.classList.contains(className)).toBe(true);
		}
	});

	it("merges the caller's class last so it wins a conflict", () => {
		const { container } = render(Status.Root, {
			props: { class: 'rounded-none', children: text('Online') }
		});
		const root = bySlot(container, 'status');

		expect(root.classList.contains('rounded-none')).toBe(true);
		expect(root.classList.contains('rounded-full')).toBe(false);
	});

	it('forwards restProps onto the rendered element', () => {
		const { container } = render(Status.Root, {
			props: {
				id: 'server-status',
				'aria-label': 'Server status',
				'data-testid': 'status-root',
				children: text('Online')
			}
		});
		const root = bySlot(container, 'status');

		expect(root).toHaveAttribute('id', 'server-status');
		expect(root).toHaveAttribute('aria-label', 'Server status');
		expect(root).toHaveAttribute('data-testid', 'status-root');
	});

	it('fires an onclick handler passed through restProps', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		const { container } = render(Status.Root, { props: { onclick, children: text('Online') } });

		await user.click(bySlot(container, 'status'));

		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('populates every part ref through bind:ref', () => {
		const { container } = render(Harness, { props: {} });

		expect(container.querySelector('[data-testid="ref-report"]')).toHaveTextContent(
			'root:div indicator:div label:div'
		);
	});
});

describe('variants', () => {
	for (const variant of STATUS_VARIANTS) {
		it(`applies the ${variant} data attribute and token classes`, () => {
			const { container } = render(Status.Root, { props: { variant, children: text('Online') } });
			const root = bySlot(container, 'status');

			expect(root).toHaveAttribute('data-variant', variant);
			for (const className of VARIANT_CLASSES[variant]) {
				expect(root.classList.contains(className)).toBe(true);
			}
		});
	}

	it('falls back to the default variant when variant is omitted', () => {
		const { container } = render(Status.Root, { props: { children: text('Online') } });
		const root = bySlot(container, 'status');

		expect(root).toHaveAttribute('data-variant', 'default');
		for (const className of VARIANT_CLASSES.default) {
			expect(root.classList.contains(className)).toBe(true);
		}
	});

	// Status exposes no value, no `disabled`/`readOnly` state and no context provider, so the
	// controlled/uncontrolled, guard-rail and out-of-provider assertions required for stateful
	// ports are not applicable here (plan.md § Constitution Check, Principle III note).
	describe('variant is an input, not internal state', () => {
		it('re-renders with a new variant when the caller changes it', async () => {
			const { container, rerender } = render(Status.Root, {
				props: { variant: 'success', children: text('Online') }
			});
			expect(bySlot(container, 'status')).toHaveAttribute('data-variant', 'success');

			await rerender({ variant: 'error' });

			expect(bySlot(container, 'status')).toHaveAttribute('data-variant', 'error');
		});

		it('never changes its own variant in response to interaction', async () => {
			const user = userEvent.setup();
			const { container } = render(Status.Root, {
				props: { variant: 'success', children: text('Online') }
			});
			const root = bySlot(container, 'status');

			await user.click(root);

			expect(root).toHaveAttribute('data-variant', 'success');
			expect(root.classList.contains('bg-success/10')).toBe(true);
		});
	});

	describe('edge cases', () => {
		it('normalises an unknown variant to default', () => {
			expect(resolveStatusVariant('bogus')).toBe('default');
			expect(resolveStatusVariant(undefined)).toBe('default');
		});

		it('renders the default variant when handed an unknown value at runtime', () => {
			// Simulates untyped runtime data reaching the prop: a union double-assert, never `any`.
			const { container } = render(Status.Root, {
				props: { variant: 'bogus' as unknown as StatusVariant, children: text('Online') }
			});
			const root = bySlot(container, 'status');

			expect(root).toHaveAttribute('data-variant', 'default');
			for (const className of VARIANT_CLASSES.default) {
				expect(root.classList.contains(className)).toBe(true);
			}
		});

		it('clips rather than wraps a very long label', () => {
			const { container } = render(Status.Root, {
				props: {
					children: text(
						'Every downstream replica of the primary write-ahead log is currently reconciling'
					)
				}
			});
			const root = bySlot(container, 'status');

			for (const className of ['w-fit', 'whitespace-nowrap', 'overflow-hidden']) {
				expect(root.classList.contains(className)).toBe(true);
			}
			for (const className of ['whitespace-normal', 'text-wrap', 'break-words', 'w-full']) {
				expect(root.classList.contains(className)).toBe(false);
			}
		});
	});
});

describe('StatusIndicator', () => {
	it('renders with data-slot="status-indicator" and the ping pseudo-element classes', () => {
		const { container } = render(Status.Indicator, { props: {} });
		const indicator = bySlot(container, 'status-indicator');

		expect(indicator.tagName).toBe('DIV');
		for (const className of INDICATOR_CLASSES) {
			expect(indicator.classList.contains(className)).toBe(true);
		}
	});

	it("merges the caller's class last", () => {
		const { container } = render(Status.Indicator, { props: { class: 'size-3' } });
		const indicator = bySlot(container, 'status-indicator');

		expect(indicator.classList.contains('size-3')).toBe(true);
		expect(indicator.classList.contains('size-2')).toBe(false);
	});

	it('forwards restProps, attributes and event handlers alike', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		const { container } = render(Status.Indicator, {
			props: { id: 'dot', 'data-testid': 'indicator', onclick }
		});
		const indicator = bySlot(container, 'status-indicator');

		expect(indicator).toHaveAttribute('id', 'dot');
		expect(indicator).toHaveAttribute('data-testid', 'indicator');

		await user.click(indicator);

		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('populates its ref through bind:ref', () => {
		const { container } = render(Harness, { props: { showLabel: false } });

		expect(container.querySelector('[data-testid="ref-report"]')).toHaveTextContent(
			'indicator:div'
		);
	});
});

describe('StatusLabel', () => {
	it('renders with data-slot="status-label" and leading-none', () => {
		const { container } = render(Status.Label, { props: { children: text('Online') } });
		const label = bySlot(container, 'status-label');

		expect(label.tagName).toBe('DIV');
		expect(label.classList.contains('leading-none')).toBe(true);
	});

	it('renders its text content', () => {
		render(Status.Label, { props: { children: text('Online') } });

		expect(screen.getByText('Online')).toBeInTheDocument();
	});

	it("merges the caller's class last", () => {
		const { container } = render(Status.Label, {
			props: { class: 'leading-tight', children: text('Online') }
		});
		const label = bySlot(container, 'status-label');

		expect(label.classList.contains('leading-tight')).toBe(true);
		expect(label.classList.contains('leading-none')).toBe(false);
	});

	it('forwards restProps, attributes and event handlers alike', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		const { container } = render(Status.Label, {
			props: { id: 'label', 'data-testid': 'status-label', onclick, children: text('Online') }
		});
		const label = bySlot(container, 'status-label');

		expect(label).toHaveAttribute('id', 'label');
		expect(label).toHaveAttribute('data-testid', 'status-label');

		await user.click(label);

		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('populates its ref through bind:ref', () => {
		const { container } = render(Harness, { props: { showIndicator: false } });

		expect(container.querySelector('[data-testid="ref-report"]')).toHaveTextContent('label:div');
	});
});

describe('composition', () => {
	it('renders the indicator and the label in markup order', () => {
		const { container } = render(Harness, { props: {} });
		const root = bySlot(container, 'status');
		const slots = [...root.children].map((child) => child.getAttribute('data-slot'));

		expect(slots).toEqual(['status-indicator', 'status-label']);
	});

	it('renders with the label only', () => {
		const { container } = render(Harness, { props: { showIndicator: false } });
		const root = bySlot(container, 'status');

		expect(root.querySelector('[data-slot="status-indicator"]')).toBeNull();
		expect(root.querySelector('[data-slot="status-label"]')).toBeInTheDocument();
	});

	it('renders with the indicator only', () => {
		const { container } = render(Harness, { props: { showLabel: false } });
		const root = bySlot(container, 'status');

		expect(root.querySelector('[data-slot="status-indicator"]')).toBeInTheDocument();
		expect(root.querySelector('[data-slot="status-label"]')).toBeNull();
	});

	it('renders with neither part', () => {
		const { container } = render(Harness, {
			props: { showIndicator: false, showLabel: false }
		});
		const root = bySlot(container, 'status');

		expect(root.children).toHaveLength(0);
		expect(root).toHaveAttribute('data-variant', 'default');
	});

	it('renders a bare part outside a root without throwing — there is no provider by design', () => {
		expect(() => render(StatusIndicator, { props: {} })).not.toThrow();
		expect(() => render(StatusLabel, { props: { children: text('Online') } })).not.toThrow();
	});
});

describe('child snippet', () => {
	it("renders onto the caller's element, carrying the badge attributes and classes", () => {
		const { container } = render(Harness, { props: { useChild: true, variant: 'success' } });
		const link = screen.getByRole('link', { name: 'Online' });

		expect(link).toHaveAttribute('href', '/status');
		expect(link).toHaveAttribute('data-slot', 'status');
		expect(link).toHaveAttribute('data-variant', 'success');
		for (const className of VARIANT_CLASSES.success) {
			expect(link.classList.contains(className)).toBe(true);
		}
		expect(container.querySelector('div[data-slot="status"]')).toBeNull();
	});

	it('does not render children when child is supplied', () => {
		const { container } = render(Harness, { props: { useChild: true } });

		expect(container.querySelectorAll('[data-slot="status-label"]')).toHaveLength(1);
		expect(container.querySelectorAll('[data-slot="status-indicator"]')).toHaveLength(1);
	});

	it('leaves the root ref null because the caller owns the element', () => {
		const { container } = render(Harness, { props: { useChild: true } });

		expect(container.querySelector('[data-testid="ref-report"]')).toHaveTextContent('root:null');
	});
});

describe('keyboard', () => {
	it('is not reachable by Tab in its default, non-interactive form', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: {} });
		const root = bySlot(container, 'status');

		await user.tab();

		expect(root).not.toHaveFocus();
		expect(root).not.toHaveAttribute('tabindex');
	});

	it('is reachable by Tab and keeps its accessible name in child mode', async () => {
		const user = userEvent.setup();
		render(Harness, { props: { useChild: true } });
		const link = screen.getByRole('link', { name: 'Online' });

		await user.tab();

		expect(link).toHaveFocus();
		expect(link).toHaveAccessibleName('Online');
	});

	it('activates the forwarded handler on Enter in child mode', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		render(Harness, { props: { useChild: true, onclick } });

		await user.tab();
		await user.keyboard('{Enter}');

		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('is reachable by Tab and keeps its accessible name on a child-rendered button', async () => {
		const user = userEvent.setup();
		render(Harness, { props: { useButton: true } });
		const button = screen.getByRole('button', { name: 'Online' });

		await user.tab();

		expect(button).toHaveFocus();
		expect(button).toHaveAccessibleName('Online');
	});

	it('activates the forwarded handler on Enter on a child-rendered button', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		render(Harness, { props: { useButton: true, onclick } });

		await user.tab();
		await user.keyboard('{Enter}');

		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('activates the forwarded handler on Space on a child-rendered button', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		render(Harness, { props: { useButton: true, onclick } });

		await user.tab();
		await user.keyboard(' ');

		expect(onclick).toHaveBeenCalledTimes(1);
	});
});

describe('accessibility and RTL', () => {
	it('adds no implicit role to any part', () => {
		const { container } = render(Harness, { props: {} });

		expect(screen.queryByRole('status')).toBeNull();
		for (const slot of SLOTS) {
			expect(bySlot(container, slot)).not.toHaveAttribute('role');
		}
	});

	it('introduces no live region on any part', () => {
		const { container } = render(Harness, { props: {} });

		for (const slot of SLOTS) {
			const part = bySlot(container, slot);
			expect(part).not.toHaveAttribute('aria-live');
			expect(part).not.toHaveAttribute('aria-atomic');
			expect(part).not.toHaveAttribute('role');
		}
	});

	it('never suppresses the focus indicator on any part', () => {
		const { container } = render(Harness, { props: {} });

		for (const slot of SLOTS) {
			const classList = [...bySlot(container, slot).classList];
			for (const suppressor of FOCUS_SUPPRESSORS) {
				expect(classList).not.toContain(suppressor);
			}
		}
	});

	it('never suppresses the focus indicator on a child-rendered element', () => {
		render(Harness, { props: { useChild: true } });
		const classList = [...screen.getByRole('link', { name: 'Online' }).classList];

		for (const suppressor of FOCUS_SUPPRESSORS) {
			expect(classList).not.toContain(suppressor);
		}
	});

	it('conveys every state through its label text, not colour alone', () => {
		for (const variant of STATUS_VARIANTS) {
			render(Harness, { props: { variant, label: variant } });

			expect(screen.getByText(variant)).toBeInTheDocument();
		}
	});

	it('exposes the label as the accessible name of a child-rendered element', () => {
		render(Harness, { props: { useChild: true, label: 'Degraded' } });

		expect(screen.getByRole('link', { name: 'Degraded' })).toBeInTheDocument();
	});

	it('uses logical layout only, so it mirrors under dir="rtl"', () => {
		const rtl = document.body.appendChild(document.createElement('div'));
		rtl.setAttribute('dir', 'rtl');
		const { container } = render(Harness, { target: rtl, props: {} });
		const root = bySlot(container, 'status');

		const physical = [...root.classList].filter((className) =>
			/^(ml-|mr-|left-|right-|pl-|pr-)/.test(className)
		);
		expect(physical).toEqual([]);

		const slots = [...root.children].map((child) => child.getAttribute('data-slot'));
		expect(slots).toEqual(['status-indicator', 'status-label']);
	});
});

describe('barrel', () => {
	it('exports statusVariants, which builds the requested variant row', () => {
		const classes = statusVariants({ variant: 'success' }).split(' ');

		for (const className of VARIANT_CLASSES.success) {
			expect(classes).toContain(className);
		}
	});

	it('falls back to the default row through defaultVariants', () => {
		const classes = statusVariants().split(' ');

		for (const className of [...BASE_CLASSES, ...VARIANT_CLASSES.default]) {
			expect(classes).toContain(className);
		}
	});

	it('exposes every part under both its short and its prefixed name', () => {
		expect(Status.Root).toBe(Status.Status);
		expect(Status.Indicator).toBe(StatusIndicator);
		expect(Status.Label).toBe(StatusLabel);
		expect(Status.Indicator).toBe(Status.StatusIndicator);
		expect(Status.Label).toBe(Status.StatusLabel);
	});
});
