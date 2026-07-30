# Implementation Plan: Marquee

**Branch**: `011-port-marquee` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-port-marquee/spec.md`

## Summary

Port Dice UI's `Marquee` (a Radix-base registry-only component) to Svelte 5 as
`src/lib/components/ui/marquee/`. Four parts — `Root`, `Content`, `Item`, `Edge` — share a single
`MarqueeState` instance over a `Symbol`-keyed context. The scroll itself is **pure CSS**: the root
publishes `--marquee-duration`, `--marquee-gap`, `--marquee-delay` and `--marquee-loop-count` as
custom properties, and the content applies one of six `animate-marquee-*` keyframe utilities chosen
from `side` × resolved direction. The only JavaScript behaviour is (a) measuring the root and the
content track with a `ResizeObserver` so the duration stays proportional to content size, (b) the
auto-fill multiplier derived from those same measurements, and (c) a `Space`-key pause toggle.

Direction is resolved through the already-ported `direction-provider` (`useDirection`), so an
ambient `<DirectionProvider dir="rtl">` mirrors a `left`/`right` marquee without the consumer
passing `dir` down. Reduced motion is honoured at the CSS layer (`motion-reduce:animate-none` on the
animated elements), pause-on-hover is CSS (`group-hover:`), and pause-on-hover is given a keyboard
equivalent via `group-focus-within:` plus the `pauseOnKeyboard` toggle (defaulted to `true` per the
spec's ratified assumption).

Because the animation is delivered as CSS, this is the first port that must extend `src/app.css`
(six `@keyframes` + six `--animate-marquee-*` theme variables) and the first registry entry to carry
`cssVars.theme` and `css`, so a consumer installing `marquee` gets the keyframes too.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict, `verbatimModuleSyntax`), Svelte 5 with runes forced on
repo-wide (`vite.config.ts` → `compilerOptions.runes: true`)

**Primary Dependencies**: SvelteKit 2, Tailwind CSS v4 (`@tailwindcss/vite`), `tailwind-variants`
(already a dependency — used by `alert`, `badge`, `button`, `timeline`, …), `clsx` + `tailwind-merge`
via `cn()`. **No new npm dependencies.** `bits-ui` is *not* needed by this component (see
Constitution Check IV); upstream's only external imports are Radix's `Direction` primitive and
`Slot`, both of which already have first-party equivalents here (`direction-provider`, the `child`
snippet).

**Storage**: N/A

**Testing**: Vitest (jsdom, `globals: false`, `expect.requireAssertions` on) +
`@testing-library/svelte` + `@testing-library/user-event`. Colocated at
`src/lib/components/ui/marquee/marquee.test.ts`, with a `.test.svelte` harness for everything a `.ts`
spec cannot express (snippets, `child` props, `bind:ref`, provider-less renders).

**Target Platform**: Modern evergreen browsers; SSR-safe (SvelteKit prerender must not touch
`ResizeObserver`, `window` or `matchMedia` during render).

**Project Type**: shadcn-svelte component registry (source-distributed UI library + docs site)

**Performance Goals**: The scroll runs on the compositor (`transform` keyframes only, no layout
thrash). JS work is bounded to one `ResizeObserver` callback per resize per root — no rAF loop, no
per-frame measurement. Duration recalculation is a `$derived`, not an effect.

**Constraints**: No `any`, no suppression comments, no config loosening (Principle VI). No Svelte 4
idioms (Principle I). Consumer-supplied `class` merged last. Every part must survive
`svelte-check`'s a11y analysis without `svelte-ignore` — the `tabindex` + `onkeydown` pair on a
`role="marquee"` container is the one real risk here and is addressed in research R-04.

**Scale/Scope**: 4 exported components + 1 runes module + 1 barrel; ~18 public props total; 4 demo
sections; 1 registry entry; 1 `src/app.css` extension.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                                                            |
| ---- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$props`/`$bindable`/`$state`/`$derived`/`$derived.by`/`$effect` only; `MarqueeState` lives in `marquee.svelte.ts` and takes its reactive inputs as getter functions; `children` and `child` are snippets. No stores, no `export let`, no dispatcher.                                |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `marquee.tsx`, `marquee.mdx`, `types/radix/marquee.ts`, `_registry.ts` and all four `marquee-*-demo.tsx` read at the pinned commit. Every prop, data attribute, CSS variable and the `Space` interaction is reproduced; seven divergences (D-01…D-07) recorded in research.md and spec Assumptions. |
| III  | Accessibility Is a MUST             | PASS    | `role="marquee"` + `aria-live="off"` on the root; the visual duplicate is `role="presentation" aria-hidden="true"` so each item is announced once; `Space` toggles pause; `tabindex=0` + visible `focus-visible` ring only when `pauseOnKeyboard`; RTL mirroring and reduced motion asserted. |
| IV   | Composition Over Reimplementation   | PASS    | Direction composed from the ported `direction-provider`; `asChild` composed as the repo's `child` snippet; variants composed with `tv()`. Two bespoke pieces, justified below.                                                                                                       |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file, `marquee.svelte.ts` for logic, `index.ts` barrel with short names + prefixed aliases + types, `.js`-suffixed intra-repo imports, exactly one `registry:ui` entry, zero imports from `src/routes/**` or `$lib/components/docs/**`.                      |
| VI   | TypeScript Strict, No Suppressions  | PASS    | All prop types declared and exported from `<script lang="ts" module>`; `WithElementRef<HTMLAttributes<HTMLDivElement>>` everywhere; no `any`, no `@ts-expect-error`, no `svelte-ignore`, no config edits.                                                                             |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final task; no `.skip`/`.todo`; `expect.requireAssertions` respected.                                                                                                                                  |
| VIII | Styling Discipline                  | PASS    | `cn()` + two `tv()` variant objects exported from their part's module script; semantic tokens only (`from-background`, `ring-ring/50`, `border-ring`); no `dark:`, no `space-*`; `data-slot` on all five rendered elements; boolean state as `cond ? '' : undefined`.                 |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/marquee/+page.svelte` with one `<ComponentPreview>` per upstream demo file (`marquee-demo`, `marquee-logo-demo`, `marquee-vertical-demo`, `marquee-rtl-demo`) plus the props tables the plan prompt requires.                                             |
| X    | One Feature Directory Per Component | PASS    | All planning artifacts written to `specs/011-port-marquee/` only; no git write commands run; no protected path touched.                                                                                                                                                             |

**Bespoke behaviour justification (Principle IV)**:

1. **Size measurement (`observeMarqueeSizes` + the `rootSize`/`contentSize` state in
   `MarqueeState`).** Evaluated: `bits-ui` — it exposes no public element-measurement primitive (its
   internal sizing/floating-ui usage is not re-exported); `$lib/components/ui/badge-overflow` — it
   *does* export a reusable `observeResize(element, onResize)` helper, deliberately documented as
   reusable. Rejected for two concrete reasons: (a) it observes exactly one element and reports
   nothing, while marquee needs two elements and an axis-aware size read (`width` for `horizontal`,
   `height` for `vertical`); (b) reusing it would force marquee's registry item to ship all ~325
   lines of `badge-overflow.svelte.ts` — generics, label resolution, line-fitting — into every
   consumer's project for a six-line `ResizeObserver` wrapper, which contradicts Principle V's
   self-contained-source requirement. Marquee therefore defines its own axis-aware two-element
   observer inside `marquee.svelte.ts` (research R-02).

2. **The `Space`-to-pause key handler.** Evaluated: `bits-ui` — it has no marquee/ticker primitive
   and no generic "pausable animation" behaviour; the WAI-ARIA `marquee` role has no bits-ui
   counterpart. The handler is nine lines (`if (key === ' ') { preventDefault(); toggle() }`) and
   matches upstream exactly.

Everything else — direction resolution, the `asChild` escape hatch, variant classes, the animation,
the hover pause — is composed from an existing primitive, a snippet, `tv()`, or CSS.

## Project Structure

### Documentation (this feature)

```text
specs/011-port-marquee/
├── plan.md              # This file
├── research.md          # Phase 0 output — 10 resolved decisions
├── data-model.md        # Phase 1 output — state, context, derived values
├── quickstart.md        # Phase 1 output — how to validate the port end to end
├── contracts/
│   └── public-api.md    # Phase 1 output — the exported surface, prop by prop
├── checklists/
│   └── requirements.md  # from /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/marquee/
├── index.ts                    # barrel: Root/Content/Item/Edge + Marquee* aliases + types + helpers
├── marquee.svelte              # Root      ← upstream `Marquee`
├── marquee-content.svelte      # Content   ← upstream `MarqueeContent` (+ marqueeContentVariants)
├── marquee-item.svelte         # Item      ← upstream `MarqueeItem`
├── marquee-edge.svelte         # Edge      ← upstream `MarqueeEdge` (+ marqueeEdgeVariants)
├── marquee.svelte.ts           # MarqueeState, Symbol context, pure helpers, size observer
├── marquee.test.svelte         # test harness (snippets, child props, bind:ref, bare parts)
└── marquee.test.ts             # colocated tests (NOT listed in registry.json)

src/routes/docs/components/marquee/
└── +page.svelte                # 4 <ComponentPreview> sections + 4 props tables

src/app.css                     # + 6 @keyframes and 6 --animate-marquee-* theme variables
registry.json                   # + exactly one registry:ui entry (with cssVars.theme and css)
```

**Structure Decision**: The folder slug `marquee`, the demo route segment
`src/routes/docs/components/marquee/`, and the `registry.json` item `name` are all `marquee` —
identical, as Principles V and IX require. Part-to-upstream mapping, all from
`.reference/diceui/docs/registry/bases/radix/ui/marquee.tsx`:

| File                     | Upstream symbol                                                                                                                        | Upstream lines           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `marquee.svelte`         | `function Marquee` + `MarqueeContext.Provider`                                                                                         | 281–417                  |
| `marquee-content.svelte` | `function MarqueeContent` + `marqueeContentVariants`                                                                                   | 419–586                  |
| `marquee-item.svelte`    | `function MarqueeItem`                                                                                                                 | 588–600                  |
| `marquee-edge.svelte`    | `function MarqueeEdge` + `marqueeEdgeVariants`                                                                                         | 602–672                  |
| `marquee.svelte.ts`      | `createResizeObserverStore`, `useResizeObserverStore`, `MarqueeContext`, `useMarqueeContext`, the `duration`/`multiplier`/`style` memos | 32–266, 300–356, 501–528 |
| `src/app.css` additions  | `_registry.ts` `cssVars.theme` + the `marquee.mdx` keyframes block                                                                     | \_registry 346–370 / mdx 45–108 |

Upstream's `createResizeObserverStore` is a single **module-global** store shared by every marquee on
the page, read through `useSyncExternalStore`. That indirection exists only because React needs an
external store to bridge a non-reactive `ResizeObserver` into render. Svelte's `$state` already is
that bridge, so the port keeps the measurement **per root instance** — same observable behaviour, no
cross-instance global, no `WeakMap` snapshot cache (research R-02).

## Public API

Every prop below is derived from `marquee.tsx` (behaviour) and `docs/types/radix/marquee.ts` (the
documented contract, including `@default` tags, which are copied verbatim onto the Svelte types).
All four parts extend `WithElementRef<HTMLAttributes<HTMLDivElement>>`, so all four accept `ref`
(bindable, `null`), `class`, `style`, `id`, `data-*`, `aria-*` and every other div attribute via
`...restProps`, merged onto the rendered element with the caller's `class` last.

### `Marquee.Root` — `marquee.svelte` (alias `Marquee`)

| Prop              | Type                                      | Default     | Bindable | Notes                                                                                          |
| ----------------- | ----------------------------------------- | ----------- | -------- | ---------------------------------------------------------------------------------------------- |
| `ref`             | `HTMLDivElement \| null`                  | `null`      | **yes**  | `bind:this` on the root div. Stays `null` in `child` mode.                                     |
| `side`            | `'left' \| 'right' \| 'top' \| 'bottom'`  | `'left'`    | no       | `top`/`bottom` ⇒ `orientation: 'vertical'`.                                                    |
| `dir`             | `'ltr' \| 'rtl'`                          | `undefined` | no       | Explicit override. When omitted: nearest `<DirectionProvider>` → ancestor `[dir]` → `'ltr'`.   |
| `speed`           | `number`                                  | `50`        | no       | Pixels per second. Floored at `0.001` so the duration stays finite.                            |
| `delay`           | `number`                                  | `0`         | no       | Seconds before the animation starts. Present in the upstream source, absent from its prop table. |
| `loopCount`       | `number`                                  | `0`         | no       | `0` or `Infinity` ⇒ `infinite`; any other positive number ⇒ that many iterations.              |
| `gap`             | `string \| number`                        | `'1rem'`    | no       | CSS length, or a number treated as pixels.                                                     |
| `autoFill`        | `boolean`                                 | `false`     | no       | Duplicate content until it fills the container.                                                |
| `pauseOnHover`    | `boolean`                                 | `false`     | no       | Pauses on pointer hover **and** on `:focus-within` (accessibility divergence D-04).            |
| `pauseOnKeyboard` | `boolean`                                 | `true`      | no       | Documented upstream default; the source says `false` (divergence D-01). Adds `tabindex=0` + ring. |
| `reverse`         | `boolean`                                 | `false`     | no       | `animation-direction: reverse`, applied on top of the side/direction-derived direction.        |
| `class`           | `string \| undefined`                     | `undefined` | no       | Merged last through `cn()`.                                                                    |
| `style`           | `string \| undefined`                     | `undefined` | no       | Appended **after** the `--marquee-*` custom properties, so the caller can override them.       |
| `children`        | `Snippet`                                 | `undefined` | no       | The `Marquee.Content` / `Marquee.Edge` subtree. Not rendered in `child` mode.                  |
| `child`           | `Snippet<[{ props: MarqueeChildProps }]>` | `undefined` | no       | Replaces upstream `asChild`. Receives the merged attribute payload to spread.                  |

Callbacks/events: none of its own. `onkeydown` is part of the merged attribute payload when
`pauseOnKeyboard` is `true`; a caller-supplied `onkeydown` in `restProps` runs **in addition** — the
component's handler is composed, not replaced (research R-06).

Rendered structure and attributes:

```html
<div data-slot="marquee-wrapper" class="grid">
	<div
		role="marquee"
		aria-live="off"
		dir="…"
		tabindex="0?"
		data-slot="marquee"
		data-orientation="horizontal|vertical"
		data-side="left|right|top|bottom"
		data-paused=""
		data-pause-on-hover=""
		style="--marquee-duration:…s; --marquee-gap:…; --marquee-delay:…s; --marquee-loop-count:…"
	></div>
</div>
```

`data-paused` / `data-pause-on-hover` are present-when-true (`cond ? '' : undefined`).

### `Marquee.Content` — `marquee-content.svelte` (alias `MarqueeContent`)

| Prop       | Type                                             | Default     | Bindable | Notes                                                                          |
| ---------- | ------------------------------------------------ | ----------- | -------- | ------------------------------------------------------------------------------ |
| `ref`      | `HTMLDivElement \| null`                         | `null`      | **yes**  | Binds the **inner measured track**, matching upstream's composed `contentRef`. |
| `class`    | `string \| undefined`                            | `undefined` | no       | Merged last onto *both* the announced copy and the decorative copy.            |
| `style`    | `string \| undefined`                            | `undefined` | no       | Consumer style first, the four `animation-*` longhands after.                  |
| `children` | `Snippet`                                        | `undefined` | no       | Rendered `2 × multiplier` times in total (see data-model.md).                  |
| `child`    | `Snippet<[{ props: MarqueeContentChildProps }]>` | `undefined` | no       | Applies to the announced copy; the decorative copy is still rendered.          |

Callbacks/events: none. Throws `` `<Marquee.Content>` must be used within `<Marquee.Root>`. `` when
rendered without the root. Renders two siblings: the announced track (`data-slot="marquee-content"`,
`data-orientation`) and the decorative clone (same `data-slot`, plus `data-clone=""`,
`role="presentation"`, `aria-hidden="true"`). Only the announced copy receives `restProps`, so a
caller's `id` is never duplicated (divergence D-03).

### `Marquee.Item` — `marquee-item.svelte` (alias `MarqueeItem`)

| Prop       | Type                                          | Default     | Bindable | Notes                                     |
| ---------- | --------------------------------------------- | ----------- | -------- | ----------------------------------------- |
| `ref`      | `HTMLDivElement \| null`                      | `null`      | **yes**  |                                           |
| `class`    | `string \| undefined`                         | `undefined` | no       | Merged after `shrink-0`.                  |
| `children` | `Snippet`                                     | `undefined` | no       |                                           |
| `child`    | `Snippet<[{ props: MarqueeItemChildProps }]>` | `undefined` | no       | Used by three of the four upstream demos. |

Callbacks/events: none. Renders `data-slot="marquee-item"`. Upstream's `MarqueeItem` reads no
context, so — matching upstream — it does **not** throw outside the root (research R-07).

### `Marquee.Edge` — `marquee-edge.svelte` (alias `MarqueeEdge`)

| Prop       | Type                                          | Default          | Bindable | Notes                                                         |
| ---------- | --------------------------------------------- | ---------------- | -------- | ------------------------------------------------------------- |
| `side`     | `'left' \| 'right' \| 'top' \| 'bottom'`      | — (**required**) | no       | Which edge the gradient is anchored to. No default upstream.  |
| `size`     | `'sm' \| 'default' \| 'lg'`                   | `'default'`      | no       | `1/6`, `1/4`, `1/3` of the container along the relevant axis. |
| `ref`      | `HTMLDivElement \| null`                      | `null`           | **yes**  |                                                               |
| `class`    | `string \| undefined`                         | `undefined`      | no       |                                                               |
| `children` | `Snippet`                                     | `undefined`      | no       | Decorative; upstream passes none.                             |
| `child`    | `Snippet<[{ props: MarqueeEdgeChildProps }]>` | `undefined`      | no       |                                                               |

Callbacks/events: none. Renders `data-slot="marquee-edge"`, `data-side`, `data-size`,
`aria-hidden="true"` (divergence D-05, required by FR-004) and `pointer-events-none`.

### Also exported from the barrel

Types: `MarqueeRootProps` (+ `MarqueeProps` alias), `MarqueeContentProps`, `MarqueeItemProps`,
`MarqueeEdgeProps`, and one `*ChildProps` payload type per part; `MarqueeSide`,
`MarqueeOrientation`, `MarqueeEdgeSize`, `MarqueeStateProps`.

Values: `Marquee`/`MarqueeContent`/`MarqueeItem`/`MarqueeEdge` aliases alongside
`Root`/`Content`/`Item`/`Edge`; `marqueeContentVariants`, `marqueeEdgeVariants`; `MarqueeState`,
`setMarqueeContext`, `getMarqueeContext`; and the pure helpers `MARQUEE_SIDES`,
`MARQUEE_ORIENTATIONS`, `MARQUEE_EDGE_SIZES`, `sideToOrientation`, `resolveGap`, `resolveLoopCount`,
`computeMarqueeDuration`, `computeAutoFillMultiplier`, `observeMarqueeSizes`.

**Shared module exported for later components (deliverable 5)**: `observeMarqueeSizes(root, content,
onResize)` and the pure helpers above live in `marquee.svelte.ts` and are exported from the barrel.
`observeMarqueeSizes` is the axis-aware, two-element counterpart to badge-overflow's single-element
`observeResize`, and is the piece any later size-driven port (ticker, auto-scroll carousel) should
reuse. The pure helpers are exported primarily so they are unit-testable without a DOM — the same
reason `badge-overflow` exports `computeVisibleSplit`.

## Deliverables & Sequencing

Ordered so each step is verifiable before the next depends on it. `/speckit-tasks` expands this into
`tasks.md`.

1. **`src/app.css`** — add a plain `@theme` block with six `--animate-marquee-*` variables and the
   six `@keyframes` (`marquee-left`, `marquee-right`, `marquee-left-rtl`, `marquee-right-rtl`,
   `marquee-up`, `marquee-down`), transcribed from `marquee.mdx` lines 45–108 with the stray brace
   fixed (research R-01). Nothing else in the file changes.
2. **`marquee.svelte.ts`** — `MARQUEE_SIDES` / `MARQUEE_ORIENTATIONS` / `MARQUEE_EDGE_SIZES` const
   tuples and their types; `sideToOrientation`, `resolveGap`, `resolveLoopCount`,
   `computeMarqueeDuration`, `computeAutoFillMultiplier` (pure); `observeMarqueeSizes`;
   `MarqueeState`; `MARQUEE_CONTEXT_KEY` + `setMarqueeContext` + `getMarqueeContext(consumerName)`.
3. **`marquee.svelte`** — root: `useDirection({ dir: () => dir })`, construct and publish
   `MarqueeState`, build the merged attribute payload (including `role`, `aria-live`, `dir`,
   conditional `tabindex`, composed `onkeydown`, the four custom properties), render wrapper + root
   or the `child` snippet.
4. **`marquee-content.svelte`** — `marqueeContentVariants` via `tv()`; the `$effect` that registers
   both elements with `observeMarqueeSizes` and tears the observer down; the announced track (inner
   measured div bound to `ref`, plus `multiplier - 1` extra copies) and the decorative clone
   (`multiplier` copies).
5. **`marquee-item.svelte`**, **`marquee-edge.svelte`** — thin parts; `marqueeEdgeVariants` via
   `tv()` with the six upstream compound variants.
6. **`index.ts`** — barrel per §3 of `CLAUDE.md`.
7. **`marquee.test.svelte`** — harness with a `mode` discriminator covering: default, `root-child` /
   `content-child` / `item-child` / `edge-child`, `bare-content` (no provider), `bare-item`, an
   RTL-provider wrapper, and `bind:ref` for each part.
8. **`marquee.test.ts`** — the test matrix in the next section.
9. **`src/routes/docs/components/marquee/+page.svelte`** — four `<ComponentPreview>` sections plus
   four props tables built with `$lib/components/ui/table`.
10. **`registry.json`** — one `registry:ui` entry (name `marquee`, `registryDependencies:
    ["direction-provider"]`, `dependencies: ["tailwind-variants"]`, six files, plus `cssVars.theme`
    and `css` carrying the keyframes) followed by `pnpm run registry:build`.
11. **Quality gates** — `pnpm run format`, `check`, `lint`, `test:unit -- --run`, `build`.

## Test Plan

Colocated at `src/lib/components/ui/marquee/marquee.test.ts`, driven through the `.test.svelte`
harness. Every `it` asserts (`expect.requireAssertions`). The six mandatory areas of `CLAUDE.md` §7
and Principle III map as follows.

| Area                      | Cases                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Roles & ARIA**          | root carries `role="marquee"` + `aria-live="off"` + `dir`; wrapper `data-slot="marquee-wrapper"`; exactly two content tracks render, the second one `role="presentation"` + `aria-hidden="true"` + `data-clone`; each item's text is exposed once to the accessibility tree; edge is `aria-hidden` and `pointer-events-none`; `aria-label` on the root passes through `restProps`.                                             |
| **Keyboard**              | `pauseOnKeyboard` (default): root is in the tab order (`userEvent.tab()` focuses it), has the focus-ring classes, Space toggles `data-paused` on → off → on and the event's default is prevented; other keys (`Enter`, `ArrowRight`, `Escape`) do not toggle; with `pauseOnKeyboard={false}` the root has no `tabindex`, `userEvent.tab()` skips it and Space does nothing; a caller-supplied `onkeydown` still fires alongside. |
| **Uncontrolled**          | Internal `paused` starts `false`, flips on Space, and is reflected as `data-paused` plus the `[&_*]:[animation-play-state:paused]` class — the component owns this state end to end.                                                                                                                                                                                                                                            |
| **Controlled**            | **N/A by design.** Upstream exposes no value-bearing prop, no `paused` prop and no `onPausedChange`; the only mutable state is the internal pause flag. Adding a bindable `paused` would be undocumented API drift (Principle II), so the port does not. Recorded in research R-08 and asserted negatively: changing unrelated props does not reset the pause state.                                                             |
| **RTL**                   | `side="left"` inside `<DirectionProvider dir="rtl">` ⇒ content has `animate-marquee-left-rtl` and the root `dir="rtl"`; `side="right"` ⇒ `animate-marquee-right-rtl`; the explicit `dir="rtl"` prop beats an `ltr` provider; `side="top"`/`"bottom"` are unaffected by direction; the horizontal gutter flips from `mr-(--marquee-gap)` to `ml-(--marquee-gap)`.                                                                 |
| **Guard rails**           | `<Marquee.Content>` outside the root throws `/must be used within/`; `Marquee.Item` and `Marquee.Edge` render standalone without throwing (matching upstream, R-07); `speed={0}` and `speed={-10}` still produce a finite positive `--marquee-duration`; `loopCount={0}` and `loopCount={Infinity}` produce `infinite`, `loopCount={3}` produces `3`; a zero-size container falls back to `2000/speed` (`1000/speed` with `autoFill`). |
| **Props (each one)**      | `side` → `data-orientation`/`data-side` + the right `animate-*` class; `speed`/`delay`/`gap`/`loopCount` → the four custom properties, including `gap={16}` ⇒ `16px`; `autoFill` → multiplier > 1 once measured, and the pre-measurement default duration; `reverse` → `animation-direction: reverse` + the `[animation-direction:reverse]` class; `pauseOnHover` → `group` on the root and `group-hover:`/`group-focus-within:` on the content; `class` merged last on every part; `style` composition order on root and content. |
| **Reduced motion**        | Both content tracks carry `motion-reduce:animate-none`; all item text is present in the DOM regardless (the content is never hidden to achieve the pause).                                                                                                                                                                                                                                                                      |
| **Composition (`child`)** | Each part's `child` snippet receives a payload containing that part's `data-slot`, merged `class` and (for the root) `role`/`dir`/`tabindex`, and rendering through `child` suppresses the default element while `Marquee.Content`'s decorative clone still renders.                                                                                                                                                             |
| **Bindings**              | `bind:ref` resolves to the rendered element for all four parts, and `Marquee.Content`'s `ref` is the inner measured track, not the animated wrapper.                                                                                                                                                                                                                                                                            |
| **Pure helpers**          | Direct unit tests for `sideToOrientation`, `resolveGap`, `resolveLoopCount`, `computeMarqueeDuration` (measured/unmeasured × autoFill on/off) and `computeAutoFillMultiplier` (content smaller/larger/zero) — no DOM required.                                                                                                                                                                                                   |

jsdom reports every element as `0 × 0`, so measured-size cases drive `MarqueeState` through a stubbed
`ResizeObserver` and a stubbed `getBoundingClientRect`, exactly as `badge-overflow.test.ts` already
does (research R-09).

## Complexity Tracking

> No Constitution Check violations. The two bespoke pieces are permitted by Principle IV and their
> written justification is recorded above rather than here.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | none      | —          | —                                      |

## Post-Design Constitution Re-check

Re-evaluated after `research.md`, `data-model.md`, `contracts/public-api.md` and `quickstart.md` were
written. All ten verdicts stand at PASS, with two design decisions worth restating:

- **Principle II** — the design adds no prop upstream does not have and drops none. The seven
  divergences (D-01…D-07 in research.md, each also recorded in the spec's Assumptions) are each either
  the documented-vs-source default conflict already ratified in the spec, a fix for an upstream defect,
  an accessibility requirement the spec states as an FR, or a demo-only substitution; each is recorded
  with the upstream behaviour it replaces.
- **Principle VIII** — `marquee-edge.svelte` keeps upstream's `z-10`. The "no manual z-index" rule
  targets overlay components that own their stacking (Dialog, Popover, Tooltip, Sheet); the edge
  gradient is a local sibling that must paint above the scrolling track inside the same stacking
  context, and no variant or primitive supplies it. Noted here so it is a decision, not drift.
</content>
