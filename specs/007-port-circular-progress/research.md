# Phase 0 Research — Circular Progress port

**Feature**: `007-port-circular-progress` | **Date**: 2026-07-29

Upstream read at the pinned commit `d9763d82530416dfa4c81c462387b55d06bae4ec`:

- `.reference/diceui/docs/registry/bases/radix/ui/circular-progress.tsx` (358 lines — the implementation)
- `.reference/diceui/docs/content/docs/components/radix/circular-progress.mdx` (the API contract)
- `.reference/diceui/docs/types/radix/circular-progress.ts` (the documented prop JSDoc)
- `.reference/diceui/docs/registry/bases/radix/examples/circular-progress-demo.tsx`
- `.reference/diceui/docs/registry/bases/radix/examples/circular-progress-interactive-demo.tsx`
- `.reference/diceui/docs/registry/bases/radix/examples/circular-progress-colors-demo.tsx`

No upstream test file exists for this component (neither `packages/*/test` nor
`docs/registry/bases/radix/test` contains a `circular-progress` spec), so the assertion floor is derived
from the MDX data-attribute tables and the source itself rather than ported from an existing suite.

Conventions cross-checked against three already-ported components: `swap` (state class + `Symbol`
context + `useReducedMotion`), `stat` (multi-part folder, barrel shape, `.test.svelte` harness) and
`color-swatch` (`child` snippet, docs props table, RTL test).

No `[NEEDS CLARIFICATION]` markers remain in spec.md; every decision below is resolved.

---

## R-01 — Root element: bespoke, not `bits-ui` `Progress.Root`

**Decision**: Write the root by hand as a plain `div` with derived attributes.

**Rationale**: `Progress.Root` (`node_modules/bits-ui/dist/bits/progress/progress.svelte.js` +
`components/progress.svelte`) is the closest primitive and is genuinely close — it emits
`role="progressbar"`, `aria-valuemin/max`, omits `aria-valuenow` when `value === null`, and exposes
`data-value`/`data-min`/`data-max`. It still cannot be used:

1. `getProgressDataState` returns `"loaded"` for a completed bar; upstream Dice UI and FR-005 require
   `"complete"`. The component computes `mergedProps = mergeProps(restProps, rootState.props)` — its own
   props are merged **last** — so a caller cannot override `data-state`.
2. No `aria-valuetext`, no `getValueText` hook, no `data-percentage`.
3. No clamping and no `max`/`min` validation; an out-of-range `value` reaches `aria-valuenow` unchanged,
   which breaks FR-007/FR-008.
4. It renders `value={number}` as a literal attribute on the `div`, which is not in the upstream DOM
   contract.

**Alternatives considered**: (a) wrapping `Progress.Root` and post-patching `data-state` via an
`$effect` on the ref — rejected: an effect that fights a primitive's own derivation is exactly the
liability Principle I and IV warn about; (b) using the installed `src/lib/components/ui/progress` — it is
a linear bar built on the same primitive and adds a hard-coded indicator `div`.

## R-02 — Reactive logic placement

**Decision**: All pure math lives in exported standalone functions in `circular-progress.svelte.ts`; a
`CircularProgressState` class wraps them as `$derived` members and is what goes on the context. The root
component holds no derived state of its own beyond the two generated ids.

**Rationale**: Matches `swap.svelte.ts` (state class taking getter functions, `Symbol` key, throwing
getter). Splitting the pure functions out separately makes the `max === min` branch of
`getDefaultValueText` — unreachable through the component once FR-008 forces `max > min` — directly
testable, and makes the helpers reusable by later ports (deliverable 5).

**Alternatives considered**: putting everything inline in `circular-progress.svelte` as `$derived`
statements — rejected: five parts consume the values, so they must be on context anyway, and CLAUDE.md §4
puts non-markup reactive logic in the `.svelte.ts` module.

## R-03 — Typing the SVG parts

**Decision**: `Indicator` uses `SVGAttributes<SVGSVGElement> & { ref?: SVGSVGElement | null }`; `Track`
and `Range` use `SVGAttributes<SVGCircleElement> & { ref?: SVGCircleElement | null }`.

**Rationale**: `WithElementRef<T, U extends HTMLElement>` in `src/lib/utils.ts` constrains `U` to
`HTMLElement`. `SVGSVGElement`/`SVGCircleElement` extend `Element`, not `HTMLElement`, so `WithElementRef`
cannot express them — using it would require a cast, and casts to satisfy a helper are exactly what
Principle VI forbids. `svelte/elements` exports `SVGAttributes<T>` (line 1535) with kebab-case attribute
keys (`'stroke-width'`, `'stroke-dashoffset'`, `'vector-effect'`) and a `class?: ClassValue`, which is
what the markup needs anyway.

**Alternatives considered**: widening `WithElementRef`'s constraint to `Element` in `src/lib/utils.ts` —
rejected: `utils.ts` is shared by every already-shipped component and changing its public type signature
is out of scope for one port.

## R-04 — No controlled/uncontrolled pair; no `onValueChange`

**Decision**: `value` is a plain (non-`$bindable`) prop. There is no `defaultValue` and no
`onValueChange`.

**Rationale**: Upstream `CircularProgress` holds no state — it is a pure function of its props, and the
demos drive `value` from the parent. Adding `defaultValue`/`onValueChange`/`$bindable` would be invented
API (Principle II forbids drift in either direction), and a `$bindable` the component never writes to
would advertise two-way binding that can never fire. The constitution's "uncontrolled `defaultValue` /
controlled `value` + `onValueChange`" test requirement is scoped to components that have those props; here
the equivalent coverage is (a) value absent ⇒ indeterminate, (b) `rerender` of `value` ⇒ DOM follows, and
(c) the component never mutates a caller-owned value.

**Alternatives considered**: adding `bind:value` for symmetry with other ports — rejected as above.

## R-05 — `asChild` → `child` snippet, on `Root` and `ValueText` only

**Decision**: Add a `child?: Snippet<[{ props: … }]>` prop to exactly the two parts that declare
`asChild` upstream (`CircularProgressProps.asChild`, `CircularProgressValueTextProps.asChild`). In `child`
mode the snippet receives the merged attribute payload, `children` (and, on the root, the `label`
element) are not rendered, and `ref` stays `null`.

**Rationale**: CLAUDE.md §10 maps `asChild`/`Slot` to the `child` snippet, and `pending.svelte` /
`color-swatch.svelte` already ship this exact shape including the "`ref` stays `null` in `child` mode"
documentation. `Indicator`/`Track`/`Range` have no `asChild` upstream and get none here.

**Alternatives considered**: a generic `as` prop — rejected: no precedent in this repo and no upstream
equivalent.

## R-06 — `React.useId()` → `$props.id()`

**Decision**: `const uid = $props.id();` in the root, with `labelId = `${uid}-label`` and
`valueTextId = `${uid}-value-text``. `valueTextId` is published on the context; `ValueText` renders it as
its `id`, and the root points `aria-describedby` at it when a value text exists.

**Rationale**: `$props.id()` is SSR-safe and hydration-stable, and `pending.svelte` already uses it for
the same purpose. Deriving both ids from one `uid` keeps them stable and readable in test output. Note
the upstream ordering quirk that is preserved: `aria-describedby` is set from `valueText` being defined,
so it is present in the determinate state even if the consumer never renders a `ValueText` — that is
upstream behaviour and is reproduced verbatim.

**Alternatives considered**: `crypto.randomUUID()` — rejected (not SSR-stable); bits-ui's `createId` —
rejected (unnecessary dependency surface for a plain string).

## R-07 — Indeterminate spin animation delivered as component-scoped CSS

**Decision**: `circular-progress-range.svelte` carries a `<style>` block declaring
`@keyframes spin-around { 0% { transform: rotate(-90deg) } 100% { transform: rotate(270deg) } }`, applied
via `circle[data-state='indeterminate'] { animation: spin-around 0.8s linear infinite }` and disabled
inside `@media (prefers-reduced-motion: reduce)`.

**Rationale**: Upstream requires the consumer to paste `--animate-spin-around` and its keyframes into
`globals.css`; `src/app.css` declares no `@keyframes` at all today and spec §Assumptions ("Animation
delivery") fixes this port to be self-contained. Svelte hashes `@keyframes` names declared in a component
`<style>` and rewrites the `animation` shorthand in the same block, so the keyframes and the rule must be
colocated — a Tailwind arbitrary utility such as `[animation:spin-around_0.8s_linear_infinite]` would
reference the *unhashed* name from a global stylesheet and silently never match. The `@media` block is the
exact semantics of upstream's `motion-reduce:animate-none motion-safe:[animation:…]` pair.

**Consequence for tests**: jsdom does not compute animations, so the assertion for FR-014 is the
observable DOM contract — `data-state="indeterminate"` on the range and
`stroke-dashoffset === circumference * 0.75` — not a class name. This refines spec User Story 2's
"carries the spinning animation class" to the equivalent, actually-observable attribute; the styling hook
consumers use is `[data-state='indeterminate']`, which is also what the component's own rule targets.

**Alternatives considered**: adding `--animate-spin-around` to `@theme` in `src/app.css` — rejected by
spec §Assumptions (registry consumers would have to hand-edit their global CSS, which no other component
in this repo requires); `tw-animate-css`'s `animate-spin` — rejected: it rotates 0→360°, not −90→270°, so
the indeterminate arc would start at the wrong angle relative to the `-rotate-90` indicator.

## R-08 — Dev-only validation warnings

**Decision**: Keep upstream's three diagnostics (`invalid max`, `thickness >= size`, `invalid value`)
behind `import.meta.env.DEV`, with upstream's message strings preserved verbatim.

**Rationale**: Spec §Assumptions keeps them as a debugging aid and excludes them from the test surface.
`import.meta.env.DEV` is the Vite equivalent of `process.env.NODE_ENV !== "production"` and is tree-shaken
out of consumer production builds. ESLint's flat config here enables no `no-console` rule, so no
suppression is needed. Tests that deliberately pass invalid props silence the output with
`vi.spyOn(console, 'error').mockImplementation(() => {})` so the run stays readable.

**Alternatives considered**: dropping the warnings — rejected: they are upstream behaviour and cost
nothing; throwing instead — rejected: upstream clamps and continues.

## R-09 — Attribute emission for absent values

**Decision**: Emit `data-value`, `data-percentage`, `aria-valuenow` and `aria-valuetext` as `undefined`
when indeterminate.

**Rationale**: Svelte removes an attribute whose value is `null` or `undefined`, matching React's
behaviour for the same expressions (`value ?? undefined`, `getIsValidNumber(value) ? value : undefined`).
`data-percentage` in React receives `null` when indeterminate, which React also omits — Svelte does the
same, so the DOM output is identical. This is the mechanism behind FR-004 and is asserted with
`expect(root).not.toHaveAttribute('aria-valuenow')`.

## R-10 — Attribute/spread ordering

**Decision**: Emit the component's own attributes first, then `{...restProps}`, then the `class` computed
by `cn(defaults, className)`.

**Rationale**: This is upstream's exact JSX ordering (`…own attrs… {...rootProps} className={cn(...)}`),
so a caller can override `role`/`data-*` through `restProps` in both libraries, while `class` is always
merged rather than replaced (Constitution VIII). It is also the ordering CLAUDE.md §4/§6 prescribes.

## R-11 — Colors demo without `motion/react`

**Decision**: Reproduce the eight-theme grid at a static `value={75}`, dropping the in-view spring
animation and the `useInView`/`useSpring`/`useMotionValue` machinery. Replace upstream's raw palette
classes with the project's semantic tokens (`primary`, `success`, `warning`, `destructive`, `info`,
`muted-foreground`, plus `secondary` and `accent-foreground` to reach eight distinct swatches).

**Rationale**: `motion` is not a dependency and the plan mandates zero new npm dependencies; the animation
is demo chrome, and `75` is the value the spring settles on, so the theming demonstration — the actual
point of the example — is intact. Constitution VIII forbids raw palette colours anywhere in this repo,
docs routes included.

**Alternatives considered**: re-implementing the spring with Svelte's `svelte/motion` `Spring` — viable
and dependency-free, but it adds moving parts to a demo whose subject is colour; deferred as unnecessary.
If a future task wants it, `Spring` from `svelte/motion` is the drop-in.

## R-12 — Shared exports for later ports

**Decision**: Export the pure helpers and the `ProgressState` type from the barrel rather than creating a
separate `src/lib/components/ui/progress-shared/` module.

**Rationale**: A separate shared folder would need its own registry entry and would make every future
consumer of `circular-progress` install two items. Keeping the helpers in
`circular-progress.svelte.ts` and re-exporting them from `index.ts` means a later port (`gauge`,
`angle-slider`, `file-upload`'s circular variant) either imports
`$lib/components/ui/circular-progress/index.js` and adds `"circular-progress"` to its
`registryDependencies`, or copies the four lines of arithmetic. Both are cheaper than a third registry
item. Revisit if a second component actually needs them.

---

## Resolved geometry reference (used by the tests)

| `size` | `thickness` | `radius` | `center` | `circumference` |
| ------ | ----------- | -------- | -------- | --------------- |
| 48     | 4           | 22       | 24       | 138.230…        |
| 60     | 4           | 28       | 30       | 175.929…        |
| 80     | 6           | 37       | 40       | 232.478…        |
| 8      | 12          | 0        | 4        | 0               |

`radius = Math.max(0, (size - thickness) / 2)`, `center = size / 2`, `circumference = 2 * Math.PI * radius`.
