<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	import type { TimePickerColumnChildProps } from './time-picker-column.svelte';

	export type TimePickerPeriodProps = WithElementRef<
		HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & {
		/**
		 * Render the column onto your own element instead of the default `<div>`. The snippet
		 * receives the merged props to spread onto that element; the items are not rendered.
		 */
		child?: Snippet<[{ props: TimePickerColumnChildProps }]>;
	};
</script>

<script lang="ts">
	import { currentTime, PERIODS, to12Hour } from './time-engine.js';
	import { getTimePickerContext } from './time-picker.svelte.js';
	import Column from './time-picker-column.svelte';
	import ColumnItem from './time-picker-column-item.svelte';

	let {
		ref = $bindable(null),
		class: className,
		child,
		...restProps
	}: TimePickerPeriodProps = $props();

	const root = getTimePickerContext('<TimePicker.Period>');

	/** An unset hour pre-highlights the current period (radix/ui/time-picker.tsx:2110-2112). */
	const currentPeriod = $derived(to12Hour(root.timeValue?.hour ?? currentTime().hour).period);

	const columnClass = $derived(cn('flex flex-col gap-1 p-1', className));
</script>

<!-- A 24-hour clock has no period to pick, so the column renders no element at all. -->
{#if root.is12Hour}
	{#if child}
		<Column data-slot="time-picker-period" class={columnClass} {...restProps} {child} />
	{:else}
		<Column bind:ref data-slot="time-picker-period" class={columnClass} {...restProps}>
			{#each PERIODS as period (period)}
				<ColumnItem
					value={period}
					selected={currentPeriod === period}
					onclick={() => root.selectPeriod(period)}
				/>
			{/each}
		</Column>
	{/if}
{/if}
