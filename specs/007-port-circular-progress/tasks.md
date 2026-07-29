---
description: 'Task list for the Circular Progress component port'
---

# Tasks: Circular Progress Component Port

**Input**: Design documents from `specs/007-port-circular-progress/` (plan.md, spec.md, research.md,
data-model.md, contracts/public-api.md, quickstart.md)

**Prerequisites**: plan.md (loaded), spec.md (loaded), research.md, data-model.md, contracts/public-api.md,
quickstart.md — all present and read.

**Tests**: Tests are MANDATORY (constitution Principle III / VII). Every task below writes to real
repository paths; no task may be satisfied by a suppression (`@ts-ignore`, `@ts-expect-error`,
`eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, deleted assertions, loosened config).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency)
- **[Story]**: Traceability tag to spec.md's User Story 1 (compose a determinate ring), 2 (indeterminate
  loading state), 3 (theme/customize per-part styling) where a task is scoped to a single story;
  cross-cutting tasks (the shared module, the barrel, keyboard, RTL, guard rails, registry, gates) carry no
  tag
- Every description names its exact file path(s)

## Path Conventions

- Component source: `src/lib/components/ui/circular-progress/` — six parts, `circular-progress.svelte.ts`,
  `index.ts`
- Tests: colocated at `src/lib/components/ui/circular-progress/circular-progress.test.ts`, harness at
  `circular-progress.test.svelte`
- Demo route: `src/routes/docs/components/circular-progress/+page.svelte`
- Registry: `registry.json` at the repository root, generated output at
  `static/r/circular-progress.json`

---

## Phase 1: Setup (dependencies, registry stub)

**Purpose**: Scaffolding and dependency confirmation before any code is written.

- [X] T001 [P] Create the empty directories `src/lib/components/ui/circular-progress/` and
      `src/routes/docs/components/circular-progress/`; confirm against `package.json` and plan.md's
      Technical Context that zero new dependencies are needed (no `bits-ui` primitive is used — the
      `Progress.Root` rejection is written out in plan.md's Constitution Check IV — `tailwind-variants` is
      not required because no part has variants, and no `pnpm add` is run).
- [X] T002 [P] No-op placeholder — the registry entry is written once, complete, in Phase 6 (see T025),
      because `registry.json` is imported directly by `src/lib/registry.ts` to drive the docs sidebar and
      an incomplete stub entry (empty `files`) would make `/docs/components` list a component whose route
      does not exist yet.

**Checkpoint**: Directories exist, no new deps required.

---

## Phase 2: Tests (write first — MUST fail until Phase 3–5 land)

**Purpose**: Colocated tests for every behavioural area in plan.md's Test Plan (§8 areas 1–8), written
against the not-yet-implemented public API so they fail for the right reason (missing implementation, not
a typo) until Phase 3–5 complete.

- [X] T003 [P] Create the test harness `src/lib/components/ui/circular-progress/circular-progress.test.svelte`
      per plan.md's Test Plan area 7 and quickstart.md: a manual composition variant (`Root` >
      `Indicator` > `Track` + `Range`, plus `ValueText`) accepting `value`/`min`/`max`/`size`/`thickness`/
      `label`/`getValueText` props for rerender-driven controlled testing via a parent `$state`; a
      `child`-snippet variant on `Root` (spreading onto a caller `<button>`, asserting `ref` stays `null`)
      and on `ValueText`; a `dir="rtl"` variant wrapping the manual composition; and standalone exported
      render helpers for `Indicator`, `Track`, `Range`, `ValueText` rendered with no ancestor `Root`, to
      drive the FR-016 guard-rail throw for each part individually. Imports `* as CircularProgress` from
      `./index.js` (not yet created).
- [X] T004 [P] Write the pure-helper unit test group in
      `src/lib/components/ui/circular-progress/circular-progress.test.ts`, importing directly from
      `./circular-progress.svelte.ts` (not yet created): table-driven cases for `resolveProgressBounds`
      (valid min/max pass through; non-finite `min` → `0`; non-finite/`<=0` `max` → `100`; `max <= min` →
      `min + 1`, per data-model.md §2 and contracts/public-api.md §3 clamping table), `clampProgressValue`
      (in-range passthrough, `> max` clamp, `< min` clamp, `NaN`/`Infinity`/`null`/`undefined` → `null`),
      `getProgressPercentage` (normal division, the `max === min` ⇒ `1` branch that is unreachable through
      the component after FR-008 correction but still unit-tested per plan.md's Test Plan area 8,
      `value === null` ⇒ `null`), `getRingGeometry` (`radius = max(0, (size - thickness) / 2)`, `center =
      size / 2`, `circumference = 2 * Math.PI * radius`, including `thickness >= size` ⇒ `radius === 0`),
      `getProgressState` (`indeterminate`/`complete`/`loading` per data-model.md §1) and
      `getDefaultValueText` (rounds `((value - min) / (max - min)) * 100` to `"{n}%"`, and the `max === min`
      ⇒ `100` branch). No DOM, no rune warnings expected.
- [X] T005 [US1] Write the roles-and-ARIA test group (determinate) in
      `src/lib/components/ui/circular-progress/circular-progress.test.ts`: `role="progressbar"` is always
      present; a determinate `value` renders `aria-valuenow` equal to the clamped value, `aria-valuemin`
      equal to `min`, `aria-valuemax` equal to `max`, and `aria-valuetext` equal to the computed value text
      (default formatter and a caller-supplied `getValueText`); `aria-describedby` points at the
      `ValueText` part's `id`; `label="Upload"` renders a `<div id>` whose `id` is referenced by
      `aria-labelledby` on the root; the `Indicator` part carries `aria-hidden="true"` and
      `focusable="false"`. Covers spec.md US1 acceptance scenarios 1–4 and FR-002, FR-003, FR-009, FR-011,
      FR-017. Depends on T004 (same file).
- [X] T006 [US2] Write the indeterminate-and-reduced-motion test group in
      `src/lib/components/ui/circular-progress/circular-progress.test.ts`: omitting `value` (and passing
      `value={null}` explicitly) renders `data-state="indeterminate"`, omits `aria-valuenow`,
      `aria-valuetext`, `aria-describedby`, `data-value` and `data-percentage` entirely (`toBeNull()`, never
      the string `"undefined"`), and the `Range` part's `stroke-dashoffset` equals
      `circumference * 0.75`; `ValueText` renders no default text content while an explicit `children`
      snippet on `ValueText` still renders (FR-010); `value={100}` with default `max` renders
      `data-state="complete"`. Also assert FR-014 two ways, both of which are real assertions: (a) the
      observable DOM contract per research.md R-07 — the `Range` part carries `data-state="indeterminate"`
      and `stroke-dashoffset === circumference * 0.75`, which is the styling hook the scoped rule targets;
      and (b) the source contract — `import rangeSource from './circular-progress-range.svelte?raw'` and
      `expect(rangeSource).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation:\s*none/)`.
      Do NOT use `document.styleSheets`: `vite.config.ts` runs Vitest with the default `css: false`, so
      component `<style>` blocks are never injected in jsdom. There is no "documented source review"
      option — `expect.requireAssertions` is on. Covers spec.md US2 acceptance scenarios 1–3
      and FR-004, FR-013, FR-014. Depends on T005 (same file).
- [X] T007 [US3] Write the size/thickness/theming test group in
      `src/lib/components/ui/circular-progress/circular-progress.test.ts`: rendered with no `size`/
      `thickness`/`min`/`max` supplied, the `Indicator` `svg` has `width="48" height="48"
      viewBox="0 0 48 48"`, both `circle` elements have `r="22" cx="24" cy="24" stroke-width="4"`, and the
      root has `aria-valuemin="0" aria-valuemax="100"` (the default-props reference composition in
      contracts/public-api.md §3); `size={80}` and `thickness={6}` on the root produce
      `width="80" height="80" viewBox="0 0 80 80"` on the `Indicator` `svg` and `stroke-width="6"`/`r="37"`
      on both `circle` elements (per contracts/public-api.md §3 geometry contract); both `circle` elements
      also carry `fill="none" stroke="currentColor" stroke-linecap="round"
      vector-effect="non-scaling-stroke"` verbatim, in both the default and custom-size renders; a caller
      `class` on `Root`, `Indicator`, `Track`, `Range` and `ValueText` is present **alongside** (not instead
      of) each part's own default classes (FR-018); default classes
      `relative inline-flex w-fit items-center justify-center` (Root), `-rotate-90 transform` (Indicator),
      `text-muted-foreground/20` (Track), `origin-center text-primary transition-all duration-300
      ease-in-out` (Range) and `absolute inset-0 flex items-center justify-center text-sm font-medium`
      (ValueText) are asserted verbatim so the upstream chrome cannot silently drift. Covers spec.md US3
      acceptance scenarios 1–2 and FR-006, FR-011, FR-012, FR-018. Depends on T006 (same file).
- [X] T007a Write the per-part data-attribute test group in
      `src/lib/components/ui/circular-progress/circular-progress.test.ts`, asserting every cell of
      contracts/public-api.md §3's data-attribute matrix. Determinate render (`value={50}`): `data-slot`
      and `data-state="loading"` on all five parts (`circular-progress`, `-indicator`, `-track`, `-range`,
      `-value-text`); `data-value="50"`, `data-min="0"`, `data-max="100"` on root, indicator and range;
      `data-percentage="0.5"` on root and indicator; and `data-value`/`data-min`/`data-max`/
      `data-percentage` absent on track and value-text. Indeterminate render: `data-state="indeterminate"`
      on all five parts, `data-value` and `data-percentage` absent everywhere (`toBeNull()`, never the
      string `"undefined"`), `data-min`/`data-max` still present on root, indicator and range. Complete
      render (`value={100}`): `data-state="complete"` on all five parts. Covers FR-005, FR-005a and SC-002.
      Depends on T007 (same file).
- [X] T008 Write the keyboard/non-focusable test group in
      `src/lib/components/ui/circular-progress/circular-progress.test.ts`: the root carries no `tabindex`
      and `userEvent.tab()` from a preceding sibling button moves focus past the progressbar to a following
      sibling button, never landing on it; dispatching `Enter`/`Space`/`ArrowLeft`/`ArrowRight` on the root
      (or a focused ancestor) changes no attribute — this documents the complete (empty) upstream key set
      per plan.md's Test Plan area 2. Depends on T007a (same file).
- [X] T009 [US1] Write the controlled-vs-uncontrolled test group in
      `src/lib/components/ui/circular-progress/circular-progress.test.ts` using the T003 harness's
      rerender-driven variant: an uncontrolled render with no `value` stays `indeterminate` across
      re-renders that do not change `value`; `rerender({ value: n })` moves `aria-valuenow`, `data-value`,
      `data-percentage` and the `Range` part's `stroke-dashoffset` to match the new `n`, proving the parent
      is authoritative and the component never mutates `value` on its own (there is no `onValueChange` to
      spy on — absence of self-mutation is the assertion, per research.md decision R-04). Covers spec.md
      US1 acceptance scenario 1 (value=0/100 boundary re-renders) and FR-020. Depends on T008 (same file).
- [X] T010 Write the RTL test group in
      `src/lib/components/ui/circular-progress/circular-progress.test.ts` using the T003 harness's
      `dir="rtl"` variant: the rendered `class`, `viewBox`, `stroke-dasharray` and `stroke-dashoffset` on
      the RTL render are byte-identical to the LTR render of the same props (FR-021, SC-005). Depends on
      T009 (same file).
- [X] T011 Write the guard-rails/edge-case test group in
      `src/lib/components/ui/circular-progress/circular-progress.test.ts`: using the T003 harness's
      standalone render helpers, `Indicator`, `Track`, `Range` and `ValueText` each throw
      `/must be used within `<CircularProgress>`/` (`expect(() => render(...)).toThrow(/within/)`) when
      rendered outside `Root` (FR-016); every row of contracts/public-api.md §3's clamping/validation table
      is asserted end to end through the component (`value=150,max=100` → `100`/`complete`;
      `value=-20,min=0` → `0`/`loading`; `value=NaN`/`Infinity` → indeterminate; `max=0`/`-5`/`NaN` → `100`;
      `max=50,min=80` → `81`; `min=NaN` → `0`; `thickness=12,size=8` → `r="0"` with no throw). Dev-console
      output from these cases is silenced with `vi.spyOn(console, 'error').mockImplementation(() => {})`
      and restored per test, per spec.md's Assumptions ("Dev-only console warnings"). Depends on T010 (same
      file).
- [X] T012 [US3] Write the Svelte-specific and Combined test group in
      `src/lib/components/ui/circular-progress/circular-progress.test.ts` using the T003 harness: `bind:ref`
      populates the `div`/`svg`/both `circle`s/`span` for `Root`/`Indicator`/`Track`/`Range`/`ValueText`
      respectively; the `child` snippet on `Root` receives and applies the full attribute payload onto the
      caller's element, with `children`/`label` not rendered and `ref` staying `null`; the `child` snippet
      on `ValueText` behaves the same way; explicit `children` on `ValueText` takes precedence over the
      computed value text (FR-010); `CircularProgress.Combined` rendered with `value={60}` emits the same
      five `data-slot`s (`circular-progress`, `-indicator`, `-track`, `-range`, `-value-text`) as the manual
      composition; arbitrary attributes passed through `restProps` are forwarded to the rendered element of
      **every** part — `id` plus a custom `data-testid` on `Root`, `Indicator`, `Track`, `Range` and
      `ValueText`, and an `onclick` handler on `Root` that fires under `userEvent.click` — and a
      caller-supplied `role` or `data-state` in `restProps` **overrides** the component's own value, because
      `{...restProps}` is spread after the component's own attributes (research.md R-10, upstream JSX
      order). Covers spec.md US3 acceptance scenario 3 and FR-015, FR-019. Depends on T011 (same
      file).

**Checkpoint**: `pnpm run test:unit -- --run
src/lib/components/ui/circular-progress/circular-progress.test.ts` fails (module not found / assertions
unmet) — expected, since Phase 3–5 have not run yet.

---

## Phase 3: Core component files

**Purpose**: The dependency-free state module, then the six rendered parts, one task per exported
subcomponent from plan.md's Public API section.

- [X] T013 Implement `src/lib/components/ui/circular-progress/circular-progress.svelte.ts` per
      plan.md's Public API "Module exports" table and data-model.md: `PROGRESS_STATES`, `ProgressState`;
      `DEFAULT_MIN`/`DEFAULT_MAX`/`DEFAULT_SIZE`/`DEFAULT_THICKNESS` (`0`/`100`/`48`/`4`);
      `isValidNumber`/`isValidMaxNumber`/`isValidValueNumber` predicates; `getProgressState(value, max)`;
      `getDefaultValueText(value, min, max)`; `resolveProgressBounds(minProp, maxProp): { min, max }`
      (FR-008); `clampProgressValue(value, min, max): number | null` (FR-007);
      `getProgressPercentage(value, min, max): number | null`; `getRingGeometry(size, thickness):
      RingGeometry` (`{ radius, center, circumference }`); the `CircularProgressState` runes class
      constructed from getter-function props (`getValue`, `getGetValueText`, `getMin`, `getMax`, `getSize`,
      `getThickness`, `getValueTextId`) exposing every `$derived` member from data-model.md §5 including
      `strokeDasharray`/`strokeDashoffset`; and the typed `Symbol`-keyed `setCircularProgressContext` /
      `hasCircularProgressContext` / `getCircularProgressContext(consumerName?)` trio, the getter throwing
      `` `<${consumerName}>` must be used within `<CircularProgress>`. `` per data-model.md §"Context". No
      DOM access, no `$effect`. Depends on T004 (test exists first).
- [X] T014 [P] Implement `src/lib/components/ui/circular-progress/circular-progress.svelte` (Root) per
      plan.md's Public API and contracts/public-api.md §2–§3: module script exports
      `CircularProgressRootProps` (`WithElementRef<HTMLAttributes<HTMLDivElement>>` plus `value`,
      `getValueText`, `min`, `max`, `size`, `thickness`, `label`, `child`, upstream JSDoc copied verbatim
      including `@default`) and `CircularProgressChildProps`; instance script destructures `$props()` once
      (`ref = $bindable(null)`, `value = null`, `getValueText = getDefaultValueText`, `min = DEFAULT_MIN`,
      `max = DEFAULT_MAX`, `size = DEFAULT_SIZE`, `thickness = DEFAULT_THICKNESS`, `label`,
      `class: className`, `children`, `child`, `...restProps`), generates `labelId`/`valueTextId` via
      `$props.id()`, constructs one `CircularProgressState` with getter functions and calls
      `setCircularProgressContext`, computes the merged attribute payload (`role="progressbar"`,
      `aria-valuemin`, `aria-valuemax`, `aria-valuenow`/`aria-valuetext`/`aria-describedby` only when
      determinate, `aria-labelledby` only when `label` set, `data-slot="circular-progress"`, `data-state`,
      `data-value`/`data-percentage` only when determinate, `data-min`, `data-max`, `class` via `cn(...)`),
      renders the `child` snippet branch (spreading the payload, no default `<div>`, `label`/`children` not
      rendered) vs. the default `<div bind:this={ref}>` branch with `...restProps` spread before
      `class`, `{@render children?.()}`, and — when `label` is set — a trailing `<div id={labelId}>{label}</div>`
      as the **last** child (contracts/public-api.md §3). Emits a dev-only `console.error`/`console.warn`
      behind `import.meta.env.DEV` for invalid `max`/`value` inputs (spec.md Assumptions), never thrown, not
      part of the test surface. Depends on T013.
- [X] T015 [P] Implement `src/lib/components/ui/circular-progress/circular-progress-indicator.svelte` per
      plan.md's Public API: reads `getCircularProgressContext('CircularProgressIndicator')`; renders
      `<svg bind:this={ref} aria-hidden="true" focusable="false" width={size} height={size}
      viewBox="0 0 {size} {size}" data-slot="circular-progress-indicator" data-state data-value?
      data-min data-max data-percentage? class="-rotate-90 transform" ...restProps>{@render
      children?.()}</svg>`; `ref = $bindable<SVGSVGElement | null>(null)` declared locally (SVG parts are
      not `WithElementRef`-constrained, per research.md R-03); `class` merged last via `cn()`. Depends on
      T013.
- [X] T016 [P] Implement `src/lib/components/ui/circular-progress/circular-progress-track.svelte` per
      plan.md's Public API and contracts/public-api.md §3 geometry contract: reads
      `getCircularProgressContext('CircularProgressTrack')`; renders `<circle bind:this={ref} cx={center}
      cy={center} r={radius} fill="none" stroke="currentColor" stroke-width={thickness}
      stroke-linecap="round" vector-effect="non-scaling-stroke" data-slot="circular-progress-track"
      data-state class="text-muted-foreground/20" ...restProps>` with no children (upstream renders none).
      Depends on T013.
- [X] T017 [P] Implement `src/lib/components/ui/circular-progress/circular-progress-range.svelte` per
      plan.md's Public API, contracts/public-api.md §3, and data-model.md §5's `strokeDasharray`/
      `strokeDashoffset`: reads `getCircularProgressContext('CircularProgressRange')`; renders the same
      circle geometry as Track plus `stroke-dasharray={circumference}` and the derived
      `stroke-dashoffset`, `data-slot="circular-progress-range"`, `data-state`, `data-value?`, `data-min`,
      `data-max`, `class="origin-center text-primary transition-all duration-300 ease-in-out"`; a
      component-scoped `<style>` block defines `@keyframes spin-around` and an `animation` rule scoped to
      `[data-state='indeterminate']`, wrapped so `@media (prefers-reduced-motion: reduce)` disables it
      (`animation: none`), per plan.md's "Indeterminate spin animation" bespoke-behaviour note. Depends on
      T013.
- [X] T018 [P] Implement `src/lib/components/ui/circular-progress/circular-progress-value-text.svelte` per
      plan.md's Public API: module script exports `CircularProgressValueTextProps`
      (`WithElementRef<HTMLAttributes<HTMLSpanElement>>` plus `child`) and
      `CircularProgressValueTextChildProps`; reads `getCircularProgressContext('CircularProgressValueText')`;
      renders `children ?? valueText` inside `<span bind:this={ref} id={valueTextId}
      data-slot="circular-progress-value-text" data-state class="absolute inset-0 flex items-center
      justify-center text-sm font-medium" ...restProps>` or, in `child` mode, spreads the merged payload
      onto the caller's element with `ref` staying `null`. Depends on T013.
- [X] T019 Implement `src/lib/components/ui/circular-progress/circular-progress-combined.svelte` per
      plan.md's Public API: `CircularProgressCombinedProps` = `CircularProgressRootProps` minus
      `children`/`child`; forwards every root prop verbatim into `<CircularProgress.Root {...rootProps}
      bind:ref><CircularProgress.Indicator><CircularProgress.Track /><CircularProgress.Range
      /></CircularProgress.Indicator><CircularProgress.ValueText /></CircularProgress.Root>`, importing the
      other five parts directly (not through the barrel, to avoid a circular import once `index.ts` exists).
      Depends on T014, T015, T016, T017, T018 (composes all five).

**Checkpoint**: All six part files and the state module exist; Phase 2's helper tests (T004) should now
pass, and the component-level tests progress further but the barrel is still missing.

---

## Phase 4: Barrel and types

- [X] T020 Implement `src/lib/components/ui/circular-progress/index.ts` per plan.md's Public API and
      contracts/public-api.md §1: import `Root` from `./circular-progress.svelte`, `Indicator` from
      `./circular-progress-indicator.svelte`, `Track` from `./circular-progress-track.svelte`, `Range` from
      `./circular-progress-range.svelte`, `ValueText` from `./circular-progress-value-text.svelte`,
      `Combined` from `./circular-progress-combined.svelte`; re-export every type
      (`CircularProgressRootProps`, `CircularProgressChildProps`, `CircularProgressIndicatorProps`,
      `CircularProgressTrackProps`, `CircularProgressRangeProps`, `CircularProgressValueTextProps`,
      `CircularProgressValueTextChildProps`, `CircularProgressCombinedProps`, `ProgressState`,
      `RingGeometry`) and every runtime helper (`PROGRESS_STATES`, `DEFAULT_MIN`, `DEFAULT_MAX`,
      `DEFAULT_SIZE`, `DEFAULT_THICKNESS`, `isValidNumber`, `isValidMaxNumber`, `isValidValueNumber`,
      `getProgressState`, `getDefaultValueText`, `resolveProgressBounds`, `clampProgressValue`,
      `getProgressPercentage`, `getRingGeometry`, `CircularProgressState`, `setCircularProgressContext`,
      `hasCircularProgressContext`, `getCircularProgressContext`) from `./circular-progress.svelte.ts`;
      export the short names (`Root`, `Indicator`, `Track`, `Range`, `ValueText`, `Combined`) alongside the
      prefixed aliases (`CircularProgress`, `CircularProgressIndicator`, `CircularProgressTrack`,
      `CircularProgressRange`, `CircularProgressValueText`, `CircularProgressCombined`). Depends on T019
      (all part files must exist).

**Checkpoint**: `import * as CircularProgress from '$lib/components/ui/circular-progress/index.js'`
resolves; run `pnpm run test:unit -- --run
src/lib/components/ui/circular-progress/circular-progress.test.ts` — all Phase 2 tests should now pass.

---

## Phase 5: Demo route

- [X] T021 [US1] Implement `src/routes/docs/components/circular-progress/+page.svelte` with the page
      heading/intro and the "Default" `<ComponentPreview>` section, mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/circular-progress-demo.tsx`: a `setInterval`
      that advances `value` by `2` every `150`ms up to `100` (cleaned up in an `$effect` teardown,
      `clearInterval` on unmount), `size={60}`, composed via `CircularProgress.Root` >
      `CircularProgress.Indicator` > (`Track`, `Range`) + `ValueText`, using `ComponentPreview` from
      `$lib/components/docs/index.js` and `* as CircularProgress` from
      `$lib/components/ui/circular-progress/index.js`, following the structure of
      `src/routes/docs/components/stat/+page.svelte`.
- [X] T022 [US1] [US2] Add the "Interactive" `<ComponentPreview>` section (mirroring
      `circular-progress-interactive-demo.tsx`'s Start/Reset/Force-indeterminate buttons, `size={80}
      thickness={6}`, and a status text readout reflecting `data-state`) to
      `src/routes/docs/components/circular-progress/+page.svelte`. Depends on T021 (same file).
- [X] T023 [US3] Add the "Colors" `<ComponentPreview>` section (mirroring
      `circular-progress-colors-demo.tsx`'s multi-theme grid, fixed at `value={75}`, `size={80}
      thickness={6}`, using this project's semantic status tokens — `text-primary`, `text-success`,
      `text-warning`, `text-destructive`, `text-info`, `text-muted-foreground` — passed as `class` overrides
      to `Range`/`Track` instead of upstream's raw palette classes, per plan.md's documented divergence and
      Constitution VIII; the `motion/react` spring animation is dropped since `motion` is not a project
      dependency) to `src/routes/docs/components/circular-progress/+page.svelte`. Depends on T021 (same
      file).
- [X] T024 [US3] Add the "Combined" `<ComponentPreview>` section (the MDX "Layout" snippet's one-line
      `CircularProgress.Combined` form rendered next to the equivalent manual composition of all five parts
      at the same `value`, proving DOM equivalence visually) and a props table
      (`$lib/components/ui/table`, listing every row of plan.md's Public API tables for the root and each
      part with type, default and description) to
      `src/routes/docs/components/circular-progress/+page.svelte`. Depends on T021 (same file).

**Checkpoint**: `/docs/components/circular-progress` renders all four previews plus the props tables with
no console errors.

---

## Phase 6: Registry entry and docs polish

- [X] T025 Append the complete `circular-progress` entry to `registry.json` at the repository root per
      contracts/public-api.md §4 in one step (no stub, no later replace — see T002): `name:
      "circular-progress"`, `type: "registry:ui"`, `title: "Circular Progress"`, `description: "A circular
      progress indicator that displays completion progress in a ring format with support for indeterminate
      states."`, `registryDependencies: []`, `dependencies: []`, and `files` listing all eight source files
      (`index.ts`, `circular-progress.svelte`, `circular-progress-indicator.svelte`,
      `circular-progress-track.svelte`, `circular-progress-range.svelte`,
      `circular-progress-value-text.svelte`, `circular-progress-combined.svelte`,
      `circular-progress.svelte.ts`, each `type: "registry:ui"`); `circular-progress.test.ts` and
      `circular-progress.test.svelte` stay excluded. Depends on T020.
- [X] T026 Run `pnpm run registry:build` to regenerate `static/r/circular-progress.json` from the completed
      `registry.json` entry, and verify (per quickstart.md §2 and §5) that it inlines all eight files with
      `$lib/...` imports rewritten and contains no reference to `src/routes/**` or
      `src/lib/components/docs/**`. Depends on T025.

**Checkpoint**: `static/r/circular-progress.json` exists and matches the eight source files.

---

## Phase 7: Verification (MANDATORY — Principle VII)

**Purpose**: The feature is not complete until all gates are green. No suppressions
(`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, deleted
assertions, loosened configs) may be used to reach green — fix the root cause.

- [X] T027 Run `pnpm run format` across every file this port touched (shadcn/generator-style output is not
      Prettier-formatted, and this repo's Tailwind class order depends on it).
- [X] T028 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, and
      fix everything that fails.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001/T002 run in parallel.
- **Tests (Phase 2)**: Depends on Setup (directories must exist). T003 (harness `.test.svelte`) and T004
  (pure-helper tests) are parallel to each other (different files); T005–T007a and T008–T012 all write
  `circular-progress.test.ts` and run strictly in sequence after T004.
- **Core (Phase 3)**: Depends on Tests existing (TDD — they must fail first). T013 (`circular-progress.svelte.ts`)
  blocks T014–T018, all five of which only import the state module and are otherwise independent of each
  other; T019 (`Combined`) depends on all five parts (T014–T018).
- **Barrel (Phase 4)**: Depends on Phase 3 (T019).
- **Demo (Phase 5)**: Depends on Barrel (T020). T022, T023 and T024 all depend on T021 (same file) and are
  otherwise independent edits to different sections of it — apply sequentially to avoid clobbering each
  other's diff.
- **Registry (Phase 6)**: T025 depends on the finished file set (T020) and writes the complete
  `registry.json` entry in one step (T002 is a no-op placeholder); T026 depends on T025.
- **Verification (Phase 7)**: Depends on everything above — always the last phase.

### Parallel Opportunities

- Phase 1: T001, T002.
- Phase 2: T003 alongside T004 (different files); T005–T007a and T008–T012 are sequential (same file,
  `circular-progress.test.ts`).
- Phase 3: T014, T015, T016, T017, T018 can all run in parallel once T013 lands (five independent files,
  each depending only on the state module); T019 must wait for all five.
- No other cross-task parallelism — Phase 4 through Phase 7 each depend on the immediately preceding
  phase, and Phase 5's three section tasks touch one shared file.

---

## Parallel Example: Phase 3

```bash
# T014-T018 each depend only on T013 (circular-progress.svelte.ts) and touch different files:
Task: "Implement src/lib/components/ui/circular-progress/circular-progress.svelte"
Task: "Implement src/lib/components/ui/circular-progress/circular-progress-indicator.svelte"
Task: "Implement src/lib/components/ui/circular-progress/circular-progress-track.svelte"
Task: "Implement src/lib/components/ui/circular-progress/circular-progress-range.svelte"
Task: "Implement src/lib/components/ui/circular-progress/circular-progress-value-text.svelte"
```

---

## Implementation Strategy

1. Phase 1 (Setup) → Phase 2 (Tests, written to fail) → Phase 3 (Core: state module, then the five
   independent parts in parallel, then Combined) → Phase 4 (Barrel) — at this checkpoint every Phase 2
   test should pass and User Stories 1–3 are all exercised by `circular-progress.test.ts`.
2. Phase 5 (Demo) makes the port visible on `/docs/components/circular-progress`; Phase 6 makes it
   installable via the registry.
3. Phase 7 is the non-negotiable gate: `format` → `check` → `lint` → `test:unit -- --run` → `build`, all
   green, nothing skipped or suppressed.

Do NOT run git write commands — the orchestrator owns the working tree (Constitution Principle X).

---

## Phase 8: Convergence

- [X] T029 Expand the `themes` array in `src/routes/docs/components/circular-progress/+page.svelte`'s
      "Colors" `<ComponentPreview>` section from 6 to 8 entries by adding two more semantic-token themes
      (e.g. `secondary` and `accent-foreground`, both already declared in `src/app.css`), so the demo
      reaches the "8-theme grid" / "eight distinct swatches" documented in plan.md's Structure Decision
      "Demo sections on the docs page" table and research.md decision R-11 (partial)
