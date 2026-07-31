<script lang="ts">
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';

	import { ComponentPreview } from '$lib/components/docs/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';
	import * as Sortable from '$lib/components/ui/sortable/index.js';
	import type {
		SortableContentChildProps,
		SortableItemChildProps,
		SortableItemHandleChildProps,
		SortableOrientation
	} from '$lib/components/ui/sortable/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { cn } from '$lib/utils.js';

	type Trick = { id: string; title: string; description: string };
	type TableTrick = { id: string; title: string; difficulty: string; points: number };

	const initialTricks: Trick[] = [
		{ id: '1', title: 'The 900', description: 'Spin 900 degrees in the air.' },
		{ id: '2', title: 'Indy Backflip', description: 'Backflip while grabbing indy.' },
		{ id: '3', title: 'Pizza Guy', description: 'Flip the board like a pizza.' },
		{ id: '4', title: 'Rocket Air', description: 'Point the nose straight up.' },
		{ id: '5', title: 'Kickflip Backflip', description: 'A kickflip inside a backflip.' },
		{ id: '6', title: 'FS 540', description: 'A frontside 540 rotation.' }
	];

	let defaultTricks = $state<Trick[]>([...initialTricks]);
	let overlayTricks = $state<Trick[]>([...initialTricks]);
	let orientationTricks = $state<Trick[]>(initialTricks.slice(0, 4));
	let rtlTricks = $state<Trick[]>(initialTricks.slice(0, 4));

	let tableTricks = $state<TableTrick[]>([
		{ id: '1', title: 'The 900', difficulty: 'Expert', points: 9000 },
		{ id: '2', title: 'Indy Backflip', difficulty: 'Advanced', points: 4000 },
		{ id: '3', title: 'Pizza Guy', difficulty: 'Intermediate', points: 1500 },
		{ id: '4', title: '360 Varial McTwist', difficulty: 'Expert', points: 5000 }
	]);

	let primitiveTricks = $state<string[]>([
		'The 900',
		'Indy Backflip',
		'Pizza Guy',
		'Rocket Air',
		'Kickflip Backflip',
		'FS 540'
	]);

	let orientation = $state<SortableOrientation>('vertical');

	const orientationLayouts: Record<SortableOrientation, string> = {
		vertical: 'flex w-64 flex-col gap-2',
		horizontal: 'flex w-full flex-row gap-2',
		mixed: 'grid w-full grid-cols-2 gap-2'
	};

	const cardClass =
		'flex size-full flex-col gap-1 rounded-md border bg-muted p-4 text-foreground shadow-sm';

	const rootProps = [
		{
			prop: 'value',
			type: 'T[]',
			default: '—',
			description: 'The controlled list. Bindable; a function binding keeps you authoritative.'
		},
		{
			prop: 'defaultValue',
			type: 'T[]',
			default: '[]',
			description: 'Initial list when uncontrolled. Read once, during initialisation.'
		},
		{
			prop: 'onValueChange',
			type: '(items: T[]) => void',
			default: '—',
			description: 'Called with the reordered array. Not called when onMove is supplied.'
		},
		{
			prop: 'getItemValue',
			type: '(item: T) => UniqueIdentifier',
			default: '—',
			description: 'Identifier for each item. Required at runtime for object arrays.'
		},
		{
			prop: 'onMove',
			type: '(event: SortableMoveEvent) => void',
			default: '—',
			description: 'Intercepts the reorder, suppressing the splice and onValueChange.'
		},
		{
			prop: 'orientation',
			type: '"vertical" | "horizontal" | "mixed"',
			default: '"vertical"',
			description: 'Selects the default modifiers, strategy and collision detection.'
		},
		{
			prop: 'strategy',
			type: 'SortableStrategy',
			default: 'per orientation',
			description: 'Overrides the sorting transform applied to the other items.'
		},
		{
			prop: 'collisionDetection',
			type: 'SortableCollisionDetection',
			default: 'per orientation',
			description: 'Overrides how the drop target is resolved.'
		},
		{
			prop: 'modifiers',
			type: 'SortableModifier[]',
			default: 'per orientation',
			description: 'Replaces the default modifier list wholesale.'
		},
		{
			prop: 'flatCursor',
			type: 'boolean',
			default: 'false',
			description: 'Uses a neutral cursor instead of the grab/grabbing affordance.'
		},
		{
			prop: 'dir',
			type: '"ltr" | "rtl"',
			default: 'inherited',
			description:
				'Explicit text direction. Falls back to the nearest DirectionProvider, then an ancestor [dir], then "ltr".'
		},
		{
			prop: 'id',
			type: 'string',
			default: '$props.id()',
			description: 'Base id for the live region and the screen-reader instructions element.'
		},
		{
			prop: 'accessibility',
			type: 'SortableAccessibility',
			default: '—',
			description: 'Per-key override of the announcements and of the instructions text.'
		},
		{
			prop: 'onDragStart',
			type: '(event: SortableDragEvent) => void',
			default: '—',
			description: 'Fires when an item is picked up, by pointer or by keyboard.'
		},
		{
			prop: 'onDragMove',
			type: '(event: SortableDragEvent) => void',
			default: '—',
			description: 'Fires on every move frame.'
		},
		{
			prop: 'onDragOver',
			type: '(event: SortableDragEvent) => void',
			default: '—',
			description: 'Fires only when the drop target changes.'
		},
		{
			prop: 'onDragEnd',
			type: '(event: SortableDragEvent) => void',
			default: '—',
			description: 'Fires on a drop over a droppable, before the reorder is committed.'
		},
		{
			prop: 'onDragCancel',
			type: '(event: SortableDragEvent) => void',
			default: '—',
			description:
				'Fires on Escape, on a drop outside any droppable, and when the active item is removed mid-drag.'
		}
	];

	const contentProps = [
		{
			prop: 'strategy',
			type: 'SortableStrategy',
			default: "the root's",
			description: 'Per-region sorting strategy override.'
		},
		{
			prop: 'withoutSlot',
			type: 'boolean',
			default: 'false',
			description: 'Renders the items with no wrapping element at all.'
		},
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the region element.'
		},
		{
			prop: 'class',
			type: 'string',
			default: '—',
			description: 'Merged last, so it always overrides the component classes.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the region onto your own element. Replaces upstream asChild.'
		}
	];

	const itemProps = [
		{
			prop: 'value',
			type: 'UniqueIdentifier',
			default: '— (required)',
			description: "The item's identifier. An empty string throws."
		},
		{
			prop: 'asHandle',
			type: 'boolean',
			default: 'false',
			description: 'Makes the item itself the drag activator.'
		},
		{
			prop: 'disabled',
			type: 'boolean',
			default: 'false',
			description: 'Neither draggable nor droppable, while others reorder around it.'
		},
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the item element.'
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
			description: 'Appended after the transform and transition declarations.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the item onto your own element. Spread the props, or it will not drag.'
		}
	];

	const itemHandleProps = [
		{
			prop: 'disabled',
			type: 'boolean',
			default: "the item's",
			description: 'Inherits the item, and an explicit value wins.'
		},
		{
			prop: 'ref',
			type: 'HTMLButtonElement | null',
			default: 'null',
			description: 'Bindable reference to the button element.'
		},
		{
			prop: 'class',
			type: 'string',
			default: '—',
			description: 'Merged last, so it always overrides the component classes.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the handle onto your own element — this is how it composes onto Button.'
		}
	];

	const overlayProps = [
		{
			prop: 'container',
			type: 'Element | DocumentFragment | string | null',
			default: 'document.body',
			description: 'Portal target for the floating preview.'
		},
		{
			prop: 'class',
			type: 'string',
			default: '—',
			description: 'Merged last onto the floating element.'
		},
		{
			prop: 'children',
			type: 'Snippet<[{ value }]>',
			default: '—',
			description:
				'The preview content. Take the value parameter to render per-item content instead of a fixed preview.'
		}
	];

	const dataAttributes = [
		{ part: 'Sortable.Content', attribute: '[data-orientation]', value: 'The list orientation.' },
		{ part: 'Sortable.Item', attribute: '[data-dragging]', value: 'The item is being dragged.' },
		{ part: 'Sortable.Item', attribute: '[data-disabled]', value: 'The item is disabled.' },
		{
			part: 'Sortable.Item',
			attribute: '[data-flat-cursor]',
			value: "The root's flatCursor is set."
		},
		{
			part: 'Sortable.ItemHandle',
			attribute: '[data-dragging]',
			value: 'The parent item is being dragged.'
		},
		{
			part: 'Sortable.ItemHandle',
			attribute: '[data-disabled]',
			value: 'The handle or its item is disabled.'
		},
		{
			part: 'Sortable.ItemHandle',
			attribute: '[data-flat-cursor]',
			value: "The root's flatCursor is set."
		},
		{
			part: 'Sortable.Overlay',
			attribute: '[data-dragging]',
			value: 'Always — the preview only exists during a drag.'
		}
	];

	const keyboardShortcuts = [
		{ keys: 'Tab', description: 'Moves focus between drag activators.' },
		{
			keys: 'Enter / Space',
			description: 'Picks the focused item up, and drops it again at its current position.'
		},
		{
			keys: 'ArrowUp / ArrowDown',
			description: 'Moves the grabbed item one position in a vertical or mixed list.'
		},
		{
			keys: 'ArrowLeft / ArrowRight',
			description:
				'Moves the grabbed item one position in a horizontal or mixed list. Inverted under dir="rtl".'
		},
		{ keys: 'Escape', description: 'Cancels the drag and returns the item to its position.' }
	];
</script>

<svelte:head>
	<title>Sortable — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Sortable</h1>
		<p class="text-muted-foreground">
			A drag and drop sortable component for reordering items, operable with a pointer, with touch
			and from the keyboard alone.
		</p>
	</div>

	<ComponentPreview
		title="Default"
		description="Mirrors sortable-demo.tsx — an object array with getItemValue, mixed orientation, each item its own drag handle, and a fixed overlay."
	>
		<Sortable.Root
			bind:value={defaultTricks}
			getItemValue={(trick) => trick.id}
			orientation="mixed"
		>
			<Sortable.Content class="grid w-full auto-rows-fr grid-cols-3 gap-2.5">
				{#each defaultTricks as trick (trick.id)}
					<Sortable.Item value={trick.id} asHandle>
						{#snippet child({ props }: { props: SortableItemChildProps })}
							<div {...props as Record<string, unknown>} class={cn(props.class, cardClass)}>
								<div class="text-sm leading-tight font-medium sm:text-base">{trick.title}</div>
								<span class="line-clamp-2 hidden text-sm text-muted-foreground sm:inline-block">
									{trick.description}
								</span>
							</div>
						{/snippet}
					</Sortable.Item>
				{/each}
			</Sortable.Content>
			<Sortable.Overlay>
				<div class="size-full rounded-md bg-primary/10"></div>
			</Sortable.Overlay>
		</Sortable.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Dynamic Overlay"
		description="Mirrors sortable-dynamic-overlay-demo.tsx — the overlay snippet receives the active identifier and renders the matching card."
	>
		<Sortable.Root
			bind:value={overlayTricks}
			getItemValue={(trick) => trick.id}
			orientation="mixed"
		>
			<Sortable.Content class="grid w-full auto-rows-fr grid-cols-3 gap-2.5">
				{#each overlayTricks as trick (trick.id)}
					<Sortable.Item value={trick.id} asHandle>
						{#snippet child({ props }: { props: SortableItemChildProps })}
							<div {...props as Record<string, unknown>} class={cn(props.class, cardClass)}>
								<div class="text-sm leading-tight font-medium sm:text-base">{trick.title}</div>
								<span class="line-clamp-2 hidden text-sm text-muted-foreground sm:inline-block">
									{trick.description}
								</span>
							</div>
						{/snippet}
					</Sortable.Item>
				{/each}
			</Sortable.Content>
			<Sortable.Overlay>
				{#snippet children({ value })}
					{@const trick = overlayTricks.find((candidate) => candidate.id === value)}
					{#if trick}
						<div class={cardClass}>
							<div class="text-sm leading-tight font-medium sm:text-base">{trick.title}</div>
							<span class="line-clamp-2 hidden text-sm text-muted-foreground sm:inline-block">
								{trick.description}
							</span>
						</div>
					{/if}
				{/snippet}
			</Sortable.Overlay>
		</Sortable.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Handle"
		description="Mirrors sortable-handle-demo.tsx — the region composes onto a table body, each item onto a table row, and the handle onto a Button."
	>
		<Sortable.Root bind:value={tableTricks} getItemValue={(trick) => trick.id}>
			<Table.Root class="rounded-none border">
				<Table.Header>
					<Table.Row class="bg-accent/50">
						<Table.Head class="w-[50px] bg-transparent" />
						<Table.Head class="bg-transparent">Trick</Table.Head>
						<Table.Head class="bg-transparent">Difficulty</Table.Head>
						<Table.Head class="bg-transparent text-right">Points</Table.Head>
					</Table.Row>
				</Table.Header>
				<Sortable.Content>
					{#snippet child({ props }: { props: SortableContentChildProps })}
						<Table.Body {...props as Record<string, unknown>} class={props.class}>
							{#each tableTricks as trick (trick.id)}
								<Sortable.Item value={trick.id}>
									{#snippet child({ props: rowProps }: { props: SortableItemChildProps })}
										<Table.Row {...rowProps as Record<string, unknown>} class={rowProps.class}>
											<Table.Cell class="w-[50px]">
												<Sortable.ItemHandle>
													{#snippet child({
														props: handleProps
													}: {
														props: SortableItemHandleChildProps;
													})}
														<Button
															{...handleProps as Record<string, unknown>}
															variant="ghost"
															size="icon"
															class={cn(handleProps.class, 'size-8')}
														>
															<GripVerticalIcon />
														</Button>
													{/snippet}
												</Sortable.ItemHandle>
											</Table.Cell>
											<Table.Cell class="font-medium">{trick.title}</Table.Cell>
											<Table.Cell class="text-muted-foreground">{trick.difficulty}</Table.Cell>
											<Table.Cell class="text-right text-muted-foreground">
												{trick.points}
											</Table.Cell>
										</Table.Row>
									{/snippet}
								</Sortable.Item>
							{/each}
						</Table.Body>
					{/snippet}
				</Sortable.Content>
			</Table.Root>
			<Sortable.Overlay>
				<div class="size-full rounded-none bg-primary/10"></div>
			</Sortable.Overlay>
		</Sortable.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Primitive Values"
		description="Mirrors sortable-primitive-values-demo.tsx — a string array needs no getItemValue, and the overlay renders a Sortable.Item of its own."
	>
		<Sortable.Root bind:value={primitiveTricks} orientation="mixed">
			<Sortable.Content class="grid w-full grid-cols-3 gap-2.5">
				{#each primitiveTricks as trick (trick)}
					<Sortable.Item
						value={trick}
						asHandle
						class="flex size-full flex-col items-center justify-center rounded-md border bg-muted p-8 text-center shadow-xs"
					>
						<div class="text-sm leading-tight font-medium sm:text-base">{trick}</div>
					</Sortable.Item>
				{/each}
			</Sortable.Content>
			<Sortable.Overlay>
				{#snippet children({ value })}
					<Sortable.Item
						{value}
						class="flex size-full flex-col items-center justify-center rounded-md border bg-muted p-8 text-center shadow-xs"
					>
						<div class="text-sm leading-tight font-medium sm:text-base">{value}</div>
					</Sortable.Item>
				{/snippet}
			</Sortable.Overlay>
		</Sortable.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Orientation"
		description="The same list in all three orientations. Only the orientation prop and the layout classes change; the arrow keys follow along."
	>
		<div class="flex flex-col items-center gap-4">
			<div class="flex gap-2">
				{#each ['vertical', 'horizontal', 'mixed'] as const as option (option)}
					<Button
						variant={orientation === option ? 'default' : 'outline'}
						size="sm"
						onclick={() => (orientation = option)}
					>
						{option}
					</Button>
				{/each}
			</div>
			<Sortable.Root
				bind:value={orientationTricks}
				getItemValue={(trick) => trick.id}
				{orientation}
			>
				<Sortable.Content class={orientationLayouts[orientation]}>
					{#each orientationTricks as trick (trick.id)}
						<Sortable.Item
							value={trick.id}
							asHandle
							class="flex-1 rounded-md border bg-muted p-4 text-sm font-medium shadow-sm"
						>
							{trick.title}
						</Sortable.Item>
					{/each}
				</Sortable.Content>
			</Sortable.Root>
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="RTL"
		description="Inside a right-to-left context, ArrowLeft and ArrowRight mirror, so they keep matching the visually-left and visually-right neighbour."
	>
		<DirectionProvider dir="rtl">
			<Sortable.Root
				bind:value={rtlTricks}
				getItemValue={(trick) => trick.id}
				orientation="horizontal"
			>
				<Sortable.Content class="flex w-full flex-row gap-2">
					{#each rtlTricks as trick (trick.id)}
						<Sortable.Item
							value={trick.id}
							asHandle
							class="flex-1 rounded-md border bg-muted p-4 text-sm font-medium shadow-sm"
						>
							{trick.title}
						</Sortable.Item>
					{/each}
				</Sortable.Content>
			</Sortable.Root>
		</DirectionProvider>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Sortable (Root)</h3>
			<p class="text-sm text-muted-foreground">
				Renders no element of its own — only its children plus a visually hidden live region and the
				screen-reader instructions.
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
			<h3 class="text-lg font-medium">Sortable.Content</h3>
			<p class="text-sm text-muted-foreground">
				One sortable region. Several can share a single root, and a drag stays inside the region it
				started in.
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
			<h3 class="text-lg font-medium">Sortable.Item</h3>
			<p class="text-sm text-muted-foreground">
				One entry in the list. With <code>asHandle</code> it is its own drag activator; otherwise it
				needs a <code>Sortable.ItemHandle</code>.
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
			<h3 class="text-lg font-medium">Sortable.ItemHandle</h3>
			<p class="text-sm text-muted-foreground">
				A native <code>&lt;button&gt;</code> that restricts drag activation to itself.
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
					{#each itemHandleProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Sortable.Overlay</h3>
			<p class="text-sm text-muted-foreground">
				A portalled floating preview that exists only while a drag is active.
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
					{#each overlayProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Keyboard Interactions</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Key</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each keyboardShortcuts as row (row.keys)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.keys}</Table.Cell>
							<Table.Cell>{row.description}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</section>
</article>
