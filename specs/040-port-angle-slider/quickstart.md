# Quickstart & Validation: `angle-slider`

How to run and prove the ported component works. Details of *what* is being built live in
[contracts/angle-slider.api.md](./contracts/angle-slider.api.md) and
[data-model.md](./data-model.md); *why* it is built that way lives in [research.md](./research.md).

## Prerequisites

- Node 20+, `pnpm` (the repo's package manager), dependencies already installed (`pnpm install`).
- No new packages are required by this feature.
- Everything below is non-interactive and terminates on its own — no watch modes, no dev server.

## 1. Build & type check

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run build
```

Expected: zero errors and zero warnings from each. `check` is the one that catches a missing exported
prop type or a `WithElementRef` mismatch in a part file; `build` is the one that catches a broken
demo route.

## 2. Unit tests

```bash
pnpm run test:unit -- --run
```

Expected: every test in `src/lib/components/ui/angle-slider/angle-slider.test.ts` passes, none
skipped, none `.todo`. `expect.requireAssertions` is on, so a test that renders but asserts nothing
fails.

### The one jsdom trap that makes pointer tests lie

jsdom's `getBoundingClientRect()` returns all zeros. The component's zero-size guard (research R-08)
then correctly treats every pointer event as a no-op — so a drag test written without a stub passes
while proving nothing about the arithmetic. Every pointer test must stub the root's rect first:

```ts
const root = screen.getByTestId('root');
vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
	left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0,
	toJSON: () => ({})
} as DOMRect);
```

Centre is then `(100, 100)`, and the quadrant table below applies directly. jsdom also has no real
pointer capture — `tests/setup.ts` already shims `setPointerCapture`/`hasPointerCapture`/
`releasePointerCapture`, so `pointerdown` → `pointermove` → `pointerup` sequences work.

## 3. Validation scenarios

Each maps to a spec acceptance scenario and is covered by at least one automated test.

### S1 — Pointer across all four quadrants (US1-1..3, SC-002)

Render `defaultValue={[0]} min={0} max={360} step={1}`, stub the rect as above, then dispatch
`pointerdown` at each point and read the emitted value:

| Pointer   | Position (rect 200×200) | Expected value |
| --------- | ----------------------- | -------------- |
| 12 o'clock| `(100, 0)`              | `0`            |
| 3 o'clock | `(200, 100)`            | `90`           |
| 6 o'clock | `(100, 200)`            | `180`          |
| 9 o'clock | `(0, 100)`              | `270`          |
| 1:30      | `(170.7, 29.3)`         | `45`           |

**Seam**: drag from just before 12 o'clock (`(93, 0)` ≈ `356°`) to just after (`(107, 0)` ≈ `4°`) and
assert the value crosses `0` without passing through any mid-range value.

### S2 — Keyboard (US1-4..6, SC-003)

Focus a thumb via `userEvent.tab()`, then per contracts §8: `ArrowRight`/`ArrowUp` `+1`,
`ArrowLeft`/`ArrowDown` `-1`, `PageUp` `+10`, `PageDown` `-10`, `Shift`+arrow `±10`, `Home` → `min`,
`End` → `max`. Repeat with `inverted` (every sign flips) and inside a `dir="rtl"` wrapper (only the
horizontal arrows flip).

### S3 — Controlled vs uncontrolled (FR-002, R-11)

- `defaultValue={[45]}` → the dial moves on its own and `onValueChange` reports each move.
- `bind:value={angle}` → the parent's variable follows the dial.
- `bind:value={() => angle, () => {}}` (a setter that declines) → `onValueChange` fires but
  `aria-valuenow` never changes. This is the "must not move on its own" case.

### S4 — Two-thumb range (US2, SC-002)

`defaultValue={[90, 270]} step={5} minStepsBetweenThumbs={2}`: two focusable thumbs; dragging one
toward the other stops with the values exactly `10` apart and never crossing; tabbing to the second
thumb and pressing an arrow moves only that thumb; the range `<path>` spans exactly the two values.

### S5 — Form participation (US1-7, US2-4, SC-004)

Render inside a `<form name="…">`, then read the submitted values with `new FormData(form)`:

- one thumb, `name="rotation"` → a single `rotation` entry equal to `aria-valuenow`
- two thumbs, `name="range"` → two `range[]` entries, in sorted order
- `disabled` → no entries (the hidden inputs are disabled)
- `readOnly` → entries still present with the current values

### S6 — Guard rails (US3-4/5, SC-007)

`disabled`: dragging changes nothing, arrow keys change nothing, the thumb has no `tabindex` and
`aria-disabled="true"`, and the root carries `[data-disabled]`.
`readOnly`: dragging and keys change nothing, but the thumb is still tabbable, has
`aria-readonly="true"`, and the root carries `[data-readonly]`.

### S7 — Geometry and provider errors (US3-1, FR-018)

`startAngle={-90} endAngle={90}` renders the rail as an arc `<path>`, not a `<circle>`; the default
full sweep renders a `<circle>`. Rendering any part outside `<AngleSlider.Root>` throws an error
matching `/within/`.

## 4. Manual check in the docs app

The demo route is `/docs/components/angle-slider`. Verify by building
(`pnpm run build` covers the route) and, if inspecting by hand, note that the project rule against
long-running processes means the dev server is not started as part of this feature's validation —
`build` plus the unit suite is the evidence.

Expected sections, one per upstream demo: **Default**, **Controlled** (animated Reset / Randomize
buttons), **Range** (two thumbs, live readout), **Themes** (semantic-token swatch grid), **Form**
(two sliders in one form, submitted together), followed by the props table.

## 5. Registry

```bash
pnpm run registry:build
```

Expected: `static/r/angle-slider.json` is written, containing all eight component files with
`$lib/...` imports rewritten to registry placeholders, and `registryDependencies: ["direction-provider"]`.
