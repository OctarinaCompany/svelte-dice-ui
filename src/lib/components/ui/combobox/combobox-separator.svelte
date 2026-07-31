<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	export type ComboboxSeparatorProps = WithElementRef<
		HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & {
		/**
		 * Whether the separator stays visible while a search is active.
		 *
		 * @default false
		 */
		keepVisible?: boolean;
		/** Rarely used — the separator is normally an empty rule. */
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
	}: ComboboxSeparatorProps = $props();

	const root = getComboboxContext('<Combobox.Separator>');

	const isVisible = $derived(keepVisible || root.search === '');
</script>

{#if isVisible}
	<div
		bind:this={ref}
		role="separator"
		aria-hidden="true"
		data-slot="combobox-separator"
		{...restProps}
		class={cn('-mx-1 my-1 h-px bg-muted', className)}
	>
		{@render children?.()}
	</div>
{/if}
