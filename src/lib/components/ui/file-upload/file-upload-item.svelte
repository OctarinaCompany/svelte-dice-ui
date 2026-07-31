<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	import type { FileUploadStatus } from './file-upload.svelte.js';

	/** The merged attribute payload handed to the `child` snippet. */
	export type FileUploadItemChildProps = {
		role: 'listitem';
		'data-slot': 'file-upload-item';
		'data-status': FileUploadStatus;
		dir: Direction;
		class: string;
	} & Record<string, unknown>;

	export type FileUploadItemProps = WithElementRef<
		Omit<HTMLAttributes<HTMLDivElement>, 'dir'>,
		HTMLDivElement
	> & {
		/** The file this item represents. Identity is the `File` reference itself. */
		value: File;
		/**
		 * Render the item onto your own element instead of the default `<div>`. The snippet receives
		 * the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild` (Radix `Slot`). In `child` mode `children` is not rendered and
		 * `ref` stays `null` — the caller owns the element, and is responsible for rendering the
		 * item's parts inside it.
		 */
		child?: Snippet<[{ props: FileUploadItemChildProps }]>;
		/** The content of the item. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import {
		FileUploadItemState,
		getFileUploadContext,
		setFileUploadItemContext
	} from './file-upload.svelte.js';

	let {
		ref = $bindable(null),
		value,
		class: className,
		child,
		children,
		...restProps
	}: FileUploadItemProps = $props();

	const root = getFileUploadContext('Item');

	const uid = $props.id();

	const item = setFileUploadItemContext(
		new FileUploadItemState({ root, getValue: () => value, id: uid })
	);

	const itemAttrs = $derived({
		role: 'listitem',
		id: item.id,
		'aria-setsize': root.count,
		'aria-posinset': item.index,
		'aria-labelledby': item.nameId,
		'aria-describedby': item.describedBy,
		'data-slot': 'file-upload-item',
		'data-status': item.fileState?.status ?? 'idle',
		dir: root.dir,
		...restProps,
		class: cn('relative flex items-center gap-2.5 rounded-md border p-3', className)
	} as FileUploadItemChildProps);
</script>

<!--
	The status text is always appended, so `aria-describedby` never dangles. In `child` mode the
	caller owns the element, so it renders as its sibling — an IDREF list does not care where the
	referenced element sits.
-->
{#snippet statusText()}
	<span id={item.statusId} class="sr-only">{item.statusText}</span>
{/snippet}

{#if item.fileState}
	{#if child}
		{@render child({ props: itemAttrs })}
		{@render statusText()}
	{:else}
		<div bind:this={ref} {...itemAttrs}>
			{@render children?.()}
			{@render statusText()}
		</div>
	{/if}
{/if}
