# Phase 1 Data Model — Port QR Code

**Feature**: `025-port-qr-code` | **Date**: 2026-07-31

All reactive state lives in one class, `QRCodeState`, in
`src/lib/components/ui/qr-code/qr-code.svelte.ts`. It replaces upstream's `Store` + `StoreState` +
`StoreContext` + `QRCodeContextValue` + `QRCodeContext` (research.md R-02).

---

## Types

### `QRCodeLevel`

```ts
export const QR_CODE_LEVELS = ['L', 'M', 'Q', 'H'] as const;
export type QRCodeLevel = (typeof QR_CODE_LEVELS)[number];
```

Port of `qr-code.tsx:15`. The tuple exists so the demo page can iterate the levels and so tests can
assert every value round-trips into the encoder options.

| Level | Recovery | Meaning  |
| ----- | -------- | -------- |
| `L`   | ~7%      | Low      |
| `M`   | ~15%     | Medium (default) |
| `Q`   | ~25%     | Quartile |
| `H`   | ~30%     | High — required when an `Overlay` is used |

### `QRCodeFormat`

```ts
export const QR_CODE_FORMATS = ['png', 'svg'] as const;
export type QRCodeFormat = (typeof QR_CODE_FORMATS)[number];
```

The `format` union of `QRCodeDownloadProps` (`types/radix/qr-code.ts`).

### `QRCodeGenerateOptions`

Port of `QRCodeCanvasOpts` (`qr-code.tsx:17-30`) — the object handed to the `qrcode` library.

| Field                 | Type                                          | Source                                |
| --------------------- | --------------------------------------------- | ------------------------------------- |
| `errorCorrectionLevel` | `QRCodeLevel`                                 | `level`                               |
| `type`                | `'image/png' \| 'image/jpeg' \| 'image/webp'` | fixed `'image/png'` (upstream :164)   |
| `quality`             | `number`                                      | `quality`                             |
| `margin`              | `number`                                      | `margin`                              |
| `color`               | `{ dark: string; light: string }`             | `{ dark: foregroundColor, light: backgroundColor }` |
| `width`               | `number`                                      | `size`                                |

Structurally assignable to `qrcode`'s `QRCodeToDataURLOptions`; no `any`, no cast.

---

## Defaults

Exported as named constants so the parts, the tests and the docs props table share one source of
truth. Values are upstream verbatim (`qr-code.tsx:100-106`, `types/radix/qr-code.ts`).

| Constant                    | Value       | Prop              |
| --------------------------- | ----------- | ----------------- |
| `DEFAULT_SIZE`              | `200`       | `size`            |
| `DEFAULT_LEVEL`             | `'M'`       | `level`           |
| `DEFAULT_MARGIN`            | `1`         | `margin`          |
| `DEFAULT_QUALITY`           | `0.92`      | `quality`         |
| `DEFAULT_BACKGROUND_COLOR`  | `'#ffffff'` | `backgroundColor` |
| `DEFAULT_FOREGROUND_COLOR`  | `'#000000'` | `foregroundColor` |
| `DEFAULT_IMAGE_ALT`         | `'QR Code'` | `Image.alt`       |
| `DEFAULT_FILENAME`          | `'qrcode'`  | `Download.filename` |
| `DEFAULT_FORMAT`            | `'png'`     | `Download.format` |

---

## Pure helpers (no runes — importable and unit-testable on their own)

| Helper                                                     | Returns                     | Ports                         |
| ---------------------------------------------------------- | --------------------------- | ----------------------------- |
| `buildQRCodeOptions(input): QRCodeGenerateOptions`          | encoder options             | `canvasOpts` memo (`:160-173`) |
| `buildGenerationKey(input): string`                         | `''` when `value` is empty, else the `JSON.stringify` fingerprint | `generationKey` memo (`:175-187`) |
| `getQRCodeLabel(value: string): string`                     | `` `QR code for ${value}` `` | new — FR-011 / research R-05  |
| `resolveDownload(state, filename, format): { href; download; revoke: boolean } \| null` | `null` when there is nothing to download | the `onClick` body (`:406-419`) |

`buildGenerationKey` keys on exactly the seven inputs upstream keys on — `value`, `size`, `level`,
`margin`, `quality`, `foregroundColor`, `backgroundColor` — which is what makes FR-007's "avoid
redundant regeneration" and the spec's "same configuration supplied again" edge case hold.

---

## `QRCodeState`

Constructed once by the root and shared through the context (see §Context below).

### Constructor input — `QRCodeStateProps`

Every reactive value arrives as a getter function, per CLAUDE.md §4, so the class keeps tracking it.

| Getter                | Type                              |
| --------------------- | --------------------------------- |
| `getValue`            | `() => string`                    |
| `getSize`             | `() => number`                    |
| `getLevel`            | `() => QRCodeLevel`               |
| `getMargin`           | `() => number`                    |
| `getQuality`          | `() => number`                    |
| `getForegroundColor`  | `() => string`                    |
| `getBackgroundColor`  | `() => string`                    |
| `getOnError`          | `() => ((error: Error) => void) \| undefined` |
| `getOnGenerated`      | `() => (() => void) \| undefined` |

### Reactive fields (`$state`) — upstream `StoreState` (`qr-code.tsx:32-38`)

| Field           | Type                     | Initial | Meaning                                                      |
| --------------- | ------------------------ | ------- | ------------------------------------------------------------ |
| `dataUrl`       | `string \| null`         | `null`  | PNG data URL; feeds `Image` and the PNG download             |
| `svgString`     | `string \| null`         | `null`  | SVG markup; feeds `Svg` and the SVG download                 |
| `isGenerating`  | `boolean`                | `false` | a generation is in flight — the re-entrancy guard            |
| `error`         | `Error \| null`          | `null`  | last failure; cleared at the start of each attempt           |
| `generationKey` | `string`                 | `''`    | fingerprint of the **last completed** generation             |
| `canvasElement` | `HTMLCanvasElement \| null` | `null` | registered by `Canvas`; upstream's shared `canvasRef` (`:55`, `:114`) |

### Derived (`$derived`)

| Member             | Type                    | Definition                                                   |
| ------------------ | ----------------------- | ------------------------------------------------------------ |
| `value`…`backgroundColor` | mirrors of the getters | thin `$derived` reads so parts never touch the getters directly |
| `options`          | `QRCodeGenerateOptions` | `buildQRCodeOptions(...)`                                     |
| `generationTarget` | `string`                | `buildGenerationKey(...)` — `''` disables generation (FR-009) |
| `isLoaded`         | `boolean`               | `Boolean(dataUrl \|\| svgString \|\| generationKey)` — upstream `:479`; gates `Skeleton` |
| `label`            | `string`                | `getQRCodeLabel(value)` — the canvas/svg accessible name      |

### Methods

| Method                                     | Behaviour |
| ------------------------------------------ | --------- |
| `async generate(targetKey: string): Promise<void>` | The port of `onQRCodeGenerate` (`:189-249`). Returns immediately when `value` is empty, when `targetKey` is `''`, when `isGenerating`, or when `generationKey === targetKey`. Otherwise: sets `isGenerating = true`, `error = null`; `await import('qrcode')`; `toDataURL` in its own try/catch falling back to `null`; `toCanvas(canvasElement, …)` when a canvas is registered; `toString(…, { type: 'svg' })`; then commits `dataUrl`, `svgString`, `generationKey = targetKey`, `isGenerating = false` and calls `onGenerated()`. On throw: normalises to an `Error` (`'Failed to generate QR code'` for non-`Error` throws), clears `dataUrl`/`svgString` (research R-11), sets `error`, `isGenerating = false`, and calls `onError(error)`. |
| `download(filename: string, format: QRCodeFormat): void` | Applies `resolveDownload()`; a `null` result is a no-op (FR-006). Otherwise creates the `<a>`, appends, clicks, removes, and revokes the object URL for `svg`. |

### State transitions

```text
                    generationTarget !== ''            success
   idle ────────────────────────────────► generating ──────────► ready
 (all null)                                   │                (dataUrl?/svgString,
      ▲                                       │                 generationKey = target)
      │                                  failure                      │
      │                                       ▼                       │ target changes
      └───────────────────────────────── errored ◄───────────────────┘
        (dataUrl = svgString = null, error set, generationKey unchanged)
```

`ready → generating` is only entered when `generationTarget !== generationKey`; that inequality *is*
FR-007.

---

## Context

```ts
const QR_CODE_CONTEXT_KEY = Symbol('qr-code');

export function setQRCodeContext(state: QRCodeState): QRCodeState;
export function hasQRCodeContext(): boolean;
export function getQRCodeContext(consumerName?: string): QRCodeState; // throws when absent
```

The thrown message is
`` `${consumerName ?? '`<QRCode>` part'} must be used within \`<QRCode.Root>\`.` `` — the parity
replacement for upstream's `` `\`${consumerName}\` must be used within \`QRCode\`` `` (`:79`), and
for its `useQRCode` export (`:511`), which was the public name of the store hook. Every consuming
part calls it with its own name, so FR-010 / spec edge case 3 is satisfied per part. `Overlay` and
`Download` also call it (`Download` needs `dataUrl`/`svgString`; `Overlay` needs nothing from it but
FR-010 requires the guard, and upstream's `Overlay` is meaningless outside a root).

---

## Component → state map

| Part       | Reads                                     | Writes          |
| ---------- | ----------------------------------------- | --------------- |
| `Root`     | `generationTarget`                        | constructs the state; drives `generate()` |
| `Canvas`   | `size`, `generationKey`, `label`          | `canvasElement` |
| `Svg`      | `svgString`, `size`, `label`              | —               |
| `Image`    | `dataUrl`, `size`                         | —               |
| `Overlay`  | — (guard only)                            | —               |
| `Skeleton` | `isLoaded`, `size`                        | —               |
| `Download` | `dataUrl`, `svgString`                    | — (calls `download()`) |
