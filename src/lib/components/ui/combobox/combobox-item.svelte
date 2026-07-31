<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	export type ComboboxItemProps = WithElementRef<
		Omit<HTMLAttributes<HTMLDivElement>, 'onselect'>,
		HTMLDivElement
	> & {
		/** The value of the item. Cannot be an empty string. */
		value: string;
		/**
		 * The label shown in the input once the item is selected.
		 *
		 * @default the item's rendered text
		 */
		label?: string;
		/**
		 * Whether the item is disabled, independently of the root's `disabled`.
		 *
		 * @default false
		 */
		disabled?: boolean;
		/** Called with the item's value just before the selection is applied. */
		onSelect?: (value: string) => void;
		/** Normally a `<Combobox.ItemIndicator>` and a `<Combobox.ItemText>`. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { untrack } from 'svelte';

	import {
		ComboboxItemState,
		getComboboxContext,
		getComboboxGroupContext,
		hasComboboxGroupContext,
		setComboboxItemContext
	} from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		value,
		label,
		disabled = false,
		onSelect,
		onclick: onclickProp,
		onpointerdown: onpointerdownProp,
		onpointerup: onpointerupProp,
		onpointermove: onpointermoveProp,
		class: className,
		children,
		...restProps
	}: ComboboxItemProps = $props();

	// A one-shot initialisation check, exactly where upstream's layout effect throws, so
	// `expect(() => render(...)).toThrow(...)` works. `untrack` says "read this once" rather than
	// looking like a reactive read that only ever captures the initial value.
	if (untrack(() => value) === '') {
		throw new Error('`<Combobox.Item>` value cannot be an empty string.');
	}

	const root = getComboboxContext('<Combobox.Item>');
	// The group is the one context an item may legitimately be without — upstream's
	// `useComboboxGroupContext(ITEM_NAME, true)`.
	const group = hasComboboxGroupContext() ? getComboboxGroupContext('<Combobox.Item>') : undefined;

	const itemId = $props.id();

	const item = setComboboxItemContext(
		new ComboboxItemState({
			root,
			getValue: () => value,
			getDisabled: () => disabled,
			id: itemId
		})
	);

	/** Upstream `useLabel`: the explicit prop wins, else the `<Combobox.ItemText>`'s text. */
	const resolvedLabel = $derived(label ?? (item.labelElement?.textContent ?? '').trim());

	// The collection holds a snapshot rather than a bag of getters, so re-registering is how a change
	// is published. Registration is deliberately independent of visibility: a filtered-out item
	// renders nothing but stays registered with a `null` element, which is what lets it come back
	// when the search changes.
	$effect(() =>
		root.collection.register({
			element: ref,
			id: itemId,
			value,
			label: resolvedLabel,
			disabled: item.isDisabled,
			onSelect,
			groupId: group?.id
		})
	);

	let isPointerDown = false;

	function selectSelf() {
		const data = root.collection.getItems().find((candidate) => candidate.id === itemId);
		if (data) root.selectItem(data);
	}

	// Each handler runs the caller's first and `preventDefault()` suppresses ours, reproducing
	// upstream's `composeEventHandlers`.
	function onclick(event: MouseEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		onclickProp?.(event);
		if (event.defaultPrevented) return;
		if (item.isDisabled || root.readOnly) return;

		event.currentTarget.focus();
		selectSelf();
	}

	function onpointerdown(event: PointerEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		onpointerdownProp?.(event);
		if (event.defaultPrevented) return;
		if (item.isDisabled) return;

		isPointerDown = true;

		const target = event.target;
		if (!(target instanceof HTMLElement)) return;

		// Prevent implicit pointer capture, which would otherwise retarget the whole gesture.
		if (target.hasPointerCapture(event.pointerId)) {
			target.releasePointerCapture(event.pointerId);
		}

		if (event.button === 0 && event.ctrlKey === false && event.pointerType === 'mouse') {
			event.preventDefault();
		}
	}

	function onpointerup(event: PointerEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		onpointerupProp?.(event);
		if (event.defaultPrevented) return;

		// A pointer that came up here without having gone down here (a drag release) still selects,
		// which is what upstream's synthetic `click()` achieves.
		if (!isPointerDown) event.currentTarget.click();
		isPointerDown = false;
	}

	function onpointermove(event: PointerEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		onpointermoveProp?.(event);
		if (event.defaultPrevented) return;
		if (item.isDisabled) return;

		root.highlightedElement = event.currentTarget;
	}
</script>

{#if item.isVisible}
	<div
		bind:this={ref}
		role="option"
		id={itemId}
		aria-selected={item.isSelected}
		aria-disabled={item.isDisabled}
		aria-labelledby={item.textId}
		data-dice-collection-item=""
		data-slot="combobox-item"
		data-state={item.dataState}
		data-highlighted={item.isHighlighted ? '' : undefined}
		data-disabled={item.isDisabled ? '' : undefined}
		tabindex={disabled ? undefined : -1}
		{...restProps}
		class={cn(
			'relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50',
			className
		)}
		{onclick}
		{onpointerdown}
		{onpointerup}
		{onpointermove}
	>
		{@render children?.()}
	</div>
{/if}
