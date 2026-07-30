# Phase 0 Research: Relative Time Card

**Feature**: `015-port-relative-time-card` | **Date**: 2026-07-30

Upstream, read at the pinned commit `d9763d82530416dfa4c81c462387b55d06bae4ec`:

| File                                                                         | Lines | What it gives                                            |
| ---------------------------------------------------------------------------- | ----- | -------------------------------------------------------- |
| `.reference/diceui/docs/registry/bases/radix/ui/relative-time-card.tsx`      | 251   | the implementation (normative behaviour)                 |
| `.reference/diceui/docs/types/radix/relative-time-card.ts`                   | 137   | the documented prop list + JSDoc + `@default` tags       |
| `.reference/diceui/docs/content/docs/components/radix/relative-time-card.mdx`| 101   | API reference, data attributes, keyboard table           |
| `…/examples/relative-time-card-demo.tsx`                                     | 79    | the MDX's main example (6 sub-sections)                  |
| `…/examples/relative-time-card-basic-demo.tsx`                               | 17    | three past dates                                         |
| `…/examples/relative-time-card-timezones-demo.tsx`                           | 30    | three timezone sets                                      |
| `…/examples/relative-time-card-variants-demo.tsx`                            | 82    | variants, custom styling, positions, custom trigger      |

**There is no upstream test file for this component** (`packages/` has no `relative-time-card`
package; `docs/registry/bases/radix/test/` has no spec for it). The assertion floor is therefore the
MDX tables plus the behaviour readable in the 251 source lines.

---

## R-01 — Which local primitive owns the hover behaviour

**Decision**: compose `$lib/components/ui/hover-card/*` (`Root`, `Trigger`, `Content`, `Portal`),
which wraps `bits-ui`'s `LinkPreview`. Write **no** hover timing, positioning, portalling or dismiss
logic.

**Rationale**: upstream composes `HoverCard`/`HoverCardTrigger`/`HoverCardContent` from Radix. The
repo already ships that exact port. `LinkPreviewRootState` (verified in
`node_modules/bits-ui/dist/bits/link-preview/link-preview.svelte.js`) implements `openDelay`
(`handleOpen` → `setTimeout`), `closeDelay` (`handleClose`), pointer-enter/leave, focus/blur, a safe
polygon for pointer travel, an escape layer, a dismissible layer and a floating layer carrying
`side`/`sideOffset`/`align`/`alignOffset`/`avoidCollisions`/`collisionBoundary`/`collisionPadding` —
the complete upstream `Pick<HoverCardContentProps, …>`, name for name.

**Alternatives considered**: `$lib/components/ui/popover` (click-driven, not hover-driven);
`$lib/components/ui/tooltip` (`role="tooltip"`, no interactive content, no timezone list); rolling a
positioner (Principle IV forbids it, and it would drop the safe polygon and the escape layer).

## R-02 — `LinkPreview.Trigger` renders `<a>`, upstream renders `<button>`

**Decision**: render `HoverCard.Trigger` in `child` mode and place our own
`<button type="button">` inside it, spreading the merged bits props.

**Rationale**: `link-preview-trigger.svelte` renders `<a {...mergedProps}>` by default but exposes a
`child` snippet receiving `mergedProps`. Those props already carry `id`, `role="button"`,
`aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`, `data-state` and the four
pointer/focus handlers, so spreading them onto a `<button>` keeps every behaviour while matching
upstream's element. `type="button"` is added (`forms.md`) so the trigger never submits a
surrounding form — upstream's bare `<button>` inside a form would.

**Alternatives considered**: accepting the `<a>` (wrong element, needs `href` for keyboard focus);
adding `tabindex` to a `<span>` (re-implements button semantics).

## R-03 — `asChild` → the `child` snippet

**Decision**: expose `child?: Snippet<[{ props: RelativeTimeCardChildProps }]>` on the root. When
supplied, the caller's element replaces the `<button>` and receives the identical merged props
(bits handlers + `data-slot` + `data-variant` + trigger classes + `restProps`). `children` is not
rendered and `ref` stays `null` in `child` mode.

**Rationale**: the project convention, already shipped by `status.svelte`, `banner.svelte` and
`dialog-content.svelte`; the spec fixes it in Assumptions. Two of the four upstream demos use
`asChild` with a `<Button>`, so the capability is load-bearing, not theoretical.

## R-04 — `defaultOpen` does not exist on `LinkPreview.Root`

**Decision**: keep upstream's `defaultOpen` prop and seed it once —
`open = $bindable(); open ??= defaultOpen;` — then hand `bind:open` to `HoverCard.Root`.

**Rationale**: `LinkPreviewRootProps` has `open`, `onOpenChange`, `onOpenChangeComplete`,
`openDelay`, `closeDelay`, `disabled`, `ignoreNonKeyboardFocus` — no `defaultOpen`. Dropping the prop
would breach Principle II. The `??=` seed is the repo's established uncontrolled pattern
(`CLAUDE.md` §4, `banner.svelte`).

**Known limit, inherited from the banner port**: in Svelte a component cannot both accept
`bind:open` and refuse to move when `open` is passed without `bind:`. Writing an unbound `$bindable`
creates a local override. `onOpenChange` fires in both modes and the parent's binding stays
authoritative when bound — that is the documented contract, restated in
`contracts/public-api.md` §3.

## R-05 — Relative-time string: `Intl` only, upstream phrasing exactly

**Decision**: reproduce upstream's thresholds and branch order verbatim, but produce every word
through `Intl`. Four APIs, no word table, no hand-written pluralisation:

| Bucket (on `absDiff`)     | Past                                              | Future                            |
| ------------------------- | ------------------------------------------------- | --------------------------------- |
| `seconds < 5`             | `"just now"`                                      | `"just now"`                      |
| `seconds < 60`            | `rtf.format(-seconds, 'second')`                  | `rtf.format(seconds, 'second')`   |
| `minutes < 60`            | **compound** (below)                              | `rtf.format(minutes, 'minute')`   |
| `hours < 24`              | `rtf.format(-hours, 'hour')`                      | `rtf.format(hours, 'hour')`       |
| `days < 7`                | `rtf.format(-days, 'day')`                        | `rtf.format(days, 'day')`         |
| `days >= 7`               | `date.toLocaleDateString(locale)`                 | `date.toLocaleDateString(locale)` |

with `rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always', style: 'long' })`.

The **compound** past-minutes case is upstream's only two-unit string
(`"5 minutes 30 seconds ago"`). It is built without inventing any literal:

```
magnitude = new Intl.NumberFormat(locale, { style: 'unit', unit: 'minute', unitDisplay: 'long' }).format(minutes)
residual  = new Intl.NumberFormat(locale, { style: 'unit', unit: 'second', unitDisplay: 'long' }).format(seconds % 60)
compound  = new Intl.ListFormat(locale, { style: 'narrow', type: 'unit' }).format([magnitude, residual])
frame     = rtf.format(-minutes, 'minute')
result    = frame.includes(magnitude) ? frame.replace(magnitude, compound) : frame
```

Verified in Node 22 for `en-US`: `magnitude` → `"5 minutes"`, `residual` → `"30 seconds"`,
`compound` → `"5 minutes 30 seconds"`, `frame` → `"5 minutes ago"`, `result` →
`"5 minutes 30 seconds ago"` — character-identical to upstream's
`` `${pluralize(minutes,'minute')} ${pluralize(seconds % 60,'second')} ago` ``. The
`frame.includes(magnitude)` guard is the locale-safety net: a locale whose relative frame does not
embed the plain unit phrase degrades to the single-unit string rather than producing garbage.

**Note the asymmetry, which is preserved**: upstream shows the residual seconds only in the *past*
minutes branch; the future minutes branch is `"in 5 minutes"` with no seconds. Also
`pluralize(0, 'second')` yields `"0 seconds"`, so `"5 minutes 0 seconds ago"` is a real upstream
output and must stay one (`Intl.NumberFormat` produces the same `"0 seconds"`).

**`"just now"` stays a literal.** It is upstream's own English string and Principle II makes it the
contract. `Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'second')` would give
`"now"` — a different string, so it is rejected. This is the single untranslated literal in the port
and is recorded in the spec's Assumptions.

**Alternatives considered**: `rtf.formatToParts()` splicing (rejected — in `en` the noun and the
`" ago"` suffix share one literal part, so there is no locale-general insertion point);
`Intl.DurationFormat` (rejected — Baseline 2025, not yet in the repo's `lib.es*` typings, and it
carries no past/future framing).

## R-06 — Absolute formatting and the local timezone row

**Decision**: keep upstream's three `Intl.DateTimeFormat` shapes verbatim.

| Where                | Options                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------- |
| Trigger label        | `{ month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }`       |
| Row date             | `{ month: 'long', day: 'numeric', year: 'numeric', timeZone }`                                  |
| Row time             | `{ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone }`              |
| Row label (fallback) | `{ timeZoneName: 'shortOffset' }` → the `timeZoneName` part (`"GMT+2"`, `"GMT+0"` for UTC)      |

`locale = Intl.DateTimeFormat().resolvedOptions().locale`, exactly as upstream. The **local row** is
`<Timezone date={date} />` with no `timezone`, so every formatter omits `timeZone` and the runtime's
own zone applies; its label is the `shortOffset` lookup. Upstream renders the local row *after* the
listed ones and does not deduplicate — preserved (spec Edge Cases).

Verified in Node: `formatToParts` with `timeZoneName: 'shortOffset'` yields `"GMT+2"` for the ambient
zone and `"GMT+0"` for `timeZone: 'UTC'`.

## R-07 — Invalid input must not throw

**Decision**: three guards, none of which exist upstream:

1. `formatRelativeTime` returns `date.toLocaleDateString(locale)` (→ `"Invalid Date"`) when
   `Number.isNaN(date.getTime())`. `Date.prototype.toLocaleDateString` returns the string;
   `Intl.DateTimeFormat.prototype.format` **throws** `RangeError: Invalid time value` — so the
   invalid branch must use the `Date` method, not the formatter object.
2. `toIsoString(date)` returns `undefined` for an invalid date, so `<time datetime={…}>` omits the
   attribute instead of `date.toISOString()` throwing. Upstream crashes the render here; the spec's
   Edge Cases require that we do not.
3. Every `Intl.DateTimeFormat` construction that takes a caller-supplied `timeZone` is wrapped: an
   unknown IANA id throws `RangeError` at construction, so the helper falls back to formatting
   without `timeZone` and uses the raw identifier as the row label.

**Rationale**: FR/Edge Cases demand a non-throwing render; a registry component that throws on a
malformed API payload is unusable. The behaviour on *valid* input is bit-identical to upstream, so
this is additive hardening, not drift.

## R-08 — The live ticker: `$derived` for the string, `$effect` for the clock

**Decision**: the only irreducible mutable input is *now*. `RelativeTimeCardState` holds
`now = $state<number>(Date.now())`; the displayed string is
`$derived(formatRelativeTime(getDate(), new Date(this.now), getLocale()))`. A single `$effect` in the
root does `const id = setInterval(() => (state.now = Date.now()), getInterval()); return () => clearInterval(id);`.

**Rationale**: this is the "`useEffect` cleanup → `$effect` teardown; never mutate reactive state in
an `$effect` where `$derived` would do" rule applied literally. Upstream stores the *formatted
string* in `useState` and rewrites it on every tick and on every `date`/`updateInterval` change; the
derived form recomputes on a `date` change for free and needs no effect for it. The effect reads only
`getInterval()`, so changing `updateInterval` re-creates the timer and changing `date` does not. The
write to `state.now` happens in a timer callback — outside the effect's tracking scope — so no
self-invalidation is possible.

**Teardown is the requirement (FR-007, SC-003)**: the returned cleanup clears the interval; effects
do not run during SSR, so no server timer is created. Tested by asserting `vi.getTimerCount()` is `0`
after `unmount()`.

**Upstream divergence, recorded**: upstream seeds state with `date.toLocaleDateString()` and only
switches to the relative string after the first client effect (its `suppressHydrationWarning`
escape). The derived version renders the relative string immediately, including during SSR. Text may
therefore differ between the server render and hydration by the elapsed request time; the first
interval tick reconciles it, and no attribute or structure differs.

## R-09 — No context, no provider throw

**Decision**: the component needs **no** `setContext`/`getContext` and therefore ships no
`getXxxContext()` throwing helper.

**Rationale**: upstream has no `createContext`. The only parent→child data flow is
`date`/`timezone`, passed as props to the timezone row. Inventing a context to satisfy a checklist
item would be gratuitous. Consequence for Principle III's "part outside its provider throws" test
area: **not applicable**, exactly as recorded for `status` (which likewise has no provider); the test
file instead asserts the row renders standalone without throwing. Bits UI's own
`LinkPreview.Content` still throws its documented context error if the parts are torn apart, which
the tests assert.

## R-10 — Timezone row: a separate file, and it *is* exported

**Decision**: `relative-time-card-timezone.svelte`, exported from the barrel as
`Timezone` / `RelativeTimeCardTimezone`.

**Rationale**: `CLAUDE.md` §3 forbids two components in one `.svelte` file, so upstream's
`TimezoneCard` needs its own file regardless. Exporting it is an *additive* divergence (upstream
exports only `RelativeTimeCard`): the row is meaningful standalone — it takes an instant and a zone
and renders a labelled, accessible line — unlike `banner-queued.svelte`, which was kept internal
because it is meaningless outside its queue. The file ships in the registry entry either way, so
hiding it from the barrel would only force consumers to deep-import. Recorded in the spec's
Assumptions.

**Role subtlety, preserved verbatim**: upstream writes `role="region"` and `aria-label` *before*
`{...cardProps}`, and the parent passes `role="listitem"` — so the spread wins and each row is
really a `listitem` inside the `role="list"` wrapper, with `region` as the standalone default. Our
part must therefore put `role` and `aria-label` before `{...restProps}`, not after.

## R-11 — Keying the `{#each}`

**Decision**: key by index (`{#each timezones as timezone, index (index)}`), not by the timezone
string.

**Rationale**: the spec's Edge Cases require duplicates in `timezones` to render as separate rows. A
string-keyed `{#each}` throws `each_key_duplicate` at runtime on a duplicate — a crash where upstream
(React, keyed by `timezone`) merely warns. Index keys are correct here because the list is
positional and rows carry no internal state.

## R-12 — Styling translation

**Decision**:

- `cva(triggerVariants)` → `tv()` in `relative-time-card.svelte.ts`, exported, with the same three
  rows (`default: ''`, `muted`, `ghost`) and `defaultVariants.variant = 'default'`.
- Base row kept verbatim except `focus-visible:outline-none`, which is dropped in favour of the repo
  baseline: upstream pairs it with `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`,
  so the ring is preserved and the focus indicator is never suppressed (Principle III; the test file
  greps for outline suppressors, as `status.test.ts` does).
- `text-foreground/70`, `text-muted-foreground`, `bg-accent` are already semantic tokens — no palette
  colour appears anywhere in the component. The **variants demo** does use `text-blue-500`,
  `text-green-600`, `text-purple-500` for its "Custom styling" row; those map to `text-info`,
  `text-success` and `text-primary` in our demo page (`CLAUDE.md` §6 table).
- No `z-index` is written by this component; `hover-card-content.svelte` owns the overlay stacking.

## R-13 — RTL

**Decision**: no direction code. `LinkPreview.Content` takes `dir` through the floating layer and
mirrors `side`/`align` itself; the component uses only `flex`, `gap-*`, `justify-between` and
`items-center` — zero physical `ml-/mr-/pl-/pr-/left-/right-` utilities. The test asserts that
(a) no physical utility is present on any part and (b) the card still opens and keeps its row order
under `dir="rtl"`, which is the same shape `status.test.ts` and `marquee.test.ts` use.

## R-14 — Test strategy: pinned clock, no sleeping

**Decision**:

- `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-07-30T10:00:00Z'))` in `beforeEach`,
  `vi.useRealTimers()` in `afterEach`.
- `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` — mandatory, or `openDelay`
  never elapses under fake timers and every hover assertion hangs.
- Locale determinism: the pure formatters take an explicit `locale` parameter, so string assertions
  pass `'en-US'` and are exact. Component-level assertions compare rendered text against the same
  exported helper called with the resolved locale, so a CI box on `en-150` cannot produce a false
  failure.
- Live update: advance by `updateInterval` and assert the text changed; `unmount()` then assert
  `vi.getTimerCount() === 0` (SC-003, no leaked timers).
- `:focus-visible` is required by `LinkPreviewTriggerState.onfocus`. Verified: jsdom 30 (the version
  installed) returns `false` before focus and `true` after `.focus()`, so `user.tab()` opens the card.
- Portalled content: `HoverCard.Content` portals to `document.body`, so queries must use `screen`,
  not the render `container`.

## R-15 — Dependencies

**Decision**: **zero new npm dependencies.**

| Upstream import                          | Here                                                             |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `class-variance-authority`               | `tailwind-variants@^3.3.0` (`tv()`), already installed            |
| `radix-ui` `Slot`                        | the `child` snippet                                               |
| `@/registry/bases/radix/ui/hover-card`   | `$lib/components/ui/hover-card` (composes `bits-ui@^2.18.1`)      |
| `@/lib/utils` `cn`                       | `$lib/utils.js` `cn`                                              |
| `lucide-react` (demos only)              | `@lucide/svelte@^1.27.0` (`@lucide/svelte/icons/clock`)           |

`Intl.RelativeTimeFormat`, `Intl.NumberFormat` (`style: 'unit'`), `Intl.ListFormat` and
`Intl.DateTimeFormat` are all platform APIs available in Node 18+ and every evergreen browser; none
adds a package.

## R-16 — The shared module for later ports

**Decision**: the pure formatters live in `relative-time-format.ts` — a plain `.ts` module (no
runes), listed in the registry entry, importable by future components as
`$lib/components/ui/relative-time-card/relative-time-format.js` with `relative-time-card` added to
their `registryDependencies`.

**Rationale**: `time-picker`, `timeline`, `data-table` and `stat` all have upstream date formatting.
Precedent for a rune-free `.ts` inside a component folder: `masonry-positioner.ts` and
`masonry-interval-tree.ts`. Hoisting it to `$lib/` instead would leave a registry file with no owning
item, which breaks `shadcn-svelte add` on the consumer side (Principle V).
