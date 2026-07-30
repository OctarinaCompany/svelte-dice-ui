# Public API Contract: Banner

**Feature**: `014-port-banner` | **Date**: 2026-07-30

This is the installable surface of `src/lib/components/ui/banner/`: what a consumer gets after
`shadcn-svelte add banner`. It is authoritative — the props tables on the demo route, the JSDoc in the
source, and the test assertions must all agree with it.

Import styles, both supported by the barrel:

```ts
import * as Banner from '$lib/components/ui/banner/index.js'; // Banner.Root, Banner.Queue, Banner.Close
import { Banner, Banners, BannerClose } from '$lib/components/ui/banner/index.js';
```

Upstream counterpart: `.reference/diceui/docs/registry/bases/radix/ui/banner.tsx` @
`d9763d82530416dfa4c81c462387b55d06bae4ec`. Documented API:
`.reference/diceui/docs/types/radix/banner.ts`.

---

## 1. `Banner` / `Banner.Root` — `banner.svelte`

An individual banner. Usable standalone, or inside `Banner.Queue`, where it registers its `children`
with the queue and renders nothing itself.

### Props

`WithElementRef<HTMLAttributes<HTMLDivElement>>` plus:

| Prop           | Type                                    | Default     | Bindable | Upstream        |
| -------------- | --------------------------------------- | ----------- | -------- | --------------- |
| `ref`          | `HTMLDivElement \| null`                | `null`      | **yes**  | `forwardRef`    |
| `open`         | `boolean \| undefined`                  | `undefined` | **yes**  | `open`          |
| `defaultOpen`  | `boolean`                               | `true`      | no       | `defaultOpen`   |
| `onOpenChange` | `((open: boolean) => void)?`            | `undefined` | no       | `onOpenChange`  |
| `onDismiss`    | `(() => void)?`                         | `undefined` | no       | `onDismiss`     |
| `variant`      | `BannerVariant`                         | `'default'` | no       | `variant`       |
| `priority`     | `number \| undefined`                   | `undefined` | no       | `priority`      |
| `duration`     | `number \| undefined`                   | `undefined` | no       | `duration`      |
| `dismissible`  | `boolean`                               | `true`      | no       | `dismissible`   |
| `child`        | `Snippet<[{ props: BannerChildProps }]>` | `undefined` | no       | `asChild`       |
| `children`     | `Snippet`                               | `undefined` | no       | `children`      |
| `class`, and the rest of `HTMLAttributes<HTMLDivElement>` | — | — | no | `...rootProps` |

**Mode-dependent props.** `priority`, `duration` and `onDismiss` are read **only** when the banner is
inside `Banner.Queue`. A standalone banner with `duration={3000}` does not auto-dismiss, and its
`onDismiss` never fires — upstream behaviour, see [research.md](../research.md) R-18. Their JSDoc says so.

**Controlled / uncontrolled.** `open ??= defaultOpen` seeds the uncontrolled case once; after that
`open` is the only render source. Closing writes `open = false` **and** calls `onOpenChange(false)`, so
the callback fires in both modes. See §8 and R-01 for the one place this differs from React.

### Snippets

| Snippet    | Rendered                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------- |
| `children` | Standalone: inside the root `<div>`. Queued: by `Banner.Queue`, as the queue entry's content. |
| `child`    | Instead of the root `<div>`; receives `{ props }` to spread. Ignored in queued mode (the root renders nothing) and when `open` is false. In `child` mode `children` is not rendered and `ref` stays `null`. |

### Callbacks

`onOpenChange(false)` on close (both modes); `onDismiss()` on queue dismissal only. Native handlers
(`onclick`, `onkeydown`, …) pass through `restProps` onto the root element.

### Data attributes

| Attribute       | Values                        | Notes                                          |
| --------------- | ----------------------------- | ---------------------------------------------- |
| `data-slot`     | `banner`                      | always                                         |
| `data-state`    | `open`                        | present only while rendered (upstream, 586)     |
| `data-variant`  | `BannerVariant`               | **added**; upstream exposes the variant only through classes |
| `role`          | `status`                      | live region (FR-019)                            |
| `aria-live`     | `polite`                      | live region (FR-019)                            |

### Errors

None thrown. A standalone `Banner` outside any queue is valid and is the primary use.

---

## 2. `Banner.Queue` / `Banners` — `banner-queue.svelte`

The queue provider. Wrap a section of the app; banners are added imperatively through
`getBannersContext()`, and any `Banner` inside auto-registers.

### Props

| Prop         | Type                          | Default     | Bindable | Upstream     |
| ------------ | ----------------------------- | ----------- | -------- | ------------ |
| `maxVisible` | `number`                      | `1`         | no       | `maxVisible` |
| `side`       | `BannerSide`                  | `'top'`     | no       | `side`       |
| `strategy`   | `BannerStrategy`              | `'fixed'`   | no       | `strategy`   |
| `container`  | `Element \| string \| null`   | `undefined` | no       | `container`  |
| `children`   | `Snippet`                     | `undefined` | no       | `children`   |

`container` is only consulted for `strategy="fixed"` and `strategy="absolute"`, which portal through
the `bits-ui` `Portal` (default target `document.body`). It accepts a CSS selector in addition to an
`Element`, and does **not** accept a `DocumentFragment` — R-06.

The provider renders **no props of its own onto a DOM element**: it has no `ref`, no `class` and no
`restProps`, exactly like upstream's `BannersProps`.

### Layout

| `strategy`         | Where the stack renders                                              | Container classes                      |
| ------------------ | -------------------------------------------------------------------- | -------------------------------------- |
| `fixed` *(default)* | portalled to `container ?? document.body`                            | `fixed` + `top-0` / `bottom-0`         |
| `absolute`         | portalled; the target needs `position: relative`                     | `absolute` + `top-0` / `bottom-0`      |
| `static`           | inline, before `children` (`side="top"`) or after (`side="bottom"`)  | `relative` + `top-0` / `bottom-0`      |
| `sticky`           | inline, same placement as `static`                                   | `sticky` + `top-0` / `bottom-0`        |

The container is omitted entirely when no banner is visible (spec edge case: zero banners take no space).

### Data attributes (stack container)

| Attribute       | Values                                    |
| --------------- | ----------------------------------------- |
| `data-slot`     | `banner-container`                        |
| `data-side`     | `top` \| `bottom`                         |
| `data-strategy` | `fixed` \| `static` \| `sticky` \| `absolute` |

### Data attributes (each stacked banner — internal `banner-queued.svelte`)

| Attribute      | Values                     | Notes                                    |
| -------------- | -------------------------- | ---------------------------------------- |
| `data-slot`    | `queued-banner`            | upstream's slot name, kept                |
| `data-state`   | `open` \| `closed`         | `closed` while animating out              |
| `data-mounted` | `true` \| `false`          | upstream writes the boolean, not `''`     |
| `data-removed` | `true` \| `false`          | upstream writes the boolean, not `''`     |
| `data-side`    | `top` \| `bottom`          |                                           |
| `data-front`   | `true` \| `false`          | `index === 0`                             |
| `data-index`   | `number`                   | position within `visibleBanners`          |
| `data-variant` | `BannerVariant`            | **added**, for parity with `Banner.Root`   |

`data-mounted` / `data-removed` / `data-front` keep upstream's `true`/`false` string values rather than
the `'' | undefined` convention of Principle VIII, because they are documented, upstream-observable
values and `data-[removed=true]:` selectors written against the React component must keep working.
`data-state` carries the same information in the shape Principle VIII expects.

---

## 3. Content parts

All five take `WithElementRef<HTMLAttributes<HTMLDivElement>>` + `children`, merge the caller's `class`
last through `cn()`, and spread `restProps` onto their element. None throws; none requires a provider.

| Component                              | File                        | `data-slot`          | Classes (upstream verbatim)                        | `child` |
| -------------------------------------- | --------------------------- | -------------------- | -------------------------------------------------- | ------- |
| `Banner.Icon` / `BannerIcon`           | `banner-icon.svelte`        | `banner-icon`        | `flex shrink-0 items-center [&>svg]:size-4`        | **yes** |
| `Banner.Content` / `BannerContent`     | `banner-content.svelte`     | `banner-content`     | `flex min-w-0 flex-1 flex-col gap-1`               | **yes** |
| `Banner.Title` / `BannerTitle`         | `banner-title.svelte`       | `banner-title`       | `text-sm font-medium leading-none`                 | no      |
| `Banner.Description` / `BannerDescription` | `banner-description.svelte` | `banner-description` | `text-xs opacity-90`                           | no      |
| `Banner.Actions` / `BannerActions`     | `banner-actions.svelte`     | `banner-actions`     | `flex items-center gap-2`                          | **yes** |

`Title` and `Description` have no `child` because upstream gives them no `asChild`
(`docs/types/radix/banner.ts:120-122`).

---

## 4. `Banner.Close` / `BannerClose` — `banner-close.svelte`

Composes `$lib/components/ui/button` with `variant="ghost"` and `size="icon-sm"`.

### Props

`ButtonProps` (i.e. `WithElementRef<HTMLButtonAttributes> & WithElementRef<HTMLAnchorAttributes> &
{ variant?, size? }`), unchanged. Notable behaviour:

| Prop       | Effect                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `disabled` | `isDisabled = disabled ?? !dismissible` — an explicit `disabled` wins over the banner's `dismissible`. |
| `onclick`  | Composed: the caller's handler runs first; if it calls `preventDefault()`, or the button is disabled, the banner is not closed. |
| `children` | Replaces the default `<XIcon />`.                                                                    |
| `variant` / `size` | Overridable; the defaults are applied before `restProps`.                                    |

Upstream types this as `Omit<ComponentProps<typeof Button>, keyof ComponentProps<'button'>>` — an
artifact of its docs type generator. The port exposes the full `ButtonProps`, which is what the React
component actually accepts.

The default icon renders with **no** sizing class; `Button` sizes it. Upstream writes
`className="size-3.5"` — R-15.

### Data attributes

`data-slot="banner-close"`, plus `data-slot="button"`'s own attributes from the composed `Button`.

### Errors

Rendered outside a `Banner.Root` (or a queued banner):

```
`<Banner.Close>` must be used within `<Banner.Root>`.
```

---

## 5. Runes module — `banner.svelte.ts`

Exported for composition and for the ports that follow.

| Export                                                                | Kind      | Replaces                       |
| --------------------------------------------------------------------- | --------- | ------------------------------ |
| `BANNER_ANIMATION_DURATION`, `BANNER_ANIMATION_EASING`                | const     | `BANNER_ANIMATION_DURATION`    |
| `DEFAULT_BANNER_PRIORITY`, `DEFAULT_BANNER_DISMISSIBLE`, `DEFAULT_MAX_VISIBLE` | const | same-named upstream consts |
| `BANNER_VARIANTS`, `BANNER_SIDES`, `BANNER_STRATEGIES`                | const     | the three string unions        |
| `BannerVariant`, `BannerSide`, `BannerStrategy`                       | type      | same                           |
| `bannerVariants`                                                      | `tv()`    | `bannerVariants` (`cva`)       |
| `resolveBannerVariant`, `isPortalStrategy`                            | function  | inline expressions             |
| `BannerRenderProps`, `BannerAddOptions`, `QueuedBanner`               | type      | `BannerRenderProps`, `BannerAddOptions`, `BannerData` |
| `BannersState`, `BannersStateProps`                                   | class     | `Store` + `useBanners()`       |
| `BannerState`, `BannerStateProps`                                     | class     | `BannerContextValue` + `useBanner()` |
| `setBannersContext`, `hasBannersContext`, `getBannersContext`         | function  | `StoreContext` + `useStoreContext` |
| `setBannerContext`, `hasBannerContext`, `getBannerContext`            | function  | `BannerContext` + `useBannerContext` |

### `useBanners()` → `getBannersContext()`

```svelte
<script lang="ts">
	import { getBannersContext } from '$lib/components/ui/banner/index.js';

	const queue = getBannersContext('<BannerControls>');
</script>

{#snippet info({ onClose }: BannerRenderProps)}
	<Banner.Icon><InfoIcon /></Banner.Icon>
	<Banner.Content>
		<Banner.Title>Information</Banner.Title>
		<Banner.Description>This is an informational message.</Banner.Description>
	</Banner.Content>
	<Banner.Actions>
		<Button size="sm" variant="ghost" onclick={onClose}>Skip</Button>
	</Banner.Actions>
{/snippet}

<Button onclick={() => queue.addBanner({ variant: 'info', content: info })}>Add Info</Button>
<p>{queue.banners.length} in queue</p>
```

| Upstream            | Here                            |
| ------------------- | ------------------------------- |
| `onBannerAdd(o)`    | `queue.addBanner(o): string`    |
| `onBannerRemove(id)`| `queue.removeBanner(id)`        |
| `onBannersClear()`  | `queue.clearBanners()`          |
| `banners`           | `queue.banners` (readonly)      |
| —                   | `queue.visibleBanners`, `queue.totalHeight` (were local to the provider upstream) |

### `useBanner()` → `getBannerContext()`

| Upstream      | Here                       |
| ------------- | -------------------------- |
| `id`          | `banner.id`                |
| `variant`     | `banner.variant`           |
| `dismissible` | `banner.dismissible`       |
| `onClose`     | `banner.close()`           |
| `onRemove`    | `banner.remove()` (no-op when standalone; upstream returns `undefined`) |

---

## 6. `bannerVariants` — exact class rows

```ts
base: 'pointer-events-auto relative flex w-full items-center gap-3 border-b px-4 py-3 text-sm motion-reduce:transition-none'
```

| `variant`     | Classes                              |
| ------------- | ------------------------------------ |
| `default`     | `bg-card text-card-foreground`       |
| `info`        | `bg-info/10 text-info`               |
| `success`     | `bg-success/10 text-success`         |
| `warning`     | `bg-warning/10 text-warning`         |
| `destructive` | `bg-destructive/10 text-destructive` |

`defaultVariants: { variant: 'default' }`. Stack container classes:

```
pointer-events-none right-0 left-0 isolate z-50
+ fixed | relative | sticky | absolute        (per strategy)
+ top-0 | bottom-0                            (per side)
```

---

## 7. Barrel — `index.ts`

```ts
import Root from './banner.svelte';
import Queue from './banner-queue.svelte';
import Icon from './banner-icon.svelte';
import Content from './banner-content.svelte';
import Title from './banner-title.svelte';
import Description from './banner-description.svelte';
import Actions from './banner-actions.svelte';
import Close from './banner-close.svelte';

export type { BannerChildProps, BannerProps, BannerRootProps } from './banner.svelte';
export type { BannerQueueProps, BannersProps } from './banner-queue.svelte';
export type { BannerIconChildProps, BannerIconProps } from './banner-icon.svelte';
export type { BannerContentChildProps, BannerContentProps } from './banner-content.svelte';
export type { BannerTitleProps } from './banner-title.svelte';
export type { BannerDescriptionProps } from './banner-description.svelte';
export type { BannerActionsChildProps, BannerActionsProps } from './banner-actions.svelte';
export type { BannerCloseProps } from './banner-close.svelte';

export {
	BANNER_ANIMATION_DURATION,
	BANNER_ANIMATION_EASING,
	BANNER_SIDES,
	BANNER_STRATEGIES,
	BANNER_VARIANTS,
	BannerState,
	BannersState,
	DEFAULT_BANNER_DISMISSIBLE,
	DEFAULT_BANNER_PRIORITY,
	DEFAULT_MAX_VISIBLE,
	bannerVariants,
	getBannerContext,
	getBannersContext,
	hasBannerContext,
	hasBannersContext,
	isPortalStrategy,
	resolveBannerVariant,
	setBannerContext,
	setBannersContext,
	type BannerAddOptions,
	type BannerRenderProps,
	type BannerSide,
	type BannerStateProps,
	type BannerStrategy,
	type BannerVariant,
	type BannersStateProps,
	type QueuedBanner
} from './banner.svelte.js';

export {
	Root,
	Queue,
	Icon,
	Content,
	Title,
	Description,
	Actions,
	Close,
	//
	Root as Banner,
	Queue as Banners,
	Icon as BannerIcon,
	Content as BannerContent,
	Title as BannerTitle,
	Description as BannerDescription,
	Actions as BannerActions,
	Close as BannerClose
};
```

`banner-queued.svelte` is **not** exported: it is the internal stacked-banner renderer, matching
upstream's export list (`banner.tsx:694-705`), which omits `BannerImpl`.

`Queue as Banners` is how the upstream name survives. In namespace style the provider is
`<Banner.Queue>`, because `<Banner.Banners>` would be nonsense; the file is therefore
`banner-queue.svelte`, which also satisfies Principle V's `<slug>-<part>.svelte` rule.

---

## 8. The controlled/uncontrolled convention (the pattern later ports copy)

This component defines the project's convention. It is a documented idiom, not a shared helper module —
R-16 explains why.

```svelte
<script lang="ts">
	let { open = $bindable(), defaultOpen = true, onOpenChange }: Props = $props();

	// Uncontrolled: seed once from `defaultOpen`. Controlled: the caller's binding wins.
	open ??= defaultOpen;

	function setOpen(next: boolean) {
		open = next;
		onOpenChange?.(next);
	}
</script>
```

Four rules for every value-bearing prop in this repository:

1. The value prop is `$bindable()` with **no** fallback argument; the `default*` sibling seeds it once
   with `??=`. Never seed inside an `$effect` — that would re-seed on every `default*` change.
2. The state prop is the **only** render source. No parallel internal `$state`, no `isControlled` flag.
3. The change callback fires in **both** modes, always with the next value, always after the write.
4. Tests must cover both modes plus the re-open path (`contracts` ⇒ `quickstart.md` V-3).

**The one divergence from React.** A consumer who passes `open={x}` *without* `bind:` and whose
`onOpenChange` does not update `x` gets a banner that closes anyway, because Svelte gives a written-to
unbound `$bindable` prop a local override. React would keep it open. `bind:open`, and
`open={x}` + `onOpenChange={(v) => (x = v)}`, both behave exactly as React does. See R-01.

---

## 9. Registry contract

```jsonc
{
	"name": "banner",
	"type": "registry:ui",
	"title": "Banner",
	"description": "A notification banner that appears at the top or bottom of the viewport. Supports queuing, priority, and auto-dismiss.",
	"registryDependencies": ["button"],
	"dependencies": ["tailwind-variants", "@lucide/svelte", "bits-ui"],
	"files": [
		{ "path": "src/lib/components/ui/banner/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/banner/banner.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/banner/banner-queue.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/banner/banner-queued.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/banner/banner-icon.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/banner/banner-content.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/banner/banner-title.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/banner/banner-description.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/banner/banner-actions.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/banner/banner-close.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/banner/banner.svelte.ts", "type": "registry:ui" }
	]
}
```

Eleven files — every file in the folder except `banner.test.ts` and `banner.test.svelte`. The
`description` is upstream's MDX front-matter description verbatim. `name` = folder slug = demo route
segment = `banner`. Run `pnpm run registry:build` after appending; output lands in `static/r/`.
