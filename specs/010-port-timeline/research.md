# Phase 0 Research: Timeline

Sources read at the pinned upstream commit `d9763d82530416dfa4c81c462387b55d06bae4ec`:

- `.reference/diceui/docs/registry/bases/radix/ui/timeline.tsx` (712 lines — the implementation)
- `.reference/diceui/docs/content/docs/components/radix/timeline.mdx` (the API contract)
- `.reference/diceui/docs/registry/bases/radix/examples/timeline-{,horizontal-,rtl-,alternate-,horizontal-alternate-,custom-dot-}demo.tsx` (six demos)
- No upstream test file exists for `timeline` (searched `.reference/diceui` for `*timeline*` under any
  `test` path — zero hits). The assertion floor is therefore the MDX's documented roles, data
  attributes and CSS variables, plus this repo's Principle III minimum.
- In-repo conventions: `src/lib/components/ui/{direction-provider,badge-overflow,stat,gauge,status}/**`,
  `CLAUDE.md`, `.specify/memory/constitution.md`, `.agents/skills/shadcn-svelte/rules/*.md`.

The spec contained no `[NEEDS CLARIFICATION]` markers. The open questions below are the technical
translation decisions the plan depends on.

---

## R-01 — `radix-ui`'s `Direction.useDirection` → in-repo `useDirection()`

**Decision**: import `useDirection` from `$lib/components/ui/direction-provider/index.js` and call it
during the root's initialisation as `useDirection({ dir: () => dir })`, reading `reader.current`
wherever upstream reads its resolved `dir`. Declare `registryDependencies: ["direction-provider"]`.

**Rationale**: upstream's contract is "explicit `dir` prop wins, otherwise inherit from the nearest
`<DirectionProvider>`". `DirectionReader` implements exactly that plus a DOM `[dir]` fallback and a
final `'ltr'` default, is already shipped, already tested, and never throws without a provider.
Constitution Principle IV step 1 (compose an existing `src/lib/components/ui/*` component) applies
directly. Timeline is the first consumer, which is precisely why the module was ported first.

**Alternatives considered**: (a) a bare `dir = 'ltr'` prop with no ambient resolution — drops
upstream's provider inheritance, a Principle II parity break; (b) re-deriving direction from
`getComputedStyle(el).direction` inside the root — bespoke DOM work duplicating an audited in-repo
module, rejected under Principle IV; (c) a `bits-ui` direction primitive — bits-ui exposes `dir` only
as a per-component prop, with no shared reader, so there is nothing to compose.

**Registry note**: `registryDependencies` uses the bare item name, matching the existing `stat` →
`["separator"]` precedent in `registry.json`. Consumers install both items from the same
`<registry-url>/r/<name>.json` base documented on `/docs`.

---

## R-02 — `useSyncExternalStore` + `Map<string, RefObject>` → one `TimelineState` class

**Decision**: replace upstream's hand-rolled pub/sub store with a single `TimelineState` class in
`timeline.svelte.ts` that also carries `orientation`/`variant`/`dir`/`activeIndex` — i.e. upstream's
`StoreContext` and `TimelineContext` merge into one context object. Registered items live in a
`$state`-tracked array of `{ id, element }`; `orderedIds` is a `$derived.by` that sorts that array
with `compareDocumentPosition` and maps to ids; `getItemIndex(id)` and `getNextItemStatus(id)` read
`orderedIds`.

**Rationale**: `useSyncExternalStore` exists in React only to make an external mutable `Map`
subscribable; Svelte's `$state`/`$derived` give that for free, so the store's `subscribe`/`notify`/
`getSnapshot` triple has no Svelte counterpart and porting it would be transliteration, not
translation. Merging the two contexts is safe because every consumer of the collection
(`TimelineItem`, `TimelineConnector`) also consumes `orientation`/`variant`/`activeIndex`, both are
root-owned and created together, and the merge changes no prop, attribute or error message. One
`$derived.by` sort is shared by all items, so the port is O(n log n) per item-set change instead of
upstream's O(n log n) per item per notify.

**Alternatives considered**: (a) a faithful `subscribe`/`notify` port — more code, no behaviour gain,
and it fights Svelte's scheduler; (b) two separate contexts mirroring upstream — extra plumbing with
no consumer that needs only one; (c) prop-drilling an explicit `index` onto each item — breaks FR-006
(live DOM order) and the upstream API.

**Known limitation carried over verbatim**: `orderedIds` recomputes when the registered **set**
changes (mount/unmount), not when already-mounted siblings are reordered in place without
remounting. Upstream has exactly the same behaviour — its store only notifies from
`onItemRegister`/`onItemUnregister`. Keyed `{#each}` reordering in Svelte moves DOM nodes without
remounting, so this is the one scenario where a stale index could survive; it is upstream parity and
is documented, not silently fixed. (Sorting on every read would require reading the DOM inside a
`$derived`, which is not reactive to DOM mutation either — the honest fix is an upstream-level API
change, out of scope.)

---

## R-03 — `useIsomorphicLayoutEffect` registration → plain `$effect`

**Decision**: register in a plain `$effect` inside `timeline-item.svelte`, keyed off the item's own
bound element, returning `() => state.unregister(id)`.

**Rationale**: upstream needs a layout effect only so the node exists in the DOM before
`compareDocumentPosition` reads it. A Svelte `$effect` runs after its own component's elements are
attached, which is the same guarantee. `$effect.pre` is wrong here — it runs *before* the element is
attached, so the registered element would be `null`. On the server no effect runs, so SSR emits
`data-status="pending"` for every item and hydration fills in the real statuses — acceptable because
status is a purely visual/ARIA enhancement and upstream's first client render behaves identically
(its store is empty on the first pass too).

**Alternatives considered**: `$effect.pre` (element not yet bound); registering synchronously during
init (no element yet); `onMount` (a Svelte-4-flavoured escape hatch that Principle I discourages and
that would not re-run if the element identity changed).

---

## R-04 — `React.useId()` → `$props.id()`

**Decision**: `const uid = $props.id(); const itemId = $derived(id ?? uid);` and render
`id={itemId}`, matching upstream's `id ?? instanceId` and its use of the same value as the collection
key.

**Rationale**: `$props.id()` is the documented Svelte 5 equivalent (CLAUDE.md §10) and is
SSR/hydration stable. Upstream puts the resolved id on the DOM element, so a consumer-supplied `id`
must win — the `??` order preserves that.

**Alternatives considered**: `crypto.randomUUID()` (hydration-unstable), an incrementing module
counter (leaks across SSR requests).

---

## R-05 — `asChild` + Radix `Slot` → the `child` snippet

**Decision**: every part destructures `child?: Snippet<[{ props: <Part>ChildProps }]>`, builds one
`$derived` attribute object `partAttrs` (data attributes, ARIA, `id`/`dir` where applicable, then
`...restProps`, then `class: cn(variants(...), className)` last), and renders either
`{@render child({ props: partAttrs })}` or the default element spread with the same object.

**Rationale**: this is the repo's established `asChild` replacement (`gauge.svelte`,
`badge-overflow.svelte`, `dialog-content.svelte`) and the one CLAUDE.md §10 mandates. Sharing a
single `$derived` object between both branches guarantees a `child` element receives byte-identical
attributes — FR-016's "preserving that part's data attributes and behaviour on whatever element is
rendered".

**Consequences documented on each prop**: in `child` mode `ref` stays `null` and `children` is not
rendered (the caller owns its own content), matching `gauge.svelte`'s wording. The connector's
`forceMount` early-return happens **before** the `child` branch, so `child` is not invoked for a
last-item connector — upstream returns `null` before choosing its primitive too.

---

## R-06 — `cva` → `tv()`, five blocks

**Decision**: one exported `tv({ base, variants, compoundVariants, defaultVariants })` per styled
part (root, item, content, dot, connector), declared in that part's `<script lang="ts" module>`, and
applied as `class={cn(xVariants({ ... }), className)}`. Header/Title/Description/Time have a single
static class string and use `cn('…', className)` directly, exactly as upstream uses `cn` for them.

**Rationale**: `tailwind-variants` accepts cva's `variants`/`compoundVariants`/`defaultVariants`
shape verbatim, so all 22 upstream compound-variant rows port 1:1. Principle VIII requires `tv()` in
the module script and exported; `status`/`stat-trend` set the in-repo precedent for
`cn(xVariants(...), className)` — which also satisfies "caller class merged last" more explicitly
than cva's `className` passthrough did.

**Alternatives considered**: `tv()` with `slots` for the whole component — one object for nine parts
would force every part to import the root's module and would not map cleanly onto per-part
`compoundVariants`; hand-written `cn()` ternaries — rejected by Principle VIII and the styling rule
"Use cn() for conditional classes" (no manual ternary trees in `class`).

---

## R-07 — `<div role="list">` → `<ol>` / `<li>`, keeping the explicit roles

**Decision**: the root renders `<ol role="list" aria-orientation=…>` and the item renders
`<li role="listitem">`, with `list-none` added to the root's base classes.

**Rationale**: the feature guidance requires real list semantics so position and count are announced
(SC-001, FR-001). Native `<ol>`/`<li>` deliver that; `<div role="list">` relies entirely on the
author-supplied role. Keeping the **explicit** roles alongside the native elements is deliberate and
serves three purposes: (1) upstream parity — the MDX documents `role="list"`/`role="listitem"` as
part of the contract; (2) it defends against the well-known Safari/VoiceOver behaviour where
`list-style: none` (which Tailwind's preflight applies to every `ol`) strips list semantics; (3) in
`child` mode a caller rendering a `<div>` still gets correct semantics. `list-none` is explicit rather
than relying on preflight so the component looks right in a consumer project regardless of CSS reset
ordering.

`aria-orientation` on a `list` is not in the ARIA spec's list of supported attributes for that role,
but upstream ships it and the MDX documents it; Principle II (no undocumented drift) outranks the
lint-level concern, and a stray `aria-orientation` is inert rather than harmful. Kept verbatim.

**Alternatives considered**: `<div role="list">` verbatim (weaker semantics, contradicts the explicit
component guidance); `<ol>` with the roles dropped (parity break plus the Safari risk).

---

## R-08 — Physical → logical inset/padding utilities in the alternate variant

**Decision**: in the `alternate` compound variants, translate upstream's physical utilities to their
logical counterparts: `-right-[…]` → `-end-[…]`, `-left-[…]` → `-start-[…]`, `left-3` → `start-3`,
`pr-6` → `pe-6`, `pl-6` → `ps-6`, `ml-auto` → `ms-auto`, `text-right` → `text-end`. Upstream's
`default` variants already use logical `start-*`, which are kept as-is.

**Rationale**: FR-004 and SC-003 require the alternate layout to mirror under `dir="rtl"`. Upstream
mixes logical utilities in the default variant with physical ones in the alternate variant, so its
alternate layout does **not** mirror — a bug relative to its own documented "fully supports RTL"
claim. Under `dir="ltr"` every logical utility compiles to the identical physical value, so this is a
zero-visual-change substitution for the majority case and a correctness fix for RTL. Recorded as an
upstream divergence in the spec's Assumptions.

**Implementation note**: negative arbitrary logical insets (`-start-[calc(…)]`) follow the same
Tailwind v4 code path as upstream's already-working `-right-[calc(…)]`. If a negative logical
arbitrary value fails to compile, the equivalent fallback is `start-[calc(-1*(…))]` — same computed
value, no `!important`, no config change.

---

## R-09 — Out-of-range and unset `activeIndex`

**Decision**: port `getItemStatus` verbatim — `activeIndex === undefined → 'pending'`;
`index < activeIndex → 'completed'`; `index === activeIndex → 'active'`; otherwise `'pending'`. No
clamping, no validation.

**Rationale**: the comparison already produces a valid `Status` for every integer, which is exactly
what the spec's edge case requires (index past the end ⇒ everything `completed`; negative ⇒
everything `pending`). Adding a clamp would change documented behaviour for no benefit and would
break the "no per-item prop required" property.

**Consequence for connectors**: `getNextItemStatus` returns `undefined` only for the last item (and
for an unknown id), which is precisely the "is last item" test upstream uses for `forceMount`.
An unregistered id (first render, before the registration effect flushes) therefore reads as "last"
and the connector is momentarily absent — upstream behaves identically on its first client render.

---

## R-10 — `useComposedRefs` → one bindable `ref` plus one internal element ref

**Decision**: `ref = $bindable(null)` is bound with `bind:this` for the consumer, and the item
registers **that same node**: the registration `$effect` reads `ref` and registers it. No composition
helper is needed because Svelte has a single `bind:this` per element and the consumer's binding and
the component's read are the same variable.

**Rationale**: `useComposedRefs` exists to fan one DOM node out to two React refs; a Svelte
`$bindable` ref already is the single shared slot. The `$effect` depends on `ref`, so a re-bound
element (element identity change) re-registers automatically and the teardown unregisters the old id.

**Alternative considered**: a second private `itemEl = $state(null)` bound alongside — impossible,
`bind:this` accepts one target; and unnecessary, since the public `ref` is already the node.

---

## R-11 — `useLazyRef` → nothing

**Decision**: not ported. Its only purpose is to lazily construct React refs holding a `Set`/`Map`
across renders; a Svelte class instance created once during the root's initialisation is already
per-instance and never re-created.

**Rationale**: CLAUDE.md §10 — `useMemo`/`useCallback`/lazy-ref plumbing has no Svelte counterpart and
must not be transliterated.

---

## R-12 — `dateTime` on `<time>`

**Decision**: `TimelineTimeProps` extends `WithElementRef<HTMLTimeAttributes, HTMLTimeElement>` (which
declares the native lowercase `datetime`) **and** adds an explicit `dateTime?: string` upstream-parity
alias. The component destructures `dateTime` and renders `datetime={dateTime}` before spreading
`...restProps`, so a consumer passing the native `datetime` overrides the alias.

**Rationale**: upstream's prop is React's camelCase `dateTime`; `svelte/elements` types the attribute
as lowercase `datetime` (`node_modules/svelte/elements.d.ts:1437`). Accepting both keeps upstream
parity (Principle II) without breaking the Svelte-idiomatic spelling or requiring a cast.

---

## R-13 — Keyboard model

**Decision**: no keyboard handling, and a test that proves it — pressing every arrow/Home/End/Enter/
Escape/Tab key changes no `data-status`, no `aria-current` and no focus target.

**Rationale**: upstream registers no key handler; timeline items are not focusable or interactive.
There is no WAI-ARIA APG "timeline" pattern, and the correct minimal pattern for non-interactive
chronological content is a list with a current-item indicator. Principle III requires keyboard
support to match upstream "key-for-key" — here that set is empty, so the assertion is inertness. The
`direction-provider` port set this precedent (its `keyboard (C-20)` describe block).

---

## R-14 — Test harness shape

**Decision**: a prop-driven `timeline.test.svelte` harness (not collected by Vitest — `include` is
`src/**/*.{test,spec}.{js,ts}`, and excluded from `registry.json`) covering the cases a `.ts` spec
cannot express: nested snippets for the nine-part tree, `bind:ref` reporting, `child` snippets,
dynamic insert/remove/reorder of items, and rendering a context-consuming part outside its provider.
Simple cases (`activeIndex` statuses, data attributes, class merge) render components directly with
`createRawSnippet` children, as in `direction-provider.test.ts`.

**Rationale**: matches every recent port in this repo (`direction-provider`, `stat`, `badge-overflow`,
`color-swatch` all ship a `.test.svelte` harness) and is the only way to exercise a compound
component's context wiring and snippet props from a `.ts` spec.
