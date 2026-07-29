<script lang="ts" module>
	import type { Direction, UseDirectionOptions } from './index.js';

	/**
	 * Props of the prop-driven test harness used by `direction-provider.test.ts`.
	 *
	 * `useDirection()` may only be called during a component's initialisation, so a `.ts` spec cannot
	 * call it directly; nested providers, `bind:ref` and runtime `dir` flips likewise need a real
	 * parent component. Not collected by Vitest (`include` is `.{js,ts}`) and not listed in
	 * `registry.json`.
	 */
	export type DirectionProviderHarnessProps = {
		/** Forwarded to the outer `DirectionProvider.Root`. When omitted, no outer provider renders. */
		dir?: Direction;
		/** Forwarded to a nested `DirectionProvider.Root` rendered inside the outer one. */
		innerDir?: Direction;
		/** Forwarded to `DirectionProvider.Root` as its `class`. */
		class?: string;
		/** `dir` attribute applied to a wrapper element around the provider-less consumer branch. */
		ancestorDir?: 'ltr' | 'rtl' | 'auto';
		/** Explicit override getter forwarded to the provider-less consumer's `useDirection`. */
		overrideDir?: Direction;
		/** Render a consumer with no provider above it (still inside `ancestorDir`, if set). */
		showBareConsumer?: boolean;
		/** Render a sibling consumer inside the outer provider only (not the nested one). */
		showOuterConsumer?: boolean;
		/** Render a consumer inside the nested provider. */
		showInnerConsumer?: boolean;
		/** Additional attributes forwarded to `DirectionProvider.Root` through `restProps`. */
		rest?: Record<string, unknown>;
		/** Bound to the outer `DirectionProvider.Root`'s `ref`. */
		rootRef?: HTMLDivElement | null;
		/** Render a component that calls `getDirectionContext()` at its own init. */
		showThrowingProbe?: boolean;
		/** Anchor the bare consumer's DOM fallback on its own ancestor `<div>` instead of the document. */
		anchorAncestor?: boolean;
	};
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import * as DirectionProvider from './index.js';

	let {
		dir,
		innerDir,
		class: className,
		ancestorDir,
		overrideDir,
		showBareConsumer = false,
		showOuterConsumer = false,
		showInnerConsumer = false,
		rest,
		rootRef = $bindable(null),
		showThrowingProbe = false,
		anchorAncestor = false
	}: DirectionProviderHarnessProps = $props();

	let anchorEl = $state<HTMLElement | null>(null);

	const bareConsumerOptions: UseDirectionOptions | undefined = $derived(
		overrideDir !== undefined || anchorAncestor
			? {
					...(overrideDir !== undefined ? { dir: () => overrideDir } : {}),
					...(anchorAncestor ? { element: () => anchorEl } : {})
				}
			: undefined
	);

	const bareReader = DirectionProvider.useDirection(untrack(() => bareConsumerOptions));
	const hasContext = DirectionProvider.hasDirectionContext();

	// Read once, deliberately, at this component's own init — matches the documented
	// `getDirectionContext()` contract of being called during component initialisation.
	if (untrack(() => showThrowingProbe)) {
		DirectionProvider.getDirectionContext();
	}

	function describeRef(element: HTMLElement | null) {
		return element ? element.tagName.toLowerCase() : 'null';
	}

	const refReport = $derived(`root:${describeRef(rootRef)}`);
</script>

{#snippet consumer(testId: string)}
	{@const reader = DirectionProvider.useDirection()}
	<span data-testid={testId} data-current={reader.current}>{reader.current}</span>
{/snippet}

{#if dir !== undefined}
	<DirectionProvider.Root {dir} class={className} {...rest} bind:ref={rootRef}>
		{#if showOuterConsumer}
			{@render consumer('outer-consumer')}
		{/if}
		{#if innerDir !== undefined}
			<DirectionProvider.Root dir={innerDir}>
				{#if showInnerConsumer}
					{@render consumer('inner-consumer')}
				{/if}
			</DirectionProvider.Root>
		{/if}
	</DirectionProvider.Root>
{/if}

<div bind:this={anchorEl} data-testid="ancestor" dir={ancestorDir}>
	{#if showBareConsumer}
		<span data-testid="bare-consumer" data-current={bareReader.current}>{bareReader.current}</span>
	{/if}
</div>

<span data-testid="has-context">{hasContext}</span>
<span data-testid="ref-report">{refReport}</span>
