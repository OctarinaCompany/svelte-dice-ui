# Implementation Plan: Scroll Spy

**Branch**: `030-port-scroll-spy` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/030-port-scroll-spy/spec.md`

## Summary

Port Dice UI's `ScrollSpy` — a five-part compound component that highlights the navigation link of
whichever tracked content section is topmost in the visible area, and scrolls to a section when its
link is clicked — to Svelte 5 runes, shipped as a shadcn-svelte registry item.

Technical approach: one folder `src/lib/components/ui/scroll-spy/` with five `.svelte` parts, a runes
state module (`scroll-spy.svelte.ts`) holding the active-value store, the section registry, the
programmatic-scroll routine and the `Symbol`-keyed context, plus a deliberately standalone
`section-observer.svelte.ts` wrapping `IntersectionObserver` + "topmost intersecting entry" selection
so the not-yet-ported `tour` can import it. Direction resolution composes the already-ported
`direction-provider` (`useDirection`); container/window scroll arithmetic composes `scroller`'s
`readScrollMetrics`. `asChild` becomes a `child` snippet on all five parts.

## Technical Context

**Language/Version**: TypeScript 5 (strict, `verbatimModuleSyntax`), Svelte 5 with runes forced on
(`vite.config.ts`), SvelteKit 2

**Primary Dependencies**: `bits-ui`, `tailwind-variants`, `clsx` + `tailwind-merge` (via
`$lib/utils.js` `cn()`), `@lucide/svelte` (not needed here — no icons in this component). Internal:
`$lib/components/ui/direction-provider`, `$lib/components/ui/scroller`.

**New npm dependencies**: **none**. Upstream's only runtime dependency is `radix-ui`
(`Direction.useDirection`, `Slot`), both of which have in-repo equivalents (`direction-provider`,
the `child` snippet pattern). `IntersectionObserver` is a browser API, not a package.

**Storage**: N/A

**Testing**: Vitest (jsdom, `globals: false`, `expect.requireAssertions` on) +
`@testing-library/svelte` + `@testing-library/user-event`. Colocated at
`src/lib/components/ui/scroll-spy/scroll-spy.test.ts`, with a companion
`scroll-spy.test.svelte` harness (not collected by Vitest, not in `registry.json`) for the cases a
`.ts` spec cannot express: `child` snippets, `bind:ref`, parent-owned controlled state, a part with
no provider ancestor, and a `<DirectionProvider>` wrapper.

**Target Platform**: Browsers with `IntersectionObserver` (baseline since 2019); SSR-safe — every
observer/timer/`matchMedia` touch is guarded by `typeof window === 'undefined'` or lives inside
`$effect` (client-only).

**Project Type**: shadcn-svelte registry component (source-distributed) + one docs demo route.

**Performance Goals**: activation updates coalesced to one `requestAnimationFrame` per observer
batch (upstream parity); no per-scroll-event work — all passive tracking is observer-driven.

**Constraints**: no `any`, no suppressions, no new dependencies, no `shadcn-svelte add`, no writes
outside this feature directory + `src/lib/components/ui/scroll-spy/` +
`src/routes/docs/components/scroll-spy/` + `registry.json` (+ `static/r/` via `registry:build`).

**Scale/Scope**: 5 parts, 2 runes modules, 1 barrel, 1 test spec + 1 test harness, 1 demo route with
3 upstream examples + a sticky-layout example + 5 props tables, 1 registry entry.

## Public API

Derived from `.reference/diceui/docs/registry/bases/radix/ui/scroll-spy.tsx` at the pinned commit
(`d9763d8`), cross-checked against `docs/content/docs/components/radix/scroll-spy.mdx`.

Every part additionally accepts the full `HTMLAttributes` set for its element via
`WithElementRef<…>` + `...restProps`, and `class` (merged last through `cn()`).

### `ScrollSpy` (Root) — `scroll-spy.svelte`, exported as `Root` / `ScrollSpy`

| Prop             | Type                                          | Default                    | Bindable | Notes                                                                           |
| ---------------- | --------------------------------------------- | -------------------------- | -------- | ------------------------------------------------------------------------------- |
| `ref`            | `HTMLDivElement \| null`                      | `null`                     | ✅       | `bind:this` on the rendered `<div>`; stays `null` in `child` mode.              |
| `value`          | `string \| undefined`                         | `undefined`                | ✅       | Active section id. Controlled when bound/passed.                                |
| `defaultValue`   | `string \| undefined`                         | `undefined`                | —        | Seeds `value` once: `value ??= defaultValue ?? ''`.                             |
| `onValueChange`  | `(value: string) => void`                     | —                          | —        | Fires on every **truthy** change (upstream `if (key === 'value' && value)`).    |
| `rootMargin`     | `string \| undefined`                         | `` `${-offset}px 0px -70% 0px` `` | —  | Passed to `IntersectionObserver`.                                               |
| `threshold`      | `number \| number[]`                          | `0.1`                      | —        | Passed to `IntersectionObserver`.                                               |
| `offset`         | `number`                                      | `0`                        | —        | Pixels subtracted from the scroll destination; also drives the default margin.  |
| `scrollBehavior` | `ScrollBehavior`                              | `getDefaultScrollBehavior()` | —      | `'auto'` under `prefers-reduced-motion: reduce`, else `'smooth'`.               |
| `scrollContainer`| `HTMLElement \| null`                         | `null`                     | —        | `null` ⇒ track/scroll the window. Also the observer `root`.                     |
| `dir`            | `'ltr' \| 'rtl' \| undefined`                 | resolved                   | —        | Falls back to nearest `<DirectionProvider>`, then ambient DOM `dir`, then `ltr`.|
| `orientation`    | `'horizontal' \| 'vertical'`                  | `'horizontal'`             | —        | Layout only; published as `data-orientation` on every part.                     |
| `child`          | `Snippet<[{ props: ScrollSpyChildProps }]>`   | —                          | —        | Replaces upstream `asChild`.                                                    |
| `children`       | `Snippet`                                     | —                          | —        | Not rendered in `child` mode (the caller owns the element).                     |

Rendered element: `<div data-slot="scroll-spy" data-orientation dir class="flex flex-row|flex-col">`.
Callbacks/events: `onValueChange` only (no other upstream callback exists).

### `ScrollSpyNav` — `scroll-spy-nav.svelte`, exported as `Nav` / `ScrollSpyNav`

| Prop       | Type                                            | Default | Bindable | Notes                    |
| ---------- | ----------------------------------------------- | ------- | -------- | ------------------------ |
| `ref`      | `HTMLElement \| null`                           | `null`  | ✅       | The `<nav>`.             |
| `child`    | `Snippet<[{ props: ScrollSpyNavChildProps }]>`  | —       | —        | Replaces `asChild`.      |
| `children` | `Snippet`                                       | —       | —        |                          |

Rendered element: `<nav data-slot="scroll-spy-nav" data-orientation dir class="flex gap-2 flex-col|flex-row">`
(upstream deliberately inverts the nav axis relative to the root — preserved verbatim).

### `ScrollSpyLink` — `scroll-spy-link.svelte`, exported as `Link` / `ScrollSpyLink`

| Prop       | Type                                             | Default | Bindable | Notes                                                                     |
| ---------- | ------------------------------------------------ | ------- | -------- | ------------------------------------------------------------------------- |
| `value`    | `string` (**required**)                          | —       | —        | Section id this link targets.                                             |
| `ref`      | `HTMLAnchorElement \| null`                      | `null`  | ✅       |                                                                            |
| `onclick`  | `MouseEventHandler<HTMLAnchorElement>`           | —       | —        | Upstream `onClick`; runs **after** `preventDefault()`, before the scroll. |
| `child`    | `Snippet<[{ props: ScrollSpyLinkChildProps }]>`   | —       | —        | Replaces `asChild`; `href` is **omitted** in `child` mode (upstream 387). |
| `children` | `Snippet`                                        | —       | —        |                                                                            |

Rendered element: `<a href="#{value}" data-slot="scroll-spy-link" data-orientation
data-state="active" | "inactive">`. Activation: click, and `Enter`/`Space` via native anchor
semantics.

### `ScrollSpyViewport` — `scroll-spy-viewport.svelte`, exported as `Viewport` / `ScrollSpyViewport`

| Prop       | Type                                                 | Default | Bindable | Notes                                                    |
| ---------- | ---------------------------------------------------- | ------- | -------- | -------------------------------------------------------- |
| `ref`      | `HTMLDivElement \| null`                             | `null`  | ✅       | Bound by every upstream demo and handed to `scrollContainer`. |
| `child`    | `Snippet<[{ props: ScrollSpyViewportChildProps }]>`   | —       | —        | Replaces `asChild`.                                      |
| `children` | `Snippet`                                            | —       | —        |                                                          |

Rendered element: `<div data-slot="scroll-spy-viewport" data-orientation dir class="flex flex-1 flex-col gap-8">`.

### `ScrollSpySection` — `scroll-spy-section.svelte`, exported as `Section` / `ScrollSpySection`

| Prop       | Type                                                | Default | Bindable | Notes                                                              |
| ---------- | --------------------------------------------------- | ------- | -------- | ------------------------------------------------------------------ |
| `value`    | `string` (**required**)                             | —       | —        | Becomes the element's `id`; registers the element for tracking.    |
| `ref`      | `HTMLDivElement \| null`                            | `null`  | ✅       |                                                                     |
| `child`    | `Snippet<[{ props: ScrollSpySectionChildProps }]>`   | —       | —        | Replaces `asChild`.                                                |
| `children` | `Snippet`                                           | —       | —        |                                                                     |

Rendered element: `<div id={value} data-slot="scroll-spy-section" data-orientation>`. Upstream
applies **no** default classes to the section (it never calls `cn()` there) — the caller's `class`
passes straight through; parity preserved.

### Types and values exported from the barrel

`ScrollSpyRootProps` (alias `ScrollSpyProps`), `ScrollSpyNavProps`, `ScrollSpyLinkProps`,
`ScrollSpyViewportProps`, `ScrollSpySectionProps`, each part's `*ChildProps`; `ScrollSpyOrientation`,
`SCROLL_SPY_ORIENTATIONS`, `DEFAULT_ORIENTATION`, `DEFAULT_OFFSET`, `DEFAULT_THRESHOLD`,
`SCROLL_SETTLE_DELAY`, `getDefaultScrollBehavior`, `ScrollSpyState`, `ScrollSpyStateProps`,
`setScrollSpyContext`, `getScrollSpyContext`; and from the reusable module (§ deliverable 5)
`observeSections`, `pickTopmostEntry`, `SectionRegistry`, `SectionObserverOptions`.

### Guard-rail errors (FR-014)

`Nav`, `Link`, `Viewport` and `Section` each call `getScrollSpyContext('<part>')`, which throws
``​`<ScrollSpy.Nav>` must be used within `<ScrollSpy.Root>`.`` (part name substituted) — mirroring
upstream's `` `${consumerName}` must be used within `ScrollSpy` ``.

## Constitution Check

_GATE: passed before Phase 0 research; re-checked after Phase 1 design (identical verdicts — see
"Post-Design Re-check" below)._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                             |
| ---- | ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect`/`$props`/`$bindable` + snippets only; behaviour in `scroll-spy.svelte.ts` + `section-observer.svelte.ts`; no stores, `export let`, dispatcher or `<slot>`. |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | All 11 root props, 2 part `value` props, `onValueChange`, `asChild`×5, `data-slot`/`data-orientation`/`data-state`, `href`/`id` wiring reproduced; divergences D-1…D-5 recorded in research.md and spec Assumptions. |
| III  | Accessibility Is a MUST             | PASS    | Native `<nav>` + `<a href="#id">` keeps role `navigation`/`link`, Tab order and Enter activation via native anchor semantics (`Space` intentionally left to the browser's native page-scroll, a documented divergence from the MDX keyboard table — spec Assumptions, FR-019, research R-08); `aria-current` on the active link (FR-003); accessible `Nav` name via `aria-label`/`aria-labelledby`; RTL via `dir`; test areas listed in Testing Strategy. |
| IV   | Composition Over Reimplementation   | PASS    | `direction-provider` (`useDirection`) and `scroller` (`readScrollMetrics`) composed; bespoke `IntersectionObserver` wrapper justified below.                          |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file, `index.ts` barrel with short + prefixed names + types, `.js` extensions, one `registry:ui` entry, zero imports from `src/routes/**` or `$lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Prop types in `<script lang="ts" module>`, `WithElementRef<HTMLAttributes<…>>`; no `any`, no ignore comments, no config edits.                                        |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final task; no `.skip`/`.todo`.                                                          |
| VIII | Styling Discipline                  | PASS    | `cn()` + `tv()` for the two orientation-variant class sets; upstream's classes are already semantic tokens (`text-muted-foreground`, `bg-accent`, `text-foreground`); `data-slot` on all five parts; `data-state`/`data-orientation` exposed. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/scroll-spy/+page.svelte` with one `<ComponentPreview>` per upstream demo file (`scroll-spy-demo`, `scroll-spy-vertical-demo`, `scroll-spy-controlled-demo`) plus the MDX-only "Sticky Layout" example. |
| X    | One Feature Directory Per Component | PASS    | All planning artifacts under `specs/030-port-scroll-spy/`; no git write commands; no writes to protected paths.                                                       |

**Bespoke behaviour justification (Principle IV)**:

1. **`IntersectionObserver` wrapper + topmost-entry selection** (`section-observer.svelte.ts`).
   Evaluated: `bits-ui` (no intersection/visibility primitive of any kind — its scroll-related
   exports are `ScrollArea` viewport plumbing and floating-ui `autoUpdate`, neither of which reports
   "which of N elements is topmost-visible"); `src/lib/components/ui/scroller`
   (`observeScrollPosition` reports *one container's* scroll metrics, not per-element visibility);
   `scroll-area` (styling/viewport only). Missing capability: element-visibility observation with a
   configurable `root`/`rootMargin`/`threshold`. Written directly per `CLAUDE.md` §4 and exported
   standalone so `tour` reuses it.
2. **Programmatic scroll-to-section with pixel offset** (`ScrollSpyState.scrollToSection`). The
   container-vs-window branch and the `scrollTop` read are taken from `scroller`'s
   `readScrollMetrics`; only the `getBoundingClientRect()` delta arithmetic and the `scrollTo({top,
   behavior})` call are written here, because no existing primitive scrolls *to an offset-adjusted
   position of a descendant*. `Element.scrollIntoView` cannot express the `offset` prop.
3. **500 ms "is scrolling" suppression window**. No primitive owns this; it is upstream's own
   mechanism (lines 210-216) and is preserved verbatim as a non-reactive field + `window.setTimeout`
   cleared on teardown.

## Project Structure

### Documentation (this feature)

```text
specs/030-port-scroll-spy/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── scroll-spy.api.md   # Phase 1 output — public surface contract
├── checklists/
│   └── requirements.md  # from /speckit-specify
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/scroll-spy/
├── index.ts                      # barrel: short names + prefixed aliases + types + runes exports
├── scroll-spy.svelte             # Root        ← scroll-spy.tsx `ScrollSpy` (104-330)
├── scroll-spy-nav.svelte         # Nav         ← `ScrollSpyNav` (336-356)
├── scroll-spy-link.svelte        # Link        ← `ScrollSpyLink` (363-395)
├── scroll-spy-viewport.svelte    # Viewport    ← `ScrollSpyViewport` (401-417)
├── scroll-spy-section.svelte     # Section     ← `ScrollSpySection` (424-454)
├── scroll-spy.svelte.ts          # ScrollSpyState + Symbol context + defaults
│                                 #             ← the store (33-64), context (66-88),
│                                 #                onScrollToSection (174-219), value effect (221-232)
├── section-observer.svelte.ts    # observeSections / pickTopmostEntry / SectionRegistry
│                                 #             ← observer effect (234-285) + section map (157-172)
├── scroll-spy.test.ts            # colocated spec (NOT in registry.json)
└── scroll-spy.test.svelte        # harness for child snippets / bind:ref / guard rails / RTL
                                  # (NOT collected by Vitest, NOT in registry.json)

src/routes/docs/components/scroll-spy/
└── +page.svelte                  # 4 <ComponentPreview> sections + 5 props tables

registry.json                     # append exactly one registry:ui entry named "scroll-spy"
```

**Structure Decision**: folder slug `scroll-spy` == registry item `name` == demo route segment
`src/routes/docs/components/scroll-spy/`, as required by Principles V and IX. Upstream ships the
component in **both** flavours; they are behaviourally identical (verified by diff — research R-01),
so `.reference/diceui/docs/registry/bases/radix/**` is the parity source named by the port request,
and the MDX (identical in substance in both flavours) is the contract.

The store/context split of upstream (`StoreContext` for the hot `value`, `ScrollSpyContext` for the
cold config) collapses into **one** `ScrollSpyState` published under **one** `Symbol` key: Svelte's
fine-grained reactivity already gives each `Link` a dependency on `state.value` alone, which is the
sole reason upstream needs `useSyncExternalStore` (spec Assumption "Store-based reactivity").

### Implementation order (feeds `/speckit-tasks`)

1. `section-observer.svelte.ts` — pure `pickTopmostEntry`, `observeSections`, `SectionRegistry`.
2. `scroll-spy.svelte.ts` — defaults, `getDefaultScrollBehavior`, `ScrollSpyState`, context helpers.
3. `scroll-spy.svelte` (Root) → `-nav` → `-link` → `-viewport` → `-section` → `index.ts`.
4. `scroll-spy.test.svelte` harness, then `scroll-spy.test.ts`.
5. `src/routes/docs/components/scroll-spy/+page.svelte`.
6. `registry.json` entry + `pnpm run registry:build`.
7. Quality gates: `format` → `check` → `lint` → `test:unit -- --run` → `build`.

## Testing Strategy (Constitution III, spec SC-003)

`scroll-spy.test.ts` groups, all driven through `@testing-library/user-event` where a user action is
involved:

- **Rendering & structure** — three links + three sections render; `role="navigation"` on the nav;
  three `role="link"`s; `href="#id"` per link (including the `intro`/`introduction`/`intro-details`
  shared-prefix case); `id` per section; `data-slot` on all five parts.
- **Every prop** — `orientation` (both values, on all five parts' `data-orientation`), `offset`,
  `threshold`, `rootMargin` (asserted on the captured `IntersectionObserver` options),
  `scrollContainer` (container branch calls `container.scrollTo`, window branch calls
  `window.scrollTo`), `scrollBehavior` (explicit value forwarded; `prefers-reduced-motion` default
  asserted by overriding `matchMedia`), `class` merge, `...restProps` passthrough, `bind:ref`.
- **Uncontrolled** — `defaultValue` seeds the active link; clicking another link moves it; no
  `rerender()` is used for uncontrolled state (see research R-06).
- **Controlled** — parent-owned `value` via the harness: `onValueChange` fires with the next id on
  click; changing the parent's `value` moves `data-state="active"` **and** triggers a scroll; an
  unbound `value` does not move on its own.
- **Passive activation (SC-001)** — a stubbed `IntersectionObserver` captures the callback; feeding
  entries drives activation, asserting: topmost-of-several wins, non-intersecting entries ignored,
  an empty intersecting set leaves the previous value, an unregistered `id` is ignored, and updates
  are suppressed while the 500 ms post-click window is open (fake timers) and resume after it.
- **Keyboard** — `Tab` moves through the links in order; `Enter` on a focused link activates it
  (and `Space`, which native anchors do not fire — asserted as "does not change value", matching
  real browser anchor behaviour, with the MDX claim noted in research R-08).
- **RTL** — `dir="rtl"` on the root propagates to `<nav>`/viewport; a `<DirectionProvider dir="rtl">`
  ancestor is honoured when no `dir` prop is set; link order and `href` are unchanged (this
  component has no horizontal arrow navigation — FR-015 is about direction propagation and
  measurement, and the scroll math is vertical-only, so nothing inverts).
- **Guard rails** — each of `Nav`/`Link`/`Viewport`/`Section` rendered outside a root throws
  `/must be used within/`; a section with `value=""` is not registered/observed; clicking a link
  whose section does not exist still sets the value and fires `onValueChange`.
- **Teardown (FR-018)** — unmount disconnects the observer, cancels the pending
  `requestAnimationFrame` and clears the settle timeout (asserted on spies, and by driving the
  captured callback *after* unmount and asserting no further `onValueChange` — a positive
  pre-unmount assertion is included first so the check cannot go vacuous).
- **`child` snippet** — each part renders the caller's element with the merged props, keeps its
  `data-*`, and (for `Link`) omits `href`.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | —         | —          | —                                      |

## Post-Design Re-check (after Phase 1)

Re-evaluated after `research.md`, `data-model.md`, `contracts/scroll-spy.api.md` and `quickstart.md`
were written: all ten verdicts stand. The design added no dependency, no suppression and no
docs→component import; the two bespoke units (observer wrapper, offset scroll math) are the ones
already justified above, and `section-observer.svelte.ts` is exported from the barrel exactly as the
spec's Assumptions require for `tour`.
