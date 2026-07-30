/**
 * The Time Picker's pure value logic: parsing, formatting, 12↔24 conversion, wrap-around stepping,
 * locale format detection and column value generation.
 *
 * Rune-free, Svelte-free and DOM-free by design, so it is SSR-safe, directly unit-testable and
 * reusable — a Date Picker, a Duration Input or a Calendar time field would otherwise re-derive all
 * of it. The same reasoning that made `mask-input` export `mask-engine.ts` and `phone-input` export
 * `phone-engine.ts` (research R-02, contracts/time-engine.md §A).
 *
 * Every function is **total**: it never throws, and every documented input maps to a documented
 * output.
 */

/**
 * Every editable segment, in **auto-advance order** — the declaration order is significant, because
 * digit entry walks it to find the next segment (radix/ui/time-picker.tsx:612).
 */
export const SEGMENTS = ['hour', 'minute', 'second', 'period'] as const;

/** The two periods of a 12-hour clock, in upstream declaration order. */
export const PERIODS = ['AM', 'PM'] as const;

/** What an unset segment displays, and what `formatTimeValue` writes for a missing field. */
export const DEFAULT_SEGMENT_PLACEHOLDER = '--';

/** `'hour' | 'minute' | 'second' | 'period'`. */
export type Segment = (typeof SEGMENTS)[number];

/** `'AM' | 'PM'`. */
export type Period = (typeof PERIODS)[number];

/**
 * How a dropdown column renders its items: `'2-digit'` zero-pads a numeric value, `'numeric'` prints
 * it bare. Non-numeric values (the periods) always print bare.
 */
export type SegmentFormat = 'numeric' | '2-digit';

/**
 * The **partial**, in-flight time. Every field is independently optional, which is what makes a
 * half-entered `"10:--"` expressible.
 *
 * `hour` is **always** 24-hour, whatever the display format; `period` is its display-only companion
 * and is never serialised.
 */
export type TimeValue = {
	hour?: number;
	minute?: number;
	second?: number;
	period?: Period;
};

/** A single placeholder for every segment, or one per segment. */
export type SegmentPlaceholder =
	| string
	| {
			hour?: string;
			minute?: string;
			second?: string;
			period?: string;
	  };

/** {@link SegmentPlaceholder} widened so every segment has a string. */
export type ResolvedSegmentPlaceholder = Record<Segment, string>;

/**
 * Whether `locale` displays a 12-hour clock, decided by asking `Intl` to format 13:00
 * (radix/ui/time-picker.tsx:111-118) — never by consulting a hard-coded locale table.
 *
 * The second clause catches locales that render a 12-hour clock without a Latin `AM`/`PM` marker
 * (`ja-JP` renders `午後1時`). An invalid locale tag makes `Intl.DateTimeFormat` throw, which is
 * caught here and answered with the runtime default so the function stays total.
 */
export function getIs12Hour(locale?: string): boolean {
	const testDate = new Date(2000, 0, 1, 13, 0, 0);

	let formatted: string;
	try {
		formatted = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).format(testDate);
	} catch {
		formatted = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(testDate);
	}

	return /am|pm/i.test(formatted) || !formatted.includes('13');
}

/** One `:`-separated part, or `undefined` when it is absent, the placeholder, or out of range. */
function parsePart(part: string | undefined, max: number): number | undefined {
	if (!part || part === DEFAULT_SEGMENT_PLACEHOLDER) return undefined;
	const parsed = Number.parseInt(part, 10);
	if (Number.isNaN(parsed) || parsed < 0 || parsed > max) return undefined;
	return parsed;
}

/**
 * The inverse of {@link formatTimeValue}, and total (radix/ui/time-picker.tsx:120-157).
 *
 * Returns `null` for an empty string, for a string with fewer than two `:`-separated parts, and for
 * one whose every part is absent or out of range. An individual `"--"` or out-of-range part is
 * dropped rather than failing the whole parse, which is what keeps `"10:--"` a usable value.
 */
export function parseTimeString(timeString: string | undefined): TimeValue | null {
	if (!timeString) return null;

	const parts = timeString.split(':');
	if (parts.length < 2) return null;

	const result: TimeValue = {};

	const hour = parsePart(parts[0], 23);
	if (hour !== undefined) result.hour = hour;

	const minute = parsePart(parts[1], 59);
	if (minute !== undefined) result.minute = minute;

	const second = parsePart(parts[2], 59);
	if (second !== undefined) result.second = second;

	if (result.hour === undefined && result.minute === undefined && result.second === undefined) {
		return null;
	}

	return result;
}

function pad(value: number): string {
	return value.toString().padStart(2, '0');
}

/**
 * Serialise to the canonical 24-hour string — `"HH:mm"`, or `"HH:mm:ss"` when `showSeconds`.
 *
 * Each unset field renders `"--"`, and `period` is never serialised: the stored `hour` already
 * carries it.
 */
export function formatTimeValue(value: TimeValue, showSeconds: boolean): string {
	const hour = value.hour !== undefined ? pad(value.hour) : DEFAULT_SEGMENT_PLACEHOLDER;
	const minute = value.minute !== undefined ? pad(value.minute) : DEFAULT_SEGMENT_PLACEHOLDER;

	if (!showSeconds) return `${hour}:${minute}`;

	const second = value.second !== undefined ? pad(value.second) : DEFAULT_SEGMENT_PLACEHOLDER;
	return `${hour}:${minute}:${second}`;
}

/**
 * The ambient clock, as the three fields the backfill and the column pre-highlighting need.
 *
 * The one deliberately impure function in this module, and the only place the component reads the
 * clock — upstream calls `new Date()` in nine separate handlers. Keeping it here means the reads stay
 * out of the runes modules (`svelte/prefer-svelte-reactivity` rightly rejects a mutable `Date` in a
 * `.svelte.ts` file) and that a test can pin every one of them with a single `vi.setSystemTime`.
 */
export function currentTime(): { hour: number; minute: number; second: number } {
	const now = new Date();
	return { hour: now.getHours(), minute: now.getMinutes(), second: now.getSeconds() };
}

/** Split a 24-hour hour into what a 12-hour clock displays plus its period. */
export function to12Hour(hour24: number): { hour: number; period: Period } {
	return { hour: hour24 % 12 || 12, period: hour24 >= 12 ? 'PM' : 'AM' };
}

/** The inverse of {@link to12Hour}: `12` is the special case that maps to `00` in the morning. */
export function to24Hour(hour12: number, period: Period): number {
	if (hour12 === 12) return period === 'PM' ? 12 : 0;
	return period === 'PM' ? hour12 + 12 : hour12;
}

/** `Math.min(Math.max(value, min), max)`. */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * Widen a caller's `segmentPlaceholder` to one string per segment
 * (radix/ui/time-picker.tsx:422-437). A bare string fills all four; an object fills only the keys it
 * names and leaves the rest at `"--"`; `undefined` yields all `"--"`.
 */
export function normalizeSegmentPlaceholder(
	input: SegmentPlaceholder | undefined
): ResolvedSegmentPlaceholder {
	if (input === undefined) {
		return {
			hour: DEFAULT_SEGMENT_PLACEHOLDER,
			minute: DEFAULT_SEGMENT_PLACEHOLDER,
			second: DEFAULT_SEGMENT_PLACEHOLDER,
			period: DEFAULT_SEGMENT_PLACEHOLDER
		};
	}

	if (typeof input === 'string') {
		return { hour: input, minute: input, second: input, period: input };
	}

	return {
		hour: input.hour ?? DEFAULT_SEGMENT_PLACEHOLDER,
		minute: input.minute ?? DEFAULT_SEGMENT_PLACEHOLDER,
		second: input.second ?? DEFAULT_SEGMENT_PLACEHOLDER,
		period: input.period ?? DEFAULT_SEGMENT_PLACEHOLDER
	};
}

/**
 * One `ArrowUp` / `ArrowDown` step, **with wrap-around at every boundary**
 * (radix/ui/time-picker.tsx:1303-1385):
 *
 * | Segment | Format | up at max | down at min | empty + up | empty + down |
 * | ------- | ------ | --------- | ----------- | ---------- | ------------ |
 * | hour    | 24h    | `23 → 0`  | `0 → 23`    | `0`        | `23`         |
 * | hour    | 12h    | `12 → 1`  | `1 → 12`    | `12`       | `12`         |
 * | minute  | —      | `59 → 0`  | `0 → 59`    | `0`        | `59`         |
 * | second  | —      | `59 → 0`  | `0 → 59`    | `0`        | `59`         |
 *
 * `current` is the **displayed** number, so a 12-hour hour steps through `1…12` rather than `0…23`.
 * The `period` segment is never stepped here — it toggles through {@link togglePeriod} — so it is
 * answered with `current ?? 0` to keep the function total.
 */
export function stepSegment(
	segment: Segment,
	current: number | null,
	delta: 1 | -1,
	is12Hour: boolean
): number {
	if (segment === 'period') return current ?? 0;

	if (current === null) {
		if (segment === 'hour') {
			if (is12Hour) return 12;
			return delta === 1 ? 0 : 23;
		}
		return delta === 1 ? 0 : 59;
	}

	if (segment === 'hour') {
		if (is12Hour) {
			if (delta === 1) return current === 12 ? 1 : current + 1;
			return current === 1 ? 12 : current - 1;
		}
		if (delta === 1) return current === 23 ? 0 : current + 1;
		return current === 0 ? 23 : current - 1;
	}

	if (delta === 1) return current === 59 ? 0 : current + 1;
	return current === 0 ? 59 : current - 1;
}

/**
 * The period segment's strict two-state toggle (radix/ui/time-picker.tsx:1245-1248). An unset period
 * counts as `AM`, so the first press always lands on `PM`; there is no third state.
 */
export function togglePeriod(current: Period | null): Period {
	return current === 'PM' ? 'AM' : 'PM';
}

/**
 * The hour column's values (radix/ui/time-picker.tsx:1865-1876). 12-hour clocks list
 * `12, 1, 2, …` — a rotation of `1…12` — and 24-hour clocks list `0, step, 2·step, …`.
 * A non-positive step yields `[]` rather than looping forever.
 */
export function buildHourValues(is12Hour: boolean, hourStep: number): number[] {
	if (!Number.isFinite(hourStep) || hourStep <= 0) return [];

	const limit = is12Hour ? 12 : 24;
	return Array.from({ length: Math.ceil(limit / hourStep) }, (_, index) => {
		const value = index * hourStep;
		if (!is12Hour) return value;
		return value % 12 || 12;
	});
}

/**
 * The minute and second columns' values: `⌈limit / step⌉` entries of `i · step`. A non-positive step
 * yields `[]`.
 */
export function buildStepValues(limit: number, step: number): number[] {
	if (!Number.isFinite(step) || step <= 0) return [];
	return Array.from({ length: Math.ceil(limit / step) }, (_, index) => index * step);
}

/** A column item's rendered text: `'2-digit'` zero-pads a number, everything else prints bare. */
export function formatColumnValue(value: number | string, format: SegmentFormat): string {
	if (format === '2-digit' && typeof value === 'number') return pad(value);
	return String(value);
}

/**
 * The largest first digit that can still be followed by a second one
 * (radix/ui/time-picker.tsx:1049). Typing anything greater commits the segment and advances
 * immediately, which is what makes a bare `9` mean `09` in a 24-hour hour.
 *
 * `period` returns `-1`: it never auto-advances by digit, it takes the `A`/`P`/`1`/`2` shortcuts.
 */
export function maxFirstDigit(segment: Segment, is12Hour: boolean): number {
	if (segment === 'hour') return is12Hour ? 1 : 2;
	if (segment === 'period') return -1;
	return 5;
}
