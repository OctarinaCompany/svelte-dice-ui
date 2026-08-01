# Phase 1 Data Model: Listbox

All reactive entities live in `src/lib/components/ui/listbox/listbox.svelte.ts`. Every class takes its
reactive inputs as **getter functions** so they stay live, and stores them in a private field.

## 1. Value types

```ts
/** The Root's public value: a plain string in single mode, an array under `multiple`. */
export type ListboxValue<Multiple extends boolean = false> = Multiple extends true ? string[] : string;

/** Upstream's `orientation` union. */
export type ListboxOrientation = 'horizontal' | 'vertical' | 'mixed';
```

Normalisation rule (root only, `$derived`): `undefined → []`, `'' → []`, `'x' → ['x']`, `string[] → as-is`.
De-normalisation on write: `multiple ? next : (next[0] ?? '')`.

## 2. `ListboxItemData` — one registered `<Listbox.Item>`

A plain snapshot, re-registered whenever any field moves (never a bag of getters, so the collection never
reaches back into an unmounted component).

| Field       | Type                                    | Source                                                       |
| ----------- | --------------------------------------- | ------------------------------------------------------------ |
| `element`   | `HTMLElement \| null`                   | the item's `ref` (`null` until mounted / in `child` mode)     |
| `value`     | `string`                                | the `value` prop; **must be non-empty** (throws otherwise)    |
| `disabled`  | `boolean`                               | item `disabled` OR root `disabled`                            |
| `onSelect`  | `((value: string) => void) \| undefined` | the `onSelect` prop                                           |
| `groupId`   | `string \| undefined`                   | nearest `<Listbox.Group>`'s id, when any                      |
| `textValue` | `string`                                | `element.textContent?.trim() ?? ''` — the typeahead haystack  |

`ListboxMountedItem = ListboxItemData & { element: HTMLElement }` — what navigation and selection walk.

**Validation rules**

- `value === ''` → throw `` `ListboxItem value cannot be an empty string` `` at initialisation (upstream
  message preserved, checked once via `untrack`).
- Duplicate `value`s are not rejected (upstream does not); first match in document order wins for
  navigation and both toggle together for selection, which is the upstream-observable behaviour.

## 3. `ListboxCollection`

```ts
class ListboxCollection {
	#items = $state.raw<readonly ListboxItemData[]>([]);
	readonly size: number;                              // $derived
	register(item: ListboxItemData): () => void;        // both list reads untracked
	getItems(): ListboxMountedItem[];                   // document order via compareDocumentPosition
	getEnabledItems(): ListboxMountedItem[];            // getItems().filter(i => !i.disabled)
	getGroupValues(groupId: string): string[];
}
```

`$state.raw` because entries are replaced wholesale and a deep proxy would break the teardown's identity
comparison. Registration happens in the item's `$effect`; the returned thunk is the teardown.

## 4. `ListboxRootState`

**Constructor props** (all getters unless noted)

| Prop                | Type                                      |
| ------------------- | ----------------------------------------- |
| `getValues`         | `() => readonly string[]`                 |
| `setValues`         | `(values: string[]) => void`              |
| `getDisabled`       | `() => boolean`                           |
| `getLoop`           | `() => boolean`                           |
| `getMultiple`       | `() => boolean`                           |
| `getOrientation`    | `() => ListboxOrientation`                |
| `getVirtual`        | `() => boolean`                           |
| `getDir`            | `() => Direction`                         |

**Reactive fields**

| Field              | Rune                     | Meaning                                                          |
| ------------------ | ------------------------ | ---------------------------------------------------------------- |
| `collection`       | (instance)               | the item registry                                                |
| `focusedValue`     | `$state<string \| null>` | which item holds roving focus (`null` = none)                    |
| `highlightedValue` | `$state<string \| null>` | pointer/keyboard highlight, independent of selection             |
| `anchorValue`      | `$state<string \| null>` | range-selection anchor (last non-`Shift` move)                   |
| `isShiftTab`       | plain `let`              | non-reactive latch, cleared on a `setTimeout(0)` (upstream 555)  |
| `typeahead`        | `ListboxTypeahead`       | buffered character matcher                                       |
| `selectedSet`      | `$derived`               | `new Set(getValues())` — O(1) `isSelected`                       |

**Methods**

| Method                                 | Behaviour                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `isSelected(value)`                    | `selectedSet.has(value)`                                                                                     |
| `selectItem(value, isMultipleEvent)`   | fires the item's `onSelect`, then applies the mode's toggle semantics and calls `setValues`                   |
| `selectAll()`                          | `multiple` only — every enabled item's value                                                                 |
| `selectRange(from, to)`                | `multiple` only — the contiguous enabled slice between two values, inclusive                                 |
| `focusItem(value)`                     | sets `focusedValue`+`highlightedValue`+`anchorValue`; calls `element.focus()` unless `virtual`                |
| `clearFocus()`                         | `focusedValue = highlightedValue = null` (Escape, blur out of the root)                                      |
| `onRootKeydown(event)`                 | the whole keyboard contract (plan §Keyboard contract)                                                        |
| `onRootFocusIn(event)` / `onRootFocusOut(event)` | first-entry focus restoration; clears `focusedValue` when focus leaves the root subtree               |
| `getNextValue(key, shiftKey)`          | pure destination resolution: orientation + RTL + grid + `loop` + disabled-skipping                           |

**Selection state transitions**

| Mode       | Current selection | Action on `v`      | Next selection      |
| ---------- | ----------------- | ------------------ | ------------------- |
| single     | `[]`              | select `v`         | `[v]`               |
| single     | `[v]`             | select `v`         | `[]` (clears)       |
| single     | `[a]`             | select `v`         | `[v]`               |
| `multiple` | `[a]`             | select `v`         | `[a, v]`            |
| `multiple` | `[a, v]`          | select `v`         | `[a]`               |
| `multiple` | any               | `Ctrl`/`Cmd`+`A`   | every enabled value |
| `multiple` | any               | `Shift`+navigation | anchor→destination  |

**Focus state transitions**

`null` --Tab into root--> remembered value, else first enabled → --arrow/Home/End/PageUp/PageDown/typeahead-->
another enabled value → --`Escape` or focus leaves the root--> `null`. `Shift+Tab` sets `isShiftTab`, clears
`focusedValue`, returns focus to the root and lets the browser move on.

## 5. `ListboxTypeahead`

```ts
class ListboxTypeahead {
	search = $state('');                            // current buffer
	handle(key: string, items: ListboxMountedItem[], from: string | null): string | null;
	reset(): void;                                   // also clears the pending timer
}
```

1000 ms inactivity resets the buffer. Matching is case-insensitive `startsWith` on `textValue`, scanning
from the item after `from` and cycling to the start. Returns the matched value or `null`.

## 6. `ListboxGroupState`

| Field     | Type     | Source                                       |
| --------- | -------- | -------------------------------------------- |
| `id`      | `string` | `$props.id()` — the group's `id` attribute    |
| `labelId` | `string` | `$props.id()` — target of `aria-labelledby`   |

## 7. `ListboxItemState`

| Field           | Type       | Meaning                                       |
| --------------- | ---------- | --------------------------------------------- |
| `value`         | `$derived` | the item's value                              |
| `isDisabled`    | `$derived` | item `disabled` OR root `disabled`            |
| `isSelected`    | `$derived` | `root.isSelected(value)`                      |
| `isHighlighted` | `$derived` | `root.highlightedValue === value`             |
| `isFocused`     | `$derived` | `root.focusedValue === value`                 |

`ItemIndicator` reads `isSelected` from this state; it mounts only when `forceMount || isSelected`.

## 8. Contexts (typed `Symbol` keys, throwing getters)

| Key symbol                  | Published by | Consumed by                    | Error when missing                                                     |
| --------------------------- | ------------ | ------------------------------ | ---------------------------------------------------------------------- |
| `Symbol('listbox')`         | `Root`       | `Item`, `Group`, `GroupLabel`  | `` `<Listbox.Item>` must be used within `<Listbox.Root>`. ``           |
| `Symbol('listbox-group')`   | `Group`      | `GroupLabel`, `Item` (optional)| `` `<Listbox.GroupLabel>` must be used within `<Listbox.Group>`. ``    |
| `Symbol('listbox-item')`    | `Item`       | `ItemIndicator`                | `` `<Listbox.ItemIndicator>` must be used within `<Listbox.Item>`. ``  |

Each getter takes the consumer's display name so the message names both parts, matching
`getComboboxContext('<Combobox.Item>')`. The group context is the one an `Item` may legitimately lack —
read through `hasListboxGroupContext()` first.

## 9. Data attributes (the styling contract)

| Element         | Attributes                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Root            | `data-slot="listbox"`, `data-orientation`, `data-disabled`, `dir`                                       |
| Group           | `data-slot="listbox-group"`                                                                             |
| Group label     | `data-slot="listbox-group-label"`                                                                       |
| Item            | `data-slot="listbox-item"`, `data-selected`, `data-highlighted`, `data-disabled`, `data-focused`         |
| Item indicator  | `data-slot="listbox-item-indicator"`                                                                    |
| Hidden input(s) | `data-slot="listbox-form-input"`                                                                        |

All boolean attributes are written `cond ? '' : undefined`. `data-focused` is additive (upstream has no
equivalent) and exists so consumers can style roving focus without relying on `:focus-visible`.
