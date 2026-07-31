<script lang="ts" module>
	import type { ButtonSize, ButtonVariant } from '$lib/components/ui/button/index.js';
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	import type {
		ActionBarAlign,
		ActionBarItemSelectEvent,
		ActionBarOrientation,
		ActionBarSide
	} from './index.js';

	/**
	 * Which single path this render exercises. A `.ts` spec cannot express `{#snippet child({ props })}`,
	 * `bind:open`, `bind:ref`, a part with no provider ancestor, or an `{#each}`-driven item set, so
	 * everything needing a real component tree goes through this file. It is not collected by Vitest
	 * (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type ActionBarHarnessMode =
		| 'default'
		| 'bare-group'
		| 'bare-item'
		| 'bare-close'
		| 'bare-separator'
		| 'bare-selection'
		| 'item-outside-group';

	/**
	 * How the parent wires `open`, mirroring the `checkbox-group` harness:
	 *
	 * - `none` — uncontrolled: only `defaultOpen` is passed, the root owns the state.
	 * - `open` — `bind:open`, the parent accepts every change.
	 * - `function` — `bind:open={() => authoritativeOpen, (next) => …}`, the parent stays
	 *   authoritative and declines the write. That is upstream's plain-`open`-prop semantics.
	 */
	export type ActionBarHarnessBinding = 'none' | 'open' | 'function';

	/** One `<ActionBar.Item>` rendered inside the group. */
	export type ActionBarHarnessItem = {
		key: string;
		label: string;
		/** @default false */
		disabled?: boolean;
		variant?: ButtonVariant;
		size?: ButtonSize;
		onSelect?: (event: ActionBarItemSelectEvent) => void;
		/** Caller handler on the item, which must run before the `actionbar.itemSelect` dispatch. */
		onclick?: (event: MouseEvent) => void;
		/** Caller handler which must run before the item claims the group's tab stop. */
		onfocus?: (event: FocusEvent) => void;
		/** Caller handler which must run before the item resolves a focus intent. */
		onkeydown?: (event: KeyboardEvent) => void;
		/** Caller handler which must run before the item claims the tab stop on pointer press. */
		onmousedown?: (event: MouseEvent) => void;
	};

	/** The three-item composition every navigation test walks. */
	export const ACTION_BAR_HARNESS_ITEMS: readonly ActionBarHarnessItem[] = [
		{ key: 'duplicate', label: 'Duplicate' },
		{ key: 'archive', label: 'Archive' },
		{ key: 'delete', label: 'Delete' }
	];

	/**
	 * Every `bind:ref` the harness captures, reported through {@link ActionBarHarnessProps.onRefs}.
	 *
	 * `item` is the **first** item's, because the parts inside the `{#each}` bind into a per-index
	 * array: one binding shared by every iteration would alias all three onto one element — a `bind:`
	 * writes back *down* as well as up — and each item would then register its neighbour's element in
	 * the roving-focus collection, breaking navigation order.
	 *
	 * Every binding is applied in `child` mode too, where each part must leave `ref` at `null` because
	 * the caller owns the element.
	 */
	export type ActionBarHarnessRefs = {
		root: HTMLDivElement | null;
		selection: HTMLDivElement | null;
		separator: HTMLDivElement | null;
		group: HTMLDivElement | null;
		item: HTMLElement | null;
		close: HTMLButtonElement | null;
	};

	export type ActionBarHarnessProps = {
		mode?: ActionBarHarnessMode;
		// root
		binding?: ActionBarHarnessBinding;
		open?: boolean;
		/** Read by `binding: 'function'` — the value the parent keeps rendering whatever happens. */
		authoritativeOpen?: boolean;
		/** Receives the value `binding: 'function'` refuses to write back. */
		onDeclinedOpen?: (open: boolean) => void;
		defaultOpen?: boolean;
		onOpenChange?: (open: boolean) => void;
		onEscapeKeyDown?: (event: KeyboardEvent) => void;
		side?: ActionBarSide;
		sideOffset?: number;
		align?: ActionBarAlign;
		alignOffset?: number;
		portalContainer?: Element | DocumentFragment | string | null;
		dir?: Direction;
		orientation?: ActionBarOrientation;
		loop?: boolean;
		rootClass?: string;
		rootStyle?: string;
		/** Wraps the tree in a `<DirectionProvider>` so the inherited leg of `dir` can be exercised. */
		providerDir?: Direction;
		// selection / separator
		selectionText?: string;
		separatorOrientation?: ActionBarOrientation;
		// group
		groupClass?: string;
		onGroupFocusIn?: (event: FocusEvent) => void;
		onGroupFocusOut?: (event: FocusEvent) => void;
		onGroupMouseDown?: (event: MouseEvent) => void;
		// items
		items?: readonly ActionBarHarnessItem[];
		itemClass?: string;
		// close
		closeLabel?: string;
		onCloseClick?: (event: MouseEvent) => void;
		// child snippets
		rootChild?: boolean;
		selectionChild?: boolean;
		separatorChild?: boolean;
		groupChild?: boolean;
		itemChild?: boolean;
		closeChild?: boolean;
		// surroundings
		withSiblings?: boolean;
		onRefs?: (refs: ActionBarHarnessRefs) => void;
		/** Reports the value `bind:open` writes back into this harness — the child → parent leg. */
		onOpenBinding?: (open: boolean | undefined) => void;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import * as ActionBar from './index.js';

	let {
		mode = 'default',
		binding = 'open',
		open = $bindable(),
		authoritativeOpen = false,
		onDeclinedOpen,
		defaultOpen,
		onOpenChange,
		onEscapeKeyDown,
		side,
		sideOffset,
		align,
		alignOffset,
		portalContainer,
		dir,
		orientation,
		loop,
		rootClass,
		rootStyle,
		providerDir,
		selectionText = '2 selected',
		separatorOrientation,
		groupClass,
		onGroupFocusIn,
		onGroupFocusOut,
		onGroupMouseDown,
		items = ACTION_BAR_HARNESS_ITEMS,
		itemClass,
		closeLabel = 'Close',
		onCloseClick,
		rootChild = false,
		selectionChild = false,
		separatorChild = false,
		groupChild = false,
		itemChild = false,
		closeChild = false,
		withSiblings = false,
		onRefs,
		onOpenBinding
	}: ActionBarHarnessProps = $props();

	// No `<ActionBar>` ancestor in these modes — reproduces a consumer using a part outside its
	// provider, which must throw during that part's own initialisation.
	const bareMode = $derived(mode.startsWith('bare-'));

	let rootRef = $state<HTMLDivElement | null>(null);
	let selectionRef = $state<HTMLDivElement | null>(null);
	let separatorRef = $state<HTMLDivElement | null>(null);
	let groupRef = $state<HTMLDivElement | null>(null);
	let closeRef = $state<HTMLButtonElement | null>(null);
	// One slot per `{#each}` iteration — see the note on `ActionBarHarnessRefs`.
	let itemRefs = $state<(HTMLElement | null)[]>([]);

	const harnessRefs: ActionBarHarnessRefs = $derived({
		root: rootRef,
		selection: selectionRef,
		separator: separatorRef,
		group: groupRef,
		item: itemRefs[0] ?? null,
		close: closeRef
	});

	/** Everything the root takes that is not the `open` wiring, which each branch spells out itself. */
	const rootProps = $derived({
		defaultOpen,
		onOpenChange,
		onEscapeKeyDown,
		side,
		sideOffset,
		align,
		alignOffset,
		portalContainer,
		dir,
		orientation,
		loop
	});

	$effect(() => {
		onRefs?.(harnessRefs);
	});

	$effect(() => {
		onOpenBinding?.(open);
	});
</script>

{#snippet rootChildSnippet({ props }: { props: ActionBar.ActionBarChildProps })}
	<section data-testid="root-child" {...props as Record<string, unknown>}>
		{@render barBody()}
	</section>
{/snippet}

{#snippet selectionChildSnippet({ props }: { props: ActionBar.ActionBarSelectionChildProps })}
	<output data-testid="selection-child" {...props as Record<string, unknown>}
		>{selectionText}</output
	>
{/snippet}

{#snippet separatorChildSnippet({ props }: { props: ActionBar.ActionBarSeparatorChildProps })}
	<div data-testid="separator-child" {...props as Record<string, unknown>}></div>
{/snippet}

{#snippet groupChildSnippet({ props }: { props: ActionBar.ActionBarGroupChildProps })}
	<div data-testid="group-child" {...props as Record<string, unknown>}>
		{@render itemList()}
	</div>
{/snippet}

{#snippet itemChildSnippet({ props }: { props: ActionBar.ActionBarItemChildProps })}
	<button data-testid="item-child" {...props as Record<string, unknown>}>go</button>
{/snippet}

{#snippet closeChildSnippet({ props }: { props: ActionBar.ActionBarCloseChildProps })}
	<button data-testid="close-child" {...props as Record<string, unknown>}>{closeLabel}</button>
{/snippet}

{#snippet itemList()}
	{#if itemChild && items.length > 0}
		<ActionBar.Item
			bind:ref={() => itemRefs[0] ?? null, (element) => (itemRefs[0] = element)}
			child={itemChildSnippet}
		/>
	{:else}
		{#each items as item, index (item.key)}
			<ActionBar.Item
				bind:ref={() => itemRefs[index] ?? null, (element) => (itemRefs[index] = element)}
				data-testid={`item-${item.key}`}
				disabled={item.disabled}
				variant={item.variant}
				size={item.size}
				onSelect={item.onSelect}
				onclick={item.onclick}
				onfocus={item.onfocus}
				onkeydown={item.onkeydown}
				onmousedown={item.onmousedown}
				class={itemClass}
			>
				{item.label}
			</ActionBar.Item>
		{/each}
	{/if}
{/snippet}

{#snippet barBody()}
	{#if selectionChild}
		<ActionBar.Selection bind:ref={selectionRef} child={selectionChildSnippet} />
	{:else}
		<ActionBar.Selection bind:ref={selectionRef} data-testid="selection">
			{selectionText}
		</ActionBar.Selection>
	{/if}
	{#if separatorChild}
		<ActionBar.Separator
			bind:ref={separatorRef}
			orientation={separatorOrientation}
			child={separatorChildSnippet}
		/>
	{:else}
		<ActionBar.Separator
			bind:ref={separatorRef}
			data-testid="separator"
			orientation={separatorOrientation}
		/>
	{/if}
	{#if groupChild}
		<ActionBar.Group
			bind:ref={groupRef}
			onfocusin={onGroupFocusIn}
			onfocusout={onGroupFocusOut}
			onmousedown={onGroupMouseDown}
			child={groupChildSnippet}
		/>
	{:else}
		<ActionBar.Group
			bind:ref={groupRef}
			data-testid="group"
			class={groupClass}
			onfocusin={onGroupFocusIn}
			onfocusout={onGroupFocusOut}
			onmousedown={onGroupMouseDown}
		>
			{@render itemList()}
		</ActionBar.Group>
	{/if}
	{#if closeChild}
		<ActionBar.Close bind:ref={closeRef} onclick={onCloseClick} child={closeChildSnippet} />
	{:else}
		<ActionBar.Close bind:ref={closeRef} data-testid="close" onclick={onCloseClick}>
			<span class="sr-only">{closeLabel}</span>
		</ActionBar.Close>
	{/if}
{/snippet}

{#snippet rootContent()}
	{#if mode === 'item-outside-group'}
		<ActionBar.Item data-testid="orphan-item">Orphan</ActionBar.Item>
	{:else}
		{@render barBody()}
	{/if}
{/snippet}

{#snippet bar()}
	{#if bareMode}
		{#if mode === 'bare-group'}
			<ActionBar.Group data-testid="group" />
		{:else if mode === 'bare-item'}
			<ActionBar.Item data-testid="item" />
		{:else if mode === 'bare-close'}
			<ActionBar.Close data-testid="close" />
		{:else if mode === 'bare-selection'}
			<!-- The one part with no provider requirement: it must render, not throw (FR-014). -->
			<ActionBar.Selection bind:ref={selectionRef} data-testid="selection">
				{selectionText}
			</ActionBar.Selection>
		{:else}
			<ActionBar.Separator data-testid="separator" />
		{/if}
	{:else}
		<div>
			{#if withSiblings}
				<button type="button" data-testid="before">Before</button>
			{/if}
			{#if rootChild}
				<ActionBar.Root
					bind:ref={rootRef}
					bind:open
					{...rootProps}
					class={rootClass}
					style={rootStyle}
					child={rootChildSnippet}
				/>
			{:else if binding === 'function'}
				<ActionBar.Root
					bind:ref={rootRef}
					bind:open={() => authoritativeOpen, (next) => onDeclinedOpen?.(next)}
					{...rootProps}
					data-testid="root"
					class={rootClass}
					style={rootStyle}
				>
					{@render rootContent()}
				</ActionBar.Root>
			{:else if binding === 'none'}
				<ActionBar.Root
					bind:ref={rootRef}
					{...rootProps}
					data-testid="root"
					class={rootClass}
					style={rootStyle}
				>
					{@render rootContent()}
				</ActionBar.Root>
			{:else}
				<ActionBar.Root
					bind:ref={rootRef}
					bind:open
					{...rootProps}
					data-testid="root"
					class={rootClass}
					style={rootStyle}
				>
					{@render rootContent()}
				</ActionBar.Root>
			{/if}
			{#if withSiblings}
				<button type="button" data-testid="after">After</button>
			{/if}
		</div>
	{/if}
{/snippet}

{#if providerDir}
	<DirectionProvider dir={providerDir}>
		{@render bar()}
	</DirectionProvider>
{:else}
	{@render bar()}
{/if}
