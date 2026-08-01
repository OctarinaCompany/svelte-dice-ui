# Phase 0 Research: Listbox port

Upstream read at the pinned commit `d9763d82530416dfa4c81c462387b55d06bae4ec`:

- `.reference/diceui/packages/listbox/src/listbox.tsx` (1135 lines — the real implementation)
- `.reference/diceui/packages/listbox/src/visually-hidden-input.tsx`
- `.reference/diceui/docs/registry/bases/radix/ui/listbox.tsx` (thin styling wrapper)
- `.reference/diceui/docs/content/docs/components/radix/listbox.mdx` (API contract + keyboard table)
- `.reference/diceui/docs/registry/bases/radix/examples/listbox-{,horizontal-,grid-,group-}demo.tsx`
- `.reference/diceui/packages/listbox/test/listbox.test.tsx` (776 lines — assertion floor)
- `.reference/diceui/docs/types/radix/listbox.ts` (which props the docs table publishes)

Local precedents read: `src/lib/components/ui/combobox/**` (closest ported precedent — collection, state
split, test harness), `src/lib/components/ui/angle-slider/**` (most recent port — `child` snippet,
controlled/uncontrolled pattern, hidden input), `src/lib/components/ui/checkbox-group/checkbox-group.svelte.ts`
(`FormControlState`), `src/lib/components/ui/direction-provider/**` (`useDirection`).

No `[NEEDS CLARIFICATION]` markers remained in `spec.md`; the decisions below resolve the design-level
choices the spec deliberately deferred to the plan.

---

## R-01 — Store + `useSyncExternalStore` → two `$state` fields and a `$derived` selection set

**Decision**: Drop `createSelectableStore`, `useListboxState`, the listener set and `queueMicrotask`
emission entirely. `ListboxRootState` holds `focusedValue = $state<string | null>(null)` and
`highlightedValue = $state<string | null>(null)`; the selection lives in the root's value prop, normalised
to `readonly string[]` and exposed as a `$derived` `Set<string>` for O(1) `isSelected` lookups.

**Rationale**: The store exists solely to give React a subscription boundary so that selecting one item
does not re-render the entire list. Svelte's signals already give per-item granularity: an item reading
`root.isSelected(value)` subscribes only to the fields that expression touches. Porting the store would
reproduce React's problem and add a microtask that makes tests time-dependent.

**Alternatives considered**: (a) a literal store port — rejected, dead weight plus async emission;
(b) `SvelteSet` for `selectedValues` — rejected, the value already lives in the `$bindable` prop and a
second source of truth is what upstream's `useIsomorphicLayoutEffect` sync (lines 437–449) exists to
paper over.

## R-02 — Controlled/uncontrolled: `isControlled` + internal `$state`, not `value ??= defaultValue`

**Decision**: Follow `angle-slider.svelte`:

```ts
const isControlled = value !== undefined;
let internalValue = $state<string[]>(untrack(() => normalise(value ?? defaultValue)));
const values = $derived(isControlled ? normalise(value) : internalValue);
```

**Rationale**: A `$bindable` prop that the parent never binds is reset to its default on every props
invalidation, so `value ??= defaultValue` loses uncontrolled state across a `rerender()` — a known trap in
this repo. Resolving ownership once at initialisation is what the most recent port does and what the
controlled/uncontrolled tests (§7.3/§7.4) require.

**Alternatives considered**: `combobox`'s `value ??= untrack(...)` — works there because its tests always
bind; rejected here because spec User Story 1 explicitly re-renders an uncontrolled listbox.

## R-03 — Generic root over `Multiple`

**Decision**: `<script lang="ts" generics="Multiple extends boolean = false">` on the instance script,
with `ListboxRootProps<Multiple>` declared in the module script and
`ListboxValue<Multiple> = Multiple extends true ? string[] : string`; `multiple = false as Multiple` in
the destructure, and one `as ListboxValue<Multiple>` narrowing cast in `setValue`.

**Rationale**: Exactly mirrors upstream's `ListboxRootProps<Multiple>` and the repo's `combobox` root, so
`onValueChange` is typed `string` in single mode and `string[]` under `multiple`. The single narrowing
cast is a cast to a *specific* type, not `any`, so Principle VI holds.

**Alternatives considered**: a non-generic `string | string[]` union — rejected: it makes every consumer
narrow at the call site and breaks upstream parity for the documented type.

## R-04 — Roving tabindex with real DOM focus; no `aria-activedescendant`

**Decision**: Root is `tabindex={disabled ? undefined : 0}`; items are `tabindex={disabled ? undefined : -1}`
and receive real `.focus()`. No `aria-activedescendant` anywhere.

**Rationale**: This is upstream's model (lines 536–549, 744–751, 1059) and the spec's recorded Assumption.
The APG treats roving tabindex and `aria-activedescendant` as mutually exclusive alternatives; shipping
both would announce two competing focus positions.

**Alternatives considered**: virtual focus — rejected, contradicts upstream and would break `virtual`
mode's meaning (which is "consumer virtualises rendering", not "virtual focus").

## R-05 — `virtual` suppresses `.focus()` and `.scrollIntoView()` only

**Decision**: Every navigation branch updates `focusedValue`/`highlightedValue` unconditionally and calls
`element.focus()` / `element.scrollIntoView()` only when `!virtual`.

**Rationale**: Upstream's `virtual` guard appears exactly at those call sites (541, 599, 613, 745, 788).
State must still move so a consumer-owned virtualiser can scroll the right row into view.

## R-06 — Direction resolution reuses `useDirection`, anchored on the parent

**Decision**: `useDirection({ dir: () => dir, element: () => (ref ?? mountedElement)?.parentElement ?? null })`;
the resolved value is written to the root's own `dir` attribute and fed to the arrow-key handler.

**Rationale**: Spec FR-028 requires ambient `<DirectionProvider>` support, which upstream (a literal
`dir = "ltr"` default) has no equivalent for. Anchoring on the parent is required because the root writes
`dir` onto itself — walking up from the root would always find its own attribute. `angle-slider.svelte`
solves the identical problem the same way, including the `child`-mode attachment that records
`mountedElement`.

**Alternatives considered**: `dir = 'ltr'` literal like upstream — rejected, fails FR-028 and the RTL test
area; the DOM-only fallback — rejected, `useDirection` already covers provider + DOM + default.

## R-07 — Grid geometry ported verbatim, measured lazily

**Decision**: Port `calculateGridLayout` unchanged, including the 10px same-row tolerance and the
"first two items on the same row" short-circuit, and call it **inside** the arrow-key handler only when
`orientation === 'mixed'`.

**Rationale**: Upstream's geometry is what its grid demo is authored against; a "smarter" implementation
would silently change navigation. Calling it from a `$derived` would make every layout change trigger a
synchronous reflow and would run in jsdom (where all rects are zero) on every state read.

**jsdom note**: `getBoundingClientRect()` returns zeros in jsdom, so `Math.abs(top - top) < 10` is true for
every item and `columnCount` becomes `items.length` — a single row. Grid tests therefore stub
`getBoundingClientRect` per item (the harness assigns rects from a `columns` prop), which is also how the
`Home`/`End` and mixed-orientation tests stay deterministic.

## R-08 — Typeahead: 1000 ms buffer, `textValue` from the item's text content

**Decision**: New `ListboxTypeahead` class in `listbox.svelte.ts`. A printable single-character key
(`event.key.length === 1 && !ctrlKey && !metaKey && !altKey`) appends to a buffer; a `setTimeout(1000)`
resets it; matching is case-insensitive `startsWith` over enabled items' `textValue`, starting from the
item **after** the currently focused one and cycling. Repeating the same character cycles through items
starting with it. The timer is cleared in the state class's teardown so no timer outlives the component.

**Rationale**: 1000 ms is the Radix/bits-ui/APG convention already used across this repo's ported
typeaheads. `textValue` is captured at registration as the item element's trimmed `textContent`, which is
what a screen reader announces; no new prop is introduced because upstream exposes none (spec Assumption).

**Alternatives considered**: a configurable `typeaheadDelay` prop — rejected, would be undocumented API
drift (Principle II); matching on `value` instead of text — rejected, values are slugs
(`"fs-540"`) while users type labels (`"FS 540"`).

## R-09 — `Shift`+arrow range selection and `Ctrl`/`Cmd`+`A`

**Decision**: `ListboxRootState` keeps `anchorValue: string | null`, set on every non-`Shift` focus move
and on every selection. With `multiple` and `shiftKey`, a navigation key first computes the destination as
usual, then replaces the selection with the contiguous slice of **enabled** items between `anchorValue` and
the destination (inclusive), leaving `anchorValue` untouched so repeated `Shift`+arrow grows and shrinks the
same range. `Ctrl`/`Cmd`+`A` selects every enabled item's value and is a no-op when `!multiple`.
Both are inert in single-selection mode, where `Shift`+arrow behaves as a bare arrow (spec edge case).

**Rationale**: Required by spec FR-007/FR-008 and Constitution Principle III; upstream implements neither.
Anchoring on "last non-shift move" is the APG grid/listbox rule and matches native `<select multiple>`.

**Interaction with upstream's `Ctrl`/`Meta` handling**: upstream reads `event.ctrlKey || event.metaKey` in
`Enter`/`Space` and `click` only to decide `isMultipleEvent`, but the expression is
`multiple && (multiple === true || ctrlKey || metaKey)` — with `multiple === true` the modifier is
irrelevant, so toggle-per-item is the behaviour in every multiple case (spec FR-006). Ported as-is; the
`Ctrl`+`A` branch is checked **before** it so select-all is never mistaken for a toggle.

## R-10 — Form participation: `FormControlState` + one clipped input per submitted value

**Decision**: Compose `FormControlState` from `checkbox-group`. When `isFormControl`, the root renders,
after its `<div>`:

- single mode — one clipped `<input type="text" name value={values[0] ?? ''}>`;
- `multiple` mode — one clipped input per selected value, all sharing `name`, so
  `new FormData(form).getAll(name)` returns the array (FR-027); none when the selection is empty, matching
  native `<select multiple>`.

Each input is `aria-hidden="true" tabindex="-1"`, carries `disabled`, and is positioned off-screen with the
same clip style used by `combobox`/`tags-input`. A `$effect` dispatches a native bubbling `input` event when
the submitted value changes, so form libraries observe it.

**Rationale**: FR-027 asks for "a single string, or an array of strings in multiple mode"; a comma-joined
string cannot express a value containing a comma. Upstream's `VisuallyHiddenInput` `JSON.stringify`s
arrays, which no form parser reads back. Upstream declares no `required` prop, so the
`type="hidden"`-vs-constraint-validation problem that pushed `combobox`/`tags-input` to a single
`type="text"` input does not arise here — but the same clipped `type="text"` markup is reused for
consistency.

**Alternatives considered**: `values.join(',')` like `combobox` — rejected, loses array semantics
(FR-027); `JSON.stringify` like upstream — rejected, not a form-native encoding.

## R-11 — Collection re-implemented, not imported from `combobox`

**Decision**: `ListboxCollection` in `listbox.svelte.ts`, with `register(item): () => void` (both reads
`untrack`ed), `getItems()` sorted by `compareDocumentPosition`, and `getGroupValues(groupId)` — the same
contract as `ComboboxCollection` but with a listbox-shaped `ListboxItemData` (adds `textValue`, drops
`label`/`id`/filter visibility).

**Rationale**: See plan §Principle IV justification — importing `combobox`'s collection would force every
`listbox` consumer to install the entire combobox registry item. Registration happens in the item's
`$effect` and both list reads are `untrack`ed, because a tracked read of the list the effect appends to
re-runs it forever (a trap this repo has hit before).

## R-12 — Event-handler composition and `child` snippets

**Decision**: For every handler the component owns, accept the caller's handler as a prop
(`onclick: onclickProp`), call it first, and bail on `event.defaultPrevented` — the repo's equivalent of
upstream's `composeEventHandlers`. `asChild` becomes an optional `child?: Snippet<[{ props }]>` on all five
parts; in `child` mode the merged attribute payload (including `data-slot`, ARIA and the state
`data-*` attributes) is handed to the snippet, `ref` stays `null`, and the root additionally passes an
attachment so `useDirection` can still find the mounted element.

**Rationale**: Direct port of the pattern in `angle-slider.svelte` / `action-bar` / `banner`, which is the
project-wide answer to Radix `Slot`.

---

## Divergences from upstream (mirrored into spec Assumptions)

| #   | Upstream                                             | Here                                                                   | Reason                                                             |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| D-1 | `asChild` + `Slot`                                   | `child` snippet with merged `props`                                    | No Svelte equivalent of `cloneElement`; project-wide convention     |
| D-2 | `dir = "ltr"` literal default                        | `dir` → `<DirectionProvider>` → DOM `[dir]` → `'ltr'`                  | FR-028; reuses the ported `direction-provider`                      |
| D-3 | No typeahead                                         | 1000 ms buffered typeahead (R-08)                                      | FR-021, Constitution III (APG floor)                                |
| D-4 | No `Shift`+arrow range, no `Ctrl`/`Cmd`+`A`          | Both, `multiple` only (R-09)                                           | FR-007/FR-008, Constitution III                                     |
| D-5 | `PageUp`/`PageDown` unhandled                        | Behave as `ArrowUp`/`ArrowDown`                                        | FR-015; matches the `combobox` precedent                            |
| D-6 | `VisuallyHiddenInput` (JSON-stringified array)       | One clipped `type="text"` input per submitted value (R-10)             | FR-027; array survives `FormData.getAll`                            |
| D-7 | Item sets no `aria-disabled`; root sets none         | `aria-disabled` on disabled items and on a disabled root; `data-disabled` on the root | Spec US3 §8; Constitution III + VIII                  |
| D-8 | External store with microtask emission               | Plain runes state; no async emission (R-01)                            | Svelte signals already give per-item granularity                    |

D-3, D-4, D-5 are **additive**: no key that upstream handles changes meaning, so an upstream user's muscle
memory still works.
