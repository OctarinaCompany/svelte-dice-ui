# Contract — `color-swatch` public API

**Feature**: `006-port-color-swatch` | **Date**: 2026-07-29

This is the enforceable surface of the port. Every clause is numbered so tasks and tests can cite it.
Upstream reference: `.reference/diceui/docs/registry/bases/radix/ui/color-swatch.tsx` and
`.reference/diceui/docs/types/radix/color-swatch.ts` at the pinned commit
`d9763d82530416dfa4c81c462387b55d06bae4ec`.

## §1 Module surface

### §1.1 `src/lib/components/ui/color-swatch/index.ts`

```ts
import Root from './color-swatch.svelte';

export {
	colorSwatchVariants,
	COLOR_SWATCH_SIZES,
	resolveColorSwatchSize,
	type ColorSwatchSize,
	type ColorSwatchRootProps,
	type ColorSwatchProps,
	type ColorSwatchChildProps
} from './color-swatch.svelte';

export {
	normalizeColorValue,
	isCssColor,
	hasAlpha,
	getColorBackgroundStyle,
	type ColorBackgroundOptions
} from './color.js';

export {
	Root,
	//
	Root as ColorSwatch
};
```

- **C-1.1.1** Both import styles work:
  `import * as ColorSwatch from '$lib/components/ui/color-swatch/index.js'` → `ColorSwatch.Root`, and
  `import { ColorSwatch } from '$lib/components/ui/color-swatch/index.js'`.
- **C-1.1.2** `ColorSwatchProps` is a type alias of `ColorSwatchRootProps`, present so code written against
  the upstream type name compiles unchanged.
- **C-1.1.3** Every intra-repo import in this folder carries the `.js` extension.

### §1.2 `src/lib/components/ui/color-swatch/color.ts`

- **C-1.2.1** Imports nothing. Contains no rune, no top-level side effect, no DOM access outside the
  guarded `CSS.supports` call. Importable from a `.ts`, a `.svelte.ts`, a `.svelte` and a Node/SSR context.

## §2 `ColorSwatch` (Root) — props

Type: `ColorSwatchRootProps = WithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>> & { … }`.

| #        | Prop                  | Type                          | Default     | Bindable | Behaviour                                                                                                       |
| -------- | --------------------- | ----------------------------- | ----------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| C-2.1    | `ref`                 | `HTMLDivElement \| null`      | `null`      | yes      | `bind:this` on the default `<div>`. Stays `null` in `child` mode.                                                 |
| C-2.2    | `color`               | `string \| undefined`         | `undefined` | no       | Trimmed; whitespace-only ⇒ empty state. Drives background **and** accessible name.                                |
| C-2.3    | `size`                | `'default' \| 'sm' \| 'lg'`   | `'default'` | no       | `sm`→`size-6`, `default`→`size-8`, `lg`→`size-12`; also emitted as `data-size`.                                   |
| C-2.4    | `withoutTransparency` | `boolean`                     | `false`     | no       | Suppresses the checkerboard; the flat colour is still applied.                                                    |
| C-2.5    | `disabled`            | `boolean`                     | `false`     | no       | `aria-disabled="true"` + `data-disabled=""`; base classes then apply `pointer-events-none opacity-50`.             |
| C-2.6    | `class`               | `ClassValue`                  | `undefined` | no       | Merged **last** through `cn()`; a caller's `size-10` overrides the variant's `size-8`.                             |
| C-2.7    | `style`               | `string \| undefined \| null` | `undefined` | no       | Appended **after** the computed declarations, so the caller wins.                                                 |
| C-2.8    | `child`               | `Snippet<[{ props: ColorSwatchChildProps }]>` | `undefined` | no | Renders the caller's element with the identical attribute payload; the default `<div>` is not rendered. |
| C-2.9    | `...restProps`        | `HTMLAttributes<HTMLDivElement>` | —        | no       | Spread before `class`/`style`. Native handlers pass through untouched.                                            |
| C-2.10   | `children`            | —                             | —           | —        | **Not accepted** (upstream `Omit<…, 'children'>`). Must be a type error to pass it.                               |

- **C-2.11** There are no callback props and no `on*Change` events: the component owns no state.
- **C-2.12** Every prop carries the upstream JSDoc, including `@default` and `color`'s `@example`
  (`"#ff0000" | "rgb(255, 0, 0)" | "hsl(0, 100%, 50%)" | "rgba(255, 0, 0, 0.5)"`).

## §3 Rendered output

- **C-3.1** Default element is a single `<div>`; it has no children and no text content.
- **C-3.2** `role="img"` is always present.
- **C-3.3** `aria-label` is `Color swatch: <trimmed value>` when a value resolves, otherwise
  `No color selected`. It uses the caller's exact trimmed string, including for invalid values.
- **C-3.4** `aria-disabled="true"` iff `disabled`; absent otherwise (never `"false"`).
- **C-3.5** `data-slot="color-swatch"` is always present.
- **C-3.6** `data-disabled` is `""` iff `disabled`, else absent.
- **C-3.7** `data-size` is always present and equals the resolved size.
- **C-3.8** `data-transparent` is `""` iff the checkerboard is rendered, else absent.
- **C-3.9** `data-empty` is `""` iff no colour value resolves, else absent.
- **C-3.10** The element is **not** focusable: no `tabindex`, and `userEvent.tab()` does not land on it.
- **C-3.11** `style` always ends with the computed `forced-color-adjust: none` (before any caller style).

## §4 Background contract

With `<c>` the trimmed colour value and `<t>` the checkerboard tile size (default `10px`):

| #     | State                                       | Emitted declaration                                                                                                                                             |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C-4.1 | no value                                    | `background: linear-gradient(to bottom right, transparent calc(50% - 1px), var(--destructive) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) no-repeat` |
| C-4.2 | value present, not a CSS colour             | `background-color: transparent`                                                                                                                                    |
| C-4.3 | valid, alpha-bearing, `!withoutTransparency`| `background: linear-gradient(<c>, <c>), repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0% 50% / <t> <t>`                                                        |
| C-4.4 | valid, otherwise                            | `background-color: <c>`                                                                                                                                            |

- **C-4.5** C-4.1 is reached for `undefined`, `''` and `'   '` alike.
- **C-4.6** `withoutTransparency` never changes C-4.1 or C-4.2 — only C-4.3 → C-4.4.

## §5 `color.ts` contract

| #     | Function                                            | Clause                                                                                                                        |
| ----- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| C-5.1 | `normalizeColorValue(value?)`                       | `undefined`→`undefined`; `''`/`'   '`→`undefined`; `'  #3b82f6  '`→`'#3b82f6'`; idempotent.                                     |
| C-5.2 | `isCssColor(value)`                                 | Delegates to `CSS.supports('color', value)`; returns `true` when `CSS`/`CSS.supports` is unavailable; returns `false` on throw. |
| C-5.3 | `hasAlpha(value)`                                   | Exactly the truth table in `data-model.md` §Entity 2; case-insensitive; tolerates surrounding whitespace.                       |
| C-5.4 | `getColorBackgroundStyle(value, options?)`          | Produces §4 verbatim; `options.checkerboardSize` substitutes `<t>`; `options.withoutTransparency` selects C-4.4 over C-4.3.     |
| C-5.5 | all                                                 | Pure: same input ⇒ same output, no mutation of arguments, no globals written.                                                  |

## §6 Registry entry

```jsonc
{
	"name": "color-swatch",
	"type": "registry:ui",
	"title": "Color Swatch",
	"description": "A color swatch component for displaying color values with support for transparency and various sizes.",
	"registryDependencies": [],
	"dependencies": [],
	"files": [
		{ "path": "src/lib/components/ui/color-swatch/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/color-swatch/color-swatch.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/color-swatch/color.ts", "type": "registry:ui" }
	]
}
```

- **C-6.1** `registryDependencies` is empty: the component imports no other registry item (only
  `$lib/utils.js`, which the registry build rewrites, plus `tailwind-variants`, already a project dep).
- **C-6.2** `dependencies` is empty: **zero new npm packages**. Upstream's `radix-ui` (`Slot`) is replaced
  by the `child` snippet and `class-variance-authority` by the already-installed `tailwind-variants`.
- **C-6.3** The three test files are **not** listed.
- **C-6.4** `pnpm run registry:build` is run afterwards and emits `static/r/color-swatch.json`.

## §7 Demo route

`src/routes/docs/components/color-swatch/+page.svelte`, one `<ComponentPreview>` per upstream example:

| #     | Section title           | Mirrors                                                                 |
| ----- | ----------------------- | ------------------------------------------------------------------------ |
| C-7.1 | `Default`               | `color-swatch-demo.tsx` (labelled swatch, three sizes, semi-transparent, palette row, disabled) |
| C-7.2 | `Sizes`                 | `color-swatch-sizes-demo.tsx` (five colours × sm/default/lg)             |
| C-7.3 | `Transparency`          | `color-swatch-transparency-demo.tsx` (rgba ramp, hsla ramp, `withoutTransparency` row, default row) |
| C-7.4 | `Usage`                 | the MDX "Usage" snippet — a single `<ColorSwatch color="#3b82f6" />`, plus the empty/invalid edge cases the MDX describes under Accessibility |
| C-7.5 | Props table             | `$lib/components/ui/table` listing every row of §2 with type, default and description |

- **C-7.6** The page imports only from `$lib/components/docs/index.js`, `$lib/components/ui/**` and
  `@lucide/svelte` — never the reverse direction.

## §8 Test obligations

`color-swatch.test.ts` (component) and `color.test.ts` (module), plus `color-swatch.test.svelte` as the
harness for anything a `.ts` spec cannot express (`bind:ref`, the `child` snippet, prop rerender, RTL).

| #     | Area                | Must assert                                                                                                        |
| ----- | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| C-8.1 | Roles & names       | C-3.2, C-3.3 for a valid value, an invalid value, `undefined`, `''` and a whitespace-padded value.                    |
| C-8.2 | Every prop          | C-2.2–C-2.9 individually, including `class` overriding the variant and `style` overriding the computed background.    |
| C-8.3 | Background states   | C-4.1–C-4.6 through `getAttribute('style')`.                                                                          |
| C-8.4 | Data attributes     | C-3.5–C-3.9, asserting absence (not `"false"`) when off.                                                              |
| C-8.5 | Keyboard            | C-3.10 — no `tabindex`, `userEvent.tab()` moves focus past the swatch to a sibling button. (No key handlers exist upstream; this documents the absence.) |
| C-8.6 | Uncontrolled/controlled | The component owns no state: changing `color` through the harness re-renders, and the swatch never changes its own attributes without a prop change. |
| C-8.7 | RTL                 | Rendered inside `<DirectionProvider dir="rtl">`, `class` and `style` are identical to the LTR render.                 |
| C-8.8 | Guard rails         | `disabled` ⇒ C-3.4 + C-3.6 + `pointer-events-none opacity-50` present; `userEvent.click` on a disabled swatch with an `onclick` in `restProps` still fires no application state change beyond the DOM default (jsdom does not honour `pointer-events`, so the assertion is on the emitted attributes/classes, not on a synthesised click). |
| C-8.9 | `child` snippet     | The caller's `<button>` receives role, aria-label, data attributes, class and style; the default `<div>` is absent; `ref` stays `null`. |
| C-8.10| `color.ts`          | C-5.1–C-5.5, table-driven over every format in the MDX's "Color Format Support" and "Transparency Detection" lists, including the `isCssColor` SSR fallback (temporarily deleting `globalThis.CSS` with `vi.stubGlobal`) and the throw path. |
