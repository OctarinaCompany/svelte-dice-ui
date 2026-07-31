<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	import type { ComboboxOrientation } from './combobox.svelte.js';

	export type ComboboxBadgeListProps = WithElementRef<
		HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & {
		/**
		 * Whether to render the badge list even when nothing is selected.
		 *
		 * @default false
		 */
		forceMount?: boolean;
		/**
		 * The orientation of the badge list.
		 *
		 * @default "horizontal"
		 */
		orientation?: ComboboxOrientation;
		/** Normally one `<Combobox.BadgeItem>` per selected value. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import {
		ComboboxBadgeListState,
		getComboboxContext,
		setComboboxBadgeListContext
	} from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		forceMount = false,
		orientation = 'horizontal',
		class: className,
		children,
		...restProps
	}: ComboboxBadgeListProps = $props();

	const root = getComboboxContext('<Combobox.BadgeList>');

	setComboboxBadgeListContext(
		new ComboboxBadgeListState({ root, getOrientation: () => orientation })
	);

	const isVisible = $derived(forceMount || (root.multiple && root.values.length > 0));

	// A mounted badge list is what enables badge keyboard navigation in the input — upstream's
	// `onHasBadgeListChange` on the element ref.
	$effect(() => {
		if (!isVisible) return;

		root.hasBadgeList = true;
		return () => {
			root.hasBadgeList = false;
		};
	});
</script>

{#if isVisible}
	<div
		bind:this={ref}
		role="listbox"
		aria-multiselectable={root.multiple}
		aria-orientation={orientation}
		data-slot="combobox-badge-list"
		data-orientation={orientation}
		{...restProps}
		class={cn(
			'flex items-center gap-1.5',
			orientation === 'vertical' ? 'flex-col items-stretch' : 'flex-wrap',
			className
		)}
	>
		{@render children?.()}
	</div>
{/if}
