# Implementation Plan: Port the Badge Overflow component

**Branch**: `009-port-badge-overflow` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-port-badge-overflow/spec.md`

## Summary

Port Dice UI's `badge-overflow` (radix base) to Svelte 5 as a **two-part** component under
`src/lib/components/ui/badge-overflow/`: a generic root (`badge-overflow.svelte`, `generics="T"`) that
owns measurement and the visible/hidden split, and a small presentational default indicator
(`badge-overflow-indicator.svelte`) rendering `+N`.

The root renders two siblings, exactly as upstream's fragment does:

1. an **invisible measurement row** (`pointer-events-none invisible absolute flex flex-wrap`) holding
   one rendered badge per item plus one sample overflow indicator, and
2. the **visible container** (`flex flex-wrap`, `data-slot="badge-overflow"`) holding either the
   measured visible badges + indicator, or — before the first measurement and during SSR — a bounded
   placeholder slice with a `min-height` guess.

All behaviour lives in `badge-overflow.svelte.ts`: pure functions (`resolveBadgeLabel`,
`readContainerMetrics`, `computeVisibleSplit`, `getPlaceholderCount`, `getPlaceholderHeight`), a
reusable SSR-guarded `observeResize()` helper, and a `BadgeOverflowState<T>` runes class whose
`$state` measurement fields are written by one `$effect` and read only by `$derived` members. The
`$effect` creates a single `ResizeObserver` on the root and returns a teardown that disconnects it —
never a `window` resize listener — and no-ops when `typeof window === 'undefined'` or the refs are
unbound, so nothing browser-only is touched during server render.

Five React-only affordances are translated rather than transliterated: `renderBadge` / `renderOverflow`
render props → typed `badge` / `overflow` **snippets**; `asChild` + Radix `Slot` → the repo's `child`
snippet, extended with a `content` snippet in its payload because this component owns its own children;
`useComposedRefs` → `ref = $bindable(null)` + `bind:this`; `useLayoutEffect` → `$effect` with a
teardown; and every `useMemo`/`useCallback` is dropped in favour of `$derived`. **No context is
introduced** — upstream has none, and the indicator part is standalone (it takes `count` as a prop).
**Zero new npm dependencies.**

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`) + Svelte 5.56 (runes forced on in
`vite.config.ts`)

**Primary Dependencies**: SvelteKit 2, Tailwind CSS v4, `cn()` (`clsx` + `tailwind-merge`) from
`$lib/utils.js`. `bits-ui` 2.18 evaluated and not used (Constitution Check IV below).
`tailwind-variants` not needed — neither part has variants. Docs route only:
`$lib/components/ui/badge`, `button`, `input`, `table`, `@lucide/svelte/icons/x`.
**Zero new npm dependencies.**

**Storage**: N/A

**Testing**: Vitest 4 (jsdom) + `@testing-library/svelte` 5 + `@testing-library/user-event` 14,
colocated at `src/lib/components/ui/badge-overflow/badge-overflow.test.ts` with a
`badge-overflow.test.svelte` harness for snippets, `bind:ref`, `child` mode and `dir="rtl"`. jsdom
performs no layout, so the spec installs deterministic `offsetWidth` / `offsetHeight` / `clientWidth`
stubs and a controllable `ResizeObserver` (research R-07). SSR is asserted with `render()` from
`svelte/server`. `expect.requireAssertions` is on.

**Target Platform**: Browser, SSR-safe (no `window` / `document` / `ResizeObserver` access at module
scope, at component init, or on any server-rendered path) — the SvelteKit docs app plus any consumer
project installing the registry item.

**Project Type**: shadcn-svelte registry component (source distribution) + docs route.

**Performance Goals**: one `ResizeObserver` per root instance; one measurement pass per observed
resize and per `items` / `getBadgeLabel` change. The pass is O(items) DOM reads batched before any
write. Width maps are compared before assignment (`sameWidths`) so an identical re-measure produces no
state change and no re-render (research R-06). Everything downstream of the measured metrics is
`$derived` pure arithmetic.

**Constraints**: no `any`, no suppression comments, no `dark:` overrides, no raw palette colours, no
`space-*` utilities, no manual `z-index`. Exactly one `$effect` in the component, and it never reads a
`$state` it writes. Upstream's documented prerequisite — *the container must resolve to a definite
width* — is carried over as documentation, not as a runtime guard (spec §Assumptions).

**Scale/Scope**: 4 new source files (2 parts + barrel + state module) + 1 test + 1 test harness + 1
docs route + 1 registry entry. 2 exported components, 10 root props, 2 snippets on the root, 5 data
attributes, 0 ARIA attributes and 0 keyboard handlers by design (research R-08), 8 exported helpers.

## Constitution Check

_GATE: passed before Phase 0 research; re-checked after Phase 1 design (see the bottom of this file)._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                                                                                                                          |
| ---- | ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$props` + `$bindable(null)` ref, `generics="T"`, `$state`/`$state.raw` for the six measured metrics, `$derived`/`$derived.by` for the split and placeholder, exactly one `$effect` (ResizeObserver) with a teardown, `Snippet` + `{@render}` for `badge`/`overflow`/`child`. No stores, `export let`, `createEventDispatcher`, `$:` or `<slot>`.   |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `badge-overflow.tsx` (radix), `use-badge-overflow.ts`, `badge-overflow.mdx`, `types/radix/badge-overflow.ts` and all three `badge-overflow-*-demo.tsx` read at the pinned commit `d9763d8`. Every prop, default, class string, measurement step, fitting rule and the verbatim error message reproduced; all divergences recorded in spec §Assumptions. |
| III  | Accessibility Is a MUST             | PASS    | Upstream ships no role, no `aria-*` and no keyboard handling — it is a layout/measurement utility, not a WAI-ARIA widget (research R-08). The port adds none, and the spec asserts that as a contract in FR-017/FR-018: no role, not focusable, tab order = consumer badge DOM order, `dir="rtl"` produces the same split with mirrored visual wrap.                  |
| IV   | Composition Over Reimplementation   | PASS    | `bits-ui` has no overflow/measurement primitive; evaluated and rejected in writing below. The default indicator reuses upstream's own self-contained markup rather than importing `Badge`, exactly as upstream (spec §Assumptions).                                                                                                                  |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, `badge-overflow.svelte` root + `badge-overflow-indicator.svelte` part, `badge-overflow.svelte.ts` for logic, `index.ts` barrel (short names + prefixed aliases + types + helpers), `.js` extensions on intra-repo imports, one `registry:ui` entry listing all 4 non-test files, no import from `src/routes/**` or `$lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Props derive from `WithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>>`; generic `T` via `generics="T"`; the conditional-required `getBadgeLabel` typed per research R-03. No `any`, no `@ts-*`, no `eslint-disable`, no `svelte-ignore`, no config edits.                                                                                |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final phase; no skipped tests; jsdom layout is stubbed rather than asserted away (research R-07).                                                                                                                                                                     |
| VIII | Styling Discipline                  | PASS    | `cn()` with the caller's `class` merged last on both parts; upstream's class strings are layout/token-only (`flex flex-wrap`, `inline-flex h-5 shrink-0 items-center rounded-md border px-1.5 text-xs font-semibold`) — no palette colours, no `dark:`, no `space-*`, no `z-index`. `data-slot="badge-overflow"` / `"badge-overflow-measure"` / `"badge-overflow-indicator"`, plus `data-measured`, `data-line-count`, `data-hidden-count`, `data-empty`. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/badge-overflow/+page.svelte` with one `<ComponentPreview>` per upstream demo file (`-demo`, `-multiline-demo`, `-interactive-demo`) plus per-part props tables.                                                                                                                                                         |
| X    | One Feature Directory Per Component | PASS    | All artifacts in `specs/009-port-badge-overflow/`; no git write commands; nothing written under `.reference/`, `scripts/`, `.specify/scripts/`, `.port-state.json` or `.port-logs/`.                                                                                                                                                                |

**Bespoke behaviour justification (Principle IV)**:

- **Overflow measurement and the visible/hidden split — bespoke; no primitive exists.** `bits-ui` 2.18
  ships no overflow, collection-measurement or "fit N children" primitive
  (`node_modules/bits-ui@2.18.1/dist/bits/` enumerated in full: accordion, alert-dialog, aspect-ratio,
  avatar, button, calendar, checkbox, collapsible, combobox, command, context-menu, date-field,
  date-picker, date-range-field, date-range-picker, dialog, dropdown-menu, label, link-preview, menu,
  menubar, meter, navigation-menu, pagination, pin-input, popover, progress, radio-group,
  range-calendar, rating-group, scroll-area, select, separator, slider, switch, tabs, time-field,
  time-range-field, toggle, toggle-group, toolbar, tooltip, utilities). The nearest neighbour,
  `ScrollArea`, solves the opposite problem —
  it makes overflow *scrollable* rather than *counted* — and exposes no per-child width data. Nothing
  under `src/lib/components/ui/*` measures children either. The bespoke surface is ~60 lines: one
  `ResizeObserver`, six `getComputedStyle`/`offsetWidth` reads and one linear fitting loop. There is no
  focus management, portal, positioner, dismissal or scroll lock involved — none of the liabilities
  Principle IV exists to prevent.
- **`observeResize()` — bespoke, ~10 lines, exported for reuse.** `bits-ui` has no public element-size
  rune, and the repo has no equivalent yet (`swap.svelte.ts`'s `ReducedMotionReader` is the closest
  precedent and covers `matchMedia`, not `ResizeObserver`). Written as an SSR-guarded, teardown-returning
  free function in `badge-overflow.svelte.ts` and exported from the barrel so later measurement-driven
  ports (`masonry`, `scroller`, `kanban`) compose it instead of re-deriving it.
- **Default `+N` indicator — bespoke markup, matching upstream.** Upstream's component file does **not**
  import its sibling `Badge` for the built-in default; it inlines the markup so the registry item stays
  self-contained with no `registryDependencies`. The port does the same (spec §Assumptions). Consumers
  who want `Badge` supply the `overflow` snippet — which every upstream demo does.
- **`use-badge-overflow.ts` — deliberately not ported.** It is an alternative, unused measurement
  strategy (synthetic off-DOM elements + a module-level cache keyed by class string) that
  `badge-overflow.tsx` never imports. Porting it would ship a second, divergent algorithm. Recorded in
  spec §Assumptions; research R-05 records the one algorithmic difference between the two.

## Public API

Derived from `.reference/diceui/docs/registry/bases/radix/ui/badge-overflow.tsx` and
`.reference/diceui/docs/types/radix/badge-overflow.ts` at the pinned commit. The full machine-readable
contract, including per-state attribute output and worked measurement examples, is
[contracts/public-api.md](./contracts/public-api.md).

### `BadgeOverflow` (`Root`) — `badge-overflow.svelte`

Generic over the item type: `<script lang="ts" generics="T">`. Renders **two** sibling elements — the
invisible measurement row and the visible container (a `div`, or the caller's element via `child`).

| Prop            | Type                                                          | Default | Bindable | Notes                                                                                                                                       |
| --------------- | ------------------------------------------------------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`         | `T[]`                                                         | —       | no       | **Required.** Array of items to display as badges. Changing it re-runs measurement (FR-008).                                                 |
| `getBadgeLabel` | `(item: T) => string`                                         | —       | no       | Optional for primitive `T`; **required** when `T extends object` (compile-time, research R-03). Runtime throw preserved verbatim.             |
| `lineCount`     | `number`                                                      | `1`     | no       | Maximum number of lines to display badges across.                                                                                            |
| `badge`         | `Snippet<[item: T, label: string]>`                           | —       | no       | **Required.** Replaces upstream `renderBadge`. Must render exactly one element (upstream's own contract — measurement indexes children).      |
| `overflow`      | `Snippet<[count: number]>`                                    | —       | no       | Replaces upstream `renderOverflow`. When absent the built-in `Indicator` renders `+{count}`.                                                  |
| `ref`           | `HTMLDivElement \| null`                                      | `null`  | **yes**  | `bind:this` on the visible container; stays `null` in `child` mode.                                                                          |
| `class`         | `ClassValue`                                                  | —       | no       | Merged **last** through `cn()` onto the visible container.                                                                                   |
| `style`         | `string`                                                      | —       | no       | Appended **last** to the computed `gap` (+ `min-height` pre-measurement) declarations, so the caller wins — upstream's `{ gap, ...style }`.   |
| `child`         | `Snippet<[{ props: BadgeOverflowChildProps; content: Snippet }]>` | —    | no       | Replaces upstream `asChild`. The caller spreads `props` on their element and renders `content` inside it (research R-04).                     |
| `…restProps`    | `HTMLAttributes<HTMLDivElement>`                              | —       | —        | Spread **before** the computed `class`/`style` (upstream order), onto the visible container only.                                             |

**Snippets**: `badge` (required), `overflow`, `child`. **`children` is not part of the API** — the
container's content is entirely component-derived, so the props type is wrapped in `WithoutChildren<…>`.

**Callbacks/events**: none. Upstream exposes no callback and no controlled/uncontrolled value pair; the
component never writes to `items`, so no prop other than `ref` is `$bindable` (adding
`bind:items` would invent a two-way contract upstream does not have). Standard DOM handlers pass
through `restProps`.

**Emitted attributes on the visible container**: `data-slot="badge-overflow"`,
`data-measured` (present iff the first measurement pass completed), `data-line-count`,
`data-hidden-count`, `data-empty` (present iff `items.length === 0`), `class`, `style`.
**On the measurement row**: `data-slot="badge-overflow-measure"`, `aria-hidden="true"`.

**Throws**: ``new Error('`getBadgeLabel` is required when using array of objects')`` — verbatim
upstream message — whenever `typeof item === 'object'` and no `getBadgeLabel` was supplied. Upstream's
check is exactly `typeof item === 'object'`, so a `null` item throws too (`typeof null === 'object'`);
that quirk is reproduced verbatim (data-model.md §1).

### `BadgeOverflowIndicator` (`Indicator`) — `badge-overflow-indicator.svelte`

The built-in `+N` badge. Rendered by the root when no `overflow` snippet is supplied, and exported so a
consumer can reuse it inside their own `overflow` snippet.

| Prop         | Type                                             | Default | Bindable | Notes                                                                     |
| ------------ | ------------------------------------------------ | ------- | -------- | ------------------------------------------------------------------------- |
| `count`      | `number`                                         | —       | no       | **Required.** Rendered as `+{count}` when no `children` snippet is given. |
| `ref`        | `HTMLDivElement \| null`                         | `null`  | **yes**  | `bind:this`; `null` in `child` mode.                                      |
| `class`      | `ClassValue`                                     | —       | no       | Merged last through `cn()`.                                               |
| `children`   | `Snippet`                                        | —       | no       | Overrides the `+{count}` text while keeping the default markup.           |
| `child`      | `Snippet<[{ props: BadgeOverflowIndicatorChildProps }]>` | — | no    | Render onto your own element.                                             |
| `…restProps` | `HTMLAttributes<HTMLDivElement>`                 | —       | —        | Spread before the computed `class`.                                       |

**Emitted attributes**: `data-slot="badge-overflow-indicator"`, `data-count`.

### Shared module exports (deliverable 5) — `badge-overflow.svelte.ts`

Re-exported from the barrel so later ports reuse them instead of re-deriving:

| Export                                                                                          | Kind      | Why it is shared                                                          |
| ----------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------- |
| `observeResize(element, onResize): () => void`                                                  | function  | SSR-guarded `ResizeObserver` + teardown; needed by every measuring port.   |
| `computeVisibleSplit<T>(options): { visibleItems: T[]; hiddenCount: number }`                   | function  | Pure line-fitting algorithm, unit-testable without the DOM.                |
| `resolveBadgeLabel<T>(item, getBadgeLabel?): string`                                            | function  | Label resolution + the documented object-without-extractor throw.          |
| `readContainerMetrics(element): { gap: number; padding: number; contentWidth: number }`         | function  | `getComputedStyle` parsing with finite guards (research R-02).             |
| `getPlaceholderCount(itemCount, lineCount)` / `getPlaceholderHeight(badgeHeight, gap, lineCount)` | functions | Upstream's pre-measurement heuristics.                                     |
| `BadgeOverflowState<T>`                                                                         | class     | The runes state object, for consumers building a variant root.             |
| `DEFAULT_LINE_COUNT`, `DEFAULT_BADGE_GAP`, `DEFAULT_BADGE_HEIGHT`, `DEFAULT_OVERFLOW_BADGE_WIDTH`, `OVERFLOW_SAMPLE_COUNT` | constants | Upstream's seed values (`1`, `4`, `20`, `40`, `99`). |

## Project Structure

### Documentation (this feature)

```text
specs/009-port-badge-overflow/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── public-api.md
├── checklists/
│   └── requirements.md  # produced by /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/lib/components/ui/badge-overflow/
├── index.ts                          # barrel: Root + Indicator, prefixed aliases, prop types, shared helpers
├── badge-overflow.svelte             # Root — generics="T"; measurement row + visible container
├── badge-overflow-indicator.svelte   # default "+N" indicator part
├── badge-overflow.svelte.ts          # BadgeOverflowState<T> + pure helpers + observeResize (runes module)
├── badge-overflow.test.ts            # colocated tests (NOT listed in registry.json)
└── badge-overflow.test.svelte        # prop-driven harness (NOT collected by vitest, NOT in registry.json)

src/routes/docs/components/badge-overflow/
└── +page.svelte                      # 3 <ComponentPreview> sections + props tables

registry.json                         # append exactly one registry:ui entry (4 files)
```

**Structure Decision**

| File                              | Upstream counterpart under `.reference/diceui`                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `badge-overflow.svelte`           | `docs/registry/bases/radix/ui/badge-overflow.tsx` — the whole `BadgeOverflow` function        |
| `badge-overflow-indicator.svelte` | same file, lines 201–204 / 226–229 — the inlined default `+{hiddenCount}` `div`               |
| `badge-overflow.svelte.ts`        | same file, lines 42–182 — `getBadgeLabel`, `useLayoutEffect` measurement, the two `useMemo`s  |
| `index.ts`                        | `docs/registry/bases/base/ui/_registry.ts` entry + `export { BadgeOverflow }`                 |
| `badge-overflow.test.ts`          | no upstream test file exists (verified: no `badge-overflow` spec under any `test/` directory) |
| `+page.svelte`                    | `docs/content/docs/components/radix/badge-overflow.mdx` + the three `-demo.tsx` files          |

The measurement row is **not** a separate part file: it is a private sibling of the root with no public
props, it cannot be composed independently (it must be rendered by the same component that measures
it), and it is not addressable by a consumer. It carries `data-slot="badge-overflow-measure"` so it
remains styleable and test-selectable, satisfying Principle VIII.

`badge-overflow` is the folder slug, the registry item `name`, and the demo route segment
(`/docs/components/badge-overflow`) — all three equal, so `getComponentItems()` in `src/lib/registry.ts`
links the sidebar entry at a real route.

## Complexity Tracking

> No Constitution Check violations. All bespoke behaviour is justified in writing under
> **Bespoke behaviour justification (Principle IV)** above, which Principle IV permits; nothing is
> carried forward as a violation.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | None      | —          | —                                      |

## Post-Design Constitution Re-check

Re-run after Phase 1 (`data-model.md`, `contracts/public-api.md`, `quickstart.md`):

- **I** — the design adds no reactive primitive beyond `$state`, `$state.raw`, `$derived`,
  `$derived.by`, `$props`, `$bindable` and a single `$effect`; `data-model.md` §Reactivity graph shows
  the effect writes only fields that no tracked expression inside it reads, so no loop and no
  `untrack()` escape hatch is needed. **PASS**
- **II** — `contracts/public-api.md` enumerates every upstream prop, default, class string and
  measurement step side by side with the port; the four divergences (`renderBadge`/`renderOverflow` →
  snippets, `asChild` → `child` + `content`, added `data-*` state attributes, finite-guard on a
  non-numeric computed `gap`) are all recorded in spec §Assumptions. **PASS**
- **III** — confirmed no ARIA pattern applies (research R-08); the test plan in `quickstart.md` still
  asserts the negative contract (no role, not focusable, consumer tab order preserved) plus RTL parity.
  The "part outside its provider throws" clause is N/A — the component has no provider — and is
  replaced by the documented `getBadgeLabel` throw, which is asserted. **PASS**
- **IV** — no primitive was found in the post-design sweep either; `observeResize` and
  `computeVisibleSplit` are exported for reuse instead of being inlined. **PASS**
- **V–X** — file layout, registry entry (4 files, `registryDependencies: []`, `dependencies: []`), demo
  route slug, and the four gate commands are all fixed by `quickstart.md`. **PASS**
