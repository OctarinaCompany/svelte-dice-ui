# Phase 0 Research: File Upload

**Feature**: `034-port-file-upload` | **Date**: 2026-07-31

Upstream material read at the pinned commit `d9763d82530416dfa4c81c462387b55d06bae4ec`:

- `.reference/diceui/docs/registry/bases/radix/ui/file-upload.tsx` (1414 lines — the whole file)
- `.reference/diceui/docs/content/docs/components/radix/file-upload.mdx` (API contract, data-attribute and
  keyboard tables)
- `.reference/diceui/docs/registry/bases/radix/examples/file-upload-{,validation-,direct-upload-,circular-progress-,fill-progress-,chat-input-,form-,uploadthing-}demo.tsx`
- In-repo precedent: `src/lib/components/ui/tags-input/*` (child snippet, forceMount, `$bindable` +
  `defaultValue`), `src/lib/components/ui/direction-provider/*` (`useDirection`),
  `src/lib/components/ui/color-picker/*` (multi-part folder + `.test.svelte` harness),
  `src/lib/components/ui/qr-code/*` (object-URL handling and its test stubs)

Upstream ships **no test file** for `file-upload` (`docs/registry/bases/radix/test/` contains none), so the
floor for our suite is the MDX tables plus the behaviour read directly out of the source. That is recorded
here because CLAUDE.md §2 expects an upstream test file to exist.

There were no `[NEEDS CLARIFICATION]` markers left in `spec.md`; the items below are the design unknowns that
had to be resolved to write the plan.

---

## R-01 — Where the source of truth for the file list lives

**Decision**: `value: File[]` (bindable, seeded once from `defaultValue`) is authoritative for **membership
and order**. A `SvelteMap<File, FileUploadFileState>` inside `FileUploadRootState` holds **only** per-file
status metadata (`status`, `progress`, `error`) and is keyed by `File` reference.

**Rationale**: Upstream keeps the `Map` authoritative and treats `value` as a synchronisation input, because
React needs a stable mutable container to avoid re-render churn. In Svelte the array *is* the reactive value
and `bind:value` is the documented contract for every other ported component (CLAUDE.md §4), so inverting
the relationship makes the controlled mode fall out for free and keeps the ordering guarantee that upstream
gets from `Map` insertion order.

**Alternatives considered**: (a) Mirror upstream exactly with the `Map` authoritative and an `$effect`
syncing from `value` — rejected, it needs a state-writing effect (see R-04) and produces two sources of truth
for order. (b) Keep everything in one `$state` array of `{ file, status, progress, error }` objects —
rejected because `value` must be exactly `File[]` to match upstream's `onValueChange` and native form usage.

---

## R-02 — Replacing `useSyncExternalStore` + the reducer

**Decision**: One `FileUploadRootState` class in `file-upload.svelte.ts`. The nine reducer actions become
nine methods (`addFiles`, `setFiles`, `setProgress`, `setSuccess`, `setError`, `removeFile`, `setDragOver`,
`setInvalid`, `clear`), each mutating `$state` fields directly.

**Rationale**: The store exists purely so React components can subscribe to a slice without re-rendering the
tree; Svelte's fine-grained reactivity delivers that natively. Preserving the reducer would be a
transliteration, which the porting rules explicitly forbid. Method-per-action keeps the mapping auditable
against upstream L266–L388.

**Alternatives considered**: Porting the reducer verbatim behind a `dispatch()` — rejected: no subscriber
mechanism to justify it, and it would hide mutations from the compiler's dependency tracking.

---

## R-03 — Two React contexts → how many Svelte contexts

**Decision**: Two contexts total, but split differently than upstream: one **root** context (`Symbol
('file-upload')`) carrying the single `FileUploadRootState` instance — which exposes the ids, `dir`,
`disabled`, the input element reference, the URL cache *and* the reactive file state — and one **item**
context (`Symbol('file-upload-item')`) carrying a `FileUploadItemState`.

**Rationale**: Upstream's split into `StoreContext` + `FileUploadContext` exists only because the store must
be referentially stable while the config object is recreated per render. Svelte has no such constraint, and
every consumer part (dropzone, list, clear) reads from both, so merging removes a lookup and a second
throwing getter with no loss of API. The item context stays separate because it is genuinely a different
provider with a different error message (`must be used within \`<FileUpload.Item>\``, upstream L979).

**Alternatives considered**: One flat context including item state — rejected, `ItemPreview`/`ItemMetadata`/
`ItemProgress`/`ItemDelete` must throw a *different*, item-specific error (FR-016).

---

## R-04 — Reconciling externally-set `value` without a state-writing `$effect`

**Decision**: No reconciliation effect. `FileUploadRootState` exposes
`entries = $derived(value.map((file) => this.#statuses.get(file) ?? idleState(file)))`, so a file that
appears in `value` from outside is rendered as `idle` without ever writing to the map. Stale map keys are
pruned lazily inside the next mutating method (`addFiles`, `removeFile`, `clear`).

**Rationale**: A prior port recorded that writing a `SvelteMap` inside an `$effect` self-invalidates the
effect (memory: *SvelteMap writes in `$effect` self-invalidate*), forcing an `untrack` wrapper that is easy
to get wrong. Deriving the missing entry instead of materialising it removes the effect entirely, which also
satisfies the "never mutate reactive state inside `$effect` where `$derived` would do" constraint.

**Alternatives considered**: `$effect` + `untrack(() => map.set(...))` — rejected as above. A plain
non-reactive `Map` plus a version counter — rejected as a hand-rolled invalidation scheme.

---

## R-05 — Drag / paste intake: round-trip through the hidden `<input>` or not

**Decision**: Dropped and pasted files are handed straight to `FileUploadRootState.addFiles(files)`. The
hidden `<input type="file">` remains in the DOM for the dialog path and native form participation, but is no
longer written to from drop/paste.

**Rationale**: Upstream builds a `DataTransfer`, assigns `input.files`, and dispatches a synthetic `change`
event (L787–793, L826–832) solely to funnel every path through one handler. `new DataTransfer()` is not
implemented in jsdom, so that round-trip is untestable in this repo's environment, and assigning
`input.files` is unsupported in older Safari. Calling the same intake method directly is observably
identical — same validation, same callbacks, same order — and testable. Recorded in the spec's Assumptions.

**Alternatives considered**: Polyfilling `DataTransfer` in `tests/setup.ts` — rejected: it would make the
test environment diverge from the browser to prop up an indirection that has no user-visible effect, and
`tests/setup.ts` is shared by every component.

---

## R-06 — `asChild` / `Slot`

**Decision**: A `child?: Snippet<[{ props: <Part>ChildProps }]>` prop on all ten parts, following
`src/lib/components/ui/tags-input/tags-input-clear.svelte` exactly: in `child` mode the component renders
only the snippet, `children` is not rendered, `ref` stays `null`, and the merged attribute object (including
`data-slot`, the `cn()`-merged class and the event handlers) is handed to the caller.

**Rationale**: Svelte has no `cloneElement`; the `child` snippet is the established repo-wide replacement
(CLAUDE.md §10) and is what the four upstream demos need — every one of them wraps `FileUploadTrigger` and
`FileUploadItemDelete` around a `<Button>`.

**Alternatives considered**: Rendering a `<button>` and styling it like a `Button` — rejected, it would make
`variant`/`size` unavailable and break demo parity.

---

## R-07 — `render` prop on `ItemPreview`

**Decision**: `render?: Snippet<[{ file: File; fallback: Snippet }]>`. The component always computes the
default preview as a local snippet and passes it as `fallback`, so a caller can decorate rather than replace.

**Rationale**: Upstream's signature is `(file, fallback: () => ReactNode) => ReactNode` (L1059). A Svelte
snippet cannot return a value, so the callback becomes a snippet and the `fallback` thunk becomes a nested
snippet the caller renders with `{@render fallback()}`. Single-object parameter matches the repo's `child`
convention. Recorded in the spec's Assumptions.

**Alternatives considered**: `render?: (file: File) => Component` — rejected, it cannot express "wrap the
default output" and would force consumers to build components at runtime.

---

## R-08 — `useId()` and the id graph

**Decision**: One `$props.id()` per root (`uid`) with derived `${uid}-input`, `${uid}-dropzone`,
`${uid}-list`, `${uid}-label`, and one `$props.id()` per item with `${uid}-name`, `${uid}-size`,
`${uid}-status`, `${uid}-message` — mirroring upstream's per-item derivation (L992–996) and the pattern
already used by `checkbox-group`.

**Rationale**: `$props.id()` is SSR-stable and hydration-safe, unlike `crypto.randomUUID()`. Upstream uses
four separate `useId()` calls at the root; deriving four ids from one is equivalent and keeps the ids
greppable in the DOM.

**Alternatives considered**: Four `$props.id()` calls — works, but produces unrelated ids that are harder to
debug and gains nothing.

---

## R-09 — RTL

**Decision**: `useDirection({ dir: () => dir, element: () => ref })` from
`$lib/components/ui/direction-provider/index.js`, resolved once in the root and published on the root
context; dropzone, list and item read `context.dir` and set the `dir` attribute, exactly as upstream does
(L865, L953, L1042).

**Rationale**: This is the in-repo equivalent of Radix's `DirectionPrimitive.useDirection` and is already the
composition point used by `tags-input`, `combobox`, `stepper` and others (Principle IV).

**Alternatives considered**: Reading `document.dir` directly — rejected, it ignores `<DirectionProvider>` and
nested `dir` attributes.

---

## R-10 — Progress coalescing and the 2000 ms invalid flash need teardown

**Decision**: The rAF handle from `onProgress` and the `setTimeout` handle from the invalid flash are stored
as private fields on `FileUploadRootState`; the root registers a single `$effect` whose teardown calls
`state.destroy()`, which cancels both and revokes every cached object URL.

**Rationale**: Upstream's rAF guard (L410–423) and 2000 ms reset (L575–577) leak on unmount in React too; the
constitution requires that anything an effect starts, its cleanup stops. A previously recorded pitfall
(memory: *teardown assertions go vacuous*) means the test must assert the *positive* effect of teardown —
`cancelAnimationFrame` / `clearTimeout` / `revokeObjectURL` spies called with the right handles — rather than
"nothing happened after unmount".

**Alternatives considered**: Letting the timers fire into a destroyed state — rejected; writes to a
destroyed component's state are a real leak and a jsdom "not wrapped in act"-class warning source.

---

## R-11 — Exposing status for styling

**Decision**: Add `data-status="idle" | "uploading" | "success" | "error"` to `FileUpload.Item` in addition to
every upstream attribute.

**Rationale**: Principle VIII requires *every* piece of component state to be exposed as a `data-*`
attribute; upstream surfaces status only through the sr-only status text, which cannot be styled. This is an
addition, not a change — no upstream attribute is renamed or removed, so upstream parity is preserved.
Documented in the demo page's API table and in `contracts/file-upload-api.md`.

**Alternatives considered**: Omitting it for strict parity — rejected, it fails Principle VIII and consumers
would have to fork the file to style an errored row.

---

## R-12 — `aria-describedby` trailing separator

**Decision**: Build the item's `aria-describedby` from a filtered array joined with a single space, so no
trailing space is emitted when the file has no error.

**Rationale**: Upstream's template literal (L1037–1039) leaves a trailing space when `fileState.error` is
absent. An IDREF list is whitespace-delimited, so the rendered value is semantically identical, but the
trailing space makes exact-string assertions brittle. This is a formatting fix inside an unchanged
attribute, not an API change.

**Alternatives considered**: Reproducing the trailing space — rejected, it would force every test to assert
`'a b c '`.

---

## R-13 — The "With Form" demo without `react-hook-form` + `zod`

**Decision**: Rebuild the form demo with `Field.FieldGroup` / `Field.Field` / `Field.FieldLabel` /
`Field.FieldDescription` / `Field.FieldError` from `$lib/components/ui/field`, plain runes state for the
value, a hand-written submit validation (`files.length > 0`, `maxFiles`, `maxSize`) and `toast` from
`svelte-sonner` for the submitted payload — the same user-visible flow as upstream's demo.

**Rationale**: The repo has no `formsnap`, `sveltekit-superforms` or `zod` dependency, and the
zero-new-dependency constraint forbids adding them. `.agents/skills/shadcn-svelte/rules/forms.md` mandates
`Field.FieldGroup` + `Field.Field` for forms, which is exactly the shape upstream's `Form*` components take.

**Alternatives considered**: Skipping the form demo — rejected, Principle IX requires one section per
upstream demo and this one is reproducible without new dependencies.

---

## R-14 — Icon mapping in a `.svelte.ts` module

**Decision**: `getFileIcon(file): Component` in `file-upload.svelte.ts` returns a `@lucide/svelte` icon
component (`FileVideoIcon`, `FileAudioIcon`, `FileTextIcon`, `FileCodeIcon`, `FileArchiveIcon`,
`FileCogIcon`, `FileIcon`), matching upstream's branch order and extension lists exactly (L39–L92). The
preview part renders it as `{@const Icon = getFileIcon(file)}<Icon />`.

**Rationale**: `@lucide/svelte` exposes the same Lucide icons under the same names as `lucide-react`, so the
mapping is a literal port. Returning a component reference (not a string key) is what
`.agents/skills/shadcn-svelte/rules/icons.md` requires. A `.svelte.ts` module may import `.svelte`
components; keeping the mapping next to `formatBytes` makes both reusable from the barrel.

**Alternatives considered**: A dedicated `file-upload-item-icon.svelte` that switches internally — rejected,
it adds an eleventh part that is not in upstream's public API and cannot be reused as a plain function.

---

## R-15 — Test environment gaps

**Decision**: The test file stubs `URL.createObjectURL` / `URL.revokeObjectURL` with `vi.fn()` (as
`qr-code.test.ts` already does), spies on the hidden input's `click` to prove the dialog opens, uses
`userEvent.upload()` for the dialog path, `fireEvent.drop` / `fireEvent.paste` with hand-built
`dataTransfer` / `clipboardData` objects for the drag and paste paths, and drives progress assertions past
the rAF coalescer with an explicit frame flush.

**Rationale**: jsdom implements neither `DataTransfer` nor object URLs, and `userEvent` has no OS-file drag
API. `fireEvent` is used only where `userEvent` genuinely cannot express the interaction, as CLAUDE.md §7
permits.

**Alternatives considered**: Testing drag/paste only through the demo page — rejected, colocated unit tests
are the constitution's evidence requirement.
