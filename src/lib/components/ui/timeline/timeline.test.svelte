<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/direction-provider.svelte.js';
	import type {
		TimelineChildProps,
		TimelineConnectorChildProps,
		TimelineContentChildProps,
		TimelineDotChildProps,
		TimelineItemChildProps
	} from './index.js';
	import type { TimelineOrientation, TimelineVariant } from './timeline.svelte.js';

	/** One timeline item's demo content, forwarded to `Timeline.Content`'s children. */
	export type TimelineHarnessItem = {
		id: string;
		title: string;
		description: string;
		date: string;
		dateTime?: string;
	};

	/**
	 * Which single part (if any) this render exercises through a non-default path: rendered through
	 * its `child` snippet, rendered with no provider ancestor (guard rails), or rendered inside
	 * `Root` but with no `Item` ancestor.
	 *
	 * A `.ts` spec cannot express `{#snippet child({ props })}` with props, a keyed `{#each}` over
	 * items, `bind:ref`, or a context-consuming part with no ancestor, so everything that needs a
	 * real parent component goes through this file. It is not collected by Vitest (`include` is
	 * `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type TimelineHarnessMode =
		| 'default'
		| 'root-child'
		| 'item-child'
		| 'dot-child'
		| 'connector-child'
		| 'content-child'
		| 'bare-item'
		| 'bare-dot'
		| 'bare-connector'
		| 'bare-content'
		| 'itemless-dot'
		| 'itemless-connector'
		| 'itemless-content';

	export type TimelineHarnessProps = {
		mode?: TimelineHarnessMode;
		orientation?: TimelineOrientation;
		variant?: TimelineVariant;
		dir?: Direction;
		activeIndex?: number;
		items?: TimelineHarnessItem[];
		class?: string;
		itemClass?: string;
		dotClass?: string;
		connectorClass?: string;
		contentClass?: string;
		connectorForceMount?: boolean;
		wrapInRtlProvider?: boolean;
		id?: string;
		'data-testid'?: string;
		rootRef?: HTMLOListElement | null;
		firstItemRef?: HTMLLIElement | null;
		firstDotRef?: HTMLDivElement | null;
		firstConnectorRef?: HTMLDivElement | null;
		firstContentRef?: HTMLDivElement | null;
		firstTimeRef?: HTMLTimeElement | null;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';
	import * as Timeline from './index.js';

	let {
		mode = 'default',
		orientation,
		variant,
		dir,
		activeIndex,
		items = [],
		class: className,
		itemClass,
		dotClass,
		connectorClass,
		contentClass,
		connectorForceMount = false,
		wrapInRtlProvider = false,
		id,
		'data-testid': dataTestId,
		rootRef = $bindable(null),
		firstItemRef = $bindable(null),
		firstDotRef = $bindable(null),
		firstConnectorRef = $bindable(null),
		firstContentRef = $bindable(null),
		firstTimeRef = $bindable(null)
	}: TimelineHarnessProps = $props();
</script>

{#snippet rootChild({ props }: { props: TimelineChildProps })}
	<div {...props as Record<string, unknown>} data-testid="root-child"></div>
{/snippet}

{#snippet itemChild({ props }: { props: TimelineItemChildProps })}
	{@const { register, ...spreadProps } = props}
	<li
		{...spreadProps as Record<string, unknown>}
		data-testid={`item-child-${props.id}`}
		{@attach register}
	></li>
{/snippet}

{#snippet dotChild({ props }: { props: TimelineDotChildProps })}
	<span {...props as Record<string, unknown>} data-testid="dot-child"></span>
{/snippet}

{#snippet connectorChild({ props }: { props: TimelineConnectorChildProps })}
	<span {...props as Record<string, unknown>} data-testid="connector-child"></span>
{/snippet}

{#snippet contentChild({ props }: { props: TimelineContentChildProps })}
	<span {...props as Record<string, unknown>} data-testid="content-child"></span>
{/snippet}

{#snippet dot()}
	<Timeline.Dot class={dotClass} />
{/snippet}

{#snippet firstDot()}
	{#if mode === 'dot-child'}
		<Timeline.Dot child={dotChild} />
	{:else}
		<Timeline.Dot bind:ref={firstDotRef} class={dotClass} />
	{/if}
{/snippet}

{#snippet connector()}
	<Timeline.Connector class={connectorClass} forceMount={connectorForceMount} />
{/snippet}

{#snippet firstConnector()}
	{#if mode === 'connector-child'}
		<Timeline.Connector child={connectorChild} forceMount={connectorForceMount} />
	{:else}
		<Timeline.Connector
			bind:ref={firstConnectorRef}
			class={connectorClass}
			forceMount={connectorForceMount}
		/>
	{/if}
{/snippet}

{#snippet content(item: TimelineHarnessItem)}
	<Timeline.Content class={contentClass}>
		<Timeline.Header>
			<Timeline.Title>{item.title}</Timeline.Title>
			<Timeline.Time dateTime={item.dateTime}>{item.date}</Timeline.Time>
		</Timeline.Header>
		<Timeline.Description>{item.description}</Timeline.Description>
	</Timeline.Content>
{/snippet}

{#snippet firstContent(item: TimelineHarnessItem)}
	{#if mode === 'content-child'}
		<Timeline.Content child={contentChild} />
	{:else}
		<Timeline.Content bind:ref={firstContentRef} class={contentClass}>
			<Timeline.Header>
				<Timeline.Title>{item.title}</Timeline.Title>
				<Timeline.Time bind:ref={firstTimeRef} dateTime={item.dateTime}>{item.date}</Timeline.Time>
			</Timeline.Header>
			<Timeline.Description>{item.description}</Timeline.Description>
		</Timeline.Content>
	{/if}
{/snippet}

{#snippet itemBody(item: TimelineHarnessItem, index: number)}
	{#if index === 0}
		{@render firstDot()}
		{@render firstConnector()}
		{@render firstContent(item)}
	{:else}
		{@render dot()}
		{@render connector()}
		{@render content(item)}
	{/if}
{/snippet}

{#snippet rootContent()}
	{#if mode === 'itemless-dot'}
		<Timeline.Dot />
	{:else if mode === 'itemless-connector'}
		<Timeline.Connector />
	{:else if mode === 'itemless-content'}
		<Timeline.Content />
	{:else}
		{#each items as item, index (item.id)}
			{#if mode === 'item-child' && index === 1}
				<Timeline.Item id={item.id} child={itemChild} />
			{:else if index === 0}
				<Timeline.Item id={item.id} class={itemClass} bind:ref={firstItemRef}>
					{@render itemBody(item, index)}
				</Timeline.Item>
			{:else}
				<Timeline.Item id={item.id} class={itemClass}>
					{@render itemBody(item, index)}
				</Timeline.Item>
			{/if}
		{/each}
	{/if}
{/snippet}

{#snippet rootSnippet()}
	{#if mode === 'root-child'}
		<Timeline.Root {orientation} {variant} {dir} {activeIndex} child={rootChild}>
			{@render rootContent()}
		</Timeline.Root>
	{:else}
		<Timeline.Root
			bind:ref={rootRef}
			{orientation}
			{variant}
			{dir}
			{activeIndex}
			class={className}
			{id}
			data-testid={dataTestId}
		>
			{@render rootContent()}
		</Timeline.Root>
	{/if}
{/snippet}

{#if mode === 'bare-item'}
	<Timeline.Item id="bare-item" />
{:else if mode === 'bare-dot'}
	<Timeline.Dot />
{:else if mode === 'bare-connector'}
	<Timeline.Connector />
{:else if mode === 'bare-content'}
	<Timeline.Content />
{:else if wrapInRtlProvider}
	<DirectionProvider dir="rtl">
		{@render rootSnippet()}
	</DirectionProvider>
{:else}
	{@render rootSnippet()}
{/if}
