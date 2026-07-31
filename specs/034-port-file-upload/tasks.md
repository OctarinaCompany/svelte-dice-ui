---
description: 'Task list for the File Upload port'
---

# Tasks: File Upload

**Input**: Design documents from `/specs/034-port-file-upload/` (plan.md, spec.md, research.md,
data-model.md, contracts/file-upload-api.md, quickstart.md)

**Tests**: Mandatory (Constitution Principle III / CLAUDE.md §7). Colocated at
`src/lib/components/ui/file-upload/file-upload.test.ts`, composing parts through the non-registry
harness `src/lib/components/ui/file-upload/file-upload.test.svelte`.

**Organization**: Setup → Tests → Core component files → Barrel and types → Demo route → Registry
entry and docs polish → Verification, per the requested sequencing. User story labels (`[US1]`,
`[US2]`, `[US3]`) are attached to implementation tasks so story-level scope stays traceable even
though the phases are file-lifecycle-ordered rather than story-ordered.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency)
- **[Story]**: Maps a task to US1 (select/preview), US2 (validation), or US3 (progress); omitted for
  tasks that are not story-specific (setup, barrel, demo, registry, verification)

## Assumptions carried from spec.md (do not re-litigate)

- The upload transport stays entirely consumer-supplied via `onUpload(files, { onProgress, onSuccess,
  onError })`; no npm upload SDK (e.g. uploadthing) is added, and its demo is not ported.
- The dropzone is a real, independently focusable `tabindex="0"` control — `Enter`/`Space` open the
  native dialog while it is focused; it is never drag-only (FR-006).

---

## Phase 1: Setup

**Purpose**: Confirm the port has everything it needs before any file is written; no new npm
dependencies are required (plan.md — Zero new npm dependencies).

- [X] T001 Confirm `src/lib/components/ui/direction-provider/` exists and re-read its exported
      `dir`/context API in `src/lib/components/ui/direction-provider/index.ts` (this port composes it
      for RTL instead of a Radix `Direction` primitive — no new file written by this task).
- [X] T002 Create the empty directory `src/lib/components/ui/file-upload/` and the empty directory
      `src/routes/docs/components/file-upload/` (no files yet — placeholders for Phase 2 onward).
- [X] T003 [P] Append the `registry.json` stub entry for `"file-upload"` (name, type `registry:ui`,
      title, description, `registryDependencies: ["direction-provider"]`,
      `dependencies: ["@lucide/svelte"]`, empty `files: []`) at the end of the root-level `"items"`
      array in `registry.json`, matching the shape of the existing `"color-picker"` entry — the
      `files` array is populated for real in Phase 6 (T024).

**Checkpoint**: Directories exist, the registry has a placeholder entry to append files to, and the
direction-provider API is confirmed. No component code exists yet.

---

## Phase 2: Tests (write first — MUST fail before implementation exists)

**Purpose**: Encode the full behavioural contract from `contracts/file-upload-api.md` and the test
matrix in `plan.md` before any part is implemented, per Constitution Principle III.

> All tests below live in two files. Because both files import from the not-yet-created
> `src/lib/components/ui/file-upload/index.ts`, they are grouped as one non-parallel sequence per
> file (same file, sequential edits) but the two files themselves are independent of each other.

- [X] T004 Create the test-only harness `src/lib/components/ui/file-upload/file-upload.test.svelte`
      that composes `Root` → `Dropzone` → `Trigger`, `List` → `Item` → `ItemPreview` +
      `ItemMetadata` + `ItemProgress` + `ItemDelete`, and `Clear`, forwarding every prop the test
      file needs as component props (value/defaultValue bindings, accept/maxFiles/maxSize/disabled/
      required/dir/onUpload/onFileValidate/onFileAccept/onFileReject/onAccept/onValueChange, plus
      slots for `child`/`render`/custom `children` snippets) so `file-upload.test.ts` never imports
      `.svelte` files directly. Import the not-yet-created barrel from
      `./index.js` (the test file is written next; this harness is expected to fail to compile until
      Phase 3–5 land it).
- [X] T005 [US1] In `src/lib/components/ui/file-upload/file-upload.test.ts`, write the **roles & ARIA**
      test group: `region`/`list`/`listitem`/`progressbar` roles resolve, `aria-controls` on
      Dropzone/Trigger/Clear, `aria-labelledby`/`aria-describedby` on Item and its children,
      `aria-setsize`/`aria-posinset` on Item, `aria-valuenow`/`aria-valuetext` on ItemProgress, the
      sr-only root label and the sr-only per-item status text (per contracts/file-upload-api.md §2).
- [X] T006 [US1] In `src/lib/components/ui/file-upload/file-upload.test.ts`, write the **keyboard**
      test group using `@testing-library/user-event`: `Tab` order dropzone → trigger → each item's
      delete → clear; `Enter` and `Space` on the focused dropzone open the dialog (assert via a spy
      on the hidden input's `click`); `Enter`/`Space` activate trigger, delete and clear as native
      buttons; a click that originates inside the trigger does not double-open the dialog (contracts
      §4).
- [X] T007 [US1] In `src/lib/components/ui/file-upload/file-upload.test.ts`, write the
      **uncontrolled** test group: `defaultValue` seeds the rendered list; adding a file via the
      harness's simulated file selection and deleting a file both update the internally rendered
      list with no `value` binding present.
- [X] T008 [US1] In `src/lib/components/ui/file-upload/file-upload.test.ts`, write the **controlled**
      test group: passing `value` makes the parent authoritative, `onValueChange` fires with the next
      array, and a controlled setter that declines the write (re-renders with the same `value`)
      leaves the rendered list unchanged (contracts §5).
- [X] T009 [P] [US1] In `src/lib/components/ui/file-upload/file-upload.test.ts`, write the **RTL**
      test group: `dir="rtl"` on the root propagates to Dropzone/List/Item; direction inherited from
      an ancestor `direction-provider` context when `dir` is omitted; assert no keyboard binding
      inverts (this component has no arrow-key navigation, per spec Edge Cases).
- [X] T010 [P] [US1] In `src/lib/components/ui/file-upload/file-upload.test.ts`, write the **guard
      rails** test group: `disabled` suppresses dialog-open, drop, paste, keyboard activation, delete
      and clear while previously listed files stay visible; rendering `Dropzone`/`Trigger`/`List`/
      `Item`/`Clear` outside `Root`, and `ItemPreview`/`ItemMetadata`/`ItemProgress`/`ItemDelete`
      outside `Item`, each throws `/must be used within/` (contracts §7).
- [X] T011 [P] [US1] In `src/lib/components/ui/file-upload/file-upload.test.ts`, write the **previews
      & metadata** test group: an image file renders `<img>` using a stubbed
      `URL.createObjectURL`/`URL.revokeObjectURL` (revoked on delete, clear, and unmount); every
      `getFileIcon` branch (video, audio, text, code, archive, binary/`application/*`, generic)
      resolves to a distinct icon; `formatBytes` boundaries (`0`, `<1 KB`, `1.5 KB`, MB, GB, TB) match
      upstream rounding (data-model.md §6).
- [X] T012 [P] [US1] In `src/lib/components/ui/file-upload/file-upload.test.ts`, write the **snippets**
      test group: `child({ props })` works on every one of the 10 parts; `ItemPreview`'s `render`
      snippet receives `{ file, fallback }` and can invoke `{@render fallback()}`; a custom
      `ItemMetadata` `children` snippet fully replaces the default name/size/error trio.
- [X] T013 [US2] In `src/lib/components/ui/file-upload/file-upload.test.ts`, write the **validation**
      test group: `maxFiles` slot-arithmetic rejection with the "maximum files allowed" message and a
      transient `data-invalid` flash on the dropzone; `accept` MIME/extension/`type/*`-wildcard
      rejection ("file type not accepted"); `maxSize` rejection ("file too large"); an
      `onFileValidate` message overriding built-in wording; a mixed valid/invalid batch accepting the
      valid file while rejecting the invalid one individually; the `data-invalid` flash resets after
      2000 ms using fake timers (data-model.md §3, spec US2 Acceptance Scenarios).
- [X] T014 [US3] In `src/lib/components/ui/file-upload/file-upload.test.ts`, write the **upload**
      test group: `onUpload` receives the accepted files plus `onProgress`/`onSuccess`/`onError`;
      calling `onProgress` updates `aria-valuenow`/`aria-valuetext` after a rAF flush across all three
      `variant`s (linear/circular/fill); `onSuccess` drives progress to 100 and unmounts
      `ItemProgress` unless `forceMount`; `onError` (or a thrown `onUpload`) sets `data-status="error"`
      and renders the message in `ItemMetadata`; omitting `onUpload` marks accepted files successful
      immediately with no progress phase (spec US3 Acceptance Scenarios, data-model.md §3).
- [X] T015 Run `pnpm run test:unit -- --run` and confirm every test added in T005–T014 fails (the
      barrel does not exist yet) — this is the required red step before implementation begins; do not
      proceed to Phase 3 until the failures are confirmed to be "module not found" style failures, not
      typos in the test file itself.

**Checkpoint**: The full behavioural contract is encoded and red. Nothing under
`src/lib/components/ui/file-upload/` compiles yet except the two test files.

---

## Phase 3: Core component files — state module and root-level parts

**Purpose**: Build the reactive core and the parts that make User Story 1 (select/preview) function.

- [X] T016 [P] Create `src/lib/components/ui/file-upload/file-upload.svelte.ts` with: the
      `FILE_UPLOAD_STATUSES` const and `FileUploadStatus`/`FileUploadFileState`/
      `FileUploadUploadOptions` types (data-model.md §1); `formatBytes()` and `getFileIcon()` pure
      helpers (data-model.md §6, exact branch order — video → audio → text/`txt|md|rtf|pdf` →
      code-extensions → archive-extensions → binary-extensions-or-`application/*` → generic); the two
      `Symbol`-keyed contexts `setFileUploadContext`/`getFileUploadContext` and
      `setFileUploadItemContext`/`getFileUploadItemContext`, each getter throwing
      `` `<FileUpload.${name}>` must be used within `<FileUpload>`. `` (or `<FileUpload.Item>` for the
      item context) per data-model.md §5; the `FileUploadRootState` class (fields, `$derived`s and
      methods listed in data-model.md §2, with `addFiles` implementing the full pipeline in
      data-model.md §3); and the `FileUploadItemState` class (data-model.md §4).
- [X] T017 [US1] Create `src/lib/components/ui/file-upload/file-upload.svelte` (Root, `<div>`): module
      script exports `FileUploadRootProps` per plan.md Public API table (all 19 props, `ref`
      bindable, `value` bindable, `defaultValue`, `onValueChange`, `onAccept`, `onFileAccept`,
      `onFileReject`, `onFileValidate`, `onUpload`, `accept`, `maxFiles`, `maxSize`, `dir`, `label`
      default `'File upload'`, `name`, `disabled`, `invalid`, `multiple`, `required`); instantiates
      `FileUploadRootState` with getter-wrapped props and calls `setFileUploadContext`; renders the
      root `<div data-slot="file-upload" data-disabled dir>`, `{@render children?.()}`, the hidden
      `sr-only` `<input type="file">` wired to `accept`/`name`/`multiple`/`required`/`disabled` and
      `bind:this` on `inputRef`, and the sr-only label `<div>`, exactly per
      contracts/file-upload-api.md §2 "Root"; supports the `child` snippet.
- [X] T018 [US1] Create `src/lib/components/ui/file-upload/file-upload-dropzone.svelte` (`<div
      role="region">`): reads `FileUploadRootState` via `getFileUploadContext('Dropzone')`; renders
      `id`, `aria-controls="{inputId} {listId}"`, `aria-disabled`, `aria-invalid`, `tabindex="0"`
      (attribute omitted when disabled), `dir`, `data-slot="file-upload-dropzone"`, `data-disabled`,
      `data-dragging`, `data-invalid`; wires `onclick` (open dialog unless the originating target is
      inside `[data-slot="file-upload-trigger"]`), `ondragenter`/`ondragover`/`ondragleave`/`ondrop`
      (drag state + `addFiles` on drop), `onpaste` (clipboard `items` walk → `addFiles`), and
      `onkeydown` (`Enter`/`Space` → `preventDefault()` + open dialog) — every pass-through handler
      invoked before internal behaviour and skipped if the caller calls `preventDefault()`; supports
      `child` snippet.
- [X] T019 [P] [US1] Create `src/lib/components/ui/file-upload/file-upload-trigger.svelte` (`<button
      type="button">`): reads context via `getFileUploadContext('Trigger')`; `ref` bindable
      `HTMLButtonElement | null`; `aria-controls="{inputId}"`, `disabled` from root,
      `data-slot="file-upload-trigger"`, `data-disabled`; `onclick` pass-through then
      `openFileDialog()`; supports `children` and `child` snippets.
- [X] T020 [P] [US1] Create `src/lib/components/ui/file-upload/file-upload-clear.svelte` (`<button
      type="button">`): reads context via `getFileUploadContext('Clear')`; props `forceMount`
      (default `false`), `disabled` (default `false`, OR-ed with root `disabled`); renders nothing
      when `count === 0` and not `forceMount`; `aria-controls="{listId}"`,
      `data-slot="file-upload-clear"`, `data-disabled`; `onclick` pass-through then `clear()`;
      supports `children` and `child` snippets.

**Checkpoint**: Selecting via dialog, drag-and-drop, paste and clearing all update root state; item
display parts land in Phase 4.

---

## Phase 4: Core component files — item parts

**Purpose**: Complete User Story 1's display/removal path and lay the ground for validation (US2)
and progress (US3), which read the same `FileUploadItemState`.

- [X] T021 [US1] Create `src/lib/components/ui/file-upload/file-upload-list.svelte` (`<div
      role="list">`): reads root context via `getFileUploadContext('List')`; props `orientation`
      (default `'vertical'`), `forceMount` (default `false`); renders nothing when `count === 0` and
      not `forceMount`; `aria-orientation`, `dir`, `data-slot="file-upload-list"`,
      `data-orientation`, `data-state="active" | "inactive"`; supports `children` and `child`
      snippets.
- [X] T022 [US1] Create `src/lib/components/ui/file-upload/file-upload-item.svelte` (`<div
      role="listitem">`): required `value: File` prop; reads root context via
      `getFileUploadContext('Item')`, instantiates `FileUploadItemState` and calls
      `setFileUploadItemContext`; renders nothing when `root.getFileState(value)` is `undefined`;
      `id`, `aria-setsize`, `aria-posinset`, `aria-labelledby="{id}-name"`,
      `aria-describedby` built by joining present id tokens (nameId, sizeId, statusId, and messageId
      only when an error exists — per plan.md Assumptions, not upstream's template-literal spelling),
      `dir`, `data-slot="file-upload-item"`, `data-status`; appends
      `<span id="{id}-status" class="sr-only">{statusText}</span>` after `children`; supports
      `child` snippet.
- [X] T023 [P] [US1] Create `src/lib/components/ui/file-upload/file-upload-item-preview.svelte`
      (`<div>`): reads item context via `getFileUploadItemContext('ItemPreview')`; optional `render`
      snippet `Snippet<[{ file: File; fallback: Snippet }]>`; default content — `<img>` via
      `root.getPreviewUrl(file)` for `image/*` files, else the `getFileIcon(file)` icon component;
      `children` render after the preview content; `aria-labelledby="{itemId}-name"`,
      `data-slot="file-upload-preview"`; supports `child` snippet.
- [X] T024 [P] [US1] Create `src/lib/components/ui/file-upload/file-upload-item-metadata.svelte`
      (`<div>`): reads item context via `getFileUploadItemContext('ItemMetadata')`; prop `size`
      (default `'default'`, `'sm'` swaps typography per contracts §2 "ItemMetadata"); default content
      — name span (`{itemId}-name`), formatted-size span (`{itemId}-size`,
      `formatBytes(file.size)`), and an error span (`{itemId}-message`) rendered only when
      `fileState.error` is set; a `children` snippet fully replaces this default trio;
      `data-slot="file-upload-metadata"`, `dir`; supports `child` snippet.
- [X] T025 [P] [US1] Create `src/lib/components/ui/file-upload/file-upload-item-delete.svelte`
      (`<button type="button">`): reads item context via `getFileUploadItemContext('ItemDelete')`;
      `ref` bindable `HTMLButtonElement | null`; `aria-controls="{itemId}"`,
      `aria-describedby="{itemId}-name"`, `data-slot="file-upload-item-delete"`; `onclick`
      pass-through then `root.removeFile(file)`; supports `children` and `child` snippets.

**Checkpoint**: User Story 1 (select, preview, name/size, delete, clear, drag/paste) is fully
functional and independently testable per its Independent Test in spec.md.

---

## Phase 5: Core component files — validation and progress (US2 / US3)

**Purpose**: These stories reuse the `addFiles` pipeline and `FileUploadItemState` built above; only
the progress-presentation part and its wiring remain to be written as dedicated files.

- [X] T026 [US2] Verify and, if any gap remains against data-model.md §3, extend the acceptance
      pipeline (`addFiles`) in `src/lib/components/ui/file-upload/file-upload.svelte.ts`: `maxFiles`
      slot arithmetic with overflow rejection, `onFileValidate` precedence, `accept` MIME/extension/
      `type/*`-wildcard matching, `maxSize`, the 2000 ms `invalidState` flash (`setTimeout` tracked in
      `#invalidTimer`), and clearing the hidden `<input>`'s value after every batch (including a
      fully-rejected batch) so the same file can be re-selected — this task closes out US2 against the
      T013 tests written in Phase 2.
- [X] T027 [US3] Create `src/lib/components/ui/file-upload/file-upload-item-progress.svelte` (`<div
      role="progressbar">`): reads item context via `getFileUploadItemContext('ItemProgress')`; props
      `variant` (default `'linear'`), `size` (default `40`, circular diameter px), `forceMount`
      (default `false`); unmounts once `fileState.progress === 100` unless `forceMount`;
      `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow={progress}`,
      `aria-valuetext="{progress}%"`, `aria-labelledby="{itemId}-name"`,
      `data-slot="file-upload-progress"`; renders the three markup variants exactly per
      contracts/file-upload-api.md §2 "ItemProgress" (`linear` translateX track+bar, `circular` SVG
      with radius `(size - 4) / 2` and `-rotate-90` transform, `fill` `clip-path: inset(...)`
      overlay); supports `child` snippet.
- [X] T028 [US3] Verify and, if any gap remains against data-model.md §3, finish `runUpload` in
      `src/lib/components/ui/file-upload/file-upload.svelte.ts`: schedules on the next animation
      frame after acceptance, sets every accepted file to `progress: 0` first, awaits
      `onUpload(files, { onProgress, onSuccess, onError })` with `onProgress` coalesced to one write
      per animation frame via `#progressFrame`, marks every file in the batch `error` on a thrown
      rejection (message or `"Upload failed"`), and calls `setSuccess` for every accepted file
      immediately when `onUpload` is absent (FR-005) — this task closes out US3 against the T014
      tests written in Phase 2.
- [X] T029 Run `pnpm run test:unit -- --run` and fix every remaining failure from the T005–T014 test
      groups now that all 10 parts and the state module exist; do not suppress any assertion — fix
      the component or state-class code until every test in
      `src/lib/components/ui/file-upload/file-upload.test.ts` passes.

**Checkpoint**: All three user stories (US1, US2, US3) are fully implemented and green against the
Phase 2 tests.

---

## Phase 6: Barrel and types

**Purpose**: Publish the public surface exactly as documented in contracts/file-upload-api.md §1.

- [X] T030 Create `src/lib/components/ui/file-upload/index.ts`: import all 10 parts; re-export short
      names (`Root`, `Dropzone`, `Trigger`, `List`, `Item`, `ItemPreview`, `ItemMetadata`,
      `ItemProgress`, `ItemDelete`, `Clear`) and prefixed aliases (`FileUpload`,
      `FileUploadDropzone`, `FileUploadTrigger`, `FileUploadList`, `FileUploadItem`,
      `FileUploadItemPreview`, `FileUploadItemMetadata`, `FileUploadItemProgress`,
      `FileUploadItemDelete`, `FileUploadClear`); re-export every `…Props` type per part; re-export
      from `./file-upload.svelte.ts`: `useFileUpload` (a thin wrapper around
      `getFileUploadContext('useFileUpload')` returning the `FileUploadRootState`), `formatBytes`,
      `getFileIcon`, `FileUploadRootState`, `FileUploadItemState`, `setFileUploadContext`,
      `getFileUploadContext`, `setFileUploadItemContext`, `getFileUploadItemContext`,
      `FILE_UPLOAD_STATUSES`, and the types `FileUploadFileState`, `FileUploadStatus`,
      `FileUploadUploadOptions`, `FileUploadRootStateProps`, `FileUploadItemStateProps` — matching
      contracts/file-upload-api.md §1 and §6 exactly.
- [X] T031 Run `pnpm run test:unit -- --run` for
      `src/lib/components/ui/file-upload/file-upload.test.ts` and
      `src/lib/components/ui/file-upload/file-upload.test.svelte` one more time now that the barrel
      is final, confirming both the namespace-style (`import * as FileUpload`) and prefixed-style
      (`import { FileUpload, FileUploadItem, ... }`) import forms from contracts §1 resolve without
      error.

**Checkpoint**: The registry-installable public API is complete and fully re-exported.

---

## Phase 7: Demo route

**Purpose**: One documentation page covering every ported upstream demo (Principle IX), per
plan.md's "Demo page sections" table.

- [X] T032 Create `src/routes/docs/components/file-upload/+page.svelte` with a `<svelte:head><title>
      File Upload — svelte-dice-ui</title></svelte:head>`, an intro `<h1>`/description, and one
      `ComponentPreview` section per row of plan.md's demo table, in this order: (1) "Default" —
      `maxFiles=2`, `maxSize` 5 MB, `multiple`, controlled `value` via `$state`, toast reject via
      `svelte-sonner` (mirrors `file-upload-demo.tsx`); (2) "With Validation" — `onFileValidate`
      overriding built-in messages, `accept="image/*"` (mirrors `file-upload-validation-demo.tsx`);
      (3) "Direct Upload" — `onUpload` with a `setTimeout`-simulated chunked progress reporter and
      `variant="linear"` (mirrors `file-upload-direct-upload-demo.tsx`); (4) "Circular Progress" —
      `variant="circular"`, `size={40}`, horizontal `List` orientation, sr-only metadata (mirrors
      `file-upload-circular-progress-demo.tsx`); (5) "Fill Progress" — `variant="fill"` overlay
      (mirrors `file-upload-fill-progress-demo.tsx`); (6) "With Chat Input" — `Dropzone` overlaying a
      `Textarea` composer (mirrors `file-upload-chat-input-demo.tsx`); (7) "With Form" — this
      project's `Field.*` components with hand-written runes validation and a submit handler
      receiving the accepted files, no `zod`/`sveltekit-superforms` dependency added (mirrors
      `file-upload-form-demo.tsx`, per plan.md Assumptions on the missing form-validation library).
      Do not add a section for `file-upload-uploadthing-demo.tsx` — it is out of scope per
      plan.md Complexity Tracking.

**Checkpoint**: Every ported upstream demo except uploadthing has a corresponding, working preview
section.

---

## Phase 8: Registry entry and docs polish

**Purpose**: Finish the registry contract from contracts/file-upload-api.md §8 and make the
placeholder from T003 real.

- [X] T033 Update the `"file-upload"` entry appended in T003 inside `registry.json`: fill `"files"`
      with all 12 non-test files — `index.ts`, `file-upload.svelte.ts`, and the 10 part `.svelte`
      files under `src/lib/components/ui/file-upload/`, each `{ "path": "...", "type": "registry:ui"
      }` — and confirm `registryDependencies: ["direction-provider"]` and
      `dependencies: ["@lucide/svelte"]` remain correct; do **not** list
      `file-upload.test.ts` or `file-upload.test.svelte`.
- [X] T034 Run `pnpm run registry:build` and confirm the generated output for `file-upload` lands
      under `static/r/` with `$lib/...` imports rewritten to registry placeholders, matching the
      pattern of the other already-built registry items.

**Checkpoint**: The component is installable through the registry exactly like every other ported
component (SC-006).

---

## Phase 9: Verification (MANDATORY — Constitution Principle VII)

**Purpose**: The feature is not complete until all four gates are green. No suppressions
(`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`,
deleted assertions, loosened configs) may be used to reach green — fix the root cause.

- [X] T035 Run `pnpm run format`, then `pnpm run check`, `pnpm run lint`,
      `pnpm run test:unit -- --run` and `pnpm run build`, and fix everything that fails.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Tests (Phase 2)**: Depends on Setup (needs the empty directories from T002); BLOCKS all
  implementation — every test must be written and confirmed red (T015) before Phase 3 starts.
- **Core: root-level parts (Phase 3)**: Depends on Phase 2 (tests exist); T016 (state module)
  blocks T017–T020 (all parts read the state module's types/context).
- **Core: item parts (Phase 4)**: Depends on Phase 3 (T017 Root and T022 Item's context both come
  from `file-upload.svelte.ts`, already available after T016; T021 List and T022 Item depend on
  T016 only, but T023–T025 depend on T022's item context being defined).
- **Core: validation/progress (Phase 5)**: Depends on Phase 4 (US2/US3 build on the same
  `FileUploadRootState`/`FileUploadItemState` and item markup).
- **Barrel and types (Phase 6)**: Depends on Phase 5 — every part and the state module must exist
  before the barrel can import and re-export them.
- **Demo route (Phase 7)**: Depends on Phase 6 — the demo imports the barrel only.
- **Registry entry and docs polish (Phase 8)**: Depends on Phase 6 (file list is final) and
  benefits from Phase 7 existing, but does not import it — the registry only lists source files.
- **Verification (Phase 9)**: Depends on everything above — the last phase, always run.

### Within Phase 3–5 (file-level dependencies)

- T016 (`file-upload.svelte.ts`) blocks every other task in Phases 3–5 — every part imports its
  types/context/state classes.
- T017 (Root) must exist before T018–T020 can be exercised in a real tree, though all four can be
  authored once T016 lands; T019 and T020 touch different files from each other and from T017/T018,
  so they are marked `[P]`.
- T021 (List) and T022 (Item) both depend on T016 only and touch different files, but T022 must
  land before T023–T025 (they read `getFileUploadItemContext`, established by T022's
  `setFileUploadItemContext` call at runtime, though the context module itself is defined in T016).
- T023, T024, T025 touch three different files with no interdependency — marked `[P]`.
- T026 and T027 touch different files (`file-upload.svelte.ts` vs.
  `file-upload-item-progress.svelte`) but are sequenced (not `[P]`) because T027's rendering depends
  on the progress fields T026 guarantees are correct.

### Parallel Opportunities

- T003 (registry stub) can run in parallel with the rest of Setup once T002's directories exist.
- T009, T010, T011, T012 (RTL, guard rails, previews/metadata, snippets test groups) are independent
  assertions within the same file and are marked `[P]` for authoring order flexibility, but all
  edits land in the single file `file-upload.test.ts` sequentially in practice.
- T019 and T020 (Trigger, Clear) — different files, both depend only on T016/T017.
- T023, T024, T025 (ItemPreview, ItemMetadata, ItemDelete) — three different files, all depend only
  on T022.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete the US1-relevant slice of Phase 2 (T004–T012, T015).
3. Complete Phase 3 and Phase 4 in full (all US1 parts).
4. Complete Phase 6 (barrel) and Phase 7's "Default" demo section only.
5. **STOP and VALIDATE**: exercise the Independent Test from spec.md User Story 1 — select via
   dialog/drag/paste, preview, delete, clear — before adding US2/US3.

### Incremental Delivery

1. Setup + Tests (US1 slice) + Core (Phases 3–4) → MVP (selection/preview/removal) ready.
2. Add US2 tests (T013) + T026 → validation constraints land, independently testable per spec.md
   User Story 2's Independent Test.
3. Add US3 tests (T014) + T027–T028 → progress tracking lands, independently testable per spec.md
   User Story 3's Independent Test.
4. Finish Phase 6 (full barrel) → Phase 7 (remaining demo sections) → Phase 8 (registry) → Phase 9
   (verification gates).

---

## Phase 10: Convergence

**Purpose**: Close the gaps found by `/speckit-converge` between the implemented port and its spec,
plan and contracts. The component itself is complete and every gate is green (`format`, `check` — 0
errors, `lint` — clean, `test:unit -- --run` — 2820 passing, `build` — ok); all 10 parts, the state
module, the barrel, the 7 demo sections, the 10 API tables and the 12-file `registry.json` entry
(plus `static/r/file-upload.json`) exist and match `contracts/file-upload-api.md`. What remains is
documented public surface with **no assertion behind it**, which SC-002 does not permit ("100% of the
documented upstream props, callbacks, data attributes, ARIA roles/states, and keyboard interactions
for every part are reproduced **and covered by automated tests**").

No application code under `src/lib/components/ui/file-upload/*.svelte` or `file-upload.svelte.ts`
needs to change for any task below: every one is an addition to
`src/lib/components/ui/file-upload/file-upload.test.ts` (with, where noted, a prop or probe added to
the non-registry harness `file-upload.test.svelte`). Several of the harness props these tasks need
(`metadataSize`, `name`, `required`, `multiple`, `progressInPreview`) already exist and are currently
unused by any spec.

- [X] T036 Cover `useFileUpload()` in `src/lib/components/ui/file-upload/file-upload.test.ts` per
      contracts §6 / plan.md "Non-component exports" / FR-016 (missing): add a small probe component
      (or a harness mode) that calls `useFileUpload()` inside `<FileUpload.Root>` and renders
      `files`, `entries`, `count`, `dragOver` and `invalidState`; assert each reflects the root's
      state (count after a selection, `dragOver` after `dragenter`, `invalidState` during the
      rejection flash), and assert that calling it outside `<FileUpload.Root>` throws
      `/`<FileUpload.useFileUpload>` must be used within/`. Also assert `FileUploadRootState.setFiles`
      replaces membership and prunes stale status entries (data-model.md §2), which no spec exercises
      today.
- [X] T037 Assert the hidden `<input type="file">` carries the native form-participation attributes
      per FR-002 and contracts §2 "Root" (missing): render the harness with `name`, `required`,
      `multiple` and `accept` set and assert the input has `name`, the `required` attribute, the
      `multiple` attribute, the `accept` string, `type="file"`, `tabindex="-1"` and the `sr-only`
      class — and that `disabled` on the root disables the input. `multiple`, `required` and `name`
      currently have zero assertions anywhere in the suite even though the harness already forwards
      them.
- [X] T038 Assert the documented callback order for a processed batch per FR-003 and plan.md "Public
      API" → Root (missing): with `onFileValidate`, `onFileReject`, `onValueChange`, `onAccept`,
      `onFileAccept` and `onUpload` all supplied and recording into one shared call log, select a
      mixed valid/invalid batch and assert the log order is `onFileValidate` (per file) →
      `onFileReject` (per rejected file) → `onValueChange` → `onAccept` → `onFileAccept` (per
      accepted file) → `onUpload` (after a frame flush). The existing mixed-batch spec asserts *that*
      each fired, never the order FR-003 mandates.
- [X] T039 Cover `FileUpload.ItemMetadata`'s `size="sm"` prop per contracts §2 "ItemMetadata" and
      plan.md "Public API" (missing): render the harness with the existing but unused `metadataSize:
      'sm'` prop and assert the name span swaps `font-medium text-sm` for
      `font-normal text-[13px] leading-snug` and the size span swaps `text-xs` for
      `text-[11px] leading-snug`, while `size="default"` keeps the default pair. The "With Chat
      Input" demo section depends on this variant.
- [X] T040 Complete the circular-progress geometry assertions per quickstart.md S4.5 ("asserting
      `stroke-dashoffset`") and contracts §2 "ItemProgress" (partial): the current circular spec
      asserts only `width` and `r`, so extend it to assert `stroke-dasharray === 2πr` and
      `stroke-dashoffset === 2πr − (progress / 100) · 2πr` at a reported progress, and run it once
      with a **non-default** `size` (e.g. `size={64}` → `r === 30`) so the `size` prop is proved to be
      applied rather than coinciding with its default of `40`.
- [X] T041 Cover the pass-through event-handler contract per plan.md "Public API" → Dropzone
      ("each invoked before the internal behaviour and skipped when the caller calls
      `preventDefault()`") and the `onclick` pass-through on Trigger, ItemDelete and Clear (missing):
      for each of `onclick`, `ondragenter`, `ondragover`, `ondragleave`, `ondrop`, `onpaste` and
      `onkeydown` on the dropzone, assert the caller's handler runs first, and that a handler calling
      `event.preventDefault()` suppresses the internal behaviour (no dialog open, no `data-dragging`
      change, no files added); do the same for Trigger (no dialog), ItemDelete (file stays) and Clear
      (list stays). The "With Chat Input" demo relies on exactly this suppression
      (`onclick={(event) => event.preventDefault()}` on its overlay dropzone).
- [X] T042 Assert `FileUpload.ItemPreview` renders its `children` **after** the preview content per
      contracts §2 "ItemPreview" (missing): use the harness's existing but unused `progressInPreview`
      prop to nest `ItemProgress` inside `ItemPreview` and assert the `<img>`/icon precedes the
      `[data-slot="file-upload-progress"]` element in DOM order — the ordering the "Circular
      Progress", "Fill Progress" and "With Chat Input" demo sections depend on.
- [X] T043 Assert `Shift + Tab` moves focus out of the dropzone per contracts §4, the upstream MDX
      "Keyboard Interactions" table and the keyboard table rendered on
      `src/routes/docs/components/file-upload/+page.svelte` (missing): focus the trigger, press
      `Shift+Tab` to reach the dropzone, press `Shift+Tab` again and assert focus has left the
      component without opening the file dialog (spy on the hidden input's `click`).
- [X] T044 Assert every item-scoped part renders nothing when its file is absent from the current set
      per contracts §2 (Item: "Renders nothing when its `value` is not in the current file set") and
      the same `fileState`-guard on ItemPreview / ItemMetadata / ItemProgress / ItemDelete (missing):
      render an `<FileUpload.Item value={strayFile}>` whose `File` is not in the root's value and
      assert no `role="listitem"`, no `[data-slot="file-upload-preview"]`,
      `…-metadata`, `…-progress` or `…-item-delete` element is produced, and that no status `<span>`
      is emitted for it.
- [X] T045 Re-run the full gate sequence — `pnpm run format`, `pnpm run check`, `pnpm run lint`,
      `pnpm run test:unit -- --run`, `pnpm run build` — after T036–T044 and fix anything that fails
      without suppressing it (Constitution Principle VII; no `@ts-ignore`, `@ts-expect-error`,
      `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo` or loosened config).

**Checkpoint**: Every prop, callback, keyboard interaction and rendering guard documented in
`contracts/file-upload-api.md`, `plan.md` and `quickstart.md` has at least one assertion behind it,
satisfying SC-002.
