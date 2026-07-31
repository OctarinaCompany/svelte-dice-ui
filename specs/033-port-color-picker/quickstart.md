# Quickstart: validating the Color Picker port

Prerequisites: `pnpm install` already run; Node 22+; `pwsh` 7 for the Spec Kit scripts. Every command
below is non-interactive and terminates.

## 1. Static gates

```bash
pnpm run format
pnpm run check
pnpm run lint
```

Expected: `svelte-check` reports 0 errors / 0 warnings; `prettier --check` and `eslint` report
nothing. Any `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore` or `as any` in the
new files invalidates the run regardless of exit code (constitution Quality Gates).

## 2. Unit tests

```bash
pnpm run test:unit -- --run src/lib/components/ui/color-picker
```

Two spec files must pass with no `.skip`/`.todo` and every `it` asserting:

- `color.test.ts` — the pure maths (see [contracts/color-picker-api.md](./contracts/color-picker-api.md#colorts-function-contract)).
  Key cases: hex ⇄ rgb round-trip, `rgbToHsv`/`hsvToRgb` for the six hue sectors and for the
  greyscale axis, `colorToString` alpha suffix switching at `a < 1`, `parseColorString` accepting all
  four notations and rejecting garbage, `getInputFields` field sets and `position` assignment for
  each format with and without `withoutAlpha`.
- `color-picker.test.ts` — the six constitution-mandated areas plus the port-specific cases listed in
  plan.md § "Test plan".

Full suite before finishing:

```bash
pnpm run test:unit -- --run
```

## 3. Build (includes every demo route)

```bash
pnpm run build
```

## 4. Registry

```bash
pnpm run registry:build
```

Expected: `static/r/color-picker.json` is produced, contains all 14 non-test files, and its
`$lib/...` imports are rewritten to registry placeholders. Confirm the entry's `name` is
`color-picker`, matching the folder slug and the demo route segment.

## 5. Manual acceptance scenarios

The demo route is `src/routes/docs/components/color-picker/`. These map 1:1 to the spec's acceptance
scenarios; run them against a preview build (`pnpm run build && pnpm run preview`) rather than a dev
watch server.

| # | Scenario (spec ref)                | Steps                                                                                 | Expected                                                                             |
| - | ---------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1 | US1-1 open by keyboard             | `Tab` to the trigger, press `Enter`                                                   | Popover opens, focus moves inside                                                    |
| 2 | US1-2 area by keyboard (SC-002)    | `Tab` to the area, press `ArrowRight` ×5, then `Shift+ArrowUp`                        | `aria-valuenow` +5, `aria-valuetext` updates, swatch and input follow                 |
| 3 | US1-3 hue                          | `Tab` to the hue slider, `Home` then `End`                                            | Hue 0 → 360; the area's base layer and the input update                               |
| 4 | US1-4 alpha                        | `Tab` to the alpha slider, `ArrowDown` to 0                                           | Swatch shows the checkerboard; the alpha field reads `0`                              |
| 5 | US1-5 escape                       | Press `Escape`                                                                        | Popover closes, focus is back on the trigger                                          |
| 6 | US1-6 format switch (SC-004)       | Set format `hex` → `rgb` → `hsl` → `hsb` → `hex`                                      | The hex value is unchanged (±1 per channel); no `onValueChange` fires on switch alone |
| 7 | US2 inline                         | Inline preview                                                                         | No trigger, no portal, no overlay; interaction still updates the bound state          |
| 8 | US3 form                           | Submit the form preview                                                                | `FormData` carries the hex string under the field `name`                              |
| 9 | Edge: invalid input                | Type `#3b82f` in the hex field, then `Tab` away                                        | Colour unchanged; the field snaps back to the last valid value                        |
| 10 | Edge: RTL (SC-006)                | Switch the preview to `dir="rtl"`, press `ArrowRight` on the area                     | Saturation **decreases**; hue/alpha sliders invert too                                |
| 11 | Edge: eyedropper                   | In Chromium, click the pipette and sample a pixel; in Firefox, look for the button     | Chromium: colour updates, alpha preserved. Firefox: no button rendered at all         |
| 12 | Guard rails                        | Set `disabled` on the root                                                             | Trigger, area, sliders, select and inputs are all inert and expose `data-disabled`    |

## 6. Definition of done

- All four gates green, in order, with no suppression.
- 4 `<ComponentPreview>` sections (default, inline, controlled, form) + 10 props tables on the demo route.
- Exactly one new `registry.json` entry; `static/r/color-picker.json` regenerated.
- Every divergence from upstream recorded in [spec.md](./spec.md) § Assumptions.
