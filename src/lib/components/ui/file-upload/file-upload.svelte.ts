import FileArchiveIcon from '@lucide/svelte/icons/file-archive';
import FileAudioIcon from '@lucide/svelte/icons/file-audio';
import FileCodeIcon from '@lucide/svelte/icons/file-code';
import FileCogIcon from '@lucide/svelte/icons/file-cog';
import FileIcon from '@lucide/svelte/icons/file';
import FileTextIcon from '@lucide/svelte/icons/file-text';
import FileVideoIcon from '@lucide/svelte/icons/file-video';
import type { LucideIcon } from '@lucide/svelte';
import { getContext, hasContext, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

import type { Direction } from '$lib/components/ui/direction-provider/index.js';

/** Upstream `FileState["status"]` (file-upload.tsx:100), in declaration order. */
export const FILE_UPLOAD_STATUSES = ['idle', 'uploading', 'error', 'success'] as const;

export type FileUploadStatus = (typeof FILE_UPLOAD_STATUSES)[number];

/** Upstream `FileState` (file-upload.tsx:96-101). */
export type FileUploadFileState = {
	/** The selected file. Identity of the entry — compared by reference. */
	file: File;
	/** 0–100, clamped. */
	progress: number;
	/** Rejection or upload-failure message; absent while the file is healthy. */
	error?: string;
	status: FileUploadStatus;
};

/** The reporters handed to `onUpload` (upstream file-upload.tsx:191-198). */
export type FileUploadUploadOptions = {
	onProgress: (file: File, progress: number) => void;
	onSuccess: (file: File) => void;
	onError: (file: File, error: Error) => void;
};

/** Upstream `formatBytes` (file-upload.tsx:32-37), byte for byte: `B` has no decimals, `KB` and up have one. */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';

	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const index = Math.floor(Math.log(bytes) / Math.log(1024));

	return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${sizes[index]}`;
}

const TEXT_EXTENSIONS = ['txt', 'md', 'rtf', 'pdf'];
const CODE_EXTENSIONS = [
	'html',
	'css',
	'js',
	'jsx',
	'ts',
	'tsx',
	'json',
	'xml',
	'php',
	'py',
	'rb',
	'java',
	'c',
	'cpp',
	'cs'
];
const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
const BINARY_EXTENSIONS = ['exe', 'msi', 'app', 'apk', 'deb', 'rpm'];

/**
 * Upstream `getFileIcon` (file-upload.tsx:39-92), returning the icon *component* rather than a
 * rendered element so the preview part can instantiate it (research R-14).
 *
 * The branch order is part of the contract: an `application/zip` file must resolve to the archive
 * icon through its extension before the `application/*` catch-all can claim it.
 */
export function getFileIcon(file: File): LucideIcon {
	const type = file.type;
	const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

	if (type.startsWith('video/')) return FileVideoIcon;
	if (type.startsWith('audio/')) return FileAudioIcon;
	if (type.startsWith('text/') || TEXT_EXTENSIONS.includes(extension)) return FileTextIcon;
	if (CODE_EXTENSIONS.includes(extension)) return FileCodeIcon;
	if (ARCHIVE_EXTENSIONS.includes(extension)) return FileArchiveIcon;
	if (BINARY_EXTENSIONS.includes(extension) || type.startsWith('application/')) return FileCogIcon;

	return FileIcon;
}

export type FileUploadRootStateProps = {
	readonly getValue: () => File[];
	readonly setValue: (files: File[]) => void;
	readonly getAccept: () => string | undefined;
	readonly getMaxFiles: () => number | undefined;
	readonly getMaxSize: () => number | undefined;
	readonly getDisabled: () => boolean;
	readonly getInvalid: () => boolean;
	readonly getDir: () => Direction;
	readonly getOnAccept: () => ((files: File[]) => void) | undefined;
	readonly getOnFileAccept: () => ((file: File) => void) | undefined;
	readonly getOnFileReject: () => ((file: File, message: string) => void) | undefined;
	readonly getOnFileValidate: () => ((file: File) => string | null | undefined) | undefined;
	readonly getOnUpload: () =>
		((files: File[], options: FileUploadUploadOptions) => Promise<void> | void) | undefined;
	/** The one `$props.id()` every root-level id is derived from. */
	readonly id: string;
};

/** How long the dropzone stays flagged after a rejection (upstream file-upload.tsx:575-577). */
const INVALID_FLASH_MS = 2000;

function clampProgress(progress: number): number {
	return Math.min(Math.max(0, progress), 100);
}

/**
 * One instance per `<FileUpload>`, published on context.
 *
 * Replaces upstream's `useSyncExternalStore` store and its nine-action reducer (file-upload.tsx:
 * 259-403) with one method per action. `value` is authoritative for **membership and order**;
 * `#statuses` is a status sidecar keyed by `File` reference and is never written from an `$effect`,
 * so a file that appears in `value` from outside is *derived* as `idle` rather than materialised
 * (research R-01, R-04).
 */
export class FileUploadRootState {
	// $derived below is lazy at runtime (evaluated only when the field is read), but svelte-check's
	// static analysis cannot see that and flags the field as used before its constructor assignment.
	#props!: FileUploadRootStateProps;

	/** Per-file status metadata. Membership still comes from `value`. */
	#statuses = new SvelteMap<File, FileUploadFileState>();
	/** Object URLs for image previews (upstream file-upload.tsx:168). */
	#urlCache = new WeakMap<File, string>();
	/**
	 * The files a preview URL was minted for. A `WeakMap` cannot be iterated, and teardown has to
	 * revoke every URL it created; this list holds exactly the same files upstream's `files` map holds
	 * strongly, and entries leave it as soon as their URL is revoked. Deliberately a plain array and
	 * not a rune: `getPreviewUrl` runs in the preview part's render path, so a reactive write here
	 * would invalidate the very render that triggered it.
	 */
	#previewed: File[] = [];
	/** rAF handle for the progress coalescer; `0` when idle. */
	#progressFrame = 0;
	/** rAF handle for the deferred upload kickoff; `0` when idle. */
	#uploadFrame = 0;
	#invalidTimer: ReturnType<typeof setTimeout> | undefined;

	/** Bound to the hidden `<input type="file">`; `.click()` opens the native dialog. */
	inputRef = $state<HTMLInputElement | null>(null);
	/** Whether files are currently being dragged over the dropzone. */
	dragOver = $state(false);
	/** Set by a rejected batch, reset {@link INVALID_FLASH_MS} ms later. */
	#rejected = $state(false);

	readonly files: File[] = $derived(this.#props.getValue());
	readonly entries: FileUploadFileState[] = $derived(
		this.files.map(
			(file) => this.#statuses.get(file) ?? { file, progress: 0, status: 'idle' as const }
		)
	);
	readonly count: number = $derived(this.files.length);
	readonly disabled: boolean = $derived(this.#props.getDisabled());
	readonly dir: Direction = $derived(this.#props.getDir());
	/** The dropzone's `data-invalid`: the `invalid` prop, or a rejection inside the flash window. */
	readonly invalidState: boolean = $derived(this.#props.getInvalid() || this.#rejected);

	readonly inputId: string = $derived(`${this.#props.id}-input`);
	readonly dropzoneId: string = $derived(`${this.#props.id}-dropzone`);
	readonly listId: string = $derived(`${this.#props.id}-list`);
	readonly labelId: string = $derived(`${this.#props.id}-label`);

	/** Upstream's `acceptTypes` memo (file-upload.tsx:405-408). */
	readonly #acceptTypes: string[] | null = $derived(
		this.#props
			.getAccept()
			?.split(',')
			.map((type) => type.trim()) ?? null
	);

	constructor(props: FileUploadRootStateProps) {
		this.#props = props;
	}

	/** The status entry for `file`, or `undefined` when it is not in the current list. */
	getFileState(file: File): FileUploadFileState | undefined {
		const index = this.files.indexOf(file);
		return index === -1 ? undefined : this.entries[index];
	}

	/** 1-based position for `aria-posinset` (upstream file-upload.tsx:1001-1004). */
	getFileIndex(file: File): number {
		return this.files.indexOf(file) + 1;
	}

	/** Lazily minted and cached, exactly as upstream does inside its preview part. */
	getPreviewUrl(file: File): string {
		let url = this.#urlCache.get(file);
		if (!url) {
			url = URL.createObjectURL(file);
			this.#urlCache.set(file, url);
			this.#previewed.push(file);
		}
		return url;
	}

	openFileDialog(): void {
		if (this.disabled) return;
		this.inputRef?.click();
	}

	setDragOver(next: boolean): void {
		this.dragOver = next;
	}

	setInvalid(next: boolean): void {
		this.#rejected = next;
	}

	/**
	 * Upstream `onFilesChange` (file-upload.tsx:489-615). The order of the checks is part of the
	 * contract: `maxFiles` slot arithmetic first, then per file `onFileValidate` → `accept` →
	 * `maxSize`, with the last message set winning between the latter two.
	 */
	addFiles(incoming: File[]): void {
		if (this.disabled) return;

		const maxFiles = this.#props.getMaxFiles();
		const maxSize = this.#props.getMaxSize();
		const onFileValidate = this.#props.getOnFileValidate();
		const onFileReject = this.#props.getOnFileReject();

		let toProcess = [...incoming];
		let invalid = false;

		if (maxFiles) {
			const remainingSlots = Math.max(0, maxFiles - this.count);

			if (remainingSlots < toProcess.length) {
				const overflow = toProcess.slice(remainingSlots);
				invalid = true;
				toProcess = toProcess.slice(0, remainingSlots);

				for (const file of overflow) {
					const validationMessage = onFileValidate?.(file);
					onFileReject?.(file, validationMessage || `Maximum ${maxFiles} files allowed`);
				}
			}
		}

		const accepted: File[] = [];

		for (const file of toProcess) {
			let rejected = false;

			if (onFileValidate) {
				const validationMessage = onFileValidate(file);
				if (validationMessage) {
					onFileReject?.(file, validationMessage);
					invalid = true;
					continue;
				}
			}

			if (this.#acceptTypes && !this.#matchesAccept(file, this.#acceptTypes)) {
				onFileReject?.(file, 'File type not accepted');
				rejected = true;
				invalid = true;
			}

			if (maxSize && file.size > maxSize) {
				onFileReject?.(file, 'File too large');
				rejected = true;
				invalid = true;
			}

			if (!rejected) accepted.push(file);
		}

		if (invalid) this.#flashInvalid();

		if (accepted.length === 0) return;

		for (const file of accepted) {
			this.#statuses.set(file, { file, progress: 0, status: 'idle' });
		}
		this.#props.setValue([...this.files, ...accepted]);

		this.#props.getOnAccept()?.(accepted);

		const onFileAccept = this.#props.getOnFileAccept();
		for (const file of accepted) onFileAccept?.(file);

		if (this.#props.getOnUpload()) {
			// Upstream defers the upload by one frame so the newly added rows paint first.
			this.#uploadFrame = requestAnimationFrame(() => {
				this.#uploadFrame = 0;
				void this.runUpload(accepted);
			});
		} else {
			// FR-005: with no transport supplied the component is a selection-only control, so an
			// accepted file is immediately done rather than sitting at `idle` forever.
			for (const file of accepted) this.setSuccess(file);
		}
	}

	/** MIME equality, `.ext` equality, or a `type/*` prefix (upstream file-upload.tsx:539-551). */
	#matchesAccept(file: File, acceptTypes: string[]): boolean {
		const fileType = file.type;
		const fileExtension = `.${file.name.split('.').pop()}`;

		return acceptTypes.some(
			(type) =>
				type === fileType ||
				type === fileExtension ||
				(type.includes('/*') && fileType.startsWith(type.replace('/*', '/')))
		);
	}

	#flashInvalid(): void {
		this.#rejected = true;
		clearTimeout(this.#invalidTimer);
		this.#invalidTimer = setTimeout(() => {
			this.#invalidTimer = undefined;
			this.#rejected = false;
		}, INVALID_FLASH_MS);
	}

	/**
	 * Upstream `onFilesUpload` (file-upload.tsx:448-487): every file starts at `progress: 0`, and a
	 * throw out of `onUpload` marks the whole batch errored.
	 */
	async runUpload(files: File[]): Promise<void> {
		const onUpload = this.#props.getOnUpload();

		try {
			for (const file of files) this.setProgress(file, 0);

			if (onUpload) {
				await onUpload(files, {
					onProgress: (file, progress) => this.reportProgress(file, progress),
					onSuccess: (file) => this.setSuccess(file),
					onError: (file, error) => this.setError(file, error.message || 'Upload failed')
				});
			} else {
				for (const file of files) this.setSuccess(file);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Upload failed';
			for (const file of files) this.setError(file, message);
		}
	}

	/**
	 * Upstream's rAF guard (file-upload.tsx:410-423): while a frame is pending every further report
	 * is dropped, so a chatty transport costs at most one state write per frame.
	 */
	reportProgress(file: File, progress: number): void {
		if (this.#progressFrame) return;

		this.#progressFrame = requestAnimationFrame(() => {
			this.#progressFrame = 0;
			this.setProgress(file, progress);
		});
	}

	/** Replace membership, pruning the status entries the new list no longer covers. */
	setFiles(files: File[]): void {
		for (const file of [...this.#statuses.keys()]) {
			if (!files.includes(file)) this.#statuses.delete(file);
		}
		this.#props.setValue(files);
	}

	setProgress(file: File, progress: number): void {
		const state = this.getFileState(file);
		if (!state) return;

		this.#statuses.set(file, { ...state, progress: clampProgress(progress), status: 'uploading' });
	}

	setSuccess(file: File): void {
		const state = this.getFileState(file);
		if (!state) return;

		this.#statuses.set(file, { ...state, progress: 100, status: 'success' });
	}

	setError(file: File, error: string): void {
		const state = this.getFileState(file);
		if (!state) return;

		this.#statuses.set(file, { ...state, error, status: 'error' });
	}

	/**
	 * `disabled` is checked here rather than on the delete button: upstream leaves `ItemDelete` a
	 * plain enabled button, and the spec requires a disabled root to suppress removal too, so the
	 * guard lives where every removal path passes through.
	 */
	removeFile(file: File): void {
		if (this.disabled) return;

		this.#revoke(file);
		this.#statuses.delete(file);
		this.#props.setValue(this.files.filter((candidate) => candidate !== file));
	}

	clear(): void {
		if (this.disabled) return;

		for (const file of [...this.#previewed]) this.#revoke(file);
		this.#statuses.clear();
		this.#props.setValue([]);
		this.#rejected = false;
	}

	#revoke(file: File): void {
		const url = this.#urlCache.get(file);
		if (!url) return;

		URL.revokeObjectURL(url);
		this.#urlCache.delete(file);
		this.#previewed = this.#previewed.filter((candidate) => candidate !== file);
	}

	/** The root's `$effect` teardown: nothing this class started may outlive the component (R-10). */
	destroy(): void {
		if (this.#progressFrame) cancelAnimationFrame(this.#progressFrame);
		if (this.#uploadFrame) cancelAnimationFrame(this.#uploadFrame);
		this.#progressFrame = 0;
		this.#uploadFrame = 0;

		clearTimeout(this.#invalidTimer);
		this.#invalidTimer = undefined;

		for (const file of [...this.#previewed]) this.#revoke(file);
	}
}

export type FileUploadItemStateProps = {
	readonly root: FileUploadRootState;
	readonly getValue: () => File;
	/** The item's own `$props.id()`. */
	readonly id: string;
};

/**
 * One instance per `<FileUpload.Item>`, published on context for its preview, metadata, progress
 * and delete parts. Upstream's `FileUploadItemContextValue` (file-upload.tsx:964-971) carried the
 * same fields as snapshots; deriving them here means all five parts read one source of truth.
 */
export class FileUploadItemState {
	#props!: FileUploadItemStateProps;

	readonly file: File = $derived(this.#props.getValue());
	readonly fileState: FileUploadFileState | undefined = $derived(
		this.#props.root.getFileState(this.file)
	);
	readonly index: number = $derived(this.#props.root.getFileIndex(this.file));

	readonly id: string = $derived(this.#props.id);
	readonly nameId: string = $derived(`${this.#props.id}-name`);
	readonly sizeId: string = $derived(`${this.#props.id}-size`);
	readonly statusId: string = $derived(`${this.#props.id}-status`);
	readonly messageId: string = $derived(`${this.#props.id}-message`);

	/** Upstream file-upload.tsx:1020-1026. */
	readonly statusText: string = $derived.by(() => {
		const state = this.fileState;
		if (!state) return '';
		if (state.error) return `Error: ${state.error}`;
		if (state.status === 'uploading') return `Uploading: ${state.progress}% complete`;
		if (state.status === 'success') return 'Upload complete';
		return 'Ready to upload';
	});

	/**
	 * Upstream's template literal (file-upload.tsx:1037-1039) leaves a trailing space when the file
	 * has no error; joining the present tokens produces the same IDREF list without it (R-12).
	 */
	readonly describedBy: string = $derived(
		[this.nameId, this.sizeId, this.statusId, this.fileState?.error ? this.messageId : undefined]
			.filter(Boolean)
			.join(' ')
	);

	get root(): FileUploadRootState {
		return this.#props.root;
	}

	constructor(props: FileUploadItemStateProps) {
		this.#props = props;
	}

	remove(): void {
		this.#props.root.removeFile(this.file);
	}
}

const FILE_UPLOAD_CONTEXT_KEY = Symbol('file-upload');

export function setFileUploadContext(state: FileUploadRootState): FileUploadRootState {
	return setContext(FILE_UPLOAD_CONTEXT_KEY, state);
}

/**
 * Read the root's state, throwing when there is no `<FileUpload>` ancestor (FR-016).
 *
 * @param consumerName the part's short name, e.g. `"Dropzone"`.
 */
export function getFileUploadContext(consumerName: string): FileUploadRootState {
	if (!hasContext(FILE_UPLOAD_CONTEXT_KEY)) {
		throw new Error(`\`<FileUpload.${consumerName}>\` must be used within \`<FileUpload>\`.`);
	}
	return getContext<FileUploadRootState>(FILE_UPLOAD_CONTEXT_KEY);
}

const FILE_UPLOAD_ITEM_CONTEXT_KEY = Symbol('file-upload-item');

export function setFileUploadItemContext(state: FileUploadItemState): FileUploadItemState {
	return setContext(FILE_UPLOAD_ITEM_CONTEXT_KEY, state);
}

/** Read the item's state, throwing when there is no `<FileUpload.Item>` ancestor (FR-016). */
export function getFileUploadItemContext(consumerName: string): FileUploadItemState {
	if (!hasContext(FILE_UPLOAD_ITEM_CONTEXT_KEY)) {
		throw new Error(`\`<FileUpload.${consumerName}>\` must be used within \`<FileUpload.Item>\`.`);
	}
	return getContext<FileUploadItemState>(FILE_UPLOAD_ITEM_CONTEXT_KEY);
}

/**
 * Upstream's `useStore as useFileUpload` (file-upload.tsx:1413). No selector argument is needed —
 * every member of {@link FileUploadRootState} is already a fine-grained rune.
 */
export function useFileUpload(): FileUploadRootState {
	return getFileUploadContext('useFileUpload');
}
