<script lang="ts" module>
	import type { Separator as SeparatorPrimitive } from 'bits-ui';

	export type StatSeparatorProps = SeparatorPrimitive.RootProps;
</script>

<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	let { ref = $bindable(null), class: className, ...restProps }: StatSeparatorProps = $props();
</script>

<Separator bind:ref data-slot="stat-separator" class={cn('my-2', className)} {...restProps} />
