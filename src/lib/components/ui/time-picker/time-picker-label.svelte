<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLLabelAttributes } from 'svelte/elements';

	/** The merged attribute payload handed to the `child` snippet. */
	export type TimePickerLabelChildProps = {
		'data-slot': 'time-picker-label';
		'data-disabled': '' | undefined;
		id: string;
		for: string;
		class: string;
	} & Record<string, unknown>;

	export type TimePickerLabelProps = WithElementRef<HTMLLabelAttributes, HTMLLabelElement> & {
		/** The label text. */
		children?: Snippet;
		/**
		 * Render the label onto your own element instead of the default `<label>`. The snippet
		 * receives the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild`. In `child` mode `ref` stays `null`.
		 */
		child?: Snippet<[{ props: TimePickerLabelChildProps }]>;
	};
</script>

<script lang="ts">
	import { getTimePickerContext } from './time-picker.svelte.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		child,
		...restProps
	}: TimePickerLabelProps = $props();

	const root = getTimePickerContext('<TimePicker.Label>');

	// Upstream sets `htmlFor={labelId}` and gives the label no `id` of its own, so the input group's
	// `aria-labelledby={labelId}` resolves to nothing and the group ends up with no accessible name.
	// Adding the `id` is the one-attribute fix, and `for` is re-pointed at the group it actually
	// labels (research R-19, divergence D-10).
	const labelAttrs = $derived({
		'data-slot': 'time-picker-label',
		'data-disabled': root.disabled ? '' : undefined,
		id: root.labelId,
		for: root.inputGroupId,
		...restProps,
		class: cn(
			'text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
			className
		)
	} as TimePickerLabelChildProps);
</script>

{#if child}
	{@render child({ props: labelAttrs })}
{:else}
	<label bind:this={ref} {...labelAttrs}>
		{@render children?.()}
	</label>
{/if}
