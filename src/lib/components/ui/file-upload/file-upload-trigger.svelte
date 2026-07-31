<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	/** The merged attribute payload handed to the `child` snippet. */
	export type FileUploadTriggerChildProps = {
		type: 'button';
		'data-slot': 'file-upload-trigger';
		'data-disabled': '' | undefined;
		disabled: boolean;
		class: string;
	} & Record<string, unknown>;

	export type FileUploadTriggerProps = WithElementRef<
		Omit<HTMLButtonAttributes, 'type' | 'disabled'>,
		HTMLButtonElement
	> & {
		/**
		 * Render the trigger onto your own element instead of the default `<button>`. The snippet
		 * receives the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild` (Radix `Slot`). In `child` mode `children` is not rendered and
		 * `ref` stays `null` — the caller owns the element.
		 */
		child?: Snippet<[{ props: FileUploadTriggerChildProps }]>;
		/** The button's content. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { getFileUploadContext } from './file-upload.svelte.js';

	let {
		ref = $bindable(null),
		onclick: onclickProp,
		class: className,
		child,
		children,
		...restProps
	}: FileUploadTriggerProps = $props();

	const root = getFileUploadContext('Trigger');

	function onclick(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		onclickProp?.(event);
		if (event.defaultPrevented) return;

		root.openFileDialog();
	}

	const triggerAttrs = $derived({
		type: 'button',
		'aria-controls': root.inputId,
		'data-slot': 'file-upload-trigger',
		'data-disabled': root.disabled ? '' : undefined,
		...restProps,
		disabled: root.disabled,
		class: cn(className),
		onclick
	} as FileUploadTriggerChildProps);
</script>

{#if child}
	{@render child({ props: triggerAttrs })}
{:else}
	<button bind:this={ref} {...triggerAttrs}>
		{@render children?.()}
	</button>
{/if}
