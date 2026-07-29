# Contract: `pending` public API

**Feature**: `003-port-pending` | **Date**: 2026-07-29

This is the interface a consumer gets after
`npx shadcn-svelte@latest add <registry>/pending`. It is the acceptance surface for
`pending.test.ts` and for the API tables on `/docs/components/pending`.

Import path (in-repo and after install):

```ts
import * as Pending from '$lib/components/ui/pending/index.js';
import { Pending as PendingRoot, usePending } from '$lib/components/ui/pending/index.js';
```

---

## 1. Barrel (`src/lib/components/ui/pending/index.ts`)

| Export           | Kind      | Notes                                                      |
| ---------------- | --------- | ---------------------------------------------------------- |
| `Root`           | component | The wrapper                                                |
| `Pending`        | component | Alias of `Root` (upstream name)                            |
| `usePending`     | function  | The hook surface                                           |
| `PendingState`   | class     | The type of `usePending`'s return value                    |
| `createPendingId`| function  | `() => string` — the `pending-<n>` generator               |
| `UsePendingOptions`  | type  | Options of `usePending`                                    |
| `UsePendingReturn`   | type  | Alias of `PendingState` — upstream name parity             |
| `PendingAttributes`  | type  | The spreadable payload                                     |
| `PendingChildProps`  | type  | `child` snippet payload                                    |
| `PendingRootProps`   | type  | Props of the wrapper                                       |

---

## 2. `usePending(options?): PendingState`

```ts
type UsePendingOptions = {
	/**
	 * The ID of the element. If not provided, an ID will be automatically generated.
	 */
	id?: () => string | undefined;
	/**
	 * Whether the element is in a pending state.
	 * This disables press and hover events while retaining focusability,
	 * and sets aria-busy and aria-disabled for screen readers.
	 * @default false
	 */
	isPending?: () => boolean | undefined;
	/**
	 * Whether the element is disabled.
	 * When pending, the element will be aria-disabled but remain focusable.
	 * @default false
	 */
	disabled?: () => boolean | undefined;
};
```

Usage — note the spread position:

```svelte
<script lang="ts">
	import { usePending } from '$lib/components/ui/pending/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	let isSubmitting = $state(false);
	const pending = usePending({ isPending: () => isSubmitting });
</script>

<!-- ✅ prevention wins -->
<Button onclick={onSubmit} {...pending.pendingProps}>Submit</Button>

<!-- ❌ onclick would override the prevention -->
<Button {...pending.pendingProps} onclick={onSubmit}>Submit</Button>
```

### Contract guarantees

| ID    | Guarantee                                                                                                    | Spec |
| ----- | ------------------------------------------------------------------------------------------------------------ | ---- |
| H-01  | `pendingProps.id` equals the supplied id verbatim when truthy                                                 | FR-007 |
| H-02  | With no id (or `''`), `pendingProps.id` is a generated `pending-<n>`, stable for the instance's lifetime       | FR-007 |
| H-03  | Idle: `pendingProps` contains `id` and `data-slot` only — **no** `aria-*`, `data-pending`, or handler keys     | FR-005 |
| H-04  | Pending: `aria-busy="true"`, `aria-disabled="true"`, `data-pending=""` present                                | FR-003, FR-005 |
| H-05  | Pending: `onclick`, `onpointerdown`, `onpointerup`, `onmousedown`, `onmouseup` call `preventDefault()`         | FR-004 |
| H-06  | Pending: `onkeydown`/`onkeyup` call `preventDefault()` for `Enter` and `' '` and for **no other key**          | FR-004 |
| H-07  | `disabled` emits `data-disabled=""` and nothing else — independent of `isPending`                             | FR-006 |
| H-08  | Never sets the native `disabled` attribute and never changes `tabindex` — the element stays focusable          | FR-003, SC-003 |
| H-09  | `pendingProps` re-derives when any getter's value changes, with no remount                                    | FR-001 |
| H-10  | `isPending` is never written by the utility — the consumer is authoritative                                    | Key Entities |

---

## 3. `<Pending>` — the wrapper

```svelte
<script lang="ts">
	import * as Pending from '$lib/components/ui/pending/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
</script>

<!-- Merge mode: no extra DOM node, props land on the Button -->
<Pending.Root isPending={isSubmitting}>
	{#snippet child({ props })}
		<Button onclick={onSubmit} {...props}>Submit</Button>
	{/snippet}
</Pending.Root>

<!-- Fallback mode: a display:contents <span> carries the attributes -->
<Pending.Root isPending={isSubmitting}>
	<Button onclick={onSubmit}>Submit</Button>
</Pending.Root>
```

### Contract guarantees

| ID    | Guarantee                                                                                                          | Spec |
| ----- | -------------------------------------------------------------------------------------------------------------------- | ---- |
| W-01  | `child` mode renders **exactly** the caller's element — no wrapper node is added                                     | FR-002, US2-AC1 |
| W-02  | `props` handed to `child` = `{ ...restProps, class, ...pendingProps }`; pending keys win                              | FR-009 |
| W-03  | `children` mode renders one `<span data-slot="pending" class="contents">` carrying the same id/ARIA/data attributes    | FR-002 (divergence D1/D2) |
| W-04  | `children` mode prevents interaction with the descendant via capture-phase `preventDefault()` + `stopPropagation()`    | FR-004, FR-008 |
| W-05  | Both modes produce the same attribute set for the same inputs, differing only in which element hosts it               | FR-008 |
| W-06  | Neither snippet supplied → throws `/requires exactly one child/`                                                      | Edge Cases |
| W-07  | Both snippets supplied → `child` renders, `children` does not                                                         | repo convention |
| W-08  | `id` defaults to `$props.id()`; an explicit `id` wins over the child's own `id` (it is spread last)                    | FR-007 |
| W-09  | `class` is merged last through `cn('contents', className)` in fallback mode                                           | Constitution VIII |
| W-10  | `bind:ref` binds the fallback span; in `child` mode `ref` stays `null`                                                | CLAUDE.md §4 |
| W-11  | Works identically under `dir="rtl"` — no directional behaviour of its own                                             | FR-011 |
| W-12  | Composes with any element type: `<button>`, `<a href>`, `<Switch>`, `<Input>`                                         | FR-010 |

---

## 4. Data attributes (docs table)

| Attribute       | Part      | Values                                              |
| --------------- | --------- | --------------------------------------------------- |
| `[data-slot]`   | `Pending` | `pending`                                           |
| `[data-pending]`| `Pending` | present (empty string) while `isPending` is `true`  |
| `[data-disabled]`| `Pending`| present (empty string) while `disabled` is `true`   |

## 5. Registry contract

```jsonc
{
	"name": "pending",
	"type": "registry:ui",
	"title": "Pending",
	"description": "A utility that disables interactions, keeps keyboard focus and wires the correct ARIA state for buttons, forms, links, switches and any interactive element while it is pending.",
	"registryDependencies": [],
	"dependencies": [],
	"files": [
		{ "path": "src/lib/components/ui/pending/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/pending/pending.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/pending/pending.svelte.ts", "type": "registry:ui" }
	]
}
```

`registryDependencies` is empty: the component imports only `cn` / `WithElementRef` from
`$lib/utils.js`, which the shadcn CLI provides. `dependencies` is empty: no npm package is added
(`clsx` and `tailwind-merge` arrive with `utils`). Test files and the harness are **not** listed.
