<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLInputAttributes } from 'svelte/elements';

	export type ComboboxInputProps = WithElementRef<
		Omit<HTMLInputAttributes, 'dir' | 'value'>,
		HTMLInputElement
	>;
</script>

<script lang="ts">
	import { getComboboxContext } from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		oninput: oninputProp,
		onfocus: onfocusProp,
		onblur: onblurProp,
		onkeydown: onkeydownProp,
		class: className,
		...restProps
	}: ComboboxInputProps = $props();

	const root = getComboboxContext('<Combobox.Input>');

	$effect(() => {
		root.inputElement = ref;
		return () => {
			root.inputElement = null;
		};
	});

	/**
	 * Keep the DOM in step with the context even when the context declines the write. Svelte only
	 * rewrites `value` when the expression changes, so an authoritative parent that refuses an
	 * `inputValue` update would otherwise leave the typed text on screen (spec FR-005).
	 */
	$effect(() => {
		const element = ref;
		const next = root.inputValue;
		if (element && element.value !== next) element.value = next;
	});

	// Each handler runs the caller's first and `preventDefault()` suppresses ours, reproducing
	// upstream's `composeEventHandlers`.
	function oninput(event: Event & { currentTarget: EventTarget & HTMLInputElement }) {
		oninputProp?.(event);
		if (event.defaultPrevented) return;

		root.onInputChange(event.currentTarget.value);
	}

	function onfocus(event: FocusEvent & { currentTarget: EventTarget & HTMLInputElement }) {
		onfocusProp?.(event);
		if (event.defaultPrevented) return;

		root.onInputFocus();
	}

	function onblur(event: FocusEvent & { currentTarget: EventTarget & HTMLInputElement }) {
		onblurProp?.(event);
		if (event.defaultPrevented) return;

		root.onInputBlur();
	}

	function onkeydown(event: KeyboardEvent & { currentTarget: EventTarget & HTMLInputElement }) {
		onkeydownProp?.(event);
		if (event.defaultPrevented) return;

		root.onInputKeydown(event);
	}
</script>

<input
	bind:this={ref}
	role="combobox"
	id={root.inputId}
	type="text"
	autocapitalize="off"
	autocomplete="off"
	autocorrect="off"
	spellcheck="false"
	aria-expanded={root.open}
	aria-controls={root.listId}
	aria-labelledby={root.labelId}
	aria-autocomplete="list"
	aria-activedescendant={root.highlightedItem?.id}
	aria-disabled={root.disabled}
	aria-readonly={root.readOnly}
	data-slot="combobox-input"
	dir={root.dir}
	disabled={root.disabled}
	readonly={root.readOnly}
	value={root.inputValue}
	{...restProps}
	class={cn(
		'flex h-9 w-full rounded-md bg-transparent text-base placeholder:text-muted-foreground focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
		className
	)}
	{oninput}
	{onfocus}
	{onblur}
	{onkeydown}
/>
