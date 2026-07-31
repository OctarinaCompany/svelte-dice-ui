# Quickstart & Validation: File Upload

**Feature**: `034-port-file-upload` | **Date**: 2026-07-31

How to run and prove the port. Details of the surface being validated live in
[contracts/file-upload-api.md](./contracts/file-upload-api.md); the state shape lives in
[data-model.md](./data-model.md).

## Prerequisites

- Node with `pnpm` available; dependencies already installed (`pnpm install` if the tree is cold).
- No new npm packages are required by this feature — `@lucide/svelte`, `svelte-sonner`, `tailwind-variants`
  and every shadcn base component are already in `package.json`.
- Nothing under `.reference/` is installed, built or run.

## Commands

All commands are non-interactive and terminate on their own. Run from the repository root.

```bash
pnpm run format            # first — generator output is not Prettier-formatted
pnpm run check             # svelte-kit sync && svelte-check   (0 errors, 0 warnings)
pnpm run lint              # prettier --check . && eslint .    (0 findings)
pnpm run test:unit -- --run                                    # Vitest single run, all green
pnpm run build             # vite build, including the new demo route
pnpm run registry:build    # regenerates static/r/ after the registry.json entry is added
```

Scope a single run while iterating:

```bash
pnpm run test:unit -- --run src/lib/components/ui/file-upload/file-upload.test.ts
```

Never start `pnpm dev`, bare `vitest`, or any `--watch`/`--ui` mode.

## Validation scenarios

Each scenario maps to a spec acceptance scenario and is proved by a test in
`src/lib/components/ui/file-upload/file-upload.test.ts` unless noted.

### S1 — Select and preview (User Story 1, P1)

1. Render the harness with `Dropzone`, `Trigger`, `List`, `Item`, `ItemPreview`, `ItemMetadata`,
   `ItemDelete`, `Clear` and no `onUpload`.
2. `userEvent.upload()` two files onto the hidden input.
3. **Expect**: two `listitem`s, each with the file name, `formatBytes(size)` output and a delete button;
   `role="list"` appears only after the first file exists; `aria-setsize=2` and `aria-posinset` 1 and 2.
4. Click the first delete button → one item remains, `aria-setsize=1`, `URL.revokeObjectURL` called with that
   file's cached URL.
5. Click clear → the list unmounts entirely (no `forceMount`).
6. **Expect** for keyboard parity: `Tab` reaches the dropzone, `Enter` and `Space` each call the hidden
   input's `click`.

### S2 — Drag-and-drop and paste (User Story 1, scenarios 5–6)

1. `fireEvent.dragEnter` on the dropzone → `data-dragging` present.
2. `fireEvent.drop` with a hand-built `dataTransfer.files` → the files appear in the list and `data-dragging`
   is gone.
3. `fireEvent.dragLeave` with a `relatedTarget` **inside** the dropzone → `data-dragging` stays present.
4. `fireEvent.paste` with `clipboardData.items` of kind `file` → same result as a drop.

### S3 — Constraints and rejection (User Story 2, P2)

1. Configure `maxFiles={2}`, `maxSize={1024}`, `accept="image/*"` and an `onFileValidate` that rejects files
   named `blocked*`.
2. Upload a mixed batch: one valid image, one oversized image, one `text/plain`, one `blocked.png`, plus one
   file beyond the count cap.
3. **Expect**: only the valid image is listed; `onFileReject` fired once per rejected file with
   `"File too large"`, `"File type not accepted"`, the custom message, and `Maximum 2 files allowed`
   respectively; the dropzone carries `data-invalid`, which clears after advancing fake timers by 2000 ms.

### S4 — Upload progress (User Story 3, P3)

1. Supply an `onUpload` that calls `onProgress(file, 50)`, then `onSuccess(file)`.
2. **Expect**: after a frame flush, `role="progressbar"` reports `aria-valuenow="50"` and
   `aria-valuetext="50%"`; the item carries `data-status="uploading"`; after success the progressbar unmounts
   (and stays mounted when `forceMount` is set) and `data-status="success"`.
3. With an `onUpload` that calls `onError(file, new Error('Boom'))` → `data-status="error"`, the message is
   rendered by `ItemMetadata`, and the item's `aria-describedby` gains the message id.
4. With no `onUpload` at all → files go straight to `data-status="success"` with no progress phase.
5. Repeat step 2 for `variant="circular"` (asserting `stroke-dashoffset`) and `variant="fill"` (asserting the
   `clip-path` inset).

### S5 — Controlled, uncontrolled and guard rails

1. `defaultValue={[fileA]}` with no binding → `fileA` is listed and a subsequent upload appends to it.
2. `bind:value` → the parent's array tracks every addition and removal.
3. Function binding whose setter ignores writes → the rendered list never changes while `onValueChange` still
   reports the intended next value.
4. `disabled` → dropzone click, `Enter`, `Space`, drop, paste, delete and clear all change nothing.
5. Rendering each part outside its provider throws `/must be used within/`.

### S6 — RTL and demo page (SC-005)

Covered by tests for attribute propagation (`dir="rtl"` on root → dropzone, list and item) and by manual
inspection of the demo route after `pnpm run build`: every section renders without overlap under
`<DirectionProvider dir="rtl">`.

## Manual demo check

`pnpm run build` compiles `src/routes/docs/components/file-upload/+page.svelte`, which must contain seven
`<ComponentPreview>` sections (Default, With Validation, Direct Upload, Circular Progress, Fill Progress,
With Chat Input, With Form) plus the ten API tables. The uploadthing section is intentionally absent — see
`plan.md` → Complexity Tracking.

## Done criteria

- All five gate commands above exit `0`, with no `@ts-ignore`, `@ts-expect-error`, `eslint-disable`,
  `svelte-ignore`, `as any`, `.skip` or `.todo` introduced anywhere.
- `registry.json` contains exactly one new `registry:ui` item named `file-upload` listing the 12 non-test
  files, and `static/r/file-upload.json` exists after `pnpm run registry:build`.
- `/docs/components` lists File Upload and its card links to `/docs/components/file-upload`.
