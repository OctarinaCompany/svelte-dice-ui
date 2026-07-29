# Implementation Plan: Direction Provider

**Branch**: `002-port-direction-provider` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-port-direction-provider/spec.md`

## Summary

Port Dice UI's `direction-provider` utility — a context provider carrying a `"ltr" | "rtl"` value plus
a `useDirection()` reader that resolves `explicit ?? provider ?? "ltr"` — to Svelte 5 runes.

Technical approach: a `.svelte.ts` runes module (`direction-provider.svelte.ts`) owns the whole
contract — the `Direction` union, a `Symbol`-keyed context, a `DirectionProviderState` holder, a
`DirectionReader` class whose `current` field is a `$derived` precedence chain, and the
`useDirection()` factory. The `.svelte` file is a thin wrapper that instantiates the state, publishes
it on context, and renders a layout-transparent (`display: contents`) `<div dir={dir}>` so the
resolved direction is also present in the DOM for the spec's DOM-attribute fallback (FR-006) and for
native browser bidi. This module is the **shared direction primitive** every later RTL-aware port
(select, menu, slider, carousel, tags-input…) imports instead of re-deriving direction.

`bits-ui` ships **no** direction primitive (verified: no `useDirection` / `DirectionProvider` symbol
anywhere in `node_modules/bits-ui/dist`), so this behaviour is necessarily bespoke — see the
Principle IV justification below.

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`), Svelte 5.56 with runes forced on
repo-wide in `vite.config.ts`

**Primary Dependencies**: `svelte` (`setContext`/`getContext`/`hasContext`, runes) only. `bits-ui`
evaluated and not applicable — it exposes no direction primitive. `tailwind-variants` not needed: the
component has exactly one class (`contents`) and no variants, so plain `cn()` is correct per
Principle VIII / `styling.md` "Use cn() for conditional classes".

**Storage**: N/A — direction exists only for the lifetime of the component tree (spec, Key Entities).

**Testing**: Vitest 4 (jsdom, `globals: false`, `expect.requireAssertions`) +
`@testing-library/svelte` 5 + `@testing-library/user-event` 14. Colocated at
`src/lib/components/ui/direction-provider/direction-provider.test.ts`, with a
`direction-provider.test.svelte` harness for the cases a `.ts` spec cannot express (nested providers,
a consumer that calls `useDirection()` during its own init, runtime `dir` flips).

**Target Platform**: Browser (SvelteKit 2 app + shadcn-svelte registry consumers). SSR-safe: no
`document` access outside `$effect`, so on the server the reader resolves
`explicit ?? provider ?? "ltr"` with the DOM fallback simply absent.

**Project Type**: Component library shipped as source through a shadcn-svelte registry.

**Performance Goals**: No render cost — the resolved value is a `$derived` chain over at most three
inputs. The DOM fallback costs one `MutationObserver` per reader instance, filtered to
`attributeFilter: ['dir']`, and is torn down by the effect's return.

**Constraints**: No new npm dependencies (none needed — zero added). No `any`, no suppressions. The
provider must not alter layout: the wrapper uses `display: contents`. `useDirection()` must never
throw when no provider is present (FR-005) and must be callable during component initialisation only
(it opens a `$effect` and reads context).

**Scale/Scope**: 3 shipped files + 2 test files + 2 docs files + 1 registry entry. One exported
component, one exported reader factory, two exported classes, one exported context accessor pair,
one exported type union.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                       |
| ---- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I    | Svelte 5 Runes Only                 | PASS    | `$props`/`$derived`/`$state`/`$effect` + snippets only; all reactive logic in `direction-provider.svelte.ts` as `DirectionProviderState` / `DirectionReader` classes taking getter functions. No stores, `export let`, `$:`, `<slot>`. |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | Four upstream files read at pin `d9763d8` (radix `components/direction-provider.tsx`, radix `ui/direction.tsx`, `shared/src/hooks/use-direction.ts`, `docs/types/radix/utilities.ts` + the utilities MDX). Precedence chain, `@default "ltr"` JSDoc and both export names reproduced. Four divergences, all recorded in spec Assumptions.        |
| III  | Accessibility Is a MUST             | PASS    | Component is non-interactive and non-focusable: no role, no `aria-*`, no accessible name, no keyboard map (see research Decision 6). The a11y obligation here is **RTL itself** — it is the primitive every other component's RTL inversion reads from — plus a test asserting the wrapper adds no role and no accessible name to the tree. |
| IV   | Composition Over Reimplementation   | PASS    | `src/lib/components/ui/*` has nothing directional; `bits-ui` exposes no direction primitive (grep of `node_modules/bits-ui/dist` for `useDirection`/`DirectionProvider`: zero hits). Bespoke, justified below.                    |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `src/lib/components/ui/direction-provider/`, root `direction-provider.svelte`, runes module `direction-provider.svelte.ts`, `index.ts` barrel with short name + prefixed alias + types, `.js` extensions on every intra-repo import, exactly one `registry:ui` entry, no import from `src/routes/**` or `src/lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Props type in `<script lang="ts" module>`, built from `WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'dir'>>` so the native loose `dir?: string` cannot widen the union. No `any`, no ignore comments, no config edits.     |
| VII  | Green Gate Before Commit            | PASS    | `pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build`, scheduled as the final task. No `.skip`/`.todo`; every `it` asserts.                                                                                       |
| VIII | Styling Discipline                  | PASS    | Single utility `contents` merged through `cn(..., className)` with the caller's class last; `data-slot="direction-provider"` and `data-dir` expose the only state. No colours, no `dark:`, no `space-*`, no `z-index`.           |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/direction-provider/+page.svelte`. Upstream ships **no** `*-demo.tsx` for this utility; the MDX shows two code examples (provider, `useDirection`), which become two `<ComponentPreview>`s, plus a third for the fallback behaviour SC-004 requires. Props + data-attribute tables mirror the Status page. |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/002-port-direction-provider/`; no git write commands; no writes to `.reference/`, `scripts/`, `.port-*`.                                                                                             |

**Bespoke behaviour justification (Principle IV)**:

| Behaviour                                                | Primitive evaluated                                                     | Capability it lacks                                                                                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direction context + reader (`useDirection`)              | `bits-ui` 2.18 — searched `dist/**` for `useDirection`, `DirectionProvider`; `src/lib/components/ui/*` — no directional component exists yet | Zero hits. bits-ui components each take their own per-instance `dir` prop and share no ambient direction context, so there is nothing to compose. This is exactly the `@diceui/shared` behaviour Principle IV expects to find in bits-ui, and it is genuinely absent. |
| DOM `dir` fallback (`element.closest('[dir="ltr"], [dir="rtl"]')` + `MutationObserver`) | Same as above; also checked for a `useDirection`-like helper in `bits-ui/dist/internal` | No equivalent. This is the spec's deliberate strengthening of upstream (spec Assumption 2) and has no upstream or bits-ui counterpart to compose.                 |

Both are ~40 lines of pure logic with no focus management, portalling, or positioning — none of the
accessibility-liability surface Principle IV exists to protect.

**Post-Phase-1 re-check**: re-evaluated after `data-model.md`, `contracts/` and `quickstart.md` were
written. All ten verdicts stand unchanged; the design added no dependency, no suppression, no
palette colour and no extra folder. Complexity Tracking remains empty.

## Public API

Everything below is exported from `src/lib/components/ui/direction-provider/index.ts`. Source of
truth: `.reference/diceui/packages/shared/src/hooks/use-direction.ts` (precedence chain),
`.reference/diceui/docs/registry/bases/radix/ui/direction.tsx` (component shape) and
`.reference/diceui/docs/types/radix/utilities.ts` (`DirectionProviderProps` JSDoc). Full detail in
[contracts/direction-provider-public-api.md](./contracts/direction-provider-public-api.md).

### Component — `DirectionProvider` (also exported as `Root`)

File: `direction-provider.svelte`. Renders `<div data-slot="direction-provider" data-dir={dir}
dir={dir} class="contents">` around `children`.

| Prop         | Type                                              | Default   | Bindable | Notes                                                                                                       |
| ------------ | ------------------------------------------------- | --------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `dir`        | `Direction` (`'ltr' \| 'rtl'`)                    | `'ltr'`   | no       | Upstream JSDoc: _"The direction of the text. @default 'ltr'"_. Upstream types it required; optional here so FR-002's documented default is reachable. Never mutated internally, so `$bindable` would be dead surface (research Decision 5). |
| `ref`        | `HTMLDivElement \| null`                          | `null`    | **yes**  | `bind:this` on the wrapper — the Svelte replacement for `forwardRef`.                                       |
| `class`      | `ClassValue`                                      | —         | no       | Destructured as `class: className`, merged **last** through `cn('contents', className)`.                    |
| `children`   | `Snippet`                                         | —         | no       | Rendered with `{@render children?.()}`.                                                                     |
| `...restProps` | `Omit<HTMLAttributes<HTMLDivElement>, 'dir'>`   | —         | —        | Spread onto the wrapper (FR-010). `dir` is omitted from the base type so the native `dir?: string` cannot widen `Direction`. |

Snippets: `children` only. Callbacks/events: **none** — upstream has no `onDirChange`; adding one
would be drift. There is no `child` snippet: upstream has no `asChild` on this component (research
Decision 4).

### Reader — `useDirection(options?)`

```ts
export type UseDirectionOptions = {
	/** Explicit override. When it returns a value it wins over the provider and the DOM. */
	dir?: () => Direction | undefined;
	/** Element the DOM fallback walks up from. @default document.documentElement */
	element?: () => HTMLElement | null | undefined;
};

export function useDirection(options?: UseDirectionOptions): DirectionReader;
```

Returns a `DirectionReader` with one public member, `readonly current: Direction`, a `$derived`
evaluating `options.dir?.() ?? providerContext?.current ?? domDir ?? 'ltr'`. Must be called during
component initialisation (it reads context and opens an `$effect`). Never throws when no provider is
present (FR-005).

The DOM fallback's anchor defaults to `document.documentElement` — a bare `useDirection()` therefore
consults the document root only. A consumer that must honour a nearer ancestor `dir` (FR-006, US2-2)
MUST pass `element: () => <its own node>`.

### Classes, context and helpers (the shared module later ports reuse)

| Export                                          | Kind        | Purpose                                                                                                                       |
| ----------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Direction`                                     | type        | `'ltr' \| 'rtl'` — mirrors `@diceui/shared`'s `Direction`.                                                                    |
| `DIRECTIONS`                                    | const       | `['ltr', 'rtl'] as const` — the union's runtime form, for tests and `isDirection`.                                            |
| `isDirection(value: unknown)`                   | type guard  | Narrows to `Direction`; how the "invalid `dir` attribute is treated as absent" edge case is enforced.                         |
| `DirectionProviderState`                        | class       | Holds the provider's `readonly current: Direction` (`$derived` over a getter).                                                |
| `setDirectionContext(state)`                    | function    | `setContext(DIRECTION_CONTEXT_KEY, state)` — called by the root.                                                              |
| `hasDirectionContext()`                         | function    | Non-throwing probe used by `useDirection`.                                                                                    |
| `getDirectionContext()`                         | function    | **Throwing** accessor for future parts that genuinely require a provider. Message: `` `<Part>` must be used within `<DirectionProvider>`. `` |
| `DirectionReader`                               | class       | The reader instance type (`current`).                                                                                         |
| `UseDirectionOptions`                           | type        | Options bag above.                                                                                                            |
| `DirectionProviderProps`                        | type        | Root props (from the `.svelte` module script).                                                                                |

## Project Structure

### Documentation (this feature)

```text
specs/002-port-direction-provider/
├── plan.md                                   # This file
├── research.md                               # Phase 0 output
├── data-model.md                             # Phase 1 output
├── quickstart.md                             # Phase 1 output
├── contracts/
│   ├── direction-provider-public-api.md      # Phase 1 output
│   └── registry-item.json                    # Phase 1 output
└── tasks.md                                  # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/direction-provider/
├── index.ts                          # barrel: Root/DirectionProvider + reader + classes + types
├── direction-provider.svelte         # Root — the only rendered part
├── direction-provider.svelte.ts      # Direction union, Symbol context, state classes, useDirection
├── direction-provider.test.svelte    # test harness (NOT in registry.json, not collected by Vitest)
└── direction-provider.test.ts        # colocated tests (NOT in registry.json)

src/routes/docs/components/direction-provider/
├── +page.svelte                      # 3 <ComponentPreview> sections + props/data-attribute tables
└── direction-consumer.svelte         # docs-only consumer that calls useDirection() and reports it

registry.json                         # append exactly one registry:ui entry
```

**Structure Decision**:

| File                            | Upstream counterpart under `.reference/diceui`                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `direction-provider.svelte`     | `docs/registry/bases/radix/ui/direction.tsx` + `docs/registry/bases/radix/components/direction-provider.tsx` (identical wrappers over `radix-ui`'s `Direction.DirectionProvider`) |
| `direction-provider.svelte.ts`  | `packages/shared/src/hooks/use-direction.ts` (`DirectionContext` + `useDirection`) and `packages/shared/src/types.ts` (`export type Direction = "ltr" \| "rtl"`) |
| `index.ts`                      | the `export { DirectionProvider, useDirection }` line of both upstream wrappers                              |
| `+page.svelte`                  | `docs/content/docs/utilities/radix/direction-provider.mdx` — Usage block and API-Reference `useDirection` block |
| `direction-provider.test.ts`    | no upstream test file exists (searched `.reference/diceui` for `*direction*`), so Principle III's list is the floor |

Slug consistency: folder `direction-provider` == registry item `name` == demo route segment
`/docs/components/direction-provider`. ✅

Two files are deliberately **not** in the registry entry: `direction-provider.test.ts` (Principle V
excludes tests) and `direction-provider.test.svelte` (a harness that exists only to drive those
tests). `direction-consumer.svelte` lives under `src/routes/**`, so the dependency arrow still points
docs → component and never back.

### Implementation order (what `/speckit-tasks` will expand)

1. `direction-provider.svelte.ts` — types, `isDirection`, Symbol context, `DirectionProviderState`,
   `DirectionReader`, `useDirection`, `resolveDomDirection`.
2. `direction-provider.svelte` — props type, context publication, `contents` wrapper.
3. `index.ts` barrel.
4. `direction-provider.test.svelte` harness + `direction-provider.test.ts` (test areas listed in
   [quickstart.md](./quickstart.md) §3).
5. `src/routes/docs/components/direction-provider/{direction-consumer.svelte,+page.svelte}`.
6. Append `contracts/registry-item.json` to `registry.json`; run `pnpm run registry:build`.
7. Quality gates: `pnpm run format` then the four gates of Principle VII.

## Complexity Tracking

> No Constitution Check violations. This section is intentionally empty.
