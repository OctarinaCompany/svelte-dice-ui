<script lang="ts">
	import { resolve } from '$app/paths';
	import { getComponentItems } from '$lib/registry.js';

	const components = getComponentItems();
</script>

<svelte:head>
	<title>Introduction — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-4">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Introduction</h1>
		<p class="text-muted-foreground">
			svelte-dice-ui is a Svelte 5 port of
			<a class="underline underline-offset-4" href="https://diceui.com/docs/introduction">Dice UI</a
			>, distributed as a shadcn-svelte registry. Components live as source in this repository and
			are installed into consumer projects with the shadcn-svelte CLI.
		</p>
	</div>

	<div class="flex flex-col gap-2">
		<h2 class="text-xl font-medium tracking-tight">Installation</h2>
		<pre class="overflow-x-auto rounded-lg bg-muted p-4 text-sm"><code
				>pnpm dlx shadcn-svelte@latest add &lt;registry-url&gt;/r/&lt;component&gt;.json</code
			></pre>
		<p class="text-sm text-muted-foreground">
			The registry payloads are built into <code class="rounded bg-muted px-1 py-0.5">static/r</code
			>
			by
			<code class="rounded bg-muted px-1 py-0.5">pnpm run registry:build</code>, so
			<code>&lt;registry-url&gt;</code> is wherever this site is deployed.
		</p>
	</div>

	<p class="text-sm text-muted-foreground">
		{components.length}
		{components.length === 1 ? 'component has' : 'components have'} been ported so far — see
		<a class="underline underline-offset-4" href={resolve('/docs/components')}>Components</a>.
	</p>
</article>
