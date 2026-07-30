<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import type { HTMLAttributes } from 'svelte/elements';

	/** The merged attribute payload handed to the `child` snippet. */
	export type TimePickerInputGroupChildProps = {
		role: 'group';
		'data-slot': 'time-picker-input-group';
		'data-disabled': '' | undefined;
		'data-invalid': '' | undefined;
		'data-readonly': '' | undefined;
		id: string;
		'aria-labelledby': string;
		style: string;
		class: string;
		// The symbol slot carries the attachment that publishes this element as the popover anchor,
		// so a `child`-rendered group still anchors and still bounds the click policy.
	} & Record<string, unknown> &
		Record<symbol, Attachment<HTMLElement>>;

	export type TimePickerInputGroupProps = WithElementRef<
		HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & {
		/** The segment inputs, separators and the trigger. */
		children?: Snippet;
		/**
		 * Render the group onto your own element instead of the default `<div>`. The snippet receives
		 * the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild`. In `child` mode `ref` stays `null`; the props carry an
		 * attachment that publishes the element as the popover anchor instead.
		 */
		child?: Snippet<[{ props: TimePickerInputGroupChildProps }]>;
	};
</script>

<script lang="ts">
	import { createAttachmentKey } from 'svelte/attachments';

	import { getTimePickerContext, setTimePickerInputGroupContext } from './time-picker.svelte.js';

	let {
		ref = $bindable(null),
		style,
		onpointerdown,
		onclick,
		class: className,
		children,
		child,
		...restProps
	}: TimePickerInputGroupProps = $props();

	const root = getTimePickerContext('<TimePicker.InputGroup>');

	const attach = createAttachmentKey();

	function captureElement(element: HTMLElement) {
		root.inputGroupElement = element;
		return () => {
			if (root.inputGroupElement === element) root.inputGroupElement = null;
		};
	}

	setTimePickerInputGroupContext({ getElement: () => root.inputGroupElement });

	/**
	 * The four documented custom properties, from the **normalised** placeholder lengths
	 * (radix/ui/time-picker.tsx:731-739). The period keeps upstream's `max(len, 2) + 0.5` allowance,
	 * which is what stops `AM`/`PM` from clipping against a two-character placeholder.
	 */
	const widthVariables = $derived.by(() => {
		const placeholder = root.segmentPlaceholder;
		return [
			`--time-picker-hour-input-width: ${placeholder.hour.length}ch`,
			`--time-picker-minute-input-width: ${placeholder.minute.length}ch`,
			`--time-picker-second-input-width: ${placeholder.second.length}ch`,
			`--time-picker-period-input-width: ${Math.max(placeholder.period.length, 2) + 0.5}ch`
		].join('; ');
	});

	/** A click landing on a segment input or inside the trigger is the caller's, not the group's. */
	function isOwnTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		if (target.tagName === 'INPUT' || target.closest('input')) return true;
		return target.closest('[data-slot="time-picker-trigger"]') !== null;
	}

	// `...restProps` spread after an attribute overwrites it, so the caller's handlers are composed
	// explicitly instead: theirs runs first, and a `preventDefault()` vetoes ours.
	function handlePointerdown(event: PointerEvent & { currentTarget: HTMLDivElement }) {
		onpointerdown?.(event);
		if (root.disabled || root.readOnly || event.defaultPrevented) return;
		if (isOwnTarget(event.target)) return;

		// Keeps the browser from blurring whichever segment is focused when the user grabs the
		// group's padding (radix/ui/time-picker.tsx:634-651).
		event.preventDefault();
	}

	function handleClick(event: MouseEvent & { currentTarget: HTMLDivElement }) {
		onclick?.(event);
		if (root.disabled || root.readOnly || event.defaultPrevented) return;
		if (isOwnTarget(event.target)) return;

		if (root.inputGroupClickAction === 'open') {
			root.setOpen(true);
			return;
		}

		const active = document.activeElement;
		const alreadyInside =
			active instanceof HTMLInputElement && (root.inputGroupElement?.contains(active) ?? false);
		if (alreadyInside) return;

		root.focusFirstSegment();
	}

	const groupAttrs = $derived({
		role: 'group',
		'data-slot': 'time-picker-input-group',
		'data-disabled': root.disabled ? '' : undefined,
		'data-invalid': root.invalid ? '' : undefined,
		'data-readonly': root.readOnly ? '' : undefined,
		id: root.inputGroupId,
		'aria-labelledby': root.labelId,
		...restProps,
		// The caller's `style` is merged after ours, so a per-group width override wins.
		style: style ? `${widthVariables}; ${style}` : widthVariables,
		onpointerdown: handlePointerdown,
		onclick: handleClick,
		[attach]: captureElement,
		class: cn(
			'flex h-10 w-full cursor-text items-center gap-0.5 rounded-lg border border-input bg-background px-3 py-2 shadow-xs transition-shadow outline-none has-[input:focus]:border-ring has-[input:focus]:ring-3 has-[input:focus]:ring-ring/50',
			root.invalid && 'border-destructive ring-destructive/20',
			root.disabled && 'cursor-not-allowed opacity-50',
			className
		)
	} as TimePickerInputGroupChildProps);
</script>

{#if child}
	{@render child({ props: groupAttrs })}
{:else}
	<div bind:this={ref} {...groupAttrs}>
		{@render children?.()}
	</div>
{/if}
