# Quickstart & Validation: Relative Time Card

**Feature**: `015-port-relative-time-card` | **Date**: 2026-07-30

Prerequisites: dependencies installed (`pnpm install`), repo root `D:\Code\svelte-dice-ui`, no new
npm package required (research R-15). Types and props: [`contracts/public-api.md`](./contracts/public-api.md).
Behaviour tables: [`data-model.md`](./data-model.md).

---

## Usage

```svelte
<script lang="ts">
	import { RelativeTimeCard } from '$lib/components/ui/relative-time-card/index.js';

	const publishedAt = new Date(Date.now() - 5 * 60 * 1000);
	let open = $state(false);
</script>

<!-- default: trigger shows "Jul 30, 2026, 10:00 AM"; card lists UTC + the local zone -->
<RelativeTimeCard date={publishedAt} />

<!-- string / number input, multiple zones, subtler trigger, slower ticker -->
<RelativeTimeCard
	date="2026-03-20T10:30:00Z"
	timezones={['America/New_York', 'Europe/London', 'Asia/Tokyo']}
	variant="muted"
	updateInterval={5000}
	side="top"
	align="start"
/>

<!-- controlled -->
<RelativeTimeCard date={publishedAt} bind:open onOpenChange={(next) => console.log(next)} />

<!-- custom trigger content -->
<RelativeTimeCard date={publishedAt} variant="ghost">Published</RelativeTimeCard>
```

Replacing the trigger element entirely (upstream's `asChild`):

```svelte
<script lang="ts">
	import { RelativeTimeCard } from '$lib/components/ui/relative-time-card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import ClockIcon from '@lucide/svelte/icons/clock';
</script>

<RelativeTimeCard date={new Date()}>
	{#snippet child({ props })}
		<Button variant="outline" size="sm" {...props}>
			<ClockIcon />
			View time details
		</Button>
	{/snippet}
</RelativeTimeCard>
```

Reusing the formatters from another component:

```ts
import {
	formatRelativeTime,
	resolveLocale
} from '$lib/components/ui/relative-time-card/relative-time-format.js';

const label = formatRelativeTime(new Date(iso), new Date(), resolveLocale());
```

---

## Validation

### V-1 — Anti-cheat (Principle VI / VII)

All five greps must return nothing:

```bash
grep -rnE "@ts-(ignore|expect-error)|eslint-disable|svelte-ignore" src/lib/components/ui/relative-time-card src/routes/docs/components/relative-time-card
grep -rnE "\bas any\b|: any\b"                                    src/lib/components/ui/relative-time-card
grep -rnE "\.(skip|todo|only)\(" 														src/lib/components/ui/relative-time-card
grep -rnE "export let|createEventDispatcher|writable\(|<slot" 	   src/lib/components/ui/relative-time-card
grep -rnE "(bg|text|border)-(red|green|blue|orange|purple|emerald|gray|slate|zinc)-[0-9]" src/lib/components/ui/relative-time-card src/routes/docs/components/relative-time-card
```

Also confirm no docs-app import reaches the component (Principle V):

```bash
grep -rn "\$lib/components/docs\|src/routes" src/lib/components/ui/relative-time-card
```

### V-2 — Formatter parity (US1, FR-006, edge cases)

`relative-time-card.test.ts`, fake timers pinned to `2026-07-30T10:00:00Z`, `locale = 'en-US'`,
asserting every row of `data-model.md` §5 including `just now` (<5 s, both directions),
`30 seconds ago` / `in 30 seconds`, `5 minutes 30 seconds ago`, `5 minutes 0 seconds ago`,
`in 5 minutes` (no residual), `2 hours ago`, `3 days ago`, the ≥7-day locale-date fallback in both
directions, and `Invalid Date` for `new Date('nope')` — with no throw.

### V-3 — Trigger and card rendering (US1, US2, FR-002, FR-005, FR-013)

- trigger is a `<button type="button">` carrying `data-slot="relative-time-card-trigger"` and a
  `<time datetime="…ISO…">` whose text equals `formatAbsoluteDateTime(date, locale)`;
- `date` given as a `string` and as a `number` render identically to the `Date` form;
- hovering (`user.hover` + `vi.advanceTimersByTime(500)`) opens the card; `user.unhover` +
  `advanceTimersByTime(300)` closes it;
- the open card contains one `listitem` per `timezones` entry **plus** one local row, in that order,
  each with an accessible name matching `/^Time in .+: .+ .+$/`;
- `timezones={[]}` → exactly one row; `timezones={['UTC','UTC']}` → three rows (no dedup, no
  `each_key_duplicate` crash — research R-11).

### V-4 — Live ticker and teardown (FR-007, SC-003)

Advance `updateInterval` and assert the card's relative text advanced; change `updateInterval`
through `rerender` and assert the new cadence; `unmount()` then assert `vi.getTimerCount() === 0`
and that no further update occurs.

### V-5 — Controlled / uncontrolled and keyboard (US2, US4, FR-009, FR-014)

`defaultOpen` seeds an open card; `bind:open` (through `relative-time-card.test.svelte`) keeps the
parent authoritative; `onOpenChange` fires with `true` on focus-open and `false` on `Escape`.
Keyboard: `user.tab()` focuses the trigger and opens after `openDelay`; `Escape` closes; tabbing away
closes after `closeDelay`; `Enter` on the focused trigger leaves the card open.

### V-6 — Variants, class merge, `child`, a11y, RTL (US3, FR-004, FR-011, FR-012, FR-015)

Each of the three variants applies its documented row and `data-variant`; a caller `class` wins a
conflict; the `child` snippet renders onto a `<Button>` that is still the trigger and still opens the
card; no `outline-none` utility on any part; no physical `ml-/mr-/pl-/pr-/left-/right-` utility; the
card opens and keeps its row order under `dir="rtl"`.

### V-7 — Demo route and registry (Principle IX, V)

`src/routes/docs/components/relative-time-card/+page.svelte` exists with one `<ComponentPreview>` per
upstream demo file (Default, Basic, Timezones, Variants) plus Controlled and the API tables;
`registry.json` contains the `relative-time-card` entry of `contracts/public-api.md` §9 and
`pnpm run registry:build` regenerates `static/r/relative-time-card.json`.

### V-8 — Quality gates (Principle VII)

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

All five green, with nothing suppressed and no test skipped.
