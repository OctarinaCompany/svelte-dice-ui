# Phase 1 Data Model: Key Value

**Feature**: `024-port-key-value` | **Date**: 2026-07-31

Everything below lives in `src/lib/components/ui/key-value/key-value.svelte.ts` unless stated
otherwise. Types marked **exported** are re-exported from the barrel.

---

## 1. Value types

### `KeyValueItemData` — exported

One row of the list. Upstream `ItemData` (`key-value.tsx:84-88`), renamed to match upstream's own
public alias `KeyValueItemData` (`key-value.tsx:856`).

| Field   | Type     | Notes                                                                     |
| ------- | -------- | ------------------------------------------------------------------------- |
| `id`    | `string` | Stable across add / remove / reorder. Minted by `createKeyValueItemId()`. |
| `key`   | `string` | Trimmed on write when `trim` (default `true`).                            |
| `value` | `string` | Trimmed on write when `trim`.                                             |

**Validation rules**: none intrinsic — a row is always structurally valid. Semantic validity comes from
`onKeyValidate`, `onValueValidate` and duplicate detection (§3).

### `KeyValueField` — exported

`"key" | "value"`. Upstream `Field` (`key-value.tsx:26`). Selects which message a
`<KeyValue.Error>` shows and which half of a `KeyValueItemErrors` record it reads.

### `KeyValueOrientation` — exported

`"vertical" | "horizontal"`. Upstream `Orientation` (`key-value.tsx:25`). Drives
`data-orientation` and the `flex-col` / `flex-row` switch on `KeyValue.List`.

### `KeyValueItemErrors` — exported

`{ key?: string; value?: string }`. The messages currently recorded against one row. Upstream's inline
`{ key?: string; value?: string }` (`key-value.tsx:93`).

### `KeyValueErrors` — exported

`Record<string, KeyValueItemErrors>`. Keyed by row id. **An id is absent from this record exactly when
that row is valid** — the record is never populated with empty objects, because the whole list's
`isInvalid` is `Object.keys(errors).length > 0` (upstream `key-value.tsx:244`).

---

## 2. `KeyValueRootState`

One instance per `<KeyValue.Root>`, published on `KEY_VALUE_CONTEXT_KEY`. Replaces upstream's `Store`,
`StoreContext` and `KeyValueContext` (research R-01).

### Constructor input — `KeyValueRootStateProps`

Reactive inputs arrive as getter functions so the root's `$bindable` props stay authoritative.

```
readonly getValue:              () => KeyValueItemData[]
readonly setValue:              (value: KeyValueItemData[]) => void
readonly getOnPaste:            () => ((event: ClipboardEvent, items: KeyValueItemData[]) => void) | undefined
readonly getOnAdd:              () => ((value: KeyValueItemData) => void) | undefined
readonly getOnRemove:           () => ((value: KeyValueItemData) => void) | undefined
readonly getOnKeyValidate:      () => ((key: string, value: KeyValueItemData[]) => string | undefined) | undefined
readonly getOnValueValidate:    () => ((value: string, key: string, items: KeyValueItemData[]) => string | undefined) | undefined
readonly getMaxItems:           () => number | undefined
readonly getMinItems:           () => number
readonly getKeyPlaceholder:     () => string
readonly getValuePlaceholder:   () => string
readonly getAllowDuplicateKeys: () => boolean
readonly getEnablePaste:        () => boolean
readonly getTrim:               () => boolean
readonly getStripQuotes:        () => boolean
readonly getDisabled:           () => boolean
readonly getReadOnly:           () => boolean
readonly getRequired:           () => boolean
readonly getDir:                () => Direction
readonly rootId:                string
```

### Reactive fields

| Field                   | Kind      | Meaning                                                              |
| ----------------------- | --------- | -------------------------------------------------------------------- |
| `errors`                | `$state`  | `KeyValueErrors`, initially `{}`.                                    |
| `focusedId`             | `$state`  | `string \| null`. Presentational only → `data-highlighted`.          |
| `focusRequestId`        | `$state`  | `string \| null`. One-shot focus request (R-08); not rendered.       |
| `value`                 | `$derived`| The row array, read through `getValue`.                              |
| `isInvalid`             | `$derived`| `Object.keys(this.errors).length > 0`.                               |
| `count`                 | `$derived`| `this.value.length`.                                                 |
| `canAdd`                | `$derived`| `!disabled && !readOnly && (maxItems === undefined \|\| count < maxItems)` |
| `canRemove`             | `$derived`| `!disabled && !readOnly && count > minItems`                         |
| `maxItems`, `minItems`, `keyPlaceholder`, `valuePlaceholder`, `allowDuplicateKeys`, `enablePaste`, `trim`, `stripQuotes`, `disabled`, `readOnly`, `required`, `dir` | `$derived` | Straight reads of the matching getter. |

### Methods

| Method                                                | Upstream origin                     | Behaviour                                                                                                                                                                                                        |
| ----------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getItem(id): KeyValueItemData \| undefined`          | `state.value.find(...)`             | Row lookup.                                                                                                                                                                                                      |
| `setField(id, field, text)`                           | `:424-478` / `:625-679`             | Writes one field of one row (trimming when `trim`), publishes the new array through `setValue`, then calls `validateItem`. No-op when `disabled \|\| readOnly`.                                                  |
| `validateItem(id, nextValue)`                         | `:436-473`                          | The four-step routine of research R-07; mutates `errors` for that id only.                                                                                                                                       |
| `add()`                                               | `:780-804`                          | No-op when `!canAdd`. Appends `{ id: createKeyValueItemId(), key: '', value: '' }`, sets `focusedId` and `focusRequestId` to it, calls `onAdd`.                                                                   |
| `remove(id)`                                          | `:729-749`                          | No-op when `!canRemove` or the id is unknown. Filters the row out, deletes `errors[id]`, sets `focusedId` / `focusRequestId` to the next row's id (or the previous row's when the removed row was last, else `null`), calls `onRemove` with the removed row. |
| `pasteInto(id, text, event)`                          | `:480-564`                          | Returns `false` (paste not intercepted) when `!enablePaste \|\| disabled \|\| readOnly`, or when the text has ≤ 1 non-blank line, or when parsing yields no rows. Otherwise splices per §4, truncates to `maxItems`, sets `focusedId` / `focusRequestId` to the last inserted row, calls `onPaste(event, parsed)`, returns `true`. |
| `consumeFocusRequest(id): boolean`                    | new (R-08)                          | `true` (and clears `focusRequestId`) when it matches.                                                                                                                                                            |
| `errorId(itemId, field): string`                      | `getErrorId` (`:37-39`)             | `` `${rootId}-${itemId}-${field}-error` ``.                                                                                                                                                                      |
| `errorFor(itemId, field): string \| undefined`        | `errors[id]?.[field]`               | Message lookup.                                                                                                                                                                                                  |

### State transitions

```
                 add()                      remove(id)
  [n rows] ─────────────────► [n+1 rows] ─────────────────► [n-1 rows]
      │  guard: canAdd            │  focusRequestId = new       │  guard: canRemove
      │                           │  focusedId      = new       │  errors[id] deleted
      │                                                         │  focus → next ?? prev ?? null
      │  pasteInto(id, text)  (≥2 non-blank lines, parsed.length > 0)
      └────────────────────────► row `id` replaced when empty, else rows inserted after it,
                                 then sliced to maxItems; focus → last inserted row
```

`errors` transitions only through `validateItem` (per edited row) and `remove` (delete). Nothing else
writes it, which is what makes the spec's "removing a row clears its error" edge case hold by
construction.

---

## 3. `KeyValueItemState`

One instance per rendered row, created by the internal `key-value-item-provider.svelte` and published on
`KEY_VALUE_ITEM_CONTEXT_KEY` (research R-02).

| Member       | Kind       | Meaning                                                                                     |
| ------------ | ---------- | -------------------------------------------------------------------------------------------- |
| `id`         | `readonly` | The row id — stable, so the instance is stable across list mutations under the keyed `{#each}`. |
| `data`       | `$derived` | `root.getItem(this.id) ?? { id, key: '', value: '' }` — reactive, so a keystroke in row 2 does not re-run row 1. |
| `key`        | `$derived` | `this.data.key`.                                                                            |
| `value`      | `$derived` | `this.data.value`.                                                                          |
| `isHighlighted` | `$derived` | `root.focusedId === this.id`.                                                            |
| `keyError`   | `$derived` | `root.errorFor(this.id, 'key')`.                                                            |
| `valueError` | `$derived` | `root.errorFor(this.id, 'value')`.                                                          |

---

## 4. Paste parsing (pure functions)

### `stripSurroundingQuotes(text: string, shouldStrip: boolean): string` — exported

Upstream `removeQuotes` (`key-value.tsx:41-52`). Returns `text` unchanged when `!shouldStrip`;
otherwise trims and, if the result both starts and ends with `"` or both with `'`, drops those two
characters.

### `parseKeyValueText(text: string, options: { stripQuotes: boolean }): Array<{ key: string; value: string }>` — exported

Upstream `key-value.tsx:487-525`.

1. Split on `/\r?\n/`, drop lines whose `trim()` is empty.
2. Per line, first matching branch wins:
   | Branch                       | `key`                      | `value`                                                        |
   | ---------------------------- | -------------------------- | -------------------------------------------------------------- |
   | contains `=`                 | `parts[0].trim()`          | `stripSurroundingQuotes(parts.slice(1).join('=').trim(), …)`   |
   | else contains `:`            | `parts[0].trim()`          | `stripSurroundingQuotes(parts.slice(1).join(':').trim(), …)`   |
   | else matches `/\s{2,}\|\t/`  | `parts[0].trim()`          | `stripSurroundingQuotes(parts.slice(1).join(' ').trim(), …)`   |
   | else                         | — line produces no row —                                                                    |
3. Rows with a falsy `key` are dropped.

The caller (`pasteInto`) mints ids. **`parseKeyValueText` is called on the full clipboard text but only
*applied* when the text had more than one non-blank line** — the single-line case falls through to the
browser's default paste (FR-006, spec US2.5).

### Splice rule

Let `i` be the index of the row pasted into, `parsed` the minted rows:

```
rows = (rows[i].key === '' && rows[i].value === '')
     ? [...rows.slice(0, i),     ...parsed, ...rows.slice(i + 1)]   // replace the empty row
     : [...rows.slice(0, i + 1), ...parsed, ...rows.slice(i + 1)]   // insert after
if (maxItems !== undefined) rows = rows.slice(0, maxItems)
```

---

## 5. Ids

`createKeyValueItemId(): string` — exported. Module-level counter, `key-value-item-${++n}`
(research R-11).

Derived ids:

- root id: the caller's `id`, else `$props.id()`.
- error id: `` `${rootId}-${itemId}-${field}-error` `` — referenced by the field's `aria-describedby`
  and rendered as the `id` of `<KeyValue.Error>`.

---

## 6. Contexts

| Key symbol                     | Payload             | Set by                            | Getter                                                         |
| ------------------------------ | ------------------- | --------------------------------- | -------------------------------------------------------------- |
| `Symbol('key-value')`          | `KeyValueRootState` | `key-value.svelte`                | `getKeyValueContext(consumerName)`                             |
| `Symbol('key-value-item')`     | `KeyValueItemState` | `key-value-item-provider.svelte`  | `getKeyValueItemContext(consumerName)`                         |

Both getters throw when the context is absent, naming the consumer and its required ancestor
(FR-016) — upstream `key-value.tsx:98-104`, `:363-369`:

- root getter: ``` `<KeyValue.Item> must be used within <KeyValue.Root>.` ``` (message parameterised by
  `consumerName`).
- item getter: ``` `<KeyValue.KeyInput> must be used within <KeyValue.List>.` ```

Both messages contain the word **within**, which the guard-rail test asserts with `/within/`.
