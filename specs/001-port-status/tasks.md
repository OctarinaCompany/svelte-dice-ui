---
description: 'Dependency-ordered task list for the Status port'
---

# Tasks: Port Status Component

**Input**: Design documents from `specs/001-port-status/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (user stories),
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/status-public-api.md](./contracts/status-public-api.md),
[contracts/registry-item.json](./contracts/registry-item.json), [quickstart.md](./quickstart.md)

**Tests**: MANDATORY. Constitution Principle III requires colocated tests at
`src/lib/components/ui/status/status.test.ts`; Principle VII forbids `.skip` / `.todo` / emptied
assertions. Every `it` must assert (`expect.requireAssertions` is on) and `globals: false` means
`describe`/`it`/`expect`/`vi` are imported explicitly from `vitest`.

**Organization**: Phases follow the pipeline's linear build order —
Setup → Foundational → Tests → Core component files → Barrel and types → Demo route →
Registry entry and docs polish → Verification. Story traceability is preserved with `[US1]`/`[US2]`/
`[US3]` labels on every task that delivers part of a user story, and per-story checkpoints are listed
under [Story Checkpoints](#story-checkpoints). This linear ordering (rather than one phase per story)
is deliberate: all three stories are delivered by the same four source files and the same single test
file, so story-per-phase would force the same files to be reopened three times.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `US1` (labelled badge, P1), `US2` (animated indicator, P2), `US3` (render onto a
  caller element, P3)
- Every task names concrete file paths relative to the repository root

## Path Conventions

- **Component source**: `src/lib/components/ui/status/` — `status.svelte`,
  `status-indicator.svelte`, `status-label.svelte`, `index.ts`
- **Tests**: `src/lib/components/ui/status/status.test.ts` (+ harness `status.test.svelte`)
- **Demo route**: `src/routes/docs/components/status/+page.svelte`
- **Registry**: `registry.json` at the repository root
- **No** `status.svelte.ts` and **no** context module — Status holds no reactive state and its parts
  never communicate (plan.md Decision 3 / research.md Decision 3). Do not create them.

---

## Phase 1: Setup

**Purpose**: Confirm the (empty) dependency delta, create the two folders, and stage the registry
entry without writing it yet.

- [x] T001 [P] Verify the dependency budget read-only: confirm `package.json` already pins
      `tailwind-variants` (^3.3.0), `clsx`, `tailwind-merge` and `svelte` ^5.56, and confirm
      `src/app.css` already declares `--success`, `--warning`, `--info` (+ `-foreground`) for both
      `:root` and `.dark` and exposes them through `@theme inline`. Install nothing; do not edit
      `package.json` or `src/app.css` (plan.md § Dependency Budget).
- [x] T002 [P] Create the two empty folders `src/lib/components/ui/status/` and
      `src/routes/docs/components/status/`.
- [x] T003 [P] Stage the registry entry: confirm `registry.json` currently has `"items": []` and read
      `specs/001-port-status/contracts/registry-item.json` — that object is appended verbatim in
      T028. Do **not** append it now: `src/routes/docs/components/+page.svelte` calls
      `resolve(component.route)` for every `registry:ui` item, so an entry that exists before
      `src/routes/docs/components/status/+page.svelte` would point at a non-existent route id.

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: The test harness component that the `bind:ref` and `child`-snippet specs need. A `.ts`
test file cannot express `bind:` or a `{#snippet child({ props })}` with props, so one prop-driven
`.svelte` harness is required first (research.md Decision 9).

**⚠️ Blocks Phase 3.**

- [x] T004 Create `src/lib/components/ui/status/status.test.svelte` — a prop-driven harness with a
      `<script lang="ts" module>` exporting its `Props` type and an instance script taking:
      `variant?: StatusVariant`, `class?: string`, `label?: string`, `showIndicator?: boolean`,
      `showLabel?: boolean`, `useChild?: boolean`, `href?: string`, `onclick?`, plus
      `rootRef = $bindable<HTMLDivElement | null>(null)`,
      `indicatorRef = $bindable<HTMLDivElement | null>(null)` and
      `labelRef = $bindable<HTMLDivElement | null>(null)`. It renders
      `<Status.Root bind:ref={rootRef} …>` in the normal branch and, when `useChild` is true, a
      `{#snippet child({ props })}<a {href} {...props}>…</a>{/snippet}`. Imports the component
      through the barrel (`import * as Status from './index.js'`). It is **not** collected by Vitest
      (`include` is `.{js,ts}`) and **not** listed in `registry.json`.

**Checkpoint**: harness compiles conceptually against the contract; it will not run until Phase 4
lands the source files — that is expected (tests are written before implementation).

---

## Phase 3: Tests (MANDATORY — Principle III) ⚠️

**Purpose**: Write the full spec suite first and confirm it FAILS before any source file exists.

All tasks in this phase edit the same file, `src/lib/components/ui/status/status.test.ts`, so **none
of them are `[P]`** — they are strictly sequential. One task per behavioural area, following the
[test suite map](./quickstart.md#test-suite-map).

- [x] T005 [US1] Scaffold `src/lib/components/ui/status/status.test.ts`: explicit
      `import { describe, expect, it, vi } from 'vitest'`,
      `import { render, screen } from '@testing-library/svelte'` (add `within` only if a scoped query
      is actually written — `@typescript-eslint/no-unused-vars` is an `error`, and Principle VI
      forbids the `eslint-disable` escape),
      `import userEvent from '@testing-library/user-event'`,
      `import { createRawSnippet } from 'svelte'`, a local `text(s)` helper built on
      `createRawSnippet` that renders the string inside a `span` (the snippet-as-children pattern in
      `CLAUDE.md` §7), and **both** barrel consumption styles so the barrel shape is covered by the
      type checker: `import * as Status from './index.js'` **and**
      `import { StatusIndicator, StatusLabel, resolveStatusVariant, STATUS_VARIANTS, type StatusVariant } from './index.js'`,
      plus `import Harness from './status.test.svelte'`. Add the eight top-level `describe` blocks
      (`Status`, `variants`, `StatusIndicator`, `StatusLabel`, `composition`, `child snippet`,
      `keyboard`, `accessibility and RTL`) to be filled by T006–T016. This eight-suite list and the
      matching row in plan.md § Convention Decisions are authoritative: the table in `quickstart.md`
      § Test suite map folds the keyboard assertions into its `child snippet` row for brevity, but
      `keyboard` is its own suite here (T014) because it also covers the non-interactive default
      badge.
- [x] T006 [US1] In `src/lib/components/ui/status/status.test.ts` `describe('Status')`: renders a
      `div` carrying `data-slot="status"`; renders `children`; the caller's `class` is merged **last**
      and wins a conflict (`class="rounded-none"` beats the base `rounded-full`); `restProps` are
      forwarded (`id`, `aria-label`, `data-testid`); an `onclick` passed through `restProps` fires via
      `userEvent.click`; `bind:ref` populates the element through `Harness`; the root carries every
      base utility from `contracts/status-public-api.md` §5 verbatim (`inline-flex`, `w-fit`,
      `shrink-0`, `items-center`, `gap-1.5`, `overflow-hidden`, `whitespace-nowrap`, `rounded-full`,
      `border`, `px-2.5`, `py-1`, `text-xs`, `font-medium`, `transition-colors`) — so a base-row
      parity regression fails the test gate, not just the T030 audit
      (covers FR-001, FR-008, FR-009).
- [x] T007 [US1] In `src/lib/components/ui/status/status.test.ts` `describe('variants')`: iterate
      `STATUS_VARIANTS` and assert for each that the root has the matching `data-variant` and the
      exact token classes from the class map in `contracts/status-public-api.md` §5, including the
      `**:data-[slot=status-indicator]:bg-…` class that colours the dot; assert that omitting
      `variant` yields `data-variant="default"` (covers FR-002, FR-007, SC-002).
- [x] T008 [US1] In `src/lib/components/ui/status/status.test.ts`
      `describe('variants › variant is an input, not internal state')`: the
      controlled/uncontrolled equivalent for this component — re-rendering with a new `variant`
      changes `data-variant`, and the badge never changes its own `data-variant` in response to
      interaction (`userEvent.click` on the root leaves `data-variant` unchanged). Add a one-line
      comment stating that literal controlled/uncontrolled `value` + `onValueChange`,
      `disabled`/`readOnly` and out-of-provider assertions are **not applicable** — Status exposes no
      value, no disabled state and no context provider (plan.md § Constitution Check, Principle III
      note).
- [x] T009 [US1] In `src/lib/components/ui/status/status.test.ts`
      `describe('variants › edge cases')`: `resolveStatusVariant('bogus')` → `'default'`,
      `resolveStatusVariant(undefined)` → `'default'`; rendering with
      `'bogus' as unknown as StatusVariant` (one-line comment: simulates untyped runtime data — a
      union double-assert, never `any`) yields `data-variant="default"` and the default token
      classes; a very long label leaves the root with the upstream clipping utilities
      (`w-fit`, `whitespace-nowrap`, `overflow-hidden`) and no wrapping utility (spec Edge Cases,
      research.md Decision 7; the `STATUS_VARIANTS` / `resolveStatusVariant` assertions also cover
      the exported programmatic surface of FR-014).
- [x] T010 [US2] In `src/lib/components/ui/status/status.test.ts` `describe('StatusIndicator')`:
      renders with `data-slot="status-indicator"`; carries the verbatim pseudo-element classes
      (`before:animate-ping`, `before:bg-inherit`, `after:bg-inherit`, `size-2`, `rounded-full`);
      caller `class` merged last; `restProps` forwarded; `bind:ref` populates via `Harness`
      (covers FR-003).
- [x] T011 [US1] In `src/lib/components/ui/status/status.test.ts` `describe('StatusLabel')`: renders
      with `data-slot="status-label"` and `leading-none`; renders its text content; caller `class`
      merged last; `restProps` forwarded; `bind:ref` populates via `Harness` (covers FR-004).
- [x] T012 [US2] In `src/lib/components/ui/status/status.test.ts` `describe('composition')`: all four
      permutations render without error — indicator + label, label only, indicator only, neither —
      and the DOM order of the parts follows markup order; a bare `StatusIndicator` / `StatusLabel`
      rendered outside a root does **not** throw (no provider exists, by design — data-model.md
      Entity 4) (covers FR-005).
- [x] T013 [US3] In `src/lib/components/ui/status/status.test.ts` `describe('child snippet')`: with
      `Harness useChild href="/status"`, the caller's `<a>` carries `data-slot="status"`,
      `data-variant` and the variant classes; `document.querySelector('div[data-slot="status"]')` is
      `null` (no wrapper element is introduced); `screen.getByRole('link', { name: 'Online' })`
      resolves; `children` is **not** rendered when `child` is supplied; `rootRef` stays `null`
      because the caller owns the element (covers FR-006, US3 AS1 and AS2).
- [x] T014 [US3] In `src/lib/components/ui/status/status.test.ts` `describe('keyboard')`: the default
      (non-interactive) badge is not reached by `userEvent.tab()`; in `child` mode the rendered link
      **is** reached by `userEvent.tab()`, receives focus (`toHaveFocus`), keeps its accessible name
      (the label text), and `{Enter}` invokes the handler passed through `restProps` (covers FR-013;
      spec Edge Cases — focus; Constitution III keyboard requirement).
- [x] T015 [US1] In `src/lib/components/ui/status/status.test.ts`
      `describe('accessibility and RTL')` — roles and names: the component adds no implicit role
      (`screen.queryByRole('status')` is `null`, no `role` attribute on any part); for every variant
      the label text is present and readable, proving state is conveyed without colour; in `child`
      mode the accessible name is exactly the label text (covers FR-011, SC-004).
- [x] T016 [US1] In `src/lib/components/ui/status/status.test.ts`
      `describe('accessibility and RTL')` — RTL: rendered inside a `dir="rtl"` container the root's
      class list contains no physical-direction utility (`ml-`, `mr-`, `left-`, `right-`, `pl-`,
      `pr-`) — only logical flex layout — and the DOM order of indicator and label is unchanged, so
      visual order follows the ambient direction (covers FR-010).

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/status/status.test.ts` fails
because the source files do not exist yet. That failure is the gate for Phase 4.

---

## Phase 4: Core component files

**Purpose**: The three parts, one file each, mapped 1:1 onto
`.reference/diceui/docs/registry/bases/radix/ui/status.tsx`.

- [x] T017 [US1] Write the `<script lang="ts" module>` of
      `src/lib/components/ui/status/status.svelte`: export
      `STATUS_VARIANTS = ['default','success','error','warning','info'] as const`, the derived
      `StatusVariant` type, `resolveStatusVariant(value?: string): StatusVariant` (membership test,
      falls back to `'default'`), the `statusVariants` `tv()` table reproducing
      `contracts/status-public-api.md` §5 **verbatim** (base classes unchanged; the five variant rows
      using only `muted`/`success`/`destructive`/`warning`/`info` tokens; `defaultVariants: { variant: 'default' }`),
      the `StatusChildProps` type from `data-model.md` Entity 2, and
      `StatusRootProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & { variant?: StatusVariant; child?: Snippet<[{ props: StatusChildProps }]> }`
      with the upstream JSDoc for `variant` (including `@default "default"`) and the `child` JSDoc
      copied verbatim from `contracts/status-public-api.md` §2. Import `cn` from `$lib/utils.js` and
      `tv` from `tailwind-variants`; `.js` extensions on intra-repo imports.
- [x] T018 [US1] Write the instance script and default branch of
      `src/lib/components/ui/status/status.svelte`: a single `$props()` destructure
      (`ref = $bindable(null)`, `variant = 'default'`, `class: className`, `children`, `child`,
      `...restProps`), `const resolved = $derived(resolveStatusVariant(variant))`, and a `$derived`
      `rootAttrs` object `{ 'data-slot': 'status', 'data-variant': resolved, class: cn(statusVariants({ variant: resolved }), className), ...restProps }`;
      render `<div bind:this={ref} {...rootAttrs}>{@render children?.()}</div>`. No `$effect`, no
      `window`/`document` access — the component stays SSR-safe.
- [x] T019 [US3] Add the `child` branch to `src/lib/components/ui/status/status.svelte`:
      `{#if child}{@render child({ props: rootAttrs })}{:else}…{/if}` — the snippet replaces the
      `<div>` entirely, `children` is not rendered and `ref` is not populated in that branch, exactly
      as the JSDoc from T017 states (delivers FR-006 / US3).
- [x] T020 [P] [US2] Create `src/lib/components/ui/status/status-indicator.svelte`: module script
      exports `StatusIndicatorProps = WithElementRef<HTMLAttributes<HTMLDivElement>>`; instance script
      destructures `ref = $bindable(null)`, `class: className`, `children`, `...restProps`; renders a
      `<div bind:this={ref} data-slot="status-indicator" class={cn('relative flex size-2 shrink-0 rounded-full before:absolute before:inset-0 before:animate-ping before:rounded-full before:bg-inherit after:absolute after:inset-[2px] after:rounded-full after:bg-inherit', className)} {...restProps}>`
      with `{@render children?.()}`. `data-slot="status-indicator"` is load-bearing — the root's
      variant classes colour the dot through it (data-model.md Entity 3).
- [x] T021 [P] [US1] Create `src/lib/components/ui/status/status-label.svelte`: same prop shape,
      exporting `StatusLabelProps`; renders
      `<div bind:this={ref} data-slot="status-label" class={cn('leading-none', className)} {...restProps}>`
      with `{@render children?.()}`.

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/status/status.test.ts` still fails
only on the missing barrel — Phase 5 closes it.

---

## Phase 5: Barrel and types

- [x] T022 Create `src/lib/components/ui/status/index.ts` exactly as
      `contracts/status-public-api.md` §1: `import Root from './status.svelte'`,
      `import Indicator from './status-indicator.svelte'`, `import Label from './status-label.svelte'`;
      re-export `statusVariants`, `STATUS_VARIANTS`, `resolveStatusVariant`, `type StatusVariant`,
      `type StatusRootProps`, `type StatusChildProps` from `'./status.svelte'`,
      `type StatusIndicatorProps` from `'./status-indicator.svelte'`, `type StatusLabelProps` from
      `'./status-label.svelte'`; then the component export block — short names `Root`, `Indicator`,
      `Label`, a bare `//` separator line, then the prefixed aliases `Root as Status`,
      `Indicator as StatusIndicator`, `Label as StatusLabel`. `.js` extensions everywhere;
      `type` keyword on every type re-export (`verbatimModuleSyntax`). This barrel is the
      programmatic surface FR-014 requires — dropping `statusVariants` (an upstream export),
      `STATUS_VARIANTS` or `resolveStatusVariant` is a parity defect (covers FR-014).

**Checkpoint**: the whole suite from Phase 3 passes —
`pnpm run test:unit -- --run src/lib/components/ui/status/status.test.ts` is green. US1, US2 and US3
are all implemented and independently verified at this point.

---

## Phase 6: Demo route

**Purpose**: One `<ComponentPreview>` per upstream `status-*-demo.tsx`, plus an API reference
(Principle IX). All tasks edit the same file, `src/routes/docs/components/status/+page.svelte`, so
none are `[P]`.

- [x] T023 [US1] Create `src/routes/docs/components/status/+page.svelte` with the page shell —
      `import { ComponentPreview } from '$lib/components/docs/index.js'`,
      `import * as Status from '$lib/components/ui/status/index.js'`, a `<svelte:head><title>Status — svelte-dice-ui</title></svelte:head>`,
      an `<article class="flex flex-col gap-10">` with the `<h1>Status</h1>` + description block —
      and the first section `<ComponentPreview title="Default" description="Mirrors status-demo.tsx.">`
      reproducing `.reference/diceui/docs/registry/bases/radix/examples/status-demo.tsx`. No
      `+page.ts`.
- [x] T024 [US1] Add the `<ComponentPreview title="Variants" description="Mirrors status-variants-demo.tsx.">`
      section to `src/routes/docs/components/status/+page.svelte`, reproducing
      `.reference/diceui/docs/registry/bases/radix/examples/status-variants-demo.tsx` — the five
      labelled groups (Success, Error, Warning, Info, Default), each a wrapped row of badges.
- [x] T025 [US2] Add the `<ComponentPreview title="Text Only" description="Mirrors status-text-only-demo.tsx.">`
      section to `src/routes/docs/components/status/+page.svelte`, reproducing
      `.reference/diceui/docs/registry/bases/radix/examples/status-text-only-demo.tsx` — badges with
      `Status.Label` and no `Status.Indicator`, proving the indicator is optional (FR-005).
- [x] T026 [US1] Add the `<ComponentPreview title="Service Status List" description="Mirrors status-list-demo.tsx.">`
      section to `src/routes/docs/components/status/+page.svelte`, reproducing
      `.reference/diceui/docs/registry/bases/radix/examples/status-list-demo.tsx` — a `$state` array
      of services (name, status, uptime) iterated with `{#each}` and a keyed block, each row a
      bordered card with a badge whose `Status.Label` uses `class="capitalize"`.
- [x] T027 Add the API reference to `src/routes/docs/components/status/+page.svelte` below the
      previews, built from `$lib/components/ui/table/index.js`: one props table per part
      (`Status` / `Status.Indicator` / `Status.Label`, columns Prop / Type / Default / Description,
      populated from `contracts/status-public-api.md` §2–§4) and one data-attributes table listing
      `data-slot` and the five `data-variant` values.

---

## Phase 7: Registry entry and docs polish

- [x] T028 Append the entry from `specs/001-port-status/contracts/registry-item.json` verbatim to the
      `items` array in `registry.json` (name `status`, type `registry:ui`, title `Status`,
      `registryDependencies: []`, `dependencies: ["tailwind-variants"]`, and the four shipped file
      paths — `index.ts`, `status.svelte`, `status-indicator.svelte`, `status-label.svelte`).
      `status.test.ts` and `status.test.svelte` must **not** appear.
- [x] T029 Run `pnpm run registry:build` and verify `static/r/status.json` was written: it inlines all
      four files, contains neither test file, and its `$lib/...` imports are rewritten to registry
      placeholders.
- [x] T030 Audit the four shipped files under `src/lib/components/ui/status/` against
      `specs/001-port-status/contracts/status-public-api.md`: every exported name, prop, default,
      `data-slot`, `data-variant` value and class-map row present, nothing extra (Principle II); and
      no `dark:` utility, no raw palette colour (`green-`, `orange-`, `blue-`, `red-`, `gray-`), no
      `space-x-`/`space-y-`, no manual `z-` anywhere in them (Principle VIII). Fix any drift in the
      source, not in the contract.
- [x] T031 Run `pnpm run format` so the new files and the edited `registry.json` are
      Prettier-formatted before the lint gate.

---

## Phase 8: Verification (MANDATORY — Principle VII)

**Purpose**: The port is complete only when all four gates are green, with zero suppressions
(`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`,
deleted assertions, loosened configs). Fix the root cause; a suppressed gate is an invalid result.

- [x] T032 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`,
      and fix everything that fails.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)** — no dependencies, starts immediately.
- **Phase 2 (Foundational)** — needs T002 (the folder). Blocks Phase 3.
- **Phase 3 (Tests)** — needs T004 (the harness). Strictly sequential within itself (one file).
- **Phase 4 (Core)** — starts after Phase 3 is written and failing.
- **Phase 5 (Barrel)** — needs T017–T021 (all three source files must exist to re-export from).
- **Phase 6 (Demo)** — needs T022 (the demo imports through the barrel).
- **Phase 7 (Registry & polish)** — T028 needs T023 (the route must exist before a registry entry
  points at it); T029 needs T028; T031 runs after every file edit.
- **Phase 8 (Verification)** — depends on everything above; always last.

### Task-level dependencies

- T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016
  (all in `status.test.ts` / its harness)
- T017 → T018 → T019 (all in `status.svelte`)
- T020, T021 independent of each other and of T017–T019
- T017–T021 → T022 → T023 → T024 → T025 → T026 → T027 → T028 → T029 → T030 → T031 → T032

### Parallel opportunities

- **Phase 1**: T001, T002, T003 all `[P]` — different files, no shared writes.
- **Phase 4**: T020 and T021 are `[P]` with each other and may run alongside T017–T019
  (three distinct files).
- **Nothing else is parallel by construction**: Phase 3 is one file, Phase 6 is one file, and Phase 7
  is a strict chain (`registry.json` → generated output → audit → format).

```bash
# Phase 1 — launch together:
Task: "Verify the dependency budget in package.json and src/app.css"
Task: "Create src/lib/components/ui/status/ and src/routes/docs/components/status/"
Task: "Stage the registry entry from specs/001-port-status/contracts/registry-item.json"

# Phase 4 — launch together:
Task: "Create src/lib/components/ui/status/status-indicator.svelte"
Task: "Create src/lib/components/ui/status/status-label.svelte"
```

---

## Story Checkpoints

Because all three stories share the same files, they are verified by running their own test suites
after Phase 5 rather than at the end of a dedicated phase.

### User Story 1 — labelled state badge (P1) 🎯 MVP

**Delivered by**: T005–T009, T011, T015, T016 (tests) · T017, T018, T021 (source) · T022 (barrel) ·
T023, T024, T026 (demos)

**Independent test**:
`pnpm run test:unit -- --run src/lib/components/ui/status/status.test.ts -t "Status"` plus
`-t "variants"`, `-t "StatusLabel"`, `-t "accessibility and RTL"` — a badge with a variant and a
label renders with the right `data-variant`, the right token classes and readable text, and mirrors
correctly under `dir="rtl"`.

### User Story 2 — animated presence indicator (P2)

**Delivered by**: T010, T012 (tests) · T020 (source) · T025 (demo)

**Independent test**: `pnpm run test:unit -- --run src/lib/components/ui/status/status.test.ts -t "StatusIndicator"`
and `-t "composition"` — the dot renders with the ping pseudo-element classes, its colour is linked
to the root variant through `**:data-[slot=status-indicator]:bg-…`, and omitting it still yields a
correct badge.

### User Story 3 — render onto a caller-supplied element (P3)

**Delivered by**: T013, T014 (tests) · T004 (harness) · T019 (source)

**Independent test**: `pnpm run test:unit -- --run src/lib/components/ui/status/status.test.ts -t "child snippet"`
and `-t "keyboard"` — the caller's `<a>` carries the badge's classes and data attributes with no
wrapper element, is tab-reachable with a visible accessible name, and `children`/`ref` are correctly
inert in that branch.

---

## Implementation Strategy

### MVP first

1. Phase 1 → Phase 2 → the US1 test tasks (T005–T009, T011, T015, T016).
2. T017, T018, T021, T022 — the badge, its variant table, the label and the barrel.
3. **Validate**: the US1 suites pass; T023/T024/T026 render.
4. Then add US2 (T010, T012, T020, T025) and US3 (T013, T014, T019).

### Incremental delivery

Each story adds files or `describe` blocks without rewriting earlier ones: US2 adds one source file
and two suites, US3 adds one `{#if}` branch and two suites. The registry entry (T028) ships all three
at once, because a registry item is a single unit.

---

## Convention Notes (this port is the precedent)

Status is the first ported component; the choices below are what every later port is told to copy
(plan.md § Convention Decisions). Do not improvise on them here.

- **Folder**: `src/lib/components/ui/<slug>/`, root `<slug>.svelte`, parts `<slug>-<part>.svelte`.
- **`tv()` lives in the root's `<script lang="ts" module>`** and is exported as `<slug>Variants`,
  mirroring `badge.svelte`; `cn()` merges the caller's `class` **last** in every part.
- **Barrel shape**: type re-exports first, then the component block — short names, a bare `//`
  separator, then the prefixed aliases. Both `import * as X` and named imports must work.
- **`data-*` naming**: `data-slot="<slug>"` / `data-slot="<slug>-<part>"` on every part; each variant
  or state as its own `data-<name>`; booleans written `cond ? '' : undefined` (Status has none).
- **`asChild` → `child` snippet**: `child?: Snippet<[{ props: <Slug>ChildProps }]>`; the snippet
  replaces the element and receives the already-merged props; `children` is not rendered and `ref` is
  not populated in that branch.
- **Unknown union value at runtime** normalises through `resolve<Slug>Variant()` before both `tv()`
  and the `data-` attribute.
- **Test files**: `<slug>.test.ts` for all specs plus `<slug>.test.svelte` for a single prop-driven
  harness whenever `bind:` or a snippet-with-props is under test; the harness is never listed in
  `registry.json`.
- **Test structure**: one `describe` per part, plus `variants`, `composition`, `child snippet`,
  `keyboard`, `accessibility and RTL` — later ports extend this with `controlled`, `uncontrolled` and
  `guard rails`.
- **No `<slug>.svelte.ts` and no context module unless there is genuinely shared reactive state.**

---

## Notes

- `[P]` = different files, no dependency on an incomplete task. Every task in Phases 3, 6 and 7
  touches a single shared file and is therefore sequential.
- Tests are written before implementation and must be seen failing first (Phase 3 checkpoint).
- Do **not** run `shadcn-svelte add` — the base set is installed; compose what is there.
- Do **not** run git write commands and do **not** touch `.reference/`, `.specify/scripts/`,
  `scripts/`, `.port-state.json` or `.port-logs/` — the orchestrator owns the working tree
  (Principle X).
- Do **not** modify `src/app.css`: the `success`/`warning`/`info` tokens already exist.

---

## Phase 9: Convergence

**Purpose**: Close the gaps found by `/speckit-converge` between the shipped port and its spec, plan
and contracts. All four are **test-coverage** gaps — the shipped source already behaves correctly, but
a requirement it satisfies is not pinned by an assertion, so a future regression would pass the gate.
No task in this phase changes `src/lib/components/ui/status/*.svelte`, `index.ts`, the demo route or
`registry.json`; T033 extends the harness `status.test.svelte`, and T033–T036 all add assertions to
`src/lib/components/ui/status/status.test.ts`.

Both files are shared, so **none of these tasks are `[P]`** — run them in order. Re-run
`pnpm run format`, `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and
`pnpm run build` afterwards (Principle VII); no `.skip`/`.todo`/`as any`/suppression comment may be
introduced to make any of them pass.

- [x] T033 [US3] Extend `src/lib/components/ui/status/status.test.svelte` with a `useButton?: boolean`
      prop that renders the `child` snippet onto a `<button type="button" {...props}>` instead of the
      `<a>` (keep the existing `useChild`/`href` anchor branch untouched — T013/T014 assert against
      it), then add to `describe('keyboard')` in `src/lib/components/ui/status/status.test.ts` that in
      button mode the rendered `button` is reached by `userEvent.tab()`, is exposed as
      `screen.getByRole('button', { name: 'Online' })`, and invokes the handler forwarded through
      `restProps` on **both** `{Enter}` and `{ }` (Space) per FR-013 (partial)
- [x] T034 In `src/lib/components/ui/status/status.test.ts` `describe('accessibility and RTL')`, assert
      the two unpinned clauses of FR-013: (a) no part suppresses its focus indicator — the class list
      of `status`, `status-indicator` and `status-label` contains no `outline-none`,
      `focus:outline-none` or `focus-visible:outline-none`, and the same holds for the element rendered
      through the `child` snippet; and (b) the default badge introduces no live region — no part
      carries `aria-live`, `aria-atomic` or `role`, complementing the existing
      `queryByRole('status')` assertion. Covers FR-013 and the spec's focus Edge Case, and pins
      Constitution III's "Focus MUST remain visible" (partial)
- [x] T035 In `src/lib/components/ui/status/status.test.ts`, add a `describe('barrel')` suite pinning
      the programmatic surface FR-014 requires and `contracts/status-public-api.md` §1 specifies:
      import `statusVariants` from `'./index.js'` and assert
      `statusVariants({ variant: 'success' })` returns a string containing the `success` row's token
      classes and that `statusVariants()` falls back to the `default` row (`defaultVariants`); and
      assert the alias pairs are the same component — `Status.Root === Status.Status`,
      `Status.Indicator === Status.StatusIndicator`, `Status.Label === Status.StatusLabel`. Today
      `statusVariants` and the aliases are exported but referenced nowhere in `src/`, so removing them
      would not fail any gate (partial)
- [x] T036 In `src/lib/components/ui/status/status.test.ts` `describe('StatusIndicator')` and
      `describe('StatusLabel')`, extend the existing `forwards restProps` specs to cover event
      handlers, not just attributes: pass an `onclick` (`vi.fn()`) to each part, `userEvent.click` the
      rendered element and assert the handler fired once — FR-009 requires attributes **and** event
      handlers to be forwarded on **every** part, and only the root asserts this today (partial)
