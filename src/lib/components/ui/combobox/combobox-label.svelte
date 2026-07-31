<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLLabelAttributes } from 'svelte/elements';

	export type ComboboxLabelProps = WithElementRef<HTMLLabelAttributes, HTMLLabelElement> & {
		/** The label text. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { getComboboxContext } from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: ComboboxLabelProps = $props();

	const root = getComboboxContext('<Combobox.Label>');
</script>

<label
	bind:this={ref}
	id={root.labelId}
	for={root.inputId}
	data-slot="combobox-label"
	{...restProps}
	class={cn('px-0.5 py-1.5 text-sm font-semibold', className)}
>
	{@render children?.()}
</label>
