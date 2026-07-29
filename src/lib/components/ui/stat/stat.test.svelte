<script lang="ts" module>
	/**
	 * Props of the prop-driven test harness used by `stat.test.ts`.
	 *
	 * A `.ts` spec cannot express `bind:ref` or the `DropdownMenu.Trigger` composition, so anything
	 * that needs real markup goes through this file. It is not collected by Vitest (`include` is
	 * `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type StatHarnessProps = {
		/** Render `Stat.Label` with this text. */
		label?: string;
		/** Render `Stat.Value` with this text. */
		value?: string;
		/** Render `Stat.Indicator` when set. */
		showIndicator?: boolean;
		/** Forwarded to `Stat.Indicator`. */
		indicatorVariant?: 'default' | 'icon' | 'badge' | 'action';
		/** Forwarded to `Stat.Indicator`. */
		indicatorColor?: 'default' | 'success' | 'info' | 'warning' | 'error';
		/** Render `Stat.Trend` when set. */
		showTrend?: boolean;
		/** Forwarded to `Stat.Trend`. */
		trend?: 'up' | 'down' | 'neutral';
		/** Render `Stat.Separator` when set. */
		showSeparator?: boolean;
		/** Render `Stat.Description` with this text. */
		description?: string;
		/** Render the "action" indicator as the content of a `DropdownMenu.Trigger`. */
		useActionMenu?: boolean;
		/** `aria-label` of the `DropdownMenu.Trigger` in `useActionMenu` mode. */
		triggerLabel?: string;
		/** Bound to `Stat.Root`'s `ref`. */
		rootRef?: HTMLDivElement | null;
		/** Bound to `Stat.Label`'s `ref`. */
		labelRef?: HTMLDivElement | null;
		/** Bound to `Stat.Indicator`'s `ref`. */
		indicatorRef?: HTMLDivElement | null;
		/** Bound to `Stat.Value`'s `ref`. */
		valueRef?: HTMLDivElement | null;
		/** Bound to `Stat.Trend`'s `ref`. */
		trendRef?: HTMLDivElement | null;
		/** Bound to `Stat.Separator`'s `ref`. */
		separatorRef?: HTMLDivElement | null;
		/** Bound to `Stat.Description`'s `ref`. */
		descriptionRef?: HTMLDivElement | null;
	};
</script>

<script lang="ts">
	import * as Stat from './index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';

	let {
		label,
		value,
		showIndicator = false,
		indicatorVariant,
		indicatorColor,
		showTrend = false,
		trend,
		showSeparator = false,
		description,
		useActionMenu = false,
		triggerLabel = 'Conversion rate actions',
		rootRef = $bindable(null),
		labelRef = $bindable(null),
		indicatorRef = $bindable(null),
		valueRef = $bindable(null),
		trendRef = $bindable(null),
		separatorRef = $bindable(null),
		descriptionRef = $bindable(null)
	}: StatHarnessProps = $props();

	function describeRef(element: HTMLElement | null) {
		return element ? element.tagName.toLowerCase() : 'null';
	}

	const refReport = $derived(
		`root:${describeRef(rootRef)} label:${describeRef(labelRef)} indicator:${describeRef(indicatorRef)} value:${describeRef(valueRef)} trend:${describeRef(trendRef)} separator:${describeRef(separatorRef)} description:${describeRef(descriptionRef)}`
	);
</script>

<Stat.Root bind:ref={rootRef}>
	{#if label !== undefined}
		<Stat.Label bind:ref={labelRef}>{label}</Stat.Label>
	{/if}
	{#if showIndicator}
		{#if useActionMenu}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger aria-label={triggerLabel}>
					<Stat.Indicator variant="action" bind:ref={indicatorRef}>⋯</Stat.Indicator>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					<DropdownMenu.Item>View details</DropdownMenu.Item>
					<DropdownMenu.Item>Export data</DropdownMenu.Item>
					<DropdownMenu.Item>Share</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{:else}
			<Stat.Indicator variant={indicatorVariant} color={indicatorColor} bind:ref={indicatorRef} />
		{/if}
	{/if}
	{#if value !== undefined}
		<Stat.Value bind:ref={valueRef}>{value}</Stat.Value>
	{/if}
	{#if showTrend}
		<Stat.Trend {trend} bind:ref={trendRef}>{trend ?? 'no change'}</Stat.Trend>
	{/if}
	{#if showSeparator}
		<Stat.Separator bind:ref={separatorRef} />
	{/if}
	{#if description !== undefined}
		<Stat.Description bind:ref={descriptionRef}>{description}</Stat.Description>
	{/if}
</Stat.Root>

<span data-testid="ref-report">{refReport}</span>
