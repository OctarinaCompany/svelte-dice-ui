# Phase 1 Data Model: Stepper

**Feature**: `031-port-stepper` | **Date**: 2026-07-31

All types live in `src/lib/components/ui/stepper/stepper.svelte.ts` unless noted. Everything named
here is exported from the barrel.

---

## 1. Value types

```ts
/** Every value `orientation` accepts, in upstream declaration order. */
export const STEPPER_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export type StepperOrientation = (typeof STEPPER_ORIENTATIONS)[number];

/** Every value `activationMode` accepts. Upstream `ActivationMode` (stepper.tsx:34). */
export const STEPPER_ACTIVATION_MODES = ['automatic', 'manual'] as const;
export type StepperActivationMode = (typeof STEPPER_ACTIVATION_MODES)[number];

/** The `data-state` a step, trigger, indicator or separator reports. Upstream `DataState` (35). */
export const STEPPER_DATA_STATES = ['inactive', 'active', 'completed'] as const;
export type StepperDataState = (typeof STEPPER_DATA_STATES)[number];

/** Which way a requested step change travels. Upstream `NavigationDirection` (33). */
export type StepperNavigationDirection = 'next' | 'prev';

/** Where a navigation key wants focus to land. Upstream `FocusIntent` (55). */
export type StepperFocusIntent = 'first' | 'last' | 'prev' | 'next';
```

`Direction` (`'ltr' | 'rtl'`) is re-used from
`$lib/components/ui/direction-provider/index.js`, not redeclared.

---

## 2. Entities

### 2.1 `StepRegistration` — one registered step

Upstream `StepState` (`stepper.tsx:135-139`). Held in `StepperRootState`'s `SvelteMap`, keyed by
`value`, in `StepperItem` mount order.

| Field       | Type      | Source                          | Notes                                              |
| ----------- | --------- | ------------------------------- | -------------------------------------------------- |
| `value`     | `string`  | `StepperItem.value`             | Unique key. Also the map key.                      |
| `completed` | `boolean` | `StepperItem.completed`         | Explicit flag; wins over positional derivation.    |
| `disabled`  | `boolean` | `StepperItem.disabled`          | Blocks activation and roving-focus arrival.        |

**Lifecycle**: registered from `StepperItem`'s `$effect` (fires `onValueAdd`), updated in place when
`completed`/`disabled` change (fires `onValueComplete` **only** when `completed` actually flips —
upstream `setStep`, 311-323), unregistered on teardown (fires `onValueRemove`).

### 2.2 `StepperRootState` — one per `<Stepper.Root>`

Replaces upstream's `Store` + `StoreState` + `StepperContextValue` (141-227, 250-354).

**Constructor props** (all reactive inputs are getter functions, per `CLAUDE.md` §4):

```ts
export type StepperRootStateProps = {
	readonly getValue: () => string;
	readonly setValue: (value: string) => void;
	readonly getOrientation: () => StepperOrientation;
	readonly getActivationMode: () => StepperActivationMode;
	readonly getDisabled: () => boolean;
	readonly getNonInteractive: () => boolean;
	readonly getLoop: () => boolean;
	readonly getDir: () => Direction;
	readonly getOnValidate: () =>
		| ((value: string, direction: StepperNavigationDirection) => boolean | Promise<boolean>)
		| undefined;
	readonly getOnValueComplete: () => ((value: string, completed: boolean) => void) | undefined;
	readonly getOnValueAdd: () => ((value: string) => void) | undefined;
	readonly getOnValueRemove: () => ((value: string) => void) | undefined;
	/** The `id ?? $props.id()` every part's element id is derived from. */
	readonly getRootId: () => string;
};
```

**Reactive surface**:

| Member                              | Kind           | Upstream                    |
| ----------------------------------- | -------------- | --------------------------- |
| `value`                             | `$derived`     | `StoreState.value`          |
| `orientation` `activationMode` `disabled` `nonInteractive` `loop` `dir` `rootId` | `$derived` | `StepperContextValue` (190-198) |
| `steps`                             | `SvelteMap`    | `StoreState.steps`          |
| `stepKeys: readonly string[]`        | `$derived`     | `Array.from(steps.keys())`  |
| `stepCount: number`                 | `$derived`     | `steps.size`                |
| `activeIndex: number`               | `$derived`     | `stepKeys.indexOf(value)`   |
| `canGoPrev: boolean`                | `$derived`     | `!(currentIndex <= 0)` (1188) |
| `canGoNext: boolean`                | `$derived`     | `!(currentIndex >= len-1)` (1231) |
| `#validationGeneration: number`     | plain field    | *new* (research R-05)       |

**Methods**:

| Method                                          | Returns            | Upstream                    |
| ----------------------------------------------- | ------------------ | --------------------------- |
| `addStep(value, completed, disabled)`           | `void`             | `addStep` (300-305)         |
| `setStep(value, completed, disabled)`           | `void`             | `setStep` (311-323)         |
| `removeStep(value)`                             | `void`             | `removeStep` (306-310)      |
| `hasValidation()`                               | `boolean`          | `hasValidation` (299)       |
| `setValue(next)`                                | `void`             | `setState('value', …)` (272-282) |
| `setValueWithValidation(next, direction)`       | `Promise<boolean>` | `setStateWithValidation` (283-298) |
| `directionTo(targetValue)`                      | `StepperNavigationDirection` | inline `targetIndex > currentIndex ? 'next' : 'prev'` (773-775, 807-809, 890-897) |
| `indexOf(stepValue)` / `positionOf(stepValue)`  | `number`           | `stepIndex` / `stepIndex + 1` (709-711) |
| `dataStateFor(stepValue, variant?)`             | `StepperDataState` | `getDataState` (110-133)    |
| `goPrev()`                                      | `void`             | `StepperPrev.onClick` (1190-1202) |
| `goNext()`                                      | `Promise<void>`    | `StepperNext.onClick` (1233-1245) |

`setValue` is a no-op when `next === value` (upstream's `Object.is` guard, 273) — this is what keeps
`onValueChange` from firing on a re-click of the active step.

### 2.3 `StepperItemState` — one per `<Stepper.Item>`

Replaces upstream `StepperItemContextValue` (587-590).

| Member       | Kind       | Notes                                                       |
| ------------ | ---------- | ----------------------------------------------------------- |
| `value`      | `$derived` | The step's identifier.                                      |
| `step`       | `$derived` | `root.steps.get(value)` — `undefined` before registration.  |
| `disabled`   | `$derived` | `step?.disabled ?? ownDisabled`                             |
| `dataState`  | `$derived` | `root.dataStateFor(value)`                                  |
| `position`   | `$derived` | 1-based, `root.positionOf(value)`                           |
| `triggerId` `contentId` `titleId` `descriptionId` | `$derived` | `getStepperId(root.rootId, variant, value)` |

### 2.4 `StepperFocusState` — one per `<Stepper.List>`

Replaces upstream `FocusContextValue` + the `StepperList` body (379-400, 424-555). See research R-04
for why this is bespoke rather than `RovingFocusGroupState`.

| Member                                     | Kind         | Upstream                       |
| ------------------------------------------ | ------------ | ------------------------------ |
| `items: DomOrderedCollection<TriggerMeta>` | reused class | `itemsRef` + `getItems` (428, 456-472) |
| `tabStopId: string \| null`                | `$state`     | `tabStopId` (424)              |
| `isTabbingBackOut: boolean`                | `$state`     | `isTabbingBackOut` (425)       |
| `#isClickFocus: boolean`                   | plain field  | `isClickFocusRef` (427)        |
| `focusableCount: number`                   | `$derived`   | `focusableItemCount` (426) — derived, not counted |
| `tabIndex: number`                         | `$derived`   | `isTabbingBackOut \|\| count === 0 ? -1 : 0` (567) |

```ts
export type StepperTriggerMeta = {
	readonly getDisabled: () => boolean;
	readonly getValue: () => string;
};
```

**Methods**: `register(id, element, meta)`, `unregister(id)`, `isTabStop(id)`, `onItemFocus(id)`,
`onItemShiftTab()`, `onListMouseDown()`, `onListFocusOut()`, `onListFocusIn(event, selectedValue)`,
`candidatesFor(intent, current, loop)` → `HTMLElement[]`, `entryOf(element)` → the registered entry.

`candidatesFor` is the split that R-04 identified as missing from the toolbar class: it returns the
ordered candidate list *without* focusing anything, so `StepperTrigger` can await validation on
`candidates[0]` before committing the focus move.

---

## 3. Contexts

Three typed `Symbol` keys, each with a throwing getter that names both the part and its provider
(Constitution §5):

| Key                                | Publisher        | Getter                          | Error                                                    |
| ---------------------------------- | ---------------- | ------------------------------- | -------------------------------------------------------- |
| `Symbol('stepper')`                | `Stepper.Root`   | `getStepperContext(consumer)`   | `` `${consumer}` must be used within `<Stepper.Root>`. `` |
| `Symbol('stepper-item')`           | `Stepper.Item`   | `getStepperItemContext(consumer)` | `` `${consumer}` must be used within `<Stepper.Item>`. `` |
| `Symbol('stepper-focus')`          | `Stepper.List`   | `getStepperFocusContext(consumer)` | `` `${consumer}` must be used within `<Stepper.List>`. `` |

Consumer matrix (which context each part reads):

| Part          | root | item | focus |
| ------------- | :--: | :--: | :---: |
| `List`        |  ✓   |      |   —   |
| `Item`        |  ✓   |      |       |
| `Trigger`     |  ✓   |  ✓   |   ✓   |
| `Indicator`   |  ✓   |  ✓   |       |
| `Separator`   |  ✓   |  ✓   |       |
| `Title`       |  ✓   |  ✓   |       |
| `Description` |  ✓   |  ✓   |       |
| `Content`     |  ✓   |      |       |
| `Prev`        |  ✓   |      |       |
| `Next`        |  ✓   |      |       |

---

## 4. Pure helpers (exported)

| Helper                                                          | Upstream        |
| --------------------------------------------------------------- | --------------- |
| `getStepperId(rootId, variant, value)`                          | `getId` (47-53) |
| `getStepperDataState(value, itemValue, step, stepKeys, variant)` | `getDataState` (110-133) |
| `getStepperFocusIntent(key, orientation, dir)`                  | `getFocusIntent` + `MAP_KEY_TO_FOCUS_INTENT` (57-88) |

`getStepperFocusIntent` delegates the RTL swap to `getDirectionAwareKey` imported from
`action-bar-roving-focus.svelte.js`, then applies stepper's own map, which — unlike the toolbar's —
includes `PageUp` → `first` and `PageDown` → `last`.

---

## 5. State transitions

```
                    ┌──────────────────────────────────────────┐
                    │  disabled step / nonInteractive / root    │
                    │  disabled  ────────────────►  no-op       │
                    └──────────────────────────────────────────┘

  request(next)  ──►  direction = indexOf(next) > activeIndex ? 'next' : 'prev'
                       │
       ┌───────────────┴────────────────┐
   'prev' or no onValidate          'next' with onValidate
       │                                 │
       ▼                                 ▼
   setValue(next)                await onValidate(next, 'next')
   onValueChange(next)            │            │            │
                              true│       false│      throws│
                                  ▼            ▼            ▼
                            generation      no write     no write
                            still current?  no callback  no callback
                              │      │
                           yes│    no│  (consumer changed value mid-flight)
                              ▼      ▼
                        setValue   discard
```

Entry points that produce `request(next)`:

| Entry point                       | Direction        | Validated?                                       |
| --------------------------------- | ---------------- | ------------------------------------------------ |
| `Trigger` click                   | computed         | yes, when `direction === 'next'`                 |
| `Trigger` focus (automatic mode)  | computed         | yes, when `direction === 'next'`                 |
| `Trigger` arrow key + `onValidate` | computed         | yes for `'next'`; `'prev'` writes unvalidated (906) |
| `Trigger` `Enter`/`Space` (manual) | computed        | via the synthesised click                        |
| `Next` click                      | always `'next'`  | yes                                              |
| `Prev` click                      | always `'prev'`  | **no** — `setState` directly (1199)              |
