# Phase 0 Research: Port Time Picker

**Feature**: `021-port-time-picker` | **Date**: 2026-07-31

**Upstream, read at the pinned commit `d9763d8`**:

- `.reference/diceui/docs/registry/bases/radix/ui/time-picker.tsx` (2215 lines — the whole component)
- `.reference/diceui/docs/content/docs/components/radix/time-picker.mdx` (the API contract)
- `.reference/diceui/docs/types/radix/time-picker.ts` (the `AutoTypeTable` source, JSDoc + `@default`)
- All eight `.reference/diceui/docs/registry/bases/radix/examples/time-picker-*-demo.tsx`
- `.reference/diceui/docs/registry/bases/radix/components/visually-hidden-input.tsx`

There is **no upstream test file** for `time-picker` (`docs/registry/bases/radix/test/` contains none),
so the assertion floor is the MDX keyboard table plus the constitution's six mandatory areas.

Every decision below is numbered and referenced from `plan.md`, `data-model.md`, `contracts/` and
`quickstart.md`.

---

## R-01 — The value/open store becomes two `$bindable` props plus one state class

**Decision**: Drop upstream's `Store` (`listenersRef` + `stateRef` + `useSyncExternalStore`,
time-picker.tsx:196-237, 357-418) entirely. The root declares `value = $bindable()` and
`open = $bindable()`, seeds each once from `defaultValue` / `defaultOpen` through `untrack`, and hands
getter/setter pairs to a single `TimePickerRootState` published on a `Symbol`-keyed context.

**Rationale**: The store exists only to let deep consumers subscribe to a slice without re-rendering
the tree. Runes give that for free — a `$derived` read of `root.value` in `TimePickerHour` re-runs only
that expression. Upstream's `setState` is `Object.is`-guarded and fires the callback only on an actual
change (time-picker.tsx:374); the setter reproduces that guard verbatim so `onValueChange` fires
exactly as often as upstream's. `openedViaFocus` (the third store key) stays a plain `$state` field on
the same class.

**Alternatives considered**: A `SvelteMap`-backed store object — rejected, it reintroduces the
subscription layer runes replace. Two separate state classes — rejected, upstream's three keys are one
unit of state and `openedViaFocus` is only meaningful relative to `open`.

**Divergence**: D-02 (already recorded in the spec's Assumptions).

---

## R-02 — 12-hour detection goes through `Intl`, verbatim

**Decision**: Port `getIs12Hour` (time-picker.tsx:111-118) unchanged into the rune-free
`time-engine.ts`:

```ts
const formatted = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).format(
	new Date(2000, 0, 1, 13, 0, 0)
);
return /am|pm/i.test(formatted) || !formatted.includes('13');
```

The root exposes it as `readonly is12Hour = $derived(getIs12Hour(this.#props.getLocale()))`.

**Rationale**: This is the explicit component-specific guidance for this port and it is also what
upstream does. The second clause catches locales that render 12-hour clocks without a Latin `AM`/`PM`
marker (e.g. `ja-JP` renders `午後1時`). No hard-coded locale table appears anywhere in the port.
`Intl.DateTimeFormat` is available in every target (browser, SSR on Node ≥ 18 with full ICU, and jsdom,
which delegates to the host Node `Intl`).

**Alternatives considered**: `Intl.DateTimeFormat().resolvedOptions().hourCycle` — cleaner in principle
(`h11`/`h12` vs `h23`/`h24`) but it is *not* what upstream computes, and it reports `undefined` in
older engines when no `hour` option is requested. Parity wins; `hourCycle` is not used.

**Consequence for tests**: the ambient locale of the test runner is not deterministic, so **every test
that depends on the format passes an explicit `locale`** — `"en-US"` for 12-hour, `"en-GB"` for
24-hour. Recorded again in R-24.

---

## R-03 — "Now" backfill is preserved, and pinned in tests

**Decision**: Keep every `new Date()` read upstream performs — the blur backfill
(time-picker.tsx:932-959), the hour/minute/second/period select handlers
(time-picker.tsx:1878-1913, 1961-1979, 2026-2044, 2082-2106) and the column "reference" values used to
pre-highlight an item when the field is empty (time-picker.tsx:1915-1917, 1983-1984, 2048-2049,
2110-2112). They live inside `$derived.by` / event handlers, never inside an `$effect` that writes what
it reads.

**Rationale**: This is the behaviour the spec's Edge Cases call out ("a segment left at its placeholder
… MUST be backfilled from the current time"). It is observable and therefore has to be tested, so tests
freeze the clock with `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(...)` and restore in
`afterEach`.

**Alternatives considered**: Injecting a `now()` provider prop — rejected as undocumented API surface
(Principle II). Reading `new Date()` once at construction — rejected, it changes behaviour for a
long-lived page.

---

## R-04 — `SegmentNavigation` is composed, with two additive extensions

**Decision**: The input group composes the existing
`src/lib/components/ui/segmented-input/segment-navigation.svelte.ts` for the segment registry and for
the RTL-aware key→intent mapping. Two **additive** changes are made to that module so it can serve this
second consumer, both of which leave `segmented-input`'s behaviour bit-for-bit identical:

1. `focusAt(index, caret)` gains a third caret mode, `'all'`, which calls
   `element.setSelectionRange(0, element.value.length)` instead of collapsing the caret. Time Picker
   always *selects* the whole segment on arrival (upstream `focus(); select();`,
   time-picker.tsx:1166-1167); Segmented Input keeps using `'start'` / `'end'`.
2. The private `#seek(from, step)` is published as `seek(from, step)` (same body, `#edge` keeps calling
   it). Time Picker needs "next enabled segment in this direction" but with **clamping at the edges and
   an unconditional `preventDefault()`**, which is a different policy from Segmented Input's
   "don't move, let the browser have the key".

Time Picker does **not** call `SegmentNavigation.onKeydown`.

**Rationale**: `onKeydown` gates arrow movement on the caret sitting at the segment's edge *with
nothing selected* (`selectionStart === selectionEnd`, segment-navigation.svelte.ts:131-140). A Time
Picker segment is **always fully selected** (upstream selects on focus and after every mutation), so
that gate is permanently false and reusing `onKeydown` verbatim would silently disable arrow navigation
altogether. The reusable parts are the collection, the ordering, the disabled-skipping seek, the focus
helper and `resolveSegmentIntent`; the *policy* differs and belongs to the consumer. This is exactly
the split FR-011 asks for — compose the module rather than re-implement focus management — and it is
what `segmented-input`'s own barrel comment ("the Time Picker reuse surface") anticipated.

`splitPastedValue` / `onPaste` are deliberately **not** used: upstream implements no paste distribution
for this component (spec Edge Cases).

**Alternatives considered**: Copying the seek loop into the input part — rejected, that is the
re-implementation FR-011 forbids. Relaxing `onKeydown`'s caret gate for everyone — rejected, it would
change Segmented Input's documented mid-text editing behaviour (its own D-07).

**Divergence**: D-03 (spec) plus the two module extensions recorded here.

---

## R-05 — `Home` / `End` stay with the browser

**Decision**: The input's keydown handler maps **only** `ArrowLeft` / `ArrowRight` through
`resolveSegmentIntent`; `Home` and `End` are not intercepted.

**Rationale**: `resolveSegmentIntent` would happily return `'first'` / `'last'` for them, but upstream's
`TimePickerInput` handles neither key (time-picker.tsx:1140-1399) and the MDX keyboard table does not
list them. Adding cross-segment `Home`/`End` would be an undocumented API addition (Principle II), and
inside a permanently-fully-selected two-character segment it carries no meaning the arrows do not
already cover. Native behaviour (collapse the selection) is preserved.

---

## R-06 — The popover is `bits-ui` via the repo's `popover`, anchored on the input group

**Decision**: The root wraps its subtree in the repo's `<Popover.Root bind:open>`. `TimePickerTrigger`
renders `<Popover.Trigger>`; `TimePickerContent` renders `<Popover.Content>`. Upstream's
`<PopoverAnchor asChild>` around the input group (time-picker.tsx:715-744) has no counterpart in
bits-ui v2, which instead accepts a `customAnchor` on the content: the input group publishes its
element on `TimePickerRootState`, and the content passes
`customAnchor={root.inputGroupElement}`.

**Rationale**: Principle IV — positioning, portalling, dismissal, escape handling, scroll locking and
`data-state` are all bits-ui's. `customAnchor` accepts `string | HTMLElement | Measurable`
(`bits-ui/dist/bits/utilities/floating-layer/types.d.ts:93`) and is the documented replacement for a
separate anchor component. The trigger keeps `aria-expanded` / `aria-controls` / `data-state` for free.

**Alternatives considered**: Anchoring on the trigger (bits-ui's default) — rejected, upstream anchors
and sizes against the whole field, and `align="start"` on a 16px icon would place the panel under the
icon rather than under the field.

---

## R-07 — `--radix-popover-trigger-width` → `--bits-floating-anchor-width`

**Decision**: Upstream's content class `flex w-auto max-w-(--radix-popover-trigger-width) p-0` becomes
`flex w-auto max-w-(--bits-floating-anchor-width) p-0`.

**Rationale**: bits-ui's floating layer publishes `--bits-floating-anchor-width` /
`-anchor-height` / `-available-width` / `-available-height` on the content wrapper
(`use-floating-layer.svelte.js:138-142`). Because the anchor is the input group (R-06), the variable
means exactly what upstream's name meant — the width of the anchored field. The repo's
`popover-content.svelte` sets `w-72` in its own base class, so the part passes `w-auto` and `p-0`
through `class`, which `cn()` merges last.

---

## R-08 — `onOpenAutoFocus` moves focus onto the first column's selected item

**Decision**: `TimePickerContent` passes an `onOpenAutoFocus` handler to `Popover.Content` that calls
`event.preventDefault()` and then focuses, in order of preference, the first column's selected item,
then that column's first focusable item — a direct port of `focusFirst`
(time-picker.tsx:79-91, 1536-1566). bits-ui exposes `onOpenAutoFocus` on the content
(`focus-scope/types.d.ts`), so no bespoke focus management is written.

**Rationale**: Principle IV plus FR-013. `focusFirst` itself is three lines and has no primitive
equivalent (bits-ui focuses the content container, not a chosen descendant), so it is ported into
`column-navigation.svelte.ts` as `focusFirstOf(elements)`.

---

## R-09 — `openOnFocus` and the `openedViaFocus` latch

**Decision**: Port both. On a segment input's `focus`, if `openOnFocus` and the popover is closed, the
root sets `openedViaFocus = true` **then** `open = true` (order matters — the content reads the latch
during `onOpenAutoFocus`). The content's `onOpenAutoFocus` consumes the latch: if set, it clears it and
returns without moving focus, so the caret stays in the segment. The latch clears whenever `open`
becomes `false` (upstream time-picker.tsx:382-384). The content's `onInteractOutside` also
`preventDefault()`s interactions that land inside the input group while `openOnFocus` is on
(time-picker.tsx:1568-1586), so typing in the field does not dismiss the panel.

**Rationale**: FR-016 verbatim. `open` is `$bindable`, and the latch write happens before the open
write in the same synchronous handler, so a controlled parent that rejects the open still leaves the
latch consistent (it is cleared on the next close).

---

## R-10 — Form participation reuses `FormControlState`

**Decision**: Compose `FormControlState` from
`src/lib/components/ui/checkbox-group/index.js` (written for exactly this reuse) plus a local
`<input type="hidden">`, following the pattern `phone-input.svelte:206-280` already established: the
root captures its rendered element (via `bind:this` on the default `<div>`, and via an attachment key
carried in the `child` props so `child` mode still works), `FormControlState` answers "is there an
ancestor `<form>`", and an `$effect` writes `element.value` and dispatches a bubbling native `input`
event whenever the value moves.

**Rationale**: Upstream's `VisuallyHiddenInput` does the same three things (form detection, value
mirroring, native event dispatch through the native setter). bits-ui's `HiddenInput` has neither
ancestor-form detection nor the native event dispatch that form libraries listen for. Zero new code
beyond the element and its sync effect.

**Note**: upstream renders `type="hidden"`, so `required` has no interactive effect there either; the
attribute is mirrored for parity and for form libraries that read it.

---

## R-11 — `segmentPlaceholder` normalisation and the four width variables

**Decision**: `normalizeSegmentPlaceholder(input)` in `time-engine.ts` widens
`string | { hour?, minute?, second?, period? }` to a total
`{ hour, minute, second, period }`, defaulting each missing key to `"--"`
(time-picker.tsx:422-437). The input group emits the four CSS custom properties upstream documents,
from the *normalised* lengths:

```
--time-picker-hour-input-width:   {hour.length}ch
--time-picker-minute-input-width: {minute.length}ch
--time-picker-second-input-width: {second.length}ch
--time-picker-period-input-width: {max(period.length, 2) + 0.5}ch
```

and each input sets `width: var(--time-picker-<segment>-input-width)`, with a caller `style` merged
after so a per-input override works (documented in the MDX's second `CSSVariablesTable`).

**Rationale**: Direct port of time-picker.tsx:731-739 and 1403-1405, including the period's
`max(len, 2) + 0.5` fudge. The values are documented API and are asserted in tests.

---

## R-12 — Per-segment edit state drops `isEditing` and its resync effect

**Decision**: Replace upstream's `editValue: string` + `isEditing: boolean` + the
`useEffect(() => { if (!isEditing) setEditValue(getSegmentValue()) })`
(time-picker.tsx:826-835) with a single nullable rune:

```ts
let editValue = $state<string | null>(null); // null ⇒ show the committed segment value
const displayValue = $derived(editValue ?? segmentValue);
```

`null` is written on blur and on `Escape`; a concrete string is written by digit entry, arrow stepping,
`Backspace`/`Delete` and the period shortcuts. `pendingDigit` stays a separate `$state<string | null>`.

**Rationale**: The React effect exists only to re-synchronise two pieces of state that are really one.
Modelling "no pending edit" as `null` makes the resync structural, satisfies the translation rule
"never mutate reactive state inside `$effect` where `$derived` would do", and is observably identical:
in every branch where upstream reads `editValue` while not editing, `editValue` provably equals
`getSegmentValue()`.

**Divergence**: D-06.

---

## R-13 — `queueMicrotask` becomes `await tick()`

**Decision**: Every `queueMicrotask(() => input.select())` and the blur backfill's
`queueMicrotask` (time-picker.tsx:932, 1008, 1036, 1061, 1074, 1084, 1135, 1220, 1239, 1251, 1292,
1313, 1339, 1355, 1381) becomes `await tick()` followed by the same body, inside an `async` handler.

**Rationale**: React's `queueMicrotask` runs after React has committed the DOM. Svelte batches DOM
writes and flushes them in its own microtask; a bare `queueMicrotask` can win the race and select the
*stale* text, and because assigning `input.value` resets the selection, the selection would then be
destroyed by the subsequent flush. `tick()` resolves after the flush, which is the semantics upstream
relies on.

---

## R-14 — Column and item registries reuse `DomOrderedCollection`

**Decision**: `TimePickerContent` owns a `DomOrderedCollection<ColumnMeta>`; each `TimePickerColumn`
owns a `DomOrderedCollection<ItemMeta>`. Both come from
`src/lib/components/ui/speed-dial/speed-dial-collection.svelte.js`, which already sorts by
`compareDocumentPosition` — upstream's `sortNodes` (time-picker.tsx:93-109) is the same function.
Registration is an attachment carried in the merged props, so a `child`-rendered column or item still
joins its registry (the `segmented-input-item` / `masonry-item` precedent).

**Rationale**: Principle IV. Upstream's `Map<id, {ref, …}>` + `filter(ref.current)` + `sortNodes` is
`DomOrderedCollection` line for line, including the "drop detached elements" filter.

---

## R-15 — DOM order replaces upstream's numeric sort inside a column, provably

**Decision**: `ArrowUp` / `ArrowDown` inside a column walk the collection's **document order** with
wrap-around, not upstream's `items.sort((a, b) => a.value - b.value)`
(time-picker.tsx:1762-1767).

**Rationale**: Upstream's numeric sort is a no-op for every column it generates:

- minute / second: values are `0, step, 2·step, …` — DOM order already *is* numeric order.
- period: values are the strings `"AM"`, `"PM"` — the comparator returns `0`, so the sort is a stable
  no-op and DOM order survives.
- 12-hour hour: values render as `12, 1, 2, …, 11`, which is a **rotation** of `1…12`. Wrap-around
  successor/predecessor is invariant under rotation, so both orders produce the same neighbour for
  every item, including at the wrap point (`11 → 12` and `12 → 1` in both).
- 24-hour hour: `0…23` — already numeric.

DOM order is additionally correct for a caller who composes `TimePicker.Column` with their own item
set, where a numeric sort could disagree with what is on screen. No behaviour changes; one sort per
keystroke is removed.

---

## R-16 — Both navigations invert under `dir="rtl"`

**Decision**: Horizontal movement — between segments in the input group, and between columns in the
popover — resolves its direction through `resolveSegmentIntent(key, 'horizontal', dir)`, and `dir` is
resolved by `useDirection({ dir: () => dirProp, element: () => rootElement })` from
`direction-provider`: explicit `dir` prop → nearest `<DirectionProvider>` → DOM `[dir]` → `'ltr'`.
The root therefore gains a `dir?: 'ltr' | 'rtl'` prop.

**Rationale**: Upstream reads raw DOM order for both (`ArrowLeft` ⇒ previous element,
time-picker.tsx:1148, 1799-1801), so its horizontal arrows point the wrong way in an RTL field. SC-007
and Principle III require inversion; `segmented-input` already made the same correction (its D-06), and
the resolution chain matches `segmented-input`'s exactly.

**Divergences**: D-05 (inversion) and D-13 (the added `dir` prop).

---

## R-17 — `data-readonly` is emitted, closing an upstream documentation gap

**Decision**: The root, input group and trigger all emit `data-disabled`, `data-invalid` **and**
`data-readonly` (presence-based, `cond ? '' : undefined`).

**Rationale**: The MDX `DataAttributesTable` documents `[data-readonly]` on both `TimePicker` and
`TimePickerTrigger`, but the implementation never emits it (time-picker.tsx:494-495, 1455-1457). The
MDX is the contract (Principle II), and `phone-input` made the identical correction. The input group's
`data-readonly` is the same attribute one level down, which Principle VIII requires anyway.

**Divergence**: D-07.

---

## R-18 — Each segment input gets a default accessible name

**Decision**: `TimePickerInput` sets `aria-label={segment}` **before** `...restProps`, so a caller can
override it with their own (localised) label.

**Rationale**: Upstream ships four unlabelled `<input type="text">` elements; a screen reader announces
four anonymous edit fields. Principle III makes accessible names a MUST, and this is the smallest
change that provides them. `role="spinbutton"` (with `aria-valuenow`/`min`/`max`/`text`) is the fuller
WAI-ARIA answer but would redefine the widget's semantics, break the "type digits like a native time
input" model the spec's User Story 1 is built on, and is far outside a port's remit — it is explicitly
**not** done.

**Divergence**: D-11.

---

## R-19 — The label association is corrected

**Decision**: `TimePickerLabel` renders `<label id={labelId} for={inputGroupId}>`; the input group
keeps `id={inputGroupId}` `role="group"` `aria-labelledby={labelId}`.

**Rationale**: Upstream sets `htmlFor={labelId}` on the label and gives the label no `id`
(time-picker.tsx:533), so its own `aria-labelledby={labelId}` (time-picker.tsx:719) resolves to
nothing and the group has no accessible name — an `aria-valid-attr-value` failure. Adding `id` is the
one-attribute fix; `for` is retained but re-pointed at the group it actually labels.

**Divergence**: D-10.

---

## R-20 — `asChild` maps to the `child` snippet on every part that documents it

**Decision**: `child?: Snippet<[{ props: … }]>` on Root, Label, InputGroup, **Input**, Separator,
Trigger, Content, Column, ColumnItem, Hour, Minute, Second, Period and Clear.

**Rationale**: In `docs/types/radix/time-picker.ts` every exported props interface — `TimePickerInput`
included — extends `CompositionProps` (`{ asChild?: boolean }`), so `child` on Input is documented
contract even though the implementation forgets to destructure it (it currently leaks `asChild` onto
the DOM). `Column`/`ColumnItem` are undocumented upstream but must be real files here (Principle V), so
they get the same escape hatch for consistency.

**Divergences**: D-08 (Input's `child`), D-04 (Column/ColumnItem promoted to public parts).

---

## R-21 — Styling deltas

**Decision**: Port every upstream class, with these substitutions:

| Upstream                                                | Here                                      | Why                                                             |
| ------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------- |
| `rounded-md` on the input group                         | `rounded-lg`                              | this repo's `Input`/`popover` radius (`segmented-input`'s D-05) |
| `max-w-(--radix-popover-trigger-width)`                 | `max-w-(--bits-floating-anchor-width)`    | R-07                                                            |
| `focus:ring-[3px]` on a column item                     | `focus:ring-3`                            | Tailwind v4 spelling already used repo-wide                     |
| plain `<button>` for `TimePickerClear`                  | `Button variant="ghost" size="sm"`        | Principle IV; upstream's class list *is* the ghost variant      |
| `scrollbar-none`                                        | kept                                      | the repo already ships the utility via `tw-animate-css`/app.css |

All colours are already semantic tokens upstream (`border-input`, `bg-background`, `bg-accent`,
`bg-primary`, `text-muted-foreground`, `border-destructive`) — no palette colour appears anywhere in
this component, so no status-token mapping is needed. No `dark:` class, no `space-*`, no manual
`z-index`.

**Divergences**: D-09, D-15.

---

## R-22 — Zero new npm dependencies

**Decision**: None added. `bits-ui@^2.18.1` (popover) and `@lucide/svelte@^1.27.0`
(`icons/clock`) are already devDependencies; `tailwind-variants`, `clsx` and `tailwind-merge` back
`cn()`. Upstream's own manual-install list (`radix-ui`, `compose-refs`, `use-as-ref`, `use-lazy-ref`,
`use-isomorphic-layout-effect`, `visually-hidden-input`) is entirely React ref/effect plumbing replaced
by `$bindable`, `$effect` and R-10.

---

## R-23 — `min` / `max` are accepted and unused, exactly as upstream

**Decision**: Both props are declared, documented with upstream's JSDoc, and stored on
`TimePickerRootState` (so they are reachable by a consumer reading the context and so they are not
dead destructured bindings). No clamping, validation or `aria-invalid` derivation is added.

**Rationale**: Upstream puts them on its context (time-picker.tsx:460-461) and never reads them again —
verified by searching the whole file for `min`/`max` outside the context object. The spec's Assumptions
already ratify matching actual behaviour over the aspirational JSDoc; inventing enforcement would be an
undocumented behavioural addition.

---

## R-24 — Test strategy under jsdom

**Decision**:

- **Locale**: every format-sensitive test passes `locale="en-US"` (12-hour) or `locale="en-GB"`
  (24-hour); no test relies on the runner's ambient locale (R-02).
- **Clock**: `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(new Date(2026, 0, 15, 9, 41, 7))`
  in the blocks that exercise the "now" backfill, with `vi.useRealTimers()` in cleanup (R-03).
- **Popover**: driven exactly as `phone-input.test.ts` drives its `popover` + `command` panel — open via
  the trigger with `userEvent`, then query inside the portalled content. `tests/setup.ts` already shims
  `ResizeObserver`, pointer capture, `scrollIntoView` (needed by `TimePickerColumnItem`) and
  `matchMedia`.
- **Harness**: a `time-picker.test.svelte` component supplies snippet children, `bind:value` /
  `bind:open`, a `<form>` ancestor for the hidden-input assertions, an RTL wrapper, and bare parts for
  the throwing-context assertions — the same shape as `segmented-input.test.svelte` and
  `phone-input.test.svelte`.
- **Selection assertions**: after each mutation, assert `selectionStart === 0 && selectionEnd ===
  value.length` on the focused input — that is the "selection preserved" behaviour the MDX documents,
  and it is only observable this way.
- **Pure helpers**: `time-engine.ts` is rune-free, so wrap-around, parsing, formatting and
  12↔24 conversion are also asserted directly, table-driven, at every boundary (SC-002).

**Alternatives considered**: Testing the demo route with Playwright — out of scope, the repo has no e2e
harness and the constitution's floor is the colocated Vitest suite.
