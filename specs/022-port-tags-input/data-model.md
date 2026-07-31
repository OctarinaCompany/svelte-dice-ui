# Phase 1 Data Model — Port Tags Input

All state is in-memory component state. Two classes live in
`src/lib/components/ui/tags-input/tags-input.svelte.ts`; each receives its reactive inputs as getter
functions (CLAUDE.md §4) and is published on a `Symbol`-keyed context (§5).

---

## Entities

### Tag value

The unit of the component's value. An opaque `string`; the value array is `string[]`.

| Field       | Type     | Rules                                                                                          |
| ----------- | -------- | ------------------------------------------------------------------------------------------------ |
| _(itself)_  | `string` | Trimmed before it is committed. Unique within the array — `addItem`/`updateItem` reject duplicates by strict `===` against the **raw** value, never against `displayValue(value)` (spec Edge Cases, divergence D-3). |

Identity: a tag's index is `value.indexOf(tagValue)`. Uniqueness is what makes that unambiguous.

### Highlighted index

`number | null` — the single tag currently selected by keyboard or pointer. `null` means "no tag
highlighted; the caret owns the interaction". Never simultaneously the editing index for the same tag
(entering edit mode is what a highlighted `Enter` does).

### Editing index

`number | null` — the single tag currently rendered as an inline edit field. Only reachable when the
root is `editable` and the item is not disabled.

### Invalid-input flag

`boolean` — transient. Set by any rejected single add or update (`max`, `onValidate`, duplicate),
cleared by the next successful one. Surfaced as `data-invalid` on the root and the text input. The
paste path deliberately does not touch it (research R-08).

### Item registration

`{ value: string; disabled: boolean }` per mounted `<TagsInput.Item>`, keyed by tag value. Exists only
so keyboard navigation can skip per-item-disabled tags (research R-06). Registered in the item's
`$effect`, unregistered by its teardown.

---

## `TagsInputRootState`

### Constructor props (all getters, so they stay reactive)

```
getValue        : () => string[]
setValue        : (value: string[]) => void       // assigns the $bindable and calls onValueChange
getOnValidate   : () => ((value: string) => boolean) | undefined
getOnInvalid    : () => ((value: string) => void) | undefined
getDisplayValue : () => (value: string) => string
getAddOnPaste   : () => boolean
getAddOnTab     : () => boolean
getDisabled     : () => boolean
getEditable     : () => boolean
getLoop         : () => boolean
getReadOnly     : () => boolean
getBlurBehavior : () => 'add' | 'clear' | undefined
getDelimiter    : () => string
getMax          : () => number
getDir          : () => Direction
id              : string                          // the single $props.id() every id derives from
```

### Reactive fields

| Field                     | Kind      | Notes                                                          |
| ------------------------- | --------- | ---------------------------------------------------------------- |
| `highlightedIndex`        | `$state`  | `number \| null`                                                 |
| `editingIndex`            | `$state`  | `number \| null`                                                 |
| `isInvalidInput`          | `$state`  | `boolean`                                                        |
| `#disabledValues`         | `$state`  | `Set<string>` of per-item-disabled tag values                    |
| `#hasLabel`               | `$state`  | drives the input's conditional `aria-labelledby` (D-6)           |
| `inputElement`            | `$state`  | `HTMLInputElement \| null`, upstream's `inputRef`                 |
| `value`                   | `$derived` | `this.#props.getValue()`                                        |
| `count`                   | `$derived` | `this.value.length`                                             |
| `disabled` `readOnly` `editable` `loop` `addOnPaste` `addOnTab` `delimiter` `max` `dir` `blurBehavior` | `$derived` | pass-throughs |
| `inputId` `labelId`       | `$derived` | `` `${id}-input` `` / `` `${id}-label` ``                        |
| `labelledBy`              | `$derived` | `#hasLabel ? labelId : undefined`                                |

### Methods

| Method                                              | Contract                                                                                                              |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `displayValue(value)`                               | `getDisplayValue()(value)` — render only.                                                                              |
| `isEnabledIndex(index)`                             | `!#disabledValues.has(value[index])`.                                                                                  |
| `registerItem(getValue, getDisabled)`               | returns a teardown; keeps `#disabledValues` in sync.                                                                   |
| `registerLabel()`                                   | returns a teardown; flips `#hasLabel`.                                                                                 |
| `addItem(text, options?: { viaPaste?: boolean })`   | `boolean`. Full ordering in research R-08, including "duplicate ⇒ `true`".                                              |
| `updateItem(index, text)`                           | `void`. Duplicate (excluding self) and `onValidate` checks, then replaces in place with the raw trimmed value (D-3/D-4), highlights the tag, exits edit mode, refocuses the input after `tick()`. |
| `removeItem(index)`                                 | `void`. No-op while `disabled`/`readOnly` or `index === -1`; splices, clears both indices, refocuses the input.         |
| `leaveItem()`                                       | clears both indices and refocuses the input (upstream `onItemLeave`).                                                   |
| `clear()`                                           | `setValue([])` then refocus the input; no-op while `disabled`/`readOnly`.                                               |
| `onInputKeydown(event)`                             | The state machine below.                                                                                                |

### Keyboard state machine (`onInputKeydown`)

Pre-pass, exactly as upstream: if the input has text **and** `selectionStart !== 0`, clear both indices
and return — arrow/Backspace navigation only engages with the caret at position 0.

`isArrowStart` = `ArrowLeft` under `ltr` or `ArrowRight` under `rtl`; `isArrowEnd` is its mirror.

| Key                     | Condition                                          | Effect                                                                                         |
| ----------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Backspace` / `Delete`  | `selectionStart !== 0 \|\| selectionEnd !== 0`     | ignored                                                                                         |
|                         | a tag is highlighted                               | remove it, highlight the previous enabled tag (or `null`), `preventDefault()`                    |
|                         | `Backspace`, nothing highlighted, `count > 0`      | highlight the last enabled tag (no removal), `preventDefault()`                                  |
| `Enter`                 | a tag is highlighted, `editable`, not `disabled`   | `editingIndex = highlightedIndex`, `preventDefault()`                                            |
| `ArrowLeft`/`ArrowRight`| caret at 0, `isArrowStart`, nothing highlighted, `count > 0` | highlight the last enabled tag, `preventDefault()`                                     |
|                         | a tag is highlighted                               | move to the adjacent enabled index (wrapping when `loop`); if there is none and the key was `isArrowEnd`, clear the highlight and reset the caret to `(0, 0)` |
| `Home`                  | a tag is highlighted                               | highlight the first enabled tag, `preventDefault()`                                              |
| `End`                   | a tag is highlighted                               | highlight the last enabled tag, `preventDefault()`                                               |
| `Escape`                | always                                             | clear both indices, reset the caret to `(0, 0)`                                                  |
| any single character    | handled in the Input part                          | clears the highlight                                                                             |
| `Tab`                   | handled in the Input part                          | `addOnTab` + non-empty text ⇒ add and `preventDefault()`; otherwise normal focus move            |

Transitions that also touch the two indices: a successful single `addItem` clears both; `removeItem`
clears both; `updateItem` sets `highlightedIndex = index` and clears `editingIndex`; blurring the root
to somewhere outside it clears `highlightedIndex`.

---

## `TagsInputItemState`

### Constructor props

```
root        : TagsInputRootState
getValue    : () => string
getDisabled : () => boolean
id          : string                // the item's own $props.id()
```

### Derived fields

| Field           | Expression                                                        |
| --------------- | ------------------------------------------------------------------- |
| `value`         | `getValue()`                                                       |
| `index`         | `root.value.indexOf(this.value)` (`-1` when absent)                 |
| `isHighlighted` | `index === root.highlightedIndex`                                   |
| `isEditing`     | `index === root.editingIndex`                                       |
| `disabled`      | `getDisabled() \|\| root.disabled`                                  |
| `displayValue`  | `root.displayValue(this.value)`                                     |
| `textId`        | `` `${id}-text` ``                                                  |
| `dataState`     | `isHighlighted ? 'active' : 'inactive'`                             |

### Methods

| Method     | Contract                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------- |
| `select()` | `root.highlightedIndex = index` then focus the text input (upstream `onItemSelect`).         |
| `edit()`   | no-op unless `root.editable && !disabled`; sets `root.editingIndex = index`.                 |
| `remove()` | no-op while `disabled`; `root.removeItem(index)`.                                            |

---

## Contexts

| Key (`Symbol`)          | Set by | Read by                                              | Error when missing                                                     |
| ----------------------- | ------ | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `Symbol('tags-input')`  | Root   | Label, Input, Item, ItemText, ItemEdit, ItemDelete, Clear | `` `<part>` must be used within `<TagsInput.Root>`. ``               |
| `Symbol('tags-input-item')` | Item | ItemText, ItemEdit, ItemDelete                     | `` `<part>` must be used within `<TagsInput.Item>`. ``                 |

Both getters take the consumer's display name so the message names the part and its required ancestor
(FR-017), mirroring `getCheckboxGroupContext(consumerName)`.

---

## Pure helpers (no reactivity, exported — deliverable 5)

| Helper                                                        | Contract                                                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `splitByDelimiter(text, delimiter): string[]`                 | split → `trim` each → drop empties. Used by the paste path.                                                    |
| `findAdjacentIndex({ current, count, direction, loop, isEnabled }): number \| null` | `current === null` ⇒ first (`'next'`) or last (`'prev'`) enabled index; otherwise the next enabled index in `direction`, wrapping when `loop`, else `null`. Returns `null` when nothing is enabled. |
