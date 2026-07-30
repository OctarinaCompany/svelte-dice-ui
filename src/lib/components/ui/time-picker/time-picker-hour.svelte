<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	import type { SegmentFormat } from './time-engine.js';
	import type { TimePickerColumnChildProps } from './time-picker-column.svelte';

	export type TimePickerHourProps = WithElementRef<
		HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & {
		/**
		 * How each hour is rendered — `'2-digit'` zero-pads it, `'numeric'` prints it bare.
		 *
		 * @default "numeric"
		 */
		format?: SegmentFormat;
		/**
		 * Render the column onto your own element instead of the default `<div>`. The snippet
		 * receives the merged props to spread onto that element; the items are not rendered.
		 */
		child?: Snippet<[{ props: TimePickerColumnChildProps }]>;
	};
</script>

<script lang="ts">
	import { buildHourValues, currentTime, to12Hour } from './time-engine.js';
	import { getTimePickerContext } from './time-picker.svelte.js';
	import Column from './time-picker-column.svelte';
	import ColumnItem from './time-picker-column-item.svelte';

	let {
		ref = $bindable(null),
		format = 'numeric',
		class: className,
		child,
		...restProps
	}: TimePickerHourProps = $props();

	const root = getTimePickerContext('<TimePicker.Hour>');

	const hours = $derived(buildHourValues(root.is12Hour, root.hourStep));

	/**
	 * Which hour is highlighted. An unset hour pre-highlights the current one, so opening the panel
	 * on an empty field still lands somewhere meaningful (radix/ui/time-picker.tsx:1915-1917).
	 */
	const displayHour = $derived.by(() => {
		const reference = root.timeValue?.hour ?? currentTime().hour;
		return root.is12Hour ? to12Hour(reference).hour : reference;
	});

	const columnClass = $derived(
		cn(
			'flex max-h-[200px] flex-col gap-1 overflow-y-auto p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
			className
		)
	);
</script>

{#if child}
	<Column data-slot="time-picker-hour" class={columnClass} {...restProps} {child} />
{:else}
	<Column bind:ref data-slot="time-picker-hour" class={columnClass} {...restProps}>
		{#each hours as hour (hour)}
			<ColumnItem
				value={hour}
				selected={displayHour === hour}
				{format}
				onclick={() => root.selectHour(hour)}
			/>
		{/each}
	</Column>
{/if}
