<script lang="ts" module>
	import type { RowData } from '@tanstack/table-core';

	import type { DataGridCellVariantProps } from './data-grid-cell-wrapper.svelte';

	export type DataGridDateCellProps<TData extends RowData> = DataGridCellVariantProps<TData>;
</script>

<script lang="ts" generics="TData extends RowData">
	import { CalendarDate, getLocalTimeZone, type DateValue } from '@internationalized/date';

	import { Calendar } from '$lib/components/ui/calendar/index.js';

	import DataGridCellWrapper from './data-grid-cell-wrapper.svelte';
	import { formatDateForDisplay, formatDateToString, parseLocalDate } from './data-grid-utils.js';
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
	}: DataGridDateCellProps<TData> = $props();

	const contextGrid = useDataGridContext<TData>(() => gridProp, '<DataGrid.Cell>');
	const grid = $derived(gridProp ?? contextGrid!);

	const rawValue = $derived(cell.getValue());
	const selectedDate = $derived(parseLocalDate(rawValue));
	const calendarValue = $derived(
		selectedDate
			? new CalendarDate(
					selectedDate.getFullYear(),
					selectedDate.getMonth() + 1,
					selectedDate.getDate()
				)
			: undefined
	);

	function handleSelect(next: DateValue | undefined): void {
		if (!next || readOnly) return;
		grid.updateData({
			rowIndex,
			columnId,
			value: formatDateToString(next.toDate(getLocalTimeZone()))
		});
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
	data-slot="data-grid-date-cell"
	onkeydown={handleWrapperKeydown}
>
	<span data-slot="data-grid-cell-content">{formatDateForDisplay(rawValue)}</span>
	{#if isEditing}
		<div
			data-grid-cell-editor=""
			data-slot="data-grid-cell-editor"
			class="absolute inset-x-0 top-0 z-50 w-auto rounded-md border bg-popover text-popover-foreground shadow-md"
		>
			<Calendar
				type="single"
				captionLayout="dropdown"
				value={calendarValue}
				onValueChange={handleSelect}
			/>
		</div>
	{/if}
</DataGridCellWrapper>
