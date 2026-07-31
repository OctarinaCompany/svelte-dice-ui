<script lang="ts" module>
	import type {
		QRCodeCanvasChildProps,
		QRCodeChildProps,
		QRCodeDownloadChildProps,
		QRCodeFormat,
		QRCodeImageChildProps,
		QRCodeLevel,
		QRCodeOverlayChildProps,
		QRCodeSkeletonChildProps,
		QRCodeSvgChildProps
	} from './index.js';

	/**
	 * Props of the prop-driven test harness used by `qr-code.test.ts`.
	 *
	 * A `.ts` spec cannot express `bind:`, a `{#snippet child({ props })}` with props, or a
	 * `dir="rtl"`-wrapped variant, so everything that needs a real parent component goes through this
	 * file. It is not collected by Vitest (`include` is `.{js,ts}`) and is not listed in
	 * `registry.json`.
	 */
	export type QRCodeHarnessProps = {
		/** Forwarded to `QRCode.Root`. */
		value?: string;
		/** Forwarded to `QRCode.Root`. */
		size?: number;
		/** Forwarded to `QRCode.Root`. */
		level?: QRCodeLevel;
		/** Forwarded to `QRCode.Root`. */
		margin?: number;
		/** Forwarded to `QRCode.Root`. */
		quality?: number;
		/** Forwarded to `QRCode.Root`. */
		foregroundColor?: string;
		/** Forwarded to `QRCode.Root`. */
		backgroundColor?: string;
		/** Forwarded to `QRCode.Root`. */
		onError?: (error: Error) => void;
		/** Forwarded to `QRCode.Root`. */
		onGenerated?: () => void;
		/** Forwarded to `QRCode.Root` as its `class`. */
		class?: string;
		/** Forwarded to `QRCode.Root` as its `style`. */
		style?: string;
		/** Forwarded to `QRCode.Root` through `restProps`. */
		id?: string;

		/** Render `QRCode.Canvas`. */
		canvas?: boolean;
		/** Render `QRCode.Svg`. */
		svg?: boolean;
		/** Render `QRCode.Image`. */
		image?: boolean;
		/** Render `QRCode.Overlay`. */
		overlay?: boolean;
		/** Render `QRCode.Skeleton`. */
		skeleton?: boolean;
		/** Render `QRCode.Download`. */
		download?: boolean;

		/** Forwarded to `QRCode.Canvas` as its `class`. */
		canvasClass?: string;
		/** Forwarded to `QRCode.Svg` as its `class`. */
		svgClass?: string;
		/** Forwarded to `QRCode.Image` as its `class`. */
		imageClass?: string;
		/** Forwarded to `QRCode.Overlay` as its `class`. */
		overlayClass?: string;
		/** Forwarded to `QRCode.Skeleton` as its `class`. */
		skeletonClass?: string;
		/** Forwarded to `QRCode.Download` as its `class`. */
		downloadClass?: string;

		/** Overrides `QRCode.Canvas`'s default `aria-label` through `restProps`. */
		canvasLabel?: string;
		/** Overrides `QRCode.Svg`'s default `aria-label` through `restProps`. */
		svgLabel?: string;
		/** Forwarded to `QRCode.Image`. */
		alt?: string;
		/** Forwarded to `QRCode.Svg` as its `style`. */
		svgStyle?: string;
		/** Forwarded to `QRCode.Skeleton` as its `style`. */
		skeletonStyle?: string;
		/** Forwarded to `QRCode.Download`. */
		filename?: string;
		/** Forwarded to `QRCode.Download`. */
		format?: QRCodeFormat;
		/** Forwarded to `QRCode.Download` as its `onclick`. */
		onDownloadClick?: (event: MouseEvent) => void;
		/** Explicit `children` text for `QRCode.Download` instead of the computed label. */
		downloadLabel?: string;

		/** Render `QRCode.Root` through the `child` snippet onto a `<section>`. */
		useRootChild?: boolean;
		/** Render `QRCode.Canvas` through the `child` snippet. */
		useCanvasChild?: boolean;
		/**
		 * The element `useCanvasChild` renders onto — a `<span>` to prove the attributes land, a
		 * `<canvas>` to prove the code is still drawn.
		 * @default "span"
		 */
		canvasChildTag?: 'span' | 'canvas';
		/** Render `QRCode.Svg` through the `child` snippet onto a `<span>`. */
		useSvgChild?: boolean;
		/** Render `QRCode.Image` through the `child` snippet onto a `<span>`. */
		useImageChild?: boolean;
		/** Render `QRCode.Overlay` through the `child` snippet onto a `<span>`. */
		useOverlayChild?: boolean;
		/** Render `QRCode.Skeleton` through the `child` snippet onto a `<span>`. */
		useSkeletonChild?: boolean;
		/** Render `QRCode.Download` through the `child` snippet onto a `<button>`. */
		useDownloadChild?: boolean;

		/** Wrap the harness in a `<div dir="rtl">`. */
		rtl?: boolean;
		/** Render an extra `QRCode.Canvas` as a *sibling* of `QRCode.Root`, outside its context. */
		siblingCanvas?: boolean;

		/** Bound to `QRCode.Root`'s `ref`. */
		rootRef?: HTMLDivElement | null;
		/** Bound to `QRCode.Canvas`'s `ref`. */
		canvasRef?: HTMLCanvasElement | null;
		/** Bound to `QRCode.Svg`'s `ref`. */
		svgRef?: HTMLDivElement | null;
		/** Bound to `QRCode.Image`'s `ref`. */
		imageRef?: HTMLImageElement | null;
		/** Bound to `QRCode.Overlay`'s `ref`. */
		overlayRef?: HTMLDivElement | null;
		/** Bound to `QRCode.Skeleton`'s `ref`. */
		skeletonRef?: HTMLDivElement | null;
		/** Bound to `QRCode.Download`'s `ref`. */
		downloadRef?: HTMLButtonElement | null;
	};
</script>

<script lang="ts">
	import * as QRCode from './index.js';

	let {
		value = 'https://diceui.com',
		size,
		level,
		margin,
		quality,
		foregroundColor,
		backgroundColor,
		onError,
		onGenerated,
		class: className,
		style,
		id,
		canvas = true,
		svg = true,
		image = true,
		overlay = true,
		skeleton = true,
		download = true,
		canvasClass,
		svgClass,
		imageClass,
		overlayClass,
		skeletonClass,
		downloadClass,
		canvasLabel,
		svgLabel,
		alt,
		svgStyle,
		skeletonStyle,
		filename,
		format,
		onDownloadClick,
		downloadLabel,
		useRootChild = false,
		useCanvasChild = false,
		canvasChildTag = 'span',
		useSvgChild = false,
		useImageChild = false,
		useOverlayChild = false,
		useSkeletonChild = false,
		useDownloadChild = false,
		rtl = false,
		siblingCanvas = false,
		rootRef = $bindable(null),
		canvasRef = $bindable(null),
		svgRef = $bindable(null),
		imageRef = $bindable(null),
		overlayRef = $bindable(null),
		skeletonRef = $bindable(null),
		downloadRef = $bindable(null)
	}: QRCodeHarnessProps = $props();
</script>

{#snippet rootChild({ props }: { props: QRCodeChildProps })}
	<section data-testid="root-child" {...props as Record<string, unknown>}>
		{@render body()}
	</section>
{/snippet}

{#snippet canvasChild({ props }: { props: QRCodeCanvasChildProps })}
	{#if canvasChildTag === 'canvas'}
		<canvas data-testid="canvas-child" {...props as Record<string, unknown>}></canvas>
	{:else}
		<span data-testid="canvas-child" {...props as Record<string, unknown>}></span>
	{/if}
{/snippet}

{#snippet svgChild({ props }: { props: QRCodeSvgChildProps })}
	<span data-testid="svg-child" {...props as Record<string, unknown>}></span>
{/snippet}

{#snippet imageChild({ props }: { props: QRCodeImageChildProps })}
	<span data-testid="image-child" {...props as Record<string, unknown>}></span>
{/snippet}

{#snippet overlayChild({ props }: { props: QRCodeOverlayChildProps })}
	<span data-testid="overlay-child" {...props as Record<string, unknown>}>overlay</span>
{/snippet}

{#snippet skeletonChild({ props }: { props: QRCodeSkeletonChildProps })}
	<span data-testid="skeleton-child" {...props as Record<string, unknown>}></span>
{/snippet}

{#snippet downloadChild({ props }: { props: QRCodeDownloadChildProps })}
	<button data-testid="download-child" {...props as Record<string, unknown>}>Save it</button>
{/snippet}

{#snippet body()}
	{#if skeleton}
		<QRCode.Skeleton
			bind:ref={skeletonRef}
			class={skeletonClass}
			style={skeletonStyle}
			child={useSkeletonChild ? skeletonChild : undefined}
		/>
	{/if}
	{#if canvas}
		<QRCode.Canvas
			bind:ref={canvasRef}
			class={canvasClass}
			{...canvasLabel ? { 'aria-label': canvasLabel } : {}}
			child={useCanvasChild ? canvasChild : undefined}
		/>
	{/if}
	{#if svg}
		<QRCode.Svg
			bind:ref={svgRef}
			class={svgClass}
			style={svgStyle}
			{...svgLabel ? { 'aria-label': svgLabel } : {}}
			child={useSvgChild ? svgChild : undefined}
		/>
	{/if}
	{#if image}
		<QRCode.Image
			bind:ref={imageRef}
			class={imageClass}
			{alt}
			child={useImageChild ? imageChild : undefined}
		/>
	{/if}
	{#if overlay}
		<QRCode.Overlay
			bind:ref={overlayRef}
			class={overlayClass}
			child={useOverlayChild ? overlayChild : undefined}
		>
			logo
		</QRCode.Overlay>
	{/if}
	{#if download}
		{#if downloadLabel}
			<QRCode.Download
				bind:ref={downloadRef}
				class={downloadClass}
				{filename}
				{format}
				onclick={onDownloadClick}
				child={useDownloadChild ? downloadChild : undefined}
			>
				{downloadLabel}
			</QRCode.Download>
		{:else}
			<QRCode.Download
				bind:ref={downloadRef}
				class={downloadClass}
				{filename}
				{format}
				onclick={onDownloadClick}
				child={useDownloadChild ? downloadChild : undefined}
			/>
		{/if}
	{/if}
{/snippet}

{#snippet root()}
	<QRCode.Root
		bind:ref={rootRef}
		{value}
		{size}
		{level}
		{margin}
		{quality}
		{foregroundColor}
		{backgroundColor}
		{onError}
		{onGenerated}
		class={className}
		{style}
		{id}
		child={useRootChild ? rootChild : undefined}
	>
		{#if !useRootChild}
			{@render body()}
		{/if}
	</QRCode.Root>
{/snippet}

{#if rtl}
	<div dir="rtl">
		{@render root()}
	</div>
{:else}
	{@render root()}
{/if}

{#if siblingCanvas}
	<QRCode.Canvas />
{/if}
