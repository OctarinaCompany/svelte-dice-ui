<script lang="ts" module>
	import type { Column, RowData } from '@tanstack/table-core';

	import type { DataTableFilterAttributes } from './types.js';

	export type DataTableSliderFilterProps<TData extends RowData> = DataTableFilterAttributes & {
		/** The column being filtered. Its filter value is a `[min, max]` tuple. */
		column: Column<TData, unknown>;
		/** Trigger label and the popover heading. */
		title?: string;
		/**
		 * Whether the popover is open. Bindable (plan.md Divergence 8).
		 * @default false
		 */
		open?: boolean;
		/** Called whenever the popover opens or closes. */
		onOpenChange?: (open: boolean) => void;
		/** The trigger element. Every other attribute is spread onto it too. */
		ref?: HTMLElement | null;
	};
</script>

<script lang="ts" generics="TData extends RowData">
	import XCircleIcon from '@lucide/svelte/icons/x-circle';
	import PlusCircleIcon from '@lucide/svelte/icons/plus-circle';
	import { Slider } from 'bits-ui';

	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { useDirection } from '$lib/components/ui/direction-provider/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { cn } from '$lib/utils.js';

	import { getSliderRange, parseValuesAsNumbers, type RangeValue } from './data-table-utils.js';

	let {
		ref = $bindable(null),
		column,
		title,
		open = $bindable(false),
		onOpenChange,
		class: className,
		...restProps
	}: DataTableSliderFilterProps<TData> = $props();

	const id = $props.id();

	// bits-ui's `Slider` takes an explicit `dir` and defaults it to `ltr`; without this the
	// `ArrowLeft`/`ArrowRight` pair would keep their LTR meaning inside an RTL table (SC-003).
	const direction = useDirection({ element: () => ref });

	const columnFilterValue = $derived(parseValuesAsNumbers(column.getFilterValue()));
	const unit = $derived(column.columnDef.meta?.unit);

	const bounds = $derived(
		getSliderRange(column.columnDef.meta?.range, column.getFacetedMinMaxValues())
	);
	const range = $derived<RangeValue>(columnFilterValue ?? [bounds.min, bounds.max]);

	function formatValue(value: number): string {
		return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
	}

	// Upstream's guard rail (spec Edge Case 9): an out-of-range entry is ignored rather than
	// producing an inverted range, so `from` can never pass `to` and vice versa.
	function onFromInput(event: Event & { currentTarget: HTMLInputElement }) {
		const numValue = Number(event.currentTarget.value);
		if (!Number.isNaN(numValue) && numValue >= bounds.min && numValue <= range[1]) {
			column.setFilterValue([numValue, range[1]]);
		}
	}

	function onToInput(event: Event & { currentTarget: HTMLInputElement }) {
		const numValue = Number(event.currentTarget.value);
		if (!Number.isNaN(numValue) && numValue <= bounds.max && numValue >= range[0]) {
			column.setFilterValue([range[0], numValue]);
		}
	}

	function onSliderValueChange(value: number[]) {
		if (value.length === 2) {
			column.setFilterValue([value[0], value[1]]);
		}
	}

	function onReset() {
		column.setFilterValue(undefined);
	}
</script>

<div class="inline-flex items-center gap-1">
	{#if columnFilterValue}
		<!-- Sibling, keyboard-operable clear affordance — plan.md Divergence 14, FR-014. -->
		<button
			type="button"
			aria-label={`Clear ${title} filter`}
			class="rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-3.5"
			onclick={onReset}
		>
			<XCircleIcon />
		</button>
	{/if}
	<Popover.Root bind:open {onOpenChange}>
		<Popover.Trigger
			bind:ref
			data-slot="data-table-slider-filter"
			data-selected={columnFilterValue ? '' : undefined}
			class={cn(
				buttonVariants({ variant: 'outline', size: 'sm' }),
				'border-dashed font-normal',
				className
			)}
			{...restProps}
		>
			{#if !columnFilterValue}
				<PlusCircleIcon />
			{/if}
			<span>{title}</span>
			{#if columnFilterValue}
				<Separator orientation="vertical" class="mx-0.5 data-[orientation=vertical]:h-4" />
				{formatValue(columnFilterValue[0])} - {formatValue(columnFilterValue[1])}{unit
					? ` ${unit}`
					: ''}
			{/if}
		</Popover.Trigger>
		<Popover.Content align="start" class="flex w-auto flex-col gap-4">
			<div class="flex flex-col gap-3">
				<p class="leading-none font-medium">{title}</p>
				<div class="flex items-center gap-4">
					<Label for={`${id}-from`} class="sr-only">From</Label>
					<div class="relative">
						<Input
							id={`${id}-from`}
							type="number"
							aria-valuemin={bounds.min}
							aria-valuemax={bounds.max}
							inputmode="numeric"
							pattern="[0-9]*"
							placeholder={bounds.min.toString()}
							min={bounds.min}
							max={bounds.max}
							value={range[0]?.toString()}
							oninput={onFromInput}
							class={cn('h-8 w-24', unit && 'pr-8')}
						/>
						{#if unit}
							<span
								class="absolute top-0 right-0 bottom-0 flex items-center rounded-r-md bg-accent px-2 text-sm text-muted-foreground"
							>
								{unit}
							</span>
						{/if}
					</div>
					<Label for={`${id}-to`} class="sr-only">to</Label>
					<div class="relative">
						<Input
							id={`${id}-to`}
							type="number"
							aria-valuemin={bounds.min}
							aria-valuemax={bounds.max}
							inputmode="numeric"
							pattern="[0-9]*"
							placeholder={bounds.max.toString()}
							min={bounds.min}
							max={bounds.max}
							value={range[1]?.toString()}
							oninput={onToInput}
							class={cn('h-8 w-24', unit && 'pr-8')}
						/>
						{#if unit}
							<span
								class="absolute top-0 right-0 bottom-0 flex items-center rounded-r-md bg-accent px-2 text-sm text-muted-foreground"
							>
								{unit}
							</span>
						{/if}
					</div>
				</div>
				<Label for={`${id}-slider`} class="sr-only">{title} slider</Label>
				<!--
					`src/lib/components/ui/slider` does not exist and `shadcn-svelte add` is forbidden
					mid-port, so the two-thumb range, its `Arrow*`/`Home`/`End`/`PageUp`/`PageDown`
					keyboard handling and its RTL behaviour come from bits-ui directly, wearing the
					shadcn markup (research D-04). No drag logic is hand-rolled.
				-->
				<Slider.Root
					id={`${id}-slider`}
					type="multiple"
					dir={direction.current}
					min={bounds.min}
					max={bounds.max}
					step={bounds.step}
					bind:value={() => [range[0], range[1]], onSliderValueChange}
					data-slot="data-table-slider-filter-slider"
					class="relative flex w-full touch-none items-center select-none"
				>
					{#snippet children({ thumbItems })}
						<span
							data-slot="data-table-slider-filter-track"
							class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted"
						>
							<Slider.Range
								data-slot="data-table-slider-filter-range"
								class="absolute h-full bg-primary"
							/>
						</span>
						{#each thumbItems as thumb (thumb.index)}
							<Slider.Thumb
								index={thumb.index}
								data-slot="data-table-slider-filter-thumb"
								class="block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm transition-[color,box-shadow] focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
							/>
						{/each}
					{/snippet}
				</Slider.Root>
			</div>
			<Button
				aria-label={`Clear ${title} filter`}
				variant="outline"
				size="sm"
				onclick={onReset}
				class="w-full"
			>
				Clear
			</Button>
		</Popover.Content>
	</Popover.Root>
</div>
