<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	export type ComboboxItemTextProps = WithElementRef<
		HTMLAttributes<HTMLSpanElement>,
		HTMLSpanElement
	> & {
		/** The item's visible text. Also the item's label when it has no explicit `label`. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { getComboboxItemContext } from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: ComboboxItemTextProps = $props();

	const item = getComboboxItemContext('<Combobox.ItemText>');

	// Upstream's `onItemLabelChange`: the item's label falls back to this element's text content.
	$effect(() => {
		item.labelElement = ref;
		return () => {
			item.labelElement = null;
		};
	});
</script>

<span
	bind:this={ref}
	id={item.textId}
	data-slot="combobox-item-text"
	{...restProps}
	class={cn('truncate', className)}
>
	{@render children?.()}
</span>
