<script lang="ts" module>
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	export type ComponentPreviewProps = {
		/** Section heading — use the upstream example name, e.g. "Controlled". */
		title: string;
		/** Optional one-line explanation of what the example demonstrates. */
		description?: string;
		/** Extra classes for the bordered preview area (layout only). */
		class?: string;
		/** The live example. */
		children: Snippet;
	};
</script>

<script lang="ts">
	let { title, description, class: className, children }: ComponentPreviewProps = $props();
</script>

<section class="flex flex-col gap-3" data-slot="component-preview">
	<div class="flex flex-col gap-1">
		<h3 class="scroll-m-20 text-base font-medium tracking-tight">{title}</h3>
		{#if description}
			<p class="text-sm text-muted-foreground">{description}</p>
		{/if}
	</div>
	<div
		data-slot="component-preview-canvas"
		class={cn(
			'flex min-h-64 w-full items-center justify-center rounded-lg border bg-background p-8',
			className
		)}
	>
		{@render children()}
	</div>
</section>
