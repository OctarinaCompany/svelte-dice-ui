# Feature Specification: File Upload

**Feature Branch**: `034-port-file-upload`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"File Upload\" (slug: file-upload) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Select and preview files before upload (Priority: P1)

A person filling out a form needs to attach one or more files. They open the file picker either by
clicking/tapping a dropzone or a dedicated "Browse files" trigger, by dragging files from their
desktop onto the dropzone, or by pasting files from their clipboard. Each accepted file appears in a
list with a preview (an image thumbnail or a file-type icon), its name and size, and a control to
remove it before submission.

**Why this priority**: This is the baseline capability of the component — without selection and
preview, nothing else in the component has meaning. It must work standalone as the MVP.

**Independent Test**: Render `FileUpload` with a dropzone, trigger, list and item parts (no
`onUpload`); select files via the native file dialog; verify each selected file renders as a list
item with name, formatted size and a working delete button, and that dropping/pasting files produces
the same result.

**Acceptance Scenarios**:

1. **Given** an empty file upload with a dropzone and trigger, **When** the user clicks the dropzone
   (outside the trigger) or the trigger button, **Then** the native file selection dialog opens.
2. **Given** the file selection dialog is open, **When** the user picks one or more files, **Then**
   each file is added to the list, rendered with a preview, its name, and its formatted size (bytes /
   KB / MB / GB / TB).
3. **Given** files are listed, **When** the user activates a file's delete control, **Then** that
   file is removed from the list and any object URL created for its preview is released.
4. **Given** at least one file is listed, **When** the user activates the "clear all" control,
   **Then** every file is removed and the list is hidden again (unless it is set to stay mounted).
5. **Given** the dropzone is focused, **When** the user drags a native OS file over it, **Then** the
   dropzone visually indicates the drag-over state; **When** the files are dropped, **Then** they are
   processed exactly like a dialog selection and the drag-over indicator clears.
6. **Given** the dropzone is focused, **When** the user pastes files from the clipboard, **Then**
   they are processed exactly like a dialog selection.

---

### User Story 2 - Constrain and validate what can be uploaded (Priority: P2)

A developer integrating the component needs to cap the number of files, cap file size, restrict file
types, and apply custom validation rules (e.g. "no more than 2 images"), giving the end user clear,
specific feedback when a file is rejected instead of it silently disappearing or silently succeeding.

**Why this priority**: Constraints are what make the component usable in a real form; without them
every upload is accepted unconditionally, which is unsafe for most real integrations. It builds
directly on User Story 1's selection/preview flow.

**Independent Test**: Configure `maxFiles`, `maxSize`, `accept` and a custom validation callback;
attempt to add files that individually violate each rule; verify each violation fires a rejection
callback with a specific, rule-appropriate message and the offending file never appears in the list,
while a compliant file in the same batch is still accepted.

**Acceptance Scenarios**:

1. **Given** `maxFiles` is set and the list is already at capacity, **When** the user adds more
   files, **Then** the excess files are rejected with a "maximum files allowed" message and the
   dropzone briefly enters an invalid state.
2. **Given** `accept` restricts file types, **When** the user adds a file whose MIME type or
   extension does not match, **Then** it is rejected with a "file type not accepted" message.
3. **Given** `maxSize` is set, **When** the user adds a file larger than the limit, **Then** it is
   rejected with a "file too large" message.
4. **Given** a custom file-validation callback is supplied, **When** it returns a message for a
   file, **Then** that file is rejected with the returned message instead of the default one, and
   the callback's decision overrides the built-in checks' wording.
5. **Given** a batch contains both valid and invalid files, **When** the batch is processed, **Then**
   valid files are accepted and added while invalid files are rejected individually, each with its
   own reason.

---

### User Story 3 - Track and display upload progress (Priority: P3)

An application that actually transmits files to a server needs to show per-file upload progress,
distinguish files that are queued, uploading, failed or complete, and let the consumer supply their
own transport (any async function) without the component prescribing a specific backend or upload
service.

**Why this priority**: Progress/status tracking is additive polish over selection and validation —
useful for real uploads, but the component is fully usable (e.g. attaching files to a form submitted
some other way) without it.

**Independent Test**: Supply an `onUpload` callback that reports progress asynchronously (e.g. via a
timer) for a set of selected files; verify each file's progress indicator (linear, circular, or fill
variant) updates as progress is reported, the file transitions to a success or error state
appropriately, and the same behaviour is reachable with zero real network activity (transport is
fully consumer-supplied).

**Acceptance Scenarios**:

1. **Given** an `onUpload` callback is supplied, **When** files are accepted, **Then** the callback
   is invoked with the accepted files and progress/success/error reporting functions, and each file's
   status moves from idle to uploading.
2. **Given** the upload callback reports progress for a file, **When** progress updates arrive,
   **Then** the file's progress indicator (whichever variant is rendered — linear bar, circular ring,
   or fill overlay) reflects the latest percentage, each exposing the same underlying value through
   its own visual form.
3. **Given** the upload callback reports success for a file, **When** success is reported, **Then**
   the file's progress indicator reaches 100% and, unless told to stay mounted, is no longer shown.
4. **Given** the upload callback reports (or throws) an error for a file, **When** the error is
   reported, **Then** the file's status becomes "error" and its error message is displayed in the
   file's metadata.
5. **Given** no `onUpload` callback is supplied, **When** files are accepted, **Then** they are
   marked successful immediately (no progress phase) so the component is fully usable for
   selection-only scenarios.

### Edge Cases

- Selecting zero files from the native dialog (user cancels) leaves the list unchanged and fires no
  callbacks.
- Removing a file mid-upload cancels its visual progress and releases its preview URL, without
  throwing even if the consumer's `onUpload` promise for that file later resolves or rejects.
- Passing `multiple={false}` (or omitting it, since it defaults to false) with the native dialog set
  to single-selection still accepts a drag-and-drop or paste batch of more than one file; each is
  validated independently against the current constraints (a single-select consumer is expected to
  also set `maxFiles={1}` to enforce a single accepted file).
- Reusing the exact same `File` object (by reference) already present in the list is a no-op for
  display purposes; the underlying `Map` keys files by reference, so a genuinely re-picked file
  (a new `File` instance) with identical name/size is treated as a distinct entry.
- `disabled` suppresses the dialog, drag-and-drop, paste and keyboard activation on the dropzone,
  trigger, delete and clear controls, while previously listed files remain visible.
- Under `dir="rtl"`, the dropzone, list and item layouts mirror horizontally; no keyboard interaction
  in this component is direction-sensitive (there is no arrow-key navigation), so only visual
  mirroring is affected.
- Rendering `FileUploadList`/`FileUploadClear` before any file exists and without `forceMount`
  produces no DOM for that part, so consumers relying on `forceMount` for transition testing must
  opt in explicitly.
- A rejected file batch that fully empties the incoming selection (every file rejected) still clears
  the native `<input>`'s value so the same file can be re-selected immediately afterward.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST provide a root that manages the list of selected files, in both an
  uncontrolled mode (internal state, seeded by an initial value) and a controlled mode (an external
  value plus a change callback that fires on every addition and removal).
- **FR-002**: The root MUST accept and apply `accept` (comma-separated MIME types/extensions/wildcard
  patterns), `maxFiles`, `maxSize` (bytes), `multiple`, `disabled`, `required`, and a `name` for
  native form participation via a hidden file input.
- **FR-003**: The root MUST expose `onFileValidate` (per-file custom validation returning a rejection
  message or nothing), `onFileAccept` (per accepted file), `onFileReject` (per rejected file, with
  message), and `onAccept` (the whole accepted batch) callbacks, invoked in that logical order for
  every processed batch.
- **FR-004**: The root MUST expose an `onUpload` callback that receives the accepted files together
  with `onProgress`, `onSuccess`, and `onError` reporting functions; the component MUST NOT implement
  or assume any specific upload transport, storage provider, or third-party upload service — the
  consumer supplies the transport entirely.
- **FR-005**: When no `onUpload` callback is supplied, accepted files MUST be marked successful
  immediately so the component is fully functional as a selection-only control.
- **FR-006**: The dropzone MUST be a real, independently focusable, keyboard-operable control:
  `Tab` reaches it, `Enter` and `Space` open the native file dialog while it is focused, and it is
  never drag-only. Clicking it also opens the dialog unless the click originated from a nested
  trigger control (to avoid opening the dialog twice).
- **FR-007**: The dropzone MUST support drag-and-drop (drag-enter/over/leave/drop) and clipboard
  paste of files, routing both through the same acceptance/validation pipeline as the native dialog,
  and MUST expose its current drag-over and invalid states for styling.
- **FR-008**: A separate trigger control MUST be available that opens the native file dialog on
  click and is independently focusable, disableable, and composable inside the dropzone or elsewhere
  in the tree without double-triggering the dropzone's own click handler.
- **FR-009**: A list container MUST render only when at least one file is present, unless told to
  stay mounted, and MUST support both vertical and horizontal orientation.
- **FR-010**: Each file MUST be represented by an item that exposes, to assistive technology, its
  position and set size among sibling files, an accessible name derived from the file's name, and a
  live status description (ready, uploading with percentage, complete, or error with message).
- **FR-011**: An item preview part MUST render an image thumbnail for image files and an
  appropriate file-type icon (video, audio, text/document, code, archive, executable/binary, or
  generic) for every other file, based on MIME type and, as a fallback, file extension.
- **FR-012**: An item metadata part MUST display the file's name and a human-readable size
  (bytes/KB/MB/GB/TB, matching upstream's rounding), and MUST display the file's rejection/error
  message when one is present.
- **FR-013**: An item progress part MUST reflect the file's current upload percentage and MUST be
  offered in three visual forms — a linear bar, a circular ring, and a fill overlay — all driven by
  the same underlying progress value, and MUST hide itself once the file reaches 100% unless told to
  stay mounted.
- **FR-014**: An item delete control MUST remove exactly its own file from the list, release any
  preview resource associated with it, and participate in the controlled/uncontrolled change
  notification the same way the root's other mutations do.
- **FR-015**: A clear-all control MUST remove every file, release every preview resource, and MUST
  render only when at least one file is present, unless told to stay mounted; it MUST also honor the
  root's `disabled` state.
- **FR-016**: Every part MUST be usable only within its required ancestor (dropzone/trigger/list/
  item/clear within the root; preview/metadata/progress/delete within an item) and MUST throw a
  descriptive error identifying both the part and the missing ancestor when used outside it.
- **FR-017**: The whole component tree MUST support right-to-left layouts: an explicit direction may
  be supplied, or it is inherited from the project's existing direction/locale context, and layout
  mirrors accordingly.
- **FR-018**: The component MUST be distributed as installable source under the project's UI
  component directory with an index barrel exporting every part, and registered in the project's
  component registry exactly like the other ported components.
- **FR-019**: A documentation page MUST exist demonstrating: default selection/preview, per-file
  validation with rejection feedback, direct upload with consumer-supplied progress simulation,
  circular progress, fill progress, and controlled usage bound to external state — covering every
  upstream example except the uploadthing-specific integration (excluded per Assumptions).

### Key Entities

- **Uploaded File Entry**: A single selected `File` paired with its upload status (idle, uploading,
  success, error), current progress percentage, and an optional rejection/error message. Identity is
  the file reference itself.
- **File Upload Constraints**: The configuration applied to every incoming batch — accepted
  type patterns, maximum file count, maximum file size, and an optional custom validation rule.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can select, preview, and remove a file using only the keyboard (no mouse),
  reaching every interactive control (dropzone, trigger, per-item delete, clear-all) via `Tab`
  and activating each with `Enter`/`Space`.
- **SC-002**: 100% of the documented upstream props, callbacks, data attributes, ARIA roles/states,
  and keyboard interactions for every part are reproduced and covered by automated tests, except the
  deliberate divergences recorded under Assumptions.
- **SC-003**: Files that violate a configured constraint (count, size, type, or custom rule) are
  never added to the visible list, and the specific reason is observable by the consumer for 100% of
  rejected files in a mixed valid/invalid batch.
- **SC-004**: Per-file upload progress reported by a consumer-supplied callback is reflected in the
  UI within one animation frame of each report, across all three progress presentation variants.
- **SC-005**: The component renders and behaves correctly under `dir="rtl"` with no visual overlap
  or misaligned controls, verified on the demo page.
- **SC-006**: The component is installable through the project's registry and appears in the docs
  index alongside every other ported component, with zero manual post-install edits required beyond
  what the registry CLI performs for any other component.

## Assumptions _(mandatory)_

- Upstream ships this component under the "radix" base (`docs/registry/bases/radix/ui/file-upload.tsx`)
  and depends on `radix-ui`'s `Direction` primitive purely for direction inheritance and on a
  `Slot`-based `asChild` for polymorphism. This project has no Radix dependency; direction inheritance
  is instead read from the project's existing direction/RTL context (the same one other ported
  components use), and `asChild`/`Slot` is replaced by the project's established `child` snippet
  pattern (per CLAUDE.md §10), because Svelte 5 has no `React.cloneElement`-equivalent primitive.
- Upstream's `useSyncExternalStore`-backed reducer/store (`StoreContext`, `useStore`) is an
  implementation detail that exists in React to get fine-grained, non-re-rendering selector
  subscriptions; it is replaced by a `FileUploadState` rune class in `file-upload.svelte.ts` holding
  a `SvelteMap<File, FileState>` plus `dragOver`/`invalid` state, since Svelte's fine-grained
  reactivity makes the external-store indirection unnecessary. The public callback/prop contract
  (`onValueChange`, `onAccept`, `onFileAccept`, `onFileReject`, `onFileValidate`, `onUpload`) is
  preserved unchanged.
- `useId()` for the root's `inputId`/`dropzoneId`/`listId`/`labelId` and per-item ids is replaced by
  Svelte's `$props.id()` helper (per CLAUDE.md §10), keeping the same `aria-*`/`id` wiring upstream
  documents.
- The upload transport stays entirely consumer-supplied via the `onUpload` callback and its
  `onProgress`/`onSuccess`/`onError` reporters, exactly as upstream defines it. Upstream's
  uploadthing-specific example (`file-upload-uploadthing-demo.tsx`) wires a third-party upload
  service and is explicitly NOT ported; every other upstream example (default, validation, direct
  upload, circular progress, fill progress, chat input, form) is ported using the same
  callback-only transport, with the "direct upload" and "chat input" demos simulating progress with
  a timer exactly as upstream's own demo does (no real network call in either upstream or here).
  This is a deliberate scope boundary, not a missing feature: nothing about wiring a real backend
  changes if a consumer swaps the demo's `setTimeout` simulation for a `fetch` call.
- Upstream's `getFileIcon` MIME/extension-based icon selection (video/audio/text/code/archive/
  binary/generic) is reproduced using this project's existing `@lucide/svelte` icon set (the same
  icon names upstream uses from `lucide-react`), since both libraries expose the same Lucide icon
  set under matching names.
- Object URL creation/revocation for image previews (`URL.createObjectURL`/`URL.revokeObjectURL`,
  cached per-file in a `WeakMap`) is reproduced identically, since it is plain Web API usage with no
  React- or Radix-specific dependency; it is cached inside the `FileUploadState` class instead of a
  context-provided `WeakMap`.
- Upstream's `FileUploadItemProgress` `variant` prop (`"linear" | "circular" | "fill"`) and `size`
  (circular diameter) are preserved unchanged as the mechanism for choosing a progress presentation,
  rather than three separate components, matching upstream's own API surface exactly.
- The hidden native `<input type="file">` remains part of the root's rendered output (visually
  hidden via the existing `sr-only` utility already used elsewhere in this repo) so native form
  submission (`name`, `required`) keeps working without extra wiring, matching upstream.
- Only the "radix" base variant is ported (there is no separate "base"/non-Radix file-upload
  variant upstream), consistent with the vendored source found under `.reference/diceui`.
- Dropped and pasted files are handed directly to the root's acceptance pipeline instead of being
  written back into the hidden `<input type="file">` via a synthetic `DataTransfer` + `change` event
  as upstream does. `new DataTransfer()` is unimplemented in jsdom (making that round-trip
  untestable here) and assigning `input.files` is unsupported in older Safari; the direct call is
  observably identical — same validation order, same callbacks, same `data-invalid` flash. The
  hidden input is still rendered and still used for the native dialog path and for form submission.
- Upstream's `FileUploadItemPreview` `render` prop is a callback
  `(file, fallback: () => ReactNode) => ReactNode`. Svelte snippets cannot return values, so it
  becomes `render?: Snippet<[{ file: File; fallback: Snippet }]>` — the caller renders
  `{@render fallback()}` to keep the default preview and decorate around it. The capability
  (override or wrap the default preview) is unchanged.
- `FileUpload.Item` additionally exposes `data-status="idle|uploading|success|error"`, which
  upstream does not emit. Upstream surfaces status only through screen-reader-only text, which
  cannot be styled; this project requires every piece of component state to be exposed as a
  `data-*` attribute. This is an addition — no upstream attribute is renamed or removed.
- The item's `aria-describedby` is built by joining the present id tokens rather than by upstream's
  template literal, which emits a trailing space when the file has no error message. The IDREF list
  is semantically identical; only the stray whitespace is dropped.
- The "With Form" example is rebuilt on this project's `Field.*` components with runes state and a
  hand-written submit validation, because the repo has no `react-hook-form`/`zod` equivalent
  installed (no `formsnap`, `sveltekit-superforms` or `zod`) and no new dependency may be added.
  The demonstrated flow — required file field, validation message, submit handler receiving the
  files — is unchanged.
