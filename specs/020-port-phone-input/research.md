# Phase 0 Research: Port Phone Input

**Feature**: `020-port-phone-input` | **Date**: 2026-07-30

**Upstream, read at the pinned commit `d9763d8`:**

- `.reference/diceui/docs/registry/bases/radix/ui/phone-input.tsx` (813 lines — the whole component)
- `.reference/diceui/docs/content/docs/components/radix/phone-input.mdx` (API contract + keyboard table)
- `.reference/diceui/docs/types/radix/phone-input.ts` (documented prop JSDoc, incl. `@default`)
- `.reference/diceui/docs/registry/bases/radix/examples/phone-input-demo.tsx`,
  `phone-input-custom-countries-demo.tsx`, `phone-input-form-demo.tsx`
- `.reference/diceui/docs/registry/bases/radix/components/visually-hidden-input.tsx`
- `.reference/diceui/docs/registry/bases/radix/ui/_registry.ts` (registry metadata for `phone-input`)

There is **no upstream test file** for `phone-input` (`packages/` has no `phone-input` package, and
`docs/registry/bases/radix/test/` contains none). The assertion floor therefore comes from the MDX
keyboard table, the data-attribute table, and the source's own branches — recorded as the contract in
`contracts/component-api.md`.

Local material read for convention parity: `src/lib/components/ui/mask-input/*` (pure engine module +
`child` snippet), `src/lib/components/ui/checkbox-group/*` (state class, Symbol context,
`FormControlState`, hidden form input, `.test.svelte` harness), `src/lib/components/ui/segmented-input/*`
(cross-component reuse surface in the barrel), plus `command`, `popover`, `input` and
`src/routes/docs/components/mask-input/+page.svelte`.

---

## R-01 — Country metadata: inline table + `Intl.DisplayNames`, no npm package

**Decision**: Transcribe upstream's `COUNTRY_DATA` `[iso2, dialCode]` table (218 entries) verbatim into
`phone-engine.ts`, and derive `name` through `Intl.DisplayNames([locale], { type: 'region' })` and `flag`
through the regional-indicator code-point trick, exactly as upstream's `getCountryName` / `getFlagEmoji` /
`getCountries` do. **Zero new npm dependencies.**

**Rationale**: The component-specific guidance says to match upstream's dependency choice exactly.
Upstream takes no phone/country package: the table is its own transcription of
`mukeshsoni/country-telephone-data` (credited in a `@see` comment), and names come from the platform
`Intl` API. Introducing `libphonenumber-js` would change formatting output, bundle size, and the public
`Country` shape.

**Alternatives rejected**: `libphonenumber-js` (different formatting algorithm — would break parity on
every displayed value); `country-telephone-data` as a runtime dependency (upstream deliberately inlines
the table instead); a hand-curated short list (loses countries the upstream dropdown shows).

**Detail**: `getCountries()` is memoised in a module-level cache. Upstream re-derives it on every render
(a React default-argument evaluation); memoising produces byte-identical output and only avoids 218
`Intl.DisplayNames` lookups per instance. `Intl.DisplayNames` is available in Node 18+ and in jsdom's
host realm, so tests exercise the real path.

## R-02 — Reuse from `mask-input`, and what is genuinely new

**Decision**: Import `getUnmaskedValue` from `$lib/components/ui/mask-input/index.js` for every
digit-extraction step (`value.replace(/\D/g, '')` upstream) inside `phone-engine.ts`. Do **not** route
international formatting through `applyMask`.

**Rationale**: `mask-input`'s engine formats against a *static* slot pattern (`(###) ###-####`).
A phone number's split point is dynamic — it is the length of the *detected country's* dial code — and
the remainder is grouped in threes with no fixed length, so no `MaskPattern` can express it (a pattern
would have to be regenerated per keystroke and would still cap the length). Upstream itself does not
delegate this to any shared engine. The overlap between the two components is exactly digit extraction,
and that is what is reused; `getUnmaskedValue({ value })` with no `transform` is literally
`value.replace(/\D/g, '')`.

**Alternatives rejected**: Building a synthetic `MaskPattern` per country (would need a per-country
national-format table upstream does not have — scope creep and a parity break); duplicating the digit
regex (rejected by the reuse guidance).

**Consequence**: `registry.json` lists `mask-input` in `registryDependencies` so a consumer installing
`phone-input` also gets the engine module.

## R-03 — Store + `useSyncExternalStore` → one state class

**Decision**: Replace `Store`, `StoreContext`, `useStore`, `useLazyRef`, `useAsRef` and
`useIsomorphicLayoutEffect` with a single `PhoneInputRootState` class in `phone-input.svelte.ts`, shared
through a `Symbol`-keyed context with a throwing `getPhoneInputContext(consumerName)` helper.

**Rationale**: Upstream's store exists only because React has no fine-grained reactivity — it is a
hand-rolled subscribe/notify pair whose entire purpose is selector-level re-render control. `$state` +
`$derived` give that for free. Spec Assumptions already record this. The two React contexts (`StoreContext`
for mutable state, `PhoneInputContext` for config) collapse into one class because both are
provided by the same root and consumed by the same two parts.

**Consequence**: Upstream's `useStore as usePhoneInput` escape-hatch export has no Svelte counterpart;
the equivalent is `getPhoneInputContext()`, which is exported from the barrel. No example or doc page
uses `usePhoneInput`.

## R-04 — Controlled/uncontrolled for two independent values

**Decision**: `value`/`defaultValue`/`onValueChange` and `country`/`defaultCountry`/`onCountryChange` are
two independent `$bindable` + `defaultX` pairs, seeded once with `x ??= untrack(() => defaultX)`, and
every write goes through a setter that assigns then calls the callback — the `checkbox-group` pattern.

**Rationale**: Upstream's `setState` is `Object.is`-guarded and fires the callback only on an actual
change; assigning to a `$bindable` that a function-binding parent declines leaves the rendered value put,
which reproduces React's "controlled parent wins" semantics including the declining case.

**Documented default discrepancy**: `docs/types/radix/phone-input.ts` annotates `defaultCountry` with
`@default "US"`, but the implementation initialises `countryProp ?? defaultCountry ?? ""` — with no
`defaultCountry`, the selected country is the empty string and the trigger renders the flag-less swatch
(which is what the plain `phone-input-demo` shows). **Runtime behaviour wins**: our default is `''`, and
the JSDoc records both (`@default ""` plus a note that upstream's type file documents `"US"`). Recorded
here because Principle II requires every divergence from the documented API to be written down.

## R-05 — The auto-detection effect, including its two quirks

**Decision**: Port `React.useEffect(..., [value, countries, country, store, startsWithPlus])` as a single
`$effect` in the root that reads `value`, `countries`, `country` and `startsWithPlus` and writes the
country through the setter — **verbatim**, quirks included.

Upstream body (lines 562-574), reproduced exactly:

```
if (!value) return;
const digits = value.slice(1).replace(/\D/g, '');
const shouldDetect = startsWithPlus || digits.length >= 10;
if (!shouldDetect) return;
const detected = detectCountryFromNumber(value, countries);
if (detected && detected.code !== country) setCountry(detected.code);
```

**Quirk 1 — `value.slice(1)`**: the first character is dropped before counting digits *even when the value
has no `+`*, so a 10-digit bare number counts 9 digits and does not trip the `>= 10` threshold; 11 digits
does. Reproduced as-is; the test suite pins it.

**Quirk 2 — manual selection can be overwritten**: because `country` is in the dependency list, choosing a
country by hand while a detectable value is present re-runs detection and snaps back to the detected
country (e.g. picking Canada on `+1408…` reverts to US via the `+1` tie-break). This is upstream
behaviour, not a port defect; spec US2 AS-3 ("the selected country becomes the active one") therefore holds
for the case the demos exercise — an empty or non-detectable value. Tests assert both: selection sticks
with an empty value, and reverts with a detectable one.

**Effect discipline**: the effect writes `country`, which it also reads. The write is guarded by
`detected.code !== country`, so it converges after one pass exactly as upstream's does; no `untrack` is
needed and no `$derived` can express it (it must call the caller's `onCountryChange`). This is the one
place a `$effect` legitimately mutates reactive state.

## R-06 — `startsWithPlus` is field-owned, not derived

**Decision**: Keep `startsWithPlus` as `$state` on the root state class, initialised from the initial
value and updated only by the field's input handler.

**Rationale**: It records what the *user typed* (`inputValue.startsWith('+')` on the raw, pre-normalised
input), not a property of the canonical value — the canonical value always starts with `+` once it has a
digit. Deriving it from `value` would make detection fire for every non-empty value and break the
`digits.length >= 10` branch. Upstream stores it in the store for the same reason.

## R-07 — Popover + Command cover the entire dropdown

**Decision**: Compose `$lib/components/ui/popover` (bits-ui `Popover`) and `$lib/components/ui/command`
(bits-ui `Command`) — no bespoke dropdown, positioning, filtering or list navigation.

**Verified in `node_modules/bits-ui@2.18.1`**:

| Behaviour required by the MDX | Provided by |
| --- | --- |
| `Space` / `Enter` open from the trigger | `Popover.Trigger` (native `<button>`) |
| `Escape` closes without changing selection | `Popover` escape layer |
| `ArrowUp` / `ArrowDown` move the highlight | `CommandRootState.onkeydown` → `#prev` / `#next` |
| `Home` / `End` jump to first/last | `CommandRootState.onkeydown` → `kbd.HOME` / `kbd.END` (`command.svelte.js:918-926`) |
| Type to filter by name, dial code, ISO code | `Command.Input` + per-item `value={`${name} ${dialCode} ${code}`}` scoring |
| Empty state | `Command.Empty` |
| `Enter` selects the highlighted item | `CommandRootState.onkeydown` → `kbd.ENTER` → `item.click()` |

**Selected-item check mark**: `src/lib/components/ui/command/command-item.svelte` already renders a
trailing `CheckIcon` gated on `group-data-[checked=true]/command-item`. Passing
`data-checked={selected ? 'true' : undefined}` reuses it instead of rendering a second icon — closer to
the local design system than upstream's inline `opacity-0`/`opacity-100` `Check`. The `'true'` string
(rather than the repo's `'' | undefined` convention) is required by the existing shadcn selector.

**Group wrapper**: `.agents/skills/shadcn-svelte/rules/composition.md` — items always inside their group;
`Command.Item`s go inside `Command.Group` (upstream does this too), and `command-group.svelte` already
wraps children in `Command.GroupItems`.

## R-08 — Returning focus to the field after a selection

**Decision**: Use `Popover.Content`'s `onCloseAutoFocus` (from bits-ui's `FocusScopeProps`, reachable
through `PopperLayerProps`): when the close was caused by a country selection, `preventDefault()` and
focus the field element held by the state class; otherwise let bits-ui restore focus to the trigger.

**Rationale**: Upstream does `store.setState('open', false)` then
`requestAnimationFrame(() => inputRef.current?.focus())`, which fights Radix's own focus restore. bits-ui
exposes the documented hook for precisely this, so no `requestAnimationFrame` race and no bespoke focus
management. `Escape` and outside-click keep the standard behaviour (focus returns to the trigger), which
matches both the WAI-ARIA practice and upstream's observable result — upstream's rAF focus only runs on
the select path.

**Alternatives rejected**: replicating `requestAnimationFrame` + `.focus()` (fights the focus scope,
flaky under `userEvent`); a `$effect` watching `open` (cannot distinguish select-close from escape-close).

## R-09 — The field is a one-way controlled input

**Decision**: `<Input value={displayValue} oninput={…}>` — never `bind:value`. After each input event the
state is updated and an `$effect` re-asserts `element.value = displayValue` whenever the two diverge.

**Rationale**: React re-renders a controlled input and snaps the DOM back after every keystroke, including
keystrokes that produce an identical formatted string (typing `a` into `+1 408`). Svelte only patches the
attribute when the derived value *changes*, so a rejected character would linger in the DOM. The
re-assert effect writes to the DOM only (never to reactive state), so it is not a `$derived` candidate.
`mask-input` solves the same problem with an attachment; here a plain effect suffices because the port
does no caret arithmetic.

**Caret parity**: upstream performs no caret restoration — the caret lands at the end after any edit that
changes the formatting. Adding caret preservation would be an undocumented behaviour change, so it is
deliberately *not* added.

## R-10 — Hidden form input: reuse `FormControlState`, keep the native `input` event

**Decision**: Reuse the exported `FormControlState` class from
`$lib/components/ui/checkbox-group/index.js` (`isFormControl` = "no element yet, or the element has a
`<form>` ancestor") and render `<input type="hidden">` inside the root only when `isFormControl` is true.
An `$effect` mirrors the canonical value onto the element and dispatches a bubbling `input` event when it
changes, reproducing `VisuallyHiddenInput`'s native-setter dispatch.

**Rationale**: `FormControlState` was written in `checkbox-group` as "the reusable form primitive every
later form port copies" and matches upstream's `useFormControl` semantics one for one, including the
"render before mount" default. bits-ui's `HiddenInput` has no form-presence detection and no
value-change dispatch. Upstream's `ResizeObserver`-driven sizing in `VisuallyHiddenInput` is dead code for
`type="hidden"` (a hidden input has no box), so it is not ported; the visually-hidden style block is
likewise unnecessary. Adds `checkbox-group` to `registryDependencies`, following the
`segmented-input → speed-dial` precedent.

## R-11 — `asChild` on the root → `child` snippet; `asChild` on the country select → dropped

**Decision**: The root takes `child?: Snippet<[{ props: PhoneInputChildProps }]>` (the `mask-input` /
`segmented-input` pattern). `PhoneInputCountrySelect` and `PhoneInputField` take **no** `child` snippet.

**Rationale**: The root genuinely renders `asChild ? Slot : 'div'`. The country select's documented
`CompositionProps` (`asChild`) is inert in the implementation — the component never reads `asChild`, and
it destructures `children` and never renders them. Porting a prop that does nothing would be drift in the
opposite direction. Both facts are recorded in `plan.md` → Public API and in the spec's Assumptions.

## R-12 — Prop-precedence quirks preserved from upstream's JSX order

Upstream puts `{...inputProps}` *before* the props it owns, so the owned ones win:

1. `placeholder` — the **root's** `placeholder` overrides one passed to `PhoneInputField`. The
   `phone-input-demo` therefore shows "Enter phone number", not its own `placeholder="12345667777"`.
2. `value` and `onChange` on `PhoneInputField` are ignored (the component owns them).
3. On the root, `{...rootProps}` comes *after* `role`/`data-*`/`id`, so a caller can override them.
4. On `PhoneInputCountrySelect`, `{...popoverProps}` comes after `open`, so a caller-supplied `open`
   overrides the internal state (but `onOpenChange` is destructured out and always composed).

All four are reproduced exactly: our attribute objects use the same ordering. `value` is omitted from
`PhoneInputFieldProps` rather than accepted-and-ignored, because a silently-dropped `value` in a Svelte
input type would be a typing trap; the divergence is recorded.

## R-13 — Styling translation (Principle VIII, zero `dark:` classes)

| Upstream | Here | Why |
| --- | --- | --- |
| `rounded-l-md`, `border-r`, `rounded-r-md rounded-l-none` | `rounded-s-lg`, `border-e`, `rounded-e-lg rounded-s-none` | logical properties flip under `dir="rtl"` (FR-013) |
| `dark:bg-input/30` on the root | dropped | the composed `<Input>` already carries the base's dark tint through its own token classes |
| `dark:has-[…]:ring-destructive/40`, `dark:aria-invalid:*` | dropped | the destructive tokens already flip in `src/app.css` |
| `[data-slot=input-group-control]` in the root's `has-[…]` selectors | `[data-slot=phone-input-field]` | our field sets its own slot (the local `Input` accepts a `data-slot` prop) |
| `bg-muted/50` swatch, `text-muted-foreground` dial code, `bg-accent` hover | unchanged | already semantic tokens |
| `h-10` root, `h-4 w-6` swatch | unchanged | non-square box; `size-*` not applicable |

No manual `dark:`, no palette colours, no `space-*`, no `z-index`. `class` is merged last through `cn()`
on every part.

## R-14 — Test strategy

**Decision**: `phone-input.test.ts` (Vitest, jsdom, `globals: false`) plus a `phone-input.test.svelte`
harness, mirroring `checkbox-group`.

The harness is needed for what a `.ts` spec cannot express: `bind:value` / `bind:country`, a function
binding that declines writes, a `<form>` ancestor for the hidden input, `dir="rtl"`, and each part
rendered with no provider above it (the throwing-context assertions). Pure functions
(`formatPhoneNumber`, `detectCountryFromNumber`, `getCountries`, `normalizePhoneInput`) are tested
directly against the upstream algorithm — they are exported from the barrel, so no rendering is needed.

`expect.requireAssertions` is on, so every `it` asserts. `userEvent` drives every keyboard case; no
`fireEvent` where `userEvent` works.

## R-15 — Demo route content

Three `<ComponentPreview>` sections, one per upstream example file, plus the props tables the repo's
`mask-input` page established (`Table` primitives, one table per part).

The form example uses a native `<form>` + `Field.FieldGroup`/`Field.Field`
(`.agents/skills/shadcn-svelte/rules/forms.md`) + `Button` + `toast` from `svelte-sonner`, replacing
`react-hook-form` + `zod` + `@hookform/resolvers` — none of which exist in this repo and none of which
are part of the component. Validation is reproduced in a few lines of rune state (`phone` non-empty,
`country` non-empty), which is exactly what the upstream schema asserts.
