import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createRawSnippet, tick } from 'svelte';
import { vi } from 'vitest';

import * as RelativeTimeCard from './index.js';
import Harness from './relative-time-card.test.svelte';
import {
	RELATIVE_TIME_CARD_VARIANTS,
	relativeTimeCardTriggerVariants,
	resolveRelativeTimeCardVariant,
	type RelativeTimeCardVariant,
	DEFAULT_CLOSE_DELAY,
	DEFAULT_OPEN_DELAY,
	DEFAULT_TIMEZONES,
	DEFAULT_UPDATE_INTERVAL,
	diffRelativeTime,
	formatAbsoluteDateTime,
	formatRelativeTime,
	formatTimeZoneAccessibleName,
	formatZonedDate,
	formatZonedTime,
	isValidDate,
	resolveLocale,
	toDate,
	toIsoString
} from './index.js';

/** Every assertion that pins a string uses this locale explicitly, so CI's own locale cannot leak. */
const LOCALE = 'en-US';

/** The clock every test runs against. `data-model.md` §5's worked examples are relative to it. */
const NOW = new Date('2026-07-30T10:00:00Z');

/** Five minutes before {@link NOW} — the default fixture for component-level tests. */
const FIVE_MINUTES_AGO = new Date('2026-07-30T09:55:00Z');

/** Children as a snippet — the pattern every ported component's tests use. */
const text = (value: string) => createRawSnippet(() => ({ render: () => `<span>${value}</span>` }));

/**
 * The card is portalled to `document.body`, so every lookup goes through the document rather than
 * the render container (research R-14).
 */
function bySlot(slot: string): HTMLElement {
	const element = document.body.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function queryBySlot(slot: string): HTMLElement | null {
	return document.body.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
}

/**
 * Under fake timers `userEvent` must be told how to advance them, or `openDelay` never elapses and
 * every hover assertion hangs (research R-14).
 */
function setupUser() {
	return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

/** Move the pinned clock forward and let Svelte flush the resulting state change. */
async function advance(ms: number): Promise<void> {
	vi.advanceTimersByTime(ms);
	await tick();
}

/**
 * The card's `data-state`, or `null` while it has never been mounted.
 *
 * The hover card's presence manager keeps a closed card in the DOM for its exit transition, so
 * `data-state` — the attribute the upstream MDX documents — is what open/closed is asserted on
 * once the card has been opened at least once.
 */
function cardState(): string | null {
	return queryBySlot('relative-time-card-content')?.getAttribute('data-state') ?? null;
}

/**
 * jsdom reports a zero-sized rect for every element, which makes the hover card's safe polygon
 * read a pointer at the origin as *still on the trigger* and cancel the close. Giving the layout a
 * plausible size is what lets a real `user.unhover` express "the pointer left".
 */
function stubLayout(): void {
	vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
		new DOMRect(200, 200, 100, 20)
	);
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

/** The single-unit frame `formatRelativeTime` starts from for a past minutes difference. */
function minutesFrame(locale: string, minutes: number): string {
	return new Intl.RelativeTimeFormat(locale, { numeric: 'always', style: 'long' }).format(
		-minutes,
		'minute'
	);
}

/** The plain unit phrase the frame is searched for, and spliced on when it is found. */
function unitPhrase(locale: string, unit: 'minute' | 'second', value: number): string {
	return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' }).format(value);
}

/**
 * Locales whose CLDR minutes frame declines the noun (Icelandic `"fyrir 5 mínútum"` against the
 * plain `"5 mínútur"`), so `formatMinutesWithResidual`'s `frame.includes(magnitude)` guard misses
 * and the single-unit frame must be returned untouched.
 */
const GUARD_LOCALE_CANDIDATES = ['is', 'lt', 'lv', 'et'] as const;

/** The first candidate the *installed* ICU build actually reproduces the miss for, if any. */
const guardLocale = GUARD_LOCALE_CANDIDATES.find(
	(locale) => !minutesFrame(locale, 5).includes(unitPhrase(locale, 'minute', 5))
);

/** Occurrences of `needle` in `haystack` — used to catch a duplicated or orphaned magnitude. */
function occurrences(haystack: string, needle: string): number {
	return haystack.split(needle).length - 1;
}

describe('date helpers', () => {
	it('passes a caller-owned Date through by identity', () => {
		const owned = new Date(FIVE_MINUTES_AGO);

		expect(toDate(owned)).toBe(owned);
	});

	it('parses a string and a numeric timestamp to the same instant', () => {
		expect(toDate(FIVE_MINUTES_AGO.toISOString()).getTime()).toBe(FIVE_MINUTES_AGO.getTime());
		expect(toDate(FIVE_MINUTES_AGO.getTime()).getTime()).toBe(FIVE_MINUTES_AGO.getTime());
	});

	it('reports an unparseable input as an invalid date rather than throwing', () => {
		expect(() => toDate('nope')).not.toThrow();
		expect(isValidDate(toDate('nope'))).toBe(false);
		expect(isValidDate(FIVE_MINUTES_AGO)).toBe(true);
	});

	it('returns the ISO string for a valid date and undefined for an invalid one', () => {
		expect(toIsoString(FIVE_MINUTES_AGO)).toBe(FIVE_MINUTES_AGO.toISOString());
		expect(toIsoString(new Date('nope'))).toBeUndefined();
	});

	it('breaks a past difference into whole units', () => {
		// 3 days, 2 hours and 30 seconds before NOW — every bucket has a non-zero remainder, so a
		// rounding rather than flooring regression would show up in `minutes`, `hours` and `days`.
		expect(diffRelativeTime(new Date('2026-07-27T07:59:30Z'), NOW)).toEqual({
			isFuture: false,
			seconds: 266_430,
			minutes: 4440,
			hours: 74,
			days: 3
		});
	});

	it('breaks a future difference into whole units', () => {
		expect(diffRelativeTime(new Date('2026-07-30T10:02:05Z'), NOW)).toEqual({
			isFuture: true,
			seconds: 125,
			minutes: 2,
			hours: 0,
			days: 0
		});
	});
});

describe('formatRelativeTime', () => {
	it('returns "just now" inside the five-second threshold, in both directions', () => {
		expect(formatRelativeTime(new Date('2026-07-30T09:59:58Z'), NOW, LOCALE)).toBe('just now');
		expect(formatRelativeTime(new Date('2026-07-30T10:00:04Z'), NOW, LOCALE)).toBe('just now');
	});

	it('formats sub-minute differences in seconds, in both directions', () => {
		expect(formatRelativeTime(new Date('2026-07-30T09:59:30Z'), NOW, LOCALE)).toBe(
			'30 seconds ago'
		);
		expect(formatRelativeTime(new Date('2026-07-30T10:00:30Z'), NOW, LOCALE)).toBe('in 30 seconds');
	});

	it('appends the residual seconds to a past minutes difference', () => {
		expect(formatRelativeTime(new Date('2026-07-30T09:54:30Z'), NOW, LOCALE)).toBe(
			'5 minutes 30 seconds ago'
		);
	});

	it('keeps "0 seconds" when the past minutes difference has no residual', () => {
		expect(formatRelativeTime(FIVE_MINUTES_AGO, NOW, LOCALE)).toBe('5 minutes 0 seconds ago');
	});

	it('degrades to the untouched single-unit frame when the locale frame omits the magnitude', () => {
		// Path exercised: the `frame.includes(magnitude) === false` guard, through the first of
		// GUARD_LOCALE_CANDIDATES the installed ICU build declines the noun for. Should a future ICU
		// build embed the plain unit phrase in every candidate's frame, `guardLocale` is `undefined`
		// and this asserts the compound-splice path instead — the degradation contract below is then
		// what covers the guard.
		const locale = guardLocale ?? LOCALE;
		const expected = guardLocale ? minutesFrame(locale, 5) : '5 minutes 30 seconds ago';

		expect(formatRelativeTime(new Date('2026-07-30T09:54:30Z'), NOW, locale)).toBe(expected);
	});

	it('never duplicates or orphans the magnitude in any locale', () => {
		for (const locale of ['de-DE', 'fr-FR', 'ja-JP', ...GUARD_LOCALE_CANDIDATES]) {
			const frame = minutesFrame(locale, 5);
			const magnitude = unitPhrase(locale, 'minute', 5);
			const compound = new Intl.ListFormat(locale, { style: 'narrow', type: 'unit' }).format([
				magnitude,
				unitPhrase(locale, 'second', 30)
			]);
			const actual = formatRelativeTime(new Date('2026-07-30T09:54:30Z'), NOW, locale);

			// Either the compound splice or the untouched frame — never anything in between.
			expect([frame, frame.replace(magnitude, compound)]).toContain(actual);
			expect(occurrences(actual, magnitude)).toBeLessThanOrEqual(1);
		}
	});

	it('omits the residual seconds for a future minutes difference', () => {
		expect(formatRelativeTime(new Date('2026-07-30T10:05:30Z'), NOW, LOCALE)).toBe('in 5 minutes');
	});

	it('formats sub-day differences in hours, in both directions', () => {
		expect(formatRelativeTime(new Date('2026-07-30T08:00:00Z'), NOW, LOCALE)).toBe('2 hours ago');
		expect(formatRelativeTime(new Date('2026-07-30T12:00:00Z'), NOW, LOCALE)).toBe('in 2 hours');
	});

	it('formats sub-week differences in days, in both directions', () => {
		expect(formatRelativeTime(new Date('2026-07-27T10:00:00Z'), NOW, LOCALE)).toBe('3 days ago');
		expect(formatRelativeTime(new Date('2026-08-02T10:00:00Z'), NOW, LOCALE)).toBe('in 3 days');
	});

	it('falls back to a locale date from seven days out, in both directions', () => {
		expect(formatRelativeTime(new Date('2026-07-20T10:00:00Z'), NOW, LOCALE)).toBe(
			new Date('2026-07-20T10:00:00Z').toLocaleDateString(LOCALE)
		);
		expect(formatRelativeTime(new Date('2026-08-06T10:00:00Z'), NOW, LOCALE)).toBe(
			new Date('2026-08-06T10:00:00Z').toLocaleDateString(LOCALE)
		);
	});

	it('returns "Invalid Date" instead of throwing on an unparseable date', () => {
		expect(() => formatRelativeTime(new Date('nope'), NOW, LOCALE)).not.toThrow();
		expect(formatRelativeTime(new Date('nope'), NOW, LOCALE)).toBe('Invalid Date');
	});
});

describe('zoned formatters', () => {
	it('honours a known IANA zone', () => {
		expect(formatZonedTime(NOW, LOCALE, 'UTC')).toBe('10:00:00 AM');
		expect(formatZonedDate(NOW, LOCALE, 'UTC')).toBe('July 30, 2026');
	});

	it('falls back to local formatting instead of throwing on an unknown zone', () => {
		expect(() => formatZonedDate(NOW, LOCALE, 'Mars/Olympus_Mons')).not.toThrow();
		expect(formatZonedDate(NOW, LOCALE, 'Mars/Olympus_Mons')).toBe(formatZonedDate(NOW, LOCALE));
		expect(formatZonedTime(NOW, LOCALE, 'Mars/Olympus_Mons')).toBe(formatZonedTime(NOW, LOCALE));
	});

	it('returns "Invalid Date" instead of throwing on an unparseable date', () => {
		expect(formatZonedDate(new Date('nope'), LOCALE, 'UTC')).toBe('Invalid Date');
		expect(formatZonedTime(new Date('nope'), LOCALE)).toBe('Invalid Date');
	});
});

describe('RelativeTimeCard trigger', () => {
	it('renders a button carrying data-slot="relative-time-card-trigger"', () => {
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO } });
		const element = bySlot('relative-time-card-trigger');

		expect(element.tagName).toBe('BUTTON');
		expect(element).toHaveAttribute('type', 'button');
	});

	it('renders the absolute date and time inside a <time datetime>', () => {
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO } });
		const time = within(bySlot('relative-time-card-trigger')).getByText(
			formatAbsoluteDateTime(FIVE_MINUTES_AGO, resolveLocale())
		);

		expect(time.tagName).toBe('TIME');
		expect(time).toHaveAttribute('datetime', FIVE_MINUTES_AGO.toISOString());
	});

	it('renders a Date, an ISO string and a numeric timestamp identically', () => {
		const expected = formatAbsoluteDateTime(FIVE_MINUTES_AGO, resolveLocale());

		const asDate = render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO } });
		expect(asDate.container.textContent).toContain(expected);
		asDate.unmount();

		const asString = render(RelativeTimeCard.Root, {
			props: { date: FIVE_MINUTES_AGO.toISOString() }
		});
		expect(asString.container.textContent).toContain(expected);
		asString.unmount();

		const asNumber = render(RelativeTimeCard.Root, {
			props: { date: FIVE_MINUTES_AGO.getTime() }
		});
		expect(asNumber.container.textContent).toContain(expected);
	});

	it('marks an unparseable date invalid without throwing', () => {
		expect(() => render(RelativeTimeCard.Root, { props: { date: 'nope' } })).not.toThrow();
		const element = bySlot('relative-time-card-trigger');
		const time = element.querySelector('time');

		expect(element).toHaveAttribute('data-invalid', '');
		expect(time).not.toHaveAttribute('datetime');
		expect(time).toHaveTextContent('Invalid Date');
	});

	it('carries no data-invalid attribute for a parseable date', () => {
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO } });

		expect(bySlot('relative-time-card-trigger')).not.toHaveAttribute('data-invalid');
	});

	it('renders "Invalid Date" in the open card for an unparseable date', () => {
		render(RelativeTimeCard.Root, { props: { date: 'nope', defaultOpen: true } });

		expect(bySlot('relative-time-card-value')).toHaveTextContent('Invalid Date');
	});

	it('replaces the default <time> with a supplied children snippet', () => {
		render(RelativeTimeCard.Root, {
			props: { date: FIVE_MINUTES_AGO, children: text('Published') }
		});

		expect(screen.getByText('Published')).toBeInTheDocument();
		expect(queryBySlot('relative-time-card-trigger')?.querySelector('time')).toBeNull();
	});
});

describe('RelativeTimeCard card', () => {
	it('opens on hover after openDelay and closes on unhover after closeDelay', async () => {
		stubLayout();
		const user = setupUser();
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO } });
		const trigger = bySlot('relative-time-card-trigger');

		expect(trigger).toHaveAttribute('data-state', 'closed');

		await user.hover(trigger);
		await advance(DEFAULT_OPEN_DELAY);

		expect(cardState()).toBe('open');
		expect(trigger).toHaveAttribute('data-state', 'open');

		await user.unhover(trigger);
		// Leaving the trigger is resolved on the next animation frame (the safe polygon decides
		// whether the pointer is travelling towards the card) and only then starts `closeDelay`.
		await advance(1000 / 60);
		await advance(DEFAULT_CLOSE_DELAY);

		expect(trigger).toHaveAttribute('data-state', 'closed');
		expect(cardState()).toBe('closed');
	});

	it('stays closed until openDelay has elapsed', async () => {
		const user = setupUser();
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO } });

		await user.hover(bySlot('relative-time-card-trigger'));
		await advance(DEFAULT_OPEN_DELAY - 1);

		expect(queryBySlot('relative-time-card-content')).toBeNull();
	});

	it('exposes the bits ARIA wiring on the trigger', () => {
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, defaultOpen: true } });
		const trigger = bySlot('relative-time-card-trigger');

		expect(trigger).toHaveAttribute('role', 'button');
		expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
		expect(trigger).toHaveAttribute('aria-expanded', 'true');
		expect(trigger).toHaveAttribute('aria-controls', bySlot('relative-time-card-content').id);
	});

	it('renders the live relative time inside a <time datetime>', () => {
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, defaultOpen: true } });
		const value = bySlot('relative-time-card-value');

		expect(value.tagName).toBe('TIME');
		expect(value).toHaveAttribute('datetime', FIVE_MINUTES_AGO.toISOString());
		expect(value).toHaveTextContent(formatRelativeTime(FIVE_MINUTES_AGO, NOW, resolveLocale()));
	});

	it('renders one row per timezone plus the local row, in that order', () => {
		render(RelativeTimeCard.Root, {
			props: {
				date: FIVE_MINUTES_AGO,
				defaultOpen: true,
				timezones: ['UTC', 'Asia/Tokyo']
			}
		});
		const rows = within(bySlot('relative-time-card-timezones')).getAllByRole('listitem');

		expect(rows).toHaveLength(3);
		expect(rows[0]).toHaveAttribute('data-timezone', 'UTC');
		expect(rows[1]).toHaveAttribute('data-timezone', 'Asia/Tokyo');
		expect(rows[2]).toHaveAttribute('data-local', '');
	});

	it('lists UTC then the local row when timezones is omitted', () => {
		expect(DEFAULT_TIMEZONES).toEqual(['UTC']);

		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, defaultOpen: true } });
		const rows = within(bySlot('relative-time-card-timezones')).getAllByRole('listitem');

		expect(rows).toHaveLength(2);
		expect(rows[0]).toHaveAttribute('data-timezone', 'UTC');
		expect(rows[1]).toHaveAttribute('data-local', '');
	});

	it('renders the zone label and both zoned times inside a row', () => {
		render(RelativeTimeCard.Root, {
			props: { date: FIVE_MINUTES_AGO, defaultOpen: true, timezones: ['UTC'] }
		});
		const [row] = within(bySlot('relative-time-card-timezones')).getAllByRole('listitem');
		const locale = resolveLocale();
		const times = row.querySelectorAll('time');

		expect(row.querySelector('span')?.textContent).toBe('UTC');
		expect(times).toHaveLength(2);
		expect(times[0].textContent?.trim()).toBe(formatZonedDate(FIVE_MINUTES_AGO, locale, 'UTC'));
		expect(times[1].textContent?.trim()).toBe(formatZonedTime(FIVE_MINUTES_AGO, locale, 'UTC'));
		expect(times[0]).toHaveAttribute('datetime', FIVE_MINUTES_AGO.toISOString());
		expect(times[1]).toHaveAttribute('datetime', FIVE_MINUTES_AGO.toISOString());
	});

	it('gives every row an accessible name naming the zone, its date and its time', () => {
		render(RelativeTimeCard.Root, {
			props: { date: FIVE_MINUTES_AGO, defaultOpen: true, timezones: ['UTC'] }
		});

		for (const row of screen.getAllByRole('listitem')) {
			expect(row.getAttribute('aria-label')).toMatch(/^Time in .+: .+ .+$/);
		}
	});

	it('wraps the rows in a role="list" element', () => {
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, defaultOpen: true } });

		expect(bySlot('relative-time-card-timezones')).toHaveAttribute('role', 'list');
	});

	it('renders only the local row when timezones is empty', () => {
		render(RelativeTimeCard.Root, {
			props: { date: FIVE_MINUTES_AGO, defaultOpen: true, timezones: [] }
		});
		const rows = screen.getAllByRole('listitem');

		expect(rows).toHaveLength(1);
		expect(rows[0]).toHaveAttribute('data-local', '');
	});

	it('does not deduplicate repeated timezones', () => {
		render(RelativeTimeCard.Root, {
			props: { date: FIVE_MINUTES_AGO, defaultOpen: true, timezones: ['UTC', 'UTC'] }
		});

		expect(screen.getAllByRole('listitem')).toHaveLength(3);
	});
});

describe('RelativeTimeCard ticker', () => {
	it('advances the relative label once per updateInterval', async () => {
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, defaultOpen: true } });

		expect(bySlot('relative-time-card-value')).toHaveTextContent('5 minutes 0 seconds ago');

		await advance(DEFAULT_UPDATE_INTERVAL);

		expect(bySlot('relative-time-card-value')).toHaveTextContent('5 minutes 1 second ago');
	});

	it('changes cadence when updateInterval changes', async () => {
		// Controlled `open`, because a `rerender` re-supplies the whole prop object: an uncontrolled
		// `defaultOpen` seed would be reset to `undefined` by the second render.
		const { rerender } = render(RelativeTimeCard.Root, {
			props: { date: FIVE_MINUTES_AGO, open: true }
		});

		await advance(DEFAULT_UPDATE_INTERVAL);
		expect(bySlot('relative-time-card-value')).toHaveTextContent('5 minutes 1 second ago');

		await rerender({ date: FIVE_MINUTES_AGO, open: true, updateInterval: 5000 });

		await advance(1000);
		expect(bySlot('relative-time-card-value')).toHaveTextContent('5 minutes 1 second ago');

		await advance(4000);
		expect(bySlot('relative-time-card-value')).toHaveTextContent('5 minutes 6 seconds ago');
	});

	it('clears its interval on unmount, leaving no timer behind', async () => {
		const { unmount } = render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO } });

		expect(vi.getTimerCount()).toBeGreaterThan(0);

		unmount();
		await tick();

		expect(vi.getTimerCount()).toBe(0);
	});

	it('leaves no timer and renders nothing further when unmounted while open', async () => {
		stubLayout();
		const user = setupUser();
		const { unmount } = render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO } });

		// Opening through a real hover means the hover-open path's own timers exist too, which is the
		// case the spec's Edge Cases name (FR-007, SC-003).
		await user.hover(bySlot('relative-time-card-trigger'));
		await advance(DEFAULT_OPEN_DELAY);
		expect(cardState()).toBe('open');

		unmount();
		await tick();

		// bits-ui's dismissible layer schedules a 1 ms `afterSleep` deferral when it activates and
		// does not clear it on destroy; flushing that single tick — which must itself not throw on
		// the now-unmounted layer — leaves only timers this component owns, and there are none.
		await advance(1);

		expect(vi.getTimerCount()).toBe(0);

		const settled = document.body.innerHTML;
		await advance(DEFAULT_UPDATE_INTERVAL * 5);

		expect(document.body.innerHTML).toBe(settled);
		expect(queryBySlot('relative-time-card-content')).toBeNull();
	});
});

describe('RelativeTimeCard.Timezone standalone', () => {
	it('renders outside a RelativeTimeCard.Root without throwing', () => {
		expect(() =>
			render(RelativeTimeCard.Timezone, { props: { date: FIVE_MINUTES_AGO, timezone: 'UTC' } })
		).not.toThrow();

		expect(bySlot('relative-time-card-timezone')).toHaveAttribute('data-timezone', 'UTC');
	});

	it('defaults to role="region" with the documented accessible name', () => {
		render(RelativeTimeCard.Timezone, { props: { date: FIVE_MINUTES_AGO, timezone: 'UTC' } });
		const element = bySlot('relative-time-card-timezone');

		expect(element).toHaveAttribute('role', 'region');
		expect(element).toHaveAttribute(
			'aria-label',
			formatTimeZoneAccessibleName(FIVE_MINUTES_AGO, resolveLocale(), 'UTC')
		);
	});

	it('carries data-local only when no timezone is supplied', () => {
		const zoned = render(RelativeTimeCard.Timezone, {
			props: { date: FIVE_MINUTES_AGO, timezone: 'UTC' }
		});
		expect(bySlot('relative-time-card-timezone')).not.toHaveAttribute('data-local');
		zoned.unmount();

		render(RelativeTimeCard.Timezone, { props: { date: FIVE_MINUTES_AGO } });
		expect(bySlot('relative-time-card-timezone')).toHaveAttribute('data-local', '');
	});

	it('lets a caller supersede the default role and aria-label', () => {
		// `role`/`aria-label` are written before the spread precisely so this works — it is how the
		// root turns each row into a `listitem` (research R-10).
		render(RelativeTimeCard.Timezone, {
			props: {
				date: FIVE_MINUTES_AGO,
				timezone: 'UTC',
				role: 'listitem',
				'aria-label': 'Coordinated Universal Time'
			}
		});
		const element = bySlot('relative-time-card-timezone');

		expect(element).toHaveAttribute('role', 'listitem');
		expect(element).toHaveAttribute('aria-label', 'Coordinated Universal Time');
	});

	it('merges a caller class last instead of dropping it', () => {
		render(RelativeTimeCard.Timezone, {
			props: { date: FIVE_MINUTES_AGO, timezone: 'UTC', class: 'text-foreground' }
		});
		const element = bySlot('relative-time-card-timezone');

		expect(element.classList.contains('text-foreground')).toBe(true);
		expect(element.classList.contains('text-muted-foreground')).toBe(false);
	});
});

describe('RelativeTimeCard keyboard', () => {
	it('opens after openDelay when the trigger receives keyboard focus', async () => {
		const user = setupUser();
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO } });

		await user.tab();
		expect(bySlot('relative-time-card-trigger')).toHaveFocus();

		await advance(DEFAULT_OPEN_DELAY);

		expect(cardState()).toBe('open');
	});

	it('closes on Escape', async () => {
		const user = setupUser();
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, defaultOpen: true } });

		await user.tab();
		await user.keyboard('{Escape}');
		await advance(DEFAULT_CLOSE_DELAY);

		expect(cardState()).toBe('closed');
	});

	it('closes after closeDelay when focus leaves the trigger', async () => {
		const user = setupUser();
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO } });

		await user.tab();
		await advance(DEFAULT_OPEN_DELAY);
		expect(cardState()).toBe('open');

		await user.tab();
		await advance(DEFAULT_CLOSE_DELAY);

		expect(cardState()).toBe('closed');
	});

	it('reopens immediately on Enter once Escape has closed it', async () => {
		const user = setupUser();
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, defaultOpen: true } });

		await user.tab();
		await user.keyboard('{Escape}');
		await advance(DEFAULT_CLOSE_DELAY);
		expect(cardState()).toBe('closed');

		// No `openDelay` is advanced — `Enter` bypasses it.
		await user.keyboard('{Enter}');
		await tick();

		expect(cardState()).toBe('open');
	});

	it('leaves an already open card open on Enter', async () => {
		const user = setupUser();
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, defaultOpen: true } });

		await user.tab();
		await user.keyboard('{Enter}');
		await tick();

		expect(cardState()).toBe('open');
	});
});

/**
 * A minimal `(hover: hover)`-only `MediaQueryList` fake. `SupportsHover` reads `.matches` once on
 * mount and again from every `change` event it dispatches — good enough to drive the touch
 * fallback below without reimplementing `is-mobile.test.ts`'s full query-parsing harness.
 */
class FakeHoverQuery {
	matches: boolean;
	readonly #listeners = new Set<() => void>();

	constructor(matches: boolean) {
		this.matches = matches;
	}

	addEventListener(type: string, listener: () => void): void {
		if (type === 'change') this.#listeners.add(listener);
	}

	removeEventListener(type: string, listener: () => void): void {
		if (type === 'change') this.#listeners.delete(listener);
	}

	set(matches: boolean): void {
		this.matches = matches;
		for (const listener of [...this.#listeners]) listener();
	}
}

/** Stubs `matchMedia` so `SupportsHover` reads the given `(hover: hover)` support. */
function stubHoverSupport(matches: boolean): FakeHoverQuery {
	const query = new FakeHoverQuery(matches);
	vi.stubGlobal('matchMedia', () => query as unknown as MediaQueryList);
	return query;
}

describe('RelativeTimeCard touch fallback', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('opens immediately on a tap when the primary pointer cannot hover', async () => {
		stubHoverSupport(false);
		const user = setupUser();
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO } });
		await tick();

		// No delay advanced: a hover-driven open would still be mid-`openDelay` here, so an
		// already-open card proves the click path — not the pointerenter one — did it.
		await user.click(bySlot('relative-time-card-trigger'));

		expect(cardState()).toBe('open');
	});

	it('closes an already-open card on a tap', async () => {
		stubHoverSupport(false);
		const user = setupUser();
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, defaultOpen: true } });

		await user.click(bySlot('relative-time-card-trigger'));

		// The toggle is synchronous, unlike bits-ui's own `closeDelay`-gated Escape/blur paths, so
		// the presence manager's exit teardown can finish inside the same awaited click and leave
		// the content already unmounted — `cardState()` would then read `null`, not `'closed'`.
		// `aria-expanded` reflects `open` directly and needs no transition to settle.
		expect(bySlot('relative-time-card-trigger')).toHaveAttribute('aria-expanded', 'false');
	});

	it('reports the tap through onOpenChange', async () => {
		stubHoverSupport(false);
		const onOpenChange = vi.fn();
		const user = setupUser();
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, onOpenChange } });
		await tick();

		await user.click(bySlot('relative-time-card-trigger'));

		expect(onOpenChange).toHaveBeenCalledWith(true);
	});

	it('stays inert wherever the primary pointer already hovers', async () => {
		stubHoverSupport(true);
		const user = setupUser();
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO } });
		await tick();

		await user.click(bySlot('relative-time-card-trigger'));

		// A hover-capable click does not itself open the card — only hover/focus/Enter do — so
		// nothing has mounted the content yet.
		expect(cardState()).toBeNull();
	});

	it('still calls a caller onpointerup first', async () => {
		stubHoverSupport(false);
		const onpointerup = vi.fn();
		const user = setupUser();
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, onpointerup } });
		await tick();

		await user.click(bySlot('relative-time-card-trigger'));

		expect(onpointerup).toHaveBeenCalledTimes(1);
		expect(cardState()).toBe('open');
	});

	it('never re-toggles a card that Enter just opened', async () => {
		// A real keyboard-only device can still report `hover: none`; without gating the fallback
		// to `pointerup`, the synthetic `click` a button's Enter activation also dispatches would
		// immediately flip `open` back off (the exact regression a `click`-bound handler caused).
		stubHoverSupport(false);
		const user = setupUser();
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, defaultOpen: true } });

		await user.tab();
		await user.keyboard('{Escape}');
		await advance(DEFAULT_CLOSE_DELAY);
		expect(cardState()).toBe('closed');

		await user.keyboard('{Enter}');
		await tick();

		expect(cardState()).toBe('open');
	});

	it('reacts to a mouse or trackpad being attached at runtime', async () => {
		const query = stubHoverSupport(false);
		const user = setupUser();
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO } });
		await tick();

		query.set(true);
		await tick();

		await user.click(bySlot('relative-time-card-trigger'));
		expect(cardState()).toBeNull();
	});

	it('opens the custom trigger from `child` mode on a tap, the reported bug', async () => {
		stubHoverSupport(false);
		const user = setupUser();
		render(Harness, { props: { date: FIVE_MINUTES_AGO, useChild: true } });
		await tick();

		await user.click(screen.getByTestId('trigger-child'));

		expect(cardState()).toBe('open');
	});
});

describe('RelativeTimeCard styling', () => {
	it('applies each documented variant row and reports it as data-variant', () => {
		for (const variant of RELATIVE_TIME_CARD_VARIANTS) {
			const { unmount } = render(RelativeTimeCard.Root, {
				props: { date: FIVE_MINUTES_AGO, variant }
			});
			const element = bySlot('relative-time-card-trigger');

			expect(element).toHaveAttribute('data-variant', variant);
			for (const className of relativeTimeCardTriggerVariants({ variant }).split(' ')) {
				expect(element.classList.contains(className)).toBe(true);
			}

			unmount();
		}
	});

	it('normalises an unknown runtime variant to "default"', () => {
		expect(resolveRelativeTimeCardVariant('nope' as RelativeTimeCardVariant)).toBe('default');
		expect(resolveRelativeTimeCardVariant()).toBe('default');
	});

	it('lets a caller class win a conflicting utility', () => {
		render(RelativeTimeCard.Root, {
			props: { date: FIVE_MINUTES_AGO, class: 'text-foreground' }
		});
		const element = bySlot('relative-time-card-trigger');

		expect(element.classList.contains('text-foreground')).toBe(true);
		expect(element.classList.contains('text-foreground/70')).toBe(false);
	});

	it('never suppresses the focus outline on any rendered part', () => {
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, defaultOpen: true } });

		for (const element of document.body.querySelectorAll('*')) {
			for (const className of element.classList) {
				expect(className).not.toMatch(/(^|:)outline-none$/);
			}
		}
	});

	it('uses no physical direction utility on any rendered part', () => {
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, defaultOpen: true } });

		for (const element of document.body.querySelectorAll('*')) {
			for (const className of element.classList) {
				expect(className).not.toMatch(/(^|:)-?(ml|mr|pl|pr|left|right)-/);
			}
		}
	});

	it('keeps the hover behaviour when children replace the default time', async () => {
		stubLayout();
		const user = setupUser();
		render(Harness, { props: { date: FIVE_MINUTES_AGO, label: 'Published' } });

		expect(screen.getByTestId('trigger-children')).toBeInTheDocument();
		expect(bySlot('relative-time-card-trigger').querySelector('time')).toBeNull();

		await user.hover(bySlot('relative-time-card-trigger'));
		await advance(DEFAULT_OPEN_DELAY);

		expect(cardState()).toBe('open');
	});

	it('renders the trigger onto a child element that still opens the card', async () => {
		const user = setupUser();
		render(Harness, { props: { date: FIVE_MINUTES_AGO, useChild: true } });
		const element = screen.getByTestId('trigger-child');

		expect(element).toHaveAttribute('data-slot', 'relative-time-card-trigger');
		expect(element).toHaveAttribute('aria-haspopup', 'dialog');

		await user.tab();
		expect(element).toHaveFocus();

		await advance(DEFAULT_OPEN_DELAY);

		expect(cardState()).toBe('open');
	});

	it('leaves ref null in child mode', () => {
		const refs: (HTMLButtonElement | null)[] = [];
		render(Harness, {
			props: { date: FIVE_MINUTES_AGO, useChild: true, onRef: (ref) => refs.push(ref) }
		});

		expect(refs.at(-1)).toBeNull();
	});

	it('opens under dir="rtl" and keeps the timezone rows in order', async () => {
		const user = setupUser();
		render(Harness, {
			props: { date: FIVE_MINUTES_AGO, dir: 'rtl', timezones: ['UTC', 'Asia/Tokyo'] }
		});

		await user.tab();
		await advance(DEFAULT_OPEN_DELAY);

		expect(cardState()).toBe('open');

		const rows = within(bySlot('relative-time-card-timezones')).getAllByRole('listitem');
		expect(rows.map((row) => row.getAttribute('data-timezone')).slice(0, 2)).toEqual([
			'UTC',
			'Asia/Tokyo'
		]);
	});
});

describe('RelativeTimeCard open state', () => {
	it('seeds an already open card from defaultOpen', () => {
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, defaultOpen: true } });

		expect(cardState()).toBe('open');
		expect(bySlot('relative-time-card-trigger')).toHaveAttribute('aria-expanded', 'true');
	});

	it('reports every transition through onOpenChange when uncontrolled', async () => {
		const onOpenChange = vi.fn();
		const user = setupUser();
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, onOpenChange } });

		await user.tab();
		await advance(DEFAULT_OPEN_DELAY);
		expect(onOpenChange).toHaveBeenLastCalledWith(true);

		await user.keyboard('{Escape}');
		await advance(DEFAULT_CLOSE_DELAY);
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});

	it('reports every transition through onOpenChange when bound', async () => {
		const onOpenChange = vi.fn();
		const user = setupUser();
		render(Harness, { props: { date: FIVE_MINUTES_AGO, onOpenChange } });

		await user.tab();
		await advance(DEFAULT_OPEN_DELAY);
		expect(onOpenChange).toHaveBeenLastCalledWith(true);

		await user.keyboard('{Escape}');
		await advance(DEFAULT_CLOSE_DELAY);
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});

	it('keeps a bound parent authoritative', async () => {
		const user = setupUser();
		const { rerender } = render(Harness, { props: { date: FIVE_MINUTES_AGO, open: false } });

		expect(queryBySlot('relative-time-card-content')).toBeNull();

		await rerender({ date: FIVE_MINUTES_AGO, open: true });
		await tick();
		expect(cardState()).toBe('open');

		await user.keyboard('{Escape}');
		await advance(DEFAULT_CLOSE_DELAY);
		expect(cardState()).toBe('closed');
	});

	it('exposes the trigger element through bind:ref', () => {
		const refs: (HTMLButtonElement | null)[] = [];
		render(Harness, { props: { date: FIVE_MINUTES_AGO, onRef: (ref) => refs.push(ref) } });

		expect(refs.at(-1)).toBe(bySlot('relative-time-card-trigger'));
	});
});

describe('RelativeTimeCard positioning', () => {
	it('forwards side and align to the card', () => {
		render(RelativeTimeCard.Root, {
			props: { date: FIVE_MINUTES_AGO, defaultOpen: true, side: 'top', align: 'start' }
		});
		const content = bySlot('relative-time-card-content');

		expect(content).toHaveAttribute('data-side', 'top');
		expect(content).toHaveAttribute('data-align', 'start');
	});

	it('falls back to the composed hover-card placement defaults', () => {
		render(RelativeTimeCard.Root, { props: { date: FIVE_MINUTES_AGO, defaultOpen: true } });
		const content = bySlot('relative-time-card-content');

		expect(content).toHaveAttribute('data-side', 'top');
		expect(content).toHaveAttribute('data-align', 'center');
	});

	it('forwards every remaining placement prop', () => {
		render(RelativeTimeCard.Root, {
			props: {
				date: FIVE_MINUTES_AGO,
				defaultOpen: true,
				sideOffset: 12,
				alignOffset: 8,
				avoidCollisions: false,
				collisionBoundary: [],
				collisionPadding: 16
			}
		});

		expect(cardState()).toBe('open');
	});
});
