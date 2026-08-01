# Phase 1 Contract: Stack public API

**Feature**: `039-port-stack` | **Date**: 2026-08-01

This file is the authoritative surface for the port. Every row is traceable to
`.reference/diceui/docs/types/radix/stack.ts`, `.../registry/bases/radix/ui/stack.tsx`, or the MDX
`DataAttributesTable`s. Anything not listed here is not part of the API.

---

## Barrel — `src/lib/components/ui/stack/index.ts`

```ts
import Root from './stack.svelte';
import Item from './stack-item.svelte';

export { type StackChildProps, type StackProps, type StackRootProps } from './stack.svelte';
export {
	stackItemWrapperVariants,
	type StackItemChildProps,
	type StackItemProps
} from './stack-item.svelte';
export {
	getStackContext,
	setStackContext,
	StackState,
	STACK_SIDES,
	type StackSide,
	type StackStateProps
} from './stack.svelte.js';

export {
	Root,
	Item,
	//
	Root as Stack,
	Item as StackItem
};
```

Both call styles are supported, matching CLAUDE.md §3 and the MDX Layout snippet:

```ts
import * as Stack from '$lib/components/ui/stack/index.js'; // Stack.Root, Stack.Item
import { Stack, StackItem } from '$lib/components/ui/stack/index.js';
```

---

## `Stack.Root` (`Stack`)

Upstream: `Stack` in `stack.tsx:55`, props from `StackProps` in `types/radix/stack.ts`.

Base type: `WithElementRef<HTMLAttributes<HTMLDivElement>>` — every standard `div` attribute and DOM
handler is accepted and spread onto the element (FR-013).

### Props

| Prop                 | Type                                              | Default      | Bindable | Upstream                    |
| -------------------- | ------------------------------------------------- | ------------ | -------- | --------------------------- |
| `side`               | `'top' \| 'bottom'`                               | `'bottom'`   | no       | `side`                      |
| `itemCount`          | `number`                                          | `3`          | no       | `itemCount`                 |
| `expandedItemCount`  | `number \| undefined`                             | `undefined` (= all items) | no | `expandedItemCount`      |
| `gap`                | `number` (px)                                     | `8`          | no       | `gap`                       |
| `scale`              | `number`                                          | `0.05`       | no       | `scale`                     |
| `offset`             | `number` (px)                                     | `10`         | no       | `offset`                    |
| `expandOnHover`      | `boolean`                                         | `false`      | no       | `expandOnHover`             |
| `class`              | `string \| undefined`                             | `undefined`  | no       | `className` (merged last)   |
| `style`              | `string \| undefined`                             | `undefined`  | no       | `style` (appended last, wins) |
| `ref`                | `HTMLDivElement \| null`                          | `null`       | **yes**  | `forwardRef` / element ref  |
| `children`           | `Snippet \| undefined`                            | `undefined`  | no       | `children`                  |
| `child`              | `Snippet<[{ props: StackChildProps }]> \| undefined` | `undefined` | no    | `asChild` (Radix `Slot`)    |

JSDoc from `types/radix/stack.ts`, including every `@default`, is copied verbatim onto these props.

### Composed event handlers

Accepted through `restProps`, but intercepted and composed (caller first, then
`if (event.defaultPrevented) return`, then the stack's own logic):

| Attribute       | Stack's own behaviour                                       |
| --------------- | ----------------------------------------------------------- |
| `onmouseenter`  | `expandOnHover` → expand                                    |
| `onmousemove`   | `expandOnHover` → expand                                    |
| `onmouseleave`  | `expandOnHover && !interacting` → collapse                  |
| `onpointerdown` | `interacting = true`                                        |
| `onpointerup`   | `interacting = false`                                       |

### Data attributes

| Attribute        | Values                        | Source                                      |
| ---------------- | ----------------------------- | ------------------------------------------- |
| `data-slot`      | `"stack"`                     | `stack.tsx:178`                             |
| `data-state`     | `"expanded" \| "collapsed"`   | `stack.tsx:179`                             |
| `data-expanded`  | `"true" \| "false"`           | MDX `DataAttributesTable` (research R-10)   |

### Inline custom properties

`--gap: {gap}px; --offset: {offset}px; --scale: {scale};` — a caller-supplied `style` string is
appended after these, so the caller wins (matching upstream's `...style` spread).

### Base classes

`relative w-full`, then the caller's `class` merged last through `cn()`.

### `StackChildProps`

The payload handed to the `child` snippet — the complete merged attribute object, so
`{...props}` on any element reproduces the default rendering exactly:

```ts
export type StackChildProps = {
	'data-slot': 'stack';
	'data-state': 'expanded' | 'collapsed';
	'data-expanded': 'true' | 'false';
	style: string;
	class: string;
	onmouseenter: MouseEventHandler<HTMLDivElement>;
	onmousemove: MouseEventHandler<HTMLDivElement>;
	onmouseleave: MouseEventHandler<HTMLDivElement>;
	onpointerdown: PointerEventHandler<HTMLDivElement>;
	onpointerup: PointerEventHandler<HTMLDivElement>;
} & Record<string, unknown>;
```

In `child` mode `children` is **not** rendered by the root — the snippet owns the subtree — and `ref`
stays `null`.

---

## `Stack.Item` (`StackItem`)

Upstream: `StackItem` (`stack.tsx:331`) rendered inside the internal `StackItemWrapper`
(`stack.tsx:240`). The port renders **both elements** from this one component (research R-01).

Base type: `WithElementRef<HTMLAttributes<HTMLDivElement>>`.

### Props

| Prop       | Type                                                    | Default     | Bindable | Upstream               |
| ---------- | ------------------------------------------------------- | ----------- | -------- | ---------------------- |
| `class`    | `string \| undefined`                                   | `undefined` | no       | `className` (card, merged last) |
| `style`    | `string \| undefined`                                   | `undefined` | no       | `style` (card)         |
| `ref`      | `HTMLDivElement \| null`                                | `null`      | **yes**  | element ref (card)     |
| `children` | `Snippet \| undefined`                                  | `undefined` | no       | `children`             |
| `child`    | `Snippet<[{ props: StackItemChildProps }]> \| undefined` | `undefined` | no       | `asChild`              |

`Stack.Item` takes **no** `index` prop: the index is its document-order position in the root's
registry.

### Rendered DOM (identical shape to upstream)

```html
<!-- positioning wrapper — always a div, never replaced by `child` -->
<div
	data-slot="stack-item-wrapper"
	data-index="0"
	data-front="true"
	data-visible="true"
	data-expanded="false"
	style="--translate: 0px; --item-scale: 1; z-index: 3; opacity: 1;"
	class="… stackItemWrapperVariants({ side, isExpanded, isVisible }) …"
>
	<!-- card — this is what `child` replaces, and what `class` / `ref` / restProps apply to -->
	<div data-slot="stack-item" data-index="0" data-position="front" data-state="collapsed">…</div>
</div>
```

### Wrapper data attributes

| Attribute       | Values                                 | Source          |
| --------------- | -------------------------------------- | --------------- |
| `data-slot`     | `"stack-item-wrapper"`                 | `stack.tsx:297` |
| `data-index`    | `number`                               | MDX + `:298`    |
| `data-front`    | `"true" \| "false"`                    | MDX + `:299`    |
| `data-visible`  | `"true" \| "false"`                    | MDX + `:300`    |
| `data-expanded` | `"true" \| "false"`                    | `:301`          |

### Card data attributes

| Attribute       | Values                       | Source              |
| --------------- | ---------------------------- | ------------------- |
| `data-slot`     | `"stack-item"`               | `stack.tsx:339`     |
| `data-index`    | `number`                     | `stack.tsx:317`     |
| `data-position` | `"front" \| "back"`          | `stack.tsx:318`     |
| `data-state`    | `"expanded" \| "collapsed"`  | `stack.tsx:319`     |

### Wrapper inline style

`--translate: {translate}px; --item-scale: {itemScale}; z-index: {zIndex}; opacity: {opacity};`

### `stackItemWrapperVariants` (exported `tv()` — research R-03)

| Slot / axis           | Value                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `base`                | `absolute w-full transition-all duration-300 ease-out motion-reduce:transition-none`                                       |
| `side: 'top'`         | `top-0 start-0 origin-top translate-y-[calc(var(--translate)*-1)] scale-[var(--item-scale)] after:absolute after:top-full after:start-0 after:w-full after:content-['']` |
| `side: 'bottom'`      | `bottom-0 start-0 origin-bottom translate-y-[var(--translate)] scale-[var(--item-scale)] after:absolute after:bottom-full after:start-0 after:w-full after:content-['']` |
| `isExpanded: true`    | `after:h-[calc(var(--gap)+1px)]`                                                                                          |
| `isExpanded: false`   | `''`                                                                                                                      |
| `isVisible: true`     | `''`                                                                                                                      |
| `isVisible: false`    | `pointer-events-none`                                                                                                     |

No `defaultVariants` — the root always supplies `side`, the item always supplies both booleans.

### Card base classes

`rounded-lg border bg-card p-4 shadow-sm transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none`,
then the caller's `class` merged last through `cn()`.

### `StackItemChildProps`

```ts
export type StackItemChildProps = {
	'data-slot': 'stack-item';
	'data-index': number;
	'data-position': 'front' | 'back';
	'data-state': 'expanded' | 'collapsed';
	class: string;
} & Record<string, unknown>;
```

---

## Errors

| Situation                                    | Behaviour                                                            |
| -------------------------------------------- | -------------------------------------------------------------------- |
| `<Stack.Item>` rendered with no `<Stack.Root>` ancestor | throws ``Error('`<Stack.Item>` must be used within `<Stack.Root>`.')`` |

---

## Explicitly **not** in the API

| Not exported / not added         | Why                                                                 |
| -------------------------------- | -------------------------------------------------------------------- |
| `StackItemWrapper`               | internal upstream too; folded into `Stack.Item` (research R-01)       |
| `expanded` / `onExpandedChange`  | upstream has no controlled mode (research R-12)                       |
| `asChild` (boolean)              | replaced by the `child` snippet (research R-08)                       |
| `visibleItems`, `scaleFactor`    | stale MDX prose; the real props are `itemCount` / `scale` (R-10)      |
| any keyboard interaction         | upstream defines none; adding one is drift (research R-11)            |

---

## Registry contract — appended to `registry.json`

```jsonc
{
	"name": "stack",
	"type": "registry:ui",
	"title": "Stack",
	"description": "A component that displays items in a stacked layout with hover expansion effects, similar to Sonner toast stacking.",
	"registryDependencies": ["speed-dial"],
	"dependencies": ["tailwind-variants"],
	"files": [
		{ "path": "src/lib/components/ui/stack/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/stack/stack.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/stack/stack-item.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/stack/stack.svelte.ts", "type": "registry:ui" }
	]
}
```

`stack.test.ts` and `stack.test.svelte` are deliberately absent from `files` (CLAUDE.md §9).
