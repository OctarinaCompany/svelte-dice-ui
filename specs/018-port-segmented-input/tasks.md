---
description: 'Task list for the Segmented Input port'
---

# Tasks: Segmented Input

**Input**: Design documents from `/specs/018-port-segmented-input/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/public-api.md](./contracts/public-api.md), [quickstart.md](./quickstart.md)

**Tests**: MANDATORY (Constitution Principle III / CLAUDE.md §7). No upstream test file exists for
this component (research.md preamble), so the suite is derived from the MDX contract, the `types/`
JSDoc, and quickstart.md's V-1…V-46 validation scenarios.

**Organization**: Phase order is fixed to Setup → Tests → Core component files → Barrel and types →
Demo route → Registry entry and docs polish → Verification (component-specific requirement for this
port), with `[US1]`/`[US2]`/`[US3]` story labels retained on every task traceable to one story for
independent-test purposes.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps the task to spec.md's User Story 1 (connected fields), 2 (keyboard segment
  navigation), or 3 (paste distribution) for traceability. Tasks with no label are cross-cutting or
  foundational — they serve all three stories at once (e.g. a shared file, a shared module) and
  cannot be meaningfully attributed to one.

## Path Conventions

- Component source: `src/lib/components/ui/segmented-input/`
- Colocated tests: `src/lib/components/ui/segmented-input/segmented-input.test.ts` and
  `segmented-input.test.svelte`
- Demo route: `src/routes/docs/components/segmented-input/+page.svelte`
- Registry: `registry.json` at the repository root

---

## Phase 1: Setup (dependencies, registry stub)

**Purpose**: Confirm the dependency graph and scaffold the empty locations every later task writes
into.

- [X] T001 Verify `tailwind-variants` is already present in `package.json` and that `input`,
      `direction-provider`, `speed-dial` already exist under `src/lib/components/ui/`
      (research.md R-16) — confirm no `pnpm add` is required for this port.
- [X] T002 [P] Create the empty directories `src/lib/components/ui/segmented-input/` and
      `src/routes/docs/components/segmented-input/` so subsequent tasks have somewhere to write.
- [X] T003 Add the `segmented-input` stub entry to the top-level `registry.json` `items` array —
      `name`, `type: "registry:ui"`, `title`, `description`, `registryDependencies: ["input",
      "direction-provider", "speed-dial"]`, `dependencies: ["tailwind-variants"]`, and the `files`
      array listing all 5 eventual non-test paths (index.ts, segmented-input.svelte,
      segmented-input-item.svelte, segmented-input.svelte.ts, segment-navigation.svelte.ts) per
      contracts/public-api.md §7. The files do not need to exist yet.

**Checkpoint**: Directory structure and registry stub exist; every later task has a home.

---

## Phase 2: Tests (write first — MUST fail before implementation)

**Purpose**: Encode quickstart.md's V-1…V-46 as executable tests against code that does not exist
yet, per Constitution Principle III / VII.

- [X] T004 [P] Create the prop-driven test harness component
      `src/lib/components/ui/segmented-input/segmented-input.test.svelte` (the
      `direction-provider`/`checkbox-group` precedent) supporting: snippet children, `bind:value`
      and function-binding value props, `bind:ref` on root and item, conditional item rendering (to
      exercise position re-derivation), the `child` snippet on both root and item, and a
      provider-less item render path for the guard-rail test.
- [X] T005 [P] Create `src/lib/components/ui/segmented-input/segmented-input.test.ts` and write the
      standalone pure-helper tests: `resolveSegmentPosition` over the full index/count matrix
      including `index === -1`, `resolveSegmentIntent` over the full key × orientation × direction
      matrix from contracts/public-api.md §5 including the `null` cases, and `splitPastedValue`
      against every row of research.md R-10's worked-example table plus `""`, whitespace-only, and
      more-parts-than-segments (V-43–V-45). Import only the not-yet-created
      `segment-navigation.svelte.js` module — this test intentionally fails until Phase 3.
- [X] T006 [US1] In `segmented-input.test.ts`, add accessibility/roles/structure tests: `role="group"`
      + `aria-orientation` (default and vertical), `data-slot` on both parts, items reachable via
      `getByRole('textbox', { name })`, native attribute passthrough (`placeholder`, `maxlength`,
      `inputmode`, `pattern`, `min`, `max`), position auto-assignment (`isolated`/`first`/`middle`/
      `last`, explicit-position override, re-derivation after conditional rendering, disabled item
      still occupying its index) — every `data-position` assertion MUST `await tick()` (from
      `svelte`) first, because registration happens in an `$effect` and the attribute reads
      `"isolated"` on the first frame (divergence D-02, research.md R-02); never relax the
      expected value to accommodate the unflushed state —, size classes for `sm`/`default`/`lg`, and group-level
      `disabled`/`invalid`/`required` inheritance with per-item override rules (V-1–V-14).
- [X] T007 [US1] In `segmented-input.test.ts`, add controlled/uncontrolled tests: an uncontrolled
      item accepts typing and reports it via `oninput`; `bind:value` reflects typing in both
      directions; a function-binding `bind:value={get, set}` whose `set` rejects the write keeps the
      rendered value pinned (V-36–V-38).
- [X] T008 [US2] In `segmented-input.test.ts`, add keyboard-interaction tests: `Tab`/`Shift+Tab`
      document-order traversal; horizontal LTR `ArrowRight`/`ArrowLeft` movement and no-wraparound at
      the edges; vertical `ArrowUp`/`ArrowDown` movement with horizontal arrows inert (and vice
      versa); `Home`/`End` from any item in both orientations; arrow navigation skipping a disabled
      middle item; the caret-boundary guard (D-07) leaving mid-text caret movement to the browser; and
      a caller `onkeydown` that calls `preventDefault()` suppressing segment navigation entirely
      (V-15–V-23).
- [X] T009 [US2] In `segmented-input.test.ts`, add RTL tests: `dir="rtl"` on the root inverts
      `ArrowLeft`/`ArrowRight`; a root with no `dir` prop nested under a `rtl` `DirectionProvider`
      resolves to `rtl` and the root's own `dir` attribute reflects it; an explicit `dir="ltr"` on the
      root wins over a surrounding `rtl` provider; vertical `ArrowUp`/`ArrowDown` are unaffected by
      direction (V-24–V-27).
- [X] T010 [US3] In `segmented-input.test.ts`, add paste-distribution tests: a three-part paste
      landing on the first item fills all three and moves focus to the last; a paste on a middle item
      leaves earlier items untouched and discards overflow parts; fewer parts than remaining segments
      leaves the surplus segments unchanged; `maxlength`-driven splitting (the phone-demo shape); a
      `readonly`/`disabled` segment in the path is skipped and distribution continues past it; a
      single-part paste is left to the browser (no `preventDefault`); a caller `onpaste` that calls
      `preventDefault()` suppresses distribution entirely; distribution fires `oninput` on every
      written segment and respects an authoritative function binding that rejects the write
      (V-28–V-35).
- [X] T011 In `segmented-input.test.ts`, add the remaining cross-cutting tests: the root's `child`
      snippet renders the caller's element with the full merged payload and no default `<div>`
      appears; the item's `child` snippet likewise with `data-position`; `bind:ref` yields the `<div>`
      on the root and the `<input>` on the item; rendering `SegmentedInputItem` outside a
      `SegmentedInput.Root` throws matching `/within/` and names both parts; and a standalone
      `SegmentNavigation` instance driving focus over hand-registered `<input>` elements with no
      `<SegmentedInput>` markup anywhere, proving the module Time Picker will import works
      unattached (V-39–V-42, V-46).

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/segmented-input/segmented-input.test.ts`
fails (module-not-found / assertion failures) — expected, since no implementation exists yet.

---

## Phase 3: Core component files

**Purpose**: Implement the four source modules in their dependency order (plan.md "Implementation
sequence" 1–4).

- [X] T012 Implement `src/lib/components/ui/segmented-input/segment-navigation.svelte.ts`: the pure
      exported helpers `resolveSegmentPosition`, `resolveSegmentIntent`, `splitPastedValue`, plus
      `SEGMENT_POSITIONS`/`SEGMENT_ORIENTATIONS` and their types, then the `SegmentEntryMeta` type and
      the `SegmentNavigation` class (`register`/`unregister`/`indexOf`/`positionOf`/`focusAt`/
      `onKeydown`/`onPaste`) built over `DomOrderedCollection` imported from
      `$lib/components/ui/speed-dial/speed-dial-collection.svelte.js` (research.md R-03). This module
      imports nothing from any `.svelte` file and takes orientation/direction as getter functions
      (FR-015, R-13). Depends on: T001 (dependency confirmed).
- [X] T013 Implement `src/lib/components/ui/segmented-input/segmented-input.svelte.ts`:
      `SEGMENTED_INPUT_SIZES`/`SEGMENTED_INPUT_ORIENTATIONS` and their types,
      `segmentedInputItemVariants` via `tv()` using the logical-border table from research.md R-07
      (including the `border-s-0`/`border-s` RTL fix, D-06, and the `rounded-*-lg` corners, D-05),
      the `SegmentedInputRootState` class (`dir`/`orientation`/`size`/`disabled`/`invalid`/`required`
      as `$derived` fields from getter-function props, `nav: SegmentNavigation`,
      `resolveDisabled`/`resolveRequired`), and the `Symbol`-keyed context trio
      `setSegmentedInputContext`/`getSegmentedInputContext`/`hasSegmentedInputContext` (the getter
      throws `` `<SegmentedInput.Item>` must be used within `<SegmentedInput.Root>`. `` when no
      provider exists). Depends on: T012 (imports `SegmentNavigation`).
- [X] T014 [US1] Implement `src/lib/components/ui/segmented-input/segmented-input.svelte` (Root):
      module-script `SegmentedInputProps`/`SegmentedInputRootProps`/`SegmentedInputChildProps` types;
      instance script resolves direction via `useDirection({ dir: () => dir, element: () => ref })`
      from `direction-provider`, constructs and publishes `SegmentedInputRootState` via
      `setSegmentedInputContext`, renders `role="group"` plus a `$derived` `supersetAria`
      object spread onto the element carrying `aria-orientation` — spread, **not** written
      literally, because ARIA 1.2 does not list `aria-orientation` among `role="group"`'s
      supported properties and Svelte's `a11y_role_supports_aria_props` check (which inspects
      only literally-written attributes) would otherwise emit a warning that Principle VII
      forbids and that Principle VI forbids silencing with `svelte-ignore`. Mirror
      `src/lib/components/ui/checkbox-group/checkbox-group.svelte:138-158` verbatim, including
      its explanatory comment. Then renders `dir`,
      `data-slot="segmented-input"`, `data-orientation`/`data-disabled`/`data-invalid`/
      `data-required` (`'' | undefined`), `class={cn('flex', horizontal ? 'flex-row' : 'flex-col',
      className)}`, `bind:this={ref}` + `...restProps`, and the `child` snippet escape hatch (FR-016,
      R-05) that skips the default `<div>` when supplied. Depends on: T013.
- [X] T015 [US1] Implement `src/lib/components/ui/segmented-input/segmented-input-item.svelte`
      (Item): module-script `SegmentedInputItemProps`/`SegmentedInputItemChildProps` types (`type`
      narrowed to `Exclude<HTMLInputTypeAttribute, 'file'>`, D-04); instance script reads
      `getSegmentedInputContext('<SegmentedInput.Item>')`, derives `id` from `$props.id()`,
      `position` from `positionProp ?? root.nav.positionOf(id)`, `isDisabled`/`isRequired` from
      `root.resolveDisabled`/`resolveRequired`, `isInvalid` from `root.invalid` directly (no
      per-item override, FR-006); registers into `root.nav` from an `$effect` with
      `getDisabled`/`getReadOnly`/`getMaxLength`/`setValue` (the `setValue` closure both assigns the
      `$bindable` `value` and dispatches a bubbling `input` `Event`, R-11) and unregisters on
      teardown; composes caller `onkeydown`/`onpaste` before `root.nav.onKeydown`/`onPaste` with the
      `defaultPrevented` veto (R-12); renders the composed `Input` from `$lib/components/ui/input`
      with `data-slot="segmented-input-item"`, `data-position`, `data-orientation`, the boolean
      `data-*`/`aria-*` attributes, and the `child` snippet escape hatch. Depends on: T014, T012.

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/segmented-input/segmented-input.test.ts`
should now pass (or reveal genuine implementation gaps to fix, not missing modules).

---

## Phase 4: Barrel and types

- [X] T016 Create `src/lib/components/ui/segmented-input/index.ts`: import `Root`/`Item`, re-export
      every prop/child-props type from both `.svelte` files, re-export
      `getSegmentedInputContext`/`hasSegmentedInputContext`/`setSegmentedInputContext`/
      `SegmentedInputRootState`/`SEGMENTED_INPUT_ORIENTATIONS`/`SEGMENTED_INPUT_SIZES`/
      `segmentedInputItemVariants` and their types from `segmented-input.svelte.js`, re-export
      `SegmentNavigation`/`SegmentEntryMeta`/`resolveSegmentPosition`/`resolveSegmentIntent`/
      `splitPastedValue`/`SEGMENT_ORIENTATIONS`/`SEGMENT_POSITIONS` and their types from
      `segment-navigation.svelte.js` (the Time Picker reuse surface, FR-015), then export
      `Root`/`Item` plus the prefixed aliases `Root as SegmentedInput`/`Item as SegmentedInputItem`,
      matching contracts/public-api.md §1 exactly. Depends on: T012, T013, T014, T015.

**Checkpoint**: `import * as SegmentedInput from '$lib/components/ui/segmented-input/index.js'` and
`import { SegmentedInput, SegmentedInputItem } from '...'` both resolve with no TypeScript errors.

---

## Phase 5: Demo route

- [X] T017 [US1] Create `src/routes/docs/components/segmented-input/+page.svelte` with the page
      header and the **Default** `<ComponentPreview>` section — a three-part name input, mirroring
      `segmented-input-demo.tsx` (research.md, demo 1).
- [X] T018 [US3] Add the **Form Input** `<ComponentPreview>` section to `+page.svelte` — a phone
      number split across country/area/local segments inside a `<form>` that submits the combined
      value, mirroring `segmented-input-form-demo.tsx` (demo 2), exercising paste distribution with
      per-segment `maxlength`.
- [X] T019 [US3] Add the **RGB Color Input** `<ComponentPreview>` section to `+page.svelte` — three
      numeric channel segments, mirroring `segmented-input-rgb-demo.tsx` (demo 3).
- [X] T020 [US2] Add the **Vertical Layout** `<ComponentPreview>` section to `+page.svelte` — a
      vertical mailing-address input demonstrating `orientation="vertical"` and up/down arrow-key
      navigation, mirroring `segmented-input-vertical-demo.tsx` (demo 4); then add the `Root` and
      `Item` prop tables and the keyboard table from contracts/public-api.md §5 below the previews
      (Principle IX, SC-004). Depends on: T017, T018, T019 (same file).

**Checkpoint**: `src/routes/docs/components/segmented-input/+page.svelte` has exactly 4 preview
sections (one per upstream demo file) plus 2 prop tables and 1 keyboard table.

---

## Phase 6: Registry entry and docs polish

- [X] T021 Finalize the `segmented-input` entry added in T003 inside `registry.json`: confirm the
      `files` array lists exactly the 5 non-test files (`index.ts`, `segmented-input.svelte`,
      `segmented-input-item.svelte`, `segmented-input.svelte.ts`, `segment-navigation.svelte.ts`)
      with correct `path`/`type`, and that `registryDependencies`/`dependencies` match
      contracts/public-api.md §7. Depends on: T016, T020.
- [X] T022 Run `pnpm run registry:build` to regenerate `static/r/segmented-input.json` from the
      finalized entry, then read the generated file and confirm (SC-005): all 5 `files` entries are
      present with inlined `content`; no test file leaked in; every `$lib/...` import was rewritten
      to a registry placeholder; and the cross-item import of
      `$lib/components/ui/speed-dial/speed-dial-collection.svelte.js` was rewritten such that an
      installing consumer resolves it through the `speed-dial` `registryDependency` (research R-03,
      plan.md Complexity Tracking) rather than to a path that will not exist on their disk.
- [X] T023 Run `pnpm run format` (shadcn/generator output is not Prettier-formatted) so every file
      touched in T001–T022 is Prettier-clean before the `lint` gate. Leave the formatted files in the
      working tree — do NOT run any git write command; the orchestrator owns the tree and commits
      after the port (Principle X, and this file's own Notes).

---

## Phase 7: Verification (MANDATORY — Constitution Principle VII)

**Purpose**: The feature is not complete until all four gates are green. No suppressions
(`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`,
deleted assertions, loosened configs) may be used to reach green — fix the root cause.

- [X] T024 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`,
      and fix everything that fails.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Tests (Phase 2)**: depends on Setup (T002's directory must exist); tests import
  `segment-navigation.svelte.ts` before it exists (T005) and are expected to fail until Phase 3 —
  this is required by Principle III/VII ("write tests first, ensure they fail").
- **Core component files (Phase 3)**: depends on Phase 2 existing (tests define the contract);
  internally ordered T012 → T013 → T014 → T015 per plan.md's implementation sequence.
- **Barrel and types (Phase 4)**: depends on all of Phase 3.
- **Demo route (Phase 5)**: depends on Phase 4 (imports the barrel).
- **Registry entry and docs polish (Phase 6)**: depends on Phase 4 (file list) and Phase 5 (registry
  description should reflect the finished demo).
- **Verification (Phase 7)**: depends on everything above — always last.

### Story Dependencies

- **US1** (T006, T007, T014, T015, T017): the baseline — connected, independently-editable fields.
  No dependency on US2/US3 tasks; testable the moment T015 lands.
- **US2** (T008, T009, T020; implemented by T012 `onKeydown`/`resolveSegmentIntent`/`focusAt` and
  T015's `onkeydown` composition): keyboard segment navigation. Shares the core files with US1 but
  is independently testable once T015 lands — US1's acceptance scenarios do not require arrows.
- **US3** (T010, T018, T019; implemented by T012 `onPaste`/`splitPastedValue` and T015's `onpaste`
  composition plus the `setValue` registration closure): paste distribution. Independently testable
  once T015 lands; does not require US2's navigation code to function.

T012 and T015 are deliberately left unlabeled in the task list because each serves all three stories;
the parenthetical above is the traceability link.

### Parallel Opportunities

- T002 can run alongside T001/T003 (different concern, same phase).
- T004 and T005 can run in parallel (different files: `.test.svelte` vs `.test.ts`).
- T006–T011 all edit the same `segmented-input.test.ts` file sequentially — not parallelizable
  despite different behavioural areas.
- T012 has no file overlap with T004/T005 and could be started as soon as T001 is done, but per the
  fixed phase order (Tests before Core) it is sequenced after Phase 2 completes.
- T017–T020 all edit the same `+page.svelte` file sequentially — not parallelizable.

---

## Parallel Example: Setup and Test scaffolding

```bash
# Phase 1, run together:
Task: "Create the empty directories for segmented-input source and docs route"          # T002

# Phase 2, run together:
Task: "Create segmented-input.test.svelte harness"                                      # T004
Task: "Create segmented-input.test.ts and write pure-helper tests"                      # T005
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 tests for US1 (T004–T007) plus the cross-cutting T011.
3. Complete Phase 3 (T012–T015 — the core files are shared, so all of Phase 3 is required even for
   an US1-only MVP).
4. Complete Phase 4 (T016).
5. **STOP and VALIDATE**: run
   `pnpm run test:unit -- --run src/lib/components/ui/segmented-input/segmented-input.test.ts`
   restricted to the US1 `it()` blocks; render the Default demo manually.

### Incremental Delivery

1. Setup + Tests (US1 subset) + Core + Barrel → MVP: connected fields render, type, join visually.
2. Add US2 tests (T008, T009) — they should already pass once Phase 3 is complete, since navigation
   is implemented as part of T012/T015, not bolted on later; add the Vertical demo (T020).
3. Add US3 tests (T010) — likewise verify-only against the same Phase 3 implementation; add the Form
   and RGB demos (T018, T019).
4. Registry entry, `registry:build`, `format` (Phase 6).
5. Quality gates (Phase 7) — always the final step before the port is considered done.

Note: unlike a typical multi-story backend feature, Segmented Input's three stories share a single
small set of source files (there is no per-story service/endpoint split), so "incremental delivery"
here means incremental *test and demo* coverage layered on one implementation pass through Phase 3 —
not separate implementation passes per story.

---

## Notes

- [P] tasks = different files, no dependency on an incomplete task.
- [Story] label maps a task to spec.md's User Story 1/2/3 for traceability; tasks with no label are
  foundational or cross-cutting (serve every story equally).
- Tests (Phase 2) MUST be written and observed to fail before Phase 3 implementation begins.
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X).
- No suppressions of any kind may be used to satisfy Phase 7 — fix the root cause (Principle VII).

---

## Phase 8: Convergence

- [X] T025 Make an item rendered through the `child` escape hatch register into the group so it keeps
      its computed `data-position`, occupies its index (its siblings' `first`/`middle`/`last` stay
      correct) and remains reachable by arrow navigation and paste distribution — the registration
      `$effect` in `src/lib/components/ui/segmented-input/segmented-input-item.svelte` is gated on
      `ref`, which `child` mode never binds, so a `child`-rendered segment reads
      `data-position="isolated"` and is invisible to `SegmentNavigation`; capture the caller's element
      through a `createAttachmentKey()` entry in the merged props payload (the precedent already in
      this repo at `src/lib/components/ui/masonry/masonry-item.svelte:71` and
      `src/lib/components/ui/scroller/scroller.svelte:181`), and update the item's `child` JSDoc plus
      the `child` row of the item prop table in
      `src/routes/docs/components/segmented-input/+page.svelte`, both of which currently document the
      non-registration — per FR-016 (partial)
- [X] T026 Replace the `item-child` assertions in
      `src/lib/components/ui/segmented-input/segmented-input.test.ts` ("renders the item onto the
      caller element through the child snippet") so they assert the requirement rather than the
      current shortfall: `await tick()`, then expect the three `child`-rendered items to read
      `data-position` `first`/`middle`/`last`, and add coverage proving a `child`-rendered segment
      takes part in arrow navigation and receives a distributed paste part — per FR-016
      (contradicts)
- [X] T027 Add a test that toggles `orientation` on an already-mounted group (via the harness
      `rerender`, the way the size test does) and asserts the root's `aria-orientation`/
      `data-orientation`/`flex-col` and the items' vertical seam classes (`rounded-e-lg`,
      `border-t-0`, `rounded-s-lg`) re-flow without the items remounting — per spec Edge Cases
      ("Toggling `orientation` at runtime MUST re-flow both the layout direction and the shared-edge
      styling") (missing)
- [X] T028 Extend the paste-distribution suite with a `disabled` segment in the distribution path
      (today only `readonly` is exercised): the disabled segment keeps its value and distribution
      continues into the next eligible segment — per US3/AC3 and quickstart V-32 (missing)
- [X] T029 Add a keyboard test for a wholly `disabled` group: with every segment disabled, an arrow
      key from the focused segment moves focus nowhere and calls no `preventDefault()` — per US2/AC6
      (missing)
- [X] T030 Review the `SegmentedInputItemType` export in
      `src/lib/components/ui/segmented-input/index.ts`: it is not part of the barrel surface listed in
      contracts/public-api.md §1 ("Every symbol below is exported from the barrel; nothing else is").
      Either record it in that contract as an intentional addition supporting the documented `type`
      prop, or remove it from the barrel — per plan: contracts/public-api.md §1 barrel surface
      (unrequested)
