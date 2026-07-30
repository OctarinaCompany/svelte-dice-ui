<script lang="ts" module>
	import type { HTMLInputAttributes } from 'svelte/elements';

	import type {
		MaskInputProps,
		MaskInputValidationMode,
		MaskPattern,
		MaskPatternKey
	} from './index.js';

	/**
	 * Which single composition this render exercises. A `.ts` spec cannot express `bind:value`, the
	 * function binding `bind:value={get, set}`, a `child` snippet, or a `<form>` ancestor, so
	 * everything needing a real component tree goes through this file. It is not collected by Vitest
	 * (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 *
	 * - `default` — uncontrolled: `defaultValue` seeds the field and the component owns the value.
	 * - `controlled` — `bind:value`, the parent accepts every change.
	 * - `function-binding` — `bind:value={() => authoritative, (next) => …}`, the parent stays
	 *   authoritative and declines the write.
	 * - `child` — the field is rendered onto a caller-supplied `<input>` through the `child` snippet.
	 * - `form` — the field sits inside a plain `<form>` with a submit button.
	 */
	export type MaskInputHarnessMode =
		'default' | 'controlled' | 'function-binding' | 'child' | 'form';

	export type MaskInputHarnessProps = {
		/** @default 'default' */
		mode?: MaskInputHarnessMode;
		// forwarded to the field
		mask?: MaskPatternKey | MaskPattern;
		defaultValue?: string;
		currency?: string;
		locale?: string;
		validationMode?: MaskInputValidationMode;
		placeholder?: string;
		maskPlaceholder?: string;
		invalid?: boolean;
		withoutMask?: boolean;
		disabled?: boolean;
		readonly?: boolean;
		required?: boolean;
		class?: string;
		min?: string | number;
		max?: string | number;
		inputmode?: HTMLInputAttributes['inputmode'];
		maxlength?: number;
		name?: string;
		'aria-label'?: string;
		onValueChange?: MaskInputProps['onValueChange'];
		onValidate?: MaskInputProps['onValidate'];
		oninput?: MaskInputProps['oninput'];
		onkeydown?: MaskInputProps['onkeydown'];
		onpaste?: MaskInputProps['onpaste'];
		onfocus?: MaskInputProps['onfocus'];
		onblur?: MaskInputProps['onblur'];
		// the child → parent leg of `bind:value` in `controlled` mode
		value?: string;
		/** The value a declining parent keeps returning in `function-binding` mode. */
		authoritative?: string;
		/** Receives every write a declining parent refuses to apply. */
		onDeclinedValue?: (value: string) => void;
		/** Reports what `bind:value` wrote back into this harness. */
		onValueBinding?: (value: string) => void;
		// surroundings
		/** Wraps the field in a `<div dir>` so the RTL test can assert inheritance. */
		dir?: 'ltr' | 'rtl';
		/** Renders a `<label for>` associated with the field. */
		label?: string;
		/** Renders a plain `<input>` before and after the field, for `Tab` traversal. */
		withOuterInputs?: boolean;
		/** Receives the field element through `bind:ref`. */
		onRef?: (ref: HTMLInputElement | null) => void;
		/** Fires with the submitted `FormData` entry for `name` in `form` mode. */
		onSubmitted?: (value: string | null) => void;
	};
</script>

<script lang="ts">
	import { MaskInput } from './index.js';

	let {
		mode = 'default',
		mask,
		defaultValue,
		currency,
		locale,
		validationMode,
		placeholder,
		maskPlaceholder,
		invalid,
		withoutMask,
		disabled,
		readonly,
		required,
		class: className,
		min,
		max,
		inputmode,
		maxlength,
		name = 'masked',
		'aria-label': ariaLabel,
		onValueChange,
		onValidate,
		oninput,
		onkeydown,
		onpaste,
		onfocus,
		onblur,
		value = $bindable(''),
		authoritative = '',
		onDeclinedValue,
		onValueBinding,
		dir,
		label,
		withOuterInputs = false,
		onRef,
		onSubmitted
	}: MaskInputHarnessProps = $props();

	const fieldId = 'mask-input-harness-field';

	let ref = $state<HTMLInputElement | null>(null);

	const fieldProps = $derived({
		id: label ? fieldId : undefined,
		'data-testid': 'mask-input',
		mask,
		currency,
		locale,
		validationMode,
		placeholder,
		maskPlaceholder,
		invalid,
		withoutMask,
		disabled,
		readonly,
		required,
		class: className,
		min,
		max,
		inputMode: inputmode,
		maxlength,
		name,
		'aria-label': ariaLabel,
		onValueChange,
		onValidate,
		oninput,
		onkeydown,
		onpaste,
		onfocus,
		onblur
	});

	function handleSubmit(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
		event.preventDefault();
		const entry = new FormData(event.currentTarget).get(name);
		onSubmitted?.(typeof entry === 'string' ? entry : null);
	}

	$effect(() => {
		onRef?.(ref);
	});

	$effect(() => {
		onValueBinding?.(value);
	});
</script>

{#snippet field()}
	{#if mode === 'controlled'}
		<MaskInput bind:value bind:ref {...fieldProps} />
	{:else if mode === 'function-binding'}
		<MaskInput
			bind:value={() => authoritative, (next) => onDeclinedValue?.(next)}
			bind:ref
			{...fieldProps}
		/>
	{:else if mode === 'child'}
		<MaskInput {defaultValue} {...fieldProps}>
			{#snippet child({ props })}
				<input data-child-slot="mask-input" {...props} />
			{/snippet}
		</MaskInput>
	{:else}
		<MaskInput {defaultValue} bind:ref {...fieldProps} />
	{/if}
{/snippet}

{#snippet labelled()}
	{#if label}
		<label for={fieldId}>{label}</label>
		{@render field()}
	{:else}
		{@render field()}
	{/if}
{/snippet}

{#snippet framed()}
	{#if withOuterInputs}
		<input aria-label="Before the field" data-testid="before" />
		{@render labelled()}
		<input aria-label="After the field" data-testid="after" />
	{:else}
		{@render labelled()}
	{/if}
{/snippet}

{#if mode === 'form'}
	<form onsubmit={handleSubmit} data-testid="form">
		{@render framed()}
		<button type="submit">Submit</button>
	</form>
{:else if dir}
	<div {dir} data-testid="direction-frame">
		{@render framed()}
	</div>
{:else}
	{@render framed()}
{/if}
