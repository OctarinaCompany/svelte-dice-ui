# Public API Contract — `qr-code`

**Feature**: `025-port-qr-code` | Derived from
`.reference/diceui/docs/registry/bases/radix/ui/qr-code.tsx` and
`.reference/diceui/docs/types/radix/qr-code.ts` at pinned commit `d9763d8`.

Import surface:

```ts
import * as QRCode from '$lib/components/ui/qr-code/index.js'; // QRCode.Root, QRCode.Canvas, …
import { QRCode, QRCodeCanvas, QRCodeDownload } from '$lib/components/ui/qr-code/index.js';
```

Conventions that hold for **every** part below and are therefore not repeated in each table:

- `ref` — `HTMLElement subtype | null`, default `null`, **bindable**. Replaces `forwardRef`. Stays
  `null` in `child` mode.
- `class` — `string | undefined`; destructured as `class: className` and merged **last** via `cn()`.
- `children` — `Snippet | undefined`, rendered with `{@render children?.()}` (not rendered in
  `child` mode).
- `child` — `Snippet<[{ props: <Part>ChildProps }]>`, the `asChild` replacement (research R-04).
- `...restProps` — the remaining native attributes, spread onto the element **after** the computed
  defaults and **before** `class`, so a caller can override `aria-label`, `role`, `id`, handlers, etc.
- Every part carries `data-slot="<upstream slot>"`, identical to upstream.

---

## `Root` / `QRCode` — `qr-code.svelte`

Renders `<div>`. Upstream `QRCode` (`qr-code.tsx:97-293`).

| Prop              | Type                                            | Default       | Bindable | Notes |
| ----------------- | ----------------------------------------------- | ------------- | -------- | ----- |
| `value`           | `string`                                        | — (required)  | no       | The data to encode, e.g. `"https://example.com"`. Empty string ⇒ no generation is attempted (FR-009). |
| `size`            | `number`                                        | `200`         | no       | Pixel size; also published as `--qr-code-size`. |
| `level`           | `'L' \| 'M' \| 'Q' \| 'H'`                      | `'M'`         | no       | Error-correction level. Use `'H'` with `Overlay`. |
| `margin`          | `number`                                        | `1`           | no       | Quiet-zone width in modules; `0` removes it. |
| `quality`         | `number`                                        | `0.92`        | no       | 0–1; only meaningful for lossy output formats. |
| `backgroundColor` | `string`                                        | `'#ffffff'`   | no       | Light-module colour. |
| `foregroundColor` | `string`                                        | `'#000000'`   | no       | Dark-module colour. |
| `onError`         | `(error: Error) => void \| undefined`           | `undefined`   | no       | Fired after a failed generation. Does **not** collide with Svelte's native `onerror` (different casing), so unlike React there is no `Omit<…, 'onError'>`. |
| `onGenerated`     | `() => void \| undefined`                       | `undefined`   | no       | Fired after a successful generation. |
| `style`           | `string \| undefined`                           | `undefined`   | no       | Appended **after** `--qr-code-size`, preserving upstream override order. |
| `ref`             | `HTMLDivElement \| null`                        | `null`        | **yes**  | |

**Snippets**: `children`, `child`.
**Callbacks/events**: `onError`, `onGenerated`, plus every native `HTMLAttributes<HTMLDivElement>` handler through `restProps`.
**Emitted attributes**: `data-slot="qr-code"`; `style` containing `--qr-code-size: {size}px`.
**Default class**: `relative flex flex-col items-center gap-2`.

**Divergence from upstream (recorded)**: the root additionally exposes
`data-state="idle" | "generating" | "ready" | "error"` so consumers can style the generation
lifecycle from the outside — required by Constitution Principle VIII ("every piece of component state
MUST be exposed as a `data-*` attribute"). Purely additive.

---

## `Canvas` / `QRCodeCanvas` — `qr-code-canvas.svelte`

Renders `<canvas>`. Upstream `QRCodeCanvas` (`:299-323`).

| Prop         | Type                          | Default                    | Bindable |
| ------------ | ----------------------------- | -------------------------- | -------- |
| `ref`        | `HTMLCanvasElement \| null`   | `null`                     | **yes**  |
| `aria-label` | `string` (via `restProps`)    | `` `QR code for ${value}` `` | no     |

**Snippets**: `children` (canvas fallback content), `child`.
**Emitted attributes**: `data-slot="qr-code-canvas"`, `role="img"`, `aria-label`,
`width`/`height` = root `size`.
**Default class**: `relative max-h-(--qr-code-size) max-w-(--qr-code-size)`, plus `invisible` while
`generationKey` is empty (upstream `:318`).
**Behaviour**: registers its element on the shared state so `QRCode.toCanvas` can draw into it —
the port of upstream's composed `context.canvasRef` (`:305`). Unregisters on teardown.
**Divergence**: `role="img"` + default `aria-label` are additive (research R-05, FR-011).

---

## `Svg` / `QRCodeSvg` — `qr-code-svg.svelte`

Renders `<div>` containing the generated SVG markup. Upstream `QRCodeSvg` (`:329-351`).

| Prop         | Type                       | Default                      | Bindable |
| ------------ | -------------------------- | ---------------------------- | -------- |
| `ref`        | `HTMLDivElement \| null`   | `null`                       | **yes**  |
| `style`      | `string \| undefined`      | `undefined`                  | no       |
| `aria-label` | `string` (via `restProps`) | `` `QR code for ${value}` `` | no       |

**Snippets**: `child`. (`children` is not accepted — the element's content is the generated markup,
as upstream sets it via `dangerouslySetInnerHTML`; the Svelte equivalent is `{@html svgString}`.)
**Emitted attributes**: `data-slot="qr-code-svg"`, `role="img"`, `aria-label`; inline
`width`/`height` = root `size`, emitted before the caller's `style`.
**Default class**: `relative max-h-(--qr-code-size) max-w-(--qr-code-size)`.
**Behaviour**: renders **nothing** until `svgString` is non-null (upstream `if (!svgString) return null`).

---

## `Image` / `QRCodeImage` — `qr-code-image.svelte`

Renders `<img>`. Upstream `QRCodeImage` (`:357-381`).

| Prop  | Type                        | Default     | Bindable |
| ----- | --------------------------- | ----------- | -------- |
| `alt` | `string`                    | `'QR Code'` | no       |
| `ref` | `HTMLImageElement \| null`  | `null`      | **yes**  |

**Snippets**: `child`.
**Emitted attributes**: `data-slot="qr-code-image"`, `src` = `dataUrl`, `alt`, `width`/`height` = root `size`.
**Default class**: `relative max-h-(--qr-code-size) max-w-(--qr-code-size)`.
**Behaviour**: renders **nothing** until `dataUrl` is non-null.

---

## `Overlay` / `QRCodeOverlay` — `qr-code-overlay.svelte`

Renders `<div>`. Upstream `QRCodeOverlay` (`:450-465`).

| Prop  | Type                     | Default | Bindable |
| ----- | ------------------------ | ------- | -------- |
| `ref` | `HTMLDivElement \| null` | `null`  | **yes**  |

**Snippets**: `children` (the logo/icon), `child`.
**Emitted attributes**: `data-slot="qr-code-overlay"`.
**Default class**: `absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm bg-background`.
**Behaviour**: no state of its own; calls the context getter purely so that using it outside the root
throws the documented error (FR-010).

---

## `Skeleton` / `QRCodeSkeleton` — `qr-code-skeleton.svelte`

Renders `<div>`. Upstream `QRCodeSkeleton` (`:471-500`).

| Prop    | Type                     | Default     | Bindable |
| ------- | ------------------------ | ----------- | -------- |
| `style` | `string \| undefined`    | `undefined` | no       |
| `ref`   | `HTMLDivElement \| null` | `null`      | **yes**  |

**Snippets**: `children`, `child`.
**Emitted attributes**: `data-slot="qr-code-skeleton"`; inline `width`/`height` = root `size`.
**Default class**: `absolute max-h-(--qr-code-size) max-w-(--qr-code-size) animate-pulse bg-accent`.
**Behaviour**: renders **nothing** once `dataUrl || svgString || generationKey` is truthy
(upstream `:479-481`) — FR-004.

---

## `Download` / `QRCodeDownload` — `qr-code-download.svelte`

Renders `<button type="button">`. Upstream `QRCodeDownload` (`:389-444`).

| Prop       | Type                                     | Default    | Bindable |
| ---------- | ---------------------------------------- | ---------- | -------- |
| `filename` | `string`                                 | `'qrcode'` | no       |
| `format`   | `'png' \| 'svg'`                         | `'png'`    | no       |
| `onclick`  | `MouseEventHandler<HTMLButtonElement>`   | `undefined`| no       |
| `ref`      | `HTMLButtonElement \| null`              | `null`     | **yes**  |

**Snippets**: `children` — defaults to the text `` `Download ${format.toUpperCase()}` `` when absent
(upstream `:441`); `child`.
**Callbacks/events**: the caller's `onclick` runs **first**; if it calls `preventDefault()` the
download is skipped (upstream `:404-405`).
**Emitted attributes**: `data-slot="qr-code-download"`, `type="button"`.
**Default class**: `max-w-(--qr-code-size)` plus the repo's focus-visible ring tokens (research R-06,
FR-012).
**Keyboard**: `Enter` and `Space` activate it — native `<button>` semantics, matching the upstream
MDX accessibility table exactly. No key handler is added.
**Guard**: a click with no `dataUrl` (png) or no `svgString` (svg) is a no-op — no anchor is created
(FR-006, spec edge case 5).

---

## Module exports — `qr-code.svelte.ts` (re-exported from `index.ts`)

The reuse surface for later ports (deliverable 5):

| Export | Kind | Purpose |
| ------ | ---- | ------- |
| `QRCodeState`, `type QRCodeStateProps` | class / type | the shared generation state |
| `setQRCodeContext`, `hasQRCodeContext`, `getQRCodeContext` | functions | the Symbol-keyed context trio; `getQRCodeContext` is the parity replacement for upstream's exported `useQRCode` hook (`:511`) |
| `QR_CODE_LEVELS`, `type QRCodeLevel` | const tuple / type | error-correction levels |
| `QR_CODE_FORMATS`, `type QRCodeFormat` | const tuple / type | download formats |
| `type QRCodeGenerateOptions` | type | the encoder option object |
| `buildQRCodeOptions`, `buildGenerationKey`, `getQRCodeLabel`, `resolveDownload` | pure functions | rune-free, DOM-free; importable by any future component that needs QR encoding options, memo-keying or a data-URL/blob download |
| `DEFAULT_SIZE`, `DEFAULT_LEVEL`, `DEFAULT_MARGIN`, `DEFAULT_QUALITY`, `DEFAULT_BACKGROUND_COLOR`, `DEFAULT_FOREGROUND_COLOR`, `DEFAULT_IMAGE_ALT`, `DEFAULT_FILENAME`, `DEFAULT_FORMAT` | consts | one source of truth for parts, tests and the docs props table |

## Type exports — `index.ts`

`QRCodeRootProps`, `QRCodeChildProps`, `QRCodeCanvasProps`, `QRCodeCanvasChildProps`,
`QRCodeSvgProps`, `QRCodeSvgChildProps`, `QRCodeImageProps`, `QRCodeImageChildProps`,
`QRCodeOverlayProps`, `QRCodeOverlayChildProps`, `QRCodeSkeletonProps`,
`QRCodeSkeletonChildProps`, `QRCodeDownloadProps`, `QRCodeDownloadChildProps`.

## Component exports — `index.ts`

Short names `Root, Canvas, Svg, Image, Overlay, Skeleton, Download` plus prefixed aliases
`QRCode, QRCodeCanvas, QRCodeSvg, QRCodeImage, QRCodeOverlay, QRCodeSkeleton, QRCodeDownload`.

## CSS variables

| Variable          | Set by | Value        | Purpose |
| ----------------- | ------ | ------------ | ------- |
| `--qr-code-size`  | `Root` | `${size}px`  | Constrains every child part to the QR dimensions (documented in the upstream MDX CSS-variables table). |
