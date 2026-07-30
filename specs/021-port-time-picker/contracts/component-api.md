# Contract: `time-picker` public component API

**Feature**: `021-port-time-picker` | **Date**: 2026-07-31

Derived from `.reference/diceui/docs/registry/bases/radix/ui/time-picker.tsx`,
`docs/types/radix/time-picker.ts` and `docs/content/docs/components/radix/time-picker.mdx` at the
pinned commit `d9763d8`. Every upstream JSDoc line, including `@default`, is copied onto the Svelte
prop type.

Import styles, both supported:

```ts
import * as TimePicker from '$lib/components/ui/time-picker/index.js'; // TimePicker.Root, TimePicker.Input
import { TimePicker, TimePickerInput } from '$lib/components/ui/time-picker/index.js';
```

Shared conventions for every part: `ref` is `$bindable(null)`; `class` is merged **last** through
`cn()`; `...restProps` is spread onto the rendered element; `child` replaces upstream `asChild` and
receives `{ props }` to spread (in `child` mode `ref` stays `null` — divergence D-01 — while
registration/anchoring rides along inside `props` as an attachment).

---

## 1. Exported parts

| Barrel name  | Alias                   | File                              | Element                                | Upstream                       |
| ------------ | ----------------------- | --------------------------------- | -------------------------------------- | ------------------------------ |
| `Root`       | `TimePicker`            | `time-picker.svelte`              | `div` + `Popover.Root` + hidden `input`| `TimePicker` (313)             |
| `Label`      | `TimePickerLabel`       | `time-picker-label.svelte`        | `label`                                | `TimePickerLabel` (523)        |
| `InputGroup` | `TimePickerInputGroup`  | `time-picker-input-group.svelte`  | `div[role=group]`                      | `TimePickerInputGroup` (567)   |
| `Input`      | `TimePickerInput`       | `time-picker-input.svelte`        | `input[type=text]`                     | `TimePickerInput` (754)        |
| `Separator`  | `TimePickerSeparator`   | `time-picker-separator.svelte`    | `span[aria-hidden]`                    | `TimePickerSeparator` (2138)   |
| `Trigger`    | `TimePickerTrigger`     | `time-picker-trigger.svelte`      | `Popover.Trigger` (`button`)           | `TimePickerTrigger` (1435)     |
| `Content`    | `TimePickerContent`     | `time-picker-content.svelte`      | `Popover.Content`                      | `TimePickerContent` (1490)     |
| `Column`     | `TimePickerColumn`      | `time-picker-column.svelte`       | `div`                                  | `TimePickerColumn` (1630) †    |
| `ColumnItem` | `TimePickerColumnItem`  | `time-picker-column-item.svelte`  | `button`                               | `TimePickerColumnItem` (1719) †|
| `Hour`       | `TimePickerHour`        | `time-picker-hour.svelte`         | `Column` + items                       | `TimePickerHour` (1856)        |
| `Minute`     | `TimePickerMinute`      | `time-picker-minute.svelte`       | `Column` + items                       | `TimePickerMinute` (1947)      |
| `Second`     | `TimePickerSecond`      | `time-picker-second.svelte`       | `Column` + items                       | `TimePickerSecond` (2012)      |
| `Period`     | `TimePickerPeriod`      | `time-picker-period.svelte`       | `Column` + items, or nothing           | `TimePickerPeriod` (2073)      |
| `Clear`      | `TimePickerClear`       | `time-picker-clear.svelte`        | `Button variant="ghost"`               | `TimePickerClear` (2154)       |

† `Column` / `ColumnItem` are module-private upstream; Principle V requires one part per file and the
barrel is the public entry point, so they are exported (divergence D-04).

Also exported from the barrel: the four context accessors, `TimePickerRootState`, `ColumnNavigation`,
and the whole rune-free `time-engine.ts` surface (see `time-engine.md`).
`getTimePickerContext()` is the counterpart of upstream's `useStore as useTimePicker`
(divergence D-14).

---

## 2. `<TimePicker.Root>` — `TimePickerRootProps`

Extends `WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement>`.

| Prop                    | Type                                     | Default        | Bindable | Notes                                                              |
| ----------------------- | ---------------------------------------- | -------------- | -------- | ------------------------------------------------------------------ |
| `id`                    | `string`                                 | `$props.id()`  | –        | Seeds `inputGroupId` / `labelId` / `triggerId`                     |
| `value`                 | `string`                                 | –              | **yes**  | `"HH:mm"` or `"HH:mm:ss"`, 24-hour, `""` when unset                |
| `defaultValue`          | `string`                                 | `""`           | –        | Seeded once through `untrack`                                      |
| `onValueChange`         | `(value: string) => void`                | –              | –        | Fires only on an actual change (`Object.is` guard)                 |
| `open`                  | `boolean`                                | –              | **yes**  | Dropdown open state                                                |
| `defaultOpen`           | `boolean`                                | `false`        | –        |                                                                    |
| `onOpenChange`          | `(open: boolean) => void`                | –              | –        |                                                                    |
| `openOnFocus`           | `boolean`                                | `false`        | –        | Opens on first segment focus without stealing it (FR-016)          |
| `inputGroupClickAction` | `'focus' \| 'open'`                      | `'focus'`      | –        | What a click on empty group space does                             |
| `min`                   | `string`                                 | –              | –        | Accepted for parity; **not enforced** (R-23)                       |
| `max`                   | `string`                                 | –              | –        | Accepted for parity; **not enforced** (R-23)                       |
| `hourStep`              | `number`                                 | `1`            | –        | Stepping amount **and** hour-column granularity                    |
| `minuteStep`            | `number`                                 | `1`            | –        |                                                                    |
| `secondStep`            | `number`                                 | `1`            | –        |                                                                    |
| `segmentPlaceholder`    | `string \| { hour?; minute?; second?; period? }` | `"--"` | –        | Normalised per segment (R-11)                                      |
| `locale`                | `string`                                 | runtime locale | –        | Decides 12h vs 24h through `Intl` (R-02)                           |
| `dir`                   | `'ltr' \| 'rtl'`                         | resolved       | –        | **Added** (D-13): explicit → `DirectionProvider` → DOM `[dir]` → `ltr` |
| `name`                  | `string`                                 | –              | –        | Hidden-input name for form submission                              |
| `disabled`              | `boolean`                                | `false`        | –        |                                                                    |
| `readOnly`              | `boolean`                                | `false`        | –        |                                                                    |
| `required`              | `boolean`                                | `false`        | –        |                                                                    |
| `invalid`               | `boolean`                                | `false`        | –        |                                                                    |
| `showSeconds`           | `boolean`                                | `false`        | –        | Drives serialisation arity and the second segment/column           |
| `children`              | `Snippet`                                | –              | –        |                                                                    |
| `child`                 | `Snippet<[{ props: TimePickerChildProps }]>` | –          | –        | Replaces `asChild`                                                 |

**Data attributes**: `data-slot="time-picker"`, `data-disabled`, `data-invalid`, `data-readonly` (D-07).
**Renders additionally**: a `<input type="hidden" data-slot="time-picker-form-input">` whenever there is
an ancestor `<form>` (R-10).

---

## 3. `<TimePicker.Label>` — `TimePickerLabelProps`

Extends `WithElementRef<HTMLLabelAttributes, HTMLLabelElement>` plus `child`.

**Attributes**: `id={labelId}`, `for={inputGroupId}` (D-10),
`data-slot="time-picker-label"`, `data-disabled`.
**Class**: `font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70`.

---

## 4. `<TimePicker.InputGroup>` — `TimePickerInputGroupProps`

Extends `WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement>` plus `child`.

**Attributes**: `role="group"`, `id={inputGroupId}`, `aria-labelledby={labelId}`,
`data-slot="time-picker-input-group"`, `data-disabled`, `data-invalid`, `data-readonly`.

**CSS custom properties written on `style`** (caller `style` merged after, so it can override):

| Variable                            | Value                                  |
| ----------------------------------- | -------------------------------------- |
| `--time-picker-hour-input-width`    | `{placeholder.hour.length}ch`          |
| `--time-picker-minute-input-width`  | `{placeholder.minute.length}ch`        |
| `--time-picker-second-input-width`  | `{placeholder.second.length}ch`        |
| `--time-picker-period-input-width`  | `{max(placeholder.period.length, 2) + 0.5}ch` |

**Pointer behaviour** (time-picker.tsx:634-699): `pointerdown` and `click` that land on a segment input
or inside the trigger are ignored; anything else is `preventDefault()`ed on `pointerdown`, and on
`click` either focuses+selects the first registered segment (`inputGroupClickAction="focus"`) or opens
the dropdown (`"open"`). Both are suppressed while `disabled` or `readOnly`, and a caller handler that
calls `preventDefault()` vetoes ours.

**Also**: publishes its element as the popover anchor (R-06) and the input-group context.

---

## 5. `<TimePicker.Input>` — `TimePickerInputProps`

Extends `WithElementRef<Omit<HTMLInputAttributes, 'type' | 'value'>, HTMLInputElement>` plus `child`.

| Prop      | Type                                            | Default | Notes                          |
| --------- | ----------------------------------------------- | ------- | ------------------------------ |
| `segment` | `'hour' \| 'minute' \| 'second' \| 'period'`    | –       | **required**                   |
| `disabled`| `boolean`                                       | root's  | OR-ed with the root's          |
| `readOnly`| `boolean`                                       | root's  | OR-ed with the root's          |

**Fixed attributes**: `type="text"`, `inputmode={segment === 'period' ? 'text' : 'numeric'}`,
`autocomplete="off"`, `autocorrect="off"`, `autocapitalize="off"`, `spellcheck={false}`,
`translate="no"`, `aria-label={segment}` (D-11, overridable through `restProps`),
`style="width: var(--time-picker-{segment}-input-width)"`.

**Data attributes**: `data-slot="time-picker-input"`, `data-segment={segment}`, `data-placeholder`
(present while the segment shows its placeholder), `data-disabled`, `data-readonly`, `data-invalid`
(D-12).

**Behaviour**: registers with the root's `SegmentNavigation` (R-04); selects its whole text on `focus`
and on `click`; opens the dropdown on first focus when `openOnFocus` (R-09).

---

## 6. `<TimePicker.Separator>` — `TimePickerSeparatorProps`

Extends `WithElementRef<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>` plus `child`.
Renders `aria-hidden="true"`, `data-slot="time-picker-separator"`, children defaulting to `":"`.

---

## 7. `<TimePicker.Trigger>` — `TimePickerTriggerProps`

Extends `Popover.TriggerProps` narrowed to `WithElementRef<HTMLButtonAttributes, HTMLButtonElement>`
plus `child`.

**Attributes**: `type="button"`, `id={triggerId}`, `data-slot="time-picker-trigger"`,
`disabled = own || root.disabled`, `data-disabled`, `data-readonly`, `data-invalid`, plus bits-ui's
`data-state="open" | "closed"`, `aria-expanded` and `aria-controls`.
**Children**: default `<ClockIcon />` from `@lucide/svelte/icons/clock` when none are supplied.
**Class**: `ml-auto flex items-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none [&>svg:not([class*='size-'])]:size-4`.

---

## 8. `<TimePicker.Content>` — `TimePickerContentProps`

Extends `Popover.ContentProps` plus `child`.

| Prop         | Type                                    | Default    |
| ------------ | --------------------------------------- | ---------- |
| `side`       | `'top' \| 'right' \| 'bottom' \| 'left'`| `'bottom'` |
| `align`      | `'start' \| 'center' \| 'end'`          | `'start'`  |
| `sideOffset` | `number`                                | `6`        |

**Fixed**: `customAnchor={root.inputGroupElement}` (R-06),
`class="flex w-auto max-w-(--bits-floating-anchor-width) p-0"` (R-07),
`data-slot="time-picker-content"`, plus bits-ui's `data-state`, `data-side`, `data-align`.

**`onOpenAutoFocus`**: caller's handler first; if not prevented, `preventDefault()` then either consume
the `openedViaFocus` latch (leave focus in the field) or focus the first column's selected/first item
(R-08, R-09).
**`onInteractOutside`**: caller's handler first; if not prevented and `openOnFocus` is on and the target
is inside the input group, `preventDefault()` (R-09).
**Also**: publishes the `ColumnNavigation` on the content context.

---

## 9. `<TimePicker.Column>` / `<TimePicker.ColumnItem>`

`TimePickerColumnProps`: `WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement>` + `child`.
Attributes `data-slot="time-picker-column"`; class `flex flex-col gap-1 not-last:border-r p-1`.
Registers with the content's `ColumnNavigation`; publishes its own item collection.

`TimePickerColumnItemProps`: `WithElementRef<HTMLButtonAttributes, HTMLButtonElement>` + `child`.

| Prop       | Type                       | Default     |
| ---------- | -------------------------- | ----------- |
| `value`    | `number \| string`         | – (required)|
| `selected` | `boolean`                  | `false`     |
| `format`   | `'numeric' \| '2-digit'`   | `'numeric'` |

Attributes `type="button"`, `data-slot="time-picker-column-item"`, `data-selected` (presence).
Scrolls itself into view (`block: 'nearest'`) whenever it becomes selected.
Rendered text: `format === '2-digit' && typeof value === 'number'` ⇒ zero-padded, else `String(value)`.

---

## 10. `<TimePicker.Hour|Minute|Second|Period>`

All extend `WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement>` plus `child`; `Hour`,
`Minute` and `Second` additionally take `format?: 'numeric' | '2-digit'`.

| Part     | `format` default | Values generated                                                     | Selected when                                   |
| -------- | ---------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| `Hour`   | `'numeric'`      | 12h: `((i·hourStep) % 12) || 12` for `⌈12/hourStep⌉` items; 24h: `i·hourStep` for `⌈24/hourStep⌉` | item === displayed hour of `value ?? now` |
| `Minute` | `'2-digit'`      | `i·minuteStep` for `⌈60/minuteStep⌉` items                            | item === `value.minute ?? now.getMinutes()`     |
| `Second` | `'2-digit'`      | `i·secondStep` for `⌈60/secondStep⌉` items                            | item === `value.second ?? now.getSeconds()`     |
| `Period` | –                | `['AM', 'PM']`                                                        | item === period of `value.hour ?? now.getHours()` |

`Period` **renders nothing** when the resolved format is 24-hour (FR-015). `Second` is rendered only
when the caller composes it (matching upstream's layout composition; the root's `showSeconds` governs
serialisation, not this part's presence).

Each part's `data-slot` is `time-picker-hour` / `-minute` / `-second` / `-period`; class
`scrollbar-none flex max-h-[200px] flex-col gap-1 overflow-y-auto p-1` (`Period`: `flex flex-col gap-1 p-1`).

Selecting an item sets that field and backfills the still-unset `hour` / `minute` (and `second` when
`showSeconds`) from **now**, then leaves the dropdown open.

---

## 11. `<TimePicker.Clear>` — `TimePickerClearProps`

`WithElementRef<HTMLButtonAttributes, HTMLButtonElement>` + `child`. Composes
`Button variant="ghost" size="sm"` (D-15). `type="button"`,
`data-slot="time-picker-clear"`, `disabled = own || root.disabled`. Children default to `"Clear"`.
`click` → `preventDefault()`, no-op while `disabled` or `readOnly`, otherwise `value` → `""`.

---

## 12. Keyboard contract (MDX `KeyboardShortcutsTable`, key for key)

### Segment inputs

| Key                    | Behaviour                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `0`–`9`                | Numeric segments only. Zero-pads instantly; auto-advances after two digits, or after one when it exceeds `maxFirstDigit` (`1` for a 12h hour, `2` for a 24h hour, `5` for minute/second). Non-digits stripped. |
| `A` / `1`              | Period segment → `AM`, re-selects                                                                                 |
| `P` / `2`              | Period segment → `PM`, re-selects                                                                                 |
| `ArrowRight`           | Next segment (LTR) / previous segment (RTL, D-05). Clamped at the ends, always `preventDefault()`. Skips disabled segments. Arrives fully selected. |
| `ArrowLeft`            | The mirror of `ArrowRight`                                                                                        |
| `Tab` / `Shift+Tab`    | Native tab order; commits the in-progress edit first                                                              |
| `ArrowUp`              | Increment with wrap-around (data-model §1 table); empty ⇒ 12h hour `12`, 24h hour `00`, minute/second `00`; period toggles. Re-selects. |
| `ArrowDown`            | Decrement with wrap-around; empty ⇒ 12h hour `12`, 24h hour `23`, minute/second `59`; period toggles. Re-selects.  |
| `Enter`                | Commits the in-progress edit and re-selects                                                                       |
| `Escape`               | Discards the in-progress edit (`editValue → null`) and blurs                                                      |
| `Backspace` / `Delete` | Only when the segment's full text is selected: reverts to the placeholder and removes that field from the value; `""` when no field remains. Re-selects. |

### Trigger

`Enter` / `Space` toggle the dropdown (bits-ui `Popover.Trigger`).

### Dropdown column items

| Key                    | Behaviour                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `ArrowUp` / `ArrowDown`| Previous/next item in the same column, **wrapping**; focuses **and activates** it              |
| `ArrowRight`           | Next column (LTR) / previous column (RTL, D-05), **wrapping**; lands on that column's selected item, else its first |
| `ArrowLeft`            | The mirror of `ArrowRight`                                                                     |
| `Tab` / `Shift+Tab`    | Same as `ArrowRight` / `ArrowLeft`, direction-independent, `preventDefault()`ed               |
| `Enter` / `Space`      | Native button activation — sets that segment, dropdown stays open                              |
| `Escape`               | Closes the dropdown without changing the value (bits-ui)                                       |

---

## 13. Guard rails

| Condition  | Effect                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| `disabled` | Every segment input and the trigger/clear buttons carry `disabled`; group pointer handling is suppressed; `data-disabled` on root/group/trigger; the hidden input carries `disabled`. |
| `readOnly` | Segment inputs carry `readonly` (still focusable, still announced); group pointer handling suppressed; `Clear` no-ops; `data-readonly` on root/group/trigger; the hidden input carries `readonly`. |
| `invalid`  | `data-invalid` on root/group/trigger/input; `border-destructive ring-destructive/20` on the group.          |
| `required` | Mirrored onto the hidden input only (upstream parity — the segments are not individually required).          |
| No provider| Each of the four contexts throws its documented message.                                                     |
