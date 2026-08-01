<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	/**
	 * Which composition this render exercises. A `.ts` spec cannot express `bind:value`, the function
	 * binding `bind:value={get, set}`, a `<form>` ancestor, the `child` snippet, or a part rendered
	 * with no provider above it, so everything needing a real component tree goes through this file.
	 * It is not collected by Vitest (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type MentionHarnessMode =
		| 'default'
		/** Each non-Root part with no `<Mention.Root>` ancestor at all. */
		| 'bare-label'
		| 'bare-input'
		| 'bare-portal'
		| 'bare-content'
		| 'bare-item'
		/** A `<Mention.Item value="">`, which must throw. */
		| 'empty-item-value';

	/**
	 * How the harness hands `value` to the root.
	 *
	 * - `none` — uncontrolled: only `defaultValue` is passed.
	 * - `value` — `bind:value`, the parent accepts every change.
	 * - `function` — `bind:value={() => authoritative, (next) => …}`, the parent stays authoritative
	 *   and declines the write.
	 */
	export type MentionHarnessBinding = 'none' | 'value' | 'function';

	/** One rendered `<Mention.Item>`. */
	export type MentionHarnessOption = {
		value: string;
		label?: string;
		text: string;
		disabled?: boolean;
	};

	/** The placeholder every query in the spec looks the field up by. */
	export const MENTION_PLACEHOLDER = 'Type @ to mention...';

	/** The default list — the same three values the upstream test file uses. */
	export const MENTION_OPTIONS: readonly MentionHarnessOption[] = [
		{ value: 'kickflip', text: 'Kickflip' },
		{ value: 'heelflip', text: 'Heelflip' },
		{ value: 'fs-540', text: 'FS 540' }
	];

	export type MentionHarnessProps = {
		/** @default 'default' */
		mode?: MentionHarnessMode;
		/** @default 'none' */
		binding?: MentionHarnessBinding;
		// root
		value?: string[];
		/** The value a declining parent keeps returning in `binding="function"` mode. */
		authoritative?: string[];
		/** Receives every write a declining parent refuses to apply. */
		onDeclinedValue?: (value: string[]) => void;
		defaultValue?: string[];
		onValueChange?: (value: string[]) => void;
		open?: boolean;
		defaultOpen?: boolean;
		onOpenChange?: (open: boolean) => void;
		inputValue?: string;
		onInputValueChange?: (value: string) => void;
		trigger?: string;
		dir?: Direction;
		disabled?: boolean;
		onFilter?: (options: string[], term: string) => string[];
		exactMatch?: boolean;
		loop?: boolean;
		modal?: boolean;
		readonly?: boolean;
		required?: boolean;
		name?: string;
		// parts
		/** @default MENTION_OPTIONS */
		options?: readonly MentionHarnessOption[];
		/** @default true */
		withLabel?: boolean;
		/** @default true */
		withPortal?: boolean;
		/** Render the field through the `child` snippet as a `<textarea>`. @default false */
		asTextarea?: boolean;
		// surroundings
		/** Wrap the mention in a `<form>` with a submit button. @default false */
		withForm?: boolean;
		onSubmit?: (event: SubmitEvent) => void;
		/** Wrap the mention in a `<DirectionProvider>` with this direction. */
		providerDir?: Direction;
		/** A focusable element after the root, so `userEvent.tab()` can leave the component. */
		withOutsideButton?: boolean;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import type { MentionInputChildProps } from './index.js';
	import * as Mention from './index.js';

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
		trigger,
		dir,
		disabled,
		onFilter,
		exactMatch,
		loop,
		modal,
		readonly,
		required,
		name,
		options = MENTION_OPTIONS,
		withLabel = true,
		withPortal = true,
		asTextarea = false,
		withForm = false,
		onSubmit,
		providerDir,
		withOutsideButton = true
	}: MentionHarnessProps = $props();

	// No `<Mention.Root>` ancestor in these modes — reproduces a consumer using a part outside its
	// provider, which must throw during that part's own initialisation.
	const bareMode = $derived(mode.startsWith('bare-'));

	const rootProps = $derived({
		defaultValue,
		onValueChange,
		defaultOpen,
		onOpenChange,
		onInputValueChange,
		trigger,
		dir,
		disabled,
		onFilter,
		exactMatch,
		loop,
		modal,
		readonly,
		required,
		name
	});
</script>

{#snippet textareaChild({ props }: { props: MentionInputChildProps })}
	<textarea {...props} rows={3}></textarea>
{/snippet}

{#snippet list()}
	{#each options as item (item.value)}
		<Mention.Item
			value={item.value}
			label={item.label}
			disabled={item.disabled}
			data-testid={`item-${item.value}`}
		>
			{item.text}
		</Mention.Item>
	{/each}
{/snippet}

{#snippet content()}
	<Mention.Content data-testid="content">
		{@render list()}
	</Mention.Content>
{/snippet}

{#snippet body()}
	{#if withLabel}
		<Mention.Label data-testid="label">Mention users</Mention.Label>
	{/if}
	{#if asTextarea}
		<Mention.Input placeholder={MENTION_PLACEHOLDER} data-testid="input" child={textareaChild} />
	{:else}
		<Mention.Input placeholder={MENTION_PLACEHOLDER} data-testid="input" />
	{/if}
	{#if withPortal}
		<Mention.Portal>
			{@render content()}
		</Mention.Portal>
	{:else}
		{@render content()}
	{/if}
{/snippet}

{#snippet root()}
	{#if binding === 'function'}
		<Mention.Root
			bind:value={() => authoritative, (next) => onDeclinedValue?.(next)}
			bind:open
			bind:inputValue
			{...rootProps}
			data-testid="root"
		>
			{@render body()}
		</Mention.Root>
	{:else}
		<Mention.Root bind:value bind:open bind:inputValue {...rootProps} data-testid="root">
			{@render body()}
		</Mention.Root>
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
	<!--
		What the parent's own state holds right now. A `.ts` spec cannot read a bound prop back off the
		rendered component, so the harness renders it: these are the proof that `bind:` wrote through.
	-->
	<span data-testid="bound-value"
		>{(binding === 'function' ? authoritative : (value ?? [])).join(',')}</span
	>
	<span data-testid="bound-input-value">{inputValue ?? ''}</span>
	<span data-testid="bound-open">{open ? 'open' : 'closed'}</span>
{/snippet}

{#if bareMode}
	{#if mode === 'bare-label'}
		<Mention.Label>Mention users</Mention.Label>
	{:else if mode === 'bare-input'}
		<Mention.Input />
	{:else if mode === 'bare-portal'}
		<Mention.Portal />
	{:else if mode === 'bare-content'}
		<Mention.Content />
	{:else}
		<Mention.Item value="kickflip" />
	{/if}
{:else if mode === 'empty-item-value'}
	<Mention.Root defaultOpen>
		<Mention.Input />
		<Mention.Content>
			<Mention.Item value="">Nothing</Mention.Item>
		</Mention.Content>
	</Mention.Root>
{:else if providerDir}
	<DirectionProvider dir={providerDir}>
		{@render framed()}
	</DirectionProvider>
{:else}
	{@render framed()}
{/if}
