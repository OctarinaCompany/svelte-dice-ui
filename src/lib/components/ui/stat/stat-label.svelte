<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	export type StatLabelProps = WithElementRef<HTMLAttributes<HTMLDivElement>>;
</script>

<script lang="ts">
	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: StatLabelProps = $props();
</script>

<div
	bind:this={ref}
	data-slot="stat-label"
	class={cn('text-sm font-medium text-muted-foreground', className)}
	{...restProps}
>
	{@render children?.()}
</div>
