---
description: 'Task list for the Responsive Dialog port'
---

# Tasks: Responsive Dialog

**Input**: Design documents from `/specs/027-port-responsive-dialog/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are MANDATORY (Constitution Principle III). Colocated at
`src/lib/components/ui/responsive-dialog/responsive-dialog.test.ts`, backed by a
`responsive-dialog.test.svelte` composition harness.

**Organization**: Tasks are grouped by user story (US1/US2/US3 from spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact and relative to the repository root

## Path Conventions

- Shared hook: `src/lib/hooks/is-mobile.svelte.ts`
- Component source: `src/lib/components/ui/responsive-dialog/` — parts, `responsive-dialog.svelte.ts`, `index.ts`
- Tests: `src/lib/components/ui/responsive-dialog/responsive-dialog.test.ts` + `responsive-dialog.test.svelte` harness
- Demo route: `src/routes/docs/components/responsive-dialog/+page.svelte`
- Registry: `registry.json` at the repository root

---

## Phase 1: Setup

**Purpose**: Confirm dependencies and stub the registry entry before any code is written.

- [X] T001 Verify `bits-ui` and `vaul-svelte` are already present in `package.json` (no install needed — confirmed by plan.md); if either is missing, add it as a devDependency in `package.json` and run `pnpm install`.
- [X] T002 Confirm `src/lib/components/ui/dialog/index.ts` and `src/lib/components/ui/drawer/index.ts` export all parts this port forwards to (`Root`, `Trigger`, `Close`, `Portal`, `Overlay`, `Content`, `Header`, `Footer`, `Title`, `Description`); no file changes, just verify the barrel names used by later tasks.
- [X] T003 [P] Record the planned `registry.json` entry shape for `responsive-dialog` (name, `type: "registry:ui"`, title, description, `registryDependencies: ["dialog", "drawer"]`, `dependencies: ["bits-ui", "vaul-svelte"]`) as the target for T037 — do **not** append a `files: []` placeholder to `registry.json`, which would be an invalid registry item until T037 fills it and would break any intervening `pnpm run registry:build`.

**Checkpoint**: Toolchain confirmed, registry entry stubbed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Port the shared `useIsMobile` reactive primitive and the `ResponsiveDialogState` context
module that every user story's parts depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Create `src/lib/hooks/is-mobile.svelte.ts` exporting `DEFAULT_MOBILE_BREAKPOINT = 768`, the `IsMobile` class (`current: boolean` seeded `false`, constructor takes `getBreakpoint?: () => number`, registers a `matchMedia('(max-width: ${breakpoint - 1}px)')` listener inside `$effect` with teardown, guarded for SSR/no-`matchMedia` environments), and `useIsMobile(getBreakpoint?: () => number): IsMobile`, per data-model.md Entity 1.
- [X] T005 Create `src/lib/components/ui/responsive-dialog/responsive-dialog.svelte.ts` exporting the `ResponsiveDialogVariant` type (`'dialog' | 'drawer'`), the `ResponsiveDialogState` class (constructed from `{ getOpen, setOpen, getBreakpoint }`, owns an `IsMobile` instance, `open: $derived`, `variant: $derived`, `setOpen(next, from)` with the stale-branch/no-op guards, `pendingFocusRestore: $state` + `consumeFocusRestore()`, `#lastVariant` transition tracking), and the `Symbol('responsive-dialog')` context helpers `setResponsiveDialogContext(state)`, `hasResponsiveDialogContext()`, `getResponsiveDialogContext(part?)` (throws `` `<ResponsiveDialog.${part}>` must be used within `<ResponsiveDialog.Root>`. `` when absent), per data-model.md Entity 2 and CLAUDE.md §5. Depends on T004 for the `IsMobile` import.
- [X] T006 [P] Create `src/lib/components/ui/responsive-dialog/responsive-dialog.test.svelte` as the test-only composition harness (precedent: `direction-provider.test.svelte`) that renders `ResponsiveDialog.Root` with configurable `props` for Trigger/Content/Header/Title/Description/Footer/Close so later test tasks can drive full compositions. Depends on T005. Write it against the planned barrel shape now, importing part files directly; T031 rewires it to `./index.js` once the barrel (T030) lands.

**Checkpoint**: Foundation ready — `useIsMobile`, `ResponsiveDialogState`, and the context helpers exist; user story implementation can begin.

---

## Phase 3: User Story 1 - A single dialog that adapts to screen size (Priority: P1) 🎯 MVP

**Goal**: One `ResponsiveDialog` composition (Root + Trigger + Content) renders a centered dialog at/above
the breakpoint and a bottom drawer below it, with `Escape` closing and returning focus to the trigger.

**Independent Test**: Render `Root` + `Trigger` + `Content` at an above-breakpoint viewport, open it, and
confirm `role="dialog"` with dialog layout; simulate a below-breakpoint viewport and confirm the same
composition instead exposes the drawer's `role="dialog"` and bottom-anchored layout.

### Tests for User Story 1 (MANDATORY - Principle III) ⚠️

> Write these tests first; they must fail until the corresponding implementation tasks land.

- [X] T007 [P] [US1] Write the "rendering / roles / ARIA" test group in `src/lib/components/ui/responsive-dialog/responsive-dialog.test.ts`: above-breakpoint viewport exposes `role="dialog"` with `data-variant="dialog"`; below-breakpoint viewport exposes `role="dialog"` from the drawer with `data-variant="drawer"` (quickstart.md scenarios 1–2). Import the harness from T006.
- [X] T008 [P] [US1] Write the keyboard test group in the same file, covering every key in the upstream MDX keyboard table: `Enter` and `Space` on a focused `ResponsiveDialogTrigger` open the dialog/drawer identically to a click; `Tab` moves focus to the next focusable element inside the open content and `Shift+Tab` to the previous one, with focus staying inside the content (modal focus containment); `Escape` closes and returns focus to the trigger — every assertion repeated in **both** dialog and drawer mode (quickstart.md scenarios 3, 10 and 15; FR-009; plan.md test plan area 5). Drive everything with `@testing-library/user-event` (`user.tab()`, `user.tab({ shift: true })`), never `fireEvent`.
- [X] T009 [P] [US1] Write the breakpoint-driving test utility in the same file: a `setViewport(isMobile)` helper built on `vi.stubGlobal('matchMedia', ...)` that returns a `MediaQueryList`-shaped object with a mutable `matches` and collected `change` listeners (quickstart.md "Driving the viewport in tests"), plus an `afterEach` that resets `document.body.style.{pointerEvents,overflow,paddingRight,marginRight}` (quickstart.md "Body-style hygiene", research R-05). This utility is shared by every later test task in this file.
- [X] T009a [P] [US1] Write the `IsMobile` lifecycle test group in `src/lib/components/ui/responsive-dialog/responsive-dialog.test.ts` using the T009 `matchMedia` stub, which must record `addEventListener`/`removeEventListener` calls: (a) mounting one `ResponsiveDialog.Root` registers exactly one `change` listener; (b) unmounting removes it (listener count returns to zero — no leak, CLAUDE.md §4 `$effect` teardown); (c) changing the `breakpoint` prop after mount tears down the old `MediaQueryList` and creates a new one for `(max-width: <newBreakpoint - 1>px)`, and the active variant re-evaluates against the new breakpoint on the next `change` (spec edge case "breakpoint prop changed after mount", contracts §1 guarantees, plan.md phase A gate). Depends on T004, T009.

### Implementation for User Story 1

- [X] T010 [US1] Create `src/lib/components/ui/responsive-dialog/responsive-dialog.svelte` (Root): module script exports `ResponsiveDialogRootProps` (`breakpoint?: number = 768`, `open?: boolean` bindable, `defaultOpen? = false`, `onOpenChange?`, `onOpenChangeComplete?`, `children: Snippet`, plus the intersection of `Dialog`/`Drawer` root rest-props); instance script resolves controlled/uncontrolled `open` via `value ??= defaultValue`, constructs a `ResponsiveDialogState` (T005) and calls `setResponsiveDialogContext`; renders `{#if state.variant === 'drawer'}<Drawer.Root>{@render children()}</Drawer.Root>{:else}<Dialog.Root>{@render children()}</Dialog.Root>{/if}`, wiring `bind:open` and `onOpenChangeComplete` pass-through per plan.md Public API. Depends on T005.
- [X] T011 [US1] Create `src/lib/components/ui/responsive-dialog/responsive-dialog-trigger.svelte` and `src/lib/components/ui/responsive-dialog/responsive-dialog-content.svelte`: `Trigger` reads context (T005), throws when absent, forwards to `Dialog.Trigger`/`Drawer.Trigger` with `type="button"` default, `data-slot="responsive-dialog-trigger"`, `data-variant`, `children`/`child` snippets, `class` merged last; `Content` additionally applies `px-4 pb-4` only in drawer mode (FR-005), forwards `portalProps`/`showCloseButton` (dialog-mode only) per plan.md's `ResponsiveDialogContentProps`, and owns the swap focus-restoration `$effect` that calls `state.consumeFocusRestore()` on mount and moves focus to the first focusable element inside the content when it returns `true` (plan.md Constitution Check, bespoke behaviour 1). Depends on T010.

**Checkpoint**: User Story 1 is fully functional and testable independently — Root, Trigger, Content exist; mode switches on viewport; Escape/keyboard works.

---

## Phase 4: User Story 2 - Composable parts mirror the underlying dialog and drawer (Priority: P2)

**Goal**: All nine documented parts exist, each rendering its dialog or drawer counterpart with matching
ARIA associations, `data-variant`, and `data-slot`.

**Independent Test**: Compose `Root` with `Trigger`, `Content`, `Header`, `Title`, `Description`,
`Footer`, `Close`, `Overlay`, and `Portal` at both viewport widths and confirm each part renders its
counterpart with matching structure and ARIA wiring.

### Tests for User Story 2 (MANDATORY - Principle III) ⚠️

- [X] T012 [P] [US2] Write the "every prop / data attribute" test group in `responsive-dialog.test.ts`: `breakpoint` custom value flips mode at the custom width; `class` merged last on every one of the nine parts; `data-variant` present and correct on the eight element-rendering parts (`Trigger`, `Close`, `Overlay`, `Content`, `Header`, `Footer`, `Title`, `Description`) and explicitly asserted **absent** from `Portal`, which renders no element (FR-004, divergence D-07); arbitrary `data-*`/`id` forwarding; `ref` binding on `Content` (quickstart.md scenario 13 plus plan.md Public API table). Also assert `onOpenChangeComplete`: a `vi.fn()` passed to `Root` is invoked after an open/close settles in dialog mode and is never invoked in drawer mode (divergence D-08). Depends on T009's viewport helper.
- [X] T013 [P] [US2] Write the ARIA-association test group in `responsive-dialog.test.ts`: composing `Header`/`Title`/`Description`/`Footer` in both modes produces `aria-labelledby` → `Title`'s id and `aria-describedby` → `Description`'s id; a `Close` inside `Footer` closes the dialog/drawer in both modes (quickstart.md scenario 4).
- [X] T014 [P] [US2] Write the `showCloseButton`/spacing test group in `responsive-dialog.test.ts`: `Footer`'s `showCloseButton` renders a close button in dialog mode only (FR-006, quickstart.md scenario 14); `Content` carries `px-4 pb-4` in drawer mode and a caller `class` still wins (FR-005, quickstart.md scenario 13); `Content`'s `showCloseButton` renders the dialog close button when `true` and omits it when `false` in dialog mode, and is not forwarded to `Drawer.Content` in drawer mode (no stray close button, no unknown-prop type error).
- [X] T015 [P] [US2] Write the guard-rail test group in `responsive-dialog.test.ts`: each of the nine parts (`Trigger`, `Close`, `Portal`, `Overlay`, `Content`, `Header`, `Footer`, `Title`, `Description`) rendered without a `Root` ancestor throws `/must be used within/` (quickstart.md scenario 11, FR-011).

### Implementation for User Story 2

- [X] T016 [P] [US2] Create `src/lib/components/ui/responsive-dialog/responsive-dialog-close.svelte`: reads context, throws when absent, forwards to `Dialog.Close`/`Drawer.Close` with `data-slot="responsive-dialog-close"`, `data-variant`, `children`/`child` snippets, `class` merged last. Depends on T005.
- [X] T017 [P] [US2] Create `src/lib/components/ui/responsive-dialog/responsive-dialog-portal.svelte`: reads context, throws when absent, forwards to `Dialog.Portal`/`Drawer.Portal`, `children`, no `data-variant` — the underlying portal renders no element (divergence D-07). Depends on T005.
- [X] T018 [P] [US2] Create `src/lib/components/ui/responsive-dialog/responsive-dialog-overlay.svelte`: reads context, throws when absent, forwards to `Dialog.Overlay`/`Drawer.Overlay` with `data-slot="responsive-dialog-overlay"`, `data-variant`, `class` merged last. Depends on T005.
- [X] T019 [P] [US2] Create `src/lib/components/ui/responsive-dialog/responsive-dialog-header.svelte`: reads context, throws when absent, forwards to `Dialog.Header`/`Drawer.Header` with `data-slot="responsive-dialog-header"`, `data-variant`, `WithElementRef<HTMLAttributes<HTMLDivElement>>` props, `class` merged last. Depends on T005.
- [X] T020 [P] [US2] Create `src/lib/components/ui/responsive-dialog/responsive-dialog-footer.svelte`: reads context, throws when absent, forwards to `Dialog.Footer`/`Drawer.Footer` with `data-slot="responsive-dialog-footer"`, `data-variant`, `showCloseButton?: boolean = false` forwarded in dialog mode only (FR-006), `class` merged last. Depends on T005.
- [X] T021 [P] [US2] Create `src/lib/components/ui/responsive-dialog/responsive-dialog-title.svelte`: reads context, throws when absent, forwards to `Dialog.Title`/`Drawer.Title` with `data-slot="responsive-dialog-title"`, `data-variant`, `children`/`child` snippets, `class` merged last. Depends on T005.
- [X] T022 [P] [US2] Create `src/lib/components/ui/responsive-dialog/responsive-dialog-description.svelte`: reads context, throws when absent, forwards to `Dialog.Description`/`Drawer.Description` with `data-slot="responsive-dialog-description"`, `data-variant`, `children`/`child` snippets, `class` merged last. Depends on T005.

**Checkpoint**: All nine parts exist; compositions match upstream part-for-part; User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Controlled state and breakpoint switching preserve state (Priority: P3)

**Goal**: Crossing the breakpoint while open never closes the dialog, never clears content, never fires
a spurious `onOpenChange`, and always lands focus inside the newly mounted content — in both controlled
and uncontrolled modes.

**Independent Test**: Open under a controlled `open`/`onOpenChange` pair below the breakpoint, flip the
simulated viewport above it without closing, and confirm the dialog stays open with unchanged content,
now exposes the dialog role, and focus lands inside the new content (not lost to `document.body` or a
removed node).

### Tests for User Story 3 (MANDATORY - Principle III) ⚠️

- [X] T023 [P] [US3] Write the uncontrolled/controlled test group in `responsive-dialog.test.ts`: `defaultOpen` seeds the component and trigger/close interaction updates it (quickstart.md scenario 5); passing `open` makes the caller authoritative — the component never self-closes — and `onOpenChange` fires exactly once per real transition via a `vi.fn()` spy, and `bind:open` round-trips (quickstart.md scenario 6). Depends on T009's viewport helper and T010/T011.
- [X] T024 [US3] Write the breakpoint-transition-while-open test group in `responsive-dialog.test.ts` (uncontrolled): open below the breakpoint, flip `setViewport` above it, assert exactly one `role="dialog"` throughout, unchanged content text, `data-variant` flips `drawer` → `dialog`, `onOpenChange` spy is not called again, and `document.activeElement` is inside the new content — then repeat for the reverse direction (quickstart.md scenario 7, US3-1, FR-008, SC-004). Additionally assert the fallback branch: with a composition whose content has no focusable descendant (title + description only, `showCloseButton={false}`), crossing the breakpoint while open leaves `document.activeElement` on the content element itself and never on `document.body` (T029 fallback, FR-008, SC-004). Depends on T023.
- [X] T025 [US3] Write the same breakpoint-transition test under a controlled `open` prop in `responsive-dialog.test.ts`, asserting the caller's `open` value is respected in both crossing directions and the component never force-closes (quickstart.md scenario 8, US3-2). Depends on T024.
- [X] T026 [P] [US3] Write the "cross while closed" test in `responsive-dialog.test.ts`: flip `setViewport` while the dialog is closed, then activate the trigger, and confirm the mode matching the current viewport opens (quickstart.md scenario 9, US3-3). Depends on T009.
- [X] T027 [P] [US3] Write the RTL test group in `responsive-dialog.test.ts`: set `document.documentElement.dir = 'rtl'` in a `beforeEach` (restored in `afterEach`) — a wrapper element inside the render container is **not** an ancestor of the portalled content, so it would make the assertions vacuous. Then assert, in both modes, that the composition opens, that the portalled content resolves to `dir="rtl"` (via its own or an inherited `dir`), that `aria-labelledby`/`aria-describedby` still resolve to the `Title`/`Description` ids, and that `Escape` closes and returns focus to the trigger — with no bespoke horizontal-arrow-key handling introduced by this component (quickstart.md scenario 12, FR-010). Depends on T009.

### Implementation for User Story 3

- [X] T028 [US3] In `src/lib/components/ui/responsive-dialog/responsive-dialog.svelte.ts`, implement the variant-transition detection inside `ResponsiveDialogState`: track `#lastVariant` via `untrack`, and when `variant` changes while `open` is `true`, set `pendingFocusRestore = true` without invoking `onOpenChange` (data-model.md state-transition table rows 3–4; plan.md Constitution Check bespoke behaviour 2). Depends on T005.
- [X] T029 [US3] In `src/lib/components/ui/responsive-dialog/responsive-dialog-content.svelte`, finalize the `$effect` that calls `state.consumeFocusRestore()` on every mount/update, and when it returns `true`, focuses the first focusable descendant of the mounted content element (falling back to the content element itself if none exists) so focus is never left on a removed node or `document.body` (FR-008, plan.md Constitution Check bespoke behaviour 1). Depends on T011, T028.

**Checkpoint**: All user stories independently functional — breakpoint crossing preserves state, content, and focus in both controlled and uncontrolled modes.

---

## Phase 6: Barrel and Types

**Purpose**: Expose the public API surface.

- [X] T030 Create `src/lib/components/ui/responsive-dialog/index.ts`: import all ten `.svelte` parts (Root, Trigger, Close, Portal, Overlay, Content, Header, Footer, Title, Description), re-export short names, `ResponsiveDialog*`-prefixed aliases, every `*Props` type, and re-export `ResponsiveDialogState`, `ResponsiveDialogVariant`, `setResponsiveDialogContext`, `hasResponsiveDialogContext`, `getResponsiveDialogContext` from `./responsive-dialog.svelte.ts` — per CLAUDE.md §3's barrel pattern and plan.md's "Barrel exports" table. `useIsMobile` is deliberately NOT re-exported here (it lives at `$lib/hooks/is-mobile.svelte.js`, FR-007). Depends on T010, T011, T016–T022.
- [X] T031 Wire the `responsive-dialog.test.svelte` harness (T006) to import from the now-complete barrel (`./index.js`) instead of individual part files, if it was stubbed with placeholder imports in T006.

**Checkpoint**: `import * as ResponsiveDialog from '$lib/components/ui/responsive-dialog/index.js'` works exactly as shown in quickstart.md §1.

---

## Phase 7: Demo Route

**Purpose**: Document every upstream example on this project's docs site (FR-013, SC-003).

- [X] T032 [P] Create `src/routes/docs/components/responsive-dialog/+page.svelte` with the page header (title, description) and a "Default" `<ComponentPreview>` reproducing `responsive-dialog-demo.tsx` (edit-profile-style dialog with `Header`/`Title`/`Description`/`Footer`, `Trigger` wrapping a `Button` via the `child` snippet, per quickstart.md §1). Depends on T030.
- [X] T033 [P] Add a "Confirm" `<ComponentPreview>` to the same route reproducing `responsive-dialog-confirm-demo.tsx`: a destructive-action confirmation dialog whose confirm button shows an async pending state using `Spinner` from `$lib/components/ui/spinner` per divergence D-06. Depends on T030.
- [X] T034 [P] Add a "Variant Styling" `<ComponentPreview>` to the same route reproducing the MDX example that targets `data-[variant=drawer]:` / `data-[variant=dialog]:` selectors on a part. Depends on T030.
- [X] T035 [P] Add a "Controlled" `<ComponentPreview>` to the same route driven by page-level `$state` (`open`) bound via `bind:open`, demonstrating `onOpenChange` and that resizing across the breakpoint while open does not close it. Depends on T030.
- [X] T036 Add props tables to `src/routes/docs/components/responsive-dialog/+page.svelte` documenting `breakpoint`, `open`, `defaultOpen`, `onOpenChange`, `onOpenChangeComplete` on Root and `showCloseButton` on `Footer`/`Content`, matching plan.md's Public API tables. Depends on T032–T035.

**Checkpoint**: All four previews render, open, close, and are interactively usable (SC-003).

---

## Phase 8: Registry Entry and Docs Polish

**Purpose**: Make the component installable through the project registry (FR-012).

- [X] T037 Append the single `registry:ui` entry for `responsive-dialog` to `registry.json` (shape per T003) with the full file list: `{ "path": "src/lib/hooks/is-mobile.svelte.ts", "type": "registry:hook" }` followed by one `registry:ui` entry per file under `src/lib/components/ui/responsive-dialog/` — `index.ts`, `responsive-dialog.svelte`, `responsive-dialog-trigger.svelte`, `responsive-dialog-close.svelte`, `responsive-dialog-portal.svelte`, `responsive-dialog-overlay.svelte`, `responsive-dialog-content.svelte`, `responsive-dialog-header.svelte`, `responsive-dialog-footer.svelte`, `responsive-dialog-title.svelte`, `responsive-dialog-description.svelte`, `responsive-dialog.svelte.ts` — excluding `responsive-dialog.test.ts` and `responsive-dialog.test.svelte`, per plan.md's "Registry entry" section. Depends on T030.
- [X] T038 Run `pnpm run registry:build` and confirm `static/r/responsive-dialog.json` is produced with `$lib/...` imports rewritten to registry placeholders. Depends on T037.

**Checkpoint**: Component is installable through the registry build (SC-005 registry half).

---

## Phase 9: Verification (MANDATORY - Principle VII)

**Purpose**: The feature is not complete until all four gates are green. No suppressions
(`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`,
deleted assertions, loosened configs) may be used to reach green — fix the root cause.

- [X] T039 Run `pnpm run format` first (Prettier writes; generator and hand-authored output is not formatted), then `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, and fix the root cause of everything that fails — no suppressions.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational. Its parts are independent of each other and of US1's parts, but its ARIA tests (T013) compose `Header`/`Title`/`Description`/`Footer` together with `Root`/`Trigger`/`Content` from US1 — so Phase 4 implementation can start in parallel with Phase 3, but Phase 4's tests are easiest to validate once Phase 3 is done.
- **User Story 3 (Phase 5)**: Depends on Foundational and on US1's `Content` (T011) for the focus-restoration effect it finalizes (T029) and on US1's Root/Trigger for its tests (T023–T027).
- **Barrel (Phase 6)**: Depends on all parts existing (T010, T011, T016–T022).
- **Demo Route (Phase 7)**: Depends on the barrel (Phase 6).
- **Registry (Phase 8)**: Depends on the barrel (Phase 6); T037 depends on the final file list, so effectively after Phase 6/7.
- **Verification (Phase 9)**: Depends on everything above — always last.

### User Story Dependencies

- **User Story 1 (P1)**: Independent after Foundational — delivers the MVP switch behaviour.
- **User Story 2 (P2)**: Independent after Foundational — adds the remaining seven parts; integrates with US1's Root/Trigger/Content for composition tests but each part file has no code dependency on US1's files beyond the shared context module (T005).
- **User Story 3 (P3)**: Builds on US1's `Content` (T011) and `ResponsiveDialogState` (T005) to finish the focus-restoration behaviour; not required for US1/US2 to be independently testable.

### Within Each User Story

- Tests are written first and must fail before their implementation tasks land.
- Foundational state/context before parts.
- Parts before barrel.
- Barrel before demo route and registry entry.

### Parallel Opportunities

- T003 can run in parallel with T001/T002.
- T006 can run in parallel with T004 but must follow T005, whose context helpers it imports.
- T007, T008, T009 (US1 tests) can run in parallel with each other. T009a can run in parallel with T007/T008.
- T012–T015 (US2 tests) can run in parallel with each other and with US1/US3 test tasks, sharing the T009 viewport helper.
- T016–T022 (the seven remaining parts) can all run in parallel — each is a distinct file with no cross-dependency beyond T005.
- T023, T026, T027 can run in parallel; T024 depends on T023, T025 depends on T024.
- T032–T035 (four demo previews in the same file) are listed `[P]` for independent authoring but land as sequential edits to one file in practice — parallelize by drafting content, not by concurrent file writes.

---

## Parallel Example: User Story 2 (seven remaining parts)

```bash
Task: "Create responsive-dialog-close.svelte forwarding to Dialog.Close/Drawer.Close"
Task: "Create responsive-dialog-portal.svelte forwarding to Dialog.Portal/Drawer.Portal"
Task: "Create responsive-dialog-overlay.svelte forwarding to Dialog.Overlay/Drawer.Overlay"
Task: "Create responsive-dialog-header.svelte forwarding to Dialog.Header/Drawer.Header"
Task: "Create responsive-dialog-footer.svelte forwarding to Dialog.Footer/Drawer.Footer"
Task: "Create responsive-dialog-title.svelte forwarding to Dialog.Title/Drawer.Title"
Task: "Create responsive-dialog-description.svelte forwarding to Dialog.Description/Drawer.Description"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (`useIsMobile`, `ResponsiveDialogState`, context helpers, harness).
3. Complete Phase 3: User Story 1 (Root, Trigger, Content with basic focus handling).
4. **STOP and VALIDATE**: `pnpm exec vitest --run src/lib/components/ui/responsive-dialog/responsive-dialog.test.ts` covering US1's test groups.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add User Story 1 → validate independently → MVP switch behaviour works.
3. Add User Story 2 → validate independently → full part composition works.
4. Add User Story 3 → validate independently → controlled state and breakpoint-crossing focus preserved.
5. Barrel → Demo Route → Registry Entry → Verification.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Every part component depends on `responsive-dialog.svelte.ts` (T005) for context, not on each other.
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X).
- Do NOT touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json` or `.port-logs/`.
- Stop at any checkpoint to validate a story independently before moving on.

---

## Phase 10: Convergence

**Purpose**: Close the gaps found by `/speckit-converge` between the implemented port and its spec,
plan and contracts. The four quality gates are currently green — every task below must keep them
green, with no suppressions (Principle VI/VII).

- [X] T040 CRITICAL — Reconcile the trigger keyboard contract with upstream: the upstream MDX keyboard table documents `Space`/`Enter` as "Opens/**closes** the dialog when focus is on the trigger", but `bits-ui`'s `DialogTriggerState.onkeydown` calls `handleOpen()` (open only, never a toggle), and `src/routes/docs/components/responsive-dialog/+page.svelte` reproduces the row as "Opens the dialog/drawer when focus is on the trigger". Record the drift as divergence `D-09` in the "Recorded divergences" table of `specs/027-port-responsive-dialog/spec.md` (upstream: `Space`/`Enter` toggle the trigger; here: open-only, inherited from `bits-ui`/`vaul-svelte`, which expose no toggle and whose modal focus trap makes the trigger unreachable while open — additive-free, no bespoke code), and add a test in `src/lib/components/ui/responsive-dialog/responsive-dialog.test.ts` pinning the actual behaviour in both dialog and drawer mode. Do not hand-roll a toggle — that would be bespoke behaviour without a Principle IV justification per Constitution II (contradicts)
- [X] T041 [P] Cover the `child` snippet — the documented replacement for upstream `asChild` (divergence D-03) — which currently has zero assertions anywhere in `responsive-dialog.test.ts` / `responsive-dialog.test.svelte` even though all four demo previews depend on it: extend `src/lib/components/ui/responsive-dialog/responsive-dialog.test.svelte` with a harness mode that renders `Trigger`, `Close`, `Title` and `Description` through `{#snippet child({ props })}` wrapping a `Button`/element, and assert in both modes that the child-rendered element receives `data-slot="responsive-dialog-<part>"`, `data-variant`, the caller's `class`, and working click/keyboard behaviour (the trigger opens, the close closes) per SC-002, D-03 and contracts §2 "Required snippets" (missing)
- [X] T042 [P] Give `useIsMobile()` real coverage and a reason to exist: it is exported from `src/lib/hooks/is-mobile.svelte.ts` but has no call site anywhere in `src/` (`ResponsiveDialogState` constructs `new IsMobile(...)` directly), so FR-007's "reusable, standalone reactive primitive that any component in this project can reuse" is unproven. Add a colocated test file `src/lib/hooks/is-mobile.test.ts` (or a test-only harness component, since `useIsMobile` must be called during component initialisation) asserting: the default `768` breakpoint produces `(max-width: 767px)`; `current` tracks the stubbed `MediaQueryList`; exactly one `change` listener is registered and removed on unmount; a changing breakpoint getter re-creates the query; and the guarded no-`matchMedia` environment leaves `current === false` without throwing (data-model.md Entity 1 validation rules, contracts §1 guarantees) (partial)
- [X] T043 [P] Extend the per-part guarantees in `responsive-dialog.test.ts` from `Content` to the other eight parts: contracts §2 guarantees 4 and 5 state that for **every** part `ref` is `$bindable(null)` bound to the rendered element and `...restProps` reaches that element, but `responsive-dialog.test.svelte` binds `ref` only on `Content` and only `Content` gets a `contentRest` spread. Add bindable `ref` reporting and an arbitrary-attribute (`id`, `data-*`, `aria-*`) spread for `Trigger`, `Close`, `Overlay`, `Header`, `Footer`, `Title` and `Description`, asserted in both dialog and drawer mode (partial)
- [X] T044 [P] Add a `portalProps` test to `responsive-dialog.test.ts`: `ResponsiveDialogContent` forwards `portalProps` to both branches and it is documented in plan.md's `ResponsiveDialogContentProps` table, contracts §2 and the docs props table, but no test passes it. Assert that a `portalProps={{ to: <element> }}`-style value mounts the content inside the supplied container in dialog mode and in drawer mode (missing)
- [X] T045 [P] Assert the layout half of User Story 1's Independent Test in `responsive-dialog.test.ts`: the current rendering tests check only `role="dialog"` and `data-variant`, never that the dialog branch is centered and the drawer branch is bottom-anchored. Add assertions on the active content's layout classes (dialog: the `Dialog.Content` centering classes; drawer: the `Drawer.Content` bottom-anchored classes) in both modes, per US1/AC1, US1/AC2 and the US1 Independent Test (partial)
- [X] T046 [P] Prove modal focus containment in `responsive-dialog.test.ts`: the existing Tab test only steps first-field → second-field, so contracts §4's "Moves focus within the content (focus is trapped)" and FR-009's Tab/Shift+Tab requirement are not actually demonstrated. Focus the last focusable descendant of the open content, press `Tab`, and assert focus is still inside the content; focus the first, press `Shift+Tab`, and assert the same — in both dialog and drawer mode, driven through `userEvent` (partial)
- [X] T047 [P] Satisfy SC-003's "the open / close / confirm-cancel path of each reproduced example is exercised by at least one assertion in `responsive-dialog.test.ts`": the harness mirrors only the "Default" preview. Add harness modes plus assertions for (a) the Confirmation preview — open, click the `Close`-backed "Cancel" and assert it closes, click the destructive action and assert it does **not** close while its pending state is shown — and (b) the Variant Styling preview — `Content` and `Footer` carrying `data-[variant=dialog]:` / `data-[variant=drawer]:` class lists keep those classes across a breakpoint crossing (partial)
- [X] T048 [P] Close the two remaining root-level contract gaps in `responsive-dialog.test.ts`: assert contracts §2's "Unknown props pass through to the active root" by passing an arbitrary rest prop to `ResponsiveDialog.Root` and observing it on the active root's rendered output in both modes, and assert `defaultOpen: true` seeds the composition in drawer mode as well as dialog mode (FR-002, quickstart.md scenario 5 — currently asserted for dialog mode only) (partial)

**Checkpoint**: Every contract guarantee, documented prop and documented keyboard interaction is
covered by an assertion, and the upstream keyboard-table drift is recorded. Re-run the four gates
(`pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build`) after this phase.
