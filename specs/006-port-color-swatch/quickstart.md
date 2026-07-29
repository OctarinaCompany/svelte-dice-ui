# Quickstart — validating the Color Swatch port

**Feature**: `006-port-color-swatch` | **Date**: 2026-07-29

How to prove the port works end to end. Details live in
[contracts/color-swatch-public-api.md](./contracts/color-swatch-public-api.md) (clause ids `C-…`) and
[data-model.md](./data-model.md); this file is the run guide only.

## Prerequisites

- Node + pnpm, dependencies installed (`pnpm install`). **No new package is required** — the port adds
  zero dependencies (C-6.2).
- These files exist:
  `src/lib/components/ui/color-swatch/{index.ts,color-swatch.svelte,color.ts}`,
  `src/routes/docs/components/color-swatch/+page.svelte`, and a `color-swatch` entry in `registry.json`.

## 1. Quality gates (the authoritative check)

Run in this order, all non-interactive:

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

Expected: five green runs. `check` and `lint` must report zero errors **and** zero warnings; no
`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip` or `.todo` may
appear anywhere in the diff (Constitution VI/VII anti-cheat rule).

## 2. Targeted test run

```bash
pnpm run test:unit -- --run src/lib/components/ui/color-swatch
```

Expected: both `color-swatch.test.ts` and `color.test.ts` pass, covering C-8.1 – C-8.10.

## 3. Registry build

```bash
pnpm run registry:build
```

Expected: `static/r/color-swatch.json` is written, its `files[]` inlines exactly the three source files of
C-6.3 (no test file), and `$lib/…` imports have been rewritten to registry placeholders.

Sanity check the item is visible to the docs index:

```bash
node -e "const r=require('./registry.json');const i=r.items.find(x=>x.name==='color-swatch');if(!i||i.type!=='registry:ui')throw new Error('missing or wrong type');console.log(i.title, i.files.length)"
```

Expected: `Color Swatch 3`.

## 4. Scenario walkthrough (maps to the spec's user stories)

Each scenario is exercised by a test **and** visible on the demo page. Build the site
(`pnpm run build`) or read the page source at `src/routes/docs/components/color-swatch/+page.svelte`;
do not start a dev server.

| Scenario                                                    | Story | Where it is proven                                                                                    | Expected                                                                                          |
| ----------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `color="#3b82f6"`                                            | US1   | test C-8.1/C-8.3; demo section **Default**                                                             | `role="img"`, name `Color swatch: #3b82f6`, style `background-color: #3b82f6; forced-color-adjust: none` |
| `color="blue"`, `color="rgb(59, 130, 246)"`, `hsl(…)`        | US1   | test C-8.3 (C-4.4)                                                                                     | flat `background-color` with the exact string                                                       |
| `color="not-a-color"`                                        | US1   | test C-8.3 (C-4.2)                                                                                     | `background-color: transparent`, name still `Color swatch: not-a-color`                             |
| no `color` / `color=""` / `color="   "`                      | edge  | test C-8.1 + C-8.3 (C-4.1, C-4.5); demo section **Usage**                                              | destructive diagonal slash, name `No color selected`, `data-empty` present                          |
| `color="  #3b82f6  "`                                        | edge  | test C-8.1 (C-5.1)                                                                                     | identical to the untrimmed value in both name and style                                             |
| `color="rgba(59, 130, 246, 0.5)"`                            | US2   | test C-8.3 (C-4.3); demo section **Transparency**                                                      | `background: linear-gradient(…), repeating-conic-gradient(…) 0% 50% / 10px 10px`, `data-transparent` |
| same + `withoutTransparency`                                 | US2   | test C-8.3 (C-4.6); demo **Transparency** → "Without transparency pattern"                             | flat `background-color`, no `data-transparent`                                                      |
| opaque colour + `withoutTransparency`                        | US2   | test C-8.3                                                                                             | unchanged flat fill                                                                                 |
| `size="sm" \| "default" \| "lg"`                             | US3   | test C-8.2; demo section **Sizes**                                                                     | `size-6` / `size-8` / `size-12` and matching `data-size`                                            |
| `disabled`                                                   | US3   | test C-8.8; demo **Default** → last row                                                                | `aria-disabled="true"`, `data-disabled=""`, `pointer-events-none opacity-50`                        |
| `child` snippet onto a `<button>`                            | edge  | test C-8.9 (harness)                                                                                   | the button carries every attribute; no extra `<div>`; `ref` stays `null`                            |
| `dir="rtl"`                                                  | edge  | test C-8.7 (harness + `DirectionProvider`)                                                             | `class` and `style` byte-identical to LTR                                                           |

## 5. Reuse check (SC-005)

The colour helpers must be importable without pulling in the Svelte component:

```bash
pnpm exec tsx --eval "import('./src/lib/components/ui/color-swatch/color.ts').then(m=>console.log(Object.keys(m)))" 2>/dev/null \
  || node -e "console.log(require('fs').readFileSync('src/lib/components/ui/color-swatch/color.ts','utf8').match(/^export function \w+/gm))"
```

Expected: `normalizeColorValue`, `isCssColor`, `hasAlpha`, `getColorBackgroundStyle` — and the file
contains **no** `import` statement (C-1.2.1), which is what lets wave 3's `color-picker` depend on it
without a cycle.

## Done when

- [ ] All five gate commands are green, with no suppression added anywhere.
- [ ] Every row of §4 above is both asserted in a test and visible on the demo page.
- [ ] `static/r/color-swatch.json` exists and lists exactly the three source files.
- [ ] `/docs/components/color-swatch` appears in the docs sidebar (derived automatically from
      `registry.json` by `getComponentItems()` — no manual navigation edit).
