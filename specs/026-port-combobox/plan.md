# Implementation Plan: Port Combobox Component

**Branch**: `026-port-combobox` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-port-combobox/spec.md`

## Summary

Port Dice UI's `@diceui/combobox` (20 parts, full WAI-ARIA combobox pattern) to Svelte 5 runes as
`src/lib/components/ui/combobox/`, distributed as one `registry:ui` entry.

Technical approach: **compose `bits-ui`'s `Popover` layer for everything positional** (portal,
floating-ui anchoring, dismissal, presence, focus scope, scroll lock) and **write bespoke runes state
for everything combobox-specific** (filter store, DOM-ordered item collection, list highlighting,
badge highlighting, progress). Upstream's `useAnchorPositioner` + `useDismiss` + `useScrollLock` +
`FloatingFocusManager` + `Presence` + `Portal` map onto `Popover.Root` / `Popover.Portal` /
`Popover.Content` (`customAnchor`, `trapFocus={false}`, `preventScroll`) essentially 1:1;
upstream's `useFilterStore` / `useFilter` / `useCollection` / `useListHighlighting` / `useProgress`
have **no** `bits-ui` equivalent and become a state class plus two pure modules.

The bespoke filter and collection modules are exported from the barrel because wave-3's `data-table`
(and `faceted`) reuse them — see [Shared modules](#shared-modules-exported-for-later-components).

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`), Svelte 5.56 (runes forced on
repo-wide by `vite.config.ts`), SvelteKit 2.63

**Primary Dependencies**: `bits-ui` ^2.18.1 (Popover: portal, floating layer, dismissible layer,
presence, focus scope, scroll lock, arrow), `@lucide/svelte` ^1.27 (`Check`, `ChevronDown`, `X`),
`tailwind-merge` + `clsx` via `$lib/utils.js` `cn()`, `tailwind-variants` (not needed — no
multi-variant part), plus two in-repo registry items: `direction-provider` (`DirectionReader`) and
`checkbox-group` (`FormControlState`).

**Storage**: N/A

**Testing**: Vitest 4 (jsdom, `globals: false`, `expect.requireAssertions: true`) +
`@testing-library/svelte` 5 + `@testing-library/user-event` 14; setup at `tests/setup.ts`
(jest-dom, `cleanup()`, `ResizeObserver` / pointer-capture / `scrollIntoView` / `matchMedia` shims).

**Target Platform**: Browsers (SSR-safe: no DOM access at module scope, no `document` outside
`$effect`), shipped as copy-in source through the shadcn-svelte registry.

**Project Type**: Component library + SvelteKit docs site (single repo, one folder per component).

**Performance Goals**: Filtering 10 000 registered items must stay interactive — upstream batches
scoring at 250 items per pass and caches normalisation in an LRU; the port keeps both. Filtering is
a `$derived` recomputation keyed on `(search, exactMatch, manualFiltering, onFilter, item set)`, so
typing one character re-scores once, not once per item component.

**Constraints**: Zero new npm dependencies. No `any`, no suppression comments, no config loosening.
No Svelte 4 idioms. No raw palette colours, no manual `dark:`, no `space-*`, no manual `z-index` on
the popover.

**Scale/Scope**: 20 part files + 2 logic modules + 1 barrel + 1 test file + 1 test harness
component + 1 demo route (7 sections) + 1 registry entry. Largest port in the project so far;
`data-table` depends on it.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                          |
| ---- | ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | All reactive logic in `combobox.svelte.ts` (state classes + Symbol contexts) and pure helpers in `combobox-filter.ts`; parts use `$props`/`$bindable`/`$derived`/`$effect` and snippets only. No stores, no `export let`, no `createEventDispatcher`, no `$:`, no `<slot>`. |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | All 20 parts, all 22 root props, all 11 keyboard bindings, all documented `data-*` and CSS variables reproduced from `.reference/diceui/packages/combobox` + `docs/content/docs/components/radix/combobox.mdx` at the pinned commit. 9 divergences recorded in [research.md](./research.md) and spec Assumptions. |
| III  | Accessibility Is a MUST             | PASS    | APG combobox pattern: `role=combobox` + `aria-expanded`/`aria-controls`/`aria-autocomplete=list`/`aria-activedescendant` on the input, `role=listbox` on content and badge list, `role=option`+`aria-selected` on items and badges, `role=group`+`aria-labelledby`, `role=status aria-live=polite` empty state, `role=progressbar` loading, `role=separator`. Full key map (§ Public API). RTL via `dir`, **including inverted badge `ArrowLeft`/`ArrowRight` semantics (Principle III MUST; recorded divergence from upstream in spec Assumptions)**. Test areas 1–6 of CLAUDE.md §7 all covered in `combobox.test.ts`. |
| IV   | Composition Over Reimplementation   | PASS    | `bits-ui` `Popover.Root`/`Portal`/`Content`/`Arrow` compose the entire floating stack; in-repo `direction-provider` and `checkbox-group`'s `FormControlState` compose direction and form detection; `@lucide/svelte` for icons. Bespoke behaviour justified below.        |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `src/lib/components/ui/combobox/`, one part per file, `combobox.svelte.ts` + `combobox-filter.ts`, `index.ts` barrel with short names + `Combobox*` aliases + prop types, `.js` extensions on every intra-repo import, one `registry:ui` entry listing all 23 non-test files, no import from `src/routes/**` or `$lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Every part exports its `Props` type from `<script lang="ts" module>`; DOM props derive from `WithElementRef<HTMLAttributes<…>>`. Root is generic (`generics="Multiple extends boolean = false"`), the pattern already used by `badge-overflow` and `tooltip`. No `any`, no `@ts-*`, no `eslint-disable`, no `svelte-ignore`. |
| VII  | Green Gate Before Commit            | PASS    | `pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build`, planned as the final task phase. No `.skip`/`.todo`; every `it` asserts.                                                                     |
| VIII | Styling Discipline                  | PASS    | `cn()` with caller `class` merged last, semantic tokens only (`bg-popover`, `text-popover-foreground`, `border-input`, `bg-accent`, `bg-secondary`, `ring-ring`, `bg-destructive`), no `dark:`, `gap-*` instead of `space-*`, no `z-index` on the popover (bits-ui owns stacking), `data-slot="combobox-<part>"` on every part, booleans written `cond ? '' : undefined`. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/combobox/+page.svelte` with one `<ComponentPreview>` per upstream demo file — 7 sections: default, groups, multiple, custom filter, debounced, virtualized, tags — plus the props table the brief requires. Runes-only page state, no `+page.ts`. |
| X    | One Feature Directory Per Component | PASS    | All spec artifacts confined to `specs/026-port-combobox/`; no git write commands; `.port-state.json`, `scripts/**`, `.reference/**` untouched.                                                                       |

**Bespoke behaviour justification (Principle IV)**:

| Bespoke behaviour                                                    | Primitive evaluated                                                              | Capability it lacks                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whole combobox state machine (root)                                  | `bits-ui` `Combobox` (`node_modules/bits-ui/dist/bits/combobox`)                  | It is a re-export of `Select` (`ComboboxRootProps = SelectSingle/MultipleRootProps + inputValue`). It owns value/label/highlight itself and exposes **none** of `onFilter`, `exactMatch`, `manualFiltering`, `autoHighlight`, `openOnFocus`, `preserveInputOnBlur`, `readOnly`, `modal`, badge list, badge keyboard navigation, or self-hiding filtered items. Wrapping it would mean fighting its internal state machine and dropping 12 documented upstream props — a Principle II violation, which admits no exception. |
| Filter store (`combobox-filter.ts`): normalisation LRU, `contains`, `fuzzy`, item scoring, batching | `bits-ui` `Command` (`Command.Root` has a `filter` prop)                          | `Command` filters its own private item registry and cannot be driven from an external `role=combobox` input, has no group auto-hide contract, no `manualFiltering` bypass, and no `exactMatch` toggle. There is no standalone filter export in `bits-ui`.                                                                        |
| DOM-ordered item collection + group membership (`ComboboxCollection`) | `bits-ui` internal collection helpers                                             | Not exported from the package's public surface; `bits-ui`'s own collections are private to `Select`/`Menu`.                                                                                                                                                |
| Virtual highlighting (`onHighlightMove('first'\|'last'\|'next'\|'prev'\|'selected')`) | `bits-ui` `Select` roving/aria-activedescendant logic                            | Private to `Select`; it also moves DOM focus into the list, whereas the combobox pattern requires focus to stay in the input with `aria-activedescendant` only.                                                                                             |
| Badge list + badge keyboard navigation                               | in-repo `tags-input`                                                              | `tags-input` owns its own value; here the badges are a *view* of the combobox value with no independent state, and the arrow keys are handled by the **combobox input**, not by the badges. Reusing `tags-input` would mean two competing value owners (that is exactly what upstream's own `combobox-tags-demo` composes at the *demo* level, and the demo does compose both). |
| `Loading` progress state                                             | in-repo `progress` / `bits-ui` `Progress`                                         | Both render a track/indicator element and require `value`; upstream's `ComboboxLoading` is an unstyled `role=progressbar` **container for arbitrary children** that self-unmounts at `state === "complete"` and when the popover is closed. Composing `Progress` would force an extra wrapper and lose the unmount semantics.                                                                  |

No violation is carried forward; Complexity Tracking stays empty.

## Public API

Every part is exported twice from `index.ts`: short name (`Root`, `Item`, …) for
`import * as Combobox` and prefixed alias (`Combobox`, `ComboboxItem`, …) for named imports, plus
its `Props` type. `ref` is `$bindable(null)` on every DOM-rendering part and `...restProps` is
spread onto the rendered element; neither is repeated in the tables below.

### `Combobox.Root` — `Combobox` — `combobox.svelte` → `<div>`

Generic: `<script lang="ts" generics="Multiple extends boolean = false">`.
`ComboboxValue<Multiple> = Multiple extends true ? string[] : string`.
Extends `WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'dir'>>`.

| Prop                   | Type                                             | Default                        | Bindable |
| ---------------------- | ------------------------------------------------ | ------------------------------ | -------- |
| `value`                | `ComboboxValue<Multiple>`                        | `multiple ? [] : ''`           | ✅       |
| `defaultValue`         | `ComboboxValue<Multiple>`                        | —                              |          |
| `onValueChange`        | `(value: ComboboxValue<Multiple>) => void`       | —                              |          |
| `open`                 | `boolean`                                        | `false`                        | ✅       |
| `defaultOpen`          | `boolean`                                        | `false`                        |          |
| `onOpenChange`         | `(open: boolean) => void`                        | —                              |          |
| `inputValue`           | `string`                                         | `!multiple && defaultValue ? String(defaultValue) : ''` | ✅ |
| `onInputValueChange`   | `(value: string) => void`                        | —                              |          |
| `onFilter`             | `(options: string[], inputValue: string) => string[]` | —                         |          |
| `dir`                  | `'ltr' \| 'rtl'`                                 | ambient `DirectionProvider` → DOM `dir` → `'ltr'` |  |
| `autoHighlight`        | `boolean`                                        | `false`                        |          |
| `disabled`             | `boolean`                                        | `false`                        |          |
| `exactMatch`           | `boolean`                                        | `false`                        |          |
| `manualFiltering`      | `boolean`                                        | `false`                        |          |
| `loop`                 | `boolean`                                        | `false`                        |          |
| `modal`                | `boolean`                                        | `false`                        |          |
| `multiple`             | `Multiple`                                       | `false`                        |          |
| `openOnFocus`          | `boolean`                                        | `false`                        |          |
| `preserveInputOnBlur`  | `boolean`                                        | `false`                        |          |
| `readOnly`             | `boolean`                                        | `false`                        |          |
| `required`             | `boolean`                                        | `false`                        |          |
| `name`                 | `string`                                         | —                              |          |
| `children`             | `Snippet`                                        | —                              |          |

Data attributes: `data-slot="combobox"`, `data-state="open"\|"closed"`, `data-disabled`.
Renders a clipped `type="text"` form input (not `type="hidden"`) when inside a `<form>`, carrying
`name`, the joined value, `disabled`, `readonly`, `required` — same pattern as `tags-input`.

### `Combobox.Label` — `ComboboxLabel` — `combobox-label.svelte` → `<label>`

`WithElementRef<HTMLLabelAttributes>` + `children`. Emits `id={labelId}`, `for={inputId}`,
`data-slot="combobox-label"`. Throws `` `<Combobox.Label>` must be used within `<Combobox.Root>`. ``

### `Combobox.Anchor` — `ComboboxAnchor` — `combobox-anchor.svelte` → `<div>`

| Prop                | Type      | Default | Bindable |
| ------------------- | --------- | ------- | -------- |
| `preventInputFocus` | `boolean` | `false` |          |
| `children`          | `Snippet` | —       |          |

Data attributes: `data-slot="combobox-anchor"`, `data-state`, `data-anchor=""`, `data-disabled`,
`data-focused`; also `dir`. Click focuses the input unless `preventInputFocus`; tracks focus/blur;
prevents implicit pointer capture and focus-stealing on primary mouse `pointerdown` (except on the
input itself). Registers itself as the popover's `customAnchor`.

### `Combobox.Trigger` — `ComboboxTrigger` — `combobox-trigger.svelte` → `<button type="button">`

| Prop       | Type      | Default        | Bindable |
| ---------- | --------- | -------------- | -------- |
| `disabled` | `boolean` | root `disabled`|          |
| `children` | `Snippet` | `<ChevronDown class="size-4" />` |  |

`aria-haspopup="listbox"`, `aria-expanded`, `aria-controls={listId}`, `dir`, `tabindex={-1}` when
enabled. Data: `data-slot="combobox-trigger"`, `data-state`, `data-disabled`.
Click toggles open, refocuses the input with the caret at the end, then highlights the selected item
(or the first item when `autoHighlight`).

### `Combobox.Input` — `ComboboxInput` — `combobox-input.svelte` → `<input>`

`WithElementRef<Omit<HTMLInputAttributes, 'value'>, HTMLInputElement>`. No own props beyond HTML
attributes — everything comes from context.

Emits `role="combobox"`, `id={inputId}`, `autocapitalize="off"`, `autocomplete="off"`,
`autocorrect="off"`, `spellcheck="false"`, `aria-expanded`, `aria-controls={listId}`,
`aria-labelledby={labelId}`, `aria-autocomplete="list"`, `aria-activedescendant`, `aria-disabled`,
`aria-readonly`, `dir`, `disabled`, `readonly`, `data-slot="combobox-input"`.

Keyboard (all of it lives here — options are never a Tab stop):

| Key                   | Behaviour                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type any character    | opens the popover (unless `disabled`/`readOnly`), sets `inputValue`, sets the filter search, clears the value + highlight when the trimmed text is empty                        |
| `ArrowDown`           | closed → open + highlight `selected` (if a value exists) else `first`; open → `next` (or `first` when nothing highlighted)                                                       |
| `ArrowUp`             | closed → open + highlight `selected` else `last`; open → `prev` (or `last` when nothing highlighted)                                                                              |
| `ArrowLeft`           | multiple + badge list + caret at the leading edge only (position 0 in LTR, end in RTL). **LTR**: open → close and highlight the last badge; closed with a badge highlighted → previous badge; closed with none → last badge. **RTL**: mirrors `ArrowRight`'s LTR behavior below — closed with a badge highlighted → next badge; past the last badge → clear the highlight and refocus the input |
| `ArrowRight`          | multiple + badge list + caret at the trailing edge only (end in LTR, position 0 in RTL). **LTR**: closed with a badge highlighted → next badge; past the last badge → clear the highlight and refocus the input. **RTL**: mirrors `ArrowLeft`'s LTR behavior above — open → close and highlight the last badge; closed with a badge highlighted → previous badge; closed with none → last badge |
| `Home` / `End`        | open → highlight `first` / `last`                                                                                                                                               |
| `PageUp` / `PageDown` | `modal` **and** open → highlight `prev` / `next`                                                                                                                                |
| `Enter`               | badge highlighted → remove it; closed with text → open; open with nothing highlighted or an empty list → revert input to `selectedText` (single, with a value) or `''` and close; otherwise select the highlighted item |
| `Escape`              | revert input to `selectedText` (single, with a value) else `''`; close; clear the highlight                                                                                       |
| `Backspace`/`Delete`  | multiple + badge list + **empty** input → remove the highlighted badge (moving the highlight to the previous one) or, when none is highlighted, the last value. With text, does nothing special |
| `Tab`                 | `modal` and open → `preventDefault()` (trapped); otherwise close and let focus move on                                                                                            |

`ArrowDown`/`ArrowUp`/`Home`/`End`/`Enter`/`Escape`/`PageUp`/`PageDown` call `preventDefault()`;
`Tab` never does except in modal mode.
Focus opens the popover when `openOnFocus` and not `readOnly`. Blur restores `selectedText` (single
with a value), else clears the text unless `preserveInputOnBlur`, and clears the badge highlight.

### `Combobox.Cancel` — `ComboboxCancel` — `combobox-cancel.svelte` → `<button type="button">`

| Prop         | Type      | Default         |
| ------------ | --------- | --------------- |
| `forceMount` | `boolean` | `false`         |
| `disabled`   | `boolean` | root `disabled` |
| `children`   | `Snippet` | `<X class="size-4" />` |

Renders nothing when `inputValue` is empty and `forceMount` is false. `aria-controls={inputId}`,
`data-slot="combobox-cancel"`, `data-disabled`. Click clears the input text and the filter search,
then refocuses the input.

### `Combobox.BadgeList` — `ComboboxBadgeList` — `combobox-badge-list.svelte` → `<div role="listbox">`

| Prop          | Type                          | Default        |
| ------------- | ----------------------------- | -------------- |
| `forceMount`  | `boolean`                     | `false`        |
| `orientation` | `'horizontal' \| 'vertical'`  | `'horizontal'` |
| `children`    | `Snippet`                     | —              |

Renders nothing unless `forceMount` or (`multiple` and at least one value).
`aria-multiselectable`, `aria-orientation`, `data-slot="combobox-badge-list"`, `data-orientation`.
Mounting it is what enables badge keyboard navigation in the input (`hasBadgeList`).

### `Combobox.BadgeItem` — `ComboboxBadgeItem` — `combobox-badge-item.svelte` → `<div role="option">`

| Prop       | Type      | Default          |
| ---------- | --------- | ---------------- |
| `value`    | `string`  | — (**required**) |
| `disabled` | `boolean` | root `disabled`  |
| `children` | `Snippet` | —                |

`id`, `aria-selected` (= highlighted), `aria-disabled`, `aria-orientation`, `aria-posinset`,
`aria-setsize`, `data-slot="combobox-badge-item"`, `data-disabled`, `data-highlighted`,
`data-orientation`. Focus highlights it; blur clears the highlight when it owns it.

### `Combobox.BadgeItemDelete` — `ComboboxBadgeItemDelete` — `combobox-badge-item-delete.svelte` → `<button type="button">`

`children` default `<X class="size-3" />`. `aria-controls={badgeId}`, `aria-disabled`,
`tabindex={-1}` when enabled, `data-slot="combobox-badge-item-delete"`, `data-disabled`,
`data-highlighted`. Click removes the badge's value and refocuses the input;
`pointerdown` is prevented so the badge never steals focus.

### `Combobox.Portal` — `ComboboxPortal` — `combobox-portal.svelte`

Wraps `bits-ui` `Popover.Portal`. Props: `to?: Element | string` (`document.body`),
`disabled?: boolean` (`false`), `children`.

### `Combobox.Content` — `ComboboxContent` — `combobox-content.svelte` → `<div role="listbox">`

Rendered through `bits-ui` `Popover.Content`.

| Prop                   | Type                                       | Default      |
| ---------------------- | ------------------------------------------ | ------------ |
| `side`                 | `'top' \| 'right' \| 'bottom' \| 'left'`   | `'bottom'`   |
| `sideOffset`           | `number`                                   | `4`          |
| `align`                | `'start' \| 'center' \| 'end'`             | `'start'`    |
| `alignOffset`          | `number`                                   | `0`          |
| `arrowPadding`         | `number`                                   | `0`          |
| `collisionBoundary`    | `Element \| Element[] \| null`             | —            |
| `collisionPadding`     | `number \| Partial<Record<Side, number>>`  | `0`          |
| `sticky`               | `'partial' \| 'always'`                    | `'partial'`  |
| `strategy`             | `'absolute' \| 'fixed'`                    | `'absolute'` |
| `avoidCollisions`      | `boolean`                                  | `true`       |
| `fitViewport`          | `boolean`                                  | `false`      |
| `hideWhenDetached`     | `boolean`                                  | `false`      |
| `trackAnchor`          | `boolean`                                  | `true`       |
| `forceMount`           | `boolean`                                  | `false`      |
| `onEscapeKeyDown`      | `(event: KeyboardEvent) => void`           | —            |
| `onPointerDownOutside` | `(event: PointerEvent) => void`            | —            |
| `children`             | `Snippet`                                  | —            |

Data: `data-slot="combobox-content"`, `data-state="open"\|"closed"`, `data-side`, `data-align`.
CSS variables re-exposed under the upstream names (aliased to the `bits-ui` ones so both work):
`--dice-transform-origin`, `--dice-anchor-width`, `--dice-anchor-height`, `--dice-available-width`,
`--dice-available-height`. Anchors to `<Combobox.Anchor>` when present, else to the input.
`trapFocus={false}` + `onOpenAutoFocus`/`onCloseAutoFocus` prevented keeps focus in the input;
`preventScroll={modal}` reproduces upstream's scroll lock.

### `Combobox.Arrow` — `ComboboxArrow` — `combobox-arrow.svelte` → `<svg>`

`width` (`10`), `height` (`5`), `children` (default `<path d="M0 10 L15 0 L30 10" fill="currentColor" />`).
Composes `bits-ui` `Popover.Arrow`. Data: `data-slot="combobox-arrow"`, `data-side`, `data-align`,
`data-state`.

### `Combobox.Loading` — `ComboboxLoading` — `combobox-loading.svelte` → `<div role="progressbar">`

| Prop       | Type              | Default |
| ---------- | ----------------- | ------- |
| `value`    | `number \| null`  | `null`  |
| `max`      | `number`          | `100`   |
| `label`    | `string`          | —       |
| `children` | `Snippet`         | —       |

Renders nothing when the popover is closed or the progress state is `complete`.
`aria-label={label}`, `aria-valuemin={0}`, `aria-valuemax={max}`, `aria-valuenow` (only when
numeric), `data-slot="combobox-loading"`, `data-state="indeterminate"\|"loading"\|"complete"`,
`data-value`, `data-max`. An out-of-range or non-numeric `value` degrades to indeterminate;
`max ≤ 0` or `NaN` degrades to `100`.

### `Combobox.Empty` — `ComboboxEmpty` — `combobox-empty.svelte` → `<div role="status">`

`keepVisible?: boolean` (`false`), `children`. Renders when the popover is open **and**
`keepVisible || (visibleCount === 0 && search.trim() !== '')`. `aria-live="polite"`,
`aria-atomic="true"`, `data-slot="combobox-empty"`, `data-state="empty"`.

### `Combobox.Group` — `ComboboxGroup` — `combobox-group.svelte` → `<div role="group">`

`forceMount?: boolean` (`false`), `children`. Hidden when a search is active and no registered item
of this group is visible. `id`, `aria-labelledby={groupLabelId}`, `data-slot="combobox-group"`.

### `Combobox.GroupLabel` — `ComboboxGroupLabel` — `combobox-group-label.svelte` → `<div>`

`children`. `id={groupLabelId}`, `data-slot="combobox-group-label"`. Throws when used outside
`<Combobox.Group>`.

### `Combobox.Item` — `ComboboxItem` — `combobox-item.svelte` → `<div role="option">`

| Prop       | Type                        | Default          |
| ---------- | --------------------------- | ---------------- |
| `value`    | `string`                    | — (**required**, must be non-empty) |
| `label`    | `string`                    | the item's rendered text |
| `disabled` | `boolean`                   | `false`          |
| `onSelect` | `(value: string) => void`   | —                |
| `children` | `Snippet`                   | —                |

Renders nothing when filtered out. Throws `` `<Combobox.Item>` value cannot be an empty string. ``
`id`, `aria-selected`, `aria-disabled`, `aria-labelledby={textId}`, `tabindex={-1}` when enabled,
`data-dice-collection-item=""`, `data-slot="combobox-item"`, `data-state="checked"\|"unchecked"`,
`data-highlighted`, `data-disabled`. Pointer move highlights; click selects (single: set value,
replace input text with the label, close, refocus input; multiple: toggle value, clear input, keep
open) — in both modes the filter search is reset.

### `Combobox.ItemText` — `ComboboxItemText` — `combobox-item-text.svelte` → `<span>`

`children`. `id={textId}`, `data-slot="combobox-item-text"`. Reports its `textContent` to the item
as the label when the item has no explicit `label`.

### `Combobox.ItemIndicator` — `ComboboxItemIndicator` — `combobox-item-indicator.svelte` → `<span>`

`forceMount?: boolean` (`false`), `children` (default `<Check class="size-4" />`). Renders only when
the item is selected unless `forceMount`. `aria-hidden="true"`,
`data-slot="combobox-item-indicator"`.

### `Combobox.Separator` — `ComboboxSeparator` — `combobox-separator.svelte` → `<div role="separator">`

`keepVisible?: boolean` (`false`), `children`. Hidden while a search is active unless `keepVisible`.
`aria-hidden="true"`, `data-slot="combobox-separator"`.

### Snippets and callbacks summary

No part takes a render-prop-style `Snippet<[T]>`; every part takes only `children: Snippet`
(upstream has no render props either). Callbacks are `onValueChange`, `onOpenChange`,
`onInputValueChange`, `onFilter` (Root), `onSelect` (Item), `onEscapeKeyDown`,
`onPointerDownOutside` (Content) — plus the native DOM handlers that flow through `...restProps`
and are composed with (never replaced by) the part's own handlers.

### Shared modules exported for later components

`data-table` (wave 3) and `faceted` reuse these; they are exported from
`src/lib/components/ui/combobox/index.ts` and listed in the registry entry.

| Export                                                                              | File                  | Why it is shared                                                             |
| ----------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------- |
| `createFilter({ exactMatch, gapMatch })` → `{ contains, fuzzy, startsWith, endsWith }` | `combobox-filter.ts`  | The exact upstream matcher (`@diceui/shared` `useFilter`), needed identically by faceted filters and data-table column filters. |
| `normalizeWithGaps(value)`                                                          | `combobox-filter.ts`  | Normalisation + LRU cache; the scoring contract depends on it.                |
| `scoreItem(value, search, { onFilter, exactMatch })`                                 | `combobox-filter.ts`  | Upstream's `getItemScore` ranking (`2` exact, `1.5` prefix, `1`/`0` matcher). |
| `ComboboxFilterStore`                                                               | `combobox-filter.ts`  | Search term + visible-value map + group visibility, batched at 250 items.     |
| `ComboboxCollection`                                                                | `combobox.svelte.ts`  | DOM-ordered item registry with group membership — upstream's `useCollection`. |
| `ComboboxRootState`, `ComboboxItemState`, all `get*Context()` helpers, `ComboboxValue`, `ComboboxHighlightDirection` | `combobox.svelte.ts` | Lets `data-table` build its own composed combobox parts.                      |

## Project Structure

### Documentation (this feature)

```text
specs/026-port-combobox/
├── plan.md              # This file
├── research.md          # Phase 0 output — 14 decisions incl. every divergence
├── data-model.md        # Phase 1 output — entities, state, contexts, transitions
├── quickstart.md        # Phase 1 output — how to validate the port end to end
├── contracts/
│   └── combobox-public-api.md   # Phase 1 output — machine-checkable API contract
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/combobox/
├── index.ts                             # barrel: short names + Combobox* aliases + prop types + shared modules
├── combobox.svelte                      # Root            ← combobox-root.tsx
├── combobox-label.svelte                # Label           ← combobox-label.tsx
├── combobox-anchor.svelte               # Anchor          ← combobox-anchor.tsx
├── combobox-trigger.svelte              # Trigger         ← combobox-trigger.tsx
├── combobox-input.svelte                # Input           ← combobox-input.tsx
├── combobox-cancel.svelte               # Cancel          ← combobox-cancel.tsx
├── combobox-badge-list.svelte           # BadgeList       ← combobox-badge-list.tsx
├── combobox-badge-item.svelte           # BadgeItem       ← combobox-badge-item.tsx
├── combobox-badge-item-delete.svelte    # BadgeItemDelete ← combobox-badge-item-delete.tsx
├── combobox-portal.svelte               # Portal          ← combobox-portal.tsx
├── combobox-content.svelte              # Content         ← combobox-content.tsx
├── combobox-arrow.svelte                # Arrow           ← combobox-arrow.tsx
├── combobox-loading.svelte              # Loading         ← combobox-loading.tsx
├── combobox-empty.svelte                # Empty           ← combobox-empty.tsx
├── combobox-group.svelte                # Group           ← combobox-group.tsx
├── combobox-group-label.svelte          # GroupLabel      ← combobox-group-label.tsx
├── combobox-item.svelte                 # Item            ← combobox-item.tsx
├── combobox-item-text.svelte            # ItemText        ← combobox-item-text.tsx
├── combobox-item-indicator.svelte       # ItemIndicator   ← combobox-item-indicator.tsx
├── combobox-separator.svelte            # Separator       ← combobox-separator.tsx
├── combobox.svelte.ts                   # state classes + Symbol contexts + collection + highlighting
│                                        #   ← combobox-root.tsx + use-collection.ts + use-list-highlighting.ts
├── combobox-filter.ts                   # pure matcher + scoring + filter store
│                                        #   ← use-filter.ts + use-filter-store.ts
├── combobox.test.svelte                 # test harness (bind:value, form, snippets, bare parts) — NOT in registry
└── combobox.test.ts                     # colocated tests — NOT in registry

src/routes/docs/components/combobox/
└── +page.svelte                         # 7 <ComponentPreview> sections + props table

registry.json                            # append one registry:ui entry named "combobox"
```

**Structure Decision**: 20 part files map 1:1 onto the 20 upstream `.tsx` files in
`.reference/diceui/packages/combobox/src/` (the registry wrapper
`.reference/diceui/docs/registry/bases/radix/ui/combobox.tsx` supplies the default classes and the
`data-slot` names, which we fold into the same files — this project ships styled parts, not a
headless package plus a wrapper). The two logic modules absorb the four `@diceui/shared` hooks that
`bits-ui` does not cover. Folder slug `combobox` == demo route segment `combobox` == registry item
name `combobox`.

**Registry entry**:

```jsonc
{
	"name": "combobox",
	"type": "registry:ui",
	"title": "Combobox",
	"description": "An input with a popover that helps users filter through a list of options.",
	"registryDependencies": ["direction-provider", "checkbox-group"],
	"dependencies": ["bits-ui", "@lucide/svelte"],
	"files": [
		/* the 23 non-test files listed above, each { "type": "registry:ui" } */
	]
}
```

`direction-provider` for `DirectionReader`/`Direction`; `checkbox-group` for `FormControlState`
(the same two dependencies `tags-input` and `editable` already declare, and the reason the
cross-component-import verifier passes).

## Implementation Phases

Ordered so that each phase is independently checkable; `/speckit-tasks` expands these.

| Phase | Deliverable                                                                                                    | Gate                                             |
| ----- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| P1    | `combobox-filter.ts` — matcher, LRU, scoring, `ComboboxFilterStore`                                            | unit-testable in isolation                       |
| P2    | `combobox.svelte.ts` — `ComboboxCollection`, `ComboboxRootState`, `ComboboxItemState`, 5 Symbol contexts + throwing getters | type-checks; contexts throw the documented errors |
| P3    | Root + Label + Anchor + Input + Trigger + Cancel (US1 base, single select + filtering)                          | US1 acceptance scenarios 1–5                     |
| P4    | Portal + Content + Item + ItemText + ItemIndicator + Empty (popover, US1 complete, US3 ARIA)                    | US1 + US3 acceptance scenarios                   |
| P5    | BadgeList + BadgeItem + BadgeItemDelete + the input's badge key handling (US2)                                  | US2 acceptance scenarios 1–7                     |
| P6    | Group + GroupLabel + Separator + Loading + Arrow (US4)                                                          | US4 acceptance scenarios 1–4                     |
| P7    | `index.ts` barrel, form input, `dir` wiring (US5)                                                              | US5 + FR-037                                     |
| P8    | `combobox.test.svelte` harness + `combobox.test.ts` (all six CLAUDE.md §7 areas, upstream's 22 tests as the floor) | `pnpm run test:unit -- --run`                    |
| P9    | `src/routes/docs/components/combobox/+page.svelte` (7 sections + props table)                                  | `pnpm run build`                                 |
| P10   | `registry.json` entry + `pnpm run registry:build`                                                              | entry lists all 23 files                         |
| P11   | Quality gates: `format` → `check` → `lint` → `test:unit -- --run` → `build`                                     | all green, nothing suppressed                    |

## Test Plan

`src/lib/components/ui/combobox/combobox.test.ts`, driven through
`combobox.test.svelte` (a harness component — a `.ts` spec cannot express `bind:value`, a `<form>`
ancestor, snippets, or a part rendered with no provider). Every upstream test in
`.reference/diceui/packages/combobox/test/combobox.test.tsx` is the floor; `userEvent` replaces
`fireEvent` wherever it can express the interaction.

1. **Roles and ARIA** — `role=combobox`/`listbox`/`option`/`group`/`status`/`progressbar`/`separator`;
   `aria-expanded`, `aria-controls`, `aria-autocomplete`, `aria-activedescendant`,
   `aria-labelledby`, `aria-selected`, `aria-disabled`, `aria-haspopup`, `aria-posinset`,
   `aria-setsize`, `aria-multiselectable`, `aria-orientation`, `aria-live`; `<label for>` ↔ input id.
2. **Keyboard** — one test per row of the Input key table, including `Home`, `End`,
   `PageUp`/`PageDown` **with and without** `modal`, `Tab` **with and without** `modal`, `Escape`
   revert, `Enter` on an empty/unhighlighted list, badge `ArrowLeft`/`ArrowRight`/`Enter`/
   `Backspace`/`Delete`, and `Backspace` with non-empty text asserting **no** removal.
3. **Uncontrolled** — `defaultValue` seeds value *and* input text (single); `defaultOpen`; internal
   interaction updates both.
4. **Controlled** — `value` + `onValueChange`, `open` + `onOpenChange`, `inputValue` +
   `onInputValueChange`; an authoritative parent that declines the write keeps the component still.
5. **RTL** — `dir="rtl"` present on anchor, input, trigger and content; and the ambient
   `<DirectionProvider dir="rtl">` fallback. Badge `ArrowLeft`/`ArrowRight` navigation **inverts**
   under `dir="rtl"` — `ArrowRight` highlights the last badge from the caret edge and moves toward
   earlier badges, `ArrowLeft` moves toward later badges and exits to the input (Constitution
   Principle III; recorded divergence from upstream in spec Assumptions).
6. **Guard rails** — `disabled` and `readOnly` suppress typing/opening/selection; empty `Item`
   `value` throws; every part that consumes a context — all 19 non-root parts for the root context,
   plus `GroupLabel` outside `Group`, `BadgeItem` outside `BadgeList`, `BadgeItemDelete` outside
   `BadgeItem`, and `ItemText`/`ItemIndicator` outside `Item` — rendered with no provider throws the
   documented `must be used within` error.
7. **Filtering** — default fuzzy, `exactMatch`, `onFilter`, `manualFiltering`, group auto-hide,
   separator auto-hide, `Empty` with and without `keepVisible`, `autoHighlight` on open and on
   re-filter, `loop` on and off at both boundaries.
8. **Form** — inside a `<form>`, `name` submits the value; `required`/`disabled`/`readOnly` honoured.

## Demo Route

`src/routes/docs/components/combobox/+page.svelte` — one `<ComponentPreview>` per upstream demo:

| Section              | Upstream file                       | What it proves                                                            |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| Default              | `combobox-demo.tsx`                 | single select, built-in fuzzy filter, empty state, item indicator          |
| With Groups          | `combobox-groups-demo.tsx`          | groups + labels + separators auto-hiding under filter, controlled `value`  |
| With Multiple Selection | `combobox-multiple-demo.tsx`     | `multiple` + `autoHighlight` + badge list                                  |
| With Custom Filter   | `combobox-custom-filter-demo.tsx`   | `onFilter` replacing the built-in matcher (using the exported `createFilter`, since `match-sorter` is not a dependency here) |
| With Debounce        | `combobox-debounced-demo.tsx`       | `manualFiltering` + `inputValue`/`onInputValueChange` + `Loading` progress + `Empty keepVisible` |
| With Virtualization  | `combobox-virtualized-demo.tsx`     | 10 000 items with `manualFiltering` + a windowed slice computed in the page (no virtualization library — consumer-composition, spec Assumptions) |
| With Tags Input      | `combobox-tags-demo.tsx`            | `Combobox.Anchor` composed with the ported `tags-input`                    |

Plus a props table for the Root and the parts that add props, rendered from a plain array in the
page (runes state only, no `+page.ts`).

## Complexity Tracking

> No Constitution Check violation is carried forward. This table is intentionally empty.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | —         | —          | —                                      |

## Post-Design Constitution Re-check

Re-evaluated after `research.md`, `data-model.md`, `contracts/` and `quickstart.md` were produced:
**all ten principles still PASS**, with these design-time confirmations:

- **II** — the design covers all 20 parts, all 22 root props, all 11 keyboard bindings, all
  documented `data-*` and all five CSS variables. The 9 divergences are enumerated in
  `research.md` (D-1…D-9) and are all either "bits-ui owns it" or "MDX contract vs. source omission".
- **IV** — the popover stack is 100 % composed (`bits-ui` `Popover`); the bespoke surface is exactly
  the six rows justified above, each with the primitive evaluated and the capability it lacks.
- **VI** — the only generic is the Root's `Multiple`, a pattern already shipped in `badge-overflow`
  and `tooltip`; the conditional `ComboboxValue<Multiple>` is confined to the Root's prop boundary,
  and every internal consumer sees a plain `string[]`.
- **VIII** — no `z-index` anywhere; `--dice-*` CSS variables are aliases, not new tokens; no new
  colour token is required (`bg-accent`, `bg-secondary`, `bg-destructive`, `ring-ring` all exist).
