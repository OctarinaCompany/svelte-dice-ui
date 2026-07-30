# Phase 1 Data Model: Time Picker

**Feature**: `021-port-time-picker` | **Date**: 2026-07-31

Entities are grouped by the module that owns them. Nothing here is persisted — the only durable
artifact is the `"HH:mm"` / `"HH:mm:ss"` string the root holds and the hidden input submits.

---

## 1. `time-engine.ts` — pure, rune-free value types

Imported by every part and by the tests. Contains no runes, no DOM access and no Svelte import, so it is
SSR-safe and directly unit-testable.

### `Segment`

```ts
export const SEGMENTS = ['hour', 'minute', 'second', 'period'] as const;
export type Segment = (typeof SEGMENTS)[number];
```

Declaration order is significant: it is the auto-advance order (`hour → minute → second → period`,
time-picker.tsx:612).

### `Period`

```ts
export const PERIODS = ['AM', 'PM'] as const;
export type Period = (typeof PERIODS)[number];
```

### `SegmentFormat`

`'numeric' | '2-digit'` — how a dropdown column renders its items. `'2-digit'` zero-pads a numeric
value; `'numeric'` prints it bare. Non-numeric values (the periods) always print bare.

### `TimeValue`

```ts
export type TimeValue = { hour?: number; minute?: number; second?: number; period?: Period };
```

The **partial**, in-flight representation. Fields are independently optional, which is what makes
`"10:--"` expressible (spec Edge Cases).

| Field    | Range        | Notes                                                                       |
| -------- | ------------ | --------------------------------------------------------------------------- |
| `hour`   | `0…23`       | **always 24-hour**, whatever the display format                             |
| `minute` | `0…59`       |                                                                             |
| `second` | `0…59`       | only serialised when `showSeconds`                                          |
| `period` | `AM` \| `PM` | display-only companion of `hour`; never serialised, cleared with the period |

### `SegmentPlaceholder` / `ResolvedSegmentPlaceholder`

```ts
export type SegmentPlaceholder =
	| string
	| { hour?: string; minute?: string; second?: string; period?: string };
export type ResolvedSegmentPlaceholder = Record<Segment, string>;
```

`normalizeSegmentPlaceholder` widens the former to the latter, defaulting every missing key to `"--"`.

### The canonical string

The root's `value` is the **only** serialised form:

| State                                   | `value`      |
| --------------------------------------- | ------------ |
| nothing set                             | `""`         |
| hour only, `showSeconds` off            | `"10:--"`    |
| hour + minute, `showSeconds` off        | `"10:30"`    |
| hour + minute + second, `showSeconds` on| `"10:30:45"` |
| minute only                             | `"--:30"`    |

`parseTimeString` is the inverse and is **total**: it returns `null` for `""`, for a string with fewer
than two `:`-separated parts, and for a string whose every parsed part is out of range; individual
out-of-range or `"--"` parts are dropped rather than failing the whole parse
(time-picker.tsx:120-157).

### State transitions of `value`

| Trigger                                              | Transition                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| digit entry completing a segment                     | that field set (clamped), others untouched                                     |
| `ArrowUp` / `ArrowDown` on a segment                 | that field stepped **with wrap-around**, others untouched                      |
| `A`/`P`/`1`/`2`/arrows on the period segment         | `period` set **and** `hour` re-projected through `to24Hour`                    |
| `Backspace` / `Delete` on a fully-selected segment   | that field deleted; if none remain, `value` → `""`                             |
| blur with at least one field set                     | unset `hour`/`minute` (and `second` when `showSeconds`) backfilled from **now** |
| column item activated                                | that field set; missing `hour`/`minute`/`second` backfilled from **now**       |
| `<TimePicker.Clear>` activated                       | `value` → `""`                                                                 |

Every transition ends in `formatTimeValue(next, showSeconds)`, so the serialised arity always follows
`showSeconds`, never the fields that happen to be set.

### Wrap-around table (SC-002 — asserted directly against the engine)

| Segment | Format | `ArrowUp` at max | `ArrowDown` at min | Empty + `ArrowUp` | Empty + `ArrowDown` |
| ------- | ------ | ---------------- | ------------------ | ----------------- | ------------------- |
| hour    | 24h    | `23 → 00`        | `00 → 23`          | `00`              | `23`                |
| hour    | 12h    | `12 → 01`        | `01 → 12`          | `12`              | `12`                |
| minute  | —      | `59 → 00`        | `00 → 59`          | `00`              | `59`                |
| second  | —      | `59 → 00`        | `00 → 59`          | `00`              | `59`                |
| period  | 12h    | `AM ⇄ PM`        | `AM ⇄ PM`          | `PM` (from `AM`)  | `PM` (from `AM`)    |

(The empty-segment rows are upstream's explicit defaults, time-picker.tsx:1309, 1351; the period row
follows time-picker.tsx:1242-1254, which treats an empty period as `AM` and toggles from there.)

---

## 2. `column-navigation.svelte.ts` — the dropdown's focus model

### `ColumnItemMeta`

```ts
type ColumnItemMeta = { readonly value: number | string; readonly getSelected: () => boolean };
```

### `ColumnMeta`

```ts
type ColumnMeta = { readonly getItems: () => readonly DomOrderedEntry<ColumnItemMeta>[] };
```

### `ColumnNavigation`

One instance per `<TimePicker.Content>`, published on the content's context. Wraps a
`DomOrderedCollection<ColumnMeta>` (R-14) and owns:

| Member                              | Behaviour                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| `registerColumn` / `unregisterColumn` | idempotent, attachment-driven                                                    |
| `focusPreferredIn(columnIndex)`     | focus the column's selected item, else its first item (`focusFirst`, R-08)        |
| `moveWithinColumn(column, id, step)`| previous/next item **wrapping** at the ends; focuses **and clicks** the target    |
| `moveAcrossColumns(from, step)`     | previous/next column **wrapping**, then `focusPreferredIn`                        |
| `columnIndexOf(element)`            | which registered column contains this element                                     |

`moveWithinColumn` clicking the target is upstream behaviour, not an accident
(time-picker.tsx:1777-1779): arrowing in a column *selects* as it moves.

### `ColumnItemsCollection`

One `DomOrderedCollection<ColumnItemMeta>` per `<TimePicker.Column>`, published on the column's context
so items self-register and so the parent column can answer `getItems()`.

---

## 3. `time-picker.svelte.ts` — the shared reactive state

### `TimePickerRootState`

One instance per `<TimePicker.Root>`, constructed with getter functions (never snapshots) and published
on the root context.

| Field                     | Kind        | Source                                                                 |
| ------------------------- | ----------- | ---------------------------------------------------------------------- |
| `id`                      | `string`    | caller `id` ?? `$props.id()`                                           |
| `inputGroupId`, `labelId`, `triggerId` | `string` | derived from `id` so they are stable and inspectable         |
| `value`                   | `$derived`  | the root's `$bindable` value                                           |
| `timeValue`               | `$derived`  | `parseTimeString(value)` — the parsed view every part reads            |
| `open`                    | `$derived`  | the root's `$bindable` open                                            |
| `openedViaFocus`          | `$state`    | the R-09 latch; cleared whenever `open` becomes `false`                |
| `dir`                     | `$derived`  | `DirectionReader.current` (R-16)                                       |
| `is12Hour`                | `$derived`  | `getIs12Hour(locale)` (R-02)                                           |
| `segmentPlaceholder`      | `$derived`  | `normalizeSegmentPlaceholder(prop)` (R-11)                             |
| `hourStep`/`minuteStep`/`secondStep` | `$derived` | props, default `1`                                          |
| `showSeconds`, `disabled`, `readOnly`, `required`, `invalid` | `$derived` | props |
| `openOnFocus`, `inputGroupClickAction` | `$derived` | props                                        |
| `min`, `max`              | `$derived`  | accepted, never read (R-23)                                            |
| `inputGroupElement`       | `$state`    | the popover anchor (R-06) and the click-target boundary                |
| `nav`                     | `SegmentNavigation` | the composed segment registry (R-04)                           |

| Method                                       | Behaviour                                                             |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `setValue(next)`                             | `Object.is` guard, then write + `onValueChange`                       |
| `setOpen(next)`                              | `Object.is` guard, then write + `onOpenChange`; clears the latch on close |
| `commitSegment(segment, raw)`                | the whole `updateTimeValue` branch table (time-picker.tsx:837-904)    |
| `clearSegment(segment)`                      | delete one field, collapsing to `""` when none remain                 |
| `backfillFromNow()`                          | the blur/selection backfill (R-03)                                    |
| `segmentText(segment)`                       | the committed display text, or the segment's placeholder              |
| `clear()`                                    | `value` → `""`, no-op while `disabled` or `readOnly`                  |

### Contexts — four `Symbol` keys, four throwing getters

| Key                          | Set by      | Read by                                    | Error message                                                        |
| ---------------------------- | ----------- | ------------------------------------------ | -------------------------------------------------------------------- |
| `Symbol('time-picker')`      | Root        | every other part                           | ``` `<TimePicker.X>` must be used within `<TimePicker.Root>`. ```     |
| `Symbol('time-picker-input-group')` | InputGroup | Input                                | ``` `<TimePicker.Input>` must be used within `<TimePicker.InputGroup>`. ``` |
| `Symbol('time-picker-content')`     | Content   | Column, ColumnItem, Hour/Minute/Second/Period | ``` `<TimePicker.Column>` must be used within `<TimePicker.Content>`. ``` |
| `Symbol('time-picker-column')`      | Column    | ColumnItem                            | ``` `<TimePicker.ColumnItem>` must be used within `<TimePicker.Column>`. ``` |

Each getter takes a `consumerName` argument defaulting to the most common consumer, matching
`getSegmentedInputContext`. Every message names both the part and its required provider, and each of
the four is asserted by a test (`expect(() => render(...)).toThrow(/within/)`).

---

## 4. Per-part local state

### `TimePickerInput`

| Field          | Type                  | Meaning                                                             |
| -------------- | --------------------- | ------------------------------------------------------------------- |
| `editValue`    | `$state<string \| null>` | `null` ⇒ display the committed segment text (R-12)               |
| `pendingDigit` | `$state<string \| null>` | first of a possible two-digit entry, awaiting the second         |
| `displayValue` | `$derived`            | `editValue ?? root.segmentText(segment)`                            |

Auto-advance rule (time-picker.tsx:1049-1093), unchanged: with `maxFirstDigit = segment === 'hour' ? (is12Hour ? 1 : 2) : 5`,
a first digit greater than `maxFirstDigit` commits and advances immediately; otherwise the digit is
zero-padded, held as `pendingDigit`, and the next digit completes the pair and advances.

### `TimePickerColumnItem`

| Field       | Type                    | Meaning                                                     |
| ----------- | ----------------------- | ----------------------------------------------------------- |
| `selected`  | prop, `$derived` by parent | drives `data-selected` and the `scrollIntoView` effect     |
| `formatted` | `$derived`              | `format === '2-digit' && typeof value === 'number'` ⇒ padded |

---

## 5. Form data

| Element                | Attribute source                                                        |
| ---------------------- | ----------------------------------------------------------------------- |
| `<input type="hidden">`| `name` (root), `value` (root's string, `""` when unset), `disabled`, `required`, `readonly` |
| rendered when          | `FormControlState.isFormControl` — `true` before mount, then "has an ancestor `<form>`" |
| change signal          | a bubbling native `input` event dispatched from the `$effect` (R-10)    |

---

## 6. Validation rules

| Rule                                                     | Where enforced                       |
| -------------------------------------------------------- | ------------------------------------ |
| hour clamped to `1…12` (12h) / `0…23` (24h)              | `commitSegment`, via `clamp`         |
| minute / second clamped to `0…59`                        | `commitSegment`, via `clamp`         |
| non-digits stripped from numeric segments                | the input's change handler           |
| at most two characters per numeric segment               | the input's change handler           |
| period accepts only `A`/`P`/`1`/`2` (case-insensitive)   | the input's change + keydown handlers|
| `disabled` / `readOnly` suppress every mutation          | root guards + native attributes      |
| `min` / `max` are **not** enforced                       | by design (R-23)                     |
