# Public API Contract: Stepper

**Feature**: `031-port-stepper` | Derived from
`.reference/diceui/docs/registry/bases/radix/ui/stepper.tsx` and
`.reference/diceui/docs/types/radix/stepper.ts` at the pinned commit.

Every part below:

- extends `WithElementRef<HTMLAttributes<E>>` (or the button/span equivalent), so `ref` is
  `$bindable(null)` and `...restProps` is spread onto the rendered element;
- accepts `class`, destructured as `class: className` and merged **last** through `cn()`;
- accepts `children: Snippet` unless stated otherwise;
- accepts `child?: Snippet<[{ props: … }]>` replacing upstream's `asChild` (research R-07);
- carries `data-slot="stepper-<part>"`.

Only `Stepper.Root`'s `value` is `$bindable`. No other prop is bindable, and `ref` is bindable on
every part.

---

## `Stepper.Root` — `stepper.svelte`

Element: `<div>` · `data-slot="stepper"`

| Prop              | Type                                                                      | Default        | Bindable | Upstream        |
| ----------------- | ------------------------------------------------------------------------- | -------------- | :------: | --------------- |
| `value`           | `string`                                                                  | —              |  **yes** | `value`         |
| `defaultValue`    | `string`                                                                  | `''`           |    no    | `defaultValue`  |
| `activationMode`  | `'automatic' \| 'manual'`                                                 | `'automatic'`  |    no    | `activationMode` |
| `dir`             | `'ltr' \| 'rtl'`                                                          | resolved       |    no    | `dir`           |
| `orientation`     | `'horizontal' \| 'vertical'`                                              | `'horizontal'` |    no    | `orientation`   |
| `disabled`        | `boolean`                                                                 | `false`        |    no    | `disabled`      |
| `loop`            | `boolean`                                                                 | `false`        |    no    | `loop`          |
| `nonInteractive`  | `boolean`                                                                 | `false`        |    no    | `nonInteractive` |
| `id`              | `string`                                                                  | `$props.id()`  |    no    | `id`            |
| `ref`             | `HTMLDivElement \| null`                                                  | `null`         |  **yes** | `forwardRef`    |

`dir` default: resolved through `useDirection()` as `dir ?? nearest <DirectionProvider> ?? DOM
[dir] ?? 'ltr'` (research R-08).

**Callbacks**

| Callback          | Signature                                                                    | Fires when                                                       |
| ----------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `onValueChange`   | `(value: string) => void`                                                    | The active step actually changes (no-op writes do not fire it).  |
| `onValueComplete` | `(value: string, completed: boolean) => void`                                | A registered step's `completed` flag flips.                      |
| `onValueAdd`      | `(value: string) => void`                                                    | A `Stepper.Item` registers.                                      |
| `onValueRemove`   | `(value: string) => void`                                                    | A `Stepper.Item` unregisters.                                    |
| `onValidate`      | `(value: string, direction: 'next' \| 'prev') => boolean \| Promise<boolean>` | Before a **forward** commit. `false` or a rejection blocks it.   |

**Snippets**: `children`, `child`.

**Data attributes**: `data-orientation="horizontal|vertical"`, `data-disabled` (present only when
`disabled`). Also renders `dir`.

---

## `Stepper.List` — `stepper-list.svelte`

Element: `<div role="tablist">` · `data-slot="stepper-list"`

No own props beyond the shared set. Owns the roving-focus group.

**ARIA**: `role="tablist"`, `aria-orientation` = the root orientation, `tabindex` = `0` unless it is
being tabbed back out of or has no focusable trigger, then `-1`.

**Data attributes**: `data-orientation`.

**Events handled**: `onfocusin` (entry focus, selection-priority candidate order), `onfocusout`
(clears the shift-tab latch), `onmousedown` (marks the next focus as pointer-driven).

---

## `Stepper.Item` — `stepper-item.svelte`

Element: `<div>` · `data-slot="stepper-item"`

| Prop        | Type      | Default | Bindable | Upstream    |
| ----------- | --------- | ------- | :------: | ----------- |
| `value`     | `string`  | —       |    no    | `value` (**required**) |
| `completed` | `boolean` | `false` |    no    | `completed` |
| `disabled`  | `boolean` | `false` |    no    | `disabled`  |

Registers/updates/unregisters the step in the root's registry, firing `onValueAdd`,
`onValueComplete` and `onValueRemove`. Publishes the item context.

**Data attributes**: `data-state="inactive|active|completed"`, `data-orientation`, `data-disabled`.

---

## `Stepper.Trigger` — `stepper-trigger.svelte`

Element: `<button type="button" role="tab">` · `data-slot="stepper-trigger"`

| Prop       | Type      | Default              | Bindable | Upstream   |
| ---------- | --------- | -------------------- | :------: | ---------- |
| `disabled` | `boolean` | `undefined`          |    no    | `disabled` |

Effective disabled = `disabled || step.disabled || root.disabled`.

**ARIA**: `role="tab"`, `aria-controls={contentId}`, `aria-current={isActive ? 'step' : undefined}`,
`aria-describedby={"<titleId> <descriptionId>"}` (always both — research R-11),
`aria-posinset={position}`, `aria-setsize={stepCount}`, `aria-selected={isActive}`,
`tabindex={isTabStop ? 0 : -1}`, `id={`${rootId}-trigger-${value}`}`.

**Keyboard** (all via `userEvent` in tests):

| Key                              | Behaviour                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `ArrowRight` / `ArrowDown`       | Move focus to the next enabled trigger (`next` intent).                              |
| `ArrowLeft` / `ArrowUp`          | Move focus to the previous enabled trigger (`prev` intent).                          |
| `Home` / `PageUp`                | Move focus to the first enabled trigger.                                             |
| `End` / `PageDown`               | Move focus to the last enabled trigger.                                              |
| `Enter` / `Space`                | Manual activation mode only: activates the focused step. Suppressed when `nonInteractive`. |
| `Shift + Tab`                    | Latches the list's tab stop so focus leaves the group.                               |

Arrow keys perpendicular to `orientation` are ignored. `ArrowLeft`/`ArrowRight` swap under
`dir="rtl"`. A held `Meta`/`Ctrl`/`Alt`/`Shift` suppresses navigation **and** `preventDefault()`.
In `automatic` activation mode, arrival of keyboard focus also activates the step (subject to
`onValidate`).

**Data attributes**: `data-state`, `data-disabled`.

**Note**: a `child`-rendered trigger cannot self-register with the roving-focus collection; `ref`
stays `null` and the caller owns the element (research R-07).

---

## `Stepper.Indicator` — `stepper-indicator.svelte`

Element: `<div>` · `data-slot="stepper-indicator"`

| Prop       | Type                            | Default | Bindable | Upstream   |
| ---------- | ------------------------------- | ------- | :------: | ---------- |
| `children` | `Snippet<[StepperDataState]>`   | —       |    no    | `children` (node **or** render fn) |

Upstream's `ReactNode | ((dataState) => ReactNode)` union collapses to one snippet that always
receives the data state — the render-prop translation in `CLAUDE.md` §10. When `children` is absent
the default content is a `Check` icon from `@lucide/svelte` for a completed step, otherwise the
1-based step position.

**Data attributes**: `data-state`.

---

## `Stepper.Separator` — `stepper-separator.svelte`

Element: `<div role="separator" aria-hidden="true">` · `data-slot="stepper-separator"`

| Prop         | Type      | Default | Bindable | Upstream                          |
| ------------ | --------- | ------- | :------: | --------------------------------- |
| `forceMount` | `boolean` | `false` |    no    | `forceMount` (source only, R-12)  |

Renders nothing after the **last** registered step unless `forceMount`. Its `data-state` uses the
`'separator'` variant, so the separator belonging to the *active* step is `inactive`, not `active`.

**ARIA**: `aria-orientation` = the root orientation.

**Data attributes**: `data-state`, `data-orientation`.

---

## `Stepper.Title` — `stepper-title.svelte`

Element: `<span>` · `data-slot="stepper-title"` (renamed from upstream's bare `title` — R-10)

No own props. `id={`${rootId}-title-${itemValue}`}` — the first half of the trigger's
`aria-describedby`.

---

## `Stepper.Description` — `stepper-description.svelte`

Element: `<span>` · `data-slot="stepper-description"` (renamed from upstream's bare `description`)

No own props. `id={`${rootId}-description-${itemValue}`}`.

---

## `Stepper.Content` — `stepper-content.svelte`

Element: `<div role="tabpanel">` · `data-slot="stepper-content"`

| Prop         | Type      | Default | Bindable | Upstream               |
| ------------ | --------- | ------- | :------: | ---------------------- |
| `value`      | `string`  | —       |    no    | `value` (**required**) |
| `forceMount` | `boolean` | `false` |    no    | `forceMount`           |

Renders only while `value === root.value`, unless `forceMount`. Lives **outside** `Stepper.Item`, so
it reads the root context only.

**ARIA**: `role="tabpanel"`, `aria-labelledby={triggerId}`, `id={contentId}`.

---

## `Stepper.Prev` — `stepper-prev.svelte`

Element: `<button type="button">` · `data-slot="stepper-prev"`

| Prop       | Type      | Default     | Bindable | Upstream   |
| ---------- | --------- | ----------- | :------: | ---------- |
| `disabled` | `boolean` | `undefined` |    no    | `disabled` |

Effective disabled = `disabled || activeIndex <= 0`. Moves back exactly one step. **Never** consults
`onValidate` (upstream 1199).

Renders an unstyled `<button>`, exactly as upstream — compose `Button` through the `child` snippet
for a styled control.

---

## `Stepper.Next` — `stepper-next.svelte`

Element: `<button type="button">` · `data-slot="stepper-next"`

| Prop       | Type      | Default     | Bindable | Upstream   |
| ---------- | --------- | ----------- | :------: | ---------- |
| `disabled` | `boolean` | `undefined` |    no    | `disabled` |

Effective disabled = `disabled || activeIndex >= stepCount - 1`. Moves forward exactly one step,
**through** `onValidate` (upstream 1242).

---

## Barrel — `index.ts`

```ts
export {
	Root, List, Item, Trigger, Indicator, Separator, Title, Description, Content, Prev, Next,
	//
	Root as Stepper,
	List as StepperList,
	Item as StepperItem,
	Trigger as StepperTrigger,
	Indicator as StepperIndicator,
	Separator as StepperSeparator,
	Title as StepperTitle,
	Description as StepperDescription,
	Content as StepperContent,
	Prev as StepperPrev,
	Next as StepperNext
};
```

Prop types exported (one per part): `StepperRootProps`, `StepperProps` (alias),
`StepperListProps`, `StepperItemProps`, `StepperTriggerProps`, `StepperIndicatorProps`,
`StepperSeparatorProps`, `StepperTitleProps`, `StepperDescriptionProps`, `StepperContentProps`,
`StepperPrevProps`, `StepperNextProps`.

Runtime + type exports from `stepper.svelte.ts`: `STEPPER_ORIENTATIONS`,
`STEPPER_ACTIVATION_MODES`, `STEPPER_DATA_STATES`, `StepperRootState`, `StepperItemState`,
`StepperFocusState`, `getStepperContext`, `setStepperContext`, `getStepperItemContext`,
`setStepperItemContext`, `getStepperFocusContext`, `setStepperFocusContext`, `getStepperId`,
`getStepperDataState`, `getStepperFocusIntent`, and the types `StepperOrientation`,
`StepperActivationMode`, `StepperDataState`, `StepperNavigationDirection`, `StepperFocusIntent`,
`StepperRootStateProps`, `StepperItemStateProps`, `StepperFocusStateProps`, `StepperTriggerMeta`.

**Not ported**: upstream's `useStore as useStepper` export — an internal store selector with no
documented API surface (recorded in `spec.md` Assumptions). Svelte consumers read the same state
through `getStepperContext()`, which **is** exported.

---

## Shared module exported for later ports

This port exports `StepperFocusState` from the barrel, but **does not** promote it to a
cross-component module: its candidate logic is entangled with `onValidate` and selection-follows-
focus, which no other component needs. The genuinely reusable pieces were consumed, not created —
`DomOrderedCollection` (from `speed-dial`) and `focusFirst` / `wrapArray` / `getDirectionAwareKey`
(from `action-bar`). See research R-04.
