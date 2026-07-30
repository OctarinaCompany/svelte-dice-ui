# Phase 0 Research: Masonry

**Feature**: `013-port-masonry` | **Date**: 2026-07-30

**Upstream (pinned `d9763d82530416dfa4c81c462387b55d06bae4ec`)**

| Artifact | Path                                                                     |
| -------- | ------------------------------------------------------------------------ |
| Source   | `.reference/diceui/docs/registry/bases/radix/ui/masonry.tsx` (1536 lines) |
| Docs     | `.reference/diceui/docs/content/docs/components/radix/masonry.mdx`        |
| Demos    | `.reference/diceui/docs/registry/bases/radix/examples/masonry-demo.tsx`   |
|          | `…/masonry-linear-demo.tsx`, `…/masonry-ssr-demo.tsx`                     |
| Tests    | none upstream — no `masonry.test.tsx` exists at the pinned commit         |

There is **no upstream test file** for masonry, so Principle III's "upstream assertions are the floor"
degenerates to "our assertions are the whole floor". The test plan below is therefore derived from the
source's observable behaviour, not copied.

---

## R-01 — `React.Children.toArray` has no Svelte equivalent

**Finding.** Upstream's whole architecture rests on `MasonryViewport` inspecting `children`:
it filters valid `MasonryItem` elements (line 1362), derives `itemCount` from that array, and
`React.cloneElement`s only the in-range subset with a computed `ref` and `style`. `MasonryItem`
itself (line 1528) is a **context-free** `<div>` — it knows nothing; the parent injects everything.

Svelte 5 cannot introspect a `Snippet`. `CLAUDE.md` §10 states the rule outright:
_"`React.Children` inspection → not available — model it explicitly with context or an items array."_

**Decision.** Invert the control flow: **items register themselves with the root's state and position
themselves.** `MasonryItem` reads the masonry context at init, obtains a stable index, and renders its
own absolute-positioned wrapper. `MasonryViewport` becomes a pure sizing container.

**Rationale.** The alternative — an `items: T[]` prop plus an `item: Snippet<[T, number]>` render
prop — gives cleaner virtualization but abandons the documented `<Masonry><MasonryItem/></Masonry>`
composition that all three upstream demos use, and would break Principle II far more visibly than an
inverted-but-equivalent internal wiring. Registration keeps the public composition byte-for-byte.

**Consequence.** `MasonryItem` now *requires* the root context and therefore throws when used
standalone. Upstream never throws (its `MASONRY_ERROR[ITEM_NAME]` string is dead code, because the
item never calls `useMasonryContext`). Our throw is the Principle III / §5 guard rail and is tested.

**Alternatives considered.** (a) render-prop API — rejected above; (b) parse `children` at runtime via
a hidden measurement pass — no API for it, and would double-render every item.

---

## R-02 — Index assignment without child inspection

**Finding.** The positioner is index-addressed: `set(index, height)`, `get(index)`, and
`columnItems[col]` is an ascending index list that `update()` binary-searches. Index therefore must be
(a) stable per item and (b) equal to the item's position in source order.

**Decision.** `MasonryState` keeps an ordered registry of opaque tokens. `MasonryItem` calls
`state.registerItem(token)` during component init and unregisters in its `$effect` teardown; its index
is `$derived(state.indexOf(token))`. Because Svelte instantiates `{#each}` children in source order on
the initial render, initial indices match source order exactly.

**Escape hatch.** A mid-list *insertion* after mount appends the new token, which would order it last.
`MasonryItem` therefore also accepts an optional **`index?: number`** prop that, when supplied, wins
over registration order. This is an addition to upstream's API (upstream derives the same number from
child position, which we cannot see) and is recorded in the spec's Assumptions.

**Cost.** `indexOf` over the token array is O(n) per item, O(n²) per full re-registration. At the
spec's stated scale (SC-008: 200+ items) that is ≤40 000 pointer comparisons on a structural change
only — not per frame, not per scroll tick. Accepted; no index cache needed.

---

## R-03 — Virtualization: `{#if}` inside the item, not around it

**Finding.** Upstream mounts only (i) items whose interval overlaps
`[scrollTop − overscanPx/2, scrollTop + overscanPx]` and (ii) a `visibility:hidden` measurement batch
starting at `measuredCount`. FR-013/SC-008 require the same DOM bound here.

**Decision.** The `{#if}` gate lives **inside `masonry-item.svelte`**, wrapping its own element:

```svelte
{#if visible}
	<div bind:this={ref} {...itemAttrs}>{@render children?.()}</div>
{/if}
```

The `MasonryItem` *component instance* always exists (that is what makes registration work); its
**DOM subtree** exists only when in range. This is an exact cost analogue of upstream, where
`React.Children.toArray` also materialises every child element while mounting only the in-range ones.

**Rationale.** A gate placed around `<Masonry.Item>` in caller code would put virtualization in the
consumer's hands and destroy registration. Gating inside is the only placement that keeps both.

---

## R-04 — Measurement must stay strictly sequential (SC-001 parity)

**Finding.** `positioner.set()` appends to whichever column is currently shortest. The result depends
on **the order `set` is called in**, not just on the heights. Upstream guarantees index order because
the measurement batch always starts at `measuredCount = positioner.size()` and grows forward.

**Risk.** With self-registering items, item 5's `ResizeObserver` could fire before item 3's, producing
a different — and wrong — column assignment than React would.

**Decision.** `MasonryState` buffers reported heights in a `Map<number, number>` and drains it
strictly in order:

```ts
while (pending.has(positioner.size())) {
	const i = positioner.size();
	positioner.set(i, pending.get(i) ?? 0);
	pending.delete(i);
}
```

An item outside the batch that reports early is held until its predecessors land. This makes column
assignment deterministic and identical to upstream for the same height sequence, which is exactly what
SC-001 asserts.

---

## R-05 — The positioner and interval tree stay pure (no runes)

**Decision.** `masonry-interval-tree.ts` and `masonry-positioner.ts` are plain `.ts` modules — a
direct, behaviour-preserving port of lines 8–426 and 594–799 of the upstream file, with `React.useRef`
/ `useCallback` scaffolding stripped. No runes, no DOM.

**Rationale.** Three wins: (1) SC-001 (upstream parity of column assignment) becomes directly
unit-testable in `masonry-positioner.test.ts` with hand-fed heights and zero jsdom involvement;
(2) the red-black tree is imperative mutation — wrapping it in `$state` would create thousands of
useless reactive reads per insert; (3) it keeps `masonry.svelte.ts` about *reactivity*, not algorithms.

The positioner is recreated (not mutated) whenever `width`/`columnWidth`/`columnGap`/`rowGap`/
`columnCount`/`maxColumnCount`/`linear` change, replaying previously measured heights into the new
instance — upstream lines 817–835. In Svelte that is a `$derived.by` over those seven inputs, with the
replay done inside the derivation from the previous instance captured in a non-reactive field.

---

## R-06 — Hooks that are dropped outright

| Upstream                       | Lines     | Disposition                                                                                                                                    |
| ------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `onDeepMemo` + `Cache`         | 428–539   | **Dropped.** A `WeakMap` memo whose only job is to stop React re-renders from rebuilding the `ResizeObserver`. Svelte creates it once, in one `$effect` keyed to the positioner. Zero behavioural difference; −112 lines. |
| `useComposedRefs`              | 1229      | **Dropped.** One DOM node, one `ref = $bindable(null)` + `bind:this`. Already recorded in the spec's Assumptions.                              |
| `useIsomorphicLayoutEffect`    | 1243–1263 | **`$effect.pre`.** Svelte runs no effects during SSR, so the isomorphic wrapper has nothing to guard. Already in Assumptions.                  |
| `useMemo` / `useCallback`      | many      | **Dropped.** `$derived` where the value is read in markup; nothing at all where it was pure identity stability.                               |
| `React.useState(layoutVersion)`| 1351      | **Kept as `$state`.** It is a real invalidation token: the RAF-driven "layout is outdated, re-run `range()`" nudge, surfaced as `data-version`. |

`useThrottle` (1085–1149), `useDebouncedWindowSize` (847–906), `useScroller` (1020–1083),
`onRafSchedule` (913–936) and `useResizeObserver` (938–1018) are **kept**, ported as private helpers
inside `masonry.svelte.ts` (spec Assumption: not exported through `index.ts`… see R-10 for the
refinement).

---

## R-07 — RTL: CSS logical property, not a mirrored pixel maths

**Finding.** Upstream computes `left = columnIndex * (columnWidth + columnGap)` and writes it to
`style.left`. There is no direction awareness anywhere in the file. FR-018/SC-005 require mirroring.

**Options.**

1. Mirror in the positioner: emit `right` when `dir === 'rtl'`. Pollutes the pure module with a
   direction input and forks the SC-001 parity surface.
2. Keep the positioner LTR-pure and render `inset-inline-start: {left}px` instead of `left: {left}px`,
   with `dir` set on the root element.

**Decision: option 2.** The number the positioner produces is an offset from the *leading* edge, which
is direction-agnostic; only the physical edge it anchors to flips. `inset-inline-start` does that flip
in CSS with no JS branch, and the positioner's output stays byte-identical between LTR and RTL — which
is precisely what makes SC-001 verifiable in one set of tests.

**Direction source.** `useDirection()` from `direction-provider` (already the repo's convention:
marquee, scroller, timeline all compose it). It resolves `explicit dir prop → nearest
<DirectionProvider> → ancestor [dir] → 'ltr'`. The root writes the resolved value to its own `dir`
attribute so `inset-inline-start` resolves correctly even when the direction came from a provider that
never touched the DOM.

**API consequence.** A `dir?: Direction` prop is added to `Masonry` (upstream has none), and
`HTMLAttributes`' loose `dir?: string` is `Omit`ted so the typed one wins — the exact pattern
`marquee.svelte` already uses. Recorded in Assumptions.

---

## R-08 — SSR-safe first paint

**Finding.** `MasonryViewport` returns `context.fallback` verbatim while `!mounted`, replacing the
entire positioned list (upstream 1508–1510). `mounted` flips in a layout effect, i.e. never on the
server.

**Decision.** `mounted = $state(false)`, flipped in the root's `$effect.pre`. The viewport renders
`{#if !mounted && fallback}{@render fallback()}{:else}<div …>{@render children?.()}</div>{/if}`.
`fallback` is a `Snippet` (React `ReactNode` → Snippet, per `CLAUDE.md` §10).

**Why `$effect.pre` and not `onMount`.** Both are client-only; `$effect.pre` runs before paint, which
is what upstream's `useIsomorphicLayoutEffect` buys — the container-offset measurement in the same
phase must not be a frame late or the first `range()` call uses a stale `scrollTop` offset.

**Zero-measurement path.** With no `fallback`, `estimateHeight(0, itemHeight)` returns `0`, the
container renders at height 0 and no item is positioned. No error, no overlap — SC-002 holds
trivially, and FR-019/AC-3 is satisfied.

**Hydration.** Because the server emits the fallback and the client's first pass also renders the
fallback (`mounted` starts `false`), server and client markup agree; the swap happens in the
post-hydration effect. No mismatch.

---

## R-09 — jsdom cannot measure, so tests must fake three things

`tests/setup.ts` ships a **no-op** `ResizeObserver` and jsdom reports `offsetWidth`/`offsetHeight`
as `0`. The test plan therefore requires, per-suite and torn down in `afterEach`:

1. **`offsetHeight` / `offsetWidth`** — `Object.defineProperty(HTMLElement.prototype, …)` returning a
   value read from a `data-test-height` attribute on the element (so each item can declare its own
   height in the harness).
2. **`document.documentElement.clientWidth` / `clientHeight`** — stubbed to drive column-count
   computation and the overscan window.
3. **`ResizeObserver`** — a per-suite capturing fake that records observed elements and exposes a
   `trigger(el)` so FR-012 (content changes size → re-flow) is drivable.

Plus `vi.useFakeTimers()` for the 300 ms resize debounce and the `1000/fps` scroll throttle, and a
`requestAnimationFrame` that runs on the fake clock. Overriding a global shim inside one file, then
restoring it, is not a config loosening and does not touch `tests/setup.ts`.

`masonry-positioner.test.ts` needs **none** of this — it feeds heights directly. That is the file
carrying the SC-001 parity assertions.

---

## R-10 — What this port exports for later reuse

**Finding.** The repo has no `src/lib/hooks/` or shared-utility folder; the established pattern for
sharing is a **component folder that other components list in `registryDependencies`** (marquee,
scroller and timeline all depend on `direction-provider` this way). Marquee's `index.ts` also exports
its state class and helpers, so the precedent for a rich barrel exists.

**Decision.** Do **not** create a new shared folder. Export from `masonry/index.ts`:

- the four public component prop types plus the two `ChildProps` payload types,
- `MasonryState`, `getMasonryContext`, `setMasonryContext`, `type MasonryStateProps`,
- `createPositioner`, `createIntervalTree`, `resolveColumnCount`, `resolveColumnWidth`, and their
  types (`Positioner`, `PositionerItem`, `PositionerOptions`, `IntervalTree`).

The scroll/resize/throttle helpers stay module-private (spec Assumption). **Rationale**: a virtualized
list or a virtualized grid ported later can depend on `masonry` for the interval tree and positioner —
a real, reusable asset — whereas promoting a 40-line throttle to a shared folder before a second
consumer exists is speculative structure. If a second component needs the throttle, that is the moment
to extract it.

This slightly widens the spec's "internal helpers are not exposed through `index.ts`" assumption:
the *positioner and tree* are exposed (they are generic and reusable), the *DOM/scroll hooks* are not.
Recorded in the spec's Assumptions.

---

## R-11 — Accessibility: there is no ARIA pattern to conform to

**Finding.** Upstream renders role-less `<div>`s for both parts and registers **zero** keyboard
handlers, no `tabIndex`, no `aria-*`. The WAI-ARIA Authoring Practices define no pattern for a
flow/masonry layout container. The spec's Assumptions already fix this as intentional.

**Decision.** Keep both parts role-neutral. Principle III is discharged by asserting the properties
that *are* meaningful for a layout container:

- **Tab order follows source order** — a focusable control inside item _n_ is reached before one in
  item _n+1_, and virtualization does not reorder it.
- **No key is intercepted** — `keydown` for `ArrowUp/Down/Left/Right`, `Home`, `End`, `Enter`, `Space`,
  `Escape`, `Tab` reaches caller content and the component adds no handler. This is the honest
  key-for-key parity assertion for a component whose upstream key map is empty.
- **RTL** — the root carries the resolved `dir`, and items anchor on `inset-inline-start`.
- **`visibility: hidden`** on the measurement batch removes those items from the a11y tree, so the
  measurement trick never leaks duplicate content to a screen reader. Asserted.

Principle III's "controlled `value` + `onValueChange`" and "`disabled`/`readOnly`" clauses have **no
referent**: `Masonry` exposes no value-bearing prop and no callback (see the Public API section of
`plan.md`). The nearest analogue — explicit `columnCount` overriding the width-derived one — is tested
in its place, and the absence is recorded, not silently skipped.

---

## R-12 — Zero new npm dependencies

Upstream imports `radix-ui` (for `Slot`) and two local helpers. `Slot` → the `child` snippet;
`compose-refs` → `$bindable` ref; `use-isomorphic-layout-effect` → `$effect.pre`. Nothing else is
imported. The port uses only `cn()` from `$lib/utils.js`, `svelte`'s `getContext`/`setContext`, and
`direction-provider`.

**`dependencies: []`** in the registry entry. **`registryDependencies: ["direction-provider"]`**.
No `tailwind-variants` — neither part has variants, so `cn()` alone is correct per Principle VIII.
