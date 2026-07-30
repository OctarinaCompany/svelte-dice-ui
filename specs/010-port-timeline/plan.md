# Implementation Plan: Timeline

**Branch**: `010-port-timeline` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-port-timeline/spec.md`

## Summary

Port Dice UI's `Timeline` (radix base) to Svelte 5 as a nine-part compound component under
`src/lib/components/ui/timeline/`. The root owns `orientation`, `variant`, `dir` and `activeIndex`
and publishes them on context; each item registers its DOM node with a `TimelineState` collection so
its **live DOM-order index** — and therefore its `completed | active | pending` status and its
connector's completed flag — is derived, never prop-drilled. Upstream's
`useSyncExternalStore` + `Map<string, RefObject>` store collapses into one runes state class; Radix's
`Direction.useDirection` maps onto this repo's already-shipped `direction-provider` reader; every
`asChild` becomes a `child` snippet; every `cva` block becomes a `tv()` block exported from its
part's module script.

Two deliberate improvements over upstream, both no-ops under LTR: the root/item render as real
`<ol>`/`<li>` (native list semantics, so position and count are announced without relying on
`role="list"` alone), and the alternate variant's physical `left`/`right`/`ml-auto`/`pr-6`/`pl-6`/
`text-right` classes become logical `start`/`end`/`ms-auto`/`pe-6`/`ps-6`/`text-end`, so the
alternate layout mirrors under `dir="rtl"` instead of staying pinned to the physical left.

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`) + Svelte 5.56 (runes forced on
repo-wide via `vite.config.ts`)

**Primary Dependencies**: `tailwind-variants` (`tv()`), `clsx`/`tailwind-merge` (via `cn()`),
`$lib/components/ui/direction-provider` (`useDirection`). **Zero new npm dependencies** — upstream's
`radix-ui` (`Direction`, `Slot`), `class-variance-authority`, `@/lib/compose-refs`,
`use-isomorphic-layout-effect` and `use-lazy-ref` all have in-repo or language-level equivalents
(see [research.md](./research.md)).

**Storage**: N/A

**Testing**: Vitest 4 (jsdom, `globals: false`, `expect.requireAssertions`) +
`@testing-library/svelte` 5 + `@testing-library/user-event` 14, colocated at
`src/lib/components/ui/timeline/timeline.test.ts` with a `timeline.test.svelte` harness for
context/snippet/`bind:ref` cases.

**Target Platform**: SvelteKit 2 docs site (SSR + client) and, as the shipped artifact, any consumer
project that installs `timeline` from this shadcn-svelte registry.

**Project Type**: Component library distributed as source (shadcn-svelte registry) + SvelteKit docs
app.

**Performance Goals**: No layout thrash. One `$effect` per item performing exactly one
register/unregister; the DOM-order sort is a single `$derived.by` over the registered items, shared
by every item and connector, recomputed only when the item set changes. No `ResizeObserver`, no
polling, no per-frame work — the component is static markup plus derived attributes.

**Constraints**: No `any`; no `@ts-ignore` / `eslint-disable` / `svelte-ignore`; no Svelte 4 idioms
(stores, `export let`, `createEventDispatcher`, `<slot>`); semantic Tailwind tokens only;
`--timeline-dot-size` (`0.875rem`) and `--timeline-connector-thickness` (`0.125rem`) must stay the
single override point for dot size and line thickness; SSR-safe (no DOM access at module scope or
during init).

**Scale/Scope**: 9 exported components + 1 runes state module + 1 barrel + 1 test harness + 1 test
file + 1 demo route with 6 previews and 9 props tables + 1 `registry.json` entry. No keyboard
interaction model (the widget is non-interactive by design, upstream included).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                                                            |
| ---- | ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$props`/`$state`/`$derived`/`$derived.by`/`$effect`/`$bindable` + snippets only; the store lands in `timeline.svelte.ts` as `TimelineState`/`TimelineItemState` whose reactive inputs arrive as getter functions. No stores, no `export let`, no `createEventDispatcher`, no `<slot>`. |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | `docs/registry/bases/radix/ui/timeline.tsx`, `docs/content/docs/components/radix/timeline.mdx` and all six `radix/examples/timeline-*-demo.tsx` read at the pinned commit `d9763d8`. All 9 parts, all props, all `data-*`, both CSS vars, `forceMount`, and every class string reproduced. Divergences (`asChild`→`child`, `<div role="list">`→`<ol>`, physical→logical insets, `dateTime`+`datetime`) recorded in spec Assumptions. |
| III  | Accessibility Is a MUST             | PASS    | `<ol role="list">` / `<li role="listitem">` / `aria-current="step"` on the active item / `aria-hidden="true"` on connectors / semantic `<time datetime>`. `aria-orientation` is intentionally **not** emitted — ARIA does not support it on `role="list"` and Svelte's compiler flags it (`a11y_role_supports_aria_props`) in every spelling, which the Quality Gates and Principle VI forbid suppressing; `data-orientation` carries the same information. No APG keyboard model applies (non-interactive linear sequence); the test file still asserts key-press inertness, plus roles, names, RTL, uncontrolled/controlled `activeIndex`, guard rails and every provider error. |
| IV   | Composition Over Reimplementation   | PASS    | Direction resolution composes `useDirection()` from `$lib/components/ui/direction-provider` (Principle IV step 1). Everything else is markup + derived attributes; justification for the one bespoke piece (the DOM-order collection) is below.                                        |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file, `timeline.svelte.ts` for logic, `index.ts` barrel with short names + `Timeline*` aliases + prop types, `.js` extensions on every intra-repo import, one `registry:ui` entry listing all 11 shipped files (tests excluded), no import from `src/routes/**` or `$lib/components/docs/**`. |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Props typed from `WithElementRef<HTMLOlAttributes>` / `HTMLLiAttributes` / `HTMLTimeAttributes` / `HTMLAttributes<HTMLDivElement>`; `Status`/`Orientation`/`TimelineVariant` are string-literal unions; the `child` payloads are explicit object types. No `any`, no suppression, no config edit. |
| VII  | Green Gate Before Commit            | PASS    | `pnpm run format` → `check` → `lint` → `test:unit -- --run` → `build`, all non-interactive, planned as the final task. No `.skip`/`.todo`; every `it` asserts.                                                                                                                        |
| VIII | Styling Discipline                  | PASS    | Five exported `tv()` blocks (root, item, content, dot, connector) in their parts' module scripts; caller `class` destructured as `class: className` and merged **last** via `cn()`; tokens only (`bg-background`, `border-primary`, `border-border`, `bg-primary`, `bg-border`, `text-muted-foreground`); `data-slot` on all 9 parts; `data-alternate-right` / `data-completed` written `cond ? '' : undefined`. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/timeline/+page.svelte` with one `<ComponentPreview>` per upstream demo: Default, Horizontal, RTL, Alternate, Horizontal Alternate, Custom Dot — plus an API section with one props table per part, mirroring the gauge page.                               |
| X    | One Feature Directory Per Component | PASS    | All planning artifacts confined to `specs/010-port-timeline/`; no git write commands; `.port-state.json`, `scripts/**`, `.reference/**` untouched.                                                                                                                                    |

**Bespoke behaviour justification (Principle IV)**: one item — the **DOM-order item collection**
(`TimelineState.register` / `unregister` / `orderedIds`).

- `bits-ui` evaluated: it has no exported collection/registration primitive. Its internal
  `useRovingFocus`/collection helpers are not part of its public API, and every candidate public
  primitive (`Accordion`, `Tabs`, `RadioGroup`, `NavigationMenu`) couples ordering to focus
  management, `value` selection and keyboard navigation — none of which the timeline has. It also
  never exposes a raw "index of this descendant among its siblings in DOM order" read, which is the
  only capability needed here.
- `$lib/components/ui/*` evaluated: `direction-provider` is composed (for `dir`). No shipped
  component exposes a reusable descendant collection; `badge-overflow`'s measurement state is
  width-based, not order-based.
- Capability actually missing: a reactive, DOM-order-sorted registry of sibling elements keyed by id.
  Implemented in ~40 lines in `timeline.svelte.ts`, using `compareDocumentPosition` (a DOM API, kept
  verbatim from upstream) — and **exported** so later ports (`sortable`, `stepper`, `kanban`) reuse
  it instead of re-deriving it (deliverable 5).

Everything else — variants, statuses, data attributes, `forceMount`, `child` snippets — is markup and
`$derived`, not behaviour.

## Public API

Shared types, exported from `timeline.svelte.ts` and re-exported by the barrel:

```ts
type TimelineOrientation = 'vertical' | 'horizontal'; // TIMELINE_ORIENTATIONS
type TimelineVariant = 'default' | 'alternate'; // TIMELINE_VARIANTS
type TimelineStatus = 'completed' | 'active' | 'pending'; // TIMELINE_STATUSES
// `Direction` (`'ltr' | 'rtl'`) is re-used from `$lib/components/ui/direction-provider`.
```

Every part additionally accepts all standard attributes of its element (spread through
`...restProps`), `class` (merged last), `ref` (bindable), `children`, and a `child` snippet. `dir` on
the root is typed as `Direction`, so `HTMLAttributes`' loose `dir?: string` is `Omit`ted first.

### `Timeline` / `Timeline.Root` — `timeline.svelte` → `<ol>`

| Prop          | Type                                             | Default      | Bindable | Notes                                                                                                                     |
| ------------- | ------------------------------------------------ | ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `ref`         | `HTMLOListElement \| null`                       | `null`       | ✅       | `bind:this` on the `<ol>`; stays `null` in `child` mode.                                                                   |
| `dir`         | `Direction`                                      | _resolved_   | ❌       | When omitted, `useDirection()` resolves nearest `<DirectionProvider>` → ancestor `[dir]` → `'ltr'`. Upstream: `useDirection(dirProp)`. |
| `orientation` | `TimelineOrientation`                            | `'vertical'` | ❌       | Drives layout and `data-orientation` (no `aria-orientation`: unsupported on `role="list"`).                               |
| `variant`     | `TimelineVariant`                                | `'default'`  | ❌       | `'alternate'` enables the zig-zag layout.                                                                                  |
| `activeIndex` | `number \| undefined`                            | `undefined`  | ❌       | Zero-based. `undefined` ⇒ every item `pending`.                                                                            |
| `class`       | `string \| undefined`                            | —            | ❌       | Merged after `timelineVariants(...)`; the documented place to override `[--timeline-dot-size:2rem]`.                        |
| `children`    | `Snippet \| undefined`                           | —            | ❌       | The `TimelineItem` list.                                                                                                   |
| `child`       | `Snippet<[{ props: TimelineChildProps }]>`       | —            | ❌       | Replaces `asChild`. Receives the merged attribute payload; `children` is not rendered in this mode.                        |

Callbacks/events: **none** (upstream ships none; the component is presentational).
Rendered attributes: `role="list"`, `data-slot="timeline"`,
`data-orientation`, `data-variant`, `dir`. `aria-orientation` is **not** emitted — ARIA does not
support it on `role="list"` and Svelte's compiler flags it in every spelling; `data-orientation` is the
documented consumer hook instead.
CSS variables set on the root: `--timeline-dot-size: 0.875rem`,
`--timeline-connector-thickness: 0.125rem`.

### `TimelineItem` / `Timeline.Item` — `timeline-item.svelte` → `<li>`

| Prop       | Type                                          | Default        | Bindable | Notes                                                                                                          |
| ---------- | --------------------------------------------- | -------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `ref`      | `HTMLLIElement \| null`                       | `null`         | ✅       | Also the node registered with `TimelineState`: the registration `$effect` reads this same bound node.    |
| `id`       | `string \| undefined`                         | `$props.id()`  | ❌       | Consumer-supplied `id` wins and doubles as the collection key (upstream `id ?? React.useId()`).                 |
| `class`    | `string \| undefined`                         | —              | ❌       |                                                                                                                |
| `children` | `Snippet \| undefined`                        | —              | ❌       | Dot, connector, content.                                                                                        |
| `child`    | `Snippet<[{ props: TimelineItemChildProps }]>` | —              | ❌       | Replaces `asChild`.                                                                                             |

Rendered attributes: `role="listitem"`, `aria-current={status === 'active' ? 'step' : undefined}`,
`data-slot="timeline-item"`, `data-status`, `data-orientation`,
`data-alternate-right={isAlternateRight ? '' : undefined}`, `id`, `dir` (from context, overridable
through `restProps`, exactly like upstream's attribute order).

### `TimelineDot` / `Timeline.Dot` — `timeline-dot.svelte` → `<div>`

| Prop       | Type                                         | Default | Bindable | Notes                                                        |
| ---------- | -------------------------------------------- | ------- | -------- | ------------------------------------------------------------ |
| `ref`      | `HTMLDivElement \| null`                     | `null`  | ✅       |                                                              |
| `class`    | `string \| undefined`                        | —       | ❌       |                                                              |
| `children` | `Snippet \| undefined`                       | —       | ❌       | Custom dot content (an icon); status border colour is kept.  |
| `child`    | `Snippet<[{ props: TimelineDotChildProps }]>` | —       | ❌       | Replaces `asChild`.                                          |

Rendered attributes: `data-slot="timeline-dot"`, `data-status`, `data-orientation`.
Sized by `--timeline-dot-size`.

### `TimelineConnector` / `Timeline.Connector` — `timeline-connector.svelte` → `<div>`

| Prop         | Type                                                | Default | Bindable | Notes                                                                                        |
| ------------ | --------------------------------------------------- | ------- | -------- | -------------------------------------------------------------------------------------------- |
| `ref`        | `HTMLDivElement \| null`                            | `null`  | ✅       |                                                                                              |
| `forceMount` | `boolean \| undefined`                              | `false` | ❌       | Keeps the connector rendered after the last item (upstream `forceMount`).                     |
| `class`      | `string \| undefined`                               | —       | ❌       |                                                                                              |
| `children`   | `Snippet \| undefined`                              | —       | ❌       |                                                                                              |
| `child`      | `Snippet<[{ props: TimelineConnectorChildProps }]>` | —       | ❌       | Replaces `asChild`.                                                                          |

Renders **nothing** when the owning item is last and `forceMount` is falsy.
Rendered attributes: `aria-hidden="true"`, `data-slot="timeline-connector"`,
`data-completed={nextStatus === 'completed' || nextStatus === 'active' ? '' : undefined}`,
`data-status` (the **owning** item's status, upstream verbatim), `data-orientation`.
Thickness from `--timeline-connector-thickness`.

### `TimelineContent` / `Timeline.Content` — `timeline-content.svelte` → `<div>`

`ref` (bindable), `class`, `children`, `child: Snippet<[{ props: TimelineContentChildProps }]>`.
Rendered attributes: `data-slot="timeline-content"`, `data-status`.

### `TimelineHeader` / `TimelineTitle` / `TimelineDescription` — `<div>` each

`ref` (bindable), `class`, `children`, `child` (`TimelineHeaderChildProps` /
`TimelineTitleChildProps` / `TimelineDescriptionChildProps`). No context read, so these three work
anywhere — upstream requires no provider for them either (FR-017's throw applies to the four parts
that do read context: Item, Dot, Connector and Content).
Rendered attributes: `data-slot="timeline-header" | "timeline-title" | "timeline-description"`.

### `TimelineTime` / `Timeline.Time` — `timeline-time.svelte` → `<time>`

| Prop       | Type                                          | Default | Bindable | Notes                                                                                                     |
| ---------- | --------------------------------------------- | ------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `ref`      | `HTMLTimeElement \| null`                     | `null`  | ✅       |                                                                                                           |
| `dateTime` | `string \| undefined`                         | —       | ❌       | Upstream-parity alias; emitted as the native `datetime` attribute. Native `datetime` in `restProps` wins.  |
| `class`    | `string \| undefined`                         | —       | ❌       |                                                                                                           |
| `children` | `Snippet \| undefined`                        | —       | ❌       | The human-readable date, distinct from `dateTime`.                                                         |
| `child`    | `Snippet<[{ props: TimelineTimeChildProps }]>` | —       | ❌       | Replaces `asChild`.                                                                                        |

Rendered attributes: `data-slot="timeline-time"`, `datetime`.

### Non-component exports (deliverable 5 — reusable by later ports)

`TimelineState`, `TimelineItemState`, `setTimelineContext`/`getTimelineContext`,
`setTimelineItemContext`/`getTimelineItemContext`, `getTimelineItemStatus(index, activeIndex)`,
`sortByDocumentPosition(entries)`, `TIMELINE_ORIENTATIONS`, `TIMELINE_VARIANTS`,
`TIMELINE_STATUSES`, and the five `tv()` objects (`timelineVariants`, `timelineItemVariants`,
`timelineContentVariants`, `timelineDotVariants`, `timelineConnectorVariants`).
`sortByDocumentPosition` and the register/unregister collection are the pieces flagged for reuse by
future order-sensitive ports.

## Project Structure

### Documentation (this feature)

```text
specs/010-port-timeline/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── public-api.md    # Phase 1 output — exported surface + data attributes + errors
├── checklists/
│   └── requirements.md  # from /speckit-specify
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/lib/components/ui/timeline/
├── index.ts                        # barrel: Root/Item/Dot/… + Timeline* aliases + types + state exports
├── timeline.svelte                 # Root  <ol>  ← timeline.tsx `Timeline`
├── timeline-item.svelte            # Item  <li>  ← `TimelineItem`
├── timeline-dot.svelte             # Dot   <div> ← `TimelineDot`
├── timeline-connector.svelte       # Connector <div> ← `TimelineConnector`
├── timeline-content.svelte         # Content <div> ← `TimelineContent`
├── timeline-header.svelte          # Header  <div> ← `TimelineHeader`
├── timeline-title.svelte           # Title   <div> ← `TimelineTitle`
├── timeline-description.svelte     # Description <div> ← `TimelineDescription`
├── timeline-time.svelte            # Time  <time> ← `TimelineTime`
├── timeline.svelte.ts              # TimelineState + TimelineItemState + 2 Symbol contexts + pure helpers
│                                   #   ← `Store`/`StoreContext`/`TimelineContext`/`TimelineItemContext`
│                                   #     /`getItemStatus`/`getSortedEntries`/`useLazyRef`
├── timeline.test.svelte            # prop-driven harness (NOT in registry.json, not collected by vitest)
└── timeline.test.ts                # colocated tests

src/routes/docs/components/timeline/
└── +page.svelte                    # 6 <ComponentPreview> sections + API tables

registry.json                       # append exactly one registry:ui entry named "timeline"
```

**Structure Decision**: nine part files, one per upstream exported component, named
`timeline-<part>.svelte` with the root at `timeline.svelte`. Upstream's four React contexts collapse
to two Svelte contexts (`TimelineState` merges upstream's `StoreContext` **and**
`TimelineContext` — one object carrying `orientation`/`variant`/`dir`/`activeIndex` **and** the item
collection, since both are root-owned and every consumer of one consumes the other;
`TimelineItemState` maps to `TimelineItemContext`). No `types.ts`: prop types live in their part's
`<script lang="ts" module>` and shared unions live in `timeline.svelte.ts`, per Principle V.
Folder slug `timeline` == demo route segment `src/routes/docs/components/timeline` == registry item
name `timeline`.

## Implementation Sequence

Phase mapping for `/speckit-tasks`; ordered so each step is independently verifiable.

1. **State module** — `timeline.svelte.ts`: unions + `TIMELINE_*` constant tuples,
   `getTimelineItemStatus`, `sortByDocumentPosition`, `TimelineState` (registration + `orderedIds` +
   `getItemIndex` + `getNextItemStatus`), `TimelineItemState` (`index`/`status`/`isAlternateRight`),
   two `Symbol` keys with throwing getters. (US1, US2, FR-005/006/017)
2. **Root** — `timeline.svelte`: `tv()` block, `useDirection()`, `setTimelineContext`, `<ol>` +
   `child`. (US1, US3, FR-001/002/003/004/011)
3. **Item** — `timeline-item.svelte`: `$props.id()` fallback, register/unregister `$effect` with
   teardown, `setTimelineItemContext`, `<li>` + `child`. (US1, US2, FR-005/006/007/008)
4. **Dot + Connector** — status-driven variants, `forceMount` early return, `data-completed`.
   (US2, FR-009/010/012)
5. **Content / Header / Title / Description / Time** — the five body parts. (FR-013/014)
6. **Barrel** — `index.ts`, short names + `Timeline*` aliases + every prop type + state exports.
   (FR-015/016, deliverable 5)
7. **Tests** — `timeline.test.svelte` harness + `timeline.test.ts` (see contract §Test Matrix).
8. **Demo route** — six previews + nine props tables.
9. **Registry** — append the entry, run `pnpm run registry:build`.
10. **Quality gates** — `format` → `check` → `lint` → `test:unit -- --run` → `build`.

Registry entry shape (deliverable 4):

```jsonc
{
	"name": "timeline",
	"type": "registry:ui",
	"title": "Timeline",
	"description": "A flexible timeline for chronological events, with vertical/horizontal orientations, an alternating variant, RTL support and completed/active/pending states.",
	"registryDependencies": ["direction-provider"], // this registry's own item, same convention as `stat` → `separator`
	"dependencies": ["tailwind-variants"], // `tv()`; matches the `status` entry
	"files": [
		/* the 11 shipped files above, `timeline.test.*` excluded */
	]
}
```

## Complexity Tracking

> No Constitution Check violations. The single bespoke behaviour (the DOM-order item collection) is
> justified in-line above under Principle IV, which the constitution satisfies without a
> Complexity Tracking entry.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | None      | —          | —                                      |

## Post-Design Constitution Re-Check

Re-evaluated after `research.md`, `data-model.md`, `contracts/public-api.md` and `quickstart.md`:
**all ten principles still PASS.** The design added no npm dependency, no suppression, no bespoke
behaviour beyond the justified collection, and no part without a `data-slot`. The one design change
made during Phase 1 — merging upstream's `StoreContext` and `TimelineContext` into a single
`TimelineState` — reduces context plumbing without changing any documented prop, attribute or error
message, so Principle II is unaffected (recorded in [research.md](./research.md) R-02).
