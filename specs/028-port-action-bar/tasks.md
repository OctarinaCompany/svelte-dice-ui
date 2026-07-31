---
description: 'Task list for the Action Bar port'
---

# Tasks: Action Bar

**Input**: Design documents from `/specs/028-port-action-bar/` (plan.md, spec.md, research.md,
data-model.md, contracts/public-api.md, contracts/keyboard-map.md, quickstart.md)

**Tests**: Mandatory (constitution Principle III / VII). Colocated at
`src/lib/components/ui/action-bar/action-bar.test.ts`, with a `.test.svelte` render harness for
snippets, bindings and provider-less renders.

**Organization**: Phase order is Setup → Tests → Core component files → Barrel and types → Demo
route → Registry entry and docs polish → Verification, per the request for this feature. `[Story]`
tags (US1/US2/US3, from spec.md priorities) are carried on tasks where they aid traceability even
though the phases themselves are not per-story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Traceability to spec.md User Story 1/2/3 where applicable
- Every task names an exact file path

---

## Phase 1: Setup

**Purpose**: Confirm the dependency surface and stage the registry entry before any code exists.

- [X] T001 [P] Verify `package.json` already declares every dependency this port needs
      (`bits-ui` ^2.18.1, `tailwind-variants` ^3.3.0, `@lucide/svelte` ^1.27.0) and that
      `src/app.css` already imports `tw-animate-css`; confirm **zero new npm packages** are
      required (plan.md "Constraints"). No file changes — this is a go/no-go check before writing
      code.
- [X] T002 Create the component directory `src/lib/components/ui/action-bar/` and append a stub
      entry named `"action-bar"` to `registry.json` (`type: "registry:ui"`, `title`, `description`,
      `registryDependencies: ["button", "direction-provider", "speed-dial"]`,
      `dependencies: ["bits-ui", "tailwind-variants"]`, `files: []` — populated for real in T027).

**Checkpoint**: Directory exists, registry stub is in place, dependency surface confirmed.

---

## Phase 2: Tests

**Purpose**: Write the full colocated test suite against the contracts in
`contracts/public-api.md` and `contracts/keyboard-map.md` before any implementation file exists,
per Principle III. All tasks in this phase touch the same two files, so none is `[P]`.

- [X] T003 Create the render harness `src/lib/components/ui/action-bar/action-bar.test.svelte`
      exposing snippet children (selection pill, group with items, close, separator) and bindable
      `open`/`value`-style props so `action-bar.test.ts` can render provider-wrapped and
      provider-less trees without inline snippet authoring in the spec file.
- [X] T004 [US1] Write accessibility roles-and-names tests in
      `src/lib/components/ui/action-bar/action-bar.test.ts`: `role="toolbar"` + `aria-orientation`
      on the root, `dir` attribute reflection, `role="group"` on `ActionBarGroup`,
      `role="separator"` + `aria-hidden="true"` on `ActionBarSeparator`, and
      `data-slot`/`data-side`/`data-align`/`data-orientation` on every part per
      `contracts/public-api.md`, and that `ActionBarClose` exposes an accessible name
      (`screen.getByRole('button', { name: /close/i })`) even when its only child is an icon
      (SC-006, constitution Principle III). Depends on T003.
- [X] T005 [US1] Write controlled-vs-uncontrolled state tests in the same file: `defaultOpen` seeds
      an uncontrolled bar and internal activation (`ActionBarItem` select, `ActionBarClose`,
      `Escape`) updates it; passing `open` makes the parent authoritative, `onOpenChange` fires with
      the next value, and the bar never moves on its own when the callback is not invoked (FR-002).
      Depends on T004.
- [X] T006 [US3] Write keyboard-interaction tests (LTR) in the same file, driven by
      `@testing-library/user-event`, covering every row of `contracts/keyboard-map.md`: `Tab`/
      `Shift+Tab` treating the group as one stop then moving to `ActionBarClose`, `ArrowRight`/
      `ArrowLeft` (horizontal) and `ArrowDown`/`ArrowUp` (vertical) moving between enabled items
      with `loop` wrap/stop, `Home`/`End` jumping to first/last enabled item, disabled-item
      skipping, `Escape` invoking `onEscapeKeyDown` then closing unless prevented, `Enter` and
      `Space` activating an item through native button semantics so `onSelect` fires and the bar
      closes (research R-13), any arrow held with `Meta`/`Ctrl`/`Alt`/`Shift` performing no
      navigation and no `preventDefault()` (research R-10 step 5), wrong-axis arrows being a no-op
      (`ArrowUp`/`ArrowDown` in horizontal, `ArrowLeft`/`ArrowRight` in vertical), and `mousedown`
      on a disabled item calling `preventDefault()` and leaving the current tab stop unchanged.
      Depends on T005.
- [X] T007 [US3] Write RTL-inversion tests in the same file: with `dir="rtl"`, `ArrowLeft`/
      `ArrowRight` invert relative to the LTR cases in T006, reusing the same group/item fixture.
      Also render one RTL case through a `DirectionProvider dir="rtl"` ancestor with no explicit
      `dir` prop on `ActionBar`, asserting the same arrow inversion and the root's reflected `dir`
      attribute (FR-005, research R-15). Depends on T006.
- [X] T008 [US1] Write edge-case tests in the same file: action bar renders nothing while closed
      (no DOM node, no portal), by default the toolbar mounts as a descendant of `document.body`
      outside the testing-library render container, `portalContainer` = a custom element mounts the
      toolbar inside that element, `portalContainer={null}` still renders into `document.body`
      (contracts/keyboard-map.md §Portal), `preventDefault()` inside `onSelect` keeps the bar open,
      `preventDefault()` inside `ActionBarClose`'s click handler or `onEscapeKeyDown` leaves `open`
      unchanged, a group with no focusable items is not a tab stop (`tabindex="-1"`), tabbing out of
      the group with `Shift+Tab` then back in re-enters via a fresh keyboard entry, rendering
      `ActionBarGroup`/`ActionBarItem`/`ActionBarClose`/`ActionBarSeparator` outside `ActionBar`
      throws a descriptive error naming the part and `ActionBar` (`expect(() =>
      render(...)).toThrow(/within/)`), and rendering `ActionBarItem` inside an `ActionBar` but
      outside an `ActionBarGroup` throws an error naming `<ActionBar.Item>` and `<ActionBar.Group>`
      (research R-14, contracts/keyboard-map.md guard-rail row 3). Depends on T007.
- [X] T008a [US2] Write positioning tests in
      `src/lib/components/ui/action-bar/action-bar.test.ts` covering every row of
      `contracts/keyboard-map.md` §Positioning: defaults produce `bottom: 16px; left: 50%;
      translate: -50% 0`; `side="top"` produces `top: 16px`; `align="start"` + `alignOffset={24}`
      produces `left: 24px` with no `translate`; `align="end"` + `alignOffset={24}` produces
      `right: 24px`; `sideOffset={0}` produces `bottom: 0px`; and a caller-supplied `style` wins
      because it is applied last (FR-003, US2-1, US2-2). Also assert the vertical layout classes on
      the group and items for `orientation="vertical"` (FR-004, US2-3). Depends on T008.
- [X] T008b [US3] Write pure-helper unit tests in
      `src/lib/components/ui/action-bar/action-bar.test.ts` for the shared modules (FR-016), one
      `describe` per row of `contracts/keyboard-map.md` §"Pure-helper unit assertions":
      `getViewportEdgeStyle` (one case per Positioning row), `getDirectionAwareKey` (swaps only the
      two horizontal arrows, only under `rtl`), `wrapArray` (order-preserving, total, `startIndex`
      beyond length wraps modulo), `getFocusIntent` (full key x orientation x dir truth table,
      `undefined` for unrelated keys) and `focusFirst` (skips a detached candidate, no-op when the
      active element is already a candidate). Import them from
      `$lib/components/ui/action-bar/index.js` so the FR-016 reuse surface is proven, not just the
      module-internal names. Depends on T008a.

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/action-bar/action-bar.test.ts`
errors on the unresolved `./index.js` import until Phase 4; that is expected. The suite is complete
when it lists every behaviour above.

---

## Phase 3: Core component files

**Purpose**: Implement the two reusable shared modules first (FR-016), then the portal host and
root state, then the six parts, per `plan.md` "Project Structure".

- [X] T009 [P] [US2] Implement
      `src/lib/components/ui/action-bar/action-bar-floating.svelte.ts`: `getViewportEdgeStyle`
      (viewport-edge inline style for `side`/`sideOffset`/`align`/`alignOffset`),
      `floatingSurfaceVariants` (the `tv()` enter/exit + `motion-reduce:animate-none` recipe),
      `EscapeDismissState` (document-level `keydown` listener class with teardown),
      `FLOATING_SIDES`, `FLOATING_ALIGNMENTS`, `DEFAULT_SIDE_OFFSET`, and the `FloatingSide` /
      `FloatingAlign` / `FloatingOrientation` types. Must import nothing from any `action-bar-*`
      part file (data-model.md dependency direction: parts → shared modules only).
- [X] T010 [P] [US3] Implement
      `src/lib/components/ui/action-bar/action-bar-roving-focus.svelte.ts`: `RovingFocusGroupState`
      (WAI-ARIA Toolbar roving-tabindex state class built on `speed-dial`'s exported
      `DomOrderedCollection` from `src/lib/components/ui/speed-dial/speed-dial-collection.svelte.ts`
      for the document-ordered item registry), plus the pure helpers `focusFirst`, `wrapArray`,
      `getDirectionAwareKey`, `getFocusIntent`, and `setRovingFocusContext`/
      `getRovingFocusContext`, and the `RovingFocusIntent` / `RovingFocusItemMeta` types. Must
      import nothing from any `action-bar-*` part file.
- [X] T011 [P] [US1] Implement
      `src/lib/components/ui/action-bar/action-bar-portal.svelte`: delegates to `bits-ui`'s
      `Portal` for every `Element`/`string` target, and for a `DocumentFragment` target appends a
      `display: contents` host element to the fragment and portals into that host instead (`to?:
      Element | DocumentFragment | string | null`, `children`), per plan.md justification 4.
- [X] T012 [US1] Implement `src/lib/components/ui/action-bar/action-bar.svelte.ts`: the root state
      class (open/side/align/offsets/orientation/loop/dir), the Symbol context key with throwing
      `setActionBarContext`/`getActionBarContext` (naming `ActionBar` as the required ancestor per
      §5 of CLAUDE.md), the `actionbar.itemSelect` / `actionbarFocusGroup.onEntryFocus` event-name
      constants, and any root-level `tv()` recipes not already in `action-bar-floating.svelte.ts`.
      Depends on T009, T010 (composes their exported state/variants).
- [X] T013 [US1] Implement `src/lib/components/ui/action-bar/action-bar.svelte` (Root): renders
      nothing while closed; when open, renders `ActionBarPortal` around a `role="toolbar"` `<div>`
      using `getViewportEdgeStyle`/`floatingSurfaceVariants` from T009, wires `EscapeDismissState`,
      resolves `dir` from an explicit prop or `direction-provider`'s `useDirection()`
      (`src/lib/components/ui/direction-provider/index.ts`), and calls
      `setActionBarContext`/`setRovingFocusContext` scaffolding needed by descendants. Props,
      snippets (`children`, `child`) and data attributes per `contracts/public-api.md` § `ActionBar`.
      Depends on T011, T012.
- [X] T014 [P] [US1] Implement
      `src/lib/components/ui/action-bar/action-bar-selection.svelte` (`ActionBarSelection`):
      presentational pill, `data-slot="action-bar-selection"`, no extra props beyond the common set,
      accepts the common `child` snippet per contracts/public-api.md §"Common to every part".
      Depends on T012 only for the shared `tv()` recipes; `ActionBarSelection` MUST NOT consume the
      root context and MUST NOT throw when rendered outside `ActionBar` (upstream
      action-bar.tsx:237-252, FR-014 excludes it).
- [X] T015 [P] [US3] Implement `src/lib/components/ui/action-bar/action-bar-group.svelte`
      (`ActionBarGroup`): `role="group"`, `data-slot="action-bar-group"`, `data-orientation`,
      instantiates and provides `RovingFocusGroupState` from T010, roving `tabindex` (`0`/`-1`),
      `onfocusin`/`onfocusout`/`onmousedown` handling that forwards the caller's handlers first and
      early-returns on `defaultPrevented`, and dispatches the cancelable
      `actionbarFocusGroup.onEntryFocus` event on entry. Accepts the common `child` snippet per
      contracts/public-api.md §"Common to every part". Throws when rendered outside `ActionBar`
      (T012). Depends on T010, T012.
- [X] T016 [US1] Implement `src/lib/components/ui/action-bar/action-bar-item.svelte`
      (`ActionBarItem`): composes `$lib/components/ui/button` (`variant="secondary"`, `size="sm"`
      defaults, both overridable), registers with the enclosing group's `RovingFocusGroupState`
      (T015) via `getRovingFocusContext`, exposes `disabled` and `onSelect`, dispatches the
      bubbling cancelable `actionbar.itemSelect` `CustomEvent` (mirroring
      `speed-dial-action.svelte`'s `speedDial.actionSelect` pattern) and closes the bar via the
      root context unless `preventDefault()` is called. `data-slot="action-bar-item"`, roving
      `tabindex`, accepts the common `child` snippet per contracts/public-api.md §"Common to every
      part". Throws when rendered outside `ActionBar`, and throws naming `<ActionBar.Group>` when
      rendered inside `ActionBar` but outside `ActionBarGroup` (research R-14). Depends on T012,
      T015.
- [X] T017 [P] [US1] Implement `src/lib/components/ui/action-bar/action-bar-close.svelte`
      (`ActionBarClose`): plain `<button type="button">` with its own independent tab stop (not
      registered with the roving-focus group), calls the caller's `onclick` first, then
      `onOpenChange(false)` via the root context unless prevented. `data-slot="action-bar-close"`,
      accepts the common `child` snippet per contracts/public-api.md §"Common to every part".
      Throws when rendered outside `ActionBar`. Depends on T012.
- [X] T018 [P] [US2] Implement `src/lib/components/ui/action-bar/action-bar-separator.svelte`
      (`ActionBarSeparator`): `role="separator"`, `aria-hidden="true"`, `aria-orientation`,
      `orientation` prop defaulting to the root's orientation via context, adapts rendered
      dimension for horizontal vs vertical groups. `data-slot="action-bar-separator"`, accepts the
      common `child` snippet per contracts/public-api.md §"Common to every part". Throws when
      rendered outside `ActionBar`. Depends on T012.

**Checkpoint**: Every part file and both shared modules exist; `action-bar.test.ts` from Phase 2
now has real implementations to run against (still wired through the barrel in Phase 4).

---

## Phase 4: Barrel and types

- [X] T019 Create/update `src/lib/components/ui/action-bar/index.ts`: import and re-export every
      part (`Root`, `Selection`, `Group`, `Item`, `Close`, `Separator`, `Portal`) under both short
      and `ActionBar`-prefixed names, `export type` every part's `Props` type, and re-export the
      shared, component-agnostic names required by quickstart.md §5 for `selection-toolbar`:
      `getViewportEdgeStyle`, `floatingSurfaceVariants`, `EscapeDismissState`, `FLOATING_SIDES`,
      `FLOATING_ALIGNMENTS`, `DEFAULT_SIDE_OFFSET`, `FloatingSide`/`FloatingAlign`/
      `FloatingOrientation` types (from T009), and `RovingFocusGroupState`, `focusFirst`,
      `wrapArray`, `getDirectionAwareKey`, `getFocusIntent`, `setRovingFocusContext`,
      `getRovingFocusContext`, `RovingFocusIntent`/`RovingFocusItemMeta` types (from T010). Depends
      on T013, T014, T015, T016, T017, T018.

**Checkpoint**: `import * as ActionBar from '$lib/components/ui/action-bar/index.js'` and the named
import style both type-check; run
`pnpm run test:unit -- --run src/lib/components/ui/action-bar/action-bar.test.ts` and confirm every
test from Phase 2 now passes.

---

## Phase 5: Demo route

- [X] T020 [US1] Create `src/routes/docs/components/action-bar/+page.svelte` with a
      `<ComponentPreview title="Default" description="Mirrors action-bar-demo.tsx.">` section:
      selectable task list, `ActionBar.Root` bound to `selection.size > 0`, `ActionBar.Selection`
      showing the count, `ActionBar.Separator`, `ActionBar.Group` with Duplicate/Delete
      `ActionBar.Item`s, and `ActionBar.Close` — matching
      `.reference/diceui/docs/registry/bases/radix/examples/action-bar-demo.tsx`. The close control
      must carry a visually hidden label (`<span class="sr-only">Close</span>`) beside the `X` icon
      so the icon-only button has an accessible name (SC-006).
- [X] T021 [US2] Add a second `<ComponentPreview title="Position" description="Mirrors
      action-bar-position-demo.tsx.">` section to the same
      `src/routes/docs/components/action-bar/+page.svelte`, with a toggle to open the bar and
      controls for `side` (`top`/`bottom`) and `align` (`start`/`center`/`end`), matching
      `.reference/diceui/docs/registry/bases/radix/examples/action-bar-position-demo.tsx`. The close
      control must carry the same `<span class="sr-only">Close</span>` label as T020 so the
      icon-only button has an accessible name (SC-006). Depends on T020 (same file).
- [X] T022 Add the six props tables (root, selection, group, item, close, separator) to
      `src/routes/docs/components/action-bar/+page.svelte` below the two preview sections, sourced
      from `contracts/public-api.md`. Depends on T021 (same file).

**Checkpoint**: `/docs/components/action-bar` renders both upstream examples end to end.

---

## Phase 6: Registry entry and docs polish

- [X] T023 Replace the `files: []` stub in `registry.json` (T002) with the eleven non-test files listed
      in plan.md "Project Structure" (`index.ts`, `action-bar.svelte`,
      `action-bar-selection.svelte`, `action-bar-group.svelte`, `action-bar-item.svelte`,
      `action-bar-close.svelte`, `action-bar-separator.svelte`, `action-bar-portal.svelte`,
      `action-bar.svelte.ts`, `action-bar-floating.svelte.ts`, `action-bar-roving-focus.svelte.ts`),
      each with `"type": "registry:ui"`; keep `registryDependencies: ["button",
      "direction-provider", "speed-dial"]` and `dependencies: ["bits-ui", "tailwind-variants"]`.
      Neither test file (`action-bar.test.ts`, `action-bar.test.svelte`) may appear. Depends on
      T019.
- [X] T024 Run `pnpm run registry:build` and confirm `static/r/action-bar.json` is produced with the
      files and dependencies from T023. Depends on T023.

**Checkpoint**: The component installs into a fresh consumer project through the registry with no
manual follow-up (SC-005).

---

## Phase 7: Verification

- [X] T025 Run `pnpm run format` (shadcn/generator-style output is not Prettier-formatted) so every
      file touched in Phases 2-6 is Prettier-clean before the `lint` gate. Do NOT run any git write
      command — `scripts/port-components.ps1` owns the working tree and commits it (Principle X).
- [X] T026 run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`,
      and fix everything that fails.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Tests (Phase 2)**: Depends on Setup (needs the directory from T002). All tasks share
  `action-bar.test.ts`/`action-bar.test.svelte`, so they run strictly in sequence
  (T003 → T004 → T005 → T006 → T007 → T008 → T008a → T008b).
- **Core component files (Phase 3)**: Depends on Tests existing (Phase 2) so implementation has a
  failing suite to satisfy. Internally: shared modules (T009, T010) and the portal (T011) first and
  in parallel; then root state (T012); then root markup (T013) and the four leaf parts (T014, T017,
  T018 in parallel, T015 in parallel with those, then T016 after T015).
- **Barrel and types (Phase 4)**: Depends on every Phase 3 task (T009–T018).
- **Demo route (Phase 5)**: Depends on Phase 4 (imports the barrel). T020 → T021 → T022 are
  sequential (same file).
- **Registry entry and docs polish (Phase 6)**: Depends on Phase 4 (T023 lists the barrel/parts) and
  benefits from Phase 5 being done first for a complete manual walkthrough, but only strictly needs
  T019. T024 depends on T023.
- **Verification (Phase 7)**: Depends on everything above. Always the last phase.

### Parallel Opportunities

- T001 has no file writes and can run alongside T002's directory/stub creation.
- T009 (`action-bar-floating.svelte.ts`), T010 (`action-bar-roving-focus.svelte.ts`) and T011
  (`action-bar-portal.svelte`) touch three different files with no cross-dependency — run together.
- T014 (`action-bar-selection.svelte`), T015 (`action-bar-group.svelte`), T017
  (`action-bar-close.svelte`) and T018 (`action-bar-separator.svelte`) touch four different files
  and only depend on T012 — run together; start T016 (`action-bar-item.svelte`) once T015 lands.

---

## Parallel Example: Phase 3 shared modules

```bash
Task: "Implement action-bar-floating.svelte.ts (T009)"
Task: "Implement action-bar-roving-focus.svelte.ts (T010)"
Task: "Implement action-bar-portal.svelte (T011)"
```

## Parallel Example: Phase 3 leaf parts

```bash
Task: "Implement action-bar-selection.svelte (T014)"
Task: "Implement action-bar-group.svelte (T015)"
Task: "Implement action-bar-close.svelte (T017)"
Task: "Implement action-bar-separator.svelte (T018)"
```

---

## Implementation Strategy

1. Complete Phase 1 (Setup) and Phase 2 (Tests) — the suite fails red, listing every documented
   behaviour.
2. Complete Phase 3 (Core) in dependency order — shared modules and portal first, then root, then
   parts — turning the suite green incrementally.
3. Complete Phase 4 (Barrel) — full suite green, both import styles type-check.
4. Complete Phase 5 (Demo route) and Phase 6 (Registry) — visual/manual proof and installability.
5. Complete Phase 7 (Verification) — all four quality gates green, nothing suppressed.

## Notes

- [P] tasks touch different files with no unmet dependency.
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X).
- No suppressions of any kind (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`,
  `as any`, `.skip`/`.todo`) may be used to reach green in Phase 7 — fix the root cause.
</content>

---

## Phase 8: Convergence

**Purpose**: Close the gaps found by `/speckit-converge` between the implemented port and its spec,
plan and contracts. The component source, demo route and registry entry are complete and all four
quality gates are green; every item below is a documented behaviour that ships without an assertion,
so all of them land in `src/lib/components/ui/action-bar/action-bar.test.ts` (extending
`action-bar.test.svelte` where a new render path is needed). No application code may be changed to
satisfy these tasks — if a test fails, the implementation is wrong and gets fixed at the root.

- [X] T027 Assert the group's entry-focus contract in
      `src/lib/components/ui/action-bar/action-bar.test.ts`: focusing the group from the keyboard
      dispatches a cancelable, non-bubbling `actionbarFocusGroup.onEntryFocus`
      (`ACTION_BAR_ENTRY_FOCUS`) `CustomEvent` on the group element before focus is redirected;
      calling `preventDefault()` on that event leaves focus on the group and moves it to no item; and
      a `mousedown` on the group before focus lands (the `isClickFocus` branch) suppresses the entry
      redirect entirely, with the flag cleared afterwards so the next keyboard entry redirects again.
      Add whatever listener wiring the harness needs per contracts/public-api.md §`ActionBarGroup`
      (`action-bar-group.svelte`, `action-bar-roving-focus.svelte.ts` `onGroupFocusIn`)
      per contracts/public-api.md §ActionBarGroup / SC-003 (partial)
- [X] T028 Assert caller-handler forwarding and the `defaultPrevented` early-return on both the group
      and the item in `src/lib/components/ui/action-bar/action-bar.test.ts`, using the harness's
      existing `onGroupFocusIn`/`onGroupFocusOut`/`onGroupMouseDown` props (currently declared but
      never exercised) and new item-level `onfocus`/`onkeydown`/`onmousedown` caller props on
      `ActionBarHarnessItem`: each caller handler runs before the component's own behaviour, and a
      caller that calls `preventDefault()` suppresses it — no entry-focus redirect, no
      `isTabbingBackOut` reset, no click-focus flag, no tab-stop update, and no arrow navigation
      per contracts/public-api.md §ActionBarGroup and §ActionBarItem "Handled events" / SC-003 (partial)
- [X] T029 Assert `ActionBarItem`'s button composition in
      `src/lib/components/ui/action-bar/action-bar.test.ts`: an item with no `variant`/`size` renders
      the `secondary` + `sm` `buttonVariants()` classes, and a caller-supplied `variant`
      (e.g. `destructive`, already reachable through `ActionBarHarnessItem.variant`) and `size`
      replace them while `data-slot="action-bar-item"`, the roving `tabindex` and the vertical
      `w-full` stretch are unaffected per FR-011 / SC-003 (partial)
- [X] T030 Assert the enter transition and reduced-motion behaviour in
      `src/lib/components/ui/action-bar/action-bar.test.ts`: the open root carries the enter classes
      (`animate-in`, `fade-in-0`, `zoom-in-95`, the `data-[side=…]:slide-in-from-…` pair) and
      `motion-reduce:animate-none`, and the exported `floatingSurfaceVariants` recipe (imported from
      `$lib/components/ui/action-bar/index.js`, the FR-016 reuse surface) contains both the enter and
      the exit (`data-[state=closed]:animate-out …`) halves so a consumer that keeps the surface
      mounted while closing gets a real exit animation per FR-008 (partial)
- [X] T031 Assert the CSS-selector portal target in
      `src/lib/components/ui/action-bar/action-bar.test.ts`: rendering with
      `portalContainer="#action-bar-host"` against an element appended to `document.body` mounts the
      toolbar inside that element, proving the documented `string` divergence over upstream's
      `Element | DocumentFragment | null` per spec Assumptions (`portalContainer` accepts a CSS
      selector) / contracts/public-api.md §ActionBar (partial)
- [X] T032 Assert that `ActionBarSelection` is the one part with no provider requirement: add a
      `bare-selection` mode to `src/lib/components/ui/action-bar/action-bar.test.svelte` and a spec in
      `src/lib/components/ui/action-bar/action-bar.test.ts` rendering it with no `<ActionBar>`
      ancestor, expecting no throw and a `data-slot="action-bar-selection"` element carrying its
      children — the deliberate exclusion from the FR-014 guard rails that the demo page documents
      per FR-014 / T014 (partial)

**Checkpoint**: `pnpm run format`, `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run`
and `pnpm run build` are all green again, with no suppression and no change to component source
unless a new assertion exposed a genuine implementation defect.
