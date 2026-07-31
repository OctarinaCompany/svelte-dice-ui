<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	export type ComboboxAnchorProps = WithElementRef<
		Omit<HTMLAttributes<HTMLDivElement>, 'dir'>,
		HTMLDivElement
	> & {
		/**
		 * Whether clicking the anchor should leave focus where it is instead of moving it to the input.
		 *
		 * @default false
		 */
		preventInputFocus?: boolean;
		/** Normally a `<Combobox.Input>` and a `<Combobox.Trigger>`. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { getComboboxContext } from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		preventInputFocus = false,
		onclick: onclickProp,
		onfocusin: onfocusinProp,
		onfocusout: onfocusoutProp,
		onpointerdown: onpointerdownProp,
		class: className,
		children,
		...restProps
	}: ComboboxAnchorProps = $props();

	const root = getComboboxContext('<Combobox.Anchor>');

	let isFocused = $state(false);

	// Registering the element is what makes the popover anchor to the whole field rather than to the
	// bare input — upstream's `useAnchor` + `onHasAnchorChange`.
	$effect(() => {
		root.anchorElement = ref;
		return () => {
			root.anchorElement = null;
		};
	});

	// Each handler runs the caller's first and `preventDefault()` suppresses ours, reproducing
	// upstream's `composeEventHandlers`.
	function onclick(event: MouseEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		onclickProp?.(event);
		if (event.defaultPrevented) return;
		if (preventInputFocus) return;

		event.currentTarget.focus();
		root.focusInput();
	}

	/**
	 * `focusin`/`focusout` rather than `focus`/`blur`: upstream's `onFocus`/`onBlur` are React's
	 * synthetic pair, which bubble, so the anchor reports itself focused while the focus is on the
	 * `<Combobox.Input>` *inside* it — that is what the `data-focused` ring is for. The native
	 * `focus`/`blur` events do not bubble and would never reach this non-focusable wrapper.
	 */
	function onfocusin(event: FocusEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		onfocusinProp?.(event);
		if (event.defaultPrevented) return;

		isFocused = true;
	}

	function onfocusout(event: FocusEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		onfocusoutProp?.(event);
		if (event.defaultPrevented) return;

		isFocused = false;
	}

	function onpointerdown(event: PointerEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		onpointerdownProp?.(event);
		if (event.defaultPrevented) return;
		if (root.disabled) return;

		const target = event.target;
		if (!(target instanceof HTMLElement)) return;

		// Prevent implicit pointer capture, which would otherwise retarget the whole gesture.
		if (target.hasPointerCapture(event.pointerId)) {
			target.releasePointerCapture(event.pointerId);
		}

		// Only prevent focus stealing away from the input — a press on the input itself must still be
		// able to place the caret and select text.
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

<div
	bind:this={ref}
	data-slot="combobox-anchor"
	data-state={root.dataState}
	data-anchor=""
	data-disabled={root.disabled ? '' : undefined}
	data-focused={isFocused ? '' : undefined}
	dir={root.dir}
	{...restProps}
	class={cn(
		'relative flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 shadow-xs data-focused:ring-1 data-focused:ring-ring data-disabled:cursor-not-allowed data-disabled:opacity-50',
		className
	)}
	{onclick}
	{onfocusin}
	{onfocusout}
	{onpointerdown}
>
	{@render children?.()}
</div>
