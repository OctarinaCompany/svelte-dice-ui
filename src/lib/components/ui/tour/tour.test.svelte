<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	import type {
		TourAlign,
		TourBoundary,
		TourCloseAutoFocusEvent,
		TourInteractOutsideEvent,
		TourOpenAutoFocusEvent,
		TourPointerDownOutsideEvent,
		TourScrollBehavior,
		TourScrollOffset,
		TourSide,
		TourStepData
	} from './tour.svelte.js';

	/**
	 * Which single path this render exercises: the composed tree, a parent-authoritative tree whose
	 * bindings decline every write, or one part rendered without the provider it requires (guard
	 * rail) — either with no provider at all, or inside a `<Tour.Root>` but outside any
	 * `<Tour.Step>`.
	 *
	 * A `.ts` spec cannot express `{#snippet child({ props })}`, `bind:ref`, parent-owned controlled
	 * state or a part without its provider, so everything needing a real parent component goes
	 * through this file. It is not collected by Vitest (`include` is `.{js,ts}`) and is not listed in
	 * `registry.json`.
	 */
	export type TourHarnessMode = 'default' | 'controlled' | 'bare-part' | 'stepless-part';

	/** Which part `bare-part` and `stepless-part` mode render outside their provider. */
	export type TourHarnessPart =
		| 'Portal'
		| 'Spotlight'
		| 'SpotlightRing'
		| 'Step'
		| 'Arrow'
		| 'Header'
		| 'Title'
		| 'Description'
		| 'Close'
		| 'Footer'
		| 'StepCounter'
		| 'Prev'
		| 'Next'
		| 'Skip';

	/** Which part is rendered through its `child` snippet in this run (**FR-025**). */
	export type TourHarnessChildPart =
		| 'root'
		| 'spotlight'
		| 'spotlight-ring'
		| 'step'
		| 'arrow'
		| 'header'
		| 'title'
		| 'description'
		| 'close'
		| 'footer'
		| 'step-counter'
		| 'prev'
		| 'next'
		| 'skip';

	/** Every `bind:ref` the harness captures, so a `.ts` spec can assert on them. */
	export type TourHarnessRefs = {
		root: HTMLDivElement | null;
		step: HTMLDivElement | null;
		spotlight: HTMLDivElement | null;
		ring: HTMLDivElement | null;
	};

	/**
	 * Imperative handle published during initialisation. It exists so a spec can change parent-owned
	 * state *without* `rerender()`, which invalidates props and would wipe the root's uncontrolled
	 * internal state (memory: "non-bound `$bindable` props reset on props invalidation").
	 */
	export type TourHarnessApi = {
		/** Move the harness-owned `open`. Meaningful with `boundOpen` or `controlled`. */
		setOpen: (open: boolean) => void;
		/** Move the harness-owned `value`. Meaningful with `controlled`. */
		setValue: (value: number) => void;
		/** Replace the rendered target ids, so targets mount and unmount after first paint. */
		setTargets: (ids: string[]) => void;
		/** Change how many `<Tour.Step>`s are rendered, so a step unmounts mid-tour. */
		setStepCount: (count: number) => void;
		/** Read the currently captured refs. */
		getRefs: () => TourHarnessRefs;
		/**
		 * The record a rendered `<Tour.Step>` registered, read back off the root's own registry. It is
		 * the only view a spec has of what a step resolved from the root's defaults and its own props.
		 */
		getStepData: (index: number) => TourStepData | undefined;
	};

	export type TourHarnessProps = {
		mode?: TourHarnessMode;
		/** How many `<Tour.Step>`s to render. `0` exercises the "no steps registered" edge case. */
		stepCount?: number;
		defaultOpen?: boolean;
		defaultValue?: number;
		/**
		 * Drive `open` through a two-way `bind:open`, so the harness's own trigger can open the tour
		 * while `value` stays uncontrolled. `value` is deliberately left alone — passing it at all
		 * would flip the root into controlled mode (research R-04).
		 */
		boundOpen?: boolean;
		initialOpen?: boolean;
		initialValue?: number;
		onOpenChange?: (open: boolean) => void;
		onValueChange?: (value: number) => void;
		onComplete?: () => void;
		onSkip?: () => void;
		onEscapeKeyDown?: (event: KeyboardEvent) => void;
		onPointerDownOutside?: (event: TourPointerDownOutsideEvent) => void;
		onInteractOutside?: (event: TourInteractOutsideEvent) => void;
		onOpenAutoFocus?: (event: TourOpenAutoFocusEvent) => void;
		onCloseAutoFocus?: (event: TourCloseAutoFocusEvent) => void;
		/** Receives every write the authoritative parent refuses to apply in `controlled` mode. */
		onDeclinedOpen?: (open: boolean) => void;
		onDeclinedValue?: (value: number) => void;
		/** Called with the index of the step being entered / left (**FR-023**). */
		onStepEnter?: (index: number) => void;
		onStepLeave?: (index: number) => void;
		dir?: Direction;
		dismissible?: boolean;
		modal?: boolean;
		sideOffset?: number;
		alignOffset?: number;
		spotlightPadding?: number;
		autoScroll?: boolean;
		scrollBehavior?: TourScrollBehavior;
		scrollOffset?: TourScrollOffset;
		/** Wrap the floating content in `<Tour.Portal>`. The upstream controlled demo omits it. */
		withPortal?: boolean;
		/** Where `<Tour.Portal>` renders. */
		portalContainer?: HTMLElement | null;
		/** Supply the root's shared `stepFooter` snippet (**FR-022**). */
		withSharedFooter?: boolean;
		/** Give step 0 a `<Tour.Footer>` of its own, which must suppress the shared one. */
		ownFooter?: boolean;
		/** Include a `<Tour.Skip>` in the footer. */
		withSkip?: boolean;
		/** Include a `<Tour.Arrow>` in every step. */
		withArrow?: boolean;
		/** Arrow dimensions, so a spec can check the documented defaults are overridable. */
		arrowWidth?: number;
		arrowHeight?: number;
		spotlightForceMount?: boolean;
		ringForceMount?: boolean;
		/** Applied to step index 1 only, so a spec can compare it against the root's default. */
		stepSideOffset?: number;
		stepAlignOffset?: number;
		/** Also step index 1 only. `alignOffset` moves nothing while the card stays centred. */
		stepAlign?: TourAlign;
		stepCollisionBoundary?: TourBoundary | TourBoundary[];
		stepCollisionPadding?: number | Partial<Record<TourSide, number>>;
		stepArrowPadding?: number;
		stepSticky?: 'partial' | 'always';
		stepAvoidCollisions?: boolean;
		stepRequired?: boolean;
		/** Applied to step index 0, the one the tour opens on. */
		stepHideWhenDetached?: boolean;
		stepForceMount?: boolean;
		/** Point step 0 at a selector that matches nothing (**FR-019**). */
		missingTarget?: boolean;
		/** Point step 0 at the resolved `HTMLElement` rather than at a selector (**FR-007**). */
		elementTarget?: boolean;
		counterFormat?: (current: number, total: number) => string;
		titleId?: string;
		descriptionId?: string;
		ringClass?: string;
		childPart?: TourHarnessChildPart;
		barePart?: TourHarnessPart;
		registerApi?: (api: TourHarnessApi) => void;
	};

	/** Ids of the elements the steps target, in document order. */
	export const TOUR_HARNESS_TARGET_IDS = ['tour-target-0', 'tour-target-1', 'tour-target-2'];
</script>

<script lang="ts">
	import * as Tour from './index.js';
	import type { TourRootState } from './tour.svelte.js';
	import TourProbe from './tour.test-probe.svelte';
	import type { TourRootChildProps } from './tour.svelte';
	import type { TourArrowChildProps } from './tour-arrow.svelte';
	import type { TourCloseChildProps } from './tour-close.svelte';
	import type { TourDescriptionChildProps } from './tour-description.svelte';
	import type { TourFooterChildProps } from './tour-footer.svelte';
	import type { TourHeaderChildProps } from './tour-header.svelte';
	import type { TourNextChildProps } from './tour-next.svelte';
	import type { TourPrevChildProps } from './tour-prev.svelte';
	import type { TourSkipChildProps } from './tour-skip.svelte';
	import type { TourSpotlightChildProps } from './tour-spotlight.svelte';
	import type { TourSpotlightRingChildProps } from './tour-spotlight-ring.svelte';
	import type { TourStepChildProps } from './tour-step.svelte';
	import type { TourStepCounterChildProps } from './tour-step-counter.svelte';
	import type { TourTitleChildProps } from './tour-title.svelte';

	let {
		mode = 'default',
		stepCount = 3,
		defaultOpen,
		defaultValue,
		boundOpen = false,
		initialOpen = false,
		initialValue = 0,
		onOpenChange,
		onValueChange,
		onComplete,
		onSkip,
		onEscapeKeyDown,
		onPointerDownOutside,
		onInteractOutside,
		onOpenAutoFocus,
		onCloseAutoFocus,
		onDeclinedOpen,
		onDeclinedValue,
		onStepEnter,
		onStepLeave,
		dir,
		dismissible,
		modal,
		sideOffset,
		alignOffset,
		spotlightPadding,
		autoScroll,
		scrollBehavior,
		scrollOffset,
		withPortal = true,
		portalContainer,
		withSharedFooter = true,
		ownFooter = false,
		withSkip = false,
		withArrow = false,
		arrowWidth,
		arrowHeight,
		spotlightForceMount = false,
		ringForceMount = false,
		stepSideOffset,
		stepAlignOffset,
		stepAlign,
		stepCollisionBoundary,
		stepCollisionPadding,
		stepArrowPadding,
		stepSticky,
		stepAvoidCollisions,
		stepRequired,
		stepHideWhenDetached = false,
		stepForceMount = false,
		missingTarget = false,
		elementTarget = false,
		counterFormat,
		titleId,
		descriptionId,
		ringClass,
		childPart,
		barePart = 'Step',
		registerApi
	}: TourHarnessProps = $props();

	let rootRef = $state<HTMLDivElement | null>(null);
	let stepRef = $state<HTMLDivElement | null>(null);
	let spotlightRef = $state<HTMLDivElement | null>(null);
	let ringRef = $state<HTMLDivElement | null>(null);

	let firstTargetRef = $state<HTMLDivElement | null>(null);

	let targetIds = $state<string[]>([...TOUR_HARNESS_TARGET_IDS]);
	let openState = $state(initialOpen);
	let valueState = $state(initialValue);
	let renderedSteps = $state<number | null>(null);

	// A plain `let`, not `$state`: it is written once during the probe's initialisation and only ever
	// read from the imperative API, long after the tree has settled.
	let rootState: TourRootState | null = null;

	const indices = $derived(Array.from({ length: renderedSteps ?? stepCount }, (_, index) => index));

	registerApi?.({
		setOpen: (next: boolean) => {
			openState = next;
		},
		setValue: (next: number) => {
			valueState = next;
		},
		setTargets: (next: string[]) => {
			targetIds = next;
		},
		setStepCount: (next: number) => {
			renderedSteps = next;
		},
		getRefs: () => ({ root: rootRef, step: stepRef, spotlight: spotlightRef, ring: ringRef }),
		getStepData: (index: number) => rootState?.stepAt(index)
	});

	function targetFor(index: number): string | HTMLElement {
		if (index === 0) {
			if (missingTarget) return '#tour-target-missing';
			if (elementTarget) return firstTargetRef ?? '#tour-target-0';
		}
		return `#${TOUR_HARNESS_TARGET_IDS[index] ?? `tour-target-${index}`}`;
	}
</script>

<!-- ── `child` snippets, one per part (FR-025) ─────────────────────────────────────────────── -->

{#snippet rootChild({ props }: { props: TourRootChildProps })}
	<section {...props as Record<string, unknown>} data-testid="root-child">
		{@render tourBody()}
	</section>
{/snippet}

{#snippet spotlightChild({ props }: { props: TourSpotlightChildProps })}
	<aside {...props as Record<string, unknown>} data-testid="spotlight-child"></aside>
{/snippet}

{#snippet ringChild({ props }: { props: TourSpotlightRingChildProps })}
	<aside {...props as Record<string, unknown>} data-testid="ring-child"></aside>
{/snippet}

{#snippet arrowChild({ props }: { props: TourArrowChildProps })}
	<i {...props as Record<string, unknown>} data-testid="arrow-child"></i>
{/snippet}

{#snippet headerChild({ props }: { props: TourHeaderChildProps })}
	<header {...props as Record<string, unknown>} data-testid="header-child">Header</header>
{/snippet}

{#snippet titleChild({ props }: { props: TourTitleChildProps })}
	<h2 {...props as Record<string, unknown>} data-testid="title-child">Step 1</h2>
{/snippet}

{#snippet descriptionChild({ props }: { props: TourDescriptionChildProps })}
	<p {...props as Record<string, unknown>} data-testid="description-child">Description 1</p>
{/snippet}

{#snippet closeChild({ props }: { props: TourCloseChildProps })}
	<button {...props as Record<string, unknown>} data-testid="close-child">Dismiss</button>
{/snippet}

{#snippet footerChild({ props }: { props: TourFooterChildProps })}
	<footer {...props as Record<string, unknown>} data-testid="footer-child">
		{@render footerControls()}
	</footer>
{/snippet}

{#snippet counterChild({ props, text }: { props: TourStepCounterChildProps; text: string })}
	<output {...props as Record<string, unknown>} data-testid="counter-child">{text}</output>
{/snippet}

{#snippet prevChild({ props }: { props: TourPrevChildProps })}
	<button {...props as Record<string, unknown>} data-testid="prev-child">Back</button>
{/snippet}

{#snippet nextChild({ props, isLastStep }: { props: TourNextChildProps; isLastStep: boolean })}
	<button {...props as Record<string, unknown>} data-testid="next-child">
		{isLastStep ? 'Done' : 'Forward'}
	</button>
{/snippet}

{#snippet skipChild({ props }: { props: TourSkipChildProps })}
	<button {...props as Record<string, unknown>} data-testid="skip-child">Not now</button>
{/snippet}

<!-- ── Shared pieces ──────────────────────────────────────────────────────────────────────── -->

{#snippet footerControls()}
	<Tour.StepCounter
		format={counterFormat}
		child={childPart === 'step-counter' ? counterChild : undefined}
	/>
	<Tour.Prev child={childPart === 'prev' ? prevChild : undefined} />
	<Tour.Next child={childPart === 'next' ? nextChild : undefined} />
	{#if withSkip}
		<Tour.Skip child={childPart === 'skip' ? skipChild : undefined} />
	{/if}
{/snippet}

{#snippet sharedFooter()}
	<Tour.Footer child={childPart === 'footer' ? footerChild : undefined}>
		{@render footerControls()}
	</Tour.Footer>
{/snippet}

{#snippet stepChildren(index: number)}
	{#if withArrow}
		<Tour.Arrow
			width={arrowWidth}
			height={arrowHeight}
			child={childPart === 'arrow' ? arrowChild : undefined}
		/>
	{/if}
	<Tour.Close child={childPart === 'close' ? closeChild : undefined} />
	<Tour.Header child={childPart === 'header' ? headerChild : undefined}>
		<Tour.Title id={titleId} child={childPart === 'title' ? titleChild : undefined}>
			Step {index + 1}
		</Tour.Title>
		<Tour.Description
			id={descriptionId}
			child={childPart === 'description' ? descriptionChild : undefined}
		>
			Description {index + 1}
		</Tour.Description>
	</Tour.Header>
	{#if ownFooter && index === 0}
		<Tour.Footer data-testid="own-footer">
			{@render footerControls()}
		</Tour.Footer>
	{/if}
{/snippet}

{#snippet floatingContent()}
	<Tour.Spotlight
		bind:ref={spotlightRef}
		forceMount={spotlightForceMount}
		child={childPart === 'spotlight' ? spotlightChild : undefined}
	/>
	<Tour.SpotlightRing
		bind:ref={ringRef}
		forceMount={ringForceMount}
		class={ringClass}
		child={childPart === 'spotlight-ring' ? ringChild : undefined}
	/>
	{#each indices as index (index)}
		{#if index === 0}
			<Tour.Step
				bind:ref={stepRef}
				target={targetFor(index)}
				hideWhenDetached={stepHideWhenDetached}
				forceMount={stepForceMount}
				onStepEnter={() => onStepEnter?.(index)}
				onStepLeave={() => onStepLeave?.(index)}
				child={childPart === 'step' ? stepChild : undefined}
			>
				{@render stepChildren(index)}
			</Tour.Step>
		{:else}
			<Tour.Step
				target={targetFor(index)}
				sideOffset={index === 1 ? stepSideOffset : undefined}
				alignOffset={index === 1 ? stepAlignOffset : undefined}
				align={index === 1 ? stepAlign : undefined}
				collisionBoundary={index === 1 ? stepCollisionBoundary : undefined}
				collisionPadding={index === 1 ? stepCollisionPadding : undefined}
				arrowPadding={index === 1 ? stepArrowPadding : undefined}
				sticky={index === 1 ? stepSticky : undefined}
				avoidCollisions={index === 1 ? stepAvoidCollisions : undefined}
				required={index === 1 ? stepRequired : undefined}
				onStepEnter={() => onStepEnter?.(index)}
				onStepLeave={() => onStepLeave?.(index)}
			>
				{@render stepChildren(index)}
			</Tour.Step>
		{/if}
	{/each}
{/snippet}

{#snippet stepChild({ props }: { props: TourStepChildProps })}
	<article {...props as Record<string, unknown>} data-testid="step-child">
		{@render stepChildren(0)}
	</article>
{/snippet}

{#snippet tourBody()}
	<TourProbe publish={(state) => (rootState = state)} />
	{#if withPortal}
		<Tour.Portal container={portalContainer}>
			{@render floatingContent()}
		</Tour.Portal>
	{:else}
		{@render floatingContent()}
	{/if}
{/snippet}

<!-- ── Guard rails (FR-026) ───────────────────────────────────────────────────────────────── -->

{#snippet unprovidedPart()}
	{#if barePart === 'Portal'}
		<Tour.Portal />
	{:else if barePart === 'Spotlight'}
		<Tour.Spotlight />
	{:else if barePart === 'SpotlightRing'}
		<Tour.SpotlightRing />
	{:else if barePart === 'Step'}
		<Tour.Step target="#tour-target-0" />
	{:else if barePart === 'Arrow'}
		<Tour.Arrow />
	{:else if barePart === 'Header'}
		<Tour.Header />
	{:else if barePart === 'Title'}
		<Tour.Title />
	{:else if barePart === 'Description'}
		<Tour.Description />
	{:else if barePart === 'Close'}
		<Tour.Close />
	{:else if barePart === 'Footer'}
		<Tour.Footer />
	{:else if barePart === 'StepCounter'}
		<Tour.StepCounter />
	{:else if barePart === 'Prev'}
		<Tour.Prev />
	{:else if barePart === 'Next'}
		<Tour.Next />
	{:else}
		<Tour.Skip />
	{/if}
{/snippet}

<!-- ── The tree under test ────────────────────────────────────────────────────────────────── -->

{#if mode === 'bare-part'}
	{@render unprovidedPart()}
{:else if mode === 'stepless-part'}
	<Tour.Root>
		{@render unprovidedPart()}
	</Tour.Root>
{:else}
	<button type="button" data-testid="tour-trigger" onclick={() => (openState = true)}>
		Start tour
	</button>
	<button type="button" data-testid="outside-button">Outside</button>

	{#each targetIds as id, index (id)}
		{#if index === 0}
			<div bind:this={firstTargetRef} {id} data-testid={id}>Target {index + 1}</div>
		{:else}
			<div {id} data-testid={id}>Target {index + 1}</div>
		{/if}
	{/each}

	{#if mode === 'controlled'}
		<Tour.Root
			bind:ref={rootRef}
			bind:open={() => openState, (next: boolean) => onDeclinedOpen?.(next)}
			bind:value={() => valueState, (next: number) => onDeclinedValue?.(next)}
			{onOpenChange}
			{onValueChange}
			{onComplete}
			{onSkip}
			{onEscapeKeyDown}
			{onPointerDownOutside}
			{onInteractOutside}
			{onOpenAutoFocus}
			{onCloseAutoFocus}
			{dir}
			{dismissible}
			{modal}
			{sideOffset}
			{alignOffset}
			{spotlightPadding}
			{autoScroll}
			{scrollBehavior}
			{scrollOffset}
			stepFooter={withSharedFooter ? sharedFooter : undefined}
			child={childPart === 'root' ? rootChild : undefined}
		>
			{@render tourBody()}
		</Tour.Root>
	{:else if boundOpen}
		<Tour.Root
			bind:ref={rootRef}
			bind:open={openState}
			{defaultValue}
			{onOpenChange}
			{onValueChange}
			{onComplete}
			{onSkip}
			{onEscapeKeyDown}
			{onPointerDownOutside}
			{onInteractOutside}
			{onOpenAutoFocus}
			{onCloseAutoFocus}
			{dir}
			{dismissible}
			{modal}
			{sideOffset}
			{alignOffset}
			{spotlightPadding}
			{autoScroll}
			{scrollBehavior}
			{scrollOffset}
			stepFooter={withSharedFooter ? sharedFooter : undefined}
			child={childPart === 'root' ? rootChild : undefined}
		>
			{@render tourBody()}
		</Tour.Root>
	{:else}
		<Tour.Root
			bind:ref={rootRef}
			{defaultOpen}
			{defaultValue}
			{onOpenChange}
			{onValueChange}
			{onComplete}
			{onSkip}
			{onEscapeKeyDown}
			{onPointerDownOutside}
			{onInteractOutside}
			{onOpenAutoFocus}
			{onCloseAutoFocus}
			{dir}
			{dismissible}
			{modal}
			{sideOffset}
			{alignOffset}
			{spotlightPadding}
			{autoScroll}
			{scrollBehavior}
			{scrollOffset}
			stepFooter={withSharedFooter ? sharedFooter : undefined}
			child={childPart === 'root' ? rootChild : undefined}
		>
			{@render tourBody()}
		</Tour.Root>
	{/if}
{/if}
