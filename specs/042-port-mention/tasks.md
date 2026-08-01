---
description: 'Task list for the Mention port'
---

# Tasks: Port Mention Component

**Input**: Design documents from `specs/042-port-mention/` (plan.md, spec.md, research.md,
data-model.md, contracts/public-api.md, quickstart.md)

**Tests**: Tests are MANDATORY (Constitution Principle III/VII). Every behavioural area below must be
covered before the gate phase runs; nothing may be `.skip`/`.todo`.

**Organization**: Setup → Tests → Core component files → Barrel and types → Demo route → Registry
entry and docs polish → Verification, per the phase order requested for this feature. `[Story]` tags
mark which user story (spec.md) a test task's assertions validate; implementation tasks that serve
several stories at once are left untagged, matching how Setup/Foundational/Polish tasks are untagged
in the standard template.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency)
- **[Story]**: Which user story (US1…US6, spec.md) this task's assertions validate
- Every task names a concrete, repo-relative file path

---

## Phase 1: Setup (dependencies, registry stub)

**Purpose**: Confirm the composition surface this port relies on, then create the empty file
skeleton so later phases (and their imports) resolve against real paths from the start.

- [X] T001 Read `.reference/diceui/packages/mention/src/*` at pinned commit
      `d9763d82530416dfa4c81c462387b55d06bae4ec` and confirm the file list matches plan.md's mapping
      (`mention-root.tsx`, `mention-label.tsx`, `mention-input.tsx`, `mention-highlighter.tsx`,
      `mention-portal.tsx`, `mention-content.tsx`, `mention-item.tsx`); no repo file is written by this
      task.
- [X] T002 [P] Verify the three in-repo dependencies this port composes are present and export what
      plan.md expects: `src/lib/components/ui/combobox/combobox.svelte.ts` (`ComboboxFilterStore`,
      `scoreItem`), `src/lib/components/ui/direction-provider/direction-provider.svelte.ts`
      (`useDirection`, `Direction`), `src/lib/components/ui/checkbox-group/checkbox-group.svelte.ts`
      (`FormControlState`).
- [X] T003 Create the component directory skeleton with minimal typed stub content (empty exported
      `Props` types, a stub default export) for every source file, so subsequent test imports resolve:
      `src/lib/components/ui/mention/index.ts`, `src/lib/components/ui/mention/mention.svelte`,
      `src/lib/components/ui/mention/mention-label.svelte`,
      `src/lib/components/ui/mention/mention-input.svelte`,
      `src/lib/components/ui/mention/mention-highlighter.svelte`,
      `src/lib/components/ui/mention/mention-portal.svelte`,
      `src/lib/components/ui/mention/mention-content.svelte`,
      `src/lib/components/ui/mention/mention-item.svelte`,
      `src/lib/components/ui/mention/mention-caret.ts`,
      `src/lib/components/ui/mention/mention.svelte.ts`.
- [X] T004 [P] Add a registry stub entry for `"mention"` in `registry.json` (`name`, `type:
      "registry:ui"`, `title`, `description`, `registryDependencies: ["combobox",
      "direction-provider", "checkbox-group"]`, `dependencies: ["bits-ui"]`, and a `files` array
      listing the ten paths created in T003) — do **not** run `registry:build` yet, since the stub
      files have no real content.

**Checkpoint**: Directory skeleton exists, dependencies confirmed, registry stub in place — test
authoring can begin.

---

## Phase 2: Tests (write first; MUST fail against the stubs from Phase 1)

**Purpose**: Principle III/VII — colocate every required assertion before real implementation lands,
so the Core phase has a red suite to turn green. All tasks in this phase touch
`src/lib/components/ui/mention/mention.test.ts` except T005 and T005a, so only those two are `[P]`.

**Upstream test floor**: `.reference/diceui/packages/mention/test/mention.test.tsx` has 15 cases; T006–
T010 together MUST translate all 15 so the constitutional floor is traceable: "renders without
crashing" (T006/T008 composition), "handles controlled state" (T008), "handles keyboard navigation"
(T006), "handles disabled state" (T010), "handles read only state" (T010), "handles default filtering"
(T010), "handles exact match filtering" (T010), "handles custom filtering" (T010), "handles custom
trigger character" (T010), "supports RTL direction" (T009), "handles backspace deletion of mentions"
(T006), "handles Cmd/Ctrl backspace deletion of mentions" (T006, FR-023b), "supports accessibility
features" (T007), "removes a mention in the middle of text and updates positions correctly" (T006),
"allows mention trigger in middle of text and preserves text after" (T006/T008).

- [X] T005 [P] Create the composition harness `src/lib/components/ui/mention/mention.test.svelte`
      exercising: default full composition, bare-part rendering (each part outside `<Mention.Root>`,
      for the guard-rail tests), an empty-item-`value` mode, a `<form name="...">` mode, and both
      `bind:value`/`bind:open`/`bind:inputValue` and function-binding (`get`/`set`) modes.
- [X] T005a [P] [US3] Write direct unit tests for the rune-free module in
      `src/lib/components/ui/mention/mention-caret.test.ts`: `resolveMentionTrigger` against the full
      six-condition matrix of data-model.md §6.1 (start of text, after a space, after a newline,
      mid-word `foo@bar.com`, caret inside an existing span, search containing a space, interfering
      non-separator text after the caret, caret at/behind the trigger); `addMentionSpan` splice
      arithmetic (§6.2) including shifting of later spans; `removeMentionSpans` multi-span removal and
      offset shifting (§6.3); `shiftMentionSpans` under insertions and deletions before, inside and
      after a span (§6.4); and `getLineHeight`'s non-finite fallback (divergence D-9).
- [X] T006 [US1,US2,US3,US5] Write keyboard-interaction tests in
      `src/lib/components/ui/mention/mention.test.ts`: typing the trigger opens the popup at a word
      boundary (start of field, after a space/newline) and does **not** open mid-word (e.g. the `@` in
      `foo@bar.com`) or when interfering non-separator text immediately follows the caret, per
      `resolveMentionTrigger`'s six-condition rule in data-model.md §6.1 (FR-004); typing further
      characters narrows `search` and the visible items; typing a space while open closes the popup;
      opening the popup auto-highlights the first enabled visible item and a request to open while a
      non-empty search matches zero items is ignored (FR-013a); `ArrowDown`/`ArrowUp` move the highlight
      one item at a time and stop at the boundary unless `loop`; `Home`/`End` jump to the first/last
      visible item, while `Meta`/`Ctrl` + `Home`/`End` preserve native caret movement instead (FR-015);
      `Enter` on a highlighted item selects it and splices `<trigger><label> ` at the correct offset
      leaving text before the trigger and after the original caret byte-for-byte untouched (data-model.md
      §6.2, SC-005); `Enter` with the highlight cleared (all visible items disabled) closes without
      changing the value and without `preventDefault` (FR-013a); `Tab` while open closes the popup and
      leaves focus movement to the browser, and with `modal` set `Tab` instead selects the highlighted
      item and calls `preventDefault` (upstream `mention-input.tsx:630-638`, FR-017a); `Escape` closes
      without changing the value or moving focus; `Backspace`/`Delete` adjacent to or inside a mention
      removes the whole mention in one edit and drops its value (data-model.md §6.3); a plain `Backspace`
      on a mention's trailing space removes only the space and keeps the mention and its value (FR-023a),
      while `Meta`/`Ctrl` + `Backspace` removes the nearest preceding mention across whitespace in one
      edit (FR-023b, upstream test "handles Cmd/Ctrl backspace deletion of mentions"); the same removal
      behavior for a selection overlapping one or more mentions; `ArrowLeft`/`ArrowRight` adjacent to a
      mention jump over it in one step, and holding `Meta`/`Ctrl` jumps to the mention's exact start/end
      boundary (FR-025). Use `userEvent`, not `fireEvent`, for every key.
- [X] T007 [US1,US2] Write accessibility roles/ARIA and accessible-name tests in
      `src/lib/components/ui/mention/mention.test.ts`: query the popup via
      `[data-slot="mention-content"]` and items via `[data-slot="mention-item"]` (bits-ui layer content
      is invisible to jsdom's `getByRole` — assert `role`/`aria-*` with `toHaveAttribute` instead, per
      the memory note and quickstart.md's test-environment caveat); assert the field carries
      `role="combobox"`, `aria-expanded`, `aria-controls` pointing at the listbox id,
      `aria-autocomplete="list"`, and `aria-activedescendant` tracking the highlighted item's id; assert
      the popup carries `role="listbox"`; assert each item carries `role="option"` and `aria-selected`
      reflecting the current value list; assert `<Mention.Label>`'s `for`/`id` matches the field's `id`.
      Also assert the field carries `aria-labelledby` pointing at `<Mention.Label>`'s id,
      `autocomplete="off"`, and `aria-disabled`/`aria-readonly` matching the root's `disabled`/`readonly`,
      and that the popup carries `aria-orientation="vertical"` (FR-018/FR-019). Additionally assert the
      popup content carries `data-side`/`data-align` reflecting its resolved placement and exposes the
      `--dice-transform-origin`, `--dice-available-width`, and `--dice-available-height` CSS custom
      properties (FR-019a). Finally, assert `[data-slot="mention-highlighter"]` renders one `[data-tag]`
      segment per entry in the mention list, in text order, and that the segment set updates when a
      mention is inserted and when one is removed (FR-003a).
- [X] T008 [US1] Write controlled-vs-uncontrolled tests in
      `src/lib/components/ui/mention/mention.test.ts`, driven entirely through user interaction inside
      one render (never `rerender()` — a non-bound `$bindable` resets on props invalidation, per memory):
      `defaultValue`/`defaultOpen`/uncontrolled `inputValue` seed the component and update via typing and
      selection; passing `value`/`open`/`inputValue` makes the parent authoritative, `onValueChange`/
      `onOpenChange`/`onInputValueChange` fire with the next value, and the component does not move on
      its own when a function binding declines the write (the DOM re-asserts from context, per
      data-model.md §5).
- [X] T009 [US6] Write RTL tests in `src/lib/components/ui/mention/mention.test.ts`: with `dir="rtl"`,
      both the field and `[data-slot="mention-content"]` carry `dir="rtl"` and the popup's alignment
      mirrors (`data-align` flips relative to the `ltr` case); with no explicit `dir`, wrapping the
      component in the project's `direction-provider` set to `rtl` produces the same result without an
      explicit prop.
- [X] T010 [US4,US5] Write edge-case and guard-rail tests in
      `src/lib/components/ui/mention/mention.test.ts`: `disabled` suppresses opening, filtering, typing
      and selection everywhere and `onValueChange` never fires; `readonly` blocks value changes but
      lets an already-open popup be viewed; `<Mention.Item value="">` throws
      `` `<Mention.Item>` value cannot be an empty string. `` at initialisation; rendering
      `<Mention.Label>`, `<Mention.Input>`, `<Mention.Portal>`/`<Mention.Content>`, or `<Mention.Item>`
      outside `<Mention.Root>` each throws a documented error naming the part and `` `<Mention.Root>` ``;
      a non-default `trigger` (e.g. `"#"`) opens on that character and not on `@`; a custom `onFilter`
      fully replaces the built-in matcher and `exactMatch` is ignored when both are supplied;
      `exactMatch` alone does case-insensitive substring matching; filtering to zero visible items closes
      the popup and clears the highlight; a cut/paste overlapping a mention removes its value the same as
      an explicit delete; a `name` prop inside a native `<form>` submits the value list via a
      visually-hidden input honoring `disabled`/`required`. `modal` set: an open popup locks background
      scrolling and blocks outside pointer interaction, and `Tab` selects the highlighted item instead of
      closing (assert against the non-modal default in the same test, FR-010a). With one disabled item
      among enabled ones: `ArrowDown`/`ArrowUp` skip it, clicking it and pressing `Enter` on it change
      nothing, and it carries `data-disabled` (FR-021). Hovering an enabled item via `pointermove` moves
      the highlight to it (FR-021a); a `pointerdown` inside an already-inserted mention prevents default
      caret placement and snaps the caret to the mention's end (FR-022a).

**Checkpoint**: Full suite exists and fails against the Phase 1 stubs (unimplemented behaviour, not
compile errors) — Core implementation can begin.

---

## Phase 3: Core component files

**Purpose**: Replace the Phase 1 stubs with real behaviour. Foundation modules first (no UI
dependents), then parts in the order the root composes them. One task per exported subcomponent from
plan.md's Public API section (`Root`, `Label`, `Input`, `Portal`, `Content`, `Item`), plus the two
shared reactive/pure modules and the one internal (unexported) part.

- [X] T011 Implement `src/lib/components/ui/mention/mention-caret.ts`: the `MentionSpan`,
      `TriggerMatch`, `CaretAnchor` types; `measureTextWidth`, `getLineHeight` (finite-number guard
      falling back to `offsetHeight`, divergence D-9), `getCaretRect`, `createCaretAnchor`
      (data-model.md §6.5); `resolveMentionTrigger` implementing the six-condition word-boundary rule
      (data-model.md §6.1); `addMentionSpan` (data-model.md §6.2 splice arithmetic); `removeMentionSpans`
      (data-model.md §6.3); `shiftMentionSpans` (data-model.md §6.4). Rune-free — no `$state`/`$derived`
      in this file.
- [X] T012 Implement `src/lib/components/ui/mention/mention.svelte.ts`: `MentionItemData` (throws on
      empty `value`), `MentionCollection` (`$state.raw`, `register`, `entries`, `getItems`,
      `getEnabledItems`, mirroring `combobox.svelte.ts`), `MentionRootState` with the `$state` fields
      (`mentions`, `search`, `highlightedElement`, `caretAnchor`, `inputElement`, `isPasting`,
      `collection`) and `$derived` fields (`values`, `open`, `inputValue`, `trigger`, `disabled`,
      `readonly`, `exactMatch`, `loop`, `modal`, `dir`, `dataState`, `inputId`/`labelId`/`listId`,
      `filter` via the reused `ComboboxFilterStore`, `visibleItems`, `highlightedItem`) and the methods
      table from data-model.md §3 (`setValues`/`addValue`/`removeValues`, `setOpen`, `setInputValue`,
      `highlightMove`, `addMention`, `removeMentions`, `updateTrigger`, `closeMenu`, `isItemVisible`);
      the `Symbol('mention')` context key with `setMentionContext`/`getMentionContext` (the latter
      throwing `` `<Mention.<Part>>` must be used within `<Mention.Root>`. `` when called outside a
      provider). Depends on T011 for the pure helpers it calls.
- [X] T013 Implement `src/lib/components/ui/mention/mention.svelte` (Root): the `value`/`open`/
      `inputValue` controlled-or-uncontrolled trio (each `$bindable`, seeded via `untrack(() =>
      defaultValue ?? [])` per data-model.md §5), direction resolution through
      `direction-provider`'s `useDirection`, native-form participation through `checkbox-group`'s
      `FormControlState`, instantiates and publishes `MentionRootState` via `setMentionContext`,
      `data-slot="mention"`, `data-state`, `data-disabled` (`cond ? '' : undefined`). Depends on T012.
- [X] T014 [P] Implement `src/lib/components/ui/mention/mention-label.svelte`: reads
      `getMentionContext()`, renders `<label id={labelId} for={inputId}>`, `data-slot="mention-label"`.
      Depends on T012 only (no dependency on T013/T015/T016).
- [X] T015 Implement `src/lib/components/ui/mention/mention-highlighter.svelte`: renders the `data-tag`
      segment overlay behind the field from `MentionRootState.mentions`, syncing size/position with one
      `$effect` that wires `ResizeObserver`, `MutationObserver`, and `scroll`/`resize` listeners and
      tears down all four in its cleanup; `data-slot="mention-highlighter"`. Depends on T012.
- [X] T016 Implement `src/lib/components/ui/mention/mention-input.svelte`: the full event surface —
      `oninput`/`onbeforeinput` calling `updateTrigger`/`resolveMentionTrigger`, `onkeydown` for
      `ArrowDown`/`ArrowUp`/`Home`/`End`/`Enter`/`Escape`/`Backspace`/`Delete`/`ArrowLeft`/`ArrowRight`
      atomic-mention handling, `oncut`/`onpaste` mention-aware removal and best-effort mention
      reconstruction from pasted text, `onclick`/`onpointerdown`/`onselect` for caret tracking
      (including snapping the caret to a mention's end on `pointerdown` inside it, FR-022a), the
      `child` snippet (`MentionInputChildProps`) for the `<textarea>` composition escape hatch with its
      `ref` attachment, mounting `<MentionHighlighter>` inside a `position: relative` wrapper,
      `data-slot="mention-input"`, `data-state`, `data-disabled`, `data-readonly`. Depends on T011
      (trigger/span algebra), T012 (context/state), T015 (renders the highlighter).
- [X] T017 [P] Implement `src/lib/components/ui/mention/mention-portal.svelte`: thin wrapper over
      bits-ui's `Popover.Portal` (`to` default `document.body`, `disabled` default `false`). Depends on
      T012 only.
- [X] T018 Implement `src/lib/components/ui/mention/mention-content.svelte`: bits-ui `Popover.Content`
      driven by `customAnchor={caretAnchor}` from context, RTL `align` flip via `useDirection`,
      `data-slot="mention-content"`, `data-state`, `data-side`, `data-align`, `data-pasting`, and the
      `--dice-transform-origin`/`--dice-available-width`/`--dice-available-height`/
      `--dice-anchor-width`/`--dice-anchor-height` CSS variables aliased onto `--bits-popover-*`.
      Depends on T012 (context) and T016 (the caret anchor `mention-input.svelte` computes).
- [X] T019 Implement `src/lib/components/ui/mention/mention-item.svelte`: registers into
      `MentionCollection` on mount (unregisters on cleanup), `role="option"`, `aria-selected`,
      `data-slot="mention-item"`, `data-value`, `data-selected`, `data-highlighted`, `data-disabled`,
      `data-dice-collection-item`, click/pointer selection calling `addMention`, `onpointermove` moving
      the highlight to the item (FR-021a). Depends on T012 (registration/selection) and T018 (renders
      inside `<Mention.Content>`).

**Checkpoint**: Every part is real; the Phase 2 suite should now pass except for barrel-level import
assertions still pointed at the T003 stub `index.ts`.

---

## Phase 4: Barrel and types

- [X] T020 Finalize `src/lib/components/ui/mention/index.ts`: import and re-export `Root`, `Label`,
      `Input`, `Portal`, `Content`, `Item` under both short names and `Mention`/`MentionRoot`/
      `MentionLabel`/`MentionInput`/`MentionPortal`/`MentionContent`/`MentionItem` aliases; re-export
      every part's `Props` type; re-export `mention-caret.ts`'s pure functions/types
      (`measureTextWidth`, `getLineHeight`, `getCaretRect`, `createCaretAnchor`, `resolveMentionTrigger`,
      `addMentionSpan`, `removeMentionSpans`, `shiftMentionSpans`, `MentionSpan`, `TriggerMatch`,
      `CaretAnchor`) and `mention.svelte.ts`'s `MentionRootState`, `MentionCollection`,
      `setMentionContext`, `getMentionContext` and their types (plan.md "Shared modules exported for
      later reuse"). All imports use the `.js` extension. Depends on T013–T019.

**Checkpoint**: The full Phase 2 test suite passes end to end against the real barrel.

---

## Phase 5: Demo route

All three tasks touch the same file, so none is `[P]`.

- [X] T021 Create `src/routes/docs/components/mention/+page.svelte` with the page shell (`<svelte:head>`
      title, intro heading/description) and the **Default** `<ComponentPreview>` section mirroring
      `mention-demo.tsx`: a `<textarea>` via the `child` snippet, a user list with distinct `label`/
      `value`, `data-tag` styling using `bg-info/15 text-info` (not upstream's raw `bg-blue-200
      text-blue-950`). Depends on T020.
- [X] T022 Add the **Custom Trigger** `<ComponentPreview>` section to
      `src/routes/docs/components/mention/+page.svelte`, mirroring
      `mention-custom-trigger-demo.tsx` (`trigger="#"`). Depends on T021.
- [X] T023 Add the **With Custom Filter** `<ComponentPreview>` section (mirroring
      `mention-custom-filter-demo.tsx`: `trigger="/"`, controlled `value` + `inputValue`, a starts-with
      `onFilter`) plus the API reference (one props table per part, a data-attribute table, and a
      keyboard table) to `src/routes/docs/components/mention/+page.svelte`. Depends on T022.

---

## Phase 6: Registry entry and docs polish

- [X] T024 Run `pnpm run format` (shadcn/generator output, including the Phase 1–5 files, is not
      Prettier-formatted).
- [X] T025 Replace the Phase 1 registry stub with the final entry in `registry.json`: `files` listing
      all ten non-test source paths (index.ts, the seven `.svelte` parts, `mention-caret.ts`,
      `mention.svelte.ts`) with `type: "registry:ui"`, `registryDependencies: ["combobox",
      "direction-provider", "checkbox-group"]`, `dependencies: ["bits-ui"]`; the two test files
      (`mention.test.ts`, `mention.test.svelte`) are deliberately absent. Depends on T020, T023.
- [X] T026 Run `pnpm run registry:build` and confirm `static/r/mention.json` is written with the
      content from T025. Depends on T025.

---

## Phase 7: Verification

- [X] T027 Run `pnpm run format` (re-format the T025 `registry.json` edit and the `static/r/mention.json`
      output from T026, since `lint`'s `prettier --check .` would otherwise fail on them), then
      `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, and fix
      everything that fails.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Tests (Phase 2)**: depends on the Phase 1 skeleton (T003) existing so imports resolve; every test
  task is expected to fail until Phase 3 lands.
- **Core component files (Phase 3)**: depends on Phase 2 existing (tests-first); within the phase,
  T011 blocks T012; T012 blocks T013–T019; T015 blocks T016; T016 blocks T018; T018 blocks T019.
- **Barrel and types (Phase 4)**: depends on all of Phase 3 (T013–T019).
- **Demo route (Phase 5)**: depends on Phase 4 (T020).
- **Registry entry and docs polish (Phase 6)**: T024 has no dependency beyond Phase 5 existing; T025
  depends on T020 and T023; T026 depends on T025.
- **Verification (Phase 7)**: depends on everything above — always the last phase.

### Parallel Opportunities

- T002 and T004 (Phase 1) can run alongside each other once T001/T003 land.
- T005 and T005a (Phase 2) can run in parallel with T006–T010, since they are different files; T006–
  T010 themselves are sequential (same file, `mention.test.ts`).
- T014 and T017 (Phase 3) can run in parallel with the T011→T012→T013→T015→T016→T018→T019 chain, since
  neither depends on anything past T012.

---

## Parallel Example: Setup and early Core

```bash
# Phase 1, after T001/T003:
Task: "Verify combobox/direction-provider/checkbox-group exports (T002)"
Task: "Add registry stub entry in registry.json (T004)"

# Phase 3, once T012 lands:
Task: "Implement mention-label.svelte (T014)"
Task: "Implement mention-portal.svelte (T017)"
```

---

## Implementation Strategy

1. Complete Phase 1 (Setup) and Phase 2 (Tests) — the suite should compile and fail red.
2. Complete Phase 3 (Core) in dependency order: T011 → T012 → {T013, T014, T017} → T015 → T016 → T018
   → T019. Re-run the component's suite after each task
   (`pnpm run test:unit -- --run src/lib/components/ui/mention/mention.test.ts`).
3. Complete Phase 4 (Barrel) — full suite should now be green.
4. Complete Phase 5 (Demo route) and Phase 6 (Registry + docs polish).
5. Complete Phase 7 (Verification) — all four gates green, nothing suppressed.

Do NOT run git write commands — the orchestrator owns the working tree. Do not touch `.reference/`,
`.specify/`, `.claude/`, `scripts/`, `.port-state.json` or `.port-logs/`.

---

## Phase 8: Convergence

**Purpose**: Close the gaps found by auditing the implemented port against `spec.md`, `plan.md` and
Phases 1–7 above. All five quality gates are currently green (`format`, `check`, `lint`,
`test:unit --run` 3657 passing, `build`), the `registry.json` entry and `static/r/mention.json` are
complete, and all three upstream demos are present on the docs route — the items below are the
remaining behavioural and coverage gaps only.

Three of them are places where **this spec is deliberately stricter than upstream**: upstream's
`mention-input.tsx` does not implement them either. Constitution Principle II (Upstream Parity) is
non-negotiable in the direction of *not losing* upstream behaviour; the spec's FRs are what defines
this port's contract, so implement the FR and record the added behaviour as a divergence in the doc
comment of the method that implements it.

- [X] T028 [US5] Make `Delete` with **no selection** remove a mention atomically in
      `src/lib/components/ui/mention/mention.svelte.ts`: `onInputKeydown` currently routes only
      `Backspace` (via `#backspaceMention`, guarded by `event.key === 'Backspace' && !this.open &&
      !hasSelection`) and selection-overlap `Backspace`/`Delete` (via `#deleteSelection`) into the
      mention-aware path, so a caret placed immediately adjacent to, or inside, an inserted mention and
      followed by `Delete` falls through to the browser and shaves a single character off the mention's
      text while its span and its value stay in the lists. Add a `Delete` branch that splices out the
      whole span plus its trailing space through `#spliceOutMention` and drops its value, and cover
      caret-adjacent and caret-inside `Delete` in `src/lib/components/ui/mention/mention.test.ts`.
      Upstream (`packages/mention/src/mention-input.tsx:483`) handles `Backspace` only — note the
      divergence in the branch's doc comment. per FR-023c, SC-006 (missing)
- [X] T029 [US5] Drop the mentions a **paste overwrites** in
      `src/lib/components/ui/mention/mention.svelte.ts`: `onInputPaste` returns early when the pasted
      text contains no trigger character (letting the browser replace the selection while the
      overwritten mentions keep their spans and their values), and on the trigger-bearing path it splices
      `input.value.slice(0, caret) + newText + input.value.slice(selectionEnd)` without ever removing the
      spans that lived inside `[caret, selectionEnd)` or their values — only the newly rebuilt mentions
      are appended. Remove every mention the pasted range overlaps (the `#mentionsInRange` +
      `removeValues` + `removeMentions` trio `onInputCut` already uses) on both paths, re-base the
      surviving spans for the length delta, and assert it in
      `src/lib/components/ui/mention/mention.test.ts` for a plain paste over a mention and for a paste
      that both overwrites one mention and inserts another. Upstream
      (`packages/mention/src/mention-input.tsx:781-978`) does not do this — note the divergence.
      per FR-026, spec Edge Cases "A cut or paste operation that fully or partially overlaps …" (missing)
- [X] T030 [US5] Make `readonly` inert to the **pointer**, not just the keyboard, in
      `src/lib/components/ui/mention/mention-item.svelte`: `onpointermove` writes
      `root.highlightedElement` whenever `disabled || root.disabled` is false, so hovering an item while
      the root is `readonly` still moves the highlight even though `onInputKeydown` returns early for
      `ArrowDown`/`ArrowUp`/`Home`/`End` in that state. Gate the pointer-move highlight on
      `root.readonly` as well, and extend the existing "blocks value changes while readonly but still
      shows an open popup" test in `src/lib/components/ui/mention/mention.test.ts` so it asserts
      positively that neither `ArrowDown`/`ArrowUp` nor a `pointermove` over an item changes
      `[data-highlighted]` — today that test only asserts the field's value and `onValueChange`.
      Upstream's `mention-item.tsx:120-128` does not consult `readonly` either — note the divergence.
      per FR-028, spec Edge Cases "a `readonly` field's popup … highlight movement and selection become
      inert" (partial)
- [X] T031 [US5] Add the missing **caret-inside** removal assertion to
      `src/lib/components/ui/mention/mention.test.ts`: SC-006 requires the caret-adjacent, caret-inside
      **and** selection-overlap cases to be verified automatically, and the caret-adjacent
      (`setSelectionRange(9, 9)`) and selection-overlap (`setSelectionRange(0, 24)`) cases are covered,
      but no test places the caret *inside* a mention's text (e.g. `setSelectionRange(5, 5)` in
      `@kickflip`) and presses `Backspace`. The behaviour is already implemented
      (`#backspaceMention`'s `caret > mention.start && caret <= mention.end` clause); only the assertion
      is missing. per SC-006 (missing)
- [X] T032 Reconcile `specs/042-port-mention/contracts/public-api.md` with the shipped
      `MentionInputChildProps`: the contract states the child props carry `value`, but
      `mention-input.svelte` deliberately never passes `value` as an attribute (it re-asserts
      `element.value` from context in an `$effect` instead, so a mention splice's caret placement is not
      knocked to the end), and `MentionInputProps` omits `value` from `HTMLInputAttributes` altogether.
      Correct the contract line and state the reason, so the documented interface matches the shipped
      one. Do not change the component. per plan.md "Public API" → contracts/public-api.md (contradicts)
- [X] T033 Re-run the five quality gates after T028–T032 — `pnpm run format`, `pnpm run check`,
      `pnpm run lint`, `pnpm run test:unit -- --run`, `pnpm run build` — and fix every failure at its
      cause, with no `@ts-ignore`/`@ts-expect-error`/`eslint-disable`/`svelte-ignore`/`as any`/`.skip`
      and no config loosening. `registry.json` and `static/r/mention.json` need no change unless
      T028–T031 add a file. per plan.md Phase E, Constitution VII (missing)
