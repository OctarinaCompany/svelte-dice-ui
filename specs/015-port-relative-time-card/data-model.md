# Phase 1 Data Model: Relative Time Card

**Feature**: `015-port-relative-time-card` | **Date**: 2026-07-30

The component has no store, no collection and no context. Its whole model is: **one instant**, **one
clock**, **a list of zone identifiers**, and **the pure functions that turn those into strings**.

---

## 1. Constants — `relative-time-card.svelte.ts`

| Name                              | Value                          | Upstream origin                                    |
| --------------------------------- | ------------------------------ | -------------------------------------------------- |
| `DEFAULT_TIMEZONES`               | `['UTC']` (frozen)             | `timezones = ["UTC"]` (line 147)                    |
| `DEFAULT_UPDATE_INTERVAL`         | `1000`                         | `updateInterval = 1000` (line 160)                  |
| `DEFAULT_OPEN_DELAY`              | `500`                          | `openDelay = 500` (line 152)                        |
| `DEFAULT_CLOSE_DELAY`             | `300`                          | `closeDelay = 300` (line 153)                       |
| `RELATIVE_TIME_CARD_VARIANTS`     | `['default','muted','ghost']`  | `triggerVariants.variants.variant` (lines 107-121)  |

## 2. Constants — `relative-time-format.ts`

| Name                       | Value  | Upstream origin                                   |
| -------------------------- | ------ | ------------------------------------------------- |
| `JUST_NOW_THRESHOLD_SECONDS` | `5`  | `if (seconds < 5) return "just now"` (line 28)     |
| `RELATIVE_CUTOFF_DAYS`       | `7`  | `if (days < 7) …` then the date fallback (34, 42)  |
| `JUST_NOW_LABEL`             | `'just now'` | line 28 — the port's only literal string (research R-05) |

## 3. Entities

### 3.1 `DateInput`

```ts
type DateInput = Date | string | number;
```

Normalised once by `toDate(value)`: `value instanceof Date ? value : new Date(value)` — upstream's
memo (lines 167-170) with no copy, so a caller-owned `Date` identity is preserved.

**Validity**: `isValidDate(date)` ⇔ `!Number.isNaN(date.getTime())`. An invalid date is a *rendered
state*, never a throw (research R-07). It surfaces as `data-invalid` on the trigger.

### 3.2 `RelativeTimeParts` — the intermediate breakdown

Computed by `diffRelativeTime(date, now)`; it is upstream lines 18-27 lifted out so the bucket
selection is testable in isolation.

| Field       | Type      | Definition                                    |
| ----------- | --------- | --------------------------------------------- |
| `isFuture`  | `boolean` | `now.getTime() - date.getTime() < 0`           |
| `seconds`   | `number`  | `Math.floor(absDiff / 1000)`                   |
| `minutes`   | `number`  | `Math.floor(seconds / 60)`                     |
| `hours`     | `number`  | `Math.floor(minutes / 60)`                     |
| `days`      | `number`  | `Math.floor(hours / 24)`                       |

### 3.3 `TimezoneRowModel` — what one row renders

| Field           | Source                                                                      |
| --------------- | --------------------------------------------------------------------------- |
| `label`         | `timezone ?? shortOffset(date, locale)` — the raw IANA id when supplied      |
| `formattedDate` | `{ month:'long', day:'numeric', year:'numeric', timeZone }`                   |
| `formattedTime` | `{ hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true, timeZone }` |
| `accessibleName`| `` `Time in ${label}: ${formattedDate} ${formattedTime}` ``                    |
| `isLocal`       | `timezone === undefined`                                                      |

Rendered list = one row per `timezones[i]` (index-keyed, R-11) **plus** exactly one local row,
appended last. No deduplication (spec Edge Cases).

## 4. Pure functions — `relative-time-format.ts`

All are side-effect free, take `locale` explicitly and never throw. This is the module later ports
reuse (research R-16).

| Signature                                                                              | Returns                                                            |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `toDate(value: DateInput): Date`                                                        | normalised instant                                                  |
| `isValidDate(date: Date): boolean`                                                      | validity                                                            |
| `toIsoString(date: Date): string \| undefined`                                          | `date.toISOString()`, or `undefined` when invalid (R-07)            |
| `resolveLocale(): string`                                                               | `Intl.DateTimeFormat().resolvedOptions().locale`                    |
| `diffRelativeTime(date: Date, now: Date): RelativeTimeParts`                            | §3.2                                                                |
| `formatRelativeTime(date: Date, now: Date, locale: string): string`                     | the live string — §5                                                |
| `formatAbsoluteDateTime(date: Date, locale: string): string`                            | trigger label (`short`/`numeric`/`numeric`/`2-digit`/`2-digit`)     |
| `formatZonedDate(date: Date, locale: string, timeZone?: string): string`                | row date                                                            |
| `formatZonedTime(date: Date, locale: string, timeZone?: string): string`                | row time                                                            |
| `formatTimeZoneLabel(date: Date, locale: string, timeZone?: string): string`            | `timeZone ?? shortOffset`, raw id on `RangeError`                   |
| `formatTimeZoneAccessibleName(date, locale, timeZone?): string`                         | `` `Time in ${label}: ${date} ${time}` ``                           |

## 5. `formatRelativeTime` — the state table

Branch order is upstream's, top to bottom; the first match wins.

| # | Guard                              | Past output                                                    | Future output                     |
| - | ---------------------------------- | -------------------------------------------------------------- | --------------------------------- |
| 0 | `!isValidDate(date)`               | `date.toLocaleDateString(locale)` → `"Invalid Date"`            | same                              |
| 1 | `seconds < 5`                      | `"just now"`                                                    | `"just now"`                      |
| 2 | `seconds < 60`                     | `rtf.format(-seconds, 'second')` → `"30 seconds ago"`           | `"in 30 seconds"`                 |
| 3 | `minutes < 60`                     | compound → `"5 minutes 30 seconds ago"`                         | `"in 5 minutes"` *(no residual)*  |
| 4 | `hours < 24`                       | `"2 hours ago"`                                                 | `"in 2 hours"`                    |
| 5 | `days < 7`                         | `"3 days ago"`                                                  | `"in 3 days"`                     |
| 6 | otherwise                          | `date.toLocaleDateString(locale)`                               | same                              |

`rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always', style: 'long' })`. Row 3's compound
construction, its `includes` guard and the deliberate past/future asymmetry are specified in
research R-05. Row 3 keeps `"0 seconds"` when `seconds % 60 === 0` (upstream parity).

**Worked examples at `locale = 'en-US'`, `now = 2026-07-30T10:00:00Z`:**

| `date`                     | Output                          |
| -------------------------- | ------------------------------- |
| `2026-07-30T09:59:58Z`     | `just now`                      |
| `2026-07-30T09:59:30Z`     | `30 seconds ago`                |
| `2026-07-30T09:54:30Z`     | `5 minutes 30 seconds ago`      |
| `2026-07-30T09:55:00Z`     | `5 minutes 0 seconds ago`       |
| `2026-07-30T08:00:00Z`     | `2 hours ago`                   |
| `2026-07-27T10:00:00Z`     | `3 days ago`                    |
| `2026-07-20T10:00:00Z`     | `7/20/2026` (locale date)       |
| `2026-07-30T10:05:30Z`     | `in 5 minutes`                  |
| `2026-08-06T10:00:00Z`     | `7/22/2026`-style locale date   |
| `new Date('nope')`         | `Invalid Date`                  |

## 6. `RelativeTimeCardState` — the only reactive class

`relative-time-card.svelte.ts`. Constructed by the root; inputs arrive as getter functions
(`CLAUDE.md` §4), never as snapshots.

```ts
type RelativeTimeCardStateProps = {
	getDate: () => Date;
	getLocale: () => string;
	getUpdateInterval: () => number;
};
```

| Member                     | Kind                       | Notes                                                        |
| -------------------------- | -------------------------- | ------------------------------------------------------------ |
| `now`                      | `$state<number>`           | seeded `Date.now()`; the sole mutable input                   |
| `date`                     | `$derived`                 | `this.#props.getDate()`                                       |
| `isValid`                  | `$derived`                 | `isValidDate(this.date)`                                      |
| `isoString`                | `$derived`                 | `toIsoString(this.date)`                                      |
| `absoluteLabel`            | `$derived`                 | trigger text                                                  |
| `relativeLabel`            | `$derived`                 | `formatRelativeTime(this.date, new Date(this.now), locale)`   |
| `startTicker(): () => void`| method                     | `setInterval` → returns `clearInterval` teardown              |

`startTicker()` reads **only** `getUpdateInterval()`, so the root's
`$effect(() => state.startTicker())` re-subscribes on an interval change and not on a `date` change
(the label is derived and updates by itself). The interval callback writes `this.now` from outside
the effect's tracking scope, so there is no self-invalidation (research R-08).

**Lifecycle**

```
component init ──▶ now = Date.now()          (SSR renders here; no effect runs)
       │
   $effect ──▶ startTicker() ──▶ setInterval(interval)
       │                              │
       │                    every `interval` ms: now = Date.now() ──▶ relativeLabel recomputes
       │
 interval prop changes ──▶ teardown clearInterval ──▶ startTicker() again
       │
   unmount ──▶ teardown clearInterval  ──▶ zero timers remain (SC-003)
```

## 7. Open-state model

| Mode           | Trigger                                           | Behaviour                                                                 |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| Uncontrolled   | nothing passed, or `defaultOpen`                  | `open ??= defaultOpen` seeds once; `bits-ui` drives it                    |
| Bound          | `bind:open`                                       | parent's variable is the single source; `onOpenChange` also fires          |
| Callback-only  | `open={x}` + `onOpenChange`                       | see the documented Svelte limit in research R-04 / contract §3             |

Open/close transitions themselves are entirely `LinkPreviewRootState`'s: pointer enter → `openDelay`
timer → open; pointer leave / blur → `closeDelay` timer → closed; `Escape` → escape layer → closed;
focus (`:focus-visible`) → `openDelay` timer → open. The port adds no timing logic of its own.

## 8. Data attributes

| Element                    | `data-slot`                        | State attributes                                            |
| -------------------------- | ---------------------------------- | ------------------------------------------------------------ |
| trigger `<button>`         | `relative-time-card-trigger`       | `data-variant`, `data-state` (bits), `data-invalid` (`''`/absent) |
| card                       | `relative-time-card-content`       | `data-state`, `data-side`, `data-align` (all bits)            |
| relative `<time>`          | `relative-time-card-value`         | —                                                             |
| rows wrapper               | `relative-time-card-timezones`     | `role="list"`                                                 |
| one row                    | `relative-time-card-timezone`      | `data-timezone`, `data-local` (`''`/absent), `role="listitem"` |

Booleans use `cond ? '' : undefined` (Principle VIII).
