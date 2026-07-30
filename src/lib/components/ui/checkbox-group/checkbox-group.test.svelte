<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	import type { CheckboxGroupOrientation, CheckboxGroupValidationResult } from './index.js';

	/**
	 * Which single composition this render exercises. A `.ts` spec cannot express `bind:value`, the
	 * function binding `bind:value={get, set}`, a `<form>` ancestor, or a part rendered with no
	 * provider above it, so everything needing a real component tree goes through this file. It is not
	 * collected by Vitest (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type CheckboxGroupHarnessMode =
		| 'default'
		| 'bare-item'
		| 'bare-indicator'
		| 'bare-list'
		| 'bare-label'
		| 'bare-description'
		| 'bare-message'
		| 'indicator-outside-item';

	/**
	 * How the harness hands `value` to the root.
	 *
	 * - `none` — uncontrolled: only `defaultValue` is passed, the root owns the value.
	 * - `value` — `bind:value`, the parent accepts every change.
	 * - `function` — `bind:value={() => authoritative, (next) => …}`, the parent stays authoritative
	 *   and may decline the write (spec US1 AS-5).
	 */
	export type CheckboxGroupHarnessBinding = 'none' | 'value' | 'function';

	export type CheckboxGroupHarnessItem = {
		value: string;
		label: string;
		/** @default false */
		disabled?: boolean;
		/** @default false */
		required?: boolean;
		/** Overrides the group's `name` for this item's hidden input. */
		name?: string;
	};

	/** The three-item composition the upstream test file uses (test:27-40). */
	export const CHECKBOX_GROUP_HARNESS_ITEMS: readonly CheckboxGroupHarnessItem[] = [
		{ value: 'kickflip', label: 'Kickflip' },
		{ value: 'heelflip', label: 'Heelflip' },
		{ value: 'fs-540', label: 'FS 540' }
	];

	export type CheckboxGroupHarnessProps = {
		/** @default 'default' */
		mode?: CheckboxGroupHarnessMode;
		/** @default 'none' */
		binding?: CheckboxGroupHarnessBinding;
		// root
		value?: string[];
		/** The value a declining parent keeps returning in `binding="function"` mode. */
		authoritative?: string[];
		/** Receives every write a declining parent refuses to apply. */
		onDeclinedValue?: (value: string[]) => void;
		defaultValue?: string[];
		onValueChange?: (value: string[]) => void;
		onValidate?: (value: string[]) => CheckboxGroupValidationResult;
		disabled?: boolean;
		invalid?: boolean;
		readOnly?: boolean;
		required?: boolean;
		name?: string;
		dir?: Direction;
		orientation?: CheckboxGroupOrientation;
		// parts
		items?: readonly CheckboxGroupHarnessItem[];
		/** @default 'Favorite tricks' */
		label?: string;
		/** @default true */
		withLabel?: boolean;
		/** @default 'Select your favorite tricks' */
		description?: string;
		/** @default true */
		withDescription?: boolean;
		/** @default false */
		descriptionAnnounce?: boolean;
		/** @default false */
		descriptionHideOnError?: boolean;
		/** @default true */
		withMessage?: boolean;
		/** @default false */
		messageAnnounce?: boolean;
		/** Fallback content for the message, used when `onValidate` supplied none. */
		messageFallback?: string;
		/** Render each item's indicator through the `indicator` snippet with `forceMount` set. */
		indicatorForceMount?: boolean;
		// surroundings
		/** Wrap the group in a `<form>` with a submit button. @default false */
		withForm?: boolean;
		onSubmit?: (event: SubmitEvent) => void;
		/** Add a `type="reset"` button inside the form. @default false */
		withReset?: boolean;
		/** Wrap the group in a `<DirectionProvider>` with this direction. */
		providerDir?: Direction;
		/** Reports the value `bind:value` writes back into this harness — the child → parent leg. */
		onValueBinding?: (value: string[] | undefined) => void;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import * as CheckboxGroup from './index.js';

	let {
		mode = 'default',
		binding = 'none',
		value = $bindable(),
		authoritative = [],
		onDeclinedValue,
		defaultValue,
		onValueChange,
		onValidate,
		disabled,
		invalid,
		readOnly,
		required,
		name,
		dir,
		orientation,
		items = CHECKBOX_GROUP_HARNESS_ITEMS,
		label = 'Favorite tricks',
		withLabel = true,
		description = 'Select your favorite tricks',
		withDescription = true,
		descriptionAnnounce,
		descriptionHideOnError,
		withMessage = true,
		messageAnnounce,
		messageFallback,
		indicatorForceMount = false,
		withForm = false,
		onSubmit,
		withReset = false,
		providerDir,
		onValueBinding
	}: CheckboxGroupHarnessProps = $props();

	// No `<CheckboxGroup.Root>` ancestor in these modes — reproduces a consumer using a part outside
	// its provider, which must throw during that part's own initialisation.
	const bareMode = $derived(mode.startsWith('bare-'));

	const rootProps = $derived({
		defaultValue,
		onValueChange,
		onValidate,
		disabled,
		invalid,
		readOnly,
		required,
		name,
		dir,
		orientation
	});

	$effect(() => {
		onValueBinding?.(value);
	});
</script>

{#snippet forceMountIndicator()}
	<CheckboxGroup.Indicator forceMount data-testid="indicator" />
{/snippet}

{#snippet groupBody()}
	{#if withLabel}
		<CheckboxGroup.Label data-testid="label">{label}</CheckboxGroup.Label>
	{/if}
	{#if withDescription}
		<CheckboxGroup.Description
			data-testid="description"
			announce={descriptionAnnounce}
			hideOnError={descriptionHideOnError}
		>
			{description}
		</CheckboxGroup.Description>
	{/if}
	<CheckboxGroup.List data-testid="list">
		{#each items as item (item.value)}
			<CheckboxGroup.Item
				value={item.value}
				disabled={item.disabled}
				required={item.required}
				name={item.name}
				data-testid={`item-${item.value}`}
				indicator={indicatorForceMount ? forceMountIndicator : undefined}
			>
				{item.label}
			</CheckboxGroup.Item>
		{/each}
	</CheckboxGroup.List>
	{#if withMessage}
		{#if messageFallback}
			<CheckboxGroup.Message data-testid="message" announce={messageAnnounce}>
				{messageFallback}
			</CheckboxGroup.Message>
		{:else}
			<!-- No `children`, so the region stays out of the DOM until `onValidate` supplies a message. -->
			<CheckboxGroup.Message data-testid="message" announce={messageAnnounce} />
		{/if}
	{/if}
{/snippet}

{#snippet group()}
	{#if binding === 'function'}
		<CheckboxGroup.Root
			bind:value={() => authoritative, (next) => onDeclinedValue?.(next)}
			{...rootProps}
			data-testid="root"
		>
			{@render groupBody()}
		</CheckboxGroup.Root>
	{:else if binding === 'value'}
		<CheckboxGroup.Root bind:value {...rootProps} data-testid="root">
			{@render groupBody()}
		</CheckboxGroup.Root>
	{:else}
		<CheckboxGroup.Root {...rootProps} data-testid="root">
			{@render groupBody()}
		</CheckboxGroup.Root>
	{/if}
{/snippet}

{#snippet framed()}
	{#if withForm}
		<form data-testid="form" onsubmit={onSubmit}>
			{@render group()}
			<button type="submit">Submit</button>
			{#if withReset}
				<button type="reset">Reset</button>
			{/if}
		</form>
	{:else}
		{@render group()}
	{/if}
{/snippet}

{#if bareMode}
	{#if mode === 'bare-item'}
		<CheckboxGroup.Item value="kickflip">Kickflip</CheckboxGroup.Item>
	{:else if mode === 'bare-indicator'}
		<CheckboxGroup.Indicator />
	{:else if mode === 'bare-list'}
		<CheckboxGroup.List />
	{:else if mode === 'bare-label'}
		<CheckboxGroup.Label />
	{:else if mode === 'bare-description'}
		<CheckboxGroup.Description />
	{:else}
		<CheckboxGroup.Message />
	{/if}
{:else if mode === 'indicator-outside-item'}
	<CheckboxGroup.Root>
		<CheckboxGroup.Indicator />
	</CheckboxGroup.Root>
{:else if providerDir}
	<DirectionProvider dir={providerDir}>
		{@render framed()}
	</DirectionProvider>
{:else}
	{@render framed()}
{/if}
