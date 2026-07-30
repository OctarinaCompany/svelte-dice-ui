<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	/** The merged attribute payload handed to the `child` snippet. */
	export type TimePickerClearChildProps = {
		type: 'button';
		'data-slot': 'time-picker-clear';
		disabled: boolean;
		class: string;
	} & Record<string, unknown>;

	export type TimePickerClearProps = WithElementRef<HTMLButtonAttributes, HTMLButtonElement> & {
		/** Whether the button is disabled. OR-ed with the picker's own `disabled`. */
		disabled?: boolean;
		/**
		 * The button's content.
		 *
		 * @default "Clear"
		 */
		children?: Snippet;
		/**
		 * Render the button onto your own element instead of the composed `Button`. The snippet
		 * receives the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild`. In `child` mode `ref` stays `null`.
		 */
		child?: Snippet<[{ props: TimePickerClearChildProps }]>;
	};
</script>

<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';

	import { getTimePickerContext } from './time-picker.svelte.js';

	let {
		ref = $bindable(null),
		disabled = false,
		onclick,
		class: className,
		children,
		child,
		...restProps
	}: TimePickerClearProps = $props();

	const root = getTimePickerContext('<TimePicker.Clear>');

	const isDisabled = $derived(disabled || root.disabled);

	function handleClick(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
		onclick?.(event);
		if (event.defaultPrevented) return;

		event.preventDefault();
		// `root.clear()` is itself a no-op while disabled or read-only (divergence D-17).
		root.clear();
	}

	const clearAttrs = $derived({
		type: 'button',
		'data-slot': 'time-picker-clear',
		disabled: isDisabled,
		...restProps,
		onclick: handleClick,
		class: cn(className)
	} as TimePickerClearChildProps);
</script>

{#if child}
	{@render child({ props: clearAttrs })}
{:else}
	<!-- Upstream's class list *is* this repo's ghost variant, so the button is composed rather than
	     re-styled (research R-21, divergence D-15). -->
	<Button bind:ref variant="ghost" size="sm" {...clearAttrs}>
		{#if children}{@render children()}{:else}Clear{/if}
	</Button>
{/if}
