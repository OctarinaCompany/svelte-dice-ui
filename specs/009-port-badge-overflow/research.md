# Phase 0 Research — Badge Overflow port

**Feature**: `009-port-badge-overflow` | **Date**: 2026-07-30

Upstream material read at the pinned commit (`d9763d82530416dfa4c81c462387b55d06bae4ec`):

| File                                                                                | What it fixed                                                                     |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `.reference/diceui/docs/registry/bases/radix/ui/badge-overflow.tsx`                 | The whole implementation: measurement row, `useLayoutEffect`, fitting loop, defaults |
| `.reference/diceui/docs/registry/bases/base/ui/badge-overflow.tsx`                  | Diffed against the radix variant — behaviourally identical (R-01)                  |
| `.reference/diceui/docs/hooks/use-badge-overflow.ts`                                | The **unused** alternative measurement hook (R-05)                                |
| `.reference/diceui/docs/content/docs/components/radix/badge-overflow.mdx`           | API contract, feature list, the "container must have a defined width" prerequisite |
| `.reference/diceui/docs/types/radix/badge-overflow.ts`                              | The published prop JSDoc, copied verbatim onto the Svelte props                    |
| `.../radix/examples/badge-overflow-demo.tsx`                                        | Default + custom-overflow composition, `w-64` container                           |
| `.../radix/examples/badge-overflow-multiline-demo.tsx`                              | `lineCount` 1 / 2 / 3 over 15 items                                               |
| `.../radix/examples/badge-overflow-interactive-demo.tsx`                            | Object items + `getBadgeLabel`, add/remove, clickable badge with an `X` icon      |

Local precedent read: `src/lib/components/ui/{swap,color-swatch,gauge,circular-progress,badge}/**`,
`src/lib/components/docs/component-preview.svelte`, `src/lib/registry.ts`, `tests/setup.ts`,
`vite.config.ts`, `CLAUDE.md`, `.specify/memory/constitution.md`,
`.agents/skills/shadcn-svelte/rules/{styling,composition,forms,icons}.md`.

No `[NEEDS CLARIFICATION]` markers remain in `spec.md`; every open question below is resolved here.

---

## R-01 — Which upstream variant: `radix`, confirmed by diff

**Decision**: port `docs/registry/bases/radix/ui/badge-overflow.tsx`.

**Rationale**: the spec's Assumptions already select the radix variant; this research confirms the
premise mechanically. `diff base/ui/badge-overflow.tsx radix/ui/badge-overflow.tsx` shows only:
the import block (`@base-ui/react`'s `mergeProps`/`useRender` vs `radix-ui`'s `Slot`), the
`asChild?: boolean` prop vs base's `render`, the `BadgeOverflowElement` type alias, and base's
extraction of the two render branches into a `renderContent(isMeasuredState)` helper. The measurement
effect, the fitting loop, every default and every class string are byte-identical. Neither React
primitive library is a dependency here, so both collapse onto the same Svelte `child` snippet anyway.

**Alternatives considered**: the `base` variant (identical behaviour, `render` prop maps to the same
`child` snippet — no advantage); porting both (would produce two identical Svelte files).

## R-02 — Reading container metrics: parse `getComputedStyle`, guard for non-finite

**Decision**: `readContainerMetrics(el)` returns `{ gap, padding, contentWidth }` where
`gap = toFinite(parseFloat(style.gap), DEFAULT_BADGE_GAP)`,
`padding = toFinite(parseFloat(style.paddingLeft), 0) + toFinite(parseFloat(style.paddingRight), 0)`,
and `contentWidth = el.clientWidth - padding`.

**Rationale**: upstream writes `const gap = gapValue ? parseFloat(gapValue) : 4`. That is correct only
when `gap` computes to a length. A `flex` container with no `gap` set computes to `normal` in every
engine, and `parseFloat('normal')` is `NaN` — which upstream then writes straight back out as
`style={{ gap: NaN }}` and multiplies into `placeholderHeight`, producing an invalid declaration and a
`NaN` `min-height`. In this port the root always sets `gap` from its own state (seeded at `4`), so the
computed value is normally a length and the branch is unreachable in practice — but it *is* reachable
on the very first pass in engines that have not yet applied the inline style, and in jsdom. A
`Number.isFinite` guard is one expression, keeps the documented default of `4`, and never changes
behaviour in the case upstream handles. Recorded as a divergence in spec §Assumptions.

**Alternatives considered**: transliterating the `NaN` (rejected — ships a known defect into every
consumer's copy); reading `rowGap`/`columnGap` separately (rejected — upstream keys off the `gap`
shorthand and the component only ever writes the shorthand).

## R-03 — Typing the conditionally-required `getBadgeLabel` under `generics="T"`

**Decision**: declare the root generic on the **instance** script (`<script lang="ts" generics="T">`),
declare the props type in the **module** script as generic, and express the conditional requirement as
an intersection whose first member is always accessible:

```ts
interface GetBadgeLabel<T> {
	getBadgeLabel: (item: T) => string;
}

export type BadgeOverflowRootProps<T = string> = WithoutChildren<
	WithElementRef<HTMLAttributes<HTMLDivElement>>
> &
	BadgeOverflowOwnProps<T> &
	Partial<GetBadgeLabel<T>> &
	(T extends object ? GetBadgeLabel<T> : object);
```

**Rationale**: upstream's shape is `(T extends object ? GetBadgeLabel<T> : Partial<GetBadgeLabel<T>>)`.
Written that way in Svelte, the `$props()` destructuring of `getBadgeLabel` happens against an
*unresolved* (deferred) conditional type — `T` is still a bare type parameter inside the component — and
TypeScript refuses property access on a deferred conditional. Intersecting `Partial<GetBadgeLabel<T>>`
(always present, always optional) with the deferred conditional keeps the destructure legal inside the
component while producing exactly upstream's contract at every call site: for a primitive `T` the
conditional collapses to `object` and the prop stays optional; for `T extends object` it collapses to
the required member and `{ optional } & { required }` is required. `T` is left without a default in the
`generics` attribute (inference from `items` supplies it at every call site); the exported *type* keeps
`= string` for consumers importing it directly, matching upstream's `BadgeOverflowProps<T = string>`.

**Verification step (scheduled in tasks)**: `pnpm run check` must show zero errors, and the test file
must contain a compile-time exercise of both shapes (a primitive-array render without `getBadgeLabel`
and an object-array render with it). If svelte-check still rejects the destructure, the fallback is to
annotate `$props()` with `BadgeOverflowOwnProps<T> & Partial<GetBadgeLabel<T>> & …` and re-export the
conditional form as the public `BadgeOverflowProps<T>` — degrading the compile-time refinement to the
runtime throw only, which would then have to be added to spec §Assumptions. This is the fallback, not
the plan.

**Alternatives considered**: dropping the conditional and relying solely on the runtime throw (rejected
— loses an upstream compile-time guarantee, Principle II); two separate components for primitive vs
object items (rejected — invents API surface upstream does not have).

## R-04 — `asChild` → `child` snippet, extended with a `content` snippet

**Decision**:
`child?: Snippet<[{ props: BadgeOverflowChildProps; content: Snippet }]>`. The caller spreads `props`
onto their element and renders `{@render content()}` inside it.

**Rationale**: the repo's established `child` pattern (`swap.svelte`, `color-swatch.svelte`,
`gauge.svelte`) hands over `{ props }` only, because in those components the element's children are
either empty or supplied by the caller as `children`. Badge Overflow is different: its children are
*generated* — the visible badge list plus the indicator — so a `{ props }`-only payload would silently
render an empty container in `child` mode, which is a behaviour regression against Radix's `Slot`
(which preserves the component's own children through `cloneElement`). Passing the generated content as
a second snippet in the payload restores exact parity and keeps the pattern recognisable. `children` is
therefore removed from the props type entirely (`WithoutChildren<…>`), so there is no ambiguity about
what a caller may put inside.

**Alternatives considered**: `{ props }` only (rejected — drops content in `child` mode);
`asChild: boolean` + a Svelte `Slot` shim (rejected — Svelte has no `cloneElement`; CLAUDE.md §10
mandates the snippet).

## R-05 — `use-badge-overflow.ts` is not ported, and its extra correction is not adopted

**Decision**: port only the measurement embedded in `badge-overflow.tsx`. Do not port
`measureBadgeWidth`, `badgeWidthCache`, `clearBadgeWidthCache`, or `useBadgeOverflow`.

**Rationale**: the hook is dead code with respect to the component — `badge-overflow.tsx` does not
import it. It implements a *different* strategy (build a synthetic `div` from a hard-coded class string,
append to `document.body`, read `offsetWidth`, cache by label) that cannot see the consumer's actual
`renderBadge` output, which is precisely what FR-006 requires. Shipping both would ship two
disagreeing algorithms in one registry item.

**One behavioural difference worth recording**: the hook contains a correction the component lacks — if
the overflow badge itself would not fit after the last accepted item, it `visible.pop()`s that item.
The component instead reserves `overflowBadgeWidth + badgeGap` up front, but only *on the last line and
only while `i < items.length - 1`*. Consequence: when the final item is the one that overflows, the
last line can be packed as if no indicator were coming, and the indicator may then wrap. This is
upstream's shipped behaviour for the variant being ported; the port reproduces it verbatim and does not
adopt the hook's `pop()`. Recorded in spec §Assumptions.

**Alternatives considered**: porting the hook as an extra export (rejected — unused surface area,
Principle IV); merging the `pop()` correction in (rejected — silent divergence from the ported
algorithm, Principle II).

## R-06 — `useLayoutEffect` → one `$effect` + `ResizeObserver`, with no feedback loop

**Decision**: a single `$effect` in `badge-overflow.svelte`:

```ts
$effect(() => {
	// tracked reads first, so the effect re-runs on items / getBadgeLabel changes
	state.trackInputs();
	const root = containerEl;
	const measure = measureEl;
	if (!root || !measure) return;
	state.measure(root, measure);
	return observeResize(root, () => state.measure(root, measure));
});
```

`observeResize` no-ops (returning a no-op teardown) when `typeof window === 'undefined'` or
`typeof ResizeObserver === 'undefined'`.

**Rationale (why not `$effect.pre`)**: recorded in spec §Assumptions — the pass reads the layout of the
*already rendered* measurement row, so it must run after DOM commit, which is exactly `$effect`.
`$effect.pre` would run before the row reflects the current `items`.

**Rationale (why there is no loop)**: the effect reads `items`, `getBadgeLabel`, `lineCount` and the DOM;
it writes `containerWidth`, `badgeGap`, `badgeHeight`, `overflowBadgeWidth`, `badgeWidths`,
`isMeasured`. Those two sets are disjoint, so Svelte never re-schedules the effect from its own writes,
and no `untrack()` is needed. The writes do re-render the container (the split changes, and `gap` is
written from `badgeGap`), which can make the `ResizeObserver` fire again — the same guard upstream
relies on. Two dampeners are added: every scalar write is a plain assignment (Svelte skips equal
primitives), and the width map is compared element-wise before assignment (`sameWidths(prev, next)`),
so a re-measure that changes nothing produces zero state changes. `badgeWidths` is `$state.raw` because
it is replaced wholesale, never mutated.

**Alternatives considered**: a `window` resize listener (explicitly forbidden by the invocation, and
blind to container-only resizes); `$effect.pre` (wrong timing, above); an `$effect` per metric
(rejected — four observers, four teardowns, same reads).

## R-07 — Testing measurement in jsdom (no layout engine)

**Decision**: the spec installs three deterministic stubs in a local `beforeEach`, restored by the
global `afterEach`'s `vi.restoreAllMocks()`:

1. `vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get')` → a width derived from the element's own
   text (`BADGE_PADDING + text.length * CHAR_WIDTH`), so a test can reason exactly about which badges
   fit.
2. `vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get')` → a fixed badge height (`20`).
3. `vi.spyOn(Element.prototype, 'clientWidth', 'get')` → the per-test container width.

plus a controllable `ResizeObserver` double that records its callbacks so a test can call
`resize(newWidth)` and assert re-measurement (FR-007), and `.disconnect()` calls so a test can assert
teardown on unmount.

**Rationale**: jsdom reports `0` for every layout property and never fires `ResizeObserver`. Without
stubs the component would always sit in its pre-measurement placeholder branch and SC-001 could not be
asserted at all. `tests/setup.ts` already provides a no-op `ResizeObserver` shim via `??=`, which is
enough for the component not to crash but not enough to drive it — the local double takes precedence by
assigning `globalThis.ResizeObserver` inside the test file and restoring it afterwards. **No change to
`tests/setup.ts` or `vite.config.ts` is made** (loosening shared config is a Constitution VII/VIII
anti-cheat trigger).

`getComputedStyle(root).gap` resolves in jsdom because the component writes `gap` as an *inline* style;
`paddingLeft`/`paddingRight` are supplied by the harness through the `style` prop where a test needs
non-zero padding.

**Alternatives considered**: a browser-mode Vitest project (rejected — new tooling and a new config for
one component, and the four gates are jsdom-based); asserting only the pre-measurement branch (rejected
— would leave FR-001/FR-006/FR-007 untested).

## R-08 — Accessibility: no role, no keyboard, and why that is the correct port

**Decision**: emit no `role`, no `aria-*` on the visible container, and no keyboard handlers; put
`aria-hidden="true"` on the invisible measurement row.

**Rationale**: upstream's component emits `data-slot` and nothing else — it is a layout/measurement
utility with no WAI-ARIA Authoring Practices pattern of its own (spec §Assumptions). Every interactive
affordance in the upstream demos lives inside the consumer's `renderBadge` output (the interactive demo
puts `onClick` on a `Badge`), so accessible naming and keyboard reachability are the consumer's, and
the port must not invent a role that would break their semantics. The one genuine addition is
`aria-hidden="true"` on the measurement row: it duplicates every badge's text into the accessibility
tree, and upstream hides it only visually (`invisible`, which does remove it from the a11y tree in
practice) — making the intent explicit costs nothing and is defensive if a consumer's badge markup
overrides `visibility`. Recorded in spec §Assumptions.

The Constitution III test clauses map as follows: *roles/ARIA* → asserted as the negative contract;
*keyboard* → asserted as "container is not focusable, `Tab` visits consumer badges in DOM order";
*RTL* → asserted (same split, same DOM order, container inherits `dir`); *uncontrolled/controlled* →
N/A (no value prop) and replaced by the consumer-owned `items` add/remove case, which is FR-011 and the
upstream interactive demo; *guard rails / provider throw* → replaced by the documented `getBadgeLabel`
throw, which is asserted with the verbatim message.

**Alternatives considered**: `role="list"` + `role="listitem"` (rejected — the consumer's badges are
not necessarily list items, and upstream does not do it; it would also change how screen readers
announce the interactive demo's buttons).

## R-09 — SSR: what renders on the server

**Decision**: on the server, `isMeasured` is `false`, so the visible container renders
`getPlaceholderCount(items.length, lineCount)` badges with `min-height: {getPlaceholderHeight(20, 4,
lineCount)}px` and `gap: 4px`, and the measurement row renders every badge plus the sample indicator.
No effect runs; `window`, `document` and `ResizeObserver` are referenced only inside the effect and
inside `observeResize`, both of which are client-only, and neither is touched at module scope or during
component initialisation.

**Rationale**: FR-010. This is upstream's own `isMeasured === false` branch, reproduced exactly
(`Math.min(items.length, lineCount * 3 - (lineCount > 1 ? 1 : 0))`), which is why hydration matches:
the client's first render is the same placeholder, and the effect then upgrades it.

**Alternatives considered**: rendering nothing before measurement (rejected — FR-010 forbids the flash
of empty content); rendering all items (rejected — a large layout shift, and not upstream).

## R-10 — Demo route and props tables

**Decision**: three `<ComponentPreview>` sections, one per upstream demo file, in MDX order —
**Default** (`badge-overflow-demo.tsx`: the plain case and the custom-overflow case, both in a `w-64`
bordered box), **Multi-line Overflow** (`-multiline-demo.tsx`: `lineCount` 1 / 2 / 3 over the same 15
technologies), **Interactive Tags** (`-interactive-demo.tsx`: object items + `getBadgeLabel`, an
`Input` + `Button` to add, click-to-remove badges with `@lucide/svelte/icons/x`) — followed by two
props tables built from `$lib/components/ui/table`, matching `docs/components/gauge/+page.svelte`.

The interactive demo's `X` icon carries **no sizing class**: `badgeVariants` already applies
`[&>svg]:size-3!` (icons.md). Demo state is page-local runes (`let tags = $state([...])`), no
`+page.ts` (Principle IX). Container widths are `w-64` / `max-w-80` exactly as upstream, which also
satisfies the "container must have a definite width" prerequisite.

**Alternatives considered**: merging the default and custom-overflow cases into separate previews
(rejected — Principle IX pins one preview per upstream *file*; both cases live in one file and are
shown side by side inside that one preview).
