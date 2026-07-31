<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	import type { EditableTriggerMode } from './index.js';

	/**
	 * Which composition this render exercises. A `.ts` spec cannot express `bind:value`,
	 * `bind:editing`, the function binding `bind:value={get, set}`, a `<form>` ancestor, a `child`
	 * snippet, or a part rendered with no provider above it, so everything needing a real component
	 * tree goes through this file. It is not collected by Vitest (`include` is `.{js,ts}`) and is not
	 * listed in `registry.json`.
	 *
	 * Only *structural* variations are modes; everything else (trigger mode, disabled, read-only,
	 * autosize, orientation, …) is a prop on the one default composition, because those variations
	 * differ only in what the root is handed, not in which parts are rendered.
	 */
	export type EditableHarnessMode =
		/** Label + Area(Preview, Input) + Toolbar(Cancel, Submit) — upstream's `renderEditable`. */
		| 'default'
		/** `default` plus an external `<Editable.Trigger>` rendered outside the Area. */
		| 'with-trigger'
		/** `default` wrapped in a `<form>` with a native submit button. */
		| 'with-form'
		/** Trigger / Submit / Cancel rendered through `child` onto `<Button>`. */
		| 'child-buttons'
		/** `default` inside a `<DirectionProvider>`. */
		| 'with-direction-provider'
		/** Each non-root part with no `<Editable.Root>` ancestor at all (FR-018). */
		| 'bare-label'
		| 'bare-area'
		| 'bare-preview'
		| 'bare-input'
		| 'bare-trigger'
		| 'bare-toolbar'
		| 'bare-cancel'
		| 'bare-submit';

	/**
	 * How the harness hands `value` / `editing` to the root.
	 *
	 * - `none` — uncontrolled: only `defaultValue` / `defaultEditing` are passed.
	 * - `prop` — plain `value` / `editing` props with no binding at all: the callbacks report every
	 *   change and a prop the parent actually moves is authoritative.
	 * - `value` — `bind:value`; the parent accepts every value write.
	 * - `editing` — `bind:editing`; the parent accepts every edit-mode write.
	 * - `function` — `bind:value={() => authoritativeValue, (next) => …}`: the parent stays
	 *   authoritative over the *value* and declines the write (spec FR-002, research R-02).
	 * - `function-editing` — the same authoritative getter/setter pair over *edit mode*.
	 */
	export type EditableHarnessBinding =
		'none' | 'prop' | 'value' | 'editing' | 'function' | 'function-editing';

	export type EditableHarnessProps = {
		/** @default 'default' */
		mode?: EditableHarnessMode;
		/** @default 'none' */
		binding?: EditableHarnessBinding;
		// root — value / edit mode
		value?: string;
		editing?: boolean;
		/** The value a declining parent keeps returning in `binding="function"`. */
		authoritativeValue?: string;
		/** The edit state a declining parent keeps returning in `binding="function-editing"`. */
		authoritativeEditing?: boolean;
		/** Receives every value write a declining parent refuses to apply. */
		onDeclinedValue?: (value: string) => void;
		/** Receives every edit-mode write a declining parent refuses to apply. */
		onDeclinedEditing?: (editing: boolean) => void;
		defaultValue?: string;
		defaultEditing?: boolean;
		onValueChange?: (value: string) => void;
		onEditingChange?: (editing: boolean) => void;
		// root — the rest
		onEdit?: () => void;
		onSubmit?: (value: string) => void;
		onCancel?: () => void;
		onEnterKeyDown?: (event: KeyboardEvent) => void;
		onEscapeKeyDown?: (event: KeyboardEvent) => void;
		triggerMode?: EditableTriggerMode;
		autosize?: boolean;
		maxLength?: number;
		placeholder?: string;
		name?: string;
		disabled?: boolean;
		readOnly?: boolean;
		required?: boolean;
		invalid?: boolean;
		dir?: Direction;
		id?: string;
		// parts
		/** `<Editable.Input>`'s own `disabled`, OR-ed with the root's (FR-010). */
		inputDisabled?: boolean;
		/** `<Editable.Input>`'s own `readOnly`, OR-ed with the root's (FR-010). */
		inputReadOnly?: boolean;
		/** `<Editable.Input>`'s own `required`, OR-ed with the root's (FR-010). */
		inputRequired?: boolean;
		/** @default 'Title' */
		label?: string;
		/** @default 'horizontal' */
		orientation?: 'horizontal' | 'vertical';
		/** @default false */
		triggerForceMount?: boolean;
		/**
		 * Render the toolbar (and with it Cancel / Submit). Dropping it is what puts the `outside`
		 * button next in the tab order, so a `Tab` out of the input can be observed committing.
		 * @default true
		 */
		withToolbar?: boolean;
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
	import { Button } from '$lib/components/ui/button/index.js';

	import * as Editable from './index.js';

	let {
		mode = 'default',
		binding = 'none',
		value = $bindable(),
		editing = $bindable(),
		authoritativeValue = '',
		authoritativeEditing = false,
		onDeclinedValue,
		onDeclinedEditing,
		defaultValue,
		defaultEditing,
		onValueChange,
		onEditingChange,
		onEdit,
		onSubmit,
		onCancel,
		onEnterKeyDown,
		onEscapeKeyDown,
		triggerMode,
		autosize,
		maxLength,
		placeholder,
		name,
		disabled,
		readOnly,
		required,
		invalid,
		dir,
		id,
		inputDisabled,
		inputReadOnly,
		inputRequired,
		label = 'Title',
		orientation = 'horizontal',
		triggerForceMount = false,
		withToolbar = true,
		providerDir = 'rtl',
		withOutsideButton = true,
		onFormSubmit
	}: EditableHarnessProps = $props();

	// No `<Editable.Root>` ancestor in these modes — reproduces a consumer using a part outside its
	// provider, which must throw during that part's own initialisation.
	const bareMode = $derived(mode.startsWith('bare-'));

	/** Both `with-trigger` and `child-buttons` render the external trigger. */
	const withTrigger = $derived(mode === 'with-trigger' || mode === 'child-buttons');

	const rootProps = $derived({
		defaultValue,
		defaultEditing,
		onValueChange,
		onEditingChange,
		onEdit,
		onSubmit,
		onCancel,
		onEnterKeyDown,
		onEscapeKeyDown,
		triggerMode,
		autosize,
		maxLength,
		placeholder,
		name,
		disabled,
		readOnly,
		required,
		invalid,
		dir,
		id
	});
</script>

{#snippet triggerChild({ props }: { props: Editable.EditableTriggerChildProps })}
	<Button size="sm" {...props} data-testid="trigger">Edit</Button>
{/snippet}

{#snippet submitChild({ props }: { props: Editable.EditableSubmitChildProps })}
	<Button size="sm" {...props} data-testid="submit">Save</Button>
{/snippet}

{#snippet cancelChild({ props }: { props: Editable.EditableCancelChildProps })}
	<Button variant="outline" size="sm" {...props} data-testid="cancel">Cancel</Button>
{/snippet}

{#snippet body()}
	<Editable.Label data-testid="label">{label}</Editable.Label>
	<Editable.Area data-testid="area">
		<Editable.Preview data-testid="preview" />
		<Editable.Input
			data-testid="input"
			disabled={inputDisabled}
			readOnly={inputReadOnly}
			required={inputRequired}
		/>
	</Editable.Area>
	{#if withTrigger}
		{#if mode === 'child-buttons'}
			<Editable.Trigger forceMount={triggerForceMount} child={triggerChild} />
		{:else}
			<Editable.Trigger forceMount={triggerForceMount} data-testid="trigger">Edit</Editable.Trigger>
		{/if}
	{/if}
	{#if withToolbar}
		<Editable.Toolbar {orientation} data-testid="toolbar">
			{#if mode === 'child-buttons'}
				<Editable.Cancel child={cancelChild} />
				<Editable.Submit child={submitChild} />
			{:else}
				<Editable.Cancel data-testid="cancel">Cancel</Editable.Cancel>
				<Editable.Submit data-testid="submit">Save</Editable.Submit>
			{/if}
		</Editable.Toolbar>
	{/if}
{/snippet}

{#snippet root()}
	{#if binding === 'function'}
		<Editable.Root
			bind:value={() => authoritativeValue, (next) => onDeclinedValue?.(next)}
			bind:editing
			{...rootProps}
			data-testid="root"
		>
			{@render body()}
		</Editable.Root>
	{:else if binding === 'function-editing'}
		<Editable.Root
			bind:value
			bind:editing={() => authoritativeEditing, (next) => onDeclinedEditing?.(next)}
			{...rootProps}
			data-testid="root"
		>
			{@render body()}
		</Editable.Root>
	{:else if binding === 'prop'}
		<Editable.Root {value} {editing} {...rootProps} data-testid="root">
			{@render body()}
		</Editable.Root>
	{:else if binding === 'value'}
		<Editable.Root bind:value {...rootProps} data-testid="root">
			{@render body()}
		</Editable.Root>
	{:else if binding === 'editing'}
		<Editable.Root bind:editing {...rootProps} data-testid="root">
			{@render body()}
		</Editable.Root>
	{:else}
		<Editable.Root {...rootProps} data-testid="root">
			{@render body()}
		</Editable.Root>
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
	{#if mode === 'bare-label'}
		<Editable.Label>Title</Editable.Label>
	{:else if mode === 'bare-area'}
		<Editable.Area />
	{:else if mode === 'bare-preview'}
		<Editable.Preview />
	{:else if mode === 'bare-input'}
		<Editable.Input />
	{:else if mode === 'bare-trigger'}
		<Editable.Trigger forceMount>Edit</Editable.Trigger>
	{:else if mode === 'bare-toolbar'}
		<Editable.Toolbar />
	{:else if mode === 'bare-cancel'}
		<Editable.Cancel>Cancel</Editable.Cancel>
	{:else}
		<Editable.Submit>Save</Editable.Submit>
	{/if}
{:else if mode === 'with-direction-provider'}
	<DirectionProvider dir={providerDir}>
		{@render framed()}
	</DirectionProvider>
{:else}
	{@render framed()}
{/if}
