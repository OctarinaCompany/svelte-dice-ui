import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import * as Gauge from './index.js';
import {
	describeArc,
	getArcCenterY,
	getArcLength,
	getDefaultGaugeValueText,
	getNormalizedAngle,
	polarToCartesian
} from './index.js';
import Harness from './gauge.test.svelte';

function bySlot(container: HTMLElement, slot: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function parseD(d: string): string[] {
	return d.trim().split(/\s+/);
}

/** Independent reimplementation of `polarToCartesian`, used only to compute test expectations. */
function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
	const rad = ((deg - 90) * Math.PI) / 180;
	return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

describe('geometry helpers', () => {
	describe('getNormalizedAngle', () => {
		it('wraps negative angles into [0, 360)', () => {
			expect(getNormalizedAngle(-90)).toBeCloseTo(270);
			expect(getNormalizedAngle(-370)).toBeCloseTo(350);
		});

		it('wraps angles above 360', () => {
			expect(getNormalizedAngle(400)).toBeCloseTo(40);
			expect(getNormalizedAngle(720)).toBeCloseTo(0);
		});

		it('resolves exact multiples of 360 to 0', () => {
			expect(getNormalizedAngle(360)).toBeCloseTo(0);
			expect(getNormalizedAngle(0)).toBe(0);
		});
	});

	describe('polarToCartesian', () => {
		const cx = 60;
		const cy = 60;
		const r = 56;

		it("places 0° at 12 o'clock (top)", () => {
			const p = polarToCartesian(cx, cy, r, 0);
			expect(p.x).toBeCloseTo(cx);
			expect(p.y).toBeCloseTo(cy - r);
		});

		it("places 90° at 3 o'clock (right)", () => {
			const p = polarToCartesian(cx, cy, r, 90);
			expect(p.x).toBeCloseTo(cx + r);
			expect(p.y).toBeCloseTo(cy);
		});

		it("places 180° at 6 o'clock (bottom)", () => {
			const p = polarToCartesian(cx, cy, r, 180);
			expect(p.x).toBeCloseTo(cx);
			expect(p.y).toBeCloseTo(cy + r);
		});

		it("places 270° at 9 o'clock (left)", () => {
			const p = polarToCartesian(cx, cy, r, 270);
			expect(p.x).toBeCloseTo(cx - r);
			expect(p.y).toBeCloseTo(cy);
		});
	});

	describe('describeArc', () => {
		const cx = 60;
		const cy = 60;
		const r = 56;

		it('draws a single-A partial arc with large-arc-flag 0 for Δ <= 180', () => {
			const d = describeArc(cx, cy, r, -90, 90);
			const tokens = parseD(d);
			const start = polar(cx, cy, r, -90);
			const end = polar(cx, cy, r, 90);

			expect(tokens[0]).toBe('M');
			expect(Number(tokens[1])).toBeCloseTo(start.x);
			expect(Number(tokens[2])).toBeCloseTo(start.y);
			expect(tokens[3]).toBe('A');
			expect(Number(tokens[4])).toBeCloseTo(r);
			expect(Number(tokens[5])).toBeCloseTo(r);
			expect(tokens[6]).toBe('0');
			expect(tokens[7]).toBe('0');
			expect(tokens[8]).toBe('1');
			expect(Number(tokens[9])).toBeCloseTo(end.x);
			expect(Number(tokens[10])).toBeCloseTo(end.y);
		});

		it('draws a single-A partial arc with large-arc-flag 1 for Δ > 180', () => {
			const tokens = parseD(describeArc(cx, cy, r, -135, 135));
			expect(tokens[7]).toBe('1');
		});

		it('draws two chained A segments when |Δ| >= 360', () => {
			const tokens = parseD(describeArc(cx, cy, r, 0, 360));
			const start = polar(cx, cy, r, 0);
			const mid = polar(cx, cy, r, 180);

			expect(tokens[0]).toBe('M');
			expect(Number(tokens[1])).toBeCloseTo(start.x);
			expect(Number(tokens[2])).toBeCloseTo(start.y);
			expect(tokens[3]).toBe('A');
			expect(Number(tokens[9])).toBeCloseTo(mid.x);
			expect(Number(tokens[10])).toBeCloseTo(mid.y);
			expect(tokens[11]).toBe('A');
			expect(Number(tokens[17])).toBeCloseTo(start.x);
			expect(Number(tokens[18])).toBeCloseTo(start.y);
		});

		it('renders a degenerate start === end arc without special-casing', () => {
			const tokens = parseD(describeArc(cx, cy, r, 40, 40));
			const point = polar(cx, cy, r, 40);

			expect(Number(tokens[1])).toBeCloseTo(point.x);
			expect(Number(tokens[2])).toBeCloseTo(point.y);
			expect(Number(tokens[9])).toBeCloseTo(point.x);
			expect(Number(tokens[10])).toBeCloseTo(point.y);
		});
	});

	describe('getArcLength', () => {
		const r = 56;

		it('computes the full circumference for a 360° sweep', () => {
			expect(getArcLength(r, 0, 360)).toBeCloseTo(2 * Math.PI * r);
		});

		it('computes half the circumference for a 180° sweep', () => {
			expect(getArcLength(r, -90, 90)).toBeCloseTo(2 * Math.PI * r * 0.5);
		});

		it('computes three quarters for a 270° sweep', () => {
			expect(getArcLength(r, -135, 135)).toBeCloseTo(2 * Math.PI * r * 0.75);
		});

		it('is zero for a degenerate sweep', () => {
			expect(getArcLength(r, 40, 40)).toBe(0);
		});

		it('clamps a sweep over 360° to the full circumference', () => {
			expect(getArcLength(r, 0, 720)).toBeCloseTo(2 * Math.PI * r);
		});
	});

	describe('getArcCenterY', () => {
		const center = 60;
		const r = 56;

		it('resolves a full circle to the geometric center', () => {
			expect(getArcCenterY(center, r, 0, 360)).toBe(center);
		});

		it('resolves a semi-circle sweep (-90 → 90) to the geometric center', () => {
			expect(getArcCenterY(center, r, -90, 90)).toBeCloseTo(center);
		});

		it('resolves a three-quarter sweep (-135 → 135) to the geometric center', () => {
			expect(getArcCenterY(center, r, -135, 135)).toBeCloseTo(center);
		});

		it('resolves the asymmetric 0 → 90 sweep to the geometric center', () => {
			expect(getArcCenterY(center, r, 0, 90)).toBeCloseTo(center);
		});

		it('resolves a degenerate 40 → 40 sweep to center - r·cos(40°)', () => {
			const expected = center - r * Math.cos((40 * Math.PI) / 180);
			expect(getArcCenterY(center, r, 40, 40)).toBeCloseTo(expected);
		});
	});

	describe('getDefaultGaugeValueText', () => {
		it('returns a bare rounded percentage with no % suffix', () => {
			expect(getDefaultGaugeValueText(25, 0, 50)).toBe('50');
			expect(getDefaultGaugeValueText(1, 0, 3)).toBe('33');
		});

		it('resolves the max === min branch to "100"', () => {
			expect(getDefaultGaugeValueText(10, 10, 10)).toBe('100');
		});
	});
});

describe('roles and ARIA', () => {
	it('always carries role="meter"', () => {
		const { container } = render(Harness, { props: { value: 45 } });
		expect(bySlot(container, 'gauge')).toHaveAttribute('role', 'meter');
	});

	it('renders aria-valuenow/valuemin/valuemax/valuetext for a determinate value', () => {
		const { container } = render(Harness, { props: { value: 45 } });
		const root = bySlot(container, 'gauge');

		expect(root).toHaveAttribute('aria-valuenow', '45');
		expect(root).toHaveAttribute('aria-valuemin', '0');
		expect(root).toHaveAttribute('aria-valuemax', '100');
		expect(root).toHaveAttribute('aria-valuetext', '45');
	});

	it('aria-valuemin/valuemax stay present while indeterminate; valuenow/valuetext are absent', () => {
		const { container } = render(Harness, { props: {} });
		const root = bySlot(container, 'gauge');

		expect(root).toHaveAttribute('aria-valuemin', '0');
		expect(root).toHaveAttribute('aria-valuemax', '100');
		expect(root).not.toHaveAttribute('aria-valuenow');
		expect(root).not.toHaveAttribute('aria-valuetext');
	});

	it('wires aria-describedby to the ValueText part id', () => {
		const { container } = render(Harness, { props: { value: 45 } });
		const root = bySlot(container, 'gauge');
		const valueText = bySlot(container, 'gauge-value-text');

		expect(root.getAttribute('aria-describedby')).toBe(valueText.id);
	});

	it('wires aria-labelledby to the Label id only when Gauge.Label is rendered', () => {
		const withLabel = render(Harness, {
			props: { value: 45, showLabel: true, labelText: 'Performance' }
		});
		const rootWith = bySlot(withLabel.container, 'gauge');
		const label = bySlot(withLabel.container, 'gauge-label');
		expect(rootWith.getAttribute('aria-labelledby')).toBe(label.id);
		withLabel.unmount();

		const withoutLabel = render(Harness, { props: { value: 45 } });
		expect(bySlot(withoutLabel.container, 'gauge')).not.toHaveAttribute('aria-labelledby');
	});

	it('the Indicator part carries aria-hidden and focusable=false', () => {
		const { container } = render(Harness, { props: { value: 45 } });
		const indicator = bySlot(container, 'gauge-indicator');

		expect(indicator).toHaveAttribute('aria-hidden', 'true');
		expect(indicator).toHaveAttribute('focusable', 'false');
	});

	it('the accessible name resolves from the label', () => {
		const { container } = render(Harness, {
			props: { value: 45, showLabel: true, labelText: 'Performance' }
		});
		expect(bySlot(container, 'gauge')).toHaveAccessibleName('Performance');
	});

	it('toggling Gauge.Label adds then removes aria-labelledby (registerLabel/unregisterLabel)', async () => {
		const { container, rerender } = render(Harness, { props: { value: 45, showLabel: false } });
		expect(bySlot(container, 'gauge')).not.toHaveAttribute('aria-labelledby');

		await rerender({ value: 45, showLabel: true });
		await tick();
		expect(bySlot(container, 'gauge')).toHaveAttribute('aria-labelledby');

		await rerender({ value: 45, showLabel: false });
		await tick();
		expect(bySlot(container, 'gauge')).not.toHaveAttribute('aria-labelledby');
	});

	describe('attribute projection table', () => {
		it('determinate: data-slot + data-state on all six parts; data-value/percentage on Indicator/Range', () => {
			const { container } = render(Harness, { props: { value: 45, showLabel: true } });
			const slots = [
				'gauge',
				'gauge-indicator',
				'gauge-track',
				'gauge-range',
				'gauge-value-text',
				'gauge-label'
			];
			for (const slot of slots) {
				const el = bySlot(container, slot);
				expect(el).toHaveAttribute('data-slot', slot);
				expect(el).toHaveAttribute('data-state', 'loading');
			}

			for (const slot of ['gauge', 'gauge-indicator', 'gauge-range']) {
				const el = bySlot(container, slot);
				expect(el).toHaveAttribute('data-value', '45');
				expect(el).toHaveAttribute('data-min', '0');
				expect(el).toHaveAttribute('data-max', '100');
			}
			for (const slot of ['gauge', 'gauge-indicator']) {
				expect(bySlot(container, slot)).toHaveAttribute('data-percentage', '0.45');
			}

			const track = bySlot(container, 'gauge-track');
			expect(track.getAttribute('data-value')).toBeNull();
			expect(track.getAttribute('data-min')).toBeNull();
			expect(track.getAttribute('data-max')).toBeNull();
			expect(bySlot(container, 'gauge-range').getAttribute('data-percentage')).toBeNull();
		});

		it('indeterminate: omits data-value/data-percentage everywhere but keeps data-min/data-max', () => {
			const { container } = render(Harness, { props: { showLabel: true } });
			const slots = [
				'gauge',
				'gauge-indicator',
				'gauge-track',
				'gauge-range',
				'gauge-value-text',
				'gauge-label'
			];
			for (const slot of slots) {
				const el = bySlot(container, slot);
				expect(el).toHaveAttribute('data-state', 'indeterminate');
				expect(el.getAttribute('data-value')).toBeNull();
				expect(el.getAttribute('data-percentage')).toBeNull();
			}
			for (const slot of ['gauge', 'gauge-indicator', 'gauge-range']) {
				const el = bySlot(container, slot);
				expect(el).toHaveAttribute('data-min', '0');
				expect(el).toHaveAttribute('data-max', '100');
			}
		});
	});
});

describe('uncontrolled / default state', () => {
	it('no value ⇒ indeterminate, no aria-valuenow, no data-value/percentage, range dashoffset 0, empty value text', () => {
		const { container } = render(Harness, { props: {} });
		const root = bySlot(container, 'gauge');
		const range = bySlot(container, 'gauge-range');

		expect(root).toHaveAttribute('data-state', 'indeterminate');
		expect(root).not.toHaveAttribute('aria-valuenow');
		expect(root.getAttribute('data-value')).toBeNull();
		expect(root.getAttribute('data-percentage')).toBeNull();
		expect(Number(range.getAttribute('stroke-dashoffset'))).toBe(0);
		expect(bySlot(container, 'gauge-value-text')).toHaveTextContent('');
	});

	it('an explicit value={null} behaves identically to omitting value', () => {
		const { container } = render(Harness, { props: { value: null } });
		expect(bySlot(container, 'gauge')).toHaveAttribute('data-state', 'indeterminate');
	});

	it('renders the documented default geometry/bounds with nothing supplied', () => {
		const { container } = render(Harness, { props: { value: 45 } });
		const indicator = bySlot(container, 'gauge-indicator');
		const track = bySlot(container, 'gauge-track');
		const range = bySlot(container, 'gauge-range');
		const root = bySlot(container, 'gauge');

		expect(indicator).toHaveAttribute('width', '120');
		expect(indicator).toHaveAttribute('height', '120');
		expect(indicator).toHaveAttribute('viewBox', '0 0 120 120');
		expect(track).toHaveAttribute('stroke-width', '8');
		expect(range).toHaveAttribute('stroke-width', '8');
		expect(root).toHaveAttribute('aria-valuemin', '0');
		expect(root).toHaveAttribute('aria-valuemax', '100');
		expect(track.getAttribute('d')).toBe(range.getAttribute('d'));
	});
});

describe('guard rails', () => {
	it('Indicator throws when rendered outside Root', () => {
		expect(() => render(Gauge.Indicator, { props: {} })).toThrow(/must be used within `<Gauge>`/);
	});

	it('Track throws when rendered outside Root', () => {
		expect(() => render(Gauge.Track, { props: {} })).toThrow(/must be used within `<Gauge>`/);
	});

	it('Range throws when rendered outside Root', () => {
		expect(() => render(Gauge.Range, { props: {} })).toThrow(/must be used within `<Gauge>`/);
	});

	it('ValueText throws when rendered outside Root', () => {
		expect(() => render(Gauge.ValueText, { props: {} })).toThrow(/must be used within `<Gauge>`/);
	});

	it('Label throws when rendered outside Root', () => {
		expect(() => render(Gauge.Label, { props: {} })).toThrow(/must be used within `<Gauge>`/);
	});
});

describe('value clamping', () => {
	const errorSpy = () => vi.spyOn(console, 'error').mockImplementation(() => {});

	it('value > max clamps into range and stays complete, never throws', () => {
		const spy = errorSpy();
		const { container } = render(Harness, { props: { value: 150 } });
		const root = bySlot(container, 'gauge');

		expect(root).toHaveAttribute('aria-valuenow', '100');
		expect(root).toHaveAttribute('data-state', 'complete');
		spy.mockRestore();
	});

	it('value < min clamps into range and stays loading, never throws', () => {
		const spy = errorSpy();
		const { container } = render(Harness, { props: { value: -20 } });
		const root = bySlot(container, 'gauge');

		expect(root).toHaveAttribute('aria-valuenow', '0');
		expect(root).toHaveAttribute('data-state', 'loading');
		spy.mockRestore();
	});
});

describe('every prop', () => {
	const errorSpy = () => vi.spyOn(console, 'error').mockImplementation(() => {});

	describe('min/max resolution', () => {
		it('max <= min corrects to min + 1', () => {
			const { container } = render(Harness, { props: { value: 80, min: 80, max: 50 } });
			const root = bySlot(container, 'gauge');

			expect(root).toHaveAttribute('aria-valuemin', '80');
			expect(root).toHaveAttribute('aria-valuemax', '81');
		});

		it('an invalid max falls back to 100', () => {
			const spy = errorSpy();
			for (const max of [0, -5, Number.NaN]) {
				const { container, unmount } = render(Harness, { props: { value: 45, max } });
				expect(bySlot(container, 'gauge')).toHaveAttribute('aria-valuemax', '100');
				unmount();
			}
			spy.mockRestore();
		});

		it('a non-finite min falls back to 0', () => {
			const { container } = render(Harness, { props: { value: 45, min: Number.NaN } });
			expect(bySlot(container, 'gauge')).toHaveAttribute('aria-valuemin', '0');
		});
	});

	it('size/thickness drive width/height/viewBox/stroke-width', () => {
		const { container } = render(Harness, { props: { value: 45, size: 200, thickness: 20 } });
		const indicator = bySlot(container, 'gauge-indicator');
		const track = bySlot(container, 'gauge-track');
		const range = bySlot(container, 'gauge-range');

		expect(indicator).toHaveAttribute('width', '200');
		expect(indicator).toHaveAttribute('height', '200');
		expect(indicator).toHaveAttribute('viewBox', '0 0 200 200');
		expect(track).toHaveAttribute('stroke-width', '20');
		expect(range).toHaveAttribute('stroke-width', '20');
	});

	describe('startAngle/endAngle geometry (size=120, thickness=8 ⇒ radius=56, center=60)', () => {
		const center = 60;
		const r = 56;

		it('semi circle (-90 → 90): d and stroke-dasharray', () => {
			const { container } = render(Harness, {
				props: { value: 45, startAngle: -90, endAngle: 90 }
			});
			const track = bySlot(container, 'gauge-track');
			const range = bySlot(container, 'gauge-range');
			const tokens = parseD(track.getAttribute('d')!);
			const start = polar(center, center, r, -90);
			const end = polar(center, center, r, 90);

			expect(tokens[0]).toBe('M');
			expect(Number(tokens[1])).toBeCloseTo(start.x);
			expect(Number(tokens[2])).toBeCloseTo(start.y);
			expect(tokens[3]).toBe('A');
			expect(tokens[6]).toBe('0');
			expect(tokens[7]).toBe('0');
			expect(Number(tokens[9])).toBeCloseTo(end.x);
			expect(Number(tokens[10])).toBeCloseTo(end.y);
			expect(Number(range.getAttribute('stroke-dasharray'))).toBeCloseTo(2 * Math.PI * r * 0.5);
		});

		it('three-quarter circle (-135 → 135): large-arc-flag 1, stroke-dasharray', () => {
			const { container } = render(Harness, {
				props: { value: 45, startAngle: -135, endAngle: 135 }
			});
			const track = bySlot(container, 'gauge-track');
			const range = bySlot(container, 'gauge-range');
			const tokens = parseD(track.getAttribute('d')!);

			expect(tokens[7]).toBe('1');
			expect(Number(range.getAttribute('stroke-dasharray'))).toBeCloseTo(2 * Math.PI * r * 0.75);
		});

		it('full circle (0 → 360): two joined A segments, stroke-dasharray === full circumference', () => {
			const { container } = render(Harness, {
				props: { value: 45, startAngle: 0, endAngle: 360 }
			});
			const track = bySlot(container, 'gauge-track');
			const range = bySlot(container, 'gauge-range');
			const tokens = parseD(track.getAttribute('d')!);

			expect(tokens.filter((t) => t === 'A')).toHaveLength(2);
			expect(Number(range.getAttribute('stroke-dasharray'))).toBeCloseTo(2 * Math.PI * r);
		});
	});

	it('a custom getValueText drives both the rendered text and aria-valuetext', () => {
		const { container } = render(Harness, {
			props: {
				value: 25,
				min: 0,
				max: 50,
				getValueText: (v: number, _min: number, max: number) => `${v} of ${max}`
			}
		});
		const root = bySlot(container, 'gauge');

		expect(root).toHaveAttribute('aria-valuetext', '25 of 50');
		expect(bySlot(container, 'gauge-value-text')).toHaveTextContent('25 of 50');
	});

	it("a caller class is present alongside each part's own default classes", () => {
		const { container } = render(Harness, {
			props: {
				value: 45,
				showLabel: true,
				class: 'my-root',
				trackClass: 'my-track',
				rangeClass: 'my-range',
				valueTextClass: 'my-value-text',
				labelClass: 'my-label'
			}
		});

		const root = bySlot(container, 'gauge');
		expect(root.classList.contains('my-root')).toBe(true);
		expect(root.classList.contains('relative')).toBe(true);
		expect(root.classList.contains('inline-flex')).toBe(true);

		const indicator = bySlot(container, 'gauge-indicator');
		expect(indicator.classList.contains('transform')).toBe(true);

		const track = bySlot(container, 'gauge-track');
		expect(track.classList.contains('my-track')).toBe(true);
		expect(track.classList.contains('text-muted-foreground/20')).toBe(true);

		const range = bySlot(container, 'gauge-range');
		expect(range.classList.contains('my-range')).toBe(true);
		expect(range.classList.contains('text-primary')).toBe(true);
		expect(range.classList.contains('duration-700')).toBe(true);

		const valueText = bySlot(container, 'gauge-value-text');
		expect(valueText.classList.contains('my-value-text')).toBe(true);
		expect(valueText.classList.contains('absolute')).toBe(true);

		const label = bySlot(container, 'gauge-label');
		expect(label.classList.contains('my-label')).toBe(true);
		expect(label.classList.contains('text-muted-foreground')).toBe(true);
	});

	it('forwards restProps (id, data-testid) to Root and an onclick handler', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		const { container } = render(Harness, {
			props: { value: 45, id: 'root-id', 'data-testid': 'root-testid', onclick }
		});
		const root = bySlot(container, 'gauge');

		expect(root).toHaveAttribute('id', 'root-id');
		expect(root).toHaveAttribute('data-testid', 'root-testid');
		await user.click(root);
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('forwards restProps (data-testid) to Track, Range, ValueText and Label', () => {
		const { container } = render(Harness, {
			props: {
				value: 45,
				showLabel: true,
				trackTestId: 'track-testid',
				rangeTestId: 'range-testid',
				valueTextTestId: 'value-text-testid',
				labelTestId: 'label-testid'
			}
		});

		expect(bySlot(container, 'gauge-track')).toHaveAttribute('data-testid', 'track-testid');
		expect(bySlot(container, 'gauge-range')).toHaveAttribute('data-testid', 'range-testid');
		expect(bySlot(container, 'gauge-value-text')).toHaveAttribute(
			'data-testid',
			'value-text-testid'
		);
		expect(bySlot(container, 'gauge-label')).toHaveAttribute('data-testid', 'label-testid');
	});
});

describe('remaining edge cases', () => {
	const errorSpy = () => vi.spyOn(console, 'error').mockImplementation(() => {});
	const warnSpy = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

	it('startAngle === endAngle renders stroke-dasharray="0" without throwing', () => {
		let container!: HTMLElement;
		expect(() => {
			({ container } = render(Harness, { props: { value: 45, startAngle: 40, endAngle: 40 } }));
		}).not.toThrow();
		expect(bySlot(container, 'gauge-range')).toHaveAttribute('stroke-dasharray', '0');
	});

	it('|Δ| > 360 clamps arcLength to the full circumference', () => {
		const r = 56;
		const { container } = render(Harness, {
			props: { value: 45, startAngle: 0, endAngle: 720 }
		});
		expect(Number(bySlot(container, 'gauge-range').getAttribute('stroke-dasharray'))).toBeCloseTo(
			2 * Math.PI * r
		);
	});

	it('thickness >= size renders a collapsed (radius 0) arc without throwing', () => {
		const spy = warnSpy();
		let container!: HTMLElement;
		expect(() => {
			({ container } = render(Harness, { props: { value: 45, size: 20, thickness: 30 } }));
		}).not.toThrow();

		const tokens = parseD(bySlot(container, 'gauge-track').getAttribute('d')!);
		expect(Number(tokens[1])).toBeCloseTo(10);
		expect(Number(tokens[2])).toBeCloseTo(10);
		expect(Number(tokens[9])).toBeCloseTo(10);
		expect(Number(tokens[10])).toBeCloseTo(10);
		spy.mockRestore();
	});

	it('logs the pinned invalid-max message exactly once and still defaults to 100', () => {
		const spy = errorSpy();
		render(Harness, { props: { value: 45, max: Number.NaN } });

		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith(
			'Invalid prop `max` of value `NaN` supplied to `Gauge`. Only numbers greater than 0 are valid. Defaulting to 100.'
		);
		spy.mockRestore();
	});

	it('logs the pinned invalid-value message exactly once and still clamps', () => {
		const spy = errorSpy();
		const { container } = render(Harness, { props: { value: 150 } });

		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith(
			'Invalid prop `value` of value `150` supplied to `Gauge`. The `value` prop must be a number between `min` and `max` (inclusive), or `null`/`undefined` for indeterminate state. The value will be clamped to the valid range.'
		);
		expect(bySlot(container, 'gauge')).toHaveAttribute('aria-valuenow', '100');
		spy.mockRestore();
	});

	it('logs the pinned thickness-warning message exactly once', () => {
		const spy = warnSpy();
		render(Harness, { props: { value: 45, size: 20, thickness: 30 } });

		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith(
			'Gauge: thickness (30) should be less than size (20) for proper rendering.'
		);
		spy.mockRestore();
	});

	it('stays silent outside DEV for an invalid max, an invalid value, and thickness >= size', () => {
		vi.stubEnv('DEV', false);
		const errSpy = errorSpy();
		const wrnSpy = warnSpy();

		const { container } = render(Harness, {
			props: { value: 150, max: Number.NaN, size: 20, thickness: 30 }
		});

		expect(errSpy).not.toHaveBeenCalled();
		expect(wrnSpy).not.toHaveBeenCalled();
		expect(bySlot(container, 'gauge')).toHaveAttribute('aria-valuenow', '100');

		errSpy.mockRestore();
		wrnSpy.mockRestore();
		vi.unstubAllEnvs();
	});
});

describe('controlled', () => {
	it('rerender({ value }) moves aria-valuenow/valuetext/data-value/data-percentage and stroke-dashoffset', async () => {
		const r = 56;
		const circumference = 2 * Math.PI * r;
		const { container, rerender } = render(Harness, { props: { value: 0 } });
		let root = bySlot(container, 'gauge');
		let range = bySlot(container, 'gauge-range');

		expect(root).toHaveAttribute('aria-valuenow', '0');
		expect(Number(range.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference);

		await rerender({ value: 100 });
		root = bySlot(container, 'gauge');
		range = bySlot(container, 'gauge-range');

		expect(root).toHaveAttribute('aria-valuenow', '100');
		expect(root).toHaveAttribute('data-value', '100');
		expect(root).toHaveAttribute('data-percentage', '1');
		expect(root).toHaveAttribute('aria-valuetext', '100');
		expect(Number(range.getAttribute('stroke-dashoffset'))).toBeCloseTo(0);
	});

	it('the range keeps its transition class across a value change', async () => {
		const { container, rerender } = render(Harness, { props: { value: 0 } });
		expect(
			bySlot(container, 'gauge-range').classList.contains('transition-[stroke-dashoffset]')
		).toBe(true);

		await rerender({ value: 50 });
		expect(
			bySlot(container, 'gauge-range').classList.contains('transition-[stroke-dashoffset]')
		).toBe(true);
	});
});

describe('RTL', () => {
	it('renders identical d/stroke-dasharray/stroke-dashoffset/viewBox/class under dir="rtl"', () => {
		const ltr = render(Harness, { props: { value: 45, startAngle: -90, endAngle: 90 } });
		const ltrRoot = bySlot(ltr.container, 'gauge');
		const ltrIndicator = bySlot(ltr.container, 'gauge-indicator');
		const ltrTrack = bySlot(ltr.container, 'gauge-track');
		const ltrRange = bySlot(ltr.container, 'gauge-range');
		const snapshot = {
			rootClass: ltrRoot.getAttribute('class'),
			viewBox: ltrIndicator.getAttribute('viewBox'),
			trackD: ltrTrack.getAttribute('d'),
			rangeD: ltrRange.getAttribute('d'),
			dasharray: ltrRange.getAttribute('stroke-dasharray'),
			dashoffset: ltrRange.getAttribute('stroke-dashoffset')
		};
		ltr.unmount();

		const rtl = render(Harness, {
			props: { value: 45, startAngle: -90, endAngle: 90, rtl: true }
		});
		const rtlRoot = bySlot(rtl.container, 'gauge');
		const rtlIndicator = bySlot(rtl.container, 'gauge-indicator');
		const rtlTrack = bySlot(rtl.container, 'gauge-track');
		const rtlRange = bySlot(rtl.container, 'gauge-range');

		expect(rtlRoot.getAttribute('class')).toBe(snapshot.rootClass);
		expect(rtlIndicator.getAttribute('viewBox')).toBe(snapshot.viewBox);
		expect(rtlTrack.getAttribute('d')).toBe(snapshot.trackD);
		expect(rtlRange.getAttribute('d')).toBe(snapshot.rangeD);
		expect(rtlRange.getAttribute('stroke-dasharray')).toBe(snapshot.dasharray);
		expect(rtlRange.getAttribute('stroke-dashoffset')).toBe(snapshot.dashoffset);
	});
});

describe('Svelte-specific', () => {
	it('bind:ref populates all six elements', () => {
		const refs: Record<string, Element | null> = {
			root: null,
			indicator: null,
			track: null,
			range: null,
			valueText: null,
			label: null
		};
		render(Harness, {
			props: {
				value: 45,
				showLabel: true,
				get rootRef() {
					return refs.root as HTMLDivElement | null;
				},
				set rootRef(value) {
					refs.root = value;
				},
				get indicatorRef() {
					return refs.indicator as SVGSVGElement | null;
				},
				set indicatorRef(value) {
					refs.indicator = value;
				},
				get trackRef() {
					return refs.track as SVGPathElement | null;
				},
				set trackRef(value) {
					refs.track = value;
				},
				get rangeRef() {
					return refs.range as SVGPathElement | null;
				},
				set rangeRef(value) {
					refs.range = value;
				},
				get valueTextRef() {
					return refs.valueText as HTMLDivElement | null;
				},
				set valueTextRef(value) {
					refs.valueText = value;
				},
				get labelRef() {
					return refs.label as HTMLDivElement | null;
				},
				set labelRef(value) {
					refs.label = value;
				}
			}
		});

		// jsdom does not implement the SVGPathElement constructor, so path refs are asserted by tag name.
		expect(refs.root).toBeInstanceOf(HTMLDivElement);
		expect(refs.indicator).toBeInstanceOf(SVGSVGElement);
		expect(refs.track?.tagName).toBe('path');
		expect(refs.range?.tagName).toBe('path');
		expect(refs.valueText).toBeInstanceOf(HTMLDivElement);
		expect(refs.label).toBeInstanceOf(HTMLDivElement);
	});

	it('the child snippet on Root spreads the full attribute payload and ref stays null', () => {
		let rootRef: HTMLDivElement | null = null;
		render(Harness, {
			props: {
				value: 45,
				useRootChild: true,
				get rootRef() {
					return rootRef;
				},
				set rootRef(value) {
					rootRef = value;
				}
			}
		});

		const button = screen.getByTestId('root-child');
		expect(button.tagName).toBe('BUTTON');
		expect(button).toHaveAttribute('role', 'meter');
		expect(button).toHaveAttribute('data-slot', 'gauge');
		expect(button).toHaveAttribute('aria-valuenow', '45');
		expect(rootRef).toBeNull();
	});

	it('the child snippet on ValueText spreads the merged payload and is not rendered as a div', () => {
		const { container } = render(Harness, {
			props: { value: 45, useRootChild: true, useValueTextChild: true }
		});

		const valueTextChild = screen.getByTestId('value-text-child');
		expect(valueTextChild).toHaveAttribute('data-slot', 'gauge-value-text');
		expect(container.querySelector('div[data-slot="gauge-value-text"]')).toBeNull();
	});

	it('the child snippet on Label spreads the merged payload and is not rendered as a div', () => {
		const { container } = render(Harness, {
			props: {
				value: 45,
				useRootChild: true,
				showLabel: true,
				useLabelChild: true,
				labelText: 'Perf'
			}
		});

		const labelChild = screen.getByTestId('label-child');
		expect(labelChild).toHaveAttribute('data-slot', 'gauge-label');
		expect(labelChild).toHaveTextContent('Perf');
		expect(container.querySelector('div[data-slot="gauge-label"]')).toBeNull();
	});

	it('explicit children on ValueText take precedence over the computed value text, including while indeterminate', () => {
		const determinate = render(Harness, { props: { value: 45, valueTextChildren: true } });
		const determinateRoot = bySlot(determinate.container, 'gauge');
		const determinateValueText = bySlot(determinate.container, 'gauge-value-text');
		expect(determinateValueText).toHaveTextContent('Custom');
		expect(determinateRoot).toHaveAttribute('aria-describedby', determinateValueText.id);
		determinate.unmount();

		const indeterminate = render(Harness, { props: { valueTextChildren: true } });
		const root = bySlot(indeterminate.container, 'gauge');
		const valueText = bySlot(indeterminate.container, 'gauge-value-text');

		expect(valueText).toHaveTextContent('Custom');
		expect(valueText).toHaveAttribute('id');
		expect(root).not.toHaveAttribute('aria-describedby');
	});

	it("ValueText's inline top equals arcCenterY and a caller style is appended after it", () => {
		const { container } = render(Harness, {
			props: { value: 45, startAngle: -90, endAngle: 90, valueTextStyle: 'color: red;' }
		});
		const style = bySlot(container, 'gauge-value-text').getAttribute('style') ?? '';

		expect(style.startsWith('top: 60px;')).toBe(true);
		expect(style).toContain('color: red;');
	});

	it('Gauge.Combined renders the same five data-slots as the manual composition and no Label', () => {
		const { container } = render(Gauge.Combined, { props: { value: 60 } });

		for (const slot of [
			'gauge',
			'gauge-indicator',
			'gauge-track',
			'gauge-range',
			'gauge-value-text'
		]) {
			expect(bySlot(container, slot)).toBeInTheDocument();
		}
		expect(bySlot(container, 'gauge')).toHaveAttribute('aria-valuenow', '60');
		expect(container.querySelector('[data-slot="gauge-label"]')).toBeNull();
	});
});

describe('keyboard / non-interactivity', () => {
	it('carries no tabindex and is skipped by Tab', async () => {
		const user = userEvent.setup();
		const before = document.createElement('button');
		before.dataset.testid = 'before';
		before.textContent = 'before';
		const mount = document.createElement('div');
		const after = document.createElement('button');
		after.dataset.testid = 'after';
		after.textContent = 'after';
		document.body.append(before, mount, after);

		try {
			const { container } = render(Harness, {
				props: { value: 45, showLabel: true },
				target: mount
			});
			const root = bySlot(container, 'gauge');
			expect(root).not.toHaveAttribute('tabindex');
			expect(bySlot(container, 'gauge-track')).not.toHaveAttribute('tabindex');
			expect(bySlot(container, 'gauge-range')).not.toHaveAttribute('tabindex');
			expect(bySlot(container, 'gauge-value-text')).not.toHaveAttribute('tabindex');
			expect(bySlot(container, 'gauge-label')).not.toHaveAttribute('tabindex');

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

	it('the complete (empty) upstream key set changes no attribute', async () => {
		const user = userEvent.setup();
		const { container } = render(Harness, { props: { value: 45 } });
		const root = bySlot(container, 'gauge');
		const range = bySlot(container, 'gauge-range');
		const before = {
			'data-value': root.getAttribute('data-value'),
			'data-percentage': root.getAttribute('data-percentage'),
			'aria-valuenow': root.getAttribute('aria-valuenow'),
			'aria-valuetext': root.getAttribute('aria-valuetext'),
			dashoffset: range.getAttribute('stroke-dashoffset')
		};

		root.focus();
		await user.keyboard('{Enter}{ }{ArrowUp}{ArrowDown}{ArrowLeft}{ArrowRight}{Home}{End}{Escape}');

		expect(root.getAttribute('data-value')).toBe(before['data-value']);
		expect(root.getAttribute('data-percentage')).toBe(before['data-percentage']);
		expect(root.getAttribute('aria-valuenow')).toBe(before['aria-valuenow']);
		expect(root.getAttribute('aria-valuetext')).toBe(before['aria-valuetext']);
		expect(range.getAttribute('stroke-dashoffset')).toBe(before.dashoffset);
	});

	it('the indicator svg carries focusable="false" so it is not focusable in any engine', () => {
		const { container } = render(Harness, { props: { value: 45 } });
		expect(bySlot(container, 'gauge-indicator')).toHaveAttribute('focusable', 'false');
	});
});

describe('barrel', () => {
	it('exposes Root/Indicator/Track/Range/ValueText/Label/Combined under both short and prefixed names', () => {
		expect(Gauge.Root).toBe(Gauge.Gauge);
		expect(Gauge.Indicator).toBe(Gauge.GaugeIndicator);
		expect(Gauge.Track).toBe(Gauge.GaugeTrack);
		expect(Gauge.Range).toBe(Gauge.GaugeRange);
		expect(Gauge.ValueText).toBe(Gauge.GaugeValueText);
		expect(Gauge.Label).toBe(Gauge.GaugeLabel);
		expect(Gauge.Combined).toBe(Gauge.GaugeCombined);
	});
});
