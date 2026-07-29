<script lang="ts" module>
	import { cn } from '$lib/utils.js';
	import type { SVGAttributes } from 'svelte/elements';
	import { getGaugeContext } from './gauge.svelte.js';

	/**
	 * `WithElementRef<T, U extends HTMLElement>` cannot express an `SVGPathElement`, so the ref is
	 * declared locally (research.md R-12).
	 */
	export type GaugeTrackProps = SVGAttributes<SVGPathElement> & {
		ref?: SVGPathElement | null;
	};
</script>

<script lang="ts">
	let { ref = $bindable(null), class: className, ...restProps }: GaugeTrackProps = $props();

	const state = getGaugeContext('GaugeTrack');
</script>

<path
	bind:this={ref}
	d={state.arcPath}
	fill="none"
	stroke="currentColor"
	stroke-width={state.thickness}
	stroke-linecap="round"
	vector-effect="non-scaling-stroke"
	data-slot="gauge-track"
	data-state={state.state}
	{...restProps}
	class={cn('text-muted-foreground/20', className)}
/>
