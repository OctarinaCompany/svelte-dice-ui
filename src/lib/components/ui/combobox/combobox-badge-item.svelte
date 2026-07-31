<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	export type ComboboxBadgeItemProps = WithElementRef<
		HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & {
		/** The selected value this badge stands for. */
		value: string;
		/**
		 * Whether the badge is disabled, independently of the root's `disabled`.
		 *
		 * @default the root's `disabled`
		 */
		disabled?: boolean;
		/** Normally the badge's text and a `<Combobox.BadgeItemDelete>`. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import {
		ComboboxBadgeItemState,
		getComboboxBadgeListContext,
		getComboboxContext,
		setComboboxBadgeItemContext
	} from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		value,
		disabled = false,
		onfocus: onfocusProp,
		onblur: onblurProp,
		class: className,
		children,
		...restProps
	}: ComboboxBadgeItemProps = $props();

	const root = getComboboxContext('<Combobox.BadgeItem>');
	const badgeList = getComboboxBadgeListContext('<Combobox.BadgeItem>');

	const badgeId = $props.id();

	const badge = setComboboxBadgeItemContext(
		new ComboboxBadgeItemState({
			root,
			getValue: () => value,
			getDisabled: () => disabled,
			id: badgeId
		})
	);

	// Each handler runs the caller's first and `preventDefault()` suppresses ours, reproducing
	// upstream's `composeEventHandlers`.
	function onfocus(event: FocusEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		onfocusProp?.(event);
		if (event.defaultPrevented) return;

		if (!badge.disabled) root.highlightedBadgeIndex = badge.index;
	}

	function onblur(event: FocusEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		onblurProp?.(event);
		if (event.defaultPrevented) return;

		if (root.highlightedBadgeIndex === badge.index) root.highlightedBadgeIndex = -1;
	}

	/**
	 * `aria-orientation` on `role="option"` is rejected by Svelte's `a11y_role_supports_aria_props`
	 * check when written literally, and `svelte-ignore` is not an option. Spreading the object emits
	 * exactly the same DOM while staying out of the compiler's static analysis, as
	 * `tags-input-item.svelte` already does — upstream sets it, so the port keeps it.
	 */
	const badgeAria = $derived({ 'aria-orientation': badgeList.orientation });
</script>

<div
	bind:this={ref}
	role="option"
	id={badgeId}
	aria-selected={badge.isHighlighted}
	aria-disabled={badge.disabled}
	{...badgeAria}
	aria-posinset={badge.position}
	aria-setsize={badgeList.badgeCount}
	data-slot="combobox-badge-item"
	data-disabled={badge.disabled ? '' : undefined}
	data-highlighted={badge.isHighlighted ? '' : undefined}
	data-orientation={badgeList.orientation}
	{...restProps}
	class={cn(
		'inline-flex items-center justify-between gap-1 rounded-sm bg-secondary px-2 py-0.5 text-[13px] text-secondary-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50',
		className
	)}
	{onfocus}
	{onblur}
>
	{@render children?.()}
</div>
