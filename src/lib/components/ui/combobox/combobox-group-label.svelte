<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	export type ComboboxGroupLabelProps = WithElementRef<
		HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & {
		/** The group's heading text. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { getComboboxGroupContext } from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: ComboboxGroupLabelProps = $props();

	const group = getComboboxGroupContext('<Combobox.GroupLabel>');
</script>

<div
	bind:this={ref}
	id={group.labelId}
	data-slot="combobox-group-label"
	{...restProps}
	class={cn('px-2 py-1.5 text-xs font-semibold text-muted-foreground', className)}
>
	{@render children?.()}
</div>
