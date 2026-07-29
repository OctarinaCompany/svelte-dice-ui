---
description: 'Task list for the Direction Provider port'
---

# Tasks: Direction Provider

**Input**: Design documents from `/specs/002-port-direction-provider/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/direction-provider-public-api.md, contracts/registry-item.json, quickstart.md

**Tests**: Tests are MANDATORY (Constitution Principle III / CLAUDE.md §7). Every behavioural area —
keyboard, accessibility roles and names, controlled vs. uncontrolled state, RTL, and edge cases — is
covered before implementation begins, driven through the `direction-provider.test.svelte` harness
(research Decision 10) because `useDirection()` may only be called during component initialisation.

**Organization**: This is a single-component, context-only utility (no visual subcomponents beyond the
one Root). Phases are organized by artifact type in build order — Setup → Tests → Core component files
→ Barrel and types → Demo route → Registry entry and docs polish → Verification — per the explicit
phase order requested for this port. `[US1]`/`[US2]`/`[US3]` labels map each test task to the spec.md
user story it primarily verifies; implementation tasks carry no story label because the same four
source files serve all three stories simultaneously (there is no per-story implementation split for a
single context primitive).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story a test task primarily verifies (US1, US2, US3) — omitted for
  Setup/Core/Barrel/Demo/Registry/Verification tasks, which are shared infrastructure
- Every task names an exact file path

## Path Conventions

- Component source: `src/lib/components/ui/direction-provider/`
- Colocated tests: `src/lib/components/ui/direction-provider/direction-provider.test.ts` (+ `.test.svelte` harness)
- Demo route: `src/routes/docs/components/direction-provider/`
- Registry: `registry.json` at the repository root

---

## Phase 1: Setup

**Purpose**: Confirm the dependency and registry preconditions the rest of the port relies on, before
any file is created.

- [X] T001 Confirm target paths are free: `src/lib/components/ui/direction-provider/` and
      `src/routes/docs/components/direction-provider/` do not yet exist under the repository root, and
      note the exact filenames this port will create there (per plan.md "Project Structure") so later
      tasks create — never accidentally overwrite — them.
- [X] T002 [P] Confirm no new npm dependency is required (research Decision 11): verify `package.json`
      needs no edit and that `registry.json`'s top-level `"items"` array does not yet contain an entry
      named `"direction-provider"`, so the stub in Phase 6 (T016) has a clean insertion point.

**Checkpoint**: Preconditions confirmed — no dependency changes needed, no naming collisions, safe to
start writing tests.

---

## Phase 2: Tests (write first — MANDATORY, Constitution Principle III)

**Purpose**: Encode every behavioural area from quickstart.md §3 and the contract's §6 assertion table
(C-01…C-20, plus the barrel import-style assertion C-21) before any implementation file exists, so all
of them fail for the right reason (missing module), not a typo.

- [X] T003 [P] Create the render harness `src/lib/components/ui/direction-provider/direction-provider.test.svelte`:
      a prop-driven component that accepts a `dir` for an outer/inner provider pair, an optional
      `useDirection` override getter and target `element`, an optional ancestor `dir` attribute applied
      to a wrapper element around a provider-less branch, and renders one or more consumers (each
      binding its own element and passing it as the reader's `element` getter) that call
      `useDirection()` and expose the resolved `current` value (e.g. as text content and a `data-current`
      attribute) so tests can assert on it and drive prop changes via re-render. Mirrors the Status
      port's test-harness pattern (research Decision 10).
- [X] T004 [US1] In `src/lib/components/ui/direction-provider/direction-provider.test.ts`, write the RTL /
      nested-provider tests: provider `dir="ltr"` ⇒ descendant reads `"ltr"` (C-01); provider `dir="rtl"`
      ⇒ descendant reads `"rtl"` (C-02); two nested providers with different `dir` ⇒ the inner
      descendant reads the inner value while an outer sibling still reads the outer value (C-04); and
      the rendered wrapper carries `data-slot="direction-provider"`, `data-dir`, `dir` and merges a
      caller `class` after `contents` (C-13). Import `DirectionProvider`/`useDirection` from
      `./index.js` and render through the T003 harness. Also assert the barrel's two import styles
      (C-21, FR-011): a namespace import exposes `Root`, `DirectionProvider` and `useDirection`, and a
      named import of `useDirection` alone renders a consumer with no provider present.
- [X] T005 [US2] In `src/lib/components/ui/direction-provider/direction-provider.test.ts`, write the
      accessibility roles-and-names tests: the rendered wrapper exposes no `role` and no accessible name
      and `children` render unchanged inside it (C-14); `getDirectionContext()` called from the init of a
      component that is rendered *without* any `<DirectionProvider>` above it (use the T003 harness — a
      bare module-level call would throw Svelte's `lifecycle_outside_component` instead) throws a message
      matching `/must be used within/`, while `hasDirectionContext()` returns `false` from that same
      component (C-15); calling `useDirection()` from a consumer with no provider anywhere in its
      ancestry and no ancestor `dir` attribute resolves to `"ltr"` without throwing (C-05); and the same
      provider-less consumer rendered inside an ancestor element carrying `dir="rtl"`, with the reader
      anchored on the consumer's own node via the harness's `element` getter, resolves to `"rtl"` (C-06,
      US2-2 — the DOM-attribute fallback of FR-006).
- [X] T006 [US1] In `src/lib/components/ui/direction-provider/direction-provider.test.ts`, write the
      default-vs-parent-owned `dir` tests (this component has no controlled/uncontrolled modes — `dir`
      is a plain, non-bindable prop; do not add `defaultDir`, `bind:dir` or `onDirChange`, per contract
      §2 "Not present"): a provider rendered with no `dir` prop falls back to `"ltr"` and both
      `data-dir`/`dir` reflect it (C-03, C-17); a parent that owns `dir` and flips it at runtime
      propagates the new value to every consumer while the component never changes it on its own (C-09,
      C-18); and the defaulted case is confirmed distinct from an explicit `dir="rtl"` pass-through.
- [X] T007 In `src/lib/components/ui/direction-provider/direction-provider.test.ts`, write the keyboard
      interaction test (C-20): drive `userEvent.keyboard` through the documented key set
      (`ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown`/`Home`/`End`/`Enter`/`Escape`/`Tab`) against the
      rendered provider and assert `data-dir`, the `dir` attribute, and every consumer's reported
      `current` value are all unchanged — proving the component registers no key handlers, per research
      Decision 6 / Constitution Principle III.
- [X] T008 In `src/lib/components/ui/direction-provider/direction-provider.test.ts`, write the remaining
      edge-case tests: an ancestor `dir="auto"` is treated as absent so the reader falls through to
      `"ltr"`, and `isDirection('auto') === false` (C-07); a reader given an explicit `dir` override
      getter wins over both a `dir="rtl"` provider and a conflicting DOM ancestor attribute (C-08); an
      ancestor's `dir` attribute mutated at runtime (via `element.setAttribute('dir', ...)`) updates a
      provider-less consumer without remount (C-10); changing the override getter's returned value at
      runtime updates the consumer (C-11); `id`, `aria-label` and an arbitrary `data-*` prop passed to
      the provider appear on the rendered wrapper (C-12); `ref` binds to the rendered `<div>` (C-16); and
      unmounting a component that called `useDirection()` disconnects its `MutationObserver` (spy on
      `MutationObserver.prototype.disconnect`) (C-19).

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/direction-provider/direction-provider.test.ts`
fails because `./index.js` does not exist yet — confirms the tests exercise the intended contract before
any implementation is written.

---

## Phase 3: Core component files

**Purpose**: Implement the runes module and the Root component in the dependency order plan.md
prescribes (types → context/state → reader → component), making the Phase 2 tests pass one layer at a
time.

- [X] T009 In `src/lib/components/ui/direction-provider/direction-provider.svelte.ts`, implement the
      `Direction` union and `DIRECTIONS` const (`data-model.md` Entity 1), the `isDirection` type guard,
      and `resolveDomDirection(anchor)` (`anchor.closest('[dir="ltr"], [dir="rtl"]')`, narrowed by
      `isDirection` — contract §5).
- [X] T010 In `src/lib/components/ui/direction-provider/direction-provider.svelte.ts`, add the module-private
      `Symbol('direction-provider')` context key, `setDirectionContext`/`hasDirectionContext`/
      `getDirectionContext` (the last throwing `` `<Part>` must be used within `<DirectionProvider>`. ``),
      and the `DirectionProviderState` class holding `readonly current: Direction = $derived(...)` over a
      `getDir: () => Direction` getter (`data-model.md` Entities 2–3). Depends on T009.
- [X] T011 In `src/lib/components/ui/direction-provider/direction-provider.svelte.ts`, add
      `UseDirectionOptions`, the `DirectionReader` class and the `useDirection(options?)` factory.
      `DirectionReader` holds `#domDir = $state<Direction | undefined>(undefined)`, written **only** by
      an `$effect` that (a) computes `this.#domDir = resolveDomDirection(options?.element?.() ??
      document.documentElement)` and (b) installs `new MutationObserver(...)` on
      `document.documentElement` with `{ attributes: true, attributeFilter: ['dir'], subtree: true }`
      re-running the same lookup, returning `() => observer.disconnect()` as teardown (`data-model.md`
      Entity 4, research Decision 3); and exposes `readonly current: Direction = $derived(options?.dir?.()
      ?? context?.current ?? this.#domDir ?? 'ltr')`. The effect returns early (installing no observer
      and leaving `#domDir` `undefined`) when `options?.dir?.()` returns a value or
      `hasDirectionContext()` was true at init, since the DOM branch is unreachable in those cases; it
      re-installs if the override getter later returns `undefined`. `useDirection(options?)` reads
      `hasDirectionContext()`/`getDirectionContext()` once at init and constructs a `DirectionReader`
      (`data-model.md` Entity 4, contract §3). Depends on T010.
- [X] T012 Create `src/lib/components/ui/direction-provider/direction-provider.svelte`: the module script
      exports `DirectionProviderProps` (`WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'dir'>,
      HTMLDivElement> & { dir?: Direction }`, JSDoc `@default "ltr"`); the instance script destructures
      `$props()` (`ref = $bindable(null)`, `dir = 'ltr'`, `class: className`, `children`, `...restProps`),
      constructs a `DirectionProviderState` from a `getDir: () => dir` getter, calls
      `setDirectionContext(...)`, and renders `<div bind:this={ref} data-slot="direction-provider"
      data-dir={dir} {dir} class={cn('contents', className)} {...restProps}>{@render
      children?.()}</div>` (contract §2, research Decisions 4–5, 9). Depends on T011.

**Checkpoint**: All Phase 2 tests except the barrel-import ones pass once `./index.js` re-exports these
symbols (Phase 4).

---

## Phase 4: Barrel and types

- [X] T013 Create `src/lib/components/ui/direction-provider/index.ts`: import `Root` from
      `./direction-provider.svelte`; re-export `type { DirectionProviderProps }` from that file; re-export
      `DIRECTIONS`, `DirectionProviderState`, `DirectionReader`, `getDirectionContext`,
      `hasDirectionContext`, `isDirection`, `resolveDomDirection`, `setDirectionContext`, `useDirection`,
      `type Direction`, `type UseDirectionOptions` from `./direction-provider.svelte.js`; and export
      `{ Root, Root as DirectionProvider }` (contract §1). Depends on T012.

**Checkpoint**: `pnpm run test:unit -- --run src/lib/components/ui/direction-provider/direction-provider.test.ts`
passes in full (C-01…C-20 and C-21 all green).

---

## Phase 5: Demo route

- [X] T014 [P] Create `src/routes/docs/components/direction-provider/direction-consumer.svelte`: a
      docs-only component that declares `let el = $state<HTMLElement | null>(null)` and `bind:this={el}`
      on its rendered element, calls `useDirection({ dir: () => dirOverride, element: () => el })` —
      passing `element` so the DOM fallback walks up from the consumer's own node and satisfies FR-006's
      "nearest ancestor element" branch, not just the document root — and renders the resolved `current`
      value visibly, for reuse across the three demo sections. Imports only from
      `$lib/components/ui/direction-provider/index.js`, never the other way around (Principle V).
      Depends on T013.
- [X] T015 Create `src/routes/docs/components/direction-provider/+page.svelte` with three
      `<ComponentPreview>` sections built on `$lib/components/docs/index.js` and the T014 consumer:
      **Provider** (a live `$state<Direction>` toggle driving `<DirectionProvider.Root {dir}>` with a
      nested provider example, mirroring the MDX Usage block and exercising SC-001/SC-003), **Reading the
      direction** (the MDX's `useDirection()` example against a `Button`), and **Ambient fallback** (the
      T014 consumer rendered inside a plain `<div dir="rtl">` with no provider anywhere above it; because
      the consumer passes `element: () => el`, the reader resolves `rtl` from that ancestor — satisfying
      SC-004), followed by props and data-attribute
      tables from contract §2 in the same `Table.Root` layout as
      `src/routes/docs/components/status/+page.svelte`. Depends on T013, T014.

**Checkpoint**: the demo route renders three working sections with no `+page.ts`.

---

## Phase 6: Registry entry and docs polish

- [X] T016 Append the contents of `contracts/registry-item.json` verbatim as the next element of the
      `"items"` array in `registry.json` at the repository root (the three shipped files only — no test
      files, per Principle V). Depends on T013.
- [X] T017 Run `pnpm run registry:build` and verify `static/r/direction-provider.json` is written with
      `$lib/...` imports rewritten to registry placeholders and neither test file present. Depends on T016.

**Checkpoint**: `/docs/components/direction-provider` is reachable from the docs sidebar via
`getComponentItems()` in `src/lib/registry.ts`.

---

## Phase 7: Verification

- [X] T018 Run `pnpm run format` (shadcn/generator-style output is not Prettier-formatted; run this
      before the other gates per CLAUDE.md §1) and commit no changes yet — just make the tree
      format-clean.
- [X] T019 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, and
      fix everything that fails. No suppressions of any kind (`@ts-ignore`, `@ts-expect-error`,
      `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, deleted assertions, loosened configs)
      — fix the root cause.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Tests (Phase 2)**: depends on Setup; T003 (harness) has no dependency on the other test tasks and
  can start immediately, but T004–T008 all edit the same `direction-provider.test.ts` file, so they run
  **sequentially** even though none of them depends on an implementation file existing yet.
- **Core component files (Phase 3)**: depends on Phase 2 existing (tests must be written, and expected
  to fail, first). T009 → T010 → T011 → T012 are strictly sequential — all four edit
  `direction-provider.svelte.ts` except T012, and each layer's class depends on the previous layer's
  exports.
- **Barrel and types (Phase 4)**: depends on T012.
- **Demo route (Phase 5)**: depends on T013. T014 and T015 touch different files, but T015 imports T014,
  so T014 must complete first despite both being demo-route work.
- **Registry entry and docs polish (Phase 6)**: depends on T013 (does not need the demo route). T017
  depends on T016.
- **Verification (Phase 7)**: depends on everything above. T018 before T019 (format before the other
  gates, per CLAUDE.md §1).

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel.
- T003 (test harness) can start in parallel with drafting T004–T008's assertions, though all writes to
  `direction-provider.test.ts` itself must land sequentially.
- T014 is the only `[P]` task in Phase 5 in the sense that it does not depend on T015; T015 still must
  wait for it.

---

## Parallel Example: Setup

```bash
# Launch both Setup checks together:
Task: "Confirm target paths are free for direction-provider component and docs route"
Task: "Confirm no new npm dependency is required; registry.json has no existing direction-provider entry"
```

---

## Implementation Strategy

### Build order (single-component feature, no MVP slicing)

Because this feature is one context primitive with three user stories describing different facets of
the same contract (declare a direction, read it safely without a provider, override it explicitly), the
three stories are delivered **together** rather than incrementally — there is no meaningful subset of
`direction-provider.svelte.ts` that implements only US1 without US2/US3's precedence chain. The build
order is:

1. Phase 1 (Setup) — confirm preconditions.
2. Phase 2 (Tests) — encode all of C-01…C-20 against the not-yet-existing module; confirm they fail.
3. Phase 3 (Core) — implement `direction-provider.svelte.ts` bottom-up, then `direction-provider.svelte`.
4. Phase 4 (Barrel) — wire the public API; the full test suite goes green.
5. Phase 5 (Demo) — make the behaviour visible without reading source (SC-004).
6. Phase 6 (Registry) — make the component installable (FR-012).
7. Phase 7 (Verification) — the four quality gates, green with no suppressions.

### Later ports depend on this feature

`direction-provider.svelte.ts` is the shared direction primitive later RTL-aware ports (select, menu,
slider, carousel, tags-input, …) will import (`useDirection`, `getDirectionContext`) instead of
re-deriving direction — keep its exported surface exactly as specified in contract §1, since widening it
later is a breaking change for those consumers.

---

## Notes

- `[P]` tasks touch different files and have no unmet dependency; tasks sharing
  `direction-provider.test.ts` or `direction-provider.svelte.ts` are deliberately left unmarked and
  ordered sequentially.
- `[Story]` labels appear only on Phase 2 test tasks; every other phase is shared infrastructure that
  serves all three user stories at once.
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X).
- Do NOT touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json` or `.port-logs/`.
