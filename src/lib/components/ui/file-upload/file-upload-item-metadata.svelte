<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	export type FileUploadItemMetadataSize = 'default' | 'sm';

	/** The merged attribute payload handed to the `child` snippet. */
	export type FileUploadItemMetadataChildProps = {
		'data-slot': 'file-upload-metadata';
		dir: Direction;
		class: string;
	} & Record<string, unknown>;

	export type FileUploadItemMetadataProps = WithElementRef<
		Omit<HTMLAttributes<HTMLDivElement>, 'dir'>,
		HTMLDivElement
	> & {
		/**
		 * Typography scale of the default name/size/error trio.
		 *
		 * @default "default"
		 */
		size?: FileUploadItemMetadataSize;
		/**
		 * Render the metadata onto your own element instead of the default `<div>`. The snippet
		 * receives the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild` (Radix `Slot`). In `child` mode `children` is not rendered and
		 * `ref` stays `null` — the caller owns the element.
		 */
		child?: Snippet<[{ props: FileUploadItemMetadataChildProps }]>;
		/** Replaces the default name/size/error trio entirely. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { formatBytes, getFileUploadItemContext } from './file-upload.svelte.js';

	let {
		ref = $bindable(null),
		size = 'default',
		class: className,
		child,
		children,
		...restProps
	}: FileUploadItemMetadataProps = $props();

	const item = getFileUploadItemContext('ItemMetadata');

	const metadataAttrs = $derived({
		'data-slot': 'file-upload-metadata',
		dir: item.root.dir,
		...restProps,
		class: cn('flex min-w-0 flex-1 flex-col', className)
	} as FileUploadItemMetadataChildProps);
</script>

{#if item.fileState}
	{@const fileState = item.fileState}
	{#if child}
		{@render child({ props: metadataAttrs })}
	{:else}
		<div bind:this={ref} {...metadataAttrs}>
			{#if children}
				{@render children()}
			{:else}
				<span
					id={item.nameId}
					class={cn(
						'truncate text-sm font-medium',
						size === 'sm' && 'text-[13px] leading-snug font-normal'
					)}
				>
					{fileState.file.name}
				</span>
				<span
					id={item.sizeId}
					class={cn(
						'truncate text-xs text-muted-foreground',
						size === 'sm' && 'text-[11px] leading-snug'
					)}
				>
					{formatBytes(fileState.file.size)}
				</span>
				{#if fileState.error}
					<span id={item.messageId} class="text-xs text-destructive">{fileState.error}</span>
				{/if}
			{/if}
		</div>
	{/if}
{/if}
