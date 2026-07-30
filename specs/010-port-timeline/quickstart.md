# Quickstart & Validation: Timeline

How to prove the `timeline` port works end to end. Every command is non-interactive and terminates.
Contract details live in [`contracts/public-api.md`](./contracts/public-api.md); entity shapes in
[`data-model.md`](./data-model.md).

## Prerequisites

- Dependencies installed (`pnpm install`) — no new package is required by this feature.
- `src/lib/components/ui/direction-provider/` present (it is; ported in feature `002`). Timeline's
  `dir` resolution composes its `useDirection()`.
- Nothing to migrate, seed or configure.

## Minimal usage

```svelte
<script lang="ts">
	import * as Timeline from '$lib/components/ui/timeline/index.js';

	const events = [
		{ id: 'kickoff', datetime: '2025-01-15', date: 'January 15, 2025', title: 'Project Kickoff' },
		{ id: 'design', datetime: '2025-02-01', date: 'February 1, 2025', title: 'Design Phase' },
		{ id: 'dev', datetime: '2025-03-01', date: 'March 1, 2025', title: 'Development' }
	];

	let activeIndex = $state(1);
</script>

<Timeline.Root {activeIndex}>
	{#each events as event (event.id)}
		<Timeline.Item id={event.id}>
			<Timeline.Dot />
			<Timeline.Connector />
			<Timeline.Content>
				<Timeline.Header>
					<Timeline.Time dateTime={event.datetime}>{event.date}</Timeline.Time>
					<Timeline.Title>{event.title}</Timeline.Title>
				</Timeline.Header>
				<Timeline.Description>Details about this step.</Timeline.Description>
			</Timeline.Content>
		</Timeline.Item>
	{/each}
</Timeline.Root>
```

Expected: an `<ol>` with three `<li>`s; the first item `data-status="completed"`, the second
`data-status="active"` + `aria-current="step"`, the third `data-status="pending"`; two connectors (none
after the last item), the first carrying `data-completed`.

## Validation scenarios

Each row maps a spec acceptance scenario to the check that proves it. Run the automated commands
below; the manual column is the visual confirmation on the demo route.

| Spec item                      | Automated proof                                       | Manual proof on `/docs/components/timeline` |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------------- |
| US1 / FR-001, FR-009           | tests `T-01`, `T-03`, `T-08`, `T-25`                  | **Default** preview: 3 dots, 2 lines        |
| US2 / FR-005, FR-007, FR-010   | tests `T-02`, `T-06`, `T-07`, `T-09`                  | **Default** preview: step 2 highlighted; the interactive `activeIndex` control re-colours dots and lines |
| US2 / FR-006 (live DOM order)  | test `T-10`                                            | the add/remove control on the demo page keeps statuses correct |
| US3 / FR-002, FR-003           | test `T-11`                                            | **Horizontal**, **Alternate**, **Horizontal Alternate** previews |
| US3 / FR-004 (RTL)             | tests `T-12`, `T-13`                                   | **RTL** preview reads right-to-left; the alternate previews mirror when the page `dir` flips |
| FR-011 (CSS variables)         | test `T-18`                                            | **Custom Dot** preview: 2rem dots, lines still centred |
| FR-012 (custom dot content)    | test `T-11` + `T-17`                                   | **Custom Dot** preview shows Rocket / Layers / Code icons |
| FR-013, FR-014                 | tests `T-04`, `T-15`                                   | every preview renders header/title/time/description |
| FR-015, FR-016                 | tests `T-17`, `T-19`, `T-20`, `T-21`                   | —                                           |
| FR-017                         | test `T-14`                                            | —                                           |
| FR-018                         | test `T-17`                                            | inspect any part in devtools for `data-slot` |
| SC-005 (registry install)      | `pnpm run registry:build` emits `static/r/timeline.json` containing all 11 files | —                    |
| SC-006 (one preview per demo)  | `pnpm run build` compiles the route                    | six `<ComponentPreview>` sections present   |

## Commands

Run in this order, from the repository root. All are non-interactive.

```bash
pnpm run format                 # shadcn/generator output is not prettier-formatted; run first
pnpm run check                  # svelte-kit sync && svelte-check — zero errors, zero warnings
pnpm run lint                   # prettier --check . && eslint .
pnpm run test:unit -- --run     # vitest single run; timeline.test.ts must be fully green
pnpm run build                  # vite build, including /docs/components/timeline
pnpm run registry:build         # regenerate static/r/*.json after appending the registry entry
```

Targeted test run while iterating:

```bash
pnpm run test:unit -- --run src/lib/components/ui/timeline/timeline.test.ts
```

## Expected outcomes

- `pnpm run check` → `0 errors, 0 warnings`. No `@ts-ignore` / `@ts-expect-error` / `as any` anywhere in
  the new files.
- `pnpm run lint` → no findings. No `eslint-disable`, no `svelte-ignore`.
- `pnpm run test:unit -- --run` → every `it` in `timeline.test.ts` passes, none skipped or `.todo`, and
  each asserts at least once (`expect.requireAssertions` is on).
- `pnpm run build` → succeeds; `/docs/components/timeline` is prerendered with all six previews.
- `pnpm run registry:build` → `static/r/timeline.json` exists, its `files[]` length is 11, and it
  lists `registryDependencies: ["direction-provider"]`. `timeline.test.ts` and `timeline.test.svelte`
  must **not** appear in it.
- `git status` shows only: the 12 files under `src/lib/components/ui/timeline/`, the demo route,
  `registry.json`, `static/r/timeline.json` + `static/r/index.json`, and this feature directory.
  Nothing under `.reference/`, `scripts/`, `.specify/scripts/` or `.port-*`.

## Failure triage

| Symptom                                                        | Likely cause                                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| every item reports `data-status="pending"` with `activeIndex` set | the registration `$effect` never ran, or it registered before the element was bound — must be `$effect`, not `$effect.pre` (research R-03) |
| all connectors missing                                          | `getNextItemStatus` returning `undefined` for every id ⇒ `orderedIds` empty ⇒ registration key mismatch between `register()` and the item's `id` |
| statuses shift by one after removing an item                    | `unregister` mutating the `$state` array in place instead of replacing it                       |
| `svelte-check` flags a class field used before assignment       | expected pattern — declare `#props!` and assign in the constructor, as `DirectionProviderState` and `BadgeOverflowState` do |
| infinite update loop                                            | writing to state read in the same `$effect`; registration writes `#items` and reads only `ref`/`id`, so re-check nothing else was added to that effect |
| alternate layout does not mirror under `dir="rtl"`               | a physical utility survived the logical translation (research R-08) — test `T-13` catches this   |
