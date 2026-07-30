<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import type { HTMLAttributes } from 'svelte/elements';

	import type { SegmentPlaceholder } from './time-engine.js';
	import type { TimePickerClickAction } from './time-picker.svelte.js';

	/** The merged attribute payload handed to the `child` snippet. */
	export type TimePickerChildProps = {
		'data-slot': 'time-picker';
		'data-disabled': '' | undefined;
		'data-invalid': '' | undefined;
		'data-readonly': '' | undefined;
		id: string;
		class: string;
		// The symbol slot carries the attachment that hands the rendered element back to the root,
		// which is how the `<form>` detection behind the hidden input keeps working in `child` mode.
	} & Record<string, unknown> &
		Record<symbol, Attachment<HTMLElement>>;

	export type TimePickerRootProps = WithElementRef<
		Omit<HTMLAttributes<HTMLDivElement>, 'dir'>,
		HTMLDivElement
	> & {
		/**
		 * The unique identifier for the time picker. Seeds the input group, label and trigger ids.
		 *
		 * @default $props.id()
		 */
		id?: string;
		/**
		 * The controlled value, always 24-hour — `"HH:mm"`, or `"HH:mm:ss"` when `showSeconds`. An
		 * unset segment serialises as `"--"`, and `""` means nothing is set at all.
		 *
		 * Bindable: `bind:value` lets the component move your state, while the function binding
		 * `bind:value={() => value, (next) => …}` keeps you authoritative — a setter that declines the
		 * write leaves the displayed value exactly where it was.
		 */
		value?: string;
		/**
		 * The default value for uncontrolled usage. Seeded once; `value` wins afterwards.
		 *
		 * @default ""
		 */
		defaultValue?: string;
		/** Callback fired on every actual value change, in both controlled and uncontrolled modes. */
		onValueChange?: (value: string) => void;
		/**
		 * Whether the dropdown is open.
		 *
		 * Bindable, on the same terms as `value`.
		 */
		open?: boolean;
		/**
		 * The default open state for uncontrolled usage.
		 *
		 * @default false
		 */
		defaultOpen?: boolean;
		/** Callback fired whenever the dropdown opens or closes. */
		onOpenChange?: (open: boolean) => void;
		/**
		 * Whether focusing a segment opens the dropdown. Focus stays in the segment when it does.
		 *
		 * @default false
		 */
		openOnFocus?: boolean;
		/**
		 * What a click on empty input-group space does — focus the first segment, or open the dropdown.
		 *
		 * @default "focus"
		 */
		inputGroupClickAction?: TimePickerClickAction;
		/**
		 * The minimum selectable time. Accepted for upstream parity and readable from the context, but
		 * **not enforced** — upstream stores it and never reads it again.
		 */
		min?: string;
		/**
		 * The maximum selectable time. Accepted for upstream parity but **not enforced**, like `min`.
		 */
		max?: string;
		/**
		 * The hour increment, used both by arrow stepping and by the hour column's granularity.
		 *
		 * @default 1
		 */
		hourStep?: number;
		/**
		 * The minute increment, used both by arrow stepping and by the minute column's granularity.
		 *
		 * @default 1
		 */
		minuteStep?: number;
		/**
		 * The second increment, used both by arrow stepping and by the second column's granularity.
		 *
		 * @default 1
		 */
		secondStep?: number;
		/**
		 * The placeholder shown by an unset segment — one string for all four, or one per segment.
		 * Its length also drives the segment's `--time-picker-*-input-width`.
		 *
		 * @default "--"
		 */
		segmentPlaceholder?: SegmentPlaceholder;
		/**
		 * The locale that decides 12-hour versus 24-hour display, resolved through `Intl` rather than
		 * a locale table. The stored value is 24-hour either way.
		 *
		 * @default the runtime locale
		 */
		locale?: string;
		/**
		 * The reading direction. Horizontal arrow keys invert under `"rtl"`, between segments and
		 * between dropdown columns alike.
		 *
		 * @default the nearest `<DirectionProvider>`, else the DOM `[dir]`, else "ltr"
		 */
		dir?: Direction;
		/** The name of the hidden input rendered inside a `<form>`. */
		name?: string;
		/**
		 * Whether the time picker is disabled.
		 *
		 * @default false
		 */
		disabled?: boolean;
		/**
		 * Whether the time picker is read-only. Segments stay focusable but never change.
		 *
		 * @default false
		 */
		readOnly?: boolean;
		/**
		 * Whether the time picker is required. Mirrored onto the hidden input.
		 *
		 * @default false
		 */
		required?: boolean;
		/**
		 * Whether the time picker is in an invalid state.
		 *
		 * @default false
		 */
		invalid?: boolean;
		/**
		 * Whether seconds take part in the value. Drives the serialised arity — `"HH:mm:ss"` rather
		 * than `"HH:mm"` — and whether a blur backfills the second.
		 *
		 * @default false
		 */
		showSeconds?: boolean;
		/** The parts — label, input group, trigger and dropdown content. */
		children?: Snippet;
		/**
		 * Render the picker onto your own element instead of the default `<div>`. The snippet receives
		 * the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild` (Radix `Slot`), which has no Svelte equivalent. In `child`
		 * mode `ref` stays `null`; the props carry an attachment that hands the element back instead,
		 * so spreading them keeps the `<form>` detection behind the hidden input working.
		 */
		child?: Snippet<[{ props: TimePickerChildProps }]>;
	};

	/** Upstream-parity alias of {@link TimePickerRootProps}. */
	export type TimePickerProps = TimePickerRootProps;
</script>

<script lang="ts">
	import { FormControlState } from '$lib/components/ui/checkbox-group/index.js';
	import { useDirection } from '$lib/components/ui/direction-provider/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { untrack } from 'svelte';
	import { createAttachmentKey } from 'svelte/attachments';

	import { setTimePickerContext, TimePickerRootState } from './time-picker.svelte.js';

	let {
		ref = $bindable(null),
		id,
		value = $bindable(),
		defaultValue = '',
		onValueChange,
		open = $bindable(),
		defaultOpen = false,
		onOpenChange,
		openOnFocus = false,
		inputGroupClickAction = 'focus',
		min,
		max,
		hourStep = 1,
		minuteStep = 1,
		secondStep = 1,
		segmentPlaceholder,
		locale,
		dir,
		name,
		disabled = false,
		readOnly = false,
		required = false,
		invalid = false,
		showSeconds = false,
		class: className,
		children,
		child,
		...restProps
	}: TimePickerRootProps = $props();

	// Uncontrolled: seed once from the defaults. Controlled: the caller's binding wins, and a binding
	// that declines the write keeps the rendered state where it was. The seed is a one-shot
	// initialisation, so the defaults are read through `untrack` — reading them bare here would
	// capture only their initial value while looking like a reactive read.
	value ??= untrack(() => defaultValue);
	open ??= untrack(() => defaultOpen);

	const uid = $props.id();

	/**
	 * The element the picker actually rendered onto. `ref` only ever points at the internal `<div>`,
	 * so in `child` mode the attachment below is the only thing that can tell {@link FormControlState}
	 * which element to walk up from.
	 */
	let mountedElement = $state<HTMLElement | null>(null);
	const attach = createAttachmentKey();

	function captureElement(element: HTMLElement) {
		mountedElement = element;
		return () => {
			if (mountedElement === element) mountedElement = null;
		};
	}

	const direction = useDirection({ dir: () => dir, element: () => ref ?? mountedElement });

	const root = setTimePickerContext(
		new TimePickerRootState({
			// The id is fixed for the instance's lifetime — it seeds three stable ids other parts point
			// their `aria-*` at — so it is read once, through `untrack`.
			id: untrack(() => id) ?? uid,
			getValue: () => value ?? '',
			setValue: (next) => {
				value = next;
				onValueChange?.(next);
			},
			getOpen: () => open ?? false,
			setOpen: (next) => {
				open = next;
				onOpenChange?.(next);
			},
			getDir: () => direction.current,
			getLocale: () => locale,
			getSegmentPlaceholder: () => segmentPlaceholder,
			getHourStep: () => hourStep,
			getMinuteStep: () => minuteStep,
			getSecondStep: () => secondStep,
			getShowSeconds: () => showSeconds,
			getDisabled: () => disabled,
			getReadOnly: () => readOnly,
			getRequired: () => required,
			getInvalid: () => invalid,
			getOpenOnFocus: () => openOnFocus,
			getInputGroupClickAction: () => inputGroupClickAction,
			getMin: () => min,
			getMax: () => max,
			getName: () => name
		})
	);

	const formControl = new FormControlState({ getElement: () => ref ?? mountedElement });

	let formInput = $state<HTMLInputElement | null>(null);

	/**
	 * The last value handed to the form. Deliberately not reactive: Svelte has already written the
	 * `value` attribute by the time the effect runs, so the element itself cannot say whether the
	 * value moved, and a form library listening on the form needs the native event upstream's
	 * `VisuallyHiddenInput` dispatches through the native setter (research R-10).
	 */
	let dispatchedValue = untrack(() => root.value);

	$effect(() => {
		const element = formInput;
		const next = root.value;
		if (!element || next === dispatchedValue) return;

		dispatchedValue = next;
		element.value = next;
		element.dispatchEvent(new Event('input', { bubbles: true }));
	});

	const rootAttrs = $derived({
		'data-slot': 'time-picker',
		'data-disabled': disabled ? '' : undefined,
		'data-invalid': invalid ? '' : undefined,
		'data-readonly': readOnly ? '' : undefined,
		id: root.id,
		...restProps,
		[attach]: captureElement,
		class: cn('relative', className)
	} as TimePickerChildProps);
</script>

<Popover.Root bind:open={() => root.open, (next) => root.setOpen(next)}>
	{#if child}
		{@render child({ props: rootAttrs })}
	{:else}
		<div bind:this={ref} {...rootAttrs}>
			{@render children?.()}
		</div>
	{/if}
</Popover.Root>

{#if formControl.isFormControl}
	<input
		bind:this={formInput}
		type="hidden"
		data-slot="time-picker-form-input"
		tabindex={-1}
		{name}
		value={root.value}
		{disabled}
		{required}
		readonly={readOnly}
	/>
{/if}
