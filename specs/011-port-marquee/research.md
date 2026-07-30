# Phase 0 Research: Marquee

All decisions below were resolved from the pinned upstream source, this repository's existing ports,
`CLAUDE.md` and `.specify/memory/constitution.md`. **Zero `NEEDS CLARIFICATION` markers remain.**

Upstream files read:

- `.reference/diceui/docs/registry/bases/radix/ui/marquee.tsx` (674 lines — the implementation)
- `.reference/diceui/docs/content/docs/components/radix/marquee.mdx` (the API contract)
- `.reference/diceui/docs/types/radix/marquee.ts` (the published prop table with `@default` tags)
- `.reference/diceui/docs/registry/bases/radix/ui/_registry.ts` lines 346–370 (`cssVars.theme`)
- `.reference/diceui/docs/registry/bases/radix/examples/marquee-{demo,logo-demo,vertical-demo,rtl-demo}.tsx`

There is **no upstream test file** for marquee (searched `.reference/diceui` for `*marquee*test*`
and `*marquee*spec*` — no matches), so Principle III's "upstream assertions are the floor" has no
floor to inherit here; the test matrix in `plan.md` is derived from the MDX's documented behaviour
and the spec's FRs instead.

Repository files read as convention references: `src/lib/components/ui/timeline/*` (root with
`child` snippet + `useDirection` + `tv()`), `src/lib/components/ui/badge-overflow/*`
(`ResizeObserver` measurement, pure exported helpers), `src/lib/components/ui/direction-provider/*`
(the direction contract), `src/lib/components/docs/component-preview.svelte`, `registry.json`,
`src/app.css`, `tests/setup.ts`.

---

## R-01 — Where the keyframes live

**Decision**: Add one plain `@theme { … }` block to `src/app.css` holding the six
`--animate-marquee-*` variables **and** the six `@keyframes` definitions, placed after the existing
`@theme inline` block. Mirror the same content into the registry entry's `cssVars.theme` and `css`
keys.

**Rationale**: `src/app.css` currently defines no animations at all (147 lines: tokens, `@theme
inline`, `@layer base`) and `tw-animate-css` does not ship marquee keyframes, so the utilities
`animate-marquee-left` … `animate-marquee-down` do not exist yet — without this step the demo page
renders a static row and SC-005 fails. Tailwind v4 emits `@keyframes` that are declared *inside* a
`@theme` block only when the corresponding `--animate-*` utility is used, which is exactly the
behaviour wanted. The block must be plain `@theme`, not `@theme inline`: `inline` substitutes the
variable's value at use-site and would not register the keyframes. The shadcn-svelte registry item
schema supports both keys (verified in
`node_modules/shadcn-svelte/dist/schema-CVDAtU6u.d.mts`: `registryItemCommonSchema.css` and
`.cssVars.theme`), so a consumer running the install gets the animation without a manual step —
which is what SC-006 requires.

The MDX snippet (lines 45–108) has a **misplaced closing brace**: the `:root {` block is never
closed before the `@keyframes` and a stray `}` appears at the very end. Transcribe the intent, not
the typo.

**Alternatives considered**: (a) a `<style>` block inside `marquee-content.svelte` — rejected: the
animation names would be scoped/hashed by Svelte and the `tv()` classes could not reference them,
and consumers restyling from the outside could not override. (b) An `@layer utilities` hand-written
`.animate-marquee-left { … }` — rejected: bypasses the theme system, so the utilities are invisible
to Tailwind's IntelliSense and to `tailwind-merge`'s conflict resolution.

---

## R-02 — Replacing `createResizeObserverStore` + `useSyncExternalStore`

**Decision**: Per-root measurement. `MarqueeState` owns `rootSize` and `contentSize` as `$state`
numbers. `marquee-content.svelte` runs one `$effect` that calls
`observeMarqueeSizes(rootElement, contentElement, onResize)` and returns its teardown.
`observeMarqueeSizes` creates a single `ResizeObserver` watching both elements; on every callback it
reads `getBoundingClientRect()` on both and hands the caller `{ rootWidth, rootHeight, contentWidth,
contentHeight }`. `MarqueeState` stores the axis-relevant pair based on the current orientation.

**Rationale**: Upstream's 180-line module-global store exists to satisfy React's
`useSyncExternalStore` contract — a stable `subscribe`, a cached `getSnapshot` that must return a
referentially-identical object between renders (hence the `WeakMap` snapshot cache and the
`queueMicrotask` notification coalescing), and ref-counted observation so multiple components can
share one observer. None of those constraints exist in Svelte: `$state` *is* the external-store
bridge, `$derived` recomputes only on actual value change, and a per-instance observer needs no ref
counting. Reproducing the store would be a transliteration, which the plan prompt and the React →
Svelte table in `CLAUDE.md` §10 explicitly forbid. Observable behaviour is identical: sizes update on
resize, the duration and multiplier follow, and the observer is disconnected on unmount.

An SSR guard (`typeof ResizeObserver === 'undefined'` → no-op teardown) mirrors upstream's
`isSupported` check and matches `badge-overflow`'s `observeResize`.

**Alternatives considered**: reusing `observeResize` from `badge-overflow` — rejected with the
two-part justification recorded in `plan.md` (wrong shape: one element, no size reporting; and it
would drag ~325 lines of unrelated generic code into every consumer's install).

---

## R-03 — Reduced motion: move the guard onto the animated element

**Decision (divergence D-02)**: Apply `motion-reduce:animate-none` to **both content tracks**, and
keep upstream's copy on the root as well.

**Rationale**: Upstream puts `motion-reduce:animate-none` on the *root* (line 402), but the root is
never animated — `animate-marquee-*` lives on the content (line 420 `marqueeContentVariants`). The
upstream class is therefore inert and a user with `prefers-reduced-motion: reduce` still sees the
marquee scroll. FR-012 and SC-003 require the animation not to play, so the guard is moved to where
the animation actually is. Keeping the root copy too costs nothing and preserves the upstream class
list verbatim for anyone diffing the two files.

This is delivered purely in CSS, so it needs no `matchMedia` (which jsdom only stubs), and it keeps
working when the OS preference changes at runtime without a re-render.

---

## R-04 — `role="marquee"` + `tabindex` + `onkeydown` vs. `svelte-check`'s a11y analysis

**Decision**: Build one merged attribute object in the instance script (`rootAttrs`) containing
`role`, `aria-live`, `dir`, `tabindex`, `onkeydown`, the `data-*` attributes, `...restProps` and the
merged `class`, then render `<div bind:this={ref} {...rootAttrs}>`. Do **not** write `tabindex` or
`onkeydown` as literal attributes in the markup.

**Rationale**: Svelte's compile-time a11y rules (`a11y_no_noninteractive_tabindex`,
`a11y_no_static_element_interactions`) are *static* — they inspect literal attributes in the
template. `marquee` is a non-interactive ARIA live-region role, so a literal `tabindex={0}` on it
would emit a warning, and `svelte-check` runs with warnings-as-failures under Principle VII while
`svelte-ignore` is a constitution violation under Principle VI. The attribute-object spread is the
pattern `timeline.svelte` already uses (it builds `rootAttrs` and spreads it), and it is required
anyway because the `child` snippet must receive exactly that payload. So this is not an evasion
bolted on to silence a warning — it is the same shape every `child`-supporting part in this repo
already has, and the resulting DOM is byte-identical to upstream's.

The behaviour is also correct on the merits: a marquee that opts into keyboard pausing must be
focusable (WCAG 2.1.1, and SC-004), and `tabindex` is added *only* when `pauseOnKeyboard` is true —
when it is false the attribute is `undefined` and the root stays out of the tab order (FR-011,
acceptance scenario 3 of User Story 2).

**Verification during implementation**: `pnpm run check` must report zero warnings. If a warning
appears despite the spread, the fallback is to render the root as a `<button>`-free focusable
container by keeping the spread and re-checking — not to add a suppression.

---

## R-05 — Asserting `role="marquee"` in tests

**Decision**: Assert with `expect(root).toHaveAttribute('role', 'marquee')` and locate elements via
`[data-slot="…"]` helpers (the `bySlot` / `allBySlot` helpers `timeline.test.ts` already defines),
rather than relying on `screen.getByRole('marquee')`.

**Rationale**: `marquee` is a valid ARIA 1.2 live-region role, but Testing Library resolves roles
through `aria-query`'s role table and its `getByRole` support for rarely-used live-region roles has
been inconsistent across versions. Attribute assertions test exactly what FR-001 states ("establishes
a `marquee` live-region role"), are version-stable, and are how the rest of this repo's ports assert
non-interactive containers. One test additionally asserts `aria-live="off"`, which is the other half
of the upstream live-region contract.

---

## R-06 — Composing the caller's `onkeydown`

**Decision**: The root's merged attribute payload sets `onkeydown` to a wrapper that first invokes
`restProps.onkeydown?.(event)` and then, if `pauseOnKeyboard` is true and `event.key === ' '`, calls
`event.preventDefault()` and toggles the pause flag. `restProps` is spread *before* the composed
handler so the wrapper wins the key collision.

**Rationale**: In React, `{...marqueeProps}` is spread before `onKeyDown={…}`, so upstream's handler
also replaces a caller's — but upstream then loses the caller's handler entirely, which is a silent
footgun. FR-015 requires unrecognised attributes to be forwarded; forwarding an `onkeydown` by
dropping it is not forwarding. Composing costs three lines, keeps upstream's pause behaviour
byte-identical, and is testable. Recorded as divergence D-06.

Upstream compares against `" "` (the space character), not `"Space"`; `userEvent.keyboard('{ }')`
produces exactly that `key`, so the tests drive the real key value.

---

## R-07 — Which parts throw outside the provider

**Decision**: `Marquee.Content` throws `` `<Marquee.Content>` must be used within `<Marquee.Root>`. ``
`Marquee.Item` and `Marquee.Edge` do **not** throw.

**Rationale**: Principle III requires "the documented error thrown when a part is rendered outside
its provider", and §5 of `CLAUDE.md` requires the throwing getter. But the obligation only attaches
to parts that *consume* the context. Upstream's `MarqueeContent` calls
`useMarqueeContext(CONTENT_NAME)` (line 473) and therefore throws; `MarqueeItem` (line 588) and
`MarqueeEdge` (line 659) read no context at all and render standalone — `MarqueeEdge` in particular
takes its `side` as its own prop rather than from context. Making them throw would be an API change
that breaks any consumer using `MarqueeItem` as a plain `shrink-0` wrapper. The guard-rail tests
therefore assert both directions: `Content` throws `/must be used within/`, `Item` and `Edge` render
without error.

`getMarqueeContext(consumerName: string)` still takes the consumer name so the message names both
the part and the provider, matching upstream's `` `${consumerName}` must be used within `${ROOT_NAME}` ``.

---

## R-08 — No controlled/uncontrolled pause API

**Decision**: Do not add a `paused` prop, a `bind:paused`, or an `onPausedChange` callback.

**Rationale**: Principle II makes upstream the contract, and upstream's `paused` is
`React.useState(false)` local to `Marquee` (line 309) — it appears in the context value but in no
prop type and in no documentation. The spec's FR list (FR-001…FR-018) and its Key Entities section
likewise describe pause as internal state, not as a prop. Adding a public bindable would be exactly
the "silent API drift" Principle II names as a defect, and it would make future re-synchronisation
against a newer upstream commit ambiguous. The `CLAUDE.md` §7 "controlled / uncontrolled" test areas
are satisfied by asserting the uncontrolled behaviour end to end (Space toggles `data-paused`) and
by recording here that there is no controlled mode to test. `data-paused` is still exposed as an
attribute (Principle VIII) so consumers can style and observe the state without a prop.

---

## R-09 — Measured sizes under jsdom

**Decision**: `tests/setup.ts` already installs a no-op `ResizeObserver`. Tests that need real
measurements install a local stub in the test body: a `ResizeObserver` whose constructor captures
the callback so the test can fire it, plus `vi.spyOn(Element.prototype, 'getBoundingClientRect')`
returning fixed sizes per element. Tests that do not care about measurement rely on the global no-op
stub and assert the *unmeasured* fallback duration.

**Rationale**: jsdom reports `0 × 0` for every element and never fires `ResizeObserver`. This is the
same situation `badge-overflow` faced and its test file already solves it this way, so the pattern is
established in-repo. `afterEach` in `tests/setup.ts` calls `vi.restoreAllMocks()`, so the spies do
not leak between tests. Purely arithmetic behaviour (duration, multiplier) is additionally covered by
direct unit tests of the exported pure helpers, which need no DOM at all — that is the main reason
those helpers are exported.

---

## R-10 — Demo page composition

**Decision**: Four `<ComponentPreview>` sections, one per upstream demo file, in the MDX's order:
"Default" (`marquee-demo`), "Logo Showcase" (`marquee-logo-demo`), "Vertical Layout"
(`marquee-vertical-demo`), "With RTL" (`marquee-rtl-demo`). Then four props tables (Root, Content,
Item, Edge) built with `$lib/components/ui/table`, plus a data-attributes table and a CSS-variables
table transcribing the MDX's `DataAttributesTable` / `CSSVariablesTable`.

Demo-specific notes:

- The upstream logo demo inlines six brand SVGs with hard-coded fills (`#3178C6`, `#38bdf8`,
  `#58C4DC`). Reproducing those verbatim would violate Principle VIII's semantic-token rule. The
  Svelte demo instead uses `@lucide/svelte` glyphs inside the same `size-16 rounded-full bg-accent`
  circle with the same `sr-only` brand name, which demonstrates the same capability (`autoFill` with
  small uniform items) without raw colours. Recorded as divergence D-07 — a demo-only substitution
  that changes no component behaviour.
- The vertical demo needs `side="bottom"` and `class="h-[320px]"` on the root; `ComponentPreview`'s
  canvas is `min-h-64`, so the section passes `class="h-[400px]"` to the preview so the marquee has
  room.
- The RTL demo uses the explicit `dir="rtl"` prop (as upstream does) **and** a second variant wrapped
  in `<DirectionProvider dir="rtl">` to demonstrate FR-013's ambient resolution, since that is the
  part of the contract this port adds over upstream.
- Demo state is held in the page with runes; no `+page.ts`.

---

## Divergence register

Every deliberate difference from upstream, as Principle II requires. D-01 is already recorded in the
spec's Assumptions; D-02…D-07 are recorded here and must be reflected in the component's JSDoc.

| ID   | Upstream behaviour                                                                       | This port                                                                                      | Why                                                                                             |
| ---- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| D-01 | `pauseOnKeyboard = false` in the source, `@default true` in the published prop table     | `pauseOnKeyboard = true`                                                                       | Ratified in the spec's Assumptions: follow the documented contract; keeps every marquee pausable (SC-004). |
| D-02 | `motion-reduce:animate-none` on the (never-animated) root                                | also on both content tracks                                                                    | Upstream's class is inert; FR-012 / SC-003 require the animation to actually stop (R-03).       |
| D-03 | The decorative clone re-spreads `{...contentProps}`, duplicating a caller's `id`         | the clone gets only class, style, `role="presentation"`, `aria-hidden`, `data-slot`, `data-clone` | Duplicate `id`s are invalid HTML and break `getByLabelText`/`aria-describedby`; FR-002 wants the clone decorative. |
| D-04 | `pauseOnHover` pauses on `:hover` only                                                   | also pauses on `:focus-within`                                                                 | WCAG 2.2.2 and the spec's User Story 2: a hover-only pause is unreachable without a pointer.    |
| D-05 | `MarqueeEdge` renders no `aria-hidden`                                                   | `aria-hidden="true"`                                                                           | FR-004 requires the edge to be hidden from assistive technology; it is a pure gradient.         |
| D-06 | The root's own `onKeyDown` replaces a caller-supplied one                                | the two are composed, caller first                                                             | FR-015 requires attributes to be forwarded, not dropped (R-06).                                 |
| D-07 | Logo demo inlines six brand SVGs with hard-coded hex fills                               | `@lucide/svelte` glyphs with `sr-only` names in the same circle                                | Principle VIII bans raw colours; the demo's purpose (`autoFill` with uniform items) is unchanged (R-10). |

Two upstream quirks are **fixed rather than reproduced** because they make the documented contract
unreachable, and both are covered by tests:

- `gap={16}` — React writes the custom property as the raw string `16`, which is not a valid CSS
  length, so `gap-(--marquee-gap)` collapses. The documented type is `string | number` with "numbers
  in pixels", so `resolveGap` emits `16px`. (Part of FR-007.)
- `loopCount={Infinity}` — reproduced exactly (`infinite`), as is `loopCount={0}`; noted here only
  because `Infinity.toString()` would otherwise yield the invalid value `"Infinity"`.
</content>
