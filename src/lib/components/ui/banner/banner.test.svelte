<script lang="ts" module>
	import type { BannerSide, BannerStrategy, BannerVariant } from './index.js';

	/**
	 * Which single path this render exercises. A `.ts` spec cannot express `{#snippet child({ props })}`,
	 * `bind:ref`, a part with no provider ancestor, or a declarative `<Banner>` registered inside
	 * `<Banner.Queue>`, so everything needing a real component tree goes through this file. It is not
	 * collected by Vitest (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type BannerHarnessMode = 'standalone' | 'bare-close' | 'bare-queue-controls' | 'queue';

	/** One `<Banner.Root>` rendered inside the `queue` mode's `<Banner.Queue>`. */
	export type BannerHarnessSpec = {
		key: string;
		/** Toggle to `false` on a rerender to unmount (destroy) this banner. @default true */
		mounted?: boolean;
		variant?: BannerVariant;
		priority?: number;
		duration?: number;
		dismissible?: boolean;
	};

	export type BannerHarnessEvent =
		{ key: string; type: 'openChange'; open: boolean } | { key: string; type: 'dismiss' };

	/** Every `bind:ref` the harness captures, reported through {@link BannerHarnessProps.onRefs}. */
	export type BannerHarnessRefs = {
		root: HTMLDivElement | null;
		icon: HTMLDivElement | null;
		content: HTMLDivElement | null;
		title: HTMLDivElement | null;
		description: HTMLDivElement | null;
		actions: HTMLDivElement | null;
		close: HTMLButtonElement | null;
	};

	export type BannerHarnessProps = {
		mode?: BannerHarnessMode;
		// standalone
		open?: boolean;
		defaultOpen?: boolean;
		onOpenChange?: (open: boolean) => void;
		onDismiss?: () => void;
		variant?: BannerVariant;
		priority?: number;
		duration?: number;
		dismissible?: boolean;
		rootChild?: boolean;
		iconChild?: boolean;
		contentChild?: boolean;
		actionsChild?: boolean;
		withActionButton?: boolean;
		closeDisabled?: boolean;
		closeAriaLabel?: string;
		closeChildren?: boolean;
		onCloseClick?: (event: MouseEvent) => void;
		dir?: 'ltr' | 'rtl';
		// queue
		maxVisible?: number;
		side?: BannerSide;
		strategy?: BannerStrategy;
		container?: Element | string | null;
		specs?: BannerHarnessSpec[];
		onQueueEvent?: (event: BannerHarnessEvent) => void;
		onRefs?: (refs: BannerHarnessRefs) => void;
	};
</script>

<script lang="ts">
	import * as Banner from './index.js';
	import { getBannersContext } from './banner.svelte.js';

	let {
		mode = 'standalone',
		open = $bindable(),
		defaultOpen,
		onOpenChange,
		onDismiss,
		variant,
		priority,
		duration,
		dismissible,
		rootChild = false,
		iconChild = false,
		contentChild = false,
		actionsChild = false,
		withActionButton = false,
		closeDisabled,
		closeAriaLabel,
		closeChildren = false,
		onCloseClick,
		dir = 'ltr',
		maxVisible,
		side,
		strategy,
		container,
		specs = [],
		onQueueEvent,
		onRefs
	}: BannerHarnessProps = $props();

	// No `<Banner.Queue>` ancestor in this mode — reproduces a consumer calling the hook outside a
	// provider, which must throw during this component's own initialisation.
	if (mode === 'bare-queue-controls') {
		getBannersContext('<BannerControls>');
	}

	let refs: BannerHarnessRefs = $state({
		root: null,
		icon: null,
		content: null,
		title: null,
		description: null,
		actions: null,
		close: null
	});

	$effect(() => {
		onRefs?.(refs);
	});
</script>

{#snippet rootChildSnippet({ props }: { props: Banner.BannerChildProps })}
	<section data-testid="root-child" {...props as Record<string, unknown>}>
		{@render bannerBody()}
	</section>
{/snippet}

{#snippet iconChildSnippet({ props }: { props: Banner.BannerIconChildProps })}
	<span data-testid="icon-child" {...props as Record<string, unknown>}>icon</span>
{/snippet}

{#snippet contentChildSnippet({ props }: { props: Banner.BannerContentChildProps })}
	<section data-testid="content-child" {...props as Record<string, unknown>}>
		<Banner.Title bind:ref={refs.title}>Title</Banner.Title>
		<Banner.Description bind:ref={refs.description}>Description</Banner.Description>
	</section>
{/snippet}

{#snippet actionsChildSnippet({ props }: { props: Banner.BannerActionsChildProps })}
	<span data-testid="actions-child" {...props as Record<string, unknown>}>
		{@render actionsBody()}
	</span>
{/snippet}

{#snippet actionsBody()}
	{#if withActionButton}
		<button type="button" data-testid="action-button">Action</button>
	{/if}
	{#if closeChildren}
		<Banner.Close
			bind:ref={refs.close}
			disabled={closeDisabled}
			aria-label={closeAriaLabel}
			onclick={onCloseClick}
		>
			<span data-testid="close-children">x</span>
		</Banner.Close>
	{:else}
		<Banner.Close
			bind:ref={refs.close}
			disabled={closeDisabled}
			aria-label={closeAriaLabel}
			onclick={onCloseClick}
		/>
	{/if}
{/snippet}

{#snippet bannerBody()}
	{#if iconChild}
		<Banner.Icon child={iconChildSnippet} />
	{:else}
		<Banner.Icon bind:ref={refs.icon}><span data-testid="icon">i</span></Banner.Icon>
	{/if}
	{#if contentChild}
		<Banner.Content child={contentChildSnippet} />
	{:else}
		<Banner.Content bind:ref={refs.content}>
			<Banner.Title bind:ref={refs.title}>Title</Banner.Title>
			<Banner.Description bind:ref={refs.description}>Description</Banner.Description>
		</Banner.Content>
	{/if}
	{#if actionsChild}
		<Banner.Actions child={actionsChildSnippet} />
	{:else}
		<Banner.Actions bind:ref={refs.actions}>
			{@render actionsBody()}
		</Banner.Actions>
	{/if}
{/snippet}

{#if mode === 'bare-close'}
	<Banner.Close
		bind:ref={refs.close}
		disabled={closeDisabled}
		aria-label={closeAriaLabel}
		onclick={onCloseClick}
	>
		{#if closeChildren}
			<span data-testid="close-children">x</span>
		{/if}
	</Banner.Close>
{:else if mode === 'queue'}
	<Banner.Queue {maxVisible} {side} {strategy} {container}>
		{#each specs as spec (spec.key)}
			{#if spec.mounted ?? true}
				<Banner.Root
					variant={spec.variant}
					priority={spec.priority}
					duration={spec.duration}
					dismissible={spec.dismissible}
					onOpenChange={(next) => onQueueEvent?.({ key: spec.key, type: 'openChange', open: next })}
					onDismiss={() => onQueueEvent?.({ key: spec.key, type: 'dismiss' })}
				>
					<Banner.Icon><span data-testid={`icon-${spec.key}`}>i</span></Banner.Icon>
					<Banner.Content>
						<Banner.Title>Title {spec.key}</Banner.Title>
						<Banner.Description>Description {spec.key}</Banner.Description>
					</Banner.Content>
					<Banner.Actions>
						<Banner.Close data-testid={`close-${spec.key}`} />
					</Banner.Actions>
				</Banner.Root>
			{/if}
		{/each}
	</Banner.Queue>
{:else if mode !== 'bare-queue-controls'}
	<div {dir}>
		{#if rootChild}
			<Banner.Root
				bind:open
				{defaultOpen}
				{onOpenChange}
				{onDismiss}
				{variant}
				{priority}
				{duration}
				{dismissible}
				child={rootChildSnippet}
			/>
		{:else}
			<Banner.Root
				bind:ref={refs.root}
				bind:open
				{defaultOpen}
				{onOpenChange}
				{onDismiss}
				{variant}
				{priority}
				{duration}
				{dismissible}
			>
				{@render bannerBody()}
			</Banner.Root>
		{/if}
	</div>
{/if}
