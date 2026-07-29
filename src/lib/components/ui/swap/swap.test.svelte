<script lang="ts" module>
	import type { KeyboardEventHandler, MouseEventHandler } from 'svelte/elements';
	import type { SwapActivationMode, SwapAnimation } from './index.js';

	/**
	 * Props of the prop-driven test harness used by `swap.test.ts`.
	 *
	 * A `.ts` spec cannot express `bind:`, `{#snippet child({ props })}` with props, or a
	 * `DirectionProvider`-wrapped variant, so everything that needs a real parent component goes
	 * through this file. It is not collected by Vitest (`include` is `.{js,ts}`) and is not listed in
	 * `registry.json`.
	 */
	export type SwapHarnessProps = {
		/** Forwarded to `Swap.Root`. */
		swapped?: boolean;
		/** Forwarded to `Swap.Root`. */
		defaultSwapped?: boolean;
		/** Forwarded to `Swap.Root`. */
		onSwappedChange?: (swapped: boolean) => void;
		/** Forwarded to `Swap.Root`. */
		activationMode?: SwapActivationMode;
		/** Forwarded to `Swap.Root`. */
		animation?: SwapAnimation;
		/** Forwarded to `Swap.Root`. */
		disabled?: boolean;
		/** Forwarded to `Swap.Root` as its `class`. */
		class?: string;
		/** Forwarded to `Swap.Root` through `restProps`. */
		onclick?: MouseEventHandler<HTMLDivElement>;
		/** Forwarded to `Swap.Root` through `restProps`. */
		onmouseenter?: MouseEventHandler<HTMLDivElement>;
		/** Forwarded to `Swap.Root` through `restProps`. */
		onmouseleave?: MouseEventHandler<HTMLDivElement>;
		/** Forwarded to `Swap.Root` through `restProps`. */
		onkeydown?: KeyboardEventHandler<HTMLDivElement>;
		/** Forwarded to `Swap.Root`, e.g. `aria-label`. */
		'aria-label'?: string;
		/** Render `Swap.Root` through the `child` snippet onto a `<button>`. */
		useChild?: boolean;
		/** Render `Swap.On`/`Swap.Off` through their `child` snippet onto a `<span>`. */
		useFaceChild?: boolean;
		/** Wrap the harness in `<DirectionProvider dir="rtl">`. */
		rtl?: boolean;
		/** Bound to `Swap.Root`'s `ref`. */
		rootRef?: HTMLDivElement | null;
		/**
		 * Render nothing but a probe reporting `hasSwapContext()` and whether `useSwap()` throws —
		 * `.ts` specs cannot call these context functions outside component initialisation.
		 */
		probe?: boolean;
	};
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import * as DirectionProvider from '../direction-provider/index.js';
	import * as Swap from './index.js';

	let {
		swapped = $bindable(undefined),
		defaultSwapped,
		onSwappedChange,
		activationMode,
		animation,
		disabled,
		class: className,
		onclick,
		onmouseenter,
		onmouseleave,
		onkeydown,
		'aria-label': ariaLabel,
		useChild = false,
		useFaceChild = false,
		rtl = false,
		rootRef = $bindable(null),
		probe = false
	}: SwapHarnessProps = $props();

	let probeHasContext = $state(false);
	let probeUseSwapThrows = $state(false);

	if (untrack(() => probe)) {
		probeHasContext = Swap.hasSwapContext();
		try {
			Swap.useSwap();
		} catch {
			probeUseSwapThrows = true;
		}
	}
</script>

{#snippet rootChild({ props }: { props: Swap.SwapChildProps })}
	<button type="button" {...props as Record<string, unknown>}>
		{@render faces()}
	</button>
{/snippet}

{#snippet onChild({ props }: { props: Swap.SwapFaceChildProps })}
	<span data-testid="on-child" {...props}>on</span>
{/snippet}

{#snippet offChild({ props }: { props: Swap.SwapFaceChildProps })}
	<span data-testid="off-child" {...props}>off</span>
{/snippet}

{#snippet faces()}
	{#if useFaceChild}
		<Swap.On child={onChild} />
		<Swap.Off child={offChild} />
	{:else}
		<Swap.On data-testid="swap-on">on</Swap.On>
		<Swap.Off data-testid="swap-off">off</Swap.Off>
	{/if}
{/snippet}

{#snippet root()}
	<Swap.Root
		bind:swapped
		bind:ref={rootRef}
		{defaultSwapped}
		{onSwappedChange}
		{activationMode}
		{animation}
		{disabled}
		class={className}
		{onclick}
		{onmouseenter}
		{onmouseleave}
		{onkeydown}
		aria-label={ariaLabel}
		child={useChild ? rootChild : undefined}
	>
		{@render faces()}
	</Swap.Root>
{/snippet}

{#if probe}
	<span data-testid="probe-report"
		>has-context:{probeHasContext} use-swap-throws:{probeUseSwapThrows}</span
	>
{:else if rtl}
	<DirectionProvider.Root dir="rtl">
		{@render root()}
	</DirectionProvider.Root>
{:else}
	{@render root()}
{/if}
