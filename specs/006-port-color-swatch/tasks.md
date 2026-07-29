---
description: 'Task list for the Color Swatch component port'
---

# Tasks: Color Swatch Component Port

**Input**: Design documents from `specs/006-port-color-swatch/` (plan.md, spec.md, research.md,
data-model.md, contracts/color-swatch-public-api.md, quickstart.md)

**Prerequisites**: plan.md (loaded), spec.md (loaded), research.md, data-model.md,
contracts/color-swatch-public-api.md, quickstart.md — all present and read.

**Tests**: Tests are MANDATORY (constitution Principle III / VII). Every task below writes to real
repository paths; no task may be satisfied by a suppression (`@ts-ignore`, `@ts-expect-error`,
`eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, deleted assertions, loosened config).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency)
- **[Story]**: Traceability tag to spec.md's User Story 1 (display a color at a glance), 2 (communicate
  transparency), 3 (size/disabled) where a task is scoped to a single story; cross-cutting tasks (the
  colour module, the barrel, RTL, edge cases, registry, gates) carry no tag
- Every description names its exact file path(s)

## Path Conventions

- Component source: `src/lib/components/ui/color-swatch/` — `color-swatch.svelte`, `color.ts`, `index.ts`
- Tests: colocated at `src/lib/components/ui/color-swatch/color-swatch.test.ts` and `color.test.ts`,
  harness at `color-swatch.test.svelte`
- Demo route: `src/routes/docs/components/color-swatch/+page.svelte`
- Registry: `registry.json` at the repository root, generated output at `static/r/color-swatch.json`

---

## Phase 1: Setup (dependencies, registry stub)

**Purpose**: Scaffolding and dependency confirmation before any code is written.

- [X] T001 [P] Create the empty directories `src/lib/components/ui/color-swatch/` and
      `src/routes/docs/components/color-swatch/`; confirm against `package.json` that zero new
      dependencies are needed (`tailwind-variants`, `clsx`, `tailwind-merge` are already installed, per
      plan.md's Technical Context — no `bits-ui` primitive is used and no `pnpm add` is run).
- [X] T002 [P] No-op placeholder — the registry entry is written once, complete, in Phase 6 (see T020),
      because `registry.json` is imported directly by `src/lib/registry.ts` to drive the docs sidebar and
      an incomplete stub entry (empty `files`) would make `/docs/components` list a component whose route
      does not exist yet.

**Checkpoint**: Directories exist, no new deps required.

---

## Phase 2: Tests (write first — MUST fail until Phase 3–5 land)

**Purpose**: Colocated tests for every behavioural area in contracts/color-swatch-public-api.md §8,
written against the not-yet-implemented public API so they fail for the right reason (missing
implementation, not a typo) until Phase 3–5 complete.

- [X] T003 [P] Write `src/lib/components/ui/color-swatch/color.test.ts`, table-driven over
      `normalizeColorValue`, `isCssColor`, `hasAlpha` and `getColorBackgroundStyle` per contract clauses
      C-5.1–C-5.5: every format in the MDX's "Color Format Support" and "Transparency Detection" lists
      (hex, hex+alpha, `rgb()`, `rgba()`, `hsl()`, `hsla()`, `oklch()`, `color()` slash-alpha, named
      colours, `transparent`, an invalid string); the `isCssColor` SSR fallback (`vi.stubGlobal` to
      temporarily delete `globalThis.CSS`, asserting the function returns `true`) and the throw-inside
      path (asserting `false`); `normalizeColorValue` idempotency and whitespace trimming; and
      `getColorBackgroundStyle`'s four background states (C-4.1–C-4.6) including the `checkerboardSize`
      and `withoutTransparency` options. This file imports only from `./color.js` (not yet created).
- [X] T004 [P] Create the test harness component `src/lib/components/ui/color-swatch/color-swatch.test.svelte`
      per contracts/color-swatch-public-api.md §8: wraps `ColorSwatch.Root` to exercise the `child`
      snippet (rendering onto a caller-supplied `<span>`, plus a second variant that spreads onto a
      `<button>` and sets `role="button"` after the spread, to prove the caller's role wins over the
      payload's `role="img"`), `bind:ref`, a prop-rerender case (re-supplying a changed `color` prop from a
      parent `$state`), and a `<DirectionProvider dir="rtl">`-wrapped variant, each reporting the rendered
      attributes through a callback prop so `color-swatch.test.ts` can assert on them without inline markup
      duplication. Imports `ColorSwatch` from `./index.js` (not yet created).
- [X] T005 [US1] Write the roles-and-accessible-name test group in
      `src/lib/components/ui/color-swatch/color-swatch.test.ts`: `role="img"` is always present (C-3.2);
      `aria-label` reads `Color swatch: #3b82f6` for a valid hex value, `Color swatch: blue` for a named
      colour, `Color swatch: rgb(0, 0, 0)` for a valid `rgb()` value, the exact trimmed string for an
      invalid value, and `No color selected` for `undefined`, `''` and a whitespace-only string (C-3.3,
      C-8.1). (spec.md US1 acceptance scenarios 1–3, FR-008)
- [X] T006 [US1] Write the background-and-props test group in
      `src/lib/components/ui/color-swatch/color-swatch.test.ts`: for each of `color` (valid, invalid,
      absent), `size`, `withoutTransparency`, `disabled`, `class` and `style`, assert the individual
      contract clause C-2.2–C-2.9 via `getAttribute('style')`/`className` (C-8.2, C-8.3); `class` from the
      caller overrides the variant's `size-8`, and the caller's `style` is emitted after the computed
      `background` and `forced-color-adjust: none` declarations, so both component declarations are still
      present in `getAttribute('style')` and a caller-supplied `background` appears last and therefore wins
      (C-2.7, C-3.11). An invalid `color` value renders `background-color: transparent` (C-4.2, FR-003) and
      never throws or logs a console error (SC-004). (spec.md US1 acceptance scenario 3, FR-001–FR-003)
- [X] T006a [US1] Write the data-attribute test group in
      `src/lib/components/ui/color-swatch/color-swatch.test.ts` covering contract C-8.4: `data-slot=
      "color-swatch"` is present on every render, in `child` mode and with a caller `class`/`style` (C-3.5,
      FR-009); `data-empty=""` is present for `undefined`, `''` and `'   '` and absent for any resolving
      value, valid or invalid (C-3.9, FR-002); and each of `data-disabled`, `data-transparent`, `data-empty`
      is *absent* — `toBeNull()`, never the string `"false"` — when its condition is off (C-8.4). Depends
      on T005 (same file).
- [X] T007 [US2] Write the transparency test group in
      `src/lib/components/ui/color-swatch/color-swatch.test.ts`: an alpha-bearing colour (`rgba()`,
      `hsla()`, an 8-digit hex, `transparent`) renders the checkerboard background and `data-transparent=""`
      (C-3.8, C-4.3); the same colour with `withoutTransparency` renders only the flat colour with
      `data-transparent` absent (C-4.4, C-4.6); a fully opaque colour never renders the checkerboard
      regardless of `withoutTransparency` (C-4.6). (spec.md US2 acceptance scenarios 1–3, FR-004, FR-005)
- [X] T008 [US3] Write the size-and-disabled test group in
      `src/lib/components/ui/color-swatch/color-swatch.test.ts`: `size="sm"`/`"default"`/`"lg"` each
      render their documented `size-6`/`size-8`/`size-12` class and matching `data-size` (C-2.3, C-3.7),
      defaulting to `"default"` when omitted and falling back to `"default"` for an unrecognised runtime
      value; `disabled` renders `aria-disabled="true"` and `data-disabled=""` plus the variant classes
      `data-disabled:pointer-events-none` and `data-disabled:opacity-50` as they literally appear in the
      `class` attribute — never bare `pointer-events-none`/`opacity-50`, which would disable the swatch
      unconditionally (C-3.4, C-3.6, C-8.8), while omitting `disabled` never renders `aria-disabled` (never
      `"false"`). Additionally assert that a default render's `class` contains `box-border`, `rounded-sm`,
      `border`, `bg-clip-padding` and `shadow-sm`, so the upstream chrome cannot silently drift. Also
      render a disabled swatch with an `onclick` spy in `restProps`: assert the handler is still wired
      through `restProps` (it is not stripped), while the interaction guard is expressed purely through
      `data-disabled` and the `data-disabled:pointer-events-none` variant class — jsdom does not honour
      `pointer-events`, so this is an assertion on the emitted attributes/classes, not on a synthesised
      click's effect. (spec.md US3 acceptance scenarios 1–2, FR-006, FR-007)
- [X] T009 Write the keyboard/guard-rail test group in
      `src/lib/components/ui/color-swatch/color-swatch.test.ts`: the swatch carries no `tabindex` and
      `userEvent.tab()` from a preceding sibling button moves focus past it to a following sibling button,
      never landing on the swatch itself (C-3.10, C-8.5) — this documents the absence of any key handler,
      matching upstream's static `role="img"`.
- [X] T010 Write the uncontrolled/controlled-equivalent test group in
      `src/lib/components/ui/color-swatch/color-swatch.test.ts`: the component owns no internal state
      (contract C-2.11), so a first render with a given `color` never mutates its own attributes absent a
      prop change; using the T004 harness's prop-rerender case, changing the parent's `color` value
      re-renders the swatch's `aria-label` and background to match the new value with no stale attributes
      left over (C-8.6).
- [X] T011 Write the RTL test group in `src/lib/components/ui/color-swatch/color-swatch.test.ts`: render
      the T004 harness's `<DirectionProvider dir="rtl">` variant and assert the rendered `class` and
      `style` are identical to the LTR render — no inversion, since the swatch has no directional content
      of its own (C-8.7, spec.md Edge Cases).
- [X] T012 Write the `child`-snippet and edge-case test group in
      `src/lib/components/ui/color-swatch/color-swatch.test.ts` using the T004 harness: the caller's
      `<span>` receives the merged `role`/`aria-label`/data attributes/`class`/`style`, a caller `role`
      written after the spread onto a `<button>` overrides `role="img"` (proving `role="button"` wins), the
      default `<div>` is absent, and `bind:ref` stays `null` in `child` mode (C-8.9); passing `color=""` and
      `color="   "` are each treated identically to omitting `color` entirely (C-4.5, FR-002); leading and
      trailing whitespace around a valid value is trimmed before both the accessible name and the
      background are computed (spec.md Edge Cases).

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/color-swatch/color-swatch.test.ts
src/lib/components/ui/color-swatch/color.test.ts` fails (module not found / assertions unmet) — expected,
since Phase 3–5 have not run yet.

---

## Phase 3: Core component files

**Purpose**: The dependency-free colour module and the single rendered part.

- [X] T013 Implement `src/lib/components/ui/color-swatch/color.ts` per
      contracts/color-swatch-public-api.md §1.2 and §5: `normalizeColorValue(value?: string):
      string | undefined` (trim; `''`/whitespace-only → `undefined`; idempotent); `isCssColor(value:
      string): boolean` (delegates to `CSS.supports('color', value)`, returns `true` when `CSS`/
      `CSS.supports` is unavailable, returns `false` if the call throws); `hasAlpha(value: string):
      boolean` (the upstream regex set: `rgba()`, `hsla()`, 8-digit hex, `transparent`, slash-alpha
      `color()`/`oklch()` syntax, case-insensitive, tolerant of surrounding whitespace); and
      `getColorBackgroundStyle(value: string | undefined, options?: ColorBackgroundOptions): string`
      producing the four declarations from §4 (C-4.1–C-4.6) verbatim, with `options.checkerboardSize`
      (default `'10px'`) substituting `<t>` and `options.withoutTransparency` selecting C-4.4 over C-4.3.
      No rune, no top-level side effect, no DOM access outside the guarded `CSS.supports` call; full JSDoc
      including `@default`/`@example` on every export. Depends on T003 (test exists first).
- [X] T014 Implement `src/lib/components/ui/color-swatch/color-swatch.svelte` per
      contracts/color-swatch-public-api.md §2–§3: module script exports `colorSwatchVariants` (a `tv()`
      instance for the size classes plus the shared border/shadow/base classes), `COLOR_SWATCH_SIZES =
      ['default', 'sm', 'lg'] as const`, `resolveColorSwatchSize(value?: string): ColorSwatchSize`
      (unrecognised input falls back to `'default'`, mirroring `resolveStatusVariant`), and the
      `ColorSwatchRootProps` type (`WithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>> &
      { color?; size?; withoutTransparency?; disabled?; child? }`, upstream JSDoc copied verbatim,
      `ColorSwatchProps` aliased to the same type, `ColorSwatchChildProps` as an explicit shape); instance
      script destructures `$props()` once (`ref = $bindable(null)`, `color`, `size = 'default'`,
      `withoutTransparency = false`, `disabled = false`, `class: className`, `style`, `child`,
      `...restProps`), computes `$derived` values for the normalised colour (via `normalizeColorValue`),
      validity (`isCssColor`), alpha detection (`hasAlpha`), the background declaration string (via
      `getColorBackgroundStyle`, imported from `./color.js`), the accessible name (`Color swatch: <value>`
      or `No color selected`), and a merged attribute payload (`role="img"`, `aria-label`, `aria-disabled`
      iff `disabled`, `data-slot="color-swatch"`, `data-size`, `data-disabled` iff `disabled`,
      `data-transparent` iff the checkerboard renders, `data-empty` iff no colour resolves, `class` via
      `cn(colorSwatchVariants({ size }), className)`, `style` = computed background + `forced-color-adjust:
      none` + caller `style` appended last); renders the `child` snippet branch (spreading the merged
      payload, no default `<div>`) vs. the default `<div bind:this={ref}>` branch with `...restProps`
      spread before `class`/`style`. `ColorSwatchRootProps` is built with `WithoutChildren<…>` so
      `children` is structurally absent from the type — `pnpm run check` is the enforcement for this, with
      no runtime assertion and no `@ts-expect-error` used to demonstrate it. Depends on T013 (imports
      `color.js`) and T004/T005–T012/T006a (tests exist first).

**Checkpoint**: `color.ts` and `color-swatch.svelte` exist; Phase 2's `color.test.ts` should now pass, and
`color-swatch.test.ts` progresses further but the barrel is still missing.

---

## Phase 4: Barrel and types

- [X] T015 Implement `src/lib/components/ui/color-swatch/index.ts` per
      contracts/color-swatch-public-api.md §1.1: import `Root` from `./color-swatch.svelte`; re-export
      `colorSwatchVariants`, `COLOR_SWATCH_SIZES`, `resolveColorSwatchSize`, `ColorSwatchSize`,
      `ColorSwatchRootProps`, `ColorSwatchProps`, `ColorSwatchChildProps` from `./color-swatch.svelte`;
      re-export `normalizeColorValue`, `isCssColor`, `hasAlpha`, `getColorBackgroundStyle`,
      `ColorBackgroundOptions` from `./color.js`; export `Root` alongside the `ColorSwatch` alias. Depends
      on T014.

**Checkpoint**: `import * as ColorSwatch from '$lib/components/ui/color-swatch/index.js'` resolves; run
`pnpm run test:unit -- --run src/lib/components/ui/color-swatch/color-swatch.test.ts
src/lib/components/ui/color-swatch/color.test.ts` — all Phase 2 tests should now pass.

---

## Phase 5: Demo route

- [X] T016 [US1] Implement `src/routes/docs/components/color-swatch/+page.svelte` with the page
      heading/intro and the "Default" `<ComponentPreview>` section (mirroring `color-swatch-demo.tsx`'s
      labelled swatch, three sizes, semi-transparent example, palette row and disabled swatch), using
      `ComponentPreview` from `$lib/components/docs/index.js` and `* as ColorSwatch` from
      `$lib/components/ui/color-swatch/index.js`, following the structure of
      `src/routes/docs/components/stat/+page.svelte`.
- [X] T017 [US3] Add the "Sizes" `<ComponentPreview>` section (mirroring `color-swatch-sizes-demo.tsx`'s
      five colours × sm/default/lg grid) to `src/routes/docs/components/color-swatch/+page.svelte`.
      Depends on T016 (same file).
- [X] T018 [US2] Add the "Transparency" `<ComponentPreview>` section (mirroring
      `color-swatch-transparency-demo.tsx`'s rgba ramp, hsla ramp, `withoutTransparency` row and default
      row) to `src/routes/docs/components/color-swatch/+page.svelte`. Depends on T016 (same file).
- [X] T019 Add the "Usage" `<ComponentPreview>` section (the MDX's single `<ColorSwatch color="#3b82f6"
      />` plus the empty/invalid edge cases the MDX describes under Accessibility) and a props table
      (`$lib/components/ui/table`, listing every row of contracts/color-swatch-public-api.md §2 with type,
      default and description) to `src/routes/docs/components/color-swatch/+page.svelte`. Depends on T016
      (same file).

**Checkpoint**: `/docs/components/color-swatch` renders all four previews plus the props table with no
console errors.

---

## Phase 6: Registry entry and docs polish

- [X] T020 Append the complete `color-swatch` entry to `registry.json` at the repository root per
      contracts/color-swatch-public-api.md §6 in one step (no stub, no later replace — see T002): `name:
      "color-swatch"`, `type: "registry:ui"`, `title: "Color Swatch"`, `description` (from §6),
      `registryDependencies: []`, `dependencies: []`, and `files` listing
      `src/lib/components/ui/color-swatch/index.ts`, `color-swatch.svelte`, and `color.ts` (each `type:
      "registry:ui"`); `color-swatch.test.ts`, `color.test.ts` and `color-swatch.test.svelte` stay
      excluded. Depends on T015.
- [X] T021 Run `pnpm run registry:build` to regenerate `static/r/color-swatch.json` from the completed
      `registry.json` entry. Depends on T020.

**Checkpoint**: `static/r/color-swatch.json` exists and matches the three source files.

---

## Phase 7: Verification (MANDATORY — Principle VII)

**Purpose**: The feature is not complete until all gates are green. No suppressions
(`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, deleted
assertions, loosened configs) may be used to reach green — fix the root cause.

- [X] T022 Run `pnpm run format` across every file this port touched (shadcn/generator-style output is
      not Prettier-formatted, and this repo's Tailwind class order depends on it).
- [X] T023 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, and
      fix everything that fails.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001/T002 run in parallel.
- **Tests (Phase 2)**: Depends on Setup (directories must exist). T003 and T004 are parallel to each other
  (different files); T005–T012 and T006a all write `color-swatch.test.ts` and run strictly in sequence
  after T004.
- **Core (Phase 3)**: Depends on Tests existing (TDD — they must fail first). T013 (`color.ts`) blocks
  T014 (`color-swatch.svelte` imports it).
- **Barrel (Phase 4)**: Depends on Phase 3 (T014).
- **Demo (Phase 5)**: Depends on Barrel (T015). T017, T018 and T019 all depend on T016 (same file) and
  are otherwise independent edits to different sections of it — apply sequentially to avoid clobbering
  each other's diff.
- **Registry (Phase 6)**: T020 depends on the finished file set (T015) and writes the complete
  `registry.json` entry in one step (T002 is a no-op placeholder); T021 depends on T020.
- **Verification (Phase 7)**: Depends on everything above — always the last phase.

### Parallel Opportunities

- Phase 1: T001, T002.
- Phase 2: T003 alongside T004 (different files); T005–T012 and T006a themselves are sequential (same
  file, `color-swatch.test.ts`).
- Phase 3: T013 must complete before T014 (import dependency) — no parallelism.
- No other cross-task parallelism — Phase 4 through Phase 7 each depend on the immediately preceding
  phase, and Phase 5's three section tasks touch one shared file.

---

## Parallel Example: Phase 2

```bash
# T003 (color.test.ts) and T004 (the test harness .svelte) touch different files and have no
# dependency on each other — run them together:
Task: "Write src/lib/components/ui/color-swatch/color.test.ts"
Task: "Create src/lib/components/ui/color-swatch/color-swatch.test.svelte"
```

---

## Implementation Strategy

1. Phase 1 (Setup) → Phase 2 (Tests, written to fail) → Phase 3 (Core: `color.ts` then
   `color-swatch.svelte`) → Phase 4 (Barrel) — at this checkpoint every Phase 2 test should pass and User
   Stories 1–3 are all exercised by `color-swatch.test.ts` / `color.test.ts`.
2. Phase 5 (Demo) makes the port visible on `/docs/components/color-swatch`; Phase 6 makes it installable
   via the registry, and additionally makes the colour-parsing module available to the wave-3
   `color-picker` port via `registryDependencies: ["color-swatch"]` (FR-012, SC-005).
3. Phase 7 is the non-negotiable gate: `format` → `check` → `lint` → `test:unit -- --run` → `build`, all
   green, nothing skipped or suppressed.

Do NOT run git write commands — the orchestrator owns the working tree (Constitution Principle X).
