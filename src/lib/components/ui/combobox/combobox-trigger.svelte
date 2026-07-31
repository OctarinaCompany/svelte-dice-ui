<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	export type ComboboxTriggerProps = WithElementRef<
		Omit<HTMLButtonAttributes, 'dir'>,
		HTMLButtonElement
	> & {
		/**
		 * Whether the trigger is disabled, independently of the root's `disabled`.
		 *
		 * @default the root's `disabled`
		 */
		disabled?: boolean;
		/** The trigger's content. @default a `<ChevronDown>` icon */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	import { getComboboxContext } from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		disabled,
		onclick: onclickProp,
		onpointerdown: onpointerdownProp,
		class: className,
		children,
		...restProps
	}: ComboboxTriggerProps = $props();

	const root = getComboboxContext('<Combobox.Trigger>');

	const isDisabled = $derived(disabled || root.disabled);

	// Each handler runs the caller's first and `preventDefault()` suppresses ours, reproducing
	// upstream's `composeEventHandlers`.
	function onclick(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		onclickProp?.(event);
		if (event.defaultPrevented) return;

		void root.toggleFromTrigger();
	}

	function onpointerdown(event: PointerEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		onpointerdownProp?.(event);
		if (event.defaultPrevented) return;
		if (root.disabled) return;

		const target = event.target;
		if (!(target instanceof Element)) return;

		// Prevent implicit pointer capture, which would otherwise retarget the whole gesture.
		if (target.hasPointerCapture(event.pointerId)) {
			target.releasePointerCapture(event.pointerId);
		}

		if (
			event.button === 0 &&
			event.ctrlKey === false &&
			event.pointerType === 'mouse' &&
			!(target instanceof HTMLInputElement)
		) {
			event.preventDefault();
		}
	}
</script>

<button
	bind:this={ref}
	type="button"
	aria-haspopup="listbox"
	aria-expanded={root.open}
	aria-controls={root.listId}
	data-slot="combobox-trigger"
	data-state={root.dataState}
	data-disabled={isDisabled ? '' : undefined}
	dir={root.dir}
	disabled={isDisabled}
	tabindex={isDisabled ? undefined : -1}
	{...restProps}
	class={cn(
		'flex shrink-0 items-center justify-center rounded-r-md border-input bg-transparent text-muted-foreground transition-colors hover:text-foreground/80 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	{onclick}
	{onpointerdown}
>
	{#if children}
		{@render children()}
	{:else}
		<ChevronDownIcon class="size-4" />
	{/if}
</button>
