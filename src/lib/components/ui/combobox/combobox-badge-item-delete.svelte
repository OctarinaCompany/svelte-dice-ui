<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	export type ComboboxBadgeItemDeleteProps = WithElementRef<
		HTMLButtonAttributes,
		HTMLButtonElement
	> & {
		/** The button's content. @default an `<X>` icon */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';

	import { getComboboxBadgeItemContext, getComboboxContext } from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		onclick: onclickProp,
		onpointerdown: onpointerdownProp,
		class: className,
		children,
		...restProps
	}: ComboboxBadgeItemDeleteProps = $props();

	const root = getComboboxContext('<Combobox.BadgeItemDelete>');
	const badge = getComboboxBadgeItemContext('<Combobox.BadgeItemDelete>');

	// Each handler runs the caller's first and `preventDefault()` suppresses ours, reproducing
	// upstream's `composeEventHandlers`.
	function onclick(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		onclickProp?.(event);
		if (event.defaultPrevented) return;
		if (badge.disabled) return;

		event.stopPropagation();
		root.removeValue(badge.value);
		root.focusInput();
	}

	function onpointerdown(event: PointerEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		onpointerdownProp?.(event);
		if (event.defaultPrevented) return;
		if (badge.disabled) return;

		const target = event.target;
		if (!(target instanceof Element)) return;

		// Prevent implicit pointer capture, which would otherwise retarget the whole gesture.
		if (target.hasPointerCapture(event.pointerId)) {
			target.releasePointerCapture(event.pointerId);
		}

		// Keep the badge from stealing focus away from the input.
		if (event.button === 0 && event.ctrlKey === false && event.pointerType === 'mouse') {
			event.preventDefault();
		}
	}
</script>

<button
	bind:this={ref}
	type="button"
	aria-controls={badge.id}
	aria-disabled={badge.disabled}
	data-slot="combobox-badge-item-delete"
	data-disabled={badge.disabled ? '' : undefined}
	data-highlighted={badge.isHighlighted ? '' : undefined}
	tabindex={badge.disabled ? undefined : -1}
	{...restProps}
	class={cn(
		'data-highlighted:text-destructive-foreground shrink-0 rounded p-0.5 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden data-highlighted:bg-destructive',
		className
	)}
	{onclick}
	{onpointerdown}
>
	{#if children}
		{@render children()}
	{:else}
		<XIcon class="size-3" />
	{/if}
</button>
