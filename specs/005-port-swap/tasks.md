---
description: 'Task list for the Swap component port'
---

# Tasks: Swap Component Port

**Input**: Design documents from `specs/005-port-swap/` (plan.md, spec.md, research.md, data-model.md,
contracts/swap-public-api.md, quickstart.md)

**Prerequisites**: plan.md (loaded), spec.md (loaded), research.md, data-model.md, contracts/swap-public-api.md,
quickstart.md — all present and read.

**Tests**: Tests are MANDATORY (constitution Principle III / VII). Every task below writes to real repository
paths; no task may be satisfied by a suppression (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`,
`svelte-ignore`, `as any`, `.skip`/`.todo`, deleted assertions, loosened config).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency)
- **[Story]**: Traceability tag to spec.md's User Story 1 (click), 2 (hover), 3 (controlled/disabled) where a
  task is scoped to a single story; cross-cutting tasks (context plumbing, RTL, edge cases, reduced motion,
  registry, gates) carry no tag
- Every description names its exact file path(s)

## Path Conventions

- Component source: `src/lib/components/ui/swap/` — parts, `swap.svelte.ts`, `index.ts`
- Tests: colocated at `src/lib/components/ui/swap/swap.test.ts`, harness at `swap.test.svelte`
- Demo route: `src/routes/docs/components/swap/+page.svelte`
- Registry: `registry.json` at the repository root, generated output at `static/r/swap.json`

---

## Phase 1: Setup (dependencies)

**Purpose**: Scaffolding and dependency confirmation before any code is written.

- [X] T001 [P] Create the empty directories `src/lib/components/ui/swap/` and
      `src/routes/docs/components/swap/`; confirm against `package.json` that zero new dependencies are
      needed (`bits-ui`, `clsx`, `tailwind-merge`, `@lucide/svelte` are already installed, per plan.md's
      Technical Context — no `pnpm add`).
- [X] T002 [P] No-op placeholder — the registry entry is written once, complete, in Phase 6 (see T019),
      because `registry.json` is imported directly by `src/lib/registry.ts` to drive the docs sidebar and
      an incomplete stub entry (empty `files`) would make `/docs/components` list a component whose route
      does not exist yet, and would not be a valid shadcn registry item if `pnpm run registry:build` or
      `pnpm run build` ran in that window. (M3 remediation — folded into T019.)

**Checkpoint**: Directories exist, no new deps required.

---

## Phase 2: Tests (write first — MUST fail until Phase 3–5 land)

**Purpose**: Colocated tests for every behavioural area in quickstart.md's 13 validation scenarios, written
against the not-yet-implemented public API so they fail for the right reason (missing implementation, not a
typo) until Phase 3–5 complete.

- [X] T003 [P] Create the test harness component `src/lib/components/ui/swap/swap.test.svelte` per plan.md's
      Implementation sequence step 5: wraps `Swap.Root`/`Swap.On`/`Swap.Off` to exercise `bind:swapped`, the
      `child` snippet, a `DirectionProvider`-wrapped RTL variant, and reports the bound `ref` through a
      callback prop, so `swap.test.ts` can render controlled/`child`/RTL cases without inline markup
      duplication.
- [X] T004 [US1] Write the keyboard-interaction test group in `src/lib/components/ui/swap/swap.test.ts`:
      `userEvent.tab()` focuses the root in click mode; `{Enter}` and `{ }` (Space) each toggle `data-state`
      `off → on → off`; the `Space` keydown is asserted `defaultPrevented` (no page scroll); hover mode is
      asserted unreachable by `Tab` and has no keydown handling. (quickstart scenarios 2, 4; FR-008, SC-003)
- [X] T005 Write the accessibility roles-and-names test group in `src/lib/components/ui/swap/swap.test.ts`:
      click mode exposes `role="button"` with `aria-pressed` reflecting `data-state`; hover mode exposes
      `queryByRole('button')` as `null` with no `aria-pressed`/`tabindex` (FR-009); `disabled` sets
      `aria-disabled="true"` and `data-disabled=""` and removes `tabindex` from the tab order; and — with
      `disabled: true` — `userEvent.click()`, `userEvent.hover()`/`unhover()` (in an
      `activationMode="hover"` instance) and `{Enter}`/`{ }` on the focused root each leave `data-state`
      unchanged on the root and on both faces, with the `onSwappedChange` spy never called. (quickstart
      scenarios 1, 4, 7; FR-007, FR-008, FR-009, US3 acceptance scenario 2)
      Also assert the accessible name: rendering with `aria-label: 'Toggle theme'` in `restProps` makes
      `screen.getByRole('button', { name: 'Toggle theme' })` resolve, and `aria-labelledby` pointing at an
      external `<span id>` resolves the same way (the `status.test.ts` accessible-name convention). (FR-009a)
- [X] T006 [US3] Write the controlled-vs-uncontrolled test group in `src/lib/components/ui/swap/swap.test.ts`:
      `defaultSwapped: true` seeds `data-state="on"` with zero interaction; using the T003 harness with
      `bind:swapped` and an `onSwappedChange` spy, a click calls the spy with the next boolean and a
      parent-driven write to the bound value moves the faces without re-invoking the spy (research D-002).
      (quickstart scenarios 5, 6; FR-004, FR-005)
- [X] T007 Write the RTL test group in `src/lib/components/ui/swap/swap.test.ts`: render the T003 harness's
      `<DirectionProvider dir="rtl">` variant and assert click, hover and keyboard transitions produce the
      identical `data-state` sequence as the LTR case — no inversion, per spec.md's Edge Cases and
      Constitution Principle III. (quickstart scenario 12)
- [X] T008 Write the edge-cases test group in `src/lib/components/ui/swap/swap.test.ts`: `render(SwapOn)`
      and `render(SwapOff)` outside `<Swap>` each throw `` /must be used within `<Swap>`/ `` (FR-013);
      omitting both `swapped` and `defaultSwapped` starts `data-state="off"`; a consumer `onclick` and
      `onkeydown` handler that calls `preventDefault()` suppresses the built-in toggle for that event only
      (driven through `userEvent`); for `onmouseenter`/`onmouseleave` the same guard is asserted by
      dispatching `new MouseEvent('mouseenter', { bubbles: false, cancelable: true })` directly on the
      root, and a companion assertion records that a plain `userEvent.hover()` still swaps because
      `mouseenter` is non-cancelable (FR-014). (quickstart scenarios 10, 11; spec.md Edge Cases)
- [X] T009 Write the reduced-motion test in `src/lib/components/ui/swap/swap.test.ts`: `vi.stubGlobal`
      `window.matchMedia` to report `matches: true` for `(prefers-reduced-motion: reduce)`; assert the root
      renders `data-motion="reduce"`, the `SwapOn`/`SwapOff` elements carry no `transition-all`/`duration-300`
      class, and a click still produces the identical `data-state` `off → on` sequence as the animated case;
      call `vi.unstubAllGlobals()` in a local `afterEach` inside this file only (`tests/setup.ts` stays
      untouched). (quickstart scenario 9; FR-012, SC-004)
- [X] T010 Write the core click-toggle and hover-preview interaction tests in
      `src/lib/components/ui/swap/swap.test.ts`: in click mode, `userEvent.click()` toggles `data-state`
      `off → on → off` on the root and both faces; in hover mode, `userEvent.hover()` sets the swapped face
      while the pointer is over the component and `userEvent.unhover()` reverts it, while a click in hover
      mode changes nothing. (quickstart scenarios 1, 3; FR-002, FR-003)
      Using the T003 harness with `bind:swapped` and an `onSwappedChange` spy on an
      `activationMode="hover"` root, assert that `userEvent.hover()` calls the spy exactly once with `true`
      and writes `true` back to the bound value, that `userEvent.unhover()` calls it exactly once with
      `false`, and that a repeated hover with no intervening unhover does not call it again (the
      `Object.is` short-circuit in `setSwapped`). (quickstart scenarios 3, 6; FR-003, FR-005)
- [X] T011 Write the animation-variant and composition tests in `src/lib/components/ui/swap/swap.test.ts`:
      each of `animation="fade"|"rotate"|"flip"|"scale"` is reflected in the root's `data-animation`
      (default `fade` when omitted); caller `class` wins over the internal class list; unknown `restProps`
      are forwarded to the rendered element; `bind:ref` reports the root `HTMLDivElement`; the `child`
      snippet renders onto a caller-supplied element with merged `SwapChildProps`. Also render both
      `Swap.On` and `Swap.Off` through a `child` snippet from the T003 harness and assert the merged
      `SwapFaceChildProps` (including `data-slot` and the mirrored `data-state`) land on the caller's
      element. (quickstart scenarios 8, 13; FR-006)
- [X] T011a Write a module-exports test group in `src/lib/components/ui/swap/swap.test.ts`: both barrel
      import styles (`import * as Swap` and named imports) resolve the same values; `SWAP_ACTIVATION_MODES`
      and `SWAP_ANIMATIONS` hold the documented ordered tuples; `resolveSwapActivationMode('bogus')` and
      `resolveSwapAnimation('bogus')` each fall back to their documented default (the `status.test.ts`
      `resolveStatusVariant('bogus') === 'default'` convention); `getSwapDataState(true)` / `(false)` return
      `'on'` / `'off'`; `hasSwapContext()` returns `false` outside a root; and `useSwap()` called outside a
      root throws the documented provider error. (FR-015)

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/swap/swap.test.ts` fails (module not found /
assertions unmet) — expected, since Phase 3–5 have not run yet.

---

## Phase 3: Core component files

**Purpose**: The runes state/context module and the three rendered parts.

- [X] T012 Implement `src/lib/components/ui/swap/swap.svelte.ts`: the `SWAP_ACTIVATION_MODES` /
      `SWAP_ANIMATIONS` `as const` tuples; `resolveSwapActivationMode` / `resolveSwapAnimation` (unknown
      input falls back to the default) / `getSwapDataState`; the `SwapState` runes class from
      data-model.md §1 (getter-function constructor props, `swapped`/`activationMode`/`animation`/
      `disabled`/`reducedMotion`/`isClickMode`/`dataState` derived members, `toggle()` with the `!disabled`
      guard, and `setSwapped`'s `Object.is` short-circuit before both the assignment and
      `onSwappedChange`); the `Symbol('swap')` context trio `setSwapContext` / `hasSwapContext` /
      `getSwapContext(part?)` throwing `` `<part>` must be used within `<Swap>`. `` and `useSwap()`
      delegating to it; the `ReducedMotionReader` class and `useReducedMotion()` reader from data-model.md
      §2 (SSR-guarded initial read, `$effect` subscription to the `matchMedia` `change` event with a
      teardown that removes the listener).
- [X] T013 Implement `src/lib/components/ui/swap/swap.svelte`: the module-script `SwapRootProps` type
      (JSDoc/`@default` copied verbatim from contracts/swap-public-api.md §2) extending
      `WithElementRef<HTMLAttributes<HTMLDivElement>>`; `ref`/`swapped` as `$bindable`, `swapped ??=
      defaultSwapped` seeding; a `SwapState` instance built from getter functions (including
      `useReducedMotion()`'s `current`); the four composed `onclick`/`onmouseenter`/`onmouseleave`/
      `onkeydown` handlers that run the consumer's handler first and only invoke the matching `SwapState`
      transition when `!event.defaultPrevented` (FR-014, data-model.md's Transitions table); the `$derived`
      `rootAttrs` object emitting `role`/`aria-pressed`/`aria-disabled`/`data-slot="swap"`/`data-state`/
      `data-animation`/`data-disabled`/`data-motion`/`tabindex` per data-model.md §5; `ROOT_CLASSES` (from
      contracts/swap-public-api.md §2) merged with caller `class` via `cn()` from `$lib/utils.js`; the
      `child` snippet branch vs. the default `<div>` + `children` branch; `setSwapContext(state)` called
      during initialisation. Depends on T012.
- [X] T014 [P] Implement `src/lib/components/ui/swap/swap-on.svelte`: the module-script `SwapOnProps` type
      extending `WithElementRef<HTMLAttributes<HTMLDivElement>>`; `getSwapContext('<SwapOn>')` read at the
      top of the instance script; `data-slot="swap-on"` and `data-state` mirroring
      `getSwapContext().dataState`; the upstream `SwapOn` class list from contracts/swap-public-api.md §3,
      emitting the `transition-all duration-300` pair only when `!reducedMotion`; the `child` snippet branch
      vs. the default `<div>` + `children` branch. Depends on T012.
- [X] T015 [P] Implement `src/lib/components/ui/swap/swap-off.svelte`: the mirror of T014 as `SwapOffProps` /
      `getSwapContext('<SwapOff>')` / `data-slot="swap-off"`, using the on/off-inverted class list from
      contracts/swap-public-api.md §3 (`data-[state=on]:absolute`, `data-[state=on]:opacity-0`, etc.).
      Depends on T012.

**Checkpoint**: `SwapState`, `ReducedMotionReader` and all three parts exist; Phase 2's tests progress further
but the barrel is still missing.

---

## Phase 4: Barrel and types

- [X] T016 Implement `src/lib/components/ui/swap/index.ts` per contracts/swap-public-api.md §7: import
      `Root`/`On`/`Off` from the three `.svelte` files; re-export `SwapRootProps`/`SwapChildProps` (from
      `swap.svelte`), `SwapOnProps` (from `swap-on.svelte`), `SwapOffProps` (from `swap-off.svelte`); export
      `SWAP_ACTIVATION_MODES`, `SWAP_ANIMATIONS`, `SwapState`, `ReducedMotionReader`, `getSwapContext`,
      `getSwapDataState`, `hasSwapContext`, `resolveSwapActivationMode`, `resolveSwapAnimation`,
      `setSwapContext`, `useReducedMotion`, `useSwap`, and the `SwapActivationMode`/`SwapAnimation`/
      `SwapDataState`/`SwapFaceChildProps` types from `swap.svelte.js`; export `Root`/`On`/`Off` alongside
      the `Swap`/`SwapOn`/`SwapOff` aliases. Depends on T013, T014, T015.

**Checkpoint**: `import * as Swap from '$lib/components/ui/swap/index.js'` resolves; run
`pnpm run test:unit -- --run src/lib/components/ui/swap/swap.test.ts` — all Phase 2 tests should now pass.

---

## Phase 5: Demo route

- [X] T017 [US1] [US2] Implement `src/routes/docs/components/swap/+page.svelte` with the page heading/intro
      and the "Click to swap" and "Hover to swap" `<ComponentPreview>` sections (mirroring `swap-demo.tsx`'s
      two labelled halves), using `ComponentPreview` from `$lib/components/docs/index.js`, `* as Swap` from
      `$lib/components/ui/swap/index.js`, and `@lucide/svelte` sun/moon icons, following the structure of
      `src/routes/docs/components/stat/+page.svelte`. Every `Swap.Root` in a preview carries an `aria-label`
      describing its action (e.g. `aria-label="Toggle theme"`, `aria-label="Toggle mute"`), per FR-009a.
- [X] T018 [US3] Add the "Animations" preview (a four-tile grid, one per `fade`/`rotate`/`flip`/`scale`,
      mirroring `swap-animations-demo.tsx`) and the "Controlled" preview (`bind:swapped` plus
      `onSwappedChange` wired to a visible logged value) to
      `src/routes/docs/components/swap/+page.svelte`, plus a props table and a data-attribute table below
      the previews (per FR-016, spec.md SC-006). Each of the four animation tiles and the controlled
      preview likewise carries an `aria-label`; the props table documents that consumers must supply one
      for icon-only faces. Depends on T017 (same file).

**Checkpoint**: `/docs/components/swap` renders all four previews with no console errors.

---

## Phase 6: Registry entry and docs polish

- [X] T019 Append the complete `swap` entry to `registry.json` at the repository root per
      contracts/swap-public-api.md §8 in one step (no stub, no later replace — see T002): `name: "swap"`,
      `type: "registry:ui"`, `title: "Swap"`, `description` (from contracts/swap-public-api.md §8),
      `registryDependencies: []`, `dependencies: []`, and `files` listing
      `src/lib/components/ui/swap/index.ts`, `swap.svelte`, `swap-on.svelte`, `swap-off.svelte`, and
      `swap.svelte.ts` (each `type: "registry:ui"`); `swap.test.ts` and `swap.test.svelte` stay excluded.
      Depends on T016.
- [X] T020 Run `pnpm run registry:build` to regenerate `static/r/swap.json` from the completed `registry.json`
      entry. Depends on T019.

**Checkpoint**: `static/r/swap.json` exists and matches the five source files.

---

## Phase 7: Verification (MANDATORY — Principle VII)

**Purpose**: The feature is not complete until all gates are green. No suppressions
(`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, deleted
assertions, loosened configs) may be used to reach green — fix the root cause.

- [X] T021 Run `pnpm run format` across every file this port touched (shadcn/generator-style output is not
      Prettier-formatted, and this repo's Tailwind class order depends on it).
- [X] T022 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, and fix
      everything that fails.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001/T002 run in parallel.
- **Tests (Phase 2)**: Depends on Setup (directories must exist). T003 (harness) is parallel to T004–T011a;
  T004–T011a all write `swap.test.ts` and run strictly in sequence.
- **Core (Phase 3)**: Depends on Tests existing (TDD — they must fail first). T012 blocks T013–T015; T014 and
  T015 are parallel to each other once T012 lands.
- **Barrel (Phase 4)**: Depends on all of Phase 3 (T013, T014, T015).
- **Demo (Phase 5)**: Depends on Barrel (T016). T018 depends on T017 (same file).
- **Registry (Phase 6)**: T019 depends on the finished file set (T016) and writes the complete
  `registry.json` entry in one step (T002 is a no-op placeholder — see M3 remediation); T020 depends on
  T019.
- **Verification (Phase 7)**: Depends on everything above — always the last phase.

### Parallel Opportunities

- Phase 1: T001, T002.
- Phase 2: T003 alongside the first task of T004–T011a (different file); T004–T011a themselves are
  sequential (same file, `swap.test.ts`).
- Phase 3: T014 and T015 once T012 is done.
- No other cross-task parallelism — Phase 4 through Phase 7 each depend on the immediately preceding phase.

---

## Parallel Example: Phase 3

```bash
# After T012 (swap.svelte.ts) lands, T013 must run first (root creates the context);
# T014 and T015 only need the context helpers from T012 and can then run together:
Task: "Implement src/lib/components/ui/swap/swap-on.svelte"
Task: "Implement src/lib/components/ui/swap/swap-off.svelte"
```

---

## Implementation Strategy

1. Phase 1 (Setup) → Phase 2 (Tests, written to fail) → Phase 3 (Core) → Phase 4 (Barrel) — at this
   checkpoint every Phase 2 test should pass and User Stories 1–3 are all exercised by `swap.test.ts`.
2. Phase 5 (Demo) makes the port visible on `/docs/components/swap`; Phase 6 makes it installable via the
   registry.
3. Phase 7 is the non-negotiable gate: `format` → `check` → `lint` → `test:unit -- --run` → `build`, all
   green, nothing skipped or suppressed.

Do NOT run git write commands — the orchestrator owns the working tree (Constitution Principle X).

---

## Phase 8: Convergence

- [X] T023 Add a test in `src/lib/components/ui/swap/swap.test.ts`'s "edge cases" group asserting the
      `preventDefault()` escape hatch for a consumer `onmouseleave` handler: with an
      `activationMode="hover"` harness instance already hovered (`data-state="on"`), attach an
      `onmouseleave` spy that calls `event.preventDefault()`, dispatch a cancelable `mouseleave` event
      directly on the root (mirroring the existing non-cancelable-`mouseenter` test at lines 316-330),
      and assert `data-state` remains `"on"` (the built-in swap-to-off is suppressed) while a plain
      `userEvent.unhover()` afterward still reverts it to `"off"` (`mouseleave` is non-cancelable in a
      real gesture, matching the `mouseenter` companion assertion already present) per FR-014 (partial)
