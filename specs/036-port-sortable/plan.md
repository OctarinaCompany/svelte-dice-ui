# Implementation Plan: Sortable

**Branch**: `036-port-sortable` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/036-port-sortable/spec.md`

## Summary

Port Dice UI's `sortable` (a 577-line React registry component built on `@dnd-kit`) to Svelte 5 as
`src/lib/components/ui/sortable/`: five composable parts (`Sortable`, `Content`, `Item`,
`ItemHandle`, `Overlay`) that reorder a consumer-owned array by pointer, touch or keyboard, in
vertical, horizontal or grid ("mixed") layouts, with screen-reader announcements at every step.

**Technical approach.** `@dnd-kit` is React-only and `bits-ui` ships no drag-and-drop primitive, so
the engine is written here, deliberately, in two files that `kanban` will import unchanged:
`sortable-geometry.ts` (pure, rune-free maths — collision detection, three sorting strategies, three
modifiers, `arrayMove`, the keyboard index resolver) and `sortable-dnd.svelte.ts` (`DndState` +
`DragSession` rune classes — the sensor pipeline and the droppable registry, with no knowledge of
`value`, orientation or announcements). On top of those, `sortable.svelte.ts` holds
`SortableRootState`/`SortableItemState` and four `Symbol`-keyed contexts with throwing getters.
Keyboard drags resolve to an **index** first and only fall back to geometry for `mixed` orientation,
which is what makes the entire keyboard contract assertable under jsdom's zero-rect layout. The
overlay portals through `bits-ui` `Portal`. Zero new npm dependencies.

Decision log in [research.md](./research.md) (25 decisions); state shape in
[data-model.md](./data-model.md); exact API, keyboard, announcement, `data-*`, registry and demo
contracts in [contracts/sortable-api.md](./contracts/sortable-api.md).

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`), Svelte 5.56 (runes forced on in
`vite.config.ts`), SvelteKit 2.63

**Primary Dependencies**: `bits-ui` ^2.18 (`Portal` — the only primitive this component composes),
`tailwind-variants` / `clsx` / `tailwind-merge` via `cn()`, `@lucide/svelte` ^1.27
(`GripVerticalIcon`, docs route only). Existing UI components reused: `direction-provider` (+
`button`, `table`, `card`, `select`, `switch` on the docs route only — the handle demo composes
`button` through the handle's `child` snippet, but the component itself does not import it). **No new
npm dependency** — `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`, `@dnd-kit/utilities`,
`radix-ui` and `react-dom` are all replaced (research R-01, R-09, R-25).

**Storage**: N/A

**Testing**: Vitest 4 (jsdom, `globals: false`, `expect.requireAssertions`) +
`@testing-library/svelte` + `@testing-library/user-event`; colocated at
`src/lib/components/ui/sortable/sortable.test.ts` with a `sortable.test.svelte` harness for
snippets, `{#each}`, bindings and provider-guard cases. jsdom performs no layout, so a test-only
`stubRects()` helper installs deterministic `getBoundingClientRect` values for the geometry-dependent
cases; the pure layer is unit-tested directly with hand-authored rects. `tests/setup.ts` is **not**
modified (research R-22).

**Target Platform**: Modern evergreen browsers (Pointer Events, `setPointerCapture`,
`getBoundingClientRect`), server-rendered by SvelteKit and hydrated — every DOM and listener touch
is inside `$effect` or an event handler, never at module scope.

**Performance Goals**: one state write per pointer frame (the sensor writes `delta` once per
`pointermove`, and collision detection runs against a rect snapshot rather than re-measuring the
DOM); the live region is written only when the announced text changes (research R-10); item
transforms are `$derived`, never mutated from an effect.

**Constraints**: no `any`, no suppression comments, semantic Tailwind tokens only, every part carries
`data-slot` and exposes its state as `data-*` written `cond ? '' : undefined`, `class` merged last,
every `$effect` returns a teardown for every listener/timer/capture it starts.

**Scale/Scope**: 5 `.svelte` parts + 1 state module + 1 engine module + 1 pure geometry module + 1
barrel = **9 registry files**; 2 test-only files; 1 docs route with 6 example sections + 5 props
tables; 1 `registry.json` entry.

## Constitution Check

_GATE: passed before Phase 0 research; re-checked after Phase 1 design (see the note below the table)._

| #    | Principle                           | Verdict | Evidence |
| ---- | ----------------------------------- | ------- | -------- |
| I    | Svelte 5 Runes Only                 | PASS    | `DndState`/`DragSession` in `sortable-dnd.svelte.ts` and `SortableRootState`/`SortableItemState` in `sortable.svelte.ts`, all `$state`/`$derived`/`$effect`; props via `$props()` with `generics="T"`; `value`/`ref` via `$bindable`; snippets only — no store, no `export let`, no `createEventDispatcher`, no `<slot>`. Reactive inputs enter the state classes as getter functions (data-model §3). |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | All 5 parts, every documented prop, default, callback, `data-*` row from the MDX `DataAttributesTable`, every MDX keyboard row, the two upstream throws and the announcement/instruction strings verbatim (contract §2–§10). The 13 divergences are recorded in spec §Assumptions, research R-18 and the register below. |
| III  | Accessibility Is a MUST             | PASS    | dnd-kit's full draggable ARIA set reproduced (`role="button"`, `tabindex`, `aria-roledescription="sortable"`, `aria-pressed`, `aria-disabled`, `aria-describedby`) plus `aria-controls` on the handle (research R-11); `role="status" aria-live="assertive"` live region + upfront instructions (R-10); the 10-row keyboard table each driven through `user-event`; RTL inversion, controlled, uncontrolled, `disabled` guard rails and all four out-of-provider throws asserted (test plan §D below). |
| IV   | Composition Over Reimplementation   | PASS    | `bits-ui` `Portal` composes the overlay's elevation; `button` and `direction-provider` reused as-is. The drag engine is bespoke — justified below with the specific primitive gap. |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file `sortable-<part>.svelte`, engine in `.svelte.ts`/`.ts` siblings (precedent: `masonry-positioner.ts`), `index.ts` barrel with short + prefixed names + types, `.js` import extensions, **one** `registry:ui` entry of 9 files, no import from `src/routes/**` or `$lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Prop types exported from `<script lang="ts" module>`, derived from `WithElementRef<HTMLAttributes<…>>`; the root is generic via `generics="T"` (precedent: `badge-overflow.svelte`); `UniqueIdentifier`/`ClientRect`/`Coordinates` are own types, `unknown` (never `any`) at the one erased boundary — the context value shared by a generic root (contract §2). No ignore comment, no config change. |
| VII  | Green Gate Before Commit            | PASS    | `format → check → lint → test:unit --run → build` scheduled as the final phase ([quickstart.md](./quickstart.md) §1). `stubRects()` is a layout fixture for an engine jsdom does not implement, not an assertion or config relaxation (research R-22). |
| VIII | Styling Discipline                  | PASS    | `cn()` everywhere, `class` merged last, upstream's item/handle class lists ported unchanged (all already semantic tokens), the demos' `bg-zinc-*`/`dark:` mapped to `bg-muted`/`border-border` (research R-17), no `space-*`, `size-*` where equal, no manual z-index — the overlay's elevation comes from the portal, not from a `z-` class. |
| IX   | Every Component Is Documented       | PASS    | `/docs/components/sortable` gets one `<ComponentPreview>` per upstream demo file (4) plus an Orientation and an RTL section proving SC-005/SC-006, and five props tables; demo state held in the page with runes, no `+page.ts` (contract §12). |
| X    | One Feature Directory Per Component | PASS    | All artefacts under `specs/036-port-sortable/`; the reusable engine ships inside the `sortable` folder and `kanban` will consume it via `registryDependencies` rather than this port minting a second registry item (research R-02); no git write command is run by any phase. |

**Post-design re-check**: the Phase 1 design introduced no new violation. Three design decisions were
re-examined against the principles and pass:

- **(IV)** splitting the engine out of the parts is what keeps the bespoke surface auditable and
  reusable; it does not add bespoke behaviour, it isolates it.
- **(III)** the index-first keyboard resolver (research R-04) is a *stronger* accessibility position
  than a coordinate-first port, because it makes the whole keyboard contract testable rather than
  untestable-and-assumed; the geometric path is retained where it changes behaviour (`mixed`).
- **(II)** the root renders no wrapper element, exactly as upstream's `DndContext` does not; the two
  `sr-only` nodes it does render are dnd-kit's own accessibility nodes, not a new element.

**Bespoke behaviour justification (Principle IV)**:

1. **The drag engine — sensors, droppable registry, collision detection, sorting strategies,
   modifiers** (`sortable-geometry.ts`, `sortable-dnd.svelte.ts`). Primitives evaluated:
   - `bits-ui` 2.18 — **has no drag-and-drop surface at all**: no draggable, no droppable, no
     sensor, no collision detection, no sortable context, no drag overlay. Its only relevant export
     is `Portal`, which *is* composed (research R-09).
   - `src/lib/components/ui/*` — nothing existing models a drag; `masonry` positions items but never
     moves them under a pointer, and `scroller`/`scroll-area` are scroll-only.
   - Third-party Svelte DnD libraries (`svelte-dnd-action`, `@dnd-kit-svelte` forks,
     `@atlaskit/pragmatic-drag-and-drop`) — each rejected on a specific, recorded ground in research
     R-01: array-ownership/CustomEvent API incompatible with a compound `value`-keyed API and with
     constitution I; unmaintained Svelte-5 support; or no sorting/collision/keyboard layer at all,
     leaving the same bespoke work on top of a dependency.

   Nothing else is hand-rolled: the portal is `bits-ui`'s, the handle renders a native
   `<button type="button">` with upstream's own class list (upstream sortable.tsx:491-512 does the
   same; the docs demo composes it onto `Button` through the `child` snippet), direction resolution
   composes `direction-provider`.

2. **`DocumentFragment` portal target** — `bits-ui`'s `PortalTarget` is `Element | string` while
   upstream's `container` is `Element | DocumentFragment | null`. The five-line `display: contents`
   host bridge is copied from the existing `action-bar-portal.svelte`, so `bits-ui` still performs
   the mount and keeps context propagation (research R-09).

**Divergence register** (all also in spec §Assumptions and research R-18): `sensors`, `measuring`,
`autoScroll`, `cancelDrop`, `dropAnimation`, `DragOverlay`'s dnd-kit-only props and
`accessibility.container` are not ported; `DragStartEvent`/`DragEndEvent` are narrowed to
`{ active, over }` — which also removes upstream's `activatorEvent.defaultPrevented` opt-out
(sortable.tsx:163/174/200); `onMove` is the supported interception point instead;
`strategy`/`modifiers`/`collisionDetection` keep their prop names with this port's own function
signatures; `asChild` becomes the `child` snippet; auto-scroll is out of scope; cross-`Content`
dragging is out of scope; the handle is a native `<button>`, not this project's `Button` component
(the MDX prose says otherwise, the source disagrees — spec §Assumptions). **Added** beyond upstream:
`defaultValue` (uncontrolled mode, FR-001), `dir` (RTL, FR-015), `data-flat-cursor` (FR-017 styleable
from outside).

## Project Structure

### Documentation (this feature)

```text
specs/036-port-sortable/
├── plan.md                        # This file
├── research.md                    # Phase 0 — 25 decisions, zero NEEDS CLARIFICATION remaining
├── data-model.md                  # Phase 1 — geometry types, DndState/DragSession, root/item state
├── quickstart.md                  # Phase 1 — how to run and verify
├── contracts/
│   └── sortable-api.md            # Phase 1 — exhaustive public API, keyboard, announcements, registry, demo
├── checklists/requirements.md     # from /speckit-specify
└── tasks.md                       # Phase 2 — created by /speckit-tasks, NOT by this command
```

### Source Code (repository root)

```text
src/lib/components/ui/sortable/
├── index.ts                       # barrel: 5 parts (short + prefixed) + prop types + state + engine + geometry
├── sortable-geometry.ts           # pure: rects, closestCenter/Corners, 3 strategies, 3 modifiers,
│                                  #   arrayMove, translate3d, resolveKeyboardIndex   ← kanban reuses
├── sortable-dnd.svelte.ts         # runes: DndState, DragSession, droppable registry, sensors
│                                  #   ← kanban reuses
├── sortable.svelte.ts             # runes: SortableRootState, SortableItemState, 4 Symbol contexts
├── sortable.svelte                # Root      ← sortable.tsx:111-306  (DndContext + provider)
├── sortable-content.svelte        # Content   ← sortable.tsx:317-351  (SortableContext)
├── sortable-item.svelte           # Item      ← sortable.tsx:380-472  (useSortable)
├── sortable-item-handle.svelte    # ItemHandle← sortable.tsx:478-514
├── sortable-overlay.svelte        # Overlay   ← sortable.tsx:536-567  (DragOverlay + portal)
├── sortable.test.svelte           # test-only harness (snippets, {#each}, bindings, bare parts, RTL)
└── sortable.test.ts               # colocated tests (NOT listed in registry.json)

src/routes/docs/components/sortable/
└── +page.svelte                   # 6 <ComponentPreview> sections + 5 props tables

registry.json                      # append exactly one registry:ui entry (contract §11)
```

**Structure Decision**: five parts, one file each, named `sortable-<part>.svelte` with the root at
`sortable.svelte`, mapping 1:1 onto the upstream functions listed above. Reactive logic is split
three ways so the reusable core is separable by inspection: pure maths with no runes
(`sortable-geometry.ts`, precedent `masonry-positioner.ts`), the framework-agnostic drag engine
(`sortable-dnd.svelte.ts`), and the component's own semantics (`sortable.svelte.ts`). The demo route
segment (`sortable`), the folder slug (`sortable`) and the registry item name (`sortable`) are
identical, so the docs sidebar links resolve by construction.

## Public API

Full detail, including every default and every attribute, is in
[contracts/sortable-api.md](./contracts/sortable-api.md). Summary, derived from
`sortable.tsx`:

### `Sortable` (Root) — renders no element; `<script lang="ts" generics="T">`

| Prop | Type | Default | Bindable |
| ---- | ---- | ------- | -------- |
| `value` | `T[]` | `undefined` | **yes** |
| `defaultValue` | `T[]` | `[]` | no |
| `onValueChange` | `(items: T[]) => void` | — | no |
| `getItemValue` | `(item: T) => UniqueIdentifier` | — | no |
| `onMove` | `(event: SortableMoveEvent) => void` | — | no |
| `orientation` | `'vertical' \| 'horizontal' \| 'mixed'` | `'vertical'` | no |
| `strategy` | `SortableStrategy` | per orientation | no |
| `collisionDetection` | `SortableCollisionDetection` | per orientation | no |
| `modifiers` | `SortableModifier[]` | per orientation | no |
| `flatCursor` | `boolean` | `false` | no |
| `dir` | `'ltr' \| 'rtl'` | inherited | no |
| `id` | `string` | `$props.id()` | no |
| `accessibility` | `SortableAccessibility` | — | no |
| `onDragStart` / `onDragMove` / `onDragOver` / `onDragEnd` / `onDragCancel` | `(event: SortableDragEvent) => void` | — | no |

Snippets: `children`. Callbacks: the five lifecycle handlers above plus `onValueChange` / `onMove`.
Throws `` `getItemValue` is required when using array of objects ``.

### `Sortable.Content`

`strategy?: SortableStrategy`, `withoutSlot?: boolean` (`false`), `ref` (**bindable**), `class`,
`...restProps`. Snippets: `children`, `child({ props })`. No callbacks. Element:
`<div data-slot="sortable-content" data-orientation>`.

### `Sortable.Item`

`value: UniqueIdentifier` (required), `asHandle?: boolean` (`false`), `disabled?: boolean` (`false`),
`ref` (**bindable**), `class`, `style`, `...restProps`. Snippets: `children`, `child({ props })`. No
callbacks. Data: `data-slot`, `data-dragging`, `data-disabled`, `data-flat-cursor`. Throws on an
empty-string `value` and outside `Content`/`Overlay`.

### `Sortable.ItemHandle`

`disabled?: boolean` (defaults to the item's), `ref` (**bindable**), `class`, `...restProps`.
Snippets: `children`, `child({ props })`. Renders `<button type="button" aria-controls={item.id}>`.
Data: `data-slot`, `data-dragging`, `data-disabled`, `data-flat-cursor`. Throws outside `Item`.

### `Sortable.Overlay`

`container?: Element | DocumentFragment | string | null` (`document.body`), `class`, `...restProps`.
Snippet: `children({ value })` — one snippet covering both upstream forms (fixed content, or
per-item content driven by the active identifier). No callbacks. Throws outside `Sortable`.

### Reusable exports (what `kanban` will import)

From `sortable-geometry.ts`: `arrayMove`, `closestCenter`, `closestCorners`,
`verticalListSortingStrategy`, `horizontalListSortingStrategy`, `rectSortingStrategy`,
`restrictToVerticalAxis`, `restrictToHorizontalAxis`, `restrictToParentElement`,
`resolveKeyboardIndex`, `toClientRect`, `translate3d`, plus the `UniqueIdentifier`, `ClientRect`,
`Coordinates`, `SortableCollision(-Detection)`, `SortableModifier`, `SortableStrategy` types.
From `sortable-dnd.svelte.ts`: `DndState`, `DragSession`, `DndNodeEntry`. The registry records this
as a dependency edge: `kanban` will declare `"registryDependencies": ["sortable"]` (research R-02).

## Implementation phases

Ordering is dependency-driven; `/speckit-tasks` expanded this into `tasks.md`'s seven phases — the
table below matches that expansion exactly (tasks.md is the authoritative ordering; this table is a
summary of it).

| # | Phase | Deliverable | Depends on |
| - | ----- | ----------- | ---------- |
| 1 | Setup | Confirm the dependency surface, stand up the empty component + docs folders and a `registry.json` stub | — |
| 2 | Tests | `sortable.test.svelte` harness + `sortable.test.ts` (groups A–F below), written and failing before any implementation module exists | 1 |
| 3 | Core component files | `sortable-geometry.ts` (pure geometry) → `sortable-dnd.svelte.ts` (engine) → `sortable.svelte.ts` (component state, four `Symbol` contexts, announcement builders) → the five `.svelte` parts, in that dependency order | 2 |
| 4 | Barrel and types | `index.ts` barrel exporting both usage styles | 3 |
| 5 | Demo route | `src/routes/docs/components/sortable/+page.svelte`, 6 sections + 5 props tables | 4 |
| 6 | Registry entry and docs polish | append the `registry.json` entry, run `pnpm run registry:build` | 4,5 |
| 7 | Verification | `format → check → lint → test:unit --run → build`, green with no suppression | 2,3,4,5,6 |

## Test plan

Colocated at `src/lib/components/ui/sortable/sortable.test.ts`, grouped to cover every area
constitution III makes mandatory. Every `it` asserts (`expect.requireAssertions`).

- **A. Geometry (pure)** — `closestCenter`/`closestCorners` ranking on hand-authored rects; each
  strategy's transform for an item before, at and after the active index; each modifier's clamp;
  `arrayMove` including no-op and out-of-range; `resolveKeyboardIndex` across all four keys × three
  orientations × both directions, plus the disabled-skip and the degenerate-rect fallback.
- **B. Rendering, roles and ARIA** — `data-slot` on all five parts; the R-11 activator attribute set
  on the item when `asHandle` and on the handle otherwise; `aria-controls` → item id;
  `aria-describedby` → the instructions element, which exists and carries the orientation-branched
  text; the live region's `role`/`aria-live`/`aria-atomic`.
- **C. Props** — every prop in contract §3–§7: `orientation` (defaults per orientation observable
  through behaviour), `strategy`/`collisionDetection`/`modifiers` overrides are invoked,
  `flatCursor` → `data-flat-cursor` + cursor classes, `withoutSlot` renders no element, `asHandle`,
  `disabled` on item and handle, `container` on the overlay, `class` merged last, `...restProps`
  spread, `ref` bound, `child` snippet receives the merged props.
- **D. Guard rails and throws** — all four out-of-provider throws (`expect(() => render(...)).toThrow(/within/)`);
  the empty-string item value throw; the object-array-without-`getItemValue` throw; a disabled item
  cannot be picked up by pointer or keyboard and is never a drop target.
- **E. Keyboard (US2, FR-007, SC-002)** — one test per row of contract §8: `Space` and `Enter`
  pick-up, arrow movement per orientation, ignored axis keys, `Space`/`Enter` drop committing the
  reorder, `Escape` cancelling with no commit, `Tab` swallowed mid-drag, focus retained across the
  reorder. Each asserts the resulting order **and** the live-region text (contract §9), which is how
  SC-003 is verified.
- **F. Pointer, controlled/uncontrolled, RTL** — a `user-event` pointer drag past a neighbour with
  `stubRects()` committing the reorder; a drop outside any droppable committing nothing and
  announcing "No changes were made."; `defaultValue` seeding and updating itself; `value` +
  `onValueChange` leaving the parent authoritative (a declining setter leaves the order unchanged);
  `onMove` suppressing the default splice; mid-drag removal of the active item cancelling the
  session; `dir="rtl"` (prop **and** `DirectionProvider`) inverting `ArrowLeft`/`ArrowRight` for
  `horizontal` and `mixed` while leaving `vertical` untouched.

## Complexity Tracking

> No constitution violation is carried forward. The one principle with a genuine tension —
> IV, Composition Over Reimplementation — is satisfied through its written-justification clause
> above (the primitives were evaluated and named; `bits-ui` has no drag-and-drop surface), so it is
> a PASS with justification, not a violation. Principles II, VI and VII are unaffected.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | none      | —          | —                                      |
