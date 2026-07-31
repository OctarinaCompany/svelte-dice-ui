# Phase 0 Research — Port QR Code

**Feature**: `025-port-qr-code` | **Date**: 2026-07-31

Upstream read at the pinned commit `d9763d82530416dfa4c81c462387b55d06bae4ec`:

- `.reference/diceui/docs/registry/bases/radix/ui/qr-code.tsx` (512 lines — the whole component)
- `.reference/diceui/docs/types/radix/qr-code.ts` (the documented prop contract + JSDoc)
- `.reference/diceui/docs/content/docs/components/radix/qr-code.mdx` (API reference, keyboard table,
  CSS-variable table, usage notes)
- `.reference/diceui/docs/registry/bases/radix/examples/qr-code-{demo,formats-demo,customization-demo,overlay-demo}.tsx`
- `.reference/diceui/docs/registry/bases/radix/ui/_registry.ts` (lines 731–743 — dependency metadata)

There is **no upstream test file** for `qr-code` (`find .reference/diceui -iname "*qr*"` returns only
the sources, MDX, types, demos and the built registry JSON). The assertion floor therefore comes from
the MDX accessibility table and the spec's FR list rather than from a ported test file.

All `NEEDS CLARIFICATION` items are resolved below; none remain.

---

## R-01 — QR encoding library

**Decision**: add `qrcode@^1.5.4` as a runtime dependency and `@types/qrcode@^1.5.6` as a dev
dependency, matching `.reference/diceui/docs/package.json` (lines 57 and 76) exactly. Import it the
same way upstream does — `const QRCode = (await import('qrcode')).default` — inside the generation
routine, never at module scope.

**Rationale**: FR-001 and the task brief both forbid substituting a different encoder or hand-rolling
one. `_registry.ts:734-735` lists `dependencies: ["radix-ui", "qrcode"]` and
`devDependencies: ["@types/qrcode"]`; `radix-ui` is replaced by this repo's Bits UI / `child`-snippet
conventions, so `qrcode` is the only npm package that carries over. The dynamic import is what keeps
the component SSR-safe (MDX "Usage Notes": _"The component uses dynamic imports to avoid SSR issues
with the QR code library"_) — `qrcode` reaches for `Canvas`/`Buffer` at import time in some code paths.

**Alternatives considered**: `qr-code-styling`, `@svelte-put/qr`, and a hand-written encoder — all
rejected outright by FR-001. Static `import QRCode from 'qrcode'` — rejected: it defeats the
SSR-safety property and would pull the encoder into the server bundle of every route that renders
the component.

**Consequence for `registry.json`**: `"dependencies": ["qrcode"]`. The shadcn-svelte registry-item
schema used by `pnpm run registry:build` has no `devDependencies` key (no existing entry in
`registry.json` uses one, and none is present in the installed `shadcn-svelte@1.4.2` schema), so
`@types/qrcode` is installed locally and called out in the demo page's install note rather than
encoded in the registry entry.

---

## R-02 — Upstream's `Store` / `useSyncExternalStore` → a single rune state class

**Decision**: delete the store abstraction. `qr-code.svelte.ts` holds one `QRCodeState` class whose
`dataUrl`, `svgString`, `isGenerating`, `error` and `generationKey` are plain `$state` fields, shared
through one Symbol context key.

**Rationale**: upstream's `Store` (`qr-code.tsx:32-72,116-158`) exists solely so that `QRCodeSvg` can
re-render on `svgString` without `QRCodeCanvas` re-rendering on `dataUrl` — a React-only
render-granularity problem. Svelte 5's signals already give per-field granularity: a part that reads
`state.svgString` is invalidated by `svgString` and by nothing else. Porting `subscribe`/`notify`
would add ~60 lines that buy nothing and would need its own teardown.

**Alternatives considered**: two contexts mirroring upstream's `StoreContext` + `QRCodeContext` —
rejected, they exist only because React contexts are the unit of re-render; one class exposing both
the configuration getters and the generation state is the direct Svelte equivalent and matches
`CircularProgressState` / `SpeedDialState` in this repo. `useLazyRef` (`qr-code.tsx:116-123`) has no
port: a class field initialiser is already lazy-per-instance.

---

## R-03 — Generation trigger: `useLayoutEffect` + `requestAnimationFrame` → `$effect`

**Decision**:

```ts
// qr-code.svelte
$effect(() => {
	const key = state.generationTarget; // $derived from value/size/level/margin/quality/colors
	if (!key) return;
	const frame = requestAnimationFrame(() => void state.generate(key));
	return () => cancelAnimationFrame(frame);
});
```

`state.generationTarget` is a `$derived` string built by the pure `buildGenerationKey()` helper —
the port of upstream's memoised `generationKey` (`qr-code.tsx:175-187`), including its `if (!value)
return ''` early exit (FR-009). `generate(key)` re-checks `isGenerating` and
`generationKey === key` before doing work (FR-007, upstream `qr-code.tsx:193-198`).

**Rationale**: `$effect` tracks its dependencies automatically, so upstream's dependency array
disappears; the rAF defer is kept because it is load-bearing — the canvas part must have mounted and
registered its element before `QRCode.toCanvas` runs, and rAF is what upstream uses to get past that
first paint. Returning `cancelAnimationFrame` is the direct port of upstream's cleanup
(`qr-code.tsx:270`), so a rapid `value` change cannot leave a stale frame queued.

**Why this is not an "effect that writes state it reads"**: the effect reads only
`state.generationTarget` (derived from props). `generate()` writes `dataUrl`, `svgString`,
`isGenerating`, `error`, `generationKey` — none of which feed `generationTarget`. Additionally the
write happens inside the rAF callback, outside the effect's tracking scope, so no `untrack` is
required. The `$derived` key is what replaces `useMemo`; per the brief, no `useMemo`/`useCallback` is
ported for its own sake.

**Alternatives considered**: `$effect.pre` (the literal `useLayoutEffect` analogue) — rejected, it
runs *before* DOM update, so the canvas element would not yet exist on first run, and the rAF defer
already covers the ordering requirement. A `$derived.by` that returns a promise — rejected, generation
is a side effect with callbacks (`onGenerated`/`onError`) and must not re-run on read.

---

## R-04 — `asChild` / Radix `Slot` → the `child` snippet

**Decision**: every one of the seven parts takes an optional
`child?: Snippet<[{ props: <Part>ChildProps }]>`. Each part builds one `$derived` attribute object
(`role`/`aria-*`/`data-*`/handlers/`...restProps`/`class` merged last) and either spreads it onto its
default element or hands it to `child`.

**Rationale**: this is the established convention in this repo — `circular-progress.svelte`,
`speed-dial-trigger.svelte`, `dialog-content.svelte` all do exactly this, and CLAUDE.md §10 names it
as the `asChild` replacement. Building the attribute object once and sharing it between both branches
is what guarantees a `child` element is wired identically to the default element. The
`qr-code-formats-demo` example (`asChild` + `<Button size="sm">`) is reproduced verbatim by
`{#snippet child({ props })}<Button size="sm" {...props}>…</Button>{/snippet}`.

**Alternatives considered**: dropping `asChild` — rejected, Principle II; it is documented on all
seven parts via `CompositionProps` in `types/radix/qr-code.ts`, and one upstream demo depends on it.

---

## R-05 — Accessible names for canvas and SVG (deliberate strengthening)

**Decision**: `<QRCode.Image>` keeps upstream's `alt="QR Code"` default verbatim. `<QRCode.Canvas>`
and `<QRCode.Svg>` additionally get `role="img"` and a default
``aria-label={`QR code for ${value}`}``, both overridable through `restProps` (the caller's value
wins because `...restProps` is spread after the defaults).

**Rationale**: upstream leaves canvas and svg with no accessible name at all — a bare `<canvas>` is
announced as nothing, and a `<div>` holding an SVG string is announced as an empty group. FR-011 and
Constitution Principle III require an accessible name for whichever renderer is used, and the APG
`img` role is the correct pattern for a static graphic conveying information. The spec already
records this as a deliberate divergence (spec.md, Assumptions, "Accessible name for the image
renderer"), so Principle II is satisfied.

**Alternatives considered**: `aria-label="QR Code"` on all three (constant, upstream-shaped) —
rejected, it fails FR-011's "describes the encoded value". A visually hidden `<span>` sibling —
rejected, it changes upstream's DOM shape and breaks the `--qr-code-size` layout constraint.

---

## R-06 — Download: no primitive covers it, and the guard is load-bearing

**Decision**: `qr-code-download.svelte` renders a native `<button type="button">` and, on click,
builds an `<a download>`, appends it, clicks it, removes it, and (SVG only) revokes the object URL —
a line-for-line port of `qr-code.tsx:402-429`. The pure part of that (choosing href + filename,
returning `null` when there is nothing to download) lives in `qr-code.svelte.ts` as
`resolveDownload()` so it is unit-testable without a DOM click.

**Rationale (Principle IV justification)**: Bits UI has no file-download primitive, and
`$lib/components/ui/button` is a *styling* component, not a behaviour one — composing it would not
provide any of the blob/anchor logic. Keeping the element a native `<button>` is also what satisfies
FR-006's `Enter`/`Space` requirement and the MDX keyboard table for free, with no key handler of our
own. The early `return` when `format === 'png' && !dataUrl` (or `'svg' && !svgString`) is upstream's
`else { return }` branch and is exactly FR-006's "MUST NOT initiate a download before generation has
produced usable output" / spec edge case 5.

**One styling addition**: upstream's raw `<button>` gets only `max-w-(--qr-code-size)`, so it inherits
the UA focus ring. FR-012 requires a visible focus indicator, so the default class adds the repo's
standard `focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring outline-none`
token set (the same tokens `button.svelte` uses). This is additive styling on a `data-slot` we own,
not an API change; `class` still merges last so a caller can strip it.

---

## R-07 — `--qr-code-size` and the `style` prop

**Decision**: the root writes `style="--qr-code-size: {size}px; {styleProp ?? ''}"`, i.e. the custom
property first and the caller's `style` after it, matching upstream's spread order
(`qr-code.tsx:283-288`). `style` is destructured out of `restProps` so the two never collide on the
element. `Svg` and `Skeleton` likewise compose `width`/`height` before the caller's `style`.

**Rationale**: the MDX documents `--qr-code-size` as public API (CSS-variables table), and every
child part is constrained by `max-h-(--qr-code-size) max-w-(--qr-code-size)`. Tailwind v4's
`max-w-(--custom-prop)` shorthand resolves this without any arbitrary-value escape hatch. Emitting
the variable before the caller's declarations preserves upstream's override semantics.

---

## R-08 — Testing under jsdom: mock `qrcode`, not the canvas

**Decision**: `qr-code.test.ts` calls `vi.mock('qrcode', …)` with a factory exposing
`{ default: { toDataURL, toCanvas, toString } }` as `vi.fn()`s, and drives the generation lifecycle
through those. A dedicated `qr-code.test.svelte` harness composes the root with whichever parts a
case needs (the same pattern as `circular-progress.test.svelte`,
`direction-provider.test.svelte`). `requestAnimationFrame` exists in jsdom, so no shim is needed; each
case awaits `findBy*`/`waitFor` rather than faking timers.

**Rationale**: jsdom implements no 2D canvas context, so a real `QRCode.toCanvas(canvas, …)` throws
`Not implemented: HTMLCanvasElement.prototype.getContext`. Mocking the module boundary — rather than
installing the `canvas` native package or stubbing `getContext` — keeps the test fast, deterministic,
and focused on what this port actually owns: the generation key, the guards, the callbacks, the
render gating, and the download wiring. Encoder correctness is `qrcode`'s own concern and is not
re-tested here. The mock is also what makes the FR-008 failure path testable (reject `toString` once
and assert `onError` + cleared output).

**Alternatives considered**: adding `canvas` (node-canvas) as a dev dependency — rejected, it is a
native build, slow to install, and buys no assertion this port needs. Stubbing
`HTMLCanvasElement.prototype.getContext` in `tests/setup.ts` — rejected, it changes global setup for
every component to serve one, and `toDataURL`/`toString` would still hit the real encoder and make
assertions depend on encoder output bytes.

---

## R-09 — Controlled vs uncontrolled: not applicable, and why

**Decision**: no prop other than `ref` is `$bindable`. `value` and the six customization props are
input-only.

**Rationale**: Constitution Principle III lists "uncontrolled `defaultValue`" and "controlled `value`
+ `onValueChange`" as minimum test areas *for components that own value state*. QR Code owns none:
`value` is data flowing strictly downward into an encoder, there is no user interaction that could
change it, and upstream exposes neither `defaultValue` nor `onValueChange`. Adding `$bindable` here
would invent API that upstream does not have (a Principle II violation in the other direction).

What replaces those two test areas, covering the same underlying risk (does the component track its
inputs, and does it avoid moving on its own?): a **reactivity** case asserting that changing `value`
or any customization prop regenerates and re-invokes `onGenerated`, and an **idempotence** case
asserting that re-supplying the identical prop set does *not* call the encoder again (FR-007, spec
edge case "same value/configuration supplied again"). `ref` bindings are asserted per part.

---

## R-10 — RTL

**Decision**: no directional logic, and therefore no dependency on
`$lib/components/ui/direction-provider`. The RTL test renders the composition inside a
`<div dir="rtl">` and asserts that (a) the root keeps `flex-col items-center`, (b) the overlay keeps
its `top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` centring, and (c) the download button is
still reachable and activatable by keyboard.

**Rationale**: FR-013 and Constitution Principle III require RTL correctness, but the principle's
"horizontal navigation MUST invert" clause is conditional on there *being* horizontal navigation.
This component has no arrow-key navigation and no directional offsets — `left-1/2` + `-translate-x-1/2`
is direction-agnostic centring, not a physical inset that should become a logical one. Pulling in
`DirectionProvider` would add a registry dependency with nothing to do.

---

## R-11 — Failure clears prior output

**Decision**: the `catch` branch sets `error`, `isGenerating = false`, **and** `dataUrl = null` /
`svgString = null`, leaving `generationKey` at its previous value so a later retry of a genuinely new
key is still allowed.

**Rationale**: upstream (`qr-code.tsx:236-246`) sets only `error` and `isGenerating`, so a failed
regeneration after a successful one leaves the *previous* code on screen while `value` has already
changed — a QR code silently encoding the wrong destination. The spec records this as a deliberate
divergence (spec.md, Assumptions, "Error-clearing on failure") and FR-008 mandates it ("a failed
generation MUST NOT leave a partial or corrupted visual result on screen").

Note that upstream's `toDataURL` call is *already* individually try/caught to `null`
(`qr-code.tsx:210-214`), i.e. a data-URL failure alone is non-fatal and only suppresses the `Image`
and PNG-download paths — that nuance is ported verbatim.
