# Quickstart / Validation Guide: `editable`

**Feature**: `023-port-editable` | **Date**: 2026-07-31

How to prove the port works end to end. Everything here is runnable and non-interactive.

## Prerequisites

```bash
pnpm install --frozen-lockfile   # already satisfied in the port pipeline
```

No new dependency is introduced (research R-17). If `pnpm install` wants to change the lockfile, the
implementation has added a dependency it should not have.

## 1. Quality gates (the definitive check)

Run in this order, from the repository root:

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

Expected: all five succeed with zero errors and zero warnings. Per constitution VII, a gate made green
by `@ts-ignore`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, a deleted assertion, or
a loosened config is an invalid result regardless of exit code.

To run only this component's spec:

```bash
pnpm run test:unit -- --run src/lib/components/ui/editable/editable.test.ts
```

## 2. Scenario checks

Each maps to a user story in [spec.md](./spec.md); the test case names come from
[contracts/upstream-test-map.md](./contracts/upstream-test-map.md).

### US1 — Edit with the mouse (P1)

1. Render the `default` harness with `defaultValue="Initial Value"`.
2. Click the preview (`getByRole('button')`).
3. **Expect**: a `textbox` exists, holds `"Initial Value"`, is `document.activeElement`, and its
   selection spans the whole value (`selectionStart === 0 && selectionEnd === 13`). The preview is
   gone from the document.
4. Type a new value, click the submit button.
5. **Expect**: `onSubmit` called with the new text, the textbox is gone, the preview shows the new
   text.
6. Repeat but click cancel. **Expect**: the preview shows `"Initial Value"` again.

### US2 — Edit with the keyboard (P1)

1. `await user.tab()` until the preview has focus, press `Enter`.
2. **Expect**: same focused-and-selected input as US1 step 3.
3. Type, press `Enter`. **Expect**: `onSubmit` with the typed text; edit mode ends.
4. Re-enter, type, press `Escape`. **Expect**: value reverted, edit mode ended, and
   `document.activeElement` is the preview (or the external trigger in the `with-trigger` harness) —
   this is divergence D-1, absent upstream.

### US3 — Trigger modes and state surface (P2)

| Setup                        | Expect                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `triggerMode="dblclick"`     | single click does nothing; double click enters edit mode                    |
| `triggerMode="focus"`        | focusing the preview enters edit mode                                       |
| empty value + `placeholder`  | preview shows the placeholder and carries `data-empty=""`                   |
| `disabled`                   | no interaction enters edit mode; label/area/preview carry `data-disabled=""` |
| `readOnly`                   | no preview at all; the textbox is present with `readonly` and rejects typing |

### US4 — Composition (P3)

1. Render the `with-trigger` harness. Click the external trigger → edit mode starts; the trigger
   unmounts. With `forceMount`, it stays.
2. **Expect**: `label[for]` equals the input's `id`; the input's `aria-labelledby` equals the label's
   `id`.
3. **Expect**: cancel and submit buttons are absent before editing and present during it.

### Form integration (FR-017)

1. Render the `with-form` harness with `name="title"` and `required`, value empty.
2. Click the native submit button. **Expect**: the form does **not** submit (constraint validation
   blocks it — reachable only because of divergence D-5).
3. Give it a value and submit. **Expect**: the form submits and the clipped
   `[data-slot="editable-form-input"]` carries `name="title"` and the current value.

## 3. Visual / manual validation (demo route)

The build gate compiles every demo route, so `pnpm run build` proves the page type-checks and renders.
For a human look, the page is at `/docs/components/editable`, with one section per upstream example:

| Section          | Upstream demo                    | What it proves                                            |
| ---------------- | -------------------------------- | ----------------------------------------------------------- |
| Default          | `editable-demo.tsx`              | label, preview/input swap, external trigger + toolbar via `child` snippets onto `<Button>` |
| With Double Click| `editable-double-click-demo.tsx` | `triggerMode="dblclick"`                                   |
| With Autosize    | `editable-autosize-demo.tsx`     | `autosize` — the measured width, which jsdom cannot show    |
| Todo List        | `editable-todo-list-demo.tsx`    | many roots in a list, `onSubmit` writing back to page state, icon trigger |
| With Form        | `editable-form-demo.tsx`         | two fields, `invalid` state, toolbar; plain `$state` validation instead of `react-hook-form` + `zod` (spec Assumptions) |

Plus nine props tables and the keyboard table (SC-005).

Do **not** start `pnpm dev` in the port pipeline (constitution: no watch modes, no dev servers).

## 4. Registry validation

```bash
pnpm run registry:build
```

Expected: `static/r/editable.json` is produced, inlines all 11 component files (not the two test
files), and rewrites `$lib/...` imports to registry placeholders. The repository also has a
cross-component import check — every `$lib/components/ui/*` import in the component must appear in the
entry's `registryDependencies` (`direction-provider`, `checkbox-group`).

## 5. Definition of done

- [ ] All five commands in §1 green, with no suppression anywhere in the diff.
- [ ] Every case in `contracts/upstream-test-map.md` §1 and §2 exists and passes.
- [ ] Every attribute in `contracts/data-attributes.md` is emitted.
- [ ] Every export in `contracts/public-api.md` §1 exists.
- [ ] Five `<ComponentPreview>` sections + nine props tables on `/docs/components/editable`.
- [ ] Exactly one new `registry.json` entry, `pnpm run registry:build` re-run.
- [ ] No file touched outside `specs/023-port-editable/`, `src/lib/components/ui/editable/`,
      `src/routes/docs/components/editable/`, `registry.json` and `static/r/`.
