<script lang="ts" module>
	import type { MouseEventHandler } from 'svelte/elements';
	import type { ColorSwatchSize } from './index.js';

	/**
	 * Props of the prop-driven test harness used by `color-swatch.test.ts`.
	 *
	 * A `.ts` spec cannot express `bind:`, a `{#snippet child({ props })}` with props, or a
	 * `DirectionProvider`-wrapped variant, so everything that needs a real parent component goes
	 * through this file. It is not collected by Vitest (`include` is `.{js,ts}`) and is not listed in
	 * `registry.json`.
	 */
	export type ColorSwatchHarnessProps = {
		/** Forwarded to `ColorSwatch.Root`. */
		color?: string;
		/** Forwarded to `ColorSwatch.Root`. */
		size?: ColorSwatchSize;
		/** Forwarded to `ColorSwatch.Root`. */
		withoutTransparency?: boolean;
		/** Forwarded to `ColorSwatch.Root`. */
		disabled?: boolean;
		/** Forwarded to `ColorSwatch.Root` as its `class`. */
		class?: string;
		/** Forwarded to `ColorSwatch.Root` as its `style`. */
		style?: string;
		/** Forwarded to `ColorSwatch.Root` through `restProps`. */
		onclick?: MouseEventHandler<HTMLDivElement>;
		/** Render `ColorSwatch.Root` through the `child` snippet onto a `<span>`. */
		useChild?: boolean;
		/** Render `ColorSwatch.Root` through the `child` snippet onto a `<button>`, with an explicit
		 * `role="button"` written after the spread so it overrides the payload's `role="img"`. */
		useButtonChild?: boolean;
		/** Wrap the harness in `<DirectionProvider dir="rtl">`. */
		rtl?: boolean;
		/** Bound to `ColorSwatch.Root`'s `ref`. */
		rootRef?: HTMLDivElement | null;
	};
</script>

<script lang="ts">
	import * as DirectionProvider from '../direction-provider/index.js';
	import * as ColorSwatch from './index.js';

	let {
		color,
		size,
		withoutTransparency,
		disabled,
		class: className,
		style,
		onclick,
		useChild = false,
		useButtonChild = false,
		rtl = false,
		rootRef = $bindable(null)
	}: ColorSwatchHarnessProps = $props();
</script>

{#snippet spanChild({ props }: { props: ColorSwatch.ColorSwatchChildProps })}
	<span data-testid="span-child" {...props}></span>
{/snippet}

{#snippet buttonChild({ props }: { props: ColorSwatch.ColorSwatchChildProps })}
	{@const overrideRole = 'button'}
	<button type="button" data-testid="button-child" {...props} role={overrideRole}></button>
{/snippet}

{#snippet root()}
	<ColorSwatch.Root
		{color}
		{size}
		{withoutTransparency}
		{disabled}
		class={className}
		{style}
		{onclick}
		bind:ref={rootRef}
		child={useChild ? spanChild : useButtonChild ? buttonChild : undefined}
	/>
{/snippet}

{#if rtl}
	<DirectionProvider.Root dir="rtl">
		{@render root()}
	</DirectionProvider.Root>
{:else}
	{@render root()}
{/if}
