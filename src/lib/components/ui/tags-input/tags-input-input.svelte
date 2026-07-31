<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLInputAttributes } from 'svelte/elements';

	export type TagsInputInputProps = WithElementRef<
		Omit<HTMLInputAttributes, 'value' | 'type' | 'disabled' | 'readonly' | 'dir'>,
		HTMLInputElement
	>;
</script>

<script lang="ts">
	import { getTagsInputContext } from './tags-input.svelte.js';

	let {
		ref = $bindable(null),
		oninput: oninputProp,
		onkeydown: onkeydownProp,
		onpaste: onpasteProp,
		onblur: onblurProp,
		class: className,
		...restProps
	}: TagsInputInputProps = $props();

	const root = getTagsInputContext('<TagsInput.Input>');

	// The typed text stays uncontrolled DOM state, exactly as upstream: every handler reads
	// `currentTarget.value` and clears it by assignment (research R-03).
	$effect(() => {
		root.inputElement = ref;
		return () => {
			root.inputElement = null;
		};
	});

	/**
	 * Upstream `onCustomKeydown` (tags-input-input.tsx:15-31) — the shared `Enter` / `Tab` commit.
	 * `preventDefault()` fires whether or not the tag was accepted, which is what stops `Tab` from
	 * moving focus and `Enter` from submitting a surrounding form.
	 */
	function commitTypedText(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (event.defaultPrevented) return;

		const text = event.currentTarget.value;
		if (!text) return;

		if (root.addItem(text)) {
			event.currentTarget.value = '';
			root.highlightedIndex = null;
		}

		event.preventDefault();
	}

	// Each handler runs the caller's first and `preventDefault()` suppresses ours, reproducing
	// upstream's `composeEventHandlers`.
	function oninput(event: Event & { currentTarget: EventTarget & HTMLInputElement }) {
		oninputProp?.(event);
		if (event.defaultPrevented) return;
		if (root.readOnly) return;

		const target = event.currentTarget;
		if (root.delimiter !== target.value.slice(-1)) return;

		const text = target.value.slice(0, -1);
		target.value = '';
		if (!text) return;

		root.addItem(text);
		root.highlightedIndex = null;
	}

	function onkeydown(event: KeyboardEvent & { currentTarget: EventTarget & HTMLInputElement }) {
		onkeydownProp?.(event);
		if (event.defaultPrevented) return;
		if (root.readOnly) return;

		if (event.key === 'Enter') commitTypedText(event);
		if (event.key === 'Tab' && root.addOnTab) commitTypedText(event);
		root.onInputKeydown(event);
		if (event.key.length === 1) root.highlightedIndex = null;
	}

	function onpaste(event: ClipboardEvent & { currentTarget: EventTarget & HTMLInputElement }) {
		onpasteProp?.(event);
		if (event.defaultPrevented) return;
		if (root.readOnly || !root.addOnPaste) return;

		event.preventDefault();
		// All splitting, deduplication and validation lives in `addItem` (research R-08).
		root.addItem(event.clipboardData?.getData('text') ?? '', { viaPaste: true });
		root.highlightedIndex = null;
	}

	function onblur(event: FocusEvent & { currentTarget: EventTarget & HTMLInputElement }) {
		onblurProp?.(event);
		if (event.defaultPrevented) return;
		if (root.readOnly) return;

		const target = event.currentTarget;

		if (root.blurBehavior === 'add') {
			if (target.value && root.addItem(target.value)) target.value = '';
		}

		if (root.blurBehavior === 'clear') target.value = '';
	}
</script>

<input
	bind:this={ref}
	id={root.inputId}
	type="text"
	autocapitalize="off"
	autocomplete="off"
	autocorrect="off"
	spellcheck="false"
	aria-labelledby={root.labelledBy}
	aria-readonly={root.readOnly}
	disabled={root.disabled}
	readonly={root.readOnly}
	dir={root.dir}
	data-slot="tags-input-input"
	data-invalid={root.isInvalidInput ? '' : undefined}
	{...restProps}
	class={cn(
		'flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	{oninput}
	{onkeydown}
	{onpaste}
	{onblur}
/>
