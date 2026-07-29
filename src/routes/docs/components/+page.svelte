<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { getComponentItems } from '$lib/registry.js';
	import BoxIcon from '@lucide/svelte/icons/box';

	const components = getComponentItems();
</script>

<svelte:head>
	<title>Components — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-6">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Components</h1>
		<p class="text-muted-foreground">
			Every Dice UI component ported to Svelte 5. This list is generated from
			<code class="rounded bg-muted px-1 py-0.5 text-sm">registry.json</code>.
		</p>
	</div>

	{#if components.length === 0}
		<Empty.Root>
			<Empty.Header>
				<Empty.Media variant="icon"><BoxIcon /></Empty.Media>
				<Empty.Title>No components yet</Empty.Title>
				<Empty.Description>
					Ported components appear here as soon as they add a
					<code>registry:ui</code> entry to registry.json.
				</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2">
			{#each components as component (component.name)}
				<a
					href={resolve(component.route)}
					class="rounded-xl focus-visible:ring-3 focus-visible:outline-none"
				>
					<Card.Root class="h-full">
						<Card.Header>
							<Card.Title>{component.title}</Card.Title>
							{#if component.description}
								<Card.Description>{component.description}</Card.Description>
							{/if}
						</Card.Header>
					</Card.Root>
				</a>
			{/each}
		</div>
	{/if}
</article>
