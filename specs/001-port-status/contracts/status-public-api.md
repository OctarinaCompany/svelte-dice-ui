# Contract: `status` public API

**Feature**: `001-port-status` | Derived from `.reference/diceui/docs/registry/bases/radix/ui/status.tsx`
and `.reference/diceui/docs/types/radix/status.ts` at pinned commit `d9763d8`.

This file is the acceptance contract for the port. Anything here that the implementation does not
expose is a defect; anything the implementation exposes that is not here is undocumented drift
(Principle II).

---

## 1. Barrel — `src/lib/components/ui/status/index.ts`

```ts
import Root from './status.svelte';
import Indicator from './status-indicator.svelte';
import Label from './status-label.svelte';

export {
	statusVariants,
	STATUS_VARIANTS,
	resolveStatusVariant,
	type StatusVariant,
	type StatusRootProps,
	type StatusChildProps
} from './status.svelte';
export { type StatusIndicatorProps } from './status-indicator.svelte';
export { type StatusLabelProps } from './status-label.svelte';

export {
	Root,
	Indicator,
	Label,
	//
	Root as Status,
	Indicator as StatusIndicator,
	Label as StatusLabel
};
```

Both consumption styles must work:

```ts
import * as Status from '$lib/components/ui/status/index.js'; // Status.Root, Status.Indicator
import { Status, StatusIndicator, StatusLabel } from '$lib/components/ui/status/index.js';
```

## 2. `Status` (root) — `status.svelte`

### Module script exports

```ts
export const STATUS_VARIANTS = ['default', 'success', 'error', 'warning', 'info'] as const;
export type StatusVariant = (typeof STATUS_VARIANTS)[number];
export function resolveStatusVariant(value?: string): StatusVariant;
export const statusVariants: /* tv(...) */;
export type StatusChildProps = { 'data-slot': 'status'; 'data-variant': StatusVariant; class: string } & Record<string, unknown>;
export type StatusRootProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
	variant?: StatusVariant;
	child?: Snippet<[{ props: StatusChildProps }]>;
};
```

### Props

| Prop           | Type                                     | Default     | Bindable | Upstream name              |
| -------------- | ---------------------------------------- | ----------- | -------- | -------------------------- |
| `ref`          | `HTMLDivElement \| null`                 | `null`      | **yes**  | React `ref` (forwardRef)   |
| `variant`      | `StatusVariant`                          | `'default'` | no       | `variant`                  |
| `class`        | `ClassValue`                             | `undefined` | no       | `className`                |
| `children`     | `Snippet`                                | `undefined` | no       | `children`                 |
| `child`        | `Snippet<[{ props: StatusChildProps }]>` | `undefined` | no       | `asChild` **(divergence)** |
| `...restProps` | `HTMLAttributes<HTMLDivElement>`         | —           | —        | `...rootProps`             |

### JSDoc to copy verbatim (from `docs/types/radix/status.ts`)

On `variant`:

```
The visual style and color theme of the status badge.

- `"default"`: Neutral muted gray styling
- `"success"`: Green styling for online/active states
- `"error"`: Red styling for offline/error states
- `"warning"`: Orange styling for away/warning states
- `"info"`: Blue styling for idle/informational states

@default "default"
```

On `child` (adapted from upstream's `asChild`, with the divergence spelled out):

```
Render the badge onto your own element instead of the default `<div>`.
The snippet receives the merged props (class, data-slot, data-variant and every
forwarded attribute) to spread onto that element.

Replaces upstream's `asChild` (Radix `Slot`), which has no Svelte equivalent.
In `child` mode `children` is not rendered and `ref` is not populated — the
caller owns the element.
```

### Callbacks / events

None of its own. Every standard DOM handler (`onclick`, `onkeydown`, `onfocus`, `onmouseenter`, …)
is accepted through `restProps` and spread onto the rendered element, matching upstream's
`{...rootProps}`.

### Data attributes

| Attribute      | Values                                                   |
| -------------- | -------------------------------------------------------- |
| `data-slot`    | `status`                                                 |
| `data-variant` | `default` \| `success` \| `error` \| `warning` \| `info` |

Matches the MDX `<DataAttributesTable>` exactly.

### Render contract

```svelte
{#if child}
	{@render child({ props: rootAttrs })}
{:else}
	<div bind:this={ref} {...rootAttrs}>{@render children?.()}</div>
{/if}
```

where `rootAttrs` = `{ 'data-slot': 'status', 'data-variant': resolved, class: cn(statusVariants({ variant: resolved }), className), ...restProps }`
and `resolved` = `$derived(resolveStatusVariant(variant))`.

## 3. `StatusIndicator` — `status-indicator.svelte`

```ts
export type StatusIndicatorProps = WithElementRef<HTMLAttributes<HTMLDivElement>>;
```

| Prop           | Type                             | Default     | Bindable |
| -------------- | -------------------------------- | ----------- | -------- |
| `ref`          | `HTMLDivElement \| null`         | `null`      | **yes**  |
| `class`        | `ClassValue`                     | `undefined` | no       |
| `children`     | `Snippet`                        | `undefined` | no       |
| `...restProps` | `HTMLAttributes<HTMLDivElement>` | —           | —        |

Snippets: `children`. Callbacks: none. Data attribute: `data-slot="status-indicator"`.

## 4. `StatusLabel` — `status-label.svelte`

```ts
export type StatusLabelProps = WithElementRef<HTMLAttributes<HTMLDivElement>>;
```

Identical prop shape to `StatusIndicator`. Data attribute: `data-slot="status-label"`.

## 5. Class map (upstream → ported)

Any change to this table is a parity change and must be justified in `research.md`.

### Root base

Unchanged from upstream, verbatim:

```
inline-flex w-fit shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap
rounded-full border px-2.5 py-1 text-xs font-medium transition-colors
```

### Root variants

| Variant   | Ported classes                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------- |
| `default` | `border-transparent bg-muted text-muted-foreground **:data-[slot=status-indicator]:bg-muted-foreground`   |
| `success` | `border-success/20 bg-success/10 text-success **:data-[slot=status-indicator]:bg-success`                 |
| `error`   | `border-destructive/20 bg-destructive/10 text-destructive **:data-[slot=status-indicator]:bg-destructive` |
| `warning` | `border-warning/20 bg-warning/10 text-warning **:data-[slot=status-indicator]:bg-warning`                 |
| `info`    | `border-info/20 bg-info/10 text-info **:data-[slot=status-indicator]:bg-info`                             |

`defaultVariants: { variant: 'default' }`.

### Indicator

Verbatim from upstream:

```
relative flex size-2 shrink-0 rounded-full
before:absolute before:inset-0 before:animate-ping before:rounded-full before:bg-inherit
after:absolute after:inset-[2px] after:rounded-full after:bg-inherit
```

### Label

Verbatim from upstream: `leading-none`.

## 6. Divergences from upstream (all recorded in `spec.md` Assumptions)

| #   | Upstream                                          | Ported                                | Reason                                                                 |
| --- | ------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| 1   | `asChild?: boolean` (Radix `Slot`)                | `child?: Snippet<[{ props }]>`        | no Svelte equivalent of `Slot`; `CLAUDE.md` §10 mandates `child`       |
| 2   | `green-*` / `orange-* `/ `blue-*` + `dark:` pairs | `success` / `warning` / `info` tokens | Principle VIII; tokens already flip per theme                          |
| 3   | `cva` from `class-variance-authority`             | `tv()` from `tailwind-variants`       | Principle VIII / repo convention (`badge.svelte`)                      |
| 4   | unknown `variant` → base classes only             | unknown `variant` → `default`         | spec Edge Cases; additive, invisible to typed callers                  |
| 5   | Base-UI `render` prop variant                     | not ported                            | the two upstream bases are behaviourally identical; radix is canonical |

Everything else — prop names, defaults, `data-slot` values, `data-variant` values, base classes,
indicator/label classes, and the `statusVariants` export name — is identical to upstream.
