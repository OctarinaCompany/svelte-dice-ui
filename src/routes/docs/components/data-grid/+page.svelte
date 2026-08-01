<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import * as DataGrid from '$lib/components/ui/data-grid/index.js';
	import {
		createDataGrid,
		type DataGridColumnDef,
		type FileCellData
	} from '$lib/components/ui/data-grid/index.js';

	type SkateTrick = {
		id: string;
		trickName: string;
		skaterName: string;
		difficulty: string;
		variants: string[];
		landed: boolean;
		attempts: number | null;
		bestScore: number | null;
		notes: string;
		clip: string;
		dateAttempted: string | null;
		footage: FileCellData[];
	};

	const DIFFICULTY_OPTIONS = [
		{ label: 'Beginner', value: 'beginner' },
		{ label: 'Intermediate', value: 'intermediate' },
		{ label: 'Advanced', value: 'advanced' },
		{ label: 'Expert', value: 'expert' }
	];

	const VARIANT_OPTIONS = [
		{ label: 'Flip', value: 'flip' },
		{ label: 'Grind', value: 'grind' },
		{ label: 'Grab', value: 'grab' },
		{ label: 'Transition', value: 'transition' },
		{ label: 'Manual', value: 'manual' },
		{ label: 'Slide', value: 'slide' }
	];

	let nextId = $state(5);
	let nextFileId = $state(2);
	let deletedFileCount = $state(0);

	let tricks = $state.raw<SkateTrick[]>([
		{
			id: 'trick-1',
			trickName: 'Kickflip',
			skaterName: 'Rodney Mullen',
			difficulty: 'intermediate',
			variants: ['flip'],
			landed: true,
			attempts: 12,
			bestScore: 92,
			notes: 'Pop straight up, flick off the corner of the nose, catch with the back foot first.',
			clip: 'https://svelte.dev',
			dateAttempted: '2024-05-14',
			footage: [{ id: 'file-1', name: 'kickflip-line.mp4', size: 4_718_592, type: 'video/mp4' }]
		},
		{
			id: 'trick-2',
			trickName: 'Smith Grind',
			skaterName: 'Elissa Steamer',
			difficulty: 'advanced',
			variants: ['grind'],
			landed: false,
			attempts: 27,
			bestScore: 71,
			notes: 'Back truck locks, front truck hangs below the coping.',
			clip: 'diceui.com',
			dateAttempted: '2024-06-02',
			footage: []
		},
		{
			id: 'trick-3',
			trickName: 'Tre Flip',
			skaterName: 'Nyjah Huston',
			difficulty: 'expert',
			variants: ['flip', 'slide'],
			landed: true,
			attempts: 40,
			bestScore: 98,
			notes: 'A 360 shuvit and a kickflip at once — the scoop and the flick have to be equal.',
			clip: '',
			dateAttempted: '2024-06-21',
			footage: []
		},
		{
			id: 'trick-4',
			trickName: 'Manual',
			skaterName: 'Daewon Song',
			difficulty: 'beginner',
			variants: ['manual'],
			landed: true,
			attempts: 5,
			bestScore: 60,
			notes: 'Balance over the back truck without letting the tail scrape.',
			clip: '',
			dateAttempted: null,
			footage: []
		}
	]);

	const columns: DataGridColumnDef<SkateTrick>[] = [
		{
			id: 'trickName',
			accessorKey: 'trickName',
			meta: { label: 'Trick', cell: { variant: 'short-text' } },
			size: 180
		},
		{
			id: 'skaterName',
			accessorKey: 'skaterName',
			meta: { label: 'Skater', cell: { variant: 'short-text' } },
			size: 170
		},
		{
			id: 'difficulty',
			accessorKey: 'difficulty',
			meta: { label: 'Difficulty', cell: { variant: 'select', options: DIFFICULTY_OPTIONS } },
			size: 150
		},
		{
			id: 'variants',
			accessorKey: 'variants',
			meta: { label: 'Variants', cell: { variant: 'multi-select', options: VARIANT_OPTIONS } },
			size: 180
		},
		{
			id: 'landed',
			accessorKey: 'landed',
			meta: { label: 'Landed', cell: { variant: 'checkbox' } },
			size: 90
		},
		{
			id: 'attempts',
			accessorKey: 'attempts',
			meta: { label: 'Attempts', cell: { variant: 'number', min: 0, step: 1 } },
			size: 110
		},
		{
			id: 'bestScore',
			accessorKey: 'bestScore',
			meta: { label: 'Best score', cell: { variant: 'number', min: 0, max: 100 } },
			size: 120
		},
		{
			id: 'notes',
			accessorKey: 'notes',
			meta: { label: 'Notes', cell: { variant: 'long-text' } },
			size: 240
		},
		{
			id: 'clip',
			accessorKey: 'clip',
			meta: { label: 'Clip', cell: { variant: 'url' } },
			size: 180
		},
		{
			id: 'dateAttempted',
			accessorKey: 'dateAttempted',
			meta: { label: 'Attempted', cell: { variant: 'date' } },
			size: 150
		},
		{
			id: 'footage',
			accessorKey: 'footage',
			meta: {
				label: 'Footage',
				cell: {
					variant: 'file',
					maxFileSize: 8 * 1024 * 1024,
					maxFiles: 3,
					accept: 'video/*,image/*',
					multiple: true
				}
			},
			size: 200
		}
	];

	const grid = createDataGrid<SkateTrick>({
		data: () => tricks,
		columns: () => columns,
		getRowId: (row) => row.id,
		initialState: { columnPinning: { left: ['trickName'], right: [] } },
		enableSearch: true,
		enablePaste: true,
		onDataChange: (next) => {
			tricks = next;
		},
		onRowAdd: () => {
			const id = `trick-${nextId++}`;
			tricks = [
				...tricks,
				{
					id,
					trickName: '',
					skaterName: '',
					difficulty: 'beginner',
					variants: [],
					landed: false,
					attempts: null,
					bestScore: null,
					notes: '',
					clip: '',
					dateAttempted: null,
					footage: []
				}
			];
			return { rowIndex: tricks.length - 1, columnId: 'trickName' };
		},
		onRowsAdd: (count) => {
			const added: SkateTrick[] = Array.from({ length: count }, () => ({
				id: `trick-${nextId++}`,
				trickName: '',
				skaterName: '',
				difficulty: 'beginner',
				variants: [],
				landed: false,
				attempts: null,
				bestScore: null,
				notes: '',
				clip: '',
				dateAttempted: null,
				footage: []
			}));
			tricks = [...tricks, ...added];
		},
		onRowsDelete: (rows) => {
			const removed = new Set(rows.map((row) => row.id));
			tricks = tricks.filter((row) => !removed.has(row.id));
		},
		// A demo upload: the files never leave the page, they are just described back to the grid,
		// which writes the returned metadata into the row. A real handler would POST them first.
		onFilesUpload: async ({ files }) =>
			files.map((file) => ({
				id: `file-${nextFileId++}`,
				name: file.name,
				size: file.size,
				type: file.type,
				url: URL.createObjectURL(file)
			})),
		// Nothing to revoke here — the cell revokes its own object URLs — so this only stands in for
		// the delete request a real consumer would await before the row is rewritten.
		onFilesDelete: async ({ fileIds }) => {
			deletedFileCount += fileIds.length;
			await Promise.resolve();
		}
	});
</script>

<svelte:head>
	<title>Data Grid — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Data Grid</h1>
		<p class="text-muted-foreground">
			A virtualized, spreadsheet-like editable grid: keyboard navigation, rectangular cell
			selection, clipboard support and nine cell variants.
		</p>
	</div>

	<ComponentPreview
		title="Default"
		description="Mirrors data-grid-demo.tsx — click a cell to focus it, click again or press Enter to edit, Ctrl/Cmd+F to search, Ctrl/Cmd+/ for the shortcut list."
		class="items-stretch justify-stretch p-0"
	>
		<DataGrid.Root {grid} height={420}>
			<DataGrid.KeyboardShortcuts enableSearch enablePaste enableRowAdd enableRowsDelete />
			<p class="px-1 pt-2 text-xs text-muted-foreground">
				The Footage column accepts up to 3 videos or images of 8 MB each, uploaded through
				<code>onFilesUpload</code>. {deletedFileCount}
				file{deletedFileCount === 1 ? '' : 's'} removed through
				<code>onFilesDelete</code> this session.
			</p>
		</DataGrid.Root>
	</ComponentPreview>
</article>
