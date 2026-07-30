# Tasks: Relative Time Card

**Input**: Design documents from `/specs/015-port-relative-time-card/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/public-api.md, quickstart.md

**Tests**: MANDATORY per Constitution Principle III and the component-specific guidance in this
feature's planning context. No upstream test file exists for this component, so
`relative-time-card.test.ts` (+ the `relative-time-card.test.svelte` harness) is the floor, not a
port of an existing suite.

**Path conventions** (from plan.md § Project Structure):

- Component source: `src/lib/components/ui/relative-time-card/`
- Demo route: `src/routes/docs/components/relative-time-card/+page.svelte`
- Registry: `registry.json` (repo root)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps the task to a user story (US1–US4) for traceability

---

## Phase 1: Setup

**Purpose**: Confirm the ground the whole port stands on before any file is written.

- [X] T001 Confirm no new npm dependency is required (research R-15): grep `package.json` for
      `bits-ui`, `tailwind-variants`, `@lucide/svelte`, `clsx`, `tailwind-merge` and confirm
      `src/lib/components/ui/hover-card/` already exists and exports `Root`, `Trigger`, `Content`
      (or their aliases) from `src/lib/components/ui/hover-card/index.ts`. No file changes; if any
      import is missing, stop and report — do not `shadcn-svelte add` mid-port.
- [X] T002 [P] Create the empty component folder `src/lib/components/ui/relative-time-card/` and
      the empty demo folder `src/routes/docs/components/relative-time-card/` (directory
      scaffolding only, no files yet).

**Checkpoint**: folders exist, dependencies confirmed.

---

## Phase 2: Foundational — pure formatters (blocks every user story)

**Purpose**: `relative-time-format.ts` has no `$state` and no dependency on the runes module or any
component; every other phase imports it. This must exist and be correct before anything else is
built or tested.

- [X] T004 Create `src/lib/components/ui/relative-time-card/relative-time-format.ts` with:
      `JUST_NOW_THRESHOLD_SECONDS = 5`, `RELATIVE_CUTOFF_DAYS = 7`, `JUST_NOW_LABEL = 'just now'`,
      types `DateInput` and `RelativeTimeParts`, and functions `toDate`, `isValidDate`,
      `toIsoString`, `resolveLocale`, `diffRelativeTime`, `formatRelativeTime` (all 7 branches:
      just-now, past/future seconds, past/future minutes-with-seconds-residual, past/future
      minutes-without-residual, past/future hours, past/future days, ≥7-day locale-date fallback),
      `formatAbsoluteDateTime`, `formatZonedDate`, `formatZonedTime`, `formatTimeZoneLabel`,
      `formatTimeZoneAccessibleName` — signatures per `contracts/public-api.md` §7. Use
      `Intl.RelativeTimeFormat`, `Intl.NumberFormat({style:'unit'})` and
      `Intl.ListFormat({style:'narrow',type:'unit'})` for the relative string (never a bespoke
      formatter); `Intl.DateTimeFormat` for the four absolute formatters. `toDate`/`toIsoString`
      must not throw on an unparseable input (research R-07); an unknown IANA zone passed to any
      `Intl` constructor must be caught and fall back to the viewer's local formatting (research
      R-07).

**Checkpoint**: `relative-time-format.ts` compiles standalone and is importable with no other
component file existing yet.

---

## Phase 3: User Story 1 - See a timestamp in relative and absolute form (Priority: P1) 🎯 MVP

**Goal**: The trigger alone renders a correct, locale-formatted absolute date/time from a `Date`,
string, or number input, inside a `<time datetime>` element.

**Independent Test**: Render the component with a fixed past date and confirm the trigger shows the
formatted absolute date/time.

### Tests for User Story 1 (write first, confirm they fail before implementation)

- [X] T005 [P] [US1] Write the formatter-parity test group (V-2) in
      `src/lib/components/ui/relative-time-card/relative-time-card.test.ts`: with
      `vi.useFakeTimers()` pinned to `2026-07-30T10:00:00Z` and `locale = 'en-US'`, assert every
      row of `data-model.md` §5 for `formatRelativeTime` (just-now both directions, `30 seconds
      ago`/`in 30 seconds`, `5 minutes 30 seconds ago`, `5 minutes 0 seconds ago`, `in 5 minutes`
      with no residual, `2 hours ago`, `3 days ago`, the ≥7-day fallback both directions) plus
      `Invalid Date` (no throw) for `new Date('nope')`, and an unknown IANA zone falling back to
      local formatting (no throw) for `formatZonedDate`/`formatZonedTime`.
- [X] T006 [P] [US1] Write the trigger-rendering test group (part of V-3, the US1 slice) in the
      same `relative-time-card.test.ts`: the trigger is a `<button type="button">` with
      `data-slot="relative-time-card-trigger"`, containing a `<time datetime="…ISO…">` whose text
      equals `formatAbsoluteDateTime(date, locale)`; `date` passed as a `Date`, an ISO string, and
      a numeric timestamp all render identically. Also assert the invalid-input path at component
      level: `date="nope"` renders without throwing, the trigger carries `data-invalid=""`, its
      `<time>` has no `datetime` attribute, its text is `Invalid Date`, and (with `defaultOpen`) the
      card's `data-slot="relative-time-card-value"` `<time>` also reads `Invalid Date` (spec Edge
      Cases, data-model.md §8).

### Implementation for User Story 1

- [X] T007 [US1] Create `src/lib/components/ui/relative-time-card/relative-time-card.svelte.ts`
      with the constants and helpers needed for the trigger: `RELATIVE_TIME_CARD_VARIANTS`,
      `resolveRelativeTimeCardVariant`, `relativeTimeCardTriggerVariants` (`tv()`, base classes and
      the three variant rows from `contracts/public-api.md` §5), `DEFAULT_TIMEZONES`,
      `DEFAULT_UPDATE_INTERVAL`, `DEFAULT_OPEN_DELAY`, `DEFAULT_CLOSE_DELAY` (depends on T004 for
      the module to compile against `relative-time-format.ts` where needed; does not yet need
      `RelativeTimeCardState`, added in Phase 4).
- [X] T008 [US1] Create `src/lib/components/ui/relative-time-card/relative-time-card.svelte` with
      only the trigger for now: module-script `RelativeTimeCardProps` type
      (`date`, `variant`, `class`, `children`, `ref`, rest of `HTMLButtonAttributes`), a
      `<button type="button" data-slot="relative-time-card-trigger" data-variant={variant}>`
      rendering the default `<time datetime={toIsoString(date)}>{formatAbsoluteDateTime(...)}</time>`
      or `{@render children?.()}` when supplied, classed with
      `relativeTimeCardTriggerVariants({variant})` merged with the caller's `class` via `cn()`, and
      `data-invalid={isValidDate(toDate(date)) ? undefined : ''}` (boolean written `? '' : undefined`
      per CLAUDE.md §6) — `datetime={toIsoString(...)}` already yields `undefined` (and therefore no
      attribute) for an unparseable date (research R-07). Card/hover-card wiring is added in Phase 4
      — this task only makes T005/T006 pass.
- [X] T009 [US1] Create `src/lib/components/ui/relative-time-card/index.ts` re-exporting `Root`
      from `relative-time-card.svelte` (plus the `RelativeTimeCard` alias and
      `RelativeTimeCardProps` type) so T005/T006 can `import { RelativeTimeCard } from './index.js'`.

**Checkpoint**: User Story 1 is independently functional — the trigger renders a correct absolute
timestamp for all three `date` input shapes, with no hover card yet.

---

## Phase 4: User Story 2 - Inspect exact and relative time on hover or focus (Priority: P1)

**Goal**: Hovering or focusing the trigger opens a card with the live relative-time string and one
row per timezone plus the local zone; the string keeps updating while the card is open; teardown
leaves no timer.

**Independent Test**: Open the card via pointer hover and via `Tab`+focus, and confirm both show the
relative time and one row per configured timezone plus the local row.

### Tests for User Story 2 (write first, confirm they fail before implementation)

- [X] T010 [P] [US2] Write the card-opening and timezone-rows test group (the remainder of V-3) in
      `relative-time-card.test.ts`, using `userEvent.setup({ advanceTimers:
      vi.advanceTimersByTime })` (mandatory under fake timers, research R-14): `user.hover` +
      `vi.advanceTimersByTime(500)` opens the card; `user.unhover` + `advanceTimersByTime(300)`
      closes it; the open card contains one `listitem` per `timezones` entry plus one local row in
      that order, each with an accessible name matching `/^Time in .+: .+ .+$/`;
      `timezones={[]}` yields exactly one row; `timezones={['UTC','UTC']}` yields three rows with
      no `each_key_duplicate` crash (research R-11). Also assert `data-state`: the trigger carries
      `data-state="closed"` before hovering and `data-state="open"` once `openDelay` has elapsed,
      and the opened content element carries `data-slot="relative-time-card-content"` with
      `data-state="open"` (FR-017, data-model.md §8).
- [X] T011 [P] [US2] Write the live-ticker and teardown test group (V-4) in
      `relative-time-card.test.ts`: advancing `updateInterval` (default 1000 ms) updates the
      card's rendered relative-time text; changing `updateInterval` via `rerender` changes the
      cadence; calling `unmount()` then asserting `vi.getTimerCount() === 0` and that no further
      update occurs (FR-007, SC-003).
- [X] T012 [P] [US2] Write the keyboard-and-focus test group (the US2 slice of V-5) in
      `relative-time-card.test.ts`: `user.tab()` focuses the trigger and opens the card after
      `openDelay`; `Escape` closes it while open; tabbing away closes it after `closeDelay`;
      `Enter` re-opens the card immediately when the trigger is focused and the card was closed by
      `Escape` (assert without advancing `openDelay`), and `Enter` while the card is already open
      leaves it open (FR-014).

### Implementation for User Story 2

- [X] T013 [US2] Create
      `src/lib/components/ui/relative-time-card/relative-time-card-timezone.svelte`: module-script
      `RelativeTimeCardTimezoneProps` type (`date`, `timezone`, `class`, `ref`, rest of
      `HTMLAttributes<HTMLDivElement>`); renders `data-slot="relative-time-card-timezone"`,
      `data-timezone`, `data-local` (present only when `timezone` is `undefined`), `role="region"`
      and `aria-label="Time in {zone}: {date} {time}"` written **before** `{...restProps}` so a
      caller (and the root's `role="listitem"` override) can supersede them (research R-10); body
      is the zone label span plus the `formatZonedDate`/`formatZonedTime` `<time>` elements from
      `relative-time-format.ts` (depends on T004); `class` merged last via `cn()` (a documented
      divergence from upstream, which drops it — `contracts/public-api.md` §10 row 8).
- [X] T014 [US2] Extend
      `src/lib/components/ui/relative-time-card/relative-time-card.svelte.ts` (T007) with the
      `RelativeTimeCardState` class and its `RelativeTimeCardStateProps` type: `now = $state(Date.now())`
      seeded from getter-function inputs (`getDate`, `getUpdateInterval`), a `$derived` relative
      label built from `formatRelativeTime`, and a ticker start/stop method the root's `$effect`
      calls — the interval is created and cleared only inside the component's `$effect` teardown
      (T016), never inside this class's constructor (CLAUDE.md §4).
- [X] T015 [US2] Extend
      `src/lib/components/ui/relative-time-card/relative-time-card.svelte` (T008) to compose
      `HoverCard.Root`/`Trigger`/`Content` from `$lib/components/ui/hover-card/index.js`: the
      trigger renders through the hover-card's `child` snippet so it stays this component's own
      `<button>` (research R-02), **spreading that snippet's `props` onto the `<button>` before
      this component's own attributes so bits' `data-state`, `role="button"`,
      `aria-haspopup="dialog"`, `aria-expanded` and `aria-controls` all survive onto the rendered
      trigger (FR-017)**; forward `open` (`$bindable`), `defaultOpen`, `onOpenChange`,
      `openDelay` (default 500), `closeDelay` (default 300) to `HoverCard.Root`; forward `side`,
      `sideOffset`, `align`, `alignOffset`, `avoidCollisions`, `collisionBoundary`,
      `collisionPadding` to `HoverCard.Content` (all `undefined` by default so the composed part's
      own defaults apply — `contracts/public-api.md` §1.3); render inside `HoverCard.Content` the
      relative-time `<time>` (`data-slot="relative-time-card-value"`) plus a
      `data-slot="relative-time-card-timezones" role="list"` wrapper containing one
      `<RelativeTimeCard.Timezone role="listitem" timezone={tz} />` per `{#each timezones as tz, i
      (i)}` (index-keyed, research R-11) followed by one local row with no `timezone` prop.
- [X] T016 [US2] Add the ticker `$effect` to `relative-time-card.svelte` (T015): on mount, start
      `RelativeTimeCardState`'s interval at `updateInterval`; the effect's returned cleanup clears
      it; the effect re-runs (clearing and restarting) when `updateInterval` changes, matching
      FR-007's teardown guarantee — this is what T011 asserts against.
- [X] T016a [US2] Add `onkeydown` handling to the trigger in
      `src/lib/components/ui/relative-time-card/relative-time-card.svelte`: when `event.key ===
      'Enter'` and the card is currently closed, open it immediately (`open = true` plus
      `onOpenChange?.(true)`), bypassing `openDelay`; when it is already open, do nothing. Do not
      call `preventDefault()` — native button activation is preserved, and the caller's own
      `onkeydown` from `restProps` is still invoked. bits' `LinkPreview` trigger opens only on
      `:focus-visible`, so after `Escape` closes the card with focus still on the trigger nothing
      reopens it; this handler is what satisfies the upstream MDX's documented `Enter` interaction
      (FR-014).
- [X] T017 [US2] Extend `src/lib/components/ui/relative-time-card/index.ts` (T009) to also export
      `Timezone` from `relative-time-card-timezone.svelte` (plus the `RelativeTimeCardTimezone`
      alias and its prop type) and the `relative-time-card.svelte.ts` module exports
      (`RelativeTimeCardState`, the variant constants/functions, the default-timing constants) per
      `contracts/public-api.md` §8.

**Checkpoint**: User Stories 1 AND 2 both work independently — hover and keyboard both open the
card with correct rows and a live-updating relative string, with clean teardown.

---

## Phase 5: User Story 3 - Style the trigger and choose its content (Priority: P2)

**Goal**: `variant`, caller `class`, custom `children`, and a custom trigger element via `child` all
work without breaking the US2 hover/focus behaviour.

**Independent Test**: Render each documented `variant`, a custom `class`, and custom children; and
render a `child`-snippet trigger; confirm each renders distinctly and hover/focus still works.

### Tests for User Story 3 (write first, confirm they fail before implementation)

- [X] T018 [P] [US3] Write the variants/class/child/RTL test group (V-6) in
      `relative-time-card.test.ts`: each of `'default'`/`'muted'`/`'ghost'` applies its documented
      class row and `data-variant`; a caller-supplied `class` wins a conflicting utility; a
      `children` snippet passed to the root replaces the default `<time>` inside the trigger (the
      default formatted text is absent, the supplied content is present) while hover still opens
      the card (FR-003); a `child` snippet renders onto a substitute element (e.g. a `<Button>`) that is still the
      interactive trigger and still opens the card on hover/focus; no `outline-none` utility is
      present on any rendered part; no physical `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-` utility
      appears anywhere; under `dir="rtl"` the card still opens and timezone rows keep their order
      (FR-004, FR-011, FR-012, FR-015).

### Implementation for User Story 3

- [X] T019 [US3] Extend
      `src/lib/components/ui/relative-time-card/relative-time-card.svelte` (T015) with the
      `child` snippet: add a `RelativeTimeCardChildProps` type and a `child?: Snippet<[{ props:
      RelativeTimeCardChildProps }]>` prop; when supplied, render `{@render child({ props })}` in
      place of the default `<button>` (via the hover-card trigger's own `child`-forwarding), and
      `children` is then not rendered and `ref` stays `null`, matching
      `contracts/public-api.md` §1.1 (upstream's `asChild` — research R-03). This task, plus the
      variant/`class` wiring already present from T008/T015, is what makes T018 pass.

**Checkpoint**: All of User Story 1, 2, and 3 are independently functional.

---

## Phase 6: User Story 4 - Control card position, timing and open state (Priority: P3)

**Goal**: `side`/`align`/offset props reposition the card; `open`/`onOpenChange` let a parent fully
control the open state.

**Independent Test**: Render each `side`/`align` combination and confirm placement; drive
`open`/`onOpenChange` from outside and confirm the component defers to the parent.

### Tests for User Story 4 (write first, confirm they fail before implementation)

- [X] T020 [P] [US4] Write the controlled/uncontrolled test group (the remainder of V-5) in
      `relative-time-card.test.ts`: `defaultOpen` seeds an already-open card; `onOpenChange` fires
      `true` on focus-open and `false` on `Escape`, in both controlled and uncontrolled usage
      (FR-009).
- [X] T020a [P] [US4] Write the positioning pass-through test group (FR-010, the US4 Independent
      Test) in `src/lib/components/ui/relative-time-card/relative-time-card.test.ts`: rendering with
      `defaultOpen` and `side="top" align="start"`, the element carrying
      `data-slot="relative-time-card-content"` has `data-side="top"` and `data-align="start"`;
      rendering with `defaultOpen` and neither prop, it falls back to `data-side="bottom"` and
      `data-align="center"` (the composed `hover-card` defaults, contracts/public-api.md §1.3); and
      `sideOffset`, `alignOffset`, `avoidCollisions`, `collisionBoundary` and `collisionPadding` are
      each passed once in a render that asserts the card still opens, so a dropped forward is caught
      by `svelte-check` and at runtime.
- [X] T021 [P] [US4] Create
      `src/lib/components/ui/relative-time-card/relative-time-card.test.svelte` as a small test
      harness component that renders `<RelativeTimeCard.Root {date} bind:open bind:ref>` so
      `relative-time-card.test.ts` can assert `bind:open` keeps the parent authoritative and
      `bind:ref` exposes the trigger element (`contracts/public-api.md` §3); add the corresponding
      assertions to `relative-time-card.test.ts`, importing this harness.

### Implementation for User Story 4

- [X] T022 [US4] Verify/finish the positioning and controlled-open wiring in
      `relative-time-card.svelte` (T015 already forwards these props): confirm `open ??=
      defaultOpen` is seeded once (not on every render) and that `open` is `$bindable`; confirm
      `side`/`align`/`sideOffset`/`alignOffset`/`avoidCollisions`/`collisionBoundary`/
      `collisionPadding` reach `HoverCard.Content` untouched so its own defaults apply when
      `undefined`. This task closes any gap T020/T021 reveal — no new file.

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Demo route & registry polish

**Purpose**: Ship the documented surface — one demo page and the completed registry entry.

- [X] T023 [P] Create
      `src/routes/docs/components/relative-time-card/+page.svelte` with one `<ComponentPreview>`
      per upstream demo file — Default, Basic, Timezones, Variants — plus a Controlled section
      (bind:open) and props / data-attribute tables, per plan.md's Phase 6 and CLAUDE.md §8; demo
      dates held as `$state` seeded once in the instance script (per the SSR-drift note in
      plan.md's Risks table), not `new Date()` inline in markup.
- [X] T024 Append the `relative-time-card` entry to `registry.json` (the object from
      `contracts/public-api.md` §9 verbatim: `name`/`type`/`title`/`description`/
      `registryDependencies`/`dependencies`/`files`), confirming it lists all 5 non-test files
      (`index.ts`, `relative-time-card.svelte`, `relative-time-card-timezone.svelte`,
      `relative-time-card.svelte.ts`, `relative-time-format.ts`) and no test file, then run
      `pnpm run registry:build` and confirm `static/r/relative-time-card.json` is generated. This is
      the only edit to `registry.json` in this task list.

---

## Phase 8: Quality Gates (MANDATORY - Principle VII)

**Purpose**: The feature is not complete until all gates are green. No suppressions
(`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`,
deleted assertions, loosened configs) may be used to reach green — fix the root cause.

- [X] T025 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and
      `pnpm run build`, and fix everything that fails. Before this: run `pnpm run format` first
      (shadcn/generator output is not Prettier-formatted), then re-run the four commands above in
      order until all are green. Also re-run the V-1 anti-cheat greps from quickstart.md and
      confirm each returns nothing.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T002's folder must exist). BLOCKS every user story
  — `relative-time-format.ts` (T004) is imported by every test and every component file that
  follows.
- **User Story 1 (Phase 3)**: Depends on Phase 2 (T004). No dependency on US2–US4.
- **User Story 2 (Phase 4)**: Depends on Phase 2 (T004) and on Phase 3's files existing to extend
  (T007→T014, T008→T015/T016, T009→T017) — same files, so these tasks are sequential with Phase 3,
  not parallel to it.
- **User Story 3 (Phase 5)**: Depends on Phase 4 (extends the same `relative-time-card.svelte`
  from T015).
- **User Story 4 (Phase 6)**: Depends on Phase 4 (extends/verifies the same `relative-time-card.svelte`).
- **Demo & registry polish (Phase 7)**: Depends on Phases 3–6 (the full component surface must
  exist for the demo to compose it and for the registry file list to be real).
- **Quality Gates (Phase 8)**: Depends on everything above — always last.

### Within Each User Story

- Tests are written first per story and must fail before their implementation tasks land.
- Because every story after US1 extends the same three files
  (`relative-time-card.svelte`, `relative-time-card.svelte.ts`, `index.ts`), implementation tasks
  across stories are sequential, not parallel — only the **test** tasks within a story, and across
  stories once their target files are stable, are marked `[P]`.

### Parallel Opportunities

- T005 and T006 (US1 tests) — same test file, but independent `describe` blocks with no shared
  state; safe to author in parallel, though both land in one file so treat as logically parallel
  authorship, not concurrent file edits.
- T010, T011, T012 (US2 tests) — same reasoning as above.
- T018 (US3), T020/T020a/T021 (US4) — independent describe blocks/harness file.
- T023 (demo route) can proceed in parallel with Phase 8 prep once Phase 6 is done, since it
  touches a different file tree (`src/routes/**` vs `src/lib/components/ui/**`).

---

## Parallel Example: User Story 2 tests

```bash
Task: "Write the card-opening and timezone-rows test group (V-3 remainder) in relative-time-card.test.ts"
Task: "Write the live-ticker and teardown test group (V-4) in relative-time-card.test.ts"
Task: "Write the keyboard-and-focus test group (US2 slice of V-5) in relative-time-card.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (`relative-time-format.ts`) — blocks everything.
3. Complete Phase 3: User Story 1 — a working, correctly formatted, non-interactive trigger.
4. **STOP and VALIDATE**: run T005/T006 and confirm they pass in isolation.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. User Story 1 → validate → trigger renders correctly (MVP).
3. User Story 2 → validate → hover/focus card with live ticker.
4. User Story 3 → validate → variants/class/child.
5. User Story 4 → validate → positioning/controlled-open.
6. Demo route + registry polish.
7. Quality gates — always last, always green, never suppressed.

## Notes

- [P] tasks target different files or independent describe blocks — verify before running two
  agents on the same file concurrently.
- Tests MUST be written and confirmed failing before their corresponding implementation task.
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X).
- No `disabled`/`readOnly` guard-rail tasks are listed: upstream documents neither, and none is
  invented for this port (spec Assumptions, plan.md Principle III note).
- No "outside-provider throw" test is listed: this component has no context/provider (plan.md
  Principle III note) — N/A by design, not an omission.

---

## Phase 9: Convergence

**Purpose**: Close the gaps a post-implementation audit found between the built code and what
`spec.md`, `plan.md` and `contracts/public-api.md` call for. All five quality gates are green and
every FR has an implementation; every item below is a **test-coverage** gap against stated intent —
no application code is expected to change. Do not weaken or delete any existing assertion.

- [X] T026 Add a standalone `RelativeTimeCard.Timezone` describe group to
      `src/lib/components/ui/relative-time-card/relative-time-card.test.ts` per plan.md's
      Constitution Check, Principle III ("`disabled`/`readOnly` and the outside-provider throw are
      N/A … the tests assert instead that the timezone part renders standalone without throwing"),
      which no current test does: render `RelativeTimeCard.Timezone` directly (outside any
      `RelativeTimeCard.Root`) and assert it does not throw, carries
      `data-slot="relative-time-card-timezone"`, defaults to `role="region"` with its
      `aria-label`, exposes `data-local` only when `timezone` is omitted, lets a caller-supplied
      `role` supersede the default (the R-10 spread-ordering claim), and merges a caller `class`
      last through `cn()` — the documented divergence in `contracts/public-api.md` §10 row 8, which
      has no assertion today. (missing)
- [X] T027 [P] Assert what one timezone row actually renders, per FR-005 and the rendered tree in
      `contracts/public-api.md` §2, in
      `src/lib/components/ui/relative-time-card/relative-time-card.test.ts`: today the row tests only
      check `data-timezone`, `data-local` and the `aria-label` string — all produced by
      `formatTimeZoneLabel`/`formatTimeZoneAccessibleName` — so a regression in the row's markup
      would pass. With `defaultOpen` and `timezones={['UTC']}`, assert the row's label `<span>` reads
      the zone identifier, that the row contains exactly two `<time>` elements whose texts equal
      `formatZonedDate(date, locale, 'UTC')` and `formatZonedTime(date, locale, 'UTC')`, and that
      both carry `datetime` set to the date's ISO string. (partial)
- [X] T028 [P] Extend the teardown assertion in
      `src/lib/components/ui/relative-time-card/relative-time-card.test.ts` to the case the spec's
      Edge Cases actually name — "Component unmounted while the card is open: the update interval and
      any hover-open timers are cleared and no state updates occur after teardown" (FR-007, SC-003).
      The existing test unmounts a **closed** card. Add a case that opens the card (hover +
      `advance(DEFAULT_OPEN_DELAY)`, so the hover-open path's own timers exist too), then
      `unmount()`, then asserts `vi.getTimerCount() === 0` and that advancing the clock further
      produces no error and no further render. Keep the existing closed-card case. (partial)
- [X] T029 [P] Add the compound-minutes guard-path test that plan.md's Risks table commits to ("The
      `frame.includes(magnitude)` guard degrades to the single-unit string instead of producing
      garbage, and a test asserts the guard path with a locale whose frame differs (R-05)") and that
      `src/lib/components/ui/relative-time-format.ts:156` implements but no test reaches, in
      `src/lib/components/ui/relative-time-card/relative-time-card.test.ts`: find a locale in the
      runtime's ICU data whose `Intl.RelativeTimeFormat` minutes frame does not embed the
      `Intl.NumberFormat({style:'unit'})` magnitude and assert `formatRelativeTime` returns that
      untouched single-unit frame. If no such locale exists in the installed ICU build, assert the
      degradation contract instead across at least three non-English locales — the output is always
      either the compound splice or the untouched frame, never a string with a duplicated or orphaned
      magnitude — and state in a comment which of the two paths was exercised. Do not add a test
      helper that fakes `Intl`. (partial)
- [X] T030 [P] Assert the documented `timezones` default (FR-008, `DEFAULT_TIMEZONES = ['UTC']`) at
      component level in `src/lib/components/ui/relative-time-card/relative-time-card.test.ts`: no
      current test renders the root without a `timezones` prop, so the default is unverified. Render
      with `defaultOpen` and no `timezones`, and assert exactly two `listitem` rows — the first with
      `data-timezone="UTC"`, the second carrying `data-local=""`. (partial)
- [X] T031 [P] Add direct assertions for the reusable pure helpers in
      `src/lib/components/ui/relative-time-card/relative-time-card.test.ts`, since
      `relative-time-format.ts` is published as a reuse surface for later ports (plan.md § "Shared
      pure module", research R-16) and three of its documented behaviours are only covered
      indirectly: `toDate` returns a caller-owned `Date` **by identity** and parses strings and
      numbers to the same instant (data-model.md §3.1); `toIsoString` returns the ISO string for a
      valid date and `undefined` for an invalid one (R-07); `diffRelativeTime` returns the
      `isFuture`/`seconds`/`minutes`/`hours`/`days` breakdown of data-model.md §3.2 for one past and
      one future fixture. (partial)

**Checkpoint**: every requirement, plan decision and contract clause has a corresponding assertion;
re-run the Phase 8 gates (T025) after these land.
