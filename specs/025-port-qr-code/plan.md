# Implementation Plan: Port QR Code

**Branch**: `025-port-qr-code` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-port-qr-code/spec.md`

## Summary

Port Dice UI's `qr-code` (radix base) to Svelte 5 as a seven-part compound component that encodes a
string into a scannable QR code and renders it as a canvas, an inline SVG, or an `<img>`, with a
loading skeleton, a centred overlay slot, and a PNG/SVG download button.

Technical approach: one `QRCodeState` rune class in `qr-code.svelte.ts` replaces upstream's
hand-rolled `useSyncExternalStore` store plus both React contexts, shared through a Symbol-keyed
context whose getter throws (FR-010). Generation is driven by a single `$effect` on a `$derived`
generation key — the direct translation of upstream's memoised key + `useLayoutEffect` +
`requestAnimationFrame` — and calls the **same** `qrcode` npm package upstream uses, via the same
dynamic `import('qrcode')` that keeps the component SSR-safe. `asChild` becomes the repo's `child`
snippet on all seven parts. No Bits UI primitive is involved: this component has no overlay, no
positioning, no focus management and no roving tabindex, so there is nothing to compose (Principle IV
justification below). Two additive, spec-recorded strengthenings: an accessible name on the canvas
and SVG renderers (FR-011) and clearing stale output when a regeneration fails (FR-008).

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`) on Svelte 5.56 / SvelteKit 2.63,
runes forced on repo-wide by `vite.config.ts`.

**Primary Dependencies**: `qrcode@^1.5.4` (**new** — the upstream encoder, see research R-01),
`@types/qrcode@^1.5.6` (new dev dependency), `clsx`/`tailwind-merge` via `cn()` from `$lib/utils.js`.
No Bits UI primitive, no `tailwind-variants` (single-variant parts), no `@lucide/svelte` in the
component (the overlay demo's icon is docs-only).

**Storage**: N/A — generation is in-memory and client-side; nothing is persisted. The download path
writes a file through a transient `<a download>` + `URL.createObjectURL`.

**Testing**: Vitest (jsdom, `globals: false`, `expect.requireAssertions`) +
`@testing-library/svelte` + `@testing-library/user-event`, colocated at
`src/lib/components/ui/qr-code/qr-code.test.ts` with a `qr-code.test.svelte` composition harness.
`qrcode` is mocked at the module boundary because jsdom has no 2D canvas context (research R-08).

**Target Platform**: Modern evergreen browsers. The component is SSR-safe (it renders its container
markup on the server and generates only in a client `$effect`); `pnpm run build` must succeed with
the demo route prerendered.

**Project Type**: shadcn-svelte registry component + its SvelteKit docs route.

**Performance Goals**: One encode per distinct input set — re-supplying the identical seven-tuple
must not call the encoder again (FR-007, asserted by an idempotence test). Generation is deferred one
`requestAnimationFrame` so it never blocks first paint.

**Constraints**: TypeScript strict, zero `any`, zero suppressions. Semantic Tailwind tokens only.
Every part carries `data-slot` and exposes its state as `data-*`. Component source must not import
anything from `src/routes/**` or `src/lib/components/docs/**`.

**Scale/Scope**: 7 part files + 1 state module + 1 barrel + 1 test file + 1 test harness + 1 demo
route + 1 registry entry. No shared repo-level module is modified; `tests/setup.ts` is **not** touched
(the `qrcode` mock is local to the suite).

## Constitution Check

_GATE: passed before Phase 0 research; re-checked after Phase 1 design — see the re-check note below._

| #    | Principle                           | Verdict | Evidence                                                                                                                                                                                                             |
| ---- | ----------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `$state`/`$derived`/`$effect`/`$props`/`$bindable` + snippets only; `QRCodeState` in `qr-code.svelte.ts` takes reactive inputs as getter functions; no store, no `export let`, no `createEventDispatcher`, no `<slot>` |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | All 7 parts, all 14 documented props, both callbacks, `--qr-code-size`, the `Enter`/`Space` keyboard table, and all 4 demos ported from `d9763d8`; the 8 divergences are recorded in spec.md Assumptions and restated below |
| III  | Accessibility Is a MUST             | PASS    | `role="img"` + accessible name on canvas/svg, `alt` on image, native `<button>` for `Enter`/`Space`, visible focus ring; test file covers roles/names, keyboard, RTL, guard rails and the outside-provider throw       |
| IV   | Composition Over Reimplementation   | PASS    | Nothing to compose — justification below                                                                                                                                                                              |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file, `<slug>.svelte.ts`, `index.ts` barrel with short + prefixed + type exports, `.js`-suffixed intra-repo imports, one `registry:ui` entry, no docs import                                  |
| VI   | TypeScript Strict, No Suppressions  | PASS    | `WithElementRef<HTMLAttributes<…>>` prop types exported from module scripts; `QRCodeGenerateOptions` is structurally assignable to `qrcode`'s option types via `@types/qrcode`, so no cast and no `any`                |
| VII  | Green Gate Before Commit            | PASS    | `format` → `check` → `lint` → `test:unit -- --run` → `build`, scheduled as the final task; no `.skip`/`.todo`                                                                                                          |
| VIII | Styling Discipline                  | PASS    | `cn()` with `class` merged last; `bg-background`/`bg-accent`/`ring-ring` tokens only; `gap-2` not `space-*`; no `dark:`; no manual `z-index`; `data-slot` on all 7 parts; `data-state` on the root                     |
| IX   | Every Component Is Documented       | PASS    | `/docs/components/qr-code` with one `<ComponentPreview>` per upstream demo file (4) + a Playground + a props table                                                                                                     |
| X    | One Feature Directory Per Component | PASS    | All artifacts written under `specs/025-port-qr-code/`; no git write commands; no touching `.reference/`, `scripts/`, `.port-*`                                                                                         |

**Bespoke behaviour justification (Principle IV)**: two behaviours are hand-written.

1. **QR generation + the generation-key guard** (`QRCodeState.generate`). Evaluated: `bits-ui` — it
   ships no encoder and no async-resource primitive of any kind; `$lib/components/ui/*` — nothing
   related exists. The encoding itself is *not* hand-rolled: it is delegated to the same `qrcode`
   package upstream uses (FR-001). What is bespoke is only the ~40 lines of lifecycle around it
   (key derivation, re-entrancy guard, callback dispatch, error normalisation), which is upstream's
   own logic translated (research R-03).
2. **File download** (`QRCodeState.download` / `resolveDownload`). Evaluated: `bits-ui` — no download
   primitive; `$lib/components/ui/button` — a styling component only, it provides no blob/anchor
   behaviour, so composing it would leave 100% of the logic still to write. The part therefore stays
   a native `<button>` (which is also what gives FR-006's `Enter`/`Space` for free) and callers reach
   `Button` through the `child` snippet, exactly as the upstream `formats` demo does with `asChild`
   (research R-06).

Everything else — layering, centring, visibility gating — is CSS and `{#if}`, with no primitive to
displace.

**Recorded divergences from upstream** (all eight already in spec.md Assumptions; none is an API
removal):

| # | Upstream                                                   | Here                                                                     | Why                                             |
| - | ---------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------- |
| 1 | `asChild` + Radix `Slot` on all 7 parts                     | `child` snippet on all 7 parts                                           | No `Slot` in Svelte; repo convention (CLAUDE.md §10) |
| 2 | `Store` + `useSyncExternalStore` + 2 contexts, `useLazyRef`, `useComposedRefs` | one `QRCodeState` + one Symbol context; `getQRCodeContext` replaces the exported `useQRCode` | React render-granularity/ref workarounds with no Svelte analogue (research R-02) |
| 3 | Canvas/SVG have no accessible name                          | `role="img"` + `aria-label="QR code for {value}"` (overridable)          | FR-011 / Principle III; additive (research R-05) |
| 4 | A failed regeneration leaves the previous code on screen    | `dataUrl`/`svgString` cleared on failure                                 | FR-008 — a stale code encodes the wrong destination (research R-11) |
| 5 | `Overlay` consumes no context and renders standalone | `Overlay` calls the context getter and throws outside `<QRCode.Root>` | FR-010 applied uniformly to all 7 parts |
| 6 | Root merges `cn(className, defaults)` — defaults win | Root merges `class` **last** | Principle VIII; caller override is the styling API |
| 7 | No generation-state attribute on the root | `data-state="idle\|generating\|ready\|error"` | Principle VIII; additive |
| 8 | Download inherits the UA focus ring | repo `focus-visible:*` ring tokens added | FR-012 visible focus indicator; additive |

**Post-Phase-1 re-check**: re-evaluated after `research.md`, `data-model.md`,
`contracts/qr-code.api.md` and `quickstart.md` were written. All ten verdicts stand; the design
introduced no new bespoke behaviour, no new dependency beyond `qrcode`/`@types/qrcode`, and no
suppression. Complexity Tracking is therefore empty.

## Public API

Full tables — every prop's name, type, default, bindability, plus snippets and callbacks — are in
[`contracts/qr-code.api.md`](./contracts/qr-code.api.md). Summary:

### `Root` / `QRCode` — `<div data-slot="qr-code">`

| Prop | Type | Default | Bindable |
| ---- | ---- | ------- | -------- |
| `value` | `string` | — (required) | no |
| `size` | `number` | `200` | no |
| `level` | `'L' \| 'M' \| 'Q' \| 'H'` | `'M'` | no |
| `margin` | `number` | `1` | no |
| `quality` | `number` | `0.92` | no |
| `backgroundColor` | `string` | `'#ffffff'` | no |
| `foregroundColor` | `string` | `'#000000'` | no |
| `onError` | `(error: Error) => void` | `undefined` | no |
| `onGenerated` | `() => void` | `undefined` | no |
| `style` | `string` | `undefined` | no |
| `class` | `string` | `undefined` | no |
| `ref` | `HTMLDivElement \| null` | `null` | **yes** |

Snippets: `children`, `child`. Sets `--qr-code-size: {size}px` and `data-state`.

### `Canvas` — `<canvas data-slot="qr-code-canvas">`

`ref` (bindable, `HTMLCanvasElement`), `class`, `children` (fallback), `child`. Emits `role="img"`,
default `aria-label="QR code for {value}"`, `width`/`height` = root `size`, and `invisible` until the
first generation completes.

### `Svg` — `<div data-slot="qr-code-svg">`

`ref` (bindable), `style`, `class`, `child`. Emits `role="img"`, default `aria-label`, inline
`width`/`height`. Content is `{@html svgString}`. Renders nothing until `svgString` exists.

### `Image` — `<img data-slot="qr-code-image">`

`alt` (`'QR Code'`), `ref` (bindable), `class`, `child`. Emits `src` = `dataUrl`, `width`/`height`.
Renders nothing until `dataUrl` exists.

### `Overlay` — `<div data-slot="qr-code-overlay">`

`ref` (bindable), `class`, `children`, `child`. Absolutely centred over the code.

### `Skeleton` — `<div data-slot="qr-code-skeleton">`

`ref` (bindable), `style`, `class`, `children`, `child`. Renders nothing once
`dataUrl || svgString || generationKey` is truthy.

### `Download` — `<button type="button" data-slot="qr-code-download">`

`filename` (`'qrcode'`), `format` (`'png' | 'svg'`, default `'png'`), `onclick`, `ref` (bindable),
`class`, `children` (defaults to the text `Download PNG` / `Download SVG`), `child`. `Enter`/`Space`
activate it natively. No-op when the requested format has no output yet.

**Nothing other than `ref` is `$bindable`**, and there is no `defaultValue`/`onValueChange` pair:
upstream has none, and this component owns no user-mutable value state. See research R-09 for what
replaces the controlled/uncontrolled test pair.

### Module exports (deliverable 5 — the reuse surface)

`qr-code.svelte.ts` exports, and `index.ts` re-exports: `QRCodeState`, `QRCodeStateProps`,
`setQRCodeContext` / `hasQRCodeContext` / `getQRCodeContext`, `QR_CODE_LEVELS` + `QRCodeLevel`,
`QR_CODE_FORMATS` + `QRCodeFormat`, `QRCodeGenerateOptions`, the four pure helpers
(`buildQRCodeOptions`, `buildGenerationKey`, `getQRCodeLabel`, `resolveDownload`) and the nine
`DEFAULT_*` constants. The pure helpers are rune-free and DOM-free so a future port needing encoder
options, memo-keying or a data-URL/blob download can import them directly.

## Project Structure

### Documentation (this feature)

```text
specs/025-port-qr-code/
├── spec.md                    # already written
├── plan.md                    # this file
├── research.md                # Phase 0 — R-01…R-11, no NEEDS CLARIFICATION left
├── data-model.md              # Phase 1 — QRCodeState, helpers, transitions, context
├── quickstart.md              # Phase 1 — install, smoke test, 11 validation scenarios, gates
├── contracts/
│   └── qr-code.api.md         # Phase 1 — the full public API contract
├── checklists/
│   └── requirements.md        # from /speckit-specify
└── tasks.md                   # Phase 2 — /speckit-tasks, NOT created here
```

### Source Code (repository root)

```text
src/lib/components/ui/qr-code/
├── index.ts                    # barrel: 7 short names + 7 prefixed aliases + prop types + state module re-exports
├── qr-code.svelte              # Root          ← qr-code.tsx:97-293  (QRCode)
├── qr-code-canvas.svelte       # Canvas        ← qr-code.tsx:299-323 (QRCodeCanvas)
├── qr-code-svg.svelte          # Svg           ← qr-code.tsx:329-351 (QRCodeSvg)
├── qr-code-image.svelte        # Image         ← qr-code.tsx:357-381 (QRCodeImage)
├── qr-code-overlay.svelte      # Overlay       ← qr-code.tsx:450-465 (QRCodeOverlay)
├── qr-code-skeleton.svelte     # Skeleton      ← qr-code.tsx:471-500 (QRCodeSkeleton)
├── qr-code-download.svelte     # Download      ← qr-code.tsx:389-444 (QRCodeDownload)
├── qr-code.svelte.ts           # QRCodeState + Symbol context + pure helpers + defaults
│                               #               ← qr-code.tsx:15-82,116-249 (Store, contexts, memos, generate)
├── qr-code.test.svelte         # composition harness for the tests (NOT in registry.json)
└── qr-code.test.ts             # colocated tests (NOT in registry.json)

src/routes/docs/components/qr-code/
└── +page.svelte                # 4 upstream demos + Playground + props table

registry.json                   # append exactly one registry:ui entry named "qr-code"
package.json                    # + qrcode ^1.5.4 (dep), + @types/qrcode ^1.5.6 (devDep)
```

**Structure Decision**: seven part files, one per exported upstream component, mapped above line-for-line
to `.reference/diceui/docs/registry/bases/radix/ui/qr-code.tsx`. No part is merged or split, and no
extra part is invented. Folder slug `qr-code` == demo route segment `/docs/components/qr-code` ==
`registry.json` item name `qr-code` == upstream name `qr-code`. `qr-code.test.svelte` follows the
existing `circular-progress.test.svelte` / `direction-provider.test.svelte` precedent: it is a test
fixture, is not matched by the Vitest `include` glob (`src/**/*.{test,spec}.{js,ts}`), and is excluded
from the registry entry along with `qr-code.test.ts`.

## Implementation Schedule

Ordered; `/speckit-tasks` will expand this into `tasks.md`.

1. **Dependency** — `pnpm add qrcode@^1.5.4` and `pnpm add -D @types/qrcode@^1.5.6` (both
   non-interactive). Nothing else is installed; `shadcn-svelte add` is not run.
2. **State module** — `qr-code.svelte.ts`: level/format tuples, `QRCodeGenerateOptions`, the nine
   `DEFAULT_*` constants, the four pure helpers, `QRCodeState` (fields, deriveds, `generate`,
   `download`), and the Symbol context trio with the throwing getter.
3. **Root** — `qr-code.svelte`: props + JSDoc copied from `types/radix/qr-code.ts`, state
   construction, `setQRCodeContext`, the `--qr-code-size` style composition, the generation
   `$effect` with its `cancelAnimationFrame` teardown, `data-state`, and the `child` branch.
4. **Renderer parts** — `qr-code-canvas.svelte` (element registration + `invisible` gating +
   `role="img"`/`aria-label`), `qr-code-svg.svelte` (`{@html}` + `{#if svgString}`),
   `qr-code-image.svelte` (`{#if dataUrl}` + `alt`).
5. **Chrome parts** — `qr-code-skeleton.svelte` (`{#if !isLoaded}`), `qr-code-overlay.svelte`,
   `qr-code-download.svelte` (native button, caller-`onclick`-first + `defaultPrevented` check,
   guarded download, default label text).
6. **Barrel** — `index.ts` per §3 of CLAUDE.md, re-exporting the state module's reuse surface.
7. **Tests** — `qr-code.test.svelte` harness + `qr-code.test.ts`, per the Test Plan below.
8. **Demo route** — `src/routes/docs/components/qr-code/+page.svelte`.
9. **Registry** — append the entry, then `pnpm run registry:build`.
10. **Gates** — `pnpm run format`, `check`, `lint`, `test:unit -- --run`, `build`, all green with no
    suppressions.

## Test Plan

`src/lib/components/ui/qr-code/qr-code.test.ts`, Vitest + `@testing-library/svelte` +
`user-event`, with `vi.mock('qrcode', …)` supplying `toDataURL` / `toCanvas` / `toString` spies
(research R-08). Every `it` asserts at least once (`expect.requireAssertions`).

| Area (Constitution III) | Cases |
| ----------------------- | ----- |
| Rendering & structure   | root renders with `data-slot="qr-code"` and `--qr-code-size`; each part renders its documented element and `data-slot`; parts combine freely (canvas + svg + image in one root, spec edge case 6) |
| Roles & accessible names | canvas and svg expose `role="img"` with name `QR code for {value}`; image exposes `alt="QR Code"` by default and a custom `alt` when given; a caller-supplied `aria-label` overrides the default; download button has an accessible name defaulting to `Download PNG`/`Download SVG` |
| Every prop              | `size` → canvas `width`/`height` + `--qr-code-size` + svg/skeleton inline size; `level`, `margin`, `quality`, `foregroundColor`, `backgroundColor` → asserted on the encoder options object the mock receives; `alt`, `filename`, `format` on their parts; `class` merges last on all 7 parts; `ref` binds on all 7 parts; `child` snippet renders in place of the default element on all 7 parts |
| Reactivity (replaces "uncontrolled") | changing `value` regenerates and fires `onGenerated` again; changing each customization prop regenerates (FR-007) |
| Idempotence (replaces "controlled")  | re-rendering with an identical prop set does not call the encoder a second time (FR-007, spec edge case 7) |
| Keyboard                | `Tab` reaches the download button; `Enter` triggers the download; `Space` triggers the download (FR-006, MDX keyboard table) |
| Lifecycle & callbacks   | skeleton is visible before generation and gone after (FR-004); svg/image render nothing before their output exists; `onGenerated` fires once on success; `onError` fires with the thrown `Error` and a non-`Error` throw is normalised to `Failed to generate QR code`; a failure clears `dataUrl`/`svgString` (FR-008, research R-11) |
| Guard rails             | empty `value` ⇒ encoder never called, nothing thrown (FR-009); download click with no output ⇒ no anchor is created/clicked (FR-006); a caller `onclick` that calls `preventDefault()` suppresses the download; each of the 7 parts rendered outside `<QRCode.Root>` throws `/must be used within/` (FR-010) |
| RTL                     | inside `dir="rtl"`, the root keeps `flex-col items-center`, the overlay keeps its centring classes, and the download button is still keyboard-activatable (FR-013, research R-10) |

Note on `disabled`/`readOnly`: neither exists upstream on any part of this component, so the
Principle III "guard rails" slot is filled by the empty-value, no-output-download,
`preventDefault` and outside-provider cases listed above rather than by a `disabled` case.

## Demo Route Plan

`src/routes/docs/components/qr-code/+page.svelte` — one `<ComponentPreview>` per upstream demo file,
plus two additions the constitution's docs principle invites (a live playground and the props table
the task brief requires):

| Section | Mirrors | Content |
| ------- | ------- | ------- |
| Default | `qr-code-demo.tsx` | `Root value="https://diceui.com" size={200}` with `Skeleton` + `Canvas` |
| Different Formats | `qr-code-formats-demo.tsx` | Three 120px codes — Canvas, Svg, Image — each with a `Download` rendered through the `child` snippet as `<Button size="sm">`, reproducing upstream's `asChild` |
| Customization | `qr-code-customization-demo.tsx` | 150px custom-colour code and a `level="H"` code, both with `Skeleton` |
| Overlay | `qr-code-overlay-demo.tsx` | Three `level="H"` codes (canvas/svg/image) each with an `Overlay` holding a `Dice4` icon from `@lucide/svelte` |
| Playground | — (Svelte-specific) | Rune-held `value`/`size`/`level` bound to inputs, proving FR-007 reactivity and the empty-value guard live |
| API Reference | upstream MDX tables | Props table per part (name, type, default), the `--qr-code-size` CSS-variable row, the `Enter`/`Space` keyboard table, and the error-correction-level table |

Upstream's demo colours (`#3b82f6`, `#f1f5f9`, `#dc2626`) are **prop values passed to an encoder**,
not Tailwind classes, so they are copied verbatim; Principle VIII's semantic-token rule governs
`class` attributes, and every `class` on the page uses tokens (`text-muted-foreground`, `bg-accent`,
`border-border`). The demo's own layout wrappers use `grid`/`gap-*`, never `space-*`.

## Registry Entry Plan

Appended to `registry.json` (25th item):

```jsonc
{
	"name": "qr-code",
	"type": "registry:ui",
	"title": "QR Code",
	"description": "A flexible QR code component for generating and displaying QR codes with customization options.",
	"dependencies": ["qrcode"],
	"files": [
		{ "path": "src/lib/components/ui/qr-code/index.ts", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/qr-code/qr-code.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/qr-code/qr-code-canvas.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/qr-code/qr-code-svg.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/qr-code/qr-code-image.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/qr-code/qr-code-overlay.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/qr-code/qr-code-skeleton.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/qr-code/qr-code-download.svelte", "type": "registry:ui" },
		{ "path": "src/lib/components/ui/qr-code/qr-code.svelte.ts", "type": "registry:ui" }
	]
}
```

`description` is upstream's MDX front-matter description verbatim. **No `registryDependencies`**: the
component imports only `$lib/utils.js` and its own files — no other `src/lib/components/ui/*`
component and no Bits UI primitive — so listing one would be false. (`Button` and `@lucide/svelte`
appear only on the demo route, and the docs → component dependency arrow never points back.) The
shadcn-svelte registry-item schema has no `devDependencies` key, so `@types/qrcode` is installed
locally and surfaced in the demo page's install note instead of in the entry. `pnpm run registry:build`
runs afterwards, emitting `static/r/qr-code.json`.

## Complexity Tracking

No Constitution Check violations. Nothing to record.
