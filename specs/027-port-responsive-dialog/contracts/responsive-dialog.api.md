# Public API Contract — `responsive-dialog`

The interface this registry item exposes to consumers. Every signature below is the contract the
implementation and the tests must satisfy; anything not listed here is not public.

Import styles (both must work — CLAUDE.md §3):

```ts
import * as ResponsiveDialog from '$lib/components/ui/responsive-dialog/index.js';
import { ResponsiveDialog, ResponsiveDialogContent } from '$lib/components/ui/responsive-dialog/index.js';
import { useIsMobile } from '$lib/hooks/is-mobile.svelte.js';
```

---

## 1. `$lib/hooks/is-mobile.svelte.ts`

```ts
export const DEFAULT_MOBILE_BREAKPOINT = 768;

/** A runes reader over `(max-width: <breakpoint - 1>px)`, SSR-safe. */
export class IsMobile {
	current: boolean; // $state, seeded false
	constructor(getBreakpoint?: () => number);
}

/** Must be called during component initialisation. */
export function useIsMobile(getBreakpoint?: () => number): IsMobile;
```

Guarantees:

- `current` is `false` on the server and during the first client render, then corrects in an effect.
- Exactly one `change` listener per instance; removed on teardown.
- Changing the breakpoint getter re-creates the query and the listener.

---

## 2. Components

### `Root` / `ResponsiveDialog` — `responsive-dialog.svelte`

```ts
export type ResponsiveDialogRootProps = ComponentProps<typeof Dialog.Root> &
	ComponentProps<typeof Drawer.Root> & {
		/** Viewport width in px at or above which a dialog is rendered instead of a drawer. @default 768 */
		breakpoint?: number;
		/** Initial open state when uncontrolled. @default false */
		defaultOpen?: boolean;
	};
```

| Member                 | Type                      | Default | Bindable |
| ---------------------- | ------------------------- | ------- | -------- |
| `breakpoint`           | `number`                  | `768`   | no       |
| `open`                 | `boolean`                 | —       | **yes**  |
| `defaultOpen`          | `boolean`                 | `false` | no       |
| `onOpenChange`         | `(open: boolean) => void` | —       | no       |
| `onOpenChangeComplete` | `(open: boolean) => void` | —       | no       |
| `children`             | `Snippet`                 | —       | no       |

Behavioural guarantees:

- Renders `Drawer.Root` when `viewportWidth < breakpoint`, otherwise `Dialog.Root`.
- `onOpenChange` fires **only** on a real `false → true` / `true → false` transition.
- A breakpoint crossing never changes `open` and never calls `onOpenChange`.
- Unknown props pass through to the active root.

### Parts

| Component     | Props type                          | Required snippets | Extra props                       |
| ------------- | ----------------------------------- | ----------------- | ----------------------------------- |
| `Trigger`     | `ResponsiveDialogTriggerProps`      | `children`/`child` | `type` defaults to `"button"`     |
| `Close`       | `ResponsiveDialogCloseProps`        | `children`/`child` | —                                 |
| `Portal`      | `ResponsiveDialogPortalProps`       | `children`        | —                                  |
| `Overlay`     | `ResponsiveDialogOverlayProps`      | —                 | —                                  |
| `Content`     | `ResponsiveDialogContentProps`      | `children`        | `portalProps`, `showCloseButton` (`@default true`, dialog mode only) |
| `Header`      | `ResponsiveDialogHeaderProps`       | `children`        | —                                  |
| `Footer`      | `ResponsiveDialogFooterProps`       | `children`        | `showCloseButton` (`@default false`, dialog mode only) |
| `Title`       | `ResponsiveDialogTitleProps`        | `children`/`child` | —                                 |
| `Description` | `ResponsiveDialogDescriptionProps`  | `children`/`child` | —                                 |

Guarantees that hold for **every** part:

1. `data-slot="responsive-dialog-<part>"`.
2. `data-variant="dialog" | "drawer"` reflecting the active mode.
3. The caller's `class` is merged last through `cn()`.
4. `ref` is `$bindable(null)` and bound to the rendered element (where the part renders one).
5. `...restProps` reaches the rendered element.
6. Rendering the part without a `Root` ancestor throws
   ``` `<ResponsiveDialog.<Part>>` must be used within `<ResponsiveDialog.Root>`. ```
7. `Content` adds `px-4 pb-4` in drawer mode only, before the caller's `class`.

---

## 3. Context module — `responsive-dialog.svelte.ts`

```ts
export type ResponsiveDialogVariant = 'dialog' | 'drawer';

export class ResponsiveDialogState {
	readonly open: boolean;            // $derived
	readonly variant: ResponsiveDialogVariant; // $derived
	pendingFocusRestore: boolean;      // $state
	constructor(props: {
		getOpen: () => boolean;
		setOpen: (open: boolean) => void;
		getBreakpoint: () => number;
	});
	setOpen(next: boolean, from: ResponsiveDialogVariant): void;
	consumeFocusRestore(): boolean;
}

export function setResponsiveDialogContext(state: ResponsiveDialogState): ResponsiveDialogState;
export function hasResponsiveDialogContext(): boolean;
export function getResponsiveDialogContext(part?: string): ResponsiveDialogState;
```

---

## 4. Accessibility contract (WAI-ARIA modal dialog)

| Interaction                | Expected result                                               | Applies to  |
| -------------------------- | ------------------------------------------------------------- | ----------- |
| `Space` on trigger         | Opens                                                        | both modes  |
| `Enter` on trigger         | Opens                                                        | both modes  |
| `Tab` / `Shift + Tab`      | Moves focus within the content (focus is trapped)            | both modes  |
| `Escape`                   | Closes and returns focus to the trigger                      | both modes  |
| `Title` present            | Provides the accessible name via `aria-labelledby`           | both modes  |
| `Description` present      | Provides the description via `aria-describedby`              | both modes  |
| `dir="rtl"` ancestor       | Composition still opens, labels and closes; no new direction logic | both modes |
| Breakpoint crossed while open | Stays open, content unchanged, focus lands inside the new content | —      |

---

## 5. Registry contract

```jsonc
{
	"name": "responsive-dialog",
	"type": "registry:ui",
	"title": "Responsive Dialog",
	"registryDependencies": ["dialog", "drawer"],
	"dependencies": ["bits-ui", "vaul-svelte"]
}
```

- `name` === folder slug === demo route segment `/docs/components/responsive-dialog`.
- `files` lists `src/lib/hooks/is-mobile.svelte.ts` as `registry:hook` and the 12 component files as
  `registry:ui`; `responsive-dialog.test.ts` and `responsive-dialog.test.svelte` are excluded.
- No file imports from `src/routes/**` or `$lib/components/docs/**`.
