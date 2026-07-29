---
description: 'Task list for the Pending utility port'
---

# Tasks: Pending Utility

**Input**: Design documents from `/specs/003-port-pending/` (plan.md, spec.md, research.md,
data-model.md, contracts/pending-api.md, quickstart.md)

**Tests**: Tests are MANDATORY (Constitution Principle III / VII). No `.skip`/`.todo`, no
suppressions anywhere in this feature.

**Phase order** (per this feature's task-generation brief): Setup → Tests → Core component files →
Barrel and types → Demo route → Registry entry and docs polish → Verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 (busy state on submit), US2 (wrapper/`child` snippet), US3 (styling hooks) — see
  spec.md
- Every task names a concrete, repository-root-relative file path

---

## Phase 1: Setup

**Purpose**: No new dependency exists for this feature (plan.md confirms no npm package, no
`shadcn-svelte add`). Setup is limited to confirming the target folders and the registry stub.

- [X] T001 Confirm `src/lib/components/ui/pending/` does not yet exist and create the empty
      directory `src/lib/components/ui/pending/`
- [X] T002 Confirm `src/routes/docs/components/pending/` does not yet exist and create the empty
      directory `src/routes/docs/components/pending/`
- [X] T003 Re-read `.reference/diceui/docs/registry/bases/radix/components/pending.tsx`,
      `.reference/diceui/docs/types/radix/pending.ts`,
      `.reference/diceui/docs/content/docs/utilities/radix/pending.mdx`, and the five
      `.reference/diceui/docs/registry/bases/radix/examples/pending-*-demo.tsx` files to confirm no
      upstream API surface was missed before writing tests (read-only, no file produced)

**Checkpoint**: Target directories exist; upstream contract re-confirmed. No dependency changes were
needed.

---

## Phase 2: Tests (write first — MUST fail before implementation exists)

**Purpose**: Author the colocated test suite and its harness against the documented contract
(contracts/pending-api.md, quickstart.md S1–S13) before any implementation file exists, per
Constitution Principle III/VII. All tasks in this phase target the same two files, so none are
`[P]` against each other; they run sequentially in the order listed to keep the diff reviewable, but
none blocks Phase 1.

- [X] T004 [US1] Create the prop-driven test harness
      `src/lib/components/ui/pending/pending.test.svelte` — accepts `isPending`, `disabled`, `id`,
      `dir`, and boolean flags selecting button/form/link/switch/wrapper rendering modes (the form
      mode renders a `<form onsubmit={spy}>` containing an `<input required>` and the pending submit
      button), so `usePending()` can be exercised during component initialisation and `bind:ref`/
      snippet props have a real parent (quickstart.md prerequisites)
- [X] T005 [US1] In `src/lib/components/ui/pending/pending.test.ts`, write the roles/ARIA/accessible
      name suite (quickstart S1): render through the harness with `isPending` true, assert
      `getByRole('button', { name: 'Submit' })` resolves, `aria-busy="true"`, `aria-disabled="true"`,
      `data-pending=""` are present and the child element keeps its own `data-slot` (e.g.
      `data-slot="button"`), proving `pendingProps` does not clobber it, and no native
      `disabled`/`tabindex` is set; assert all attributes disappear when `isPending` toggles back to
      `false`
- [X] T006 [US1] In `src/lib/components/ui/pending/pending.test.ts`, write the pointer-prevention
      suite (quickstart S2): with `isPending` true and an `onclick` spy spread before
      `{...pendingProps}`, assert `user.click()` never calls the spy and a manually dispatched
      cancelable `click` has `defaultPrevented === true`; repeat for `pointerdown`, `pointerup`,
      `mousedown`, `mouseup`
- [X] T007 [US1] In `src/lib/components/ui/pending/pending.test.ts`, write the keyboard-prevention
      and focus-retention suite (quickstart S3): `user.tab()` to the pending element and assert
      `toHaveFocus()`; assert `Enter` and `' '` are prevented and fire no action; assert
      `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown`/`Home`/`End`/`Escape`/`Tab` are **not**
      prevented and move focus normally
- [X] T007a [US1] In `src/lib/components/ui/pending/pending.test.ts`, write the
      form-submission-prevention suite (SC-002, FR-004): render the harness in form mode with
      `isPending` true and assert that `await user.click(submitButton)` and
      `await user.keyboard('{Enter}')` from a focused text input both leave the `onsubmit` spy
      uncalled; flip `isPending` to false and assert the spy fires exactly once
- [X] T008 [US1] In `src/lib/components/ui/pending/pending.test.ts`, write the idle-spread-safety
      test (quickstart S4): with `isPending` false, spread `{...pendingProps}` last over a button
      carrying an `onclick` spy and assert the spy fires exactly once, proving handler keys are
      omitted rather than set to `undefined`
- [X] T009 [US2] In `src/lib/components/ui/pending/pending.test.ts`, write the wrapper merge-mode
      suite (quickstart S5): render `<Pending.Root isPending>` with a `child` snippet around one
      `<button>` and assert `container.querySelectorAll('button')` has length 1 with both the
      button's own `class`/`type` and the pending attributes present — no extra wrapper node; also
      assert the attribute set produced by `usePending` directly, by `child` mode and by fallback
      mode are identical for the same inputs (compare the serialized `id`/`aria-*`/`data-*` attributes
      of the hosting element in each case) — contract W-05, FR-008
- [X] T010 [US2] In `src/lib/components/ui/pending/pending.test.ts`, write the wrapper fallback-mode
      suite (quickstart S6): render `<Pending.Root isPending>` with plain `children` and assert a
      single `<span data-slot="pending" class="contents">` carries the ARIA/data attributes — and
      that `data-slot="pending"` appears on this fallback `<span>` only, never on the inner button —
      and that clicking the inner button does not call its `onclick` spy while pending, but does when
      `isPending` is false; also assert that the inner button does **not** carry `aria-busy`/
      `aria-disabled` while the `<span>` does, pinning the documented fallback-mode accessibility
      limitation (plan.md divergence D1/D2, spec.md Assumptions)
- [X] T011 [US2] In `src/lib/components/ui/pending/pending.test.ts`, write the link-and-switch
      composition suite (quickstart S7): `child` snippet around `<a href="/x">` — click is
      `defaultPrevented`, `href` unchanged, anchor keeps focus; `child` snippet around
      `$lib/components/ui/switch` — `user.click` while pending leaves `aria-checked` unchanged and
      exposes `data-pending`, and toggles normally when not pending; `child` snippet around
      `$lib/components/ui/input` — while pending the input still receives focus via `user.tab()` and
      carries `aria-busy`/`data-pending`, and typing is unaffected (no key other than Enter/Space is
      prevented)
- [X] T012 [US1] In `src/lib/components/ui/pending/pending.test.ts`, write the
      controlled/uncontrolled suite (quickstart S8): omitting `isPending` never shows pending
      attributes; passing `isPending` and re-rendering with a new value moves the attributes without
      remount and the value never changes on its own
- [X] T013 [US3] In `src/lib/components/ui/pending/pending.test.ts`, write the `disabled`
      independence suite (quickstart S9): `disabled` true + `isPending` false shows only
      `data-disabled=""` and clicks fire normally; both true shows both attributes and interaction is
      prevented
- [X] T014 [US1] In `src/lib/components/ui/pending/pending.test.ts`, write the id-generation suite
      (quickstart S10): explicit `id` used verbatim; omitted `id` matches `/^pending-/` (or the
      wrapper's generated `uid` value) and is stable across a rerender; two instances get different
      ids
- [X] T015 [US2] In `src/lib/components/ui/pending/pending.test.ts`, write the RTL suite (quickstart
      S11): render the harness with `dir="rtl"` and assert identical attributes and prevention
      behaviour to LTR, with no arrow-key side effects
- [X] T016 [US2] In `src/lib/components/ui/pending/pending.test.ts`, write the missing-child guard
      rail test (quickstart S12): `expect(() => render(Pending.Root, { props: { isPending: true }
      })).toThrow(/requires exactly one child/)`; assert supplying both `child` and `children`
      renders only the `child` output
- [X] T017 [US1] In `src/lib/components/ui/pending/pending.test.ts`, write the barrel-surface
      suite (quickstart S13): assert `Pending.Root`, `Pending.Pending === Pending.Root`,
      `usePending`, `PendingState`, and `createPendingId` are all defined and importable both as a
      namespace and by name

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/pending/pending.test.ts` fails
(module not found) — implementation has not started yet. This is expected and required before Phase
3.

---

## Phase 3: Core component files

**Purpose**: Implement `pending.svelte.ts` then `pending.svelte` against the failing suite from
Phase 2. These two files are sequential (the component imports the module), so neither is `[P]`.

- [X] T018 [US1] Implement `createPendingId()` (module-scoped incrementing counter, `pending-<n>`),
      the `UsePendingOptions` type, the `PendingAttributes` type, and the `PendingState` class (with
      `$derived` `id`/`isPending`/`disabled` and `$derived.by` `pendingProps` built per
      data-model.md Entities 2–3: `id` always present (no `data-slot` — see plan.md divergence D7);
      `aria-busy`/`aria-disabled`/`data-pending` only when `isPending`; `data-disabled` only when
      `disabled`; `onclick`/
      `onpointerdown`/`onpointerup`/`onmousedown`/`onmouseup`/`onkeydown`/`onkeyup` only when
      `isPending`, calling `event.preventDefault()` and, for the two keyboard handlers, only for
      `Enter`/`' '`) and the exported `usePending(options?)` function, in
      `src/lib/components/ui/pending/pending.svelte.ts`
- [X] T019 [US1] Export `UsePendingReturn` as a type alias of `PendingState` from
      `src/lib/components/ui/pending/pending.svelte.ts` (name parity with upstream, contracts/
      pending-api.md §1)
- [X] T020 [US2] Implement `src/lib/components/ui/pending/pending.svelte`: the `PendingRootProps`
      type (module script, `WithElementRef<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>` plus
      `id`/`isPending`/`disabled`/`class`/`children`/`child`) and the `PendingChildProps` type; the
      instance script declares `const uid = $props.id();` as a top-level `const` (the compiler
      rejects `$props.id()` in any other position — `props_id_invalid_placement` — and it mints a new
      id on every call, so it MUST NOT be called inside a getter or used as a destructuring default),
      leaves `id` as an undefaulted `id?: string` prop, and calls
      `usePending({ id: () => id || uid, isPending: () => isPending, disabled: () => disabled })` —
      `||` not `??`, so an empty-string `id` falls back (data-model.md Entity 1, research.md R5); when
      `child` is supplied, render it with
      `{ props: { ...restProps, class: cn(className), ...pendingProps } }` (pending keys spread
      last, data-model.md Entity 4); when only `children` is supplied, render a
      `<span bind:this={ref} data-slot="pending" class={cn('contents', className)} {...restProps}
      {...pendingProps}>` with capture-phase `onclickcapture`/keyboard-capture handlers that also
      call `preventDefault()`/`stopPropagation()` while pending (W-04); when neither snippet is
      supplied, throw `` `<Pending>` requires exactly one child: pass it as \`children\`, or spread the merged props onto your own element with the \`child\` snippet. ``
      during render

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/pending/pending.test.ts` passes
for every `it` written in Phase 2 (harness now resolves real exports).

---

## Phase 4: Barrel and types

- [X] T021 Create `src/lib/components/ui/pending/index.ts` exporting `Root` (from
      `pending.svelte`) and `Pending` as its alias; `usePending`, `PendingState`, and
      `createPendingId` (from `pending.svelte.ts`); and re-exporting the types
      `PendingRootProps`, `PendingChildProps`, `PendingAttributes`, `UsePendingOptions`,
      `UsePendingReturn` — matching contracts/pending-api.md §1 exactly

**Checkpoint**: `import * as Pending from '$lib/components/ui/pending/index.js'` and
`import { Pending as PendingRoot, usePending } from '$lib/components/ui/pending/index.js'` both
type-check; the barrel-surface test (T017) passes.

---

## Phase 5: Demo route

- [X] T022 [P] Create `src/routes/docs/components/pending/+page.svelte` with the page heading,
      description, and the "Default" `<ComponentPreview>` section mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/pending-demo.tsx` (a button driven by
      `usePending` directly)
- [X] T023 [US2] Add the "Wrapper Component" `<ComponentPreview>` section to
      `src/routes/docs/components/pending/+page.svelte`, mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/pending-wrapper-demo.tsx`
      (`<Pending.Root>` with a `child` snippet around a `Button`) — depends on T022 (same file)
- [X] T024 [US1] Add the "Form with Pending State" `<ComponentPreview>` section to
      `src/routes/docs/components/pending/+page.svelte`, mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/pending-form-demo.tsx` (an `$state`
      boolean flipped by a simulated async action, per spec Assumptions on the missing
      `useFormStatus`/`useTransition` equivalent) — depends on T023 (same file)
- [X] T025 [US2] Add the "Navigation Links" `<ComponentPreview>` section to
      `src/routes/docs/components/pending/+page.svelte`, mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/pending-link-demo.tsx` (`child` snippet
      around an anchor) — depends on T024 (same file)
- [X] T026 [US2] Add the "Toggle Switches" `<ComponentPreview>` section to
      `src/routes/docs/components/pending/+page.svelte`, mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/pending-switch-demo.tsx` (`child`
      snippet around `$lib/components/ui/switch`) — depends on T025 (same file)
- [X] T027 Add the four API tables (`usePending` options, `usePending` return, `<Pending>` props,
      data attributes) to `src/routes/docs/components/pending/+page.svelte`, transcribed from
      contracts/pending-api.md §2–§4, and include a callout on the demo page stating that `child`
      (merge) mode is required when the busy state must reach assistive technology, since fallback
      mode hosts `aria-busy`/`aria-disabled` on the `display:contents` wrapper rather than the
      interactive descendant (spec.md FR-008, Assumptions) — depends on T026 (same file)

**Checkpoint**: `/docs/components/pending` renders five `<ComponentPreview>` sections and four API
tables (quickstart.md "Manual demo check", SC-004).

---

## Phase 6: Registry entry and docs polish

- [X] T028 Append the `pending` entry to the root `registry.json` `items` array — `name: "pending"`,
      `type: "registry:ui"`, `title: "Pending"`, the description from contracts/pending-api.md §5,
      `registryDependencies: []`, `dependencies: []`, and the three `files` entries for `index.ts`,
      `pending.svelte`, `pending.svelte.ts` (test files excluded) — depends on T021 (barrel must
      exist as listed)
- [X] T029 Run `pnpm run registry:build` to regenerate `static/r/pending.json` — depends on T028

**Checkpoint**: `registry.json` has exactly one new `pending` entry; `static/r/pending.json` exists.

---

## Phase 7: Verification (MANDATORY — Constitution Principle VII)

**Purpose**: The feature is not complete until all four gates are green. No suppressions
(`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`,
deleted assertions, loosened configs) may be used to reach green — fix the root cause.

- [X] T030 Run `pnpm run format`, then `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run`
      and `pnpm run build`, and fix everything that fails

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no dependencies — start immediately.
- **Phase 2 (Tests)**: depends on Phase 1 (directories must exist to hold the new files); must be
  authored, and observed failing, before Phase 3 begins (Principle III/VII "tests first").
- **Phase 3 (Core component files)**: depends on Phase 2 existing (tests are the executable spec);
  T018 before T019 before T020 (T019 extends the same file as T018; T020 imports from T018/T019).
- **Phase 4 (Barrel and types)**: depends on Phase 3 (T018–T020 must export what T021 re-exports).
- **Phase 5 (Demo route)**: depends on Phase 4 (the demo imports the barrel); T022–T027 all touch
  the same file and run strictly in sequence.
- **Phase 6 (Registry entry and docs polish)**: depends on Phase 4 (T021, for the file list) — does
  not require Phase 5, but is ordered after it per the requested phase order.
- **Phase 7 (Verification)**: depends on everything above — the last phase, always run.

### Story-to-phase mapping

- **US1** (busy state on submit, P1): T004–T008, T007a, T012, T014, T017 (tests); T018–T019
  (implementation); T022, T024 (demo).
- **US2** (wrapper composition, P2): T009–T011, T015–T016 (tests); T020 (implementation); T023,
  T025, T026 (demo).
- **US3** (styling hooks, P3): T013 (tests); covered by T018's `data-disabled` derivation; no
  dedicated demo section (data attributes are exercised across all five demo sections and documented
  in the T027 API table).

### Parallel opportunities

- T001 and T002 are `[P]` — different, unrelated directories.
- T022 is `[P]` as the first section added to a brand-new file; T023–T027 each depend on the
  previous task because they append to the same `+page.svelte`.
- Phase 3's T018/T019 (one file) and T020 (a second file that imports the first) are not parallel.

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Complete Phase 1 (Setup).
2. Complete the US1-tagged tests in Phase 2 (T004–T008, T012, T014, T017).
3. Complete Phase 3's `pending.svelte.ts` (T018–T019) and enough of `pending.svelte` (T020) to
   satisfy US1 (the `children`-fallback path is sufficient; `child` mode is US2).
4. **Stop and validate**: `pnpm run test:unit -- --run src/lib/components/ui/pending/pending.test.ts`
   green for the US1 suite.

### Incremental delivery

1. Setup → Foundation ready (no foundational phase beyond directory creation — this is a
   single-entity utility with no shared state to bootstrap).
2. US1 tests + implementation → validate independently (busy button, keyboard/pointer prevention,
   ARIA).
3. US2 tests + `child`-snippet implementation → validate independently (wrapper merge mode, link,
   switch).
4. US3 test (`disabled` independence) → already satisfied by T018's derivation; validate the
   assertion passes.
5. Demo route, registry entry, and the four quality gates close out the feature.
