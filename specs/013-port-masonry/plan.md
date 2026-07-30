# Implementation Plan: Masonry

**Branch**: `013-port-masonry` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-port-masonry/spec.md`

**Upstream (pinned `d9763d82530416dfa4c81c462387b55d06bae4ec`)**:
`.reference/diceui/docs/registry/bases/radix/ui/masonry.tsx`,
`.reference/diceui/docs/content/docs/components/radix/masonry.mdx`,
`.reference/diceui/docs/registry/bases/radix/examples/masonry-{,linear-,ssr-}demo.tsx`.
No upstream test file exists for this component.

## Summary

Port Dice UI's `Masonry` — a virtualized, resize-aware, Pinterest-style column layout — to Svelte 5
runes as a shadcn-svelte registry item.

The upstream file is 1536 lines, of which ~790 are a red-black interval tree and a column positioner
with no React in them, and ~410 are React-specific plumbing (`useThrottle`, `useDebouncedWindowSize`,
`useScroller`, `useResizeObserver`, `onDeepMemo`, `useComposedRefs`). The technical approach is:

1. **Lift the algorithm out of the framework.** `masonry-interval-tree.ts` and
   `masonry-positioner.ts` are pure `.ts` — a faithful port with the React shell stripped. This makes
   SC-001 (column-assignment parity with React) directly unit-testable without jsdom.
2. **Invert the child-inspection architecture.** Upstream's `MasonryViewport` reads
   `React.Children.toArray(children)` and `cloneElement`s the in-range subset; Svelte cannot
   introspect a snippet. Instead items **register with the root's state and position themselves**,
   with the virtualization `{#if}` living *inside* `masonry-item.svelte` so the component instance
   always exists (registration) while its DOM subtree does not (FR-013/SC-008). Heights are drained
   into the positioner strictly in index order, which is what preserves parity.
3. **Compose, don't invent, for direction.** RTL (FR-018) is not in upstream at all. Rather than
   forking the positioner's pixel maths, the positioner emits a leading-edge offset and the item
   renders it as `inset-inline-start`, with the root writing the direction resolved by the existing
   `direction-provider` onto its own `dir`. One CSS property, zero algorithm divergence.
4. **Keep the SSR contract exactly.** `mounted` starts `false` on server and on the first client pass,
   so the `fallback` snippet is what both emit — no hydration mismatch, no measurement in the first
   paint (FR-009/FR-019/SC-002).

Full rationale in [research.md](./research.md); shapes in [data-model.md](./data-model.md); the
installable surface in [contracts/public-api.md](./contracts/public-api.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict, `verbatimModuleSyntax`), Svelte 5 runes forced on

**Primary Dependencies**: SvelteKit 2, Svelte 5, Tailwind CSS v4, `clsx` + `tailwind-merge` via
`cn()`. Composed in-repo: `$lib/components/ui/direction-provider`. **No new npm dependency** — upstream's
only import, `radix-ui`'s `Slot`, is replaced by the `child` snippet (research R-12). `bits-ui` is
**not** used: it has no masonry, virtualization, or grid-positioning primitive (see Principle IV below).

**Storage**: N/A

**Testing**: Vitest (jsdom, `globals: false`, `expect.requireAssertions`) +
`@testing-library/svelte` + `@testing-library/user-event`. Two spec files
(`masonry.test.ts`, `masonry-positioner.test.ts`) plus one `.test.svelte` harness.

**Target Platform**: SSR + browser (modern evergreen); `ResizeObserver`, `visualViewport`,
`requestAnimationFrame`, CSS logical properties.

**Project Type**: shadcn-svelte registry component + its docs route

**Performance Goals**: scroll recomputation capped at `scrollFps` (default 12 fps ⇒ ≥83 ms apart);
resize debounced at 300 ms; item re-measure coalesced to one `requestAnimationFrame`; live item DOM
nodes bounded by viewport height × `overscan`, not by item count (SC-008); re-flow visible within one
frame of a detected size change (SC-003).

**Constraints**: first paint must not depend on measurement (FR-019); no hydration mismatch; column
assignment must equal upstream's for the same height sequence (SC-001); strict TS with no
suppressions; semantic Tailwind tokens only.

**Scale/Scope**: 2 public components + 1 internal part + 3 modules; ~20 public props; 3 demo
sections; 200+ item lists exercised in tests.

No `NEEDS CLARIFICATION` remains — every open question is resolved in `research.md` R-01…R-12 and
mirrored into the spec's Assumptions.

## Constitution Check

_GATE: passed before Phase 0; re-checked after Phase 1 design — see the re-check note below._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                          |
| ---- | ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$state.raw`/`$derived`/`$derived.by`/`$effect`/`$effect.pre`/`$props`/`$bindable` + snippets only; reactive logic in `masonry.svelte.ts` (`MasonryState`, getter-function inputs); no store, `export let`, dispatcher or `<slot>`. |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | All 12 upstream props reproduced with names, defaults and JSDoc (`contracts/public-api.md` §1–2); `asChild`→`child` and 8 further divergences recorded in the spec's Assumptions; all 3 upstream demos ported.       |
| III  | Accessibility Is a MUST             | PASS    | Upstream defines no role, no `aria-*` and no key handler, and no WAI-ARIA pattern covers a flow layout; tests instead assert tab order = source order, that no key is intercepted, RTL mirroring, `visibility:hidden` keeping the measurement batch out of the a11y tree, and the outside-provider throw (research R-11). |
| IV   | Composition Over Reimplementation   | PASS    | `direction-provider` composed for RTL; positioner/tree/scroll logic is bespoke with the justification below.                                                                                                       |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file, `<slug>.svelte.ts`, barrel with short + prefixed names + types, `.js` import extensions, one `registry:ui` entry listing all 7 non-test files, no import from `src/routes/**` or `src/lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Every prop type in `<script lang="ts" module>`; `WithElementRef<HTMLAttributes<HTMLDivElement>>`; no `any`; the interval tree's sentinel typing is handled with a module-private `TreeNode` and an explicitly-constructed sentinel, not `as any` (see V-1 grep in `quickstart.md`). |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit --run` → `build`, all planned as the final task; no skipped or `.todo` test.                                                                                             |
| VIII | Styling Discipline                  | PASS    | `cn()` only (no variants ⇒ no `tv()`), caller `class` merged last, caller `style` appended last; `data-slot` on all three parts; state exposed as `data-scrolling`, `data-index`, `data-column-index`, `data-measuring`, `data-version`, written `cond ? '' : undefined`; no palette colour, no `dark:`, no `space-*`. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/masonry/+page.svelte` with one `<ComponentPreview>` per upstream demo file (3) + API-reference tables; state held in the page with runes; no `+page.ts`.                              |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/013-port-masonry/`; no git write command anywhere in the plan.                                                                                                                          |

**Bespoke behaviour justification (Principle IV)**

| Bespoke piece                                              | Primitive evaluated                                                                                                                        | Capability it lacks                                                                                                                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `masonry-interval-tree.ts`, `masonry-positioner.ts`        | `bits-ui` (no virtualization/layout primitive of any kind); `$lib/components/ui/*` — `scroll-area`, `scroller`                             | None of them computes column assignment or maintains an interval index of item extents. `scroll-area`/`scroller` style and drive a scroll container; they do not lay out. |
| Item registration + index ordering (`MasonryState#tokens`) | `bits-ui`'s internal collection helpers are not exported; `@diceui/shared`'s `useCollection` has no bits-ui equivalent that yields ordered indices to a *layout* owner | No exported primitive returns a stable ordered index for children that are conditionally unmounted. Required by R-02/R-04.                                             |
| Debounced window size + throttled window scroll + `ResizeObserver` wiring | `bits-ui` exposes no size/scroll observer; `scroller`'s `scroll-position.svelte.ts` tracks a **container**'s `scrollLeft/Top` and edge state | Upstream tracks `window.scrollY` and `documentElement.client{Width,Height}` against a page-scrolled grid (spec Assumption "window-scroll tracking"), which `scroll-position` does not model. |
| RTL mirroring                                              | `direction-provider` — **composed**, not reimplemented                                                                                     | n/a; only the `inset-inline-start` rendering choice is ours (research R-07).                                                                                          |

**Post-Phase-1 re-check**: the design in `data-model.md` / `contracts/public-api.md` introduces no new
dependency, no new suppression, no new palette colour, and no docs-app import. All ten verdicts stand.
Complexity Tracking stays empty.

## Public API

Authoritative table: [`contracts/public-api.md`](./contracts/public-api.md). Summary:

### `Masonry` (`Masonry.Root`) — `masonry.svelte`

| Prop             | Type                                        | Default     | Bindable |
| ---------------- | ------------------------------------------- | ----------- | -------- |
| `ref`            | `HTMLDivElement \| null`                    | `null`      | **yes**  |
| `columnWidth`    | `number`                                    | `200`       | no       |
| `columnCount`    | `number \| undefined`                       | `undefined` | no       |
| `maxColumnCount` | `number \| undefined`                       | `undefined` | no       |
| `gap`            | `number \| { column: number; row: number }` | `0`         | no       |
| `itemHeight`     | `number`                                    | `300`       | no       |
| `defaultWidth`   | `number \| undefined`                       | `undefined` | no       |
| `defaultHeight`  | `number \| undefined`                       | `undefined` | no       |
| `overscan`       | `number`                                    | `2`         | no       |
| `scrollFps`      | `number`                                    | `12`        | no       |
| `linear`         | `boolean`                                   | `false`     | no       |
| `fallback`       | `Snippet`                                   | `undefined` | no       |
| `dir` *(added)*  | `'ltr' \| 'rtl'`                            | *resolved*  | no       |
| `child`          | `Snippet<[{ props: MasonryChildProps }]>`   | `undefined` | no       |
| `children`       | `Snippet`                                   | `undefined` | no       |
| `class`, `style`, rest of `HTMLAttributes<HTMLDivElement>` less `dir` | — | — | no |

- **Snippets**: `children`, `fallback` (rendered while `!mounted`), `child`.
- **Callbacks/events**: none upstream, none added. Native handlers pass through `restProps`.
- **Data attributes**: `data-slot="masonry"`, `data-scrolling`, `dir`.
- **Dropped**: `asChild` (→ `child`).

### `MasonryItem` (`Masonry.Item`) — `masonry-item.svelte`

| Prop              | Type                                          | Default     | Bindable |
| ----------------- | --------------------------------------------- | ----------- | -------- |
| `ref`             | `HTMLDivElement \| null`                      | `null`      | **yes**  |
| `index` *(added)* | `number \| undefined`                         | `undefined` | no       |
| `child`           | `Snippet<[{ props: MasonryItemChildProps }]>` | `undefined` | no       |
| `children`        | `Snippet`                                     | `undefined` | no       |
| `class`, `style`, rest of `HTMLAttributes<HTMLDivElement>` | — | — | no |

- **Snippets**: `children`, `child` — rendered only when in range or in the measurement batch.
- **Callbacks/events**: none.
- **Data attributes**: `data-slot="masonry-item"`, `data-index`, `data-column-index`, `data-measuring`.
- **Throws**: `` `<Masonry.Item>` must be used within `<Masonry.Root>`. ``

### Types and helpers exported from `index.ts`

`MasonryProps`, `MasonryRootProps`, `MasonryChildProps`, `MasonryItemProps`, `MasonryItemChildProps`,
`MasonryStateProps`; `MasonryState`, `getMasonryContext`, `hasMasonryContext`, `setMasonryContext`;
`createPositioner`, `resolveColumnCount`, `resolveColumnWidth`, `Positioner`, `PositionerItem`,
`PositionerOptions`; `createIntervalTree`, `IntervalTree`.

## Project Structure

### Documentation (this feature)

```text
specs/013-port-masonry/
├── plan.md                    # this file
├── spec.md                    # updated: 11 new Assumptions entries from research
├── research.md                # Phase 0 — R-01…R-12
├── data-model.md              # Phase 1 — types, state, transitions
├── quickstart.md              # Phase 1 — usage + V-1…V-5 validation
├── contracts/
│   └── public-api.md          # Phase 1 — installable surface + algorithm + registry contract
├── checklists/
│   └── requirements.md
└── tasks.md                   # Phase 2 (/speckit-tasks) — NOT created here
```

### Source Code (repository root)

```text
src/lib/components/ui/masonry/
├── index.ts                     # barrel: Root/Item + aliases + prop types + positioner/tree exports
├── masonry.svelte               # Root  ← upstream `Masonry` (masonry.tsx:1204-1342)
├── masonry-viewport.svelte      # internal sizing container ← `MasonryViewport` (1348-1522)
├── masonry-item.svelte          # Item  ← `MasonryItem` (1528-1534) + the positioning that
│                                #        upstream injected from the viewport via cloneElement
├── masonry.svelte.ts            # MasonryState + Symbol context ← usePositioner shell (801-838),
│                                #   useDebouncedWindowSize (847-906), onRafSchedule (913-936),
│                                #   useResizeObserver (938-1018), useScroller (1020-1083),
│                                #   useThrottle (1085-1149), MasonryContext (1166-1187)
├── masonry-positioner.ts        # pure ← usePositioner core (548-799)
├── masonry-interval-tree.ts     # pure ← interval tree (8-426)
├── masonry.test.svelte          # harness (snippets, keyed each, bind:ref, bare-item) — not in registry
├── masonry.test.ts              # component tests
└── masonry-positioner.test.ts   # pure algorithm parity tests (SC-001)

src/routes/docs/components/masonry/
└── +page.svelte                 # 3 <ComponentPreview> + API-reference tables

registry.json                    # append exactly one registry:ui entry (13th item)
```

**Structure Decision.** Folder slug `masonry` = demo route segment `masonry` = registry item name
`masonry`, as Principle V requires. Upstream's `onDeepMemo`/`Cache` block (428–539) and
`useComposedRefs` have **no** counterpart file — they are dropped outright (research R-06).
`masonry-viewport.svelte` exists as its own file because §3 forbids two components in one `.svelte`
file, but it is not exported from `index.ts`, matching upstream's export list
(`Masonry`, `MasonryItem`, `MasonryProps`).

## Implementation Phases

Ordering is dependency-driven; `/speckit-tasks` will expand each into tasks.

| # | Phase                       | Deliverable                                                                                                                                    | Depends on |
| - | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 1 | Pure algorithm              | `masonry-interval-tree.ts`, `masonry-positioner.ts` + `masonry-positioner.test.ts` green                                                       | —          |
| 2 | Reactive state              | `masonry.svelte.ts`: helpers, `MasonryState`, Symbol context + throwing getter                                                                 | 1          |
| 3 | Parts                       | `masonry.svelte`, `masonry-viewport.svelte`, `masonry-item.svelte`, `index.ts`                                                                 | 2          |
| 4 | Tests                       | `masonry.test.svelte` harness + `masonry.test.ts` (US1, US2, US3, edge cases, guard rails, RTL, a11y)                                          | 3          |
| 5 | Docs route                  | `src/routes/docs/components/masonry/+page.svelte` — Default / Linear Layout / Server Side Rendering + props, data-attribute and error tables   | 3          |
| 6 | Registry                    | append the `masonry` entry to `registry.json`; run `pnpm run registry:build`                                                                   | 3          |
| 7 | Gates                       | `format` → `check` → `lint` → `test:unit --run` → `build`, all green with no suppression                                                       | 1–6        |

**User-story mapping**: P1 (shortest-column layout) = phases 1–4 core; P2 (`linear`) = the `linear`
branch in phase 1 plus its tests and the Linear demo; P3 (SSR fallback) = the `mounted`/`fallback`
path in phases 2–3 plus its tests and the SSR demo.

## Risks

| Risk                                                                                             | Mitigation                                                                                                                       |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| jsdom measures nothing (`offsetHeight === 0`, no-op `ResizeObserver`), so component tests could silently assert on an empty layout | Per-suite stubs for `offset{Width,Height}`, `documentElement.client{Width,Height}`, `ResizeObserver` and `rAF`, restored in `afterEach`; the parity assertions live in the DOM-free `masonry-positioner.test.ts` (research R-09). |
| Out-of-order height reports would change column assignment vs. React                             | Sequential drain: `positioner.set` is only ever called with `index === positioner.size()` (research R-04), asserted in tests.     |
| `$derived.by` recreating the positioner could loop if it also writes reactive state              | The positioner derivation is pure — it replays heights from a non-reactive captured field and writes no `$state`; `layoutVersion` is bumped only from the RAF-scheduled observer callback. |
| Mid-list insertion after mount gets appended index                                               | Documented behaviour plus the `index` prop escape hatch (research R-02), covered by a test.                                       |
| `inset-inline-start` support                                                                     | Baseline in all evergreen targets; jsdom stores it verbatim so tests can assert on it.                                            |

## Complexity Tracking

> No constitution violation is carried forward. This table is intentionally empty.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | —         | —          | —                                      |
