# Phase 0 Research: Pending Utility

**Feature**: `003-port-pending` | **Date**: 2026-07-29

All Technical Context fields were resolvable from the repository and the pinned upstream copy; no
`NEEDS CLARIFICATION` marker survives into `plan.md`. The open questions were design questions, not
unknowns, and each is resolved below.

Sources read at pin `d9763d82530416dfa4c81c462387b55d06bae4ec`:
`docs/registry/bases/radix/components/pending.tsx`, `docs/registry/bases/base/components/pending.tsx`
(cross-check), `docs/types/radix/pending.ts`,
`docs/content/docs/utilities/radix/pending.mdx`, and all five
`docs/registry/bases/radix/examples/pending-*-demo.tsx`. Repo references read:
`src/lib/components/ui/status/*` (the `child`-snippet precedent),
`src/lib/components/ui/direction-provider/*` (the `.svelte.ts` + harness precedent),
`src/lib/components/ui/switch/switch.svelte`, `src/lib/components/ui/spinner/spinner.svelte`,
`CLAUDE.md`, `.specify/memory/constitution.md`, and
`.agents/skills/shadcn-svelte/rules/{styling,composition,forms,icons}.md`.

---

## R1 — How does the React hook become Svelte?

**Decision**: A plain exported function `usePending(options?: UsePendingOptions): PendingState` in
`pending.svelte.ts`, returning an instance of a `PendingState` class whose members are `$derived` /
`$derived.by`. Reactive inputs arrive as getter functions (`isPending: () => boolean | undefined`).

**Rationale**: `.svelte.ts` modules may use runes (CLAUDE.md §4), and a class is the repo's
established landing site for a React hook (`DirectionReader` in `direction-provider.svelte.ts`).
Getter functions are mandatory — a value captured in the constructor is a snapshot and would never
update. `React.useMemo` is dropped outright: `$derived` already caches and invalidates.

**Alternatives considered**: (a) a function returning a plain object — the object would be a
one-time snapshot, breaking reactivity; (b) returning individual getters in an object literal —
works, but diverges from the repo's class convention and types worse; (c) a `$state`-based store
updated by `$effect` — forbidden by the brief ("never mutate reactive state inside `$effect` where
`$derived` would do").

---

## R2 — How is the Radix `Slot` wrapper translated?

**Decision**: The `child` snippet is the primary surface —
`{#snippet child({ props })}<Button {...props}>…</Button>{/snippet}` — and it adds **no** DOM node.
A `children` fallback renders `<span data-slot="pending" class={cn('contents', className)}>`.

**Rationale**: CLAUDE.md §10 maps `asChild`/`Slot`/`cloneElement` to the `child` snippet, and
`status.svelte` already ships that exact shape in this repo. Decisively, upstream's own Base UI
variant of the same file implements `Pending` with `useRender({ props, render, state: { slot: "pending" } })`
— a render prop, i.e. the same "hand the merged props to the caller" contract as a Svelte snippet,
and the source of the `data-slot="pending"` value. Svelte has no `React.Children` inspection
(CLAUDE.md §10), so a child cannot be cloned; the snippet is the only faithful translation.

**Alternatives considered**: (a) walk `ref.firstElementChild` in an `$effect` and imperatively set
attributes and listeners — a genuine no-extra-node Slot, but it mutates DOM the framework owns,
breaks on conditional children, and cannot be typed; rejected; (b) `child`-only with no `children`
fallback — simpler, but the spec's Assumptions section commits to offering both; (c) a `<div>`
fallback — rejected, see R3.

---

## R3 — What element does the `children` fallback render, and how does it prevent interaction?

**Decision**: `<span class="contents">` carrying the same id/ARIA/data attributes, plus
**capture-phase** handlers (`onclickcapture`, `onpointerdowncapture`, `onpointerupcapture`,
`onmousedowncapture`, `onmouseupcapture`, `onkeydowncapture`, `onkeyupcapture`) that call
`preventDefault()` and `stopPropagation()` while pending. These are built inside `pending.svelte`
and are **not** part of the exported `PendingAttributes`.

**Rationale**: `display: contents` removes the box from layout, so the fallback is visually and
structurally inert; `<span>` (phrasing content) is legal wherever a button, anchor or switch is
legal, whereas `<div>` is not. Capture phase + `stopPropagation()` is what makes the fallback
behaviourally *equivalent* to the `child` path (spec FR-008): the descendant never receives the
event, exactly as spreading `pendingProps` last replaces the descendant's handler. Bubble-phase
handlers would prevent browser defaults but let the child's own handler run first — the semantics of
upstream's Slot, but not what FR-004 demands.

**Divergence to document**: in `children` mode the id and ARIA attributes sit on the wrapper, not on
the interactive element. That is why `child` is the documented, FR-002-conformant path and is used
by four of the five demo sections.

**Alternatives considered**: bubble-phase handlers only (fails FR-004); a `<div>` (invalid nesting);
no fallback at all (contradicts the spec's Assumptions).

---

## R4 — Which spread order, and why must absent keys be omitted?

**Decision**: `{ ...restProps, class, ...pendingProps }` — `pendingProps` last, mirroring
`<Slot {...props} {...pendingProps} />` and the base variant's `{ ...props, ...pendingProps }`. Keys
that do not apply are **omitted from the object**, never present with an `undefined` value.

**Rationale**: The MDX states the rule for consumers explicitly ("spread `pendingProps` last to
ensure event prevention works"). The omission rule is the other half of it: when `isPending` is
false, `pendingProps` must not carry `onclick: undefined`, or a last-position spread would erase the
consumer's own handler and the element would be dead even when idle. Upstream gets this for free by
only assigning the keys inside `if (isPending)`; the port must do the same.

**Verified for bits-ui composition**: `svelte-toolbelt`'s `composeHandlers` (used by every bits-ui
component through `mergeProps`) runs `restProps` handlers first and returns early when
`event.defaultPrevented` is set. So spreading `pendingProps` onto `<Switch>` suppresses bits-ui's
internal toggle — the Switch demo works without any bits-ui-specific code.

---

## R5 — Where does the auto-generated id come from?

**Decision**: `pending.svelte` defaults its `id` prop to `$props.id()`. Bare `usePending()` calls
fall back to a module-scoped counter, `createPendingId()` → `pending-1`, `pending-2`, … Both follow
upstream's `id || instanceId`, so an explicitly passed empty string still falls back.

**Rationale**: `$props.id()` is Svelte's hydration-stable `useId` equivalent (confirmed present in
Svelte 5.56) but is a component-only rune — it cannot be compiled inside a `.svelte.ts` module, so
the hook surface needs its own generator. `bits-ui` does not re-export a `useId` helper from its
single `.` entry point (checked), so nothing can be composed here.

**Consequence to document**: counter-generated ids are not guaranteed to match across SSR and
hydration. Nothing in the component references the id, so the practical impact is nil, but the JSDoc
and the docs page will recommend passing an explicit id (or `$props.id()`) whenever another element
points at it via `for` / `aria-labelledby` / `aria-describedby`.

**Alternatives considered**: `crypto.randomUUID()` (same hydration property, uglier ids, and needs a
runtime guard); omitting the id when none is supplied (violates FR-007).

---

## R6 — `data-pending` value: `"true"` or `""`?

**Decision**: `''` when set, attribute entirely absent otherwise.

**Rationale**: Constitution VIII mandates `cond ? '' : undefined` for boolean data attributes, and
bits-ui's own `boolToEmptyStrOrUndef` produces the same shape across every primitive in this repo.
The upstream MDX documents the value as `"true"`, but the *selector* behaviour it exists for —
`[data-pending]`, and Tailwind v4's `data-pending:` shorthand used by `pending-switch-demo.tsx` — is
identical for `""`. FR-005 constrains only presence/absence. Recorded as divergence D3.

---

## R7 — Is any `$effect` needed?

**Decision**: No. The component registers no document listener, no observer and no timer; all state
is derivation from props. There is therefore nothing to tear down.

**Rationale**: CLAUDE.md §4 requires every effect to return a cleanup; the cleanest way to satisfy
that is to have no effect at all. The demo page *does* use `setTimeout` to simulate async work, and
the page will register an `$effect` whose teardown clears every pending timer on destroy.

---

## R8 — Does this port need to export a shared module for later components?

**Decision**: No shared module is extracted. `usePending` / `PendingState` are exported from the
`pending` barrel and are already reusable as-is by any later port that needs a busy state; nothing
is placed in `$lib/utils.ts` or a new shared folder.

**Rationale**: Constitution V requires a registry item to be self-contained — a consumer installing
`pending` gets exactly the files in its folder. Hoisting `createPendingId()` into `$lib/utils.js`
would add an untracked file to every dependent registry entry for no gain. If a later component
needs the busy contract, it declares `"registryDependencies": ["pending"]`, which is the intended
shadcn mechanism.

---

## R9 — Keyboard surface

**Decision**: `Enter` and `Space` (`event.key === ' '`) are prevented in both `onkeydown` and
`onkeyup` while pending; **no other key is touched**, so `Tab`, `Escape`, arrows, `Home` and `End`
behave exactly as they would on an idle element and focus order is untouched.

**Rationale**: Verbatim from `onKeyEventPrevent` in the upstream source, and required by FR-003 /
SC-003 (element stays reachable by `Tab`). This is the key-for-key parity Principle III demands, and
the "no other key is affected" half is an explicit test case, not an assumption.

---

## R10 — Demo composition (per the shadcn-svelte rules)

**Decision**:

| Upstream demo               | Composition here                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pending-demo.tsx`          | `usePending` + `Button`, `Spinner` with `data-icon="inline-start"` instead of `<Loader2 className="size-4 animate-spin" />` |
| `pending-wrapper-demo.tsx`  | `<Pending>` + `child` snippet around `Button`                                                                    |
| `pending-form-demo.tsx`     | `Field.FieldGroup` / `Field.Field` / `Field.FieldLabel` + `Input` (never a `div` + `space-y-*`); success line uses `text-success` |
| `pending-link-demo.tsx`     | `<Pending>` + `child` snippet around a plain `<a>`                                                                |
| `pending-switch-demo.tsx`   | `<Pending>` + `child` snippet around `$lib/components/ui/switch`, `id` passed on `<Pending>` so the `Field.FieldLabel`'s `for` still resolves |

**Rationale**: `composition.md` states Button has no `isPending`/`isLoading` prop and must compose
`Spinner`; `icons.md` forbids sizing classes on icons inside components and requires `data-icon`;
`forms.md` requires `Field.*` for form layout; `styling.md` forbids `text-green-600` and
`space-y-*`. Passing `id` on `<Pending>` (rather than on the `Switch`) avoids the one attribute
collision a last-position spread would cause, since `pendingProps.id` always wins.
