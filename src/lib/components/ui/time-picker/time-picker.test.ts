import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	buildHourValues,
	buildStepValues,
	clamp,
	ColumnNavigation,
	DEFAULT_SEGMENT_PLACEHOLDER,
	focusFirstOf,
	formatColumnValue,
	formatTimeValue,
	getIs12Hour,
	maxFirstDigit,
	normalizeSegmentPlaceholder,
	parseTimeString,
	PERIODS,
	SEGMENTS,
	stepSegment,
	to12Hour,
	to24Hour,
	togglePeriod,
	type TimePeriod,
	type TimeValue
} from './index.js';
import Harness, { type TimePickerHarnessProps } from './time-picker.test.svelte';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** `"en-US"` renders a 12-hour clock, `"en-GB"` a 24-hour one — never the ambient locale (R-24). */
const US = 'en-US';
const GB = 'en-GB';

/** The instant every clock-dependent test freezes at: 2026-01-15 09:41:07 local. */
const FROZEN = new Date(2026, 0, 15, 9, 41, 7);

function renderPicker(props: TimePickerHarnessProps = {}) {
	return render(Harness, { props: { locale: GB, ...props } });
}

function segment(name: 'hour' | 'minute' | 'second' | 'period'): HTMLInputElement {
	const element = screen.getByTestId(name);
	if (!(element instanceof HTMLInputElement)) {
		throw new Error(`the ${name} segment did not render an <input>`);
	}
	return element;
}

function bySlot(slot: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function querySlot(slot: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
}

/**
 * jsdom has no layout engine, so floating-ui's `hide` middleware marks the popover wrapper
 * `visibility: hidden` and role queries inside it need `{ hidden: true }`. Column items are located
 * through their `data-slot` instead, which is unaffected and is also how a consumer styles them.
 */
function columnItems(testId: string): HTMLButtonElement[] {
	const column = screen.queryByTestId(testId);
	if (!column) return [];
	return Array.from(
		column.querySelectorAll<HTMLButtonElement>('[data-slot="time-picker-column-item"]')
	);
}

function itemLabels(testId: string): string[] {
	return columnItems(testId).map((item) => item.textContent?.trim() ?? '');
}

/**
 * Open the dropdown from the trigger and wait for the panel's own focus move to settle.
 *
 * bits-ui's focus scope focuses the content container first and the port's `onOpenAutoFocus` moves
 * focus onto a column item a tick later, so a test that focuses an item before that has landed would
 * have it stolen straight back.
 */
async function openPanel(user: ReturnType<typeof userEvent.setup>): Promise<void> {
	await user.click(screen.getByTestId('trigger'));
	await waitFor(() => expect(querySlot('time-picker-content')).not.toBeNull());
	await waitFor(() =>
		expect(document.activeElement?.getAttribute('data-slot')).toBe('time-picker-column-item')
	);
	// bits-ui's scope can still pull focus once more on a later frame in jsdom, so let it settle
	// before a test puts focus where it wants it.
	await new Promise((resolve) => setTimeout(resolve, 50));
}

function selection(element: HTMLInputElement): [number | null, number | null] {
	return [element.selectionStart, element.selectionEnd];
}

// ---------------------------------------------------------------------------
// T005 — the pure engine, with no rendering at all (quickstart V-1…V-5)
// ---------------------------------------------------------------------------

describe('time engine — constants and locale detection (T005, V-1)', () => {
	it('exposes the documented tuples in upstream declaration order', () => {
		expect(SEGMENTS).toEqual(['hour', 'minute', 'second', 'period']);
		expect(PERIODS).toEqual(['AM', 'PM']);
		expect(DEFAULT_SEGMENT_PLACEHOLDER).toBe('--');
	});

	it.each([
		[US, true],
		[GB, false],
		['de-DE', false]
	] as const)('getIs12Hour(%s) is %s', (locale, expected) => {
		expect(getIs12Hour(locale)).toBe(expected);
	});

	it('asks Intl rather than consulting a locale table', () => {
		// The only observable proof that no hard-coded list is involved: the answer tracks whatever
		// `Intl.DateTimeFormat` renders for 13:00 in that locale, for every locale.
		for (const locale of [US, GB, 'de-DE', 'ja-JP', 'fr-FR', 'en-AU']) {
			const formatted = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).format(
				new Date(2000, 0, 1, 13, 0, 0)
			);
			expect(getIs12Hour(locale), locale).toBe(
				/am|pm/i.test(formatted) || !formatted.includes('13')
			);
		}
	});

	it('never throws on an invalid locale tag', () => {
		expect(() => getIs12Hour('not a locale')).not.toThrow();
		expect(typeof getIs12Hour('not a locale')).toBe('boolean');
		expect(typeof getIs12Hour(undefined)).toBe('boolean');
	});
});

describe('time engine — parseTimeString / formatTimeValue (T005, V-2)', () => {
	it.each([
		['', null],
		[undefined, null],
		['garbage', null],
		['10', null],
		['--:--', null],
		['25:99', null],
		['10:30', { hour: 10, minute: 30 }],
		['10:30:45', { hour: 10, minute: 30, second: 45 }],
		['10:--', { hour: 10 }],
		['--:30', { minute: 30 }],
		['--:--:45', { second: 45 }],
		['25:30', { minute: 30 }],
		['10:99', { hour: 10 }],
		['00:00', { hour: 0, minute: 0 }],
		['23:59:59', { hour: 23, minute: 59, second: 59 }]
	] as const)('parseTimeString(%j) is %j', (input, expected) => {
		expect(parseTimeString(input)).toEqual(expected);
	});

	it.each([
		[{}, false, '--:--'],
		[{}, true, '--:--:--'],
		[{ hour: 10, minute: 30 }, false, '10:30'],
		[{ hour: 10, minute: 30 }, true, '10:30:--'],
		[{ hour: 10 }, false, '10:--'],
		[{ minute: 30 }, false, '--:30'],
		[{ hour: 9, minute: 5, second: 3 }, true, '09:05:03'],
		// `period` is display-only and is never serialised.
		[{ hour: 21, minute: 30, period: 'PM' }, false, '21:30']
	] as [TimeValue, boolean, string][])(
		'formatTimeValue(%j, %s) is %s',
		(value, showSeconds, expected) => {
			expect(formatTimeValue(value, showSeconds)).toBe(expected);
		}
	);

	it.each(['10:30', '10:30:45', '10:--', '--:30', '00:00', '23:59:59'])(
		'round trips %s',
		(input) => {
			const parsed = parseTimeString(input);
			expect(parsed).not.toBeNull();
			expect(formatTimeValue(parsed as TimeValue, input.split(':').length === 3)).toBe(input);
		}
	);
});

describe('time engine — 12↔24 conversion and clamping (T005)', () => {
	it.each([
		[0, 12, 'AM'],
		[1, 1, 'AM'],
		[11, 11, 'AM'],
		[12, 12, 'PM'],
		[13, 1, 'PM'],
		[23, 11, 'PM']
	] as const)('to12Hour(%i) is %i %s', (hour24, hour, period) => {
		expect(to12Hour(hour24)).toEqual({ hour, period });
	});

	it.each([
		[12, 'AM', 0],
		[12, 'PM', 12],
		[1, 'AM', 1],
		[1, 'PM', 13],
		[11, 'PM', 23]
	] as [number, TimePeriod, number][])('to24Hour(%i, %s) is %i', (hour12, period, expected) => {
		expect(to24Hour(hour12, period)).toBe(expected);
	});

	it('is a bijection over every 24-hour hour', () => {
		for (let hour = 0; hour < 24; hour++) {
			const { hour: display, period } = to12Hour(hour);
			expect(to24Hour(display, period), String(hour)).toBe(hour);
		}
	});

	it.each([
		[5, 0, 23, 5],
		[-3, 0, 23, 0],
		[99, 0, 23, 23],
		[0, 1, 12, 1]
	] as const)('clamp(%i, %i, %i) is %i', (value, min, max, expected) => {
		expect(clamp(value, min, max)).toBe(expected);
	});
});

describe('time engine — stepSegment wrap-around (T005, V-3)', () => {
	it.each([
		// hour, 24-hour: every boundary of data-model.md §1
		['hour', 23, 1, false, 0],
		['hour', 0, -1, false, 23],
		['hour', 0, 1, false, 1],
		['hour', 23, -1, false, 22],
		['hour', null, 1, false, 0],
		['hour', null, -1, false, 23],
		// hour, 12-hour
		['hour', 12, 1, true, 1],
		['hour', 1, -1, true, 12],
		['hour', 11, 1, true, 12],
		['hour', 2, -1, true, 1],
		['hour', null, 1, true, 12],
		['hour', null, -1, true, 12],
		// minute and second
		['minute', 59, 1, false, 0],
		['minute', 0, -1, false, 59],
		['minute', null, 1, false, 0],
		['minute', null, -1, false, 59],
		['second', 59, 1, true, 0],
		['second', 0, -1, true, 59],
		['second', null, 1, true, 0],
		['second', null, -1, true, 59]
	] as ['hour' | 'minute' | 'second', number | null, 1 | -1, boolean, number][])(
		'stepSegment(%s, %j, %i, is12Hour=%s) is %i',
		(seg, current, delta, is12Hour, expected) => {
			expect(stepSegment(seg, current, delta, is12Hour)).toBe(expected);
		}
	);

	it('walks the whole 24-hour cycle and returns to its start', () => {
		let hour = 0;
		for (let step = 0; step < 24; step++) hour = stepSegment('hour', hour, 1, false);
		expect(hour).toBe(0);
	});

	it('walks the whole 12-hour cycle and returns to its start', () => {
		let hour = 12;
		for (let step = 0; step < 12; step++) hour = stepSegment('hour', hour, 1, true);
		expect(hour).toBe(12);
	});

	it('leaves the period segment to togglePeriod and stays total', () => {
		expect(stepSegment('period', null, 1, true)).toBe(0);
		expect(stepSegment('period', 3, -1, true)).toBe(3);
	});
});

describe('time engine — togglePeriod (T005, V-3)', () => {
	it.each([
		[null, 'PM'],
		['AM', 'PM'],
		['PM', 'AM']
	] as [TimePeriod | null, TimePeriod][])('togglePeriod(%j) is %s', (current, expected) => {
		expect(togglePeriod(current)).toBe(expected);
	});

	it('has no third state', () => {
		let period = togglePeriod(null);
		const seen = new Set<string>();
		for (let step = 0; step < 10; step++) {
			seen.add(period);
			period = togglePeriod(period);
		}
		expect([...seen].sort()).toEqual(['AM', 'PM']);
	});
});

describe('time engine — column values (T005, V-4)', () => {
	it('generates 12-hour hours as a rotation of 1…12', () => {
		expect(buildHourValues(true, 1)).toEqual([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
	});

	it('generates 24-hour hours as 0…23', () => {
		expect(buildHourValues(false, 1)).toEqual(Array.from({ length: 24 }, (_, i) => i));
	});

	it.each([
		[true, 3, [12, 3, 6, 9]],
		[false, 6, [0, 6, 12, 18]],
		[false, 5, [0, 5, 10, 15, 20]]
	] as const)('buildHourValues(%s, %i) is %j', (is12Hour, step, expected) => {
		expect(buildHourValues(is12Hour, step)).toEqual(expected);
	});

	it.each([
		[60, 15, [0, 15, 30, 45]],
		[60, 10, [0, 10, 20, 30, 40, 50]],
		[60, 30, [0, 30]]
	] as const)('buildStepValues(%i, %i) is %j', (limit, step, expected) => {
		expect(buildStepValues(limit, step)).toEqual(expected);
	});

	it('yields sixty entries at step 1 and nothing at a non-positive step', () => {
		expect(buildStepValues(60, 1)).toHaveLength(60);
		expect(buildStepValues(60, 0)).toEqual([]);
		expect(buildStepValues(60, -5)).toEqual([]);
		expect(buildHourValues(false, 0)).toEqual([]);
	});

	it.each([
		[5, '2-digit', '05'],
		[5, 'numeric', '5'],
		[12, '2-digit', '12'],
		['AM', '2-digit', 'AM'],
		['AM', 'numeric', 'AM']
	] as const)('formatColumnValue(%j, %s) is %s', (value, format, expected) => {
		expect(formatColumnValue(value, format)).toBe(expected);
	});
});

describe('time engine — placeholders and maxFirstDigit (T005, V-5)', () => {
	it('widens a bare string to all four segments', () => {
		expect(normalizeSegmentPlaceholder('##')).toEqual({
			hour: '##',
			minute: '##',
			second: '##',
			period: '##'
		});
	});

	it('fills only the keys an object omits', () => {
		expect(normalizeSegmentPlaceholder({ hour: 'hh', period: 'aa' })).toEqual({
			hour: 'hh',
			minute: '--',
			second: '--',
			period: 'aa'
		});
	});

	it('defaults everything when nothing is supplied', () => {
		expect(normalizeSegmentPlaceholder(undefined)).toEqual({
			hour: '--',
			minute: '--',
			second: '--',
			period: '--'
		});
	});

	it.each([
		['hour', true, 1],
		['hour', false, 2],
		['minute', true, 5],
		['minute', false, 5],
		['second', true, 5],
		['period', true, -1]
	] as const)('maxFirstDigit(%s, %s) is %i', (seg, is12Hour, expected) => {
		expect(maxFirstDigit(seg, is12Hour)).toBe(expected);
	});
});

describe('column-navigation — focusFirstOf (T005)', () => {
	it('focuses the first candidate that takes focus and stops there', () => {
		const container = document.createElement('div');
		const disabled = document.createElement('button');
		disabled.disabled = true;
		const enabled = document.createElement('button');
		const later = document.createElement('button');
		container.append(disabled, enabled, later);
		document.body.append(container);

		focusFirstOf([disabled, enabled, later]);

		expect(document.activeElement).toBe(enabled);
		container.remove();
	});

	it('leaves focus alone when nothing is focusable', () => {
		const container = document.createElement('div');
		const anchor = document.createElement('button');
		const disabled = document.createElement('button');
		disabled.disabled = true;
		container.append(anchor, disabled);
		document.body.append(container);
		anchor.focus();

		focusFirstOf([disabled]);

		expect(document.activeElement).toBe(anchor);
		container.remove();
	});
});

describe('column-navigation — construction without markup (T005)', () => {
	it('is constructible outside any component and answers safely while empty', () => {
		const nav = new ColumnNavigation({ getDir: () => 'ltr' });

		expect(nav.indexOfColumn('missing')).toBe(-1);
		expect(nav.columnIndexOf(null)).toBe(-1);
		expect(() => nav.focusPreferredIn(0)).not.toThrow();
		expect(() => nav.moveAcrossColumns('missing', 1)).not.toThrow();
		expect(() => nav.moveWithinColumn('missing', 'missing', 1)).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// T006 — roles, names, data attributes and CSS variables (V-6…V-9)
// ---------------------------------------------------------------------------

describe('TimePicker — roles and label wiring (T006, V-6)', () => {
	it('renders the input group as a labelled group', () => {
		renderPicker();

		const group = screen.getByRole('group');
		const label = bySlot('time-picker-label');

		expect(group).toHaveAttribute('data-slot', 'time-picker-input-group');
		expect(label.id).not.toBe('');
		expect(group).toHaveAttribute('aria-labelledby', label.id);
		expect(group).toHaveAccessibleName('Appointment time');
	});

	it('points the label at the group it actually labels', () => {
		renderPicker();

		const group = screen.getByRole('group');
		expect(bySlot('time-picker-label')).toHaveAttribute('for', group.id);
	});

	it('resolves every id an aria-* attribute references', () => {
		renderPicker();

		for (const element of document.querySelectorAll('[aria-labelledby]')) {
			const id = element.getAttribute('aria-labelledby') ?? '';
			expect(document.getElementById(id), id).not.toBeNull();
		}
	});
});

describe('TimePicker — accessible names (T006, V-7)', () => {
	it('gives every segment a default accessible name', () => {
		renderPicker({ locale: US, withSeconds: true });

		for (const name of ['hour', 'minute', 'second', 'period']) {
			expect(screen.getByRole('textbox', { name })).toBe(segment(name as 'hour'));
		}
	});

	it('lets a caller override the default name', () => {
		renderPicker({ hourLabel: 'Heure' });

		expect(screen.getByRole('textbox', { name: 'Heure' })).toBe(segment('hour'));
		expect(screen.queryByRole('textbox', { name: 'hour' })).toBeNull();
	});

	// T036 / D-19 — the icon-only trigger would otherwise announce as a bare "button", because
	// `@lucide/svelte` hides an icon that gets neither children nor an a11y prop.
	it('names the icon-only trigger by default', () => {
		renderPicker();

		expect(screen.getByRole('button', { name: 'Open time picker' })).toBe(
			screen.getByTestId('trigger')
		);
	});

	it('lets a caller override the trigger name', () => {
		renderPicker({ triggerLabel: 'Ouvrir' });

		expect(screen.getByRole('button', { name: 'Ouvrir' })).toBe(screen.getByTestId('trigger'));
		expect(screen.queryByRole('button', { name: 'Open time picker' })).toBeNull();
	});

	it('leaves the name to the trigger content when the caller supplies children', () => {
		renderPicker({ withTriggerText: true });

		expect(screen.getByRole('button', { name: 'Choose a time' })).toBe(
			screen.getByTestId('trigger')
		);
		expect(screen.queryByRole('button', { name: 'Open time picker' })).toBeNull();
	});
});

describe('TimePicker — data-slot and state attributes (T006, V-8)', () => {
	it('carries a data-slot on every part', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: US, withSeconds: true });
		await openPanel(user);

		for (const slot of [
			'time-picker',
			'time-picker-label',
			'time-picker-input-group',
			'time-picker-input',
			'time-picker-separator',
			'time-picker-trigger',
			'time-picker-content',
			'time-picker-column-item',
			'time-picker-hour',
			'time-picker-minute',
			'time-picker-second',
			'time-picker-period',
			'time-picker-clear'
		]) {
			expect(querySlot(slot), slot).not.toBeNull();
		}
	});

	it('renders a plain column under its own data-slot', async () => {
		const user = userEvent.setup();
		renderPicker({ mode: 'column-item-child', locale: GB });
		await openPanel(user);

		expect(querySlot('time-picker-column')).not.toBeNull();
	});

	it('omits the state attributes entirely when the flags are unset', () => {
		renderPicker();

		for (const slot of ['time-picker', 'time-picker-input-group', 'time-picker-trigger']) {
			const element = bySlot(slot);
			expect(element, slot).not.toHaveAttribute('data-disabled');
			expect(element, slot).not.toHaveAttribute('data-invalid');
			expect(element, slot).not.toHaveAttribute('data-readonly');
		}
	});

	// T038 / FR-012 — all four come from the composed bits-ui popover rather than from this
	// component's markup, so nothing else in the suite would notice a primitive swap dropping them.
	it('reflects the popover state on the trigger and the content', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: US });

		const trigger = screen.getByTestId('trigger');
		expect(trigger).toHaveAttribute('data-state', 'closed');

		await openPanel(user);

		expect(trigger).toHaveAttribute('data-state', 'open');

		const content = bySlot('time-picker-content');
		expect(content).toHaveAttribute('data-state', 'open');
		expect(content).toHaveAttribute('data-side', 'bottom');
		expect(content).toHaveAttribute('data-align', 'start');
	});

	it('emits presence-only state attributes when they are set', () => {
		renderPicker({ disabled: true, invalid: true, readOnly: true });

		for (const slot of ['time-picker', 'time-picker-input-group', 'time-picker-trigger']) {
			const element = bySlot(slot);
			expect(element, slot).toHaveAttribute('data-disabled', '');
			expect(element, slot).toHaveAttribute('data-invalid', '');
			expect(element, slot).toHaveAttribute('data-readonly', '');
		}
	});

	it('marks each segment with its own name and placeholder state', () => {
		renderPicker({ defaultValue: '10:--' });

		expect(segment('hour')).toHaveAttribute('data-segment', 'hour');
		expect(segment('hour')).not.toHaveAttribute('data-placeholder');
		expect(segment('minute')).toHaveAttribute('data-placeholder', '');
	});
});

describe('TimePicker — CSS custom properties (T006, V-9)', () => {
	it('derives the four widths from the default placeholder', () => {
		renderPicker();

		const style = screen.getByRole('group').getAttribute('style') ?? '';
		expect(style).toContain('--time-picker-hour-input-width: 2ch');
		expect(style).toContain('--time-picker-minute-input-width: 2ch');
		expect(style).toContain('--time-picker-second-input-width: 2ch');
		expect(style).toContain('--time-picker-period-input-width: 2.5ch');
	});

	it('follows a custom placeholder, including the period allowance', () => {
		renderPicker({ segmentPlaceholder: { hour: 'hh', period: 'a.m.' } });

		const style = screen.getByRole('group').getAttribute('style') ?? '';
		expect(style).toContain('--time-picker-hour-input-width: 2ch');
		expect(style).toContain('--time-picker-period-input-width: 4.5ch');
	});

	it('gives every segment its own width variable', () => {
		renderPicker({ locale: US, withSeconds: true });

		for (const name of ['hour', 'minute', 'second', 'period'] as const) {
			expect(segment(name).getAttribute('style')).toContain(
				`width: var(--time-picker-${name}-input-width)`
			);
		}
	});

	it('merges a caller style on the group after the generated declarations', () => {
		renderPicker({ groupStyle: '--time-picker-hour-input-width: 5ch' });

		// The caller's declaration is emitted last, so it is the one the cascade keeps.
		const { style } = screen.getByRole('group');
		expect(style.getPropertyValue('--time-picker-hour-input-width').trim()).toBe('5ch');
		expect(style.getPropertyValue('--time-picker-minute-input-width').trim()).toBe('2ch');
		expect(style.getPropertyValue('--time-picker-second-input-width').trim()).toBe('2ch');
		expect(style.getPropertyValue('--time-picker-period-input-width').trim()).toBe('2.5ch');
	});

	it('lets a per-input style override the width for that segment alone', () => {
		renderPicker({
			locale: US,
			withSeconds: true,
			hourInputStyle: '--time-picker-hour-input-width: 7ch'
		});

		// Declared on the input itself, so `width: var(…)` on that same element resolves to it.
		expect(segment('hour').style.getPropertyValue('--time-picker-hour-input-width').trim()).toBe(
			'7ch'
		);

		for (const name of ['minute', 'second', 'period'] as const) {
			const style = segment(name).getAttribute('style') ?? '';
			expect(style, name).toContain(`width: var(--time-picker-${name}-input-width)`);
			expect(style, name).not.toContain('7ch');
		}

		// …and the group's own value is untouched, so the other segments still inherit it.
		expect(
			screen.getByRole('group').style.getPropertyValue('--time-picker-hour-input-width').trim()
		).toBe('2ch');
	});
});

// ---------------------------------------------------------------------------
// T007 — keyboard interaction (V-10…V-15, V-17, V-19, V-21…V-24)
// ---------------------------------------------------------------------------

describe('TimePicker — digit entry (T007, V-10/V-11)', () => {
	it('auto-pads a first digit that can still take a partner and stays put', async () => {
		const user = userEvent.setup();
		renderPicker();

		await user.click(segment('hour'));
		await user.keyboard('1');

		expect(segment('hour')).toHaveValue('01');
		expect(segment('hour')).toHaveFocus();
	});

	it('auto-advances when the first digit exceeds the 24-hour maximum', async () => {
		const user = userEvent.setup();
		renderPicker();

		await user.click(segment('hour'));
		await user.keyboard('9');

		expect(segment('hour')).toHaveValue('09');
		expect(segment('minute')).toHaveFocus();
	});

	it('uses the tighter 12-hour maximum', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: US });

		await user.click(segment('hour'));
		await user.keyboard('2');

		expect(segment('hour')).toHaveValue('02');
		expect(segment('minute')).toHaveFocus();
	});

	it('completes a two-digit entry and advances', async () => {
		const user = userEvent.setup();
		renderPicker();

		await user.click(segment('hour'));
		await user.keyboard('09');

		expect(segment('hour')).toHaveValue('09');
		expect(segment('minute')).toHaveFocus();
	});

	it('types a whole time across the segments', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ onValueChange });

		await user.click(segment('hour'));
		await user.keyboard('1430');

		expect(segment('hour')).toHaveValue('14');
		expect(segment('minute')).toHaveValue('30');
		expect(onValueChange).toHaveBeenLastCalledWith('14:30');
	});

	it('strips non-digits from a numeric segment', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ onValueChange });

		await user.click(segment('minute'));
		await user.keyboard('a');

		// The stripped keystroke leaves an empty in-progress edit, exactly as upstream does, and
		// commits nothing; blurring restores the placeholder.
		expect(segment('minute')).toHaveValue('');
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('clamps an out-of-range pair', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ onValueChange });

		await user.click(segment('minute'));
		await user.keyboard('59');

		expect(onValueChange).toHaveBeenLastCalledWith('--:59');
		expect(segment('minute')).toHaveValue('59');
	});
});

describe('TimePicker — arrow stepping in the segments (T007, V-12)', () => {
	it('wraps the 24-hour hour from 23 to 00 and back', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ defaultValue: '23:59', onValueChange });

		await user.click(segment('hour'));
		await user.keyboard('{ArrowUp}');
		expect(onValueChange).toHaveBeenLastCalledWith('00:59');

		await user.keyboard('{ArrowDown}');
		expect(onValueChange).toHaveBeenLastCalledWith('23:59');
	});

	it('wraps the 12-hour hour from 12 to 01 and back', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: US, defaultValue: '00:30' });

		await user.click(segment('hour'));
		expect(segment('hour')).toHaveValue('12');

		await user.keyboard('{ArrowUp}');
		expect(segment('hour')).toHaveValue('01');

		await user.keyboard('{ArrowDown}');
		expect(segment('hour')).toHaveValue('12');
	});

	it('wraps the minute from 59 to 00 and back', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ defaultValue: '10:59', onValueChange });

		await user.click(segment('minute'));
		await user.keyboard('{ArrowUp}');
		expect(onValueChange).toHaveBeenLastCalledWith('10:00');

		await user.keyboard('{ArrowDown}');
		expect(onValueChange).toHaveBeenLastCalledWith('10:59');
	});

	it('wraps the second from 59 to 00 and back', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ defaultValue: '10:30:59', showSeconds: true, withSeconds: true, onValueChange });

		await user.click(segment('second'));
		await user.keyboard('{ArrowUp}');
		expect(onValueChange).toHaveBeenLastCalledWith('10:30:00');

		await user.keyboard('{ArrowDown}');
		expect(onValueChange).toHaveBeenLastCalledWith('10:30:59');
	});

	it('leaves the stepped segment fully selected', async () => {
		const user = userEvent.setup();
		renderPicker({ defaultValue: '23:59' });

		await user.click(segment('hour'));
		await user.keyboard('{ArrowUp}');

		expect(segment('hour')).toHaveFocus();
		expect(selection(segment('hour'))).toEqual([0, 2]);
	});

	it('seeds an empty 24-hour hour from the ArrowUp default', async () => {
		const user = userEvent.setup();
		renderPicker();

		await user.click(segment('hour'));
		await user.keyboard('{ArrowUp}');

		expect(segment('hour')).toHaveValue('00');
	});

	it('seeds an empty 24-hour hour from the ArrowDown default', async () => {
		const user = userEvent.setup();
		renderPicker();

		await user.click(segment('hour'));
		await user.keyboard('{ArrowDown}');

		expect(segment('hour')).toHaveValue('23');
	});

	it('seeds an empty minute from the ArrowDown default', async () => {
		const user = userEvent.setup();
		renderPicker();

		await user.click(segment('minute'));
		await user.keyboard('{ArrowDown}');

		expect(segment('minute')).toHaveValue('59');
	});
});

describe('TimePicker — the period segment (T007, V-13)', () => {
	it.each([
		['a', 'AM', '09:30'],
		['p', 'PM', '21:30'],
		['1', 'AM', '09:30'],
		['2', 'PM', '21:30']
	] as const)('maps %s to %s', async (key, expectedText, expectedValue) => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ locale: US, defaultValue: '09:30', onValueChange });

		await user.click(segment('period'));
		await user.keyboard(key);

		expect(segment('period')).toHaveValue(expectedText);
		if (expectedValue !== '09:30') expect(onValueChange).toHaveBeenLastCalledWith(expectedValue);
	});

	it('toggles between exactly two states with the arrows', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: US, defaultValue: '09:30' });

		await user.click(segment('period'));
		expect(segment('period')).toHaveValue('AM');

		await user.keyboard('{ArrowUp}');
		expect(segment('period')).toHaveValue('PM');

		await user.keyboard('{ArrowDown}');
		expect(segment('period')).toHaveValue('AM');

		await user.keyboard('{ArrowUp}{ArrowUp}');
		expect(segment('period')).toHaveValue('AM');
	});

	it('re-selects the period after a change', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: US, defaultValue: '09:30' });

		await user.click(segment('period'));
		await user.keyboard('p');

		expect(selection(segment('period'))).toEqual([0, 2]);
	});

	it('moves the stored hour across noon without touching the minute', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ locale: US, defaultValue: '00:15', onValueChange });

		await user.click(segment('period'));
		await user.keyboard('p');

		expect(onValueChange).toHaveBeenLastCalledWith('12:15');
	});
});

describe('TimePicker — clearing a segment (T007, V-14)', () => {
	it.each(['{Backspace}', '{Delete}'] as const)(
		'%s clears the fully selected hour',
		async (key) => {
			const onValueChange = vi.fn();
			const user = userEvent.setup();
			renderPicker({ defaultValue: '10:30', onValueChange });

			await user.click(segment('hour'));
			await user.keyboard(key);

			expect(onValueChange).toHaveBeenLastCalledWith('--:30');
			expect(segment('hour')).toHaveValue('--');
			expect(segment('minute')).toHaveValue('30');
		}
	);

	it('collapses to the empty string once nothing is left', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ defaultValue: '10:--', onValueChange });

		await user.click(segment('hour'));
		await user.keyboard('{Backspace}');

		expect(onValueChange).toHaveBeenLastCalledWith('');
	});

	it('re-selects the cleared segment', async () => {
		const user = userEvent.setup();
		renderPicker({ defaultValue: '10:30' });

		await user.click(segment('hour'));
		await user.keyboard('{Backspace}');

		expect(selection(segment('hour'))).toEqual([0, 2]);
	});

	it('does nothing when the segment is not fully selected', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ defaultValue: '10:30', onValueChange });

		const hour = segment('hour');
		hour.focus();
		// Focus selects the whole segment one tick later, so the caret is collapsed after that.
		await tick();
		await tick();
		hour.setSelectionRange(1, 1);
		await user.keyboard('{Backspace}');

		expect(onValueChange).not.toHaveBeenCalledWith('--:30');
	});
});

describe('TimePicker — commit and cancel (T007, V-15)', () => {
	it('Enter commits the in-progress edit and keeps the segment focused and selected', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ defaultValue: '10:30', onValueChange });

		await user.click(segment('minute'));
		await user.keyboard('4');
		await user.keyboard('{Enter}');

		expect(onValueChange).toHaveBeenLastCalledWith('10:04');
		expect(segment('minute')).toHaveFocus();
		expect(selection(segment('minute'))).toEqual([0, 2]);
	});

	it('Escape discards the in-progress edit, restores the committed text and blurs', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ defaultValue: '10:30', onValueChange });

		await user.click(segment('minute'));
		await user.keyboard('4');
		await user.keyboard('{Escape}');
		await tick();

		expect(segment('minute')).toHaveValue('30');
		expect(segment('minute')).not.toHaveFocus();
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('Tab commits the in-progress edit before moving on', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ defaultValue: '10:30', onValueChange });

		await user.click(segment('minute'));
		await user.keyboard('4');
		await user.tab();

		expect(onValueChange).toHaveBeenLastCalledWith('10:04');
	});

	it('Shift+Tab commits the in-progress edit too', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ defaultValue: '10:30', onValueChange });

		await user.click(segment('minute'));
		await user.keyboard('4');
		await user.tab({ shift: true });

		expect(onValueChange).toHaveBeenLastCalledWith('10:04');
	});
});

describe('TimePicker — segment navigation (T007, V-17/V-19)', () => {
	it('walks forwards and backwards in LTR', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: US });

		await user.click(segment('hour'));
		await user.keyboard('{ArrowRight}');
		expect(segment('minute')).toHaveFocus();

		await user.keyboard('{ArrowRight}');
		expect(segment('period')).toHaveFocus();

		await user.keyboard('{ArrowLeft}');
		expect(segment('minute')).toHaveFocus();
	});

	it('arrives fully selected', async () => {
		const user = userEvent.setup();
		renderPicker({ defaultValue: '10:30' });

		await user.click(segment('hour'));
		await user.keyboard('{ArrowRight}');

		expect(selection(segment('minute'))).toEqual([0, 2]);
	});

	it('is bounded at both ends', async () => {
		const user = userEvent.setup();
		renderPicker({ withPeriod: false });

		await user.click(segment('hour'));
		await user.keyboard('{ArrowLeft}');
		expect(segment('hour')).toHaveFocus();

		await user.click(segment('minute'));
		await user.keyboard('{ArrowRight}');
		expect(segment('minute')).toHaveFocus();
	});

	it('skips a disabled segment', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: US, disableMinute: true });

		await user.click(segment('hour'));
		await user.keyboard('{ArrowRight}');

		expect(segment('period')).toHaveFocus();
	});

	it('does not intercept Home or End', async () => {
		const user = userEvent.setup();
		renderPicker();

		await user.click(segment('minute'));
		await user.keyboard('{Home}');
		expect(segment('minute')).toHaveFocus();

		await user.keyboard('{End}');
		expect(segment('minute')).toHaveFocus();
	});

	it('keeps Tab on the native order', async () => {
		const user = userEvent.setup();
		renderPicker({ withPeriod: false, withOuterInputs: true });

		screen.getByTestId('before').focus();
		await user.tab();
		expect(segment('hour')).toHaveFocus();

		await user.tab();
		expect(segment('minute')).toHaveFocus();

		await user.tab({ shift: true });
		expect(segment('hour')).toHaveFocus();
	});
});

describe('TimePicker — the dropdown (T007, V-21…V-24)', () => {
	it('opens from the trigger and focuses the hour column selection', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: US, defaultValue: '14:30' });

		await openPanel(user);

		const selected = columnItems('hour-column').find((item) => item.hasAttribute('data-selected'));
		expect(selected).toBeDefined();
		expect(selected).toHaveTextContent('2');
		await waitFor(() => expect(selected).toHaveFocus());
	});

	it('falls back to the first item when nothing is selected in that column', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(FROZEN);
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		renderPicker({ locale: GB, hourStep: 6 });

		await openPanel(user);

		// 09:41 is not on a six-hour grid, so no hour item is selected and focus lands on the first.
		const items = columnItems('hour-column');
		expect(items.some((item) => item.hasAttribute('data-selected'))).toBe(false);
		await waitFor(() => expect(items[0]).toHaveFocus());
		vi.useRealTimers();
	});

	// T039 / SC-003 — the pre-highlight has to reach every relevant column, not just the hour one.
	it('pre-highlights the current value in every column', async () => {
		const user = userEvent.setup();
		renderPicker({
			locale: US,
			defaultValue: '14:30:45',
			showSeconds: true,
			withSeconds: true
		});

		await openPanel(user);

		for (const [testId, text] of [
			['hour-column', '2'],
			['minute-column', '30'],
			['second-column', '45'],
			['period-column', 'PM']
		] as const) {
			const selected = columnItems(testId).filter((item) => item.hasAttribute('data-selected'));
			expect(selected, testId).toHaveLength(1);
			expect(selected[0], testId).toHaveAttribute('data-selected', '');
			expect(selected[0].textContent?.trim(), testId).toBe(text);
		}
	});

	it('pre-highlights the current clock in every column when the value is empty', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(FROZEN);
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		renderPicker({ locale: US, showSeconds: true, withSeconds: true });

		await openPanel(user);

		// 09:41:07 — an unset picker still opens on "now" rather than on nothing.
		for (const [testId, text] of [
			['hour-column', '9'],
			['minute-column', '41'],
			['second-column', '07'],
			['period-column', 'AM']
		] as const) {
			const selected = columnItems(testId).filter((item) => item.hasAttribute('data-selected'));
			expect(selected, testId).toHaveLength(1);
			expect(selected[0].textContent?.trim(), testId).toBe(text);
		}

		expect(segment('hour')).toHaveValue('--');
		vi.useRealTimers();
	});

	it('wraps ArrowUp/ArrowDown within a column and commits as it moves', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ locale: GB, defaultValue: '00:30', onValueChange });

		await openPanel(user);

		const hours = columnItems('hour-column');
		hours[0].focus();
		await user.keyboard('{ArrowUp}');

		expect(hours[hours.length - 1]).toHaveFocus();
		expect(onValueChange).toHaveBeenLastCalledWith('23:30');

		await user.keyboard('{ArrowDown}');
		expect(hours[0]).toHaveFocus();
		expect(onValueChange).toHaveBeenLastCalledWith('00:30');
	});

	it('wraps across columns with the horizontal arrows', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: GB, defaultValue: '10:30' });

		await openPanel(user);

		columnItems('hour-column')[0].focus();
		await user.keyboard('{ArrowRight}');
		expect(document.activeElement?.closest('[data-slot="time-picker-minute"]')).not.toBeNull();

		await user.keyboard('{ArrowRight}');
		expect(document.activeElement?.closest('[data-slot="time-picker-hour"]')).not.toBeNull();

		await user.keyboard('{ArrowLeft}');
		expect(document.activeElement?.closest('[data-slot="time-picker-minute"]')).not.toBeNull();
	});

	it('wraps across columns with Tab and Shift+Tab', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: GB, defaultValue: '10:30' });

		await openPanel(user);

		columnItems('hour-column')[0].focus();
		await user.keyboard('{Tab}');
		expect(document.activeElement?.closest('[data-slot="time-picker-minute"]')).not.toBeNull();

		await user.keyboard('{Shift>}{Tab}{/Shift}');
		expect(document.activeElement?.closest('[data-slot="time-picker-hour"]')).not.toBeNull();
	});

	it('lands on the target column selection rather than its first item', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: GB, defaultValue: '10:30' });

		await openPanel(user);

		columnItems('hour-column')[0].focus();
		await user.keyboard('{ArrowRight}');

		expect(document.activeElement).toHaveTextContent('30');
	});

	it('commits a clicked item and leaves the panel open', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ locale: GB, defaultValue: '10:30', onValueChange });

		await openPanel(user);

		const target = columnItems('minute-column')[45];
		await user.click(target);

		expect(onValueChange).toHaveBeenLastCalledWith('10:45');
		expect(target).toHaveAttribute('data-selected', '');
		expect(querySlot('time-picker-content')).not.toBeNull();
	});

	it('commits an item activated with Enter and leaves the panel open', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ locale: GB, defaultValue: '10:30', onValueChange });

		await openPanel(user);

		columnItems('minute-column')[15].focus();
		await user.keyboard('{Enter}');

		expect(onValueChange).toHaveBeenLastCalledWith('10:15');
		expect(querySlot('time-picker-content')).not.toBeNull();
	});

	it('commits an item activated with Space and leaves the panel open', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ locale: GB, defaultValue: '10:30', onValueChange });

		await openPanel(user);

		columnItems('minute-column')[20].focus();
		await user.keyboard(' ');

		expect(onValueChange).toHaveBeenLastCalledWith('10:20');
		expect(querySlot('time-picker-content')).not.toBeNull();
	});

	it.each(['{Enter}', ' '] as const)('opens from the trigger with %s', async (key) => {
		const onOpenChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ onOpenChange });

		screen.getByTestId('trigger').focus();
		await user.keyboard(key);

		await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(true));
	});

	it('toggles closed again from the trigger', async () => {
		const onOpenChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ locale: GB, defaultValue: '10:30', onOpenChange });

		await openPanel(user);
		await user.click(screen.getByTestId('trigger'));

		await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false));
		await waitFor(() => expect(querySlot('time-picker-content')).toBeNull());
	});

	it('closes on Escape without changing the value', async () => {
		const onValueChange = vi.fn();
		const onOpenChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ locale: GB, defaultValue: '10:30', onValueChange, onOpenChange });

		await openPanel(user);
		await user.keyboard('{Escape}');

		await waitFor(() => expect(querySlot('time-picker-content')).toBeNull());
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
		expect(onValueChange).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// T007a — conditional column rendering (V-25)
// ---------------------------------------------------------------------------

describe('TimePicker — conditional columns (T007a, V-25)', () => {
	it('renders no period column or segment content under a 24-hour locale', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: GB });
		await openPanel(user);

		expect(screen.queryByTestId('period-column')).toBeNull();
		expect(querySlot('time-picker-period')).toBeNull();
		expect(itemLabels('hour-column')).toHaveLength(24);
	});

	it('renders exactly AM and PM under a 12-hour locale', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: US });
		await openPanel(user);

		expect(itemLabels('period-column')).toEqual(['AM', 'PM']);
		expect(itemLabels('hour-column')).toEqual([
			'12',
			'1',
			'2',
			'3',
			'4',
			'5',
			'6',
			'7',
			'8',
			'9',
			'10',
			'11'
		]);
	});

	it('honours minuteStep and secondStep', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: GB, minuteStep: 15, secondStep: 10, withSeconds: true });
		await openPanel(user);

		expect(itemLabels('minute-column')).toEqual(['00', '15', '30', '45']);
		expect(itemLabels('second-column')).toHaveLength(6);
	});

	it('renders the second column only when the caller composes it', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: GB, withSeconds: false });
		await openPanel(user);

		expect(querySlot('time-picker-second')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// T008 — controlled versus uncontrolled (V-26…V-28)
// ---------------------------------------------------------------------------

describe('TimePicker — uncontrolled (T008, V-26)', () => {
	it('seeds the segments from defaultValue and moves on its own', async () => {
		const user = userEvent.setup();
		renderPicker({ defaultValue: '14:30' });

		expect(segment('hour')).toHaveValue('14');
		expect(segment('minute')).toHaveValue('30');

		await user.click(segment('hour'));
		await user.keyboard('{ArrowUp}');

		expect(segment('hour')).toHaveValue('15');
	});

	it('seeds the open state from defaultOpen', async () => {
		renderPicker({ defaultOpen: true });
		await waitFor(() => expect(querySlot('time-picker-content')).not.toBeNull());
		expect(querySlot('time-picker-content')).not.toBeNull();
	});
});

describe('TimePicker — controlled (T008, V-27)', () => {
	it('takes a supplied value and reports every change through onValueChange', async () => {
		const onValueChange = vi.fn();
		const onValueBinding = vi.fn();
		const user = userEvent.setup();
		renderPicker({ binding: 'value', value: '14:30', onValueChange, onValueBinding });

		expect(segment('hour')).toHaveValue('14');

		await user.click(segment('hour'));
		await user.keyboard('{ArrowUp}');
		await tick();

		expect(onValueChange).toHaveBeenLastCalledWith('15:30');
		expect(onValueBinding).toHaveBeenLastCalledWith('15:30');
	});

	it('follows a new value pushed in by the parent', async () => {
		const { rerender } = renderPicker({ binding: 'controlled', value: '14:30' });
		expect(segment('hour')).toHaveValue('14');

		await rerender({ binding: 'controlled', value: '09:05', locale: GB });

		expect(segment('hour')).toHaveValue('09');
		expect(segment('minute')).toHaveValue('05');
	});

	it('reports every open change through onOpenChange', async () => {
		const onOpenChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ binding: 'value', open: false, onOpenChange });

		await user.click(screen.getByTestId('trigger'));
		await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(true));

		await user.keyboard('{Escape}');
		await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false));
	});

	it('follows a new open state pushed in by the parent', async () => {
		const { rerender } = renderPicker({ binding: 'controlled', open: false });
		expect(querySlot('time-picker-content')).toBeNull();

		await rerender({ binding: 'controlled', open: true, locale: GB });

		await waitFor(() => expect(querySlot('time-picker-content')).not.toBeNull());
	});
});

describe('TimePicker — bindings (T008, V-28)', () => {
	it('bind:value moves the parent state', async () => {
		const onValueBinding = vi.fn();
		const user = userEvent.setup();
		renderPicker({ binding: 'value', value: '14:30', onValueBinding });

		await user.click(segment('hour'));
		await user.keyboard('{ArrowUp}');
		await tick();

		expect(onValueBinding).toHaveBeenLastCalledWith('15:30');
	});

	it('bind:open moves the parent state', async () => {
		const user = userEvent.setup();
		renderPicker({ binding: 'value', open: false });

		await user.click(screen.getByTestId('trigger'));
		await waitFor(() => expect(querySlot('time-picker-content')).not.toBeNull());
		expect(querySlot('time-picker-content')).not.toBeNull();
	});

	it('a declining function binding leaves the rendered value untouched', async () => {
		const onDeclinedValue = vi.fn();
		const user = userEvent.setup();
		renderPicker({ binding: 'function', authoritativeValue: '14:30', onDeclinedValue });

		await user.click(segment('hour'));
		await user.keyboard('{ArrowUp}');
		await tick();

		expect(onDeclinedValue).toHaveBeenCalledWith('15:30');
		expect(segment('hour')).toHaveValue('14');
	});
});

// ---------------------------------------------------------------------------
// T009 — RTL (V-18, V-23)
// ---------------------------------------------------------------------------

describe('TimePicker — RTL (T009, V-18/V-23)', () => {
	it.each([
		['prop', { dir: 'rtl' as const }],
		['provider', { providerDir: 'rtl' as const }],
		['dom', { domDir: 'rtl' as const }]
	])('inverts the segment arrows via the %s leg of the chain', async (_leg, props) => {
		const user = userEvent.setup();
		renderPicker({ withPeriod: false, ...props });

		await user.click(segment('hour'));
		await user.keyboard('{ArrowLeft}');
		expect(segment('minute')).toHaveFocus();

		await user.keyboard('{ArrowRight}');
		expect(segment('hour')).toHaveFocus();
	});

	it('leaves Tab direction-independent between segments', async () => {
		const user = userEvent.setup();
		renderPicker({ dir: 'rtl', withPeriod: false, withOuterInputs: true });

		segment('hour').focus();
		await user.tab();
		expect(segment('minute')).toHaveFocus();
	});

	it('inverts the cross-column arrows', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: GB, defaultValue: '10:30', dir: 'rtl' });

		await openPanel(user);

		columnItems('hour-column')[0].focus();
		await user.keyboard('{ArrowLeft}');
		expect(document.activeElement?.closest('[data-slot="time-picker-minute"]')).not.toBeNull();

		await user.keyboard('{ArrowRight}');
		expect(document.activeElement?.closest('[data-slot="time-picker-hour"]')).not.toBeNull();
	});

	it('leaves Tab direction-independent between columns', async () => {
		const user = userEvent.setup();
		renderPicker({ locale: GB, defaultValue: '10:30', dir: 'rtl' });

		await openPanel(user);

		columnItems('hour-column')[0].focus();
		await user.keyboard('{Tab}');
		expect(document.activeElement?.closest('[data-slot="time-picker-minute"]')).not.toBeNull();
	});
});

// ---------------------------------------------------------------------------
// T010 — edge cases and guard rails (V-16, V-29…V-32, V-34, V-35)
// ---------------------------------------------------------------------------

describe('TimePicker — partial values and the now backfill (T010, V-16)', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(FROZEN);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('leaves every other segment untouched while only the hour is typed', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		renderPicker({ onValueChange });

		await user.click(segment('hour'));
		await user.keyboard('1');

		expect(onValueChange).not.toHaveBeenCalled();
		expect(segment('minute')).toHaveValue('--');
	});

	it('backfills the unset minute from the frozen clock on blur', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		renderPicker({ onValueChange, withOuterInputs: true });

		await user.click(segment('hour'));
		await user.keyboard('1');
		screen.getByTestId('after').focus();
		await tick();
		await tick();

		expect(onValueChange).toHaveBeenLastCalledWith('01:41');
	});

	it('backfills the second too when showSeconds is on', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		renderPicker({ onValueChange, showSeconds: true, withSeconds: true, withOuterInputs: true });

		await user.click(segment('hour'));
		await user.keyboard('1');
		screen.getByTestId('after').focus();
		await tick();
		await tick();

		expect(onValueChange).toHaveBeenLastCalledWith('01:41:07');
	});

	it('does not backfill while focus stays inside the field', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		renderPicker({ onValueChange, withOuterInputs: true });

		// Auto-advancing out of the hour blurs it, but the caret is still in the field, so the minute
		// must stay at its placeholder and keep accepting digits.
		await user.click(segment('hour'));
		await user.keyboard('1430');

		expect(onValueChange).toHaveBeenLastCalledWith('14:30');
		expect(segment('hour')).toHaveValue('14');
		expect(segment('minute')).toHaveValue('30');
	});

	it('invents nothing when no field was ever set', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		renderPicker({ onValueChange, withOuterInputs: true });

		await user.click(segment('hour'));
		screen.getByTestId('after').focus();
		await tick();
		await tick();

		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('backfills the remaining fields when a column item is activated on an empty value', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		renderPicker({ locale: GB, onValueChange });

		await openPanel(user);
		await user.click(columnItems('minute-column')[15]);

		expect(onValueChange).toHaveBeenLastCalledWith('09:15');
	});
});

describe('TimePicker — showSeconds at runtime (T010, V-34)', () => {
	it('adds the second segment and re-serialises without a remount', async () => {
		const { rerender } = renderPicker({ defaultValue: '10:30', withSeconds: false });
		const group = screen.getByRole('group');

		expect(segment('hour')).toHaveValue('10');
		expect(screen.queryByTestId('second')).toBeNull();

		await rerender({
			locale: GB,
			defaultValue: '10:30',
			withSeconds: true,
			showSeconds: true
		});

		// Same element: the group was re-rendered, not re-created.
		expect(screen.getByRole('group')).toBe(group);
		expect(segment('second')).toHaveValue('--');
	});

	it('never invents a seconds value that was not set', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({
			defaultValue: '10:30',
			withSeconds: true,
			showSeconds: true,
			onValueChange
		});

		await user.click(segment('hour'));
		await user.keyboard('{ArrowUp}');

		expect(onValueChange).toHaveBeenLastCalledWith('11:30:--');
	});
});

describe('TimePicker — guard rails (T010, V-31/V-32)', () => {
	it('disables every control and suppresses editing', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ locale: US, defaultValue: '10:30', disabled: true, onValueChange });

		expect(segment('hour')).toBeDisabled();
		expect(segment('minute')).toBeDisabled();
		expect(segment('period')).toBeDisabled();
		expect(screen.getByTestId('trigger')).toBeDisabled();

		await user.click(segment('hour'));
		await user.keyboard('{ArrowUp}{Backspace}5');

		expect(onValueChange).not.toHaveBeenCalled();
		expect(segment('hour')).toHaveValue('10');
	});

	it('keeps a read-only picker focusable but immutable', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ defaultValue: '10:30', readOnly: true, onValueChange });

		const hour = segment('hour');
		expect(hour).toHaveAttribute('readonly');
		expect(hour).not.toBeDisabled();

		hour.focus();
		expect(hour).toHaveFocus();

		await user.keyboard('{ArrowUp}{Backspace}5');
		expect(onValueChange).not.toHaveBeenCalled();
		expect(hour).toHaveValue('10');
	});

	it('makes Clear a no-op while read-only', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ defaultValue: '10:30', readOnly: true, defaultOpen: true, onValueChange });

		await waitFor(() => expect(screen.queryByTestId('clear')).not.toBeNull());
		await user.click(screen.getByTestId('clear'));

		expect(onValueChange).not.toHaveBeenCalled();
		expect(segment('hour')).toHaveValue('10');
	});

	it('resets the value and every segment otherwise', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ defaultValue: '10:30', defaultOpen: true, onValueChange });

		await waitFor(() => expect(screen.queryByTestId('clear')).not.toBeNull());
		await user.click(screen.getByTestId('clear'));

		expect(onValueChange).toHaveBeenLastCalledWith('');
		expect(segment('hour')).toHaveValue('--');
		expect(segment('minute')).toHaveValue('--');
	});

	it('leaves a read-only column item inert on click and on Enter', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ locale: GB, defaultValue: '10:30', readOnly: true, onValueChange });

		await openPanel(user);

		await user.click(columnItems('minute-column')[45]);
		expect(onValueChange).not.toHaveBeenCalled();

		columnItems('minute-column')[15].focus();
		await user.keyboard('{Enter}');
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it('accepts min and max without enforcing them', async () => {
		const onValueChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ defaultValue: '10:30', min: '11:00', max: '12:00', onValueChange });

		await user.click(segment('hour'));
		await user.keyboard('{ArrowDown}');

		expect(onValueChange).toHaveBeenLastCalledWith('09:30');
	});
});

describe('TimePicker — openOnFocus and the group click policy (T010, V-29/V-30)', () => {
	it('opens on focus and leaves the caret in the segment', async () => {
		const user = userEvent.setup();
		renderPicker({ openOnFocus: true });

		await user.click(segment('hour'));
		await waitFor(() => expect(querySlot('time-picker-content')).not.toBeNull());
		await tick();
		await tick();

		expect(segment('hour')).toHaveFocus();
	});

	it('reports the open change exactly once for a run of focus events', async () => {
		const onOpenChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ openOnFocus: true, onOpenChange });

		await user.click(segment('hour'));
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(true));
		await user.keyboard('{ArrowRight}');
		await user.keyboard('{ArrowLeft}');

		expect(onOpenChange.mock.calls.filter(([open]) => open === true)).toHaveLength(1);
	});

	it('focuses the first segment when empty group space is clicked', async () => {
		const user = userEvent.setup();
		renderPicker();

		await user.click(screen.getByRole('group'));

		expect(segment('hour')).toHaveFocus();
		expect(selection(segment('hour'))).toEqual([0, 2]);
	});

	it('opens the panel instead when inputGroupClickAction is "open"', async () => {
		const onOpenChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ inputGroupClickAction: 'open', onOpenChange });

		await user.click(screen.getByRole('group'));

		expect(onOpenChange).toHaveBeenCalledWith(true);
		expect(segment('hour')).not.toHaveFocus();
	});

	it('does not intercept a click that lands on a segment or the trigger', async () => {
		const onOpenChange = vi.fn();
		const user = userEvent.setup();
		renderPicker({ inputGroupClickAction: 'open', onOpenChange });

		await user.click(segment('minute'));
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(segment('minute')).toHaveFocus();
	});

	it('is suppressed entirely while disabled', async () => {
		const user = userEvent.setup();
		renderPicker({ disabled: true });

		await user.click(screen.getByRole('group'));

		expect(segment('hour')).not.toHaveFocus();
	});
});

describe('TimePicker — provider guards (T010, V-35)', () => {
	it.each([
		['bare-label', /`<TimePicker\.Label>` must be used within `<TimePicker\.Root>`/],
		['ungrouped-input', /`<TimePicker\.Input>` must be used within `<TimePicker\.InputGroup>`/],
		['bare-column', /`<TimePicker\.Column>` must be used within `<TimePicker\.Content>`/],
		['uncolumned-item', /`<TimePicker\.ColumnItem>` must be used within `<TimePicker\.Column>`/]
	] as const)('%s throws its documented error', (mode, message) => {
		expect(() => render(Harness, { props: { mode } })).toThrow(message);
	});
});

// ---------------------------------------------------------------------------
// T011 — form participation and the child snippet (V-33, V-36)
// ---------------------------------------------------------------------------

describe('TimePicker — form participation (T011, V-33)', () => {
	it('renders a hidden input inside a form and mirrors the state', async () => {
		renderPicker({
			withForm: true,
			name: 'appointmentTime',
			defaultValue: '09:00',
			required: true,
			readOnly: true
		});
		await tick();

		const hidden = bySlot('time-picker-form-input');
		expect(hidden).toHaveAttribute('type', 'hidden');
		expect(hidden).toHaveAttribute('name', 'appointmentTime');
		expect(hidden).toHaveValue('09:00');
		expect(hidden).toHaveAttribute('required', '');
		expect(hidden).toHaveAttribute('readonly');
	});

	it('mirrors disabled onto the hidden input', async () => {
		renderPicker({ withForm: true, name: 'appointmentTime', disabled: true });
		await tick();

		expect(bySlot('time-picker-form-input')).toBeDisabled();
	});

	it('renders no hidden input outside a form', async () => {
		renderPicker({ name: 'appointmentTime' });
		await tick();

		expect(querySlot('time-picker-form-input')).toBeNull();
	});

	it('dispatches a bubbling native input event when the value moves', async () => {
		const user = userEvent.setup();
		renderPicker({ withForm: true, name: 'appointmentTime', defaultValue: '10:30' });
		await tick();

		const events: string[] = [];
		screen
			.getByTestId('form')
			.addEventListener('input', (event) => events.push((event.target as HTMLInputElement).value));

		await user.click(segment('hour'));
		await user.keyboard('{ArrowUp}');
		await tick();

		expect(events).toContain('11:30');
	});

	it('submits the current value under its name', async () => {
		const onSubmitValue = vi.fn();
		const user = userEvent.setup();
		renderPicker({
			withForm: true,
			name: 'appointmentTime',
			defaultValue: '09:00',
			onSubmitValue
		});
		await tick();

		await user.click(screen.getByTestId('submit'));

		expect(onSubmitValue).toHaveBeenCalledWith('09:00');
	});
});

describe('TimePicker — the child snippet (T011, V-36)', () => {
	it('keeps form detection working on a child-rendered root', async () => {
		renderPicker({ mode: 'root-child', withForm: true, name: 'appointmentTime' });
		await tick();

		expect(document.querySelector('[data-child-slot="root"]')).not.toBeNull();
		expect(querySlot('time-picker-form-input')).not.toBeNull();
	});

	it('drops the hidden input for a child-rendered root outside a form', async () => {
		renderPicker({ mode: 'root-child', name: 'appointmentTime' });
		await tick();

		expect(querySlot('time-picker-form-input')).toBeNull();
	});

	it('keeps a child-rendered input group as the popover anchor and click boundary', async () => {
		const user = userEvent.setup();
		renderPicker({ mode: 'group-child', locale: GB });

		const group = document.querySelector('[data-child-slot="group"]');
		expect(group).not.toBeNull();

		await user.click(group as HTMLElement);
		expect(segment('hour')).toHaveFocus();
	});

	it('keeps a child-rendered column item in its registry and in arrow navigation', async () => {
		const user = userEvent.setup();
		renderPicker({ mode: 'column-item-child', locale: GB });

		await openPanel(user);

		const items = Array.from(
			document.querySelectorAll<HTMLButtonElement>('[data-child-slot="column-item"]')
		);
		expect(items).toHaveLength(3);

		items[0].focus();
		await user.keyboard('{ArrowDown}');
		expect(items[1]).toHaveFocus();

		await user.keyboard('{ArrowUp}{ArrowUp}');
		expect(items[2]).toHaveFocus();
	});
});
