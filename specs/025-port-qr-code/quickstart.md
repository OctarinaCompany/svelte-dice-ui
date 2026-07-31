# Quickstart / Validation — `qr-code`

**Feature**: `025-port-qr-code`

This is the run-and-verify guide for the port. API details live in
[`contracts/qr-code.api.md`](./contracts/qr-code.api.md); state shape lives in
[`data-model.md`](./data-model.md).

## Prerequisites

The one new npm package, installed non-interactively from the repo root:

```bash
pnpm add qrcode@^1.5.4
pnpm add -D @types/qrcode@^1.5.6
```

Pinned to the same ranges as `.reference/diceui/docs/package.json` (lines 57, 76). No other
dependency is added.

## Smoke test the component

```svelte
<script lang="ts">
	import * as QRCode from '$lib/components/ui/qr-code/index.js';
</script>

<QRCode.Root value="https://diceui.com" size={200}>
	<QRCode.Skeleton />
	<QRCode.Canvas />
</QRCode.Root>
```

Expected: a pulsing placeholder for one frame, then a 200×200 canvas showing a QR code that decodes
to `https://diceui.com` in any phone camera (SC-001, FR-001).

## Runnable validation scenarios

Each maps to a user story in [`spec.md`](./spec.md). Run them on the demo route
(`/docs/components/qr-code`) after `pnpm run build && pnpm run preview` — never `pnpm dev`, which is
a watch process.

| # | Story | Scenario | Expected |
| - | ----- | -------- | -------- |
| 1 | US1 | Load the "Default" preview | A QR code appears; scanning it yields `https://diceui.com` exactly |
| 2 | US1 | Inspect the canvas in the accessibility tree | `role="img"`, name `QR code for https://diceui.com` (FR-011) |
| 3 | US1 | In the "Playground" preview, edit the value input | The code regenerates without a remount (SC-006) |
| 4 | US2 | Load the "Different Formats" preview | Three codes — `<canvas>`, an inline `<svg>` inside a `div[data-slot="qr-code-svg"]`, and an `<img>` — all identical, each with its own download button |
| 5 | US2 | Throttle the network / reload | Only the skeleton is visible before generation; no empty canvas box or broken image icon (FR-004) |
| 6 | US3 | Load the "Customization" preview | One code in custom blue-on-slate at 150px, one red at `level="H"`; both scan (FR-002) |
| 7 | US3 | In the "Playground", clear the value input | Nothing renders, no console error, no unhandled rejection (FR-009) |
| 8 | US4 | Load the "Overlay" preview | The dice icon is centred over each code; all three still scan at `level="H"` (SC-003) |
| 9 | US4 | Click "Download PNG" | `qr-canvas.png` downloads and opens as a valid image |
| 10 | US4 | Focus "Download SVG" with `Tab`, press `Enter`, then `Space` | Two `qr-svg.svg` downloads, one per key (FR-006, FR-012) |
| 11 | FR-013 | Toggle the page to `dir="rtl"` via devtools | Codes, overlays and skeletons stay centred; the download button keeps its focus ring and still activates (SC-005) |

## Automated gates

Run in this order from the repo root; all four must be green with no suppressions
(Constitution VI/VII).

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

Target the component's own suite while iterating:

```bash
pnpm run test:unit -- --run src/lib/components/ui/qr-code/qr-code.test.ts
```

`qr-code.test.ts` mocks the `qrcode` module (`vi.mock`), because jsdom implements no 2D canvas
context — see [`research.md` R-08](./research.md). Encoder correctness is `qrcode`'s concern and is
validated by scenario 1 above, not by the unit suite.

## Registry

```bash
pnpm run registry:build
```

Then confirm `static/r/qr-code.json` exists, lists all nine component files, and carries
`"dependencies": ["qrcode"]`. Confirm the docs index at `/docs/components` shows the "QR Code" card
and that the sidebar entry links to `/docs/components/qr-code`.
