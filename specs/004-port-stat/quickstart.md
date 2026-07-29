# Quickstart & Validation: Stat

**Feature**: `004-port-stat` | **Date**: 2026-07-29

How to run and prove the port end to end. Contract IDs (`C-xx`, `V-xx`, `B-xx`) refer to
[contracts/stat-public-api.md](./contracts/stat-public-api.md); entity IDs (`E-x`) refer to
[data-model.md](./data-model.md).

## Prerequisites

- Node + `pnpm` with dependencies installed (`pnpm install`). **No new package is required** — this
  feature adds zero npm dependencies (research.md R9).
- The vendored upstream copy at `.reference/diceui` (read-only).

## Commands (all non-interactive)

```bash
pnpm run format                # first: generator output is not Prettier-formatted
pnpm run check                 # svelte-kit sync && svelte-check — 0 errors, 0 warnings
pnpm run lint                  # prettier --check . && eslint .
pnpm run test:unit -- --run    # Vitest single run
pnpm run build                 # vite build, includes the new /docs/components/stat route
pnpm run registry:build        # regenerates static/r/ after the registry.json entry is added
```

Run only the new suite while iterating:

```bash
pnpm run test:unit -- --run src/lib/components/ui/stat/stat.test.ts
```

## Minimal usage (SC-001 — three lines of markup)

```svelte
<script lang="ts">
	import * as Stat from '$lib/components/ui/stat/index.js';
</script>

<Stat.Root>
	<Stat.Label>Total Revenue</Stat.Label>
	<Stat.Value>$45,231</Stat.Value>
</Stat.Root>
```

Full composition, matching the MDX's Layout snippet:

```svelte
<script lang="ts">
	import * as Stat from '$lib/components/ui/stat/index.js';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import DollarSignIcon from '@lucide/svelte/icons/dollar-sign';
</script>

<Stat.Root>
	<Stat.Label>Total Revenue</Stat.Label>
	<Stat.Indicator variant="icon" color="success"><DollarSignIcon /></Stat.Indicator>
	<Stat.Value>$45,231</Stat.Value>
	<Stat.Trend trend="up"><ArrowUpIcon /> +20.1% from last month</Stat.Trend>
	<Stat.Separator />
	<Stat.Description>Total revenue generated in the current billing period</Stat.Description>
</Stat.Root>
```

## Validation scenarios

Each scenario is one or more `it` blocks in `src/lib/components/ui/stat/stat.test.ts`, using
`@testing-library/svelte`, `createRawSnippet` for children, and the prop-driven harness
`stat.test.svelte` where a `.ts` spec cannot express the markup (`bind:ref`, multi-part composition,
the `DropdownMenu` trigger). `expect.requireAssertions` is on — every `it` asserts.

### S1 — Card renders label and value (US1, P1)

Render the harness with a label and a value.
**Expect**: both texts are queryable by `getByText`; the container carries `data-slot="stat"` and
every class of V-01/V-02; the label carries V-03, the value V-04; the value carries **no**
`truncate`/`whitespace-nowrap`/width class (V-07). Rendering the container with a value and no label
still produces a well-formed card. → C-10, C-11, C-13, V-01…V-04, V-07.

### S2 — Every part exists, is reachable both ways, and stands alone (US1)

Render each of the seven parts.
**Expect**: each renders its documented `data-slot` (C-10…C-16); `Stat.Indicator` and
`StatIndicator` from the barrel are the same component (B-18); every part rendered **outside**
`Stat.Root` renders without throwing (C-06, C-43) — the deliberate inverse of the usual
"throws outside its provider" assertion, because this component has no provider (research.md R6).

### S3 — Indicator: 4 × 5 axes (US2, P2, SC-002)

Loop `STAT_INDICATOR_VARIANTS` × `STAT_INDICATOR_COLORS` (E-1 × E-2).
**Expect**: for every one of the 20 combinations the element carries the matching `data-variant` and
`data-color` and every class of the corresponding V-11 and V-12 rows; the base V-10 classes are
always present; with no props it falls back to `default`/`default` (FR-005, FR-006). Assert no
rendered class matches `/^dark:/` and none is a raw palette colour (`green-`, `blue-`, `orange-`,
`red-`) — V-15, Constitution VIII. → C-12, C-22.

### S4 — Trend: 3 directions plus the unset case (US3, P3, SC-003)

Loop `STAT_TREND_DIRECTIONS` (E-3), then render with `trend` omitted.
**Expect**: `up` → `text-success`, `down` → `text-destructive`, `neutral` → `text-muted-foreground`;
omitted → `text-muted-foreground` **and no `data-trend` attribute at all**
(`expect(el).not.toHaveAttribute('data-trend')`). → C-14, C-25, C-26, V-20…V-22.

### S5 — Separator and description (US3)

Render `Stat.Separator` between an indicator and a description.
**Expect**: the separator carries `data-slot="stat-separator"` and `my-2`, and the `role` supplied by
`bits-ui` (`none` when decorative); a caller `class="my-4"` merges rather than erasing the base
(C-30); the description carries V-05. → C-15, C-16, V-06.

### S6 — Unknown runtime values do not crash (spec Edge Cases)

Call `resolveStatIndicatorVariant('bogus')`, `resolveStatIndicatorColor('')`,
`resolveStatTrendDirection(undefined)` directly, then render the parts with the same dirty values
cast through the resolver's input type.
**Expect**: `'default'`, `'default'`, `'neutral'` respectively; the rendered `data-*` attributes hold
only documented values, never the dirty string; the axis-default classes are applied. → V-30, V-31.

### S7 — Pass-through: `ref`, `class`, `restProps` (FR-012, FR-013)

Through the harness, bind a `ref` on every part, pass `class="mt-8"`, an `id`, an `onclick` spy and a
`data-testid`.
**Expect**: each bound `ref` reports the expected tag name after mount (C-01); the caller class is
present **and wins** the conflicting axis over the component's own utility (C-02); `id`,
`data-testid` and the click handler all reach the element (C-04). → C-01…C-04.

### S8 — Order independence (FR-002, FR-010, C-40)

Render the same six parts in two different source orders, and a card containing only an indicator and
a value.
**Expect**: identical `data-slot` sets and identical per-part classes in both orders; the container's
`**:data-[slot=…]` rules (V-02) are on the container in every case, so placement is slot-driven, not
order-driven; the minimal card renders with no empty or duplicated part. → C-40.

### S9 — Action indicator drives the menu (US2 scenario 3, SC-005)

Through the harness, render `<DropdownMenu.Trigger><Stat.Indicator variant="action">…</Stat.Indicator></DropdownMenu.Trigger>`
inside a `Stat.Root`, with three `DropdownMenu.Item`s.
**Expect**, driven through `userEvent`: `getByRole('button')` resolves and carries
`aria-haspopup="menu"` and `aria-expanded="false"`; `await user.click(trigger)` opens the menu
(`getByRole('menu')`, `aria-expanded="true"`); `Escape` closes it; re-focusing the trigger and
pressing `Enter` opens it, `Space` opens it, and `ArrowDown` moves focus to the first
`role="menuitem"`. Assert the DOM shape matches upstream: the trigger is a `<button>` and
`data-slot="stat-indicator"` with `data-variant="action"` is **inside** it. → C-41, research.md R4.

### S10 — RTL (FR-014, C-42)

Render the card inside a `dir="rtl"` wrapper.
**Expect**: the container's class list is byte-identical to the LTR render — the mirroring is done by
CSS Grid's inline-direction line numbering, not by a class swap (research.md R5); no part's class list
contains a physical-direction utility (`ml-`, `mr-`, `left-`, `right-`, `text-left`, `text-right`).

### S11 — Barrel surface (B-01…B-18)

Import the barrel namespace and every named export.
**Expect**: all seven components resolve under both the short and the prefixed name; the three tuples
hold exactly the documented members in the documented order; `statIndicatorVariants()` and
`statTrendVariants()` are callable and return the documented default rows.

## Manual verification (Principle IX)

```bash
pnpm run build   # must succeed; then inspect the built route, or read the source
```

`src/routes/docs/components/stat/+page.svelte` must contain exactly three `<ComponentPreview>`
sections — **Default** (`stat-demo.tsx`), **Variants** (`stat-variants-demo.tsx`) and
**Layout Options** (`stat-layout-demo.tsx`) — each `description`-tagged with the upstream file it
mirrors, plus seven prop tables and one data-attribute table built with `$lib/components/ui/table`,
following `/docs/components/status`. SC-004 is satisfied only when all three exist and render.

## Registry verification (SC-007)

After appending the entry from contract §7:

```bash
pnpm run registry:build
```

**Expect**: `static/r/stat.json` is written, lists the eight shipped files (no test file), and its
inlined sources contain registry placeholders rather than `$lib/...` paths. `getComponentItems()` in
`src/lib/registry.ts` then surfaces "Stat" in the docs sidebar and on `/docs/components`, linking to
`/docs/components/stat`.

## Definition of done

- All four gates green, in order, with zero suppressions (Constitution VII and the anti-cheat rule).
- `pnpm run registry:build` re-run and `static/r/stat.json` present.
- Every scenario S1–S11 has at least one passing `it`, none `.skip`/`.todo`.
