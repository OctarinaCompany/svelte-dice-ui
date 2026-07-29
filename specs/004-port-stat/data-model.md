# Phase 1 Data Model: Stat

**Feature**: `004-port-stat` | **Date**: 2026-07-29

`Stat` holds **no** state. There is no store, no `$state`, no context, no collection, no selection
and no persistence — every entity below is either a compile-time union, a static lookup table, or a
pure function of one part's own props. This is why the port ships no `stat.svelte.ts`
(research.md R1).

Entity IDs (`E-x`) are referenced by `tasks.md`; contract IDs (`C-xx`, `V-xx`, `B-xx`) refer to
[contracts/stat-public-api.md](./contracts/stat-public-api.md).

---

## E-1 — `StatIndicatorVariant` (value union)

The indicator's visual-style axis.

| Field         | Value                                                    |
| ------------- | -------------------------------------------------------- |
| Source tuple  | `STAT_INDICATOR_VARIANTS = ['default','icon','badge','action'] as const` |
| Type          | `(typeof STAT_INDICATOR_VARIANTS)[number]`               |
| Default       | `'default'`                                              |
| Surfaced as   | `data-variant` on `[data-slot="stat-indicator"]`         |
| Validation    | `resolveStatIndicatorVariant(v?)` → member, else `'default'` |

Declaring the tuple first and deriving the type from it means the union, the `tv()` keys, the
`data-variant` values, the resolver and the demo/test loops cannot drift apart.

---

## E-2 — `StatIndicatorColor` (value union)

The indicator's colour-theme axis, **independent** of E-1 — all 4 × 5 = 20 combinations are legal
(FR-006, SC-002).

| Field         | Value                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| Source tuple  | `STAT_INDICATOR_COLORS = ['default','success','info','warning','error'] as const` |
| Type          | `(typeof STAT_INDICATOR_COLORS)[number]`                                  |
| Default       | `'default'`                                                               |
| Surfaced as   | `data-color` on `[data-slot="stat-indicator"]`                            |
| Validation    | `resolveStatIndicatorColor(v?)` → member, else `'default'`                |

Token mapping (research.md R8): `success` → `--success`, `info` → `--info`, `warning` → `--warning`,
`error` → `--destructive`, `default` → `--muted`. No raw palette colour and no `dark:` override
appears (Constitution VIII).

---

## E-3 — `StatTrendDirection` (value union)

| Field         | Value                                                     |
| ------------- | --------------------------------------------------------- |
| Source tuple  | `STAT_TREND_DIRECTIONS = ['up','down','neutral'] as const` |
| Type          | `(typeof STAT_TREND_DIRECTIONS)[number]`                  |
| Default       | **none** — the prop is genuinely optional                 |
| Surfaced as   | `data-trend`, **omitted** when the prop is `undefined`     |
| Validation    | `resolveStatTrendDirection(v?)` → member, else `'neutral'` |

E-3 is the one axis with an asymmetry: the *class* default is `neutral` (`defaultVariants`), but the
*attribute* is absent when the prop is unset, because upstream writes `data-trend={trend}` with no
default parameter. Both halves are asserted (C-25, C-26).

---

## E-4 — `statIndicatorVariants` (static table)

A `tv()` table with two variant groups, `variant` (E-1) then `color` (E-2) in that declaration order,
and `defaultVariants: { variant: 'default', color: 'default' }`. Full class rows: contract §5.2.

State transitions: none. The table is a module-level constant evaluated once per module load; the
component calls it inside a `$derived` so a prop change recomputes exactly one string.

---

## E-5 — `statTrendVariants` (static table)

A `tv()` table with a single `trend` group (E-3) and `defaultVariants: { trend: 'neutral' }`. Full
class rows: contract §5.3. Replaces upstream's inline `clsx` object so that both variant-bearing
parts are described by one mechanism (research.md R2).

---

## E-6 — Part instances (7 stateless render units)

| Part              | Own props beyond the shared shape | Element                 | State |
| ----------------- | --------------------------------- | ----------------------- | ----- |
| `Stat`            | —                                 | `div[data-slot=stat]`   | none  |
| `StatLabel`       | —                                 | `div`                   | none  |
| `StatIndicator`   | `variant` (E-1), `color` (E-2)    | `div`                   | none  |
| `StatValue`       | —                                 | `div`                   | none  |
| `StatTrend`       | `trend` (E-3)                     | `div`                   | none  |
| `StatSeparator`   | `Separator.RootProps`             | `bits-ui` `Separator.Root` | none |
| `StatDescription` | —                                 | `div`                   | none  |

Shared shape: `ref` (`$bindable`, E-7), `class`, `children`, `...restProps` — contract §2.

**Relationships**: there are none in the data sense. The parts are related only through **CSS**: the
container's `**:data-[slot=…]:` arbitrary-variant rules (V-02) place each descendant by its slot
identity. This is the entire mechanism behind FR-002 and FR-010 — no provider, no registration, no
collection, so a part rendered outside `Stat` simply loses its grid placement and keeps its own
styling (C-06, C-43).

---

## E-7 — `ref` (per-part binding)

| Field    | Value                                                                                    |
| -------- | ---------------------------------------------------------------------------------------- |
| Type     | `HTMLDivElement \| null`                                                                 |
| Initial  | `null`                                                                                   |
| Written  | by Svelte, via `bind:this={ref}` (or `bind:ref` for the composed `Separator`)             |
| Lifecycle| `null` → element on mount → `null` on destroy                                             |

The Svelte replacement for React's `forwardRef`. It is the only mutable value anywhere in the
component, and the framework owns every write.

---

## Validation rules (consolidated)

| Rule                                                                              | Source            | Enforced by        |
| --------------------------------------------------------------------------------- | ----------------- | ------------------ |
| An unknown `variant` / `color` / `trend` string renders the axis default, never crashes | spec Edge Cases | E-1/E-2/E-3 resolvers |
| `data-variant` / `data-color` are always present on the indicator                 | FR-011, C-22      | defaulted props     |
| `data-trend` is absent exactly when `trend` is `undefined`                        | upstream `stat.tsx` | C-25              |
| Caller `class` is merged last on every part                                        | Constitution VIII | `cn(..., className)` |
| `StatValue` carries no truncation or width constraint                              | spec Edge Cases   | V-07               |
| Any subset of parts, in any order, renders without a broken grid                   | FR-010            | V-02 slot selectors |
| No part emits a physical-direction utility, so RTL mirrors natively                | FR-014            | V-01…V-05, C-42    |

## State transitions

None. There is no state machine, no open/closed state, no selection and no focus model in this
component. The only "transition" a consumer observes is a prop change re-deriving one class string
and one or two `data-*` attributes — asserted in `stat.test.ts` by rerendering with new props rather
than by driving an interaction.
