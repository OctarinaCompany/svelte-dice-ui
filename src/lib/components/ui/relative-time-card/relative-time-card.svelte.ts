import { tv } from 'tailwind-variants';

import {
	formatAbsoluteDateTime,
	formatRelativeTimeAt,
	isValidDate,
	toIsoString
} from './relative-time-format.js';

/** `timezones` fallback — upstream `timezones = ["UTC"]` (relative-time-card.tsx:147). */
export const DEFAULT_TIMEZONES: readonly string[] = Object.freeze(['UTC']);

/** `updateInterval` fallback in ms — upstream `updateInterval = 1000` (line 160). */
export const DEFAULT_UPDATE_INTERVAL = 1000;

/** `openDelay` fallback in ms — upstream `openDelay = 500` (line 152). */
export const DEFAULT_OPEN_DELAY = 500;

/** `closeDelay` fallback in ms — upstream `closeDelay = 300` (line 153). */
export const DEFAULT_CLOSE_DELAY = 300;

/** Every value `variant` accepts, in upstream declaration order (lines 111-119). */
export const RELATIVE_TIME_CARD_VARIANTS = ['default', 'muted', 'ghost'] as const;

/** The visual style of the trigger. */
export type RelativeTimeCardVariant = (typeof RELATIVE_TIME_CARD_VARIANTS)[number];

/**
 * Normalise a possibly untyped runtime value to a known variant.
 * Anything outside {@link RELATIVE_TIME_CARD_VARIANTS} falls back to `"default"`.
 */
export function resolveRelativeTimeCardVariant(value?: string): RelativeTimeCardVariant {
	return (RELATIVE_TIME_CARD_VARIANTS as readonly string[]).includes(value ?? '')
		? (value as RelativeTimeCardVariant)
		: 'default';
}

/**
 * Upstream `triggerVariants` (lines 107-121), verbatim except `focus-visible:outline-none`, which
 * is dropped so the focus indicator is never suppressed (research R-12). The ring utilities it was
 * paired with are kept.
 */
export const relativeTimeCardTriggerVariants = tv({
	base: 'inline-flex w-fit items-center justify-center text-sm text-foreground/70 transition-colors hover:text-foreground/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
	variants: {
		variant: {
			default: '',
			muted: 'text-foreground/50 hover:text-foreground/70',
			ghost: 'hover:underline'
		}
	},
	defaultVariants: {
		variant: 'default'
	}
});

/**
 * Reactive inputs for {@link RelativeTimeCardState}. They arrive as getter functions so the class
 * keeps tracking the root's props instead of snapshotting them (CLAUDE.md §4).
 */
export type RelativeTimeCardStateProps = {
	/** The normalised instant the card describes. */
	getDate: () => Date;
	/** The locale every label is formatted in. */
	getLocale: () => string;
	/** How often, in ms, the relative label is recomputed. */
	getUpdateInterval: () => number;
};

/**
 * The only reactive state the component owns: *now*.
 *
 * Upstream keeps the formatted string in `useState` and rewrites it on every tick and on every
 * `date`/`updateInterval` change (relative-time-card.tsx:177-188). Here the string is `$derived`,
 * so a `date` change needs no effect at all and the ticker exists purely to move the clock
 * (research R-08).
 */
export class RelativeTimeCardState {
	// Assigned in the constructor. `$derived` field initialisers below are lazy, so none of them
	// reads this before it is set — the same shape `BannersState` uses.
	#props!: RelativeTimeCardStateProps;

	/** Epoch milliseconds the relative label is computed against. Written only by the ticker. */
	now = $state(Date.now());

	readonly date: Date = $derived(this.#props.getDate());
	readonly isValid: boolean = $derived(isValidDate(this.date));
	readonly isoString: string | undefined = $derived(toIsoString(this.date));
	readonly absoluteLabel: string = $derived(
		formatAbsoluteDateTime(this.date, this.#props.getLocale())
	);
	readonly relativeLabel: string = $derived(
		formatRelativeTimeAt(this.date, this.now, this.#props.getLocale())
	);

	constructor(props: RelativeTimeCardStateProps) {
		this.#props = props;
	}

	/**
	 * Start moving the clock. Reads **only** `getUpdateInterval()`, so the root's `$effect`
	 * re-subscribes when the cadence changes and not when `date` changes. The returned teardown is
	 * what the effect must return, and is the sole owner of the interval (FR-007).
	 */
	startTicker(): () => void {
		const interval = setInterval(() => {
			this.now = Date.now();
		}, this.#props.getUpdateInterval());

		return () => clearInterval(interval);
	}
}
