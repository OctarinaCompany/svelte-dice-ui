<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	import type { AngleSliderRootState } from './index.js';

	/**
	 * Props of the prop-driven test harness used by `angle-slider.test.ts`.
	 *
	 * A `.ts` spec cannot express `bind:value`, a function binding whose setter declines the write,
	 * a `{#snippet child({ props })}`, a `<form>` ancestor or a `DirectionProvider` wrapper, so
	 * everything that needs a real parent component goes through this file. It is not collected by
	 * Vitest (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type AngleSliderHarnessProps = {
		/**
		 * Which of the three caller modes of research R-11 to exercise.
		 *
		 * - `uncontrolled` — only `defaultValue` is passed; the dial owns the value.
		 * - `bind` — `bind:value` onto the harness's own `$state`, mirrored into `[data-testid="mirror"]`.
		 * - `decline` — `bind:value={getter, setter}` with a setter that discards the write.
		 *
		 * @default 'uncontrolled'
		 */
		mode?: 'uncontrolled' | 'bind' | 'decline';
		/** Seed for the `bind`/`decline` modes. */
		value?: number[];
		/** Forwarded to `AngleSlider.Root` in `uncontrolled` mode. */
		defaultValue?: number[];
		/** Forwarded to `AngleSlider.Root`. */
		onValueChange?: (value: number[]) => void;
		/** Forwarded to `AngleSlider.Root`. */
		onValueCommit?: (value: number[]) => void;
		/** Forwarded to `AngleSlider.Root`. */
		min?: number;
		/** Forwarded to `AngleSlider.Root`. */
		max?: number;
		/** Forwarded to `AngleSlider.Root`. */
		step?: number;
		/** Forwarded to `AngleSlider.Root`. */
		minStepsBetweenThumbs?: number;
		/** Forwarded to `AngleSlider.Root`. */
		size?: number;
		/** Forwarded to `AngleSlider.Root`. */
		thickness?: number;
		/** Forwarded to `AngleSlider.Root`. */
		startAngle?: number;
		/** Forwarded to `AngleSlider.Root`. */
		endAngle?: number;
		/** Forwarded to `AngleSlider.Root`. */
		dir?: Direction;
		/** Forwarded to `AngleSlider.Root`. */
		form?: string;
		/** Forwarded to `AngleSlider.Root`. */
		name?: string;
		/** Forwarded to `AngleSlider.Root`. */
		disabled?: boolean;
		/** Forwarded to `AngleSlider.Root`. */
		readOnly?: boolean;
		/** Forwarded to `AngleSlider.Root`. */
		inverted?: boolean;
		/** Forwarded to `AngleSlider.Root`. */
		onkeydown?: (event: KeyboardEvent) => void;
		/** Which `AngleSlider.Thumb` indices to render. Defaults to one thumb per seeded value. */
		thumbIndices?: number[];
		/** Forwarded to `AngleSlider.Value`. */
		unit?: string;
		/** Forwarded to `AngleSlider.Value`. */
		formatValue?: (value: number | number[]) => string;
		/** Render `AngleSlider.Value` with explicit `children` instead of the computed text. */
		valueChildren?: string;
		/** Forwarded to `AngleSlider.Track` as its `class`. */
		trackClass?: string;
		/** Forwarded to `AngleSlider.Range` as its `class`. */
		rangeClass?: string;
		/** Forwarded to `AngleSlider.Thumb` as its `class`. */
		thumbClass?: string;
		/** Omit `AngleSlider.Range` entirely. @default false */
		withoutRange?: boolean;
		/** Omit `AngleSlider.Value` entirely. @default false */
		withoutValue?: boolean;
		/** Wrap the dial in a `<form name={formName}>`. @default false */
		wrapInForm?: boolean;
		/** `name` of the wrapping `<form>`. @default 'test-form' */
		formName?: string;
		/** Wrap the dial in a plain `<div dir="rtl">`. @default false */
		rtl?: boolean;
		/** Wrap the dial in `<DirectionProvider dir="rtl">`. @default false */
		rtlProvider?: boolean;
		/** Render the root through its `child` snippet onto a `<section>`. @default false */
		useRootChild?: boolean;
		/** Render every thumb through its `child` snippet onto a `<span>`. @default false */
		useThumbChild?: boolean;
		/** Render the readout through its `child` snippet onto a `<span>`. @default false */
		useValueChild?: boolean;
		/**
		 * Render a sibling `<form>` with this `id` *next to* — never around — the dial, so the
		 * `form` prop can be exercised on its own.
		 */
		siblingForm?: string;
		/** Bound to `AngleSlider.Root`'s `ref`. */
		rootRef?: HTMLDivElement | null;
		/** Receives the `ref` of the root, the track and the range whenever one of them changes. */
		onRefs?: (refs: {
			root: HTMLDivElement | null;
			track: SVGSVGElement | null;
			range: SVGPathElement | null;
		}) => void;
		/** Receives the dial's own `AngleSliderRootState`, read from context by the probe. */
		onRootState?: (state: AngleSliderRootState) => void;
	};
</script>

<script lang="ts">
	import { untrack } from 'svelte';

	import * as DirectionProvider from '../direction-provider/index.js';
	import Probe from './angle-slider-probe.test.svelte';
	import * as AngleSlider from './index.js';
	import type {
		AngleSliderChildProps,
		AngleSliderThumbChildProps,
		AngleSliderValueChildProps
	} from './index.js';

	let {
		mode = 'uncontrolled',
		value,
		defaultValue,
		onValueChange,
		onValueCommit,
		min,
		max,
		step,
		minStepsBetweenThumbs,
		size,
		thickness,
		startAngle,
		endAngle,
		dir,
		form,
		name,
		disabled,
		readOnly,
		inverted,
		onkeydown,
		thumbIndices,
		unit,
		formatValue,
		valueChildren,
		trackClass,
		rangeClass,
		thumbClass,
		withoutRange = false,
		withoutValue = false,
		wrapInForm = false,
		formName = 'test-form',
		rtl = false,
		rtlProvider = false,
		useRootChild = false,
		useThumbChild = false,
		useValueChild = false,
		siblingForm,
		rootRef = $bindable(null),
		onRefs,
		onRootState
	}: AngleSliderHarnessProps = $props();

	let trackRef = $state<SVGSVGElement | null>(null);
	let rangeRef = $state<SVGPathElement | null>(null);

	$effect(() => {
		onRefs?.({ root: rootRef, track: trackRef, range: rangeRef });
	});

	// One-shot seeds: the harness never re-renders with different props, so capturing the initial
	// values here is deliberate.
	const seed = untrack(() => value ?? defaultValue ?? [0]);

	/** The parent-owned state for `mode: 'bind'`; the dial writes straight into it. */
	let bound = $state<number[]>([...seed]);

	/** The parent-owned state for `mode: 'decline'`; nothing ever writes into it. */
	const frozen = [...seed];

	const indices = untrack(() => thumbIndices ?? seed.map((_, index) => index));
</script>

{#snippet rootChild({ props }: { props: AngleSliderChildProps })}
	<!-- The spread comes last so the root's own `data-testid` wins and every spec helper keeps
	     working; the `<section>` tag is what marks this as the caller's element. -->
	<section data-testid="root-child" {...props as Record<string, unknown>}>
		{@render parts()}
	</section>
{/snippet}

{#snippet thumbChild({ props }: { props: AngleSliderThumbChildProps })}
	<span data-testid="thumb-child" {...props as Record<string, unknown>}></span>
{/snippet}

{#snippet valueChild({ props }: { props: AngleSliderValueChildProps })}
	<span data-testid="value-child" {...props as Record<string, unknown>}>{valueChildren ?? ''}</span>
{/snippet}

{#snippet parts()}
	<AngleSlider.Track bind:ref={trackRef} class={trackClass}>
		{#if !withoutRange}
			<AngleSlider.Range bind:ref={rangeRef} class={rangeClass} />
		{/if}
	</AngleSlider.Track>
	{#each indices as index (index)}
		<AngleSlider.Thumb {index} class={thumbClass} child={useThumbChild ? thumbChild : undefined} />
	{/each}
	{#if !withoutValue}
		{#if useValueChild}
			<AngleSlider.Value {unit} {formatValue} child={valueChild} />
		{:else if valueChildren !== undefined}
			<AngleSlider.Value {unit} {formatValue}>{valueChildren}</AngleSlider.Value>
		{:else}
			<AngleSlider.Value {unit} {formatValue} />
		{/if}
	{/if}
	{#if onRootState}
		<Probe onstate={onRootState} />
	{/if}
{/snippet}

{#snippet dial()}
	{#if mode === 'bind'}
		<AngleSlider.Root
			bind:ref={rootRef}
			bind:value={bound}
			{onValueChange}
			{onValueCommit}
			{min}
			{max}
			{step}
			{minStepsBetweenThumbs}
			{size}
			{thickness}
			{startAngle}
			{endAngle}
			{dir}
			{form}
			{name}
			{disabled}
			{readOnly}
			{inverted}
			{onkeydown}
			data-testid="root"
			child={useRootChild ? rootChild : undefined}
		>
			{#if !useRootChild}
				{@render parts()}
			{/if}
		</AngleSlider.Root>
		<span data-testid="mirror">{bound.join(',')}</span>
	{:else if mode === 'decline'}
		<AngleSlider.Root
			bind:ref={rootRef}
			bind:value={() => frozen, () => {}}
			{onValueChange}
			{onValueCommit}
			{min}
			{max}
			{step}
			{minStepsBetweenThumbs}
			{size}
			{thickness}
			{startAngle}
			{endAngle}
			{dir}
			{form}
			{name}
			{disabled}
			{readOnly}
			{inverted}
			{onkeydown}
			data-testid="root"
			child={useRootChild ? rootChild : undefined}
		>
			{#if !useRootChild}
				{@render parts()}
			{/if}
		</AngleSlider.Root>
		<span data-testid="mirror">{frozen.join(',')}</span>
	{:else}
		<AngleSlider.Root
			bind:ref={rootRef}
			defaultValue={defaultValue ?? seed}
			{onValueChange}
			{onValueCommit}
			{min}
			{max}
			{step}
			{minStepsBetweenThumbs}
			{size}
			{thickness}
			{startAngle}
			{endAngle}
			{dir}
			{form}
			{name}
			{disabled}
			{readOnly}
			{inverted}
			{onkeydown}
			data-testid="root"
			child={useRootChild ? rootChild : undefined}
		>
			{#if !useRootChild}
				{@render parts()}
			{/if}
		</AngleSlider.Root>
	{/if}
{/snippet}

{#snippet framed()}
	{#if wrapInForm}
		<form name={formName} data-testid="form">
			{@render dial()}
		</form>
	{:else}
		{@render dial()}
		{#if siblingForm}
			<form id={siblingForm} name={formName} data-testid="sibling-form"></form>
		{/if}
	{/if}
{/snippet}

{#if rtlProvider}
	<DirectionProvider.Root dir="rtl">
		{@render framed()}
	</DirectionProvider.Root>
{:else if rtl}
	<div dir="rtl">
		{@render framed()}
	</div>
{:else}
	{@render framed()}
{/if}
