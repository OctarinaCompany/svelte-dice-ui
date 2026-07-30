# Phase 0 Research: Speed Dial

**Feature**: `016-port-speed-dial` | **Date**: 2026-07-30

**Upstream, read at the pinned commit `d9763d82530416dfa4c81c462387b55d06bae4ec`**

| File                                                                     | Lines | Role                          |
| ------------------------------------------------------------------------ | ----- | ----------------------------- |
| `.reference/diceui/docs/registry/bases/radix/ui/speed-dial.tsx`          | 1053  | implementation                |
| `.reference/diceui/docs/types/radix/speed-dial.ts`                       | 152   | **the documented prop API**   |
| `.reference/diceui/docs/content/docs/components/radix/speed-dial.mdx`    | 319   | contract: data attrs, keys    |
| `.reference/diceui/docs/registry/bases/radix/test/speed-dial.test.tsx`   | 341   | assertion floor               |
| `.reference/diceui/docs/registry/bases/radix/examples/speed-dial-*.tsx`  | 5     | demo sections                 |

Every `NEEDS CLARIFICATION` raised while filling Technical Context is resolved below. Each decision
is mirrored into `spec.md` → Assumptions where it changes the observable contract.

---

## R-01 — `React.Children.map` has no Svelte equivalent; items self-register instead

**Problem.** `SpeedDialContent` (speed-dial.tsx:817-836) counts and iterates its children, wrapping
each in `SpeedDialItemImpl` to hand it a per-index stagger `delay` and the `open` flag. `children` in
Svelte is an opaque `Snippet`; it cannot be counted, indexed or wrapped. `CLAUDE.md` §10 states the
rule outright: *"`React.Children` inspection — not available; model it explicitly with context or an
items array."*

**Decision.** Invert the flow. `SpeedDialItem` registers its own element into a **document-ordered
collection** owned by the root state; the content publishes `animating` on context; each item derives
its own index from the collection and computes its own delay:

```
delay(index) = animating ? index * 50 : (count - index - 1) * 50
```

which is exactly upstream's expression with `index`/`totalChildren` supplied by the registry instead
of by `React.Children`.

**Ordering.** The registry sorts by `Node.compareDocumentPosition`, the same primitive upstream
already uses for its focusable `getNodes()` (speed-dial.tsx:213-229). This survives `{#each}`
reordering and conditional items, which a naïve mount-order counter would not.

**Cost.** The sort is computed **once** in a shared `$derived` that produces a `Map<id, index>`;
each item then does a single `Map.get`. Total O(n log n) per structural change, not O(n) sorts of
O(n log n) each. This is the direct answer to upstream's own `Bug Fixes - O(n²) Performance`
regression test (test:145-176) and to SC-004.

**Alternatives rejected.** (a) An `items` array prop on `Content` — changes the documented
composition, violating Principle II. (b) Mount-order counter — wrong under reordering. (c) A CSS-only
`nth-child` stagger via `--speed-dial-delay: calc(var(--n) * 50ms)` — cannot express the *reverse*
order used on exit without a second rule set per side, and loses the count-dependent unmount timeout.

## R-02 — The `Store` / `useSyncExternalStore` layer is deleted, not ported

Upstream hand-builds a pub/sub store (speed-dial.tsx:65-104, 176-211) purely to avoid re-rendering
every consumer of a React context when `open` flips. Svelte's runes are already fine-grained: a
`$state` field on a shared class notifies exactly the readers that touched it.

**Decision.** One `SpeedDialRootState` class in `speed-dial.svelte.ts`, published on a typed `Symbol`
context (`CLAUDE.md` §5). No `subscribe`/`notify`/`getState`/`setState`, no `useStore` selector. The
spec already records this as an internal-detail divergence; upstream never documented the store as
public API (`docs/types/radix/speed-dial.ts` exposes none of it).

Same disposal for the four React ref helpers upstream imports: `useComposedRefs` → `bind:this` +
`bind:ref`; `useIsomorphicLayoutEffect` → `$effect.pre` where paint order matters, plain `$effect`
otherwise; `useLazyRef` → a class field initialiser; `useAsRef` → nothing at all (a Svelte closure
already reads the current prop). `useMemo`/`useCallback` are dropped per the translation rules.

## R-03 — Mount/unmount lifecycle: `open` drives mounting directly

Upstream's `renderState` (speed-dial.tsx:571-622) is a two-field state machine:

| Transition        | `shouldRender`                                  | `animating`      |
| ----------------- | ----------------------------------------------- | ---------------- |
| open → true       | `true` immediately (in an effect)                | `true` after 1 rAF |
| open → false      | `false` after `(count-1)*50 + 200` ms            | `false` immediately |
| `forceMount`      | always `true`                                   | follows `open`   |

**Decision.** Model it as

```
mounted  = forceMount || open || exiting        // $derived
animating: $state(false)                        // set true in rAF after open
exiting:   $state(false)                        // set true on close, cleared by the timeout
```

`open` participates in `mounted` **directly** rather than through an effect. This matters for tests:
upstream's `renders with side=%s` and `applies correct orientation…` cases (test:285-312) query the
content *synchronously* after `render(<… open …/>)`. In Svelte an `$effect` has not run at that
point, so an effect-driven `shouldRender` would make those ports fail for the wrong reason. Driving
`mounted` from `open` makes the first open render synchronous, which is also strictly better
behaviour.

`exiting` is guarded by a **non-reactive** `#wasOpen` field, so the very first render with
`open === false` does not schedule a phantom 200 ms mount. The rAF and the unmount timer both live in
one `$effect` whose teardown cancels them (`cancelAnimationFrame` / `clearTimeout`), satisfying
`CLAUDE.md` §4 and FR-015.

**SSR.** Upstream additionally gates on a `mounted` flag faked through `useSyncExternalStore`
(speed-dial.tsx:565-569) to avoid a hydration mismatch. Svelte needs no equivalent: `$effect` does
not run during SSR, so with `defaultOpen` the server renders the content already, with
`data-state="closed"`, and the client's first rAF flips it to `open` — a transition, not a mismatch.
No `mounted` flag is ported.

## R-04 — Content position is a pure `$derived`, applied unconditionally

`updatePosition` (speed-dial.tsx:624-660) is a `useCallback` + `useState` + `useIsomorphicLayoutEffect`
trio computing four static CSS declarations from `side` and `offset`. It reads no geometry — there is
no measurement, no collision detection, no anchor observation.

**Decision.** Replace all of it with one `$derived` string. Per side:

| `side`   | declarations                                    |
| -------- | ----------------------------------------------- |
| `top`    | `bottom: calc(100% + {offset}px); right: 0`      |
| `bottom` | `top: calc(100% + {offset}px); right: 0`         |
| `left`   | `right: calc(100% + {offset}px); top: 0`         |
| `right`  | `left: calc(100% + {offset}px); top: 0`          |

**Divergence (an improvement, recorded in Assumptions).** Upstream returns early when `!open`, so a
`forceMount`ed closed content renders *unpositioned* — it participates in flow layout and displaces
the trigger. Ours is always positioned. The gated version is an artifact of the React state dance,
not documented behaviour; the MDX documents `--speed-dial-offset` unconditionally.

**No bits-ui positioner.** `bits-ui`'s floating layer (used by `popover`/`hover-card`) was evaluated
and rejected: it portals to the body, owns `data-side`/`data-align`, applies Floating UI transforms
and collision flipping, and would change `data-side` under collision — all of which contradict
upstream's four fixed offsets and its `--speed-dial-transform-origin` contract. Four CSS declarations
are not a positioner.

## R-05 — Outside dismissal stays bespoke; `bits-ui` has no matching layer

`bits-ui` exposes dismissal only *inside* a primitive (`Popover.Content`'s `onInteractOutside`,
`escapeKeydownBehavior`, …); there is no standalone `DismissableLayer` export to compose here, and
adopting `Popover` wholesale would portal the content, add a focus trap and change the ARIA role away
from `menu`.

**Decision.** Port upstream's listener verbatim (speed-dial.tsx:702-757), because its branching is
observable behaviour:

1. Registration is deferred by `setTimeout(…, 0)` so the very pointerdown that opened the dial cannot
   immediately close it.
2. A root-level **capture-phase** `pointerdown` (speed-dial.tsx:247-261) sets `isPointerInsideTree`
   when the target is inside a *registered node* (trigger or action). Svelte writes this as
   `onpointerdowncapture`.
3. `pointerType === 'touch'` defers dismissal to a one-shot `click` listener; anything else dismisses
   on `pointerdown`.
4. `onInteractOutside` receives a `CustomEvent` with `detail.originalEvent`, `cancelable: true`; a
   `preventDefault()` cancels the close **only when the pointer was genuinely outside the root**.

**Quirk preserved, and tested.** Because step 2 only registers the trigger and the actions, a
pointerdown on the content's own padding (or on a label) leaves `isPointerInsideTree === false`; the
handler then computes `isOutside === false` (the root *does* contain the target), skips
`onInteractOutside`, and closes anyway. That is upstream behaviour; FR-009 is satisfied and the
oddity is pinned by a test so a future refactor cannot silently change it.

The event name constants (`speedDial.actionSelect`, `speedDial.interactOutside`) are kept verbatim —
they are real bubbling DOM events upstream and are therefore observable.

## R-06 — Tab-exit detection: the trigger is the first node

`onKeyDown` (speed-dial.tsx:665-694) closes when `Tab` is pressed while `activeElement` is the
**last** enabled registered node, and when `Shift+Tab` is pressed while it is the **first**. The
registry holds the trigger *and* every action, sorted by document position — and the trigger precedes
the content in the DOM in every documented composition. So:

- `Tab` on the last enabled action → close (focus leaves forward).
- `Shift+Tab` on the **trigger** → close (focus leaves backward).
- `Shift+Tab` on the first action → focus moves to the trigger; the dial stays open until the next
  `Shift+Tab`.

Spec acceptance scenario US2-3 reads *"focus on the first action, `Shift+Tab` → closes"*. Under
upstream that takes one more keypress, because the composite's first focusable is the trigger, not
the first action. **Decision: implement upstream's semantics exactly** (Principle II is
non-negotiable) and read FR-008's "before the first enabled action" as "before the first enabled
node of the composite", which the trigger is. Recorded in Assumptions; the test asserts the two-step
sequence explicitly so the behaviour is documented rather than implied.

Disabled actions are filtered out of the first/last computation (FR-011) but are still skipped
naturally by the browser's own tab order.

## R-07 — `Escape` returns focus to the trigger (docs beat source)

The source only flips `open` to `false` (speed-dial.tsx:666-671). The MDX keyboard table
(speed-dial.mdx:299-318) says: *"Escape — Closes the speed dial and returns focus to the trigger."*
Constitution II names the MDX as the contract, "backed by" the source; Principle III independently
requires focus not to be dropped on `document.body` when the focused element unmounts.

**Decision.** On `Escape`, after `onEscapeKeyDown` has had its chance to `preventDefault()`, close
**and** call `focus()` on the trigger element. Recorded in Assumptions as a documented divergence
from the source (parity with the docs). US1-4 and US2-4 depend on it.

## R-08 — Controlled state: `$bindable` write-through is the only design satisfying FR-002

FR-002 requires both upstream's `open` / `onOpenChange` **and** a Svelte `bind:open`. A strictly
controlled prop (never written, only reported) would make `bind:open` inert, because a Svelte binding
propagates by *assigning to the prop*.

**Decision.** The repo idiom (`banner.svelte:61-86`, `CLAUDE.md` §4): `open = $bindable()`,
`open ??= defaultOpen` seeded once, every mutation goes through one `setOpen(next)` that assigns and
then calls `onOpenChange?.(next)`.

This is **behaviourally identical to upstream**, which also mutates its internal store on click and
only re-syncs when the `open` prop actually changes (speed-dial.tsx:239-243): pass a constant
`open={false}` and React's speed dial opens too. The upstream controlled test (test:82-99) asserts
exactly that shape — `onOpenChange` fires, then a rerender with the new value is authoritative — and
ports one-for-one. Spec US3-4's stricter phrasing is resolved in Assumptions.

## R-09 — Trigger and action compose `$lib/components/ui/button`

Upstream's trigger and action are its own `Button` with `size="icon"` plus
`className="size-11 rounded-full"` / `"size-11 shrink-0 rounded-full bg-accent shadow-md"`.

**Decision.** Compose this repo's `Button` (Principle IV). Two consequences:

- `ButtonProps` here is `WithElementRef<HTMLButtonAttributes> & WithElementRef<HTMLAnchorAttributes>`
  because `Button` renders an `<a>` when `href` is set. Handler props are therefore the *intersection*
  of both DOM signatures; the `banner-close.svelte:31-38` precedent (widen to the shared `MouseEvent`
  supertype through a single cast at the call boundary) is reused rather than inventing a new pattern
  or reaching for `any`.
- Our `size="icon"` is `size-8`; upstream's is `size-9`-ish. Both are overridden by the explicit
  `size-11` that follows, so the rendered size matches upstream exactly.

`role="button"` is written explicitly on the trigger even though it is redundant on a `<button>`,
because upstream does (speed-dial.tsx:435) and the upstream test asserts it (test:128).

## R-10 — Where each upstream context lands

| Upstream                                            | Here                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| `StoreContext` + `SpeedDialContext`                 | one `SpeedDialRootState` on `Symbol('speed-dial')`                     |
| `SpeedDialItemImplContext` (optional, nullable)     | `SpeedDialContentState` on `Symbol('speed-dial-content')` — **optional** |
| `SpeedDialItemContext` (`actionId`, `labelId`)      | `SpeedDialItemState` on `Symbol('speed-dial-item')` — **required**      |

The middle one must stay *optional*: upstream's `useSpeedDialItemImplContext()` deliberately does not
throw (speed-dial.tsx:462-464), so an `Item` rendered outside `Content` still renders with
`delay = 0` and `data-state="closed"`. Only the root and item lookups throw. Error text follows the
repo convention — `` `<SpeedDial.Trigger>` must be used within `<SpeedDial.Root>`. `` — and is
covered by a test per FR-020 and `CLAUDE.md` §7.6.

## R-11 — `asChild` → `child` snippet on all six parts

Every upstream part accepts `asChild` (`CompositionProps` in the types file; `SlotPrimitive.Slot` in
the source). Per `CLAUDE.md` §10 and the `banner`/`marquee` precedent, each part exposes a
`child?: Snippet<[{ props: <Part>ChildProps }]>` whose payload is the fully merged attribute object,
and each exports its `…ChildProps` type from the barrel. When `child` is supplied the part renders
nothing of its own and `ref` stays `null` — identical to the established components.

## R-12 — `z-50` on the content is kept

Constitution VIII forbids manual `z-index` "on overlays (Dialog/Popover/Tooltip/Sheet handle their
own stacking)". Speed Dial has no such primitive: it is a locally-positioned `absolute` sibling that
must paint above the page content next to it, and upstream sets `z-50` (speed-dial.tsx:490). The
repo already has this exact carve-out twice, with an explanatory comment
(`marquee-edge.svelte:18-21`, `scroller-button.svelte:14-17`). The same comment shape is reused. Not
a violation; nothing else in the composition owns the stacking.

## R-13 — Status colours, tokens and the demo palette

Upstream's classes are already semantic (`bg-accent`, `bg-popover`, `text-popover-foreground`,
`shadow-md`) — no palette colour anywhere in `speed-dial.tsx`, and none in the five demos. Nothing
needs remapping, unlike `relative-time-card`. The two `cva` blocks become `tv()` in
`speed-dial.svelte.ts`, exported (Principle VIII); the item block keeps its four compound variants.

## R-14 — Testing strategy under jsdom

- **Fake timers are mandatory** for the hover mode (250 ms open delay, 100 ms close delay) and for
  the exit-unmount window. `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` is required
  or nothing elapses — the `relative-time-card` lesson (R-14 there) applies verbatim.
- **`requestAnimationFrame` is real in jsdom 30** (~16 ms), so `data-state="open"` on the content
  appears one frame after opening. Tests that assert it either `await vi.advanceTimersByTimeAsync(20)`
  under fake timers or `await tick()` + a rAF flush; tests that only need presence assert
  synchronously (R-03).
- **`user.hover` / `user.unhover`** dispatch `mouseover`/`mouseout` *and* `mouseenter`/`mouseleave`
  in `@testing-library/user-event` v14, so the trigger's `onmouseenter`/`onmouseleave` fire.
- **`user.click` dispatches `pointerdown`** before `click`, so the capture-phase guard and the
  document dismissal listener are exercised for free; an outside click is `user.click(outsideEl)`.
- **Touch dismissal** needs `pointerType: 'touch'`, which `user-event` does not emit; that one branch
  is driven with an explicit `PointerEvent` dispatch — the only place `fireEvent`-style dispatch is
  used, and only because `userEvent` cannot express it.
- A `speed-dial.test.svelte` **harness** carries everything a `.ts` spec cannot express: `bind:open`,
  `bind:ref`, the six `child` snippets, a part with no provider ancestor, `{#each}`-driven item sets
  (for the 50-item performance case and for reordering), and sibling focusables before/after the root
  for the Tab-exit assertions. Vitest's `include` is `.{js,ts}`, so the harness is never collected,
  and it is not listed in `registry.json`.

## R-15 — No new npm dependency

| Upstream import                    | Resolution here                                     |
| ---------------------------------- | --------------------------------------------------- |
| `class-variance-authority` (`cva`) | `tailwind-variants` `tv()` — installed              |
| `radix-ui` `Slot`                  | `child` snippet (R-11) — nothing to install         |
| `@/lib/compose-refs`               | `bind:this` + `bind:ref`                            |
| `use-as-ref`, `use-lazy-ref`, `use-isomorphic-layout-effect` | deleted (R-02)             |
| `@/lib/utils` `cn`                 | `$lib/utils.js` `cn`                                |
| `@/registry/.../ui/button`         | `$lib/components/ui/button`                         |
| demo: `lucide-react`               | `@lucide/svelte` — installed                        |
| demo: `sonner`                     | `svelte-sonner` — installed, `<Toaster/>` already mounted in `src/routes/+layout.svelte:16` |

`registry.json` `dependencies` therefore lists only `tailwind-variants` (the component itself imports
`tv()`); `registryDependencies` lists `button`. `bits-ui` is **not** a dependency of this component —
it composes none.

## R-16 — The reusable export: a document-ordered collection

Upstream's `getNodes()` (speed-dial.tsx:213-229) is a local re-implementation of `@diceui/shared`'s
`useCollection`, which `mention`, `combobox`, `tags-input`, `kanban` and `sortable` all use. This port
needs it twice (focusable nodes; item stagger indices), so it is written once as a generic,
rune-based class in its own file and **exported from the barrel** for later ports to reuse:

```ts
// src/lib/components/ui/speed-dial/speed-dial-collection.svelte.ts
export class DomOrderedCollection<TMeta = undefined> { … }
```

Following the `relative-time-format.ts` precedent (015 R-16), a later component that imports it adds
`speed-dial` to its own `registryDependencies` rather than duplicating the file. It is listed in the
speed-dial registry entry like any other source file.

---

## Resolved unknowns → Technical Context

| Unknown                                             | Resolution |
| --------------------------------------------------- | ---------- |
| How to stagger children without `React.Children`     | R-01       |
| Whether to port the external store                   | R-02 (no)  |
| Mount/unmount + animation state machine              | R-03       |
| Whether a bits-ui positioner applies                 | R-04 (no)  |
| Whether a bits-ui dismissable layer applies          | R-05 (no)  |
| Exact Tab-exit semantics vs the spec's phrasing      | R-06       |
| Whether `Escape` restores focus                      | R-07 (yes) |
| Controlled semantics vs `bind:open`                  | R-08       |
| Button composition and its handler typing            | R-09       |
| Context shape, which lookups throw                   | R-10       |
| `asChild` replacement                                | R-11       |
| `z-50` vs Principle VIII                             | R-12       |
| Palette / token remapping                            | R-13 (none needed) |
| jsdom timing, hover, touch, harness                  | R-14       |
| New dependencies                                     | R-15 (none) |
| Which module later ports reuse                       | R-16       |
