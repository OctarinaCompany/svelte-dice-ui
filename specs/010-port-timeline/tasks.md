---
description: 'Task list for the Timeline port'
---

# Tasks: Timeline

**Input**: Design documents from `/specs/010-port-timeline/` (plan.md, spec.md, research.md,
data-model.md, contracts/public-api.md, quickstart.md)

**Tests**: Tests are MANDATORY (Constitution Principle III / VII). All test tasks below write into
the two colocated test files at `src/lib/components/ui/timeline/timeline.test.svelte` and
`src/lib/components/ui/timeline/timeline.test.ts`, written and expected to **fail** before the
component files in Phase 3 exist (TDD).

**Organization**: Setup → Tests → Core component files → Barrel and types → Demo route → Registry
entry and docs polish → Verification, per the requested phase order. `[Story]` tags trace each task
back to `spec.md`'s user stories (US1 = render a chronological list, US2 = communicate progress via
`activeIndex`, US3 = orientation/variant/RTL) using the story↔test mapping in
`quickstart.md`'s Validation scenarios table; cross-cutting tasks (state module, barrel, demo,
registry, verification) carry no story tag, matching the template's Setup/Foundational/Polish
convention.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Traces the task to US1 / US2 / US3 from `spec.md`; omitted for cross-cutting tasks
- Every task names its exact file path(s)

## Path Conventions

- Component source: `src/lib/components/ui/timeline/`
- Tests: colocated at `src/lib/components/ui/timeline/timeline.test.ts` (+ harness
  `timeline.test.svelte`)
- Demo route: `src/routes/docs/components/timeline/+page.svelte`
- Registry: `registry.json` at the repository root

---

## Phase 1: Setup

**Purpose**: Confirm dependencies and stage the two shared "append points" (the component folder and
the registry entry) so every later task only edits existing files.

- [X] T001 Create empty stub files for all 13 Timeline source/test files under
      `src/lib/components/ui/timeline/`: `index.ts`, `timeline.svelte`, `timeline-item.svelte`,
      `timeline-dot.svelte`, `timeline-connector.svelte`, `timeline-content.svelte`,
      `timeline-header.svelte`, `timeline-title.svelte`, `timeline-description.svelte`,
      `timeline-time.svelte`, `timeline.svelte.ts`, `timeline.test.svelte`, `timeline.test.ts` — no
      new npm dependency is required (per plan.md: zero new dependencies; `tailwind-variants` and
      `$lib/components/ui/direction-provider` already ship in this repo).
- [X] T002 [P] Append a stub `timeline` entry to the `items` array in `registry.json` at the
      repository root: `name: "timeline"`, `type: "registry:ui"`, `title: "Timeline"`,
      `description` (from plan.md's registry entry shape), `registryDependencies: ["direction-provider"]`,
      `dependencies: ["tailwind-variants"]`, `files: []` — the `files` array is completed in Phase 6
      (T022) once every source file exists.

**Checkpoint**: folder and registry scaffolding exist; nothing renders yet.

---

## Phase 2: Tests (write first — MUST fail until Phase 3/4 land)

- [X] T003 Build the prop-driven test harness in
      `src/lib/components/ui/timeline/timeline.test.svelte`: accepts props for the nine-part tree
      (root orientation/variant/dir/activeIndex, per-item id/content), renders nested snippets for
      dot/connector/content/header/title/description/time, exposes `bind:ref` results and `child`
      snippet payloads for inspection, supports dynamically inserting/removing/reordering items, and
      supports rendering a single context-consuming part with no provider ancestor (per
      research.md R-14 and CLAUDE.md §7).
- [X] T004 [US1] [US2] Write accessibility roles-and-names tests (contract T-01–T-04) in
      `src/lib/components/ui/timeline/timeline.test.ts`: the root is `role="list"` and carries
      `data-orientation` matching `orientation`, and carries no `aria-orientation`; three items render
      as `role="listitem"` in source order; only the item at `activeIndex` carries `aria-current="step"`
      (none when unset);
      connectors carry `aria-hidden="true"` and are excluded from the accessibility tree;
      `Title`/`Description`/`Time` text is reachable and `<time>` renders a `datetime` distinct from
      its display text.
- [X] T005 [US2] Write controlled-vs-uncontrolled state tests (contract T-05–T-07, T-09) in
      `src/lib/components/ui/timeline/timeline.test.ts`: no `activeIndex` ⇒ every item
      `data-status="pending"` and nothing changes on interaction; `activeIndex={2}` over four items ⇒
      `completed, completed, active, pending`, and re-rendering with `activeIndex={0}` recomputes all
      four; `activeIndex={-1}` ⇒ all `pending`, `activeIndex={9}` ⇒ all `completed`; each connector's
      `data-completed` is present exactly when its next item is `completed`/`active`.
- [X] T006 Write keyboard-inertness tests (contract T-16) in
      `src/lib/components/ui/timeline/timeline.test.ts`: after clicking the rendered timeline and
      pressing Arrow×4/Home/End/Enter/Escape/Tab via `userEvent`, no `data-status`, `aria-current` or
      connector count changes (the component registers no key handler, per research.md R-13).
- [X] T007 [US3] Write RTL / orientation / variant tests (contract T-11–T-13) in
      `src/lib/components/ui/timeline/timeline.test.ts`: all four documented combinations
      (`orientation="vertical"|"horizontal"` × `variant="default"|"alternate"`) set
      `data-orientation`/`data-variant` on the root and `data-alternate-right` on odd-indexed items
      only under `alternate`; an explicit `dir="rtl"` lands on the root and every item, a wrapping
      `<DirectionProvider dir="rtl">` with no `dir` prop produces the same result, and an explicit
      `dir` prop wins over the provider; only logical utility classes (`ms-auto`, `pe-6`/`ps-6`,
      `text-end`, `-start-`/`-end-`) appear in the alternate variant's rendered class list — no
      physical `ml-auto`/`pr-6`/`pl-6`/`text-right`/`-left-`/`-right-` survives.
- [X] T008 [US1] [US2] Write edge-case and guard-rail tests (contract T-08, T-10, T-14, T-15, T-24,
      T-25) in `src/lib/components/ui/timeline/timeline.test.ts`: a three-item timeline renders two
      connectors and no connector after the last item, and `forceMount` keeps a connector mounted
      after the last item; adding a fourth item then removing the second recomputes every remaining
      item's `data-status` and connector count (live DOM order, FR-006); reordering already-mounted
      items in place (via the T003 harness) leaves indices unchanged — the documented upstream-parity
      limitation (a keyed move without remount does not recompute, since the collection only re-derives
      when the registered set changes); rendering `TimelineItem`, `TimelineDot`, `TimelineConnector` or
      `TimelineContent` without the required ancestor (using the T003 harness) throws
      `/must be used within/`; `TimelineHeader`/`Title`/`Description`/`Time` render standalone without
      throwing; unmounting an item removes it from the collection and unmounting the root leaves
      nothing behind; zero items renders an empty list with no `listitem`s and a single item renders no
      connector.
- [X] T009 Write barrel, pure-helper, styling and composition tests (contract T-17–T-23) in
      `src/lib/components/ui/timeline/timeline.test.ts`: every part carries its documented
      `data-slot` and a caller `class` survives and wins over the part's default classes; the root's
      class list carries both `--timeline-dot-size`/`--timeline-connector-thickness` declarations,
      `list-none`, and a caller override (`class="[--timeline-dot-size:2rem]"`) does not remove them;
      each part's `child` snippet receives the same merged attribute object the default element would,
      with `ref` staying `null` in `child` mode — except `TimelineItem`, where an item rendered through
      `child` that applies the payload's registration hook still receives the correct `data-status` and
      still yields a connector for its predecessor; `bind:ref` yields the correct node
      (`<ol>`/`<li>`/`<div>`/`<time>`) per part; arbitrary `restProps` (`id`, `aria-label`,
      `data-testid`) reach the rendered element on every part; a namespace import exposes all nine
      short names and the nine `Timeline*` aliases resolve to the same components; and
      `getTimelineItemStatus`/`sortByDocumentPosition` match their documented truth tables, including
      the missing-element ⇒ `0` comparator case.

**Checkpoint**: `timeline.test.ts` + `timeline.test.svelte` are complete and red (no component
implementation exists yet).

---

## Phase 3: Core component files

- [X] T010 Implement the state module in `src/lib/components/ui/timeline/timeline.svelte.ts`:
      `TIMELINE_ORIENTATIONS`/`TIMELINE_VARIANTS`/`TIMELINE_STATUSES` `as const` tuples + derived
      unions; `getTimelineItemStatus(itemIndex, activeIndex)`;
      `sortByDocumentPosition(entries)` (non-mutating, `compareDocumentPosition`-based); the
      `TimelineState` class (`#items` `$state` array, `register`/`unregister` replacing the array,
      `orderedIds`/`count` `$derived.by`, `getItemIndex`, `getItemStatus`, `getNextItemStatus`) per
      data-model.md; the `TimelineItemState` class (`id`/`index`/`status`/`isAlternateRight`/
      `nextStatus`/`isLast`/`isConnectorCompleted` `$derived`); and the two `Symbol`-keyed contexts
      with throwing getters, `setTimelineContext`/`getTimelineContext`/`setTimelineItemContext`/
      `getTimelineItemContext(consumerName)`, matching the exact error strings in
      contracts/public-api.md §5.
- [X] T011 [US1] [US3] Implement the Root in `src/lib/components/ui/timeline/timeline.svelte`:
      `TimelineRootProps` (+ `TimelineProps` alias) in the module script extending
      `WithElementRef<HTMLOlAttributes>` with `dir`/`orientation`/`variant`/`activeIndex`/`child`
      omitting the loose `dir?: string`; the `timelineVariants` `tv()` block — base `relative flex
      list-none [--timeline-connector-thickness:0.125rem] [--timeline-dot-size:0.875rem]`;
      `orientation` → vertical `flex-col`, horizontal `flex-row items-start`; compound rows
      vertical+default `gap-6`, horizontal+default `gap-8`, vertical+alternate `relative w-full
      gap-3`, horizontal+alternate `items-center gap-4`; defaults `orientation: 'vertical'`,
      `variant: 'default'`; call `useDirection({ dir: () => dir })` from
      `$lib/components/ui/direction-provider/index.js`; construct and
      `setTimelineContext(new TimelineState({ getOrientation, getVariant, getDir,
      getActiveIndex }))`; render `<ol role="list" dir={reader.current}
      data-slot="timeline" data-orientation data-variant class={cn(timelineVariants(...), className)}>`
      — `aria-orientation` is deliberately **not** rendered: ARIA does not support it on `role="list"`
      and Svelte's compiler flags it (`a11y_role_supports_aria_props`) in every spelling, which the
      Quality Gates and Principle VI forbid suppressing; `data-orientation` is the consumer hook
      instead — with `bind:this={ref}`, `...restProps`, and the `child` snippet branch.
- [X] T012 [US1] [US2] Implement the Item in `src/lib/components/ui/timeline/timeline-item.svelte`:
      `TimelineItemProps` extending `WithElementRef<HTMLLiAttributes>` with `id`/`child`; resolve
      `id` via `id ?? $props.id()`; read `getTimelineContext('<Timeline.Item>')`; construct and
      `setTimelineItemContext(new TimelineItemState({ getId: () => itemId }))`; declare and export the
      `timelineItemVariants` `tv()` block in the module script over a `relative flex` base, keyed on
      `orientation`/`variant`/`isAlternateRight`, porting all five upstream `compoundVariants` rows
      with logical utilities — vertical+default `gap-3 pb-8 last:pb-0`; horizontal+default
      `flex-col gap-3`; vertical+alternate+`isAlternateRight:false` `w-1/2 gap-3 pe-6 pb-12 last:pb-0`;
      vertical+alternate+`isAlternateRight:true` `ms-auto w-1/2 flex-row-reverse gap-3 pb-12 ps-6
      last:pb-0`; horizontal+alternate `grid min-w-0 grid-rows-[1fr_auto_1fr] gap-3`; a plain `$effect`
      (not `$effect.pre`, per research.md R-03) that calls `root.register(itemId, ref)` when `ref` is
      bound and returns `() => root.unregister(itemId)`; expose the registration binding on the
      `child` payload (`TimelineItemChildProps`) so an item rendered through `child` still registers
      its element — the payload's registration hook is what the caller must apply to its own element,
      since `ref` stays `null` in `child` mode and the registration `$effect` otherwise has nothing to
      read; render `<li role="listitem" aria-current={item.status === 'active' ? 'step' : undefined}
      data-slot="timeline-item" data-status={item.status} data-orientation={root.orientation}
      data-alternate-right={item.isAlternateRight ? '' : undefined} id={itemId} dir={root.dir}
      class={cn(timelineItemVariants({ orientation: root.orientation, variant: root.variant,
      isAlternateRight: item.isAlternateRight }), className)}>` with `bind:this={ref}`, `...restProps`,
      and the `child` snippet branch.
- [X] T013 [P] [US2] Implement the Dot in `src/lib/components/ui/timeline/timeline-dot.svelte`:
      `TimelineDotProps` extending `WithElementRef<HTMLAttributes<HTMLDivElement>>` with `child`;
      read `getTimelineContext`/`getTimelineItemContext`; the `timelineDotVariants` `tv()` block over
      the upstream base `relative z-10 flex size-[var(--timeline-dot-size)] shrink-0 items-center
      justify-center rounded-full border-2 bg-background`, keyed on
      `status`/`orientation`/`variant`/`isAlternateRight` — `completed` and `active` → `border-primary`,
      `pending` → `border-border` — plus the three upstream alternate `compoundVariants` rows with
      logical utilities: vertical+alternate+`isAlternateRight:false` `absolute
      -end-[calc(var(--timeline-dot-size)/2-var(--timeline-connector-thickness)/2)] bg-background`;
      vertical+alternate+`isAlternateRight:true` `absolute
      -start-[calc(var(--timeline-dot-size)/2-var(--timeline-connector-thickness)/2)] bg-background`;
      horizontal+alternate `row-start-2 bg-background`; render
      `<div data-slot="timeline-dot" data-status={item.status} data-orientation={root.orientation}
      class={cn(timelineDotVariants({ status: item.status, orientation: root.orientation,
      variant: root.variant, isAlternateRight: item.isAlternateRight }), className)}>`
      with `bind:this={ref}`, `...restProps`, `{@render children?.()}`, and the `child` branch.
- [X] T014 [P] [US1] [US2] Implement the Connector in
      `src/lib/components/ui/timeline/timeline-connector.svelte`: `TimelineConnectorProps` extending
      `WithElementRef<HTMLAttributes<HTMLDivElement>>` with `forceMount`/`child`; read
      `getTimelineContext`/`getTimelineItemContext`; return nothing (render nothing) when
      `item.isLast && !forceMount`, checked **before** the `child` branch (research.md R-05); the
      `timelineConnectorVariants` `tv()` block over an `absolute z-0` base, keyed on
      `isCompleted`/`orientation`/`variant`/`isAlternateRight`, where **`isCompleted` is
      `item.isConnectorCompleted` (derived from the NEXT item's status), not the owning item's
      `status`** — `true: 'bg-primary'`, `false: 'bg-border'` — plus all five upstream
      `compoundVariants` rows with logical utilities: vertical+default
      `start-[calc(var(--timeline-dot-size)/2-var(--timeline-connector-thickness)/2)] top-3
      h-[calc(100%+0.5rem)] w-[var(--timeline-connector-thickness)]`; horizontal+default
      `start-3 top-[calc(var(--timeline-dot-size)/2-var(--timeline-connector-thickness)/2)]
      h-[var(--timeline-connector-thickness)] w-[calc(100%+0.5rem)]`;
      vertical+alternate+`isAlternateRight:false` `top-2
      -end-[calc(var(--timeline-connector-thickness)/2)] h-full w-[var(--timeline-connector-thickness)]`;
      vertical+alternate+`isAlternateRight:true` `top-2
      -start-[calc(var(--timeline-connector-thickness)/2)] h-full w-[var(--timeline-connector-thickness)]`;
      horizontal+alternate `top-[calc(var(--timeline-dot-size)/2-var(--timeline-connector-thickness)/2)]
      start-3 row-start-2 h-[var(--timeline-connector-thickness)] w-[calc(100%+0.5rem)]`; render
      `<div aria-hidden="true"
      data-slot="timeline-connector" data-completed={item.isConnectorCompleted ? '' : undefined}
      data-status={item.status} data-orientation={root.orientation}
      class={cn(timelineConnectorVariants({ isCompleted: item.isConnectorCompleted,
      orientation: root.orientation, variant: root.variant, isAlternateRight: item.isAlternateRight }),
      className)}>` with `bind:this={ref}`, `...restProps`, and the `child` branch.
- [X] T015 [P] [US1] Implement the Content in
      `src/lib/components/ui/timeline/timeline-content.svelte`: `TimelineContentProps` extending
      `WithElementRef<HTMLAttributes<HTMLDivElement>>` with `child`; read `getTimelineContext`/
      `getTimelineItemContext`; the `timelineContentVariants` `tv()` block (orientation/variant/side
      spacing, logical utilities per research.md R-08); render
      `<div data-slot="timeline-content" data-status={item.status}>` with `bind:this={ref}`,
      `...restProps`, `{@render children?.()}`, and the `child` branch.
- [X] T016 [P] [US1] Implement the Header in
      `src/lib/components/ui/timeline/timeline-header.svelte`: `TimelineHeaderProps` extending
      `WithElementRef<HTMLAttributes<HTMLDivElement>>` with `child`; no context read; render
      `<div data-slot="timeline-header" class={cn('...', className)}>` with `bind:this={ref}`,
      `...restProps`, `{@render children?.()}`, and the `child` branch.
- [X] T017 [P] [US1] Implement the Title in
      `src/lib/components/ui/timeline/timeline-title.svelte`: `TimelineTitleProps` extending
      `WithElementRef<HTMLAttributes<HTMLDivElement>>` with `child`; no context read; render
      `<div data-slot="timeline-title" class={cn('...', className)}>` with `bind:this={ref}`,
      `...restProps`, `{@render children?.()}`, and the `child` branch.
- [X] T018 [P] [US1] Implement the Description in
      `src/lib/components/ui/timeline/timeline-description.svelte`: `TimelineDescriptionProps`
      extending `WithElementRef<HTMLAttributes<HTMLDivElement>>` with `child`; no context read;
      render `<div data-slot="timeline-description" class={cn('text-muted-foreground ...',
      className)}>` with `bind:this={ref}`, `...restProps`, `{@render children?.()}`, and the
      `child` branch.
- [X] T019 [P] [US1] Implement the Time in `src/lib/components/ui/timeline/timeline-time.svelte`:
      `TimelineTimeProps` extending `WithElementRef<HTMLTimeAttributes, HTMLTimeElement>` with an
      explicit `dateTime?: string` upstream-parity alias and `child`; no context read; render
      `<time data-slot="timeline-time" datetime={restProps.datetime ?? dateTime}
      class={cn('text-muted-foreground ...', className)}>` with `bind:this={ref}`, `...restProps`
      spread after the computed `datetime` so a caller-supplied native `datetime` wins, `{@render
      children?.()}`, and the `child` branch.

**Checkpoint**: all nine parts + the state module exist; `timeline.test.ts` tests that don't need the
barrel (T004–T008, most of T009) should now pass when imported directly from their `.svelte` files.

---

## Phase 4: Barrel and types

- [X] T020 Implement the barrel in `src/lib/components/ui/timeline/index.ts`: import all nine parts
      (`Root`, `Item`, `Dot`, `Connector`, `Content`, `Header`, `Title`, `Description`, `Time`) from
      T011–T019; `export type` every `<Part>Props` and every `<Part>ChildProps`; `export` the short
      names, the nine `Timeline*` aliases (`Root as Timeline`, `Item as TimelineItem`, …), the five
      `tv()` exports (`timelineVariants`, `timelineItemVariants`, `timelineContentVariants`,
      `timelineDotVariants`, `timelineConnectorVariants`), and re-export from `timeline.svelte.ts`:
      `TimelineState`, `TimelineItemState`, `setTimelineContext`, `getTimelineContext`,
      `setTimelineItemContext`, `getTimelineItemContext`, `getTimelineItemStatus`,
      `sortByDocumentPosition`, `TIMELINE_ORIENTATIONS`, `TIMELINE_VARIANTS`, `TIMELINE_STATUSES`
      and their value types — per contracts/public-api.md §1. Do not re-export `Direction` (owned by
      `direction-provider`) or anything from `timeline.test.svelte`.

**Checkpoint**: `import * as Timeline from '$lib/components/ui/timeline/index.js'` resolves; T009's
barrel-export assertions and every remaining red test in Phase 2 should now be green.

---

## Phase 5: Demo route

- [X] T021 [US1] [US2] [US3] Create the demo route at
      `src/routes/docs/components/timeline/+page.svelte`: one `<ComponentPreview>` section per
      upstream demo — **Default** (`timeline-demo.tsx`, vertical, `activeIndex` control), **Horizontal**
      (`timeline-horizontal-demo.tsx`), **RTL** (`timeline-rtl-demo.tsx`, wrapped in
      `dir="rtl"`), **Alternate** (`timeline-alternate-demo.tsx`), **Horizontal Alternate**
      (`timeline-horizontal-alternate-demo.tsx`) and **Custom Dot** (`timeline-custom-dot-demo.tsx`,
      icon children + `[--timeline-dot-size:2rem]` override) — plus one props table per part (all
      nine parts) in an API section, using `$state` for any interactive `activeIndex` control per
      CLAUDE.md §8.

**Checkpoint**: `/docs/components/timeline` renders all six previews with live state.

---

## Phase 6: Registry entry and docs polish

- [X] T022 Complete the `timeline` entry stubbed in `registry.json` (T002): fill its `files` array
      with all 11 shipped source files (`index.ts`, the nine `.svelte` parts, `timeline.svelte.ts`),
      each `{ "path": "src/lib/components/ui/timeline/<file>", "type": "registry:ui" }`; do **not**
      list `timeline.test.svelte` or `timeline.test.ts`.
- [X] T023 Run `pnpm run registry:build` and verify `static/r/timeline.json` exists, its `files`
      array has length 11, and `registryDependencies` is `["direction-provider"]`.

**Checkpoint**: the component installs through the registry the same way every other ported
component does (SC-005).

---

## Phase 7: Verification (MANDATORY — Constitution Principle VII)

**Purpose**: No suppression (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`,
`as any`, `.skip`/`.todo`, deleted assertions, loosened configs) may be used to reach green — fix the
root cause.

- [X] T024 Run `pnpm run format` (shadcn/generator-style output is not Prettier-formatted; run this
      before the gates below).
- [X] T025 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`,
      and fix everything that fails.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Tests (Phase 2)**: depends on T001 (files must exist to be edited); T004–T009 all edit
  `timeline.test.ts` sequentially and are expected to fail (red) until Phase 3/4 land.
- **Core component files (Phase 3)**: depends on Phase 2 existing (tests-first); T010 (state module)
  blocks T011–T019; T011 (Root) blocks T012 (Item); T012 blocks T013–T015 (Dot/Connector/Content read
  item context); T016–T019 (Header/Title/Description/Time) need only T010 and are otherwise
  independent of T011–T015.
- **Barrel and types (Phase 4)**: T020 depends on all of T011–T019.
- **Demo route (Phase 5)**: T021 depends on T020 (imports the barrel).
- **Registry entry and docs polish (Phase 6)**: T022 depends on T002 (stub) and on every file in
  Phases 3–4 existing; T023 depends on T022.
- **Verification (Phase 7)**: depends on everything above; always last.

### Parallel Opportunities

- T002 (registry stub) can run alongside T001 finishing, or immediately after.
- T013, T014, T015, T016, T017, T018, T019 can all be implemented in parallel once T010–T012 are
  done — each is a distinct file with no cross-file editing.
- T004–T009 cannot run in parallel with each other (same file, `timeline.test.ts`); T003 (the
  `.svelte` harness) is a separate file and may be drafted alongside them but is needed by T008.

---

## Parallel Example: Phase 3 body parts

```bash
# After T010 (state module) and T012 (Item) are done, launch together:
Task: "Implement the Dot in src/lib/components/ui/timeline/timeline-dot.svelte"
Task: "Implement the Connector in src/lib/components/ui/timeline/timeline-connector.svelte"
Task: "Implement the Content in src/lib/components/ui/timeline/timeline-content.svelte"
Task: "Implement the Header in src/lib/components/ui/timeline/timeline-header.svelte"
Task: "Implement the Title in src/lib/components/ui/timeline/timeline-title.svelte"
Task: "Implement the Description in src/lib/components/ui/timeline/timeline-description.svelte"
Task: "Implement the Time in src/lib/components/ui/timeline/timeline-time.svelte"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup) and the US1-relevant slice of Phase 2 (T003, T004, T008 minus the
   `activeIndex`-specific assertions).
2. Complete Phase 3's T010 (state module), T011 (Root), T012 (Item), T014 (Connector), T015–T019
   (Content/Header/Title/Description/Time) — Dot (T013) is cosmetic but cheap, include it too.
3. Complete Phase 4 (T020) and validate: three items render as an ordered list with connectors
   between them and none after the last.

### Incremental Delivery

1. Setup + Tests scaffolding → Phase 3/4 → **US1 MVP** (chronological list renders, list semantics
   correct, connectors present/absent correctly).
2. Add US2 depth: `activeIndex` status derivation is already implemented by T010/T012/T013/T014 —
   validate via T005's tests (completed/active/pending, `aria-current`, connector completion).
3. Add US3 breadth: `orientation`/`variant`/`dir` are already implemented by T011 — validate via
   T007's tests (all four layout combinations, RTL mirroring).
4. Phase 5 (demo route) → Phase 6 (registry) → Phase 7 (quality gates) close out the feature.

---

## Notes

- [P] tasks touch different files with no dependency on an incomplete task.
- `[Story]` labels trace to `spec.md`'s US1/US2/US3; cross-cutting tasks (state module, barrel, demo,
  registry, verification) carry none, matching the Setup/Foundational/Polish convention.
- Do NOT run git write commands and do NOT touch `.reference/`, `.specify/`, `.claude/`, `scripts/`,
  `.port-state.json` or `.port-logs/` — the orchestrator owns the working tree (Principle X).
- Every `it` in `timeline.test.ts` must assert at least once (`expect.requireAssertions` is on) and
  none may be `.skip`/`.todo`.
