<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	import type { TagsInputBlurBehavior } from './index.js';

	/**
	 * Which composition this render exercises. A `.ts` spec cannot express `bind:value`, the function
	 * binding `bind:value={get, set}`, a `<form>` ancestor, a `child` snippet, or a part rendered with
	 * no provider above it, so everything needing a real component tree goes through this file. It is
	 * not collected by Vitest (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 *
	 * Only *structural* variations are modes: everything else the plan calls a "mode" (controlled,
	 * function binding, form, rtl, validation, editable) is a prop on the one default composition —
	 * `binding`, `withForm`, `dir`/`providerDir`, `max`/`onValidate`/`onInvalid`, `editable` — because
	 * those variations differ only in what the root is handed, not in which parts are rendered.
	 */
	export type TagsInputHarnessMode =
		| 'default'
		/** Each non-Root part with no `<TagsInput.Root>` ancestor at all. */
		| 'bare-label'
		| 'bare-input'
		| 'bare-item'
		| 'bare-clear'
		| 'bare-item-text'
		| 'bare-item-delete'
		/** Inside a `<TagsInput.Root>` but with no `<TagsInput.Item>` ancestor. */
		| 'item-text-without-item'
		| 'item-delete-without-item';

	/**
	 * How the harness hands `value` to the root.
	 *
	 * - `none` — uncontrolled: only `defaultValue` is passed; the root seeds and then owns the value,
	 *   writing every change back out through the binding so the harness can render the tags.
	 * - `value` — `bind:value`, the parent accepts every change.
	 * - `function` — `bind:value={() => authoritative, (next) => …}`, the parent stays authoritative
	 *   and declines the write (spec FR-002).
	 */
	export type TagsInputHarnessBinding = 'none' | 'value' | 'function';

	/** The placeholder every query in the spec looks the text input up by. */
	export const TAGS_INPUT_PLACEHOLDER = 'Add trick...';

	export type TagsInputHarnessProps = {
		/** @default 'default' */
		mode?: TagsInputHarnessMode;
		/** @default 'none' */
		binding?: TagsInputHarnessBinding;
		// root
		value?: string[];
		/** The value a declining parent keeps returning in `binding="function"` mode. */
		authoritative?: string[];
		/** Receives every write a declining parent refuses to apply. */
		onDeclinedValue?: (value: string[]) => void;
		defaultValue?: string[];
		onValueChange?: (value: string[]) => void;
		onValidate?: (value: string) => boolean;
		onInvalid?: (value: string) => void;
		displayValue?: (value: string) => string;
		addOnPaste?: boolean;
		addOnTab?: boolean;
		disabled?: boolean;
		editable?: boolean;
		loop?: boolean;
		blurBehavior?: TagsInputBlurBehavior;
		delimiter?: string;
		max?: number;
		required?: boolean;
		readOnly?: boolean;
		name?: string;
		dir?: Direction;
		// parts
		/** @default true */
		withLabel?: boolean;
		/** @default 'Tricks' */
		label?: string;
		/** @default true */
		withClear?: boolean;
		/** @default false */
		clearForceMount?: boolean;
		/** Render `<TagsInput.Clear>` through its `child` snippet onto the caller's own element. */
		clearAsChild?: boolean;
		/** Tag values rendered with a per-item `disabled`. @default [] */
		disabledValues?: readonly string[];
		// surroundings
		/** Wrap the tags input in a `<form>` with a submit button. @default false */
		withForm?: boolean;
		onSubmit?: (event: SubmitEvent) => void;
		/** Wrap the tags input in a `<DirectionProvider>` with this direction. */
		providerDir?: Direction;
		/** A focusable element after the root, so `userEvent.tab()` can leave the component. */
		withOutsideButton?: boolean;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import * as TagsInput from './index.js';

	let {
		mode = 'default',
		binding = 'none',
		value = $bindable(),
		authoritative = [],
		onDeclinedValue,
		defaultValue,
		onValueChange,
		onValidate,
		onInvalid,
		displayValue,
		addOnPaste,
		addOnTab,
		disabled,
		editable,
		loop,
		blurBehavior,
		delimiter,
		max,
		required,
		readOnly,
		name,
		dir,
		withLabel = true,
		label = 'Tricks',
		withClear = true,
		clearForceMount = false,
		clearAsChild = false,
		disabledValues = [],
		withForm = false,
		onSubmit,
		providerDir,
		withOutsideButton = true
	}: TagsInputHarnessProps = $props();

	// No `<TagsInput.Root>` ancestor in these modes — reproduces a consumer using a part outside its
	// provider, which must throw during that part's own initialisation.
	const bareMode = $derived(mode.startsWith('bare-'));

	/** What the `{#each}` below renders. A declining parent never lets this move (spec FR-002). */
	const tags = $derived(binding === 'function' ? authoritative : (value ?? []));

	const rootProps = $derived({
		defaultValue,
		onValueChange,
		onValidate,
		onInvalid,
		displayValue,
		addOnPaste,
		addOnTab,
		disabled,
		editable,
		loop,
		blurBehavior,
		delimiter,
		max,
		required,
		readOnly,
		name,
		dir
	});
</script>

{#snippet clearChild({ props }: { props: TagsInput.TagsInputClearChildProps })}
	<button {...props} data-testid="clear-child">Clear</button>
{/snippet}

{#snippet body()}
	{#if withLabel}
		<TagsInput.Label data-testid="label">{label}</TagsInput.Label>
	{/if}
	<div data-testid="list" class="flex flex-wrap items-center gap-1.5">
		{#each tags as tag (tag)}
			<TagsInput.Item
				value={tag}
				disabled={disabledValues.includes(tag)}
				data-testid={`item-${tag}`}
			>
				<TagsInput.ItemText />
				<TagsInput.ItemDelete aria-label={`Remove ${tag}`} />
			</TagsInput.Item>
		{/each}
		<TagsInput.Input placeholder={TAGS_INPUT_PLACEHOLDER} data-testid="input" />
	</div>
	{#if withClear}
		{#if clearAsChild}
			<TagsInput.Clear forceMount={clearForceMount} aria-label="Clear tags" child={clearChild} />
		{:else}
			<TagsInput.Clear forceMount={clearForceMount} aria-label="Clear tags" data-testid="clear">
				Clear
			</TagsInput.Clear>
		{/if}
	{/if}
{/snippet}

{#snippet root()}
	{#if binding === 'function'}
		<TagsInput.Root
			bind:value={() => authoritative, (next) => onDeclinedValue?.(next)}
			{...rootProps}
			data-testid="root"
		>
			{@render body()}
		</TagsInput.Root>
	{:else}
		<TagsInput.Root bind:value {...rootProps} data-testid="root">
			{@render body()}
		</TagsInput.Root>
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
		<TagsInput.Label>Tricks</TagsInput.Label>
	{:else if mode === 'bare-input'}
		<TagsInput.Input />
	{:else if mode === 'bare-item'}
		<TagsInput.Item value="kickflip" />
	{:else if mode === 'bare-clear'}
		<TagsInput.Clear forceMount />
	{:else if mode === 'bare-item-text'}
		<TagsInput.ItemText />
	{:else}
		<TagsInput.ItemDelete />
	{/if}
{:else if mode === 'item-text-without-item'}
	<TagsInput.Root>
		<TagsInput.ItemText />
	</TagsInput.Root>
{:else if mode === 'item-delete-without-item'}
	<TagsInput.Root>
		<TagsInput.ItemDelete />
	</TagsInput.Root>
{:else if providerDir}
	<DirectionProvider dir={providerDir}>
		{@render framed()}
	</DirectionProvider>
{:else}
	{@render framed()}
{/if}
