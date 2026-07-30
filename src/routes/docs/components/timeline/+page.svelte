<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Timeline from '$lib/components/ui/timeline/index.js';

	const projectItems = [
		{
			id: 'project-kickoff',
			dateTime: '2025-01-15',
			date: 'January 15, 2025',
			title: 'Project Kickoff',
			description: 'Initial meeting to define scope.'
		},
		{
			id: 'design-phase',
			dateTime: '2025-02-01',
			date: 'February 1, 2025',
			title: 'Design Phase',
			description: 'Created wireframes and mockups.'
		},
		{
			id: 'development',
			dateTime: '2025-03-01',
			date: 'March 1, 2025',
			title: 'Development',
			description: 'Building core features.'
		}
	];

	const quarterItems = [
		{
			id: 'research-and-planning',
			dateTime: '2025-01',
			date: 'Jan - Mar',
			title: 'Q1',
			description: 'Research and planning'
		},
		{
			id: 'development-sprint',
			dateTime: '2025-04',
			date: 'Apr - Jun',
			title: 'Q2',
			description: 'Development sprint'
		},
		{
			id: 'beta-launch',
			dateTime: '2025-07',
			date: 'Jul - Sep',
			title: 'Q3',
			description: 'Beta launch'
		}
	];

	const eventItems = [
		{
			id: 'registration-opened',
			dateTime: '2025-01-01',
			date: 'January 1, 2025',
			title: 'Registration Opened',
			description: 'Online registration portal opens.'
		},
		{
			id: 'early-bird-deadline',
			dateTime: '2025-02-15',
			date: 'February 15, 2025',
			title: 'Early Bird Deadline',
			description: 'Last day for early bird pricing.'
		},
		{
			id: 'event-day',
			dateTime: '2025-03-01',
			date: 'March 1, 2025',
			title: 'Event Day',
			description: 'Main event begins at 9:00 AM.'
		}
	];

	const companyItems = [
		{
			id: 'company-founded',
			dateTime: '2023-06',
			date: 'June 2023',
			title: 'Company Founded',
			description: 'Started with a team of five.'
		},
		{
			id: 'series-a-funding',
			dateTime: '2024-03',
			date: 'March 2024',
			title: 'Series A Funding',
			description: 'Raised $10M seed funding.'
		},
		{
			id: 'product-launch',
			dateTime: '2025-01',
			date: 'January 2025',
			title: 'Product Launch',
			description: 'Released MVP to beta testers.'
		}
	];

	let activeIndex = $state(1);

	const rootProps = [
		{
			prop: 'ref',
			type: 'HTMLOListElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<ol>`.'
		},
		{
			prop: 'dir',
			type: '"ltr" | "rtl"',
			default: '_resolved_',
			description:
				'Explicit text direction. Falls back to the nearest `<DirectionProvider>`, then an ancestor `[dir]`, then `"ltr"`.'
		},
		{
			prop: 'orientation',
			type: '"vertical" | "horizontal"',
			default: '"vertical"',
			description: 'The layout axis of the timeline.'
		},
		{
			prop: 'variant',
			type: '"default" | "alternate"',
			default: '"default"',
			description: '`"alternate"` enables the zig-zag layout.'
		},
		{
			prop: 'activeIndex',
			type: 'number | undefined',
			default: 'undefined',
			description:
				'Zero-based index of the active item. Items before it are `completed`, it is `active`, items after are `pending`.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element instead of the default `<ol>`.'
		}
	];

	const itemProps = [
		{
			prop: 'ref',
			type: 'HTMLLIElement | null',
			default: 'null',
			description:
				'Bindable reference to the rendered `<li>` — also the node registered with the collection.'
		},
		{
			prop: 'id',
			type: 'string | undefined',
			default: '$props.id()',
			description: 'The item id, and its collection key.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description:
				'Render onto your own element. The payload includes a `register` function to keep this item in the collection.'
		}
	];

	const dotProps = [
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<div>`.'
		},
		{
			prop: 'children',
			type: 'Snippet | undefined',
			default: '—',
			description: 'Custom dot content, e.g. an icon.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element instead of the default `<div>`.'
		}
	];

	const connectorProps = [
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<div>`.'
		},
		{
			prop: 'forceMount',
			type: 'boolean',
			default: 'false',
			description: 'Keep the connector mounted even after the last item.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element instead of the default `<div>`.'
		}
	];

	const contentProps = [
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<div>`.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element instead of the default `<div>`.'
		}
	];

	const headerProps = [
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<div>`.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element instead of the default `<div>`.'
		}
	];

	const titleProps = headerProps;
	const descriptionProps = headerProps;

	const timeProps = [
		{
			prop: 'ref',
			type: 'HTMLTimeElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<time>`.'
		},
		{
			prop: 'dateTime',
			type: 'string | undefined',
			default: '—',
			description:
				'Upstream-parity alias for the native `datetime` attribute. A native `datetime` prop wins over this alias.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element instead of the default `<time>`.'
		}
	];
</script>

<svelte:head>
	<title>Timeline — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Timeline</h1>
		<p class="text-muted-foreground">
			A flexible timeline for chronological events, with vertical/horizontal orientations, an
			alternating variant, RTL support and completed/active/pending states.
		</p>
	</div>

	<ComponentPreview title="Default" description="Mirrors timeline-demo.tsx.">
		<Timeline.Root {activeIndex} class="max-w-md">
			{#each projectItems as item (item.id)}
				<Timeline.Item id={item.id}>
					<Timeline.Dot />
					<Timeline.Connector />
					<Timeline.Content>
						<Timeline.Header>
							<Timeline.Time dateTime={item.dateTime}>{item.date}</Timeline.Time>
							<Timeline.Title>{item.title}</Timeline.Title>
						</Timeline.Header>
						<Timeline.Description>{item.description}</Timeline.Description>
					</Timeline.Content>
				</Timeline.Item>
			{/each}
		</Timeline.Root>
		<div class="mt-4 flex items-center gap-2">
			<span class="text-sm text-muted-foreground">activeIndex:</span>
			{#each projectItems as _, index (index)}
				<button
					type="button"
					class="rounded-md border px-2 py-1 text-xs"
					onclick={() => (activeIndex = index)}
				>
					{index}
				</button>
			{/each}
		</div>
	</ComponentPreview>

	<ComponentPreview title="Horizontal" description="Mirrors timeline-horizontal-demo.tsx.">
		<Timeline.Root orientation="horizontal" activeIndex={1}>
			{#each quarterItems as item (item.id)}
				<Timeline.Item id={item.id}>
					<Timeline.Dot />
					<Timeline.Connector />
					<Timeline.Content>
						<Timeline.Header>
							<Timeline.Title>{item.title}</Timeline.Title>
							<Timeline.Time dateTime={item.dateTime}>{item.date}</Timeline.Time>
						</Timeline.Header>
						<Timeline.Description>{item.description}</Timeline.Description>
					</Timeline.Content>
				</Timeline.Item>
			{/each}
		</Timeline.Root>
	</ComponentPreview>

	<ComponentPreview title="RTL" description="Mirrors timeline-rtl-demo.tsx.">
		<div dir="rtl" class="max-w-md">
			<Timeline.Root dir="rtl" activeIndex={1}>
				{#each eventItems as item (item.id)}
					<Timeline.Item id={item.id}>
						<Timeline.Dot />
						<Timeline.Connector />
						<Timeline.Content>
							<Timeline.Header>
								<Timeline.Title>{item.title}</Timeline.Title>
								<Timeline.Time dateTime={item.dateTime}>{item.date}</Timeline.Time>
							</Timeline.Header>
							<Timeline.Description>{item.description}</Timeline.Description>
						</Timeline.Content>
					</Timeline.Item>
				{/each}
			</Timeline.Root>
		</div>
	</ComponentPreview>

	<ComponentPreview title="Alternate" description="Mirrors timeline-alternate-demo.tsx.">
		<Timeline.Root variant="alternate" activeIndex={1} class="max-w-lg">
			{#each projectItems as item (item.id)}
				<Timeline.Item id={item.id}>
					<Timeline.Dot />
					<Timeline.Connector />
					<Timeline.Content>
						<Timeline.Header>
							<Timeline.Time dateTime={item.dateTime}>{item.date}</Timeline.Time>
							<Timeline.Title>{item.title}</Timeline.Title>
						</Timeline.Header>
						<Timeline.Description>{item.description}</Timeline.Description>
					</Timeline.Content>
				</Timeline.Item>
			{/each}
		</Timeline.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Horizontal Alternate"
		description="Mirrors timeline-horizontal-alternate-demo.tsx."
	>
		<Timeline.Root variant="alternate" orientation="horizontal" activeIndex={1}>
			{#each companyItems as item (item.id)}
				<Timeline.Item id={item.id}>
					<Timeline.Dot />
					<Timeline.Connector />
					<Timeline.Content>
						<Timeline.Header>
							<Timeline.Time dateTime={item.dateTime}>{item.date}</Timeline.Time>
							<Timeline.Title>{item.title}</Timeline.Title>
						</Timeline.Header>
						<Timeline.Description>{item.description}</Timeline.Description>
					</Timeline.Content>
				</Timeline.Item>
			{/each}
		</Timeline.Root>
	</ComponentPreview>

	<ComponentPreview title="Custom Dot" description="Mirrors timeline-custom-dot-demo.tsx.">
		<Timeline.Root activeIndex={1} class="max-w-md [--timeline-dot-size:2rem]">
			{#each projectItems as item (item.id)}
				<Timeline.Item id={item.id}>
					<Timeline.Dot>
						<span class="size-3.5 rounded-full bg-current"></span>
					</Timeline.Dot>
					<Timeline.Connector />
					<Timeline.Content>
						<Timeline.Header>
							<Timeline.Time dateTime={item.dateTime}>{item.date}</Timeline.Time>
							<Timeline.Title>{item.title}</Timeline.Title>
						</Timeline.Header>
						<Timeline.Description>{item.description}</Timeline.Description>
					</Timeline.Content>
				</Timeline.Item>
			{/each}
		</Timeline.Root>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Timeline (Root)</h3>
			<p class="text-sm text-muted-foreground">
				The container that publishes <code>orientation</code>/<code>variant</code>/<code>dir</code>/
				<code>activeIndex</code> on context and owns the DOM-order item collection.
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
			<h3 class="text-lg font-medium">Timeline.Item</h3>
			<p class="text-sm text-muted-foreground">
				A single chronological entry. Registers its element with the root so its live DOM-order
				index — and therefore its status — is derived.
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
			<h3 class="text-lg font-medium">Timeline.Dot</h3>
			<p class="text-sm text-muted-foreground">The visual marker for a timeline item.</p>
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
					{#each dotProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Timeline.Connector</h3>
			<p class="text-sm text-muted-foreground">
				The line connecting an item to the next one. Renders nothing after the last item unless
				<code>forceMount</code>.
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
					{#each connectorProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Timeline.Content</h3>
			<p class="text-sm text-muted-foreground">Container for an item's header and description.</p>
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
					{#each contentProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Timeline.Header</h3>
			<p class="text-sm text-muted-foreground">Container for the title and time of an item.</p>
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
					{#each headerProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Timeline.Title</h3>
			<p class="text-sm text-muted-foreground">The title/heading of an item.</p>
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
					{#each titleProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Timeline.Description</h3>
			<p class="text-sm text-muted-foreground">The description/body text of an item.</p>
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
					{#each descriptionProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Timeline.Time</h3>
			<p class="text-sm text-muted-foreground">
				A semantic <code>&lt;time&gt;</code> element for displaying dates.
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
					{#each timeProps as row (row.prop)}
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
	</section>
</article>
