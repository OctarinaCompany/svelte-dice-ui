# Phase 1 Data Model — Color Swatch

**Feature**: `006-port-color-swatch` | **Date**: 2026-07-29

The component is stateless: there is no store, no class, no context and no mutable field. The "model" is
therefore a pure derivation chain from four input props to one rendered attribute set. Everything below is
directly testable.

## Entity 1 — Color Swatch (the rendered element)

### Inputs

| Field                 | Type                        | Default     | Validation                                                              |
| --------------------- | --------------------------- | ----------- | ----------------------------------------------------------------------- |
| `color`               | `string \| undefined`       | `undefined` | Trimmed before use. `''` or whitespace-only ⇒ treated as `undefined`.    |
| `size`                | `'default' \| 'sm' \| 'lg'` | `'default'` | Unknown runtime string ⇒ `'default'` via `resolveColorSwatchSize`.       |
| `withoutTransparency` | `boolean`                   | `false`     | —                                                                       |
| `disabled`            | `boolean`                   | `false`     | —                                                                       |

### Derived state

| Name           | Expression                                                          | Type                  |
| -------------- | ------------------------------------------------------------------- | --------------------- |
| `colorValue`   | `normalizeColorValue(color)`                                        | `string \| undefined` |
| `isEmpty`      | `colorValue === undefined`                                          | `boolean`             |
| `isValid`      | `colorValue !== undefined && isCssColor(colorValue)`                | `boolean`             |
| `isTransparent`| `isValid && !withoutTransparency && hasAlpha(colorValue)`           | `boolean`             |
| `resolvedSize` | `resolveColorSwatchSize(size)`                                      | `ColorSwatchSize`     |
| `background`   | `getColorBackgroundStyle(colorValue, { withoutTransparency })`      | `string` (CSS text)   |
| `ariaLabel`    | `isEmpty ? 'No color selected' : \`Color swatch: ${colorValue}\``   | `string`              |

### Visual state machine (mutually exclusive, evaluated top-down)

| # | Condition                                                | `background` CSS text                                                                                                                                             | `data-empty` | `data-transparent` |
| - | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ------------------ |
| 1 | `isEmpty`                                                 | `background: linear-gradient(to bottom right, transparent calc(50% - 1px), var(--destructive) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) no-repeat` | `""`         | absent             |
| 2 | `!isValid`                                                | `background-color: transparent`                                                                                                                                    | absent       | absent             |
| 3 | `isValid && !withoutTransparency && hasAlpha(colorValue)` | `background: linear-gradient(<c>, <c>), repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0% 50% / 10px 10px`                                                      | absent       | `""`               |
| 4 | otherwise (valid, opaque **or** `withoutTransparency`)    | `background-color: <c>`                                                                                                                                            | absent       | absent             |

`<c>` is `colorValue` (already trimmed). The `#ccc`/`#fff` checkerboard literals are upstream's and are
intentionally *not* tokenised: they are a fixed transparency-indicator motif (the same convention every
image editor uses), not themeable UI chrome, and upstream uses them identically in `color-picker.tsx`.

State 1→4 is exhaustive: `colorValue` is either absent (1), present-and-invalid (2), or
present-and-valid (3 or 4, split by `hasAlpha` ∧ `!withoutTransparency`).

### Rendered attribute set

| Attribute          | Value                                                                              | Present when            |
| ------------------ | ---------------------------------------------------------------------------------- | ----------------------- |
| `role`             | `"img"`                                                                            | always                  |
| `aria-label`       | `ariaLabel`                                                                        | always                  |
| `aria-disabled`    | `"true"`                                                                           | `disabled`              |
| `data-slot`        | `"color-swatch"`                                                                   | always                  |
| `data-disabled`    | `""`                                                                               | `disabled`              |
| `data-size`        | `resolvedSize`                                                                     | always                  |
| `data-transparent` | `""`                                                                               | `isTransparent`         |
| `data-empty`       | `""`                                                                               | `isEmpty`               |
| `class`            | `cn(colorSwatchVariants({ size: resolvedSize }), className)`                        | always                  |
| `style`            | `` `${background}; forced-color-adjust: none` `` + `; ${callerStyle}` when supplied | always                  |
| …`restProps`       | spread verbatim, **before** `class` and `style`                                     | as supplied             |

### Class model (`colorSwatchVariants`, `tv()`)

- **base**: `box-border rounded-sm border bg-clip-padding shadow-sm data-disabled:pointer-events-none data-disabled:opacity-50`
- **variants.size**: `default: 'size-8'`, `sm: 'size-6'`, `lg: 'size-12'`
- **defaultVariants**: `{ size: 'default' }`

No physical-side (`left`/`right`/`ml-`/`pr-`…) utility appears anywhere, which is what makes the component
RTL-invariant (research D-005).

## Entity 2 — Color format detector (`color.ts`)

A dependency-free module of four pure functions. No runes, no imports, no side effects — safe to call
during SSR and directly unit-testable.

| Function                                            | Signature                                                                             | Contract                                                                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `normalizeColorValue`                               | `(value?: string) => string \| undefined`                                             | `value?.trim()`, then `''` ⇒ `undefined`. Idempotent.                                                                                                              |
| `isCssColor`                                        | `(value: string) => boolean`                                                          | `CSS.supports('color', value)` when `CSS`/`CSS.supports` exist; `true` when they do not (SSR); `false` if the call throws.                                          |
| `hasAlpha`                                          | `(value: string) => boolean`                                                          | Case-insensitive over the trimmed value: `transparent` ⇒ true; 4- or 8-digit hex ⇒ true; `rgba(`/`hsla(` ⇒ true; `rgb`/`hsl`/`lab`/`lch`/`oklab`/`oklch`/`color` with `/ <alpha>` before `)` ⇒ true; otherwise false. |
| `getColorBackgroundStyle`                           | `(value: string \| undefined, options?: { withoutTransparency?: boolean; checkerboardSize?: string }) => string` | Returns the CSS declaration text for states 1–4 above. `checkerboardSize` defaults to `'10px'` (wave-3 `color-picker` passes `'8px'`). |

### `hasAlpha` truth table (the test matrix)

| Input                            | Result | Which rule            |
| -------------------------------- | ------ | --------------------- |
| `transparent`, `  TRANSPARENT  ` | `true` | keyword               |
| `#f00a`, `#FF000080`             | `true` | 4-/8-digit hex        |
| `rgba(59,130,246,0.5)`           | `true` | `rgba(`               |
| `hsla(220, 91%, 60%, 0.5)`       | `true` | `hsla(`               |
| `rgb(1 2 3 / 50%)`               | `true` | slash-alpha           |
| `hsl(217 91% 60% / 0.5)`         | `true` | slash-alpha           |
| `oklch(0.7 0.1 200 / 0.5)`       | `true` | slash-alpha           |
| `color(display-p3 1 0 0 / 0.4)`  | `true` | slash-alpha           |
| `#3b82f6`, `#f00`                | `false`| opaque hex (6/3)      |
| `rgb(59, 130, 246)`              | `false`| no alpha              |
| `hsl(217, 91%, 60%)`             | `false`| no alpha              |
| `blue`, `currentColor`           | `false`| named, opaque         |
| `oklch(0.7 0.1 200)`             | `false`| no slash-alpha        |

Note the deliberate upstream quirk kept for parity: `rgba(0, 0, 0, 1)` is fully opaque yet reports `true`,
because detection is syntactic, not numeric. The transparency demo relies on this (it renders
`rgba(59, 130, 246, 1)` alongside its faded siblings and all five get the checkerboard treatment).

## Relationships

```text
color-swatch.svelte ──imports──> color.ts        (isCssColor, hasAlpha, normalizeColorValue,
        │                                          getColorBackgroundStyle)
        └──re-exported by──> index.ts ──imported by──> docs route, tests,
                                                        and (wave 3) color-picker
```

The arrow never points back: `color.ts` imports nothing, and neither file imports from `src/routes/**` or
`$lib/components/docs/**` (Constitution V).
