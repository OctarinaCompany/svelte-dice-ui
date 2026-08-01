<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes, MouseEventHandler, PointerEventHandler } from 'svelte/elements';

	import type { StackSide } from './stack.svelte.js';

	/** The merged attribute payload handed to the `child` snippet. */
	export type StackChildProps = {
		'data-slot': 'stack';
		'data-state': 'expanded' | 'collapsed';
		'data-expanded': 'true' | 'false';
		style: string;
		class: string;
		onmouseenter: MouseEventHandler<HTMLDivElement>;
		onmousemove: MouseEventHandler<HTMLDivElement>;
		onmouseleave: MouseEventHandler<HTMLDivElement>;
		onpointerdown: PointerEventHandler<HTMLDivElement>;
		onpointerup: PointerEventHandler<HTMLDivElement>;
	} & Record<string, unknown>;

	export type StackRootProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		/**
		 * Direction from which items stack.
		 * - "top": Items stack upward from the top
		 * - "bottom": Items stack downward from the bottom
		 * @default "bottom"
		 */
		side?: StackSide;
		/**
		 * Number of items visible in the collapsed state.
		 * @default 3
		 */
		itemCount?: number;
		/**
		 * Number of items visible in the expanded state.
		 * When undefined, all items will be shown when expanded.
		 * @default undefined (all items)
		 */
		expandedItemCount?: number;
		/**
		 * Gap between items when expanded (in pixels).
		 * @default 8
		 */
		gap?: number;
		/**
		 * Scale factor for each subsequent item in collapsed state.
		 * Each item is scaled down by this factor.
		 * @default 0.05 (5% smaller per item)
		 */
		scale?: number;
		/**
		 * Vertical offset between items in collapsed state (in pixels).
		 * @default 10
		 */
		offset?: number;
		/**
		 * Whether to expand the stack on hover.
		 * @default false
		 */
		expandOnHover?: boolean;
		/**
		 * Render the root onto your own element instead of the default `<div>`. The snippet receives
		 * the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild` (Radix `Slot`), which has no Svelte equivalent. In `child`
		 * mode `children` is not rendered — the snippet owns the subtree — and `ref` stays `null`.
		 */
		child?: Snippet<[{ props: StackChildProps }]>;
	};

	/** Upstream-parity alias of {@link StackRootProps}. */
	export type StackProps = StackRootProps;
</script>

<script lang="ts">
	import { setStackContext, StackState } from './stack.svelte.js';

	let {
		ref = $bindable(null),
		side = 'bottom',
		itemCount = 3,
		expandedItemCount,
		gap = 8,
		scale = 0.05,
		offset = 10,
		expandOnHover = false,
		class: className,
		style,
		onmouseenter,
		onmousemove,
		onmouseleave,
		onpointerdown,
		onpointerup,
		children,
		child,
		...restProps
	}: StackRootProps = $props();

	const stack = new StackState({
		getSide: () => side,
		getItemCount: () => itemCount,
		getExpandedItemCount: () => expandedItemCount,
		getGap: () => gap,
		getScale: () => scale,
		getOffset: () => offset,
		getExpandOnHover: () => expandOnHover
	});

	setStackContext(stack);

	// Upstream only listens for `pointerup` on the root, so pressing inside the stack and releasing
	// outside strands `isInteracting` at `true` — and `onMouseLeave` is gated on `!isInteracting`, so
	// the stack can then never collapse again. Listening on the document for as long as the press
	// lasts is additive and changes no documented behaviour (research R-06, divergence D-04).
	$effect(() => {
		if (!stack.interacting) return;

		// A release that happened on the root has already been offered to the caller's `onpointerup`;
		// honouring `defaultPrevented` here keeps that composition contract true whether the pointer
		// came up inside the stack or outside it, instead of the fallback quietly overruling it.
		const onPointerRelease = (event: PointerEvent) => {
			if (event.defaultPrevented) return;
			stack.onPressEnd();
		};
		document.addEventListener('pointerup', onPointerRelease);
		document.addEventListener('pointercancel', onPointerRelease);

		return () => {
			document.removeEventListener('pointerup', onPointerRelease);
			document.removeEventListener('pointercancel', onPointerRelease);
		};
	});

	// Upstream lists its own handlers before `{...rootProps}`, so a caller-supplied handler silently
	// replaces the stack's behaviour. Composing instead — caller first, then the stack's own logic
	// unless the caller called `preventDefault()` — keeps both, and is the resolution this repo
	// already applies elsewhere (research R-07, divergence D-08).
	const handleMouseEnter: MouseEventHandler<HTMLDivElement> = (event) => {
		onmouseenter?.(event);
		if (event.defaultPrevented) return;
		stack.onPointerEnter();
	};

	const handleMouseMove: MouseEventHandler<HTMLDivElement> = (event) => {
		onmousemove?.(event);
		if (event.defaultPrevented) return;
		stack.onPointerMove();
	};

	const handleMouseLeave: MouseEventHandler<HTMLDivElement> = (event) => {
		onmouseleave?.(event);
		if (event.defaultPrevented) return;
		stack.onPointerLeave();
	};

	const handlePointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
		onpointerdown?.(event);
		if (event.defaultPrevented) return;
		stack.onPressStart();
	};

	const handlePointerUp: PointerEventHandler<HTMLDivElement> = (event) => {
		onpointerup?.(event);
		if (event.defaultPrevented) return;
		stack.onPressEnd();
	};

	const rootAttrs = $derived({
		'data-slot': 'stack',
		'data-state': stack.dataState,
		'data-expanded': stack.expanded ? 'true' : 'false',
		...restProps,
		// The caller's declarations come last so they win the cascade, matching upstream's
		// `...style` spread over the three custom properties.
		style: style ? `${stack.styleProps} ${style}` : stack.styleProps,
		class: cn('relative w-full', className),
		onmouseenter: handleMouseEnter,
		onmousemove: handleMouseMove,
		onmouseleave: handleMouseLeave,
		onpointerdown: handlePointerDown,
		onpointerup: handlePointerUp
	} as StackChildProps);
</script>

{#if child}
	{@render child({ props: rootAttrs })}
{:else}
	<div bind:this={ref} {...rootAttrs}>
		{@render children?.()}
	</div>
{/if}
