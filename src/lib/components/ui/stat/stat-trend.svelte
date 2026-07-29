<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import { tv } from 'tailwind-variants';

	/** Every value `trend` accepts, in upstream declaration order. */
	export const STAT_TREND_DIRECTIONS = ['up', 'down', 'neutral'] as const;

	/** The trend direction. */
	export type StatTrendDirection = (typeof STAT_TREND_DIRECTIONS)[number];

	/**
	 * Normalise a possibly untyped runtime value to a known direction.
	 * Anything outside {@link STAT_TREND_DIRECTIONS} falls back to `"neutral"`.
	 */
	export function resolveStatTrendDirection(value?: string): StatTrendDirection {
		return STAT_TREND_DIRECTIONS.includes(value as StatTrendDirection)
			? (value as StatTrendDirection)
			: 'neutral';
	}

	export const statTrendVariants = tv({
		base: "inline-flex items-center gap-1 text-xs font-medium [&_svg:not([class*='size-'])]:size-3 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		variants: {
			trend: {
				up: 'text-success',
				down: 'text-destructive',
				neutral: 'text-muted-foreground'
			}
		},
		defaultVariants: {
			trend: 'neutral'
		}
	});

	export type StatTrendProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		/**
		 * The trend direction to display with appropriate styling.
		 *
		 * - `"up"`: Shows positive trend with green color
		 * - `"down"`: Shows negative trend with red color
		 * - `"neutral"`: Shows neutral trend with muted color
		 */
		trend?: StatTrendDirection;
	};
</script>

<script lang="ts">
	let {
		ref = $bindable(null),
		trend,
		class: className,
		children,
		...restProps
	}: StatTrendProps = $props();

	const resolvedTrend = $derived(resolveStatTrendDirection(trend));
</script>

<div
	bind:this={ref}
	data-slot="stat-trend"
	data-trend={trend ? resolvedTrend : undefined}
	class={cn(statTrendVariants({ trend: resolvedTrend }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
