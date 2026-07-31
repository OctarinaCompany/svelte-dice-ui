<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	/** The merged attribute payload handed to the `child` snippet. */
	export type FileUploadItemPreviewChildProps = {
		'data-slot': 'file-upload-preview';
		class: string;
	} & Record<string, unknown>;

	export type FileUploadItemPreviewProps = WithElementRef<
		HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & {
		/**
		 * Replace or decorate the default preview.
		 *
		 * Upstream's signature is `(file, fallback: () => ReactNode) => ReactNode`; a Svelte snippet
		 * cannot return a value, so the callback becomes a snippet and the `fallback` thunk becomes a
		 * nested snippet the caller renders with `{@render fallback()}` to keep the default output
		 * (research R-07).
		 */
		render?: Snippet<[{ file: File; fallback: Snippet }]>;
		/**
		 * Render the preview onto your own element instead of the default `<div>`. The snippet
		 * receives the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild` (Radix `Slot`). In `child` mode `children` and `render` are not
		 * rendered and `ref` stays `null` — the caller owns the element.
		 */
		child?: Snippet<[{ props: FileUploadItemPreviewChildProps }]>;
		/** Extra content rendered *after* the preview, as upstream does — where circular progress goes. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { getFileUploadItemContext, getFileIcon } from './file-upload.svelte.js';

	let {
		ref = $bindable(null),
		render,
		class: className,
		child,
		children,
		...restProps
	}: FileUploadItemPreviewProps = $props();

	const item = getFileUploadItemContext('ItemPreview');

	const isImage = $derived(item.fileState?.file.type.startsWith('image/') ?? false);

	const previewAttrs = $derived({
		'aria-labelledby': item.nameId,
		'data-slot': 'file-upload-preview',
		...restProps,
		class: cn(
			'relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded border bg-accent/50 [&>svg]:size-10',
			className
		)
	} as FileUploadItemPreviewChildProps);
</script>

{#snippet fallback(file: File)}
	{#if isImage}
		<img src={item.root.getPreviewUrl(file)} alt={file.name} class="size-full object-cover" />
	{:else}
		{@const Icon = getFileIcon(file)}
		<Icon />
	{/if}
{/snippet}

{#if item.fileState}
	{@const file = item.fileState.file}
	{#if child}
		{@render child({ props: previewAttrs })}
	{:else}
		<div bind:this={ref} {...previewAttrs}>
			{#if render}
				{#snippet defaultPreview()}
					{@render fallback(file)}
				{/snippet}
				{@render render({ file, fallback: defaultPreview })}
			{:else}
				{@render fallback(file)}
			{/if}
			{@render children?.()}
		</div>
	{/if}
{/if}
