import FileArchiveIcon from '@lucide/svelte/icons/file-archive';
import FileAudioIcon from '@lucide/svelte/icons/file-audio';
import FileCodeIcon from '@lucide/svelte/icons/file-code';
import FileCogIcon from '@lucide/svelte/icons/file-cog';
import FileIcon from '@lucide/svelte/icons/file';
import FileTextIcon from '@lucide/svelte/icons/file-text';
import FileVideoIcon from '@lucide/svelte/icons/file-video';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Harness, { type FileUploadHarnessProps } from './file-upload.test.svelte';
import {
	FILE_UPLOAD_STATUSES,
	formatBytes,
	getFileIcon,
	type FileUploadRootState,
	type FileUploadUploadOptions
} from './index.js';

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

/**
 * `size` is derived from the blob parts in jsdom, so an oversized fixture redefines it rather than
 * allocating megabytes of content.
 */
function makeFile(name: string, options: { type?: string; size?: number } = {}): File {
	const { type = 'text/plain', size } = options;
	const file = new File(['file-content'], name, { type });
	if (size !== undefined) {
		Object.defineProperty(file, 'size', { value: size, configurable: true });
	}
	return file;
}

function renderFileUpload(props: FileUploadHarnessProps = {}) {
	return render(Harness, { props });
}

/** `applyAccept: false` — the `accept` attribute is the component's business, not the harness's. */
function setupUser() {
	return userEvent.setup({ applyAccept: false });
}

function bySlot(slot: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	if (!element) throw new Error(`no element with data-slot="${slot}" was rendered`);
	return element;
}

function queryBySlot(slot: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
}

function allBySlot(slot: string): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`));
}

function fileInput(): HTMLInputElement {
	const input = document.querySelector<HTMLInputElement>('input[type="file"]');
	if (!input) throw new Error('the hidden file input was not rendered');
	return input;
}

/** The file names, in document order, the component is currently rendering. */
function renderedNames(): string[] {
	return allBySlot('file-upload-metadata').map(
		(metadata) => metadata.querySelector('[id$="-name"]')?.textContent ?? ''
	);
}

/** The native dialog path: pick files through the hidden `<input type="file">`. */
async function selectFiles(user: ReturnType<typeof setupUser>, files: File[]): Promise<void> {
	await user.upload(fileInput(), files);
}

/** The same path without `user-event`, for the specs that install fake timers. */
async function changeInputFiles(files: File[]): Promise<void> {
	await fireEvent.change(fileInput(), { target: { files } });
}

async function dropFiles(target: HTMLElement, files: File[]): Promise<void> {
	await fireEvent.drop(target, { dataTransfer: { files, types: ['Files'] } });
}

/**
 * `fireEvent.dragLeave` cannot carry `relatedTarget` — jsdom implements no `DragEvent`, so the
 * fallback path drops a read-only `MouseEvent` accessor — and the containment check is exactly what
 * this needs to observe.
 */
async function dragLeaveTo(target: HTMLElement, relatedTarget: EventTarget | null): Promise<void> {
	const event = new MouseEvent('dragleave', { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'relatedTarget', { value: relatedTarget });
	await fireEvent(target, event);
}

async function pasteFiles(target: HTMLElement, files: File[]): Promise<void> {
	await fireEvent.paste(target, {
		clipboardData: {
			items: files.map((file) => ({ kind: 'file', getAsFile: () => file }))
		}
	});
}

/**
 * Progress writes are coalesced onto an animation frame and the upload itself is scheduled on one,
 * so an assertion has to wait for real frames rather than a microtask flush.
 */
async function flushFrames(count = 2): Promise<void> {
	for (let index = 0; index < count; index++) {
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => resolve());
		});
	}
	await tick();
}

let createdUrls: string[] = [];

beforeEach(() => {
	createdUrls = [];
	// jsdom implements neither object-URL method.
	URL.createObjectURL = vi.fn((): string => {
		const url = `blob:file-upload-${createdUrls.length}`;
		createdUrls.push(url);
		return url;
	});
	URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
	vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Pure helpers (T011 — formatBytes boundaries and every getFileIcon branch)
// ---------------------------------------------------------------------------

describe('file-upload pure helpers', () => {
	it('formats byte counts with upstream rounding', () => {
		expect(formatBytes(0)).toBe('0 B');
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(1024)).toBe('1.0 KB');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(2.5 * 1024 ** 2)).toBe('2.5 MB');
		expect(formatBytes(1024 ** 3)).toBe('1.0 GB');
		expect(formatBytes(1024 ** 4)).toBe('1.0 TB');
	});

	it('maps every documented file family onto its own icon', () => {
		expect(getFileIcon(makeFile('clip.mp4', { type: 'video/mp4' }))).toBe(FileVideoIcon);
		expect(getFileIcon(makeFile('song.mp3', { type: 'audio/mpeg' }))).toBe(FileAudioIcon);
		expect(getFileIcon(makeFile('notes.txt', { type: 'text/plain' }))).toBe(FileTextIcon);
		expect(getFileIcon(makeFile('paper.pdf', { type: '' }))).toBe(FileTextIcon);
		expect(getFileIcon(makeFile('main.ts', { type: '' }))).toBe(FileCodeIcon);
		expect(getFileIcon(makeFile('site.html', { type: '' }))).toBe(FileCodeIcon);
		expect(getFileIcon(makeFile('unknown.xyz', { type: '' }))).toBe(FileIcon);
	});

	it('resolves an archive by extension before the application/* catch-all', () => {
		// `application/zip` would hit the binary branch if the extension list ran second.
		expect(getFileIcon(makeFile('bundle.zip', { type: 'application/zip' }))).toBe(FileArchiveIcon);
		expect(getFileIcon(makeFile('setup.exe', { type: '' }))).toBe(FileCogIcon);
		expect(getFileIcon(makeFile('data.bin', { type: 'application/octet-stream' }))).toBe(
			FileCogIcon
		);
	});

	it('publishes the documented status values', () => {
		expect(FILE_UPLOAD_STATUSES).toEqual(['idle', 'uploading', 'error', 'success']);
	});
});

// ---------------------------------------------------------------------------
// T005 — roles and ARIA
// ---------------------------------------------------------------------------

describe('file-upload roles and ARIA', () => {
	it('exposes the documented roles and the root id wiring', () => {
		renderFileUpload({ defaultValue: [makeFile('notes.txt')] });

		const dropzone = screen.getByRole('region');
		const list = screen.getByRole('list');
		const item = screen.getByRole('listitem');
		const input = fileInput();

		expect(dropzone).toHaveAttribute('aria-controls', `${input.id} ${list.id}`);
		expect(screen.getByTestId('trigger')).toHaveAttribute('aria-controls', input.id);
		expect(screen.getByTestId('clear')).toHaveAttribute('aria-controls', list.id);
		expect(item).toBeInTheDocument();
		expect(input).toHaveAttribute('aria-labelledby');
		expect(input).toHaveAttribute('aria-describedby', dropzone.id);
	});

	it('renders the screen-reader-only root label', () => {
		renderFileUpload({ label: 'Attachments' });

		const input = fileInput();
		const labelId = input.getAttribute('aria-labelledby');
		expect(labelId).toBeTruthy();
		expect(document.getElementById(labelId as string)).toHaveTextContent('Attachments');
	});

	it('defaults the root label to "File upload"', () => {
		renderFileUpload();

		const labelId = fileInput().getAttribute('aria-labelledby');
		expect(document.getElementById(labelId as string)).toHaveTextContent('File upload');
	});

	it('positions each item in the set and names it from the file name', () => {
		renderFileUpload({ defaultValue: [makeFile('a.txt'), makeFile('b.txt')] });

		const items = screen.getAllByRole('listitem');
		expect(items).toHaveLength(2);

		items.forEach((item, index) => {
			expect(item).toHaveAttribute('aria-setsize', '2');
			expect(item).toHaveAttribute('aria-posinset', String(index + 1));
			expect(item).toHaveAttribute('aria-labelledby', `${item.id}-name`);
			expect(item).toHaveAttribute(
				'aria-describedby',
				`${item.id}-name ${item.id}-size ${item.id}-status`
			);
		});
	});

	it('describes each item with screen-reader-only status text', () => {
		renderFileUpload({ defaultValue: [makeFile('notes.txt')] });

		const item = screen.getByRole('listitem');
		expect(document.getElementById(`${item.id}-status`)).toHaveTextContent('Ready to upload');
		expect(item).toHaveAttribute('data-status', 'idle');
	});

	it('wires the progress bar to the item name with a value and a value text', () => {
		renderFileUpload({ defaultValue: [makeFile('notes.txt')], withProgress: true });

		const item = screen.getByRole('listitem');
		const progress = screen.getByRole('progressbar');

		expect(progress).toHaveAttribute('aria-valuemin', '0');
		expect(progress).toHaveAttribute('aria-valuemax', '100');
		expect(progress).toHaveAttribute('aria-valuenow', '0');
		expect(progress).toHaveAttribute('aria-valuetext', '0%');
		expect(progress).toHaveAttribute('aria-labelledby', `${item.id}-name`);
	});

	it('labels the preview and the delete button from the item name', () => {
		renderFileUpload({ defaultValue: [makeFile('notes.txt')] });

		const item = screen.getByRole('listitem');
		expect(bySlot('file-upload-preview')).toHaveAttribute('aria-labelledby', `${item.id}-name`);

		const remove = screen.getByLabelText('Remove notes.txt');
		expect(remove).toHaveAttribute('aria-controls', item.id);
		expect(remove).toHaveAttribute('aria-describedby', `${item.id}-name`);
	});

	it('reports the dropzone disabled and invalid states to assistive technology', () => {
		renderFileUpload({ disabled: true, invalid: true });

		const dropzone = screen.getByRole('region');
		expect(dropzone).toHaveAttribute('aria-disabled', 'true');
		expect(dropzone).toHaveAttribute('aria-invalid', 'true');
		expect(dropzone).toHaveAttribute('data-disabled', '');
		expect(dropzone).toHaveAttribute('data-invalid', '');
		expect(dropzone).not.toHaveAttribute('tabindex');
	});

	it('orients the list and marks it active only while it holds files', () => {
		const { rerender } = renderFileUpload({ listForceMount: true, listOrientation: 'horizontal' });

		const list = screen.getByRole('list');
		expect(list).toHaveAttribute('aria-orientation', 'horizontal');
		expect(list).toHaveAttribute('data-orientation', 'horizontal');
		expect(list).toHaveAttribute('data-state', 'inactive');

		return rerender({
			listForceMount: true,
			value: [makeFile('notes.txt')],
			binding: 'value'
		}).then(() => {
			expect(screen.getByRole('list')).toHaveAttribute('data-state', 'active');
		});
	});
});

// ---------------------------------------------------------------------------
// T006 — keyboard
// ---------------------------------------------------------------------------

describe('file-upload keyboard', () => {
	it('moves focus dropzone → trigger → delete → clear → outside', async () => {
		const user = setupUser();
		renderFileUpload({ defaultValue: [makeFile('notes.txt')] });

		await user.tab();
		expect(screen.getByRole('region')).toHaveFocus();

		await user.tab();
		expect(screen.getByTestId('trigger')).toHaveFocus();

		await user.tab();
		expect(screen.getByLabelText('Remove notes.txt')).toHaveFocus();

		await user.tab();
		expect(screen.getByTestId('clear')).toHaveFocus();

		await user.tab();
		expect(screen.getByTestId('outside')).toHaveFocus();
	});

	it('opens the file dialog on Enter and on Space while the dropzone is focused', async () => {
		const user = setupUser();
		const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
		renderFileUpload();

		await user.tab();
		expect(screen.getByRole('region')).toHaveFocus();

		await user.keyboard('{Enter}');
		expect(click).toHaveBeenCalledTimes(1);

		await user.keyboard(' ');
		expect(click).toHaveBeenCalledTimes(2);
	});

	it('opens the file dialog once when the click lands on the nested trigger', async () => {
		const user = setupUser();
		const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
		renderFileUpload();

		await user.click(screen.getByTestId('trigger'));

		expect(click).toHaveBeenCalledTimes(1);
	});

	it('opens the file dialog when the click lands on the dropzone itself', async () => {
		const user = setupUser();
		const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
		renderFileUpload();

		await user.click(screen.getByRole('region'));

		expect(click).toHaveBeenCalledTimes(1);
	});

	it('activates the trigger, the delete button and the clear button from the keyboard', async () => {
		const user = setupUser();
		const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
		renderFileUpload({ defaultValue: [makeFile('a.txt'), makeFile('b.txt')] });

		screen.getByTestId('trigger').focus();
		await user.keyboard('{Enter}');
		expect(click).toHaveBeenCalledTimes(1);

		screen.getByLabelText('Remove a.txt').focus();
		await user.keyboard(' ');
		expect(renderedNames()).toEqual(['b.txt']);

		screen.getByTestId('clear').focus();
		await user.keyboard('{Enter}');
		expect(renderedNames()).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// T007 — uncontrolled
// ---------------------------------------------------------------------------

describe('file-upload uncontrolled', () => {
	it('seeds the rendered list from defaultValue', () => {
		renderFileUpload({ defaultValue: [makeFile('a.txt'), makeFile('b.txt')] });

		expect(renderedNames()).toEqual(['a.txt', 'b.txt']);
	});

	it('adds selected files and removes deleted ones with no value prop present', async () => {
		const user = setupUser();
		renderFileUpload({ defaultValue: [makeFile('a.txt')] });

		await selectFiles(user, [makeFile('b.txt')]);
		expect(renderedNames()).toEqual(['a.txt', 'b.txt']);

		await user.click(screen.getByLabelText('Remove a.txt'));
		expect(renderedNames()).toEqual(['b.txt']);
	});

	it('hides the list and the clear button once the last file is cleared', async () => {
		const user = setupUser();
		renderFileUpload({ defaultValue: [makeFile('a.txt')] });

		expect(screen.getByRole('list')).toBeInTheDocument();

		await user.click(screen.getByTestId('clear'));

		expect(screen.queryByRole('list')).not.toBeInTheDocument();
		expect(screen.queryByTestId('clear')).not.toBeInTheDocument();
	});

	it('keeps the list and the clear button mounted under forceMount', () => {
		renderFileUpload({ listForceMount: true, clearForceMount: true });

		expect(screen.getByRole('list')).toBeInTheDocument();
		expect(screen.getByTestId('clear')).toBeInTheDocument();
	});

	it('accepts dropped and pasted files through the same pipeline', async () => {
		renderFileUpload();
		const dropzone = screen.getByRole('region');

		await dropFiles(dropzone, [makeFile('dropped.txt')]);
		expect(renderedNames()).toEqual(['dropped.txt']);

		await pasteFiles(dropzone, [makeFile('pasted.txt')]);
		expect(renderedNames()).toEqual(['dropped.txt', 'pasted.txt']);
	});

	it('flags the dropzone while files are dragged over it', async () => {
		renderFileUpload();
		const dropzone = screen.getByRole('region');

		await fireEvent.dragEnter(dropzone);
		expect(dropzone).toHaveAttribute('data-dragging', '');

		await dragLeaveTo(dropzone, document.body);
		expect(dropzone).not.toHaveAttribute('data-dragging');
	});

	it('keeps the drag state while the pointer moves onto a descendant', async () => {
		renderFileUpload();
		const dropzone = screen.getByRole('region');

		await fireEvent.dragOver(dropzone);
		expect(dropzone).toHaveAttribute('data-dragging', '');

		await dragLeaveTo(dropzone, screen.getByTestId('trigger'));
		expect(dropzone).toHaveAttribute('data-dragging', '');
	});

	it('clears the native input value so the same file can be re-selected', async () => {
		const user = setupUser();
		renderFileUpload();

		await selectFiles(user, [makeFile('a.txt')]);

		expect(fileInput().value).toBe('');
	});
});

// ---------------------------------------------------------------------------
// T008 — controlled
// ---------------------------------------------------------------------------

describe('file-upload controlled', () => {
	it('reports the next array through onValueChange on every mutation', async () => {
		const user = setupUser();
		const onValueChange = vi.fn();
		const existing = makeFile('a.txt');
		const added = makeFile('b.txt');
		renderFileUpload({ binding: 'value', value: [existing], onValueChange });

		await selectFiles(user, [added]);
		expect(onValueChange).toHaveBeenLastCalledWith([existing, added]);

		await user.click(screen.getByLabelText('Remove a.txt'));
		expect(onValueChange).toHaveBeenLastCalledWith([added]);

		await user.click(screen.getByTestId('clear'));
		expect(onValueChange).toHaveBeenLastCalledWith([]);
	});

	it('leaves the rendered list untouched when the parent declines the write', async () => {
		const user = setupUser();
		const onDeclinedValue = vi.fn();
		const authoritative = [makeFile('a.txt')];
		renderFileUpload({ binding: 'function', authoritative, onDeclinedValue });

		await selectFiles(user, [makeFile('b.txt')]);

		expect(onDeclinedValue).toHaveBeenCalledTimes(1);
		expect(renderedNames()).toEqual(['a.txt']);
	});

	it('renders a file the parent added from outside as idle', async () => {
		const { rerender } = renderFileUpload({ binding: 'value', value: [] });

		await rerender({ binding: 'value', value: [makeFile('outside.txt')] });

		expect(renderedNames()).toEqual(['outside.txt']);
		expect(screen.getByRole('listitem')).toHaveAttribute('data-status', 'idle');
	});
});

// ---------------------------------------------------------------------------
// T009 — RTL
// ---------------------------------------------------------------------------

describe('file-upload RTL', () => {
	it('propagates an explicit dir to the dropzone, the list and each item', () => {
		renderFileUpload({ dir: 'rtl', defaultValue: [makeFile('a.txt')] });

		expect(screen.getByRole('region')).toHaveAttribute('dir', 'rtl');
		expect(screen.getByRole('list')).toHaveAttribute('dir', 'rtl');
		expect(screen.getByRole('listitem')).toHaveAttribute('dir', 'rtl');
		expect(bySlot('file-upload')).toHaveAttribute('dir', 'rtl');
	});

	it('inherits the direction from an ancestor DirectionProvider', () => {
		renderFileUpload({ providerDir: 'rtl', defaultValue: [makeFile('a.txt')] });

		expect(screen.getByRole('region')).toHaveAttribute('dir', 'rtl');
		expect(screen.getByRole('listitem')).toHaveAttribute('dir', 'rtl');
	});

	it('lets an explicit dir win over the provider', () => {
		renderFileUpload({ providerDir: 'rtl', dir: 'ltr' });

		expect(screen.getByRole('region')).toHaveAttribute('dir', 'ltr');
	});

	it('keeps every key binding direction-agnostic', async () => {
		const user = setupUser();
		const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
		renderFileUpload({ dir: 'rtl' });

		// No arrow-key navigation exists in this component, so `rtl` mirrors layout only: Enter and
		// Space still open the dialog and nothing inverts.
		screen.getByRole('region').focus();
		await user.keyboard('{Enter}');
		await user.keyboard('{ArrowLeft}{ArrowRight}');

		expect(click).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// T010 — guard rails
// ---------------------------------------------------------------------------

describe('file-upload guard rails', () => {
	it('suppresses the dialog, drops, pastes and keyboard activation while disabled', async () => {
		const user = setupUser();
		const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
		renderFileUpload({ disabled: true, defaultValue: [makeFile('a.txt')] });

		const dropzone = screen.getByRole('region');

		await user.click(dropzone);
		await fireEvent.keyDown(dropzone, { key: 'Enter' });
		await dropFiles(dropzone, [makeFile('dropped.txt')]);
		await pasteFiles(dropzone, [makeFile('pasted.txt')]);

		expect(click).not.toHaveBeenCalled();
		expect(renderedNames()).toEqual(['a.txt']);
	});

	it('disables the trigger and the clear button while the root is disabled', () => {
		renderFileUpload({ disabled: true, defaultValue: [makeFile('a.txt')] });

		expect(screen.getByTestId('trigger')).toBeDisabled();
		expect(screen.getByTestId('trigger')).toHaveAttribute('data-disabled', '');
		expect(screen.getByTestId('clear')).toBeDisabled();
		expect(screen.getByTestId('clear')).toHaveAttribute('data-disabled', '');
	});

	it('keeps deleting a file a no-op while disabled', async () => {
		const user = setupUser();
		renderFileUpload({ disabled: true, defaultValue: [makeFile('a.txt')] });

		await user.click(screen.getByLabelText('Remove a.txt'));

		expect(renderedNames()).toEqual(['a.txt']);
	});

	it('honours the clear button’s own disabled prop', () => {
		renderFileUpload({ clearDisabled: true, defaultValue: [makeFile('a.txt')] });

		expect(screen.getByTestId('clear')).toBeDisabled();
		expect(screen.getByTestId('clear')).toHaveAttribute('data-disabled', '');
	});

	it.each([
		['bare-dropzone', 'Dropzone'],
		['bare-trigger', 'Trigger'],
		['bare-list', 'List'],
		['bare-item', 'Item'],
		['bare-clear', 'Clear']
	] as const)('throws when %s is rendered outside the root', (mode, part) => {
		expect(() => renderFileUpload({ mode })).toThrow(
			new RegExp(`<FileUpload\\.${part}>\`? must be used within`)
		);
	});

	it.each([
		['preview-without-item', 'ItemPreview'],
		['metadata-without-item', 'ItemMetadata'],
		['progress-without-item', 'ItemProgress'],
		['delete-without-item', 'ItemDelete']
	] as const)('throws when %s is rendered outside an item', (mode, part) => {
		expect(() => renderFileUpload({ mode })).toThrow(
			new RegExp(`<FileUpload\\.${part}>\`? must be used within \`?<FileUpload\\.Item>`)
		);
	});
});

// ---------------------------------------------------------------------------
// T011 — previews and metadata
// ---------------------------------------------------------------------------

describe('file-upload previews and metadata', () => {
	it('renders an object-URL thumbnail for an image file', () => {
		renderFileUpload({ defaultValue: [makeFile('photo.png', { type: 'image/png' })] });

		const image = screen.getByRole('img');
		expect(image).toHaveAttribute('src', 'blob:file-upload-0');
		expect(image).toHaveAttribute('alt', 'photo.png');
		expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
	});

	it('renders a file-type icon instead of a thumbnail for a non-image file', () => {
		renderFileUpload({ defaultValue: [makeFile('notes.txt')] });

		expect(screen.queryByRole('img')).not.toBeInTheDocument();
		expect(bySlot('file-upload-preview').querySelector('svg')).toBeInTheDocument();
	});

	it('revokes the preview URL when its file is deleted', async () => {
		const user = setupUser();
		renderFileUpload({ defaultValue: [makeFile('photo.png', { type: 'image/png' })] });

		await user.click(screen.getByLabelText('Remove photo.png'));

		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:file-upload-0');
	});

	it('revokes every preview URL when the list is cleared', async () => {
		const user = setupUser();
		renderFileUpload({
			defaultValue: [
				makeFile('a.png', { type: 'image/png' }),
				makeFile('b.png', { type: 'image/png' })
			]
		});

		await user.click(screen.getByTestId('clear'));

		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:file-upload-0');
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:file-upload-1');
	});

	it('revokes every preview URL on unmount', () => {
		const { unmount } = renderFileUpload({
			defaultValue: [makeFile('photo.png', { type: 'image/png' })]
		});

		expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
		unmount();

		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:file-upload-0');
	});

	it('renders the file name and its formatted size', () => {
		renderFileUpload({ defaultValue: [makeFile('notes.txt', { size: 1536 })] });

		const item = screen.getByRole('listitem');
		expect(document.getElementById(`${item.id}-name`)).toHaveTextContent('notes.txt');
		expect(document.getElementById(`${item.id}-size`)).toHaveTextContent('1.5 KB');
		expect(document.getElementById(`${item.id}-message`)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// T012 — snippets
// ---------------------------------------------------------------------------

describe('file-upload snippets', () => {
	it('renders every part through its child snippet', () => {
		renderFileUpload({
			asChild: true,
			defaultValue: [makeFile('notes.txt')],
			withProgress: true
		});

		for (const testId of [
			'root-child',
			'dropzone-child',
			'trigger-child',
			'list-child',
			'item-child',
			'preview-child',
			'metadata-child',
			'progress-child',
			'delete-child',
			'clear-child'
		]) {
			expect(screen.getByTestId(testId)).toBeInTheDocument();
		}
	});

	it('hands each child snippet the merged data-slot props', () => {
		renderFileUpload({ asChild: true, defaultValue: [makeFile('notes.txt')] });

		expect(screen.getByTestId('dropzone-child')).toHaveAttribute(
			'data-slot',
			'file-upload-dropzone'
		);
		expect(screen.getByTestId('trigger-child')).toHaveAttribute('data-slot', 'file-upload-trigger');
		expect(screen.getByTestId('item-child')).toHaveAttribute('role', 'listitem');
	});

	it('lets the ItemPreview render snippet decorate the default preview', () => {
		renderFileUpload({
			previewRender: true,
			defaultValue: [makeFile('photo.png', { type: 'image/png' })]
		});

		expect(screen.getByTestId('render-photo.png')).toBeInTheDocument();
		// `fallback` was invoked, so the default thumbnail is still there.
		expect(screen.getByRole('img')).toHaveAttribute('alt', 'photo.png');
	});

	it('lets ItemMetadata children replace the default name/size trio', () => {
		renderFileUpload({ metadataChildren: true, defaultValue: [makeFile('notes.txt')] });

		const item = screen.getByRole('listitem');
		expect(screen.getByTestId('metadata-custom')).toBeInTheDocument();
		expect(document.getElementById(`${item.id}-name`)).toBeNull();
		expect(document.getElementById(`${item.id}-size`)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// T013 — validation
// ---------------------------------------------------------------------------

describe('file-upload validation', () => {
	it('rejects the overflow past maxFiles with the maximum-files message', async () => {
		const user = setupUser();
		const onFileReject = vi.fn();
		const overflow = makeFile('c.txt');
		renderFileUpload({ maxFiles: 2, defaultValue: [makeFile('a.txt')], onFileReject });

		await selectFiles(user, [makeFile('b.txt'), overflow]);

		expect(renderedNames()).toEqual(['a.txt', 'b.txt']);
		expect(onFileReject).toHaveBeenCalledWith(overflow, 'Maximum 2 files allowed');
		expect(screen.getByRole('region')).toHaveAttribute('data-invalid', '');
	});

	it('rejects a file whose type does not match accept', async () => {
		const user = setupUser();
		const onFileReject = vi.fn();
		const rejected = makeFile('notes.txt', { type: 'text/plain' });
		renderFileUpload({ accept: 'image/*', onFileReject });

		await selectFiles(user, [rejected]);

		expect(renderedNames()).toEqual([]);
		expect(onFileReject).toHaveBeenCalledWith(rejected, 'File type not accepted');
	});

	it('accepts a file matched by a wildcard, an exact type or an extension', async () => {
		const user = setupUser();
		renderFileUpload({ accept: 'image/*,application/pdf,.csv' });

		await selectFiles(user, [
			makeFile('photo.png', { type: 'image/png' }),
			makeFile('paper.pdf', { type: 'application/pdf' }),
			makeFile('rows.csv', { type: '' })
		]);

		expect(renderedNames()).toEqual(['photo.png', 'paper.pdf', 'rows.csv']);
	});

	it('rejects a file larger than maxSize', async () => {
		const user = setupUser();
		const onFileReject = vi.fn();
		const large = makeFile('huge.txt', { size: 2048 });
		renderFileUpload({ maxSize: 1024, onFileReject });

		await selectFiles(user, [large]);

		expect(renderedNames()).toEqual([]);
		expect(onFileReject).toHaveBeenCalledWith(large, 'File too large');
	});

	it('lets onFileValidate override the built-in wording', async () => {
		const user = setupUser();
		const onFileReject = vi.fn();
		const rejected = makeFile('notes.txt');
		renderFileUpload({
			accept: 'image/*',
			onFileValidate: () => 'Only screenshots, please',
			onFileReject
		});

		await selectFiles(user, [rejected]);

		expect(onFileReject).toHaveBeenCalledTimes(1);
		expect(onFileReject).toHaveBeenCalledWith(rejected, 'Only screenshots, please');
	});

	it('accepts the valid half of a mixed batch and rejects the rest individually', async () => {
		const user = setupUser();
		const onFileReject = vi.fn();
		const onAccept = vi.fn();
		const onFileAccept = vi.fn();
		const good = makeFile('photo.png', { type: 'image/png' });
		const bad = makeFile('notes.txt');
		renderFileUpload({ accept: 'image/*', onFileReject, onAccept, onFileAccept });

		await selectFiles(user, [good, bad]);

		expect(renderedNames()).toEqual(['photo.png']);
		expect(onAccept).toHaveBeenCalledWith([good]);
		expect(onFileAccept).toHaveBeenCalledWith(good);
		expect(onFileReject).toHaveBeenCalledWith(bad, 'File type not accepted');
	});

	it('clears the native input value even when every file in the batch is rejected', async () => {
		const user = setupUser();
		renderFileUpload({ accept: 'image/*' });

		await selectFiles(user, [makeFile('notes.txt')]);

		expect(fileInput().value).toBe('');
	});

	it('resets the invalid flash 2000 ms after the rejection', async () => {
		vi.useFakeTimers();
		renderFileUpload({ maxSize: 1 });

		await changeInputFiles([makeFile('huge.txt', { size: 2048 })]);
		expect(screen.getByRole('region')).toHaveAttribute('data-invalid', '');

		vi.advanceTimersByTime(2000);
		await tick();

		expect(screen.getByRole('region')).not.toHaveAttribute('data-invalid');
	});
});

// ---------------------------------------------------------------------------
// T014 — upload
// ---------------------------------------------------------------------------

describe('file-upload upload', () => {
	it('marks accepted files successful immediately when no onUpload is supplied', async () => {
		const user = setupUser();
		renderFileUpload({ withProgress: true });

		await selectFiles(user, [makeFile('notes.txt')]);

		expect(screen.getByRole('listitem')).toHaveAttribute('data-status', 'success');
		expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
	});

	it('hands onUpload the accepted files and the three reporters', async () => {
		const user = setupUser();
		const onUpload = vi.fn();
		const file = makeFile('notes.txt');
		renderFileUpload({ onUpload });

		await selectFiles(user, [file]);
		await flushFrames();

		expect(onUpload).toHaveBeenCalledTimes(1);
		expect(onUpload.mock.calls[0]?.[0]).toEqual([file]);
		const options = onUpload.mock.calls[0]?.[1] as FileUploadUploadOptions;
		expect(Object.keys(options).sort()).toEqual(['onError', 'onProgress', 'onSuccess']);
	});

	it.each(['linear', 'circular', 'fill'] as const)(
		'reflects reported progress in the %s variant',
		async (progressVariant) => {
			const user = setupUser();
			let options: FileUploadUploadOptions | undefined;
			const onUpload = vi.fn((_files: File[], reporters: FileUploadUploadOptions) => {
				options = reporters;
			});
			const file = makeFile('notes.txt');
			renderFileUpload({ onUpload, withProgress: true, progressVariant });

			await selectFiles(user, [file]);
			await flushFrames();

			expect(screen.getByRole('listitem')).toHaveAttribute('data-status', 'uploading');

			options?.onProgress(file, 42);
			await flushFrames();

			const progress = screen.getByRole('progressbar');
			expect(progress).toHaveAttribute('aria-valuenow', '42');
			expect(progress).toHaveAttribute('aria-valuetext', '42%');
		}
	);

	it('drives progress to 100 on success and unmounts the bar', async () => {
		const user = setupUser();
		let options: FileUploadUploadOptions | undefined;
		const onUpload = vi.fn((_files: File[], reporters: FileUploadUploadOptions) => {
			options = reporters;
		});
		const file = makeFile('notes.txt');
		renderFileUpload({ onUpload, withProgress: true });

		await selectFiles(user, [file]);
		await flushFrames();

		options?.onSuccess(file);
		await tick();

		expect(screen.getByRole('listitem')).toHaveAttribute('data-status', 'success');
		expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
	});

	it('keeps a completed progress bar mounted under forceMount', async () => {
		const user = setupUser();
		let options: FileUploadUploadOptions | undefined;
		const onUpload = vi.fn((_files: File[], reporters: FileUploadUploadOptions) => {
			options = reporters;
		});
		const file = makeFile('notes.txt');
		renderFileUpload({ onUpload, withProgress: true, progressForceMount: true });

		await selectFiles(user, [file]);
		await flushFrames();

		options?.onSuccess(file);
		await tick();

		expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
	});

	it('surfaces a reported error as a status and a message', async () => {
		const user = setupUser();
		let options: FileUploadUploadOptions | undefined;
		const onUpload = vi.fn((_files: File[], reporters: FileUploadUploadOptions) => {
			options = reporters;
		});
		const file = makeFile('notes.txt');
		renderFileUpload({ onUpload });

		await selectFiles(user, [file]);
		await flushFrames();

		options?.onError(file, new Error('Network unreachable'));
		await tick();

		const item = screen.getByRole('listitem');
		expect(item).toHaveAttribute('data-status', 'error');
		expect(document.getElementById(`${item.id}-message`)).toHaveTextContent('Network unreachable');
		expect(item).toHaveAttribute(
			'aria-describedby',
			`${item.id}-name ${item.id}-size ${item.id}-status ${item.id}-message`
		);
	});

	it('marks every file in the batch errored when onUpload throws', async () => {
		const user = setupUser();
		const onUpload = vi.fn(() => {
			throw new Error('Upload rejected');
		});
		renderFileUpload({ onUpload });

		await selectFiles(user, [makeFile('a.txt'), makeFile('b.txt')]);

		await waitFor(() => {
			const items = screen.getAllByRole('listitem');
			expect(items).toHaveLength(2);
			for (const item of items) {
				expect(item).toHaveAttribute('data-status', 'error');
			}
		});
	});

	it('reports the uploading percentage in the item status text', async () => {
		const user = setupUser();
		let options: FileUploadUploadOptions | undefined;
		const onUpload = vi.fn((_files: File[], reporters: FileUploadUploadOptions) => {
			options = reporters;
		});
		const file = makeFile('notes.txt');
		renderFileUpload({ onUpload });

		await selectFiles(user, [file]);
		await flushFrames();

		options?.onProgress(file, 30);
		await flushFrames();

		const item = screen.getByRole('listitem');
		expect(document.getElementById(`${item.id}-status`)).toHaveTextContent(
			'Uploading: 30% complete'
		);
	});

	it('clamps a reported progress value into 0…100', async () => {
		const user = setupUser();
		let options: FileUploadUploadOptions | undefined;
		const onUpload = vi.fn((_files: File[], reporters: FileUploadUploadOptions) => {
			options = reporters;
		});
		const file = makeFile('notes.txt');
		renderFileUpload({ onUpload, withProgress: true, progressForceMount: true });

		await selectFiles(user, [file]);
		await flushFrames();

		options?.onProgress(file, 480);
		await flushFrames();

		expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
	});

	it('draws the circular variant as an svg ring sized by its size prop', async () => {
		const user = setupUser();
		let options: FileUploadUploadOptions | undefined;
		const onUpload = vi.fn((_files: File[], reporters: FileUploadUploadOptions) => {
			options = reporters;
		});
		const file = makeFile('notes.txt');
		renderFileUpload({
			onUpload,
			withProgress: true,
			progressVariant: 'circular',
			progressSize: 40
		});

		await selectFiles(user, [file]);
		await flushFrames();
		options?.onProgress(file, 50);
		await flushFrames();

		const svg = queryBySlot('file-upload-progress')?.querySelector('svg');
		expect(svg).toHaveAttribute('width', '40');
		// Two circles of radius (size - 4) / 2, the second offset by half its circumference at 50%.
		const circumference = 2 * Math.PI * 18;
		const circles = svg?.querySelectorAll('circle') ?? [];
		expect(circles).toHaveLength(2);
		expect(circles[1]).toHaveAttribute('r', '18');
		expect(circles[1]).toHaveAttribute('stroke-dasharray', String(circumference));
		expect(circles[1]).toHaveAttribute(
			'stroke-dashoffset',
			String(circumference - (50 / 100) * circumference)
		);
	});

	it('scales the circular ring with a non-default size prop', async () => {
		const user = setupUser();
		let options: FileUploadUploadOptions | undefined;
		const onUpload = vi.fn((_files: File[], reporters: FileUploadUploadOptions) => {
			options = reporters;
		});
		const file = makeFile('notes.txt');
		renderFileUpload({
			onUpload,
			withProgress: true,
			progressVariant: 'circular',
			progressSize: 64
		});

		await selectFiles(user, [file]);
		await flushFrames();
		options?.onProgress(file, 25);
		await flushFrames();

		const svg = queryBySlot('file-upload-progress')?.querySelector('svg');
		expect(svg).toHaveAttribute('width', '64');
		expect(svg).toHaveAttribute('height', '64');
		expect(svg).toHaveAttribute('viewBox', '0 0 64 64');

		// r is (size - 4) / 2, so a size that is not the default 40 has to move it.
		const circumference = 2 * Math.PI * 30;
		const circles = svg?.querySelectorAll('circle') ?? [];
		expect(circles[1]).toHaveAttribute('r', '30');
		expect(circles[1]).toHaveAttribute('cx', '32');
		expect(circles[1]).toHaveAttribute('stroke-dasharray', String(circumference));
		expect(circles[1]).toHaveAttribute(
			'stroke-dashoffset',
			String(circumference - (25 / 100) * circumference)
		);
	});

	it('draws the fill variant as a clip-path inset', async () => {
		const user = setupUser();
		let options: FileUploadUploadOptions | undefined;
		const onUpload = vi.fn((_files: File[], reporters: FileUploadUploadOptions) => {
			options = reporters;
		});
		const file = makeFile('notes.txt');
		renderFileUpload({ onUpload, withProgress: true, progressVariant: 'fill' });

		await selectFiles(user, [file]);
		await flushFrames();
		options?.onProgress(file, 50);
		await flushFrames();

		expect(bySlot('file-upload-progress').style.clipPath).toBe('inset(50% 0% 0% 0%)');
	});

	it('draws the linear variant as a translated bar', async () => {
		const user = setupUser();
		let options: FileUploadUploadOptions | undefined;
		const onUpload = vi.fn((_files: File[], reporters: FileUploadUploadOptions) => {
			options = reporters;
		});
		const file = makeFile('notes.txt');
		renderFileUpload({ onUpload, withProgress: true, progressVariant: 'linear' });

		await selectFiles(user, [file]);
		await flushFrames();
		options?.onProgress(file, 25);
		await flushFrames();

		const bar = bySlot('file-upload-progress').firstElementChild as HTMLElement;
		expect(bar.style.transform).toBe('translateX(-75%)');
	});
});

// ---------------------------------------------------------------------------
// T036 — useFileUpload
// ---------------------------------------------------------------------------

/** The trimmed text of one of the probe's readouts. */
function probeText(testId: string): string {
	return screen.getByTestId(testId).textContent?.trim() ?? '';
}

describe('file-upload useFileUpload', () => {
	it('exposes the root files, entries and count to a consumer inside the root', async () => {
		const user = setupUser();
		renderFileUpload({ withProbe: true, defaultValue: [makeFile('a.txt')] });

		expect(probeText('probe-count')).toBe('1');
		expect(probeText('probe-files')).toBe('a.txt');
		expect(probeText('probe-entries')).toBe('a.txt:idle:0');

		await selectFiles(user, [makeFile('b.txt')]);

		expect(probeText('probe-count')).toBe('2');
		expect(probeText('probe-files')).toBe('a.txt b.txt');
		// No transport was supplied, so the accepted file is done the moment it lands (FR-005).
		expect(probeText('probe-entries')).toBe('a.txt:idle:0 b.txt:success:100');
	});

	it('exposes the drag state to a consumer', async () => {
		renderFileUpload({ withProbe: true });

		expect(probeText('probe-drag-over')).toBe('false');

		await fireEvent.dragEnter(screen.getByRole('region'));

		expect(probeText('probe-drag-over')).toBe('true');
	});

	it('exposes the rejection flash to a consumer', async () => {
		renderFileUpload({ withProbe: true, maxSize: 1 });

		expect(probeText('probe-invalid')).toBe('false');

		await changeInputFiles([makeFile('huge.txt', { size: 2048 })]);

		expect(probeText('probe-invalid')).toBe('true');
	});

	it('throws when the hook is called outside the root', () => {
		expect(() => renderFileUpload({ mode: 'bare-use-file-upload' })).toThrow(
			/`<FileUpload\.useFileUpload>` must be used within/
		);
	});

	it('replaces membership and prunes stale status entries in setFiles', async () => {
		let root: FileUploadRootState | undefined;
		const kept = makeFile('kept.txt');
		const dropped = makeFile('dropped.txt');
		renderFileUpload({
			withProbe: true,
			defaultValue: [kept, dropped],
			onRootState: (state) => {
				root = state;
			}
		});

		root?.setProgress(kept, 60);
		root?.setProgress(dropped, 30);
		await tick();
		expect(probeText('probe-entries')).toBe('kept.txt:uploading:60 dropped.txt:uploading:30');

		root?.setFiles([kept]);
		await tick();
		expect(probeText('probe-count')).toBe('1');
		expect(probeText('probe-entries')).toBe('kept.txt:uploading:60');

		// `dropped`'s status entry left with it, so re-admitting the very same File starts it over at
		// `idle` while `kept`, which never left, keeps its progress.
		root?.setFiles([kept, dropped]);
		await tick();
		expect(probeText('probe-entries')).toBe('kept.txt:uploading:60 dropped.txt:idle:0');
	});
});

// ---------------------------------------------------------------------------
// T037 — native form participation
// ---------------------------------------------------------------------------

describe('file-upload form participation', () => {
	it('forwards the native form attributes to the hidden input', () => {
		renderFileUpload({ name: 'attachments', required: true, multiple: true, accept: 'image/*' });

		const input = fileInput();
		expect(input).toHaveAttribute('type', 'file');
		expect(input).toHaveAttribute('name', 'attachments');
		expect(input).toHaveAttribute('accept', 'image/*');
		expect(input).toHaveAttribute('multiple');
		expect(input).toBeRequired();
		expect(input).toHaveAttribute('tabindex', '-1');
		expect(input).toHaveClass('sr-only');
	});

	it('omits the attributes the caller did not ask for', () => {
		renderFileUpload({ multiple: false });

		const input = fileInput();
		expect(input).not.toHaveAttribute('multiple');
		expect(input).not.toHaveAttribute('name');
		expect(input).not.toHaveAttribute('accept');
		expect(input).not.toBeRequired();
	});

	it('disables the hidden input while the root is disabled', () => {
		renderFileUpload({ disabled: true });

		expect(fileInput()).toBeDisabled();
	});
});

// ---------------------------------------------------------------------------
// T038 — callback order
// ---------------------------------------------------------------------------

describe('file-upload callback order', () => {
	it('runs the batch callbacks in the documented order', async () => {
		const user = setupUser();
		const log: string[] = [];
		const good = makeFile('photo.png', { type: 'image/png' });
		const bad = makeFile('notes.txt');

		renderFileUpload({
			accept: 'image/*',
			onFileValidate: (file) => {
				log.push(`onFileValidate:${file.name}`);
				return undefined;
			},
			onFileReject: (file) => log.push(`onFileReject:${file.name}`),
			onValueChange: () => log.push('onValueChange'),
			onAccept: () => log.push('onAccept'),
			onFileAccept: (file) => log.push(`onFileAccept:${file.name}`),
			onUpload: () => {
				log.push('onUpload');
			}
		});

		await selectFiles(user, [good, bad]);
		await flushFrames();

		expect(log).toEqual([
			'onFileValidate:photo.png',
			'onFileValidate:notes.txt',
			'onFileReject:notes.txt',
			'onValueChange',
			'onAccept',
			'onFileAccept:photo.png',
			'onUpload'
		]);
	});
});

// ---------------------------------------------------------------------------
// T039 — ItemMetadata size
// ---------------------------------------------------------------------------

describe('file-upload metadata size', () => {
	it('scales the name and size typography down with size="sm"', () => {
		renderFileUpload({ metadataSize: 'sm', defaultValue: [makeFile('notes.txt', { size: 1536 })] });

		const item = screen.getByRole('listitem');
		const name = document.getElementById(`${item.id}-name`);
		const size = document.getElementById(`${item.id}-size`);

		expect(name).toHaveClass('text-[13px]', 'leading-snug', 'font-normal');
		expect(name).not.toHaveClass('text-sm');
		expect(name).not.toHaveClass('font-medium');
		expect(size).toHaveClass('text-[11px]', 'leading-snug');
		expect(size).not.toHaveClass('text-xs');
	});

	it('keeps the default typography with size="default"', () => {
		renderFileUpload({
			metadataSize: 'default',
			defaultValue: [makeFile('notes.txt', { size: 1536 })]
		});

		const item = screen.getByRole('listitem');
		const name = document.getElementById(`${item.id}-name`);
		const size = document.getElementById(`${item.id}-size`);

		expect(name).toHaveClass('text-sm', 'font-medium');
		expect(name).not.toHaveClass('text-[13px]');
		expect(size).toHaveClass('text-xs');
		expect(size).not.toHaveClass('text-[11px]');
	});
});

// ---------------------------------------------------------------------------
// T041 — pass-through event handlers
// ---------------------------------------------------------------------------

describe('file-upload event pass-through', () => {
	it('hands each dropzone event to the caller before acting on it', async () => {
		const user = setupUser();
		const log: string[] = [];
		const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {
			log.push('dialog');
		});
		renderFileUpload({
			onEvent: (type, event) => log.push(`${type}:${event.defaultPrevented}`),
			onValueChange: () => log.push('files')
		});

		const dropzone = screen.getByRole('region');

		await user.click(dropzone);
		dropzone.focus();
		await user.keyboard('{Enter}');
		await fireEvent.dragEnter(dropzone);
		await fireEvent.dragOver(dropzone);
		await dragLeaveTo(dropzone, document.body);
		await dropFiles(dropzone, [makeFile('dropped.txt')]);
		await pasteFiles(dropzone, [makeFile('pasted.txt')]);

		// Every caller entry reads `false`: the internal handler, which is what calls
		// `preventDefault()` on the drag, drop, paste and keyboard events, had not run yet.
		expect(log).toEqual([
			'dropzone-click:false',
			'dialog',
			'dropzone-keydown:false',
			'dialog',
			'dropzone-dragenter:false',
			'dropzone-dragover:false',
			'dropzone-dragleave:false',
			'dropzone-drop:false',
			'files',
			'dropzone-paste:false',
			'files'
		]);
		expect(click).toHaveBeenCalledTimes(2);
	});

	it('suppresses the file dialog when the caller prevents the dropzone click', async () => {
		const user = setupUser();
		const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
		renderFileUpload({ preventDefaultOn: ['dropzone-click'] });

		await user.click(screen.getByRole('region'));

		expect(click).not.toHaveBeenCalled();
	});

	it('suppresses the file dialog when the caller prevents the dropzone keydown', async () => {
		const user = setupUser();
		const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
		renderFileUpload({ preventDefaultOn: ['dropzone-keydown'] });

		screen.getByRole('region').focus();
		await user.keyboard('{Enter}');

		expect(click).not.toHaveBeenCalled();
	});

	it.each(['dropzone-dragenter', 'dropzone-dragover'] as const)(
		'leaves the drag state alone when the caller prevents %s',
		async (type) => {
			renderFileUpload({ preventDefaultOn: [type] });
			const dropzone = screen.getByRole('region');

			if (type === 'dropzone-dragenter') await fireEvent.dragEnter(dropzone);
			else await fireEvent.dragOver(dropzone);

			expect(dropzone).not.toHaveAttribute('data-dragging');
		}
	);

	it('keeps the drag state when the caller prevents the dropzone dragleave', async () => {
		renderFileUpload({ preventDefaultOn: ['dropzone-dragleave'] });
		const dropzone = screen.getByRole('region');

		await fireEvent.dragEnter(dropzone);
		await dragLeaveTo(dropzone, document.body);

		expect(dropzone).toHaveAttribute('data-dragging', '');
	});

	it.each(['dropzone-drop', 'dropzone-paste'] as const)(
		'adds no files when the caller prevents %s',
		async (type) => {
			renderFileUpload({ preventDefaultOn: [type] });
			const dropzone = screen.getByRole('region');

			if (type === 'dropzone-drop') await dropFiles(dropzone, [makeFile('dropped.txt')]);
			else await pasteFiles(dropzone, [makeFile('pasted.txt')]);

			expect(renderedNames()).toEqual([]);
		}
	);

	it('suppresses the file dialog when the caller prevents the trigger click', async () => {
		const user = setupUser();
		const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
		renderFileUpload({ preventDefaultOn: ['trigger-click'] });

		await user.click(screen.getByTestId('trigger'));

		expect(click).not.toHaveBeenCalled();
	});

	it('keeps the file when the caller prevents the delete click', async () => {
		const user = setupUser();
		renderFileUpload({ preventDefaultOn: ['delete-click'], defaultValue: [makeFile('a.txt')] });

		await user.click(screen.getByLabelText('Remove a.txt'));

		expect(renderedNames()).toEqual(['a.txt']);
	});

	it('keeps the list when the caller prevents the clear click', async () => {
		const user = setupUser();
		renderFileUpload({ preventDefaultOn: ['clear-click'], defaultValue: [makeFile('a.txt')] });

		await user.click(screen.getByTestId('clear'));

		expect(renderedNames()).toEqual(['a.txt']);
	});
});

// ---------------------------------------------------------------------------
// T042 — ItemPreview children order
// ---------------------------------------------------------------------------

describe('file-upload preview children', () => {
	it('renders the preview children after the thumbnail', () => {
		renderFileUpload({
			progressInPreview: true,
			defaultValue: [makeFile('photo.png', { type: 'image/png' })]
		});

		const preview = bySlot('file-upload-preview');
		const image = screen.getByRole('img');
		const progress = bySlot('file-upload-progress');

		expect(preview).toContainElement(progress);
		expect(image.compareDocumentPosition(progress) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('renders the preview children after the file-type icon', () => {
		renderFileUpload({ progressInPreview: true, defaultValue: [makeFile('notes.txt')] });

		const preview = bySlot('file-upload-preview');
		const icon = preview.querySelector('svg');
		const progress = bySlot('file-upload-progress');

		expect(icon).toBeInTheDocument();
		expect(preview).toContainElement(progress);

		const position = icon ? icon.compareDocumentPosition(progress) : 0;
		expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// T043 — Shift + Tab out of the dropzone
// ---------------------------------------------------------------------------

describe('file-upload shift tab', () => {
	it('moves focus out of the component without opening the file dialog', async () => {
		const user = setupUser();
		const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
		renderFileUpload();

		screen.getByTestId('trigger').focus();

		await user.tab({ shift: true });
		expect(screen.getByRole('region')).toHaveFocus();

		await user.tab({ shift: true });
		expect(screen.getByRole('region')).not.toHaveFocus();
		expect(screen.getByTestId('trigger')).not.toHaveFocus();
		expect(click).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// T044 — item-scoped parts for a file outside the current set
// ---------------------------------------------------------------------------

describe('file-upload stray item', () => {
	it('renders nothing for an item whose file is not in the current set', () => {
		renderFileUpload({ mode: 'stray-item', defaultValue: [makeFile('a.txt')] });

		// The list is force-mounted, so what is missing below is each part's own `fileState` guard.
		expect(screen.getByRole('list')).toBeInTheDocument();

		expect(screen.queryByTestId('stray-item')).not.toBeInTheDocument();
		expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
		expect(queryBySlot('file-upload-preview')).toBeNull();
		expect(queryBySlot('file-upload-metadata')).toBeNull();
		expect(queryBySlot('file-upload-progress')).toBeNull();
		expect(queryBySlot('file-upload-item-delete')).toBeNull();
		expect(document.querySelector('span[id$="-status"]')).toBeNull();
	});
});
