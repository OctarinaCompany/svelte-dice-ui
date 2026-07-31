<script lang="ts" module>
	import { cn } from '$lib/utils.js';
	import type { Popover } from 'bits-ui';
	import type { Snippet } from 'svelte';

	/** The four sides the popover can be placed on. */
	export type ComboboxSide = 'top' | 'right' | 'bottom' | 'left';
	/** The three alignments the popover can take along its side. */
	export type ComboboxAlign = 'start' | 'center' | 'end';

	export type ComboboxContentProps = Omit<
		Popover.ContentProps,
		| 'child'
		| 'customAnchor'
		| 'onEscapeKeydown'
		| 'onInteractOutside'
		| 'onOpenAutoFocus'
		| 'onCloseAutoFocus'
		| 'preventScroll'
		| 'trapFocus'
		| 'updatePositionStrategy'
	> & {
		/**
		 * The preferred side of the anchor to render against.
		 *
		 * @default "bottom"
		 */
		side?: ComboboxSide;
		/**
		 * The distance in pixels between the anchor and the popover.
		 *
		 * @default 4
		 */
		sideOffset?: number;
		/**
		 * The preferred alignment against the anchor.
		 *
		 * @default "start"
		 */
		align?: ComboboxAlign;
		/**
		 * An offset in pixels from the `start` or `end` alignment.
		 *
		 * @default 0
		 */
		alignOffset?: number;
		/**
		 * The padding between the arrow and the edges of the popover.
		 *
		 * @default 0
		 */
		arrowPadding?: number;
		/**
		 * Padding around the viewport edges used for collision detection.
		 *
		 * @default 0
		 */
		collisionPadding?: number | Partial<Record<ComboboxSide, number>>;
		/**
		 * Whether the popover keeps its side when it would otherwise collide.
		 *
		 * @default "partial"
		 */
		sticky?: 'partial' | 'always';
		/**
		 * The CSS positioning strategy for the popover.
		 *
		 * @default "absolute"
		 */
		strategy?: 'absolute' | 'fixed';
		/**
		 * Whether the popover flips away from collisions.
		 *
		 * @default true
		 */
		avoidCollisions?: boolean;
		/**
		 * Whether the popover is clamped to the space the viewport actually has.
		 *
		 * @default false
		 */
		fitViewport?: boolean;
		/**
		 * Whether the popover hides when its anchor is scrolled out of view.
		 *
		 * @default false
		 */
		hideWhenDetached?: boolean;
		/**
		 * Whether the popover keeps following an anchor that moves.
		 *
		 * @default true
		 */
		trackAnchor?: boolean;
		/**
		 * Whether the popover stays mounted while closed.
		 *
		 * @default false
		 */
		forceMount?: boolean;
		/** Called when `Escape` is pressed. `preventDefault()` keeps the popover open. */
		onEscapeKeyDown?: (event: KeyboardEvent) => void;
		/** Called on a pointer press outside the popover. `preventDefault()` keeps it open. */
		onPointerDownOutside?: (event: PointerEvent) => void;
		/** The list: items, groups, separators, the empty state and the loading state. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';

	import {
		ComboboxContentState,
		getComboboxContext,
		setComboboxContentContext
	} from './combobox.svelte.js';

	let {
		ref = $bindable(null),
		side = 'bottom',
		sideOffset = 4,
		align = 'start',
		alignOffset = 0,
		arrowPadding = 0,
		collisionBoundary,
		collisionPadding = 0,
		sticky = 'partial',
		strategy = 'absolute',
		avoidCollisions = true,
		fitViewport = false,
		hideWhenDetached = false,
		trackAnchor = true,
		forceMount = false,
		onEscapeKeyDown,
		onPointerDownOutside,
		style,
		class: className,
		children,
		...restProps
	}: ComboboxContentProps = $props();

	const root = getComboboxContext('<Combobox.Content>');

	setComboboxContentContext(
		new ComboboxContentState({
			getSide: () => side,
			getAlign: () => align,
			getForceMount: () => forceMount
		})
	);

	/**
	 * Upstream's documented CSS variables, aliased onto the ones `bits-ui` computes (divergence D-5),
	 * plus `fitViewport`'s clamp (divergence D-3) — `bits-ui` does not expose floating-ui's `size`
	 * middleware, and the available-space variables reproduce the same result.
	 */
	const cssVariables = $derived(
		[
			'--dice-transform-origin: var(--bits-popover-content-transform-origin)',
			'--dice-anchor-width: var(--bits-popover-anchor-width)',
			'--dice-anchor-height: var(--bits-popover-anchor-height)',
			'--dice-available-width: var(--bits-popover-content-available-width)',
			'--dice-available-height: var(--bits-popover-content-available-height)',
			...(fitViewport
				? ['max-width: var(--dice-available-width)', 'max-height: var(--dice-available-height)']
				: [])
		].join('; ')
	);

	const composedStyle = $derived(
		typeof style === 'string' && style.length > 0 ? `${cssVariables}; ${style}` : cssVariables
	);

	/**
	 * `bits-ui` consumes `id` and `dir` as component props — they drive the floating, dismissible and
	 * text-selection layers — and re-emits neither onto the content element itself. The APG pattern
	 * needs both there: the input's `aria-controls` has to resolve to this element, and the list has
	 * to carry its own reading direction. Both are written back with the values `bits-ui` was handed,
	 * so its internal bookkeeping and the DOM agree.
	 */
	$effect(() => {
		const element = ref;
		if (!element) return;

		element.id = root.listId;
		element.dir = root.dir;
	});

	function handleEscapeKeydown(event: KeyboardEvent) {
		onEscapeKeyDown?.(event);
	}

	function handleInteractOutside(event: PointerEvent) {
		onPointerDownOutside?.(event);
	}

	/** The APG combobox pattern keeps DOM focus in the input, so the popover never takes it. */
	function preventAutoFocus(event: Event) {
		event.preventDefault();
	}
</script>

<PopoverPrimitive.Content
	bind:ref
	id={root.listId}
	role="listbox"
	data-slot="combobox-content"
	{side}
	{sideOffset}
	{align}
	{alignOffset}
	{arrowPadding}
	{collisionBoundary}
	{collisionPadding}
	{sticky}
	{strategy}
	{avoidCollisions}
	{hideWhenDetached}
	{forceMount}
	updatePositionStrategy={trackAnchor ? 'always' : 'optimized'}
	customAnchor={root.anchorElement ?? root.inputElement}
	dir={root.dir}
	trapFocus={false}
	preventScroll={root.modal}
	onOpenAutoFocus={preventAutoFocus}
	onCloseAutoFocus={preventAutoFocus}
	onEscapeKeydown={handleEscapeKeydown}
	onInteractOutside={handleInteractOutside}
	style={composedStyle}
	{...restProps}
	class={cn(
		'relative max-h-fit min-w-(--dice-anchor-width) origin-(--dice-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
		className
	)}
>
	{@render children?.()}
</PopoverPrimitive.Content>
