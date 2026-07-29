<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import { getComponentItems } from '$lib/registry.js';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	// The sidebar is derived from `registry.json` — every ported component that
	// appends a `registry:ui` entry shows up here automatically.
	const components = getComponentItems();

	const overview: { title: string; route: Pathname }[] = [
		{ title: 'Introduction', route: '/docs' },
		{ title: 'Components', route: '/docs/components' }
	];

	function linkClass(route: Pathname) {
		const active = page.url.pathname === resolve(route);
		return cn(
			'rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted',
			active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'
		);
	}

	function ariaCurrent(route: Pathname) {
		return page.url.pathname === resolve(route) ? ('page' as const) : undefined;
	}
</script>

<div class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10 md:flex-row">
	<aside class="w-full shrink-0 md:w-56">
		<nav aria-label="Docs" class="flex flex-col gap-6 md:sticky md:top-10">
			<div class="flex flex-col gap-1">
				<p class="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
					Overview
				</p>
				{#each overview as item (item.route)}
					<a
						href={resolve(item.route)}
						aria-current={ariaCurrent(item.route)}
						class={linkClass(item.route)}
					>
						{item.title}
					</a>
				{/each}
			</div>

			<div class="flex flex-col gap-1">
				<p class="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
					Components
				</p>
				{#each components as item (item.name)}
					<a
						href={resolve(item.route)}
						aria-current={ariaCurrent(item.route)}
						class={linkClass(item.route)}
					>
						{item.title}
					</a>
				{:else}
					<p class="px-2 py-1 text-sm text-muted-foreground">No components ported yet.</p>
				{/each}
			</div>
		</nav>
	</aside>

	<main class="flex min-w-0 flex-1 flex-col gap-10">
		{@render children()}
	</main>
</div>
