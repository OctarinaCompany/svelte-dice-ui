# Implementation Plan: Port Color Swatch Component

**Branch**: `006-port-color-swatch` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-port-color-swatch/spec.md`

## Summary

Port Dice UI's `ColorSwatch` (a single-element, non-interactive `role="img"` swatch that renders one CSS
colour value, with three fixed sizes, automatic checkerboard rendering for alpha colours, a disabled
state, and a "no colour selected" fallback) to Svelte 5 runes.

Technical approach: the component is **stateless** — every rendered attribute is a pure function of its
props — so there is no state class and no context. All reactive derivation happens with `$derived` in
`color-swatch.svelte`, and the colour *classification* logic (CSS validity, alpha detection,
normalisation, background-string construction) is extracted into a dependency-free
`color.ts` module inside the component folder, so the wave-3 `color-picker` port can import it instead of
duplicating it (FR-012 / SC-005 — upstream's `color-picker.tsx` duplicates both the checkerboard gradient
and its own parser, which this port deliberately does not repeat).

Upstream `asChild` (Radix `Slot`) becomes the repo's `child` snippet pattern already used by
`status.svelte` and `swap.svelte`. Upstream's `React.CSSProperties` object merge becomes explicit
string-concatenation of CSS declarations with the caller's `style` appended last (later declaration wins).

## Technical Context

**Language/Version**: TypeScript 5 (strict, `verbatimModuleSyntax`), Svelte 5 (runes forced on in
`vite.config.ts`), SvelteKit 2

**Primary Dependencies**: `tailwind-variants` (`tv()`), `clsx` + `tailwind-merge` via `cn()` from
`$lib/utils.js`, Tailwind CSS v4. **No `bits-ui` primitive is used** — see Constitution Check IV. **Zero
new npm dependencies**: upstream's only runtime dependency for this file is `radix-ui`'s `Slot`, which the
`child` snippet replaces, and `class-variance-authority`, which `tailwind-variants` replaces (both already
in the repo).

**Storage**: N/A

**Testing**: Vitest (jsdom, `globals: false`, `expect.requireAssertions: true`) +
`@testing-library/svelte` + `@testing-library/user-event`; colocated at
`src/lib/components/ui/color-swatch/`

**Target Platform**: Browsers (SSR-safe: `CSS.supports` is feature-detected and falls back to
"treat as valid", matching upstream)

**Project Type**: shadcn-svelte registry component + docs route (single SvelteKit app)

**Performance Goals**: No measurable runtime cost — one `$derived` chain over three scalar props, no
effects, no observers, no timers, no listeners

**Constraints**: No `any`, no suppression comments, semantic Tailwind tokens only (upstream's
`hsl(var(--destructive))` is remapped to `var(--destructive)` because this repo's `--destructive` is a
complete `oklch()` colour, not raw HSL channels — see research D-003)

**Scale/Scope**: 1 exported component, 1 exported helper module (4 pure functions), 1 demo route with 4
preview sections + a props table, 1 registry entry, 2 test files

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                    |
| ---- | ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$props` + `$bindable(null)` for `ref` + `$derived` only. No stores, no `export let`, no `createEventDispatcher`, no `<slot>`. No state class because the component holds zero state (research D-001); non-markup logic lives in `color.ts`. |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `color-swatch.tsx`, `color-swatch.mdx`, `types/radix/color-swatch.ts` and all three `color-swatch-*-demo.tsx` read at the pinned commit. All 4 props, both aria attributes, both data attributes and all 3 sizes reproduced; upstream JSDoc incl. `@default` copied verbatim. Divergences (`asChild`→`child`, `hsl(var(--destructive))`→`var(--destructive)`, added `data-size`/`data-transparent`/`data-empty`) recorded in spec Assumptions. |
| III  | Accessibility Is a MUST             | PASS    | `role="img"` + value-specific `aria-label` + `aria-disabled`; no APG keyboard pattern applies (static image role, no tabstop — research D-005). Tests cover roles/names, the absence of focusability, RTL invariance, disabled guard rails and every prop.                                                                     |
| IV   | Composition Over Reimplementation   | PASS    | See justification below.                                                                                                                                                     |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `src/lib/components/ui/color-swatch/`, root `color-swatch.svelte`, helper `color.ts`, barrel `index.ts` with short names + prefixed aliases + types, `.js` extensions on every intra-repo import, one `registry:ui` entry listing all 3 non-test files, `pnpm run registry:build` run after. No import from `src/routes/**` or `$lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Props type in `<script lang="ts" module>` deriving from `WithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>>`; `ColorSwatchChildProps` is an explicit shape, no `any`; zero ignore comments; no config edits.                                    |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final task; no `.skip`/`.todo`.                                                                 |
| VIII | Styling Discipline                  | PASS    | `tv()` in the module script, exported as `colorSwatchVariants`; caller `class` merged last via `cn()`; base classes are the upstream utilities `box-border rounded-sm border bg-clip-padding shadow-sm` (verbatim, `bg-clip-padding` is required so the alpha/checkerboard background does not paint under the border) plus `size-*` variants, the disabled state expressed as the variant classes `data-disabled:pointer-events-none data-disabled:opacity-50` (never bare `pointer-events-none opacity-50`, which would disable the swatch unconditionally), and the `var(--destructive)` token; every state exposed as `data-*` with `cond ? '' : undefined` for booleans; `data-slot="color-swatch"`. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/color-swatch/+page.svelte` with one `<ComponentPreview>` per upstream demo file (`color-swatch-demo`, `color-swatch-sizes-demo`, `color-swatch-transparency-demo`) plus a "Usage" section for the MDX Usage snippet, plus a props table (`$lib/components/ui/table`), state held with runes, no `+page.ts`. |
| X    | One Feature Directory Per Component | PASS    | All artefacts written to `specs/006-port-color-swatch/`; no git write commands; no edits to `.port-state.json`, `scripts/**`, `.specify/scripts/**` or `.reference/**`.        |

**Bespoke behaviour justification (Principle IV)**: The component itself is bespoke, in three narrow
places. For each, the primitive evaluated and the missing capability:

1. **The swatch element.** Evaluated `src/lib/components/ui/badge`, `avatar` and `skeleton` (the only
   existing "coloured box" parts) and `bits-ui`. None accepts an arbitrary CSS colour string, and `bits-ui`
   ships no colour primitive at all (no swatch, no picker, no colour utilities). A plain `<div>` styled with
   `tv()` is the only option; there is no headless behaviour to delegate, because the element has no
   interaction, no focus management, no positioning and no dismissal.
2. **CSS-colour validation (`isCssColor`).** No primitive in `bits-ui` or `$lib` validates a CSS colour
   string. Upstream uses the platform API `CSS.supports('color', value)`; this port keeps it, including
   upstream's feature-detect-and-assume-valid fallback for SSR (research D-002).
3. **Alpha detection (`hasAlpha`).** Same gap — the regex set is ported verbatim from upstream rather than
   replaced with a colour-parsing dependency, because adding one would violate the zero-new-dependencies
   constraint and would change behaviour for values the regexes deliberately accept (`transparent`,
   slash-alpha `color()` syntax).

Because 2 and 3 are the only reusable logic, they (plus normalisation and the background-string builder)
are isolated in `color.ts` so the wave-3 `color-picker` composes them instead of re-deriving them.

## Public API

Everything below is derived from `.reference/diceui/docs/registry/bases/radix/ui/color-swatch.tsx` and
`.reference/diceui/docs/types/radix/color-swatch.ts`. The authoritative, machine-checkable version lives in
[contracts/color-swatch-public-api.md](./contracts/color-swatch-public-api.md).

### Components

| Export                       | File                  | Renders                                                    |
| ---------------------------- | --------------------- | ---------------------------------------------------------- |
| `Root` (alias `ColorSwatch`) | `color-swatch.svelte` | one `<div role="img">`, or the caller's element via `child` |

There is exactly one component — upstream exports exactly one (`ColorSwatch`) with no sub-parts.

### `ColorSwatch` props

| Prop                   | Type                                            | Default     | Bindable | Notes                                                                                                                |
| ---------------------- | ----------------------------------------------- | ----------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `ref`                  | `HTMLDivElement \| null`                        | `null`      | **yes**  | Svelte replacement for `forwardRef`. Not populated in `child` mode — the caller owns the element.                     |
| `color`                | `string \| undefined`                           | `undefined` | no       | Any valid CSS colour. Trimmed; empty/whitespace-only is treated as `undefined`. Upstream JSDoc + `@example` copied.   |
| `size`                 | `'default' \| 'sm' \| 'lg'`                     | `'default'` | no       | `sm` → `size-6`, `default` → `size-8`, `lg` → `size-12`. Unknown runtime values fall back to `'default'`.             |
| `withoutTransparency`  | `boolean`                                       | `false`     | no       | Suppresses the checkerboard for alpha colours.                                                                       |
| `disabled`             | `boolean`                                       | `false`     | no       | Adds `aria-disabled="true"` + `data-disabled`; the base classes `data-disabled:pointer-events-none data-disabled:opacity-50` then take effect via the `[data-disabled]` attribute. |
| `class`                | `ClassValue`                                    | `undefined` | no       | Destructured as `class: className`, merged **last** through `cn()`.                                                   |
| `style`                | `string \| undefined \| null`                   | `undefined` | no       | Appended **after** the computed background + `forced-color-adjust`, so the caller wins (matches upstream's `...style` spread order). |
| `...restProps`         | `HTMLAttributes<HTMLDivElement>` minus `children` | —         | no       | Spread onto the element, before `class`/`style` so those always win.                                                  |

`children` is **not** a prop: upstream's type is `Omit<React.ComponentProps<'div'>, 'children'>`. The port
uses `WithoutChildren<…>` to reproduce that exactly.

### Snippets

| Snippet | Signature                                    | Notes                                                                                                                    |
| ------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `child` | `Snippet<[{ props: ColorSwatchChildProps }]>` | Replaces upstream `asChild`. Receives the fully merged attribute payload (role, aria, data, class, style, restProps) to spread. |

### Callbacks / events

**None.** Upstream declares no callback props and no controlled state — the component is a pure projection
of its props. Native DOM handlers (`onclick`, …) pass through `restProps` untouched.

### Other exports (barrel)

| Export                                                  | Kind      | Purpose                                                                                     |
| ------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| `colorSwatchVariants`                                   | `tv()`    | Consumers restyling the swatch; a repo convention (cf. `buttonVariants`) — upstream exports only `ColorSwatch` from `color-swatch.tsx`, its `cva` instance is module-private. |
| `COLOR_SWATCH_SIZES`                                    | `const`   | `['default', 'sm', 'lg']` in upstream declaration order.                                    |
| `resolveColorSwatchSize(value?: string)`                | function  | Runtime narrowing to a known size (repo convention, cf. `resolveStatusVariant`).             |
| `ColorSwatchSize`, `ColorSwatchRootProps`, `ColorSwatchProps` (alias), `ColorSwatchChildProps` | types | `ColorSwatchProps` is aliased to the upstream type name for parity.                          |
| `normalizeColorValue`, `isCssColor`, `hasAlpha`, `getColorBackgroundStyle` | functions | The reusable colour module (FR-012). Re-exported from the barrel **and** importable directly from `./color.js`. |

## Project Structure

### Documentation (this feature)

```text
specs/006-port-color-swatch/
├── plan.md                              # This file
├── research.md                          # Phase 0 output
├── data-model.md                        # Phase 1 output
├── quickstart.md                        # Phase 1 output
├── contracts/
│   └── color-swatch-public-api.md       # Phase 1 output — the enforceable API contract
├── checklists/requirements.md           # from /speckit-specify
└── tasks.md                             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/color-swatch/
├── index.ts                       # barrel: Root/ColorSwatch, variants, size helpers, colour helpers, types
├── color-swatch.svelte            # Root — ports color-swatch.tsx's ColorSwatch()
├── color.ts                       # ports getIsCssColor/getHasAlpha + normalisation + background builder
├── color-swatch.test.ts           # component tests (NOT in registry.json)
├── color.test.ts                  # colour-module tests (NOT in registry.json)
└── color-swatch.test.svelte       # harness for child snippet / prop rerender / RTL (NOT in registry.json)

src/routes/docs/components/color-swatch/
└── +page.svelte                   # 4 <ComponentPreview> sections + props table

registry.json                      # append exactly one registry:ui entry named "color-swatch"
```

**Structure Decision**:

| Port file                                        | Upstream counterpart under `.reference/diceui`                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `color-swatch.svelte` (module script: `colorSwatchVariants`, props type) | `docs/registry/bases/radix/ui/color-swatch.tsx` lines 8–22 (`cva`) and 54–61 (`ColorSwatchProps`), plus `docs/types/radix/color-swatch.ts` for the JSDoc |
| `color-swatch.svelte` (instance script + markup)  | `color-swatch.tsx` lines 63–118 (`ColorSwatch()`)                                                                |
| `color.ts`                                        | `color-swatch.tsx` lines 24–52 (`getIsCssColor`, `getHasAlpha`) and 75–94 (the `backgroundStyle` memo)           |
| `index.ts`                                        | `color-swatch.tsx` line 120 (`export { ColorSwatch }`) + repo barrel convention                                  |
| `color-swatch.test.ts` / `color.test.ts`          | no upstream test file exists for this component (verified: nothing matching `color-swatch` under `packages/*/test` or `docs/registry/bases/radix/test`) — the assertion floor is therefore the MDX's documented contract, not a ported spec |
| `docs/components/color-swatch/+page.svelte`       | `docs/registry/bases/radix/examples/color-swatch-demo.tsx`, `-sizes-demo.tsx`, `-transparency-demo.tsx` + the MDX "Usage" snippet |

Slug consistency: folder `color-swatch` == registry item `name: "color-swatch"` == demo route segment
`/docs/components/color-swatch`. The docs sidebar picks it up automatically through
`getComponentItems()` in `src/lib/registry.ts` — no manual navigation edit is needed.

**Why `color.ts` lives in the component folder rather than `src/lib/`**: Constitution V requires a
component to live in exactly one folder and requires every registry file to be listed on that component's
entry. Putting the module in `src/lib/utils/` would make it a file that no registry item ships, so a
consumer installing `color-swatch` would get a broken import. Keeping it at
`src/lib/components/ui/color-swatch/color.ts` means the wave-3 `color-picker` entry simply declares
`"registryDependencies": ["color-swatch"]` and imports
`$lib/components/ui/color-swatch/color.js` — one file, one owner, no duplication (SC-005).

## Phase 2 preview (what `/speckit-tasks` will schedule)

Ordered by dependency, grouped by user story, so this plan's deliverables are explicit:

1. **Foundation** — `color.ts` (4 pure functions, full JSDoc) → `color.test.ts` (table-driven over every
   format in the MDX "Color Format Support" and "Transparency Detection" lists).
2. **US1 (P1)** — `color-swatch.svelte` module script (`tv()`, sizes, props type with upstream JSDoc) +
   instance script + markup; `index.ts`; the US1 slice of `color-swatch.test.ts` (role, accessible name,
   valid/invalid/absent colour, background attribute).
3. **US2 (P2)** — checkerboard branch + `withoutTransparency`; its test slice.
4. **US3 (P3)** — `size` variants + `disabled`; its test slice; `color-swatch.test.svelte` harness for the
   `child` snippet, `ref` binding, prop rerender and the RTL wrapper.
5. **Docs & registry** — demo route with 4 sections + props table; `registry.json` entry;
   `pnpm run registry:build`.
6. **Gate** — `pnpm run format`, then `check`, `lint`, `test:unit -- --run`, `build`.

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 (data-model.md, contracts/, quickstart.md written): **all ten principles still
PASS**. The design introduced no state class, no context, no effect, no listener and no dependency, so
Principles I and IV are strengthened rather than strained. The only design decisions that moved during
Phase 1 were (a) hosting `getColorBackgroundStyle` in `color.ts` rather than in the component module, which
improves Principle IV compliance for wave 3, and (b) adding `data-size` / `data-transparent` / `data-empty`,
which Principle VIII requires and which are recorded as a spec Assumption.

## Complexity Tracking

| Principle   | Violation                                                                                    | Why Needed                                                                                                                       | Compliant Alternative Rejected Because                                                                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| III (vs II) | `child` payload carries `role="img"`, which ARIA disallows on an interactive caller element   | Principle II is NON-NEGOTIABLE: upstream `Slot` merges `role="img"` onto whatever element the consumer supplies                  | Dropping `role` in `child` mode would break parity and silently lose the accessible name for the common non-interactive case; instead the payload is spread first so a caller's own `role` wins, and that override is tested (see spec.md Assumptions, `role="img"` in `child` mode) |
