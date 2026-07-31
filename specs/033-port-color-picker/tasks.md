---
description: 'Task list for the Color Picker port'
---

# Tasks: Color Picker

**Input**: Design documents from `specs/033-port-color-picker/` (plan.md, spec.md, research.md, data-model.md, contracts/color-picker-api.md, quickstart.md)

**Tests**: Tests are MANDATORY per constitution Principle III. Every behavioural area below must be
covered in colocated spec files before/alongside implementation; no `.skip`/`.todo`.

**Phase order** (per task-generation directive): Setup → Tests → Core component files → Barrel and
types → Demo route → Registry entry and docs polish → Verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 = popover picker (P1), US2 = inline mode (P2), US3 = controlled/form field (P3).
  Tasks shared across all three (state module, barrel, demo, registry, gates) carry no story label.

---

## Phase 1: Setup

- [X] T001 Create the component directory `src/lib/components/ui/color-picker/` and the docs route
      directory `src/routes/docs/components/color-picker/` (empty scaffolds only; no npm install
      needed — `bits-ui@2.18.1` and `@lucide/svelte@1.27` are already dependencies per plan.md
      Technical Context).
- [X] T002 Append a registry stub for `color-picker` to `registry.json` (`name`, `type: "registry:ui"`,
      `title`, `description`, `registryDependencies: ["button", "input", "popover", "select",
      "color-swatch", "checkbox-group", "direction-provider"]`, `dependencies: ["bits-ui",
      "@lucide/svelte"]`, `files: []`) — the `files` array is completed in T025 once every part exists.
      Do not run `pnpm run registry:build` at this point — the entry is intentionally incomplete
      until T025, and `static/r/color-picker.json` is generated only in T026.

**Checkpoint**: directories and registry stub exist; no component code yet.

---

## Phase 2: Tests (write first, confirm they fail before implementing)

- [X] T003 [P] Write pure colour-maths tests in
      `src/lib/components/ui/color-picker/color.test.ts`: `hexToRgb`/`rgbToHex` round-trip,
      `rgbToHsv`/`hsvToRgb` across the six hue sectors and the greyscale axis (hue must not reset to
      a stale value, per research R-02), `rgbToHsl`/`hslToRgb`, `colorToString` per format (alpha
      suffix appears only when `a < 1`), `parseColorString` accepting hex/rgb(a)/hsl(a)/hsb(a) and
      rejecting garbage, including `hexToRgb('#abc')` expanding to `{r:170,g:187,b:204}` (not black)
      and `parseColorString('#abc')` returning the same, `clampChannel`, `isColorFormat`, `getInputFields` field sets and `position`
      assignment for every format with and without `withoutAlpha`, and `describeColor`'s exact
      string shape. Per `contracts/color-picker-api.md` § "color.ts function contract".
- [X] T004 [P] Create the Svelte test harness `src/lib/components/ui/color-picker/color-picker.test.svelte`
      that wraps `ColorPicker.Root` with slots for injecting `bind:value`/`bind:open`/`bind:format`
      props, a `<DirectionProvider>` wrapper toggle, and a `<form>` wrapper toggle, so the specs in
      T005–T009 can render controlled, RTL, and form-integrated variants without duplicating markup.
- [X] T005 [US1] Write accessibility roles/ARIA/name tests in
      `src/lib/components/ui/color-picker/color-picker.test.ts`: `Trigger` is a `button` with
      `aria-expanded`; `Content` has `role="dialog"` when not inline; `Area` has `role="slider"`,
      `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow`, and a computed `aria-valuetext`
      matching `describeColor`; `HueSlider`/`AlphaSlider` thumbs are `role="slider"` with
      `aria-label` `"Hue"`/`"Alpha"` and `aria-valuetext` `"217 degrees"`/`"60%"`; `FormatSelect` is a
      combobox/listbox exposing exactly four options (`HEX`, `RGB`, `HSL`, `HSB`); every
      `ColorPicker.InputField` carries the exact upstream `aria-label` from data-model.md §5; `Swatch`
      is `role="img"` with `aria-label="Current color: …"` (and `"No color selected"` when empty).
- [X] T006 [US1] Write keyboard-interaction tests in
      `src/lib/components/ui/color-picker/color-picker.test.ts` (append after T005), driven with
      `userEvent`: `Enter`/`Space` on the trigger opens the popover and moves focus inside; `Escape`
      closes it and returns focus to the trigger; on `Area`, `ArrowLeft`/`ArrowRight` moves saturation
      by `step` (default `1`), `ArrowUp`/`ArrowDown` moves brightness by `step`, `Shift`+arrow uses
      `shiftStep` (default `10`), `Home`/`End` snap saturation to `0`/`100`, `PageUp`/`PageDown` move
      brightness by `shiftStep`, all clamped to `[0, 100]` and calling `preventDefault()`; on
      `HueSlider`/`AlphaSlider`, arrows/`Home`/`End`/`PageUp`/`PageDown` move the value across their
      full range; `Tab` order traverses trigger → area → eyedropper → hue → alpha → format select →
      input fields, and `Shift+Tab` traverses the same order in reverse.
- [X] T007 [US3] Write controlled-vs-uncontrolled tests in
      `src/lib/components/ui/color-picker/color-picker.test.ts` (append after T006), using the
      harness from T004: `defaultValue`/`defaultOpen`/`defaultFormat` seed the component and internal
      interaction (area drag or keyboard, trigger activation, format select) updates them
      internally; passing `value`/`open`/`format` makes the parent authoritative, `onValueChange`/
      `onOpenChange`/`onFormatChange` fire with the next value, and a binding that declines the write
      (does not update its bound variable) leaves the rendered colour/open state/format unchanged on
      the next interaction.
- [X] T008 [US1] Write RTL tests in `src/lib/components/ui/color-picker/color-picker.test.ts` (append
      after T007), rendering with `dir="rtl"` and separately under a `<DirectionProvider dir="rtl">`
      (via the T004 harness): `ArrowRight` on `Area` *decreases* saturation and `ArrowLeft`
      *increases* it (inverted from LTR); `HueSlider` and `AlphaSlider` invert their horizontal arrow
      direction; matches spec.md Edge Cases and SC-006.
- [X] T008a [US1] Write `child`-snippet composition tests in
      `src/lib/components/ui/color-picker/color-picker.test.ts` (append after T008), covering FR-019:
      for each of `Root`, `Trigger`, `Content`, `Area`, `Swatch`, `EyeDropper`, `FormatSelect` and
      `InputField`, rendering with a `child` snippet puts the merged props on the caller's element —
      `data-slot`, `data-disabled`, `role`/`aria-*` and the merged `class` all land on it, the default
      element is not rendered, and behaviour (trigger activation, area keyboard, swatch label) is
      unchanged. Assert that `ref` stays `null` in `child` mode, matching the `color-swatch`
      precedent.
- [X] T009 Write edge-case and guard-rail tests in
      `src/lib/components/ui/color-picker/color-picker.test.ts` (append after T008a), covering: typing
      an invalid/partial value into an input field does not change the colour and the field
      resynchronises to the last valid value on blur (research R-06); dragging past the `Area`'s or a
      slider's bounding rect clamps rather than erroring; `format` switching hex→rgb→hsl→hsb→hex
      round-trips the colour within ±1 per channel and does not itself fire `onValueChange` (SC-004,
      contract item 3); an alpha of `0` still renders the swatch's checkerboard (not blank);
      `disabled` and `readOnly` suppress pointer and keyboard on every part and are reflected as
      `data-disabled`/`data-readonly`/`aria-disabled`; each of the ten parts (`Trigger`, `Content`,
      `Area`, `HueSlider`, `AlphaSlider`, `Swatch`, `EyeDropper`, `FormatSelect`, `Input`,
      `InputField`) rendered outside `ColorPicker.Root` with
      `expect(() => render(Part)).toThrow(/must be used within/)`; `EyeDropper` renders nothing when
      `window.EyeDropper` is stubbed absent and renders + updates the colour (preserving alpha) when
      stubbed present; inside a `<form>` (via the T004 harness) a hidden input carries
      `rgbToHex(color)` under `name`, mirrors `required`/`disabled`/`readOnly` onto that element,
      stays in sync when the colour changes without the popover ever opening, and is absent outside a
      `<form>`.

**Checkpoint**: `color.test.ts` and `color-picker.test.ts` exist and fail (no implementation yet).

---

## Phase 3: Core component files

- [X] T010 Implement the pure colour-maths module `src/lib/components/ui/color-picker/color.ts`
      (`COLOR_FORMATS`, `ColorFormat`, `RgbaColor`, `HsvaColor`, `HslColor`, `hexToRgb`, `rgbToHex`,
      `rgbToHsv`, `hsvToRgb`, `rgbToHsl`, `hslToRgb`, `colorToString`, `parseColorString`,
      `clampChannel`, `isColorFormat`, `getInputFields`, `describeColor`) per data-model.md §1–§5 and
      the contract table, porting the numeric logic from
      `.reference/diceui/docs/registry/bases/radix/ui/color-picker.tsx` verbatim (do not import
      numeric conversions from `color-swatch` — its `color.ts` exports only background/checkerboard
      helpers, per spec.md Assumptions "Color conversion module"). Makes T003 pass.
- [X] T011 Implement `src/lib/components/ui/color-picker/color-picker.svelte.ts`: the
      `Symbol('color-picker')` context pair (`setColorPickerContext`/`getColorPickerContext`, the
      latter throwing `` `<ColorPicker.X>` must be used within `<ColorPicker.Root>`. `` when absent),
      `ColorPickerRootState` (constructor props, `#rgb`/`#hsv` state, all derived getters and
      mutators from data-model.md §6, guarding every mutator on `disabled`/`readOnly`),
      `ColorPickerAreaState` (data-model.md §7: `isDragging`, `backgroundColor`, `thumbLeft`/
      `thumbTop`, `updateFromPointer`, `onKeydown` implementing the R-04 key table with RTL
      inversion), and the `declare global { interface Window { EyeDropper?: … } }` augmentation from
      research R-07.
- [X] T012 [US1][US2][US3] Implement the root `src/lib/components/ui/color-picker/color-picker.svelte`
      (upstream `ColorPicker` + `ColorPickerImpl` collapsed per plan.md "Structure Decision"):
      `$bindable` `value`/`open`/`format`, `defaultValue="#000000"`/`defaultOpen=false`/
      `defaultFormat="hex"`, `onValueChange`/`onOpenChange`/`onFormatChange`, `modal`, `dir` resolved
      via `useDirection` from `direction-provider` (research R-10), `inline`, `name`, `disabled`,
      `readOnly`, `required`, constructs `ColorPickerRootState` and calls
      `setColorPickerContext(...)`, wraps children in `Popover.Root` when not `inline` (bare when
      `inline`, research R-08), renders the hidden `<input type="hidden" data-slot=
      "color-picker-form-input">` via `FormControlState` from `$lib/components/ui/checkbox-group/
      index.js` when inside a `<form>` (research R-09), and syncs an incoming controlled `value` with
      `parseColorString(value) ?? hexToRgb(value)` (research R-03). `data-slot="color-picker"`,
      `data-disabled`, `data-readonly`, `data-inline`.
- [X] T013 [P] [US1] Implement `src/lib/components/ui/color-picker/color-picker-trigger.svelte`
      (upstream `ColorPickerTrigger`): renders `Popover.Trigger` as a real
      `<button type="button">` styled with `buttonVariants` (research R-12), ORs `disabled` with the
      root, accepts `children` and a `child` snippet replacing `asChild`, forwards native button
      handlers via `...restProps`. `data-slot="color-picker-trigger"`, `data-disabled`;
      `data-state`/`aria-expanded` come from `Popover.Trigger`.
- [X] T014 [P] [US2] Implement `src/lib/components/ui/color-picker/color-picker-content.svelte`
      (upstream `ColorPickerContent`): renders `Popover.Content` (forwarding `side="bottom"`,
      `align="start"`, `sideOffset={4}`, `onOpenAutoFocus`, `onEscapeKeydown`, `onInteractOutside`,
      `portalProps`, `forceMount`, `child`, `children`) when not inline, or a plain `<div>` with the
      same `flex w-[340px] flex-col gap-4 p-4` classes when `inline` is set on the root (research
      R-08). `data-slot="color-picker-content"`, `data-inline`.
- [X] T015 [P] [US1] Implement `src/lib/components/ui/color-picker/color-picker-area.svelte`
      (upstream `ColorPickerArea`, with accessibility upstream lacks — research R-04): a `div` with
      `role="slider"`, `tabindex="0"` (`"-1"` when disabled), `aria-valuemin="0"`,
      `aria-valuemax="100"`, `aria-valuenow={saturation}`, `aria-valuetext={valueText}`,
      `aria-disabled`, `aria-orientation="horizontal"`; owns a `ColorPickerAreaState` instance;
      `onpointerdown`/`onpointermove`/`onpointerup` drive `updateFromPointer` with pointer capture
      (each accepts a consumer handler first, honouring `preventDefault()` to opt out);
      `onkeydown` calls `state.onKeydown(event)`; accepts `step` (`1`), `shiftStep` (`10`),
      `aria-label` (`"Saturation and brightness"`), `child`. Renders the hue-locked background layer
      from `state.backgroundColor` and a thumb positioned at `state.thumbLeft`/`state.thumbTop`.
      `data-slot="color-picker-area"`, `data-disabled`, `data-dragging`; thumb carries
      `data-slot="color-picker-area-thumb"`.
- [X] T016 [P] [US1] Implement `src/lib/components/ui/color-picker/color-picker-hue-slider.svelte`
      (upstream `ColorPickerHueSlider`): composes `bits-ui` `Slider.Root type="single"` with
      `Slider.Range` and, inside the root's children snippet, one `Slider.Thumb {index}` per entry of
      the snippet's `thumbItems`, `min={0}` `max={360}` `step={1}`, value bound to
      `root.hue`/`root.setHue`, `dir`/`disabled` from the root, full-spectrum hue gradient as the
      root's background, `aria-label` default `"Hue"`, thumb `aria-valuetext="{hue} degrees"`.
      `data-slot="color-picker-hue-slider"`, `data-disabled`; thumb `data-slot=
      "color-picker-hue-slider-thumb"`.
- [X] T017 [P] [US1] Implement `src/lib/components/ui/color-picker/color-picker-alpha-slider.svelte`
      (upstream `ColorPickerAlphaSlider`): composes `bits-ui` `Slider.Root type="single"` with
      `Slider.Range` and, inside the root's children snippet, one `Slider.Thumb {index}` per entry of
      the snippet's `thumbItems`, `min={0}` `max={100}` `step={1}`, value bound to
      `root.alphaPercent`/`root.setAlpha`, `dir`/`disabled` from the root, checkerboard-backed
      transparent→opaque gradient using the current colour as the root's background, `aria-label`
      default `"Alpha"`, thumb `aria-valuetext="{alphaPercent}%"`. `data-slot=
      "color-picker-alpha-slider"`, `data-disabled`; thumb `data-slot=
      "color-picker-alpha-slider-thumb"`.
- [X] T018 [P] [US1] Implement `src/lib/components/ui/color-picker/color-picker-swatch.svelte`
      (upstream `ColorPickerSwatch`): composes `ColorSwatch.Root` from
      `$lib/components/ui/color-swatch/index.js`, forwarding `size` (`'default'`), `withoutTransparency`
      (`false`), `child`; `role="img"`, `aria-label="Current color: {colorToString(rgb, format)}"` or
      `"No color selected"`. `data-slot="color-picker-swatch"` plus `ColorSwatch`'s `data-size`/
      `data-disabled`/`data-transparent`/`data-empty`.
- [X] T019 [P] [US1] Implement `src/lib/components/ui/color-picker/color-picker-eye-dropper.svelte`
      (upstream `ColorPickerEyeDropper`): `let supported = $state(false)` promoted in an `$effect`
      checking `window.EyeDropper` (research R-07, avoids SSR hydration mismatch), renders nothing
      when unsupported; otherwise a `Button` (`variant="outline"`, `size` `"icon"` when no
      `children` else `"default"`) defaulting to `<PipetteIcon />`, `disabled` ORed with the root,
      `aria-label="Pick a color from the screen"` when icon-only; on click calls
      `window.EyeDropper` and applies `hexToRgb(sRGBHex, root.alpha)` (alpha preserved), swallowing
      errors with `console.warn`. `data-slot="color-picker-eye-dropper"`, `data-disabled`.
- [X] T020 [P] [US1] Implement `src/lib/components/ui/color-picker/color-picker-format-select.svelte`
      (upstream `ColorPickerFormatSelect`): composes `Select.Root` → `Select.Trigger` →
      `Select.Content` → `Select.Group` → four `Select.Item`s (`HEX`, `RGB`, `HSL`, `HSB`), value
      bound to `root.format`/`root.setFormat`, `size` default `'sm'`, `disabled` ORed with the root,
      `class` forwarded to the trigger, `aria-label` default `"Color format"`. `data-slot=
      "color-picker-format-select"` and `"color-picker-format-select-trigger"`.
- [X] T021 [P] [US1] Implement `src/lib/components/ui/color-picker/color-picker-input-field.svelte`
      (upstream `InputGroupItem`, internal-but-exported): wraps `Input` with a `position` prop
      (`'first' | 'middle' | 'last' | 'isolated'`, default `'isolated'`) driving a `tv()`-declared
      `colorPickerInputVariants` export for the joined-border classes; owns the local `draft =
      $state<string>()` buffer from research R-06 (`oninput` writes the draft and attempts
      `root.commitField(channel, draft)`; `onblur` and any external colour change while unfocused
      reset the draft to the canonical value). `data-slot="color-picker-input"`,
      `data-channel="<r|g|b|h|s|l|v|a|hex>"`, `data-disabled`, `data-readonly`.
- [X] T022 [US1] Implement `src/lib/components/ui/color-picker/color-picker-input.svelte` (upstream
      `ColorPickerInput` + its four format-specific input components collapsed per plan.md
      "Structure Decision"): `withoutAlpha` prop (`false`), every `Input` prop except
      `value`/`oninput`/`color`; renders one `ColorPicker.InputField` per entry of
      `root.inputFields` (derived from `getInputFields({ format: root.format, rgb: root.rgb, hsv:
      root.hsv, withoutAlpha })`), wrapped in a `data-slot="color-picker-input-wrapper"`
      `<div class="flex items-center">` only when the field set has more than one entry; a
      single-entry set (`format="hex"` + `withoutAlpha`) renders the bare `position="isolated"`
      field with no wrapper, matching upstream's `HexInput` early return
      (`color-picker.tsx:1313-1326`); each field's `aria-label`/bounds/`position` taken directly from
      that derived array. Depends on T021.

**Checkpoint**: all ten parts plus the state module and colour maths exist; T003, T005–T009 can now
pass once wired through the barrel (Phase 4).

---

## Phase 4: Barrel and types

- [X] T023 Create `src/lib/components/ui/color-picker/index.ts` per
      `contracts/color-picker-api.md` § "Barrel": import all eleven parts (`Root`, `Trigger`,
      `Content`, `Area`, `HueSlider`, `AlphaSlider`, `Swatch`, `EyeDropper`, `FormatSelect`, `Input`,
      `InputField`), re-export every `*Props`/`*ChildProps` type, re-export
      `ColorPickerRootState`, `ColorPickerAreaState`, `getColorPickerContext`,
      `setColorPickerContext`, `ColorPickerRootStateProps` from `color-picker.svelte.js`, re-export
      every named export of `color.ts` (`COLOR_FORMATS`, `isColorFormat`, `clampChannel`,
      `hexToRgb`, `rgbToHex`, `rgbToHsv`, `hsvToRgb`, `rgbToHsl`, `hslToRgb`, `colorToString`,
      `parseColorString`, `getInputFields`, `describeColor`, and the `ColorFormat`/`RgbaColor`/
      `HsvaColor`/`HslColor`/`ColorPickerInputChannel`/`ColorPickerInputField` types), and export
      both the short names and the `ColorPicker*`-prefixed aliases. Run `pnpm run test:unit -- --run
      src/lib/components/ui/color-picker` afterward and fix any failing assertion from Phase 2/3
      before continuing.

**Checkpoint**: `color.test.ts` and `color-picker.test.ts` pass; the public API matches the contract.

---

## Phase 5: Demo route

- [X] T024 Create `src/routes/docs/components/color-picker/+page.svelte` with a page heading, intro
      paragraph, and exactly four `<ComponentPreview>` sections mirroring the upstream demos —
      Default (mirrors `color-picker-demo.tsx`: popover trigger + swatch, area, eyedropper, hue/alpha
      sliders, format select, input), Inline (mirrors `color-picker-inline-demo.tsx`: `inline` set,
      no trigger), Controlled (mirrors `color-picker-controlled-demo.tsx`: `bind:value` driven by
      page-local `$state`), Form (adapts `color-picker-form-demo.tsx` per spec.md Assumptions "Form
      demo adaptation": a native `<form>` with three pickers named `primaryColor`, `secondaryColor`,
      `accentColor`, seeded `#3b82f6`/`#10b981`/`#f59e0b`, a hex-pattern check on submit, and the
      submitted `FormData` rendered back to the page) — plus ten props tables, one per
      part in the Public API section of plan.md. Keep all demo state as page-local runes; add no
      `+page.ts`.

**Checkpoint**: SC-003 (all four upstream examples reproduced) is satisfied.

---

## Phase 6: Registry entry and docs polish

- [X] T025 Complete the `registry.json` entry for `color-picker` started in T002: fill `files` with
      all 14 non-test files (`index.ts`, `color.ts`, `color-picker.svelte.ts`, `color-picker.svelte`,
      `color-picker-trigger.svelte`, `color-picker-content.svelte`, `color-picker-area.svelte`,
      `color-picker-hue-slider.svelte`, `color-picker-alpha-slider.svelte`,
      `color-picker-swatch.svelte`, `color-picker-eye-dropper.svelte`,
      `color-picker-format-select.svelte`, `color-picker-input.svelte`,
      `color-picker-input-field.svelte`, each `{ "path": "src/lib/components/ui/color-picker/<file>",
      "type": "registry:ui" }`); confirm `registryDependencies` and `dependencies` from T002 are
      still accurate. Do not list `color-picker.test.ts`, `color-picker.test.svelte`, or
      `color.test.ts`.
- [X] T026 Run `pnpm run registry:build` and confirm `static/r/color-picker.json` is produced,
      contains all 14 files from T025, and has its `$lib/...` imports rewritten to registry
      placeholders (quickstart.md §4).

**Checkpoint**: registry item is installable via the shadcn-svelte CLI pointed at this repo.

---

## Phase 7: Verification

- [X] T027 Run `pnpm run format` across the new `src/lib/components/ui/color-picker/` and
      `src/routes/docs/components/color-picker/` files (shadcn/generator-style output is not
      Prettier-formatted) and leave the reformatted files in the working tree — the orchestrator owns
      git; do not run `git add` or `git commit` (constitution Principle X).
- [X] T028 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`,
      and fix everything that fails.

---

## Dependencies & Execution Order

- **Setup (T001–T002)**: no dependencies; run first.
- **Tests (T003–T009, +T008a)**: depend on Setup. T003 (`color.test.ts`) and T004 (test harness) are
  independent files and run in parallel `[P]`; T005–T009 (and T008a) all append to the same
  `color-picker.test.ts` file and therefore run strictly in sequence (T005 → T006 → T007 → T008 →
  T008a → T009), and each depends on the T004 harness for controlled/RTL/form render variants.
- **Core (T010–T022)**: T010 (`color.ts`) and T011 (`color-picker.svelte.ts`) are prerequisites for
  every part and must complete first, in that order (T011 imports nothing from T010 but both are
  needed before any `.svelte` part compiles against real types). T012 (Root) needs T011. T013–T021
  are independent files depending only on T011/T010 and run in parallel `[P]` with each other and
  with T012. T022 (Input) depends on T021 (InputField) and therefore is not `[P]`.
- **Barrel (T023)**: depends on every file in Setup/Core existing (T010–T022).
- **Demo (T024)**: depends on T023 (imports the barrel).
- **Registry (T025–T026)**: T025 depends on T023 (the file list is final only once the barrel
  exists); T026 depends on T025.
- **Verification (T027–T028)**: depends on everything above.
- **Story mapping**: US1 = T005, T006, T012-T022; US2 = T012 (inline branch), T014 (inline content),
  T024 (inline preview); US3 = T007, T012 (controlled props + hidden form input), T009 (form
  assertions), T024 (form preview).

## Parallel Example

```bash
# Phase 2 — independent test files:
Task: "Write pure colour-maths tests in src/lib/components/ui/color-picker/color.test.ts"
Task: "Create the Svelte test harness src/lib/components/ui/color-picker/color-picker.test.svelte"

# Phase 3 — independent part files, once T010/T011 are done:
Task: "Implement color-picker-trigger.svelte"
Task: "Implement color-picker-content.svelte"
Task: "Implement color-picker-area.svelte"
Task: "Implement color-picker-hue-slider.svelte"
Task: "Implement color-picker-alpha-slider.svelte"
Task: "Implement color-picker-swatch.svelte"
Task: "Implement color-picker-eye-dropper.svelte"
Task: "Implement color-picker-format-select.svelte"
Task: "Implement color-picker-input-field.svelte"
```

## Notes

- `color-swatch`'s `color.ts` is reused only for its `getColorBackgroundStyle`/background helpers
  through `ColorSwatch.Root` composition (T018) — the numeric hex/RGB/HSL/HSV conversions are a new
  module (T010) per spec.md Assumptions "Color conversion module", since `color-swatch` does not
  export them.
- The `Area`'s `role="slider"` + `aria-valuetext` keyboard model (T015) is the accessibility
  deliverable called out in the task-generation guidance — do not skip T005/T006/T008/T009 coverage
  of it.
- Do NOT run git write commands and do not touch `.reference/`, `.specify/`, `.claude/`, `scripts/`,
  `.port-state.json` or `.port-logs/` — the orchestrator owns the working tree and those paths.
- [P] tasks touch different files; sequential tasks either share a file or consume a prior task's
  output. Verify Phase 2 tests fail before starting Phase 3.

---

## Phase 8: Convergence

- [X] T029 Mirror the 2D area's visual layers under `dir="rtl"` in
      `src/lib/components/ui/color-picker/color-picker-area.svelte` so the crosshair tracks the
      pointer: the saturation gradient is emitted as `to right`/`to left` and the thumb is offset
      from `left`/`right` according to `root.dir`, matching the pointer-x inversion already in
      `ColorPickerAreaState.updateFromPointer` (`color-picker.svelte.ts:385`) and the horizontal
      arrow inversion in `onKeydown`. Today a pointer-down on the physical-left (white) edge of an
      rtl picker reports saturation `100` and paints the crosshair on the opposite edge. Extend the
      existing "mirrors the area's pointer mapping under rtl" case in `color-picker.test.ts` to
      assert the rendered crosshair offset, not only `aria-valuenow` — that assertion gap is why the
      defect survives a green suite. Per FR-016, SC-006 and spec.md Assumptions "RTL on the area"
      ("the crosshair tracks the pointer in a mirrored layout") (partial).
- [X] T030 Mirror the hue and alpha track gradients under `dir="rtl"` in
      `src/lib/components/ui/color-picker/color-picker-hue-slider.svelte` and
      `color-picker-alpha-slider.svelte`. bits-ui offsets a horizontal thumb from `right` when
      `dir="rtl"` (`bits-ui/dist/bits/slider/helpers.js:31`), while both tracks paint an
      unconditional `to right` gradient, so the colour under the thumb contradicts its value — an
      rtl alpha thumb at `0` sits over the fully opaque end of the ramp, and an rtl hue thumb at
      `120` sits over magenta. Derive the gradient direction from `root.dir` and add an rtl
      assertion for both tracks to `color-picker.test.ts`. Per FR-007, FR-008 and SC-006 (partial).
- [X] T031 Emit `data-readonly={root.readOnly ? '' : undefined}` on every part that inherits the
      root's `readOnly` — `color-picker-hue-slider.svelte`, `color-picker-alpha-slider.svelte`,
      `color-picker-eye-dropper.svelte`, `color-picker-format-select.svelte`,
      `color-picker-trigger.svelte` and `color-picker-swatch.svelte` — and add the attribute to each
      part's `*ChildProps` payload type where one exists. Only Root, Area and InputField expose it
      today, so a consumer cannot write a `data-readonly:` selector against the sliders or the
      eyedropper even though their mutations are already suppressed. Per FR-015 ("All interactive
      parts … reflected via `data-readonly`") and contracts/color-picker-api.md behavioural item 9
      (partial).
- [X] T032 Extend the `disabled and readOnly` block of
      `src/lib/components/ui/color-picker/color-picker.test.ts` to cover every part, not just Root,
      Area, the hex field and FormatSelect: assert that under `readOnly` a keyboard interaction on
      the hue thumb and on the alpha thumb leaves `aria-valuenow` and `onValueChange` untouched while
      both thumbs stay focusable, and that an eyedropper pick is swallowed; assert that under
      `disabled` the alpha slider and the eyedropper button are disabled and the swatch carries
      `data-disabled`. Per FR-015 and plan.md "Test plan" item 6 ("`disabled` and `readOnly` suppress
      pointer and keyboard on every part") (missing).
- [X] T033 Add `modal` coverage to `src/lib/components/ui/color-picker/color-picker.test.ts`: with
      `modal` set the open content receives `trapFocus`/`preventScroll` and outside interaction is
      blocked, and with the `false` default it does not. The flag is plumbed through
      `color-picker-content.svelte:38-39` and the T004 harness already accepts it
      (`color-picker.test.svelte:42`), but no assertion exercises it. Per FR-002 (missing).
- [X] T034 Document and cover the `getColorPickerContext` accessor that replaces upstream's
      `useColorPicker` selector hook: add an API Reference entry to
      `src/routes/docs/components/color-picker/+page.svelte` showing a consumer reading `rgb`, `hsv`,
      `hue`, `alpha`, `format` and `open` off the returned `ColorPickerRootState`, and add a test in
      `color-picker.test.ts` that mounts a custom part inside `<ColorPicker.Root>`, reads state
      through the accessor and re-renders when the colour moves. FR-020 requires "a single documented
      accessor"; it is exported from the barrel but named nowhere on the demo page and asserted only
      through its throwing path. Per FR-020 and Constitution IX (partial).
