<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	/**
	 * Which composition this render exercises. A `.ts` spec cannot express `bind:value`, the function
	 * binding `bind:value={get, set}`, a `<form>` ancestor, a snippet, or a part rendered with no
	 * provider above it, so everything needing a real component tree goes through this file. It is not
	 * collected by Vitest (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 *
	 * Only *structural* variations are modes: everything the plan calls a mode but which differs only
	 * in what the root is handed (controlled, function binding, form, rtl, multiple, filtering) is a
	 * prop on the one default composition.
	 */
	export type ComboboxHarnessMode =
		| 'default'
		/** Each non-Root part with no `<Combobox.Root>` ancestor at all. */
		| 'bare-label'
		| 'bare-anchor'
		| 'bare-trigger'
		| 'bare-input'
		| 'bare-cancel'
		| 'bare-badge-list'
		| 'bare-badge-item'
		| 'bare-badge-item-delete'
		| 'bare-portal'
		| 'bare-content'
		| 'bare-arrow'
		| 'bare-loading'
		| 'bare-empty'
		| 'bare-group'
		| 'bare-group-label'
		| 'bare-item'
		| 'bare-item-text'
		| 'bare-item-indicator'
		| 'bare-separator'
		/** Inside a `<Combobox.Root>` but missing the part's own nearer provider. */
		| 'group-label-without-group'
		| 'badge-item-without-badge-list'
		| 'badge-item-delete-without-badge-item'
		| 'item-text-without-item'
		| 'item-indicator-without-item'
		| 'arrow-without-content'
		/** A `<Combobox.Item value="">`, which must throw. */
		| 'empty-item-value';

	/**
	 * How the harness hands `value` to the root.
	 *
	 * - `none` — uncontrolled: only `defaultValue` is passed.
	 * - `value` — `bind:value`, the parent accepts every change.
	 * - `function` — `bind:value={() => authoritative, (next) => …}`, the parent stays authoritative
	 *   and declines the write.
	 */
	export type ComboboxHarnessBinding = 'none' | 'value' | 'function';

	/** One rendered `<Combobox.Item>`. */
	export type ComboboxHarnessOption = {
		value: string;
		label: string;
		/** The heading of the `<Combobox.Group>` this option belongs to, when `withGroups`. */
		group?: string;
		disabled?: boolean;
	};

	/** The placeholder every query in the spec looks the input up by. */
	export const COMBOBOX_PLACEHOLDER = 'Search tricks...';

	/** The default list: two `f`-prefixed values, two `h`-prefixed, and a gap-matchable one. */
	export const COMBOBOX_OPTIONS: readonly ComboboxHarnessOption[] = [
		{ value: 'kickflip', label: 'Kickflip', group: 'Flips' },
		{ value: 'heelflip', label: 'Heelflip', group: 'Flips' },
		{ value: 'hardflip', label: 'Hardflip', group: 'Flips' },
		{ value: 'fs-540', label: 'FS 540', group: 'Airs' },
		{ value: 'boardslide', label: 'Boardslide', group: 'Grinds' }
	];

	export type ComboboxHarnessProps = {
		/** @default 'default' */
		mode?: ComboboxHarnessMode;
		/** @default 'none' */
		binding?: ComboboxHarnessBinding;
		// root
		value?: string | string[];
		/** The value a declining parent keeps returning in `binding="function"` mode. */
		authoritative?: string | string[];
		/** Receives every write a declining parent refuses to apply. */
		onDeclinedValue?: (value: string | string[]) => void;
		defaultValue?: string | string[];
		onValueChange?: (value: string | string[]) => void;
		open?: boolean;
		defaultOpen?: boolean;
		onOpenChange?: (open: boolean) => void;
		inputValue?: string;
		onInputValueChange?: (value: string) => void;
		onFilter?: (options: string[], inputValue: string) => string[];
		dir?: Direction;
		autoHighlight?: boolean;
		disabled?: boolean;
		exactMatch?: boolean;
		manualFiltering?: boolean;
		loop?: boolean;
		modal?: boolean;
		multiple?: boolean;
		openOnFocus?: boolean;
		preserveInputOnBlur?: boolean;
		readOnly?: boolean;
		required?: boolean;
		name?: string;
		// parts
		/** @default COMBOBOX_OPTIONS */
		options?: readonly ComboboxHarnessOption[];
		/** Called by every item's `onSelect`. */
		onSelect?: (value: string) => void;
		/** @default true */
		withLabel?: boolean;
		/** @default true */
		withAnchor?: boolean;
		/** Passed to `<Combobox.Anchor>`. @default false */
		preventInputFocus?: boolean;
		/** @default true */
		withTrigger?: boolean;
		/** @default true */
		withCancel?: boolean;
		/** @default false */
		cancelForceMount?: boolean;
		/** @default true */
		withPortal?: boolean;
		/** Passed to `<Combobox.Portal>`. @default document.body */
		portalTo?: Element | string;
		/** Passed to `<Combobox.Portal>`. @default false */
		portalDisabled?: boolean;
		/** Passed to `<Combobox.Content>`. @default false */
		contentForceMount?: boolean;
		/** @default true */
		withEmpty?: boolean;
		/** @default false */
		emptyKeepVisible?: boolean;
		/** Wrap the items in `<Combobox.Group>`s keyed on each option's `group`. @default false */
		withGroups?: boolean;
		/** Passed to every `<Combobox.Group>`. @default false */
		groupForceMount?: boolean;
		/** Render a `<Combobox.Separator>` between the groups. @default false */
		withSeparator?: boolean;
		/** @default false */
		separatorKeepVisible?: boolean;
		/** @default false */
		withLoading?: boolean;
		loadingValue?: number | null;
		loadingMax?: number;
		/** @default 'Loading tricks' */
		loadingLabel?: string;
		/** @default false */
		withArrow?: boolean;
		/** Render `<Combobox.BadgeList>` above the anchor. @default the root's `multiple` */
		withBadgeList?: boolean;
		/** @default false */
		badgeListForceMount?: boolean;
		/** @default 'horizontal' */
		badgeListOrientation?: 'horizontal' | 'vertical';
		/** Badge values rendered with a per-badge `disabled`. @default [] */
		disabledBadges?: readonly string[];
		/** @default false */
		itemIndicatorForceMount?: boolean;
		/** Only render items whose value is in this list — the `manualFiltering` demo shape. */
		visibleValues?: readonly string[];
		// surroundings
		/** Wrap the combobox in a `<form>` with a submit button. @default false */
		withForm?: boolean;
		onSubmit?: (event: SubmitEvent) => void;
		/** Wrap the combobox in a `<DirectionProvider>` with this direction. */
		providerDir?: Direction;
		/** A focusable element after the root, so `userEvent.tab()` can leave the component. */
		withOutsideButton?: boolean;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import * as Combobox from './index.js';

	let {
		mode = 'default',
		binding = 'none',
		value = $bindable(),
		authoritative = [],
		onDeclinedValue,
		defaultValue,
		onValueChange,
		open = $bindable(),
		defaultOpen,
		onOpenChange,
		inputValue = $bindable(),
		onInputValueChange,
		onFilter,
		dir,
		autoHighlight,
		disabled,
		exactMatch,
		manualFiltering,
		loop,
		modal,
		multiple = false,
		openOnFocus,
		preserveInputOnBlur,
		readOnly,
		required,
		name,
		options = COMBOBOX_OPTIONS,
		onSelect,
		withLabel = true,
		withAnchor = true,
		preventInputFocus = false,
		withTrigger = true,
		withCancel = true,
		cancelForceMount = false,
		withPortal = true,
		portalTo,
		portalDisabled = false,
		contentForceMount = false,
		withEmpty = true,
		emptyKeepVisible = false,
		withGroups = false,
		groupForceMount = false,
		withSeparator = false,
		separatorKeepVisible = false,
		withLoading = false,
		loadingValue,
		loadingMax,
		loadingLabel = 'Loading tricks',
		withArrow = false,
		withBadgeList,
		badgeListForceMount = false,
		badgeListOrientation = 'horizontal',
		disabledBadges = [],
		itemIndicatorForceMount = false,
		visibleValues,
		withForm = false,
		onSubmit,
		providerDir,
		withOutsideButton = true
	}: ComboboxHarnessProps = $props();

	// No `<Combobox.Root>` ancestor in these modes — reproduces a consumer using a part outside its
	// provider, which must throw during that part's own initialisation.
	const bareMode = $derived(mode.startsWith('bare-'));

	/** What the badge list renders. A declining parent never lets this move. */
	const selected = $derived.by<string[]>(() => {
		const current = binding === 'function' ? authoritative : value;
		if (Array.isArray(current)) return current;
		if (typeof current === 'string') return current === '' ? [] : [current];
		return [];
	});

	const shownOptions = $derived(
		visibleValues ? options.filter((option) => visibleValues.includes(option.value)) : options
	);

	/** The group headings, in first-appearance order. */
	const groupNames = $derived([...new Set(shownOptions.map((option) => option.group ?? 'Other'))]);

	const rootProps = $derived({
		defaultValue,
		onValueChange,
		defaultOpen,
		onOpenChange,
		onInputValueChange,
		onFilter,
		dir,
		autoHighlight,
		disabled,
		exactMatch,
		manualFiltering,
		loop,
		modal,
		multiple,
		openOnFocus,
		preserveInputOnBlur,
		readOnly,
		required,
		name
	});
</script>

{#snippet option(item: ComboboxHarnessOption)}
	<Combobox.Item
		value={item.value}
		label={item.label}
		disabled={item.disabled}
		{onSelect}
		data-testid={`item-${item.value}`}
	>
		<Combobox.ItemIndicator forceMount={itemIndicatorForceMount} />
		<Combobox.ItemText>{item.label}</Combobox.ItemText>
	</Combobox.Item>
{/snippet}

{#snippet list()}
	{#if withLoading}
		<Combobox.Loading value={loadingValue} max={loadingMax} label={loadingLabel}>
			Loading…
		</Combobox.Loading>
	{/if}
	{#if withEmpty}
		<Combobox.Empty keepVisible={emptyKeepVisible}>No tricks found.</Combobox.Empty>
	{/if}
	{#if withGroups}
		{#each groupNames as groupName, index (groupName)}
			{#if index > 0 && withSeparator}
				<Combobox.Separator keepVisible={separatorKeepVisible} data-testid="separator" />
			{/if}
			<Combobox.Group forceMount={groupForceMount} data-testid={`group-${groupName}`}>
				<Combobox.GroupLabel data-testid={`group-label-${groupName}`}>
					{groupName}
				</Combobox.GroupLabel>
				{#each shownOptions.filter((item) => (item.group ?? 'Other') === groupName) as item (item.value)}
					{@render option(item)}
				{/each}
			</Combobox.Group>
		{/each}
	{:else}
		{#each shownOptions as item (item.value)}
			{@render option(item)}
		{/each}
		{#if withSeparator}
			<Combobox.Separator keepVisible={separatorKeepVisible} data-testid="separator" />
		{/if}
	{/if}
	{#if withArrow}
		<Combobox.Arrow data-testid="arrow" />
	{/if}
{/snippet}

{#snippet content()}
	<Combobox.Content forceMount={contentForceMount} data-testid="content">
		{@render list()}
	</Combobox.Content>
{/snippet}

{#snippet body()}
	{#if withLabel}
		<Combobox.Label data-testid="label">Tricks</Combobox.Label>
	{/if}
	{#if withBadgeList ?? multiple}
		<Combobox.BadgeList
			forceMount={badgeListForceMount}
			orientation={badgeListOrientation}
			data-testid="badge-list"
		>
			{#each selected as badgeValue (badgeValue)}
				<Combobox.BadgeItem
					value={badgeValue}
					disabled={disabledBadges.includes(badgeValue)}
					data-testid={`badge-${badgeValue}`}
				>
					{badgeValue}
					<Combobox.BadgeItemDelete
						aria-label={`Remove ${badgeValue}`}
						data-testid={`badge-delete-${badgeValue}`}
					/>
				</Combobox.BadgeItem>
			{/each}
		</Combobox.BadgeList>
	{/if}
	{#if withAnchor}
		<Combobox.Anchor {preventInputFocus} data-testid="anchor">
			<Combobox.Input placeholder={COMBOBOX_PLACEHOLDER} data-testid="input" />
			{#if withCancel}
				<Combobox.Cancel
					forceMount={cancelForceMount}
					aria-label="Clear search"
					data-testid="cancel"
				/>
			{/if}
			{#if withTrigger}
				<Combobox.Trigger aria-label="Toggle tricks" data-testid="trigger" />
			{/if}
		</Combobox.Anchor>
	{:else}
		<Combobox.Input placeholder={COMBOBOX_PLACEHOLDER} data-testid="input" />
		{#if withTrigger}
			<Combobox.Trigger aria-label="Toggle tricks" data-testid="trigger" />
		{/if}
	{/if}
	{#if withPortal}
		<Combobox.Portal to={portalTo} disabled={portalDisabled}>
			{@render content()}
		</Combobox.Portal>
	{:else}
		{@render content()}
	{/if}
{/snippet}

{#snippet root()}
	{#if binding === 'function'}
		<Combobox.Root
			bind:value={() => authoritative, (next) => onDeclinedValue?.(next)}
			bind:open
			bind:inputValue
			{...rootProps}
			data-testid="root"
		>
			{@render body()}
		</Combobox.Root>
	{:else}
		<Combobox.Root bind:value bind:open bind:inputValue {...rootProps} data-testid="root">
			{@render body()}
		</Combobox.Root>
	{/if}
{/snippet}

{#snippet framed()}
	{#if withForm}
		<form data-testid="form" onsubmit={onSubmit}>
			{@render root()}
			<button type="submit">Submit</button>
		</form>
	{:else}
		{@render root()}
	{/if}
	{#if withOutsideButton}
		<button type="button" data-testid="outside">Outside</button>
	{/if}
{/snippet}

{#if bareMode}
	{#if mode === 'bare-label'}
		<Combobox.Label>Tricks</Combobox.Label>
	{:else if mode === 'bare-anchor'}
		<Combobox.Anchor />
	{:else if mode === 'bare-trigger'}
		<Combobox.Trigger />
	{:else if mode === 'bare-input'}
		<Combobox.Input />
	{:else if mode === 'bare-cancel'}
		<Combobox.Cancel forceMount />
	{:else if mode === 'bare-badge-list'}
		<Combobox.BadgeList forceMount />
	{:else if mode === 'bare-badge-item'}
		<Combobox.BadgeItem value="kickflip" />
	{:else if mode === 'bare-badge-item-delete'}
		<Combobox.BadgeItemDelete />
	{:else if mode === 'bare-portal'}
		<Combobox.Portal />
	{:else if mode === 'bare-content'}
		<Combobox.Content />
	{:else if mode === 'bare-arrow'}
		<Combobox.Arrow />
	{:else if mode === 'bare-loading'}
		<Combobox.Loading />
	{:else if mode === 'bare-empty'}
		<Combobox.Empty />
	{:else if mode === 'bare-group'}
		<Combobox.Group />
	{:else if mode === 'bare-group-label'}
		<Combobox.GroupLabel />
	{:else if mode === 'bare-item'}
		<Combobox.Item value="kickflip" />
	{:else if mode === 'bare-item-text'}
		<Combobox.ItemText />
	{:else if mode === 'bare-item-indicator'}
		<Combobox.ItemIndicator forceMount />
	{:else}
		<Combobox.Separator />
	{/if}
{:else if mode === 'group-label-without-group'}
	<Combobox.Root>
		<Combobox.GroupLabel />
	</Combobox.Root>
{:else if mode === 'badge-item-without-badge-list'}
	<Combobox.Root multiple>
		<Combobox.BadgeItem value="kickflip" />
	</Combobox.Root>
{:else if mode === 'badge-item-delete-without-badge-item'}
	<Combobox.Root multiple>
		<Combobox.BadgeItemDelete />
	</Combobox.Root>
{:else if mode === 'item-text-without-item'}
	<Combobox.Root>
		<Combobox.ItemText />
	</Combobox.Root>
{:else if mode === 'item-indicator-without-item'}
	<Combobox.Root>
		<Combobox.ItemIndicator forceMount />
	</Combobox.Root>
{:else if mode === 'arrow-without-content'}
	<Combobox.Root defaultOpen>
		<Combobox.Arrow />
	</Combobox.Root>
{:else if mode === 'empty-item-value'}
	<Combobox.Root defaultOpen>
		<Combobox.Input />
		<Combobox.Content>
			<Combobox.Item value="">Nothing</Combobox.Item>
		</Combobox.Content>
	</Combobox.Root>
{:else if providerDir}
	<DirectionProvider dir={providerDir}>
		{@render framed()}
	</DirectionProvider>
{:else}
	{@render framed()}
{/if}
