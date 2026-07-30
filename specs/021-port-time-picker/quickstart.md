# Quickstart: validating the Time Picker port

**Feature**: `021-port-time-picker` | **Date**: 2026-07-31

How to prove the port is done. Each `V-n` maps to at least one assertion in
`src/lib/components/ui/time-picker/time-picker.test.ts` and, where visible, to one section of the demo
route. Implementation bodies belong in `tasks.md`, not here.

## Prerequisites

```bash
pnpm install --frozen-lockfile   # already satisfied in this repo; no new dependency is added
```

Reference material (read-only): `.reference/diceui/docs/registry/bases/radix/ui/time-picker.tsx`,
`docs/content/docs/components/radix/time-picker.mdx`, `docs/types/radix/time-picker.ts`, and the eight
`docs/registry/bases/radix/examples/time-picker-*-demo.tsx`.

## Commands (non-interactive, in this order)

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

All five must be green with **no** suppression of any kind (Principle VI / VII).

Targeted while iterating:

```bash
pnpm run test:unit -- --run src/lib/components/ui/time-picker/time-picker.test.ts
pnpm run test:unit -- --run src/lib/components/ui/segmented-input/segmented-input.test.ts   # must stay green (R-04)
```

---

## Validation scenarios

### Engine (pure, no rendering) — `time-engine.ts`

- **V-1 — Locale detection.** `getIs12Hour('en-US') === true`; `getIs12Hour('en-GB') === false`;
  `getIs12Hour('de-DE') === false`. Never consults a locale table (R-02, FR-006, SC-004).
- **V-2 — Parse/format round trip.** `parseTimeString` handles `""`, `"10:30"`, `"10:30:45"`,
  `"10:--"`, `"--:30"`, `"25:99"`, `"garbage"`; `formatTimeValue` re-serialises with the right arity for
  both `showSeconds` values (data-model §1).
- **V-3 — Wrap-around at every boundary.** `stepSegment` reproduces the data-model §1 table exactly:
  hour `23→00`/`00→23` (24h), `12→01`/`01→12` (12h), minute/second `59→00`/`00→59`, plus the
  empty-segment defaults; `togglePeriod` has no third state (SC-002, spec Edge Cases).
- **V-4 — Column value generation.** `buildHourValues(true, 1)` is `[12,1,…,11]`;
  `buildHourValues(false, 1)` is `[0…23]`; `buildStepValues(60, 15)` is `[0,15,30,45]`;
  `formatColumnValue(5, '2-digit') === '05'`; `formatColumnValue('AM', '2-digit') === 'AM'` (FR-003, FR-015).
- **V-5 — Placeholder normalisation.** `normalizeSegmentPlaceholder('##')` fills all four;
  `{ hour: 'hh' }` fills the rest with `"--"`; `undefined` yields all `"--"` (FR-004).

### Rendering, roles and names

- **V-6 — Documented roles and wiring.** The input group is `role="group"` with
  `aria-labelledby` resolving to the rendered `<label>`'s `id`; every id referenced by an `aria-*`
  attribute resolves to an element in the document (R-19, FR-008, FR-009).
- **V-7 — Accessible names.** `screen.getByRole('textbox', { name: 'hour' })` and its `minute` /
  `second` / `period` siblings resolve, and a caller-supplied `aria-label` overrides the default
  (R-18, D-11).
- **V-8 — `data-slot` and state attributes.** Every part carries its `data-slot`;
  `data-disabled` / `data-invalid` / `data-readonly` appear on root, input group and trigger **only**
  when the flag is set, written `? '' : undefined` (Principle VIII, R-17).
- **V-9 — CSS custom properties.** With the default placeholder the group's inline style carries
  `--time-picker-hour-input-width: 2ch` and `--time-picker-period-input-width: 2.5ch`; with
  `segmentPlaceholder={{ hour: 'hh', period: 'aa' }}` they follow the new lengths, and each input's
  width reads its own variable (R-11, FR-009).

### Inline typing (User Story 1)

- **V-10 — Auto-pad and hold.** In a 24-hour picker, typing `1` in the hour shows `01` and focus
  **stays**; typing `9` shows `09` and focus **advances** to the minute (`maxFirstDigit` = 2). In a
  12-hour picker `2` advances (`maxFirstDigit` = 1). (SC-001, FR-010.)
- **V-11 — Two-digit completion advances.** Typing `0` then `9` in the hour yields `09` and advances.
- **V-12 — Arrow stepping in the segments.** From `"23:59"` (24h) `ArrowUp` on the hour gives `"00:59"`;
  `ArrowDown` from `"00:59"` gives `"23:59"`; `ArrowUp` on the minute from `59` gives `00`. After each,
  the focused input is **fully selected** (`selectionStart === 0`, `selectionEnd === value.length`).
- **V-13 — Period segment.** With `locale="en-US"`, pressing `a`, `p`, `1`, `2`, `ArrowUp` and
  `ArrowDown` on the period segment toggles `AM`/`PM` and the stored value flips between e.g. `"09:30"`
  and `"21:30"` (FR-010, SC-002).
- **V-14 — Clear one segment.** With the hour fully selected, `Backspace` (and separately `Delete`)
  leaves `"--:30"` and shows the placeholder in the hour only; clearing the last remaining segment
  yields `""`.
- **V-15 — Commit and cancel.** `Enter` commits the in-progress edit and re-selects; `Escape` discards
  it and the segment reverts to its last committed text.
- **V-16 — Blur backfill.** With the clock frozen (R-03), typing only an hour and blurring backfills the
  minute from the current time; with `showSeconds` the second is backfilled too, and nothing is invented
  when `showSeconds` is off (spec Edge Cases).

### Segment navigation (FR-011)

- **V-17 — LTR arrows.** `ArrowRight` from the hour focuses the minute fully selected; `ArrowLeft` from
  the minute focuses the hour. Movement is **bounded** — `ArrowLeft` on the first segment leaves focus
  where it is.
- **V-18 — RTL inversion.** Under `dir="rtl"`, `ArrowLeft` from the hour moves to the minute and
  `ArrowRight` moves back (D-05, SC-007). Also verified through `<DirectionProvider dir="rtl">` and via
  an ancestor DOM `[dir]`, matching `segmented-input`'s resolution chain.
- **V-19 — `Home`/`End` are not intercepted.** Neither key moves focus between segments (R-05).
- **V-20 — Segmented Input is unaffected.** `segmented-input.test.ts` passes unchanged after the two
  additive `SegmentNavigation` changes (R-04, contract D).

### Dropdown (User Story 2)

- **V-21 — Trigger opens and focus lands correctly.** With `defaultValue="14:30"` and `locale="en-US"`,
  activating the trigger opens the panel and focus lands on the hour column's **selected** item; with an
  empty value it lands on that column's first item (FR-013, SC-003).
- **V-22 — Wrap-around within a column.** `ArrowDown` from the last hour item focuses the first, and
  `ArrowUp` from the first focuses the last; each move also commits that value (FR-014).
- **V-23 — Wrap-around across columns.** `ArrowRight`/`Tab` from the last column lands on the first
  column's selected item; `ArrowLeft`/`Shift+Tab` from the first lands on the last. Under `dir="rtl"`
  the left/right pair is mirrored while `Tab` is not (FR-014, SC-007).
- **V-24 — Activation keeps the panel open.** Clicking (and separately pressing `Enter`) a minute item
  sets the value, marks that item `data-selected`, and leaves the popover open (FR-014).
- **V-25 — Conditional columns.** `<TimePicker.Period>` renders nothing under `locale="en-GB"` and
  renders two items under `locale="en-US"`; the hour column lists 24 items under `en-GB` and 12 under
  `en-US`; `minuteStep={15}` yields exactly four minute items (FR-015, User Story 2 §5/§6).

### Configuration and integration (User Story 3)

- **V-26 — Uncontrolled.** `defaultValue="14:30"` seeds the segments, and internal interaction updates
  them without any parent wiring.
- **V-27 — Controlled.** With `value` supplied and no binding, typing fires `onValueChange` with the
  next string while the rendered value **does not move**; re-rendering with a new `value` moves it.
  Same for `open` / `onOpenChange` (FR-001).
- **V-28 — `bind:value` / `bind:open`.** Both move the parent's state; a function binding that declines
  the write leaves the rendered state untouched.
- **V-29 — `openOnFocus`.** Focusing the hour opens the panel and **leaves focus in the hour input**;
  it does not re-open on every subsequent focus while already open; clicking inside the input group does
  not dismiss it (FR-016, R-09).
- **V-30 — `inputGroupClickAction`.** Clicking empty group space focuses+selects the first segment by
  default, and opens the panel when set to `"open"`; a click on a segment or on the trigger is not
  intercepted in either mode (FR-009).
- **V-31 — Guard rails.** With `disabled`, every segment input and the trigger are `disabled`, arrow
  stepping and clearing do nothing, and the value never moves. With `readOnly` the segments stay
  focusable but immutable and `<TimePicker.Clear>` no-ops (FR-002, spec Edge Cases).
- **V-32 — Clear.** `<TimePicker.Clear>` resets the value to `""` and every segment to its placeholder
  (FR-017).
- **V-33 — Form participation.** Inside a `<form>` with `name="appointmentTime"`, a hidden input carries
  the current value, mirrors `disabled`/`required`/`readonly`, and dispatches a bubbling native `input`
  event when the value moves; outside a `<form>` no hidden input is rendered (FR-007, R-10).
- **V-34 — `showSeconds` at runtime.** Toggling it adds/removes the second segment and switches
  serialisation between `"HH:mm"` and `"HH:mm:ss"` without a remount, and does not invent a seconds
  value that was never set (spec Edge Cases).
- **V-35 — Provider guards.** Rendering `<TimePicker.Input>` without a group, `<TimePicker.Column>`
  without a content, `<TimePicker.ColumnItem>` without a column, and `<TimePicker.Label>` without a root
  each throws its documented `must be used within` error (Principle III).
- **V-36 — `child` snippet.** A `child`-rendered root still detects its ancestor `<form>`; a
  `child`-rendered input group still anchors the popover; a `child`-rendered column item still joins its
  column's registry and takes part in arrow navigation (R-20, D-01).

### Docs and distribution

- **V-37 — Demo route.** `src/routes/docs/components/time-picker/+page.svelte` renders one
  `<ComponentPreview>` per upstream example — Default, With Step, With Seconds, Custom Placeholders,
  Open on Focus, Input Group Click Action, Controlled State, With Form — plus the props tables
  (FR-020, SC-005, Principle IX). Verified by `pnpm run build`.
- **V-38 — Registry.** `registry.json` gains exactly one `registry:ui` entry named `time-picker`,
  listing every file in the folder except the two test files, and `pnpm run registry:build` emits
  `static/r/time-picker.json` (FR-019, SC-006, Principle V).

---

## Manual smoke check (optional, not a gate)

`pnpm run build && pnpm run preview` (terminating commands only — never `pnpm dev`), then open
`/docs/components/time-picker` and walk the eight sections with the keyboard only, once in a
left-to-right page and once with `dir="rtl"` set on `<html>` via devtools.
