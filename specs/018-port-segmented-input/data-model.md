# Phase 1 Data Model: Segmented Input

**Feature**: `018-port-segmented-input` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

This component holds no persisted data. "Data model" here means the reactive entities, their fields,
their derivations and the DOM contract they project.

---

## 1. Entity map

```text
<SegmentedInput.Root>
  ├─ owns  SegmentedInputRootState        ← published on SEGMENTED_INPUT_CONTEXT_KEY (Symbol)
  │         ├─ dir / orientation / size / disabled / invalid / required   (derived from props)
  │         └─ nav: SegmentNavigation      ← the reusable, markup-free unit (FR-015)
  │                  └─ segments: DomOrderedCollection<SegmentEntryMeta>   (composed, R-03)
  └─ renders children
        └─ <SegmentedInput.Item> × n
              ├─ registers (id, element, SegmentEntryMeta) into nav
              └─ derives position, disabled, required, class from root + own props
```

Only **one** context key exists. The item reads the root state and reaches `state.nav` through it;
`SegmentNavigation` itself is never placed on context, so Time Picker can instantiate it freely.

---

## 2. `SegmentedInputRootState` — `segmented-input.svelte.ts`

Constructed once per `<SegmentedInput.Root>`. All reactive inputs arrive as **getter functions**
(`CLAUDE.md` §4); nothing is snapshotted in the constructor.

### Constructor props

| Field            | Type                              | Source                                            |
| ---------------- | --------------------------------- | ------------------------------------------------- |
| `getDir`         | `() => Direction`                 | `useDirection({ dir: () => dir, element: () => ref }).current` |
| `getOrientation` | `() => SegmentedInputOrientation` | root prop, default `'horizontal'`                  |
| `getSize`        | `() => SegmentedInputSize`        | root prop, default `'default'`                     |
| `getDisabled`    | `() => boolean`                   | root prop, default `false`                         |
| `getInvalid`     | `() => boolean`                   | root prop, default `false`                         |
| `getRequired`    | `() => boolean`                   | root prop, default `false`                         |

### Fields

| Field         | Kind                | Value                                                         |
| ------------- | ------------------- | ------------------------------------------------------------- |
| `dir`         | `$derived`          | `#props.getDir()`                                             |
| `orientation` | `$derived`          | `#props.getOrientation()`                                     |
| `size`        | `$derived`          | `#props.getSize()`                                            |
| `disabled`    | `$derived`          | `#props.getDisabled()`                                        |
| `invalid`     | `$derived`          | `#props.getInvalid()`                                         |
| `required`    | `$derived`          | `#props.getRequired()`                                        |
| `nav`         | `readonly` instance | `new SegmentNavigation({ getOrientation, getDir })`           |

### Methods

| Method                                              | Contract                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `resolveDisabled(own: boolean \| undefined): boolean` | `own ?? this.disabled` — per-item override wins, including an explicit `false` |
| `resolveRequired(own: boolean \| undefined): boolean` | `own ?? this.required`                                                         |

`invalid` has **no** resolver: upstream offers no per-item override (spec FR-006), so the item reads
`root.invalid` directly.

### Context helpers

```ts
const SEGMENTED_INPUT_CONTEXT_KEY = Symbol('segmented-input');

export function setSegmentedInputContext(state: SegmentedInputRootState): SegmentedInputRootState;
export function hasSegmentedInputContext(): boolean;
export function getSegmentedInputContext(consumer?: string): SegmentedInputRootState;
//   throws: `<SegmentedInput.Item>` must be used within `<SegmentedInput.Root>`.
```

---

## 3. `SegmentNavigation` — `segment-navigation.svelte.ts` (the reusable unit, FR-015)

Markup-independent. Imports only `DomOrderedCollection` and the `Direction` type. This is the module
Time Picker will import.

### Constructor props

| Field            | Type                       |
| ---------------- | -------------------------- |
| `getOrientation` | `() => SegmentOrientation` |
| `getDir`         | `() => Direction`          |

### `SegmentEntryMeta` — what each segment must supply at registration

| Field          | Type                        | Used by                                              |
| -------------- | --------------------------- | ---------------------------------------------------- |
| `getDisabled`  | `() => boolean`             | arrow skipping (FR-010), paste eligibility (FR-014)  |
| `getReadOnly`  | `() => boolean`             | paste eligibility only (FR-014) — read-only is still focusable |
| `getMaxLength` | `() => number \| undefined` | paste splitting widths (R-10)                        |
| `setValue`     | `(next: string) => void`    | paste application (R-11)                             |

### Fields & methods

| Member                                          | Kind       | Contract                                                                              |
| ----------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `segments`                                      | `readonly` | `DomOrderedCollection<SegmentEntryMeta>`                                              |
| `count`                                         | `$derived` | `segments.size`                                                                       |
| `register(id, element, meta)` / `unregister(id)` | method     | delegates; idempotent                                                                 |
| `indexOf(id)`                                   | method     | `segments.indexById.get(id) ?? -1`                                                    |
| `positionOf(id)`                                | method     | `resolveSegmentPosition(indexOf(id), count)`                                          |
| `onKeydown(event, id)`                          | method     | R-08 / R-09; calls `preventDefault()` only when it moves focus                        |
| `onPaste(event, id)`                            | method     | R-10; calls `preventDefault()` only when it distributes                               |
| `focusAt(index, caret)`                         | method     | `'start' \| 'end'` — focuses and places the caret; no-op for an out-of-range index    |

### Pure exported helpers (unit-tested without a DOM)

```ts
export const SEGMENT_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export const SEGMENT_POSITIONS = ['isolated', 'first', 'middle', 'last'] as const;

export type SegmentOrientation = (typeof SEGMENT_ORIENTATIONS)[number];
export type SegmentPosition    = (typeof SEGMENT_POSITIONS)[number];
export type SegmentIntent      = 'previous' | 'next' | 'first' | 'last';

export function resolveSegmentPosition(index: number, count: number): SegmentPosition;
export function resolveSegmentIntent(
  key: string, orientation: SegmentOrientation, dir: Direction
): SegmentIntent | null;
export function splitPastedValue(
  text: string, maxLengths: readonly (number | undefined)[]
): string[];
```

#### `resolveSegmentPosition(index, count)`

| Condition                | Result       |
| ------------------------ | ------------ |
| `index < 0` (unregistered) | `'isolated'` |
| `count <= 1`             | `'isolated'` |
| `index === 0`            | `'first'`    |
| `index === count - 1`    | `'last'`     |
| otherwise                | `'middle'`   |

#### `resolveSegmentIntent(key, orientation, dir)`

See the table in [research.md R-08](./research.md#r-08--arrow-key-navigation-caret-boundary-guarded).
Anything not in that table returns `null`.

#### `splitPastedValue(text, maxLengths)`

Algorithm in [research.md R-10](./research.md#r-10--paste-distribution). Total function: never
throws, returns `[]` for blank input, never returns more entries than `maxLengths.length`, and never
returns an entry longer than its corresponding `maxLengths[i]` when that is defined.

### State transitions

`SegmentNavigation` holds **no mutable state of its own** beyond the collection. Focus lives in the
DOM; values live in each item's `$bindable` prop. There is no state machine to diagram — every
"transition" is a single synchronous handler:

| Event                    | Guard                                                       | Effect                                                            |
| ------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `keydown` → `next`       | caret at end of value, no selection, an enabled segment ahead | `preventDefault`, focus that segment, caret at start              |
| `keydown` → `previous`   | caret at 0, no selection, an enabled segment behind          | `preventDefault`, focus that segment, caret at end                |
| `keydown` → `first`/`last` | an enabled segment exists                                   | `preventDefault`, focus it, caret at start / end                  |
| `keydown`, guard fails   | —                                                           | nothing; the browser moves the caret                              |
| `paste`, ≥2 parts        | not `defaultPrevented`, ≥1 eligible target                   | `preventDefault`, `setValue` per target, focus last written, caret at end |
| `paste`, ≤1 part         | —                                                           | nothing; the browser pastes normally                              |

---

## 4. Item-level derivations — `segmented-input-item.svelte`

| Derived value | Expression                                                   | Requirement |
| ------------- | ------------------------------------------------------------ | ----------- |
| `id`          | `$props.id()`                                                | R-02        |
| `position`    | `positionProp ?? root.nav.positionOf(id)`                    | FR-003      |
| `isDisabled`  | `root.resolveDisabled(disabled)`                             | FR-006      |
| `isRequired`  | `root.resolveRequired(required)`                             | FR-006      |
| `isInvalid`   | `root.invalid`                                               | FR-006      |
| `class`       | `cn(segmentedInputItemVariants({ position, orientation: root.orientation, size: root.size }), className)` | FR-004/FR-005, Principle VIII |

Registration effect:

```svelte
$effect(() => {
  if (!ref) return;
  root.nav.register(id, ref, {
    getDisabled: () => isDisabled,
    getReadOnly: () => readOnly === true,
    getMaxLength: () => maxlength,
    setValue: (next) => { value = next; ref?.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  return () => root.nav.unregister(id);
});
```

---

## 5. DOM contract

### Root — `<div>` (or the `child` element)

| Attribute          | Value                                        | Requirement |
| ------------------ | -------------------------------------------- | ----------- |
| `data-slot`        | `"segmented-input"`                          | VIII        |
| `role`             | `"group"`                                    | FR-001      |
| `aria-orientation` | `"horizontal" \| "vertical"`                 | FR-001      |
| `dir`              | resolved direction                           | FR-012      |
| `data-orientation` | `"horizontal" \| "vertical"`                 | FR-007      |
| `data-disabled`    | `''` when `disabled`, else absent            | FR-007      |
| `data-invalid`     | `''` when `invalid`, else absent             | FR-007      |
| `data-required`    | `''` when `required`, else absent            | FR-007      |
| `class`            | `cn('flex', horizontal ? 'flex-row' : 'flex-col', className)` | FR-004 |

### Item — the composed `<Input>` → `<input>`

| Attribute          | Value                                                      | Requirement |
| ------------------ | ---------------------------------------------------------- | ----------- |
| `data-slot`        | `"segmented-input-item"`                                   | VIII        |
| `data-position`    | `"isolated" \| "first" \| "middle" \| "last"`               | FR-007      |
| `data-orientation` | inherited from the root                                    | FR-007      |
| `data-disabled`    | `''` when resolved-disabled, else absent                   | FR-007      |
| `data-invalid`     | `''` when the group is invalid, else absent                | FR-007      |
| `data-required`    | `''` when resolved-required, else absent                   | FR-007      |
| `aria-invalid`     | `true` when the group is invalid, else `undefined`         | FR-006      |
| `aria-required`    | `true` when resolved-required, else `undefined`            | FR-006      |
| `disabled`         | resolved-disabled                                          | FR-006      |
| `required`         | resolved-required                                          | FR-006      |
| `class`            | variant classes, caller `class` merged last                | VIII        |

Every boolean data attribute is written `cond ? '' : undefined` (Principle VIII).

---

## 6. Validation rules

| Rule                                                          | Where enforced                         |
| ------------------------------------------------------------- | -------------------------------------- |
| An item outside a root throws with `/within/`                 | `getSegmentedInputContext(consumer)`   |
| `position` never leaves `SEGMENT_POSITIONS`                   | `resolveSegmentPosition` return type   |
| Arrow navigation never wraps                                  | index clamped in `SegmentNavigation`   |
| Disabled segments are never focused by arrows/Home/End        | `getDisabled()` filter                 |
| Disabled **or read-only** segments never receive a paste part | `getDisabled()`/`getReadOnly()` filter |
| Pasted parts never exceed a segment's `maxlength`             | `splitPastedValue` truncation          |
| Extra pasted parts are discarded silently, never thrown       | `slice(0, maxLengths.length)`          |
| A caller's own `onkeydown`/`onpaste` can veto both behaviours | `defaultPrevented` early return (R-12) |
