<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	export type StatRootProps = WithElementRef<HTMLAttributes<HTMLDivElement>>;
</script>

<script lang="ts">
	let { ref = $bindable(null), class: className, children, ...restProps }: StatRootProps = $props();
</script>

<div
	bind:this={ref}
	data-slot="stat"
	class={cn(
		'grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg border bg-card p-4 text-card-foreground shadow-sm',
		'**:data-[slot=stat-label]:col-span-1 **:data-[slot=stat-value]:col-span-1',
		'**:data-[slot=stat-indicator]:col-start-2 **:data-[slot=stat-indicator]:row-span-2 **:data-[slot=stat-indicator]:row-start-1 **:data-[slot=stat-indicator]:self-start',
		'**:data-[slot=stat-description]:col-span-2 **:data-[slot=stat-separator]:col-span-2 **:data-[slot=stat-trend]:col-span-2',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
