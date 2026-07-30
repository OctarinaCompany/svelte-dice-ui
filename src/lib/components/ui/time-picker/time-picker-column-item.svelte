<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	import type { SegmentFormat } from './time-engine.js';

	/** The merged attribute payload handed to the `child` snippet. */
	export type TimePickerColumnItemChildProps = {
		type: 'button';
		'data-slot': 'time-picker-column-item';
		'data-selected': '' | undefined;
		class: string;
		// The symbol slot carries the attachment that joins the column's item registry, so a
		// `child`-rendered item still takes part in arrow navigation.
	} & Record<string, unknown> &
		Record<symbol, Attachment<HTMLElement>>;

	export type TimePickerColumnItemProps = WithElementRef<
		HTMLButtonAttributes,
		HTMLButtonElement
	> & {
		/** The value this item commits. Required. */
		value: number | string;
		/**
		 * Whether this item is the column's current value.
		 *
		 * @default false
		 */
		selected?: boolean;
		/**
		 * How a numeric value is rendered — `'2-digit'` zero-pads it, `'numeric'` prints it bare.
		 * A non-numeric value always prints bare.
		 *
		 * @default "numeric"
		 */
		format?: SegmentFormat;
		/**
		 * The item's label.
		 *
		 * @default the formatted `value`
		 */
		children?: Snippet;
		/**
		 * Render the item onto your own element instead of the default `<button>`. The snippet
		 * receives the merged props to spread onto that element.
		 *
		 * In `child` mode `ref` stays `null`; the props carry the registration attachment instead.
		 */
		child?: Snippet<[{ props: TimePickerColumnItemChildProps }]>;
	};
</script>

<script lang="ts">
	import { createAttachmentKey } from 'svelte/attachments';

	import { formatColumnValue } from './time-engine.js';
	import { getTimePickerColumnContext, getTimePickerContentContext } from './time-picker.svelte.js';

	let {
		ref = $bindable(null),
		value,
		selected = false,
		format = 'numeric',
		onclick,
		onkeydown,
		class: className,
		children,
		child,
		...restProps
	}: TimePickerColumnItemProps = $props();

	const nav = getTimePickerContentContext('<TimePicker.ColumnItem>');
	const column = getTimePickerColumnContext('<TimePicker.ColumnItem>');

	const id = $props.id();

	let element = $state<HTMLElement | null>(null);

	const attach = createAttachmentKey();

	function registerItem(node: Element) {
		if (!(node instanceof HTMLElement)) return;

		element = node;
		column.items.register(id, node, { value, getSelected: () => selected });

		return () => {
			if (element === node) element = null;
			column.items.unregister(id);
		};
	}

	// Keeps a long column scrolled to its current value, exactly as upstream does whenever an item
	// becomes selected (radix/ui/time-picker.tsx:1739-1743).
	$effect(() => {
		if (!selected || !element) return;
		element.scrollIntoView({ block: 'nearest' });
	});

	function handleClick(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
		onclick?.(event);
		if (event.defaultPrevented) return;

		// Clicking a `<button>` does not focus it in every browser, and the panel's arrow navigation
		// starts from whatever has focus.
		event.currentTarget.focus();
	}

	function handleKeydown(event: KeyboardEvent & { currentTarget: HTMLButtonElement }) {
		onkeydown?.(event);
		nav.onItemKeydown(event, column.id, id);
	}

	const formatted = $derived(formatColumnValue(value, format));

	const itemAttrs = $derived({
		type: 'button',
		'data-slot': 'time-picker-column-item',
		'data-selected': selected ? '' : undefined,
		...restProps,
		onclick: handleClick,
		onkeydown: handleKeydown,
		[attach]: registerItem,
		class: cn(
			'w-full rounded px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:border-ring focus:ring-3 focus:ring-ring/50 focus:outline-none',
			'data-selected:bg-primary data-selected:text-primary-foreground data-selected:hover:bg-primary data-selected:hover:text-primary-foreground',
			className
		)
	} as TimePickerColumnItemChildProps);
</script>

{#if child}
	{@render child({ props: itemAttrs })}
{:else}
	<button bind:this={ref} {...itemAttrs}>
		{#if children}{@render children()}{:else}{formatted}{/if}
	</button>
{/if}
