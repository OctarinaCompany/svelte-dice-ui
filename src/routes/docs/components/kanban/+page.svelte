<script lang="ts">
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';

	import { ComponentPreview } from '$lib/components/docs/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Kanban from '$lib/components/ui/kanban/index.js';
	import type {
		KanbanColumnHandleChildProps,
		KanbanItemChildProps
	} from '$lib/components/ui/kanban/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { cn } from '$lib/utils.js';

	type Task = {
		id: string;
		title: string;
		priority: 'low' | 'medium' | 'high';
		assignee?: string;
		dueDate?: string;
	};

	const columnTitles: Record<string, string> = {
		backlog: 'Backlog',
		inProgress: 'In Progress',
		done: 'Done'
	};

	const initialTasks: Record<string, Task[]> = {
		backlog: [
			{
				id: '1',
				title: 'Add authentication',
				priority: 'high',
				assignee: 'John Doe',
				dueDate: '2024-04-01'
			},
			{
				id: '2',
				title: 'Create API endpoints',
				priority: 'medium',
				assignee: 'Jane Smith',
				dueDate: '2024-04-05'
			},
			{
				id: '3',
				title: 'Write documentation',
				priority: 'low',
				assignee: 'Bob Johnson',
				dueDate: '2024-04-10'
			}
		],
		inProgress: [
			{
				id: '4',
				title: 'Design system updates',
				priority: 'high',
				assignee: 'Alice Brown',
				dueDate: '2024-03-28'
			},
			{
				id: '5',
				title: 'Implement dark mode',
				priority: 'medium',
				assignee: 'Charlie Wilson',
				dueDate: '2024-04-02'
			}
		],
		done: [
			{
				id: '7',
				title: 'Setup project',
				priority: 'high',
				assignee: 'Eve Davis',
				dueDate: '2024-03-25'
			},
			{
				id: '8',
				title: 'Initial commit',
				priority: 'low',
				assignee: 'Frank White',
				dueDate: '2024-03-24'
			}
		]
	};

	function seed(): Record<string, Task[]> {
		return Object.fromEntries(
			Object.entries(initialTasks).map(([key, tasks]) => [key, [...tasks]])
		);
	}

	let defaultBoard = $state<Record<string, Task[]>>(seed());
	let overlayBoard = $state<Record<string, Task[]>>(seed());

	const cardClass = 'rounded-md border bg-card p-3 shadow-xs';

	function priorityVariant(priority: Task['priority']) {
		if (priority === 'high') return 'destructive' as const;
		if (priority === 'medium') return 'default' as const;
		return 'secondary' as const;
	}

	function taskFor(board: Record<string, Task[]>, id: string | number): Task | undefined {
		return Object.values(board)
			.flat()
			.find((task) => task.id === String(id));
	}

	const rootProps = [
		{
			prop: 'value',
			type: 'Record<UniqueIdentifier, T[]>',
			default: '—',
			description: 'The controlled board. Bindable; a function binding keeps you authoritative.'
		},
		{
			prop: 'defaultValue',
			type: 'Record<UniqueIdentifier, T[]>',
			default: '{}',
			description: 'Initial board when uncontrolled. Read once, during initialisation.'
		},
		{
			prop: 'onValueChange',
			type: '(columns: Record<UniqueIdentifier, T[]>) => void',
			default: '—',
			description: 'Called with the whole new board on every committed move.'
		},
		{
			prop: 'getItemValue',
			type: '(item: T) => UniqueIdentifier',
			default: '—',
			description: 'Identifier for each item. Required at runtime for object arrays.'
		},
		{
			prop: 'onMove',
			type: '(event: KanbanMoveEvent) => void',
			default: '—',
			description:
				'Intercepts the column reorder on drop; reports the net same-column item move, which onDragOver already committed.'
		},
		{
			prop: 'orientation',
			type: '"horizontal" | "vertical"',
			default: '"horizontal"',
			description: 'The axis the board lays its columns out on.'
		},
		{
			prop: 'strategy',
			type: 'SortableStrategy',
			default: 'verticalListSortingStrategy',
			description: 'Accepted for parity and read by nothing — upstream does the same.'
		},
		{
			prop: 'modifiers',
			type: 'SortableModifier[]',
			default: '—',
			description: "Clamps the dragged element's transform."
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
			description: 'Explicit direction; otherwise resolved from DirectionProvider or [dir].'
		},
		{
			prop: 'id',
			type: 'string',
			default: '$props.id()',
			description: 'Base id for the live region and the screen-reader instructions.'
		},
		{
			prop: 'accessibility',
			type: 'KanbanAccessibility',
			default: '—',
			description: 'Per-key announcement overrides and the upfront instruction text.'
		},
		{
			prop: 'onDragStart / onDragMove / onDragOver / onDragEnd / onDragCancel',
			type: '(event: KanbanDragEvent) => void',
			default: '—',
			description: 'The five drag lifecycle hooks, each receiving { active, over }.'
		}
	];

	const boardProps = [
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered element.'
		},
		{ prop: 'class', type: 'string', default: '—', description: 'Merged last through cn().' },
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the board onto your own element instead of the default div.'
		},
		{ prop: 'children', type: 'Snippet', default: '—', description: 'The columns.' }
	];

	const columnProps = [
		{
			prop: 'value',
			type: 'UniqueIdentifier',
			default: '— (required)',
			description: 'The column identifier. Must be one of Object.keys(value).'
		},
		{
			prop: 'asHandle',
			type: 'boolean',
			default: 'false',
			description: 'Make the column itself the drag activator.'
		},
		{
			prop: 'disabled',
			type: 'boolean',
			default: 'false',
			description: 'Neither draggable nor a drop target.'
		},
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered element.'
		},
		{
			prop: 'class / style',
			type: 'string',
			default: '—',
			description: 'Both merged after the drag transform, so the caller wins.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element; spread the props or it stops being draggable.'
		}
	];

	const columnHandleProps = [
		{
			prop: 'disabled',
			type: 'boolean',
			default: "the column's",
			description: 'An explicit value on the handle wins over the column it belongs to.'
		},
		{
			prop: 'ref',
			type: 'HTMLButtonElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered button.'
		},
		{ prop: 'class', type: 'string', default: '—', description: 'Merged last through cn().' },
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'How the handle composes onto <Button>.'
		}
	];

	const itemProps = [
		{
			prop: 'value',
			type: 'UniqueIdentifier',
			default: '— (required)',
			description: "The item identifier, as produced by the root's getItemValue."
		},
		{
			prop: 'asHandle',
			type: 'boolean',
			default: 'false',
			description: 'Make the item itself the drag activator.'
		},
		{
			prop: 'disabled',
			type: 'boolean',
			default: 'false',
			description: 'Neither draggable nor a drop target.'
		},
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered element.'
		},
		{
			prop: 'class / style',
			type: 'string',
			default: '—',
			description: 'Both merged after the drag transform, so the caller wins.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element; spread the props or it stops being draggable.'
		}
	];

	const itemHandleProps = [
		{
			prop: 'disabled',
			type: 'boolean',
			default: "the item's",
			description: 'An explicit value on the handle wins over the item it belongs to.'
		},
		{
			prop: 'ref',
			type: 'HTMLButtonElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered button.'
		},
		{ prop: 'class', type: 'string', default: '—', description: 'Merged last through cn().' },
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'How the handle composes onto <Button>.'
		}
	];

	const overlayProps = [
		{
			prop: 'container',
			type: 'Element | DocumentFragment | string | null',
			default: 'document.body',
			description: 'Where the floating preview is portalled to.'
		},
		{ prop: 'class', type: 'string', default: '—', description: 'Merged last through cn().' },
		{
			prop: 'children',
			type: 'Snippet<[{ value, variant }]>',
			default: '—',
			description: 'Fixed preview, or content driven by what is being dragged.'
		}
	];

	const dataAttributes = [
		{ part: 'Board', attribute: 'data-orientation', value: '"horizontal" | "vertical"' },
		{ part: 'Column', attribute: 'data-value', value: 'The column identifier.' },
		{ part: 'Column', attribute: 'data-disabled', value: 'Present when the column is disabled.' },
		{
			part: 'Column',
			attribute: 'data-dragging',
			value: 'Present while the column is being dragged.'
		},
		{
			part: 'ColumnHandle',
			attribute: 'data-disabled',
			value: 'Present when the column is disabled.'
		},
		{
			part: 'ColumnHandle',
			attribute: 'data-dragging',
			value: 'Present while the parent column is being dragged.'
		},
		{ part: 'Item', attribute: 'data-value', value: 'The item identifier.' },
		{ part: 'Item', attribute: 'data-disabled', value: 'Present when the item is disabled.' },
		{ part: 'Item', attribute: 'data-dragging', value: 'Present while the item is being dragged.' },
		{ part: 'ItemHandle', attribute: 'data-disabled', value: 'Present when the item is disabled.' },
		{
			part: 'ItemHandle',
			attribute: 'data-dragging',
			value: 'Present while the parent item is being dragged.'
		},
		{ part: 'Overlay', attribute: 'data-variant', value: '"column" | "item"' },
		{ part: 'Overlay', attribute: 'data-dragging', value: 'Always present while it exists.' },
		{
			part: 'Every part',
			attribute: 'data-flat-cursor',
			value: 'Present when the root sets flatCursor.'
		}
	];

	const keyboardShortcuts = [
		{
			keys: 'Enter / Space',
			description:
				'Picks the focused column or item up, and drops it at its current target when pressed again.'
		},
		{ keys: 'ArrowUp', description: 'Moves the drop target to the nearest candidate above.' },
		{ keys: 'ArrowDown', description: 'Moves the drop target to the nearest candidate below.' },
		{
			keys: 'ArrowLeft',
			description:
				'Moves the drop target to the nearest candidate entirely to the left, including an empty column. Inverted under dir="rtl".'
		},
		{
			keys: 'ArrowRight',
			description:
				'Moves the drop target to the nearest candidate entirely to the right, including an empty column. Inverted under dir="rtl".'
		},
		{
			keys: 'Escape',
			description: 'Cancels the drag and restores the board to where the pick-up found it.'
		},
		{
			keys: 'Tab',
			description: 'Swallowed while dragging — focus may not leave a grabbed element.'
		}
	];
</script>

<svelte:head>
	<title>Kanban — svelte-dice-ui</title>
</svelte:head>

{#snippet taskCard(task: Task)}
	<div class="flex flex-col gap-2">
		<div class="flex items-center justify-between gap-2">
			<span class="line-clamp-1 text-sm font-medium">{task.title}</span>
			<Badge
				variant={priorityVariant(task.priority)}
				class="pointer-events-none h-5 rounded-sm px-1.5 text-[11px] capitalize"
			>
				{task.priority}
			</Badge>
		</div>
		<div class="flex items-center justify-between text-xs text-muted-foreground">
			{#if task.assignee}
				<div class="flex items-center gap-1">
					<div class="size-2 rounded-full bg-primary/20"></div>
					<span class="line-clamp-1">{task.assignee}</span>
				</div>
			{/if}
			{#if task.dueDate}
				<time class="text-[10px] tabular-nums">{task.dueDate}</time>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet columnHeader(columnValue: string, count: number)}
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<span class="text-sm font-semibold">{columnTitles[columnValue] ?? columnValue}</span>
			<Badge variant="secondary" class="pointer-events-none rounded-sm">{count}</Badge>
		</div>
		<Kanban.ColumnHandle>
			{#snippet child({ props }: { props: KanbanColumnHandleChildProps })}
				<Button
					{...props as Record<string, unknown>}
					variant="ghost"
					size="icon"
					class={props.class}
				>
					<GripVerticalIcon class="size-4" />
				</Button>
			{/snippet}
		</Kanban.ColumnHandle>
	</div>
{/snippet}

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Kanban</h1>
		<p class="text-muted-foreground">
			A drag and drop kanban board for organizing items into columns — reorder inside a column, move
			between columns and reorder whole columns, with a pointer, with touch or from the keyboard
			alone.
		</p>
	</div>

	<ComponentPreview
		title="Default"
		description="Mirrors kanban-demo.tsx — an object board with getItemValue, each card its own drag activator, the column handle composed onto Button, and a fixed overlay."
		class="items-start"
	>
		<Kanban.Root bind:value={defaultBoard} getItemValue={(task) => task.id}>
			<Kanban.Board class="grid auto-rows-fr gap-4 sm:grid-cols-3">
				{#each Object.entries(defaultBoard) as [columnValue, tasks] (columnValue)}
					<Kanban.Column value={columnValue}>
						{@render columnHeader(columnValue, tasks.length)}
						<div class="flex flex-col gap-2 p-0.5">
							{#each tasks as task (task.id)}
								<Kanban.Item value={task.id} asHandle>
									{#snippet child({ props }: { props: KanbanItemChildProps })}
										<div {...props as Record<string, unknown>} class={cn(props.class, cardClass)}>
											{@render taskCard(task)}
										</div>
									{/snippet}
								</Kanban.Item>
							{/each}
						</div>
					</Kanban.Column>
				{/each}
			</Kanban.Board>
			<Kanban.Overlay>
				<div class="size-full rounded-md bg-primary/10"></div>
			</Kanban.Overlay>
		</Kanban.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Dynamic Overlay"
		description="Mirrors kanban-dynamic-overlay-demo.tsx — the overlay snippet receives the active identifier and whether it is a column or an item, and renders a whole column preview or a single card."
		class="items-start"
	>
		<Kanban.Root bind:value={overlayBoard} getItemValue={(task) => task.id}>
			<Kanban.Board class="grid auto-rows-fr gap-4 sm:grid-cols-3">
				{#each Object.entries(overlayBoard) as [columnValue, tasks] (columnValue)}
					<Kanban.Column value={columnValue}>
						{@render columnHeader(columnValue, tasks.length)}
						<div class="flex flex-col gap-2 p-0.5">
							{#each tasks as task (task.id)}
								<Kanban.Item value={task.id} asHandle>
									{#snippet child({ props }: { props: KanbanItemChildProps })}
										<div {...props as Record<string, unknown>} class={cn(props.class, cardClass)}>
											{@render taskCard(task)}
										</div>
									{/snippet}
								</Kanban.Item>
							{/each}
						</div>
					</Kanban.Column>
				{/each}
			</Kanban.Board>
			<Kanban.Overlay>
				{#snippet children({ value, variant })}
					{#if variant === 'column'}
						{@const tasks = overlayBoard[String(value)] ?? []}
						<Kanban.Column value={String(value)}>
							{@render columnHeader(String(value), tasks.length)}
							<div class="flex flex-col gap-2 p-0.5">
								{#each tasks as task (task.id)}
									<div class={cardClass}>{@render taskCard(task)}</div>
								{/each}
							</div>
						</Kanban.Column>
					{:else}
						{@const task = taskFor(overlayBoard, value)}
						{#if task}
							<div class={cardClass}>{@render taskCard(task)}</div>
						{/if}
					{/if}
				{/snippet}
			</Kanban.Overlay>
		</Kanban.Root>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Kanban (Root)</h3>
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
			<h3 class="text-lg font-medium">Kanban.Board</h3>
			<p class="text-sm text-muted-foreground">The container the columns are laid out in.</p>
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
					{#each boardProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Kanban.Column</h3>
			<p class="text-sm text-muted-foreground">
				One column of the board — itself draggable, and the drop region its items belong to.
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
					{#each columnProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Kanban.ColumnHandle</h3>
			<p class="text-sm text-muted-foreground">The button a column drag starts from.</p>
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
					{#each columnHandleProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Kanban.Item</h3>
			<p class="text-sm text-muted-foreground">One card, belonging to the column it renders in.</p>
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
			<h3 class="text-lg font-medium">Kanban.ItemHandle</h3>
			<p class="text-sm text-muted-foreground">The button an item drag starts from.</p>
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
			<h3 class="text-lg font-medium">Kanban.Overlay</h3>
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
