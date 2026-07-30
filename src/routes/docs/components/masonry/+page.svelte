<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import * as Masonry from '$lib/components/ui/masonry/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as Table from '$lib/components/ui/table/index.js';

	const tricks = [
		{
			id: '1',
			title: 'The 900',
			description: 'The 900 is a trick where you spin 900 degrees in the air.'
		},
		{
			id: '2',
			title: 'Indy Backflip',
			description:
				'The Indy Backflip is a trick where you backflip in the air while grabbing the board with your back hand.'
		},
		{
			id: '3',
			title: 'Pizza Guy',
			description: 'The Pizza Guy is a trick where you flip the board like a pizza.'
		},
		{
			id: '4',
			title: 'Rocket Air',
			description:
				'The Rocket Air is a trick where you grab the nose of your board and point it straight up to the sky.'
		},
		{
			id: '5',
			title: 'Kickflip Backflip',
			description:
				'The Kickflip Backflip is a trick where you perform a kickflip while doing a backflip simultaneously.'
		},
		{
			id: '6',
			title: 'FS 540',
			description: 'The FS 540 is a trick where you spin frontside 540 degrees in the air.'
		}
	];

	const numbered = [
		{ id: '1', number: 1, aspectRatio: '1/1' },
		{ id: '2', number: 2, aspectRatio: '4/3' },
		{ id: '3', number: 3, aspectRatio: '3/4' },
		{ id: '4', number: 4, aspectRatio: '3/2' },
		{ id: '5', number: 5, aspectRatio: '1/1' },
		{ id: '6', number: 6, aspectRatio: '1/1' }
	];

	const skeletonIds = Array.from({ length: 6 }, (_, index) => `skeleton-${index + 1}`);

	const rootProps = [
		{
			prop: 'ref',
			type: 'HTMLElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<div>`. Stays `null` in `child` mode.'
		},
		{
			prop: 'columnWidth',
			type: 'number',
			default: '200',
			description: 'Preferred column width in px, used to derive the column count.'
		},
		{
			prop: 'columnCount',
			type: 'number | undefined',
			default: 'undefined',
			description:
				'Explicit column count. Overrides the derived one and makes `maxColumnCount` inert.'
		},
		{
			prop: 'maxColumnCount',
			type: 'number | undefined',
			default: 'undefined',
			description: 'Caps the derived column count. Ignored when `columnCount` is set.'
		},
		{
			prop: 'gap',
			type: 'number | { column: number; row: number }',
			default: '0',
			description: 'A number applies to both axes; the object sets each independently.'
		},
		{
			prop: 'itemHeight',
			type: 'number',
			default: '300',
			description:
				'Estimated height of a not-yet-measured item. Drives total-height estimation and batch sizing.'
		},
		{
			prop: 'defaultWidth',
			type: 'number | undefined',
			default: 'undefined',
			description: 'Container width assumed before measurement (server render / first paint).'
		},
		{
			prop: 'defaultHeight',
			type: 'number | undefined',
			default: 'undefined',
			description: 'Viewport height assumed before measurement.'
		},
		{
			prop: 'overscan',
			type: 'number',
			default: '2',
			description:
				'How far beyond the viewport items stay mounted, in multiples of viewport height.'
		},
		{
			prop: 'scrollFps',
			type: 'number',
			default: '12',
			description: 'Upper bound on scroll-driven recomputation, in frames per second.'
		},
		{
			prop: 'linear',
			type: 'boolean',
			default: 'false',
			description: 'Round-robin column assignment instead of shortest-first.'
		},
		{
			prop: 'fallback',
			type: 'Snippet | undefined',
			default: 'undefined',
			description: 'Rendered instead of the positioned list until the component has mounted.'
		},
		{
			prop: 'dir',
			type: '"ltr" | "rtl" | undefined',
			default: 'resolved',
			description:
				'Explicit direction. Falls back to the nearest `<DirectionProvider>`, then an ancestor `[dir]`, then `"ltr"`. Added here; not present upstream.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props: MasonryChildProps }]>',
			default: 'undefined',
			description:
				'Render the root onto your own element. Replaces upstream `asChild`; `children` is not rendered and `ref` stays `null`.'
		},
		{
			prop: 'children',
			type: 'Snippet | undefined',
			default: 'undefined',
			description: 'The `<Masonry.Item>` list.'
		}
	];

	const itemProps = [
		{
			prop: 'ref',
			type: 'HTMLElement | null',
			default: 'null',
			description:
				'Bindable reference. `null` while the item is virtualized out or in `child` mode.'
		},
		{
			prop: 'index',
			type: 'number | undefined',
			default: 'undefined',
			description:
				'Pins the item to a layout index. Defaults to registration (source) order. Added here; supply it for an item inserted mid-list after mount.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props: MasonryItemChildProps }]>',
			default: 'undefined',
			description:
				'Render the item onto your own element. The snippet must spread `props`, or the item is neither positioned nor measured.'
		},
		{
			prop: 'children',
			type: 'Snippet | undefined',
			default: 'undefined',
			description: 'Item content. Rendered only while in range or in the measurement batch.'
		}
	];

	const rootAttributes = [
		{ attribute: 'data-slot', values: '"masonry"', description: 'Styling and test hook.' },
		{
			attribute: 'data-scrolling',
			values: '"" | absent',
			description: 'A throttled scroll tick is in flight.'
		},
		{
			attribute: 'dir',
			values: '"ltr" | "rtl"',
			description: 'The resolved direction, which is what mirrors the column order.'
		}
	];

	const itemAttributes = [
		{ attribute: 'data-slot', values: '"masonry-item"', description: 'Styling and test hook.' },
		{ attribute: 'data-index', values: 'number', description: 'The resolved layout index.' },
		{
			attribute: 'data-column-index',
			values: 'number | absent',
			description: 'The assigned column. Absent until the item has been measured.'
		},
		{
			attribute: 'data-measuring',
			values: '"" | absent',
			description: 'The item is rendered `visibility: hidden` purely so it can be measured.'
		}
	];
</script>

<svelte:head>
	<title>Masonry — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Masonry</h1>
		<p class="text-muted-foreground">
			A responsive masonry layout component for displaying items in a grid.
		</p>
	</div>

	<ComponentPreview
		title="Default"
		description="Mirrors masonry-demo.tsx — each item drops into the shortest column, so items of different heights pack without gaps."
	>
		<Masonry.Root columnCount={3} gap={12} fallback={loading}>
			{#each tricks as trick (trick.id)}
				<Masonry.Item>
					{#snippet child({ props })}
						<div
							{...props}
							class="flex flex-col gap-1 rounded-md border bg-card p-4 text-card-foreground shadow-xs"
						>
							<div class="text-sm leading-tight font-medium sm:text-base">{trick.title}</div>
							<span class="text-sm text-muted-foreground">{trick.description}</span>
						</div>
					{/snippet}
				</Masonry.Item>
			{/each}
		</Masonry.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Linear Layout"
		description="Mirrors masonry-linear-demo.tsx — set linear to keep items in source order across the columns, falling back to the shortest column only once one column runs away."
	>
		<Masonry.Root gap={10} columnWidth={140} linear fallback={loading}>
			{#each numbered as item (item.id)}
				<Masonry.Item
					class="flex items-center justify-center rounded-lg border bg-card text-card-foreground shadow-xs"
					style="aspect-ratio: {item.aspectRatio};"
				>
					<span class="text-2xl font-medium">{item.number}</span>
				</Masonry.Item>
			{/each}
		</Masonry.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Server Side Rendering"
		description="Mirrors masonry-ssr-demo.tsx — defaultWidth, defaultHeight and a fallback snippet keep the first paint measurement-free, so the server and the first client render agree."
	>
		<Masonry.Root
			columnCount={3}
			gap={{ column: 8, row: 8 }}
			defaultWidth={1200}
			defaultHeight={800}
			class="w-full"
			fallback={skeletonGrid}
		>
			{#each tricks as trick (trick.id)}
				<Masonry.Item
					class="relative overflow-hidden transition-all duration-300 hover:scale-[1.02]"
				>
					<div
						class="flex flex-col gap-2 rounded-md border bg-card p-4 text-card-foreground shadow-xs"
					>
						<div class="text-sm leading-tight font-medium sm:text-base">{trick.title}</div>
						<span class="text-sm text-muted-foreground">{trick.description}</span>
					</div>
				</Masonry.Item>
			{/each}
		</Masonry.Root>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Masonry / Masonry.Root</h3>
			<p class="text-sm text-muted-foreground">
				Renders a <code>&lt;div&gt;</code> that wraps an internal viewport sizing container, and
				publishes the masonry context. Every remaining
				<code>HTMLAttributes&lt;HTMLDivElement&gt;</code> is spread onto the element;
				<code>class</code> is merged last and <code>style</code> is appended after the component's own
				declarations.
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
			<h3 class="text-lg font-medium">MasonryItem / Masonry.Item</h3>
			<p class="text-sm text-muted-foreground">
				An absolutely positioned cell. Must be inside <code>&lt;Masonry.Root&gt;</code>.
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
					{#each itemProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Data Attributes</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Part</Table.Head>
						<Table.Head>Attribute</Table.Head>
						<Table.Head>Values</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each rootAttributes as row (row.attribute)}
						<Table.Row>
							<Table.Cell class="text-muted-foreground">Masonry</Table.Cell>
							<Table.Cell class="font-medium">{row.attribute}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.values}</Table.Cell>
							<Table.Cell>{row.description}</Table.Cell>
						</Table.Row>
					{/each}
					{#each itemAttributes as row (row.attribute)}
						<Table.Row>
							<Table.Cell class="text-muted-foreground">MasonryItem</Table.Cell>
							<Table.Cell class="font-medium">{row.attribute}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.values}</Table.Cell>
							<Table.Cell>{row.description}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Errors</h3>
			<p class="text-sm text-muted-foreground">
				Rendering <code>&lt;Masonry.Item&gt;</code> with no <code>&lt;Masonry.Root&gt;</code>
				ancestor throws
				<code>`&lt;Masonry.Item&gt;` must be used within `&lt;Masonry.Root&gt;`.</code>
			</p>
		</div>
	</section>
</article>

{#snippet loading()}
	<Skeleton class="h-72 w-full" />
{/snippet}

{#snippet skeletonGrid()}
	<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
		{#each skeletonIds as id (id)}
			<div class="flex flex-col gap-2 rounded-md border bg-card p-4">
				<Skeleton class="h-5 w-24" />
				<Skeleton class="h-4 w-full" />
				<Skeleton class="h-4 w-3/4" />
			</div>
		{/each}
	</div>
{/snippet}
