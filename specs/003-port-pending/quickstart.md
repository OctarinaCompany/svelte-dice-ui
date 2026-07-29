# Quickstart & Validation: Pending Utility

**Feature**: `003-port-pending` | **Date**: 2026-07-29

How to run and prove the port end to end. Contract IDs (`H-xx`, `W-xx`) refer to
[contracts/pending-api.md](./contracts/pending-api.md); entity names refer to
[data-model.md](./data-model.md).

## Prerequisites

- Node + `pnpm` with dependencies installed (`pnpm install`) — no new package is required by this
  feature.
- The vendored upstream copy at `.reference/diceui` (read-only).

## Commands (all non-interactive)

```bash
pnpm run format                # first: generator output is not Prettier-formatted
pnpm run check                 # svelte-kit sync && svelte-check — 0 errors, 0 warnings
pnpm run lint                  # prettier --check . && eslint .
pnpm run test:unit -- --run    # Vitest single run
pnpm run build                 # vite build, includes the new demo route
pnpm run registry:build        # regenerates static/r/ after the registry.json entry is added
```

Run only the new suite while iterating:

```bash
pnpm run test:unit -- --run src/lib/components/ui/pending/pending.test.ts
```

## Validation scenarios

Each scenario is one or more `it` blocks in
`src/lib/components/ui/pending/pending.test.ts`, driven through `@testing-library/user-event` and
the prop-driven harness `pending.test.svelte` (needed because `usePending()` may only be called
during component initialisation, and because `bind:ref` and snippet props need a real parent).

### S1 — Roles, ARIA and accessible name (US1, Principle III)

Render a `<Button>` through the `child` snippet with `isPending` true.
**Expect**: `getByRole('button', { name: 'Submit' })` still resolves; the element has
`aria-busy="true"`, `aria-disabled="true"`, `data-pending=""`, `data-slot="pending"`; it has **no**
native `disabled` attribute and no `tabindex`. Toggling `isPending` to false removes all three
state attributes. → H-03, H-04, H-08, W-01.

### S2 — Pointer prevention (US1)

With `isPending` true, `await user.click(element)` on a button whose `onclick` spy was spread
*before* `{...props}`.
**Expect**: the spy is never called, and a manually dispatched cancelable `click` reports
`defaultPrevented === true`. Repeat for `pointerdown`, `pointerup`, `mousedown`, `mouseup`.
→ H-05, FR-004.

### S3 — Keyboard prevention and focus retention (US1, Principle III)

`await user.tab()` to the pending element.
**Expect**: it receives focus (`toHaveFocus()`). `await user.keyboard('{Enter}')` and `'{ }'`
fire no action and are `defaultPrevented`; `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`,
`Home`, `End`, `Escape` and a subsequent `Tab` are **not** prevented and move focus normally.
→ H-06, H-08, SC-003.

### S4 — Idle spread safety (US1)

With `isPending` false, spread `{...props}` **last** over a button carrying an `onclick` spy.
**Expect**: `await user.click(...)` calls the spy exactly once — proving the handler keys are
omitted rather than set to `undefined`. → H-03, Entity 3.

### S5 — Wrapper, merge mode (US2)

Render `<Pending.Root isPending>` with a `child` snippet around a single `<button>`.
**Expect**: `container.querySelectorAll('button')` has length 1 and there is no additional wrapper
element around it; the button carries both its own `class`/`type` and the pending attributes.
→ W-01, W-02, US2-AC1.

### S6 — Wrapper, fallback mode (US2)

Render `<Pending.Root isPending>` with plain `children`.
**Expect**: a single `<span data-slot="pending">` with class `contents` carrying the ARIA/data
attributes; clicking the inner button does **not** call its `onclick` spy (capture-phase
`stopPropagation`); with `isPending` false the spy fires normally. → W-03, W-04, W-05.

### S7 — Link and switch composition (US2)

`child` snippet around `<a href="/x">`: with `isPending`, the click is `defaultPrevented`, the
`href` is unchanged and the anchor keeps focus. `child` snippet around
`$lib/components/ui/switch`: with `isPending`, `user.click` leaves `aria-checked` unchanged and the
switch still exposes `data-pending`; with `isPending` false it toggles. → W-12, US2-AC2, US2-AC3.

### S8 — Controlled / uncontrolled (US1)

Omit `isPending` entirely → no pending attributes ever appear (uncontrolled default `false`). Pass
`isPending` and interact → the value never changes on its own; only a `rerender` with a new value
moves it, and the attributes follow without remount. → H-09, H-10.

### S9 — `disabled` independence (US3)

`disabled` true + `isPending` false → `data-disabled=""` present, `data-pending`/`aria-busy`/
`aria-disabled` absent, clicks fire normally. Both true → both attributes present and interaction
prevented. → H-07, US3-AC1, US3-AC2.

### S10 — id generation (FR-007)

Explicit `id` → used verbatim on the element. Omitted → the rendered `id` matches `/^pending-/` (or
the `$props.id()` value for the wrapper) and is unchanged after a `rerender`. Two instances get
different ids. → H-01, H-02, W-08.

### S11 — RTL (FR-011)

Render the harness inside `dir="rtl"`.
**Expect**: identical attributes and identical prevention behaviour to LTR; no arrow key changes
anything. → W-11.

### S12 — Guard rail: missing child (Edge Cases)

`expect(() => render(Pending.Root, { props: { isPending: true } })).toThrow(/requires exactly one child/)`.
Supplying both snippets renders the `child` output only. → W-06, W-07.

### S13 — Barrel surface

`Pending.Root`, `Pending.Pending === Pending.Root`, `usePending`, `PendingState` and
`createPendingId` are all defined and importable both as a namespace and by name.

## Manual demo check

`pnpm run build` must succeed, then inspect `/docs/components/pending` (do **not** start
`pnpm dev` in the unattended pipeline — the build is the gate). The page must contain five
`<ComponentPreview>` sections — Default, Wrapper Component, Form with Pending State, Navigation
Links, Toggle Switches — one per upstream `pending-*-demo.tsx` (SC-004, FR-012), plus API tables for
`usePending` options, `usePending` return, `<Pending>` props and data attributes.

## Definition of done

- [x] All five gate commands pass with zero errors and zero warnings.
- [x] No `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip` or
      `.todo` anywhere in the diff.
- [x] `registry.json` has exactly one new `pending` entry and `static/r/pending.json` regenerated.
- [x] `/docs/components/pending` builds and lists under `/docs/components`.
