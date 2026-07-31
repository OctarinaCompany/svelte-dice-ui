<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/direction-provider.svelte.js';

	import type {
		SortableAccessibility,
		SortableCollisionDetection,
		SortableContentChildProps,
		SortableDragEvent,
		SortableItemChildProps,
		SortableItemHandleChildProps,
		SortableModifier,
		SortableMoveEvent,
		SortableOrientation,
		SortableStrategy,
		UniqueIdentifier
	} from './index.js';

	/**
	 * Which single composition this render exercises.
	 *
	 * A `.ts` spec cannot express `{#snippet child({ props })}`, a keyed `{#each}` over items,
	 * `bind:value`, `bind:ref`, a function binding, or a part with no provider ancestor, so
	 * everything needing a real parent component goes through this file. It is not collected by
	 * Vitest (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type SortableHarnessMode =
		| 'default'
		| 'primitive'
		| 'multi-region'
		| 'rtl-provider'
		| 'bare-content'
		| 'bare-item'
		| 'bare-item-handle'
		| 'bare-overlay'
		| 'item-outside-content'
		| 'empty-item-value';

	/** How the harness feeds `value` to the root, covering both halves of the controlled contract. */
	export type SortableHarnessValueMode =
		/** `defaultValue` only — the root owns the list, the harness renders its own static copy. */
		| 'uncontrolled'
		/** `bind:value` — writes flow back to the harness, so the rendered order follows. */
		| 'bound'
		/** `bind:value={() => …, (next) => …}` with a setter that declines every write. */
		| 'declined';

	export type SortableHarnessItem = { id: string; label: string; disabled?: boolean };

	/** Every `bind:ref` the harness captures, reported through {@link SortableHarnessProps.onRefs}. */
	export type SortableHarnessRefs = {
		content: HTMLDivElement | null;
		item: HTMLDivElement | null;
		handle: HTMLButtonElement | null;
	};

	export type SortableHarnessProps = {
		mode?: SortableHarnessMode;
		valueMode?: SortableHarnessValueMode;
		items?: SortableHarnessItem[];
		/** Drop `getItemValue` even for an object array — used by the FR-003 throw case. */
		withGetItemValue?: boolean;
		orientation?: SortableOrientation;
		strategy?: SortableStrategy;
		/** Per-region override handed to the first `<Sortable.Content>`. */
		contentStrategy?: SortableStrategy;
		/** Per-region override handed to the second `<Sortable.Content>` in `multi-region` mode. */
		secondContentStrategy?: SortableStrategy;
		collisionDetection?: SortableCollisionDetection;
		modifiers?: SortableModifier[];
		flatCursor?: boolean;
		withoutSlot?: boolean;
		dir?: Direction;
		providerDir?: Direction;
		accessibility?: SortableAccessibility;
		id?: string;
		/** The item itself is the drag activator. */
		asHandle?: boolean;
		/** Render a `<Sortable.ItemHandle>` inside every item. */
		withHandle?: boolean;
		/** Explicit `disabled` on the handle, overriding the item's. */
		handleDisabled?: boolean;
		contentAsChild?: boolean;
		itemAsChild?: boolean;
		handleAsChild?: boolean;
		withOverlay?: boolean;
		/** Drive the overlay's content from the active identifier instead of a fixed preview. */
		dynamicOverlay?: boolean;
		/** Render a `<Sortable.Item>` inside the overlay, as the primitive-values demo does. */
		overlayItem?: boolean;
		overlayContainer?: Element | DocumentFragment | string | null;
		overlayClass?: string;
		contentClass?: string;
		itemClass?: string;
		itemStyle?: string;
		handleClass?: string;
		onValueChange?: (items: SortableHarnessItem[]) => void;
		onPrimitiveValueChange?: (items: string[]) => void;
		onMove?: (event: SortableMoveEvent) => void;
		onDragStart?: (event: SortableDragEvent) => void;
		onDragMove?: (event: SortableDragEvent) => void;
		onDragOver?: (event: SortableDragEvent) => void;
		onDragEnd?: (event: SortableDragEvent) => void;
		onDragCancel?: (event: SortableDragEvent) => void;
		/** Drop the active item from the bound array as soon as the drag starts (research R-21). */
		removeActiveOnDragStart?: boolean;
		/** Called with every write the `declined` value mode refuses. */
		onDeclinedValue?: (items: SortableHarnessItem[]) => void;
		/** Called on every change to any captured `ref`, so a `.ts` spec can read them. */
		onRefs?: (refs: SortableHarnessRefs) => void;
	};

	const DEFAULT_ITEMS: SortableHarnessItem[] = [
		{ id: 'a', label: 'The 900' },
		{ id: 'b', label: 'Indy Backflip' },
		{ id: 'c', label: 'Pizza Guy' },
		{ id: 'd', label: 'Rocket Air' }
	];
</script>

<script lang="ts">
	import { untrack } from 'svelte';

	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import * as Sortable from './index.js';

	let {
		mode = 'default',
		valueMode = 'bound',
		items = DEFAULT_ITEMS,
		withGetItemValue = true,
		orientation,
		strategy,
		contentStrategy,
		secondContentStrategy,
		collisionDetection,
		modifiers,
		flatCursor,
		withoutSlot,
		dir,
		providerDir = 'rtl',
		accessibility,
		id,
		asHandle = true,
		withHandle = false,
		handleDisabled,
		contentAsChild = false,
		itemAsChild = false,
		handleAsChild = false,
		withOverlay = false,
		dynamicOverlay = false,
		overlayItem = false,
		overlayContainer,
		overlayClass,
		contentClass,
		itemClass,
		itemStyle,
		handleClass,
		onValueChange,
		onPrimitiveValueChange,
		onMove,
		onDragStart,
		onDragMove,
		onDragOver,
		onDragEnd,
		onDragCancel,
		removeActiveOnDragStart = false,
		onDeclinedValue,
		onRefs
	}: SortableHarnessProps = $props();

	function handleDragStart(event: SortableDragEvent) {
		onDragStart?.(event);
		if (removeActiveOnDragStart) {
			boundValue = boundValue.filter((item) => item.id !== event.active.id);
		}
	}

	// One-shot seeds from the initial prop, hence `untrack`.
	let boundValue = $state<SortableHarnessItem[]>(untrack(() => [...items]));
	let primitiveValue = $state<string[]>(untrack(() => items.map((item) => item.id)));

	/** Never written by the component — the `declined` mode's getter returns this snapshot instead. */
	const authoritative = untrack(() => [...items]);

	/**
	 * Which item carries the `bind:ref` branches. Keyed on identity rather than position, so a
	 * reorder does not swap `{#if}` branches and destroy the element the test is holding on to.
	 */
	const refItemId = untrack(() => items[0]?.id);

	/**
	 * Only `bound` mode lets the component's writes reach the markup. `uncontrolled` renders the
	 * harness's own static copy on purpose: that is what makes "the root moved but the consumer's
	 * array did not" observable through the live region rather than through the DOM order.
	 */
	const renderedItems = $derived(valueMode === 'bound' ? boundValue : items);

	let contentRef = $state<HTMLDivElement | null>(null);
	let itemRef = $state<HTMLDivElement | null>(null);
	let handleRef = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		onRefs?.({ content: contentRef, item: itemRef, handle: handleRef });
	});

	const getItemValue = $derived(
		withGetItemValue ? (item: SortableHarnessItem) => item.id : undefined
	);

	function labelOf(value: UniqueIdentifier): string {
		return items.find((item) => item.id === value)?.label ?? String(value);
	}
</script>

{#snippet itemChild({ props }: { props: SortableItemChildProps })}
	<article {...props as Record<string, unknown>} data-testid="item-child">child</article>
{/snippet}

{#snippet handleChild({ props }: { props: SortableItemHandleChildProps })}
	<span {...props as Record<string, unknown>} data-testid="handle-child">grip</span>
{/snippet}

{#snippet handle(item: SortableHarnessItem, first: boolean)}
	{#if handleAsChild}
		<Sortable.ItemHandle disabled={handleDisabled} class={handleClass} child={handleChild} />
	{:else if first}
		<Sortable.ItemHandle bind:ref={handleRef} disabled={handleDisabled} class={handleClass}>
			grip {item.id}
		</Sortable.ItemHandle>
	{:else}
		<Sortable.ItemHandle disabled={handleDisabled} class={handleClass}>
			grip {item.id}
		</Sortable.ItemHandle>
	{/if}
{/snippet}

{#snippet itemBody(item: SortableHarnessItem, first: boolean)}
	{#if withHandle}
		{@render handle(item, first)}
	{/if}
	<span data-testid="label-{item.id}">{item.label}</span>
{/snippet}

{#snippet objectItem(item: SortableHarnessItem, first: boolean)}
	{#if itemAsChild}
		<Sortable.Item
			value={item.id}
			{asHandle}
			disabled={item.disabled}
			class={itemClass}
			style={itemStyle}
			data-value={item.id}
			child={itemChild}
		/>
	{:else if first}
		<Sortable.Item
			bind:ref={itemRef}
			value={item.id}
			{asHandle}
			disabled={item.disabled}
			class={itemClass}
			style={itemStyle}
			data-value={item.id}
		>
			{@render itemBody(item, first)}
		</Sortable.Item>
	{:else}
		<Sortable.Item
			value={item.id}
			{asHandle}
			disabled={item.disabled}
			class={itemClass}
			style={itemStyle}
			data-value={item.id}
		>
			{@render itemBody(item, first)}
		</Sortable.Item>
	{/if}
{/snippet}

{#snippet itemList(list: SortableHarnessItem[])}
	{#each list as item (item.id)}
		{@render objectItem(item, item.id === refItemId)}
	{/each}
{/snippet}

{#snippet contentChild({ props }: { props: SortableContentChildProps })}
	<section {...props as Record<string, unknown>} data-testid="content-child">
		{@render itemList(renderedItems)}
	</section>
{/snippet}

{#snippet fixedOverlayContent()}
	<div data-testid="overlay-preview">preview</div>
{/snippet}

{#snippet overlay()}
	{#if withOverlay}
		{#if overlayItem}
			<Sortable.Overlay container={overlayContainer} class={overlayClass}>
				{#snippet children({ value })}
					<Sortable.Item {value} data-value={value} data-testid="overlay-item">
						{labelOf(value)}
					</Sortable.Item>
				{/snippet}
			</Sortable.Overlay>
		{:else if dynamicOverlay}
			<Sortable.Overlay container={overlayContainer} class={overlayClass}>
				{#snippet children({ value })}
					<div data-testid="overlay-preview">{labelOf(value)}</div>
				{/snippet}
			</Sortable.Overlay>
		{:else}
			<Sortable.Overlay
				container={overlayContainer}
				class={overlayClass}
				children={fixedOverlayContent}
			/>
		{/if}
	{/if}
{/snippet}

{#snippet regions()}
	{#if mode === 'multi-region'}
		<Sortable.Content
			bind:ref={contentRef}
			strategy={contentStrategy}
			class={contentClass}
			data-testid="region-1"
		>
			{@render itemList(renderedItems.slice(0, 2))}
		</Sortable.Content>
		<Sortable.Content strategy={secondContentStrategy} data-testid="region-2">
			{@render itemList(renderedItems.slice(2))}
		</Sortable.Content>
	{:else if mode === 'item-outside-content'}
		<Sortable.Item value="loose">loose</Sortable.Item>
	{:else if mode === 'empty-item-value'}
		<Sortable.Content>
			<Sortable.Item value="">empty</Sortable.Item>
		</Sortable.Content>
	{:else if contentAsChild}
		<Sortable.Content strategy={contentStrategy} class={contentClass} child={contentChild} />
	{:else}
		<Sortable.Content
			bind:ref={contentRef}
			strategy={contentStrategy}
			{withoutSlot}
			class={contentClass}
			data-testid="content"
		>
			{@render itemList(renderedItems)}
		</Sortable.Content>
	{/if}
	{@render overlay()}
{/snippet}

{#snippet primitiveRegion()}
	<Sortable.Content class={contentClass} data-testid="content">
		{#each primitiveValue as value (value)}
			<Sortable.Item {value} {asHandle} class={itemClass} data-value={value}>
				<span data-testid="label-{value}">{labelOf(value)}</span>
			</Sortable.Item>
		{/each}
	</Sortable.Content>
	{@render overlay()}
{/snippet}

{#snippet objectRoot()}
	{#if valueMode === 'uncontrolled'}
		<Sortable.Root
			defaultValue={[...items]}
			{onValueChange}
			{getItemValue}
			{onMove}
			{orientation}
			{strategy}
			{collisionDetection}
			{modifiers}
			{flatCursor}
			{dir}
			{id}
			{accessibility}
			onDragStart={handleDragStart}
			{onDragMove}
			{onDragOver}
			{onDragEnd}
			{onDragCancel}
		>
			{@render regions()}
		</Sortable.Root>
	{:else if valueMode === 'declined'}
		<Sortable.Root
			bind:value={() => authoritative, (next) => onDeclinedValue?.(next)}
			{onValueChange}
			{getItemValue}
			{onMove}
			{orientation}
			{strategy}
			{collisionDetection}
			{modifiers}
			{flatCursor}
			{dir}
			{id}
			{accessibility}
			onDragStart={handleDragStart}
			{onDragMove}
			{onDragOver}
			{onDragEnd}
			{onDragCancel}
		>
			{@render regions()}
		</Sortable.Root>
	{:else}
		<Sortable.Root
			bind:value={boundValue}
			{onValueChange}
			{getItemValue}
			{onMove}
			{orientation}
			{strategy}
			{collisionDetection}
			{modifiers}
			{flatCursor}
			{dir}
			{id}
			{accessibility}
			onDragStart={handleDragStart}
			{onDragMove}
			{onDragOver}
			{onDragEnd}
			{onDragCancel}
		>
			{@render regions()}
		</Sortable.Root>
	{/if}
{/snippet}

{#snippet primitiveRoot()}
	<Sortable.Root
		bind:value={primitiveValue}
		onValueChange={onPrimitiveValueChange}
		{orientation}
		{flatCursor}
		{dir}
		{id}
		{accessibility}
		onDragStart={handleDragStart}
		{onDragEnd}
		{onDragCancel}
	>
		{@render primitiveRegion()}
	</Sortable.Root>
{/snippet}

{#snippet root()}
	{#if mode === 'primitive'}
		{@render primitiveRoot()}
	{:else}
		{@render objectRoot()}
	{/if}
{/snippet}

{#if mode === 'bare-content'}
	<Sortable.Content>bare</Sortable.Content>
{:else if mode === 'bare-item'}
	<Sortable.Item value="bare">bare</Sortable.Item>
{:else if mode === 'bare-item-handle'}
	<Sortable.ItemHandle>bare</Sortable.ItemHandle>
{:else if mode === 'bare-overlay'}
	<Sortable.Overlay children={fixedOverlayContent} />
{:else if mode === 'rtl-provider'}
	<DirectionProvider dir={providerDir}>
		{@render root()}
	</DirectionProvider>
{:else}
	{@render root()}
{/if}
