# Implementation Plan: Port Swap Component

**Branch**: `005-port-swap` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-port-swap/spec.md`

## Summary

Port Dice UI's **Swap** — a two-faced toggle that shows an "on" face or an "off" face, activated by click
(default, exposed as a toggle button) or by hover (a momentary preview with no interactive role) — to Svelte 5
runes, as a shadcn-svelte registry item.

Technical approach: three `.svelte` parts (`Swap`, `SwapOn`, `SwapOff`) over one `SwapState` runes class
shared through a `Symbol` context key. Upstream's `useSyncExternalStore` pub/sub, `useLazyRef`, `useAsRef` and
`useIsomorphicLayoutEffect` collapse into `$state`/`$derived` plus a `$bindable` `swapped` prop seeded from
`defaultSwapped`; `asChild` becomes the repo's `child` snippet. The four `animation` styles stay
data-attribute-driven exactly as upstream (`data-animation` on the root, ancestor-scoped utilities on the
faces), so no `tv()` and no new dependency is needed. `prefers-reduced-motion` is honoured twice over: the
upstream `motion-reduce:` utilities are kept verbatim, and a new reusable `useReducedMotion()` reader drops
the transition utilities and stamps `data-motion="reduce"` so the guarantee is observable and testable.

Full API in [`contracts/swap-public-api.md`](./contracts/swap-public-api.md); decisions and rejected
alternatives in [`research.md`](./research.md); state semantics in [`data-model.md`](./data-model.md).

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`) + Svelte 5.56 with runes forced on
(`vite.config.ts`)

**Primary Dependencies**: SvelteKit 2, Tailwind CSS v4, `clsx` + `tailwind-merge` via `cn()`
(`$lib/utils.js`), `@lucide/svelte` (demo page only). `bits-ui` is available but **not** composed here — see
the Principle IV justification. **Zero new npm dependencies.**

**Storage**: N/A — no persistence; component state only.

**Testing**: Vitest 4 (jsdom, `globals: false`, `expect.requireAssertions: true`) +
`@testing-library/svelte` 5 + `@testing-library/user-event` 14; setup at `tests/setup.ts`.

**Target Platform**: Browsers via SvelteKit SSR + hydration; the component is SSR-safe (`window`/`matchMedia`
guarded).

**Project Type**: Component library shipped as source through a shadcn-svelte registry, with a SvelteKit docs
site in the same repo.

**Performance Goals**: No measurable runtime cost — one context lookup per part, no observers, no timers. The
single `$effect` (the `matchMedia` `change` subscription) returns a teardown. Rendering is one `div` per part.

**Constraints**: No `any`, no suppression comments, no config loosening; semantic Tailwind tokens only;
`class` merged last; every state exposed as `data-*`; SSR-safe; no reimplementation of anything `bits-ui`
already provides.

**Scale/Scope**: 5 shipped files + 1 test + 1 test harness + 1 demo route + 1 registry entry. ~330 LOC of
component source, ~450 LOC of tests.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                                                                                                                       |
| ---- | ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$props`/`$bindable`/`$effect` + snippets only; behaviour in `swap.svelte.ts` as `SwapState`, reactive inputs passed as getter functions. No stores, `export let`, `createEventDispatcher`, `$:` or `<slot>`.                                                                                                                |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `swap.tsx`, `types/radix/swap.ts`, `swap.mdx` and both demos read at pin `d9763d8`; every prop, default, JSDoc, data attribute and keyboard row reproduced; the six divergences are tabulated in `contracts/swap-public-api.md` §6 and in spec.md's Assumptions.                                                                                 |
| III  | Accessibility Is a MUST             | PASS    | Toggle-button pattern in click mode (`role="button"`, `aria-pressed`, `tabindex=0`, `Enter`/`Space` with `preventDefault`); no role and no focus in hover mode (FR-009); `aria-disabled` + no `tabindex` when disabled. Tests cover roles/ARIA, keyboard, uncontrolled, controlled, disabled, provider-error and RTL.                            |
| IV   | Composition Over Reimplementation   | PASS    | See the justification below — five candidate primitives evaluated and named, each with the specific missing capability. `direction-provider` is composed for the RTL path.                                                                                                                                                                      |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `src/lib/components/ui/swap/`; one part per file; logic in `swap.svelte.ts`; `index.ts` barrel with short names + prefixed aliases + types; `.js` extensions on every intra-repo import; exactly one `registry:ui` entry; no import from `src/routes/**` or `$lib/components/docs/**`.                                                |
| VI   | TypeScript Strict, No Suppressions  | PASS    | No `any` and no `as any`; prop types declared and exported from `<script lang="ts" module>`; DOM props from `WithElementRef<HTMLAttributes<HTMLDivElement>>`; handler types from `svelte/elements`. No `@ts-ignore`/`@ts-expect-error`/`eslint-disable`/`svelte-ignore` — the one foreseeable a11y warning is designed out (research D-004), not silenced. |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final task phase; no test skipped, `.todo`'d or emptied.                                                                                                                                                                                                          |
| VIII | Styling Discipline                  | PASS    | `cn()` only (no `tv()` needed — `animation` is data-attribute-driven upstream); caller `class` merged last; upstream classes contain no palette colours, no `dark:`, no `space-*`, no `z-index`; `data-slot="swap"`/`"swap-on"`/`"swap-off"` on every part; booleans written `cond ? '' : undefined`.                                            |
| IX   | Every Component Is Documented       | PASS    | `/docs/components/swap` with one `<ComponentPreview>` per upstream demo (`swap-demo` split into its two labelled halves — "Click to swap", "Hover to swap" — and `swap-animations-demo`), plus a Controlled preview exercising `bind:swapped`, plus props and data-attribute tables.                                                             |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/005-port-swap/`; no renumbering, no other feature directory touched; no git write commands; `.port-state.json`, `.port-logs/**`, `scripts/**`, `.reference/**` untouched.                                                                                                                                            |

**Bespoke behaviour justification (Principle IV)**: The root's activation/handler logic, `SwapState` and
`useReducedMotion` are hand-written. Primitives evaluated and the capability each lacks:

- **`bits-ui` `Toggle`** — one pressable control with a single `pressed` value and one child; it has no
  two-face slot model, and it hard-codes `role="button"`/`aria-pressed`, which Swap must **omit** in `hover`
  mode (FR-009).
- **`bits-ui` `Switch`** — a form control (`role="switch"`, hidden input, `name`/`value`, form submission).
  Swap is not a form control and must not submit anything.
- **`$lib/components/ui/toggle`** — a styled `<button>` over the same `bits-ui` Toggle; identical gaps, and a
  `<button>` cannot legally host the arbitrary content upstream's faces allow.
- **`$lib/components/ui/collapsible` / `tabs`** — two-branch content switching with disclosure/tablist ARIA,
  which is the wrong pattern for a toggle icon.
- **A reduced-motion primitive** — none exists: `bits-ui@2.18.1`'s `dist/` contains no `prefers-reduced-motion`,
  `ReducedMotion` or `MediaQuery` export (verified by grep), and this repo has no equivalent helper. Hence
  `useReducedMotion()`, written once here and exported for reuse.

What **is** composed: `$lib/components/ui/direction-provider` (RTL context for tests and demo), `cn()` from
`$lib/utils.js`, the shadcn `table` + `ComponentPreview` on the docs route, and `@lucide/svelte` icons.

## Public API

Derived from `.reference/diceui/docs/registry/bases/radix/ui/swap.tsx` and `docs/types/radix/swap.ts` at the
pinned commit. Authoritative copy, with rendered-attribute and class-string detail:
[`contracts/swap-public-api.md`](./contracts/swap-public-api.md).

### `<Swap>` — root (`swap.svelte`, exported as `Root` and `Swap`)

`SwapRootProps extends WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement>`

| Prop              | Type                                      | Default     | Bindable |
| ----------------- | ----------------------------------------- | ----------- | -------- |
| `ref`             | `HTMLDivElement \| null`                  | `null`      | **yes**  |
| `swapped`         | `boolean \| undefined`                    | `undefined` | **yes**  |
| `defaultSwapped`  | `boolean`                                 | `false`     | no       |
| `onSwappedChange` | `(swapped: boolean) => void`              | `undefined` | no       |
| `activationMode`  | `'click' \| 'hover'`                      | `'click'`   | no       |
| `animation`       | `'fade' \| 'rotate' \| 'flip' \| 'scale'` | `'fade'`    | no       |
| `disabled`        | `boolean`                                 | `false`     | no       |
| `class`           | `ClassValue`                              | `undefined` | no       |
| `children`        | `Snippet`                                 | `undefined` | no       |
| `child`           | `Snippet<[{ props: SwapChildProps }]>`    | `undefined` | no       |
| `onclick`         | `MouseEventHandler<HTMLDivElement>`       | `undefined` | no       |
| `onmouseenter`    | `MouseEventHandler<HTMLDivElement>`       | `undefined` | no       |
| `onmouseleave`    | `MouseEventHandler<HTMLDivElement>`       | `undefined` | no       |
| `onkeydown`       | `KeyboardEventHandler<HTMLDivElement>`    | `undefined` | no       |
| `...restProps`    | `HTMLAttributes<HTMLDivElement>`          | —           | no       |

- **Snippets**: `children` (no params) · `child({ props: SwapChildProps })` — the `asChild` replacement; in
  `child` mode `children` is not rendered and `ref` stays `null`.
- **Callbacks/events**: `onSwappedChange(swapped: boolean)` fires on component-driven change. The four DOM
  handlers above run **before** the built-in behaviour and can veto it with `event.preventDefault()`
  (FR-014). Every other DOM handler passes through `restProps`.
- **Rendered attributes**: `data-slot="swap"`, `data-state="on"|"off"`, `data-animation`,
  `data-disabled=""` when disabled, `data-motion="reduce"` under reduced motion, `role="button"` +
  `aria-pressed` + `tabindex=0` in click mode only, `aria-disabled="true"` when disabled.

### `<SwapOn>` (`swap-on.svelte` → `On` / `SwapOn`) and `<SwapOff>` (`swap-off.svelte` → `Off` / `SwapOff`)

`SwapOnProps` / `SwapOffProps` `extends WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement>`

| Prop           | Type                                       | Default     | Bindable |
| -------------- | ------------------------------------------ | ----------- | -------- |
| `ref`          | `HTMLDivElement \| null`                   | `null`      | **yes**  |
| `class`        | `ClassValue`                               | `undefined` | no       |
| `children`     | `Snippet`                                  | `undefined` | no       |
| `child`        | `Snippet<[{ props: SwapFaceChildProps }]>` | `undefined` | no       |
| `...restProps` | `HTMLAttributes<HTMLDivElement>`           | —           | no       |

No callbacks. Both expose `data-slot="swap-on"`/`"swap-off"` and `data-state="on"|"off"`, and both throw
``` `<SwapOn>` must be used within `<Swap>`. ``` when rendered outside the root (FR-013).

### Module exports (`swap.svelte.ts`, re-exported from the barrel)

`SWAP_ACTIVATION_MODES`, `SWAP_ANIMATIONS`, `resolveSwapActivationMode`, `resolveSwapAnimation`,
`getSwapDataState`, `SwapState`, `setSwapContext`, `hasSwapContext`, `getSwapContext`, `useSwap`
(upstream-parity name for `useStore as useSwap`), `ReducedMotionReader`, `useReducedMotion`, and the types
`SwapActivationMode`, `SwapAnimation`, `SwapDataState`, `SwapChildProps`, `SwapFaceChildProps`,
`SwapRootProps`, `SwapOnProps`, `SwapOffProps`.

**Shared module exported for later components (deliverable 5)**: `useReducedMotion()` /
`ReducedMotionReader` — a runes reader over `(prefers-reduced-motion: reduce)` with SSR guards and an
`$effect` teardown. It lives in `swap.svelte.ts` because the repo has no `src/lib/hooks/` tree and Principle V
keeps registry files inside the component folder; promoting it later is a file move plus a re-export.

## Project Structure

### Documentation (this feature)

```text
specs/005-port-swap/
├── plan.md                        # This file (/speckit-plan output)
├── spec.md                        # Input
├── research.md                    # Phase 0 — 12 decisions, alternatives, divergence rationale
├── data-model.md                  # Phase 1 — SwapState, ReducedMotionReader, value sets, attributes
├── quickstart.md                  # Phase 1 — usage + 13 validation scenarios + gate commands
├── contracts/
│   └── swap-public-api.md         # Phase 1 — authoritative API surface, class strings, divergence ledger
├── checklists/
│   └── requirements.md            # from /speckit-specify
└── tasks.md                       # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/swap/
├── index.ts                       # barrel: Root/On/Off + Swap/SwapOn/SwapOff + types + module exports
├── swap.svelte                    # Root  ← swap.tsx `Swap`
├── swap-on.svelte                 # On    ← swap.tsx `SwapOn`
├── swap-off.svelte                # Off   ← swap.tsx `SwapOff`
├── swap.svelte.ts                 # SwapState, Symbol context, useSwap, useReducedMotion, value sets
│                                  #        ← swap.tsx `Store`/`useStore`/`getDataState` + its three hooks
├── swap.test.ts                   # colocated tests (NOT in registry.json)
└── swap.test.svelte               # harness for bind: and child snippets (NOT in registry.json)

src/routes/docs/components/swap/
└── +page.svelte                   # Click to swap · Hover to swap ← swap-demo.tsx
                                   # Animations                    ← swap-animations-demo.tsx
                                   # Controlled (bind:swapped)     · props + data-attribute tables

registry.json                      # append exactly one registry:ui entry named "swap"
static/r/swap.json                 # generated by `pnpm run registry:build`
```

**Structure Decision**: Upstream ships all three parts in one `swap.tsx`; Principle V requires one part per
file, so `Swap` → `swap.svelte`, `SwapOn` → `swap-on.svelte`, `SwapOff` → `swap-off.svelte`. Upstream's
non-component machinery (`getDataState`, `StoreContext`, `useStore`, and the `use-as-ref` / `use-lazy-ref` /
`use-isomorphic-layout-effect` hooks it imports) collapses into `swap.svelte.ts`; those three upstream hook
files have no Svelte counterpart and are not ported (research D-001). Folder slug `swap` == registry item
name `swap` == demo route segment `src/routes/docs/components/swap/` — confirmed against `src/lib/registry.ts`'s
`registry:ui` filter, which is what the docs sidebar links from.

### Implementation sequence (input to `/speckit-tasks`)

1. `swap.svelte.ts` — value sets + resolvers + `getSwapDataState`; `SwapState`; `Symbol` context trio +
   `useSwap`; `ReducedMotionReader` + `useReducedMotion`.
2. `swap.svelte` — props type with upstream JSDoc/`@default` copied verbatim; `swapped ??= defaultSwapped`;
   `setSwapped` with the `Object.is` short-circuit; the four composed handlers; the `$derived` `rootAttrs`
   object; `child` vs default branch; `setSwapContext`.
3. `swap-on.svelte` / `swap-off.svelte` — `getSwapContext('<SwapOn>')`, mirrored class lists, `child` branch.
4. `index.ts` barrel.
5. `swap.test.svelte` harness (bindings, `child` snippet, RTL wrapper, ref reporting).
6. `swap.test.ts` — the 13 scenarios in `quickstart.md`, grouped by user story. The reduced-motion test stubs
   `window.matchMedia` with `vi.stubGlobal` and calls `vi.unstubAllGlobals()` in a local `afterEach`
   (`tests/setup.ts` is **not** modified).
7. `src/routes/docs/components/swap/+page.svelte` — four previews + props/data-attribute tables, following
   `src/routes/docs/components/stat/+page.svelte`.
8. `registry.json` entry, then `pnpm run registry:build`.
9. Quality gates: `format` → `check` → `lint` → `test:unit -- --run` → `build`.

### Known implementation risks (and the compliant mitigation)

| Risk                                                                                                               | Mitigation                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `svelte-check` a11y warning on a `div` with a conditional `role` plus static handlers (`check` must be warning-free) | Emit every attribute and handler through the `$derived` `rootAttrs` spread (research D-004) — the pattern `status.svelte` already uses. Never `svelte-ignore`.       |
| `matchMedia` read during SSR                                                                                        | `typeof window === 'undefined' \|\| typeof window.matchMedia !== 'function'` guard; the reader defaults to `false` (animated), matching upstream's server output.    |
| jsdom's `matchMedia` shim in `tests/setup.ts` is assigned with `??=` and always reports `matches: false`             | Per-test `vi.stubGlobal('matchMedia', …)` + `vi.unstubAllGlobals()`; no edit to the shared setup file.                                                              |
| Prettier's Tailwind plugin reorders the upstream class strings                                                      | Run `pnpm run format` first, and assert class **membership** rather than the concatenated string (the `status.test.ts` convention).                                  |
| `userEvent.hover()` must reach `onmouseenter`                                                                       | `user-event` v14 dispatches `mouseover` + `mouseenter` (and `mouseleave` on `unhover`); tests drive hover through `userEvent`, never `fireEvent`.                    |

## Complexity Tracking

> No Constitution Check violations, so this table is intentionally empty. The bespoke root logic is not a
> Principle IV violation — that principle permits bespoke code with a written justification, which is recorded
> in the Constitution Check above and in `research.md` D-006.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | none      | —          | —                                      |

## Post-Design Constitution Re-check

Re-evaluated after Phase 1 (`data-model.md`, `contracts/swap-public-api.md`, `quickstart.md`): **all ten
principles still PASS.** The design adds exactly one thing not present upstream — the `data-motion="reduce"`
attribute and its `useReducedMotion()` reader — which is additive (it renames nothing and removes nothing), is
recorded in the divergence ledger (`contracts/swap-public-api.md` §6, row 5), and is required by spec FR-012 /
SC-004, so Principle II is unaffected. No new dependency, no suppression, and no docs-app import entered the
design.
