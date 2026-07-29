# Phase 0 Research: Port Swap Component

**Feature**: `005-port-swap` | **Date**: 2026-07-29 | **Upstream pin**: `d9763d82530416dfa4c81c462387b55d06bae4ec`

Sources read in full before any decision below:

- `.reference/diceui/docs/registry/bases/radix/ui/swap.tsx` (implementation)
- `.reference/diceui/docs/types/radix/swap.ts` (the documented prop contract, with JSDoc + `@default`)
- `.reference/diceui/docs/content/docs/components/radix/swap.mdx` (API reference, data attributes, keyboard table)
- `.reference/diceui/docs/registry/bases/radix/examples/swap-demo.tsx`
- `.reference/diceui/docs/registry/bases/radix/examples/swap-animations-demo.tsx`
- Local precedent: `src/lib/components/ui/status/`, `src/lib/components/ui/pending/`, `src/lib/components/ui/direction-provider/`
- `CLAUDE.md`, `.specify/memory/constitution.md`, `.agents/skills/shadcn-svelte/rules/{styling,composition,forms,icons}.md`

There were no `NEEDS CLARIFICATION` markers in `spec.md`; every decision below either resolves a React→Svelte
translation question or records a deliberate divergence required by the constitution's Principle II.

---

## D-001 — Replace the hand-rolled store with a single `SwapState` runes class

- **Decision**: Delete upstream's `Store` / `useStore` / `useSyncExternalStore` / `useLazyRef` / `useAsRef`
  machinery entirely. `swap.svelte.ts` exports one `SwapState` class whose reactive inputs arrive as getter
  functions (`getSwapped`, `setSwapped`, `getActivationMode`, `getAnimation`, `getDisabled`) and whose
  readable members are `$derived`.
- **Rationale**: The upstream store exists only because a React function component has no persistent
  instance and no fine-grained reactivity; `useSyncExternalStore` is a subscription shim for exactly that.
  Svelte 5 `$state`/`$derived` over a context-shared class instance is the native equivalent and is the
  pattern already used by `PendingState` and `DirectionProviderState` in this repo. Zero observable API
  difference.
- **Alternatives considered**: (a) literal port of the pub/sub store — rejected: dead weight, and
  `$state` already notifies; (b) a plain reactive object literal instead of a class — rejected: the repo's
  established shape is a class with a `#props!` getter bag, and a class gives the `useSwap()` return type a
  name for parity with upstream's exported `useSwap`.
- **`useMemo`/`useCallback`**: not ported at all (per the translation rules) — Svelte reactivity makes them
  unnecessary.

## D-002 — Controlled/uncontrolled via `$bindable` + `??=`, not a layout effect

- **Decision**: `swapped = $bindable()` on the root, seeded once with `swapped ??= defaultSwapped` during
  initialisation. `setSwapped(next)` short-circuits on `Object.is(current, next)`, assigns, then calls
  `onSwappedChange?.(next)`.
- **Rationale**: This is CLAUDE.md §4's stated convention and makes the component work identically bound
  (`bind:swapped`) and unbound (`defaultSwapped`). It replaces upstream's
  `useIsomorphicLayoutEffect(() => store.setState('swapped', swappedProp), [swappedProp])`, whose only job is
  to keep internal state in sync with a controlled prop — something a bindable prop does by construction.
- **Deliberate divergence (recorded in the contract)**: upstream's sync effect routes through `setState`, so a
  *parent-driven* prop change also fires `onSwappedChange`. The Svelte port fires `onSwappedChange` only when
  the component itself changes the value (user interaction). Spec FR-005 specifies exactly this ("as a result
  of user interaction"), and the React behaviour is a well-known echo artefact of the controlled-prop shim,
  not a documented feature — the MDX describes the prop as "Callback when the swapped state changes".
- **Alternatives considered**: mirroring the echo with an `$effect` that calls `onSwappedChange` whenever the
  prop changes — rejected: it would fire the consumer's callback in response to the consumer's own write
  (infinite-loop bait for anyone doing `onSwappedChange={(v) => (swapped = v)}`), and it violates the
  "never mutate reactive state in `$effect` where `$derived` will do" rule.

## D-003 — `asChild` → the `child` snippet prop

- **Decision**: Drop `asChild` (Radix `Slot`). Every part accepts `child?: Snippet<[{ props }]>`; when
  supplied, the part renders nothing itself and hands the fully merged attribute payload to the snippet.
  In `child` mode `children` is not rendered and `ref` is not populated — the caller owns the element.
- **Rationale**: Svelte has no `cloneElement`; this is already the repo-wide replacement
  (`status.svelte`, `pending.svelte`, `dialog-content.svelte`) and is what Bits UI itself does.
- **Alternatives considered**: a `tag` prop (rejected: cannot forward a consumer *component*), or omitting the
  escape hatch (rejected: upstream documents `CompositionProps` on all three parts).

## D-004 — Build the root's attributes as one `$derived` object and spread it

- **Decision**: The root computes `rootAttrs` (`role`, `aria-pressed`, `aria-disabled`, `data-*`, `tabindex`,
  `class`, and the four composed event handlers) as a single `$derived` object, then renders
  `<div bind:this={ref} {...rootAttrs}>` or hands `rootAttrs` to `child`.
- **Rationale**: Two reasons. (1) It guarantees the `child` path and the default path are byte-identical —
  the same lesson `status.svelte` already encodes. (2) Svelte's compile-time a11y analysis (`svelte-check`
  emits warnings, and `pnpm run check` must be warning-free per Principle VII) inspects statically written
  `role`/handler attributes; a div whose `role` is conditional (`"button"` in click mode, absent in hover
  mode) with a static `onclick` would trip `a11y_no_static_element_interactions`. Suppressing it with
  `svelte-ignore` is a constitution violation, so the compliant fix is to make the attribute set dynamic.
- **Alternatives considered**: `{#if isClickMode}<div role="button" …>{:else}<div …>{/if}` — rejected:
  duplicates the whole element and its `child` branch four ways, and remounts the node when
  `activationMode` changes (losing focus and any consumer state).

## D-005 — Attribute-order semantics (who wins on collision)

- **Decision**: In every part, the merge order is: component `data-*`/ARIA first → `...restProps` →
  component-computed `class` → component-composed handlers. `class` is destructured out of `restProps`, so
  the computed `cn(base, className)` always wins and the caller's classes are still merged last within it.
- **Rationale**: This is upstream's own JSX order (`data-slot=… {...rootProps} className={cn(…)}
  onClick={…}`), reproduced exactly, and it matches `status.svelte`.

## D-006 — No `bits-ui` primitive is composable here (Principle IV evidence)

- **Decision**: The root is bespoke (≈70 lines of handler composition + one state class). No `bits-ui`
  primitive is wrapped.
- **Primitives evaluated and why each is insufficient**:
  - `bits-ui` `Toggle` — models one pressable control with a single `pressed` value and renders one child.
    It has no notion of two mutually exclusive, independently styleable faces, and it hard-codes
    `role="button"`/`aria-pressed`, which Swap must *omit* in `hover` activation mode (FR-009).
  - `bits-ui` `Switch` — a form control: it renders a hidden input, participates in form submission and
    exposes `checked`/`name`/`value` with `role="switch"`. Swap is not a form control and must not submit.
  - `$lib/components/ui/toggle` (shadcn) — a styled `<button>` wrapper over the same `bits-ui` Toggle;
    same two gaps, plus a `<button>` cannot legally contain the arbitrary interactive content upstream's
    demos put inside the faces.
  - `$lib/components/ui/collapsible` / `tabs` — two-branch content switching, but with disclosure/tablist
    ARIA semantics that are wrong for a toggle icon.
  - `$lib/components/ui/direction-provider` — **is** composed (see D-008), for RTL context only.
  - `bits-ui` reduced-motion utility — none exists; `bits-ui@2.18.1`'s dist contains no
    `prefers-reduced-motion`, `ReducedMotion` or `MediaQuery` export (verified by grep). See D-007.
- **Rationale**: Principle IV requires the written justification, not the avoidance of bespoke code, when no
  primitive covers the behaviour.

## D-007 — `prefers-reduced-motion`: keep upstream's `motion-reduce:` utilities **and** add a runtime reader

- **Decision**: Two layers, both shipped.
  1. **Parity layer** — `SwapOn`/`SwapOff` keep upstream's `motion-reduce:` Tailwind variants verbatim
     (`motion-reduce:transition-none` plus the three per-animation transform neutralisers). This is the
     no-JS/pre-hydration guarantee and is byte-compatible with upstream.
  2. **Runtime layer** — a small `useReducedMotion()` reader in `swap.svelte.ts` reads
     `window.matchMedia('(prefers-reduced-motion: reduce)')` eagerly at initialisation and subscribes to its
     `change` event inside an `$effect` that returns a teardown. When it reports `true`, the root emits
     `data-motion="reduce"` and the two faces omit the `transition-all duration-300` utilities entirely.
- **Rationale**: The spec (FR-012, SC-004) and the feature request both require an *asserting test*. jsdom
  applies no CSS, so a media-query-only mechanism can be asserted only as a literal class string — which
  proves nothing about behaviour and silently rots. Driving the transition classes from an observable boolean
  makes the guarantee real (no transition is emitted at all, even if a consumer's own CSS defeats the
  `motion-reduce:` variant) and makes it testable by stubbing `matchMedia`. Keeping layer 1 means the port is
  never *worse* than upstream, including with JS disabled.
- **Divergence recorded**: `data-motion="reduce"` is additive — it does not exist upstream. It is documented
  in the contract, the demo page's data-attribute table, and `spec.md`'s Assumptions (which already sanction
  reproducing the guarantee with this project's own tooling). No upstream attribute is renamed or removed.
- **Alternatives considered**: (a) class-string assertion only — rejected, tests the source not the
  behaviour; (b) drop the `motion-reduce:` variants and rely solely on JS — rejected, loses the SSR/no-JS
  guarantee and diverges from upstream's shipped class strings; (c) a global media-query store — rejected,
  registry items must be self-contained (Principle V).
- **Reuse**: `useReducedMotion` / `ReducedMotionReader` are exported from `swap.svelte.ts` **and** the barrel,
  so a later port can import them (deliverable 5). They live in the swap folder rather than a new
  `src/lib/hooks/` tree because the repo has no hooks tree and Principle V puts registry files under
  `src/lib/components/ui/<slug>/`; promoting them is a one-line move if a second consumer appears.

## D-008 — RTL

- **Decision**: No directional inversion of behaviour. The demo page and the test suite exercise the
  component inside `dir="rtl"` and inside `<DirectionProvider dir="rtl">` and assert that click, hover and
  keyboard produce the *identical* `data-state` transitions as in LTR.
- **Rationale**: Swap is a single element with two overlaid children — there is no left/right axis to invert
  (unlike a horizontally navigable list). Constitution Principle III's "horizontal navigation MUST invert
  under `dir='rtl'`" has no horizontal navigation to apply to here; the honest discharge of that obligation
  is a regression test proving RTL context changes nothing, which is what spec.md's Edge Cases require.
- **Alternatives considered**: mirroring the `rotate`/`flip` transforms under RTL — rejected: upstream does
  not, and it would make a sun/moon toggle spin the wrong way relative to its own documentation.

## D-009 — `aria-disabled` mapping

- **Decision**: `aria-disabled={disabled ? 'true' : undefined}`.
- **Rationale**: Upstream declares `disabled?: boolean` with no React default, so `aria-disabled` is absent
  by default and renders `"true"` when set. Our prop type documents `@default false` (as upstream's
  `types/radix/swap.ts` does), and mapping `false → undefined` reproduces the rendered DOM exactly. Note the
  root is *not* removed from the accessibility tree and is *not* given the native `disabled` attribute — a
  `div` has none; `aria-disabled` plus the removal of `tabindex` is the WAI-ARIA-correct expression, and it
  is what upstream does.

## D-010 — Event handler composition

- **Decision**: `onclick`, `onmouseenter`, `onmouseleave` and `onkeydown` are destructured out of the root's
  props (they are typed members of `HTMLAttributes<HTMLDivElement>`) and re-composed: the consumer's handler
  runs first; if it returns with `event.defaultPrevented === true`, the built-in behaviour is skipped.
- **Rationale**: Exact upstream semantics (FR-014). It cannot be achieved by letting `restProps` supply the
  handler, because the last-written handler would simply replace the other.
- **Keyboard**: `Enter` and `Space` (`event.key === ' '`) call `event.preventDefault()` before toggling, in
  `click` mode only, and only when not disabled — suppressing the page scroll `Space` would otherwise cause.
  These are the only two keys the MDX documents.

## D-011 — No new npm dependencies

- **Decision**: Zero. `cn()` from `$lib/utils.js` covers all styling; `tv()`/`tailwind-variants` is **not**
  needed because upstream expresses the four `animation` values as ancestor-scoped
  `[*[data-animation=…]_&]` selectors on the faces, not as root class variants. Icons in the demo page come
  from `@lucide/svelte` (already a dependency, and `components.json`'s configured icon library).
- **Rationale**: Upstream's only runtime dependency for this component is `radix-ui` (for `Slot`), which
  D-003 removes.

## D-012 — Test harness component

- **Decision**: Behaviour that a `.ts` spec cannot express — `bind:swapped`, `bind:ref`, and
  `{#snippet child({ props })}` — goes through `swap.test.svelte`, a harness that is **not** collected by
  Vitest (`include` is `.{js,ts}`) and **not** listed in `registry.json`.
- **Rationale**: Established precedent in `status.test.svelte`, `pending.test.svelte`,
  `direction-provider.test.svelte`.
