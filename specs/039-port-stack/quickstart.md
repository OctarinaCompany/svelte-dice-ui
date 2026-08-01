# Phase 1 Quickstart: Validating the Stack port

**Feature**: `039-port-stack` | **Date**: 2026-08-01

How to prove the port works, end to end. Details of the surface live in
[`contracts/public-api.md`](./contracts/public-api.md); the reactive model lives in
[`data-model.md`](./data-model.md). Nothing here duplicates implementation code.

## Prerequisites

- `pnpm install` already run (no new dependency is introduced by this feature).
- `src/lib/components/ui/stack/` present with `index.ts`, `stack.svelte`, `stack-item.svelte`,
  `stack.svelte.ts`, `stack.test.ts`, `stack.test.svelte`.
- `src/routes/docs/components/stack/+page.svelte` present.
- `registry.json` contains the `stack` entry.

## 1. Quality gates (the authoritative check)

Run in this order, all non-interactive:

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

Expected: zero errors and zero warnings from every command; `vitest` reports the Stack suite passing
with no skipped or `.todo` tests. Suppression comments of any kind invalidate the result
(constitution, Quality Gates → anti-cheat).

To iterate on just this component:

```bash
pnpm run test:unit -- --run src/lib/components/ui/stack/stack.test.ts
```

## 2. Scenario checks (map to spec user stories)

| # | Scenario                     | Setup                                                     | Expected                                                                                                                |
| - | ---------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1 | US1 collapsed baseline       | `Stack.Root expandOnHover` + 5 `Stack.Item`               | root `data-state="collapsed"`; wrapper _i_ has `data-index=i`, `--translate: {i*10}px`, `--item-scale: {1-0.05i}`, `z-index: {5-i}`, `opacity: {1-0.15i}`; items 3 and 4 have `data-visible="false"`, `opacity: 0`, `pointer-events-none` |
| 2 | US1 expand on hover          | hover the root (`userEvent.hover`)                        | root `data-state="expanded"` and `data-expanded="true"`; every wrapper `data-expanded="true"`, `--item-scale: 1`, `--translate: {i*gap + sizeBefore}px`, `opacity: 1`; every card `data-state="expanded"` |
| 3 | US1 collapse on leave        | `userEvent.unhover` the root                              | back to the scenario-1 attribute set                                                                                     |
| 4 | US1 pointer held down        | `pointerdown` on the root, then `unhover`                 | stays `data-state="expanded"`; after `pointerup` **on `document`**, a further `unhover` collapses it (research R-06)      |
| 5 | US2 static stack             | `Stack.Root` with `expandOnHover` omitted / `false`        | hover, mousemove and unhover leave `data-state="collapsed"` unchanged                                                    |
| 6 | US3 side                     | one root `side="top"`, one `side="bottom"`                 | `top` wrappers carry `origin-top`/`top-0` and the negated translate utility; `bottom` wrappers carry `origin-bottom`/`bottom-0`; all other attributes identical between the two |
| 7 | Edge: fewer children than `itemCount` | 2 items, default `itemCount={3}`                   | both `data-visible="true"`; no crash; z-index `2,1`                                                                     |
| 8 | Edge: `expandedItemCount`    | 5 items, `expandedItemCount={2}`, expanded                | items 2–4 keep `data-visible="false"`, `opacity: 0`, `pointer-events-none` while expanded                               |
| 9 | Edge: dynamic children       | remove the first of 3 items via `{#each}`                 | remaining items renumber to `data-index` 0,1, front flag moves, `z-index` becomes `2,1`, no stale offset (research R-05) |
| 10 | Reduced motion              | wrapper class list                                        | contains `motion-reduce:transition-none`; card class list too                                                            |
| 11 | RTL                         | root inside `dir="rtl"`                                   | identical data attributes and translate values to LTR; wrapper uses `start-0`, never `left-0`                            |
| 12 | Guard rail                  | render `Stack.Item` with no root                          | throws ``/`<Stack.Item>` must be used within `<Stack.Root>`/``                                                            |
| 13 | `child` snippet             | root and item each rendered through `child`               | the spread payload reproduces every `data-*`, `class` and handler; `children` is not double-rendered; `ref` stays `null`  |
| 14 | A11y by construction        | collapsed stack with a `<button>` in the last item        | that button is still `getByRole('button')`-queryable and still reachable with `userEvent.tab()` (research R-11)          |
| 15 | Event composition           | caller `onmouseenter` that calls `preventDefault()`       | caller handler ran; stack did **not** expand (FR-013)                                                                    |

Scenarios 1–15 are all expressible in `stack.test.ts`, except the `child`-snippet, `{#each}` and
no-provider cases, which need `stack.test.svelte` (the harness pattern used by `marquee`).

**jsdom caveat**: `getBoundingClientRect()` returns zeros, so measured natural sizes are `0` and the
expanded translate reduces to `index * gap`. Assert that value; do not stub layout.

## 3. Demo route

```bash
pnpm run build            # must compile /docs/components/stack
```

Then, for a manual look (only outside the unattended pipeline — never start a dev server inside it),
open `/docs/components/stack`. Expected: three `<ComponentPreview>` sections — **Default**
(hover-expanding, `w-[360px]`), **Without Expansion** (static), **Different Sides** (a two-column grid
of `side="top"` and `side="bottom"`) — plus the API reference tables. Hovering the first and third
sections expands them; the second never moves.

## 4. Registry

```bash
pnpm run registry:build
```

Expected: exits zero and writes `static/r/stack.json` containing the four component files with
`$lib/...` imports rewritten to registry placeholders, and `registryDependencies: ["speed-dial"]`
preserved.
