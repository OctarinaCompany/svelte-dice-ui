<script lang="ts" module>
	import type { GaugeChildProps, GaugeLabelChildProps, GaugeValueTextChildProps } from './index.js';

	/**
	 * Props of the prop-driven test harness used by `gauge.test.ts`.
	 *
	 * A `.ts` spec cannot express `bind:`, a `{#snippet child({ props })}` with props, toggling a
	 * child component via `{#if}`, or a `dir="rtl"` wrapper, so everything that needs a real parent
	 * component goes through this file. It is not collected by Vitest (`include` is `.{js,ts}`) and
	 * is not listed in `registry.json`.
	 */
	export type GaugeHarnessProps = {
		/** Forwarded to `Gauge.Root`. */
		value?: number | null;
		/** Forwarded to `Gauge.Root`. */
		min?: number;
		/** Forwarded to `Gauge.Root`. */
		max?: number;
		/** Forwarded to `Gauge.Root`. */
		size?: number;
		/** Forwarded to `Gauge.Root`. */
		thickness?: number;
		/** Forwarded to `Gauge.Root`. */
		startAngle?: number;
		/** Forwarded to `Gauge.Root`. */
		endAngle?: number;
		/** Forwarded to `Gauge.Root`. */
		getValueText?: (value: number, min: number, max: number) => string;
		/** Forwarded to `Gauge.Root` as its `class`. */
		class?: string;
		/** Forwarded to `Gauge.Track` as its `class`. */
		trackClass?: string;
		/** Forwarded to `Gauge.Range` as its `class`. */
		rangeClass?: string;
		/** Forwarded to `Gauge.ValueText` as its `class`. */
		valueTextClass?: string;
		/** Forwarded to `Gauge.Label` as its `class`. */
		labelClass?: string;
		/** Forwarded to `Gauge.Track` through `restProps`. */
		trackTestId?: string;
		/** Forwarded to `Gauge.Range` through `restProps`. */
		rangeTestId?: string;
		/** Forwarded to `Gauge.ValueText` through `restProps`. */
		valueTextTestId?: string;
		/** Forwarded to `Gauge.Label` through `restProps`. */
		labelTestId?: string;
		/** Render `Gauge.Label` at all — toggled to cover register/unregister. */
		showLabel?: boolean;
		/** Text content for `Gauge.Label`, when rendered. */
		labelText?: string;
		/** Render `Gauge.Root` through the `child` snippet onto a `<button>`. */
		useRootChild?: boolean;
		/** Render `Gauge.ValueText` through the `child` snippet onto a `<strong>`. */
		useValueTextChild?: boolean;
		/** Render `Gauge.Label` through the `child` snippet onto an `<em>`. */
		useLabelChild?: boolean;
		/** Give `Gauge.ValueText` explicit `children` instead of the computed text. */
		valueTextChildren?: boolean;
		/** A caller `style` forwarded to `Gauge.ValueText`. */
		valueTextStyle?: string;
		/** Forwarded to `Gauge.Root` through `restProps`. */
		id?: string;
		/** Forwarded to `Gauge.Root` through `restProps`. */
		'data-testid'?: string;
		/** Forwarded to `Gauge.Root` through `restProps`. */
		onclick?: (event: MouseEvent) => void;
		/** Wrap the harness in `<div dir="rtl">` (research.md R-15). */
		rtl?: boolean;
		/** Bound to `Gauge.Root`'s `ref`. */
		rootRef?: HTMLDivElement | null;
		/** Bound to `Gauge.Indicator`'s `ref`. */
		indicatorRef?: SVGSVGElement | null;
		/** Bound to `Gauge.Track`'s `ref`. */
		trackRef?: SVGPathElement | null;
		/** Bound to `Gauge.Range`'s `ref`. */
		rangeRef?: SVGPathElement | null;
		/** Bound to `Gauge.ValueText`'s `ref`. */
		valueTextRef?: HTMLDivElement | null;
		/** Bound to `Gauge.Label`'s `ref`. */
		labelRef?: HTMLDivElement | null;
	};
</script>

<script lang="ts">
	import * as Gauge from './index.js';

	let {
		value = null,
		min,
		max,
		size,
		thickness,
		startAngle,
		endAngle,
		getValueText,
		class: className,
		trackClass,
		rangeClass,
		valueTextClass,
		labelClass,
		trackTestId,
		rangeTestId,
		valueTextTestId,
		labelTestId,
		showLabel = false,
		labelText = 'Label',
		useRootChild = false,
		useValueTextChild = false,
		useLabelChild = false,
		valueTextChildren = false,
		valueTextStyle,
		id,
		'data-testid': dataTestId,
		onclick,
		rtl = false,
		rootRef = $bindable(null),
		indicatorRef = $bindable(null),
		trackRef = $bindable(null),
		rangeRef = $bindable(null),
		valueTextRef = $bindable(null),
		labelRef = $bindable(null)
	}: GaugeHarnessProps = $props();
</script>

{#snippet rootChild({ props }: { props: GaugeChildProps })}
	<button type="button" {...props as Record<string, unknown>} data-testid="root-child">
		{@render body()}
	</button>
{/snippet}

{#snippet valueTextChild({ props }: { props: GaugeValueTextChildProps })}
	<strong data-testid="value-text-child" {...props}>custom</strong>
{/snippet}

{#snippet labelChild({ props }: { props: GaugeLabelChildProps })}
	<em data-testid="label-child" {...props}>{labelText}</em>
{/snippet}

{#snippet body()}
	<Gauge.Indicator bind:ref={indicatorRef}>
		<Gauge.Track bind:ref={trackRef} class={trackClass} data-testid={trackTestId} />
		<Gauge.Range bind:ref={rangeRef} class={rangeClass} data-testid={rangeTestId} />
	</Gauge.Indicator>
	{#if useValueTextChild}
		<Gauge.ValueText child={valueTextChild} />
	{:else if valueTextChildren}
		<Gauge.ValueText
			bind:ref={valueTextRef}
			class={valueTextClass}
			style={valueTextStyle}
			data-testid={valueTextTestId}
		>
			Custom
		</Gauge.ValueText>
	{:else}
		<Gauge.ValueText
			bind:ref={valueTextRef}
			class={valueTextClass}
			style={valueTextStyle}
			data-testid={valueTextTestId}
		/>
	{/if}
	{#if showLabel}
		{#if useLabelChild}
			<Gauge.Label child={labelChild} />
		{:else}
			<Gauge.Label bind:ref={labelRef} class={labelClass} data-testid={labelTestId}
				>{labelText}</Gauge.Label
			>
		{/if}
	{/if}
{/snippet}

{#snippet root()}
	<Gauge.Root
		bind:ref={rootRef}
		{value}
		{min}
		{max}
		{size}
		{thickness}
		{startAngle}
		{endAngle}
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
	</Gauge.Root>
{/snippet}

{#if rtl}
	<div dir="rtl">
		{@render root()}
	</div>
{:else}
	{@render root()}
{/if}
