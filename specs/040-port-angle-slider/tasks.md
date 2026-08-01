---
description: 'Task list for the Angle Slider port'
---

# Tasks: Angle Slider

**Input**: Design documents from `/specs/040-port-angle-slider/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/angle-slider.api.md,
quickstart.md (all present)

**Tests**: MANDATORY (constitution Principle III / VII). Colocated at
`src/lib/components/ui/angle-slider/angle-slider.test.ts`, with an `angle-slider.test.svelte`
harness for `bind:value`, `child` snippets, `dir="rtl"` wrappers and `<form>` ancestors
(plan.md "Testing"). jsdom returns a zero-size `getBoundingClientRect()`, so every pointer test
must stub the root's rect first (quickstart.md §2) or it silently asserts nothing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps a test task to the spec.md user story it verifies (US1/US2/US3)

## Path Conventions

- Component source: `src/lib/components/ui/angle-slider/`
- Demo route: `src/routes/docs/components/angle-slider/+page.svelte`
- Registry: `registry.json` (repository root)

---

## Phase 1: Setup

**Purpose**: Confirm no new dependency is needed and stub the registry entry.

- [X] T001 [P] Verify no new npm dependency is required for Angle Slider: confirm
      `src/lib/components/ui/direction-provider/index.ts` exports `useDirection` (or the
      equivalent direction-resolution helper) for reuse, and that no `@diceui/shared` behaviour
      needs porting beyond `components/visually-hidden-input.tsx` (plan.md "Primary
      Dependencies", research.md). No source change expected; this task only records the
      confirmation so later tasks do not re-derive it.
- [X] T002 [P] Add a placeholder `angle-slider` entry to `registry.json` (repository root):
      `"name": "angle-slider"`, `"type": "registry:ui"`, `"title": "Angle Slider"`,
      `"description": "An interactive circular slider for selecting angles with support for
      single values and ranges."` (verbatim from plan.md Phase F), `"registryDependencies":
      ["direction-provider"]`, `"dependencies": []`, `"files": []` — to be completed with the
      real file list in Phase 6 (T021).

**Checkpoint**: Dependency confirmed, registry stub present.

---

## Phase 2: Tests (write first — MUST fail before Phase 3 implementation)

**Purpose**: Encode every quickstart.md scenario (S1–S7) as an assertion before any component
file exists, per constitution Principle VII / CLAUDE.md §7.

- [X] T003 [P] Create the test harness component
      `src/lib/components/ui/angle-slider/angle-slider.test.svelte`: an `AngleSlider.Root` with
      `Track`/`Range`/`Thumb`(s)/`Value` children, props forwarded for `value`/`defaultValue`/
      `onValueChange`/`onValueCommit`/`min`/`max`/`step`/`minStepsBetweenThumbs`/`size`/
      `thickness`/`startAngle`/`endAngle`/`dir`/`form`/`name`/`disabled`/`readOnly`/`inverted`,
      a `data-testid="root"` on the root element so tests can stub
      `getBoundingClientRect()`, a `<form>`-wrapping variant, and a bare `Thumb`/`Track`/`Range`/
      `Value` rendered with no `AngleSlider.Root` ancestor for the provider-throw assertions
      (quickstart.md §3 S7, data-model.md "Reactivity map").
- [X] T004 [US1] Write pointer-interaction and arithmetic tests in
      `src/lib/components/ui/angle-slider/angle-slider.test.ts` per quickstart.md §3 S1: stub the
      T003 harness root's `getBoundingClientRect()` to `{ left: 0, top: 0, width: 200, height:
      200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) }`, then dispatch
      `pointerdown`/`pointermove`/`pointerup` at `(100, 0)` → `0°`, `(200, 100)` → `90°`,
      `(100, 200)` → `180°`, `(0, 100)` → `270°`, and `(170.7, 29.3)` → `45°` with
      `defaultValue={[0]} min={0} max={360} step={1}`; assert dragging from `(93, 0)` (≈356°) to
      `(107, 0)` (≈4°) crosses `0` without visiting any mid-range value (the 0/360 seam); assert
      `onValueChange` fires on every accepted `pointermove` and `onValueCommit` fires once on
      `pointerup` only when the value differs from the pre-drag snapshot (FR-014); assert a
      `pointerdown` whose target is a rendered thumb focuses that thumb (`document.activeElement`),
      makes it the active index, and leaves every value unchanged (no `onValueChange`, no
      `onValueCommit`); assert a `pointerdown` elsewhere on the dial with `defaultValue={[90, 270]}`
      moves the thumb closest to the pointer value and leaves the other thumb untouched
      (`getClosestValueIndex`). Depends on: T003.
- [X] T005 [US1] Write keyboard-interaction tests in
      `src/lib/components/ui/angle-slider/angle-slider.test.ts` per contracts §8 / quickstart.md
      §3 S2: focus the thumb with `userEvent.tab()`, then assert `ArrowRight`/`ArrowUp` `+step`,
      `ArrowLeft`/`ArrowDown` `-step`, `PageUp` `+10·step`, `PageDown` `-10·step`, `Shift`+any
      arrow `×10` in that arrow's direction, `Home` → `min` on the active thumb, `End` → `max` on
      the active thumb; assert every handled key calls `preventDefault()` and fires
      `onValueCommit`; repeat the arrow-key subset with `inverted` (every sign flips). Depends
      on: T003.
- [X] T006 [US1] Write accessibility roles-and-names tests in
      `src/lib/components/ui/angle-slider/angle-slider.test.ts`: assert each thumb exposes
      `role="slider"` with `aria-valuemin`/`aria-valuenow`/`aria-valuemax` matching `min`/current
      value/`max` and `aria-orientation="vertical"`; assert `tabindex={0}` when enabled and no
      `tabindex` when `disabled`; assert `AngleSlider.Value` renders `` `${value}°` `` for one
      thumb, and with `defaultValue={[270, 90]} min={0} max={360}` renders exactly `90° - 270°`
      (the sorted current values, proving it is not `0° - 360°` from the props) for two or more,
      and that a custom
      `formatValue` overrides it; using the T003 harness, assert rendering `Thumb`, `Track`,
      `Range`, or `Value` without an `AngleSlider.Root` ancestor throws an error matching
      `/within/` (contracts §7, `getAngleSliderContext`). Depends on: T003.
- [X] T007 [US1][US2] Write controlled-vs-uncontrolled tests in
      `src/lib/components/ui/angle-slider/angle-slider.test.ts` per quickstart.md §3 S3 (R-11):
      assert `defaultValue={[45]}` seeds the thumb and pointer/keyboard interaction moves it on
      its own while calling `onValueChange`; assert `bind:value={angle}` makes the parent's
      variable follow the dial on every accepted interaction; assert
      `` bind:value={() => angle, () => {}} `` (a setter that declines) still calls
      `onValueChange` but leaves `aria-valuenow` unchanged — the "must not move on its own" case.
      Depends on: T003.
- [X] T008 [US2] Write two-thumb range tests in
      `src/lib/components/ui/angle-slider/angle-slider.test.ts` per quickstart.md §3 S4:
      `defaultValue={[90, 270]} step={5} minStepsBetweenThumbs={2}` renders two independently
      focusable thumbs and `AngleSlider.Range` spans exactly between the sorted values; dragging
      one thumb toward the other stops once the two values are exactly `10°` apart and never lets
      them cross (the write is discarded whole — no `onValueChange`, no `onValueCommit`); tabbing
      to the second thumb and pressing `ArrowRight` changes only that thumb's value; assert
      `AngleSlider.Range` renders nothing when both ends are equal (a single thumb at `min`).
      Depends on: T003.
- [X] T009 [US3] Write RTL and geometry tests in
      `src/lib/components/ui/angle-slider/angle-slider.test.ts` per quickstart.md §3 S7 and
      contracts §8: render inside `dir="rtl"` and assert `ArrowRight` decreases /
      `ArrowLeft` increases (swapped from LTR) while `ArrowUp`/`ArrowDown` keep their meaning;
      assert an explicit `dir` prop overrides the inherited `direction-provider` context; assert
      `startAngle={-90} endAngle={90}` renders the track rail as an arc `<path>`, not a
      `<circle>`, while the default full sweep (`endAngle - startAngle >= 359`) renders a
      `<circle>`; assert `size`/`thickness` change the rendered `width`/`height`
      (`(size + 20) * 2`) and `stroke-width`; with `inverted` and `defaultValue={[90]}`, assert the
      `[data-slot='angle-slider-range']` path's terminal endpoint coincides with the thumb's
      computed position (both on the same side of the dial). Depends on: T003.
- [X] T010 [US1][US2] Write guard-rail and form-participation tests in
      `src/lib/components/ui/angle-slider/angle-slider.test.ts` per quickstart.md §3 S5/S6
      (SC-004, SC-007): assert `disabled` suppresses both pointer drag and keyboard changes,
      removes the thumb from the tab order, sets `aria-disabled="true"` and `[data-disabled]` on
      the root, and disables the hidden input (excluded from `FormData`); assert `readOnly`
      suppresses drag and keyboard changes but the thumb stays focusable, carries
      `aria-readonly="true"` and `[data-readonly]`, and its hidden input still participates in
      `FormData` with the current value; render one thumb inside `<form name="f">` with
      `name="rotation"` and assert `new FormData(form).get('rotation')` equals `aria-valuenow`;
      render two thumbs with `name="range"` and assert two `range[]` entries in sorted order;
      assert a dial rendered outside any `<form>` and without a `form` prop renders no hidden
      input at all (`isFormControl` false, data-model.md Entity 4). Depends on: T003.
- [X] T011 Write edge-case tests in
      `src/lib/components/ui/angle-slider/angle-slider.test.ts` per the spec's Edge Cases and
      FR-020: assert dragging to the exact centre of the stubbed rect (`(100, 100)`) retains the
      last valid value and never produces `NaN`/`Infinity`; assert a zero-size bounding box makes
      every pointer event a no-op; assert `min`/`max`/`step` combinations where `max` is not an
      exact multiple of `step` from `min` still snap and clamp correctly; assert `step={0.5}`
      rounds displayed and emitted values to one decimal place with no floating-point artifacts
      (e.g. never `44.999999999999993`); assert two thumbs given identical initial values with
      `minStepsBetweenThumbs > 0` still render both thumbs and reject the first violating drag
      without crashing; assert a two-value array with only one `Thumb` rendered shows just that
      thumb, and a `Thumb index={5}` with no value at that index renders nothing; assert
      resizing/re-stubbing the root's rect between interactions re-derives the pointer→angle math
      from the new rect rather than a cached one (data-model.md "Pointer geometry"). Depends on:
      T003.
- [X] T025 Write pure-arithmetic unit tests in
      `src/lib/components/ui/angle-slider/angle-slider.test.ts` per plan.md Phase A: import
      `clamp`, `getDecimalCount`, `roundValue`, `snapToStep`, `getNextSortedValues`,
      `getStepsBetweenValues`, `hasMinStepsBetweenValues`, `getClosestValueIndex`, `getTotalAngle`,
      `getValueFromPointer`, `getAngleFromValue`, `getPositionFromAngle`, and `describeAngleArc`
      directly from `angle-slider.svelte.ts` (no rendering); assert research R-01's quadrant table
      (0°/90°/180°/270° and the 0/360 seam) and R-02's snap/clamp/sort/minimum-separation cases
      against these functions in isolation, so an arithmetic regression is localised here rather
      than only surfacing as a failed pointer test in T004/T011. Depends on: T003.

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/angle-slider/angle-slider.test.ts`
fails (module not found) — expected, since Phase 3 has not run yet.

---

## Phase 3: Core component files

**Purpose**: Implement the pure arithmetic, the shared state class, and the six public parts, in
upstream's own dependency order (plan.md Phases A–C).

- [X] T012 Implement `src/lib/components/ui/angle-slider/angle-slider.svelte.ts` per data-model.md
      and contracts §7: the pure, unit-testable functions `clamp`, `getDecimalCount`,
      `roundValue`, `snapToStep`, `getNextSortedValues`, `getStepsBetweenValues`,
      `hasMinStepsBetweenValues`, `getClosestValueIndex`, `getTotalAngle`, `getValueFromPointer`,
      `getAngleFromValue`, `getPositionFromAngle`, `describeAngleArc`, each carrying a JSDoc
      naming its upstream `angle-slider.tsx` line range; the `DEFAULT_MIN`/`DEFAULT_MAX`/
      `DEFAULT_STEP`/`DEFAULT_SIZE`/`DEFAULT_THICKNESS`/`DEFAULT_START_ANGLE`/`DEFAULT_END_ANGLE`/
      `THUMB_HALO`/`PAGE_KEYS`/`ARROW_KEYS` constants; the `AngleSliderGeometry` type; the
      `AngleSliderRootState` class (data-model.md Entities 1–3) taking getter-function inputs for
      every prop, `valueIndexToChange` and `thumbs: SvelteMap<number, ThumbData>` as `$state`,
      `valuesBeforeSlideStart` as a plain (non-reactive) field, derived `sorted`/`totalAngle`/
      `isFullCircle`/`centre`/`trackRadius`/`boxSize`, an `updateValue` method enforcing
      invariants 1–5 (snap, round, clamp, sort, minimum-separation guard that discards the write
      whole), `register(index, element)`/`unregister(index)` for the thumb registry (the register
      call wrapped in `untrack`, per data-model.md's `SvelteMap`-in-`$effect` warning), and
      pointer/keyboard command methods that never read `getBoundingClientRect()` themselves
      (callers pass the already-measured rect, per FR-020); a `Symbol('angle-slider')` context
      key with `setAngleSliderContext`, `hasAngleSliderContext`, and a throwing
      `getAngleSliderContext(consumerName?)` whose message names both the part and
      `` `<AngleSlider>` ``.
- [X] T013 [P] Implement `src/lib/components/ui/angle-slider/angle-slider-hidden-input.svelte`
      per contracts §6: the port of upstream `components/visually-hidden-input.tsx` — module-script
      `AngleSliderHiddenInputProps` (`control`, `value`, `checked`, `bubbles` default `true`,
      `type` default `'hidden'`, `ref = $bindable(null)`, `...restProps`); always renders
      `aria-hidden="true"` and `tabindex="-1"`, clipped with `clip-path: inset(50%)` at
      `1px × 1px`; an `$effect` that sizes the input from a `ResizeObserver` on `control` and
      disconnects it on teardown; an `$effect` that writes `value`/`checked` onto the DOM node
      directly (bypassing React-style controlled-input diffing) and dispatches a synthesised
      `input`/`click` event with `bubbles`; `JSON.stringify`s array `value`s, upstream verbatim.
      Depends on: T012.
- [X] T014 Implement `src/lib/components/ui/angle-slider/angle-slider.svelte` (Root) per
      contracts §1: module-script `AngleSliderRootProps` and `AngleSliderChildProps` with every
      prop/default/JSDoc from contracts §1 copied verbatim; resolves `dir` from an explicit prop
      or `useDirection()` (`direction-provider`); calls
      `setAngleSliderContext(new AngleSliderRootState({...}))` during initialisation with getter
      functions for every reactive prop; `onpointerdown`/`onpointermove`/`onpointerup` handlers
      using pointer capture (`setPointerCapture` on `event.target`) that call
      `getBoundingClientRect()` once per event and never inside an `$effect` (FR-020);
      `onpointerdown` snapshots `valuesBeforeSlideStart`, then branches (upstream
      `angle-slider.tsx:488-520`, data-model.md Entity 3): when `event.target` is contained by a
      registered thumb element in `state.thumbs`, focus that element, set `valueIndexToChange` to
      its index and change **no** value; otherwise derive the pointer value from the measured
      rect, set `valueIndexToChange = getClosestValueIndex(values, pointerValue)` and apply that
      value; `onpointerup` releases capture and fires `onValueCommit` only when the active index's
      value differs from the snapshot; `onkeydown` handling the contracts §8 key map
      (delegated to logic in `angle-slider.svelte.ts`); every documented `onkeydown`/
      `onpointerdown`/`onpointermove`/`onpointerup` caller prop runs first, with
      `preventDefault()` cancelling the built-in handling; a `child` snippet (D-08) replacing the
      root `<div>`; rendered attributes `data-slot="angle-slider"`, `data-disabled`,
      `data-readonly`, `dir`, `style="width:...;height:..."` (`size * 2 + 40`), and
      `class={cn('relative touch-none select-none', disabled && 'opacity-50', className)}`.
      Depends on: T012.
- [X] T015 [P] Implement `src/lib/components/ui/angle-slider/angle-slider-track.svelte` per
      contracts §2: module-script `AngleSliderTrackProps`; reads `disabled`/`size`/`thickness`/
      `startAngle`/`endAngle` from `getAngleSliderContext('<AngleSlider.Track>')`; renders a
      `<circle>` rail when the sweep is `>= 359°`, otherwise an arc `<path>` from
      `describeAngleArc`; `data-slot="angle-slider-track"`, `data-disabled`, `aria-hidden="true"`,
      `focusable="false"`, `width`/`height = (size + 20) * 2`; the rail child carries
      `data-slot="angle-slider-track-rail"`, `class="stroke-muted"`, `stroke-width={thickness}`,
      `stroke-linecap="round"`, `vector-effect="non-scaling-stroke"`; then
      `{@render children?.()}` inside the `<svg>` after the rail, so `<AngleSlider.Range />`
      composes inside the Track (contracts §2). Depends on: T014.
- [X] T016 [P] Implement `src/lib/components/ui/angle-slider/angle-slider-range.svelte` per
      contracts §3: module-script `AngleSliderRangeProps`; reads context; renders a `<path>`
      spanning `min → values[0]` for one value and `min(values) → max(values)` for two or more,
      rendering nothing when the two ends are equal (upstream verbatim); its start/end angles MUST
      be derived through the same `getAngleFromValue` the Thumb uses, so the arc follows the
      thumbs on an `inverted` dial — upstream's `angle-slider.tsx:674-679` omits the `inverted`
      branch that `getAngleFromValue` applies, leaving the arc mirrored against its own thumbs;
      that is treated as an upstream bug under FR-009 and recorded as divergence D-10; `data-slot=
      "angle-slider-range"`, `data-disabled`, `class="stroke-primary"`. Depends on: T014.
- [X] T017 Implement `src/lib/components/ui/angle-slider/angle-slider-thumb.svelte` per
      contracts §4: module-script `AngleSliderThumbProps` and `AngleSliderThumbChildProps`;
      reads context via `getAngleSliderContext('<AngleSlider.Thumb>')`; renders nothing when
      `values[index] === undefined` (upstream verbatim); a positioned `<span>` wrapper (owns
      registration so it survives `child` mode, R-10) at
      `left: centre + size·cos θ; top: centre + size·sin θ; transform: translate(-50%, -50%)`
      containing a `<div role="slider">` with `aria-valuemin`/`aria-valuenow`/`aria-valuemax`,
      `aria-orientation="vertical"`, `aria-disabled="true"` when disabled, `aria-readonly="true"`
      when `readOnly`, `tabindex={disabled ? undefined : 0}`, `data-slot="angle-slider-thumb"`,
      `data-disabled`, `data-readonly`, `data-index={index}`; a registration `$effect` keyed on
      the element and `index` that calls `register`/`unregister` (register wrapped in `untrack`,
      teardown calls `unregister`); an `onfocus` handler on the `role="slider"` element that calls
      the caller's `onfocus` first, bails out when `event.defaultPrevented`, and otherwise sets the
      root state's `valueIndexToChange` to this thumb's `index` (upstream
      `angle-slider.tsx:769-777`; data-model.md Entity 3, "Transitions of `valueIndexToChange`") —
      this is the only mechanism that makes keyboard interaction act on the focused thumb
      (contracts §8), so T005's `Home`/`End` assertions and T008's second-thumb assertion depend on
      it; nests one `AngleSlider.HiddenInput` (from T013) **only when `isFormControl`** per
      data-model.md Entity 4, with `type="number"`, `control` set to the wrapper element,
      `name`/`form`/`disabled`/`min`/`max`/`step` mirrored from the root per data-model.md Entity 4
      (`readOnly` deliberately does **not** disable it). Depends on: T014, T013.
- [X] T018 [P] Implement `src/lib/components/ui/angle-slider/angle-slider-value.svelte` per
      contracts §5: module-script `AngleSliderValueProps` and `AngleSliderValueChildProps`;
      reads context; default text `` `${values[0]}${unit}` `` for one value,
      `` `${sorted[0]}${unit} - ${sorted[sorted.length - 1]}${unit}` `` for two or more — the
      smallest and largest **current values**, never the `min`/`max` props (upstream
      `angle-slider.tsx:847-858`) — unless `children`
      or `formatValue` overrides it; pinned to the dial's centre; `data-slot="angle-slider-value"`,
      `data-disabled`, `data-readonly`; caller `style` merged after the positioning style. Depends
      on: T014.

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/angle-slider/angle-slider.test.ts`
still fails (no barrel to import from) — expected until Phase 4.

---

## Phase 4: Barrel and types

- [X] T019 Create `src/lib/components/ui/angle-slider/index.ts` exactly as specified in
      contracts §7 — Barrel (CLAUDE.md §3): import `Root` from `./angle-slider.svelte`, `Track`
      from `./angle-slider-track.svelte`, `Range` from `./angle-slider-range.svelte`, `Thumb`
      from `./angle-slider-thumb.svelte`, `Value` from `./angle-slider-value.svelte`,
      `HiddenInput` from `./angle-slider-hidden-input.svelte`; re-export every prop type
      (`AngleSliderRootProps`, `AngleSliderChildProps`, `AngleSliderTrackProps`,
      `AngleSliderRangeProps`, `AngleSliderThumbProps`, `AngleSliderThumbChildProps`,
      `AngleSliderValueProps`, `AngleSliderValueChildProps`, `AngleSliderHiddenInputProps`); from
      `./angle-slider.svelte.js` re-export `AngleSliderRootState`, `setAngleSliderContext`,
      `hasAngleSliderContext`, `getAngleSliderContext`, every pure arithmetic function and
      `DEFAULT_*`/`THUMB_HALO`/`PAGE_KEYS`/`ARROW_KEYS` constant, and `type AngleSliderGeometry`;
      export `Root`, `Track`, `Range`, `Thumb`, `Value`, `HiddenInput` and the prefixed aliases
      `Root as AngleSlider`, `Track as AngleSliderTrack`, `Range as AngleSliderRange`,
      `Thumb as AngleSliderThumb`, `Value as AngleSliderValue`,
      `HiddenInput as AngleSliderHiddenInput`. Every intra-repo import carries the `.js`
      extension. Depends on: T013, T015, T016, T017, T018.

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/angle-slider/angle-slider.test.ts`
should now pass — if any of scenarios S1–S7 fail, fix `angle-slider.svelte.ts`/the part files
(not the tests) before continuing.

---

## Phase 5: Demo route

- [X] T020 Create `src/routes/docs/components/angle-slider/+page.svelte` with a page
      heading/description and five `<ComponentPreview>` sections from
      `$lib/components/docs/index.js`, matching `docs/components/circular-progress`'s layout:
      **Default** (single thumb, `defaultValue={[180]}`, mirroring `angle-slider-demo.tsx`),
      **Controlled** (`bind:value` plus Reset/Randomize buttons that animate the value using this
      project's own means — no new `motion` dependency, per spec.md Assumptions — mirroring
      `angle-slider-controlled-demo.tsx`), **Range** (two thumbs, live `AngleSlider.Value`
      readout, `minStepsBetweenThumbs`, mirroring `angle-slider-range-demo.tsx`), **Themes** (eight
      swatches per research R-13, mirroring the eight swatches of `angle-slider-themes-demo.tsx`
      one for one: Default→`primary`, Success→`success`, Warning→`warning`,
      Destructive→`destructive`, Purple→`info` opacity variant, Orange→`primary` opacity variant,
      Blue→`info`, Pink→`success` opacity variant — matching R-13's five-tokens-plus-three-opacity-
      variants mapping so the demo keeps upstream's swatch count under Principle VIII), **Form**
      (two sliders inside one
      `<form>` submitted together using this project's own form-adjacent building blocks — no
      `react-hook-form`/`zod` — mirroring `angle-slider-form-demo.tsx`); plus a props table built
      from `$lib/components/ui/table` covering every prop in contracts §1–§6, and a data
      attributes table from contracts §9. Depends on: T019.

---

## Phase 6: Registry entry and docs polish

- [X] T021 Complete the `angle-slider` entry in `registry.json` (repository root) started in
      T002: set `"files"` to the eight shipped component files — `index.ts`,
      `angle-slider.svelte`, `angle-slider-track.svelte`, `angle-slider-range.svelte`,
      `angle-slider-thumb.svelte`, `angle-slider-value.svelte`,
      `angle-slider-hidden-input.svelte`, `angle-slider.svelte.ts` (each path prefixed
      `src/lib/components/ui/angle-slider/`) — each with `"type": "registry:ui"`; keep
      `"registryDependencies": ["direction-provider"]` and `"dependencies": []`; do **not** list
      `angle-slider.test.ts` or `angle-slider.test.svelte`. Depends on: T019.
- [X] T022 Run `pnpm run registry:build` and confirm it exits zero and writes
      `static/r/angle-slider.json` containing the eight component files with `$lib/...` imports
      rewritten to registry placeholders and `registryDependencies: ["direction-provider"]`
      preserved (quickstart.md §5). Depends on: T021.

---

## Phase 7: Verification

- [X] T023 Run `pnpm run format` (shadcn-style generator output is not Prettier-formatted) and
      leave the formatting changes in the working tree (no git commands — the orchestrator owns
      the working tree).
- [X] T024 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and
      `pnpm run build`, and fix everything that fails. Do not suppress any failure (no
      `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `.skip`/`.todo`,
      `as any`, deleted assertions, or loosened configs) — fix the root cause in
      `angle-slider.svelte.ts`, any `angle-slider-*.svelte` part, `index.ts`,
      `angle-slider.test.ts`, `angle-slider.test.svelte`, or
      `src/routes/docs/components/angle-slider/+page.svelte` as needed. Depends on: T003–T023,
      T025.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Tests (Phase 2)**: depends on Setup completing (registry stub in place); tests are written
  and expected to fail (module-not-found) until Phase 3/4 land — this is the required TDD state,
  not a bug.
- **Core component files (Phase 3)**: depends on Phase 2 existing (tests define the contract);
  T012 blocks every part file; T017 additionally depends on T013 (`HiddenInput`).
- **Barrel and types (Phase 4)**: depends on T013 and T015–T018.
- **Demo route (Phase 5)**: depends on T019.
- **Registry entry and docs polish (Phase 6)**: depends on T019 (T020 and T021 can run in
  parallel with each other — different files — but both wait on T019).
- **Verification (Phase 7)**: depends on everything above.

### Parallel Opportunities

- T001 and T002 (Setup) — different concerns, no shared file.
- T003 alone opens Phase 2; T004–T011 and T025 all write into `angle-slider.test.ts` and so run
  **sequentially** even though they cover independent behavioural areas (same-file rule).
- T013 (Phase 3) has no dependency beyond T012 and can proceed alongside T014 once T012 lands.
- T015, T016 and T018 (Phase 3) all depend only on T014, touch different files, and can run in
  parallel; T017 must wait for both T014 and T013.
- T020 (Phase 5) and T021 (Phase 6) — both depend only on T019, touch different files, can run in
  parallel; T022 must wait for T021.

---

## Implementation Strategy

Build in the phase order above: Setup → Tests (all seven quickstart scenarios encoded, red) →
Core files (T012 arithmetic/state → T013 hidden input → T014 Root → T015/T016/T018 in parallel →
T017 Thumb, green) → Barrel → Demo → Registry → Verification. Do not skip ahead to Phase 3 before
Phase 2's tests exist; do not write the pointer-measurement into an `$effect` anywhere in Phase 3
(FR-020) — every `getBoundingClientRect()` call belongs inside a DOM event handler, never inside
an `$effect`; do not mark Phase 7 done while any suppression comment is present.

---

## Phase 8: Convergence

**Purpose**: Close the gaps found by `/speckit-converge` between the shipped Angle Slider and
spec.md / plan.md / contracts. Every item below is additive; nothing in Phases 1–7 is reopened.

- [X] T026 Fix the filled range on an `inverted` dial in
      `src/lib/components/ui/angle-slider/angle-slider-range.svelte` per FR-009 / FR-007 (partial):
      `describeAngleArc` always emits sweep-flag `1` (clockwise), but `getAngleFromValue` makes the
      dial angle *decrease* as the value increases when `inverted` is set, so the arc drawn from
      `angleFor(rangeStart)` to `angleFor(rangeEnd)` covers the **complement** of the selection —
      `defaultValue={[90]}` on a `0…360` inverted dial draws 270° of arc where 90° is selected.
      Sweep the selected side instead (swap the two endpoints, or thread a sweep direction through
      `describeAngleArc`), keeping the non-inverted output byte-identical to upstream so T009 and
      T025 still pass. Record the arithmetic in the JSDoc beside the existing D-10 note.
- [X] T027 Strengthen the inverted-range assertion in
      `src/lib/components/ui/angle-slider/angle-slider.test.ts` per SC-002 (partial): the current
      case ("ends the range arc on the thumb when the dial is inverted") only compares the arc's
      terminal endpoint with the thumb wrapper's `left`/`top`, which stays true while the arc runs
      the wrong way round the dial. Assert the swept angle itself — the large-arc flag and both
      endpoints — so T026's defect cannot pass again, in both the inverted and non-inverted cases.
      Depends on: T026.
- [X] T028 Add teardown assertions to `src/lib/components/ui/angle-slider/angle-slider.test.ts` per
      plan.md Phase D (missing): the file currently has no unmount test at all. Assert that
      unmounting a dial removes its thumbs from `AngleSliderRootState.thumbs` (observe the map
      shrinking through a state instance the test owns, not merely that a callback stopped firing),
      and that `angle-slider-hidden-input.svelte` calls `ResizeObserver.prototype.disconnect` on
      teardown (spy on the constructor and assert the instance was disconnected). Both must fail if
      the cleanup return is deleted.
- [X] T029 Cover `child` mode in `src/lib/components/ui/angle-slider/angle-slider.test.ts` and
      `angle-slider.test.svelte` per contracts §1/§4/§5 and research D-08/R-10 (missing): the
      harness already declares `useRootChild` but no test references it, and the harness has no
      `child` path for Thumb or Value. Add snippet-driven cases asserting (a) the root's merged
      props land on the caller's element with `data-slot`, `dir`, `class` and the size `style`
      intact and pointer/keyboard interaction still works; (b) a `child` Thumb stays registered with
      the root — `Home`/`End` and a pointerdown on it still target its index — proving R-10's claim
      that registration lives on the wrapper `<span>`; (c) a `child` Value receives the computed
      readout props. Establish what happens to `dir` inheritance when `ref` stays `null` in root
      `child` mode, fix it if it is wrong, and assert the resulting behaviour either way.
- [X] T030 Test the explicit `form` prop path in
      `src/lib/components/ui/angle-slider/angle-slider.test.ts` per FR-016 (missing): only the
      `<form>`-ancestor branch of `isFormControl` is currently exercised. Render a dial that is *not*
      inside a `<form>` but is given `form="<id>"` pointing at a sibling form, and assert the hidden
      input is rendered, carries that `form` attribute, and its value reaches
      `new FormData(form)` — the other half of data-model.md Entity 4.
- [X] T031 Assert the additive ARIA of the hidden input and the track in
      `src/lib/components/ui/angle-slider/angle-slider.test.ts` per SC-005 and spec.md Assumptions
      "Additive ARIA on the thumb and the hidden input" (D-05) (missing): assert every rendered
      `[data-slot="angle-slider-hidden-input"]` carries `aria-hidden="true"` and `tabindex="-1"` so
      an unlabelled numeric input never appears beside a thumb in the accessibility tree, and that
      the track `<svg>` carries `aria-hidden="true"` and `focusable="false"`. Both are documented in
      contracts §2/§6 and neither has an assertion today.
- [X] T032 Animate the shorter arc in the Controlled preview of
      `src/routes/docs/components/angle-slider/+page.svelte` per SC-006 (partial): `animateTo` ramps
      linearly from the current angle to the target, so Reset from 350° sweeps backwards through
      180°. Upstream's `angle-slider-controlled-demo.tsx` normalises the delta into `[-180, 180]`
      and wraps the animated value with `((v % 360) + 360) % 360`, so the dial always takes the
      short way round. Reproduce that normalisation in the existing rAF ramp — still without adding
      `motion` or any animation dependency (spec.md Assumptions).
- [X] T033 Test `unit` and the `children` override of `AngleSlider.Value` in
      `src/lib/components/ui/angle-slider/angle-slider.test.ts` per FR-015 and contracts §5
      (missing): the harness declares `unit` and `valueChildren` but no test passes either. Assert a
      custom `unit` replaces the default `°` for both the one-thumb and the two-thumb readout, and
      that explicit `children` win over the computed text (and over `formatValue`, matching
      upstream's `children ?? displayValue`).
- [X] T034 Test the `ref` bindings in `src/lib/components/ui/angle-slider/angle-slider.test.ts` per
      contracts §1–§6 (missing): `ref` is `$bindable` on all six parts and is this port's
      replacement for `forwardRef` (CLAUDE.md §4), yet nothing asserts one resolves — the harness's
      `rootRef` prop is unused. Assert `bind:ref` on the root yields the `[data-slot="angle-slider"]`
      element and that an SVG part's ref (Track or Range) yields the matching SVG node, so the
      `SVGSVGElement`/`SVGPathElement` ref declarations are covered.
- [X] T035 Restore the three upstream demo details in
      `src/routes/docs/components/angle-slider/+page.svelte` per SC-006 / FR-019 (partial): the
      Themes preview drops the `{value}°` caption upstream renders under each swatch name
      (`angle-slider-themes-demo.tsx`); the Form preview drops upstream's Reset button, which
      restores both dials to their defaults (`angle-slider-form-demo.tsx`); the Controlled preview's
      Reset/Randomize buttons drop upstream's leading icons (`RotateCcwIcon`/`ShuffleIcon` →
      `@lucide/svelte`, already a project dependency).
- [X] T036 Document the two undocumented slots in the data-attributes table of
      `src/routes/docs/components/angle-slider/+page.svelte` per contracts §9 (unrequested): the
      implementation renders `data-slot="angle-slider-thumb-wrapper"` on the positioned `<span>` and
      `data-slot="angle-slider-hidden-input"` on the visually hidden input — both additive to
      contracts §9 and both already relied on by the test suite — but neither is listed for
      consumers. Add a row for each stating what it is on and when it is present.

**Checkpoint**: re-run the Phase 7 gates (`pnpm run format` → `pnpm run check` → `pnpm run lint` →
`pnpm run test:unit -- --run` → `pnpm run build`) with no suppressions.
