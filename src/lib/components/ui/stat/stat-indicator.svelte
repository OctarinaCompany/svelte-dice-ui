<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import { tv } from 'tailwind-variants';

	/** Every value `variant` accepts, in upstream declaration order. */
	export const STAT_INDICATOR_VARIANTS = ['default', 'icon', 'badge', 'action'] as const;

	/** The visual style of the indicator. */
	export type StatIndicatorVariant = (typeof STAT_INDICATOR_VARIANTS)[number];

	/** Every value `color` accepts, in upstream declaration order. */
	export const STAT_INDICATOR_COLORS = ['default', 'success', 'info', 'warning', 'error'] as const;

	/** The color theme of the indicator. */
	export type StatIndicatorColor = (typeof STAT_INDICATOR_COLORS)[number];

	/**
	 * Normalise a possibly untyped runtime value to a known variant.
	 * Anything outside {@link STAT_INDICATOR_VARIANTS} falls back to `"default"`.
	 */
	export function resolveStatIndicatorVariant(value?: string): StatIndicatorVariant {
		return STAT_INDICATOR_VARIANTS.includes(value as StatIndicatorVariant)
			? (value as StatIndicatorVariant)
			: 'default';
	}

	/**
	 * Normalise a possibly untyped runtime value to a known color.
	 * Anything outside {@link STAT_INDICATOR_COLORS} falls back to `"default"`.
	 */
	export function resolveStatIndicatorColor(value?: string): StatIndicatorColor {
		return STAT_INDICATOR_COLORS.includes(value as StatIndicatorColor)
			? (value as StatIndicatorColor)
			: 'default';
	}

	export const statIndicatorVariants = tv({
		base: 'flex shrink-0 items-center justify-center [&_svg]:pointer-events-none',
		variants: {
			variant: {
				default: "text-muted-foreground [&_svg:not([class*='size-'])]:size-5",
				icon: "size-8 rounded-md border [&_svg:not([class*='size-'])]:size-3.5",
				badge:
					"h-6 min-w-6 rounded-sm border px-1.5 text-xs font-medium [&_svg:not([class*='size-'])]:size-3",
				action:
					"size-8 cursor-pointer rounded-md transition-colors hover:bg-muted/50 [&_svg:not([class*='size-'])]:size-4"
			},
			color: {
				default: 'bg-muted text-muted-foreground',
				success: 'border-success/20 bg-success/10 text-success',
				info: 'border-info/20 bg-info/10 text-info',
				warning: 'border-warning/20 bg-warning/10 text-warning',
				error: 'border-destructive/20 bg-destructive/10 text-destructive'
			}
		},
		defaultVariants: {
			variant: 'default',
			color: 'default'
		}
	});

	export type StatIndicatorProps = Omit<WithElementRef<HTMLAttributes<HTMLDivElement>>, 'color'> & {
		/**
		 * The visual style of the indicator.
		 *
		 * - `"default"`: Simple icon without background
		 * - `"icon"`: Icon with bordered container
		 * - `"badge"`: Compact badge style with number or icon
		 * - `"action"`: Interactive button style with hover effects
		 *
		 * @default "default"
		 */
		variant?: StatIndicatorVariant;
		/**
		 * The color theme of the indicator.
		 *
		 * - `"default"`: Muted gray background
		 * - `"success"`: Green background for positive metrics
		 * - `"info"`: Blue background for informational metrics
		 * - `"warning"`: Orange background for warning metrics
		 * - `"error"`: Red background for error or critical metrics
		 *
		 * @default "default"
		 */
		color?: StatIndicatorColor;
	};
</script>

<script lang="ts">
	let {
		ref = $bindable(null),
		variant,
		color,
		class: className,
		children,
		...restProps
	}: StatIndicatorProps = $props();

	const resolvedVariant = $derived(resolveStatIndicatorVariant(variant));
	const resolvedColor = $derived(resolveStatIndicatorColor(color));
</script>

<div
	bind:this={ref}
	data-slot="stat-indicator"
	data-variant={resolvedVariant}
	data-color={resolvedColor}
	class={cn(statIndicatorVariants({ variant: resolvedVariant, color: resolvedColor }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
