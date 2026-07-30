<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	/** The merged attribute payload handed to the `child` snippet. */
	export type TimePickerSeparatorChildProps = {
		'aria-hidden': 'true';
		'data-slot': 'time-picker-separator';
		class: string;
	} & Record<string, unknown>;

	export type TimePickerSeparatorProps = WithElementRef<
		HTMLAttributes<HTMLSpanElement>,
		HTMLSpanElement
	> & {
		/**
		 * The separator glyph.
		 *
		 * @default ":"
		 */
		children?: Snippet;
		/**
		 * Render the separator onto your own element instead of the default `<span>`. The snippet
		 * receives the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild`. In `child` mode `ref` stays `null`.
		 */
		child?: Snippet<[{ props: TimePickerSeparatorChildProps }]>;
	};
</script>

<script lang="ts">
	let {
		ref = $bindable(null),
		class: className,
		children,
		child,
		...restProps
	}: TimePickerSeparatorProps = $props();

	const separatorAttrs = $derived({
		'aria-hidden': 'true',
		'data-slot': 'time-picker-separator',
		...restProps,
		// Upstream ships the separator unstyled; the caller's class is still merged through `cn()` so
		// the part behaves like every other one.
		class: cn(className)
	} as TimePickerSeparatorChildProps);
</script>

{#if child}
	{@render child({ props: separatorAttrs })}
{:else}
	<span bind:this={ref} {...separatorAttrs}>
		{#if children}{@render children()}{:else}:{/if}
	</span>
{/if}
