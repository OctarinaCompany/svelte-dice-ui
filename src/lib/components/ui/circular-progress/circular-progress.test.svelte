<script lang="ts" module>
	import type { CircularProgressChildProps, CircularProgressValueTextChildProps } from './index.js';

	/**
	 * Props of the prop-driven test harness used by `circular-progress.test.ts`.
	 *
	 * A `.ts` spec cannot express `bind:`, a `{#snippet child({ props })}` with props, or a
	 * `DirectionProvider`-wrapped variant, so everything that needs a real parent component goes
	 * through this file. It is not collected by Vitest (`include` is `.{js,ts}`) and is not listed
	 * in `registry.json`.
	 */
	export type CircularProgressHarnessProps = {
		/** Forwarded to `CircularProgress.Root`. */
		value?: number | null;
		/** Forwarded to `CircularProgress.Root`. */
		min?: number;
		/** Forwarded to `CircularProgress.Root`. */
		max?: number;
		/** Forwarded to `CircularProgress.Root`. */
		size?: number;
		/** Forwarded to `CircularProgress.Root`. */
		thickness?: number;
		/** Forwarded to `CircularProgress.Root`. */
		label?: string;
		/** Forwarded to `CircularProgress.Root`. */
		getValueText?: (value: number, min: number, max: number) => string;
		/** Forwarded to `CircularProgress.Root` as its `class`. */
		class?: string;
		/** Forwarded to `CircularProgress.Track` as its `class`. */
		trackClass?: string;
		/** Forwarded to `CircularProgress.Range` as its `class`. */
		rangeClass?: string;
		/** Forwarded to `CircularProgress.ValueText` as its `class`. */
		valueTextClass?: string;
		/** Render `CircularProgress.Root` through the `child` snippet onto a `<button>`. */
		useRootChild?: boolean;
		/** Render `CircularProgress.ValueText` through the `child` snippet onto a `<strong>`. */
		useValueTextChild?: boolean;
		/** Give `CircularProgress.ValueText` explicit `children` instead of the computed text. */
		valueTextChildren?: boolean;
		/** Forwarded to `CircularProgress.Root` through `restProps`. */
		id?: string;
		/** Forwarded to `CircularProgress.Root` through `restProps`. */
		'data-testid'?: string;
		/** Forwarded to `CircularProgress.Root` through `restProps`. */
		onclick?: (event: MouseEvent) => void;
		/** Wrap the harness in `<DirectionProvider dir="rtl">`. */
		rtl?: boolean;
		/** Bound to `CircularProgress.Root`'s `ref`. */
		rootRef?: HTMLDivElement | null;
	};
</script>

<script lang="ts">
	import * as CircularProgress from './index.js';
	import * as DirectionProvider from '../direction-provider/index.js';

	let {
		value = null,
		min,
		max,
		size,
		thickness,
		label,
		getValueText,
		class: className,
		trackClass,
		rangeClass,
		valueTextClass,
		useRootChild = false,
		useValueTextChild = false,
		valueTextChildren = false,
		id,
		'data-testid': dataTestId,
		onclick,
		rtl = false,
		rootRef = $bindable(null)
	}: CircularProgressHarnessProps = $props();
</script>

{#snippet rootChild({ props }: { props: CircularProgressChildProps })}
	<button type="button" {...props as Record<string, unknown>} data-testid="root-child">
		{@render body()}
	</button>
{/snippet}

{#snippet valueTextChild({ props }: { props: CircularProgressValueTextChildProps })}
	<strong data-testid="value-text-child" {...props}>custom</strong>
{/snippet}

{#snippet body()}
	<CircularProgress.Indicator>
		<CircularProgress.Track class={trackClass} />
		<CircularProgress.Range class={rangeClass} />
	</CircularProgress.Indicator>
	{#if useValueTextChild}
		<CircularProgress.ValueText child={valueTextChild} />
	{:else if valueTextChildren}
		<CircularProgress.ValueText class={valueTextClass}>Custom</CircularProgress.ValueText>
	{:else}
		<CircularProgress.ValueText class={valueTextClass} />
	{/if}
{/snippet}

{#snippet root()}
	<CircularProgress.Root
		bind:ref={rootRef}
		{value}
		{min}
		{max}
		{size}
		{thickness}
		{label}
		{getValueText}
		class={className}
		{id}
		data-testid={dataTestId}
		{onclick}
		child={useRootChild ? rootChild : undefined}
	>
		{#if !useRootChild}
			{@render body()}
		{/if}
	</CircularProgress.Root>
{/snippet}

{#if rtl}
	<DirectionProvider.Root dir="rtl">
		{@render root()}
	</DirectionProvider.Root>
{:else}
	{@render root()}
{/if}
