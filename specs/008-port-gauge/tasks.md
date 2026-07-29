---
description: 'Task list for the Gauge port'
---

# Tasks: Port the Gauge component

**Input**: Design documents from `/specs/008-port-gauge/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/public-api.md, quickstart.md

**Tests**: Tests are MANDATORY (Constitution Principle III / CLAUDE.md §7). Colocated at
`src/lib/components/ui/gauge/gauge.test.ts`, driven by a `gauge.test.svelte` harness.

**Organization**: Tasks are grouped by user story (spec.md P1/P2/P3) so each story is independently
implementable and testable, preceded by Setup and a Foundational phase (the shared geometry module +
state/context), and followed by Demo, Registry and Quality Gate phases.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: Maps a task to US1/US2/US3 from spec.md
- Every task names a concrete file path relative to the repository root

---

## Phase 1: Setup

**Purpose**: Confirm the component has no new dependencies and the target folders exist.

- [X] T001 Verify zero new npm dependencies are required for the Gauge port (per plan.md Technical
      Context: `bits-ui` evaluated-not-used, no `tailwind-variants`) by confirming
      `src/lib/components/ui/circular-progress/`, `bits-ui`, and `$lib/utils.js` (`cn()`) are already
      present; create the empty target folder `src/lib/components/ui/gauge/` and confirm
      `src/routes/docs/components/gauge/` does not yet exist.
- [X] T002 [P] Add a placeholder `registry.json` stub entry for `"gauge"` (name, type
      `registry:ui`, title `"Gauge"`, description, empty `registryDependencies`/`dependencies`, empty
      `files`) at the end of the `items` array in `registry.json` at the repository root, to be filled
      in with real file paths in Phase 7 (T035).

**Checkpoint**: Folders and registry stub exist; no code written yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared arc-geometry helpers (extending `circular-progress`) and the Gauge state/context
module that every user story's parts depend on. **No user story task may start until this phase is
green.**

- [X] T003 Add `Point` type and pure exported functions `getNormalizedAngle(angle)`,
      `polarToCartesian(cx, cy, r, angleDeg)`, `describeArc(x, y, r, startAngle, endAngle)`,
      `getArcLength(r, startAngle, endAngle)`, `getArcCenterY(center, r, startAngle, endAngle)` to
      `src/lib/components/ui/circular-progress/circular-progress.svelte.ts`, per the exact definitions
      in data-model.md §5 (0° = 12 o'clock, clockwise; `describeArc` splits into two chained `A`
      segments when `|Δ| >= 360`; `getArcCenterY` widens bounds to `center ∓ r` when the sweep crosses
      270°/90°, per research.md R-03). Do not modify any existing export in this file.
- [X] T004 Re-export `Point`, `getNormalizedAngle`, `polarToCartesian`, `describeArc`, `getArcLength`,
      `getArcCenterY` from `src/lib/components/ui/circular-progress/index.ts` (depends on T003; same
      barrel file already re-exports `getRingGeometry` etc. — add the five new names beside them,
      alphabetically ordered to match the existing `export { ... } from './circular-progress.svelte.js'`
      block style).
- [X] T005 [P] Add unit tests for the five new geometry functions to
      `src/lib/components/ui/gauge/gauge.test.ts` (a dedicated `describe('geometry helpers')` block,
      importing them through `./index.js` per research.md R-19; **do not modify**
      `circular-progress.test.ts` — its untouched green state is the regression proof required by
      plan.md Phase A/T037): `getNormalizedAngle` (negative, `> 360`, exact multiples of 360),
      `polarToCartesian` (0°=top, 90°=right, 180°=bottom, 270°=left), `describeArc` (single-`A` partial
      arc with large-arc-flag `0` for `Δ <= 180` and `1` above; two-`A` form for `|Δ| >= 360`;
      degenerate `start === end`), `getArcLength` (full/half/three-quarter/zero/over-360 clamp),
      `getArcCenterY` (full circle → `center`; `-90→90`, `-135→135`, `0→90` → `center`; `40→40` →
      `center - r·cos(40°)`, per research.md R-03). Compute every expectation from first principles in
      the test, not by calling the function under a different name (depends on T003).
- [X] T006 Create `src/lib/components/ui/gauge/gauge.svelte.ts` with: `GaugeState` type (alias of
      `ProgressState`), constants `DEFAULT_GAUGE_SIZE` (120), `DEFAULT_GAUGE_THICKNESS` (8),
      `DEFAULT_START_ANGLE` (0), `DEFAULT_END_ANGLE` (360); `getDefaultGaugeValueText(value, min, max)`
      returning `Math.round(percentage).toString()` (no `%`, `max === min` → percentage against 100 per
      data-model.md §3); the `GaugeRootState` runes class with every `$derived` member listed in
      data-model.md §6 (`min`, `max`, `value`, `percentage`, `state`, `valueText`, `size`, `thickness`,
      `radius`, `center`, `startAngle`, `endAngle`, `arcPath`, `arcLength`, `arcCenterY`,
      `strokeDasharray`, `strokeDashoffset`, `labelId`, `valueTextId`, `hasLabel`), the single `$state`
      label counter, and `registerLabel()`/`unregisterLabel()` methods; import
      `resolveProgressBounds`, `clampProgressValue`, `getProgressPercentage`, `getProgressState`,
      `getRingGeometry` from `../circular-progress/circular-progress.svelte.js` and `describeArc`,
      `getArcLength`, `getArcCenterY` from the same module (depends on T003).
- [X] T007 Add the typed `Symbol` context trio to `src/lib/components/ui/gauge/gauge.svelte.ts`:
      module-private `const GAUGE_CONTEXT_KEY = Symbol('gauge')`, `setGaugeContext(state)`,
      `hasGaugeContext()`, and `getGaugeContext(consumerName?)` that throws a message naming both the
      calling part and `` `<Gauge>` `` (mirroring the `tags-input`/`circular-progress` pattern in
      CLAUDE.md §5) (depends on T006; same file as T006, not parallel).
- [X] T008 [P] Write `src/lib/components/ui/gauge/gauge.test.svelte` — a markup harness component that
      accepts `dir`, root props, and `child`/`children` snippets for `Root`/`ValueText`/`Label`, so
      `gauge.test.ts` can render full compositions (incl. `dir="rtl"`) without repeating markup in every
      test (mirrors `circular-progress.test.svelte`; not collected by Vitest itself, not listed in
      `registry.json`).

**Checkpoint**: Shared geometry exists and is unit-tested; `GaugeRootState` and context helpers compile
in isolation. User story work can now begin.

---

## Phase 3: User Story 1 - Compose a labeled gauge from its parts (Priority: P1) 🎯 MVP

**Goal**: A developer can render `<Gauge.Root>` with `Indicator > (Track, Range)`, `ValueText`, and
`Label`, and get correct arc fill, value text, ARIA (`role="meter"`, `aria-valuenow`/`aria-valuemin`/
`aria-valuemax`, `aria-labelledby`, `aria-describedby`) and the `indeterminate` state when no `value` is
given.

**Independent Test**: Render `<Gauge>` with `value={45}`, its `Indicator`/`Track`/`Range` children, a
`ValueText` and a `Label`; assert the range fill, value text and ARIA wiring described in spec.md
Acceptance Scenarios 1–3.

### Tests for User Story 1 (MANDATORY — Principle III) ⚠️

> Write these first; they must fail until the corresponding implementation task lands.

- [X] T009 [P] [US1] In `src/lib/components/ui/gauge/gauge.test.ts`, write the roles/ARIA test group:
      `role="meter"`; `aria-valuemin`/`aria-valuemax` always present; `aria-valuenow`/`aria-valuetext`
      present when determinate and absent when indeterminate; `aria-describedby` equals the value
      text's `id`; `aria-labelledby` equals the label's `id` only when `Gauge.Label` is rendered and is
      absent otherwise; the indicator `svg` has `aria-hidden="true"` and `focusable="false"`; the
      accessible name resolves from the label (spec.md Acceptance Scenarios 1–2, contracts/public-api.md).
      Also assert the full attribute-projection table (data-model.md, FR-007): `data-slot` on all six
      parts (`gauge`, `gauge-indicator`, `gauge-track`, `gauge-range`, `gauge-value-text`, `gauge-label`),
      with `data-state` on every part and `data-value`/`data-min`/`data-max`/`data-percentage` mirrored
      onto `Indicator` and `Range` in both the determinate and indeterminate states. Finally, toggle a
      `Gauge.Label` via `{#if}` in the `gauge.test.svelte` harness and assert the root's
      `aria-labelledby` is added then removed after `await tick()`, covering `registerLabel()`/
      `unregisterLabel()` (research.md R-06).
- [X] T010 [P] [US1] In `src/lib/components/ui/gauge/gauge.test.ts`, write the uncontrolled/default
      state test group: no `value` (and explicit `value={null}`) ⇒ `data-state="indeterminate"`, no
      `aria-valuenow`, no `data-value`, no `data-percentage`, range `stroke-dashoffset === 0`, empty
      value text; default prop values `size=120`, `thickness=8`, `startAngle=0`, `endAngle=360`,
      `min=0`, `max=100` (spec.md Acceptance Scenario 3).
- [X] T011 [P] [US1] In `src/lib/components/ui/gauge/gauge.test.ts`, write the guard-rails test group:
      `Indicator`, `Track`, `Range`, `ValueText`, `Label` each throw a descriptive
      ``/must be used within `<Gauge>`/`` error when rendered outside `Gauge.Root` (spec.md Edge Cases,
      FR-014).
- [X] T012 [P] [US1] In `src/lib/components/ui/gauge/gauge.test.ts`, write the value-clamping edge-case
      test group: `value > max` and `value < min` clamp into `[min, max]` (state stays `loading`/
      `complete` accordingly, never throws) (spec.md Edge Cases, FR-002).

### Implementation for User Story 1

- [X] T013 [US1] Create `src/lib/components/ui/gauge/gauge.svelte` (Root): module-script `GaugeRootProps`
      = `WithElementRef<HTMLAttributes<HTMLDivElement>>` plus `value`, `getValueText`, `min`, `max`,
      `size`, `thickness`, `startAngle`, `endAngle`, `class`, `children`, `child` per plan.md's Public
      API table; instance script builds one `GaugeRootState` via `new GaugeRootState({ getValue: () =>
      value, ... })`, calls `setGaugeContext(state)`, uses `$props.id()` for `labelId`/`valueTextId`;
      renders `role="meter"`, `aria-valuemin`/`aria-valuemax` always, `aria-valuenow`/`aria-valuetext`
      only when determinate, `aria-describedby` when `valueText` is defined, `aria-labelledby` only when
      `state.hasLabel`; emits `data-slot="gauge"`, `data-state`, `data-value`*, `data-min`, `data-max`,
      `data-percentage`*; supports the `child` snippet in place of `asChild` (depends on T006, T007).
- [X] T014 [US1] Create `src/lib/components/ui/gauge/gauge-indicator.svelte`: `<svg aria-hidden="true"
      focusable="false" width={size} height={size} viewBox="0 0 {size} {size}" class="transform">`
      reading `size`/`state`/`value`/`min`/`max`/`percentage` from `getGaugeContext('GaugeIndicator')`;
      `ref = $bindable<SVGSVGElement | null>(null)`; `data-slot="gauge-indicator"` plus
      `data-state`/`data-value`*/`data-min`/`data-max`/`data-percentage*` (depends on T007).
- [X] T015 [P] [US1] Create `src/lib/components/ui/gauge/gauge-track.svelte`: `<path d={arcPath}
      fill="none" stroke="currentColor" stroke-width={thickness} stroke-linecap="round"
      vector-effect="non-scaling-stroke" class="text-muted-foreground/20">` reading `arcPath`/
      `thickness`/`state` from `getGaugeContext('GaugeTrack')`; `ref = $bindable<SVGPathElement |
      null>(null)`; `data-slot="gauge-track"` + `data-state` (depends on T007; different file from
      T014/T016, safe to parallelize).
- [X] T016 [P] [US1] Create `src/lib/components/ui/gauge/gauge-range.svelte`: same path as Track plus
      `stroke-dasharray={strokeDasharray}` and `stroke-dashoffset={strokeDashoffset}`, class
      `text-primary transition-[stroke-dashoffset] duration-700 ease-out`; reads from
      `getGaugeContext('GaugeRange')`; `data-slot="gauge-range"` + `data-state`/`data-value`*/
      `data-min`/`data-max` (depends on T007; different file, safe to parallelize with T015).
- [X] T017 [US1] Create `src/lib/components/ui/gauge/gauge-value-text.svelte`: `<div id={valueTextId}
      style="top: {arcCenterY}px;{callerStyle}">` with module-script `GaugeValueTextProps` (`ref`,
      `class`, `style`, `children`, `child`, restProps) per plan.md's table; renders `children ?? state
      .valueText`; class `absolute right-0 left-0 flex -translate-y-1/2 items-center justify-center
      text-2xl font-semibold`; `data-slot="gauge-value-text"` + `data-state`; reads
      `getGaugeContext('GaugeValueText')` (depends on T007).
- [X] T018 [US1] Create `src/lib/components/ui/gauge/gauge-label.svelte`: `<div id={labelId}>` with
      class `mt-2 text-sm font-medium text-muted-foreground`; calls `state.registerLabel()` on init and
      `state.unregisterLabel()` in a single `$effect` teardown; `data-slot="gauge-label"` + `data-state`;
      reads `getGaugeContext('GaugeLabel')` [P] with T017 — different files, both depend only on T007.
- [X] T019 [US1] Create `src/lib/components/ui/gauge/index.ts` barrel: import `Root`, `Indicator`,
      `Track`, `Range`, `ValueText`, `Label` (Combined added in Phase 4/US2 — see T024); re-export their
      prop types; export short names, prefixed aliases (`Root as Gauge`, `Indicator as
      GaugeIndicator`, …), and the `gauge.svelte.ts` public exports (`GaugeState`, the four `DEFAULT_*`
      constants, `getDefaultGaugeValueText`, `GaugeRootState`, `setGaugeContext`, `getGaugeContext`,
      `hasGaugeContext`), following the exact barrel shape in CLAUDE.md §3 and
      `circular-progress/index.ts` (depends on T013–T018).
- [X] T020 [US1] Implement the roles/ARIA, uncontrolled and guard-rail test bodies against the real
      components in `src/lib/components/ui/gauge/gauge.test.ts` so T009–T012 go from failing to passing
      (depends on T013–T019; import from `./index.js` per repo convention).

**Checkpoint**: User Story 1 is fully functional — a labeled gauge composes correctly and passes its
tests independently of US2/US3.

---

## Phase 4: User Story 2 - Customize size, thickness, angles and the value's text (Priority: P2)

**Goal**: `size`, `thickness`, `startAngle`, `endAngle`, and `getValueText` each independently drive
correct geometry, stroke width and formatted text — including the semi-circle, three-quarter-circle and
full-circle (`|Δ| >= 360` two-semicircle) cases.

**Independent Test**: Render several gauges with different `size`/`thickness`/`startAngle`/`endAngle`/
`getValueText` side by side; confirm each renders independently per spec.md Acceptance Scenarios 1–4.

### Tests for User Story 2 (MANDATORY — Principle III) ⚠️

- [X] T021 [P] [US2] In `src/lib/components/ui/gauge/gauge.test.ts`, write the "every prop" test group:
      `min`/`max` resolution (`max <= min ⇒ min + 1`, invalid `max ⇒ 100`, non-finite `min ⇒ 0`);
      `size`/`thickness` → `width`/`height`/`viewBox`/`stroke-width`; `startAngle`/`endAngle` → the `d`
      command/flag sequence asserted structurally and its coordinates asserted with `toBeCloseTo` (never
      string equality — `sin(-π)` leaves float residue), plus `stroke-dasharray`, for semi (`-90→90`),
      three-quarter (`-135→135`) and full-circle (`0→360`, two joined `A` segments) sweeps; custom
      `getValueText` drives both the rendered text and `aria-valuetext`; `class` on each of the seven
      parts merges after the defaults; `restProps` (e.g. `data-testid`) reach the underlying element
      (spec.md Acceptance Scenarios 1–4, FR-003/004/005/015).
- [X] T022 [P] [US2] In `src/lib/components/ui/gauge/gauge.test.ts`, write the remaining edge-case test
      group not already covered by US1: `startAngle === endAngle` renders `stroke-dasharray="0"` without
      throwing; `|Δ| > 360` clamps `arcLength` to the full circumference; `thickness >= size` ⇒
      `radius === 0` without throwing; and, per FR-020, `vi.spyOn(console, 'error'/'warn')` asserts that
      an invalid `max`, an invalid `value` and `thickness >= size` each log exactly once with the message
      text pinned in contracts/public-api.md §2, while the rendered fallbacks (`max = 100`, clamped
      value, `radius = 0`) still apply (spec.md Edge Cases, FR-020, research.md's Circular Progress
      precedent).

### Implementation for User Story 2

- [X] T023 [US2] Extend `src/lib/components/ui/gauge/gauge.svelte` (Root) with the dev-only diagnostics
      behind `import.meta.env.DEV` + `untrack()` for invalid `max`, invalid `value`, and
      `thickness >= size`, mirroring `circular-progress.svelte`'s existing guard convention (depends on
      T013; same file as T013, sequential).
- [X] T024 [US2] Create `src/lib/components/ui/gauge/gauge-combined.svelte`: `GaugeCombinedProps =
      WithoutChildrenOrChild<GaugeRootProps>`; renders `Root > Indicator > (Track, Range)` + `ValueText`,
      forwarding `ref` and every root prop, no `label` prop (spec §Assumptions) (depends on T013–T017).
- [X] T025 [US2] Add `Combined` to the `src/lib/components/ui/gauge/index.ts` barrel: import, export its
      prop type, add `Combined` and `Combined as GaugeCombined` to the export list (depends on T019,
      T024; same file as T019, sequential).
- [X] T026 [US2] Implement the "every prop" and remaining edge-case test bodies in
      `src/lib/components/ui/gauge/gauge.test.ts` so T021–T022 go from failing to passing (depends on
      T023–T025).

**Checkpoint**: User Stories 1 AND 2 both work independently — geometry, sizing and text formatting are
fully customizable and tested.

---

## Phase 5: User Story 3 - Theme parts independently and animate value changes (Priority: P3)

**Goal**: Changing `value` at runtime animates the range's `stroke-dashoffset` via CSS transition rather
than jumping; overriding `class` on each part changes only that part's `currentColor`, independent of
the others.

**Independent Test**: Render a gauge, change `value` via `rerender`, and confirm the range's computed
`stroke-dashoffset` moves to the new value while the transition class stays applied; override `class` on
`Track`/`Range`/`ValueText`/`Label` and confirm no cross-part leakage (spec.md Acceptance Scenarios 1–2).

### Tests for User Story 3 (MANDATORY — Principle III) ⚠️

- [X] T027 [P] [US3] In `src/lib/components/ui/gauge/gauge.test.ts`, write the controlled test group:
      `rerender({ value: n })` moves `aria-valuenow`, `aria-valuetext`, `data-value`, `data-percentage`
      and the range's `stroke-dashoffset`; the range keeps its `transition-[stroke-dashoffset]` class
      across the change (no full re-render flash); a bound page-level `value` is never written back by
      the component (spec.md Acceptance Scenario 1, FR-010, SC-004).
- [X] T028 [P] [US3] In `src/lib/components/ui/gauge/gauge.test.ts`, write the per-part `class`-override
      test group: a custom `class` on `Track`, `Range`, `ValueText`, and `Label` merges after each part's
      default classes (via `cn()`) and does not affect sibling parts (spec.md Acceptance Scenario 2,
      FR-015).
- [X] T029 [P] [US3] In `src/lib/components/ui/gauge/gauge.test.ts`, write the RTL test group: inside
      `<div dir="rtl">` (via the `gauge.test.svelte` harness), the arc `d`, `stroke-dasharray`,
      `stroke-dashoffset`, `viewBox` and computed classes are byte-identical to the LTR render — angles
      do not mirror (spec.md Edge Cases, plan.md Constraints).
- [X] T030 [P] [US3] In `src/lib/components/ui/gauge/gauge.test.ts`, write the Svelte-specific test
      group: `bind:ref` populates all six elements (root `div`, indicator `svg`, track/range `path`s,
      value-text/label `div`s); the `child` snippet on `Root`, `ValueText` and `Label` receives and
      applies the full attribute payload; `children` on `ValueText` overrides the computed value text,
      including while the gauge is indeterminate (the `id` is still emitted and `aria-describedby`
      stays absent per FR-006/FR-011); `Combined` renders the same DOM shape as the equivalent manual
      composition; `ValueText`'s inline `top` equals `arcCenterY` and a caller-supplied `style` is
      appended after it, not before.
- [X] T030a [P] [US3] In `src/lib/components/ui/gauge/gauge.test.ts`, write the keyboard /
      non-interactivity test group (plan.md Test Plan §3, Constitution III, FR-021): the root exposes no
      `tabindex` and is not in the tab order — `user.tab()` from a preceding `<button>` lands on the
      following `<button>`, skipping the meter; with the root focused via `root.focus()`,
      `user.keyboard('{Enter}{Space}{ArrowUp}{ArrowDown}{ArrowLeft}{ArrowRight}{Home}{End}{Escape}')`
      leaves `aria-valuenow`, `aria-valuetext`, `data-value`, `data-percentage` and the range's
      `stroke-dashoffset` byte-identical (the upstream key set is empty and is asserted as such, not
      assumed); the indicator `svg` carries `focusable="false"` so it is not focusable in any engine.

### Implementation for User Story 3

- [X] T031 [US3] Verify `src/lib/components/ui/gauge/gauge-range.svelte` (created in T016) already
      exposes the `transition-[stroke-dashoffset] duration-700 ease-out` class and that changing `value`
      only recomputes `strokeDashoffset` (no `$effect`); adjust if the CSS transition class was dropped
      during merge review (depends on T016; likely a no-op verification, not a rewrite).
- [X] T032 [US3] Confirm every part component (`gauge.svelte`, `gauge-indicator.svelte`,
      `gauge-track.svelte`, `gauge-range.svelte`, `gauge-value-text.svelte`, `gauge-label.svelte`)
      merges the caller's `class` prop **last** through `cn()` per CLAUDE.md §6; fix any part where the
      default classes are not merged first (depends on T013–T018).
- [X] T033 [US3] Implement the controlled, class-override, RTL, Svelte-specific and
      keyboard/non-interactivity test bodies in `src/lib/components/ui/gauge/gauge.test.ts` so
      T027–T030a go from failing to passing (depends on T031–T032).

**Checkpoint**: All three user stories are independently functional and tested; the full behavioural
matrix from plan.md's Test Plan (§1–9) is covered across T009–T012, T021–T022, T027–T030a.

---

## Phase 6: Demo Route

**Purpose**: One documented example per upstream demo file (FR-018, SC-002).

- [X] T034 Create `src/routes/docs/components/gauge/+page.svelte` with five `<ComponentPreview>`
      sections mirroring `.reference/diceui/docs/registry/bases/radix/examples/gauge-*-demo.tsx`:
      **Default** (`value=85`, `size=180`, `thickness=12`, sr-only `Label` "Performance"), **Sizes**
      (three gauges — 100/6, 140/10, 180/12 — counting to 68 with a staggered `index * 150ms` start
      using `$state` + `setTimeout`/`setInterval` inside `$effect` with teardowns, per research.md
      R-13), **Colors** (CPU 45 / Memory 68 / Disk 92 / Network 28 counting up on a 20ms interval,
      `size=120 thickness=10`, using `success`/`warning`/`destructive`/`info` tokens per CLAUDE.md §6),
      **Variants** (Semi `-90→90`, Three Quarter `-135→135`, Full Circle `0→360`, `size=140
      thickness=10`, counting to 72), and **Combined** (`Gauge.Combined` beside the equivalent manual
      composition at the same value) (depends on T019, T025).

**Checkpoint**: `pnpm run dev` renders `/docs/components/gauge` with all five sections.

---

## Phase 7: Registry Entry and Docs Polish

**Purpose**: Make the component installable via the shadcn-svelte registry (FR-017).

- [X] T035 Replace the stub `"gauge"` entry from T002 in `registry.json` with the final entry: `name:
      "gauge"`, `type: "registry:ui"`, `title: "Gauge"`, description, `registryDependencies: []`,
      `dependencies: []`, and a `files` array listing all 9 gauge files (`index.ts`, `gauge.svelte`,
      `gauge-indicator.svelte`, `gauge-track.svelte`, `gauge-range.svelte`, `gauge-value-text.svelte`,
      `gauge-label.svelte`, `gauge-combined.svelte`, `gauge.svelte.ts` — no test files) **plus**
      `src/lib/components/ui/circular-progress/circular-progress.svelte.ts` (the extended shared
      geometry module, so a standalone install is self-contained per plan.md's Public API "Shared module
      exports" note) — 10 files total (depends on T019, T024, T025, T034).
- [X] T036 Run `pnpm run registry:build` and confirm `static/r/gauge.json` is emitted with the targets
      described in quickstart.md §2 (inlined file contents, `$lib/...` imports rewritten to registry
      placeholders); assert `j.files.length === 10` and that `gauge/gauge.svelte.ts` is among the emitted
      targets (depends on T035).

**Checkpoint**: `registry.json` has exactly one new `"gauge"` entry; `static/r/gauge.json` exists.

---

## Phase 8: Quality Gates (MANDATORY — Principle VII)

**Purpose**: The feature is not complete until all four gates are green (preceded by `pnpm run format`),
run in this exact order. No suppressions (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`,
`svelte-ignore`, `as any`, `.skip`/`.todo`, deleted assertions, loosened configs) may be used to reach
green — fix the root cause.

- [X] T037 Run `pnpm run format` first (Prettier writes; `pnpm run lint` runs `prettier --check .` and
      would otherwise fail on unformatted new files), then `pnpm run check`, `pnpm run lint`,
      `pnpm run test:unit -- --run` and `pnpm run build`, and fix the root cause of everything that fails
      — no suppressions (also re-run and confirm `circular-progress.test.ts` is still green, per plan.md
      Phase J and Constitution VII, since T003–T004 extended a shared file used by another shipped
      component).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories (T013 onward all import from
  `gauge.svelte.ts` / the extended `circular-progress.svelte.ts`).
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational; `gauge-combined.svelte` (T024) additionally
  depends on US1's `gauge.svelte`/`gauge-indicator.svelte`/`gauge-track.svelte`/`gauge-range.svelte`/
  `gauge-value-text.svelte` (T013–T017) existing, and the barrel (T019) existing before T025 extends it.
- **User Story 3 (Phase 5)**: Depends on Foundational and on the part files existing (T013–T018) to
  verify/adjust them; independently testable via its own test group.
- **Demo (Phase 6)**: Depends on the barrel (T019) and `Combined` (T025) existing.
- **Registry (Phase 7)**: Depends on all component files (T019, T024, T025) and the demo (T034).
- **Quality Gates (Phase 8)**: Depends on everything above — always last.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational. No dependency on other stories — this is the
  MVP.
- **User Story 2 (P2)**: Can start after Foundational; `gauge-combined.svelte` needs US1's part files to
  exist first (see above), so in practice schedule US2's implementation tasks after US1's Phase 3
  implementation tasks even though the *test-writing* tasks (T021–T022) are independent.
- **User Story 3 (P3)**: Can start after Foundational; its implementation tasks review/adjust files US1
  created, so schedule after Phase 3's implementation tasks for the same reason.

### Within Each User Story

- Tests (the "MANDATORY" subsection) are written first and must fail before the matching implementation
  task lands.
- State/context (Foundational) before parts; parts before the barrel; barrel before Combined/demo/
  registry.

### Parallel Opportunities

- T002 (registry stub) can run parallel to T001.
- T005 (geometry unit tests) can run parallel to T004 (barrel re-export) once T003 lands.
- T008 (test harness) can run parallel to T006/T007 (different file).
- T015 and T016 (`gauge-track.svelte`, `gauge-range.svelte`) can run in parallel — different files, both
  depend only on T007.
- T009–T012 (US1 test groups) can all run in parallel — same file (`gauge.test.ts`) but independent
  `describe` blocks written by different passes; mark `[P]` for authoring, but note they land in one
  file so merge sequentially if a single author is writing them.
- T021–T022 (US2 tests) and T027–T030a (US3 tests) are likewise parallel-authorable groups within the
  same test file.

---

## Parallel Example: Foundational Phase

```bash
# After T003 (geometry functions) lands, these two can run together:
Task: "Re-export the five new geometry functions from circular-progress/index.ts (T004)"
Task: "Add unit tests for the five new geometry functions to gauge.test.ts (T005)"

# T008 (test harness) can run alongside T006/T007 (state class + context):
Task: "Write gauge.test.svelte harness (T008)"
Task: "Create GaugeRootState in gauge.svelte.ts (T006)"
```

## Parallel Example: User Story 1

```bash
# After T007 (context) lands, these two implementation tasks can run together:
Task: "Create gauge-track.svelte (T015)"
Task: "Create gauge-range.svelte (T016)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1 (Root, Indicator, Track, Range, ValueText, Label, barrel, tests).
4. **STOP and VALIDATE**: a labeled, accessible gauge renders and its tests pass independently.
5. Demo the MVP via the Default section of the docs route (a minimal slice of Phase 6).

### Incremental Delivery

1. Setup + Foundational → shared geometry and state/context ready.
2. Add User Story 1 → test independently → MVP.
3. Add User Story 2 → test independently → sizing/angle/text customization ready.
4. Add User Story 3 → test independently → theming/animation confirmed.
5. Demo route → Registry entry → Quality Gates.

---

## Notes

- `*` in a `data-*` attribute description means "omitted while `state === 'indeterminate'`" per
  data-model.md's attribute projection table.
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X).
- Do NOT touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json` or `.port-logs/`.
- Reuse, never duplicate: the arc-geometry helpers (T003) live in `circular-progress.svelte.ts` and are
  imported here, not re-derived (FR-019).

---

## Phase 9: Convergence

**Purpose**: Close gaps found by auditing the implemented port against spec.md, plan.md and upstream
(`.reference/diceui/docs/registry/bases/radix/ui/gauge.tsx`,
`.reference/diceui/docs/content/docs/components/radix/gauge.mdx`).

- [X] T038 Add a test to `src/lib/components/ui/gauge/gauge.test.ts` proving the dev-only diagnostics for
      an invalid `max`, an invalid `value`, and `thickness >= size` are silent (no `console.error`/
      `console.warn` calls) when the `import.meta.env.DEV` guard is false, per FR-020 (missing)
- [X] T039 In `src/routes/docs/components/gauge/+page.svelte`'s "Colors" section, tint each theme's
      `Gauge.ValueText` with its semantic-token text color (`text-success`/`text-warning`/
      `text-destructive`/`text-info`, matching the `trackClass`/`rangeClass` already applied), mirroring
      upstream `gauge-colors-demo.tsx`'s `theme.textClass` per FR-018/SC-002 (partial)
- [X] T040 In `src/lib/components/ui/gauge/gauge.test.ts`, extend the "explicit children on ValueText"
      test (around the determinate case) to assert the root still carries `aria-describedby` pointing at
      the value text's `id` when determinate + custom `children` are both present, per FR-011 (partial)
- [X] T041 In `src/lib/components/ui/gauge/gauge.test.ts`, add rest-prop forwarding assertions (e.g. a
      `data-testid`) for `Gauge.Track`, `Gauge.Range`, `Gauge.ValueText`, and `Gauge.Label`, matching the
      existing root-only coverage, per FR-015 (partial)
- [X] T042 In `src/lib/components/ui/gauge/gauge.test.ts`, extend the "carries no tabindex" test (or add a
      sibling assertion) to confirm `Gauge.Track`, `Gauge.Range`, `Gauge.ValueText`, and `Gauge.Label` also
      carry no `tabindex`, per FR-021 (partial)
