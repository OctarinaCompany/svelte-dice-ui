<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';
	import * as Scroller from '$lib/components/ui/scroller/index.js';
	import * as Table from '$lib/components/ui/table/index.js';

	const manyCards = Array.from({ length: 100 }, (_, index) => index + 1);
	const someCards = Array.from({ length: 20 }, (_, index) => index + 1);
	const fewCards = Array.from({ length: 10 }, (_, index) => index + 1);

	const rootProps = [
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<div>`. Stays `null` in `child` mode.'
		},
		{
			prop: 'orientation',
			type: '"vertical" | "horizontal"',
			default: '"vertical"',
			description: 'The scroll direction of the container, and which pair of edges gets a fade.'
		},
		{
			prop: 'hideScrollbar',
			type: 'boolean',
			default: 'false',
			description: 'Hide the native scrollbar while keeping the container fully scrollable.'
		},
		{
			prop: 'size',
			type: 'number',
			default: '40',
			description: 'Size of the scroll shadow in pixels, published as `--scroll-shadow-size`.'
		},
		{
			prop: 'offset',
			type: 'number',
			default: '0',
			description:
				'Offset for scroll shadow visibility. Gates both cues and the leading button, but not the trailing button.'
		},
		{
			prop: 'withNavigation',
			type: 'boolean',
			default: 'false',
			description: 'Overlay directional buttons on the container, one per direction with content.'
		},
		{
			prop: 'scrollStep',
			type: 'number',
			default: '40',
			description: 'Pixels moved per navigation step. Ignored when `withNavigation` is false.'
		},
		{
			prop: 'scrollTriggerMode',
			type: '"press" | "hover" | "click"',
			default: '"press"',
			description:
				'`press` and `hover` repeat every 50ms while held or hovered; `click` moves one step per activation.'
		},
		{
			prop: 'dir',
			type: '"ltr" | "rtl"',
			default: '_resolved_',
			description:
				'Explicit text direction. Falls back to the nearest `<DirectionProvider>`, then an ancestor `[dir]`, then `"ltr"` (divergence D-01/D-06).'
		},
		{
			prop: 'class',
			type: 'string',
			default: '—',
			description: 'Merged last, so it always overrides the component classes.'
		},
		{
			prop: 'style',
			type: 'string',
			default: '—',
			description: 'Appended after `--scroll-shadow-size`, so a caller declaration wins.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: 'The scrollable content. Not rendered in `child` mode.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description:
				'Render the scroller onto your own element. Replaces upstream `asChild`; spreading `props` also registers that element for measurement.'
		}
	];

	const dataAttributes = [
		{
			part: 'Scroller.Root',
			attribute: '[data-orientation]',
			value: '"vertical" | "horizontal"'
		},
		{
			part: 'Scroller.Root',
			attribute: '[data-hide-scrollbar]',
			value: 'Present when `hideScrollbar`'
		},
		{
			part: 'Scroller.Root',
			attribute: '[data-top-scroll]',
			value: '"true" when only content above is hidden'
		},
		{
			part: 'Scroller.Root',
			attribute: '[data-bottom-scroll]',
			value: '"true" when only content below is hidden'
		},
		{
			part: 'Scroller.Root',
			attribute: '[data-top-bottom-scroll]',
			value: '"true" when both vertical ends hide content'
		},
		{
			part: 'Scroller.Root',
			attribute: '[data-left-scroll]',
			value: '"true" when only content to the physical left is hidden'
		},
		{
			part: 'Scroller.Root',
			attribute: '[data-right-scroll]',
			value: '"true" when only content to the physical right is hidden'
		},
		{
			part: 'Scroller.Root',
			attribute: '[data-left-right-scroll]',
			value: '"true" when both horizontal ends hide content'
		},
		{ part: 'Scroller.Root', attribute: '[dir]', value: '"ltr" | "rtl" — the resolved direction' },
		{
			part: 'Navigation wrapper',
			attribute: '[data-slot="scroller-wrapper"]',
			value: 'Present only when `withNavigation`'
		},
		{
			part: 'Navigation button',
			attribute: '[data-direction]',
			value: '"up" | "down" | "left" | "right"'
		},
		{
			part: 'Navigation button',
			attribute: '[data-trigger-mode]',
			value: '"press" | "hover" | "click"'
		}
	];

	const cssVariables = [
		{
			variable: '--scroll-shadow-size',
			default: '40px',
			description: 'How far each edge fade reaches into the content. Set from the `size` prop.'
		}
	];

	const divergences = [
		{
			id: 'D-01',
			kind: 'Addition',
			description:
				'Horizontal edge cues and navigation buttons follow the content’s visual start/end, resolved through `<DirectionProvider>`. Upstream treats left and right as fixed physical sides.'
		},
		{
			id: 'D-02',
			kind: 'Addition',
			description:
				'The container and each of its element children are observed with a `ResizeObserver` (kept current by a `childList` `MutationObserver`), so late-loading or added content recomputes the cues. `pointercancel` also stops a held repeat.'
		},
		{
			id: 'D-03',
			kind: 'Rename',
			description:
				'The navigation button emits `data-slot="scroller-button"` instead of upstream’s `data-slot="scroll-button"`, and the wrapper, orientation, hidden-scrollbar, direction and trigger mode are all exposed as `data-*` attributes.'
		},
		{
			id: 'D-04',
			kind: 'Addition',
			description:
				'Navigation buttons are keyboard-operable: Enter/Space start the `press` repeat and keyup/blur stop it, focus/blur start and stop the `hover` repeat. Upstream wires pointer events only.'
		},
		{
			id: 'D-05',
			kind: 'Addition',
			description:
				'Each navigation button carries a direction-specific `aria-label`, an `aria-hidden` chevron and a visible focus ring.'
		},
		{
			id: 'D-06',
			kind: 'Addition',
			description: 'An explicit `dir` prop, the highest-priority input to the D-01 resolution.'
		},
		{
			id: 'D-07',
			kind: 'Documented omission',
			description:
				'The container is not focusable by default — an unnamed focus stop on every scroller would be a regression. Forward `tabindex`, `role` and `aria-label` to opt in, as the navigation example below does.'
		}
	];
</script>

<svelte:head>
	<title>Scroller — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Scroller</h1>
		<p class="text-muted-foreground">
			A scrollable container with customizable scroll shadows and navigation buttons.
		</p>
	</div>

	<ComponentPreview
		title="Default"
		description="Mirrors scroller-demo.tsx — the fade sits at the bottom at rest, at both ends mid-scroll and at the top once the content is exhausted."
		class="h-[400px]"
	>
		<Scroller.Root class="flex h-80 w-full flex-col gap-2.5 p-4">
			{#each manyCards as card (card)}
				<div class="flex h-40 flex-col rounded-md bg-accent p-4">
					<div class="text-lg font-medium">Card {card}</div>
					<span class="text-sm text-muted-foreground">This is a card description.</span>
				</div>
			{/each}
		</Scroller.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Horizontal Scroll"
		description="Mirrors scroller-horizontal-demo.tsx — rendered through the child snippet onto the consumer’s own flex row, which stays fully measured."
	>
		<Scroller.Root orientation="horizontal" class="flex w-full items-center gap-2.5 p-4">
			{#snippet child({ props })}
				<div {...props}>
					{#each fewCards as card (card)}
						<div
							class="flex h-32 w-[180px] shrink-0 flex-col items-center justify-center rounded-md bg-accent p-4"
						>
							<div class="text-lg font-medium">Card {card}</div>
							<span class="text-sm text-muted-foreground">Scroll horizontally</span>
						</div>
					{/each}
				</div>
			{/snippet}
		</Scroller.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Hidden Scrollbar"
		description="Mirrors scroller-hidden-demo.tsx — no native scrollbar, while wheel, touch and keyboard scrolling all keep working."
		class="h-[400px]"
	>
		<Scroller.Root hideScrollbar class="flex h-80 w-full flex-col gap-2.5 p-4">
			{#each someCards as card (card)}
				<div class="flex h-40 flex-col rounded-md bg-accent p-4">
					<div class="text-lg font-medium">Card {card}</div>
					<span class="text-sm text-muted-foreground">
						Scroll smoothly without visible scrollbars
					</span>
				</div>
			{/each}
		</Scroller.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Navigation Buttons"
		description="Mirrors scroller-navigation-demo.tsx — press and hold a chevron to scroll continuously. tabindex, role and aria-label are forwarded so the container itself is keyboard-scrollable (divergence D-07)."
		class="h-[400px]"
	>
		<Scroller.Root
			hideScrollbar
			withNavigation
			scrollTriggerMode="press"
			tabindex={0}
			role="region"
			aria-label="Scrollable cards"
			class="flex h-80 w-full flex-col gap-2.5 rounded-md p-4 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
		>
			{#each fewCards as card (card)}
				<div class="flex flex-col rounded-md bg-accent p-4">
					<div class="text-lg font-medium">Card {card}</div>
					<span class="text-sm text-muted-foreground">Use the navigation arrows to scroll</span>
				</div>
			{/each}
		</Scroller.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With RTL"
		description="The horizontal example under an ambient right-to-left direction — at rest the fade and the navigation button sit on the content’s true start, which is now the left (SC-007)."
	>
		<DirectionProvider dir="rtl">
			<Scroller.Root
				orientation="horizontal"
				withNavigation
				hideScrollbar
				class="flex w-full items-center gap-2.5 p-4"
			>
				{#snippet child({ props })}
					<div {...props}>
						{#each fewCards as card (card)}
							<div
								class="flex h-32 w-[180px] shrink-0 flex-col items-center justify-center rounded-md bg-accent p-4"
							>
								<div class="text-lg font-medium">بطاقة {card}</div>
								<span class="text-sm text-muted-foreground">مرر أفقياً</span>
							</div>
						{/each}
					</div>
				{/snippet}
			</Scroller.Root>
		</DirectionProvider>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Scroller (Root)</h3>
			<p class="text-sm text-muted-foreground">
				The native <code>overflow-auto</code> container. It measures its own scroll position,
				publishes
				<code>--scroll-shadow-size</code>, resolves the direction and — when
				<code>withNavigation</code> is set — wraps itself in a <code>relative</code> box holding the directional
				buttons.
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
			<h3 class="text-lg font-medium">Data Attributes</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Part</Table.Head>
						<Table.Head>Attribute</Table.Head>
						<Table.Head>Value</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each dataAttributes as row (row.part + row.attribute)}
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
			<h3 class="text-lg font-medium">CSS Variables</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Variable</Table.Head>
						<Table.Head>Default</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each cssVariables as row (row.variable)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.variable}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.default}</Table.Cell>
							<Table.Cell>{row.description}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Keyboard Interactions</h3>
			<p class="text-sm text-muted-foreground">
				On the navigation buttons. The container itself becomes keyboard-scrollable once you forward <code
					>tabindex</code
				>, <code>role</code> and an accessible name.
			</p>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Key</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					<Table.Row>
						<Table.Cell class="font-medium">Tab</Table.Cell>
						<Table.Cell>Moves focus onto a visible navigation button.</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell class="font-medium">Enter</Table.Cell>
						<Table.Cell>
							In <code>press</code> mode, holding it scrolls continuously and releasing stops. In
							<code>click</code> mode it scrolls exactly one step.
						</Table.Cell>
					</Table.Row>
					<Table.Row>
						<Table.Cell class="font-medium">Space</Table.Cell>
						<Table.Cell>
							Same as Enter in <code>press</code> mode; page scrolling is suppressed while held.
						</Table.Cell>
					</Table.Row>
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Divergences from upstream</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>ID</Table.Head>
						<Table.Head>Kind</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each divergences as row (row.id)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.id}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.kind}</Table.Cell>
							<Table.Cell>{row.description}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</section>
</article>
