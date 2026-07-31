<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/direction-provider.svelte.js';
	import type {
		SortableModifier,
		SortableStrategy,
		UniqueIdentifier
	} from '$lib/components/ui/sortable/index.js';

	import type { KanbanColumnChildProps } from './kanban-column.svelte';
	import type { KanbanColumnHandleChildProps } from './kanban-column-handle.svelte';
	import type { KanbanItemChildProps } from './kanban-item.svelte';
	import type { KanbanItemHandleChildProps } from './kanban-item-handle.svelte';
	import type {
		KanbanAccessibility,
		KanbanDragEvent,
		KanbanMoveEvent,
		KanbanOrientation,
		KanbanOverlayVariant
	} from './kanban.svelte.js';

	/**
	 * Which single composition this render exercises.
	 *
	 * A `.ts` spec cannot express `{#snippet child({ props })}`, a keyed `{#each}` over columns and
	 * items, `bind:value`, `bind:ref`, a function binding, or a part with no provider ancestor, so
	 * everything needing a real parent component goes through this file. It is not collected by
	 * Vitest (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 *
	 * Every part is imported from its own `.svelte` file rather than from `./index.js`, so the whole
	 * suite compiles before the barrel exists.
	 */
	export type KanbanHarnessMode =
		| 'default'
		| 'primitive'
		| 'rtl-provider'
		| 'bare-board'
		| 'bare-column'
		| 'bare-column-handle'
		| 'bare-item'
		| 'bare-item-handle'
		| 'bare-overlay'
		| 'column-outside-board'
		| 'item-outside-board'
		| 'empty-column-value'
		| 'empty-item-value'
		| 'object-without-getter';

	/** How the harness feeds `value` to the root, covering both halves of the controlled contract. */
	export type KanbanHarnessValueMode =
		/** `defaultValue` only — the root owns the board, the harness renders its own static copy. */
		| 'uncontrolled'
		/** `bind:value` — writes flow back to the harness, so the rendered board follows. */
		| 'bound'
		/** `bind:value={() => …, (next) => …}` with a setter that declines every write. */
		| 'declined';

	export type KanbanHarnessTask = { id: string; title: string };

	export type KanbanHarnessValue = Record<string, KanbanHarnessTask[]>;

	/** Every `bind:ref` the harness captures, reported through {@link KanbanHarnessProps.onRefs}. */
	export type KanbanHarnessRefs = {
		board: HTMLDivElement | null;
		column: HTMLDivElement | null;
		columnHandle: HTMLButtonElement | null;
		item: HTMLDivElement | null;
		itemHandle: HTMLButtonElement | null;
	};

	export type KanbanHarnessProps = {
		mode?: KanbanHarnessMode;
		valueMode?: KanbanHarnessValueMode;
		columns?: KanbanHarnessValue;
		orientation?: KanbanOrientation;
		strategy?: SortableStrategy;
		modifiers?: SortableModifier[];
		flatCursor?: boolean;
		dir?: Direction;
		providerDir?: Direction;
		accessibility?: KanbanAccessibility;
		id?: string;
		/** The column itself is the drag activator. */
		columnAsHandle?: boolean;
		/** The item itself is the drag activator. */
		itemAsHandle?: boolean;
		/** Render a `<Kanban.ColumnHandle>` inside every column. */
		withColumnHandle?: boolean;
		/** Render a `<Kanban.ItemHandle>` inside every item. */
		withItemHandle?: boolean;
		/** Explicit `disabled` on the column handle, overriding the column's. */
		columnHandleDisabled?: boolean;
		/** Explicit `disabled` on the item handle, overriding the item's. */
		itemHandleDisabled?: boolean;
		disabledColumns?: string[];
		disabledItems?: string[];
		columnAsChild?: boolean;
		itemAsChild?: boolean;
		columnHandleAsChild?: boolean;
		itemHandleAsChild?: boolean;
		withOverlay?: boolean;
		/** Drive the overlay's content from the active identifier instead of a fixed preview. */
		dynamicOverlay?: boolean;
		/** Render a whole `<Kanban.Column>` preview inside the overlay for a column drag. */
		overlayColumnPreview?: boolean;
		overlayContainer?: Element | DocumentFragment | string | null;
		overlayClass?: string;
		boardClass?: string;
		columnClass?: string;
		itemClass?: string;
		itemStyle?: string;
		columnHandleClass?: string;
		itemHandleClass?: string;
		onValueChange?: (columns: KanbanHarnessValue) => void;
		onPrimitiveValueChange?: (columns: Record<string, string[]>) => void;
		onMove?: (event: KanbanMoveEvent) => void;
		onDragStart?: (event: KanbanDragEvent) => void;
		onDragMove?: (event: KanbanDragEvent) => void;
		onDragOver?: (event: KanbanDragEvent) => void;
		onDragEnd?: (event: KanbanDragEvent) => void;
		onDragCancel?: (event: KanbanDragEvent) => void;
		/** Called with every write the `declined` value mode refuses. */
		onDeclinedValue?: (columns: KanbanHarnessValue) => void;
		/** Called on every change to any captured `ref`, so a `.ts` spec can read them. */
		onRefs?: (refs: KanbanHarnessRefs) => void;
		/** Reports what the root publishes as `strategy` on its context, through the probe. */
		onStrategy?: (strategy: SortableStrategy | undefined) => void;
	};

	/** Three columns: a populated source, a populated destination and an empty one. */
	export const KANBAN_HARNESS_COLUMNS: KanbanHarnessValue = {
		todo: [
			{ id: 'a', title: 'Add authentication' },
			{ id: 'b', title: 'Create API endpoints' },
			{ id: 'c', title: 'Write documentation' }
		],
		doing: [{ id: 'd', title: 'Design system updates' }],
		done: []
	};
</script>

<script lang="ts">
	import { untrack } from 'svelte';

	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import Board from './kanban-board.svelte';
	import ColumnHandle from './kanban-column-handle.svelte';
	import Column from './kanban-column.svelte';
	import ItemHandle from './kanban-item-handle.svelte';
	import Item from './kanban-item.svelte';
	import Overlay from './kanban-overlay.svelte';
	import Probe from './kanban.test-probe.svelte';
	import Root from './kanban.svelte';

	let {
		mode = 'default',
		valueMode = 'bound',
		columns = KANBAN_HARNESS_COLUMNS,
		orientation,
		strategy,
		modifiers,
		flatCursor,
		dir,
		providerDir = 'rtl',
		accessibility,
		id,
		columnAsHandle = false,
		itemAsHandle = true,
		withColumnHandle = true,
		withItemHandle = false,
		columnHandleDisabled,
		itemHandleDisabled,
		disabledColumns = [],
		disabledItems = [],
		columnAsChild = false,
		itemAsChild = false,
		columnHandleAsChild = false,
		itemHandleAsChild = false,
		withOverlay = false,
		dynamicOverlay = false,
		overlayColumnPreview = false,
		overlayContainer,
		overlayClass,
		boardClass,
		columnClass,
		itemClass,
		itemStyle,
		columnHandleClass,
		itemHandleClass,
		onValueChange,
		onPrimitiveValueChange,
		onMove,
		onDragStart,
		onDragMove,
		onDragOver,
		onDragEnd,
		onDragCancel,
		onDeclinedValue,
		onRefs,
		onStrategy
	}: KanbanHarnessProps = $props();

	/** One-shot seeds from the initial prop, hence `untrack`. */
	let boundValue = $state<KanbanHarnessValue>(untrack(() => cloneColumns(columns)));
	let primitiveValue = $state<Record<string, string[]>>(
		untrack(() =>
			Object.fromEntries(
				Object.entries(columns).map(([key, tasks]) => [key, tasks.map((task) => task.id)])
			)
		)
	);

	/** Never written by the component — the `declined` mode's getter returns this snapshot instead. */
	const authoritative = untrack(() => cloneColumns(columns));

	/** Which column and item carry the `bind:ref` branches, keyed on identity rather than position. */
	const refColumnId = untrack(() => Object.keys(columns)[0]);
	const refItemId = untrack(() => Object.values(columns).flat()[0]?.id);

	function cloneColumns(source: KanbanHarnessValue): KanbanHarnessValue {
		return Object.fromEntries(Object.entries(source).map(([key, tasks]) => [key, [...tasks]]));
	}

	/**
	 * Only `bound` mode lets the component's writes reach the markup. `uncontrolled` renders the
	 * harness's own static copy on purpose: that is what makes "the root moved but the consumer's
	 * record did not" observable through the live region rather than through the DOM order.
	 */
	const renderedColumns = $derived(valueMode === 'bound' ? boundValue : columns);

	let boardRef = $state<HTMLDivElement | null>(null);
	let columnRef = $state<HTMLDivElement | null>(null);
	let columnHandleRef = $state<HTMLButtonElement | null>(null);
	let itemRef = $state<HTMLDivElement | null>(null);
	let itemHandleRef = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		onRefs?.({
			board: boardRef,
			column: columnRef,
			columnHandle: columnHandleRef,
			item: itemRef,
			itemHandle: itemHandleRef
		});
	});

	const getItemValue = $derived(
		mode === 'object-without-getter' ? undefined : (task: KanbanHarnessTask) => task.id
	);

	function titleOf(value: UniqueIdentifier): string {
		return (
			Object.values(columns)
				.flat()
				.find((task) => task.id === value)?.title ?? String(value)
		);
	}
</script>

{#snippet columnHandleChild({ props }: { props: KanbanColumnHandleChildProps })}
	<span {...props as Record<string, unknown>} data-testid="column-handle-child">grip</span>
{/snippet}

{#snippet itemHandleChild({ props }: { props: KanbanItemHandleChildProps })}
	<span {...props as Record<string, unknown>} data-testid="item-handle-child">grip</span>
{/snippet}

{#snippet columnHandle(columnId: string)}
	{#if columnHandleAsChild}
		<ColumnHandle
			disabled={columnHandleDisabled}
			class={columnHandleClass}
			child={columnHandleChild}
		/>
	{:else if columnId === refColumnId}
		<ColumnHandle
			bind:ref={columnHandleRef}
			disabled={columnHandleDisabled}
			class={columnHandleClass}
		>
			grip {columnId}
		</ColumnHandle>
	{:else}
		<ColumnHandle disabled={columnHandleDisabled} class={columnHandleClass}>
			grip {columnId}
		</ColumnHandle>
	{/if}
{/snippet}

{#snippet itemHandle(taskId: string)}
	{#if itemHandleAsChild}
		<ItemHandle disabled={itemHandleDisabled} class={itemHandleClass} child={itemHandleChild} />
	{:else if taskId === refItemId}
		<ItemHandle bind:ref={itemHandleRef} disabled={itemHandleDisabled} class={itemHandleClass}>
			grip {taskId}
		</ItemHandle>
	{:else}
		<ItemHandle disabled={itemHandleDisabled} class={itemHandleClass}>
			grip {taskId}
		</ItemHandle>
	{/if}
{/snippet}

{#snippet itemBody(task: KanbanHarnessTask)}
	{#if withItemHandle}
		{@render itemHandle(task.id)}
	{/if}
	<span data-testid="title-{task.id}">{task.title}</span>
{/snippet}

{#snippet itemChild({ props }: { props: KanbanItemChildProps })}
	<article {...props as Record<string, unknown>} data-testid="item-child">child</article>
{/snippet}

{#snippet task(item: KanbanHarnessTask)}
	{#if itemAsChild}
		<Item
			value={item.id}
			asHandle={itemAsHandle}
			disabled={disabledItems.includes(item.id)}
			class={itemClass}
			style={itemStyle}
			child={itemChild}
		/>
	{:else if item.id === refItemId}
		<Item
			bind:ref={itemRef}
			value={item.id}
			asHandle={itemAsHandle}
			disabled={disabledItems.includes(item.id)}
			class={itemClass}
			style={itemStyle}
		>
			{@render itemBody(item)}
		</Item>
	{:else}
		<Item
			value={item.id}
			asHandle={itemAsHandle}
			disabled={disabledItems.includes(item.id)}
			class={itemClass}
			style={itemStyle}
		>
			{@render itemBody(item)}
		</Item>
	{/if}
{/snippet}

{#snippet columnBody(columnId: string, tasks: KanbanHarnessTask[])}
	{#if withColumnHandle}
		{@render columnHandle(columnId)}
	{/if}
	{#each tasks as item (item.id)}
		{@render task(item)}
	{/each}
{/snippet}

{#snippet columnChild({ props }: { props: KanbanColumnChildProps })}
	<section {...props as Record<string, unknown>} data-testid="column-child">child</section>
{/snippet}

{#snippet boardColumn(columnId: string, tasks: KanbanHarnessTask[])}
	{#if columnAsChild}
		<Column
			value={columnId}
			asHandle={columnAsHandle}
			disabled={disabledColumns.includes(columnId)}
			class={columnClass}
			child={columnChild}
		/>
	{:else if columnId === refColumnId}
		<Column
			bind:ref={columnRef}
			value={columnId}
			asHandle={columnAsHandle}
			disabled={disabledColumns.includes(columnId)}
			class={columnClass}
		>
			{@render columnBody(columnId, tasks)}
		</Column>
	{:else}
		<Column
			value={columnId}
			asHandle={columnAsHandle}
			disabled={disabledColumns.includes(columnId)}
			class={columnClass}
		>
			{@render columnBody(columnId, tasks)}
		</Column>
	{/if}
{/snippet}

{#snippet fixedOverlayContent()}
	<div data-testid="overlay-preview">preview</div>
{/snippet}

{#snippet overlay()}
	{#if withOverlay}
		{#if dynamicOverlay}
			<Overlay container={overlayContainer} class={overlayClass}>
				{#snippet children({
					value,
					variant
				}: {
					value: UniqueIdentifier;
					variant: KanbanOverlayVariant;
				})}
					{#if overlayColumnPreview && variant === 'column'}
						<Column value={String(value)} data-testid="overlay-column">
							{@render columnBody(String(value), renderedColumns[String(value)] ?? [])}
						</Column>
					{:else}
						<div data-testid="overlay-preview" data-variant={variant}>{titleOf(value)}</div>
					{/if}
				{/snippet}
			</Overlay>
		{:else}
			<Overlay container={overlayContainer} class={overlayClass} children={fixedOverlayContent} />
		{/if}
	{/if}
{/snippet}

{#snippet board()}
	{#if mode === 'column-outside-board'}
		<Column value="loose">loose</Column>
	{:else if mode === 'item-outside-board'}
		<Item value="loose">loose</Item>
	{:else if mode === 'empty-column-value'}
		<Board>
			<Column value="">empty</Column>
		</Board>
	{:else if mode === 'empty-item-value'}
		<Board>
			<Column value="todo">
				<Item value="">empty</Item>
			</Column>
		</Board>
	{:else}
		<Board bind:ref={boardRef} class={boardClass} data-testid="board">
			{#each Object.entries(renderedColumns) as [columnId, tasks] (columnId)}
				{@render boardColumn(columnId, tasks)}
			{/each}
		</Board>
	{/if}
	{@render overlay()}
	{#if onStrategy}
		<Probe {onStrategy} />
	{/if}
{/snippet}

{#snippet primitiveBoard()}
	<Board class={boardClass} data-testid="board">
		{#each Object.entries(primitiveValue) as [columnId, tasks] (columnId)}
			<Column value={columnId}>
				{#each tasks as value (value)}
					<Item {value} asHandle={itemAsHandle}>
						<span data-testid="title-{value}">{titleOf(value)}</span>
					</Item>
				{/each}
			</Column>
		{/each}
	</Board>
	{@render overlay()}
{/snippet}

{#snippet objectRoot()}
	{#if valueMode === 'uncontrolled'}
		<Root
			defaultValue={cloneColumns(columns)}
			{onValueChange}
			{getItemValue}
			{onMove}
			{orientation}
			{strategy}
			{modifiers}
			{flatCursor}
			{dir}
			{id}
			{accessibility}
			{onDragStart}
			{onDragMove}
			{onDragOver}
			{onDragEnd}
			{onDragCancel}
		>
			{@render board()}
		</Root>
	{:else if valueMode === 'declined'}
		<Root
			bind:value={() => authoritative, (next) => onDeclinedValue?.(next)}
			{onValueChange}
			{getItemValue}
			{onMove}
			{orientation}
			{strategy}
			{modifiers}
			{flatCursor}
			{dir}
			{id}
			{accessibility}
			{onDragStart}
			{onDragMove}
			{onDragOver}
			{onDragEnd}
			{onDragCancel}
		>
			{@render board()}
		</Root>
	{:else}
		<Root
			bind:value={boundValue}
			{onValueChange}
			{getItemValue}
			{onMove}
			{orientation}
			{strategy}
			{modifiers}
			{flatCursor}
			{dir}
			{id}
			{accessibility}
			{onDragStart}
			{onDragMove}
			{onDragOver}
			{onDragEnd}
			{onDragCancel}
		>
			{@render board()}
		</Root>
	{/if}
{/snippet}

{#snippet primitiveRoot()}
	<Root
		bind:value={primitiveValue}
		onValueChange={onPrimitiveValueChange}
		{orientation}
		{flatCursor}
		{dir}
		{id}
		{accessibility}
		{onDragStart}
		{onDragEnd}
		{onDragCancel}
	>
		{@render primitiveBoard()}
	</Root>
{/snippet}

{#snippet root()}
	{#if mode === 'primitive'}
		{@render primitiveRoot()}
	{:else}
		{@render objectRoot()}
	{/if}
{/snippet}

{#if mode === 'bare-board'}
	<Board>bare</Board>
{:else if mode === 'bare-column'}
	<Column value="bare">bare</Column>
{:else if mode === 'bare-column-handle'}
	<ColumnHandle>bare</ColumnHandle>
{:else if mode === 'bare-item'}
	<Item value="bare">bare</Item>
{:else if mode === 'bare-item-handle'}
	<ItemHandle>bare</ItemHandle>
{:else if mode === 'bare-overlay'}
	<Overlay children={fixedOverlayContent} />
{:else if mode === 'rtl-provider'}
	<DirectionProvider dir={providerDir}>
		{@render root()}
	</DirectionProvider>
{:else}
	{@render root()}
{/if}
