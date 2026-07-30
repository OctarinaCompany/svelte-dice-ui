# Phase 0 Research: Mask Input

**Feature**: `019-port-mask-input` | **Date**: 2026-07-30

**Upstream pin**: `sadmann7/diceui` @ `d9763d82530416dfa4c81c462387b55d06bae4ec`

Sources read in full:

| Purpose         | Path                                                                        |
| --------------- | --------------------------------------------------------------------------- |
| Component       | `.reference/diceui/docs/registry/bases/radix/ui/mask-input.tsx` (1515 lines) |
| Tests           | `.reference/diceui/docs/registry/bases/radix/test/mask-input.test.tsx`       |
| API contract    | `.reference/diceui/docs/content/docs/components/radix/mask-input.mdx`        |
| Demos (5)       | `.reference/diceui/docs/registry/bases/radix/examples/mask-input-*.tsx`      |
| Local precedent | `segmented-input`, `checkbox-group`, `relative-time-card`, `input`           |

The Technical Context in `plan.md` carries **zero** unresolved-clarification markers; every open
question below was resolved from the pinned source, the constitution, `CLAUDE.md`, or the spec's
Assumptions.

---

## R-01 — Where does the mask engine live, and in what kind of module?

**Decision**: a plain, rune-free `src/lib/components/ui/mask-input/mask-engine.ts`, exported from the
barrel. It holds `MASK_PATTERNS`, the pattern/validate/transform tables, the `Intl` caches, the
`applyMask` / `applyCurrencyMask` / `applyPercentageMask` / `getUnmaskedValue` /
`toUnmaskedIndex` / `fromUnmaskedIndex` helpers, and the two caret solvers
(`getCurrencyCaretPosition`, `getPatternCaretPosition`).

**Rationale**: FR-017 and US5 require the engine to be importable without rendering the component
(the future `phone-input` port consumes it). Everything in it is a pure function over strings plus
three module-level memo `Map`s — no reactive state, so a `.svelte.ts` module would buy nothing and
would falsely signal that runes are involved. `relative-time-card/relative-time-format.ts` is the
established precedent in this repo for exactly this shape: a pure `.ts` sibling of the component,
re-exported through `index.ts`, listed in the registry entry.

**Alternatives rejected**:

- Inlining the engine in `mask-input.svelte.ts` — fails FR-017 (importing it would drag the rune
  runtime and the state class into `phone-input`).
- Putting it in `$lib/utils.ts` — violates Principle V: a registry item must ship every file it needs
  inside its own folder.
- `mask-input.svelte.ts` holding both — mixes a pure module with a reactive one; the `Map` caches
  would then live in a rune module where `$state` is expected.

---

## R-02 — Does this component need a Svelte context?

**Decision**: **No.** No `Symbol` key, no `setMaskInputContext` / `getMaskInputContext`, no
"used outside its provider" error.

**Rationale**: upstream `MaskInput` is a single, non-compound component — one `<input>`, no
`React.createContext`, no sub-parts. Inventing a provider/consumer pair would be undocumented API
drift (Principle II). Constitution §III's "documented error thrown when a part is rendered outside its
provider" is therefore vacuous here; the guard-rail test area is satisfied instead by the
`disabled` / `readonly` suppression assertions demanded by FR-012 and US4 AS-2.

**Consequence for the plan**: the Constitution Check records this explicitly so `/speckit-analyze`
does not flag the missing context test as a gap.

---

## R-03 — Compose `$lib/components/ui/input`, or render a bare `<input>`?

**Decision**: render a bare `<input>` inside `mask-input.svelte`, reusing the **exact** Tailwind class
string of `src/lib/components/ui/input/input.svelte` (with a source comment naming that file). Do
**not** compose `<Input>`.

**Rationale (Principle IV requires this in writing)**: `Input` renders `<input bind:this={ref}
bind:value {...restProps}>`. Two blocking capability gaps:

1. **`bind:value` races the caret.** This component's entire hard requirement (US2, SC-002) is that,
   inside its own `input` handler, it reads `element.value` + `element.selectionStart`, writes a
   reformatted `element.value`, and then calls `element.setSelectionRange(...)` synchronously.
   `bind:value` installs its own `input` listener on the same element and writes the element back
   from its own tracked value on the next flush. The relative ordering of a `bind:value` listener and
   an `oninput` arriving through a `{...restProps}` spread is a compiler implementation detail, not a
   documented guarantee — and if the binding writes after our handler, the caret snaps to the end and
   nine of the eleven upstream Cursor Positioning tests fail. Passing `value` **as a plain attribute**
   (never `bind:value`) is what makes the caret survive: Svelte's `set_value` short-circuits when
   `element.value === value`, which is exactly the state our handler leaves the element in.
2. **No `child` snippet.** FR-018 (upstream `asChild`) requires emitting the merged prop bag to a
   caller-supplied element. `Input` renders its own `<input>` unconditionally and exposes no `child`
   snippet, so `asChild` parity is impossible through it.

`Input` also cannot be edited to fix either point: it is an unmodified shadcn-svelte base file, and
Principle V forbids a registry item from depending on a locally patched base component.

**Cost accepted**: the class string is duplicated. This matches upstream (which hardcodes the same
string) and matches how a registry item ships — self-contained source. The duplicate carries a
`// Mirrors src/lib/components/ui/input/input.svelte` comment so drift is greppable.

**Alternatives rejected**:

- `<Input value={displayValue} oninput={…} bind:ref>` — the ordering hazard above; verified as a real
  risk, not a hypothetical, because `bind:value` is the only mechanism in Svelte that writes an
  input's `.value` outside the render effect.
- A bits-ui primitive — bits-ui ships no masked/formatted text-input primitive (it has `PinInput`,
  which is a fixed-cell OTP widget with different semantics and no pattern/transform/validate API).

---

## R-04 — How does the caret survive Svelte's re-render?

**Decision**: bind the value one-way (`value={state.displayValue}`), mutate `element.value` +
`setSelectionRange` imperatively inside the handler, and rely on Svelte's `set_value` equality guard.

**Mechanism**: on `input`, the handler runs synchronously and leaves the DOM element holding the
masked string with the caret placed. Svelte's own update runs in the following microtask flush and
calls `set_value(element, displayValue)`; because `displayValue` is derived from the same value the
handler just committed, `element.value === value` holds and `set_value` returns without touching the
element — the caret is preserved. When the two differ (a controlled parent that *declines* the write
via a function binding), Svelte does write, and the caret lands at the end — which is precisely
React's behaviour for a controlled input whose parent rejects the change, so parity holds.

**Rationale**: this is the only path that keeps a *single* writer of `element.value` per event.

**Alternatives rejected**:

- `$effect` re-applying the selection after render — introduces a second writer, fires on every
  unrelated re-render, and would fight user selections made with the mouse.
- `tick().then(...)` inside the handler — moves the caret write after the flush, producing a visible
  one-frame jump and breaking the synchronous `expect(input.selectionStart)` assertions the upstream
  tests make immediately after `user.keyboard(...)`.

---

## R-05 — Controlled vs uncontrolled without React's `isControlled`

**Decision**: `value = $bindable()` + `defaultValue = ''`, seeded once with
`value ??= untrack(() => defaultValue)`, exactly as `checkbox-group.svelte:112` does. Every commit
goes through one setter that assigns `value` and then calls `onValueChange?.(masked, unmasked)`.

**Rationale**: React distinguishes controlled from uncontrolled by `valueProp !== undefined` and
simply never writes state in the controlled case. Svelte's equivalent is the binding form the caller
chooses:

| Caller writes                                   | Semantics                                       |
| ----------------------------------------------- | ----------------------------------------------- |
| `<MaskInput defaultValue="123" />`              | uncontrolled — the component owns the value     |
| `<MaskInput bind:value />`                      | controlled, parent accepts every change         |
| `<MaskInput bind:value={() => v, (n) => {…}} />` | controlled, parent authoritative and may refuse |
| `<MaskInput value={v} />` (no `bind:`)          | initial value only; writes stay local           |

The third row is what satisfies spec US "the component must not move on its own"; the
`checkbox-group` harness already models it as its `'function'` binding mode, and this port's harness
copies that. Recorded as divergence **D-01**.

**Alternatives rejected**: a separate `controlled?: boolean` prop (invented API, Principle II), or
refusing to write `value` when it was passed (impossible to detect in Svelte — a passed-but-unbound
`$bindable` is indistinguishable from a bound one at runtime).

---

## R-06 — Native event props: `onBlur` → `onblur`, and `defaultPrevented` gating

**Decision**: destructure `onfocus`, `onblur`, `onkeydown`, `onpaste`, `oncompositionstart`,
`oncompositionend`, `oninput` out of `$props()` under `…Prop` aliases; the component's own handler
calls the caller's handler **first**, returns early when `event.defaultPrevented`, then runs the
masking logic. This reproduces upstream lines 1115–1463 exactly.

**Rationale**: Svelte 5 uses lowercase DOM event attributes, so the upstream camelCase names are
renamed by the platform, not by choice — recorded as divergence **D-02**. If these handlers were left
in `...restProps` the spread would install the caller's handler *and* ours with no ordering guarantee
and no way to honour `preventDefault()`, which upstream treats as an opt-out of the mask behaviour.

**Note on `onChange`**: React's `onChange` on an input is the DOM `input` event. The Svelte port
listens on `oninput`. Callers who need the DOM `change` event still get it through `...restProps`.
Recorded as part of **D-02**.

---

## R-07 — `readOnly` → `readonly`

**Decision**: the prop is spelled `readonly` and destructured as `readonly: readOnly = false`.

**Rationale**: `MaskInputProps` extends `WithElementRef<HTMLInputAttributes>`, which already declares
`readonly?: boolean | null`. Declaring a second `readOnly` prop would create two props that set one
attribute, and `svelte-check` would flag the unused-but-spread `readonly` from `restProps`. Every
other input-shaped component in this repo (`input`, `segmented-input-item`) uses the HTML spelling.
Recorded as divergence **D-03**. `disabled`, `required` and `invalid` keep their upstream spelling
because they already match HTML/ARIA.

---

## R-08 — `asChild` → the `child` snippet

**Decision**: `child?: Snippet<[{ props: MaskInputChildProps }]>`. When supplied, the component
renders `{@render child({ props })}` instead of its `<input>`; `ref` then stays `null`.

**Rationale**: the established repo pattern (`segmented-input.svelte:133-139`, `dialog-content`), and
the spec's Assumptions already fixed it (no Radix `Slot`, no `compose-refs`). Recorded as **D-04**.

**Consequence, stated plainly**: with `child`, the component has no element to read
`selectionStart` from or to write `element.value` to, so caret restoration and the imperative
Backspace/Delete/paste paths are inert until the caller wires the emitted `oninput`/`onkeydown`/
`onpaste` handlers onto a real `<input>` **and** the component can reach it. To keep the behaviour
working, `MaskInputChildProps` includes a `ref`-free contract: the caller spreads `{...props}` onto
their input, and the emitted handlers resolve the element from `event.currentTarget` rather than from
the component's `ref`. The state class therefore takes the element from the event, never from `ref` —
which also simplifies the default path. Upstream's Slot has the same effective behaviour (it forwards
`ref` to the child, and the handlers read `event.target`). Recorded as **D-05**.

---

## R-09 — `Intl` caches under Svelte

**Decision**: keep the three upstream `Map` caches (`formattersCache`, `currencyAtEndCache`,
`currencySymbolsCache`) as module-level constants in `mask-engine.ts`, exactly as upstream has them.

**Rationale**: the spec's Assumptions already fixed this. They are keyed purely on
`locale|currency|minFrac|maxFrac`, contain no component state, and must be shared across every
instance — the whole point of the memo. `useMemo` → nothing (per the translation rules) applies to
the *per-render* memos (`transformOpts`, `displayValue`, `tokenCount`, `calculatedInputMode`,
`placeholderValue`), which become `$derived`. Module-level memo `Map`s are a different construct and
survive verbatim.

**SSR note**: the caches are populated lazily on first use and hold only `Intl.NumberFormat`
instances and primitives, so a shared server module is safe (no request-scoped data leaks). No
`browser` guard needed.

---

## R-10 — RTL

**Decision**: no `dir` prop, no `useDirection`, no `<DirectionProvider>` dependency.

**Rationale**: the spec's Assumptions fixed this, and the upstream component has no direction
handling at all. All caret arithmetic is character-index based and direction-agnostic; the only
RTL-sensitive surface is glyph layout, which the browser derives from the inherited `dir`. The RTL
test renders the component inside a `dir="rtl"` ancestor and asserts (a) the input has no `dir` of its
own, (b) `getComputedStyle(input).direction === 'rtl'` — i.e. it inherits — and (c) masking and caret
positions are byte-identical to the LTR case. Contrast with `segmented-input`, which *does* take
`dir` because its arrow-key navigation inverts; this one has no arrow-key navigation.

---

## R-11 — `maxLength` and `inputMode` derivation

**Decision**: reproduce upstream's arithmetic literally, including its quirks.

- `tokenCount` is `undefined` when there is no mask **or** the pattern contains `€ $ %`; otherwise
  it is the count of `#` in the pattern.
- `calculatedMaxLength = tokenCount ? maskPattern.pattern.length : maxLength`. Note `tokenCount === 0`
  is falsy, so a `#`-less custom pattern falls back to the caller's `maxLength` — kept as-is.
  `zipCode` (`#####`) therefore emits `maxlength="5"`, which the upstream test asserts.
- `calculatedInputMode`: caller's `inputMode` wins; else `undefined` with no mask; else `'decimal'`
  for `currency`/`percentage`/`ipv4`; else `'numeric'` when the mask **key** matches
  `/^(phone|zipCode|zipCodeExtended|ssn|ein|time|date|creditCard|creditCardExpiry)$/`; else
  `undefined`. Object (custom) masks never get an `inputMode` — upstream behaviour, kept.

**Rationale**: FR-013, FR-014, and two upstream tests assert these exact values. Any "improvement"
here is drift.

---

## R-12 — Fake timers for date-dependent validation

**Decision**: the `date` and `creditCardExpiry` validation tests wrap their assertions in
`vi.useFakeTimers()` / `vi.setSystemTime(new Date(2025, 11, 15))` / `vi.useRealTimers()`, mirroring
upstream lines 1132–1169.

**Rationale**: `creditCardExpiry.validate` reads `new Date()`; without the freeze the suite's truth
value changes with the wall clock and the port would go red on a future run. Upstream already does
this and the spec's Assumptions require it. `vi.useRealTimers()` runs in a `finally`/`afterEach` so a
failing assertion cannot leak fake timers into the next test.

---

## R-13 — Demo page: the five upstream examples in a docs page with no form library

**Decision**: one `<ComponentPreview>` per upstream demo file — `Default`, `Custom patterns`,
`Validation modes`, `Card information`, `With form` — with page-local `$state` standing in for
`React.useState`, and the `With form` section using a plain `<form onsubmit>` plus
`Field.FieldGroup`/`Field.Field` (per `.agents/skills/shadcn-svelte/rules/forms.md`) instead of
`react-hook-form` + `zod` + the `Form*` primitives.

**Rationale**: Principle IX requires one section per upstream example, not one section per upstream
*dependency*. `react-hook-form` has no Svelte analogue, and adding `sveltekit-superforms` + `zod`
would be two new npm dependencies for a demo — forbidden by the zero-new-dependency constraint. The
validation the demo shows (min-length per field, an error message, a success toast) is reproduced with
`onValidate` + `$state` + the already-installed `svelte-sonner`. The `Card information` demo uses the
installed `card` + `button` + `label` primitives and `toast` from `svelte-sonner`, matching upstream
1:1. Recorded as divergence **D-06**.

---

## R-14 — Zero new npm dependencies

**Decision**: none added. Confirmed dependency inventory for the component itself:

| Need                   | Source                                             |
| ---------------------- | -------------------------------------------------- |
| class merge            | `cn()` from `$lib/utils.js` (already present)       |
| currency formatting    | `Intl.NumberFormat` — web platform, no package      |
| element props typing   | `WithElementRef<HTMLInputAttributes>` from `$lib`   |
| variants               | none needed — single visual variant, plain `cn()`   |
| headless behaviour     | none available/needed (see R-03)                    |

`registry.json` therefore gets `"dependencies": []` and `"registryDependencies": []`. The demo page's
imports (`label`, `card`, `button`, `field`, `svelte-sonner`) are docs-side only and per Principle V
must **not** appear in the component's registry entry.

---

## R-15 — Test harness file

**Decision**: add `mask-input.test.svelte`, not collected by Vitest (`include` is `.{js,ts}`) and not
listed in `registry.json`, following `checkbox-group.test.svelte` / `segmented-input.test.svelte`.

**Rationale**: a `.ts` spec cannot express `bind:value`, the function binding
`bind:value={() => v, (n) => …}`, a `child` snippet, or a `<form>` ancestor. All four are required by
US1/US2/US4/FR-018. The harness takes a discriminated `mode` prop so one file covers every
composition.
