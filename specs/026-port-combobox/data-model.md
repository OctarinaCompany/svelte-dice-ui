# Phase 1 Data Model: Combobox

**Feature**: `026-port-combobox` | **Date**: 2026-07-31

All reactive state lives in `src/lib/components/ui/combobox/combobox.svelte.ts`; all pure matching
and scoring lives in `src/lib/components/ui/combobox/combobox-filter.ts`. Reactive inputs reach the
state classes as **getter functions**, never as snapshots (CLAUDE.md §4).

---

## 1. Entities

### `ComboboxValue<Multiple>`

```ts
export type ComboboxValue<Multiple extends boolean = false> = Multiple extends true
	? string[]
	: string;
```

The Root's public value type. Internally every consumer sees `readonly string[]`
(`ComboboxRootState.values`); the Root narrows on write.

| Mode                   | Empty value | `values` |
| ---------------------- | ----------- | -------- |
| single (`multiple` false) | `''`     | `[]` when `''`, else `[value]` |
| multiple (`multiple` true) | `[]`     | the array itself |

### `ComboboxItemData` — one registered `<Combobox.Item>`

| Field      | Type                              | Notes                                                                   |
| ---------- | --------------------------------- | ----------------------------------------------------------------------- |
| `element`  | `HTMLElement`                     | Collection key; also supplies `id` for `aria-activedescendant`.          |
| `id`       | `string`                          | `$props.id()`-derived; `textId = `${id}text``.                            |
| `value`    | `string`                          | Required, non-empty (throws otherwise).                                  |
| `label`    | `string`                          | Explicit `label` prop, else `<Combobox.ItemText>`'s `textContent`, else `''`. |
| `disabled` | `boolean`                         | `item.disabled \|\| root.disabled`.                                     |
| `onSelect` | `((value: string) => void) \| undefined` | Invoked before the value mutation.                                |
| `groupId`  | `string \| undefined`             | From the nearest `<Combobox.Group>`.                                     |

### `ComboboxFilterStore` (plain object, not runes)

| Field         | Type                        | Notes                                                     |
| ------------- | --------------------------- | --------------------------------------------------------- |
| `search`      | `string`                    | Trimmed input text driving the filter.                     |
| `itemCount`   | `number`                    | Number of visible items after the last pass.               |
| `items`       | `Map<string, number>`       | `value → score`, descending-score insertion order.         |
| `groups`      | `Map<string, Set<string>>`  | Group ids that still contain a visible item.               |

### Selection badge (view only)

`<Combobox.BadgeItem value>` derives everything from the root: `index = values.indexOf(value)`,
`isHighlighted = index === highlightedBadgeIndex`, `position = index + 1`,
`setSize = badgeList.badgeCount`. It stores no value of its own.

---

## 2. State classes

### `ComboboxRootState`

Constructed by `<Combobox.Root>` and published on the root context.

**Constructor props** (all getters, per CLAUDE.md §4):

`getValues`, `setValues`, `getOpen`, `setOpen`, `getInputValue`, `setInputValue`, `getOnFilter`,
`getAutoHighlight`, `getDisabled`, `getExactMatch`, `getManualFiltering`, `getLoop`, `getModal`,
`getMultiple`, `getOpenOnFocus`, `getPreserveInputOnBlur`, `getReadOnly`, `getDir`, and `id`
(the single `$props.id()` every part id derives from).

**Reactive fields**

| Field                   | Rune                                             | Purpose                                                            |
| ----------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `selectedText`          | `$state('')`                                     | Label of the current single selection; what `Escape`/blur restores. |
| `highlightedItem`       | `$state<ComboboxItemData \| null>(null)`         | Drives `aria-activedescendant` and `data-highlighted`.              |
| `highlightedBadgeIndex` | `$state(-1)`                                     | `-1` = the caret owns the interaction.                              |
| `hasAnchor`             | `$state(false)`                                  | Set by `<Combobox.Anchor>`; picks the popover's `customAnchor`.     |
| `anchorElement`         | `$state<HTMLElement \| null>(null)`              | The `customAnchor` value.                                           |
| `inputElement`          | `$state<HTMLInputElement \| null>(null)`         | Every refocus target.                                               |
| `hasBadgeList`          | `$state(false)`                                  | Gates badge keyboard navigation in the input.                       |
| `collection`            | `ComboboxCollection`                             | DOM-ordered items + group membership.                               |
| `filter`                | `$derived.by(...)` over `combobox-filter.ts`     | Recomputed on `(search, exactMatch, manualFiltering, onFilter, item set)`. |

**Derived**

| Field           | Expression                                                                    |
| --------------- | ----------------------------------------------------------------------------- |
| `values`        | `getValues()` — always `string[]`                                             |
| `open`          | `getOpen()`                                                                   |
| `inputValue`    | `getInputValue()`                                                             |
| `dir`           | `getDir()` (resolved by `DirectionReader`)                                    |
| `dataState`     | `open ? 'open' : 'closed'`                                                    |
| `inputId`       | `` `${id}-input` ``                                                           |
| `labelId`       | `` `${id}-label` ``                                                           |
| `listId`        | `` `${id}-list` ``                                                            |
| `visibleItems`  | `collection.getItems().filter(i => !i.disabled && isItemVisible(i.value))`     |

**Methods**

| Method                                    | Behaviour (upstream source)                                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setValue(next: string)`                  | No-op when `disabled \|\| readOnly`. Multiple: toggle `next` in/out of `values` (ignoring `''`). Single: replace. (`combobox-root.tsx:333-351`)               |
| `removeValue(value: string)`              | Filter it out of `values`. (`combobox-root.tsx:353-361`)                                                                                                   |
| `setOpen(next: boolean)`                  | On close clears `filter.search`; multiple → reset `highlightedBadgeIndex`; single with an unset `selectedText` and a string `defaultValue` → seed it. (`:289-305`) |
| `setInputValue(next: string)`             | No-op when `disabled \|\| readOnly`; fires `onInputValueChange`; when `autoHighlight && open` → `highlightMove('first')`. (`:312-322`)                       |
| `isItemVisible(value)`                    | `manualFiltering \|\| !search \|\| (items.get(value) ?? 0) > 0` (`use-filter-store.ts:148-155`)                                                             |
| `isListEmpty(manual = false)`             | `manual \|\| (itemCount === 0 && search.trim() !== '')` (`use-filter-store.ts:157-165`)                                                                     |
| `isGroupVisible(groupId, forceMount)`     | `forceMount \|\| !search \|\| groups.has(groupId)` (`combobox-group.tsx:650-653`)                                                                           |
| `highlightMove(direction)`                | Over `visibleItems`; `next`/`prev` clamp or wrap on `loop`; `first`/`last`; `selected` finds `values[0]` else index 0; then `scrollIntoView({block:'nearest'})`. (`use-list-highlighting.ts:22-73`) |
| `selectItem(item)`                        | Calls `item.onSelect?.(item.value)`; multiple → clear input text; single → input text = label, `selectedText` = label, clear highlight, close; then reset `filter.search` and `setValue(item.value)`; refocus input. (`combobox-item.tsx:79-123`) |
| `focusInput()`                            | `inputElement?.focus()`                                                                                                                                    |

### `ComboboxCollection`

| Member                                     | Purpose                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| `register(item): () => void`               | Adds to the item map and, when `groupId` is set, to the group map; returns the teardown the item's `$effect` returns. |
| `getItems(): ComboboxItemData[]`           | All items sorted by `compareDocumentPosition`.                             |
| `getGroupValues(groupId): string[]`        | Values registered under a group, for group visibility.                     |
| `size`                                     | Registered item count (the unfiltered `itemCount`).                        |

### `ComboboxItemState`

Published on the item context for `ItemText` and `ItemIndicator`.

| Member          | Type                            |
| --------------- | ------------------------------- |
| `value`         | `string` (derived)              |
| `textId`        | `string`                        |
| `isSelected`    | `boolean` (derived)             |
| `isDisabled`    | `boolean` (derived)             |
| `isHighlighted` | `boolean` (derived)             |
| `setLabelNode`  | `(node: HTMLElement \| null) => void` — `ItemText` reports its element so the label falls back to `textContent` |

### Small contexts

| Context           | Key symbol               | Carries                                                        |
| ----------------- | ------------------------ | -------------------------------------------------------------- |
| group             | `Symbol('combobox-group')` | `{ id, labelId, forceMount }`                                  |
| badge list        | `Symbol('combobox-badge-list')` | `{ orientation, badgeCount }` (both derived)              |
| badge item        | `Symbol('combobox-badge-item')` | `{ id, value, isHighlighted, position, disabled }`        |
| content           | `Symbol('combobox-content')` | `{ side, align, forceMount }` — read by `Arrow`             |

---

## 3. Validation rules

| Rule                                                                                  | Where enforced             | Requirement |
| ------------------------------------------------------------------------------------- | -------------------------- | ----------- |
| `<Combobox.Item value>` must be a non-empty string                                     | item initialisation, throws | Edge case, FR-001 |
| Every non-root part must have its provider above it                                    | `get*Context()`, throws     | CLAUDE.md §5 |
| `<Combobox.GroupLabel>` requires `<Combobox.Group>`; `<Combobox.ItemText>`/`ItemIndicator` require `<Combobox.Item>`; `<Combobox.BadgeItem>` requires `<Combobox.BadgeList>`; `<Combobox.BadgeItemDelete>` requires `<Combobox.BadgeItem>`; `<Combobox.Arrow>` requires `<Combobox.Content>` | same | same |
| `disabled` or `readOnly` blocks `setValue` and `setInputValue`                          | `ComboboxRootState`         | FR-035, FR-036 |
| `multiple` ignores an empty-string selection                                            | `setValue`                  | upstream `:340` |
| `Loading` `max` must be a positive non-`NaN` number, else `100`; `value` must be `0 ≤ v ≤ max`, else indeterminate | `combobox-loading.svelte`   | FR-022 |
| Badge keyboard navigation requires `multiple` **and** a mounted `<Combobox.BadgeList>`  | input keydown               | FR-012…FR-014 |

---

## 4. State transitions

### Popover open state

```
closed ──type any character──────────────────────────► open      (unless disabled/readOnly)
closed ──ArrowDown/ArrowUp──────────────────────────► open + highlight(selected|first|last)
closed ──Trigger click──────────────────────────────► open + refocus input + highlight(selected|first)
closed ──input focus (openOnFocus, !readOnly)───────► open
open   ──Escape────────────────────────────────────► closed + revert input text + clear highlight
open   ──Tab (not modal)───────────────────────────► closed
open   ──Tab (modal)───────────────────────────────► open (preventDefault — trapped)
open   ──Enter on highlighted item (single)────────► closed
open   ──Enter on highlighted item (multiple)──────► open
open   ──Enter, nothing highlighted / empty list───► closed + revert input text, value unchanged
open   ──item click (single)────────────────────────► closed
open   ──item click (multiple)──────────────────────► open
open   ──ArrowLeft at caret 0 (multiple + badges)──► closed + highlight last badge
open   ──outside pointerdown / Trigger click───────► closed
```

Every transition clears `filter.search` on close and resets `highlightedBadgeIndex` to `-1` when
`multiple`.

### Badge highlight (`highlightedBadgeIndex`, multiple + badge list only)

```
-1 ──ArrowLeft (caret at 0, popover open)──────► values.length - 1   (and closes the popover)
-1 ──ArrowLeft (caret at 0, popover closed)────► values.length - 1
 i ──ArrowLeft (popover closed)────────────────► max(0, i - 1)
 i ──ArrowRight (caret at end, closed, i < last)► i + 1
 i ──ArrowRight (caret at end, closed, i = last)► -1  + refocus input
 i ──Enter─────────────────────────────────────► remove values[i], then -1
 i ──Backspace/Delete (input empty)────────────► remove values[i], then (values.length > 1 ? max(0, i-1) : -1)
-1 ──Backspace/Delete (input empty)────────────► remove last value, index stays -1
 * ──badge focus────────────────────────────────► that badge's index
 i ──badge blur (owns the highlight)───────────► -1
 * ──input blur / popover close─────────────────► -1
```

### Item highlight (`highlightedItem`)

```
null ──ArrowDown (open)──────► first visible
null ──ArrowUp (open)────────► last visible
 x   ──ArrowDown─────────────► next visible (clamp at last, or wrap when loop)
 x   ──ArrowUp───────────────► prev visible (clamp at first, or wrap when loop)
 *   ──Home / End────────────► first / last visible
 *   ──PageUp/PageDown (modal)► prev / next visible
 *   ──pointermove over item──► that item
 *   ──input text becomes ''──► null
 *   ──autoHighlight + input change while open──► first visible
 *   ──Escape / select (single) / ArrowLeft into badges──► null
```

### Input text

```
uncontrolled seed  = (!multiple && defaultValue) ? String(defaultValue) : ''
select (single)    → item label; selectedText = item label
select (multiple)  → ''
Cancel click       → '' ; filter.search = ''
Escape             → single with a value ? selectedText : ''
blur               → single with a value ? selectedText
                     : (inputValue && !preserveInputOnBlur) ? '' : unchanged
typing ''          → clears the value and the highlight
```

---

## 5. Relationships

```
Combobox.Root ── root context ──┬─ Label, Anchor, Trigger, Input, Cancel
                                ├─ BadgeList ── badge-list context ── BadgeItem ── badge-item context ── BadgeItemDelete
                                └─ Portal ─ Content ── content context ─┬─ Arrow
                                                                        ├─ Loading, Empty, Separator
                                                                        ├─ Group ── group context ─┬─ GroupLabel
                                                                        │                          └─ Item
                                                                        └─ Item ── item context ─┬─ ItemText
                                                                                                  └─ ItemIndicator
```

`Item` may sit inside or outside a `Group` (the group context is optional for it — that is the one
`get*Context()` that must **not** throw, matching upstream's
`useComboboxGroupContext(ITEM_NAME, true)`).
