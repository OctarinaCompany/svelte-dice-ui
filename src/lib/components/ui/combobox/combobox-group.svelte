<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	export type ComboboxGroupProps = WithElementRef<
		HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & {
		/**
		 * Whether to render the group even when filtering has hidden every item in it.
		 *
		 * @default false
		 */
		forceMount?: boolean;
		/** Normally a `<Combobox.GroupLabel>` and the group's `<Combobox.Item>`s. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import {
		ComboboxGroupState,
		getComboboxContext,
		setComboboxGroupContext
	} from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		forceMount = false,
		class: className,
		children,
		...restProps
	}: ComboboxGroupProps = $props();

	const root = getComboboxContext('<Combobox.Group>');

	const groupId = $props.id();

	const group = setComboboxGroupContext(
		new ComboboxGroupState({ id: groupId, getForceMount: () => forceMount })
	);

	// Upstream `<ComboboxGroup>` (`combobox-group.tsx:38-41`): a group with no surviving item drops
	// out of the list while a search is active, and comes back when the search clears.
	const isVisible = $derived(root.isGroupVisible(groupId, forceMount));
</script>

<!--
	Hidden rather than unmounted (a recorded divergence from upstream's `return null`): the group's
	own visibility is derived from whether any of *its* items survived the filter, so unmounting the
	children would unregister exactly the items the next pass needs to see and the group could never
	come back. `hidden` keeps them registered while taking the group out of both the layout and the
	accessibility tree, which is the same thing a user observes.
-->
<div
	bind:this={ref}
	role="group"
	id={groupId}
	aria-labelledby={group.labelId}
	data-slot="combobox-group"
	data-hidden={isVisible ? undefined : ''}
	hidden={!isVisible}
	aria-hidden={isVisible ? undefined : 'true'}
	{...restProps}
	class={cn('overflow-hidden', className)}
>
	{@render children?.()}
</div>
