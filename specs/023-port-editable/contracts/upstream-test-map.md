# Contract: Upstream test assertions → our test cases

**Feature**: `023-port-editable`
**Upstream spec**: `.reference/diceui/docs/registry/bases/radix/test/editable.test.tsx` (15 tests)

Constitution III: "the upstream test file's assertions are the floor, not the ceiling." Every upstream
test maps to at least one case in `src/lib/components/ui/editable/editable.test.ts`. Nothing is
dropped. Interaction is driven through `@testing-library/user-event` rather than upstream's
`fireEvent` (R-16); the one exception is noted.

## 1. Mapping

| #  | Upstream test                        | Its assertions                                                                                                 | Our case(s)                                                                                                          |
| -- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1  | `renders without crashing`           | label text present                                                                                              | `renders the composed parts` — label, area (`role="group"`), preview (`role="button"`), no `textbox` yet               |
| 2  | `handles controlled state`           | preview text; no textbox; click → `onEdit`, `onEditingChange(true)`; textbox has value; preview gone; type → `onValueChange`; submit click → `onSubmit('New Value')`, `onEditingChange(false)`; preview back | split into `enters edit mode on click`, `commits through the submit button`, plus `controlled value stays with the parent` and `controlled editing stays with the parent` (function bindings — beyond upstream) |
| 3  | `handles cancellation`               | type → `onValueChange`; cancel click → `onCancel`; preview shows the ORIGINAL value; no textbox                  | `cancel reverts to the value edit mode started with` + `cancel restores focus to the trigger` (D-1, beyond upstream)   |
| 4  | `handles keyboard navigation`        | `Enter` in input → `onSubmit`; re-enter; `Escape` → `onCancel`                                                  | `Enter in the input submits`, `Escape in the input cancels`, plus `Enter on the preview enters edit mode` (FR-008)     |
| 5  | `handles disabled state`             | preview has `data-disabled=""`; click → no `onEdit`, no textbox                                                 | `disabled suppresses every interaction` — also asserts label/area `data-disabled` and that the submit/cancel no-op     |
| 6  | `handles read-only state`            | no preview button; textbox present with `readonly`; change → no `onValueChange`                                 | `readOnly always shows an inert input`                                                                                 |
| 7  | `handles placeholder`                | preview shows the placeholder and has `data-empty=""`                                                           | `an empty value shows the placeholder with data-empty` — also asserts the input's native `placeholder`                 |
| 8  | `handles maxLength` (upstream asserts nothing but presence) | input rendered                                                                             | `maxLength caps the input` — asserts `maxlength="10"` on the input, which upstream could not because of D-2            |
| 9  | `handles autosize`                   | input has class `w-auto`                                                                                        | `autosize switches the input to width-auto` (plus the default asserts `w-full`)                                        |
| 10 | `handles different trigger modes`    | `dblclick` mode: single click no-op, double click edits; `focus` mode: focus edits                              | `triggerMode="dblclick"`, `triggerMode="focus"`, and `triggerMode="click"` (default) — one case each                   |
| 11 | `handles external trigger`           | trigger click → `onEdit`                                                                                        | `an external trigger enters edit mode`, `the trigger unmounts while editing`, `forceMount keeps the trigger mounted`   |
| 12 | `supports RTL direction`             | area and input carry `dir="rtl"`                                                                                | `renders dir=rtl on the area and the input` + a `<DirectionProvider dir="rtl">` case (composition, beyond upstream)    |
| 13 | `handles form integration`           | form submit handler fires                                                                                       | `submits its value with the enclosing form` — asserts the clipped input's `name`/`value`; plus `an empty required field blocks form submission` (reachable only because of D-5) |
| 14 | `handles invalid state`              | label `data-invalid=""`; input `aria-invalid="true"`                                                            | `invalid is reflected on the label and the input`                                                                      |
| 15 | `handles blur submission`            | type, blur → `onSubmit('New Value')`                                                                            | `blur submits`, `blur toward the cancel button does not submit`, `blur toward the trigger does not submit` (R-15)      |
| 15b| `handles escape key down callback`   | `onEscapeKeyDown` called; `onCancel` called                                                                     | `onEscapeKeyDown runs before cancel` + `onEscapeKeyDown preventDefault suppresses cancel` (FR-009)                     |
| —  | `handles required state`             | label `data-required=""`; input `required`                                                                      | `required is reflected on the label and the input`                                                                     |

## 2. Cases with no upstream counterpart (required by CLAUDE.md §7 / the spec)

| Case                                                                    | Requirement           |
| ----------------------------------------------------------------------- | --------------------- |
| Entering edit mode focuses the input and selects its whole content      | FR-005, SC-002        |
| `Escape` returns focus to the preview / external trigger                | FR-007, SC-003, D-1   |
| `onEnterKeyDown` runs before the preview's edit, and `preventDefault()` suppresses it | FR-008  |
| Uncontrolled: `defaultValue` + `defaultEditing` seed the component      | FR-002                |
| Controlled: a declining function binding keeps the rendered value/edit state put | FR-002, R-02  |
| Submitting an unchanged value still calls `onSubmit` and exits edit mode | FR-006, Edge Cases    |
| `onValueChange` does **not** fire when the value did not change         | R-01 (upstream guard) |
| Each of the 8 non-root parts rendered with no root throws `/within/`     | FR-018                |
| Toolbar `orientation="vertical"` sets `aria-orientation` and `flex-col`  | FR-015                |
| `child` snippet renders a `<Button>` and the part still behaves (incl. the blur guard finding `data-slot` on it) | D-6, R-10, R-15 |
| Every part carries its documented `data-slot`                           | Constitution VIII     |

## 3. Deliberate deviations from the upstream test file

| Upstream technique                                    | Here                                                                     | Why                                                                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `global.requestAnimationFrame = (fn) => setTimeout(fn, 0)` | not mocked                                                            | jsdom implements rAF; `tests/setup.ts` already shims what is genuinely missing. The focus assertion awaits it via `vi.waitFor`. |
| `fireEvent.change(input, { target: { value } })`      | `await user.clear(input)` + `await user.type(input, …)`                    | Constitution III mandates `user-event`. It also produces real `input` events, which is what our `oninput` handler binds. |
| `fireEvent.blur(input)`                               | `await user.click(<other element>)` / `await user.tab()`                   | Only a real gesture carries `relatedTarget`, which R-15's guard reads. `fireEvent.blur` is retained for exactly one case: asserting the `relatedTarget === null` blur still submits. |
| `fireEvent.click` on the read-only preview            | `screen.queryByRole('button', { name: /…/ })` returns `null`               | Same assertion, expressed as absence.                                                                             |
| `test("handles maxLength")` asserts nothing about maxLength | asserts `maxlength="10"`                                              | Upstream's own comment says it skipped the assertion; D-2 makes it meaningful here.                               |
| `ResizeObserver` / pointer-capture / `scrollIntoView` mocks | already in `tests/setup.ts`                                           | Repo-wide setup; no per-file mock needed.                                                                          |

## 4. Harness modes (`editable.test.svelte`)

| Mode                                          | Renders                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| `default`                                     | Label + Area(Preview, Input) + Toolbar(Cancel, Submit) — upstream's `renderEditable` |
| `with-trigger`                                | `default` plus an external `Trigger` outside the Area                       |
| `with-form`                                   | `default` wrapped in a `<form>` with a native submit button                 |
| `child-buttons`                               | Trigger / Submit / Cancel rendered through `child` onto `<Button>`          |
| `with-direction-provider`                     | `default` inside `<DirectionProvider dir="rtl">`                             |
| `bare-label` … `bare-submit` (8 modes)        | one part with no `Editable.Root` ancestor — the FR-018 throw cases          |

Binding modes on the `default` composition: `none` (uncontrolled), `value` (`bind:value`),
`editing` (`bind:editing`), `function` (authoritative getter/setter pair that declines writes).
