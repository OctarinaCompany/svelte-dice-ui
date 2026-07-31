<script lang="ts" module>
	import type { TourRootState } from './tour.svelte.js';

	/**
	 * A render-nothing part whose only job is to hand the enclosing `<Tour.Root>`'s state to the
	 * harness, so a `.ts` spec can read the step registry back.
	 *
	 * A step's resolved record — the offsets it inherited, the collision options it was given — is not
	 * observable from outside the tree: `bits-ui`'s floating layer consumes those props and publishes
	 * none of them as attributes. Context, on the other hand, is only reachable from a component
	 * *inside* the root, which is what this file is. It is not collected by Vitest (`include` is
	 * `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type TourProbeProps = {
		/** Called once during initialisation with the root's state. */
		publish: (state: TourRootState) => void;
	};
</script>

<script lang="ts">
	import { getTourContext } from './tour.svelte.js';

	let { publish }: TourProbeProps = $props();

	publish(getTourContext('<Tour.Probe>'));
</script>
