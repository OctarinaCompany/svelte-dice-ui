# Phase 1 Data Model: File Upload

**Feature**: `034-port-file-upload` | **Date**: 2026-07-31

All types below live in `src/lib/components/ui/file-upload/file-upload.svelte.ts` and are re-exported from
`src/lib/components/ui/file-upload/index.ts`.

---

## 1. Value types

```ts
/** Upstream `FileState["status"]` (file-upload.tsx L100). */
export const FILE_UPLOAD_STATUSES = ['idle', 'uploading', 'error', 'success'] as const;
export type FileUploadStatus = (typeof FILE_UPLOAD_STATUSES)[number];

/** Upstream `FileState` (file-upload.tsx L96–101). */
export type FileUploadFileState = {
	/** The selected file. Identity of the entry — compared by reference. */
	file: File;
	/** 0–100, clamped. */
	progress: number;
	/** Rejection or upload-failure message; absent while the file is healthy. */
	error?: string;
	status: FileUploadStatus;
};

/** The reporters handed to `onUpload` (upstream L191–198). */
export type FileUploadUploadOptions = {
	onProgress: (file: File, progress: number) => void;
	onSuccess: (file: File) => void;
	onError: (file: File, error: Error) => void;
};
```

### Entity: **Uploaded File Entry** (spec Key Entities)

| Field      | Type                | Rules                                                                                        |
| ---------- | ------------------- | -------------------------------------------------------------------------------------------- |
| `file`     | `File`              | Identity. Two `File` objects with identical name/size are distinct entries (spec Edge Cases). |
| `status`   | `FileUploadStatus`  | `idle` on add → `uploading` on first progress → `success` \| `error`.                         |
| `progress` | `number`            | Clamped to `[0, 100]`; forced to `100` on success.                                            |
| `error`    | `string \| undefined` | Set by `setError`; rendered by `ItemMetadata` and included in `aria-describedby`.           |

**State transitions** (upstream L307–L341):

```text
                 addFiles                setProgress            setSuccess
      (absent) ───────────▶ idle ──────────────────▶ uploading ──────────────▶ success (progress = 100)
                             │                          │
                             │ setError                 │ setError
                             ▼                          ▼
                           error ◀────────────────────── error
      any state ──removeFile / clear──▶ (absent, object URL revoked)
```

`setProgress` / `setSuccess` / `setError` on a file that is not in the map are no-ops (upstream guards with
`if (fileState)`).

### Entity: **File Upload Constraints** (spec Key Entities)

Not a runtime object — the four root props read on every batch:

| Prop             | Type                                          | Applied                                            | Default message         |
| ---------------- | --------------------------------------------- | -------------------------------------------------- | ----------------------- |
| `maxFiles`       | `number \| undefined`                         | Before per-file checks, against remaining slots     | `Maximum N files allowed` |
| `onFileValidate` | `(file) => string \| null \| undefined`       | First per-file check; a returned string wins        | (consumer supplied)     |
| `accept`         | `string` (comma-separated)                    | MIME equality, `.ext` equality, or `type/*` prefix  | `File type not accepted` |
| `maxSize`        | `number` (bytes)                              | `file.size > maxSize`                               | `File too large`        |

---

## 2. `FileUploadRootState`

Constructed once by `file-upload.svelte`, published on the root context.

```ts
export type FileUploadRootStateProps = {
	getValue: () => File[];
	setValue: (files: File[]) => void;
	getAccept: () => string | undefined;
	getMaxFiles: () => number | undefined;
	getMaxSize: () => number | undefined;
	getDisabled: () => boolean;
	getInvalid: () => boolean;
	getDir: () => Direction;
	getInputId: () => string;
	getDropzoneId: () => string;
	getListId: () => string;
	getLabelId: () => string;
	onAccept?: (files: File[]) => void;
	onFileAccept?: (file: File) => void;
	onFileReject?: (file: File, message: string) => void;
	onFileValidate?: (file: File) => string | null | undefined;
	onUpload?: (files: File[], options: FileUploadUploadOptions) => Promise<void> | void;
};
```

All reactive inputs arrive as **getter functions** (CLAUDE.md §4); callbacks are read through the props
object at call time so a re-rendered parent's newest callback is always used (upstream's `useAsRef`).

| Member                             | Kind                         | Notes                                                                                    |
| ---------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------- |
| `#statuses`                        | `SvelteMap<File, FileUploadFileState>` | Status sidecar; written only by mutating methods (research R-04).              |
| `#urlCache`                        | `WeakMap<File, string>`      | Object URLs for image previews (upstream L168).                                            |
| `#progressFrame`                   | `number`                     | rAF handle for the progress coalescer; `0` when idle.                                      |
| `#invalidTimer`                    | `ReturnType<typeof setTimeout> \| undefined` | 2000 ms invalid-flash reset.                                             |
| `inputRef`                         | `$state<HTMLInputElement \| null>` | Bound to the hidden input; `.click()` opens the dialog.                             |
| `dragOver`                         | `$state<boolean>`            | Dropzone `data-dragging`.                                                                  |
| `invalidState`                     | `$state<boolean>`            | Seeded from the `invalid` prop; flashed by rejections.                                     |
| `files`                            | `$derived: File[]`           | `getValue()` — the authoritative list.                                                     |
| `entries`                          | `$derived: FileUploadFileState[]` | `files.map((f) => #statuses.get(f) ?? { file: f, progress: 0, status: 'idle' })`.      |
| `count`                            | `$derived: number`           | `files.length` — drives `List`/`Clear` mounting and `aria-setsize`.                        |
| `disabled`, `dir`, ids             | `$derived`                   | Straight pass-through of the getters.                                                      |
| `getFileState(file)`               | method                       | `entries` lookup by reference; `undefined` when absent.                                    |
| `getFileIndex(file)`               | method                       | 1-based position for `aria-posinset` (upstream L1001–1004).                                |
| `getPreviewUrl(file)`              | method                       | Lazily `createObjectURL`, cached in `#urlCache`.                                            |
| `openFileDialog()`                 | method                       | No-op when disabled; otherwise `inputRef?.click()`.                                        |
| `addFiles(files)`                  | method                       | The full acceptance pipeline (§3).                                                          |
| `setFiles(files)`                  | method                       | Replace membership, pruning stale status entries (upstream `SET_FILES`).                    |
| `setProgress(file, progress)`      | method                       | Clamp `[0,100]`, status → `uploading`.                                                      |
| `setSuccess(file)`                 | method                       | `progress = 100`, status → `success`.                                                       |
| `setError(file, message)`          | method                       | `error = message`, status → `error`.                                                        |
| `removeFile(file)`                 | method                       | Revoke URL, drop status, splice from `value`, fire `onValueChange` via `setValue`.          |
| `clear()`                          | method                       | Revoke every URL, empty the map, `setValue([])`, `invalidState = false`.                    |
| `setDragOver(next)` / `setInvalid` | method                       | Plain setters.                                                                              |
| `destroy()`                        | method                       | `cancelAnimationFrame`, `clearTimeout`, revoke every cached URL (research R-10).             |

---

## 3. The acceptance pipeline — `addFiles(incoming: File[])`

Ported from upstream L489–L615; the order is part of the contract (FR-003).

```text
0. if disabled → return                                                    (upstream L491)
1. if maxFiles:
     remaining = max(0, maxFiles - count)
     if remaining < incoming.length:
       overflow = incoming.slice(remaining)      → invalid = true
       incoming = incoming.slice(0, remaining)
       for each overflow file:
         message = onFileValidate(file) || `Maximum ${maxFiles} files allowed`
         onFileReject(file, message)                                       (upstream L496–519)
2. for each remaining file, in order:
     a. onFileValidate(file) returns a string → reject with it, `continue` (skips b and c)
     b. accept  → MIME equality | ".ext" equality | "type/*" prefix, else reject "File type not accepted"
     c. maxSize → file.size > maxSize, else reject "File too large"
        (b and c both run; the last message set wins — upstream L539–564)
3. if anything was rejected: invalid = true, then reset to false after 2000 ms
4. if acceptedFiles.length > 0:
     a. append to the map as { progress: 0, status: 'idle' } and setValue([...value, ...accepted])
        → this is what fires onValueChange
     b. onAccept(acceptedFiles)
     c. onFileAccept(file) for each accepted file
     d. if onUpload: requestAnimationFrame(() => runUpload(acceptedFiles))
        else: setSuccess(file) for each accepted file                       (FR-005, upstream L469–473)
```

`runUpload(files)` sets every file to `progress: 0` first, awaits `onUpload(files, { onProgress, onSuccess,
onError })`, and on a thrown error marks **every** file in the batch `error` with the thrown message or
`"Upload failed"` (upstream L448–487). `onProgress` is coalesced to one write per animation frame.

---

## 4. `FileUploadItemState`

Constructed by `file-upload-item.svelte`, published on the item context.

```ts
export type FileUploadItemStateProps = {
	getValue: () => File;
	getId: () => string;
};
```

| Member                              | Kind        | Notes                                                                              |
| ----------------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `root`                              | field       | The `FileUploadRootState` read from context at construction.                         |
| `file`                              | `$derived`  | `getValue()`.                                                                        |
| `fileState`                         | `$derived`  | `root.getFileState(file)` — `undefined` hides the item and all its children.          |
| `id`, `nameId`, `sizeId`, `statusId`, `messageId` | `$derived` | `${id}`, `${id}-name`, `${id}-size`, `${id}-status`, `${id}-message`. |
| `index`                             | `$derived`  | 1-based, for `aria-posinset`.                                                        |
| `statusText`                        | `$derived`  | `Error: {msg}` \| `Uploading: {n}% complete` \| `Upload complete` \| `Ready to upload` (upstream L1020–1026). |
| `describedBy`                       | `$derived`  | `[nameId, sizeId, statusId, error && messageId].filter(Boolean).join(' ')` (R-12).    |

---

## 5. Context keys

| Key                                | Provider              | Getter                        | Error thrown                                              |
| ---------------------------------- | --------------------- | ----------------------------- | ---------------------------------------------------------- |
| `Symbol('file-upload')`            | `<FileUpload>`        | `getFileUploadContext(name)`  | `` `<FileUpload.Dropzone>` must be used within `<FileUpload>`. `` |
| `Symbol('file-upload-item')`       | `<FileUpload.Item>`   | `getFileUploadItemContext(name)` | `` `<FileUpload.ItemPreview>` must be used within `<FileUpload.Item>`. `` |

Both getters take the consumer's display name so the message names the offending part (FR-016), matching
upstream L131 and L979.

---

## 6. Pure helpers

```ts
/** Upstream L32–37, byte-for-byte: 0 → "0 B"; B has no decimals, KB and above have one. */
export function formatBytes(bytes: number): string;

/** Upstream L39–92: MIME first, then extension, then the application/* catch-all, then generic. */
export function getFileIcon(file: File): Component;
```

`getFileIcon` branch order (must not be reordered — an `application/zip` file must resolve to the archive
icon via its extension before the `application/*` branch): `video/*` → `audio/*` → `text/*` or
`txt|md|rtf|pdf` → `html|css|js|jsx|ts|tsx|json|xml|php|py|rb|java|c|cpp|cs` → `zip|rar|7z|tar|gz|bz2` →
`exe|msi|app|apk|deb|rpm` or `application/*` → generic.
