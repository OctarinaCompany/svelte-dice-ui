---
description: 'Task list for Stepper port'
---

# Tasks: Stepper

**Input**: Design documents from `/specs/031-port-stepper/` (plan.md, spec.md, research.md,
data-model.md, contracts/public-api.md, quickstart.md)

**Tests**: MANDATORY — Constitution Principle III and this feature's explicit request. Upstream
floor: `.reference/diceui/docs/registry/bases/radix/test/stepper.test.tsx` (every one of its 18
`it` blocks ported), plus the Constitution §7 additions (roles/ARIA, keyboard, uncontrolled,
controlled, RTL, guard rails).

**Organization**: Custom phase order requested for this port — Setup → Tests → Core component
files → Barrel and types → Demo route → Registry entry and docs polish → Verification. `[Story]`
labels (`US1`-`US3`) trace tasks back to spec.md's user stories within that fixed phase order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to spec.md User Story 1-3 where applicable; infrastructure/polish tasks carry
  no label

## Path Conventions

- Component source: `src/lib/components/ui/stepper/`
- Demo route: `src/routes/docs/components/stepper/+page.svelte`
- Registry: `registry.json` (repository root)

---

## Phase 1: Setup

**Purpose**: Confirm dependencies and stub the files every later task edits, so no task creates a
file another task also creates.

- [X] T001 Confirm no new npm dependency is required: verify `@lucide/svelte` (the `Check` icon)
      and `tailwind-variants` are already in `package.json`, and that
      `$lib/components/ui/direction-provider/index.ts` exports `useDirection`,
      `$lib/components/ui/speed-dial/index.ts` (or its `.svelte.ts`) exports
      `DomOrderedCollection`, and `$lib/components/ui/action-bar/action-bar-roving-focus.svelte.ts`
      exports `focusFirst`, `wrapArray`, `getDirectionAwareKey` (no code changes — record
      confirmation only, no file written)
- [X] T002 Create the empty component folder and stub the eleven part files with only the
      module-script `Props` type placeholders (no logic yet) in
      `src/lib/components/ui/stepper/stepper.svelte`,
      `src/lib/components/ui/stepper/stepper-list.svelte`,
      `src/lib/components/ui/stepper/stepper-item.svelte`,
      `src/lib/components/ui/stepper/stepper-trigger.svelte`,
      `src/lib/components/ui/stepper/stepper-indicator.svelte`,
      `src/lib/components/ui/stepper/stepper-separator.svelte`,
      `src/lib/components/ui/stepper/stepper-title.svelte`,
      `src/lib/components/ui/stepper/stepper-description.svelte`,
      `src/lib/components/ui/stepper/stepper-content.svelte`,
      `src/lib/components/ui/stepper/stepper-prev.svelte`,
      `src/lib/components/ui/stepper/stepper-next.svelte`
- [X] T003 [P] Stub `src/lib/components/ui/stepper/stepper.svelte.ts` with the exported
      constant/type signatures from data-model.md §1-4: `STEPPER_ORIENTATIONS`,
      `STEPPER_ACTIVATION_MODES`, `STEPPER_DATA_STATES`, `StepperNavigationDirection`,
      `StepperFocusIntent`, `StepperRootStateProps`, `StepperItemStateProps`,
      `StepperFocusStateProps`, `StepperTriggerMeta`, empty-bodied `StepperRootState`,
      `StepperItemState`, `StepperFocusState` classes, `getStepperId`, `getStepperDataState`,
      `getStepperFocusIntent` function signatures, and the three `Symbol`-keyed
      `setStepperContext`/`getStepperContext`, `setStepperItemContext`/`getStepperItemContext`,
      `setStepperFocusContext`/`getStepperFocusContext` pairs with their throwing-getter error
      messages (bodies filled in during Core phase)
- [X] T003a Create `src/lib/components/ui/stepper/index.ts` as a **stub barrel** so every Phase 2
      test import resolves: re-export the eleven stubbed part components under both the short names
      (`Root`, `List`, `Item`, `Trigger`, `Indicator`, `Separator`, `Title`, `Description`,
      `Content`, `Prev`, `Next`) and the prefixed aliases (`Stepper`, `StepperList`, `StepperItem`,
      `StepperTrigger`, `StepperIndicator`, `StepperSeparator`, `StepperTitle`,
      `StepperDescription`, `StepperContent`, `StepperPrev`, `StepperNext`), plus the stubbed
      values and types from `./stepper.svelte.js`. T029 completes it to the full contract in
      contracts/public-api.md — this task only makes the module resolvable.

**Checkpoint**: folder and module skeletons exist; nothing renders or behaves yet.

---

## Phase 2: Tests

**Purpose**: Port every upstream assertion first, so implementation in Phase 3 has a red suite to
turn green. Write both the `.ts` spec and the `.svelte` harness now; both fail until Phase 3-4
land.

> **NOTE**: Run `pnpm run test:unit -- --run` after this phase and confirm every new test fails
> (not errors-out on missing files) before starting Phase 3.

- [X] T004 [P] Read `.reference/diceui/docs/registry/bases/radix/test/stepper.test.tsx` in full and
      list all 18 of its `it` blocks — "renders stepper with correct initial state", "changes step
      when clicking on trigger", "navigates with next/previous buttons", "disables previous button
      on first step", "disables next button on last step", "supports keyboard navigation with
      arrow keys", "supports Home and End key navigation", "handles validation correctly",
      "prevents navigation when validation fails", "supports manual activation mode", "handles
      disabled steps correctly", "supports vertical orientation", "supports loop navigation",
      "renders step indicators with correct states", "handles completed steps correctly",
      "supports non-interactive mode", "has proper ARIA attributes", "supports custom step
      positions" — as inline comments (no test bodies yet) at the top of a new
      `src/lib/components/ui/stepper/stepper.test.ts`, to serve as the checklist the rest of this
      phase fills in
- [X] T005 [P] Create `src/lib/components/ui/stepper/stepper.test.svelte` harness exporting
      `StepperHarnessProps`/`StepperHarnessMode` (`'default' | 'root-child' | 'trigger-child' |
      'indicator-child' | 'prev-child' | 'next-child' | 'bare-part' | 'rtl-provider'`), modeled on
      `src/lib/components/ui/scroll-spy/scroll-spy.test.svelte`, covering: `bind:value` on the
      root, `child` snippet rendering for the parts that support it, a part rendered with no
      `<Stepper.Root>`/`<Stepper.Item>`/`<Stepper.List>` ancestor, and a `<DirectionProvider
      dir="rtl">` ancestor with no `dir` prop set on the root
- [X] T006 [US1] Port upstream's initial-render and click-navigation assertions ("renders stepper
      with correct initial state", "changes step when clicking on trigger") plus the Constitution
      §7 uncontrolled-state assertion in `src/lib/components/ui/stepper/stepper.test.ts`: three
      steps render with `defaultValue` seeding the active step; only the active step's
      `Stepper.Content` is in the document; the active trigger has `aria-current="step"`,
      `aria-selected="true"`, `data-state="active"`; a step before it is `data-state="completed"`
      and one after is `data-state="inactive"`; clicking another trigger (via `userEvent`) swaps
      the active state and visible content and fires `onValueChange` with the new value, driven by
      internal state alone (no `rerender()` — see memory `bindable-prop-resets-on-props-invalidation`)
- [X] T007 [US1] Port upstream's "renders step indicators with correct states" and "handles
      completed steps correctly" assertions in `src/lib/components/ui/stepper/stepper.test.ts`:
      `Stepper.Indicator` shows the 1-based position for inactive/active steps and the `Check` icon
      for completed steps (default content, no `children` snippet), a custom
      `Snippet<[StepperDataState]>` receives the correct data state, and a step explicitly marked
      `completed` reports `data-state="completed"` even when it is positioned *after* the active
      step
- [X] T008 [US2] Port upstream's "navigates with next/previous buttons", "disables previous button
      on first step" and "disables next button on last step" assertions in
      `src/lib/components/ui/stepper/stepper.test.ts`: `Stepper.Prev` is disabled at the first
      step, `Stepper.Next` is disabled at the last step, clicking either moves exactly one step in
      the corresponding direction, and with zero/one registered steps both are disabled (Edge
      Cases)
- [X] T009 [US3] Port upstream's "handles validation correctly" and "prevents navigation when
      validation fails" assertions plus the async-generation edge case in
      `src/lib/components/ui/stepper/stepper.test.ts`: an `onValidate` resolving `true` is called
      with `(value, 'next')` and the move proceeds; one resolving `false` leaves the active step
      unchanged and never fires `onValueChange`; backward moves (`Stepper.Prev` and a trigger click
      toward an earlier step) never invoke `onValidate`; a stale pending validation result is
      discarded when the controlled `value` changes before it resolves (Edge Case 4 / research
      R-05), using fake timers or a manually-resolved `Promise`; an `onValidate` that rejects (or
      throws synchronously) is treated exactly like one resolving `false` — the active step is
      unchanged, `onValueChange` never fires, and no unhandled rejection escapes
- [X] T010 Port upstream's "supports keyboard navigation with arrow keys", "supports Home and End
      key navigation", "supports vertical orientation" and "supports loop navigation" assertions
      plus the Constitution §7 RTL assertion in `src/lib/components/ui/stepper/stepper.test.ts`. In
      the default `automatic` activation mode every focus move also activates the step, so each
      assertion below checks **both** roving focus and `onValueChange` (the upstream floor — no
      assertion in this task may be weaker than the `it` block it ports): `ArrowRight`/`ArrowLeft`
      move focus between triggers and fire `onValueChange` with the adjacent step's value
      (horizontal, default), `ArrowUp`/`ArrowDown` are ignored; with `orientation="vertical"` the
      pairs swap and `aria-orientation`/`data-orientation` on the tablist are `"vertical"`;
      `Home`/`PageUp` move focus and activation to the first enabled trigger and `End`/`PageDown` to
      the last; with `dir="rtl"` (via the harness's `rtl-provider` mode) `ArrowLeft` moves forward
      and `ArrowRight` backward; with `loop`, the "next" arrow key on the last trigger wraps focus
      and activation to the first and vice versa; exactly one trigger has `tabindex="0"` at any time
- [X] T010a [P] Write Tab / entry-focus assertions (upstream MDX keyboard table rows 1-2, quickstart
      S-4.1, Constitution III) in `src/lib/components/ui/stepper/stepper.test.ts`: while at least
      one enabled trigger is registered the tablist has `tabindex="0"` and is the group's single Tab
      stop; `await user.tab()` from an element before the stepper lands focus on the trigger of the
      **current** step rather than the first trigger (selection-priority entry focus,
      stepper.tsx:499-515), including when the current step is not the first; `Shift+Tab` from a
      focused trigger sets the tablist's `tabindex` to `-1` and moves focus out of the group without
      changing the active step, and a subsequent `focusout` of the list restores `tabindex="0"`;
      when every registered step is `disabled` the tablist's `tabindex` is `-1` (stepper.tsx:567)
- [X] T011 Port upstream's "supports manual activation mode", "supports non-interactive mode" and
      "handles disabled steps correctly" assertions in
      `src/lib/components/ui/stepper/stepper.test.ts`: `activationMode="manual"` — focusing a
      trigger does not activate it, `Enter`/`Space` does; `nonInteractive` — clicking and
      `Enter`/`Space` are no-ops, but changing the harness's bound `value` still moves the active
      step (via `stepper.test.svelte`); a `disabled` step's trigger is `disabled`, a click on it is
      a no-op, and arrow-key roving focus skips over it entirely; with `disabled` set on
      `Stepper.Root`, every trigger is `disabled`, the root carries `data-disabled`, and neither a
      click nor `Enter`/`Space` changes the active step, while per-step `disabled` continues to
      work independently (FR-020)
- [X] T012 Port upstream's "has proper ARIA attributes" and "supports custom step positions"
      assertions plus the Constitution §7 accessibility assertions in
      `src/lib/components/ui/stepper/stepper.test.ts`: `getByRole('tablist')` carries
      `aria-orientation` matching the orientation; every `getAllByRole('tab')` has
      `aria-posinset`/`aria-setsize` matching its 1-based position and the step count and these
      update correctly when a step unmounts (Edge Cases — removing a step); exactly one
      `role="tabpanel"` is rendered unless `forceMount`, and it is `aria-labelledby` its trigger;
      the trigger's `aria-describedby` is `"<titleId> <descriptionId>"` even when
      `Stepper.Title`/`Stepper.Description` are not rendered (research R-11)
- [X] T013 [P] Write guard-rail assertions (Constitution §7/§5, quickstart S-7) in
      `src/lib/components/ui/stepper/stepper.test.ts` and `stepper.test.svelte`: each of
      `Stepper.List`, `Stepper.Item`, `Stepper.Content`, `Stepper.Prev`, `Stepper.Next` throws
      `/within/` naming both the part and `<Stepper.Root>` when rendered outside it (via the
      harness's `bare-part` mode); `Stepper.Trigger`, `Stepper.Indicator`, `Stepper.Separator`,
      `Stepper.Title`, `Stepper.Description` throw `/within/` naming `<Stepper.Item>` when rendered
      outside it even with a `<Stepper.Root>` ancestor; `Stepper.Trigger` throws `/within/` naming
      `<Stepper.List>` when rendered outside it even with root+item ancestors
- [X] T014 [P] Write `child`-snippet and `bind:ref` assertions (research R-07) in
      `src/lib/components/ui/stepper/stepper.test.svelte` + `stepper.test.ts`: for `Stepper.Root`,
      `Stepper.Trigger`, `Stepper.Prev`, `Stepper.Next` the caller's element renders in place of
      the default one and receives the merged props (`data-slot`, `data-state` where applicable);
      a `child`-rendered `Stepper.Trigger` does not self-register with the roving-focus collection
      and its `ref` stays `null` (data-model.md §2.4 note); `bind:ref` exposes the rendered element
      for every part in default mode
- [X] T015 [P] Write separator and `forceMount` assertions (FR-017, research R-12) in
      `src/lib/components/ui/stepper/stepper.test.ts`: `Stepper.Separator` renders between adjacent
      steps and is absent after the last step by default; `forceMount` keeps it mounted after the
      last step; its `data-state` uses the `'separator'` variant so the separator belonging to the
      active step is `inactive`, not `active`; `Stepper.Content` likewise respects `forceMount` to
      stay mounted for an inactive step
- [X] T015a [P] Write step-registry callback assertions (FR-015, Edge Case "removing a step",
      research R-14) in `src/lib/components/ui/stepper/stepper.test.ts` and `stepper.test.svelte`:
      `onValueAdd` fires exactly once per `Stepper.Item` on mount, with that item's `value`;
      `onValueRemove` fires with that value when the item unmounts (harness `{#if}` toggle) and the
      remaining triggers' `aria-posinset`/`aria-setsize` re-index accordingly; `onValueComplete`
      fires with `(value, true)` only when an item's `completed` prop actually flips and does
      **not** fire when the item re-renders with an unchanged flag (upstream `setStep`,
      stepper.tsx:317-319)
- [X] T016 Run `pnpm run test:unit -- --run` and confirm every test added in T006-T015a (including
      T010a) fails for
      the expected reason (missing implementation, not a syntax/import error) before starting
      Phase 3

**Checkpoint**: full red test suite in place, covering US1-US3, keyboard, RTL, guard rails and
`forceMount`.

---

## Phase 3: Core component files

**Purpose**: Implement the state module, then the eleven parts, in the implementation-phase order
from plan.md's "Implementation Phases" table.

- [X] T017 Implement `getStepperId`, `getStepperDataState`, `getStepperFocusIntent` (delegating the
      RTL key swap to `getDirectionAwareKey` from
      `$lib/components/ui/action-bar/action-bar-roving-focus.svelte.js`, then applying stepper's
      own `PageUp`→`first`/`PageDown`→`last` map), `StepperRootState` (value/registry/validation
      per data-model.md §2.2, including the `#validationGeneration` staleness guard — research
      R-05), `StepperItemState` (§2.3) and `StepperFocusState` (§2.4, composing
      `DomOrderedCollection` from `$lib/components/ui/speed-dial/index.js` and `focusFirst`/
      `wrapArray` from `action-bar-roving-focus.svelte.js`), plus the three Symbol-keyed context
      pairs with throwing getters, in `src/lib/components/ui/stepper/stepper.svelte.ts`, ported
      from `.reference/diceui/docs/registry/bases/radix/ui/stepper.tsx` lines 33-227, 379-400,
      587-608
- [X] T018 [US1] Implement the Root part in `src/lib/components/ui/stepper/stepper.svelte`: `Props`
      type in `<script module>` per contracts/public-api.md, `value` as the sole `$bindable` prop
      with `defaultValue` fallback, resolve `dir` via `useDirection()` (root `dir` prop → nearest
      `<DirectionProvider>` → ambient DOM `[dir]` → `'ltr'`), instantiate `StepperRootState` with
      getter-function props and call `setStepperContext`, render `<div data-slot="stepper"
      data-orientation data-disabled dir>` with `child` snippet support, `bind:this={ref}`,
      `...restProps`, ported from `.reference/diceui/docs/registry/bases/radix/ui/stepper.tsx`
      lines 229-377
- [X] T019 [US1] Implement the List part in `src/lib/components/ui/stepper/stepper-list.svelte`:
      read root context, instantiate `StepperFocusState` and call `setStepperFocusContext`, render
      `<div role="tablist" data-slot="stepper-list" aria-orientation data-orientation
      tabindex={state.tabIndex} dir={root.dir}>` wiring `onfocusin`/`onfocusout`/`onmousedown` to
      `onListFocusIn`/`onListFocusOut`/`onListMouseDown`, `tv()` orientation variants (module
      script), `child` snippet, `bind:this={ref}`, ported from
      `.reference/diceui/docs/registry/bases/radix/ui/stepper.tsx` lines 402-585
- [X] T020 [US1] Implement the Item part in `src/lib/components/ui/stepper/stepper-item.svelte`:
      required `value` prop plus `completed`/`disabled`, read root context, register the step in
      an `$effect` with teardown (`addStep`/`setStep`/`removeStep`, firing `onValueAdd`/
      `onValueComplete`/`onValueRemove` through the root state), instantiate `StepperItemState` and
      call `setStepperItemContext`, render `<div data-slot="stepper-item" data-state
      data-orientation data-disabled dir={root.dir}>` with `child` snippet, `bind:this={ref}`, ported from
      `.reference/diceui/docs/registry/bases/radix/ui/stepper.tsx` lines 610-673
- [X] T021 [US1] [US3] Implement the Trigger part in
      `src/lib/components/ui/stepper/stepper-trigger.svelte`: read root, item and focus context,
      effective `disabled = disabled || step.disabled || root.disabled`, register/unregister with
      `StepperFocusState` in an `$effect`, `<button type="button" role="tab" data-slot=
      "stepper-trigger" aria-controls aria-current aria-describedby aria-posinset aria-setsize
      aria-selected tabindex data-state data-disabled id>`, `onclick` computing direction via
      `root.directionTo(value)` and calling `root.setValueWithValidation` for `'next'` / direct
      `root.setValue` for `'prev'`, `onkeydown` implementing the full key table from
      contracts/public-api.md (arrow keys via `getStepperFocusIntent` +
      `state.candidatesFor`/`focusFirst`, `Home`/`End`/`PageUp`/`PageDown`, `Enter`/`Space` in
      manual mode, modifier-key suppression, `Shift+Tab` latch via `onItemShiftTab`), `onfocus`
      triggering validated activation in automatic mode, all interaction suppressed when
      `nonInteractive`, `child` snippet (no self-registration when used — research R-07),
      `bind:this={ref}`, ported from
      `.reference/diceui/docs/registry/bases/radix/ui/stepper.tsx` lines 675-980
- [X] T022 [P] [US1] Implement the Indicator part in
      `src/lib/components/ui/stepper/stepper-indicator.svelte`: read root+item context, optional
      `children: Snippet<[StepperDataState]>` prop, default content is the `Check` icon from
      `@lucide/svelte` for `data-state="completed"` else the item's 1-based position,
      `<div data-slot="stepper-indicator" data-state dir={root.dir}>`, `bind:this={ref}`, ported from
      `.reference/diceui/docs/registry/bases/radix/ui/stepper.tsx` lines 986-1026
- [X] T023 [P] [US1] Implement the Separator part in
      `src/lib/components/ui/stepper/stepper-separator.svelte`: read root+item context,
      `forceMount` prop, render nothing after the last registered step unless `forceMount`,
      `data-state` via the `'separator'` variant of `getStepperDataState`,
      `<div role="separator" aria-hidden="true" aria-orientation data-slot="stepper-separator"
      data-state data-orientation dir={root.dir}>`, `bind:this={ref}`, ported from
      `.reference/diceui/docs/registry/bases/radix/ui/stepper.tsx` lines 1032-1082
- [X] T024 [P] [US1] Implement the Title part in
      `src/lib/components/ui/stepper/stepper-title.svelte`: read root+item context,
      `<span data-slot="stepper-title" id={titleId} dir={root.dir}>`, `bind:this={ref}`, ported from
      `.reference/diceui/docs/registry/bases/radix/ui/stepper.tsx` lines 1088-1108 (data-slot
      renamed per plan.md divergence #1)
- [X] T025 [P] [US1] Implement the Description part in
      `src/lib/components/ui/stepper/stepper-description.svelte`: read root+item context,
      `<span data-slot="stepper-description" id={descriptionId} dir={root.dir}>`, `bind:this={ref}`, ported from
      `.reference/diceui/docs/registry/bases/radix/ui/stepper.tsx` lines 1114-1134 (data-slot
      renamed per plan.md divergence #1)
- [X] T026 [US1] Implement the Content part in
      `src/lib/components/ui/stepper/stepper-content.svelte`: required `value` prop, `forceMount`
      prop, read root context only (lives outside `Stepper.Item`), render only while
      `value === root.value` unless `forceMount`,
      `<div role="tabpanel" data-slot="stepper-content" aria-labelledby={triggerId}
      id={contentId} dir={root.dir}>`, `child` snippet, `bind:this={ref}`, ported from
      `.reference/diceui/docs/registry/bases/radix/ui/stepper.tsx` lines 1141-1173
- [X] T027 [P] [US2] Implement the Prev part in `src/lib/components/ui/stepper/stepper-prev.svelte`:
      read root context, effective `disabled = disabled || root.activeIndex <= 0`, `onclick`
      calling `root.goPrev()` (never consults `onValidate` — upstream 1199),
      `<button type="button" data-slot="stepper-prev">`, `child` snippet, `bind:this={ref}`, ported
      from `.reference/diceui/docs/registry/bases/radix/ui/stepper.tsx` lines 1175-1216
- [X] T028 [P] [US2] Implement the Next part in `src/lib/components/ui/stepper/stepper-next.svelte`:
      read root context, effective `disabled = disabled || root.activeIndex >= root.stepCount - 1`,
      `onclick` calling `await root.goNext()` (routes through `onValidate` — upstream 1242),
      `<button type="button" data-slot="stepper-next">`, `child` snippet, `bind:this={ref}`, ported
      from `.reference/diceui/docs/registry/bases/radix/ui/stepper.tsx` lines 1218-1259

**Checkpoint**: all eleven parts + the state module implemented; most of Phase 2's tests should
now pass.

---

## Phase 4: Barrel and types

**Purpose**: Publish the public API surface exactly as documented in contracts/public-api.md.

- [X] T029 Complete the T003a stub `src/lib/components/ui/stepper/index.ts` to its final documented
      shape: import all eleven parts; re-export
      `StepperRootProps` (alias `StepperProps`), `StepperListProps`, `StepperItemProps`,
      `StepperTriggerProps`, `StepperIndicatorProps`, `StepperSeparatorProps`, `StepperTitleProps`,
      `StepperDescriptionProps`, `StepperContentProps`, `StepperPrevProps`, `StepperNextProps`; from
      `./stepper.svelte.js` re-export `STEPPER_ORIENTATIONS`, `STEPPER_ACTIVATION_MODES`,
      `STEPPER_DATA_STATES`, `StepperRootState`, `StepperItemState`, `StepperFocusState`,
      `getStepperContext`, `setStepperContext`, `getStepperItemContext`, `setStepperItemContext`,
      `getStepperFocusContext`, `setStepperFocusContext`, `getStepperId`, `getStepperDataState`,
      `getStepperFocusIntent`, and the types `StepperOrientation`, `StepperActivationMode`,
      `StepperDataState`, `StepperNavigationDirection`, `StepperFocusIntent`,
      `StepperRootStateProps`, `StepperItemStateProps`, `StepperFocusStateProps`,
      `StepperTriggerMeta`; export short names (`Root`, `List`, `Item`, `Trigger`, `Indicator`,
      `Separator`, `Title`, `Description`, `Content`, `Prev`, `Next`) and prefixed aliases
      (`Stepper`, `StepperList`, `StepperItem`, `StepperTrigger`, `StepperIndicator`,
      `StepperSeparator`, `StepperTitle`, `StepperDescription`, `StepperContent`, `StepperPrev`,
      `StepperNext`), matching the `tags-input` barrel pattern in CLAUDE.md §3. Do **not** export
      upstream's `useStore as useStepper` (plan.md divergence #4).

**Checkpoint**: `import * as Stepper from '$lib/components/ui/stepper/index.js'` and the named
import style both work; re-run `pnpm run test:unit -- --run` — every Phase 2 test should now pass.

---

## Phase 5: Demo route

**Purpose**: One documented example per upstream demo file (four, per plan.md), matching FR-019.

- [X] T030 Create `src/routes/docs/components/stepper/+page.svelte` with page heading/description
      and a "Default" `<ComponentPreview>` mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/stepper-demo.tsx` (horizontal,
      indicator-only triggers, per-step content), using `$lib/components/docs/index.js`
      `ComponentPreview` and `$lib/components/ui/stepper/index.js`
- [X] T031 Add a "Vertical" `<ComponentPreview>` section to
      `src/routes/docs/components/stepper/+page.svelte` mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/stepper-vertical-demo.tsx`
      (`orientation="vertical"`, `Stepper.Title` + `Stepper.Description`, absolutely positioned
      separator) (same file as T030 — not `[P]`)
- [X] T032 [US3] Add a "With Validation" `<ComponentPreview>` section to
      `src/routes/docs/components/stepper/+page.svelte` with page-owned `let value =
      $state(...)` and `onValidate` gating forward moves, mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/stepper-validation-demo.tsx`
      (`bind:value`, `Stepper.Prev`/`Stepper.Next` composed through the `child` snippet with the
      existing `Button` component) (same file as T030-T031 — not `[P]`)
- [X] T033 Add a "With Form" `<ComponentPreview>` section to
      `src/routes/docs/components/stepper/+page.svelte` mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/stepper-form-demo.tsx` using this
      project's `Field`/`Input`/`Textarea` primitives and a lightweight local validator (no new
      form-library dependency, per spec.md Assumptions) plus the eleven parts' props tables
      transcribed from contracts/public-api.md (same file as T030-T032 — not `[P]`)

**Checkpoint**: demo route renders all four examples with no console errors; `pnpm run build`
compiles the route (manual `pnpm run dev` smoke check is not part of the gate, per quickstart.md).

---

## Phase 6: Registry entry and docs polish

**Purpose**: Finalize distribution metadata (FR-018) and formatting.

- [X] T034 Append exactly one `stepper` entry to `registry.json`: `type: "registry:ui"`, `title:
      "Stepper"`, `description` from plan.md's registry-entry snippet,
      `registryDependencies: ["direction-provider", "speed-dial", "action-bar"]`,
      `dependencies: ["@lucide/svelte", "tailwind-variants"]`, and a `files` array listing every
      one of the 13 non-test files under `src/lib/components/ui/stepper/` (the eleven parts +
      `stepper.svelte.ts` + `index.ts`), each `"type": "registry:ui"` — excluding
      `stepper.test.ts` and `stepper.test.svelte`
- [X] T035 Run `pnpm run registry:build` and confirm `static/r/stepper.json` is generated with
      `$lib/...` imports rewritten to registry placeholders
- [X] T036 Run `pnpm run format` across all files touched in Phases 1-6 (shadcn-style/generator
      output is not Prettier-formatted) and fix any formatting the run reports

**Checkpoint**: registry entry complete and buildable; all touched files formatted.

---

## Phase 7: Verification

**Purpose**: Constitution Principle VII — the feature is not complete until all gates are green,
with no suppressions.

- [X] T037 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and
      `pnpm run build`, and fix everything that fails

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately
- **Tests (Phase 2)**: depends on Phase 1 stubs existing (imports must resolve, even if bodies are
  empty) — BLOCKS Phase 3
- **Core (Phase 3)**: depends on Phase 2's red suite existing; T017 → {T018 → T019 → T020 → T021}
  → {T022, T023, T024, T025, T026, T027, T028} in plan.md's "Implementation Phases" order
- **Barrel (Phase 4)**: T029 completes the T003a stub barrel to its final documented shape;
  depends on all of Phase 3
- **Demo (Phase 5)**: depends on Phase 4 (imports the barrel)
- **Registry (Phase 6)**: depends on Phase 5 (file list must be final)
- **Verification (Phase 7)**: depends on everything above — always last

### Within Phase 2 (Tests)

- T004 and T005 are the scaffolding every other Phase 2 task edits into — T004 for `.test.ts`,
  T005 for `.test.svelte`. T006-T012 each add assertions to `stepper.test.ts` sequentially (same
  file — not `[P]` with respect to each other), grouped by behavioural area/story. T010a, T013,
  T014, T015, T015a are `[P]` with respect to T006-T012 and each other because they append new,
  non-overlapping assertion groups after T006-T012's groups are already committed.
- T016 depends on all of T004-T015a.

### Within Phase 3 (Core)

- T017 (state module) has no dependency on the parts.
- T018 (Root) depends on T017 (constructs `StepperRootState`, calls `setStepperContext`).
- T019 (List) depends on T017 and T018 (root context) — constructs `StepperFocusState`.
- T020 (Item) depends on T018 (root context).
- T021 (Trigger) depends on T017, T018, T019, T020 (reads all three contexts).
- T022-T026, T027-T028 depend only on root+item context (T018, T020) — parallel with each other
  and with T021's trigger-specific work once T020 lands, since they touch different files.

### Parallel Opportunities

- T003 (Phase 1 stub) has no sibling to parallelize against in this phase (T002 must land first
  since T003 is independent of the `.svelte` stubs but both are Setup-phase, non-conflicting
  files).
- T013, T014, T015 — `[P]` with each other and with T006-T012: appended after T006-T012's groups
  are already committed, so there is nothing left for them to conflict with.
- T022, T023, T024, T025 (Indicator, Separator, Title, Description) and T027, T028 (Prev, Next) —
  six different files, no cross-dependencies once T017/T018/T020 land.

---

## Parallel Example: Phase 3 leaf parts

```bash
# Once T017, T018, T020 are done, launch the six leaf parts together:
Task: "Implement Indicator part in src/lib/components/ui/stepper/stepper-indicator.svelte"
Task: "Implement Separator part in src/lib/components/ui/stepper/stepper-separator.svelte"
Task: "Implement Title part in src/lib/components/ui/stepper/stepper-title.svelte"
Task: "Implement Description part in src/lib/components/ui/stepper/stepper-description.svelte"
Task: "Implement Prev part in src/lib/components/ui/stepper/stepper-prev.svelte"
Task: "Implement Next part in src/lib/components/ui/stepper/stepper-next.svelte"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 (Setup) and Phase 2 (Tests, red).
2. Complete Phase 3 (Core) — Root, List, Item, Trigger, Indicator, Separator, Title, Description,
   Content alone deliver US1 (core step tracking, P1).
3. Complete Phase 4 (Barrel) — the component is now importable; US2 (Prev/Next, P2) and US3
   (validation, P3) already work because Prev/Next/`onValidate` are part of the same Phase 3
   implementation, not separate code paths.
4. **STOP and VALIDATE**: `pnpm run test:unit -- --run` — confirm all Phase 2 tests pass.

### Incremental Delivery

1. Setup + Tests → Core → Barrel: full component functional and tested (all three user stories,
   since this component's stories are behavioural facets of one implementation, not separable
   slices).
2. Demo (Phase 5) → Registry (Phase 6): distributable and documented.
3. Verification (Phase 7): green gate, ship.

---

## Notes

- Unlike a typical multi-service feature, Stepper's three user stories are not independently
  deployable slices of separate code — they are behavioural facets (step tracking, sequential
  navigation, validation gating) of the same eleven-part component, so Phase 3-4 implement all of
  them together; `[Story]` labels above indicate *which acceptance scenarios* a task serves, not a
  standalone increment.
- `[P]` tasks = different files, no dependencies — do not mark two tasks touching the same
  `.svelte` or `.ts` file as `[P]`.
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X).
- Do NOT touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json` or
  `.port-logs/`.

---

## Phase 8: Convergence

**Purpose**: Close the one gap found by `/speckit-converge` between the shipped component and
spec.md's Success Criteria. Everything else in Phases 1-7 is implemented and verified.

- [X] T038 Add an assertion for the documented `[data-orientation]` data attribute on
      `Stepper.Item` in `src/lib/components/ui/stepper/stepper.test.ts`: the item renders it
      (`stepper-item.svelte`, `itemAttrs`) and the upstream MDX DataAttributesTable documents it,
      but no test covers it — unlike the root (T014), the list and the separator (T010/T015), all
      of which are asserted. Assert `"horizontal"` by default and `"vertical"` under
      `orientation="vertical"` on the harness's existing `item-<value>` element, so every
      documented data attribute of every part is covered per SC-002 (partial)
