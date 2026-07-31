<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	import type { KeyValueItemData, KeyValueOrientation } from './index.js';

	/**
	 * Which composition this render exercises. A `.ts` spec cannot express `bind:value`, the function
	 * binding `bind:value={get, set}`, a `<form>` ancestor, the row template snippet, or a part
	 * rendered with no provider above it, so everything needing a real component tree goes through
	 * this file. It is not collected by Vitest (`include` is `.{js,ts}`) and is not listed in
	 * `registry.json`.
	 *
	 * Only *structural* variations are modes; everything else (orientation, disabled, read-only,
	 * `maxItems`, …) is a prop on the one default composition.
	 */
	export type KeyValueHarnessMode =
		/** Root > List > Item(KeyInput, ValueInput, Remove, Error×2) + Add. */
		| 'default'
		/** `default` wrapped in a `<form>` with a native submit button. */
		| 'with-form'
		/** `default` inside a `<DirectionProvider>`. */
		| 'with-direction-provider'
		/** Each part with no provider above it at all (FR-016). */
		| 'bare-list'
		| 'bare-item'
		| 'bare-key-input'
		| 'bare-value-input'
		| 'bare-remove'
		| 'bare-error'
		| 'bare-add';

	/**
	 * How the harness hands `value` to the root.
	 *
	 * - `none` — uncontrolled: only `defaultValue` is passed.
	 * - `prop` — a plain `value` prop with no binding: `onValueChange` reports every change.
	 * - `value` — `bind:value`; the parent accepts every write.
	 * - `function` — `bind:value={() => authoritativeValue, (next) => …}`: the parent stays
	 *   authoritative and declines the write, so the list must not move on its own.
	 */
	export type KeyValueHarnessBinding = 'none' | 'prop' | 'value' | 'function';

	export type KeyValueHarnessProps = {
		/** @default 'default' */
		mode?: KeyValueHarnessMode;
		/** @default 'none' */
		binding?: KeyValueHarnessBinding;
		// root — value
		value?: KeyValueItemData[];
		/** The rows a declining parent keeps returning in `binding="function"`. */
		authoritativeValue?: KeyValueItemData[];
		/** Receives every write a declining parent refuses to apply. */
		onDeclinedValue?: (value: KeyValueItemData[]) => void;
		defaultValue?: KeyValueItemData[];
		onValueChange?: (value: KeyValueItemData[]) => void;
		// root — the rest
		onPaste?: (event: ClipboardEvent, items: KeyValueItemData[]) => void;
		onAdd?: (value: KeyValueItemData) => void;
		onRemove?: (value: KeyValueItemData) => void;
		onKeyValidate?: (key: string, value: KeyValueItemData[]) => string | undefined;
		onValueValidate?: (value: string, key: string, items: KeyValueItemData[]) => string | undefined;
		maxItems?: number;
		minItems?: number;
		keyPlaceholder?: string;
		valuePlaceholder?: string;
		allowDuplicateKeys?: boolean;
		enablePaste?: boolean;
		trim?: boolean;
		stripQuotes?: boolean;
		disabled?: boolean;
		readOnly?: boolean;
		required?: boolean;
		name?: string;
		dir?: Direction;
		id?: string;
		// parts
		/** @default 'vertical' */
		orientation?: KeyValueOrientation;
		/** `<KeyValue.KeyInput>`'s own `disabled`, OR-ed with the root's (FR-010). */
		keyDisabled?: boolean;
		/** `<KeyValue.KeyInput>`'s own `readOnly`, OR-ed with the root's (FR-010). */
		keyReadOnly?: boolean;
		/** `<KeyValue.KeyInput>`'s own `required`, OR-ed with the root's (FR-011). */
		keyRequired?: boolean;
		valueDisabled?: boolean;
		valueReadOnly?: boolean;
		valueRequired?: boolean;
		/** Caller-supplied `placeholder` on the key field, which wins over the root's. */
		keyInputPlaceholder?: string;
		valueInputPlaceholder?: string;
		/** A caller `onpaste` on the key field; `preventDefault()` suppresses the built-in handling. */
		onKeyInputPaste?: (event: ClipboardEvent) => void;
		/** A caller `oninput` on the value field, which must survive `editable`'s own handler. */
		onValueInputInput?: (event: Event) => void;
		/** A caller `onkeydown` on the value field, which must see `Enter` before `editable` does. */
		onValueInputKeydown?: (event: KeyboardEvent) => void;
		/** A caller `onblur` on the value field, which must run before the commit. */
		onValueInputBlur?: (event: FocusEvent) => void;
		maxRows?: number;
		/** Render the two `<KeyValue.Error>` parts. @default true */
		withErrors?: boolean;
		// surroundings
		/** Wrap the root in a `<DirectionProvider>` with this direction. @default 'rtl' */
		providerDir?: Direction;
		/** A focusable element after the root, so `userEvent.tab()` can leave the component. */
		withOutsideButton?: boolean;
		/** Native `submit` handler of the `with-form` composition. */
		onFormSubmit?: (event: SubmitEvent) => void;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import * as KeyValue from './index.js';

	let {
		mode = 'default',
		binding = 'none',
		value = $bindable(),
		authoritativeValue = [],
		onDeclinedValue,
		defaultValue,
		onValueChange,
		onPaste,
		onAdd,
		onRemove,
		onKeyValidate,
		onValueValidate,
		maxItems,
		minItems,
		keyPlaceholder,
		valuePlaceholder,
		allowDuplicateKeys,
		enablePaste,
		trim,
		stripQuotes,
		disabled,
		readOnly,
		required,
		name,
		dir,
		id,
		orientation,
		keyDisabled,
		keyReadOnly,
		keyRequired,
		valueDisabled,
		valueReadOnly,
		valueRequired,
		keyInputPlaceholder,
		valueInputPlaceholder,
		onKeyInputPaste,
		onValueInputInput,
		onValueInputKeydown,
		onValueInputBlur,
		maxRows,
		withErrors = true,
		providerDir = 'rtl',
		withOutsideButton = true,
		onFormSubmit
	}: KeyValueHarnessProps = $props();

	// No `<KeyValue.Root>` / `<KeyValue.List>` ancestor in these modes — reproduces a consumer using
	// a part outside its provider, which must throw during that part's own initialisation.
	const bareMode = $derived(mode.startsWith('bare-'));

	const rootProps = $derived({
		defaultValue,
		onValueChange,
		onPaste,
		onAdd,
		onRemove,
		onKeyValidate,
		onValueValidate,
		maxItems,
		minItems,
		keyPlaceholder,
		valuePlaceholder,
		allowDuplicateKeys,
		enablePaste,
		trim,
		stripQuotes,
		disabled,
		readOnly,
		required,
		name,
		dir,
		id
	});
</script>

{#snippet row()}
	<KeyValue.Item data-testid="item">
		<KeyValue.KeyInput
			data-testid="key-input"
			disabled={keyDisabled}
			readOnly={keyReadOnly}
			required={keyRequired}
			placeholder={keyInputPlaceholder}
			onpaste={onKeyInputPaste}
		/>
		<KeyValue.ValueInput
			data-testid="value-input"
			disabled={valueDisabled}
			readOnly={valueReadOnly}
			required={valueRequired}
			placeholder={valueInputPlaceholder}
			oninput={onValueInputInput}
			onkeydown={onValueInputKeydown}
			onblur={onValueInputBlur}
			{maxRows}
		/>
		<KeyValue.Remove data-testid="remove" />
		{#if withErrors}
			<KeyValue.Error field="key" data-testid="key-error" />
			<KeyValue.Error field="value" data-testid="value-error" />
		{/if}
	</KeyValue.Item>
{/snippet}

{#snippet body()}
	<KeyValue.List {orientation} data-testid="list">
		{@render row()}
	</KeyValue.List>
	<KeyValue.Add data-testid="add" />
{/snippet}

{#snippet root()}
	{#if binding === 'function'}
		<KeyValue.Root
			bind:value={() => authoritativeValue, (next) => onDeclinedValue?.(next)}
			{...rootProps}
			data-testid="root"
		>
			{@render body()}
		</KeyValue.Root>
	{:else if binding === 'prop'}
		<KeyValue.Root {value} {...rootProps} data-testid="root">
			{@render body()}
		</KeyValue.Root>
	{:else if binding === 'value'}
		<KeyValue.Root bind:value {...rootProps} data-testid="root">
			{@render body()}
		</KeyValue.Root>
	{:else}
		<KeyValue.Root {...rootProps} data-testid="root">
			{@render body()}
		</KeyValue.Root>
	{/if}
{/snippet}

{#snippet framed()}
	{#if mode === 'with-form'}
		<form data-testid="form" onsubmit={onFormSubmit}>
			{@render root()}
			<button type="submit" data-testid="form-submit">Submit Form</button>
		</form>
	{:else}
		{@render root()}
	{/if}
	{#if withOutsideButton}
		<button type="button" data-testid="outside">Outside</button>
	{/if}
{/snippet}

{#if bareMode}
	{#if mode === 'bare-list'}
		<KeyValue.List />
	{:else if mode === 'bare-item'}
		<KeyValue.Item />
	{:else if mode === 'bare-key-input'}
		<KeyValue.KeyInput />
	{:else if mode === 'bare-value-input'}
		<KeyValue.ValueInput />
	{:else if mode === 'bare-remove'}
		<KeyValue.Remove />
	{:else if mode === 'bare-error'}
		<KeyValue.Error field="key" />
	{:else}
		<KeyValue.Add />
	{/if}
{:else if mode === 'with-direction-provider'}
	<DirectionProvider dir={providerDir}>
		{@render framed()}
	</DirectionProvider>
{:else}
	{@render framed()}
{/if}
