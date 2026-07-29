# Implementation Plan: Port the Gauge component

**Branch**: `008-port-gauge` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-port-gauge/spec.md`

## Summary

Port Dice UI's `gauge` (radix base) to Svelte 5 as a seven-part compound component under
`src/lib/components/ui/gauge/`. The root is a `div` with `role="meter"` that validates and clamps
`value` against `min`/`max`, derives arc geometry from `size`/`thickness`/`startAngle`/`endAngle`,
classifies the reading as `indeterminate` / `loading` / `complete`, and publishes all of it on a typed
`Symbol` context. `Indicator` (an `<svg>`), `Track` and `Range` (two `<path>`s sharing one `d`),
`ValueText` and `Label` (two `div`s) read that context; `Combined` is a fixed composition of
`Root > Indicator > (Track, Range)` + `ValueText`.

The value pipeline (`resolveProgressBounds`, `clampProgressValue`, `getProgressPercentage`,
`getProgressState`) and the ring geometry (`getRingGeometry`) are **imported from
`circular-progress.svelte.ts`**, not re-derived — upstream ships byte-identical copies of that maths in
both components. The angle maths this component adds (`getNormalizedAngle`, `polarToCartesian`,
`describeArc`, `getArcLength`, `getArcCenterY`) is written into that same module as pure, exported,
unit-tested functions so later arc-shaped ports reuse it the same way (FR-019), and the shared file is
listed in gauge's registry entry so a standalone install stays self-contained.

Four React-only affordances are translated rather than transliterated: `asChild`/`Slot` → the `child`
snippet on `Root`/`ValueText`/`Label`, `React.useId()` → `$props.id()`, the `React.useMemo` context value
→ `$derived` members on a state class, and `style={{ top, ...style }}` → an explicit `style` prop merged
into one declaration string. One deliberate accessibility fix diverges from upstream: `aria-labelledby`
is emitted only when a `Gauge.Label` is actually rendered (FR-006), instead of always pointing at an id
that usually does not exist.

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`) + Svelte 5.56 (runes forced on in
`vite.config.ts`)

**Primary Dependencies**: SvelteKit 2, Tailwind CSS v4, `cn()` (`clsx` + `tailwind-merge`) from
`$lib/utils.js`, `bits-ui` 2.18 (evaluated, not used — see Constitution Check IV),
`$lib/components/ui/circular-progress` (shared geometry module, in-repo). `tailwind-variants` is not
needed: no part has variants. **Zero new npm dependencies.**

**Storage**: N/A

**Testing**: Vitest 4 (jsdom) + `@testing-library/svelte` 5 + `@testing-library/user-event` 14,
colocated at `src/lib/components/ui/gauge/gauge.test.ts` with a `gauge.test.svelte` harness for
composition, `bind:ref`, `child` snippets and `dir="rtl"`. `expect.requireAssertions` is on.

**Target Platform**: Browser, SSR-safe (no `window`/`document` access at module or init scope) — the
SvelteKit docs app plus any consumer project installing the registry item.

**Project Type**: shadcn-svelte registry component (source distribution) + docs route.

**Performance Goals**: every derived value is `$derived` pure maths — no observers, timers or effects in
the component. A `value` change touches two path attributes (`stroke-dashoffset` on the range, plus the
root/indicator/range data attributes) and one text node; the arc `d` recomputes only when geometry props
change.

**Constraints**: no `any`, no suppression comments, no `dark:` overrides, no raw palette colours, no
`space-*` utilities, no manual `z-index`. `$effect` is used exactly once (the label's de-registration
teardown) and nowhere that `$derived` would do. Angles are absolute geometry and must not mirror under
`dir="rtl"`.

**Scale/Scope**: 9 new source files (7 parts + barrel + state/context module) + 1 shared module
extended + 1 test + 1 test harness + 1 docs route + 1 registry entry. 7 exported components, 10 root
props, 5 data attributes, 7 ARIA attributes, 5 new exported geometry functions.

## Constitution Check

_GATE: passed before Phase 0 research; re-checked after Phase 1 design (see the bottom of this file)._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                                                                                                                              |
| ---- | ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$props` + `$bindable(null)` refs, `$derived` for every computed value, `$state` only for the label counter, `Snippet` + `{@render}` for `children`/`child`, one `$effect` with a teardown. No stores, `export let`, `createEventDispatcher`, `$:` or `<slot>`.                                                                                          |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `gauge.tsx`, `gauge.mdx` and all four `gauge-*-demo.tsx` read at the pinned commit `d9763d8`. Every prop, part, data attribute, ARIA attribute and dev diagnostic reproduced; the four divergences (`asChild` → `child`, `useId` → `$props.id()`, conditional `aria-labelledby`, demo animation/colours) are recorded in spec §Assumptions and research.md. The `radix` base is used per the invocation and the `circular-progress` precedent. |
| III  | Accessibility Is a MUST             | PASS    | `role="meter"` + `aria-valuemin`/`aria-valuemax` always, `aria-valuenow`/`aria-valuetext` only when determinate, `aria-describedby` → value text, `aria-labelledby` → a **rendered** label (fixes an upstream dangling IDREF), `aria-hidden` on the SVG. Keyboard set is empty by design and asserted as such. RTL asserted non-mirroring.                 |
| IV   | Composition Over Reimplementation   | PASS    | `bits-ui` has no meter primitive; `Progress.Root` re-evaluated and rejected in writing below. The value pipeline and ring geometry are **composed from the existing `circular-progress` module** rather than rewritten.                                                                                                                                   |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file, `gauge-<part>.svelte` naming, `gauge.svelte.ts` for logic, `index.ts` barrel (short names + prefixed aliases + types), `.js` extensions on intra-repo imports, one `registry:ui` entry, no import from `src/routes/**` or `$lib/components/docs/**`.                                                                       |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Props derived from `WithElementRef<HTMLAttributes<HTMLDivElement>>` / `SVGAttributes<SVGSVGElement>` / `SVGAttributes<SVGPathElement>`. No `any`, no `@ts-*`, no `eslint-disable`, no `svelte-ignore`, no config edits.                                                                                                                                   |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final phase; `circular-progress.test.ts` re-run as the shared-module regression proof; no skipped tests.                                                                                                                                                                   |
| VIII | Styling Discipline                  | PASS    | `cn()` with the caller's `class` merged last on all seven parts; semantic tokens only (`text-muted-foreground/20`, `text-primary`, and `success`/`warning`/`destructive`/`info` in the demo); `data-slot="gauge[-part]"` everywhere; `data-state`/`data-value`/`data-min`/`data-max`/`data-percentage` exposed per the MDX tables.                        |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/gauge/+page.svelte` with one `<ComponentPreview>` per upstream demo file (`-demo`, `-sizes-demo`, `-colors-demo`, `-variants-demo`) plus a Combined section and per-part props tables.                                                                                                                                       |
| X    | One Feature Directory Per Component | PASS    | All artifacts in `specs/008-port-gauge/`; no git write commands; nothing written under `.reference/`, `scripts/`, `.specify/scripts/`, `.port-state.json` or `.port-logs/`.                                                                                                                                                                              |

**Bespoke behaviour justification (Principle IV)**:

- **`role="meter"` root — bespoke; `bits-ui` has no meter primitive.** The nearest primitive,
  `Progress.Root` (`node_modules/bits-ui/dist/bits/progress/`), emits `role="progressbar"`, uses the
  `loading | loaded | indeterminate` state vocabulary (upstream requires `complete`) and wins attribute
  merges via `mergeProps(restProps, rootState.props)` so a caller cannot correct it, has no
  `aria-valuetext`, no `getValueText` hook and no `data-percentage`, and performs no clamping or `max`
  validation. The gauge root is ~30 lines of pure derivation: no focus management, no portal, no
  positioning, no dismissal.
- **Arc path maths (`describeArc`, `polarToCartesian`, `getArcLength`, `getArcCenterY`,
  `getNormalizedAngle`) — bespoke, and new to this repo.** Nothing in `bits-ui` or
  `src/lib/components/ui/*` produces an SVG arc `d` string; `circular-progress` draws a full ring with a
  plain `<circle>` and never needed one. Written as pure exported functions in the existing geometry
  module so the next arc component (`angle-slider`) composes them instead of re-deriving them.
- **Value pipeline and ring geometry — composed, not bespoke.** `resolveProgressBounds`,
  `clampProgressValue`, `getProgressPercentage`, `getProgressState`, `isValid*Number` and
  `getRingGeometry` are imported from `circular-progress.svelte.ts`. Only `getDefaultGaugeValueText` is
  new, because upstream's gauge default omits the `%` suffix.
- **Label registration — bespoke, ~6 lines.** No primitive tracks "is my optional label child present";
  bits-ui's `label` component does not participate in this component's context. Implemented as a counter
  on the state class (research.md R-06).

## Public API

Derived from `.reference/diceui/docs/registry/bases/radix/ui/gauge.tsx` at the pinned commit. The full
machine-readable contract, including per-state attribute output and reference geometry values, is
[contracts/public-api.md](./contracts/public-api.md).

### `Gauge` (`Root`) — `gauge.svelte`

Renders a `div` (or the caller's element via `child`).

| Prop           | Type                                                  | Default                    | Bindable | Notes                                                                       |
| -------------- | ----------------------------------------------------- | -------------------------- | -------- | --------------------------------------------------------------------------- |
| `ref`          | `HTMLDivElement \| null`                              | `null`                     | **yes**  | `bind:this`; stays `null` in `child` mode.                                  |
| `value`        | `number \| null \| undefined`                         | `null`                     | no       | `null`/`undefined` ⇒ indeterminate; out-of-range values clamp (FR-002).      |
| `getValueText` | `(value: number, min: number, max: number) => string` | `getDefaultGaugeValueText` | no       | Default is `Math.round(percentage).toString()` — a bare `"45"`, no `%`.      |
| `min`          | `number`                                              | `0`                        | no       | A non-finite `min` falls back to `0`.                                       |
| `max`          | `number`                                              | `100`                      | no       | Non-finite or `<= 0` ⇒ `100`; `<= min` ⇒ `min + 1`.                          |
| `size`         | `number`                                              | `120`                      | no       | SVG width/height/viewBox, px.                                               |
| `thickness`    | `number`                                              | `8`                        | no       | `stroke-width` of track and range, px.                                      |
| `startAngle`   | `number`                                              | `0`                        | no       | Degrees clockwise from 12 o'clock.                                          |
| `endAngle`     | `number`                                              | `360`                      | no       | Degrees clockwise from 12 o'clock.                                          |
| `class`        | `ClassValue`                                          | —                          | no       | Merged **last** through `cn()`.                                             |
| `children`     | `Snippet`                                             | —                          | no       | The composed parts.                                                         |
| `child`        | `Snippet<[{ props: GaugeChildProps }]>`               | —                          | no       | Replaces upstream `asChild`; receives every attribute; `children` unrendered. |
| `…restProps`   | `HTMLAttributes<HTMLDivElement>`                      | —                          | —        | Spread before the computed `class` (upstream order).                        |

**Snippets**: `children`, `child`. **Callbacks/events**: none — upstream exposes no `onValueChange`; the
component is display-only and never writes `value`, so no `$bindable` value prop exists (a `bind:value`
would imply a two-way contract upstream does not have). Standard DOM handlers pass through `restProps`.

**Emitted attributes**: `role="meter"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow` (determinate
only), `aria-valuetext` (determinate only), `aria-describedby` (when value text exists),
`aria-labelledby` (when a `Gauge.Label` is rendered), `data-slot="gauge"`, `data-state`, `data-value`
(determinate only), `data-min`, `data-max`, `data-percentage` (determinate only).

### `GaugeIndicator` (`Indicator`) — `gauge-indicator.svelte`

`<svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 {size} {size}"
class="transform">`. **No `-rotate-90`** — the angle maths already puts 0° at 12 o'clock (research R-10).

| Prop         | Type                           | Default | Bindable | Notes                                             |
| ------------ | ------------------------------ | ------- | -------- | ------------------------------------------------- |
| `ref`        | `SVGSVGElement \| null`        | `null`  | **yes**  | Declared locally — `WithElementRef` is HTML-only. |
| `class`      | `ClassValue`                   | —       | no       |                                                   |
| `children`   | `Snippet`                      | —       | no       | Normally `Track` + `Range`.                       |
| `…restProps` | `SVGAttributes<SVGSVGElement>` | —       | —        |                                                   |

**Attributes**: `data-slot="gauge-indicator"`, `data-state`, `data-value`, `data-min`, `data-max`,
`data-percentage`. **Callbacks**: none.

### `GaugeTrack` (`Track`) — `gauge-track.svelte`

`<path d={arcPath} fill="none" stroke="currentColor" stroke-width={thickness} stroke-linecap="round"
vector-effect="non-scaling-stroke" class="text-muted-foreground/20">`.

| Prop         | Type                            | Default | Bindable |
| ------------ | ------------------------------- | ------- | -------- |
| `ref`        | `SVGPathElement \| null`        | `null`  | **yes**  |
| `class`      | `ClassValue`                    | —       | no       |
| `…restProps` | `SVGAttributes<SVGPathElement>` | —       | —        |

**Attributes**: `data-slot="gauge-track"`, `data-state`. **Snippets**: none. **Callbacks**: none.

### `GaugeRange` (`Range`) — `gauge-range.svelte`

Same path as `Track`, plus `stroke-dasharray={arcLength}` and `stroke-dashoffset` =
`indeterminate ? 0 : arcLength - percentage · arcLength`. Class
`text-primary transition-[stroke-dashoffset] duration-700 ease-out`.

| Prop         | Type                            | Default | Bindable |
| ------------ | ------------------------------- | ------- | -------- |
| `ref`        | `SVGPathElement \| null`        | `null`  | **yes**  |
| `class`      | `ClassValue`                    | —       | no       |
| `…restProps` | `SVGAttributes<SVGPathElement>` | —       | —        |

**Attributes**: `data-slot="gauge-range"`, `data-state`, `data-value`, `data-min`, `data-max`.

### `GaugeValueText` (`ValueText`) — `gauge-value-text.svelte`

`<div id={valueTextId} style="top: {arcCenterY}px;{caller style}">` containing `children ?? valueText`;
class `absolute right-0 left-0 flex -translate-y-1/2 items-center justify-center text-2xl font-semibold`.

| Prop         | Type                                             | Default | Bindable | Notes                                           |
| ------------ | ------------------------------------------------ | ------- | -------- | ----------------------------------------------- |
| `ref`        | `HTMLDivElement \| null`                         | `null`  | **yes**  |                                                 |
| `class`      | `ClassValue`                                     | —       | no       |                                                 |
| `style`      | `string \| undefined \| null`                    | —       | no       | Appended after `top:` so the caller wins (R-09). |
| `children`   | `Snippet`                                        | —       | no       | Takes precedence over the computed value text.  |
| `child`      | `Snippet<[{ props: GaugeValueTextChildProps }]>` | —       | no       | Replaces upstream `asChild`.                    |
| `…restProps` | `HTMLAttributes<HTMLDivElement>`                 | —       | —        |                                                 |

**Attributes**: `id`, `data-slot="gauge-value-text"`, `data-state`.

### `GaugeLabel` (`Label`) — `gauge-label.svelte`

`<div id={labelId}>` with the caller's children; class `mt-2 text-sm font-medium text-muted-foreground`.
Registers with the root so `aria-labelledby` is emitted, and unregisters on destroy.

| Prop         | Type                                         | Default | Bindable |
| ------------ | -------------------------------------------- | ------- | -------- |
| `ref`        | `HTMLDivElement \| null`                     | `null`  | **yes**  |
| `class`      | `ClassValue`                                 | —       | no       |
| `children`   | `Snippet`                                    | —       | no       |
| `child`      | `Snippet<[{ props: GaugeLabelChildProps }]>` | —       | no       |
| `…restProps` | `HTMLAttributes<HTMLDivElement>`             | —       | —        |

**Attributes**: `id`, `data-slot="gauge-label"`, `data-state`.

### `GaugeCombined` (`Combined`) — `gauge-combined.svelte`

`GaugeCombinedProps = WithoutChildrenOrChild<GaugeRootProps>`; renders
`Root > Indicator > (Track, Range)` + `ValueText`, forwarding `ref` and every root prop. No `label`
prop — upstream's MDX example is inconsistent with its own type and source (spec §Assumptions).

### Shared module exports (deliverable 5)

Added to `src/lib/components/ui/circular-progress/circular-progress.svelte.ts` and re-exported from
**both** barrels, so later arc components (`angle-slider`) reuse them:

| Export                                           | Kind | Purpose                                                        |
| ------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `Point`                                          | type | `{ x: number; y: number }`.                                    |
| `getNormalizedAngle(angle)`                      | fn   | `((angle % 360) + 360) % 360`.                                 |
| `polarToCartesian(cx, cy, r, angleDeg)`          | fn   | 0° at 12 o'clock, clockwise.                                   |
| `describeArc(x, y, r, startAngle, endAngle)`     | fn   | SVG `d`; `\|Δ\| >= 360` splits into two chained `A` segments.  |
| `getArcLength(r, startAngle, endAngle)`          | fn   | `(min(\|Δ\|, 360) / 360) · 2πr`.                               |
| `getArcCenterY(center, r, startAngle, endAngle)` | fn   | Visual vertical centre of the arc (upstream verbatim — R-03).  |

New in `src/lib/components/ui/gauge/gauge.svelte.ts`:

| Export                                                                                                         | Kind  | Purpose                                                                       |
| -------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------- |
| `GaugeState`                                                                                                   | type  | Alias of `ProgressState` — upstream's union name.                             |
| `DEFAULT_GAUGE_SIZE` (120), `DEFAULT_GAUGE_THICKNESS` (8), `DEFAULT_START_ANGLE` (0), `DEFAULT_END_ANGLE` (360) | const | Upstream defaults.                                                            |
| `getDefaultGaugeValueText(value, min, max)`                                                                    | fn    | Bare rounded percentage, no `%`.                                              |
| `GaugeRootState`                                                                                               | class | Runes state class; all derivations + label registration.                      |
| `setGaugeContext` / `getGaugeContext` / `hasGaugeContext`                                                      | fn    | Typed `Symbol` context; the getter throws ``…must be used within `<Gauge>`.`` |

## Project Structure

### Documentation (this feature)

```text
specs/008-port-gauge/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions R-01…R-19
├── data-model.md        # Phase 1 output — context shape, derivations, attribute projection
├── quickstart.md        # Phase 1 output — how to validate the port end to end
├── contracts/
│   └── public-api.md    # Phase 1 output — exact DOM/ARIA/data-attribute contract
├── checklists/
│   └── requirements.md  # from /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/gauge/
├── index.ts                     # barrel: short names + prefixed aliases + types + helpers
├── gauge.svelte                 # Root        ← Gauge
├── gauge-indicator.svelte       # svg         ← GaugeIndicator
├── gauge-track.svelte           # path        ← GaugeTrack
├── gauge-range.svelte           # path        ← GaugeRange
├── gauge-value-text.svelte      # div         ← GaugeValueText
├── gauge-label.svelte           # div         ← GaugeLabel
├── gauge-combined.svelte        # composition ← GaugeCombined
├── gauge.svelte.ts              # GaugeRootState + Symbol context + gauge defaults/helpers
├── gauge.test.svelte            # markup harness (NOT in registry.json, NOT collected by Vitest)
└── gauge.test.ts                # colocated tests (NOT in registry.json)

src/lib/components/ui/circular-progress/
├── circular-progress.svelte.ts  # EXTENDED: + Point, getNormalizedAngle, polarToCartesian,
│                                #            describeArc, getArcLength, getArcCenterY
└── index.ts                     # EXTENDED: re-exports the five new functions + Point

src/routes/docs/components/gauge/
└── +page.svelte                 # 5 <ComponentPreview> sections + props tables

registry.json                    # append exactly one registry:ui entry (10 files)
```

**Structure Decision**: one file per exported subcomponent, mapping 1:1 onto upstream:

| Upstream function                                        | This port                                        |
| -------------------------------------------------------- | ------------------------------------------------ |
| `Gauge`                                                  | `gauge.svelte`                                   |
| `GaugeIndicator`                                         | `gauge-indicator.svelte`                         |
| `GaugeTrack`                                             | `gauge-track.svelte`                             |
| `GaugeRange`                                             | `gauge-range.svelte`                             |
| `GaugeValueText`                                         | `gauge-value-text.svelte`                        |
| `GaugeLabel`                                             | `gauge-label.svelte`                             |
| `GaugeCombined`                                          | `gauge-combined.svelte`                          |
| `GaugeContext` + `useGaugeContext` + gauge-only helpers  | `gauge.svelte.ts`                                |
| `polarToCartesian`, `describeArc`, `getNormalizedAngle`  | `circular-progress.svelte.ts` (shared, FR-019)   |
| `getGaugeState`, `getIsValid*Number`, bounds/clamp maths | already in `circular-progress.svelte.ts` (reused) |

Folder slug `gauge` == registry item `name` == demo route segment
`src/routes/docs/components/gauge/` — the sidebar in `src/lib/registry.ts` filters on
`type === 'registry:ui'` and links to `/docs/components/<name>`.

Demo sections, one per upstream example file:

| Upstream demo                  | Section title | Content                                                                                                                                                                                                                                    |
| ------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gauge-demo.tsx`               | Default       | `value={85} size={180} thickness={12}`, `Label` with `class="sr-only"` reading "Performance".                                                                                                                                               |
| `gauge-sizes-demo.tsx`         | Sizes         | Three gauges (100/6, 140/10, 180/12) counting to 68 with a staggered `index × 150 ms` start; value text `text-xl`/`text-3xl`/`text-4xl`; sr-only labels + visible captions.                                                                  |
| `gauge-colors-demo.tsx`        | Colors        | Four gauges — CPU 45, Memory 68, Disk 92, Network 28 — counting up on a 20 ms interval, `size={120} thickness={10}`, semantic tokens `success`/`warning`/`destructive`/`info`, visible `Label`s.                                             |
| `gauge-variants-demo.tsx`      | Variants      | Semi (`-90 → 90`), Three Quarter (`-135 → 135`), Full Circle (`0 → 360`) at `size={140} thickness={10}`, counting to 72.                                                                                                                     |
| MDX "Layout" + `GaugeCombined` | Combined      | The one-line `Gauge.Combined` beside the equivalent manual composition at the same value.                                                                                                                                                    |

Two demo-level divergences, both recorded in research.md (R-13, R-14): `motion/react` is replaced by
`$state` + `setInterval`/`setTimeout` inside `$effect` with teardowns (zero new dependencies), and the
raw `emerald/amber/red/sky` palette is replaced by the project's semantic status tokens (Constitution
VIII). Every gauge in every demo keeps its upstream target value, so each section settles where upstream
settles.

## Phased Work Breakdown

| Phase | Deliverable                                                                                                                                                                             | Gate                                                                                                   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A     | Extend `circular-progress.svelte.ts` with `Point`, `getNormalizedAngle`, `polarToCartesian`, `describeArc`, `getArcLength`, `getArcCenterY`; re-export from `circular-progress/index.ts`. | Pure functions, no DOM; `circular-progress.test.ts` still green.                                        |
| B     | `gauge.svelte.ts` — gauge defaults, `getDefaultGaugeValueText`, `GaugeRootState` (all `$derived` + label counter), Symbol context trio.                                                   | Unit-testable in isolation.                                                                            |
| C     | `gauge.svelte` (Root) — `$props.id()` ids, dev diagnostics behind `import.meta.env.DEV` + `untrack`, ARIA + data attributes, `child` snippet.                                             | Root renders correct ARIA in both states.                                                              |
| D     | `gauge-indicator.svelte`, `gauge-track.svelte`, `gauge-range.svelte`.                                                                                                                    | `d`, `stroke-dasharray`, `stroke-dashoffset` match the reference values in contracts/public-api.md §10. |
| E     | `gauge-value-text.svelte` (inline `top` merge) + `gauge-label.svelte` (registration + `$effect` teardown).                                                                                | `aria-describedby` / `aria-labelledby` wire up.                                                        |
| F     | `gauge-combined.svelte` + `index.ts` barrel.                                                                                                                                             | `import * as Gauge` and named imports both resolve.                                                    |
| G     | `gauge.test.svelte` harness + `gauge.test.ts`.                                                                                                                                           | All test areas below green.                                                                            |
| H     | `src/routes/docs/components/gauge/+page.svelte`.                                                                                                                                         | Five preview sections + props tables.                                                                  |
| I     | `registry.json` entry (10 files incl. the shared module, no test files) + `pnpm run registry:build`.                                                                                       | `static/r/gauge.json` emitted with the targets listed in quickstart.md §2.                              |
| J     | `pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build`.                                                                                                                    | All gates green, no suppressions.                                                                      |

## Test Plan (constitution III / CLAUDE.md §7)

Colocated in `gauge.test.ts`, driving `gauge.test.svelte` for anything needing real markup. Helper
`bySlot(container, slot)` mirrors the `circular-progress`/`swap`/`stat` tests. Geometry expectations are
computed in the test from first principles (`2 * Math.PI * r * k`, hand-written `d` strings), never from
the component's own helpers, so the assertions stay independent of the implementation.

1. **Pure geometry helpers** — `getNormalizedAngle` (negative, > 360, exact multiples);
   `polarToCartesian` (0° = top, 90° = right, 180° = bottom, 270° = left); `describeArc` (single-`A`
   partial arc with large-arc flag `0` for `Δ <= 180` and `1` above; two-`A` form for `|Δ| >= 360`;
   degenerate `start === end`); `getArcLength` (full, half, three-quarter, zero, over-360 clamp);
   `getArcCenterY` (full circle → `center`; `-90 → 90`, `-135 → 135`, `0 → 90` → `center`, pinning the
   upstream formula per research R-03); `getDefaultGaugeValueText` (bare number, `max === min` → `100`).
2. **Roles and ARIA** — `role="meter"`; `aria-valuemin`/`aria-valuemax` always present;
   `aria-valuenow`/`aria-valuetext` present when determinate and **absent** when indeterminate;
   `aria-describedby` equals the value text's `id`; `aria-labelledby` equals the label's `id` when a
   `Gauge.Label` is rendered and is **absent** when it is not; the indicator is `aria-hidden="true"` and
   `focusable="false"`; the accessible name comes from the label.
3. **Keyboard** — the widget is non-interactive by design: the root has no `tabindex`, `user.tab()` from
   a preceding button lands on the following button (skipping the meter), and `Enter`/`Space`/arrow keys
   leave every attribute unchanged. The complete upstream key set (empty) is asserted, not assumed.
4. **Uncontrolled / default state** — no `value` ⇒ `data-state="indeterminate"`, no `aria-valuenow`, no
   `data-value`, no `data-percentage`, range `stroke-dashoffset === 0`, value text empty. Same for an
   explicit `value={null}`. Defaults verified: `size = 120`, `thickness = 8`, `startAngle = 0`,
   `endAngle = 360`, `min = 0`, `max = 100`.
5. **Controlled** — the parent is authoritative: `rerender({ value: n })` moves `aria-valuenow`,
   `aria-valuetext`, `data-value`, `data-percentage` and the range's `stroke-dashoffset`; a bound
   page-level `value` is untouched by any interaction (the component never writes it).
6. **Every prop** — `min`/`max` (incl. `max <= min ⇒ min + 1`, invalid `max ⇒ 100`, non-finite
   `min ⇒ 0`); `size`/`thickness` → `width`/`height`/`viewBox`/`stroke-width`; `startAngle`/`endAngle` →
   the exact `d` and `stroke-dasharray` for semi / three-quarter / full circle; `getValueText` custom
   formatter drives both the rendered text and `aria-valuetext`; `class` on each of the seven parts
   merges after the defaults; `restProps` (e.g. `data-testid`, `onclick`) reach the element.
7. **RTL** — the harness inside `<div dir="rtl">` produces byte-identical `d`, `stroke-dasharray`,
   `stroke-dashoffset`, `viewBox` and `class` to the LTR render (spec §Edge Cases).
8. **Guard rails** — `Indicator`, `Track`, `Range`, `ValueText` and `Label` each throw
   ``/must be used within `<Gauge>`/`` outside the root; `value > max` / `value < min` clamp;
   `thickness >= size` ⇒ `radius === 0`, no throw; `startAngle === endAngle` renders with
   `stroke-dasharray="0"`, no throw; `|Δ| > 360` clamps `arcLength` to the full circumference. Dev
   console output is silenced with `vi.spyOn(console, 'error'/'warn').mockImplementation(() => {})`.
9. **Svelte-specific** — `bind:ref` populates all six elements (`div`, `svg`, two `path`s, two `div`s);
   the `child` snippet on `Root`, `ValueText` and `Label` receives and applies the full attribute
   payload; `children` on `ValueText` beats the computed text; `Combined` renders the same DOM shape as
   the equivalent manual composition; `ValueText`'s inline `top` equals `arcCenterY` and a caller `style`
   is appended after it.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | —         | —          | —                                      |

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 (research.md, data-model.md, contracts/public-api.md, quickstart.md):

- **I** — the derivation pipeline in data-model.md contains no `$effect`; the single effect in the
  component is `Gauge.Label`'s de-registration teardown, and the only `$state` is the label counter.
  Demo timers each return their `clearInterval`/`clearTimeout`. PASS.
- **II** — contracts/public-api.md enumerates every upstream attribute per state, written by reading
  `gauge.tsx` line by line. The four divergences (`asChild` → `child`, `useId` → `$props.id()`,
  conditional `aria-labelledby`, demo animation/colour substitutions) are recorded in spec §Assumptions
  and research.md; the deliberately *non*-divergent upstream quirk (`getArcCenterY`'s 270°/90° extreme
  tests) is pinned by unit tests per research R-03. PASS.
- **III** — the ARIA matrix distinguishes determinate from indeterminate attribute by attribute; the Test
  Plan asserts both, plus the label association in its present and absent forms, plus the empty keyboard
  set and non-mirroring RTL. PASS.
- **IV** — the `bits-ui` rejection and the reuse-vs-bespoke split are written out above; the only new
  bespoke code is pure geometry and a ~6-line registration counter. PASS.
- **V** — the registry entry lists all nine gauge files plus the shared geometry module, so a standalone
  install compiles (quickstart.md §2 verifies the emitted targets and alias rewriting). No component file
  imports from `src/routes/**` or `$lib/components/docs/**`. PASS.
- **VI–X** — unchanged by the design phase: typing strategy fixed per part, gate sequence scheduled in
  Phase J, styling tokens and `data-slot`s fixed in contracts/public-api.md, one demo section per
  upstream example, all artifacts inside `specs/008-port-gauge/`. PASS.

**Gate result: PASS — proceed to `/speckit-tasks`.**
