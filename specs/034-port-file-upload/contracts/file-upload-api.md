# Contract: `file-upload` public UI surface

**Feature**: `034-port-file-upload` | **Date**: 2026-07-31

The consumer-facing contract of the registry item `file-upload`. Upstream line numbers refer to
`.reference/diceui/docs/registry/bases/radix/ui/file-upload.tsx` at the pinned commit. Anything in this file
is covered by a test in `src/lib/components/ui/file-upload/file-upload.test.ts`.

---

## 1. Barrel exports — `$lib/components/ui/file-upload/index.js`

```ts
// Namespace style
import * as FileUpload from '$lib/components/ui/file-upload/index.js';
// FileUpload.Root, .Dropzone, .Trigger, .List, .Item, .ItemPreview, .ItemMetadata,
// .ItemProgress, .ItemDelete, .Clear

// Prefixed style
import {
	FileUpload,
	FileUploadDropzone,
	FileUploadTrigger,
	FileUploadList,
	FileUploadItem,
	FileUploadItemPreview,
	FileUploadItemMetadata,
	FileUploadItemProgress,
	FileUploadItemDelete,
	FileUploadClear
} from '$lib/components/ui/file-upload/index.js';
```

| Short name     | Alias                    | Upstream export          | Line  | Element                    |
| -------------- | ------------------------ | ------------------------ | ----- | -------------------------- |
| `Root`         | `FileUpload`             | `FileUpload`             | L212  | `<div>`                    |
| `Dropzone`     | `FileUploadDropzone`     | `FileUploadDropzone`     | L681  | `<div role="region">`      |
| `Trigger`      | `FileUploadTrigger`      | `FileUploadTrigger`      | L887  | `<button type="button">`   |
| `List`         | `FileUploadList`         | `FileUploadList`         | L928  | `<div role="list">`        |
| `Item`         | `FileUploadItem`         | `FileUploadItem`         | L989  | `<div role="listitem">`    |
| `ItemPreview`  | `FileUploadItemPreview`  | `FileUploadItemPreview`  | L1063 | `<div>`                    |
| `ItemMetadata` | `FileUploadItemMetadata` | `FileUploadItemMetadata` | L1125 | `<div>`                    |
| `ItemProgress` | `FileUploadItemProgress` | `FileUploadItemProgress` | L1188 | `<div role="progressbar">` |
| `ItemDelete`   | `FileUploadItemDelete`   | `FileUploadItemDelete`   | L1315 | `<button type="button">`   |
| `Clear`        | `FileUploadClear`        | `FileUploadClear`        | L1356 | `<button type="button">`   |

Non-component exports: `useFileUpload`, `formatBytes`, `getFileIcon`, `FileUploadRootState`,
`FileUploadItemState`, `setFileUploadContext`, `getFileUploadContext`, `setFileUploadItemContext`,
`getFileUploadItemContext`, `FILE_UPLOAD_STATUSES`, plus the types listed in `plan.md` → Public API.

Composition (from the MDX "Layout" section):

```svelte
<FileUpload.Root>
	<FileUpload.Dropzone>
		<FileUpload.Trigger />
	</FileUpload.Dropzone>
	<FileUpload.List>
		{#each files as file (file)}
			<FileUpload.Item value={file}>
				<FileUpload.ItemPreview />
				<FileUpload.ItemMetadata />
				<FileUpload.ItemProgress />
				<FileUpload.ItemDelete />
			</FileUpload.Item>
		{/each}
	</FileUpload.List>
	<FileUpload.Clear />
</FileUpload.Root>
```

---

## 2. Rendered DOM contract

### Root

```html
<div data-slot="file-upload" data-disabled dir="ltr|rtl" class="relative flex flex-col gap-2 …">
	<!-- children -->
	<input
		type="file"
		id="{uid}-input"
		aria-labelledby="{uid}-label"
		aria-describedby="{uid}-dropzone"
		tabindex="-1"
		class="sr-only"
		accept name multiple required disabled
	/>
	<div id="{uid}-label" class="sr-only">File upload</div>
</div>
```

The hidden input is the last child, after `children` (upstream L652–670). `label` defaults to
`"File upload"`. `data-disabled` is present only when `disabled`.

### Dropzone

`role="region"`, `id="{uid}-dropzone"`, `aria-controls="{uid}-input {uid}-list"`, `aria-disabled`,
`aria-invalid`, `tabindex="0"` (attribute absent when disabled), `dir`.
Data attributes: `data-slot="file-upload-dropzone"`, `data-disabled`, `data-dragging`, `data-invalid`.

### Trigger

`type="button"`, `aria-controls="{uid}-input"`, `disabled` from the root.
Data attributes: `data-slot="file-upload-trigger"`, `data-disabled`.

### List

`role="list"`, `id="{uid}-list"`, `aria-orientation`, `dir`. Renders nothing when the file count is `0` and
`forceMount` is `false`.
Data attributes: `data-slot="file-upload-list"`, `data-orientation="vertical|horizontal"`,
`data-state="active"` (mounted with files) or `"inactive"` (mounted only because of `forceMount`).

### Item

`role="listitem"`, `id="{itemUid}"`, `aria-setsize` = total files, `aria-posinset` = 1-based index,
`aria-labelledby="{itemUid}-name"`, `aria-describedby="{itemUid}-name {itemUid}-size {itemUid}-status"`
(plus ` {itemUid}-message` when the file has an error), `dir`. Renders nothing when its `value` is not in the
current file set. Always appends `<span id="{itemUid}-status" class="sr-only">{statusText}</span>` after
`children`.
Data attributes: `data-slot="file-upload-item"`, `data-status="idle|uploading|success|error"`.

`statusText` (upstream L1020–1026): `Error: {error}` → `Uploading: {progress}% complete` →
`Upload complete` → `Ready to upload`.

### ItemPreview

`aria-labelledby="{itemUid}-name"`, `data-slot="file-upload-preview"`. For `image/*` files renders
`<img src={objectUrl} alt={file.name} class="size-full object-cover">`; otherwise the Lucide icon from
`getFileIcon`. `children` render after the preview content (that is where the circular progress goes).

### ItemMetadata

`data-slot="file-upload-metadata"`, `dir`. Default content when no `children`:

```html
<span id="{itemUid}-name" class="truncate font-medium text-sm">{file.name}</span>
<span id="{itemUid}-size" class="truncate text-muted-foreground text-xs">{formatBytes(file.size)}</span>
<span id="{itemUid}-message" class="text-destructive text-xs">{error}</span>   <!-- only when error -->
```

`size="sm"` swaps in `font-normal text-[13px] leading-snug` / `text-[11px] leading-snug`.

### ItemProgress

`role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow={progress}`,
`aria-valuetext="{progress}%"`, `aria-labelledby="{itemUid}-name"`, `data-slot="file-upload-progress"`.
Unmounts at `progress === 100` unless `forceMount`.

| `variant`  | Markup                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| `linear`   | Track `div` + inner bar with `transform: translateX(-{100 - progress}%)`                                    |
| `circular` | `<svg>` sized `size`×`size`, two circles of radius `(size - 4) / 2`, `stroke-dasharray = 2πr`, `stroke-dashoffset = 2πr − (progress/100)·2πr` |
| `fill`     | Absolute overlay with `clip-path: inset({100 - progress}% 0% 0% 0%)`                                        |

### ItemDelete

`type="button"`, `aria-controls="{itemUid}"`, `aria-describedby="{itemUid}-name"`,
`data-slot="file-upload-item-delete"`.

### Clear

`type="button"`, `aria-controls="{uid}-list"`, `disabled` = own `disabled` OR root `disabled`,
`data-slot="file-upload-clear"`, `data-disabled`. Renders nothing when the file count is `0` and
`forceMount` is `false`.

---

## 3. Data attributes (MDX table, plus one addition)

| Attribute                             | On            | Present when                                              |
| ------------------------------------- | ------------- | --------------------------------------------------------- |
| `data-disabled`                       | Root          | `disabled`                                                |
| `data-disabled`                       | Dropzone      | root `disabled`                                           |
| `data-dragging`                       | Dropzone      | files are being dragged over                              |
| `data-invalid`                        | Dropzone      | a rejection happened in the last 2000 ms, or `invalid`     |
| `data-disabled`                       | Trigger       | root `disabled`                                           |
| `data-orientation="vertical\|horizontal"` | List      | always                                                    |
| `data-state="active\|inactive"`       | List          | always (`inactive` only under `forceMount` with 0 files)  |
| `data-status="idle\|uploading\|success\|error"` | Item | always — **addition**, research R-11                      |
| `data-disabled`                       | Clear         | own or root `disabled`                                    |
| `data-slot="…"`                       | every part    | always                                                    |

---

## 4. Keyboard contract (MDX "Keyboard Interactions")

| Key             | Focus                        | Result                                                                        |
| --------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| `Tab`           | anywhere                     | Moves between dropzone → trigger → each item's delete → clear, in DOM order    |
| `Shift + Tab`   | dropzone                     | Moves focus out of the dropzone                                               |
| `Enter`         | dropzone                     | `preventDefault()` then opens the native file dialog                          |
| `Space`         | dropzone                     | `preventDefault()` then opens the native file dialog                          |
| `Enter`/`Space` | trigger / delete / clear     | Native `<button>` activation                                                  |

The dropzone is a real focusable control (`tabindex="0"`), never drag-only (FR-006). No key in this component
is direction-sensitive — there is no arrow-key navigation, so `dir="rtl"` changes layout only.

Pointer: clicking the dropzone opens the dialog **unless** the click originated inside
`[data-slot="file-upload-trigger"]` (upstream L716–724), which prevents the dialog opening twice when the
trigger is nested in the dropzone.

---

## 5. Controlled / uncontrolled contract

| Mode           | Setup                            | Behaviour                                                                                                     |
| -------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Uncontrolled   | `defaultValue={[fileA]}`         | Seeds once; internal interaction updates the list; `onValueChange` still fires.                                 |
| Controlled     | `bind:value={files}`             | Two-way; the component writes through the binding.                                                              |
| Fully controlled | `bind:value={() => files, (next) => …}` | The parent's setter decides; declining the write leaves the rendered list unchanged.                    |
| Callback only  | `value={files} onValueChange={…}` | The parent is authoritative; the component does not move on its own.                                            |

`onValueChange` fires on additions (`addFiles`), removals (`removeFile`) and `clear()` — not on progress,
success or error transitions.

---

## 6. `useFileUpload()`

```ts
import { useFileUpload } from '$lib/components/ui/file-upload/index.js';

const upload = useFileUpload(); // FileUploadRootState — throws outside <FileUpload.Root>
upload.files; // File[]
upload.entries; // FileUploadFileState[]
upload.count; // number
upload.dragOver; // boolean
upload.invalidState; // boolean
```

Replaces upstream's `useStore as useFileUpload` selector hook (L1413); no selector argument is needed because
every member is already a fine-grained rune.

---

## 7. Error contract

| Part rendered outside…      | Message                                                                     |
| --------------------------- | ---------------------------------------------------------------------------- |
| `Dropzone`, `Trigger`, `List`, `Item`, `Clear` outside `Root` | `` `<FileUpload.X>` must be used within `<FileUpload>`. ``   |
| `ItemPreview`, `ItemMetadata`, `ItemProgress`, `ItemDelete` outside `Item` | `` `<FileUpload.X>` must be used within `<FileUpload.Item>`. `` |

Each message names the offending part and the required provider (FR-016), matching upstream L131 / L979.

---

## 8. Registry contract

```jsonc
{
	"name": "file-upload",
	"type": "registry:ui",
	"title": "File Upload",
	"description": "A file upload component with drag and drop, previewing, and progress tracking.",
	"registryDependencies": ["direction-provider"],
	"dependencies": ["@lucide/svelte"],
	"files": [
		/* index.ts, file-upload.svelte.ts and the 10 part .svelte files — 12 entries, no test files */
	]
}
```

Installed name == folder slug == demo route segment `/docs/components/file-upload`.
