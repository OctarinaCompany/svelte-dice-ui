import { afterEach, describe, expect, it, vi } from 'vitest';

import { getColorBackgroundStyle, hasAlpha, isCssColor, normalizeColorValue } from './color.js';

describe('normalizeColorValue', () => {
	it('returns undefined for undefined', () => {
		expect(normalizeColorValue(undefined)).toBeUndefined();
	});

	it('returns undefined for an empty string', () => {
		expect(normalizeColorValue('')).toBeUndefined();
	});

	it('returns undefined for a whitespace-only string', () => {
		expect(normalizeColorValue('   ')).toBeUndefined();
	});

	it('trims surrounding whitespace from a valid value', () => {
		expect(normalizeColorValue('  #3b82f6  ')).toBe('#3b82f6');
	});

	it('is idempotent', () => {
		const once = normalizeColorValue('  #3b82f6  ');
		expect(normalizeColorValue(once)).toBe(once);
	});
});

describe('isCssColor', () => {
	const validColors = [
		'#3b82f6',
		'#3b82f6ff',
		'rgb(59, 130, 246)',
		'rgba(59, 130, 246, 0.5)',
		'hsl(217, 91%, 60%)',
		'hsla(217, 91%, 60%, 0.5)',
		'oklch(0.6 0.2 250)',
		'color(display-p3 1 0 0 / 0.5)',
		'blue',
		'transparent'
	];

	for (const color of validColors) {
		it(`returns true for ${color}`, () => {
			expect(isCssColor(color)).toBe(true);
		});
	}

	it('returns false for an invalid value', () => {
		expect(isCssColor('not-a-color')).toBe(false);
	});

	it('returns true when CSS is unavailable (SSR fallback)', () => {
		// `isCssColor` guards on `typeof CSS !== 'undefined'`, so stubbing the global to undefined
		// reproduces SSR exactly - and, unlike `delete globalThis.CSS`, needs no ts-expect-error.
		vi.stubGlobal('CSS', undefined);

		try {
			expect(isCssColor('not-a-color')).toBe(true);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('returns false when CSS.supports throws', () => {
		const original = globalThis.CSS;
		vi.stubGlobal('CSS', {
			supports: () => {
				throw new Error('boom');
			}
		});

		try {
			expect(isCssColor('#3b82f6')).toBe(false);
		} finally {
			globalThis.CSS = original;
			vi.unstubAllGlobals();
		}
	});
});

describe('hasAlpha', () => {
	const alphaBearing = [
		'rgba(59, 130, 246, 0.5)',
		'hsla(217, 91%, 60%, 0.5)',
		'#3b82f680',
		'#38f8',
		'transparent',
		'TRANSPARENT',
		'  transparent  ',
		'rgb(59 130 246 / 0.5)',
		'hsl(217 91% 60% / 50%)',
		'oklch(0.6 0.2 250 / 0.5)',
		'color(display-p3 1 0 0 / 0.5)'
	];

	for (const color of alphaBearing) {
		it(`returns true for ${color}`, () => {
			expect(hasAlpha(color)).toBe(true);
		});
	}

	const opaque = [
		'#3b82f6',
		'rgb(59, 130, 246)',
		'hsl(217, 91%, 60%)',
		'blue',
		'oklch(0.6 0.2 250)'
	];

	for (const color of opaque) {
		it(`returns false for ${color}`, () => {
			expect(hasAlpha(color)).toBe(false);
		});
	}

	it('is case-insensitive for function notation', () => {
		expect(hasAlpha('RGBA(59, 130, 246, 0.5)')).toBe(true);
	});
});

describe('getColorBackgroundStyle', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('renders the no-value diagonal gradient for undefined', () => {
		expect(getColorBackgroundStyle(undefined)).toBe(
			'background: linear-gradient(to bottom right, transparent calc(50% - 1px), var(--destructive) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) no-repeat'
		);
	});

	it('renders the no-value diagonal gradient for an empty string', () => {
		expect(getColorBackgroundStyle('')).toBe(getColorBackgroundStyle(undefined));
	});

	it('renders the no-value diagonal gradient for a whitespace-only string', () => {
		expect(getColorBackgroundStyle('   ')).toBe(getColorBackgroundStyle(undefined));
	});

	it('renders background-color: transparent for an invalid value', () => {
		expect(getColorBackgroundStyle('not-a-color')).toBe('background-color: transparent');
	});

	it('renders a flat background-color for a valid, opaque value', () => {
		expect(getColorBackgroundStyle('#3b82f6')).toBe('background-color: #3b82f6');
	});

	it('renders the checkerboard gradient for a valid, alpha-bearing value', () => {
		expect(getColorBackgroundStyle('rgba(59, 130, 246, 0.5)')).toBe(
			'background: linear-gradient(rgba(59, 130, 246, 0.5), rgba(59, 130, 246, 0.5)), repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0% 50% / 10px 10px'
		);
	});

	it('substitutes options.checkerboardSize into the checkerboard gradient', () => {
		expect(getColorBackgroundStyle('rgba(59, 130, 246, 0.5)', { checkerboardSize: '4px' })).toBe(
			'background: linear-gradient(rgba(59, 130, 246, 0.5), rgba(59, 130, 246, 0.5)), repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0% 50% / 4px 4px'
		);
	});

	it('renders a flat background-color for an alpha-bearing value when withoutTransparency is set', () => {
		expect(getColorBackgroundStyle('rgba(59, 130, 246, 0.5)', { withoutTransparency: true })).toBe(
			'background-color: rgba(59, 130, 246, 0.5)'
		);
	});

	it('withoutTransparency never changes the no-value or invalid-value states', () => {
		expect(getColorBackgroundStyle(undefined, { withoutTransparency: true })).toBe(
			getColorBackgroundStyle(undefined)
		);
		expect(getColorBackgroundStyle('not-a-color', { withoutTransparency: true })).toBe(
			getColorBackgroundStyle('not-a-color')
		);
	});
});
