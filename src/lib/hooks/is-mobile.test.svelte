<script lang="ts" module>
	import type { IsMobile } from './is-mobile.svelte.js';

	export type IsMobileHarnessProps = {
		/** Omit to exercise the default-breakpoint overload (`useIsMobile()`). */
		breakpoint?: number;
		/** Receives the instance `useIsMobile` handed back, so a spec can inspect it. */
		onInstance?: (isMobile: IsMobile) => void;
	};
</script>

<script lang="ts">
	import { untrack } from 'svelte';

	import { DEFAULT_MOBILE_BREAKPOINT, useIsMobile } from './is-mobile.svelte.js';

	let { breakpoint, onInstance }: IsMobileHarnessProps = $props();

	// `useIsMobile` must be called during component initialisation, so this test-only harness is the
	// only way a `.ts` spec can drive it. Which overload to use is decided once, from the initial
	// prop; the getter itself stays reactive so a `rerender` re-creates the query.
	const isMobile = useIsMobile(
		untrack(() => breakpoint) === undefined
			? undefined
			: () => breakpoint ?? DEFAULT_MOBILE_BREAKPOINT
	);

	untrack(() => onInstance)?.(isMobile);
</script>

<span data-testid="is-mobile">{String(isMobile.current)}</span>
