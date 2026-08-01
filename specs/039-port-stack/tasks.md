---
description: 'Task list for the Stack port'
---

# Tasks: Stack

**Input**: Design documents from `/specs/039-port-stack/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/public-api.md, quickstart.md (all present)

**Tests**: MANDATORY (constitution Principle III / VII). Colocated at
`src/lib/components/ui/stack/stack.test.ts`, with a `stack.test.svelte` harness for `child`
snippets, `{#each}` reordering and the no-provider guard rail (plan §"Testing").

**Component-specific note**: Stack has no `value`/`defaultValue`/`onValueChange`/`disabled`
upstream, so "controlled vs uncontrolled" is tested via its nearest real equivalent — the internal
hover expand/collapse state machine plus the `expandOnHover={false}` "the parent is authoritative"
case (plan.md, Note on Principle III). "Keyboard interaction" is tested via the pointer-driven
expand/collapse Stack actually exposes, plus `Tab` reachability of content inside a collapsed item
(no dedicated keyboard widget applies — spec.md Assumptions).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps a test task to the spec.md user story it verifies (US1/US2/US3)

## Path Conventions

- Component source: `src/lib/components/ui/stack/`
- Demo route: `src/routes/docs/components/stack/+page.svelte`
- Registry: `registry.json` (repository root)

---

## Phase 1: Setup

**Purpose**: Confirm no new dependency is needed and stub the registry entry.

- [X] T001 [P] Verify no new npm dependency is required for Stack: confirm `tailwind-variants` is
      listed in `package.json`, and that `DomOrderedCollection` is exported from
      `src/lib/components/ui/speed-dial/index.ts` for reuse (research.md, plan.md "Primary
      Dependencies"). No source change expected; this task only records the confirmation so later
      tasks do not re-derive it.
- [X] T002 [P] Add a placeholder `stack` entry to `registry.json` (repository root): `"name": "stack"`,
      `"type": "registry:ui"`, `"title": "Stack"`, `"description": "A component that displays items in
      a stacked layout with hover expansion effects, similar to Sonner toast stacking."` (verbatim from
      `contracts/public-api.md`), `"registryDependencies": ["speed-dial"]`, `"files": []` — to be
      completed with the real file list in Phase 6 (T014).

**Checkpoint**: Dependencies confirmed, registry stub present.

---

## Phase 2: Tests (write first — MUST fail before Phase 3 implementation)

**Purpose**: Encode every quickstart.md scenario (1–15) as an assertion before any component file
exists, per constitution Principle VII / CLAUDE.md §7.

- [X] T003 [P] Create the test harness component `src/lib/components/ui/stack/stack.test.svelte`: a
      `Stack.Root`/`Stack.Item` pair each rendered through a `child` snippet (capturing the spread
      payload for assertions), an `{#each}`-driven list of `Stack.Item`s whose backing array can be
      mutated from the test to add/remove items, and a bare `Stack.Item` rendered with no
      `Stack.Root` ancestor (quickstart.md scenarios 9, 12, 13).
- [X] T004 [US1] Write accessibility roles-and-names tests in `src/lib/components/ui/stack/stack.test.ts`:
      render a collapsed stack with a `<button>` inside the last item and assert it is still
      `getByRole('button')`-queryable regardless of visibility state (scenario 14); using the T003
      harness, assert rendering `Stack.Item` without a `Stack.Root` throws
      `` /`<Stack.Item>` must be used within `<Stack.Root>`/`` (scenario 12, data-model.md "Context
      contract"). Depends on: T003.
- [X] T005 [US1] Write keyboard-interaction tests in `src/lib/components/ui/stack/stack.test.ts`: using
      `userEvent.tab()`, assert the `<button>` inside a collapsed, non-front item is reachable and
      receives focus (scenario 14, since content never becomes `display:none`/`aria-hidden`); using
      `userEvent.hover`/`userEvent.unhover` on the root, assert the pointer-driven expand
      (`data-state="collapsed"` → `"expanded"`) and collapse (`"expanded"` → `"collapsed"`) transitions
      Stack exposes in place of key-driven interaction (scenarios 1–3).
- [X] T006 [US1][US2] Write controlled-vs-uncontrolled-equivalent tests in
      `src/lib/components/ui/stack/stack.test.ts`: assert the collapsed baseline attribute set —
      `data-state="collapsed"`, per-wrapper `data-index`, `--translate: {i*10}px`,
      `--item-scale: {1-0.05i}`, `z-index: {5-i}`, `opacity: {1-0.15i}`, and items past `itemCount`
      carrying `data-visible="false"` / `opacity: 0` / `pointer-events-none` (scenario 1); assert hover
      sets `data-state="expanded"` / `data-expanded="true"` with `--item-scale: 1` and
      `--translate: {i*gap + sizeBefore}px` on every wrapper (scenario 2); assert unhover restores
      scenario 1 (scenario 3); assert `pointerdown` on the root followed by `unhover` keeps the stack
      expanded until a `pointerup` dispatched on `document` allows a further `unhover` to collapse it
      (scenario 4, research R-06); assert `expandOnHover` omitted/`false` leaves
      `data-state="collapsed"` unchanged under hover/mousemove/unhover (US2, scenario 5); assert a
      caller `onmouseenter` that calls `preventDefault()` runs but suppresses the stack's own expansion
      (scenario 15, FR-013); assert the root's inline style declares `--gap`, `--offset` and `--scale`
      from the props and that a caller-supplied `style` is appended after them, so the caller's value
      wins (contracts/public-api.md "Custom properties").
- [X] T007 [US3] Write RTL tests in `src/lib/components/ui/stack/stack.test.ts`: render the collapsed
      scenario-1 stack inside `dir="rtl"` and assert identical data attributes and `--translate`
      values to LTR, and that the wrapper class list contains `start-0`/`after:start-0` and never
      `left-0`/`after:left-0` (scenario 11); assert one root with `side="top"` translates each
      non-front item negatively and carries the top-anchored origin/position classes, while
      `side="bottom"` (default) translates positively and carries the bottom-anchored classes, with
      every other attribute identical between the two (scenario 6).
- [X] T008 Write edge-case tests in `src/lib/components/ui/stack/stack.test.ts`: fewer children than
      `itemCount` renders all of them `data-visible="true"` with `z-index` `2,1` and no crash
      (scenario 7); `expandedItemCount={2}` with 5 items keeps items 2–4 `data-visible="false"` /
      `opacity: 0` / `pointer-events-none` while expanded (scenario 8); using the T003 harness's
      `{#each}` list, removing the first of 3 items renumbers the remaining items' `data-index` to
      `0,1`, moves the front flag, and updates `z-index` to `2,1` with no stale offset (scenario 9);
      assert the wrapper and card class lists contain `motion-reduce:transition-none` (scenario 10);
      using the T003 harness's `child`-snippet render, assert the spread payload reproduces every
      `data-*` attribute, `class` and handler, that `children` is not rendered twice, and that `ref`
      stays `null` until bound (scenario 13); assert the expanded wrapper class list contains
      `after:h-[calc(var(--gap)+1px)]` and the side-appropriate bridge utilities
      (`after:absolute after:bottom-full after:start-0 after:w-full after:content-['']` for
      `side="bottom"`, `after:top-full` for `side="top"`), and that the collapsed wrapper carries the
      bridge utilities but **not** `after:h-[calc(var(--gap)+1px)]` (FR-020); assert a caller `class`
      passed to `Stack.Root` and to `Stack.Item` appears in the rendered class list and wins over the
      component's own conflicting utility (Tailwind-merge precedence, FR-013). Depends on: T003.

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/stack/stack.test.ts` fails (module
not found) — expected, since Phase 3 has not run yet.

---

## Phase 3: Core component files

**Purpose**: Implement the state class and the two public parts.

- [X] T009 Implement `src/lib/components/ui/stack/stack.svelte.ts` per data-model.md: `STACK_SIDES`
      const array and `StackSide` type; `StackState` class taking getter-function inputs (`getSide`,
      `getItemCount`, `getExpandedItemCount`, `getGap`, `getScale`, `getOffset`, `getExpandOnHover`),
      owned `expanded`/`interacting` `$state`, a `#items` `DomOrderedCollection` (imported from
      `src/lib/components/ui/speed-dial/index.ts`) and a `#sizes` `SvelteMap<string, number>`; derived
      `itemsCount`/`visibleCount`/`dataState`/`styleProps`; the public item-registry API used by
      `stack-item.svelte` (data-model.md "Lifecycle"): `register(id, element)` / `unregister(id)`
      delegating to `#items`, `indexOf(id): number` reading `DomOrderedCollection.indexById`,
      `setSize(id, size)` / `releaseSize(id)` over `#sizes` (idempotent, size clamped to `>= 0`);
      per-index methods `isFront`, `isVisible`,
      `sizeBefore`, `itemScale`, `translate`, `zIndex`, `opacity`; commands `onPointerEnter`,
      `onPointerMove`, `onPointerLeave`, `onPressStart`, `onPressEnd`; a module-private
      `STACK_CONTEXT_KEY` Symbol with `setStackContext`/`getStackContext`, the latter throwing
      `` `<Stack.Item>` must be used within `<Stack.Root>`. `` when absent.
- [X] T010 [P] Implement `src/lib/components/ui/stack/stack-item.svelte` per plan.md "Structure
      Decision" and data-model.md "Entity: StackItemEntry": `stackItemWrapperVariants` built with
      `tv()` in the module script (axes `side`, `isExpanded`, `isVisible`, replacing upstream `cva`);
      an id from `$props.id()`; a registration+measurement `$effect` that registers the wrapper element
      with `getStackContext()`'s registry, measures its natural size with an untracked `SvelteMap`
      write, and on teardown unregisters the id and releases its size; wrapper attributes
      `data-slot="stack-item-wrapper"`, `data-index`, `data-front`, `data-visible`, `data-expanded`
      (string `"true"`/`"false"`, per plan.md Complexity Tracking), per-item `--translate`/
      `--item-scale` custom properties, `motion-reduce:transition-none`, logical `start-0`/
      `after:start-0` (never `left-0`); a card element with base classes
      `rounded-lg border bg-card p-4 shadow-sm transition-shadow duration-200 hover:shadow-md
      motion-reduce:transition-none` merged with the caller's `class` last through `cn()` (FR-011),
      `data-slot="stack-item"`, `data-index`, `data-position`, `data-state`, and a `child` snippet
      that replaces only the card. Depends on: T009.
- [X] T011 [P] Implement `src/lib/components/ui/stack/stack.svelte` per plan.md "Structure Decision":
      module-script `StackRootProps` (`side`, `itemCount`, `expandedItemCount`, `gap`, `scale`,
      `offset`, `expandOnHover`, `class`, `style`, `ref`) with upstream JSDoc/`@default` copied
      verbatim from `contracts/public-api.md`; a `--gap`/`--offset`/`--scale` custom-property style
      string with the caller's `style` appended last; composed `onmouseenter`/`onmousemove`/
      `onmouseleave`/`onpointerdown`/`onpointerup` handlers that run the caller's handler first and
      skip the `StackState` command when `event.defaultPrevented`; a document-level `pointerup`/
      `pointercancel` `$effect` (with teardown) active while `interacting` is true; root classes
      `cn('relative w-full', className)` (caller `class` merged last); root attributes
      `data-slot="stack"`, `data-state`, `data-expanded`; a `child` snippet replacing the root element;
      `setStackContext(new StackState({...}))` called during initialisation. Depends on: T009.

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/stack/stack.test.ts` still fails
(no barrel to import from) — expected until Phase 4.

---

## Phase 4: Barrel and types

- [X] T012 Create `src/lib/components/ui/stack/index.ts` exactly as specified in
      `contracts/public-api.md` — Barrel (CLAUDE.md §3): import `Root` from `./stack.svelte` and `Item`
      from `./stack-item.svelte`; re-export `type { StackChildProps, StackProps, StackRootProps }`
      from `./stack.svelte`; re-export `stackItemWrapperVariants` and
      `type { StackItemChildProps, StackItemProps }` from `./stack-item.svelte`; re-export
      `getStackContext`, `setStackContext`, `StackState`, `STACK_SIDES`,
      `type { StackSide, StackStateProps }` from `./stack.svelte.js`; export `Root`, `Item` and the
      prefixed aliases `Root as Stack`, `Item as StackItem`. Every intra-repo import carries the `.js`
      extension. Depends on: T010, T011.

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/stack/stack.test.ts` should now
pass — if any of scenarios 1–15 fail, fix `stack.svelte.ts`/`stack-item.svelte`/`stack.svelte` (not
the tests) before continuing.

---

## Phase 5: Demo route

- [X] T013 Create `src/routes/docs/components/stack/+page.svelte` with a page heading/description and
      three `<ComponentPreview>` sections from `$lib/components/docs/index.js`: **Default**
      (`expandOnHover`, `w-[360px]`, three notification-style `Stack.Item` cards, mirroring
      `stack-demo.tsx`), **Without Expansion** (`expandOnHover={false}`, centred in a
      `min-h-[400px]` box, mirroring `stack-no-expand-demo.tsx`), **Different Sides**
      (`grid grid-cols-2 gap-8` with one `side="top"` and one `side="bottom"` root side by side,
      mirroring `stack-side-demo.tsx`); plus an API Reference block with one `Table.Root` of props for
      `Stack.Root` and one for `Stack.Item`, and one data-attributes table each, matching the
      `marquee` demo page's structure (plan.md "Demo route sections"). Depends on: T012.

---

## Phase 6: Registry entry and docs polish

- [X] T014 Complete the `stack` entry in `registry.json` (repository root) started in T002: set
      `"files"` to the four shipped component files — `src/lib/components/ui/stack/index.ts`,
      `src/lib/components/ui/stack/stack.svelte`, `src/lib/components/ui/stack/stack-item.svelte`,
      `src/lib/components/ui/stack/stack.svelte.ts` — each with `"type": "registry:ui"`; keep
      `"registryDependencies": ["speed-dial"]`; set `"dependencies": ["tailwind-variants"]` (the
      component imports `tv()`; no *new* package is added to `package.json`, but the registry entry
      must declare it so a consumer install compiles — matching every existing `tv()`-based entry in
      `registry.json`); do **not** list `stack.test.ts` or `stack.test.svelte`. Depends on: T012.
- [X] T015 Run `pnpm run registry:build` and confirm it exits zero and writes `static/r/stack.json`
      containing the four component files with `$lib/...` imports rewritten to registry placeholders
      and `registryDependencies: ["speed-dial"]` preserved (quickstart.md "4. Registry"). Depends on:
      T014.

---

## Phase 7: Verification

- [X] T016 Run `pnpm run format` (shadcn-style generator output is not Prettier-formatted) and commit
      the formatting changes to the working tree (no git commands — just leave the files formatted).
- [X] T017 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`,
      and fix everything that fails. Do not suppress any failure (no `@ts-ignore`,
      `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `.skip`/`.todo`, `as any`, deleted
      assertions, or loosened configs) — fix the root cause in `stack.svelte.ts`, `stack-item.svelte`,
      `stack.svelte`, `index.ts`, `stack.test.ts`, `stack.test.svelte`, or
      `src/routes/docs/components/stack/+page.svelte` as needed. Depends on: T003–T016.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Tests (Phase 2)**: depends on Setup completing (registry stub in place); tests are written and
  expected to fail (module-not-found) until Phase 3/4 land — this is the required TDD state, not a
  bug.
- **Core component files (Phase 3)**: depends on Phase 2 existing (tests define the contract);
  T009 blocks T010 and T011.
- **Barrel and types (Phase 4)**: depends on T010 and T011.
- **Demo route (Phase 5)**: depends on T012.
- **Registry entry and docs polish (Phase 6)**: depends on T012 (T013 and T014 can run in parallel
  with each other — different files — but both wait on T012).
- **Verification (Phase 7)**: depends on everything above.

### Parallel Opportunities

- T001 and T002 (Setup) — different concerns, no shared file.
- T003 alone opens Phase 2; T004–T008 all write into `stack.test.ts` and so run **sequentially**
  even though they cover independent behavioural areas (same-file rule).
- T010 and T011 (Phase 3) — both depend only on T009, touch different files.
- T013 (Phase 5) and T014 (Phase 6) — both depend only on T012, touch different files, can run in
  parallel; T015 must wait for T014.

---

## Implementation Strategy

Stack is one small, tightly-coupled component (2 public parts sharing one state class) rather than
several independently-shippable user stories — the "Independent Test" for each spec.md story is a
subset of the same `stack.test.ts` suite, not a separately deployable slice. Build in the phase order
above: Setup → Tests (all 15 quickstart scenarios encoded, red) → Core files (T009 → T010/T011,
green) → Barrel → Demo → Registry → Verification. Do not skip ahead to Phase 3 before Phase 2's tests
exist; do not mark Phase 7 done while any suppression comment is present.

---

## Phase 8: Convergence

**Purpose**: Close the coverage gaps found by `/speckit-converge` against spec.md, plan.md and the
upstream reference. The shipped component is behaviourally complete and all five gates are green —
every task below adds a missing assertion, none changes component behaviour. Re-run the Phase 7
gates after finishing them.

- [X] T018 Assert the `onmousemove` expansion path in `src/lib/components/ui/stack/stack.test.ts` per
      FR-008 / SC-002 (missing): with `expandOnHover` set, dispatch a `mousemove` on the root and
      assert `data-state` flips `"collapsed"` → `"expanded"`. Only the `expandOnHover={false}`
      negative case is covered today, so `StackState.onPointerMove` (`stack.svelte.ts:169`) and the
      `handleMouseMove` composition (`stack.svelte:139`) have no positive assertion — the harness
      already accepts an `onmousemove` prop that no test passes. Reuse it rather than adding another.
- [X] T019 Assert the composition contract for the remaining four handlers per FR-013 and the spec's
      "consumer calls `preventDefault()`" edge case (partial): add `onmouseleave`, `onpointerdown`
      and `onpointerup` props to `src/lib/components/ui/stack/stack.test.svelte` (forwarded to
      `Stack.Root` alongside the existing `onmouseenter`/`onmousemove`), then in
      `src/lib/components/ui/stack/stack.test.ts` assert, for each of `onmousemove`, `onmouseleave`,
      `onpointerdown` and `onpointerup`, that the caller's handler runs first and that calling
      `preventDefault()` on a cancelable event suppresses the stack's own behaviour — expansion for
      `onmousemove`, the collapse for `onmouseleave`, and the `interacting` flag for the two pointer
      handlers (prove the latter through the observable collapse-deferral, not through private
      state). Only `onmouseenter` is covered today, leaving four of the five rows of
      `contracts/public-api.md` §"Composed event handlers" unverified.
      **Implementation note**: the `onpointerup` row of that table could not be made observable
      without one behaviour fix. The document-level release listener (divergence D-04,
      `stack.svelte`) called `onPressEnd()` unconditionally, so a release *on the root* ended the
      press through the fallback even when the caller's `onpointerup` had prevented the default —
      overruling the composition contract the table states. The listener now returns early on
      `event.defaultPrevented`; a release outside the stack, where no caller handler ran, still ends
      the press exactly as before.
- [X] T020 Assert the declared transitions in `src/lib/components/ui/stack/stack.test.ts` per SC-003
      (partial): SC-003 requires asserting "the transition **and** `motion-reduce` utilities on the
      item wrapper and card", but the existing test asserts only `motion-reduce:transition-none`.
      Extend it so the wrapper class list is also asserted to contain `transition-all`,
      `duration-300` and `ease-out`, and the card's to contain `transition-shadow` and
      `duration-200` — proving expand/collapse is a declared CSS transition rather than an instant
      class swap, which is what SC-003 actually measures.
- [X] T021 Add zero-child and one-child render tests to `src/lib/components/ui/stack/stack.test.ts`
      per the spec's "Zero or one child" edge case (missing): render the harness with `items: []` and
      assert the root still renders with `data-state="collapsed"` and no `stack-item-wrapper`; render
      it with a single item and assert that item is `data-index="0"`, `data-front="true"`,
      `data-visible="true"`, `--translate: 0px`, `--item-scale: 1`, `z-index: 1`, and that hovering
      and unhovering it raises no error. The smallest case covered today is two items.
- [X] T022 Assert runtime item **addition** in `src/lib/components/ui/stack/stack.test.ts` per FR-016
      and the "Children added or removed at runtime" edge case (missing): using the T003 harness's
      keyed `{#each}` list, `rerender` from 2 items to 3 and assert the new item registers in document
      order — `data-index` `0,1,2`, the front flag unmoved, `z-index` `3,2,1`, `--translate`
      `0px,10px,20px`, and `data-visible="true"` on all three under the default `itemCount={3}`.
      Removal is covered; addition, the other half of the stated edge case, is not.
- [X] T023 Assert the full card base class set in `src/lib/components/ui/stack/stack.test.ts` per
      FR-011 / SC-002 (partial): the "self-contained card" test asserts only `bg-card` and the `p-4`
      override, so extend it to also assert `rounded-lg`, `border`, `shadow-sm` and `hover:shadow-md`
      on the card — the rounded corners, border, resting shadow and hover shadow FR-011 requires.
