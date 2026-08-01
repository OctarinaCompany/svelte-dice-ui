# Implementation Plan: Port Angle Slider

**Branch**: `040-port-angle-slider` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/040-port-angle-slider/spec.md`

## Summary

Port Dice UI's `angle-slider` — a circular dial that maps pointer angle and keyboard input onto one or
more numeric values — from React to Svelte 5, as a shadcn-svelte registry item with five composable
parts plus an internal hidden form input.

The technical approach: lift upstream's arithmetic (`atan2` → rotate by `startAngle` → percent of the
sweep → snap to `step` → clamp to `[min, max]` → sort → separation guard) **verbatim** into pure
exported functions in `angle-slider.svelte.ts`; replace upstream's hand-rolled pub/sub store and
`useSyncExternalStore` with a single runes state class shared through a `Symbol` context key; drive all
pointer work from DOM event handlers with pointer capture — never from an `$effect` — so the
measure-then-write feedback loop FR-020 warns about cannot form; resolve direction through this repo's
existing `direction-provider`; and port `visually-hidden-input.tsx` as a part file inside this
component's folder. No new npm dependencies.

Design details live in [research.md](./research.md) (13 decisions, 10 divergences),
[data-model.md](./data-model.md) and [contracts/angle-slider.api.md](./contracts/angle-slider.api.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict, `verbatimModuleSyntax`) on Svelte 5 with runes forced on
repo-wide via `vite.config.ts`

**Primary Dependencies**: SvelteKit 2, Tailwind CSS v4, `$lib/utils.js` (`cn`, `WithElementRef`),
`$lib/components/ui/direction-provider` (RTL resolution). `bits-ui` is a project dependency but
contributes nothing here — see the Principle IV justification below. **Zero new npm packages.**

**Storage**: N/A — no persistence; all state is component-local or caller-owned.

**Testing**: Vitest (jsdom) + `@testing-library/svelte` + `@testing-library/user-event`, colocated at
`src/lib/components/ui/angle-slider/angle-slider.test.ts` with a `.test.svelte` harness for
`bind:`, snippets, `dir="rtl"` wrappers and `<form>` ancestors. `expect.requireAssertions` is on;
`globals: false`.

**Target Platform**: Browsers with Pointer Events; SSR-safe (no DOM access during initialisation).

**Project Type**: shadcn-svelte registry component + its docs route in this SvelteKit app.

**Performance Goals**: pointer drag stays smooth at 60 fps — each `pointermove` does one
`getBoundingClientRect()`, one `atan2`, and at most one array write; no observers or listeners are
attached for the duration of a drag (pointer capture does that work).

**Constraints**: no `any`, no suppression comments, no Svelte 4 idioms, semantic Tailwind tokens only,
every part carries `data-slot`, the four quality gates must pass unsuppressed.

**Scale/Scope**: 6 `.svelte` part files + 1 runes module + 1 barrel + 1 test harness + 1 test file;
1 docs route with 5 preview sections and a props table; 1 `registry.json` entry.

## Constitution Check

_GATE: passed before Phase 0 research; re-checked after Phase 1 design (verdicts unchanged)._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                          |
| ---- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect`/`$props`/`$bindable` + snippets only; behaviour in `angle-slider.svelte.ts` as `AngleSliderRootState` with getter-function inputs; no store, no `export let`, no dispatcher, no `<slot>`. |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | Source, MDX and all 5 demos read at pinned `d9763d8`; every prop, callback, data attribute and default reproduced (contracts §1–§6); 10 divergences recorded in `spec.md` Assumptions and in `research.md`'s register. |
| III  | Accessibility Is a MUST             | PASS    | `role="slider"` + `aria-valuemin`/`aria-valuenow`/`aria-valuemax`/`aria-orientation` per thumb, `aria-disabled`/`aria-readonly`, `tabindex` removed only when disabled; WAI-ARIA keyboard map (contracts §8) incl. RTL inversion; all six `CLAUDE.md` §7 test areas scheduled in Phase 3. |
| IV   | Composition Over Reimplementation   | PASS    | `direction-provider` composed for RTL; bespoke dial logic justified in writing below.                                                                                                              |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file, `index.ts` barrel with short names + prefixed aliases + types, `.js` imports, one `registry:ui` entry, `pnpm run registry:build`; component imports nothing from `src/routes/**` or `$lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Props types exported from `<script lang="ts" module>`, derived from `WithElementRef<HTMLAttributes<…>>` / `SVGAttributes<…>`; `unknown` + narrowing where upstream used loose types; no `any`, no ignore comments, no config edits. |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit --run` → `build` scheduled as the final phase; no `.skip`/`.todo`.                                                                                        |
| VIII | Styling Discipline                  | PASS    | `cn()` with caller `class` last; `stroke-muted`/`stroke-primary`/`text-foreground`; upstream's `green-*`/`yellow-*`/`red-*`/`blue-*` theme demo mapped to `success`/`warning`/`destructive`/`info` tokens (research R-13); `data-slot` on all 6 parts; booleans as `? '' : undefined`. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/angle-slider/+page.svelte` with one `<ComponentPreview>` per upstream demo file (5) plus a props table; state held in the page with runes, no `+page.ts`.               |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/040-port-angle-slider/`; no git write commands; no writes to `.reference/`, `scripts/`, `.port-*`.                                                                       |

**Bespoke behaviour justification (Principle IV)**

| Behaviour                                        | Primitive evaluated                                    | Capability it lacks                                                                                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Circular value ↔ pointer mapping, thumb placement, arc rendering | `bits-ui` `Slider` (`Slider.Root/Range/Thumb`)          | Strictly one-dimensional: value maps to a fractional offset along a linear track, thumbs are positioned with `left`/`top` percentages, and there is no `startAngle`/`endAngle`, no polar hit-testing, and no arc geometry. Nothing about the dial can be expressed through it. |
| Arc `d` strings and polar conversion             | `$lib/components/ui/circular-progress` (exports `polarToCartesian`, `describeArc`) | Different coordinate frame: `radius = (size - thickness) / 2`, `centre = size / 2`, `0° = 12 o'clock`. Angle Slider uses `radius = size`, `centre = size + 20`, `0° = 3 o'clock`. Reusing it would silently resize the dial and rotate its zero, and would add a registry dependency on a display-only component. Re-derived against upstream's own frame (research R-03). |
| Keyboard value stepping                          | `bits-ui` `Slider` keyboard handling                    | Bound to the linear slider above; cannot be used without its geometry. The key map itself is 30 lines and is specified exactly by the MDX (contracts §8).                  |
| Hidden form input                                | `bits-ui` hidden inputs, `$lib/components/ui/input`      | bits-ui's are internal to its own primitives and not exported; `Input` is a visible styled control. Upstream's own `visually-hidden-input.tsx` is ported instead, per the task guidance (research R-09). |
| Direction resolution                             | —                                                       | **Not bespoke**: `useDirection()` from `direction-provider` is composed as-is.                                                                                             |

## Project Structure

### Documentation (this feature)

```text
specs/040-port-angle-slider/
├── plan.md                        # This file
├── spec.md                        # Input (amended this phase: 3 Assumptions + 2 corrected scenarios)
├── research.md                    # Phase 0 output — 13 decisions, 9-row divergence register
├── data-model.md                  # Phase 1 output — reactive state, invariants, transitions
├── quickstart.md                  # Phase 1 output — how to run and validate
├── contracts/
│   └── angle-slider.api.md        # Phase 1 output — the Public API, prop by prop
├── checklists/requirements.md     # From /speckit-specify
└── tasks.md                       # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/angle-slider/
├── index.ts                          # barrel: short names + prefixed aliases + every prop type + state/helpers
├── angle-slider.svelte               # Root      ← angle-slider.tsx:181-583  (AngleSlider)
├── angle-slider-track.svelte         # Track     ← angle-slider.tsx:585-649  (AngleSliderTrack)
├── angle-slider-range.svelte         # Range     ← angle-slider.tsx:651-708  (AngleSliderRange)
├── angle-slider-thumb.svelte         # Thumb     ← angle-slider.tsx:710-823  (AngleSliderThumb)
├── angle-slider-value.svelte         # Value     ← angle-slider.tsx:825-889  (AngleSliderValue)
├── angle-slider-hidden-input.svelte  # HiddenInput ← components/visually-hidden-input.tsx
├── angle-slider.svelte.ts            # ← angle-slider.tsx:30-159, 210-341 (helpers, Store, both contexts)
├── angle-slider.test.svelte          # prop-driven harness (bind:, snippets, dir, <form>) — not in registry
└── angle-slider.test.ts              # colocated tests

src/routes/docs/components/angle-slider/
└── +page.svelte                      # 5 <ComponentPreview> sections + props table

registry.json                         # append exactly one registry:ui entry
```

**Structure Decision**

Six parts, one file each, named `<slug>-<part>.svelte` with the root at `<slug>.svelte`, matching
`circular-progress/` and `gauge/` in this repo. Upstream's two React contexts (`StoreContext` for
mutable state, `SliderContext` for `dir`/`name`/`form`) collapse into **one** `AngleSliderRootState`
on a single `Symbol` key — the split exists only because React's `useSyncExternalStore` cannot
subscribe to a plain context value, which is not a constraint in Svelte (research R-04). Upstream's
utility hooks (`useComposedRefs`, `useLazyRef`, `useIsomorphicLayoutEffect`, `useAsRef`) have no
ported counterpart; `bind:this`, `$state` and `$effect.pre` cover them natively.

`angle-slider` is simultaneously the folder slug, the `registry.json` `name`, and the demo route
segment `src/routes/docs/components/angle-slider/` — confirmed identical.

`angle-slider.test.svelte` is a harness, not a component: Vitest's `include` is `.{js,ts}` so it is
never collected, and it is deliberately **absent** from `registry.json` alongside the test file.

## Implementation Phases

Ordered so each phase is independently verifiable. `/speckit-tasks` expands these into `tasks.md`.

### Phase A — Pure arithmetic (`angle-slider.svelte.ts`), no DOM

Port `clamp`, `getDecimalCount`, `roundValue`, `snapToStep`, `getNextSortedValues`,
`getStepsBetweenValues`, `hasMinStepsBetweenValues`, `getClosestValueIndex`, `getTotalAngle`,
`getValueFromPointer`, `getAngleFromValue`, `getPositionFromAngle`, `describeAngleArc`, plus the
`DEFAULT_*` constants. Each carries a JSDoc naming its upstream line range. These are exported and
testable without rendering anything — the quadrant table in research R-01 is asserted here first,
before a single component exists.

### Phase B — `AngleSliderRootState` + context

The state class (data-model §1–§4), `setAngleSliderContext` / `hasAngleSliderContext` /
`getAngleSliderContext(consumerName?)` on a `Symbol('angle-slider')` key, with the throwing getter
whose message names both the part and the provider.

### Phase C — Parts

Root (props, direction, event handlers, context publication, `child` snippet) → Track → Range →
Thumb (+ registration effect, ARIA, hidden input) → Value → HiddenInput → `index.ts` barrel.

### Phase D — Tests (`angle-slider.test.ts` + `angle-slider.test.svelte`)

All six `CLAUDE.md` §7 areas. Notable requirements captured during research:

- **jsdom returns a zero-size `getBoundingClientRect()`**, so every pointer test must stub the root's
  rect before dispatching; without the stub the R-08 guard correctly makes every drag a no-op and the
  test would pass vacuously while asserting nothing about the arithmetic.
- Pointer tests cover **all four quadrants and the 0/360 seam** against research R-01's table.
- Keyboard tests cover every row of contracts §8, with and without `Shift`, plus `inverted` and RTL.
- `disabled` / `readOnly` are asserted on **both** the pointer and the keyboard path (SC-007).
- Teardown assertions must be non-vacuous: assert the registry shrank / the observer disconnected,
  not merely that a callback was not called after unmount.
- Each part rendered outside `<AngleSlider.Root>` throws the documented error.

### Phase E — Docs route

`src/routes/docs/components/angle-slider/+page.svelte`: five `<ComponentPreview>` sections — Default,
Controlled, Range, Themes, Form — plus a props table built from `$lib/components/ui/table`, matching
the layout of `docs/components/circular-progress`. Demo-only substitutions per research R-13.

### Phase F — Registry entry

Append to `registry.json` (position: last, after `stack`):

```jsonc
{
	"name": "angle-slider",
	"type": "registry:ui",
	"title": "Angle Slider",
	"description": "An interactive circular slider for selecting angles with support for single values and ranges.",
	"registryDependencies": ["direction-provider"],
	"dependencies": [],
	"files": [
		{ "path": "src/lib/components/ui/angle-slider/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/angle-slider/angle-slider.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/angle-slider/angle-slider-track.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/angle-slider/angle-slider-range.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/angle-slider/angle-slider-thumb.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/angle-slider/angle-slider-value.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/angle-slider/angle-slider-hidden-input.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/angle-slider/angle-slider.svelte.ts", "type": "registry:ui" }
	]
}
```

`registryDependencies` is `["direction-provider"]` because the root imports `useDirection` from it;
it is an existing `registry:ui` item. `dependencies` is empty — nothing outside the repo is needed.
Then `pnpm run registry:build`.

### Phase G — Quality gates

`pnpm run format` → `pnpm run check` → `pnpm run lint` → `pnpm run test:unit -- --run` →
`pnpm run build`, all green with no suppressions.

## Shared modules this component exports for later reuse

| Export                                             | From                                              | Why it is worth reusing                                                                             |
| -------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `HiddenInput` / `AngleSliderHiddenInput` + its props type | `angle-slider-hidden-input.svelte`, via the barrel | The port of upstream's shared `components/visually-hidden-input.tsx`. Several unported Dice UI components import it. It stays inside this folder for now (task guidance, research R-09); the moment a second component needs it, it moves to `src/lib/components/ui/visually-hidden-input/` and becomes a `registryDependencies` entry for both. |
| The pure arithmetic helpers + `AngleSliderGeometry` | `angle-slider.svelte.ts`, via the barrel           | Polar value mapping, step snapping and the multi-thumb separation guard are reusable by any future radial control; exporting them also makes them directly unit-testable (Phase A). |
| `AngleSliderRootState`, `get/set/hasAngleSliderContext` | `angle-slider.svelte.ts`, via the barrel        | The Svelte equivalent of upstream's exported `useStore as useAngleSlider`, so a consumer can build their own part.                                                                    |

## Amendments made to `spec.md` in this phase

Constitution II requires every divergence to live in the spec's Assumptions. Three were added, and two
acceptance scenarios that contradicted the upstream formula were corrected:

1. **Keyboard direction** (research R-06, D-02): the upstream *source* makes `ArrowUp`/`PageUp`
   decrease; the upstream *MDX*, spec FR-010 and WAI-ARIA all make them increase. The MDX wins.
2. **`Home`/`End` target** (D-03): act on the active thumb rather than on index `0` / the last index.
3. **Centre-of-dial guard** (D-04) and the `aria-hidden`/`aria-disabled` additions (D-05, D-07).
4. **Acceptance scenarios US1-1 and US1-2** (D-09) asserted `0°` for a pointer directly right of
   centre and `90°` for directly below. Under upstream's formula with the default `startAngle = -90`
   those positions are `90°` and `180°` — the original numbers were off by one quadrant and would
   have been baked into the test suite.

## Complexity Tracking

> No Constitution Check violations. Every principle is PASS, and the one place bespoke code was
> unavoidable (Principle IV) is justified in writing in the table above rather than carried as a
> violation. This section is intentionally empty.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | none      | —          | —                                      |
