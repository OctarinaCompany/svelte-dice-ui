---
description: 'Task list for Scroll Spy port'
---

# Tasks: Scroll Spy

**Input**: Design documents from `/specs/030-port-scroll-spy/` (plan.md, spec.md, research.md, data-model.md, contracts/scroll-spy.api.md, quickstart.md)

**Tests**: MANDATORY — Constitution Principle III and this feature's explicit request. Upstream floor:
`.reference/diceui/docs/registry/bases/radix/test/scroll-spy.test.tsx` (every assertion ported).

**Organization**: Custom phase order requested for this port — Setup → Tests → Core component files →
Barrel and types → Demo route → Registry entry and docs polish → Verification. `[Story]` labels
(`US1`-`US4`) trace tasks back to spec.md's user stories within that fixed phase order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to spec.md User Story 1-4 where applicable; infrastructure/polish tasks carry no label

## Path Conventions

- Component source: `src/lib/components/ui/scroll-spy/`
- Demo route: `src/routes/docs/components/scroll-spy/+page.svelte`
- Registry: `registry.json` (repository root)

---

## Phase 1: Setup

**Purpose**: Confirm dependencies and stub the files every later task edits, so no task creates a
file another task also creates.

- [X] T001 Confirm no new npm dependency is required: verify `bits-ui`, `tailwind-variants` are already
      in `package.json` and that `$lib/components/ui/direction-provider/index.ts` and
      `$lib/components/ui/scroller/index.ts` export `useDirection`/`Direction` and
      `readScrollMetrics` respectively (no code changes — record confirmation only, no file written)
- [X] T002 Create the empty component folder and stub files with only the module-script `Props`
      type placeholders (no logic yet) in `src/lib/components/ui/scroll-spy/scroll-spy.svelte`,
      `src/lib/components/ui/scroll-spy/scroll-spy-nav.svelte`,
      `src/lib/components/ui/scroll-spy/scroll-spy-link.svelte`,
      `src/lib/components/ui/scroll-spy/scroll-spy-viewport.svelte`,
      `src/lib/components/ui/scroll-spy/scroll-spy-section.svelte`
- [X] T003 [P] Stub `src/lib/components/ui/scroll-spy/section-observer.svelte.ts` with the exported
      type signatures for `observeSections`, `pickTopmostEntry`, `SectionRegistry`,
      `SectionObserverOptions` (bodies filled in during Core phase)
- [X] T004 [P] Stub `src/lib/components/ui/scroll-spy/scroll-spy.svelte.ts` with the exported
      constant/type signatures for `DEFAULT_ORIENTATION`, `DEFAULT_OFFSET`, `DEFAULT_THRESHOLD`,
      `SCROLL_SETTLE_DELAY`, `getDefaultScrollBehavior`, `ScrollSpyStateProps`, `ScrollSpyState`,
      `setScrollSpyContext`, `getScrollSpyContext` (bodies filled in during Core phase)

**Checkpoint**: folder and module skeletons exist; nothing renders or behaves yet.

---

## Phase 2: Tests

**Purpose**: Port every upstream assertion first, so implementation in Phase 3 has a red suite to turn
green. Write both the `.ts` spec and the `.svelte` harness now; both fail until Phase 3-4 land.

> **NOTE**: Run `pnpm run test:unit -- --run` after this phase and confirm every new test fails
> (not errors-out on missing files) before starting Phase 3.

- [X] T006 [P] Read `.reference/diceui/docs/registry/bases/radix/test/scroll-spy.test.tsx` in full and
      list every assertion group as inline comments (no test bodies yet) at the top of a new
      `src/lib/components/ui/scroll-spy/scroll-spy.test.ts`, to serve as the checklist the rest of
      this phase fills in
- [X] T007 [P] Create `src/lib/components/ui/scroll-spy/scroll-spy.test.svelte` harness exporting
      `ScrollSpyHarnessProps`/`ScrollSpyHarnessMode` (`'default' | 'root-child' | 'nav-child' |
      'link-child' | 'viewport-child' | 'section-child' | 'bare-part' | 'rtl-provider'`), modeled on
      `src/lib/components/ui/scroller/scroller.test.svelte`, covering: `child` snippet rendering for
      all five parts, `bind:ref`, a part rendered with no `<ScrollSpy.Root>` ancestor, and a
      `<DirectionProvider dir="rtl">` ancestor with no `dir` prop set on the root
- [X] T008 [US1] Write rendering & structure assertions in
      `src/lib/components/ui/scroll-spy/scroll-spy.test.ts`: three links + three sections render,
      `role="navigation"` on `<nav>`, three `role="link"`s, `href="#id"` per link (including the
      shared-prefix `intro`/`introduction`/`intro-details` case), `id` per section, `data-slot` on
      all five parts; the active link carries `aria-current="location"` and no inactive link does;
      the nav's accessible name is asserted via `screen.getByRole('navigation', { name: … })`
- [X] T009 [US1] Write every-prop assertions in
      `src/lib/components/ui/scroll-spy/scroll-spy.test.ts`: `orientation` on all five parts'
      `data-orientation`, `offset`, `threshold`, `rootMargin` (asserted on the captured
      `IntersectionObserver` constructor options), `scrollContainer` (container vs. `window.scrollTo`
      branches), `scrollBehavior` (explicit value, and `prefers-reduced-motion` default via an
      overridden `matchMedia`), `class` merge, `...restProps` passthrough
- [X] T010 [US1] Write passive-activation assertions (SC-001) in
      `src/lib/components/ui/scroll-spy/scroll-spy.test.ts` against a stubbed `IntersectionObserver`
      that captures its callback: topmost-of-several wins, non-intersecting entries ignored, an empty
      intersecting set leaves the previous value, an unregistered `id` is ignored, updates are
      suppressed during the 500ms post-click window (fake timers) and resume after it
- [X] T011 [US1] Write uncontrolled-state assertions in
      `src/lib/components/ui/scroll-spy/scroll-spy.test.ts`: `defaultValue` seeds the active link;
      clicking another link (via `userEvent`) moves it; assert without ever calling `rerender()` (see
      research R-06 / memory `bindable-prop-resets-on-props-invalidation`)
- [X] T012 [US2] Write click-to-navigate assertions in
      `src/lib/components/ui/scroll-spy/scroll-spy.test.ts` driven by `userEvent`: clicking (and
      `Enter` on a focused link) suppresses default navigation, scrolls the tracked area, and
      activates the link immediately; an integrator-supplied `onclick` still runs in addition to the
      built-in behaviour; feeding an intersection entry for a different section while the 500ms
      settle window is open does not move the active value
- [X] T013 [US2] Write keyboard-navigation assertions (FR-019) in
      `src/lib/components/ui/scroll-spy/scroll-spy.test.ts` via `userEvent`: `Tab` moves through the
      links in document order; `Enter` on a focused link activates it; `Space` does not change the
      value (native anchors do not fire `click` on `Space` — assert this matches real browser anchor
      behaviour, per research R-08)
- [X] T014 [US3] Write controlled-state assertions in
      `src/lib/components/ui/scroll-spy/scroll-spy.test.svelte` (via the harness, per
      `bindable-prop-resets-on-props-invalidation`): parent-owned `value` makes the parent
      authoritative, `onValueChange` fires with the next id on click without the displayed active
      state moving on its own, and changing the parent's `value` moves `data-state="active"` **and**
      triggers a scroll
- [X] T015 [US4] Write orientation-layout assertions in
      `src/lib/components/ui/scroll-spy/scroll-spy.test.ts`: both `horizontal` (default) and
      `vertical` orientations are reflected as `data-orientation` on all five parts with the expected
      layout classes on root and nav
- [X] T016 Write RTL assertions in `src/lib/components/ui/scroll-spy/scroll-spy.test.ts` and
      `scroll-spy.test.svelte`: `dir="rtl"` on the root propagates to `<nav>` and the viewport; a
      `<DirectionProvider dir="rtl">` ancestor (via the harness) is honoured when no `dir` prop is
      set on the root; link order and `href` values are unchanged
- [X] T017 Write guard-rail and edge-case assertions in
      `src/lib/components/ui/scroll-spy/scroll-spy.test.ts`: `Nav`/`Link`/`Viewport`/`Section` each
      throw `/must be used within/` when rendered outside a root (also via the harness's `bare-part`
      mode in `scroll-spy.test.svelte`); a section with `value=""` is not registered/observed; a link
      whose `value` matches no section still sets the active value and fires `onValueChange` on click
- [X] T018 Write teardown assertions (FR-018) in
      `src/lib/components/ui/scroll-spy/scroll-spy.test.ts`: unmount disconnects the
      `IntersectionObserver`, cancels the pending `requestAnimationFrame`, and clears the settle
      timeout — assert on spies, and add a positive pre-unmount activation assertion first so the
      post-unmount "no further `onValueChange`" check cannot pass vacuously (per memory
      `teardown-assertions-go-vacuous`)
- [X] T018a [P] [US1] Write `child`-snippet and `bind:ref` assertions (FR-016) in
      `src/lib/components/ui/scroll-spy/scroll-spy.test.svelte` + `scroll-spy.test.ts`: for each of
      the five parts, the caller's element is rendered in place of the default one and receives the
      merged props (`data-slot`, `data-orientation`, and for `Link` `data-state`); `Link` in `child`
      mode omits `href` (upstream line 387) while a `child`-rendered `<button>` still activates its
      section on click; `bind:ref` exposes the rendered element for every part in default mode and
      stays `null` when `child` is supplied
- [X] T018b [P] [US1] Write dynamic section-registration assertions (FR-018, research D-1) in
      `src/lib/components/ui/scroll-spy/scroll-spy.test.ts` against the stubbed
      `IntersectionObserver`: rendering a section conditionally after first paint disconnects the
      previous observer and constructs a new one observing the enlarged element set; removing a
      section unregisters it, re-creates the observer without it, and a subsequent intersection
      entry for the removed id no longer changes the active value; re-registering the same id with
      the same element does **not** re-create the observer (no effect loop)
- [X] T019 Run `pnpm run test:unit -- --run` and confirm every test added in T008-T018b fails for the
      expected reason (missing implementation, not a syntax/import error) before starting Phase 3

**Checkpoint**: full red test suite in place, covering US1-US4, RTL, guard rails and teardown.

---

## Phase 3: Core component files

**Purpose**: Implement the two runes modules, then the five parts, in upstream's documented
implementation order (plan.md "Implementation order").

- [X] T020 Implement `pickTopmostEntry`, `SectionRegistry` and `observeSections` (the
      `IntersectionObserver` wrapper: constructs the observer with `root`/`rootMargin`/`threshold`,
      batches callback updates to one `requestAnimationFrame`, returns a teardown function) in
      `src/lib/components/ui/scroll-spy/section-observer.svelte.ts`, ported from
      `.reference/diceui/docs/registry/bases/radix/ui/scroll-spy.tsx` lines 157-172 and 234-285
- [X] T021 Implement `getDefaultScrollBehavior`, the `ScrollSpyState` class (active value via
      `$bindable`-fed getter/setter props, section registry delegating to
      `section-observer.svelte.ts`, `scrollToSection` composing `readScrollMetrics` from
      `$lib/components/ui/scroller/index.js` for the container-vs-window branch and offset
      arithmetic, the 500ms "is scrolling" suppression window as a non-reactive field +
      `window.setTimeout` cleared on teardown) and the `Symbol`-keyed
      `setScrollSpyContext`/`getScrollSpyContext` pair (throwing with a part-specific message) in
      `src/lib/components/ui/scroll-spy/scroll-spy.svelte.ts`, ported from
      `.reference/diceui/docs/registry/bases/radix/ui/scroll-spy.tsx` lines 33-88 and 174-232
- [X] T022 [US1] [US2] [US4] Implement the Root part in
      `src/lib/components/ui/scroll-spy/scroll-spy.svelte`: `Props` type in
      `<script module>` per the Public API table (plan.md), instantiate `ScrollSpyState` and call
      `setScrollSpyContext`, resolve `dir` via `$lib/components/ui/direction-provider/index.js`
      `useDirection`-equivalent then ambient DOM `dir` then `'ltr'`, run `observeSections` in an
      `$effect` with teardown, render `<div data-slot="scroll-spy" data-orientation dir
      class="flex flex-row|flex-col">` with `child` snippet support, `bind:this={ref}`, `...restProps`
- [X] T023 [P] [US4] Implement the Nav part in
      `src/lib/components/ui/scroll-spy/scroll-spy-nav.svelte`: read context via
      `getScrollSpyContext('Nav')`, render `<nav data-slot="scroll-spy-nav"
      data-orientation dir class="flex gap-2 flex-col|flex-row">` (axis inverted relative to root, per
      plan.md), `child` snippet, `bind:this={ref}`
- [X] T024 [US2] Implement the Link part in
      `src/lib/components/ui/scroll-spy/scroll-spy-link.svelte`: required `value` prop, read context
      via `getScrollSpyContext('Link')`, `onclick` handler that calls
      `event.preventDefault()`, calls the integrator's `onclick` if supplied, then
      `state.scrollToSection(value)`; render `<a href="#{value}" data-slot="scroll-spy-link"
      data-orientation data-state="active"|"inactive">`, plus `aria-current="location"` on the active
      link and absent when inactive (FR-003), `child` snippet omitting `href` (upstream
      line 387), `bind:this={ref}`
- [X] T025 [P] [US4] Implement the Viewport part in
      `src/lib/components/ui/scroll-spy/scroll-spy-viewport.svelte`: read context via
      `getScrollSpyContext('Viewport')`, render `<div data-slot="scroll-spy-viewport"
      data-orientation dir class="flex flex-1 flex-col gap-8">`, `child` snippet, `bind:this={ref}`
- [X] T026 [US1] Implement the Section part in
      `src/lib/components/ui/scroll-spy/scroll-spy-section.svelte`: required `value` prop, read
      context via `getScrollSpyContext('Section')`, register/unregister with the
      section registry in an `$effect` with teardown (skip registration when `value` is falsy, per
      FR-012), render `<div id={value} data-slot="scroll-spy-section" data-orientation>` with **no**
      default classes (upstream applies none — caller's `class` passes straight through), `child`
      snippet, `bind:this={ref}`

**Checkpoint**: all five parts + two runes modules implemented; most of Phase 2's tests should now pass.

---

## Phase 4: Barrel and types

**Purpose**: Publish the public API surface exactly as documented in plan.md's "Public API" section.

- [X] T027 Create `src/lib/components/ui/scroll-spy/index.ts`: import all five parts; re-export
      `ScrollSpyRootProps` (alias `ScrollSpyProps`), `ScrollSpyNavProps`, `ScrollSpyLinkProps`,
      `ScrollSpyViewportProps`, `ScrollSpySectionProps` and each part's `*ChildProps`; re-export
      `ScrollSpyOrientation`, `SCROLL_SPY_ORIENTATIONS`, `DEFAULT_ORIENTATION`, `DEFAULT_OFFSET`,
      `DEFAULT_THRESHOLD`, `SCROLL_SETTLE_DELAY`, `getDefaultScrollBehavior`, `ScrollSpyState`,
      `ScrollSpyStateProps`, `setScrollSpyContext`, `getScrollSpyContext` from
      `./scroll-spy.svelte.js`; re-export `observeSections`, `pickTopmostEntry`, `SectionRegistry`,
      `SectionObserverOptions` from `./section-observer.svelte.js`; export short names (`Root`, `Nav`,
      `Link`, `Viewport`, `Section`) and prefixed aliases (`ScrollSpy`, `ScrollSpyNav`,
      `ScrollSpyLink`, `ScrollSpyViewport`, `ScrollSpySection`), matching the `tags-input` barrel
      pattern in CLAUDE.md §3

**Checkpoint**: `import * as ScrollSpy from '$lib/components/ui/scroll-spy/index.js'` and the named
import style both work; re-run `pnpm run test:unit -- --run` — every Phase 2 test should now pass.

---

## Phase 5: Demo route

**Purpose**: One documented example per upstream demo file plus the MDX-only sticky-layout example
(FR-017, SC-004).

- [X] T028 Create `src/routes/docs/components/scroll-spy/+page.svelte` with page heading/description
      and a "Default (Horizontal)" `<ComponentPreview>` mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/scroll-spy-demo.tsx`, using
      `$lib/components/docs/index.js` `ComponentPreview` and `$lib/components/ui/scroll-spy/index.js`;
      give this section's `<ScrollSpy.Nav>` a distinct `aria-label` (e.g. `aria-label="Default
      example sections"`); declare a page-level `let scrollContainer = $state<HTMLDivElement |
      null>(null)`, bind it with `bind:ref={scrollContainer}` on `<ScrollSpy.Viewport
      class="overflow-y-auto p-4">`, and pass it plus `offset={16}` to `<ScrollSpy.Root
      class="h-[400px] w-full border">`, mirroring the upstream demo's `ref={setScrollContainer}`
      wiring (one such state variable per example section)
- [X] T029 [US4] Add a "Vertical Orientation" `<ComponentPreview>` section to
      `src/routes/docs/components/scroll-spy/+page.svelte` mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/scroll-spy-vertical-demo.tsx`
      (same file as T028 — not `[P]`); give this section's `<ScrollSpy.Nav>` a distinct `aria-label`
      (e.g. `aria-label="Vertical example sections"`)
- [X] T030 [US3] Add a "Controlled" `<ComponentPreview>` section to
      `src/routes/docs/components/scroll-spy/+page.svelte` with page-owned `let value = $state(...)`
      and `onValueChange`, mirroring
      `.reference/diceui/docs/registry/bases/radix/examples/scroll-spy-controlled-demo.tsx` (same
      file as T028-T029 — not `[P]`); give this section's `<ScrollSpy.Nav>` a distinct `aria-label`
      (e.g. `aria-label="Controlled example sections"`)
- [X] T031 Add the MDX-only "Sticky Layout" `<ComponentPreview>` section (per plan.md) and the five
      props tables (Root, Nav, Link, Viewport, Section, transcribed from the Public API section of
      plan.md) to `src/routes/docs/components/scroll-spy/+page.svelte` (same file as T028-T030 — not
      `[P]`); give this section's `<ScrollSpy.Nav>` a distinct `aria-label` (e.g. `aria-label="Sticky
      layout example sections"`)

**Checkpoint**: demo route renders all four examples with no console errors; `pnpm run dev` preview
matches the upstream MDX behaviourally.

---

## Phase 6: Registry entry and docs polish

**Purpose**: Finalize distribution metadata (FR-017) and formatting.

- [X] T032 Append exactly one `scroll-spy` entry to `registry.json`: `type:
      "registry:ui"`, `title: "Scroll Spy"`, `description` from plan.md's Summary,
      `registryDependencies: ["direction-provider", "scroller"]` (both are imported from `$lib` by
      this component and are themselves registry items — matching how `marquee`, `scroller`,
      `tags-input` and `selection-toolbar` declare their internal composition),
      `dependencies: ["tailwind-variants"]` (the orientation class sets use `tv()`, per plan.md's
      Principle VIII row; no other npm package is added), and a `files` array listing every file
      under `src/lib/components/ui/scroll-spy/` **except** `scroll-spy.test.ts`
      and `scroll-spy.test.svelte`
- [X] T033 Run `pnpm run registry:build` and confirm `static/r/scroll-spy.json` is generated with
      `$lib/...` imports rewritten to registry placeholders
- [X] T034 Run `pnpm run format` across all files touched in Phases 1-6 (shadcn-style output is not
      Prettier-formatted) and fix any formatting the run reports

**Checkpoint**: registry entry complete and buildable; all touched files formatted.

---

## Phase 7: Verification

**Purpose**: Constitution Principle VII — the feature is not complete until all gates are green,
with no suppressions.

- [X] T035 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`,
      and fix everything that fails

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately
- **Tests (Phase 2)**: depends on Phase 1 stubs existing (imports must resolve, even if bodies are
  empty) — BLOCKS Phase 3
- **Core (Phase 3)**: depends on Phase 2's red suite existing; T020 → T021 → {T022} → {T023, T024,
  T025, T026} in upstream's documented order (plan.md "Implementation order")
- **Barrel (Phase 4)**: depends on all of Phase 3
- **Demo (Phase 5)**: depends on Phase 4 (imports the barrel)
- **Registry (Phase 6)**: depends on Phase 5 (file list must be final)
- **Verification (Phase 7)**: depends on everything above — always last

### Within Phase 2 (Tests)

- T006 and T007 are the scaffolding every other Phase 2 task edits into — T006 for `.test.ts`, T007
  for `.test.svelte`. T008-T018 each add assertions to one of those two already-created files, so
  none are `[P]` with respect to T006/T007 or to each other: they are logically independent per
  behavioural area, but they must be written sequentially to avoid conflicting edits to the same
  file. T018a and T018b are `[P]` with respect to T008-T018 (and each other) because by the time
  they run, T008-T018's assertion groups are already committed to the files and T018a/T018b append
  new, non-overlapping groups.
- T019 depends on all of T006-T018b.

### Within Phase 3 (Core)

- T020 (observer) has no dependency on T021.
- T021 (state class) imports the type surface from T020 but not its implementation — can start once
  T020's exports are stable.
- T022 (Root) depends on T020 and T021 (constructs `ScrollSpyState`, calls `observeSections`).
- T023, T025 (Nav, Viewport) depend only on T021's context getter — parallel with each other and
  with T024/T026 (different files).
- T024 (Link) and T026 (Section) depend only on T021's context getter — parallel with T023/T025.

### Parallel Opportunities

- T003, T004 (Phase 1 stubs) — different files.
- T008-T018 are **not** `[P]`: they append assertion groups to the two files scaffolded by T006/T007.
  They are logically independent per behavioural area, so their order among themselves is free, but
  they must be written sequentially to avoid conflicting edits to the same file.
- T018a, T018b — `[P]` with each other and with T008-T018: appended after T008-T018's groups are
  already committed, so there is nothing left for them to conflict with.
- T023, T024, T025, T026 (Phase 3 parts) — four different files, no cross-dependencies once T021 lands.

---

## Parallel Example: Phase 3 parts

```bash
# Once T020 and T021 are done, launch all four remaining parts together:
Task: "Implement Nav part in src/lib/components/ui/scroll-spy/scroll-spy-nav.svelte"
Task: "Implement Link part in src/lib/components/ui/scroll-spy/scroll-spy-link.svelte"
Task: "Implement Viewport part in src/lib/components/ui/scroll-spy/scroll-spy-viewport.svelte"
Task: "Implement Section part in src/lib/components/ui/scroll-spy/scroll-spy-section.svelte"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 (Setup) and Phase 2 (Tests, red).
2. Complete Phase 3 (Core) — this alone delivers US1 (passive tracking) and US2 (click-to-navigate),
   the two P1 stories.
3. Complete Phase 4 (Barrel) — the component is now importable and US3 (controlled state, P2) and
   US4 (orientation, P3) already work because they're configuration of the Phase 3 implementation,
   not separate code paths.
4. **STOP and VALIDATE**: `pnpm run test:unit -- --run` — confirm all Phase 2 tests pass.

### Incremental Delivery

1. Setup + Tests → Core → Barrel: full component functional and tested (all four user stories, since
   this component's stories are behavioural facets of one implementation, not separable slices).
2. Demo (Phase 5) → Registry (Phase 6): distributable and documented.
3. Verification (Phase 7): green gate, ship.

---

## Notes

- Unlike a typical multi-service feature, Scroll Spy's four user stories are not independently
  deployable slices of separate code — they are behavioural facets (passive tracking, click nav,
  controlled state, orientation) of the same five-part component, so Phases 3-4 implement all of
  them together; `[Story]` labels above indicate *which acceptance scenarios* a task serves, not a
  standalone increment.
- `[P]` tasks = different files, no dependencies — do not mark two tasks touching the same `.svelte`
  or `.ts` file as `[P]`.
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X).
- Do NOT touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json` or
  `.port-logs/`.

---

## Phase 8: Convergence

**Purpose**: Close the remaining gaps found by `/speckit-converge` between the shipped implementation
and spec.md / plan.md / tasks.md. All four quality gates are already green; these are parity-,
styling- and coverage-level items, not blockers of any P1 user story.

- [X] T036 Replace the inline orientation ternaries in
      `src/lib/components/ui/scroll-spy/scroll-spy.svelte` (`class: cn('flex', orientation === …)`)
      and `src/lib/components/ui/scroll-spy/scroll-spy-nav.svelte` (`class: cn('flex gap-2', …)`)
      with exported `tv()` variant objects declared in each part's `<script lang="ts" module>` —
      matching `src/lib/components/ui/scroller/scroller.svelte` and
      `src/lib/components/ui/marquee/marquee-content.svelte` — keeping the emitted class strings
      byte-identical to upstream (`flex flex-row|flex-col`, `flex gap-2 flex-col|flex-row`) and the
      caller's `class` merged last, and re-export both variant objects from
      `src/lib/components/ui/scroll-spy/index.ts` per plan: Constitution Check VIII (contradicts)
- [X] T037 After T036, set `"dependencies": ["tailwind-variants"]` on the `scroll-spy` entry in
      `registry.json` (currently `[]`) and re-run `pnpm run registry:build` so
      `static/r/scroll-spy.json` declares the npm package the parts now import per tasks T032
      (partial)
- [X] T038 Add a rapid-repeated-clicks assertion group to
      `src/lib/components/ui/scroll-spy/scroll-spy.test.ts` under fake timers: click one link, advance
      less than `SCROLL_SETTLE_DELAY`, click a second link, and assert the second link is active, that
      an observer entry fired after the *first* click's original deadline but inside the second
      click's window is still ignored, and that observer-driven activation resumes only once the
      latest window has elapsed per spec Edge Cases ("rapid repeated clicks") / SC-002 (missing)
- [X] T039 Assert FR-019's visible-focus-indicator clause in
      `src/lib/components/ui/scroll-spy/scroll-spy.test.ts`: after `userEvent.tab()` the focused link
      keeps the native anchor focus ring — i.e. its class list contains no outline suppression
      (`outline-none` / `focus:outline-none` / `focus-visible:outline-none`) — so a future styling
      change cannot silently remove the only focus indicator this component has per FR-019 (missing)

**Checkpoint**: re-run `pnpm run format`, `pnpm run check`, `pnpm run lint`,
`pnpm run test:unit -- --run` and `pnpm run build`; all must stay green with no suppressions.
