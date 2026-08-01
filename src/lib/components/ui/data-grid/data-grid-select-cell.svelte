<script lang="ts" module>
	import type { RowData } from '@tanstack/table-core';

	import type { DataGridCellVariantProps } from './data-grid-cell-wrapper.svelte';

	export type DataGridSelectCellProps<TData extends RowData> = DataGridCellVariantProps<TData>;
</script>

<script lang="ts" generics="TData extends RowData">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Command from '$lib/components/ui/command/index.js';

	import DataGridCellWrapper from './data-grid-cell-wrapper.svelte';
	import { useDataGridContext } from './data-grid.svelte.js';

	let {
		grid: gridProp,
		cell,
		rowIndex,
		columnId,
		rowHeight,
		isEditing,
		isFocused,
		isSelected,
		isSearchMatch,
		isActiveSearchMatch,
		readOnly
	}: DataGridSelectCellProps<TData> = $props();

	const contextGrid = useDataGridContext<TData>(() => gridProp, '<DataGrid.Cell>');
	const grid = $derived(gridProp ?? contextGrid!);

	const cellOpts = $derived(cell.column.columnDef.meta?.cell);
	const options = $derived(cellOpts?.variant === 'select' ? cellOpts.options : []);
	const value = $derived(String(cell.getValue() ?? ''));
	const displayLabel = $derived(options.find((option) => option.value === value)?.label ?? value);

	function choose(next: string): void {
		if (readOnly) return;
		grid.updateData({ rowIndex, columnId, value: next });
		grid.stopEditing();
	}

	function handleWrapperKeydown(event: KeyboardEvent): void {
		if (isEditing && event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			grid.stopEditing();
			return;
		}

		// Tab on a resting cell is plain navigation: the grid's own handler owns it, so it must be
		// allowed to bubble.
	}
</script>

<DataGridCellWrapper
	{grid}
	{cell}
	{rowIndex}
	{columnId}
	{rowHeight}
	{isEditing}
	{isFocused}
	{isSelected}
	{isSearchMatch}
	{isActiveSearchMatch}
	{readOnly}
	data-slot="data-grid-select-cell"
	onkeydown={handleWrapperKeydown}
>
	{#if displayLabel}
		<Badge
			data-slot="data-grid-cell-content"
			variant="secondary"
			class="px-1.5 py-px whitespace-pre-wrap"
		>
			{displayLabel}
		</Badge>
	{/if}
	{#if isEditing}
		<!--
			The editor is anchored inline over the cell rather than portalled: bits-ui's Popover has
			no `Anchor` part, and upstream itself fakes an anchor with a negative `sideOffset` so the
			list opens flush with the cell (plan.md Divergence 11).
		-->
		<div
			data-grid-cell-editor=""
			data-slot="data-grid-cell-editor"
			class="absolute inset-x-0 top-0 z-50 w-[220px] rounded-md border bg-popover text-popover-foreground shadow-md"
		>
			<Command.Root>
				<Command.Input placeholder="Search..." aria-label="Search options" />
				<Command.List>
					<Command.Empty>No options found.</Command.Empty>
					<Command.Group>
						{#each options as option (option.value)}
							<Command.Item value={option.label} onSelect={() => choose(option.value)}>
								{option.label}
							</Command.Item>
						{/each}
					</Command.Group>
				</Command.List>
			</Command.Root>
		</div>
	{/if}
</DataGridCellWrapper>
