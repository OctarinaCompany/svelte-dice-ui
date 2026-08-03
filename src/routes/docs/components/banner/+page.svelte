<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import * as Banner from '$lib/components/ui/banner/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import CheckCircleIcon from '@lucide/svelte/icons/circle-check';
	import InfoIcon from '@lucide/svelte/icons/info';

	import BannerControls from './banner-controls.svelte';

	let open = $state(true);
	let uncontrolledOpen = $state(true);

	const rootProps = [
		{ prop: 'ref', type: 'HTMLDivElement | null', default: 'null', bindable: true },
		{ prop: 'open', type: 'boolean | undefined', default: 'undefined', bindable: true },
		{ prop: 'defaultOpen', type: 'boolean', default: 'true', bindable: false },
		{ prop: 'onOpenChange', type: '(open: boolean) => void', default: '—', bindable: false },
		{
			prop: 'onDismiss',
			type: '() => void',
			default: '—',
			bindable: false,
			note: 'queued only'
		},
		{
			prop: 'variant',
			type: "'default' | 'info' | 'success' | 'warning' | 'destructive'",
			default: "'default'",
			bindable: false
		},
		{
			prop: 'priority',
			type: 'number | undefined',
			default: 'undefined',
			bindable: false,
			note: 'queued only'
		},
		{
			prop: 'duration',
			type: 'number | undefined',
			default: 'undefined',
			bindable: false,
			note: 'queued only'
		},
		{ prop: 'dismissible', type: 'boolean', default: 'true', bindable: false },
		{
			prop: 'child',
			type: 'Snippet<[{ props: BannerChildProps }]>',
			default: '—',
			bindable: false
		},
		{ prop: 'children', type: 'Snippet', default: '—', bindable: false }
	];

	const queueProps = [
		{ prop: 'maxVisible', type: 'number', default: '1' },
		{ prop: 'side', type: "'top' | 'bottom'", default: "'top'" },
		{ prop: 'strategy', type: "'fixed' | 'static' | 'sticky' | 'absolute'", default: "'fixed'" },
		{ prop: 'container', type: 'Element | string | null', default: 'undefined' },
		{ prop: 'children', type: 'Snippet', default: '—' }
	];

	const closeProps = [
		{ prop: 'disabled', type: 'boolean', default: 'undefined ⇒ !dismissible' },
		{ prop: 'onclick', type: '(event: MouseEvent) => void', default: '—' },
		{ prop: 'children', type: 'Snippet', default: '<XIcon />' },
		{ prop: 'variant', type: 'ButtonVariant', default: "'ghost'" },
		{ prop: 'size', type: 'ButtonSize', default: "'icon-sm'" }
	];

	const dataAttributes = [
		{ attribute: '[data-slot]', part: 'Banner', values: 'banner' },
		{ attribute: '[data-state]', part: 'Banner', values: 'open' },
		{
			attribute: '[data-variant]',
			part: 'Banner',
			values: 'default | info | success | warning | destructive'
		},
		{ attribute: '[data-slot]', part: 'Banner.Queue container', values: 'banner-container' },
		{ attribute: '[data-side]', part: 'Banner.Queue container', values: 'top | bottom' },
		{
			attribute: '[data-strategy]',
			part: 'Banner.Queue container',
			values: 'fixed | static | sticky | absolute'
		},
		{
			attribute: '[data-slot]',
			part: 'Banner.Icon / Content / Title / Description / Actions / Close',
			values:
				'banner-icon | banner-content | banner-title | banner-description | banner-actions | banner-close'
		}
	];

	const errors = [
		{
			component: 'Banner.Close',
			message: '`<Banner.Close>` must be used within `<Banner.Root>`.'
		},
		{
			component: 'getBannersContext(name)',
			message: '`${name}` must be used within `<Banner.Queue>`.'
		}
	];
</script>

<svelte:head>
	<title>Banner — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Banner</h1>
		<p class="text-muted-foreground">
			A notification banner that appears at the top or bottom of the viewport. Supports queuing,
			priority, and auto-dismiss.
		</p>
	</div>

	<ComponentPreview title="Default" description="Mirrors banner-demo.tsx.">
		<div class="flex w-full flex-col gap-3">
			<Banner.Root bind:open>
				<Banner.Icon><InfoIcon /></Banner.Icon>
				<Banner.Content>
					<Banner.Title>New update available</Banner.Title>
					<Banner.Description>
						A new version of the app is available. Update now to get the latest features.
					</Banner.Description>
				</Banner.Content>
				<Banner.Actions>
					<Button size="sm">Update now</Button>
					<Banner.Close />
				</Banner.Actions>
			</Banner.Root>
			{#if !open}
				<Button onclick={() => (open = true)}>Show banner</Button>
			{/if}
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="Uncontrolled"
		description="defaultOpen seeds the banner once; the internal state drives every render after that."
	>
		<div class="flex w-full flex-col gap-3">
			<Banner.Root
				variant="success"
				defaultOpen={true}
				onOpenChange={(next) => (uncontrolledOpen = next)}
			>
				<Banner.Icon><CheckCircleIcon /></Banner.Icon>
				<Banner.Content>
					<Banner.Title>Changes saved</Banner.Title>
					<Banner.Description>Your changes have been saved successfully.</Banner.Description>
				</Banner.Content>
				<Banner.Actions>
					<Banner.Close />
				</Banner.Actions>
			</Banner.Root>
			<p class="text-sm text-muted-foreground">
				Last reported open state: <code>{uncontrolledOpen}</code>
			</p>
		</div>
	</ComponentPreview>

	<!--
		The preview canvas is a centred flex row by default, which would sit the stack beside the
		controls rather than above them.
	-->
	<ComponentPreview
		title="Stacked Banners"
		description="Mirrors banner-stacked-demo.tsx. Uses strategy=&quot;static&quot; and maxVisible={3} here so the
			stack renders inside the preview instead of upstream's default fixed / maxVisible=1, which would
			overlay the docs chrome."
		class="flex-col items-stretch justify-start gap-6"
	>
		<Banner.Queue maxVisible={3} side="top" strategy="static">
			<BannerControls />
		</Banner.Queue>
	</ComponentPreview>

	<ComponentPreview title="Variants" description="Every severity, side by side.">
		<div class="flex w-full flex-col gap-3">
			{#each Banner.BANNER_VARIANTS as variant (variant)}
				<Banner.Root {variant} defaultOpen={true} dismissible={false}>
					<Banner.Content>
						<Banner.Title class="capitalize">{variant}</Banner.Title>
					</Banner.Content>
				</Banner.Root>
			{/each}
		</div>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Banner</h3>
			<p class="text-sm text-muted-foreground">
				An individual banner. Usable standalone, or registered into a <code>Banner.Queue</code>.
			</p>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Prop</Table.Head>
						<Table.Head>Type</Table.Head>
						<Table.Head>Default</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each rootProps as row (row.prop)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.prop}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.type}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.default}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Banner.Queue</h3>
			<p class="text-sm text-muted-foreground">
				The queue provider. Renders no props of its own onto a DOM element.
			</p>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Prop</Table.Head>
						<Table.Head>Type</Table.Head>
						<Table.Head>Default</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each queueProps as row (row.prop)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.prop}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.type}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.default}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Banner.Close</h3>
			<p class="text-sm text-muted-foreground">Composes the shadcn Button internally.</p>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Prop</Table.Head>
						<Table.Head>Type</Table.Head>
						<Table.Head>Default</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each closeProps as row (row.prop)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.prop}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.type}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.default}</Table.Cell>
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

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Errors</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Component</Table.Head>
						<Table.Head>Message</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each errors as row (row.component)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.component}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.message}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</section>
</article>
