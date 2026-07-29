import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import * as DirectionProvider from './index.js';
import { DirectionProvider as DirectionProviderAlias, useDirection } from './index.js';
import Harness from './direction-provider.test.svelte';

const text = (value: string) => createRawSnippet(() => ({ render: () => `<span>${value}</span>` }));

function bySlot(container: HTMLElement, slot: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function byTestId(container: HTMLElement, testId: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
	if (!element) throw new Error(`no element with data-testid="${testId}" was rendered`);
	return element;
}

describe('DirectionProvider', () => {
	it('resolves "ltr" for a descendant when the provider is dir="ltr" (C-01)', () => {
		const { container } = render(Harness, { props: { dir: 'ltr', showOuterConsumer: true } });

		expect(byTestId(container, 'outer-consumer')).toHaveAttribute('data-current', 'ltr');
	});

	it('resolves "rtl" for a descendant when the provider is dir="rtl" (C-02)', () => {
		const { container } = render(Harness, { props: { dir: 'rtl', showOuterConsumer: true } });

		expect(byTestId(container, 'outer-consumer')).toHaveAttribute('data-current', 'rtl');
	});

	it('falls back to "ltr" and reflects it on data-dir/dir when no dir prop is passed (C-03)', () => {
		render(DirectionProvider.Root, { props: { children: text('App') } });

		const root = screen.getByText('App').parentElement as HTMLElement;
		expect(root).toHaveAttribute('data-dir', 'ltr');
		expect(root).toHaveAttribute('dir', 'ltr');
	});

	it('resolves the inner value for an inner descendant while an outer sibling still reads the outer value (C-04)', () => {
		const { container } = render(Harness, {
			props: {
				dir: 'rtl',
				innerDir: 'ltr',
				showOuterConsumer: true,
				showInnerConsumer: true
			}
		});

		expect(byTestId(container, 'outer-consumer')).toHaveAttribute('data-current', 'rtl');
		expect(byTestId(container, 'inner-consumer')).toHaveAttribute('data-current', 'ltr');
	});

	it('carries data-slot, data-dir, dir and merges a caller class after contents (C-13)', () => {
		const { container } = render(Harness, {
			props: { dir: 'rtl', class: 'rounded-none' }
		});

		const root = bySlot(container, 'direction-provider');
		expect(root).toHaveAttribute('data-slot', 'direction-provider');
		expect(root).toHaveAttribute('data-dir', 'rtl');
		expect(root).toHaveAttribute('dir', 'rtl');
		expect(root.classList.contains('contents')).toBe(true);
		expect(root.classList.contains('rounded-none')).toBe(true);
	});

	it('supports a namespace import exposing Root, DirectionProvider and useDirection (C-21)', () => {
		expect(DirectionProvider.Root).toBeDefined();
		expect(DirectionProvider.DirectionProvider).toBe(DirectionProvider.Root);
		expect(DirectionProvider.useDirection).toBeDefined();
	});

	it('supports a named import of useDirection alone rendering with no provider present (C-21)', () => {
		expect(() => render(Harness, { props: { showBareConsumer: true } })).not.toThrow();
		expect(DirectionProviderAlias).toBe(DirectionProvider.Root);
		expect(useDirection).toBe(DirectionProvider.useDirection);
	});
});

describe('accessibility (C-14, C-15)', () => {
	it('exposes no role and no accessible name, and renders children unchanged', () => {
		render(DirectionProvider.Root, { props: { children: text('Content') } });

		expect(screen.queryByRole('region')).toBeNull();
		const root = screen.getByText('Content').parentElement as HTMLElement;
		expect(root).not.toHaveAttribute('role');
		expect(root).not.toHaveAttribute('aria-label');
		expect(screen.getByText('Content')).toBeInTheDocument();
	});

	it('getDirectionContext() throws when called without a provider above; hasDirectionContext() returns false', () => {
		expect(() => render(Harness, { props: { showThrowingProbe: true } })).toThrow(
			/must be used within/
		);

		const { container } = render(Harness, { props: {} });
		expect(byTestId(container, 'has-context')).toHaveTextContent('false');
	});
});

describe('useDirection fallback resolution (C-05, C-06, C-07, C-08)', () => {
	it('resolves "ltr" without throwing when there is no provider and no ancestor dir (C-05)', () => {
		let container: HTMLElement;
		expect(() => {
			container = render(Harness, { props: { showBareConsumer: true } }).container;
		}).not.toThrow();

		expect(byTestId(container!, 'bare-consumer')).toHaveAttribute('data-current', 'ltr');
	});

	it('resolves "rtl" from an ancestor dir="rtl" attribute when anchored on the consumer node (C-06)', () => {
		const { container } = render(Harness, {
			props: { showBareConsumer: true, ancestorDir: 'rtl', anchorAncestor: true }
		});

		expect(byTestId(container, 'bare-consumer')).toHaveAttribute('data-current', 'rtl');
	});

	it('treats an ancestor dir="auto" as absent and falls back to "ltr"; isDirection("auto") is false (C-07)', () => {
		const { container } = render(Harness, {
			props: { showBareConsumer: true, ancestorDir: 'auto', anchorAncestor: true }
		});

		expect(byTestId(container, 'bare-consumer')).toHaveAttribute('data-current', 'ltr');
		expect(DirectionProvider.isDirection('auto')).toBe(false);
	});

	it('lets an explicit override win over both a DOM ancestor and a conflicting provider (C-08)', () => {
		const { container: domCase } = render(Harness, {
			props: {
				showBareConsumer: true,
				ancestorDir: 'rtl',
				anchorAncestor: true,
				overrideDir: 'ltr'
			}
		});
		expect(byTestId(domCase, 'bare-consumer')).toHaveAttribute('data-current', 'ltr');
	});
});

describe('runtime updates (C-09, C-10, C-11)', () => {
	it('propagates a provider dir flip to every consumer without remount (C-09)', async () => {
		const { container, rerender } = render(Harness, {
			props: { dir: 'ltr', showOuterConsumer: true }
		});
		expect(byTestId(container, 'outer-consumer')).toHaveAttribute('data-current', 'ltr');

		await rerender({ dir: 'rtl', showOuterConsumer: true });

		expect(byTestId(container, 'outer-consumer')).toHaveAttribute('data-current', 'rtl');
	});

	it('updates a provider-less consumer when an ancestor dir attribute mutates at runtime (C-10)', async () => {
		const { container } = render(Harness, {
			props: { showBareConsumer: true, ancestorDir: 'ltr', anchorAncestor: true }
		});
		expect(byTestId(container, 'bare-consumer')).toHaveAttribute('data-current', 'ltr');

		const ancestor = byTestId(container, 'ancestor');
		ancestor.setAttribute('dir', 'rtl');

		await vi.waitFor(() => {
			expect(byTestId(container, 'bare-consumer')).toHaveAttribute('data-current', 'rtl');
		});
	});

	it('updates the consumer when the override getter value changes at runtime (C-11)', async () => {
		const { container, rerender } = render(Harness, {
			props: { showBareConsumer: true, overrideDir: 'ltr' }
		});
		expect(byTestId(container, 'bare-consumer')).toHaveAttribute('data-current', 'ltr');

		await rerender({ showBareConsumer: true, overrideDir: 'rtl' });

		expect(byTestId(container, 'bare-consumer')).toHaveAttribute('data-current', 'rtl');
	});
});

describe('attribute forwarding and ref (C-12, C-16)', () => {
	it('forwards id, aria-label and an arbitrary data-* prop onto the rendered wrapper (C-12)', () => {
		const { container } = render(Harness, {
			props: {
				dir: 'ltr',
				rest: { id: 'app-direction', 'aria-label': 'App direction', 'data-testid-extra': 'x' }
			}
		});

		const root = bySlot(container, 'direction-provider');
		expect(root).toHaveAttribute('id', 'app-direction');
		expect(root).toHaveAttribute('aria-label', 'App direction');
		expect(root).toHaveAttribute('data-testid-extra', 'x');
	});

	it('binds ref to the rendered div (C-16)', () => {
		const { container } = render(Harness, { props: { dir: 'ltr' } });

		expect(byTestId(container, 'ref-report')).toHaveTextContent('root:div');
	});
});

describe('controlled/uncontrolled dir (C-17, C-18)', () => {
	it('supplies "ltr" when uncontrolled (no dir passed) and consumers read it (C-17)', () => {
		const { container } = render(Harness, { props: { dir: 'ltr', showOuterConsumer: true } });

		expect(bySlot(container, 'direction-provider')).toHaveAttribute('data-dir', 'ltr');
		expect(byTestId(container, 'outer-consumer')).toHaveAttribute('data-current', 'ltr');
	});

	it('never changes dir on its own across consumer interaction (C-18)', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: { dir: 'rtl', showOuterConsumer: true } });
		const root = bySlot(container, 'direction-provider');

		await user.click(root);
		await user.tab();

		expect(root).toHaveAttribute('data-dir', 'rtl');
		expect(byTestId(container, 'outer-consumer')).toHaveAttribute('data-current', 'rtl');
	});
});

describe('teardown (C-19)', () => {
	it('disconnects its MutationObserver when a reader unmounts', () => {
		const disconnectSpy = vi.spyOn(MutationObserver.prototype, 'disconnect');

		const { unmount } = render(Harness, { props: { showBareConsumer: true } });
		unmount();

		expect(disconnectSpy).toHaveBeenCalled();
		disconnectSpy.mockRestore();
	});
});

describe('keyboard (C-20)', () => {
	it('registers no key handlers: data-dir, dir and every consumer value are unchanged after keyboard input', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, {
			props: { dir: 'rtl', showOuterConsumer: true }
		});
		const root = bySlot(container, 'direction-provider');

		await user.click(root);
		for (const key of [
			'{ArrowLeft}',
			'{ArrowRight}',
			'{ArrowUp}',
			'{ArrowDown}',
			'{Home}',
			'{End}',
			'{Enter}',
			'{Escape}',
			'{Tab}'
		]) {
			await user.keyboard(key);
		}

		expect(root).toHaveAttribute('data-dir', 'rtl');
		expect(root).toHaveAttribute('dir', 'rtl');
		expect(byTestId(container, 'outer-consumer')).toHaveAttribute('data-current', 'rtl');
	});
});
