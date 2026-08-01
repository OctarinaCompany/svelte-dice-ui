# Implementation Plan: Port Stack Component

**Branch**: `039-port-stack` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/039-port-stack/spec.md`

## Summary

Port Dice UI's **Stack** — a Sonner-style cascading card layout that scales, offsets and dims items
behind the front one, and fans them out on hover — to Svelte 5 as a shadcn-svelte registry item.

Two public parts, `Stack.Root` and `Stack.Item`, backed by one state class in `stack.svelte.ts`.
Because Svelte cannot enumerate or wrap the children of a snippet, upstream's
`React.Children.toArray` + internal `StackItemWrapper` becomes **self-registration**: each
`Stack.Item` registers its wrapper element with the root through context, takes its index from the
project's existing `DomOrderedCollection` (document order), and renders both of upstream's elements
itself — so the emitted DOM, data attributes and layout formulas are unchanged. Upstream's `cva`
variants become an exported `tv()`; `asChild` becomes the `child` snippet; the fan-out stays a CSS
transition over per-element `--translate` / `--item-scale` custom properties, with
`motion-reduce:transition-none` collapsing it to an instant change. No keyframes are needed, so
`src/app.css` is not touched. Zero new npm dependencies.

## Technical Context

**Language/Version**: TypeScript 5 (strict, `verbatimModuleSyntax`), Svelte 5 (runes forced on in
`vite.config.ts`), SvelteKit 2

**Primary Dependencies**: `tailwind-variants` (`tv()`), `clsx` + `tailwind-merge` (via `cn()`),
`svelte/reactivity` (`SvelteMap`), `$lib/components/ui/speed-dial` (`DomOrderedCollection`). **No new
npm dependency**; `radix-ui` and `class-variance-authority` are deliberately not added.

**Storage**: N/A — no persistence, no network.

**Testing**: Vitest (jsdom) + `@testing-library/svelte` + `@testing-library/user-event`, colocated at
`src/lib/components/ui/stack/stack.test.ts`, with a `stack.test.svelte` harness for `child` snippets,
`{#each}` reordering and no-provider guard rails. `globals: false`, `expect.requireAssertions` on.

**Target Platform**: Browser (SSR-safe: all DOM access is inside `$effect`), modern evergreen.

**Project Type**: Component library shipped as source through a shadcn-svelte registry.

**Performance Goals**: Layout math is O(n) per item read; the document-order sort is O(n log n) once
per structural change, amortised by `DomOrderedCollection.indexById`. Expansion is a compositor-only
transition (`transform` + `opacity`), i.e. 60 fps for realistic stack sizes (≤ ~20 items).

**Constraints**: No `any`, no suppression comments, semantic Tailwind tokens only, `data-slot` on
every part, caller `class` merged last, `.js` extensions on intra-repo imports, no import from
`src/routes/**` or `src/lib/components/docs/**`.

**Scale/Scope**: 2 public parts, 1 state class, 4 shipped files + 2 test files, 1 demo route with 3
previews + API tables, 1 registry entry.

## Public API

Full contract with defaults, JSDoc sources and DOM shape: [`contracts/public-api.md`](./contracts/public-api.md).
Summary:

### `Stack.Root` — alias `Stack` (upstream `Stack`, `stack.tsx:55`)

Extends `WithElementRef<HTMLAttributes<HTMLDivElement>>`.

| Prop                | Type                                                 | Default     | Bindable |
| ------------------- | ---------------------------------------------------- | ----------- | -------- |
| `side`              | `'top' \| 'bottom'`                                  | `'bottom'`  | no       |
| `itemCount`         | `number`                                             | `3`         | no       |
| `expandedItemCount` | `number \| undefined`                                | `undefined` (all) | no |
| `gap`               | `number` (px)                                        | `8`         | no       |
| `scale`             | `number`                                             | `0.05`      | no       |
| `offset`            | `number` (px)                                        | `10`        | no       |
| `expandOnHover`     | `boolean`                                            | `false`     | no       |
| `class`             | `string`                                             | —           | no       |
| `style`             | `string`                                             | —           | no       |
| `ref`               | `HTMLDivElement \| null`                             | `null`      | **yes**  |

- **Snippets**: `children` (the `Stack.Item`s); `child({ props: StackChildProps })` replacing the root
  element (upstream `asChild`).
- **Callbacks/events**: no custom callbacks — upstream defines none. The DOM handlers `onmouseenter`,
  `onmousemove`, `onmouseleave`, `onpointerdown`, `onpointerup` are accepted through `restProps` and
  **composed**: the caller runs first and may cancel the stack's own behaviour with
  `preventDefault()`.
- **Data attributes**: `data-slot="stack"`, `data-state="expanded|collapsed"`,
  `data-expanded="true|false"`.
- **Custom properties**: `--gap`, `--offset`, `--scale`, with a caller `style` appended last.

### `Stack.Item` — alias `StackItem` (upstream `StackItem` inside `StackItemWrapper`)

Extends `WithElementRef<HTMLAttributes<HTMLDivElement>>`.

| Prop    | Type                     | Default | Bindable |
| ------- | ------------------------ | ------- | -------- |
| `class` | `string`                 | —       | no       |
| `style` | `string`                 | —       | no       |
| `ref`   | `HTMLDivElement \| null` | `null`  | **yes**  |

- **Snippets**: `children`; `child({ props: StackItemChildProps })` replacing the **card** element
  only (the positioning wrapper is always a `div`, exactly as upstream).
- **Callbacks/events**: none of its own; all DOM attributes/handlers are forwarded to the card.
- **Data attributes**: wrapper — `data-slot="stack-item-wrapper"`, `data-index`, `data-front`,
  `data-visible`, `data-expanded`; card — `data-slot="stack-item"`, `data-index`, `data-position`,
  `data-state`.
- **No `index` prop**: the index is the item's document-order position in the root's registry.

### Also exported from the barrel

`stackItemWrapperVariants` (the `tv()` object), `StackState`, `setStackContext`, `getStackContext`,
`STACK_SIDES`, and the types `StackProps` / `StackRootProps` / `StackChildProps` / `StackItemProps` /
`StackItemChildProps` / `StackSide` / `StackStateProps`.

### Deliberate divergences (all recorded in spec Assumptions / research.md)

| ID   | Upstream                                    | Here                                                            | Where    |
| ---- | ------------------------------------------- | ---------------------------------------------------------------- | -------- |
| D-01 | `React.Children.toArray` wraps any child    | only `Stack.Item` participates; it renders wrapper + card         | R-01     |
| D-02 | no reduced-motion handling                  | `motion-reduce:transition-none` on wrapper and card               | R-04     |
| D-03 | sizes keyed by index, never removed         | keyed by stable item id, released on unmount                      | R-05     |
| D-04 | `pointerup` only on the root (can stick)    | document-level `pointerup`/`pointercancel` while interacting      | R-06     |
| D-05 | MDX prose says `visibleItems`/`scaleFactor` | real props `itemCount` / `scale` (prose is stale)                 | R-10     |
| D-06 | root emits `data-state` only                | emits `data-state` **and** the MDX-documented `data-expanded`     | R-10     |
| D-07 | physical `left-0` / `after:left-0`          | logical `start-0` / `after:start-0`                               | R-13     |
| D-08 | caller handler replaces the stack's         | caller handler composed before the stack's, cancellable           | R-07     |

## Constitution Check

_Initial evaluation (pre-Phase 0) and re-evaluation (post-Phase 1) reached the same verdicts; the
post-design pass added the evidence in brackets._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                             |
| ---- | ----------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect`/`$props`/`$bindable` + snippets only; all reactive logic in `stack.svelte.ts` (`StackState`), inputs passed as getter functions; no stores, no `export let`, no `createEventDispatcher`, no `<slot>` |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | Both upstream variants read and diffed at the pinned commit; every prop, default, formula, class string and data attribute reproduced (`contracts/public-api.md`); 8 divergences D-01…D-08 recorded with reasons |
| III  | Accessibility Is a MUST             | PASS    | No WAI-ARIA pattern applies (presentational cascade, no upstream role/keyboard); parity achieved by construction — items never `display:none`/`aria-hidden`, so content stays queryable and tabbable in both states, asserted in tests; RTL asserted; provider error asserted; controlled/uncontrolled substituted per R-12 (see note) |
| IV   | Composition Over Reimplementation   | PASS    | Ordering reuses `DomOrderedCollection` from `$lib/components/ui/speed-dial`; `cn()`/`tv()` for styling; remaining layout math is bespoke — justified below           |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file, `stack.svelte.ts` for logic, `index.ts` barrel with short + prefixed names + types, `.js` import extensions, one `registry:ui` entry, no docs imports |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Prop types in `<script lang="ts" module>`, `WithElementRef<HTMLAttributes<HTMLDivElement>>` base, `child` payloads typed, `Record<string, unknown>` (never `any`) for the pass-through tail; no ignore comments planned |
| VII  | Green Gate Before Commit            | PASS    | Task list ends with `format` → `check` → `lint` → `test:unit --run` → `build`, all non-interactive; no `.skip`/`.todo`                                              |
| VIII | Styling Discipline                  | VIOLATION (recorded) | `cn()` + exported `tv()`, semantic tokens (`bg-card`, `border`) only, `data-slot` on both elements, no `dark:`, no `space-*`. **Exception**: `data-front`/`data-visible`/`data-expanded` are emitted as `"true"`/`"false"` strings rather than `'' \| undefined` — see Complexity Tracking |
| IX   | Every Component Is Documented       | PASS    | `/docs/components/stack` with one `<ComponentPreview>` per upstream demo file (3) plus API tables                                                                     |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/039-port-stack/`; no git write commands; no protected path touched                                                                        |

**Note on Principle III, controlled/uncontrolled**: Stack has no value, no `defaultValue`, no
`onValueChange` and no `disabled`/`readOnly` upstream (`types/radix/stack.ts`), so those named test
areas have no referent. Adding them would be API drift and is rejected (research R-12). The nearest
applicable equivalents are tested instead: the internal expansion state machine (hover → expand,
leave → collapse, held pointer defers the collapse) and the `expandOnHover={false}` static mode, which
is the component's own "the parent is authoritative, the component must not move on its own" case.

**Bespoke behaviour justification (Principle IV)**:

- **Stacked layout math** (scale/offset/opacity/z-index per index, natural-size measurement, expanded
  fan-out). Evaluated: `bits-ui` (no layout/stacking primitive of any kind — its surface is
  behaviour: menus, popovers, dialogs, focus/dismiss layers), `$lib/components/ui/banner` (stacks
  queued banners, but the stack is owned by a queue store keyed by banner id with its own
  enter/exit lifecycle, `maxVisible` semantics and portal strategy — it cannot lay out arbitrary
  children), `$lib/components/ui/masonry` (a column positioner for a scrolling grid; wrong axis,
  wrong model), `$lib/components/ui/marquee` (translation animation, no per-item stacking). None
  provides "measure children and lay them out as a scaled/offset absolute stack with hover
  expansion". Written directly in `StackState`, as upstream writes it directly in its component body.
- **Hover/press state machine** (`expanded`, `interacting`). Evaluated: `bits-ui` has no hover-intent
  or press-tracking primitive exposed publicly; `hover-card` owns its own timing internally and is a
  floating-layer component, not a state source. ~30 lines of plain rune state.
- **Everything else is composed**: document ordering (`DomOrderedCollection`), variants (`tv()`),
  class merging (`cn()`), reactive map (`SvelteMap`).

## Project Structure

### Documentation (this feature)

```text
specs/039-port-stack/
├── plan.md              # This file
├── spec.md              # Input
├── research.md          # Phase 0 — R-01…R-14
├── data-model.md        # Phase 1 — StackState / StackItemEntry
├── quickstart.md        # Phase 1 — gates + 15 validation scenarios
├── contracts/
│   └── public-api.md    # Phase 1 — authoritative public surface
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/stack/
├── index.ts                  # barrel: Root/Item + Stack/StackItem + types + state exports
├── stack.svelte              # Root — upstream `Stack` (stack.tsx:55-204)
├── stack-item.svelte         # wrapper + card — upstream `StackItemWrapper` (240-325) and `StackItem` (331-346)
├── stack.svelte.ts           # `StackState`, Symbol context, `STACK_SIDES` — upstream `StackContext`/`useStackContext` (34-42), state (76-78), handlers (87-141), layout math (258-292)
├── stack.test.ts             # colocated tests (NOT in registry.json)
└── stack.test.svelte         # harness: child snippets, {#each} reorder, bare part (NOT in registry.json)

src/routes/docs/components/stack/
└── +page.svelte              # 3 <ComponentPreview> + API tables

registry.json                 # append exactly one registry:ui entry ("stack")
```

**Structure Decision**

| File                | Upstream counterpart                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `stack.svelte`      | `radix/ui/stack.tsx:55-204` (`Stack`) — props, defaults, custom properties, composed handlers, `relative w-full`, context provider |
| `stack-item.svelte` | `radix/ui/stack.tsx:206-232` (`stackItemWrapperVariants` → `tv()`), `:240-325` (`StackItemWrapper`: measurement, per-item styles, wrapper data attributes, inner `Slot` data attributes), `:331-346` (`StackItem` card classes) |
| `stack.svelte.ts`   | `radix/ui/stack.tsx:8-42` (types, `getDataState`, context + throwing consumer hook), `:76-171` (state, handlers, context value), `:258-292` (layout formulas) |
| `index.ts`          | `radix/ui/stack.tsx:348` (`export { Stack, StackItem, type StackProps }`), extended per CLAUDE.md §3 |

`stack` is simultaneously the folder slug, the demo route segment
(`src/routes/docs/components/stack/`) and the `registry.json` item `name` — confirmed identical.

### Demo route sections (one per upstream demo file)

| `<ComponentPreview>` | Upstream demo                 | Content                                                                 |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------ |
| **Default**          | `stack-demo.tsx`              | `w-[360px]`, `expandOnHover`, three notification cards                    |
| **Without Expansion**| `stack-no-expand-demo.tsx`    | `expandOnHover={false}`, centred in a `min-h-[400px]` box                 |
| **Different Sides**  | `stack-side-demo.tsx`         | `grid grid-cols-2 gap-8`, `side="top"` next to `side="bottom"`            |

Plus an **API Reference** block: one `Table.Root` of props for `Stack.Root` and one for `Stack.Item`,
and one of data attributes each — matching the `marquee` demo page's structure. Demo state is held in
the page with runes; no `+page.ts`.

## Implementation Order (for `/speckit-tasks`)

1. `stack.svelte.ts` — `STACK_SIDES`/`StackSide`, `StackState` (registry, sizes, expanded/interacting,
   derived counts, per-index formulas, commands), Symbol context + throwing `getStackContext()`.
2. `stack-item.svelte` — `stackItemWrapperVariants` via `tv()` in the module script; registration +
   measurement `$effect` (untracked `SvelteMap` write, teardown unregisters and releases the size);
   wrapper + card rendering, `child` snippet on the card.
3. `stack.svelte` — props with upstream JSDoc, custom-property style string, composed handlers,
   document-level `pointerup`/`pointercancel` effect, `child` snippet, context provider.
4. `index.ts` barrel.
5. `stack.test.svelte` harness, then `stack.test.ts` (quickstart scenarios 1–15).
6. `src/routes/docs/components/stack/+page.svelte`.
7. `registry.json` entry + `pnpm run registry:build`.
8. Quality gates in order: `format`, `check`, `lint`, `test:unit -- --run`, `build`.

## Complexity Tracking

| Principle | Violation                                                                          | Why Needed                                                                                                                                     | Compliant Alternative Rejected Because                                                                                                                                          |
| --------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VIII      | `data-front`, `data-visible`, `data-expanded` emitted as `"true"`/`"false"` strings instead of `'' \| undefined` | The upstream MDX `DataAttributesTable` documents their value set as exactly `["true", "false"]`, and React renders those strings, so `[data-visible="false"]` is the published selector. Principle II is non-negotiable. | Presence-style attributes would make every documented `[data-*="false"]` selector fail silently and would make "invisible" indistinguishable from "attribute absent" — a styling regression for every consumer following upstream docs. Enumerated-value attributes (`data-state`, `data-position`, `data-index`, `data-side`) are unaffected and keep the repo convention. |

_No other principle is violated. Principles II, VI and VII are clean and, per governance, must not
appear in this table._
