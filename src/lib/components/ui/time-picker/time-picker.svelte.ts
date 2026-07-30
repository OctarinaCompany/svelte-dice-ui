import type { Direction } from '$lib/components/ui/direction-provider/index.js';
import { SegmentNavigation } from '$lib/components/ui/segmented-input/index.js';
import type { DomOrderedCollection } from '$lib/components/ui/speed-dial/speed-dial-collection.svelte.js';
import { getContext, hasContext, setContext } from 'svelte';

import type { ColumnItemMeta, ColumnNavigation } from './column-navigation.svelte.js';
import {
	clamp,
	currentTime,
	formatTimeValue,
	getIs12Hour,
	normalizeSegmentPlaceholder,
	parseTimeString,
	type Period,
	type ResolvedSegmentPlaceholder,
	type Segment,
	type SegmentPlaceholder,
	type TimeValue,
	to12Hour,
	to24Hour
} from './time-engine.js';

/** What a click on empty input-group space does. */
export type TimePickerClickAction = 'focus' | 'open';

export type TimePickerRootStateProps = {
	readonly id: string;
	readonly getValue: () => string;
	readonly setValue: (value: string) => void;
	readonly getOpen: () => boolean;
	readonly setOpen: (open: boolean) => void;
	readonly getDir: () => Direction;
	readonly getLocale: () => string | undefined;
	readonly getSegmentPlaceholder: () => SegmentPlaceholder | undefined;
	readonly getHourStep: () => number;
	readonly getMinuteStep: () => number;
	readonly getSecondStep: () => number;
	readonly getShowSeconds: () => boolean;
	readonly getDisabled: () => boolean;
	readonly getReadOnly: () => boolean;
	readonly getRequired: () => boolean;
	readonly getInvalid: () => boolean;
	readonly getOpenOnFocus: () => boolean;
	readonly getInputGroupClickAction: () => TimePickerClickAction;
	readonly getMin: () => string | undefined;
	readonly getMax: () => string | undefined;
	readonly getName: () => string | undefined;
};

function pad(value: number): string {
	return value.toString().padStart(2, '0');
}

function hasAnyField(value: TimeValue): boolean {
	return (
		value.hour !== undefined ||
		value.minute !== undefined ||
		value.second !== undefined ||
		value.period !== undefined
	);
}

/**
 * One instance per `<TimePicker.Root>`, published on the root context.
 *
 * Replaces upstream's `Store` — `listenersRef` + `stateRef` + `useSyncExternalStore`
 * (radix/ui/time-picker.tsx:196-237, 357-418) — plus its `TimePickerContext` memo. The store exists
 * only so a deep consumer can subscribe to one slice without re-rendering the tree, which runes give
 * for free: a `$derived` read of `root.value` inside `<TimePicker.Hour>` re-runs only that
 * expression (research R-01).
 *
 * Reactive inputs arrive as getter functions rather than snapshots, and both setters keep upstream's
 * `Object.is` guard so `onValueChange` / `onOpenChange` fire exactly as often as upstream's.
 */
export class TimePickerRootState {
	// $derived below is lazy at runtime (evaluated only when the field is read), but svelte-check's
	// static analysis cannot see that and flags the field as used before its constructor assignment.
	#props!: TimePickerRootStateProps;

	/** The root's own id, and the three ids derived from it so they are stable and inspectable. */
	readonly id: string;
	readonly inputGroupId: string;
	readonly labelId: string;
	readonly triggerId: string;

	/** The canonical 24-hour string — `""` when nothing is set. */
	readonly value: string = $derived(this.#props.getValue());

	/** The parsed, partial view of {@link value} that every part reads. */
	readonly timeValue: TimeValue | null = $derived(parseTimeString(this.value));

	readonly open: boolean = $derived(this.#props.getOpen());

	/**
	 * The R-09 latch: set just before `openOnFocus` opens the panel, consumed by the content's
	 * `onOpenAutoFocus` so the caret stays in the segment. Cleared whenever the panel closes.
	 */
	openedViaFocus = $state(false);

	/** The element the popover anchors to, and the boundary the group's click policy tests against. */
	inputGroupElement = $state<HTMLElement | null>(null);

	readonly dir: Direction = $derived(this.#props.getDir());
	readonly is12Hour: boolean = $derived(getIs12Hour(this.#props.getLocale()));
	readonly segmentPlaceholder: ResolvedSegmentPlaceholder = $derived(
		normalizeSegmentPlaceholder(this.#props.getSegmentPlaceholder())
	);
	readonly hourStep: number = $derived(this.#props.getHourStep());
	readonly minuteStep: number = $derived(this.#props.getMinuteStep());
	readonly secondStep: number = $derived(this.#props.getSecondStep());
	readonly showSeconds: boolean = $derived(this.#props.getShowSeconds());
	readonly disabled: boolean = $derived(this.#props.getDisabled());
	readonly readOnly: boolean = $derived(this.#props.getReadOnly());
	readonly required: boolean = $derived(this.#props.getRequired());
	readonly invalid: boolean = $derived(this.#props.getInvalid());
	readonly openOnFocus: boolean = $derived(this.#props.getOpenOnFocus());
	readonly inputGroupClickAction: TimePickerClickAction = $derived(
		this.#props.getInputGroupClickAction()
	);
	readonly name: string | undefined = $derived(this.#props.getName());

	/**
	 * Accepted for upstream parity and reachable from the context, but never enforced: upstream puts
	 * both on its context and never reads them again (research R-23).
	 */
	readonly min: string | undefined = $derived(this.#props.getMin());
	readonly max: string | undefined = $derived(this.#props.getMax());

	/** The segment registry, composed from `segmented-input` rather than re-implemented (R-04). */
	readonly nav: SegmentNavigation;

	constructor(props: TimePickerRootStateProps) {
		this.#props = props;
		this.id = props.id;
		this.inputGroupId = `${props.id}-input-group`;
		this.labelId = `${props.id}-label`;
		this.triggerId = `${props.id}-trigger`;
		this.nav = new SegmentNavigation({
			getOrientation: () => 'horizontal',
			getDir: () => this.dir
		});
	}

	setValue(next: string): void {
		if (Object.is(this.value, next)) return;
		this.#props.setValue(next);
	}

	setOpen(next: boolean): void {
		if (Object.is(this.open, next)) return;
		this.#props.setOpen(next);
		// Upstream clears the latch inside the same `setState` branch (time-picker.tsx:382-384), so it
		// can never survive a close and mis-steer the *next* open.
		if (!next) this.openedViaFocus = false;
	}

	/** Open the panel while latching that focus must stay where it is (R-09). Order matters. */
	openViaFocus(): void {
		if (this.open) return;
		this.openedViaFocus = true;
		this.setOpen(true);
	}

	/** `true` once, when the panel was opened by a segment gaining focus rather than by the trigger. */
	consumeOpenedViaFocus(): boolean {
		if (!this.openedViaFocus) return false;
		this.openedViaFocus = false;
		return true;
	}

	/** Whether `segment` currently holds a value rather than showing its placeholder. */
	hasSegment(segment: Segment): boolean {
		const time = this.timeValue;
		if (!time) return false;
		if (segment === 'period') return time.hour !== undefined;
		return time[segment] !== undefined;
	}

	/**
	 * The committed display text of `segment`, or its placeholder — upstream's `getSegmentValue`
	 * (radix/ui/time-picker.tsx:797-824). The hour is projected through `to12Hour` when the resolved
	 * format is 12-hour; the stored value stays 24-hour either way.
	 */
	segmentText(segment: Segment): string {
		const time = this.timeValue;
		const placeholder = this.segmentPlaceholder[segment];
		if (!time) return placeholder;

		switch (segment) {
			case 'hour': {
				if (time.hour === undefined) return placeholder;
				return pad(this.is12Hour ? to12Hour(time.hour).hour : time.hour);
			}
			case 'minute':
				return time.minute === undefined ? placeholder : pad(time.minute);
			case 'second':
				return time.second === undefined ? placeholder : pad(time.second);
			case 'period':
				return time.hour === undefined ? placeholder : to12Hour(time.hour).period;
		}
	}

	/** The period a new hour should be projected into when the value carries none of its own. */
	#referencePeriod(time: TimeValue | null): Period {
		if (time?.period !== undefined) return time.period;
		if (time?.hour !== undefined) return to12Hour(time.hour).period;
		return to12Hour(currentTime().hour).period;
	}

	/**
	 * Commit one segment's text into the value — upstream's `updateTimeValue`
	 * (radix/ui/time-picker.tsx:837-904), branch for branch.
	 *
	 * `raw` is the **displayed** text, so a 12-hour hour is clamped to `1…12` and projected back to
	 * 24-hour; every other field is clamped to its own range. Text equal to the segment's placeholder
	 * is not a value and is ignored.
	 */
	commitSegment(segment: Segment, raw: string): void {
		if (!raw || raw === this.segmentPlaceholder[segment]) return;

		const time = this.timeValue;
		const next: TimeValue = { ...(time ?? {}) };

		switch (segment) {
			case 'hour': {
				const displayHour = Number.parseInt(raw, 10);
				if (Number.isNaN(displayHour)) break;

				if (this.is12Hour) {
					next.hour = to24Hour(clamp(displayHour, 1, 12), this.#referencePeriod(time));
					if (time?.period !== undefined) next.period = time.period;
				} else {
					next.hour = clamp(displayHour, 0, 23);
				}
				break;
			}
			case 'minute': {
				const minute = Number.parseInt(raw, 10);
				if (!Number.isNaN(minute)) next.minute = clamp(minute, 0, 59);
				break;
			}
			case 'second': {
				const second = Number.parseInt(raw, 10);
				if (!Number.isNaN(second)) next.second = clamp(second, 0, 59);
				break;
			}
			case 'period': {
				if (raw !== 'AM' && raw !== 'PM') break;
				next.period = raw;
				if (time?.hour !== undefined) {
					next.hour = to24Hour(to12Hour(time.hour).hour, raw);
				}
				break;
			}
		}

		this.setValue(formatTimeValue(next, this.showSeconds));
	}

	/** Delete one field, collapsing the whole value to `""` when nothing is left. */
	clearSegment(segment: Segment): void {
		const time = this.timeValue;
		if (!time) {
			this.setValue('');
			return;
		}

		const next: TimeValue = { ...time };
		delete next[segment];

		this.setValue(hasAnyField(next) ? formatTimeValue(next, this.showSeconds) : '');
	}

	/**
	 * Fill the still-unset hour / minute — and second, when `showSeconds` — from the current time,
	 * upstream's blur backfill (radix/ui/time-picker.tsx:932-959). A value that is entirely unset is
	 * left alone: nothing is invented for a field the user never touched.
	 */
	backfillFromNow(): void {
		const time = this.timeValue;
		if (!time) return;

		const now = currentTime();
		const next: TimeValue = { ...time };
		let changed = false;

		if (next.hour === undefined) {
			next.hour = now.hour;
			changed = true;
		}
		if (next.minute === undefined) {
			next.minute = now.minute;
			changed = true;
		}
		if (this.showSeconds && next.second === undefined) {
			next.second = now.second;
			changed = true;
		}

		if (changed) this.setValue(formatTimeValue(next, this.showSeconds));
	}

	/**
	 * Activating an hour column item (radix/ui/time-picker.tsx:1878-1913): set the hour and backfill
	 * the fields that are still unset from now, leaving the panel open.
	 *
	 * `readOnly` suppresses it — upstream's column items commit even while read-only, which
	 * contradicts the flag's documented meaning and lets a mouse user mutate a read-only field
	 * (divergence D-17). The same guard is on every `select*` below.
	 */
	selectHour(displayHour: number): void {
		if (this.disabled || this.readOnly) return;

		const time = this.timeValue;
		const now = currentTime();
		const next: TimeValue = { ...(time ?? {}) };

		next.hour = this.is12Hour ? to24Hour(displayHour, this.#referencePeriod(time)) : displayHour;
		if (time?.period !== undefined) next.period = time.period;
		if (next.minute === undefined) next.minute = now.minute;
		if (this.showSeconds && next.second === undefined) next.second = now.second;

		this.setValue(formatTimeValue(next, this.showSeconds));
	}

	/** Activating a minute column item (radix/ui/time-picker.tsx:1961-1979). */
	selectMinute(minute: number): void {
		if (this.disabled || this.readOnly) return;

		const now = currentTime();
		const next: TimeValue = { ...(this.timeValue ?? {}), minute };

		if (next.hour === undefined) next.hour = now.hour;
		if (this.showSeconds && next.second === undefined) next.second = now.second;

		this.setValue(formatTimeValue(next, this.showSeconds));
	}

	/**
	 * Activating a second column item (radix/ui/time-picker.tsx:2026-2044). Upstream serialises with
	 * seconds unconditionally here — composing the column *is* the request for that arity — so the
	 * `showSeconds` flag is deliberately not consulted.
	 */
	selectSecond(second: number): void {
		if (this.disabled || this.readOnly) return;

		const now = currentTime();
		const next: TimeValue = { ...(this.timeValue ?? {}), second };

		if (next.hour === undefined) next.hour = now.hour;
		if (next.minute === undefined) next.minute = now.minute;

		this.setValue(formatTimeValue(next, true));
	}

	/** Activating a period column item (radix/ui/time-picker.tsx:2082-2106). */
	selectPeriod(period: Period): void {
		if (this.disabled || this.readOnly) return;

		const time = this.timeValue;
		const now = currentTime();
		const next: TimeValue = { ...(time ?? {}) };

		next.hour = to24Hour(to12Hour(time?.hour ?? now.hour).hour, period);
		if (next.minute === undefined) next.minute = now.minute;
		if (this.showSeconds && next.second === undefined) next.second = now.second;

		this.setValue(formatTimeValue(next, this.showSeconds));
	}

	/** Reset to `""`. No-op while `disabled` or `readOnly`. */
	clear(): void {
		if (this.disabled || this.readOnly) return;
		this.setValue('');
	}

	/**
	 * Focus and fully select the first registered segment — what a click on empty group space does
	 * under the default `inputGroupClickAction="focus"` (radix/ui/time-picker.tsx:672-687).
	 */
	focusFirstSegment(): void {
		this.nav.focusAt(0, 'all');
	}
}

// ---------------------------------------------------------------------------
// Contexts — four Symbol keys, four throwing getters
// ---------------------------------------------------------------------------

const TIME_PICKER_CONTEXT_KEY = Symbol('time-picker');

export function setTimePickerContext(state: TimePickerRootState): TimePickerRootState {
	return setContext(TIME_PICKER_CONTEXT_KEY, state);
}

export function hasTimePickerContext(): boolean {
	return hasContext(TIME_PICKER_CONTEXT_KEY);
}

/** Read the picker's state, throwing when there is no `<TimePicker.Root>` ancestor. */
export function getTimePickerContext(consumerName = '<TimePicker.Part>'): TimePickerRootState {
	if (!hasTimePickerContext()) {
		throw new Error(`\`${consumerName}\` must be used within \`<TimePicker.Root>\`.`);
	}
	return getContext<TimePickerRootState>(TIME_PICKER_CONTEXT_KEY);
}

/** What `<TimePicker.InputGroup>` publishes for its segment inputs. */
export type TimePickerInputGroupContext = {
	/** The group's rendered element — the popover anchor and the click-target boundary. */
	readonly getElement: () => HTMLElement | null;
};

const TIME_PICKER_INPUT_GROUP_CONTEXT_KEY = Symbol('time-picker-input-group');

export function setTimePickerInputGroupContext(
	context: TimePickerInputGroupContext
): TimePickerInputGroupContext {
	return setContext(TIME_PICKER_INPUT_GROUP_CONTEXT_KEY, context);
}

export function hasTimePickerInputGroupContext(): boolean {
	return hasContext(TIME_PICKER_INPUT_GROUP_CONTEXT_KEY);
}

/** Read the group's context, throwing when there is no `<TimePicker.InputGroup>` ancestor. */
export function getTimePickerInputGroupContext(
	consumerName = '<TimePicker.Input>'
): TimePickerInputGroupContext {
	if (!hasTimePickerInputGroupContext()) {
		throw new Error(`\`${consumerName}\` must be used within \`<TimePicker.InputGroup>\`.`);
	}
	return getContext<TimePickerInputGroupContext>(TIME_PICKER_INPUT_GROUP_CONTEXT_KEY);
}

const TIME_PICKER_CONTENT_CONTEXT_KEY = Symbol('time-picker-content');

export function setTimePickerContentContext(nav: ColumnNavigation): ColumnNavigation {
	return setContext(TIME_PICKER_CONTENT_CONTEXT_KEY, nav);
}

export function hasTimePickerContentContext(): boolean {
	return hasContext(TIME_PICKER_CONTENT_CONTEXT_KEY);
}

/** Read the panel's column navigation, throwing when there is no `<TimePicker.Content>` ancestor. */
export function getTimePickerContentContext(
	consumerName = '<TimePicker.Column>'
): ColumnNavigation {
	if (!hasTimePickerContentContext()) {
		throw new Error(`\`${consumerName}\` must be used within \`<TimePicker.Content>\`.`);
	}
	return getContext<ColumnNavigation>(TIME_PICKER_CONTENT_CONTEXT_KEY);
}

/** What `<TimePicker.Column>` publishes for its items. */
export type TimePickerColumnContext = {
	/** The column's own id, as registered with the panel's {@link ColumnNavigation}. */
	readonly id: string;
	/** The column's own item registry, which every item self-registers with. */
	readonly items: DomOrderedCollection<ColumnItemMeta>;
};

const TIME_PICKER_COLUMN_CONTEXT_KEY = Symbol('time-picker-column');

export function setTimePickerColumnContext(
	context: TimePickerColumnContext
): TimePickerColumnContext {
	return setContext(TIME_PICKER_COLUMN_CONTEXT_KEY, context);
}

export function hasTimePickerColumnContext(): boolean {
	return hasContext(TIME_PICKER_COLUMN_CONTEXT_KEY);
}

/** Read the column's context, throwing when there is no `<TimePicker.Column>` ancestor. */
export function getTimePickerColumnContext(
	consumerName = '<TimePicker.ColumnItem>'
): TimePickerColumnContext {
	if (!hasTimePickerColumnContext()) {
		throw new Error(`\`${consumerName}\` must be used within \`<TimePicker.Column>\`.`);
	}
	return getContext<TimePickerColumnContext>(TIME_PICKER_COLUMN_CONTEXT_KEY);
}
