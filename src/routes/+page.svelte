<script lang="ts">
	import { resolve } from '$app/paths';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import { getComponentItems } from '$lib/registry.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';

	const components = getComponentItems();
</script>

<svelte:head>
	<title>svelte-dice-ui</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-3xl flex-col items-start gap-6 px-6 py-24">
	<h1 class="text-4xl font-semibold tracking-tight">svelte-dice-ui</h1>
	<p class="text-lg text-muted-foreground">
		A Svelte 5 port of the Dice UI component library, distributed as a shadcn-svelte registry.
		Accessible, unstyled behaviour first — styling stays in your hands.
	</p>
	<div class="flex flex-wrap gap-3">
		<a href={resolve('/docs')} class={buttonVariants({ size: 'lg' })}>
			Read the docs
			<ArrowRightIcon data-icon="inline-end" />
		</a>
		<a
			href={resolve('/docs/components')}
			class={buttonVariants({ variant: 'outline', size: 'lg' })}
		>
			Browse {components.length} components
		</a>
	</div>
</main>
