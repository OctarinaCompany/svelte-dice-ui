---
description: 'Task list for the Combobox port'
---

# Tasks: Port Combobox Component

**Input**: Design documents from `/specs/026-port-combobox/` (plan.md, spec.md, research.md, data-model.md, contracts/combobox-public-api.md, quickstart.md)

**Tests**: MANDATORY (Constitution Principle III). Every behavioural area listed in CLAUDE.md §7 and
the plan's Test Plan gets its own task, written before the corresponding implementation exists.

**Organization**: This feature's task order follows the fixed phase sequence requested for the port —
Setup → Tests → Core component files → Barrel and types → Demo route → Registry entry and docs polish
→ Verification — rather than per-user-story phases, because `data-table` (wave 3) depends on the
complete, single-shot component surface and its two shared logic modules, not on an incrementally
shippable subset.

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency on an earlier task)
- Tasks touching the same file are never marked `[P]`
- Every description includes the exact repository-relative file path(s)

## Path Conventions

- Component source: `src/lib/components/ui/combobox/`
- Colocated tests: `src/lib/components/ui/combobox/combobox.test.ts` + `combobox.test.svelte` harness
- Demo route: `src/routes/docs/components/combobox/+page.svelte`
- Registry: `registry.json` at the repository root

---

## Phase 1: Setup

**Purpose**: Confirm the two registry dependencies this port composes are in place, and reserve the
registry entry so later phases only need to extend it.

- [X] T001 Verify the two registry dependencies this port composes exist and read their exported APIs
      before writing any part: `src/lib/components/ui/direction-provider/index.ts` (`DirectionReader`,
      `Direction`) and `src/lib/components/ui/checkbox-group/checkbox-group.svelte.ts`
      (`FormControlState`). Read-only — no files change. Blocks every later phase.
- [X] T002 [P] Add a stub entry for `"combobox"` to `registry.json` at the repository root: `name`,
      `type: "registry:ui"`, `title`, `description`, `registryDependencies: ["direction-provider",
      "checkbox-group"]`, `dependencies: ["bits-ui", "@lucide/svelte"]`, `files: []` (populated in
      Phase 6, T035).

**Checkpoint**: Dependencies confirmed, registry entry reserved.

---

## Phase 2: Tests (MANDATORY — write first, confirm they fail before Phase 3 exists)

**Purpose**: Encode every behavioural area from the plan's Test Plan (roles/ARIA, keyboard, controlled,
uncontrolled, RTL, edge cases/guard rails, filtering, form) as failing tests against the not-yet-built
component, per Constitution Principle III and the template's "write tests first" rule.

- [X] T003 [P] Create the test harness component `src/lib/components/ui/combobox/combobox.test.svelte`
      exposing: a `bind:value`/`bind:open`/`bind:inputValue` controllable instance, a `<form>` ancestor
      wrapping an instance with `name`, snippet `children` passthrough for every part, and a mode that
      renders a single bare part (no `<Combobox.Root>` ancestor) for the out-of-provider error tests —
      mirrors the harness pattern already used for `tags-input`/`editable`.
- [X] T004 Write the accessibility roles-and-names test area in
      `src/lib/components/ui/combobox/combobox.test.ts` (imports the harness from T003): `role=combobox`
      on the input, `role=listbox` on content and the badge list, `role=option` on items and badges,
      `role=group` + `aria-labelledby` on groups, `role=status` + `aria-live=polite` on the empty state,
      `role=progressbar` on loading, `role=separator` on the separator; `aria-expanded`,
      `aria-controls`, `aria-autocomplete=list`, `aria-activedescendant`, `aria-selected`,
      `aria-disabled`, `aria-readonly`, `aria-haspopup=listbox`, `aria-posinset`/`aria-setsize` on
      **badge** items only (upstream sets neither on `Combobox.Item`),
      `aria-multiselectable`/`aria-orientation` on the badge list; `<Combobox.Label for>` ↔ the
      input's `id`; every `aria-selected="true"` item is also accompanied by `data-state="checked"`
      and a rendered `<Combobox.ItemIndicator>` (FR-034 — selection is never colour-only).
- [X] T005 Append the keyboard-interaction test area to `src/lib/components/ui/combobox/combobox.test.ts`
      (same file as T004 — sequential, not `[P]`): typed-character opens + filters; `ArrowDown`/`ArrowUp`
      open+highlight-selected-or-first/last when closed, move next/prev when open, wrap only when
      `loop`; `Home`/`End` jump to first/last while open; `PageUp`/`PageDown` behave like
      `ArrowUp`/`ArrowDown` **with** `modal` and are inert **without** `modal`; `Enter` selects the
      highlighted item, or reverts text and closes when nothing is highlighted/the list is empty;
      `Escape` reverts text to the selected label (or clears) and closes; `Tab` closes and lets focus
      leave **without** `modal`, is trapped (`preventDefault`) **with** `modal` while open; badge
      `ArrowLeft` (caret at position 0) highlights the last/previous badge, badge `ArrowRight` moves
      toward later badges and exits to the input past the last one, badge `Enter` removes the
      highlighted badge, `Backspace`/`Delete` with an **empty** input removes the highlighted-or-last
      badge, `Backspace`/`Delete` with **typed text** removes no badge; highlight movement
      (`ArrowDown`/`ArrowUp`/`Home`/`End`) skips options marked `disabled`, and `Enter` on a list whose
      only remaining match is disabled changes no value.
- [X] T006 Append the uncontrolled-state test area to `src/lib/components/ui/combobox/combobox.test.ts`
      (same file — sequential): `defaultValue` seeds both the value and the input's displayed text
      (single mode); `defaultOpen` seeds the popover's open state; selecting an option or typing updates
      internal value/open/inputValue state with no bound props supplied.
- [X] T007 Append the controlled-state test area to `src/lib/components/ui/combobox/combobox.test.ts`
      (same file — sequential): `value` + `onValueChange` fires with the next value and the component
      does not move on its own until the prop is updated; `open` + `onOpenChange`; `inputValue` +
      `onInputValueChange`; an authoritative parent that ignores the callback keeps the rendered state
      static (uses the harness's `bind:value`-optional mode from T003).
- [X] T008 Append the RTL test area to `src/lib/components/ui/combobox/combobox.test.ts` (same file —
      sequential): `dir="rtl"` passed explicitly is present on the anchor, input, trigger and popover
      content; an ambient `<DirectionProvider dir="rtl">` with no explicit `dir` prop produces the same
      result; badge `ArrowLeft`/`ArrowRight` navigation **inverts** under `dir="rtl"` — `ArrowRight`
      highlights the last badge from the caret edge and moves toward earlier badges, `ArrowLeft` moves
      toward later badges and exits to the input (Constitution Principle III; recorded divergence from
      upstream in spec Assumptions).
- [X] T009 Append the guard-rails / structural edge-case test area to
      `src/lib/components/ui/combobox/combobox.test.ts` (same file — sequential): `disabled` suppresses
      typing, opening, trigger clicks, filtering and value changes across input/trigger/badges/cancel;
      `readOnly` suppresses value changes from typing while the popover can still be opened/navigated;
      an `Item` with an empty-string `value` throws `` `<Combobox.Item>` value cannot be an empty
      string. ``; every part that consumes a context — all 19 non-root parts for the root context,
      plus `GroupLabel` outside `Group`, `BadgeItem` outside `BadgeList`, `BadgeItemDelete` outside
      `BadgeItem`, and `ItemText`/`ItemIndicator` outside `Item` — rendered with no provider throws its
      documented `` must be used within `` error (via the harness's bare-part mode);
      removing every badge down to an empty value array leaves the popover's open state unchanged;
      a `disabled` `Item` exposes `aria-disabled`, is not selected by click, and never becomes
      highlighted; an `Item`'s `onSelect` fires with its value exactly once per successful selection and
      never for a disabled item; with `openOnFocus`, focusing the input opens the popover, and it does
      not open when the root is `readOnly` or `disabled`; on blur, single-selection mode restores the
      selected option's label (or clears the text when there is no selection), while
      `preserveInputOnBlur` leaves the typed text untouched; blur also clears any badge highlight.
- [X] T010 Append the filtering-and-form edge-case test area to
      `src/lib/components/ui/combobox/combobox.test.ts` (same file — sequential): default fuzzy match
      narrows the list, `exactMatch` narrows more strictly, a supplied `onFilter` fully replaces the
      built-in matcher, `manualFiltering` (and `manualFiltering`+`onFilter` together) bypasses all
      built-in filtering so the consumer's list renders as-is; a `Group`/`Separator` auto-hides when
      none of its items remain visible and reappears when the search clears; `Empty` renders only when
      the popover is open and the visible count is zero with non-empty search, and stays mounted
      regardless when `keepVisible`; `autoHighlight` highlights the first item on open and again after
      each re-filter; `loop` wraps at both boundaries when `true` and stops at the boundary when
      `false`; inside a `<form>`, `name` submits the joined value through a visually hidden input that
      honours `disabled`/`readOnly`/`required`; `Cancel` renders only when the input text is non-empty
      unless `forceMount`, and clicking it clears the input text and the filter search and refocuses
      the input; `Loading` unmounts when the popover is closed or the progress state is complete, an
      out-of-range/non-numeric `value` degrades it to indeterminate, and a `max <= 0`/`NaN` degrades it
      to `100`.

**Checkpoint**: `pnpm run test:unit -- --run -- combobox` fails (module not found) — expected until
Phase 3 exists.

---

## Phase 3: Core component files

**Purpose**: The 2 logic modules plus one file per exported subcomponent from the plan's Public API
section (20 parts total).

- [X] T011 [P] Implement the pure filter/matching module
      `src/lib/components/ui/combobox/combobox-filter.ts`: `normalizeWithGaps(value)` with an LRU
      normalisation cache, `createFilter({ exactMatch, gapMatch })` returning `{ contains, fuzzy,
      startsWith, endsWith }`, `scoreItem(value, search, { onFilter, exactMatch })` (2 exact, 1.5
      prefix, 1/0 matcher), and `ComboboxFilterStore` (search term, visible-value map, group
      visibility, batched scoring at 250 items per pass) — ported from
      `.reference/diceui/packages/combobox/src/use-filter.ts` and `use-filter-store.ts`. No dependency
      on any other new file; exported for `data-table`/`faceted` per plan §Shared modules.
- [X] T012 Implement the state classes and contexts `src/lib/components/ui/combobox/combobox.svelte.ts`:
      `ComboboxCollection` (DOM-ordered item registry with group membership, ported from
      `use-collection.ts`), `ComboboxRootState` and `ComboboxItemState` (value/open/inputValue/highlight
      state machine, badge highlighting, `onHighlightMove('first'|'last'|'next'|'prev'|'selected')`
      ported from `use-list-highlighting.ts`), the `ComboboxValue<Multiple>` and
      `ComboboxHighlightDirection` types, and one `Symbol` context key + throwing `set…Context`/
      `get…Context` pair per part per CLAUDE.md §5 — consumes `ComboboxFilterStore` from T011 (depends
      on T011).
- [X] T013 [P] Implement Root `src/lib/components/ui/combobox/combobox.svelte`: generic
      `<script lang="ts" generics="Multiple extends boolean = false">`, all 22 root props (plus
      `children`) from the
      plan's Public API table, instantiates `ComboboxRootState` and calls every `set…Context`, renders
      the clipped `type="text"` form input when `name` is set inside a `<form>`, `data-slot="combobox"`
      + `data-state` + `data-disabled` (depends on T012).
- [X] T014 [P] Implement Label `src/lib/components/ui/combobox/combobox-label.svelte`: `id={labelId}`,
      `for={inputId}`, `data-slot="combobox-label"`, throws when used outside `<Combobox.Root>` (depends
      on T012).
- [X] T015 [P] Implement Anchor `src/lib/components/ui/combobox/combobox-anchor.svelte`:
      `preventInputFocus` prop, registers itself as the popover's `customAnchor`, click focuses the
      input unless `preventInputFocus`, tracks focus/blur, prevents implicit pointer capture and
      focus-stealing on primary `pointerdown` except on the input, `data-slot="combobox-anchor"` +
      `data-state`/`data-anchor`/`data-disabled`/`data-focused` + `dir` (depends on T012).
- [X] T016 [P] Implement Trigger `src/lib/components/ui/combobox/combobox-trigger.svelte`: `disabled`
      prop (default root `disabled`), default `<ChevronDown class="size-4" />` children,
      `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls={listId}`, `tabindex={-1}` when
      enabled, click toggles open + refocuses input with caret at end + highlights selected-or-first,
      `data-slot="combobox-trigger"` + `data-state`/`data-disabled` (depends on T012).
- [X] T017 [P] Implement Input `src/lib/components/ui/combobox/combobox-input.svelte`: the full
      `role="combobox"` ARIA wiring and the complete keyboard table from the plan's Public API section
      (type-to-filter, `ArrowDown`/`ArrowUp`/`ArrowLeft`/`ArrowRight`/`Home`/`End`/`PageUp`/`PageDown`/
      `Enter`/`Escape`/`Backspace`/`Delete`/`Tab`), including RTL-inverted badge `ArrowLeft`/`ArrowRight`
      semantics per FR-038 (Constitution Principle III; recorded divergence from upstream in spec
      Assumptions), focus opens on `openOnFocus`, blur restores `selectedText` or clears unless
      `preserveInputOnBlur` (depends on T012).
- [X] T018 [P] Implement Cancel `src/lib/components/ui/combobox/combobox-cancel.svelte`: `forceMount`
      + `disabled` props, default `<X class="size-4" />` children, renders nothing when `inputValue` is
      empty and not `forceMount`, click clears input text + filter search + refocuses input,
      `aria-controls={inputId}`, `data-slot="combobox-cancel"` + `data-disabled` (depends on T012).
- [X] T019 [P] Implement BadgeList `src/lib/components/ui/combobox/combobox-badge-list.svelte`:
      `forceMount` + `orientation` props, renders nothing unless `forceMount` or (`multiple` and at
      least one value), `role="listbox"`, `aria-multiselectable`, `aria-orientation`,
      `data-slot="combobox-badge-list"` + `data-orientation`, mounting enables badge keyboard
      navigation on the input (depends on T012).
- [X] T020 [P] Implement BadgeItem `src/lib/components/ui/combobox/combobox-badge-item.svelte`:
      required `value` + `disabled` props, `role="option"`, `id`, `aria-selected` (= highlighted),
      `aria-disabled`, `aria-orientation`, `aria-posinset`, `aria-setsize`, focus highlights/blur
      clears, `data-slot="combobox-badge-item"` + `data-disabled`/`data-highlighted`/`data-orientation`
      (depends on T012).
- [X] T021 [P] Implement BadgeItemDelete
      `src/lib/components/ui/combobox/combobox-badge-item-delete.svelte`: default `<X class="size-3" />`
      children, `aria-controls={badgeId}`, `aria-disabled`, `tabindex={-1}` when enabled, click removes
      the badge's value + refocuses input, `pointerdown` prevented so the badge never steals focus,
      `data-slot="combobox-badge-item-delete"` + `data-disabled`/`data-highlighted` (depends on T012).
- [X] T022 [P] Implement Portal `src/lib/components/ui/combobox/combobox-portal.svelte`: wraps `bits-ui`
      `Popover.Portal`, `to` (default `document.body`) + `disabled` (default `false`) props (depends on
      T012).
- [X] T023 [P] Implement Content `src/lib/components/ui/combobox/combobox-content.svelte`: wraps `bits-ui`
      `Popover.Content` with all 16 positioning props from the plan's Public API table,
      `role="listbox"`, aliases `--dice-transform-origin`/`--dice-anchor-width`/`--dice-anchor-height`/
      `--dice-available-width`/`--dice-available-height` onto the `bits-ui` CSS variables, anchors to
      `<Combobox.Anchor>` when present else the input, `trapFocus={false}` +
      `onOpenAutoFocus`/`onCloseAutoFocus` prevented, `preventScroll={modal}`, `data-slot=
      "combobox-content"` + `data-state`/`data-side`/`data-align` (depends on T012).
- [X] T024 [P] Implement Arrow `src/lib/components/ui/combobox/combobox-arrow.svelte`: composes `bits-ui`
      `Popover.Arrow`, `width` (`10`) + `height` (`5`) props, default
      `<path d="M0 10 L15 0 L30 10" fill="currentColor" />` children, `data-slot="combobox-arrow"` +
      `data-side`/`data-align`/`data-state` (depends on T012).
- [X] T025 [P] Implement Loading `src/lib/components/ui/combobox/combobox-loading.svelte`: `value`
      (default `null`) + `max` (default `100`) + `label` props, renders nothing when the popover is
      closed or progress state is `complete`, `role="progressbar"`, `aria-label`, `aria-valuemin={0}`,
      `aria-valuemax={max}`, `aria-valuenow` only when numeric, out-of-range/non-numeric `value`
      degrades to indeterminate, `max <= 0`/`NaN` degrades to `100`, `data-slot="combobox-loading"` +
      `data-state`/`data-value`/`data-max` (depends on T012).
- [X] T026 [P] Implement Empty `src/lib/components/ui/combobox/combobox-empty.svelte`: `keepVisible`
      prop, renders when the popover is open and (`keepVisible || (visibleCount === 0 &&
      search.trim() !== '')`), `role="status"`, `aria-live="polite"`, `aria-atomic="true"`,
      `data-slot="combobox-empty"` + `data-state="empty"` (depends on T012).
- [X] T027 [P] Implement Group `src/lib/components/ui/combobox/combobox-group.svelte`: `forceMount`
      prop, hides when a search is active and no registered item of this group is visible, `id`,
      `role="group"`, `aria-labelledby={groupLabelId}`, `data-slot="combobox-group"` (depends on T012).
- [X] T028 [P] Implement GroupLabel `src/lib/components/ui/combobox/combobox-group-label.svelte`:
      `id={groupLabelId}`, `data-slot="combobox-group-label"`, throws when used outside
      `<Combobox.Group>` (depends on T012).
- [X] T029 [P] Implement Item `src/lib/components/ui/combobox/combobox-item.svelte`: required non-empty
      `value` (throws otherwise) + `label` (default rendered text) + `disabled` + `onSelect` props,
      renders nothing when filtered out, `role="option"`, `id`, `aria-selected`, `aria-disabled`,
      `aria-labelledby={textId}`, `tabindex={-1}` when enabled, pointer move highlights, click selects
      (single: set value + replace input text + close + refocus; multiple: toggle value + clear input +
      stay open) resetting the filter search either way, `data-dice-collection-item=""`,
      `data-slot="combobox-item"` + `data-state="checked"|"unchecked"`/`data-highlighted`/`data-disabled`
      (depends on T012).
- [X] T030 [P] Implement ItemText `src/lib/components/ui/combobox/combobox-item-text.svelte`:
      `id={textId}`, `data-slot="combobox-item-text"`, reports its `textContent` to the owning item as
      the label when the item has no explicit `label` (depends on T012).
- [X] T031 [P] Implement ItemIndicator
      `src/lib/components/ui/combobox/combobox-item-indicator.svelte`: `forceMount` prop, default
      `<Check class="size-4" />` children, renders only when the item is selected unless `forceMount`,
      `aria-hidden="true"`, `data-slot="combobox-item-indicator"` (depends on T012).
- [X] T032 [P] Implement Separator `src/lib/components/ui/combobox/combobox-separator.svelte`:
      `keepVisible` prop, hidden while a search is active unless `keepVisible`, `role="separator"`,
      `aria-hidden="true"`, `data-slot="combobox-separator"` (depends on T012).

**Checkpoint**: All 20 parts + 2 logic modules type-check in isolation; contexts throw the documented
errors (T009 assertions can now pass against direct imports even before the barrel exists).

---

## Phase 4: Barrel and types

- [X] T033 Implement the barrel `src/lib/components/ui/combobox/index.ts`: export every part twice
      (short name for `import * as Combobox` + `Combobox<Part>` alias for named imports) plus its
      `Props` type, and re-export the shared modules for `data-table`/`faceted`: `createFilter`,
      `normalizeWithGaps`, `scoreItem`, `ComboboxFilterStore` (from `combobox-filter.js`),
      `ComboboxCollection`, `ComboboxRootState`, `ComboboxItemState`, every `get…Context` helper,
      `ComboboxValue`, `ComboboxHighlightDirection` (from `combobox.svelte.js`) — depends on T011–T032
      (all 22 core files must exist to be re-exported).

**Checkpoint**: `pnpm run test:unit -- --run -- combobox` now runs against real modules — drive T004–
T010 to green before continuing.

---

## Phase 5: Demo route

- [X] T034 Create `src/routes/docs/components/combobox/+page.svelte` with one `<ComponentPreview>`
      section per upstream demo — Default (`combobox-demo.tsx`: single select, fuzzy filter, empty
      state, item indicator), With Groups (`combobox-groups-demo.tsx`: groups + labels + separators +
      controlled `value`), With Multiple Selection (`combobox-multiple-demo.tsx`: `multiple` +
      `autoHighlight` + badge list), With Custom Filter (`combobox-custom-filter-demo.tsx`: `onFilter`
      using the exported `createFilter`), With Debounce (`combobox-debounced-demo.tsx`:
      `manualFiltering` + `inputValue`/`onInputValueChange` + `Loading` + `Empty keepVisible`), With
      Virtualization (`combobox-virtualized-demo.tsx`: 10 000 items, `manualFiltering`, a windowed slice
      computed in the page), With Tags Input (`combobox-tags-demo.tsx`: `Combobox.Anchor` composed with
      the ported `tags-input`) — plus a props table for the Root and every part with extra props,
      runes-only page state, no `+page.ts` — depends on T033.

---

## Phase 6: Registry entry and docs polish

- [X] T035 Replace the stub `files: []` from T002 in the `"combobox"` entry of `registry.json` at the
      repository root with all 23 non-test files (`index.ts`, the 20 `combobox-*.svelte` parts,
      `combobox.svelte.ts`, `combobox-filter.ts`), each `{ "type": "registry:ui" }` — depends on T033,
      T034 (every listed file must exist).
- [X] T036 Run `pnpm run registry:build` and confirm `static/r/combobox.json` is generated with every
      file inlined and every `$lib/...` import rewritten to a registry placeholder — depends on T035.

---

## Phase 7: Verification (MANDATORY — Constitution Principle VII)

- [X] T037 Run `pnpm run format`, then `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run`
      and `pnpm run build`, in that order, and fix everything that fails without suppressing anything.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Tests (Phase 2)**: Depends on Setup (T001) only for the dependency confirmation; T003 (harness) has
  no other dependency. T004–T010 are appended to the same file sequentially and are expected to fail
  (module not found) until Phase 3/4 exist — that failure is the required "tests fail first" signal.
- **Core component files (Phase 3)**: T011 has no dependency. T012 depends on T011. T013–T032 each
  depend on T012 only, not on each other — all 20 are `[P]`.
- **Barrel and types (Phase 4)**: T033 depends on every file from Phase 3 (T011–T032).
- **Demo route (Phase 5)**: T034 depends on T033 (imports the barrel).
- **Registry entry and docs polish (Phase 6)**: T035 depends on T033 and T034 (lists their files); T036
  depends on T035.
- **Verification (Phase 7)**: T037 depends on everything above — always the last task.

### Within Phase 2 (Tests)

T004 → T005 → T006 → T007 → T008 → T009 → T010 are strictly sequential: every one appends to
`src/lib/components/ui/combobox/combobox.test.ts`, so none is `[P]` with any other. T003 (a different
file) is `[P]` with T002 but not with the file-append chain it feeds.

### Within Phase 3 (Core)

T011 → T012 is a strict chain (state module consumes the filter module's exports). T013–T032 are all
`[P]` with each other once T012 is done — 20 independent files, no cross-part imports (compound
components share state only through the `Symbol` contexts set up in T012).

### Parallel opportunities

- Phase 1: T002 `[P]` (T001 is a read-only prerequisite, not a file conflict, but keep it first since
  it informs T012/T013/T015's use of `direction-provider`/`checkbox-group`).
- Phase 3: T011 `[P]` start; once T012 lands, all of T013–T032 (20 tasks) run in parallel.
- Phases 4–7 are single-task, strictly sequential gates.

---

## Parallel Example: Phase 3 core files

```bash
# After T011 (filter module) and T012 (state + contexts) are both done, launch all 20 parts together:
Task: "Implement Root in src/lib/components/ui/combobox/combobox.svelte"
Task: "Implement Label in src/lib/components/ui/combobox/combobox-label.svelte"
Task: "Implement Anchor in src/lib/components/ui/combobox/combobox-anchor.svelte"
Task: "Implement Trigger in src/lib/components/ui/combobox/combobox-trigger.svelte"
Task: "Implement Input in src/lib/components/ui/combobox/combobox-input.svelte"
# ...through Separator (T032)
```

---

## Implementation Strategy

### Straight-through (this component has no independently shippable slice)

Unlike a per-user-story feature, `data-table` needs the complete public surface (all 20 parts) and both
shared logic modules (`combobox-filter.ts`, `combobox.svelte.ts`) in one shot — there is no partial
"MVP" cut that is useful to a downstream consumer. Execute the phases in order:

1. Phase 1 (Setup) → Phase 2 (Tests, written to fail) → Phase 3 (Core, all 22 files) → Phase 4 (Barrel)
   → drive the Phase 2 tests to green.
2. Phase 5 (Demo route) → Phase 6 (Registry entry, `registry:build`).
3. Phase 7 (Verification) — all four gates green, nothing suppressed.

### Parallel team strategy

- One contributor: T011 → T012, then fan out T013–T032 across as many parallel workers as available.
- Test-area tasks (T004–T010) can be drafted by a second contributor concurrently with Phase 3, since
  they target the same file sequentially but do not require Phase 3 to compile until the tests are run.

---

## Notes

- `[P]` tasks = different files, no dependency on an unfinished task.
- Every part task cites its exact prop table / behaviour from `plan.md` §Public API — no additional
  design decisions are needed at implementation time.
- Do NOT run git write commands — the orchestrator owns the working tree (Constitution Principle X).
- Do not touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json` or `.port-logs/`.
- No suppressions to reach green in T037: no `@ts-ignore`, `@ts-expect-error`, `eslint-disable`,
  `svelte-ignore`, `.skip`/`.todo`, `as any`, deleted assertions, or loosened configs.

---

## Phase 8: Convergence

**Purpose**: Close the gaps found by auditing the implemented port against `spec.md`, `plan.md` and the
Phase 1–7 tasks. Every part, prop, keyboard binding, demo section and the `registry.json` entry are in
place and all five quality gates are green; what remains is behaviour that the spec requires but no
assertion in `src/lib/components/ui/combobox/combobox.test.ts` covers. Every task below appends to that
file (and, where noted, wires one more prop through
`src/lib/components/ui/combobox/combobox.test.svelte`) — no application code changes.

- [X] T038 Assert the `forceMount` escape hatch on the four parts that have none per FR-023a (partial):
      in `src/lib/components/ui/combobox/combobox.test.ts`, cover `<Combobox.Content forceMount>`
      (stays mounted while the popover is closed), `<Combobox.Group forceMount>` (stays visible when a
      search hides every item in it), `<Combobox.BadgeList forceMount>` (renders with an empty value
      array) and `<Combobox.ItemIndicator forceMount>` (renders on an unselected item). The harness
      already declares `badgeListForceMount` and `itemIndicatorForceMount` but no test passes them; add
      `contentForceMount` and `groupForceMount` props to
      `src/lib/components/ui/combobox/combobox.test.svelte` alongside them.
- [X] T039 Assert the modal scroll lock wiring per FR-029a (missing): in
      `src/lib/components/ui/combobox/combobox.test.ts`, prove that opening a `modal` combobox engages
      the scroll lock `<Combobox.Content>` requests through `preventScroll={root.modal}`
      (`src/lib/components/ui/combobox/combobox-content.svelte`) — attribute/prop wiring only, since
      jsdom does not execute real scroll locking — and that a non-modal combobox does not. The existing
      `afterEach` already resets the body styles `bits-ui` sets, so assert before that teardown runs.
- [X] T040 Assert that clicking a badge's delete control returns focus to the input per FR-011 and
      US2/AC3 (missing): extend the badge-removal coverage in
      `src/lib/components/ui/combobox/combobox.test.ts` with
      `expect(document.activeElement).toBe(textInput())` after clicking `badge-delete-*`, which is what
      `root.focusInput()` in `src/lib/components/ui/combobox/combobox-badge-item-delete.svelte`
      guarantees.
- [X] T041 Assert that input focus is retained when an option is selected by click per FR-005 and
      US1/AC2 (missing): in `src/lib/components/ui/combobox/combobox.test.ts`, assert
      `document.activeElement` is the input after clicking an item in single-selection mode (where the
      popover also closes) and in multiple-selection mode (where it stays open) — the item deliberately
      focuses itself first in `src/lib/components/ui/combobox/combobox-item.svelte` before
      `selectItem()` hands focus back.
- [X] T042 Assert that every highlight move skips disabled options per FR-031a (partial): the current
      coverage proves only `ArrowDown`, and the `DISABLED_MIDDLE` fixture in
      `src/lib/components/ui/combobox/combobox.test.ts` puts the disabled option in the middle where
      `Home`/`End` can never reveal skipping. Add a fixture whose **first and last** options are
      disabled and assert `Home`, `End`, `PageUp`/`PageDown` (modal) and `autoHighlight`-on-open all
      land on an enabled option.
- [X] T043 Assert the two untested halves of the trigger contract per FR-032 (partial): in
      `src/lib/components/ui/combobox/combobox.test.ts`, assert that a trigger click leaves the caret
      at the end of the input (`selectionStart`/`selectionEnd` === `value.length`) and that it
      highlights the selected option when a value is set, or the first option when `autoHighlight` is
      on — the `toggleFromTrigger` branches in `src/lib/components/ui/combobox/combobox.svelte.ts`
      that the existing `openFromTrigger` helper does not reach.
- [X] T044 Assert the vertical badge-list orientation per FR-015 (partial): only `horizontal` is
      covered today. Pass the harness's existing `badgeListOrientation: 'vertical'` prop in
      `src/lib/components/ui/combobox/combobox.test.ts` and assert `aria-orientation` and
      `data-orientation` on both `<Combobox.BadgeList>` and each `<Combobox.BadgeItem>`.
- [X] T045 Assert the anchor's focus behaviour per the spec's "clicking the anchor/wrapper area focuses
      the input" edge case (missing): in `src/lib/components/ui/combobox/combobox.test.ts`, assert that
      clicking the anchor (not the input) moves focus to the input, that `preventInputFocus` suppresses
      that, and that `data-focused` is **present** while the anchor holds focus — only its absence is
      asserted today. Add a `preventInputFocus` prop to
      `src/lib/components/ui/combobox/combobox.test.svelte`.
- [X] T046 Assert the portal's caller-chosen container per FR-001 (partial): the harness always renders
      `<Combobox.Portal>` with default props, so `to` and `disabled`
      (`src/lib/components/ui/combobox/combobox-portal.svelte`) are never exercised. Add harness props
      for both in `src/lib/components/ui/combobox/combobox.test.svelte` and assert in
      `src/lib/components/ui/combobox/combobox.test.ts` that `to` renders the content inside a
      caller-supplied container and that `disabled` leaves it in place in the DOM hierarchy.
- [X] T047 Re-run the full gate after T038–T046: `pnpm run format`, then `pnpm run check`,
      `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, in that order, fixing every
      failure at its root — no `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`,
      `.skip`/`.todo`, `as any`, deleted assertions or loosened configs. Depends on T038–T046.
