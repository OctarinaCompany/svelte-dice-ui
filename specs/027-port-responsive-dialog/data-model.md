# Phase 1 Data Model — Responsive Dialog

Two reactive entities, both from the spec's Key Entities section. Neither is persisted; both live for
the lifetime of the component instance that owns them.

---

## Entity 1 — `IsMobile` (mode-detection primitive)

**Module**: `src/lib/hooks/is-mobile.svelte.ts`
**Owner**: whichever component calls `useIsMobile()` during initialisation (here: the responsive
dialog root). Reusable by any future port (FR-007).

| Field / member                 | Type                          | Reactivity        | Description                                                                             |
| ------------------------------ | ----------------------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| `current`                      | `boolean`                     | `$state`          | `true` when the viewport is narrower than the breakpoint. Seeded `false` (SSR-safe).    |
| `#getBreakpoint`               | `() => number`                | plain field       | Getter so a changing `breakpoint` prop stays reactive (never a captured snapshot).      |
| constructor `$effect`          | —                             | effect + teardown | Creates the `MediaQueryList`, sets `current`, listens for `change`, removes on teardown. |
| `DEFAULT_MOBILE_BREAKPOINT`    | `768`                         | const             | Upstream default.                                                                       |

**Derivation**: `current === window.matchMedia('(max-width: ' + (breakpoint - 1) + 'px)').matches`.

**Validation rules**:

- `breakpoint` is used verbatim; a non-positive value simply yields a query that never matches. No
  clamping is introduced (upstream has none).
- Guarded by `typeof window === 'undefined' || typeof window.matchMedia !== 'function'` so SSR and
  bare jsdom environments are safe.

**State transitions**: `false ⇄ true`, driven exclusively by the `change` event or by a change of the
breakpoint getter (which re-runs the effect and re-creates the listener). Exactly one listener is
registered per instance at a time; the teardown removes it before a new one is created.

---

## Entity 2 — `ResponsiveDialogState` (shared dialog state)

**Module**: `src/lib/components/ui/responsive-dialog/responsive-dialog.svelte.ts`
**Owner**: `responsive-dialog.svelte` (Root). **Published on**: `Symbol('responsive-dialog')` context.
**Consumers**: all nine parts.

| Field / member          | Type                              | Reactivity   | Description                                                                                              |
| ----------------------- | --------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------- |
| `open`                  | `boolean`                         | `$derived`   | Reads the root's `getOpen()`; the root owns controlled/uncontrolled resolution via `$bindable` + `defaultOpen`. |
| `variant`               | `'dialog' \| 'drawer'`            | `$derived`   | `isMobile.current ? 'drawer' : 'dialog'`. The single value every part branches on.                       |
| `setOpen(next, from)`   | `(boolean, variant) => void`      | method       | No-op when `from !== variant` (stale branch) or `next === open` (no transition). Otherwise writes through the root's setter and invokes `onOpenChange`. |
| `pendingFocusRestore`   | `boolean`                         | `$state`     | Set by the root when `variant` changes while `open` is `true`.                                            |
| `consumeFocusRestore()` | `() => boolean`                   | method       | Returns and clears `pendingFocusRestore`; called once by `Content` on mount.                              |
| `#lastVariant`          | `'dialog' \| 'drawer' \| undefined` | plain field | Non-reactive previous value used to detect the transition inside `untrack`.                              |

**Constructor props** (all reactive inputs enter as getter functions, per CLAUDE.md §4):

```ts
type ResponsiveDialogStateProps = {
	getOpen: () => boolean;
	setOpen: (open: boolean) => void;
	getBreakpoint: () => number;
};
```

**Validation rules**:

- `onOpenChange` fires only from `setOpen` and only after both guards pass — so it never fires on a
  mode swap (spec edge case) and never fires twice for the same value.
- When the caller binds `open`, the root's setter writes to the bound prop; the component never
  mutates open state outside `setOpen`.

**State transitions**:

| From                     | Trigger                                    | To                        | Side effects                                                       |
| ------------------------ | ------------------------------------------ | ------------------------- | -------------------------------------------------------------------- |
| `open: false`            | trigger click / `Enter` / `Space`          | `open: true`              | `onOpenChange(true)`; active primitive mounts and traps focus.     |
| `open: true`             | `Escape`, `Close`, overlay dismiss         | `open: false`             | `onOpenChange(false)`; focus returns to the trigger.                |
| `variant: 'drawer'`      | media query flips (viewport ≥ breakpoint)  | `variant: 'dialog'`       | If `open`, `pendingFocusRestore = true`; **no** `onOpenChange`.     |
| `variant: 'dialog'`      | media query flips (viewport < breakpoint)  | `variant: 'drawer'`       | Symmetric.                                                          |
| `pendingFocusRestore: true` | new `Content` mounts                    | `pendingFocusRestore: false` | Focus moved into the newly mounted content.                       |

**Relationships**: `ResponsiveDialogState` **has-a** `IsMobile` (constructed by the root from the
`breakpoint` getter). Every part **reads** the state through `getResponsiveDialogContext()`, which
throws ``` `<ResponsiveDialog.X>` must be used within `<ResponsiveDialog.Root>`. ``` when absent
(FR-011).

---

## Rendered contract (what each entity puts in the DOM)

| Attribute                            | Source                       | Values                                    |
| ------------------------------------ | ---------------------------- | ------------------------------------------- |
| `data-variant`                       | `state.variant`              | `"dialog"` \| `"drawer"` — on all 9 parts |
| `data-slot`                          | per part                     | `responsive-dialog-<part>`                 |
| `role="dialog"`, `aria-labelledby`, `aria-describedby`, `aria-modal` | underlying primitive | inherited unchanged from `Dialog`/`Drawer` |

`data-variant` is a value attribute, not a boolean, so it is always present — the
`cond ? '' : undefined` rule in Principle VIII applies to boolean attributes only and there are none
on this component.
