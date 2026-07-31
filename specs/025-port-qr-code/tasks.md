---
description: 'Task list for the QR Code port'
---

# Tasks: QR Code

**Input**: Design documents from `/specs/025-port-qr-code/` (plan.md, spec.md, research.md,
data-model.md, contracts/qr-code.api.md, quickstart.md)

**Tests**: MANDATORY (constitution Principle III / VII). Every behavioural area below is a
required, non-skippable test task — no `.skip`/`.todo`, no suppressions.

**Organization**: Phases run in the fixed order requested for this feature — Setup (dependencies,
registry stub) → Tests → Core component files → Barrel and types → Demo route → Registry entry and
docs polish → Verification. Within that order, `[US1]`–`[US4]` tags trace each task back to its
spec.md user story for independent-test purposes; they do not change the phase sequence.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency)
- **[Story]**: Traces the task to spec.md's US1 (display a scannable code), US2 (renderer choice),
  US3 (customization), or US4 (overlay + download)
- Every task names its exact file path(s)

---

## Phase 1: Setup

**Purpose**: Add the one new dependency, scaffold the component folder (the "registry stub"), and
land the rune-free state module so the test phase can compile real types against it before any
`.svelte` part exists.

- [X] T001 Run `pnpm add qrcode@^1.5.4` and `pnpm add -D @types/qrcode@^1.5.6` from the repo root
      (non-interactive; matches `.reference/diceui/docs/package.json` lines 57/76 per research
      R-01), then create the `src/lib/components/ui/qr-code/` directory scaffold. No
      `shadcn-svelte add` is run — nothing else is installed.
- [X] T002 Implement `src/lib/components/ui/qr-code/qr-code.svelte.ts` per data-model.md: the
      `QR_CODE_LEVELS`/`QRCodeLevel` and `QR_CODE_FORMATS`/`QRCodeFormat` tuples; the
      `QRCodeGenerateOptions` type; the nine `DEFAULT_*` constants; the four pure helpers
      (`buildQRCodeOptions`, `buildGenerationKey`, `getQRCodeLabel`, `resolveDownload`); the
      `QRCodeState` class (getter-based `QRCodeStateProps`, `$state` fields `dataUrl`, `svgString`,
      `isGenerating`, `error`, `generationKey`, `canvasElement`, `pendingKey`, `$derived` fields
      including `options`, `generationTarget`, `isLoaded`, `label`, and the `generate()`/`download()`
      methods per the state-transition table — on failure, `generate()` clears `dataUrl`/`svgString`
      and also clears the registered canvas via `canvasElement?.getContext('2d')?.clearRect(...)` so
      no renderer keeps showing the previous value; when a new target is requested while a
      generation is already in flight, `generate()` records it in `pendingKey` and re-enters once
      the in-flight attempt settles, so an input change made mid-encode is never silently dropped);
      and the Symbol-keyed context trio
      `setQRCodeContext`/`hasQRCodeContext`/`getQRCodeContext(consumerName?)` whose getter throws
      `` `${consumerName ?? '`<QRCode>` part'} must be used within \`<QRCode.Root>\`.` ``. Depends
      on: T001.
- [X] T003 [P] Create the test harness `src/lib/components/ui/qr-code/qr-code.test.svelte`
      (snippet plumbing to compose `Root` with whichever parts a test case needs, following the
      pattern in `src/lib/components/ui/circular-progress/circular-progress.test.svelte` and
      `src/lib/components/ui/direction-provider/direction-provider.test.svelte`), importing from
      `./index.js` — this will not compile until Phase 4 lands, which is expected. Depends on:
      T001.

**Checkpoint**: state module and test harness exist; the test phase can now write assertions
against real types even though the `.svelte` parts don't exist yet.

---

## Phase 2: Tests (write first — MUST fail before Phase 3–4 implementation)

**Purpose**: One test task per requested behavioural area (accessibility roles and names, keyboard
interaction, controlled-vs-uncontrolled, RTL, edge cases), each also covering the adjacent areas
from plan.md's Test Plan table that belong with it (rendering & structure, every prop, lifecycle &
callbacks, guard rails). All tasks write into
`src/lib/components/ui/qr-code/qr-code.test.ts`, mocking the `qrcode` module per research R-08
(`vi.mock('qrcode', …)` supplying `toDataURL`/`toCanvas`/`toString` spies), so none are `[P]`.

- [X] T004 [US1] Accessibility roles-and-names tests (plus rendering & structure) in
      `src/lib/components/ui/qr-code/qr-code.test.ts`: root renders `data-slot="qr-code"` with
      `--qr-code-size` in its `style`; each of the seven parts renders its documented element and
      `data-slot`; canvas and svg expose `role="img"` with accessible name
      `` `QR code for ${value}` `` by default, overridable via a caller `aria-label`; image exposes
      `alt="QR Code"` by default and a custom `alt` when given; download button has an accessible
      name defaulting to `Download PNG`/`Download SVG` per `format`; `class` merges last on all
      seven parts; `ref` binds on all seven parts; the `child` snippet renders in place of the
      default element on all seven parts, and the replacement element still carries the part's
      `data-slot`, computed ARIA/size attributes and handlers (FR-016; mirroring the
      `qr-code-formats-demo` `asChild` + `Button` composition); canvas, svg and image parts combine
      freely inside one root, each rendering independently (spec edge case 6); the root's
      `data-state` is `idle` before generation starts, `ready` after a successful generation and
      `error` after a failed one (contracts/qr-code.api.md divergence 7). Depends on: T002, T003.
- [X] T005 [US1] Keyboard interaction tests (via `@testing-library/user-event`, not `fireEvent`) in
      `src/lib/components/ui/qr-code/qr-code.test.ts`: `Tab` reaches the download button and shows
      a visible focus indicator; `Enter` triggers the download; `Space` triggers the download
      (FR-006, FR-012, MDX keyboard table); a caller-supplied `onclick` runs before the built-in
      handling and calling `event.preventDefault()` inside it suppresses the download entirely.
      Depends on: T002, T003.
- [X] T006 [US1] Reactivity and idempotence tests (the controlled/uncontrolled slot per research
      R-09 — this component owns no `$bindable` value state) in
      `src/lib/components/ui/qr-code/qr-code.test.ts`: changing `value` regenerates the code and
      re-invokes `onGenerated`; changing each customization prop (`size`, `level`, `margin`,
      `quality`, `foregroundColor`, `backgroundColor`) individually regenerates (FR-007); every one
      of those props is asserted on the encoder-options object the `qrcode` mock receives, via
      `buildQRCodeOptions` (`errorCorrectionLevel`, `type: 'image/png'`, `quality`, `margin`,
      `color: { dark, light }`, `width`); re-rendering with an identical seven-tuple of inputs does
      **not** call the mocked encoder a second time (FR-007, spec edge case 7); `Skeleton` is
      visible before generation completes and hides once any output exists (FR-004); `Svg`/`Image`
      render nothing before their own output exists; `onGenerated` fires exactly once per successful
      generation; the canvas carries the `invisible` class before the first generation completes and
      drops it once `generationKey` is set (US2 acceptance scenario 4); changing `value` a second
      time while the first encode is still pending ends with the second value's code — the encoder
      is called for both keys and the final `generationKey` is the second key, never the first
      (FR-007 in-flight race). Depends on: T002, T003.
- [X] T007 [US4] RTL tests in `src/lib/components/ui/qr-code/qr-code.test.ts`: inside
      `<div dir="rtl">`, the root keeps its `flex-col items-center` layout classes, the `Overlay`
      keeps its `top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` centring classes, and the
      `Download` button remains keyboard-reachable and activatable with `Enter`/`Space` (FR-013,
      research R-10). Depends on: T002, T003.
- [X] T008 [US3] Edge-case tests — guard rails, errors, and out-of-provider throws — in
      `src/lib/components/ui/qr-code/qr-code.test.ts`: an empty `value` never calls the mocked
      encoder and throws nothing (FR-009); a rejected/thrown `toCanvas`/`toString` call fires
      `onError` with the thrown `Error`, and a non-`Error` throw is normalised to
      `'Failed to generate QR code'`; a failed generation clears any previously set `dataUrl`/
      `svgString` rather than leaving a stale code on screen (FR-008, research R-11), and the
      registered canvas is erased as well — with `HTMLCanvasElement.prototype.getContext` stubbed to
      a `{ clearRect: vi.fn() }` context for the case, `clearRect` is called with
      `(0, 0, size, size)`; a `toDataURL`
      failure alone is non-fatal — it only suppresses `Image`/PNG-download output while `Svg` still
      renders; a `Download` click with no output for the requested `format` is a no-op — no anchor
      is created or clicked (FR-006, spec edge case 5); each of the seven parts
      (`Canvas`/`Svg`/`Image`/`Overlay`/`Skeleton`/`Download`, and separately rendering `Canvas`
      alongside a `Root` from a different instance) throws
      `` /must be used within `<QRCode.Root>`\./ `` when rendered outside `<QRCode.Root>` (FR-010).
      Depends on: T002, T003.

**Checkpoint**: all five test tasks exist and fail (no `qr-code.svelte`/parts to import yet from a
complete barrel). This is the expected, required state before Phase 3.

---

## Phase 3: Core component files

**Purpose**: One task per exported subcomponent (7), in the dependency order plan.md's
Implementation Schedule lays out — `Root` first (it constructs and publishes `QRCodeState` and
drives the generation `$effect`), then every other part, which only need to read that context and
are therefore mutually independent.

- [X] T009 [US1] Implement `src/lib/components/ui/qr-code/qr-code.svelte` (Root): props + JSDoc per
      contracts/qr-code.api.md's `Root` table (`value`, `size`, `level`, `margin`, `quality`,
      `backgroundColor`, `foregroundColor`, `onError`, `onGenerated`, `style`, `class`,
      `ref = $bindable(null)`); constructs `QRCodeState` from getter functions over those props and
      publishes it via `setQRCodeContext`; renders `<div data-slot="qr-code" data-state=…>` with
      `style="--qr-code-size: {size}px; {style ?? ''}"` and default class
      `relative flex flex-col items-center gap-2`; the generation `$effect` per research R-03
      (`requestAnimationFrame(() => void state.generate(key))` gated on `state.generationTarget`,
      with `cancelAnimationFrame` teardown); `data-state` reflects
      `idle`/`generating`/`ready`/`error` from `QRCodeState`; `child` snippet branch. Depends on:
      T002.
- [X] T010 [P] [US2] Implement `src/lib/components/ui/qr-code/qr-code-canvas.svelte` (Canvas):
      reads `getQRCodeContext('<QRCode.Canvas>')`; `role="img"`, default
      `` aria-label={`QR code for ${state.value}`} `` overridable through `restProps`;
      `width`/`height` = root `size`; default class
      `relative max-h-(--qr-code-size) max-w-(--qr-code-size)` plus `invisible` while
      `state.generationKey` is empty; registers its element on `QRCodeState.canvasElement` via
      `bind:this` + an `$effect` and unregisters on teardown; `children` (canvas fallback content),
      `child`; `ref`/`class`/`child` props carry a one-line JSDoc comment each. Depends on: T009.
- [X] T011 [P] [US2] Implement `src/lib/components/ui/qr-code/qr-code-svg.svelte` (Svg): reads
      `getQRCodeContext('<QRCode.Svg>')`; renders nothing until `state.svgString` is non-null;
      `role="img"`, default `` aria-label={`QR code for ${state.value}`} ``; inline
      `width`/`height` = root `size` emitted before the caller's `style`; default class
      `relative max-h-(--qr-code-size) max-w-(--qr-code-size)`; content is
      `{@html state.svgString}`; `child` only (no `children`, per contracts/qr-code.api.md);
      `ref`/`class`/`child` props carry a one-line JSDoc comment each. Depends on: T009.
- [X] T012 [P] [US2] Implement `src/lib/components/ui/qr-code/qr-code-image.svelte` (Image): reads
      `getQRCodeContext('<QRCode.Image>')`; renders nothing until `state.dataUrl` is non-null;
      `src={state.dataUrl}`, `alt` default `'QR Code'`, `width`/`height` = root `size`; default
      class `relative max-h-(--qr-code-size) max-w-(--qr-code-size)`; `child`; `alt` and the
      `ref`/`class`/`child` props carry JSDoc (including `@default`) copied from
      `.reference/diceui/docs/types/radix/qr-code.ts`. Depends on: T009.
- [X] T013 [P] [US2] Implement `src/lib/components/ui/qr-code/qr-code-skeleton.svelte` (Skeleton):
      reads `getQRCodeContext('<QRCode.Skeleton>')`; renders nothing once `state.isLoaded` is true
      (FR-004); inline `width`/`height` = root `size`; default class
      `absolute max-h-(--qr-code-size) max-w-(--qr-code-size) animate-pulse bg-accent`; `children`,
      `child`; `style`/`ref`/`class`/`child` props carry a one-line JSDoc comment each. Depends on:
      T009.
- [X] T014 [P] [US4] Implement `src/lib/components/ui/qr-code/qr-code-overlay.svelte` (Overlay):
      calls `getQRCodeContext('<QRCode.Overlay>')` purely for the guard (FR-010) — reads no other
      state; default class
      `absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm bg-background`;
      `children`, `child`; `ref`/`class`/`child` props carry a one-line JSDoc comment each. Depends
      on: T009.
- [X] T015 [P] [US4] Implement `src/lib/components/ui/qr-code/qr-code-download.svelte` (Download):
      native `<button type="button">`; reads `getQRCodeContext('<QRCode.Download>')`; `filename`
      default `'qrcode'`, `format` default `'png'`; `children` defaults to
      `` `Download ${format.toUpperCase()}` ``; on click, the caller's `onclick` runs first — if it
      calls `preventDefault()` the built-in download is skipped, otherwise
      `state.download(filename, format)` runs, which is a no-op via `resolveDownload()` returning
      `null` when the requested format has no output yet (FR-006); default class
      `max-w-(--qr-code-size)` plus the repo's `focus-visible:ring-[3px] focus-visible:ring-ring/50
      focus-visible:border-ring outline-none` tokens (research R-06, FR-012); `Enter`/`Space` work
      for free via the native `<button>`; `child`; `filename` and `format` carry JSDoc (including
      `@default`) copied from `.reference/diceui/docs/types/radix/qr-code.ts`. Depends on: T009.

**Checkpoint**: all seven part files exist and compile against the state module; Phase 2's test
tasks can now import real components (still through the not-yet-existing barrel — Phase 4 wires
that).

---

## Phase 4: Barrel and types

- [X] T016 Create `src/lib/components/ui/qr-code/index.ts`: import all seven `.svelte` files
      (`Root`, `Canvas`, `Svg`, `Image`, `Overlay`, `Skeleton`, `Download`); re-export short names,
      prefixed aliases (`QRCode`, `QRCodeCanvas`, `QRCodeSvg`, `QRCodeImage`, `QRCodeOverlay`,
      `QRCodeSkeleton`, `QRCodeDownload`), and every `export type`
      (`QRCodeRootProps`/`QRCodeChildProps`, `QRCodeCanvasProps`/`QRCodeCanvasChildProps`,
      `QRCodeSvgProps`/`QRCodeSvgChildProps`, `QRCodeImageProps`/`QRCodeImageChildProps`,
      `QRCodeOverlayProps`/`QRCodeOverlayChildProps`,
      `QRCodeSkeletonProps`/`QRCodeSkeletonChildProps`,
      `QRCodeDownloadProps`/`QRCodeDownloadChildProps`); re-export the reuse surface from
      `qr-code.svelte.ts` per contracts/qr-code.api.md's "Module exports" table (`QRCodeState`,
      `type QRCodeStateProps`, `setQRCodeContext`/`hasQRCodeContext`/`getQRCodeContext`,
      `QR_CODE_LEVELS`/`type QRCodeLevel`, `QR_CODE_FORMATS`/`type QRCodeFormat`,
      `type QRCodeGenerateOptions`, the four pure helpers, and the nine `DEFAULT_*` constants).
      Depends on: T009–T015.

**Checkpoint**: `import * as QRCode from '$lib/components/ui/qr-code/index.js'` resolves; run
`pnpm run test:unit -- --run src/lib/components/ui/qr-code/qr-code.test.ts` — all Phase 2 tasks
must now pass.

---

## Phase 5: Demo route

One `<ComponentPreview>` section per upstream `qr-code-*-demo.tsx`, plus the Playground and API
Reference sections the plan calls for, all in the same file
(`src/routes/docs/components/qr-code/+page.svelte`), so none of these are `[P]`.

- [X] T017 [US1] Scaffold `src/routes/docs/components/qr-code/+page.svelte` (heading, intro
      paragraph, `<svelte:head><title>QR Code — svelte-dice-ui</title></svelte:head>`) and add the
      **Default** `<ComponentPreview>` section mirroring `qr-code-demo.tsx`:
      `<QRCode.Root value="https://diceui.com" size={200}>` with `<QRCode.Skeleton />` and
      `<QRCode.Canvas />`. Depends on: T016.
- [X] T018 [US2] Add the **Different Formats** `<ComponentPreview>` section to
      `src/routes/docs/components/qr-code/+page.svelte`, mirroring `qr-code-formats-demo.tsx`:
      three 120px codes — `Canvas`, `Svg`, `Image` — each paired with a `Download` rendered through
      the `child` snippet as `<Button size="sm">`, reproducing upstream's `asChild` usage. Depends
      on: T017.
- [X] T019 [US3] Add the **Customization** `<ComponentPreview>` section to
      `src/routes/docs/components/qr-code/+page.svelte`, mirroring `qr-code-customization-demo.tsx`:
      a 150px custom-colour code and a `level="H"` code, both with `Skeleton`. Depends on: T017.
- [X] T020 [US4] Add the **Overlay** `<ComponentPreview>` section to
      `src/routes/docs/components/qr-code/+page.svelte`, mirroring `qr-code-overlay-demo.tsx`:
      three `level="H"` codes (canvas/svg/image), each with an `Overlay` holding a `Dice4` icon from
      `@lucide/svelte`. Depends on: T017.
- [X] T021 Add the **Playground** section (Svelte-specific — rune-held `value`/`size`/`level` bound
      to inputs driving a live `QRCode.Root`, proving FR-007 reactivity and the empty-value guard
      live) and the **API Reference** section (a props table per part per contracts/qr-code.api.md,
      the `--qr-code-size` CSS-variable row, the `Enter`/`Space` keyboard table, and the
      error-correction-level table from data-model.md) to
      `src/routes/docs/components/qr-code/+page.svelte`, and an **Installation** note stating that
      the component requires `qrcode` at runtime (declared in the registry entry) plus
      `@types/qrcode` as a dev dependency for TypeScript consumers, which the shadcn-svelte
      registry-item schema cannot express. Depends on: T020.

**Checkpoint**: `pnpm run build` succeeds including `/docs/components/qr-code`.

---

## Phase 6: Registry entry and docs polish

- [X] T022 Append exactly one entry to `registry.json` at the repository root: `"name": "qr-code"`,
      `"type": "registry:ui"`, `"title": "QR Code"`, `"description"` copied verbatim from upstream's
      MDX front matter, no `"registryDependencies"` (the component imports only `$lib/utils.js` and
      its own files), `"dependencies": ["qrcode"]`, and a `"files"` array listing all nine files
      under `src/lib/components/ui/qr-code/` **except** `qr-code.test.ts` and `qr-code.test.svelte`
      (the seven `.svelte` parts, `qr-code.svelte.ts`, `index.ts`, each `"type": "registry:ui"`).
      Then run `pnpm run registry:build` and confirm `static/r/qr-code.json` is produced with
      `"dependencies": ["qrcode"]` and all nine files listed (quickstart.md "Registry"). Depends on:
      T016, T021.

**Checkpoint**: `pnpm run registry:build` succeeds with no cross-component import missing its
`registryDependency`.

---

## Phase 7: Verification (MANDATORY — Principle VII)

- [X] T023 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and
      `pnpm run build`, and fix everything that fails. Depends on: T001–T022. Run
      `pnpm run format` first if any file is not yet Prettier-formatted (shadcn/CLI-shaped output
      commonly isn't). No `@ts-ignore`/`@ts-expect-error`/`eslint-disable`/`svelte-ignore`/`as any`/
      `.skip`/`.todo`/deleted assertions/loosened configs may be used to reach green — fix the root
      cause.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Tests (Phase 2)**: depends on T002 (state module) and T003 (harness) from Setup; all five
  tasks write into `qr-code.test.ts`, so they run sequentially, not in parallel, and are expected
  to fail until Phase 3–4 land.
- **Core component files (Phase 3)**: T009 (Root) depends on T002; T010–T015 (the other six parts)
  each depend on T009 and are mutually `[P]` — six different leaf files, no interdependency among
  them.
- **Barrel and types (Phase 4)**: T016 depends on all of Phase 3 (T009–T015).
- **Demo route (Phase 5)**: T017 depends on T016; T018/T019/T020 depend on T017 (same file,
  appended sections, so sequential); T021 depends on T020.
- **Registry entry and docs polish (Phase 6)**: T022 depends on T016 (file list) and T021 (demo
  route must be complete for the docs index to link correctly).
- **Verification (Phase 7)**: T023 depends on everything — the last phase, always run.

### User Story Coverage

- **US1** (display a scannable code — P1): T004–T006, T009, T017.
- **US2** (renderer choice — P1): T004, T006, T010–T013, T018.
- **US3** (customization — P2): T006, T008, T019.
- **US4** (overlay + download — P3): T004, T005, T007, T014, T015, T020.

Each story's flows are independently exercisable once Phase 4 (barrel) is done — US1 needs only
`Root` + one renderer, US2's renderers are freely combinable, US3's customization props apply
regardless of overlay/download, and US4's overlay/download are additive to a working code.

### Parallel Opportunities

- T001 and T003 both only need the directory scaffold from T001 to exist; T003 can start as soon
  as T001 completes, in parallel with T002.
- Within Phase 3, T010 (Canvas), T011 (Svg), T012 (Image), T013 (Skeleton), T014 (Overlay), T015
  (Download) can all run in parallel once T009 (Root) is done — six different files, no shared
  state beyond the already-published context.
- No two Phase 2 tasks are parallel (same file `qr-code.test.ts`); no two Phase 5 tasks are
  parallel (same file `+page.svelte`).

---

## Parallel Example: Phase 3 leaf parts

```bash
# Once T009 (Root) is done, launch together:
Task: "Implement qr-code-canvas.svelte (Canvas)"      # T010
Task: "Implement qr-code-svg.svelte (Svg)"            # T011
Task: "Implement qr-code-image.svelte (Image)"        # T012
Task: "Implement qr-code-skeleton.svelte (Skeleton)"  # T013
Task: "Implement qr-code-overlay.svelte (Overlay)"    # T014
Task: "Implement qr-code-download.svelte (Download)"  # T015
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup).
2. Complete the US1-relevant slice of Phase 2 (T004–T006).
3. Complete T009 (Root) and T010 (Canvas) from Phase 3 — in practice it is simpler to build all
   seven parts together since every part after Root reads the same published context.
4. Complete Phase 4 (barrel) — Phase 2's US1 tests should now pass.
5. **STOP and VALIDATE**: run
   `pnpm run test:unit -- --run src/lib/components/ui/qr-code/qr-code.test.ts` and confirm the US1
   assertions are green.

### Incremental Delivery

1. Setup + state module → Tests written (red) → all seven parts + barrel → Tests green (US1–US4
   all land together in practice, since Phase 3 builds every part in one dependency chain off
   Root).
2. Demo route → Registry entry → Verification.
3. Each phase leaves the previous phase's output intact — no phase invalidates an earlier one.

---

## Notes

- `[P]` tasks touch different files with no unmet dependency; tasks that write into the same file
  (`qr-code.test.ts`, `+page.svelte`) are never `[P]`.
- `[Story]` traces a task to spec.md's US1–US4 for independent-test purposes only; it does not
  reorder the fixed phase sequence requested for this feature.
- Do NOT run git write commands — the orchestrator owns the working tree (Principle X).
- Do NOT touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json` or
  `.port-logs/`.
- Use the same `qrcode` npm package upstream uses via the same dynamic `import('qrcode')` inside
  `QRCodeState.generate()` — never a static top-level import, and never a substitute or hand-rolled
  encoder (FR-001, research R-01).
- `qr-code.test.ts` mocks `qrcode` at the module boundary (`vi.mock`) because jsdom has no 2D
  canvas context (research R-08) — encoder correctness itself is not re-tested here.

---

## Phase 8: Convergence

**Purpose**: Close the gaps found by `/speckit-converge` between the implemented port and spec.md /
plan.md / contracts. Appended after Phase 7; the tasks above are unchanged.

- [X] T024 CRITICAL Make the `child` escape hatch keep `<QRCode.Canvas>` functional in
      `src/lib/components/ui/qr-code/qr-code-canvas.svelte`: the canvas is registered on
      `QRCodeState.canvasElement` from an `$effect` keyed on `ref`, and `ref` is only bound on the
      default `<canvas>` branch — so in `child` mode nothing is registered, `QRCodeState.generate()`
      skips `QRCode.toCanvas()` entirely, and the consumer's element never shows a code. Upstream
      composes the ref through `Slot` (`qr-code.tsx:305`), so `asChild` keeps drawing. Move the
      registration onto a `createAttachmentKey()` entry inside the `canvasAttrs` object (add the
      symbol key to `QRCodeCanvasChildProps`), following the identical fix already shipped in
      `src/lib/components/ui/scroller/scroller.svelte` (`ATTACHMENT` / `registerElement`), so the
      element is registered wherever the attributes land and unregistered on teardown. per FR-016 /
      Constitution II (partial)
- [X] T025 CRITICAL Make the `child` escape hatch keep `<QRCode.Svg>` functional in
      `src/lib/components/ui/qr-code/qr-code-svg.svelte`: the generated markup is adopted into `ref`
      by an `$effect`, and `ref` is `null` in `child` mode, so the replacement element renders
      `role="img"` and `aria-label` over empty content — no QR code at all. Upstream forwards
      `dangerouslySetInnerHTML` through `Slot` (`qr-code.tsx:348`), so `asChild` keeps the markup.
      Move the parse-and-adopt logic onto a `createAttachmentKey()` entry inside the `svgAttrs`
      object (add the symbol key to `QRCodeSvgChildProps`), same pattern as T024, keeping the
      existing `DOMParser` + `parsererror` guard and the `replaceChildren()` teardown. per FR-016 /
      Constitution II (partial)
- [X] T026 Add `child`-mode functional assertions to
      `src/lib/components/ui/qr-code/qr-code.test.ts` (and whatever harness props they need in
      `qr-code.test.svelte`): render `<QRCode.Canvas>` through `child` onto a real `<canvas>` element
      and assert the mocked `toCanvas` is called with **that** element; render `<QRCode.Svg>` through
      `child` and assert the replacement element ends up containing the generated `<svg>` node. The
      current child-mode case (`qr-code.test.ts:306-359`) renders both onto a `<span>` and asserts
      attributes only, which is why T024/T025 pass the suite today. per FR-016 / SC-004 (missing)
- [X] T027 Assert the root's fourth documented `data-state` value in
      `src/lib/components/ui/qr-code/qr-code.test.ts`: with `toString` held on a deferred promise (the
      technique already used by the in-flight race case at `:557-584`), assert
      `[data-slot="qr-code"]` carries `data-state="generating"` while the encode is in flight, then
      `ready` once it resolves. Only `idle`, `ready` and `error` are asserted today. per SC-004 /
      contracts divergence 7 (partial)
- [X] T028 Extend the RTL case in `src/lib/components/ui/qr-code/qr-code.test.ts` to cover the
      loading placeholder that FR-013 names explicitly: inside `<div dir="rtl">`, before generation
      completes, assert `<QRCode.Skeleton>` is rendered and keeps its
      `absolute max-h-(--qr-code-size) max-w-(--qr-code-size)` centring classes and its computed
      `width`/`height`. The existing case awaits `ready` first, so the skeleton is already gone and
      is never checked under RTL. per FR-013 / SC-005 (partial)
