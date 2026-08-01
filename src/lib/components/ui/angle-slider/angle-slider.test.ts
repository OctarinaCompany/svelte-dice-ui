import { render, screen, within } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as AngleSlider from './index.js';
import {
	ARROW_KEYS,
	clamp,
	DEFAULT_END_ANGLE,
	DEFAULT_MAX,
	DEFAULT_MIN,
	DEFAULT_SIZE,
	DEFAULT_START_ANGLE,
	DEFAULT_STEP,
	DEFAULT_THICKNESS,
	describeAngleArc,
	getAngleFromValue,
	getClosestValueIndex,
	getDecimalCount,
	getNextSortedValues,
	getPositionFromAngle,
	getStepsBetweenValues,
	getTotalAngle,
	getValueFromPointer,
	hasMinStepsBetweenValues,
	PAGE_KEYS,
	roundValue,
	snapToStep,
	THUMB_HALO,
	type AngleSliderGeometry,
	type AngleSliderRootState
} from './angle-slider.svelte.js';
import Harness, { type AngleSliderHarnessProps } from './angle-slider.test.svelte';

/** What the harness reports through its `onRefs` callback. */
type HarnessRefs = {
	root: HTMLDivElement | null;
	track: SVGSVGElement | null;
	range: SVGPathElement | null;
};

/** A full circle spanning `0…360`, so a dial angle in degrees reads as the value itself. */
const DEGREES = { min: 0, max: 360, step: 1 } as const;

/** The geometry every coordinate helper below assumes: the {@link DEGREES} dial at its defaults. */
const FULL: AngleSliderGeometry = {
	min: 0,
	max: 360,
	inverted: false,
	startAngle: -90,
	endAngle: 270
};

/** The 200 × 200 box every pointer test measures against; jsdom itself reports a zero-size one. */
const RECT: DOMRect = {
	left: 0,
	top: 0,
	width: 200,
	height: 200,
	right: 200,
	bottom: 200,
	x: 0,
	y: 0,
	toJSON: () => ({})
};

/** Pointer capture is a no-op in jsdom, but the root's move/up handlers key off it. */
const captured = new Set<Element>();

beforeEach(() => {
	captured.clear();
	vi.spyOn(Element.prototype, 'setPointerCapture').mockImplementation(function (this: Element) {
		captured.add(this);
	});
	vi.spyOn(Element.prototype, 'hasPointerCapture').mockImplementation(function (this: Element) {
		return captured.has(this);
	});
	vi.spyOn(Element.prototype, 'releasePointerCapture').mockImplementation(function (this: Element) {
		captured.delete(this);
	});
});

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

/** Renders the harness and stubs the root's layout box, which jsdom otherwise reports as 0 × 0. */
function setup(props: AngleSliderHarnessProps = {}, rect: Partial<DOMRect> = {}) {
	const result = render(Harness, { props });
	const root = byTestId(result.container, 'root');
	vi.spyOn(root, 'getBoundingClientRect').mockImplementation(
		() => ({ ...RECT, ...rect }) as DOMRect
	);
	return { ...result, root };
}

/** jsdom ships no `PointerEvent`; a `MouseEvent` carries the same coordinates to the handlers. */
function pointer(target: Element, type: string, clientX: number, clientY: number) {
	target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY }));
	flushSync();
}

/** The client coordinates, inside {@link RECT}, at which the dial reads `value`. */
function pointAt(value: number, geometry: AngleSliderGeometry = FULL): [number, number] {
	const radians = (getAngleFromValue(value, geometry) * Math.PI) / 180;
	return [100 + 100 * Math.cos(radians), 100 + 100 * Math.sin(radians)];
}

/** `pointerdown` → `pointermove`* → `pointerup`, all on the same target, as a real drag would be. */
function drag(target: Element, ...points: Array<[number, number]>) {
	const first = points[0];
	if (!first) throw new Error('a drag needs at least one point');

	pointer(target, 'pointerdown', first[0], first[1]);
	for (const [x, y] of points.slice(1)) pointer(target, 'pointermove', x, y);

	const last = points[points.length - 1] ?? first;
	pointer(target, 'pointerup', last[0], last[1]);
}

/** Centre and radius of the default dial (`size` 60): `size + THUMB_HALO` and `size`. */
const CENTRE = DEFAULT_SIZE + THUMB_HALO;

/** The point on the default dial's rail at `angle`, in the root's own coordinate space. */
function onRail(angle: number): { x: number; y: number } {
	const radians = (angle * Math.PI) / 180;
	return {
		x: CENTRE + DEFAULT_SIZE * Math.cos(radians),
		y: CENTRE + DEFAULT_SIZE * Math.sin(radians)
	};
}

/**
 * A single-arc `d` (`M sx sy A r r 0 largeArc sweep ex ey`) taken apart, plus the angle it actually
 * paints — which is the side of the circle the sweep flag selects, not just the gap between the
 * endpoints.
 */
function parseArc(path: string, centre = CENTRE) {
	const tokens = path.split(/\s+/);
	if (tokens.length !== 11 || tokens[0] !== 'M' || tokens[3] !== 'A') {
		throw new Error(`not a single-arc path: ${path}`);
	}

	const [startX, startY, radius, largeArcFlag, sweepFlag, endX, endY] = [
		Number(tokens[1]),
		Number(tokens[2]),
		Number(tokens[4]),
		Number(tokens[7]),
		Number(tokens[8]),
		Number(tokens[9]),
		Number(tokens[10])
	];

	const angleAt = (x: number, y: number) =>
		((Math.atan2(y - centre, x - centre) * 180) / Math.PI + 360) % 360;
	const startDegrees = angleAt(startX, startY);
	const endDegrees = angleAt(endX, endY);

	return {
		startX,
		startY,
		endX,
		endY,
		radius,
		largeArcFlag,
		sweepFlag,
		sweptAngle:
			sweepFlag === 1
				? (endDegrees - startDegrees + 360) % 360
				: (startDegrees - endDegrees + 360) % 360
	};
}

const thumbs = () => screen.getAllByRole('slider');
const thumbValue = (index = 0) => thumbs()[index]?.getAttribute('aria-valuenow');
const thumbValues = () => thumbs().map((thumb) => thumb.getAttribute('aria-valuenow'));

describe('AngleSlider pointer interaction (S1)', () => {
	it.each([
		[100, 0, '0'],
		[200, 100, '90'],
		[100, 200, '180'],
		[0, 100, '270'],
		[170.7, 29.3, '45']
	])('maps a pointer at (%s, %s) to %s°', (clientX, clientY, expected) => {
		const { root } = setup({ defaultValue: [0], ...DEGREES });

		pointer(root, 'pointerdown', clientX, clientY);

		expect(thumbValue()).toBe(expected);
	});

	it('crosses the 0/360 seam without visiting any value in between', () => {
		const onValueChange = vi.fn();
		const { root } = setup({ defaultValue: [0], ...DEGREES, onValueChange });

		pointer(root, 'pointerdown', 93, 0);
		pointer(root, 'pointermove', 107, 0);

		expect(onValueChange.mock.calls).toEqual([[[356]], [[4]]]);
		expect(thumbValue()).toBe('4');
	});

	it('fires onValueChange on every accepted move and onValueCommit once on pointerup', () => {
		const onValueChange = vi.fn();
		const onValueCommit = vi.fn();
		const { root } = setup({ defaultValue: [0], ...DEGREES, onValueChange, onValueCommit });

		drag(root, [200, 100], [100, 200], [0, 100]);

		expect(onValueChange.mock.calls).toEqual([[[90]], [[180]], [[270]]]);
		expect(onValueCommit).toHaveBeenCalledTimes(1);
		expect(onValueCommit).toHaveBeenCalledWith([270]);
	});

	it('does not commit when the drag ends on the value it started from', () => {
		const onValueChange = vi.fn();
		const onValueCommit = vi.fn();
		const { root } = setup({ defaultValue: [0], ...DEGREES, onValueChange, onValueCommit });

		drag(root, [100, 0]);

		expect(onValueChange).not.toHaveBeenCalled();
		expect(onValueCommit).not.toHaveBeenCalled();
	});

	it('focuses a thumb pressed directly and changes no value', () => {
		const onValueChange = vi.fn();
		const onValueCommit = vi.fn();
		setup({ defaultValue: [90, 270], ...DEGREES, onValueChange, onValueCommit });

		const second = thumbs()[1] as HTMLElement;
		pointer(second, 'pointerdown', ...pointAt(270));
		pointer(second, 'pointerup', ...pointAt(270));

		expect(document.activeElement).toBe(second);
		expect(onValueChange).not.toHaveBeenCalled();
		expect(onValueCommit).not.toHaveBeenCalled();
		expect(thumbValues()).toEqual(['90', '270']);
	});

	it('moves the thumb closest to the pressed angle and leaves the other one alone', () => {
		const { root } = setup({ defaultValue: [90, 270], ...DEGREES });

		pointer(root, 'pointerdown', ...pointAt(45));

		expect(thumbValues()).toEqual(['45', '270']);
	});
});

describe('AngleSlider keyboard interaction (S2)', () => {
	async function focusThumb(props: AngleSliderHarnessProps = {}) {
		const user = userEvent.setup();
		const rendered = setup({ defaultValue: [45], ...DEGREES, ...props });
		await user.tab();
		return { user, ...rendered };
	}

	it.each([
		['{ArrowRight}', '46'],
		['{ArrowUp}', '46'],
		['{ArrowLeft}', '44'],
		['{ArrowDown}', '44'],
		['{PageUp}', '55'],
		['{PageDown}', '35'],
		['{Shift>}{ArrowRight}{/Shift}', '55'],
		['{Shift>}{ArrowLeft}{/Shift}', '35'],
		['{Shift>}{ArrowUp}{/Shift}', '55'],
		['{Shift>}{ArrowDown}{/Shift}', '35'],
		['{Home}', '0'],
		['{End}', '360']
	])('moves the active thumb with %s to %s°', async (keys, expected) => {
		const { user } = await focusThumb();

		await user.keyboard(keys);

		expect(thumbValue()).toBe(expected);
	});

	it('commits every handled key press', async () => {
		const onValueCommit = vi.fn();
		const { user } = await focusThumb({ onValueCommit });

		await user.keyboard('{ArrowRight}');
		await user.keyboard('{PageUp}');

		expect(onValueCommit.mock.calls).toEqual([[[46]], [[56]]]);
	});

	it('calls preventDefault on every handled key and on no other key', async () => {
		const { user } = await focusThumb();

		const prevented: Array<[string, boolean]> = [];
		const record = (event: KeyboardEvent) => prevented.push([event.key, event.defaultPrevented]);
		document.addEventListener('keydown', record);

		for (const keys of [
			'{ArrowRight}',
			'{ArrowDown}',
			'{PageUp}',
			'{PageDown}',
			'{Home}',
			'{End}',
			'{Enter}'
		]) {
			await user.keyboard(keys);
		}

		document.removeEventListener('keydown', record);

		expect(prevented).toEqual([
			['ArrowRight', true],
			['ArrowDown', true],
			['PageUp', true],
			['PageDown', true],
			['Home', true],
			['End', true],
			['Enter', false]
		]);
	});

	it.each([
		['{ArrowRight}', '44'],
		['{ArrowUp}', '44'],
		['{ArrowLeft}', '46'],
		['{ArrowDown}', '46'],
		['{PageUp}', '35'],
		['{PageDown}', '55']
	])('flips the sign of %s to %s° when inverted', async (keys, expected) => {
		const { user } = await focusThumb({ inverted: true });

		await user.keyboard(keys);

		expect(thumbValue()).toBe(expected);
	});

	it('runs the caller onkeydown first and lets preventDefault cancel the built-in handling', async () => {
		const onkeydown = vi.fn((event: KeyboardEvent) => event.preventDefault());
		const { user } = await focusThumb({ onkeydown });

		await user.keyboard('{ArrowRight}');

		expect(onkeydown).toHaveBeenCalledOnce();
		expect(thumbValue()).toBe('45');
	});
});

describe('AngleSlider accessibility (S7)', () => {
	it('exposes role, value bounds and orientation on every thumb', () => {
		setup({ defaultValue: [45, 200], ...DEGREES });

		const [first, second] = thumbs();
		expect(first).toHaveAttribute('aria-valuemin', '0');
		expect(first).toHaveAttribute('aria-valuenow', '45');
		expect(first).toHaveAttribute('aria-valuemax', '360');
		expect(first).toHaveAttribute('aria-orientation', 'vertical');
		expect(first).toHaveAttribute('tabindex', '0');
		expect(first).toHaveAttribute('data-index', '0');
		expect(second).toHaveAttribute('aria-valuenow', '200');
		expect(second).toHaveAttribute('data-index', '1');
	});

	it('drops the thumb out of the tab order when disabled', () => {
		setup({ defaultValue: [45], ...DEGREES, disabled: true });

		expect(thumbs()[0]).not.toHaveAttribute('tabindex');
	});

	it('renders `${value}°` for a single thumb', () => {
		const { container } = setup({ defaultValue: [45], ...DEGREES });

		expect(bySlot(container, 'angle-slider-value')).toHaveTextContent('45°');
	});

	it('renders the smallest and largest current values — not min and max — for two thumbs', () => {
		const { container } = setup({ defaultValue: [270, 90], ...DEGREES });

		expect(bySlot(container, 'angle-slider-value').textContent).toBe('90° - 270°');
	});

	it('replaces the default degree sign with a custom unit, on one thumb and on two', () => {
		const single = setup({ defaultValue: [45], ...DEGREES, unit: ' rad' });
		expect(bySlot(single.container, 'angle-slider-value').textContent).toBe('45 rad');
		single.unmount();

		const pair = setup({ defaultValue: [270, 90], ...DEGREES, unit: ' rad' });
		expect(bySlot(pair.container, 'angle-slider-value').textContent).toBe('90 rad - 270 rad');
	});

	it('lets explicit children win over the computed readout and over formatValue', () => {
		const { container } = setup({
			defaultValue: [45],
			...DEGREES,
			unit: '°',
			formatValue: () => 'never rendered',
			valueChildren: 'North-east'
		});

		const value = bySlot(container, 'angle-slider-value');
		expect(value).toHaveTextContent('North-east');
		expect(value.textContent).not.toContain('45');
		expect(value.textContent).not.toContain('never rendered');
	});

	it('lets formatValue override the computed readout', () => {
		const { container } = setup({
			defaultValue: [45],
			...DEGREES,
			formatValue: (value) => `rotated ${value as number} degrees`
		});

		expect(bySlot(container, 'angle-slider-value')).toHaveTextContent('rotated 45 degrees');
	});

	it('throws when Thumb is rendered without a Root above it', () => {
		expect(() => render(AngleSlider.Thumb)).toThrow(/within/);
	});

	it('throws when Track is rendered without a Root above it', () => {
		expect(() => render(AngleSlider.Track)).toThrow(/within/);
	});

	it('throws when Range is rendered without a Root above it', () => {
		expect(() => render(AngleSlider.Range)).toThrow(/within/);
	});

	it('throws when Value is rendered without a Root above it', () => {
		expect(() => render(AngleSlider.Value)).toThrow(/within/);
	});
});

describe('AngleSlider controlled and uncontrolled value (S3)', () => {
	it('seeds from defaultValue and moves on its own while reporting every change', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const { root } = setup({ defaultValue: [45], ...DEGREES, onValueChange });

		expect(thumbValue()).toBe('45');
		pointer(root, 'pointerdown', ...pointAt(90));
		await user.tab();
		await user.keyboard('{ArrowRight}');

		expect(onValueChange.mock.calls).toEqual([[[90]], [[91]]]);
		expect(thumbValue()).toBe('91');
	});

	it('writes through a bind:value binding so the parent state follows the dial', () => {
		const { container, root } = setup({ mode: 'bind', value: [45], ...DEGREES });

		pointer(root, 'pointerdown', ...pointAt(180));

		expect(byTestId(container, 'mirror')).toHaveTextContent('180');
		expect(thumbValue()).toBe('180');
	});

	it('stays put when the caller’s setter declines the write, but still reports it', () => {
		const onValueChange = vi.fn();
		const { root } = setup({ mode: 'decline', value: [45], ...DEGREES, onValueChange });

		pointer(root, 'pointerdown', ...pointAt(180));

		expect(onValueChange).toHaveBeenCalledTimes(1);
		expect(onValueChange).toHaveBeenCalledWith([180]);
		expect(thumbValue()).toBe('45');
	});
});

describe('AngleSlider two-thumb ranges (S4)', () => {
	const RANGE = {
		defaultValue: [90, 270],
		min: 0,
		max: 360,
		step: 5,
		minStepsBetweenThumbs: 2
	} satisfies AngleSliderHarnessProps;

	it('renders two independently focusable thumbs and a range spanning the sorted values', async () => {
		const user = userEvent.setup();
		const { container } = setup(RANGE);

		expect(thumbs()).toHaveLength(2);

		await user.tab();
		expect(document.activeElement).toBe(thumbs()[0]);
		await user.tab();
		expect(document.activeElement).toBe(thumbs()[1]);

		expect(bySlot(container, 'angle-slider-range')).toHaveAttribute(
			'd',
			describeAngleArc(80, 60, getAngleFromValue(90, FULL), getAngleFromValue(270, FULL))
		);
	});

	it('stops one thumb exactly minStepsBetweenThumbs away and never lets it cross', () => {
		const onValueChange = vi.fn();
		const onValueCommit = vi.fn();
		const { root } = setup({
			...RANGE,
			defaultValue: [90, 110],
			onValueChange,
			onValueCommit
		});

		// 100° still leaves the required 10°; 105° would leave 5°, so that write is discarded whole.
		pointer(root, 'pointerdown', ...pointAt(100));
		pointer(root, 'pointermove', ...pointAt(105));

		expect(onValueChange).toHaveBeenCalledTimes(1);
		expect(onValueChange).toHaveBeenCalledWith([100, 110]);
		expect(onValueCommit).not.toHaveBeenCalled();
		expect(thumbValues()).toEqual(['100', '110']);
	});

	it('moves only the focused thumb when a key is pressed', async () => {
		const user = userEvent.setup();
		setup(RANGE);

		await user.tab();
		await user.tab();
		await user.keyboard('{ArrowRight}');

		expect(thumbValues()).toEqual(['90', '275']);
	});

	it('renders no range at all when both ends are equal', () => {
		const { container } = setup({ defaultValue: [0], ...DEGREES });

		expect(container.querySelector('[data-slot="angle-slider-range"]')).toBeNull();
	});
});

describe('AngleSlider direction and geometry (S7)', () => {
	it('swaps the horizontal arrows under dir="rtl" and leaves the vertical ones alone', async () => {
		const user = userEvent.setup();
		setup({ defaultValue: [45], ...DEGREES, rtl: true });

		await user.tab();
		await user.keyboard('{ArrowRight}');
		expect(thumbValue()).toBe('44');

		await user.keyboard('{ArrowLeft}');
		expect(thumbValue()).toBe('45');

		await user.keyboard('{ArrowUp}');
		expect(thumbValue()).toBe('46');

		await user.keyboard('{ArrowDown}');
		expect(thumbValue()).toBe('45');
	});

	it('lets an explicit dir prop override the inherited DirectionProvider', async () => {
		const user = userEvent.setup();
		const { root } = setup({ defaultValue: [45], ...DEGREES, rtlProvider: true, dir: 'ltr' });

		expect(root).toHaveAttribute('dir', 'ltr');

		await user.tab();
		await user.keyboard('{ArrowRight}');

		expect(thumbValue()).toBe('46');
	});

	it('renders the rail as a circle for a full sweep', () => {
		const { container } = setup({ defaultValue: [0], ...DEGREES });

		expect(bySlot(container, 'angle-slider-track-rail').tagName).toBe('circle');
	});

	it('renders the rail as an arc path for a partial sweep', () => {
		const { container } = setup({ defaultValue: [0], ...DEGREES, startAngle: -90, endAngle: 90 });

		const rail = bySlot(container, 'angle-slider-track-rail');
		expect(rail.tagName).toBe('path');
		expect(rail).toHaveAttribute('d', describeAngleArc(80, 60, -90, 90));
	});

	it('derives the track box from size and the stroke from thickness', () => {
		const { container } = setup({ defaultValue: [0], ...DEGREES, size: 40, thickness: 12 });

		const track = bySlot(container, 'angle-slider-track');
		expect(track).toHaveAttribute('width', '120');
		expect(track).toHaveAttribute('height', '120');
		expect(bySlot(container, 'angle-slider-track-rail')).toHaveAttribute('stroke-width', '12');
	});

	it.each([
		[false, 90, 90, 0, 1],
		[true, 90, 90, 0, 0],
		[false, 270, 270, 1, 1],
		[true, 270, 270, 1, 0]
	])(
		'sweeps exactly the selected side (inverted=%s, value=%s°) — %s° of arc, large-arc %s, sweep-flag %s',
		(inverted, value, sweptAngle, largeArcFlag, sweepFlag) => {
			const { container } = setup({ defaultValue: [value], ...DEGREES, inverted });

			const geometry: AngleSliderGeometry = { ...FULL, inverted };
			const arc = parseArc(bySlot(container, 'angle-slider-range').getAttribute('d') ?? '');

			// The painted side, not merely the two endpoints: a clockwise sweep on an inverted dial
			// joins the very same points while filling the complement of the selection.
			expect(arc.sweptAngle).toBeCloseTo(sweptAngle, 6);
			expect(arc.largeArcFlag).toBe(largeArcFlag);
			expect(arc.sweepFlag).toBe(sweepFlag);

			// It starts at `min` and ends on the thumb, in that order, at both ends.
			const start = onRail(getAngleFromValue(0, geometry));
			expect(arc.startX).toBeCloseTo(start.x, 6);
			expect(arc.startY).toBeCloseTo(start.y, 6);

			const style = bySlot(container, 'angle-slider-thumb-wrapper').style;
			expect(arc.endX).toBeCloseTo(Number.parseFloat(style.left), 6);
			expect(arc.endY).toBeCloseTo(Number.parseFloat(style.top), 6);
		}
	);

	it('sweeps only between the two thumbs of an inverted range, never around the outside', () => {
		const { container } = setup({ defaultValue: [90, 180], ...DEGREES, inverted: true });

		const arc = parseArc(bySlot(container, 'angle-slider-range').getAttribute('d') ?? '');

		expect(arc.sweptAngle).toBeCloseTo(90, 6);
		expect(arc.sweepFlag).toBe(0);
		expect(arc.largeArcFlag).toBe(0);
	});
});

describe('AngleSlider guard rails and form participation (S5, S6)', () => {
	it('suppresses pointer and keyboard interaction when disabled', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const { root, container } = setup({
			defaultValue: [45],
			...DEGREES,
			disabled: true,
			onValueChange
		});

		pointer(root, 'pointerdown', ...pointAt(90));
		thumbs()[0]?.focus();
		await user.keyboard('{ArrowRight}');

		expect(onValueChange).not.toHaveBeenCalled();
		expect(thumbValue()).toBe('45');
		expect(root).toHaveAttribute('data-disabled', '');
		expect(thumbs()[0]).toHaveAttribute('aria-disabled', 'true');
		expect(bySlot(container, 'angle-slider-track')).toHaveAttribute('data-disabled', '');
	});

	it('suppresses interaction when readOnly while keeping the thumb focusable', async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		const { root } = setup({ defaultValue: [45], ...DEGREES, readOnly: true, onValueChange });

		pointer(root, 'pointerdown', ...pointAt(90));
		await user.tab();
		await user.keyboard('{ArrowRight}');

		expect(document.activeElement).toBe(thumbs()[0]);
		expect(onValueChange).not.toHaveBeenCalled();
		expect(thumbValue()).toBe('45');
		expect(root).toHaveAttribute('data-readonly', '');
		expect(thumbs()[0]).toHaveAttribute('aria-readonly', 'true');
	});

	it('carries a single thumb’s value into the form under its own name', () => {
		const { container } = setup({
			defaultValue: [45],
			...DEGREES,
			wrapInForm: true,
			name: 'rotation'
		});

		const form = byTestId(container, 'form') as HTMLFormElement;
		expect(new FormData(form).get('rotation')).toBe('45');
		expect(new FormData(form).get('rotation')).toBe(thumbValue());
	});

	it('submits two thumbs as name[] in sorted order', () => {
		const { container } = setup({
			defaultValue: [90, 270],
			...DEGREES,
			wrapInForm: true,
			name: 'range'
		});

		const form = byTestId(container, 'form') as HTMLFormElement;
		expect(new FormData(form).getAll('range[]')).toEqual(['90', '270']);
	});

	it('excludes a disabled dial from the form data', () => {
		const { container } = setup({
			defaultValue: [45],
			...DEGREES,
			wrapInForm: true,
			name: 'rotation',
			disabled: true
		});

		const form = byTestId(container, 'form') as HTMLFormElement;
		expect(new FormData(form).get('rotation')).toBeNull();
	});

	it('keeps a readOnly dial in the form data', () => {
		const { container } = setup({
			defaultValue: [45],
			...DEGREES,
			wrapInForm: true,
			name: 'rotation',
			readOnly: true
		});

		const form = byTestId(container, 'form') as HTMLFormElement;
		expect(new FormData(form).get('rotation')).toBe('45');
	});

	it('renders no hidden input outside a form and without a form prop', () => {
		const { container } = setup({ defaultValue: [45], ...DEGREES, name: 'rotation' });

		expect(container.querySelector('[data-slot="angle-slider-hidden-input"]')).toBeNull();
	});

	it('submits with a sibling form the dial only points at through the form prop', () => {
		const { container } = setup({
			defaultValue: [45],
			...DEGREES,
			name: 'rotation',
			siblingForm: 'remote-form',
			form: 'remote-form'
		});

		const dial = bySlot(container, 'angle-slider');
		const form = byTestId(container, 'sibling-form') as HTMLFormElement;
		// The dial is a sibling of the form, not a descendant: only the `form` prop associates them.
		expect(form.contains(dial)).toBe(false);

		const input = bySlot(container, 'angle-slider-hidden-input');
		expect(input).toHaveAttribute('form', 'remote-form');
		expect(new FormData(form).get('rotation')).toBe('45');
	});

	it('keeps the hidden input out of the accessibility tree and the tab order', () => {
		const { container } = setup({
			defaultValue: [90, 270],
			...DEGREES,
			wrapInForm: true,
			name: 'range'
		});

		const inputs = container.querySelectorAll('[data-slot="angle-slider-hidden-input"]');
		expect(inputs).toHaveLength(2);
		for (const input of inputs) {
			// An unlabelled numeric input must never surface beside a thumb (D-05).
			expect(input).toHaveAttribute('aria-hidden', 'true');
			expect(input).toHaveAttribute('tabindex', '-1');
		}
		expect(within(container).getAllByRole('slider')).toHaveLength(2);
		expect(within(container).queryAllByRole('spinbutton')).toHaveLength(0);
	});

	it('keeps the track svg out of the accessibility tree and unfocusable', () => {
		const { container } = setup({ defaultValue: [45], ...DEGREES });

		const track = bySlot(container, 'angle-slider-track');
		expect(track).toHaveAttribute('aria-hidden', 'true');
		expect(track).toHaveAttribute('focusable', 'false');
	});
});

describe('AngleSlider teardown', () => {
	it('unregisters every thumb from the root state when the dial unmounts', () => {
		let state: AngleSliderRootState | undefined;
		const { unmount } = setup({
			defaultValue: [45, 200],
			...DEGREES,
			onRootState: (next) => {
				state = next;
			}
		});

		expect(state?.thumbs.size).toBe(2);

		unmount();

		expect(state?.thumbs.size).toBe(0);
	});

	it('registers only the thumbs that have a value behind them', () => {
		let state: AngleSliderRootState | undefined;
		const { container } = setup({
			defaultValue: [45],
			...DEGREES,
			thumbIndices: [0, 1],
			onRootState: (next) => {
				state = next;
			}
		});

		expect(state?.thumbs.size).toBe(1);
		expect(state?.thumbs.get(0)?.element).toBe(bySlot(container, 'angle-slider-thumb-wrapper'));
	});

	it('disconnects the hidden input’s ResizeObserver on unmount', () => {
		// `tests/setup.ts` installs the shim in `beforeAll`, so it can only be captured from inside a
		// test — at module scope jsdom still has no `ResizeObserver` at all.
		const OriginalResizeObserver = globalThis.ResizeObserver;
		const observers: ResizeObserver[] = [];
		const disconnect = vi.spyOn(OriginalResizeObserver.prototype, 'disconnect');
		const construct = vi.spyOn(globalThis, 'ResizeObserver').mockImplementation(function (
			callback: ResizeObserverCallback
		) {
			const observer = new OriginalResizeObserver(callback);
			observers.push(observer);
			return observer;
		} as unknown as typeof ResizeObserver);

		const { unmount } = setup({
			defaultValue: [45],
			...DEGREES,
			wrapInForm: true,
			name: 'rotation'
		});

		expect(construct).toHaveBeenCalledTimes(1);
		expect(disconnect).not.toHaveBeenCalled();

		unmount();

		expect(disconnect).toHaveBeenCalledTimes(1);
		expect(disconnect.mock.instances[0]).toBe(observers[0]);
	});
});

describe('AngleSlider child mode', () => {
	it('lands the merged root props on the caller’s element and keeps it interactive', async () => {
		const user = userEvent.setup();
		const { container, root } = setup({ defaultValue: [45], ...DEGREES, useRootChild: true });

		expect(root.tagName).toBe('SECTION');
		expect(root).toHaveAttribute('data-slot', 'angle-slider');
		expect(root).toHaveAttribute('dir', 'ltr');
		expect(root).toHaveClass('relative', 'touch-none', 'select-none');
		expect(root.style.width).toBe('160px');
		expect(root.style.height).toBe('160px');
		// The default `<div>` is gone: the section is the only root in the tree.
		expect(container.querySelectorAll('[data-slot="angle-slider"]')).toHaveLength(1);

		pointer(root, 'pointerdown', ...pointAt(90));
		expect(thumbValue()).toBe('90');

		await user.tab();
		await user.keyboard('{ArrowRight}');
		expect(thumbValue()).toBe('91');
	});

	it('still inherits dir from an ancestor when the root renders through child', async () => {
		const user = userEvent.setup();
		const { root } = setup({ defaultValue: [45], ...DEGREES, useRootChild: true, rtl: true });

		expect(root).toHaveAttribute('dir', 'rtl');

		await user.tab();
		await user.keyboard('{ArrowRight}');

		expect(thumbValue()).toBe('44');
	});

	it('keeps a child thumb registered, focusable and targeted by the pointer', async () => {
		const user = userEvent.setup();
		let state: AngleSliderRootState | undefined;
		setup({
			defaultValue: [90, 270],
			...DEGREES,
			useThumbChild: true,
			onRootState: (next) => {
				state = next;
			}
		});

		const [first, second] = thumbs();
		expect(first?.tagName).toBe('SPAN');
		expect(state?.thumbs.size).toBe(2);
		// Registration lives on the positioned wrapper, so it survives `child` (research R-10).
		expect(state?.thumbs.get(1)?.element).toBe(second?.parentElement);

		// A pointerdown on the child element still resolves to its own index…
		pointer(second as Element, 'pointerdown', ...pointAt(270));
		expect(document.activeElement).toBe(second);
		expect(state?.valueIndexToChange).toBe(1);

		// …and Home/End then act on that thumb, not on index 0.
		await user.keyboard('{Home}');
		expect(thumbValues()).toEqual(['0', '90']);
		await user.keyboard('{End}');
		expect(thumbValues()).toEqual(['90', '360']);
	});

	it('hands the computed readout props to a child value', () => {
		const { container } = setup({
			defaultValue: [45],
			...DEGREES,
			useValueChild: true,
			valueChildren: 'own text'
		});

		const value = bySlot(container, 'angle-slider-value');
		expect(value.tagName).toBe('SPAN');
		expect(value).toHaveAttribute('data-testid', 'value-child');
		expect(value).toHaveClass('pointer-events-none', 'select-none');
		expect(value.style.position).toBe('absolute');
		expect(value.style.left).toBe('80px');
		expect(value.style.top).toBe('80px');
		expect(value).toHaveTextContent('own text');
	});
});

describe('AngleSlider refs', () => {
	it('binds the root, track and range refs to their rendered elements', () => {
		let refs: HarnessRefs | undefined;
		const { container } = setup({
			defaultValue: [90],
			...DEGREES,
			onRefs: (next) => {
				refs = next;
			}
		});

		expect(refs?.root).toBe(bySlot(container, 'angle-slider'));
		expect(refs?.track).toBe(bySlot(container, 'angle-slider-track'));
		expect(refs?.range).toBe(bySlot(container, 'angle-slider-range'));
		// The two SVG refs really are SVG nodes, not the `HTMLElement` the other parts hand back.
		// (jsdom ships no `SVGPathElement` global, so the namespace and tag name stand in for it.)
		expect(refs?.track).toBeInstanceOf(SVGSVGElement);
		expect(refs?.track?.namespaceURI).toBe('http://www.w3.org/2000/svg');
		expect(refs?.range?.namespaceURI).toBe('http://www.w3.org/2000/svg');
		expect(refs?.range?.tagName).toBe('path');
	});

	it('leaves the root ref null when the dial renders through its child snippet', () => {
		let refs: HarnessRefs | undefined;
		setup({
			defaultValue: [90],
			...DEGREES,
			useRootChild: true,
			onRefs: (next) => {
				refs = next;
			}
		});

		expect(refs?.root).toBeNull();
		expect(refs?.track).not.toBeNull();
	});
});

describe('AngleSlider edge cases', () => {
	it('keeps the last valid value when the pointer lands on the exact centre', () => {
		const onValueChange = vi.fn();
		const { root } = setup({ defaultValue: [45], ...DEGREES, onValueChange });

		pointer(root, 'pointerdown', 100, 100);

		expect(onValueChange).not.toHaveBeenCalled();
		expect(thumbValue()).toBe('45');
	});

	it('treats every pointer event as a no-op while the box is zero-size', () => {
		const onValueChange = vi.fn();
		const { root } = setup(
			{ defaultValue: [45], ...DEGREES, onValueChange },
			{ width: 0, height: 0 }
		);

		drag(root, [200, 100], [100, 200]);

		expect(onValueChange).not.toHaveBeenCalled();
		expect(thumbValue()).toBe('45');
	});

	it('re-measures the root between interactions instead of caching its box', () => {
		const { root } = setup({ defaultValue: [0], ...DEGREES });

		pointer(root, 'pointerdown', 200, 100);
		expect(thumbValue()).toBe('90');

		// The dial moves 400px right; the same client coordinates now sit elsewhere on it.
		vi.spyOn(root, 'getBoundingClientRect').mockImplementation(
			() => ({ ...RECT, left: 400, right: 600, x: 400 }) as DOMRect
		);
		pointer(root, 'pointerdown', 500, 0);

		expect(thumbValue()).toBe('0');
	});

	it('snaps and clamps when max is not a whole number of steps from min', async () => {
		const user = userEvent.setup();
		setup({ defaultValue: [0], min: 0, max: 100, step: 30 });

		await user.tab();
		await user.keyboard('{PageUp}');
		expect(thumbValue()).toBe('100');

		await user.keyboard('{PageDown}');
		expect(thumbValue()).toBe('0');
	});

	it('rounds fractional steps to the step’s own precision', async () => {
		const user = userEvent.setup();
		setup({ defaultValue: [0], min: 0, max: 1, step: 0.1 });

		await user.tab();
		await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');

		expect(thumbValue()).toBe('0.3');
	});

	it('renders both thumbs when they start equal and rejects the first violating move', () => {
		const onValueChange = vi.fn();
		const onValueCommit = vi.fn();
		const { root } = setup({
			defaultValue: [90, 90],
			min: 0,
			max: 360,
			step: 5,
			minStepsBetweenThumbs: 2,
			onValueChange,
			onValueCommit
		});

		expect(thumbs()).toHaveLength(2);

		// 95° leaves a 5° gap where 10° is required, so the whole write is discarded.
		pointer(root, 'pointerdown', ...pointAt(95));

		expect(onValueChange).not.toHaveBeenCalled();
		expect(onValueCommit).not.toHaveBeenCalled();
	});

	it('renders only the thumbs it was asked for', () => {
		const { container } = setup({ defaultValue: [45, 200], ...DEGREES, thumbIndices: [0] });

		const rendered = within(container).getAllByRole('slider');
		expect(rendered).toHaveLength(1);
		expect(rendered[0]).toHaveAttribute('aria-valuenow', '45');
	});

	it('renders nothing for a thumb index with no value behind it', () => {
		const { container } = setup({ defaultValue: [45], ...DEGREES, thumbIndices: [0, 5] });

		expect(within(container).getAllByRole('slider')).toHaveLength(1);
	});
});

describe('angle-slider arithmetic', () => {
	it('exposes the documented defaults and key groups', () => {
		expect([
			DEFAULT_MIN,
			DEFAULT_MAX,
			DEFAULT_STEP,
			DEFAULT_SIZE,
			DEFAULT_THICKNESS,
			DEFAULT_START_ANGLE,
			DEFAULT_END_ANGLE,
			THUMB_HALO
		]).toEqual([0, 100, 1, 60, 8, -90, 270, 20]);
		expect(PAGE_KEYS).toEqual(['PageUp', 'PageDown']);
		expect(ARROW_KEYS).toEqual(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
	});

	it('clamps into the closed range', () => {
		expect([clamp(5, 0, 10), clamp(-5, 0, 10), clamp(15, 0, 10)]).toEqual([5, 0, 10]);
	});

	it('counts a step’s decimals and rounds to them', () => {
		expect([getDecimalCount(1), getDecimalCount(0.5), getDecimalCount(0.125)]).toEqual([0, 1, 3]);
		expect(roundValue(0.30000000000000004, 1)).toBe(0.3);
	});

	it('snaps to the step and clamps to the bounds', () => {
		expect(snapToStep(47, 0, 360, 5)).toBe(45);
		expect(snapToStep(48, 0, 360, 5)).toBe(50);
		expect(snapToStep(-20, 0, 360, 5)).toBe(0);
		expect(snapToStep(400, 0, 360, 5)).toBe(360);
		expect(snapToStep(0.3, 0, 1, 0.1)).toBe(0.3);
		expect(snapToStep(110, 0, 100, 30)).toBe(100);
	});

	it('replaces a value at an index and re-sorts', () => {
		expect(getNextSortedValues([90, 270], 300, 0)).toEqual([270, 300]);
		expect(getNextSortedValues([], 5, 0)).toEqual([5]);
	});

	it('measures the gaps between values and the minimum separation', () => {
		expect(getStepsBetweenValues([10, 25, 100])).toEqual([15, 75]);
		expect(hasMinStepsBetweenValues([10, 25], 10)).toBe(true);
		expect(hasMinStepsBetweenValues([10, 15], 10)).toBe(false);
		expect(hasMinStepsBetweenValues([10, 15], 0)).toBe(true);
	});

	it('picks the closest value index', () => {
		expect(getClosestValueIndex([42], 300)).toBe(0);
		expect(getClosestValueIndex([90, 270], 45)).toBe(0);
		expect(getClosestValueIndex([90, 270], 300)).toBe(1);
	});

	it('treats a zero sweep as a full circle', () => {
		expect(getTotalAngle(-90, 270)).toBe(360);
		expect(getTotalAngle(0, 0)).toBe(360);
		expect(getTotalAngle(-90, 90)).toBe(180);
	});

	it.each([
		[100, 0, 0],
		[200, 100, 90],
		[100, 200, 180],
		[0, 100, 270],
		[170.7, 29.3, 45],
		[93, 0, 356],
		[107, 0, 4]
	])('reads (%s, %s) off the dial as %s°', (clientX, clientY, expected) => {
		expect(getValueFromPointer(clientX, clientY, RECT, FULL)).toBeCloseTo(expected, 1);
	});

	it('refuses to read a zero-size box or the exact centre', () => {
		expect(getValueFromPointer(100, 100, RECT, FULL)).toBeNull();
		expect(
			getValueFromPointer(200, 100, { ...RECT, width: 0, height: 0 } as DOMRect, FULL)
		).toBeNull();
	});

	it('inverts the pointer reading on an inverted dial', () => {
		expect(getValueFromPointer(200, 100, RECT, { ...FULL, inverted: true })).toBeCloseTo(270, 6);
	});

	it('maps values back onto dial angles, honouring inverted', () => {
		expect(getAngleFromValue(0, FULL)).toBe(-90);
		expect(getAngleFromValue(90, FULL)).toBe(0);
		expect(getAngleFromValue(180, FULL)).toBe(90);
		expect(getAngleFromValue(90, { ...FULL, inverted: true })).toBe(180);
	});

	it('places a value on the rail', () => {
		const right = getPositionFromAngle(0, 60);
		expect(right.x).toBeCloseTo(60, 6);
		expect(right.y).toBeCloseTo(0, 6);

		const down = getPositionFromAngle(90, 60);
		expect(down.x).toBeCloseTo(0, 6);
		expect(down.y).toBeCloseTo(60, 6);
	});

	it('describes an arc and raises the large-arc flag past 180°', () => {
		expect(describeAngleArc(80, 60, -90, 0)).toBe('M 80 20 A 60 60 0 0 1 140 80');
		expect(/A 60 60 0 (\d) 1 /.exec(describeAngleArc(80, 60, -90, 90))?.[1]).toBe('0');
		expect(/A 60 60 0 (\d) 1 /.exec(describeAngleArc(80, 60, -90, 180))?.[1]).toBe('1');
	});

	it('sweeps the other side — and re-reads the large-arc flag from it — when asked anti-clockwise', () => {
		// The same two endpoints as the clockwise 270° arc above, with only 90° of it painted.
		const anticlockwise = parseArc(describeAngleArc(80, 60, -90, 180, false), 80);
		expect(anticlockwise.sweptAngle).toBeCloseTo(90, 6);
		expect(anticlockwise.sweepFlag).toBe(0);
		expect(anticlockwise.largeArcFlag).toBe(0);

		const clockwise = parseArc(describeAngleArc(80, 60, -90, 180), 80);
		expect(clockwise.sweptAngle).toBeCloseTo(270, 6);
		expect(clockwise.sweepFlag).toBe(1);
		expect([clockwise.startX, clockwise.startY]).toEqual([
			anticlockwise.startX,
			anticlockwise.startY
		]);

		// Past 180° the flag rises on this side too.
		expect(parseArc(describeAngleArc(80, 60, -90, 0, false), 80).largeArcFlag).toBe(1);
	});
});
