# svelte-dice-ui — porting conventions

`svelte-dice-ui` is a **Svelte 5 port of the [Dice UI](https://diceui.com) React library**, shipped as a
**shadcn-svelte registry**: every component lives as source in this repo, is documented by a demo route on
the SvelteKit docs site, and is installable by consumers through `registry.json`.

This file is loaded into every automated session. Follow it exactly — a port that ignores it will fail review.

---

## 1. Toolchain

| Concern    | Tool                                                                |
| ---------- | ------------------------------------------------------------------- |
| Framework  | SvelteKit 2 + Svelte 5 (**runes forced on**, see `vite.config.ts`)  |
| Styling    | Tailwind CSS v4 (`@tailwindcss/vite`, entry `src/app.css`)          |
| Primitives | shadcn-svelte (`components.json`, style `nova`, base colour `zinc`) |
| Headless   | `bits-ui`, `@lucide/svelte` icons                                   |
| Tests      | Vitest (jsdom) + `@testing-library/svelte` + `user-event`           |
| Lint       | ESLint flat config + `typescript-eslint` + `eslint-plugin-svelte`   |
| Format     | Prettier + `prettier-plugin-svelte` + `prettier-plugin-tailwindcss` |

### Quality gates — run all four, in this order, before finishing any port

```bash
pnpm run format          # always run first: shadcn CLI output is not prettier-formatted
pnpm run check           # svelte-kit sync && svelte-check
pnpm run lint            # prettier --check . && eslint .
pnpm run test:unit -- --run
pnpm run build
```

Never make a gate pass by suppressing it: no `@ts-ignore`, `@ts-expect-error`, `eslint-disable`,
`svelte-ignore`, `.skip`, `as any`, deleted assertions, or loosened configs. Fix the cause.

The full shadcn-svelte base component set is **already installed** under `src/lib/components/ui/`
(accordion, alert, avatar, badge, button, calendar, card, checkbox, collapsible, command, context-menu,
dialog, drawer, dropdown-menu, empty, field, hover-card, input, input-group, label, popover, progress,
radio-group, scroll-area, select, separator, sheet, skeleton, sonner, spinner, switch, table, tabs,
textarea, toggle, toggle-group, tooltip). **Do not run `shadcn-svelte add` mid-port** — compose what is
there.

---

## 2. Where the upstream reference lives

`.reference/diceui` is a **read-only** vendored copy of the upstream React monorepo. Read it freely; never
modify it, never install its dependencies, never run its build or its tests.

Finding a component's upstream material:

| What               | Where                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Component source   | `.reference/diceui/packages/<name>/src/*.tsx` (published packages)                                           |
|                    | `.reference/diceui/docs/registry/bases/base/ui/<name>.tsx` (registry-only components)                        |
| Shared hooks/utils | `.reference/diceui/packages/shared/src/{hooks,lib,components}`                                               |
| Docs (API + props) | `.reference/diceui/docs/content/docs/components/base/<name>.mdx`                                             |
| Examples / demos   | `.reference/diceui/docs/registry/bases/base/examples/<name>-*-demo.tsx`                                      |
| Upstream tests     | `.reference/diceui/packages/<name>/test/<name>.test.tsx` or `docs/registry/bases/radix/test/<name>.test.tsx` |
| Registry metadata  | `.reference/diceui/docs/registry/bases/base/ui/_registry.ts`                                                 |

Read the **MDX first** (it is the API contract), then the source, then every `<name>-*-demo.tsx` — each demo
becomes one section on our demo page. Read the upstream test file — its assertions are the floor for ours.

---

## 3. Directory layout of a ported component

One folder per component under `src/lib/components/ui/<slug>/`, `<slug>` in kebab-case and identical to the
upstream name (`tags-input`, `checkbox-group`, `mention`, …).

```
src/lib/components/ui/tags-input/
├── index.ts                    # barrel — the public API
├── tags-input.svelte           # Root
├── tags-input-input.svelte
├── tags-input-item.svelte
├── tags-input-item-text.svelte
├── tags-input-item-delete.svelte
├── tags-input-clear.svelte
├── tags-input.svelte.ts        # state class(es) + context (runes module)
└── tags-input.test.ts          # colocated tests
```

Rules:

- One part per file, named `<slug>-<part>.svelte`; the root is `<slug>.svelte`.
- Reactive logic that is not markup goes in `<slug>.svelte.ts` (a `.svelte.ts` module can use runes).
- Never put two components in one `.svelte` file.

### The `index.ts` barrel

Namespace-friendly short names **plus** prefixed aliases **plus** exported types — mirroring the shadcn
barrels already in the repo (see `src/lib/components/ui/accordion/index.ts`):

```ts
// src/lib/components/ui/tags-input/index.ts
import Root from './tags-input.svelte';
import Input from './tags-input-input.svelte';
import Item from './tags-input-item.svelte';
import ItemText from './tags-input-item-text.svelte';
import ItemDelete from './tags-input-item-delete.svelte';
import Clear from './tags-input-clear.svelte';

export type { TagsInputRootProps } from './tags-input.svelte';
export type { TagsInputInputProps } from './tags-input-input.svelte';
export type { TagsInputItemProps } from './tags-input-item.svelte';

export {
	Root,
	Input,
	Item,
	ItemText,
	ItemDelete,
	Clear,
	//
	Root as TagsInput,
	Input as TagsInputInput,
	Item as TagsInputItem,
	ItemText as TagsInputItemText,
	ItemDelete as TagsInputItemDelete,
	Clear as TagsInputClear
};
```

Consumers then use either style:

```ts
import * as TagsInput from '$lib/components/ui/tags-input/index.js'; // TagsInput.Root, TagsInput.Item
import { TagsInput, TagsInputItem } from '$lib/components/ui/tags-input/index.js';
```

Always import with the **`.js` extension** inside the repo (`$lib/utils.js`, `./index.js`) — that is what the
shadcn registry emits and what `verbatimModuleSyntax` expects.

---

## 4. Svelte 5 rune conventions

### Props

Every component exports a `Props` type from its **module** script and destructures `$props()` once:

```svelte
<script lang="ts" module>
	import type { WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	export type TagsInputRootProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		/** Controlled array of tag values. */
		value?: string[];
		/** Initial array of tag values when uncontrolled. */
		defaultValue?: string[];
		/** Called whenever the tag list changes. */
		onValueChange?: (value: string[]) => void;
		/** @default false */
		disabled?: boolean;
	};
</script>

<script lang="ts">
	let {
		ref = $bindable(null),
		value = $bindable(),
		defaultValue = [],
		onValueChange,
		disabled = false,
		class: className,
		children,
		...restProps
	}: TagsInputRootProps = $props();
</script>
```

- `export type` lives in `<script lang="ts" module>` — you cannot `export` from the instance script in runes mode.
- Copy the upstream JSDoc (including `@default`) onto each prop; it is the documented API.
- `class` must be renamed `class: className` and merged last through `cn()`.
- Always spread `...restProps` onto the rendered element.

### `$bindable` — controlled _and_ uncontrolled

Every value-bearing prop is `$bindable`, with a `defaultValue` fallback, so the component works both ways:

```svelte
<script lang="ts">
	let { value = $bindable(), defaultValue = [], onValueChange }: Props = $props();

	// Uncontrolled: seed once from defaultValue. Controlled: the parent's binding wins.
	value ??= defaultValue;

	function setValue(next: string[]) {
		value = next;
		onValueChange?.(next);
	}
</script>
```

`ref` is always `$bindable(null)` and applied with `bind:this={ref}` — this is the Svelte replacement for
React's `forwardRef`.

### State classes in `.svelte.ts`

Non-trivial behaviour (collections, highlighting, filtering, keyboard state machines) goes into a class in
`<slug>.svelte.ts`. That is where a React hook lands:

```ts
// src/lib/components/ui/tags-input/tags-input.svelte.ts
type TagsInputStateProps = {
	readonly disabled: boolean;
	getValue: () => string[];
	setValue: (value: string[]) => void;
};

export class TagsInputState {
	#props: TagsInputStateProps;
	highlightedIndex = $state<number | null>(null);
	inputValue = $state('');

	readonly count = $derived(this.#props.getValue().length);

	constructor(props: TagsInputStateProps) {
		this.#props = props;
	}

	add(text: string) {
		const trimmed = text.trim();
		if (trimmed === '' || this.#props.disabled) return false;
		this.#props.setValue([...this.#props.getValue(), trimmed]);
		this.inputValue = '';
		return true;
	}

	removeAt(index: number) {
		this.#props.setValue(this.#props.getValue().filter((_, i) => i !== index));
	}
}
```

Pass reactive values into the class as **getter functions** (`getValue: () => value`), never as snapshots —
a plain value captured in the constructor will not stay reactive.

### `$effect` teardown

Anything an effect starts, the returned cleanup must stop. Never leak a listener, timer, or observer:

```svelte
<script lang="ts">
	$effect(() => {
		if (!ref) return;

		const observer = new ResizeObserver(() => state.measure(ref));
		observer.observe(ref);
		const onKeydown = (event: KeyboardEvent) => state.onDocumentKeydown(event);
		document.addEventListener('keydown', onKeydown);

		return () => {
			observer.disconnect();
			document.removeEventListener('keydown', onKeydown);
		};
	});
</script>
```

Use `$effect.pre` only for DOM measurement before paint, and `untrack()` when you must read state without
subscribing. Never write to a `$state` you read in the same effect without `untrack` — that is an infinite loop.

---

## 5. The context pattern

Compound components share state through a **typed `Symbol` key**, never a bare string. Define it in the
`.svelte.ts` module beside the state class:

```ts
// src/lib/components/ui/tags-input/tags-input.svelte.ts
import { getContext, hasContext, setContext } from 'svelte';

const TAGS_INPUT_CONTEXT_KEY = Symbol('tags-input');

export function setTagsInputContext(state: TagsInputState): TagsInputState {
	return setContext(TAGS_INPUT_CONTEXT_KEY, state);
}

export function getTagsInputContext(): TagsInputState {
	if (!hasContext(TAGS_INPUT_CONTEXT_KEY)) {
		throw new Error('`<TagsInput.Item>` must be used within `<TagsInput.Root>`.');
	}
	return getContext<TagsInputState>(TAGS_INPUT_CONTEXT_KEY);
}
```

Root calls `setTagsInputContext(new TagsInputState({ ... }))` during initialisation; every part calls
`getTagsInputContext()` at the top of its instance script. **Always throw with a message naming both the part
and the required provider** — that error is part of the API and must be covered by a test.

(For trivial variant-only sharing the shadcn `toggle-group` pattern of `set…Ctx`/`get…Ctx` inside the root's
module script is acceptable, but a Symbol key plus the throwing getter is the default for ported components.)

---

## 6. Styling

- Compose classes with `cn()` from `$lib/utils.js`; multi-variant components use `tv()` from
  `tailwind-variants` in the module script and export the variants object (see
  `src/lib/components/ui/button/button.svelte`).
- **Semantic tokens only**: `bg-background`, `text-muted-foreground`, `border-border`, `bg-primary`,
  `text-destructive`. Never raw palette colours (`bg-blue-500`, `text-gray-600`).
- **Status colours** use the dedicated tokens, never the palette. Upstream's `green-*` / `orange-*` /
  `blue-*` map to `success` / `warning` / `info`, each with a `-foreground` companion for solid fills:

  | Upstream                         | Here                                                   |
  | -------------------------------- | ------------------------------------------------------ |
  | `bg-green-500/10 text-green-600` | `bg-success/10 text-success`                           |
  | `bg-orange-500 text-white`       | `bg-warning text-warning-foreground`                   |
  | `border-blue-500/20`             | `border-info/20`                                       |
  | `bg-red-500/10 text-red-600`     | `bg-destructive/10 text-destructive` (already existed) |

  They are declared in `src/app.css` for both `:root` and `.dark` and exposed through
  `@theme inline`, so they flip with the theme like every other token. If a port needs a status
  colour that is not one of these four, add the token to `src/app.css` **and** to this table —
  do not reach for the palette.

- **Decorative hues.** `violet`, `teal` and `rose` are theme tokens too, declared the same way, but
  they carry no meaning. They exist only so a demo can show several visually distinct colour
  treatments at once — the base theme is zinc, so nothing else in it supplies a hue. Reach for them
  when an upstream demo's subject _is_ colour variety (`circular-progress`'s Colors example); never
  to signal state, which is what the four status tokens are for.

- **No manual `dark:`** — tokens already flip via CSS variables in `src/app.css`.
- **No `space-x-*` / `space-y-*`** — use `flex`/`grid` with `gap-*`.
- Use `size-*` when width and height match; use `truncate` over the three-property spelling.
- **No manual `z-index` on overlays** — Dialog/Popover/Tooltip/Sheet handle their own stacking.
- `class` from the caller is merged **last** so callers can always override layout.
- Expose every piece of state as a `data-*` attribute so consumers can style it, and add a
  `data-slot="<slug>-<part>"` to each part:

```svelte
<div
	bind:this={ref}
	data-slot="tags-input"
	data-disabled={disabled ? '' : undefined}
	data-invalid={state.isInvalid ? '' : undefined}
	data-orientation={orientation}
	class={cn('flex flex-wrap items-center gap-1.5 rounded-lg border p-1', className)}
	{...restProps}
>
	{@render children?.()}
</div>
```

Boolean data attributes use `? '' : undefined` so the attribute is absent when false (that is what
`data-[disabled]:` selectors and the tests expect).

---

## 7. Tests

- **Location:** colocated — `src/lib/components/ui/<slug>/<slug>.test.ts`. The vitest `include` is
  `src/**/*.{test,spec}.{js,ts}` and the environment is jsdom (`vite.config.ts`); setup lives in
  `tests/setup.ts` (jest-dom matchers, `cleanup()`, and jsdom shims for `ResizeObserver`,
  `matchMedia`, pointer capture and `scrollIntoView`).
- `expect.requireAssertions` is on: every `it` must assert at least once.
- `globals: false` — import `describe`/`it`/`expect`/`vi` from `vitest` explicitly.

Rendering with `@testing-library/svelte`, including children (a snippet):

```ts
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import { TagsInput } from './index.js';

const label = (text: string) => createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('TagsInput', () => {
	it('exposes the documented roles', () => {
		render(TagsInput, { props: { children: label('Tags') } });
		expect(screen.getByRole('listbox')).toBeInTheDocument();
	});
});
```

Every ported component must assert **all** of:

1. **Roles and ARIA** — the roles, `aria-*` wiring and label associations the upstream MDX documents.
2. **Keyboard** — every key the upstream handles (`ArrowLeft/Right/Up/Down`, `Home`, `End`, `Enter`,
   `Escape`, `Backspace`, `Delete`, `Tab`), driven through `userEvent`, never synthetic `fireEvent` where
   `userEvent` will do.
3. **Uncontrolled** — `defaultValue` seeds the component and internal interaction updates it.
4. **Controlled** — passing `value` makes the parent authoritative and `onValueChange` fires with the next
   value; the component must not move on its own.
5. **RTL** — with `dir="rtl"`, horizontal arrow keys invert. Use the same cases as the upstream test.
6. **Guard rails** — `disabled` / `readOnly` suppress interaction, and using a part outside its provider
   throws the documented error (`expect(() => render(Part)).toThrow(/within/)`).

Port the upstream test file's assertions first, then add the Svelte-specific ones (bindings, snippets).

---

## 8. Demo route

One page per component at **`src/routes/docs/components/<slug>/+page.svelte`** — the slug must equal the
registry item name, because the docs sidebar links there.

Every section uses the shared harness `src/lib/components/docs/component-preview.svelte`
(`title`, optional `description`, optional `class`, `children`), and there is **one section per upstream
`<slug>-*-demo.tsx`**:

```svelte
<script lang="ts">
	import { ComponentPreview } from '$lib/components/docs/index.js';
	import * as TagsInput from '$lib/components/ui/tags-input/index.js';

	let value = $state(['svelte', 'kit']);
</script>

<svelte:head>
	<title>Tags Input — svelte-dice-ui</title>
</svelte:head>

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Tags Input</h1>
		<p class="text-muted-foreground">
			An input that turns typed text into removable tags, with full keyboard support.
		</p>
	</div>

	<!-- one <ComponentPreview> per upstream demo file -->
	<ComponentPreview title="Default" description="Mirrors tags-input-demo.tsx.">
		<TagsInput.Root defaultValue={['svelte']}>
			<TagsInput.Input placeholder="Add a tag…" />
		</TagsInput.Root>
	</ComponentPreview>

	<ComponentPreview title="Controlled" description="Mirrors tags-input-controlled-demo.tsx.">
		<TagsInput.Root bind:value>
			<TagsInput.Input placeholder="Add a tag…" />
		</TagsInput.Root>
	</ComponentPreview>
</article>
```

Keep demo state in the page with runes; do not add loaders or `+page.ts` unless the demo genuinely needs one.

---

## 9. Adding the `registry.json` entry

`registry.json` at the repo root starts with `"items": []`; **each port appends exactly one entry**. `path`
is relative to the repository root, and `pnpm run registry:build` inlines the file contents and rewrites
`$lib/...` imports to registry placeholders.

```jsonc
{
	"name": "tags-input",
	"type": "registry:ui",
	"title": "Tags Input",
	"description": "An input that turns typed text into removable tags.",
	"registryDependencies": ["button"], // shadcn primitives the component imports
	"dependencies": ["bits-ui"], // only npm packages the CLI cannot infer
	"files": [
		{ "path": "src/lib/components/ui/tags-input/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/tags-input/tags-input.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/tags-input/tags-input-input.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/tags-input/tags-input.svelte.ts", "type": "registry:ui" }
	]
}
```

Rules:

- `type` must be `registry:ui` — that is what the docs sidebar and `/docs/components` index filter on
  (`src/lib/registry.ts`).
- List **every** file of the component folder except the test file.
- Keep `name` == folder slug == demo route segment. `title`/`description` drive the docs index cards.
- Run `pnpm run registry:build` afterwards; output lands in `static/r/` (git-ignored from formatting/lint).

---

## 10. React → Svelte translation table

| React (upstream)                                | Svelte 5 (here)                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| `useState`                                      | `let x = $state(...)`                                                              |
| `useMemo` / derived render value                | `const x = $derived(...)` / `$derived.by(() => ...)`                               |
| `useEffect(fn, deps)` + cleanup                 | `$effect(() => { ...; return () => cleanup(); })` (deps are tracked automatically) |
| `useLayoutEffect` / `useIsomorphicLayoutEffect` | `$effect.pre`                                                                      |
| `useRef` (DOM)                                  | `let el = $state<HTMLElement \| null>(null)` + `bind:this={el}`                    |
| `useRef` (mutable box, non-reactive)            | a plain `let` or a private class field                                             |
| custom hook (`useTagsInput`, `useCollection`)   | a **state class** in `<slug>.svelte.ts`, instantiated by the root                  |
| `createContext` + provider + `useX()`           | `Symbol` key + `setXxxContext` / `getXxxContext` that throws (see §5)              |
| `forwardRef` + `useComposedRefs`                | `ref = $bindable(null)` + `bind:this={ref}` + `{...restProps}`                     |
| `React.ComponentPropsWithoutRef<'div'>`         | `WithElementRef<HTMLAttributes<HTMLDivElement>>` from `$lib/utils.js`              |
| `asChild` / `Slot` / `Primitive.div`            | a `child` snippet: `{#snippet child({ props })}` — see `dialog-content.svelte`     |
| `children` prop                                 | `children: Snippet` rendered with `{@render children?.()}`                         |
| render prop `({ item }) => ...`                 | a typed `Snippet<[Item]>` prop rendered with `{@render item(value)}`               |
| `createPortal` / `<Portal>`                     | bits-ui `*.Portal` (`sheet-portal.svelte`, `dialog` parts) or `{#if}` at the root  |
| `onValueChange` callback props                  | keep the same callback prop **and** add `bind:value` via `$bindable`               |
| `className={cn(...)}` / CSS-in-JS / styled      | `class={cn('...', className)}`, variants via `tv()`                                |
| `data-state="open"`                             | `data-state`/`data-open` attributes, set with `? '' : undefined` for booleans      |
| `React.Children` inspection                     | not available — model it explicitly with context or an items array                 |
| `useId()`                                       | `$props.id()` or Svelte's `crypto.randomUUID()`-free `useId` helper from bits-ui   |

Behaviour that upstream imports from `@diceui/shared` (collections, dismissible layers, anchor positioning,
scroll lock, direction) usually already exists in **`bits-ui`** — prefer composing a bits-ui primitive over
re-implementing the shared hook. Only port `@diceui/shared` logic when bits-ui has no equivalent.

---

## 11. Port checklist

1. Read the upstream MDX, source, demos and tests under `.reference/diceui` (§2).
2. Create `src/lib/components/ui/<slug>/` with parts, `<slug>.svelte.ts`, and `index.ts` (§3–§6).
3. Write `src/lib/components/ui/<slug>/<slug>.test.ts` covering all six areas in §7.
4. Add `src/routes/docs/components/<slug>/+page.svelte`, one `<ComponentPreview>` per upstream demo (§8).
5. Append the `registry.json` entry and run `pnpm run registry:build` (§9).
6. Run the four quality gates (§1) and make them green without suppressing anything.

Do not touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json` or `.port-logs/`, and do
not run git commands — the orchestrator owns the working tree.
