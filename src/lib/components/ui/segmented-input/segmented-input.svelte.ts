import { getContext, hasContext, setContext } from 'svelte';
import { tv } from 'tailwind-variants';

import type { Direction } from '$lib/components/ui/direction-provider/index.js';

import { SegmentNavigation } from './segment-navigation.svelte.js';

/** Every value `size` accepts, in upstream declaration order. */
export const SEGMENTED_INPUT_SIZES = ['default', 'sm', 'lg'] as const;

/** `'default' | 'sm' | 'lg'` — upstream `Size` (radix/ui/segmented-input.tsx:17). */
export type SegmentedInputSize = (typeof SEGMENTED_INPUT_SIZES)[number];

/** Every value `orientation` accepts, in upstream declaration order. */
export const SEGMENTED_INPUT_ORIENTATIONS = ['horizontal', 'vertical'] as const;

/** `'horizontal' | 'vertical'` — the same tuple `SegmentOrientation` names. */
export type SegmentedInputOrientation = (typeof SEGMENTED_INPUT_ORIENTATIONS)[number];

/**
 * Upstream `segmentedInputItemVariants` (radix/ui/segmented-input.tsx:128-168), translated from
 * `cva` to `tv()`, with two deliberate corrections:
 *
 * - **Logical borders (D-06).** Upstream mixes logical and physical properties in one rule
 *   (`-ms-px … border-l-0`), so under `dir="rtl"` every seam renders a doubled border and the
 *   leading edge loses its own. `border-s-0`/`border-s` is the same result in LTR and the intended
 *   one in RTL (research R-07).
 * - **`rounded-*-lg` (D-05).** This repo's `Input` uses `rounded-lg` where upstream's uses
 *   `rounded-md`, so the vertical compounds that *restore* a corner must restore it at the group's
 *   own radius.
 *
 * Colour, focus and invalid styling all come from the composed `Input`; these variants add geometry
 * only (Principle VIII).
 */
export const segmentedInputItemVariants = tv({
	base: '',
	variants: {
		position: {
			isolated: '',
			first: 'rounded-e-none',
			middle: '-ms-px rounded-none border-s-0',
			last: '-ms-px rounded-s-none border-s-0'
		},
		orientation: {
			horizontal: '',
			vertical: ''
		},
		size: {
			sm: 'h-8 px-2 text-xs',
			default: 'h-9 px-3',
			lg: 'h-11 px-4'
		}
	},
	compoundVariants: [
		{
			position: 'first',
			orientation: 'vertical',
			class: 'ms-0 rounded-e-lg rounded-b-none border-s'
		},
		{
			position: 'middle',
			orientation: 'vertical',
			class: 'ms-0 -mt-px rounded-none border-t-0 border-s'
		},
		{
			position: 'last',
			orientation: 'vertical',
			class: 'ms-0 -mt-px rounded-s-lg rounded-t-none border-t-0 border-s'
		}
	],
	defaultVariants: {
		position: 'isolated',
		orientation: 'horizontal',
		size: 'default'
	}
});

export type SegmentedInputRootStateProps = {
	readonly getDir: () => Direction;
	readonly getOrientation: () => SegmentedInputOrientation;
	readonly getSize: () => SegmentedInputSize;
	readonly getDisabled: () => boolean;
	readonly getInvalid: () => boolean;
	readonly getRequired: () => boolean;
};

/**
 * One instance per `<SegmentedInput.Root>`, published on context.
 *
 * Replaces upstream's `SegmentedInputContextValue` + `React.useMemo`
 * (radix/ui/segmented-input.tsx:20-38, 66-76): a state class with `$derived` fields has no
 * re-render to skip, so the memo is dropped (research R-15). Reactive inputs arrive as getter
 * functions rather than snapshots (`CLAUDE.md` §4).
 */
export class SegmentedInputRootState {
	// $derived below is lazy at runtime (evaluated only when the field is read), but svelte-check's
	// static analysis cannot see that and flags the field as used before its constructor assignment.
	#props!: SegmentedInputRootStateProps;

	readonly dir: Direction = $derived(this.#props.getDir());
	readonly orientation: SegmentedInputOrientation = $derived(this.#props.getOrientation());
	readonly size: SegmentedInputSize = $derived(this.#props.getSize());
	readonly disabled: boolean = $derived(this.#props.getDisabled());
	readonly invalid: boolean = $derived(this.#props.getInvalid());
	readonly required: boolean = $derived(this.#props.getRequired());

	/**
	 * The registry every item joins, and the behaviour Time Picker reuses (FR-015). Never published
	 * on its own context key, so an unattached instance is always constructible.
	 */
	readonly nav: SegmentNavigation;

	constructor(props: SegmentedInputRootStateProps) {
		this.#props = props;
		this.nav = new SegmentNavigation({
			getOrientation: () => this.orientation,
			getDir: () => this.dir
		});
	}

	/** An item's own `disabled` wins, including an explicit `false` against a disabled group. */
	resolveDisabled(own: boolean | undefined): boolean {
		return own ?? this.disabled;
	}

	/** Same inheritance rule as {@link resolveDisabled}. `invalid` has none — upstream offers no override. */
	resolveRequired(own: boolean | undefined): boolean {
		return own ?? this.required;
	}
}

const SEGMENTED_INPUT_CONTEXT_KEY = Symbol('segmented-input');

export function setSegmentedInputContext(state: SegmentedInputRootState): SegmentedInputRootState {
	return setContext(SEGMENTED_INPUT_CONTEXT_KEY, state);
}

export function hasSegmentedInputContext(): boolean {
	return hasContext(SEGMENTED_INPUT_CONTEXT_KEY);
}

/** Read the group's state, throwing when there is no `<SegmentedInput.Root>` ancestor. */
export function getSegmentedInputContext(
	consumerName = '<SegmentedInput.Item>'
): SegmentedInputRootState {
	if (!hasSegmentedInputContext()) {
		throw new Error(`\`${consumerName}\` must be used within \`<SegmentedInput.Root>\`.`);
	}
	return getContext<SegmentedInputRootState>(SEGMENTED_INPUT_CONTEXT_KEY);
}
