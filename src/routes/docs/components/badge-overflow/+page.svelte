<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as BadgeOverflow from '$lib/components/ui/badge-overflow/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Table from '$lib/components/ui/table/index.js';

	const tags = [
		'React',
		'TypeScript',
		'Next.js',
		'Tailwind CSS',
		'Shadcn UI',
		'Radix UI',
		'Zustand',
		'React Query',
		'Prisma',
		'PostgreSQL'
	];

	const technologies = [
		'React',
		'TypeScript',
		'Next.js',
		'Tailwind CSS',
		'Shadcn UI',
		'Radix UI',
		'Zustand',
		'React Query',
		'Prisma',
		'PostgreSQL',
		'Docker',
		'Kubernetes',
		'AWS',
		'Vercel',
		'GitHub Actions'
	];

	type Tag = { label: string; value: string };

	let interactiveTags = $state<Tag[]>([
		{ label: 'React', value: 'react' },
		{ label: 'TypeScript', value: 'typescript' },
		{ label: 'Next.js', value: 'nextjs' },
		{ label: 'Tailwind CSS', value: 'tailwindcss' },
		{ label: 'Shadcn UI', value: 'shadcn-ui' },
		{ label: 'Radix UI', value: 'radix-ui' },
		{ label: 'Zustand', value: 'zustand' },
		{ label: 'React Query', value: 'react-query' },
		{ label: 'Prisma', value: 'prisma' },
		{ label: 'PostgreSQL', value: 'postgresql' },
		{ label: 'MySQL', value: 'mysql' },
		{ label: 'MongoDB', value: 'mongodb' }
	]);
	let inputValue = $state('');

	function onTagAdd() {
		const trimmed = inputValue.trim();
		if (!trimmed) return;
		interactiveTags = [...interactiveTags, { label: trimmed, value: trimmed }];
		inputValue = '';
	}

	function onTagRemove(value: string) {
		interactiveTags = interactiveTags.filter((tag) => tag.value !== value);
	}

	function onInputKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		onTagAdd();
	}

	const rootProps = [
		{
			prop: 'items',
			type: 'T[]',
			default: '—',
			description: 'The items to display as badges. Changing the array re-runs measurement.'
		},
		{
			prop: 'getBadgeLabel',
			type: '(item: T) => string',
			default: '—',
			description:
				'Extracts the label used for measurement. Optional for primitives, required for objects.'
		},
		{
			prop: 'lineCount',
			type: 'number',
			default: '1',
			description: 'Maximum number of lines to fill before the overflow indicator appears.'
		},
		{
			prop: 'badge',
			type: 'Snippet<[item: T, label: string]>',
			default: '—',
			description: 'Replaces upstream `renderBadge`. Must render exactly one element.'
		},
		{
			prop: 'overflow',
			type: 'Snippet<[count: number]>',
			default: '—',
			description: 'Replaces upstream `renderOverflow`. Falls back to the built-in `+N` indicator.'
		},
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the visible container. Stays `null` in `child` mode.'
		},
		{
			prop: 'class',
			type: 'ClassValue',
			default: '—',
			description: 'Merged last, so it overrides the container’s own `flex flex-wrap`.'
		},
		{
			prop: 'style',
			type: 'string | undefined | null',
			default: '—',
			description: 'Appended after the computed `gap`, so the caller wins.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props, content }]>',
			default: '—',
			description:
				'Replaces upstream `asChild`. Spread `props` on your element and render `content` inside it.'
		}
	];

	const indicatorProps = [
		{
			prop: 'count',
			type: 'number',
			default: '—',
			description: 'The hidden-item count, rendered as `+{count}`.'
		},
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<div>`.'
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
			description: 'Overrides the `+{count}` text while keeping the default markup.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Replaces upstream `asChild`.'
		}
	];
</script>

<svelte:head>
	<title>Badge Overflow — svelte-dice-ui</title>
</svelte:head>

{#snippet secondaryBadge(_item: string, label: string)}
	<Badge variant="secondary">{label}</Badge>
{/snippet}

{#snippet outlineBadge(_item: string, label: string)}
	<Badge variant="outline">{label}</Badge>
{/snippet}

{#snippet defaultBadge(_item: string, label: string)}
	<Badge variant="default">{label}</Badge>
{/snippet}

{#snippet secondaryMoreOverflow(count: number)}
	<Badge variant="secondary" class="bg-muted">+{count} more</Badge>
{/snippet}

{#snippet moreOverflow(count: number)}
	<Badge variant="outline" class="bg-muted">+{count} more</Badge>
{/snippet}

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Badge Overflow</h1>
		<p class="text-muted-foreground">
			A component that intelligently manages badge overflow by measuring available space and
			displaying only what fits with an overflow indicator.
		</p>
	</div>

	<ComponentPreview title="Default" description="Mirrors badge-overflow-demo.tsx.">
		<div class="flex w-64 flex-col gap-8">
			<div class="flex flex-col gap-3">
				<h3 class="text-sm font-medium">Badge Overflow</h3>
				<div class="w-64 rounded-md border p-3">
					<BadgeOverflow.Root items={tags} badge={secondaryBadge} />
				</div>
			</div>
			<div class="flex flex-col gap-3">
				<h3 class="text-sm font-medium">Badge Overflow with Custom Overflow</h3>
				<div class="w-64 rounded-md border p-3">
					<BadgeOverflow.Root items={tags} badge={defaultBadge} overflow={secondaryMoreOverflow} />
				</div>
			</div>
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="Multi-line Overflow"
		description="Mirrors badge-overflow-multiline-demo.tsx."
	>
		<div class="flex flex-col gap-8">
			<div class="flex flex-col gap-3">
				<h3 class="text-sm font-medium">Single Line (default)</h3>
				<div class="w-64 rounded-md border p-3">
					<BadgeOverflow.Root items={technologies} badge={secondaryBadge} />
				</div>
			</div>
			<div class="flex flex-col gap-3">
				<h3 class="text-sm font-medium">Two Lines</h3>
				<div class="w-64 rounded-md border p-3">
					<BadgeOverflow.Root items={technologies} lineCount={2} badge={outlineBadge} />
				</div>
			</div>
			<div class="flex flex-col gap-3">
				<h3 class="text-sm font-medium">Three Lines</h3>
				<div class="w-64 rounded-md border p-3">
					<BadgeOverflow.Root items={technologies} lineCount={3} badge={defaultBadge} />
				</div>
			</div>
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="Interactive Tags"
		description="Mirrors badge-overflow-interactive-demo.tsx."
	>
		<div class="flex flex-col gap-6">
			<div class="flex flex-col gap-3">
				<h3 class="text-sm font-medium">Tags with Overflow</h3>
				<div class="w-full max-w-80 rounded-md border p-3">
					<BadgeOverflow.Root
						items={interactiveTags}
						getBadgeLabel={(tag) => tag.label}
						lineCount={2}
						overflow={moreOverflow}
					>
						{#snippet badge(tag, label)}
							<Badge
								variant="secondary"
								class="cursor-pointer"
								onclick={() => onTagRemove(tag.value)}
							>
								<span>{label}</span>
								<XIcon />
							</Badge>
						{/snippet}
					</BadgeOverflow.Root>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<Input
					placeholder="Add a tag..."
					class="max-w-64 flex-1"
					bind:value={inputValue}
					onkeydown={onInputKeydown}
				/>
				<Button type="button" onclick={onTagAdd}>Add</Button>
			</div>
			<div class="flex flex-col gap-px text-sm text-balance text-muted-foreground">
				<p>Click on a badge to remove it.</p>
				<p>Resize the container to see overflow behavior.</p>
			</div>
		</div>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">BadgeOverflow (Root)</h3>
			<p class="text-sm text-muted-foreground">
				Renders an invisible measurement row plus the visible container, and shows only the badges
				that fit across <code>lineCount</code> lines. The immediate container must resolve to a definite
				width for the calculation to have anything to measure against.
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
			<h3 class="text-lg font-medium">BadgeOverflow.Indicator</h3>
			<p class="text-sm text-muted-foreground">
				The built-in <code>+N</code> badge the root renders when no <code>overflow</code> snippet is supplied.
				Exported so you can reuse the default look inside your own snippet.
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
	</section>
</article>
