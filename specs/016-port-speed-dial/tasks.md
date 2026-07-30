---
description: 'Task list for the Speed Dial port'
---

# Tasks: Speed Dial

**Input**: Design documents from `/specs/016-port-speed-dial/` (plan.md, spec.md, research.md,
data-model.md, contracts/public-api.md, quickstart.md)

**Tests**: MANDATORY (Constitution Principle III / VII). Every test task below targets
`src/lib/components/ui/speed-dial/speed-dial.test.ts` (plus one harness file), ports all 17 upstream
assertions from `.reference/diceui/docs/registry/bases/radix/test/speed-dial.test.tsx`, and adds the
project's own roles/ARIA, keyboard, RTL, controlled/uncontrolled and guard-rail coverage. No
`.skip`/`.todo`/assertion-free test is acceptable.

**Organization**: Phases run Setup → Tests → Core component files → Barrel and types → Demo route →
Registry entry and docs polish → Verification, per the explicit ordering requested for this port. Task
descriptions are still tagged `[US1]`/`[US2]`/`[US3]` where they map to a spec.md user story, for
traceability.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency)
- **[Story]**: Maps the task to spec.md's US1 (reveal/select/close), US2 (keyboard-only operation) or
  US3 (activation mode / side / labels / controlled) — omitted for Setup, barrel, demo, registry and
  verification tasks that aren't story-specific
- All paths are relative to the repository root

---

## Phase 1: Setup

**Purpose**: Confirm the dependency surface and reserve the registry slot before any code is written.

- [X] T001 [P] Verify no new npm dependency is required: confirm `tailwind-variants` (already a
      dependency, per `plan.md` Technical Context) and `src/lib/components/ui/button/index.ts` both
      exist; do not run `pnpm add` or `shadcn-svelte add` (research R-15, CLAUDE.md §1). No file
      changes — this is a verification-only task.

**Checkpoint**: Dependency surface confirmed. Test and implementation work can begin. (The registry
entry is added once, in T020, after the demo route exists — a `registry:ui` entry makes the docs
index link to `/docs/components/speed-dial`, and every route is prerendered.)

---

## Phase 2: Tests (write first; they must fail until Phase 3 lands)

**Purpose**: Port every upstream assertion plus the project's own coverage areas into
`src/lib/components/ui/speed-dial/speed-dial.test.ts`, and stand up the multi-part test harness. Per
CLAUDE.md §7: `describe`/`it`/`expect`/`vi` imported explicitly (`globals: false`), every `it` asserts
at least once, `userEvent` over `fireEvent`, RTL and keyboard cases mirror the upstream test file.

- [X] T003 [P] Create the test harness component
      `src/lib/components/ui/speed-dial/speed-dial.test.svelte` — a thin wrapper accepting `Root`
      props plus `Snippet` props for the trigger/content/item regions (snippets only — no `<slot>` and
      no `let:`, per Constitution Principle I), used by tests that need `bind:open`, `bind:ref`, the
      six `child` snippets, provider-less parts, `{#each}`-driven item sets, and sibling focusables for
      the Tab-exit cases (per `plan.md` Testing section and `quickstart.md` V-6/V-7 harness notes).
- [X] T004 [US1] In `src/lib/components/ui/speed-dial/speed-dial.test.ts`, port all 17 assertions from
      `.reference/diceui/docs/registry/bases/radix/test/speed-dial.test.tsx` one-for-one
      (`quickstart.md` V-3): Basic Rendering (trigger present, `aria-haspopup="menu"`,
      `aria-expanded="false"`, `data-state="closed"`, content absent when closed), Open/Close Behavior
      (click opens with `onOpenChange(true)` and `aria-expanded="true"`; controlled rerender is
      authoritative), Disabled State (`toBeDisabled()`, no `onOpenChange` call, rerender
      `disabled: false → true`), ARIA Attributes (`role="button"`, `aria-controls` present,
      `aria-expanded` flips), the O(n²) regression case (50 items + `defaultOpen` render in < 1000 ms,
      SC-004), Rapid Toggle (3 clicks → `onOpenChange` called with `true, false, true`), Action
      Selection (`onSelect` + `preventDefault()` keeps it open; `disabled` action never fires
      `onSelect`), Side Variations (`data-side` for all four sides via a parameterized case,
      `aria-orientation` vertical/horizontal), and ForceMount (content present while `open={false}`).
- [X] T005 [US2] In `src/lib/components/ui/speed-dial/speed-dial.test.ts`, add the keyboard-interaction
      test group (`quickstart.md` V-4, FR-008): `Enter`/`Space` on the trigger opens it; `Escape` closes
      and restores focus to the trigger from both the trigger and an action (research R-07);
      `onEscapeKeyDown` + `preventDefault()` keeps it open; `Tab` on the last enabled action closes and
      moves focus past the root; `Shift+Tab` on the trigger closes, but `Shift+Tab` on the first action
      only moves focus to the trigger first (the two-step R-06 sequence); a disabled action is never
      the Tab-exit boundary; zero items does not throw on `Tab`/`Escape`. Drive every case through
      `userEvent`, using `vi.useFakeTimers()` + `userEvent.setup({ advanceTimers:
      vi.advanceTimersByTime })` wherever a timer is involved (research R-14).
- [X] T006 [US1] [US3] In `src/lib/components/ui/speed-dial/speed-dial.test.ts`, add the accessibility
      roles/names/guard-rails test group (`quickstart.md` V-7, FR-012/FR-013/FR-020): `role="menu"` +
      `aria-orientation` on content, `role="menuitem"` on every action, `role="none"` on the item; each
      action's `aria-labelledby` resolves to its sibling label's `id` and the accessible name matches
      the label text whether or not the label is `sr-only`; every part carries its documented
      `data-slot`; the caller's `class` wins over defaults; each of the six `child` snippets renders the
      caller's element with merged props (via the T003 harness); `data-disabled` is absent unless
      `disabled`; rendering `Trigger`/`Content`/`Item` outside `Root`, or `Action`/`Label` outside
      `Item`, throws `/within/`; an `Item` inside `Root` but outside `Content` renders without throwing
      (research R-10); a caller-supplied `onclick`/`onmouseenter`/`onmouseleave` on the trigger and
      `onpointerdowncapture` on the root run before the part's own handler and can suppress its
      internal behaviour by calling `preventDefault()` (FR-010a).
- [X] T007 [US3] In `src/lib/components/ui/speed-dial/speed-dial.test.ts`, add the controlled-vs-
      uncontrolled test group (`quickstart.md` V-6 subset, FR-002): uncontrolled `defaultOpen` renders
      content immediately; `bind:open` propagates both ways via the T003 harness; supplying `open` +
      `onOpenChange` makes the component never change its own rendered state on click, only calling
      back, until the caller updates `open` (research R-08); `activationMode="hover"` opens after
      `delay` ms and closes ~100 ms after the pointer leaves both trigger and content, with movement
      into the content cancelling the close, all under fake timers (research R-14); `activationMode="click"`
      never opens on hover; `disabled` suppresses both hover and click activation.
- [X] T008 [US3] In `src/lib/components/ui/speed-dial/speed-dial.test.ts`, add the RTL test group
      (`quickstart.md` V-8, FR-017, SC-006): inside `dir="rtl"`, `data-side` is unchanged for all four
      `side` values (no mirroring, matching upstream), the content still carries the matching
      `aria-orientation`, and the Tab-exit sequence from T005 behaves identically.
- [X] T009 [US1] In `src/lib/components/ui/speed-dial/speed-dial.test.ts`, add the remaining edge-case
      coverage: pointer/hover/dismissal (`quickstart.md` V-5 — outside `click` closes with a cancelable
      `onInteractOutside` carrying `detail.originalEvent`; a click on the trigger itself does not
      trigger outside dismissal; a `pointerdown` with `pointerType: 'touch'` outside does not close
      until the following `click`, dispatched as a raw `PointerEvent` per research R-14); presence/
      animation/CSS variables (V-6 — closing keeps content mounted for `(n-1)*50 + 200` ms then removes
      it, `forceMount` keeps it and only flips `data-state`; content `data-state` becomes `"open"` one
      frame after opening; `--speed-dial-gap`/`--speed-dial-offset`/`--speed-dial-transform-origin`
      honour `gap`/`offset`; `--speed-dial-delay` on item *i* is `i*50`ms opening and `(n-i-1)*50`ms
      closing; a caller `style` overrides a component-set custom property); and the pure-helper/
      collection unit tests (V-2 — `getTransformOrigin` covers all four origins, `getOrientation`,
      `getItemDelay(i, n, true|false)` including `n === 0`/`n === 1`, `getContentPosition` per side
      honouring `offset`, and `DomOrderedCollection` ordering/unregister/`indexById` behaviour).

**Checkpoint**: `speed-dial.test.ts` and `speed-dial.test.svelte` exist and fail (no implementation
yet, or fail to import). Proceed to Phase 3.

---

## Phase 3: Core component files

**Purpose**: One task per exported subcomponent from `plan.md`'s Public API, plus the two runes
modules they depend on, built bottom-up.

- [X] T010 [P] Implement `DomOrderedCollection<TMeta>` in
      `src/lib/components/ui/speed-dial/speed-dial-collection.svelte.ts` — `register`/`unregister`,
      `ordered` (document-position sort via `compareDocumentPosition`), `indexById`, `size`,
      `elements()`, replacing upstream's `getNodes()` (`plan.md` Phase 1, `contracts/public-api.md` §7,
      research R-01/R-16). No speed-dial-specific knowledge lives here — it is exported from the barrel
      for reuse by later ports.
- [X] T011 Implement `src/lib/components/ui/speed-dial/speed-dial.svelte.ts` — constants
      (`DEFAULT_GAP`, `DEFAULT_OFFSET`, `DEFAULT_ITEM_DELAY`, `DEFAULT_HOVER_CLOSE_DELAY`,
      `DEFAULT_ANIMATION_DURATION`, `DEFAULT_HOVER_OPEN_DELAY`, `SPEED_DIAL_SIDES`,
      `SPEED_DIAL_ACTIVATION_MODES`, `ACTION_SELECT_EVENT`, `INTERACT_OUTSIDE_EVENT`), pure helpers
      (`getDataState`, `getTransformOrigin`, `getOrientation`, `getContentPosition`, `getItemDelay`),
      `speedDialContentVariants`/`speedDialItemVariants` via `tv()`, and the three state classes
      (`SpeedDialRootState`, `SpeedDialContentState`, `SpeedDialItemState`) with their
      `set…Context`/`get…Context` pairs on typed `Symbol` keys — `getSpeedDialContext` and
      `getSpeedDialItemContext` throw the documented `` `<Part>` must be used within `<Parent>` ``
      errors (FR-020), `getSpeedDialContentContext` returns `undefined` (research R-10). Depends on
      T010 for the collection type used by the state classes.
- [X] T012 Implement `src/lib/components/ui/speed-dial/speed-dial.svelte` (Root) — module-script
      `SpeedDialProps`/`SpeedDialChildProps` types; `open = $bindable()` seeded via `open ??=
      defaultOpen`; `setOpen` calling `onOpenChange` on every transition (research R-08); `$props.id()`
      content id; installs `onpointerdowncapture` guard (caller's handler runs first,
      `preventDefault()` suppresses internal logic); renders `data-slot="speed-dial"`, `data-state`,
      `data-disabled` (`? '' : undefined`); `child` snippet support; `bind:this={ref}`;
      `...restProps` spread. Depends on T011.
- [X] T013 Implement `src/lib/components/ui/speed-dial/speed-dial-trigger.svelte` — composes
      `$lib/components/ui/button`; `disabled` = own prop OR `root.disabled`; registers its element in
      the root's `DomOrderedCollection` as the first Tab-exit boundary node (research R-06); click
      toggle plus `Enter`/`Space` native button activation; hover-mode open/close timers (owned by an
      `$effect` with teardown per CLAUDE.md §4); `role="button"`, `aria-haspopup="menu"`,
      `aria-expanded`, `aria-controls`; `data-slot="speed-dial-trigger"`, `data-state`;
      `size-11 rounded-full` + caller's `class`; caller's `onclick`/`onmouseenter`/`onmouseleave` run
      first and `defaultPrevented` aborts internal behaviour. Depends on T011, T012.
- [X] T014 Implement `src/lib/components/ui/speed-dial/speed-dial-content.svelte` — presence/animation
      driven by `mounted = forceMount || open || exiting` and one-rAF-later `animating`, both inside
      `$effect`s with teardown; keydown layer (`Escape` closes + restores focus to trigger per research
      R-07, cancelable via `onEscapeKeyDown`; `Tab`/`Shift+Tab` exit-boundary detection using the root's
      collection); outside-dismissal layer (capture-phase inside-tree guard, `pointerType === 'touch'`
      deferral to a one-shot `click`, cancelable `onInteractOutside` with `detail.originalEvent`);
      hover-close cancel when pointer enters content; `role="menu"`, `aria-orientation` from
      `getOrientation(side)`; `data-slot="speed-dial-content"`, `data-state`, `data-orientation`,
      `data-side`; `--speed-dial-gap`/`--speed-dial-offset`/`--speed-dial-transform-origin` plus the
      four positioning declarations from `getContentPosition`, with the caller's `style` winning;
      retained `z-50` with the in-file justification comment (research R-12, matching
      `marquee-edge.svelte`/`scroller-button.svelte`). Depends on T011, T012.
- [X] T015 Implement `src/lib/components/ui/speed-dial/speed-dial-item.svelte` — registers its element
      into the content's `DomOrderedCollection` (or renders with `delay = 0`, `data-state="closed"` if
      no `SpeedDialContent` ancestor exists, research R-10); derives its stagger index from the shared
      `indexById` map and computes `--speed-dial-delay` via `getItemDelay`; `role="none"`;
      `data-slot="speed-dial-item"`, `data-state`, `data-side`; `--speed-dial-animation-duration:
      200ms`; provides `actionId`/`labelId` via `SpeedDialItemState` context for its `Action`/`Label`.
      Depends on T011, T014.
- [X] T016 [P] Implement `src/lib/components/ui/speed-dial/speed-dial-action.svelte` — composes
      `$lib/components/ui/button`; registers itself (with its `disabled` state) in the root's
      collection (FR-011); selection order: caller `onclick` → if not prevented, dispatch
      `speedDial.actionSelect` (bubbling, cancelable) with a one-shot listener calling `onSelect` → if
      neither prevents default, close the dial; `role="menuitem"`, `aria-labelledby={labelId}`,
      `id={actionId or own id prop}`; `data-slot="speed-dial-action"`;
      `size-11 shrink-0 rounded-full bg-accent shadow-md` + caller's `class`; requires both a
      `SpeedDial` and a `SpeedDialItem` ancestor (throws otherwise). Depends on T015.
- [X] T017 [P] Implement `src/lib/components/ui/speed-dial/speed-dial-label.svelte` — `id={labelId}`
      from `SpeedDialItemState` context; `data-slot="speed-dial-label"`;
      `pointer-events-none whitespace-nowrap rounded-md bg-popover px-2 py-1 text-sm
      text-popover-foreground shadow-md` + caller's `class`; requires a `SpeedDialItem` ancestor
      (throws otherwise). Depends on T015.

**Checkpoint**: All 6 parts + 2 runes modules exist. `speed-dial.test.ts` still cannot pass fully
because nothing imports them through a barrel yet — proceed to Phase 4.

---

## Phase 4: Barrel and types

- [X] T018 Create `src/lib/components/ui/speed-dial/index.ts` — import all six `.svelte` parts;
      re-export every constant/helper/variant/state-class/context-function/type listed in
      `contracts/public-api.md` §7 from `./speed-dial.svelte.js`, plus `DomOrderedCollection` from
      `./speed-dial-collection.svelte.js`; export each part's prop types (`SpeedDialProps`,
      `SpeedDialChildProps`, `SpeedDialTriggerProps`, `SpeedDialTriggerChildProps`,
      `SpeedDialContentProps`, `SpeedDialContentChildProps`, `SpeedDialInteractOutsideEvent`,
      `SpeedDialItemProps`, `SpeedDialItemChildProps`, `SpeedDialActionProps`,
      `SpeedDialActionChildProps`, `SpeedDialActionSelectEvent`, `SpeedDialLabelProps`,
      `SpeedDialLabelChildProps`); export short names (`Root`, `Trigger`, `Content`, `Item`, `Action`,
      `Label`) plus prefixed aliases (`SpeedDial`, `SpeedDialTrigger`, `SpeedDialContent`,
      `SpeedDialItem`, `SpeedDialAction`, `SpeedDialLabel`), matching
      `contracts/public-api.md` §8. Depends on T012, T013, T014, T015, T016, T017. Run
      `pnpm run test:unit -- --run speed-dial` afterward to confirm Phase 2's tests now pass.

**Checkpoint**: The full public surface is importable from one module; Phase 2's tests should now pass.

---

## Phase 5: Demo route

- [X] T019 Create `src/routes/docs/components/speed-dial/+page.svelte` with one `<ComponentPreview>`
      per upstream demo file — Default (`speed-dial-demo.tsx`), With Labels
      (`speed-dial-labels-demo.tsx`), Hover Mode (`speed-dial-hover-demo.tsx`), Controlled State
      (`speed-dial-controlled-demo.tsx`), Sides (`speed-dial-side-demo.tsx`, reproducing upstream's
      `grid grid-cols-2 gap-24` layout for the four overlapping dials) — plus the MDX's fixed-
      positioning guidance (root gets `class="fixed …"`, never the trigger) and the props /
      data-attribute / CSS-variable / keyboard tables from `speed-dial.mdx`. Demo state held in the
      page with runes; no `+page.ts`. Depends on T018.

**Checkpoint**: `pnpm run dev` shows a working `/docs/components/speed-dial` route with all 5 demos
interactive.

---

## Phase 6: Registry entry and docs polish

- [X] T020 Append the full `"speed-dial"` entry to the items array in `registry.json` (17th item):
      `registryDependencies: ["button"]`, `dependencies: ["tailwind-variants"]`, and `files` listing
      all 9 non-test files (`index.ts`, `speed-dial.svelte`, `speed-dial-trigger.svelte`,
      `speed-dial-content.svelte`, `speed-dial-item.svelte`, `speed-dial-action.svelte`,
      `speed-dial-label.svelte`, `speed-dial.svelte.ts`, `speed-dial-collection.svelte.ts`), each
      `type: "registry:ui"` — per `contracts/public-api.md` §9. Neither test file is listed. Depends on
      T018, T019.
- [X] T021 Run `pnpm run registry:build` and confirm `static/r/speed-dial.json` is generated with
      inlined file contents and `$lib/...` imports rewritten to registry placeholders. Depends on T020.

**Checkpoint**: The component is installable via the registry the same way as every other listed
component.

---

## Phase 7: Verification

**Purpose**: The feature is not complete until every quality gate is green with no suppression
(`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`,
deleted assertions, loosened configs — CLAUDE.md §1, Constitution Principle VII).

- [X] T022 Run `pnpm run format` (shadcn-style component output is not Prettier-formatted) and commit
      the resulting diff to the working tree (no git commands — the orchestrator owns the working
      tree).
- [X] T023 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`,
      and fix everything that fails.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately.
- **Tests (Phase 2)**: Depends on Setup. T003 (harness) has no dependency on T004-T009 but all of
  T004-T009 write to the same `speed-dial.test.ts` file, so none of them are `[P]` relative to each
  other.
- **Core component files (Phase 3)**: Depends on Phase 2 existing (tests are written first, per
  CLAUDE.md TDD framing), though implementation does not require the tests to already fail in CI.
  T010 (collection) blocks T011 (runes module) blocks T012 (Root) blocks T013/T014 (Trigger/Content,
  parallel) blocks T015 (Item) blocks T016/T017 (Action/Label, parallel).
- **Barrel and types (Phase 4)**: Depends on all of Phase 3 (T012-T017).
- **Demo route (Phase 5)**: Depends on Phase 4 (T018).
- **Registry entry and docs polish (Phase 6)**: Depends on Phase 4 and Phase 5 (T018, T019).
- **Verification (Phase 7)**: Depends on everything above — the last phase, always run.

### User Story Coverage

- **US1** (reveal/select/close, P1): T004, T006, T009 — independently verifiable once Phase 3-4 land.
- **US2** (keyboard-only operation, P1): T005 — independently verifiable once the keydown layer (T014)
  and node registrations (T013, T015/T016) land.
- **US3** (activation mode / side / labels / controlled, P2): T006, T007, T008 — independently
  verifiable once the hover timers (T013/T014), `side` helpers (T011) and label wiring (T015/T017)
  land.

### Parallel Opportunities

- T001 has no dependents and can run alongside T003.
- T003 can run alongside T004-T009 being drafted conceptually, but as a distinct file it is the only
  `[P]` task in Phase 2.
- T010 has no dependency and can start as soon as Phase 2 is underway.
- T013 and T014 (Trigger, Content) are both gated only on T011/T012 and touch different files — `[P]`.
- T016 and T017 (Action, Label) are both gated only on T015 and touch different files — `[P]`.

---

## Parallel Example: Phase 3

```bash
# After T010 (collection) and T011 (runes module) and T012 (Root) land:
Task: "Implement speed-dial-trigger.svelte" (T013)
Task: "Implement speed-dial-content.svelte" (T014)

# After T015 (Item) lands:
Task: "Implement speed-dial-action.svelte" (T016)
Task: "Implement speed-dial-label.svelte" (T017)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2's US1-relevant tests (T003, T004, T006 subset, T009).
2. Complete Phase 3 (all core files are shared — there is no US1-only subset of the component tree).
3. Complete Phase 4 (barrel) so T004/T006/T009 can pass.
4. **STOP and VALIDATE**: run `pnpm run test:unit -- --run speed-dial` and confirm the US1 assertions
   are green; demo/registry work can follow later.

### Incremental Delivery

1. Setup → Tests → Core → Barrel: the component is functionally complete and testable.
2. Add the Demo route (Phase 5): the component is now demonstrable in the docs app.
3. Add the Registry entry (Phase 6): the component is now installable like every other listed item.
4. Run Verification (Phase 7) last, always.

---

## Notes

- [P] tasks touch different files with no unmet dependency.
- [Story] labels trace Phase 2 test tasks back to spec.md's US1/US2/US3 for independent verification.
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X).
- Do NOT touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json` or `.port-logs/`.
- Do NOT run `shadcn-svelte add` — every base primitive this component composes
  (`$lib/components/ui/button`) is already installed.

---

## Phase 8: Convergence

**Purpose**: Close the gaps found by `/speckit-converge` between the implemented port and
`spec.md` / `plan.md` / `contracts/public-api.md`. The six parts, the two runes modules, the barrel,
the demo route and the registry entry are all in place and all 1014 unit tests pass; every item below
is a documented requirement whose behaviour ships but carries **no assertion**, or a documented
upstream surface with no counterpart. Adding a `[P]` marker is deliberate: T024-T031 all extend
`src/lib/components/ui/speed-dial/speed-dial.test.ts` (and, where noted, its harness), so they are
**not** parallel with each other.

- [X] T024 Add a test asserting the caller's `onmouseenter` / `onmouseleave` on
      `<SpeedDial.Content>` run **before** the part's own hover-close cancel/schedule and that
      `preventDefault()` suppresses them, per FR-010a — which names the content's mouse enter/leave
      explicitly alongside the trigger's and the root's. The trigger and root halves are covered
      (`speed-dial.test.ts:713-801`); the content half is not, and
      `src/lib/components/ui/speed-dial/speed-dial.test.svelte` exposes no
      `onContentMouseEnter`/`onContentMouseLeave` prop to drive it, so extend the harness first. Use
      `setupFakeTimers()` and an explicitly `cancelable` `MouseEvent`, as the existing trigger case
      does (`user-event` dispatches `mouseenter` non-cancelable). Per FR-010a (missing).
- [X] T025 Add a test asserting a caller-supplied `onclick` on `<SpeedDial.Action>` runs **before**
      the `speedDial.actionSelect` dispatch, and that calling `preventDefault()` in it suppresses
      both `onSelect` and the close — the selection order implemented in
      `speed-dial-action.svelte:78-103` and specified in `contracts/public-api.md` §5. Also assert
      the spec Edge Case in full: when `onSelect` calls `preventDefault()` the dial stays open **and
      the action's own `onclick` still ran** (the current case at `speed-dial.test.ts:339-354`
      asserts only the former). Add an `onActionClick`-style hook to `SpeedDialHarnessItem` in
      `speed-dial.test.svelte`. Per FR-010 / spec Edge Cases (missing).
- [X] T026 Add a test for the **trigger's own** `disabled` prop: with the root enabled and
      `<SpeedDial.Trigger disabled>`, the trigger is `toBeDisabled()`, clicking it fires no
      `onOpenChange`, hover activation is suppressed, and the trigger is excluded from
      `enabledNodeElements()` so `Shift+Tab` on the first action no longer closes the dial. FR-006
      requires the prop on the **root and the trigger**; only the root path is asserted today. The
      harness already declares `triggerDisabled` (`speed-dial.test.svelte:67`) and no test uses it.
      Per FR-006 (missing). **Correction:** this task's last clause was inverted. Dropping the
      trigger promotes the *first action* to the boundary, so `Shift+Tab` on it closes the dial in
      one step instead of the two an enabled trigger requires (research R-06) — which is what
      upstream does (`speed-dial.tsx:347` registers `disabled: isDisabled`; `674-676` filters
      disabled nodes). The test asserts the one-step close.
- [X] T027 Add a test that `ref` is bindable on all six parts and receives the rendered element
      (and stays `null` in `child` mode), per the "Conventions shared by every part" section of
      `contracts/public-api.md` and `plan.md`'s Testing section, which names `bind:ref` as one of the
      reasons the harness exists. `speed-dial.test.svelte` already binds `refs.root` / `refs.trigger`
      / `refs.content` and reports them through `onRefs` (lines 42-51, 146-154), but no test calls
      `onRefs` — the plumbing is currently dead. Extend it to the item, action and label. Per
      `plan.md` Testing / SC-002 (missing).
- [X] T028 Add a test for the second sentence of FR-004: clicking the trigger while a hover-open or
      hover-close timer is pending **cancels that timer** but does **not** disable hover activation
      for the rest of the component's life — hovering again after the click still opens the dial
      after `delay` ms. Implemented at `speed-dial-trigger.svelte:107-114`; no case exercises it.
      Drive it under `setupFakeTimers()`. Per FR-004 (missing).
- [X] T029 Strengthen the ARIA-wiring assertion: assert the trigger's `aria-controls` **resolves to
      the open content's `id`** (and equals `SpeedDial.Content`'s rendered `id`), not merely that the
      attribute is present. `speed-dial.test.ts:290` ports upstream's presence-only check; FR-013
      requires `aria-controls` *referencing the content*, and Constitution Principle III makes the
      APG menu-button wiring a MUST. Per FR-013 (partial).
- [X] T030 Extend the zero-items case (`speed-dial.test.ts:545-558`) to assert the empty container is
      still exposed as `screen.getByRole('menu')` with its `aria-orientation`, not just present by
      `data-testid`. The spec Edge Case is "opens to an empty, still-`role=\"menu\"` container without
      erroring"; the role half is unasserted. Per spec Edge Cases / FR-013 (partial).
- [X] T031 Add a test that a caller-supplied `style` on `<SpeedDial.Item>` overrides the
      component-set `--speed-dial-animation-duration` and `--speed-dial-delay`. FR-016a requires the
      caller's `style` to take precedence over **all five** custom properties; only the content's
      three are covered (`speed-dial.test.ts:1056-1063`). Add an `itemStyle` prop to
      `speed-dial.test.svelte`. Per FR-016a (partial).
- [X] T032 Add tests for the remaining documented-but-unasserted part props from
      `contracts/public-api.md` §2/§5: `<SpeedDial.Trigger id>` and `<SpeedDial.Action id>` override
      the generated ids (and the action's `aria-labelledby` still resolves to its label), and
      `variant`/`size` are forwarded to the composed `Button` on both parts. SC-002 requires a
      passing test for every documented prop. Per SC-002 / `contracts/public-api.md` §2, §5
      (missing).
- [X] T033 Record the one uncovered upstream CSS-variable row: the upstream MDX
      (`speed-dial.mdx:260-275`) lists `--speed-dial-transform-origin` on **`SpeedDialItem`** as well
      as on `SpeedDialContent`, but the upstream source never sets it on the item
      (`speed-dial.tsx:908-915` writes only the duration and the delay), and neither does this port.
      Add the divergence to the CSS-variables table in
      `src/routes/docs/components/speed-dial/+page.svelte` (a "documented upstream, not emitted —
      matches the upstream source" row) so the docs page stays the honest contract. Docs only — do
      **not** invent the variable on the item, which would add behaviour upstream does not have
      (Constitution Principle II). Per Constitution II / FR-016a (missing).

**Checkpoint**: re-run `pnpm run format`, `pnpm run check`, `pnpm run lint`,
`pnpm run test:unit -- --run` and `pnpm run build`. No suppression, no `.skip`/`.todo`, no loosened
config — the new assertions must pass against the **existing** implementation. If one of them fails,
the implementation is wrong and the implementation is what gets fixed (T024-T032 are all assertions
about behaviour that is already specified and already shipped).
