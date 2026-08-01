import { afterEach, describe, expect, it } from 'vitest';

import {
	addMentionSpan,
	createCaretAnchor,
	getCaretRect,
	getLineHeight,
	measureTextWidth,
	removeMentionSpans,
	resolveMentionTrigger,
	shiftMentionSpans,
	type MentionSpan
} from './mention-caret.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const mounted: HTMLElement[] = [];

function field(value: string, style = ''): HTMLInputElement {
	const input = document.createElement('input');
	input.value = value;
	if (style) input.style.cssText = style;
	document.body.appendChild(input);
	mounted.push(input);
	return input;
}

/** `@kickflip` inserted at the start, as `addMention` would record it. */
const KICKFLIP: MentionSpan = { value: 'kickflip', start: 0, end: 9 };

afterEach(() => {
	for (const element of mounted.splice(0)) element.remove();
});

// ---------------------------------------------------------------------------
// T005a — resolveMentionTrigger: the six-condition word-boundary matrix
// ---------------------------------------------------------------------------

describe('resolveMentionTrigger (data-model §6.1)', () => {
	it('matches a trigger at the very start of the text', () => {
		expect(resolveMentionTrigger('@', 1, '@', [])).toEqual({ triggerIndex: 0, search: '' });
		expect(resolveMentionTrigger('@kick', 5, '@', [])).toEqual({ triggerIndex: 0, search: 'kick' });
	});

	it('matches a trigger after a space and after a newline', () => {
		expect(resolveMentionTrigger('hello @k', 8, '@', [])).toEqual({ triggerIndex: 6, search: 'k' });
		expect(resolveMentionTrigger('hello\n@k', 8, '@', [])).toEqual({
			triggerIndex: 6,
			search: 'k'
		});
	});

	it('rejects a trigger typed mid-word, which is what stops foo@bar.com', () => {
		expect(resolveMentionTrigger('foo@', 4, '@', [])).toBeNull();
		expect(resolveMentionTrigger('foo@bar.com', 8, '@', [])).toBeNull();
	});

	it('rejects a trigger that is inside an already-inserted mention', () => {
		expect(resolveMentionTrigger('@kickflip ', 5, '@', [KICKFLIP])).toBeNull();
	});

	it('rejects a search containing a space', () => {
		expect(resolveMentionTrigger('@kick flip', 10, '@', [])).toBeNull();
	});

	it('rejects interfering non-separator text immediately after the caret', () => {
		expect(resolveMentionTrigger('@kickx', 5, '@', [])).toBeNull();
		// A space, a newline or another trigger after the caret does not interfere.
		expect(resolveMentionTrigger('@kick x', 5, '@', [])).toEqual({
			triggerIndex: 0,
			search: 'kick'
		});
		expect(resolveMentionTrigger('@kick\nx', 5, '@', [])).toEqual({
			triggerIndex: 0,
			search: 'kick'
		});
	});

	it('resolves against the last trigger at or before the caret', () => {
		// `lastIndexOf` finds the trigger sitting *at* the caret, and the caret is not past it — so a
		// second trigger typed straight after a query closes the query rather than extending it.
		expect(resolveMentionTrigger('@kick@', 5, '@', [])).toBeNull();
		expect(resolveMentionTrigger('one @a two @b', 13, '@', [])).toEqual({
			triggerIndex: 11,
			search: 'b'
		});
	});

	it('allows interfering text when the caret sits inside a tracked mention span', () => {
		expect(
			resolveMentionTrigger('hi @kickflip', 12, '@', [{ value: 'x', start: 10, end: 14 }])
		).toEqual({ triggerIndex: 3, search: 'kickflip' });
	});

	it('rejects a caret at or behind the trigger, and text with no trigger at all', () => {
		expect(resolveMentionTrigger('a@b', 1, '@', [])).toBeNull();
		expect(resolveMentionTrigger('plain text', 5, '@', [])).toBeNull();
	});

	it('honours a multi-character custom trigger', () => {
		expect(resolveMentionTrigger('::ki', 4, '::', [])).toEqual({ triggerIndex: 0, search: ':ki' });
		expect(resolveMentionTrigger('#k', 2, '#', [])).toEqual({ triggerIndex: 0, search: 'k' });
		expect(resolveMentionTrigger('@k', 2, '#', [])).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// T005a — the span algebra
// ---------------------------------------------------------------------------

describe('addMentionSpan (data-model §6.2)', () => {
	it('appends the new span and shifts only the spans after the insertion point', () => {
		const before: MentionSpan = { value: 'a', start: 0, end: 2 };
		const after: MentionSpan = { value: 'b', start: 20, end: 24 };
		const inserted: MentionSpan = { value: 'c', start: 5, end: 14 };

		expect(addMentionSpan([before, after], inserted, 5, 10)).toEqual([
			{ value: 'a', start: 0, end: 2 },
			{ value: 'b', start: 30, end: 34 },
			inserted
		]);
	});

	it('leaves the source array untouched', () => {
		const spans = [KICKFLIP];
		addMentionSpan(spans, { value: 'b', start: 20, end: 24 }, 0, 10);
		expect(spans).toEqual([KICKFLIP]);
	});
});

describe('removeMentionSpans (data-model §6.3)', () => {
	it('drops the removed spans and pulls survivors left by their length plus a space', () => {
		const first: MentionSpan = { value: 'kickflip', start: 0, end: 9 };
		const second: MentionSpan = { value: 'heelflip', start: 14, end: 23 };

		expect(removeMentionSpans([first, second], [first])).toEqual([
			{ value: 'heelflip', start: 4, end: 13 }
		]);
	});

	it('removes several spans at once and accumulates their shifts', () => {
		const first: MentionSpan = { value: 'a', start: 0, end: 2 };
		const second: MentionSpan = { value: 'b', start: 3, end: 5 };
		const third: MentionSpan = { value: 'c', start: 6, end: 8 };

		expect(removeMentionSpans([first, second, third], [second, first])).toEqual([
			{ value: 'c', start: 0, end: 2 }
		]);
	});

	it('leaves spans that start before every removal exactly where they are', () => {
		const first: MentionSpan = { value: 'a', start: 0, end: 2 };
		const second: MentionSpan = { value: 'b', start: 10, end: 12 };

		expect(removeMentionSpans([first, second], [second])).toEqual([first]);
	});
});

describe('shiftMentionSpans (data-model §6.4)', () => {
	it('shifts spans after an insertion and leaves earlier ones alone', () => {
		const early: MentionSpan = { value: 'a', start: 0, end: 9 };
		const late: MentionSpan = { value: 'b', start: 20, end: 29 };

		expect(shiftMentionSpans([early, late], 15, 3)).toEqual([
			early,
			{ value: 'b', start: 23, end: 32 }
		]);
	});

	it('shifts spans left on a deletion before them', () => {
		const late: MentionSpan = { value: 'b', start: 20, end: 29 };
		expect(shiftMentionSpans([late], 5, -2)).toEqual([{ value: 'b', start: 18, end: 27 }]);
	});

	it('does not move a span the edit happened inside or after', () => {
		const span: MentionSpan = { value: 'a', start: 0, end: 9 };
		expect(shiftMentionSpans([span], 20, 1)).toEqual([span]);
		expect(shiftMentionSpans([span], 0, 0)).toEqual([span]);
	});
});

// ---------------------------------------------------------------------------
// T005a — caret geometry, structurally (jsdom performs no layout)
// ---------------------------------------------------------------------------

describe('caret geometry', () => {
	it('falls back to offsetHeight when the computed line height is not a finite number (D-9)', () => {
		const input = field('hello');
		// jsdom reports `line-height: normal`, which `Number.parseInt` turns into NaN — the exact case
		// upstream's `?? input.offsetHeight` never catches.
		expect(Number.parseInt(window.getComputedStyle(input).lineHeight, 10)).toBeNaN();
		expect(getLineHeight(input)).toBe(input.offsetHeight);
		expect(Number.isFinite(getLineHeight(input))).toBe(true);
	});

	it('uses the explicit line height when there is one', () => {
		const input = field('hello', 'line-height: 24px;');
		expect(getLineHeight(input)).toBe(24);
	});

	it('measures text without leaving its probe element behind', () => {
		const input = field('hello');
		const before = document.body.childElementCount;
		expect(measureTextWidth('hello', input)).toBe(0);
		expect(document.body.childElementCount).toBe(before);
	});

	it('produces a finite rect even with no layout engine', () => {
		const input = field('hello world');
		const rect = getCaretRect(input, 5, 'ltr');

		expect(rect.width).toBe(0);
		for (const value of [rect.x, rect.y, rect.top, rect.bottom, rect.left, rect.right]) {
			expect(Number.isFinite(value)).toBe(true);
		}
	});

	it('mirrors the horizontal origin under rtl', () => {
		const input = field('hello world', 'padding-left: 4px; padding-right: 12px;');
		// jsdom reports an all-zero box for every element, so the field is given one to measure from.
		input.getBoundingClientRect = () => new DOMRect(100, 50, 200, 30);

		const ltr = getCaretRect(input, 5, 'ltr');
		const rtl = getCaretRect(input, 5, 'rtl');

		// LTR measures from the left edge plus the left padding; RTL from the right edge minus the
		// right padding. Both stay clamped inside `rect.right - 10`.
		expect(ltr.x).toBe(104);
		expect(rtl.x).toBe(288);
		expect(ltr.y).toBe(50);
		expect(rtl.y).toBe(50);
	});

	it('creates a Measurable anchor that re-measures on every read', () => {
		const input = field('hello');
		input.getBoundingClientRect = () => new DOMRect(10, 20, 200, 30);
		const anchor = createCaretAnchor(input, 5, 'ltr');

		const rect = anchor.getBoundingClientRect();
		expect(rect.y).toBe(20);
		expect(anchor.getClientRects()).toHaveLength(1);
		expect(anchor.getClientRects()[0]?.x).toBe(rect.x);

		// The anchor re-measures rather than caching, so a scrolled or moved field still positions.
		input.getBoundingClientRect = () => new DOMRect(10, 90, 200, 30);
		expect(anchor.getBoundingClientRect().y).toBe(90);
	});
});
