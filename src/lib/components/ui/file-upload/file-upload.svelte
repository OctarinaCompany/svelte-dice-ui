<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	import type { FileUploadUploadOptions } from './file-upload.svelte.js';

	/** The merged attribute payload handed to the `child` snippet. */
	export type FileUploadChildProps = {
		'data-slot': 'file-upload';
		'data-disabled': '' | undefined;
		dir: Direction;
		class: string;
	} & Record<string, unknown>;

	export type FileUploadRootProps = WithElementRef<
		Omit<HTMLAttributes<HTMLDivElement>, 'dir'>,
		HTMLDivElement
	> & {
		/**
		 * Controlled list of selected files.
		 *
		 * Bindable: `bind:value={files}` lets the file upload move your state, while the function
		 * binding `bind:value={() => files, (next) => …}` keeps you authoritative — a setter that
		 * declines the write leaves the rendered list exactly where it was.
		 */
		value?: File[];
		/**
		 * Initial list of files when uncontrolled.
		 *
		 * @default []
		 */
		defaultValue?: File[];
		/** Called on every addition and removal, in both modes. */
		onValueChange?: (files: File[]) => void;
		/** Called once per processed batch with every accepted file. */
		onAccept?: (files: File[]) => void;
		/** Called for each accepted file. */
		onFileAccept?: (file: File) => void;
		/** Called for each rejected file with the reason it was rejected. */
		onFileReject?: (file: File, message: string) => void;
		/** Custom per-file validation. Returning a string rejects the file with that message. */
		onFileValidate?: (file: File) => string | null | undefined;
		/**
		 * The upload transport. Receives the accepted files together with the `onProgress`,
		 * `onSuccess` and `onError` reporters; the component prescribes no transport of its own.
		 * When omitted, accepted files are marked successful immediately.
		 */
		onUpload?: (files: File[], options: FileUploadUploadOptions) => Promise<void> | void;
		/** Comma-separated list of accepted MIME types, extensions or `type/*` wildcards. */
		accept?: string;
		/** Maximum number of files that may be listed at once. */
		maxFiles?: number;
		/** Maximum size per file, in bytes. */
		maxSize?: number;
		/**
		 * The reading direction of the file upload.
		 *
		 * @default the nearest `<DirectionProvider>`, else the DOM `[dir]`, else "ltr"
		 */
		dir?: Direction;
		/**
		 * The accessible name of the hidden file input.
		 *
		 * @default "File upload"
		 */
		label?: string;
		/** Name of the form field when used in a form. */
		name?: string;
		/**
		 * Suppresses the dialog, drag and drop, paste, keyboard activation, deletion and clearing.
		 *
		 * @default false
		 */
		disabled?: boolean;
		/**
		 * Forces the dropzone's invalid state on, independently of the transient rejection flash.
		 *
		 * @default false
		 */
		invalid?: boolean;
		/**
		 * Whether the native dialog allows selecting more than one file.
		 *
		 * @default false
		 */
		multiple?: boolean;
		/**
		 * Whether the field is required in a form context.
		 *
		 * @default false
		 */
		required?: boolean;
		/**
		 * Render the root onto your own element instead of the default `<div>`. The snippet receives
		 * the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild` (Radix `Slot`), which has no Svelte equivalent. In `child` mode
		 * `children` is not rendered and `ref` stays `null` — the caller owns the element, so the
		 * hidden input and the screen-reader label render as its siblings instead of its children.
		 */
		child?: Snippet<[{ props: FileUploadChildProps }]>;
		/** The content of the file upload. */
		children?: Snippet;
	};

	/** Upstream-parity alias of {@link FileUploadRootProps}. */
	export type FileUploadProps = FileUploadRootProps;
</script>

<script lang="ts">
	import { useDirection } from '$lib/components/ui/direction-provider/index.js';
	import { untrack } from 'svelte';

	import { FileUploadRootState, setFileUploadContext } from './file-upload.svelte.js';

	let {
		ref = $bindable(null),
		value = $bindable(),
		defaultValue = [],
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
		label = 'File upload',
		name,
		disabled = false,
		invalid = false,
		multiple = false,
		required = false,
		class: className,
		child,
		children,
		...restProps
	}: FileUploadRootProps = $props();

	// Uncontrolled: seed once from `defaultValue`. Controlled: the caller's binding wins, and a
	// binding that declines the write keeps the rendered list where it was. The seed is a one-shot
	// initialisation, so `defaultValue` is read through `untrack` rather than looking like a reactive
	// read that only ever captures the initial value. Spelt as an `if` rather than `??=`, which
	// Svelte compiles into an unconditional write and would notify a controlled parent of a change
	// that never happened.
	if (value === undefined) value = untrack(() => defaultValue);

	const direction = useDirection({ dir: () => dir, element: () => ref });

	const uid = $props.id();

	const root = setFileUploadContext(
		new FileUploadRootState({
			getValue: () => value ?? [],
			setValue: (next) => {
				value = next;
				onValueChange?.(next);
			},
			getAccept: () => accept,
			getMaxFiles: () => maxFiles,
			getMaxSize: () => maxSize,
			getDisabled: () => disabled,
			getInvalid: () => invalid,
			getDir: () => direction.current,
			getOnAccept: () => onAccept,
			getOnFileAccept: () => onFileAccept,
			getOnFileReject: () => onFileReject,
			getOnFileValidate: () => onFileValidate,
			getOnUpload: () => onUpload,
			id: uid
		})
	);

	// Everything the state class starts — the progress frame, the deferred upload, the invalid-flash
	// timer and every minted object URL — is stopped and released here (research R-10).
	$effect(() => () => root.destroy());

	function onchange(event: Event & { currentTarget: EventTarget & HTMLInputElement }) {
		const input = event.currentTarget;
		root.addFiles(Array.from(input.files ?? []));
		// Even a fully rejected batch clears the input, so the same file can be picked again.
		input.value = '';
	}

	const rootAttrs = $derived({
		'data-slot': 'file-upload',
		'data-disabled': disabled ? '' : undefined,
		dir: root.dir,
		...restProps,
		class: cn('relative flex flex-col gap-2', className)
	} as FileUploadChildProps);
</script>

<!--
	The hidden input is the last child of the root, after `children` (upstream file-upload.tsx:
	652-670). In `child` mode the caller owns the element, so both render as its siblings — nothing in
	the component depends on containment, only on the ids.
-->
{#snippet hiddenControls()}
	<input
		bind:this={root.inputRef}
		type="file"
		id={root.inputId}
		aria-labelledby={root.labelId}
		aria-describedby={root.dropzoneId}
		tabindex={-1}
		class="sr-only"
		{accept}
		{name}
		{disabled}
		{multiple}
		{required}
		{onchange}
	/>
	<div id={root.labelId} class="sr-only">{label}</div>
{/snippet}

{#if child}
	{@render child({ props: rootAttrs })}
	{@render hiddenControls()}
{:else}
	<div bind:this={ref} {...rootAttrs}>
		{@render children?.()}
		{@render hiddenControls()}
	</div>
{/if}
