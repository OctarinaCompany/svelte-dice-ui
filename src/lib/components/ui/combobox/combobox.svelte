<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	import type { ComboboxValue } from './combobox.svelte.js';

	export type ComboboxRootProps<Multiple extends boolean = false> = WithElementRef<
		Omit<HTMLAttributes<HTMLDivElement>, 'dir'>,
		HTMLDivElement
	> & {
		/**
		 * The current value of the combobox — a `string` when single, a `string[]` when `multiple`.
		 *
		 * Bindable: `bind:value` lets the combobox move your state, while the function binding
		 * `bind:value={() => value, (next) => …}` keeps you authoritative — a setter that declines the
		 * write leaves the rendered selection exactly where it was.
		 */
		value?: ComboboxValue<Multiple>;
		/**
		 * The default value of the combobox when uncontrolled. In single mode it also seeds the
		 * input's displayed text.
		 */
		defaultValue?: ComboboxValue<Multiple>;
		/** Event handler called when the value changes. */
		onValueChange?: (value: ComboboxValue<Multiple>) => void;
		/** Whether the combobox popover is open. Bindable, on the same terms as `value`. */
		open?: boolean;
		/**
		 * Whether the combobox is open by default.
		 *
		 * @default false
		 */
		defaultOpen?: boolean;
		/** Event handler called when the open state of the combobox changes. */
		onOpenChange?: (open: boolean) => void;
		/** The current input value of the combobox. Bindable, on the same terms as `value`. */
		inputValue?: string;
		/** Event handler called when the input value changes. */
		onInputValueChange?: (value: string) => void;
		/**
		 * Event handler called when the filter is applied. Replaces the built-in matcher: an item is
		 * kept when the returned array is non-empty.
		 */
		onFilter?: (options: string[], inputValue: string) => string[];
		/**
		 * The reading direction of the combobox.
		 *
		 * @default the nearest `<DirectionProvider>`, else the DOM `[dir]`, else "ltr"
		 */
		dir?: Direction;
		/**
		 * Whether to automatically highlight the first visible item when filtering.
		 *
		 * @default false
		 */
		autoHighlight?: boolean;
		/**
		 * Whether the combobox is disabled.
		 *
		 * @default false
		 */
		disabled?: boolean;
		/**
		 * Whether the combobox uses exact string matching rather than fuzzy matching.
		 *
		 * Ignored when `manualFiltering` is true, and overridden by `onFilter`.
		 *
		 * @default false
		 */
		exactMatch?: boolean;
		/**
		 * Whether the combobox should filter items externally, leaving the rendered list untouched.
		 *
		 * @default false
		 */
		manualFiltering?: boolean;
		/**
		 * Whether highlight movement wraps around at the ends of the list.
		 *
		 * @default false
		 */
		loop?: boolean;
		/**
		 * Whether the combobox is modal — locks page scroll, traps `Tab`, and enables
		 * `PageUp`/`PageDown` navigation.
		 *
		 * @default false
		 */
		modal?: boolean;
		/**
		 * Whether the combobox allows multiple values.
		 *
		 * @default false
		 */
		multiple?: Multiple;
		/**
		 * Whether the combobox opens when the input receives focus.
		 *
		 * @default false
		 */
		openOnFocus?: boolean;
		/**
		 * Whether to preserve the typed text when the input is blurred and nothing is selected.
		 *
		 * @default false
		 */
		preserveInputOnBlur?: boolean;
		/**
		 * Whether the combobox is read-only: the popover still opens and navigates, but no value or
		 * input text changes.
		 *
		 * @default false
		 */
		readOnly?: boolean;
		/**
		 * Whether the combobox is required in a form context.
		 *
		 * @default false
		 */
		required?: boolean;
		/** The name of the combobox for form submission. */
		name?: string;
		/** Unique identifier for the combobox; every part's id derives from it. */
		id?: string;
		/** The content of the combobox. */
		children?: Snippet;
	};

	/** Non-generic convenience alias of {@link ComboboxRootProps}. */
	export type ComboboxProps = ComboboxRootProps<boolean>;
</script>

<script lang="ts" generics="Multiple extends boolean = false">
	import { FormControlState } from '$lib/components/ui/checkbox-group/index.js';
	import { useDirection } from '$lib/components/ui/direction-provider/index.js';
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { untrack } from 'svelte';

	import { ComboboxRootState, setComboboxContext } from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		value = $bindable(),
		defaultValue,
		onValueChange,
		open = $bindable(),
		defaultOpen = false,
		onOpenChange,
		inputValue = $bindable(),
		onInputValueChange,
		onFilter,
		dir,
		autoHighlight = false,
		disabled = false,
		exactMatch = false,
		manualFiltering = false,
		loop = false,
		modal = false,
		multiple = false as Multiple,
		openOnFocus = false,
		preserveInputOnBlur = false,
		readOnly = false,
		required = false,
		name,
		id,
		class: className,
		children,
		...restProps
	}: ComboboxRootProps<Multiple> = $props();

	// Uncontrolled: seed once from `defaultValue`. Controlled: the caller's binding wins, and a
	// binding that declines the write keeps the rendered selection where it was. The seeds are
	// one-shot initialisations, so they are read through `untrack` — reading them bare here would
	// capture only their initial value while looking like a reactive read.
	value ??= untrack(() => defaultValue ?? ((multiple ? [] : '') as ComboboxValue<Multiple>));
	open ??= untrack(() => defaultOpen);
	inputValue ??= untrack(() => {
		const seed = defaultValue;
		return !multiple && seed !== undefined && !Array.isArray(seed) ? String(seed) : '';
	});

	const direction = useDirection({ dir: () => dir, element: () => ref });

	const uid = $props.id();
	const rootId = untrack(() => id) ?? uid;

	/** The value, normalised to the array shape every part and the state class work with. */
	const values = $derived.by<string[]>(() => {
		const current = value;
		if (Array.isArray(current)) return current;
		if (typeof current === 'string') return current === '' ? [] : [current];
		return [];
	});

	function setValues(next: string[]): void {
		const narrowed = (multiple ? next : (next[0] ?? '')) as ComboboxValue<Multiple>;
		value = narrowed;
		onValueChange?.(narrowed);
	}

	const root = setComboboxContext(
		new ComboboxRootState({
			getValues: () => values,
			setValues,
			getOpen: () => open ?? false,
			setOpen: (next) => {
				open = next;
				onOpenChange?.(next);
			},
			getInputValue: () => inputValue ?? '',
			setInputValue: (next) => {
				inputValue = next;
			},
			getOnInputValueChange: () => onInputValueChange,
			getOnFilter: () => onFilter,
			getDefaultValueText: () =>
				!multiple && defaultValue !== undefined && !Array.isArray(defaultValue)
					? String(defaultValue)
					: undefined,
			getAutoHighlight: () => autoHighlight,
			getDisabled: () => disabled,
			getExactMatch: () => exactMatch,
			getManualFiltering: () => manualFiltering,
			getLoop: () => loop,
			getModal: () => modal,
			getMultiple: () => multiple,
			getOpenOnFocus: () => openOnFocus,
			getPreserveInputOnBlur: () => preserveInputOnBlur,
			getReadOnly: () => readOnly,
			getDir: () => direction.current,
			id: rootId
		})
	);

	const formControl = new FormControlState({ getElement: () => ref });

	let formInput = $state<HTMLInputElement | null>(null);

	/** The comma-joined list React produces when upstream hands the value to `VisuallyHiddenInput`. */
	const formValue = $derived(values.join(','));

	/**
	 * The last value handed to the form. Deliberately not reactive: Svelte has already written the
	 * `value` attribute by the time the effect runs, so the element itself cannot say whether the
	 * value moved, and a form library listening on the form needs the native event upstream's
	 * `VisuallyHiddenInput` dispatches through the native setter.
	 */
	let dispatchedValue = untrack(() => formValue);

	$effect(() => {
		const element = formInput;
		const next = formValue;
		if (!element || next === dispatchedValue) return;

		dispatchedValue = next;
		element.value = next;
		element.dispatchEvent(new Event('input', { bubbles: true }));
	});
</script>

<PopoverPrimitive.Root bind:open={() => root.open, (next) => root.setOpen(next)}>
	<div
		bind:this={ref}
		id={rootId}
		data-slot="combobox"
		data-state={root.dataState}
		data-disabled={disabled ? '' : undefined}
		{...restProps}
		class={cn('flex w-full flex-col gap-2', className)}
	>
		{@render children?.()}
	</div>
</PopoverPrimitive.Root>

{#if formControl.isFormControl}
	<!--
		A clipped `type="text"` input rather than upstream's `type="hidden"` (divergence D-7):
		`type="hidden"` is barred from constraint validation, which would make a `required` combobox
		with no selection submit happily. Same pattern as `tags-input` and `checkbox-group-item`.
	-->
	<input
		bind:this={formInput}
		type="text"
		data-slot="combobox-form-input"
		aria-hidden="true"
		tabindex={-1}
		{name}
		value={formValue}
		{disabled}
		{required}
		readonly={readOnly}
		style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; white-space: nowrap; border: 0; clip-path: inset(50%);"
	/>
{/if}
