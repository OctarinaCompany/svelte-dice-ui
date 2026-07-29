# Phase 1 Data Model: Swap

**Feature**: `005-port-swap` | **Date**: 2026-07-29

Swap holds no persisted or fetched data. The "data model" is the reactive state shared between the root and
its two face parts, plus the two closed value sets that configure it.

---

## 1. Entity: `SwapState` (runes class, `swap.svelte.ts`)

One instance per `<Swap>` root, published on context under a `Symbol` key and read by `<SwapOn>` /
`<SwapOff>` / `useSwap()`.

### Constructor input (`SwapStateProps`) — all reactive inputs are getter functions

| Field              | Type                                    | Notes                                                                         |
| ------------------ | --------------------------------------- | ----------------------------------------------------------------------------- |
| `getSwapped`       | `() => boolean`                         | Reads the root's `$bindable` `swapped` (already seeded from `defaultSwapped`). |
| `setSwapped`       | `(swapped: boolean) => void`            | Writes it and fires `onSwappedChange`; no-ops when the value is unchanged.     |
| `getActivationMode`| `() => SwapActivationMode`              | —                                                                             |
| `getAnimation`     | `() => SwapAnimation`                   | —                                                                             |
| `getDisabled`      | `() => boolean`                         | —                                                                             |
| `getReducedMotion` | `() => boolean`                         | Supplied by `useReducedMotion()` in the root.                                  |

Getter functions, never snapshots — a value captured in the constructor stops being reactive (CLAUDE.md §4).

### Derived members (read by the parts)

| Member           | Type                 | Definition                                     |
| ---------------- | -------------------- | ---------------------------------------------- |
| `swapped`        | `boolean`            | `getSwapped()`                                 |
| `activationMode` | `SwapActivationMode` | `getActivationMode()`                          |
| `animation`      | `SwapAnimation`      | `getAnimation()`                               |
| `disabled`       | `boolean`            | `getDisabled()`                                |
| `reducedMotion`  | `boolean`            | `getReducedMotion()`                           |
| `isClickMode`    | `boolean`            | `activationMode === 'click'`                   |
| `dataState`      | `SwapDataState`      | `swapped ? 'on' : 'off'` (upstream's `getDataState`) |

### Transitions

| Trigger                                  | Guard                                                        | Effect                     |
| ---------------------------------------- | ------------------------------------------------------------ | -------------------------- |
| `toggle()`                               | `!disabled`                                                   | `setSwapped(!swapped)`     |
| `click`                                  | consumer handler first; `!defaultPrevented && isClickMode`    | `toggle()`                 |
| `keydown` `Enter` / `Space`              | consumer handler first; `!defaultPrevented && isClickMode && !disabled` | `preventDefault()` then `toggle()` |
| `mouseenter`                             | consumer handler first; `!defaultPrevented && !isClickMode && !disabled` | `setSwapped(true)`  |
| `mouseleave`                             | consumer handler first; `!defaultPrevented && !isClickMode && !disabled` | `setSwapped(false)` |
| parent writes the bound `swapped`        | —                                                             | faces follow; **no** `onSwappedChange` (research D-002) |

`setSwapped` is idempotent: `Object.is(current, next)` short-circuits before both the assignment and the
callback, mirroring upstream's `store.setState`.

### State chart

```text
              click / Enter / Space            (click mode, !disabled)
      ┌──────────────────────────────────────────────────────────┐
      │                                                          ▼
  ┌───────────────────┐                                  ┌───────────────────┐
  │ swapped = false   │                                  │ swapped = true    │
  │ data-state="off"  │                                  │ data-state="on"   │
  │ aria-pressed=false│◀─────────────────────────────────│ aria-pressed=true │
  └───────────────────┘   click / Enter / Space          └───────────────────┘
      ▲          │                                              ▲
      │          └── mouseenter ─────────────────────────────────┘   (hover mode, !disabled)
      └────────────── mouseleave ─────────────────────────────────
```

`disabled` removes every edge; the node keeps whatever state it was constructed with.

---

## 2. Entity: `ReducedMotionReader` (runes class, `swap.svelte.ts`)

| Member    | Type      | Notes                                                                                              |
| --------- | --------- | -------------------------------------------------------------------------------------------------- |
| `current` | `boolean` | `true` when `(prefers-reduced-motion: reduce)` matches. `false` on the server or without `matchMedia`. |

Lifecycle: the initial value is read eagerly during initialisation (guarded by
`typeof window !== 'undefined' && typeof window.matchMedia === 'function'`), and an `$effect` subscribes to
the query's `change` event and **returns a teardown that removes the listener**. Created by
`useReducedMotion()`, which must be called during component initialisation.

---

## 3. Value sets

| Type                 | Members                                | Ordered constant       | Default  |
| -------------------- | -------------------------------------- | ---------------------- | -------- |
| `SwapActivationMode` | `'click' \| 'hover'`                   | `SWAP_ACTIVATION_MODES`| `'click'`|
| `SwapAnimation`      | `'fade' \| 'rotate' \| 'flip' \| 'scale'` | `SWAP_ANIMATIONS`   | `'fade'` |
| `SwapDataState`      | `'on' \| 'off'`                        | —                      | `'off'`  |

Both ordered constants are `as const` tuples declared in upstream order and exported from the barrel, matching
the `STATUS_VARIANTS` / `DIRECTIONS` precedent. Each has a `resolveSwapActivationMode` /
`resolveSwapAnimation` narrowing helper that falls back to the default for an unrecognised runtime value —
the same defensive shape as `resolveStatusVariant`, needed because a consumer can pass an untyped string from
JS.

---

## 4. Context

| Item                   | Value                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Key                    | `const SWAP_CONTEXT_KEY = Symbol('swap')` (module-private)                          |
| Setter                 | `setSwapContext(state: SwapState): SwapState`                                       |
| Probe                  | `hasSwapContext(): boolean`                                                         |
| Getter                 | `getSwapContext(part?: string): SwapState` — throws when absent                     |
| Error message          | ``` `<SwapOn>` must be used within `<Swap>`. ``` (part name substituted; default `` `<Swap>` part ``) |
| Upstream parity export | `useSwap(): SwapState` — same exported name as upstream's `useStore as useSwap`; throws the same way |

---

## 5. Rendered attribute surface (the styling API)

| Part      | Attribute        | Values                                    | Present when                          |
| --------- | ---------------- | ----------------------------------------- | ------------------------------------- |
| root      | `data-slot`      | `"swap"`                                  | always                                |
| root      | `data-state`     | `"on"` \| `"off"`                         | always                                |
| root      | `data-animation` | `"fade"` \| `"rotate"` \| `"flip"` \| `"scale"` | always                          |
| root      | `data-disabled`  | `""`                                      | `disabled` (absent otherwise)         |
| root      | `data-motion`    | `"reduce"`                                | reduced motion requested (**additive**, see research D-007) |
| root      | `role`           | `"button"`                                | `activationMode === 'click'`          |
| root      | `aria-pressed`   | `"true"` \| `"false"`                     | `activationMode === 'click'`          |
| root      | `aria-disabled`  | `"true"`                                  | `disabled`                            |
| root      | `tabindex`       | `0`                                       | click mode **and** not disabled       |
| `SwapOn`  | `data-slot`      | `"swap-on"`                               | always                                |
| `SwapOn`  | `data-state`     | `"on"` \| `"off"`                         | always (mirrors the root)             |
| `SwapOff` | `data-slot`      | `"swap-off"`                              | always                                |
| `SwapOff` | `data-state`     | `"on"` \| `"off"`                         | always (mirrors the root)             |

Boolean data attributes are written `cond ? '' : undefined` so they are absent when false.
