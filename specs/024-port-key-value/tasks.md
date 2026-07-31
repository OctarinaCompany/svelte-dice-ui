---
description: 'Task list for the Key Value port'
---

# Tasks: Key Value

**Input**: Design documents from `/specs/024-port-key-value/` (plan.md, spec.md, research.md,
data-model.md, contracts/public-api.md, quickstart.md)

**Tests**: MANDATORY (constitution Principle III / VII). Every behavioural area below is a
required, non-skippable test task — no `.skip`/`.todo`, no suppressions.

**Organization**: Phases run in the fixed order requested for this feature — Setup → Tests → Core
component files → Barrel and types → Demo route → Registry entry and docs polish → Verification.
Within that order, `[US1]`/`[US2]`/`[US3]` tags trace each task back to its spec.md user story for
independent-test purposes; they do not change the phase sequence.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency)
- **[Story]**: Traces the task to spec.md's US1 (build the list), US2 (paste), or US3 (validation)
- Every task names its exact file path(s)

---

## Phase 1: Setup

**Purpose**: Directory scaffold, confirm zero new dependencies, land the state module so both the
test phase and the component phase can build on it (plan.md Phase 1 — pure functions first).

- [X] T001 Create `src/lib/components/ui/key-value/` and confirm the four registry dependencies
      already exist at `src/lib/components/ui/{editable,button,direction-provider,checkbox-group}/`;
      confirm no new npm dependency is required (research R-15; only `@lucide/svelte`, already a
      project dependency, is used for `XIcon`/`PlusIcon`).
- [X] T002 Implement `src/lib/components/ui/key-value/key-value.svelte.ts`: value types
      (`KeyValueItemData`, `KeyValueField`, `KeyValueOrientation`, `KeyValueItemErrors`,
      `KeyValueErrors`), `createKeyValueItemId()`, `stripSurroundingQuotes()`,
      `parseKeyValueText()`, `KeyValueRootState` (fields/methods per data-model.md §2, including
      `add`/`remove`/`pasteInto`/`setField`/`validateItem`/`consumeFocusRequest`/`errorId`/`errorFor`),
      `KeyValueItemState` (data-model.md §3), and the two `Symbol`-keyed contexts with throwing
      getters (`setKeyValueContext`/`getKeyValueContext`, `setKeyValueItemContext`/
      `getKeyValueItemContext`) per data-model.md §6. Depends on: T001.
- [X] T003 [P] Create the test harness `src/lib/components/ui/key-value/key-value.test.svelte`
      (snippet plumbing to render `Root`/`List`/`Item`/parts under test, following the pattern in
      `src/lib/components/ui/editable/editable.test.svelte` and
      `src/lib/components/ui/tags-input/tags-input.test.svelte`). Depends on: T001.

**Checkpoint**: state module and test harness exist; the test phase can now write assertions
against real types even though the `.svelte` parts don't exist yet (they are expected to fail
until Phase 3 lands, per the project's TDD convention for ported components).

---

## Phase 2: Tests (write first — MUST fail before Phase 3 implementation)

**Purpose**: One test task per required behavioural area (accessibility roles/names, keyboard,
controlled/uncontrolled, RTL), split further only where scale demands it — edge cases here cover
all 30 quickstart.md scenarios, including the component-specific guidance items (duplicate-key
handling, add/remove focus management). All tasks write into the same two files, so none are `[P]`.

- [X] T004 [US1] Accessibility roles-and-names tests in
      `src/lib/components/ui/key-value/key-value.test.ts`: `role="list"` on `KeyValue.List`,
      `role="listitem"` on `KeyValue.Item`, `role="alert"` on a rendered `KeyValue.Error`,
      `aria-invalid` + `aria-describedby` → the error id on both the `KeyInput`/`ValueInput`
      control and preview, default placeholders `"Key"`/`"Value"` plus the configured path
      (`keyPlaceholder="KEY"` / `valuePlaceholder="value"` change both placeholders
      independently, FR-017), `KeyValue.Remove` is reachable as
      `getByRole('button', { name: 'Remove' })` and `KeyValue.Add` as
      `getByRole('button', { name: /add/i })` (FR-022), and the documented out-of-provider throw
      for every part (`/within/`) — `KeyValue.Item`/`KeyInput`/`ValueInput`/`Remove`/`Error`
      outside `<KeyValue.List>`, `KeyValue.List` outside `<KeyValue.Root>`, `KeyValue.Add` outside
      `<KeyValue.Root>`; the documented data attributes: `data-disabled`/`data-readonly` present on
      the root only when the matching prop is set and absent otherwise, `data-orientation="vertical"`
      by default and `"horizontal"` when `orientation="horizontal"` on `KeyValue.List`, and
      `data-highlighted` present on exactly the row that `KeyValue.Add` just appended and absent on
      its siblings (FR-021). Depends on: T002, T003.
- [X] T004a [US1] Orientation tests in `src/lib/components/ui/key-value/key-value.test.ts`:
      `KeyValue.List` renders `data-orientation="vertical"` by default and `"horizontal"` when
      `orientation="horizontal"`, the corresponding `flex-col` / `flex-row` class is applied,
      `role="list"`/`role="listitem"` and the key/value/remove tab order are identical in both
      orientations, and no `aria-orientation` attribute is emitted (divergence D-6). Depends on:
      T002, T003.
- [X] T005 [US1] Keyboard interaction tests (via `@testing-library/user-event`, not `fireEvent`) in
      `src/lib/components/ui/key-value/key-value.test.ts`: `Tab` into a field enters edit mode and
      selects its text, `Enter` submits the field being edited, `Escape` cancels and restores the
      value edit mode started with, and `Ctrl+V`/paste into the key field triggers row splitting;
      typing a key or a value with trailing whitespace stores the trimmed value and the control's
      DOM value is pushed back into lockstep (FR-005, research R-13), and with `trim={false}` the
      whitespace is preserved. Depends on: T002, T003.
- [X] T006 [US1] Controlled-vs-uncontrolled tests in
      `src/lib/components/ui/key-value/key-value.test.ts`: no `value`/`defaultValue` seeds exactly
      one empty row; `defaultValue` seeds the list and interaction updates it in place
      (uncontrolled); passing `value` with no binding keeps the list from moving on its own while
      `onValueChange` still fires with the intended next value (controlled); binding `value` lets
      interaction move the list directly. Depends on: T002, T003.
- [X] T007 [US3] RTL tests in `src/lib/components/ui/key-value/key-value.test.ts`: with
      `dir="rtl"`, the root and each field carry `dir="rtl"`, row content (key field, value field,
      remove button) reads in mirrored order, and parsing/validation/add/remove behaviour is
      byte-identical to the LTR case. Depends on: T002, T003.
- [X] T008 [US1] Edge-case tests — add/remove and focus management — in
      `src/lib/components/ui/key-value/key-value.test.ts`: activating Add appends an empty row and
      moves keyboard focus into its key field in edit mode; activating Remove on a middle row moves
      focus to the next row's key field; removing the last row moves focus to the previous row's
      key field; at `minItems` every `KeyValue.Remove` is `disabled` and does nothing; at
      `maxItems` `KeyValue.Add` is `disabled` and does nothing; removing a row deletes that row's
      entry from the error record so a later row reusing focus never inherits a stale error;
      `onAdd` fires exactly once with the newly appended row and `onRemove` fires exactly once with
      the removed row (both receiving the full row object, FR-019), and neither fires when the
      action is refused by `minItems`/`maxItems`/`disabled`. Depends on: T002, T003.
- [X] T009 [US2] Edge-case tests — paste grammar — in
      `src/lib/components/ui/key-value/key-value.test.ts` plus direct unit tests against
      `parseKeyValueText`/`stripSurroundingQuotes`: `KEY=VALUE`, `KEY: VALUE`, and
      tab/multi-space-separated lines each split correctly with the `=` → `:` → whitespace priority
      order; pasting into an empty row replaces it, pasting into a non-empty row inserts the parsed
      rows immediately after it; a paste that would exceed `maxItems` is truncated to exactly
      `maxItems`; a single-line clipboard value is inserted as ordinary text with
      `event.defaultPrevented === false`; with `enablePaste={false}` a multi-line paste is not
      intercepted; `onPaste` fires once with the originating `ClipboardEvent` and the array of
      parsed rows when a multi-line paste is intercepted, and does not fire for a single-line paste
      or when `enablePaste={false}` (FR-019). Depends on: T002, T003.
- [X] T010 [US3] Edge-case tests — validation, duplicate keys, guard rails, form — in
      `src/lib/components/ui/key-value/key-value.test.ts`: `onKeyValidate` and `onValueValidate`
      failures each render their own `<KeyValue.Error>` and mark only their own field invalid,
      independently of each other; a non-empty key duplicated on a later row shows a duplicate-key
      error on that later row; two empty keys never collide; `allowDuplicateKeys={true}` suppresses
      the duplicate check entirely; the root's `data-invalid` attribute is present while any row has
      an error and absent once all clear; `disabled`/`readOnly` suppress add, remove, edit and paste
      while values remain visible; setting `disabled`/`readOnly` on a single `KeyValue.KeyInput`/
      `ValueInput` while the root is enabled makes only that field inert and leaves its siblings
      interactive (FR-010); `required` on the root marks both fields required and, once inside a
      `<form>`, marks the submitted form control required, and a per-part `required` OR-s with the
      root's; `maxRows` on `KeyValue.ValueInput` produces the documented `max-height` and
      `overflow-y-auto` once the content exceeds it (FR-018); inside a `<form>`, with `name="env"`
      passed to `KeyValue.Root`, the submitted `FormData` entry for `"env"` equals
      `JSON.stringify(rows)`; with no `name`, no entry is produced. Depends on: T002, T003.

**Checkpoint**: all eight test tasks exist and fail (no `key-value.svelte`/parts to import yet from
a complete barrel). This is the expected, required state before Phase 3.

---

## Phase 3: Core component files

**Purpose**: One task per exported subcomponent (8) plus the internal per-row provider, in the
dependency order plan.md Phase 2 lays out — Root → List + provider → Item → KeyInput → ValueInput
→ Remove → Add → Error — because each part after Root reads a context an earlier part establishes.

- [X] T011 [US1] Implement `src/lib/components/ui/key-value/key-value.svelte` (Root): props per
      contracts/public-api.md `KeyValue.Root` table, `value ??= defaultValue` seeding (one empty
      row when neither is given), constructs and publishes `KeyValueRootState` via
      `setKeyValueContext`, renders `data-slot="key-value"` + `data-disabled`/`data-invalid`/
      `data-readonly`, and — when a `<form>` ancestor exists — a clipped `type="text"` sibling input
      carrying `name`/`disabled`/`required`/`readonly`/`value={JSON.stringify(rows)}` (R-10).
      Depends on: T002.
- [X] T012 [US1] Implement `src/lib/components/ui/key-value/key-value-list.svelte` (List): reads
      the root context through `getKeyValueContext('KeyValue.List')`, which throws
      ``<KeyValue.List> must be used within <KeyValue.Root>.`` when absent (upstream
      `key-value.tsx:72-73` via `useStore`); `orientation` prop (`"vertical"` default) driving
      `data-orientation` and `flex-col`/`flex-row`, `role="list"`; iterates
      `{#each root.value as item (item.id)}` and renders the caller's `children` snippet inside the
      per-row provider from T013 — the caller writes the row template once and the List instantiates
      it per row (R-02). Depends on: T011.
- [X] T013 [US1] Implement `src/lib/components/ui/key-value/key-value-item-provider.svelte`
      (internal, not exported): one instance per row, constructs `KeyValueItemState` for that row's
      id and publishes it via `setKeyValueItemContext`, then renders the List's row-template
      snippet. Depends on: T011, T002.
- [X] T014 [US1] Implement `src/lib/components/ui/key-value/key-value-item.svelte` (Item): reads
      the item context (throws ``<KeyValue.Item> must be used within <KeyValue.List>.`` when
      absent), `role="listitem"`, `data-slot="key-value-item"`, `data-highlighted` when
      `root.focusedId === item.id`. Depends on: T012, T013.
- [X] T015 [P] [US1] Implement
      `src/lib/components/ui/key-value/key-value-key-input.svelte` (KeyInput): composes
      `Editable.Root triggerMode="focus"` → `Editable.Area` → `Editable.Preview` + `Editable.Input`
      (R-03); `disabled`/`readOnly`/`required` OR-ed with the root's; writes go through
      `KeyValueRootState.setField(id, 'key', text)`; consumes the one-shot focus request in an
      `$effect` — when `root.focusRequestId === item.id`, clear it inside `untrack` via
      `root.consumeFocusRequest(item.id)` and set this field's `Editable` root to editing, so
      `editable`'s own focus-and-select runs (research R-08); this is what makes FR-002 and US1.3's
      focus destinations real; `autocapitalize="off"` `autocomplete="off"` `autocorrect="off"`
      `spellcheck="false"`; `aria-invalid`/`aria-describedby` on both control and preview; `onpaste`
      intercepts multi-line text via `KeyValueRootState.pasteInto` (caller's `onpaste` runs first,
      `preventDefault()` suppresses the built-in); trailing-whitespace push-back per plan.md
      bespoke-behaviour item 4; throws ``<KeyValue.KeyInput> must be used within <KeyValue.List>.``
      outside the item context. Depends on: T014.
- [X] T016 [P] [US2] Implement
      `src/lib/components/ui/key-value/key-value-value-input.svelte` (ValueInput): same `Editable`
      composition as KeyInput but through `Editable.Input`'s `child` snippet rendering a
      `<textarea class="field-sizing-content min-h-9 resize-none">` (R-04, mandatory because
      `Editable.Input` alone renders an `<input>`); `maxRows` sets
      `style="max-height: calc({maxRows} * 1.5em + 1rem)"` plus `overflow-y-auto`; `Enter` submits
      rather than inserting a newline (divergence D-2); focus-and-select-on-edit-start wired
      manually since `child` mode hands `ref` back to the caller; writes go through
      `KeyValueRootState.setField(id, 'value', text)`; `aria-invalid` and `aria-describedby` →
      `root.errorId(item.id, 'value')` on both the `<textarea>` control and the preview whenever the
      row has a value error (FR-007); `autocapitalize="off"` `autocomplete="off"` `autocorrect="off"`
      `spellcheck="false"` on the control (upstream `key-value.tsx:690-694`); trailing-whitespace
      push-back per plan.md bespoke-behaviour item 4 and research R-13, which applies to this field
      as well as the key field; throws
      ``<KeyValue.ValueInput> must be used within <KeyValue.List>.`` outside the item context.
      Depends on: T014.
- [X] T017 [P] [US1] Implement `src/lib/components/ui/key-value/key-value-remove.svelte` (Remove):
      wraps `$lib/components/ui/button` defaulted to `type="button" variant="outline" size="icon"`,
      `children` defaults to `<XIcon />`; `aria-label` defaults to `"Remove"` and is overridable
      through `...restProps` (FR-022 / D-13); `disabled` forced when
      `root.disabled || root.readOnly || count <= minItems`; a caller `onclick` runs first but never
      suppresses removal (upstream parity); on successful removal, requests focus on the next row's
      key field, or the previous row's when the removed row was last (R-08); `data-slot=
      "key-value-remove"`; throws ``<KeyValue.Remove> must be used within <KeyValue.List>.``
      outside the item context. Depends on: T014.
- [X] T018 [P] [US1] Implement `src/lib/components/ui/key-value/key-value-add.svelte` (Add): wraps
      `$lib/components/ui/button` defaulted to `type="button" variant="outline"`, `children`
      defaults to `<PlusIcon data-icon="inline-start" /> Add`; `disabled` forced when
      `root.disabled || root.readOnly || (maxItems !== undefined && count >= maxItems)`; on
      successful add, requests focus on the newly appended row's key field in edit mode;
      `data-slot="key-value-add"`; throws ``<KeyValue.Add> must be used within <KeyValue.Root>.``
      (the root, not the list) outside the root context. Depends on: T011.
- [X] T019 [P] [US3] Implement `src/lib/components/ui/key-value/key-value-error.svelte` (Error):
      `field: "key" | "value"` prop; renders nothing when the row has no error for `field`;
      otherwise `<span role="alert" id={errorId(itemId, field)} class="font-medium text-destructive
      text-sm">`; `data-slot="key-value-error"`, `data-field={field}`; throws
      ``<KeyValue.Error> must be used within <KeyValue.List>.`` outside the item context.
      Depends on: T014.

**Checkpoint**: all nine part files exist and compile against the state module; Phase 2's test
tasks can now import real components (still through the not-yet-existing barrel — Phase 4 wires
that).

---

## Phase 4: Barrel and types

- [X] T020 Create `src/lib/components/ui/key-value/index.ts`: import all nine `.svelte` files
      (`Root`, `List`, `Item`, `KeyInput`, `ValueInput`, `Remove`, `Add`, `Error`, plus the internal
      provider is **not** exported here); re-export short names, prefixed aliases (`KeyValue`,
      `KeyValueList`, `KeyValueItem`, `KeyValueKeyInput`, `KeyValueValueInput`, `KeyValueRemove`,
      `KeyValueAdd`, `KeyValueError`), and every `export type` (`KeyValueRootProps` +
      `KeyValueProps` alias, `KeyValueListProps`, `KeyValueItemProps`, `KeyValueKeyInputProps`,
      `KeyValueValueInputProps`, `KeyValueRemoveProps`, `KeyValueAddProps`, `KeyValueErrorProps`);
      re-export the runtime values from `key-value.svelte.ts` per contracts/public-api.md
      (`KeyValueRootState`, `KeyValueItemState`, `getKeyValueContext`/`setKeyValueContext`,
      `getKeyValueItemContext`/`setKeyValueItemContext`, `createKeyValueItemId`,
      `parseKeyValueText`, `stripSurroundingQuotes`, and the value types). Depends on: T011–T019.

**Checkpoint**: `import * as KeyValue from '$lib/components/ui/key-value/index.js'` resolves; run
`pnpm run test:unit -- --run src/lib/components/ui/key-value/key-value.test.ts` — all Phase 2 tasks
must now pass.

---

## Phase 5: Demo route

One `<ComponentPreview>` section per upstream `key-value-*-demo.tsx`, all in the same file
(`src/routes/docs/components/key-value/+page.svelte`), so none of these are `[P]`.

- [X] T021 [US1] Scaffold `src/routes/docs/components/key-value/+page.svelte` (heading, intro
      paragraph, `<svelte:head><title>Key Value — svelte-dice-ui</title></svelte:head>`) and add the
      **Default** `<ComponentPreview>` section mirroring `key-value-demo.tsx`: `KeyValue.Root` with
      one empty row, `KeyValue.List` containing the row template (`KeyInput`, `ValueInput` rendered
      as `<KeyValue.ValueInput placeholder="Test" />` to mirror `key-value-demo.tsx:17`, `Remove`),
      `KeyValue.Add` below the list. Depends on: T020.
- [X] T022 [US2] Add the **With Paste Support** `<ComponentPreview>` section to
      `src/routes/docs/components/key-value/+page.svelte`, mirroring `key-value-paste-demo.tsx`,
      including the three-line `KEY=VALUE` callout block from quickstart.md §4. Depends on: T021.
- [X] T023 [US3] Add the **With Validation** `<ComponentPreview>` section to
      `src/routes/docs/components/key-value/+page.svelte`, mirroring
      `key-value-validation-demo.tsx`, seeded with `API_KEY` / `invalid key` / `DATABASE_URL` rows
      and wired `onKeyValidate`/`onValueValidate`. Depends on: T021.
- [X] T024 [US1] Add the **With Form** `<ComponentPreview>` section to
      `src/routes/docs/components/key-value/+page.svelte`, mirroring `key-value-form-demo.tsx`
      using this project's existing form-adjacent primitives (`$lib/components/ui/field`) per spec
      Assumptions/D-12 (a labelled field, a submit action, a toast/inline result, empty keys
      blocking submit) instead of react-hook-form + zod; then add the per-part props tables and the
      keyboard-interactions table (contracts/public-api.md "Keyboard contract") matching the layout
      of `src/routes/docs/components/editable/+page.svelte`. Depends on: T021.

**Checkpoint**: `pnpm run build` succeeds including `/docs/components/key-value`.

---

## Phase 6: Registry entry and docs polish

- [X] T025 Append exactly one entry to `registry.json` at the repository root: `"name":
      "key-value"`, `"type": "registry:ui"`, `"title": "Key Value"`, a one-line `"description"`,
      `"registryDependencies": ["editable", "button", "direction-provider", "checkbox-group"]`,
      `"dependencies": ["@lucide/svelte"]`, and a `"files"` array listing all eleven files under
      `src/lib/components/ui/key-value/` **except** `key-value.test.ts` and
      `key-value.test.svelte` (the nine `.svelte` parts, `key-value.svelte.ts`, `index.ts`, each
      `"type": "registry:ui"`). Then run `pnpm run registry:build` and confirm
      `static/r/key-value.json` is produced with the same dependency lists (quickstart.md §5).
      Depends on: T020, T024.

**Checkpoint**: `pnpm run registry:build` succeeds with no cross-component import missing its
`registryDependency` (verify step from commit `4f81f61`).

---

## Phase 7: Verification (MANDATORY — Principle VII)

- [X] T026 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and
      `pnpm run build`, and fix everything that fails. Depends on: T001–T025 (including T004a). Run
      `pnpm run format` first if any file is not yet Prettier-formatted (shadcn/CLI-shaped output
      commonly isn't). No `@ts-ignore`/`@ts-expect-error`/`eslint-disable`/`svelte-ignore`/`as any`/
      `.skip`/`.todo`/deleted assertions/loosened configs may be used to reach green — fix the root
      cause.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Tests (Phase 2)**: depends on T002 (state module) and T003 (harness) from Setup; all eight
  tasks write into `key-value.test.ts`, so they run sequentially, not in parallel, and are expected
  to fail until Phase 3–4 land.
- **Core component files (Phase 3)**: T011 (Root) depends on T002; T012 (List) depends on T011;
  T013 (provider) depends on T011 + T002; T014 (Item) depends on T012 + T013; T015/T016/T017/T018/
  T019 each depend on T014 (T018 depends on T011 directly, since `Add` lives outside `List`) and are
  mutually `[P]` — five different leaf files, no interdependency among them.
- **Barrel and types (Phase 4)**: T020 depends on all of Phase 3 (T011–T019).
- **Demo route (Phase 5)**: T021 depends on T020; T022/T023/T024 depend on T021 (same file, appended
  sections, so sequential).
- **Registry entry and docs polish (Phase 6)**: T025 depends on T020 (file list) and T024 (demo
  route must exist for the docs index to link correctly).
- **Verification (Phase 7)**: T026 depends on everything — the last phase, always run.

### User Story Coverage

- **US1** (build the list — P1): T004, T004a, T005–T006, T008, T011–T015, T017, T018, T021, T024.
- **US2** (paste — P2): T009, T016, T022.
- **US3** (validation — P2): T007, T010, T019, T023.

Each story's tasks are independently exercisable once Phase 4 (barrel) is done — US1's flows do
not require paste or validation to be configured, US2's flows work on top of a plain list, and
US3's flows work whether or not paste is enabled.

### Parallel Opportunities

- T001 and T003 can run in parallel (different files, both only need the directory).
- Within Phase 3, T015 (KeyInput), T016 (ValueInput), T017 (Remove), T018 (Add), T019 (Error) can
  all run in parallel once T014 (T018 once T011) is done — five different files, no shared state
  beyond the already-published contexts.
- No two Phase 2 tasks are parallel (same file `key-value.test.ts`); no two Phase 5 tasks are
  parallel (same file `+page.svelte`).

---

## Parallel Example: Phase 3 leaf parts

```bash
# Once T014 (Item) is done, launch together:
Task: "Implement key-value-key-input.svelte (KeyInput)"      # T015
Task: "Implement key-value-value-input.svelte (ValueInput)"  # T016
Task: "Implement key-value-remove.svelte (Remove)"           # T017
Task: "Implement key-value-error.svelte (Error)"             # T019
# T018 (Add) only needs T011 (Root) and can join this batch too.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and the US1-relevant slice of Phase 2 (T004–T006, T008).
2. Complete the US1-relevant slice of Phase 3 (T011–T015, T017, T018) plus T016 stubbed only enough
   to satisfy the barrel's type surface if paste/validation tests are deferred — in practice it is
   simpler to build all nine parts together since List/Item/KeyInput/ValueInput share one context
   chain.
3. Complete Phase 4 (barrel) — Phase 2's US1 tests should now pass.
4. **STOP and VALIDATE**: run
   `pnpm run test:unit -- --run src/lib/components/ui/key-value/key-value.test.ts` and confirm the
   US1 assertions are green.

### Incremental Delivery

1. Setup + state module → Tests written (red) → all nine parts + barrel → Tests green (US1, US2,
   US3 all land together in practice, since Phase 3 builds every part in one dependency chain).
2. Demo route → Registry entry → Verification.
3. Each phase leaves the previous phase's output intact — no phase invalidates an earlier one.

---

## Notes

- `[P]` tasks touch different files with no unmet dependency; tasks that write into the same file
  (`key-value.test.ts`, `+page.svelte`) are never `[P]`.
- `[Story]` traces a task to spec.md's US1/US2/US3 for independent-test purposes only; it does not
  reorder the fixed phase sequence requested for this feature.
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X).
- Do NOT touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json` or
  `.port-logs/`.
- Compose `editable` for both fields (T015, T016) rather than reimplementing inline editing — do
  not edit the already-shipped `src/lib/components/ui/editable/` folder itself (Principle X/IV).

---

## Phase 8: Convergence

**Purpose**: Close the gaps found by auditing the shipped port against spec.md, plan.md,
contracts/public-api.md and the pinned upstream source. The four quality gates are green as of this
audit (`check` 0 errors, `lint` clean, 1871 tests passing, `build` succeeding), and the demo route
and `registry.json` entry are complete — everything below is behaviour or assertions that the
artifacts require and the code does not yet deliver.

- [X] T027 CRITICAL: forward `<KeyValue.ValueInput>`'s caller-supplied event handlers in
      `src/lib/components/ui/key-value/key-value-value-input.svelte`. The `control` snippet spreads
      `...restProps` before `...props`, and `EditableInputChildProps` ends with
      `onblur`/`oninput`/`onkeydown` (`editable-input.svelte:148-169`), so a caller's `oninput`,
      `onblur` or `onkeydown` on the value field is overwritten by `editable`'s own handlers and
      never runs — while the key field, which hands `...restProps` to `<Editable.Input>`, forwards
      them correctly. Upstream calls `propsRef.current.onChange?.(event)` before its own handling
      (`key-value.tsx:626-628`, `:704`), and contracts/public-api.md promises "event/DOM props
      passed through `...restProps` land on the `<textarea>` control". Destructure those handlers
      and pass them to `<Editable.Input>` (which already invokes the caller's first and honours
      `preventDefault()`), keeping the remaining `restProps` on the `<textarea>`; then add tests in
      `src/lib/components/ui/key-value/key-value.test.ts` asserting a caller `oninput` on
      `<KeyValue.ValueInput>` fires on every keystroke and a caller `onkeydown` sees `Enter`.
      per Constitution II / contracts: KeyValue.ValueInput (contradicts)
- [X] T028 [US3] Assert the value field's ARIA wiring in
      `src/lib/components/ui/key-value/key-value.test.ts`: with a failing `onValueValidate`, both
      `[data-slot="key-value-value-input-control"]` and `[data-slot="key-value-value-input-preview"]`
      carry `aria-invalid="true"` and an `aria-describedby` equal to the rendered
      `<KeyValue.Error field="value">`'s `id`, and both attributes are absent once the value
      validates. Today only the key field is asserted (`key-value.test.ts:154-177`), although T004
      requires the assertion "on both the `KeyInput`/`ValueInput` control and preview" and Principle
      III makes ARIA wiring a mandatory test area. per T004 / FR-007 / SC-004 (missing)
- [X] T029 [US2] Restore upstream's `onpaste` ordering in
      `src/lib/components/ui/key-value/key-value-key-input.svelte`: return before invoking the
      caller's `onpaste` when `root.enablePaste` is false, matching `key-value.tsx:481-484`, which
      gates on `enablePaste` first and only then calls `propsRef.current.onPaste?.(event)`. The port
      currently calls the caller's handler unconditionally, which is drift that appears in no entry
      of the D-1…D-13 divergence register (Principle II: "undocumented drift is a defect"). Keep the
      existing `disabled`/`readOnly` suppression inside `pasteInto` (recorded divergence D-4). Add a
      test asserting a caller `onpaste` on `<KeyValue.KeyInput>` does not fire with
      `enablePaste={false}` and still fires ahead of the built-in handling otherwise.
      per Constitution II (contradicts)
- [X] T030 [US1] Add a keyboard-only build-a-list test to
      `src/lib/components/ui/key-value/key-value.test.ts`: starting from the single seeded row and
      using `@testing-library/user-event` with no pointer events at all, `Tab` into the key field,
      type, `Tab` to the value field, type, `Tab` to the add button, activate it with `{Enter}` (and
      a second row with `{ }`/Space) and confirm each activation appends a row whose key field takes
      focus in edit mode — repeating until five rows exist — then activate a `KeyValue.Remove` from
      the keyboard and confirm focus lands on the documented neighbouring key field. Every existing
      add/remove test drives the buttons with `user.click`, so the "without needing the mouse at any
      point" claim is currently unproven. per SC-001 (missing)

**Checkpoint**: re-run `pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build`; all
must stay green with nothing suppressed.
