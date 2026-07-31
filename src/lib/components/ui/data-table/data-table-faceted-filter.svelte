<script lang="ts" module>
	import type { Column, RowData } from '@tanstack/table-core';

	import type { DataTableFilterAttributes, Option } from './types.js';

	export type DataTableFacetedFilterProps<
		TData extends RowData,
		TValue
	> = DataTableFilterAttributes & {
		/** The column being filtered. Without it the control renders but does nothing. */
		column?: Column<TData, TValue>;
		/** Trigger label, and the placeholder of the search input. */
		title?: string;
		/** The selectable values. */
		options: Option[];
		/**
		 * Allow more than one value. Single mode replaces the filter and closes the popover.
		 * @default false
		 */
		multiple?: boolean;
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

<script lang="ts" generics="TData extends RowData, TValue">
	import CheckIcon from '@lucide/svelte/icons/check';
	import PlusCircleIcon from '@lucide/svelte/icons/plus-circle';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		column,
		title,
		options,
		multiple = false,
		open = $bindable(false),
		onOpenChange,
		class: className,
		...restProps
	}: DataTableFacetedFilterProps<TData, TValue> = $props();

	const columnFilterValue = $derived(column?.getFilterValue());
	// Upstream keeps the selection in a `Set`; a plain array carries the same insertion order —
	// removal preserves it, a new value is appended — without a mutable built-in collection.
	const selectedValues = $derived(
		Array.isArray(columnFilterValue) ? columnFilterValue.map((value) => String(value)) : []
	);
	const selectedOptions = $derived(
		options.filter((option) => selectedValues.includes(option.value))
	);

	function onItemSelect(option: Option, isSelected: boolean) {
		if (!column) return;

		if (multiple) {
			const filterValues = isSelected
				? selectedValues.filter((value) => value !== option.value)
				: [...selectedValues, option.value];
			column.setFilterValue(filterValues.length ? filterValues : undefined);
		} else {
			column.setFilterValue(isSelected ? undefined : [option.value]);
			open = false;
		}
	}

	function onReset() {
		column?.setFilterValue(undefined);
	}
</script>

<div class="inline-flex items-center gap-1">
	{#if selectedValues.length > 0}
		<!--
			Upstream nests this affordance inside the trigger `<button>` as a
			`div role="button" tabIndex={0}` with a click handler only — it is not keyboard-operable
			and nests interactive content inside a button. Here it is a sibling `<button>` with the
			same icon, position and `aria-label` (plan.md Divergence 14, FR-014).
		-->
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
			data-slot="data-table-faceted-filter"
			data-multiple={multiple ? '' : undefined}
			data-selected={selectedValues.length > 0 ? '' : undefined}
			class={cn(
				buttonVariants({ variant: 'outline', size: 'sm' }),
				'border-dashed font-normal',
				className
			)}
			{...restProps}
		>
			{#if selectedValues.length === 0}
				<PlusCircleIcon />
			{/if}
			{title}
			{#if selectedValues.length > 0}
				<Separator orientation="vertical" class="mx-0.5 data-[orientation=vertical]:h-4" />
				<Badge variant="secondary" class="rounded-sm px-1 font-normal lg:hidden">
					{selectedValues.length}
				</Badge>
				<span class="hidden items-center gap-1 lg:flex">
					{#if selectedValues.length > 2}
						<Badge variant="secondary" class="rounded-sm px-1 font-normal">
							{selectedValues.length} selected
						</Badge>
					{:else}
						{#each selectedOptions as option (option.value)}
							<Badge variant="secondary" class="rounded-sm px-1 font-normal">
								{option.label}
							</Badge>
						{/each}
					{/if}
				</span>
			{/if}
		</Popover.Trigger>
		<Popover.Content class="w-50 p-0" align="start">
			<Command.Root>
				<Command.Input placeholder={title} />
				<Command.List class="max-h-full">
					<Command.Empty>No results found.</Command.Empty>
					<Command.Group class="max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto">
						{#each options as option (option.value)}
							{@const isSelected = selectedValues.includes(option.value)}
							<Command.Item
								value={option.value}
								keywords={[option.label]}
								data-checked={isSelected ? 'true' : undefined}
								onSelect={() => onItemSelect(option, isSelected)}
							>
								<div
									class={cn(
										'flex size-4 items-center justify-center rounded-sm border border-primary',
										isSelected ? 'bg-primary' : 'opacity-50 [&_svg]:invisible'
									)}
								>
									<CheckIcon />
								</div>
								{#if option.icon}
									{@const Icon = option.icon}
									<Icon />
								{/if}
								<span class="truncate">{option.label}</span>
								{#if option.count}
									<span class="ml-auto font-mono text-xs">{option.count}</span>
								{/if}
							</Command.Item>
						{/each}
					</Command.Group>
					{#if selectedValues.length > 0}
						<Command.Separator />
						<Command.Group>
							<Command.Item
								value="clear-filters"
								class="justify-center text-center"
								onSelect={onReset}
							>
								Clear filters
							</Command.Item>
						</Command.Group>
					{/if}
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
</div>
