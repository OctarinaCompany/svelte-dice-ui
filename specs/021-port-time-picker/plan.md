# Implementation Plan: Port Time Picker

**Branch**: `021-port-time-picker` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-port-time-picker/spec.md`

## Summary

Port Dice UI's `time-picker` (radix base, 2215 lines in one file) to Svelte 5 as a fourteen-part
compound component: a root that owns a 24-hour `"HH:mm"`/`"HH:mm:ss"` string plus the dropdown's open
state, an always-editable input group of per-segment `<input>`s, and a popover of scrollable
hour/minute/second/period columns.

Upstream's `useSyncExternalStore` store, its four React contexts and its ref-map collections collapse
into one `TimePickerRootState` plus four `Symbol`-keyed contexts. The pure value logic (parsing,
formatting, 12↔24 conversion, wrap-around stepping, locale format detection through `Intl`) moves into a
rune-free `time-engine.ts`; the dropdown's wrap-around focus model moves into
`column-navigation.svelte.ts`. Both are exported for later ports. Cross-segment arrow movement composes
`segmented-input`'s already-extracted `SegmentNavigation` (two additive extensions, R-04); the popover
composes the repo's `popover`; form participation composes `checkbox-group`'s `FormControlState`;
direction resolution composes `direction-provider`. **No new npm dependency.**

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`), Svelte 5.56 with runes forced on

**Primary Dependencies**: SvelteKit 2, `bits-ui` 2.18 (`Popover`), `@lucide/svelte` (`icons/clock`),
Tailwind CSS v4, `tailwind-merge`/`clsx` via `cn()`. Repo components composed: `popover`, `button`,
plus the exported reuse surfaces of `segmented-input` (`SegmentNavigation`, `resolveSegmentIntent`),
`speed-dial` (`DomOrderedCollection`), `checkbox-group` (`FormControlState`) and `direction-provider`
(`useDirection`). **Zero new npm packages** (R-22).

**Storage**: N/A — the only durable value is the `"HH:mm"`/`"HH:mm:ss"` string, submitted through a
hidden input.

**Testing**: Vitest 4 (jsdom, `globals: false`, `expect.requireAssertions`) +
`@testing-library/svelte` 5 + `@testing-library/user-event` 14, colocated at
`src/lib/components/ui/time-picker/time-picker.test.ts` with a `time-picker.test.svelte` harness. Clock
frozen with `vi.setSystemTime`, locale always passed explicitly (R-24).

**Target Platform**: Browser. SSR-safe: `time-engine.ts` touches no DOM and no `window`;
`Intl.DateTimeFormat` exists on Node ≥ 18 with full ICU; all DOM reads/writes (element capture, form
detection, selection, `scrollIntoView`) live in `$effect` or event handlers, which never run on the
server.

**Project Type**: shadcn-svelte registry component (source-distributed) inside a SvelteKit docs app

**Performance Goals**: A 60-item minute column with `step=1` renders and arrow-navigates without jank —
each column sorts once per structural change inside `DomOrderedCollection.ordered` (not once per
keystroke), and upstream's per-keystroke numeric sort is removed as provably redundant (R-15).

**Constraints**: No `any`, no suppressions, no `dark:` classes, no raw palette colours, no new
dependencies, no git writes; the demo route must build; all four quality gates green.

**Scale/Scope**: 14 `.svelte` parts + 3 TS/`.svelte.ts` modules + 1 barrel; 2 additive lines of change
in `segmented-input`'s `segment-navigation.svelte.ts`; 1 demo route with 8 examples + props tables;
1 registry entry.

## Constitution Check

_GATE: passed before Phase 0 research; re-checked after Phase 1 design (see Post-Design Re-check)._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                                                          |
| ---- | ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$derived.by`/`$effect`/`$props`/`$bindable` + snippets only; behaviour in `time-picker.svelte.ts` and `column-navigation.svelte.ts` as state classes taking getter functions; no stores, `export let`, dispatchers or `<slot>`; upstream's memos are dropped, not ported (R-01, R-12) |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `time-picker.tsx`, the MDX, `types/radix/time-picker.ts` and all eight demo files read at `d9763d8`; every prop, callback, data attribute, CSS variable and keyboard key mapped in `contracts/component-api.md`; fifteen divergences recorded (spec Assumptions + D-04…D-15 below) |
| III  | Accessibility Is a MUST             | PASS    | `role="group"` + resolvable `aria-labelledby` (R-19 fixes an upstream dangling reference), a default accessible name per segment (R-18), native `<button>` column items, bits-ui popover focus/dismiss semantics; MDX keyboard table reproduced key for key; RTL inverts both navigations (R-16); tests cover all six mandatory areas |
| IV   | Composition Over Reimplementation   | PASS    | `popover` (positioning/portal/dismiss/`data-state`), `button` (Clear), `SegmentNavigation` (segment registry), `DomOrderedCollection` (column + item registries), `FormControlState` (form detection), `useDirection` (`dir` chain); bespoke list below                          |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file named `time-picker-<part>.svelte`, root `time-picker.svelte`, logic in `.svelte.ts`, `index.ts` barrel with short names + prefixed aliases + types, `.js` on every intra-repo import, one `registry:ui` entry, nothing imported from `src/routes/**` or `$lib/components/docs/**` |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Prop types declared and exported from `<script lang="ts" module>` on `WithElementRef<HTMLAttributes<…>>`; `Segment`/`Period`/`SegmentFormat` are literal unions, not `string`; no `any`, no ignore comments, no config edits                                                       |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final task, plus a re-run of `segmented-input.test.ts` after the R-04 module change; no skipped or `.todo` tests                                                                                     |
| VIII | Styling Discipline                  | PASS    | `cn()` only; upstream already uses semantic tokens exclusively, so no palette mapping is needed; zero `dark:` classes; `data-slot` on all fourteen parts; presence-based `data-*` (`? '' : undefined`); caller `class` merged last; no manual `z-index` (popover owns stacking)     |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/time-picker/+page.svelte` with one `<ComponentPreview>` per upstream example — all eight — plus props tables                                                                                                                                          |
| X    | One Feature Directory Per Component | PASS    | All artifacts in `specs/021-port-time-picker/`; no git write commands; no writes to `.reference/`, `scripts/`, `.specify/scripts/`, `.port-*`                                                                                                                                     |

**Bespoke behaviour justification (Principle IV)** — five items, each with the primitive evaluated and
the specific capability it lacks:

1. **Time value engine** (`time-engine.ts`: parse/format/convert/step/locale-detect). Evaluated
   `@internationalized/date` (already a devDependency via `calendar`) and bits-ui's date-field
   primitives: both model **complete** `Time`/`CalendarDateTime` values and cannot represent the
   partial `"10:--"` state that spec Edge Cases and User Story 1 require, and neither exposes upstream's
   `getIs12Hour` heuristic or its `"--"`-tolerant string format. Only ~120 lines, pure, and exported for
   reuse (R-02, contract A).
2. **Segment keydown policy** (in `time-picker-input.svelte`). Evaluated `SegmentNavigation.onKeydown`
   directly: it gates arrow movement on a collapsed caret at the segment edge, which is permanently
   false here because a Time Picker segment is always fully selected — reusing it would silently
   disable arrow navigation. The registry, ordering, disabled-skipping `seek` and `focusAt` **are**
   reused; only the ~15-line policy (clamp at the edges, always `preventDefault`, select all on
   arrival) is local (R-04).
3. **Column wrap-around navigation** (`column-navigation.svelte.ts`). Evaluated bits-ui's
   `Select`/`Listbox`/`Menu` navigation: all of them close on selection, own their own value, and model
   a single list — not four independent, simultaneously-visible, individually-committing columns whose
   panel stays open. The document-ordered registry underneath is `DomOrderedCollection`, composed not
   rewritten (R-14, R-15).
4. **Per-segment inline edit state** (`editValue`/`pendingDigit` + the auto-pad/auto-advance rule).
   Evaluated `mask-input`'s engine: `applyMask` formats against a static slot pattern and has no notion
   of "first digit exceeds the maximum ⇒ commit and advance", which is the whole native-`<input
   type="time">` behaviour User Story 1 specifies. No bits-ui primitive covers it (R-12).
5. **Hidden form input + native `input` dispatch.** Evaluated bits-ui `HiddenInput`: no ancestor-`<form>`
   detection and no native event dispatch, which form libraries listen for. `FormControlState` from
   `checkbox-group` — written for exactly this reuse — is composed; only the element and its sync
   effect are local (R-10).

Everything else — popover positioning, portalling, escape/outside dismissal, scroll lock, focus scope,
`data-state`/`data-side`/`data-align`, the anchor width CSS variable, document-order collections,
direction resolution, and the ghost button — is composed.

## Project Structure

### Documentation (this feature)

```text
specs/021-port-time-picker/
├── plan.md                      # This file
├── spec.md                      # Input
├── research.md                  # Phase 0 — R-01…R-24
├── data-model.md                # Phase 1 — engine types, state class, contexts, form data
├── contracts/
│   ├── component-api.md         # Phase 1 — the public component contract (props, data attrs, keyboard)
│   └── time-engine.md           # Phase 1 — the exported reuse surfaces + what is consumed
├── quickstart.md                # Phase 1 — V-1…V-38 validation guide
├── checklists/requirements.md   # from /speckit-specify
└── tasks.md                     # Phase 2 — /speckit-tasks, NOT created here
```

### Source Code (repository root)

```text
src/lib/components/ui/time-picker/
├── index.ts                            # barrel: parts + aliases + types + state + engine + navigation
├── time-picker.svelte                  # Root       ← TimePicker            (time-picker.tsx:313-517)
├── time-picker-label.svelte            # Label      ← TimePickerLabel       (523-541)
├── time-picker-input-group.svelte      # InputGroup ← TimePickerInputGroup  (567-747)
├── time-picker-input.svelte            # Input      ← TimePickerInput       (754-1433)
├── time-picker-separator.svelte        # Separator  ← TimePickerSeparator   (2138-2152)
├── time-picker-trigger.svelte          # Trigger    ← TimePickerTrigger     (1435-1467)
├── time-picker-content.svelte          # Content    ← TimePickerContent     (1490-1605)
├── time-picker-column.svelte           # Column     ← TimePickerColumn      (1630-1711)
├── time-picker-column-item.svelte      # ColumnItem ← TimePickerColumnItem  (1719-1850)
├── time-picker-hour.svelte             # Hour       ← TimePickerHour        (1856-1941)
├── time-picker-minute.svelte           # Minute     ← TimePickerMinute      (1947-2006)
├── time-picker-second.svelte           # Second     ← TimePickerSecond      (2012-2071)
├── time-picker-period.svelte           # Period     ← TimePickerPeriod      (2073-2132)
├── time-picker-clear.svelte            # Clear      ← TimePickerClear       (2154-2197)
├── time-picker.svelte.ts               # TimePickerRootState + 4 Symbol contexts
│                                       #   ← Store/StoreContext/TimePickerContext/InputGroupContext (196-287, 543-565)
├── column-navigation.svelte.ts         # ColumnNavigation + focusFirstOf   ← focusFirst/sortNodes/Group+Column contexts (79-109, 1469-1534, 1607-1626)
├── time-engine.ts                      # pure value logic                   ← time-picker.tsx:33-194, 422-437
├── time-picker.test.svelte             # harness (bindings, form, RTL, child, bare parts) — not in registry
└── time-picker.test.ts                 # colocated tests — not in registry

src/lib/components/ui/segmented-input/
└── segment-navigation.svelte.ts        # MODIFIED, additively only (R-04): focusAt caret 'all'; #seek → seek

src/routes/docs/components/time-picker/
└── +page.svelte                        # 8 ComponentPreview sections + props tables

registry.json                           # append exactly one registry:ui entry
static/r/time-picker.json               # generated by `pnpm run registry:build`
```

**Structure Decision**: folder slug `time-picker` == demo route segment == registry item name. Upstream's
single file splits into fourteen parts plus three modules, per Principle V. `compose-refs.ts`,
`use-as-ref.ts`, `use-lazy-ref.ts`, `use-isomorphic-layout-effect.ts` and `visually-hidden-input.tsx`
have no ported counterparts — they are React ref/effect plumbing replaced by `$bindable`, `$effect` and
attachments, and their one behavioural part (form-presence detection) is composed from
`checkbox-group`'s `FormControlState` (R-10). `segment-navigation.svelte.ts` is edited but stays inside
`segmented-input`'s registry entry — its file list does not change.

## Public API

Authoritative tables live in [`contracts/component-api.md`](./contracts/component-api.md); this is the
summary derived from `time-picker.tsx` and `docs/types/radix/time-picker.ts`.

### Exported parts

| Barrel | Alias                  | Renders                                  | Snippets           | Notable props                                          |
| ------ | ---------------------- | ---------------------------------------- | ------------------ | ------------------------------------------------------ |
| `Root` | `TimePicker`           | `div` + `Popover.Root` + hidden `input`  | `children`, `child`| value/open state + all configuration (table below)     |
| `Label`| `TimePickerLabel`      | `label`                                  | `children`, `child`| —                                                       |
| `InputGroup` | `TimePickerInputGroup` | `div[role=group]`                  | `children`, `child`| —                                                       |
| `Input`| `TimePickerInput`      | `input[type=text]`                       | `child`            | `segment` (required), `disabled`, `readOnly`           |
| `Separator` | `TimePickerSeparator` | `span[aria-hidden]`                 | `children`, `child`| children default `":"`                                  |
| `Trigger` | `TimePickerTrigger` | `Popover.Trigger` (`button`)              | `children`, `child`| `disabled`; children default `<ClockIcon />`           |
| `Content` | `TimePickerContent` | `Popover.Content`                         | `children`, `child`| `side='bottom'`, `align='start'`, `sideOffset=6`       |
| `Column` | `TimePickerColumn`   | `div`                                     | `children`, `child`| —                                                       |
| `ColumnItem` | `TimePickerColumnItem` | `button`                          | `children`, `child`| `value` (required), `selected=false`, `format='numeric'`|
| `Hour` | `TimePickerHour`       | `Column` + items                         | `child`            | `format='numeric'`                                      |
| `Minute` | `TimePickerMinute`   | `Column` + items                          | `child`            | `format='2-digit'`                                      |
| `Second` | `TimePickerSecond`   | `Column` + items                          | `child`            | `format='2-digit'`                                      |
| `Period` | `TimePickerPeriod`   | `Column` + items, or nothing in 24h       | `child`            | —                                                       |
| `Clear`| `TimePickerClear`      | `Button variant="ghost" size="sm"`       | `children`, `child`| `disabled`; children default `"Clear"`                 |

Every part also takes `ref` (`$bindable`, `null` in `child` mode — D-01), `class` (merged last) and
`...restProps`.

### `<TimePicker.Root>` props

| Prop                    | Type                                            | Default        | Bindable |
| ----------------------- | ----------------------------------------------- | -------------- | -------- |
| `id`                    | `string`                                        | `$props.id()`  | –        |
| `value`                 | `string`                                        | –              | **yes**  |
| `defaultValue`          | `string`                                        | `""`           | –        |
| `onValueChange`         | `(value: string) => void`                       | –              | –        |
| `open`                  | `boolean`                                       | –              | **yes**  |
| `defaultOpen`           | `boolean`                                       | `false`        | –        |
| `onOpenChange`          | `(open: boolean) => void`                       | –              | –        |
| `openOnFocus`           | `boolean`                                       | `false`        | –        |
| `inputGroupClickAction` | `'focus' \| 'open'`                             | `'focus'`      | –        |
| `min` / `max`           | `string`                                        | –              | –        |
| `hourStep` / `minuteStep` / `secondStep` | `number`                       | `1`            | –        |
| `segmentPlaceholder`    | `string \| { hour?; minute?; second?; period? }`| `"--"`         | –        |
| `locale`                | `string`                                        | runtime locale | –        |
| `dir`                   | `'ltr' \| 'rtl'`                                | resolved       | –        |
| `name`                  | `string`                                        | –              | –        |
| `disabled` / `readOnly` / `required` / `invalid` / `showSeconds` | `boolean`  | `false`        | –        |

### Callbacks and events

Callback props only — `onValueChange(value: string)` and `onOpenChange(open: boolean)`, each fired
after an `Object.is` guard so it never reports a no-op change (R-01). Both are complemented by
`bind:value` / `bind:open`. No `createEventDispatcher`, no custom DOM events. Native handlers passed
through `restProps` (`onclick`, `onkeydown`, `onfocus`, `onblur`, `onpointerdown`) run **before** the
component's own, and calling `preventDefault()` vetoes the component behaviour — upstream's
`if (event.defaultPrevented) return` idiom, preserved everywhere.

### Also exported from the barrel

`getTimePickerContext` / `getTimePickerInputGroupContext` / `getTimePickerContentContext` /
`getTimePickerColumnContext` (+ their `set…`/`has…` companions), `TimePickerRootState`,
`ColumnNavigation`, `focusFirstOf`, and the whole `time-engine.ts` surface — see
[`contracts/time-engine.md`](./contracts/time-engine.md).

### Recorded divergences (Principle II)

D-01…D-03 are carried from the spec's Assumptions. Added during planning:

| ID   | Divergence                                                        | Reason                                       |
| ---- | ----------------------------------------------------------------- | -------------------------------------------- |
| D-04 | `Column` / `ColumnItem` promoted from module-private to exported   | Principle V (one part per file, barrel is the entry point) + FR-014 |
| D-05 | Horizontal arrows invert under RTL, in both navigations            | R-16, SC-007, Principle III; upstream reads raw DOM order |
| D-06 | Nullable `editValue` replaces `isEditing` + its resync `useEffect` | R-12; `$derived` where React needed an effect |
| D-07 | `data-readonly` is emitted                                         | R-17; documented in the MDX, unimplemented upstream |
| D-08 | `child` supported on `Input`                                       | R-20; documented via `CompositionProps`, unimplemented upstream |
| D-09 | `rounded-lg` instead of `rounded-md` on the input group            | R-21; this repo's radius (`segmented-input` D-05) |
| D-10 | Label carries `id={labelId}`; `for` re-pointed at the group        | R-19; upstream's `aria-labelledby` resolves to nothing |
| D-11 | Default `aria-label` per segment, caller-overridable               | R-18; upstream ships four unnamed inputs      |
| D-12 | Extra `data-segment` / `data-placeholder` / state hooks on Input   | Principle VIII                               |
| D-13 | `dir` prop added to the root                                       | R-16; the resolution chain needs an explicit override |
| D-14 | `getTimePickerContext()` replaces `useStore as useTimePicker`      | R-01; runes have no external store            |
| D-15 | `Clear` composes `Button variant="ghost"`                          | R-21, Principle IV; upstream's class list is that variant |
| D-16 | `Enter` keeps focus, `Escape` blurs, following the vendored source rather than the MDX keyboard table's claim that `Enter` removes focus | Source is authoritative for behaviour; the MDX row is a documentation defect |
| D-17 | `readOnly` also suppresses dropdown column selection (upstream's column items commit even while `readOnly`) | Matches the flag's documented meaning; prevents a mouse user from mutating a read-only field |

`--radix-popover-trigger-width` → `--bits-floating-anchor-width` (R-07) and DOM-order column
navigation (R-15) are **not** listed as divergences: the first is the same quantity under bits-ui's
name, and the second is proven equivalent for every column upstream generates.

## Implementation phases (for `/speckit-tasks`)

Ordered by dependency; user-story mapping in brackets.

1. **Engine** — `time-engine.ts` + its table-driven tests (V-1…V-5). No Svelte. [foundation]
2. **Shared-module extension** — the two additive `SegmentNavigation` changes, then re-run
   `segmented-input.test.ts` unchanged (V-20). [foundation]
3. **State + contexts** — `time-picker.svelte.ts` (`TimePickerRootState`, four `Symbol` contexts) and
   `column-navigation.svelte.ts`. [foundation]
4. **Root, Label, InputGroup, Input, Separator** — the whole inline-editing surface, plus the hidden
   form input (V-6…V-20, V-26…V-28, V-31…V-34). [US1, US3]
5. **Trigger, Content, Column, ColumnItem** — the popover and its focus model (V-21…V-24, V-36). [US2]
6. **Hour, Minute, Second, Period, Clear** — the four generated columns and the reset control
   (V-25, V-32). [US2, US3]
7. **Barrel** — `index.ts` with short names, prefixed aliases, types, state, contexts and both reuse
   surfaces. [all]
8. **Tests** — complete the colocated suite across all six constitutional areas plus the guard tests
   (V-35). [all]
9. **Demo route** — eight `<ComponentPreview>` sections + props tables (V-37). [Principle IX]
10. **Registry** — append the entry, run `pnpm run registry:build` (V-38). [Principle V]
11. **Gates** — `format` → `check` → `lint` → `test:unit -- --run` → `build`, all green, nothing
    suppressed. [Principle VII]

The demo's "With Form" section replaces upstream's `react-hook-form` + `zod` + `@hookform/resolvers`
stack with a native `<form>` + `Field` composition and a submitted-value readout, exactly as the
`phone-input` and `checkbox-group` demos already do — no form library is added (Principle IV, R-22).

## Post-Design Re-check (after Phase 1)

Re-evaluated against `.specify/memory/constitution.md` with `data-model.md`, both contracts and
`quickstart.md` in hand:

| #     | Verdict | What changed during design                                                                                                        |
| ----- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| I     | PASS    | R-12 removed the last `$effect` that would have written state it reads; the only effects left are DOM-side (element capture, form value sync, `scrollIntoView`), each returning its teardown |
| II    | PASS    | Divergence list grew from 3 to 15, all recorded above with reasons; no upstream prop, callback, data attribute, CSS variable or key is unaccounted for |
| III   | PASS    | Design added two a11y fixes upstream lacks (R-18 names, R-19 label association) and the RTL inversion (R-16); V-6…V-8, V-17…V-19, V-23, V-35 pin them |
| IV    | PASS    | Bespoke list settled at five items, each with the evaluated primitive named; `@internationalized/date` and bits-ui `Select` were evaluated and rejected on record |
| V     | PASS    | 18 registry files enumerated in the tree; the `segmented-input` edit does not change that entry's file list |
| VI    | PASS    | Every prop type resolved to a concrete union; `customAnchor`, `onOpenAutoFocus` and `onInteractOutside` all exist on bits-ui's popover content types, so no cast is needed |
| VII   | PASS    | Gate list extended with the `segmented-input` regression run (step 2)                                                             |
| VIII  | PASS    | Upstream uses semantic tokens throughout — no status-colour mapping needed; five class substitutions recorded in R-21             |
| IX    | PASS    | All eight upstream examples mapped to sections; the form example's React-only dependencies replaced on record                     |
| X     | PASS    | Six artifacts written, all under `specs/021-port-time-picker/`; no git write command run                                          |

## Complexity Tracking

> No Constitution Check violations. This table is intentionally empty.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | —         | —          | —                                      |
