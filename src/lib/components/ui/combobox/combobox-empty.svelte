<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	export type ComboboxEmptyProps = WithElementRef<
		HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & {
		/**
		 * Whether to render the empty state even while items are visible. Useful for
		 * `manualFiltering` comboboxes that decide emptiness themselves.
		 *
		 * @default false
		 */
		keepVisible?: boolean;
		/** The empty message. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { getComboboxContext } from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		keepVisible = false,
		class: className,
		children,
		...restProps
	}: ComboboxEmptyProps = $props();

	const root = getComboboxContext('<Combobox.Empty>');

	const isVisible = $derived(root.open && root.isListEmpty(keepVisible));
</script>

{#if isVisible}
	<div
		bind:this={ref}
		role="status"
		aria-live="polite"
		aria-atomic="true"
		data-slot="combobox-empty"
		data-state="empty"
		{...restProps}
		class={cn('py-6 text-center text-sm', className)}
	>
		{@render children?.()}
	</div>
{/if}
