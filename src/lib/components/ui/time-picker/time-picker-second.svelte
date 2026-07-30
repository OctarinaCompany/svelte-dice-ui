<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	import type { SegmentFormat } from './time-engine.js';
	import type { TimePickerColumnChildProps } from './time-picker-column.svelte';

	export type TimePickerSecondProps = WithElementRef<
		HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & {
		/**
		 * How each second is rendered — `'2-digit'` zero-pads it, `'numeric'` prints it bare.
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
	}: TimePickerSecondProps = $props();

	const root = getTimePickerContext('<TimePicker.Second>');

	const seconds = $derived(buildStepValues(60, root.secondStep));

	/** An unset second pre-highlights the current one (radix/ui/time-picker.tsx:2048-2049). */
	const referenceSecond = $derived(root.timeValue?.second ?? currentTime().second);

	const columnClass = $derived(
		cn(
			'flex max-h-[200px] flex-col gap-1 overflow-y-auto p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
			className
		)
	);
</script>

{#if child}
	<Column data-slot="time-picker-second" class={columnClass} {...restProps} {child} />
{:else}
	<Column bind:ref data-slot="time-picker-second" class={columnClass} {...restProps}>
		{#each seconds as second (second)}
			<ColumnItem
				value={second}
				selected={referenceSecond === second}
				{format}
				onclick={() => root.selectSecond(second)}
			/>
		{/each}
	</Column>
{/if}
