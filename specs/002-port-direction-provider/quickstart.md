# Quickstart / Validation Guide: Direction Provider

**Feature**: `002-port-direction-provider` | **Date**: 2026-07-29

How to prove the port works end to end. Contract details live in
[contracts/direction-provider-public-api.md](./contracts/direction-provider-public-api.md); the
resolution rule lives in [data-model.md](./data-model.md). No implementation bodies here.

## 0. Prerequisites

- `pnpm install` already run; Node ≥ 20; `pnpm` available.
- Working directory: repository root, `D:\Code\svelte-dice-ui`.
- No new npm dependency is required by this feature (research Decision 11).
- Every command below terminates on its own. Never start `pnpm dev`, bare `vitest`, or any `--watch`.

## 1. Consumer-facing usage (what the demo page must show)

```svelte
<script lang="ts">
	import * as DirectionProvider from '$lib/components/ui/direction-provider/index.js';
	let dir = $state<DirectionProvider.Direction>('ltr');
</script>

<DirectionProvider.Root {dir}>
	<YourApp />
</DirectionProvider.Root>
```

Reading it from any descendant, with or without a provider above:

```svelte
<script lang="ts">
	import { useDirection } from '$lib/components/ui/direction-provider/index.js';
	const direction = useDirection();
</script>

<Button dir={direction.current}>Do a kickflip</Button>
```

Forwarding a component's own `dir` prop as the override (User Story 3):

```ts
const direction = useDirection({ dir: () => dir });
```

## 2. Run the unit suite

```bash
pnpm run test:unit -- --run src/lib/components/ui/direction-provider/direction-provider.test.ts
```

Expected: all cases pass, none skipped, every `it` asserting
(`expect.requireAssertions` is on).

## 3. Scenario coverage the suite must demonstrate

Each row maps a spec scenario to the contract id it is asserted under. The suite is complete when
every row is green.

| Spec scenario                                             | Contract id           |
| --------------------------------------------------------- | --------------------- |
| US1-1 — provider `ltr` ⇒ descendant reads `ltr`           | C-01                  |
| US1-2 — provider `rtl` ⇒ descendant reads `rtl`           | C-02                  |
| US1-3 — nested providers, nearest wins                    | C-04                  |
| US2-1 — no provider, no ancestor `dir` ⇒ `ltr`, no throw  | C-05                  |
| US2-2 — no provider, ancestor `dir="rtl"` ⇒ `rtl`         | C-06                  |
| US2-3 / US3-1 — explicit override beats provider and DOM  | C-08                  |
| Edge — no `dir` prop ⇒ `ltr`                              | C-03, C-17            |
| Edge — `dir="auto"` treated as absent                     | C-07                  |
| Edge — direction changes while mounted (all three sources) | C-09, C-10, C-11      |
| FR-010 — attribute forwarding                             | C-12, C-13            |
| Principle III — no role, no accessible name, no keyboard  | C-14, C-20            |
| CLAUDE §5 — throwing context accessor                     | C-15                  |
| `ref` binding, observer teardown, controlled parent       | C-16, C-19, C-18      |

## 4. Verify the demo route

```bash
pnpm run build
```

Then confirm by inspection of `src/routes/docs/components/direction-provider/+page.svelte`:

1. Three `<ComponentPreview>` sections — **Provider**, **Reading the direction**, **Ambient
   fallback** — the first two mirroring the two code blocks in
   `.reference/diceui/docs/content/docs/utilities/radix/direction-provider.mdx`, the third satisfying
   SC-004's "ambient / fallback" half.
2. Section 1 offers a live `ltr` ⇄ `rtl` toggle and at least one nested provider, so SC-001 and
   SC-003 are visible without reading source.
3. Props and data-attribute tables built from §2 of the API contract, in the same `Table.Root`
   layout as `src/routes/docs/components/status/+page.svelte`.
4. Demo state is held in the page with runes; there is no `+page.ts`.
5. The route appears in the docs sidebar — it is derived from `registry.json` by
   `getComponentItems()` in `src/lib/registry.ts`, so this only works once step 5 below is done.

## 5. Verify the registry entry

Append `contracts/registry-item.json` verbatim as the second element of `items` in `registry.json`,
then:

```bash
pnpm run registry:build
```

Expected: `static/r/direction-provider.json` is written, containing the three shipped files with
`$lib/...` imports rewritten to registry placeholders. Neither test file appears in it.

## 6. Quality gates (Principle VII — run in this order, all must be green)

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

The feature is done when all four gates pass with no suppression of any kind — no `@ts-ignore`,
`@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, and no loosened
config.

## 7. Manual smoke check (optional, non-blocking)

Not part of the gates and **not** to be run by the unattended pipeline (it would need a dev server).
For a human validating later: open `/docs/components/direction-provider`, toggle the direction, and
confirm the "Ambient fallback" section reports `rtl` even though no provider wraps it.
