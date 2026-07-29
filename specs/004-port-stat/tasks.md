---
description: 'Task list for the Stat port'
---

# Tasks: Stat

**Input**: Design documents from `/specs/004-port-stat/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/stat-public-api.md](./contracts/stat-public-api.md)

**Tests**: Tests are MANDATORY (constitution Principle III / VII). `Stat` is a stateless, presentational
component (plan.md Assumptions) — there is no `stat.svelte.ts`, no controlled/uncontrolled *value*, and no
context provider to throw an "outside its provider" error. The five requested behavioural areas are
therefore covered as follows: keyboard interaction → the composed `DropdownMenu.Trigger` +
`StatIndicator variant="action"` interaction (spec SC-005); accessibility roles and names →
`data-slot`/`role="separator"`/ARIA on the composed trigger; controlled vs uncontrolled state → this
component's actual analogue, namely default-fallback vs explicit-value behaviour on `variant`/`color`/`trend`
(no default is ever silently overridden once passed); RTL → grid mirroring under `dir="rtl"`; edge cases →
the five bullets in spec.md's Edge Cases section.

**Organization**: Tasks are grouped by phase per the requested phase order (Setup → Tests → Core component
files → Barrel and types → Demo route → Registry entry and docs polish → Verification), with `[US1]`/`[US2]`/`[US3]`
story labels applied to test and component-part tasks per the user story each part primarily serves.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to spec.md user stories — US1 (label+value card), US2 (indicator styles/colours),
  US3 (trend/separator/description)
- Every task names an exact file path relative to the repository root

## Path Conventions

- **Component source**: `src/lib/components/ui/stat/` — 7 parts, barrel `index.ts`, colocated tests
- **Demo route**: `src/routes/docs/components/stat/+page.svelte`
- **Registry**: `registry.json` at the repository root, built output in `static/r/`

---

## Phase 1: Setup

**Purpose**: Scaffold the folders/files the rest of the port fills in, and reserve the registry slot

- [ ] T001 Create the empty scaffold files for the component in `src/lib/components/ui/stat/`:
      `stat.svelte`, `stat-label.svelte`, `stat-indicator.svelte`, `stat-value.svelte`,
      `stat-trend.svelte`, `stat-separator.svelte`, `stat-description.svelte`, `index.ts`,
      `stat.test.ts`, `stat.test.svelte`; and create `src/routes/docs/components/stat/+page.svelte`
- [ ] T002 [P] Append a placeholder `"stat"` entry (`name`, `type: "registry:ui"`, `title`,
      `description`, empty `files: []`) to `registry.json` at the repository root, to be completed in
      Phase 6

**Checkpoint**: Folder structure and registry slot exist; no file has real content yet

---

## Phase 2: Tests (MANDATORY — write first, per Principle III/VII)

**Purpose**: One task per behavioural area requested, all targeting the colocated test files created in T001

- [ ] T003 [P] [US1] Write accessibility roles-and-names tests in
      `src/lib/components/ui/stat/stat.test.ts`: assert `data-slot="stat"` /
      `"stat-label"` / `"stat-indicator"` / `"stat-value"` / `"stat-trend"` / `"stat-description"` on
      their respective rendered parts, and that the composed `StatSeparator` exposes
      `role="separator"` + `aria-orientation` (or `role="none"` when `decorative`) via
      `$lib/components/ui/separator`
- [ ] T004 [P] [US2] Write keyboard-interaction tests in `src/lib/components/ui/stat/stat.test.svelte`
      (harness) and `src/lib/components/ui/stat/stat.test.ts`: compose `StatIndicator
      variant="action"` as the content of `DropdownMenu.Trigger` (no `child` snippet) and assert
      pointer click, `Enter`, and `Space` open the menu, `ArrowDown` moves to the first item, and
      `Escape` closes it, per contracts/stat-public-api.md and spec SC-005
- [ ] T005 [P] [US2] Write default-vs-explicit-value tests (this component's analogue of
      controlled/uncontrolled, since it holds no internal state — see plan.md Assumptions) in
      `src/lib/components/ui/stat/stat.test.ts`: `StatIndicator` with no `variant`/`color` renders
      `data-variant="default"` / `data-color="default"`; every explicit `variant`/`color` value is
      reflected verbatim; `StatTrend` with no `trend` prop has **no** `data-trend` attribute, and every
      explicit `trend` value is reflected verbatim
- [ ] T006 [P] [US1] Write RTL tests in `src/lib/components/ui/stat/stat.test.ts`: render `Stat.Root`
      under a `dir="rtl"` ancestor with `Label`, `Value`, and `Indicator` children and assert the
      indicator still lands in the grid's second column (the `**:data-[slot=stat-indicator]:col-start-2`
      rule applies) so the two-column layout mirrors instead of breaking
- [ ] T007 [P] [US3] Write edge-case tests in `src/lib/components/ui/stat/stat.test.ts` covering
      spec.md's Edge Cases: a very long unbroken value string renders without a `truncate` or
      `whitespace-nowrap` class; a card with only `Indicator` + `Value` (no label/trend/separator/
      description) renders without throwing; an unrecognised/misspelled `variant`, `color`, or `trend`
      value falls back to the variant table's default classes instead of crashing; `StatSeparator`
      renders correctly when used standalone outside `Stat.Root`

**Checkpoint**: All five test files/tasks exist and fail (no implementation yet) — confirms the tests
actually exercise the intended behaviour before Phase 3 begins

---

## Phase 3: Core component files (one per Public API subcomponent)

**Purpose**: Implement each of the seven exported parts from plan.md's Public API section

- [ ] T008 [P] [US1] Implement the root in `src/lib/components/ui/stat/stat.svelte`: shared prop
      shape only, `<div data-slot="stat">` with the two-column CSS grid and the `**:data-[slot=...]`
      child-targeting classes from contracts/stat-public-api.md
- [ ] T009 [P] [US1] Implement `StatLabel` in `src/lib/components/ui/stat/stat-label.svelte`: shared
      prop shape only, `<div data-slot="stat-label">`, small/muted/medium-weight text styling
- [ ] T010 [P] [US1] Implement `StatValue` in `src/lib/components/ui/stat/stat-value.svelte`: shared
      prop shape only, `<div data-slot="stat-value">`, large/semibold/tight-tracking text with no
      truncation or forced non-wrapping
- [ ] T011 [P] [US2] Implement `StatIndicator` in `src/lib/components/ui/stat/stat-indicator.svelte`:
      `<script lang="ts" module>` `tv()` table `statIndicatorVariants` (axes `variant`:
      default/icon/badge/action, `color`: default/success/info/warning/error, using
      `success`/`info`/`warning`/`destructive` semantic tokens per CLAUDE.md §6), `Omit<WithElementRef<
      HTMLAttributes<HTMLDivElement>>, 'color'>` props type, `data-variant`/`data-color` attributes
- [ ] T012 [P] [US3] Implement `StatTrend` in `src/lib/components/ui/stat/stat-trend.svelte`:
      `<script lang="ts" module>` `tv()` table `statTrendVariants` (up/down/neutral, `trend` has no
      default), `data-trend` attribute present only when `trend` is set
- [ ] T013 [P] [US3] Implement `StatSeparator` in `src/lib/components/ui/stat/stat-separator.svelte`:
      composes `$lib/components/ui/separator`'s `Separator`, overrides `data-slot="stat-separator"`,
      merges `class={cn('my-2', className)}`, forwards `orientation`/`decorative`/rest `Separator.RootProps`
- [ ] T014 [P] [US3] Implement `StatDescription` in
      `src/lib/components/ui/stat/stat-description.svelte`: shared prop shape only, `<div
      data-slot="stat-description">`, small/muted, full-width text

**Checkpoint**: All seven parts render correctly in isolation; Phase 2 tests that only need a single
part (e.g. T003, T005, T006, T007) can now pass

---

## Phase 4: Barrel and types

- [ ] T015 Create `src/lib/components/ui/stat/index.ts` (depends on T008–T014): import all seven
      parts and export short names (`Root`, `Label`, `Indicator`, `Value`, `Trend`, `Separator`,
      `Description`) plus prefixed aliases (`Stat`, `StatLabel`, `StatIndicator`, `StatValue`,
      `StatTrend`, `StatSeparator`, `StatDescription`); re-export `statIndicatorVariants`,
      `statTrendVariants`, the `STAT_INDICATOR_VARIANTS`/`STAT_INDICATOR_COLORS`/
      `STAT_TREND_DIRECTIONS` tuples, the `resolveStatIndicatorVariant`/`resolveStatIndicatorColor`/
      `resolveStatTrendDirection` normalisers, and every `Stat*Props` type plus the
      `StatIndicatorVariant`/`StatIndicatorColor`/`StatTrendDirection` unions, per plan.md's Public API
      "Non-component exports from the barrel" table

**Checkpoint**: `import * as Stat from '$lib/components/ui/stat/index.js'` resolves every symbol the
Phase 2 tests import; all Phase 2 tests should now pass

---

## Phase 5: Demo route

- [ ] T016 Build `src/routes/docs/components/stat/+page.svelte` (depends on T015): three
      `<ComponentPreview>` sections mirroring `stat-demo.tsx` (label + value + indicator + trend),
      `stat-variants-demo.tsx` (all 4 indicator variants × 5 colours), and `stat-layout-demo.tsx`
      (separator + description rich layout, and the `DropdownMenu.Trigger` + `StatIndicator
      variant="action"` composition per spec SC-005); plus 7 prop tables (one per part) and 1
      data-attribute table (`data-slot`, `data-variant`, `data-color`, `data-trend`)

**Checkpoint**: `/docs/components/stat` renders all three examples and satisfies spec SC-004

---

## Phase 6: Registry entry and docs polish

- [ ] T017 Replace the `registry.json` stub from T002 with the final entry: `name: "stat"`,
      `type: "registry:ui"`, `title: "Stat"`, `description` per spec.md, `registryDependencies:
      ["separator"]` (the only tier-1 primitive `stat`'s own files import — `dropdown-menu` is used by
      the demo only, per plan.md), `dependencies: []` (no new npm package), and a `files` array listing
      all 8 shipped files (`index.ts` + the 7 `stat-*.svelte`/`stat.svelte` parts), excluding
      `stat.test.ts` and `stat.test.svelte`
- [ ] T018 Run `pnpm run registry:build` (depends on T017) and confirm `static/r/stat.json` is
      generated with inlined file contents and rewritten `$lib/...` import placeholders

**Checkpoint**: `stat` installs through the registry exactly like every other component (spec SC-007)

---

## Phase 7: Verification

- [ ] T019 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`,
      and fix everything that fails

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** — no dependencies; T001 and T002 touch different files, both `[P]`-eligible in
  spirit (T002 is marked `[P]`; T001 is the prerequisite scaffold for every later task so it is listed
  first without a `[P]` tag)
- **Phase 2 (Tests)** — depends on T001 (files must exist to write into); T003–T007 are independent
  behavioural areas within possibly-overlapping files, but each targets a distinct describe block, so
  all are marked `[P]`
- **Phase 3 (Core)** — depends on Phase 2 existing (tests-first); T008–T014 are seven independent
  files with no cross-imports among the parts themselves, so all are `[P]`
- **Phase 4 (Barrel)** — T015 depends on all of T008–T014 (it imports every part)
- **Phase 5 (Demo)** — T016 depends on T015 (imports the barrel)
- **Phase 6 (Registry)** — T017 depends on T015 (needs the final file list) and supersedes the T002
  stub; T018 depends on T017
- **Phase 7 (Verification)** — T019 depends on every prior task

## Parallel Execution Example

Once Phase 1 (T001) is done, launch the five Phase 2 test tasks together:

```
T003, T004, T005, T006, T007  (all [P], distinct describe blocks in stat.test.ts/.svelte)
```

Once Phase 2 is done, launch all seven Phase 3 part implementations together:

```
T008, T009, T010, T011, T012, T013, T014  (all [P], distinct files, no cross-dependencies)
```

## Implementation Strategy

MVP = Phase 1 + Phase 2 (T003, T006, T007 subset relevant to US1) + Phase 3 (T008, T009, T010) +
Phase 4 (T015, barrel exporting only Root/Label/Value) delivers User Story 1 (label + value card)
independently installable and testable. US2 (T004, T005, T011) and US3 (T012, T013, T014) layer on
top without touching US1's files, so they can proceed in any order once Phase 4 is finalised with the
full export set. Phases 5–7 are cross-cutting and run last regardless of story order.
