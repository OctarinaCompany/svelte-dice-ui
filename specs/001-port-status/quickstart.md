# Quickstart & Validation Guide: `status`

**Feature**: `001-port-status` | **Date**: 2026-07-29

How to run and prove the Status port end to end. Prop-level detail lives in
[contracts/status-public-api.md](./contracts/status-public-api.md); type detail in
[data-model.md](./data-model.md). No implementation code here.

## Prerequisites

- Node + `pnpm`, dependencies installed (`pnpm install`). **No new package is required** — see the
  Dependency Budget in [plan.md](./plan.md#dependency-budget).
- Files present per [plan.md](./plan.md#source-code-repository-root):
  `src/lib/components/ui/status/{index.ts,status.svelte,status-indicator.svelte,status-label.svelte}`,
  `src/lib/components/ui/status/{status.test.ts,status.test.svelte}`,
  `src/routes/docs/components/status/+page.svelte`, and the `status` entry in `registry.json`.

## Smallest working usage (SC-001: three lines of markup)

```svelte
<script lang="ts">
	import * as Status from '$lib/components/ui/status/index.js';
</script>

<Status.Root variant="success">
	<Status.Indicator />
	<Status.Label>Online</Status.Label>
</Status.Root>
```

Expected: one pill-shaped element with `data-slot="status"` and `data-variant="success"`, containing
a pulsing dot and the text "Online", coloured from the `--success` token in both themes.

## Validation scenarios

### V1 — Quality gates (SC-005) · **the definition of done**

Run in this order, non-interactively:

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

Expected: five green runs. Zero `svelte-check` errors _and_ warnings, zero Prettier/ESLint findings,
all Vitest tests passing with none skipped, `vite build` succeeding including the new demo route.
A gate made green by a suppression (`@ts-ignore`, `eslint-disable`, `svelte-ignore`, `as any`,
`.skip`) is an invalid result, not a pass.

### V2 — Unit suite (SC-002, SC-004)

```bash
pnpm run test:unit -- --run src/lib/components/ui/status/status.test.ts
```

Expected: every suite in the [test suite map](#test-suite-map) present and passing.

### V3 — Docs site (SC-003)

```bash
pnpm run build && pnpm run preview
```

Then open `/docs/components/status`. Expected:

- Four `<ComponentPreview>` sections — **Default**, **Variants**, **Text Only**, **Service Status
  List** — one per upstream `status-*-demo.tsx`, each rendering without console errors.
- An API reference below them: a props table per part and the `data-variant` values table.
- `/docs/components` shows a **Status** card and the docs sidebar lists **Status**, both generated
  from `registry.json` by `src/lib/registry.ts` — this is the SC-006 check that the registry entry
  is well formed.

### V4 — Registry payload (SC-006)

```bash
pnpm run registry:build
```

Expected: `static/r/status.json` is written, contains the inlined contents of all four shipped files
and **neither** test file, and its `$lib/...` imports are rewritten to registry placeholders.

### V5 — Theming (FR-003, FR-007)

In the preview, toggle dark mode. Expected: all five variants change colour with the theme
(the `--success`/`--warning`/`--info`/`--destructive`/`--muted` tokens flip), and in every variant the
indicator dot's colour matches its badge — proving the `**:data-[slot=status-indicator]:bg-…` link.
No `dark:` utility appears anywhere in the component source.

### V6 — Accessibility spot check (SC-004, FR-011)

With a screen reader (or the browser a11y inspector) on `/docs/components/status`: each badge is
announced by its label text only, with no live-region announcement on load, and no `role` is applied
by the component. In the _Default_ section, tabbing does not stop on any badge (they are not
interactive); in a `child`-rendered link the element receives focus with a visible focus ring and is
announced with the label as its accessible name.

## Test suite map

`src/lib/components/ui/status/status.test.ts` — the structure later ports copy. Imports
`describe`/`it`/`expect`/`vi` explicitly (`globals: false`); `expect.requireAssertions` means every
`it` must assert.

| Suite                      | Must assert                                                                                                                                                                                                                                                                                                                       | Covers                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `Status` (root)            | renders a `div` with `data-slot="status"`; renders `children`; `class` is merged **last** and wins a conflict (e.g. caller `rounded-none` beats `rounded-full`); `restProps` forwarded (`id`, `aria-label`, `data-testid`); an `onclick` from `restProps` fires via `userEvent.click`; `bind:ref` populates the element (harness) | FR-008, FR-009         |
| `variants`                 | for each of the five variants: `data-variant` equals it and the token classes are present; the root carries the matching `**:data-[slot=status-indicator]:bg-…` class; omitting `variant` yields `default`                                                                                                                        | FR-002, FR-007, SC-002 |
| `variants › unknown value` | `resolveStatusVariant('bogus')` → `'default'` and `resolveStatusVariant(undefined)` → `'default'`; rendering with `'bogus' as unknown as StatusVariant` (one-line comment: simulates untyped data) yields `data-variant="default"` and the default classes                                                                        | Edge case              |
| `StatusIndicator`          | `data-slot="status-indicator"`; the `animate-ping`/`bg-inherit` pseudo-element classes present; `class` merged last; `restProps` forwarded; `bind:ref`                                                                                                                                                                            | FR-003                 |
| `StatusLabel`              | `data-slot="status-label"`; `leading-none`; renders its text; `class` merged last; `restProps` forwarded; `bind:ref`                                                                                                                                                                                                              | FR-004                 |
| `composition`              | all four permutations render without error — indicator + label, label only, indicator only, neither; DOM order follows markup order                                                                                                                                                                                               | FR-005                 |
| `child snippet`            | the caller's `<a>` carries `data-slot="status"`, `data-variant` and the variant classes; **no** `div[data-slot="status"]` wrapper exists; `getByRole('link', { name: 'Online' })` resolves; `children` is not rendered when `child` is supplied; the link is reachable with `userEvent.tab()` and `Enter` triggers its handler    | FR-006, US3            |
| `accessibility and RTL`    | no implicit role is added (`queryByRole('status')` is `null`); the label text is present for every variant, so state is readable without colour; under a `dir="rtl"` container the root's class list contains no physical-direction utility (`ml-`, `mr-`, `left-`, `right-`, `pl-`, `pr-`) and DOM order is unchanged            | FR-010, FR-011         |

`src/lib/components/ui/status/status.test.svelte` — one prop-driven harness supporting `bind:ref`
and the `child` snippet. Not collected by Vitest (`include` is `.{js,ts}`), not listed in
`registry.json`.

**Not applicable, by design** (see [plan.md](./plan.md#constitution-check)): controlled/uncontrolled
value assertions, `disabled`/`readOnly` guard rails, and "throws outside its provider" — Status
exposes no value, no disabled state and no context provider.

## Definition of done

- [ ] V1 all five commands green, zero suppressions anywhere in the diff
- [ ] V2 every suite in the map present and passing
- [ ] V3 four preview sections + API reference render; sidebar and index card appear
- [ ] V4 `static/r/status.json` written with four files and no test files
- [ ] V5 all variants flip with the theme; indicator colour tracks the badge
- [ ] V6 label-only announcement, no live region, focus visible in `child` mode
- [ ] Contract diff clean: nothing in `contracts/status-public-api.md` missing, nothing extra added
