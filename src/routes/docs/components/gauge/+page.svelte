<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import * as Gauge from '$lib/components/ui/gauge/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { cn } from '$lib/utils.js';

	const sizes = [
		{ size: 100, thickness: 6, label: 'Small', valueTextClass: 'text-xl' },
		{ size: 140, thickness: 10, label: 'Medium', valueTextClass: 'text-3xl' },
		{ size: 180, thickness: 12, label: 'Large', valueTextClass: 'text-4xl' }
	] as const;

	let sizeValues = $state(sizes.map(() => 0));

	$effect(() => {
		const timers = sizes.map((_, index) => {
			return setTimeout(() => {
				const interval = setInterval(() => {
					sizeValues[index] = Math.min(68, sizeValues[index] + 1);
					if (sizeValues[index] >= 68) clearInterval(interval);
				}, 20);
			}, index * 150);
		});

		return () => {
			for (const timer of timers) clearTimeout(timer);
		};
	});

	const colorThemes = [
		{
			name: 'CPU',
			value: 45,
			trackClass: 'text-success/20',
			rangeClass: 'text-success',
			textClass: 'text-success'
		},
		{
			name: 'Memory',
			value: 68,
			trackClass: 'text-warning/20',
			rangeClass: 'text-warning',
			textClass: 'text-warning'
		},
		{
			name: 'Disk',
			value: 92,
			trackClass: 'text-destructive/20',
			rangeClass: 'text-destructive',
			textClass: 'text-destructive'
		},
		{
			name: 'Network',
			value: 28,
			trackClass: 'text-info/20',
			rangeClass: 'text-info',
			textClass: 'text-info'
		}
	] as const;

	let colorValues = $state(colorThemes.map(() => 0));

	$effect(() => {
		const interval = setInterval(() => {
			colorValues = colorValues.map((value, index) => {
				const target = colorThemes[index]?.value ?? 0;
				return value >= target ? target : value + 1;
			});
		}, 20);

		return () => clearInterval(interval);
	});

	const variants = [
		{ startAngle: -90, endAngle: 90, label: 'Semi Circle' },
		{ startAngle: -135, endAngle: 135, label: 'Three Quarter' },
		{ startAngle: 0, endAngle: 360, label: 'Full Circle' }
	] as const;

	let variantValue = $state(0);

	$effect(() => {
		const interval = setInterval(() => {
			variantValue = variantValue >= 72 ? 72 : variantValue + 1;
			if (variantValue >= 72) clearInterval(interval);
		}, 30);

		return () => clearInterval(interval);
	});

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
			description: 'The current gauge value. `null`/`undefined` renders the indeterminate state.'
		},
		{
			prop: 'getValueText',
			type: '(value, min, max) => string',
			default: 'getDefaultGaugeValueText',
			description: 'Formats the accessible/visible value text — a bare rounded percentage.'
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
			default: '120',
			description: 'The width/height of the gauge, in pixels.'
		},
		{
			prop: 'thickness',
			type: 'number',
			default: '8',
			description: 'The stroke width of the track and range, in pixels.'
		},
		{
			prop: 'startAngle',
			type: 'number',
			default: '0',
			description: "The arc's starting angle, in degrees clockwise from 12 o'clock."
		},
		{
			prop: 'endAngle',
			type: 'number',
			default: '360',
			description: "The arc's ending angle, in degrees clockwise from 12 o'clock."
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
			description: 'Replaces upstream `asChild`. `children` is not rendered and `ref` stays `null`.'
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
			description: 'Merged last onto the base `transform` class.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: 'Normally `Track` + `Range`.'
		}
	];

	const pathProps = [
		{
			prop: 'ref',
			type: 'SVGPathElement | null',
			default: 'null',
			description: 'Bindable reference to the rendered `<path>`.'
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
			prop: 'style',
			type: 'string | undefined | null',
			default: '—',
			description: 'Appended after the computed `top:`, so the caller wins.'
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

	const labelProps = [
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
			description: 'The label text.'
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
	<title>Gauge — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Gauge</h1>
		<p class="text-muted-foreground">
			A circular meter that displays a value along a configurable arc, with full support for custom
			angles, sizes and an indeterminate state.
		</p>
	</div>

	<ComponentPreview title="Default" description="Mirrors gauge-demo.tsx.">
		<Gauge.Root value={85} size={180} thickness={12}>
			<Gauge.Indicator>
				<Gauge.Track />
				<Gauge.Range />
			</Gauge.Indicator>
			<Gauge.ValueText />
			<Gauge.Label class="sr-only">Performance</Gauge.Label>
		</Gauge.Root>
	</ComponentPreview>

	<ComponentPreview title="Sizes" description="Mirrors gauge-sizes-demo.tsx.">
		<div class="flex flex-wrap items-end justify-center gap-8">
			{#each sizes as config, index (config.label)}
				<div class="flex flex-col items-center gap-2">
					<Gauge.Root value={sizeValues[index]} size={config.size} thickness={config.thickness}>
						<Gauge.Indicator>
							<Gauge.Track />
							<Gauge.Range />
						</Gauge.Indicator>
						<Gauge.ValueText class={config.valueTextClass} />
						<Gauge.Label class="sr-only">{config.label}</Gauge.Label>
					</Gauge.Root>
					<p class="text-sm text-muted-foreground">{config.label}</p>
				</div>
			{/each}
		</div>
	</ComponentPreview>

	<ComponentPreview title="Colors" description="Mirrors gauge-colors-demo.tsx.">
		<div class="grid grid-cols-2 gap-6 sm:grid-cols-4">
			{#each colorThemes as theme, index (theme.name)}
				<div class="flex flex-col items-center gap-3">
					<Gauge.Root value={colorValues[index]} size={120} thickness={10}>
						<Gauge.Indicator>
							<Gauge.Track class={theme.trackClass} />
							<Gauge.Range class={theme.rangeClass} />
						</Gauge.Indicator>
						<Gauge.ValueText class={cn('text-xl', theme.textClass)} />
						<Gauge.Label>{theme.name}</Gauge.Label>
					</Gauge.Root>
				</div>
			{/each}
		</div>
	</ComponentPreview>

	<ComponentPreview title="Variants" description="Mirrors gauge-variants-demo.tsx.">
		<div class="flex flex-wrap items-center justify-center gap-12">
			{#each variants as variant (variant.label)}
				<div class="flex flex-col items-center gap-3">
					<Gauge.Root
						value={variantValue}
						size={140}
						thickness={10}
						startAngle={variant.startAngle}
						endAngle={variant.endAngle}
					>
						<Gauge.Indicator>
							<Gauge.Track />
							<Gauge.Range />
						</Gauge.Indicator>
						<Gauge.ValueText />
						<Gauge.Label>{variant.label}</Gauge.Label>
					</Gauge.Root>
				</div>
			{/each}
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="Combined"
		description="The one-line Combined form next to a manual composition, at the same value."
	>
		<div class="flex items-center gap-8">
			<Gauge.Combined value={65} size={140} thickness={10} />
			<Gauge.Root value={65} size={140} thickness={10}>
				<Gauge.Indicator>
					<Gauge.Track />
					<Gauge.Range />
				</Gauge.Indicator>
				<Gauge.ValueText />
			</Gauge.Root>
		</div>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Gauge (Root)</h3>
			<p class="text-sm text-muted-foreground">
				The container that validates and clamps <code>value</code> against
				<code>min</code>/<code>max</code>, derives the arc geometry, and publishes it on context.
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
			<h3 class="text-lg font-medium">Gauge.Indicator</h3>
			<p class="text-sm text-muted-foreground">
				The <code>&lt;svg&gt;</code> container that holds the track and range paths.
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
			<h3 class="text-lg font-medium">Gauge.Track</h3>
			<p class="text-sm text-muted-foreground">
				The background arc representing the full range of possible values.
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
					{#each pathProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Gauge.Range</h3>
			<p class="text-sm text-muted-foreground">
				The portion of the arc representing the current value; animates on change via a CSS
				transition.
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
					{#each pathProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Gauge.ValueText</h3>
			<p class="text-sm text-muted-foreground">
				The text element displaying the current value or custom content, positioned at the arc's
				visual center.
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
			<h3 class="text-lg font-medium">Gauge.Label</h3>
			<p class="text-sm text-muted-foreground">
				An optional visible label; when rendered, wires the root's <code>aria-labelledby</code>.
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
					{#each labelProps as row (row.prop)}
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
			<h3 class="text-lg font-medium">Gauge.Combined</h3>
			<p class="text-sm text-muted-foreground">
				Takes the exact Root props (minus <code>children</code>/<code>child</code>) and renders
				<code>Root &gt; Indicator &gt; (Track, Range) + ValueText</code> in one step. No
				<code>label</code> prop — compose <code>Gauge.Label</code> instead.
			</p>
		</div>
	</section>
</article>
