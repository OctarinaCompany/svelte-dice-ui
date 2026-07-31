<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	export type ComboboxCancelProps = WithElementRef<HTMLButtonAttributes, HTMLButtonElement> & {
		/**
		 * Whether to render the cancel button even while the input is empty.
		 *
		 * @default false
		 */
		forceMount?: boolean;
		/**
		 * Whether the cancel button is disabled, independently of the root's `disabled`.
		 *
		 * @default the root's `disabled`
		 */
		disabled?: boolean;
		/** The button's content. @default an `<X>` icon */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';

	import { getComboboxContext } from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		forceMount = false,
		disabled,
		onclick: onclickProp,
		onpointerdown: onpointerdownProp,
		class: className,
		children,
		...restProps
	}: ComboboxCancelProps = $props();

	const root = getComboboxContext('<Combobox.Cancel>');

	const isDisabled = $derived(disabled || root.disabled);

	// Each handler runs the caller's first and `preventDefault()` suppresses ours, reproducing
	// upstream's `composeEventHandlers`.
	function onclick(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		onclickProp?.(event);
		if (event.defaultPrevented) return;

		root.clearInput();
	}

	function onpointerdown(event: PointerEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		onpointerdownProp?.(event);
		if (event.defaultPrevented) return;
		if (isDisabled) return;

		const target = event.target;
		if (!(target instanceof Element)) return;

		// Prevent implicit pointer capture, which would otherwise retarget the whole gesture.
		if (target.hasPointerCapture(event.pointerId)) {
			target.releasePointerCapture(event.pointerId);
		}

		// Keep the press from stealing focus away from the input.
		if (event.button === 0 && event.ctrlKey === false && event.pointerType === 'mouse') {
			event.preventDefault();
		}
	}
</script>

{#if forceMount || root.inputValue}
	<button
		bind:this={ref}
		type="button"
		aria-controls={root.inputId}
		data-slot="combobox-cancel"
		data-disabled={isDisabled ? '' : undefined}
		disabled={isDisabled}
		{...restProps}
		class={cn(
			'absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm bg-background opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none',
			className
		)}
		{onclick}
		{onpointerdown}
	>
		{#if children}
			{@render children()}
		{:else}
			<XIcon class="size-4" />
		{/if}
	</button>
{/if}
