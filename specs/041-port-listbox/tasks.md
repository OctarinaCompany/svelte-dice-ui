# Tasks: Port Listbox Component

**Input**: Design documents from `/specs/041-port-listbox/` (plan.md, spec.md, research.md, data-model.md,
contracts/listbox-api.md, quickstart.md)

**Tests**: MANDATORY (constitution Principle III / VII, CLAUDE.md §7). Every `it` must assert
(`expect.requireAssertions`); no `.skip`/`.todo`.

**Organization**: Phases run in the fixed order requested for this port — Setup → Tests → Core component
files → Barrel and types → Demo route → Registry entry and docs polish → Verification. This component has
no independently-shippable user-story slices (all five parts and both selection modes are required for any
usable demo), so tasks are grouped by artifact phase instead of by `[US#]`; each test task's description
names the user stories (spec.md) and functional requirements it covers for traceability.

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- Tasks touching the same file are never `[P]`, even if listed adjacently
- Every description names the exact file path

## Path Conventions

- Component source: `src/lib/components/ui/listbox/`
- Colocated tests: `src/lib/components/ui/listbox/listbox.test.ts`, `listbox.test.svelte`
- Demo route: `src/routes/docs/components/listbox/+page.svelte`
- Registry: `registry.json` (repository root)

---

## Phase 1: Setup (dependencies, registry stub)

**Purpose**: Confirm the two registry dependencies exist, scaffold the empty folders, and reserve the
registry slot before any component code lands.

- [X] T001 Confirm `direction-provider` (for `useDirection`) and `checkbox-group` (for `FormControlState`)
      exist and export what `listbox` needs: read `src/lib/components/ui/direction-provider/index.ts` and
      `src/lib/components/ui/checkbox-group/checkbox-group.svelte.ts`, and note their exact export names for
      use in T010/T011.
- [X] T002 [P] Create the empty component folder `src/lib/components/ui/listbox/` and the empty demo folder
      `src/routes/docs/components/listbox/` (no files yet — placeholders for Phases 3 and 5).
- [X] T003 [P] Append a stub entry named `"listbox"` to the root `registry.json` (`type: "registry:ui"`,
      `title: "Listbox"`, `description`, `registryDependencies: ["direction-provider", "checkbox-group"]`,
      `dependencies: ["@lucide/svelte"]`, `files: []`) so the slot exists; T022 fills in `files` once the
      component files exist.

**Checkpoint**: Folders exist, dependencies confirmed, registry slot reserved.

---

## Phase 2: Tests (write first — MANDATORY, Principle III/VII)

**Purpose**: Author the shared test harness and every behavioural-area test block in
`listbox.test.ts`/`listbox.test.svelte` before any implementation file exists, so they fail red first. All
tasks in this phase edit the same two files, so none are `[P]`.

- [X] T004 Create the composition harness `src/lib/components/ui/listbox/listbox.test.svelte`, covering the
      compositions a `.ts` spec cannot express directly: `bind:value` round-tripping, a `<form>` ancestor
      around `Listbox.Root` with `name`, an ambient `<DirectionProvider dir="rtl">` wrapper, a `child` snippet
      on all five parts (`Root`, `Group`, `GroupLabel`, `Item`, `ItemIndicator`), each rendering a
      distinguishable custom element, and a bare `Listbox.Item`, `Listbox.Group`, `Listbox.GroupLabel` and
      `Listbox.ItemIndicator` each rendered with no provider (for the throwing-getter tests). Mirror the shape
      of `src/lib/components/ui/combobox/combobox.test.svelte`.
- [X] T005 In `src/lib/components/ui/listbox/listbox.test.ts`, write the **keyboard interaction** test block
      (US2 FR-006–FR-008, US3 FR-010–FR-021, US4 FR-012–FR-013): `Tab`/`Shift+Tab` focus restoration,
      `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight` per orientation (`vertical`, `horizontal`, `mixed` with
      stubbed `getBoundingClientRect` per research.md R-07), `Home`/`End`, `PageUp`/`PageDown` behaving like
      `ArrowUp`/`ArrowDown`, `Enter`/`Space` selecting the focused item, `Escape` clearing focus/highlight
      without touching selection, `loop` wrapping, typeahead with `vi.useFakeTimers()` across the 1000 ms
      reset boundary, `Ctrl`/`Cmd`+`A` select-all (multiple only, no-op single), and `Shift`+arrow range
      grow/shrink from the anchor. Port every matching assertion from
      `.reference/diceui/packages/listbox/test/listbox.test.tsx` first, then add the four APG-addition cases.
- [X] T006 In `src/lib/components/ui/listbox/listbox.test.ts`, write the **accessibility roles and names**
      test block (US3 FR-017, US5 FR-023–FR-024, SC-003): `role="listbox"` on the root, `role="option"` with
      `aria-selected` per item, `aria-disabled` on disabled items and a disabled root, `aria-multiselectable`
      present only when `multiple`, `role="group"` with `aria-labelledby` pointing at the group label's `id`,
      and `toHaveFocus()` on the active option with the root's own `tabindex` verified `0`/`undefined`. Also
      assert item-indicator visibility (FR-024a, upstream `handles item indicator visibility`): the indicator
      is absent while the option is unselected, present once it is selected, present regardless of selection
      when `forceMount` is set, and always carries `aria-hidden="true"`. Also assert `data-orientation` on the
      root reflecting `vertical`/`horizontal`/`mixed` (upstream `handles horizontal orientation`). Also assert
      child-mode parity: rendering each part through its `child` snippet applies the same `data-slot`, role,
      ARIA and state `data-*` attributes to the caller-supplied element, and keyboard navigation still reaches
      a child-mode `Item`.
- [X] T006a In `src/lib/components/ui/listbox/listbox.test.ts`, write the **pointer highlighting** test block
      (FR-022, upstream `handles item highlighting on pointer move`): `user.hover()` over an enabled item sets
      `data-highlighted=""` on it; hovering a second item moves the attribute and clears it from the first;
      `user.unhover()` clears it entirely; a `disabled` item never receives `data-highlighted`; and pointer
      highlight is asserted to be independent of both `aria-selected` and DOM focus (FR-022's "distinct
      state").
- [X] T007 In `src/lib/components/ui/listbox/listbox.test.ts`, write the **controlled vs uncontrolled state**
      test block (US1 FR-003–FR-004, US2 FR-005–FR-006, FR-027): uncontrolled `defaultValue` seeds the
      component and internal clicks/keys update it across a `rerender()` (per
      `bindable-prop-resets-on-props-invalidation` — assert state survives re-render, not just first render);
      controlled `value` + `onValueChange` makes the parent authoritative and the component never moves
      selection on its own without the prop changing; single-mode re-click-to-clear; multiple-mode
      independent toggling; and, using the `listbox.test.svelte` form harness from T004, `FormData.getAll(name)`
      returning a single value and an array under `multiple`, honoring `disabled`. Also assert the per-item
      `onSelect` callback (FR-006a): it fires with the item's own value on click and on `Enter`/`Space`, fires
      before `onValueChange` (assert call order with `vi.fn()` invocation-order checks), and never fires for a
      disabled item or under a disabled root.
- [X] T008 In `src/lib/components/ui/listbox/listbox.test.ts`, write the **RTL** test block (US6 FR-028,
      SC-006): `dir="rtl"` prop inverts `ArrowLeft`/`ArrowRight` in `horizontal` orientation; the ambient
      `<DirectionProvider dir="rtl">` harness from T004 produces the same inversion with no explicit `dir`
      prop; a `mixed`-orientation grid inverts row navigation (`ArrowLeft`/`ArrowRight`) while column
      navigation (`ArrowUp`/`ArrowDown`) stays unchanged. Each RTL case also asserts the root renders the
      resolved `dir` attribute (`dir="rtl"`), both from the explicit prop and from the ambient
      `<DirectionProvider>` (upstream `handles RTL direction`).
- [X] T009 In `src/lib/components/ui/listbox/listbox.test.ts`, write the **edge cases and guard rails** test
      block (spec.md Edge Cases, FR-016, FR-025, FR-026): `Listbox.Item` with `value=""` throws
      `` `ListboxItem value cannot be an empty string` ``; each of `Listbox.Item`, `Listbox.Group` (both
      outside `Listbox.Root`), `Listbox.GroupLabel` (outside `Listbox.Group`) and `Listbox.ItemIndicator`
      (outside `Listbox.Item`) rendered outside its required ancestor (via the no-provider harness from T004)
      throws the documented `` `must be used within` `` error naming both parts; a `disabled` root blocks
      focus/selection/keyboard handling and is not a tab stop; a `disabled` item is skipped by every
      navigation key, `Home`/`End`/`PageUp`/`PageDown`, typeahead, click and `Enter`/`Space`; a listbox with
      zero enabled items does not throw on focus or any navigation key; a `virtual` root updates
      `focusedValue`/`highlightedValue`/selection state without calling `.focus()`/`.scrollIntoView()`
      (spy-assert those DOM methods are not called).

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/listbox/listbox.test.ts` fails at module
resolution (`index.ts` and the five parts do not exist yet) — expected, since Phase 3/4 create them. Confirm
instead by review that every spec.md user story, functional requirement and edge case is named by at least one
`it` title across T004-T009 before starting Phase 3; re-run after T016 to see the suite compile and fail red on
assertions.

---

## Phase 3: Core component files

**Purpose**: Implement the state module, then the five exported parts from the plan's Public API section.

- [X] T010 Create `src/lib/components/ui/listbox/listbox.svelte.ts`: the shared types
      (`ListboxValue<Multiple>`, `ListboxOrientation`, `ListboxItemData`, `ListboxMountedItem`), value
      normalisation/de-normalisation helpers (data-model.md §1), `ListboxCollection` (§3: `register`,
      `getItems`, `getEnabledItems`, `getGroupValues`, `$state.raw` backing list), `findEnabledItem`,
      `getMinItemValue`/`getMaxItemValue`, `calculateGridLayout` (ported verbatim from
      `.reference/diceui/packages/listbox/src/listbox.tsx` lines 233–338, including the 10px row tolerance),
      `ListboxTypeahead` (§5: 1000 ms buffer, case-insensitive `startsWith`, cycling from the item after
      `from`), `ListboxRootState` (§4: `focusedValue`/`highlightedValue`/`anchorValue`, `selectedSet`,
      `isSelected`/`selectItem`/`selectAll`/`selectRange`/`focusItem`/`clearFocus`/`onRootKeydown`/
      `onRootFocusIn`/`onRootFocusOut`/`getNextValue`), `ListboxGroupState` (§6), `ListboxItemState` (§7),
      and the three typed `Symbol` context keys with `set*Context`/`get*Context`/`has*ListboxGroupContext`
      throwing getters (§8, error messages exactly as specified in plan.md §Public API parts 2–5). Depends on
      T001's confirmed `useDirection`/`FormControlState` export shapes.
- [X] T011 Create `src/lib/components/ui/listbox/listbox.svelte` (Root, upstream `ListboxRoot`
      `listbox.tsx:402-872`): `<script lang="ts" generics="Multiple extends boolean = false">` per
      research.md R-03, `ListboxRootProps<Multiple>` in the module script, controlled/uncontrolled value
      resolution per research.md R-02 (`isControlled` + internal `$state`, not `value ??= defaultValue`),
      `useDirection` anchored on the parent element per research.md R-06, `FormControlState` composition and
      the clipped hidden `<input>` markup per research.md R-10 (one input in single mode, one per selected
      value in `multiple`), composed `onkeydown`/`onfocusin`/`onfocusout` delegating to `ListboxRootState`,
      the `child` snippet escape hatch, and every data/ARIA attribute from plan.md §Public API part 1.
      Instantiates and publishes `ListboxRootState` via `setListboxContext`. Apply the part's default classes
      from plan.md §Public API through `cn()` with the caller's `class` merged last. Depends on T010.
- [X] T012 [P] Create `src/lib/components/ui/listbox/listbox-group.svelte` (Group, upstream `ListboxGroup`
      `listbox.tsx:894-920`): `role="group"`, `id`/`aria-labelledby` from `$props.id()`-backed
      `ListboxGroupState`, `data-slot="listbox-group"`, the `child` snippet, publishes `ListboxGroupState` via
      `setListboxGroupContext`, throws when used outside `Listbox.Root` (via `getListboxContext`). Apply the
      part's default classes from plan.md §Public API through `cn()` with the caller's `class` merged last.
      Depends on T010.
- [X] T013 [P] Create `src/lib/components/ui/listbox/listbox-group-label.svelte` (GroupLabel, upstream
      `ListboxGroupLabel` `listbox.tsx:926-943`): renders `<div id={group.labelId}
      data-slot="listbox-group-label">`, the `child` snippet, throws
      `` `<Listbox.GroupLabel>` must be used within `<Listbox.Group>`. `` via `getListboxGroupContext`. Apply
      the part's default classes from plan.md §Public API through `cn()` with the caller's `class` merged
      last. Depends on T010.
- [X] T014 [P] Create `src/lib/components/ui/listbox/listbox-item.svelte` (Item, upstream `ListboxItem`
      `listbox.tsx:966-1079`): `ListboxItemProps` in the module script, throws
      `` `ListboxItem value cannot be an empty string` `` on `value === ''` (checked once via `untrack`),
      throws `` `<Listbox.Item>` must be used within `<Listbox.Root>`. `` via `getListboxContext`, registers
      itself in `ListboxCollection` from an `$effect` with `untrack`ed reads/teardown per research.md R-11,
      reads optional group membership via `hasListboxGroupContext`/`getListboxGroupContext`, composed
      `onclick`/`onfocus`/`onblur`/`onkeydown`/`onpointermove`/`onpointerleave`, `role="option"` with
      `aria-selected`/`aria-disabled`/`data-selected`/`data-highlighted`/`data-disabled`/`data-focused`, the
      `child` snippet, and publishes `ListboxItemState` via `setListboxItemContext`. Apply the part's default
      classes from plan.md §Public API through `cn()` with the caller's `class` merged last. Depends on T010.
- [X] T015 [P] Create `src/lib/components/ui/listbox/listbox-item-indicator.svelte` (ItemIndicator, upstream
      `ListboxItemIndicator` `listbox.tsx:1087-1106`): renders nothing unless `forceMount || item.isSelected`,
      default children is a `<Check>` icon from `@lucide/svelte` exactly as `combobox-item-indicator.svelte`
      does, `<span aria-hidden="true" data-slot="listbox-item-indicator">`, the `child` snippet, throws
      `` `<Listbox.ItemIndicator>` must be used within `<Listbox.Item>`. `` via `getListboxItemContext`. Apply
      the part's default classes from plan.md §Public API through `cn()` with the caller's `class` merged
      last. Depends on T010.

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/listbox/listbox.test.ts` — all Phase 2
tests pass.

---

## Phase 4: Barrel and types

- [X] T016 Create `src/lib/components/ui/listbox/index.ts`: import all five parts, `export type` every
      `*Props` type from each part plus the shared types and state classes from `listbox.svelte.ts`
      (`ListboxValue`, `ListboxOrientation`, `ListboxItemData`, `ListboxMountedItem`, `ListboxCollection`,
      `calculateGridLayout`, `findEnabledItem`, `getMinItemValue`, `getMaxItemValue`, `ListboxTypeahead`),
      then export short names (`Root`, `Group`, `GroupLabel`, `Item`, `ItemIndicator`) **and** prefixed
      aliases (`Listbox`, `ListboxGroup`, `ListboxGroupLabel`, `ListboxItem`, `ListboxItemIndicator`),
      matching the pattern in `src/lib/components/ui/combobox/index.ts`. All intra-repo imports use the `.js`
      extension. Depends on T011–T015.

---

## Phase 5: Demo route

- [X] T017 Create `src/routes/docs/components/listbox/+page.svelte` with the page header
      (`<svelte:head><title>Listbox — svelte-dice-ui</title></svelte:head>`, `<h1>`/description) and the
      **Default** `<ComponentPreview>` section mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/listbox-demo.tsx` (listbox is a **radix**-base
      component; all four demo files live under `bases/radix/examples/`, not `bases/base/examples/`)
      (single-selection vertical list), using `$lib/components/docs/index.js`'s `ComponentPreview` and
      `import * as Listbox from '$lib/components/ui/listbox/index.js'`.
- [X] T018 In `src/routes/docs/components/listbox/+page.svelte`, add the **Horizontal Orientation**
      `<ComponentPreview>` section mirroring `listbox-horizontal-demo.tsx` (`orientation="horizontal"`, a
      `flex` row of items).
- [X] T019 In `src/routes/docs/components/listbox/+page.svelte`, add the **Grid Layout** `<ComponentPreview>`
      section mirroring `listbox-grid-demo.tsx` (`orientation="mixed"`, a CSS `grid grid-cols-*` of items,
      demonstrating two-axis arrow navigation).
- [X] T020 In `src/routes/docs/components/listbox/+page.svelte`, add the **Grouped Items**
      `<ComponentPreview>` section mirroring `listbox-group-demo.tsx` (two `Listbox.Group`s, each with a
      `Listbox.GroupLabel` and multiple `Listbox.Item`s, `multiple` enabled).
- [X] T021 In `src/routes/docs/components/listbox/+page.svelte`, add the API reference tables (one per part:
      Root, Group, GroupLabel, Item, ItemIndicator) using `$lib/components/ui/table`, transcribing the prop
      tables from plan.md §Public API and the keyboard contract table.

**Checkpoint**: `pnpm run build` compiles the demo route; `/docs/components/listbox` renders all four demos.

---

## Phase 6: Registry entry and docs polish

- [X] T022 In the root `registry.json`, fill the `"listbox"` entry's `files` array (stubbed empty in T003)
      with the 7 non-test files — `index.ts`, `listbox.svelte`, `listbox-group.svelte`,
      `listbox-group-label.svelte`, `listbox-item.svelte`, `listbox-item-indicator.svelte`,
      `listbox.svelte.ts` — each `{ "path": "src/lib/components/ui/listbox/<file>", "type": "registry:ui" }`,
      keeping the `registryDependencies`/`dependencies` set in T003.
- [X] T023 Run `pnpm run registry:build` and confirm `static/r/listbox.json` exists, inlines all 7 files, and
      contains no unrewritten `$lib/...` import paths (per quickstart.md §2).
- [X] T024 [P] Verify docs-index integration: confirm `/docs/components` (driven by `src/lib/registry.ts`
      filtering on `type: "registry:ui"`) lists the new "Listbox" card linking to
      `/docs/components/listbox`, and that the demo page's title/description read cleanly against the other
      ported component pages for tone consistency.

---

## Phase 7: Verification (MANDATORY — Principle VII)

- [X] T025 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, and fix
      everything that fails. No suppressions (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`,
      `svelte-ignore`, `.skip`/`.todo`, `as any`, deleted assertions, loosened config) — fix the root cause.
      Also run `pnpm run format` first if any file was hand-edited outside an editor's format-on-save.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no dependencies — start immediately.
- **Phase 2 (Tests)**: depends on Phase 1 (folder must exist to hold the files); T004 (harness) must land
  before T005–T009/T006a since every behavioural block imports it — all six behavioural-block tasks edit the
  same file (`listbox.test.ts`) and run strictly in sequence, T005 → T006 → T006a → T007 → T008 → T009.
- **Phase 3 (Core)**: depends on Phase 2 existing (tests are the executable spec); T010 (state module) blocks
  T011–T015; T011 (Root) should land before T012–T015 are exercised by the test suite, though the five part
  files can be *authored* in parallel once T010 is done, since Item/Group/GroupLabel/ItemIndicator only
  reference the context keys T010 defines, not Root's runtime output.
- **Phase 4 (Barrel)**: depends on all of T011–T015 existing (imports every part).
- **Phase 5 (Demo)**: depends on Phase 4 (imports the barrel); T017–T021 all edit the same `+page.svelte`
  file and run strictly in sequence.
- **Phase 6 (Registry)**: depends on Phase 3 file list being final (T022) and Phase 5 completing (docs
  polish, T024 checks the live demo route).
- **Phase 7 (Verification)**: depends on everything above — always the last phase.

### Parallel Opportunities

- T002 and T003 (Phase 1) touch different files and can run together.
- T012, T013, T014, T015 (Phase 3 parts, once T010 is done) touch different files and can run together.
- T024 (Phase 6) has no file overlap with T022/T023 and can run alongside them once T021 is done.
- Within Phase 2 and Phase 5, tasks share a single file each and must run sequentially despite being grouped
  by behavioural area / demo section.

---

## Parallel Example: Phase 3 part files

```bash
# After T010 (listbox.svelte.ts) lands, launch the four non-root parts together:
Task: "Create src/lib/components/ui/listbox/listbox-group.svelte"
Task: "Create src/lib/components/ui/listbox/listbox-group-label.svelte"
Task: "Create src/lib/components/ui/listbox/listbox-item.svelte"
Task: "Create src/lib/components/ui/listbox/listbox-item-indicator.svelte"
```

---

## Implementation Strategy

Straight top-to-bottom execution is the only viable strategy for this feature: there is no partial-MVP slice
(a listbox without `Item` or without keyboard navigation is not a usable component), and the constitution
requires tests to exist and fail before implementation. Work Phase 1 → Phase 7 in order, using the
within-phase `[P]` opportunities above to parallelize file authorship, and do not skip Phase 7 — the port is
not done until all four gates are green with no suppressions.

## Notes

- `[P]` tasks touch different files with no dependency on an incomplete task.
- Do not run git write commands — the orchestrator owns the working tree (Principle X).
- Do not touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json` or `.port-logs/`.
- Verify each Phase 2 test task's assertions fail before starting the matching Phase 3 implementation.

---

## Phase 8: Convergence

**Purpose**: Close the gaps found by `/speckit-converge` between the implemented port and spec.md /
plan.md / contracts/listbox-api.md. T026 is a behavioural fix in the state module; T027-T030 are missing
assertions in the existing colocated test file; T031 re-runs the mandatory gates over the result.

- [X] T026 Let a bare `Space` extend an in-progress typeahead buffer in
      `src/lib/components/ui/listbox/listbox.svelte.ts` per FR-021 / US3 AC5 (partial): `onRootKeydown`
      handles `Enter`/`' '` before the typeahead block and returns unconditionally whenever an option is
      focused, so the guard `event.key === ' ' && this.typeahead.search === ''` in the typeahead block is
      unreachable and a space can never join the buffer - making the multi-word labels research.md R-08
      explicitly targets (`"FS 540"`, and `"Hospital Flip"` in the test harness) unmatchable past their
      first word. Treat a space as the selection key only while `typeahead.search === ''`, and otherwise
      route it to `ListboxTypeahead.handle()`; then assert in
      `src/lib/components/ui/listbox/listbox.test.ts` that typing a label across its space focuses that
      option, and that a bare space with an empty buffer still selects the focused option (the existing
      `selects the focused option with Enter and with Space` case must stay green).
- [X] T027 Add the disabled-option assertions for both selection shortcuts to
      `src/lib/components/ui/listbox/listbox.test.ts` per FR-007 and FR-008 (missing): today
      `selects every enabled option with Ctrl+A in multiple mode` and
      `grows and shrinks a range with Shift and the arrow keys in multiple mode` both run over an
      all-enabled list, so nothing proves `selectAll`/`selectRange` skip disabled options. Render a list
      containing a `disabled` option and assert (a) `Ctrl`/`Cmd`+`A` selects every *enabled* option and
      leaves the disabled one out, and (b) a `Shift`+arrow range spanning the disabled option excludes it
      (research.md R-09, "contiguous slice of enabled items").
- [X] T028 Add the mixed-grid row-axis loop assertions to
      `src/lib/components/ui/listbox/listbox.test.ts` per US4 AC3 and SC-002 (missing): only the column
      axis is covered today (`wraps within the column of a looping mixed grid`). With
      `orientation="mixed"`, `loop`, `LISTBOX_GRID_OPTIONS` and `stubGrid(3)`, assert the documented
      `ArrowRight`/`ArrowLeft` wrap at the ends of the collection (the flat `findEnabledItem` wrap the
      implementation and upstream both use), so every US4 arrow key has an automated outcome.
- [X] T029 Add `PageUp`/`PageDown` grid assertions to `src/lib/components/ui/listbox/listbox.test.ts` per
      FR-015 with FR-012 (missing): the existing case only covers the vertical list. In an
      `orientation="mixed"` grid assert `PageDown`/`PageUp` move exactly like `ArrowDown`/`ArrowUp`, i.e.
      one row within the same column.
- [X] T030 Add direct unit coverage for `ListboxCollection` in
      `src/lib/components/ui/listbox/listbox.test.ts` per plan.md §"Shared modules this port exports for
      later components" (missing): the exported navigation helpers, `calculateGridLayout` and
      `ListboxTypeahead` each have a unit test, but the collection - published as reusable API for later
      ports - has none. Assert `register()` returns a working teardown, `getItems()` returns mounted items
      in document order, `getEnabledItems()` drops disabled ones, and `getGroupValues()` returns the values
      registered under a group id.
- [X] T031 Re-run the mandatory gates over the convergence changes per Constitution Principle VII
      (missing): `pnpm run format`, then `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run`
      and `pnpm run build`, fixing every failure at its root cause with no suppressions.
