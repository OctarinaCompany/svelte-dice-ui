# Feature Specification: Banner

**Feature Branch**: `014-port-banner`

**Created**: 2026-07-30

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Banner\" (slug: banner) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Show a dismissible banner, controlled or uncontrolled (Priority: P1)

A developer drops a single `Banner` into a page to announce something (an update, a policy change)
with an icon, a title, a description, and an optional action button, plus a close button the visitor
can use to dismiss it. The developer can either let the banner manage its own visibility internally
(uncontrolled) or drive it from their own state (controlled), and in both cases they're told whenever
visibility changes so they can react (e.g. persist the dismissal, show a "banner dismissed" toast).

**Why this priority**: This is the smallest complete unit of the component — a single banner with no
queue — and it is also where the project's controlled/uncontrolled `open` convention is established
for every future ported component to copy. Nothing else in this spec is useful without it.

**Independent Test**: Render a `Banner` with an icon, title, description, action button and close
button, with no queue provider around it. Verify it is visible by default, that clicking its close
button hides it and calls the provided change callback, and that the same sequence works identically
whether the developer supplies their own `open` value or lets the component manage it internally.

**Acceptance Scenarios**:

1. **Given** a `Banner` rendered with no `open` prop (uncontrolled), **When** the page first renders,
   **Then** the banner is visible by default.
2. **Given** the same uncontrolled banner, **When** the visitor activates its close control, **Then**
   the banner becomes hidden and the developer's change callback fires with `false`, with no further
   action required from the developer.
3. **Given** a `Banner` whose visibility the developer drives through a two-way binding (controlled),
   **When** the visitor activates its close control, **Then** the developer's own value becomes
   `false`, the change callback fires with `false`, and the banner hides — the developer's value stays
   authoritative, and they can re-show the banner at any time by setting it back to `true`.
4. **Given** a controlled banner whose developer-owned `open` value flips from `true` to `false`,
   **When** that update is applied, **Then** the banner hides, proving the developer's value is
   authoritative in controlled mode.
5. **Given** a `Banner` with `dismissible={false}`, **When** the visitor activates its close control,
   **Then** nothing happens — the control is inert and no change callback fires.

---

### User Story 2 - Queue and prioritize multiple banners (Priority: P2)

A developer wraps a section of their app in a queue provider so that banners can be added
imperatively from anywhere (a system-health check, a background job, an in-app notification) without
each caller needing to coordinate visibility with every other caller. Only a configurable number of
banners are shown at once, most urgent first, and each newly-added or newly-removed banner animates
into or out of its stacked position instead of appearing and disappearing abruptly.

**Why this priority**: Documented as its own full example on the upstream docs page (the "stacked
banners" demo) and is what makes the component useful for app-wide notifications rather than a single
static announcement, but it is additive on top of Story 1's banner rendering.

**Independent Test**: Wrap a small control panel in the queue provider and add several banners with
different priorities from plain button clicks (no other UI). Verify banners appear stacked in
priority order (highest priority first), that only the configured maximum number are visible at once,
and that removing one causes the remaining banners to shift into the vacated position.

**Acceptance Scenarios**:

1. **Given** an empty banner queue, **When** three banners are added with priorities 0, 10 and 5 (in
   that order), **Then** they are visible in the order 10, 5, 0 (highest priority first).
2. **Given** a queue configured to show at most one banner at a time, **When** three banners are
   queued, **Then** only the highest-priority banner is visible and the other two remain queued,
   becoming visible in turn as earlier ones are dismissed.
3. **Given** two visible stacked banners, **When** the front one is dismissed, **Then** it animates
   out and the remaining banner animates into the vacated position, with no overlap or visible gap
   once the animation settles.
4. **Given** a banner added with a duration, **When** that duration elapses without visitor
   interaction, **Then** the banner dismisses itself the same way a visitor-activated close would.
5. **Given** a banner added without a duration, **When** any amount of time passes, **Then** the
   banner remains visible until explicitly dismissed.
6. **Given** a queued banner whose content is supplied as a function of its own dismiss/remove
   handlers, **When** that content invokes the supplied close handler (e.g. from a custom "skip"
   button), **Then** the banner dismisses exactly as if its own close control had been activated.

---

### User Story 3 - Style by severity and position the stack on the page (Priority: P3)

A developer marks a banner's severity (informational, success, warning, destructive, or a neutral
default) so it's visually distinguishable at a glance, and chooses where the queued stack renders on
the page (top or bottom edge) and how it's positioned relative to page scrolling (fixed to the
viewport, stuck to the top of its container while scrolling with it, or laid out inline in normal
document flow).

**Why this priority**: Documented through the upstream examples (variant colors on every demo banner;
`side`/`strategy` options on the queue provider) but is a presentational and layout refinement of
Stories 1–2 rather than new interactive behaviour.

**Independent Test**: Render banners of every severity variant side by side and confirm each has a
visually distinct, severity-appropriate treatment; separately, render the queue provider with each
`side`/`strategy` combination and confirm the stack renders at the requested edge of the page and
scrolls (or doesn't) as configured.

**Acceptance Scenarios**:

1. **Given** five banners, one per severity variant (default, info, success, warning, destructive),
   **When** they render, **Then** each uses a visually distinct treatment appropriate to its severity.
2. **Given** a queue configured with `side="bottom"`, **When** banners are visible, **Then** the stack
   renders anchored to the bottom edge of the page instead of the top, and new banners animate in from
   the bottom.
3. **Given** a queue configured with `strategy="static"`, **When** the page is placed inside normal
   document flow, **Then** the stack occupies space in that flow (pushing following content down)
   rather than floating over it.
4. **Given** a queue configured with `strategy="fixed"` (the default), **When** the page scrolls,
   **Then** the stack remains pinned to the viewport edge.

### Edge Cases

- Zero banners in the queue: the queue provider renders no visible stack container and takes up no
  space.
- Two banners added with equal (or unspecified/default) priority: the later addition is placed after
  the earlier one, so priority ties preserve insertion order.
- A banner is removed while its dismiss animation is already in progress (e.g. programmatically
  cleared mid-animation): it is removed cleanly with no error and no stray DOM left behind.
- `dismissible={false}` on a banner that also has a `duration`: the duration still auto-dismisses it
  even though the visitor cannot manually close it — only visitor-initiated close is suppressed.
- A queue's `maxVisible` is larger than the number of queued banners: all queued banners are shown,
  stacked, with no empty placeholder slots.
- The whole queue is cleared at once (e.g. navigating away from a page): every pending auto-dismiss
  timer is cancelled and no banner fires its dismiss callback after the clear.
- Page direction is `rtl`: a banner's icon/content/actions/close row mirrors horizontally (icon on the
  trailing side becomes leading, etc.) with no additional prop from the consumer.
- A standalone `Banner` (not inside a queue provider) is dismissed and later needs to reappear: setting
  its controlled `open` back to `true` (or resetting the uncontrolled default) shows it again.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The component MUST provide a `Banner` root usable standalone (outside any queue) that
  renders its children when open and renders nothing when not open.
- **FR-002**: `Banner`'s visibility MUST follow the project's controlled/uncontrolled convention: an
  `open` value the caller can bind to, an internal default (`true`) used when the caller does not
  supply one, and a change callback that fires with the new value in **both** modes; when the caller
  supplies the value, that value is the single source of truth for what is rendered, and the component
  writes any visibility change back through the caller's binding rather than keeping a second,
  divergent copy of the state.
- **FR-003**: The component MUST accept a `dismissible` flag (default `true`); when `false`, the
  close control is inert (no visitor-initiated dismissal) but any configured auto-dismiss duration
  still applies.
- **FR-004**: The component MUST accept a severity `variant`: `default`, `info`, `success`, `warning`,
  or `destructive` (default `default`), each rendered with a visually distinct, severity-appropriate
  treatment using the project's semantic status tokens.
- **FR-005**: The component MUST provide a `Banners` queue provider that, when wrapped around part of
  a page, allows banners to be added and removed imperatively (by priority, severity, content,
  optional auto-dismiss duration, and an optional dismiss callback) without each caller managing its
  own visibility state.
- **FR-024**: A `Banner` rendered inside the queue provider MUST register itself with the queue instead
  of rendering in place: it contributes its content, severity, priority, auto-dismiss duration and
  dismiss callback as one queue entry, renders no element of its own, re-registers as exactly one entry
  when those inputs change, and removes its entry — reporting the dismissal to its callbacks — when it
  is closed or destroyed.
- **FR-006**: Newly added banners MUST be inserted into the queue ordered by priority (default
  priority `0`), highest priority first; banners of equal priority MUST preserve insertion order.
- **FR-007**: The queue MUST accept a `maxVisible` (default `1`) capping how many queued banners are
  shown at once; banners beyond that cap remain queued and become visible as earlier ones are
  dismissed or removed.
- **FR-008**: A queued banner given a positive `duration` MUST dismiss itself automatically once that
  duration elapses, identically to a visitor-activated dismissal, including invoking its dismiss
  callback and, for a `Banner` registered from markup, also reporting the visibility change through
  that banner's open-change callback (upstream fires both, in that order); a banner with no duration
  (or a duration of `0`) MUST NOT auto-dismiss.
- **FR-009**: Dismissing a queued banner through the visitor's close control or an elapsed auto-dismiss
  duration MUST animate it out of the stack and MUST animate the remaining stacked banners into the
  vacated position, without visible overlap once the animation completes.
- **FR-022**: Removing a queued banner by identity — the remove handler exposed to its content and the
  queue's remove-by-id method — MUST take it out of the stack **immediately, with no exit animation**
  (upstream `onRemove`: "Callback to immediately remove the banner without animation"), while the
  remaining banners still re-settle into the vacated space.
- **FR-025**: Banner enter/exit and stack-height transitions MUST be suppressed for visitors who have
  asked for reduced motion, matching upstream's reduced-motion opt-out on the banner base styles.
- **FR-010**: The queue MUST accept a `side` (`top` or `bottom`, default `top`) controlling which edge
  of the page the stack anchors to and the direction banners animate in from/out to.
- **FR-011**: The queue MUST accept a `strategy` (`fixed`, `static`, `sticky`, or `absolute`, default
  `fixed`) controlling how the stack is positioned relative to page scrolling and layout flow.
- **FR-023**: The queue MUST accept a `container` target, consulted only by the portalling strategies
  (`fixed`, `absolute`) and defaulting to the document body, so a consumer can portal the stack into a
  specific element — or a CSS selector that resolves to one — instead of the body.
- **FR-012**: The component MUST expose a way, while inside the queue provider, to add banners
  (returning the assigned banner's identity so it can later be targeted), remove a specific banner by
  that identity, and clear every queued banner at once (cancelling any pending auto-dismiss timers
  without invoking their dismiss callbacks), and MUST expose the current ordered queue for reading, so
  a consumer can display how many banners are waiting (upstream `useBanners().banners`).
- **FR-013**: A queued banner MUST be able to supply its content either as static content or as a
  function of that banner's own identity, severity, dismissible state, and close handler (animated
  dismissal) and remove handler (immediate removal, FR-022) — so custom controls inside the banner
  (e.g. a "skip" action) can trigger the same dismissal path as the built-in close control.
- **FR-014**: The component MUST provide `BannerIcon`, `BannerContent`, `BannerTitle`,
  `BannerDescription`, and `BannerActions` parts as generic, composable containers for a banner's
  icon, grouped text content, title, description, and action controls respectively.
- **FR-015**: The component MUST provide a `BannerClose` part, composed from the project's existing
  button component, that dismisses the banner it belongs to when activated (unless suppressed by
  `dismissible={false}` or an explicit `disabled`), and accepts custom content in place of its default
  icon. With no custom content supplied it MUST still carry an accessible name (default `Close`,
  replaceable by the caller's own label), so the icon-only control is announced by assistive
  technology.
- **FR-016**: `BannerClose` (and any part reading a banner's own dismiss/close state) MUST throw a
  descriptive error naming both the part and `Banner` when used outside a `Banner`, and the queue
  accessor MUST likewise throw an error naming both the consumer and the queue provider when used
  outside it — consistent with every other ported compound component.
- **FR-017**: Every part MUST expose a `data-slot` attribute for styling and testing hooks, and
  `Banner` MUST expose its open/closed state as a data attribute.
- **FR-018**: `Banner`, `BannerIcon`, `BannerContent`, and `BannerActions` MUST support replacing
  their default rendered element with a caller-supplied element via the project's `child` snippet
  convention (the Svelte equivalent of upstream's `asChild`), while preserving the part's behaviour
  and data attributes.
- **FR-019**: A `Banner` (and each stacked banner) MUST expose the widget's accessible role and live
  region so that assistive technology announces its appearance without stealing keyboard focus.
- **FR-020**: Under a right-to-left direction context, a banner's icon/content/actions/close layout
  MUST mirror horizontally with no additional prop from the consumer.
- **FR-021**: The component MUST support every keyboard interaction the upstream documentation lists:
  `Tab` moves focus to the next focusable element inside the banner, `Shift+Tab` to the previous one,
  and `Enter` or `Space` activates the focused control (including the close control). A banner
  appearing MUST NOT move focus.

### Key Entities

- **Banner**: An individual notification. Owns its own open/closed state (controlled or
  uncontrolled), its severity, whether it can be visitor-dismissed, and — when inside a queue — its
  priority and optional auto-dismiss duration.
- **Banner Queue**: The optional provider that holds an ordered collection of banners, decides how
  many are simultaneously visible, and positions the visible subset at an edge of the page.
- **Banner Content Parts**: The icon, title, description, content grouping, and action-button
  containers a `Banner` composes from; presentational, with no state of their own beyond what the
  parent `Banner` provides through context.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A standalone banner behaves identically whether the developer lets it manage its own
  visibility or drives that visibility themselves — the same user action (closing it) produces the
  same visible result and the same notification to the developer in both modes.
- **SC-002**: Given the same sequence of banner additions (with priorities) and removals, the ported
  queue produces the same visible ordering and the same count of simultaneously-visible banners as
  the upstream component would.
- **SC-003**: A banner configured to auto-dismiss disappears within one second of its configured
  duration elapsing, with no visitor interaction required.
- **SC-004**: Dismissing a stacked banner completes its exit animation and the stack's re-settled
  layout within half a second, with zero visible overlap between banners at any point during the
  transition.
- **SC-005**: In a right-to-left page, every banner's internal layout is visibly mirrored with no
  additional configuration beyond the page/context direction already being `rtl`.
- **SC-006**: Both upstream examples (a single dismissible banner, and a prioritized stacked queue
  with variant and priority controls) are reproduced on the component's documentation page and behave
  identically to their written description.
- **SC-007**: The component is installable through the project's own registry with the same single
  command used for every other first-party component.
- **SC-008**: Using any part that requires a `Banner` outside of one produces an immediate, readable
  error identifying both the part and the required parent, rather than a silent no-op or a generic
  framework error.

## Assumptions _(mandatory)_

- **Source variant**: Only the upstream `radix` base variant
  (`.reference/diceui/docs/registry/bases/radix/ui/banner.tsx`, matching
  `docs/content/docs/components/radix/banner.mdx`) is ported. The parallel `base` registry variant
  differs only in how upstream implements `asChild` (Radix `Slot` vs. a manual clone), a difference
  this port already collapses into the project's `child` snippet convention, so the two are
  behaviourally identical for porting purposes.
- **Controlled mode follows Svelte's binding semantics, not React's**: React's controlled contract is
  "the caller's `open` is authoritative and the component never moves on its own"; Svelte's equivalent
  is `bind:open`, which requires the component to *write* the prop. Writing to a `$bindable` prop that
  the caller passed **without** `bind:` is not a no-op in Svelte 5 — the runtime creates a locally
  writable derived for it
  (`node_modules/svelte/src/internal/client/reactivity/props.js:388-396`) — so the two contracts cannot
  both hold. The port keeps `bind:open` (the idiom `bits-ui` and every other component here uses, and
  the convention this component exists to establish) and accepts one divergence: a caller who supplies
  `open` without `bind:` **and** ignores `onOpenChange` gets a banner that closes anyway, where React
  would keep it open. `bind:open`, and `open={x}` with `onOpenChange={(v) => (x = v)}`, both behave
  exactly as React does. Acceptance scenario 3 of User Story 1 and FR-002 are worded accordingly; full
  analysis in `plan.md`'s research R-01.
- **`asChild` → `child` snippet**: Upstream's `asChild` prop (backed by Radix `Slot`) has no direct
  Svelte 5 equivalent. Per `CLAUDE.md`'s translation table, `Banner`, `BannerIcon`, `BannerContent`,
  and `BannerActions` each expose a `child` snippet instead; `asChild` itself is dropped from the
  public API. `BannerTitle` and `BannerDescription` never accepted `asChild` upstream and continue not
  to.
- **`useBanners`/`useBanner` → context getters, not hooks**: Upstream exposes two React hooks:
  `useBanners()` (queue add/remove/clear + the live banner list, for use inside `Banners`) and
  `useBanner()` (a banner's own id/variant/dismissible/close, for use inside `Banner`). Svelte has no
  hook equivalent; per `CLAUDE.md` §5 these become typed `Symbol`-keyed context getters
  (`getBannersContext()` / `getBannerContext()`) exported from `banner.svelte.ts`, throwing the
  documented error when called outside their provider, matching every other ported compound
  component's context pattern instead of a bespoke hook API.
- **`ReactDOM.createPortal` → conditional in-place rendering, no new portal primitive**: Upstream
  portals the fixed/absolute-strategy stack container to `document.body` (or a caller-supplied
  container) using `react-dom`'s portal API. Per Principle IV (Composition Over Reimplementation),
  the port reuses the project's existing Dialog/Sheet portal composition (bits-ui's portal
  primitive) rather than hand-rolling a new `document.body`-targeting mechanism; the caller-supplied
  `container` option is preserved as the portal's target.
- **`useSyncExternalStore` + manual pub/sub → a `.svelte.ts` state class**: Upstream's `Store` (a
  hand-rolled observable with `subscribe`/`getState`/`notify`) exists only because React components
  cannot otherwise react to mutations of a ref-held collection outside the render cycle. This is
  exactly what Svelte 5's `$state` runes are for; the queue's banner list, per-banner removing set,
  and per-banner measured heights are ported as `$state` fields on a single `BannersState` class in
  `banner.svelte.ts`, with no separate subscribe/notify machinery.
- **`useLazyRef`/`useAsRef` dropped**: These upstream hooks exist to give a mutable box that survives
  React re-renders without re-creating its initial value or going stale between renders. Svelte
  component instances do not re-run on every reactive update the way React function components do, so
  plain class fields on the state class serve the same purpose with no wrapper needed.
- **`crypto.randomUUID()` kept as the id strategy**: Upstream generates each queued banner's id with
  `crypto.randomUUID()`. This is a standard browser/Node API already available in this project's
  target environments (no SSR-unsafe usage, since ids are only ever generated after a client-side
  add-banner call), so the port keeps it unchanged rather than introducing a project-specific id
  helper.
- **Animation timing kept as a fixed 400ms cubic-bezier transition**: Upstream hard-codes
  `BANNER_ANIMATION_DURATION = 400` and a specific easing curve for both individual banner
  enter/exit transforms and the stack container's height transition. This port preserves the same
  constant and curve rather than introducing new configuration surface upstream does not expose.
- **Variant → project status tokens**: Upstream's `info`/`success`/`warning` variants use raw
  Tailwind palette classes (`bg-blue-50 text-blue-900 dark:bg-blue-950 …`, etc.) and `destructive`
  uses raw red classes despite the project already having a `destructive` semantic token. Per
  `CLAUDE.md` §6's status-colour table, all four map to this project's `info`/`success`/`warning`/
  `destructive` tokens (each with its `-foreground` companion where a solid fill is needed) instead of
  the palette classes, and `default` maps to `bg-card text-card-foreground` exactly as upstream does.
- **No dedicated ARIA widget pattern; `role="status"` + `aria-live="polite"` kept as-is**: The WAI-ARIA
  Authoring Practices do not define a distinct "banner/notification" pattern; upstream's choice of a
  live region (`role="status"`, `aria-live="polite"`) is the correct APG-aligned mechanism for
  non-modal, non-focus-stealing announcements and is preserved unchanged (Principle III is satisfied
  by matching upstream here, not by diverging from it).
- **RTL relies on native flex mirroring, no bespoke logic**: Upstream's banner markup uses a plain
  `flex` row with `gap-3` and never reads text direction, relying entirely on the browser's native
  bidi handling of `flex` (which already mirrors under `dir="rtl"` with no JavaScript). This port
  relies on the same native mirroring — the ancestor `dir="rtl"` set by the project's existing
  `direction-provider` (or a plain `dir` attribute) naturally reverses row layout — with no bespoke
  pixel-offset RTL logic, unlike components (e.g. Masonry) that compute absolute positions and must
  mirror them manually.
- **Stacking maths (offsets, transforms, z-index) is ported as private internal behaviour**: These are
  undocumented implementation details with no public prop surface upstream (no prop lets a caller
  change the easing, the stacking depth formula, or the offset calculation), so they are ported as
  private logic inside `banner.svelte.ts` and the queue's internal stacked-item component, not
  exposed through `index.ts`.
- **`Banners` is exported as `Banner.Queue`, file `banner-queue.svelte`**: Constitution Principle V
  fixes part filenames at `<slug>-<part>.svelte`, so `banners.svelte` is not available. The upstream
  name survives as the barrel alias `Banners`; the namespace spelling is `<Banner.Queue>`, because
  `<Banner.Banners>` would be nonsense.
- **Queue methods are verb-first**: upstream's `useBanners()` returns `onBannerAdd` / `onBannerRemove` /
  `onBannersClear`; the ported `BannersState` names them `addBanner` / `removeBanner` / `clearBanners`,
  matching `MasonryState` and `ScrollerState`, because an `on*` prefix on a class method reads as an
  event handler. Upstream's `banners` list keeps its name. The per-banner context replaces upstream's
  `onClose` / `onRemove` with `close()` / `remove()` methods for the same reason, and `remove()` is a
  no-op outside a queue where upstream's `useBanner()` returned `onRemove: undefined`.
- **Queued content is a single snippet type, not a union**: upstream's
  `content: ReactNode | ((props) => ReactNode)` collapses to `content: Snippet<[BannerRenderProps]>`,
  because a snippet is already the function form and a zero-parameter snippet is assignable to it.
  No runtime `typeof content === 'function'` branch is needed. The documented payload keeps upstream's
  member names (`id`, `variant`, `dismissible`, `onClose`, `onRemove`).
- **`container` accepts a CSS selector, not a `DocumentFragment`**: bits-ui's `Portal` targets
  `Element | string`, so the port gains selector targets and loses upstream's `DocumentFragment`
  option — which could never have painted a fixed-position banner anyway, since a fragment is not in
  the document.
- **`onDismiss`, `priority` and `duration` are queue-only (upstream behaviour, preserved)**: upstream
  reads all three solely while registering with the queue, so a standalone `<Banner duration={3000}>`
  does not auto-dismiss and its `onDismiss` never fires — standalone close calls only `onOpenChange`.
  Principle II keeps the behaviour; it is stated in the props table and pinned by a test.
- **`data-mounted` / `data-removed` / `data-front` keep upstream's `true`/`false` values**: Principle
  VIII's `'' | undefined` rule is waived for these three because they are upstream-observable values
  that consumers' `data-[removed=true]:` selectors already target. `data-state="open" | "closed"`
  carries the same information in the shape the principle prescribes.
- **The close button's icon is not hand-sized**: upstream renders `<X className="size-3.5" />`;
  `.agents/skills/shadcn-svelte/rules/icons.md` forbids sizing classes on icons inside components, and
  `Button` already sizes descendant SVGs, so the icon renders class-free (16 px instead of 14 px).
- **`BannerClose` gains a default accessible name**: upstream renders `<Button><X /></Button>`
  (`banner.tsx:680-691`) with neither `aria-label` nor visually-hidden text, leaving the banner's only
  control unnamed. Constitution Principle III (APG conformance, accessible names) overrides parity
  here: the port renders `<span class="sr-only">Close</span>` beside the default icon, omitted when the
  caller supplies `children` or an `aria-label`. This is the only additive accessibility divergence in
  this port.
- **No shared "controllable state" module is created**: the controlled/uncontrolled convention ships as
  documentation (a four-line idiom recorded in `plan.md` and `contracts/public-api.md`), not as a helper
  file. Because components are distributed as source, a helper would force every later component to add
  a `registryDependencies` entry that consumers install just to obtain `open ??= defaultOpen`.
- **RTL needs no `direction-provider` dependency**: unlike Masonry, the banner never computes a pixel
  offset from direction — its row is a plain `flex` that the browser mirrors natively — so no direction
  is resolved in JavaScript. Because jsdom performs no layout, the RTL requirement is verified by its
  observable causes: identical markup under `ltr` and `rtl`, no physically-sided utility classes, and
  icon → content → actions → close source order.
