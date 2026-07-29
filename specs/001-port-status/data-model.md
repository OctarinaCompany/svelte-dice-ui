# Phase 1 Data Model: Port Status Component

**Feature**: `001-port-status` | **Date**: 2026-07-29

Status is a presentational component: it owns no persisted or reactive state. The "entities" below
are the compile-time types and the render-time attribute payloads that make up its contract.

## Entity 1 — `StatusVariant` (closed union)

The only piece of data the component carries.

```ts
export const STATUS_VARIANTS = ['default', 'success', 'error', 'warning', 'info'] as const;
export type StatusVariant = (typeof STATUS_VARIANTS)[number];
```

| Value     | Meaning (upstream JSDoc)                   | Token family  |
| --------- | ------------------------------------------ | ------------- |
| `default` | Neutral muted gray styling                 | `muted`       |
| `success` | Green styling for online/active states     | `success`     |
| `error`   | Red styling for offline/error states       | `destructive` |
| `warning` | Orange styling for away/warning states     | `warning`     |
| `info`    | Blue styling for idle/informational states | `info`        |

**Validation rule (FR-002, spec Edge Cases)**: any value outside the union — reachable only from
untyped runtime data — normalises to `default`.

```ts
export function resolveStatusVariant(value?: string): StatusVariant {
	return STATUS_VARIANTS.includes(value as StatusVariant) ? (value as StatusVariant) : 'default';
}
```

The `as StatusVariant` narrowing inside the guard is a union narrowing, not `any`, and is the
standard idiom for `readonly [...] as const` membership tests under `strict`.

**State transitions**: none. `variant` is an input prop; it changes only when the caller changes it,
and the root re-derives `resolved` and `class` from it. There is no internal transition, no
open/closed cycle, and no lifecycle.

## Entity 2 — `StatusChildProps` (the `child` snippet payload)

The merged attribute object the root hands to a caller-supplied `child` snippet.

```ts
export type StatusChildProps = {
	/** Always `"status"`. */
	'data-slot': 'status';
	/** The resolved variant. */
	'data-variant': StatusVariant;
	/** Variant classes with the caller's `class` merged last. */
	class: string;
} & Record<string, unknown>;
```

Composition rule — the object is built exactly once and used by both branches:

| Key             | Source                                                 | Precedence          |
| --------------- | ------------------------------------------------------ | ------------------- |
| `data-slot`     | literal `'status'`                                     | fixed               |
| `data-variant`  | `resolveStatusVariant(variant)`                        | fixed               |
| `class`         | `cn(statusVariants({ variant: resolved }), className)` | caller's class last |
| everything else | `...restProps` (`HTMLAttributes<HTMLDivElement>`)      | caller wins         |

Ordering note: upstream spreads `{...rootProps}` **before** `className`, i.e. the computed class
always wins over a raw `class` in rest props, while the caller's dedicated `className` prop is merged
into it. The port reproduces that by destructuring `class: className` out of `$props()` (so it can
never reach `restProps`) and spreading `...restProps` after the fixed keys.

## Entity 3 — Rendered attribute payloads (the styling API)

What consumers can select on. Every part carries exactly one `data-slot`; the root additionally
carries `data-variant`. No boolean data attributes exist on this component, so the
`cond ? '' : undefined` rule has no application here — it still governs later ports.

| Part               | Element (default)      | `data-slot`        | Other attributes            |
| ------------------ | ---------------------- | ------------------ | --------------------------- |
| `Status.Root`      | `div` (or the `child`) | `status`           | `data-variant="<resolved>"` |
| `Status.Indicator` | `div`                  | `status-indicator` | —                           |
| `Status.Label`     | `div`                  | `status-label`     | —                           |

`data-slot="status-indicator"` is **load-bearing**, not decorative: the root's variant classes colour
the dot through `**:data-[slot=status-indicator]:bg-<token>`. Renaming it breaks FR-003.

## Entity 4 — Component relationships

```text
Status.Root  (variant, class, child?, children?)
├── Status.Indicator?      optional, 0..1 by convention (not enforced)
└── Status.Label?          optional, 0..1 by convention (not enforced)
```

- **No context, no provider.** The parts are independent; the colour link is a CSS descendant
  selector, so `Status.Indicator` and `Status.Label` render standalone without throwing. This is
  upstream's behaviour and is deliberate (see research Decision 3) — it is why the
  "throws outside its provider" assertion from Constitution III is not applicable here.
- **Cardinality is not enforced.** Upstream renders whatever children it is given; FR-005 requires
  all four permutations (both / label only / indicator only / neither) to render correctly.
- **Ordering is caller-controlled.** DOM order is the caller's markup order; visual order follows
  the ambient `dir` because the root uses only logical flex layout (FR-010).

## Entity 5 — Registry item (distribution metadata)

| Field                  | Value                                                                          |
| ---------------------- | ------------------------------------------------------------------------------ |
| `name`                 | `status` (== folder slug == demo route segment)                                |
| `type`                 | `registry:ui`                                                                  |
| `title`                | `Status`                                                                       |
| `description`          | see [contracts/registry-item.json](./contracts/registry-item.json)             |
| `registryDependencies` | `[]` — imports no other shadcn primitive                                       |
| `dependencies`         | `["tailwind-variants"]`                                                        |
| `files`                | the four shipped files; **excludes** `status.test.ts` and `status.test.svelte` |

Consumed by `src/lib/registry.ts` → `getComponentItems()`, which drives both the docs sidebar and the
`/docs/components` index card, and which derives the route `/docs/components/status` from `name`.
