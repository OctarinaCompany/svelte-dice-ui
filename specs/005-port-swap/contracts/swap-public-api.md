# Contract: Swap Public API

**Feature**: `005-port-swap` | **Date**: 2026-07-29 | **Upstream**:
`.reference/diceui/docs/registry/bases/radix/ui/swap.tsx` + `docs/types/radix/swap.ts` @ `d9763d8`

This file is the authoritative surface for implementation and tests. Anything not listed here is not part of
the API.

---

## 1. Module map

| File                                            | Exports                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/components/ui/swap/swap.svelte`        | default `Swap` (root); `type SwapRootProps`, `type SwapChildProps`                                                                     |
| `src/lib/components/ui/swap/swap-on.svelte`     | default `SwapOn`; `type SwapOnProps`                                                                                                   |
| `src/lib/components/ui/swap/swap-off.svelte`    | default `SwapOff`; `type SwapOffProps`                                                                                                 |
| `src/lib/components/ui/swap/swap.svelte.ts`     | `SwapState`, `useSwap`, `setSwapContext`, `hasSwapContext`, `getSwapContext`, `ReducedMotionReader`, `useReducedMotion`, `SWAP_ACTIVATION_MODES`, `SWAP_ANIMATIONS`, `resolveSwapActivationMode`, `resolveSwapAnimation`, `getSwapDataState`, and the types `SwapActivationMode`, `SwapAnimation`, `SwapDataState`, `SwapFaceChildProps` |
| `src/lib/components/ui/swap/index.ts`           | the barrel — see §7                                                                                                                    |

---

## 2. `<Swap>` — root (`swap.svelte`)

`SwapRootProps extends WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement>`.

| Prop              | Type                                              | Default     | Bindable | Notes                                                                                     |
| ----------------- | ------------------------------------------------- | ----------- | -------- | ----------------------------------------------------------------------------------------- |
| `ref`             | `HTMLDivElement \| null`                          | `null`      | **yes**  | `bind:this` on the rendered `div`. Stays `null` in `child` mode.                            |
| `swapped`         | `boolean \| undefined`                            | `undefined` | **yes**  | Controlled state. When bound, the parent is authoritative. Seeded once from `defaultSwapped`. |
| `defaultSwapped`  | `boolean`                                         | `false`     | no       | Uncontrolled seed. Ignored once `swapped` is supplied.                                      |
| `onSwappedChange` | `((swapped: boolean) => void) \| undefined`       | `undefined` | no       | Fired with the next value when the component changes state. Not fired for parent-driven writes (see §6). |
| `activationMode`  | `SwapActivationMode` (`'click' \| 'hover'`)       | `'click'`   | no       | `click` → toggle on click/Enter/Space. `hover` → `true` on pointer enter, `false` on leave.  |
| `animation`       | `SwapAnimation` (`'fade' \| 'rotate' \| 'flip' \| 'scale'`) | `'fade'` | no  | Surfaced as `data-animation`; the faces' ancestor-scoped utilities react to it.              |
| `disabled`        | `boolean`                                         | `false`     | no       | Suppresses click, hover and keyboard; sets `aria-disabled`/`data-disabled`; drops `tabindex`. |
| `class`           | `ClassValue \| undefined`                         | `undefined` | no       | Merged **last** through `cn()`.                                                              |
| `children`        | `Snippet \| undefined`                            | `undefined` | no       | The two faces. Not rendered in `child` mode.                                                 |
| `child`           | `Snippet<[{ props: SwapChildProps }]> \| undefined`| `undefined`| no       | Render onto your own element. Replaces upstream `asChild`.                                   |
| `onclick`         | `MouseEventHandler<HTMLDivElement> \| undefined`   | `undefined` | no       | Runs **before** the built-in toggle; `preventDefault()` vetoes it.                            |
| `onmouseenter`    | `MouseEventHandler<HTMLDivElement> \| undefined`   | `undefined` | no       | Same contract.                                                                               |
| `onmouseleave`    | `MouseEventHandler<HTMLDivElement> \| undefined`   | `undefined` | no       | Same contract.                                                                               |
| `onkeydown`       | `KeyboardEventHandler<HTMLDivElement> \| undefined`| `undefined` | no       | Same contract.                                                                               |
| `...restProps`    | `HTMLAttributes<HTMLDivElement>`                  | —           | no       | Spread onto the element, after the component's own `data-*`/ARIA and before `class`.         |

**Snippets**: `children` (no parameters), `child` (`{ props: SwapChildProps }`).
**Callbacks/events**: `onSwappedChange`; plus the four composed DOM handlers above; every other DOM handler
passes straight through `restProps`.

**Rendered element** (default path):

```svelte
<div
  role={isClickMode ? 'button' : undefined}
  aria-pressed={isClickMode ? swapped : undefined}
  aria-disabled={disabled ? 'true' : undefined}
  data-slot="swap"
  data-animation={animation}
  data-state={swapped ? 'on' : 'off'}
  data-disabled={disabled ? '' : undefined}
  data-motion={reducedMotion ? 'reduce' : undefined}
  tabindex={isClickMode && !disabled ? 0 : undefined}
  {...restProps}
  class={cn(ROOT_CLASSES, className)}
  onclick={…} onmouseenter={…} onmouseleave={…} onkeydown={…}
>
```

`ROOT_CLASSES` (upstream verbatim, order as Prettier's Tailwind plugin sorts them):

```text
relative inline-flex cursor-pointer items-center justify-center select-none
data-disabled:cursor-not-allowed data-disabled:opacity-50
```

`SwapChildProps` = the object above (minus `children`/`ref`) `& Record<string, unknown>`.

---

## 3. `<SwapOn>` / `<SwapOff>` (`swap-on.svelte`, `swap-off.svelte`)

`SwapOnProps` / `SwapOffProps` `extends WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement>`.

| Prop           | Type                                                  | Default     | Bindable | Notes                                     |
| -------------- | ----------------------------------------------------- | ----------- | -------- | ----------------------------------------- |
| `ref`          | `HTMLDivElement \| null`                              | `null`      | **yes**  | —                                         |
| `class`        | `ClassValue \| undefined`                             | `undefined` | no       | Merged last.                              |
| `children`     | `Snippet \| undefined`                                | `undefined` | no       | The face content (typically one icon).    |
| `child`        | `Snippet<[{ props: SwapFaceChildProps }]> \| undefined`| `undefined`| no       | Replaces upstream `asChild`.              |
| `...restProps` | `HTMLAttributes<HTMLDivElement>`                      | —           | no       | Spread before the computed `class`.       |

No callbacks. Both read `getSwapContext('<SwapOn>' | '<SwapOff>')` at the top of the instance script and
**throw** when used outside `<Swap>`.

**`SwapOn` classes** (upstream verbatim, plus the runtime reduced-motion gate on the transition pair):

```text
[transition-all duration-300]                      ← emitted only when reducedMotion === false
data-[state=off]:absolute data-[state=off]:opacity-0 data-[state=on]:opacity-100
motion-reduce:transition-none
[*[data-animation=rotate]_&]:data-[state=off]:rotate-180
[*[data-animation=rotate]_&]:data-[state=on]:rotate-0
motion-reduce:[*[data-animation=rotate]_&]:data-[state=off]:rotate-0
[*[data-animation=flip]_&]:data-[state=off]:transform-[rotateY(180deg)]
[*[data-animation=flip]_&]:data-[state=on]:transform-[rotateY(0deg)]
motion-reduce:[*[data-animation=flip]_&]:data-[state=off]:transform-[rotateY(0deg)]
[*[data-animation=scale]_&]:data-[state=off]:scale-0
[*[data-animation=scale]_&]:data-[state=on]:scale-100
motion-reduce:[*[data-animation=scale]_&]:data-[state=off]:scale-100
```

**`SwapOff` classes** — the same list with every `on`/`off` state selector swapped (`data-[state=on]:absolute`,
`data-[state=on]:opacity-0`, `data-[state=off]:opacity-100`, `rotate-180` on `on`, etc.), exactly as upstream.

---

## 4. `swap.svelte.ts` runtime exports

```ts
const SWAP_ACTIVATION_MODES: readonly ['click', 'hover'];
const SWAP_ANIMATIONS: readonly ['fade', 'rotate', 'flip', 'scale'];

type SwapActivationMode = (typeof SWAP_ACTIVATION_MODES)[number];
type SwapAnimation = (typeof SWAP_ANIMATIONS)[number];
type SwapDataState = 'on' | 'off';

function resolveSwapActivationMode(value?: string): SwapActivationMode; // unknown → 'click'
function resolveSwapAnimation(value?: string): SwapAnimation;           // unknown → 'fade'
function getSwapDataState(swapped: boolean): SwapDataState;             // upstream's getDataState

class SwapState { /* §1 of data-model.md */ }
function setSwapContext(state: SwapState): SwapState;
function hasSwapContext(): boolean;
function getSwapContext(part?: string): SwapState;  // throws `<part> must be used within \`<Swap>\`.`
function useSwap(): SwapState;                      // upstream parity name; delegates to getSwapContext

class ReducedMotionReader { readonly current: boolean }
function useReducedMotion(): ReducedMotionReader;   // reusable by later ports (deliverable 5)
```

---

## 5. Keyboard contract (MDX "Keyboard Interactions", verbatim)

| Key     | Mode    | Behaviour                                                                   |
| ------- | ------- | --------------------------------------------------------------------------- |
| `Enter` | `click` | Toggles the swapped state. Ignored when `disabled`.                          |
| `Space` | `click` | Toggles the swapped state; calls `preventDefault()` so the page does not scroll. Ignored when `disabled`. |
| `Tab`   | `click` | Focuses the root (`tabindex=0`) unless `disabled`, in which case it is skipped. |
| any     | `hover` | No keyboard handling — the widget carries no role and is not focusable.      |

No other key is handled, and no arrow-key or Home/End behaviour exists upstream.

---

## 6. Deliberate divergences from upstream (Principle II ledger)

| # | Upstream                                          | Here                                                       | Why                                                                        |
| - | ------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1 | `asChild?: boolean` (Radix `Slot`)                | `child?: Snippet<[{ props }]>`                             | No `cloneElement` in Svelte; repo-wide pattern. Recorded in spec Assumptions. |
| 2 | `Store` / `useSyncExternalStore` / `useLazyRef` / `useAsRef` | `SwapState` + `$state`/`$derived`                | React-only plumbing; no API change. Recorded in spec Assumptions.            |
| 3 | `useIsomorphicLayoutEffect` prop→state sync       | `swapped = $bindable()` + `swapped ??= defaultSwapped`      | Native controlled/uncontrolled. Recorded in spec Assumptions.                |
| 4 | Parent-driven prop change re-enters `setState` and fires `onSwappedChange` | Callback fires only on component-driven change | React echo artefact; spec FR-005 specifies interaction-driven only. Research D-002. |
| 5 | Reduced motion via `motion-reduce:` utilities only | Those utilities **kept**, plus `data-motion="reduce"` and runtime removal of `transition-all duration-300` | FR-012/SC-004 demand an asserting test; jsdom applies no CSS. Research D-007. |
| 6 | `useStore` exported as `useSwap`                   | `useSwap()` returns `SwapState` instead of a selector result | Runes make selectors unnecessary; the exported name is preserved.           |

Nothing is renamed, dropped or added beyond this table.

---

## 7. Barrel (`index.ts`)

```ts
import Root from './swap.svelte';
import On from './swap-on.svelte';
import Off from './swap-off.svelte';

export { type SwapRootProps, type SwapChildProps } from './swap.svelte';
export { type SwapOnProps } from './swap-on.svelte';
export { type SwapOffProps } from './swap-off.svelte';
export {
	SWAP_ACTIVATION_MODES,
	SWAP_ANIMATIONS,
	SwapState,
	ReducedMotionReader,
	getSwapContext,
	getSwapDataState,
	hasSwapContext,
	resolveSwapActivationMode,
	resolveSwapAnimation,
	setSwapContext,
	useReducedMotion,
	useSwap,
	type SwapActivationMode,
	type SwapAnimation,
	type SwapDataState,
	type SwapFaceChildProps
} from './swap.svelte.js';

export {
	Root,
	On,
	Off,
	//
	Root as Swap,
	On as SwapOn,
	Off as SwapOff
};
```

Both consumption styles must work:

```ts
import * as Swap from '$lib/components/ui/swap/index.js'; // Swap.Root, Swap.On, Swap.Off
import { Swap, SwapOn, SwapOff } from '$lib/components/ui/swap/index.js';
```

---

## 8. Registry entry (appended to `registry.json`)

```jsonc
{
	"name": "swap",
	"type": "registry:ui",
	"title": "Swap",
	"description": "A component that swaps between two states with click or hover activation modes.",
	"registryDependencies": [],
	"dependencies": [],
	"files": [
		{ "path": "src/lib/components/ui/swap/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/swap/swap.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/swap/swap-on.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/swap/swap-off.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/swap/swap.svelte.ts", "type": "registry:ui" }
	]
}
```

`swap.test.ts` and `swap.test.svelte` are deliberately absent. `registryDependencies` and `dependencies` are
empty: the component imports only `$lib/utils.js`, `svelte` and `svelte/elements`.
