<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	import type { FileUploadRootState, FileUploadUploadOptions } from './index.js';

	/**
	 * Which composition this render exercises. A `.ts` spec cannot express `bind:value`, the function
	 * binding `bind:value={get, set}`, a `child` snippet, a `render` snippet, or a part rendered with
	 * no provider above it, so everything needing a real component tree goes through this file. It is
	 * not collected by Vitest (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 *
	 * Only *structural* variations are modes: everything else (controlled, rtl, validation, upload,
	 * progress variants, `child` mode) is a prop on the one default composition, because those
	 * variations differ only in what the parts are handed, not in which parts are rendered.
	 */
	export type FileUploadHarnessMode =
		| 'default'
		/** Each root-level part with no `<FileUpload>` ancestor at all. */
		| 'bare-dropzone'
		| 'bare-trigger'
		| 'bare-list'
		| 'bare-item'
		| 'bare-clear'
		/** `useFileUpload()` called with no `<FileUpload>` ancestor at all. */
		| 'bare-use-file-upload'
		/** Inside a `<FileUpload>` but with no `<FileUpload.Item>` ancestor. */
		| 'preview-without-item'
		| 'metadata-without-item'
		| 'progress-without-item'
		| 'delete-without-item'
		/** An item, and all of its parts, for a file that is not in the root's value. */
		| 'stray-item';

	/**
	 * How the harness hands `value` to the root.
	 *
	 * - `none` — uncontrolled: only `defaultValue` is passed; the root seeds and then owns the value,
	 *   writing every change back out through the binding so the harness can render the items.
	 * - `value` — `bind:value`, the parent accepts every change.
	 * - `function` — `bind:value={() => authoritative, (next) => …}`, the parent stays authoritative
	 *   and declines the write (contracts §5).
	 */
	export type FileUploadHarnessBinding = 'none' | 'value' | 'function';

	export type FileUploadHarnessProps = {
		/** @default 'default' */
		mode?: FileUploadHarnessMode;
		/** @default 'none' */
		binding?: FileUploadHarnessBinding;
		// root
		value?: File[];
		/** The value a declining parent keeps returning in `binding="function"` mode. */
		authoritative?: File[];
		/** Receives every write a declining parent refuses to apply. */
		onDeclinedValue?: (value: File[]) => void;
		defaultValue?: File[];
		onValueChange?: (value: File[]) => void;
		onAccept?: (files: File[]) => void;
		onFileAccept?: (file: File) => void;
		onFileReject?: (file: File, message: string) => void;
		onFileValidate?: (file: File) => string | null | undefined;
		onUpload?: (files: File[], options: FileUploadUploadOptions) => Promise<void> | void;
		accept?: string;
		maxFiles?: number;
		maxSize?: number;
		dir?: Direction;
		label?: string;
		name?: string;
		disabled?: boolean;
		invalid?: boolean;
		/** @default true */
		multiple?: boolean;
		required?: boolean;
		// parts
		/** @default true */
		withTrigger?: boolean;
		/** @default true */
		withClear?: boolean;
		/** @default false */
		clearForceMount?: boolean;
		/** @default false */
		clearDisabled?: boolean;
		/** @default 'vertical' */
		listOrientation?: 'horizontal' | 'vertical';
		/** @default false */
		listForceMount?: boolean;
		/** @default 'default' */
		metadataSize?: 'default' | 'sm';
		/** Replace `ItemMetadata`'s default name/size/error trio with the harness's own content. */
		metadataChildren?: boolean;
		/** @default false */
		withProgress?: boolean;
		/** Render the progress part inside `ItemPreview` instead of beside it. @default false */
		progressInPreview?: boolean;
		/** @default 'linear' */
		progressVariant?: 'linear' | 'circular' | 'fill';
		/** @default 40 */
		progressSize?: number;
		/** @default false */
		progressForceMount?: boolean;
		/** Decorate `ItemPreview`'s default output through its `render` snippet. @default false */
		previewRender?: boolean;
		/** Render every part through its `child` snippet onto the harness's own element. */
		asChild?: boolean;
		/** Render a `useFileUpload()` consumer inside the root. @default false */
		withProbe?: boolean;
		/** Receives the state `useFileUpload()` resolved, so a spec can drive its methods. */
		onRootState?: (state: FileUploadRootState) => void;
		/** The file the `stray-item` mode builds an item for; never added to the root's value. */
		strayValue?: File;
		// pass-through event handlers
		/**
		 * Records every event the caller's own handler receives, before the part acts on it. The type
		 * is the part-scoped name (`"dropzone-click"`, `"trigger-click"`, …).
		 */
		onEvent?: (type: string, event: Event) => void;
		/** The pass-through handler calls `preventDefault()` for these types. */
		preventDefaultOn?: string[];
		// surroundings
		/** Wrap the file upload in a `<DirectionProvider>` with this direction. */
		providerDir?: Direction;
		/** A focusable element after the root, so `userEvent.tab()` can leave the component. */
		withOutsideButton?: boolean;
	};
</script>

<script lang="ts">
	import { DirectionProvider } from '$lib/components/ui/direction-provider/index.js';
	import type { Snippet } from 'svelte';

	import FileUploadProbe from './file-upload-probe.test.svelte';
	import * as FileUpload from './index.js';

	let {
		mode = 'default',
		binding = 'none',
		value = $bindable(),
		authoritative = [],
		onDeclinedValue,
		defaultValue,
		onValueChange,
		onAccept,
		onFileAccept,
		onFileReject,
		onFileValidate,
		onUpload,
		accept,
		maxFiles,
		maxSize,
		dir,
		label,
		name,
		disabled,
		invalid,
		multiple = true,
		required,
		withTrigger = true,
		withClear = true,
		clearForceMount = false,
		clearDisabled = false,
		listOrientation,
		listForceMount = false,
		metadataSize,
		metadataChildren = false,
		withProgress = false,
		progressInPreview = false,
		progressVariant,
		progressSize,
		progressForceMount = false,
		previewRender = false,
		asChild = false,
		withProbe = false,
		onRootState,
		strayValue = new File(['stray'], 'stray.txt', { type: 'text/plain' }),
		onEvent,
		preventDefaultOn,
		providerDir,
		withOutsideButton = true
	}: FileUploadHarnessProps = $props();

	/**
	 * The caller-supplied handler each part composes with its own: it runs first, and suppresses the
	 * part's internal behaviour by calling `preventDefault()` (plan.md → Dropzone).
	 */
	function passThrough(type: string) {
		return (event: Event) => {
			onEvent?.(type, event);
			if (preventDefaultOn?.includes(type)) event.preventDefault();
		};
	}

	// No `<FileUpload>` ancestor in these modes — reproduces a consumer using a part outside its
	// provider, which must throw during that part's own initialisation.
	const bareMode = $derived(mode.startsWith('bare-'));

	/** What the `{#each}` below renders. A declining parent never lets this move (contracts §5). */
	const files = $derived(binding === 'function' ? authoritative : (value ?? []));

	const rootProps = $derived({
		defaultValue,
		onValueChange,
		onAccept,
		onFileAccept,
		onFileReject,
		onFileValidate,
		onUpload,
		accept,
		maxFiles,
		maxSize,
		dir,
		label,
		name,
		disabled,
		invalid,
		multiple,
		required
	});
</script>

{#snippet progressPart()}
	{#if asChild}
		<FileUpload.ItemProgress
			variant={progressVariant}
			size={progressSize}
			forceMount={progressForceMount}
			child={progressChild}
		/>
	{:else}
		<FileUpload.ItemProgress
			variant={progressVariant}
			size={progressSize}
			forceMount={progressForceMount}
			data-testid="progress"
		/>
	{/if}
{/snippet}

{#snippet progressChild({ props }: { props: FileUpload.FileUploadItemProgressChildProps })}
	<div {...props} data-testid="progress-child"></div>
{/snippet}

{#snippet previewDecorated({ file, fallback }: { file: File; fallback: Snippet })}
	<span data-testid={`render-${file.name}`}>rendered</span>
	{@render fallback()}
{/snippet}

{#snippet previewInner()}
	{#if progressInPreview}
		{@render progressPart()}
	{/if}
{/snippet}

{#snippet previewChild({ props }: { props: FileUpload.FileUploadItemPreviewChildProps })}
	<div {...props} data-testid="preview-child">
		{@render previewInner()}
	</div>
{/snippet}

{#snippet metadataInner()}
	<span data-testid="metadata-custom">custom metadata</span>
{/snippet}

{#snippet metadataChild({ props }: { props: FileUpload.FileUploadItemMetadataChildProps })}
	<div {...props} data-testid="metadata-child"></div>
{/snippet}

{#snippet deleteChild({ props }: { props: FileUpload.FileUploadItemDeleteChildProps })}
	<button {...props} data-testid="delete-child">Remove</button>
{/snippet}

{#snippet itemBody(file: File)}
	{#if asChild}
		<FileUpload.ItemPreview
			render={previewRender ? previewDecorated : undefined}
			child={previewChild}
		/>
		<FileUpload.ItemMetadata size={metadataSize} child={metadataChild} />
		{#if withProgress && !progressInPreview}
			{@render progressPart()}
		{/if}
		<FileUpload.ItemDelete child={deleteChild} />
	{:else}
		<FileUpload.ItemPreview
			render={previewRender ? previewDecorated : undefined}
			data-testid={`preview-${file.name}`}
		>
			{@render previewInner()}
		</FileUpload.ItemPreview>
		{#if metadataChildren}
			<FileUpload.ItemMetadata size={metadataSize} data-testid={`metadata-${file.name}`}>
				{@render metadataInner()}
			</FileUpload.ItemMetadata>
		{:else}
			<FileUpload.ItemMetadata size={metadataSize} data-testid={`metadata-${file.name}`} />
		{/if}
		{#if withProgress && !progressInPreview}
			{@render progressPart()}
		{/if}
		<FileUpload.ItemDelete aria-label={`Remove ${file.name}`} onclick={passThrough('delete-click')}>
			x
		</FileUpload.ItemDelete>
	{/if}
{/snippet}

{#snippet listInner()}
	{#each files as file (file)}
		{#snippet itemChild({ props }: { props: FileUpload.FileUploadItemChildProps })}
			<div {...props} data-testid="item-child">
				{@render itemBody(file)}
			</div>
		{/snippet}
		{#if asChild}
			<FileUpload.Item value={file} child={itemChild} />
		{:else}
			<FileUpload.Item value={file} data-testid={`item-${file.name}`}>
				{@render itemBody(file)}
			</FileUpload.Item>
		{/if}
	{/each}
{/snippet}

{#snippet listChild({ props }: { props: FileUpload.FileUploadListChildProps })}
	<div {...props} data-testid="list-child">
		{@render listInner()}
	</div>
{/snippet}

{#snippet triggerChild({ props }: { props: FileUpload.FileUploadTriggerChildProps })}
	<button {...props} data-testid="trigger-child">Browse files</button>
{/snippet}

{#snippet dropzoneInner()}
	<span>Drag &amp; drop files here</span>
	{#if withTrigger}
		{#if asChild}
			<FileUpload.Trigger child={triggerChild} />
		{:else}
			<FileUpload.Trigger data-testid="trigger" onclick={passThrough('trigger-click')}>
				Browse files
			</FileUpload.Trigger>
		{/if}
	{/if}
{/snippet}

{#snippet dropzoneChild({ props }: { props: FileUpload.FileUploadDropzoneChildProps })}
	<div {...props} data-testid="dropzone-child">
		{@render dropzoneInner()}
	</div>
{/snippet}

{#snippet clearChild({ props }: { props: FileUpload.FileUploadClearChildProps })}
	<button {...props} data-testid="clear-child">Clear</button>
{/snippet}

{#snippet body()}
	{#if asChild}
		<FileUpload.Dropzone child={dropzoneChild} />
		<FileUpload.List orientation={listOrientation} forceMount={listForceMount} child={listChild} />
		{#if withClear}
			<FileUpload.Clear forceMount={clearForceMount} disabled={clearDisabled} child={clearChild} />
		{/if}
	{:else}
		<FileUpload.Dropzone
			data-testid="dropzone"
			onclick={passThrough('dropzone-click')}
			ondragenter={passThrough('dropzone-dragenter')}
			ondragover={passThrough('dropzone-dragover')}
			ondragleave={passThrough('dropzone-dragleave')}
			ondrop={passThrough('dropzone-drop')}
			onpaste={passThrough('dropzone-paste')}
			onkeydown={passThrough('dropzone-keydown')}
		>
			{@render dropzoneInner()}
		</FileUpload.Dropzone>
		<FileUpload.List orientation={listOrientation} forceMount={listForceMount} data-testid="list">
			{@render listInner()}
		</FileUpload.List>
		{#if withClear}
			<FileUpload.Clear
				forceMount={clearForceMount}
				disabled={clearDisabled}
				data-testid="clear"
				onclick={passThrough('clear-click')}
			>
				Clear
			</FileUpload.Clear>
		{/if}
	{/if}
	{#if withProbe}
		<FileUploadProbe onstate={onRootState} />
	{/if}
{/snippet}

{#snippet rootChild({ props }: { props: FileUpload.FileUploadChildProps })}
	<div {...props} data-testid="root-child">
		{@render body()}
	</div>
{/snippet}

{#snippet root()}
	{#if binding === 'function'}
		<FileUpload.Root
			bind:value={() => authoritative, (next) => onDeclinedValue?.(next)}
			{...rootProps}
			data-testid="root"
		>
			{@render body()}
		</FileUpload.Root>
	{:else if asChild}
		<FileUpload.Root bind:value {...rootProps} data-testid="root" child={rootChild} />
	{:else}
		<FileUpload.Root bind:value {...rootProps} data-testid="root">
			{@render body()}
		</FileUpload.Root>
	{/if}
{/snippet}

{#snippet framed()}
	{@render root()}
	{#if withOutsideButton}
		<button type="button" data-testid="outside">Outside</button>
	{/if}
{/snippet}

{#if bareMode}
	{#if mode === 'bare-dropzone'}
		<FileUpload.Dropzone />
	{:else if mode === 'bare-trigger'}
		<FileUpload.Trigger />
	{:else if mode === 'bare-list'}
		<FileUpload.List forceMount />
	{:else if mode === 'bare-item'}
		<FileUpload.Item value={new File(['x'], 'bare.txt')} />
	{:else if mode === 'bare-clear'}
		<FileUpload.Clear forceMount />
	{:else}
		<FileUploadProbe />
	{/if}
{:else if mode === 'preview-without-item'}
	<FileUpload.Root>
		<FileUpload.ItemPreview />
	</FileUpload.Root>
{:else if mode === 'metadata-without-item'}
	<FileUpload.Root>
		<FileUpload.ItemMetadata />
	</FileUpload.Root>
{:else if mode === 'progress-without-item'}
	<FileUpload.Root>
		<FileUpload.ItemProgress />
	</FileUpload.Root>
{:else if mode === 'delete-without-item'}
	<FileUpload.Root>
		<FileUpload.ItemDelete />
	</FileUpload.Root>
{:else if mode === 'stray-item'}
	<FileUpload.Root {defaultValue}>
		<FileUpload.List forceMount data-testid="list">
			<FileUpload.Item value={strayValue} data-testid="stray-item">
				<FileUpload.ItemPreview />
				<FileUpload.ItemMetadata />
				<FileUpload.ItemProgress forceMount />
				<FileUpload.ItemDelete>x</FileUpload.ItemDelete>
			</FileUpload.Item>
		</FileUpload.List>
	</FileUpload.Root>
{:else if providerDir}
	<DirectionProvider dir={providerDir}>
		{@render framed()}
	</DirectionProvider>
{:else}
	{@render framed()}
{/if}
