# Phase 0 Research — Gauge port

**Feature**: `008-port-gauge` | **Date**: 2026-07-29

Upstream material read at the pinned commit (`d9763d82530416dfa4c81c462387b55d06bae4ec`):

| File                                                                     | What it fixed                                              |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `.reference/diceui/docs/registry/bases/radix/ui/gauge.tsx`               | The whole implementation: 6 parts + `GaugeCombined`, math   |
| `.reference/diceui/docs/content/docs/components/radix/gauge.mdx`         | API contract, data-attribute tables, accessibility notes    |
| `.reference/diceui/docs/registry/bases/radix/examples/gauge-demo.tsx`    | Default composition (`value=85 size=180 thickness=12`)      |
| `.../examples/gauge-sizes-demo.tsx`                                      | Three size presets + `motion/react` entrance animation      |
| `.../examples/gauge-colors-demo.tsx`                                     | Four palette themes + counting-up interval                  |
| `.../examples/gauge-variants-demo.tsx`                                   | Semi / three-quarter / full-circle arcs                     |

Local precedent read: `src/lib/components/ui/circular-progress/**` (the direct ancestor of this
component), `src/lib/components/ui/swap`, `src/lib/components/ui/stat`, `CLAUDE.md`,
`.specify/memory/constitution.md`, `.agents/skills/shadcn-svelte/rules/{styling,composition,forms,icons}.md`.

No `[NEEDS CLARIFICATION]` markers remain in `spec.md`; every open question below is resolved here.

---

## R-01 — Root element: bespoke, `bits-ui` has no meter primitive

**Decision**: hand-write the root `<div role="meter">`.

**Rationale**: `bits-ui` 2.18 ships no `Meter` primitive. The closest, `Progress.Root`, was already
evaluated and rejected for `circular-progress` (007 research R-01) and fails harder here: it emits
`role="progressbar"` (not `meter`), its `data-state` vocabulary is `loading | loaded | indeterminate`
(upstream requires `complete`, and its `mergeProps` makes state props win so a caller cannot override),
it has no `aria-valuetext` / `getValueText` hook, no `data-percentage`, and performs no clamping. The
root is ~30 lines of pure derivation with no focus management, portal, positioning or dismissal — none
of the liabilities Principle IV exists to prevent.

**Alternatives considered**: `Progress.Root` (above); the installed `ui/progress` component (a linear
bar built on `Progress.Root`, same objections plus no SVG).

## R-02 — Geometry reuse: import from `circular-progress`, extend it in place

**Decision**: `getRingGeometry(size, thickness)` is imported from
`$lib/components/ui/circular-progress/circular-progress.svelte.js`. The four functions this port needs
and that do not exist anywhere yet — `getNormalizedAngle`, `polarToCartesian`, `describeArc`,
`getArcLength`, `getArcCenterY` — are **added to that same module** and re-exported from both barrels.

**Rationale**: FR-019 and spec §Assumptions require reuse rather than duplication, and require the new
angle math to be reusable, unit-testable free functions rather than inline component code. Colocating
them with `getRingGeometry` gives one geometry module for every ring/arc component (`gauge` today,
`angle-slider` later) instead of a second, competing one.

**Registry consequence (important)**: a consumer installing `gauge` alone must still receive that file.
`registry.json`'s gauge entry therefore lists
`src/lib/components/ui/circular-progress/circular-progress.svelte.ts` as an extra `registry:ui` file
(target `circular-progress/circular-progress.svelte.ts`), and gauge imports it through the `$lib`
alias, which `shadcn-svelte registry build` rewrites to the `$UI$` placeholder (verified: `$lib/utils.js`
→ `$UTILS$.js` in `static/r/circular-progress.json`).

**Alternatives considered**:

- `registryDependencies: ["circular-progress"]` — rejected: bare names resolve against the upstream
  shadcn-svelte registry, which has no `circular-progress` item; a URL form would need a served
  registry endpoint, and `homepage` is a GitHub repo URL, not one.
- A new shared `src/lib/components/ui/_geometry/` module — rejected: Principle V fixes the folder
  layout at one folder per component; a hidden shared folder has no registry item and no docs route.
- Duplicating the maths in `gauge.svelte.ts` — explicitly forbidden by the feature invocation.

## R-03 — `getArcCenterY` is ported verbatim, including upstream's extreme-angle tests

**Decision**: reproduce upstream's `arcCenterY` computation exactly, including the `includesTop` /
`includesBottom` predicates that test whether the sweep crosses **270°** and **90°**.

**Rationale**: with `y = center - radius·cos(θ)` the true vertical extremes of the circle are at
θ = 0° (top) and θ = 180° (bottom), so upstream's 270°/90° tests are literally checking the *horizontal*
extremes. Changing them would change rendered output. For every arc the component documents the two
formulas agree anyway, because all documented sweeps are symmetric about the vertical axis:

| Sweep                        | Upstream `arcCenterY` | Where the value text lands           |
| ---------------------------- | --------------------- | ------------------------------------ |
| `0 → 360` (full circle)      | `center`              | geometric centre (early-return path) |
| `-90 → 90` (semi circle)     | `center`              | on the diameter — the classic dial   |
| `-135 → 135` (three quarter) | `center`              | geometric centre                     |
| `0 → 180`                    | `center`              | geometric centre                     |

Principle II is non-negotiable and there is no visual defect to fix in the documented cases, so the
formula ships as-is. Recorded here so that a future upstream fix is mirrored rather than re-discovered.
The unit tests assert the upstream values (including the asymmetric `0 → 90` case, `center`), so the
behaviour is pinned rather than accidental.

**Alternatives considered**: "fixing" the predicates to 0°/180° — rejected, it silently moves the value
text in the semi-circle demo (to `center - radius/2`) and diverges from upstream with no spec mandate.

## R-04 — `data-state` / value pipeline is shared with `circular-progress`

**Decision**: reuse `ProgressState`, `getProgressState`, `resolveProgressBounds`, `clampProgressValue`,
`getProgressPercentage`, `isValidNumber`, `isValidMaxNumber`, `isValidValueNumber` verbatim from
`circular-progress.svelte.ts`; export `type GaugeState = ProgressState` from the gauge barrel for the
upstream-facing name.

**Rationale**: upstream's `gauge.tsx` and `circular-progress.tsx` contain byte-identical copies of
`getGaugeState`/`getProgressState`, `getIsValid*Number`, the `max`/`min` correction and the percentage
formula. One implementation, one set of tests. Upstream's local type name `GaugeState` is not exported
upstream, but is kept as an alias so the union has the name a Dice UI reader expects.

**Divergence, recorded**: `getDefaultValueText` is **not** shared — upstream's gauge default returns a
bare rounded percentage (`"45"`) while circular-progress's appends `%`. Gauge gets its own
`getDefaultGaugeValueText`.

## R-05 — Naming: `GaugeState` (type) vs `GaugeRootState` (class)

**Decision**: the runes state class is `GaugeRootState`; `GaugeState` is the `indeterminate | loading |
complete` union.

**Rationale**: upstream uses `GaugeState` for the union. Reusing that name for the class would shadow
it and break the parity of the type name; `CircularProgressState` (the class) has no such clash because
its union is called `ProgressState`.

## R-06 — `aria-labelledby` is conditional on a rendered `Gauge.Label`

**Decision**: `Gauge.Label` registers itself with the root state on init and unregisters on destroy; the
root emits `aria-labelledby` only while at least one label is registered.

**Rationale**: upstream emits `aria-labelledby={labelId}` unconditionally, even though `GaugeLabel` is
documented as optional — a dangling IDREF that leaves the meter with an empty accessible name whenever
the label is omitted (which the default `GaugeCombined` composition always does). Constitution III
requires correct label associations, and FR-006 states the conditional behaviour explicitly. This is a
deliberate, spec-mandated divergence from upstream.

**Implementation**: `registerLabel()` / `unregisterLabel()` on a `#labelCount = $state(0)` field.
Registration is **synchronous in the label's instance script** (so the attribute is correct on first
client render, not one effect-flush later); de-registration is an `$effect` teardown. Writing to parent
state during child initialisation is legal in Svelte 5 — it is not a write inside a `$derived` — and the
root's `$derived` attribute payload is invalidated and re-applied in the same flush. Fallback, if a
`state_unsafe_mutation` ever surfaces: move `registerLabel()` into the same `$effect` and have the tests
`await tick()`. The tests assert the attribute both with and without a label, so either path is pinned.

**Not extended to `aria-describedby`**: FR-006 conditions it on *a value text existing* (upstream
behaviour, and the `circular-progress` precedent), not on `Gauge.ValueText` being rendered. `ValueText`
is part of every documented composition including `Combined`, so no dangling reference occurs in
practice.

## R-07 — `asChild` → `child` snippet, on `Root`, `ValueText` and `Label`

**Decision**: the three upstream parts typed `DivProps` (`asChild?: boolean`) get an optional
`child?: Snippet<[{ props }]>`; the SVG parts (`Indicator`, `Track`, `Range`) do not, matching upstream,
which types them as plain `svg`/`path` props with no `asChild`.

**Rationale**: Svelte has no `Slot`/`cloneElement`. The `child` snippet is the bits-ui pattern already
used by `dialog-content.svelte` and by `circular-progress` (007 R-05). In `child` mode `children` are
not rendered and `ref` stays `null`, exactly as in the precedent. Each `child` payload gets its own
exported type (`GaugeChildProps`, `GaugeValueTextChildProps`, `GaugeLabelChildProps`).

## R-08 — `React.useId()` → `$props.id()`

**Decision**: one `$props.id()` in the root, suffixed into `${uid}-label` and `${uid}-value-text`.

**Rationale**: identical to 007 R-06 — SSR-stable, unique per instance, no `crypto` access.

## R-09 — `GaugeValueText` inline `top` must merge with a caller `style`

**Decision**: destructure `style` out of the props and emit
`style={`top: ${arcCenterY}px;${style ?? ''}`}`.

**Rationale**: upstream writes `style={{ top: `${arcCenterY}px`, ...style }}` — the caller's style wins.
In Svelte the same attribute cannot be both computed and spread, so `style` is pulled out of
`restProps` explicitly and appended last (later declarations win in a CSS declaration list). Positioning
stays inline rather than becoming a Tailwind class because the value is a runtime pixel number.

## R-10 — Indicator has **no** `-rotate-90`

**Decision**: the `<svg>` keeps upstream's bare `transform` class.

**Rationale**: `circular-progress` rotates the SVG so a `<circle>`'s dash sweep starts at 12 o'clock.
Gauge does not need that: `polarToCartesian` already subtracts 90° so 0° *is* 12 o'clock in the path
data. Copying the rotation would rotate every gauge a quarter turn.

## R-11 — Indeterminate `stroke-dashoffset` is `0`, not a spinner

**Decision**: `state === 'indeterminate'` → `stroke-dashoffset = 0` (full arc drawn), verbatim upstream.
No `@keyframes`, no scoped `<style>` block, no `prefers-reduced-motion` handling in the component.

**Rationale**: upstream's gauge has no indeterminate animation (unlike `circular-progress`, whose range
spins). The only motion is the `transition-[stroke-dashoffset] duration-700 ease-out` on the range,
which is a CSS transition and is already respected by user agents/`motion-reduce` at the consumer's
discretion. Adding a spinner would be undocumented drift.

## R-12 — SVG element typing

**Decision**: `Indicator` declares `ref?: SVGSVGElement | null` and `SVGAttributes<SVGSVGElement>`;
`Track`/`Range` declare `ref?: SVGPathElement | null` and `SVGAttributes<SVGPathElement>`. They do not
use `WithElementRef`.

**Rationale**: `WithElementRef<T, U extends HTMLElement>` cannot express an SVG element (007 R-03).

## R-13 — Demos without `motion/react`

**Decision**: the Sizes demo's `useInView` + `useSpring` entrance animation and the Colors/Variants
demos' counting intervals are reproduced with `$state` + `setInterval`/`setTimeout` inside `$effect`,
each returning its `clearInterval`/`clearTimeout` teardown.

**Rationale**: zero-new-dependency constraint; `motion` is not a dependency of this repo and the
animation is demo-only embellishment, not part of the component API. The staggered start (index × 150 ms)
and the final values (68 / 45,68,92,28 / 72) are preserved so each demo settles where upstream settles.

## R-14 — Demo colours use semantic tokens

**Decision**: upstream's `emerald / amber / red / sky` swatches map to `success / warning / destructive /
info`, e.g. `text-success/20` (track), `text-success` (range and value text).

**Rationale**: Constitution VIII forbids raw palette colours and manual `dark:` overrides; the tokens
already flip with the theme. The component itself is unaffected — it renders whatever class the caller
passes, which is precisely what the demo proves.

## R-15 — RTL

**Decision**: no mirroring. The RTL test renders the harness inside `<div dir="rtl">` and asserts the
path `d`, `stroke-dasharray`, `stroke-dashoffset`, `viewBox` and classes are byte-identical to the LTR
render.

**Rationale**: spec §Edge Cases and §Assumptions — angles are absolute geometry (clockwise degrees from
12 o'clock), not a logical direction, and upstream applies no direction logic. A plain `dir` attribute
is used rather than `direction-provider` because the assertion is about ambient text direction, and it
keeps the test harness free of a cross-component import.

## R-16 — Dev-only diagnostics

**Decision**: reproduce all three upstream `console.error`/`console.warn` messages (invalid `max`,
invalid `value`, `thickness >= size`) verbatim with `Gauge` as the component name, guarded by
`import.meta.env.DEV` and wrapped in `untrack()` so they are one-shot reads of the initial props.

**Rationale**: documented upstream behaviour (MDX §Notes) and the `circular-progress` precedent (007
R-08). Tests that exercise invalid input silence them with
`vi.spyOn(console, 'error').mockImplementation(() => {})`.

## R-17 — Degenerate sweeps

**Decision**: no special-casing. `startAngle === endAngle` produces `arcLength = 0` and a `d` of
`M x y A r r 0 0 1 x y` (start and end coincide) — an invisible but valid path. `thickness >= size`
floors `radius` at `0` via `getRingGeometry` and still renders. `|Δ| >= 360` takes upstream's
two-semicircle branch.

**Rationale**: spec §Edge Cases requires "renders without throwing", which the upstream maths already
satisfies; adding guards would diverge. All three cases are asserted.

## R-18 — Test harness

**Decision**: a `gauge.test.svelte` harness (not collected by Vitest, not in `registry.json`) carries
everything a `.ts` spec cannot express: composition, `bind:ref` on all six elements, `child` snippets
with typed payloads, `children` overrides, per-part `class` overrides and the `dir="rtl"` wrapper —
mirroring `circular-progress.test.svelte`.

## R-19 — Where the new geometry helpers are tested

**Decision**: the unit tests for `getNormalizedAngle`, `polarToCartesian`, `describeArc`, `getArcLength`
and `getArcCenterY` live in `src/lib/components/ui/gauge/gauge.test.ts`, importing them through the
gauge barrel, even though the functions' source file sits in the `circular-progress` folder.

**Rationale**: they are added by this feature (FR-019) and only this feature uses them; keeping their
assertions with the feature that owns them keeps the traceability from `tasks.md` intact.
`circular-progress.test.ts` is left untouched, so its green state independently proves the shared module
was extended without regression.
