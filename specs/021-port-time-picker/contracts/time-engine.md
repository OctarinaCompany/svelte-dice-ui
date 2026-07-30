# Contract: shared modules exported for reuse

**Feature**: `021-port-time-picker` | **Date**: 2026-07-31

Deliverable 5 of the plan: what this port **exports for later components**, and what it **consumes**
from earlier ones. Both surfaces are part of the registry item and are re-exported from
`src/lib/components/ui/time-picker/index.ts`.

---

## A. `time-engine.ts` — pure, rune-free, SSR-safe, directly unit-testable

Imports nothing from Svelte and touches no DOM. Every function is **total**: it never throws, and every
listed input maps to a listed output.

### Types

```ts
export const SEGMENTS: readonly ['hour', 'minute', 'second', 'period'];
export const PERIODS: readonly ['AM', 'PM'];
export const DEFAULT_SEGMENT_PLACEHOLDER = '--';

export type Segment = (typeof SEGMENTS)[number];
export type Period = (typeof PERIODS)[number];
export type SegmentFormat = 'numeric' | '2-digit';
export type TimeValue = { hour?: number; minute?: number; second?: number; period?: Period };
export type SegmentPlaceholder =
	| string
	| { hour?: string; minute?: string; second?: string; period?: string };
export type ResolvedSegmentPlaceholder = Record<Segment, string>;
```

### Functions

| Signature                                                              | Total behaviour                                                                                          |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `getIs12Hour(locale?: string): boolean`                                | `Intl.DateTimeFormat(locale, { hour: 'numeric' })` applied to 13:00; `true` when the result matches `/am\|pm/i` or omits `"13"`. Never throws — an invalid locale tag falls back to the runtime default. |
| `parseTimeString(value: string \| undefined): TimeValue \| null`       | `null` for empty/undefined, for fewer than two `:` parts, and when no part parses in range. `"--"` parts and out-of-range parts are dropped individually. |
| `formatTimeValue(value: TimeValue, showSeconds: boolean): string`      | `"HH:mm"` or `"HH:mm:ss"`; each unset field renders `"--"`. `period` is never serialised.               |
| `to12Hour(hour24: number): { hour: number; period: Period }`           | `hour24 % 12 \|\| 12`, `period = hour24 >= 12 ? 'PM' : 'AM'`.                                            |
| `to24Hour(hour12: number, period: Period): number`                     | `12` ⇒ `PM ? 12 : 0`; otherwise `PM ? hour12 + 12 : hour12`.                                             |
| `clamp(value: number, min: number, max: number): number`               | `Math.min(Math.max(value, min), max)`.                                                                   |
| `normalizeSegmentPlaceholder(input: SegmentPlaceholder \| undefined): ResolvedSegmentPlaceholder` | A string fills all four keys; an object fills missing keys with `"--"`; `undefined` ⇒ all `"--"`. |
| `stepSegment(segment, current: number \| null, delta: 1 \| -1, is12Hour: boolean): number` | The wrap-around table of `data-model.md` §1, including the `current === null` (empty-segment) defaults. Not called for `period`. |
| `togglePeriod(current: Period \| null): Period`                        | `null` and `'AM'` ⇒ `'PM'`; `'PM'` ⇒ `'AM'` (upstream time-picker.tsx:1245-1248).                        |
| `buildHourValues(is12Hour: boolean, hourStep: number): number[]`       | 12h: `⌈12/step⌉` items of `((i·step) % 12) \|\| 12`; 24h: `⌈24/step⌉` items of `i·step`. `step <= 0` ⇒ `[]`. |
| `buildStepValues(limit: number, step: number): number[]`               | `⌈limit/step⌉` items of `i·step`. `step <= 0` ⇒ `[]`.                                                     |
| `formatColumnValue(value: number \| string, format: SegmentFormat): string` | `'2-digit'` + `number` ⇒ two-digit zero-padded; otherwise `String(value)`.                          |
| `maxFirstDigit(segment: Segment, is12Hour: boolean): number`           | `hour` ⇒ `is12Hour ? 1 : 2`; `minute`/`second` ⇒ `5`; `period` ⇒ `-1` (never auto-advances by digit).     |

**Why it is exported**: a Date Picker, a Duration Input or a Calendar time field would otherwise
re-derive 12↔24 conversion, partial-time parsing and locale format detection. This is the same
reasoning that made `mask-input` export `mask-engine.ts` and `phone-input` export `phone-engine.ts`.

---

## B. `column-navigation.svelte.ts` — the reusable wrap-around column model

Runes module. Depends only on
`$lib/components/ui/speed-dial/speed-dial-collection.svelte.js` and
`$lib/components/ui/segmented-input/index.js` (`resolveSegmentIntent`) — never on a `.svelte` file, so
any component can construct one.

```ts
export type ColumnItemMeta = { readonly value: number | string; readonly getSelected: () => boolean };
export type ColumnMeta = { readonly getItems: () => readonly DomOrderedEntry<ColumnItemMeta>[] };

export function focusFirstOf(elements: readonly HTMLElement[]): void;

export class ColumnNavigation {
	constructor(props: { readonly getDir: () => Direction });
	readonly columns: DomOrderedCollection<ColumnMeta>;
	registerColumn(id: string, element: HTMLElement, meta: ColumnMeta): void;
	unregisterColumn(id: string): void;
	focusPreferredIn(columnIndex: number): void;
	moveWithinColumn(columnId: string, itemId: string, step: 1 | -1): void;
	moveAcrossColumns(fromColumnId: string, step: 1 | -1): void;
	onItemKeydown(event: KeyboardEvent, columnId: string, itemId: string): void;
}
```

**Guarantees**

- `moveWithinColumn` wraps: previous of the first item is the last, next of the last is the first.
  It focuses **and clicks** the target (upstream time-picker.tsx:1777-1779).
- `moveAcrossColumns` wraps across the registered columns and lands on the target column's selected
  item, falling back to its first focusable item (`focusFirstOf`).
- `onItemKeydown` maps `ArrowUp`/`ArrowDown` to `moveWithinColumn`, and `ArrowLeft`/`ArrowRight`
  (through `resolveSegmentIntent(key, 'horizontal', getDir())`, so RTL inverts) plus `Tab`/`Shift+Tab`
  (direction-independent) to `moveAcrossColumns`. It `preventDefault()`s only the keys it handles, and
  returns immediately when `event.defaultPrevented` is already set.
- Ordering is document order throughout (R-15).

**Why it is exported**: any later multi-column roulette picker — a Date Picker's day/month/year
columns, a Duration Picker — needs exactly this and nothing more.

---

## C. Consumed from earlier ports (Principle IV)

| From                                        | What                                                 | Used for                                                    |
| ------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| `segmented-input`                           | `SegmentNavigation`, `resolveSegmentIntent`          | Segment registry, RTL key mapping (R-04, R-16)              |
| `speed-dial`                                | `DomOrderedCollection`, `DomOrderedEntry`            | Column and item registries (R-14)                           |
| `checkbox-group`                            | `FormControlState`                                   | Ancestor-`<form>` detection for the hidden input (R-10)     |
| `direction-provider`                        | `useDirection`, `Direction`                          | `dir` resolution chain (R-16)                               |
| `popover`                                   | `Root`, `Trigger`, `Content`                         | Positioning, portal, dismissal, `data-state` (R-06)         |
| `button`                                    | `Button`                                             | `<TimePicker.Clear>` (D-15)                                 |
| `@lucide/svelte/icons/clock`                | `ClockIcon`                                          | Default trigger content                                     |

---

## D. Additive changes to `segment-navigation.svelte.ts` (R-04)

Both are backward-compatible; `segmented-input`'s own behaviour and tests are unchanged, and the file
list of its registry entry does not move.

| Change                                                    | Reason                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `focusAt(index, caret: 'start' \| 'end' \| 'all')`        | Time Picker always arrives with the whole segment selected; `'all'` calls `setSelectionRange(0, value.length)` |
| `#seek(from, step)` published as `seek(from, step)`       | Time Picker clamps at the edges and always `preventDefault()`s, a different policy from Segmented Input's |

A regression test in `segmented-input.test.ts` is **not** added or changed; the existing suite must stay
green as-is, which is the proof that the change is additive.
