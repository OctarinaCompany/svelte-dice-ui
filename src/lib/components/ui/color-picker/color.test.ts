import { describe, expect, it } from 'vitest';

import {
	clampChannel,
	COLOR_FORMATS,
	colorToString,
	describeColor,
	getInputFields,
	hexToRgb,
	hslToRgb,
	hsvToRgb,
	isColorFormat,
	parseColorString,
	rgbToHex,
	rgbToHsl,
	rgbToHsv,
	type ColorFormat,
	type RgbaColor
} from './color.js';

/** The reference colour used across the upstream docs — `#3b82f6` / `hsl(217, 91%, 60%)`. */
const BLUE: RgbaColor = { r: 59, g: 130, b: 246, a: 1 };

/** Every hue sector boundary, so no `switch` arm of `rgbToHsv`/`hsvToRgb` goes unexercised. */
const HUE_SECTORS = [
	{ hex: '#ff0000', h: 0, rgb: { r: 255, g: 0, b: 0 } },
	{ hex: '#ffff00', h: 60, rgb: { r: 255, g: 255, b: 0 } },
	{ hex: '#00ff00', h: 120, rgb: { r: 0, g: 255, b: 0 } },
	{ hex: '#00ffff', h: 180, rgb: { r: 0, g: 255, b: 255 } },
	{ hex: '#0000ff', h: 240, rgb: { r: 0, g: 0, b: 255 } },
	{ hex: '#ff00ff', h: 300, rgb: { r: 255, g: 0, b: 255 } }
] as const;

function expectClose(actual: RgbaColor, expected: { r: number; g: number; b: number }, within = 1) {
	expect(Math.abs(actual.r - expected.r)).toBeLessThanOrEqual(within);
	expect(Math.abs(actual.g - expected.g)).toBeLessThanOrEqual(within);
	expect(Math.abs(actual.b - expected.b)).toBeLessThanOrEqual(within);
}

describe('hexToRgb / rgbToHex', () => {
	it('round-trips a six-digit hex', () => {
		expect(hexToRgb('#3b82f6')).toEqual(BLUE);
		expect(rgbToHex(BLUE)).toBe('#3b82f6');
	});

	it('accepts a hex with no leading hash', () => {
		expect(hexToRgb('3b82f6')).toEqual(BLUE);
	});

	it('expands three-digit shorthand instead of falling back to black', () => {
		// Upstream's `hexToRgb` regex requires six digits, so `#abc` parses to black even though its
		// own `parseColorString` accepts the shorthand (spec Assumptions, "3-digit hex").
		expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204, a: 1 });
	});

	it('carries the alpha argument through, defaulting to 1', () => {
		expect(hexToRgb('#3b82f6', 0.5)).toEqual({ ...BLUE, a: 0.5 });
		expect(hexToRgb('#3b82f6').a).toBe(1);
	});

	it('falls back to black for an unparseable value, keeping the alpha', () => {
		expect(hexToRgb('not a colour')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
		expect(hexToRgb('#3b82f', 0.25)).toEqual({ r: 0, g: 0, b: 0, a: 0.25 });
	});

	it('zero-pads and lowercases, and drops the alpha', () => {
		expect(rgbToHex({ r: 0, g: 10, b: 255, a: 0.5 })).toBe('#000aff');
		expect(rgbToHex({ r: 255, g: 255, b: 255, a: 1 })).toBe('#ffffff');
	});

	it('rounds fractional channels on the way out', () => {
		expect(rgbToHex({ r: 0.4, g: 15.5, b: 254.6, a: 1 })).toBe('#0010ff');
	});
});

describe('rgbToHsv / hsvToRgb', () => {
	it('reports the hue of every sector boundary', () => {
		for (const sector of HUE_SECTORS) {
			expect(rgbToHsv({ ...sector.rgb, a: 1 })).toEqual({ h: sector.h, s: 100, v: 100, a: 1 });
		}
	});

	it('rebuilds every sector boundary from its hue', () => {
		for (const sector of HUE_SECTORS) {
			expect(hsvToRgb({ h: sector.h, s: 100, v: 100, a: 1 })).toEqual({ ...sector.rgb, a: 1 });
		}
		// h === 360 wraps back onto the first sector rather than falling through the `default` arm.
		expect(hsvToRgb({ h: 360, s: 100, v: 100, a: 1 })).toEqual({ r: 255, g: 0, b: 0, a: 1 });
	});

	it('collapses the hue to 0 on the greyscale axis', () => {
		expect(rgbToHsv({ r: 128, g: 128, b: 128, a: 1 })).toEqual({ h: 0, s: 0, v: 50, a: 1 });
		expect(rgbToHsv({ r: 0, g: 0, b: 0, a: 1 })).toEqual({ h: 0, s: 0, v: 0, a: 1 });
	});

	it('keeps the hue when only the brightness drops, so the crosshair does not jump (R-02)', () => {
		const hsv = rgbToHsv(BLUE);
		expect(hsv).toEqual({ h: 217, s: 76, v: 96, a: 1 });

		const darkened = hsvToRgb({ ...hsv, v: 0 });
		expect(darkened).toEqual({ r: 0, g: 0, b: 0, a: 1 });
		// The HSV pair is authoritative, so the hue survives a trip to black and back.
		expect(hsvToRgb({ ...hsv, v: 96 })).toEqual(hsvToRgb(hsv));
	});

	it('carries the alpha through both directions', () => {
		expect(rgbToHsv({ ...BLUE, a: 0.4 }).a).toBe(0.4);
		expect(hsvToRgb({ h: 217, s: 76, v: 96, a: 0.4 }).a).toBe(0.4);
	});

	it('round-trips within one unit per channel', () => {
		expectClose(hsvToRgb(rgbToHsv(BLUE)), BLUE);
	});
});

describe('rgbToHsl / hslToRgb', () => {
	it('matches the documented hsl notation for the reference colour', () => {
		expect(rgbToHsl(BLUE)).toEqual({ h: 217, s: 91, l: 60 });
	});

	it('reports zero saturation on the greyscale axis', () => {
		expect(rgbToHsl({ r: 128, g: 128, b: 128, a: 1 })).toEqual({ h: 0, s: 0, l: 50 });
	});

	it('reads every hue sector', () => {
		for (const sector of HUE_SECTORS) {
			expect(rgbToHsl({ ...sector.rgb, a: 1 })).toEqual({ h: sector.h, s: 100, l: 50 });
		}
	});

	it('rebuilds every hue sector, applying the alpha argument', () => {
		for (const sector of HUE_SECTORS) {
			expectClose(hslToRgb({ h: sector.h, s: 100, l: 50 }), sector.rgb);
		}
		expect(hslToRgb({ h: 217, s: 91, l: 60 }, 0.5).a).toBe(0.5);
		expect(hslToRgb({ h: 217, s: 91, l: 60 }).a).toBe(1);
	});

	it('round-trips within one unit per channel', () => {
		expectClose(hslToRgb(rgbToHsl(BLUE)), BLUE);
	});
});

describe('colorToString', () => {
	it('renders each format at full opacity', () => {
		expect(colorToString(BLUE, 'hex')).toBe('#3b82f6');
		expect(colorToString(BLUE, 'rgb')).toBe('rgb(59, 130, 246)');
		expect(colorToString(BLUE, 'hsl')).toBe('hsl(217, 91%, 60%)');
		expect(colorToString(BLUE, 'hsb')).toBe('hsb(217, 76%, 96%)');
	});

	it('appends the alpha suffix only below full opacity', () => {
		const translucent = { ...BLUE, a: 0.5 };
		expect(colorToString(translucent, 'rgb')).toBe('rgba(59, 130, 246, 0.5)');
		expect(colorToString(translucent, 'hsl')).toBe('hsla(217, 91%, 60%, 0.5)');
		expect(colorToString(translucent, 'hsb')).toBe('hsba(217, 76%, 96%, 0.5)');
		// Hex never carries alpha — it is what the hidden form input submits (FR-014).
		expect(colorToString(translucent, 'hex')).toBe('#3b82f6');
	});

	it('defaults to hex', () => {
		expect(colorToString(BLUE)).toBe('#3b82f6');
	});
});

describe('parseColorString', () => {
	it('reads six-digit and three-digit hex alike', () => {
		expect(parseColorString('#3b82f6')).toEqual(BLUE);
		expect(parseColorString('#abc')).toEqual({ r: 170, g: 187, b: 204, a: 1 });
	});

	it('reads rgb and rgba notation', () => {
		expect(parseColorString('rgb(59, 130, 246)')).toEqual(BLUE);
		expect(parseColorString('rgba(59, 130, 246, 0.5)')).toEqual({ ...BLUE, a: 0.5 });
	});

	it('reads hsl and hsla notation', () => {
		const parsed = parseColorString('hsl(217, 91%, 60%)');
		expect(parsed).not.toBeNull();
		expectClose(parsed as RgbaColor, BLUE);
		expect(parseColorString('hsla(217, 91%, 60%, 0.25)')?.a).toBe(0.25);
	});

	it('reads hsb and hsba notation', () => {
		const parsed = parseColorString('hsb(217, 76%, 96%)');
		expect(parsed).not.toBeNull();
		expectClose(parsed as RgbaColor, BLUE);
		expect(parseColorString('hsba(217, 76%, 96%, 0.25)')?.a).toBe(0.25);
	});

	it('tolerates surrounding whitespace', () => {
		expect(parseColorString('  #3b82f6  ')).toEqual(BLUE);
	});

	it('rejects garbage, partial hex and unsupported notations', () => {
		expect(parseColorString('')).toBeNull();
		expect(parseColorString('#3b82f')).toBeNull();
		expect(parseColorString('#gggggg')).toBeNull();
		expect(parseColorString('rebeccapurple')).toBeNull();
		expect(parseColorString('rgb(59 130 246)')).toBeNull();
		expect(parseColorString('color(display-p3 1 0 0)')).toBeNull();
	});
});

describe('clampChannel', () => {
	it('clamps to the bounds and rounds', () => {
		expect(clampChannel(-5, 0, 100)).toBe(0);
		expect(clampChannel(140, 0, 100)).toBe(100);
		expect(clampChannel(42.4, 0, 100)).toBe(42);
		expect(clampChannel(42.5, 0, 100)).toBe(43);
	});

	it('returns the lower bound for a non-finite input', () => {
		expect(clampChannel(Number.NaN, 0, 255)).toBe(0);
	});
});

describe('isColorFormat', () => {
	it('narrows the four supported formats', () => {
		expect(COLOR_FORMATS).toEqual(['hex', 'rgb', 'hsl', 'hsb']);
		for (const format of COLOR_FORMATS) {
			expect(isColorFormat(format)).toBe(true);
		}
	});

	it('rejects anything else', () => {
		expect(isColorFormat('HEX')).toBe(false);
		expect(isColorFormat('cmyk')).toBe(false);
		expect(isColorFormat(undefined)).toBe(false);
		expect(isColorFormat(3)).toBe(false);
	});
});

describe('getInputFields', () => {
	const hsv = rgbToHsv(BLUE);

	function fields(format: ColorFormat, withoutAlpha = false) {
		return getInputFields({ format, rgb: BLUE, hsv, withoutAlpha });
	}

	it('describes the hex field set', () => {
		expect(fields('hex')).toEqual([
			{
				channel: 'hex',
				label: 'Hex color value',
				value: '#3b82f6',
				placeholder: '#000000',
				numeric: false,
				position: 'first'
			},
			{
				channel: 'a',
				label: 'Alpha transparency percentage',
				value: '100',
				placeholder: '100',
				numeric: true,
				min: 0,
				max: 100,
				position: 'last'
			}
		]);
	});

	it('collapses the hex field set to a single isolated field without alpha', () => {
		const hexOnly = fields('hex', true);
		expect(hexOnly).toHaveLength(1);
		expect(hexOnly[0]?.position).toBe('isolated');
		expect(hexOnly[0]?.channel).toBe('hex');
	});

	it('describes the rgb field set', () => {
		expect(fields('rgb').map((field) => [field.channel, field.label, field.value])).toEqual([
			['r', 'Red color component (0-255)', '59'],
			['g', 'Green color component (0-255)', '130'],
			['b', 'Blue color component (0-255)', '246'],
			['a', 'Alpha transparency percentage', '100']
		]);
		expect(fields('rgb').map((field) => field.max)).toEqual([255, 255, 255, 100]);
		expect(fields('rgb').every((field) => field.numeric)).toBe(true);
	});

	it('describes the hsl field set', () => {
		expect(fields('hsl').map((field) => [field.channel, field.label, field.value])).toEqual([
			['h', 'Hue degree (0-360)', '217'],
			['s', 'Saturation percentage (0-100)', '91'],
			['l', 'Lightness percentage (0-100)', '60'],
			['a', 'Alpha transparency percentage', '100']
		]);
		expect(fields('hsl').map((field) => field.max)).toEqual([360, 100, 100, 100]);
	});

	it('describes the hsb field set', () => {
		expect(fields('hsb').map((field) => [field.channel, field.label, field.value])).toEqual([
			['h', 'Hue degree (0-360)', '217'],
			['s', 'Saturation percentage (0-100)', '76'],
			['v', 'Brightness percentage (0-100)', '96'],
			['a', 'Alpha transparency percentage', '100']
		]);
		expect(fields('hsb').map((field) => field.max)).toEqual([360, 100, 100, 100]);
	});

	it('assigns first/middle/last across every multi-field set, with and without alpha', () => {
		for (const format of COLOR_FORMATS) {
			expect(fields(format).map((field) => field.position)).toEqual(
				format === 'hex' ? ['first', 'last'] : ['first', 'middle', 'middle', 'last']
			);
			const withoutAlpha = fields(format, true);
			expect(withoutAlpha.map((field) => field.position)).toEqual(
				format === 'hex' ? ['isolated'] : ['first', 'middle', 'last']
			);
			expect(withoutAlpha.some((field) => field.channel === 'a')).toBe(false);
		}
	});

	it('reports the alpha as a whole percentage', () => {
		const translucent = { ...BLUE, a: 0.42 };
		const alpha = getInputFields({
			format: 'rgb',
			rgb: translucent,
			hsv: rgbToHsv(translucent),
			withoutAlpha: false
		}).at(-1);
		expect(alpha?.value).toBe('42');
	});
});

describe('describeColor', () => {
	it('builds the area’s aria-valuetext from the saturation, brightness and formatted colour', () => {
		const hsv = rgbToHsv(BLUE);
		expect(describeColor(BLUE, hsv, 'hex')).toBe('Saturation 76%, brightness 96%, #3b82f6');
		expect(describeColor(BLUE, hsv, 'rgb')).toBe(
			'Saturation 76%, brightness 96%, rgb(59, 130, 246)'
		);
	});
});
