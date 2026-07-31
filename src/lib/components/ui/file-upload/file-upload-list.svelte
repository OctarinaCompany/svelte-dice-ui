<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	export type FileUploadListOrientation = 'horizontal' | 'vertical';

	/** The merged attribute payload handed to the `child` snippet. */
	export type FileUploadListChildProps = {
		role: 'list';
		'data-slot': 'file-upload-list';
		'data-orientation': FileUploadListOrientation;
		'data-state': 'active' | 'inactive';
		dir: Direction;
		class: string;
	} & Record<string, unknown>;

	export type FileUploadListProps = WithElementRef<
		Omit<HTMLAttributes<HTMLDivElement>, 'dir'>,
		HTMLDivElement
	> & {
		/**
		 * The layout direction of the list.
		 *
		 * @default "vertical"
		 */
		orientation?: FileUploadListOrientation;
		/**
		 * Whether the list should always be rendered, even with no files.
		 *
		 * Can be used to animate the enter and exit of the list.
		 *
		 * @default false
		 */
		forceMount?: boolean;
		/**
		 * Render the list onto your own element instead of the default `<div>`. The snippet receives
		 * the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild` (Radix `Slot`). In `child` mode `children` is not rendered and
		 * `ref` stays `null` — the caller owns the element.
		 */
		child?: Snippet<[{ props: FileUploadListChildProps }]>;
		/** The items of the list. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { getFileUploadContext } from './file-upload.svelte.js';

	let {
		ref = $bindable(null),
		orientation = 'vertical',
		forceMount = false,
		class: className,
		child,
		children,
		...restProps
	}: FileUploadListProps = $props();

	const root = getFileUploadContext('List');

	const present = $derived(forceMount || root.count > 0);

	const listAttrs = $derived({
		role: 'list',
		id: root.listId,
		'aria-orientation': orientation,
		'data-slot': 'file-upload-list',
		'data-orientation': orientation,
		// Upstream writes `shouldRender ? "active" : "inactive"`, which can only ever be `"active"`;
		// `inactive` is what a list mounted purely by `forceMount` needs so an exit animation has
		// something to key off (contracts §2).
		'data-state': root.count > 0 ? 'active' : 'inactive',
		dir: root.dir,
		...restProps,
		class: cn(
			'flex flex-col gap-2 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-top-2 data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=inactive]:slide-out-to-top-2',
			orientation === 'horizontal' && 'flex-row overflow-x-auto p-1.5',
			className
		)
	} as FileUploadListChildProps);
</script>

{#if present}
	{#if child}
		{@render child({ props: listAttrs })}
	{:else}
		<div bind:this={ref} {...listAttrs}>
			{@render children?.()}
		</div>
	{/if}
{/if}
