# Quickstart & Validation: Banner

**Feature**: `014-port-banner` | **Date**: 2026-07-30

Prove the port works end to end. Every command here is non-interactive and terminates.

- Public surface: [`contracts/public-api.md`](./contracts/public-api.md)
- Shapes and state machine: [`data-model.md`](./data-model.md)
- Decisions: [`research.md`](./research.md)

## Prerequisites

```bash
pnpm install            # already satisfied; the port installs nothing new (research R-14)
node -e "process.exit(0)"
```

Files that must exist before validation starts (11 source + 2 test + 1 route + 1 registry edit):

```text
src/lib/components/ui/banner/{index.ts,banner.svelte.ts,banner.svelte,banner-queue.svelte,
  banner-queued.svelte,banner-icon.svelte,banner-content.svelte,banner-title.svelte,
  banner-description.svelte,banner-actions.svelte,banner-close.svelte,
  banner.test.svelte,banner.test.ts}
src/routes/docs/components/banner/+page.svelte
registry.json                     # one appended registry:ui entry
```

## Usage

### Standalone, uncontrolled

```svelte
<script lang="ts">
	import * as Banner from '$lib/components/ui/banner/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import InfoIcon from '@lucide/svelte/icons/info';
</script>

<Banner.Root variant="info" onOpenChange={(open) => console.log('open:', open)}>
	<Banner.Icon><InfoIcon /></Banner.Icon>
	<Banner.Content>
		<Banner.Title>New update available</Banner.Title>
		<Banner.Description>Update now to get the latest features.</Banner.Description>
	</Banner.Content>
	<Banner.Actions>
		<Button size="sm">Update now</Button>
		<Banner.Close />
	</Banner.Actions>
</Banner.Root>
```

### Standalone, controlled (`bind:open`) — mirrors `banner-demo.tsx`

```svelte
<script lang="ts">
	let open = $state(true);
</script>

<Banner.Root bind:open>…</Banner.Root>
{#if !open}
	<Button onclick={() => (open = true)}>Show banner</Button>
{/if}
```

### Queued — mirrors `banner-stacked-demo.tsx`

```svelte
<Banner.Queue maxVisible={3} side="top" strategy="static">
	<BannerControls />
</Banner.Queue>
```

`BannerControls` reads the queue with `getBannersContext('<BannerControls>')` and calls
`queue.addBanner({ variant, priority, duration, content })` with a snippet — see
`contracts/public-api.md` §5.

## Validation scenarios

### V-1 — Quality gates (Principle VII)

Run in this order, from the repository root. All five must be green with no suppression.

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

Anti-cheat grep — every one of these must print nothing:

```bash
grep -rn "@ts-ignore\|@ts-expect-error\|eslint-disable\|svelte-ignore" src/lib/components/ui/banner src/routes/docs/components/banner
grep -rn ": any\|as any\|<any>" src/lib/components/ui/banner src/routes/docs/components/banner
grep -rn "it\.skip\|it\.todo\|describe\.skip\|\.only" src/lib/components/ui/banner
git diff --name-only -- tsconfig.json eslint.config.js vite.config.ts .prettierrc
```

Styling-discipline greps — also empty:

```bash
# no raw palette colours, no manual dark:, no space-x/y
grep -rnE "(bg|text|border)-(red|green|blue|yellow|orange|gray|slate|zinc)-[0-9]" src/lib/components/ui/banner
grep -rn "dark:" src/lib/components/ui/banner
grep -rn "space-x-\|space-y-" src/lib/components/ui/banner
```

### V-2 — Controlled / uncontrolled parity (US1, FR-002, SC-001, contract §8)

```bash
pnpm run test:unit -- --run src/lib/components/ui/banner/banner.test.ts
```

Must assert:

| # | Assertion                                                                                      |
| - | ---------------------------------------------------------------------------------------------- |
| 1 | No `open` prop ⇒ visible on first render (`data-state="open"`).                                 |
| 2 | Uncontrolled close ⇒ banner leaves the DOM **and** `onOpenChange` called once with `false`.      |
| 3 | `bind:open` close ⇒ the parent's value becomes `false`, banner leaves the DOM, callback fires.   |
| 4 | `open={false}` ⇒ nothing rendered; flipping the parent's value to `true` ⇒ rendered again.       |
| 5 | The visible result and the callback payload are identical in cases 2 and 3 (SC-001).            |
| 6 | `dismissible={false}` ⇒ the close button is `disabled`; clicking it changes nothing and fires no callback (FR-003). |
| 7 | An explicit `disabled` on `Banner.Close` beats `dismissible` (contract §4).                      |
| 8 | A caller `onclick` calling `preventDefault()` suppresses the close.                              |
| 9 | Standalone `onDismiss` never fires, and standalone `duration` never auto-dismisses (R-18).       |

### V-3 — Queue ordering, cap and lifecycle (US2, FR-005…FR-013, SC-002, SC-003, SC-004)

Same command; separate `describe` blocks. Fake timers plus a `getBoundingClientRect` stub, per R-17.

| # | Assertion                                                                                                 |
| - | --------------------------------------------------------------------------------------------------------- |
| 1 | Add priorities 0, 10, 5 in that order ⇒ `queue.banners` is `[10, 5, 0]` (FR-006).                          |
| 2 | Two adds with equal/unspecified priority ⇒ insertion order preserved (spec edge case).                     |
| 3 | `maxVisible={1}` + 3 queued ⇒ exactly one `[data-slot="queued-banner"]`; dismissing reveals the next (FR-007). |
| 4 | `maxVisible={3}` + 2 queued ⇒ both visible, no placeholder (spec edge case).                                |
| 5 | Close a stacked banner ⇒ `data-state="closed"` immediately, still mounted; after 400 ms it is gone and the survivor's `translateY` offset has decreased (FR-009, SC-004). |
| 6 | `duration: 50` ⇒ auto-dismisses after 50 ms + 400 ms and calls `onDismiss` (FR-008, SC-003).                |
| 7 | No `duration` ⇒ still present after `vi.advanceTimersByTime(10_000)`.                                       |
| 8 | `dismissible: false` + `duration` ⇒ still auto-dismisses (spec edge case).                                   |
| 9 | `clearBanners()` ⇒ empty queue, container gone, **no** `onDismiss` call, and advancing timers fires nothing (FR-012, spec edge case). |
| 10 | `removeBanner(id)` mid-exit-animation ⇒ no error, no stray `[data-slot="queued-banner"]` (spec edge case).  |
| 11 | `content` snippet receiving `{ onClose }` ⇒ a custom button calling it dismisses exactly like `Banner.Close` (FR-013). |
| 12 | A `Banner` inside `Banner.Queue` renders no `[data-slot="banner"]` of its own but adds one queue entry whose content is its `children` (R-04). |
| 13 | Destroying that `Banner` removes its entry and fires `onDismiss` → `onOpenChange(false)`.                    |

### V-4 — Positioning, variants, accessibility, guard rails (US3, FR-004, FR-010…FR-020)

| # | Assertion                                                                                                    |
| - | ------------------------------------------------------------------------------------------------------------ |
| 1 | Each of the five variants applies exactly the class row in contract §6, and `data-variant` matches (FR-004).   |
| 2 | `side="bottom"` ⇒ container `data-side="bottom"` + `bottom-0`; queued transform uses the negative form (FR-010). |
| 3 | Each strategy ⇒ the class and `data-strategy` from contract §2; `static`/`sticky` render inline (in `children` order for the side), `fixed`/`absolute` render under `document.body` (FR-011). |
| 4 | Zero banners ⇒ no `[data-slot="banner-container"]` anywhere (spec edge case).                                  |
| 5 | Both the standalone and the queued banner expose `role="status"` and `aria-live="polite"`; opening one does not move `document.activeElement` (FR-019). |
| 6 | `Banner.Close` is reachable by `Tab` after an action button, and both `Enter` and `Space` activate it (MDX keyboard table). |
| 7 | Markup under `dir="rtl"` equals markup under `dir="ltr"`; no part's class list contains `ml-*`/`mr-*`/`pl-*`/`pr-*`/`left-*`/`right-*`/`text-left`/`text-right` (excluding the container's symmetric `right-0 left-0`); DOM order is icon → content → actions → close (FR-020, SC-005, R-13). |
| 8 | Every part carries its `data-slot` from contract §3 (FR-017).                                                  |
| 9 | `bind:ref` on Root/Icon/Content/Title/Description/Actions/Close binds the element carrying that `data-slot`; in `child` mode the root's `ref` stays `null`. |
| 10 | `child` on Root/Icon/Content/Actions renders the caller's element with the same classes and data attributes (FR-018). |
| 11 | Rendering `Banner.Close` with no ancestor throws ``/`<Banner.Close>` must be used within `<Banner.Root>`\./`` (FR-016, SC-008). |
| 12 | `getBannersContext('<X>')` outside a `Banner.Queue` throws a message naming both `<X>` and `<Banner.Queue>`.    |

### V-5 — Demo route (Principle IX, SC-006)

```bash
pnpm run build            # every route prerenders, including /docs/components/banner
```

Then confirm by inspection of `src/routes/docs/components/banner/+page.svelte`:

- one `<ComponentPreview>` per upstream demo — **Default** (`banner-demo.tsx`) and **Stacked Banners**
  (`banner-stacked-demo.tsx`) — each naming its upstream file in the description;
- plus **Uncontrolled** and **Variants** sections, and API-reference tables for props, data attributes
  and the thrown errors;
- state held in the page with runes; no `+page.ts`;
- no import from `src/lib/components/docs/**` inside `src/lib/components/ui/banner/**` (Principle V):

```bash
grep -rn "components/docs\|routes/" src/lib/components/ui/banner    # must print nothing
```

### V-6 — Registry (Principle V, SC-007)

```bash
pnpm run registry:build
node -e "const r=require('./registry.json'); const i=r.items.find(x=>x.name==='banner'); if(!i) throw new Error('missing banner entry'); if(i.type!=='registry:ui') throw new Error('wrong type'); console.log(i.files.length + ' files');"
```

Expect `11 files`, and every listed path must exist while no test file is listed:

```bash
node -e "const fs=require('fs');const r=require('./registry.json');const i=r.items.find(x=>x.name==='banner');for(const f of i.files){if(!fs.existsSync(f.path))throw new Error('missing '+f.path);if(/\.test\./.test(f.path))throw new Error('test file listed: '+f.path);}console.log('ok');"
ls static/r/banner.json
```

The docs index at `/docs/components` and the sidebar must both list Banner, which follows from
`type: "registry:ui"` plus the matching route segment (`src/lib/registry.ts`).
