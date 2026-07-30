---
description: 'Task list for the Masonry port'
---

# Tasks: Masonry

**Input**: Design documents from `/specs/013-port-masonry/` (`plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/public-api.md`, `quickstart.md`)

**Tests**: MANDATORY per Constitution Principle III / VII and the porting brief. `masonry.test.ts` and
`masonry-positioner.test.ts` are written before their corresponding implementation files (Phase 2 precedes
Phase 3) and must never be skipped, `.todo`'d, or `.only`'d.

**Phase order** (per user direction, not the generic template order): Setup → Tests → Core component files →
Barrel and types → Demo route → Registry entry and docs polish → Verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency)
- **[Story]**: US1 = shortest-column layout (P1), US2 = `linear` layout (P2), US3 = SSR-safe fallback (P3).
  Tasks that are foundational/cross-cutting (shared files, algorithm plumbing, accessibility, RTL, quality
  gates) carry no story label, matching the template's convention for Setup/Foundational/Polish tasks.
- File paths are exact and relative to the repository root.

---

## Phase 1: Setup

**Purpose**: Directory skeleton and registry scaffolding so every later task has a concrete file to edit.

- [X] T001 Create `src/lib/components/ui/masonry/` with empty placeholder files for the seven registry
      source files (`index.ts`, `masonry.svelte`, `masonry-viewport.svelte`, `masonry-item.svelte`,
      `masonry.svelte.ts`, `masonry-positioner.ts`, `masonry-interval-tree.ts`) and the three test files
      (`masonry-positioner.test.ts`, `masonry.test.svelte`, `masonry.test.ts`), per `plan.md`'s Project
      Structure section, so later tasks only fill in content.
- [X] T002 [P] Append the `masonry` entry to `registry.json` (`name`, `type: "registry:ui"`, `title`,
      `description`, `registryDependencies: ["direction-provider"]`, `dependencies: []`, and the `files`
      array listing the seven source files from T001) exactly as specified in
      `specs/013-port-masonry/contracts/public-api.md` §6.
- [X] T003 [P] Confirm zero new npm dependencies are required: run `pnpm install --frozen-lockfile` and
      confirm `src/lib/components/ui/direction-provider/` already exists in the repo (research R-12); no
      source files are modified by this task.

**Checkpoint**: directory skeleton exists, registry entry is in place, dependency footprint confirmed.

---

## Phase 2: Tests (MANDATORY — write first, expect RED)

**Purpose**: Encode every observable behaviour from `spec.md` / `data-model.md` / `contracts/public-api.md`
before any implementation file has real content, per Constitution Principle III/VII.

- [X] T004 [P] Write `src/lib/components/ui/masonry/masonry-positioner.test.ts` per `quickstart.md` V-2 and
      `contracts/public-api.md` §5: `columnCount`/`columnWidth` derivation (including the narrower-than-one-
      column floor of 1), default shortest-column assignment with tie-breaking to the lowest index, `linear`
      round-robin assignment and its 2.5×-shortest-column fallback, explicit `columnCount` overriding
      `maxColumnCount`, asymmetric `gap: { column, row }` spacing, and `update()` re-flowing later items in
      an affected column — feeding heights straight into `createPositioner`/`createIntervalTree` with no
      DOM. This is the SC-001 parity floor and covers both US1 (default algorithm) and US2 (`linear`).
- [X] T005 [P] Write `src/lib/components/ui/masonry/masonry.test.svelte` test harness per `data-model.md`
      §3 and research R-09: renders a `Masonry.Root`/`Masonry.Item` tree from a snippet-driven, keyed
      `{#each}` item list with per-item `data-test-height`, exposes `bind:ref` on both root and items, and a
      "bare item" mode (an unwrapped `Masonry.Item`) for the outside-provider throw test; and installs the
      per-suite stubs from research R-09 (`offsetWidth`/`offsetHeight` read from `data-test-height`,
      `document.documentElement.clientWidth/clientHeight`, and a capturing fake `ResizeObserver` exposing
      `trigger(el, height)`), torn down in `afterEach`.
- [X] T006 [US1] Write the controlled-vs-uncontrolled test area in
      `src/lib/components/ui/masonry/masonry.test.ts` (using T005's harness): every prop from
      `contracts/public-api.md` §1–2 renders with its documented default, `data-slot="masonry"` /
      `data-slot="masonry-item"` are present, explicit `columnCount` wins over the width-derived count and
      makes `maxColumnCount` inert (research R-11's controlled/uncontrolled analogue); rendering
      `Masonry.Root` and `Masonry.Item` with a `child` snippet renders the caller's own element (e.g. an
      `<a>`) instead of the default `<div>`, receives `{ props }` matching the documented
      `MasonryChildProps`/`MasonryItemChildProps` shape (`data-slot`, `dir`/`data-index` as applicable,
      `style`, `class`), and preserves positioning (item `top`/`inset-inline-start`) and the
      `data-scrolling`/`data-measuring` state exactly as the default-element path does (FR-015); and
      `<Masonry.Item>` rendered outside `<Masonry.Root>` throws
      `` /must be used within `<Masonry.Root>`/ ``.
- [X] T007 Add the accessibility roles-and-names test area to
      `src/lib/components/ui/masonry/masonry.test.ts`: both parts remain role-less `<div>`s (no implicit
      ARIA role), a focusable control inside item *n* is reached in tab order before one in item *n+1* and
      virtualization does not reorder it, and elements in the hidden measurement batch
      (`visibility:hidden`, `data-measuring`) are removed from the accessibility tree (research R-11).
- [X] T008 Add the keyboard-interaction test area to
      `src/lib/components/ui/masonry/masonry.test.ts`: `ArrowUp/Down/Left/Right`, `Home`, `End`, `Enter`,
      `Space`, `Escape` and `Tab`, driven through `userEvent`, all reach caller content unintercepted — the
      honest key-for-key parity assertion for a component whose upstream key map is empty (research R-11).
- [X] T009 Add the RTL test area to `src/lib/components/ui/masonry/masonry.test.ts`: wrapping the harness
      in `<DirectionProvider direction="rtl">` (and via an explicit `dir="rtl"` prop) results in
      `dir="rtl"` on the rendered root and `inset-inline-start` (not `left`) on positioned items, with
      column assignment numbers unchanged from the LTR case (SC-005, research R-07).
- [X] T010 Add the edge-cases test area to `src/lib/components/ui/masonry/masonry.test.ts`: zero
      `MasonryItem` children render with zero height and no error; a container narrower than one
      `columnWidth` still renders exactly one column; `gap` omitted behaves as `gap={0}`; removing an item
      from the middle re-flows the remaining items to close the gap; an item registered after initial
      mount with no explicit `index` is appended after the last existing index (registration order), while
      a sibling item given an explicit `index` prop is positioned at that index instead of being appended,
      overriding registration order (research R-02) — the scenario plan.md's Risks table (row "Mid-list
      insertion after mount gets appended index") commits to testing; a `MasonryItem` whose
      `data-test-height` changes after mount, followed by calling the fake `ResizeObserver`'s
      `trigger(el, newHeight)` (research R-09), causes `reportHeight`/`positioner.update()` to run and
      later items in that column to move to their new `top` within one scheduled `requestAnimationFrame`
      (FR-012, SC-003, US1 Acceptance Scenario 5) — the component-level counterpart to T004's
      algorithm-only assertion; a 200+-item list keeps live `data-index` DOM nodes bounded (SC-008) not
      just at initial render but after dispatching `window.dispatchEvent(new Event("scroll"))` at several
      `scrollY` values under fake timers advanced past `1000/scrollFps` ms — asserting the visible index
      range shifts accordingly and that `data-scrolling=""` is present on the root during the throttle
      window and absent once it settles (FR-008); and the SSR fallback (`fallback` shown while `!mounted`,
      replaced by positioned items once mounted and measured, falling back to
      `defaultWidth`/`defaultHeight` — or `0` — when no `fallback` is given) covers US3's independent test
      criterion.
- [X] T010a [US1] Add the resize-recompute test area to `src/lib/components/ui/masonry/masonry.test.ts`
      (using the harness's R-09 stubs, see T005): with `document.documentElement.clientWidth`/
      `clientHeight` stubbed to a width fitting N columns, render the harness, then change the stub to a
      width fitting M columns and dispatch `window.dispatchEvent(new Event('resize'))`; under
      `vi.useFakeTimers()`, advance 300ms (the documented debounce) and assert the rendered column count
      changes from N to M and every item's `data-column-index`/position updates with no item left
      unassigned (FR-011, SC-004, US1 Acceptance Scenario 2). Also assert an `orientationchange` event
      triggers the same recompute path.

**Checkpoint**: all test files/areas (T004–T010a) exist and fail (RED) — `masonry-positioner.ts`,
`masonry-interval-tree.ts`, and the three component parts are still empty stubs.

---

## Phase 3: Core component files

**Purpose**: Turn the Phase 2 tests green, in dependency order (pure algorithm → reactive state → parts).

- [X] T011 [P] Implement `src/lib/components/ui/masonry/masonry-interval-tree.ts` — direct port of
      upstream lines 8–426 (red-black interval tree) per `data-model.md` §1: module-private `TreeNode`,
      `ListNode`, `NodeColor`, `NodeOperation`; exported `IntervalTree` interface and `createIntervalTree()`
      with `insert`, `remove`, `search`, `size` per the documented invariants. No runes, no `any`.
- [X] T012 Implement `src/lib/components/ui/masonry/masonry-positioner.ts` (depends on T011) — port of
      upstream lines 548–799 per `data-model.md` §2 and the algorithm contract in
      `contracts/public-api.md` §5: `resolveColumnCount`, `resolveColumnWidth`, `createPositioner`
      (`set`/`get`/`update`/`range`/`size`/`estimateHeight`/`shortestColumn`/`all`), default shortest-column
      assignment (ties → lowest index) and `linear` round-robin with the 2.5×-shortest fallback. Run
      `pnpm run test:unit -- --run src/lib/components/ui/masonry/masonry-positioner.test.ts` and iterate
      until T004 is green.
- [X] T013 Implement `src/lib/components/ui/masonry/masonry.svelte.ts` (depends on T012) — per
      `data-model.md` §3: `MasonryStateProps`, the `MasonryState` class with every listed `$state` /
      `$state.raw` / `$derived` / `$derived.by` member and method (`registerItem`, `unregisterItem`,
      `indexOf`, `getItem`, `isVisible`, `isMeasuring`, `observeItem`, `reportHeight` with the strictly
      sequential drain from research R-04, `bumpLayout`); the module-private helpers `createThrottle`,
      `createRafSchedule` (fixed with `if (frameId === null)`, research R-06), `observeWindowSize`,
      `observeWindowScroll`; and the `Symbol`-keyed `setMasonryContext` / `hasMasonryContext` /
      `getMasonryContext` (throwing `` `<Masonry.Item>` must be used within `<Masonry.Root>`. ``) per
      `CLAUDE.md` §5.
- [X] T014 Implement `src/lib/components/ui/masonry/masonry-viewport.svelte` (depends on T013) — internal,
      non-exported sizing container per `contracts/public-api.md` §3: `data-slot="masonry-viewport"`,
      `data-version={layoutVersion}`, sized via inline `height`/`max-height` to `estimatedHeight` (with
      `will-change:contents;pointer-events:none;` while scrolling per `data-model.md` §4), and renders
      `{#if !mounted && fallback}{@render fallback()}{:else}…{/if}` (research R-08).
- [X] T015 Implement `src/lib/components/ui/masonry/masonry.svelte` (depends on T013, T014) — `Masonry` /
      `Masonry.Root` per `contracts/public-api.md` §1: module-script `MasonryRootProps` and
      `MasonryChildProps` types; `ref = $bindable(null)`, `columnWidth`, `columnCount`, `maxColumnCount`,
      `gap`, `itemHeight`, `defaultWidth`, `defaultHeight`, `overscan`, `scrollFps`, `linear`, `fallback`,
      `dir` (`Omit`ted from `HTMLAttributes`, resolved via `useDirection()` from
      `$lib/components/ui/direction-provider/index.js`), `child`, `children`; instantiates and sets the
      `MasonryState` context; `$effect.pre` mount/measure gate (`mounted = true`, measures
      `containerPosition`) per research R-08; renders `masonry-viewport.svelte`; `data-slot="masonry"`,
      `data-scrolling`, `dir` on the root element; `style="position:relative;width:100%;height:100%;"` with
      caller `style` appended last.
- [X] T016 [P] Implement `src/lib/components/ui/masonry/masonry-item.svelte` (depends on T013) —
      `MasonryItem` / `Masonry.Item` per `contracts/public-api.md` §2: module-script `MasonryItemProps` and
      `MasonryItemChildProps` types; `ref = $bindable(null)`, `index`, `child`, `children`; calls
      `getMasonryContext()` at init (throws outside a root); registers a stable per-instance `symbol` token
      on init and unregisters it in the `$effect` teardown; resolves its layout index as the `index` prop
      when supplied, else `state.indexOf(token)` (research R-02); calls `state.observeItem(index, ref)` in
      an effect for `ResizeObserver` wiring and initial height report; renders the `{#if visible}` gate
      **inside itself** wrapping its own element (research R-03) with the positioned vs. measuring-hidden
      inline styles from `data-model.md` §4 (caller `style` appended last); `data-slot="masonry-item"`,
      `data-index`, `data-column-index`, `data-measuring`.

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/masonry` passes for every area in
Phase 2 except any assertion that depends on the barrel (Phase 4).

---

## Phase 4: Barrel and types

- [X] T017 Implement `src/lib/components/ui/masonry/index.ts` (depends on T011–T016) — barrel per
      `contracts/public-api.md` §4: `export { Root, Item, Root as Masonry, Item as MasonryItem }`;
      `export type { MasonryProps, MasonryRootProps, MasonryChildProps } from './masonry.svelte.js'`
      (`MasonryProps` aliases `MasonryRootProps`); `export type { MasonryItemProps, MasonryItemChildProps }
      from './masonry-item.svelte.js'`; `MasonryState`, `getMasonryContext`, `hasMasonryContext`,
      `setMasonryContext`, `type MasonryStateProps` from `./masonry.svelte.js`; `createPositioner`,
      `resolveColumnCount`, `resolveColumnWidth`, `type Positioner`, `type PositionerItem`,
      `type PositionerOptions` from `./masonry-positioner.js`; `createIntervalTree`, `type IntervalTree`
      from `./masonry-interval-tree.js`. All imports use the `.js` extension. `masonry-viewport.svelte` and
      the scroll/resize/throttle helpers are **not** exported.

**Checkpoint**: `import * as Masonry from '$lib/components/ui/masonry/index.js'` resolves both `Root`/`Item`
and prefixed aliases; `pnpm run test:unit -- --run src/lib/components/ui/masonry` is fully green.

---

## Phase 5: Demo route

- [X] T018 [US1] Create `src/routes/docs/components/masonry/+page.svelte` with the page header
      (`<svelte:head><title>Masonry — svelte-dice-ui</title></svelte:head>`, intro `<h1>`/description) and
      the "Default" `<ComponentPreview>` section mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/masonry-demo.tsx` — a `Masonry.Root` with
      `columnWidth`/`gap` and several `Masonry.Item`s of differing heights, importing
      `* as Masonry from '$lib/components/ui/masonry/index.js'` and `ComponentPreview` from
      `$lib/components/docs/index.js`.
- [X] T019 [US2] Add the "Linear Layout" `<ComponentPreview>` section to
      `src/routes/docs/components/masonry/+page.svelte`, mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/masonry-linear-demo.tsx` — a `Masonry.Root`
      with `linear` set and numbered items demonstrating round-robin order.
- [X] T020 [US3] Add the "Server Side Rendering" `<ComponentPreview>` section to
      `src/routes/docs/components/masonry/+page.svelte`, mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/masonry-ssr-demo.tsx` — a `Masonry.Root` with
      `fallback` (skeleton grid via `$lib/components/ui/skeleton/index.js`), `defaultWidth`, and
      `defaultHeight`.
- [X] T021 Add API-reference tables to `src/routes/docs/components/masonry/+page.svelte`, after the three
      preview sections: props for `Masonry`/`Masonry.Root` and `MasonryItem`/`Masonry.Item` (from
      `contracts/public-api.md` §1–2), data attributes for both parts, and the outside-provider error
      message.

**Checkpoint**: the demo route renders three sections matching SC-006, one per upstream demo file.

---

## Phase 6: Registry entry and docs polish

- [X] T022 Verify the `masonry` entry appended in T002 still exactly matches the final file set and prose
      in `contracts/public-api.md` §6 after Phases 3–5 (title, description, `registryDependencies`,
      `dependencies: []`, and all seven `files` entries with no test file listed) — file: `registry.json`.
- [X] T023 Run `pnpm run registry:build`; verify `static/r/masonry.json` is generated with `$lib/...`
      imports rewritten to registry placeholders (`quickstart.md` V-5); then run
      `git grep -n "components/docs\|routes/" -- src/lib/components/ui/masonry` and confirm no output (the
      component never reaches into the docs app).

---

## Phase 7: Verification (MANDATORY — Constitution Principle VII)

- [X] T024 Run `pnpm run format` (shadcn/generator output is not Prettier-formatted) across every file
      touched in Phases 1–6, then re-run `pnpm run test:unit -- --run src/lib/components/ui/masonry` to
      confirm formatting introduced no regressions.
- [X] T025 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, and
      fix everything that fails. No suppressions anywhere in the diff (`@ts-ignore`, `@ts-expect-error`,
      `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`/`.only`, deleted assertions, loosened
      `tsconfig`/`eslint`/`svelte-check`/`vitest` config) — confirm with
      `git grep -nE "@ts-(ignore|expect-error)|eslint-disable|svelte-ignore|as any|\.(skip|todo|only)\(" -- src/lib/components/ui/masonry src/routes/docs/components/masonry`
      returning no output, per `quickstart.md` V-1.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Tests (Phase 2)**: depends on Setup (needs the placeholder files from T001); tests are written to FAIL
  against the empty stubs.
- **Core component files (Phase 3)**: depends on Phase 2 existing (tests define the contract); internally
  ordered T011 → T012 → T013 → {T014, T016 in parallel} → T015.
- **Barrel and types (Phase 4)**: depends on all of Phase 3 (T011–T016).
- **Demo route (Phase 5)**: depends on Phase 4 (imports the barrel).
- **Registry entry and docs polish (Phase 6)**: depends on Phase 3 (final file set) and Phase 5 (nothing
  left to add to the registry `files` array).
- **Verification (Phase 7)**: depends on everything above — always last.

### User Story Coverage

- **US1 (shortest-column layout, P1)**: T004 (default-algorithm assertions), T006 (controlled/uncontrolled
  `columnCount`), T010a (window resize recompute), T011–T017 (core algorithm and parts), T018 (Default
  demo).
- **US2 (`linear` layout, P2)**: T004 (`linear`/2.5×-fallback assertions), T012 (`linear` branch in the
  positioner), T019 (Linear Layout demo).
- **US3 (SSR-safe fallback, P3)**: T010 (fallback/mount edge cases), T013–T015 (`mounted`/`fallback` gating
  in `MasonryState` and the viewport), T020 (Server Side Rendering demo).
- Accessibility (T007), keyboard (T008), and RTL (T009) are cross-cutting Principle III/VIII requirements
  that apply to all three stories and therefore carry no single `[Story]` label, matching the template's
  treatment of Setup/Foundational/Polish tasks.

### Parallel Opportunities

- T002, T003 (Setup) can run in parallel once T001 exists.
- T004, T005 (Tests) can run in parallel — different files, no interdependency.
- T011 can start immediately in Phase 3; T014 and T016 can run in parallel once T013 lands (different
  files, neither depends on the other).
- T018 is the first demo task; T019/T020/T021 are sequential edits to the same `+page.svelte` file and are
  therefore never `[P]`.
- T010a depends on T005's harness and is sequential with T010 (same file `masonry.test.ts`), never `[P]`.

---

## Parallel Example: Tests phase

```bash
# Launch the two independent test-authoring tasks together:
Task: "Write masonry-positioner.test.ts per contracts/public-api.md §5"
Task: "Write masonry.test.svelte harness per data-model.md §3 / research R-09"
```

## Parallel Example: Core component files phase

```bash
# Once masonry.svelte.ts (T013) lands, these two are independent:
Task: "Implement masonry-viewport.svelte (T014)"
Task: "Implement masonry-item.svelte (T016)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 tests that gate US1: T004 (default-algorithm half), T005, T006, T007, T008, T009,
   T010 (zero-items/narrow-container/virtualization subset), T010a (window resize recompute).
3. Complete Phase 3 (T011–T016) and Phase 4 (T017) — this alone makes the shortest-column layout usable.
4. Complete T018 (Default demo) and the registry/verification phases.
5. **STOP and VALIDATE**: run `masonry-positioner.test.ts` and the non-`linear`/non-SSR portions of
   `masonry.test.ts` independently (`quickstart.md` V-2/V-3).

### Incremental Delivery

1. Setup + Tests + Core + Barrel → US1 (Default) demo ready.
2. Add US2: the `linear` assertions in T004/T012 are already implemented as part of Phase 3 (the
   positioner does not branch by story); add T019 (Linear demo) to surface it.
3. Add US3: the `mounted`/`fallback` gating is already implemented as part of Phase 3; add T020 (SSR demo)
   to surface it.
4. Finish with Phase 6 (registry) and Phase 7 (quality gates) — the feature is not done until T025 is
   green.

---

## Notes

- [P] tasks touch different files with no unmet dependency; tasks that edit the same file (e.g. all of
  `masonry.test.ts`, or all three `+page.svelte` demo sections) are always sequential, never `[P]`.
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X / CLAUDE.md).
- Do NOT touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json`, or `.port-logs/`.
- Every task's target files already exist under `.reference/diceui` as read-only source material (see
  `plan.md`'s header) — read, never modify them.

---

## Phase 8: Convergence

**Purpose**: Close the assertion gaps found by `/speckit-converge` after Phases 1–7. The seven registry
source files, the demo route and the `registry.json` entry are complete and all five quality gates are
green; every remaining item below is a promised test assertion that was never written. Do not change any
file under `src/lib/components/ui/masonry/*.svelte`, `*.svelte.ts` or `*.ts` while completing them — the
implementation already satisfies the requirement each one covers.

- [X] T026 Assert that the unmounted `fallback` branch actually renders, not just that it is gone after
      mount, per US3 Acceptance Scenario 1 / SC-002 / FR-009 (partial). `masonry.test.ts`'s
      "replaces the fallback with the measured list once mounted" only covers the *replaced* half, and
      the "Masonry SSR fallback" block asserts `MasonryState.mounted === false` without ever exercising
      `{#if !state.mounted && fallback}` in `masonry-viewport.svelte`; `quickstart.md` V-3 nonetheless
      claims "SSR fallback: `fallback` shown while unmounted". `render()` from `svelte/server` is not
      available under this repo's Vitest setup (settled in `specs/009-port-badge-overflow`), so add a
      `'viewport-fallback'` mode to `src/lib/components/ui/masonry/masonry.test.svelte` that builds a
      `MasonryState` from the barrel, publishes it with `setMasonryContext()` while leaving `mounted` at
      `false`, and renders `./masonry-viewport.svelte` directly (the harness is colocated, so importing
      the non-exported part is legitimate). Assert in `masonry.test.ts` that the fallback content is in
      the document and no `[data-slot="masonry-viewport"]` element is, that flipping `mounted` to `true`
      swaps them, and that with `mounted === false` and **no** `fallback` the viewport still renders at
      zero height with no items — the two `mounted = false` branches of `data-model.md` §5.
- [X] T027 Exercise `itemHeight`, `overscan` and `scrollFps` as `Masonry.Root` props in
      `src/lib/components/ui/masonry/masonry.test.ts`, per FR-006 / FR-008 and T006's "every prop from
      `contracts/public-api.md` §1–2" (partial). No test currently passes any of the three to the
      harness — which already forwards all of them — so their documented defaults are the only
      behaviour ever observed. Add, using the existing R-09 stubs: a 200-item render where a smaller
      `overscan` yields strictly fewer live `data-index` nodes than the default `2` and a larger one
      yields more (FR-008, FR-013); a partially-measured 200-item render where a larger `itemHeight`
      raises the viewport's estimated `height`/`max-height`, since `estimatedHeight` extrapolates the
      unmeasured remainder from it (FR-006); and, under `useTimers()`, a `scrollFps` low enough that
      `data-scrolling` is still present after the default 12 fps settle window of ~123 ms has elapsed
      but gone after its own `40 + 1000 / scrollFps` ms (FR-008). `defaultWidth`/`defaultHeight` are
      deliberately excluded: `MasonryState.readDocumentSize()` only consults them when `document` is
      `undefined`, so they are unobservable through a jsdom component render and stay covered by the
      existing state-level assertions.
- [X] T028 Assert the viewport's `data-version` attribute in
      `src/lib/components/ui/masonry/masonry.test.ts`, per `contracts/public-api.md` §3 and
      `plan.md`'s Principle VIII row, which both list it as externally-styleable component state
      (partial). Nothing in the suite reads it today. Assert that `[data-slot="masonry-viewport"]`
      carries no `data-version` while the root is unmounted (reuse T026's harness mode), that it
      carries one once mounted and measured, and that its value increases after a `resizeItem()` bumps
      `layoutVersion` through the RAF-coalesced re-flow.

**Checkpoint**: `pnpm run format`, `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and
`pnpm run build` are all green again, with no suppression and no change to any non-test file under
`src/lib/components/ui/masonry/`.
