# Public API Contract: Segmented Input

**Feature**: `018-port-segmented-input` | **Entry point**: `$lib/components/ui/segmented-input/index.js`

This is the installable surface. Every symbol below is exported from the barrel; nothing else is.
Derived from `.reference/diceui/docs/types/radix/segmented-input.ts`,
`docs/registry/bases/radix/ui/segmented-input.tsx` and
`docs/content/docs/components/radix/segmented-input.mdx` at the pinned commit, plus the enhancements
recorded in [spec.md § Assumptions](../spec.md#assumptions).

---

## 1. Barrel

```ts
// src/lib/components/ui/segmented-input/index.ts
import Root from './segmented-input.svelte';
import Item from './segmented-input-item.svelte';

export type { SegmentedInputChildProps, SegmentedInputProps, SegmentedInputRootProps } from './segmented-input.svelte';
export type { SegmentedInputItemChildProps, SegmentedInputItemProps, SegmentedInputItemType } from './segmented-input-item.svelte';

export {
	getSegmentedInputContext,
	hasSegmentedInputContext,
	segmentedInputItemVariants,
	SEGMENTED_INPUT_ORIENTATIONS,
	SEGMENTED_INPUT_SIZES,
	SegmentedInputRootState,
	setSegmentedInputContext,
	type SegmentedInputOrientation,
	type SegmentedInputRootStateProps,
	type SegmentedInputSize
} from './segmented-input.svelte.js';

export {
	resolveSegmentIntent,
	resolveSegmentPosition,
	SEGMENT_ORIENTATIONS,
	SEGMENT_POSITIONS,
	SegmentNavigation,
	splitPastedValue,
	type SegmentEntryMeta,
	type SegmentIntent,
	type SegmentNavigationProps,
	type SegmentOrientation,
	type SegmentPosition
} from './segment-navigation.svelte.js';

export {
	Root,
	Item,
	//
	Root as SegmentedInput,
	Item as SegmentedInputItem
};
```

`SegmentedInputItemType` (`Exclude<HTMLInputTypeAttribute, 'file'>`) is an **intentional addition**
to the upstream surface: D-04 narrows the item's `type` prop, and a consumer writing their own
wrapper around `<SegmentedInput.Item>` needs the narrowed alias by name rather than restating the
exclusion. It is the only symbol in the barrel that upstream has no counterpart for.

Both import styles work, matching every other ported component:

```ts
import * as SegmentedInput from '$lib/components/ui/segmented-input/index.js'; // .Root / .Item
import { SegmentedInput, SegmentedInputItem } from '$lib/components/ui/segmented-input/index.js';
```

---

## 2. `SegmentedInput.Root` — `segmented-input.svelte`

Renders `<div role="group">`. Upstream: `SegmentedInput`.

**Base type**: `WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'dir'>, HTMLDivElement>` — every
native `<div>` attribute is forwarded through `...restProps`. `dir` is omitted from the base so the
typed `Direction` prop below can replace the loose `string` HTML attribute.

| Prop           | Type                                              | Default        | Bindable | Notes                                                                                     |
| -------------- | ------------------------------------------------- | -------------- | -------- | ----------------------------------------------------------------------------------------- |
| `ref`          | `HTMLDivElement \| null`                          | `null`         | **yes**  | `bind:this` on the rendered `<div>`. Not applied when `child` is used (D-03).              |
| `size`         | `'default' \| 'sm' \| 'lg'`                       | `'default'`    | no       | Upstream `@default "default"`. Scales every item (FR-005).                                 |
| `dir`          | `'ltr' \| 'rtl'`                                  | *(resolved)*   | no       | Upstream `@default "ltr"`. When omitted, resolves via `useDirection()`: nearest `<DirectionProvider>` → nearest DOM `[dir]` ancestor → `'ltr'` (FR-012, R-04). |
| `orientation`  | `'horizontal' \| 'vertical'`                      | `'horizontal'` | no       | Upstream `@default "horizontal"`.                                                          |
| `disabled`     | `boolean`                                         | `false`        | no       | Applies to every item unless the item overrides it (FR-006).                               |
| `invalid`      | `boolean`                                         | `false`        | no       | Applies to every item; **no** per-item override exists (FR-006).                            |
| `required`     | `boolean`                                         | `false`        | no       | Applies to every item unless the item overrides it (FR-006).                               |
| `class`        | `string`                                          | —              | no       | Merged **last** through `cn()`.                                                            |
| `children`     | `Snippet`                                         | —              | no       | The items.                                                                                 |
| `child`        | `Snippet<[{ props: SegmentedInputChildProps }]>`   | —              | no       | Replaces upstream `asChild` (radix) / `render` (base). When present, the default `<div>` is not rendered (FR-016, R-05). |
| `...restProps` | `HTMLAttributes<HTMLDivElement>`                  | —              | —        | Spread onto the rendered element.                                                          |

**Callbacks / events**: none of its own. Native `<div>` handlers (`onclick`, `onfocusin`, …) pass
through `restProps`, matching upstream, which also declares no callback props.

**Snippets**: `children`, `child`.

### `SegmentedInputChildProps`

```ts
export type SegmentedInputChildProps = {
	'data-slot': 'segmented-input';
	'data-orientation': SegmentedInputOrientation;
	'data-disabled': '' | undefined;
	'data-invalid': '' | undefined;
	'data-required': '' | undefined;
	role: 'group';
	'aria-orientation': SegmentedInputOrientation;
	dir: Direction;
	class: string;
} & Record<string, unknown>;
```

---

## 3. `SegmentedInput.Item` — `segmented-input-item.svelte`

Renders `$lib/components/ui/input`'s `Input` → `<input>`. Upstream: `SegmentedInputItem`.

**Base type**: `WithElementRef<Omit<HTMLInputAttributes, 'type' | 'value' | 'files'>, HTMLInputElement>`
— every native `<input>` attribute (`placeholder`, `maxlength`, `inputmode`, `pattern`, `min`,
`max`, `readonly`, `name`, `aria-label`, `oninput`, `onchange`, …) is forwarded through
`...restProps` (FR-002).

| Prop           | Type                                                  | Default          | Bindable | Notes                                                                                          |
| -------------- | ----------------------------------------------------- | ---------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `ref`          | `HTMLInputElement \| null`                            | `null`           | **yes**  | `bind:this` on the `<input>`. Also the node registered for navigation.                          |
| `value`        | `string \| number \| null \| undefined`               | `undefined`      | **yes**  | Forwarded to `Input`'s own `$bindable` value. `bind:value={get, set}` keeps the caller authoritative, including against paste distribution (R-11). |
| `type`         | `Exclude<HTMLInputTypeAttribute, 'file'>`             | `undefined`      | no       | `'file'` excluded (D-04) — a file input has no caret, no `maxlength`, and cannot take a paste part. |
| `position`     | `'isolated' \| 'first' \| 'middle' \| 'last'`         | *(auto)*         | no       | Upstream `@default Auto-detected based on position in children array`. An explicit value always wins (FR-003). |
| `disabled`     | `boolean`                                             | *(inherits root)* | no      | `undefined` inherits; an explicit `false` overrides a disabled group (FR-006).                  |
| `required`     | `boolean`                                             | *(inherits root)* | no      | Same inheritance rule (FR-006).                                                                 |
| `class`        | `string`                                              | —                | no       | Merged **last**.                                                                                |
| `child`        | `Snippet<[{ props: SegmentedInputItemChildProps }]>`   | —                | no       | Replaces upstream `asChild` / `render`.                                                          |
| `...restProps` | `HTMLInputAttributes`                                 | —                | —        | Spread onto the `<input>`.                                                                       |

**Callbacks / events**: upstream declares none beyond the native input handlers, and neither does
this port — `oninput` / `onchange` are the value channel, exactly as in all four upstream demos.
Two native handlers are **composed** rather than overwritten (R-12):

| Handler     | Behaviour                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `onkeydown` | the caller's handler runs first; if it calls `preventDefault()`, segment navigation is skipped entirely           |
| `onpaste`   | the caller's handler runs first; if it calls `preventDefault()`, paste distribution is skipped entirely           |

That `preventDefault()` is the documented opt-out for both enhancements — no extra prop is invented.

**Snippets**: `child` only. The item renders a void `<input>`, so it takes no `children` (upstream
does not either).

### `SegmentedInputItemChildProps`

```ts
export type SegmentedInputItemChildProps = {
	'data-slot': 'segmented-input-item';
	'data-orientation': SegmentedInputOrientation;
	'data-position': SegmentPosition;
	'data-disabled': '' | undefined;
	'data-invalid': '' | undefined;
	'data-required': '' | undefined;
	'aria-invalid': true | undefined;
	'aria-required': true | undefined;
	disabled: boolean;
	required: boolean;
	class: string;
} & Record<string, unknown>;
```

---

## 4. Reusable navigation module — `segment-navigation.svelte.ts`

Exported from the barrel for Time Picker (FR-015, R-13). Depends on nothing in this component.

```ts
export type SegmentEntryMeta = {
	readonly getDisabled: () => boolean;
	readonly getReadOnly: () => boolean;
	readonly getMaxLength: () => number | undefined;
	readonly setValue: (next: string) => void;
};

export type SegmentNavigationProps = {
	readonly getOrientation: () => SegmentOrientation;
	readonly getDir: () => Direction;
};

export class SegmentNavigation {
	constructor(props: SegmentNavigationProps);
	readonly count: number;                                     // $derived
	register(id: string, element: HTMLInputElement, meta: SegmentEntryMeta): void;
	unregister(id: string): void;
	indexOf(id: string): number;                                // -1 when unregistered
	positionOf(id: string): SegmentPosition;
	focusAt(index: number, caret: 'start' | 'end'): void;
	onKeydown(event: KeyboardEvent, id: string): void;
	onPaste(event: ClipboardEvent, id: string): void;
}

export function resolveSegmentPosition(index: number, count: number): SegmentPosition;
export function resolveSegmentIntent(key: string, orientation: SegmentOrientation, dir: Direction): SegmentIntent | null;
export function splitPastedValue(text: string, maxLengths: readonly (number | undefined)[]): string[];
```

Time Picker's usage will be:

```ts
import { SegmentNavigation } from '$lib/components/ui/segmented-input/index.js';
const nav = new SegmentNavigation({ getOrientation: () => 'horizontal', getDir: () => dir });
```

---

## 5. Keyboard contract

| Key                   | Orientation  | Direction  | Guard                                   | Result                                   |
| --------------------- | ------------ | ---------- | --------------------------------------- | ---------------------------------------- |
| `Tab`                 | both         | both       | none                                    | next input in document order (native)    |
| `Shift+Tab`           | both         | both       | none                                    | previous input in document order (native) |
| `ArrowRight`          | `horizontal` | `ltr`      | caret at end of value, no selection     | next enabled segment, caret at start     |
| `ArrowRight`          | `horizontal` | `rtl`      | caret at 0, no selection                | previous enabled segment, caret at end   |
| `ArrowLeft`           | `horizontal` | `ltr`      | caret at 0, no selection                | previous enabled segment, caret at end   |
| `ArrowLeft`           | `horizontal` | `rtl`      | caret at end of value, no selection     | next enabled segment, caret at start     |
| `ArrowDown`           | `vertical`   | both       | caret at end of value, no selection     | next enabled segment, caret at start     |
| `ArrowUp`             | `vertical`   | both       | caret at 0, no selection                | previous enabled segment, caret at end   |
| `Home`                | both         | both       | an enabled segment exists               | first enabled segment, caret at start    |
| `End`                 | both         | both       | an enabled segment exists               | last enabled segment, caret at end       |
| everything else       | —            | —          | —                                       | untouched                                |

No wraparound in any case (FR-010). Disabled segments are skipped and never focused. When a guard
fails, the event is not `preventDefault()`ed and the browser's own caret movement runs.

---

## 6. Data-attribute contract

See [data-model.md § 5](../data-model.md#5-dom-contract). Every state the component knows is
reachable from CSS with no JavaScript:

```css
[data-slot='segmented-input'][data-orientation='vertical'] { /* … */ }
[data-slot='segmented-input-item'][data-position='middle'] { /* … */ }
[data-slot='segmented-input-item'][data-invalid] { /* … */ }
```

---

## 7. Registry item

```jsonc
{
	"name": "segmented-input",
	"type": "registry:ui",
	"title": "Segmented Input",
	"description": "A group of connected input fields that appear as a single segmented visual unit.",
	"registryDependencies": ["input", "direction-provider", "speed-dial"],
	"dependencies": ["tailwind-variants"],
	"files": [
		{ "path": "src/lib/components/ui/segmented-input/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/segmented-input/segmented-input.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/segmented-input/segmented-input-item.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/segmented-input/segmented-input.svelte.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/segmented-input/segment-navigation.svelte.ts", "type": "registry:ui" }
	]
}
```

Test files (`segmented-input.test.ts`, `segmented-input.test.svelte`) are deliberately **not**
listed (Principle V).

---

## 8. Controlled / uncontrolled idiom

The root carries no value; each item does, and it is a plain native input value:

```svelte
<!-- uncontrolled: the DOM owns it -->
<SegmentedInput.Root>
	<SegmentedInput.Item placeholder="First" aria-label="First name" />
</SegmentedInput.Root>

<!-- bound: the component moves your state -->
<SegmentedInput.Root>
	<SegmentedInput.Item bind:value={first} aria-label="First name" />
</SegmentedInput.Root>

<!-- authoritative: you decide whether the write lands (paste included) -->
<SegmentedInput.Root>
	<SegmentedInput.Item
		bind:value={() => first, (next) => (first = next.toUpperCase())}
		aria-label="First name"
	/>
</SegmentedInput.Root>

<!-- upstream idiom: value + oninput, unchanged -->
<SegmentedInput.Root>
	<SegmentedInput.Item value={first} oninput={(e) => (first = e.currentTarget.value)} />
</SegmentedInput.Root>
```
