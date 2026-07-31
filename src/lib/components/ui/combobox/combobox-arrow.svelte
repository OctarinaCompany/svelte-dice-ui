<script lang="ts" module>
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { SVGAttributes } from 'svelte/elements';

	export type ComboboxArrowProps = SVGAttributes<SVGSVGElement> & {
		/** The rendered `<svg>`. */
		ref?: SVGSVGElement | null;
		/**
		 * The width of the arrow in pixels.
		 *
		 * @default 10
		 */
		width?: number;
		/**
		 * The height of the arrow in pixels.
		 *
		 * @default 5
		 */
		height?: number;
		/** The arrow's shape. @default a triangle pointing at the anchor */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';

	import { getComboboxContentContext, getComboboxContext } from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		width = 10,
		height = 5,
		class: className,
		children,
		...restProps
	}: ComboboxArrowProps = $props();

	const root = getComboboxContext('<Combobox.Arrow>');
	const content = getComboboxContentContext('<Combobox.Arrow>');
</script>

{#if root.open}
	<PopoverPrimitive.Arrow {width} {height}>
		<svg
			bind:this={ref}
			{width}
			{height}
			viewBox="0 0 30 10"
			preserveAspectRatio="none"
			aria-hidden="true"
			data-slot="combobox-arrow"
			data-side={content.side}
			data-align={content.align}
			data-state={root.dataState}
			{...restProps}
			class={cn('block fill-popover', className)}
		>
			{#if children}
				{@render children()}
			{:else}
				<path d="M0 10 L15 0 L30 10" fill="currentColor" />
			{/if}
		</svg>
	</PopoverPrimitive.Arrow>
{/if}
