<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/direction-provider.svelte.js';
	import type { KeyboardEventHandler } from 'svelte/elements';

	import type {
		MarqueeChildProps,
		MarqueeContentChildProps,
		MarqueeEdgeChildProps,
		MarqueeItemChildProps
	} from './index.js';
	import type { MarqueeEdgeSize, MarqueeSide } from './marquee.svelte.js';

	/**
	 * Which single path this render exercises: the plain tree, one part rendered through its `child`
	 * snippet, or one part rendered with no `<Marquee.Root>` ancestor (guard rails).
	 *
	 * A `.ts` spec cannot express `{#snippet child({ props })}`, a keyed `{#each}` over items,
	 * `bind:ref`, or a part with no provider ancestor, so everything needing a real parent component
	 * goes through this file. It is not collected by Vitest (`include` is `.{js,ts}`) and is not
	 * listed in `registry.json`.
	 */
	export type MarqueeHarnessMode =
		| 'default'
		| 'root-child'
		| 'content-child'
		| 'item-child'
		| 'edge-child'
		| 'bare-content'
		| 'bare-item'
		| 'bare-edge'
		| 'rtl-provider';

	/** Every `bind:ref` the harness captures, reported through {@link MarqueeHarnessProps.onRefs}. */
	export type MarqueeHarnessRefs = {
		root: HTMLDivElement | null;
		content: HTMLDivElement | null;
		item: HTMLDivElement | null;
		edge: HTMLDivElement | null;
	};

	export type MarqueeHarnessProps = {
		mode?: MarqueeHarnessMode;
		items?: string[];
		side?: MarqueeSide;
		dir?: Direction;
		speed?: number;
		delay?: number;
		loopCount?: number;
		gap?: string | number;
		autoFill?: boolean;
		pauseOnHover?: boolean;
		pauseOnKeyboard?: boolean;
		reverse?: boolean;
		class?: string;
		style?: string;
		contentClass?: string;
		contentStyle?: string;
		itemClass?: string;
		edgeClass?: string;
		edgeSide?: MarqueeSide;
		edgeSize?: MarqueeEdgeSize;
		withEdges?: boolean;
		/** The `dir` the `rtl-provider` mode's `<DirectionProvider>` publishes. */
		providerDir?: Direction;
		id?: string;
		'aria-label'?: string;
		'data-testid'?: string;
		onkeydown?: KeyboardEventHandler<HTMLDivElement>;
		/** Called on every change to any captured `ref`, so a `.ts` spec can read them. */
		onRefs?: (refs: MarqueeHarnessRefs) => void;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';
	import * as Marquee from './index.js';

	let {
		mode = 'default',
		items = [],
		side,
		dir,
		speed,
		delay,
		loopCount,
		gap,
		autoFill,
		pauseOnHover,
		pauseOnKeyboard,
		reverse,
		class: className,
		style,
		contentClass,
		contentStyle,
		itemClass,
		edgeClass,
		edgeSide = 'left',
		edgeSize,
		withEdges = false,
		providerDir = 'rtl',
		id,
		'aria-label': ariaLabel,
		'data-testid': dataTestId,
		onkeydown,
		onRefs
	}: MarqueeHarnessProps = $props();

	let rootRef = $state<HTMLDivElement | null>(null);
	let contentRef = $state<HTMLDivElement | null>(null);
	let itemRef = $state<HTMLDivElement | null>(null);
	let edgeRef = $state<HTMLDivElement | null>(null);

	$effect(() => {
		onRefs?.({ root: rootRef, content: contentRef, item: itemRef, edge: edgeRef });
	});
</script>

{#snippet rootChild({ props }: { props: MarqueeChildProps })}
	<div {...props as Record<string, unknown>} data-testid="root-child"></div>
{/snippet}

{#snippet contentChild({ props }: { props: MarqueeContentChildProps })}
	<span {...props as Record<string, unknown>} data-testid="content-child"></span>
{/snippet}

{#snippet itemChild({ props }: { props: MarqueeItemChildProps })}
	<span {...props as Record<string, unknown>} data-testid="item-child"></span>
{/snippet}

{#snippet edgeChild({ props }: { props: MarqueeEdgeChildProps })}
	<span {...props as Record<string, unknown>} data-testid="edge-child"></span>
{/snippet}

{#snippet edges()}
	{#if withEdges}
		<Marquee.Edge bind:ref={edgeRef} side={edgeSide} size={edgeSize} class={edgeClass} />
		<Marquee.Edge side="right" />
	{/if}
{/snippet}

{#snippet itemList()}
	{#each items as item, index (item)}
		{#if mode === 'item-child' && index === 0}
			<Marquee.Item child={itemChild} />
		{:else if index === 0}
			<Marquee.Item bind:ref={itemRef} class={itemClass}>{item}</Marquee.Item>
		{:else}
			<Marquee.Item class={itemClass}>{item}</Marquee.Item>
		{/if}
	{/each}
{/snippet}

{#snippet rootBody()}
	{#if mode === 'content-child'}
		<Marquee.Content child={contentChild} class={contentClass} style={contentStyle} />
	{:else}
		<Marquee.Content bind:ref={contentRef} class={contentClass} style={contentStyle}>
			{@render itemList()}
		</Marquee.Content>
	{/if}
	{@render edges()}
{/snippet}

{#snippet root()}
	{#if mode === 'root-child'}
		<Marquee.Root
			{side}
			{dir}
			{speed}
			{delay}
			{loopCount}
			{gap}
			{autoFill}
			{pauseOnHover}
			{pauseOnKeyboard}
			{reverse}
			child={rootChild}
		>
			{@render rootBody()}
		</Marquee.Root>
	{:else}
		<Marquee.Root
			bind:ref={rootRef}
			{side}
			{dir}
			{speed}
			{delay}
			{loopCount}
			{gap}
			{autoFill}
			{pauseOnHover}
			{pauseOnKeyboard}
			{reverse}
			class={className}
			{style}
			{id}
			aria-label={ariaLabel}
			data-testid={dataTestId}
			{onkeydown}
		>
			{@render rootBody()}
		</Marquee.Root>
	{/if}
{/snippet}

{#if mode === 'bare-content'}
	<Marquee.Content />
{:else if mode === 'bare-item'}
	<Marquee.Item bind:ref={itemRef} class={itemClass}>{items[0] ?? 'bare'}</Marquee.Item>
{:else if mode === 'bare-edge'}
	<Marquee.Edge bind:ref={edgeRef} side={edgeSide} size={edgeSize} class={edgeClass} />
{:else if mode === 'edge-child'}
	<Marquee.Edge side={edgeSide} size={edgeSize} child={edgeChild} />
{:else if mode === 'rtl-provider'}
	<DirectionProvider dir={providerDir}>
		{@render root()}
	</DirectionProvider>
{:else}
	{@render root()}
{/if}
