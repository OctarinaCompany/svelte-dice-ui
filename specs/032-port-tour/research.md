# Phase 0 Research: Tour

**Feature**: `032-port-tour` | **Date**: 2026-07-31

Upstream read at the pinned commit `d9763d82530416dfa4c81c462387b55d06bae4ec`:

- `.reference/diceui/docs/registry/bases/radix/ui/tour.tsx` (1701 lines) — the implementation
- `.reference/diceui/docs/content/docs/components/radix/tour.mdx` (359 lines) — the API contract
- `.reference/diceui/docs/registry/bases/radix/examples/tour-demo.tsx`
- `.reference/diceui/docs/registry/bases/radix/examples/tour-controlled-demo.tsx`

There is **no upstream test file** for `tour` (neither `packages/tour/test/` nor
`docs/registry/bases/radix/test/tour.test.tsx` exist). The assertion floor is therefore the MDX
keyboard table plus the behaviour read directly out of the source; §7 of `CLAUDE.md` governs the
rest.

---

## R-01 — Which primitive owns floating placement, focus trap, escape and outside-dismiss?

**Decision**: `TourStep` composes **`bits-ui`'s `Popover.Root` + `Popover.Content`**, with
`customAnchor` pointing at the step's resolved target element. `TourArrow` composes
`bits-ui`'s `Popover.Arrow`.

**Rationale**: upstream hand-rolls four separate concerns that `Popover.Content` already exposes as
props, prop-for-prop:

| Upstream (`tour.tsx`)                                    | `bits-ui` `Popover.Content` prop                         |
| -------------------------------------------------------- | -------------------------------------------------------- |
| `useFloating` + `offset`/`flip`/`shift`/`limitShift`     | `side`, `sideOffset`, `align`, `alignOffset`, `sticky`   |
| `avoidCollisions && flip/shift`, `detectOverflowOptions` | `avoidCollisions`, `collisionBoundary`, `collisionPadding` |
| `hide({ strategy: "referenceHidden" })`                  | `hideWhenDetached`                                       |
| `arrow({ element, padding })`                            | `arrowPadding` + `Popover.Arrow`                         |
| `strategy: "fixed"`, `whileElementsMounted: autoUpdate`  | `strategy="fixed"`, `updatePositionStrategy`             |
| `useFocusTrap` + `useFocusGuards` (lines 89–281)         | `trapFocus` (default `true`) + internal focus scope       |
| `OPEN_AUTO_FOCUS` / `CLOSE_AUTO_FOCUS` custom events     | `onOpenAutoFocus` / `onCloseAutoFocus` (preventable)      |
| root `keydown` → Escape (lines 719–732)                  | `onEscapeKeydown` / `escapeKeydownBehavior`               |
| `pointerdown`-outside layer (lines 1072–1115)            | `onInteractOutside` / `interactOutsideBehavior`           |
| `focusin`-outside layer (lines 1117–1155)                | `onFocusOutside`                                         |
| `getSideAndAlignFromPlacement` → `data-side`/`data-align` | emitted natively (`use-floating-layer.svelte.js:155-156`) |

Verified in `node_modules/bits-ui/dist`: `bits/utilities/floating-layer/types.d.ts` (all placement
props incl. `customAnchor: string | HTMLElement | Measurable | null`),
`bits/utilities/focus-scope/types.d.ts`, `bits/utilities/escape-layer/types.d.ts`,
`bits/utilities/dismissible-layer/types.d.ts`, and `bits/popover/popover.svelte.js:287-313`
(`onInteractOutside` and `onEscapeKeydown` both honour `event.defaultPrevented` before closing —
which is exactly upstream's `preventDefault()` contract).

`Popover.Content` renders without a `Popover.Trigger`: `use-floating-layer.svelte.js:29-38` prefers
`customAnchorNode` over `triggerNode`, and `shouldRender` derives from presence, not from a trigger
(`popover.svelte.js:315-317`). `Popover.Arrow` renders `span > svg[viewBox="0 0 30 10"] > polygon`
with `width=10 height=5` defaults — byte-identical in shape and defaults to upstream's `TourArrow`.

**Alternatives considered**: (a) porting upstream's floating-ui middleware chain directly — rejected,
`@floating-ui/dom` is not a project dependency and Principle IV forbids re-implementing what a
primitive covers; (b) composing this repo's `$lib/components/ui/popover` wrapper — rejected, that
wrapper hard-codes `sideOffset`, its own class string, and an always-on portal, none of which Tour
wants; composing the `bits-ui` primitive directly is the same pattern `popover-content.svelte` itself
uses.

---

## R-02 — What stays bespoke, and why

Three behaviours have no primitive and are written by hand. Each is small, upstream-identical, and
justified below (Principle IV requires the primitive to be named).

1. **Spotlight geometry** (`updateMask`, upstream lines 412–429). Computes a `clip-path: polygon(…)`
   cut-out plus an `{x, y, width, height}` rect from the target's `getBoundingClientRect()` and the
   viewport. Primitive evaluated: none — `bits-ui` has `Dialog.Overlay`/`Popover.Overlay`, which are
   plain full-screen backdrops with no cut-out and no target tracking. Ported as a **pure function**
   `computeSpotlight(rect, padding, viewport)` so the arithmetic is unit-testable in jsdom, where no
   real layout runs (SC-003).

2. **Target-rect tracking** (upstream lines 1038–1070): `resize` + passive `scroll` listeners,
   coalesced through one `requestAnimationFrame`. Primitive evaluated: `bits-ui`'s floating layer
   auto-update — it tracks the *floating* element's position, not an arbitrary third element's rect,
   and exposes nothing. Also evaluated: `observeSections` from `scroll-spy` — see R-06, rejected.

3. **Root-level scroll lock** (`useScrollLock`, upstream lines 502–520). Primitive evaluated:
   `Popover.Content`'s `preventScroll`. Rejected because upstream scopes the lock to
   `open && modal` on the **root**, so it holds even on a step whose target is missing and no content
   is mounted (Edge Case: "target does not exist"). `preventScroll` is tied to content presence, and
   enabling both would make two owners fight over restoring `document.body.style.overflow`. The
   hand-written version is 10 lines with an exact teardown, and `preventScroll` is left `false`.

Everything else — placement, collisions, arrow, focus trap, focus restore, escape, outside-dismiss,
portal — is composed.

---

## R-03 — The store → runes translation

**Decision**: one `TourRootState` class in `tour.svelte.ts` holding `steps`, `maskPath` and
`spotlightRect` as `$state`, and reading `open`/`value` back out of the root's `$bindable` props
through getter functions. Upstream's `Store` / `useSyncExternalStore` / `useStore(selector)` triple
is **not** reproduced structurally.

**Rationale**: that machinery exists solely so a part re-renders only for its own slice of state.
Svelte signals give that for free — a part that reads `state.value` subscribes to exactly that
signal. Recorded in the spec's Assumptions ("Store-based reactivity"). The *observable* consequences
of `store.setState` — the ordering of `onStepLeave` → `onStepEnter` → `onComplete` → close, the
`Object.is` no-op guard, the controlled early-return — are reproduced literally in
`TourRootState.setOpen` / `setValue`, because those are behaviour, not plumbing.

**Alternatives considered**: mirroring `open`/`value` into private `$state` fields and syncing from
props in an `$effect` — rejected; it re-introduces the React sync-effect round trip, and writing a
`$state` from an effect that reads props is the loop the memory note
"SvelteMap writes in `$effect` self-invalidate" warns about. The repo-wide pattern
(`stepper.svelte`, `scroll-spy.svelte`) is `value ??= defaultValue` plus a `setValue` that assigns
and notifies; Tour follows it.

---

## R-04 — Detecting "controlled" without React's `valueProp !== undefined`

**Decision**: capture `const isValueControlled = value !== undefined` (and the same for `open`)
**before** the `value ??= defaultValue` seed line, and pass both into the state class as constants.

**Rationale**: upstream branches on it twice and the branches are observably different:
`setState("value", …)` returns early after `onValueChange` when controlled (lines 661–664), which
means **auto-scroll does not run in controlled mode**, and on completion it fires `onValueChange`
with the out-of-range index only when controlled (lines 653–655). Dropping the distinction would
change behaviour, so it must be reproduced. Svelte destructuring makes the pre-seed read exact:
an omitted prop is `undefined`, a passed one is not.

---

## R-05 — Escape, `dismissible`, and an upstream inconsistency

**Decision**: implement Escape on the **root** as a `document` `keydown` listener (upstream lines
719–732), set `escapeKeydownBehavior="ignore"` on `Popover.Content` so the layer does not also
close, and **gate the close on `dismissible`**.

**Rationale**: the root-level listener is required for parity — upstream's Escape works while the
tour is open even when no step content is mounted, which a content-scoped escape layer cannot do.
The `dismissible` gate is a **deliberate divergence**: upstream's Escape path (line 726) omits the
`context.dismissible` check that its own outside-interaction path applies (line 1098), so a tour
declared `dismissible={false}` still closes on Escape. Spec FR-013 and User Story 4 acceptance
scenario 3 require the check, and a non-dismissible tour that Escape dismisses anyway is incoherent.
Recorded in the spec's Assumptions.

`onEscapeKeyDown` still receives the `KeyboardEvent` first and `preventDefault()` still suppresses
the close, so the documented contract is unchanged for the default `dismissible={true}` tour.

---

## R-06 — The `scroll-spy` observer module and the `scroller` metrics are **not** reused

**Decision**: reject both reuses that the spec's Assumptions anticipated, and write neither
`IntersectionObserver` nor container-scroll arithmetic.

**Rationale** (this is a correction to the spec, not a shortcut — the spec's assumption was written
before `tour.tsx` was read line by line):

- **`observeSections` / `pickTopmostEntry`** were earmarked for `hideWhenDetached`. But upstream does
  not use an `IntersectionObserver` for it: it uses floating-ui's `hide({ strategy: "referenceHidden" })`
  middleware (lines 987–991), which `bits-ui` exposes directly as the `hideWhenDetached` prop.
  Substituting an observer would be bespoke code replacing a primitive (Principle IV) *and* a
  divergence from upstream (Principle II) — worse on both counts. The module stays exported and
  unused by Tour; nothing about it changes.
- **`readScrollMetrics`** reads `scrollTop/clientHeight/scrollHeight` off an `HTMLElement` container.
  Upstream's `onScrollToElement` (lines 367–398) measures `getBoundingClientRect()` against
  `window.innerWidth/innerHeight` and calls `window.scrollTo` — there is no container and no metric
  in common. Reusing it would mean adapting the window to an element-shaped API for no gain, plus a
  `registryDependencies: ["scroller"]` edge on every Tour install.
- **`getDefaultScrollBehavior`** is exported by `scroll-spy`, and Tour needs a byte-identical copy
  (upstream lines 360–365 duplicate `scroll-spy.tsx` lines 26–31 verbatim — upstream itself
  duplicates it per component). Tour defines its own three-line copy rather than adding
  `registryDependencies: ["scroll-spy"]`, which would drag an unrelated five-part component into
  every Tour install for one media-query read.

**Net effect on the spec**: `registryDependencies` for `tour` is `["button", "direction-provider"]`,
not `["scroll-spy", "scroller"]`. The reduced-motion behaviour required by FR-016 is unchanged.

---

## R-07 — Fidelity of the callback event objects

**Decision**: reproduce upstream's `CustomEvent` wrappers exactly, and bridge their
`defaultPrevented` back onto the `bits-ui` event.

**Rationale**: `onPointerDownOutside`, `onInteractOutside`, `onOpenAutoFocus` and `onCloseAutoFocus`
are documented as receiving `CustomEvent`s whose `preventDefault()` suppresses the default action.
`bits-ui` hands over a native `PointerEvent`/`FocusEvent`/`Event` instead. Constructing
`new CustomEvent('tour.pointerDownOutside', { bubbles: false, cancelable: true, detail: { originalEvent } })`,
invoking the caller's handler, then calling `event.preventDefault()` on the `bits-ui` event when the
custom one was prevented, keeps the published type signature and the published semantics with ~6
lines per handler. Upstream constructs these events and calls the handler directly too (lines
1082–1093) — it only *dispatches* the auto-focus pair, which the focus scope now owns.

Two mapping notes, recorded in the spec's Assumptions:

- `bits-ui` fires `onInteractOutside` on **pointerup**; upstream fires `onPointerDownOutside` on
  **pointerdown**. Both callbacks still fire, in upstream's order (`onPointerDownOutside` then
  `onInteractOutside`), one interaction later.
- A `focusin` outside the step maps to `bits-ui`'s `onFocusOutside`, which fires only
  `onInteractOutside` — matching upstream lines 1137–1142, which likewise skips
  `onPointerDownOutside` for focus events.

---

## R-08 — Interaction with the spotlighted target must not dismiss the tour

**Decision**: in the step's `onInteractOutside` / `onFocusOutside` handlers, call
`event.preventDefault()` when `event.target` is contained by the resolved target element.

**Rationale**: upstream marks pointer/focus activity on the target as "inside" via capture listeners
on the target element (lines 1181–1213) and via `isFocusInTarget` (line 1129), so clicking the
highlighted element never closes the tour. `bits-ui`'s dismissible layer only knows about the content
node, so without this the spotlighted element would dismiss the tour on click — a visible regression.
`defaultPrevented` is honoured (`popover.svelte.js:287-290`), so the bridge is exact.

---

## R-09 — Step registration order

**Decision**: each `Tour.Step` registers itself with the root in an `$effect` on mount and
unregisters in the teardown; the registration order is the step's index, exactly as upstream's
`store.addStep` assigns `index = steps.length`.

**Rationale**: upstream's order is mount order, not DOM order, and sibling steps mount in document
order in both frameworks. Removal must renumber the ids of later steps (upstream lines 695–712) so a
step unmounting mid-tour does not corrupt the indices — Edge Case "a step is unmounted while it is
the active step". Storage is a plain non-reactive array of records plus a `$state` version counter,
following `SectionRegistry`: a reactive map would make the registering effect a dependent of the
signal it writes (memory: "SvelteMap writes in `$effect` self-invalidate"). The bump assigns from a
plain counter (`this.#version = ++this.#changes`) rather than read-modify-writing the signal.

---

## R-10 — Test strategy under jsdom

**Decision**: assert everything observable through the DOM; cover the geometry and scroll arithmetic
through the exported pure functions and stubbed rects rather than through real layout.

**Rationale**: jsdom performs no layout — `getBoundingClientRect()` is all zeros and
`window.scrollTo` is a stub. Concretely:

- `computeSpotlight()` and `isTargetInViewport()`/`scrollTargetIntoView()` are exported from
  `tour.svelte.ts` and tested directly with synthetic rects and a stubbed `window.scrollTo`
  (`vi.fn()`), covering FR-016/FR-017/FR-018 arithmetic and the reduced-motion branch via a
  `matchMedia` stub.
- Placement (`data-side`, `data-align`) is asserted as *wiring* — that the step's props reach the
  floating layer — not as pixel outcomes.
- `tests/setup.ts` already shims `ResizeObserver`, `matchMedia`, pointer capture and
  `scrollIntoView`; `Element.prototype.getBoundingClientRect` is stubbed per-test where geometry
  matters and restored in teardown.
- Focus-trap assertions use `userEvent.tab()` against real buttons inside the step, which jsdom does
  support.

A `tour.test.svelte` harness component (the repo pattern from `stepper.test.svelte` /
`scroll-spy.test.svelte`) hosts the compound tree, since `render()` cannot express nested snippets
directly.
