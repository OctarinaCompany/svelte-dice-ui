<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	import type { SegmentPlaceholder, TimePickerClickAction } from './index.js';

	/**
	 * Which single composition this render exercises. A `.ts` spec cannot express `bind:value`, the
	 * function binding `bind:value={get, set}`, a `child` snippet, a `<form>` ancestor or a part
	 * rendered with no provider above it, so everything needing a real component tree goes through
	 * this file. It is not collected by Vitest (`include` is `.{js,ts}`) and is not listed in
	 * `registry.json`.
	 */
	export type TimePickerHarnessMode =
		| 'default'
		| 'bare-label'
		| 'bare-column'
		/** An `<Input>` inside a `<Root>` but outside any `<InputGroup>`. */
		| 'ungrouped-input'
		/** A `<ColumnItem>` inside a `<Content>` but outside any `<Column>`. */
		| 'uncolumned-item'
		| 'root-child'
		| 'group-child'
		| 'column-item-child';

	/**
	 * How the harness hands the picker its `value` / `open`.
	 *
	 * - `none` — uncontrolled: `defaultValue` / `defaultOpen` seed it and the component owns it.
	 * - `value` — `bind:value` / `bind:open`, the parent accepts every change.
	 * - `controlled` — `value=` / `open=` with no binding, so the parent is authoritative and the
	 *   rendered state must not move on its own.
	 * - `function` — `bind:value={() => authoritative, (next) => …}`, a parent that declines writes.
	 */
	export type TimePickerHarnessBinding = 'none' | 'value' | 'controlled' | 'function';

	export type TimePickerHarnessProps = {
		/** @default 'default' */
		mode?: TimePickerHarnessMode;
		/** @default 'none' */
		binding?: TimePickerHarnessBinding;
		// root configuration
		id?: string;
		defaultValue?: string;
		defaultOpen?: boolean;
		locale?: string;
		dir?: Direction;
		hourStep?: number;
		minuteStep?: number;
		secondStep?: number;
		segmentPlaceholder?: SegmentPlaceholder;
		openOnFocus?: boolean;
		inputGroupClickAction?: TimePickerClickAction;
		min?: string;
		max?: string;
		name?: string;
		disabled?: boolean;
		readOnly?: boolean;
		required?: boolean;
		invalid?: boolean;
		showSeconds?: boolean;
		class?: string;
		// composition
		/** Render the second segment and the second column. @default false */
		withSeconds?: boolean;
		/** Render the period segment. @default true */
		withPeriod?: boolean;
		/** Render `<TimePicker.Clear>` inside the panel. @default true */
		withClear?: boolean;
		/** Render `<TimePicker.Label>`. @default true */
		withLabel?: boolean;
		/** Disable the minute segment, so `seek` has something to skip. @default false */
		disableMinute?: boolean;
		/** Overrides the hour segment's default `aria-label`. */
		hourLabel?: string;
		/** Overrides the trigger's default `aria-label`. */
		triggerLabel?: string;
		/** Give the trigger its own text content instead of the default clock icon. @default false */
		withTriggerText?: boolean;
		/** A caller `style` on `<TimePicker.InputGroup>`, for the CSS-variable override path. */
		groupStyle?: string;
		/** A caller `style` on the hour `<TimePicker.Input>`, for the per-segment override path. */
		hourInputStyle?: string;
		// bindings
		value?: string;
		open?: boolean;
		/** The value a declining parent keeps returning in `binding="function"` mode. */
		authoritativeValue?: string;
		onValueChange?: (value: string) => void;
		onOpenChange?: (open: boolean) => void;
		/** Reports what `bind:value` wrote back into this harness. */
		onValueBinding?: (value: string) => void;
		/** Receives every write a declining parent refuses to apply. */
		onDeclinedValue?: (value: string) => void;
		// surroundings
		/** Wrap the picker in a `<DirectionProvider>` with this direction. */
		providerDir?: Direction;
		/** Wrap the picker in a plain `<div dir="…">`, exercising the DOM leg of the chain. */
		domDir?: Direction;
		/** Wrap the picker in a `<form>`, so the hidden input renders. @default false */
		withForm?: boolean;
		/** Renders a plain `<input>` before and after the picker, for `Tab` traversal. */
		withOuterInputs?: boolean;
		onSubmitValue?: (value: string | File | null) => void;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import * as TimePicker from './index.js';

	let {
		mode = 'default',
		binding = 'none',
		id,
		defaultValue,
		defaultOpen,
		locale,
		dir,
		hourStep,
		minuteStep,
		secondStep,
		segmentPlaceholder,
		openOnFocus,
		inputGroupClickAction,
		min,
		max,
		name,
		disabled,
		readOnly,
		required,
		invalid,
		showSeconds,
		class: className,
		withSeconds = false,
		withPeriod = true,
		withClear = true,
		withLabel = true,
		disableMinute = false,
		hourLabel,
		triggerLabel,
		withTriggerText = false,
		groupStyle,
		hourInputStyle,
		value = $bindable(),
		open = $bindable(),
		authoritativeValue = '',
		onValueChange,
		onOpenChange,
		onValueBinding,
		onDeclinedValue,
		providerDir,
		domDir,
		withForm = false,
		withOuterInputs = false,
		onSubmitValue
	}: TimePickerHarnessProps = $props();

	const rootProps = $derived({
		id,
		defaultValue,
		defaultOpen,
		locale,
		dir,
		hourStep,
		minuteStep,
		secondStep,
		segmentPlaceholder,
		openOnFocus,
		inputGroupClickAction,
		min,
		max,
		name,
		disabled,
		readOnly,
		required,
		invalid,
		showSeconds,
		onValueChange,
		onOpenChange,
		class: className,
		'data-testid': 'root'
	});

	$effect(() => {
		onValueBinding?.(value ?? '');
	});

	function handleSubmit(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
		event.preventDefault();
		onSubmitValue?.(new FormData(event.currentTarget).get(name ?? ''));
	}
</script>

{#snippet parts()}
	{#if withLabel}
		<TimePicker.Label>Appointment time</TimePicker.Label>
	{/if}
	<TimePicker.InputGroup data-testid="group" style={groupStyle}>
		<TimePicker.Input
			segment="hour"
			aria-label={hourLabel}
			style={hourInputStyle}
			data-testid="hour"
		/>
		<TimePicker.Separator />
		<TimePicker.Input
			segment="minute"
			disabled={disableMinute ? true : undefined}
			data-testid="minute"
		/>
		{#if withSeconds}
			<TimePicker.Separator />
			<TimePicker.Input segment="second" data-testid="second" />
		{/if}
		{#if withPeriod}
			<TimePicker.Input segment="period" data-testid="period" />
		{/if}
		<!-- Two spellings, because `<Trigger>{#if}…{/if}</Trigger>` would hand it a `children` snippet
		     even when the branch is empty, and the default icon only renders when there is none. -->
		{#if withTriggerText}
			<TimePicker.Trigger aria-label={triggerLabel} data-testid="trigger">
				Choose a time
			</TimePicker.Trigger>
		{:else}
			<TimePicker.Trigger aria-label={triggerLabel} data-testid="trigger" />
		{/if}
	</TimePicker.InputGroup>
	<TimePicker.Content data-testid="content">
		<TimePicker.Hour data-testid="hour-column" />
		<TimePicker.Minute data-testid="minute-column" />
		{#if withSeconds}
			<TimePicker.Second data-testid="second-column" />
		{/if}
		<TimePicker.Period data-testid="period-column" />
		{#if withClear}
			<TimePicker.Clear data-testid="clear" />
		{/if}
	</TimePicker.Content>
{/snippet}

{#snippet groupChildParts()}
	{#if withLabel}
		<TimePicker.Label>Appointment time</TimePicker.Label>
	{/if}
	<TimePicker.InputGroup data-testid="group">
		{#snippet child({ props })}
			<section data-child-slot="group" {...props}>
				<TimePicker.Input segment="hour" data-testid="hour" />
				<TimePicker.Separator />
				<TimePicker.Input segment="minute" data-testid="minute" />
				{#if withPeriod}
					<TimePicker.Input segment="period" data-testid="period" />
				{/if}
				<TimePicker.Trigger data-testid="trigger" />
			</section>
		{/snippet}
	</TimePicker.InputGroup>
	<TimePicker.Content data-testid="content">
		<TimePicker.Hour data-testid="hour-column" />
		<TimePicker.Minute data-testid="minute-column" />
	</TimePicker.Content>
{/snippet}

{#snippet columnItemChildParts()}
	<TimePicker.InputGroup data-testid="group">
		<TimePicker.Input segment="hour" data-testid="hour" />
		<TimePicker.Separator />
		<TimePicker.Input segment="minute" data-testid="minute" />
		<TimePicker.Trigger data-testid="trigger" />
	</TimePicker.InputGroup>
	<TimePicker.Content data-testid="content">
		<TimePicker.Column data-testid="custom-column">
			{#each [9, 10, 11] as hour (hour)}
				<TimePicker.ColumnItem value={hour} onclick={() => undefined}>
					{#snippet child({ props })}
						<button data-child-slot="column-item" {...props}>{hour}</button>
					{/snippet}
				</TimePicker.ColumnItem>
			{/each}
		</TimePicker.Column>
		<TimePicker.Minute data-testid="minute-column" />
	</TimePicker.Content>
{/snippet}

{#snippet body()}
	{#if mode === 'column-item-child'}
		{@render columnItemChildParts()}
	{:else if mode === 'group-child'}
		{@render groupChildParts()}
	{:else}
		{@render parts()}
	{/if}
{/snippet}

{#snippet picker()}
	{#if binding === 'function'}
		<TimePicker.Root
			bind:value={() => authoritativeValue, (next) => onDeclinedValue?.(next)}
			bind:open
			{...rootProps}
		>
			{@render body()}
		</TimePicker.Root>
	{:else if binding === 'controlled'}
		<TimePicker.Root {value} {open} {...rootProps}>
			{@render body()}
		</TimePicker.Root>
	{:else if binding === 'value'}
		<TimePicker.Root bind:value bind:open {...rootProps}>
			{@render body()}
		</TimePicker.Root>
	{:else if mode === 'root-child'}
		<TimePicker.Root {...rootProps}>
			{#snippet child({ props })}
				<section data-child-slot="root" {...props}>
					{@render body()}
				</section>
			{/snippet}
		</TimePicker.Root>
	{:else}
		<TimePicker.Root {...rootProps}>
			{@render body()}
		</TimePicker.Root>
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

{#if mode === 'bare-label'}
	<TimePicker.Label>Orphan</TimePicker.Label>
{:else if mode === 'bare-column'}
	<TimePicker.Column />
{:else if mode === 'ungrouped-input'}
	<TimePicker.Root>
		<TimePicker.Input segment="hour" />
	</TimePicker.Root>
{:else if mode === 'uncolumned-item'}
	<TimePicker.Root defaultOpen>
		<TimePicker.Content>
			<TimePicker.ColumnItem value={1} />
		</TimePicker.Content>
	</TimePicker.Root>
{:else if providerDir}
	<DirectionProvider dir={providerDir}>
		{@render wrapped()}
	</DirectionProvider>
{:else if domDir}
	<div dir={domDir}>
		{@render wrapped()}
	</div>
{:else}
	{@render wrapped()}
{/if}
