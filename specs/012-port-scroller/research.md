# Phase 0 Research: Scroller

Upstream read at the pinned commit `d9763d82530416dfa4c81c462387b55d06bae4ec`:

- `.reference/diceui/docs/registry/bases/radix/ui/scroller.tsx` (387 lines — the whole component)
- `.reference/diceui/docs/content/docs/components/radix/scroller.mdx` (API contract, 4 examples)
- `.reference/diceui/docs/types/radix/scroller.ts` (documented prop table + JSDoc)
- `.reference/diceui/docs/registry/bases/radix/examples/scroller-{,horizontal-,hidden-,navigation-}demo.tsx`
- Confirmed: **no upstream test file exists** for `scroller` (neither `packages/scroller/test/` nor
  `docs/registry/bases/radix/test/`). The MDX prop table plus the source are therefore the contract,
  and the test floor is set by constitution Principle III instead of by a ported spec file.

Local conventions read: `CLAUDE.md`, `.specify/memory/constitution.md`,
`.agents/skills/shadcn-svelte/rules/{styling,composition,forms,icons}.md`, and three already-ported
components — `marquee` (root + state class + `child` snippet + `useDirection`), `badge-overflow`
(`observeResize`, pure-function-first module layout), `direction-provider` (`useDirection`,
`DirectionReader`).

No `NEEDS CLARIFICATION` markers remain in the Technical Context.

---

## R-01 — Where the measured state lives: imperative `setAttribute` → `$derived` attributes

**Decision**: Store one immutable `ScrollMetrics` snapshot in `$state`; derive all six upstream data
attributes from it and spread them onto the element. Never call `setAttribute`.

**Rationale**: Upstream mutates the DOM directly (`container.setAttribute(DATA_TOP_SCROLL, "true")`)
because React has no way to re-render from a scroll event without a state write per frame. Svelte's
`$derived` is pull-based, so a single `metrics` write produces all six attributes with no extra work,
and the attributes stay part of the rendered markup (so `child`-mode consumers and SSR see them too).
This also satisfies the user-supplied rule "never mutate reactive state inside `$effect` where
`$derived` would do": the only `$effect` write is `metrics`, which is genuinely non-derivable (it
comes from DOM events).

**Alternatives considered**: (a) transliterate the `setAttribute` calls inside an `$effect` — loses
SSR output, fights Svelte's attribute diffing, and needs manual removal branches; (b) six separate
`$state` booleans — six writes per scroll event and a stale-combination window between them.

---

## R-02 — The reusable detection module (FR-010): shape and location

**Decision**: `src/lib/components/ui/scroller/scroll-position.svelte.ts`, exported from the scroller
barrel, with a pure core and a thin observation layer:

```ts
readScrollMetrics(el: HTMLElement): ScrollMetrics          // 6 numbers, no side effects
computeAxisOverflow(metrics, axis, { offset, dir }): AxisOverflow   // pure, RTL-aware
observeScrollPosition(el, onChange): () => void            // scroll + resize + content changes
class ScrollPositionState { element; metrics; vertical; horizontal }  // optional runes wrapper
```

**Rationale**: `scroll-spy` needs `readScrollMetrics` + `observeScrollPosition` (it compares section
rects against a container's `scrollTop`); `tour` needs the same metrics to decide whether a target is
in view before scrolling to it. Both need the observation and the metrics, neither needs Scroller's
mask attributes — so the split is pure functions + observation in the shared module, and everything
mask-specific in `scroller.svelte.ts`. Pure-functions-first mirrors `badge-overflow.svelte.ts`, which
is the most heavily unit-tested module in the repo precisely because its core is side-effect free.

Location follows the spec Assumption: it is a module *inside* the scroller folder (listed among the
scroller registry entry's files), not a registry item of its own. Wave-3 ports declare
`registryDependencies: ["scroller"]`.

**Alternatives considered**: (a) a new top-level registry item `scroll-position` — contradicts the
spec Assumption and adds an installable item that renders nothing, which `registry:ui` is not for;
(b) leaving the logic inline in the component — violates FR-010 outright.

---

## R-03 — Faithful reproduction of upstream's asymmetric `offset` handling

**Decision**: Reproduce upstream's four distinct predicates exactly, and assert the asymmetry in
tests rather than "fixing" it.

| Predicate                          | Upstream expression                                   | `offset` applied? |
| ---------------------------------- | ----------------------------------------------------- | ----------------- |
| Leading mask cue (`top`/`left`)    | `scrollStart > offset`                                | yes               |
| Trailing mask cue (`bottom`/`right`) | `scrollStart + clientSize + offset < scrollSize` **and** `scrollSize > clientSize` | yes |
| Leading nav button (`up`/`left`)   | `scrollStart > offset`                                | yes               |
| Trailing nav button (`down`/`right`) | `scrollStart + clientSize < scrollSize`             | **no**            |

**Rationale**: Principle II is non-negotiable and the difference is observable: with `offset={40}` and
30 px of content left below the fold, the bottom mask is gone but the down button is still shown.
The spec's Edge-Cases sentence ("An edge cue (and the corresponding navigation button) only appears
once the remaining hidden content exceeds that offset") describes the leading edge correctly and
over-generalises the trailing one; the plan records this refinement and the tests pin the real
behaviour so a future upstream re-sync can detect a change.

**Alternatives considered**: normalising all four predicates to include `offset` — cleaner, but it is
silent API drift, which the constitution classes as a defect.

---

## R-04 — RTL: normalising `scrollLeft` and mapping start/end back to physical sides

**Decision**: Normalise the horizontal axis to `startDistance = Math.abs(scrollLeft)` and
`endDistance = (scrollWidth - clientWidth) - Math.abs(scrollLeft)`, then map logical start/end onto
the **physical** `left`/`right` attribute names:

```
hasLeft  = isRtl ? hasEnd   : hasStart
hasRight = isRtl ? hasStart : hasEnd
```

**Rationale**: The CSS mask is physical — `data-[left-scroll=true]` fades the left edge — so the
attribute names must stay physical for parity, while *which* logical end they represent has to flip
under RTL. In the CSS-standard RTL model `scrollLeft` runs from `0` at the visual right edge down to
`-(scrollWidth - clientWidth)` at the left, so `Math.abs()` yields the distance already scrolled from
the content's start in both directions, and no browser-model sniffing is needed. Vertical is
unaffected by `dir`.

Button *behaviour* needs no flip: decreasing `scrollLeft` moves the viewport left in both models, so
upstream's `left: scrollLeft -= step` is already direction-agnostic — only visibility flips, and it
flips through exactly the mapping above.

Direction is resolved with `useDirection({ dir: () => dir })` from the ported `direction-provider`
(override → nearest provider → ancestor `[dir]` → `'ltr'`), identical to Marquee and Timeline.

**Alternatives considered**: (a) upstream's raw `scrollLeft > offset` — shows the fade and the button
on the wrong side in RTL, which FR-007 forbids; (b) detecting the legacy positive-RTL scroll model at
runtime — dead code in every browser this project targets.

---

## R-05 — `asChild` → a `child` snippet that keeps working (attachments)

**Decision**: `child?: Snippet<[{ props: ScrollerChildProps }]>`, where the props object contains,
besides the attributes, a Svelte **attachment** created with `createAttachmentKey()` from
`svelte/attachments` (available: svelte 5.56.8 ships `svelte/attachments`, and `{@attach}` is already
used in `timeline.test.svelte`). Spreading `{...props}` onto any element registers that element with
`ScrollerState`, so measurement, the mask attributes and the navigation buttons all keep working.

**Rationale**: Marquee's `child` documents a degradation (ref stays `null`, measurement falls back).
That is acceptable there — a marquee still animates. It is **not** acceptable here, because
`scroller-horizontal-demo.tsx`, one of the four required demos, uses `asChild`: without the element
the mask never appears and the demo would prove nothing (Principle IX). An attachment is the
Svelte-native equivalent of React's `Slot` ref-merging, needs no new dependency, and degrades safely
(if the consumer forgets to spread, nothing is registered and no attribute is applied — the same
outcome as forgetting to spread in React).

**Alternatives considered**: (a) copy Marquee's degradation — breaks the horizontal demo; (b) render
a hidden wrapper and query its first element child — adds an element to the consumer's layout and
guesses at their structure; (c) require an `id` and `getElementById` (bits-ui's older approach) —
works, but the attachment is simpler and needs no id plumbing.

---

## R-06 — Keyboard reachability of the navigation buttons, and `tabindex` on the container

**Decision**:

1. Navigation buttons gain an `aria-label` ("Scroll up"/"down"/"left"/"right"), an `aria-hidden`
   icon, a `focus-visible` ring, and — in `press` mode — Enter/Space `keydown` starts the repeat
   while `keyup`/`blur` stops it; in `hover` mode `focus`/`blur` start/stop it, mirroring
   pointer-enter/leave; `click` mode is already keyboard-operable natively (D-04/D-05).
2. The scroll container does **not** get a forced `tabindex="0"`.

**Rationale for (1)**: upstream sets `onClick: () => {}` for `press` and `hover`, so a keyboard user
activating the button does literally nothing — the control is pointer-only. Principle III ("keyboard
support MUST match upstream key-for-key" plus WAI-ARIA conformance) and SC-004 make that a defect to
fix, not parity to preserve; it is an addition (no upstream behaviour removed).

**Rationale for (2)**: forcing `tabindex="0"` on a `div` with no role or accessible name creates an
unnamed focus stop on every scroller in the page and trips Svelte's `a11y_no_noninteractive_tabindex`
analysis. Modern browsers already make overflow containers keyboard-scrollable, and `restProps`
forwarding means a consumer who wants an explicit focus stop writes
`<Scroller tabindex={0} role="region" aria-label="…">`. The demo page shows that spelling for the
navigation example. Recorded as a documented decision, not a silent omission.

**Alternatives considered**: adding `tabindex`+`role="region"` by default — a nameless region is a
screen-reader regression, and naming it automatically is impossible.

---

## R-07 — Recomputing on content change (SC-003 / spec Edge Case "images loading")

**Decision**: `observeScrollPosition` subscribes to four sources: the element's `scroll` event, a
`ResizeObserver` on the element **and on each element child** (children re-synced by a
`MutationObserver` watching `childList`), and `window`'s `resize` event. Every source funnels into
one `readScrollMetrics` call. The returned teardown disconnects both observers and removes both
listeners.

**Rationale**: Upstream listens only to `scroll` + `window.resize`, so content added after mount or a
late-loading image leaves a stale mask — the spec calls that out as an edge case that must recompute
(FR-002, SC-003). A `ResizeObserver` on the container alone does not help when the container has a
fixed height (the common case), which is why children are observed too; a `MutationObserver` on
`childList` keeps that child set current when content is added or removed. Both APIs are already
shimmed/available in the test environment (`tests/setup.ts` stubs `ResizeObserver`; jsdom implements
`MutationObserver`). SSR-guarded exactly like `observeResize` in `badge-overflow.svelte.ts`.

**Alternatives considered**: (a) upstream's two listeners only — fails the edge case; (b) a
`requestAnimationFrame` polling loop — burns a frame budget forever; (c) `MutationObserver` with
`subtree: true` — fires on every text change deep in the content for no extra coverage over child
resize observation.

---

## R-08 — The auto-scroll repeat: interval ownership and stop-on-exhaustion

**Decision**: The `window.setInterval(…, AUTO_SCROLL_INTERVAL /* 50 */)` handle lives in
`scroller-button.svelte` as a plain (non-reactive) `let`, started by the trigger-mode handlers and
cleared by an `$effect` teardown as well as by the stop handlers.

**Rationale**: Because the button is only rendered while its direction still has hidden content, the
"press-and-hold reaches the end" edge case resolves itself: the button unmounts, its `$effect`
teardown runs, the interval clears. Keeping the handle in the button (rather than in `ScrollerState`)
is what makes that automatic, and it matches upstream, whose `useEffect` cleanup does the same job.
The handle is a plain `let` because nothing renders from it (upstream's `useState` for the timer is
an artefact of needing a stable value across renders).

**Alternatives considered**: hoisting the timer into `ScrollerState` — then unmounting the button no
longer stops it, and the state class would need an explicit "direction exhausted" watcher.

---

## R-09 — Upstream quirk: the horizontal axis is measured even when `orientation="vertical"`

**Decision**: Reproduce it. The vertical measurement block is gated on `orientation === 'vertical'`;
the horizontal block runs unconditionally, so a vertical scroller whose content also overflows
horizontally still gets `data-left-scroll` / `data-right-scroll` / `data-left-right-scroll`.

**Rationale**: It is observable behaviour (a consumer can style on those attributes) and harmless —
`scrollerVariants` only attaches the horizontal mask classes under `orientation="horizontal"`, so the
visual result is unchanged. Principle II says reproduce; a test pins it so the quirk is intentional
and visible rather than accidental.

**Alternatives considered**: gating both axes on the orientation — tidier, undocumented drift.

---

## R-10 — Styling: keeping upstream's arbitrary-value mask classes under the styling rules

**Decision**: Keep upstream's `data-[…]:[mask-image:linear-gradient(…)]` and the
scrollbar-hiding triplet (`[-ms-overflow-style:none] [scrollbar-width:none]
[&::-webkit-scrollbar]:hidden`) verbatim inside `tv()` variants; `--scroll-shadow-size` is written as
an inline custom property from `size`, with any caller `style` appended after it so the caller wins.

**Rationale**: `styling.md` forbids raw *palette colours*, manual `dark:`, `space-*`, and manual
z-index on overlay components. The mask gradients use `#000`/`transparent` as an **alpha mask**, not
as a theme colour — they are luminance stops, invisible to theming, and identical in light and dark.
No semantic token exists for, or belongs in, a mask. The navigation buttons' `z-10` sits inside the
component's own `relative` wrapper and is not one of the overlay components the z-index rule names
(Dialog/Popover/Tooltip/Sheet). Everything that *is* a colour — the chevrons, the focus ring — uses
semantic tokens (`text-muted-foreground`, `ring-ring`).

**Alternatives considered**: moving the gradients into `src/app.css` as utilities — splits the
component across two files for a registry consumer and needs a `css` block in the registry entry for
no benefit, since the classes are self-contained.

---

## Testing environment notes (feed straight into the test tasks)

- **jsdom performs no layout**: `clientHeight`/`scrollHeight`/`scrollWidth` are all `0` and
  `scrollTop`/`scrollLeft` do not persist. Tests therefore (a) unit-test the pure functions
  (`computeAxisOverflow`, the attribute derivation, `readScrollMetrics` against a stubbed element)
  directly, and (b) for component tests, install metrics with `Object.defineProperty` on the rendered
  element and dispatch a `scroll` event. This is the same technique `badge-overflow.test.ts` uses for
  widths.
- **`scrollByStep` assertions**: define `scrollTop`/`scrollLeft` as accessor properties backed by a
  local variable, so a write from the component is observable.
- **The 50 ms repeat**: `vi.useFakeTimers()` + `advanceTimersByTime`, with
  `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` so pointer events and timers agree.
- **`ResizeObserver`** is a no-op stub in `tests/setup.ts`, so observation is asserted through the
  `scroll` event and by calling the exported `observeScrollPosition` teardown directly (as
  `badge-overflow.test.ts` does for `observeResize`).
