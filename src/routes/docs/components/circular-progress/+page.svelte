<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import * as CircularProgress from '$lib/components/ui/circular-progress/index.js';
	import CircularProgressColorTile from './circular-progress-color-tile.svelte';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	let demoValue = $state(0);

	// The effect must not read `demoValue`, or every tick invalidates it and restarts the interval.
	// The running total lives in a plain `let` the effect owns; the rune only receives it.
	$effect(() => {
		let progress = 0;
		const interval = setInterval(() => {
			progress = Math.min(100, progress + 2);
			demoValue = progress;
			if (progress >= 100) clearInterval(interval);
		}, 150);

		return () => clearInterval(interval);
	});

	let uploadProgress = $state<number | null>(0);
	let isUploading = $state(false);
	let uploadInterval: ReturnType<typeof setInterval> | null = null;

	function startUpload() {
		isUploading = true;
		uploadProgress = 0;
		uploadInterval = setInterval(() => {
			uploadProgress = Math.min(100, (uploadProgress ?? 0) + Math.random() * 15);
			if (uploadProgress >= 100) {
				if (uploadInterval) clearInterval(uploadInterval);
				uploadInterval = null;
				isUploading = false;
			}
		}, 200);
	}

	function resetUpload() {
		uploadProgress = 0;
		isUploading = false;
		if (uploadInterval) {
			clearInterval(uploadInterval);
			uploadInterval = null;
		}
	}

	function forceIndeterminate() {
		uploadProgress = null;
	}

	$effect(() => {
		return () => {
			if (uploadInterval) clearInterval(uploadInterval);
		};
	});

	const themes = [
		{ name: 'Default', trackClass: '', rangeClass: 'text-primary', textClass: 'text-foreground' },
		{
			name: 'Success',
			trackClass: 'text-success/20',
			rangeClass: 'text-success',
			textClass: 'text-success'
		},
		{
			name: 'Warning',
			trackClass: 'text-warning/20',
			rangeClass: 'text-warning',
			textClass: 'text-warning'
		},
		{
			name: 'Destructive',
			trackClass: 'text-destructive/20',
			rangeClass: 'text-destructive',
			textClass: 'text-destructive'
		},
		{ name: 'Info', trackClass: 'text-info/20', rangeClass: 'text-info', textClass: 'text-info' },
		// The last three are the decorative hues (CLAUDE.md §6). The theme is zinc, so without them
		// four of these eight tiles would land on the same grey and two would be pixel-identical.
		{
			name: 'Violet',
			trackClass: 'text-violet/20',
			rangeClass: 'text-violet',
			textClass: 'text-violet'
		},
		{ name: 'Teal', trackClass: 'text-teal/20', rangeClass: 'text-teal', textClass: 'text-teal' },
		{ name: 'Rose', trackClass: 'text-rose/20', rangeClass: 'text-rose', textClass: 'text-rose' }
	];

	const rootProps = [
		{
			prop: 'ref',
			type: 'HTMLDivElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered element.'
		},
		{
			prop: 'value',
			type: 'number | null | undefined',
			default: 'null',
			description: 'The current progress value. `null`/`undefined` renders the indeterminate state.'
		},
		{
			prop: 'getValueText',
			type: '(value, min, max) => string',
			default: 'getDefaultValueText',
			description: 'Formats the accessible/visible value text.'
		},
		{
			prop: 'min',
			type: 'number',
			default: '0',
			description: 'The minimum allowed value. A non-finite value falls back to `0`.'
		},
		{
			prop: 'max',
			type: 'number',
			default: '100',
			description:
				'The maximum allowed value. Non-finite or `<= 0` falls back to `100`; `<= min` corrects to `min + 1`.'
		},
		{
			prop: 'size',
			type: 'number',
			default: '48',
			description: 'The width/height of the ring, in pixels.'
		},
		{
			prop: 'thickness',
			type: 'number',
			default: '4',
			description: 'The stroke width of both circles, in pixels.'
		},
		{
			prop: 'label',
			type: 'string | undefined',
			default: 'undefined',
			description: 'Visible label rendered as the last child and wired via `aria-labelledby`.'
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
			description: 'The composed parts.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description:
				'Replaces upstream `asChild`. `children`/`label` are not rendered and `ref` stays `null`.'
		}
	];

	const svgProps = [
		{
			prop: 'ref',
			type: 'SVGSVGElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<svg>`.'
		},
		{
			prop: 'class',
			type: 'ClassValue',
			default: '—',
			description: 'Merged last, so it overrides the base `-rotate-90 transform` classes.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: 'Normally `Track` + `Range`.'
		}
	];

	const circleProps = [
		{
			prop: 'ref',
			type: 'SVGCircleElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<circle>`.'
		},
		{
			prop: 'class',
			type: 'ClassValue',
			default: '—',
			description: 'Merged last, so it overrides the base classes.'
		}
	];

	const valueTextProps = [
		{
			prop: 'ref',
			type: 'HTMLSpanElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<span>`.'
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
			description: 'Takes precedence over the computed value text.'
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
	<title>Circular Progress — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Circular Progress</h1>
		<p class="text-muted-foreground">
			A circular progress indicator that displays completion progress in a ring format, with full
			support for indeterminate states.
		</p>
	</div>

	<ComponentPreview title="Default" description="Mirrors circular-progress-demo.tsx.">
		<CircularProgress.Root value={demoValue} size={60}>
			<CircularProgress.Indicator>
				<CircularProgress.Track />
				<CircularProgress.Range />
			</CircularProgress.Indicator>
			<CircularProgress.ValueText />
		</CircularProgress.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Interactive"
		description="Mirrors circular-progress-interactive-demo.tsx."
	>
		<div class="flex flex-col items-center gap-6">
			<div class="flex items-center gap-6">
				<CircularProgress.Root value={uploadProgress} min={0} max={100} size={80} thickness={6}>
					<CircularProgress.Indicator>
						<CircularProgress.Track />
						<CircularProgress.Range />
					</CircularProgress.Indicator>
					<CircularProgress.ValueText class="text-base font-semibold" />
				</CircularProgress.Root>
				<div class="flex flex-col gap-2">
					<div class="text-sm font-medium">Upload Progress</div>
					<div class="text-xs text-muted-foreground">
						Status: {isUploading ? 'Uploading…' : uploadProgress === 100 ? 'Complete' : 'Ready'}
					</div>
					<div class="text-xs text-muted-foreground">
						Progress: {uploadProgress === null ? 'Indeterminate' : `${Math.round(uploadProgress)}%`}
					</div>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<Button size="sm" onclick={startUpload} disabled={isUploading}>Start upload</Button>
				<Button size="sm" onclick={resetUpload} disabled={isUploading}>Reset</Button>
				<Button variant="secondary" size="sm" onclick={forceIndeterminate} disabled={isUploading}>
					Indeterminate
				</Button>
			</div>
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="Colors"
		description="Mirrors circular-progress-colors-demo.tsx — each ring eases to 75% once the row scrolls into
			view, one after the next."
	>
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			{#each themes as theme, index (theme.name)}
				<CircularProgressColorTile {theme} {index} />
			{/each}
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="Combined"
		description="The one-line form, equivalent to the manual composition in the Default example."
	>
		<CircularProgress.Combined value={65} size={60} />
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">CircularProgress (Root)</h3>
			<p class="text-sm text-muted-foreground">
				The container that validates and clamps <code>value</code> against
				<code>min</code>/<code>max</code>, derives the ring geometry, and publishes it on context.
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
			<h3 class="text-lg font-medium">CircularProgress.Indicator</h3>
			<p class="text-sm text-muted-foreground">
				The <code>&lt;svg&gt;</code> container that holds the track and range circles.
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
					{#each svgProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">CircularProgress.Track</h3>
			<p class="text-sm text-muted-foreground">
				The background circle representing the full range of possible values.
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
					{#each circleProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">CircularProgress.Range</h3>
			<p class="text-sm text-muted-foreground">
				The portion of the circle representing the current progress value; spins while
				indeterminate.
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
					{#each circleProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">CircularProgress.ValueText</h3>
			<p class="text-sm text-muted-foreground">
				The text element displaying the current progress value or custom content.
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
					{#each valueTextProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">CircularProgress.Combined</h3>
			<p class="text-sm text-muted-foreground">
				Takes the exact Root props (minus <code>children</code>/<code>child</code>) and renders
				<code>Root &gt; Indicator &gt; (Track, Range) + ValueText</code> in one step.
			</p>
		</div>
	</section>
</article>
