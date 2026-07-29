import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import * as CircularProgress from './index.js';
import {
	clampProgressValue,
	getDefaultValueText,
	getProgressPercentage,
	getProgressState,
	getRingGeometry,
	resolveProgressBounds
} from './index.js';
import rangeSource from './circular-progress-range.svelte?raw';
import Harness from './circular-progress.test.svelte';

function bySlot(container: HTMLElement, slot: string): HTMLElement {
	const element = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function circumferenceOf(radius: number): number {
	return 2 * Math.PI * radius;
}

describe('pure helpers', () => {
	describe('resolveProgressBounds', () => {
		it('passes through valid min/max', () => {
			expect(resolveProgressBounds(10, 50)).toEqual({ min: 10, max: 50 });
		});

		it('falls back min to 0 for a non-finite min', () => {
			expect(resolveProgressBounds(Number.NaN, 50)).toEqual({ min: 0, max: 50 });
			expect(resolveProgressBounds(undefined, 50)).toEqual({ min: 0, max: 50 });
			expect(resolveProgressBounds(Number.POSITIVE_INFINITY, 50)).toEqual({ min: 0, max: 50 });
		});

		it('falls back max to 100 for a non-finite or non-positive max', () => {
			expect(resolveProgressBounds(0, Number.NaN)).toEqual({ min: 0, max: 100 });
			expect(resolveProgressBounds(0, 0)).toEqual({ min: 0, max: 100 });
			expect(resolveProgressBounds(0, -5)).toEqual({ min: 0, max: 100 });
			expect(resolveProgressBounds(0, undefined)).toEqual({ min: 0, max: 100 });
		});

		it('corrects max <= min to min + 1', () => {
			expect(resolveProgressBounds(80, 50)).toEqual({ min: 80, max: 81 });
			expect(resolveProgressBounds(10, 10)).toEqual({ min: 10, max: 11 });
		});
	});

	describe('clampProgressValue', () => {
		it('passes an in-range value through unchanged', () => {
			expect(clampProgressValue(50, 0, 100)).toBe(50);
			expect(clampProgressValue(0, 0, 100)).toBe(0);
			expect(clampProgressValue(100, 0, 100)).toBe(100);
		});

		it('clamps a value above max down to max', () => {
			expect(clampProgressValue(150, 0, 100)).toBe(100);
		});

		it('clamps a value below min up to min', () => {
			expect(clampProgressValue(-20, 0, 100)).toBe(0);
		});

		it('resolves NaN/Infinity/null/undefined to null', () => {
			expect(clampProgressValue(Number.NaN, 0, 100)).toBeNull();
			expect(clampProgressValue(Number.POSITIVE_INFINITY, 0, 100)).toBeNull();
			expect(clampProgressValue(null, 0, 100)).toBeNull();
			expect(clampProgressValue(undefined, 0, 100)).toBeNull();
		});
	});

	describe('getProgressPercentage', () => {
		it('divides normally for an in-range value', () => {
			expect(getProgressPercentage(25, 0, 50)).toBe(0.5);
		});

		it('resolves the max === min branch to 1', () => {
			expect(getProgressPercentage(10, 10, 10)).toBe(1);
		});

		it('resolves a null value to null', () => {
			expect(getProgressPercentage(null, 0, 100)).toBeNull();
		});
	});

	describe('getRingGeometry', () => {
		it('derives radius/center/circumference from size and thickness', () => {
			const geometry = getRingGeometry(48, 4);
			expect(geometry.radius).toBe(22);
			expect(geometry.center).toBe(24);
			expect(geometry.circumference).toBeCloseTo(circumferenceOf(22));
		});

		it('floors radius at 0 when thickness >= size', () => {
			const geometry = getRingGeometry(8, 12);
			expect(geometry.radius).toBe(0);
			expect(geometry.center).toBe(4);
			expect(geometry.circumference).toBe(0);
		});
	});

	describe('getProgressState', () => {
		it('classifies null as indeterminate', () => {
			expect(getProgressState(null, 100)).toBe('indeterminate');
		});

		it('classifies value === max as complete', () => {
			expect(getProgressState(100, 100)).toBe('complete');
		});

		it('classifies any other determinate value as loading', () => {
			expect(getProgressState(50, 100)).toBe('loading');
			expect(getProgressState(0, 100)).toBe('loading');
		});
	});

	describe('getDefaultValueText', () => {
		it('rounds the percentage to "{n}%"', () => {
			expect(getDefaultValueText(25, 0, 50)).toBe('50%');
			expect(getDefaultValueText(1, 0, 3)).toBe('33%');
		});

		it('resolves the max === min branch to "100%"', () => {
			expect(getDefaultValueText(10, 10, 10)).toBe('100%');
		});
	});
});

describe('roles and ARIA (determinate)', () => {
	it('always carries role="progressbar"', () => {
		const { container } = render(Harness, { props: { value: 50 } });
		expect(bySlot(container, 'circular-progress')).toHaveAttribute('role', 'progressbar');
	});

	it('renders aria-valuenow/valuemin/valuemax/valuetext for a determinate value', () => {
		const { container } = render(Harness, { props: { value: 50 } });
		const root = bySlot(container, 'circular-progress');

		expect(root).toHaveAttribute('aria-valuenow', '50');
		expect(root).toHaveAttribute('aria-valuemin', '0');
		expect(root).toHaveAttribute('aria-valuemax', '100');
		expect(root).toHaveAttribute('aria-valuetext', '50%');
	});

	it('honours a caller-supplied getValueText', () => {
		const { container } = render(Harness, {
			props: {
				value: 25,
				min: 0,
				max: 50,
				getValueText: (v: number, _min: number, max: number) => `${v} of ${max}`
			}
		});
		const root = bySlot(container, 'circular-progress');

		expect(root).toHaveAttribute('aria-valuetext', '25 of 50');
		expect(bySlot(container, 'circular-progress-value-text')).toHaveTextContent('25 of 50');
	});

	it('wires aria-describedby to the ValueText part id', () => {
		const { container } = render(Harness, { props: { value: 50 } });
		const root = bySlot(container, 'circular-progress');
		const valueText = bySlot(container, 'circular-progress-value-text');

		expect(root.getAttribute('aria-describedby')).toBe(valueText.id);
	});

	it('renders a label element and wires aria-labelledby when label is set', () => {
		const { container } = render(Harness, { props: { value: 50, label: 'Upload' } });
		const root = bySlot(container, 'circular-progress');
		const labelledBy = root.getAttribute('aria-labelledby');

		expect(labelledBy).toBeTruthy();
		const labelEl = document.getElementById(labelledBy as string);
		expect(labelEl).toHaveTextContent('Upload');
	});

	it('the Indicator part carries aria-hidden and focusable=false', () => {
		const { container } = render(Harness, { props: { value: 50 } });
		const indicator = bySlot(container, 'circular-progress-indicator');

		expect(indicator).toHaveAttribute('aria-hidden', 'true');
		expect(indicator).toHaveAttribute('focusable', 'false');
	});
});

describe('indeterminate and reduced motion', () => {
	it('omitting value renders data-state="indeterminate" and omits determinate attributes', () => {
		const { container } = render(Harness, { props: {} });
		const root = bySlot(container, 'circular-progress');

		expect(root).toHaveAttribute('data-state', 'indeterminate');
		expect(root).not.toHaveAttribute('aria-valuenow');
		expect(root).not.toHaveAttribute('aria-valuetext');
		expect(root).not.toHaveAttribute('aria-describedby');
		expect(root.getAttribute('data-value')).toBeNull();
		expect(root.getAttribute('data-percentage')).toBeNull();
	});

	it('an explicit value={null} behaves identically to omitting value', () => {
		const { container } = render(Harness, { props: { value: null } });
		const root = bySlot(container, 'circular-progress');

		expect(root).toHaveAttribute('data-state', 'indeterminate');
		expect(root).not.toHaveAttribute('aria-valuenow');
	});

	it('the Range part spins at circumference * 0.75 while indeterminate', () => {
		const { container } = render(Harness, { props: {} });
		const range = bySlot(container, 'circular-progress-range');
		const circumference = circumferenceOf(22);

		expect(range).toHaveAttribute('data-state', 'indeterminate');
		expect(Number(range.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference * 0.75);
	});

	it('ValueText renders no default text content while indeterminate', () => {
		const { container } = render(Harness, { props: {} });
		expect(bySlot(container, 'circular-progress-value-text')).toHaveTextContent('');
	});

	it('an explicit children snippet on ValueText still renders while indeterminate', () => {
		const { container } = render(Harness, { props: { valueTextChildren: true } });
		expect(bySlot(container, 'circular-progress-value-text')).toHaveTextContent('Custom');
	});

	it('value={100} with the default max renders data-state="complete"', () => {
		const { container } = render(Harness, { props: { value: 100 } });
		expect(bySlot(container, 'circular-progress')).toHaveAttribute('data-state', 'complete');
	});

	it('the range carries the reduced-motion media query disabling the spin animation in its source', () => {
		expect(rangeSource).toMatch(
			/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation:\s*none/
		);
	});
});

describe('size/thickness/theming', () => {
	it('renders the documented default geometry with no size/thickness/min/max supplied', () => {
		const { container } = render(Harness, { props: { value: 50 } });
		const indicator = bySlot(container, 'circular-progress-indicator');
		const track = bySlot(container, 'circular-progress-track');
		const range = bySlot(container, 'circular-progress-range');
		const root = bySlot(container, 'circular-progress');

		expect(indicator).toHaveAttribute('width', '48');
		expect(indicator).toHaveAttribute('height', '48');
		expect(indicator).toHaveAttribute('viewBox', '0 0 48 48');

		for (const circle of [track, range]) {
			expect(circle).toHaveAttribute('r', '22');
			expect(circle).toHaveAttribute('cx', '24');
			expect(circle).toHaveAttribute('cy', '24');
			expect(circle).toHaveAttribute('stroke-width', '4');
		}

		expect(root).toHaveAttribute('aria-valuemin', '0');
		expect(root).toHaveAttribute('aria-valuemax', '100');
	});

	it('a custom size/thickness produce the documented geometry', () => {
		const { container } = render(Harness, { props: { value: 50, size: 80, thickness: 6 } });
		const indicator = bySlot(container, 'circular-progress-indicator');
		const track = bySlot(container, 'circular-progress-track');
		const range = bySlot(container, 'circular-progress-range');

		expect(indicator).toHaveAttribute('width', '80');
		expect(indicator).toHaveAttribute('height', '80');
		expect(indicator).toHaveAttribute('viewBox', '0 0 80 80');

		for (const circle of [track, range]) {
			expect(circle).toHaveAttribute('stroke-width', '6');
			expect(circle).toHaveAttribute('r', '37');
		}
	});

	it('both circles carry the verbatim geometry chrome attributes in default and custom renders', () => {
		for (const props of [{ value: 50 }, { value: 50, size: 80, thickness: 6 }]) {
			const { container, unmount } = render(Harness, { props });
			const track = bySlot(container, 'circular-progress-track');
			const range = bySlot(container, 'circular-progress-range');

			for (const circle of [track, range]) {
				expect(circle).toHaveAttribute('fill', 'none');
				expect(circle).toHaveAttribute('stroke', 'currentColor');
				expect(circle).toHaveAttribute('stroke-linecap', 'round');
				expect(circle).toHaveAttribute('vector-effect', 'non-scaling-stroke');
			}
			unmount();
		}
	});

	it("a caller class is present alongside each part's own default classes", () => {
		const { container } = render(Harness, {
			props: {
				value: 50,
				class: 'my-root',
				trackClass: 'my-track',
				rangeClass: 'my-range',
				valueTextClass: 'my-value-text'
			}
		});

		const root = bySlot(container, 'circular-progress');
		expect(root.classList.contains('my-root')).toBe(true);
		expect(root.classList.contains('relative')).toBe(true);
		expect(root.classList.contains('inline-flex')).toBe(true);
		expect(root.classList.contains('w-fit')).toBe(true);
		expect(root.classList.contains('items-center')).toBe(true);
		expect(root.classList.contains('justify-center')).toBe(true);

		const indicator = bySlot(container, 'circular-progress-indicator');
		expect(indicator.classList.contains('-rotate-90')).toBe(true);
		expect(indicator.classList.contains('transform')).toBe(true);

		const track = bySlot(container, 'circular-progress-track');
		expect(track.classList.contains('my-track')).toBe(true);
		expect(track.classList.contains('text-muted-foreground/20')).toBe(true);

		const range = bySlot(container, 'circular-progress-range');
		expect(range.classList.contains('my-range')).toBe(true);
		expect(range.classList.contains('origin-center')).toBe(true);
		expect(range.classList.contains('text-primary')).toBe(true);
		expect(range.classList.contains('transition-all')).toBe(true);
		expect(range.classList.contains('duration-300')).toBe(true);
		expect(range.classList.contains('ease-in-out')).toBe(true);

		const valueText = bySlot(container, 'circular-progress-value-text');
		expect(valueText.classList.contains('my-value-text')).toBe(true);
		expect(valueText.classList.contains('absolute')).toBe(true);
		expect(valueText.classList.contains('inset-0')).toBe(true);
		expect(valueText.classList.contains('flex')).toBe(true);
		expect(valueText.classList.contains('items-center')).toBe(true);
		expect(valueText.classList.contains('justify-center')).toBe(true);
		expect(valueText.classList.contains('text-sm')).toBe(true);
		expect(valueText.classList.contains('font-medium')).toBe(true);
	});
});

describe('per-part data attributes', () => {
	it('determinate render carries data-slot/data-state on all five parts and value/min/max/percentage where documented', () => {
		const { container } = render(Harness, { props: { value: 50 } });

		const slots = [
			'circular-progress',
			'circular-progress-indicator',
			'circular-progress-track',
			'circular-progress-range',
			'circular-progress-value-text'
		];
		for (const slot of slots) {
			const el = bySlot(container, slot);
			expect(el).toHaveAttribute('data-slot', slot);
			expect(el).toHaveAttribute('data-state', 'loading');
		}

		const root = bySlot(container, 'circular-progress');
		const indicator = bySlot(container, 'circular-progress-indicator');
		const track = bySlot(container, 'circular-progress-track');
		const range = bySlot(container, 'circular-progress-range');
		const valueText = bySlot(container, 'circular-progress-value-text');

		for (const el of [root, indicator, range]) {
			expect(el).toHaveAttribute('data-value', '50');
			expect(el).toHaveAttribute('data-min', '0');
			expect(el).toHaveAttribute('data-max', '100');
		}
		for (const el of [root, indicator]) {
			expect(el).toHaveAttribute('data-percentage', '0.5');
		}

		expect(track.getAttribute('data-value')).toBeNull();
		expect(track.getAttribute('data-min')).toBeNull();
		expect(track.getAttribute('data-max')).toBeNull();
		expect(track.getAttribute('data-percentage')).toBeNull();
		expect(range.getAttribute('data-percentage')).toBeNull();
		expect(valueText.getAttribute('data-value')).toBeNull();
		expect(valueText.getAttribute('data-min')).toBeNull();
		expect(valueText.getAttribute('data-max')).toBeNull();
		expect(valueText.getAttribute('data-percentage')).toBeNull();
	});

	it('indeterminate render omits data-value/data-percentage everywhere but keeps data-min/data-max', () => {
		const { container } = render(Harness, { props: {} });

		const slots = [
			'circular-progress',
			'circular-progress-indicator',
			'circular-progress-track',
			'circular-progress-range',
			'circular-progress-value-text'
		];
		for (const slot of slots) {
			const el = bySlot(container, slot);
			expect(el).toHaveAttribute('data-state', 'indeterminate');
			expect(el.getAttribute('data-value')).toBeNull();
			expect(el.getAttribute('data-percentage')).toBeNull();
		}

		const root = bySlot(container, 'circular-progress');
		const indicator = bySlot(container, 'circular-progress-indicator');
		const range = bySlot(container, 'circular-progress-range');
		for (const el of [root, indicator, range]) {
			expect(el).toHaveAttribute('data-min', '0');
			expect(el).toHaveAttribute('data-max', '100');
		}
	});

	it('value={100} with the default max renders data-state="complete" on all five parts', () => {
		const { container } = render(Harness, { props: { value: 100 } });

		for (const slot of [
			'circular-progress',
			'circular-progress-indicator',
			'circular-progress-track',
			'circular-progress-range',
			'circular-progress-value-text'
		]) {
			expect(bySlot(container, slot)).toHaveAttribute('data-state', 'complete');
		}
	});
});

describe('keyboard / non-focusable', () => {
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
			const { container } = render(Harness, { props: { value: 50 }, target: mount });
			const root = bySlot(container, 'circular-progress');
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

	it('Enter/Space/ArrowLeft/ArrowRight change no attribute — the complete (empty) upstream key set', () => {
		const { container } = render(Harness, { props: { value: 50 } });
		const root = bySlot(container, 'circular-progress');
		const before = {
			'data-state': root.getAttribute('data-state'),
			'aria-valuenow': root.getAttribute('aria-valuenow')
		};

		for (const key of ['Enter', ' ', 'ArrowLeft', 'ArrowRight']) {
			root.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
		}

		expect(root.getAttribute('data-state')).toBe(before['data-state']);
		expect(root.getAttribute('aria-valuenow')).toBe(before['aria-valuenow']);
	});
});

describe('controlled vs uncontrolled', () => {
	it('an uncontrolled render with no value stays indeterminate across re-renders that do not change value', async () => {
		const { container, rerender } = render(Harness, { props: {} });
		let root = bySlot(container, 'circular-progress');
		expect(root).toHaveAttribute('data-state', 'indeterminate');

		await rerender({ label: 'still no value' });

		root = bySlot(container, 'circular-progress');
		expect(root).toHaveAttribute('data-state', 'indeterminate');
	});

	it('rerender({ value }) moves aria-valuenow/data-value/data-percentage/stroke-dashoffset', async () => {
		const { container, rerender } = render(Harness, { props: { value: 0 } });
		let root = bySlot(container, 'circular-progress');
		let range = bySlot(container, 'circular-progress-range');
		const circumference = circumferenceOf(22);

		expect(root).toHaveAttribute('aria-valuenow', '0');
		expect(Number(range.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference);

		await rerender({ value: 100 });

		root = bySlot(container, 'circular-progress');
		range = bySlot(container, 'circular-progress-range');
		expect(root).toHaveAttribute('aria-valuenow', '100');
		expect(root).toHaveAttribute('data-value', '100');
		expect(root).toHaveAttribute('data-percentage', '1');
		expect(Number(range.getAttribute('stroke-dashoffset'))).toBeCloseTo(0);
	});
});

describe('RTL', () => {
	it('renders identical class/viewBox/stroke-dasharray/stroke-dashoffset under dir="rtl"', () => {
		const ltr = render(Harness, { props: { value: 50 } });
		const ltrRoot = bySlot(ltr.container, 'circular-progress');
		const ltrIndicator = bySlot(ltr.container, 'circular-progress-indicator');
		const ltrRange = bySlot(ltr.container, 'circular-progress-range');
		const snapshot = {
			rootClass: ltrRoot.getAttribute('class'),
			viewBox: ltrIndicator.getAttribute('viewBox'),
			dasharray: ltrRange.getAttribute('stroke-dasharray'),
			dashoffset: ltrRange.getAttribute('stroke-dashoffset')
		};
		ltr.unmount();

		const rtl = render(Harness, { props: { value: 50, rtl: true } });
		const rtlRoot = bySlot(rtl.container, 'circular-progress');
		const rtlIndicator = bySlot(rtl.container, 'circular-progress-indicator');
		const rtlRange = bySlot(rtl.container, 'circular-progress-range');

		expect(rtlRoot.getAttribute('class')).toBe(snapshot.rootClass);
		expect(rtlIndicator.getAttribute('viewBox')).toBe(snapshot.viewBox);
		expect(rtlRange.getAttribute('stroke-dasharray')).toBe(snapshot.dasharray);
		expect(rtlRange.getAttribute('stroke-dashoffset')).toBe(snapshot.dashoffset);
	});
});

describe('guard rails and edge cases', () => {
	it('Indicator throws when rendered outside Root', () => {
		expect(() => render(CircularProgress.Indicator, { props: {} })).toThrow(
			/must be used within `<CircularProgress>`/
		);
	});

	it('Track throws when rendered outside Root', () => {
		expect(() => render(CircularProgress.Track, { props: {} })).toThrow(
			/must be used within `<CircularProgress>`/
		);
	});

	it('Range throws when rendered outside Root', () => {
		expect(() => render(CircularProgress.Range, { props: {} })).toThrow(
			/must be used within `<CircularProgress>`/
		);
	});

	it('ValueText throws when rendered outside Root', () => {
		expect(() => render(CircularProgress.ValueText, { props: {} })).toThrow(
			/must be used within `<CircularProgress>`/
		);
	});

	describe('clamping / validation table', () => {
		const errorSpy = () => vi.spyOn(console, 'error').mockImplementation(() => {});
		const warnSpy = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

		it('value=150,max=100 clamps to 100 and complete', () => {
			const spy = errorSpy();
			const { container } = render(Harness, { props: { value: 150 } });
			const root = bySlot(container, 'circular-progress');

			expect(root).toHaveAttribute('aria-valuenow', '100');
			expect(root).toHaveAttribute('data-state', 'complete');
			spy.mockRestore();
		});

		it('value=-20,min=0 clamps to 0 and loading', () => {
			const spy = errorSpy();
			const { container } = render(Harness, { props: { value: -20 } });
			const root = bySlot(container, 'circular-progress');

			expect(root).toHaveAttribute('aria-valuenow', '0');
			expect(root).toHaveAttribute('data-state', 'loading');
			spy.mockRestore();
		});

		it('value=NaN/Infinity resolve to indeterminate', () => {
			const spy = errorSpy();
			const nan = render(Harness, { props: { value: Number.NaN } });
			expect(bySlot(nan.container, 'circular-progress')).toHaveAttribute(
				'data-state',
				'indeterminate'
			);
			nan.unmount();

			const inf = render(Harness, { props: { value: Number.POSITIVE_INFINITY } });
			expect(bySlot(inf.container, 'circular-progress')).toHaveAttribute(
				'data-state',
				'indeterminate'
			);
			spy.mockRestore();
		});

		it('max=0/-5/NaN all fall back to 100', () => {
			const spy = errorSpy();
			for (const max of [0, -5, Number.NaN]) {
				const { container, unmount } = render(Harness, { props: { value: 50, max } });
				expect(bySlot(container, 'circular-progress')).toHaveAttribute('aria-valuemax', '100');
				unmount();
			}
			spy.mockRestore();
		});

		it('max=50,min=80 corrects max to 81', () => {
			const { container } = render(Harness, { props: { value: 80, min: 80, max: 50 } });
			const root = bySlot(container, 'circular-progress');

			expect(root).toHaveAttribute('aria-valuemin', '80');
			expect(root).toHaveAttribute('aria-valuemax', '81');
		});

		it('min=NaN falls back to 0', () => {
			const { container } = render(Harness, { props: { value: 50, min: Number.NaN } });
			expect(bySlot(container, 'circular-progress')).toHaveAttribute('aria-valuemin', '0');
		});

		it('thickness=12,size=8 renders r="0" without throwing', () => {
			const spy = warnSpy();
			let container!: HTMLElement;
			expect(() => {
				({ container } = render(Harness, { props: { value: 50, size: 8, thickness: 12 } }));
			}).not.toThrow();

			expect(bySlot(container, 'circular-progress-track')).toHaveAttribute('r', '0');
			spy.mockRestore();
		});
	});
});

describe('Svelte-specific and Combined', () => {
	it('bind:ref populates the root HTMLDivElement', () => {
		let rootRef: HTMLDivElement | null = null;
		render(Harness, {
			props: {
				value: 50,
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

	it('the child snippet on Root spreads the full attribute payload onto the caller element and ref stays null', () => {
		let rootRef: HTMLDivElement | null = null;
		render(Harness, {
			props: {
				value: 50,
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
		expect(button).toHaveAttribute('role', 'progressbar');
		expect(button).toHaveAttribute('data-slot', 'circular-progress');
		expect(button).toHaveAttribute('aria-valuenow', '50');
		expect(rootRef).toBeNull();
	});

	it('the child snippet on ValueText spreads the merged payload and children/label are not rendered on Root', () => {
		const { container } = render(Harness, {
			props: { value: 50, useRootChild: true, useValueTextChild: true }
		});

		const valueTextChild = screen.getByTestId('value-text-child');
		expect(valueTextChild).toHaveAttribute('data-slot', 'circular-progress-value-text');
		expect(container.querySelector('span[data-slot="circular-progress-value-text"]')).toBeNull();
	});

	it('explicit children on ValueText take precedence over the computed value text', () => {
		const { container } = render(Harness, { props: { value: 50, valueTextChildren: true } });
		expect(bySlot(container, 'circular-progress-value-text')).toHaveTextContent('Custom');
	});

	it('CircularProgress.Combined renders the same five data-slots as the manual composition', () => {
		const { container } = render(CircularProgress.Combined, { props: { value: 60 } });

		for (const slot of [
			'circular-progress',
			'circular-progress-indicator',
			'circular-progress-track',
			'circular-progress-range',
			'circular-progress-value-text'
		]) {
			expect(bySlot(container, slot)).toBeInTheDocument();
		}
		expect(bySlot(container, 'circular-progress')).toHaveAttribute('aria-valuenow', '60');
	});

	it('forwards restProps (id, data-testid) to every part and an onclick handler on Root', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();
		const { container } = render(Harness, {
			props: { value: 50, id: 'root-id', 'data-testid': 'root-testid', onclick }
		});

		const root = bySlot(container, 'circular-progress');
		expect(root).toHaveAttribute('id', 'root-id');
		expect(root).toHaveAttribute('data-testid', 'root-testid');

		await user.click(root);
		expect(onclick).toHaveBeenCalledTimes(1);
	});
});

describe('barrel', () => {
	it('exposes Root/Indicator/Track/Range/ValueText/Combined under both short and prefixed names', () => {
		expect(CircularProgress.Root).toBe(CircularProgress.CircularProgress);
		expect(CircularProgress.Indicator).toBe(CircularProgress.CircularProgressIndicator);
		expect(CircularProgress.Track).toBe(CircularProgress.CircularProgressTrack);
		expect(CircularProgress.Range).toBe(CircularProgress.CircularProgressRange);
		expect(CircularProgress.ValueText).toBe(CircularProgress.CircularProgressValueText);
		expect(CircularProgress.Combined).toBe(CircularProgress.CircularProgressCombined);
	});

	it('holds the documented ordered tuple of progress states', () => {
		expect(CircularProgress.PROGRESS_STATES).toEqual(['indeterminate', 'complete', 'loading']);
	});
});
