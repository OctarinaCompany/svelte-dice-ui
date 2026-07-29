# Quickstart & Validation: Swap

**Feature**: `005-port-swap` | **Date**: 2026-07-29

How to run and prove the port. API details live in [`contracts/swap-public-api.md`](./contracts/swap-public-api.md);
state semantics live in [`data-model.md`](./data-model.md).

## Prerequisites

- Dependencies installed (`pnpm install`). **No new package is added by this feature.**
- Working directory: repository root. All commands are non-interactive and terminate.

## Usage

```svelte
<script lang="ts">
	import * as Swap from '$lib/components/ui/swap/index.js';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';

	let swapped = $state(false);
</script>

<!-- uncontrolled -->
<Swap.Root class="size-12 rounded-lg border" animation="rotate">
	<Swap.On><SunIcon class="size-6" /></Swap.On>
	<Swap.Off><MoonIcon class="size-6" /></Swap.Off>
</Swap.Root>

<!-- controlled -->
<Swap.Root bind:swapped onSwappedChange={(next) => console.log(next)}>
	<Swap.On><SunIcon class="size-6" /></Swap.On>
	<Swap.Off><MoonIcon class="size-6" /></Swap.Off>
</Swap.Root>

<!-- hover preview: no button role, not focusable -->
<Swap.Root activationMode="hover">…</Swap.Root>
```

## Validation scenarios

Each row is proven by a test in `src/lib/components/ui/swap/swap.test.ts` and demonstrated on
`/docs/components/swap`.

| # | Scenario (spec ref)                    | Drive it with                                            | Expect                                                                             |
| - | -------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1 | Click toggle (US1, FR-002)             | `userEvent.click(screen.getByRole('button'))`             | root `data-state` `off → on → off`; faces mirror it                                 |
| 2 | Keyboard (US1.3, FR-008, SC-003)       | `userEvent.tab()` then `{Enter}` / `{ }`                  | same transitions as a click; the `Space` event is `defaultPrevented`                |
| 3 | Hover preview (US2, FR-003)            | `userEvent.hover()` / `unhover()`                         | `on` while hovered, `off` after leaving; a click changes nothing                    |
| 4 | Hover ARIA (FR-009)                    | `queryByRole('button')`                                   | `null`; no `aria-pressed`; no `tabindex`                                            |
| 5 | Uncontrolled seed (US3.3, FR-004)      | `defaultSwapped: true`                                    | starts `on` with no interaction                                                     |
| 6 | Controlled (US3.1, FR-004/5)           | harness `bind:swapped` + `onSwappedChange` spy            | callback receives the next boolean; parent-driven writes move the faces             |
| 7 | Disabled (US3.2, FR-007)               | `disabled: true`, click + hover + `userEvent.tab()`       | state frozen; `aria-disabled="true"`; `data-disabled` present; never receives focus  |
| 8 | Animations (FR-006)                    | each of `fade`/`rotate`/`flip`/`scale`                    | `data-animation` matches; default is `fade`                                         |
| 9 | Reduced motion (FR-012, SC-004)        | `vi.stubGlobal('matchMedia', …matches: true)`             | root `data-motion="reduce"`; faces carry no `transition-all`/`duration-300`; clicking still yields the identical `data-state` sequence as the animated case |
| 10| Provider guard (FR-013)                | `render(SwapOn)` / `render(SwapOff)`                      | throws `/must be used within `<Swap>`/`                                             |
| 11| `preventDefault` escape hatch (FR-014) | consumer `onclick`/`onmouseenter`/`onmouseleave`/`onkeydown` calling `preventDefault()` | built-in toggle suppressed for that event      |
| 12| RTL (Edge Cases, Principle III)        | render inside `dir="rtl"` and `<DirectionProvider dir="rtl">` | identical transitions to LTR — no inversion                                     |
| 13| Composition                            | `class`, `restProps`, `bind:ref`, `child` snippet         | caller `class` wins; attributes forwarded; `ref` bound; `child` renders on a `<button>` with merged props |

## Commands

```bash
pnpm run format
pnpm run check                              # svelte-check: 0 errors, 0 warnings
pnpm run lint                               # prettier --check . && eslint .
pnpm run test:unit -- --run                 # whole suite
pnpm run test:unit -- --run src/lib/components/ui/swap/swap.test.ts   # this component only
pnpm run registry:build                     # regenerate static/r/ after editing registry.json
pnpm run build
```

Expected: all green, no test skipped, no suppression comment anywhere in the diff.

## Manual check (optional, not part of the gate)

`/docs/components/swap` renders four previews — Click to swap, Hover to swap, Animations (the four-tile
grid), Controlled — plus props and data-attribute tables. With OS "reduce motion" enabled, the faces switch
with no transition and the root carries `data-motion="reduce"`.
