<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import * as Status from '$lib/components/ui/status/index.js';
	import { type StatusVariant } from '$lib/components/ui/status/index.js';
	import * as Table from '$lib/components/ui/table/index.js';

	type Service = { name: string; status: StatusVariant; uptime: string };

	const services = $state<Service[]>([
		{ name: 'API Server', status: 'success', uptime: '99.9%' },
		{ name: 'Cache Service', status: 'warning', uptime: '98.5%' },
		{ name: 'Message Queue', status: 'success', uptime: '99.8%' },
		{ name: 'CDN', status: 'error', uptime: '95.2%' },
		{ name: 'Email Service', status: 'info', uptime: 'Updating...' }
	]);

	const variantGroups: { title: string; variant: StatusVariant; labels: string[] }[] = [
		{ title: 'Success Variants', variant: 'success', labels: ['Online', 'Active', 'Connected'] },
		{ title: 'Error Variants', variant: 'error', labels: ['Offline', 'Disconnected', 'Failed'] },
		{ title: 'Warning Variants', variant: 'warning', labels: ['Away', 'Busy', 'Pending'] },
		{ title: 'Info Variants', variant: 'info', labels: ['Idle', 'In Progress', 'Syncing'] },
		{ title: 'Default Variants', variant: 'default', labels: ['Unknown', 'Not Set', 'N/A'] }
	];

	const rootProps = [
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered element. Not populated in `child` mode.'
		},
		{
			prop: 'variant',
			type: "'default' | 'success' | 'error' | 'warning' | 'info'",
			default: "'default'",
			description:
				'The visual style and color theme of the status badge. An unknown runtime value normalises to `default`.'
		},
		{
			prop: 'class',
			type: 'ClassValue',
			default: '—',
			description: 'Merged last, so it overrides the variant classes.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: 'Badge content. Not rendered when `child` is supplied.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props: StatusChildProps }]>',
			default: '—',
			description:
				'Render the badge onto your own element instead of the default `<div>`. Replaces upstream’s `asChild`.'
		},
		{
			prop: '...restProps',
			type: 'HTMLAttributes<HTMLDivElement>',
			default: '—',
			description: 'Every other attribute and DOM handler is spread onto the rendered element.'
		}
	];

	const partProps = [
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
			description: 'Merged last, so it overrides the base classes.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: 'Rendered inside the element.'
		},
		{
			prop: '...restProps',
			type: 'HTMLAttributes<HTMLDivElement>',
			default: '—',
			description: 'Every other attribute and DOM handler is spread onto the rendered element.'
		}
	];

	const dataAttributes = [
		{ attribute: '[data-slot]', part: 'Status', values: 'status' },
		{ attribute: '[data-slot]', part: 'Status.Indicator', values: 'status-indicator' },
		{ attribute: '[data-slot]', part: 'Status.Label', values: 'status-label' },
		{
			attribute: '[data-variant]',
			part: 'Status',
			values: 'default | success | error | warning | info'
		}
	];
</script>

<svelte:head>
	<title>Status — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Status</h1>
		<p class="text-muted-foreground">
			A flexible status indicator with an animated ping effect and colour variants for displaying
			system states, user presence and service health.
		</p>
	</div>

	<ComponentPreview title="Default" description="Mirrors status-demo.tsx.">
		<div class="flex flex-wrap items-center gap-2.5">
			<Status.Root variant="success">
				<Status.Indicator />
				<Status.Label>Online</Status.Label>
			</Status.Root>

			<Status.Root variant="error">
				<Status.Indicator />
				<Status.Label>Offline</Status.Label>
			</Status.Root>

			<Status.Root variant="warning">
				<Status.Indicator />
				<Status.Label>Away</Status.Label>
			</Status.Root>

			<Status.Root variant="info">
				<Status.Indicator />
				<Status.Label>Idle</Status.Label>
			</Status.Root>

			<Status.Root variant="default">
				<Status.Indicator />
				<Status.Label>Unknown</Status.Label>
			</Status.Root>
		</div>
	</ComponentPreview>

	<ComponentPreview title="Variants" description="Mirrors status-variants-demo.tsx.">
		<div class="flex flex-col gap-6">
			{#each variantGroups as group (group.title)}
				<div class="flex flex-col gap-3">
					<h3 class="text-sm font-medium">{group.title}</h3>
					<div class="flex flex-wrap items-center gap-2.5">
						{#each group.labels as label, index (label)}
							<Status.Root
								variant={group.variant}
								class={index === 2 ? 'hidden sm:inline-flex' : ''}
							>
								<Status.Indicator />
								<Status.Label>{label}</Status.Label>
							</Status.Root>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</ComponentPreview>

	<ComponentPreview title="Text Only" description="Mirrors status-text-only-demo.tsx.">
		<div class="flex flex-wrap items-center gap-2.5">
			<Status.Root variant="success">
				<Status.Label>Active</Status.Label>
			</Status.Root>

			<Status.Root variant="error">
				<Status.Label>Inactive</Status.Label>
			</Status.Root>

			<Status.Root variant="warning">
				<Status.Label>Pending</Status.Label>
			</Status.Root>

			<Status.Root variant="info">
				<Status.Label>Processing</Status.Label>
			</Status.Root>

			<Status.Root variant="default">
				<Status.Label>Draft</Status.Label>
			</Status.Root>
		</div>
	</ComponentPreview>

	<ComponentPreview title="Service Status List" description="Mirrors status-list-demo.tsx.">
		<div class="flex w-full max-w-md flex-col gap-2">
			{#each services as service (service.name)}
				<div class="flex items-center justify-between rounded-lg border bg-card p-3">
					<div class="flex flex-col gap-0.5">
						<span class="text-sm font-medium">{service.name}</span>
						<span class="text-xs text-muted-foreground">Uptime: {service.uptime}</span>
					</div>
					<Status.Root variant={service.status}>
						<Status.Indicator />
						<Status.Label class="capitalize">{service.status}</Status.Label>
					</Status.Root>
				</div>
			{/each}
		</div>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Status</h3>
			<p class="text-sm text-muted-foreground">
				The badge container. Renders a <code>div</code> unless a <code>child</code> snippet is supplied.
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
			<h3 class="text-lg font-medium">Status.Indicator</h3>
			<p class="text-sm text-muted-foreground">The animated pulse indicator for the status.</p>
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
					{#each partProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Status.Label</h3>
			<p class="text-sm text-muted-foreground">The text label for the status.</p>
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
					{#each partProps as row (row.prop)}
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
