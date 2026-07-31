<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	/** The merged attribute payload handed to the `child` snippet. */
	export type FileUploadClearChildProps = {
		type: 'button';
		'data-slot': 'file-upload-clear';
		'data-disabled': '' | undefined;
		disabled: boolean;
		class: string;
	} & Record<string, unknown>;

	export type FileUploadClearProps = WithElementRef<
		Omit<HTMLButtonAttributes, 'type'>,
		HTMLButtonElement
	> & {
		/**
		 * Whether the clear button should always be rendered.
		 *
		 * Can be used to animate the enter and exit of the clear button.
		 *
		 * @default false
		 */
		forceMount?: boolean;
		/**
		 * Disables the clear button on its own; OR-ed with the root's `disabled`.
		 *
		 * @default false
		 */
		disabled?: boolean;
		/**
		 * Render the clear button onto your own element instead of the default `<button>`. The snippet
		 * receives the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild` (Radix `Slot`). In `child` mode `children` is not rendered and
		 * `ref` stays `null` — the caller owns the element.
		 */
		child?: Snippet<[{ props: FileUploadClearChildProps }]>;
		/** The button's content. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { getFileUploadContext } from './file-upload.svelte.js';

	let {
		ref = $bindable(null),
		forceMount = false,
		disabled = false,
		onclick: onclickProp,
		class: className,
		child,
		children,
		...restProps
	}: FileUploadClearProps = $props();

	const root = getFileUploadContext('Clear');

	const isDisabled = $derived(disabled || root.disabled);

	function onclick(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		onclickProp?.(event);
		if (event.defaultPrevented) return;

		root.clear();
	}

	const present = $derived(forceMount || root.count > 0);

	const clearAttrs = $derived({
		type: 'button',
		'aria-controls': root.listId,
		'data-slot': 'file-upload-clear',
		'data-disabled': isDisabled ? '' : undefined,
		...restProps,
		disabled: isDisabled,
		class: cn(className),
		onclick
	} as FileUploadClearChildProps);
</script>

{#if present}
	{#if child}
		{@render child({ props: clearAttrs })}
	{:else}
		<button bind:this={ref} {...clearAttrs}>
			{@render children?.()}
		</button>
	{/if}
{/if}
