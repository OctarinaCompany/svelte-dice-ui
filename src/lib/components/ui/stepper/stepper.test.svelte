<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	import type { StepperChildProps } from './stepper.svelte';
	import type { StepperIndicatorChildProps } from './stepper-indicator.svelte';
	import type { StepperNextChildProps } from './stepper-next.svelte';
	import type { StepperPrevChildProps } from './stepper-prev.svelte';
	import type { StepperTriggerChildProps } from './stepper-trigger.svelte';
	import type {
		StepperActivationMode,
		StepperDataState,
		StepperNavigationDirection,
		StepperOrientation
	} from './stepper.svelte.js';

	/**
	 * Which single path this render exercises: the plain tree, one of the parts rendered through its
	 * `child` snippet, a part rendered with no `<Stepper.Root>` / `<Stepper.Item>` / `<Stepper.List>`
	 * ancestor (guard rail), or a root wrapped in a `<DirectionProvider>`.
	 *
	 * A `.ts` spec cannot express `{#snippet child({ props })}`, `bind:ref`, `bind:value`,
	 * parent-owned controlled state, or a part with no provider ancestor, so everything needing a real
	 * parent component goes through this file. It is not collected by Vitest (`include` is
	 * `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type StepperHarnessMode =
		| 'default'
		| 'root-child'
		| 'trigger-child'
		| 'indicator-child'
		| 'prev-child'
		| 'next-child'
		| 'bare-part'
		| 'rtl-provider';

	/**
	 * Which part `bare-part` mode renders outside its provider.
	 *
	 * `List`, `Item`, `Content`, `Prev` and `Next` render with no root at all; `Trigger`,
	 * `Indicator`, `Separator`, `Title` and `Description` render *inside* a root but outside an item;
	 * `TriggerOutsideList` renders inside a root **and** an item, but outside the list.
	 */
	export type StepperHarnessPart =
		| 'List'
		| 'Item'
		| 'Content'
		| 'Prev'
		| 'Next'
		| 'Trigger'
		| 'Indicator'
		| 'Separator'
		| 'Title'
		| 'Description'
		| 'TriggerOutsideList';

	/** One `<Stepper.Item>` plus the `<Stepper.Content>` that pairs with it. */
	export type StepperHarnessStep = {
		value: string;
		title: string;
		description?: string;
		/** @default false */
		completed?: boolean;
		/** @default false */
		disabled?: boolean;
	};

	/** The three-step composition the upstream test file walks. */
	export const STEPPER_HARNESS_STEPS: readonly StepperHarnessStep[] = [
		{ value: 'step1', title: 'Step 1', description: 'First step' },
		{ value: 'step2', title: 'Step 2', description: 'Second step' },
		{ value: 'step3', title: 'Step 3', description: 'Third step' }
	];

	/**
	 * How the parent wires `value`, mirroring the `action-bar` harness:
	 *
	 * - `none` — uncontrolled: only `defaultValue` is passed, the root owns the state.
	 * - `value` — `bind:value`, the parent accepts every change.
	 * - `function` — `bind:value={() => authoritativeValue, (next) => …}`, the parent stays
	 *   authoritative and declines the write. That is upstream's plain-`value`-prop semantics.
	 */
	export type StepperHarnessBinding = 'none' | 'value' | 'function';

	/**
	 * Every `bind:ref` the harness captures. The `{#each}`-driven parts report their **first**
	 * iteration's element, because one binding shared by every iteration would alias all of them onto
	 * a single element — a `bind:` writes back *down* as well as up.
	 */
	export type StepperHarnessRefs = {
		root: HTMLDivElement | null;
		list: HTMLDivElement | null;
		item: HTMLDivElement | null;
		trigger: HTMLButtonElement | null;
		indicator: HTMLDivElement | null;
		separator: HTMLDivElement | null;
		title: HTMLSpanElement | null;
		description: HTMLSpanElement | null;
		content: HTMLDivElement | null;
		prev: HTMLButtonElement | null;
		next: HTMLButtonElement | null;
	};

	/**
	 * Imperative handle published during initialisation. It exists so a spec can change parent-owned
	 * state (the controlled `value`, the rendered step list) *without* `rerender()`, which invalidates
	 * props and would wipe the root's uncontrolled internal value (research R-02).
	 */
	export type StepperHarnessApi = {
		/** Move the harness-owned controlled `value`. Only meaningful with a `value`/`function` binding. */
		setValue: (value: string) => void;
		/** Replace the rendered steps, so items mount and unmount after first paint. */
		setSteps: (steps: StepperHarnessStep[]) => void;
		/** Flip one step's `completed` flag in place, without remounting the item. */
		setCompleted: (value: string, completed: boolean) => void;
		/** Flip one step's `disabled` flag in place, without remounting the item. */
		setDisabled: (value: string, disabled: boolean) => void;
		/** Read the currently captured refs. */
		getRefs: () => StepperHarnessRefs;
	};

	export type StepperHarnessProps = {
		mode?: StepperHarnessMode;
		steps?: readonly StepperHarnessStep[];
		binding?: StepperHarnessBinding;
		/** Read by `binding: 'function'` — the value the parent keeps rendering whatever happens. */
		authoritativeValue?: string;
		/** Receives the value `binding: 'function'` refuses to write back. */
		onDeclinedValue?: (value: string) => void;
		/** Seeds the harness-owned controlled value. */
		initialValue?: string;
		defaultValue?: string;
		onValueChange?: (value: string) => void;
		onValueAdd?: (value: string) => void;
		onValueRemove?: (value: string) => void;
		onValueComplete?: (value: string, completed: boolean) => void;
		onValidate?: (
			value: string,
			direction: StepperNavigationDirection
		) => boolean | Promise<boolean>;
		activationMode?: StepperActivationMode;
		orientation?: StepperOrientation;
		dir?: Direction;
		/** The `dir` the `rtl-provider` mode's `<DirectionProvider>` publishes. */
		providerDir?: Direction;
		disabled?: boolean;
		loop?: boolean;
		nonInteractive?: boolean;
		id?: string;
		/** @default true */
		withTitle?: boolean;
		/** @default true */
		withDescription?: boolean;
		/** Render each indicator's `children` snippet, which receives the step's data state. */
		withIndicatorSnippet?: boolean;
		/** @default true */
		withSeparator?: boolean;
		/** @default true */
		withContent?: boolean;
		/** @default true */
		withNavigation?: boolean;
		/** Keeps every separator mounted, including the one after the last step (FR-017). */
		separatorForceMount?: boolean;
		/** Keeps every content panel mounted, including inactive ones (FR-017). */
		contentForceMount?: boolean;
		/** Render a focusable element before and after the stepper, for Tab-entry assertions. */
		withSiblings?: boolean;
		/** Which part `bare-part` mode renders. */
		barePart?: StepperHarnessPart;
		/** Caller handler on the first trigger, which must run before the trigger's own. */
		onTriggerKeydown?: (event: KeyboardEvent) => void;
		registerApi?: (api: StepperHarnessApi) => void;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import * as Stepper from './index.js';

	let {
		mode = 'default',
		steps = STEPPER_HARNESS_STEPS,
		binding = 'none',
		authoritativeValue = 'step1',
		onDeclinedValue,
		initialValue = 'step1',
		defaultValue,
		onValueChange,
		onValueAdd,
		onValueRemove,
		onValueComplete,
		onValidate,
		activationMode,
		orientation,
		dir,
		providerDir = 'rtl',
		disabled,
		loop,
		nonInteractive,
		id,
		withTitle = true,
		withDescription = true,
		withIndicatorSnippet = false,
		withSeparator = true,
		withContent = true,
		withNavigation = true,
		separatorForceMount = false,
		contentForceMount = false,
		withSiblings = false,
		barePart = 'List',
		onTriggerKeydown,
		registerApi
	}: StepperHarnessProps = $props();

	let stepList = $state<StepperHarnessStep[]>(steps.map((step) => ({ ...step })));
	let controlledValue = $state(initialValue);

	let rootRef = $state<HTMLDivElement | null>(null);
	let listRef = $state<HTMLDivElement | null>(null);
	let prevRef = $state<HTMLButtonElement | null>(null);
	let nextRef = $state<HTMLButtonElement | null>(null);
	// One slot per `{#each}` iteration — see the note on `StepperHarnessRefs`.
	let itemRefs = $state<(HTMLDivElement | null)[]>([]);
	let triggerRefs = $state<(HTMLButtonElement | null)[]>([]);
	let indicatorRefs = $state<(HTMLDivElement | null)[]>([]);
	let separatorRefs = $state<(HTMLDivElement | null)[]>([]);
	let titleRefs = $state<(HTMLSpanElement | null)[]>([]);
	let descriptionRefs = $state<(HTMLSpanElement | null)[]>([]);
	let contentRefs = $state<(HTMLDivElement | null)[]>([]);

	registerApi?.({
		setValue: (next: string) => {
			controlledValue = next;
		},
		setSteps: (next: StepperHarnessStep[]) => {
			stepList = next.map((step) => ({ ...step }));
		},
		setCompleted: (value: string, completed: boolean) => {
			const step = stepList.find((candidate) => candidate.value === value);
			if (step) step.completed = completed;
		},
		setDisabled: (value: string, disabled: boolean) => {
			const step = stepList.find((candidate) => candidate.value === value);
			if (step) step.disabled = disabled;
		},
		getRefs: () => ({
			root: rootRef,
			list: listRef,
			item: itemRefs[0] ?? null,
			trigger: triggerRefs[0] ?? null,
			indicator: indicatorRefs[0] ?? null,
			separator: separatorRefs[0] ?? null,
			title: titleRefs[0] ?? null,
			description: descriptionRefs[0] ?? null,
			content: contentRefs[0] ?? null,
			prev: prevRef,
			next: nextRef
		})
	});

	/** Everything the root takes that is not the `value` wiring, which each branch spells out itself. */
	const rootProps = $derived({
		onValueChange,
		onValueAdd,
		onValueRemove,
		onValueComplete,
		onValidate,
		activationMode,
		orientation,
		dir,
		disabled,
		loop,
		nonInteractive,
		id
	});
</script>

<!-- `data-testid` comes *after* the spread in every child snippet: the merged props carry the
     harness's own `data-testid`, and the caller's element must be addressable under its own id. -->
{#snippet rootChild({ props }: { props: StepperChildProps })}
	<section {...props as Record<string, unknown>} data-testid="root-child">
		{@render body()}
	</section>
{/snippet}

{#snippet triggerChild({ props }: { props: StepperTriggerChildProps })}
	<button {...props as Record<string, unknown>} data-testid="trigger-child">
		{stepList[0]?.title}
	</button>
{/snippet}

{#snippet indicatorChild({ props }: { props: StepperIndicatorChildProps })}
	<span {...props as Record<string, unknown>} data-testid="indicator-child">dot</span>
{/snippet}

{#snippet prevChild({ props }: { props: StepperPrevChildProps })}
	<button {...props as Record<string, unknown>} data-testid="prev-child">Previous</button>
{/snippet}

{#snippet nextChild({ props }: { props: StepperNextChildProps })}
	<button {...props as Record<string, unknown>} data-testid="next-child">Next</button>
{/snippet}

{#snippet list()}
	<Stepper.List bind:ref={listRef} data-testid="list">
		{#each stepList as step, index (step.value)}
			{#snippet indicatorState(dataState: StepperDataState)}
				<span data-testid={`indicator-state-${step.value}`}>{dataState}</span>
			{/snippet}
			<Stepper.Item
				bind:ref={() => itemRefs[index] ?? null, (element) => (itemRefs[index] = element)}
				value={step.value}
				completed={step.completed}
				disabled={step.disabled}
				data-testid={`item-${step.value}`}
			>
				<Stepper.Trigger
					bind:ref={() => triggerRefs[index] ?? null, (element) => (triggerRefs[index] = element)}
					data-testid={`trigger-${step.value}`}
					onkeydown={index === 0 ? onTriggerKeydown : undefined}
					child={mode === 'trigger-child' && index === 0 ? triggerChild : undefined}
				>
					<Stepper.Indicator
						bind:ref={
							() => indicatorRefs[index] ?? null, (element) => (indicatorRefs[index] = element)
						}
						data-testid={`indicator-${step.value}`}
						child={mode === 'indicator-child' && index === 0 ? indicatorChild : undefined}
						children={withIndicatorSnippet ? indicatorState : undefined}
					/>
					{#if withTitle || withDescription}
						<span>
							{#if withTitle}
								<Stepper.Title
									bind:ref={
										() => titleRefs[index] ?? null, (element) => (titleRefs[index] = element)
									}
								>
									{step.title}
								</Stepper.Title>
							{/if}
							{#if withDescription && step.description}
								<Stepper.Description
									bind:ref={
										() => descriptionRefs[index] ?? null,
										(element) => (descriptionRefs[index] = element)
									}
								>
									{step.description}
								</Stepper.Description>
							{/if}
						</span>
					{/if}
				</Stepper.Trigger>
				{#if withSeparator}
					<Stepper.Separator
						bind:ref={
							() => separatorRefs[index] ?? null, (element) => (separatorRefs[index] = element)
						}
						data-testid={`separator-${step.value}`}
						forceMount={separatorForceMount}
					/>
				{/if}
			</Stepper.Item>
		{/each}
	</Stepper.List>
{/snippet}

{#snippet body()}
	{@render list()}
	{#if withContent}
		{#each stepList as step, index (step.value)}
			<Stepper.Content
				bind:ref={() => contentRefs[index] ?? null, (element) => (contentRefs[index] = element)}
				value={step.value}
				forceMount={contentForceMount}
				data-testid={`content-${step.value}`}
			>
				Content for {step.title}
			</Stepper.Content>
		{/each}
	{/if}
	{#if withNavigation}
		<div>
			<Stepper.Prev
				bind:ref={prevRef}
				data-testid="prev"
				child={mode === 'prev-child' ? prevChild : undefined}
			>
				Previous
			</Stepper.Prev>
			<Stepper.Next
				bind:ref={nextRef}
				data-testid="next"
				child={mode === 'next-child' ? nextChild : undefined}
			>
				Next
			</Stepper.Next>
		</div>
	{/if}
{/snippet}

{#snippet root()}
	{#if binding === 'function'}
		<Stepper.Root
			bind:ref={rootRef}
			bind:value={() => authoritativeValue, (next: string) => onDeclinedValue?.(next)}
			{...rootProps}
			data-testid="root"
			child={mode === 'root-child' ? rootChild : undefined}
		>
			{@render body()}
		</Stepper.Root>
	{:else if binding === 'value'}
		<Stepper.Root
			bind:ref={rootRef}
			bind:value={controlledValue}
			{...rootProps}
			data-testid="root"
			child={mode === 'root-child' ? rootChild : undefined}
		>
			{@render body()}
		</Stepper.Root>
	{:else}
		<Stepper.Root
			bind:ref={rootRef}
			{defaultValue}
			{...rootProps}
			data-testid="root"
			child={mode === 'root-child' ? rootChild : undefined}
		>
			{@render body()}
		</Stepper.Root>
	{/if}
{/snippet}

{#snippet bare()}
	{#if barePart === 'List'}
		<Stepper.List />
	{:else if barePart === 'Item'}
		<Stepper.Item value="step1" />
	{:else if barePart === 'Content'}
		<Stepper.Content value="step1" />
	{:else if barePart === 'Prev'}
		<Stepper.Prev />
	{:else if barePart === 'Next'}
		<Stepper.Next />
	{:else if barePart === 'TriggerOutsideList'}
		<!-- Root and Item are present, so only the list's focus context is missing. -->
		<Stepper.Root>
			<Stepper.Item value="step1">
				<Stepper.Trigger />
			</Stepper.Item>
		</Stepper.Root>
	{:else}
		<!-- A root, but no item: the five item-scoped parts must each name `<Stepper.Item>`. -->
		<Stepper.Root>
			{#if barePart === 'Trigger'}
				<Stepper.List>
					<Stepper.Trigger />
				</Stepper.List>
			{:else if barePart === 'Indicator'}
				<Stepper.Indicator />
			{:else if barePart === 'Separator'}
				<Stepper.Separator />
			{:else if barePart === 'Title'}
				<Stepper.Title />
			{:else}
				<Stepper.Description />
			{/if}
		</Stepper.Root>
	{/if}
{/snippet}

{#snippet tree()}
	{#if withSiblings}
		<button type="button" data-testid="before">Before</button>
	{/if}
	{@render root()}
	{#if withSiblings}
		<button type="button" data-testid="after">After</button>
	{/if}
{/snippet}

{#if mode === 'bare-part'}
	{@render bare()}
{:else if mode === 'rtl-provider'}
	<DirectionProvider dir={providerDir}>
		{@render tree()}
	</DirectionProvider>
{:else}
	{@render tree()}
{/if}
