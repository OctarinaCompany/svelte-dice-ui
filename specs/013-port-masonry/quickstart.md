# Quickstart & Validation: Masonry

**Feature**: `013-port-masonry` | **Date**: 2026-07-30

How to run and prove the Masonry port. API details live in
[`contracts/public-api.md`](./contracts/public-api.md); internals in
[`data-model.md`](./data-model.md).

---

## Prerequisites

```bash
pnpm install --frozen-lockfile
```

No new npm dependencies (research R-12). `direction-provider` is already in the repo.

---

## Usage

```svelte
<script lang="ts">
	import * as Masonry from '$lib/components/ui/masonry/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';

	const tricks = [
		{ id: '1', title: 'The 900', description: 'Spin 900 degrees in the air.' },
		{ id: '2', title: 'Indy Backflip', description: 'Backflip while grabbing the board.' }
	];
</script>

<Masonry.Root columnCount={3} gap={12} fallback={loading}>
	{#each tricks as trick (trick.id)}
		<Masonry.Item class="rounded-md border bg-card p-4 text-card-foreground shadow-xs">
			<div class="text-sm font-medium">{trick.title}</div>
			<span class="text-sm text-muted-foreground">{trick.description}</span>
		</Masonry.Item>
	{/each}
</Masonry.Root>

{#snippet loading()}
	<Skeleton class="h-72 w-full" />
{/snippet}
```

Rendering onto your own element (upstream's `asChild`):

```svelte
<Masonry.Item>
	{#snippet child({ props })}
		<article {...props}>…</article>
	{/snippet}
</Masonry.Item>
```

---

## Validation scenarios

### V-1 — Quality gates (Principle VII)

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

**Expected**: all five exit `0`; `check` reports zero errors and zero warnings; no test skipped,
`.todo`'d, or `.only`'d; no suppression comment anywhere in the diff.

Grep the diff to confirm the anti-cheat rule:

```bash
git diff --stat
git grep -nE "@ts-(ignore|expect-error)|eslint-disable|svelte-ignore|as any|\\.(skip|todo|only)\\(" -- src/lib/components/ui/masonry src/routes/docs/components/masonry
```

**Expected**: no output.

### V-2 — Layout parity, no DOM required (SC-001, FR-001/FR-010)

```bash
pnpm run test:unit -- --run src/lib/components/ui/masonry/masonry-positioner.test.ts
```

`masonry-positioner.test.ts` feeds height sequences straight into `createPositioner` and asserts
`{ top, left, columnIndex }` per index against values computed by hand from
[`contracts/public-api.md` §5](./contracts/public-api.md#5-layout-algorithm-contract-sc-001).

**Expected**, among others:

| Case                                              | Assertion                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `width:620, columnWidth:200, gap:0`               | `columnCount === 3`, `columnWidth === 206`                          |
| six items, default algorithm                      | every item lands in the then-shortest column; ties take lowest index |
| `linear`, 4 columns, equal heights                | column indices `0,1,2,3,0,1`                                        |
| `linear`, one column ≫ others                     | the item falls back to the shortest column past the 2.5× threshold  |
| `columnCount:3` with room for 5                   | `columnCount === 3` (explicit wins)                                 |
| `columnCount:3, maxColumnCount:2`                 | `columnCount === 3` (`maxColumnCount` inert)                        |
| `width:100, columnWidth:200`                      | `columnCount === 1` (never 0)                                       |
| `gap:{column:16,row:24}`                          | horizontal step uses 16, vertical step uses 24                      |
| `update([1, 400])`                                | items after index 1 in that column shift down by the delta          |

### V-3 — Component behaviour (all remaining FRs)

```bash
pnpm run test:unit -- --run src/lib/components/ui/masonry/masonry.test.ts
```

Runs against `masonry.test.svelte`, with `offsetWidth`/`offsetHeight`,
`documentElement.client{Width,Height}`, `ResizeObserver` and `requestAnimationFrame` stubbed per-suite
and restored in `afterEach` (research R-09). Covers:

- rendering + `data-slot` on both parts, and every prop from the contract table;
- explicit `columnCount` vs. width-derived count (the controlled/uncontrolled analogue — R-11);
- resize → debounced re-layout; item content resize → `positioner.update` re-flow;
- SSR fallback: `fallback` shown while unmounted, replaced after mount;
- virtualization: with 200 items only a bounded set carries a `data-index` in the DOM (SC-008);
- RTL: `dir="rtl"` on the root and `inset-inline-start` on items, both via `<DirectionProvider>`;
- tab order follows source order; no arrow/Home/End/Enter/Escape key is intercepted;
- `child` snippet on both parts;
- `<Masonry.Item>` with no root throws `` /must be used within `<Masonry.Root>`/ ``.

### V-4 — Demo route (Principle IX, SC-006)

```bash
pnpm run build
```

**Expected**: `src/routes/docs/components/masonry/+page.svelte` builds, and contains exactly three
`<ComponentPreview>` sections — one per upstream demo (`masonry-demo`, `masonry-linear-demo`,
`masonry-ssr-demo`) — plus the API-reference tables.

To eyeball it (not part of the unattended pipeline — the pipeline must not start a dev server):
`pnpm run preview` after a build, then open `/docs/components/masonry`.

### V-5 — Registry (Principle V, SC-007)

```bash
pnpm run registry:build
ls static/r/masonry.json
```

**Expected**: `registry.json` has exactly one new `registry:ui` item named `masonry` listing all seven
source files and no test file; `static/r/masonry.json` is generated with `$lib/...` imports rewritten
to registry placeholders.

Sanity check that the component never reaches into the docs app:

```bash
git grep -n "components/docs\|routes/" -- src/lib/components/ui/masonry
```

**Expected**: no output.
