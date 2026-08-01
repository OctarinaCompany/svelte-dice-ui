# Phase 0 Research: Port Stack Component

**Feature**: `039-port-stack` | **Date**: 2026-08-01

**Upstream (pinned `d9763d82530416dfa4c81c462387b55d06bae4ec`)**

| Artifact         | Path                                                                              |
| ---------------- | --------------------------------------------------------------------------------- |
| Primary source   | `.reference/diceui/docs/registry/bases/radix/ui/stack.tsx`                        |
| Alternate source | `.reference/diceui/docs/registry/bases/base/ui/stack.tsx`                         |
| Prop contract    | `.reference/diceui/docs/types/radix/stack.ts`                                     |
| MDX              | `.reference/diceui/docs/content/docs/components/radix/stack.mdx`                  |
| Demos            | `.reference/diceui/docs/registry/bases/radix/examples/stack-{,no-expand-,side-}demo.tsx` |
| Upstream tests   | none — no `stack` test file exists anywhere in the monorepo                       |

The two upstream variants were diffed. They are identical apart from the composition escape hatch
(`asChild` + Radix `Slot` vs. `render` + Base UI `useRender`/`mergeProps`) and the resulting
`data-slot` plumbing. Every prop, default, layout formula and data attribute matches. The radix
variant is the reference, per the task instruction and the spec's Assumptions.

Because there is no upstream test file, the assertion floor of Principle III is set by the MDX
`DataAttributesTable`s, the `types/radix/stack.ts` JSDoc, and the three demos — all enumerated in
`contracts/public-api.md`.

---

## R-01 — Children cannot be inspected, so items must self-register

**Decision**: `Stack.Item` self-registers with the root's state through context and renders **both**
elements upstream renders per child — the positioning wrapper (`data-slot="stack-item-wrapper"`) and
the card (`data-slot="stack-item"`) — producing byte-comparable DOM structure. The item's index is
its document-order position in the registry, not a prop.

**Rationale**: Upstream computes indices with `React.Children.toArray(children).filter(isValidElement)`
and wraps each child in an internal `StackItemWrapper`. Svelte has no equivalent of `React.Children`
(CLAUDE.md §10: "not available — model it explicitly with context or an items array"), and a snippet's
rendered output cannot be enumerated or wrapped by its parent. Self-registration is the project's
established substitute (`speed-dial`, `stepper`, `action-bar`, `time-picker`).

**Alternatives considered**:

- _`items` array prop + item snippet_ — changes the public shape from `<Stack><StackItem/></Stack>` to
  a data-driven API, contradicting the MDX "Layout" section. Rejected.
- _Index passed explicitly as a prop on `Stack.Item`_ — pushes bookkeeping onto the consumer, breaks
  the moment a list is filtered, and is not in the upstream prop table. Rejected.
- _Keeping `StackItemWrapper` as a fourth public part_ — upstream never exports it; exporting it is
  API drift, and it would force consumers to write the wrapper themselves. Rejected (spec Assumption:
  "Internal item wrapper is not a public part").

**Consequence (recorded as divergence D-01)**: upstream wraps _any_ child, including a bare `<div>`;
here only `Stack.Item` (or `Stack.Item` with its `child` snippet) participates in the stack. Anything
else rendered inside `Stack.Root` is left untouched in normal flow.

## R-02 — Ordering primitive: reuse `DomOrderedCollection`

**Decision**: import `DomOrderedCollection` from
`$lib/components/ui/speed-dial/index.js` and add `speed-dial` to `registryDependencies`.

**Rationale**: Principle IV orders sourcing as (1) existing `src/lib/components/ui/*`, (2) `bits-ui`,
(3) bespoke. `DomOrderedCollection` is exactly (1): a `SvelteMap`-backed registry that sorts by
`compareDocumentPosition`, exposes `ordered`, `indexById` and `size` as `$derived`, drops detached
elements, and was explicitly written to be reused ("exported from the barrel for later ports to reuse
rather than duplicate"). Four components already depend on it this way, and `stepper`, `action-bar`
and `time-picker` all list `speed-dial` in `registryDependencies` for precisely this import — the
precedent is established, so Stack follows it rather than inventing a second ordering module.

Document order (not mount order) is what Stack needs: it makes `{#each}` reordering, conditional
items and late insertions produce correct indices, z-order and visibility without a remount, which is
what spec edge case "Children added or removed at runtime" requires.

**Alternatives considered**:

- _A private counter incremented per `Stack.Item` instance_ — mount order diverges from DOM order as
  soon as items are reordered or conditionally rendered. Rejected.
- _A local copy of the collection inside `stack/`_ — duplicates an audited module and doubles the
  maintenance surface; Principle IV forbids reimplementation when a project primitive exists.
- _`bits-ui`_ — exposes no public collection/registry primitive. Not applicable.

## R-03 — `cva` → `tv()`

**Decision**: reproduce `stackItemWrapperVariants` with `tv()` from `tailwind-variants`, declared in
the module script of `stack-item.svelte` and exported from the barrel. Axes and defaults are
reproduced 1:1: `side: 'top' | 'bottom'`, `isExpanded: true | false`, `isVisible: true | false`.

**Rationale**: CLAUDE.md §6 and Principle VIII mandate `tv()` in a module script (as
`button.svelte` and `marquee-content.svelte` do). `tailwind-variants` is already a repo dependency;
`class-variance-authority` is not and must not be added.

**Note**: upstream's cva config declares **no `defaultVariants`** and always passes all three axes
explicitly, so `tv()` needs no `defaultVariants` either — the root always supplies `side`, and the
item always supplies its computed `isExpanded` / `isVisible`.

## R-04 — Motion: transitions only, no keyframes, so `src/app.css` is untouched

**Decision**: the expand/collapse animation stays a pure CSS **transition**
(`transition-all duration-300 ease-out`) over `transform` and `opacity`, driven by the per-element
inline custom properties `--translate` and `--item-scale`. No `@keyframes` and no `--animate-*` theme
entry are required, therefore **no change is made to `src/app.css`**.

**Rationale**: verified against the upstream source — `stackItemWrapperVariants` uses
`translate-y-[var(--translate)] scale-[var(--item-scale)]` plus `transition-all`; there is no
`animation` shorthand anywhere in `stack.tsx`. Arbitrary-value utilities read the custom property off
the element it is set on, so per-instance values resolve correctly with no theme plumbing at all.

**Guard rail carried forward**: if a keyframe ever becomes necessary for this component, it MUST be
declared inside `src/app.css`'s existing `@theme inline` block, never a plain `@theme` — a plain
`@theme` publishes the `--animate-*` shorthand as a `:root` custom property, where per-instance
properties such as `--translate` do not exist, and `animation` silently resolves to `none`. The
existing marquee block in `src/app.css` (lines 138–210) documents this exact failure mode. Nothing in
this port needs it.

**Reduced motion**: `motion-reduce:transition-none` is appended to the wrapper base classes, so the
collapsed/expanded end state still applies and only the interpolation is dropped — matching FR-014 and
`banner`'s precedent (`bannerVariants` base ends in `motion-reduce:transition-none`). Recorded as
divergence D-02 (upstream has no reduced-motion handling).

## R-05 — Measurement of the expanded offsets

**Decision**: each `Stack.Item` measures its wrapper once on mount with `getBoundingClientRect()`,
divides by its collapsed scale factor to recover the natural height, and publishes it to the state
class keyed by its **registration id**; it removes that entry on unmount. `itemsSizeBefore` for index
_i_ is the sum of the natural heights of every item whose document index is `< i`.

**Rationale**: verbatim upstream formula (`naturalHeight = measuredHeight / (1 - index * scale)`;
`itemsSizeBefore = Σ size where itemId < index`). Upstream keys by **index** and its
`if (!existing) return [...d, …]` reducer never removes or updates an entry, so removing a child
leaves a stale size attached to a now-different index. Keying by a stable per-instance id and deleting
on unmount produces the same numbers for a static stack and correct numbers for a dynamic one, which
is what the spec's "children added or removed at runtime" edge case requires. Recorded as divergence
D-03.

**Write-in-effect hazard**: the size map is a `SvelteMap` written from an `$effect`; per the project's
recorded lesson (`sveltemap-write-in-effect-self-invalidates`), the write is wrapped in `untrack()`,
otherwise every sibling re-registers in a loop. The measurement effect depends only on the element, not
on `scale` — matching upstream's "measure once" behaviour, whose `scale` dep is dead code behind the
`if (!existing)` guard.

**jsdom note**: `getBoundingClientRect()` returns all-zero rects in jsdom, so every natural height is
`0` there and the expanded translation collapses to `index * gap`. Tests assert against that exact
value rather than stubbing layout.

## R-06 — `pointerup` outside the root

**Decision**: while `isInteracting` is true, the root attaches a `pointerup`/`pointercancel` listener
on `document` inside an `$effect` that returns its teardown; either event clears the flag.

**Rationale**: upstream only listens for `onPointerUp` on the root element, so pressing inside the
stack and releasing outside leaves `isInteracting` stuck at `true`, and the stack can then never
collapse (`onMouseLeave` is gated on `!isInteracting`). The spec calls this out explicitly under
"Pointer capture edge cases". The fix is additive, has no effect on the documented API, and is
recorded as divergence D-04.

## R-07 — Event composition and `preventDefault()`

**Decision**: `onmouseenter`, `onmousemove`, `onmouseleave`, `onpointerdown` and `onpointerup` are
destructured out of `$props()` and re-composed: the caller's handler runs first, then the component
checks `event.defaultPrevented` and skips its own logic if it is set.

**Rationale**: byte-for-byte upstream semantics (`onMouseEnterProp?.(event); if (event.defaultPrevented) return;`)
and FR-013. The composed handlers are placed in the merged attribute object so they are also available
to the `child` snippet; the spread order puts `...restProps` before them so a caller cannot silently
drop the stack's own behaviour by re-declaring the attribute (upstream achieves the same by listing its
handlers before `{...rootProps}` — but upstream's ordering means a caller-supplied handler *replaces*
the stack's; composing is the repo's established resolution, as in `marquee`'s D-06).

## R-08 — `asChild` → `child` snippet

**Decision**: both parts take an optional `child?: Snippet<[{ props: … }]>`; when supplied, the part
renders the snippet with the fully merged attribute payload and does not render its own element or
`children`, and `ref` stays `null`.

**Rationale**: CLAUDE.md §10 and the repo-wide precedent (`marquee-item.svelte`,
`dialog-content.svelte`). Avoids adding `radix-ui` as a dependency (spec "Scope boundary").

**Item-specific detail**: upstream's `asChild` on `StackItem` swaps only the **card** element; the
positioning wrapper is always a plain `div`. The port preserves that: `Stack.Item`'s `child` snippet
replaces the inner card, never the wrapper.

## R-09 — Boolean data attributes: `"true"`/`"false"`, not presence

**Decision**: `data-front`, `data-visible` and `data-expanded` are emitted as the literal strings
`"true"` / `"false"`.

**Rationale**: the MDX `DataAttributesTable` documents their value set as `["true", "false"]`, and
React renders `data-front={isFront}` to exactly those strings, so `[data-visible="false"]` is the
documented selector. Emitting them as presence flags (`? '' : undefined`) — Principle VIII's default —
would break every documented selector. Principle II is non-negotiable and wins; the deviation from
VIII is recorded in Complexity Tracking. Non-boolean state attributes (`data-state`, `data-index`,
`data-position`, `data-side`) are unaffected.

## R-10 — MDX vs. source disagreements

| MDX text                                          | Source / types                       | Resolution                                                                            |
| ------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| Usage Notes name `visibleItems` and `scaleFactor` | `itemCount`, `scale`                 | Use the source/type names; the prose is stale (no such props exist). Divergence D-05.  |
| Root documents `[data-expanded]`                  | Root emits `data-state`              | Emit **both** on the root, so both documented and actual selectors work. Divergence D-06. |
| `<Stack.Root>` / `<Stack.Item>` in Layout snippet | exports are `Stack`, `StackItem`     | The barrel provides both spellings (`Root`/`Item` + `Stack`/`StackItem`), per §3.      |

## R-11 — Accessibility posture

**Decision**: no roles, no `aria-*`, no keyboard handlers, no focus management are added.

**Rationale**: Stack has no WAI-ARIA Authoring Practices pattern — it is a presentational cascading
layout, and upstream assigns no role. Parity is achieved by construction: items are never
`display: none` and never `aria-hidden`, so every item's content stays in the accessibility tree and
in the tab order in both states; only opacity and `pointer-events` change. Tests assert this
(content of a collapsed, "invisible" item is still queryable and still focus-reachable) rather than
asserting a role that upstream does not have. Adding a keyboard expand toggle would be undocumented
API drift and is rejected.

## R-12 — Controlled / uncontrolled

**Decision**: no `expanded` / `onExpandedChange` prop is added. `ref` is the only `$bindable`.

**Rationale**: upstream's `isExpanded` and `isInteracting` are strictly internal `useState`; there is
no controlled mode, no `defaultValue`, and no change callback in the type contract. Principle II makes
the documented surface the ceiling as well as the floor. The Principle III "controlled/uncontrolled"
test area is therefore satisfied by its nearest applicable equivalent: the internal state machine
(`expandOnHover` on → hover expands, leave collapses, held pointer defers the collapse) and the static
mode (`expandOnHover` off → state never changes, whatever pointer events arrive). This substitution is
stated in plan.md's Constitution Check rather than left implicit.

## R-13 — RTL

**Decision**: replace upstream's physical `left-0` / `after:left-0` with the logical `start-0` /
`after:start-0`; everything else is unchanged.

**Rationale**: the spec's Assumptions require logical inline properties; with `w-full` the rendered
box is identical in both directions, so this is a correctness-preserving substitution rather than a
behaviour change. Stack varies only on the block axis (`side: top | bottom`), so there is no
horizontal navigation to invert. Tests assert that `dir="rtl"` changes neither the emitted data
attributes nor the computed translations. Divergence D-07.

## R-14 — Zero new npm dependencies

Confirmed: `tailwind-variants`, `clsx`/`tailwind-merge` (via `cn()`) and `svelte/reactivity` are
already present. `radix-ui` and `class-variance-authority` are deliberately **not** added (R-03, R-08).
`registryDependencies` is `["speed-dial"]` (R-02); `dependencies` is `[]`.
