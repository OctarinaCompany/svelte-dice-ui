# Phase 0 Research: Banner

**Feature**: `014-port-banner` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Upstream, read at the pinned commit `d9763d82530416dfa4c81c462387b55d06bae4ec`**

| Artifact          | Path                                                                       | Size            |
| ----------------- | -------------------------------------------------------------------------- | --------------- |
| Source            | `.reference/diceui/docs/registry/bases/radix/ui/banner.tsx`                | 705 lines       |
| Documented API    | `.reference/diceui/docs/types/radix/banner.ts`                             | 277 lines       |
| Docs page         | `.reference/diceui/docs/content/docs/components/radix/banner.mdx`          | 225 lines       |
| Demo 1            | `.reference/diceui/docs/registry/bases/radix/examples/banner-demo.tsx`     | 40 lines        |
| Demo 2            | `.reference/diceui/docs/registry/bases/radix/examples/banner-stacked-demo.tsx` | 214 lines   |
| Upstream test     | —                                                                          | **none exists** |

There is no upstream test file for `banner` under `docs/registry/bases/radix/test/`, so the assertion
floor of Principle III comes from the MDX keyboard table, the `DataAttributesTable` blocks, and the
behaviour read directly out of the source.

Every `NEEDS CLARIFICATION` is resolved below and mirrored into the spec's Assumptions section.

---

## R-01 — The controlled/uncontrolled contract, and where Svelte cannot match React

**Decision.** `open` is `$bindable()` with `defaultOpen = true` seeded once via `open ??= defaultOpen`,
exactly the pattern in `CLAUDE.md` §4. `open` is then the **single source of truth** for rendering;
closing writes `open = false` and always calls `onOpenChange?.(false)`. No `isControlled` flag exists
in the port.

**Rationale.** Upstream (`banner.tsx:499-521, 558-566`) keeps `open` in a `useSyncExternalStore` over a
`useLazyRef`, and `onClose` mutates that ref **only when `openProp === undefined`**:

```tsx
const isControlled = openProp !== undefined;
if (isControlled) openRef.current = openProp;          // 507-509
const onClose = () => {
  if (!isControlled) { openRef.current = false; notify(); }   // 559-563
  onOpenChangeRef.current?.(false);                            // 565
};
```

That is React's controlled-component contract: a controlled banner never moves on its own. Svelte's
equivalent is `bind:open`, which requires the child to **write** the prop. Writing to a `$bindable`
prop that the parent passed *without* `bind:` is not a no-op in Svelte 5 — `prop()` falls through to
"prop is written to, but there's no binding, which means we create a derived that we can write to
locally" (`node_modules/svelte/src/internal/client/reactivity/props.js:388-396`), so the local value is
overridden until the parent's expression produces a new value.

Therefore **exactly one** of these two properties is achievable, not both:

| Consumer writes                                            | React                         | Svelte with `$bindable`                  |
| ---------------------------------------------------------- | ----------------------------- | ---------------------------------------- |
| `defaultOpen` only                                         | closes itself, fires callback | closes itself, fires callback ✓ same     |
| `bind:open`                                                | n/a (no such thing)           | closes, parent's value updates, callback |
| `open={x}` **and** `onOpenChange` updates `x`              | closes, callback              | closes, callback ✓ same                  |
| `open={x}` and `onOpenChange` **ignores** the value        | **stays open**, callback      | **closes**, callback ✗ diverges          |

Only the last row diverges, and only for a consumer who supplies `open` and then declines to act on
the change. Choosing React semantics instead would mean never writing the prop, which breaks
`bind:open` — the idiom every other component in this repository and in `bits-ui` uses, and the one the
project explicitly wants Banner to establish for the ports that follow.

**Consequence for the spec.** Acceptance scenario 3 of User Story 1 was written from React's
semantics. It is restated in `spec.md` to describe Svelte's binding semantics, and the divergence is
recorded in Assumptions. Scenario 4 (parent flips `open` to `false` ⇒ hides) and Success Criterion
SC-001 (same visible result and same callback in both modes) are unaffected and are both directly
testable.

**Alternatives considered.**

- _Detect the binding_ by reading `Object.getOwnPropertyDescriptor($props(), 'open')?.set`. Rejected:
  it depends on an internal of the props object, is undocumented, and would be copied into every later
  component as folklore.
- _Never write `open`; sync an internal `$state` from it in an `$effect`._ Rejected: the internal state
  is still the render source, so a local prop write is still authoritative — it does not recover React
  semantics, and it loses `bind:open` on top.
- _Expose `openState` as a second, separate bindable._ Rejected: two ways to say the same thing, and
  no upstream counterpart.

## R-02 — `useSyncExternalStore` + hand-rolled pub/sub → one `$state` class

**Decision.** Upstream's `Store` (`banner.tsx:55-65, 147-244`: `subscribe`/`getState`/`notify` over
`useLazyRef` boxes) collapses into a single `BannersState` class in `banner.svelte.ts` holding
`banners`, `removing` and `heights` as `$state`, plus a **non-reactive** private `#timeouts` map.

**Rationale.** The whole store exists because a React component cannot observe mutation of a
ref-held collection; every mutator therefore clones the container and calls `notify()`. `$state` is
that mechanism. Each field is still **replaced wholesale** rather than mutated (`this.#removing = new
Set(this.#removing)`), which keeps the port line-comparable with upstream and sidesteps needing
`SvelteSet`/`SvelteMap` — no extra import, one signal write per mutation.

`#timeouts` stays a plain field: nothing renders from it, so making it reactive would only add
invalidations.

**Alternatives considered.** `SvelteSet` / `SvelteMap` from `svelte/reactivity` (finer-grained, but
diverges from upstream's clone-and-replace and buys nothing here — the sets are read in full on every
render); a `writable` store (forbidden by Principle I).

## R-03 — `useLazyRef` / `useAsRef` are dropped, not ported

**Decision.** No counterpart file. `useLazyRef` (a box whose initialiser runs once) becomes a class
field or a plain `let`; `useAsRef` (a box that always holds the latest render's callback) becomes
nothing at all.

**Rationale.** Both hooks compensate for React re-invoking a function component on every update. A
Svelte instance script runs once, so `onDismiss` and `onOpenChange` read from `$props()` are already
"the latest" at call time, and a plain `let x = 0` already survives updates. Upstream's
`onDismissRef` / `onOpenChangeRef` (`banner.tsx:504-505`) exist purely to keep those callbacks out of
the registration effect's dependency array — a concept with no Svelte analogue.

**Note.** The MDX's manual-install steps list `use-as-ref`, `use-lazy-ref` and
`use-isomorphic-layout-effect` as files to copy. None of the three appears in this port's
`registry.json` entry, because all three are React plumbing (`useIsomorphicLayoutEffect` → `$effect.pre`).

## R-04 — `Banner` is two components wearing one name

**Decision.** Keep upstream's dual behaviour in a single `banner.svelte`, branching on whether a queue
context is present:

- **No queue** → render `<div role="status" aria-live="polite" data-slot="banner" data-state="open">`
  when `open`, publish per-banner context, render `children`.
- **Inside a queue** → render **nothing**, and instead register `children` (as a snippet) into the
  queue from an `$effect`, removing it on teardown.

**Rationale.** This is upstream verbatim: `if (!open || isInsideStore) return null;`
(`banner.tsx:577`) with the registration effect at `523-556`. The registered banner's content is
rendered later by the internal queued-banner part, which supplies its own per-banner context — which
is why `BannerClose` works identically in both modes without knowing which mode it is in.

The registration effect must not re-enter itself. It reads `open`, `variant`, `priority`,
`dismissible`, `duration` and `children` (so a change re-registers, as upstream's dependency array
does) but performs the `addBanner` / `removeBanner` calls inside `untrack()`, because those write
`banners` — state the effect must not subscribe to.

**Alternatives considered.** Two separate exported components (`Banner` + `QueuedBanner`). Rejected:
it changes the public API, and the stacked demo relies on `Banner`'s parts being usable inside content
that the queue renders.

## R-05 — Queued content is a `Snippet<[BannerRenderProps]>`, not a union

**Decision.** `BannerAddOptions.content: Snippet<[BannerRenderProps]>`, always rendered with the
render-props argument.

**Rationale.** Upstream's `content` is `ReactNode | ((props: BannerRenderProps) => ReactNode)` and is
branched on `typeof banner.content === "function"` (`banner.tsx:462-464`). Svelte has no `ReactNode`;
the only thing that can be stored and rendered later is a snippet — and a snippet *is* the function
form. A zero-parameter snippet is assignable to `Snippet<[BannerRenderProps]>` (TypeScript allows a
function of fewer parameters where more are supplied), so the union collapses to one type with no loss:
static content and render-prop content are written identically and the argument is simply ignored when
unused. `{@render content(renderProps)}` needs no runtime branch.

`BannerRenderProps` keeps upstream's member names — `id`, `variant`, `dismissible`, `onClose`,
`onRemove` — because the MDX documents that payload as a table.

## R-06 — `ReactDOM.createPortal` → the `bits-ui` `Portal` utility

**Decision.** `import { Portal } from 'bits-ui'` and wrap the stack container in
`<Portal to={container}>` for the `fixed` and `absolute` strategies. `container` is typed
`Element | string | null`.

**Rationale.** Principle IV orders bits-ui above bespoke code, and `bits-ui@2.18.1` exports a
standalone `Portal` (`node_modules/bits-ui/dist/bits/utilities/portal/`) whose `to` prop defaults to
`document.body` — exactly upstream's `containerProp ?? globalThis.document?.body ?? null`
(`banner.tsx:250-254`). It is already the mechanism behind `dialog-portal.svelte` and
`sheet-portal.svelte` in this repo, and `bits-ui` is already a dependency, so nothing new is installed.

**Divergence.** bits-ui's `PortalTarget` is `Element | string`. Upstream's is
`Element | DocumentFragment | null`. The port therefore **gains** CSS-selector targets and **loses**
`DocumentFragment` targets. A `DocumentFragment` is not a plausible banner host (it is not in the
document, so a fixed-position child would never paint), which is why this is recorded as an accepted
divergence rather than a reason to hand-roll a portal.

**Alternatives considered.** A bespoke `$effect` that `appendChild`s a detached node to
`container ?? document.body`. Rejected outright by Principle IV: bits-ui's `Portal` already handles
the SSR no-op and teardown.

## R-07 — The stack container is a snippet, not a fourth component file

**Decision.** `banner-queue.svelte` declares the container markup once as a local
`{#snippet stack()}` and renders it in three positions — before `children` (`static`/`sticky` +
`side="top"`), after `children` (`static`/`sticky` + `side="bottom"`), or inside `<Portal>`
(`fixed`/`absolute`).

**Rationale.** Upstream assigns the container JSX to a `bannerContainer` variable and places it in the
same three positions (`banner.tsx:263-304`). A snippet is the direct translation, and it avoids adding
a file for markup that is never independently mountable. The internal stacked-banner part, by
contrast, *is* its own file (`banner-queued.svelte`) because `CLAUDE.md` §3 forbids two components in
one `.svelte` file.

## R-08 — Enter/exit animation: `$state` + `$effect.pre`, timing constants preserved

**Decision.** Reproduce upstream's four-part choreography in `banner-queued.svelte`:

| Upstream                                                       | Here                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `useState(false)` + `requestAnimationFrame` (`373-376`)        | `let mounted = $state(false)` set from an `$effect` with `cancelAnimationFrame` teardown |
| `useLayoutEffect` height measure (`378-382`)                   | `$effect.pre` + `getBoundingClientRect().height`, write wrapped in `untrack()`          |
| removal effect: drop height, `setTimeout(remove, 400)` (`384-392`) | `$effect` returning `clearTimeout`                                                  |
| `offsetBeforeRemoveRef` written during render (`369-371`)      | `frozenOffset = $state(0)` written from an `$effect.pre` while not removing             |

`BANNER_ANIMATION_DURATION = 400` and `cubic-bezier(0.32, 0.72, 0, 1)` are kept as constants, with no
new configuration surface (upstream exposes none).

**Rationale.** The height write must be `untrack`ed because `setHeight` reads `heights` to short-circuit
an unchanged value and then writes it — a read/write of the same signal inside one effect is the
documented infinite-loop shape in `CLAUDE.md` §4. `frozenOffset` cannot be a `$derived`: upstream
deliberately *freezes* the last non-removing offset so the exit transform starts from where the banner
actually was, which is a write, not a projection. Putting that write in `$effect.pre` (rather than
impurely inside a `$derived.by`) keeps the derivation pure and the ordering right: when `removing`
flips true the pre-effect declines to update, so the render that follows reads the frozen value.

**Why not a Svelte transition (`transition:`/`animate:`)?** The exit is not the element leaving the DOM
on a Svelte `{#if}` boundary — the queue keeps the item mounted for 400 ms while the *other* items
re-flow into its slot, and the container animates its own `height` at the same time. A `transition:`
directive cannot coordinate those three, and it would replace an audited upstream algorithm with a
different one, breaking SC-004's "zero visible overlap".

## R-09 — Hooks become typed context getters, and what they are called

**Decision.** Two `Symbol` keys in `banner.svelte.ts`:

| Upstream hook                    | Port                                                                          | Throws                                                       |
| -------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `useBanners()` (`307-320`)       | `getBannersContext(consumerName)` → `BannersState`, plus `hasBannersContext()` | `` `<X>` must be used within `<Banner.Queue>`. ``            |
| `useBanner()` (`102-118`)        | `getBannerContext(consumerName)` → `BannerState`, plus `hasBannerContext()`    | `` `<X>` must be used within `<Banner.Root>`. ``             |

Queue methods are named `addBanner` / `removeBanner` / `clearBanners` (verb-first, matching
`MasonryState.measureContainer` and the `CLAUDE.md` §5 `add`/`removeAt` example) rather than upstream's
`onBannerAdd` / `onBannerRemove` / `onBannersClear`, whose `on*` prefix reads as an event handler on a
class. The mapping is documented in `contracts/public-api.md` §7.

**Rationale.** `hasBannersContext()` is not sugar — `banner.svelte` must read the queue **optionally**
(a standalone `Banner` has no provider and must not throw), which is exactly the distinction upstream
draws between `React.useContext(StoreContext)` (`banner.tsx:496`, nullable) and
`useStoreContext(name)` (`69-75`, throwing).

## R-10 — Per-banner context is a class, not a plain object

**Decision.** `BannerState` in `banner.svelte.ts`, constructed with getter functions
(`getId`, `getVariant`, `getDismissible`, `close`, `remove`) and exposing `id`, `variant`,
`dismissible` as `$derived` plus `close()` / `remove()` methods.

**Rationale.** Upstream's `BannerContextValue` is a `useMemo`'d plain object (`406-409`) that is
rebuilt whenever `variant` or `dismissible` changes. A plain object published on Svelte context is a
**snapshot** — `BannerClose` would keep reading the `dismissible` that was true at mount. Passing
getters into a class is the `CLAUDE.md` §4 rule ("never as snapshots") and is what `ScrollerState` and
`MasonryState` already do.

`remove()` is a no-op for a standalone banner, where upstream's `useBanner()` returns
`onRemove: undefined` (`banner.tsx:107-108`). A method that exists and does nothing beats an optional
method that consumers must null-check, and it keeps `BannerState` non-optional; recorded as a
divergence.

## R-11 — Upstream's palette variants map onto the project's status tokens

**Decision.** `bannerVariants` is a `tv()` in `banner.svelte.ts` with upstream's base classes verbatim
and the five variants remapped:

| Variant       | Upstream (`banner.tsx:326-333`)                                    | Here                                 |
| ------------- | ------------------------------------------------------------------ | ------------------------------------ |
| `default`     | `bg-card text-card-foreground`                                     | `bg-card text-card-foreground`       |
| `info`        | `bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-50`      | `bg-info/10 text-info`               |
| `success`     | `bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-50`  | `bg-success/10 text-success`         |
| `warning`     | `bg-yellow-50 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-50` | `bg-warning/10 text-warning`      |
| `destructive` | `bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-50`          | `bg-destructive/10 text-destructive` |

Base, unchanged: `pointer-events-auto relative flex w-full items-center gap-3 border-b px-4 py-3
text-sm motion-reduce:transition-none`.

**Rationale.** Principle VIII forbids palette colours and manual `dark:`; the `CLAUDE.md` §6 table
prescribes precisely this mapping, and `status`, `timeline` and `stat` already ship it
(`bg-success/10 text-success`, …). The tokens are declared for `:root` and `.dark` in `src/app.css`
(lines 24-29, 65-70) and exposed through `@theme inline` (108-113), so one class per variant replaces
upstream's four. No token needs to be added.

`warning` maps to the `warning` token even though upstream uses `yellow-*` rather than the `orange-*`
that the `CLAUDE.md` table lists — `warning` is the semantic intent, and there is no `yellow` token.

## R-12 — `z-index` here is a stacking algorithm, not overlay chrome

**Decision.** Keep upstream's container classes `pointer-events-none right-0 left-0 isolate z-50` and
the per-item inline `z-index: removing ? 0 : 50 - index`.

**Rationale.** Principle VIII's prohibition is scoped to overlay *components* that own their own
stacking — `.agents/skills/shadcn-svelte/rules/styling.md` enumerates them: Dialog, Sheet, Drawer,
AlertDialog, DropdownMenu, Popover, Tooltip, HoverCard. Banner is not one of them and composes none of
them; it *is* the layer. `isolate` creates the stacking context, and the descending per-item
`z-index` is the mechanism that makes a dismissing banner slide *behind* the one taking its place
(SC-004's "zero visible overlap"). Dropping it would change documented visual behaviour, so this is
recorded as reasoned compliance in the Constitution Check rather than carried into Complexity Tracking.

## R-13 — RTL: native flex mirroring, and what a jsdom test can honestly assert

**Decision.** No `dir` prop, no `direction-provider` dependency, no bespoke mirroring. The tests assert
(a) markup rendered under `dir="rtl"` is byte-identical to `ltr` — i.e. no direction-dependent branch
exists, (b) no part's class list contains a physically-sided utility (`ml-*`, `mr-*`, `pl-*`, `pr-*`,
`left-*`, `right-*`, `text-left`, `text-right`), and (c) DOM order is icon → content → actions → close.

**Rationale.** Upstream never reads direction: the banner row is `flex … gap-3`, which the browser
mirrors natively under `dir="rtl"`. Unlike Masonry — which computes absolute pixel offsets and
therefore needed `inset-inline-start` and a resolved direction — there is nothing here to mirror in
JavaScript, so composing `direction-provider` would add a registry dependency for zero behaviour.

jsdom performs no layout, so "the row is visually mirrored" is not directly observable. The three
assertions above are the observable *causes* of correct mirroring and they fail loudly if a later edit
introduces a physical-side utility or a direction branch. The container's own `right-0 left-0` is
symmetric and stays as upstream wrote it.

## R-14 — Zero new npm dependencies

**Decision.** Nothing is installed. Everything the port needs is already in `package.json`:
`bits-ui@^2.18.1` (Portal), `@lucide/svelte@^1.27.0` (the `X` icon), `tailwind-variants@^3.3.0`
(`tv()`), `clsx`+`tailwind-merge` via `cn()`.

Upstream's own imports resolve as: `radix-ui`'s `Slot` → the `child` snippet (`CLAUDE.md` §10);
`class-variance-authority`'s `cva` → `tv()`; `react-dom` → bits-ui `Portal` (R-06);
`lucide-react` → `@lucide/svelte`; `@/registry/.../button` → `$lib/components/ui/button`.

The `registry.json` entry declares `dependencies: ["tailwind-variants", "@lucide/svelte", "bits-ui"]`
and `registryDependencies: ["button"]`, matching how `scroller` and `timeline` already declare theirs.

## R-15 — Icon sizing: the rules file wins over upstream's inline class

**Decision.** `BannerClose`'s default icon renders as `<XIcon />` with no `class`. Upstream writes
`<X className="size-3.5" />` (`banner.tsx:689`).

**Rationale.** `.agents/skills/shadcn-svelte/rules/icons.md` is explicit and binding: "no sizing
classes on icons inside components". `Button`'s own base already sizes descendant SVGs
(`[&_svg:not([class*='size-'])]:size-4`), so the icon is sized by the component that owns it. Recorded
as a divergence; visually it is 16 px instead of 14 px inside a `size-7` ghost button.

## R-16 — What this component exports for later ports to reuse

**Decision.** No new shared module outside `src/lib/components/ui/banner/`. What the barrel exports for
reuse is: `bannerVariants`, `BANNER_ANIMATION_DURATION`, `BANNER_VARIANTS` / `BANNER_SIDES` /
`BANNER_STRATEGIES` with their union types, `BannersState` / `BannerState` and the six context
functions, and the full type set (`BannerRenderProps`, `BannerAddOptions`, `QueuedBanner`, …).

The controlled/uncontrolled convention is exported as **documentation, not code**:
`contracts/public-api.md` §8 states the four-line idiom, its two rules (seed once; fire the callback in
both modes), and the two tests every later component must copy.

**Rationale.** A `use-controllable.svelte.ts` helper was considered and rejected: it would wrap a
four-line idiom in an indirection, and — because this is a source-distribution registry — every future
component would have to declare it as a `registryDependencies` entry that consumers install just to get
`open ??= defaultOpen`. `bits-ui` does not export such a helper either. Principle IV orders composition
above bespoke code, but there is no primitive here to compose: the idiom *is* `$bindable`.

## R-17 — jsdom cannot measure or animate, so three things need stubbing

**Decision.** Per-suite, restored in `afterEach`:

1. `Element.prototype.getBoundingClientRect` → a stub returning a fixed height, so `heights`, `offset`
   and the resulting `translateY(...)`/container `height` are assertable. Un-stubbed, jsdom reports 0
   and every offset collapses to `0px`, which would let a broken offset calculation pass.
2. `requestAnimationFrame` — the `mounted` flip. Vitest's `vi.useFakeTimers()` fakes rAF, so
   `vi.advanceTimersByTime` + `await tick()` drives mount, the 400 ms exit, and `duration`
   auto-dismiss deterministically.
3. Nothing for the portal: bits-ui `Portal` appends to `document.body`, which jsdom provides, so
   `screen.getBy*` finds portalled banners without a `baseElement` override.

**Rationale.** Same constraint and same remedy as `masonry` (its research R-09). Timer-driven
behaviour (FR-008, FR-009, SC-003, SC-004) is otherwise untestable, and `expect.requireAssertions`
means a test that silently observes nothing is a test that fails.

## R-18 — `onDismiss` fires for queued banners only (upstream behaviour, preserved)

**Decision.** Reproduce it exactly, and document it in the props table.

**Rationale.** Standalone `onClose` calls only `onOpenChangeRef.current?.(false)`
(`banner.tsx:558-566`). `onDismiss` is referenced in exactly one place: the `onDismiss` passed into
`store.onBannerAdd` during queue registration (`532-535`). So a standalone `<Banner onDismiss={…}>`
never fires it. The same applies to `priority` and `duration`, which are only read by the queue —
a standalone banner with `duration={3000}` does **not** auto-dismiss.

This is arguably an upstream defect, but Principle II is non-negotiable and the divergence would be
invisible to a consumer coming from the React library. The port keeps the behaviour, states it in the
props table ("queued banners only"), and pins it with a test so a later refactor cannot change it
silently.
