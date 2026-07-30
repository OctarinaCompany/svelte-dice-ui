<script lang="ts" module>
	import type { Country } from './index.js';

	/**
	 * Which single composition this render exercises. A `.ts` spec cannot express `bind:value`, the
	 * function binding `bind:value={get, set}`, a `child` snippet, a `<form>` ancestor, a `dir="rtl"`
	 * frame, or a part rendered with no provider above it, so everything needing a real component tree
	 * goes through this file. It is not collected by Vitest (`include` is `.{js,ts}`) and is not listed
	 * in `registry.json`.
	 *
	 * - `default` — uncontrolled: `defaultValue`/`defaultCountry` seed the root, which owns both.
	 * - `controlled` — `bind:value`, `bind:country` and `bind:open`; the parent accepts every change.
	 * - `function-binding` — `bind:value={() => authoritative, (next) => …}`, the parent stays
	 *   authoritative and declines the write.
	 * - `form` — the parts sit inside a plain `<form>` with a submit button.
	 * - `rtl` — the parts sit inside a `dir="rtl"` ancestor.
	 * - `child` — the root is rendered onto a caller-supplied element through the `child` snippet.
	 * - `child-form` — the same `child` snippet, this time inside a `<form>`: the pair pins that form
	 *   detection travels with the props rather than with the internal `<div>`.
	 * - `bare-country-select` / `bare-field` — one part with no `<PhoneInput.Root>` ancestor.
	 */
	export type PhoneInputHarnessMode =
		| 'default'
		| 'controlled'
		| 'function-binding'
		| 'form'
		| 'rtl'
		| 'child'
		| 'child-form'
		| 'bare-country-select'
		| 'bare-field';

	export type PhoneInputHarnessProps = {
		/** @default 'default' */
		mode?: PhoneInputHarnessMode;
		// root
		value?: string;
		defaultValue?: string;
		onValueChange?: (value: string) => void;
		country?: string;
		defaultCountry?: string;
		onCountryChange?: (country: string) => void;
		countries?: Country[];
		name?: string;
		placeholder?: string;
		disabled?: boolean;
		readOnly?: boolean;
		required?: boolean;
		invalid?: boolean;
		showFlag?: boolean;
		id?: string;
		class?: string;
		/** Extra attributes spread onto the root, for the "`restProps` overrides the defaults" case. */
		rootProps?: Record<string, unknown>;
		// parts
		/** A `placeholder` passed straight to `<PhoneInput.Field>`, which the root's must beat. */
		fieldPlaceholder?: string;
		fieldDisabled?: boolean;
		fieldReadOnly?: boolean;
		fieldRequired?: boolean;
		fieldOninput?: (event: Event & { currentTarget: EventTarget & HTMLInputElement }) => void;
		countrySelectDisabled?: boolean;
		/** Leave the country select out entirely, so a render stays cheap. @default true */
		withCountrySelect?: boolean;
		// controlled plumbing
		/** The value a declining parent keeps returning in `function-binding` mode. */
		authoritative?: string;
		/** Receives every write a declining parent refuses to apply. */
		onDeclinedValue?: (value: string) => void;
		/** The country a declining parent keeps returning in `function-binding` mode. */
		authoritativeCountry?: string;
		/** Receives every country write a declining parent refuses to apply. */
		onDeclinedCountry?: (country: string) => void;
		/** Reports what `bind:value` wrote back into this harness — the child → parent leg. */
		onValueBinding?: (value: string | undefined) => void;
		/** Reports what `bind:country` wrote back into this harness. */
		onCountryBinding?: (country: string | undefined) => void;
		/** The popover open state, bindable in `controlled` mode. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		/** Reports what `bind:open` wrote back into this harness. */
		onOpenBinding?: (open: boolean | undefined) => void;
		// surroundings
		/** Renders a `<label for>` associated with the field. */
		label?: string;
		/** Fires with the submitted `FormData` entry for `name` in `form` mode. */
		onSubmitted?: (value: string | null) => void;
	};
</script>

<script lang="ts">
	import * as PhoneInput from './index.js';

	let {
		mode = 'default',
		value = $bindable(),
		defaultValue,
		onValueChange,
		country = $bindable(),
		defaultCountry,
		onCountryChange,
		countries,
		name = 'phone',
		placeholder,
		disabled,
		readOnly,
		required,
		invalid,
		showFlag,
		id,
		class: className,
		rootProps,
		fieldPlaceholder,
		fieldDisabled,
		fieldReadOnly,
		fieldRequired,
		fieldOninput,
		countrySelectDisabled,
		withCountrySelect = true,
		authoritative = '',
		onDeclinedValue,
		authoritativeCountry = '',
		onDeclinedCountry,
		onValueBinding,
		onCountryBinding,
		open = $bindable(),
		onOpenChange,
		onOpenBinding,
		label,
		onSubmitted
	}: PhoneInputHarnessProps = $props();

	const fieldId = 'phone-input-harness-field';

	// No `<PhoneInput.Root>` ancestor in these modes — reproduces a consumer using a part outside its
	// provider, which must throw during that part's own initialisation.
	const bareMode = $derived(mode.startsWith('bare-'));

	const sharedRootProps = $derived({
		onValueChange,
		onCountryChange,
		countries,
		name,
		placeholder,
		disabled,
		readOnly,
		required,
		invalid,
		showFlag,
		id,
		class: className,
		'data-testid': 'root',
		...rootProps
	});

	function handleSubmit(event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }) {
		event.preventDefault();
		const entry = new FormData(event.currentTarget).get(name);
		onSubmitted?.(typeof entry === 'string' ? entry : null);
	}

	$effect(() => {
		onValueBinding?.(value);
	});

	$effect(() => {
		onCountryBinding?.(country);
	});

	$effect(() => {
		onOpenBinding?.(open);
	});
</script>

{#snippet parts()}
	{#if withCountrySelect}
		{#if mode === 'controlled'}
			<PhoneInput.CountrySelect bind:open {onOpenChange} disabled={countrySelectDisabled} />
		{:else}
			<PhoneInput.CountrySelect {open} {onOpenChange} disabled={countrySelectDisabled} />
		{/if}
	{/if}
	<PhoneInput.Field
		id={label ? fieldId : undefined}
		data-testid="field"
		placeholder={fieldPlaceholder}
		disabled={fieldDisabled}
		readOnly={fieldReadOnly}
		required={fieldRequired}
		oninput={fieldOninput}
	/>
{/snippet}

{#snippet root()}
	{#if mode === 'controlled'}
		<PhoneInput.Root bind:value bind:country {...sharedRootProps}>
			{@render parts()}
		</PhoneInput.Root>
	{:else if mode === 'function-binding'}
		<PhoneInput.Root
			bind:value={() => authoritative, (next) => onDeclinedValue?.(next)}
			bind:country={() => authoritativeCountry, (next) => onDeclinedCountry?.(next)}
			{...sharedRootProps}
		>
			{@render parts()}
		</PhoneInput.Root>
	{:else if mode === 'child' || mode === 'child-form'}
		<PhoneInput.Root {defaultValue} {defaultCountry} {...sharedRootProps}>
			{#snippet child({ props })}
				<section data-child-slot="phone-input" {...props}>
					{@render parts()}
				</section>
			{/snippet}
		</PhoneInput.Root>
	{:else}
		<PhoneInput.Root {defaultValue} {defaultCountry} {...sharedRootProps}>
			{@render parts()}
		</PhoneInput.Root>
	{/if}
{/snippet}

{#snippet labelled()}
	{#if label}
		<label for={fieldId}>{label}</label>
		{@render root()}
	{:else}
		{@render root()}
	{/if}
{/snippet}

{#if bareMode}
	{#if mode === 'bare-country-select'}
		<PhoneInput.CountrySelect />
	{:else}
		<PhoneInput.Field />
	{/if}
{:else if mode === 'form' || mode === 'child-form'}
	<form data-testid="form" onsubmit={handleSubmit}>
		{@render labelled()}
		<button type="submit">Submit</button>
	</form>
{:else if mode === 'rtl'}
	<div dir="rtl" data-testid="direction-frame">
		{@render labelled()}
	</div>
{:else}
	{@render labelled()}
{/if}
