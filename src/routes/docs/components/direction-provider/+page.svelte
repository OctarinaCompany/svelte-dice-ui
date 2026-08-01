<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import * as DirectionProvider from '$lib/components/ui/direction-provider/index.js';
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';
	import * as Button from '$lib/components/ui/button/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import DirectionConsumer from './direction-consumer.svelte';
	import DirectionButton from './direction-button.svelte';

	let dir = $state<Direction>('ltr');

	const rootProps = [
		{
			prop: 'dir',
			type: "'ltr' | 'rtl'",
			default: "'ltr'",
			description: 'The direction of the text. Never mutated internally — the parent owns it.'
		},
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered element.'
		},
		{
			prop: 'class',
			type: 'ClassValue',
			default: '—',
			description: "Merged last onto the wrapper's contents class."
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: 'Rendered unchanged inside the wrapper.'
		},
		{
			prop: '...restProps',
			type: "Omit<HTMLAttributes<HTMLDivElement>, 'dir'>",
			default: '—',
			description: 'Every other attribute and DOM handler is spread onto the rendered element.'
		}
	];

	const useDirectionOptions = [
		{
			prop: 'dir',
			type: '() => Direction | undefined',
			default: '—',
			description:
				'Explicit override. When it returns a value it wins over the provider and the DOM.'
		},
		{
			prop: 'element',
			type: '() => HTMLElement | null | undefined',
			default: 'document.documentElement',
			description: 'Element the DOM fallback walks up from when no provider is present.'
		}
	];

	const dataAttributes = [
		{ attribute: '[data-slot]', part: 'DirectionProvider', values: 'direction-provider' },
		{ attribute: '[data-dir]', part: 'DirectionProvider', values: 'ltr | rtl' }
	];
</script>

<svelte:head>
	<title>Direction Provider — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Direction Provider</h1>
		<p class="text-muted-foreground">
			Provides bidirectional text support (RTL/LTR) across your application, with a reader that
			falls back to the nearest DOM <code>dir</code> attribute when no provider is present.
		</p>
	</div>

	<ComponentPreview title="Provider" description="Mirrors the Usage block of the upstream MDX.">
		<div class="flex flex-col items-center gap-4">
			<div class="flex gap-2">
				<Button.Root variant={dir === 'ltr' ? 'default' : 'outline'} onclick={() => (dir = 'ltr')}
					>ltr</Button.Root
				>
				<Button.Root variant={dir === 'rtl' ? 'default' : 'outline'} onclick={() => (dir = 'rtl')}
					>rtl</Button.Root
				>
			</div>
			<!--
				The provider renders a `display: contents` wrapper, so it cannot carry the card's own
				layout: `contents` suppresses the box that the border and padding would paint. The
				styling lives on a plain element inside it, which also keeps the provider headless the
				way upstream's context-only provider is.
			-->
			<DirectionProvider.Root {dir}>
				<div class="flex flex-col items-center gap-3 rounded-lg border p-4">
					<DirectionConsumer />
					<DirectionProvider.Root dir="rtl">
						<div class="flex flex-col items-center gap-2 rounded-lg border border-dashed p-3">
							<p class="text-xs text-muted-foreground">Nested provider, always dir="rtl":</p>
							<DirectionConsumer />
						</div>
					</DirectionProvider.Root>
				</div>
			</DirectionProvider.Root>
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="Reading the direction"
		description="Mirrors the API Reference block's useDirection example."
	>
		<DirectionProvider.Root {dir}>
			<DirectionButton />
		</DirectionProvider.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Ambient fallback"
		description="No provider wraps this consumer — it reads the ancestor's dir attribute instead."
	>
		<div dir="rtl" class="rounded-lg border border-dashed p-4">
			<p class="mb-2 text-xs text-muted-foreground">Ancestor: dir="rtl", no DirectionProvider</p>
			<DirectionConsumer />
		</div>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">DirectionProvider</h3>
			<p class="text-sm text-muted-foreground">
				Manages direction context for the <code>useDirection</code> reader.
			</p>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Prop</Table.Head>
						<Table.Head>Type</Table.Head>
						<Table.Head>Default</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each rootProps as row (row.prop)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.prop}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.type}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.default}</Table.Cell>
							<Table.Cell>{row.description}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">useDirection(options?)</h3>
			<p class="text-sm text-muted-foreground">
				A reader to access the current direction. Returns a <code>DirectionReader</code> with one
				member, <code>current</code>. Never throws when no provider is present.
			</p>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Option</Table.Head>
						<Table.Head>Type</Table.Head>
						<Table.Head>Default</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each useDirectionOptions as row (row.prop)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.prop}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.type}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.default}</Table.Cell>
							<Table.Cell>{row.description}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Data attributes</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Attribute</Table.Head>
						<Table.Head>Part</Table.Head>
						<Table.Head>Values</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each dataAttributes as row (`${row.attribute}-${row.part}`)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.attribute}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.part}</Table.Cell>
							<Table.Cell>{row.values}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</section>
</article>
