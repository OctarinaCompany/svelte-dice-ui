<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	export type DirectionConsumerProps = {
		/** Explicit direction override. When set, it wins over any provider and the DOM fallback. */
		dirOverride?: Direction;
	};
</script>

<script lang="ts">
	import { useDirection } from '$lib/components/ui/direction-provider/index.js';

	let { dirOverride }: DirectionConsumerProps = $props();

	let el = $state<HTMLElement | null>(null);
	const direction = useDirection({
		dir: () => dirOverride,
		element: () => el
	});
</script>

<p bind:this={el} class="text-sm">
	Resolved direction: <code class="font-mono font-medium">{direction.current}</code>
</p>
