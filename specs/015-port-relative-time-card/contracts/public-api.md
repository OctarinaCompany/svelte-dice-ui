# Public API Contract: Relative Time Card

**Feature**: `015-port-relative-time-card` | **Date**: 2026-07-30

This is the installable surface. It is authoritative for `plan.md`, `tasks.md`, the tests and the
demo page's API tables. Every prop is traced to
`.reference/diceui/docs/types/radix/relative-time-card.ts` (the documented API) and
`.reference/diceui/docs/registry/bases/radix/ui/relative-time-card.tsx` (the implementation), read at
the pinned commit.

---

## 1. `RelativeTimeCard` — `relative-time-card.svelte`

Upstream `RelativeTimeCard` (relative-time-card.tsx:143-248). Renders the hover-card root, the
trigger `<button>` and the card content. It renders **no wrapper element** of its own; `class`,
`ref` and `restProps` all land on the trigger, exactly as upstream.

### 1.1 Own props

| Prop             | Type                                        | Default                    | Bindable | Upstream                     |
| ---------------- | ------------------------------------------- | -------------------------- | -------- | ---------------------------- |
| `date`           | `Date \| string \| number` **(required)**   | —                          | no       | `date`                        |
| `timezones`      | `string[]`                                  | `['UTC']`                  | no       | `timezones`                   |
| `updateInterval` | `number`                                    | `1000`                     | no       | `updateInterval`              |
| `variant`        | `'default' \| 'muted' \| 'ghost'`           | `'default'`                | no       | `variant` (cva)               |
| `ref`            | `HTMLButtonElement \| null`                 | `null`                     | **yes**  | `forwardRef`                  |
| `class`          | `string \| undefined`                       | `undefined`                | no       | `className` → trigger         |
| `children`       | `Snippet`                                   | `undefined`                | no       | `children`                    |
| `child`          | `Snippet<[{ props: RelativeTimeCardChildProps }]>` | `undefined`          | no       | `asChild` (R-03)              |

### 1.2 Open-state props (forwarded to `HoverCard.Root`)

| Prop           | Type                          | Default     | Bindable | Upstream        |
| -------------- | ----------------------------- | ----------- | -------- | --------------- |
| `open`         | `boolean \| undefined`        | `undefined` | **yes**  | `open`          |
| `defaultOpen`  | `boolean`                     | `false`     | no       | `defaultOpen`   |
| `onOpenChange` | `(open: boolean) => void`     | `undefined` | no       | `onOpenChange`  |
| `openDelay`    | `number`                      | `500`       | no       | `openDelay`     |
| `closeDelay`   | `number`                      | `300`       | no       | `closeDelay`    |

### 1.3 Positioning props (forwarded to `HoverCard.Content`)

Typed as one `Pick` off the bits-ui content props — the same seven names upstream `Pick`s off
`HoverCardContentProps`, so the types cannot drift:

```ts
type RelativeTimeCardPositioningProps = Pick<
	HoverCardPrimitive.ContentProps,
	'side' | 'sideOffset' | 'align' | 'alignOffset' | 'avoidCollisions' | 'collisionBoundary' | 'collisionPadding'
>;
```

| Prop                | Type                                                    | Default (effective)         | Upstream default |
| ------------------- | ------------------------------------------------------- | --------------------------- | ---------------- |
| `side`              | `'top' \| 'right' \| 'bottom' \| 'left'`                | `'top'` (bits)               | `'bottom'`       |
| `sideOffset`        | `number`                                                | `4` (our `hover-card`)       | `0`              |
| `align`             | `'start' \| 'center' \| 'end'`                          | `'center'` (our `hover-card`)| `'center'`       |
| `alignOffset`       | `number`                                                | `0` (bits)                   | `0`              |
| `avoidCollisions`   | `boolean`                                               | `true` (bits)                | `true`           |
| `collisionBoundary` | bits `Boundary`                                         | viewport                     | `[]`             |
| `collisionPadding`  | `number \| Partial<Record<Side, number>>`               | `0` (bits)                   | `0`              |

`sideOffset` and `side` are the changed defaults — `LinkPreview.Content` defaults `side` to `'top'`,
not `'bottom'` as this table first recorded, and the port forwards `undefined` rather than
re-declaring a value; the spec's Assumptions already accept the composed `hover-card` defaults. All seven are `undefined` by default in our props so the composed part's own
default applies — the port never re-declares a value.

### 1.4 Everything else

`WithElementRef<HTMLButtonAttributes, HTMLButtonElement>` — every native button attribute and DOM
handler (`id`, `aria-*`, `disabled`, `onclick`, `data-testid`, …) is spread onto the trigger after
the bits props and before nothing, so `class` (destructured out) always wins. Upstream's
`React.ComponentProps<"button">` is the same surface.

### 1.5 Rendered tree

```html
<!-- HoverCard.Root (bind:open, openDelay, closeDelay, onOpenChange) -->
<button
  type="button"
  data-slot="relative-time-card-trigger"
  data-variant="default"
  data-state="closed"          <!-- bits -->
  data-invalid                  <!-- only when `date` does not parse -->
  role="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="…"
  class="…triggerVariants(variant)… + caller class"
>
  <!-- children, or the default: -->
  <time datetime="2026-07-30T10:00:00.000Z">Jul 30, 2026, 10:00 AM</time>
</button>

<!-- portalled -->
<div data-slot="relative-time-card-content" data-state="open" data-side="bottom" class="flex w-full max-w-[420px] flex-col gap-2 p-3 …">
  <time data-slot="relative-time-card-value" datetime="…" class="text-sm text-muted-foreground">5 minutes ago</time>
  <div data-slot="relative-time-card-timezones" role="list" class="flex flex-col gap-1">
    <!-- one row per `timezones`, then the local row -->
  </div>
</div>
```

### 1.6 Callbacks

- `onOpenChange(open: boolean)` — fired by `bits-ui` on every open/close transition, in both modes.
- No other callback exists upstream; none is added.

---

## 2. `RelativeTimeCardTimezone` — `relative-time-card-timezone.svelte`

Upstream `TimezoneCard` (relative-time-card.tsx:46-105). Exported additively (research R-10).

| Prop       | Type                          | Default     | Bindable |
| ---------- | ----------------------------- | ----------- | -------- |
| `date`     | `Date \| string \| number` **(required)** | —  | no       |
| `timezone` | `string \| undefined`         | `undefined` → viewer's local zone | no |
| `ref`      | `HTMLDivElement \| null`      | `null`      | **yes**  |
| `class`    | `string \| undefined`         | `undefined` | no       |
| rest       | `HTMLAttributes<HTMLDivElement>` | —        | no       |

Renders:

```html
<div
  data-slot="relative-time-card-timezone"
  data-timezone="UTC"           <!-- the id, or the resolved short offset for the local row -->
  data-local                     <!-- present only when `timezone` is undefined -->
  role="region"                  <!-- overridable: the root passes role="listitem" -->
  aria-label="Time in UTC: July 30, 2026 10:00:00 AM"
  class="flex items-center justify-between gap-2 text-sm text-muted-foreground …"
>
  <span class="w-fit rounded bg-accent px-1 text-xs font-medium">UTC</span>
  <div class="flex items-center gap-2">
    <time datetime="…">July 30, 2026</time>
    <time datetime="…" class="tabular-nums">10:00:00 AM</time>
  </div>
</div>
```

`role` and `aria-label` are written **before** `{...restProps}` so a caller (and the root, which
passes `role="listitem"`) can override them — upstream's exact ordering (R-10). Upstream drops the
caller's `className` entirely (its `className=` follows the spread); ours merges it last through
`cn()`, per Principle VIII. Recorded as a divergence.

---

## 3. Controlled vs uncontrolled

| Usage                                       | Who owns `open`     | `onOpenChange`         |
| ------------------------------------------- | ------------------- | ---------------------- |
| `<RelativeTimeCard {date} />`               | the component       | not supplied           |
| `<RelativeTimeCard {date} defaultOpen />`   | the component, seeded `true` | optional      |
| `<RelativeTimeCard {date} bind:open />`     | the parent          | fires as well          |
| `<RelativeTimeCard {date} {open} onOpenChange={…} />` | see below  | fires                  |

`open` is `$bindable()` and seeded once with `open ??= defaultOpen`. React's "an unbound `open` prop
freezes the component" cannot be reproduced in Svelte — writing an unbound `$bindable` creates a
local override — so in the last row the component still moves and reports through `onOpenChange`.
This is the same documented limit the `banner` port carries, and the tests pin both the bound and
the callback path.

---

## 4. Keyboard and ARIA contract

| Key                    | Result                                                     | Owner            |
| ---------------------- | ---------------------------------------------------------- | ---------------- |
| `Tab` onto the trigger | `:focus-visible` → opens after `openDelay`                  | bits trigger     |
| `Tab` off the trigger  | blur → closes after `closeDelay`                            | bits trigger     |
| `Enter` / `Space`      | native button activation; the card is open (focus opened it) | native + bits    |
| `Escape` (card open)   | closes immediately                                          | bits escape layer |
| pointer enter / leave  | opens after `openDelay` / closes after `closeDelay`         | bits + safe polygon |

ARIA on the trigger: `role="button"`, `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`
(all from bits). Each timezone row is a `listitem` inside `role="list"` and carries an
`aria-label` naming the zone, its date and its time (FR-013). The relative time is a `<time>` with a
`datetime` attribute.

Focus is never suppressed: the trigger keeps `focus-visible:ring-2 focus-visible:ring-ring
focus-visible:ring-offset-2` and no `outline-none` utility (research R-12).

---

## 5. Variant rows — `relativeTimeCardTriggerVariants` (`tv()`)

**Base**

```
inline-flex w-fit items-center justify-center text-sm text-foreground/70 transition-colors
hover:text-foreground/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
```

**Variants**

| `variant`   | Classes                                       |
| ----------- | --------------------------------------------- |
| `'default'` | *(none)*                                      |
| `'muted'`   | `text-foreground/50 hover:text-foreground/70`  |
| `'ghost'`   | `hover:underline`                              |

`defaultVariants: { variant: 'default' }`. Upstream's `focus-visible:outline-none` is dropped
(R-12); everything else is verbatim.

---

## 6. Module exports — `relative-time-card.svelte.ts`

```ts
export const RELATIVE_TIME_CARD_VARIANTS: readonly ['default', 'muted', 'ghost'];
export type RelativeTimeCardVariant = (typeof RELATIVE_TIME_CARD_VARIANTS)[number];
export function resolveRelativeTimeCardVariant(value?: string): RelativeTimeCardVariant;
export const relativeTimeCardTriggerVariants: ReturnType<typeof tv>;
export const DEFAULT_TIMEZONES: readonly string[];
export const DEFAULT_UPDATE_INTERVAL: 1000;
export const DEFAULT_OPEN_DELAY: 500;
export const DEFAULT_CLOSE_DELAY: 300;
export class RelativeTimeCardState { /* data-model.md §6 */ }
export type RelativeTimeCardStateProps = { … };
```

## 7. Module exports — `relative-time-format.ts` (the reusable module)

```ts
export const JUST_NOW_THRESHOLD_SECONDS: 5;
export const RELATIVE_CUTOFF_DAYS: 7;
export const JUST_NOW_LABEL: 'just now';
export type DateInput = Date | string | number;
export type RelativeTimeParts = { isFuture: boolean; seconds: number; minutes: number; hours: number; days: number };

export function toDate(value: DateInput): Date;
export function isValidDate(date: Date): boolean;
export function toIsoString(date: Date): string | undefined;
export function resolveLocale(): string;
export function diffRelativeTime(date: Date, now: Date): RelativeTimeParts;
export function formatRelativeTime(date: Date, now: Date, locale: string): string;
// `formatRelativeTime` against an epoch timestamp. A runes module may not build a mutable `Date`
// (`svelte/prefer-svelte-reactivity`), so `RelativeTimeCardState` keeps *now* as a number and
// converts it here, in this rune-free module.
export function formatRelativeTimeAt(date: Date, now: number, locale: string): string;
export function formatAbsoluteDateTime(date: Date, locale: string): string;
export function formatZonedDate(date: Date, locale: string, timeZone?: string): string;
export function formatZonedTime(date: Date, locale: string, timeZone?: string): string;
export function formatTimeZoneLabel(date: Date, locale: string, timeZone?: string): string;
export function formatTimeZoneAccessibleName(date: Date, locale: string, timeZone?: string): string;
```

Later ports reuse this file by importing
`$lib/components/ui/relative-time-card/relative-time-format.js` and adding `relative-time-card` to
their `registryDependencies`.

## 8. Barrel — `index.ts`

```ts
import Root from './relative-time-card.svelte';
import Timezone from './relative-time-card-timezone.svelte';

export type { RelativeTimeCardProps, RelativeTimeCardChildProps } from './relative-time-card.svelte';
export type { RelativeTimeCardTimezoneProps } from './relative-time-card-timezone.svelte';

export {
	RELATIVE_TIME_CARD_VARIANTS,
	DEFAULT_TIMEZONES,
	DEFAULT_UPDATE_INTERVAL,
	DEFAULT_OPEN_DELAY,
	DEFAULT_CLOSE_DELAY,
	relativeTimeCardTriggerVariants,
	resolveRelativeTimeCardVariant,
	RelativeTimeCardState,
	type RelativeTimeCardVariant,
	type RelativeTimeCardStateProps
} from './relative-time-card.svelte.js';

export {
	JUST_NOW_LABEL,
	JUST_NOW_THRESHOLD_SECONDS,
	RELATIVE_CUTOFF_DAYS,
	toDate,
	isValidDate,
	toIsoString,
	resolveLocale,
	diffRelativeTime,
	formatRelativeTime,
	formatAbsoluteDateTime,
	formatZonedDate,
	formatZonedTime,
	formatTimeZoneLabel,
	formatTimeZoneAccessibleName,
	type DateInput,
	type RelativeTimeParts
} from './relative-time-format.js';

export {
	Root,
	Timezone,
	//
	Root as RelativeTimeCard,
	Timezone as RelativeTimeCardTimezone
};
```

Both usage styles work:

```ts
import * as RelativeTimeCard from '$lib/components/ui/relative-time-card/index.js'; // .Root, .Timezone
import { RelativeTimeCard, RelativeTimeCardTimezone } from '$lib/components/ui/relative-time-card/index.js';
```

## 9. Registry entry (appended to `registry.json`, 16th item)

```jsonc
{
	"name": "relative-time-card",
	"type": "registry:ui",
	"title": "Relative Time Card",
	"description": "A hover card that displays relative time relative to local time with timezone information.",
	"registryDependencies": ["hover-card"],
	"dependencies": ["bits-ui", "tailwind-variants"],
	"files": [
		{ "path": "src/lib/components/ui/relative-time-card/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/relative-time-card/relative-time-card.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/relative-time-card/relative-time-card-timezone.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/relative-time-card/relative-time-card.svelte.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/relative-time-card/relative-time-format.ts", "type": "registry:ui" }
	]
}
```

Test files (`relative-time-card.test.ts`, `relative-time-card.test.svelte`) are **not** listed.
`pnpm run registry:build` is run afterwards; output lands in `static/r/`.

## 10. Divergences from upstream (all recorded in `spec.md` Assumptions)

| # | Upstream                                   | Here                                                          | Why                          |
| - | ------------------------------------------ | ------------------------------------------------------------- | ---------------------------- |
| 1 | `asChild` (Radix `Slot`)                   | `child` snippet                                                | no Svelte equivalent (R-03)  |
| 2 | Radix `HoverCard`                          | `$lib/components/ui/hover-card` (bits-ui `LinkPreview`)        | Principle IV (R-01)          |
| 3 | hand-written `pluralize()` + concatenation | `Intl.RelativeTimeFormat` + `NumberFormat` + `ListFormat`      | explicit guidance (R-05)     |
| 4 | `sideOffset` default `0`                   | `4` (the composed `hover-card` default)                       | composition (spec)           |
| 5 | crashes on an unparseable `date`           | renders `Invalid Date`, omits `datetime`, no throw            | spec Edge Cases (R-07)       |
| 6 | crashes on an unknown IANA `timezone`      | raw id as label, local formatting, no throw                    | R-07                         |
| 7 | exports `RelativeTimeCard` only            | also exports `RelativeTimeCardTimezone`                        | additive (R-10)              |
| 8 | `TimezoneCard` drops the caller's `className` | merges it last via `cn()`                                   | Principle VIII               |
| 9 | `focus-visible:outline-none` on the trigger | dropped; the ring utilities stay                              | Principle III (R-12)         |
| 10| formatted string in `useState`, seeded with a plain date | `$derived`, correct from the first render (incl. SSR) | R-08                     |
| 11| `variant: "default" \| "subtle" \| "ghost"` in the JSDoc | `"muted"`, per the implementation and both demos | spec Assumptions        |
