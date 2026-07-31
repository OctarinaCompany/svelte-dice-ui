<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import * as Combobox from '$lib/components/ui/combobox/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as TagsInput from '$lib/components/ui/tags-input/index.js';
	import { onDestroy } from 'svelte';

	type Trick = { label: string; value: string };

	const tricks: Trick[] = [
		{ label: 'Kickflip', value: 'kickflip' },
		{ label: 'Heelflip', value: 'heelflip' },
		{ label: 'Tre Flip', value: 'tre-flip' },
		{ label: 'FS 540', value: 'fs-540' },
		{ label: 'Casper flip 360 flip', value: 'casper-flip-360-flip' },
		{ label: 'Kickflip Backflip', value: 'kickflip-backflip' },
		{ label: '360 Varial McTwist', value: '360-varial-mc-twist' },
		{ label: 'The 900', value: 'the-900' }
	];

	function labelFor(value: string): string {
		return tricks.find((trick) => trick.value === value)?.label ?? value;
	}

	// --- Default -------------------------------------------------------------
	let trick = $state('');

	// --- With Groups ---------------------------------------------------------
	const groupedTricks: [string, Trick[]][] = [
		['Basic Tricks', tricks.slice(0, 3)],
		['Advanced Tricks', tricks.slice(3, 5)],
		['Pro Tricks', tricks.slice(5)]
	];

	let groupedTrick = $state('');

	// --- With Multiple Selection ---------------------------------------------
	let multipleTricks = $state<string[]>([]);

	// --- With Custom Filter --------------------------------------------------
	// Upstream reaches for `match-sorter`; the port exports the same matcher its own filter store
	// uses, so the example stays dependency-free and demonstrates the shared module at the same time.
	const startsWithFilter = Combobox.createFilter({ gapMatch: true });

	let filteredTrick = $state('');

	function onTrickFilter(options: string[], inputValue: string): string[] {
		return options.filter((option) => startsWithFilter.startsWith(labelFor(option), inputValue));
	}

	// --- With Debounce -------------------------------------------------------
	let debouncedTrick = $state('');
	let debouncedSearch = $state('');
	let debouncedResults = $state<Trick[]>(tricks);
	let debouncedProgress = $state<number | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let progressTimer: ReturnType<typeof setInterval> | undefined;

	function clearDebounceTimers() {
		clearTimeout(debounceTimer);
		clearInterval(progressTimer);
	}

	function onDebouncedInput(value: string) {
		debouncedSearch = value;
		clearDebounceTimers();

		// `<Combobox.Loading>` unmounts itself once the progress reaches `max`, so the simulated
		// request only has to walk the value up to 100.
		debouncedProgress = 0;
		const steps = [15, 35, 65, 85, 95];
		let step = 0;
		progressTimer = setInterval(() => {
			debouncedProgress = steps[step] ?? 95;
			step += 1;
		}, 120);

		debounceTimer = setTimeout(() => {
			const normalized = value.trim().toLowerCase();
			debouncedResults = normalized
				? tricks.filter((item) => item.label.toLowerCase().includes(normalized))
				: tricks;
			clearInterval(progressTimer);
			debouncedProgress = 100;
		}, 600);
	}

	onDestroy(clearDebounceTimers);

	// --- With Virtualization -------------------------------------------------
	const categories = ['Flip', 'Grind', 'Slide', 'Grab', 'Manual', 'Transition', 'Old School'];
	const variations = ['Regular', 'Switch', 'Nollie', 'Fakie', '360', 'Double', 'Late'];

	const manyTricks: Trick[] = Array.from({ length: 10_000 }, (_, index) => {
		const category = categories[index % categories.length] ?? 'Flip';
		const variation = variations[index % variations.length] ?? 'Regular';
		return {
			label: `${variation} ${category} ${Math.floor(index / categories.length) + 1}`,
			value: `trick-${index + 1}`
		};
	});

	/** How many rows the windowed slice renders. Upstream uses `@tanstack/react-virtual` here. */
	const WINDOW_SIZE = 40;

	let virtualizedTrick = $state('');
	let virtualizedInput = $state('');
	let virtualizedOffset = $state(0);

	const virtualizedMatches = $derived.by(() => {
		const normalized = virtualizedInput.trim().toLowerCase();
		if (!normalized) return manyTricks;
		return manyTricks.filter((item) => item.label.toLowerCase().includes(normalized));
	});

	const virtualizedWindow = $derived(
		virtualizedMatches.slice(virtualizedOffset, virtualizedOffset + WINDOW_SIZE)
	);

	function onVirtualizedScroll(event: Event & { currentTarget: HTMLElement }) {
		const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
		if (scrollHeight <= clientHeight) return;

		const ratio = scrollTop / (scrollHeight - clientHeight);
		const maxOffset = Math.max(0, virtualizedMatches.length - WINDOW_SIZE);
		virtualizedOffset = Math.round(ratio * maxOffset);
	}

	// --- With Tags Input -----------------------------------------------------
	let taggedTricks = $state<string[]>([]);

	// --- API reference -------------------------------------------------------
	type PropRow = { prop: string; type: string; default: string; description: string };

	const rootProps: PropRow[] = [
		{
			prop: 'value',
			type: 'string | string[]',
			default: "multiple ? [] : ''",
			description:
				'Bindable selection. A string in single mode, an array when multiple is set. A function binding lets the parent stay authoritative.'
		},
		{
			prop: 'defaultValue',
			type: 'string | string[]',
			default: '—',
			description: "Uncontrolled seed. In single mode it also seeds the input's displayed text."
		},
		{
			prop: 'onValueChange',
			type: '(value) => void',
			default: '—',
			description: 'Called with the next selection.'
		},
		{
			prop: 'open',
			type: 'boolean',
			default: 'false',
			description: 'Bindable open state of the popover.'
		},
		{
			prop: 'defaultOpen',
			type: 'boolean',
			default: 'false',
			description: 'Uncontrolled seed for the open state.'
		},
		{
			prop: 'onOpenChange',
			type: '(open: boolean) => void',
			default: '—',
			description: 'Called whenever the popover opens or closes.'
		},
		{
			prop: 'inputValue',
			type: 'string',
			default: "''",
			description: 'Bindable text in the input.'
		},
		{
			prop: 'onInputValueChange',
			type: '(value: string) => void',
			default: '—',
			description: 'Called on every input-text change.'
		},
		{
			prop: 'onFilter',
			type: '(options: string[], inputValue: string) => string[]',
			default: '—',
			description: 'Replaces the built-in matcher: an item survives when the result is non-empty.'
		},
		{
			prop: 'dir',
			type: "'ltr' | 'rtl'",
			default: 'nearest DirectionProvider, else the DOM dir, else ltr',
			description: 'Reading direction. Inverts the badge arrow keys.'
		},
		{
			prop: 'autoHighlight',
			type: 'boolean',
			default: 'false',
			description: 'Highlights the first visible item on open and after every re-filter.'
		},
		{
			prop: 'disabled',
			type: 'boolean',
			default: 'false',
			description: 'Disables typing, opening and every value change.'
		},
		{
			prop: 'exactMatch',
			type: 'boolean',
			default: 'false',
			description: 'Uses substring matching instead of fuzzy matching.'
		},
		{
			prop: 'manualFiltering',
			type: 'boolean',
			default: 'false',
			description: 'Bypasses the built-in filter so the rendered list is used as-is.'
		},
		{
			prop: 'loop',
			type: 'boolean',
			default: 'false',
			description: 'Wraps the highlight at both ends of the list.'
		},
		{
			prop: 'modal',
			type: 'boolean',
			default: 'false',
			description: 'Locks page scroll, traps Tab, and enables PageUp / PageDown navigation.'
		},
		{
			prop: 'multiple',
			type: 'boolean',
			default: 'false',
			description: 'Allows more than one value and turns the value into an array.'
		},
		{
			prop: 'openOnFocus',
			type: 'boolean',
			default: 'false',
			description: 'Opens the popover when the input receives focus.'
		},
		{
			prop: 'preserveInputOnBlur',
			type: 'boolean',
			default: 'false',
			description: 'Keeps typed text on blur when nothing is selected.'
		},
		{
			prop: 'readOnly',
			type: 'boolean',
			default: 'false',
			description: 'Lets the list open and navigate but blocks every value change.'
		},
		{
			prop: 'required',
			type: 'boolean',
			default: 'false',
			description: 'Marks the hidden form control required.'
		},
		{
			prop: 'name',
			type: 'string',
			default: '—',
			description: 'Name of the hidden form control carrying the joined value.'
		}
	];

	const anchorProps: PropRow[] = [
		{
			prop: 'preventInputFocus',
			type: 'boolean',
			default: 'false',
			description: 'Leaves focus where it is when the anchor is clicked.'
		}
	];

	const triggerProps: PropRow[] = [
		{
			prop: 'disabled',
			type: 'boolean',
			default: "the root's disabled",
			description: 'Disables the trigger on its own.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: 'a ChevronDown icon',
			description: "Overrides the trigger's content."
		}
	];

	const cancelProps: PropRow[] = [
		{
			prop: 'forceMount',
			type: 'boolean',
			default: 'false',
			description: 'Keeps the button mounted while the input is empty.'
		},
		{
			prop: 'disabled',
			type: 'boolean',
			default: "the root's disabled",
			description: 'Disables the button on its own.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: 'an X icon',
			description: "Overrides the button's content."
		}
	];

	const badgeListProps: PropRow[] = [
		{
			prop: 'forceMount',
			type: 'boolean',
			default: 'false',
			description: 'Keeps the list mounted while nothing is selected.'
		},
		{
			prop: 'orientation',
			type: "'horizontal' | 'vertical'",
			default: "'horizontal'",
			description: 'Layout axis, mirrored onto aria-orientation.'
		}
	];

	const badgeItemProps: PropRow[] = [
		{
			prop: 'value',
			type: 'string',
			default: '—',
			description: 'The selected value it stands for.'
		},
		{
			prop: 'disabled',
			type: 'boolean',
			default: "the root's disabled",
			description: 'Disables the badge on its own.'
		}
	];

	const contentProps: PropRow[] = [
		{
			prop: 'side',
			type: "'top' | 'right' | 'bottom' | 'left'",
			default: "'bottom'",
			description: 'Preferred side of the anchor.'
		},
		{
			prop: 'sideOffset',
			type: 'number',
			default: '4',
			description: 'Distance from the anchor, in pixels.'
		},
		{
			prop: 'align',
			type: "'start' | 'center' | 'end'",
			default: "'start'",
			description: 'Preferred alignment along the side.'
		},
		{
			prop: 'alignOffset',
			type: 'number',
			default: '0',
			description: 'Offset from the start or end alignment.'
		},
		{
			prop: 'arrowPadding',
			type: 'number',
			default: '0',
			description: 'Padding between the arrow and the popover edges.'
		},
		{
			prop: 'collisionBoundary',
			type: 'Element | Element[] | null',
			default: '—',
			description: 'Elements collisions are measured against.'
		},
		{
			prop: 'collisionPadding',
			type: 'number | Partial<Record<Side, number>>',
			default: '0',
			description: 'Virtual padding around the viewport edges.'
		},
		{
			prop: 'sticky',
			type: "'partial' | 'always'",
			default: "'partial'",
			description: 'How hard the popover sticks to its anchor.'
		},
		{
			prop: 'strategy',
			type: "'absolute' | 'fixed'",
			default: "'absolute'",
			description: 'CSS positioning strategy.'
		},
		{
			prop: 'avoidCollisions',
			type: 'boolean',
			default: 'true',
			description: 'Flips the popover away from collisions.'
		},
		{
			prop: 'fitViewport',
			type: 'boolean',
			default: 'false',
			description: 'Clamps the popover to the space the viewport has.'
		},
		{
			prop: 'hideWhenDetached',
			type: 'boolean',
			default: 'false',
			description: 'Hides the popover when the anchor scrolls out of view.'
		},
		{
			prop: 'trackAnchor',
			type: 'boolean',
			default: 'true',
			description: 'Keeps following an anchor that moves.'
		},
		{
			prop: 'forceMount',
			type: 'boolean',
			default: 'false',
			description: 'Keeps the popover mounted while closed.'
		},
		{
			prop: 'onEscapeKeyDown',
			type: '(event: KeyboardEvent) => void',
			default: '—',
			description: 'preventDefault() keeps the popover open.'
		},
		{
			prop: 'onPointerDownOutside',
			type: '(event: PointerEvent) => void',
			default: '—',
			description: 'preventDefault() keeps the popover open.'
		}
	];

	const itemProps: PropRow[] = [
		{
			prop: 'value',
			type: 'string',
			default: '—',
			description: 'Required, and never an empty string.'
		},
		{
			prop: 'label',
			type: 'string',
			default: "the item's rendered text",
			description: 'What the input shows once the item is selected.'
		},
		{
			prop: 'disabled',
			type: 'boolean',
			default: 'false',
			description: 'Skips the item in keyboard navigation and blocks selection.'
		},
		{
			prop: 'onSelect',
			type: '(value: string) => void',
			default: '—',
			description: 'Called just before the selection is applied.'
		}
	];

	const loadingProps: PropRow[] = [
		{
			prop: 'value',
			type: 'number | null',
			default: 'null',
			description:
				'Progress value. Out of range degrades to indeterminate; reaching max unmounts it.'
		},
		{
			prop: 'max',
			type: 'number',
			default: '100',
			description: 'Maximum progress. Non-positive degrades to 100.'
		},
		{
			prop: 'label',
			type: 'string',
			default: '—',
			description: 'Accessible name for the progress bar.'
		}
	];

	const conditionalProps: PropRow[] = [
		{
			prop: 'Empty.keepVisible',
			type: 'boolean',
			default: 'false',
			description: 'Keeps the empty state mounted even while items are visible.'
		},
		{
			prop: 'Group.forceMount',
			type: 'boolean',
			default: 'false',
			description: 'Keeps the group shown when filtering has hidden every item in it.'
		},
		{
			prop: 'Separator.keepVisible',
			type: 'boolean',
			default: 'false',
			description: 'Keeps the separator shown while a search is active.'
		},
		{
			prop: 'ItemIndicator.forceMount',
			type: 'boolean',
			default: 'false',
			description: 'Renders the indicator even when the item is not selected.'
		},
		{
			prop: 'Portal.to',
			type: 'Element | string',
			default: 'document.body',
			description: 'Where the popover is portalled to.'
		},
		{
			prop: 'Portal.disabled',
			type: 'boolean',
			default: 'false',
			description: 'Renders the popover in place instead of portalling it.'
		},
		{ prop: 'Arrow.width', type: 'number', default: '10', description: 'Arrow width, in pixels.' },
		{ prop: 'Arrow.height', type: 'number', default: '5', description: 'Arrow height, in pixels.' }
	];

	const keyboard = [
		{
			keys: 'Any printable character',
			description: 'Opens the popover and filters the list. Clearing the text clears the value.'
		},
		{
			keys: 'ArrowDown',
			description:
				'Closed: open and highlight the selected item, else the first. Open: move to the next item.'
		},
		{
			keys: 'ArrowUp',
			description:
				'Closed: open and highlight the selected item, else the last. Open: move to the previous item.'
		},
		{
			keys: 'ArrowLeft',
			description:
				'multiple with a badge list and the caret at the leading edge: enter the badges and move toward earlier ones. Inverted under dir="rtl".'
		},
		{
			keys: 'ArrowRight',
			description:
				'multiple with a badge list and the caret at the trailing edge: move toward later badges, then back to the input. Inverted under dir="rtl".'
		},
		{ keys: 'Home / End', description: 'Open: highlight the first / last visible item.' },
		{ keys: 'PageUp / PageDown', description: 'modal and open: move the highlight up / down.' },
		{
			keys: 'Enter',
			description:
				'Selects the highlighted item. With a highlighted badge, removes it. With nothing highlighted or an empty list, reverts the text and closes.'
		},
		{
			keys: 'Escape',
			description: 'Reverts the text to the selected label, clears the highlight and closes.'
		},
		{
			keys: 'Backspace / Delete',
			description:
				'multiple with a badge list and an empty input: removes the highlighted badge, else the last one.'
		},
		{ keys: 'Tab', description: 'Closes and moves focus on — unless modal, where it is trapped.' }
	];
</script>

<svelte:head>
	<title>Combobox — svelte-dice-ui</title>
</svelte:head>

{#snippet propsTable(rows: PropRow[])}
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
			{#each rows as row (row.prop)}
				<Table.Row>
					<Table.Cell class="font-medium">{row.prop}</Table.Cell>
					<Table.Cell class="text-muted-foreground">{row.type}</Table.Cell>
					<Table.Cell class="text-muted-foreground">{row.default}</Table.Cell>
					<Table.Cell>{row.description}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/snippet}

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Combobox</h1>
		<p class="text-muted-foreground">
			An input with a popover that helps users filter through a list of options.
		</p>
	</div>

	<ComponentPreview title="Default" description="Mirrors combobox-demo.tsx.">
		<Combobox.Root bind:value={trick} class="w-[320px]">
			<Combobox.Label>Trick</Combobox.Label>
			<Combobox.Anchor>
				<Combobox.Input placeholder="Search trick..." />
				<Combobox.Cancel aria-label="Clear search" />
				<Combobox.Trigger aria-label="Toggle tricks" />
			</Combobox.Anchor>
			<Combobox.Portal>
				<Combobox.Content>
					<Combobox.Empty>No tricks found.</Combobox.Empty>
					{#each tricks as item (item.value)}
						<Combobox.Item value={item.value} label={item.label}>
							<Combobox.ItemIndicator />
							<Combobox.ItemText>{item.label}</Combobox.ItemText>
						</Combobox.Item>
					{/each}
				</Combobox.Content>
			</Combobox.Portal>
		</Combobox.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Groups"
		description="Mirrors combobox-groups-demo.tsx — groups and separators drop out of the list while a search hides every item in them."
	>
		<Combobox.Root bind:value={groupedTrick} class="w-[320px]">
			<Combobox.Label>Trick</Combobox.Label>
			<Combobox.Anchor>
				<Combobox.Input placeholder="Select trick..." />
				<Combobox.Trigger aria-label="Toggle tricks" />
			</Combobox.Anchor>
			<Combobox.Portal>
				<Combobox.Content>
					<Combobox.Empty>No tricks found.</Combobox.Empty>
					{#each groupedTricks as [category, items], index (category)}
						{#if index > 0}
							<Combobox.Separator />
						{/if}
						<Combobox.Group>
							<Combobox.GroupLabel>{category}</Combobox.GroupLabel>
							{#each items as item (item.value)}
								<Combobox.Item value={item.value} label={item.label}>
									<Combobox.ItemIndicator />
									<Combobox.ItemText>{item.label}</Combobox.ItemText>
								</Combobox.Item>
							{/each}
						</Combobox.Group>
					{/each}
				</Combobox.Content>
			</Combobox.Portal>
		</Combobox.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Multiple Selection"
		description="Mirrors combobox-multiple-demo.tsx — badges are a view of the value, navigable from the input with the arrow keys."
	>
		<Combobox.Root bind:value={multipleTricks} class="w-[400px]" multiple autoHighlight>
			<Combobox.Label>Tricks</Combobox.Label>
			<Combobox.Anchor class="h-full min-h-10 flex-wrap px-3 py-2">
				<Combobox.BadgeList>
					{#each multipleTricks as item (item)}
						<Combobox.BadgeItem value={item}>
							{labelFor(item)}
							<Combobox.BadgeItemDelete aria-label={`Remove ${labelFor(item)}`} />
						</Combobox.BadgeItem>
					{/each}
				</Combobox.BadgeList>
				<Combobox.Input placeholder="Select tricks..." class="h-auto min-w-20 flex-1" />
				<Combobox.Trigger class="absolute top-3 right-2" aria-label="Toggle tricks" />
			</Combobox.Anchor>
			<Combobox.Portal>
				<Combobox.Content>
					<Combobox.Empty>No tricks found.</Combobox.Empty>
					{#each tricks as item (item.value)}
						<Combobox.Item value={item.value} label={item.label}>
							<Combobox.ItemIndicator />
							<Combobox.ItemText>{item.label}</Combobox.ItemText>
						</Combobox.Item>
					{/each}
				</Combobox.Content>
			</Combobox.Portal>
		</Combobox.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Custom Filter"
		description="Mirrors combobox-custom-filter-demo.tsx — onFilter replaces the built-in matcher, here with the createFilter helper the component itself exports."
	>
		<Combobox.Root bind:value={filteredTrick} onFilter={onTrickFilter} class="w-[320px]">
			<Combobox.Label>Trick</Combobox.Label>
			<Combobox.Anchor>
				<Combobox.Input placeholder="Type the start of a label..." />
				<Combobox.Trigger aria-label="Toggle tricks" />
			</Combobox.Anchor>
			<Combobox.Portal>
				<Combobox.Content>
					<Combobox.Empty>No tricks found.</Combobox.Empty>
					{#each tricks as item (item.value)}
						<Combobox.Item value={item.value} label={item.label}>
							<Combobox.ItemIndicator />
							<Combobox.ItemText>{item.label}</Combobox.ItemText>
						</Combobox.Item>
					{/each}
				</Combobox.Content>
			</Combobox.Portal>
		</Combobox.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Debounce"
		description="Mirrors combobox-debounced-demo.tsx — manualFiltering hands filtering to the page, and Loading reports the simulated request."
	>
		<Combobox.Root
			bind:value={debouncedTrick}
			inputValue={debouncedSearch}
			onInputValueChange={onDebouncedInput}
			manualFiltering
			class="w-[320px]"
		>
			<Combobox.Label>Trick</Combobox.Label>
			<Combobox.Anchor>
				<Combobox.Input placeholder="Search trick..." />
				<Combobox.Trigger aria-label="Toggle tricks" />
			</Combobox.Anchor>
			<Combobox.Portal>
				<Combobox.Content>
					<Combobox.Loading value={debouncedProgress} label="Searching tricks">
						Searching…
					</Combobox.Loading>
					<Combobox.Empty keepVisible={debouncedResults.length === 0}>
						No tricks found.
					</Combobox.Empty>
					{#each debouncedResults as item (item.value)}
						<Combobox.Item value={item.value} label={item.label}>
							<Combobox.ItemIndicator />
							<Combobox.ItemText>{item.label}</Combobox.ItemText>
						</Combobox.Item>
					{/each}
				</Combobox.Content>
			</Combobox.Portal>
		</Combobox.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Virtualization"
		description="Mirrors combobox-virtualized-demo.tsx — 10 000 options with manualFiltering and a windowed slice computed in the page, so no virtualization library is needed."
	>
		<Combobox.Root
			bind:value={virtualizedTrick}
			bind:inputValue={virtualizedInput}
			manualFiltering
			class="w-[320px]"
		>
			<Combobox.Label>Trick</Combobox.Label>
			<Combobox.Anchor>
				<Combobox.Input placeholder="Search 10,000 tricks..." />
				<Combobox.Trigger aria-label="Toggle tricks" />
			</Combobox.Anchor>
			<Combobox.Portal>
				<Combobox.Content class="max-h-[300px] overflow-y-auto" onscroll={onVirtualizedScroll}>
					<Combobox.Empty keepVisible={virtualizedMatches.length === 0}>
						No tricks found.
					</Combobox.Empty>
					{#each virtualizedWindow as item (item.value)}
						<Combobox.Item value={item.value} label={item.label}>
							<Combobox.ItemIndicator />
							<Combobox.ItemText>{item.label}</Combobox.ItemText>
						</Combobox.Item>
					{/each}
				</Combobox.Content>
			</Combobox.Portal>
		</Combobox.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Tags Input"
		description="Mirrors combobox-tags-demo.tsx — Combobox.Anchor wraps a TagsInput so the same values can be typed or picked."
	>
		<Combobox.Root bind:value={taggedTricks} multiple class="w-[400px]">
			<Combobox.Label>Tricks</Combobox.Label>
			<Combobox.Anchor class="h-full min-h-10 flex-wrap px-2.5 py-2">
				<TagsInput.Root bind:value={taggedTricks} class="flex-row flex-wrap items-center gap-1.5">
					{#each taggedTricks as item (item)}
						<TagsInput.Item value={item}>
							<TagsInput.ItemText />
							<TagsInput.ItemDelete aria-label={`Remove ${item}`} />
						</TagsInput.Item>
					{/each}
					<Combobox.Input placeholder="Tricks..." class="h-fit min-w-20 flex-1 p-0" />
				</TagsInput.Root>
				<Combobox.Trigger class="absolute top-2.5 right-2" aria-label="Toggle tricks" />
			</Combobox.Anchor>
			<Combobox.Portal>
				<Combobox.Content sideOffset={5}>
					<Combobox.Empty>No tricks found.</Combobox.Empty>
					<Combobox.Group>
						<Combobox.GroupLabel>Tricks</Combobox.GroupLabel>
						{#each tricks as item (item.label)}
							<Combobox.Item value={item.label}>
								<Combobox.ItemIndicator />
								<Combobox.ItemText>{item.label}</Combobox.ItemText>
							</Combobox.Item>
						{/each}
					</Combobox.Group>
				</Combobox.Content>
			</Combobox.Portal>
		</Combobox.Root>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Combobox.Root</h3>
			<p class="text-sm text-muted-foreground">
				Owns the value, the open state, the input text and the filter, and publishes them to every
				part.
			</p>
			{@render propsTable(rootProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Combobox.Anchor</h3>
			<p class="text-sm text-muted-foreground">
				The field the popover positions against. Clicking it focuses the input.
			</p>
			{@render propsTable(anchorProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Combobox.Trigger</h3>
			<p class="text-sm text-muted-foreground">
				Toggles the popover and hands focus back to the input.
			</p>
			{@render propsTable(triggerProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Combobox.Cancel</h3>
			<p class="text-sm text-muted-foreground">
				Clears the typed text and the filter. Not rendered while the input is empty unless
				<code>forceMount</code> is set.
			</p>
			{@render propsTable(cancelProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Combobox.BadgeList</h3>
			<p class="text-sm text-muted-foreground">
				A listbox view of the selected values. Mounting it is what enables badge keyboard navigation
				in the input.
			</p>
			{@render propsTable(badgeListProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Combobox.BadgeItem</h3>
			<p class="text-sm text-muted-foreground">
				One selected value. It stores nothing of its own — everything derives from the root.
			</p>
			{@render propsTable(badgeItemProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Combobox.Content</h3>
			<p class="text-sm text-muted-foreground">
				The popover, positioned against <code>Combobox.Anchor</code> when there is one and against
				the input otherwise. Exposes <code>--dice-anchor-width</code>,
				<code>--dice-anchor-height</code>, <code>--dice-transform-origin</code>,
				<code>--dice-available-width</code> and <code>--dice-available-height</code>.
			</p>
			{@render propsTable(contentProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Combobox.Item</h3>
			<p class="text-sm text-muted-foreground">
				One option. Renders nothing while it is filtered out, but stays registered so it can come
				back.
			</p>
			{@render propsTable(itemProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Combobox.Loading</h3>
			<p class="text-sm text-muted-foreground">
				A progress bar for asynchronous lists. Unmounts itself when the popover closes or the
				progress completes.
			</p>
			{@render propsTable(loadingProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Conditional rendering</h3>
			<p class="text-sm text-muted-foreground">
				The remaining parts take only these props on top of their element attributes and
				<code>children</code>.
			</p>
			{@render propsTable(conditionalProps)}
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
					{#each keyboard as row (row.keys)}
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
