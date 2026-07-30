<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import type { HTMLAttributes } from 'svelte/elements';

	/** The merged attribute payload handed to the `child` snippet. */
	export type TimePickerColumnChildProps = {
		'data-slot': string;
		class: string;
		// The symbol slot carries the attachment that joins the panel's column registry, so a
		// `child`-rendered column still takes part in cross-column navigation.
	} & Record<string, unknown> &
		Record<symbol, Attachment<HTMLElement>>;

	export type TimePickerColumnProps = WithElementRef<
		HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & {
		/** The column's items. */
		children?: Snippet;
		/**
		 * Render the column onto your own element instead of the default `<div>`. The snippet
		 * receives the merged props to spread onto that element.
		 *
		 * In `child` mode `ref` stays `null`; the props carry the registration attachment instead.
		 */
		child?: Snippet<[{ props: TimePickerColumnChildProps }]>;
	};
</script>

<script lang="ts">
	import { DomOrderedCollection } from '$lib/components/ui/speed-dial/speed-dial-collection.svelte.js';
	import { createAttachmentKey } from 'svelte/attachments';

	import type { ColumnItemMeta } from './column-navigation.svelte.js';
	import { getTimePickerContentContext, setTimePickerColumnContext } from './time-picker.svelte.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		child,
		...restProps
	}: TimePickerColumnProps = $props();

	const nav = getTimePickerContentContext('<TimePicker.Column>');

	const id = $props.id();

	/** This column's own item registry, republished on context so items self-register into it. */
	const items = new DomOrderedCollection<ColumnItemMeta>();

	setTimePickerColumnContext({ id, items });

	const attach = createAttachmentKey();

	function registerColumn(element: Element) {
		if (!(element instanceof HTMLElement)) return;

		nav.registerColumn(id, element, { getItems: () => items.ordered });

		return () => nav.unregisterColumn(id);
	}

	const columnAttrs = $derived({
		'data-slot': 'time-picker-column',
		...restProps,
		[attach]: registerColumn,
		// `border-e` rather than upstream's `border-r`: identical in LTR, and the seam lands on the
		// right side of the column under `dir="rtl"` too — the same logical-property correction
		// `segmented-input` made (its divergence D-06).
		class: cn('flex flex-col gap-1 p-1 not-last:border-e', className)
	} as TimePickerColumnChildProps);
</script>

{#if child}
	{@render child({ props: columnAttrs })}
{:else}
	<div bind:this={ref} {...columnAttrs}>
		{@render children?.()}
	</div>
{/if}
