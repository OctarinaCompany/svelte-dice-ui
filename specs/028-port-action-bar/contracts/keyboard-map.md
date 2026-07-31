# Contract: Action Bar keyboard & ARIA map

The behaviour floor for `src/lib/components/ui/action-bar/action-bar.test.ts`. Source: the
`KeyboardShortcutsTable` in `.reference/diceui/docs/content/docs/components/radix/action-bar.mdx`
plus `action-bar.tsx` lines 162-178 (Escape) and 505-556 (navigation). Upstream ships **no** test file
for this component, so this matrix — not a ported spec — is the assertion floor (research R-20).

## Roles, ARIA and accessible names

| Element              | Assertion                                                                              | Requirement |
| -------------------- | -------------------------------------------------------------------------------------- | ----------- |
| Root                 | `role="toolbar"`, `aria-orientation` equals `orientation`, `dir` equals resolved dir     | FR-001, FR-005, FR-007 |
| Root                 | `data-slot="action-bar"`, `data-side`, `data-align`, `data-orientation` reflect props   | FR-007      |
| Root                 | Mounted inside the portal container (default `document.body`), not inside the render container | FR-001 |
| Group                | `role="group"`, `data-slot="action-bar-group"`, `data-orientation`                       | FR-010      |
| Item                 | Native `<button type="button">`, accessible name from its content, `data-slot="action-bar-item"` | FR-011, SC-006 |
| Item (disabled)      | `disabled` attribute present; excluded from navigation and from `focusableCount`         | FR-011      |
| Close                | Native `<button type="button">`, `data-slot="action-bar-close"`, own tab stop, non-empty accessible name | FR-012, SC-006 |
| Separator            | `role="separator"`, `aria-hidden="true"`, `aria-orientation`, `data-slot="action-bar-separator"` | FR-013 |
| Selection            | `data-slot="action-bar-selection"`, renders arbitrary children                            | FR-009      |

## Key map — horizontal orientation, `dir="ltr"`

| Key           | Focus location   | Expected behaviour                                                                          | Requirement |
| ------------- | ---------------- | -------------------------------------------------------------------------------------------- | ----------- |
| `Tab`         | before the bar   | Focus lands on the **group** (one stop), not on each item                                     | FR-010, US3-1 |
| `Tab`         | group entry      | Group's `focusin` focuses the current tab-stop item, or the first enabled item on first entry | FR-010      |
| `Tab`         | an item          | Focus leaves the group and lands on the close button (next tab stop)                          | FR-012      |
| `Shift`+`Tab` | an item          | `isTabbingBackOut = true` → group `tabindex` becomes `-1`; focus leaves the bar               | Edge case   |
| `focusout`    | group            | `isTabbingBackOut = false` → group `tabindex` returns to `0`                                  | Edge case   |
| `ArrowRight`  | an item          | Focus the next enabled item; wraps to the first when `loop` (default), stops at the last when `loop={false}` | FR-010, US3-2 |
| `ArrowLeft`   | an item          | Focus the previous enabled item; wraps to the last when `loop`, stops at the first otherwise  | FR-010, US3-2 |
| `ArrowUp` / `ArrowDown` | an item | No focus movement (wrong axis)                                                                | FR-010      |
| `Home`        | an item          | Focus the first enabled item                                                                   | FR-010, US3-5 |
| `End`         | an item          | Focus the last enabled item                                                                    | FR-010, US3-5 |
| `Escape`      | anywhere         | `onEscapeKeyDown` fires; unless default-prevented, `onOpenChange(false)` and the bar unmounts  | FR-006, US3-6 |
| `Enter`       | an item          | Native click → `onSelect` fires → bar closes unless `preventDefault()`                        | FR-011, R-13 |
| `Space`       | an item          | Same as `Enter`                                                                                | FR-011, R-13 |
| any arrow with `Meta`/`Ctrl`/`Alt`/`Shift` | an item | No navigation, no `preventDefault()`                                            | R-10 step 5 |

## Key map — vertical orientation (`orientation="vertical"`)

| Key                     | Expected behaviour                              |
| ----------------------- | ----------------------------------------------- |
| `ArrowDown`             | Next enabled item (wrap per `loop`)             |
| `ArrowUp`               | Previous enabled item (wrap per `loop`)         |
| `ArrowLeft`/`ArrowRight`| No movement (wrong axis)                        |
| `Home` / `End`          | First / last enabled item                       |

The group also renders `w-full flex-col items-start` and each item gets `w-full` (FR-004, US2-3).

## Key map — `dir="rtl"`, horizontal

| Key          | Expected behaviour                                     | Requirement |
| ------------ | ------------------------------------------------------ | ----------- |
| `ArrowLeft`  | Behaves as `ArrowRight` in LTR → **next** enabled item  | FR-015, US3-4 |
| `ArrowRight` | Behaves as `ArrowLeft` in LTR → **previous** enabled item | FR-015, US3-4 |
| `Home`/`End` | Unchanged (first / last in document order)              | FR-015      |

`dir` must be exercised both ways: explicit `dir="rtl"` prop, and inherited from a
`<DirectionProvider dir="rtl">` ancestor (FR-005).

## Disabled-item skipping

| Scenario                                            | Expected                                                           | Requirement |
| --------------------------------------------------- | ------------------------------------------------------------------ | ----------- |
| Middle item disabled, `ArrowRight` from the first    | Focus jumps to the third item                                       | US3-7       |
| First item disabled, `Home`                          | Focus the first **enabled** item                                    | US3-7       |
| Last item disabled, `End`                            | Focus the last **enabled** item                                     | US3-7       |
| All items disabled                                   | Group `tabindex="-1"`; `Tab` skips the group entirely               | Edge case   |
| `mousedown` on a disabled item                       | `preventDefault()`; tab stop unchanged                              | FR-011      |

## Controlled / uncontrolled

| Scenario                                                                    | Expected                                                                   | Requirement |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------- |
| `open` supplied, no binding, `onOpenChange` spy                              | Activating an item calls `onOpenChange(false)`; the bar stays mounted because the parent did not change `open` | FR-002, US1-3 |
| `bind:open`                                                                  | Activating an item sets the parent's variable to `false` and unmounts        | FR-002      |
| `defaultOpen` only                                                           | Bar starts open and closes on item activation / close click / `Escape`       | FR-002, R-16 |
| Neither `open` nor `defaultOpen`                                             | Bar is not in the document                                                   | US1-1       |
| `onSelect` calls `preventDefault()`                                          | `onOpenChange` is **not** called; the bar stays open                         | Edge case   |
| Close button's `onclick` calls `preventDefault()`                            | `onOpenChange` is **not** called                                             | Edge case   |
| `onEscapeKeyDown` calls `preventDefault()`                                   | `onOpenChange` is **not** called                                             | Edge case   |

## Positioning

| Props                                              | Expected inline style                        | Requirement |
| -------------------------------------------------- | -------------------------------------------- | ----------- |
| defaults                                           | `bottom: 16px; left: 50%; translate: -50% 0` | FR-003      |
| `side="top"`                                       | `top: 16px; …`                               | US2-1       |
| `align="start"`, `alignOffset={24}`                | `left: 24px` (no `translate`)                | US2-2       |
| `align="end"`, `alignOffset={24}`                  | `right: 24px`                                | FR-003      |
| `sideOffset={0}`                                   | `bottom: 0px`                                | FR-003      |
| caller `style` supplied                            | Caller declarations win (applied last)       | FR-003      |

## Guard rails

| Scenario                                                             | Expected                                                                  | Requirement |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------- |
| `<ActionBar.Group>` with no `<ActionBar>`                            | throws `/must be used within/` naming `<ActionBar.Group>` and `<ActionBar>` | FR-014      |
| `<ActionBar.Item>` with no `<ActionBar>`                             | throws naming `<ActionBar.Item>` and `<ActionBar>`                         | FR-014      |
| `<ActionBar.Item>` inside `<ActionBar>` but outside `<ActionBar.Group>` | throws naming `<ActionBar.Item>` and `<ActionBar.Group>`                | FR-014, R-14 |
| `<ActionBar.Close>` with no `<ActionBar>`                            | throws naming `<ActionBar.Close>` and `<ActionBar>`                        | FR-014      |
| `<ActionBar.Separator>` with no `<ActionBar>`                        | throws naming `<ActionBar.Separator>` and `<ActionBar>`                    | FR-014      |

## Portal

| Scenario                                    | Expected                                                       | Requirement |
| ------------------------------------------- | --------------------------------------------------------------- | ----------- |
| default                                     | Toolbar is a descendant of `document.body`, outside the container | FR-001      |
| `portalContainer` = a custom element         | Toolbar mounts inside that element                              | FR-001      |
| `portalContainer={null}`                     | Toolbar mounts into `document.body` (research R-03)             | FR-001      |
| `open` → `false`                             | Toolbar is removed synchronously; the `keydown` listener is gone | FR-001, FR-006 |

## Pure-helper unit assertions (shared modules, FR-016)

| Function                                                          | Assertions                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `getViewportEdgeStyle`                                            | One case per row of the Positioning table                                       |
| `getDirectionAwareKey`                                            | Swaps only the two horizontal arrows, only under `rtl`                          |
| `wrapArray`                                                       | Rotation is order-preserving and total; `startIndex` beyond length wraps modulo |
| `getFocusIntent`                                                  | Full key × orientation × dir truth table, `undefined` for unrelated keys        |
| `focusFirst`                                                      | Skips a detached candidate; no-op when the active element is already a candidate |
