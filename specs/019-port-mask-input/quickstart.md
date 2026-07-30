# Quickstart & Validation: Mask Input

**Feature**: `019-port-mask-input` | **Date**: 2026-07-30

How to run and prove this port end to end. Contract details live in
[`contracts/mask-input.md`](./contracts/mask-input.md); the types and pipeline live in
[`data-model.md`](./data-model.md). No implementation code here.

## Prerequisites

- Node + `pnpm` with `pnpm install` already run (the repo is fully provisioned; **no**
  `shadcn-svelte add` during this port).
- Nothing new to install — this component adds zero npm dependencies (research R-14).

## Usage the port must make work

```svelte
<script lang="ts">
	import { MaskInput, type MaskPattern } from '$lib/components/ui/mask-input/index.js';

	let phone = $state('');
	let valid = $state(true);

	const productCode: MaskPattern = {
		pattern: '###-###-###',
		transform: (value) => value.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
		validate: (value) => value.length === 9
	};
</script>

<!-- uncontrolled -->
<MaskInput mask="phone" defaultValue="5551234567" />

<!-- controlled, parent accepts every change -->
<MaskInput bind:value={phone} mask="phone" maskPlaceholder="(___) ___-____" />

<!-- controlled + validation + invalid styling -->
<MaskInput
	bind:value={phone}
	mask={productCode}
	validationMode="onTouched"
	invalid={!valid}
	onValidate={(isValid) => (valid = isValid)}
	onValueChange={(masked, unmasked) => console.log(masked, unmasked)}
/>
```

Reusing the engine without rendering anything (US5 / FR-017):

```ts
import { applyMask, MASK_PATTERNS, toUnmaskedIndex } from '$lib/components/ui/mask-input/index.js';

applyMask({ value: '1234567890', pattern: MASK_PATTERNS.phone.pattern }); // "(123) 456-7890"
toUnmaskedIndex({ masked: '(123) 456-7890', pattern: '(###) ###-####', caret: 9 }); // 6
```

## Scenario checks

Each row is proved by the colocated suite `src/lib/components/ui/mask-input/mask-input.test.ts`
(with `mask-input.test.svelte` supplying the compositions a `.ts` spec cannot express).

| # | Scenario (spec ref)                        | Drive                                                          | Expect                                                         |
| - | ------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------- |
| 1 | Live formatting, all 15 patterns (US1, SC-001) | `user.type` the documented raw input                        | value = documented format; `onValueChange(masked, unmasked)`   |
| 2 | Currency locales (US1 AS-3, FR-008)        | `mask="currency"` with USD/EUR·de-DE/GBP/JPY, and an unknown pair | matches `Intl.NumberFormat`; unknown pair falls back to USD/en-US |
| 3 | `withoutMask` / no mask (US1 AS-4, FR-006) | `user.type` arbitrary text                                     | passthrough, no reformatting                                   |
| 4 | Backspace mid-value (US2 AS-1, SC-002)     | `setSelectionRange`, `{Backspace}`                              | reformatted value **and** exact `selectionStart`               |
| 5 | Insert mid-value / before a literal (US2 AS-2/3) | `setSelectionRange`, `user.keyboard('4')`                 | value and `selectionStart` per upstream                        |
| 6 | Delete mid-value (US2 AS-4)                | `setSelectionRange`, `{Delete}`                                 | slot at caret removed, caret parked                            |
| 7 | Paste over a selection (US2 AS-5, FR-016)  | `user.paste` with a range selected                              | merged + reformatted; caret at last pasted slot                |
| 8 | Currency caret anchoring (US2 AS-6)        | edit mid-value in USD and EUR·de-DE                             | caret near the edit, not at the end                            |
| 9 | Five validation modes (US3, SC-003)        | type, then `user.tab()`                                         | fires/does not fire per the mode table                          |
| 10| Pattern `validate` boundaries (US3 AS-6)   | call `MASK_PATTERNS.*.validate` directly, fake timers for date  | documented booleans at each boundary                            |
| 11| Focus traversal + ARIA (US4, SC-004)       | `Tab` / `Shift+Tab`; render each state                          | focus moves; `aria-invalid`/`disabled`/`readonly`/`required` + `data-*` |
| 12| Guard rails (FR-012)                       | `disabled` / `readonly` + type, Backspace, paste                | value unchanged                                                 |
| 13| RTL (US4 AS-3, FR-019)                     | render inside `dir="rtl"`                                       | inherits direction, no own `dir`; masking/caret identical        |
| 14| Uncontrolled vs controlled (FR-002)        | `defaultValue`; `bind:value`; declining function binding        | seeds / follows / does not move on its own                      |
| 15| IME composition (FR-015)                   | `compositionstart` → `input` → `compositionend`                 | no `onValueChange` mid-composition; masked once it ends          |
| 16| `maxlength` / `inputmode` (FR-013/14)      | render `zipCode`, `phone`, `currency`                           | `maxlength="5"`, `inputmode="numeric"`, no `maxlength` for currency |
| 17| Placeholder swapping (FR-011)              | focus / blur across the five combinations                       | §6 of the contract                                              |
| 18| `child` snippet (FR-018)                   | render with a `child` snippet onto a custom input               | custom element renders; masking still applies                   |
| 19| Engine in isolation (US5, SC-005)          | import and call the exports; no `render()`                      | upstream return values                                          |

## Commands

Non-interactive only. Run in this order:

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
pnpm run registry:build
```

Focused iteration while implementing (still single-run):

```bash
pnpm run test:unit -- --run src/lib/components/ui/mask-input/mask-input.test.ts
```

`pnpm run registry:build` must be re-run after the `registry.json` entry is added; it writes
`static/r/mask-input.json`.

## Done when

- All 19 rows above pass, with zero `.skip` / `.todo` / `.only` and zero suppression comments.
- The four gates are green, plus `registry:build`.
- `/docs/components/mask-input` renders five working `<ComponentPreview>` sections plus a props
  table, and `pnpm run build` compiles that route.
- `registry.json` has exactly one new `registry:ui` item named `mask-input` listing all four source
  files (barrel, root, state module, engine) and **not** the two test files.
