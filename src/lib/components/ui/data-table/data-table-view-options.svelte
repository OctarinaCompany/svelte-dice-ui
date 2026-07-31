<script lang="ts" module>
	import type { RowData, Table } from '@tanstack/table-core';
	import type { Popover as PopoverPrimitive } from 'bits-ui';

	import type { WithoutChildrenOrChild } from '$lib/utils.js';

	/**
	 * Upstream types this part as `React.ComponentProps<typeof PopoverContent>`, so `side`,
	 * `sideOffset`, `avoidCollisions` and the rest of the content surface stay configurable. The
	 * same widening applies here — minus `ref`, which binds the *trigger*, not the content.
	 */
	export type DataTableViewOptionsProps<TData extends RowData> = Omit<
		WithoutChildrenOrChild<PopoverPrimitive.ContentProps>,
		'ref'
	> & {
		/**
		 * The table whose columns are toggled. Falls back to the instance published by
		 * `<DataTable.Root>` (plan.md Divergence 9).
		 */
		table?: Table<TData>;
		/**
		 * Disable the trigger.
		 * @default false
		 */
		disabled?: boolean;
		/**
		 * Let the list be dragged to reorder columns, writing `table.setColumnOrder(...)`.
		 * Upstream ships no reorder UI, so this is additive and off by default
		 * (plan.md Divergence 12, research D-07).
		 * @default false
		 */
		reorderable?: boolean;
		/**
		 * Whether the popover is open. Bindable.
		 * @default false
		 */
		open?: boolean;
		/** Called whenever the popover opens or closes. */
		onOpenChange?: (open: boolean) => void;
		/**
		 * Popover alignment.
		 * @default 'end'
		 */
		align?: 'start' | 'center' | 'end';
		/** The trigger element. */
		ref?: HTMLElement | null;
	};
</script>

<script lang="ts" generics="TData extends RowData">
	import CheckIcon from '@lucide/svelte/icons/check';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import Settings2Icon from '@lucide/svelte/icons/settings-2';

	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Sortable from '$lib/components/ui/sortable/index.js';
	import { cn } from '$lib/utils.js';

	import { useDataTableInstance } from './data-table.svelte.js';

	let {
		ref = $bindable(null),
		table: tableProp,
		disabled = false,
		reorderable = false,
		open = $bindable(false),
		onOpenChange,
		align = 'end',
		class: className,
		...restProps
	}: DataTableViewOptionsProps<TData> = $props();

	const instance = useDataTableInstance(() => tableProp);
	const table = $derived(instance.current);

	// Upstream's filter: an accessor column that may be hidden. It is what excludes the `select`
	// and `actions` columns from the list.
	const columns = $derived(
		table
			.getAllColumns()
			.filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide())
	);

	const columnIds = $derived(columns.map((column) => column.id));

	function labelFor(id: string): string {
		const column = columns.find((candidate) => candidate.id === id);
		return column?.columnDef.meta?.label ?? id;
	}

	function isVisible(id: string): boolean {
		return columns.find((candidate) => candidate.id === id)?.getIsVisible() ?? false;
	}

	function toggle(id: string) {
		const column = columns.find((candidate) => candidate.id === id);
		column?.toggleVisibility(!column.getIsVisible());
	}

	/**
	 * The reorder writes the *full* column order, not just the hideable subset: the list only ever
	 * shows accessor columns, so the columns it does not show keep their current relative position.
	 */
	function onOrderChange(nextVisibleOrder: string[]) {
		const all = table.getAllLeafColumns().map((column) => column.id);
		const movable = new Set(nextVisibleOrder);
		let cursor = 0;
		const next = all.map((id) => (movable.has(id) ? (nextVisibleOrder[cursor++] ?? id) : id));
		table.setColumnOrder(next);
	}
</script>

<Popover.Root bind:open {onOpenChange}>
	<Popover.Trigger
		bind:ref
		{disabled}
		role="combobox"
		aria-label="Toggle columns"
		data-slot="data-table-view-options"
		data-reorderable={reorderable ? '' : undefined}
		class={cn(
			buttonVariants({ variant: 'outline', size: 'sm' }),
			'ml-auto hidden h-8 font-normal lg:flex'
		)}
	>
		<Settings2Icon class="text-muted-foreground" />
		View
	</Popover.Trigger>
	<Popover.Content {align} class={cn('w-44 p-0', className)} {...restProps}>
		<Command.Root>
			<Command.Input placeholder="Search columns..." />
			<Command.List>
				<Command.Empty>No columns found.</Command.Empty>
				<Command.Group>
					{#if reorderable}
						<Sortable.Root value={columnIds} onValueChange={onOrderChange} orientation="vertical">
							<Sortable.Content withoutSlot>
								{#each columnIds as id (id)}
									<Sortable.Item value={id}>
										{#snippet child({ props })}
											<Command.Item
												{...props}
												value={id}
												keywords={[labelFor(id)]}
												data-checked={isVisible(id) ? 'true' : undefined}
												onSelect={() => toggle(id)}
											>
												<Sortable.ItemHandle
													class="-ml-1 cursor-grab text-muted-foreground [&_svg]:size-3.5"
													aria-label={`Reorder ${labelFor(id)}`}
												>
													<GripVerticalIcon />
												</Sortable.ItemHandle>
												<span class="truncate">{labelFor(id)}</span>
												<CheckIcon
													class={cn(
														'ml-auto size-4 shrink-0',
														isVisible(id) ? 'opacity-100' : 'opacity-0'
													)}
												/>
											</Command.Item>
										{/snippet}
									</Sortable.Item>
								{/each}
							</Sortable.Content>
						</Sortable.Root>
					{:else}
						{#each columns as column (column.id)}
							<Command.Item
								value={column.id}
								keywords={[column.columnDef.meta?.label ?? column.id]}
								data-checked={column.getIsVisible() ? 'true' : undefined}
								onSelect={() => column.toggleVisibility(!column.getIsVisible())}
							>
								<span class="truncate">{column.columnDef.meta?.label ?? column.id}</span>
								<CheckIcon
									class={cn(
										'ml-auto size-4 shrink-0',
										column.getIsVisible() ? 'opacity-100' : 'opacity-0'
									)}
								/>
							</Command.Item>
						{/each}
					{/if}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
