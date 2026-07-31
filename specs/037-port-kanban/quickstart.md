# Quickstart: validating the Kanban port

**Feature**: `specs/037-port-kanban` | **Date**: 2026-07-31

How to run and verify the port. Implementation detail belongs in `tasks.md`; the API is in
[contracts/kanban-api.md](./contracts/kanban-api.md).

## Prerequisites

- Node 22+, `pnpm` (the repo's package manager), dependencies already installed (`pnpm install`).
- **No new npm dependency is introduced by this feature** (research R-16). If `pnpm install` would
  add one, the port has gone wrong.
- `src/lib/components/ui/sortable/` present and green — `kanban` imports its drag engine and geometry
  and must not modify any file in it.

## 1. Quality gates — the definition of done

Run in this order, from the repository root, all non-interactive:

```bash
pnpm run format            # first: generated/edited output is not Prettier-formatted
pnpm run check             # svelte-kit sync && svelte-check — zero errors, zero warnings
pnpm run lint              # prettier --check . && eslint .
pnpm run test:unit -- --run
pnpm run build
```

A gate made green by `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`,
`.skip`/`.todo`/`.only`, a deleted assertion or a loosened config is an invalid result
(constitution VI/VII).

Targeted runs while iterating:

```bash
pnpm run test:unit -- --run src/lib/components/ui/kanban/kanban.test.ts
pnpm run test:unit -- --run src/lib/components/ui/sortable/sortable.test.ts   # must stay green
```

The second command is the regression guard for research R-02: `kanban` subclasses `DndState` instead
of editing it, so `sortable`'s suite must pass untouched.

## 2. Registry

```bash
pnpm run registry:build    # inlines file contents into static/r/
```

Then confirm:

- `registry.json` gained **exactly one** `registry:ui` item named `kanban`, listing all eleven
  component files and neither test file.
- `static/r/kanban.json` exists and its `registryDependencies` are `["sortable", "direction-provider"]`.
- `/docs/components` lists the Kanban card and the sidebar links to `/docs/components/kanban`
  (both are driven by the registry entry through `src/lib/registry.ts`).

## 3. Manual verification scenarios

The demo route is the acceptance evidence. Build and preview (both terminate; never `pnpm dev`):

```bash
pnpm run build && pnpm run preview
```

Open `/docs/components/kanban` and walk the spec's success criteria:

| # | Scenario | Expected |
| - | -------- | -------- |
| SC-001 | Drag a card above another card in the same column, release | The column's order updates on release |
| SC-002 | Drag a card into another column, release | The card is gone from the source column and present in the destination only |
| SC-003 | Drag a column by its grip handle onto another column | Column order changes; no card leaves its column |
| SC-004 | `Tab` to a card, `Space`, `ArrowRight`, `Space` | The card moves to the column on the right; the live region announced pick-up, the move (naming the destination column) and the drop |
| — | `Escape` mid-drag | Everything returns to its pre-drag state |
| — | Release over empty space outside every column | Nothing changes |
| SC-005 | Repeat SC-004 inside the RTL example | `ArrowRight` now moves toward the visually right-hand (earlier) column |
| SC-007 | Both sections render and drag | Default board and dynamic-overlay board both work; the overlay shows a card for an item drag and a whole column preview for a column drag |

To watch announcements without a screen reader, inspect
`[data-slot="kanban-live-region"]` in devtools while dragging.

## 4. Automated coverage map

`src/lib/components/ui/kanban/kanban.test.ts` (with the `kanban.test.svelte` harness) must cover, at
minimum:

| Group | Covers |
| ----- | ------ |
| A. Collision & keyboard geometry (pure) | `pointerWithin`, `rectIntersection`, `getFirstCollision`, `closestCenterAmong`, `filterByDirection` for all four keys, `resolveKanbanArrowTarget` including empty-column targeting, disabled skipping and RTL inversion |
| B. Roles, ARIA, `data-*` | contract §7 and §11 on every part; `aria-controls` → column/item id; `aria-describedby` → instructions; live-region `role`/`aria-live`/`aria-atomic` |
| C. Props | every row of contract §2-§8, including `class` merged last, `...restProps` spread, `ref` bound, `child` receiving the merged props, `flatCursor`, `orientation`, `container` |
| D. Guard rails | all seven throws of R-13; a disabled column/item cannot be picked up by pointer or keyboard and is never a drop target |
| E. Keyboard | contract §9 row by row through `user-event`, each asserting **both** the resulting `value` and the live-region text; the cross-column move of US4 explicitly |
| F. Pointer, controlled/uncontrolled, RTL | within-column reorder, cross-column move, drop into an empty column, drop outside every target committing nothing, `defaultValue` seeding, `value` + `onValueChange` with the parent authoritative, `onMove` intercepting, `dir="rtl"` via prop and via `DirectionProvider` |

jsdom performs no layout, so geometry-dependent cases install deterministic rects through a local
`stubRects()` helper (research R-15). `tests/setup.ts` is not modified.

## 5. Definition of done

- [ ] Eleven component files under `src/lib/components/ui/kanban/`, one part per `.svelte` file.
- [ ] `kanban.test.svelte` + `kanban.test.ts` green, covering groups A-F, nothing skipped.
- [ ] `src/routes/docs/components/kanban/+page.svelte` with both upstream examples and the API tables.
- [ ] One `registry.json` entry; `static/r/kanban.json` regenerated.
- [ ] No file under `src/lib/components/ui/sortable/` or `.reference/` modified.
- [ ] All five commands in §1 green with no suppression.
