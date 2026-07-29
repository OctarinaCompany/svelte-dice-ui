<script lang="ts" module>
	import type { MouseEventHandler } from 'svelte/elements';
	import type { StatusVariant } from './index.js';

	/**
	 * Props of the prop-driven test harness used by `status.test.ts`.
	 *
	 * A `.ts` spec cannot express `bind:` or a `{#snippet child({ props })}` with props, so
	 * everything that needs a real parent component goes through this file. It is not collected by
	 * Vitest (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type StatusHarnessProps = {
		/** Forwarded to `Status.Root`. */
		variant?: StatusVariant;
		/** Forwarded to `Status.Root` as its `class`. */
		class?: string;
		/** Text rendered inside `Status.Label`. */
		label?: string;
		/** Render a `Status.Indicator`. */
		showIndicator?: boolean;
		/** Render a `Status.Label`. */
		showLabel?: boolean;
		/** Render through the `child` snippet instead of the default `<div>`. */
		useChild?: boolean;
		/** Render through the `child` snippet onto a `<button>` instead of an `<a>`. */
		useButton?: boolean;
		/** `href` of the anchor the `child` snippet renders. */
		href?: string;
		/** Forwarded to `Status.Root` through `restProps`. */
		onclick?: MouseEventHandler<HTMLDivElement>;
		/** Bound to `Status.Root`'s `ref`. */
		rootRef?: HTMLDivElement | null;
		/** Bound to `Status.Indicator`'s `ref`. */
		indicatorRef?: HTMLDivElement | null;
		/** Bound to `Status.Label`'s `ref`. */
		labelRef?: HTMLDivElement | null;
	};
</script>

<script lang="ts">
	import * as Status from './index.js';

	let {
		variant,
		class: className,
		label = 'Online',
		showIndicator = true,
		showLabel = true,
		useChild = false,
		useButton = false,
		href = '/status',
		onclick,
		rootRef = $bindable(null),
		indicatorRef = $bindable(null),
		labelRef = $bindable(null)
	}: StatusHarnessProps = $props();

	function describeRef(element: HTMLElement | null) {
		return element ? element.tagName.toLowerCase() : 'null';
	}

	// The bound refs are reported into the DOM so a `.ts` spec can assert on them: a `$bindable`
	// prop of the harness is not readable from `render()`'s return value.
	const refReport = $derived(
		`root:${describeRef(rootRef)} indicator:${describeRef(indicatorRef)} label:${describeRef(labelRef)}`
	);
</script>

{#snippet parts()}
	{#if showIndicator}
		<Status.Indicator bind:ref={indicatorRef} />
	{/if}
	{#if showLabel}
		<Status.Label bind:ref={labelRef}>{label}</Status.Label>
	{/if}
{/snippet}

{#snippet childElement({ props }: { props: Status.StatusChildProps })}
	<a {href} {...props}>{@render parts()}</a>
{/snippet}

{#snippet buttonElement({ props }: { props: Status.StatusChildProps })}
	<button type="button" {...props}>{@render parts()}</button>
{/snippet}

<Status.Root
	{variant}
	{onclick}
	class={className}
	child={useChild ? childElement : useButton ? buttonElement : undefined}
	bind:ref={rootRef}
>
	{@render parts()}
</Status.Root>

<span data-testid="ref-report">{refReport}</span>
