# Phase 1 Data Model: Pending Utility

**Feature**: `003-port-pending` | **Date**: 2026-07-29

Pending stores nothing and owns no mutable state — every entity below is a **derivation** of three
inputs. There is no collection, no selection, no context and no persistence.

---

## Entity 1 — `UsePendingOptions` (input)

The reactive inputs, passed as getter functions so `$derived` can track them.

| Field       | Type                         | Required | Default when absent / `undefined` | Validation                                                          |
| ----------- | ---------------------------- | -------- | --------------------------------- | ------------------------------------------------------------------- |
| `id`        | `() => string \| undefined`  | no       | generated `pending-<n>`           | Falsy (including `''`) → fall back, matching upstream `id \|\| instanceId` |
| `isPending` | `() => boolean \| undefined` | no       | `false`                           | none                                                                 |
| `disabled`  | `() => boolean \| undefined` | no       | `false`                           | none                                                                 |

The options object itself is optional: `usePending()` is valid and yields an idle state with a
generated id.

---

## Entity 2 — `PendingState` (derived aggregate, replaces `UsePendingReturn`)

One instance per `usePending()` call. All members are read-only derivations; the class exposes no
setter and no method that mutates.

| Member         | Kind          | Type                | Derivation                                        |
| -------------- | ------------- | ------------------- | ------------------------------------------------- |
| `id`           | `$derived`    | `string`            | `options.id?.() \|\| fallbackId`                  |
| `isPending`    | `$derived`    | `boolean`           | `options.isPending?.() ?? false`                  |
| `disabled`     | `$derived`    | `boolean`           | `options.disabled?.() ?? false`                   |
| `pendingProps` | `$derived.by` | `PendingAttributes` | Entity 3, rebuilt when any of the three changes   |

`fallbackId` is a private, non-reactive field assigned once at construction from
`createPendingId()`, so the id is stable for the lifetime of the instance (FR-007).

---

## Entity 3 — `PendingAttributes` (the spreadable payload)

The object upstream calls `pendingProps`. **Every conditional key is omitted, never set to
`undefined`**, so a last-position spread is safe when idle (research R4).

| Key             | Type                                  | Emitted when | Value       |
| --------------- | ------------------------------------- | ------------ | ----------- |
| `id`            | `string`                              | always       | `state.id`  |
| `data-slot`     | `'pending'`                           | always       | `'pending'` |
| `aria-busy`     | `'true'`                              | `isPending`  | `'true'`    |
| `aria-disabled` | `'true'`                              | `isPending`  | `'true'`    |
| `data-pending`  | `''`                                  | `isPending`  | `''`        |
| `data-disabled` | `''`                                  | `disabled`   | `''`        |
| `onclick`       | `(event: Event) => void`              | `isPending`  | `preventDefault()` |
| `onpointerdown` | `(event: Event) => void`              | `isPending`  | `preventDefault()` |
| `onpointerup`   | `(event: Event) => void`              | `isPending`  | `preventDefault()` |
| `onmousedown`   | `(event: Event) => void`              | `isPending`  | `preventDefault()` |
| `onmouseup`     | `(event: Event) => void`              | `isPending`  | `preventDefault()` |
| `onkeydown`     | `(event: KeyboardEvent) => void`      | `isPending`  | `preventDefault()` iff `key === 'Enter' \|\| key === ' '` |
| `onkeyup`       | `(event: KeyboardEvent) => void`      | `isPending`  | `preventDefault()` iff `key === 'Enter' \|\| key === ' '` |

Handler parameters are typed with the *base* DOM types (`Event`, `KeyboardEvent`) so the payload
stays assignable to any element's handler type under contravariance — no `any`, no per-element
generic.

---

## Entity 4 — `PendingChildProps` (the `child` snippet payload)

`PendingAttributes & Record<string, unknown>` — the same payload after merging, in this exact order:

```
{ ...restProps, class: cn(className), ...pendingProps }
```

`pendingProps` last (upstream parity, research R4). `class` is only present when the caller passed
one; the component contributes no classes of its own in `child` mode.

---

## Entity 5 — `PendingRootProps` (the wrapper component's props)

| Field          | Type                                      | Default       | Bindable | Notes                                            |
| -------------- | ----------------------------------------- | ------------- | -------- | ------------------------------------------------ |
| `ref`          | `HTMLSpanElement \| null`                 | `null`        | **yes**  | Bound to the fallback span; `null` in `child` mode |
| `id`           | `string \| undefined`                     | `$props.id()` | no       | Forwarded into `usePending`                       |
| `isPending`    | `boolean`                                 | `false`       | no       | Never written by the component                    |
| `disabled`     | `boolean`                                 | `false`       | no       | Styling flag only; never sets native `disabled`   |
| `class`        | `ClassValue`                              | `undefined`   | no       | Merged last: `cn('contents', className)`          |
| `children`     | `Snippet`                                 | `undefined`   | no       | Fallback mode                                     |
| `child`        | `Snippet<[{ props: PendingChildProps }]>` | `undefined`   | no       | Merge mode; wins over `children`                  |
| `...restProps` | `HTMLAttributes<HTMLSpanElement>`         | —             | no       | Spread first, so pending attributes always win    |

---

## State transitions

There is exactly one axis, driven entirely from outside:

```
        consumer sets isPending = true
 idle ───────────────────────────────────▶ pending
      ◀───────────────────────────────────
        consumer sets isPending = false
```

| From    | To      | Trigger                   | Observable effect                                                                  |
| ------- | ------- | ------------------------- | ---------------------------------------------------------------------------------- |
| idle    | pending | consumer prop change only | `aria-busy`, `aria-disabled`, `data-pending` appear; the seven handlers are emitted |
| pending | idle    | consumer prop change only | those attributes disappear; handler keys are omitted, restoring the consumer's own  |

The component never initiates a transition — there is no internal timer, promise or transition
tracking (spec Assumptions: no `useFormStatus` / `useTransition` equivalent is introduced).
`disabled` is an **independent** axis: it toggles `data-disabled` alone and never affects ARIA,
handlers or focusability.

## Validation rules

1. `<Pending>` with neither `children` nor `child` **throws** at render:
   `` `<Pending>` requires exactly one child: pass it as `children`, or spread the merged props onto your own element with the `child` snippet. ``
2. When both snippets are supplied, `child` renders and `children` does not (repo convention, see
   `status.svelte`).
3. An empty-string `id` is treated as absent (upstream `||` semantics).
4. No other input can be invalid — `isPending` and `disabled` are plain booleans with `false`
   defaults.
