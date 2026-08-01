<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	/**
	 * Which composition this render exercises. A `.ts` spec cannot express `bind:value`, a `<form>`
	 * ancestor, an ambient `<DirectionProvider>`, a `child` snippet, or a part rendered with no
	 * provider above it, so everything needing a real component tree goes through this file. It is
	 * not collected by Vitest (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 *
	 * Only *structural* variations are modes: everything that differs only in what the root is handed
	 * (controlled, form, rtl, multiple, orientation) is a prop on the one default composition.
	 */
	export type ListboxHarnessMode =
		| 'default'
		/** Each non-Root part with no `<Listbox.Root>` ancestor at all. */
		| 'bare-group'
		| 'bare-group-label'
		| 'bare-item'
		| 'bare-item-indicator'
		/** Inside a `<Listbox.Root>` but missing the part's own nearer provider. */
		| 'group-label-without-group'
		| 'item-indicator-without-item'
		/** A `<Listbox.Item value="">`, which must throw. */
		| 'empty-item-value';

	/**
	 * How the harness hands `value` to the root.
	 *
	 * - `none` — uncontrolled: only `defaultValue` is passed.
	 * - `value` — `bind:value`, the parent accepts every change.
	 * - `function` — `bind:value={() => authoritative, (next) => …}`, the parent stays authoritative
	 *   and declines the write.
	 */
	export type ListboxHarnessBinding = 'none' | 'value' | 'function';

	/** One rendered `<Listbox.Item>`. */
	export type ListboxHarnessOption = {
		value: string;
		label: string;
		/** The heading of the `<Listbox.Group>` this option belongs to, when `withGroups`. */
		group?: string;
		disabled?: boolean;
	};

	/** The default list — upstream's three skate tricks, in upstream's order. */
	export const LISTBOX_OPTIONS: readonly ListboxHarnessOption[] = [
		{ value: 'kickflip', label: 'Kickflip', group: 'Basic Tricks' },
		{ value: 'heelflip', label: 'Heelflip', group: 'Basic Tricks' },
		{ value: 'fs-540', label: 'FS 540', group: 'Advanced Tricks' }
	];

	/** Six options in a 3 × 2 arrangement, for the `orientation="mixed"` grid cases. */
	export const LISTBOX_GRID_OPTIONS: readonly ListboxHarnessOption[] = [
		{ value: 'one', label: 'One' },
		{ value: 'two', label: 'Two' },
		{ value: 'three', label: 'Three' },
		{ value: 'four', label: 'Four' },
		{ value: 'five', label: 'Five' },
		{ value: 'six', label: 'Six' }
	];

	/** Four options where three share a first letter — the typeahead cycling list. */
	export const LISTBOX_TYPEAHEAD_OPTIONS: readonly ListboxHarnessOption[] = [
		{ value: 'kickflip', label: 'Kickflip' },
		{ value: 'heelflip', label: 'Heelflip' },
		{ value: 'hardflip', label: 'Hardflip' },
		{ value: 'hospital-flip', label: 'Hospital Flip' }
	];

	export type ListboxHarnessProps = {
		/** @default 'default' */
		mode?: ListboxHarnessMode;
		/** @default 'none' */
		binding?: ListboxHarnessBinding;
		// root
		value?: string | string[];
		/** The value a declining parent keeps returning in `binding="function"` mode. */
		authoritative?: string | string[];
		/** Receives every write a declining parent refuses to apply. */
		onDeclinedValue?: (value: string | string[]) => void;
		defaultValue?: string | string[];
		onValueChange?: (value: string | string[]) => void;
		dir?: Direction;
		disabled?: boolean;
		loop?: boolean;
		multiple?: boolean;
		orientation?: 'horizontal' | 'vertical' | 'mixed';
		virtual?: boolean;
		name?: string;
		// parts
		/** @default LISTBOX_OPTIONS */
		options?: readonly ListboxHarnessOption[];
		/** Called by every item's `onSelect`. */
		onSelect?: (value: string) => void;
		/** Wrap the items in `<Listbox.Group>`s keyed on each option's `group`. @default false */
		withGroups?: boolean;
		/** Passed to every `<Listbox.ItemIndicator>`. @default false */
		itemIndicatorForceMount?: boolean;
		/** Render all five parts through their `child` snippet instead of the default element. */
		asChild?: boolean;
		// surroundings
		/** Wrap the listbox in a `<form>` with a submit button. @default false */
		withForm?: boolean;
		onSubmit?: (event: SubmitEvent) => void;
		/** Wrap the listbox in a `<DirectionProvider>` with this direction. */
		providerDir?: Direction;
		/** A focusable element before and after the root, so `userEvent.tab()` can leave it. */
		withOutsideButton?: boolean;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import * as Listbox from './index.js';

	let {
		mode = 'default',
		binding = 'none',
		value = $bindable(),
		authoritative = '',
		onDeclinedValue,
		defaultValue,
		onValueChange,
		dir,
		disabled,
		loop,
		multiple = false,
		orientation,
		virtual,
		name,
		options = LISTBOX_OPTIONS,
		onSelect,
		withGroups = false,
		itemIndicatorForceMount = false,
		asChild = false,
		withForm = false,
		onSubmit,
		providerDir,
		withOutsideButton = true
	}: ListboxHarnessProps = $props();

	// No `<Listbox.Root>` ancestor in these modes — reproduces a consumer using a part outside its
	// provider, which must throw during that part's own initialisation.
	const bareMode = $derived(mode.startsWith('bare-'));

	/** The group headings, in first-appearance order. */
	const groupNames = $derived([...new Set(options.map((option) => option.group ?? 'Other'))]);

	const rootProps = $derived({
		defaultValue,
		onValueChange,
		dir,
		disabled,
		loop,
		multiple,
		orientation,
		virtual,
		name
	});
</script>

{#snippet indicator(option: ListboxHarnessOption)}
	{#if asChild}
		<Listbox.ItemIndicator
			forceMount={itemIndicatorForceMount}
			data-testid={`indicator-${option.value}`}
		>
			{#snippet child({ props })}
				<i {...props}>✓</i>
			{/snippet}
		</Listbox.ItemIndicator>
	{:else}
		<Listbox.ItemIndicator
			forceMount={itemIndicatorForceMount}
			data-testid={`indicator-${option.value}`}
		>
			✓
		</Listbox.ItemIndicator>
	{/if}
{/snippet}

{#snippet item(option: ListboxHarnessOption)}
	{#if asChild}
		<Listbox.Item
			value={option.value}
			disabled={option.disabled}
			{onSelect}
			data-testid={`option-${option.value}`}
		>
			{#snippet child({ props })}
				<span {...props}>
					{option.label}
					{@render indicator(option)}
				</span>
			{/snippet}
		</Listbox.Item>
	{:else}
		<Listbox.Item
			value={option.value}
			disabled={option.disabled}
			{onSelect}
			data-testid={`option-${option.value}`}
		>
			{option.label}
			{@render indicator(option)}
		</Listbox.Item>
	{/if}
{/snippet}

{#snippet groupLabel(groupName: string)}
	{#if asChild}
		<Listbox.GroupLabel data-testid={`group-label-${groupName}`}>
			{#snippet child({ props })}
				<h3 {...props}>{groupName}</h3>
			{/snippet}
		</Listbox.GroupLabel>
	{:else}
		<Listbox.GroupLabel data-testid={`group-label-${groupName}`}>{groupName}</Listbox.GroupLabel>
	{/if}
{/snippet}

{#snippet groupBody(groupName: string)}
	{@render groupLabel(groupName)}
	{#each options.filter((option) => (option.group ?? 'Other') === groupName) as option (option.value)}
		{@render item(option)}
	{/each}
{/snippet}

{#snippet group(groupName: string)}
	{#if asChild}
		<Listbox.Group data-testid={`group-${groupName}`}>
			{#snippet child({ props })}
				<fieldset {...props}>{@render groupBody(groupName)}</fieldset>
			{/snippet}
		</Listbox.Group>
	{:else}
		<Listbox.Group data-testid={`group-${groupName}`}>{@render groupBody(groupName)}</Listbox.Group>
	{/if}
{/snippet}

{#snippet body()}
	{#if withGroups}
		{#each groupNames as groupName (groupName)}
			{@render group(groupName)}
		{/each}
	{:else}
		{#each options as option (option.value)}
			{@render item(option)}
		{/each}
	{/if}
{/snippet}

{#snippet root()}
	{#if asChild}
		{#if binding === 'function'}
			<Listbox.Root
				bind:value={() => authoritative, (next) => onDeclinedValue?.(next)}
				{...rootProps}
				data-testid="root"
			>
				{#snippet child({ props })}
					<section {...props}>{@render body()}</section>
				{/snippet}
			</Listbox.Root>
		{:else}
			<Listbox.Root bind:value {...rootProps} data-testid="root">
				{#snippet child({ props })}
					<section {...props}>{@render body()}</section>
				{/snippet}
			</Listbox.Root>
		{/if}
	{:else if binding === 'function'}
		<Listbox.Root
			bind:value={() => authoritative, (next) => onDeclinedValue?.(next)}
			{...rootProps}
			data-testid="root"
		>
			{@render body()}
		</Listbox.Root>
	{:else}
		<Listbox.Root bind:value {...rootProps} data-testid="root">
			{@render body()}
		</Listbox.Root>
	{/if}
{/snippet}

{#snippet framed()}
	{#if withOutsideButton}
		<button type="button" data-testid="before">Before</button>
	{/if}
	{#if withForm}
		<form data-testid="form" onsubmit={onSubmit}>
			{@render root()}
			<button type="submit">Submit</button>
		</form>
	{:else}
		{@render root()}
	{/if}
	{#if withOutsideButton}
		<button type="button" data-testid="after">After</button>
	{/if}
{/snippet}

{#if bareMode}
	{#if mode === 'bare-group'}
		<Listbox.Group />
	{:else if mode === 'bare-group-label'}
		<Listbox.GroupLabel />
	{:else if mode === 'bare-item'}
		<Listbox.Item value="kickflip" />
	{:else}
		<Listbox.ItemIndicator forceMount />
	{/if}
{:else if mode === 'group-label-without-group'}
	<Listbox.Root>
		<Listbox.GroupLabel />
	</Listbox.Root>
{:else if mode === 'item-indicator-without-item'}
	<Listbox.Root>
		<Listbox.ItemIndicator forceMount />
	</Listbox.Root>
{:else if mode === 'empty-item-value'}
	<Listbox.Root>
		<Listbox.Item value="">Nothing</Listbox.Item>
	</Listbox.Root>
{:else if providerDir}
	<DirectionProvider dir={providerDir}>
		{@render framed()}
	</DirectionProvider>
{:else}
	{@render framed()}
{/if}
