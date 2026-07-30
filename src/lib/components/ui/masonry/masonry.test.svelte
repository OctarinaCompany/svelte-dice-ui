<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/direction-provider.svelte.js';

	import type { MasonryChildProps, MasonryItemChildProps, MasonryState } from './index.js';

	/**
	 * Which single path this render exercises: the plain tree, one part rendered through its `child`
	 * snippet, a `<Masonry.Item>` with no `<Masonry.Root>` ancestor (guard rails), or the internal
	 * viewport rendered on its own against a never-mounted state (the SSR branch).
	 *
	 * A `.ts` spec cannot express `{#snippet child({ props })}`, a keyed `{#each}` over items,
	 * `bind:ref`, or a part with no provider ancestor, so everything needing a real parent component
	 * goes through this file. It is not collected by Vitest (`include` is `.{js,ts}`) and is not
	 * listed in `registry.json`.
	 */
	export type MasonryHarnessMode =
		'default' | 'root-child' | 'item-child' | 'bare-item' | 'rtl-provider' | 'viewport-fallback';

	/** One rendered `<Masonry.Item>`. `height` is what the `offsetHeight` stub reports for it. */
	export type MasonryHarnessItem = {
		id: string;
		height: number;
		/** Pins the layout index, overriding registration order (research R-02). */
		index?: number;
	};

	/** Every `bind:ref` the harness captures, reported through {@link MasonryHarnessProps.onRefs}. */
	export type MasonryHarnessRefs = {
		root: HTMLDivElement | null;
		item: HTMLDivElement | null;
	};

	export type MasonryHarnessProps = {
		mode?: MasonryHarnessMode;
		items?: MasonryHarnessItem[];
		columnWidth?: number;
		columnCount?: number;
		maxColumnCount?: number;
		gap?: number | { column: number; row: number };
		itemHeight?: number;
		defaultWidth?: number;
		defaultHeight?: number;
		overscan?: number;
		scrollFps?: number;
		linear?: boolean;
		dir?: Direction;
		class?: string;
		style?: string;
		itemClass?: string;
		itemStyle?: string;
		/** Render the `fallback` snippet, so the SSR path can be exercised (US3). */
		withFallback?: boolean;
		/** Render a focusable `<button>` inside every item, for the tab-order assertions. */
		withFocusable?: boolean;
		/** The `dir` the `rtl-provider` mode's `<DirectionProvider>` publishes. */
		providerDir?: Direction;
		id?: string;
		'aria-label'?: string;
		'data-testid'?: string;
		/** Called on every change to any captured `ref`, so a `.ts` spec can read them. */
		onRefs?: (refs: MasonryHarnessRefs) => void;
		/**
		 * Called once with the state `viewport-fallback` mode publishes, so a `.ts` spec can flip
		 * `mounted` by hand. Never called in any other mode.
		 */
		onState?: (state: MasonryState) => void;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';
	import * as Masonry from './index.js';
	// The internal sizing part is deliberately absent from the barrel; the harness is colocated with
	// it, so importing the file directly is the only way to reach its unmounted branch.
	import MasonryViewport from './masonry-viewport.svelte';

	let {
		mode = 'default',
		items = [],
		columnWidth,
		columnCount,
		maxColumnCount,
		gap,
		itemHeight,
		defaultWidth,
		defaultHeight,
		overscan,
		scrollFps,
		linear,
		dir,
		class: className,
		style,
		itemClass,
		itemStyle,
		withFallback = false,
		withFocusable = false,
		providerDir = 'rtl',
		id,
		'aria-label': ariaLabel,
		'data-testid': dataTestId,
		onRefs,
		onState
	}: MasonryHarnessProps = $props();

	let rootRef = $state<HTMLDivElement | null>(null);
	let itemRef = $state<HTMLDivElement | null>(null);

	// `render()` from `svelte/server` is unavailable under this repo's Vitest setup, so the only way
	// to reach `masonry-viewport.svelte`'s `{#if !state.mounted && fallback}` branch is to publish a
	// state that is never flipped to `mounted` and render the part on its own. Context has to be set
	// during init, hence the immediate call — the function body is what keeps the prop reads inside a
	// closure, so the mode never has to be captured at the top level.
	function publishViewportState() {
		if (mode !== 'viewport-fallback') return;

		const viewportState = new Masonry.MasonryState({
			getColumnWidth: () => columnWidth ?? 200,
			getColumnCount: () => columnCount,
			getMaxColumnCount: () => maxColumnCount,
			getGap: () => gap ?? 0,
			getItemHeight: () => itemHeight ?? 300,
			getDefaultWidth: () => defaultWidth,
			getDefaultHeight: () => defaultHeight,
			getOverscan: () => overscan ?? 2,
			getScrollFps: () => scrollFps ?? 12,
			getLinear: () => linear ?? false,
			getDir: () => dir ?? 'ltr'
		});
		Masonry.setMasonryContext(viewportState);
		onState?.(viewportState);
	}

	publishViewportState();

	$effect(() => {
		onRefs?.({ root: rootRef, item: itemRef });
	});
</script>

{#snippet rootChild({ props }: { props: MasonryChildProps })}
	<section {...props as Record<string, unknown>} data-testid="root-child"></section>
{/snippet}

{#snippet itemChild({ props }: { props: MasonryItemChildProps })}
	<article {...props as Record<string, unknown>} data-testid="item-child">
		{props['data-index']}
	</article>
{/snippet}

{#snippet fallback()}
	<div data-testid="masonry-fallback">Loading…</div>
{/snippet}

{#snippet itemBody(item: MasonryHarnessItem)}
	<span>{item.id}</span>
	{#if withFocusable}
		<button type="button">focus {item.id}</button>
	{/if}
{/snippet}

{#snippet itemList()}
	{#each items as item, position (item.id)}
		{#if mode === 'item-child' && position === 0}
			<Masonry.Item
				index={item.index}
				class={itemClass}
				style={itemStyle}
				data-test-height={item.height}
				data-item-id={item.id}
				child={itemChild}
			/>
		{:else if position === 0}
			<Masonry.Item
				bind:ref={itemRef}
				index={item.index}
				class={itemClass}
				style={itemStyle}
				data-test-height={item.height}
				data-item-id={item.id}
			>
				{@render itemBody(item)}
			</Masonry.Item>
		{:else}
			<Masonry.Item
				index={item.index}
				class={itemClass}
				style={itemStyle}
				data-test-height={item.height}
				data-item-id={item.id}
			>
				{@render itemBody(item)}
			</Masonry.Item>
		{/if}
	{/each}
{/snippet}

{#snippet root()}
	{#if mode === 'root-child'}
		<Masonry.Root
			{columnWidth}
			{columnCount}
			{maxColumnCount}
			{gap}
			{itemHeight}
			{defaultWidth}
			{defaultHeight}
			{overscan}
			{scrollFps}
			{linear}
			{dir}
			fallback={withFallback ? fallback : undefined}
			child={rootChild}
		>
			{@render itemList()}
		</Masonry.Root>
	{:else}
		<Masonry.Root
			bind:ref={rootRef}
			{columnWidth}
			{columnCount}
			{maxColumnCount}
			{gap}
			{itemHeight}
			{defaultWidth}
			{defaultHeight}
			{overscan}
			{scrollFps}
			{linear}
			{dir}
			class={className}
			{style}
			{id}
			aria-label={ariaLabel}
			data-testid={dataTestId}
			fallback={withFallback ? fallback : undefined}
		>
			{@render itemList()}
		</Masonry.Root>
	{/if}
{/snippet}

{#if mode === 'bare-item'}
	<Masonry.Item bind:ref={itemRef}>bare</Masonry.Item>
{:else if mode === 'viewport-fallback'}
	<MasonryViewport fallback={withFallback ? fallback : undefined}>
		<span data-testid="viewport-children">viewport children</span>
	</MasonryViewport>
{:else if mode === 'rtl-provider'}
	<DirectionProvider dir={providerDir}>
		{@render root()}
	</DirectionProvider>
{:else}
	{@render root()}
{/if}
