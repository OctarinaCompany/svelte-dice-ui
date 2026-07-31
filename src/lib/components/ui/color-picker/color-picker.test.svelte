<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	import type { ColorFormat } from './index.js';

	/**
	 * Which single composition this render exercises. A `.ts` spec cannot express `bind:value`, the
	 * function binding `bind:value={get, set}`, a `child` snippet, a `<form>` ancestor or a
	 * provider-wrapped variant, so everything needing a real component tree goes through this file.
	 * It is not collected by Vitest (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type ColorPickerHarnessMode =
		| 'default'
		| 'root-child'
		| 'trigger-child'
		| 'content-child'
		| 'area-child'
		| 'swatch-child'
		| 'eye-dropper-child'
		| 'format-select-child';

	/**
	 * How the harness hands the picker its `value` / `open` / `format`.
	 *
	 * - `none` — uncontrolled: the `default*` props seed it and the component owns it.
	 * - `value` — `bind:` on all three, so the parent accepts every change.
	 * - `controlled` — plain props with no binding.
	 * - `function` — `bind:value={() => authoritative, (next) => …}`, a parent that declines writes.
	 */
	export type ColorPickerHarnessBinding = 'none' | 'value' | 'controlled' | 'function';

	export type ColorPickerHarnessProps = {
		/** @default 'default' */
		mode?: ColorPickerHarnessMode;
		/** @default 'none' */
		binding?: ColorPickerHarnessBinding;
		// root configuration
		defaultValue?: string;
		defaultOpen?: boolean;
		defaultFormat?: ColorFormat;
		dir?: Direction;
		modal?: boolean;
		inline?: boolean;
		name?: string;
		disabled?: boolean;
		readOnly?: boolean;
		required?: boolean;
		// part configuration
		/** Forwarded to `<ColorPicker.Area>`. */
		step?: number;
		/** Forwarded to `<ColorPicker.Area>`. */
		shiftStep?: number;
		/** Forwarded to `<ColorPicker.Input>`. */
		withoutAlpha?: boolean;
		/** Render the eyedropper part. @default true */
		withEyeDropper?: boolean;
		/**
		 * Render a custom part reading the picker's state through `getColorPickerContext`. It sits
		 * beside the content rather than inside it, so it stays mounted whether the popover is open or
		 * not — which is what makes `root.open` observable.
		 *
		 * @default false
		 */
		withConsumer?: boolean;
		// bindings
		value?: string;
		open?: boolean;
		format?: ColorFormat;
		/** The colour a declining parent keeps returning in `binding="function"` mode. */
		authoritativeValue?: string;
		onValueChange?: (value: string) => void;
		onOpenChange?: (open: boolean) => void;
		onFormatChange?: (format: ColorFormat) => void;
		/** Receives every write a declining parent refuses to apply. */
		onDeclinedValue?: (value: string) => void;
		// surroundings
		/** Wrap the picker in a `<DirectionProvider>` with this direction. */
		providerDir?: Direction;
		/** Wrap the picker in a `<form>`, so the hidden input renders. @default false */
		withForm?: boolean;
		/** Render a plain `<input>` before and after the picker, for `Tab` traversal. */
		withOuterInputs?: boolean;
		onSubmitValue?: (value: string | File | null) => void;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import Consumer from './color-picker.test-consumer.svelte';
	import * as ColorPicker from './index.js';

	let {
		mode = 'default',
		binding = 'none',
		defaultValue,
		defaultOpen,
		defaultFormat,
		dir,
		modal,
		inline,
		name,
		disabled,
		readOnly,
		required,
		step,
		shiftStep,
		withoutAlpha,
		withEyeDropper = true,
		withConsumer = false,
		value = $bindable(),
		open = $bindable(),
		format = $bindable(),
		authoritativeValue = '#000000',
		onValueChange,
		onOpenChange,
		onFormatChange,
		onDeclinedValue,
		providerDir,
		withForm = false,
		withOuterInputs = false,
		onSubmitValue
	}: ColorPickerHarnessProps = $props();

	const rootProps = $derived({
		defaultValue,
		defaultOpen,
		defaultFormat,
		dir,
		modal,
		inline,
		name,
		disabled,
		readOnly,
		required,
		onValueChange,
		onOpenChange,
		onFormatChange,
		'data-testid': 'root'
	});

	function handleSubmit(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
		event.preventDefault();
		onSubmitValue?.(new FormData(event.currentTarget).get(name ?? ''));
	}
</script>

{#snippet panel()}
	{#if mode === 'area-child'}
		<ColorPicker.Area {step} {shiftStep} data-testid="area">
			{#snippet child({ props })}
				<section data-child-slot="area" {...props}></section>
			{/snippet}
		</ColorPicker.Area>
	{:else}
		<ColorPicker.Area {step} {shiftStep} data-testid="area" />
	{/if}

	<div class="flex items-center gap-2">
		{#if withEyeDropper}
			{#if mode === 'eye-dropper-child'}
				<ColorPicker.EyeDropper data-testid="eye-dropper">
					{#snippet child({ props })}
						<button data-child-slot="eye-dropper" {...props}>Pick</button>
					{/snippet}
				</ColorPicker.EyeDropper>
			{:else}
				<ColorPicker.EyeDropper data-testid="eye-dropper" />
			{/if}
		{/if}
		<ColorPicker.HueSlider data-testid="hue" />
		<ColorPicker.AlphaSlider data-testid="alpha" />
	</div>

	<div class="flex items-center gap-2">
		{#if mode === 'format-select-child'}
			<ColorPicker.FormatSelect data-testid="format">
				{#snippet child({ props })}
					<button data-child-slot="format-select" {...props}>Format</button>
				{/snippet}
			</ColorPicker.FormatSelect>
		{:else}
			<ColorPicker.FormatSelect data-testid="format" />
		{/if}
		<ColorPicker.Input {withoutAlpha} />
	</div>
{/snippet}

{#snippet body()}
	{#if withConsumer}
		<Consumer />
	{/if}

	{#if mode === 'trigger-child'}
		<ColorPicker.Trigger data-testid="trigger">
			{#snippet child({ props })}
				<button data-child-slot="trigger" {...props}>Open</button>
			{/snippet}
		</ColorPicker.Trigger>
	{:else if !inline}
		<ColorPicker.Trigger data-testid="trigger">
			{#if mode === 'swatch-child'}
				<ColorPicker.Swatch data-testid="swatch">
					{#snippet child({ props })}
						<span data-child-slot="swatch" {...props}></span>
					{/snippet}
				</ColorPicker.Swatch>
			{:else}
				<ColorPicker.Swatch data-testid="swatch" />
			{/if}
		</ColorPicker.Trigger>
	{:else if mode === 'swatch-child'}
		<ColorPicker.Swatch data-testid="swatch">
			{#snippet child({ props })}
				<span data-child-slot="swatch" {...props}></span>
			{/snippet}
		</ColorPicker.Swatch>
	{:else}
		<ColorPicker.Swatch data-testid="swatch" />
	{/if}

	{#if mode === 'content-child'}
		<ColorPicker.Content data-testid="content">
			{#snippet child({ props })}
				<section data-child-slot="content" {...props}>
					{@render panel()}
				</section>
			{/snippet}
		</ColorPicker.Content>
	{:else}
		<ColorPicker.Content data-testid="content">
			{@render panel()}
		</ColorPicker.Content>
	{/if}
{/snippet}

{#snippet picker()}
	{#if binding === 'function'}
		<ColorPicker.Root
			bind:value={() => authoritativeValue, (next) => onDeclinedValue?.(next)}
			bind:open
			bind:format
			{...rootProps}
		>
			{@render body()}
		</ColorPicker.Root>
	{:else if binding === 'controlled'}
		<ColorPicker.Root {value} {open} {format} {...rootProps}>
			{@render body()}
		</ColorPicker.Root>
	{:else if binding === 'value'}
		<ColorPicker.Root bind:value bind:open bind:format {...rootProps}>
			{@render body()}
		</ColorPicker.Root>
	{:else if mode === 'root-child'}
		<ColorPicker.Root {...rootProps}>
			{#snippet child({ props })}
				<section data-child-slot="root" {...props}>
					{@render body()}
				</section>
			{/snippet}
		</ColorPicker.Root>
	{:else}
		<ColorPicker.Root {...rootProps}>
			{@render body()}
		</ColorPicker.Root>
	{/if}
{/snippet}

{#snippet framed()}
	{#if withOuterInputs}
		<input aria-label="Before the picker" data-testid="before" />
		{@render picker()}
		<input aria-label="After the picker" data-testid="after" />
	{:else}
		{@render picker()}
	{/if}
{/snippet}

{#snippet wrapped()}
	{#if withForm}
		<form data-testid="form" onsubmit={handleSubmit}>
			{@render framed()}
			<button type="submit" data-testid="submit">Submit</button>
		</form>
	{:else}
		{@render framed()}
	{/if}
{/snippet}

{#if providerDir}
	<DirectionProvider dir={providerDir}>
		{@render wrapped()}
	</DirectionProvider>
{:else}
	{@render wrapped()}
{/if}
