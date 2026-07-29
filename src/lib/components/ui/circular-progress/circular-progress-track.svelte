<script lang="ts" module>
	import { cn } from '$lib/utils.js';
	import type { SVGAttributes } from 'svelte/elements';
	import { getCircularProgressContext } from './circular-progress.svelte.js';

	/**
	 * `WithElementRef<T, U extends HTMLElement>` cannot express an `SVGCircleElement`, so the ref is
	 * declared locally (research.md R-03).
	 */
	export type CircularProgressTrackProps = SVGAttributes<SVGCircleElement> & {
		ref?: SVGCircleElement | null;
	};
</script>

<script lang="ts">
	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: CircularProgressTrackProps = $props();

	const state = getCircularProgressContext('CircularProgressTrack');
</script>

<circle
	bind:this={ref}
	cx={state.center}
	cy={state.center}
	r={state.radius}
	fill="none"
	stroke="currentColor"
	stroke-width={state.thickness}
	stroke-linecap="round"
	vector-effect="non-scaling-stroke"
	data-slot="circular-progress-track"
	data-state={state.state}
	{...restProps}
	class={cn('text-muted-foreground/20', className)}
/>
