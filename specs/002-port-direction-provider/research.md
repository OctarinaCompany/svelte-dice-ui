# Phase 0 Research: Port Direction Provider

**Feature**: `002-port-direction-provider` | **Date**: 2026-07-29

The Technical Context in [plan.md](./plan.md) contains **zero** `NEEDS CLARIFICATION` markers. This
document records the decisions that removed the ambiguity, each with its rationale and the
alternatives that were rejected.

## Sources read (pinned commit `d9763d82530416dfa4c81c462387b55d06bae4ec`)

| File                                                                        | Why                                                                              |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `.reference/diceui/docs/registry/bases/radix/components/direction-provider.tsx` | the shipped registry component                                                   |
| `.reference/diceui/docs/registry/bases/radix/ui/direction.tsx`              | byte-for-byte the same wrapper under a second path — confirms one canonical shape |
| `.reference/diceui/packages/shared/src/hooks/use-direction.ts`              | the real behaviour: `DirectionContext` + `dirProp ?? contextDir ?? "ltr"`         |
| `.reference/diceui/packages/shared/src/types.ts`                            | `export type Direction = "ltr" \| "rtl"`                                          |
| `.reference/diceui/docs/content/docs/utilities/radix/direction-provider.mdx` | the API contract and both usage examples                                          |
| `.reference/diceui/docs/types/radix/utilities.ts`                           | `DirectionProviderProps` — the JSDoc to copy (`@default "ltr"`)                   |
| `src/lib/components/ui/status/*`                                            | the only completed port — barrel shape, module-script props, test-harness pattern |
| `src/lib/components/ui/{accordion,toggle-group}/index.ts`                   | barrel conventions (short name + prefixed alias + types)                          |
| `src/lib/{utils.ts,registry.ts}`, `tests/setup.ts`, `package.json`, `registry.json` | project constraints                                                      |
| `.agents/skills/shadcn-svelte/rules/{styling,composition,forms,icons}.md`   | binding style rules                                                              |
| `node_modules/bits-ui/dist/**`                                              | Principle IV search for an existing direction primitive                          |

**No upstream test file exists** (searched `.reference/diceui` for `*direction*`: only the two
wrappers, the shared hook, the MDX and the types). **No upstream `*-demo.tsx` exists** either. So
Principle III's mandatory test areas and the MDX's two code examples are the floor, not an upstream
suite.

**Upstream behaviour, exactly**:

```tsx
const DirectionContext = React.createContext<Direction | undefined>(undefined);
function useDirection(dirProp?: Direction): Direction {
	return dirProp ?? React.useContext(DirectionContext) ?? 'ltr';
}
```

Three-step precedence, `undefined`-coalescing (so a provider genuinely absent is distinguishable from
one that is present), nearest-provider-wins by ordinary context nesting, hardcoded `"ltr"` floor.
That chain is the contract; everything below is about expressing it in Svelte.

---

## Decision 1 — the reader is a factory returning a class, not a plain value

**Decision**: `useDirection(options?): DirectionReader`, where `DirectionReader` exposes one member,
`readonly current: Direction`, declared as `$derived`. Callers write `reader.current`.

**Rationale**: A React hook re-runs on every render, so returning a bare `Direction` stays live for
free. A Svelte function called once during component init cannot: a returned primitive is a snapshot
and would freeze on the value that happened to be resolved at init, failing FR-009 (and SC-003, the
runtime language-switcher scenario). Returning an object whose field is `$derived` is the standard
Svelte 5 translation and matches CLAUDE.md §10 ("custom hook → a state class in `<slug>.svelte.ts`")
and §4 ("pass reactive values in as getter functions").

**Alternatives considered**:

- _Return a bare `Direction`_ — rejected: not reactive, breaks FR-009/SC-003 silently.
- _Return a getter function `() => Direction`_ — rejected: works, but `dir()` at every call site reads
  worse than `reader.current`, and a class gives later ports somewhere to grow (e.g. a memoised
  `isRtl`) without another API break.
- _Export a `$derived`-returning rune-like helper_ — not expressible; runes cannot be returned across
  function boundaries as values.

## Decision 2 — the explicit override is a getter, not a value

**Decision**: `UseDirectionOptions.dir?: () => Direction | undefined`, not `dir?: Direction`.

**Rationale**: Same reactivity gap as Decision 1, on the input side. A component forwarding its own
`dir` prop (`useDirection({ dir: () => dir })`) must have that forwarded value stay live when the
prop changes; a snapshot captured at init would not. CLAUDE.md §4 is explicit: "Pass reactive values
into the class as getter functions, never as snapshots — a plain value captured in the constructor
will not stay reactive."

**Alternatives considered**:

- _`Direction | (() => Direction | undefined)` union_ — rejected: normalising the union costs a
  `typeof` branch at runtime and gives two spellings of one idea, which is exactly the API drift
  Principle II warns about. Getter-only is one canonical form.
- _Positional argument `useDirection(() => dir)` to mirror upstream's arity_ — rejected: the DOM
  fallback (Decision 3) needs a second, optional anchor input, and an options bag extends cleanly
  where a second positional argument does not.

Recorded as a divergence in the spec's Assumptions.

## Decision 3 — the DOM fallback anchors on an optional element and observes `dir` mutations

**Decision**: The chain is `options.dir?.() ?? context?.current ?? domDir ?? 'ltr'`. `domDir` is
`$state<Direction | undefined>`, written by an `$effect` that (a) reads
`(options.element?.() ?? document.documentElement).closest('[dir="ltr"], [dir="rtl"]')` and (b)
installs a `MutationObserver` with `{ attributes: true, attributeFilter: ['dir'], subtree: true }` on
`document.documentElement`, returning `observer.disconnect()` as its teardown.

**Rationale**: FR-006 requires the "nearest ancestor DOM element (including the document root) that
carries a recognized `dir` attribute", which needs an anchor node to walk up from; FR-007 supplies the
`'ltr'` floor when the walk finds nothing; FR-009 requires the resolved value to track changes while
mounted, which only an observer can deliver for an external DOM attribute. Selecting
`[dir="ltr"], [dir="rtl"]` rather than `[dir]` implements the `dir="auto"` edge case directly: an
unrecognised value is skipped exactly as if the attribute were absent, and the walk continues
outward. `attributeFilter` keeps the observer cheap. Because `$effect` never runs on the server, the
fallback is inert during SSR and `document` is never touched at module or init time.

This is the one place the port intentionally writes reactive state from inside `$effect`. It does not
violate the "prefer `$derived`" rule: a `$derived` cannot observe a DOM attribute it does not read,
and the effect never reads the state it writes, so there is no loop.

**Alternatives considered**:

- _Read `document.dir` only_ — rejected: satisfies "document root" but not "nearest ancestor", so a
  `dir="rtl"` section inside an otherwise LTR page would resolve wrong (spec User Story 2 case 2).
- _No observer, read once at mount_ — rejected: fails FR-009 for the DOM branch.
- _Observe the anchor element instead of `document.documentElement`_ — rejected: the attribute that
  matters may be on any ancestor, and `subtree: true` from the root covers every anchor with one
  observer configuration.
- _Skip the DOM fallback and match upstream literally_ — rejected: FR-006 is an explicit, already
  documented requirement of this port (spec Assumption 2).

## Decision 4 — no `child` snippet

**Decision**: The root renders its wrapper unconditionally. There is no `child`/`asChild` escape
hatch.

**Rationale**: Upstream's `DirectionProvider` has no `asChild` prop — the `child` snippet exists in
this repo (Status, `dialog-content.svelte`) purely as the translation of Radix `Slot`, and there is
no `Slot` here to translate. Adding one would be API surface that upstream does not document, i.e.
the undocumented drift Principle II calls a defect. Decision 5's `display: contents` wrapper already
removes the layout motivation for an escape hatch.

**Alternatives considered**:

- _Add `child` "for symmetry with Status"_ — rejected as drift; symmetry is not a requirement.
- _Render no element at all (pure context, like Radix)_ — rejected: FR-010 requires forwarded
  attributes to reach rendered output, and the spec's Assumptions require the resolved `dir` to be
  present in the DOM so nested providers and the FR-006 fallback agree with each other.

## Decision 5 — the wrapper is a `display: contents` `<div>`

**Decision**: `<div bind:this={ref} data-slot="direction-provider" data-dir={dir} {dir}
class={cn('contents', className)} {...restProps}>`.

**Rationale**: The spec calls this a headless utility that must render its content "without altering
it structurally or visually", yet also requires a real `dir` attribute in the DOM. `display: contents`
is the exact reconciliation: the element is removed from the box tree, so a provider dropped inside a
flex or grid parent does not become a spurious block-level child, while `dir` still inherits to every
descendant (direction inherits through the DOM, not the box tree) and `closest()` still finds it. The
caller's `class` is merged last, so a consumer who _wants_ a real box can pass `block`/`flex` and win.
`contents` is a Tailwind v4 core utility — no arbitrary value, no custom CSS.

Accessibility note: `display: contents` on a generic `<div>` with no role and no accessible name
removes nothing from the accessibility tree (the historical Chrome/Safari bug applied to elements
with semantics, e.g. list and table roles). A test asserts the wrapper contributes no role and no
accessible name.

**Alternatives considered**:

- _Plain `<div>` with no class_ — rejected: silently breaks flex/grid parents.
- _`<svelte:fragment>` / no element_ — rejected: no DOM node means no `dir` attribute (see
  Decision 4).
- _Put `dir` on `document.documentElement` from an effect_ — rejected: global side effect, breaks
  nesting (User Story 1 case 3), and unmount ordering makes it impossible to restore correctly.

## Decision 6 — `dir` is a plain prop, not `$bindable`; "controlled vs uncontrolled" reinterpreted

**Decision**: `dir?: Direction = 'ltr'`, not `$bindable`. There is no `defaultDir` and no
`onDirChange`. Only `ref` is `$bindable`.

**Rationale**: `$bindable` and the `value`/`defaultValue`/`onValueChange` triad exist for components
that mutate their own state and must push it back to the parent. This provider never mutates `dir` —
upstream types it as a **required, plain input prop** with no change callback. Adding a binding or a
callback would be unrequested API with nothing to fire it. The prop is made *optional* (upstream has
it required) solely so FR-002's documented `@default "ltr"` is reachable, matching the upstream JSDoc
`@default` tag that the required type contradicts.

For the mandated controlled/uncontrolled test coverage this maps to: **uncontrolled** = no `dir`
passed, the component supplies `'ltr'` and every consumer reads it; **controlled** = the parent owns
`dir`, and flipping it at runtime propagates to every consumer with the component never moving on its
own. Both are tested. Recorded in the spec's Assumptions.

**Alternatives considered**:

- _`dir = $bindable('ltr')`_ — rejected: nothing writes it, so the binding is permanently one-way and
  misleads consumers into thinking the component can change direction by itself.
- _Add `onDirChange`_ — rejected: pure invention, Principle II drift.

## Decision 7 — two context accessors: a silent probe and a throwing getter

**Decision**: `hasDirectionContext()` (probe, used by `useDirection`) and `getDirectionContext()`
(throws `` `<Part>` must be used within `<DirectionProvider>`. ``). Both behind one
`Symbol('direction-provider')` key.

**Rationale**: FR-005 forbids the reader from throwing, so `useDirection` must use the probe. But
CLAUDE.md §5 and Constitution Principle III make the throwing getter the default pattern and require
its message to be covered by a test — and it is genuinely needed: this module is the shared direction
primitive (deliverable 5), and later ports will have parts that legitimately *require* a provider
rather than tolerating its absence. Shipping both, tested, satisfies both constraints without
weakening either. A `Symbol` key (not a string) prevents collisions when a consumer copies this file
next to another registry's direction utility.

**Alternatives considered**:

- _Only the probe_ — rejected: violates CLAUDE.md §5 and leaves later ports to re-invent the throw
  with an inconsistent message.
- _Only the throwing getter, caught in `useDirection`_ — rejected: `try`/`catch` around `getContext`
  is control flow by exception and cannot distinguish "no provider" from a genuine bug in the state
  class.

## Decision 8 — upstream's `direction` alias is not carried forward

**Decision**: `dir` is the only prop. Upstream's
`direction?: ...; <Primitive dir={direction ?? dir} />` alias is dropped.

**Rationale**: Already settled in the spec's Assumptions: it is an explicitly legacy
backward-compatibility alias, CLAUDE.md's translation table gives no precedent for preserving
deprecated dual-prop aliases, and a single canonical prop name is this repo's pattern. Two spellings
of one prop would also make the `Omit<HTMLAttributes, 'dir'>` typing in Decision 9 ambiguous.

## Decision 9 — `Omit<HTMLAttributes<HTMLDivElement>, 'dir'>` as the base props type

**Decision**:
`WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'dir'>, HTMLDivElement> & { dir?: Direction }`.

**Rationale**: `svelte/elements`' `HTMLAttributes` already declares `dir?: string | undefined | null`.
Intersecting it with `dir?: Direction` happens to narrow correctly today, but it is an accidental
narrowing that depends on how the two optionals intersect, and it produces confusing hover text.
Omitting first makes the declaration say what it means and guarantees a consumer cannot pass
`dir="auto"` through the type. Everything else (`id`, `class`, `aria-*`, event handlers) is still
forwarded via `...restProps`, satisfying FR-010.

**Alternatives considered**:

- _Plain intersection_ — rejected: fragile and unreadable, and the failure mode (a widened `dir`) is
  exactly what Principle VI's strictness is meant to prevent.

## Decision 10 — a `.test.svelte` harness drives the tests

**Decision**: `direction-provider.test.svelte` (a prop-driven harness) plus
`direction-provider.test.ts` (the spec), mirroring the Status port.

**Rationale**: `useDirection()` may only be called during a component's initialisation, so a `.ts`
spec cannot call it directly; nested providers, `bind:ref`, and runtime `dir` flips likewise need a
real parent component. Vitest's `include` is `src/**/*.{test,spec}.{js,ts}`, so the `.svelte` harness
is not collected as a suite, and it is excluded from the registry entry.

**Alternatives considered**:

- _`createRawSnippet` for every case_ — rejected: raw snippets render HTML strings and cannot host a
  child component that calls `useDirection()`.
- _Test the classes directly without rendering_ — kept as an *addition* for `isDirection` /
  `resolveDomDirection`, but rejected as the primary approach: `$derived`/`$effect` outside a
  component do not behave as they do inside one, so the contract must be exercised through a render.

## Decision 11 — zero new npm dependencies

**Decision**: No dependency added. `registry.json`'s `dependencies` array is `[]` and
`registryDependencies` is `[]`.

**Rationale**: The component imports only `svelte` (`setContext`/`getContext`/`hasContext`, `Snippet`),
`svelte/elements` (types) and `$lib/utils.js` (`cn`, `WithElementRef`) — all already present, and
`cn` is rewritten by `pnpm run registry:build`. `tailwind-variants` (Status's only dependency) is not
needed: one static utility class, no variants. No `bits-ui` primitive is composed, so it is not a
dependency either.

## Decision 12 — three demo sections, since upstream ships no demo files

**Decision**: `+page.svelte` gets three `<ComponentPreview>` sections — **Provider** (toggle
`ltr`/`rtl`, consumers report the resolved value), **Reading the direction** (the MDX's `useDirection`
example: a `Button` receiving `dir`), **Ambient fallback** (no provider, a `dir="rtl"` ancestor) —
followed by props and data-attribute tables in the Status page's layout.

**Rationale**: Principle IX asks for one section per upstream example. The MDX has exactly two code
blocks (Usage → `<DirectionProvider dir="ltr">`, API Reference → `useDirection()`), and there is no
`direction-provider-*-demo.tsx` anywhere in `.reference/diceui`. The third section is required by
SC-004, which demands the "ambient / fallback" behaviour be exercisable without reading source. The
consumer component lives at `src/routes/docs/components/direction-provider/direction-consumer.svelte`
so the registry component never imports from the docs app (Principle V).
