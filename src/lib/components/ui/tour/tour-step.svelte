<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	import type { TourAlign, TourBoundary, TourSide, TourTarget } from './tour.svelte.js';

	/** The merged attribute payload handed to the `child` snippet. */
	export type TourStepChildProps = {
		'data-slot': 'tour-step';
		/** The **placed** side, which collision avoidance may have flipped. */
		'data-side': TourSide;
		/** The **placed** alignment, which collision avoidance may have shifted. */
		'data-align': TourAlign;
		role: 'dialog';
		dir: Direction;
		tabindex: number;
		class: string;
	} & Record<string, unknown>;

	export type TourStepProps = Omit<
		WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement>,
		'dir' | 'id'
	> & {
		/**
		 * `id` of the rendered card. Narrower than the DOM attribute (which also accepts `null`),
		 * because the floating layer stores it and uses it to key its layer stack.
		 */
		id?: string;
		/** The element this step spotlights: a CSS selector or an `HTMLElement`. Required. */
		target: TourTarget;
		/**
		 * Preferred side of the target to render the card against. Flipped on collision.
		 * @default "bottom"
		 */
		side?: TourSide;
		/**
		 * Main-axis gap between the card and its target.
		 * @default the root's `sideOffset`
		 */
		sideOffset?: number;
		/**
		 * Preferred alignment against the target. Shifted on collision.
		 * @default "center"
		 */
		align?: TourAlign;
		/**
		 * Cross-axis offset from the `start` or `end` alignment.
		 * @default the root's `alignOffset`
		 */
		alignOffset?: number;
		/**
		 * Elements collision detection measures against. `null` entries are ignored.
		 * @default []
		 */
		collisionBoundary?: TourBoundary | TourBoundary[];
		/**
		 * Virtual padding around the boundary edges used for collision detection.
		 * @default 0
		 */
		collisionPadding?: number | Partial<Record<TourSide, number>>;
		/**
		 * Padding between the arrow and the card's edges, so a rounded corner cannot clip it.
		 * @default 0
		 */
		arrowPadding?: number;
		/**
		 * Whether the card stays fully in view (`"partial"`) or may detach (`"always"`).
		 * @default "partial"
		 */
		sticky?: 'partial' | 'always';
		/**
		 * Whether the card becomes invisible and inert — without unmounting — once its target leaves
		 * view.
		 * @default false
		 */
		hideWhenDetached?: boolean;
		/**
		 * Whether the card flips and shifts away from collisions.
		 * @default true
		 */
		avoidCollisions?: boolean;
		/**
		 * Recorded on the step and never read, exactly as upstream. A tour the visitor must not bypass
		 * uses the root's `dismissible={false}` instead (spec Assumptions).
		 * @default false
		 */
		required?: boolean;
		/**
		 * Render the card even when its `target` resolves to nothing.
		 * @default false
		 */
		forceMount?: boolean;
		/** Called as this step becomes the active one, before `onValueChange`. */
		onStepEnter?: () => void;
		/** Called as this step stops being the active one, before the next step's `onStepEnter`. */
		onStepLeave?: () => void;
		/**
		 * Render the card onto your own element instead of the default `<div>`. The snippet receives
		 * the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild` (Radix `Slot`), which has no Svelte equivalent. In `child`
		 * mode `children` is not rendered and `ref` stays `null` — the caller owns the element, and
		 * with it the shared `stepFooter` fallback.
		 */
		child?: Snippet<[{ props: TourStepChildProps }]>;
	};

	/** Upstream's class list (tour.tsx:1243-1246), minus the `fixed`/`z-50` the floating layer owns. */
	const STEP_CLASSES =
		'flex w-80 flex-col gap-4 rounded-lg border bg-popover p-4 text-popover-foreground shadow-md outline-none';
</script>

<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { untrack } from 'svelte';

	import TourDefaultFooter from './tour-default-footer.svelte';
	import {
		computeSpotlight,
		getTourContext,
		resolveTarget,
		setTourStepContext,
		TOUR_EVENT_OPTIONS,
		TOUR_INTERACT_OUTSIDE,
		TOUR_OPEN_AUTO_FOCUS,
		TOUR_POINTER_DOWN_OUTSIDE,
		TourStepState,
		type TourInteractOutsideEvent,
		type TourOpenAutoFocusEvent,
		type TourPointerDownOutsideEvent,
		type TourStepData
	} from './tour.svelte.js';

	let {
		ref = $bindable(null),
		target,
		side = 'bottom',
		sideOffset,
		align = 'center',
		alignOffset,
		collisionBoundary = [],
		collisionPadding = 0,
		arrowPadding = 0,
		sticky = 'partial',
		hideWhenDetached = false,
		avoidCollisions = true,
		required = false,
		forceMount = false,
		onStepEnter,
		onStepLeave,
		class: className,
		children,
		child: childSnippet,
		...restProps
	}: TourStepProps = $props();

	const root = getTourContext('<Tour.Step>');
	const stepState = setTourStepContext(new TourStepState());

	// Upstream's `sideOffset ?? context.sideOffset` (tour.tsx:896-897) — the root supplies the
	// default gap and a step's own value wins (**FR-009**).
	const resolvedSideOffset = $derived(sideOffset ?? root.sideOffset);
	const resolvedAlignOffset = $derived(alignOffset ?? root.alignOffset);

	/** Assigned by the registration effect below; `null` until this step has an index. */
	let stepId = $state<string | null>(null);

	const stepData = $derived<TourStepData>({
		target,
		side,
		sideOffset: resolvedSideOffset,
		align,
		alignOffset: resolvedAlignOffset,
		collisionBoundary,
		collisionPadding,
		arrowPadding,
		sticky,
		hideWhenDetached,
		avoidCollisions,
		required,
		onStepEnter,
		onStepLeave
	});

	/**
	 * Upstream's registration layout effect (tour.tsx:899-937). The registry mutation runs
	 * `untrack`ed so this effect depends on the step's *props* only: `stepId` is written here and
	 * read by `isCurrentStep`, and the registry's version counter is read by every sibling — tracking
	 * either would make the effect a dependent of its own write (research R-09).
	 */
	$effect(() => {
		const data = stepData;

		untrack(() => {
			if (stepId === null) stepId = root.registerStep(data);
			else root.updateStep(stepId, data);
		});
	});

	// Removal is its own mount-scoped effect, so a prop change updates the record in place instead of
	// unregistering and re-appending the step at the end of the list.
	$effect(() => {
		return () => {
			const id = untrack(() => stepId);
			if (id === null) return;

			root.unregisterStep(id);
			stepId = null;
		};
	});

	const isCurrentStep = $derived(stepId !== null && root.stepIndexOf(stepId) === root.value);

	/**
	 * Resolved lazily rather than stored on the step record, so a target that mounts later — the
	 * upstream controlled demo reveals its fourth one at step 3 — is picked up when this step becomes
	 * current (**FR-007**, **FR-019**).
	 */
	let targetElement = $state<HTMLElement | null>(null);

	$effect(() => {
		const candidate = target;
		// Re-resolve whenever the tour opens or navigates: both may reveal or remove the element.
		void root.open;
		const current = isCurrentStep;

		function sync() {
			const next = resolveTarget(candidate);
			// Read untracked: this effect writes `targetElement`, and tracking it would make the
			// effect a dependent of its own write.
			if (next !== untrack(() => targetElement)) targetElement = next;
		}

		sync();
		if (!current || typeof MutationObserver === 'undefined') return;

		// Upstream re-resolves the target on every React render (tour.tsx:940), which also picks up a
		// target that mounts, or disappears, while its step is already active (spec Edge Cases). The
		// observer is the Svelte analogue, and is scoped to the one step that is actually showing.
		const observer = new MutationObserver(sync);
		observer.observe(document.body, { childList: true, subtree: true });

		return () => observer.disconnect();
	});

	/** Upstream's render guard (tour.tsx:1224-1226). */
	const isPresent = $derived(root.open && isCurrentStep && (targetElement !== null || forceMount));

	/**
	 * Upstream's mask effect (tour.tsx:1038-1070): recompute the cut-out immediately, on every
	 * `resize`, and at most once per animation frame while scrolling. The teardown removes both
	 * listeners and cancels any frame still queued (**FR-018**).
	 */
	$effect(() => {
		if (!root.open || !isCurrentStep) return;

		const element = targetElement;
		if (!element) return;

		const padding = root.spotlightPadding;
		let frameId: number | null = null;

		function update() {
			if (!element) return;

			root.setSpotlight(
				computeSpotlight(element.getBoundingClientRect(), padding, {
					width: window.innerWidth,
					height: window.innerHeight
				})
			);
		}

		function onScroll() {
			if (frameId !== null) return;

			frameId = requestAnimationFrame(() => {
				frameId = null;
				update();
			});
		}

		update();
		window.addEventListener('resize', update);
		window.addEventListener('scroll', onScroll, { passive: true });

		return () => {
			window.removeEventListener('resize', update);
			window.removeEventListener('scroll', onScroll);
			if (frameId !== null) cancelAnimationFrame(frameId);
		};
	});

	// Upstream filters `null` boundaries before handing them to the middleware (tour.tsx:960-969).
	const boundary = $derived(
		(Array.isArray(collisionBoundary) ? collisionBoundary : [collisionBoundary]).filter(
			(entry): entry is Element => entry !== null
		)
	);

	/** Whether `node` is inside the spotlighted target — upstream treats that as "inside" (R-08). */
	function isInsideTarget(node: EventTarget | null): boolean {
		return node instanceof Node && targetElement !== null && targetElement.contains(node);
	}

	/**
	 * Upstream's pointer-outside layer (tour.tsx:1080-1105), bridged onto `bits-ui`'s dismissible
	 * layer. Both callbacks fire, in upstream's order; a `preventDefault()` on either custom event is
	 * mapped back onto the `bits-ui` event, which the layer honours before closing (**FR-014**).
	 */
	function handleInteractOutside(event: PointerEvent) {
		// Clicking the highlighted element must never dismiss the tour (research R-08).
		if (isInsideTarget(event.target)) {
			event.preventDefault();
			return;
		}

		const pointerDownOutsideEvent = new CustomEvent(TOUR_POINTER_DOWN_OUTSIDE, {
			...TOUR_EVENT_OPTIONS,
			detail: { originalEvent: event }
		}) as TourPointerDownOutsideEvent;
		root.onPointerDownOutside?.(pointerDownOutsideEvent);

		const interactOutsideEvent = new CustomEvent(TOUR_INTERACT_OUTSIDE, {
			...TOUR_EVENT_OPTIONS,
			detail: { originalEvent: event }
		}) as TourInteractOutsideEvent;
		root.onInteractOutside?.(interactOutsideEvent);

		if (pointerDownOutsideEvent.defaultPrevented || interactOutsideEvent.defaultPrevented) {
			event.preventDefault();
		}
	}

	/**
	 * Upstream's focus-outside layer (tour.tsx:1125-1148), which fires `onInteractOutside` only —
	 * never `onPointerDownOutside`.
	 */
	function handleFocusOutside(event: FocusEvent) {
		if (isInsideTarget(event.target)) {
			event.preventDefault();
			return;
		}

		const interactOutsideEvent = new CustomEvent(TOUR_INTERACT_OUTSIDE, {
			...TOUR_EVENT_OPTIONS,
			detail: { originalEvent: event }
		}) as TourInteractOutsideEvent;
		root.onInteractOutside?.(interactOutsideEvent);

		if (interactOutsideEvent.defaultPrevented) event.preventDefault();
	}

	/** Upstream dispatches this before moving focus into the card (tour.tsx:215-232) — **FR-012**. */
	function handleOpenAutoFocus(event: Event) {
		const openAutoFocusEvent = new CustomEvent(
			TOUR_OPEN_AUTO_FOCUS,
			TOUR_EVENT_OPTIONS
		) as TourOpenAutoFocusEvent;

		root.onOpenAutoFocus?.(openAutoFocusEvent);
		if (openAutoFocusEvent.defaultPrevented) event.preventDefault();
	}

	/**
	 * The per-step focus scope must not restore focus: that would fire on every step transition. The
	 * root owns close-restore, once per tour (**FR-012**).
	 */
	function handleCloseAutoFocus(event: Event) {
		event.preventDefault();
	}
</script>

<PopoverPrimitive.Root
	bind:open={
		() => isPresent,
		(next) => {
			// A layer-initiated close closes the *tour*, so `onSkip` still fires and the popover can
			// never drift out of sync with tour state.
			if (!next) root.close();
		}
	}
>
	<PopoverPrimitive.Content
		data-slot="tour-step"
		role="dialog"
		aria-modal={root.modal ? 'true' : undefined}
		aria-labelledby={stepState.titleId}
		aria-describedby={stepState.descriptionId}
		tabindex={-1}
		{side}
		sideOffset={resolvedSideOffset}
		{align}
		alignOffset={resolvedAlignOffset}
		{avoidCollisions}
		collisionBoundary={boundary}
		{collisionPadding}
		{arrowPadding}
		{sticky}
		{hideWhenDetached}
		strategy="fixed"
		customAnchor={targetElement}
		dir={root.dir}
		preventScroll={false}
		escapeKeydownBehavior="ignore"
		interactOutsideBehavior={root.dismissible ? 'close' : 'ignore'}
		onOpenAutoFocus={handleOpenAutoFocus}
		onCloseAutoFocus={handleCloseAutoFocus}
		onInteractOutside={handleInteractOutside}
		onFocusOutside={handleFocusOutside}
		{...restProps}
		class={cn(STEP_CLASSES, className)}
	>
		{#snippet child({ props, wrapperProps })}
			<!-- `bits-ui` writes `dir` onto the positioned *wrapper*, so the card is given its own
			     copy here — the contract publishes it on `[data-slot="tour-step"]` (contracts §4). -->
			{@const stepAttrs = { ...props, dir: root.dir } as TourStepChildProps}
			<div {...wrapperProps}>
				{#if childSnippet}
					{@render childSnippet({ props: stepAttrs })}
				{:else}
					<div bind:this={ref} {...props} dir={root.dir}>
						{@render children?.()}
						{#if !stepState.hasOwnFooter && root.stepFooter}
							<TourDefaultFooter footer={root.stepFooter} />
						{/if}
					</div>
				{/if}
			</div>
		{/snippet}
	</PopoverPrimitive.Content>
</PopoverPrimitive.Root>
