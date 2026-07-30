<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { BadgeOverflowChildProps } from './index.js';

	/** An object item, used for the `getBadgeLabel`-is-required branch of research R-03. */
	export type BadgeOverflowHarnessTag = { label: string; value: string };

	/**
	 * Props of the prop-driven test harness used by `badge-overflow.test.ts`.
	 *
	 * A `.ts` spec cannot express `bind:`, a `{#snippet badge(item, label)}` with parameters, a
	 * `{#snippet child({ props, content })}` payload, or a `dir="rtl"` wrapper, so everything that
	 * needs a real parent component goes through this file. It is not collected by Vitest
	 * (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 *
	 * `items` is typed `unknown[]` rather than a generic `T[]` on purpose: `unknown extends object`
	 * is `false`, so the conditional-required `getBadgeLabel` (research R-03) stays *optional* here
	 * and one harness can drive the string, number, object and `null` runtime cases alike. The two
	 * concrete branches of that conditional type are exercised separately by `typingExercise`.
	 */
	export type BadgeOverflowHarnessProps = {
		/** Forwarded to `BadgeOverflow.Root`. */
		items?: unknown[];
		/** Forwarded to `BadgeOverflow.Root`. */
		getBadgeLabel?: (item: unknown) => string;
		/** Forwarded to `BadgeOverflow.Root`. */
		lineCount?: number;
		/** Forwarded to `BadgeOverflow.Root` as its `class`. */
		class?: string;
		/** Forwarded to `BadgeOverflow.Root` as its `style`. */
		style?: string;
		/** Forwarded to `BadgeOverflow.Root` through `restProps`. */
		id?: string;
		/** Forwarded to `BadgeOverflow.Root` through `restProps`. */
		'data-testid'?: string;
		/** Forwarded to `BadgeOverflow.Root` through `restProps`. */
		onclick?: (event: MouseEvent) => void;
		/** Render each badge as a focusable `<button>` instead of a `<span>`. */
		interactiveBadges?: boolean;
		/** Supply a custom `overflow` snippet instead of letting the built-in indicator render. */
		customOverflow?: boolean;
		/** Render the container through the `child` snippet onto a `<section>`. */
		useChild?: boolean;
		/** Wrap the harness in `<div dir="rtl">`. */
		rtl?: boolean;
		/** Also render research R-03's two conditional-typing branches (compile-time only). */
		typingExercise?: boolean;
		/** Bound to `BadgeOverflow.Root`'s `ref`. */
		ref?: HTMLDivElement | null;
	};
</script>

<script lang="ts">
	import * as BadgeOverflow from './index.js';

	let {
		items = [],
		getBadgeLabel,
		lineCount,
		class: className,
		style,
		id,
		'data-testid': dataTestId,
		onclick,
		interactiveBadges = false,
		customOverflow = false,
		useChild = false,
		rtl = false,
		typingExercise = false,
		ref = $bindable(null)
	}: BadgeOverflowHarnessProps = $props();

	const typedTags = ['React', 'TypeScript'];
	const typedObjects: BadgeOverflowHarnessTag[] = [{ label: 'React', value: 'react' }];
</script>

{#snippet spanBadge(_item: unknown, label: string)}
	<span data-testid="badge" data-label={label}>{label}</span>
{/snippet}

{#snippet buttonBadge(_item: unknown, label: string)}
	<button type="button" data-testid="badge" data-label={label}>{label}</button>
{/snippet}

{#snippet customIndicator(count: number)}
	<span data-testid="custom-overflow" data-count={count}>+{count} more</span>
{/snippet}

{#snippet asSection({ props, content }: { props: BadgeOverflowChildProps; content: Snippet })}
	<section {...props as Record<string, unknown>} data-testid="child-root">
		{@render content()}
	</section>
{/snippet}

{#snippet root()}
	<BadgeOverflow.Root
		bind:ref
		{items}
		{getBadgeLabel}
		{lineCount}
		class={className}
		{style}
		{id}
		data-testid={dataTestId}
		{onclick}
		badge={interactiveBadges ? buttonBadge : spanBadge}
		overflow={customOverflow ? customIndicator : undefined}
		child={useChild ? asSection : undefined}
	/>
{/snippet}

{#if rtl}
	<div dir="rtl">
		{@render root()}
	</div>
{:else}
	{@render root()}
{/if}

{#if typingExercise}
	<!-- Primitive array: `getBadgeLabel` must stay optional (research R-03). -->
	<BadgeOverflow.Root items={typedTags} badge={spanBadge} />
	<!-- Object array: `getBadgeLabel` must be required (research R-03). -->
	<BadgeOverflow.Root items={typedObjects} getBadgeLabel={(tag) => tag.label} badge={spanBadge} />
{/if}
