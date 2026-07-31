<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	import type {
		SelectionToolbarAlign,
		SelectionToolbarChildProps,
		SelectionToolbarItemChildProps,
		SelectionToolbarItemSelectEvent,
		SelectionToolbarSeparatorChildProps,
		SelectionToolbarSide
	} from './index.js';

	/**
	 * Which single path this render exercises. A `.ts` spec cannot express
	 * `{#snippet child({ props })}`, `bind:open`, `bind:ref`, a `contenteditable` fixture or a part
	 * with no provider ancestor, so everything needing a real component tree goes through this file.
	 * It is not collected by Vitest (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type SelectionToolbarHarnessMode = 'default' | 'bare-item' | 'bare-separator';

	/**
	 * How the root is scoped, mirroring upstream's three states (selection-toolbar.tsx:403-406):
	 *
	 * - `none` — `container` is not passed at all: the whole document is tracked.
	 * - `scoped` — `container` is the editable fixture: selections outside it are ignored.
	 * - `null` — scoped but unresolved: `updateSelection()` must neither open nor close.
	 */
	export type SelectionToolbarHarnessContainer = 'none' | 'scoped' | 'null';

	/** `none` leaves the root uncontrolled; `open` gives it a real `bind:open` from this harness. */
	export type SelectionToolbarHarnessBinding = 'none' | 'open';

	/** Lets a spec act as the controlling parent without re-rendering the harness. */
	export type SelectionToolbarHarnessControls = {
		setOpen: (open: boolean) => void;
		getOpen: () => boolean;
	};

	/** One `<SelectionToolbar.Item>` rendered inside the toolbar. */
	export type SelectionToolbarHarnessItem = {
		key: string;
		label: string;
		/** @default false */
		disabled?: boolean;
		onSelect?: (text: string, event: SelectionToolbarItemSelectEvent) => void;
		/** Caller handler that must run before the item's own `click` activation. */
		onclick?: (event: MouseEvent) => void;
		/** Caller handler that must run before the item's own `pointerdown` handling. */
		onpointerdown?: (event: PointerEvent) => void;
		/** Caller handler that must run before the item's own `pointerup` activation. */
		onpointerup?: (event: PointerEvent) => void;
	};

	/** The two-item composition every activation test walks. */
	export const SELECTION_TOOLBAR_HARNESS_ITEMS: readonly SelectionToolbarHarnessItem[] = [
		{ key: 'bold', label: 'Bold' },
		{ key: 'italic', label: 'Italic' }
	];

	/** Text of the editable fixture's first block, which most specs build their `Range`s over. */
	export const SELECTION_TOOLBAR_HARNESS_TEXT = 'The quick brown fox jumps over the lazy dog';

	/**
	 * Text of a second block inside the *same* tracked container, so a `Range` can span two elements
	 * and land `commonAncestorContainer` on an `Element` rather than on a `Text` node.
	 */
	export const SELECTION_TOOLBAR_HARNESS_SECOND_TEXT =
		'A second paragraph in the same editable region';

	/** Text of the paragraph rendered outside the tracked container. */
	export const SELECTION_TOOLBAR_HARNESS_OUTSIDE_TEXT = 'Prose that sits outside the container';

	/** Every `bind:ref` the harness captures. Each stays `null` in `child` mode, by contract. */
	export type SelectionToolbarHarnessRefs = {
		root: HTMLDivElement | null;
		item: HTMLElement | null;
		separator: HTMLDivElement | null;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import * as SelectionToolbar from './index.js';

	type SelectionToolbarHarnessProps = {
		mode?: SelectionToolbarHarnessMode;
		container?: SelectionToolbarHarnessContainer;
		binding?: SelectionToolbarHarnessBinding;
		onControls?: (controls: SelectionToolbarHarnessControls) => void;
		onRefs?: (refs: SelectionToolbarHarnessRefs) => void;
		onOpenChange?: (open: boolean) => void;
		onOpenBinding?: (open: boolean | undefined) => void;
		onSelectionChange?: (text: string) => void;
		side?: SelectionToolbarSide;
		sideOffset?: number;
		align?: SelectionToolbarAlign;
		alignOffset?: number;
		portalContainer?: Element | DocumentFragment | string | null;
		dir?: Direction;
		/** Wraps the tree in a `<DirectionProvider>` so the inherited leg of `dir` can be exercised. */
		providerDir?: Direction;
		rootClass?: string;
		rootStyle?: string;
		/** Overrides the root's default accessible name through `restProps`. */
		rootAriaLabel?: string;
		rootChild?: boolean;
		itemChild?: boolean;
		separatorChild?: boolean;
		items?: readonly SelectionToolbarHarnessItem[];
	};

	let {
		mode = 'default',
		container = 'none',
		binding = 'none',
		onControls,
		onRefs,
		onOpenChange,
		onOpenBinding,
		onSelectionChange,
		side,
		sideOffset,
		align,
		alignOffset,
		portalContainer,
		dir,
		providerDir,
		rootClass,
		rootStyle,
		rootAriaLabel,
		rootChild = false,
		itemChild = false,
		separatorChild = false,
		items = SELECTION_TOOLBAR_HARNESS_ITEMS
	}: SelectionToolbarHarnessProps = $props();

	// No `<SelectionToolbar>` ancestor in these modes — reproduces a consumer using a part outside
	// its provider, which must throw during that part's own initialisation.
	const bareMode = $derived(mode.startsWith('bare-'));

	let editorElement = $state<HTMLDivElement | null>(null);
	let rootRef = $state<HTMLDivElement | null>(null);
	let itemRef = $state<HTMLElement | null>(null);
	let separatorRef = $state<HTMLDivElement | null>(null);
	let openState = $state(false);

	const containerProp = $derived(
		container === 'scoped' ? editorElement : container === 'null' ? null : undefined
	);

	const controls: SelectionToolbarHarnessControls = {
		setOpen: (next) => (openState = next),
		getOpen: () => openState
	};

	$effect(() => {
		onControls?.(controls);
	});

	$effect(() => {
		onOpenBinding?.(openState);
	});

	$effect(() => {
		onRefs?.({ root: rootRef, item: itemRef, separator: separatorRef });
	});

	/** Everything the root takes that is not the `open` wiring, which each branch spells out. */
	const rootProps = $derived({
		container: containerProp,
		onOpenChange,
		onSelectionChange,
		side,
		sideOffset,
		align,
		alignOffset,
		portalContainer,
		dir,
		// Spread conditionally: a literal `aria-label={undefined}` would erase the part's own default.
		...(rootAriaLabel === undefined ? {} : { 'aria-label': rootAriaLabel })
	});
</script>

{#snippet toolbarBody()}
	{#each items as item (item.key)}
		{#snippet itemChildSnippet({ props }: { props: SelectionToolbarItemChildProps })}
			<!-- `data-child` rather than a `data-testid`: the merged props carry their own testid and
			     would overwrite it, which is exactly the merge this snippet exists to prove. -->
			<button data-child="item" {...props as Record<string, unknown>}>{item.label}</button>
		{/snippet}

		{#if itemChild}
			<SelectionToolbar.Item
				bind:ref={itemRef}
				data-testid={`item-${item.key}`}
				disabled={item.disabled}
				onSelect={item.onSelect}
				onclick={item.onclick}
				onpointerdown={item.onpointerdown}
				onpointerup={item.onpointerup}
				child={itemChildSnippet}
			/>
		{:else}
			<SelectionToolbar.Item
				bind:ref={itemRef}
				data-testid={`item-${item.key}`}
				disabled={item.disabled}
				onSelect={item.onSelect}
				onclick={item.onclick}
				onpointerdown={item.onpointerdown}
				onpointerup={item.onpointerup}
			>
				{item.label}
			</SelectionToolbar.Item>
		{/if}
	{/each}
	{#if separatorChild}
		<SelectionToolbar.Separator bind:ref={separatorRef} child={separatorChildSnippet} />
	{:else}
		<SelectionToolbar.Separator bind:ref={separatorRef} data-testid="separator" />
	{/if}
{/snippet}

{#snippet separatorChildSnippet({ props }: { props: SelectionToolbarSeparatorChildProps })}
	<div data-testid="separator-child" {...props as Record<string, unknown>}></div>
{/snippet}

{#snippet rootChildSnippet({ props }: { props: SelectionToolbarChildProps })}
	<section data-testid="root-child" {...props as Record<string, unknown>}>
		{@render toolbarBody()}
	</section>
{/snippet}

{#snippet tree()}
	{#if bareMode}
		{#if mode === 'bare-item'}
			<SelectionToolbar.Item data-testid="orphan-item">Bold</SelectionToolbar.Item>
		{:else}
			<SelectionToolbar.Separator data-testid="orphan-separator" />
		{/if}
	{:else}
		<div>
			<div bind:this={editorElement} contenteditable="true" data-testid="editor">
				<p data-testid="editor-primary">{SELECTION_TOOLBAR_HARNESS_TEXT}</p>
				<p data-testid="editor-secondary">{SELECTION_TOOLBAR_HARNESS_SECOND_TEXT}</p>
			</div>
			<p data-testid="outside">{SELECTION_TOOLBAR_HARNESS_OUTSIDE_TEXT}</p>
			<button type="button" data-testid="outside-button">Outside</button>

			{#if rootChild}
				<SelectionToolbar.Root
					bind:ref={rootRef}
					bind:open={openState}
					{...rootProps}
					class={rootClass}
					style={rootStyle}
					child={rootChildSnippet}
				/>
			{:else if binding === 'open'}
				<SelectionToolbar.Root
					bind:ref={rootRef}
					bind:open={openState}
					{...rootProps}
					class={rootClass}
					style={rootStyle}
				>
					{@render toolbarBody()}
				</SelectionToolbar.Root>
			{:else}
				<SelectionToolbar.Root
					bind:ref={rootRef}
					{...rootProps}
					class={rootClass}
					style={rootStyle}
				>
					{@render toolbarBody()}
				</SelectionToolbar.Root>
			{/if}
		</div>
	{/if}
{/snippet}

{#if providerDir}
	<DirectionProvider dir={providerDir}>
		{@render tree()}
	</DirectionProvider>
{:else}
	{@render tree()}
{/if}
