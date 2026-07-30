# Implementation Plan: Relative Time Card

**Branch**: `015-port-relative-time-card` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-port-relative-time-card/spec.md`

**Upstream (pinned `d9763d82530416dfa4c81c462387b55d06bae4ec`)**:
`.reference/diceui/docs/registry/bases/radix/ui/relative-time-card.tsx` (251 lines),
`.reference/diceui/docs/types/radix/relative-time-card.ts` (the documented API),
`.reference/diceui/docs/content/docs/components/radix/relative-time-card.mdx`,
`.reference/diceui/docs/registry/bases/radix/examples/relative-time-card{,-basic,-timezones,-variants}-demo.tsx`.
**No upstream test file exists for this component.**

## Summary

Port Dice UI's `RelativeTimeCard` — a timestamp that reads as a short absolute date and, on hover or
keyboard focus, opens a card showing a live relative-time string plus one row per configured timezone
— to Svelte 5 runes as a shadcn-svelte registry item.

The upstream file is 251 lines, of which roughly 100 are two things Svelte does not need: a
hand-written `pluralize()`/string-concatenation formatter, and five `React.useMemo` wrappers. The
technical approach:

1. **Compose the hover card; write no hover logic.** `$lib/components/ui/hover-card` (bits-ui's
   `LinkPreview`) already implements `openDelay`, `closeDelay`, pointer/focus opening, the safe
   polygon, the escape layer, the portal and all seven positioning props under upstream's own names
   (R-01). The trigger is rendered through the primitive's `child` snippet so it stays a
   `<button type="button">` rather than the primitive's default `<a>` (R-02).
2. **Replace the formatter with `Intl`, keeping the strings byte-identical.**
   `Intl.RelativeTimeFormat` does the past/future framing; `Intl.NumberFormat({style:'unit'})` does
   the pluralised magnitudes; `Intl.ListFormat({style:'narrow',type:'unit'})` joins the one compound
   case (`"5 minutes 30 seconds ago"`). Verified in Node against every upstream branch (R-05).
   `Intl.DateTimeFormat` keeps upstream's three absolute shapes verbatim (R-06).
3. **`useState` + `useEffect` → one `$derived` and one `$effect`.** The only irreducible mutable
   input is *now*: `now = $state(Date.now())`, the label is `$derived`, and a single `$effect`
   owns `setInterval`/`clearInterval`. A `date` change needs no effect at all, and the teardown is
   the FR-007/SC-003 guarantee (R-08).
4. **No context, and say so.** Upstream has no `createContext`; the only parent→child flow is props.
   No `Symbol` key and no throwing getter are invented — the same call `status` made (R-09).
5. **Harden the two upstream crashes.** An unparseable `date` (`toISOString()` throws) and an unknown
   IANA zone (`Intl` constructor throws) both render instead of throwing, as the spec's Edge Cases
   require (R-07).

Full rationale in [research.md](./research.md); shapes, the branch table and the ticker lifecycle in
[data-model.md](./data-model.md); the installable surface in
[contracts/public-api.md](./contracts/public-api.md); validation in [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict, `verbatimModuleSyntax`), Svelte 5 runes forced on
(`vite.config.ts`)

**Primary Dependencies**: SvelteKit 2, Svelte 5.56, Tailwind CSS v4, `tailwind-variants@^3.3.0`
(`tv()`), `clsx` + `tailwind-merge` via `cn()`, `bits-ui@^2.18.1` (types + the `LinkPreview`
primitive behind our `hover-card`). Composed in-repo: `$lib/components/ui/hover-card`. Demo page
only: `@lucide/svelte@^1.27.0` (`icons/clock`), `$lib/components/ui/button`,
`$lib/components/ui/table`. **No new npm dependency** — every upstream import maps onto something
already installed (research R-15); `Intl.RelativeTimeFormat`, `Intl.NumberFormat`, `Intl.ListFormat`
and `Intl.DateTimeFormat` are platform APIs.

**Storage**: N/A

**Testing**: Vitest (jsdom 30, `globals: false`, `expect.requireAssertions`) +
`@testing-library/svelte@^5.4.2` + `@testing-library/user-event@^14.6.1`. One spec
(`relative-time-card.test.ts`) plus one `.test.svelte` harness for `bind:open`, `bind:ref` and the
`child` snippet. The clock is pinned with `vi.useFakeTimers()` + `vi.setSystemTime(…)` — never
slept on — and `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` is mandatory or
`openDelay` never elapses (R-14).

**Target Platform**: SSR + browser (modern evergreen). `setInterval` runs client-side only (effects
do not run during SSR). `:focus-visible` is required by the bits trigger and is supported by the
installed jsdom 30 (verified).

**Project Type**: shadcn-svelte registry component + its docs route

**Performance Goals**: one `$state` write per tick (default 1 s), driving one `$derived`
recomputation and one text-node update; zero timers after unmount. All formatter objects are
constructed inside the pure helpers per call, matching upstream's per-render construction — the cost
is a few microseconds against a 1 s cadence, and caching them would have to be keyed on
locale + timezone + options for no measurable gain.

**Constraints**: relative-time phrasing must match upstream character for character in `en`
(FR-006); the interval must be cleared on unmount and on an `updateInterval` change (FR-007); no
bespoke formatter; strict TS with no suppressions; semantic Tailwind tokens only; the demo page must
not reproduce upstream's raw palette colours (R-12).

**Scale/Scope**: 2 exported components + 2 modules (1 runes, 1 pure) + 1 barrel = 5 registry files;
21 root props; 4 demo sections + 3 API tables; ~40 test cases across 7 `describe` groups.

No `NEEDS CLARIFICATION` remains — every open question is resolved in `research.md` R-01…R-16 and
mirrored into the spec's Assumptions.

## Constitution Check

_GATE: passed before Phase 0; re-checked after Phase 1 design — see the re-check note below._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                                                                                                          |
| ---- | ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect`/`$props`/`$bindable` + snippets only; `RelativeTimeCardState` lives in `relative-time-card.svelte.ts` with getter-function inputs; the pure formatters are rune-free `.ts`. No store, `export let`, `createEventDispatcher`, `$:` or `<slot>`. The five upstream `useMemo`s are dropped, not ported (R-08). |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | All 20 documented props reproduced under upstream names with upstream defaults and JSDoc (`contracts/public-api.md` §1); the relative-time branch order, thresholds, the past-minutes seconds residual, the future-minutes *absence* of one, the `"just now"` literal and the 7-day locale-date fallback are preserved character-for-character (R-05, `data-model.md` §5); the `role="region"` → `role="listitem"` spread-override subtlety is preserved (R-10); the MDX's `[data-state]` attribute and its Tab/Enter keyboard table are covered; 11 divergences recorded in `contracts/public-api.md` §10 and the spec's Assumptions; all four demo files ported. |
| III  | Accessibility Is a MUST             | PASS    | The widget is APG *disclosure-on-hover*: bits supplies `role="button"`, `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` and the escape layer; the port adds `role="list"`/`listitem` rows, each with an `aria-label` naming zone + date + time, and `<time datetime>` on every rendered instant (FR-013). Keyboard parity: Tab opens on `:focus-visible`, Tab away closes, Enter keeps it open, Escape closes (contract §4). `focus-visible:outline-none` is deliberately dropped so the ring survives (R-12). Tests cover roles, accessible names, keyboard through `user-event`, RTL, controlled + uncontrolled, and the live-region-free structure. **`disabled`/`readOnly` and the outside-provider throw are N/A**: upstream documents neither a disabled state nor a context (R-09) — the tests assert instead that the timezone part renders standalone without throwing, exactly as `status.test.ts` does. |
| IV   | Composition Over Reimplementation   | PASS    | `$lib/components/ui/hover-card` (→ bits-ui `LinkPreview`) composed for every hover, timing, positioning, portal and dismiss behaviour; `$lib/components/ui/button` and `$lib/components/ui/table` composed by the demo. Bespoke code is limited to the formatters, and even those delegate to platform `Intl` — justified in the table below.                                              |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `relative-time-card/`, one part per file (`relative-time-card.svelte`, `relative-time-card-timezone.svelte`), reactive logic in `relative-time-card.svelte.ts`, pure helpers in `relative-time-format.ts`, barrel with short names + prefixed aliases + prop types, `.js` extensions everywhere, one `registry:ui` entry listing all 5 non-test files, zero imports from `src/routes/**` or `src/lib/components/docs/**` (grepped in `quickstart.md` V-1).                          |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Prop types exported from `<script lang="ts" module>`; the trigger derives from `WithElementRef<HTMLButtonAttributes, HTMLButtonElement>`; the seven positioning props are a `Pick` off `bits-ui`'s own `ContentProps`, so no union is hand-typed and no `any` is needed; `resolveRelativeTimeCardVariant` narrows untyped runtime input without `as any`. Anti-cheat greps in `quickstart.md` V-1.                        |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit --run` → `build` scheduled as the final phase; no skipped, `.todo` or assertion-free test.                                                                                                                                                                                                    |
| VIII | Styling Discipline                  | PASS    | `tv()` in `relative-time-card.svelte.ts`, exported; `cn()` elsewhere with the caller's `class` merged last (an improvement on upstream, which drops the row's `className`); only `text-foreground/*`, `text-muted-foreground`, `bg-accent`, `ring-ring` — no palette colour, no `dark:`, no `space-*`; the demo's upstream `blue/green/purple` custom-styling row is remapped to `text-info`/`text-success`/`text-primary` (R-12). No `z-index` is written — `hover-card-content.svelte` owns overlay stacking. `data-slot` on all five parts; state exposed as `data-variant`, `data-invalid`, `data-timezone`, `data-local`, plus bits' `data-state`/`data-side`/`data-align`; booleans written `? '' : undefined`. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/relative-time-card/+page.svelte` with one `<ComponentPreview>` per upstream demo file (Default, Basic, Timezones, Variants) plus a Controlled section and props / data-attribute tables; demo state held in the page with runes; no `+page.ts`.                                                             |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/015-port-relative-time-card/`; `SPECIFY_FEATURE_DIRECTORY` honoured; no git write command anywhere in this plan.                                                                                                                                                                                            |

**Bespoke behaviour justification (Principle IV)**

| Bespoke piece                                            | Primitive evaluated                                                                                 | Capability it lacks                                                                                                                                                                                                              |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formatRelativeTime` bucket selection                     | `Intl.RelativeTimeFormat` — **composed** for every word; `Intl.DurationFormat`; `bits-ui`             | `Intl` formats a *given* value and unit; it does not choose the unit, apply upstream's 5-second/7-day thresholds, or emit the past-minutes seconds residual. `Intl.DurationFormat` carries no past/future framing and is not in the repo's typings. `bits-ui` has no date utility. Only the branch selection is ours; every word comes from `Intl` (R-05). |
| `RelativeTimeCardState` ticker                            | `bits-ui`; `runed` (transitively installed, not a repo dependency)                                   | Neither exposes an interval primitive we are allowed to depend on directly; the whole implementation is four lines of `setInterval` + teardown, which is exactly the `$effect`-cleanup rule (R-08).                                |
| `toDate` / `toIsoString` / `RangeError` guards            | none applicable                                                                                       | Input normalisation and the two non-throwing guards the spec's Edge Cases require (R-07).                                                                                                                                          |
| Hover timing, positioning, portal, escape, safe polygon   | `$lib/components/ui/hover-card` → `bits-ui` `LinkPreview` — **composed**, not reimplemented           | n/a; only `defaultOpen` is missing from the primitive and is synthesised with the repo's standard `open ??= defaultOpen` seed (R-04).                                                                                              |

**Post-Phase-1 re-check**: `data-model.md` and `contracts/public-api.md` introduce no new dependency,
no suppression, no palette colour, no docs-app import and no additional bespoke behaviour. Phase 1
surfaced two design details that are compliance decisions, not violations, and both are recorded in
the spec's Assumptions: the additive export of the timezone row (R-10) and the index-keyed `{#each}`
that keeps duplicate zones renderable (R-11). All ten verdicts stand; Complexity Tracking stays empty.

## Public API

Authoritative table: [`contracts/public-api.md`](./contracts/public-api.md). Summary — 2 exported
components, 1 runes module, 1 pure module.

### `RelativeTimeCard` (`.Root`) — `relative-time-card.svelte` ← upstream `RelativeTimeCard` (relative-time-card.tsx:143-248)

| Prop                | Type                                                       | Default     | Bindable |
| ------------------- | ----------------------------------------------------------- | ----------- | -------- |
| `date`              | `Date \| string \| number` **(required)**                    | —           | no       |
| `timezones`         | `string[]`                                                   | `['UTC']`   | no       |
| `updateInterval`    | `number`                                                     | `1000`      | no       |
| `variant`           | `'default' \| 'muted' \| 'ghost'`                            | `'default'` | no       |
| `open`              | `boolean \| undefined`                                       | `undefined` | **yes**  |
| `defaultOpen`       | `boolean`                                                    | `false`     | no       |
| `onOpenChange`      | `(open: boolean) => void`                                    | `undefined` | no       |
| `openDelay`         | `number`                                                     | `500`       | no       |
| `closeDelay`        | `number`                                                     | `300`       | no       |
| `side`              | `'top' \| 'right' \| 'bottom' \| 'left'`                     | `undefined` → `'bottom'` | no |
| `sideOffset`        | `number`                                                     | `undefined` → `4`        | no |
| `align`             | `'start' \| 'center' \| 'end'`                               | `undefined` → `'center'` | no |
| `alignOffset`       | `number`                                                     | `undefined` → `0`        | no |
| `avoidCollisions`   | `boolean`                                                    | `undefined` → `true`     | no |
| `collisionBoundary` | bits `Boundary`                                              | `undefined` | no       |
| `collisionPadding`  | `number \| Partial<Record<Side, number>>`                    | `undefined` | no       |
| `ref`               | `HTMLButtonElement \| null`                                  | `null`      | **yes**  |
| `class`             | `string`                                                     | `undefined` | no       |
| `children`          | `Snippet`                                                    | `undefined` | no       |
| `child`             | `Snippet<[{ props: RelativeTimeCardChildProps }]>`           | `undefined` | no       |
| rest of `HTMLButtonAttributes` | —                                                 | —           | no       |

- **Snippets**: `children` (replaces the default `<time>` inside the trigger), `child` (replaces the
  trigger element itself; `children` is then not rendered and `ref` stays `null`).
- **Callbacks**: `onOpenChange(next)` on every open/close transition, in both modes.
- **Data attributes**: trigger — `data-slot="relative-time-card-trigger"`, `data-variant`,
  `data-state`, `data-invalid`; content — `data-slot="relative-time-card-content"`, `data-state`,
  `data-side`, `data-align`.
- **Dropped**: `asChild` (→ `child`).

### `RelativeTimeCardTimezone` (`.Timezone`) — `relative-time-card-timezone.svelte` ← upstream `TimezoneCard` (relative-time-card.tsx:46-105)

| Prop       | Type                                     | Default     | Bindable |
| ---------- | ---------------------------------------- | ----------- | -------- |
| `date`     | `Date \| string \| number` **(required)** | —           | no       |
| `timezone` | `string \| undefined`                    | `undefined` (viewer's zone) | no |
| `ref`      | `HTMLDivElement \| null`                 | `null`      | **yes**  |
| `class`, rest of `HTMLAttributes<HTMLDivElement>` | —              | —           | no       |

No snippets (its content is fixed by upstream), no callbacks.
`data-slot="relative-time-card-timezone"`, `data-timezone`, `data-local`; `role="region"` by default
and `aria-label="Time in {zone}: {date} {time}"`, both written before `restProps` so the root's
`role="listitem"` overrides as it does upstream.

### Runes module — `relative-time-card.svelte.ts`

`RELATIVE_TIME_CARD_VARIANTS`, `DEFAULT_TIMEZONES`, `DEFAULT_UPDATE_INTERVAL`, `DEFAULT_OPEN_DELAY`,
`DEFAULT_CLOSE_DELAY`, `relativeTimeCardTriggerVariants` (`tv()`), `resolveRelativeTimeCardVariant`,
class `RelativeTimeCardState`, types `RelativeTimeCardVariant`, `RelativeTimeCardStateProps`.

### Shared pure module — `relative-time-format.ts` (deliverable 5)

`toDate`, `isValidDate`, `toIsoString`, `resolveLocale`, `diffRelativeTime`, `formatRelativeTime`,
`formatAbsoluteDateTime`, `formatZonedDate`, `formatZonedTime`, `formatTimeZoneLabel`,
`formatTimeZoneAccessibleName`, `JUST_NOW_LABEL`, `JUST_NOW_THRESHOLD_SECONDS`,
`RELATIVE_CUTOFF_DAYS`, types `DateInput`, `RelativeTimeParts`. Rune-free and side-effect free, so
later ports (`time-picker`, `timeline`, `data-table`, `stat`) import it directly and add
`relative-time-card` to their `registryDependencies` (R-16).

## Project Structure

### Documentation (this feature)

```text
specs/015-port-relative-time-card/
├── plan.md                    # this file
├── spec.md                    # updated: 4 Assumptions appended (Phase 1 decisions)
├── research.md                # Phase 0 — R-01…R-16
├── data-model.md              # Phase 1 — constants, entities, branch table, ticker lifecycle
├── quickstart.md              # Phase 1 — usage + V-1…V-8 validation
├── contracts/
│   └── public-api.md          # Phase 1 — props, rendered tree, variants, barrel, registry entry
├── checklists/
│   └── requirements.md
└── tasks.md                   # Phase 2 (/speckit-tasks) — NOT created here
```

### Source Code (repository root)

```text
src/lib/components/ui/relative-time-card/
├── index.ts                            # barrel: 2 components + aliases + prop types + module re-exports
├── relative-time-format.ts             # pure Intl helpers  ← pluralize (13-15), formatRelativeTime (17-44),
│                                       #   the three Intl.DateTimeFormat memos (54-85, 172-175, 207-213)
├── relative-time-card.svelte.ts        # tv() variants, constants, RelativeTimeCardState
│                                       #   ← triggerVariants (107-121), useState+useEffect (177-188)
├── relative-time-card.svelte           # Root: HoverCard.Root + trigger child snippet + Content
│                                       #   ← RelativeTimeCard (143-248)
├── relative-time-card-timezone.svelte  # ← TimezoneCard (46-105)
├── relative-time-card.test.svelte      # harness: bind:open, bind:ref, child snippet — not in registry
└── relative-time-card.test.ts          # colocated tests

src/routes/docs/components/relative-time-card/
└── +page.svelte                        # 5 <ComponentPreview> + props / data-attribute tables

registry.json                           # append exactly one registry:ui entry (16th item)
```

**Structure Decision.** Folder slug `relative-time-card` = demo route segment = registry item name,
as Principle V requires. Upstream is a single file holding two components and two module-scope
helpers; `CLAUDE.md` §3 forbids two components in one `.svelte` file, so `TimezoneCard` becomes
`relative-time-card-timezone.svelte` and — unlike `banner`'s internal `BannerImpl` — it is exported,
because a labelled zone row is meaningful standalone (R-10). The pure formatters are split out of the
runes module deliberately: they contain no `$state`, they are the piece later ports reuse, and a
plain `.ts` keeps them testable without a component (precedent: `masonry-positioner.ts`). No
`types.ts` is needed — each component exports its own props type from its module script, and the
shared types live beside the functions that produce them.

## Implementation Phases

Ordering is dependency-driven; `/speckit-tasks` will expand each into tasks.

| #   | Phase             | Deliverable                                                                                                                                                    | Depends on |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Pure formatters   | `relative-time-format.ts` — `toDate`, `isValidDate`, `toIsoString`, `resolveLocale`, `diffRelativeTime`, `formatRelativeTime` (all 7 branches), the four absolute formatters, the `RangeError` guards | —          |
| 2   | Runes module      | `relative-time-card.svelte.ts` — constants, `relativeTimeCardTriggerVariants`, `resolveRelativeTimeCardVariant`, `RelativeTimeCardState` (+ `startTicker`)        | 1          |
| 3   | Timezone part     | `relative-time-card-timezone.svelte` — label/date/time, `role`+`aria-label` before `restProps`, `data-timezone`/`data-local`                                      | 1          |
| 4   | Root              | `relative-time-card.svelte` — `open ??= defaultOpen`, `HoverCard.Root`/`Trigger` (`child` mode) / `Content`, default `<time>` label, index-keyed rows + local row, ticker `$effect`, `child` snippet; then `index.ts` | 1–3        |
| 5   | Tests             | `relative-time-card.test.svelte` harness + `relative-time-card.test.ts` — V-2 (formatters), V-3 (render/hover/rows), V-4 (ticker + teardown), V-5 (controlled/keyboard), V-6 (variants/class/child/a11y/RTL) | 4          |
| 6   | Docs route        | `src/routes/docs/components/relative-time-card/+page.svelte` — Default, Basic, Timezones, Variants, Controlled + API tables                                        | 4          |
| 7   | Registry          | append the `relative-time-card` entry to `registry.json`; run `pnpm run registry:build`                                                                           | 4          |
| 8   | Gates             | `format` → `check` → `lint` → `test:unit --run` → `build`, all green with no suppression                                                                          | 1–7        |

**User-story mapping**: **P1/US1** (absolute trigger, `Date`/string/number input) = phases 1, 2, 4
plus V-2/V-3 and the Basic demo — independently shippable. **P1/US2** (hover + focus card, timezone
rows, live update) = phases 3, 4 plus V-3/V-4 and the Timezones demo. **P2/US3** (variants, `class`,
`children`, `child`) = the `tv()` rows from phase 2 and the trigger branches from phase 4, plus V-6
and the Variants demo. **P3/US4** (positioning, controlled open) = the pass-through props from phase
4, plus V-5 and the Controlled demo.

## Risks

| Risk                                                                                                                    | Mitigation                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user-event` under fake timers never advances `openDelay`, so every hover assertion hangs and the suite times out           | `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` is required in every hover/focus test; the first such test is written before the rest of the suite so the pattern is proven early (R-14). |
| CI runs on a non-`en-US` default locale (this machine resolves `en-150`), so hard-coded string assertions would fail        | The formatters take `locale` explicitly: exact-string tests pass `'en-US'`; component tests compare against the same exported helper called with the resolved locale (R-14).                            |
| The compound minutes string is built by substring replacement, which could silently no-op in an unusual locale              | The `frame.includes(magnitude)` guard degrades to the single-unit string instead of producing garbage, and a test asserts the guard path with a locale whose frame differs (R-05).                       |
| A duplicate entry in `timezones` would throw `each_key_duplicate` with a string-keyed `{#each}`                             | Rows are index-keyed; a test renders `['UTC','UTC']` and asserts three rows (R-11).                                                                                                                    |
| `Intl.DateTimeFormat` throws on an invalid date or unknown zone, crashing the render                                        | `toIsoString` returns `undefined`, the invalid branch uses `Date.prototype.toLocaleDateString`, and every zone-taking constructor is wrapped; two tests cover both (R-07).                              |
| The card portals to `document.body`, so `container`-scoped queries silently find nothing                                    | All open-card assertions use `screen`, stated in `quickstart.md` V-3.                                                                                                                                  |
| SSR renders a relative string computed at request time; hydration recomputes it and the text differs                        | Structure and attributes are identical, only text drifts by the request duration, and the first ticker tick reconciles it. Upstream avoids this with `suppressHydrationWarning`; recorded in R-08 and the spec's Assumptions. |
| The demo page's `new Date()` is evaluated per render, so previews drift between server and client                           | Demo dates are held in the page as `$state` seeded once in the instance script; the previews are illustrative and the ticker corrects the card text within one interval.                                 |
| Upstream's variants demo uses raw palette colours, which the lint/styling rule forbids                                      | The "Custom styling" row is remapped to `text-info`/`text-success`/`text-primary`; noted in the demo's description so the parity is auditable (R-12).                                                    |

## Complexity Tracking

> No constitution violation is carried forward. This table is intentionally empty. The Phase 1
> decisions discussed under the re-check (the additive timezone-row export and the index-keyed
> `{#each}`) are reasoned compliance recorded in the spec's Assumptions, not exceptions.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | —         | —          | —                                      |
