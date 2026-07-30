<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	import type { SegmentFormat } from './time-engine.js';
	import type { TimePickerColumnChildProps } from './time-picker-column.svelte';

	export type TimePickerMinuteProps = WithElementRef<
		HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & {
		/**
		 * How each minute is rendered — `'2-digit'` zero-pads it, `'numeric'` prints it bare.
		 *
		 * @default "2-digit"
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
	import { buildStepValues, currentTime } from './time-engine.js';
	import { getTimePickerContext } from './time-picker.svelte.js';
	import Column from './time-picker-column.svelte';
	import ColumnItem from './time-picker-column-item.svelte';

	let {
		ref = $bindable(null),
		format = '2-digit',
		class: className,
		child,
		...restProps
	}: TimePickerMinuteProps = $props();

	const root = getTimePickerContext('<TimePicker.Minute>');

	const minutes = $derived(buildStepValues(60, root.minuteStep));

	/** An unset minute pre-highlights the current one (radix/ui/time-picker.tsx:1983-1984). */
	const referenceMinute = $derived(root.timeValue?.minute ?? currentTime().minute);

	const columnClass = $derived(
		cn(
			'flex max-h-[200px] flex-col gap-1 overflow-y-auto p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
			className
		)
	);
</script>

{#if child}
	<Column data-slot="time-picker-minute" class={columnClass} {...restProps} {child} />
{:else}
	<Column bind:ref data-slot="time-picker-minute" class={columnClass} {...restProps}>
		{#each minutes as minute (minute)}
			<ColumnItem
				value={minute}
				selected={referenceMinute === minute}
				{format}
				onclick={() => root.selectMinute(minute)}
			/>
		{/each}
	</Column>
{/if}
