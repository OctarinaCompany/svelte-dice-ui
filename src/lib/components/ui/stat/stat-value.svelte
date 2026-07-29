<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	export type StatValueProps = WithElementRef<HTMLAttributes<HTMLDivElement>>;
</script>

<script lang="ts">
	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: StatValueProps = $props();
</script>

<div
	bind:this={ref}
	data-slot="stat-value"
	class={cn('text-2xl font-semibold tracking-tight', className)}
	{...restProps}
>
	{@render children?.()}
</div>
