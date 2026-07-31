<script lang="ts" module>
	import type { ResponsiveDialogContentProps } from './responsive-dialog-content.svelte';

	/**
	 * Which composition this render exercises. A `.ts` spec cannot express `bind:open`, the function
	 * binding `bind:open={get, set}`, a part rendered with no provider above it, a `child` snippet, or
	 * a content whose subtree has no focusable descendant, so everything needing a real component tree
	 * goes through this file. It is not collected by Vitest (`include` is `.{js,ts}`) and is not
	 * listed in `registry.json`.
	 */
	export type ResponsiveDialogHarnessMode =
		/** Root > Trigger + Content(Header(Title, Description), two inputs, Footer(Close)). */
		| 'default'
		/** `default` without any focusable descendant inside the content (T029 fallback branch). */
		| 'no-focusable'
		/** `default` plus a standalone `Portal` wrapping a standalone `Overlay`. */
		| 'with-portal'
		/** `Trigger`, `Close`, `Title` and `Description` rendered through their `child` snippet (D-03). */
		| 'child-snippet'
		/** Mirrors the "Confirmation Dialog" preview: a `Close`-backed Cancel plus a pending action. */
		| 'confirm'
		/** Each part with no provider above it at all (FR-011). */
		| 'bare-trigger'
		| 'bare-close'
		| 'bare-portal'
		| 'bare-overlay'
		| 'bare-content'
		| 'bare-header'
		| 'bare-footer'
		| 'bare-title'
		| 'bare-description';

	/**
	 * How the harness hands `open` to the root.
	 *
	 * - `none` — uncontrolled: only `defaultOpen` is passed.
	 * - `prop` — a plain `open` prop with no binding.
	 * - `bind` — `bind:open`; the parent accepts every write and reports it.
	 * - `function` — `bind:open={() => authoritativeOpen, (next) => …}`: the parent stays
	 *   authoritative and declines the write, so the composition must not move on its own.
	 */
	export type ResponsiveDialogHarnessBinding = 'none' | 'prop' | 'bind' | 'function';

	/** The parts whose `ref` and `restProps` the harness wires up (contracts §2 guarantees 4–5). */
	export type ResponsiveDialogPartName =
		'trigger' | 'close' | 'overlay' | 'content' | 'header' | 'footer' | 'title' | 'description';

	/** Every part's bound `ref`, reported to the spec so it can compare element identity. */
	export type ResponsiveDialogHarnessRefs = Record<ResponsiveDialogPartName, HTMLElement | null>;

	export type ResponsiveDialogHarnessProps = {
		/** @default 'default' */
		mode?: ResponsiveDialogHarnessMode;
		/** @default 'none' */
		binding?: ResponsiveDialogHarnessBinding;
		/** Seeds `bind`, and is passed verbatim in `prop`. */
		open?: boolean;
		/** The value a declining parent keeps returning in `binding="function"`. */
		authoritativeOpen?: boolean;
		/** Receives every write a declining parent refuses to apply. */
		onDeclinedOpen?: (open: boolean) => void;
		defaultOpen?: boolean;
		onOpenChange?: (open: boolean) => void;
		onOpenChangeComplete?: (open: boolean) => void;
		breakpoint?: number;
		/** Additional props spread onto whichever root is active (contracts §2). */
		rootRest?: Record<string, unknown>;
		/** Forwarded to `Content`; `undefined` leaves the component default in place. */
		contentShowCloseButton?: boolean;
		/** Forwarded to `Footer`; `undefined` leaves the component default in place. */
		footerShowCloseButton?: boolean;
		/** Forwarded to `Content`'s `portalProps`. */
		contentPortalProps?: ResponsiveDialogContentProps['portalProps'];
		triggerClass?: string;
		contentClass?: string;
		headerClass?: string;
		footerClass?: string;
		titleClass?: string;
		descriptionClass?: string;
		closeClass?: string;
		overlayClass?: string;
		/** Additional attributes forwarded to `Content` through `restProps`. */
		contentRest?: Record<string, unknown>;
		/** Additional attributes forwarded to any part through `restProps`. */
		partRest?: Partial<Record<ResponsiveDialogPartName, Record<string, unknown>>>;
		/** Bound to `Content`'s `ref`. */
		contentRef?: HTMLElement | null;
		/** Called whenever any part's bound `ref` changes. */
		onRefs?: (refs: ResponsiveDialogHarnessRefs) => void;
	};
</script>

<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';

	import * as ResponsiveDialog from './index.js';

	let {
		mode = 'default',
		binding = 'none',
		open = $bindable(),
		authoritativeOpen = false,
		onDeclinedOpen,
		defaultOpen,
		onOpenChange,
		onOpenChangeComplete,
		breakpoint,
		rootRest,
		contentShowCloseButton,
		footerShowCloseButton,
		contentPortalProps,
		triggerClass,
		contentClass,
		headerClass,
		footerClass,
		titleClass,
		descriptionClass,
		closeClass,
		overlayClass,
		contentRest,
		partRest,
		contentRef = $bindable(null),
		onRefs
	}: ResponsiveDialogHarnessProps = $props();

	let triggerRef = $state<HTMLElement | null>(null);
	let closeRef = $state<HTMLElement | null>(null);
	let overlayRef = $state<HTMLElement | null>(null);
	let headerRef = $state<HTMLElement | null>(null);
	let footerRef = $state<HTMLElement | null>(null);
	let titleRef = $state<HTMLElement | null>(null);
	let descriptionRef = $state<HTMLElement | null>(null);

	/** Mirrors the preview's async confirm button: pending latches on, so a spec can observe it. */
	let isConfirming = $state(false);

	$effect(() => {
		onRefs?.({
			trigger: triggerRef,
			close: closeRef,
			overlay: overlayRef,
			content: contentRef,
			header: headerRef,
			footer: footerRef,
			title: titleRef,
			description: descriptionRef
		});
	});

	function describeRef(element: HTMLElement | null) {
		return element ? (element.dataset.slot ?? element.tagName.toLowerCase()) : 'null';
	}

	const rest = (part: ResponsiveDialogPartName) => partRest?.[part] ?? {};
</script>

{#snippet header()}
	<ResponsiveDialog.Header bind:ref={headerRef} class={headerClass} {...rest('header')}>
		{#if mode === 'child-snippet'}
			<ResponsiveDialog.Title bind:ref={titleRef} class={titleClass} {...rest('title')}>
				{#snippet child({ props })}
					<h2 {...props}>Edit profile</h2>
				{/snippet}
			</ResponsiveDialog.Title>
			<ResponsiveDialog.Description
				bind:ref={descriptionRef}
				class={descriptionClass}
				{...rest('description')}
			>
				{#snippet child({ props })}
					<p {...props}>Make changes to your profile here.</p>
				{/snippet}
			</ResponsiveDialog.Description>
		{:else}
			<ResponsiveDialog.Title bind:ref={titleRef} class={titleClass} {...rest('title')}>
				{mode === 'confirm' ? 'Delete project?' : 'Edit profile'}
			</ResponsiveDialog.Title>
			<ResponsiveDialog.Description
				bind:ref={descriptionRef}
				class={descriptionClass}
				{...rest('description')}
			>
				{mode === 'confirm'
					? 'This will permanently delete the project and all of its data.'
					: 'Make changes to your profile here.'}
			</ResponsiveDialog.Description>
		{/if}
	</ResponsiveDialog.Header>
{/snippet}

{#snippet trigger()}
	{#if mode === 'child-snippet'}
		<ResponsiveDialog.Trigger bind:ref={triggerRef} class={triggerClass} {...rest('trigger')}>
			{#snippet child({ props })}
				<Button variant="outline" {...props}>Open</Button>
			{/snippet}
		</ResponsiveDialog.Trigger>
	{:else}
		<ResponsiveDialog.Trigger bind:ref={triggerRef} class={triggerClass} {...rest('trigger')}>
			Open
		</ResponsiveDialog.Trigger>
	{/if}
{/snippet}

{#snippet close()}
	{#if mode === 'child-snippet'}
		<ResponsiveDialog.Close bind:ref={closeRef} class={closeClass} {...rest('close')}>
			{#snippet child({ props })}
				<Button variant="outline" {...props}>Done</Button>
			{/snippet}
		</ResponsiveDialog.Close>
	{:else}
		<ResponsiveDialog.Close bind:ref={closeRef} class={closeClass} {...rest('close')}>
			{mode === 'confirm' ? 'Cancel' : 'Done'}
		</ResponsiveDialog.Close>
	{/if}
{/snippet}

{#snippet body()}
	{@render trigger()}
	{#if mode === 'with-portal'}
		<ResponsiveDialog.Portal>
			<ResponsiveDialog.Overlay bind:ref={overlayRef} class={overlayClass} {...rest('overlay')} />
		</ResponsiveDialog.Portal>
	{/if}
	<ResponsiveDialog.Content
		bind:ref={contentRef}
		class={contentClass}
		showCloseButton={mode === 'no-focusable' ? false : contentShowCloseButton}
		portalProps={contentPortalProps}
		{...contentRest}
	>
		{@render header()}
		{#if mode === 'confirm'}
			<ResponsiveDialog.Footer bind:ref={footerRef} class={footerClass}>
				{@render close()}
				<Button
					variant="destructive"
					data-testid="confirm-action"
					disabled={isConfirming}
					onclick={() => (isConfirming = true)}
				>
					{#if isConfirming}
						<Spinner data-testid="confirm-pending" data-icon="inline-start" />
					{/if}
					Delete
				</Button>
			</ResponsiveDialog.Footer>
		{:else if mode !== 'no-focusable'}
			<input data-testid="first-field" aria-label="Name" />
			<input data-testid="second-field" aria-label="Username" />
			<ResponsiveDialog.Footer
				bind:ref={footerRef}
				class={footerClass}
				showCloseButton={footerShowCloseButton}
				{...rest('footer')}
			>
				{@render close()}
			</ResponsiveDialog.Footer>
		{/if}
	</ResponsiveDialog.Content>
{/snippet}

{#if mode === 'bare-trigger'}
	<ResponsiveDialog.Trigger>Open</ResponsiveDialog.Trigger>
{:else if mode === 'bare-close'}
	<ResponsiveDialog.Close>Done</ResponsiveDialog.Close>
{:else if mode === 'bare-portal'}
	<ResponsiveDialog.Portal />
{:else if mode === 'bare-overlay'}
	<ResponsiveDialog.Overlay />
{:else if mode === 'bare-content'}
	<ResponsiveDialog.Content>Content</ResponsiveDialog.Content>
{:else if mode === 'bare-header'}
	<ResponsiveDialog.Header>Header</ResponsiveDialog.Header>
{:else if mode === 'bare-footer'}
	<ResponsiveDialog.Footer>Footer</ResponsiveDialog.Footer>
{:else if mode === 'bare-title'}
	<ResponsiveDialog.Title>Title</ResponsiveDialog.Title>
{:else if mode === 'bare-description'}
	<ResponsiveDialog.Description>Description</ResponsiveDialog.Description>
{:else if binding === 'bind'}
	<ResponsiveDialog.Root
		bind:open
		{defaultOpen}
		{onOpenChange}
		{onOpenChangeComplete}
		{breakpoint}
		{...rootRest}
	>
		{@render body()}
	</ResponsiveDialog.Root>
{:else if binding === 'function'}
	<ResponsiveDialog.Root
		bind:open={() => authoritativeOpen, (next) => onDeclinedOpen?.(next)}
		{defaultOpen}
		{onOpenChange}
		{onOpenChangeComplete}
		{breakpoint}
		{...rootRest}
	>
		{@render body()}
	</ResponsiveDialog.Root>
{:else if binding === 'prop'}
	<ResponsiveDialog.Root
		{open}
		{defaultOpen}
		{onOpenChange}
		{onOpenChangeComplete}
		{breakpoint}
		{...rootRest}
	>
		{@render body()}
	</ResponsiveDialog.Root>
{:else}
	<ResponsiveDialog.Root
		{defaultOpen}
		{onOpenChange}
		{onOpenChangeComplete}
		{breakpoint}
		{...rootRest}
	>
		{@render body()}
	</ResponsiveDialog.Root>
{/if}

<span data-testid="open-report">{open === undefined ? 'undefined' : String(open)}</span>
<span data-testid="ref-report">{describeRef(contentRef)}</span>
