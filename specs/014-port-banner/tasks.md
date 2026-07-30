---
description: 'Task list for the Banner port'
---

# Tasks: Banner

**Input**: Design documents from `/specs/014-port-banner/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/public-api.md, quickstart.md (all present)

**Tests**: MANDATORY (Constitution Principle III / VII). One colocated spec file
`src/lib/components/ui/banner/banner.test.ts` plus one harness
`src/lib/components/ui/banner/banner.test.svelte` for snippets/`bind:ref`/`child` mode/no-provider
renders, per plan.md's Testing section.

**Organization**: Custom phase order requested for this feature — Setup → Tests → Core component
files → Barrel and types → Demo route → Registry entry and docs polish → Verification. `[Story]`
labels (US1/US2/US3) map to spec.md's three user stories for traceability even though phases are not
grouped by story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 = standalone banner (controlled/uncontrolled), US2 = queue/priority/duration/exit
  animation, US3 = variants/side/strategy
- All file paths are relative to the repository root

---

## Phase 1: Setup

**Purpose**: Confirm dependencies, scaffold the folder, stub the registry entry

- [X] T001 Verify `bits-ui@^2.18.1` (`Portal`), `tailwind-variants@^3.3.0` (`tv`), `@lucide/svelte@^1.27.0`
      (`X` icon) and `$lib/components/ui/button` are already installed/present — confirm in
      `package.json` and `src/lib/components/ui/button/index.ts`; no new npm dependency is added
      (research R-14).
- [X] T002 [P] Create the directory `src/lib/components/ui/banner/` with empty placeholder files for
      `index.ts`, `banner.svelte.ts`, `banner.svelte`, `banner-queue.svelte`, `banner-queued.svelte`,
      `banner-icon.svelte`, `banner-content.svelte`, `banner-title.svelte`, `banner-description.svelte`,
      `banner-actions.svelte`, `banner-close.svelte`, `banner.test.svelte`, `banner.test.ts`, matching
      plan.md's Project Structure.
- [X] T003 Confirm `registry.json` currently has no `banner` item and note the append position (the
      single complete `registry:ui` entry is added by T024, after the folder and demo route exist, so
      the docs index never links to a route that has not been created yet).

**Checkpoint**: Folder scaffold and registry stub exist; dependency availability confirmed.

---

## Phase 2: Tests (write first — MUST fail before implementation exists)

**Purpose**: One test task per behavioural area, colocated in `banner.test.ts` (all tasks in this phase
touch that one file plus the separate harness file, so within `banner.test.ts` tasks are sequential —
never `[P]` with each other — while the harness file is a distinct file and can run in parallel)

- [X] T004 [US1] Write controlled-vs-uncontrolled tests in
      `src/lib/components/ui/banner/banner.test.ts`: uncontrolled default-visible render, close sets
      `onOpenChange(false)` and hides; controlled `bind:open` stays authoritative through a close and a
      re-open (`true` → `false` → `true`); `open={x}` + `onOpenChange={(v) => (x = v)}` behaves
      identically to `bind:open` (contracts/public-api.md §8, spec.md US1 scenarios 1–4).
- [X] T005 [US1] Write accessibility roles-and-names tests in
      `src/lib/components/ui/banner/banner.test.ts` (depends on T004 — same file): `role="status"` +
      `aria-live="polite"` on `Banner.Root` and on a queued banner; `data-slot` present on all nine parts
      (`banner`, `banner-container`, `queued-banner`, `banner-icon`, `banner-content`, `banner-title`,
      `banner-description`, `banner-actions`, `banner-close`); `Banner.Close` rendered outside
      `Banner.Root` throws `` `<Banner.Close>` must be used within `<Banner.Root>`. ``; the default
      `Banner.Close` is retrievable with `screen.getByRole('button', { name: /close/i })`, a
      caller-supplied `aria-label` replaces that name, and custom `children` do not leave the button
      nameless (FR-015, FR-016, FR-017, FR-019, SC-008, Principle III).
- [X] T006 [US1] Write keyboard-interaction tests in `src/lib/components/ui/banner/banner.test.ts`
      (depends on T005 — same file): `userEvent.tab()` reaches an action button and then `Banner.Close`
      in DOM order, `userEvent.tab({ shift: true })` walks back to the action button, `Enter` and
      `Space` each activate the focused close control and dismiss the banner, a banner appearing does
      not move `document.activeElement`, `dismissible={false}` makes the control inert with no
      `onOpenChange` call, and an explicit `disabled` on `Banner.Close` wins over `dismissible`
      (FR-003, FR-015, FR-021, spec.md US1 scenario 5).
- [X] T007 [US3] Write RTL tests in `src/lib/components/ui/banner/banner.test.ts` (depends on T006 —
      same file): under `dir="rtl"` the icon → content → actions → close source order is unchanged (native
      flex mirroring, no bespoke offset logic) and no physically-sided utility class is present (FR-020,
      SC-005, research R-13).
- [X] T007a [US3] Write variant and positioning tests in `src/lib/components/ui/banner/banner.test.ts`
      (depends on T007 — same file): each of the five variants applies exactly the class row in
      contracts/public-api.md §6 and sets `data-variant`; the banner base class carries
      `motion-reduce:transition-none`; `side="bottom"` gives the container `data-side="bottom"` +
      `bottom-0` and the queued banner the negative-offset transform; each of the four strategies
      applies its own class and `data-strategy`, with `static`/`sticky` rendered inline in `children`
      order for the side and `fixed`/`absolute` portalled under `document.body`; an explicit
      `container` element and a CSS-selector `container` portal the stack into that node instead; zero
      visible banners render no `[data-slot="banner-container"]` anywhere; `getBannersContext('<X>')`
      called outside a `Banner.Queue` throws a message naming both `<X>` and `<Banner.Queue>`
      (FR-004, FR-010, FR-011, FR-016, FR-023, FR-025, quickstart V-4 §1–§4 and §12).
- [X] T008 [US2] Write queue and edge-case tests in `src/lib/components/ui/banner/banner.test.ts`
      (depends on T007a — same file): priority ordering (priorities 0/10/5 added in that order render
      10, 5, 0), equal-priority ties preserve insertion order, `maxVisible` caps visible count and
      promotes the next-highest banner on dismissal, a `duration` auto-dismisses under fake timers within
      one tick and invokes `onDismiss`, a banner with no `duration` never auto-dismisses, `clearBanners()`
      cancels every pending timer and fires **no** dismiss callback, removing the front banner while
      another is present re-settles the stack with no error, a standalone `Banner` with `duration`/
      `onDismiss`/`priority` ignores all three outside a queue (FR-006–FR-009, FR-012, FR-013, spec.md
      US2 scenarios 1–6, Edge Cases, R-18); closing a stacked banner sets `data-state="closed"` while
      the element is still mounted, and after advancing 400 ms it is gone and the surviving banner's
      `translateY` offset has decreased (quickstart V-3 §5, SC-004); a `Banner` inside `Banner.Queue`
      renders no `[data-slot="banner"]` of its own but adds exactly one queue entry whose content is
      its `children`; changing its `variant` re-registers it as exactly one entry; destroying it
      removes the entry and fires `onDismiss` followed by `onOpenChange(false)` (FR-024, quickstart
      V-3 §12–§13, plan.md Risks row 1).
- [X] T009 [P] Write the snippet/ref/child-mode harness in
      `src/lib/components/ui/banner/banner.test.svelte`: a `.test.svelte` fixture rendering `children` and
      `child` snippets, asserting `bind:ref` populates on the rendered element and stays `null` in queued
      mode, and rendering a content part with no provider to confirm it does not throw (contracts
      §1 Snippets, §3). Independent file from T004–T007a, T008.

**Checkpoint**: All tests written; running `pnpm run test:unit -- --run` now fails because the
implementation files are still empty stubs (expected red state).

---

## Phase 3: Core component files

**Purpose**: One task per exported subcomponent (plus the one internal part and the runes module) from
plan.md's Public API section

- [X] T010 [US1] Implement the runes module `src/lib/components/ui/banner/banner.svelte.ts`:
      `BANNER_ANIMATION_DURATION`/`BANNER_ANIMATION_EASING`/`DEFAULT_BANNER_PRIORITY`/
      `DEFAULT_BANNER_DISMISSIBLE`/`DEFAULT_MAX_VISIBLE` constants; `BANNER_VARIANTS`/`BANNER_SIDES`/
      `BANNER_STRATEGIES` unions; `bannerVariants` (`tv()`, exact rows from contracts/public-api.md §6);
      `resolveBannerVariant`, `isPortalStrategy`; `BannersState` (priority queue, `maxVisible` cap,
      non-reactive timer map, `addBanner`/`removeBanner`/`clearBanners`, `setRemoving`/`isRemoving`,
      `setHeight`/`removeHeight` — both short-circuiting on an unchanged value — `offsetOf`, the
      `visibleBanners` and `totalHeight` `$derived` members, and `destroy()`, exactly as data-model.md
      §3 declares them) and `BannerState`
      (`id`/`variant`/`dismissible`/`close()`/`remove()`); `setBannersContext`/`hasBannersContext`/
      `getBannersContext` and `setBannerContext`/`hasBannerContext`/`getBannerContext` on `Symbol` keys
      with throwing getters (data-model.md, contracts/public-api.md §5). Depends on T001–T003.
- [X] T011 [P] [US1] Implement `src/lib/components/ui/banner/banner-icon.svelte` (`WithElementRef` +
      `children` + `child` snippet, `data-slot="banner-icon"`, classes
      `flex shrink-0 items-center [&>svg]:size-4`). Depends on T010.
- [X] T012 [P] [US1] Implement `src/lib/components/ui/banner/banner-content.svelte` (`WithElementRef` +
      `children` + `child` snippet, `data-slot="banner-content"`, classes
      `flex min-w-0 flex-1 flex-col gap-1`). Depends on T010.
- [X] T013 [P] [US1] Implement `src/lib/components/ui/banner/banner-title.svelte` (`WithElementRef` +
      `children`, no `child`, `data-slot="banner-title"`, classes `text-sm font-medium leading-none`).
      Depends on T010.
- [X] T014 [P] [US1] Implement `src/lib/components/ui/banner/banner-description.svelte`
      (`WithElementRef` + `children`, no `child`, `data-slot="banner-description"`, classes
      `text-xs opacity-90`). Depends on T010.
- [X] T015 [P] [US1] Implement `src/lib/components/ui/banner/banner-actions.svelte` (`WithElementRef` +
      `children` + `child` snippet, `data-slot="banner-actions"`, classes `flex items-center gap-2`).
      Depends on T010.
- [X] T016 [P] [US1] Implement `src/lib/components/ui/banner/banner-close.svelte`: composes
      `$lib/components/ui/button` (`variant="ghost"`, `size="icon-sm"`), `disabled ?? !dismissible`,
      composed `onclick` (caller's handler runs first; `preventDefault()` or disabled cancels the close),
      `children` replaces the default class-free `<XIcon />`, `data-slot="banner-close"`, throws
      `` `<Banner.Close>` must be used within `<Banner.Root>`. `` when read outside `Banner.Root`.
      Depends on T010.
- [X] T017 [US1] Implement the root `src/lib/components/ui/banner/banner.svelte`: `open = $bindable()`
      seeded once via `open ??= defaultOpen`, `variant`/`dismissible`/`priority`/`duration`/`onDismiss`
      props (mode-dependent — read only when registered with a queue), `close()` writing `open = false`
      and calling `onOpenChange(false)`, a queue-registration `$effect` that calls `addBanner`/
      `removeBanner` inside `untrack()`, `child` snippet mode (root renders nothing when queued or when
      `open` is false), `role="status"` + `aria-live="polite"`, `data-slot="banner"`,
      `data-state="open"`, `data-variant`. Depends on T010–T016.
- [X] T018 [US2] Implement `src/lib/components/ui/banner/banner-queued.svelte` (internal, not exported):
      props `{ banner, side, index }`; `$effect.pre` + `getBoundingClientRect` measures height into
      `BannersState.heights` (write `untrack`ed, early-returns on unchanged value); mount flag, frozen
      exit offset, 400 ms/`cubic-bezier(0.32,0.72,0,1)` enter/exit transform; when the banner enters the
      removing set, call `removeHeight(id)` so the container height shrinks and the banners behind it
      slide up, freeze the last non-removing offset, and schedule
      `setTimeout(…, BANNER_ANIMATION_DURATION)` → `queue.removeBanner(id)` to complete the dismissal,
      cleared on teardown (data-model.md §7.3, upstream banner.tsx:384-392);
      `data-slot="queued-banner"`,
      `data-state`, `data-mounted`/`data-removed`/`data-front` as `"true"`/`"false"` strings, `data-side`,
      `data-index`, `data-variant`. Depends on T010, T017.
- [X] T019 [US2] Implement `src/lib/components/ui/banner/banner-queue.svelte`: `maxVisible`/`side`/
      `strategy`/`container` props (no `ref`, no `class`, no `restProps`), provides `BannersState` via
      `setBannersContext`, container `{#snippet}` used for all four strategies (`fixed`/`absolute`
      portalled through bits-ui `Portal` to `container ?? document.body`, accepting an `Element` or a
      CSS selector (FR-023); `static`/`sticky` rendered
      inline before/after `children` per `side`), container omitted entirely when no banner is visible,
      `data-slot="banner-container"`, `data-side`, `data-strategy`, `BannersState.destroy()` called from
      an `$effect` teardown. Depends on T010, T017, T018.

**Checkpoint**: All nine part files plus the runes module implement the full public API; tests from
Phase 2 begin passing except barrel-import tests until Phase 4.

---

## Phase 4: Barrel and types

- [X] T020 [US1] Create `src/lib/components/ui/banner/index.ts`: import all 8 exported components
      (`Root`, `Queue`, `Icon`, `Content`, `Title`, `Description`, `Actions`, `Close`), re-export every
      prop type (`BannerProps`/`BannerRootProps`/`BannerChildProps`, `BannerQueueProps`/`BannersProps`,
      `BannerIconProps`/`BannerIconChildProps`, `BannerContentProps`/`BannerContentChildProps`,
      `BannerTitleProps`, `BannerDescriptionProps`, `BannerActionsProps`/`BannerActionsChildProps`,
      `BannerCloseProps`), re-export the runes-module surface (constants, `BannerState`/`BannersState`,
      context functions, `bannerVariants`, `resolveBannerVariant`, `isPortalStrategy`, union types), and
      export both the short names (`Root`, `Queue`, …) and the prefixed aliases (`Banner`, `Banners`,
      `BannerIcon`, …) exactly per contracts/public-api.md §7. `banner-queued.svelte` stays out of the
      barrel. Depends on T011–T019.

**Checkpoint**: `import { Banner, Banners, BannerClose } from '$lib/components/ui/banner/index.js'` and
the namespace-style `import * as Banner from '...'` both resolve; `pnpm run test:unit -- --run` for this
component should now be fully green.

---

## Phase 5: Demo route

- [X] T021 [US1] Create `src/routes/docs/components/banner/+page.svelte` with the page header and a
      **Default** `<ComponentPreview>` (mirrors `banner-demo.tsx`: standalone banner with icon, title,
      description, action, close) and an **Uncontrolled** section demonstrating `defaultOpen` plus a
      button that resets/re-shows it. Depends on T020.
- [X] T022 [US2] Add a **Stacked Banners** `<ComponentPreview>` to
      `src/routes/docs/components/banner/+page.svelte` (mirrors `banner-stacked-demo.tsx`: a
      `Banner.Queue` with `strategy="static"` and `maxVisible={3}` inside the preview so it does not
      overlay docs chrome, buttons that call `queue.addBanner(...)` with different priorities/variants/
      durations, and a note on why the demo's `strategy`/`maxVisible` differ from upstream's defaults),
      and a heading showing the current queue length (`queue.banners.length`), mirroring upstream's
      "Stacked Banners (N in queue)" demo heading. Depends on T021 (same file).
- [X] T023 [US3] Add a **Variants** `<ComponentPreview>` (all five severities side by side) plus
      props/data-attribute/error API-reference tables to
      `src/routes/docs/components/banner/+page.svelte`. Depends on T022 (same file).

**Checkpoint**: All four demo sections (Default, Uncontrolled, Stacked Banners, Variants) render and
behave as documented; `SC-006` satisfied.

---

## Phase 6: Registry entry and docs polish

- [X] T024 Append the full `banner` entry to `registry.json`:
      `registryDependencies: ["button"]`, `dependencies: ["tailwind-variants", "@lucide/svelte", "bits-ui"]`,
      and all 11 non-test files listed in contracts/public-api.md §9. Depends on T020, T023.
- [X] T025 Run `pnpm run registry:build` to regenerate the registry output under `static/r/` (git-ignored
      from formatting/lint). Depends on T024.

**Checkpoint**: The component is installable through the project's registry (SC-007).

---

## Phase 7: Verification (MANDATORY — Constitution Principle VII)

- [X] T026 Work through quickstart.md's validation steps V-1…V-6 (anti-cheat greps for `@ts-ignore`/
      `as any`/suppressions, the barrel import-style check, the no-docs-app-import grep, the RTL/parity
      checks) and fix anything that fails.
- [X] T027 Run `pnpm run format`, `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and
      `pnpm run build`, and fix everything that fails.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately
- **Tests (Phase 2)**: depends on Setup (T001–T003); all of T004–T007a and T008 share `banner.test.ts`
  and are therefore sequential; T009 is a different file and can run in parallel with T004–T007a, T008
- **Core component files (Phase 3)**: depends on Tests existing (red state); T010 blocks T011–T019;
  T011–T016 are mutually parallel (six different files); T017 depends on T010–T016; T018 depends on
  T010, T017; T019 depends on T010, T017, T018
- **Barrel and types (Phase 4)**: depends on all of Phase 3 (T011–T019)
- **Demo route (Phase 5)**: depends on Phase 4 (T020); T021→T022→T023 are sequential (same file)
- **Registry entry and docs polish (Phase 6)**: depends on Phase 4 and Phase 5 (T020, T023)
- **Verification (Phase 7)**: depends on everything above — always the last phase

### Parallel Opportunities

- T002 (scaffold) can proceed alongside T001 (dependency check)
- T009 (harness file) can run in parallel with T004–T007a, T008 (spec file)
- T011, T012, T013, T014, T015, T016 (the six leaf part files) are mutually parallel once T010 lands

---

## Parallel Example: Phase 3 leaf parts

```bash
# After T010 (banner.svelte.ts) completes, launch together:
Task: "Implement banner-icon.svelte"
Task: "Implement banner-content.svelte"
Task: "Implement banner-title.svelte"
Task: "Implement banner-description.svelte"
Task: "Implement banner-actions.svelte"
Task: "Implement banner-close.svelte"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (Setup) → Phase 2 tests T004–T007a, T009 (skip T008's queue assertions) → Phase 3 tasks
   T010–T017 (skip T018/T019) → Phase 4 (T020, barrel without queue exports would be incomplete, so in
   practice ship US1 by stopping after T017 for a manual smoke test, then continue) → Phase 5 T021 only.
2. **STOP and VALIDATE**: a standalone `Banner`, controlled and uncontrolled, with close/dismissible/
   variant all work with no queue code exercised (spec.md US1 Independent Test).

### Incremental Delivery

1. Setup → Tests (all) → Core (all) → Barrel → full component is feature-complete in one pass, because
   Phase 4's barrel cannot cleanly ship without the queue exports it re-exports (T019 feeds T020).
2. Demo Default + Uncontrolled (US1) → Stacked Banners (US2) → Variants (US3) — each addable
   independently once the barrel exists.
3. Registry entry and `registry:build` last, once the folder is final.
4. Verification always closes the feature.

### Notes

- [P] tasks touch different files with no incomplete dependency; tasks sharing `banner.test.ts` or
  `+page.svelte` are intentionally sequential
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X)
- Do not touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json` or `.port-logs/`

---

## Phase 8: Convergence

**Purpose**: Close gaps found by auditing the merged implementation against spec.md/plan.md — verified
by running the current suite and a throwaway reproduction test, not by re-reading tasks alone.

- [X] T028 Fix `src/lib/components/ui/banner/banner-close.svelte` so the default `aria-label="Close"` is
      omitted when the caller supplies `children` (continuing to apply when no `children` are supplied,
      and continuing to be replaced outright by a caller-supplied `aria-label` in either case) — currently
      the default is applied unconditionally, so a `<Banner.Close>` given custom visible content (e.g. a
      "Skip" label) is still announced as "Close" to assistive technology instead of that content, which
      contradicts spec.md's own Assumption "BannerClose gains a default accessible name" ("omitted when
      the caller supplies children or an aria-label") per FR-015 (contradicts)
- [X] T029 Add a test in `src/lib/components/ui/banner/banner.test.ts` asserting that a `Banner.Close`
      rendered with custom `children` and no explicit `aria-label` exposes an accessible name derived from
      that content rather than the literal string "Close" — the existing "custom children do not leave
      the close button nameless" test only checks that *a* button exists and would not catch T028's gap,
      confirmed by a reproduction run showing `getByRole('button', { name: 'x' })` fails to match rendered
      `<span data-testid="close-children">x</span>` content while `{ name: /close/i }` still matches, per
      FR-015 (missing)
- [X] T030 Add tests in `src/lib/components/ui/banner/banner.test.ts` asserting `data-mounted`,
      `data-removed`, `data-front`, and `data-index` on a queued banner (`banner-queued.svelte`) carry
      upstream's documented values (`"true"`/`"false"` strings for the first three, the numeric position
      for the last) — plan.md's Public API section and spec.md's Assumptions single these four out as a
      deliberate exception to Principle VIII's boolean-attribute convention, but no assertion in the
      current suite exercises any of them, per FR-017 (missing)
- [X] T031 Add a test in `src/lib/components/ui/banner/banner.test.ts` exercising `Banner.Queue`'s
      `container` prop with both an explicit `Element` and a CSS-selector string, asserting the stack
      container portals into that target instead of `document.body` — the test harness
      (`banner.test.svelte`) already threads a `container` prop through to `Banner.Queue` for exactly this
      purpose, but `banner.test.ts` never passes one, leaving task T007a's own stated scope ("an explicit
      `container` element and a CSS-selector `container` portal the stack into that node instead")
      unverified, per FR-023 (missing)
- [X] T032 Add a test in `src/lib/components/ui/banner/banner.test.ts` asserting a queued banner's
      transform direction/offset sign for `side="bottom"` — only the stack container's `data-side` and
      `bottom-0` class are currently asserted for that side, leaving task T007a's own stated scope ("the
      queued banner the negative-offset transform") unverified, per FR-010 (missing)
