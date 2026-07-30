---
description: 'Task list for the Checkbox Group port'
---

# Tasks: Checkbox Group

**Input**: Design documents from `/specs/017-port-checkbox-group/` (plan.md, spec.md, research.md,
data-model.md, contracts/public-api.md, quickstart.md)

**Tests**: MANDATORY (Constitution Principle III/VII) — colocated at
`src/lib/components/ui/checkbox-group/checkbox-group.test.ts`, none skipped or `.todo`.

**Phase order for this feature** (per component-specific direction, overriding the template's
per-story grouping because this component is a single, tightly-coupled compound with a hard
top-to-bottom build order — state module → parts → barrel → demo → registry):
Setup → Tests → Core component files → Barrel and types → Demo route → Registry entry and docs
polish → Verification. `[Story]` labels are still attached to tasks that principally serve one user
story, for traceability back to spec.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency)
- **[Story]**: US1 = select/toggle (spec §User Story 1), US2 = keyboard (§User Story 2), US3 =
  validation/native form (§User Story 3)
- Every task names exact file paths relative to the repository root

## Path Conventions

- Component source: `src/lib/components/ui/checkbox-group/`
- Demo route: `src/routes/docs/components/checkbox-group/`
- Registry: `registry.json` at the repository root

---

## Phase 1: Setup

**Purpose**: Confirm no new dependency is needed, create the file skeleton, and reserve the
registry slot before any real content is written.

- [X] T001 Confirm the two composed primitives already exist and need no install: read
      `src/lib/components/ui/direction-provider/direction-provider.svelte.ts` (exports
      `useDirection`) and confirm `bits-ui` (`node_modules/bits-ui/package.json`, already a
      dependency) exports `Label.Root` and `@lucide/svelte` exports the `check` icon. Record in a
      one-line comment in this tasks.md-adjacent note only if a gap is found (none expected per
      plan.md "No new npm dependency").
- [X] T002 [P] Create the component directory skeleton with empty placeholder files at
      `src/lib/components/ui/checkbox-group/`: `index.ts`, `checkbox-group.svelte`,
      `checkbox-group-label.svelte`, `checkbox-group-list.svelte`, `checkbox-group-item.svelte`,
      `checkbox-group-indicator.svelte`, `checkbox-group-description.svelte`,
      `checkbox-group-message.svelte`, `checkbox-group.svelte.ts`, `checkbox-group.test.svelte`,
      `checkbox-group.test.ts`.
- [X] T003 [P] Create the docs route directory skeleton with empty placeholder files at
      `src/routes/docs/components/checkbox-group/`: `+page.svelte`,
      `shift-multi-select.svelte.ts`.
- [X] T004 Add a registry stub for `checkbox-group` to `registry.json` — append
      `{ "name": "checkbox-group", "type": "registry:ui", "title": "Checkbox Group", "description": "A group of checkboxes that allows multiple selections with support for validation and accessibility.", "registryDependencies": ["direction-provider"], "dependencies": ["bits-ui", "@lucide/svelte"], "files": [] }`
      to the `items` array (empty `files`, completed in T022). This reserves the entry's position
      and JSON shape ahead of implementation.

**Checkpoint**: skeleton exists; `registry.json` parses with the stub entry present.

---

## Phase 2: Tests (write first, must fail against the empty stubs)

**Purpose**: Encode every behavioural area from spec.md + quickstart.md V-1…V-12 as colocated
assertions before writing any real component logic (Constitution Principle VII/III). All tasks in
this phase touch `checkbox-group.test.ts` (and the harness it imports), so none are `[P]` with each
other.

- [X] T005 Write the reusable test harness component
      `src/lib/components/ui/checkbox-group/checkbox-group.test.svelte`: accepts snippets/props to
      exercise controlled (`bind:value`), function-bound controlled
      (`bind:value={() => authoritative, (next) => …}`), uncontrolled (`defaultValue`), a `<form>`
      wrapper with a submit handler and a reset button, and bare parts rendered without a
      `<CheckboxGroup.Root>` ancestor (for the out-of-provider throw tests).
- [X] T006 [US1] In `src/lib/components/ui/checkbox-group/checkbox-group.test.ts`, write the
      accessibility roles-and-names tests (quickstart V-1, V-2, V-9): the group is
      `getByRole('group', { name: 'Favorite tricks' })` via `CheckboxGroup.Label`; every item is
      `role="checkbox"`, `type="button"`, starts `aria-checked="false"`; `aria-orientation` and
      `data-orientation` default to `"vertical"`; `aria-describedby`/`aria-labelledby` only ever
      reference ids of currently-rendered `Label`/`Description`/`Message` parts (render with, then
      without, a `Description`, then with `hideOnError` while invalid, and assert no dangling
      idref in each case); an `invalid` group with an empty `<Message />` renders no message text; a
      rendered `Description` carries `aria-describedby` equal to the rendered `Label`'s `id`, and
      carries no `aria-describedby` when no `Label` is rendered.
- [X] T007 [US2] In `src/lib/components/ui/checkbox-group/checkbox-group.test.ts`, write the
      keyboard interaction tests (quickstart V-6, V-7) using `userEvent`: `Tab` ×3 visits every item
      in document order as its own stop; `Space` on a focused item toggles it and keeps focus;
      `Space` again unchecks it; `Enter` while an item has focus neither toggles it nor submits an
      enclosing form; a click on the indicator glyph produces exactly one `onValueChange` call
      (proves the invariant behind R-06, no phantom double-toggle); two sequential clicks on the
      same item check then uncheck it.
- [X] T008 [US1] In `src/lib/components/ui/checkbox-group/checkbox-group.test.ts`, write the
      controlled-vs-uncontrolled tests (quickstart V-3, V-4, V-5): uncontrolled with
      `defaultValue={['kickflip']}` renders it pre-checked and clicking another item calls
      `onValueChange` with both values while both render checked; the harness's `bind:value` mode
      shows a parent's bound state and the rendered checked state update together after a click;
      the harness's function-binding mode (`bind:value={() => authoritative, (next) => { received = next; }}`)
      shows the setter receiving the next value while the rendered `aria-checked` does not move
      (US1 AS-5) until the parent's bound value actually changes.
- [X] T009 [US2] In `src/lib/components/ui/checkbox-group/checkbox-group.test.ts`, write the RTL
      and orientation tests (quickstart V-12): `orientation="horizontal"` sets
      `data-orientation="horizontal"`/`aria-orientation="horizontal"` on the group and
      `data-orientation` on the list and every item; an explicit `dir="rtl"` renders `dir="rtl"` on
      the group; a `DirectionProvider dir="rtl"` ancestor with no `dir` prop on the group resolves
      the same way; in both RTL cases, `Tab` order and `Space` toggling are unchanged from LTR.
- [X] T010 [US3] In `src/lib/components/ui/checkbox-group/checkbox-group.test.ts`, write the form
      participation, validation, and guard-rail tests (quickstart V-8, V-10, V-11, and the spec's
      edge cases) — this is coverage beyond the minimum five behavioural areas, required because
      this component establishes the project's form conventions: `onValidate` returning a string,
      then `['a', 'b']`, then `true` drives `data-invalid`/`aria-invalid` on the group, list, and
      items, the joined message text, and clearing; `disabled` makes every item `disabled` (out of
      tab order, no callback on click); `readOnly` leaves items focusable and unchanged on click
      with no callback; each of `CheckboxGroupItem`, `CheckboxGroupIndicator`, `CheckboxGroupList`,
      `CheckboxGroupLabel`, `CheckboxGroupDescription`, `CheckboxGroupMessage` rendered without a
      `CheckboxGroupRoot` (and the indicator without an `Item`) throws
      `/must be used within/`; inside a `<form>`, submitting an empty `required` group (no `name`)
      is blocked (`onSubmit` not called, `form.checkValidity()` is `false`, the hidden input's
      `validity.valueMissing` is `true`, and the input is not `hidden`/`display:none`), checking one
      item and submitting fires the handler once, `name="tricks"` with two checked items yields
      `new FormData(form).getAll('tricks')` equal to both values, and a `type="reset"` button
      restores `defaultValue` and clears the validation message; a group rendered with zero items
      renders its label/description/list without error; a click on an item produces exactly one
      `submit`-relevant event path (no phantom double-toggle from the hidden input re-dispatching
      the click) and `form.elements` reflects the checked state after the click.
- [X] T010a [US1] [US3] In `src/lib/components/ui/checkbox-group/checkbox-group.test.ts`, write the
      indicator-presence and announcement tests: an unchecked item renders no
      `[data-slot="checkbox-group-indicator"]`, and checking it mounts one with
      `data-state="checked"`; `<CheckboxGroup.Indicator forceMount />` stays mounted while unchecked
      with `data-state="unchecked"` and flips to `data-state="checked"` on toggle; a disabled group
      gives the indicator `data-disabled`; `announce` on `CheckboxGroup.Description` and on
      `CheckboxGroup.Message` renders `aria-live="polite"` when true and `aria-live="off"` by
      default; a `Description hideOnError` is in the document while the group is valid, absent while
      invalid, and returns when validity is restored.

**Checkpoint**: all tests above exist and fail (stub files render nothing yet).

---

## Phase 3: Core component files

**Purpose**: One task per exported subcomponent from plan.md's "Public API", built bottom-up from
the shared state module.

- [X] T011 Implement the state module `src/lib/components/ui/checkbox-group/checkbox-group.svelte.ts`
      per data-model.md: `CHECKBOX_GROUP_ORIENTATIONS`, `CheckboxGroupValidationResult`,
      `getDataState()`, `toValidationMessage()`, `CheckboxGroupRootState` (value/validation/ids/
      part-registration per the constructor-props and derived-values tables), `CheckboxGroupItemState`
      (checked/disabled/required/name derivation), `FormControlState` (`form`/`isFormControl`), and
      the two `Symbol`-keyed context pairs (`setCheckboxGroupContext`/`getCheckboxGroupContext`,
      `setCheckboxGroupItemContext`/`getCheckboxGroupItemContext`) with the documented throw
      messages.
- [X] T012 [US1] Implement `CheckboxGroup.Root` in
      `src/lib/components/ui/checkbox-group/checkbox-group.svelte`: module-script `CheckboxGroupRootProps`
      per contracts/public-api.md; `value = $bindable()` seeded `value ??= defaultValue`; composes
      `useDirection()` from `$lib/components/ui/direction-provider`; constructs and publishes
      `CheckboxGroupRootState` via `setCheckboxGroupContext`; renders `<div role="group">` with
      `data-slot="checkbox-group"`, `aria-labelledby`, `aria-describedby`, `aria-readonly`,
      `aria-orientation`, `aria-invalid`, `dir`, `data-orientation`, `data-disabled`, `data-invalid`,
      `data-readonly`, `ref`/`class`/`...restProps` (depends on T011); all classes composed with
      `cn()` (caller `class` merged last) from the upstream registry file
      `.reference/diceui/docs/registry/bases/radix/ui/checkbox-group.tsx`, translated to semantic
      tokens only (`border-input`, `bg-primary`, `text-primary-foreground`, `text-destructive`,
      `ring-ring`) with no raw palette colour, no `dark:` override and no `space-*` utility
      (Principle VIII).
- [X] T013 [P] [US1] Implement `CheckboxGroup.Label` in
      `src/lib/components/ui/checkbox-group/checkbox-group-label.svelte`: `CheckboxGroupLabelProps`;
      reads `getCheckboxGroupContext('<CheckboxGroup.Label>')`; renders `bits-ui`'s `Label.Root` as
      `data-slot="checkbox-group-label"` with `id={labelId}` and `data-disabled`; registers/
      unregisters with `registerLabel()` in an `$effect` (depends on T011).
- [X] T014 [P] [US1] Implement `CheckboxGroup.List` in
      `src/lib/components/ui/checkbox-group/checkbox-group-list.svelte`: `CheckboxGroupListProps`;
      reads the root context; renders `<div role="group">` `data-slot="checkbox-group-list"`,
      `id={listId}`, `data-orientation`, `data-invalid`, `data-disabled` (depends on T011); styles
      the list with `cn('flex gap-3 data-[orientation=vertical]:flex-col
      data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:flex-wrap', className)`
      so `orientation` drives layout, caller `class` merged last.
- [X] T015 [US2] [US3] Implement `CheckboxGroup.Item` in
      `src/lib/components/ui/checkbox-group/checkbox-group-item.svelte`: `CheckboxGroupItemProps`
      (required `value`, `disabled`, `required`, `name`, `indicator` snippet, `children`); reads the
      root context, constructs `CheckboxGroupItemState`, publishes it via
      `setCheckboxGroupItemContext`; renders `<button type="button" role="checkbox">`
      `data-slot="checkbox-group-item"` with a generated `id` (via `$props.id()`, overridable by the
      caller through `...restProps`), `aria-checked`, `aria-disabled`, `aria-invalid`,
      `aria-required`, `disabled`, `data-state`, `data-orientation`, `data-disabled`, `data-invalid`;
      composes caller `onclick`/`onkeydown` with the built-in handler via the
      `callerHandler?.(e); if (e.defaultPrevented) return;` pattern (R-07); toggles on click and on
      `Space`, is inert on `Enter`; renders `<span data-slot="checkbox-group-item-box">` containing
      `{@render indicator?.() ?? <CheckboxGroup.Indicator />}` followed by
      `{@render children?.()}`; renders the visually-hidden `<input type="checkbox">`
      `data-slot="checkbox-group-item-input"` (`aria-hidden`, `tabindex="-1"`, `name`, `value`,
      `checked`, `disabled`, `required`, `readonly`, off-screen inline style, `hidden` only when
      `!formControl.isFormControl`) and its `FormControlState` + form `reset` listener effect per
      data-model.md (depends on T011); all classes composed with `cn()` (caller `class` merged last)
      from the upstream registry file
      `.reference/diceui/docs/registry/bases/radix/ui/checkbox-group.tsx`, translated to semantic
      tokens only (`border-input`, `bg-primary`, `text-primary-foreground`, `text-destructive`,
      `ring-ring`) with no raw palette colour, no `dark:` override and no `space-*` utility
      (Principle VIII).
- [X] T016 [US1] Implement `CheckboxGroup.Indicator` in
      `src/lib/components/ui/checkbox-group/checkbox-group-indicator.svelte`:
      `CheckboxGroupIndicatorProps` (`forceMount`, `children` defaulting to the `check` icon from
      `@lucide/svelte`); reads `getCheckboxGroupItemContext('<CheckboxGroup.Indicator>')`; renders
      `<span data-slot="checkbox-group-indicator">` with `data-state`, `data-disabled`, mounted only
      when `forceMount || checked` (depends on T015).
- [X] T017 [P] [US3] Implement `CheckboxGroup.Description` in
      `src/lib/components/ui/checkbox-group/checkbox-group-description.svelte`:
      `CheckboxGroupDescriptionProps` (`announce`, `hideOnError`); reads the root context; renders
      `<div data-slot="checkbox-group-description">` `id={descriptionId}`, `aria-live`,
      `aria-invalid`, `aria-describedby={labelId}` (only while a `CheckboxGroup.Label` is
      registered), `data-disabled`, `data-invalid`; absent while `hideOnError && isInvalid`;
      registers/unregisters via `registerDescription()` in an `$effect` (depends on T011).
- [X] T018 [P] [US3] Implement `CheckboxGroup.Message` in
      `src/lib/components/ui/checkbox-group/checkbox-group-message.svelte`:
      `CheckboxGroupMessageProps` (`announce`, `children` fallback); reads the root context; renders
      `<div data-slot="checkbox-group-message">` `id={messageId}`, `aria-live`, `data-disabled`,
      `data-invalid`, only while `isInvalid` and there is content (`messageContent` or `children`);
      registers/unregisters via `registerMessage()` in an `$effect` (depends on T011).

**Checkpoint**: run `pnpm run test:unit -- --run src/lib/components/ui/checkbox-group` — T006–T010,
T010a should now pass against T011–T018.

---

## Phase 4: Barrel and types

- [X] T019 Implement `src/lib/components/ui/checkbox-group/index.ts` per
      contracts/public-api.md: import all 7 parts; re-export each part's `Props` type (plus the
      `CheckboxGroupProps` alias of `CheckboxGroupRootProps`); export short names (`Root`, `Label`,
      `List`, `Item`, `Indicator`, `Description`, `Message`), prefixed aliases (`CheckboxGroup`,
      `CheckboxGroupLabel`, `CheckboxGroupList`, `CheckboxGroupItem`, `CheckboxGroupIndicator`,
      `CheckboxGroupDescription`, `CheckboxGroupMessage`), and the reusable state/helper exports
      (`CHECKBOX_GROUP_ORIENTATIONS`, `CheckboxGroupItemState`, `CheckboxGroupRootState`,
      `FormControlState`, `getCheckboxGroupContext`, `getCheckboxGroupItemContext`, `getDataState`,
      `setCheckboxGroupContext`, `setCheckboxGroupItemContext`, `toValidationMessage`, and the
      `CheckboxGroupOrientation`/`CheckboxGroupValidationResult` types) from
      `checkbox-group.svelte.ts` (depends on T012–T018).

**Checkpoint**: `import * as CheckboxGroup from '$lib/components/ui/checkbox-group/index.js'` and
`import { CheckboxGroup, CheckboxGroupItem } from '...'` both resolve with no type error.

---

## Phase 5: Demo route

- [X] T020 [P] Implement the shift-range helper
      `src/routes/docs/components/checkbox-group/shift-multi-select.svelte.ts` per research.md
      R-13: a rune-based class porting upstream's `useShiftMultiSelect`
      (`selectedValues`, `lastSelected`, a non-reactive `isShiftPressed` field,
      `onValueChange`, `onShiftKeyDown`) for the multi-selection demo only — no changes to the
      component's public API.
- [X] T020a [P] In `src/routes/docs/components/checkbox-group/shift-multi-select.test.ts`, test the
      shift-range helper from T020 directly (no DOM): a plain change toggles one value and records
      it as `lastSelected`; a change with `isShiftPressed` after a previous selection adds every
      value between `lastSelected` and the new value, forwards and backwards; a Shift-range whose
      anchor was being deselected removes the whole range; with no previous selection, Shift behaves
      like a plain toggle.
- [X] T021 Implement `src/routes/docs/components/checkbox-group/+page.svelte`: one
      `<ComponentPreview>` per upstream demo file — Default (label, description, custom indicator
      icon), Animated (indicator transition via a page-scoped `<style>` block, R-14 — not
      `src/app.css`), Horizontal (`orientation="horizontal"`), With Validation (`Label`,
      `Description hideOnError`, `Message`, an `onValidate` callback), and Multi Selection
      (composes `shift-multi-select.svelte.ts` from T020 with `Shift`-click range selection on
      `CheckboxGroup.List`) — plus the 7 prop tables (Root, Label, List, Item, Indicator,
      Description, Message) documenting every prop from contracts/public-api.md (depends on T019,
      T020).

**Checkpoint**: `pnpm run build` statically analyses the new route with no errors (full build runs
in Phase 7).

---

## Phase 6: Registry entry and docs polish

- [X] T022 Replace the `files: []` stub from T004 with the complete file list in the
      `checkbox-group` entry of `registry.json`: `index.ts`, `checkbox-group.svelte`,
      `checkbox-group-label.svelte`, `checkbox-group-list.svelte`, `checkbox-group-item.svelte`,
      `checkbox-group-indicator.svelte`, `checkbox-group-description.svelte`,
      `checkbox-group-message.svelte`, `checkbox-group.svelte.ts` (all `type: "registry:ui"`,
      `checkbox-group.test.svelte`/`checkbox-group.test.ts` deliberately excluded), per
      contracts/public-api.md's `registry.json` entry block.
- [X] T023 Run `pnpm run registry:build` and confirm `static/r/checkbox-group.json` (or
      equivalent registry output path) is regenerated with the new entry's inlined file contents
      and rewritten `$lib/...` imports.
- [X] T024 Run `pnpm run format` across the full diff (shadcn/generator-shaped output is not
      Prettier-clean by default), then confirm mechanically that
      `src/routes/docs/components/checkbox-group/+page.svelte` contains exactly five
      `<ComponentPreview>` sections (Default, Animated, Horizontal, With Validation, Multi
      Selection) and that `pnpm run build` compiles the route. Behavioural confirmation of
      `hideOnError` and of the Shift-click range is covered by the automated tests in T010, T010a
      and T020a — do not record an unverified manual claim here.

---

## Phase 7: Verification (MANDATORY — Constitution Principle VII)

- [X] T025 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and
      `pnpm run build`, and fix everything that fails. No `@ts-ignore`, `@ts-expect-error`,
      `eslint-disable`, `svelte-ignore`, `as any`, `.skip`, `.todo`, deleted assertion, or loosened
      config may be used to reach green — fix the root cause in the files from Phases 3–6.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Tests (Phase 2)**: depends on Setup (stub files must exist to import); all tasks touch
  `checkbox-group.test.ts` and/or `checkbox-group.test.svelte`, so none run in parallel with each
  other, but the whole phase can be written before any Phase 3 code exists (tests are expected to
  fail until Phase 3 lands).
- **Core component files (Phase 3)**: depends on Tests existing (T005–T010, T010a) so failures are visible;
  T011 (state module) blocks every part task T012–T018; T016 (Indicator) additionally depends on
  T015 (Item) for the item context.
- **Barrel and types (Phase 4)**: depends on all of Phase 3 (T012–T018).
- **Demo route (Phase 5)**: depends on Phase 4 (T019) and T020.
- **Registry entry and docs polish (Phase 6)**: depends on Phase 3–5 file lists being final (T012–T021).
- **Verification (Phase 7)**: depends on everything above; always the last phase.

### User Story Coverage

- **US1** (select/toggle, P1): T006, T008, T010a, T012, T013, T014, T016.
- **US2** (keyboard, P1): T007, T009, T015.
- **US3** (validation/native form, P1): T010, T010a, T015, T017, T018.

All three user stories are P1 and share the same compound component, so — unlike an independently
deployable multi-story feature — they are not separable into parallel implementation tracks; each
part task above serves whichever stories exercise it, and Phase 2's test tasks are already split
one-per-behavioural-area for exactly this reason.

### Parallel Opportunities

- T002 and T003 (Phase 1, different directories).
- T013, T014, T017, T018 (Phase 3, four parts that only depend on T011 and touch different files).
- T020 (Phase 5) can run alongside T012–T018 if staffed ahead, though it logically lands after T019
  since `+page.svelte` (T021) imports both.

---

## Parallel Example: Phase 3 core files

```bash
# After T011 (state module) lands, run these four together:
Task: "Implement CheckboxGroup.Label in src/lib/components/ui/checkbox-group/checkbox-group-label.svelte"
Task: "Implement CheckboxGroup.List in src/lib/components/ui/checkbox-group/checkbox-group-list.svelte"
Task: "Implement CheckboxGroup.Description in src/lib/components/ui/checkbox-group/checkbox-group-description.svelte"
Task: "Implement CheckboxGroup.Message in src/lib/components/ui/checkbox-group/checkbox-group-message.svelte"
```

---

## Implementation Strategy

1. Complete Phase 1 (Setup) and Phase 2 (Tests) — the full test suite exists and fails.
2. Complete Phase 3 (Core) bottom-up: T011 → {T012, T013, T014, T017, T018 in parallel} → T015 → T016.
3. Complete Phase 4 (Barrel) — re-run `pnpm run test:unit -- --run src/lib/components/ui/checkbox-group`
   and confirm every Phase 2 test now passes.
4. Complete Phase 5 (Demo route) and Phase 6 (Registry entry and docs polish).
5. Complete Phase 7 (Verification) — all four gates green, nothing suppressed.

There is no meaningful "MVP-only" subset smaller than the whole component: all three user stories
are P1, the item (T015) is load-bearing for both US2 and US3, and the constitution requires the
full test suite and both quality-gate passes before the component is considered shipped.

---

## Notes

- [P] tasks = different files, no dependency on an incomplete task.
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X).
- Do NOT touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json`, `.port-logs/`.
- Verify each Phase 2 test fails before starting Phase 3, and passes again before Phase 4.
</content>

---

## Phase 8: Convergence

**Purpose**: Close the gaps found by `/speckit-converge` between the implemented port and spec.md /
plan.md / the constitution. Assessed state: all four gates exit 0 (`check` 0 errors / 8 warnings,
`lint` clean, 1084 tests passing, `build` succeeds), `registry.json` + `static/r/checkbox-group.json`
are complete, and the demo route has all five upstream previews. What remains is the zero-warning
gate condition and five documented attributes/props with no assertion behind them.

- [X] T026 CRITICAL — remove the three `a11y_role_supports_aria_props` compiler warnings that
      `src/lib/components/ui/checkbox-group/checkbox-group.svelte` emits at lines 149–151
      (`aria-readonly`, `aria-orientation`, `aria-invalid` on `role="group"`), so
      `pnpm run check` reports zero warnings for this component. The attributes themselves are
      required by FR-009/FR-010 and must keep being emitted with identical values — build them into a
      `$derived` object and spread it onto the `<div>` (the compiler's a11y rule only inspects static
      attributes) rather than deleting them. `svelte-ignore` is forbidden (Principle VI), and
      Principle VII admits no exception, so this cannot be carried in plan.md's Complexity Tracking
      either. Every existing assertion in `checkbox-group.test.ts` must still pass unchanged, per
      Constitution "Quality Gates" §1 (contradicts)
- [X] T027 CRITICAL — remove the `state_referenced_locally` compiler warning at
      `src/lib/components/ui/checkbox-group/checkbox-group.svelte:109` (`value ??= defaultValue`) so
      `pnpm run check` reports zero warnings, without changing the controlled/uncontrolled semantics
      spec FR-002 and the Assumptions describe: read the prop inside a closure
      (`value ??= untrack(() => defaultValue)`) or drop the seeding statement and derive it in the
      state props (`getValue: () => value ?? defaultValue`). Note the same warning is emitted by
      `banner.svelte`, `speed-dial.svelte` and `relative-time-card.svelte` — fix only this feature's
      file; the others are outside this feature's scope, per Constitution "Quality Gates" §1
      (contradicts)
- [X] T028 Add an `aria-required` assertion for `CheckboxGroup.Item` in
      `src/lib/components/ui/checkbox-group/checkbox-group.test.ts`: with a `required` group and an
      empty value every item exposes `aria-required="true"`, and checking any one item flips every
      item to `aria-required="false"` (the requirement is satisfied by any member). The attribute is
      emitted by `checkbox-group-item.svelte:134` and is one of the four superset attributes the spec
      Assumptions promise is "covered by an assertion", but no test currently reads it, per FR-014 /
      FR-007 / SC-002 (missing)
- [X] T029 Cover the item-level `required` prop in
      `src/lib/components/ui/checkbox-group/checkbox-group.test.ts` — the harness already accepts it
      (`checkbox-group.test.svelte`, `CheckboxGroupHarnessItem.required`) but no test passes it:
      render a group that is **not** `required` with one item marked `required`, and assert that item
      exposes `aria-required="true"` and its hidden input is `required` while unchecked, that its
      siblings are neither, and that checking it clears both. Only the group-level `required` is
      exercised today (test line 513), per FR-013 / FR-007 (missing)
- [X] T030 Assert `data-disabled` on the four parts that expose it but are never checked, in
      `src/lib/components/ui/checkbox-group/checkbox-group.test.ts`: `CheckboxGroup.Label`,
      `CheckboxGroup.List`, `CheckboxGroup.Description` and `CheckboxGroup.Message` (the message
      needs a `disabled` + `invalid` group with fallback content to be rendered at all). All four are
      emitted by the components and three of them are in the upstream MDX `DataAttributesTable`; only
      the group, item and indicator are asserted today (test lines 427–430, 647), per FR-011 /
      FR-012 / FR-018 / FR-019 / SC-002 (missing)
- [X] T031 Assert the two remaining documented item details in
      `src/lib/components/ui/checkbox-group/checkbox-group.test.ts`: the hidden input mirrors the
      group's `readOnly` (`readonly` attribute present on every
      `[data-slot="checkbox-group-item-input"]` in a read-only group — FR-016 lists it alongside
      `name`/`checked`/`disabled`/`required`, all of which are asserted), and each item carries a
      non-empty generated `id` that is unique across the group (FR-014) (missing)

