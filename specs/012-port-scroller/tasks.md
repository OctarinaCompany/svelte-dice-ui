---
description: 'Task list for the Scroller port'
---

# Tasks: Scroller

**Input**: Design documents from `/specs/012-port-scroller/` (plan.md, spec.md, research.md, data-model.md, contracts/public-api.md, quickstart.md)

**Tests**: Tests are MANDATORY per `CLAUDE.md` §7 and Constitution Principle III/VII. `scroller.test.ts` (colocated) plus a `scroller.test.svelte` harness for `bind:ref`, `child`-snippet, out-of-provider and `<DirectionProvider>` cases a `.ts` file cannot express.

**Organization**: Ordered by technical phase (Setup → Tests → Core component files → Barrel and types → Demo route → Registry entry and docs polish → Verification) per the task-generation instructions for this feature, rather than by user story. Each test/implementation task still notes which user story (US1 scroll-with-edge-cues, US2 navigation buttons, US3 orientation/hidden-scrollbar/RTL) it validates, for traceability back to spec.md.

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- Every task names a concrete file path relative to the repository root
- Tasks touching the same file are never `[P]`

## Path Conventions

- Component source: `src/lib/components/ui/scroller/`
- Tests: `src/lib/components/ui/scroller/scroller.test.ts` + `scroller.test.svelte`
- Demo route: `src/routes/docs/components/scroller/+page.svelte`
- Registry: `registry.json` (repo root)

---

## Phase 1: Setup

**Purpose**: Confirm no new dependencies are needed and stand up the folder/barrel/registry placeholders every later task writes into.

- [X] T001 Verify zero new npm dependencies are required for this port: `tailwind-variants`, `@lucide/svelte`, `bits-ui` are already in `package.json`, and `src/lib/components/ui/direction-provider/` is already ported (plan.md "Primary Dependencies"). No `pnpm add` runs in this feature.
- [X] T002 [P] Create the empty component folder `src/lib/components/ui/scroller/` and an empty barrel stub `src/lib/components/ui/scroller/index.ts` (no exports yet — populated in Phase 4) so later tasks have a target directory.
- [X] T003 [P] Append the `scroller` registry stub to `registry.json` at the repo root: `name: "scroller"`, `type: "registry:ui"`, `title: "Scroller"`, `description: "A scrollable container with customizable scroll shadows and navigation buttons."`, `registryDependencies: ["direction-provider"]`, `dependencies: ["tailwind-variants", "@lucide/svelte"]`, and a `files` array listing the five component files (`index.ts`, `scroller.svelte`, `scroller-button.svelte`, `scroller.svelte.ts`, `scroll-position.svelte.ts`) per contracts/public-api.md "Registry entry". Do not run `pnpm run registry:build` yet.

**Checkpoint**: The folder, barrel stub and registry stub exist as placeholders.

---

## Phase 2: Tests (MANDATORY — write first, confirm they fail before implementation)

**Purpose**: Lock in the contract from contracts/public-api.md, data-model.md and quickstart.md's 15-row coverage matrix before any component file is written.

- [X] T004 [P] Create the test harness `src/lib/components/ui/scroller/scroller.test.svelte` with modes for: `bind:ref` capture on `Scroller.Root` in default mode; a `child`-snippet mode for `Scroller.Root` that spreads `ScrollerChildProps` onto the consumer's own element (mirrors the horizontal demo's `asChild` usage, research R-05); a bare mode that renders `scroller-button.svelte` directly (imported from its own file, not the barrel, since it is not exported) with no `<Scroller.Root>` ancestor, for the guard-rail test; and a `<DirectionProvider dir="rtl">`-wrapped mode around a horizontal `Scroller.Root` for the RTL tests. Expose captured refs and forwarded props through the harness's own props, following `marquee.test.svelte`'s pattern.
- [X] T005 [P] Write the rendering & every-prop test group in `src/lib/components/ui/scroller/scroller.test.ts` (quickstart rows 1–2): root renders one element with `data-slot="scroller"`; children render; `withNavigation` adds `[data-slot="scroller-wrapper"]` with buttons before the scroller in DOM order; `orientation` (both values → `data-orientation` + overflow class), `hideScrollbar` (attribute + scrollbar-hiding classes), `size` (→ `--scroll-shadow-size: Npx`), `offset` (default 0; a non-zero offset suppresses a cue whose hidden content is below it — full asymmetry pinned separately in T006), `withNavigation`, `scrollStep` (exact pixel delta on a button press), `scrollTriggerMode` (all three accepted), `dir`, `class` merged last, `style` appended after the custom property, and arbitrary `restProps` forwarded.
- [X] T006 Add the edge-detection, `offset`-asymmetry and upstream-quirk test group to `src/lib/components/ui/scroller/scroller.test.ts` (quickstart rows 3–5, data-model.md "Edge attribute state machine"): at top → `data-bottom-scroll` only; mid-scroll → `data-top-bottom-scroll` only (neither single attribute present); at bottom → `data-top-scroll` only; no overflow → none of the six attributes; horizontal equivalents; recomputes on a dispatched `scroll` event. With `offset={40}` and 30px remaining, assert the bottom mask attribute is absent **but** the down navigation button still renders (research R-03, pinned deliberately). Assert a `vertical`-orientation scroller with horizontal overflow still gets `data-left-scroll`/`data-right-scroll` (research R-09). Same file as T005 — sequential.
- [X] T007 Add the navigation-button visibility test group to `src/lib/components/ui/scroller/scroller.test.ts` (quickstart row 6, US2): only directions with hidden content render a button; a direction's button disappears once its edge is exhausted and reappears once content becomes available again. Same file — sequential.
- [X] T008 Add the trigger-mode test group to `src/lib/components/ui/scroller/scroller.test.ts` (quickstart row 7, US2) using fake timers: `click` mode — one click scrolls exactly one `scrollStep` and no further; `press` mode — `pointerdown` starts a repeat every 50ms (`AUTO_SCROLL_INTERVAL`), stopping on `pointerup`, `pointerleave`, and `pointercancel`, with no scroll occurring between `pointerdown` and the first 50ms tick, and a plain `click` (no held pointer) producing no scroll (upstream's `onClick: () => {}` no-op); `hover` mode — `pointerenter` starts the repeat, `pointerleave` stops it, with the same no-scroll-before-first-tick and click-is-a-no-op parity. Same file — sequential.
- [X] T009 Add the timer-teardown test group to `src/lib/components/ui/scroller/scroller.test.ts` (quickstart row 8, US2, spec Edge Cases): unmounting the root mid-press clears the interval (no further scroll writes after `vi.advanceTimersByTime`); a direction becoming exhausted mid-repeat unmounts its button and stops that repeat. Same file — sequential.
- [X] T010 Add the **keyboard interaction** test group to `src/lib/components/ui/scroller/scroller.test.ts` (quickstart row 9, FR-013, D-04, US2) driven through `userEvent`: `press` mode — `Enter` and `Space` `keydown` start the repeat, `keyup` and `blur` stop it; `hover` mode — `focus` starts the repeat, `blur` stops it; `click` mode — `Enter` fires exactly one step. Same file — sequential.
- [X] T011 Add the **accessibility roles and accessible names** test group to `src/lib/components/ui/scroller/scroller.test.ts` (quickstart row 10, FR-013, D-05, US2): navigation buttons are `type="button"` and queryable via `getByRole('button', { name: 'Scroll down' })` etc.; the chevron icon is `aria-hidden`; the scroll container itself exposes no bogus role; a consumer-supplied `role`/`aria-label` on the root is forwarded through `restProps`; and assert that `tabindex={0}`, `role="region"` and `aria-label` supplied by the consumer land on the scroll container (FR-004/FR-009 keyboard opt-in). Same file — sequential.
- [X] T012 Add the **RTL** test group to `src/lib/components/ui/scroller/scroller.test.ts` (quickstart row 11, D-01, US3), using the harness's `dir="rtl"`-prop mode and its `<DirectionProvider dir="rtl">` mode from T004: at rest at the logical start (nothing scrolled) the hidden content lies physically left → only `data-left-scroll` is present and the left-hand navigation button renders; once scrolled away from the start, hidden content also lies physically right → `data-right-scroll` (both open → `data-left-right-scroll`); scrolled fully to the logical end (viewport at the physical left edge) → only `data-right-scroll` is present and `data-left-scroll` is absent; the vertical axis is unaffected by `dir`. Same file — sequential; depends on T004 for the provider-wrapped harness.
- [X] T013 Add the **controlled vs. uncontrolled state** test group to `src/lib/components/ui/scroller/scroller.test.ts` (quickstart rows 12–13, FR-008, US1), using the harness's `child`-snippet and `bind:ref` modes from T004. Scroller has no value-bearing prop (plan.md "Callbacks/events"), so this axis maps to: the `child` snippet receives the full `ScrollerChildProps` payload and spreading it registers the consumer's own element for measurement (cues appear and navigation scrolls that element; `children` is not rendered in `child` mode) versus the default uncontrolled mode where the component owns and measures its own `<div>`; separately, `ref` is populated with the rendered element in default mode and stays `null` in `child` mode. Same file — sequential; depends on T004.
- [X] T014 Add the **edge cases** test group to `src/lib/components/ui/scroller/scroller.test.ts` (quickstart row 14 + spec "Edge Cases", US1/US2), using the harness's bare-button mode from T004 for the guard rail: rendering `scroller-button.svelte` with no `<Scroller.Root>` ancestor throws `` /must be used within `<Scroller.Root>`/ ``; content that exactly fills the container renders no edge-cue attributes and no navigation buttons even with `withNavigation` enabled; a stubbed `ResizeObserver`/`MutationObserver` firing after mount recomputes edge-cue attributes synchronously within that same callback, with no intervening poll and no stale attribute left once the callback returns — this is what proves SC-003 as restated (recompute is tied to the notification, not to elapsed time). Same file — sequential; depends on T004.
- [X] T015 Add the **module unit tests** for `scroll-position.svelte.ts` to `src/lib/components/ui/scroller/scroller.test.ts` (quickstart row 15, FR-010): `readScrollMetrics` on a stubbed element with `Object.defineProperty`-backed accessors; `computeAxisOverflow` across vertical/horizontal × LTR/RTL × offset `0`/`40` × scrollable/not-scrollable, including the `startDistance + endDistance === max(0, scrollSize - clientSize)` invariant and the `scrollable === false ⟹ atStart && atEnd` invariant (data-model.md §2); `observeScrollPosition` measures eagerly on subscribe, reacts to a dispatched `scroll` event, and its returned teardown removes all listeners (assert via `addEventListener`/`removeEventListener` spies, since `ResizeObserver` is a jsdom no-op stub per `tests/setup.ts`); the SSR guard (`typeof window === 'undefined'`) returns a no-op teardown. Same file — sequential.

**Checkpoint**: `scroller.test.ts` and `scroller.test.svelte` exist and fail (no implementation yet) — confirm the failures are import/render errors, not typos, before starting Phase 3.

---

## Phase 3: Core component files

**Purpose**: Implement the reusable detection module, the state class, and the two markup parts, in dependency order (data-model.md, contracts/public-api.md).

- [X] T016 Implement `src/lib/components/ui/scroller/scroll-position.svelte.ts` (FR-010, data-model.md §1–2): the `ScrollAxis`/`ScrollMetrics`/`AxisOverflow`/`ComputeAxisOverflowOptions` types, `EMPTY_SCROLL_METRICS`, `readScrollMetrics(element)`, `computeAxisOverflow(metrics, axis, options)`, `observeScrollPosition(element, onChange)` (subscribes to the element's `scroll`, a `ResizeObserver` on the element and its children kept current by a `MutationObserver` on `childList`, and `window`'s `resize`; measures once eagerly; SSR-guarded; returns a teardown removing all four), and the optional `ScrollPositionState` runes wrapper. No import from any other file in this component folder — this is the standalone module `scroll-spy` and `tour` (wave 3) will import directly.
- [X] T017 Implement `src/lib/components/ui/scroller/scroller.svelte.ts` (data-model.md §3): `SCROLLER_ORIENTATIONS`, `SCROLLER_TRIGGER_MODES`, `SCROLL_DIRECTIONS` (`as const` tuples) and their derived types, `AUTO_SCROLL_INTERVAL = 50`, the `DEFAULT_*` constants (`orientation: 'vertical'`, `hideScrollbar: false`, `size: 40`, `offset: 0`, `withNavigation: false`, `scrollStep: 40`, `scrollTriggerMode: 'press'`), the `ScrollerStateProps` getter-function input type, and the `ScrollerState` class — `$state` fields `element`/`metrics`, `$derived` members `orientation`/`isVertical`/`isRtl`/`vertical`/`horizontal`/`hasTopScroll`/`hasBottomScroll`/`hasStartScroll`/`hasEndScroll`/`hasLeftScroll`/`hasRightScroll`/`edgeAttributes`/`navigation`/`activeDirections`/`visibleDirections`/`customProperty` exactly per the derivation table and edge-attribute state machine, and methods `setMetrics`/`measure`/`scrollByStep`. Add the `Symbol('scroller')` context key with `setScrollerContext(state)` and `getScrollerContext(consumerName)` that throws `` `${consumerName} must be used within `<Scroller.Root>`.` ``. Depends on T016 (imports `computeAxisOverflow`, `ScrollMetrics`, `EMPTY_SCROLL_METRICS`).
- [X] T018 Implement `src/lib/components/ui/scroller/scroller-button.svelte` (data-model.md §4, contracts/public-api.md "`scroller-button.svelte`"): module-script `ScrollerButtonProps` type (`ref` bindable, required `direction`, `class`, `...restProps: HTMLButtonAttributes`), the `scrollerButtonVariants` `tv()` object with direction-to-position/icon variants, instance script calling `getScrollerContext('scroller-button.svelte')`, the per-button `intervalId` local state, `start()`/`stop()` implementing the three trigger-mode transition tables (data-model.md "State transitions") with an idempotent `start()`, pointer **and** keyboard listeners (Enter/Space for `press`, focus/blur for `hover`), an `$effect` teardown clearing any live interval on unmount, and rendering `data-slot="scroller-button"`, `data-direction`, `data-trigger-mode`, `type="button"`, `aria-label`, and an `aria-hidden` `@lucide/svelte` chevron selected via `direction`. Depends on T017 (context, `ScrollerState.scrollByStep`).
- [X] T019 Implement `src/lib/components/ui/scroller/scroller.svelte` (contracts/public-api.md "`<Scroller.Root>`"): module-script `ScrollerRootProps`/`ScrollerProps`/`ScrollerChildProps` types with upstream JSDoc and `@default` tags copied verbatim, the `scrollerVariants` `tv()` object (orientation × hide-scrollbar variants), instance script constructing `ScrollerState` via `setScrollerContext`, resolving `dir` through the existing `direction-provider`'s `useDirection()` (matching Marquee/Timeline), the single `$effect` that assigns `state.element` and wires `observeScrollPosition` with teardown, the `createAttachmentKey()`-based bridge so the `child` snippet's spread props still register the consumer's element (research R-05), and the `data-slot="scroller-wrapper"` navigation wrapper rendering a `scroller-button.svelte` per entry in `state.visibleDirections` before the scroller element, per contracts/public-api.md "Rendered structure". Depends on T017 (`ScrollerState`, context) and T018 (renders `scroller-button.svelte`).

**Checkpoint**: All four component-source files exist. Run `pnpm run test:unit -- --run src/lib/components/ui/scroller/scroller.test.ts` — most groups from Phase 2 should now pass (the barrel isn't wired yet, so tests importing from `./index.js` still fail until Phase 4).

---

## Phase 4: Barrel and types

**Purpose**: Expose the public surface exactly as contracts/public-api.md's barrel section specifies.

- [X] T020 Populate `src/lib/components/ui/scroller/index.ts` per contracts/public-api.md "Barrel": import `Root` from `scroller.svelte`; re-export `Root` and `Root as Scroller`; re-export the types `ScrollerChildProps`/`ScrollerProps`/`ScrollerRootProps` from `scroller.svelte` and `ScrollerButtonProps` from `scroller-button.svelte` (type-only, for typing — `scroller-button.svelte` itself stays unexported per the spec Assumption); re-export `AUTO_SCROLL_INTERVAL`, `getScrollerContext`, `SCROLL_DIRECTIONS`, `SCROLLER_ORIENTATIONS`, `SCROLLER_TRIGGER_MODES`, `ScrollerState`, `setScrollerContext` and their types from `scroller.svelte.js`; re-export `computeAxisOverflow`, `EMPTY_SCROLL_METRICS`, `observeScrollPosition`, `readScrollMetrics`, `ScrollPositionState` and their types from `scroll-position.svelte.js`. All intra-repo imports use the `.js` extension. Depends on T016–T019.

**Checkpoint**: Both import styles (`import * as Scroller` and `import { Scroller }`) resolve. Run `pnpm run test:unit -- --run src/lib/components/ui/scroller` and confirm every test group from Phase 2 is green.

---

## Phase 5: Demo route

**Purpose**: One documentation page demonstrating every upstream example, per `CLAUDE.md` §8 and FR-012.

- [X] T021 Create `src/routes/docs/components/scroller/+page.svelte` with the page header and a "Default" `<ComponentPreview>` section mirroring `.reference/diceui/docs/registry/bases/radix/examples/scroller-demo.tsx`: ~100 cards in a fixed-height `Scroller.Root`, demonstrating bottom-only fade at rest, top-and-bottom mid-scroll, top-only at the end.
- [X] T022 Add the "Horizontal" `<ComponentPreview>` section to `src/routes/docs/components/scroller/+page.svelte` mirroring `.reference/diceui/docs/registry/bases/radix/examples/scroller-horizontal-demo.tsx`: `orientation="horizontal"` rendered through the `child` snippet onto the consumer's own flex row, proving `child` mode still measures (research R-05). Same file as T021 — sequential.
- [X] T023 Add the "Hidden scrollbar" `<ComponentPreview>` section to `src/routes/docs/components/scroller/+page.svelte` mirroring `.reference/diceui/docs/registry/bases/radix/examples/scroller-hidden-demo.tsx`: `hideScrollbar` enabled, confirming wheel/touch/keyboard scrolling still works with no native scrollbar shown. Same file — sequential.
- [X] T024 Add the "Navigation" `<ComponentPreview>` section to `src/routes/docs/components/scroller/+page.svelte` mirroring `.reference/diceui/docs/registry/bases/radix/examples/scroller-navigation-demo.tsx` (`withNavigation`, default `press` trigger mode), plus an RTL variant of the horizontal example wrapped in `<DirectionProvider dir="rtl">` per quickstart's "RTL check" (SC-007), and the props/data-attribute/CSS-variable tables built from contracts/public-api.md (upstream MDX for the shared props, plus the `dir` prop, the `child` snippet and the full data-attribute table, with divergences D-01…D-07 flagged). The navigation section MUST render `<Scroller.Root tabindex={0} role="region" aria-label="Scrollable cards" …>` so the documented keyboard-scrolling spelling (research R-06, spec Assumption D-07) is demonstrated. Same file — sequential.

**Checkpoint**: `/docs/components/scroller` shows all four upstream examples plus the RTL check and reference tables.

---

## Phase 6: Registry entry and docs polish

**Purpose**: Finalize the registry item and rebuild the static registry output.

- [X] T025 Verify and finalize the `scroller` entry in `registry.json` (added as a stub in T003) against the finished file set: confirm `files` lists exactly `index.ts`, `scroller.svelte`, `scroller-button.svelte`, `scroller.svelte.ts`, `scroll-position.svelte.ts` (test files excluded), and that `title`/`description` match the demo page's header copy from T021.
- [X] T026 Run `pnpm run registry:build` and verify `static/r/scroller.json` contains all five files with no test files, and every `$lib/...` import rewritten to a registry placeholder (quickstart.md §2). Depends on T025.

---

## Phase 7: Verification

**Purpose**: The feature is not complete until every quality gate is green. No suppressions (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, deleted assertions, loosened configs) may be used to reach green — fix the root cause.

- [X] T027 Run `pnpm run format` (Prettier writes; `pnpm run lint` runs `prettier --check .` and would otherwise fail on unformatted new files from Phases 2–5).
- [X] T028 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, and fix everything that fails.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Tests (Phase 2)**: Depends on Setup (T002 creates the folder T004–T015 write into) — writes and confirms-failing before any implementation.
- **Core component files (Phase 3)**: Depends on Tests existing (T004–T015) so failures are visible pre-implementation; internally sequential — T016 (scroll-position) → T017 (scroller state, imports T016) → T018 (button, imports T017's context) → T019 (root, imports T017's context and renders T018).
- **Barrel and types (Phase 4)**: Depends on all of Phase 3 (T016–T019).
- **Demo route (Phase 5)**: Depends on Phase 4 (the demos import from the barrel).
- **Registry entry and docs polish (Phase 6)**: Depends on Phase 1's stub (T003) and the final file set from Phase 3/4; T025 also reads the demo header from T021.
- **Verification (Phase 7)**: Depends on everything above — always last.

### Parallel Opportunities

- T002 and T003 (Setup) run in parallel with each other, after T001.
- T004 (test harness, `scroller.test.svelte`) and T005 (first `scroller.test.ts` group) run in parallel — different files.
- T006–T015 are additive groups in the same `scroller.test.ts` file as T005 and are therefore sequential, not `[P]`, even though each group is logically independent.
- T016–T019 (Phase 3) are sequential: each depends on symbols the previous task defines, not merely on file adjacency.
- T021–T024 (Demo route) are sequential — same file.
- T025 and T026 (Registry) are sequential — T026 depends on T025's edits landing first.

---

## Parallel Example: Setup + Tests kickoff

```bash
# After T001:
Task: "Create the empty component folder and barrel stub in src/lib/components/ui/scroller/index.ts"   # T002
Task: "Append the scroller registry stub to registry.json"                                              # T003

# After Phase 1 completes:
Task: "Create the test harness scroller.test.svelte"                          # T004
Task: "Write the rendering & every-prop test group in scroller.test.ts"       # T005
```

---

## Implementation Strategy

### Sequenced delivery (no independent-story MVP — Scroller is one cohesive component)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Tests — confirm every group fails for the right reason (missing implementation, not a typo).
3. Complete Phase 3: Core component files, in the stated dependency order.
4. Complete Phase 4: Barrel and types — re-run the full test file and confirm all 15 quickstart rows pass.
5. Complete Phase 5: Demo route.
6. Complete Phase 6: Registry entry and docs polish.
7. Complete Phase 7: Verification — all four gates green, no suppressions.

### Traceability to user stories

- **US1** (scroll with edge cues): T005, T006, T013, T014, T015, T016, T017, T019, T021.
- **US2** (navigation buttons): T007, T008, T009, T010, T011, T018, T024.
- **US3** (orientation / hidden scrollbar / RTL): T006 (horizontal quirk), T012, T022, T023, T024.

---

## Notes

- `[P]` tasks touch different files with no unmet dependency between them; tasks in the same file are always sequential, per this feature's task-generation instructions.
- Tests (T004–T015) are written and confirmed failing before their corresponding Phase 3 implementation tasks.
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X, `CLAUDE.md`).
- `scroll-position.svelte.ts` (T016) must not import anything from `scroller.svelte.ts` or any `.svelte` file in this folder — it is the standalone module `scroll-spy` and `tour` (wave 3) will import directly (FR-010, plan.md "Deliverables & sequencing" item 1).
- `scroller-button.svelte` is a file of the component folder and is listed in the registry entry, but is deliberately not exported from the barrel (spec Assumption) — T004's harness imports it directly from its own path for the guard-rail test.
- Scroller has no value-bearing prop, so the constitution's controlled/uncontrolled test axis (T013) maps to `child`-mode element registration vs. the default owned `<div>`, plus `bind:ref`, exactly as plan.md "Callbacks/events" states — this is not a gap.
</content>
