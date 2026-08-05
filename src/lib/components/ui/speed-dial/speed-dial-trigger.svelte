<script lang="ts" module>
	import { buttonVariants, type ButtonProps } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	/** The merged attribute payload handed to the `child` snippet. */
	export type SpeedDialTriggerChildProps = {
		type: 'button';
		role: 'button';
		id: string;
		'aria-controls': string;
		'aria-expanded': boolean;
		'aria-haspopup': 'menu';
		'data-slot': 'speed-dial-trigger';
		'data-state': 'open' | 'closed';
		disabled: boolean;
		/** Button variant classes, the round chrome, and the caller's `class` merged last. */
		class: string;
	} & Record<string, unknown>;

	export type SpeedDialTriggerProps = ButtonProps & {
		/**
		 * Render the trigger onto your own element instead of the default `<button>`. The snippet
		 * receives the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild` (Radix `Slot`), which has no Svelte equivalent. In `child` mode
		 * `children` is not rendered and `ref` stays `null` — the caller owns the element.
		 */
		child?: Snippet<[{ props: SpeedDialTriggerChildProps }]>;
	};
</script>

<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';

	import {
		DEFAULT_HOVER_CLOSE_DELAY,
		getDataState,
		getSpeedDialContext
	} from './speed-dial.svelte.js';

	let {
		ref = $bindable(null),
		id,
		variant = 'default',
		size = 'icon',
		disabled: disabledProp,
		onclick: onclickProp,
		onmouseenter: onmouseenterProp,
		onmouseleave: onmouseleaveProp,
		class: className,
		child,
		children,
		...restProps
	}: SpeedDialTriggerProps = $props();

	const state = getSpeedDialContext('<SpeedDial.Trigger>');

	const instanceId = $props.id();
	const triggerId = $derived(id ?? instanceId);

	// Upstream `isDisabled = disabledProp || disabled` (speed-dial.tsx:335).
	const isDisabled = $derived(disabledProp || state.disabled);

	/** Hover-open is the trigger's own; hover-close is shared with the content, so the root owns it. */
	let hoverOpenTimer: ReturnType<typeof setTimeout> | null = null;

	function cancelHoverOpen() {
		if (hoverOpenTimer === null) return;
		clearTimeout(hoverOpenTimer);
		hoverOpenTimer = null;
	}

	$effect(() => {
		state.triggerElement = ref;
		return () => {
			state.triggerElement = null;
		};
	});

	// The trigger is the *first* node of the composite, so `Shift+Tab` on it is what closes the dial
	// (research R-06). `getDisabled` is a getter rather than a snapshot, so toggling `disabled` never
	// needs a re-registration.
	$effect(() => {
		const element = ref;
		if (!element) return;

		const nodeId = triggerId;
		state.nodes.register(nodeId, element, { getDisabled: () => isDisabled });
		return () => state.nodes.unregister(nodeId);
	});

	// Upstream clears both timers on unmount (speed-dial.tsx:355-364).
	$effect(() => () => {
		cancelHoverOpen();
		state.cancelHoverClose();
	});

	// `ButtonProps` handlers are the intersection of the button and anchor DOM signatures, because
	// `Button` renders either element depending on `href`. Widening to their shared `MouseEvent`
	// supertype at the call boundary is what lets one implementation satisfy both call signatures
	// (the `banner-close.svelte` precedent).
	function callMouseHandler(handler: unknown, event: MouseEvent) {
		(handler as ((event: MouseEvent) => void) | undefined)?.(event);
	}

	function onclick(event: MouseEvent) {
		callMouseHandler(onclickProp, event);
		if (event.defaultPrevented) return;

		cancelHoverOpen();
		state.cancelHoverClose();
		state.toggle();
	}

	function onmouseenter(event: MouseEvent) {
		callMouseHandler(onmouseenterProp, event);
		if (event.defaultPrevented || state.activationMode !== 'hover' || isDisabled) return;

		state.cancelHoverClose();
		cancelHoverOpen();
		hoverOpenTimer = setTimeout(() => {
			hoverOpenTimer = null;
			state.setOpen(true);
		}, state.delay);
	}

	function onmouseleave(event: MouseEvent) {
		callMouseHandler(onmouseleaveProp, event);
		if (event.defaultPrevented || state.activationMode !== 'hover' || isDisabled) return;

		cancelHoverOpen();
		state.scheduleHoverClose(DEFAULT_HOVER_CLOSE_DELAY);
	}

	const triggerChildProps = $derived({
		type: 'button',
		role: 'button',
		id: triggerId,
		'aria-controls': state.contentId,
		'aria-expanded': state.open,
		'aria-haspopup': 'menu',
		'data-slot': 'speed-dial-trigger',
		'data-state': getDataState(state.open),
		disabled: isDisabled,
		...restProps,
		class: cn(buttonVariants({ variant, size }), 'size-11 cursor-pointer rounded-full', className),
		onclick,
		onmouseenter,
		onmouseleave
	} as SpeedDialTriggerChildProps);
</script>

{#if child}
	{@render child({ props: triggerChildProps })}
{:else}
	<Button
		bind:ref
		type="button"
		role="button"
		id={triggerId}
		aria-controls={state.contentId}
		aria-expanded={state.open}
		aria-haspopup="menu"
		data-slot="speed-dial-trigger"
		data-state={getDataState(state.open)}
		disabled={isDisabled}
		{variant}
		{size}
		{...restProps}
		class={cn('size-11 cursor-pointer rounded-full', className)}
		{onclick}
		{onmouseenter}
		{onmouseleave}
	>
		{@render children?.()}
	</Button>
{/if}
