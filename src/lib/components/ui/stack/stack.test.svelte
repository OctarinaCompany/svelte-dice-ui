<script lang="ts" module>
	import type { MouseEventHandler, PointerEventHandler } from 'svelte/elements';

	import type { StackChildProps, StackItemChildProps } from './index.js';
	import type { StackSide } from './stack.svelte.js';

	/**
	 * Which single path this render exercises: the plain tree, one part rendered through its `child`
	 * snippet, or a `<Stack.Item>` with no `<Stack.Root>` ancestor (guard rail).
	 *
	 * A `.ts` spec cannot express `{#snippet child({ props })}`, a keyed `{#each}` whose backing array
	 * the test mutates, `bind:ref`, or a part with no provider ancestor, so everything needing a real
	 * parent component goes through this file. It is not collected by Vitest (`include` is
	 * `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type StackHarnessMode = 'default' | 'root-child' | 'item-child' | 'bare-item';

	/** Every `bind:ref` the harness captures, reported through {@link StackHarnessProps.onRefs}. */
	export type StackHarnessRefs = {
		root: HTMLDivElement | null;
		item: HTMLDivElement | null;
	};

	export type StackHarnessProps = {
		mode?: StackHarnessMode;
		/** One `<Stack.Item>` per entry, keyed by the string itself so removals renumber the rest. */
		items?: string[];
		/** Wraps the whole tree in a `<div dir>` so the RTL cases exercise real inherited direction. */
		dir?: 'ltr' | 'rtl';
		side?: StackSide;
		itemCount?: number;
		expandedItemCount?: number;
		gap?: number;
		scale?: number;
		offset?: number;
		expandOnHover?: boolean;
		class?: string;
		style?: string;
		itemClass?: string;
		itemStyle?: string;
		/** Renders a `<button>` inside every item, for the "still queryable and tabbable" cases. */
		withButton?: boolean;
		/**
		 * The five handlers `<Stack.Root>` composes. Each is forwarded verbatim so a spec can assert
		 * that the caller's handler runs first and that `preventDefault()` suppresses the stack's own
		 * behaviour (contracts/public-api.md §"Composed event handlers").
		 */
		onmouseenter?: MouseEventHandler<HTMLDivElement>;
		onmousemove?: MouseEventHandler<HTMLDivElement>;
		onmouseleave?: MouseEventHandler<HTMLDivElement>;
		onpointerdown?: PointerEventHandler<HTMLDivElement>;
		onpointerup?: PointerEventHandler<HTMLDivElement>;
		/** Called on every change to any captured `ref`, so a `.ts` spec can read them. */
		onRefs?: (refs: StackHarnessRefs) => void;
	};
</script>

<script lang="ts">
	import * as Stack from './index.js';

	let {
		mode = 'default',
		items = [],
		dir,
		side,
		itemCount,
		expandedItemCount,
		gap,
		scale,
		offset,
		expandOnHover,
		class: className,
		style,
		itemClass,
		itemStyle,
		withButton = false,
		onmouseenter,
		onmousemove,
		onmouseleave,
		onpointerdown,
		onpointerup,
		onRefs
	}: StackHarnessProps = $props();

	let rootRef = $state<HTMLDivElement | null>(null);
	let itemRef = $state<HTMLDivElement | null>(null);

	$effect(() => {
		onRefs?.({ root: rootRef, item: itemRef });
	});
</script>

{#snippet rootChild({ props }: { props: StackChildProps })}
	<section {...props as Record<string, unknown>} data-testid="root-child"></section>
{/snippet}

{#snippet itemChild({ props }: { props: StackItemChildProps })}
	<article {...props as Record<string, unknown>} data-testid="item-child"></article>
{/snippet}

{#snippet itemBody(item: string)}
	<span>{item}</span>
	{#if withButton}
		<button type="button">Action {item}</button>
	{/if}
{/snippet}

{#snippet itemList()}
	{#each items as item, index (item)}
		{#if mode === 'item-child' && index === 0}
			<Stack.Item child={itemChild} />
		{:else if index === 0}
			<Stack.Item bind:ref={itemRef} class={itemClass} style={itemStyle}>
				{@render itemBody(item)}
			</Stack.Item>
		{:else}
			<Stack.Item class={itemClass} style={itemStyle}>
				{@render itemBody(item)}
			</Stack.Item>
		{/if}
	{/each}
{/snippet}

{#snippet tree()}
	{#if mode === 'bare-item'}
		<Stack.Item bind:ref={itemRef} class={itemClass}>bare</Stack.Item>
	{:else if mode === 'root-child'}
		<Stack.Root
			{side}
			{itemCount}
			{expandedItemCount}
			{gap}
			{scale}
			{offset}
			{expandOnHover}
			child={rootChild}
		>
			{@render itemList()}
		</Stack.Root>
	{:else}
		<Stack.Root
			bind:ref={rootRef}
			{side}
			{itemCount}
			{expandedItemCount}
			{gap}
			{scale}
			{offset}
			{expandOnHover}
			class={className}
			{style}
			{onmouseenter}
			{onmousemove}
			{onmouseleave}
			{onpointerdown}
			{onpointerup}
		>
			{@render itemList()}
		</Stack.Root>
	{/if}
{/snippet}

{#if dir}
	<div {dir}>
		{@render tree()}
	</div>
{:else}
	{@render tree()}
{/if}
