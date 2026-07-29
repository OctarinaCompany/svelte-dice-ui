<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	export type StatDescriptionProps = WithElementRef<HTMLAttributes<HTMLDivElement>>;
</script>

<script lang="ts">
	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: StatDescriptionProps = $props();
</script>

<div
	bind:this={ref}
	data-slot="stat-description"
	class={cn('text-xs text-muted-foreground', className)}
	{...restProps}
>
	{@render children?.()}
</div>
