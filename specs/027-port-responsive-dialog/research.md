# Phase 0 Research — Responsive Dialog

All unknowns in the Technical Context are resolved below. Findings R-04 and R-05 come from a
throw-away jsdom spike (a temporary harness rendering `Dialog`/`Drawer` behind an `{#if}` plus a
Vitest file) that was run and then deleted; its observations are reproduced verbatim so the
implementation phase does not have to rediscover them.

---

## R-01 — How to port `useIsMobile`

**Decision**: `src/lib/hooks/is-mobile.svelte.ts` exporting `DEFAULT_MOBILE_BREAKPOINT = 768`, a
class `IsMobile` with a `current: boolean` `$state` field, and `useIsMobile(getBreakpoint?)`. The
class reads `window.matchMedia('(max-width: ${breakpoint - 1}px)').matches` inside an `$effect` that
also registers the `change` listener and returns `() => query.removeEventListener('change', onChange)`.
`current` is seeded to `false` so SSR and the pre-effect first paint render dialog mode.

**Rationale**:

- The query string is copied verbatim from upstream (`(max-width: ${mobileBreakpoint - 1}px)`).
- Upstream reads `window.innerWidth < breakpoint` inside the handler while listening on the MQL.
  Reading `query.matches` instead is arithmetically identical for integer widths
  (`width <= bp - 1` ⇔ `width < bp`), removes the second source of truth, and — decisively — makes
  the primitive drivable from a test by stubbing `matchMedia`, which `window.innerWidth` is not.
  Recorded as divergence **D-04** in the spec Assumptions.
- Seeding `false` matches upstream's `!!undefined` before its effect runs, so there is no parity gap.
- The repo already has this exact shape in `src/lib/components/ui/swap/swap.svelte.ts`
  (`ReducedMotionReader` / `useReducedMotion`), including the `typeof window === 'undefined' ||
  typeof window.matchMedia !== 'function'` guard. The new module follows it line for line.

**Alternatives considered**:

- `runed`'s `MediaQuery` — not a project dependency; adding it violates the zero-new-dependency
  constraint for a 25-line primitive.
- A `bits-ui` media primitive — none exists; `bits-ui` exposes no viewport/media API.
- Inlining the logic in `responsive-dialog.svelte.ts` — rejected by FR-007, which requires a
  standalone reusable primitive.
- A generic `MediaQuery(queryString)` class — rejected as unrequested generality; `useIsMobile` is
  the upstream API and is what FR-007 asks for.

**Placement**: `$lib/hooks` is already declared in `components.json` (`"hooks": "$lib/hooks"`) and
`registry:hook` is a type `shadcn-svelte` understands (verified in
`node_modules/shadcn-svelte/dist/schema-*.mjs`). The file therefore ships as a `registry:hook` entry
inside the single `responsive-dialog` `registry:ui` item, satisfying both FR-007 ("any component can
reuse it") and Principle V ("exactly one `registry:ui` entry per port"). The directory
`src/lib/hooks/` does not exist yet and is created by this feature.

---

## R-02 — Replacing upstream's `Store` / `useSyncExternalStore`

**Decision**: One `ResponsiveDialogState` class published on a `Symbol('responsive-dialog')` context
key. `open` is a controlled/uncontrolled pair driven by getter/setter functions passed from the root;
`variant` is `$derived(isMobile.current ? 'drawer' : 'dialog')`.

**Rationale**: Upstream's store exists to feed React's `useSyncExternalStore` without tearing under
concurrent rendering, and `useLazyRef`/`useAsRef`/`useIsomorphicLayoutEffect` exist to keep that
store stable across renders. Svelte's `$state`/`$derived` are synchronous and fine-grained, so the
entire abstraction collapses to two reactive fields. Already recorded in the spec Assumptions; the
public API is unchanged, only the implementation differs.

**Alternatives considered**: a literal port of the pub/sub store (dead code in Svelte — nothing would
subscribe); Svelte 4 stores (forbidden by Principle I).

---

## R-03 — Preventing a spurious close during the primitive swap

**Decision**: Do **not** use `bind:open` on the two roots. Pass `open={state.open}` plus
`onOpenChange={(next) => state.setOpen(next, 'dialog' | 'drawer')}`, and have `setOpen` return early
when `from !== state.variant` or when `next === state.open`.

**Rationale**: The `{#if}` swap destroys one root and creates the other. A teardown-time
`onOpenChange(false)` from the dying branch would close a dialog the user never closed (FR-008) and
would fire `onOpenChange` for a non-transition (spec edge case). Tagging the callback with the branch
that owns it makes the filter deterministic and needs no timers or flags. The `next === open`
short-circuit mirrors upstream's `Object.is(stateRef.current[key], value)` guard.

**Alternatives considered**: a boolean "swapping" flag toggled around the mode change (racy — the
teardown callback may arrive after the flag is cleared); `bind:open` with a `$effect` re-asserting
the previous value (fights the binding, and would re-open a dialog the user genuinely closed).

---

## R-04 — Focus after crossing the breakpoint while open (SC-004 / FR-008)

**Finding (spike, jsdom)**:

| Scenario                                              | `document.activeElement`                  |
| ----------------------------------------------------- | ----------------------------------------- |
| Dialog opened by clicking the trigger                 | `[data-slot="dialog-content"]` ✅          |
| Drawer opened by clicking the trigger                 | `[data-slot="drawer-trigger"]` (unmoved)  |
| Mounted with `open` already `true`, then branch swapped | `<body>` ❌                              |
| `Escape` in drawer mode                               | back on the trigger ✅                     |

**Decision**: Implement focus restoration in `responsive-dialog-content.svelte`. The state class
records a mode transition that happens while `open` is `true`
(`pendingFocusRestore`, set from an `$effect` in the root that compares the current `variant` against
a non-reactive `#lastVariant` field inside `untrack`). On mount, `Content`'s `$effect` calls
`state.consumeFocusRestore()`; when it returns `true` it focuses the first focusable descendant of
the content element, falling back to the content element itself with `tabIndex = -1`.

**Rationale**: Neither primitive treats "mounted while already open" as an open transition, so
neither runs its focus scope; `vaul-svelte`'s `autoFocus` root prop defaults to `false` and does not
help. This is the one behaviour no available primitive covers (justified under Principle IV in
`plan.md`).

**Alternatives considered**: forcing `autoFocus` on `Drawer.Root` (changes ordinary open behaviour
and still does nothing for the dialog→drawer direction); calling `onOpenAutoFocus` manually (a
`bits-ui`-only hook with no `vaul-svelte` counterpart); accepting focus on `<body>` (fails FR-008
and SC-004 outright).

---

## R-05 — jsdom side effects of the two scroll-lock layers

**Finding (spike)**: after a `Dialog` test, `document.body` keeps
`pointer-events: none; overflow: hidden; padding-right: …`. A following test that clicks a trigger
fails with *"Unable to perform pointer interaction as the element has `pointer-events: none`"*. The
`padding-right` value also accumulates across a swap (jsdom reports
`window.innerWidth - documentElement.clientWidth === 1024`, so every lock adds 1024px).

**Decision**: `responsive-dialog.test.ts` gets a local `afterEach` resetting
`document.body.style.pointerEvents`, `.overflow`, `.paddingRight` and `.marginRight`. Tests assert
open state, roles, variant attributes and focus — **not** body styles, which are a jsdom artefact of
`documentElement.clientWidth === 0`.

**Rationale**: This is test-file hygiene inside the feature's own file. It touches neither
`tests/setup.ts` nor any config, so it is not a Principle VI/VII suppression. Editing the shared
setup would silently change 26 already-green component test files and is out of scope.

**Also observed**: `[svelte] derived_inert` warnings on stderr during teardown, emitted from
`bits-ui`/`vaul-svelte` internals as the branch is destroyed. They are warnings, not failures, and
do not affect the gate.

---

## R-06 — Typing parts that forward to two different components

**Decision**:

- Trigger, Close, Title, Description, Portal → a **single** `bits-ui` type. Verified in
  `node_modules/vaul-svelte/dist/components/drawer/types.d.ts`: `vaul-svelte` re-exports
  `DialogTriggerProps`, `DialogCloseProps`, `DialogTitleProps`, `DialogDescriptionProps` and
  `DialogPortalProps` from `bits-ui` unchanged, so both branches accept exactly the same props —
  including the `child` snippet that replaces upstream's `asChild`.
- Overlay, Content, Root → `ComponentProps<typeof Dialog.X> & ComponentProps<typeof Drawer.X>`. An
  intersection is assignable to each side, so `{...restProps}` type-checks in both branches, and
  props that exist on only one side (e.g. `showCloseButton`, `direction`) stay optional.
- Header, Footer → plain `WithElementRef<HTMLAttributes<HTMLDivElement>>`; both underlying parts are
  simple `div`s with that exact signature.

**Rationale**: No `any`, no casts, no duplicated prop documentation. Props handled explicitly
(`class`, `showCloseButton`, `portalProps`, `children`, `ref`) are destructured out so they are never
forwarded to a branch that does not understand them.

**Fallback if `svelte-check` rejects a spread**: destructure the offending prop explicitly and pass
it only inside the branch that accepts it (the pattern upstream already uses for
`ResponsiveDialogFooter`'s `showCloseButton`). No suppression is permitted.

---

## R-07 — `data-slot` vs the underlying component's own slot

**Decision**: Each part passes `data-slot="responsive-dialog-<part>"`, overriding the underlying
`data-slot="dialog-content"` / `"drawer-content"`.

**Rationale**: Principle VIII requires `data-slot="<slug>-<part>"` on every part. In every
`Dialog.*`/`Drawer.*` file in this repo the local `data-slot` is written **before** `{...restProps}`,
so a caller-supplied `data-slot` wins — verified by reading all 20 part files. `data-variant` is set
the same way and is what the upstream MDX documents for styling
(`data-[variant=drawer]:` / `data-[variant=dialog]:`).

---

## R-08 — What the demo page must contain

**Decision**: four `<ComponentPreview>` sections:

1. **Default** — mirrors `responsive-dialog-demo.tsx` (edit-profile form with `Label` + `Input`).
2. **Confirmation Dialog** — mirrors `responsive-dialog-confirm-demo.tsx`, including the async
   pending state; the upstream `<Loader2 className="animate-spin" />` becomes `<Spinner />` from
   `$lib/components/ui/spinner`, per the composition rule "Button has no isPending prop".
3. **Variant Styling** — the MDX Examples section's code-only example, made live
   (`class="data-[variant=drawer]:pb-8 data-[variant=dialog]:max-w-md"`).
4. **Controlled** — Svelte-specific `bind:open`, proving the `$bindable` contract from §8 of
   `CLAUDE.md`.

Plus props tables (one `Table` per exported part group) following the pattern already used by
`src/routes/docs/components/key-value/+page.svelte`.

**Rationale**: Constitution IX requires one preview per upstream demo file (items 1–2); items 3–4
cover the remaining documented example and the Svelte binding contract. Upstream's `asChild` on the
trigger becomes the `child` snippet in both demos.
