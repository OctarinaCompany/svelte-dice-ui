<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	/** The three states upstream's `useProgress` reports. */
	export type ComboboxProgressState = 'indeterminate' | 'loading' | 'complete';

	export type ComboboxLoadingProps = WithElementRef<
		HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & {
		/**
		 * The current progress value. `null` — or anything outside `0…max` — is indeterminate.
		 *
		 * @default null
		 */
		value?: number | null;
		/**
		 * The maximum progress value. A non-positive or `NaN` value degrades to `100`.
		 *
		 * @default 100
		 */
		max?: number;
		/** The accessible label for the progress bar. */
		label?: string;
		/** The loading message. */
		children?: Snippet;
	};

	/** Upstream `isValidMaxNumber` (`use-progress.ts:9-11`). */
	export function isValidProgressMax(max: unknown): max is number {
		return typeof max === 'number' && !Number.isNaN(max) && max > 0;
	}

	/** Upstream `isValidValueNumber` (`use-progress.ts:13-15`). */
	export function isValidProgressValue(value: unknown, max: number): value is number {
		return typeof value === 'number' && !Number.isNaN(value) && value <= max && value >= 0;
	}

	/** Upstream `getProgressState` (`use-progress.ts:17-26`). */
	export function getProgressState(value: number | null, max: number): ComboboxProgressState {
		if (value === null) return 'indeterminate';
		return value === max ? 'complete' : 'loading';
	}
</script>

<script lang="ts">
	import { getComboboxContext } from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		value = null,
		max = 100,
		label,
		class: className,
		children,
		...restProps
	}: ComboboxLoadingProps = $props();

	const root = getComboboxContext('<Combobox.Loading>');

	const resolvedMax = $derived(isValidProgressMax(max) ? max : 100);
	const resolvedValue = $derived(isValidProgressValue(value, resolvedMax) ? value : null);
	const state = $derived(getProgressState(resolvedValue, resolvedMax));
</script>

{#if root.open && state !== 'complete'}
	<div
		bind:this={ref}
		role="progressbar"
		aria-label={label}
		aria-valuemin={0}
		aria-valuemax={resolvedMax}
		aria-valuenow={resolvedValue ?? undefined}
		data-slot="combobox-loading"
		data-state={state}
		data-value={resolvedValue ?? undefined}
		data-max={resolvedMax}
		{...restProps}
		class={cn('py-6 text-center text-sm', className)}
	>
		{@render children?.()}
	</div>
{/if}
