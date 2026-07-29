# Implementation Plan: Port Status Component

**Branch**: `001-port-status` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-port-status/spec.md`

## Summary

Port Dice UI's `Status` badge — a pill-shaped container with five colour variants, an optional
animated ping indicator, and an optional text label — to Svelte 5 as the shadcn-svelte registry item
`status`.

The component is **stateless and presentational**: no value, no controlled/uncontrolled mode, no
keyboard model of its own, no cross-part communication. The entire port is therefore (a) a `tv()`
variant table translated from upstream's `cva()` table onto this project's semantic tokens, (b) three
thin element wrappers each carrying a `data-slot`, and (c) one escape hatch — upstream's Radix
`asChild` — translated to the Bits UI `child` snippet pattern.

Because it is the first ported component, this plan also **fixes the conventions** every later port
will be told to copy: folder layout, barrel shape, where `tv()` lives, `data-*` naming, the `child`
snippet contract, and the `status.test.ts` + `status.test.svelte` test file structure. Those choices
are called out in [Convention Decisions](#convention-decisions-this-port-sets-the-precedent).

**Spec reconciliation.** The spec's "very long label" edge case described text _wrapping_, which
contradicts upstream's `whitespace-nowrap overflow-hidden` base classes. Principle II (Upstream
Parity) is non-negotiable and supersedes, so the plan keeps upstream's utilities verbatim and the
edge-case bullet in `spec.md` has been corrected to describe the real behaviour (badge is `w-fit`,
does not stretch, and clips rather than wraps). This is recorded in
[research.md](./research.md#decision-7--long-label-behaviour) and in the spec's Assumptions.

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`) + Svelte 5.56 in forced runes
mode (`vite.config.ts` sets `compilerOptions.runes = true` for everything outside `node_modules`)

**Primary Dependencies**: `tailwind-variants` ^3.3.0 (`tv()`), `clsx` + `tailwind-merge` via
`cn()` from `$lib/utils.js`, Tailwind CSS v4.3 (`@tailwindcss/vite`). **No new npm dependency** — see
[Dependency Budget](#dependency-budget). `bits-ui` is deliberately _not_ used (nothing to compose:
no open state, no positioning, no focus trap, no dismissible layer).

**Storage**: N/A — presentational component, no persistence.

**Testing**: Vitest 4 (jsdom, `globals: false`, `expect.requireAssertions: true`) +
`@testing-library/svelte` 5 + `@testing-library/user-event` 14; setup at `tests/setup.ts`; collected
by `src/**/*.{test,spec}.{js,ts}`.

**Target Platform**: Browsers (SvelteKit 2 SSR + client). Component is SSR-safe by construction — no
`window`/`document` access, no `$effect`.

**Project Type**: shadcn-svelte component registry + SvelteKit docs site (single repo, single app).

**Performance Goals**: Zero-JS-at-runtime component (pure markup + CSS). The ping animation is
CSS-only (`animate-ping` on a pseudo-element), so there is no per-frame JavaScript and no
observer/timer to leak.

**Constraints**: No `any`, no suppression comments, no config loosening (Principle VI). Semantic
tokens only, no raw palette colours, no manual `dark:` (Principle VIII). Component must not import
from `src/routes/**` or `src/lib/components/docs/**` (Principle V).

**Scale/Scope**: 3 exported components, 4 source files + 1 barrel, 1 test file + 1 test harness,
1 demo route with 4 preview sections + an API reference, 1 `registry.json` entry.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                                                                                                  |
| ---- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$props()` + `$bindable(null)` for `ref` + `$derived` for the resolved variant; `children`/`child` are snippets. No stores, no `export let`, no `createEventDispatcher`, no `<slot>`. No `<slug>.svelte.ts` because there is no reactive logic — see Decision 3.                                                          |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `radix/ui/status.tsx`, `base/ui/status.tsx`, `radix/status.mdx`, `types/radix/status.ts` and all four `status-*-demo.tsx` read at the pinned commit. Every prop, variant, `data-slot` and `data-variant` reproduced. All five divergences listed in `contracts/status-public-api.md` §6 are recorded in spec Assumptions. |
| III  | Accessibility Is a MUST             | PASS    | Upstream documents no role, no ARIA wiring and no keyboard model for this component. Test plan covers roles/accessible names, RTL, restProps forwarding, and keyboard reachability in `child` mode. Value/`disabled`/provider assertions are vacuous — see below.                                                         |
| IV   | Composition Over Reimplementation   | PASS    | Nothing bespoke beyond the `child` snippet; justification below.                                                                                                                                                                                                                                                          |
| V    | shadcn-svelte Distribution Model    | PASS    | `src/lib/components/ui/status/` with one part per file, `index.ts` barrel with short names + prefixed aliases + types, `.js`-extension intra-repo imports, exactly one `registry:ui` entry, zero imports from the docs app.                                                                                               |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Props typed from `WithElementRef<HTMLAttributes<HTMLDivElement>>`; the one runtime-cast in tests is `as unknown as StatusVariant` (no `any`, no ignore comment) to simulate untyped data.                                                                                                                                 |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final task; no `.skip`/`.todo`.                                                                                                                                                                                                             |
| VIII | Styling Discipline                  | PASS    | `tv()` in the root module script + `cn()` with `className` merged last; `success`/`warning`/`info`/`destructive`/`muted` tokens only; upstream's `dark:` pairs dropped because the tokens flip; `data-slot` on all three parts, `data-variant` on the root.                                                               |
| IX   | Every Component Is Documented       | PASS    | Four `<ComponentPreview>` sections — one per `status-demo`, `status-variants-demo`, `status-text-only-demo`, `status-list-demo` — plus an API/data-attribute reference. Demo state held in the page; no `+page.ts`.                                                                                                       |
| X    | One Feature Directory Per Component | PASS    | All artifacts written to `specs/001-port-status/`; no git write commands; no writes to `.reference/`, `scripts/`, `.port-*`.                                                                                                                                                                                              |

**Principle III note (vacuous requirements, not exceptions).** The principle's minimum list includes
uncontrolled `defaultValue`, controlled `value` + `onValueChange`, `disabled`/`readOnly` guard rails,
and the error thrown when a part is used outside its provider. Status has **none of these API
surfaces** — upstream exposes no value, no disabled state, and no context provider (spec Assumptions
record this). Those assertions are therefore not applicable rather than skipped. The equivalent
coverage for this component's only input — `variant` — is the five-variant matrix plus the
unknown-value fallback test, and the equivalent of "guard rails" is the `child`-mode contract test.

**Bespoke behaviour justification (Principle IV)**: One item.

- **`child` snippet on `Status` (root)** — replaces upstream's `asChild` (Radix `Slot`).
  Primitives evaluated: (1) `src/lib/components/ui/*` — no existing component exposes a reusable
  "render onto the caller's element" wrapper; `badge.svelte` solves the narrower case with
  `<svelte:element this={href ? 'a' : 'span'}>`, which hard-codes two tags and cannot carry an
  arbitrary caller-supplied element. (2) `bits-ui` — it ships the `child` snippet _pattern_ and the
  `WithChild` type, but only bundled into stateful primitives (`Dialog.Close`, `Popover.Trigger`, …);
  there is no standalone `Slot`/`Render` primitive to import, and pulling `bits-ui` in for a type
  alias would add a runtime dependency to a component that needs none. Svelte has no runtime
  prop-merging primitive equivalent to Radix `Slot`. The bespoke part is therefore ~6 lines: a
  `child?: Snippet<[{ props: StatusChildProps }]>` prop and an `{#if child}` branch that hands the
  already-merged attribute object to the caller. It follows the exact shape bits-ui uses, so the
  API stays familiar.

## Public API

Derived from `.reference/diceui/docs/registry/bases/radix/ui/status.tsx` and
`.reference/diceui/docs/types/radix/status.ts` at the pinned commit. The full contract, including
JSDoc text to copy verbatim, is in [contracts/status-public-api.md](./contracts/status-public-api.md).

### Barrel exports — `src/lib/components/ui/status/index.ts`

| Export                 | Kind      | Notes                                                      |
| ---------------------- | --------- | ---------------------------------------------------------- |
| `Root`                 | component | namespace form: `Status.Root`                              |
| `Indicator`            | component | namespace form: `Status.Indicator`                         |
| `Label`                | component | namespace form: `Status.Label`                             |
| `Status`               | component | alias of `Root` (upstream name)                            |
| `StatusIndicator`      | component | alias of `Indicator` (upstream name)                       |
| `StatusLabel`          | component | alias of `Label` (upstream name)                           |
| `statusVariants`       | value     | the `tv()` object — upstream exports `statusVariants` too  |
| `STATUS_VARIANTS`      | value     | `readonly ['default','success','error','warning','info']`  |
| `resolveStatusVariant` | value     | `(value?: string) => StatusVariant`, runtime fallback      |
| `StatusVariant`        | type      | `'default' \| 'success' \| 'error' \| 'warning' \| 'info'` |
| `StatusRootProps`      | type      |                                                            |
| `StatusIndicatorProps` | type      |                                                            |
| `StatusLabelProps`     | type      |                                                            |
| `StatusChildProps`     | type      | payload handed to the `child` snippet                      |

### `Status` / `Status.Root` — `status.svelte`

Renders `<div>` by default. Upstream counterpart: `function Status(props: StatusProps)`.

| Prop           | Type                                     | Default     | Bindable | Upstream                        |
| -------------- | ---------------------------------------- | ----------- | -------- | ------------------------------- |
| `ref`          | `HTMLDivElement \| null`                 | `null`      | **yes**  | `ref` (implicit via forwardRef) |
| `variant`      | `StatusVariant`                          | `'default'` | no       | `variant`                       |
| `class`        | `ClassValue`                             | `undefined` | no       | `className`                     |
| `children`     | `Snippet`                                | `undefined` | no       | `children`                      |
| `child`        | `Snippet<[{ props: StatusChildProps }]>` | `undefined` | no       | `asChild` (divergence)          |
| `...restProps` | `HTMLAttributes<HTMLDivElement>`         | —           | —        | `...rootProps`                  |

- **Snippets**: `children` (default content), `child` (render-onto-your-own-element escape hatch).
- **Callbacks/events**: none of its own. All standard DOM handlers (`onclick`, `onkeydown`,
  `onmouseenter`, …) arrive through `restProps` and are spread onto the rendered element — matching
  upstream, which forwards `...rootProps`.
- **Data attributes**: `data-slot="status"`, `data-variant="default|success|error|warning|info"`.
- **`child` contract**: when `child` is supplied it _replaces_ the default `<div>` entirely; the
  snippet receives one argument `{ props }` where `props` already contains `class`, `data-slot`,
  `data-variant` and every forwarded rest prop. `children` is **not** rendered in `child` mode (the
  caller renders its own content) and `ref` is **not** populated (the caller owns the element).
  Both facts are JSDoc'd on the prop and asserted in tests.

### `StatusIndicator` / `Status.Indicator` — `status-indicator.svelte`

| Prop           | Type                             | Default     | Bindable |
| -------------- | -------------------------------- | ----------- | -------- |
| `ref`          | `HTMLDivElement \| null`         | `null`      | **yes**  |
| `class`        | `ClassValue`                     | `undefined` | no       |
| `children`     | `Snippet`                        | `undefined` | no       |
| `...restProps` | `HTMLAttributes<HTMLDivElement>` | —           | —        |

Data attribute: `data-slot="status-indicator"` — **load-bearing**, it is the selector the root's
variant classes use (`**:data-[slot=status-indicator]:bg-…`) to colour the dot. No callbacks.

### `StatusLabel` / `Status.Label` — `status-label.svelte`

Same prop shape as `StatusIndicator`. Data attribute: `data-slot="status-label"`. No callbacks.

## Convention Decisions (this port sets the precedent)

| Decision                   | Choice for Status                                                                                                                                                         | Applies to later ports                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Folder                     | `src/lib/components/ui/<slug>/`, root `<slug>.svelte`, parts `<slug>-<part>.svelte`                                                                                       | always                                                                                                  |
| Where `tv()` lives         | root's `<script lang="ts" module>`, exported as `<slug>Variants` — mirrors `badge.svelte` / `alert.svelte`                                                                | always for variant tables                                                                               |
| `<slug>.svelte.ts`         | **omitted** — Status has no reactive logic; a runes module with nothing reactive in it would be noise                                                                     | created only when there is state/behaviour (collections, keyboard state machines, context)              |
| Context                    | **omitted** — the three parts never communicate; the root's variant reaches the indicator through a CSS descendant selector, exactly as upstream                          | Symbol-key context + throwing getter whenever parts genuinely share state                               |
| Barrel                     | short names first, then `//`, then prefixed aliases, then a separate `export { … , type … } from './<slug>.svelte'` line for variants/types                               | always (matches `alert/index.ts`, `badge/index.ts`)                                                     |
| `data-*` naming            | `data-slot="<slug>"` / `data-slot="<slug>-<part>"`; every variant/state as its own `data-<name>`; booleans as `cond ? '' : undefined`                                     | always                                                                                                  |
| `asChild` translation      | `child?: Snippet<[{ props: <Slug>ChildProps }]>`; snippet replaces the element, receives merged props, `children` ignored, `ref` not populated                            | always, and prefer bits-ui's own `child` when the part wraps a bits-ui primitive                        |
| Unknown variant at runtime | `resolve<Slug>Variant()` normalises to the default before both `tv()` and `data-variant`                                                                                  | whenever a variant union is exposed                                                                     |
| Test files                 | `<slug>.test.ts` (all specs) + `<slug>.test.svelte` (a single prop-driven harness for `bind:ref` and `child`, not collected by vitest, not in registry)                   | always — `.test.svelte` only when `bind:` or snippet-with-props needs a real component                  |
| Test structure             | one `describe` per part, plus `describe('variants')`, `describe('composition')`, `describe('child snippet')`, `describe('keyboard')`, `describe('accessibility and RTL')` | always, extended with `describe('controlled')` / `describe('uncontrolled')` / `describe('guard rails')` |
| Shared modules             | **none exported** — see [Shared Modules](#shared-modules)                                                                                                                 | a genuinely shared helper must become its own `registry:lib` item, never a cross-`registry:ui` import   |

**Test structure is eight top-level suites**, as enumerated in `tasks.md` T005: `Status`, `variants`,
`StatusIndicator`, `StatusLabel`, `composition`, `child snippet`, `keyboard`,
`accessibility and RTL`. The suite table in
[quickstart.md](./quickstart.md#test-suite-map) folds the keyboard assertions into its `child snippet`
row for brevity; the row above and T005 are authoritative — `keyboard` is its own suite (it also
covers the non-interactive default badge, which the `child snippet` suite does not), and it is where
FR-013 is asserted.

## Shared Modules

**Status exports no shared module, deliberately.** Deliverable 5 is answered as "none", with reason:

A registry item is copied verbatim into a consumer's project (Principle V). If `status` imported a
helper from, say, `src/lib/components/ui/_shared/child.ts`, that file would have to be installed
alongside it — which requires it to be its own registry item and a `registryDependency` of every
component that uses it. For the only candidate here — the `StatusChildProps` type, three lines of
`Record<string, unknown>` — that machinery costs more than it saves, and `$lib/utils.ts` is not an
option because consumers already have shadcn-svelte's own `utils.ts` and would never receive our
additions.

The reusable artifact is therefore **the pattern, not a module**: `status.svelte` is the reference
implementation of the `child` snippet, and later ports copy the six lines. Ports that already depend
on `bits-ui` for other reasons SHOULD instead reuse `bits-ui`'s exported `WithChild` type
(`node_modules/bits-ui/dist/shared/index.d.ts` re-exports `WithChild`, `WithChildren`, `Without`) so
the type is not duplicated where the dependency already exists.

If a third component needs the same non-trivial helper, the escalation path is a dedicated
`registry:lib` entry — not a reach-across import between two `registry:ui` folders.

## Dependency Budget

**New npm dependencies: zero.** Everything used is already in `package.json`:

| Package             | Version (already pinned) | Used for                             |
| ------------------- | ------------------------ | ------------------------------------ |
| `tailwind-variants` | `^3.3.0`                 | `tv()` variant table, `VariantProps` |
| `clsx`              | `^2.1.1`                 | via `cn()`                           |
| `tailwind-merge`    | `^3.6.0`                 | via `cn()`                           |
| `svelte`            | `^5.56.1`                | `Snippet` type                       |
| `tailwindcss`       | `^4.3.3`                 | `animate-ping`, `**:` variant        |

Upstream's `class-variance-authority` and `radix-ui` are **not** ported: `cva` is replaced by `tv()`
(already the project's convention) and Radix `Slot` by the `child` snippet.

Theme tokens: `--success`, `--warning`, `--info` (+ `-foreground`) already exist in `src/app.css`
for `:root` and `.dark` and are exposed through `@theme inline`. **This port does not modify
`src/app.css`.**

## Project Structure

### Documentation (this feature)

```text
specs/001-port-status/
├── plan.md                       # This file
├── spec.md                       # Feature specification
├── research.md                   # Phase 0 output
├── data-model.md                 # Phase 1 output
├── quickstart.md                 # Phase 1 output
├── contracts/
│   ├── status-public-api.md      # Phase 1 output — exact props, JSDoc, data attributes, class map
│   └── registry-item.json        # Phase 1 output — the exact registry.json entry to append
└── tasks.md                      # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/status/
├── index.ts                      # barrel: Root/Indicator/Label + Status/StatusIndicator/StatusLabel
│                                 #         + statusVariants, STATUS_VARIANTS, resolveStatusVariant
│                                 #         + StatusVariant, Status*Props, StatusChildProps
├── status.svelte                 # Root  ← radix/ui/status.tsx :: Status  (+ statusVariants table)
├── status-indicator.svelte       # Part  ← radix/ui/status.tsx :: StatusIndicator
├── status-label.svelte           # Part  ← radix/ui/status.tsx :: StatusLabel
├── status.test.ts                # colocated specs (NOT in registry.json)
└── status.test.svelte            # prop-driven harness for bind:ref + child (NOT in registry.json)

src/routes/docs/components/status/
└── +page.svelte                  # 4 <ComponentPreview> sections + API reference tables

registry.json                     # append exactly one registry:ui entry named "status"
static/r/status.json              # generated by `pnpm run registry:build` (git-ignored from lint)
```

**Structure Decision**: three parts, one file each, mapped 1:1 onto the upstream functions in
`.reference/diceui/docs/registry/bases/radix/ui/status.tsx`:
`Status` → `status.svelte`, `StatusIndicator` → `status-indicator.svelte`,
`StatusLabel` → `status-label.svelte`; upstream's exported `statusVariants` (`cva`) becomes the
exported `statusVariants` (`tv`) in the root's module script. No `status.svelte.ts` and no context
module, because the component holds no reactive state and its parts never communicate (spec
Assumptions). Slug consistency is satisfied: folder `status` == registry item `name: "status"` ==
demo route segment `src/routes/docs/components/status/`, which is what `src/lib/registry.ts` and the
docs sidebar build their links from.

## Implementation Schedule

Ordered; `/speckit-tasks` expands each line into tasks. Every deliverable requested is scheduled.

1. **Component source** (Deliverable 1) — `status.svelte` (module script: `tv()` table,
   `StatusVariant`, `STATUS_VARIANTS`, `resolveStatusVariant`, `StatusChildProps`, `StatusRootProps`;
   instance script: `$props()` destructure with `ref = $bindable(null)`, `$derived` resolved variant,
   `{#if child}` branch), then `status-indicator.svelte`, `status-label.svelte`, then `index.ts`.
   No `status.svelte.ts`, no `types.ts` — nothing to put in them (justified above).
2. **Tests** (Deliverable 2) — `status.test.svelte` harness first, then `status.test.ts` with the
   suites listed in [quickstart.md](./quickstart.md#test-suite-map): rendering, every prop, the five
   variants + unknown-value fallback, restProps/event forwarding, `bind:ref`, `class` merge
   precedence, composition permutations (both parts / label only / indicator only / neither),
   the `child` snippet contract incl. keyboard reachability and accessible name, roles, and RTL.
3. **Demo route** (Deliverable 3) — `src/routes/docs/components/status/+page.svelte` with
   `<ComponentPreview>` for _Default_, _Variants_, _Text Only_, _Service Status List_, plus an API
   reference built from `$lib/components/ui/table` (props per part + the `data-variant` table).
4. **Registry** (Deliverable 4) — append [contracts/registry-item.json](./contracts/registry-item.json)
   to `registry.json`'s `items`, then run `pnpm run registry:build`.
5. **Shared modules** (Deliverable 5) — none; the decision and its rationale are recorded above and
   in `research.md`. No task.
6. **Quality gates** — `pnpm run format`, then `check`, `lint`, `test:unit -- --run`, `build`, all
   green with zero suppressions.

## Complexity Tracking

> One recorded deviation: Principle III's minimum-assertion list is partly inapplicable. See the
> Principle III note above.

| Principle | Violation                                                                                                                                                                 | Why Needed                                                                                                                                                | Compliant Alternative Rejected Because                                                                                                                                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| III       | The minimum-assertion list (uncontrolled `defaultValue`, controlled `value` + `onValueChange`, `disabled`/`readOnly` guard rails, out-of-provider error) is not asserted. | Status exposes none of those API surfaces upstream — no value, no disabled state, no context provider (spec Assumptions; upstream `radix/ui/status.tsx`). | Writing them would require inventing API upstream does not have, which Principle II (non-negotiable) forbids. Compensating coverage: the five-variant matrix + unknown-value fallback (T007–T009) stands in for the value assertions, `describe('child snippet')` (T013) for the guard-rail contract, and T012 asserts that a standalone part deliberately does **not** throw. |

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 (`data-model.md`, `contracts/`, `quickstart.md`):

- **I** — the design uses `$props`, `$bindable`, `$derived` and snippets only; the absence of
  `$effect` is a feature (nothing to tear down). PASS.
- **II** — `contracts/status-public-api.md` lists every upstream prop and data attribute with its
  upstream JSDoc; the class map records each upstream utility and its translated form, so any drift
  is auditable line by line. All five divergences (`asChild` → `child`, palette + `dark:` pairs →
  semantic tokens, `cva` → `tv()`, unknown-variant fallback, Base-UI `render` variant not ported) are
  recorded in spec Assumptions. PASS.
- **III** — test suite map covers roles, accessible names, RTL, and keyboard reachability; the
  value/disabled/provider assertions remain not applicable for the reasons stated above. PASS.
- **IV** — design added no further bespoke behaviour beyond the justified `child` snippet. PASS.
- **V** — `contracts/registry-item.json` lists all four shipped files and excludes both test files;
  no docs-app import appears anywhere in the design. PASS.
- **VI** — no `any` anywhere in the contract; the single test-only double assertion is documented.
  PASS.
- **VII** — gates scheduled as step 6. PASS.
- **VIII** — the class map in the contract uses only `muted`, `muted-foreground`, `destructive`,
  `success`, `warning`, `info` tokens; `className` merged last in all three parts. PASS.
- **IX** — four preview sections, one per upstream demo file. PASS.
- **X** — all artifacts under `specs/001-port-status/`. PASS.

No new violations. Complexity Tracking carries exactly one row — the Principle III minimum-assertion
list that is inapplicable to a component with no value, no disabled state and no provider — recorded
there because the constitution's Compliance Review requires any carried-forward deviation to appear
in that table rather than only in prose.
