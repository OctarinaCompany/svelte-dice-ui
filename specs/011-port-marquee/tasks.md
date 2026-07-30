---
description: 'Task list for the Marquee port'
---

# Tasks: Marquee

**Input**: Design documents from `/specs/011-port-marquee/` (plan.md, spec.md, research.md, data-model.md, contracts/public-api.md, quickstart.md)

**Tests**: Tests are MANDATORY per `CLAUDE.md` §7 and Constitution Principle III/VII. `marquee.test.ts` (colocated) plus a `marquee.test.svelte` harness for snippet/child/bind:ref cases that a `.ts` file cannot express.

**Organization**: Tasks are grouped by user story (US1 continuous scroll, US2 pause on hover/keyboard, US3 orientation/direction/edge) so each can be implemented and independently tested.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 — omitted for Setup, Foundational and Polish/Gate phases
- Every task names a concrete file path relative to the repository root

## Path Conventions

- Component source: `src/lib/components/ui/marquee/`
- Tests: `src/lib/components/ui/marquee/marquee.test.ts` + `marquee.test.svelte`
- Demo route: `src/routes/docs/components/marquee/+page.svelte`
- Registry: `registry.json` (repo root) + `src/app.css`

---

## Phase 1: Setup

**Purpose**: Nothing else in this feature compiles or renders until the CSS animation contract and the barrel/registry stubs exist.

- [X] T001 Add the six `@keyframes` (`marquee-left`, `marquee-right`, `marquee-left-rtl`, `marquee-right-rtl`, `marquee-up`, `marquee-down`) and the six `--animate-marquee-*` theme variables to `src/app.css`, transcribed from `.reference/diceui/docs/content/docs/components/radix/marquee.mdx` lines 45–108 with the stray brace fixed (research R-01). Nothing else in the file changes.
- [X] T002 [P] Create the empty component folder `src/lib/components/ui/marquee/` and an empty barrel stub `src/lib/components/ui/marquee/index.ts` (no exports yet — populated in T017) so later parallel tasks have a target directory.
- [X] T003 [P] Append the `marquee` registry stub to `registry.json` at the repo root: `name: "marquee"`, `type: "registry:ui"`, `title`, `description`, `registryDependencies: ["direction-provider"]`, `dependencies: ["tailwind-variants"]`, and a `files` array listing the six component files from the contract (index.ts, marquee.svelte, marquee-content.svelte, marquee-item.svelte, marquee-edge.svelte, marquee.svelte.ts) — `cssVars.theme` and `css` blocks are added later in T037 once the keyframes are final. Do not run `pnpm run registry:build` yet.

**Checkpoint**: `src/app.css` has the animation contract; the folder and registry entry exist as placeholders.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The value types, pure functions, size observer, `MarqueeState` and context must exist before any `.svelte` part or test can be written — every user story's tests and components import from `marquee.svelte.ts`.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Define `MARQUEE_SIDES`, `MARQUEE_ORIENTATIONS`, `MARQUEE_EDGE_SIZES` (`as const` tuples) and their derived types `MarqueeSide`, `MarqueeOrientation`, `MarqueeEdgeSize` in `src/lib/components/ui/marquee/marquee.svelte.ts`, importing `Direction` from `$lib/components/ui/direction-provider/direction-provider.svelte.js` (data-model.md §1).
- [X] T005 Implement the pure functions `sideToOrientation`, `resolveGap`, `resolveLoopCount`, `computeMarqueeDuration` (with its `DurationInput` type) and `computeAutoFillMultiplier` in `src/lib/components/ui/marquee/marquee.svelte.ts`, matching the branch table in data-model.md §2 exactly (speed floor `Math.max(0.001, speed)`, unmeasured branches, autoFill multiplier).
- [X] T006 Implement `observeMarqueeSizes(root, content, onResize)` and the `MarqueeSizes` type in `src/lib/components/ui/marquee/marquee.svelte.ts`: a single `ResizeObserver` over both elements, an eager initial `onResize` call, a no-op teardown when `window`/`ResizeObserver` is undefined (SSR/jsdom), and `observer.disconnect()` on teardown (data-model.md §3).
- [X] T007 Implement `MarqueeState` in `src/lib/components/ui/marquee/marquee.svelte.ts`: `MarqueeStateProps` (getter-function inputs per `CLAUDE.md` §4), `$state` fields (`paused`, `rootWidth`, `rootHeight`, `contentWidth`, `contentHeight`), all `$derived` values (`side`, `dir`, `orientation`, `isVertical`, `isRtl`, `rootSize`, `contentSize`, `duration`, `multiplier`, `gapValue`, `loopCountValue`, `pauseOnHover`, `pauseOnKeyboard`, `reverse`, `customProperties`) and methods `setSizes`, `togglePaused`, `onkeydown` (data-model.md §4). Depends on T004–T006.
- [X] T008 Add the `Symbol`-keyed context in `src/lib/components/ui/marquee/marquee.svelte.ts`: `MARQUEE_CONTEXT_KEY`, `setMarqueeContext(state)`, and `getMarqueeContext(consumerName)` that throws `` `${consumerName} must be used within `<Marquee.Root>`.` `` when the key is absent (data-model.md §5, `CLAUDE.md` §5). Depends on T007.

**Checkpoint**: `marquee.svelte.ts` exports everything the parts and tests need. User story work can begin.

---

## Phase 3: User Story 1 - Continuously scroll a row of content (Priority: P1) 🎯 MVP

**Goal**: `Marquee.Root` + `Marquee.Content` + `Marquee.Item` render a seamlessly looping track: two adjacent copies of the children (more under `autoFill`), driven entirely by CSS custom properties, honouring `prefers-reduced-motion`.

**Independent Test**: Render `Marquee.Root > Marquee.Content > Marquee.Item` in a fixed-width container; confirm two content tracks exist, the container has `role="marquee"`, and with `prefers-reduced-motion: reduce` simulated the tracks carry `motion-reduce:animate-none` while all item text stays present.

### Tests for User Story 1 (MANDATORY — write first, confirm they fail before implementation)

- [X] T009 [P] [US1] Add the `mode` discriminator harness to `src/lib/components/ui/marquee/marquee.test.svelte` covering every mode in plan.md deliverable 7: `default` (Root > Content > Item), `root-child` / `content-child` / `item-child` / `edge-child` (each part rendered through its `child` snippet), `bare-content` (Content with no Root), `bare-item` (Item with no Root), `bare-edge` (Edge with no Root), an `rtl-provider` mode wrapping the default tree in `<DirectionProvider dir="rtl">`, and `bind:ref` capture for all four parts (Root, Content, Item, Edge). Expose the captured refs and any caller props the tests need through the harness's own props.
- [X] T010 [P] [US1] Write the roles/ARIA + two-track test group in `src/lib/components/ui/marquee/marquee.test.ts`: root has `role="marquee"` + `aria-live="off"`; wrapper has `data-slot="marquee-wrapper"` + `class="grid"`; exactly two `[data-slot="marquee-content"]` render, both carrying `data-orientation` matching the root's; the second carries `data-clone=""` + `role="presentation"` + `aria-hidden="true"`, the first carries neither; item text is exposed to the accessibility tree exactly once.
- [X] T011 [P] [US1] Write the uncontrolled/copy-count and edge-case test group in `marquee.test.ts`: `autoFill` off ⇒ exactly two copies of children (`2 × multiplier` with `multiplier === 1`); `autoFill` on with a stubbed `ResizeObserver`/`getBoundingClientRect` (per research R-09, mirroring `badge-overflow.test.ts`) ⇒ multiplier > 1 and duration reflects it; zero measured size ⇒ falls back to `2000/speed` (`1000/speed` with `autoFill`) instead of dividing by zero; no children ⇒ renders both empty tracks without throwing; firing the stubbed `ResizeObserver` callback a second time with different `getBoundingClientRect` values updates `--marquee-duration` between the two measurements (FR-005, spec edge case "resize or content size change without a reload").
- [X] T012 [P] [US1] Write the reduced-motion test group in `marquee.test.ts`: both content tracks carry `motion-reduce:animate-none`; all item text remains present in the DOM regardless (content is never hidden to achieve the pause).
- [X] T013 [P] [US1] Write the pure-helper unit tests (no DOM) in `marquee.test.ts` for `sideToOrientation`, `resolveGap` (number → `px`, string passthrough), `resolveLoopCount` (`0`/`Infinity`/finite), `computeMarqueeDuration` (all six branches from data-model.md §2, explicitly including the `speed={0}` and `speed={-10}` floor cases producing a finite positive duration) and `computeAutoFillMultiplier` (content smaller/larger/zero).
- [X] T014 [P] [US1] Write the guard-rail test in `marquee.test.ts`: `<Marquee.Content>` rendered without `<Marquee.Root>` (via the `bare-content` harness mode) throws `/must be used within/`.
- [X] T014a [P] [US1] Write the bindings test group in `marquee.test.ts` using the `bind:ref` harness modes from T009: `bind:ref` on `Marquee.Root`, `Marquee.Item` and `Marquee.Edge` resolves to the element carrying that part's `data-slot`; `bind:ref` on `Marquee.Content` resolves to the **inner measured track** (the child div holding exactly one copy of `children`), not to the `[data-slot="marquee-content"]` animated wrapper and not to the decorative clone (contracts/public-api.md, "Measured element"); in `child` mode the root's `ref` stays `null`.

### Implementation for User Story 1

- [X] T015 [US1] Create `src/lib/components/ui/marquee/marquee.svelte`: module-script `MarqueeRootProps`/`MarqueeProps`/`MarqueeChildProps` types (contracts/public-api.md), instance script constructing `MarqueeState` via `setMarqueeContext`, calling `useDirection({ dir: () => dir })` from the direction-provider, building the merged attribute payload (`role="marquee"`, `aria-live="off"`, `dir`, `data-slot="marquee"`, `data-orientation`, `data-side`, `data-paused`, `data-pause-on-hover`, the four `--marquee-*` custom properties in `style`), and rendering the `data-slot="marquee-wrapper"` grid div wrapping either the default `<div>` or the `child` snippet. Root class composition per data-model.md §9. Depends on T007, T008.
- [X] T016 [US1] Create `src/lib/components/ui/marquee/marquee-content.svelte`: module-script `MarqueeContentProps`/`MarqueeContentChildProps` types and the `marqueeContentVariants` `tv()` object (data-model.md §8, base classes + `side`/`dir`/`pauseOnHover`/`reverse` variants + the two RTL compound variants), instance script calling `getMarqueeContext('<Marquee.Content>')`, an `$effect` registering both the root element and the inner measured track with `observeMarqueeSizes` and tearing it down, rendering the announced track (`bind:ref` on the inner div holding one copy of `children`, plus `multiplier − 1` extra copies, `restProps` landing here) and the decorative clone (`multiplier` copies, `data-clone`, `role="presentation"`, `aria-hidden="true"`, no `restProps`). Depends on T015 (needs the root's context and rootElement).
- [X] T017 [US1] Create `src/lib/components/ui/marquee/marquee-item.svelte`: module-script `MarqueeItemProps`/`MarqueeItemChildProps` types, instance script rendering `data-slot="marquee-item"` with base class `shrink-0` and caller `class` merged last — reads no context (research R-07), so it must render standalone without a provider.
- [X] T018 [US1] Populate `src/lib/components/ui/marquee/index.ts`: import `Root`/`Content`/`Item` (Edge added in T032), export short names, `Marquee`/`MarqueeContent`/`MarqueeItem` aliases, all prop types, and re-export `MARQUEE_SIDES`/`MARQUEE_ORIENTATIONS`/`MARQUEE_EDGE_SIZES`, `MarqueeState`, `setMarqueeContext`, `getMarqueeContext`, the five pure helpers and `observeMarqueeSizes` from `marquee.svelte.ts` per contracts/public-api.md "Non-component exports". Depends on T015–T017.

**Checkpoint**: User Story 1 is fully functional — a horizontal seamless loop renders, measures, and respects reduced motion. Run T009–T014a and confirm green before moving on.

---

## Phase 4: User Story 2 - Pause the scroll to read or interact with content (Priority: P2)

**Goal**: `pauseOnHover` and `pauseOnKeyboard` make the marquee pausable by pointer, keyboard focus, or both, with a visible focus indicator and correct tab-order behaviour.

**Independent Test**: Render with `pauseOnHover` and `pauseOnKeyboard` enabled; hover pauses and un-hover resumes; `Tab` focuses the root and `Space` toggles `data-paused` with `preventDefault`; with `pauseOnKeyboard={false}` the root is out of the tab order and Space does nothing.

### Tests for User Story 2 (MANDATORY — write first, confirm they fail before implementation)

- [X] T019 [P] [US2] Write the keyboard-pause test group in `marquee.test.ts` using `userEvent`: with `pauseOnKeyboard` (default `true`), `userEvent.tab()` focuses the root, focus-ring classes are present, `Space` toggles `data-paused` off→on→off with the keydown default prevented, and `Enter`/`ArrowRight`/`Escape` do nothing; with `pauseOnKeyboard={false}` the root has no `tabindex`, `userEvent.tab()` skips it, and `Space` does nothing.
- [X] T020 [P] [US2] Write the hover-pause test group in `marquee.test.ts`: `pauseOnHover` adds the `group` class to the root and `group-hover:[animation-play-state:paused]` + `group-focus-within:[animation-play-state:paused]` to both content tracks; assert both hover and focus-within pause independently (`FR-010`, edge case "hovered and keyboard-paused at once stays paused while either holds").
- [X] T021 [P] [US2] Write the composed-`onkeydown` test in `marquee.test.ts`: a caller-supplied `onkeydown` in `restProps` still fires alongside the component's own Space handler (research R-06) — assert both the caller's handler and the pause toggle occur on the same `Space` press.
- [X] T022 [P] [US2] Write the internal-pause-state test in `marquee.test.ts` confirming `paused` starts `false`, flips via `Space`, is reflected as `data-paused`, and is unaffected by changing unrelated props (research R-08 — asserted negatively since there is no controllable `paused` prop upstream).

### Implementation for User Story 2

- [X] T023 [US2] In `src/lib/components/ui/marquee/marquee.svelte`, wire the conditional `tabindex="0"` (present iff `pauseOnKeyboard`), the `focus-visible:` ring classes from data-model.md §9, and compose the root's `onkeydown` handler (`MarqueeState.onkeydown`) with any caller-supplied `onkeydown` from `restProps` so both run (research R-06) — extends T015, same file, sequential.

**Checkpoint**: User Stories 1 AND 2 both work independently. Run T019–T022 and confirm green.

---

## Phase 5: User Story 3 - Adapt orientation, direction and edge fade to the layout (Priority: P3)

**Goal**: `side="top"|"bottom"` switches to vertical scrolling; direction resolves through `direction-provider` and mirrors `left`/`right` under RTL; `Marquee.Edge` renders a decorative, non-interactive gradient fade sized `sm`/`default`/`lg`.

**Independent Test**: Render with `side="top"` in a fixed-height container and confirm vertical scrolling; render under `<DirectionProvider dir="rtl">` with `side="left"` and confirm the mirrored animation class; render `Marquee.Edge` and confirm it is decorative, positioned, and sized correctly.

### Tests for User Story 3 (MANDATORY — write first, confirm they fail before implementation)

- [X] T024 [P] [US3] Write the orientation test group in `marquee.test.ts`: `side="top"`/`"bottom"` ⇒ `data-orientation="vertical"` on both the root and both content tracks, `h-full flex-col` on the root and `min-h-full min-w-auto animate-marquee-up|down flex-col` on the content, `mb-(--marquee-gap)` gutter; `side="left"`/`"right"` ⇒ `data-orientation="horizontal"` on the root and both content tracks, `w-full`.
- [X] T025 [P] [US3] Write the direction-resolution test group in `marquee.test.ts` (using `DirectionProvider` from `$lib/components/ui/direction-provider/index.js`): no `dir` prop and no provider ⇒ `dir="ltr"`; wrapped in `<DirectionProvider dir="rtl">` ⇒ root `dir="rtl"` and content class `animate-marquee-left-rtl` (for `side="left"`) / `animate-marquee-right-rtl` (for `side="right"`); an explicit `dir="rtl"` prop overrides an `ltr` provider; `side="top"`/`"bottom"` unaffected by direction; RTL horizontal gutter is `ml-(--marquee-gap)` vs. LTR's `mr-(--marquee-gap)`.
- [X] T026 [P] [US3] Write the `reverse` test in `marquee.test.ts`: `reverse` adds `[animation-direction:reverse]` and sets the inline `animation-direction: reverse` independently of the side/direction-derived animation class (combines with RTL per the spec's edge case — assert both flip independently).
- [X] T027 [P] [US3] Write the `Marquee.Edge` test group in `marquee.test.ts` and `marquee.test.svelte` (`edge-child` mode): `side` is required (TypeScript-level, documented via a runtime render for each of the four sides); `data-slot="marquee-edge"`, `data-side`, `data-size` (defaults to `default`) always present; `aria-hidden="true"` and `pointer-events-none`; renders standalone without a `<Marquee.Root>` without throwing (research R-07); the six compound size classes (`w-1/6|1/4|1/3` horizontal, `h-1/6|1/4|1/3` vertical) match data-model.md §8.
- [X] T028 [P] [US3] Write the `child` composition test group in `marquee.test.ts` (using `root-child`/`content-child`/`item-child`/`edge-child` harness modes from `marquee.test.svelte`): each part's `child` snippet receives a payload with that part's `data-slot`, merged `class`, and (root only) `role`/`dir`/`tabindex`; rendering through `child` suppresses the default element while `Marquee.Content`'s decorative clone still renders.
- [X] T029 [P] [US3] Write the props/style-composition test group in `marquee.test.ts`: `speed`/`delay`/`gap`/`loopCount` produce the four `--marquee-*` custom properties (including `gap={16}` ⇒ `16px`, `speed={0}` and `speed={-10}` still producing a finite positive `--marquee-duration`, and `loopCount={3}` emitting `3` while `loopCount={0}`/`loopCount={Infinity}` emit `infinite`); `class` merges last on every part; root `style` appends after the custom properties, content `style` appends after the four `animation-*` longhands.

### Implementation for User Story 3

- [X] T030 [US3] In `src/lib/components/ui/marquee/marquee-content.svelte`, finish the `side`/`dir`/`pauseOnHover`/`reverse` variant wiring and the two RTL compound variants in `marqueeContentVariants`, and the horizontal/vertical gutter classes (`mr-(--marquee-gap)` LTR / `ml-(--marquee-gap)` RTL / `mb-(--marquee-gap)` vertical) — extends T016, same file, sequential.
- [X] T031 [US3] Create `src/lib/components/ui/marquee/marquee-edge.svelte`: module-script `MarqueeEdgeProps` (required `side`, `size` defaulting to `'default'`) and `MarqueeEdgeChildProps` types, the `marqueeEdgeVariants` `tv()` object with the six compound variants (data-model.md §8), instance script rendering `data-slot="marquee-edge"`, `data-side`, `data-size`, `aria-hidden="true"`, `pointer-events-none` — reads no context (research R-07), renders standalone.
- [X] T032 [US3] Update `src/lib/components/ui/marquee/index.ts` to add `Edge`/`MarqueeEdge` exports, `MarqueeEdgeProps`/`MarqueeEdgeChildProps` types, and `marqueeContentVariants`/`marqueeEdgeVariants` value exports — extends T018, same file, sequential.

**Checkpoint**: All three user stories are independently functional. Run T024–T029 and confirm green.

---

## Phase 6: Demo Route

**Purpose**: One documentation page demonstrating every upstream example, per `CLAUDE.md` §8 and FR-018.

- [X] T033 [P] [US1] Create `src/routes/docs/components/marquee/+page.svelte` with the page header and a "Default" `<ComponentPreview>` section mirroring `.reference/diceui/docs/registry/bases/radix/examples/marquee-demo.tsx`: a horizontal row of `Marquee.Item`s (no `autoFill`), use `Marquee.Item`'s `child` snippet for the card markup, mirroring upstream's `<MarqueeItem asChild>`, two `<Marquee.Edge side="left" />` / `<Marquee.Edge side="right" />` elements, and the root props `aria-label="Skateboard tricks showcase"`, `pauseOnHover` and `pauseOnKeyboard`.
- [X] T034 [US1] Add the "Logo Showcase" `<ComponentPreview>` section to `src/routes/docs/components/marquee/+page.svelte` mirroring `.reference/diceui/docs/registry/bases/radix/examples/marquee-logo-demo.tsx` (`autoFill` enabled), including its two `Marquee.Edge` elements — same file as T033, sequential.
- [X] T035 [US3] Add the "Vertical Layout" `<ComponentPreview>` section to `src/routes/docs/components/marquee/+page.svelte` mirroring `.reference/diceui/docs/registry/bases/radix/examples/marquee-vertical-demo.tsx`: `<Marquee.Root side="bottom" class="h-[320px]">` with testimonial cards rendered through `Marquee.Item`'s `child` snippet, plus `<Marquee.Edge side="top" />` and `<Marquee.Edge side="bottom" />`; pass `class="h-[400px]"` to `<ComponentPreview>` so the 320px marquee fits the canvas (research R-10) — same file as T033/T034, sequential.
- [X] T036 [US3] Add the "With RTL" `<ComponentPreview>` section to `src/routes/docs/components/marquee/+page.svelte` mirroring `.reference/diceui/docs/registry/bases/radix/examples/marquee-rtl-demo.tsx`, rendering both variants documented in research R-10: one `<Marquee.Root dir="rtl">` mirroring upstream directly, and one wrapped in `<DirectionProvider dir="rtl">` demonstrating ambient direction resolution, each with its two `Marquee.Edge` elements; plus the four props tables (Root/Content/Item/Edge), a data-attributes table (`[data-orientation]` on Root and Content, `[data-size]` on Edge) and a CSS-variables table (`--marquee-duration`, `--marquee-gap`, `--marquee-delay`, `--marquee-loop-count`), all built with `$lib/components/ui/table` and transcribed from the upstream MDX's `DataAttributesTable`/`CSSVariablesTable` — same file as T033–T035, sequential.

**Checkpoint**: `/docs/components/marquee` shows all four upstream examples.

---

## Phase 7: Registry Entry & Docs Polish

**Purpose**: Finalize the registry item with the CSS contract and rebuild the static registry output.

- [X] T037 Update the `registry.json` `marquee` entry (added in T003) with the final `cssVars.theme` block (all six `--animate-marquee-*` variables) and `css` block (all six `@keyframes`), matching contracts/public-api.md "CSS contract" and the final `src/app.css` content from T001.
- [X] T038 Run `pnpm run registry:build` and verify `static/r/marquee.json` has 6 files, 6 `cssVars.theme` keys, and 6 `css` keys via `node -e "const i=require('./static/r/marquee.json');console.log(i.files.length,Object.keys(i.cssVars.theme).length,Object.keys(i.css).length)"` (quickstart.md §3). Depends on T037.

---

## Phase 8: Quality Gates (MANDATORY — Principle VII)

**Purpose**: The feature is not complete until all four gates are green. No suppressions (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, deleted assertions, loosened configs) may be used to reach green — fix the root cause.

- [X] T039 Run `pnpm run format` first (Prettier writes; `pnpm run lint` runs `prettier --check .` and would otherwise fail on unformatted new files), then `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, in that order, and fix the root cause of everything that fails — no suppressions.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T002 creates the folder T004–T008 write into) — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational; its implementation task (T023) extends `marquee.svelte` from T015, so it starts after US1's T015 lands (same file). Tests T019–T022 can be written in parallel with US1.
- **User Story 3 (Phase 5)**: Depends on Foundational; T030 extends `marquee-content.svelte` from T016 and T032 extends `index.ts` from T018, so those two implementation tasks start after the corresponding US1 tasks land. Tests T024–T029 can be written in parallel with US1/US2.
- **Demo Route (Phase 6)**: Depends on US1–US3 implementation being complete (the demos exercise every prop).
- **Registry & Docs Polish (Phase 7)**: Depends on Phase 1's stub (T003) and the final component files existing.
- **Quality Gates (Phase 8)**: Depends on everything above — always last.

### Within Each User Story

- Tests (T009–T014a, T019–T022, T024–T029) are written and confirmed failing before their implementation tasks.
- `marquee.svelte.ts` (Foundational) before any part.
- `marquee.svelte` (Root) before `marquee-content.svelte` (Content needs the root's context/element).
- Root and Content before `index.ts` barrel population.

### Parallel Opportunities

- T002 and T003 (Setup) run in parallel with each other and after T001.
- T009–T014a (US1 tests) all run in parallel — different assertions in test files that don't yet exist meaningfully conflict, but they are additive edits to the same two test files, so in practice write them as one coordinated pass; mark `[P]` reflects that they're independent *authoring* units with no implementation dependency.
- T019–T022 (US2 tests) and T024–T029 (US3 tests) can be authored in parallel with US1's tests and with each other, since none depend on incomplete implementation.
- T033 kicks off the demo route; T034–T036 are sequential (same file).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks everything).
3. Complete Phase 3: User Story 1 — a horizontal, seamlessly-looping, reduced-motion-respecting marquee.
4. **STOP and VALIDATE**: run `pnpm run test:unit -- --run src/lib/components/ui/marquee/marquee.test.ts` and confirm the US1 test groups pass.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. User Story 1 → validate independently (seamless loop, reduced motion).
3. User Story 2 → validate independently (hover/keyboard pause, focus ring, tab order).
4. User Story 3 → validate independently (orientation, RTL mirroring, edge fade).
5. Demo route → Registry entry & docs polish → Quality gates.

---

## Notes

- [P] tasks touch different files, or are independent additive edits with no implementation dependency between them.
- [Story] labels map every Phase 3–5 task to US1/US2/US3 for traceability.
- Tests must be written and confirmed failing before their corresponding implementation task.
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X, `CLAUDE.md`).
- `pauseOnKeyboard` defaults to `true` per the spec's ratified Assumption (documented default wins over the conflicting source default).
- Direction is resolved through the existing `direction-provider` (`useDirection`), never a local `dir`-only prop, per the command's component-specific guidance.
- `prefers-reduced-motion` is honoured purely at the CSS layer (`motion-reduce:animate-none`); pause-on-hover has a keyboard-reachable equivalent (`group-focus-within:` + `pauseOnKeyboard`'s `tabindex`/`Space` handling), per the command's component-specific guidance.
</content>

---

## Phase 9: Convergence

**Purpose**: Close gaps found by auditing the implemented port against spec.md, plan.md and upstream
(`.reference/diceui/docs/registry/bases/radix/ui/marquee.tsx`,
`.reference/diceui/docs/content/docs/components/radix/marquee.mdx`).

- [X] T040 In `src/lib/components/ui/marquee/marquee.test.ts`, add the ambient-DOM-`dir` case to the
      "Marquee direction resolution (T025)" group: with no `dir` prop and no `<DirectionProvider>`, set
      `dir="rtl"` on `document.documentElement` (restoring it afterwards) and assert the root resolves
      to `dir="rtl"`, that both content tracks carry `animate-marquee-left-rtl`, and that the announced
      track carries `ml-(--marquee-gap)` — the third step of the documented resolution chain (`dir` prop
      → `<DirectionProvider>` → ambient DOM `dir` → `"ltr"`) is the only one with no assertion, per
      FR-013 / SC-002 (partial)
- [X] T041 In `src/lib/components/ui/marquee/marquee.test.ts`, add the combined-pause case to the
      "Marquee hover pause (T020)" group: with both `pauseOnHover` and `pauseOnKeyboard` enabled, press
      `Space` and assert the root carries `[&_*]:[animation-play-state:paused]` while both tracks still
      carry `group-hover:[animation-play-state:paused]` and
      `group-focus-within:[animation-play-state:paused]`, then press `Space` again and assert that only
      the keyboard pause is dropped — proving the animation stays paused while either condition holds,
      per FR-010 and the spec Edge Case "both `pauseOnHover` and `pauseOnKeyboard` … stays paused as
      long as either condition holds" (partial)
