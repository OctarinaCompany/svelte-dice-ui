# Quickstart & Validation: Speed Dial

**Feature**: `016-port-speed-dial` | **Date**: 2026-07-30

How to use the component, and the runnable checks that prove the port is done. API details live in
[`contracts/public-api.md`](./contracts/public-api.md); internals in
[`data-model.md`](./data-model.md).

## Usage

```svelte
<script lang="ts">
	import CopyIcon from '@lucide/svelte/icons/copy';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Share2Icon from '@lucide/svelte/icons/share-2';
	import { toast } from 'svelte-sonner';

	import * as SpeedDial from '$lib/components/ui/speed-dial/index.js';
</script>

<SpeedDial.Root>
	<SpeedDial.Trigger
		class="transition-transform duration-200 ease-out data-[state=closed]:rotate-0 data-[state=open]:rotate-135"
	>
		<PlusIcon />
	</SpeedDial.Trigger>
	<SpeedDial.Content>
		<SpeedDial.Item>
			<SpeedDial.Label class="sr-only">Share</SpeedDial.Label>
			<SpeedDial.Action onSelect={() => toast.success('Shared')}><Share2Icon /></SpeedDial.Action>
		</SpeedDial.Item>
		<SpeedDial.Item>
			<SpeedDial.Label class="sr-only">Copy</SpeedDial.Label>
			<SpeedDial.Action onSelect={() => toast.success('Copied')}><CopyIcon /></SpeedDial.Action>
		</SpeedDial.Item>
	</SpeedDial.Content>
</SpeedDial.Root>
```

Two-way binding, hover activation, and a side:

```svelte
<script lang="ts">
	let open = $state(false);
</script>

<SpeedDial.Root bind:open side="right" activationMode="hover" delay={300}>…</SpeedDial.Root>
```

Fixed positioning goes on the **root**, never on the trigger — the content is `absolute` relative to
the root (`speed-dial.mdx:114-155`):

```svelte
<SpeedDial.Root class="fixed right-4 bottom-4">…</SpeedDial.Root>
```

## Prerequisites

```bash
pnpm install --frozen-lockfile
```

No new dependency is introduced (research R-15).

---

## Validation

### V-1 — Structure, distribution and anti-cheat (Principles V, VI)

```bash
# every source file exists and nothing imports the docs app
ls src/lib/components/ui/speed-dial
grep -rn "routes/\|components/docs" src/lib/components/ui/speed-dial   # expect: no matches

# every intra-repo import carries .js
grep -rn "from '\(\$lib\|\./\|\.\./\)" src/lib/components/ui/speed-dial | grep -v "\.js'" | grep -v "\.svelte'"

# suppressions and any
grep -rn "@ts-ignore\|@ts-expect-error\|eslint-disable\|svelte-ignore\|as any\|: any\|\.skip(\|\.todo(\|\.only(" \
  src/lib/components/ui/speed-dial src/routes/docs/components/speed-dial   # expect: no matches

# the registry entry lists all 9 non-test files and no test file
node -e "const r=require('./registry.json');const i=r.items.find(x=>x.name==='speed-dial');console.log(i.files.length, i.files.some(f=>f.path.includes('.test.')))"
# expect: 9 false
```

### V-2 — Collection and pure helpers (`data-model.md` §1–§2)

Unit-level, no component render:

- `getTransformOrigin` returns all four origins.
- `getOrientation('top'|'bottom') === 'vertical'`, `('left'|'right') === 'horizontal'`.
- `getItemDelay(i, n, true) === i*50` and `getItemDelay(i, n, false) === (n-i-1)*50`, including
  `n === 0` and `n === 1`.
- `getContentPosition` emits the documented declaration pair for each side and honours `offset`.
- `DomOrderedCollection` returns entries in document order after out-of-order registration, drops
  unregistered ids, and yields a stable `indexById`.

### V-3 — Ported upstream assertions (test:1-341, **all of them**)

| Upstream `describe`               | Ported assertion                                                             |
| --------------------------------- | ---------------------------------------------------------------------------- |
| Basic Rendering                   | trigger present; `aria-haspopup="menu"`; `aria-expanded="false"`               |
| Basic Rendering                   | trigger `data-state="closed"` when closed                                     |
| Basic Rendering                   | content **not** in the document when closed                                   |
| Open/Close Behavior               | click opens: `onOpenChange(true)`, `aria-expanded="true"`                      |
| Open/Close Behavior               | controlled: click reports `true`; rerender with `open` is authoritative        |
| Disabled State                    | `disabled` root → trigger `toBeDisabled()`                                     |
| Disabled State                    | `disabled` root → click fires no `onOpenChange`                                |
| ARIA Attributes                   | `role="button"`, `aria-haspopup`, `aria-expanded`, `aria-controls` present     |
| ARIA Attributes                   | `aria-expanded` flips to `"true"` on open                                      |
| O(n²) Performance                 | 50 items with `defaultOpen` render in < 1000 ms (SC-004)                       |
| Disabled State Updates            | rerendering `disabled: false → true` updates the trigger                       |
| Rapid Toggle                      | 3 clicks → `onOpenChange` called 3× with `true`, `false`, `true`               |
| Action Selection                  | `onSelect` + `preventDefault()` → `onOpenChange` never called with `false`     |
| Action Selection                  | `disabled` action is `toBeDisabled()` and never fires `onSelect`               |
| Side Variations                   | `data-side` equals the prop for all four sides (`it.each` → four cases)        |
| Side Variations                   | `aria-orientation="vertical"` for `top`, `"horizontal"` for `left`             |
| ForceMount                        | `forceMount` keeps the content in the DOM while `open={false}`                 |

### V-4 — Keyboard and focus (Principle III, FR-008, US2)

- `Enter` and `Space` on the trigger open it (native button activation).
- `Escape` closes **and** moves focus back to the trigger (research R-07), from the trigger and from
  an action.
- `onEscapeKeyDown` + `preventDefault()` keeps it open.
- `Tab` while the last enabled action has focus closes it; focus lands on the sibling after the root.
- `Shift+Tab` while the **trigger** has focus closes it; from the first action it does **not** close
  (focus moves to the trigger first) — the two-step sequence of research R-06.
- A disabled action is never the first/last boundary: with the last action disabled, `Tab` on the
  previous one closes.
- With zero items, `Tab`/`Escape` do not throw.

### V-5 — Pointer, hover and dismissal

- Outside `click` closes; `onInteractOutside` fires with `detail.originalEvent`, and
  `preventDefault()` keeps it open.
- A click on the trigger does **not** trigger outside dismissal (capture guard, research R-05).
- A `pointerdown` with `pointerType: 'touch'` outside does not close until the following `click`.
- `activationMode="hover"`: `user.hover(trigger)` opens only after `delay` ms; `user.unhover` closes
  after 100 ms; moving into the content within that window cancels the close.
- `activationMode="click"`: hovering never opens.
- `disabled` suppresses both hover and click.

### V-6 — State, presence and animation

- Uncontrolled `defaultOpen` renders the content immediately.
- `bind:open` propagates both ways (harness).
- Closing keeps the content mounted for `(n-1)*50 + 200` ms and then removes it; with `forceMount`
  it stays and only `data-state` changes.
- Content `data-state` becomes `"open"` one animation frame after opening.
- `--speed-dial-gap` / `--speed-dial-offset` / `--speed-dial-transform-origin` are on the content
  and honour `gap`/`offset`; `--speed-dial-delay` on item *i* is `i*50` ms while opening and
  `(n-i-1)*50` ms while closing.
- The caller's `style` overrides a component-set custom property.

### V-7 — Composition, ARIA wiring and guard rails

- `role="menu"` + `aria-orientation` on the content, `role="menuitem"` on every action,
  `role="none"` on the item.
- Each action's `aria-labelledby` resolves to its sibling label's `id`, and the accessible name is
  the label text whether or not the label is `sr-only` (FR-012).
- Every part carries its `data-slot`; the caller's `class` wins over the defaults.
- Each of the six `child` snippets renders the caller's element with the merged props (harness).
- `data-disabled` is absent unless `disabled`.
- Rendering `Trigger` / `Content` / `Item` outside `Root`, or `Action` / `Label` outside `Item`,
  throws `/within/` (FR-020); an `Item` **inside `Root` but outside `Content`** renders without
  throwing (research R-10).

### V-8 — RTL (FR-017, SC-006)

Inside `dir="rtl"`: `data-side` is unchanged for all four sides, the content still carries the
matching `aria-orientation`, and the Tab-exit sequence behaves identically (`side` is absolute —
there is no mirroring upstream and none is added).

### V-9 — Demo route (Principle IX)

`src/routes/docs/components/speed-dial/+page.svelte` renders five `<ComponentPreview>` sections —
Default, With Labels, Hover Mode, Controlled State, Sides — one per
`.reference/diceui/docs/registry/bases/radix/examples/speed-dial-*-demo.tsx`, plus the MDX's
fixed-positioning note and the props / data-attribute / CSS-variable / keyboard tables. Verified by
`pnpm run build` (every route is prerendered) and by eye via the docs sidebar entry.

### V-10 — Quality gates (Principle VII)

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
pnpm run registry:build
```

All green, with no suppression of any kind.
