<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { tv } from 'tailwind-variants';

	/** Every value `variant` accepts, in upstream declaration order. */
	export const STATUS_VARIANTS = ['default', 'success', 'error', 'warning', 'info'] as const;

	/** The visual style and color theme of the status badge. */
	export type StatusVariant = (typeof STATUS_VARIANTS)[number];

	/**
	 * Normalise a possibly untyped runtime value to a known variant.
	 * Anything outside {@link STATUS_VARIANTS} falls back to `"default"`.
	 */
	export function resolveStatusVariant(value?: string): StatusVariant {
		return STATUS_VARIANTS.includes(value as StatusVariant) ? (value as StatusVariant) : 'default';
	}

	export const statusVariants = tv({
		base: 'inline-flex w-fit shrink-0 items-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
		variants: {
			variant: {
				default:
					'border-transparent bg-muted text-muted-foreground **:data-[slot=status-indicator]:bg-muted-foreground',
				success:
					'border-success/20 bg-success/10 text-success **:data-[slot=status-indicator]:bg-success',
				error:
					'border-destructive/20 bg-destructive/10 text-destructive **:data-[slot=status-indicator]:bg-destructive',
				warning:
					'border-warning/20 bg-warning/10 text-warning **:data-[slot=status-indicator]:bg-warning',
				info: 'border-info/20 bg-info/10 text-info **:data-[slot=status-indicator]:bg-info'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	});

	/** The merged attribute payload handed to the `child` snippet. */
	export type StatusChildProps = {
		/** Always `"status"`. */
		'data-slot': 'status';
		/** The resolved variant. */
		'data-variant': StatusVariant;
		/** Variant classes with the caller's `class` merged last. */
		class: string;
	} & Record<string, unknown>;

	export type StatusRootProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		/**
		 * The visual style and color theme of the status badge.
		 *
		 * - `"default"`: Neutral muted gray styling
		 * - `"success"`: Green styling for online/active states
		 * - `"error"`: Red styling for offline/error states
		 * - `"warning"`: Orange styling for away/warning states
		 * - `"info"`: Blue styling for idle/informational states
		 *
		 * @default "default"
		 */
		variant?: StatusVariant;
		/**
		 * Render the badge onto your own element instead of the default `<div>`.
		 * The snippet receives the merged props (class, data-slot, data-variant and every
		 * forwarded attribute) to spread onto that element.
		 *
		 * Replaces upstream's `asChild` (Radix `Slot`), which has no Svelte equivalent.
		 * In `child` mode `children` is not rendered and `ref` is not populated — the
		 * caller owns the element.
		 */
		child?: Snippet<[{ props: StatusChildProps }]>;
	};
</script>

<script lang="ts">
	let {
		ref = $bindable(null),
		variant = 'default',
		class: className,
		children,
		child,
		...restProps
	}: StatusRootProps = $props();

	const resolved = $derived(resolveStatusVariant(variant));

	// Built once and shared by both branches, so a `child` element is styled exactly like the
	// default `<div>`. `class` can never arrive through `restProps` — it is destructured out — so
	// the computed class always wins, matching upstream's `{...rootProps} className={cn(...)}`.
	const rootAttrs: StatusChildProps = $derived({
		'data-slot': 'status',
		'data-variant': resolved,
		class: cn(statusVariants({ variant: resolved }), className),
		...restProps
	});
</script>

{#if child}
	{@render child({ props: rootAttrs })}
{:else}
	<div bind:this={ref} {...rootAttrs}>
		{@render children?.()}
	</div>
{/if}
