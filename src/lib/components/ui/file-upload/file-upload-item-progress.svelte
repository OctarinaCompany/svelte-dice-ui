<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	export type FileUploadItemProgressVariant = 'linear' | 'circular' | 'fill';

	/** The merged attribute payload handed to the `child` snippet. */
	export type FileUploadItemProgressChildProps = {
		role: 'progressbar';
		'data-slot': 'file-upload-progress';
		'aria-valuenow': number;
		class: string;
	} & Record<string, unknown>;

	export type FileUploadItemProgressProps = WithElementRef<
		HTMLAttributes<HTMLDivElement>,
		HTMLDivElement
	> & {
		/**
		 * Which presentation the same progress value is drawn in.
		 *
		 * @default "linear"
		 */
		variant?: FileUploadItemProgressVariant;
		/**
		 * Diameter of the `circular` variant, in pixels. Ignored by the other variants.
		 *
		 * @default 40
		 */
		size?: number;
		/**
		 * Whether the progress bar should stay mounted once the file reaches 100%.
		 *
		 * @default false
		 */
		forceMount?: boolean;
		/**
		 * Render the progress bar onto your own element instead of the default `<div>`. The snippet
		 * receives the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild` (Radix `Slot`). In `child` mode `ref` stays `null` — the caller
		 * owns the element and draws its own indicator.
		 */
		child?: Snippet<[{ props: FileUploadItemProgressChildProps }]>;
	};
</script>

<script lang="ts">
	import { getFileUploadItemContext } from './file-upload.svelte.js';

	let {
		ref = $bindable(null),
		variant = 'linear',
		size = 40,
		forceMount = false,
		class: className,
		child,
		...restProps
	}: FileUploadItemProgressProps = $props();

	const item = getFileUploadItemContext('ItemProgress');

	const progress = $derived(item.fileState?.progress ?? 0);
	const present = $derived(item.fileState !== undefined && (forceMount || progress !== 100));

	/** Upstream's geometry: a two-pixel inset on each side, drawn from twelve o'clock. */
	const radius = $derived((size - 4) / 2);
	const circumference = $derived(2 * Math.PI * radius);
	const dashOffset = $derived(circumference - (progress / 100) * circumference);

	const variantClass = $derived(
		{
			circular: 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
			fill: 'absolute inset-0 bg-primary/50 transition-[clip-path] duration-300 ease-linear',
			linear: 'relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20'
		}[variant]
	);

	const progressAttrs = $derived({
		role: 'progressbar',
		'aria-valuemin': 0,
		'aria-valuemax': 100,
		'aria-valuenow': progress,
		'aria-valuetext': `${progress}%`,
		'aria-labelledby': item.nameId,
		'data-slot': 'file-upload-progress',
		...restProps,
		class: cn(variantClass, className),
		style: variant === 'fill' ? `clip-path: inset(${100 - progress}% 0% 0% 0%);` : restProps.style
	} as FileUploadItemProgressChildProps);
</script>

{#if present}
	{#if child}
		{@render child({ props: progressAttrs })}
	{:else if variant === 'circular'}
		<div bind:this={ref} {...progressAttrs}>
			<svg
				class="-rotate-90 transform"
				width={size}
				height={size}
				viewBox="0 0 {size} {size}"
				fill="none"
				stroke="currentColor"
			>
				<circle class="text-primary/20" stroke-width="2" cx={size / 2} cy={size / 2} r={radius} />
				<circle
					class="text-primary transition-[stroke-dashoffset] duration-300 ease-linear"
					stroke-width="2"
					stroke-linecap="round"
					stroke-dasharray={circumference}
					stroke-dashoffset={dashOffset}
					cx={size / 2}
					cy={size / 2}
					r={radius}
				/>
			</svg>
		</div>
	{:else if variant === 'fill'}
		<div bind:this={ref} {...progressAttrs}></div>
	{:else}
		<div bind:this={ref} {...progressAttrs}>
			<div
				class="h-full w-full flex-1 bg-primary transition-transform duration-300 ease-linear"
				style="transform: translateX(-{100 - progress}%);"
			></div>
		</div>
	{/if}
{/if}
