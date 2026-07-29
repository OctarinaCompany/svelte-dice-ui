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

- [X] T001 Create the empty scaffold files for the component in `src/lib/components/ui/stat/`:
      `stat.svelte`, `stat-label.svelte`, `stat-indicator.svelte`, `stat-value.svelte`,
      `stat-trend.svelte`, `stat-separator.svelte`, `stat-description.svelte`, `index.ts`,
      `stat.test.ts`, `stat.test.svelte`; and create `src/routes/docs/components/stat/+page.svelte`
- [X] T002 [P] Append a placeholder `"stat"` entry (`name`, `type: "registry:ui"`, `title`,
      `description`, empty `files: []`) to `registry.json` at the repository root, to be completed in
      Phase 6

**Checkpoint**: Folder structure and registry slot exist; no file has real content yet

---

## Phase 2: Tests (MANDATORY — write first, per Principle III/VII)

**Purpose**: One task per behavioural area requested, all targeting the colocated test files created in T001

- [X] T003 [US1] Write accessibility roles-and-names tests in
      `src/lib/components/ui/stat/stat.test.ts`: assert `data-slot="stat"` /
      `"stat-label"` / `"stat-indicator"` / `"stat-value"` / `"stat-trend"` / `"stat-description"` on
      their respective rendered parts, and that the composed `StatSeparator` exposes
      `role="separator"` and `aria-orientation="horizontal"` by default (bits-ui defaults `decorative`
      to `false`), and `role="none"` only when `decorative` is passed explicitly, via
      `$lib/components/ui/separator`
- [X] T004 [P] [US2] Write keyboard-interaction tests in `src/lib/components/ui/stat/stat.test.svelte`
      (harness) and `src/lib/components/ui/stat/stat.test.ts`: compose `StatIndicator
      variant="action"` as the content of `DropdownMenu.Trigger aria-label="Conversion rate actions"`
      (no `child` snippet) and assert pointer click, `Enter`, and `Space` open the menu, `ArrowDown`
      moves to the first item, and `Escape` closes it, per contracts/stat-public-api.md and spec
      SC-005; additionally assert the trigger's accessible name (FR-016, SC-008):
      `expect(screen.getByRole('button', { name: /conversion rate actions/i })).toBeInTheDocument();`
- [X] T005 [US2] Write default-vs-explicit-value tests (this component's analogue of
      controlled/uncontrolled, since it holds no internal state — see plan.md Assumptions) in
      `src/lib/components/ui/stat/stat.test.ts`: `StatIndicator` with no `variant`/`color` renders
      `data-variant="default"` / `data-color="default"`; every one of the 20
      `STAT_INDICATOR_VARIANTS` × `STAT_INDICATOR_COLORS` combinations renders the matching
      `data-variant` **and** `data-color` together with the corresponding V-11 and V-12 class rows and
      the V-10 base classes (SC-002, quickstart S3), and asserts no rendered class starts with `dark:`
      and none is a raw palette colour (`green-`, `blue-`, `orange-`, `red-`); `StatTrend` with no
      `trend` prop has **no** `data-trend` attribute, and every explicit `trend` value is reflected
      verbatim
- [X] T006 [US1] Write RTL tests in `src/lib/components/ui/stat/stat.test.ts`: render `Stat.Root`
      under a `dir="rtl"` ancestor with `Label`, `Value`, and `Indicator` children and assert the
      indicator still lands in the grid's second column (the `**:data-[slot=stat-indicator]:col-start-2`
      rule applies) so the two-column layout mirrors instead of breaking
- [X] T007 [US3] Write edge-case tests in `src/lib/components/ui/stat/stat.test.ts` covering
      spec.md's Edge Cases: a very long unbroken value string renders without a `truncate` or
      `whitespace-nowrap` class; a card with only `Indicator` + `Value` (no label/trend/separator/
      description) renders without throwing; an unrecognised/misspelled `variant`, `color`, or `trend`
      value falls back to the variant table's default classes instead of crashing; `StatSeparator`
      renders correctly when used standalone outside `Stat.Root`
- [X] T007a [US1] Write container/text class-contract tests in `src/lib/components/ui/stat/stat.test.ts`:
      assert every class of V-01 and V-02 on `Stat.Root`, V-03 on `Label`, V-04 on `Value`, V-05 on
      `Description`, and V-07 (no `truncate`/`whitespace-nowrap`/width class on `Value`) — quickstart S1.
- [X] T007b [US1] Write pass-through tests in `src/lib/components/ui/stat/stat.test.ts` and the
      `stat.test.svelte` harness: for every part, `bind:ref` reports the mounted element (C-01), a caller
      `class` wins the conflicting Tailwind axis over the component's own utility (C-02, FR-012), and
      `id`, `data-testid` and an `onclick` spy all reach the rendered element (C-04, FR-013) — quickstart S7.
- [X] T007c [US1] Write order-independence tests in `src/lib/components/ui/stat/stat.test.ts`:
      render the same six parts in two different source orders and assert identical `data-slot` sets and
      identical per-part class lists, and that the container's `**:data-[slot=…]` rules are present in both
      (FR-002, FR-010, C-40) — quickstart S8.
- [X] T007d Write barrel-surface tests in `src/lib/components/ui/stat/stat.test.ts`: every component
      resolves under both its short and prefixed name and `Stat.Indicator === StatIndicator` (B-01…B-18);
      the three tuples hold exactly the documented members in the documented order; `statIndicatorVariants()`
      and `statTrendVariants()` are callable and return the documented default rows (B-08…B-12) — quickstart S11.
- [X] T007e [US3] Extend `src/lib/components/ui/stat/stat.test.ts` with separator tests: `StatSeparator`
      carries `data-slot="stat-separator"` and `my-2`, and a caller `class="my-4"` merges rather than erasing
      the base margin (C-28, C-30, V-06) — quickstart S5.

**Checkpoint**: All test tasks (T003–T007e) exist and fail (no implementation yet) — confirms the tests
actually exercise the intended behaviour before Phase 3 begins

---

## Phase 3: Core component files (one per Public API subcomponent)

**Purpose**: Implement each of the seven exported parts from plan.md's Public API section

- [X] T008 [P] [US1] Implement the root in `src/lib/components/ui/stat/stat.svelte`: shared prop
      shape only, `<div data-slot="stat">` with the two-column CSS grid and the `**:data-[slot=...]`
      child-targeting classes from contracts/stat-public-api.md
- [X] T009 [P] [US1] Implement `StatLabel` in `src/lib/components/ui/stat/stat-label.svelte`: shared
      prop shape only, `<div data-slot="stat-label">`, small/muted/medium-weight text styling
- [X] T010 [P] [US1] Implement `StatValue` in `src/lib/components/ui/stat/stat-value.svelte`: shared
      prop shape only, `<div data-slot="stat-value">`, large/semibold/tight-tracking text with no
      truncation or forced non-wrapping
- [X] T011 [P] [US2] Implement `StatIndicator` in `src/lib/components/ui/stat/stat-indicator.svelte`:
      `<script lang="ts" module>` `tv()` table `statIndicatorVariants` (axes `variant`:
      default/icon/badge/action, `color`: default/success/info/warning/error, using
      `success`/`info`/`warning`/`destructive` semantic tokens per CLAUDE.md §6), `Omit<WithElementRef<
      HTMLAttributes<HTMLDivElement>>, 'color'>` props type, `data-variant`/`data-color` attributes
- [X] T012 [P] [US3] Implement `StatTrend` in `src/lib/components/ui/stat/stat-trend.svelte`:
      `<script lang="ts" module>` `tv()` table `statTrendVariants` (up/down/neutral, `trend` has no
      default), `data-trend` attribute present only when `trend` is set
- [X] T013 [P] [US3] Implement `StatSeparator` in `src/lib/components/ui/stat/stat-separator.svelte`:
      composes `$lib/components/ui/separator`'s `Separator`, overrides `data-slot="stat-separator"`,
      merges `class={cn('my-2', className)}`, forwards `orientation`/`decorative`/rest `Separator.RootProps`
- [X] T014 [P] [US3] Implement `StatDescription` in
      `src/lib/components/ui/stat/stat-description.svelte`: shared prop shape only, `<div
      data-slot="stat-description">`, small/muted, full-width text

**Checkpoint**: All seven parts render correctly in isolation; Phase 2 tests that only need a single
part (e.g. T003, T005, T006, T007) can now pass

---

## Phase 4: Barrel and types

- [X] T015 Create `src/lib/components/ui/stat/index.ts` (depends on T008–T014): import all seven
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

- [X] T016 Build `src/routes/docs/components/stat/+page.svelte` (depends on T015): three
      `<ComponentPreview>` sections, each mirroring one upstream demo file verbatim —
      **Default** (`stat-demo.tsx`): four cards in a `grid gap-4 sm:grid-cols-2` — Total Revenue
      (`variant="icon" color="success"`, trend up), Active Users (`variant="badge" color="info"`, trend
      up), Total Orders (`variant="icon" color="warning"`, trend down), and Conversion Rate, whose
      indicator is `variant="action"` composed as the content of a
      `DropdownMenu.Trigger aria-label="Conversion rate actions"` wrapping
      `<Stat.Indicator variant="action"><EllipsisIcon aria-hidden="true" /></Stat.Indicator>`, with
      three `DropdownMenu.Item`s (View details / Export data / Share) and
      `DropdownMenu.Content align="end"`, per spec FR-016 and SC-005/SC-008;
      **Variants** (`stat-variants-demo.tsx`): the four upstream cards — Default Indicator, Icon Variant
      (`color="success"`), Badge Variant (`color="info"`), Warning Color (`variant="icon" color="warning"`
      with `trend="down"`) — the exhaustive 4 × 5 sweep required by SC-002 lives in the test loop
      (T005 / quickstart S3), not in the demo;
      **Layout Options** (`stat-layout-demo.tsx`): the two upstream cards — Active Subscribers
      (indicator + description, no separator) and Monthly Revenue (indicator + separator + trend +
      description);
      plus 7 prop tables (one per part) and 1 data-attribute table (`data-slot`, `data-variant`,
      `data-color`, `data-trend`)

**Checkpoint**: `/docs/components/stat` renders all three examples and satisfies spec SC-004

---

## Phase 6: Registry entry and docs polish

- [X] T017 Replace the `registry.json` stub from T002 with the final entry: `name: "stat"`,
      `type: "registry:ui"`, `title: "Stat"`, `description` copied verbatim from
      contracts/stat-public-api.md §7: "A card for a key metric — label, value, colour-themed
      indicator, trend, separator and description — laid out on a two-column grid that positions its
      parts by slot.", `registryDependencies: ["separator"]` (the only tier-1 primitive `stat`'s own
      files import — `dropdown-menu` is used by the demo only, per plan.md),
      `dependencies: ["tailwind-variants"]` (the one package the shadcn CLI cannot infer from the
      source, matching the existing `status` entry in `registry.json` and contracts §7 / research.md
      R9; it is already installed, so no `pnpm install` and no `package.json` edit is needed), and a
      `files` array listing all 8 shipped files (`index.ts` + the 7 `stat-*.svelte`/`stat.svelte`
      parts), excluding `stat.test.ts` and `stat.test.svelte`
- [X] T018 Run `pnpm run registry:build` (depends on T017) and confirm `static/r/stat.json` is
      generated with inlined file contents and rewritten `$lib/...` import placeholders

**Checkpoint**: `stat` installs through the registry exactly like every other component (spec SC-007)

---

## Phase 7: Verification

- [X] T019 Run the quality gates in order and fix every failure at the root cause (no `@ts-ignore`,
      `eslint-disable`, `svelte-ignore`, `.skip`, `as any` or config loosening):
      `pnpm run format` → `pnpm run check` → `pnpm run lint` → `pnpm run test:unit -- --run` →
      `pnpm run build`

---

## Dependencies & Execution Order

- **Phase 1 (Setup)** — no dependencies; T001 and T002 touch different files, both `[P]`-eligible in
  spirit (T002 is marked `[P]`; T001 is the prerequisite scaffold for every later task so it is listed
  first without a `[P]` tag)
- **Phase 2 (Tests)** — depends on T001 (files must exist to write into); T003–T007e are independent
  behavioural areas but T003/T005/T006/T007/T007a/T007b/T007c/T007d/T007e all write `stat.test.ts`, so
  they are sequential; only T004's harness file (`stat.test.svelte`) is independently parallelisable
- **Phase 3 (Core)** — depends on Phase 2 existing (tests-first); T008–T014 are seven independent
  files with no cross-imports among the parts themselves, so all are `[P]`
- **Phase 4 (Barrel)** — T015 depends on all of T008–T014 (it imports every part)
- **Phase 5 (Demo)** — T016 depends on T015 (imports the barrel)
- **Phase 6 (Registry)** — T017 depends on T015 (needs the final file list) and supersedes the T002
  stub; T018 depends on T017
- **Phase 7 (Verification)** — T019 depends on every prior task

## Parallel Execution Example

Once Phase 1 (T001) is done, T004's harness work may run alongside the rest of Phase 2, but T003,
T005, T006, T007 and T007a–T007e append sequentially to the shared `stat.test.ts` — they MUST NOT run
concurrently:

```
T004 (stat.test.svelte harness) may run alongside T003; T003, T005, T006, T007, T007a, T007b, T007c,
T007d, T007e append sequentially to stat.test.ts — they share one file and MUST NOT run concurrently.
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
