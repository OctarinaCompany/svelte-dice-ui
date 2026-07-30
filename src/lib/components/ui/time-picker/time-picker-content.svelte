<script lang="ts" module>
	import { cn } from '$lib/utils.js';
	import type { Popover as PopoverPrimitive } from 'bits-ui';

	/**
	 * Every `Popover.Content` prop, so positioning, portalling, dismissal, the focus scope and the
	 * scroll lock all stay configurable. `child` is part of that surface already.
	 */
	export type TimePickerContentProps = PopoverPrimitive.ContentProps;
</script>

<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { tick } from 'svelte';

	import { ColumnNavigation } from './column-navigation.svelte.js';
	import { getTimePickerContext, setTimePickerContentContext } from './time-picker.svelte.js';

	let {
		ref = $bindable(null),
		side = 'bottom',
		align = 'start',
		sideOffset = 6,
		onOpenAutoFocus,
		onInteractOutside,
		class: className,
		...restProps
	}: TimePickerContentProps = $props();

	const root = getTimePickerContext('<TimePicker.Content>');

	const nav = setTimePickerContentContext(new ColumnNavigation({ getDir: () => root.dir }));

	/**
	 * Upstream's `focusFirst` on open (radix/ui/time-picker.tsx:1536-1566): the panel's own auto-focus
	 * is cancelled and focus is placed on the first column's selected item instead — unless the panel
	 * was opened by a segment gaining focus, in which case the latch is consumed and the caret stays
	 * in the field (research R-08, R-09).
	 *
	 * The move itself waits a tick: the columns register through attachments during the same flush
	 * that mounts them, so reading the registry synchronously here would find it empty.
	 */
	function handleOpenAutoFocus(event: Event) {
		onOpenAutoFocus?.(event);
		if (event.defaultPrevented) return;

		event.preventDefault();

		if (root.consumeOpenedViaFocus()) return;

		void tick().then(() => nav.focusPreferredIn(0));
	}

	/** Typing in the field must not dismiss a panel the field itself opened (R-09). */
	function handleInteractOutside(event: PointerEvent) {
		onInteractOutside?.(event);
		if (event.defaultPrevented) return;
		if (!root.openOnFocus) return;

		const target = event.target;
		if (!(target instanceof Node)) return;
		if (root.inputGroupElement?.contains(target)) event.preventDefault();
	}
</script>

<Popover.Content
	bind:ref
	data-slot="time-picker-content"
	{side}
	{align}
	{sideOffset}
	customAnchor={root.inputGroupElement}
	onOpenAutoFocus={handleOpenAutoFocus}
	onInteractOutside={handleInteractOutside}
	class={cn('flex w-auto max-w-(--bits-floating-anchor-width) p-0', className)}
	{...restProps}
/>
