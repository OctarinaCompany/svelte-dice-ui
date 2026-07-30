---
description: 'Task list for the Badge Overflow port'
---

# Tasks: Badge Overflow

**Input**: Design documents from `/specs/009-port-badge-overflow/` (plan.md, spec.md, research.md,
data-model.md, contracts/public-api.md, quickstart.md)

**Tests**: MANDATORY — Constitution Principle III/VII. Colocated at
`src/lib/components/ui/badge-overflow/badge-overflow.test.ts`, with a prop-driven Svelte harness at
`src/lib/components/ui/badge-overflow/badge-overflow.test.svelte` (excluded from `registry.json`).

**Organization**: Phase order is fixed by the port instructions for this feature: Setup → Tests → Core
component files → Barrel and types → Demo route → Registry entry and docs polish → Verification. Tasks
inside the Tests and Core-component phases additionally carry `[US1]`/`[US2]`/`[US3]` labels mapping to
spec.md's three user stories, so each story's slice can still be located and verified independently.

## Path Conventions

- Component source: `src/lib/components/ui/badge-overflow/`
- Tests: colocated at `src/lib/components/ui/badge-overflow/badge-overflow.test.ts` (+ `.test.svelte` harness)
- Demo route: `src/routes/docs/components/badge-overflow/+page.svelte`
- Registry: `registry.json` at the repository root

---

## Phase 1: Setup (dependencies, registry stub)

**Purpose**: confirm no new dependencies are needed, scaffold empty files so later tasks have concrete
paths to edit, and reserve the `registry.json` slot.

- [X] T001 Verify zero new npm dependencies are required: confirm `bits-ui`, `tailwind-variants` are not
      imported by this port (per `plan.md` §Technical Context and the Complexity Tracking table) and that
      `package.json` needs no edit — no file changes, this is a verification-only gate before scaffolding.
- [X] T002 [P] Create the component folder `src/lib/components/ui/badge-overflow/` with four empty stub
      files: `index.ts`, `badge-overflow.svelte`, `badge-overflow-indicator.svelte`,
      `badge-overflow.svelte.ts` (each containing only a one-line placeholder comment, to be filled by
      Phase 3/4).
- [X] T003 [P] Append a stub entry to `registry.json`'s `items` array for `badge-overflow`
      (`name`, `type: "registry:ui"`, `title`, `description`, `registryDependencies: []`,
      `dependencies: []`, `files: []`) as a placeholder; the real `files` list is filled in during
      Phase 6 (T025).

**Checkpoint**: folder and stub files exist; `registry.json` has a reservable entry; no behaviour written yet.

---

## Phase 2: Tests (write first — MUST fail before Phase 3 implementation)

**Purpose**: encode every requirement from `quickstart.md` §3 (the 28-row test plan) and spec.md's Edge
Cases before any component logic exists, per Constitution Principle VII.

All tasks in this phase write into the same two files
(`badge-overflow.test.ts`, `badge-overflow.test.svelte`), so **only T004 is `[P]`** relative to the rest
(different file); T005–T018 are sequential edits to the same test file.

- [X] T004 [P] Create the prop-driven test harness `src/lib/components/ui/badge-overflow/badge-overflow.test.svelte`
      exposing `items`, `getBadgeLabel`, `lineCount`, `badge`/`overflow`/`child` snippet slots, `bind:ref`,
      `class`, `style`, `dir`, and arbitrary `restProps`, per research R-07 and contracts/public-api.md.
- [X] T005 In `src/lib/components/ui/badge-overflow/badge-overflow.test.ts`, install the deterministic
      jsdom fixtures from research R-07 in a local `beforeEach`: `offsetWidth` stub
      (`BADGE_PADDING + label.length * CHAR_WIDTH`), `offsetHeight` stub (fixed `20`), `clientWidth` stub
      (per-test container width), and a controllable `ResizeObserver` double that records callbacks and
      `.disconnect()` calls; rely on the global `afterEach`'s `vi.restoreAllMocks()` for teardown — do not
      touch `tests/setup.ts` or `vite.config.ts`.
- [X] T006 [US1] In `badge-overflow.test.ts`, add the rendering & core-split tests: both siblings render
      with the measurement row having `items.length + 1` children and `aria-hidden="true"`; the visible
      container carries `data-slot="badge-overflow"`, `data-line-count`, `data-hidden-count`, and
      `class="flex flex-wrap"` merged with the caller's class last (quickstart rows 1, 2, FR-006, FR-013,
      FR-015).
- [X] T007 [US1] In `badge-overflow.test.ts`, add the narrow/wide container split tests: a narrow
      container yields visible badges whose summed widths+gaps stay ≤ the container width plus an
      indicator with `data-hidden-count` equal to the hidden count; a wide container shows every item
      with `data-hidden-count="0"` and no indicator (quickstart rows 5, 6, FR-001, FR-004, SC-001).
- [X] T008 [US1] In `badge-overflow.test.ts`, add the resize tests via the `ResizeObserver` double:
      widening and narrowing the container updates the split and `data-hidden-count` with no prop change
      or remount, and unmount calls `.disconnect()` on the observer exactly once (quickstart rows 19, 20,
      FR-007, SC-002).
- [X] T009 [US1] In `badge-overflow.test.ts`, add the "items list changes" test that replaces the
      controlled/uncontrolled pair for this component (it has no bindable value prop): a consumer-owned
      `items` array that adds/removes entries re-measures and updates the split without a manual remount
      (quickstart row 21, FR-008, FR-011, per research R-08's mapping).
- [X] T010 [US1] In `badge-overflow.test.ts`, add the accessibility roles-and-names tests: the visible
      container has no `role` and no `aria-*` beyond `data-*`, the measurement row carries
      `aria-hidden="true"`, and rendering with `render()` from `svelte/server` produces the placeholder
      markup while touching no browser global (quickstart rows 3, 4, 22 partial, FR-010, FR-018,
      Principle III).
- [X] T011 [US1] In `badge-overflow.test.ts`, add the keyboard-interaction test: the container is not
      focusable and `Tab` visits the consumer's interactive badge content in DOM order, using
      `@testing-library/user-event` (quickstart row 22, FR-017, Principle III / research R-08).
- [X] T012 [US3] In `badge-overflow.test.ts`, add the custom `badge`/`overflow` snippet and
      `getBadgeLabel` tests: custom badge markup renders for every visible item in order; a supplied
      `overflow` snippet replaces the default indicator and receives the hidden count; without it the
      default indicator renders with `data-count` and upstream's class set, asserted with
      `toHaveClass('inline-flex', 'h-5', 'shrink-0', 'items-center', 'rounded-md', 'border', 'px-1.5',
      'text-xs', 'font-semibold')` rather than string equality; primitive items without an extractor use
      their own string value; object items without an extractor throw
      `` `getBadgeLabel` is required when using array of objects` `` verbatim; a `null` item with no
      extractor throws the same message verbatim (upstream's `typeof null === 'object'` quirk,
      data-model.md §1); object items with an extractor use it for both label and width (quickstart rows
      9–14, FR-002, FR-005, US3-AC5).
- [X] T013 [US2] In `badge-overflow.test.ts`, add the `lineCount` tests: the same items/width at
      `lineCount` 1, 2, 3 produce strictly non-decreasing visible counts with no line exceeding the
      container width, and omitting `lineCount` defaults to `1` (`data-line-count="1"`) (quickstart rows
      7, 8, FR-003, SC-001).
- [X] T014 In `badge-overflow.test.ts`, add the RTL test: under `dir="rtl"` the visible/hidden split and
      DOM order are identical to LTR and the container inherits `dir` (quickstart row 23, FR-012, SC-004).
- [X] T015 In `badge-overflow.test.ts`, add the edge-case tests: empty `items` renders no badges/indicator
      with `data-empty` present; a container narrower than one badge plus the indicator still renders the
      indicator once measured; two items sharing a label share one measured width and both still render
      (quickstart rows 24, 25, 26, spec.md Edge Cases, data-model.md §1); plus a zero-measured-width case —
      `clientWidth` of `0` renders every item with no indicator and `data-hidden-count="0"` (upstream's
      short circuit, spec.md Edge Cases "Container has no defined width").
- [X] T016 In `badge-overflow.test.ts`, add the remaining prop-composition tests: caller `class` wins the
      `cn()` merge and caller `style` is appended after the computed `gap`; `bind:ref` populates with the
      visible container and stays `null` in `child` mode; `child` renders onto the caller's element with
      every `props` entry applied and `content` rendering the same badges + indicator; an arbitrary
      `restProps` attribute (`id`, `data-testid`, `onclick`) lands only on the visible container
      (quickstart rows 15–18, FR-013, FR-014, FR-016).
- [X] T017 In `badge-overflow.test.ts`, add direct unit tests for the pure helpers `computeVisibleSplit`,
      `getPlaceholderCount`, `getPlaceholderHeight`, `resolveBadgeLabel`, and `readContainerMetrics`,
      including the non-finite `gap` guard (research R-02) and the "final item does not reserve indicator
      space" case (research R-05) (quickstart row 27); plus the two upstream falsy guards — a falsy item
      (`''`, `0`) and a label whose measured width is `0` are both skipped by `computeVisibleSplit` while
      still counting toward `hiddenCount`; plus one rendered case asserting FR-009 end to end — 12px
      horizontal padding shrinks the usable width by 24px and changes `data-hidden-count` accordingly.
- [X] T018 In `badge-overflow.test.ts` (and the harness from T004), add the typing exercise for research
      R-03: one render of a primitive-array without `getBadgeLabel` and one render of an object-array with
      it, so `pnpm run check` exercises both branches of the conditional-required prop (quickstart row 28,
      FR-002).

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/badge-overflow/badge-overflow.test.ts`
runs and every test fails (component does not exist yet) — confirms the tests are wired correctly before
Phase 3 begins.

---

## Phase 3: Core component files

**Purpose**: implement the two exported subcomponents from the plan's Public API section plus the shared
state module, in dependency order (state module → Indicator → Root, since Root imports Indicator and
both import the state module).

- [X] T019 Implement `src/lib/components/ui/badge-overflow/badge-overflow.svelte.ts`: the constants
      (`DEFAULT_LINE_COUNT`, `DEFAULT_BADGE_GAP`, `DEFAULT_BADGE_HEIGHT`, `DEFAULT_OVERFLOW_BADGE_WIDTH`,
      `OVERFLOW_SAMPLE_COUNT`), the pure helpers (`resolveBadgeLabel`, `readContainerMetrics`,
      `computeVisibleSplit`, `getPlaceholderCount`, `getPlaceholderHeight`), the SSR-guarded
      `observeResize(element, onResize): () => void` helper, and the `BadgeOverflowState<T>` runes class
      with its `$state`/`$state.raw` measurement fields and `$derived`/`$derived.by` members, exactly per
      data-model.md §Entities 2–5 and §Derived members. No context/Symbol key is introduced (plan.md: "No
      context is introduced").
- [X] T020 [US3] Implement `src/lib/components/ui/badge-overflow/badge-overflow-indicator.svelte`: the
      built-in `+N` part with `count` (required), `ref = $bindable(null)`, `class`, `children` (overrides
      the `+{count}` text), `child` snippet, and `…restProps` spread before the computed class; emits
      `data-slot="badge-overflow-indicator"` and `data-count`, with the upstream-verbatim class string
      `inline-flex h-5 shrink-0 items-center rounded-md border px-1.5 text-xs font-semibold` merged via
      `cn()` (plan.md Public API §`BadgeOverflowIndicator`, data-model.md §Attribute contract).
- [X] T021 [US1] Implement `src/lib/components/ui/badge-overflow/badge-overflow.svelte`: the generic root
      (`generics="T"`) rendering the invisible measurement row
      (`data-slot="badge-overflow-measure"`, `aria-hidden="true"`,
      `pointer-events-none invisible absolute flex flex-wrap`, one badge per item plus one sample overflow
      indicator at `OVERFLOW_SAMPLE_COUNT`) and the visible container
      (`data-slot="badge-overflow"`, `data-measured`, `data-line-count`, `data-hidden-count`, `data-empty`,
      `class`/`style` merged last), all props and defaults from plan.md's `Root` table, the conditional
      `getBadgeLabel` typing from research R-03, the `badge`/`overflow`/`child` snippets (the `child`
      payload is `{ props, content }` per research R-04), and exactly one `$effect` creating a single
      `ResizeObserver` via `observeResize()` with a teardown that disconnects it, no-oping when
      `typeof window === 'undefined'` or the refs are unbound (research R-06, R-09). Import
      `BadgeOverflowIndicator` from T020 as the default `overflow` rendering.
- [X] T021a Copy the upstream prop JSDoc verbatim onto the exported props types in
      `badge-overflow.svelte` and `badge-overflow-indicator.svelte`, from
      `.reference/diceui/docs/types/radix/badge-overflow.ts`: `items` (with its `items={[…]}` example),
      `getBadgeLabel` (optional for primitive arrays, required for object arrays, both examples),
      `lineCount` (including `@default 1`), and — on `badge` / `overflow` — the `renderBadge` /
      `renderOverflow` docblocks plus a line naming the upstream prop each snippet replaces
      (Constitution Principle II; spec §Assumptions "Render props → snippets").
- [X] T022 [US2] Wire `lineCount` (default `1`) through the root from T021 into
      `computeVisibleSplit`/`getPlaceholderCount`/`getPlaceholderHeight` calls in `badge-overflow.svelte.ts`
      (T019) so multi-line fitting and the placeholder slice both respect it, matching data-model.md's
      worked `lineCount` 1/2/3 table.

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/badge-overflow/badge-overflow.test.ts`
now passes for every test added in Phase 2 (run it to confirm before moving on).

---

## Phase 4: Barrel and types

**Purpose**: the public API surface a consumer imports.

- [X] T023 Implement `src/lib/components/ui/badge-overflow/index.ts`: export `Root`/`Indicator` short
      names, `BadgeOverflow`/`BadgeOverflowIndicator` prefixed aliases, the prop types
      (`BadgeOverflowRootProps<T>`, `BadgeOverflowIndicatorProps`, `BadgeOverflowChildProps`,
      `BadgeOverflowIndicatorChildProps`), and the shared module exports from T019
      (`observeResize`, `computeVisibleSplit`, `resolveBadgeLabel`, `readContainerMetrics`,
      `getPlaceholderCount`, `getPlaceholderHeight`, `BadgeOverflowState`, and the five constants), per
      plan.md's "Shared module exports (deliverable 5)" table and CLAUDE.md §3's barrel convention.

**Checkpoint**: `import * as BadgeOverflow from '$lib/components/ui/badge-overflow/index.js'` resolves
every name listed in plan.md's Public API section; `pnpm run check` reports zero errors for this file.

---

## Phase 5: Demo route

**Purpose**: one docs page with one preview per upstream demo file (Principle IX, SC-006).

- [X] T024 Create `src/routes/docs/components/badge-overflow/+page.svelte` with three
      `<ComponentPreview>` sections in upstream MDX order — **Default** (mirrors
      `badge-overflow-demo.tsx`: plain + custom-overflow cases in a `w-64` bordered box), **Multi-line
      Overflow** (mirrors `badge-overflow-multiline-demo.tsx`: `lineCount` 1/2/3 over the same 15
      technologies), **Interactive Tags** (mirrors `badge-overflow-interactive-demo.tsx`: 12 object items
      `{ label, value }` + `getBadgeLabel`, `lineCount={2}`, a custom `overflow` snippet rendering
      `+{count} more`, click-to-remove badges using `@lucide/svelte/icons/x` with no sizing class, an
      `Input` where `Enter` adds the trimmed value (upstream's `onKeyDown`) plus an `Add` `Button`, inside
      a `max-w-80` bordered `p-3` box, and the two helper captions "Click on a badge to remove it." /
      "Resize the container to see overflow behavior.") — followed by two props tables (`Root`,
      `Indicator`) built from `$lib/components/ui/table`, matching
      `src/routes/docs/components/gauge/+page.svelte`'s layout. Demo state is page-local `$state` runes;
      no `+page.ts` is added (research R-10).

**Checkpoint**:
`node -e "const s=require('fs').readFileSync('src/routes/docs/components/badge-overflow/+page.svelte','utf8'); console.log((s.match(/<ComponentPreview/g)||[]).length)"`
prints `3`.

---

## Phase 6: Registry entry and docs polish

**Purpose**: replace the Phase 1 stub with the real registry entry and regenerate the static registry.

- [X] T025 Replace the `badge-overflow` stub entry in `registry.json` (added in T003) with the complete
      entry: `name: "badge-overflow"`, `type: "registry:ui"`, `title`, `description`,
      `registryDependencies: []`, `dependencies: []`, and a `files` array listing all four non-test files
      from `src/lib/components/ui/badge-overflow/` (`index.ts`, `badge-overflow.svelte`,
      `badge-overflow-indicator.svelte`, `badge-overflow.svelte.ts`), each `type: "registry:ui"` — omitting
      `badge-overflow.test.ts` and `badge-overflow.test.svelte` per quickstart.md §2.
- [X] T026 Run `pnpm run registry:build` and verify `static/r/badge-overflow.json` per quickstart.md §2:
      `name`/`type`/`files.length` equal `badge-overflow`/`registry:ui`/`4`, the four `target` paths match
      exactly, `$lib/utils.js` is rewritten to the `$UTILS$` placeholder, and no `components/docs` or
      `src/routes` import leaked into the emitted file.

**Checkpoint**: both `node -e` verification snippets from quickstart.md §2 and §4 (registry entry +
previews count) pass.

---

## Phase 7: Verification

- [X] T027 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, and
      fix everything that fails.

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** has no dependencies. T002 and T003 are `[P]` (different files); T001 is a
  read-only check that can run alongside them.
- **Phase 2 (Tests)** depends on Phase 1 (needs the stub files to exist as import targets). T004 is `[P]`
  relative to T005–T018 (different file); T005–T018 are sequential edits to one file and must run in the
  listed order only insofar as later tasks assume earlier fixtures (T005) exist — they may be reordered
  among themselves but not before T005.
- **Phase 3 (Core)** depends on Phase 2 existing (tests must be written and failing first). Within Phase
  3: T019 (state module) blocks T020 and T021 (both import it); T020 (Indicator) blocks T021 (Root imports
  Indicator as the default overflow renderer); T022 touches the same two files as T019/T021 and must
  follow both. T021a depends on T020 and T021 (it annotates their props types) and blocks T023.
- **Phase 4 (Barrel)** depends on T019–T022 and T021a (re-exports their symbols).
- **Phase 5 (Demo)** depends on Phase 4 (imports the barrel).
- **Phase 6 (Registry)** depends on Phase 4 and Phase 5 (the file list and demo must exist first); T026
  depends on T025.
- **Phase 7 (Verification)** depends on all prior phases.

## Parallel Execution Examples

```text
# Phase 1
T002 (scaffold folder)  ‖  T003 (registry stub)

# Phase 2 — only the harness is independent of the shared test file
T004 (test harness .svelte)  ‖  T005 (jsdom fixtures in .test.ts)
```

No other tasks are `[P]`: every Phase 3–7 task either shares a file with its predecessor or consumes an
artifact the predecessor produced.

## Implementation Strategy

**MVP scope**: User Story 1 (P1) — Phase 1, Phase 2's `[US1]` tasks (T006–T011) plus the shared fixture
tasks (T004, T005), Phase 3's T019/T021 (state module + Root, without the Indicator's `child`/`children`
polish or `lineCount` wiring), Phase 4, and a minimal one-section demo — delivers "only the badges that
fit, plus a `+N` indicator" end to end. `[US2]` (`lineCount`, T013/T022) and `[US3]` (custom
badge/overflow rendering, `getBadgeLabel`, T012/T020) layer on independently per spec.md's priority order,
and the full task list above already sequences them correctly since T020 (Indicator) and T022 (`lineCount`
wiring) are cheap, self-contained additions to the same two core files.

Total: **28 tasks** (T001–T027, plus T021a).

---

## Phase 8: Convergence

**Purpose**: close the gaps found by auditing the implemented port against spec.md, plan.md and
tasks.md. Appended by `/speckit-converge`; all five quality gates were green at audit time, so every
task below is additive test/demo work, not a repair of a broken gate.

- [X] T028 Assert the pre-measurement placeholder as rendered markup, not only as state, in
      `src/lib/components/ui/badge-overflow/badge-overflow.test.ts` per FR-010 / quickstart.md §3 rows 3
      and 4 (partial). The existing `BadgeOverflowState before the first measurement` block asserts
      `placeholderItems` / `placeholderHeight` / `isMeasured` on a bare state object, so the
      `isMeasured === false` **DOM branch** of `badge-overflow.svelte` — the branch R-09 says the server
      emits — is never exercised: nothing asserts that the visible container renders with no
      `data-measured`, exactly `getPlaceholderCount(items.length, lineCount)` badges, no indicator, and a
      `min-height: {getPlaceholderHeight(20, 4, lineCount)}px` declaration alongside `gap: 4px`. Assert it
      by inspecting the DOM synchronously after `render()` and **before** the existing `settle()` helper
      runs, which is the point at which the measurement `$effect` has not yet flushed; keep `lineCount`
      1/2/3 rows so the 3/5/8-badge and 20/44/68px table is covered end to end. `render()` from
      `svelte/server` (named by plan.md §Technical Context and by T010) cannot be used: `svelteTesting()`
      in `vite.config.ts` sets the browser resolve condition, and quickstart.md §1 forbids changing
      `vite.config.ts`. Replace the current explanatory comment at the top of that describe block with one
      naming the DOM-branch assertion as the substitute, and do not weaken any existing assertion.
      **Implementation note**: the mechanism this task prescribes — reading the DOM after `render()`
      but before `settle()` — does not work. `@testing-library/svelte`'s `render()` flushes pending
      effects before it returns (verified: `data-measured` is already present and `min-height` already
      gone at that point), so the placeholder branch is never observable through it. The assertions
      therefore mount by hand with `mount()` from `svelte` and read the DOM before any `flushSync()`,
      which does reach the branch; a third case then calls `flushSync()` and asserts the swap to the
      measured branch. `render()` from `svelte/server` was re-checked and does throw under the browser
      resolve condition, as this task and plan.md predicted.
- [X] T029 Extend the `lineCount` tests in
      `src/lib/components/ui/badge-overflow/badge-overflow.test.ts` with an **overflowing** three-line
      case per SC-001 (partial). SC-001 requires the "no line exceeds the container width, and `+N` equals
      the exact hidden count" guarantee to be verified "across at least the single-line default and the
      two-line and three-line configurations", but the existing `lineCount` 3 case uses the 6-item `TAGS`
      fixture at 256px, where every badge fits (`visibleCounts` is `[2, 5, 6]`, `data-hidden-count` is
      `"0"`, no indicator renders) — so the three-line branch of `computeVisibleSplit` is never contended.
      Add a case using the 15-item `TECHNOLOGIES` fixture at `lineCount: 3` that asserts the indicator
      renders, `data-hidden-count` equals `items.length` minus the rendered badges, and each of the three
      lines' summed `widthWithGap(...)` stays within the container width (the last line also reserving
      `DEFAULT_OVERFLOW_BADGE_WIDTH`), in the same hand-computable style as the existing `lineCount: 2`
      case.
- [X] T030 Restore upstream's Default-preview overflow variant in
      `src/routes/docs/components/badge-overflow/+page.svelte` per SC-006 / T024 (contradicts). The page
      defines a single `moreOverflow` snippet using `<Badge variant="outline" class="bg-muted">` and passes
      it to both the **Default** and the **Interactive Tags** previews, but the two upstream demos differ:
      `badge-overflow-demo.tsx` renders `renderOverflow` as
      `<Badge variant="secondary" className="bg-muted">+{count} more</Badge>` while only
      `badge-overflow-interactive-demo.tsx` uses `variant="outline"`. Add a second snippet (e.g.
      `secondaryMoreOverflow`) with `variant="secondary"` for the Default preview's custom-overflow box and
      leave the Interactive Tags preview on the `outline` one, so each preview matches the demo file it is
      documented as mirroring. Everything else on the page already matches upstream (`w-64` / `max-w-80`
      boxes, the 10-item and 15-item lists, the 12 object tags, `lineCount={2}`, `Enter`-to-add, the `X`
      icon with no sizing class because `badgeVariants` applies `[&>svg]:size-3!`, and the two helper
      captions) — change nothing else.

**Checkpoint**: `pnpm run format`, `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and
`pnpm run build` all pass, with no suppression added and no existing assertion removed. `registry.json`
and `static/r/` need no regeneration: T028–T030 touch only the test file and the demo route, neither of
which is a registry file.
