<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	export type StatusIndicatorProps = WithElementRef<HTMLAttributes<HTMLDivElement>>;
</script>

<script lang="ts">
	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: StatusIndicatorProps = $props();
</script>

<!--
	`data-slot="status-indicator"` is load-bearing: the root's variant classes colour this dot
	through `**:data-[slot=status-indicator]:bg-…`, and `bg-inherit` on both pseudo-elements picks
	that colour up for the ping and the core.
-->
<div
	bind:this={ref}
	data-slot="status-indicator"
	class={cn(
		'relative flex size-2 shrink-0 rounded-full before:absolute before:inset-0 before:animate-ping before:rounded-full before:bg-inherit after:absolute after:inset-[2px] after:rounded-full after:bg-inherit',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
