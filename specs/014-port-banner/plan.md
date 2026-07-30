# Implementation Plan: Banner

**Branch**: `014-port-banner` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-port-banner/spec.md`

**Upstream (pinned `d9763d82530416dfa4c81c462387b55d06bae4ec`)**:
`.reference/diceui/docs/registry/bases/radix/ui/banner.tsx` (705 lines),
`.reference/diceui/docs/types/radix/banner.ts` (the documented API),
`.reference/diceui/docs/content/docs/components/radix/banner.mdx`,
`.reference/diceui/docs/registry/bases/radix/examples/banner-{,stacked-}demo.tsx`.
**No upstream test file exists for this component.**

## Summary

Port Dice UI's `Banner` — a dismissible notification bar with an optional priority queue, per-severity
styling, auto-dismiss and a stacked enter/exit animation — to Svelte 5 runes as a shadcn-svelte
registry item.

Of the 705 upstream lines, roughly 200 are a hand-rolled observable store (`subscribe`/`getState`/
`notify` over `useLazyRef` boxes, consumed through `useSyncExternalStore`) that exists only because
React cannot observe mutation of a ref-held collection. The technical approach:

1. **Delete the store; keep the algorithm.** The queue becomes one `BannersState` class in
   `banner.svelte.ts` whose `banners` / `removing` / `heights` are `$state` replaced wholesale on every
   mutation — the same clone-and-replace shape upstream uses, minus 90 lines of pub/sub. Timers stay in
   a non-reactive private map (research R-02, R-03).
2. **Establish the controlled/uncontrolled convention, and be honest about its one limit.** `open` is
   `$bindable()` seeded once by `open ??= defaultOpen`, is the single render source, and
   `onOpenChange` fires in both modes. React's "a controlled component never moves itself" cannot
   coexist with `bind:open` in Svelte, because writing an unbound `$bindable` prop creates a local
   override; the plan keeps `bind:open`, documents the single diverging case, and pins both modes with
   tests (R-01, `contracts/public-api.md` §8).
3. **Compose the portal; hand-write only the choreography.** The `fixed`/`absolute` stack goes through
   the `bits-ui` `Portal` utility instead of `ReactDOM.createPortal` (R-06). The 400 ms enter/exit
   transform, the frozen exit offset and the container height transition are ported as-is — a Svelte
   `transition:` directive cannot coordinate a still-mounted item, its siblings re-flowing into its slot,
   and the container's own height animation (R-08).
4. **Two contexts, two throwing getters, plus one non-throwing probe.** `useBanners()` and `useBanner()`
   become `getBannersContext()` / `getBannerContext()` on `Symbol` keys, and `hasBannersContext()`
   exists because `Banner` must read the queue *optionally* — that nullable read is exactly what makes a
   single `Banner` work standalone and auto-register inside a queue (R-04, R-09).

Full rationale in [research.md](./research.md); shapes and the state machine in
[data-model.md](./data-model.md); the installable surface in
[contracts/public-api.md](./contracts/public-api.md); validation in [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict, `verbatimModuleSyntax`), Svelte 5 runes forced on
(`vite.config.ts`)

**Primary Dependencies**: SvelteKit 2, Svelte 5.56, Tailwind CSS v4, `tailwind-variants@^3.3.0`
(`tv()`), `clsx` + `tailwind-merge` via `cn()`, `bits-ui@^2.18.1` (the `Portal` utility),
`@lucide/svelte@^1.27.0` (the `X` icon). Composed in-repo: `$lib/components/ui/button`.
**No new npm dependency** — every upstream import maps onto something already installed:
`radix-ui`'s `Slot` → the `child` snippet, `class-variance-authority` → `tv()`, `react-dom` → bits-ui
`Portal`, `lucide-react` → `@lucide/svelte` (research R-14).

**Storage**: N/A

**Testing**: Vitest (jsdom, `globals: false`, `expect.requireAssertions`) +
`@testing-library/svelte@^5.4.2` + `@testing-library/user-event@^14.6.1`. One spec file
(`banner.test.ts`) plus one `.test.svelte` harness for snippets, `bind:ref`, `child` mode and
no-provider renders. Fake timers drive `rAF`, the 400 ms exit and `duration`; a
`getBoundingClientRect` stub supplies heights (R-17).

**Target Platform**: SSR + browser (modern evergreen). `crypto.randomUUID` (client-side only, on
`addBanner`), `requestAnimationFrame`, CSS transitions. The queue renders nothing on the server, as
upstream does.

**Project Type**: shadcn-svelte registry component + its docs route

**Performance Goals**: one signal write per queue mutation; the container height and every item
transform derive from a single `heights` map, so a dismissal costs one write and one derived pass, not
a per-item measurement loop. Exit completes in 400 ms (SC-004 allows 500 ms); auto-dismiss fires within
one timer tick of `duration` (SC-003 allows 1 s).

**Constraints**: `onOpenChange` must fire in both modes (FR-002); `clearBanners()` must fire **no**
dismiss callbacks (FR-012); no callback may fire for an already-removed banner; the stack must occupy
zero space when empty; strict TS with no suppressions; semantic Tailwind tokens only.

**Scale/Scope**: 8 public components + 1 internal part + 1 runes module = 11 registry files; ~10 root
props, 5 queue props, 5 content parts; 4 demo sections; ~45 test cases across 6 `describe` groups.

No `NEEDS CLARIFICATION` remains — every open question is resolved in `research.md` R-01…R-18 and
mirrored into the spec's Assumptions.

## Constitution Check

_GATE: passed before Phase 0; re-checked after Phase 1 design — see the re-check note below._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                                                                                     |
| ---- | ----------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$derived.by`/`$effect`/`$effect.pre`/`$props`/`$bindable` + snippets only; `BannersState` and `BannerState` live in `banner.svelte.ts` with getter-function inputs; no store, `export let`, `createEventDispatcher`, `$:` or `<slot>`. `untrack()` guards the two effects that write state they must not subscribe to (R-04, R-08). |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | All 8 exported components, both hooks, all 15 documented props and every data attribute reproduced with upstream names, defaults and JSDoc (`contracts/public-api.md` §1–§6); the 400 ms/`cubic-bezier(0.32,0.72,0,1)` constants, the priority insertion rule, the removal ordering and the queue-only reach of `onDismiss`/`priority`/`duration` are kept verbatim; 12 divergences recorded in the spec's Assumptions; both upstream demos ported. |
| III  | Accessibility Is a MUST             | PASS    | Upstream's `role="status"` + `aria-live="polite"` is the APG-correct mechanism for a non-modal, non-focus-stealing announcement (there is no APG "banner/notification" widget pattern) and is kept on both the standalone and the queued banner. The MDX documents only Tab/Shift+Tab/Enter/Space — all native `Button` behaviour, asserted through `user-event`. Tests cover roles, live region, no focus theft, Tab order, Enter/Space activation, the `disabled` guard rail, RTL (R-13) and the outside-provider throw. |
| IV   | Composition Over Reimplementation   | PASS    | `$lib/components/ui/button` composed for `Banner.Close`; `bits-ui`'s `Portal` composed for the portalled strategies. Remaining bespoke logic justified in the table below.                                                                                                        |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file named `banner-<part>.svelte` (root `banner.svelte`), reactive logic in `banner.svelte.ts`, barrel with short names + prefixed aliases + prop types, `.js` import extensions everywhere, one `registry:ui` entry listing all 11 non-test files, no import from `src/routes/**` or `src/lib/components/docs/**` (grepped in `quickstart.md` V-5). |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Every prop type exported from `<script lang="ts" module>`; DOM props from `WithElementRef<HTMLAttributes<HTMLDivElement>>`; `Banner.Close` reuses `ButtonProps`; queued content typed `Snippet<[BannerRenderProps]>` so no `any` is needed for the render-prop union (R-05); anti-cheat greps in `quickstart.md` V-1. |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit --run` → `build` scheduled as the final phase; no skipped, `.todo` or assertion-free test (`expect.requireAssertions` is on).                                                                                                             |
| VIII | Styling Discipline                  | PASS    | `tv()` in `banner.svelte.ts`, exported; `cn()` elsewhere with the caller's `class` merged last; five variants mapped onto `info`/`success`/`warning`/`destructive` tokens per `CLAUDE.md` §6 (R-11) — no palette colour, no `dark:`, no `space-*`; `data-slot` on all nine parts; state exposed as `data-state`, `data-variant`, `data-side`, `data-strategy`, `data-index`, `data-front`, `data-mounted`, `data-removed`. Two reasoned exceptions, both recorded in Assumptions: the retained `isolate z-50` + per-item inline `z-index: 50 - index` is the stack's own stacking algorithm, not manual z-index on one of the enumerated overlay components (Dialog/Sheet/Drawer/AlertDialog/DropdownMenu/Popover/Tooltip/HoverCard), which Banner neither is nor composes (R-12); and three upstream-observable boolean attributes keep their `true`/`false` values, with `data-state` carrying the same fact in the prescribed shape. |
| IX   | Every Component Is Documented       | PASS    | `src/routes/docs/components/banner/+page.svelte` with one `<ComponentPreview>` per upstream demo file (Default, Stacked Banners) plus Uncontrolled and Variants sections and API-reference tables; demo state held in the page with runes; no `+page.ts`.                          |
| X    | One Feature Directory Per Component | PASS    | All artifacts under `specs/014-port-banner/`; `SPECIFY_FEATURE_DIRECTORY` honoured; no git write command anywhere in this plan.                                                                                                                                                    |

**Bespoke behaviour justification (Principle IV)**

| Bespoke piece                                                          | Primitive evaluated                                                                                     | Capability it lacks                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BannersState` — priority queue, `maxVisible` cap, auto-dismiss timers | `svelte-sonner` (the repo's toast queue, and `composition.md`'s prescribed toast tool); `bits-ui` (no queue primitive) | `svelte-sonner` owns its own DOM, positions itself, and exposes no priority ordering, no `maxVisible`, no `Element`-target portal and no way to render caller-supplied compound parts inside a toast. Substituting it would replace the ported component rather than implement it. `composition.md`'s "toasts use svelte-sonner" rule addresses application code choosing a notification tool, not a registry item that ports one. |
| Enter/exit choreography (`mounted`, frozen offset, 400 ms exit, container height) | Svelte `transition:`/`animate:`; bits-ui presence utilities                                     | A `transition:` directive fires on an `{#if}` boundary; here the dismissing item stays mounted for 400 ms *while* its siblings translate into its slot and the container animates its own height. No directive coordinates those three, and swapping the algorithm would break SC-004's "zero visible overlap" (R-08).                                                       |
| Height measurement (`$effect.pre` + `getBoundingClientRect`)           | `bits-ui` (no size observer); `scroller`'s `scroll-position.svelte.ts`                                   | `scroll-position` measures a scroll container's `scrollTop`/edge state, not a sibling list's individual heights summed into a stacking offset.                                                                                                                                                                                                                              |
| Portal                                                                 | `bits-ui` `Portal` — **composed**, not reimplemented                                                    | n/a; only the `Element \| string` target type differs from upstream's (R-06).                                                                                                                                                                                                                                                                                              |
| Close button                                                           | `$lib/components/ui/button` — **composed**, not reimplemented                                           | n/a; `ghost` + `icon-sm` + a composed `onclick`, exactly as upstream composes its own `Button`.                                                                                                                                                                                                                                                                             |

**Post-Phase-1 re-check**: `data-model.md` and `contracts/public-api.md` introduce no new dependency, no
suppression, no palette colour, no docs-app import and no additional bespoke behaviour. The two styling
exceptions (§VIII above) were identified during Phase 0 and are recorded in the spec's Assumptions, not
carried as violations. All ten verdicts stand; Complexity Tracking stays empty.

## Public API

Authoritative table: [`contracts/public-api.md`](./contracts/public-api.md). Summary — 8 exported
components, 1 internal part, 1 runes module.

### `Banner` (`Banner.Root`) — `banner.svelte` ← upstream `Banner` (banner.tsx:470-595)

| Prop           | Type                                     | Default     | Bindable |
| -------------- | ---------------------------------------- | ----------- | -------- |
| `ref`          | `HTMLDivElement \| null`                 | `null`      | **yes**  |
| `open`         | `boolean \| undefined`                   | `undefined` | **yes**  |
| `defaultOpen`  | `boolean`                                | `true`      | no       |
| `onOpenChange` | `((open: boolean) => void)?`             | `undefined` | no       |
| `onDismiss`    | `(() => void)?` *(queued only)*          | `undefined` | no       |
| `variant`      | `BannerVariant`                          | `'default'` | no       |
| `priority`     | `number \| undefined` *(queued only)*    | `undefined` | no       |
| `duration`     | `number \| undefined` *(queued only)*    | `undefined` | no       |
| `dismissible`  | `boolean`                                | `true`      | no       |
| `child`        | `Snippet<[{ props: BannerChildProps }]>` | `undefined` | no       |
| `children`     | `Snippet`                                | `undefined` | no       |
| `class`, rest of `HTMLAttributes<HTMLDivElement>` | —              | —           | no       |

- **Snippets**: `children` (rendered in place standalone; handed to the queue when registered), `child`.
- **Callbacks**: `onOpenChange(false)` in both modes; `onDismiss()` on queue dismissal only.
- **Data attributes**: `data-slot="banner"`, `data-state="open"`, `data-variant`, `role="status"`,
  `aria-live="polite"`.
- **Dropped**: `asChild` (→ `child`).

### `Banners` (`Banner.Queue`) — `banner-queue.svelte` ← upstream `Banners` (banner.tsx:128-305)

| Prop         | Type                        | Default     | Bindable |
| ------------ | --------------------------- | ----------- | -------- |
| `maxVisible` | `number`                    | `1`         | no       |
| `side`       | `'top' \| 'bottom'`         | `'top'`     | no       |
| `strategy`   | `'fixed' \| 'static' \| 'sticky' \| 'absolute'` | `'fixed'` | no |
| `container`  | `Element \| string \| null` | `undefined` | no       |
| `children`   | `Snippet`                   | `undefined` | no       |

- **Snippets**: `children` only. No `ref`, no `class`, no `restProps` — upstream renders no props of its
  own onto an element either.
- **Callbacks**: none.
- **Data attributes** (stack container): `data-slot="banner-container"`, `data-side`, `data-strategy`.

### Content parts — `banner-{icon,content,title,description,actions}.svelte` (banner.tsx:597-661)

Each: `WithElementRef<HTMLAttributes<HTMLDivElement>>` + `children`; `Icon`, `Content` and `Actions`
also take `child`. `data-slot` = `banner-icon` / `banner-content` / `banner-title` /
`banner-description` / `banner-actions`. No callbacks, no throws.

### `BannerClose` (`Banner.Close`) — `banner-close.svelte` (banner.tsx:663-692)

`ButtonProps`, defaulted to `variant="ghost" size="icon-sm"`, `data-slot="banner-close"`.
`disabled ?? !dismissible`; the caller's `onclick` runs first and `preventDefault()` cancels the close;
`children` replaces the default `<XIcon />`. Throws
`` `<Banner.Close>` must be used within `<Banner.Root>`. ``

### Internal — `banner-queued.svelte` ← upstream `BannerImpl` (banner.tsx:348-468)

Props `{ banner: QueuedBanner; side: BannerSide; index: number }`. Not exported from the barrel, matching
upstream's export list. `data-slot="queued-banner"`, `data-state`, `data-mounted`, `data-removed`,
`data-side`, `data-front`, `data-index`, `data-variant`.

### Runes module — `banner.svelte.ts`

`BANNER_ANIMATION_DURATION`, `BANNER_ANIMATION_EASING`, `DEFAULT_BANNER_PRIORITY`,
`DEFAULT_BANNER_DISMISSIBLE`, `DEFAULT_MAX_VISIBLE`, `BANNER_VARIANTS`, `BANNER_SIDES`,
`BANNER_STRATEGIES`, `bannerVariants`, `resolveBannerVariant`, `isPortalStrategy`; classes
`BannersState` (upstream `Store` + `useBanners`) and `BannerState` (upstream `BannerContextValue` +
`useBanner`); `set/has/get BannersContext` and `set/has/get BannerContext`; types `BannerVariant`,
`BannerSide`, `BannerStrategy`, `BannerRenderProps`, `BannerAddOptions`, `QueuedBanner`,
`BannersStateProps`, `BannerStateProps`.

## Project Structure

### Documentation (this feature)

```text
specs/014-port-banner/
├── plan.md                    # this file
├── spec.md                    # updated: AS-3 + FR-002 restated, 12 Assumptions added
├── research.md                # Phase 0 — R-01…R-18
├── data-model.md              # Phase 1 — constants, queue entities, state classes, transitions
├── quickstart.md              # Phase 1 — usage + V-1…V-6 validation
├── contracts/
│   └── public-api.md          # Phase 1 — installable surface, variant rows, barrel, registry entry
├── checklists/
│   └── requirements.md
└── tasks.md                   # Phase 2 (/speckit-tasks) — NOT created here
```

### Source Code (repository root)

```text
src/lib/components/ui/banner/
├── index.ts                     # barrel: 8 components + aliases + prop types + module re-exports
├── banner.svelte.ts             # constants, unions, bannerVariants (tv), BannersState, BannerState,
│                                #   two Symbol contexts  ← Store (55-244), useBanners (307-320),
│                                #   useBanner (102-118), bannerVariants (322-340), constants (13-15)
├── banner.svelte                # Root: standalone render + queue registration  ← Banner (470-595)
├── banner-queue.svelte          # provider + stack container snippet + Portal  ← Banners (128-305)
├── banner-queued.svelte         # internal stacked banner (mount/measure/exit)  ← BannerImpl (348-468)
├── banner-icon.svelte           # ← BannerIcon (597-609)
├── banner-content.svelte        # ← BannerContent (611-623)
├── banner-title.svelte          # ← BannerTitle (625-635)
├── banner-description.svelte    # ← BannerDescription (637-647)
├── banner-actions.svelte        # ← BannerActions (649-661)
├── banner-close.svelte          # ← BannerClose (663-692), composes $lib/components/ui/button
├── banner.test.svelte           # harness: snippets, bind:ref, child mode, bare parts — not in registry
└── banner.test.ts               # colocated tests

src/routes/docs/components/banner/
└── +page.svelte                 # 4 <ComponentPreview> + props / data-attribute / error tables

registry.json                    # append exactly one registry:ui entry (14th item)
```

**Structure Decision.** Folder slug `banner` = demo route segment `banner` = registry item name
`banner`, as Principle V requires. Upstream's `useLazyRef` / `useAsRef` /
`useIsomorphicLayoutEffect` have **no** counterpart file — all three are dropped (R-03), so the MDX's
three "copy these hooks" steps have no equivalent in our registry entry. The stack container is a
`{#snippet}` inside `banner-queue.svelte` rather than a tenth file, because upstream reuses one JSX
variable in three positions and a snippet is the direct translation (R-07). `banner-queued.svelte` is
its own file only because `CLAUDE.md` §3 forbids two components per `.svelte` file; it stays out of the
barrel, matching upstream's omission of `BannerImpl`.

## Implementation Phases

Ordering is dependency-driven; `/speckit-tasks` will expand each into tasks.

| #   | Phase             | Deliverable                                                                                                                                     | Depends on |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Runes module      | `banner.svelte.ts`: constants, unions, `bannerVariants`, `resolveBannerVariant`, `isPortalStrategy`, `BannersState`, `BannerState`, both Symbol contexts + throwing getters + `has*` probes | —          |
| 2   | Content parts     | `banner-{icon,content,title,description,actions}.svelte` + `banner-close.svelte`                                                                | 1          |
| 3   | Root              | `banner.svelte` — standalone render, `open ??= defaultOpen`, `close()`, queue registration `$effect` with `untrack`, `child` mode                | 1, 2       |
| 4   | Queue             | `banner-queued.svelte` (mount/measure/frozen-offset/exit), `banner-queue.svelte` (provider, stack snippet, `Portal`, four strategies), `index.ts` | 1, 3       |
| 5   | Tests             | `banner.test.svelte` harness + `banner.test.ts` — V-2 (controlled/uncontrolled), V-3 (queue), V-4 (positioning, variants, a11y, RTL, guard rails) | 4          |
| 6   | Docs route        | `src/routes/docs/components/banner/+page.svelte` — Default, Uncontrolled, Stacked Banners, Variants + API tables                                 | 4          |
| 7   | Registry          | append the `banner` entry to `registry.json`; run `pnpm run registry:build`                                                                      | 4          |
| 8   | Gates             | `format` → `check` → `lint` → `test:unit --run` → `build`, all green with no suppression                                                          | 1–7        |

**User-story mapping**: **P1** (standalone banner, controlled + uncontrolled) = phases 1–3 plus their
tests and the Default/Uncontrolled demos — independently shippable, with no queue code exercised.
**P2** (queue, priority, `maxVisible`, `duration`, exit animation) = phase 4 plus V-3 and the Stacked
demo. **P3** (variants, `side`, `strategy`) = the `tv()` rows from phase 1 and the container branches
from phase 4, plus V-4 and the Variants demo.

## Risks

| Risk                                                                                                                         | Mitigation                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The registration `$effect` writes `banners`, which the queue renders from — a naive implementation self-invalidates or loops   | `addBanner`/`removeBanner` are called inside `untrack()`; the effect subscribes only to the props that must trigger re-registration (R-04). A test re-registers on a `variant` change and asserts exactly one queue entry.                 |
| `setHeight` reads `heights` to short-circuit, then writes it, inside the measuring `$effect.pre` — the documented loop shape    | The write is `untrack`ed and the setter early-returns on an unchanged value (R-08), the same double guard `scroller`'s `setMetrics` uses.                                                                                                  |
| jsdom measures nothing, so all offsets collapse to `0px` and a broken offset calculation would pass silently                   | Per-suite `getBoundingClientRect` stub with a fixed height, restored in `afterEach`; offsets and the container `height` asserted against computed sums (R-17).                                                                            |
| Fake timers must cover `requestAnimationFrame` (mount), the 400 ms exit and `duration` simultaneously                          | `vi.useFakeTimers()` fakes rAF in Vitest 4; tests advance in explicit steps and `await tick()` between them. A test asserts the intermediate state (`data-state="closed"` while still mounted) so the two timers cannot be conflated.      |
| A timer firing after its banner was removed would call `onDismiss` on a dead entry                                             | `removeBanner` and `clearBanners` clear the timer before dropping the entry; `BannersState.destroy()` is called from an `$effect` teardown in the provider. Tests advance timers *after* `clearBanners()` and assert no callback (FR-012).   |
| Referencing a top-level `{#snippet}` from the instance script could hit a TDZ                                                 | Demos and tests reference content snippets from inline handlers in the markup (`onclick={() => queue.addBanner({ content: info })}`), which is unambiguously the same lexical scope and evaluated after initialisation.                     |
| A `fixed`-strategy stack portalled to `document.body` would overlay the docs site chrome                                       | The Stacked demo uses `strategy="static"` with `maxVisible={3}` inside its preview, and its description states upstream's defaults (`fixed`, `maxVisible={1}`) and why the demo differs. All four strategies are still covered by V-4.       |
| `Banner.Queue` renders no element, so a consumer may expect `class`/`ref` to work on it                                        | Contract §2 states it explicitly; the prop type simply does not include them, so it is a compile error rather than a silent no-op.                                                                                                        |

## Complexity Tracking

> No constitution violation is carried forward. This table is intentionally empty. The two styling
> decisions discussed under Principle VIII (the stack's own `z-index` algorithm, and three
> upstream-observable `true`/`false` data attributes) are reasoned compliance recorded in the spec's
> Assumptions, not exceptions.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | —         | —          | —                                      |
