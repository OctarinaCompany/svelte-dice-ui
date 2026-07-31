<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	/** The merged attribute payload handed to the `child` snippet. */
	export type FileUploadItemDeleteChildProps = {
		type: 'button';
		'data-slot': 'file-upload-item-delete';
		class: string;
	} & Record<string, unknown>;

	export type FileUploadItemDeleteProps = WithElementRef<
		Omit<HTMLButtonAttributes, 'type'>,
		HTMLButtonElement
	> & {
		/**
		 * Render the delete button onto your own element instead of the default `<button>`. The snippet
		 * receives the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild` (Radix `Slot`). In `child` mode `children` is not rendered and
		 * `ref` stays `null` — the caller owns the element.
		 */
		child?: Snippet<[{ props: FileUploadItemDeleteChildProps }]>;
		/** The button's content. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { getFileUploadItemContext } from './file-upload.svelte.js';

	let {
		ref = $bindable(null),
		onclick: onclickProp,
		class: className,
		child,
		children,
		...restProps
	}: FileUploadItemDeleteProps = $props();

	const item = getFileUploadItemContext('ItemDelete');

	function onclick(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		onclickProp?.(event);
		if (event.defaultPrevented) return;

		item.remove();
	}

	const deleteAttrs = $derived({
		type: 'button',
		'aria-controls': item.id,
		'aria-describedby': item.nameId,
		'data-slot': 'file-upload-item-delete',
		...restProps,
		class: cn(className),
		onclick
	} as FileUploadItemDeleteChildProps);
</script>

{#if item.fileState}
	{#if child}
		{@render child({ props: deleteAttrs })}
	{:else}
		<button bind:this={ref} {...deleteAttrs}>
			{@render children?.()}
		</button>
	{/if}
{/if}
