# Phase 1 Data Model: Mention

**Feature**: `042-port-mention` | **Date**: 2026-08-01

Entities, their fields, the invariants that must hold, and the algorithms that move them. Everything
here is derived from `.reference/diceui/packages/mention/src/*` at the pinned commit.

---

## 1. `MentionItemData` — one registered `<Mention.Item>`

Mirrors `combobox.svelte.ts`'s `ComboboxItemData`. A plain immutable snapshot; an item re-registers
whenever any field moves.

| Field      | Type                  | Notes                                                                     |
| ---------- | --------------------- | ------------------------------------------------------------------------- |
| `element`  | `HTMLElement \| null` | `null` while filtered out. Collection key, scroll target, DOM-order source |
| `id`       | `string`              | `$props.id()`; the `aria-activedescendant` target                         |
| `value`    | `string`              | **Invariant: never `''`** — throws at initialisation (spec edge case)      |
| `label`    | `string`              | `label` prop, else `value`. This is what is spliced into the text          |
| `disabled` | `boolean`             | the item's own `disabled` OR-ed with the root's                           |

**Validation**: `value === ''` throws
``` `<Mention.Item>` value cannot be an empty string. ``` at component initialisation (upstream
`mention-item.tsx:55-57`), so `expect(() => render(...)).toThrow()` works.

---

## 2. `MentionSpan` — one inserted mention's position in the text

Upstream's `Mention` interface (`mention-root.tsx:37-40`), renamed to avoid colliding with the
component namespace.

| Field   | Type     | Notes                                                        |
| ------- | -------- | ------------------------------------------------------------ |
| `value` | `string` | the item's `value`, not its label                            |
| `start` | `number` | offset of the trigger character in the current field text     |
| `end`   | `number` | `start + trigger.length + label.length` — **exclusive**, and it does **not** include the trailing space |

**Invariants**

- `0 <= start < end <= text.length` for every span, after every edit.
- Spans never overlap.
- `text.slice(start, end) === trigger + label` for the item that produced the span.
- Every span's `value` appears in the root's value list, and removing a span removes its value.

**Lifecycle**: created by `addMention`, shifted by `shiftMentionsForEdit`, dropped by
`removeMentions`. State transitions are the three algorithms in §6.

---

## 3. `MentionRootState` — the context value

Replaces upstream's 35-field `MentionContextValue` (`mention-root.tsx:42-85`) plus its
`useControllableState`, `useCollection`, `useFilterStore` and `useListHighlighting`. Lives in
`mention.svelte.ts`. Reactive inputs arrive as **getter functions**; nothing is snapshotted.

### Reactive state (`$state`)

| Field                | Type                       | Purpose                                                        |
| -------------------- | -------------------------- | -------------------------------------------------------------- |
| `mentions`           | `MentionSpan[]` (`$state.raw`) | The span list; replaced wholesale on every edit             |
| `search`             | `string`                   | Text between trigger and caret — the filter term                |
| `highlightedElement` | `HTMLElement \| null`      | Drives `aria-activedescendant` and `data-highlighted`           |
| `caretAnchor`        | `Measurable \| null`       | The virtual anchor handed to `Popover.Content`'s `customAnchor` |
| `inputElement`       | `HTMLInputElement \| HTMLTextAreaElement \| null` | Every caret read/write target             |
| `isPasting`          | `boolean`                  | Content stays mounted but clipped while a paste resolves        |
| `collection`         | `MentionCollection`        | Registered items                                                |

### Derived (`$derived`)

`values`, `open`, `inputValue`, `trigger`, `disabled`, `readonly`, `exactMatch`, `loop`, `modal`,
`dir` (all from the getters); `dataState` (`'open' | 'closed'`); `inputId` / `labelId` / `listId`
(from one root id); `filter` (a `ComboboxFilterStore` recomputed from `search` + `collection.entries`
+ `{ exactMatch, onFilter }`); `visibleItems` (mounted ∧ enabled ∧ visible, in DOM order);
`highlightedItem`.

### Methods (each maps 1:1 to an upstream callback)

| Method                              | Upstream                                     |
| ----------------------------------- | -------------------------------------------- |
| `setValues` / `addValue` / `removeValues` | `setValue` (`mention-root.tsx:216-220`) |
| `setOpen(next)`                     | `onOpenChange` (`mention-root.tsx:255-273`)   |
| `setInputValue(next)`               | `setInputValue` (`mention-root.tsx:221-225`)  |
| `highlightMove(direction)`          | `useListHighlighting` (`use-list-highlighting.ts:22-73`) |
| `addMention(value, triggerIndex)`   | `onMentionAdd` (`mention-root.tsx:287-335`)   |
| `removeMentions(spans)`             | `onMentionsRemove` (`mention-root.tsx:337-367`) |
| `updateTrigger(element, caret?)`    | `onMentionUpdate` (`mention-input.tsx:136-264`) |
| `closeMenu()`                       | `onMenuClose` (`mention-input.tsx:598-602`)   |
| `isItemVisible(value)`              | `getIsItemVisible` (`use-filter-store.ts:148`) |

---

## 4. `MentionCollection`

Identical in shape to `ComboboxCollection` (`combobox.svelte.ts:66-102`):
`$state.raw<readonly MentionItemData[]>`, `register(item): () => void` with both reads `untrack`ed,
`entries` (the filter store's input), `getItems()` sorted by `compareDocumentPosition`,
`getEnabledItems()` (upstream `mention-root.tsx:251-253`).

---

## 5. Controlled / uncontrolled state pairs

| Public prop  | Bindable | Uncontrolled seed | Callback              | Upstream                     |
| ------------ | -------- | ----------------- | --------------------- | ---------------------------- |
| `value`      | yes      | `defaultValue ?? []` | `onValueChange`     | `mention-root.tsx:216-220`   |
| `open`       | yes      | `defaultOpen` (`false`) | `onOpenChange`   | `mention-root.tsx:211-215`   |
| `inputValue` | yes      | `''`              | `onInputValueChange`  | `mention-root.tsx:221-225`   |

Seeds are read through `untrack()` exactly once (`value ??= untrack(() => defaultValue ?? [])`),
matching `combobox.svelte:177-182`. A function binding that declines a write leaves the rendered
state where it was — the input part re-asserts `element.value` from the context in an `$effect` so
the DOM cannot drift from a refused write (`combobox-input.svelte:38-42`).

> Note (memory: *"Non-bound `$bindable` props reset on props invalidation"*): the test suite must
> exercise uncontrolled state through user interaction inside one render, never through
> `rerender()`.

---

## 6. Algorithms

### 6.1 `resolveMentionTrigger(text, caret, trigger, spans)` → `TriggerMatch | null`

Pure, rune-free, in `mention-caret.ts`. Returns `{ triggerIndex, search }` or `null`.
Conditions, in order (upstream `mention-input.tsx:144-243`):

1. `i = text.lastIndexOf(trigger, caret)`; `null` if `-1`.
2. `null` if any span has `start <= i && end > i`.
3. `null` if `text.slice(0, i)` contains non-whitespace **and** its last character is neither `' '`
   nor `'\n'` — the word-boundary rule (spec User Story 3).
4. `null` if `text.slice(i + 1, caret)` contains a space.
5. `null` if `caret <= i`.
6. `null` if there is text after the caret whose first character is not one of
   `undefined | ' ' | '\n' | trigger`, unless the caret is inside a span (`start <= caret < end`).
7. Otherwise `{ triggerIndex: i, search: caret === i + 1 ? '' : text.slice(i + 1, caret) }`.

### 6.2 `addMention(value, triggerIndex)` (upstream `mention-root.tsx:287-335`)

```
label          = enabledItems.find(v == value)?.label ?? value
mentionText    = trigger + label
insertionPoint = element.selectionStart ?? triggerIndex
next           = text.slice(0, triggerIndex) + mentionText + ' ' + text.slice(insertionPoint)
insertionLength = mentionText.length + 1
spans          = spans.map(s => s.start >= insertionPoint ? shift(s, +insertionLength) : s)
                 .concat({ value, start: triggerIndex, end: triggerIndex + mentionText.length })
caret          = triggerIndex + mentionText.length + 1
```
then: write `element.value`, `setInputValue(next)`, append `value` to the value list, close, clear
the highlight, clear `search`, and `setSelectionRange(caret, caret)`.

Satisfies FR-006 and SC-005: everything before `triggerIndex` and everything from `insertionPoint`
on is copied verbatim.

### 6.3 `removeMentions(spans)` (upstream `mention-root.tsx:337-367`)

Remove every span whose `value` matches one being removed; shift each survivor left by
`Σ (r.end - r.start + 1)` over removed spans with `r.start < survivor.start` — the `+ 1` accounts for
the trailing space that is removed with the mention. Satisfies FR-005 of User Story 5 and SC-006.

### 6.4 `shiftMentionsForEdit(spans, caret, delta)` (upstream `mention-input.tsx:276-293`)

On plain typing, every span with `start >= caret - max(delta, 0)` shifts by `delta`.

### 6.5 Caret rect (upstream `mention-input.tsx:51-111`)

Measure the current line's text with an off-screen `<span>` cloned from the field's computed font,
count wrapped lines as `floor(textWidth / containerWidth)`, then

```
x = ltr ? min(rect.left + padLeft + (textWidth % containerWidth) - scrollLeft, rect.right - 10)
        : min(rect.right - padRight - (textWidth % containerWidth) + scrollLeft, rect.right - 10)
y = rect.top + padTop + (totalLines * lineHeight - scrollTop)
```

with `width: 0`, `height: lineHeight`. `lineHeight` falls back to `offsetHeight` when the computed
value is not finite (divergence D-9).

---

## 7. Data attributes (the styling contract)

| Element                      | Attributes                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------- |
| root                         | `data-slot="mention"`, `data-state="open\|closed"`, `data-disabled`                |
| label                        | `data-slot="mention-label"`                                                        |
| input                        | `data-slot="mention-input"`, `data-state`, `data-disabled`, `data-readonly`        |
| highlighter                  | `data-slot="mention-highlighter"`; its mention spans carry `data-tag=""`           |
| content                      | `data-slot="mention-content"`, `data-state`, `data-side`, `data-align`, `data-pasting` |
| item                         | `data-slot="mention-item"`, `data-value`, `data-selected`, `data-highlighted`, `data-disabled`, `data-dice-collection-item` |
| form input                   | `data-slot="mention-form-input"`                                                   |

Every boolean attribute is written `cond ? '' : undefined` (Principle VIII).

CSS variables on the content: `--dice-transform-origin`, `--dice-available-width`,
`--dice-available-height` (plus `--dice-anchor-width`/`--dice-anchor-height` for symmetry with
combobox), aliased onto the `--bits-popover-*` variables the primitive computes.
