<script lang="ts" module>
	import { cn } from '$lib/utils.js';
	import type { Popover as PopoverPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';

	/** The merged attribute payload handed to the `child` snippet. */
	export type TimePickerTriggerChildProps = {
		type: 'button';
		'aria-label': string | undefined;
		'data-slot': 'time-picker-trigger';
		'data-disabled': '' | undefined;
		'data-readonly': '' | undefined;
		'data-invalid': '' | undefined;
		id: string;
		disabled: boolean;
		class: string;
	} & Record<string, unknown>;

	export type TimePickerTriggerProps = Omit<
		PopoverPrimitive.TriggerProps,
		'children' | 'child' | 'disabled'
	> & {
		/** Whether the trigger is disabled. OR-ed with the picker's own `disabled`. */
		disabled?: boolean;
		/**
		 * The trigger's content.
		 *
		 * @default `<ClockIcon />`
		 */
		children?: Snippet;
		/**
		 * Render the trigger onto your own element instead of the default `<button>`. The snippet
		 * receives the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild`. In `child` mode `ref` stays `null`.
		 */
		child?: Snippet<[{ props: TimePickerTriggerChildProps }]>;
	};
</script>

<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import ClockIcon from '@lucide/svelte/icons/clock';

	import { getTimePickerContext } from './time-picker.svelte.js';

	let {
		ref = $bindable(null),
		disabled = false,
		'aria-label': ariaLabel,
		class: className,
		children,
		child: childSnippet,
		...restProps
	}: TimePickerTriggerProps = $props();

	const root = getTimePickerContext('<TimePicker.Trigger>');

	const isDisabled = $derived(disabled || root.disabled);

	/**
	 * Upstream ships an icon-only trigger with no accessible name: `@lucide/svelte` stamps
	 * `aria-hidden="true"` on an `<svg>` that gets neither children nor an a11y prop, so the default
	 * button announces as a bare "button" (divergence D-19). The default is destructured rather than
	 * merged from `...restProps` so that a caller passing a *possibly* undefined label falls back
	 * instead of erasing it (the same shape as `time-picker-input.svelte`), and it is skipped whenever
	 * the caller supplies their own content, because that content is the name then.
	 */
	const resolvedLabel = $derived(
		ariaLabel ?? (children || childSnippet ? undefined : 'Open time picker')
	);

	// `data-state`, `aria-expanded` and `aria-controls` all come from the composed `Popover.Trigger`,
	// which is also where `Enter` and `Space` toggling the panel come from (Principle IV).
	const triggerAttrs = $derived({
		type: 'button',
		'aria-label': resolvedLabel,
		'data-slot': 'time-picker-trigger',
		'data-disabled': isDisabled ? '' : undefined,
		'data-readonly': root.readOnly ? '' : undefined,
		'data-invalid': root.invalid ? '' : undefined,
		id: root.triggerId,
		disabled: isDisabled,
		...restProps,
		class: cn(
			"ml-auto flex items-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none [&>svg:not([class*='size-'])]:size-4",
			className
		)
	} as TimePickerTriggerChildProps);
</script>

{#if childSnippet}
	<Popover.Trigger {...triggerAttrs}>
		{#snippet child({ props })}
			{@render childSnippet({
				props: { ...triggerAttrs, ...props } as TimePickerTriggerChildProps
			})}
		{/snippet}
	</Popover.Trigger>
{:else}
	<Popover.Trigger bind:ref {...triggerAttrs}>
		{#if children}{@render children()}{:else}<ClockIcon />{/if}
	</Popover.Trigger>
{/if}
