# Tasks: Selection Toolbar

**Input**: Design documents from `/specs/029-port-selection-toolbar/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/selection-toolbar.md, quickstart.md

**Tests**: Mandatory (Constitution Principle III / CLAUDE.md §7). Not optional for this project.

**Path conventions**: component source under `src/lib/components/ui/selection-toolbar/`; demo route at
`src/routes/docs/components/selection-toolbar/+page.svelte`; registry at `registry.json` (repo root).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no unmet dependency)
- **[Story]**: maps the task to US1/US2/US3 from spec.md; Setup/Tests-foundation/Barrel/Demo/Registry/
  Verification tasks carry no story label
- No git commands in any task — the orchestrator owns the working tree (Principle X)

---

## Phase 1: Setup

**Purpose**: confirm the zero-new-dependency premise and stub the registry entry before any source file
exists, so later tasks only ever edit, never create-from-scratch, the registry array entry.

- [X] T001 Verify `bits-ui` (`Popover`, `Portal`) and `$lib/components/ui/direction-provider` are already
      present — read `package.json` and `src/lib/components/ui/direction-provider/index.ts` — and record
      in a one-line note in this task's commit message equivalent (no new `pnpm add`; confirms plan.md's
      "zero new npm dependencies")
- [X] T002 [P] Create the empty component directory `src/lib/components/ui/selection-toolbar/` (no files
      yet) and the empty demo directory `src/routes/docs/components/selection-toolbar/`
- [X] T003 Append the `registry.json` entry (`name: "selection-toolbar"`, `type: "registry:ui"`, `title`,
      `description`, `registryDependencies: ["button", "direction-provider"]`,
      `dependencies: ["bits-ui"]`, empty `files: []`) at the end of the root-level `items` array in
      `registry.json`, so the entry is complete metadata from the start and T020 only ever fills in
      `files`

**Checkpoint**: directories and registry stub exist; no source or test file has been written yet.

---

## Phase 2: Tests (MANDATORY — write first, confirm they fail)

**Purpose**: encode the six required behavioural areas (CLAUDE.md §7, plan.md §Tests) against the public
API in plan.md before any implementation file exists. Every test in this phase imports from
`./index.js`, which does not exist until Phase 3 — confirm each test file fails on import before moving on.

- [X] T004 [P] Create the test harness `src/lib/components/ui/selection-toolbar/selection-toolbar.test.svelte`
      — a `contenteditable` fixture that renders `SelectionToolbar.Root` with `SelectionToolbar.Item` and
      `SelectionToolbar.Separator` children via snippet composition, exposing props needed by every test
      below (`container` ref, `open`/`onOpenChange`, `onSelectionChange`, `dir`, item `onSelect`, `disabled`)
- [X] T005 Roles/ARIA test area in
      `src/lib/components/ui/selection-toolbar/selection-toolbar.test.ts`: assert `role="toolbar"` +
      `aria-label="Text formatting toolbar"` on the root once open, `data-slot` on every part
      (`selection-toolbar`, `selection-toolbar-item`, `selection-toolbar-separator`), `data-state="open"`/
      `"closed"` on the root, and `role="separator" aria-orientation="vertical" aria-hidden="true"` on the
      separator; also assert that the open surface carries the four `--selection-toolbar-*` inline custom
      properties (`available-width`, `available-height`, `anchor-width`, `anchor-height`, each aliased to
      its `--bits-popover-*` source per research.md R-05) together with the resolved `data-side` /
      `data-align` attributes (FR-018); also assert the `child` snippet on Root and Separator renders the
      caller's element with the merged props applied and without the default element (FR-020)
- [X] T006 Keyboard test area (same file, new `describe` block): build a `Range`, `addRange` it,
      dispatch `mouseup` to open, then via `userEvent` — `Tab` reaches each item in DOM order (every item
      is its own tab stop — no roving tabindex, matching upstream), `Enter`/`Space` on a focused item
      fires `onSelect` with the selected text (non-mouse activation path), and `Escape` closes the toolbar
      and clears `window.getSelection()` (`rangeCount === 0`)
- [X] T007 Uncontrolled-state test area (same file): render with no `open` prop, select text inside the
      harness's container via a `Range` + `mouseup`, assert the toolbar opens and `onSelectionChange` fires
      with the trimmed text; collapse the selection and dispatch `selectionchange` on `document`, assert
      the toolbar closes and `onSelectionChange` fires with `""`
- [X] T008 Controlled-state test area (same file): pass `open` bound to a parent `$state` and assert the
      `$bindable` contract from research.md R-07 / data-model.md §2 — (a) the parent setting the bound
      value to `false` while a selection exists closes the surface and the component does not reopen it on
      its own; (b) a new non-empty selection writes `true` back through the binding and fires
      `onOpenChange(true)` exactly once (upstream lets a selection open the toolbar even when `open` is
      supplied); (c) `onOpenChange` fires with the next boolean on every transition and never twice for one
      event, per contracts/selection-toolbar.md
- [X] T009 RTL test area (same file): render with `dir="rtl"` directly and via
      `$lib/components/ui/direction-provider`, open the toolbar, and assert the resolved `dir` reaches the
      floating surface element (inverting `align="start"`/`"end"` in the layer)
- [X] T010 Guard-rails test area (same file): (a) a `container`-scoped root ignores a selection made
      outside that container (toolbar stays closed) and reacts to one made inside it, while
      `container={null}` (scoped but unresolved) neither opens nor closes the toolbar (FR-004); (b) a
      `disabled` `SelectionToolbar.Item` never fires `onSelect`; (c) the activation matrix: `pointerdown`
      with `pointerType: "mouse"` is `preventDefault()`-ed and the following `pointerup` fires `onSelect`
      once with the text selected at activation time (a bare `click` after a mouse pointerdown must NOT
      fire it a second time); `pointerdown` with `pointerType: "touch"` is not default-prevented and
      activation happens on `click`; in both paths a bubbling, cancelable `selectiontoolbar.select` event
      carrying `detail.text` is observable on an ancestor, and a caller `onclick`/`onpointerup` that calls
      `preventDefault()` suppresses activation (FR-010, SC-004, contracts/selection-toolbar.md); (d) with
      the toolbar open, a `pointerdown`/`click` on an element outside the surface clears
      `window.getSelection()` (`rangeCount === 0`) and closes the toolbar, while the same press on the
      toolbar surface or on one of its items dismisses nothing and leaves the selection intact (FR-009);
      (e) `expect(() => render(SelectionToolbarItem-outside-root)).toThrow(/within/)` and the same for
      `SelectionToolbarSeparator`

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/selection-toolbar/selection-toolbar.test.ts`
fails on the missing `./index.js` import — confirms the tests are wired to real (not-yet-existing) exports.

---

## Phase 3: Core component files

**Purpose**: implement the state module and every rendered part described in plan.md §Public API.

- [X] T011 `src/lib/components/ui/selection-toolbar/selection-toolbar.svelte.ts` — `SelectionRect` type,
      `SelectionToolbarRootState` class (`selectedText`, `selectionRect`, `open`/`anchor` derived,
      `updateSelection()`/`closeToolbar()`/`clearSelection()`/`scheduleUpdate()` per data-model.md §2, the
      `$effect`-driven `mouseup`/`selectionchange`/`scroll`/`resize` lifecycle with full teardown), the
      private `Symbol('selection-toolbar')` context key, `setSelectionToolbarContext`/
      `getSelectionToolbarContext(consumerName)` (throws per FR-016), and the constants
      `SELECTION_TOOLBAR_SIDES`, `SELECTION_TOOLBAR_ALIGNMENTS`, `SELECTION_TOOLBAR_ITEM_SELECT`,
      `SELECTION_TOOLBAR_ITEM_SELECT_OPTIONS`, `DEFAULT_SIDE_OFFSET`, `DEFAULT_ALIGN_OFFSET`
- [X] T012 [P] `src/lib/components/ui/selection-toolbar/selection-toolbar-portal.svelte` — bits-ui `Portal`
      wrapped with the `DocumentFragment` host-div bridge (mirrors `action-bar-portal.svelte`), accepting
      `portalContainer: Element | DocumentFragment | string | null` (depends on T011 for shared types only;
      no state-class dependency, so parallel-safe with T013–T014)
- [X] T013 `src/lib/components/ui/selection-toolbar/selection-toolbar.svelte` — Root: `SelectionToolbarRootProps`
      module type (`ref`, `open` `$bindable`, `onOpenChange`, `onSelectionChange`, `container`,
      `portalContainer`, `side`, `sideOffset`, `align`, `alignOffset`, `avoidCollisions`,
      `collisionBoundary`, `collisionPadding`, `sticky`, `hideWhenDetached`, `updatePositionStrategy`,
      `dir`, `children`, `child`); constructs `SelectionToolbarRootState`, calls
      `setSelectionToolbarContext`, resolves `dir` through `DirectionProvider`, composes
      `Popover.Root`/`Popover.Portal` (via T012) /`Popover.Content` with `customAnchor` bound to
      `state.anchor`, `trapFocus={false}`, `preventOverflowTextSelection={false}`, both auto-focus events
      default-prevented, renders nothing while closed, sets `role="toolbar"`,
      `aria-label="Text formatting toolbar"`, `data-slot="selection-toolbar"`, `data-state`, and the four
      `--selection-toolbar-*` CSS variables aliased to the `--bits-popover-*` equivalents; wires
      `onEscapeKeydown` and `onInteractOutside` to `state.clearSelection()` so that `Escape` (FR-008) and a
      pointer press outside the surface (FR-009) each call `selection.removeAllRanges()` before closing,
      while presses inside the surface dismiss nothing (research.md R-03) (depends on T011, T012)
- [X] T014 [P] `src/lib/components/ui/selection-toolbar/selection-toolbar-item.svelte` — `SelectionToolbarItemProps`
      module type (`Omit<ButtonProps, "onselect">` plus `onSelect`, `variant="ghost"`, `size="icon"`,
      `disabled`, `children`, `child`); calls `getSelectionToolbarContext('<SelectionToolbar.Item>')`;
      composes `$lib/components/ui/button` with `data-slot="selection-toolbar-item"` and `class="size-8"`
      merged before caller `class`; tracks `pointerType` in a plain (non-reactive) `let`, calls
      `preventDefault()` on `pointerdown` only when `pointerType === "mouse"`, activates on `pointerup` for
      mouse and on `click` for touch/pen/keyboard, and dispatches the bubbling cancelable
      `CustomEvent<{ text: string }>` named by `SELECTION_TOOLBAR_ITEM_SELECT` with `onSelect` registered
      as its one-shot listener (depends on T011)
- [X] T015 [P] `src/lib/components/ui/selection-toolbar/selection-toolbar-separator.svelte` —
      `SelectionToolbarSeparatorProps` module type (`ref`, `children`, `child`); calls
      `getSelectionToolbarContext('<SelectionToolbar.Separator>')` as a guard only (D-7); renders
      `role="separator" aria-orientation="vertical" aria-hidden="true"`,
      `data-slot="selection-toolbar-separator"`, `class="mx-0.5 h-6 w-px bg-border"` merged with caller
      `class` (depends on T011)

**Checkpoint**: all five source files exist; `Root`/`Item`/`Separator` are each independently importable
from their own file paths (barrel wiring is Phase 4).

---

## Phase 4: Barrel and types

**Purpose**: expose the public API surface described in plan.md exactly once.

- [X] T016 `src/lib/components/ui/selection-toolbar/index.ts` — import `Root`/`Item`/`Separator` from
      T013–T015; re-export `type` aliases `SelectionToolbarRootProps` (also as `SelectionToolbarProps`),
      `SelectionToolbarItemProps`, `SelectionToolbarSeparatorProps`, `SelectionToolbarSide`,
      `SelectionToolbarAlign`, `SelectionRect`, `SelectionToolbarRootStateProps`,
      `SelectionToolbarItemSelectEvent`, and every `*ChildProps` type; re-export
      `SelectionToolbarRootState`, `setSelectionToolbarContext`, `getSelectionToolbarContext`,
      `SELECTION_TOOLBAR_SIDES`, `SELECTION_TOOLBAR_ALIGNMENTS`, `SELECTION_TOOLBAR_ITEM_SELECT`,
      `SELECTION_TOOLBAR_ITEM_SELECT_OPTIONS`, `DEFAULT_SIDE_OFFSET`, `DEFAULT_ALIGN_OFFSET` from
      `selection-toolbar.svelte.ts` (T011); export short names (`Root`, `Item`, `Separator`) plus prefixed
      aliases (`SelectionToolbar`, `SelectionToolbarItem`, `SelectionToolbarSeparator`) per CLAUDE.md §3 —
      deliberately **not** exporting `selection-toolbar-portal.svelte` (internal, no upstream `Portal` part)
      (depends on T011, T013, T014, T015)

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/selection-toolbar/selection-toolbar.test.ts`
now resolves its imports — rerun it and confirm every Phase 2 assertion passes.

---

## Phase 5: User Story 1 — Format selected text with a floating toolbar (Priority: P1) 🎯 MVP

**Goal**: reproduce the primary upstream demo (`selection-toolbar-demo.tsx`) — a full formatting toolbar
that appears on selection, survives activation (bold/italic re-select the wrapped node), and closes only
when an action clears the selection (copy/share).

**Independent Test**: open `/docs/components/selection-toolbar`, select a phrase in the first demo's
editable article, confirm the toolbar appears near the selection, and confirm activating an item fires its
callback with the selected text.

- [X] T017 [US1] Add the "Default" `<ComponentPreview>` section to
      `src/routes/docs/components/selection-toolbar/+page.svelte` mirroring
      `.reference/diceui/docs/registry/bases/base/examples/selection-toolbar-demo.tsx`: a
      `contenteditable` article scoped with `container={editorEl}` (matching upstream's
      `container={containerRef}`), `SelectionToolbar.Root` wrapping bold/italic/link
      `SelectionToolbar.Item`s separated by `SelectionToolbar.Separator`, each `onSelect` applying the
      action to the selection and logging/toast-ing the received text — bold/italic re-select the
      wrapped node so the toolbar stays open, while the link item uses a fixed placeholder URL instead of
      upstream's `prompt()` (blocked in many browsers and unusable under automated preview; recorded in
      spec.md Assumptions) (creates the file if it does not yet exist; T017 and T018 touch the same file,
      so run sequentially)

**Checkpoint**: User Story 1 is independently demonstrable in the browser via `pnpm run build && pnpm run preview`.

---

## Phase 6: User Story 2 — React to selection changes to show live information (Priority: P2)

**Goal**: reproduce the second upstream demo (`selection-toolbar-info-demo.tsx`) — a live word/character
count driven by `onSelectionChange`, independent of item activation.

**Independent Test**: open the second demo section, select text, confirm the readout updates with the
exact selected text on every change including clearing to `""`.

- [X] T018 [US2] Add the "With selection info" `<ComponentPreview>` section to
      `src/routes/docs/components/selection-toolbar/+page.svelte` (same file as T017 — run after it,
      not `[P]`) mirroring `selection-toolbar-info-demo.tsx`: a `SelectionToolbar.Root` scoped with
      `container={editorEl}` (matching upstream's `container={containerRef}`) with `onSelectionChange`
      wired to a `$state` string, rendering a live word/character count beside the editable region

**Checkpoint**: both upstream demos are reproduced; User Story 2 is independently verifiable without
touching User Story 1's markup.

---

## Phase 7: User Story 3 — Restrict tracking to a specific editable region (Priority: P3)

**Goal**: prove the `container` prop scopes selection tracking, per FR-004.

**Independent Test**: covered by the automated guard-rails test (T010); no additional demo section is
required by plan.md's two-preview schedule, so this story is validated purely by the unit test plus a
manual quickstart pass against the existing demos (quickstart.md scenario 8).

- [X] T019 [US3] Extend the "Default" preview in
      `src/routes/docs/components/selection-toolbar/+page.svelte` with an unrelated paragraph of text
      rendered outside the `container`-scoped `SelectionToolbar.Root`, so the manual quickstart scenario 8
      ("select text outside the container → nothing appears") is directly reproducible on the docs page
      (touches the same file as T017/T018 — sequence after both, not parallel)

**Checkpoint**: all three user stories are demonstrable independently on the demo route.

---

## Phase 8: Registry entry and docs polish

**Purpose**: finish the registry metadata and the API-reference documentation required by FR-017 / Principle IX.

- [X] T020 Fill in the `registry.json` stub from T003: set `files` listing all six non-test source files
      (`index.ts`, `selection-toolbar.svelte`, `selection-toolbar-portal.svelte`,
      `selection-toolbar-item.svelte`, `selection-toolbar-separator.svelte`, `selection-toolbar.svelte.ts`)
      with `type: "registry:ui"` (depends on T011–T016)
- [X] T021 Run `pnpm run registry:build` and confirm `static/r/selection-toolbar.json` is produced with
      `$lib/...` imports rewritten to registry placeholders (depends on T020)
- [X] T022 Add the page header, intro paragraph and an "API Reference" section with one props table
      per part (Root/Item/Separator, matching plan.md §Public API) to
      `src/routes/docs/components/selection-toolbar/+page.svelte`, plus the `<svelte:head><title>` tag
      (touches the same file as T017–T019 — sequence after them)

**Checkpoint**: the registry entry is complete and buildable; the demo route documents every prop.

---

## Phase 9: Verification (MANDATORY — Principle VII)

**Purpose**: the feature is not complete until all four gates are green, with zero suppressions
(`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, deleted
assertions, loosened configs). Fix root causes, not the gate.

- [X] T023 Run `pnpm run format` first (shadcn/generator output is not Prettier-formatted and would
      otherwise fail `lint`), then `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and
      `pnpm run build`, and fix the root cause of everything that fails — no suppressions

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Tests (Phase 2)**: depends on Setup (needs the empty directories from T002). T004 (the harness, its
  own file) can run in parallel with the rest. T005–T010 all edit the same
  `selection-toolbar.test.ts` and are sequenced, never `[P]`, to avoid clobbering each other's edits.
- **Core (Phase 3)**: depends on Phase 2 existing (tests must fail first). T011 blocks T013–T015; T012 is
  independent of T011's class but both are needed by T013.
- **Barrel (Phase 4)**: depends on all of Phase 3.
- **User Stories (Phase 5–7)**: depend on Phase 4 (the barrel is the only supported import path). US1
  (T017) creates the demo file; US2 (T018) and US3 (T019) extend it — sequential, not parallel, because
  they share one file.
- **Registry & docs polish (Phase 8)**: T020 depends on Phase 3–4 (needs final file list); T021 depends on
  T020; T022 depends on T017–T019 (same file).
- **Verification (Phase 9)**: depends on everything above — always the last phase.

### Parallel opportunities

- T002 and T003 can run together (different concerns, no shared file conflict beyond the single
  `registry.json` append in T003).
- T012 (portal) can be built in parallel with T014 (item) and T015 (separator) once T011 lands — none of
  the three edit the same file.
- T014 and T015 are fully parallel (different files, both depend only on T011).

---

## Parallel Example: Phase 3 (Core component files)

```bash
# After T011 (selection-toolbar.svelte.ts) lands, run together:
Task: "selection-toolbar-portal.svelte — Portal + DocumentFragment bridge"
Task: "selection-toolbar-item.svelte — Button composition + pointer-type activation"
Task: "selection-toolbar-separator.svelte — separator markup + context guard"

# T013 (Root) waits for both T011 and T012, so it runs after the above.
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Complete Phase 1 (Setup) → Phase 2 (Tests, confirmed failing) → Phase 3 (Core) → Phase 4 (Barrel).
2. Complete Phase 5 (US1) and re-run the Phase 2 test file — it should now pass in full, since the six
   test areas already cover US1/US2/US3 behaviour at the unit level.
3. **STOP and VALIDATE**: `pnpm run build && pnpm run preview`, exercise quickstart.md scenarios 1–7.
4. Deploy/demo if ready — the toolbar is fully usable with just the Default preview.

### Incremental delivery

1. Setup + Tests + Core + Barrel → foundation ready, unit suite green.
2. Add US1 (T017) → validate independently → demo-ready (MVP).
3. Add US2 (T018) → validate independently (quickstart scenario 9).
4. Add US3 (T019) → validate independently (quickstart scenario 8).
5. Registry + docs polish (Phase 8) → Verification (Phase 9).

---

## Notes

- [P] tasks touch different files with no unmet dependency; tasks sharing
  `selection-toolbar.test.ts` or `+page.svelte` are sequenced, never `[P]`, even within the same phase —
  in Phases 2–4, `[P]` remains only on T002, T004 (harness, own file), T012, T014 and T015.
- Tests (Phase 2) MUST be written first and confirmed failing on import before Phase 3 begins.
- Do NOT run git commands — the orchestrator owns the working tree (Principle X).
- Do NOT touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json`, `.port-logs/`.
- No `shadcn-svelte add` mid-port — every primitive this component needs
  (`button`, `direction-provider`, and `bits-ui`'s `Popover`/`Portal`) is already installed.

---

## Phase 10: Convergence

**Purpose**: close the gaps found by `/speckit-converge` between the artifacts and the implemented port.
Every item is a test-coverage gap in `src/lib/components/ui/selection-toolbar/selection-toolbar.test.ts`
(and its harness) — the component source, the demo route and the registry entry already satisfy the
spec, and all four quality gates are green. Do not weaken an assertion to make one pass (Principle VII).

- [X] T024 Cover the `portalContainer` prop end to end in
      `src/lib/components/ui/selection-toolbar/selection-toolbar.test.ts` — the harness already forwards
      it: open the toolbar with (a) an `Element` target and assert the surface is a descendant of it,
      (b) a CSS-selector `string` target (divergence D-4) and assert the same, and (c) a
      `DocumentFragment` target, asserting the `display: contents`
      `[data-slot="selection-toolbar-portal-host"]` bridge from `selection-toolbar-portal.svelte` is
      appended to the fragment, hosts the surface, and is removed again on unmount; also assert the
      default with no prop portals to `document.body`. This is the only bespoke unit of the port with no
      test at all per FR-013 / SC-002 / plan §Bespoke behaviour justification #4 (partial)
- [X] T025 Add a teardown spec: render, open the toolbar, `unmount()` the harness, then dispatch
      `mouseup` on the container, `selectionchange` on `document` and `scroll`/`resize` on `window`, and
      assert no `onSelectionChange` / `onOpenChange` fires and nothing throws — proving the tracking
      `$effect` removed all four listeners and cancelled both pending `requestAnimationFrame` tokens per
      plan §Technical Context Constraints and data-model.md §Lifecycle (partial)
- [X] T026 Add a reposition spec for `scheduleUpdate()`: with the toolbar open, move the live `Range`
      to a different phrase without dispatching `selectionchange`, dispatch `scroll` on `window`, await
      a frame and assert the re-read happened (`onSelectionChange` fired with the new text); assert a
      burst of `scroll`/`resize` events coalesces into a single read (one rAF token), and that a
      `scroll` while the toolbar is closed triggers no read — per the spec's scroll/resize edge case and
      data-model.md §Lifecycle (partial)
- [X] T027 Add a cross-element selection spec: extend the harness fixture with a second block inside
      the tracked container, build a `Range` spanning both so `commonAncestorContainer` is an `Element`
      rather than a `Text` node, and assert the toolbar opens once against the combined text; then build
      a range straddling the container boundary and assert it is ignored — this exercises the
      `nodeType === Node.ELEMENT_NODE` branch of `updateSelection()`, which no current test reaches, per
      the spec's "spans element boundaries" edge case and FR-004 (partial)
- [X] T028 Cover the remaining documented part-level API surface in the same test file: (a) `onSelect`'s
      second argument is the bubbling, cancelable `selectiontoolbar.select` `CustomEvent` whose
      `detail.text` equals the first argument (contracts/selection-toolbar.md §Item); (b) the Item
      `child` snippet renders the caller's element with the merged props and leaves `ref` `null`, as
      already asserted for Root and Separator (plan §Public API); (c) `ref` is populated with the
      rendered element in default (non-`child`) mode for Root, Item and Separator; (d) an
      `aria-label` passed through `restProps` overrides the default accessible name, which plan
      §Public API documents as overridable (partial)

**Checkpoint**: re-run `pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build`; all five
must stay green with no suppressions.
