<script lang="ts" module>
	import type { AngleSliderRootState } from './index.js';

	/**
	 * A consumer of the dial's context, rendered *inside* `<AngleSlider.Root>`. It exists only so a
	 * spec can hold the very `AngleSliderRootState` the dial is using — `getAngleSliderContext()`
	 * reads Svelte context, which a `.ts` spec cannot do, and the harness's own instance script runs
	 * above the root.
	 *
	 * Not collected by Vitest (`include` is `.{js,ts}`) and not listed in `registry.json`.
	 */
	export type AngleSliderProbeProps = {
		/** Receives the root state, so a spec can watch its thumb registrations. */
		onstate?: (state: AngleSliderRootState) => void;
	};
</script>

<script lang="ts">
	import { untrack } from 'svelte';

	import { getAngleSliderContext } from './index.js';

	let { onstate }: AngleSliderProbeProps = $props();

	const slider = getAngleSliderContext('<AngleSliderProbe>');

	// The state is resolved once, at initialisation, so the callback is read the same way — through a
	// closure, which is also what keeps this out of the compiler's `state_referenced_locally` net.
	untrack(() => onstate)?.(slider);
</script>

<span data-testid="probe-thumb-count">{slider.thumbs.size}</span>
