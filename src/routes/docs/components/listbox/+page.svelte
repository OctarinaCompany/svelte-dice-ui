<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import * as Listbox from '$lib/components/ui/listbox/index.js';
	import * as Table from '$lib/components/ui/table/index.js';

	const tricks = [
		{ label: 'Kickflip', description: 'Flip the board 360° along its long axis' },
		{
			label: 'Heelflip',
			description: 'Flip the board 360° along its long axis in the opposite direction of a kickflip'
		},
		{
			label: '360 Varial McTwist',
			description: 'A 540° inverted aerial with a 360° board rotation'
		},
		{ label: 'The 900', description: 'Legendary 900° aerial rotation pioneered by Tony Hawk' }
	];

	const horizontalTricks = [
		{ label: 'Kickflip', description: 'Flip the board 360° along its long axis' },
		{
			label: 'Heelflip',
			description: 'Flip the board 360° along its long axis in the opposite direction of a kickflip'
		},
		{ label: 'The 900', description: 'Legendary 900° aerial rotation pioneered by Tony Hawk' }
	];

	const gridTricks = [
		{ label: 'Kickflip', description: 'Flip the board 360° along its long axis' },
		{
			label: 'Heelflip',
			description: 'Flip the board 360° along its long axis in the opposite direction of a kickflip'
		},
		{
			label: 'Tre Flip',
			description: 'A 360° flip combined with a 360° body-and-board shove-it'
		},
		{ label: 'FS 540', description: 'Flip the board 540° along its long axis' },
		{
			label: '360 Varial McTwist',
			description: 'A 540° inverted aerial with a 360° board rotation'
		},
		{ label: 'The 900', description: 'Legendary 900° aerial rotation pioneered by Tony Hawk' }
	];

	const groupedTricks = {
		'Basic Tricks': [
			{ label: 'Kickflip', description: 'Flip the board 360° along its long axis' },
			{
				label: 'Heelflip',
				description: 'Flip the board 360° along its long axis in the opposite direction'
			}
		],
		'Advanced Tricks': [
			{ label: 'Varial McTwist', description: 'A 540° inverted aerial with a board rotation' },
			{ label: 'The 900', description: 'Legendary 900° aerial rotation pioneered by Tony Hawk' }
		]
	};

	let selectedTricks = $state<string[]>([]);

	const rootProps = [
		{
			prop: 'value',
			type: 'string | string[]',
			default: '—',
			description: 'The selection. Bindable; a string in single mode, an array under multiple.'
		},
		{
			prop: 'defaultValue',
			type: 'string | string[]',
			default: "multiple ? [] : ''",
			description: 'Seeds the listbox when value is absent.'
		},
		{
			prop: 'onValueChange',
			type: '(value: string | string[]) => void',
			default: '—',
			description: 'Fires with the next value on every accepted change.'
		},
		{
			prop: 'dir',
			type: "'ltr' | 'rtl'",
			default: 'inherited',
			description: 'Overrides DirectionProvider and the inherited DOM dir.'
		},
		{
			prop: 'disabled',
			type: 'boolean',
			default: 'false',
			description: 'Suppresses every interaction and removes the tab stop.'
		},
		{
			prop: 'loop',
			type: 'boolean',
			default: 'false',
			description: 'Wraps navigation around the ends of the list.'
		},
		{
			prop: 'multiple',
			type: 'boolean',
			default: 'false',
			description: 'Allows more than one option at a time; adds aria-multiselectable.'
		},
		{
			prop: 'orientation',
			type: "'vertical' | 'horizontal' | 'mixed'",
			default: "'vertical'",
			description: 'Which axes the arrow keys move along; mixed reads the rendered grid.'
		},
		{
			prop: 'virtual',
			type: 'boolean',
			default: 'false',
			description: 'Tracks focus without calling focus() or scrollIntoView() on options.'
		},
		{
			prop: 'name',
			type: 'string',
			default: '—',
			description: 'Name the value is submitted under inside a form.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Renders onto your own element instead of the default div.'
		}
	];

	const partProps = [
		{
			part: 'Listbox.Group',
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Renders role="group" onto your own element.'
		},
		{
			part: 'Listbox.GroupLabel',
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Renders the id its group points aria-labelledby at.'
		},
		{
			part: 'Listbox.Item',
			prop: 'value',
			type: 'string',
			default: 'required',
			description: 'The option identifier. Throws when empty.'
		},
		{
			part: 'Listbox.Item',
			prop: 'disabled',
			type: 'boolean',
			default: 'false',
			description: 'Skips the option in navigation, typeahead and selection.'
		},
		{
			part: 'Listbox.Item',
			prop: 'onSelect',
			type: '(value: string) => void',
			default: '—',
			description: "Fires with the option's own value, before onValueChange."
		},
		{
			part: 'Listbox.Item',
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Renders role="option" onto your own element.'
		},
		{
			part: 'Listbox.ItemIndicator',
			prop: 'forceMount',
			type: 'boolean',
			default: 'false',
			description: 'Renders the indicator even while the option is unselected.'
		},
		{
			part: 'Listbox.ItemIndicator',
			prop: 'children',
			type: 'Snippet',
			default: 'a Check icon',
			description: 'The indicator content; always aria-hidden.'
		}
	];

	const dataAttributes = [
		{ attribute: 'data-orientation', on: 'Listbox.Root', when: 'always — the current orientation' },
		{ attribute: 'data-disabled', on: 'Root, Item', when: 'the root or the option is disabled' },
		{ attribute: 'data-selected', on: 'Listbox.Item', when: 'the option is selected' },
		{ attribute: 'data-highlighted', on: 'Listbox.Item', when: 'the pointer or keyboard is on it' },
		{ attribute: 'data-focused', on: 'Listbox.Item', when: 'the option holds the roving focus' }
	];

	const keyboard = [
		{ keys: 'Tab', action: 'Enters the listbox, landing on the last remembered option.' },
		{ keys: 'Shift + Tab', action: 'Returns focus to the root and leaves the listbox.' },
		{ keys: '↑ / ↓', action: 'Previous / next option; in a grid, the same column.' },
		{ keys: '← / →', action: 'Previous / next option in a row. Inverted under dir="rtl".' },
		{ keys: 'Home / End', action: 'First / last enabled option.' },
		{ keys: 'Page Up / Page Down', action: 'Same as ↑ / ↓.' },
		{ keys: 'Enter / Space', action: "Selects the focused option with the mode's semantics." },
		{ keys: 'Escape', action: 'Clears focus and highlight, leaving the selection alone.' },
		{ keys: 'Ctrl / ⌘ + A', action: 'Selects every enabled option (multiple only).' },
		{ keys: 'Shift + arrows', action: 'Extends a range from the anchor (multiple only).' },
		{ keys: 'a – z, 0 – 9', action: 'Typeahead; the buffer resets after a one-second pause.' }
	];
</script>

<svelte:head>
	<title>Listbox — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Listbox</h1>
		<p class="text-muted-foreground">
			A component for creating keyboard-navigable selection lists and grids.
		</p>
	</div>

	<ComponentPreview title="Default" description="Mirrors listbox-demo.tsx.">
		<Listbox.Root class="w-full">
			{#each tricks as trick (trick.label)}
				<Listbox.Item value={trick.label}>
					<div class="flex flex-col">
						<div class="font-medium">{trick.label}</div>
						<div class="text-sm text-muted-foreground">{trick.description}</div>
					</div>
					<Listbox.ItemIndicator />
				</Listbox.Item>
			{/each}
		</Listbox.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Horizontal Orientation"
		description="Mirrors listbox-horizontal-demo.tsx. ArrowLeft and ArrowRight move along the row."
	>
		<Listbox.Root orientation="horizontal" class="w-full flex-row gap-4">
			{#each horizontalTricks as trick (trick.label)}
				<Listbox.Item value={trick.label}>
					<div class="flex flex-col">
						<div class="flex items-center justify-between">
							<div class="font-medium">{trick.label}</div>
							<Listbox.ItemIndicator />
						</div>
						<div class="line-clamp-2 text-sm text-muted-foreground">{trick.description}</div>
					</div>
				</Listbox.Item>
			{/each}
		</Listbox.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Grid Layout"
		description="Mirrors listbox-grid-demo.tsx. With orientation=&quot;mixed&quot; the arrow keys navigate both axes of the rendered grid."
	>
		<Listbox.Root orientation="mixed" class="grid w-full gap-2 sm:grid-cols-3">
			{#each gridTricks as trick (trick.label)}
				<Listbox.Item value={trick.label} class="items-start">
					<div class="flex flex-col gap-px">
						<div class="font-medium">{trick.label}</div>
						<div class="line-clamp-2 text-sm text-muted-foreground">{trick.description}</div>
					</div>
					<Listbox.ItemIndicator />
				</Listbox.Item>
			{/each}
		</Listbox.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Grouped Items"
		description="Mirrors listbox-group-demo.tsx. Multiple selection, with navigation crossing group boundaries."
	>
		<div class="flex w-full flex-col gap-4">
			<Listbox.Root multiple bind:value={selectedTricks} class="w-full">
				{#each Object.entries(groupedTricks) as [groupName, groupTricks] (groupName)}
					<Listbox.Group>
						<Listbox.GroupLabel>{groupName}</Listbox.GroupLabel>
						{#each groupTricks as trick (trick.label)}
							<Listbox.Item value={trick.label}>
								<div class="flex flex-col items-start">
									<span>{trick.label}</span>
									<span class="text-xs text-muted-foreground">{trick.description}</span>
								</div>
								<Listbox.ItemIndicator />
							</Listbox.Item>
						{/each}
					</Listbox.Group>
				{/each}
			</Listbox.Root>
			<p class="text-sm text-muted-foreground">
				Selected: {selectedTricks.length > 0 ? selectedTricks.join(', ') : 'nothing yet'}
			</p>
		</div>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Listbox.Root</h3>
			<p class="text-sm text-muted-foreground">
				The list itself. Owns the selection, the roving focus and the whole keyboard contract.
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
			<h3 class="text-lg font-medium">Parts</h3>
			<p class="text-sm text-muted-foreground">
				Every part also accepts <code>ref</code>, <code>class</code> and any native attribute of its
				element. <code>Listbox.GroupLabel</code> must sit inside a
				<code>Listbox.Group</code>, and <code>Listbox.ItemIndicator</code> inside a
				<code>Listbox.Item</code>.
			</p>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Part</Table.Head>
						<Table.Head>Prop</Table.Head>
						<Table.Head>Type</Table.Head>
						<Table.Head>Default</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each partProps as row (`${row.part}.${row.prop}`)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.part}</Table.Cell>
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
						<Table.Head>On</Table.Head>
						<Table.Head>Present when</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each dataAttributes as row (row.attribute + row.on)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.attribute}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.on}</Table.Cell>
							<Table.Cell>{row.when}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Keyboard</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Key</Table.Head>
						<Table.Head>Action</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each keyboard as row (row.keys)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.keys}</Table.Cell>
							<Table.Cell>{row.action}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</section>
</article>
