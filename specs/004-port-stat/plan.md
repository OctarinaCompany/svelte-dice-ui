# Implementation Plan: Stat

**Branch**: `004-port-stat` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-port-stat/spec.md`

## Summary

Port Dice UI's `Stat` — a card-shaped, two-column CSS grid that arranges seven presentational parts
(container, label, indicator, value, trend, separator, description) by `data-slot` identity rather
than by DOM order, so the parts can be written in any order and still land in the right cell.

Technical approach: seven `.svelte` files, each a thin styled element with `ref = $bindable(null)`
and `...restProps`. The component is **stateless** — no shared reactive state, no context, no
controlled/uncontrolled mode, no keyboard model of its own — so there is deliberately **no**
`stat.svelte.ts` module (justified in [research.md](./research.md) R1). The two multi-variant parts
(`StatIndicator`, `StatTrend`) declare `tv()` variant tables in their `<script lang="ts" module>`
block and export them, exactly as `status.svelte` already does. `StatSeparator` composes the
repository's existing `$lib/components/ui/separator` (Principle IV). Zero new npm dependencies.

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`), Svelte 5.56 in forced runes
mode (`vite.config.ts`), SvelteKit 2.63

**Primary Dependencies**: none new. Existing only — `tailwind-variants` 3.3 (`tv()`), `clsx` +
`tailwind-merge` via `cn()` from `$lib/utils.js`, Tailwind CSS v4. `bits-ui` 2.18 is reached
**indirectly** through `$lib/components/ui/separator` (which wraps `Separator.Root`); `stat`'s own
files import no `bits-ui` symbol. `@lucide/svelte` and `$lib/components/ui/dropdown-menu` are used
by the demo route only, never by the component.

**Storage**: N/A

**Testing**: Vitest 4 (jsdom, `globals: false`, `expect.requireAssertions: true`) +
`@testing-library/svelte` 5 + `@testing-library/user-event` 14, setup in `tests/setup.ts`

**Target Platform**: SSR + browser (SvelteKit); distributed as source through the project's
shadcn-svelte registry

**Project Type**: Component library (shadcn-svelte registry) with a colocated SvelteKit docs site

**Performance Goals**: N/A — no measurement, no observers, no document-level listeners, no `$effect`
anywhere in the component. Each part recomputes a single `cn()`/`tv()` call when its own props
change.

**Constraints**: no `any`, no suppression comments, no new npm dependency, no `shadcn-svelte add`,
semantic Tailwind tokens only (no `green-*`/`orange-*`/`blue-*`/`red-*`, no manual `dark:`), no
`space-x-*`/`space-y-*`, caller `class` merged last.

**Scale/Scope**: 1 component folder (8 shipped files: `index.ts` + 7 parts, plus 2 test files not
shipped), 1 demo route with 3 example sections + 8 API tables, 1 `registry.json` entry. No shared
module is extracted for later components (research.md R7).

## Public API

Derived from `.reference/diceui/docs/registry/bases/radix/ui/stat.tsx`,
`.reference/diceui/docs/types/radix/stat.ts` and
`.reference/diceui/docs/content/docs/components/radix/stat.mdx` at the pinned commit
`d9763d82530416dfa4c81c462387b55d06bae4ec`. The Base-UI variant
(`docs/registry/bases/base/ui/stat.tsx`) was diffed against the Radix one and differs by exactly one
line — the import path of `Separator` — so a single port covers both.

The full, machine-checkable surface (class strings included) is
[contracts/stat-public-api.md](./contracts/stat-public-api.md). Summary:

### Shared prop shape

Every part below accepts, in addition to the props listed for it:

| Prop           | Type                             | Default | Bindable | Notes                                                        |
| -------------- | -------------------------------- | ------- | -------- | ------------------------------------------------------------ |
| `ref`          | `HTMLDivElement \| null`         | `null`  | **yes**  | `bind:this` on the rendered element (replaces `forwardRef`)  |
| `class`        | `ClassValue`                     | —       | no       | Destructured as `class: className`, merged **last**          |
| `children`     | `Snippet`                        | —       | no       | Rendered with `{@render children?.()}`                       |
| `...restProps` | `HTMLAttributes<HTMLDivElement>` | —       | no       | Every other attribute/DOM handler spread onto the element    |

No part declares a callback prop, an event prop, or a `child` snippet. Upstream declares none
(`StatProps extends EmptyProps<"div">`), and the spec's Assumptions fix `StatIndicator` as a plain
styled `div`.

### 1. `Stat` (`Root`) — `stat.svelte`

Props: shared shape only. Renders `<div data-slot="stat">`.

### 2. `StatLabel` (`Label`) — `stat-label.svelte`

Props: shared shape only. Renders `<div data-slot="stat-label">`.

### 3. `StatIndicator` (`Indicator`) — `stat-indicator.svelte`

| Prop      | Type                                                        | Default       | Bindable |
| --------- | ----------------------------------------------------------- | ------------- | -------- |
| `variant` | `'default' \| 'icon' \| 'badge' \| 'action'`                | `'default'`   | no       |
| `color`   | `'default' \| 'success' \| 'info' \| 'warning' \| 'error'`  | `'default'`   | no       |

Renders `<div data-slot="stat-indicator" data-variant={…} data-color={…}>`. Props type is
`Omit<WithElementRef<HTMLAttributes<HTMLDivElement>>, 'color'>` — the omit reproduces upstream's
`Omit<React.ComponentProps<"div">, "color">`, which exists because `color` is also a (deprecated)
HTML attribute.

### 4. `StatValue` (`Value`) — `stat-value.svelte`

Props: shared shape only. Renders `<div data-slot="stat-value">`.

### 5. `StatTrend` (`Trend`) — `stat-trend.svelte`

| Prop    | Type                                | Default     | Bindable |
| ------- | ----------------------------------- | ----------- | -------- |
| `trend` | `'up' \| 'down' \| 'neutral'`       | `undefined` | no       |

Renders `<div data-slot="stat-trend" data-trend={…}>`. `trend` has **no** default value (upstream
declares none); when it is `undefined` the `data-trend` attribute is **absent** and the styling
falls back to the neutral/muted row, matching upstream's `trend === "neutral" || !trend`.

### 6. `StatSeparator` (`Separator`) — `stat-separator.svelte`

| Prop           | Type                            | Default        | Bindable |
| -------------- | ------------------------------- | -------------- | -------- |
| `ref`          | `HTMLDivElement \| null`        | `null`         | **yes**  |
| `orientation`  | `'horizontal' \| 'vertical'`    | `'horizontal'` | no       |
| `decorative`   | `boolean`                       | `false` (bits-ui) | no    |
| `class`        | `ClassValue`                    | —              | no       |
| `...restProps` | rest of `Separator.RootProps`   | —              | no       |

Renders this project's `<Separator data-slot="stat-separator" class={cn('my-2', className)} />`,
i.e. a `bits-ui` `Separator.Root`. `orientation`/`decorative` defaults come from `bits-ui`; the part
does not restate them. Props type is `SeparatorPrimitive.RootProps` (bits-ui), the closest available
counterpart to upstream's `React.ComponentProps<typeof Separator.Root>`.

### 7. `StatDescription` (`Description`) — `stat-description.svelte`

Props: shared shape only. Renders `<div data-slot="stat-description">`.

### Non-component exports from the barrel

| Export                                                     | Kind  | Purpose                                                                 |
| ---------------------------------------------------------- | ----- | ----------------------------------------------------------------------- |
| `statIndicatorVariants`                                    | value | `tv()` table; replaces upstream's `cva` export of the same name         |
| `statTrendVariants`                                        | value | `tv()` table for the trend rows (upstream inlines a `clsx` object)      |
| `STAT_INDICATOR_VARIANTS`, `STAT_INDICATOR_COLORS`, `STAT_TREND_DIRECTIONS` | value | `readonly` tuples, the single source of truth for the union types and for the demo/test loops |
| `resolveStatIndicatorVariant`, `resolveStatIndicatorColor`, `resolveStatTrendDirection` | value | Normalise an untyped runtime value to a known key (spec Edge Cases)     |
| `StatIndicatorVariant`, `StatIndicatorColor`, `StatTrendDirection` | type  | The three unions                                                        |
| `StatRootProps`, `StatLabelProps`, `StatIndicatorProps`, `StatValueProps`, `StatTrendProps`, `StatSeparatorProps`, `StatDescriptionProps` | type | One per part |

Namespace-friendly short names (`Root`, `Label`, `Indicator`, `Value`, `Trend`, `Separator`,
`Description`) **and** prefixed aliases (`Stat`, `StatLabel`, …) are both exported, per CLAUDE.md §3.

### Snippets, callbacks, events

None beyond `children`. There is no `child` snippet on any part, no callback prop, and no dispatched
event — upstream has none, and the spec's Assumptions section fixes `StatIndicator` as a plain
styled `div` rather than a slottable primitive.

## Spec reconciliation (must be read before implementation)

Re-reading the pinned upstream source while planning turned up one factual error in `spec.md`, which
this plan resolves in favour of upstream (Principle II is non-negotiable and outranks a
success-criterion phrasing):

- **What `spec.md` claims** (Assumptions, third divergence bullet; and SC-005): upstream's "action"
  indicator "relies on the caller composing it directly as a Radix `DropdownMenuTrigger`'s child via
  React's implicit prop-forwarding (the trigger clones its child…)", and the port must produce "no
  additional wrapping element in the rendered DOM".
- **What upstream actually does**
  (`docs/registry/bases/radix/examples/stat-demo.tsx`, lines 63–75): `<DropdownMenuTrigger>` is used
  **without** `asChild`, so Radix renders **its own `<button>`** and `<StatIndicator variant="action">`
  is ordinary content **inside** that button. The rendered DOM is
  `<button data-slot="dropdown-menu-trigger"><div data-slot="stat-indicator" data-variant="action">…</div></button>`
  — a wrapping element is present upstream, and no cloning takes place.
- **Resolution**: the demo composes `<DropdownMenu.Trigger>` with `Stat.Indicator` as its content,
  with no `child` snippet. `bits-ui`'s `Menu.Trigger` renders `<button {...mergedProps}>` by default
  (`node_modules/bits-ui/dist/bits/menu/components/menu-trigger.svelte:36`), so this reproduces
  upstream's DOM **exactly** and yields a genuinely focusable, keyboard-operable trigger with correct
  `aria-haspopup`/`aria-expanded`/`aria-controls` — strictly better than spreading trigger props onto
  a non-focusable `<div>`, which is what the "no wrapper" reading would require.
- **Grid impact**: none. The trigger button is the 2nd child of the grid, so `grid-cols-[1fr_auto]`
  auto-placement puts it in column 2 / row 1 — the same cell the
  `**:data-[slot=stat-indicator]:col-start-2` rule targets when the indicator is a direct child.
  This is upstream's own behaviour, quirk included.
- **Action taken**: the two affected sentences in `spec.md` (the Assumptions bullet and SC-005) are
  corrected in place to describe the verified upstream composition; the FRs are unaffected. FR-013's
  "without an extra wrapping element" clause is likewise corrected. Recorded here so
  `/speckit-analyze` sees the change as resolved rather than as drift.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                       |
| ---- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$props`, `$bindable`, `$derived`, `{@render children?.()}` only. No `export let`, no store, no `createEventDispatcher`, no `<slot>`. No `$effect` (nothing to tear down). No `.svelte.ts` module because there is no reactive logic (research.md R1) |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | All 7 parts, both indicator axes (4 × 5), all 3 trend directions, all 7 `data-slot` values and `data-variant`/`data-color`/`data-trend` reproduced; upstream JSDoc incl. `@default` copied verbatim; 4 divergences recorded in spec Assumptions; the one factual spec error corrected above |
| III  | Accessibility Is a MUST             | PASS    | WAI-ARIA prescribes **no** widget role for a presentational metric card (research.md R6): text content is the accessible name. Grid mirrors under `dir="rtl"` natively (R5). Keyboard/ARIA is supplied by the composed `DropdownMenu.Trigger` and is asserted through it (`user-event`: click, `Enter`, `Space`, `Escape`, arrow-to-item) |
| IV   | Composition Over Reimplementation   | PASS    | `StatSeparator` composes `$lib/components/ui/separator` (tier 1); the demo's menu composes `$lib/components/ui/dropdown-menu`. Nothing bespoke — see justification below                                                                        |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, `<slug>-<part>.svelte` naming, `index.ts` barrel with short names + aliases + types, `.js` import extensions, one `registry:ui` entry listing all 8 shipped files, `registry:build` scheduled. No import from `src/routes/**` or `$lib/components/docs/**` |
| VI   | TypeScript Strict, No Suppressions  | PASS    | No `any`; all props types in `<script lang="ts" module>` and derived from `WithElementRef<HTMLAttributes<HTMLDivElement>>`; union types generated from `readonly` tuples; zero ignore comments; no config change                                |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit --run` → `build` → `registry:build` scheduled in [quickstart.md](./quickstart.md); no `.skip`/`.todo`; every `it` asserts                                                                              |
| VIII | Styling Discipline                  | PASS    | `cn()` everywhere, `tv()` for both multi-variant parts, exported from module scripts; caller `class` merged last; `success`/`info`/`warning`/`destructive` semantic tokens replace upstream's `green-*`/`blue-*`/`orange-*`/`red-*`; no `dark:`, no `space-*`, no `z-index`; `data-slot` on all 7 parts; every state axis exposed as `data-*` |
| IX   | Every Component Is Documented       | PASS    | `/docs/components/stat` with exactly 3 `<ComponentPreview>` sections — one per `stat-demo.tsx`, `stat-variants-demo.tsx`, `stat-layout-demo.tsx` — plus 7 prop tables and 1 data-attribute table. No `+page.ts`                                  |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/004-port-stat/`; no git write command is run; no protected path is touched                                                                                                                                          |

**Bespoke behaviour justification (Principle IV)**: None — all behaviour composed. The only two
capabilities the component needs beyond static markup are (a) a horizontal rule, taken from
`$lib/components/ui/separator` (tier 1: an existing `src/lib/components/ui/*` component wrapping
`bits-ui` `Separator.Root`, which already supplies `role="separator"`/`aria-orientation` or
`role="none"` when `decorative`), and (b) an interactive menu trigger, taken from
`$lib/components/ui/dropdown-menu` in the demo (tier 1). No `@diceui/shared` behaviour is involved —
upstream's `stat.tsx` imports nothing from it.

**Post-Phase-1 re-check**: re-evaluated after `data-model.md`, `contracts/stat-public-api.md` and
`quickstart.md` were written. All ten verdicts stand unchanged; the design introduced no state, no
context, no effect, no dependency and no suppression, so no verdict could move. Complexity Tracking
stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/004-port-stat/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── stat-public-api.md
├── checklists/
│   └── requirements.md  # from /speckit-specify
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/stat/
├── index.ts                    # barrel: short names + prefixed aliases + prop types + tv tables
├── stat.svelte                 # Root       ← stat.tsx  Stat
├── stat-label.svelte           #            ← stat.tsx  StatLabel
├── stat-indicator.svelte       # + tv table ← stat.tsx  StatIndicator + statIndicatorVariants
├── stat-value.svelte           #            ← stat.tsx  StatValue
├── stat-trend.svelte           # + tv table ← stat.tsx  StatTrend
├── stat-separator.svelte       #            ← stat.tsx  StatSeparator
├── stat-description.svelte     #            ← stat.tsx  StatDescription
├── stat.test.ts                # colocated tests            (NOT in registry.json)
└── stat.test.svelte            # prop-driven test harness   (NOT in registry.json)

src/routes/docs/components/stat/
└── +page.svelte                # 3 <ComponentPreview> sections + API tables

registry.json                   # append exactly one registry:ui entry named "stat"
```

**Structure Decision**: Seven part files, one per exported upstream function in
`.reference/diceui/docs/registry/bases/radix/ui/stat.tsx` (mapped in the tree above), with the two
variant tables living in the module script of the part that owns them — the precedent set by
`status.svelte`, which exports `statusVariants` from `<script lang="ts" module>`. There is no
`stat.svelte.ts`: CLAUDE.md §3 places *reactive logic that is not markup* in that file, and this
component has none (research.md R1). `stat.test.svelte` is a non-collected harness (Vitest `include`
is `src/**/*.{test,spec}.{js,ts}`) needed because a `.ts` spec cannot express `bind:ref` or the
`DropdownMenu.Trigger` composition; it mirrors `status.test.svelte`. Demo route segment `stat` ==
folder slug `stat` == registry item `name` `"stat"`, so `getComponentItems()` in `src/lib/registry.ts`
links the sidebar correctly.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

None. No principle is violated, so this table is intentionally empty.
