# Quickstart: validating the Action Bar port

How to prove the port works end to end. Details of the API live in
[contracts/public-api.md](./contracts/public-api.md); the behaviour matrix lives in
[contracts/keyboard-map.md](./contracts/keyboard-map.md); the state model lives in
[data-model.md](./data-model.md).

## Prerequisites

- Node + `pnpm` with dependencies already installed (`pnpm install` at the repo root).
- No new npm packages are required — `bits-ui`, `tailwind-variants`, `@lucide/svelte` and
  `tw-animate-css` are already dependencies.
- The component folder `src/lib/components/ui/action-bar/`, the demo route
  `src/routes/docs/components/action-bar/+page.svelte`, and the `registry.json` entry exist.

## 1. Quality gates (must all be green, in this order)

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

Expected: zero `svelte-check` errors and warnings, zero Prettier/ESLint findings, every Vitest spec
passing with none skipped, and a successful `vite build` that includes the new demo route. No
suppression of any kind (`@ts-ignore`, `eslint-disable`, `svelte-ignore`, `.skip`, `as any`) may appear
in the diff — the anti-cheat rule of the constitution's Quality Gates section.

To iterate on this component alone while working:

```bash
pnpm run test:unit -- --run src/lib/components/ui/action-bar/action-bar.test.ts
```

## 2. Registry build

```bash
pnpm run registry:build
```

Expected: `static/r/action-bar.json` is produced, contains the ten non-test files from
`contracts/public-api.md` §"Registry contract", and lists
`registryDependencies: ["button", "direction-provider", "speed-dial"]`. The two test files must **not**
appear. This is the evidence for SC-005.

## 3. Manual walkthrough on the demo route

The dev server is not started by the unattended pipeline; run this only when validating by hand.

Visit `/docs/components/action-bar`.

**Section "Default"** (mirrors `action-bar-demo.tsx`) — proves SC-001, US1:

1. No checkbox ticked → no action bar anywhere in the page.
2. Tick two tasks → the bar appears docked bottom-centre, reading "2 selected", with Duplicate and
   Delete actions and a close control inside the selection pill.
3. Click **Duplicate** → two copies are appended, the selection clears and the bar disappears.
4. Tick tasks again, click the ✕ inside the pill → the selection clears, no action runs.
5. Tick tasks again, press `Escape` → the bar closes.

**Section "Position"** (mirrors `action-bar-position-demo.tsx`) — proves US2:

1. Toggle the switch → the bar appears.
2. Set Side to **Top** → the bar re-docks to the top of the viewport.
3. Set Align to **Start**, then **End** → the bar moves to the corresponding viewport edge.

**Keyboard pass** (proves SC-002 / SC-006, in both sections):

1. With the bar open, press `Tab` repeatedly from the page body — focus enters the action group as a
   **single** stop, then moves to the close button. It must never stop on every item.
2. Inside the group, `ArrowRight` / `ArrowLeft` move between actions and wrap around at the ends.
3. `Home` / `End` jump to the first / last action.
4. `Shift`+`Tab` out of the group, then `Tab` forward again — the group is skipped once, then becomes
   reachable again after focus has left the bar.
5. `Escape` closes the bar from anywhere.

**RTL pass**: temporarily set `dir="rtl"` on `<html>` (devtools) and repeat step 2 — `ArrowLeft` must
now move forward and `ArrowRight` backward.

## 4. Consumer smoke test (SC-001)

Minimum wiring a consumer must be able to write, with no positioning or portal code of their own:

```svelte
<script lang="ts">
	import * as ActionBar from '$lib/components/ui/action-bar/index.js';

	let selected = $state(new Set<string>());
	const open = $derived(selected.size > 0);
</script>

<ActionBar.Root {open} onOpenChange={(next) => !next && (selected = new Set())}>
	<ActionBar.Selection>{selected.size} selected</ActionBar.Selection>
	<ActionBar.Separator />
	<ActionBar.Group>
		<ActionBar.Item onSelect={duplicate}>Duplicate</ActionBar.Item>
		<ActionBar.Item variant="destructive" onSelect={remove}>Delete</ActionBar.Item>
	</ActionBar.Group>
	<ActionBar.Close>Close</ActionBar.Close>
</ActionBar.Root>
```

Both import styles must type-check:

```ts
import * as ActionBar from '$lib/components/ui/action-bar/index.js';
import { ActionBar, ActionBarItem, type ActionBarRootProps } from '$lib/components/ui/action-bar/index.js';
```

## 5. Reuse check for `selection-toolbar` (FR-016)

The next port must be able to write this without touching `action-bar`'s internals:

```ts
import {
	EscapeDismissState,
	floatingSurfaceVariants,
	focusFirst,
	getViewportEdgeStyle,
	RovingFocusGroupState
} from '$lib/components/ui/action-bar/index.js';
```

Validate by confirming every name above is exported from the barrel and that
`action-bar-floating.svelte.ts` / `action-bar-roving-focus.svelte.ts` import nothing from
`action-bar.svelte` or from any other part file — the dependency arrow points parts → shared modules,
never back.

## Success criteria coverage

| Criterion | Validated by                                                        |
| --------- | -------------------------------------------------------------------- |
| SC-001    | Step 3 "Default" section 1-3; step 4 consumer smoke test              |
| SC-002    | Step 1 Vitest run (keyboard matrix, LTR + RTL); step 3 keyboard pass  |
| SC-003    | Step 1 Vitest run against `contracts/public-api.md`                   |
| SC-004    | Step 3 — both upstream examples reproduced on the demo route          |
| SC-005    | Step 2 registry build                                                 |
| SC-006    | Step 3 keyboard pass + the roles/ARIA block of the test suite         |
