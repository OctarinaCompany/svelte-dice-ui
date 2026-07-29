import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import * as ColorSwatch from './index.js';
import Harness from './color-swatch.test.svelte';

function bySlot(container: HTMLElement, slot: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

// Svelte applies a spread `style` through `element.style.cssText`, so jsdom (matching real
// browsers) canonicalises hex colours to `rgb()` once they round-trip through the CSSOM — the
// `style` attribute never echoes the literal hex text back. These are the canonical forms for
// the two hex fixtures used below.
const BLUE_RGB = 'rgb(59, 130, 246)';
const EF4444_RGB = 'rgb(239, 68, 68)';

describe('roles and accessible names', () => {
	it('always carries role="img"', () => {
		const { container } = render(ColorSwatch.Root, { props: {} });

		expect(bySlot(container, 'color-swatch')).toHaveAttribute('role', 'img');
	});

	it('reads "Color swatch: <value>" for a valid hex value', () => {
		const { container } = render(ColorSwatch.Root, { props: { color: '#3b82f6' } });

		expect(bySlot(container, 'color-swatch')).toHaveAttribute(
			'aria-label',
			'Color swatch: #3b82f6'
		);
	});

	it('reads "Color swatch: <value>" for a named colour', () => {
		const { container } = render(ColorSwatch.Root, { props: { color: 'blue' } });

		expect(bySlot(container, 'color-swatch')).toHaveAttribute('aria-label', 'Color swatch: blue');
	});

	it('reads "Color swatch: <value>" for a valid rgb() value', () => {
		const { container } = render(ColorSwatch.Root, {
			props: { color: 'rgb(0, 0, 0)' }
		});

		expect(bySlot(container, 'color-swatch')).toHaveAttribute(
			'aria-label',
			'Color swatch: rgb(0, 0, 0)'
		);
	});

	it('reads the exact trimmed string for an invalid value', () => {
		const { container } = render(ColorSwatch.Root, { props: { color: '  not-a-color  ' } });

		expect(bySlot(container, 'color-swatch')).toHaveAttribute(
			'aria-label',
			'Color swatch: not-a-color'
		);
	});

	it('reads "No color selected" for undefined', () => {
		const { container } = render(ColorSwatch.Root, { props: {} });

		expect(bySlot(container, 'color-swatch')).toHaveAttribute('aria-label', 'No color selected');
	});

	it('reads "No color selected" for an empty string', () => {
		const { container } = render(ColorSwatch.Root, { props: { color: '' } });

		expect(bySlot(container, 'color-swatch')).toHaveAttribute('aria-label', 'No color selected');
	});

	it('reads "No color selected" for a whitespace-only string', () => {
		const { container } = render(ColorSwatch.Root, { props: { color: '   ' } });

		expect(bySlot(container, 'color-swatch')).toHaveAttribute('aria-label', 'No color selected');
	});
});

describe('background and props', () => {
	it('renders a flat background-color for a valid colour', () => {
		const { container } = render(ColorSwatch.Root, { props: { color: '#3b82f6' } });

		expect(bySlot(container, 'color-swatch').getAttribute('style')).toContain(
			`background-color: ${BLUE_RGB}`
		);
	});

	it('renders background-color: transparent for an invalid colour and never throws', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		let container!: HTMLElement;
		expect(() => {
			({ container } = render(ColorSwatch.Root, { props: { color: 'not-a-color' } }));
		}).not.toThrow();

		expect(bySlot(container, 'color-swatch').getAttribute('style')).toContain(
			'background-color: transparent'
		);
		expect(errorSpy).not.toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it('renders the no-colour gradient background when color is absent', () => {
		const { container } = render(ColorSwatch.Root, { props: {} });

		expect(bySlot(container, 'color-swatch').getAttribute('style')).toContain(
			'linear-gradient(to bottom right'
		);
	});

	it('applies the size-8 class by default', () => {
		const { container } = render(ColorSwatch.Root, { props: {} });

		expect(bySlot(container, 'color-swatch').classList.contains('size-8')).toBe(true);
	});

	it('a caller class overrides the variant size class', () => {
		const { container } = render(ColorSwatch.Root, { props: { class: 'size-10' } });
		const root = bySlot(container, 'color-swatch');

		expect(root.classList.contains('size-10')).toBe(true);
	});

	it("appends the caller's style after the computed background and forced-color-adjust", () => {
		const { container } = render(ColorSwatch.Root, {
			props: { color: '#3b82f6', style: 'opacity: 0.5;' }
		});
		const style = bySlot(container, 'color-swatch').getAttribute('style') ?? '';

		expect(style).toContain(`background-color: ${BLUE_RGB}`);
		expect(style).toContain('forced-color-adjust: none');
		expect(style).toContain('opacity: 0.5');
		expect(style.indexOf('forced-color-adjust: none')).toBeLessThan(
			style.lastIndexOf('opacity: 0.5')
		);
	});

	it("the caller's style wins a conflicting declaration, matching the CSS cascade", () => {
		// Svelte applies a spread `style` through `element.style.cssText`, so the CSSOM (in jsdom
		// and every real browser) keeps only the last value for a repeated property — the earlier
		// `background-color: #3b82f6` from the component does not survive as separate literal text,
		// it is superseded exactly as a real browser would render it.
		const { container } = render(ColorSwatch.Root, {
			props: { color: '#3b82f6', style: 'background-color: red;' }
		});
		const style = bySlot(container, 'color-swatch').getAttribute('style') ?? '';

		expect(style).toContain('background-color: red');
		expect(style).toContain('forced-color-adjust: none');
	});

	it('withoutTransparency suppresses the checkerboard, applying a flat background-color', () => {
		const { container } = render(ColorSwatch.Root, {
			props: { color: 'rgba(59, 130, 246, 0.5)', withoutTransparency: true }
		});

		expect(bySlot(container, 'color-swatch')).toHaveAttribute(
			'style',
			expect.stringContaining('background-color: rgba(59, 130, 246, 0.5)')
		);
	});

	it('disabled applies aria-disabled and the disabled variant classes', () => {
		const { container } = render(ColorSwatch.Root, { props: { disabled: true } });
		const root = bySlot(container, 'color-swatch');

		expect(root).toHaveAttribute('aria-disabled', 'true');
		expect(root.classList.contains('data-disabled:pointer-events-none')).toBe(true);
		expect(root.classList.contains('data-disabled:opacity-50')).toBe(true);
	});
});

describe('data attributes', () => {
	it('always carries data-slot="color-swatch"', () => {
		const { container } = render(ColorSwatch.Root, { props: {} });

		expect(bySlot(container, 'color-swatch')).toHaveAttribute('data-slot', 'color-swatch');
	});

	it('carries data-slot="color-swatch" in child mode', () => {
		const { container } = render(Harness, { props: { useChild: true } });

		expect(container.querySelector('[data-testid="span-child"]')).toHaveAttribute(
			'data-slot',
			'color-swatch'
		);
	});

	it('carries data-slot="color-swatch" with a caller class/style', () => {
		const { container } = render(ColorSwatch.Root, {
			props: { class: 'rounded-full', style: 'opacity: 0.9;' }
		});

		expect(bySlot(container, 'color-swatch')).toHaveAttribute('data-slot', 'color-swatch');
	});

	it.each([undefined, '', '   '])('data-empty is present for color=%p', (color) => {
		const { container } = render(ColorSwatch.Root, { props: { color } });

		expect(bySlot(container, 'color-swatch')).toHaveAttribute('data-empty', '');
	});

	it.each(['#3b82f6', 'not-a-color'])('data-empty is absent for a resolving value: %s', (color) => {
		const { container } = render(ColorSwatch.Root, { props: { color } });

		expect(bySlot(container, 'color-swatch')).not.toHaveAttribute('data-empty');
	});

	it('data-disabled is absent (not "false") when disabled is omitted', () => {
		const { container } = render(ColorSwatch.Root, { props: {} });

		expect(bySlot(container, 'color-swatch').getAttribute('data-disabled')).toBeNull();
	});

	it('data-transparent is absent (not "false") for an opaque colour', () => {
		const { container } = render(ColorSwatch.Root, { props: { color: '#3b82f6' } });

		expect(bySlot(container, 'color-swatch').getAttribute('data-transparent')).toBeNull();
	});

	it('data-empty is absent (not "false") for a resolving colour', () => {
		const { container } = render(ColorSwatch.Root, { props: { color: '#3b82f6' } });

		expect(bySlot(container, 'color-swatch').getAttribute('data-empty')).toBeNull();
	});
});

describe('transparency', () => {
	it.each(['rgba(59, 130, 246, 0.5)', 'hsla(217, 91%, 60%, 0.5)', '#3b82f680', 'transparent'])(
		'renders the checkerboard background and data-transparent for %s',
		(color) => {
			const { container } = render(ColorSwatch.Root, { props: { color } });
			const root = bySlot(container, 'color-swatch');

			expect(root).toHaveAttribute('data-transparent', '');
			expect(root.getAttribute('style')).toContain('repeating-conic-gradient');
		}
	);

	it('withoutTransparency renders only the flat colour with data-transparent absent', () => {
		const { container } = render(ColorSwatch.Root, {
			props: { color: 'rgba(59, 130, 246, 0.5)', withoutTransparency: true }
		});
		const root = bySlot(container, 'color-swatch');

		expect(root.getAttribute('data-transparent')).toBeNull();
		expect(root.getAttribute('style')).not.toContain('repeating-conic-gradient');
	});

	it('a fully opaque colour never renders the checkerboard regardless of withoutTransparency', () => {
		for (const withoutTransparency of [false, true]) {
			const { container } = render(ColorSwatch.Root, {
				props: { color: '#3b82f6', withoutTransparency }
			});
			const root = bySlot(container, 'color-swatch');

			expect(root.getAttribute('data-transparent')).toBeNull();
			expect(root.getAttribute('style')).not.toContain('repeating-conic-gradient');
		}
	});
});

describe('size and disabled', () => {
	const SIZE_CLASSES: Record<string, string> = { sm: 'size-6', default: 'size-8', lg: 'size-12' };

	for (const size of ColorSwatch.COLOR_SWATCH_SIZES) {
		it(`renders the ${size} size class and matching data-size`, () => {
			const { container } = render(ColorSwatch.Root, { props: { size } });
			const root = bySlot(container, 'color-swatch');

			expect(root).toHaveAttribute('data-size', size);
			expect(root.classList.contains(SIZE_CLASSES[size])).toBe(true);
		});
	}

	it('defaults to "default" when size is omitted', () => {
		const { container } = render(ColorSwatch.Root, { props: {} });

		expect(bySlot(container, 'color-swatch')).toHaveAttribute('data-size', 'default');
	});

	it('falls back to "default" for an unrecognised runtime size value', () => {
		const { container } = render(ColorSwatch.Root, {
			props: { size: 'bogus' as unknown as ColorSwatch.ColorSwatchSize }
		});
		const root = bySlot(container, 'color-swatch');

		expect(root).toHaveAttribute('data-size', 'default');
		expect(root.classList.contains('size-8')).toBe(true);
	});

	it('disabled renders aria-disabled and data-disabled plus the variant classes', () => {
		const { container } = render(ColorSwatch.Root, { props: { disabled: true } });
		const root = bySlot(container, 'color-swatch');

		expect(root).toHaveAttribute('aria-disabled', 'true');
		expect(root).toHaveAttribute('data-disabled', '');
		expect(root.classList.contains('data-disabled:pointer-events-none')).toBe(true);
		expect(root.classList.contains('data-disabled:opacity-50')).toBe(true);
		expect(root.classList.contains('pointer-events-none')).toBe(false);
		expect(root.classList.contains('opacity-50')).toBe(false);
	});

	it('omitting disabled never renders aria-disabled', () => {
		const { container } = render(ColorSwatch.Root, { props: {} });

		expect(bySlot(container, 'color-swatch').getAttribute('aria-disabled')).toBeNull();
	});

	it('carries the documented upstream chrome classes', () => {
		const { container } = render(ColorSwatch.Root, { props: {} });
		const root = bySlot(container, 'color-swatch');

		for (const className of [
			'box-border',
			'rounded-sm',
			'border',
			'bg-clip-padding',
			'shadow-sm'
		]) {
			expect(root.classList.contains(className)).toBe(true);
		}
	});

	it('still wires an onclick handler through restProps while disabled', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		const { container } = render(ColorSwatch.Root, { props: { disabled: true, onclick } });
		const root = bySlot(container, 'color-swatch');

		expect(root.classList.contains('data-disabled:pointer-events-none')).toBe(true);

		await user.click(root);
		expect(onclick).toHaveBeenCalledTimes(1);
	});
});

describe('keyboard and guard rails', () => {
	it('carries no tabindex and is skipped by Tab', async () => {
		const user = userEvent.setup();
		// Built with DOM APIs and removed at the end, rather than `document.body.innerHTML = …`,
		// which would leak these siblings into every later test (RTL's `cleanup()` only unmounts
		// containers created through `render()`).
		const before = document.createElement('button');
		before.dataset.testid = 'before';
		before.textContent = 'before';
		const mount = document.createElement('div');
		const after = document.createElement('button');
		after.dataset.testid = 'after';
		after.textContent = 'after';
		document.body.append(before, mount, after);

		try {
			const { container } = render(ColorSwatch.Root, { props: {}, target: mount });
			const root = bySlot(container, 'color-swatch');
			expect(root).not.toHaveAttribute('tabindex');

			screen.getByTestId('before').focus();
			await user.tab();

			expect(screen.getByTestId('after')).toHaveFocus();
			expect(root).not.toHaveFocus();
		} finally {
			before.remove();
			mount.remove();
			after.remove();
		}
	});
});

describe('uncontrolled / controlled equivalent', () => {
	it('never mutates its own attributes absent a prop change', async () => {
		const user = userEvent.setup();
		const { container } = render(ColorSwatch.Root, { props: { color: '#3b82f6' } });
		const root = bySlot(container, 'color-swatch');

		await user.click(root);

		expect(root).toHaveAttribute('aria-label', 'Color swatch: #3b82f6');
		expect(root.getAttribute('style')).toContain(`background-color: ${BLUE_RGB}`);
	});

	it('re-renders aria-label and background when the color prop changes', async () => {
		const { container, rerender } = render(ColorSwatch.Root, { props: { color: '#3b82f6' } });
		let root = bySlot(container, 'color-swatch');
		expect(root).toHaveAttribute('aria-label', 'Color swatch: #3b82f6');

		await rerender({ color: '#ef4444' });

		root = bySlot(container, 'color-swatch');
		expect(root).toHaveAttribute('aria-label', 'Color swatch: #ef4444');
		expect(root.getAttribute('style')).toContain(`background-color: ${EF4444_RGB}`);
		expect(root.getAttribute('style')).not.toContain(`background-color: ${BLUE_RGB}`);
	});
});

describe('RTL', () => {
	it('renders identical class and style under dir="rtl"', () => {
		const ltr = render(ColorSwatch.Root, { props: { color: 'rgba(59, 130, 246, 0.5)' } });
		const ltrRoot = bySlot(ltr.container, 'color-swatch');
		const ltrClass = ltrRoot.getAttribute('class');
		const ltrStyle = ltrRoot.getAttribute('style');
		ltr.unmount();

		const rtl = render(Harness, { props: { color: 'rgba(59, 130, 246, 0.5)', rtl: true } });
		const rtlRoot = bySlot(rtl.container, 'color-swatch');

		expect(rtlRoot.getAttribute('class')).toBe(ltrClass);
		expect(rtlRoot.getAttribute('style')).toBe(ltrStyle);
	});
});

describe('child snippet and edge cases', () => {
	it("the caller's span receives the merged role/aria-label/data attributes/class/style", () => {
		const { container } = render(Harness, {
			props: { useChild: true, color: '#3b82f6', size: 'lg' }
		});
		const span = container.querySelector('[data-testid="span-child"]') as HTMLElement;

		expect(span).toHaveAttribute('role', 'img');
		expect(span).toHaveAttribute('aria-label', 'Color swatch: #3b82f6');
		expect(span).toHaveAttribute('data-slot', 'color-swatch');
		expect(span).toHaveAttribute('data-size', 'lg');
		expect(span.classList.contains('size-12')).toBe(true);
		expect(span.getAttribute('style')).toContain(`background-color: ${BLUE_RGB}`);
		expect(container.querySelector('div[data-slot="color-swatch"]')).toBeNull();
	});

	it('a caller role written after the spread onto a button overrides role=img', () => {
		render(Harness, { props: { useButtonChild: true, color: '#3b82f6' } });

		expect(screen.getByRole('button')).toHaveAttribute('data-slot', 'color-swatch');
		expect(screen.queryByRole('img')).toBeNull();
	});

	it('the default div is absent in child mode', () => {
		const { container } = render(Harness, { props: { useChild: true } });

		expect(container.querySelector('div[data-slot="color-swatch"]')).toBeNull();
	});

	it('bind:ref stays null in child mode', () => {
		let rootRef: HTMLDivElement | null = null;
		render(Harness, {
			props: {
				useChild: true,
				get rootRef() {
					return rootRef;
				},
				set rootRef(value) {
					rootRef = value;
				}
			}
		});

		expect(rootRef).toBeNull();
	});

	it('reports the root HTMLDivElement through bind:ref in default mode', () => {
		let rootRef: HTMLDivElement | null = null;
		render(Harness, {
			props: {
				get rootRef() {
					return rootRef;
				},
				set rootRef(value) {
					rootRef = value;
				}
			}
		});

		expect(rootRef).toBeInstanceOf(HTMLDivElement);
	});

	it('treats color="" the same as omitting color', () => {
		const { container } = render(ColorSwatch.Root, { props: { color: '' } });
		const root = bySlot(container, 'color-swatch');

		expect(root).toHaveAttribute('aria-label', 'No color selected');
		expect(root).toHaveAttribute('data-empty', '');
	});

	it('treats color="   " the same as omitting color', () => {
		const { container } = render(ColorSwatch.Root, { props: { color: '   ' } });
		const root = bySlot(container, 'color-swatch');

		expect(root).toHaveAttribute('aria-label', 'No color selected');
		expect(root).toHaveAttribute('data-empty', '');
	});

	it('trims leading and trailing whitespace before computing the accessible name and background', () => {
		const { container } = render(ColorSwatch.Root, { props: { color: '  #3b82f6  ' } });
		const root = bySlot(container, 'color-swatch');

		expect(root).toHaveAttribute('aria-label', 'Color swatch: #3b82f6');
		expect(root.getAttribute('style')).toContain(`background-color: ${BLUE_RGB}`);
	});
});

describe('barrel', () => {
	it('exposes Root under both its short and prefixed name', () => {
		expect(ColorSwatch.Root).toBe(ColorSwatch.ColorSwatch);
	});

	it('holds the documented ordered tuple of sizes', () => {
		expect(ColorSwatch.COLOR_SWATCH_SIZES).toEqual(['default', 'sm', 'lg']);
	});

	it('resolveColorSwatchSize falls back to "default" for an unknown value', () => {
		expect(ColorSwatch.resolveColorSwatchSize('bogus')).toBe('default');
		expect(ColorSwatch.resolveColorSwatchSize(undefined)).toBe('default');
	});

	it('exports colorSwatchVariants, which builds the requested size row', () => {
		const classes = ColorSwatch.colorSwatchVariants({ size: 'lg' }).split(' ');

		expect(classes).toContain('size-12');
	});

	it('re-exports the colour module functions', () => {
		expect(ColorSwatch.normalizeColorValue('  a  ')).toBe('a');
		expect(typeof ColorSwatch.isCssColor).toBe('function');
		expect(typeof ColorSwatch.hasAlpha).toBe('function');
		expect(typeof ColorSwatch.getColorBackgroundStyle).toBe('function');
	});
});
