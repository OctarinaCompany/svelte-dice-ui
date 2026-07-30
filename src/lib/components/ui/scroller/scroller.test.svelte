<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/direction-provider.svelte.js';

	import type { ScrollerChildProps } from './scroller.svelte';
	import type {
		ScrollDirection,
		ScrollerOrientation,
		ScrollerTriggerMode
	} from './scroller.svelte.js';

	/**
	 * Which single path this render exercises: the plain tree, the root rendered through its `child`
	 * snippet, the navigation button rendered with no `<Scroller.Root>` ancestor (guard rail), or a
	 * root wrapped in a `<DirectionProvider>`.
	 *
	 * A `.ts` spec cannot express `{#snippet child({ props })}`, `bind:ref`, or a part with no
	 * provider ancestor, so everything needing a real parent component goes through this file. It is
	 * not collected by Vitest (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type ScrollerHarnessMode = 'default' | 'root-child' | 'bare-button' | 'rtl-provider';

	export type ScrollerHarnessProps = {
		mode?: ScrollerHarnessMode;
		/** How many content blocks to render inside the scroller. */
		itemCount?: number;
		orientation?: ScrollerOrientation;
		hideScrollbar?: boolean;
		size?: number;
		offset?: number;
		withNavigation?: boolean;
		scrollStep?: number;
		scrollTriggerMode?: ScrollerTriggerMode;
		dir?: Direction;
		/** The `dir` the `rtl-provider` mode's `<DirectionProvider>` publishes. */
		providerDir?: Direction;
		class?: string;
		style?: string;
		id?: string;
		role?: string;
		tabindex?: number;
		'aria-label'?: string;
		'data-testid'?: string;
		/** Which direction the `bare-button` mode renders. */
		bareDirection?: ScrollDirection;
		/** Called on every change to the captured root `ref`, so a `.ts` spec can read it. */
		onRef?: (ref: HTMLDivElement | null) => void;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import ScrollerButton from './scroller-button.svelte';
	import * as Scroller from './index.js';

	let {
		mode = 'default',
		itemCount = 3,
		orientation,
		hideScrollbar,
		size,
		offset,
		withNavigation,
		scrollStep,
		scrollTriggerMode,
		dir,
		providerDir = 'rtl',
		class: className,
		style,
		id,
		role,
		tabindex,
		'aria-label': ariaLabel,
		'data-testid': dataTestId,
		bareDirection = 'down',
		onRef
	}: ScrollerHarnessProps = $props();

	let rootRef = $state<HTMLDivElement | null>(null);

	const indexes = $derived(Array.from({ length: itemCount }, (_, index) => index));

	$effect(() => {
		onRef?.(rootRef);
	});
</script>

{#snippet itemList(testid: string)}
	{#each indexes as index (index)}
		<div data-testid={testid}>Card {index + 1}</div>
	{/each}
{/snippet}

{#snippet rootChild({ props }: { props: ScrollerChildProps })}
	<div {...props as Record<string, unknown>} data-testid="root-child">
		{@render itemList('child-item')}
	</div>
{/snippet}

{#snippet root()}
	{#if mode === 'root-child'}
		<Scroller.Root
			{orientation}
			{hideScrollbar}
			{size}
			{offset}
			{withNavigation}
			{scrollStep}
			{scrollTriggerMode}
			{dir}
			class={className}
			{style}
			child={rootChild}
		>
			{@render itemList('item')}
		</Scroller.Root>
	{:else}
		<Scroller.Root
			bind:ref={rootRef}
			{orientation}
			{hideScrollbar}
			{size}
			{offset}
			{withNavigation}
			{scrollStep}
			{scrollTriggerMode}
			{dir}
			class={className}
			{style}
			{id}
			{role}
			{tabindex}
			aria-label={ariaLabel}
			data-testid={dataTestId}
		>
			{@render itemList('item')}
		</Scroller.Root>
	{/if}
{/snippet}

{#if mode === 'bare-button'}
	<ScrollerButton direction={bareDirection} />
{:else if mode === 'rtl-provider'}
	<DirectionProvider dir={providerDir}>
		{@render root()}
	</DirectionProvider>
{:else}
	{@render root()}
{/if}
