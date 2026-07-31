# Quickstart / Validation Guide: Key Value

**Feature**: `024-port-key-value` | **Date**: 2026-07-31

How to prove the port works. Full prop semantics live in
[`contracts/public-api.md`](./contracts/public-api.md); state shapes live in
[`data-model.md`](./data-model.md).

---

## Prerequisites

```bash
pnpm install            # already done in this workspace
```

Node ≥ 20, pnpm. No new dependencies are introduced by this feature (research R-15).

---

## 1. Minimal usage

```svelte
<script lang="ts">
	import * as KeyValue from '$lib/components/ui/key-value/index.js';
</script>

<KeyValue.Root>
	<KeyValue.List>
		<!-- written once; rendered once per row -->
		<KeyValue.Item>
			<KeyValue.KeyInput />
			<KeyValue.ValueInput />
			<KeyValue.Remove />
		</KeyValue.Item>
	</KeyValue.List>
	<KeyValue.Add />
</KeyValue.Root>
```

Expected: one empty row; `Tab` into the key field puts a caret in it; typing then `Tab` moves to the
value field; **Add** appends a row and focuses its key field; **Remove** is enabled (default
`minItems` is `0`).

---

## 2. Automated validation

Run from the repository root, in this order.

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test:unit -- --run
pnpm run build
```

All five must be green with **zero** warnings and no suppressions (constitution Quality Gates).

To run only this component's suite while iterating:

```bash
pnpm run test:unit -- --run src/lib/components/ui/key-value/key-value.test.ts
```

---

## 3. Scenario checklist

Each row maps a spec scenario to the assertion that proves it. All of these live in
`src/lib/components/ui/key-value/key-value.test.ts` unless the "Where" column says otherwise.

| # | Scenario (spec)                              | Expected outcome                                                                              |
| - | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1 | US1.1 — type a key and a value               | Only the edited row's data changes; `onValueChange` fires with the whole array.               |
| 2 | US1.2 — add a row                            | A row is appended; its key field holds focus and is in edit mode.                             |
| 3 | US1.3 — remove a middle row                  | The row disappears, siblings keep their data, focus lands on the next row's key field.        |
| 4 | US1.3 — remove the last row                  | Focus lands on the **previous** row's key field.                                              |
| 5 | US1.4 — `minItems` reached                   | Every `KeyValue.Remove` is `disabled`; clicking changes nothing.                              |
| 6 | US1.5 — `maxItems` reached                   | `KeyValue.Add` is `disabled`; clicking adds nothing.                                          |
| 7 | US2.1 — paste `KEY=VALUE` block into an empty row | The empty row is replaced by one row per line; keys/values split on the first `=`.       |
| 8 | US2.2 — paste `KEY: VALUE` and tab-separated | Same splitting, per-line format priority `=` → `:` → `\s{2,}\|\t`.                            |
| 9 | US2.3 — paste into a non-empty row           | That row survives; parsed rows are inserted immediately after it.                             |
| 10| US2.4 — paste beyond `maxItems`              | Result is truncated to exactly `maxItems`.                                                    |
| 11| US2.5 — single-line paste                    | Not intercepted; `event.defaultPrevented === false`, row count unchanged.                     |
| 12| US2.6 — `enablePaste={false}`                | Multi-line paste is not intercepted; row count unchanged.                                     |
| 13| US3.1 — `onKeyValidate` fails                | `<KeyValue.Error field="key">` renders with `role="alert"`; the control is `aria-invalid` and `aria-describedby` points at that error's `id`. |
| 14| US3.2 — `onValueValidate` fails              | The value error renders independently of the key's validity.                                  |
| 15| US3.3 — duplicate key                        | The later row shows `"Duplicate key"`.                                                        |
| 16| US3.4 — `allowDuplicateKeys`                 | No duplicate error.                                                                           |
| 17| US3.5 — list-level validity                  | Root has `data-invalid` while any row errors; the attribute is absent once all clear.         |
| 18| Edge — two empty keys                        | No duplicate error (empty keys never collide).                                                |
| 19| Edge — remove clears the row's error         | `errors` no longer holds the removed id; no error resurfaces on a later row.                  |
| 20| Edge — neither `value` nor `defaultValue` given | Exactly one empty row is seeded; an explicit `defaultValue={[]}` renders zero rows and is not re-seeded. |
| 21| Controlled                                   | With `value` passed and no binding, interaction does **not** move the list; `onValueChange` still fires with the intended next value. |
| 22| Uncontrolled                                 | `defaultValue` seeds the list and interaction updates it.                                     |
| 23| `disabled` / `readOnly`                      | Add and Remove are `disabled`; no edit mode is entered; values stay visible; paste is inert.  |
| 24| Guard rails                                  | Rendering each part outside its provider throws `/within/`.                                   |
| 25| RTL                                          | With `dir="rtl"`, the root and each field carry `dir="rtl"`; parsing, validation and add/remove are byte-identical to LTR. |
| 26| Keyboard                                     | `Tab` → edit mode + selected text, `Enter` → submit, `Escape` → restore and leave edit mode.  |
| 27| Form                                         | Inside a `<form>` with `name="env"`, the submitted `FormData` entry equals `JSON.stringify(rows)`. Where: same file. |
| 28| Parsers                                      | `parseKeyValueText` / `stripSurroundingQuotes` unit-tested directly against the MDX's paste-format table. |
| 29| FR-013 — orientation | `data-orientation` flips with the prop; `role`s and Tab order are unchanged in both orientations; no `aria-orientation`. |
| 30| FR-019 — observation callbacks | `onAdd`/`onRemove` fire once with the affected row; `onPaste` fires once with the event and the parsed rows; none fire on a refused action. |

---

## 4. Manual validation — the demo route

```bash
pnpm run build            # must succeed, including the new route
```

Then inspect `src/routes/docs/components/key-value/+page.svelte`. It must contain exactly four
`<ComponentPreview>` sections, one per upstream demo file, plus the API tables:

| Section          | Upstream demo                    | What to try                                                     |
| ---------------- | -------------------------------- | ----------------------------------------------------------------- |
| Default          | `key-value-demo.tsx`             | Add, fill, remove.                                                |
| With Paste Support | `key-value-paste-demo.tsx`     | Paste the three-line `KEY=VALUE` block shown in the callout.      |
| With Validation  | `key-value-validation-demo.tsx`  | Seeded with `API_KEY` / `invalid key` / `DATABASE_URL`; fix and break the rules. |
| With Form        | `key-value-form-demo.tsx`        | Submit; a toast shows the JSON payload; empty keys block submit.  |

Followed by a props table per part and the keyboard-interactions table, matching the layout of
`src/routes/docs/components/editable/+page.svelte`.

---

## 5. Registry validation

```bash
pnpm run registry:build
```

Expected: `static/r/key-value.json` is produced, listing all eleven source files of
`src/lib/components/ui/key-value/` (everything except `key-value.test.ts` and
`key-value.test.svelte`), with `registryDependencies: ["editable", "button", "direction-provider",
"checkbox-group"]` and `dependencies: ["@lucide/svelte"]`.

The verify step (commit `4f81f61`) fails if any cross-component import lacks its
`registryDependency`, so this doubles as the check that no undeclared `$lib/components/ui/*` import
crept in.
