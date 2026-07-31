# Implementation Plan: File Upload

**Branch**: `034-port-file-upload` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/034-port-file-upload/spec.md`

## Summary

Port Dice UI's `file-upload` (radix base) to Svelte 5 as ten compound parts under
`src/lib/components/ui/file-upload/`, plus a runes state module, a colocated test suite, a demo route
and one `registry:ui` entry.

Technical approach: `value: File[]` (bindable, `defaultValue`-seeded) is the single source of truth for
**membership and order**; a `SvelteMap<File, FileUploadFileState>` sidecar inside a `FileUploadRootState`
class holds only per-file **status metadata** (status, progress, error) and is written exclusively from
imperative actions — never from an `$effect` — so upstream's `useSyncExternalStore` reducer collapses to
plain rune reactivity with no synchronisation effect at all. Everything else is a mechanical translation:
React context → `Symbol`-keyed context with throwing getters, `asChild`/`Slot` → the repo's `child` snippet,
`useId()` → `$props.id()`, `useDirection` → the existing `direction-provider` module, `useEffect` cleanup →
`$effect` teardown. Zero new npm dependencies.

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`), Svelte 5.56 with runes forced on

**Primary Dependencies**: SvelteKit 2, Tailwind CSS v4, `@lucide/svelte` (icons — already installed),
`svelte/reactivity` (`SvelteMap`), the in-repo `direction-provider` component. **No `bits-ui` primitive is
used by this component** (justified below). **Zero new npm dependencies.**

**Storage**: N/A — all state is in-memory (`File` objects + a `WeakMap<File, string>` object-URL cache)

**Testing**: Vitest 4 (jsdom, `globals: false`, `expect.requireAssertions`) + `@testing-library/svelte` 5 +
`@testing-library/user-event` 14; a non-collected `file-upload.test.svelte` harness composes the parts

**Target Platform**: Browsers with `File` / `DataTransfer` / `URL.createObjectURL`; SSR-safe — no DOM access
during initialisation, because object URLs are created lazily in the preview part's render path

**Project Type**: shadcn-svelte registry component (source-distributed UI library) + SvelteKit docs site

**Performance Goals**: progress reporting coalesced to at most one state write per animation frame
(upstream's `requestAnimationFrame` guard, preserved); no per-file DOM measurement or observers

**Constraints**: no `any`, no suppression comments, semantic Tailwind tokens only, one part per file,
`.js`-suffixed intra-repo imports, no import from `src/routes/**` or `src/lib/components/docs/**`

**Scale/Scope**: 10 part components + 1 state module + 1 barrel + 1 test file (+1 test harness) + 1 demo
route with 7 preview sections and 10 API tables + 1 registry entry

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict   | Evidence                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ----------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I    | Svelte 5 Runes Only                 | PASS      | `$state`/`$derived`/`$props`/`$bindable`/`$effect` + snippets only; behaviour in `file-upload.svelte.ts` as `FileUploadRootState` / `FileUploadItemState`, reactive inputs passed as getters. No stores, no `export let`, no `createEventDispatcher`, no `<slot>`.                                                                                                                 |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS      | `docs/registry/bases/radix/ui/file-upload.tsx` (1414 lines), `docs/content/docs/components/radix/file-upload.mdx` and all 8 `file-upload-*-demo.tsx` read at the pinned commit; every prop, callback, data attribute, ARIA wiring and key is reproduced (see **Public API**); each divergence is recorded in the spec's Assumptions.                                                |
| III  | Accessibility Is a MUST             | PASS      | `role="region"` dropzone with `tabindex="0"` + Enter/Space, `role="list"`/`role="listitem"` with `aria-setsize`/`aria-posinset`, `role="progressbar"` with `aria-valuenow`/`aria-valuetext`, sr-only live status text, `dir` mirrored on root/dropzone/list/item; the test matrix below covers roles, names, keyboard, RTL, controlled, uncontrolled, guard rails, provider errors. |
| IV   | Composition Over Reimplementation   | PASS      | `direction-provider` (existing UI component) composed for RTL; `cn()` for classes; bespoke logic limited to the drag/paste/validation pipeline and the progress variants, justified below.                                                                                                                                                                                        |
| V    | shadcn-svelte Distribution Model    | PASS      | One folder, one part per file, `file-upload.svelte.ts`, `index.ts` barrel with short names + prefixed aliases + types, one `registry:ui` entry listing all 12 non-test files, `.js` imports, no docs imports.                                                                                                                                                                     |
| VI   | TypeScript Strict, No Suppressions  | PASS      | Props typed from `WithElementRef<HTMLAttributes<…>>`; `File`, `FileList`, `DataTransfer`, `ClipboardEvent` are all well-typed DOM types — no `any`, no ignore comments, no config edits.                                                                                                                                                                                          |
| VII  | Green Gate Before Commit            | PASS      | `format` → `check` → `lint` → `test:unit --run` → `build` scheduled as the final task; no `.skip`/`.todo`.                                                                                                                                                                                                                                                                       |
| VIII | Styling Discipline                  | PASS      | Upstream classes are already token-based (`bg-accent/30`, `border-destructive`, `bg-primary/20`, `text-muted-foreground`) and carry over unchanged; `data-slot` on all 10 parts; `data-disabled`/`data-dragging`/`data-invalid`/`data-orientation`/`data-state`/`data-status` written `cond ? '' : undefined`; caller `class` merged last.                                         |
| IX   | Every Component Is Documented       | VIOLATION | 7 of 8 upstream demos ported (default, validation, direct upload, circular progress, fill progress, chat input, form). `file-upload-uploadthing-demo.tsx` is **not** ported — recorded in Complexity Tracking and in the spec's Assumptions.                                                                                                                                       |
| X    | One Feature Directory Per Component | PASS      | All artifacts written under `specs/034-port-file-upload/`; no git write commands run; `.reference/`, `scripts/`, `.port-*` untouched.                                                                                                                                                                                                                                            |

**Bespoke behaviour justification (Principle IV)**:

1. **Drag-and-drop / clipboard-paste file intake on the dropzone.** Evaluated `bits-ui@2.18.1` — it ships no
   file-upload, dropzone or file-intake primitive of any kind (its surface is menus, dialogs, popovers,
   selects, sliders and their helpers), and no component under `src/lib/components/ui/*` handles a `DragEvent`
   or a `ClipboardEvent`. The four drag handlers, the `relatedTarget`-containment check on `dragleave`, and
   the clipboard `items` walk are therefore written by hand, translated one-for-one from upstream.
2. **The validation / acceptance pipeline** (`maxFiles` slot arithmetic, `accept` MIME + extension + `*/*`
   wildcard matching, `maxSize`, `onFileValidate` precedence, 2000 ms invalid flash). No primitive exists for
   this; it is the component's own domain logic and is ported branch-for-branch from upstream.
3. **The progress presentation variants** (`linear` / `circular` / `fill`). `$lib/components/ui/progress`
   (bits-ui `Progress`) covers only the linear bar and would introduce a second `role="progressbar"` element
   with its own `data-slot`, breaking upstream's single-element contract and its `aria-labelledby={nameId}`
   wiring; `$lib/components/ui/circular-progress` renders its own `<svg>` geometry with a different
   stroke/track API than upstream's `(size - 4) / 2` radius and `-rotate-90` transform, so composing it would
   change the rendered geometry. Both are rejected in favour of upstream's markup, which is ~20 lines of SVG
   and one `clip-path`.
4. **`FileUploadRootState`** replaces upstream's `useSyncExternalStore` store; that store exists only to
   avoid React re-renders and has no Svelte counterpart to compose (research R-02).

Everything else is composed: RTL from `direction-provider`, class merging from `cn()`, icons from
`@lucide/svelte`, and the demo page from `button`, `textarea`, `field`, `table` and `svelte-sonner`.

## Project Structure

### Documentation (this feature)

```text
specs/034-port-file-upload/
├── plan.md                  # This file (/speckit-plan output)
├── research.md              # Phase 0 output
├── data-model.md            # Phase 1 output
├── quickstart.md            # Phase 1 output
├── contracts/
│   └── file-upload-api.md   # Phase 1 output — exported surface, data attributes, ARIA, keyboard
├── checklists/
│   └── requirements.md      # from /speckit-specify
└── tasks.md                 # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/file-upload/
├── index.ts                            # barrel: short names + prefixed aliases + prop types + state exports
├── file-upload.svelte.ts               # FileUploadRootState, FileUploadItemState, Symbol contexts,
│                                       #   formatBytes(), getFileIcon(), FileUploadFileState type
├── file-upload.svelte                  # Root         ← FileUpload             (upstream L212)
├── file-upload-dropzone.svelte         # Dropzone     ← FileUploadDropzone     (upstream L681)
├── file-upload-trigger.svelte          # Trigger      ← FileUploadTrigger      (upstream L887)
├── file-upload-list.svelte             # List         ← FileUploadList         (upstream L928)
├── file-upload-item.svelte             # Item         ← FileUploadItem         (upstream L989)
├── file-upload-item-preview.svelte     # ItemPreview  ← FileUploadItemPreview  (upstream L1063)
├── file-upload-item-metadata.svelte    # ItemMetadata ← FileUploadItemMetadata (upstream L1125)
├── file-upload-item-progress.svelte    # ItemProgress ← FileUploadItemProgress (upstream L1188)
├── file-upload-item-delete.svelte      # ItemDelete   ← FileUploadItemDelete   (upstream L1315)
├── file-upload-clear.svelte            # Clear        ← FileUploadClear        (upstream L1356)
├── file-upload.test.svelte             # test-only harness composing all parts (NOT in registry.json)
└── file-upload.test.ts                 # colocated tests                       (NOT in registry.json)

src/routes/docs/components/file-upload/
└── +page.svelte                        # 7 <ComponentPreview> sections + 10 API tables

registry.json                           # append exactly one registry:ui entry named "file-upload"
```

**Structure Decision**: Every part maps 1:1 to an upstream export in
`.reference/diceui/docs/registry/bases/radix/ui/file-upload.tsx` (line numbers above). Upstream's
module-scope helpers `formatBytes` (L32) and `getFileIcon` (L39) and its two React contexts (L126
`StoreContext` + L170 `FileUploadContext`, merged into one root context here — research R-03) land in
`file-upload.svelte.ts`. Folder slug `file-upload` == demo route segment
`src/routes/docs/components/file-upload` == registry item name `"file-upload"`.

## Public API

Derived from upstream `file-upload.tsx` and `file-upload.mdx`. Every part additionally accepts
`ref` (bindable, default `null`), `class`, a `child` snippet, and spreads `...restProps` onto its element.
"Bindable" marks props declared with `$bindable`.

### `FileUpload` — `file-upload.svelte` (Root, `<div>`)

| Prop             | Type                                                                        | Default         | Bindable |
| ---------------- | --------------------------------------------------------------------------- | --------------- | -------- |
| `ref`            | `HTMLDivElement \| null`                                                     | `null`          | yes      |
| `value`          | `File[]`                                                                     | —               | yes      |
| `defaultValue`   | `File[]`                                                                     | `[]`            | no       |
| `onValueChange`  | `(files: File[]) => void`                                                    | —               | no       |
| `onAccept`       | `(files: File[]) => void`                                                    | —               | no       |
| `onFileAccept`   | `(file: File) => void`                                                       | —               | no       |
| `onFileReject`   | `(file: File, message: string) => void`                                      | —               | no       |
| `onFileValidate` | `(file: File) => string \| null \| undefined`                                | —               | no       |
| `onUpload`       | `(files: File[], options: FileUploadUploadOptions) => Promise<void> \| void` | —               | no       |
| `accept`         | `string`                                                                     | —               | no       |
| `maxFiles`       | `number`                                                                     | —               | no       |
| `maxSize`        | `number` (bytes)                                                             | —               | no       |
| `dir`            | `'ltr' \| 'rtl'`                                                             | inherited       | no       |
| `label`          | `string`                                                                     | `'File upload'` | no       |
| `name`           | `string`                                                                     | —               | no       |
| `disabled`       | `boolean`                                                                    | `false`         | no       |
| `invalid`        | `boolean`                                                                    | `false`         | no       |
| `multiple`       | `boolean`                                                                    | `false`         | no       |
| `required`       | `boolean`                                                                    | `false`         | no       |

Snippets: `children`, `child({ props })`.

Callback order per processed batch: `onFileValidate` (per file) → `onFileReject` (per rejected file) →
`onValueChange` → `onAccept` (whole accepted batch) → `onFileAccept` (per accepted file) → `onUpload`
(scheduled on the next animation frame).
`FileUploadUploadOptions = { onProgress(file, progress): void; onSuccess(file): void; onError(file, error: Error): void }`.

### `FileUpload.Dropzone` — `file-upload-dropzone.svelte` (`<div role="region">`)

No own data props. Pass-through handlers, each invoked before the internal behaviour and skipped when the
caller calls `preventDefault()`: `onclick`, `ondragenter`, `ondragover`, `ondragleave`, `ondrop`, `onpaste`,
`onkeydown`. Snippets: `children`, `child({ props })`.
Data attributes: `data-slot="file-upload-dropzone"`, `data-disabled`, `data-dragging`, `data-invalid`.

### `FileUpload.Trigger` — `file-upload-trigger.svelte` (`<button type="button">`)

`ref: HTMLButtonElement | null` (bindable), `onclick` pass-through. `disabled` comes from the root.
Snippets: `children`, `child({ props })`. Data attributes: `data-slot="file-upload-trigger"`, `data-disabled`.

### `FileUpload.List` — `file-upload-list.svelte` (`<div role="list">`)

| Prop          | Type                         | Default      | Bindable |
| ------------- | ---------------------------- | ------------ | -------- |
| `orientation` | `'horizontal' \| 'vertical'` | `'vertical'` | no       |
| `forceMount`  | `boolean`                    | `false`      | no       |

Snippets: `children`, `child({ props })`. Data attributes: `data-slot="file-upload-list"`,
`data-orientation`, `data-state="active" \| "inactive"`.

### `FileUpload.Item` — `file-upload-item.svelte` (`<div role="listitem">`)

| Prop    | Type   | Default      | Bindable |
| ------- | ------ | ------------ | -------- |
| `value` | `File` | — (required) | no       |

Snippets: `children`, `child({ props })`. Renders nothing when `value` is not in the current file set.
Data attributes: `data-slot="file-upload-item"`, `data-status` (research R-11).

### `FileUpload.ItemPreview` — `file-upload-item-preview.svelte` (`<div>`)

| Prop     | Type                                           | Default | Bindable |
| -------- | ---------------------------------------------- | ------- | -------- |
| `render` | `Snippet<[{ file: File; fallback: Snippet }]>` | —       | no       |

Snippets: `render`, `children` (rendered *after* the preview content, as upstream does), `child({ props })`.
Data attribute: `data-slot="file-upload-preview"` (upstream's spelling — deliberately not
`file-upload-item-preview`).

### `FileUpload.ItemMetadata` — `file-upload-item-metadata.svelte` (`<div>`)

| Prop   | Type                | Default     | Bindable |
| ------ | ------------------- | ----------- | -------- |
| `size` | `'default' \| 'sm'` | `'default'` | no       |

Snippets: `children` (replaces the default name/size/error trio entirely), `child({ props })`.
Data attribute: `data-slot="file-upload-metadata"` (upstream's spelling).

### `FileUpload.ItemProgress` — `file-upload-item-progress.svelte` (`<div role="progressbar">`)

| Prop         | Type                               | Default    | Bindable |
| ------------ | ---------------------------------- | ---------- | -------- |
| `variant`    | `'linear' \| 'circular' \| 'fill'` | `'linear'` | no       |
| `size`       | `number` (circular diameter, px)   | `40`       | no       |
| `forceMount` | `boolean`                          | `false`    | no       |

Snippets: `child({ props })`. Data attribute: `data-slot="file-upload-progress"`. Unmounts once
`progress === 100` unless `forceMount`.

### `FileUpload.ItemDelete` — `file-upload-item-delete.svelte` (`<button type="button">`)

`ref: HTMLButtonElement | null` (bindable), `onclick` pass-through. Snippets: `children`, `child({ props })`.
Data attribute: `data-slot="file-upload-item-delete"`.

### `FileUpload.Clear` — `file-upload-clear.svelte` (`<button type="button">`)

| Prop         | Type      | Default | Bindable |
| ------------ | --------- | ------- | -------- |
| `forceMount` | `boolean` | `false` | no       |
| `disabled`   | `boolean` | `false` | no       |

`disabled` is OR-ed with the root's `disabled`. `onclick` pass-through. Snippets: `children`,
`child({ props })`. Data attributes: `data-slot="file-upload-clear"`, `data-disabled`.

### Non-component exports (barrel)

| Export                                                  | Kind     | Purpose                                                                                                                                                                             |
| ------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useFileUpload()`                                       | function | Upstream's `useStore as useFileUpload`. Returns the reactive `FileUploadRootState`; throws outside `<FileUpload>`. No selector argument — Svelte reactivity is already fine-grained. |
| `formatBytes(bytes)`                                    | function | `"0 B"` / `"512 B"` / `"1.5 KB"` … `TB`. **Shared: exported for reuse by later ports.**                                                                                             |
| `getFileIcon(file)`                                     | function | `File` → a `@lucide/svelte` icon `Component`. **Shared: exported for reuse.**                                                                                                        |
| `FileUploadRootState`, `FileUploadItemState`            | classes  | State classes, for consumers writing their own parts.                                                                                                                               |
| `setFileUploadContext` / `getFileUploadContext`         | function | Root context; the getter throws `` `<Part>` must be used within `<FileUpload>`. ``                                                                                                  |
| `setFileUploadItemContext` / `getFileUploadItemContext` | function | Item context; the getter throws `` `<Part>` must be used within `<FileUpload.Item>`. ``                                                                                             |
| `FILE_UPLOAD_STATUSES`                                  | const    | `['idle', 'uploading', 'error', 'success']`                                                                                                                                         |
| types                                                   | —        | `FileUploadFileState`, `FileUploadStatus`, `FileUploadUploadOptions`, `FileUploadRootStateProps`, `FileUploadItemStateProps`, and one `…Props` (+ `…ChildProps`) type per part.      |

**Shared modules this port exports for later components** (deliverable 5): `formatBytes` and `getFileIcon`
are exported from the barrel rather than inlined, because the not-yet-ported `cropper`
(`cropper-file-upload-demo.tsx`) and any future attachment UI need exactly this formatting and icon mapping.
No new repo-level shared directory is created — the existing `direction-provider` component remains the only
cross-component shared module this port depends on.

## Deliverables & Sequencing

| #  | Deliverable                                                   | Notes                                                                                            |
| -- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1  | `file-upload.svelte.ts`                                       | Types, `formatBytes`, `getFileIcon`, both contexts, `FileUploadRootState`, `FileUploadItemState`  |
| 2  | Root + Dropzone + Trigger                                     | US1 MVP path: dialog, drag, paste, hidden input, sr-only label                                    |
| 3  | List + Item + ItemPreview + ItemMetadata + ItemDelete + Clear | US1 display / removal path                                                                        |
| 4  | Validation pipeline in `FileUploadRootState`                  | US2 — `maxFiles` / `accept` / `maxSize` / `onFileValidate`, invalid flash                          |
| 5  | ItemProgress (3 variants) + upload orchestration              | US3 — rAF-coalesced `onProgress`, `onSuccess`, `onError`                                          |
| 6  | `index.ts` barrel                                             | Short names, prefixed aliases, all types, non-component exports                                   |
| 7  | `file-upload.test.svelte` harness + `file-upload.test.ts`     | The six mandatory areas of CLAUDE.md §7 plus the test matrix below                                 |
| 8  | `src/routes/docs/components/file-upload/+page.svelte`         | 7 `<ComponentPreview>` sections + 10 API `Table` blocks                                            |
| 9  | `registry.json` entry + `pnpm run registry:build`             | 12 files, `registryDependencies: ["direction-provider"]`, `dependencies: ["@lucide/svelte"]`       |
| 10 | Quality gates                                                 | `pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build`                              |

### Demo page sections (Principle IX)

| Section              | Upstream demo                            | What it exercises                                                        |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| Default              | `file-upload-demo.tsx`                   | `maxFiles=2`, `maxSize=5MB`, `multiple`, controlled `value`, toast reject |
| With Validation      | `file-upload-validation-demo.tsx`        | `onFileValidate` overriding built-in messages, `accept="image/*"`         |
| Direct Upload        | `file-upload-direct-upload-demo.tsx`     | `onUpload` with timer-simulated chunk progress, linear `ItemProgress`     |
| Circular Progress    | `file-upload-circular-progress-demo.tsx` | `variant="circular"`, `size={40}`, horizontal list, sr-only metadata      |
| Fill Progress        | `file-upload-fill-progress-demo.tsx`     | `variant="fill"` overlay `clip-path`                                      |
| With Chat Input      | `file-upload-chat-input-demo.tsx`        | Dropzone overlaying the preview area + `Textarea` composer                |
| With Form            | `file-upload-form-demo.tsx`              | `Field.*` + runes validation + `toast` (research R-13)                    |
| ~~With uploadthing~~ | `file-upload-uploadthing-demo.tsx`       | **Not ported** — see Complexity Tracking                                  |

`cropper-file-upload-demo.tsx` is a demo of the *cropper* component (not ported) and is out of scope here.

### Test matrix (Principle III / CLAUDE.md §7)

| Area                | Assertions                                                                                                                                                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roles & ARIA        | `region` / `list` / `listitem` / `progressbar`; `aria-controls`, `aria-labelledby`, `aria-describedby`, `aria-setsize`, `aria-posinset`, `aria-valuenow` / `aria-valuetext`, `aria-invalid`, `aria-disabled`; sr-only root label and sr-only per-item status text                        |
| Keyboard            | `Tab` order dropzone → trigger → delete → clear; `Enter` and `Space` on the dropzone open the dialog (spy on the hidden input's `click`); `Enter` / `Space` activate trigger, delete and clear                                                                                          |
| Uncontrolled        | `defaultValue` seeds the list; adding and deleting update the internal value with no binding present                                                                                                                                                                                    |
| Controlled          | `value` makes the parent authoritative; `onValueChange` fires with the next array; a function binding whose setter declines the write leaves the rendered list unchanged                                                                                                                 |
| RTL                 | `dir="rtl"` on the root propagates `dir` to dropzone / list / item; inherited from `<DirectionProvider dir="rtl">`; asserted that no key binding inverts (this component has no arrow-key navigation)                                                                                    |
| Guard rails         | `disabled` suppresses dialog, drop, paste, keyboard activation, delete and clear; every part rendered outside its provider throws `/must be used within/`                                                                                                                                |
| Validation          | `maxFiles` slot arithmetic, `accept` MIME + extension + `image/*` wildcard, `maxSize`, `onFileValidate` precedence, mixed valid/invalid batch, `data-invalid` flash and its 2000 ms reset (fake timers)                                                                                  |
| Upload              | `onUpload` receives the accepted files plus the three reporters; progress visible after a rAF flush; success → 100 % and unmount; error → `data-status="error"` plus message; an `onUpload` that throws marks every file in the batch errored; absent `onUpload` → immediate success     |
| Previews & metadata | image → `<img>` with a stubbed `createObjectURL`, revoked on delete / clear / unmount; every icon branch (video, audio, text, code, archive, binary, generic); `formatBytes` boundaries (`0`, `< 1 KB`, `1.5 KB`, `MB`, `GB`, `TB`)                                                       |
| Snippets            | `child` on every part; `render` on `ItemPreview` including invoking its `fallback`; `children` overriding `ItemMetadata`                                                                                                                                                                 |

## Complexity Tracking

| Principle | Violation                                     | Why Needed                                                                                                                                                                                                                                                                                       | Compliant Alternative Rejected Because                                                                                                                                                                                                                                                                                                                                                                       |
| --------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IX        | `file-upload-uploadthing-demo.tsx` not ported | The demo's entire content is wiring to the third-party **uploadthing** SaaS (`uploadthing` + `@uploadthing/react`, a server route and an API key). Porting it would add at least two npm dependencies — violating the zero-new-dependency constraint — and would need a live account to render. | Reproducing it with a stub would document an integration that does not exist, which is worse than omitting it. The `onUpload` contract it demonstrates is already covered end to end by the **Direct Upload**, **Circular Progress**, **Fill Progress** and **Chat Input** sections, which use the identical `onProgress` / `onSuccess` / `onError` reporters. Also recorded in the spec's Assumptions section. |

Principles II, VI and VII are not listed here and admit no exception.

## Post-Design Constitution Re-check

Re-evaluated after Phase 1 ([research.md](./research.md), [data-model.md](./data-model.md),
[contracts/file-upload-api.md](./contracts/file-upload-api.md), [quickstart.md](./quickstart.md)):

- **I** — the design removed the last candidate `$effect` that would have written state (research R-04: the
  `value` → status-map reconciliation became a `$derived` fallback), leaving `$effect` only for object-URL
  teardown and invalid-flash timer cleanup, both of which return teardowns. PASS.
- **II** — `contracts/file-upload-api.md` enumerates all 10 parts, 19 root props, 6 callbacks, 12 data
  attributes and the full ARIA / keyboard map against upstream line numbers; no prop is dropped. PASS.
- **III** — the contract fixes the accessible name and description wiring per part, and the test matrix covers
  all six mandatory areas. PASS.
- **IV** — the bespoke surface did not grow during design; the four justified items above are unchanged. PASS.
- **V** — the file list in the registry entry equals the 12 non-test files in the folder tree. PASS.
- **VI / VII / VIII / X** — unchanged by the design; no `any` appears in any contract signature. PASS.
- **IX** — unchanged (one recorded exception). VIOLATION, recorded above.
