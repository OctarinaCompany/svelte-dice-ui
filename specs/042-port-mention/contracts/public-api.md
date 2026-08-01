# Contract: `mention` public API

**Feature**: `042-port-mention` | **Consumed by**: docs demo route, `registry.json` installs,
`mention.test.ts`.

This is the interface the port exposes. It is derived field by field from
`.reference/diceui/packages/mention/src/*` and
`.reference/diceui/docs/content/docs/components/radix/mention.mdx` at the pinned commit. Upstream
JSDoc, including `@default`, is copied onto every prop.

Import styles, both supported:

```ts
import * as Mention from '$lib/components/ui/mention/index.js'; // Mention.Root, Mention.Item
import { Mention, MentionItem } from '$lib/components/ui/mention/index.js';
```

---

## `Mention.Root` — `mention.svelte` (alias `Mention`, `MentionRoot`)

Container for every part; owns the value list, the open state, the field text, the mention spans and
the filter. Renders a `<div>`.

Props type: `MentionRootProps = WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'dir'>, HTMLDivElement> & {…}`

| Prop                  | Type                                             | Default          | Bindable | Upstream                     |
| --------------------- | ------------------------------------------------ | ---------------- | -------- | ---------------------------- |
| `value`               | `string[]`                                       | `defaultValue`   | **yes**  | `value`                      |
| `defaultValue`        | `string[]`                                       | `[]`             | no       | `defaultValue`               |
| `onValueChange`       | `(value: string[]) => void`                      | —                | no       | `onValueChange`              |
| `open`                | `boolean`                                        | `defaultOpen`    | **yes**  | `open`                       |
| `defaultOpen`         | `boolean`                                        | `false`          | no       | `defaultOpen`                |
| `onOpenChange`        | `(open: boolean) => void`                        | —                | no       | `onOpenChange`               |
| `inputValue`          | `string`                                         | `''`             | **yes**  | `inputValue`                 |
| `onInputValueChange`  | `(value: string) => void`                        | —                | no       | `onInputValueChange`         |
| `trigger`             | `string`                                         | `'@'`            | no       | `trigger`                    |
| `dir`                 | `Direction` (`'ltr' \| 'rtl'`)                   | provider → DOM → `'ltr'` | no | `dir`                     |
| `disabled`            | `boolean`                                        | `false`          | no       | `disabled`                   |
| `onFilter`            | `(options: string[], term: string) => string[]`  | —                | no       | `onFilter`                   |
| `exactMatch`          | `boolean`                                        | `false`          | no       | `exactMatch`                 |
| `loop`                | `boolean`                                        | `false`          | no       | `loop`                       |
| `modal`               | `boolean`                                        | `false`          | no       | `modal`                      |
| `readonly`            | `boolean`                                        | `false`          | no       | `readonly` (lowercase, R-10) |
| `required`            | `boolean`                                        | `false`          | no       | `required`                   |
| `name`                | `string`                                         | —                | no       | `name`                       |
| `id`                  | `string`                                         | `$props.id()`    | no       | added (every part id derives from it) |
| `ref`                 | `HTMLDivElement \| null`                         | `null`           | **yes**  | `forwardRef`                 |
| `class`               | `string`                                         | —                | no       | `className`                  |

Snippets: `children: Snippet`.
Callbacks: `onValueChange`, `onOpenChange`, `onInputValueChange`, `onFilter`.
`...restProps` is spread onto the `<div>`.

Notes:

- `exactMatch` is ignored while `onFilter` is supplied (upstream doc comment, FR-012).
- `readonly` allows an open popup to be navigated but blocks selection (FR-028).
- Emits `data-slot="mention"`, `data-state`, `data-disabled`.
- Renders the hidden form input when `name` is set and a `<form>` ancestor exists.

---

## `Mention.Label` — `mention-label.svelte` (alias `MentionLabel`)

`<label id={labelId} for={inputId}>`. Props: `MentionLabelProps =
WithElementRef<HTMLLabelAttributes, HTMLLabelElement>`. Snippet: `children`. No callbacks.
Throws ``` `<Mention.Label>` must be used within `<Mention.Root>`. ``` outside the root.

---

## `Mention.Input` — `mention-input.svelte` (alias `MentionInput`)

The field. Renders `<div style="position:relative">` containing `<Mention.Highlighter>` and an
`<input>` (or the `child` element).

Props type: `MentionInputProps = WithElementRef<Omit<HTMLInputAttributes, 'dir' | 'value'>, HTMLInputElement | HTMLTextAreaElement> & { child?: Snippet<[{ props: MentionInputChildProps }]> }`

| Prop    | Type                                            | Default | Bindable | Notes                                       |
| ------- | ----------------------------------------------- | ------- | -------- | ------------------------------------------- |
| `ref`   | `HTMLInputElement \| HTMLTextAreaElement \| null` | `null` | **yes**  | also set in `child` mode, via the attachment |
| `child` | `Snippet<[{ props: MentionInputChildProps }]>`   | —       | no       | replaces upstream `asChild` (D-1)           |
| `class` | `string`                                        | —       | no       | merged last                                  |

`MentionInputChildProps` carries: `data-slot`, `data-state`, `data-disabled`, `data-readonly`,
`role="combobox"`, `id`, `dir`, `disabled`, `readonly`, `autocomplete="off"`, every `aria-*` below,
every event handler below, `class`, an attachment key, and `...restProps`.

It deliberately does **not** carry `value`, and `MentionInputProps` omits `value` from
`HTMLInputAttributes` altogether: Svelte re-assigns `element.value` whenever its own record of the
attribute changed, which would knock the caret back to the end of the field immediately after a
mention splice placed it. The field text is instead re-asserted onto `element.value` from the root
context in an `$effect`, so the DOM still follows the context — including when an authoritative
parent declines a write — without touching the selection.

Rendered ARIA (FR-018): `role="combobox"`, `aria-expanded`, `aria-controls={listId}`,
`aria-labelledby={labelId}`, `aria-autocomplete="list"`, `aria-activedescendant` (highlighted item's
id, absent when nothing is highlighted), `aria-disabled`, `aria-readonly`.

Handled events (each runs the caller's handler first; `preventDefault()` on the caller's event
suppresses the port's, reproducing `composeEventHandlers`): `oninput`, `onbeforeinput`, `onclick`,
`oncut`, `onfocus`, `onkeydown`, `onpaste`, `onpointerdown`, `onselect`.

Usage as a textarea:

```svelte
<Mention.Input placeholder="Type @ to mention someone…">
	{#snippet child({ props })}
		<textarea {...props} rows={3}></textarea>
	{/snippet}
</Mention.Input>
```

---

## `Mention.Portal` — `mention-portal.svelte` (alias `MentionPortal`)

| Prop       | Type                | Default         | Bindable | Upstream                    |
| ---------- | ------------------- | --------------- | -------- | --------------------------- |
| `to`       | `Element \| string` | `document.body` | no       | `container` (renamed, D-2)  |
| `disabled` | `boolean`           | `false`         | no       | added (matches `combobox`)  |

Snippet: `children` (normally a `<Mention.Content>`). Renders nothing of its own; throws outside the
root.

---

## `Mention.Content` — `mention-content.svelte` (alias `MentionContent`)

The anchored popup. `role="listbox"`, `aria-orientation="vertical"`, `id={listId}`, `dir`.

| Prop                   | Type                                                     | Default      | Bindable |
| ---------------------- | -------------------------------------------------------- | ------------ | -------- |
| `side`                 | `'top' \| 'right' \| 'bottom' \| 'left'`                 | `'bottom'`   | no       |
| `sideOffset`           | `number`                                                 | `4`          | no       |
| `align`                | `'start' \| 'center' \| 'end'`                           | `'start'`    | no       |
| `alignOffset`          | `number`                                                 | `0`          | no       |
| `arrowPadding`         | `number`                                                 | `0`          | no       |
| `collisionBoundary`    | `Element \| Element[] \| null`                           | —            | no       |
| `collisionPadding`     | `number \| Partial<Record<Side, number>>`                | `0`          | no       |
| `sticky`               | `'partial' \| 'always'`                                  | `'partial'`  | no       |
| `strategy`             | `'absolute' \| 'fixed'`                                  | `'absolute'` | no       |
| `avoidCollisions`      | `boolean`                                                | `true`       | no       |
| `fitViewport`          | `boolean`                                                | `false`      | no       |
| `forceMount`           | `boolean`                                                | `false`      | no       |
| `hideWhenDetached`     | `boolean`                                                | `false`      | no       |
| `trackAnchor`          | `boolean`                                                | `true`       | no       |
| `onEscapeKeyDown`      | `(event: KeyboardEvent) => void`                         | —            | no       |
| `onPointerDownOutside` | `(event: PointerEvent) => void`                          | —            | no       |
| `ref`                  | `HTMLDivElement \| null`                                 | `null`       | **yes**  |

Snippet: `children` (the items). `align` is mirrored (`start`↔`end`) under `dir="rtl"` (FR-030).
Data attributes: `data-slot="mention-content"`, `data-state`, `data-side`, `data-align`,
`data-pasting`. CSS variables: `--dice-transform-origin`, `--dice-anchor-width`,
`--dice-anchor-height`, `--dice-available-width`, `--dice-available-height`.

---

## `Mention.Item` — `mention-item.svelte` (alias `MentionItem`)

| Prop       | Type      | Default | Bindable | Notes                                                     |
| ---------- | --------- | ------- | -------- | --------------------------------------------------------- |
| `value`    | `string`  | —       | no       | **required**, must not be `''` (throws at initialisation) |
| `label`    | `string`  | `value` | no       | what is spliced into the field text                       |
| `disabled` | `boolean` | `false` | no       | OR-ed with the root's `disabled`                          |
| `ref`      | `HTMLDivElement \| null` | `null` | **yes** | —                                            |

Snippet: `children`. No callbacks (selection flows through the root's `onValueChange`).
Renders nothing while filtered out. ARIA: `role="option"`, `id`, `aria-selected`, `aria-disabled`.
Data: `data-slot="mention-item"`, `data-value`, `data-selected`, `data-highlighted`,
`data-disabled`, `data-dice-collection-item`.

---

## Modules exported from the barrel (reuse surface, deliverable 5)

From `mention.svelte.ts`:
`MentionRootState`, `MentionCollection`, `setMentionContext`, `getMentionContext`,
and types `MentionRootStateProps`, `MentionItemData`, `MentionMountedItem`, `MentionSpan`,
`MentionHighlightDirection`.

From `mention-caret.ts` (**rune-free, reusable by any later caret-anchored component** — e.g. a
slash-command palette or an autocomplete textarea):

| Export                                                             | Purpose                                                  |
| ------------------------------------------------------------------ | -------------------------------------------------------- |
| `measureTextWidth(text, element)`                                   | off-screen `<span>` measurement using the field's font   |
| `getLineHeight(element)`                                            | computed `line-height` with a finite-number fallback      |
| `getCaretRect(element, caret, dir)`                                 | the `DOMRect` at a caret offset, wrap- and RTL-aware     |
| `createCaretAnchor(element, caret, dir)`                            | a `Measurable` for `Popover.Content`'s `customAnchor`    |
| `resolveMentionTrigger(text, caret, trigger, spans)`                | the word-boundary trigger test (§R-15) — pure            |
| `addMentionSpan(spans, span, insertionPoint, insertionLength)`      | span algebra for an insertion                            |
| `removeMentionSpans(spans, removed)`                                | span algebra for a removal                               |
| `shiftMentionSpans(spans, caret, delta)`                            | span algebra for plain typing                            |
| types `MentionSpan`, `TriggerMatch`, `CaretAnchor`                  | —                                                        |

Also re-exported for convenience so a consumer can build a custom `onFilter` without importing the
combobox barrel: nothing. Consumers use `Combobox.createFilter` directly; the demo page does the
same, and this is stated on the docs page rather than duplicated as an export.

---

## Keyboard contract (MDX keyboard table + source)

| Key                       | Behaviour                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `<trigger>` at a boundary | Opens the popup anchored to the caret; search starts empty                                |
| printable characters      | Extends the search; a space closes the popup                                              |
| `ArrowDown`               | Open: next visible item (`first` when nothing is highlighted). No-op while `readonly`     |
| `ArrowUp`                 | Open: previous visible item (`last` when nothing is highlighted). No-op while `readonly`  |
| `Home` / `End`            | Open: first / last visible item. With `Meta`/`Ctrl` the caret moves instead               |
| `Enter`                   | Open + highlighted: select. Open + nothing highlighted: close, no `preventDefault`         |
| `Escape`                  | Close, clear highlight and search; value unchanged; focus stays in the field               |
| `Tab`                     | `modal`: select the highlighted item. Otherwise: close and let focus move                  |
| `Backspace`               | Closed, no selection, caret at/inside/one-space-after a mention: remove the whole mention  |
| `Meta`/`Ctrl` + `Backspace` | Remove the nearest preceding mention, skipping the trailing-space step                   |
| `Backspace` / `Delete`    | With a selection overlapping mentions: remove all of them plus the range, in one edit      |
| `ArrowLeft` / `ArrowRight` | No selection, no `Shift`: jump over an adjacent mention in one step                       |
| `Meta`/`Ctrl` + arrows    | Jump to the mention's exact `start` / `end`                                                |

---

## Guard-rail errors

Each part throws when used outside its provider, naming both the part and the provider:

```
`<Mention.Label>` must be used within `<Mention.Root>`.
`<Mention.Input>` must be used within `<Mention.Root>`.
`<Mention.Portal>` must be used within `<Mention.Root>`.
`<Mention.Content>` must be used within `<Mention.Root>`.
`<Mention.Item>` must be used within `<Mention.Root>`.
`<Mention.Item>` value cannot be an empty string.
```
