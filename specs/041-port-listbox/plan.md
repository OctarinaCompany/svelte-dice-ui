# Implementation Plan: Port Listbox Component

**Branch**: `041-port-listbox` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/041-port-listbox/spec.md`

## Summary

Port Dice UI's standalone `@diceui/listbox` package (`.reference/diceui/packages/listbox/src/listbox.tsx`,
1135 lines) plus its shadcn wrapper (`.reference/diceui/docs/registry/bases/radix/ui/listbox.tsx`) to a
Svelte 5 runes component at `src/lib/components/ui/listbox/`, exposing five parts — `Root`, `Group`,
`GroupLabel`, `Item`, `ItemIndicator`.

Technical approach: upstream's `createSelectableStore` + `useSyncExternalStore` + `useCollection` collapse
into **one state module** `listbox.svelte.ts` holding `ListboxCollection` (a DOM-ordered item registry
modelled directly on `ComboboxCollection`), `ListboxRootState` (selection, roving focus, highlight,
navigation geometry, typeahead), `ListboxGroupState` and `ListboxItemState`, each published on a typed
`Symbol` context key. Direction resolution reuses the already-ported `useDirection()` from
`direction-provider`; form participation reuses `FormControlState` exported by `checkbox-group` — the same
two dependencies `combobox` and `tags-input` already declare. Nothing else is bespoke beyond the keyboard
state machine itself, for which no `bits-ui` primitive exists (see Principle IV justification).

Four APG behaviours upstream lacks — typeahead, `Shift`+arrow range selection, `Ctrl`/`Cmd`+`A` select-all,
and `PageUp`/`PageDown` — are added per spec Assumptions and Constitution Principle III, additively: no
upstream key changes meaning.

## Technical Context

**Language/Version**: TypeScript 5 (strict, `verbatimModuleSyntax`), Svelte 5 with runes forced on
repo-wide via `vite.config.ts`

**Primary Dependencies**: SvelteKit 2, Tailwind CSS v4, `@lucide/svelte` (the `Check` icon that
`ListboxItemIndicator` defaults to, exactly as `combobox-item-indicator.svelte` does), plus two
first-party registry dependencies — `direction-provider` (`useDirection`) and `checkbox-group`
(`FormControlState`). **No `bits-ui` import**: this listbox is always visible, has no popover, anchor,
portal or dismissible layer, so no `bits-ui` primitive applies (spec Assumption: "Positioning/portals are
out of scope"). **Zero new npm dependencies.**

**Storage**: N/A

**Testing**: Vitest (jsdom) + `@testing-library/svelte` + `@testing-library/user-event`, colocated at
`src/lib/components/ui/listbox/listbox.test.ts` with a `listbox.test.svelte` harness for compositions a
`.ts` spec cannot express (`bind:value`, a `<form>` ancestor, `<DirectionProvider>`, snippets, a part
rendered with no provider). `globals: false`, `expect.requireAssertions` on.

**Target Platform**: Browser (SSR-safe: no DOM access at module scope; every measurement is inside an
`$effect` or an event handler)

**Project Type**: shadcn-svelte registry component (source-distributed, single folder, one registry entry)

**Performance Goals**: Grid geometry is measured lazily — `getBoundingClientRect()` is called only inside
the arrow-key handler when `orientation === 'mixed'`, never in a `$derived` or on every render, matching
upstream's `calculateGridLayout` call site. Item registration is O(n) per mount; navigation is O(n) per
keystroke over ≤ a few hundred items, which is upstream's own complexity.

**Constraints**: No `any`, no suppressions, no Svelte 4 idioms, semantic Tailwind tokens only, every state
mirrored to a `data-*` attribute, `class` merged last, `.js` extensions on intra-repo imports.

**Scale/Scope**: 5 exported parts + 1 state module + 1 barrel = 7 registry files; 4 demo sections + an API
reference; ~90–120 `it` blocks across the six mandatory test areas.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                       |
| ---- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I    | Svelte 5 Runes Only                 | PASS    | All reactivity via `$state`/`$derived`/`$derived.by`/`$effect`/`$props`/`$bindable`; behaviour in `listbox.svelte.ts` state classes taking getter-function props; `children`/`child` snippets, no `<slot>`, no dispatcher.       |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | Every upstream prop, data attribute, ARIA attribute, error message and key handler reproduced (see Public API); the 8 divergences are enumerated in [research.md](./research.md) §Divergences and in spec Assumptions.           |
| III  | Accessibility Is a MUST             | PASS    | `role="listbox"`/`option`/`group`, `aria-selected`, `aria-disabled`, `aria-multiselectable`, `aria-labelledby`; roving tabindex with real focus; RTL inversion via `useDirection`; four APG keys added beyond upstream.          |
| IV   | Composition Over Reimplementation   | PASS    | `useDirection` (direction-provider) and `FormControlState` (checkbox-group) composed; the collection + keyboard state machine is bespoke with justification below.                                                              |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `src/lib/components/ui/listbox/`, one part per file, `index.ts` barrel with short names + prefixed aliases + types, one `registry:ui` entry listing 7 files (tests and harness excluded), no import from `src/routes`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Props types exported from `<script lang="ts" module>`, derived from `WithElementRef<HTMLAttributes<…>>`; generic root via `generics="Multiple extends boolean = false"`; no `any`, no ignore comments.                            |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit -- --run` → `build` scheduled as the final task; no `.skip`/`.todo`, every `it` asserts.                                                                                               |
| VIII | Styling Discipline                  | PASS    | `cn()` with caller `class` last; semantic tokens only (`bg-accent`, `text-accent-foreground`, `ring-border`, `text-muted-foreground`); `data-slot` on all 5 parts; booleans written `cond ? '' : undefined`.                    |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/listbox/+page.svelte` with one `<ComponentPreview>` per upstream demo file (4: default, horizontal, grid, group) plus an API reference built from `$lib/components/ui/table`.                        |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/041-port-listbox/`; no git write commands; `.reference/`, `scripts/`, `.port-*` untouched.                                                                                                           |

**Bespoke behaviour justification (Principle IV)**:

1. **`ListboxCollection` (DOM-ordered item registry with group membership)** — evaluated `bits-ui`'s
   `Select`/`Combobox` internals: their collection is private to those primitives and not exported, and
   `bits-ui` ships no standalone always-visible listbox. Evaluated `src/lib/components/ui/combobox/`'s
   exported `ComboboxCollection`: reusing it directly would make every consumer of `listbox` install the
   whole `combobox` registry item (popover, filter store, badge list) for a 40-line registry, and its item
   shape carries combobox-only fields (`label`, `id`, filter visibility). The class is therefore
   re-implemented in `listbox.svelte.ts`, deliberately mirroring `ComboboxCollection`'s `register()` /
   `getItems()` contract so the two read identically.
2. **Roving-focus + selection keyboard state machine (`ListboxRootState`)** — no `bits-ui` primitive
   exposes an always-visible, multi-selectable, grid-navigable listbox; `bits-ui`'s `Select` owns a
   trigger, a floating content layer and single-value semantics, none of which apply. This is the
   component's entire reason to exist and is ported from upstream's `onKeyDown` line-for-line, extended
   with the four APG behaviours.
3. **Grid geometry (`calculateGridLayout`)** — pure measurement of `getBoundingClientRect()` tops; no
   primitive anywhere in the repo or in `bits-ui` measures a CSS-grid item layout. Ported verbatim from
   upstream (10px row-tolerance included) so `orientation="mixed"` behaves identically.
4. **Hidden form input** — `bits-ui`'s `HiddenInput` has no `control`-mirroring or multi-value support;
   the repo's established answer (`combobox`, `tags-input`, `checkbox-group`) is a clipped input rendered
   by the root, gated on `FormControlState.isFormControl`. That primitive **is** composed; only the markup
   is local.

## Public API

Every prop below is derived from `.reference/diceui/packages/listbox/src/listbox.tsx` at the pinned commit
`d9763d8`, plus the shadcn wrapper's styling props. `Direction` is `'ltr' | 'rtl'` from
`$lib/components/ui/direction-provider/index.js`.

Shared types exported from `listbox.svelte.ts` (and re-exported by the barrel):

```ts
export type ListboxValue<Multiple extends boolean = false> = Multiple extends true ? string[] : string;
export type ListboxOrientation = 'horizontal' | 'vertical' | 'mixed';
export type ListboxItemData = {
	readonly element: HTMLElement | null;
	readonly value: string;
	readonly disabled: boolean;
	readonly onSelect: ((value: string) => void) | undefined;
	readonly groupId: string | undefined;
	readonly textValue: string; // typeahead source — the item's trimmed text content
};
export type ListboxMountedItem = ListboxItemData & { readonly element: HTMLElement };
```

### 1. `Listbox.Root` — `listbox.svelte` (upstream `ListboxRoot`)

`ListboxRootProps<Multiple extends boolean = false>` extends
`WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement>`.

| Prop            | Type                                         | Default                | Bindable | Upstream                                     |
| --------------- | -------------------------------------------- | ---------------------- | -------- | -------------------------------------------- |
| `ref`           | `HTMLDivElement \| null`                     | `null`                 | ✅       | `forwardedRef`                               |
| `value`         | `ListboxValue<Multiple>`                     | — (uncontrolled)       | ✅       | `value`                                      |
| `defaultValue`  | `ListboxValue<Multiple>`                     | `multiple ? [] : ''`   | ✗        | `defaultValue`                               |
| `onValueChange` | `(value: ListboxValue<Multiple>) => void`    | `undefined`            | ✗        | `onValueChange`                              |
| `dir`           | `Direction \| undefined`                     | resolved (see below)   | ✗        | `dir` (upstream literal default `'ltr'`)     |
| `disabled`      | `boolean`                                    | `false`                | ✗        | `disabled`                                   |
| `loop`          | `boolean`                                    | `false`                | ✗        | `loop`                                       |
| `multiple`      | `Multiple`                                   | `false`                | ✗        | `multiple`                                   |
| `orientation`   | `ListboxOrientation`                         | `'vertical'`           | ✗        | `orientation`                                |
| `virtual`       | `boolean`                                    | `false`                | ✗        | `virtual`                                    |
| `name`          | `string \| undefined`                        | `undefined`            | ✗        | `name`                                       |
| `class`         | `ClassValue`                                 | —                      | ✗        | wrapper `className`                          |
| `children`      | `Snippet`                                    | —                      | ✗        | `children`                                   |
| `child`         | `Snippet<[{ props: ListboxRootChildProps }]>` | `undefined`           | ✗        | `asChild` + `Slot`                           |

- `dir` resolution: `dir` prop → nearest `<DirectionProvider>` → nearest DOM `[dir]` → `'ltr'`, via
  `useDirection({ dir: () => dir, element: () => (ref ?? mountedElement)?.parentElement })` (anchored on
  the parent because the root writes its own `dir` onto itself).
- Callbacks/events: every `HTMLAttributes<HTMLDivElement>` handler flows through `...restProps`;
  `onkeydown`, `onfocusin` and `onfocusout` are **composed** — the caller's handler runs first and
  `event.preventDefault()` suppresses ours (the repo's `composeEventHandlers` equivalent).
- Rendered DOM: `<div role="listbox" data-slot="listbox" aria-multiselectable={multiple || undefined}`
  `aria-disabled={disabled || undefined} data-orientation={orientation} data-disabled={disabled ? '' : undefined}`
  `dir={resolvedDir} tabindex={disabled ? undefined : 0}>`, plus the hidden form input(s) when inside a
  `<form>`. Each hidden form input carries `data-slot="listbox-form-input"`, `aria-hidden="true"` and
  `tabindex="-1"`.
- Default classes (ported from the shadcn wrapper `docs/registry/bases/radix/ui/listbox.tsx`, merged through
  `cn()` with the caller's `class` **last**): Root `flex gap-2 focus-visible:outline-none` plus
  `flex-col *:data-[slot=listbox-group]:flex-col` when `orientation === 'vertical'`; Group
  `flex flex-col gap-2`; GroupLabel `px-2 pt-1 text-sm font-medium text-muted-foreground`; Item
  `flex w-full cursor-default items-center justify-between gap-2 rounded-md p-4 ring-1 ring-border outline-hidden select-none focus-visible:ring-ring data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50`;
  ItemIndicator the `<Check class="size-4">` default child. All tokens are semantic — no palette colours, no
  manual `dark:`.

### 2. `Listbox.Group` — `listbox-group.svelte` (upstream `ListboxGroup`)

| Prop       | Type                                           | Default | Bindable |
| ---------- | ---------------------------------------------- | ------- | -------- |
| `ref`      | `HTMLDivElement \| null`                       | `null`  | ✅       |
| `class`    | `ClassValue`                                   | —       | ✗        |
| `children` | `Snippet`                                      | —       | ✗        |
| `child`    | `Snippet<[{ props: ListboxGroupChildProps }]>`  | —       | ✗        |

Renders `<div role="group" id={groupId} aria-labelledby={labelId} data-slot="listbox-group">`. `groupId`
and `labelId` both come from `$props.id()` (upstream `React.useId()`). Publishes `ListboxGroupState` on
context so `GroupLabel` and `Item` can read `labelId` / `id`. No callbacks.

### 3. `Listbox.GroupLabel` — `listbox-group-label.svelte` (upstream `ListboxGroupLabel`)

Same four props as `Group`. Renders `<div id={group.labelId} data-slot="listbox-group-label">`. Throws
``` `<Listbox.GroupLabel>` must be used within `<Listbox.Group>`. ``` when used outside a `Group`.

### 4. `Listbox.Item` — `listbox-item.svelte` (upstream `ListboxItem`)

`ListboxItemProps` extends `WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'onselect'>, HTMLDivElement>`.

| Prop       | Type                                          | Default | Bindable | Upstream   |
| ---------- | --------------------------------------------- | ------- | -------- | ---------- |
| `ref`      | `HTMLDivElement \| null`                      | `null`  | ✅       | ref        |
| `value`    | `string` (**required**, non-empty)            | —       | ✗        | `value`    |
| `disabled` | `boolean`                                     | `false` | ✗        | `disabled` |
| `onSelect` | `(value: string) => void`                     | —       | ✗        | `onSelect` |
| `class`    | `ClassValue`                                  | —       | ✗        | className  |
| `children` | `Snippet`                                     | —       | ✗        | children   |
| `child`    | `Snippet<[{ props: ListboxItemChildProps }]>`  | —       | ✗        | `asChild`  |

- Throws ``ListboxItem value cannot be an empty string`` on `value === ''` (upstream message preserved),
  checked once at initialisation through `untrack`, and
  ``` `<Listbox.Item>` must be used within `<Listbox.Root>`. ``` outside the root.
- Composed handlers: `onclick`, `onfocus`, `onblur`, `onkeydown`, `onpointermove`, `onpointerleave`.
- Rendered DOM: `<div role="option" aria-selected={isSelected} aria-disabled={isDisabled || undefined}`
  `data-slot="listbox-item" data-selected data-highlighted data-focused data-disabled tabindex={isDisabled ? undefined : -1}>`
  (`data-focused` is additive — see spec Assumptions).

### 5. `Listbox.ItemIndicator` — `listbox-item-indicator.svelte` (upstream `ListboxItemIndicator`)

| Prop         | Type                                               | Default              | Bindable | Upstream     |
| ------------ | -------------------------------------------------- | -------------------- | -------- | ------------ |
| `ref`        | `HTMLSpanElement \| null`                          | `null`               | ✅       | ref          |
| `forceMount` | `boolean`                                          | `false`              | ✗        | `forceMount` |
| `class`      | `ClassValue`                                       | —                    | ✗        | className    |
| `children`   | `Snippet`                                          | a `<Check>` icon     | ✗        | children     |
| `child`      | `Snippet<[{ props: ListboxItemIndicatorChildProps }]>` | —                | ✗        | `asChild`    |

Renders nothing unless `forceMount || item.isSelected`. Emits
`<span aria-hidden="true" data-slot="listbox-item-indicator">`. Throws
``` `<Listbox.ItemIndicator>` must be used within `<Listbox.Item>`. ``` outside an `Item`.

### Keyboard contract (root `onkeydown`)

| Key                          | Behaviour                                                                                              | Source        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ | ------------- |
| `Tab`                        | First entry focuses the remembered item, else the first enabled item (root `focusin`)                  | upstream      |
| `Shift+Tab`                  | Clears remembered focus, returns focus to the root, lets the browser leave                             | upstream      |
| `ArrowUp` / `ArrowDown`      | Vertical + mixed: prev/next enabled item; in `mixed` with >1 column, ±`columnCount` (same column)       | upstream      |
| `ArrowLeft` / `ArrowRight`   | Horizontal + mixed: prev/next enabled item, **inverted when `dir === 'rtl'`**                           | upstream      |
| `Home` / `End`               | First / last enabled item                                                                              | upstream      |
| `PageUp` / `PageDown`        | Same as `ArrowUp` / `ArrowDown`                                                                        | **APG (add)** |
| `Enter` / `Space`            | Select focused item with mode semantics; `scrollIntoView({ block:'nearest' })` unless `virtual`         | upstream      |
| `Escape`                     | Clears `focusedValue` and `highlightedValue`; selection untouched                                      | upstream      |
| `Ctrl`/`Cmd`+`A`             | `multiple` only: select every enabled item; no-op otherwise                                            | **APG (add)** |
| `Shift`+ any navigation key  | `multiple` only: extend/shrink the range from the anchor to the new focus                              | **APG (add)** |
| Printable characters         | Typeahead: buffer with a 1000 ms reset, next enabled item whose `textValue` starts with it, cycling     | **APG (add)** |

All navigation skips `disabled` items and is a no-op when the root is `disabled` or no enabled item exists.

## Project Structure

### Documentation (this feature)

```text
specs/041-port-listbox/
├── plan.md              # This file
├── research.md          # Phase 0 output — 12 decisions + 8 recorded divergences
├── data-model.md        # Phase 1 output — entities, state classes, contexts, transitions
├── quickstart.md        # Phase 1 output — how to run and validate the port
├── contracts/
│   └── listbox-api.md   # Phase 1 output — the exported surface, verbatim signatures
├── checklists/
│   └── requirements.md  # produced by /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/listbox/
├── index.ts                          # barrel: Root/Group/GroupLabel/Item/ItemIndicator + Listbox* aliases + types
├── listbox.svelte                    # Root            ← ListboxRoot        (listbox.tsx:402-872)
├── listbox-group.svelte              # Group           ← ListboxGroup       (listbox.tsx:894-920)
├── listbox-group-label.svelte        # GroupLabel      ← ListboxGroupLabel  (listbox.tsx:926-943)
├── listbox-item.svelte               # Item            ← ListboxItem        (listbox.tsx:966-1079)
├── listbox-item-indicator.svelte     # ItemIndicator   ← ListboxItemIndicator (listbox.tsx:1087-1106)
├── listbox.svelte.ts                 # ListboxCollection ← useCollection (177-231) + findEnabledItem (233-271)
│                                     #   + getMin/MaxItemValue (273-292) + calculateGridLayout (294-338)
│                                     #   + ListboxRootState ← createSelectableStore (54-138) & onKeyDown (551-765)
│                                     #   + ListboxGroupState / ListboxItemState + 3 Symbol context keys
├── listbox.test.svelte               # harness (NOT in registry.json, not collected by Vitest)
└── listbox.test.ts                   # colocated tests ← packages/listbox/test/listbox.test.tsx (776 lines)

src/routes/docs/components/listbox/
└── +page.svelte                      # 4 <ComponentPreview> sections + API reference tables

registry.json                         # append exactly one registry:ui entry named "listbox"
```

**Structure Decision**: five part files, one per upstream exported component, named
`listbox[-part].svelte`; all non-markup reactivity in `listbox.svelte.ts`. Folder slug `listbox` == demo
route segment `src/routes/docs/components/listbox` == `registry.json` item `name` == upstream package name
`@diceui/listbox`. Upstream's `compose-event-handlers.ts`, `compose-refs.ts`, `forward-ref.ts`,
`get-element-ref.ts` and `slot.tsx` have no Svelte counterpart (handled by handler composition,
`bind:this`, `$bindable ref`, and the `child` snippet respectively) and produce no files;
`visually-hidden-input.tsx` becomes the clipped `<input>` markup inside `listbox.svelte`, matching
`combobox.svelte` and `tags-input.svelte`.

Registry entry:

```jsonc
{
	"name": "listbox",
	"type": "registry:ui",
	"title": "Listbox",
	"description": "A component for creating keyboard-navigable selection lists and grids.",
	"registryDependencies": ["direction-provider", "checkbox-group"],
	"dependencies": ["@lucide/svelte"],
	"files": [
		/* the 7 non-test files above, each "type": "registry:ui" */
	]
}
```

`registryDependencies` mirror `combobox`'s (`direction-provider` for `useDirection`, `checkbox-group` for
`FormControlState`); `dependencies` lists only `@lucide/svelte` for the default `Check` indicator — no
`bits-ui`, because no `bits-ui` primitive is imported.

### Shared modules this port exports for later components (deliverable 5)

Exported from `listbox.svelte.ts` through `index.ts`, deliberately generic so later ports (e.g. a
`selection-list`-shaped component) can reuse them without pulling in the popover machinery of `combobox`:

- `ListboxCollection` — DOM-ordered registry with group membership (`register`, `getItems`,
  `getGroupValues`).
- `calculateGridLayout(items, orientation)` — CSS-grid geometry from measured item rects.
- `findEnabledItem(items, { startingIndex, decrement, loop })`, `getMinItemValue`, `getMaxItemValue` —
  upstream's navigation helpers, pure and independently testable.
- `ListboxTypeahead` — the buffered character matcher (1000 ms reset), the only wholly new state class.
- The three state classes and their `set*Context` / `get*Context` / `has*Context` helpers, plus every prop
  and value type.

**No new cross-component shared file is created**: a registry item must be copy-installable, so
`FormControlState` is imported from `checkbox-group` (already a published registry item) rather than moved,
exactly as `combobox` and `tags-input` do.

## Implementation phases

1. **State module** (`listbox.svelte.ts`) — types, `compareNodePosition`, `ListboxCollection`, navigation
   helpers, `calculateGridLayout`, `ListboxTypeahead`, `ListboxRootState`, `ListboxGroupState`,
   `ListboxItemState`, three `Symbol` context keys with throwing getters.
2. **Parts** — `listbox.svelte` (root: value normalisation, `useDirection`, `FormControlState`, hidden
   input(s), composed `keydown`/`focusin`/`focusout`), then `listbox-group.svelte`,
   `listbox-group-label.svelte`, `listbox-item.svelte`, `listbox-item-indicator.svelte`.
3. **Barrel** — `index.ts` with short names, `Listbox*` aliases, every prop type and every state export.
4. **Tests** — `listbox.test.svelte` harness + `listbox.test.ts` covering the six mandatory areas
   (§7 CLAUDE.md), starting from every assertion in the 776-line upstream test file.
5. **Demo route** — `src/routes/docs/components/listbox/+page.svelte`: Default, Horizontal Orientation,
   Grid Layout, Grouped Items + API reference tables via `$lib/components/ui/table`.
6. **Registry** — append the entry, run `pnpm run registry:build`.
7. **Gates** — `pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build`, all green with no
   suppressions.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | —         | —          | —                                      |

## Post-Design Constitution Re-Check

Re-evaluated after `research.md`, `data-model.md`, `contracts/listbox-api.md` and `quickstart.md` were
written: **all ten principles still PASS.** The design added no npm dependency, no suppression, no docs→
component import and no second feature directory; the four bespoke items are the ones already justified
under Principle IV, and every divergence from upstream is recorded in research.md §Divergences and
mirrored in the spec's Assumptions section.
