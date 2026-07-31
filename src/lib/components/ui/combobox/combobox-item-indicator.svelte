<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	export type ComboboxItemIndicatorProps = WithElementRef<
		HTMLAttributes<HTMLSpanElement>,
		HTMLSpanElement
	> & {
		/**
		 * Whether to render the indicator even when the item is not selected.
		 *
		 * @default false
		 */
		forceMount?: boolean;
		/** The indicator's content. @default a `<Check>` icon */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';

	import { getComboboxItemContext } from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		forceMount = false,
		class: className,
		children,
		...restProps
	}: ComboboxItemIndicatorProps = $props();

	const item = getComboboxItemContext('<Combobox.ItemIndicator>');
</script>

{#if forceMount || item.isSelected}
	<span
		bind:this={ref}
		aria-hidden="true"
		data-slot="combobox-item-indicator"
		{...restProps}
		class={cn('absolute left-2 flex size-3.5 items-center justify-center', className)}
	>
		{#if children}
			{@render children()}
		{:else}
			<CheckIcon class="size-4" />
		{/if}
	</span>
{/if}
