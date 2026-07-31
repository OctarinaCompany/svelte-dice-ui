<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	/** The merged attribute payload handed to the `child` snippet. */
	export type FileUploadDropzoneChildProps = {
		role: 'region';
		'data-slot': 'file-upload-dropzone';
		'data-disabled': '' | undefined;
		'data-dragging': '' | undefined;
		'data-invalid': '' | undefined;
		dir: Direction;
		class: string;
	} & Record<string, unknown>;

	export type FileUploadDropzoneProps = WithElementRef<
		Omit<HTMLAttributes<HTMLDivElement>, 'dir'>,
		HTMLDivElement
	> & {
		/**
		 * Render the dropzone onto your own element instead of the default `<div>`. The snippet
		 * receives the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild` (Radix `Slot`). In `child` mode `children` is not rendered and
		 * `ref` stays `null` — the caller owns the element.
		 */
		child?: Snippet<[{ props: FileUploadDropzoneChildProps }]>;
		/** The content of the dropzone. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { getFileUploadContext } from './file-upload.svelte.js';

	let {
		ref = $bindable(null),
		onclick: onclickProp,
		ondragenter: ondragenterProp,
		ondragover: ondragoverProp,
		ondragleave: ondragleaveProp,
		ondrop: ondropProp,
		onpaste: onpasteProp,
		onkeydown: onkeydownProp,
		class: className,
		child,
		children,
		...restProps
	}: FileUploadDropzoneProps = $props();

	const root = getFileUploadContext('Dropzone');

	// Each handler runs the caller's first and `preventDefault()` suppresses ours, reproducing
	// upstream's `composeEventHandlers`.

	function onclick(event: MouseEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		onclickProp?.(event);
		if (event.defaultPrevented) return;

		// A click that started inside the trigger would otherwise open the dialog twice
		// (upstream file-upload.tsx:716-724).
		const target = event.target;
		const fromTrigger =
			target instanceof HTMLElement && target.closest('[data-slot="file-upload-trigger"]');
		if (fromTrigger) return;

		root.openFileDialog();
	}

	function ondragenter(event: DragEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		ondragenterProp?.(event);
		if (event.defaultPrevented) return;

		event.preventDefault();
		root.setDragOver(true);
	}

	function ondragover(event: DragEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		ondragoverProp?.(event);
		if (event.defaultPrevented) return;

		event.preventDefault();
		root.setDragOver(true);
	}

	function ondragleave(event: DragEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		ondragleaveProp?.(event);
		if (event.defaultPrevented) return;

		// Moving onto a descendant is not leaving the dropzone.
		const relatedTarget = event.relatedTarget;
		if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return;

		event.preventDefault();
		root.setDragOver(false);
	}

	function ondrop(event: DragEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		ondropProp?.(event);
		if (event.defaultPrevented) return;

		event.preventDefault();
		root.setDragOver(false);

		// Upstream round-trips the drop through the hidden input with a synthetic `DataTransfer`;
		// `new DataTransfer()` is unimplemented in jsdom and assigning `input.files` is unsupported in
		// older Safari, so the files go straight into the same intake method (research R-05).
		root.addFiles(Array.from(event.dataTransfer?.files ?? []));
	}

	function onpaste(event: ClipboardEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		onpasteProp?.(event);
		if (event.defaultPrevented) return;

		event.preventDefault();
		root.setDragOver(false);

		const items = event.clipboardData?.items;
		if (!items) return;

		const files: File[] = [];
		for (let index = 0; index < items.length; index++) {
			const item = items[index];
			if (item?.kind !== 'file') continue;

			const file = item.getAsFile();
			if (file) files.push(file);
		}

		if (files.length === 0) return;
		root.addFiles(files);
	}

	function onkeydown(event: KeyboardEvent & { currentTarget: EventTarget & HTMLDivElement }) {
		onkeydownProp?.(event);
		if (event.defaultPrevented) return;
		if (event.key !== 'Enter' && event.key !== ' ') return;

		event.preventDefault();
		root.openFileDialog();
	}

	const dropzoneAttrs = $derived({
		role: 'region',
		id: root.dropzoneId,
		'aria-controls': `${root.inputId} ${root.listId}`,
		'aria-disabled': root.disabled,
		'aria-invalid': root.invalidState,
		'data-slot': 'file-upload-dropzone',
		'data-disabled': root.disabled ? '' : undefined,
		'data-dragging': root.dragOver ? '' : undefined,
		'data-invalid': root.invalidState ? '' : undefined,
		dir: root.dir,
		tabindex: root.disabled ? undefined : 0,
		...restProps,
		class: cn(
			'relative flex select-none flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 outline-none transition-colors hover:bg-accent/30 focus-visible:border-ring/50 data-disabled:pointer-events-none data-dragging:border-primary/30 data-dragging:bg-accent/30 data-invalid:border-destructive data-invalid:ring-destructive/20',
			className
		),
		onclick,
		ondragenter,
		ondragleave,
		ondragover,
		ondrop,
		onkeydown,
		onpaste
	} as FileUploadDropzoneChildProps);
</script>

{#if child}
	{@render child({ props: dropzoneAttrs })}
{:else}
	<div bind:this={ref} {...dropzoneAttrs}>
		{@render children?.()}
	</div>
{/if}
