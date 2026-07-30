# Implementation Plan: Speed Dial

**Branch**: `016-port-speed-dial` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-port-speed-dial/spec.md`

**Upstream (pinned `d9763d82530416dfa4c81c462387b55d06bae4ec`)**:
`.reference/diceui/docs/registry/bases/radix/ui/speed-dial.tsx` (1053 lines),
`.reference/diceui/docs/types/radix/speed-dial.ts` (the documented API),
`.reference/diceui/docs/content/docs/components/radix/speed-dial.mdx`,
`.reference/diceui/docs/registry/bases/radix/test/speed-dial.test.tsx` (341 lines, 17 assertions),
`.reference/diceui/docs/registry/bases/radix/examples/speed-dial{,-labels,-hover,-controlled,-side}-demo.tsx`.

## Summary

Port Dice UI's `SpeedDial` — a floating action button that fans a set of `role="menuitem"` actions out
of one of four sides, on click or on hover, with a staggered enter/exit animation — to Svelte 5 runes
as a shadcn-svelte registry item.

Upstream is 1053 lines, of which roughly 400 are React plumbing that Svelte deletes outright: a
hand-built `useSyncExternalStore` pub/sub store, four ref/timing hooks (`useComposedRefs`,
`useAsRef`, `useLazyRef`, `useIsomorphicLayoutEffect`), and about twenty `useCallback`/`useMemo`
wrappers. The technical approach:

1. **Invert `React.Children.map` into a self-registering, document-ordered collection.** Upstream
   counts and wraps `SpeedDialContent`'s children to hand each one a stagger delay; a Svelte
   `Snippet` cannot be introspected. Items register their own element into a
   `DomOrderedCollection` sorted by `compareDocumentPosition` — the same primitive upstream already
   uses for its focusable node list — and read their index out of one shared `$derived` map. That
   keeps the whole thing O(n log n), which is precisely what upstream's own `O(n²)` regression test
   and SC-004 measure (R-01, R-16).
2. **Delete the store; keep the contract.** One `SpeedDialRootState` class on a typed `Symbol`
   context replaces `StoreContext` + `SpeedDialContext` + `subscribe`/`notify`/`getState`/`setState`.
   `open` is `$bindable` with `open ??= defaultOpen`, and `onOpenChange` still fires on every
   transition — behaviourally identical to upstream's store-plus-sync (R-02, R-08).
3. **Drive mounting from `open` directly, not from an effect.** `mounted = forceMount || open ||
   exiting`; `animating` flips one `requestAnimationFrame` later so the CSS transition has a frame to
   start from; `exiting` holds the content for `(n-1)*50 + 200` ms on close. Every timer and rAF is
   owned by an `$effect` teardown (R-03).
4. **Two behaviours stay bespoke, and only two.** `bits-ui`'s floating layer would portal the content,
   own `data-side` and flip it under collision — incompatible with upstream's four fixed CSS offsets,
   which involve no measurement at all (R-04). `bits-ui` exposes no standalone dismissable layer, and
   upstream's touch-vs-pointer branching is observable behaviour, so the outside-dismissal listener is
   ported line-for-line (R-05). Everything else composes `$lib/components/ui/button`.
5. **Follow the docs where the source lags.** The MDX keyboard table promises that `Escape` "returns
   focus to the trigger"; the source only closes. The MDX is the contract (Principle II) and dropping
   focus on `document.body` breaks Principle III, so focus is restored — recorded as a divergence
   (R-07).

Full rationale in [research.md](./research.md) (R-01…R-16); state classes, transitions and data
attributes in [data-model.md](./data-model.md); the installable surface in
[contracts/public-api.md](./contracts/public-api.md); validation in [quickstart.md](./quickstart.md)
(V-1…V-10).

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`), Svelte 5.56 with runes forced on
(`vite.config.ts`)

**Primary Dependencies**: SvelteKit 2, Tailwind CSS v4, `tailwind-variants@^3.3.0` (`tv()`), `clsx` +
`tailwind-merge` via `cn()`. Composed in-repo: `$lib/components/ui/button`. Demo page only:
`@lucide/svelte@^1.27.0` (`plus`, `share-2`, `copy`, `heart`, `x`), `svelte-sonner@^1.1.1` (`toast`;
`<Toaster/>` is already mounted in `src/routes/+layout.svelte:16`), `$lib/components/ui/button`,
`$lib/components/ui/table`. **No new npm dependency** (R-15). **`bits-ui` is not used by this
component** — it composes no primitive, for the reasons in R-04/R-05, and is therefore absent from the
registry entry.

**Storage**: N/A

**Testing**: Vitest 4 (jsdom 30, `globals: false`, `expect.requireAssertions`) +
`@testing-library/svelte@^5.4.2` + `@testing-library/user-event@^14.6.1`. One spec
(`speed-dial.test.ts`) plus one `speed-dial.test.svelte` harness for `bind:open`, `bind:ref`, the six
`child` snippets, provider-less parts, `{#each}`-driven item sets and the sibling focusables the
Tab-exit cases need. Hover, exit-unmount and the deferred outside listener run under
`vi.useFakeTimers()` with `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`, which is
mandatory or the 250 ms hover delay never elapses (R-14).

**Target Platform**: SSR + browser (modern evergreen). Effects do not run during SSR, so the exit
timer, the rAF and both document listeners are client-only; `defaultOpen` renders server-side with
`data-state="closed"` and animates on the client (R-03).

**Project Type**: shadcn-svelte registry component + its docs route

**Performance Goals**: one document-order sort per structural change of the item/node collections,
shared by every reader (O(n log n) total); 50 items with `defaultOpen` must render in < 1000 ms
(SC-004, upstream test:145-176). Opening writes one `$state` (`animating`) that touches n item
`data-state` attributes and n `--speed-dial-delay` values; no per-frame work after that — the stagger
is CSS `transition-delay`, not JS.

**Constraints**: every documented prop, data attribute, CSS variable and key from the MDX reproduced;
no children introspection; no leaked timer, rAF or document listener (`$effect` teardown); strict TS
with no suppressions and no `any`; semantic tokens only; the item stagger must not become O(n²).

**Scale/Scope**: 6 exported components + 2 runes modules + 1 barrel = 9 registry files; 8 root props,
5 content props, 1 action prop plus the shared `ref`/`class`/`children`/`child` on all six parts;
5 demo sections + 4 API tables; ~60 test cases across 9 `describe` groups (17 of them ported
one-for-one from upstream).

No `NEEDS CLARIFICATION` remains — every open question is resolved in `research.md` R-01…R-16 and
mirrored into the spec's Assumptions.

## Constitution Check

_GATE: passed before Phase 0; re-checked after Phase 1 design — see the re-check note below._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ----------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$derived.by`/`$effect`/`$props`/`$bindable`/`$props.id()` + snippets only; `SpeedDialRootState`, `SpeedDialContentState`, `SpeedDialItemState` and `DomOrderedCollection` live in `.svelte.ts` modules with getter-function inputs (`CLAUDE.md` §4). No store, `export let`, `createEventDispatcher`, `$:` or `<slot>`. The ~20 `useMemo`/`useCallback` wrappers are dropped, not ported; `useLazyRef` becomes a field initialiser and `useAsRef` becomes nothing (R-02). |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | All 6 parts and all documented props reproduced under upstream names, defaults and JSDoc (`contracts/public-api.md` §1-§6); the MDX's `data-state`/`data-orientation`/`data-side`/`data-disabled` tables, its five CSS variables and its four keyboard rows are all covered; the stagger formula, the exit-duration formula, the `speedDial.actionSelect` / `speedDial.interactOutside` event names, the cancelable ordering and the touch-vs-pointer dismissal split are ported verbatim; all 17 upstream test assertions are ported (`quickstart.md` V-3); 9 divergences recorded in `contracts/public-api.md` §10 and appended to the spec's Assumptions; all 5 demo files ported. |
| III  | Accessibility Is a MUST             | PASS    | APG *menu-button*: trigger is a real `<button>` with `role="button"`, `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`; content is `role="menu"` + `aria-orientation`; actions are `role="menuitem"` named by `aria-labelledby` → the sibling label (works `sr-only` or visible, FR-012); item is `role="none"`. Keyboard parity plus the MDX's focus restore on `Escape` (R-07); `Tab`/`Shift+Tab` exit closes and lets focus proceed natively — no trap. Disabled actions are excluded from the exit boundary. Tests cover roles, accessible names, every key through `user-event`, RTL, controlled + uncontrolled, `disabled` guard rails and the outside-provider throw (`quickstart.md` V-4, V-7, V-8). |
| IV   | Composition Over Reimplementation   | PASS    | `$lib/components/ui/button` composed for the trigger and every action (R-09); the demo composes `button`/`table`/`svelte-sonner`. Two bespoke behaviours, both justified in the table below with the primitive evaluated and the capability it lacks. Nothing else is hand-rolled: positioning is four CSS declarations, the stagger is CSS `transition-delay`. No `shadcn-svelte add` is run. |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder `speed-dial/`, one part per file (`speed-dial.svelte` + five `speed-dial-<part>.svelte`), reactive logic in `speed-dial.svelte.ts` and `speed-dial-collection.svelte.ts`, barrel with short names + prefixed aliases + prop types, `.js` extensions everywhere, one `registry:ui` entry listing all 9 non-test files, zero imports from `src/routes/**` or `src/lib/components/docs/**` (grepped in `quickstart.md` V-1). |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Prop types exported from `<script lang="ts" module>`; div parts derive from `WithElementRef<HTMLAttributes<HTMLDivElement>>`, button parts from `ButtonProps`; the `CustomEvent` payloads are named types (`SpeedDialInteractOutsideEvent`, `SpeedDialActionSelectEvent`); the one genuinely ambiguous typing — `Button`'s handler props are the intersection of the button and anchor signatures because `Button` renders either element — reuses the existing `banner-close.svelte:31-38` widening precedent rather than `any`. `DomOrderedCollection<TMeta>` is generic, so neither collection needs a cast. Anti-cheat greps in `quickstart.md` V-1. |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit --run` → `build` (+ `registry:build`) scheduled as the final phase; no skipped, `.todo` or assertion-free test. |
| VIII | Styling Discipline                  | PASS    | Two `tv()` blocks in `speed-dial.svelte.ts`, exported; `cn()` elsewhere with the caller's `class` merged last; upstream's classes are already semantic (`bg-accent`, `bg-popover`, `text-popover-foreground`, `shadow-md`) so **no palette remapping is needed** (R-13) — no raw colour, no `dark:`, no `space-*`, `size-11` not `h-11 w-11`. `data-slot` on all six parts; state exposed as `data-state`, `data-side`, `data-orientation`, `data-disabled`, with booleans written `? '' : undefined` (which fixes upstream's permanently-emitted `data-disabled={false}`). **`z-50` on the content is retained** — the rule targets overlays whose primitive owns stacking (Dialog/Popover/Tooltip/Sheet); this content is a local `absolute` sibling with no primitive behind it, exactly the carve-out already documented in `marquee-edge.svelte:18-21` and `scroller-button.svelte:14-17`, and the same explanatory comment is written in-file (R-12). |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/speed-dial/+page.svelte` with one `<ComponentPreview>` per upstream demo file (Default, With Labels, Hover Mode, Controlled State, Sides) plus the MDX's fixed-positioning guidance and props / data-attribute / CSS-variable / keyboard tables; demo state held in the page with runes; no `+page.ts`. |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/016-port-speed-dial/`; `SPECIFY_FEATURE_DIRECTORY` honoured; no git write command anywhere in this plan. |

**Bespoke behaviour justification (Principle IV)**

| Bespoke piece                                     | Primitive evaluated                                              | Capability it lacks                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content placement (4 CSS declarations + origin)   | `bits-ui` floating layer via `popover` / `hover-card` / `tooltip`  | The primitive portals to the body, owns `data-side`/`data-align`, applies Floating UI transforms and **flips `data-side` under collision**. Upstream measures nothing and pins the side absolutely — adopting the primitive would change the documented `data-side` contract, the `--speed-dial-transform-origin` variable and the `role` (R-04). |
| Outside dismissal + `Escape`/`Tab` keydown layer  | `bits-ui` dismissable/escape layers (only exposed *inside* `Popover.Content`, `Dialog.Content`, …) | No standalone layer is exported to compose; adopting `Popover` would portal the content, trap focus and replace `role="menu"`. Upstream's `pointerType === 'touch'` deferral to a one-shot `click`, its capture-phase inside-tree guard and its cancelable `speedDial.interactOutside` payload are all observable behaviour that no primitive reproduces (R-05). |
| `DomOrderedCollection`                            | `bits-ui` internal collection (not exported); mount-order counter | bits-ui exposes no collection API; a counter is wrong under `{#each}` reordering. This is 30 lines replacing upstream's own `getNodes()`, and is **exported for reuse** by later ports that upstream builds on `@diceui/shared`'s `useCollection` (R-16). |
| Trigger / action button chrome                    | `$lib/components/ui/button` — **composed**, not reimplemented      | n/a; only the `size-11 rounded-full` overrides are ours, exactly as upstream layers them over its own `Button` (R-09).                                                                                                                                                                                                     |

**Post-Phase-1 re-check**: `data-model.md`, `contracts/public-api.md` and `quickstart.md` introduce no
new dependency, no suppression, no palette colour, no docs-app import and no additional bespoke
behaviour. Phase 1 surfaced three compliance decisions, all recorded in the spec's Assumptions rather
than carried as violations: the Tab-exit boundary includes the trigger (R-06), `Escape` restores focus
(R-07), and the content is positioned even while closed under `forceMount` (R-04). All ten verdicts
stand; Complexity Tracking stays empty.

## Public API

Authoritative table: [`contracts/public-api.md`](./contracts/public-api.md). Summary — 6 exported
components, 2 runes modules. Every part additionally accepts `ref` (bindable, `HTMLElement | null`),
`class`, `children`, a `child` snippet replacing `asChild`, and the rest of its element's HTML
attributes.

### `SpeedDial` (`.Root`) — `speed-dial.svelte` ← upstream `SpeedDial` (149-307)

| Prop             | Type                                        | Default     | Bindable |
| ---------------- | ------------------------------------------- | ----------- | -------- |
| `open`           | `boolean \| undefined`                      | `undefined` | **yes**  |
| `defaultOpen`    | `boolean`                                   | `false`     | no       |
| `onOpenChange`   | `(open: boolean) => void`                   | `undefined` | no       |
| `side`           | `'top' \| 'right' \| 'bottom' \| 'left'`    | `'top'`     | no       |
| `activationMode` | `'click' \| 'hover'`                        | `'click'`   | no       |
| `delay`          | `number`                                    | `250`       | no       |
| `disabled`       | `boolean`                                   | `false`     | no       |
| `ref`            | `HTMLDivElement \| null`                    | `null`      | **yes**  |
| `child`          | `Snippet<[{ props: SpeedDialChildProps }]>` | `undefined` | no       |

Snippets: `children`, `child`. Callbacks: `onOpenChange`. Data attributes: `data-slot="speed-dial"`,
`data-state`, `data-disabled`.

### `SpeedDialTrigger` (`.Trigger`) — `speed-dial-trigger.svelte` ← upstream (309-452)

| Prop       | Type                        | Default       | Bindable |
| ---------- | --------------------------- | ------------- | -------- |
| `disabled` | `boolean \| undefined`      | `undefined`   | no       |
| `id`       | `string \| undefined`       | `$props.id()` | no       |
| `variant`  | `ButtonVariant`             | `'default'`   | no       |
| `size`     | `ButtonSize`                | `'icon'`      | no       |
| `ref`      | `HTMLButtonElement \| null` | `null`        | **yes**  |

Snippets: `children`, `child`. Callbacks: caller's `onclick` / `onmouseenter` / `onmouseleave` run
first and may `preventDefault()`. ARIA: `role="button"`, `aria-haspopup="menu"`, `aria-expanded`,
`aria-controls`. Data attributes: `data-slot="speed-dial-trigger"`, `data-state`.

### `SpeedDialContent` (`.Content`) — `speed-dial-content.svelte` ← upstream (516-839)

| Prop                | Type                                             | Default     | Bindable |
| ------------------- | ------------------------------------------------ | ----------- | -------- |
| `offset`            | `number`                                         | `8`         | no       |
| `gap`               | `number`                                         | `8`         | no       |
| `forceMount`        | `boolean`                                        | `false`     | no       |
| `onEscapeKeyDown`   | `(event: KeyboardEvent) => void`                 | `undefined` | no       |
| `onInteractOutside` | `(event: SpeedDialInteractOutsideEvent) => void` | `undefined` | no       |
| `ref`               | `HTMLDivElement \| null`                         | `null`      | **yes**  |

Snippets: `children`, `child`. Callbacks: both of the above are cancelable — `preventDefault()` keeps
the dial open. ARIA: `role="menu"`, `aria-orientation`. Data attributes:
`data-slot="speed-dial-content"`, `data-state`, `data-orientation`, `data-side`. CSS variables:
`--speed-dial-gap`, `--speed-dial-offset`, `--speed-dial-transform-origin`.

### `SpeedDialItem` (`.Item`) — `speed-dial-item.svelte` ← upstream (892-934)

No props of its own beyond the shared set. `role="none"`; `data-slot="speed-dial-item"`,
`data-state`, `data-side`; CSS variables `--speed-dial-animation-duration` (200 ms) and
`--speed-dial-delay` (its stagger). Provides `actionId` / `labelId` to its action and label.

### `SpeedDialAction` (`.Action`) — `speed-dial-action.svelte` ← upstream (941-1025)

| Prop       | Type                                          | Default           | Bindable |
| ---------- | --------------------------------------------- | ----------------- | -------- |
| `onSelect` | `(event: SpeedDialActionSelectEvent) => void` | `undefined`       | no       |
| `disabled` | `boolean \| undefined`                        | `undefined`       | no       |
| `id`       | `string \| undefined`                         | item's `actionId` | no       |
| `variant`  | `ButtonVariant`                               | `'outline'`       | no       |
| `size`     | `ButtonSize`                                  | `'icon'`          | no       |
| `ref`      | `HTMLButtonElement \| null`                   | `null`            | **yes**  |

Snippets: `children`, `child`. Callbacks: `onclick` then the cancelable
`speedDial.actionSelect` → `onSelect`; if neither prevents default, the dial closes. ARIA:
`role="menuitem"`, `aria-labelledby={labelId}`. Data attribute: `data-slot="speed-dial-action"`.

### `SpeedDialLabel` (`.Label`) — `speed-dial-label.svelte` ← upstream (1027-1043)

No props of its own beyond the shared set. `id={labelId}`, `data-slot="speed-dial-label"`. Use
`class="sr-only"` for an accessible-name-only label (four of the five upstream demos do).

### Runes modules

- `speed-dial.svelte.ts` — constants, pure helpers (`getDataState`, `getTransformOrigin`,
  `getOrientation`, `getContentPosition`, `getItemDelay`), `speedDialContentVariants`,
  `speedDialItemVariants`, the three state classes and their `set…`/`get…Context` pairs.
- **`speed-dial-collection.svelte.ts` (deliverable 5)** — `DomOrderedCollection<TMeta>`, the
  document-ordered registry that replaces upstream's `getNodes()` and `@diceui/shared`'s
  `useCollection`. Exported from the barrel so later ports (`mention`, `tags-input`, `combobox`,
  `kanban`, `sortable`) import it and add `speed-dial` to their `registryDependencies` instead of
  duplicating it (R-16).

## Project Structure

### Documentation (this feature)

```text
specs/016-port-speed-dial/
├── plan.md                    # this file
├── spec.md                    # updated: Phase 0/1 Assumptions appended
├── research.md                # Phase 0 — R-01…R-16
├── data-model.md              # Phase 1 — constants, state classes, transitions, data attributes
├── quickstart.md              # Phase 1 — usage + V-1…V-10 validation
├── contracts/
│   └── public-api.md          # Phase 1 — props, rendered tree, barrel, registry entry, divergences
├── checklists/
│   └── requirements.md
└── tasks.md                   # Phase 2 (/speckit-tasks) — NOT created here
```

### Source Code (repository root)

```text
src/lib/components/ui/speed-dial/
├── index.ts                          # barrel: 6 components + aliases + prop types + module re-exports
├── speed-dial-collection.svelte.ts   # DomOrderedCollection      ← getNodes() (213-229)
├── speed-dial.svelte.ts              # constants, tv() ×2, 3 state classes, 3 contexts
│                                     #   ← Store (65-104), contexts (112-137, 454-487, 876-890),
│                                     #     cva blocks (489-504, 841-874), renderState (571-622)
├── speed-dial.svelte                 # Root                      ← SpeedDial (149-307)
├── speed-dial-trigger.svelte         # Trigger                   ← SpeedDialTrigger (309-452)
├── speed-dial-content.svelte         # Content                   ← SpeedDialContent (516-839)
├── speed-dial-item.svelte            # Item                      ← SpeedDialItem (892-934)
├── speed-dial-action.svelte          # Action                    ← SpeedDialAction (941-1025)
├── speed-dial-label.svelte           # Label                     ← SpeedDialLabel (1027-1043)
├── speed-dial.test.svelte            # harness — not collected, not in registry.json
└── speed-dial.test.ts                # colocated tests

src/routes/docs/components/speed-dial/
└── +page.svelte                      # 5 <ComponentPreview> + API tables

registry.json                         # append exactly one registry:ui entry (17th item)
```

**Structure Decision.** Folder slug `speed-dial` = demo route segment = registry item name, as
Principle V requires. Upstream is one file holding six exported components plus one internal
`SpeedDialItemImpl`; `CLAUDE.md` §3 forbids two components in one `.svelte` file, so each exported
part gets its own file. `SpeedDialItemImpl` does **not** become a file — it exists only to carry
React context down one level, and is replaced by `SpeedDialContentState` on context plus the item's
own registry lookup (R-01). The collection is split out of `speed-dial.svelte.ts` deliberately: it is
generic, has no speed-dial knowledge, and is the piece later ports reuse — the same reasoning that
produced `relative-time-format.ts` in feature 015. No `types.ts` is needed; each part exports its own
props type from its module script and the shared types live beside the state classes that produce
them.

## Implementation Phases

Ordering is dependency-driven; `/speckit-tasks` will expand each into tasks.

| #   | Phase              | Deliverable                                                                                                                                                                                                | Depends on |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 1   | Collection         | `speed-dial-collection.svelte.ts` — `DomOrderedCollection<TMeta>`: `register`/`unregister`, `ordered` (document-position sort), `indexById`, `size`, `elements()`                                              | —          |
| 2   | Runes module       | `speed-dial.svelte.ts` — constants, `getDataState`/`getTransformOrigin`/`getOrientation`/`getContentPosition`/`getItemDelay`, both `tv()` blocks, `SpeedDialRootState` / `SpeedDialContentState` / `SpeedDialItemState` + the three context helpers | 1          |
| 3   | Root               | `speed-dial.svelte` — `open ??= defaultOpen`, `setOpen`, `$props.id()` content id, `onpointerdowncapture` guard, `data-state`/`data-disabled`, `child` snippet                                                 | 2          |
| 4   | Trigger            | `speed-dial-trigger.svelte` — `Button` composition, node registration, click toggle, hover open/close timers with teardown, full ARIA                                                                          | 2, 3       |
| 5   | Content            | `speed-dial-content.svelte` — presence/animation `$effect`, keydown layer (`Escape` + focus restore, `Tab`/`Shift+Tab` exit), outside-dismissal layer with the touch branch, hover-close cancel, CSS variables + position, `role="menu"` | 2, 3       |
| 6   | Item / Action / Label | `speed-dial-item.svelte` (registration, stagger delay, `role="none"`), `speed-dial-action.svelte` (`Button`, node registration, `actionSelect` dispatch → `onSelect` → close), `speed-dial-label.svelte`; then `index.ts` | 2, 5       |
| 7   | Tests              | `speed-dial.test.svelte` harness + `speed-dial.test.ts` — V-2 (helpers/collection), V-3 (all 17 upstream assertions), V-4 (keyboard/focus), V-5 (pointer/hover/dismissal), V-6 (presence/animation/CSS vars), V-7 (composition/ARIA/guards), V-8 (RTL) | 1–6        |
| 8   | Docs route         | `src/routes/docs/components/speed-dial/+page.svelte` — Default, With Labels, Hover Mode, Controlled State, Sides + fixed-positioning note + API tables                                                          | 6          |
| 9   | Registry           | append the `speed-dial` entry to `registry.json`; run `pnpm run registry:build`                                                                                                                                | 6          |
| 10  | Gates              | `format` → `check` → `lint` → `test:unit --run` → `build`, all green with no suppression                                                                                                                       | 1–9        |

**User-story mapping**: **P1/US1** (reveal actions, select one, close by trigger/action/Escape/outside)
= phases 1-6 plus V-3/V-5/V-6 and the Default demo — independently shippable. **P1/US2** (keyboard-only
operation) = the keydown layer in phase 5 and the node registrations in phases 4 and 6, plus V-4.
**P2/US3** (activation mode, side, labels, controlled) = the hover timers in phases 4-5, the `side`
variants from phase 2, the label/`aria-labelledby` wiring in phase 6 and the `$bindable` seed in
phase 3, plus V-7/V-8 and the Labels, Hover, Controlled and Sides demos.

## Risks

| Risk                                                                                                                | Mitigation                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An effect-driven `shouldRender` would make upstream's synchronous `render(<… open …/>)` + `getByTestId('content')` assertions fail | `mounted` is `$derived` from `open` directly, so the first open render is synchronous; only `animating` waits a frame (R-03). The three affected upstream cases are written first, in phase 7.        |
| `userEvent` under fake timers never advances the 250 ms hover delay, hanging every hover assertion                     | `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` in every timer-dependent test; the first hover test is written before the rest of that group so the pattern is proven early (R-14).        |
| Recomputing each item's index independently would reintroduce the O(n²) upstream regressed on          | One shared `indexById` `$derived` per collection; every item does a single `Map.get`. The 50-item < 1000 ms case is ported verbatim as the guard (R-01, SC-004).                                       |
| The item stagger index is `undefined` on the very first paint, before `bind:this` has run              | `delayFor` falls back to index `0`; the rAF that starts `animating` runs after effects, so the delay is correct by the time the transition begins. Asserted in V-6.                                     |
| `$effect` writing `animating`/`exiting` while also reading `open` could loop                            | The effect reads only `open`/`forceMount` and writes only `animating`/`exiting`, which it never reads; `#wasOpen` is a plain field, not `$state` (`CLAUDE.md` §4).                                     |
| A leaked `document` `pointerdown`/`keydown` listener or hover timer would break the next test in the file | Every listener and timer is created inside an `$effect` and removed in its teardown, including the one-shot touch `click` listener; `SpeedDialRootState.destroy()` clears the shared hover-close timer. |
| `jsdom` does not emit `pointerType: 'touch'` through `user-event`                                       | That single branch is driven with an explicit `PointerEvent` dispatch — the only non-`userEvent` interaction in the suite, and it is called out in V-5.                                                 |
| `Button`'s handler props are the intersection of button and anchor signatures, tempting an `any`        | The `banner-close.svelte:31-38` widening precedent is reused verbatim for `onclick`/`onmouseenter`/`onmouseleave` (R-09).                                                                              |
| Dropping `z-50` to satisfy a literal reading of Principle VIII would put the fan behind adjacent content | Retained with the same in-file comment as `marquee-edge`/`scroller-button`, and justified in the Constitution Check (R-12).                                                                             |
| The Sides demo renders four open dials that overlap in a preview canvas                                 | Upstream's own `grid grid-cols-2 gap-24` layout is reproduced, and the preview gets extra `min-h` through `ComponentPreview`'s `class` prop.                                                            |

## Complexity Tracking

> No constitution violation is carried forward. This table is intentionally empty. The three Phase 1
> decisions discussed under the re-check (Tab-exit boundary, `Escape` focus restore, unconditional
> positioning) and the retained `z-50` are reasoned compliance recorded in the spec's Assumptions and
> in research R-04/R-06/R-07/R-12 — not exceptions.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | —         | —          | —                                      |
