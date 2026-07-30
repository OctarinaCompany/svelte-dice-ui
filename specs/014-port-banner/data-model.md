# Phase 1 Data Model: Banner

**Feature**: `014-port-banner` | **Date**: 2026-07-30 | **Research**: [research.md](./research.md)

Everything below lives in `src/lib/components/ui/banner/`. Section 1 is the runes module
`banner.svelte.ts`; sections 2–4 are component-level shapes declared in each part's
`<script lang="ts" module>`; section 5 is the state machine.

---

## 1. `banner.svelte.ts` — constants, unions, variants

```ts
/** Enter/exit transition length in ms. Upstream `BANNER_ANIMATION_DURATION` (banner.tsx:13). */
export const BANNER_ANIMATION_DURATION = 400;

/** Easing shared by the item transform and the container height (banner.tsx:278, 459). */
export const BANNER_ANIMATION_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

/** `priority` fallback — upstream `DEFAULT_BANNER_PRIORITY` (banner.tsx:14). */
export const DEFAULT_BANNER_PRIORITY = 0;

/** `dismissible` fallback — upstream `DEFAULT_BANNER_DISMISSIBLE` (banner.tsx:15). */
export const DEFAULT_BANNER_DISMISSIBLE = true;

/** `maxVisible` fallback — upstream `maxVisible = 1` (banner.tsx:131). */
export const DEFAULT_MAX_VISIBLE = 1;

/** Every value `variant` accepts, in upstream declaration order (banner.tsx:17). */
export const BANNER_VARIANTS = ['default', 'info', 'success', 'warning', 'destructive'] as const;
export type BannerVariant = (typeof BANNER_VARIANTS)[number];

/** Which page edge the stack anchors to. Upstream `BannerSide` (banner.tsx:18). */
export const BANNER_SIDES = ['top', 'bottom'] as const;
export type BannerSide = (typeof BANNER_SIDES)[number];

/** How the stack is positioned. Upstream `BannerStrategy` (banner.tsx:19). */
export const BANNER_STRATEGIES = ['fixed', 'static', 'sticky', 'absolute'] as const;
export type BannerStrategy = (typeof BANNER_STRATEGIES)[number];

/** The two strategies that portal (banner.tsx:250). */
export function isPortalStrategy(strategy: BannerStrategy): boolean;

/** Narrow an untyped runtime value to a known variant, falling back to `"default"`. */
export function resolveBannerVariant(value?: string): BannerVariant;

export const bannerVariants = tv({ base: …, variants: { variant: … }, defaultVariants: { variant: 'default' } });
```

`bannerVariants` rows are fixed by [research.md](./research.md) R-11 and repeated verbatim in
[`contracts/public-api.md`](./contracts/public-api.md) §6.

## 2. Queue entities

### 2.1 `BannerRenderProps` — the snippet payload

Upstream `BannerRenderProps` (`banner.tsx:27-33`, MDX-documented). Member names are kept.

| Field         | Type            | Notes                                                          |
| ------------- | --------------- | -------------------------------------------------------------- |
| `id`          | `string`        | The queue-assigned id.                                         |
| `variant`     | `BannerVariant` | Resolved, never `undefined` (upstream types it optional).       |
| `dismissible` | `boolean`       | Already defaulted.                                             |
| `onClose`     | `() => void`    | Animate out, then remove. Same path as the close control.       |
| `onRemove`    | `() => void`    | Remove immediately, no animation.                               |

### 2.2 `BannerAddOptions` — the argument to `addBanner`

Upstream `Omit<BannerData, 'id'>` / documented `BannerAddOptions`.

| Field         | Type                           | Default                       |
| ------------- | ------------------------------ | ----------------------------- |
| `content`     | `Snippet<[BannerRenderProps]>` | required                      |
| `variant`     | `BannerVariant?`               | `'default'` at render time    |
| `priority`    | `number?`                      | `DEFAULT_BANNER_PRIORITY` (0) |
| `dismissible` | `boolean?`                     | `DEFAULT_BANNER_DISMISSIBLE`  |
| `duration`    | `number?`                      | none ⇒ no auto-dismiss        |
| `onDismiss`   | `(() => void)?`                | none                          |

### 2.3 `QueuedBanner` — a queue entry

`QueuedBanner = BannerAddOptions & { readonly id: string }`. Upstream `BannerData` /
`QueuedBannerItem`. `id` comes from `crypto.randomUUID()` (`banner.tsx:160`), only ever called from a
client-side `addBanner`, so it is SSR-safe.

## 3. `BannersState` — one instance per `<Banner.Queue>`

Replaces upstream's `Store` (`banner.tsx:55-65`, `147-244`) and `useBanners()` (`307-320`).

```ts
export type BannersStateProps = {
	readonly getMaxVisible: () => number;
};

export class BannersState {
	#props!: BannersStateProps;

	#banners: QueuedBanner[] = $state([]);
	#removing: Set<string> = $state(new Set());
	#heights: Map<string, number> = $state(new Map());
	#timeouts = new Map<string, ReturnType<typeof setTimeout>>(); // not reactive

	get banners(): readonly QueuedBanner[];
	readonly visibleBanners: readonly QueuedBanner[] = $derived(…);
	readonly totalHeight: number = $derived(…);

	constructor(props: BannersStateProps) { this.#props = props; }

	addBanner(options: BannerAddOptions): string;
	removeBanner(id: string): void;
	clearBanners(): void;
	setRemoving(id: string, value: boolean): void;
	isRemoving(id: string): boolean;
	setHeight(id: string, height: number): void;
	removeHeight(id: string): void;
	offsetOf(id: string): number;
	destroy(): void;
}
```

| Member                     | Upstream                               | Behaviour                                                                                                                                                                        |
| -------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `banners`                  | `state.banners`                        | Insertion-ordered by descending priority. Exposed read-only.                                                                                                                     |
| `visibleBanners`           | `banners.slice(0, maxVisible)` (248)   | `$derived`, recomputed when `banners` or `maxVisible` changes.                                                                                                                    |
| `totalHeight`              | `useMemo` (255-261)                    | Σ `heights.get(id) ?? 0` over `visibleBanners`.                                                                                                                                  |
| `addBanner`                | `onBannerAdd` (159-187)                | New id; inserted **before the first entry whose priority is lower**, else appended — which is what makes equal priorities keep insertion order. Starts the `duration` timer, whose callback calls `setRemoving(id, true)` (animate out, *not* immediate removal) and drops itself from `#timeouts`. Returns the id. |
| `removeBanner`             | `onBannerRemove` (188-207)             | No-op for an unknown id. Clears any pending timer, drops the id from `removing`, calls `banner.onDismiss?.()`, **then** filters `banners`. Order is upstream's.                    |
| `clearBanners`             | `onBannersClear` (208-217)             | Clears every timer, then empties `removing`, `heights`, `banners`. Deliberately does **not** call `onDismiss` (spec edge case).                                                    |
| `setRemoving` / `isRemoving` | `onRemovingChange` (218-227)          | Set replaced wholesale (R-02).                                                                                                                                                    |
| `setHeight` / `removeHeight` | `onHeightChange` / `onHeightRemove` (228-241) | Both short-circuit when nothing would change; Map replaced wholesale.                                                                                                    |
| `offsetOf`                 | `BannerImpl`'s `offset` useMemo (360-367) | Σ heights of the entries **before** `id` in `banners`. Lives on the state so the queued part reads one method instead of two collections.                                     |
| `destroy`                  | none (React unmounts the store)        | Clears every pending timer. Called from an `$effect` teardown in `banner-queue.svelte` so a page navigation cannot leave a timer running.                                          |

## 4. `BannerState` — one instance per rendered banner

Replaces upstream's `BannerContextValue` (`85-90`) and `useBanner()` (`102-118`). Reactive inputs are
getter functions, per `CLAUDE.md` §4 and R-10.

```ts
export type BannerStateProps = {
	readonly getId: () => string | undefined;
	readonly getVariant: () => BannerVariant;
	readonly getDismissible: () => boolean;
	readonly close: () => void;
	readonly remove: () => void;
};

export class BannerState {
	#props!: BannerStateProps;
	readonly id: string | undefined = $derived(this.#props.getId());
	readonly variant: BannerVariant = $derived(this.#props.getVariant());
	readonly dismissible: boolean = $derived(this.#props.getDismissible());
	constructor(props: BannerStateProps) { this.#props = props; }
	close(): void;   // animate out (queued) / set open false (standalone)
	remove(): void;  // queue removal; no-op when standalone
}
```

| Publisher              | `getId`            | `close`                          | `remove`                    |
| ---------------------- | ------------------ | -------------------------------- | --------------------------- |
| `banner.svelte` (standalone) | `undefined`  | `open = false; onOpenChange(false)` | no-op (R-10)             |
| `banner-queued.svelte` | the queue id       | `queue.setRemoving(id, true)`    | `queue.removeBanner(id)`    |

## 5. Contexts

```ts
const BANNERS_CONTEXT_KEY = Symbol('banner-queue');
export function setBannersContext(state: BannersState): BannersState;
export function hasBannersContext(): boolean;
export function getBannersContext(consumerName: string): BannersState; // throws

const BANNER_CONTEXT_KEY = Symbol('banner');
export function setBannerContext(state: BannerState): BannerState;
export function hasBannerContext(): boolean;
export function getBannerContext(consumerName: string): BannerState;   // throws
```

Messages (FR-016, upstream `banner.tsx:72`, `97`):

- `` `<Banner.Close>` must be used within `<Banner.Root>`. ``
- `` `<Banner.Queue>` … `` for the queue getter, e.g.
  `` `<BannerControls>` must be used within `<Banner.Queue>`. ``

`hasBannersContext()` exists because `banner.svelte` reads the queue **optionally** (R-09).

## 6. Component-level shapes

### 6.1 `child`-snippet payloads

One per part that supports `child` (FR-018). Each is the exact object spread onto the default element,
so a `child` element is styled and instrumented identically — the pattern in `status.svelte` and
`masonry.svelte`.

| Type                       | Declared in                 | Fixed members                                                                        |
| -------------------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| `BannerChildProps`         | `banner.svelte`             | `data-slot: 'banner'`, `data-state: 'open'`, `data-variant`, `role`, `aria-live`, `class` |
| `BannerIconChildProps`     | `banner-icon.svelte`        | `data-slot: 'banner-icon'`, `class`                                                  |
| `BannerContentChildProps`  | `banner-content.svelte`     | `data-slot: 'banner-content'`, `class`                                                |
| `BannerActionsChildProps`  | `banner-actions.svelte`     | `data-slot: 'banner-actions'`, `class`                                                |

All four are `& Record<string, unknown>` so forwarded `restProps` stay spreadable.

### 6.2 Inline styles (exact, from upstream)

**Stack container** (`banner.tsx:276-279`):

```
height: <totalHeight > 0 ? `${totalHeight}px` : 'auto'>;
transition: height 400ms cubic-bezier(0.32, 0.72, 0, 1);
```

**Queued banner** (`banner.tsx:451-460`), `isTop = side === 'top'`:

```
position: absolute;
<isTop ? 'top' : 'bottom'>: 0;
left: 0;
right: 0;
z-index: <removing ? 0 : 50 - index>;
transform: <getTransform()>;
opacity: <mounted && !removing ? 1 : 0>;
transition: transform 400ms cubic-bezier(0.32, 0.72, 0, 1),
            opacity <removing ? 200 : 400>ms ease;
```

`getTransform()` (`banner.tsx:425-435`), with `o = removing ? frozenOffset : offset`:

| Condition   | `side="top"`                        | `side="bottom"`                      |
| ----------- | ----------------------------------- | ------------------------------------ |
| `!mounted`  | `translateY(-100%)`                 | `translateY(100%)`                   |
| `removing`  | `translateY(calc(${o}px - 100%))`   | `translateY(calc(-${o}px + 100%))`   |
| otherwise   | `translateY(${o}px)`                | `translateY(-${o}px)`                |

## 7. State transitions

### 7.1 Standalone banner (`open` is the single source of truth — R-01)

```
init ── open ??= defaultOpen (true) ──▶ open=true  ── render <div data-state="open">
open=true ── BannerClose click (dismissible && !disabled) ──▶ open=false + onOpenChange(false) ──▶ renders nothing
open=false ── caller sets open=true ──▶ open=true (re-shown)
open=true ── dismissible=false ──▶ close control disabled; click is inert, no callback
```

`onDismiss`, `priority` and `duration` are inert in this mode (R-18).

### 7.2 Registered banner (`<Banner>` inside `<Banner.Queue>`)

```
open=true + queue present ──▶ $effect: id = addBanner({ content: children, … })   [untracked]
prop change (variant/priority/dismissible/duration/children/open) ──▶ teardown removeBanner(id) ──▶ re-register
component destroyed ──▶ teardown removeBanner(id) ──▶ onDismiss() ──▶ onOpenChange(false)
```

The root renders nothing in this mode (upstream `banner.tsx:577`).

### 7.3 Queue entry lifecycle

```
addBanner ──▶ banners[k] (priority-ordered)
   │
   ├─ duration > 0 ──▶ setTimeout(duration) ──▶ setRemoving(id, true)
   │
   ▼
queued part mounts ──▶ rAF ──▶ mounted=true      (translateY(±100%) → translateY(offset))
   │                     └─ $effect.pre ──▶ setHeight(id, rect.height)  [untracked]
   │
close() / duration fires ──▶ removing ∋ id
   │  ├─ removeHeight(id)         (container height shrinks; later banners slide up)
   │  ├─ frozenOffset holds the last non-removing offset
   │  └─ setTimeout(400) ──▶ removeBanner(id)
   ▼
removeBanner ──▶ clearTimeout · removing ∌ id · onDismiss?.() · banners \ {id}
                 └─ the next queued banner enters visibleBanners and mounts
remove() ──▶ removeBanner(id) immediately (no exit animation)
clearBanners() ──▶ every timer cleared · removing=∅ · heights=∅ · banners=[] · no onDismiss
```

**Invariants**

1. `banners` is always sorted by non-increasing `priority ?? 0`; ties keep insertion order.
2. `removing ⊆ ids(banners)` and `keys(heights) ⊆ ids(banners)` — both are pruned by `removeBanner`
   and `clearBanners`.
3. Exactly one pending timeout per id at most; `removeBanner` and `clearBanners` clear it before
   dropping the entry, so no callback can fire for a removed banner (spec edge case).
4. `visibleBanners.length === min(banners.length, max(maxVisible, 0))`.
5. `offsetOf(firstVisible.id) === 0`, and each subsequent visible banner's offset is the running sum of
   its predecessors' measured heights — which is what keeps the stack gapless and non-overlapping.
