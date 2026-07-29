# Implementation Plan: Port Circular Progress Component

**Branch**: `007-port-circular-progress` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-port-circular-progress/spec.md`

## Summary

Port Dice UI's `circular-progress` (radix base) to Svelte 5 as a six-part compound component under
`src/lib/components/ui/circular-progress/`. The root is a `div` with `role="progressbar"` that validates
and clamps `value` against `min`/`max`, derives the ring geometry (`radius`, `center`, `circumference`)
from `size`/`thickness`, classifies the reading as `indeterminate` / `loading` / `complete`, and publishes
all of it on a typed `Symbol` context. `Indicator` (an `<svg>`), `Track` and `Range` (two `<circle>`s) and
`ValueText` (a `<span>`) read that context; `Combined` is a fixed composition of all five.

The accessibility contract is the point of the component and is reproduced exactly: `aria-valuemin` /
`aria-valuemax` / `aria-valuetext` always, `aria-valuenow` **only** when the value is a valid finite
number, `aria-describedby` → the value text, `aria-labelledby` → the optional rendered `label`.

Three upstream-only React affordances are translated rather than transliterated: `asChild`/`Slot` → the
`child` snippet, `React.useId()` → `$props.id()`, and the `@theme`-injected `--animate-spin-around`
keyframes → a component-scoped `<style>` block on the range part, so the component animates out of the box
with no consumer edit to `app.css`.

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`) + Svelte 5.56 (runes forced on)

**Primary Dependencies**: SvelteKit 2, Tailwind CSS v4, `tailwind-merge`/`clsx` via `cn()`,
`tailwind-variants` (only if a part needs variants — it does not here), `bits-ui` 2.18 (evaluated, not
used for this component — see Constitution Check IV). **Zero new npm dependencies.**

**Storage**: N/A

**Testing**: Vitest 4 (jsdom) + `@testing-library/svelte` 5 + `@testing-library/user-event` 14, colocated
at `src/lib/components/ui/circular-progress/circular-progress.test.ts` with a `.test.svelte` harness for
markup-level composition, `bind:ref`, snippets and `dir="rtl"`.

**Target Platform**: Browser (SSR-safe: no `window` access at module or init scope) — SvelteKit docs app
plus any consumer project that installs the registry item.

**Project Type**: shadcn-svelte registry component (source distribution) + docs route.

**Performance Goals**: All progress-derived values are `$derived` (pure math, no effects, no observers, no
timers). Re-render on `value` change touches only the two `<circle>` geometry attributes and the value
text node.

**Constraints**: No `any`, no suppression comments, no `dark:` overrides, no raw palette colours in the
component (the docs page's "Colors" demo uses semantic status tokens instead of upstream's raw palette —
see Structure Decision). No `$effect` where `$derived` suffices — this component needs **no** `$effect`
at all.

**Scale/Scope**: 7 source files + 1 barrel + 1 test + 1 test harness + 1 docs route + 1 registry entry.
~5 exported components, 8 root props, 5 data attributes, 6 ARIA attributes.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                              |
| ---- | ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$props` + `$bindable(null)` for `ref`, `$derived`/`$derived.by` for every computed value, `Snippet` + `{@render}` for `children`/`child`. No stores, no `export let`, no `createEventDispatcher`, no `<slot>`. Zero `$effect` needed.                  |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `circular-progress.tsx`, `circular-progress.mdx`, `types/radix/circular-progress.ts` and all three `circular-progress-*-demo.tsx` read at the pinned commit. Every prop, part, data attribute and ARIA attribute is reproduced; divergences in §Assumptions of spec.md and in research.md. The `radix` base is used per the invocation's explicit ground truth (not the `base` path Principle II names); the two variants were diffed and differ only in the `asChild`/`render` polymorphism primitive (Slot vs. `useRender`/`mergeProps`), so no functionality is lost — Principle II's stated path should be generalised to `bases/<base>/` in the next constitution amendment. |
| III  | Accessibility Is a MUST             | PASS    | `role="progressbar"` + `aria-valuemin`/`aria-valuemax`/`aria-valuetext` always, `aria-valuenow` only when determinate, `aria-labelledby`/`aria-describedby` wired to generated ids. Keyboard set is empty by design (non-focusable widget) and is asserted as such. RTL asserted. |
| IV   | Composition Over Reimplementation   | PASS    | `bits-ui` `Progress.Root` evaluated and rejected with a written reason below; nothing else in `src/lib/components/ui/*` covers ring geometry. All remaining logic is pure math in a `.svelte.ts` module.                                                |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file, `<slug>-<part>.svelte` naming, `circular-progress.svelte.ts` for logic, `index.ts` barrel with short names + prefixed aliases + types, `.js` extensions on intra-repo imports, one `registry:ui` entry, no docs imports. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Props typed from `HTMLAttributes<HTMLDivElement>` / `SVGAttributes<SVGSVGElement>` / `SVGAttributes<SVGCircleElement>` / `HTMLAttributes<HTMLSpanElement>`. No `any`, no `@ts-*`, no `eslint-disable`, no `svelte-ignore`, no config changes.           |
| VII  | Green Gate Before Commit            | PASS    | `pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final task; no test skipped, every `it` asserts.                                                                                                                |
| VIII | Styling Discipline                  | PASS    | `cn()` with caller `class` merged last on all five parts; semantic tokens only (`text-muted-foreground/20`, `text-primary`); `data-slot="circular-progress[-part]"` on every part; `data-state`/`data-value`/`data-min`/`data-max`/`data-percentage` exposed. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/circular-progress/+page.svelte` with one `<ComponentPreview>` per upstream demo file (`-demo`, `-interactive-demo`, `-colors-demo`) plus the MDX "Layout"/"Combined" snippets and a props table.                            |
| X    | One Feature Directory Per Component | PASS    | All planning artifacts written to `specs/007-port-circular-progress/`; no git write commands; no touching `.reference/`, `scripts/`, `.port-state.json`.                                                                                                |

**Bespoke behaviour justification (Principle IV)**:

- **Root progressbar semantics — bespoke, `bits-ui` `Progress.Root` rejected.** `Progress.Root`
  (`node_modules/bits-ui/dist/bits/progress/progress.svelte.js`) does emit `role="progressbar"`,
  `aria-valuemin/max/now`, `data-value`, `data-min`, `data-max` and omits `aria-valuenow` when
  `value === null`. It nevertheless cannot be composed here, for four concrete reasons:
  1. Its `data-state` values are `"loading" | "loaded" | "indeterminate"`; upstream Dice UI (and spec
     FR-005) requires `"complete"`, not `"loaded"`. Its component merges `mergeProps(restProps,
     rootState.props)` — **state props win** — so `data-state` cannot be overridden by a caller.
  2. It has no `aria-valuetext`, no `getValueText` hook and no `data-percentage`.
  3. It performs no clamping and no `max`/`min` validation (FR-007, FR-008); an out-of-range `value` is
     forwarded verbatim to `aria-valuenow`.
  4. It renders a stray `value={number}` attribute onto the `div`, which is not part of the upstream DOM
     contract and would show up in DOM-shape assertions.
  Writing the root by hand is ~25 lines of pure derivation with no focus management, no portal, no
  positioning and no dismissal — none of the liabilities Principle IV exists to prevent.
- **Ring geometry (`radius`/`center`/`circumference`/`stroke-dasharray`/`stroke-dashoffset`) — bespoke.**
  Nothing in `bits-ui` or `src/lib/components/ui/*` draws an SVG ring; the installed `progress` component
  is a linear bar built on `Progress.Root`. This is four lines of arithmetic, extracted as exported pure
  functions so later ports (`gauge`, `angle-slider`) reuse them instead of re-deriving them.
- **Indeterminate spin animation — component-scoped `<style>`, not a global `@theme` entry.** Upstream
  requires the consumer to paste `--animate-spin-around` + `@keyframes spin-around` into `globals.css`.
  `src/app.css` currently declares no `@keyframes` at all, and spec §Assumptions ("Animation delivery")
  fixes this port to a self-contained component. Svelte scopes `@keyframes` declared in a component's
  `<style>` block and rewrites the matching `animation:` declaration, so the keyframes must live in the
  same file as the rule that uses them — `circular-progress-range.svelte`. `prefers-reduced-motion` is
  handled by a `@media` block in that same style, which is exactly what upstream's
  `motion-reduce:animate-none motion-safe:[animation:…]` pair compiles to.
- **`useReducedMotion()` from `src/lib/components/ui/swap/swap.svelte.ts` — evaluated, not used.** It
  exists and is reusable, but reduced motion here is a pure CSS concern; importing a runtime matchMedia
  reader would add a cross-component registry dependency and a reactive subscription for zero benefit.

## Public API

Everything below is derived from `.reference/diceui/docs/registry/bases/radix/ui/circular-progress.tsx`
and `.reference/diceui/docs/types/radix/circular-progress.ts` at the pinned commit. The full machine-
readable contract, including exact attribute output per state, lives in
[contracts/public-api.md](./contracts/public-api.md).

### `CircularProgress` (`Root`) — `circular-progress.svelte`

Renders a `div` (or the caller's element via `child`).

| Prop           | Type                                                   | Default            | Bindable | Notes                                                                              |
| -------------- | ------------------------------------------------------ | ------------------ | -------- | ---------------------------------------------------------------------------------- |
| `ref`          | `HTMLDivElement \| null`                               | `null`             | **yes**  | `bind:this`; stays `null` in `child` mode.                                          |
| `value`        | `number \| null \| undefined`                          | `null`             | no       | `null`/`undefined` ⇒ indeterminate. Out-of-range values are clamped (FR-007).       |
| `getValueText` | `(value: number, min: number, max: number) => string`  | `getDefaultValueText` | no    | Default is `` `${Math.round(percentage)}%` ``.                                       |
| `min`          | `number`                                               | `0`                | no       | A non-finite `min` falls back to `0`.                                               |
| `max`          | `number`                                               | `100`              | no       | Non-finite or `<= 0` ⇒ `100`; `<= min` ⇒ `min + 1` (FR-008).                         |
| `size`         | `number`                                               | `48`               | no       | SVG width/height/viewBox, in px.                                                    |
| `thickness`    | `number`                                               | `4`                | no       | `stroke-width` of both circles, in px.                                              |
| `label`        | `string \| undefined`                                  | `undefined`        | no       | When set, renders `<div id={labelId}>{label}</div>` and wires `aria-labelledby`.     |
| `class`        | `ClassValue`                                           | —                  | no       | Merged **last** through `cn()`.                                                     |
| `children`     | `Snippet`                                              | —                  | no       | The composed parts.                                                                 |
| `child`        | `Snippet<[{ props: CircularProgressChildProps }]>`     | —                  | no       | Replaces upstream `asChild`. Receives every attribute to spread; `children`/`label` are not rendered. |
| `…restProps`   | `HTMLAttributes<HTMLDivElement>`                       | —                  | —        | Spread onto the element, after the component's own attributes (upstream order).      |

**Snippets**: `children`, `child`. **Callbacks/events**: none — upstream exposes no `onValueChange`; the
component is display-only and never writes to `value` (see research.md, decision R-04). Standard DOM
handlers pass through `restProps`.

**Emitted attributes**: `role="progressbar"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`
(determinate only), `aria-valuetext` (determinate only), `aria-labelledby` (with `label` only),
`aria-describedby` (determinate only), `data-slot="circular-progress"`, `data-state`, `data-value`
(determinate only), `data-min`, `data-max`, `data-percentage` (determinate only).

### `CircularProgressIndicator` (`Indicator`) — `circular-progress-indicator.svelte`

Renders `<svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 size size">`
with `class="-rotate-90 transform"` so the sweep starts at 12 o'clock.

| Prop         | Type                          | Default | Bindable | Notes                                                                 |
| ------------ | ----------------------------- | ------- | -------- | --------------------------------------------------------------------- |
| `ref`        | `SVGSVGElement \| null`       | `null`  | **yes**  | `WithElementRef` is constrained to `HTMLElement`, so SVG parts declare `ref` locally (research.md R-03). |
| `class`      | `ClassValue`                  | —       | no       |                                                                       |
| `children`   | `Snippet`                     | —       | no       | Normally `Track` + `Range`.                                            |
| `…restProps` | `SVGAttributes<SVGSVGElement>`| —       | —        |                                                                       |

**Attributes**: `data-slot="circular-progress-indicator"`, `data-state`, `data-value`, `data-min`,
`data-max`, `data-percentage`. **Snippets**: `children`. **Callbacks**: none.

### `CircularProgressTrack` (`Track`) — `circular-progress-track.svelte`

Renders `<circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor"
stroke-width={thickness} stroke-linecap="round" vector-effect="non-scaling-stroke">` with
`class="text-muted-foreground/20"`.

| Prop         | Type                            | Default | Bindable | Notes |
| ------------ | ------------------------------- | ------- | -------- | ----- |
| `ref`        | `SVGCircleElement \| null`      | `null`  | **yes**  |       |
| `class`      | `ClassValue`                    | —       | no       |       |
| `…restProps` | `SVGAttributes<SVGCircleElement>` | —     | —        |       |

**Attributes**: `data-slot="circular-progress-track"`, `data-state`. **Snippets**: none (upstream renders
no children). **Callbacks**: none.

### `CircularProgressRange` (`Range`) — `circular-progress-range.svelte`

Same circle geometry as `Track`, plus `stroke-dasharray={circumference}` and `stroke-dashoffset`:

- `indeterminate` → `circumference * 0.75`
- determinate → `circumference - percentage * circumference`

`class="origin-center text-primary transition-all duration-300 ease-in-out"`, plus a component-scoped
`@keyframes spin-around` rule bound to `[data-state='indeterminate']` and disabled under
`prefers-reduced-motion: reduce`.

| Prop         | Type                              | Default | Bindable | Notes |
| ------------ | --------------------------------- | ------- | -------- | ----- |
| `ref`        | `SVGCircleElement \| null`        | `null`  | **yes**  |       |
| `class`      | `ClassValue`                      | —       | no       |       |
| `…restProps` | `SVGAttributes<SVGCircleElement>` | —       | —        |       |

**Attributes**: `data-slot="circular-progress-range"`, `data-state`, `data-value`, `data-min`,
`data-max`. **Snippets**: none. **Callbacks**: none.

### `CircularProgressValueText` (`ValueText`) — `circular-progress-value-text.svelte`

Renders `<span id={valueTextId}>` containing `children ?? valueText`; `class="absolute inset-0 flex
items-center justify-center text-sm font-medium"`.

| Prop         | Type                                                      | Default | Bindable | Notes                                            |
| ------------ | --------------------------------------------------------- | ------- | -------- | ------------------------------------------------ |
| `ref`        | `HTMLSpanElement \| null`                                 | `null`  | **yes**  |                                                  |
| `class`      | `ClassValue`                                              | —       | no       |                                                  |
| `children`   | `Snippet`                                                 | —       | no       | Takes precedence over the computed value text.   |
| `child`      | `Snippet<[{ props: CircularProgressValueTextChildProps }]>`| —      | no       | Replaces upstream `asChild`.                     |
| `…restProps` | `HTMLAttributes<HTMLSpanElement>`                         | —       | —        |                                                  |

**Attributes**: `data-slot="circular-progress-value-text"`, `data-state`, `id`. **Callbacks**: none.

### `CircularProgressCombined` (`Combined`) — `circular-progress-combined.svelte`

Takes the exact `CircularProgressRootProps` **minus** `children`/`child` (it owns its subtree) and renders
`Root > Indicator > (Track, Range)` + `ValueText`.

| Prop         | Type                                                              | Default | Bindable | Notes                                   |
| ------------ | ----------------------------------------------------------------- | ------- | -------- | --------------------------------------- |
| all root props | see `CircularProgress` above                                    | same    | `ref` yes | Forwarded verbatim.                     |

### Module exports (`circular-progress.svelte.ts`, re-exported from the barrel)

Shared, reusable by later ports (deliverable 5):

| Export                                                       | Kind     | Purpose                                                                          |
| ------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------- |
| `PROGRESS_STATES`, `ProgressState`                           | const/type | `['indeterminate', 'loading', 'complete']`.                                     |
| `DEFAULT_MIN`, `DEFAULT_MAX`, `DEFAULT_SIZE`, `DEFAULT_THICKNESS` | const | `0`, `100`, `48`, `4`.                                                          |
| `isValidNumber`, `isValidMaxNumber`, `isValidValueNumber`    | fn       | Upstream `getIsValid*Number` predicates, renamed to Svelte-idiomatic `is*`.      |
| `getProgressState(value, max)`                               | fn       | Upstream `getProgressState`.                                                     |
| `getDefaultValueText(value, min, max)`                       | fn       | Upstream `getDefaultValueText`.                                                  |
| `resolveProgressBounds(minProp, maxProp)`                    | fn       | FR-008 correction, returns `{ min, max }`.                                       |
| `clampProgressValue(value, min, max)`                        | fn       | FR-007 clamping, returns `number \| null`.                                        |
| `getProgressPercentage(value, min, max)`                     | fn       | `number \| null` in `[0, 1]`.                                                     |
| `getRingGeometry(size, thickness)` / `RingGeometry`          | fn/type  | `{ radius, center, circumference }`.                                              |
| `CircularProgressState`                                      | class    | Runes state class; all of the above as `$derived` members.                        |
| `setCircularProgressContext` / `getCircularProgressContext` / `hasCircularProgressContext` | fn | Typed `Symbol` context; the getter throws ``…`must be used within` `<CircularProgress>`.`` |

## Project Structure

### Documentation (this feature)

```text
specs/007-port-circular-progress/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions R-01…R-12
├── data-model.md        # Phase 1 output — context shape, derivations, state machine
├── quickstart.md        # Phase 1 output — how to validate the port end to end
├── contracts/
│   └── public-api.md    # Phase 1 output — exact DOM/ARIA/data-attribute contract
├── checklists/
│   └── requirements.md  # from /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/circular-progress/
├── index.ts                                # barrel: short names + prefixed aliases + types + helpers
├── circular-progress.svelte                # Root  ← CircularProgress
├── circular-progress-indicator.svelte      # svg   ← CircularProgressIndicator
├── circular-progress-track.svelte          # circle ← CircularProgressTrack
├── circular-progress-range.svelte          # circle ← CircularProgressRange (+ scoped keyframes)
├── circular-progress-value-text.svelte     # span  ← CircularProgressValueText
├── circular-progress-combined.svelte       # fixed composition ← CircularProgressCombined
├── circular-progress.svelte.ts             # helpers + CircularProgressState + Symbol context
├── circular-progress.test.svelte           # markup harness (NOT in registry.json, NOT collected)
└── circular-progress.test.ts               # colocated tests (NOT in registry.json)

src/routes/docs/components/circular-progress/
└── +page.svelte                            # 4 <ComponentPreview> sections + props tables

registry.json                               # append exactly one registry:ui entry
```

**Structure Decision**: One file per exported subcomponent, mapping 1:1 onto the upstream functions in
`.reference/diceui/docs/registry/bases/radix/ui/circular-progress.tsx`:

| Upstream function                | This port                             |
| -------------------------------- | ------------------------------------- |
| `CircularProgress`               | `circular-progress.svelte`            |
| `CircularProgressIndicator`      | `circular-progress-indicator.svelte`  |
| `CircularProgressTrack`          | `circular-progress-track.svelte`      |
| `CircularProgressRange`          | `circular-progress-range.svelte`      |
| `CircularProgressValueText`      | `circular-progress-value-text.svelte` |
| `CircularProgressCombined`       | `circular-progress-combined.svelte`   |
| module-level helpers + `CircularProgressContext` + `useCircularProgressContext` | `circular-progress.svelte.ts` |

Folder slug `circular-progress` == registry item `name` == demo route segment
`src/routes/docs/components/circular-progress/` — confirmed against `src/lib/registry.ts`, which filters
the sidebar on `type === 'registry:ui'` and links to `/docs/components/<name>`.

Demo sections on the docs page, one per upstream example file:

| Upstream demo                             | Section title      | Notes                                                                             |
| ----------------------------------------- | ------------------ | --------------------------------------------------------------------------------- |
| `circular-progress-demo.tsx`              | Default            | `setInterval` +2 every 150 ms to 100, `size={60}`, cleaned up in an `$effect` teardown. |
| `circular-progress-interactive-demo.tsx`  | Interactive        | Start / Reset / Indeterminate buttons, `size={80} thickness={6}`, status readout.  |
| `circular-progress-colors-demo.tsx`       | Colors             | 8-theme grid at `value={75}`, `size={80} thickness={6}`.                            |
| MDX "Layout" + `CircularProgressCombined` | Combined           | The one-line convenience form next to the equivalent manual composition.            |

Two deliberate demo-level divergences, both recorded in research.md:

- The Colors demo's `motion/react` spring animation is dropped: `motion` is not a dependency of this repo
  and adding one would violate the zero-new-dependency constraint. The eight rings render at a fixed
  `value={75}` — the same end state the spring settles on — so the theming point is preserved.
- Upstream's theme swatches use raw palette classes (`text-green-500`, `text-purple-500`, …). Constitution
  VIII forbids raw palette colours, so the docs page uses the four project status tokens
  (`text-primary`, `text-success`, `text-warning`, `text-destructive`) plus `text-info` and
  `text-muted-foreground` variants. The component itself is unaffected — it takes any class the caller
  passes.

## Phased Work Breakdown

| Phase | Deliverable                                                                                                | Gate                                        |
| ----- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| A     | `circular-progress.svelte.ts` — constants, predicates, `resolveProgressBounds`, `clampProgressValue`, `getProgressPercentage`, `getRingGeometry`, `getProgressState`, `getDefaultValueText`, `CircularProgressState`, Symbol context. | Unit-testable in isolation; no DOM.        |
| B     | `circular-progress.svelte` (Root) — validation, dev warnings behind `import.meta.env.DEV`, `$props.id()` ids, ARIA + data attributes, `child` snippet, optional `label`. | Root renders with correct ARIA in both states. |
| C     | `circular-progress-indicator.svelte`, `-track.svelte`, `-range.svelte` (incl. scoped keyframes), `-value-text.svelte`. | Geometry attributes match the derived math. |
| D     | `circular-progress-combined.svelte` + `index.ts` barrel.                                                     | `import * as CircularProgress` resolves.    |
| E     | `circular-progress.test.svelte` harness + `circular-progress.test.ts`.                                       | All six §7 test areas green.                |
| F     | `src/routes/docs/components/circular-progress/+page.svelte`.                                                 | Four preview sections + props tables.       |
| G     | `registry.json` entry (8 files, no test files) + `pnpm run registry:build`.                                  | `static/r/circular-progress.json` emitted.  |
| H     | `pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build`.                                        | All four gates green, no suppressions.      |

## Test Plan (constitution III / CLAUDE.md §7)

Colocated in `circular-progress.test.ts`, driving `circular-progress.test.svelte` for anything that needs
real markup (composition, `bind:ref`, snippets, `dir="rtl"`). Helper `bySlot(container, slot)` mirrors the
existing `swap`/`stat` tests.

1. **Roles and ARIA** — `role="progressbar"`; `aria-valuemin`/`aria-valuemax` always present;
   `aria-valuenow` present and equal to the clamped value when determinate and **absent** when
   indeterminate; `aria-valuetext` equals the computed text (default and `getValueText`); `aria-describedby`
   points at the value text's `id`; `aria-labelledby` points at the rendered `label` element's `id`;
   the indicator is `aria-hidden="true"` and `focusable="false"`.
2. **Keyboard** — the widget is non-interactive by design: assert the root has no `tabindex`, is not
   focusable (`user.tab()` from a preceding button lands on the following button, not the progressbar),
   and that `Enter`/`Space`/arrow keys leave every attribute unchanged. This is the complete upstream key
   set (empty), asserted rather than assumed.
3. **Uncontrolled** — no `value` prop ⇒ `data-state="indeterminate"`, no `aria-valuenow`, no `data-value`,
   no `data-percentage`, range `stroke-dashoffset === circumference * 0.75`, value text renders empty.
   Same for an explicit `value={null}`.
4. **Controlled** — the parent is authoritative: `rerender({ value: n })` moves `aria-valuenow`,
   `data-value`, `data-percentage` and the range's `stroke-dashoffset`; the component never changes
   `value` on its own (assert a bound page-level `value` is untouched after interaction attempts).
5. **RTL** — rendering the harness inside `dir="rtl"` produces byte-identical `class`, `viewBox`,
   `stroke-dasharray` and `stroke-dashoffset` to the LTR render (FR-021 / SC-005).
6. **Guard rails** — `Indicator`, `Track`, `Range` and `ValueText` each throw
   `/must be used within `<CircularProgress>`/` when rendered outside the root
   (`expect(() => render(Part)).toThrow(/within/)`); `value > max` / `value < min` clamp; `max <= min` ⇒
   `min + 1`; `max = 0` / `max = NaN` ⇒ `100`; non-finite `min` ⇒ `0`; `thickness >= size` ⇒ `r === 0`
   with no throw. Dev-console output from these cases is silenced with
   `vi.spyOn(console, 'error').mockImplementation(() => {})` per spec §Assumptions.
7. **Svelte-specific** — `bind:ref` populates each part's element (`div`, `svg`, two `circle`s, `span`);
   the `child` snippet on `Root` and `ValueText` receives and applies the full attribute payload;
   `children` on `ValueText` beats the computed text; every part merges the caller's `class` **after** its
   defaults.
8. **Pure helpers** — direct unit tests of `resolveProgressBounds`, `clampProgressValue`,
   `getProgressPercentage`, `getRingGeometry`, `getProgressState`, `getDefaultValueText` covering the
   `max === min` (⇒ 100 %) branch that is unreachable through the component after FR-008 correction.

Geometry assertions use `toBeCloseTo(2 * Math.PI * r * k)` computed in the test from first principles, not
from the component's own exported helper, so the assertion is independent of the implementation.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | —         | —          | —                                      |

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 (research.md, data-model.md, contracts/public-api.md, quickstart.md):

- **I** — the design uses no `$effect` in the component at all; the only effects in the feature are the
  demo page's interval timers, each returning its `clearInterval` teardown. PASS.
- **II** — contracts/public-api.md enumerates every upstream attribute per state and was written by
  reading the upstream source line by line; the four divergences (`asChild` → `child`, `useId` →
  `$props.id()`, global keyframes → scoped keyframes, demo palette → semantic tokens) are all recorded in
  spec §Assumptions and research.md. PASS.
- **III** — the ARIA matrix in contracts/public-api.md distinguishes determinate from indeterminate output
  attribute by attribute, and the Test Plan asserts both. PASS.
- **IV** — the bits-ui rejection is written above with four specific missing capabilities. PASS.
- **V–X** — unchanged by the design phase; file list, barrel shape and registry entry are fixed in
  Structure Decision and quickstart.md. PASS.

**Gate result: PASS — proceed to `/speckit-tasks`.**
