import { getContext, hasContext, setContext } from 'svelte';

/** Every value {@link ProgressState} accepts, in upstream declaration order. */
export const PROGRESS_STATES = ['indeterminate', 'complete', 'loading'] as const;

/** The classification of the current reading, derived from `value`/`max`. */
export type ProgressState = (typeof PROGRESS_STATES)[number];

/** `min` fallback when the `min` prop is not a finite number. */
export const DEFAULT_MIN = 0;
/** `max` fallback when the `max` prop is not a finite number greater than 0. */
export const DEFAULT_MAX = 100;
/** `size` fallback in pixels. */
export const DEFAULT_SIZE = 48;
/** `thickness` fallback in pixels. */
export const DEFAULT_THICKNESS = 4;

/** `{ radius, center, circumference }` derived from `size`/`thickness`. */
export type RingGeometry = {
	radius: number;
	center: number;
	circumference: number;
};

/** Upstream `getIsValidNumber`. */
export function isValidNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

/** Upstream `getIsValidMaxNumber`. */
export function isValidMaxNumber(value: unknown): value is number {
	return isValidNumber(value) && value > 0;
}

/** Upstream `getIsValidValueNumber`. */
export function isValidValueNumber(value: unknown, min: number, max: number): value is number {
	return isValidNumber(value) && value <= max && value >= min;
}

/** `value == null ⇒ indeterminate`; `value === max ⇒ complete`; else `loading`. */
export function getProgressState(value: number | null, max: number): ProgressState {
	return value == null ? 'indeterminate' : value === max ? 'complete' : 'loading';
}

/** `` `${Math.round(percentage)}%` ``, upstream verbatim including the `max === min` branch. */
export function getDefaultValueText(value: number, min: number, max: number): string {
	const percentage = max === min ? 100 : ((value - min) / (max - min)) * 100;
	return `${Math.round(percentage)}%`;
}

/**
 * FR-008: resolves the effective `{ min, max }`, guaranteeing `max > min`.
 * A non-finite `min` falls back to {@link DEFAULT_MIN}; a non-finite or non-positive `max` falls
 * back to {@link DEFAULT_MAX}; and a resolved `max <= min` is corrected to `min + 1`.
 */
export function resolveProgressBounds(
	minProp: unknown,
	maxProp: unknown
): { min: number; max: number } {
	const min = isValidNumber(minProp) ? minProp : DEFAULT_MIN;
	const rawMax = isValidMaxNumber(maxProp) ? maxProp : DEFAULT_MAX;
	const max = rawMax <= min ? min + 1 : rawMax;
	return { min, max };
}

/**
 * FR-007: clamps `value` into `[min, max]`. Non-finite/`null`/`undefined` resolves to `null`
 * (indeterminate).
 */
export function clampProgressValue(
	value: number | null | undefined,
	min: number,
	max: number
): number | null {
	if (isValidValueNumber(value, min, max)) return value;
	if (isValidNumber(value) && value > max) return max;
	if (isValidNumber(value) && value < min) return min;
	return null;
}

/** `null` for an indeterminate `value`; `max === min ⇒ 1`; else a decimal in `[0, 1]`. */
export function getProgressPercentage(
	value: number | null,
	min: number,
	max: number
): number | null {
	if (value === null) return null;
	return max === min ? 1 : (value - min) / (max - min);
}

/**
 * `radius = max(0, (size - thickness) / 2)`, `center = size / 2`,
 * `circumference = 2 * PI * radius`.
 */
export function getRingGeometry(size: number, thickness: number): RingGeometry {
	const radius = Math.max(0, (size - thickness) / 2);
	const center = size / 2;
	const circumference = 2 * Math.PI * radius;
	return { radius, center, circumference };
}

type CircularProgressStateProps = {
	readonly getValue: () => number | null | undefined;
	readonly getGetValueText: () => (value: number, min: number, max: number) => string;
	readonly getMin: () => number;
	readonly getMax: () => number;
	readonly getSize: () => number;
	readonly getThickness: () => number;
	readonly getValueTextId: () => string;
};

/** One instance per `<CircularProgress.Root>`. Published on context; every part reads it. */
export class CircularProgressState {
	// $derived below is lazy at runtime (evaluated only when a member is read), but svelte-check's
	// static analysis cannot see that and flags the field as used before its constructor assignment.
	#props!: CircularProgressStateProps;

	readonly #bounds = $derived(resolveProgressBounds(this.#props.getMin(), this.#props.getMax()));
	readonly min: number = $derived(this.#bounds.min);
	readonly max: number = $derived(this.#bounds.max);
	readonly value: number | null = $derived(
		clampProgressValue(this.#props.getValue(), this.min, this.max)
	);
	readonly percentage: number | null = $derived(
		getProgressPercentage(this.value, this.min, this.max)
	);
	readonly state: ProgressState = $derived(getProgressState(this.value, this.max));
	readonly valueText: string | undefined = $derived(
		this.value === null ? undefined : this.#props.getGetValueText()(this.value, this.min, this.max)
	);
	readonly size: number = $derived(this.#props.getSize());
	readonly thickness: number = $derived(this.#props.getThickness());
	readonly #geometry = $derived(getRingGeometry(this.size, this.thickness));
	readonly radius: number = $derived(this.#geometry.radius);
	readonly center: number = $derived(this.#geometry.center);
	readonly circumference: number = $derived(this.#geometry.circumference);
	readonly valueTextId: string = $derived(this.#props.getValueTextId());
	readonly strokeDasharray: number = $derived(this.circumference);
	readonly strokeDashoffset: number = $derived(
		this.state === 'indeterminate'
			? this.circumference * 0.75
			: this.percentage !== null
				? this.circumference - this.percentage * this.circumference
				: this.circumference
	);

	constructor(props: CircularProgressStateProps) {
		this.#props = props;
	}
}

const CIRCULAR_PROGRESS_CONTEXT_KEY = Symbol('circular-progress');

export function setCircularProgressContext(state: CircularProgressState): CircularProgressState {
	return setContext(CIRCULAR_PROGRESS_CONTEXT_KEY, state);
}

export function hasCircularProgressContext(): boolean {
	return hasContext(CIRCULAR_PROGRESS_CONTEXT_KEY);
}

export function getCircularProgressContext(consumerName?: string): CircularProgressState {
	if (!hasCircularProgressContext()) {
		const label = consumerName ? `\`<${consumerName}>\`` : '`<CircularProgress>` part';
		throw new Error(`${label} must be used within \`<CircularProgress>\`.`);
	}
	return getContext<CircularProgressState>(CIRCULAR_PROGRESS_CONTEXT_KEY);
}
