<script lang="ts">
	import * as Button from '$lib/components/ui/button/index.js';
	import { useDirection } from '$lib/components/ui/direction-provider/index.js';

	let el = $state<HTMLElement | null>(null);
	// Mirrors the upstream MDX snippet: the consumer reads the direction off the provider rather
	// than being handed it, which is the whole point of the example.
	const direction = useDirection({ element: () => el });
</script>

<Button.Root bind:ref={el} dir={direction.current}>Do a kickflip</Button.Root>
