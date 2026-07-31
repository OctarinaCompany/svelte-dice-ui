# Phase 0 Research: Scroll Spy

Upstream pin: `sadmann7/diceui@d9763d82530416dfa4c81c462387b55d06bae4ec`, vendored read-only at
`.reference/diceui`. Line references are to
`.reference/diceui/docs/registry/bases/radix/ui/scroll-spy.tsx` unless stated otherwise.

The spec contains **zero** `[NEEDS CLARIFICATION]` markers; the items below are the technical
unknowns the plan had to resolve before the design could be written.

---

## R-01 — Which upstream flavour is the parity source?

**Decision**: use the `radix` flavour (`docs/registry/bases/radix/ui/scroll-spy.tsx` +
`docs/content/docs/components/radix/scroll-spy.mdx`), as named by the port request.

**Rationale**: both flavours ship the component. `diff base/ui/scroll-spy.tsx
radix/ui/scroll-spy.tsx` shows the only differences are the polymorphism mechanism
(`useRender`/`mergeProps` + a `render` prop in `base`, `SlotPrimitive.Slot` + `asChild` in `radix`)
and where the direction hook comes from (`base`'s own `direction.tsx` vs `DirectionPrimitive.useDirection`).
Store, section registry, observer, offset math, class lists and data attributes are byte-identical.
`diff` of the two MDX files shows only front-matter/install-path differences and the same three
examples. Confirms the spec's "Reference variant" assumption.

**Alternatives considered**: porting the `base` flavour (would have made `render` the prop name — but
`CLAUDE.md` §10 already fixes `asChild → child` snippet for this repo, so the choice is cosmetic);
porting both (there is nothing to port twice).

---

## R-02 — How does upstream's `useSyncExternalStore` store translate?

**Decision**: delete it. One `ScrollSpyState` class in `scroll-spy.svelte.ts` holds
`value` as `$state` (backed by the root's `$bindable` prop through getter/setter callbacks), and
`ScrollSpyLink` computes `isActive = $derived(state.value === value)`.

**Rationale**: the store exists solely so that changing `value` re-renders only the two links whose
active state actually flips, instead of the whole subtree (React re-renders top-down). Svelte's
signals give that for free — a link that reads `state.value` subscribes to exactly that signal.
Reproducing `subscribe`/`getState`/`setState`/`notify` would add a second, redundant reactivity
system inside a runes component. This is recorded in the spec's "Store-based reactivity" assumption.

Two upstream store details **are** behaviour and are kept:

- `setState` early-returns on `Object.is(current, next)` — no callback, no notify. Kept as a guard in
  `ScrollSpyState.setValue`, and it is what stops the controlled-`value` effect (R-06) from looping.
- `onValueChange` fires only when the next value is **truthy** (line 143: `if (key === "value" &&
  value)`). Kept verbatim, so seeding/clearing to `''` is silent.

**Alternatives considered**: a Svelte store (forbidden, Principle I); a second context for the hot
value (upstream's split exists only for React render granularity — see plan "Structure Decision").

---

## R-03 — When must the `IntersectionObserver` be re-created?

**Decision**: re-create on any change to `offset`, `rootMargin`, `threshold`, `scrollContainer`
**and on any change to the set of registered sections**. `SectionRegistry` exposes a `$state`
version counter bumped by `register`/`unregister`; the root's `$effect` reads it, so add/remove of a
section re-runs the effect (disconnect → observe the new set).

**Rationale**: upstream's dependency array is `[offset, rootMargin, threshold, scrollContainer]`
(line 285) and its `sectionMapRef` is a plain ref, so a section mounted *after* the first layout
effect is never observed. React hides this for static content because child layout effects run
before the parent's, so all sections are registered in time. Svelte has no such ordering guarantee
between a child's `$effect` and the parent's, and FR-018 explicitly requires the observer to be
"established and torn down cleanly whenever the set of tracked sections changes". Making the effect
depend on registry membership is both required for correctness here and a strict improvement for
conditionally-rendered sections.

Recorded as **divergence D-1** (behaviour-preserving for static content, fixes dynamic content).

**Alternatives considered**: `observer.observe()` on register / `unobserve()` on unregister without
re-creating (leaves the observer's `root`/`rootMargin` correct but splits the lifecycle across two
places and makes the teardown assertion in the tests weaker); a `MutationObserver` on the viewport
(indirect, and cannot see which elements are *registered* rather than merely present).

---

## R-04 — Which flag must stay non-reactive?

**Decision**: `isScrolling` (the 500 ms post-click suppression window), the pending
`requestAnimationFrame` id, the settle-timeout id, and `lastAppliedValue` (R-06) are **plain private
class fields**, not `$state`.

**Rationale**: upstream holds all four in refs precisely so writing them does not re-render. If
`isScrolling` were `$state`, the observer `$effect` (which reads it in its callback) would tear down
and re-create the observer on every click — and writing it from inside that same effect would be the
"write to state you read in the same effect" infinite loop `CLAUDE.md` §4 warns about. `CLAUDE.md`
§10 maps "`useRef` (mutable box, non-reactive)" to exactly this.

---

## R-05 — What does the port reuse from `scroller`, and what must be written?

**Decision**: import `readScrollMetrics` from `$lib/components/ui/scroller/index.js` for the
container branch's `scrollTop` read; write the `getBoundingClientRect()` delta arithmetic and the
`scrollTo({ top, behavior })` calls locally.

**Rationale**: `scroll-position.svelte.ts` documents `readScrollMetrics`/`computeAxisOverflow`/
`observeScrollPosition` as a stability promise to "the wave-3 `scroll-spy` and `tour` ports", and the
barrel re-exports them, so consuming it is the intended path (Principle IV). `computeAxisOverflow`
and `observeScrollPosition` are *not* used: the first answers "how far from each edge is this
container" (scroll-spy asks nothing of the sort), the second reports container metrics on
scroll/resize (scroll-spy is observer-driven and must not run per scroll event). Upstream's two
branches become:

```text
container: top = sectionRect.top - containerRect.top + readScrollMetrics(container).scrollTop - offset
window:    top = sectionRect.top + window.scrollY - offset
```

Registry consequence: `"scroller"` joins `"direction-provider"` in `registryDependencies`.

**Alternatives considered**: `element.scrollIntoView({ behavior, block })` — cannot express the
`offset` prop, and gives no container/window distinction; duplicating the metrics read locally —
rejected by Principle IV and by the spec's "Scroll-position and offset math" assumption.

---

## R-06 — Controlled `value`: how is an *external* change detected?

**Decision**: `value = $bindable()`, seeded once with `value ??= defaultValue ?? ''`. A private
non-reactive `#lastAppliedValue` records the last value the component itself wrote. An `$effect`
reads `value`; when it differs from `#lastAppliedValue` the change came from outside, so the effect
records it and calls `scrollToSection(value)`.

**Rationale**: this is the runes equivalent of upstream's effect at lines 221-232 (`[value,
onScrollToSection]` → first run seeds, later runs scroll). The `Object.is` guard in `setValue`
(R-02) means the scroll's own write of the same string is a no-op, so the effect cannot loop, and no
`untrack()` is needed because the only reactive read is `value` itself.

Testing consequence (from the project memory note *"Non-bound `$bindable` props reset on props
invalidation"*): `rerender()` from `@testing-library/svelte` invalidates props and would wipe
uncontrolled internal state. Therefore the controlled tests drive a parent-owned `$state` inside
`scroll-spy.test.svelte` rather than calling `rerender()`, and the uncontrolled tests never call
`rerender()` at all — which is also the honest translation of upstream's `rerender(<Test value=… />)`
cases.

**Alternatives considered**: a separate internal `$state` mirror plus a sync effect (two sources of
truth, and `bind:value` would stop working); comparing against the previous value captured with
`$derived` (a derived cannot record "who wrote it").

---

## R-07 — Reduced-motion default for `scrollBehavior`

**Decision**: keep `getDefaultScrollBehavior()` verbatim — `typeof window === 'undefined' ?
'smooth' : matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'` — exported
from `scroll-spy.svelte.ts` and used as the prop's default expression, so it is evaluated per
component instance at initialisation (upstream evaluates it per render, but the value is only read
on the first render's default; identical observable behaviour).

**Rationale**: upstream lines 26-31, and FR-010. The repo's `tests/setup.ts` shims `matchMedia` with
`matches: false`, matching upstream's own test mock, so the test default is `'smooth'`; a test that
wants `'auto'` overrides `globalThis.matchMedia` for that case. SSR-safe by the `typeof window`
guard, so the default expression is safe to evaluate during SSR of the demo route.

**Alternatives considered**: a live `MediaQueryList` listener that flips `scrollBehavior` when the OS
setting changes mid-session — upstream does not do this, and Principle II forbids the drift.

---

## R-08 — Keyboard: does `Space` activate a link?

**Decision**: implement nothing keyboard-specific. `Tab` and `Enter` work because the part renders a
real `<a href="#id">`; `Space` scrolls the page, as it does for every anchor in every browser.

**Rationale**: upstream adds no `onKeyDown` anywhere in the file — its MDX keyboard table (`Tab`,
`Enter`, `Space`) describes native anchor behaviour, and it is inaccurate about `Space`: HTML
activation behaviour for `<a>` is triggered by `Enter`, not `Space`. Adding a `Space` handler would
be *added* behaviour (Principle II) and would break the page-scroll affordance the component exists
to complement. The test asserts `Enter` activates and documents that `Space` does not change the
value — mirroring the browser, not the MDX table. In `child` mode the caller may render a
`<button>`, which then gets `Space` from the platform for free.

**Alternatives considered**: an explicit `onkeydown` mapping `Space` → activate (rejected as above).

---

## R-09 — `rootMargin` default and its coupling to `offset`

**Decision**: keep `rootMargin ?? \`${-offset}px 0px -70% 0px\`` (line 238), computed inside the
observer `$effect` so it recomputes when either `rootMargin` or `offset` changes.

**Rationale**: the default shrinks the observation band to the top ~30 % of the tracked area, which
is what makes "topmost intersecting section" mean "the section the reader is looking at" (FR-002,
FR-011). The `-offset` top inset is what compensates for a sticky header, and it is the second place
`offset` is consumed (the first is the scroll destination). Kept verbatim; the test asserts the
computed string reaching the observer for both the default and an explicit override.

---

## R-10 — Driving `IntersectionObserver` in jsdom

**Decision**: jsdom implements no `IntersectionObserver`. Each spec file installs its own stub via
`vi.stubGlobal('IntersectionObserver', …)` that records `(callback, options)` and its
`observe`/`unobserve`/`disconnect` calls and exposes a helper to invoke the callback with synthetic
entries; `vi.unstubAllGlobals()` runs in `afterEach`. `window.scrollTo` and
`HTMLElement.prototype.scrollTo` are `vi.fn()`-mocked per test (jsdom throws "not implemented").
`tests/setup.ts` is **not** modified.

**Rationale**: upstream's own test file stubs the observer the same way (`MockIntersectionObserver`,
lines 13-23) but never fires the callback, so its intersection behaviour is untested. Recording the
callback lets this port assert SC-001 directly — topmost-of-several, empty set, unregistered id, and
suppression during the settle window — which upstream cannot. Keeping the stub local avoids giving
every other component's suite a global `IntersectionObserver` that never fires, which could mask a
future component's missing shim.

`requestAnimationFrame` exists in jsdom, so the observer callback's rAF coalescing is exercised for
real; tests `await waitFor(…)` (or `vi.advanceTimersByTime` under fake timers) rather than assuming
synchronous activation.

**Alternatives considered**: adding the stub to `tests/setup.ts` (broader blast radius, and each
spec still needs the per-test entry-driving handle); `happy-dom` (config change — forbidden).

---

## Divergence register (Principle II)

Each of these is an intentional, documented difference from upstream. D-2…D-5 restate spec
Assumptions in implementation terms; D-1 and D-6 are new and are added here.

| #   | Upstream                                              | Here                                                                      | Why                                                                                        |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| D-1 | Observer deps exclude the section map (line 285)       | Registry membership is a dependency (`SectionRegistry` version counter)   | Svelte has no child-before-parent effect ordering; FR-018 requires re-establishment (R-03). |
| D-2 | `asChild` + `Slot` on all five parts                   | `child` snippet on all five parts                                        | No Svelte `Slot` equivalent; `CLAUDE.md` §10, spec Assumption "`asChild` polymorphism".      |
| D-3 | `useSyncExternalStore` store + second context          | One `ScrollSpyState` on one `Symbol` key                                  | Signals give per-link granularity for free (R-02).                                          |
| D-4 | `DirectionPrimitive.useDirection(dirProp)`             | `useDirection({ dir, element })` from `direction-provider`               | Composition over reimplementation; same override → provider → DOM → `ltr` chain.             |
| D-5 | Inline container/window `scrollTop` read               | `readScrollMetrics()` from `scroller`                                     | Principle IV + `scroll-position.svelte.ts`'s documented stability promise (R-05).            |
| D-6 | Observer + topmost-entry selection inlined in the root | Extracted to `section-observer.svelte.ts`, exported from the barrel       | `tour` must import it instead of re-deriving it (spec Assumption "Visibility tracking").     |

## Resolved: none outstanding

No `NEEDS CLARIFICATION` remains. Phase 1 may proceed.
