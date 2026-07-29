<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import * as Stat from '$lib/components/ui/stat/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import DollarSignIcon from '@lucide/svelte/icons/dollar-sign';
	import ShoppingCartIcon from '@lucide/svelte/icons/shopping-cart';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import UsersIcon from '@lucide/svelte/icons/users';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';

	const rootProps = [
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
			description: 'Merged last, so it overrides the container’s own classes.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: 'The parts to lay out on the two-column grid, in any order.'
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

	const indicatorProps = [
		{
			prop: 'variant',
			type: "'default' | 'icon' | 'badge' | 'action'",
			default: "'default'",
			description:
				'The visual style of the indicator. An unknown runtime value normalises to `default`.'
		},
		{
			prop: 'color',
			type: "'default' | 'success' | 'info' | 'warning' | 'error'",
			default: "'default'",
			description:
				'The colour theme of the indicator, independent of `variant`. An unknown runtime value normalises to `default`.'
		},
		...partProps
	];

	const trendProps = [
		{
			prop: 'trend',
			type: "'up' | 'down' | 'neutral'",
			default: 'undefined',
			description:
				'The trend direction. When unset, `data-trend` is absent and the neutral/muted styling is applied.'
		},
		...partProps
	];

	const separatorProps = [
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the composed Separator.'
		},
		{
			prop: 'orientation',
			type: "'horizontal' | 'vertical'",
			default: "'horizontal'",
			description: 'Owned by `bits-ui`; not restated by this part.'
		},
		{
			prop: 'decorative',
			type: 'boolean',
			default: 'false',
			description: 'When true, the separator has `role="none"` instead of `role="separator"`.'
		},
		{
			prop: 'class',
			type: 'ClassValue',
			default: '—',
			description: 'Merged with the base `my-2` margin rather than replacing it.'
		},
		{
			prop: '...restProps',
			type: 'Separator.RootProps',
			default: '—',
			description: 'The rest of the composed Separator’s props.'
		}
	];

	const dataAttributes = [
		{ attribute: '[data-slot]', part: 'Stat', values: 'stat' },
		{ attribute: '[data-slot]', part: 'Stat.Label', values: 'stat-label' },
		{ attribute: '[data-slot]', part: 'Stat.Indicator', values: 'stat-indicator' },
		{ attribute: '[data-slot]', part: 'Stat.Value', values: 'stat-value' },
		{ attribute: '[data-slot]', part: 'Stat.Trend', values: 'stat-trend' },
		{ attribute: '[data-slot]', part: 'Stat.Separator', values: 'stat-separator' },
		{ attribute: '[data-slot]', part: 'Stat.Description', values: 'stat-description' },
		{
			attribute: '[data-variant]',
			part: 'Stat.Indicator',
			values: 'default | icon | badge | action'
		},
		{
			attribute: '[data-color]',
			part: 'Stat.Indicator',
			values: 'default | success | info | warning | error'
		},
		{
			attribute: '[data-trend]',
			part: 'Stat.Trend',
			values: 'up | down | neutral (absent when unset)'
		}
	];
</script>

<svelte:head>
	<title>Stat — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Stat</h1>
		<p class="text-muted-foreground">
			A card for a key metric — label, value, colour-themed indicator, trend, separator and
			description — laid out on a two-column grid that positions its parts by slot.
		</p>
	</div>

	<ComponentPreview title="Default" description="Mirrors stat-demo.tsx.">
		<div class="grid gap-4 sm:grid-cols-2">
			<Stat.Root>
				<Stat.Label>Total Revenue</Stat.Label>
				<Stat.Indicator variant="icon" color="success">
					<DollarSignIcon />
				</Stat.Indicator>
				<Stat.Value>$45,231</Stat.Value>
				<Stat.Trend trend="up">
					<ArrowUpIcon />
					+20.1% from last month
				</Stat.Trend>
			</Stat.Root>

			<Stat.Root>
				<Stat.Label>Active Users</Stat.Label>
				<Stat.Indicator variant="badge" color="info">+24</Stat.Indicator>
				<Stat.Value>2,350</Stat.Value>
				<Stat.Trend trend="up">
					<ArrowUpIcon />
					+180 from last week
				</Stat.Trend>
			</Stat.Root>

			<Stat.Root>
				<Stat.Label>Total Orders</Stat.Label>
				<Stat.Indicator variant="icon" color="warning">
					<ShoppingCartIcon />
				</Stat.Indicator>
				<Stat.Value>1,234</Stat.Value>
				<Stat.Trend trend="down">
					<ArrowDownIcon />
					-4.3% from last month
				</Stat.Trend>
			</Stat.Root>

			<Stat.Root>
				<Stat.Label>Conversion Rate</Stat.Label>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger aria-label="Conversion rate actions">
						<Stat.Indicator variant="action">
							<EllipsisIcon aria-hidden="true" />
						</Stat.Indicator>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end">
						<DropdownMenu.Item>View details</DropdownMenu.Item>
						<DropdownMenu.Item>Export data</DropdownMenu.Item>
						<DropdownMenu.Item>Share</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
				<Stat.Value>3.2%</Stat.Value>
				<Stat.Trend trend="neutral">No change from last week</Stat.Trend>
			</Stat.Root>
		</div>
	</ComponentPreview>

	<ComponentPreview title="Variants" description="Mirrors stat-variants-demo.tsx.">
		<div class="grid gap-4 sm:grid-cols-2">
			<Stat.Root>
				<Stat.Label>Default Indicator</Stat.Label>
				<Stat.Value>2,350</Stat.Value>
				<Stat.Indicator>
					<TrendingUpIcon />
				</Stat.Indicator>
			</Stat.Root>

			<Stat.Root>
				<Stat.Label>Icon Variant</Stat.Label>
				<Stat.Value>$45,231</Stat.Value>
				<Stat.Indicator variant="icon" color="success">
					<DollarSignIcon />
				</Stat.Indicator>
			</Stat.Root>

			<Stat.Root>
				<Stat.Label>Badge Variant</Stat.Label>
				<Stat.Value>1,234</Stat.Value>
				<Stat.Indicator variant="badge" color="info">+24</Stat.Indicator>
			</Stat.Root>

			<Stat.Root>
				<Stat.Label>Warning Color</Stat.Label>
				<Stat.Value>89%</Stat.Value>
				<Stat.Indicator variant="icon" color="warning">
					<TrendingUpIcon />
				</Stat.Indicator>
				<Stat.Trend trend="down">Capacity threshold reached</Stat.Trend>
			</Stat.Root>
		</div>
	</ComponentPreview>

	<ComponentPreview title="Layout Options" description="Mirrors stat-layout-demo.tsx.">
		<div class="grid gap-4 sm:grid-cols-2">
			<Stat.Root>
				<Stat.Label>Active Subscribers</Stat.Label>
				<Stat.Value>2,847</Stat.Value>
				<Stat.Indicator variant="icon" color="success">
					<UsersIcon />
				</Stat.Indicator>
				<Stat.Description>Total number of active subscribers as of today</Stat.Description>
			</Stat.Root>

			<Stat.Root>
				<Stat.Label>Monthly Revenue</Stat.Label>
				<Stat.Value>$12,450</Stat.Value>
				<Stat.Indicator variant="icon" color="info">
					<ArrowUpIcon />
				</Stat.Indicator>
				<Stat.Separator />
				<Stat.Trend trend="up">
					<ArrowUpIcon />
					+15.3% from last month
				</Stat.Trend>
				<Stat.Description>Revenue generated in the current billing period</Stat.Description>
			</Stat.Root>
		</div>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Stat</h3>
			<p class="text-sm text-muted-foreground">
				The card container. A two-column grid that positions its children by <code>data-slot</code>
				identity rather than DOM order.
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
			<h3 class="text-lg font-medium">Stat.Label</h3>
			<p class="text-sm text-muted-foreground">
				Small, muted, medium-weight text naming the metric.
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
			<h3 class="text-lg font-medium">Stat.Indicator</h3>
			<p class="text-sm text-muted-foreground">
				The optional visual accent — an icon, badge, or interactive-looking control.
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
					{#each indicatorProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Stat.Value</h3>
			<p class="text-sm text-muted-foreground">
				The metric's primary figure, emphasised typographically. No truncation or forced
				non-wrapping is applied.
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
			<h3 class="text-lg font-medium">Stat.Trend</h3>
			<p class="text-sm text-muted-foreground">
				Directional text describing change versus a prior period.
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
					{#each trendProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Stat.Separator</h3>
			<p class="text-sm text-muted-foreground">
				A full-width divider between grouped content, composing this project's existing
				<code>Separator</code>.
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
					{#each separatorProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Stat.Description</h3>
			<p class="text-sm text-muted-foreground">
				Small, muted supplementary text spanning the card's full width.
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
