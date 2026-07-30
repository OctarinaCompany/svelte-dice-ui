<script lang="ts" module>
	import type { ButtonSize, ButtonVariant } from '$lib/components/ui/button/index.js';

	import type {
		SpeedDialActionSelectEvent,
		SpeedDialActivationMode,
		SpeedDialInteractOutsideEvent,
		SpeedDialSide
	} from './index.js';

	/**
	 * Which single path this render exercises. A `.ts` spec cannot express `{#snippet child({ props })}`,
	 * `bind:open`, `bind:ref`, a part with no provider ancestor, or an `{#each}`-driven item set, so
	 * everything needing a real component tree goes through this file. It is not collected by Vitest
	 * (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type SpeedDialHarnessMode =
		| 'default'
		| 'bare-trigger'
		| 'bare-content'
		| 'bare-item'
		| 'bare-action'
		| 'bare-label'
		| 'item-outside-content';

	/** One `<SpeedDial.Item>` rendered inside the content. */
	export type SpeedDialHarnessItem = {
		key: string;
		label: string;
		/** Overrides the action's generated `id`, so the `id` prop can be asserted. */
		id?: string;
		/** @default false */
		disabled?: boolean;
		/** Render the label `sr-only`, as four of the five upstream demos do. @default false */
		srOnly?: boolean;
		onSelect?: (event: SpeedDialActionSelectEvent) => void;
		/** Caller handler on the action, which must run before the `speedDial.actionSelect` dispatch. */
		onclick?: (event: MouseEvent) => void;
	};

	/** The three-item composition the upstream test file uses (test:14-42). */
	export const SPEED_DIAL_HARNESS_ITEMS: readonly SpeedDialHarnessItem[] = [
		{ key: 'home', label: 'Home' },
		{ key: 'share', label: 'Share' },
		{ key: 'edit', label: 'Edit' }
	];

	/**
	 * Every `bind:ref` the harness captures, reported through {@link SpeedDialHarnessProps.onRefs}.
	 *
	 * `item`/`action`/`label` are the **first** item's, because the parts inside the `{#each}` bind
	 * into per-index arrays: one binding shared by every iteration would alias all three onto one
	 * element — a `bind:` writes back *down* as well as up — and each item would then register its
	 * neighbour's element in the collection, breaking both the stagger order and the `Tab` boundary.
	 *
	 * Every binding is applied in `child` mode too, where each part must leave `ref` at `null`
	 * because the caller owns the element.
	 */
	export type SpeedDialHarnessRefs = {
		root: HTMLDivElement | null;
		trigger: HTMLElement | null;
		content: HTMLDivElement | null;
		item: HTMLDivElement | null;
		action: HTMLElement | null;
		label: HTMLDivElement | null;
	};

	export type SpeedDialHarnessProps = {
		mode?: SpeedDialHarnessMode;
		// root
		open?: boolean;
		defaultOpen?: boolean;
		onOpenChange?: (open: boolean) => void;
		side?: SpeedDialSide;
		activationMode?: SpeedDialActivationMode;
		delay?: number;
		disabled?: boolean;
		rootClass?: string;
		onRootPointerDownCapture?: (event: PointerEvent) => void;
		// trigger
		triggerId?: string;
		triggerClass?: string;
		triggerDisabled?: boolean;
		triggerVariant?: ButtonVariant;
		triggerSize?: ButtonSize;
		onTriggerClick?: (event: MouseEvent) => void;
		onTriggerMouseEnter?: (event: MouseEvent) => void;
		onTriggerMouseLeave?: (event: MouseEvent) => void;
		// content
		offset?: number;
		gap?: number;
		forceMount?: boolean;
		contentClass?: string;
		contentStyle?: string;
		onEscapeKeyDown?: (event: KeyboardEvent) => void;
		onInteractOutside?: (event: SpeedDialInteractOutsideEvent) => void;
		onContentMouseEnter?: (event: MouseEvent) => void;
		onContentMouseLeave?: (event: MouseEvent) => void;
		// items
		items?: readonly SpeedDialHarnessItem[];
		itemClass?: string;
		itemStyle?: string;
		labelClass?: string;
		actionClass?: string;
		actionVariant?: ButtonVariant;
		actionSize?: ButtonSize;
		// child snippets
		rootChild?: boolean;
		triggerChild?: boolean;
		contentChild?: boolean;
		itemChild?: boolean;
		actionChild?: boolean;
		labelChild?: boolean;
		// surroundings
		withSiblings?: boolean;
		dir?: 'ltr' | 'rtl';
		onRefs?: (refs: SpeedDialHarnessRefs) => void;
		/** Reports the value `bind:open` writes back into this harness — the child → parent leg. */
		onOpenBinding?: (open: boolean | undefined) => void;
	};
</script>

<script lang="ts">
	import * as SpeedDial from './index.js';

	let {
		mode = 'default',
		open = $bindable(),
		defaultOpen,
		onOpenChange,
		side,
		activationMode,
		delay,
		disabled,
		rootClass,
		onRootPointerDownCapture,
		triggerId,
		triggerClass,
		triggerDisabled,
		triggerVariant,
		triggerSize,
		onTriggerClick,
		onTriggerMouseEnter,
		onTriggerMouseLeave,
		offset,
		gap,
		forceMount,
		contentClass,
		contentStyle,
		onEscapeKeyDown,
		onInteractOutside,
		onContentMouseEnter,
		onContentMouseLeave,
		items = SPEED_DIAL_HARNESS_ITEMS,
		itemClass,
		itemStyle,
		labelClass,
		actionClass,
		actionVariant,
		actionSize,
		rootChild = false,
		triggerChild = false,
		contentChild = false,
		itemChild = false,
		actionChild = false,
		labelChild = false,
		withSiblings = false,
		dir = 'ltr',
		onRefs,
		onOpenBinding
	}: SpeedDialHarnessProps = $props();

	// No `<SpeedDial.Root>` / `<SpeedDial.Item>` ancestor in these modes — reproduces a consumer using
	// a part outside its provider, which must throw during that part's own initialisation.
	const bareMode = $derived(mode.startsWith('bare-'));

	let rootRef = $state<HTMLDivElement | null>(null);
	let triggerRef = $state<HTMLElement | null>(null);
	let contentRef = $state<HTMLDivElement | null>(null);
	// One slot per `{#each}` iteration — see the note on `SpeedDialHarnessRefs`. The slots are read
	// and written through function bindings, so an index that has not been filled in yet reads as
	// `null` rather than as the `undefined` a bare index binding would hand the part.
	let itemRefs = $state<(HTMLDivElement | null)[]>([]);
	let actionRefs = $state<(HTMLElement | null)[]>([]);
	let labelRefs = $state<(HTMLDivElement | null)[]>([]);

	const harnessRefs: SpeedDialHarnessRefs = $derived({
		root: rootRef,
		trigger: triggerRef,
		content: contentRef,
		item: itemRefs[0] ?? null,
		action: actionRefs[0] ?? null,
		label: labelRefs[0] ?? null
	});

	$effect(() => {
		onRefs?.(harnessRefs);
	});

	$effect(() => {
		onOpenBinding?.(open);
	});
</script>

{#snippet rootChildSnippet({ props }: { props: SpeedDial.SpeedDialChildProps })}
	<section data-testid="root-child" {...props as Record<string, unknown>}>
		{@render dialBody()}
	</section>
{/snippet}

{#snippet triggerChildSnippet({ props }: { props: SpeedDial.SpeedDialTriggerChildProps })}
	<button data-testid="trigger-child" {...props as Record<string, unknown>}>+</button>
{/snippet}

{#snippet contentChildSnippet({ props }: { props: SpeedDial.SpeedDialContentChildProps })}
	<nav data-testid="content-child" {...props as Record<string, unknown>}>
		{@render itemList()}
	</nav>
{/snippet}

{#snippet itemChildSnippet({ props }: { props: SpeedDial.SpeedDialItemChildProps })}
	<span data-testid="item-child" {...props as Record<string, unknown>}>
		{@render itemBody(items[0], 0)}
	</span>
{/snippet}

{#snippet actionChildSnippet({ props }: { props: SpeedDial.SpeedDialActionChildProps })}
	<button data-testid="action-child" {...props as Record<string, unknown>}>go</button>
{/snippet}

{#snippet labelChildSnippet({ props }: { props: SpeedDial.SpeedDialLabelChildProps })}
	<em data-testid="label-child" {...props as Record<string, unknown>}>label</em>
{/snippet}

{#snippet itemBody(item: SpeedDialHarnessItem, index: number)}
	{#if labelChild}
		<SpeedDial.Label
			bind:ref={() => labelRefs[index] ?? null, (element) => (labelRefs[index] = element)}
			child={labelChildSnippet}
		/>
	{:else}
		<SpeedDial.Label
			bind:ref={() => labelRefs[index] ?? null, (element) => (labelRefs[index] = element)}
			data-testid={`label-${item.key}`}
			class={item.srOnly ? `sr-only ${labelClass ?? ''}`.trim() : labelClass}
		>
			{item.label}
		</SpeedDial.Label>
	{/if}
	{#if actionChild}
		<SpeedDial.Action
			bind:ref={() => actionRefs[index] ?? null, (element) => (actionRefs[index] = element)}
			child={actionChildSnippet}
		/>
	{:else}
		<SpeedDial.Action
			bind:ref={() => actionRefs[index] ?? null, (element) => (actionRefs[index] = element)}
			id={item.id}
			data-testid={`action-${item.key}`}
			disabled={item.disabled}
			variant={actionVariant}
			size={actionSize}
			onSelect={item.onSelect}
			onclick={item.onclick}
			class={actionClass}
		>
			<span>{item.label}</span>
		</SpeedDial.Action>
	{/if}
{/snippet}

{#snippet itemList()}
	{#if itemChild && items.length > 0}
		<SpeedDial.Item
			bind:ref={() => itemRefs[0] ?? null, (element) => (itemRefs[0] = element)}
			child={itemChildSnippet}
		/>
	{:else}
		{#each items as item, index (item.key)}
			<SpeedDial.Item
				bind:ref={() => itemRefs[index] ?? null, (element) => (itemRefs[index] = element)}
				data-testid={`item-${item.key}`}
				class={itemClass}
				style={itemStyle}
			>
				{@render itemBody(item, index)}
			</SpeedDial.Item>
		{/each}
	{/if}
{/snippet}

{#snippet dialBody()}
	{#if triggerChild}
		<SpeedDial.Trigger bind:ref={triggerRef} child={triggerChildSnippet} />
	{:else}
		<SpeedDial.Trigger
			bind:ref={triggerRef}
			id={triggerId}
			data-testid="trigger"
			disabled={triggerDisabled}
			variant={triggerVariant}
			size={triggerSize}
			class={triggerClass}
			onclick={onTriggerClick}
			onmouseenter={onTriggerMouseEnter}
			onmouseleave={onTriggerMouseLeave}
		>
			<span>+</span>
		</SpeedDial.Trigger>
	{/if}
	{#if contentChild}
		<SpeedDial.Content
			bind:ref={contentRef}
			{offset}
			{gap}
			{forceMount}
			{onEscapeKeyDown}
			{onInteractOutside}
			onmouseenter={onContentMouseEnter}
			onmouseleave={onContentMouseLeave}
			child={contentChildSnippet}
		/>
	{:else}
		<SpeedDial.Content
			bind:ref={contentRef}
			data-testid="content"
			{offset}
			{gap}
			{forceMount}
			{onEscapeKeyDown}
			{onInteractOutside}
			onmouseenter={onContentMouseEnter}
			onmouseleave={onContentMouseLeave}
			class={contentClass}
			style={contentStyle}
		>
			{@render itemList()}
		</SpeedDial.Content>
	{/if}
{/snippet}

{#if bareMode}
	{#if mode === 'bare-trigger'}
		<SpeedDial.Trigger data-testid="trigger" />
	{:else if mode === 'bare-content'}
		<SpeedDial.Content data-testid="content" />
	{:else if mode === 'bare-item'}
		<SpeedDial.Item data-testid="item" />
	{:else if mode === 'bare-action'}
		<SpeedDial.Action data-testid="action" />
	{:else}
		<SpeedDial.Label data-testid="label" />
	{/if}
{:else}
	<div {dir}>
		{#if withSiblings}
			<button type="button" data-testid="before">Before</button>
		{/if}
		{#if rootChild}
			<SpeedDial.Root
				bind:ref={rootRef}
				bind:open
				{defaultOpen}
				{onOpenChange}
				{side}
				{activationMode}
				{delay}
				{disabled}
				class={rootClass}
				onpointerdowncapture={onRootPointerDownCapture}
				child={rootChildSnippet}
			/>
		{:else}
			<SpeedDial.Root
				bind:ref={rootRef}
				bind:open
				{defaultOpen}
				{onOpenChange}
				{side}
				{activationMode}
				{delay}
				{disabled}
				data-testid="root"
				class={rootClass}
				onpointerdowncapture={onRootPointerDownCapture}
			>
				{#if mode === 'item-outside-content'}
					<SpeedDial.Item data-testid="orphan-item">
						<SpeedDial.Label data-testid="orphan-label">Orphan</SpeedDial.Label>
						<SpeedDial.Action data-testid="orphan-action">o</SpeedDial.Action>
					</SpeedDial.Item>
				{:else}
					{@render dialBody()}
				{/if}
			</SpeedDial.Root>
		{/if}
		{#if withSiblings}
			<button type="button" data-testid="after">After</button>
		{/if}
	</div>
{/if}
