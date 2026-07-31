# Quickstart & Validation Guide: Stepper

**Feature**: `031-port-stepper` | **Date**: 2026-07-31

How to run and prove this port end to end. API details live in
[`contracts/public-api.md`](./contracts/public-api.md); state shape lives in
[`data-model.md`](./data-model.md).

---

## Prerequisites

- Node 20+, `pnpm` (the repo's package manager)
- Dependencies installed: `pnpm install --frozen-lockfile`
- No new npm dependency is introduced by this port. `@lucide/svelte`, `tailwind-variants` and
  `bits-ui` are already in `package.json`.

---

## Minimal usage

```svelte
<script lang="ts">
	import * as Stepper from '$lib/components/ui/stepper/index.js';

	const steps = [
		{ value: 'account', title: 'Account' },
		{ value: 'profile', title: 'Profile' },
		{ value: 'review', title: 'Review' }
	];

	let value = $state('account');
</script>

<Stepper.Root bind:value>
	<Stepper.List>
		{#each steps as step (step.value)}
			<Stepper.Item value={step.value}>
				<Stepper.Trigger>
					<Stepper.Indicator />
					<Stepper.Title>{step.title}</Stepper.Title>
				</Stepper.Trigger>
				<Stepper.Separator />
			</Stepper.Item>
		{/each}
	</Stepper.List>

	{#each steps as step (step.value)}
		<Stepper.Content value={step.value}>Content for {step.title}</Stepper.Content>
	{/each}

	<Stepper.Prev>Previous</Stepper.Prev>
	<Stepper.Next>Next</Stepper.Next>
</Stepper.Root>
```

Uncontrolled instead: drop `bind:value` and pass `defaultValue="account"`.

---

## Validation-gated flow

```svelte
<Stepper.Root
	bind:value
	onValidate={async (target, direction) => {
		if (direction === 'prev') return true;
		return await isCurrentStepValid();
	}}
>
	…
</Stepper.Root>
```

Backward moves are never gated. `Stepper.Prev` bypasses `onValidate` entirely; `Stepper.Next`,
trigger clicks and (in `automatic` mode) arrow-key focus all run it for forward moves.

---

## Validation scenarios

Each scenario maps to a spec acceptance scenario or edge case, and to at least one assertion in
`src/lib/components/ui/stepper/stepper.test.ts`.

### S-1 — Core step tracking (US1)

1. Render the minimal example with `defaultValue="profile"`.
2. Expect: only "Content for Profile" is in the document; the Profile trigger has
   `aria-current="step"`, `aria-selected="true"` and `data-state="active"`; the Account trigger has
   `data-state="completed"`; the Review trigger has `data-state="inactive"`.
3. Click the Review trigger. Expect the content swaps and `onValueChange` fired with `'review'`.

### S-2 — Previous / Next (US2)

1. Render with `defaultValue="account"`. Expect `Previous` disabled, `Next` enabled.
2. Click `Next` → active step is `profile`; `Previous` becomes enabled.
3. Click `Previous` → back to `account`.
4. Render with `defaultValue="review"`. Expect `Next` disabled.

### S-3 — Validation gate (US3)

1. Render with `onValidate` resolving `false`.
2. Click the Profile trigger. Expect `onValidate` called with `('profile', 'next')`, the active step
   unchanged, and `onValueChange` never called.
3. With the same validator and `defaultValue="review"`, click the Account trigger. Expect the move
   succeeds — `onValidate` is not consulted for `'prev'`.

### S-4 — Keyboard and roving focus (FR-011, FR-012, FR-013, FR-014)

1. `Tab` into the list — focus lands on the trigger of the **current** step, not the first one.
2. `ArrowRight` / `ArrowLeft` move between triggers (horizontal); `ArrowUp` / `ArrowDown` are
   ignored. With `orientation="vertical"` the pairs swap.
3. With `dir="rtl"`, `ArrowLeft` moves *forward* and `ArrowRight` *backward*.
4. `Home` / `PageUp` → first enabled trigger. `End` / `PageDown` → last enabled trigger.
5. With `loop`, `ArrowRight` on the last trigger wraps to the first.
6. Exactly one trigger has `tabindex="0"` at any time; all others are `-1`.

### S-5 — Activation modes and guards (FR-008, FR-009, edge cases)

1. `activationMode="manual"`: focusing a trigger does **not** change the step; `Enter` or `Space`
   does.
2. `nonInteractive`: clicking and `Enter` do nothing, but changing the bound `value` still moves the
   stepper.
3. A `disabled` step: its trigger is `disabled`, clicking is a no-op, and arrow keys skip over it.
4. A `completed` step reports `data-state="completed"` even when it comes *after* the active step.

### S-6 — Accessibility (FR-010, FR-016, SC-004)

1. `getByRole('tablist')` has `aria-orientation` matching the orientation.
2. Every `getAllByRole('tab')` has `aria-posinset` = its 1-based position and `aria-setsize` = the
   step count.
3. Exactly one `role="tabpanel"` is rendered (unless a `Stepper.Content` sets `forceMount`), and it
   is `aria-labelledby` its trigger.

### S-7 — Provider guards (Constitution §5)

Rendering any of the eleven parts outside its provider throws an error matching `/within/` that
names both the part and the required ancestor.

---

## Commands

Run from the repository root. All are non-interactive and terminate.

```bash
pnpm run format                     # first: generator output is not prettier-formatted
pnpm run check                      # svelte-kit sync && svelte-check — 0 errors, 0 warnings
pnpm run lint                       # prettier --check . && eslint . — 0 findings
pnpm run test:unit -- --run         # vitest single run — all green, none skipped
pnpm run build                      # vite build, including the new demo route
pnpm run registry:build             # regenerate static/r/ after the registry.json entry
```

Target just this component while iterating:

```bash
pnpm run test:unit -- --run src/lib/components/ui/stepper/stepper.test.ts
```

**Anti-cheat**: a gate made green by `@ts-ignore`, `@ts-expect-error`, `eslint-disable`,
`svelte-ignore`, `as any`, `.skip` / `.todo` / `.only`, a deleted assertion, or a loosened config is
an invalid result regardless of exit code (Constitution VII).

---

## Expected artifacts when complete

| Path                                                       | Check                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| `src/lib/components/ui/stepper/` (14 files)                | 11 parts + `stepper.svelte.ts` + `index.ts` + tests          |
| `src/lib/components/ui/stepper/stepper.test.ts`            | All 17 upstream `it` blocks ported, plus the §7 additions    |
| `src/routes/docs/components/stepper/+page.svelte`          | 4 `<ComponentPreview>` sections + props tables               |
| `registry.json`                                            | Exactly one new `registry:ui` item named `stepper`           |
| `static/r/stepper.json`                                    | Produced by `pnpm run registry:build`                        |

Manual smoke check of the demo route is **not** part of the gate — `pnpm run dev` must not be
started (Constitution, Development Workflow). `pnpm run build` compiling the route is the evidence.
