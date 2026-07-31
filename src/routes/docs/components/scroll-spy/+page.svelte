<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import * as ScrollSpy from '$lib/components/ui/scroll-spy/index.js';
	import * as Table from '$lib/components/ui/table/index.js';

	// One scroll container per example: each `<ScrollSpy.Viewport>` publishes its element, and the
	// root tracks and scrolls that element instead of the window.
	let defaultContainer = $state<HTMLDivElement | null>(null);
	let verticalContainer = $state<HTMLDivElement | null>(null);
	let controlledContainer = $state<HTMLDivElement | null>(null);

	let controlledValue = $state('getting-started');

	const guideSections = [
		{
			value: 'introduction',
			title: 'Introduction',
			body: 'Scroll Spy automatically updates navigation links based on scroll position.'
		},
		{
			value: 'getting-started',
			title: 'Getting Started',
			body: 'Install the component using the CLI or copy the source code.'
		},
		{
			value: 'usage',
			title: 'Usage',
			body: 'Compose the Root, Nav, Link, Viewport and Section parts to build your navigation.'
		},
		{
			value: 'api-reference',
			title: 'API Reference',
			body: 'Complete API documentation for all Scroll Spy parts.'
		}
	];

	const featureSections = [
		{
			value: 'overview',
			title: 'Overview',
			body: 'A vertical layout stacks the nav above the content.'
		},
		{ value: 'features', title: 'Features', body: 'All the features available in this component.' },
		{
			value: 'installation',
			title: 'Installation',
			body: 'How to install and set up the component.'
		},
		{ value: 'examples', title: 'Examples', body: 'Various examples showing different use cases.' },
		{ value: 'api', title: 'API', body: 'Complete API documentation for all components.' }
	];

	const rootProps = [
		{
			prop: 'value',
			type: 'string',
			default: '—',
			description: 'The active section id. Bindable; controlled when bound or passed.'
		},
		{
			prop: 'defaultValue',
			type: 'string',
			default: '—',
			description: 'Seeds `value` once when the component is uncontrolled.'
		},
		{
			prop: 'onValueChange',
			type: '(value: string) => void',
			default: '—',
			description: 'Called on every change to a non-empty active section id.'
		},
		{
			prop: 'rootMargin',
			type: 'string',
			default: '`${-offset}px 0px -70% 0px`',
			description: 'Passed to the IntersectionObserver; shrinks the observation band.'
		},
		{
			prop: 'threshold',
			type: 'number | number[]',
			default: '0.1',
			description: 'Passed to the IntersectionObserver.'
		},
		{
			prop: 'offset',
			type: 'number',
			default: '0',
			description: 'Pixels subtracted from the scroll destination. Also drives `rootMargin`.'
		},
		{
			prop: 'scrollBehavior',
			type: 'ScrollBehavior',
			default: '"smooth" ("auto" under reduced motion)',
			description: 'How a link-triggered scroll animates.'
		},
		{
			prop: 'scrollContainer',
			type: 'HTMLElement | null',
			default: 'null',
			description: 'Element to track and scroll. `null` tracks the window.'
		},
		{
			prop: 'dir',
			type: '"ltr" | "rtl"',
			default: 'Resolved',
			description: 'Falls back to the nearest `<DirectionProvider>`, then the DOM, then `"ltr"`.'
		},
		{
			prop: 'orientation',
			type: '"horizontal" | "vertical"',
			default: '"horizontal"',
			description: 'Layout axis, published as `data-orientation` on every part.'
		},
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<div>`.'
		},
		{
			prop: 'class',
			type: 'string',
			default: '—',
			description: 'Merged last through `cn()`.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the root onto your own element.'
		}
	];

	const navProps = [
		{
			prop: 'ref',
			type: 'HTMLElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<nav>`.'
		},
		{
			prop: 'class',
			type: 'string',
			default: '—',
			description: 'Merged last through `cn()`.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the navigation onto your own element.'
		}
	];

	const linkProps = [
		{
			prop: 'value',
			type: 'string',
			default: '— (required)',
			description: 'The id of the section this link targets; becomes `href="#value"`.'
		},
		{
			prop: 'onclick',
			type: '(event: MouseEvent) => void',
			default: '—',
			description: 'Runs after the default navigation is suppressed, before the scroll.'
		},
		{
			prop: 'ref',
			type: 'HTMLAnchorElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<a>`.'
		},
		{
			prop: 'class',
			type: 'string',
			default: '—',
			description: 'Merged last through `cn()`.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the link onto your own element. `href` is omitted in this mode.'
		}
	];

	const viewportProps = [
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<div>`; hand it to `scrollContainer`.'
		},
		{
			prop: 'class',
			type: 'string',
			default: '—',
			description: 'Merged last through `cn()`.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the viewport onto your own element.'
		}
	];

	const sectionProps = [
		{
			prop: 'value',
			type: 'string',
			default: '— (required)',
			description: 'Becomes the element `id` and registers it for tracking.'
		},
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<div>`.'
		},
		{
			prop: 'class',
			type: 'string',
			default: '—',
			description: 'Passed straight through; the section carries no default classes.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the section onto your own element.'
		}
	];

	const propTables = [
		{ part: 'ScrollSpy.Root', rows: rootProps },
		{ part: 'ScrollSpy.Nav', rows: navProps },
		{ part: 'ScrollSpy.Link', rows: linkProps },
		{ part: 'ScrollSpy.Viewport', rows: viewportProps },
		{ part: 'ScrollSpy.Section', rows: sectionProps }
	];

	const dataAttributes = [
		{ part: 'ScrollSpy.Root', attribute: '[data-orientation]', value: '"horizontal" | "vertical"' },
		{ part: 'ScrollSpy.Nav', attribute: '[data-orientation]', value: '"horizontal" | "vertical"' },
		{ part: 'ScrollSpy.Link', attribute: '[data-orientation]', value: '"horizontal" | "vertical"' },
		{ part: 'ScrollSpy.Link', attribute: '[data-state]', value: '"active" | "inactive"' },
		{
			part: 'ScrollSpy.Viewport',
			attribute: '[data-orientation]',
			value: '"horizontal" | "vertical"'
		},
		{
			part: 'ScrollSpy.Section',
			attribute: '[data-orientation]',
			value: '"horizontal" | "vertical"'
		}
	];
</script>

<svelte:head>
	<title>Scroll Spy — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Scroll Spy</h1>
		<p class="text-muted-foreground">
			Navigation links that track scroll position and scroll to their section on click, with support
			for nested sections and customizable behavior.
		</p>
	</div>

	<ComponentPreview
		title="Default (Horizontal)"
		description="Mirrors scroll-spy-demo.tsx — the viewport is the tracked scroll container."
		class="items-stretch"
	>
		<ScrollSpy.Root offset={16} scrollContainer={defaultContainer} class="h-[400px] w-full border">
			<ScrollSpy.Nav aria-label="Default example sections" class="w-40 border-r p-4">
				{#each guideSections as section (section.value)}
					<ScrollSpy.Link value={section.value}>{section.title}</ScrollSpy.Link>
				{/each}
			</ScrollSpy.Nav>
			<ScrollSpy.Viewport bind:ref={defaultContainer} class="overflow-y-auto p-4">
				{#each guideSections as section (section.value)}
					<ScrollSpy.Section value={section.value}>
						<h2 class="text-2xl font-bold">{section.title}</h2>
						<p class="mt-2 text-muted-foreground">{section.body}</p>
						<div class="mt-4 h-64 rounded-lg bg-accent"></div>
					</ScrollSpy.Section>
				{/each}
			</ScrollSpy.Viewport>
		</ScrollSpy.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Vertical Orientation"
		description="Mirrors scroll-spy-vertical-demo.tsx — the nav sits above the content."
		class="items-stretch"
	>
		<ScrollSpy.Root
			offset={10}
			orientation="vertical"
			scrollContainer={verticalContainer}
			class="h-[400px] w-full border"
		>
			<ScrollSpy.Nav aria-label="Vertical example sections" class="border-b p-4">
				{#each featureSections as section (section.value)}
					<ScrollSpy.Link value={section.value}>{section.title}</ScrollSpy.Link>
				{/each}
			</ScrollSpy.Nav>
			<ScrollSpy.Viewport bind:ref={verticalContainer} class="overflow-y-auto p-4">
				{#each featureSections as section (section.value)}
					<ScrollSpy.Section value={section.value} class="min-w-[400px]">
						<h2 class="text-2xl font-bold">{section.title}</h2>
						<p class="mt-2 text-muted-foreground">{section.body}</p>
						<div class="mt-4 h-64 rounded-lg bg-accent"></div>
					</ScrollSpy.Section>
				{/each}
			</ScrollSpy.Viewport>
		</ScrollSpy.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Controlled"
		description="Mirrors scroll-spy-controlled-demo.tsx — the page owns the active section."
		class="flex-col items-stretch gap-4"
	>
		<p class="text-sm text-muted-foreground">
			Active section: <span class="font-medium text-foreground">{controlledValue}</span>
		</p>
		<ScrollSpy.Root
			offset={16}
			scrollContainer={controlledContainer}
			bind:value={controlledValue}
			class="h-[400px] w-full border"
		>
			<ScrollSpy.Nav aria-label="Controlled example sections" class="w-40 border-r p-4">
				{#each guideSections as section (section.value)}
					<ScrollSpy.Link value={section.value}>{section.title}</ScrollSpy.Link>
				{/each}
			</ScrollSpy.Nav>
			<ScrollSpy.Viewport bind:ref={controlledContainer} class="overflow-y-auto p-4">
				{#each guideSections as section (section.value)}
					<ScrollSpy.Section value={section.value}>
						<h2 class="text-2xl font-bold">{section.title}</h2>
						<p class="mt-2 text-muted-foreground">{section.body}</p>
						<div class="mt-4 h-64 rounded-lg bg-accent"></div>
					</ScrollSpy.Section>
				{/each}
			</ScrollSpy.Viewport>
		</ScrollSpy.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Sticky Layout"
		description="Mirrors the MDX example — no scrollContainer, so the window scrolls and a sticky nav stays visible."
		class="items-stretch"
	>
		<ScrollSpy.Root offset={100} class="w-full">
			<ScrollSpy.Nav
				aria-label="Sticky layout example sections"
				class="sticky top-20 h-fit w-40 shrink-0"
			>
				{#each guideSections as section (section.value)}
					<ScrollSpy.Link value={`sticky-${section.value}`}>{section.title}</ScrollSpy.Link>
				{/each}
			</ScrollSpy.Nav>
			<ScrollSpy.Viewport class="pl-4">
				{#each guideSections as section (section.value)}
					<ScrollSpy.Section value={`sticky-${section.value}`}>
						<h2 class="text-2xl font-bold">{section.title}</h2>
						<p class="mt-2 text-muted-foreground">{section.body}</p>
					</ScrollSpy.Section>
				{/each}
			</ScrollSpy.Viewport>
		</ScrollSpy.Root>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		{#each propTables as table (table.part)}
			<div class="flex flex-col gap-3">
				<h3 class="text-base font-medium tracking-tight">{table.part}</h3>
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
						{#each table.rows as row (row.prop)}
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
		{/each}

		<div class="flex flex-col gap-3">
			<h3 class="text-base font-medium tracking-tight">Data attributes</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Part</Table.Head>
						<Table.Head>Attribute</Table.Head>
						<Table.Head>Value</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each dataAttributes as row (`${row.part}-${row.attribute}`)}
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
