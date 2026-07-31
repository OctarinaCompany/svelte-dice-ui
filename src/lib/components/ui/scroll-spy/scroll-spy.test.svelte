<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/direction-provider.svelte.js';

	import type { ScrollSpyChildProps } from './scroll-spy.svelte';
	import type { ScrollSpyLinkChildProps } from './scroll-spy-link.svelte';
	import type { ScrollSpyNavChildProps } from './scroll-spy-nav.svelte';
	import type { ScrollSpySectionChildProps } from './scroll-spy-section.svelte';
	import type { ScrollSpyViewportChildProps } from './scroll-spy-viewport.svelte';
	import type { ScrollSpyOrientation, ScrollSpyScrollBehavior } from './scroll-spy.svelte.js';

	/**
	 * Which single path this render exercises: the plain tree, one of the five parts rendered through
	 * its `child` snippet, a part rendered with no `<ScrollSpy.Root>` ancestor (guard rail), or a root
	 * wrapped in a `<DirectionProvider>`.
	 *
	 * A `.ts` spec cannot express `{#snippet child({ props })}`, `bind:ref`, parent-owned controlled
	 * state, or a part with no provider ancestor, so everything needing a real parent component goes
	 * through this file. It is not collected by Vitest (`include` is `.{js,ts}`) and is not listed in
	 * `registry.json`.
	 */
	export type ScrollSpyHarnessMode =
		| 'default'
		| 'root-child'
		| 'nav-child'
		| 'link-child'
		| 'viewport-child'
		| 'section-child'
		| 'bare-part'
		| 'rtl-provider';

	/** Which part `bare-part` mode renders outside a root. */
	export type ScrollSpyHarnessPart = 'Nav' | 'Link' | 'Viewport' | 'Section';

	/** Every `bind:ref` the harness captures, so a `.ts` spec can assert on them. */
	export type ScrollSpyHarnessRefs = {
		root: HTMLDivElement | null;
		nav: HTMLElement | null;
		link: HTMLAnchorElement | null;
		viewport: HTMLDivElement | null;
		section: HTMLDivElement | null;
	};

	/**
	 * Imperative handle published during initialisation. It exists so a spec can change parent-owned
	 * state (the controlled `value`, the rendered section list) *without* `rerender()`, which
	 * invalidates props and would wipe the root's uncontrolled internal value (research R-06).
	 */
	export type ScrollSpyHarnessApi = {
		/** Move the harness-owned controlled `value`. Only meaningful with `controlled`. */
		setValue: (value: string) => void;
		/** Replace the rendered section/link ids, so sections mount and unmount after first paint. */
		setSections: (ids: string[]) => void;
		/** Read the currently captured refs. */
		getRefs: () => ScrollSpyHarnessRefs;
	};

	export type ScrollSpyHarnessProps = {
		mode?: ScrollSpyHarnessMode;
		/** Section ids rendered as links and as sections, in document order. */
		sections?: string[];
		/** Render an extra `<ScrollSpy.Section value="">` after the listed ones (FR-012). */
		emptySection?: boolean;
		/** Render an extra link whose `value` matches no rendered section. */
		orphanLink?: string;
		/**
		 * Make the root controlled through `bind:value={() => …, (next) => …}`: the harness stays
		 * authoritative and declines every write the component attempts, so nothing moves until
		 * {@link ScrollSpyHarnessApi.setValue} is called.
		 */
		controlled?: boolean;
		/** Seeds the harness-owned controlled value. */
		initialValue?: string;
		defaultValue?: string;
		orientation?: ScrollSpyOrientation;
		offset?: number;
		threshold?: number | number[];
		rootMargin?: string;
		scrollBehavior?: ScrollSpyScrollBehavior;
		/** Hand the viewport element to the root as its `scrollContainer`. */
		useViewportAsContainer?: boolean;
		dir?: Direction;
		/** The `dir` the `rtl-provider` mode's `<DirectionProvider>` publishes. */
		providerDir?: Direction;
		class?: string;
		navLabel?: string;
		'data-testid'?: string;
		onValueChange?: (value: string) => void;
		/** Receives every write the authoritative parent refuses to apply in `controlled` mode. */
		onDeclinedValue?: (value: string) => void;
		/** Integrator-supplied `onclick`, attached to the second link only. */
		onLinkClick?: () => void;
		/** Which part `bare-part` mode renders. */
		barePart?: ScrollSpyHarnessPart;
		registerApi?: (api: ScrollSpyHarnessApi) => void;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';

	import * as ScrollSpy from './index.js';

	let {
		mode = 'default',
		sections = ['section1', 'section2', 'section3'],
		emptySection = false,
		orphanLink,
		controlled = false,
		initialValue = 'section1',
		defaultValue,
		orientation,
		offset,
		threshold,
		rootMargin,
		scrollBehavior,
		useViewportAsContainer = false,
		dir,
		providerDir = 'rtl',
		class: className,
		navLabel = 'Sections',
		'data-testid': dataTestId,
		onValueChange,
		onDeclinedValue,
		onLinkClick,
		barePart = 'Link',
		registerApi
	}: ScrollSpyHarnessProps = $props();

	let rootRef = $state<HTMLDivElement | null>(null);
	let navRef = $state<HTMLElement | null>(null);
	let linkRef = $state<HTMLAnchorElement | null>(null);
	let viewportRef = $state<HTMLDivElement | null>(null);
	let sectionRef = $state<HTMLDivElement | null>(null);

	let sectionIds = $state<string[]>([...sections]);
	let controlledValue = $state(initialValue);

	registerApi?.({
		setValue: (next: string) => {
			controlledValue = next;
		},
		setSections: (next: string[]) => {
			sectionIds = next;
		},
		getRefs: () => ({
			root: rootRef,
			nav: navRef,
			link: linkRef,
			viewport: viewportRef,
			section: sectionRef
		})
	});
</script>

{#snippet navChild({ props }: { props: ScrollSpyNavChildProps })}
	<nav {...props as Record<string, unknown>} data-testid="nav-child" aria-label={navLabel}>
		{@render links()}
	</nav>
{/snippet}

{#snippet linkChild({ props }: { props: ScrollSpyLinkChildProps })}
	<button type="button" {...props as Record<string, unknown>} data-testid="link-child">
		Custom {sectionIds[0]}
	</button>
{/snippet}

{#snippet viewportChild({ props }: { props: ScrollSpyViewportChildProps })}
	<div {...props as Record<string, unknown>} data-testid="viewport-child">
		{@render sectionList()}
	</div>
{/snippet}

{#snippet sectionChild({ props }: { props: ScrollSpySectionChildProps })}
	<section {...props as Record<string, unknown>} data-testid="section-child">
		<h2>{sectionIds[0]}</h2>
	</section>
{/snippet}

{#snippet links()}
	{#each sectionIds as id, index (id)}
		{#if index === 0}
			<ScrollSpy.Link
				bind:ref={linkRef}
				value={id}
				child={mode === 'link-child' ? linkChild : undefined}
			>
				{id}
			</ScrollSpy.Link>
		{:else if index === 1}
			<ScrollSpy.Link value={id} onclick={onLinkClick}>{id}</ScrollSpy.Link>
		{:else}
			<ScrollSpy.Link value={id}>{id}</ScrollSpy.Link>
		{/if}
	{/each}
	{#if orphanLink}
		<ScrollSpy.Link value={orphanLink} data-testid="orphan-link">{orphanLink}</ScrollSpy.Link>
	{/if}
{/snippet}

{#snippet sectionList()}
	{#each sectionIds as id, index (id)}
		{#if index === 0}
			<ScrollSpy.Section
				bind:ref={sectionRef}
				value={id}
				child={mode === 'section-child' ? sectionChild : undefined}
			>
				<h2>{id}</h2>
			</ScrollSpy.Section>
		{:else}
			<ScrollSpy.Section value={id}>
				<h2>{id}</h2>
			</ScrollSpy.Section>
		{/if}
	{/each}
	{#if emptySection}
		<ScrollSpy.Section value="" data-testid="empty-section">
			<h2>empty</h2>
		</ScrollSpy.Section>
	{/if}
{/snippet}

{#snippet content()}
	<ScrollSpy.Nav
		bind:ref={navRef}
		aria-label={navLabel}
		child={mode === 'nav-child' ? navChild : undefined}
	>
		{@render links()}
	</ScrollSpy.Nav>
	<ScrollSpy.Viewport
		bind:ref={viewportRef}
		child={mode === 'viewport-child' ? viewportChild : undefined}
	>
		{@render sectionList()}
	</ScrollSpy.Viewport>
{/snippet}

{#snippet rootChild({ props }: { props: ScrollSpyChildProps })}
	<div {...props as Record<string, unknown>} data-testid="root-child">
		{@render content()}
	</div>
{/snippet}

{#snippet root()}
	{#if controlled}
		<ScrollSpy.Root
			bind:ref={rootRef}
			bind:value={() => controlledValue, (next: string) => onDeclinedValue?.(next)}
			{defaultValue}
			{onValueChange}
			{orientation}
			{offset}
			{threshold}
			{rootMargin}
			{scrollBehavior}
			scrollContainer={useViewportAsContainer ? viewportRef : null}
			{dir}
			class={className}
			data-testid={dataTestId}
			child={mode === 'root-child' ? rootChild : undefined}
		>
			{@render content()}
		</ScrollSpy.Root>
	{:else}
		<ScrollSpy.Root
			bind:ref={rootRef}
			{defaultValue}
			{onValueChange}
			{orientation}
			{offset}
			{threshold}
			{rootMargin}
			{scrollBehavior}
			scrollContainer={useViewportAsContainer ? viewportRef : null}
			{dir}
			class={className}
			data-testid={dataTestId}
			child={mode === 'root-child' ? rootChild : undefined}
		>
			{@render content()}
		</ScrollSpy.Root>
	{/if}
{/snippet}

{#if mode === 'bare-part'}
	{#if barePart === 'Nav'}
		<ScrollSpy.Nav />
	{:else if barePart === 'Link'}
		<ScrollSpy.Link value="section1" />
	{:else if barePart === 'Viewport'}
		<ScrollSpy.Viewport />
	{:else}
		<ScrollSpy.Section value="section1" />
	{/if}
{:else if mode === 'rtl-provider'}
	<DirectionProvider dir={providerDir}>
		{@render root()}
	</DirectionProvider>
{:else}
	{@render root()}
{/if}
