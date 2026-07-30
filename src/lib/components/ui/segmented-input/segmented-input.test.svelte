<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';
	import type { HTMLInputTypeAttribute } from 'svelte/elements';

	import type {
		SegmentedInputItemProps,
		SegmentedInputOrientation,
		SegmentedInputSize,
		SegmentPosition
	} from './index.js';

	/**
	 * Which single composition this render exercises. A `.ts` spec cannot express `bind:value`, the
	 * function binding `bind:value={get, set}`, `bind:ref`, a `child` snippet, a conditionally
	 * rendered item, or a part rendered with no provider above it, so everything needing a real
	 * component tree goes through this file. It is not collected by Vitest (`include` is
	 * `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type SegmentedInputHarnessMode = 'default' | 'bare-item' | 'root-child' | 'item-child';

	/**
	 * How the harness hands each item its `value`.
	 *
	 * - `none` — uncontrolled: the DOM owns the value.
	 * - `value` — `bind:value={values[index]}`, the parent accepts every change.
	 * - `function` — `bind:value={() => authoritative[index], (next) => …}`, the parent stays
	 *   authoritative and may decline the write (quickstart V-38, V-35).
	 */
	export type SegmentedInputHarnessBinding = 'none' | 'value' | 'function';

	export type SegmentedInputHarnessItem = {
		/** Becomes the item's `aria-label`, i.e. its accessible name. */
		label: string;
		placeholder?: string;
		/** Initial value in `binding="none"` mode. */
		value?: string;
		disabled?: boolean;
		required?: boolean;
		readonly?: boolean;
		maxlength?: number;
		/** Explicit position override, which always wins over the derived one (FR-003). */
		position?: SegmentPosition;
		type?: Exclude<HTMLInputTypeAttribute, 'file'>;
		inputmode?: 'numeric' | 'text';
		pattern?: string;
		min?: string;
		max?: string;
		name?: string;
		class?: string;
	};

	/** The three-part composition upstream's `segmented-input-demo.tsx` uses. */
	export const SEGMENTED_INPUT_HARNESS_ITEMS: readonly SegmentedInputHarnessItem[] = [
		{ label: 'First name', placeholder: 'First' },
		{ label: 'Middle name', placeholder: 'Second' },
		{ label: 'Last name', placeholder: 'Third' }
	];

	export type SegmentedInputHarnessProps = {
		/** @default 'default' */
		mode?: SegmentedInputHarnessMode;
		/** @default 'none' */
		binding?: SegmentedInputHarnessBinding;
		// root
		size?: SegmentedInputSize;
		dir?: Direction;
		orientation?: SegmentedInputOrientation;
		disabled?: boolean;
		invalid?: boolean;
		required?: boolean;
		class?: string;
		// items
		items?: readonly SegmentedInputHarnessItem[];
		/** Renders one more item after the configured ones, to prove positions re-derive (V-7). */
		withExtraItem?: boolean;
		/** The values `binding="value"` binds to; also the child → parent leg of the binding. */
		values?: string[];
		/** The value a declining parent keeps returning in `binding="function"` mode. */
		authoritative?: string[];
		/** Receives every write a declining parent refuses to apply. */
		onDeclinedValue?: (index: number, value: string) => void;
		/** Reports what `bind:value` wrote back into this harness. */
		onValuesBinding?: (values: string[]) => void;
		/** Fires for every `input` event an item emits — typed *or* distributed by a paste. */
		onItemInput?: (index: number, value: string) => void;
		/** Makes every item's caller `onkeydown` call `preventDefault()` (V-23). @default false */
		preventKeydown?: boolean;
		/** Makes every item's caller `onpaste` call `preventDefault()` (V-34). @default false */
		preventPaste?: boolean;
		// surroundings
		/** Wrap the group in a `<DirectionProvider>` with this direction. */
		providerDir?: Direction;
		/** Renders a plain `<input>` before and after the group, for `Tab` traversal (V-15). */
		withOuterInputs?: boolean;
		// refs
		onRootRef?: (ref: HTMLDivElement | null) => void;
		onItemRef?: (ref: HTMLInputElement | null) => void;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import * as SegmentedInput from './index.js';

	let {
		mode = 'default',
		binding = 'none',
		size,
		dir,
		orientation,
		disabled,
		invalid,
		required,
		class: className,
		items = SEGMENTED_INPUT_HARNESS_ITEMS,
		withExtraItem = false,
		values = $bindable([]),
		authoritative = [],
		onDeclinedValue,
		onValuesBinding,
		onItemInput,
		preventKeydown = false,
		preventPaste = false,
		providerDir,
		withOuterInputs = false,
		onRootRef,
		onItemRef
	}: SegmentedInputHarnessProps = $props();

	let rootRef = $state<HTMLDivElement | null>(null);
	let firstItemRef = $state<HTMLInputElement | null>(null);

	const renderedItems = $derived(
		withExtraItem ? [...items, { label: 'Fourth field', placeholder: 'Fourth' }] : items
	);

	const rootProps = $derived({ size, dir, orientation, disabled, invalid, required });

	function itemProps(item: SegmentedInputHarnessItem, index: number): SegmentedInputItemProps {
		return {
			'aria-label': item.label,
			'data-testid': `item-${index}`,
			placeholder: item.placeholder,
			disabled: item.disabled,
			required: item.required,
			readonly: item.readonly,
			maxlength: item.maxlength,
			position: item.position,
			type: item.type,
			inputmode: item.inputmode,
			pattern: item.pattern,
			min: item.min,
			max: item.max,
			name: item.name,
			class: item.class,
			oninput: (event) => onItemInput?.(index, event.currentTarget.value),
			onkeydown: (event) => {
				if (preventKeydown) event.preventDefault();
			},
			onpaste: (event) => {
				if (preventPaste) event.preventDefault();
			}
		};
	}

	$effect(() => {
		onRootRef?.(rootRef);
	});

	$effect(() => {
		onItemRef?.(firstItemRef);
	});

	$effect(() => {
		onValuesBinding?.(values);
	});
</script>

{#snippet segment(item: SegmentedInputHarnessItem, index: number)}
	{#if binding === 'function'}
		<SegmentedInput.Item
			bind:value={
				() => authoritative[index] ?? '', (next) => onDeclinedValue?.(index, String(next ?? ''))
			}
			{...itemProps(item, index)}
		/>
	{:else if binding === 'value'}
		<SegmentedInput.Item bind:value={values[index]} {...itemProps(item, index)} />
	{:else if index === 0}
		<SegmentedInput.Item value={item.value} bind:ref={firstItemRef} {...itemProps(item, index)} />
	{:else}
		<SegmentedInput.Item value={item.value} {...itemProps(item, index)} />
	{/if}
{/snippet}

{#snippet segments()}
	{#each renderedItems as item, index (item.label)}
		{#if mode === 'item-child'}
			<SegmentedInput.Item {...itemProps(item, index)}>
				{#snippet child({ props })}
					<input data-child-slot="item" {...props} />
				{/snippet}
			</SegmentedInput.Item>
		{:else}
			{@render segment(item, index)}
		{/if}
	{/each}
{/snippet}

{#snippet group()}
	{#if mode === 'root-child'}
		<SegmentedInput.Root {...rootProps} class={className} data-testid="root">
			{#snippet child({ props })}
				<section data-child-slot="root" {...props}>
					{@render segments()}
				</section>
			{/snippet}
		</SegmentedInput.Root>
	{:else}
		<SegmentedInput.Root bind:ref={rootRef} {...rootProps} class={className} data-testid="root">
			{@render segments()}
		</SegmentedInput.Root>
	{/if}
{/snippet}

{#snippet framed()}
	{#if withOuterInputs}
		<input aria-label="Before the group" data-testid="before" />
		{@render group()}
		<input aria-label="After the group" data-testid="after" />
	{:else}
		{@render group()}
	{/if}
{/snippet}

{#if mode === 'bare-item'}
	<SegmentedInput.Item aria-label="Orphan" />
{:else if providerDir}
	<DirectionProvider dir={providerDir}>
		{@render framed()}
	</DirectionProvider>
{:else}
	{@render framed()}
{/if}
