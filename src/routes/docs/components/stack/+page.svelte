<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import * as Stack from '$lib/components/ui/stack/index.js';
	import * as Table from '$lib/components/ui/table/index.js';

	const notifications = [
		{ title: 'Notification 1', description: 'Your deployment was successful' },
		{ title: 'Notification 2', description: 'New message from John Doe' },
		{ title: 'Notification 3', description: 'Update available for your app' }
	];

	const staticItems = [
		{ title: 'Static Stack', description: "This stack doesn't expand on hover" },
		{ title: 'Item 2', description: 'The stacking effect remains constant' },
		{ title: 'Item 3', description: 'Perfect for permanent visual hierarchy' }
	];

	const topItems = [
		{ title: 'Top Stack', description: 'Items stack toward the top' },
		{ title: 'Item 2', description: 'Behind the first' },
		{ title: 'Item 3', description: 'Behind the second' }
	];

	const bottomItems = [
		{ title: 'Bottom Stack', description: 'Items stack toward the bottom' },
		{ title: 'Item 2', description: 'Behind the first' },
		{ title: 'Item 3', description: 'Behind the second' }
	];

	const rootProps = [
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<div>`. Stays `null` in `child` mode.'
		},
		{
			prop: 'side',
			type: '"top" | "bottom"',
			default: '"bottom"',
			description:
				'Direction from which items stack. `top` stacks upward from the top, `bottom` downward from the bottom.'
		},
		{
			prop: 'itemCount',
			type: 'number',
			default: '3',
			description: 'Number of items visible in the collapsed state.'
		},
		{
			prop: 'expandedItemCount',
			type: 'number',
			default: '_all items_',
			description: 'Number of items visible in the expanded state.'
		},
		{
			prop: 'gap',
			type: 'number',
			default: '8',
			description: 'Gap between items when expanded, in pixels.'
		},
		{
			prop: 'scale',
			type: 'number',
			default: '0.05',
			description:
				'Scale factor for each subsequent item in the collapsed state — 0.05 is 5% smaller per item.'
		},
		{
			prop: 'offset',
			type: 'number',
			default: '10',
			description: 'Vertical offset between items in the collapsed state, in pixels.'
		},
		{
			prop: 'expandOnHover',
			type: 'boolean',
			default: 'false',
			description: 'Whether to expand the stack on hover.'
		},
		{
			prop: 'class',
			type: 'string',
			default: '—',
			description: 'Merged last, so it overrides the root’s own `relative w-full`.'
		},
		{
			prop: 'style',
			type: 'string',
			default: '—',
			description:
				'Appended after `--gap`, `--offset` and `--scale`, so a caller declaration wins the cascade.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the root onto your own element. `children` is not rendered in this mode.'
		}
	];

	const itemProps = [
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the card. Stays `null` in `child` mode.'
		},
		{
			prop: 'class',
			type: 'string',
			default: '—',
			description: 'Merged last onto the card, never onto the positioning wrapper.'
		},
		{
			prop: 'style',
			type: 'string',
			default: '—',
			description:
				'Forwarded to the card. The wrapper owns `--translate`, `--item-scale` and z-order.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description:
				'Render the card onto your own element. The positioning wrapper around it is always a `div`.'
		}
	];

	const rootDataAttributes = [
		{ part: 'Stack.Root', attribute: '[data-state]', value: '"expanded" | "collapsed"' },
		{ part: 'Stack.Root', attribute: '[data-expanded]', value: '"true" | "false"' }
	];

	const itemDataAttributes = [
		{ part: 'Wrapper', attribute: '[data-slot]', value: '"stack-item-wrapper"' },
		{ part: 'Wrapper', attribute: '[data-index]', value: 'number' },
		{ part: 'Wrapper', attribute: '[data-front]', value: '"true" | "false"' },
		{ part: 'Wrapper', attribute: '[data-visible]', value: '"true" | "false"' },
		{ part: 'Wrapper', attribute: '[data-expanded]', value: '"true" | "false"' },
		{ part: 'Card', attribute: '[data-slot]', value: '"stack-item"' },
		{ part: 'Card', attribute: '[data-index]', value: 'number' },
		{ part: 'Card', attribute: '[data-position]', value: '"front" | "back"' },
		{ part: 'Card', attribute: '[data-state]', value: '"expanded" | "collapsed"' }
	];
</script>

<svelte:head>
	<title>Stack — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Stack</h1>
		<p class="text-muted-foreground">
			A component that displays items in a stacked layout with hover expansion effects, similar to
			Sonner toast stacking.
		</p>
	</div>

	<ComponentPreview title="Default" description="Mirrors stack-demo.tsx.">
		<Stack.Root class="w-[360px]" expandOnHover>
			{#each notifications as notification (notification.title)}
				<Stack.Item class="flex flex-col gap-2">
					<h3 class="font-semibold">{notification.title}</h3>
					<p class="text-sm text-muted-foreground">{notification.description}</p>
				</Stack.Item>
			{/each}
		</Stack.Root>
	</ComponentPreview>

	<ComponentPreview title="Without Expansion" description="Mirrors stack-no-expand-demo.tsx.">
		<div class="flex min-h-[400px] items-center justify-center">
			<Stack.Root expandOnHover={false} class="w-[360px]">
				{#each staticItems as item (item.title)}
					<Stack.Item class="flex flex-col gap-2">
						<h3 class="font-semibold">{item.title}</h3>
						<p class="text-sm text-muted-foreground">{item.description}</p>
					</Stack.Item>
				{/each}
			</Stack.Root>
		</div>
	</ComponentPreview>

	<ComponentPreview title="Different Sides" description="Mirrors stack-side-demo.tsx.">
		<div class="grid grid-cols-2 gap-8">
			<Stack.Root class="w-[300px]" expandOnHover side="top">
				{#each topItems as item (item.title)}
					<Stack.Item class="flex flex-col gap-2">
						<h3 class="font-semibold">{item.title}</h3>
						<p class="text-sm text-muted-foreground">{item.description}</p>
					</Stack.Item>
				{/each}
			</Stack.Root>
			<Stack.Root class="w-[300px]" expandOnHover side="bottom">
				{#each bottomItems as item (item.title)}
					<Stack.Item class="flex flex-col gap-2">
						<h3 class="font-semibold">{item.title}</h3>
						<p class="text-sm text-muted-foreground">{item.description}</p>
					</Stack.Item>
				{/each}
			</Stack.Root>
		</div>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Stack.Root</h3>
			<p class="text-sm text-muted-foreground">
				The container that publishes the three <code>--gap</code> / <code>--offset</code> /
				<code>--scale</code> custom properties and owns the hover expansion state. Its
				<code>onmouseenter</code>, <code>onmousemove</code>, <code>onmouseleave</code>,
				<code>onpointerdown</code>
				and <code>onpointerup</code> handlers are composed: yours runs first, and
				<code>preventDefault()</code> cancels the stack's own behaviour.
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
			<h3 class="text-lg font-medium">Stack.Root data attributes</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Part</Table.Head>
						<Table.Head>Attribute</Table.Head>
						<Table.Head>Value</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each rootDataAttributes as row (row.attribute)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.part}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.attribute}</Table.Cell>
							<Table.Cell>{row.value}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Stack.Item</h3>
			<p class="text-sm text-muted-foreground">
				One card in the stack. It takes no <code>index</code> prop — an item's position is where it
				sits in the document, so <code>{'{#each}'}</code> reordering, conditional items and late
				insertions renumber the whole stack on their own. It renders a positioning wrapper plus the
				card itself, and throws when used outside a <code>Stack.Root</code>.
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
			<h3 class="text-lg font-medium">Stack.Item data attributes</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Element</Table.Head>
						<Table.Head>Attribute</Table.Head>
						<Table.Head>Value</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each itemDataAttributes as row (row.part + row.attribute)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.part}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.attribute}</Table.Cell>
							<Table.Cell>{row.value}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</section>
</article>
