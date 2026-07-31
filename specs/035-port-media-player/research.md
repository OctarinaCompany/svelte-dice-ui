# Phase 0 Research: Media Player

**Feature**: `035-port-media-player` | **Date**: 2026-07-31

Upstream read at the pinned commit (`d9763d82530416dfa4c81c462387b55d06bae4ec`):

| Artefact         | Path                                                                    |
| ---------------- | ----------------------------------------------------------------------- |
| Source (3118 LO) | `.reference/diceui/docs/registry/bases/radix/ui/media-player.tsx`       |
| API contract     | `.reference/diceui/docs/types/radix/media-player.ts`                    |
| Docs page        | `.reference/diceui/docs/content/docs/components/radix/media-player.mdx` |
| Demos (6)        | `.reference/diceui/docs/registry/bases/radix/examples/media-player-*.tsx` |

There is no upstream test file for `media-player` (it is a registry-only component under
`docs/registry/bases/radix/ui`, and `docs/registry/bases/radix/test/` contains no `media-player`
suite), so the test floor is the MDX keyboard/data-attribute tables plus constitution Principle III.

Every `[NEEDS CLARIFICATION]` was resolved before this file was written; none remain in `spec.md`.

---

## R-01 — Playback state source: Svelte native media bindings, not `media-chrome`

**Decision**: mirror the media element with Svelte's native media bindings inside a
`MediaPlayerState` rune class. Bindings used on `<video>`/`<audio>`:
`bind:paused`, `bind:currentTime`, `bind:duration`, `bind:volume`, `bind:muted`,
`bind:playbackRate`, `bind:buffered`, `bind:seekable`, `bind:played`, `bind:ended`,
`bind:readyState`, `bind:seeking`.

**Rationale**: upstream sources everything through `media-chrome/react/media-store`
(`MediaProvider` + `useMediaSelector` + `useMediaDispatch`), a React-only external store. It has no
Svelte binding, adding it would be a new runtime dependency (constitution IV + the task's
"zero new npm dependencies" rule), and every one of its selectors maps 1:1 onto a property Svelte
already binds. Directed by the feature task and recorded in `spec.md` Assumptions.

**Selector → binding map** (all state lives on `MediaPlayerState`):

| media-chrome selector  | Here                                                                       |
| ---------------------- | -------------------------------------------------------------------------- |
| `mediaPaused`          | `bind:paused`                                                              |
| `mediaCurrentTime`     | `bind:currentTime`                                                         |
| `mediaSeekable`        | `bind:seekable` → `[seekableStart, seekableEnd]`, falling back to duration |
| `mediaBuffered`        | `bind:buffered`                                                            |
| `mediaEnded`           | `bind:ended`                                                               |
| `mediaVolume`          | `bind:volume`                                                              |
| `mediaMuted`           | `bind:muted`                                                               |
| `mediaVolumeLevel`     | `$derived`: `muted \|\| volume === 0 → 'off'`, `volume >= 0.5 → 'high'`, else `'low'` |
| `mediaPlaybackRate`    | `bind:playbackRate`                                                        |
| `mediaLoading`         | `waiting`/`stalled` → true; `playing`/`canplay`/`seeked`/`error` → false   |
| `mediaHasPlayed`       | latched `true` on the first `play` event                                   |
| `mediaError`           | `error` event → `element.error`; cleared on `emptied`/`loadstart`          |
| `mediaIsFullscreen`    | `document.fullscreenElement === rootEl` + `fullscreenchange`               |
| `mediaIsPip`           | `enterpictureinpicture`/`leavepictureinpicture` on the video               |
| `mediaChaptersCues`    | `textTracks` where `kind === 'chapters'` → `cues` (R-05)                   |
| `mediaSubtitlesList`   | `textTracks` where `kind` is `subtitles`/`captions`                        |
| `mediaSubtitlesShowing`| those tracks with `mode === 'showing'`                                     |
| `mediaRenditionList`   | caller-supplied `renditions` prop on `Settings` (R-07)                     |
| `mediaPreview*`        | `tooltipThumbnailSrc` prop only (R-08)                                     |

**Alternatives considered**: (a) add `media-chrome` — rejected, React-only store, new dependency;
(b) hand-rolled `addEventListener` mirroring for every property — rejected, that is exactly what
Svelte's media bindings already are, minus the leak risk.

**Consequence for `loop`**: Svelte has no `bind:loop`. It is set imperatively on the element and
observed with a `MutationObserver` on the `loop` attribute plus a direct property write, exactly as
upstream `MediaPlayerLoop` does (FR-017 requires staying in sync with external changes).

---

## R-02 — Store + context: one `MediaPlayerState` class behind a `Symbol` key

**Decision**: upstream's two React contexts (`StoreContext` for ephemeral UI state,
`MediaPlayerContext` for ids/refs/config) collapse into a single `MediaPlayerState` class in
`media-player.svelte.ts`, published with `setMediaPlayerContext()` / `getMediaPlayerContext(consumerName)`.
The getter throws ``  `<consumerName>` must be used within `<MediaPlayer>`. `` — mirroring upstream's
`` `${consumerName}` must be used within `MediaPlayer` `` and satisfying FR-001.

**Rationale**: upstream splits them only because React needs `useSyncExternalStore` to avoid
re-rendering every consumer on every `mediaCurrentTime` tick. Svelte's `$state`/`$derived` is
fine-grained already, so the split buys nothing and costs one extra provider. Constitution I/V.

**Alternatives considered**: two classes/two keys for literal structural parity — rejected, it would
reproduce a React performance workaround as permanent API surface.

---

## R-03 — Sliders: compose `bits-ui` `Slider`, not a bespoke slider

**Decision**: `MediaPlayerSeek` and `MediaPlayerVolume` compose `Slider.Root` / `Slider.Range` /
`Slider.Thumb` from `bits-ui` (`type="single"`), following the precedent already set by
`src/lib/components/ui/color-picker/color-picker-hue-slider.svelte`.

**Rationale**: constitution IV — no `slider` component exists under `src/lib/components/ui/`, and
`shadcn-svelte add` is forbidden mid-port, so the next source in the order is the `bits-ui`
primitive. It provides the ARIA slider pattern, keyboard support, pointer capture, `dir="rtl"`
inversion, `onValueChange` + `onValueCommit` and `disabled` — everything upstream took from
`radix-ui`'s `Slider`.

**Structural divergence**: `bits-ui` has no `Slider.Track`; `Slider.Root` *is* the track. Upstream's
`Root > Track > (buffered | Range | hover-range | chapter separators)` becomes
`Root > (buffered | Range | hover-range | chapter separators)`. Every documented `data-slot` is
preserved on the same visual element, so the documented styling recipe in the MDX
(`**:data-[slot='media-player-seek-buffered']:…`) keeps working unchanged.

---

## R-04 — Seek hover tooltip: composed portal, bespoke positioning (Principle IV justification)

**Decision**: the seek preview tooltip is rendered through `Tooltip.Portal` from
`$lib/components/ui/tooltip` (a `bits-ui` `Portal`, which takes a `to` target) but is positioned by
this component with two CSS custom properties (`--seek-tooltip-x`, `--seek-tooltip-y`) written from a
`requestAnimationFrame` callback, plus a `--seek-hover-percent` variable on the slider — the same
mechanism upstream uses.

**Primitive evaluated and what it lacks**: `bits-ui` `Tooltip`/`Popover` (and our `tooltip` /
`popover` / `hover-card` wrappers) anchor a floating surface to a *trigger element*. The seek
tooltip must track the pointer's X within the trigger, update per animation frame while dragging, and
clamp against a caller-supplied `tooltipCollisionBoundary` / `tooltipCollisionPadding`. Neither
primitive exposes a pointer-anchored virtual reference, so the positioning maths is bespoke; only
the portal (the part with the a11y/stacking risk) is composed.

**Portal target**: `context.portalContainer` = the root element while fullscreen, `document.body`
otherwise. This replaces upstream's `MediaPlayerPortal` (`ReactDOM.createPortal`) **and** removes the
MDX "prerequisite" patch entirely: our `DropdownMenu.Content` and `Tooltip.Content` already accept
`portalProps` (`{ to }`), so no base component has to be forked to get a portal container. This is
strictly better than upstream's documented install step and is recorded as a divergence.

---

## R-05 — Chapter cues from `TextTrack.cues`

**Decision**: read the `kind="chapters"` text track off the media element
(`element.textTracks`), collect `cues` into `{ startTime, endTime, text }[]`, and refresh on the
track list's `addtrack`/`removetrack` and the track's own `load`/`cuechange` events. The track must
be forced to `mode = 'hidden'` for the browser to parse its cues without rendering them.

**Rationale**: media-chrome's `mediaChaptersCues` is derived from exactly this API; same source data,
same UI, no dependency.

---

## R-06 — Fullscreen and Picture-in-Picture via the browser APIs

**Decision**: `rootEl.requestFullscreen()` / `document.exitFullscreen()` and
`videoEl.requestPictureInPicture()` / `document.exitPictureInPicture()`, with state read from
`document.fullscreenElement` / `document.pictureInPictureElement` and kept fresh by
`fullscreenchange` on `document` and `enterpictureinpicture` / `leavepictureinpicture` on the video.
Rejected promises are reported through `onPipError(error, 'enter' | 'exit')` (FR-019); a fullscreen
failure leaves `data-state="windowed"` (FR-004, edge case).

**Rationale**: media-chrome's `MEDIA_ENTER_FULLSCREEN_REQUEST` / `MEDIA_ENTER_PIP_REQUEST` are thin
wrappers over these same calls — upstream even calls `requestPictureInPicture()` directly alongside
the dispatch. Guarded with feature detection so unsupported browsers no-op silently.

---

## R-07 — Quality/renditions become an explicit prop

**Decision**: `MediaPlayerSettings` gains `renditions?: MediaPlayerRendition[]`,
`renditionId?: string` (`$bindable`, `undefined` = "Auto") and
`onRenditionChange?: (renditionId: string | undefined) => void`. The Quality submenu renders only
when `renditions.length > 0` and the media is a video, matching upstream's
`context.isVideo && mediaRenditionList.length > 0`.

**Rationale**: `mediaRenditionList`/`mediaRenditionSelected` only populate when an adaptive-bitrate
engine (hls.js via Mux) reports renditions. Without that dependency the submenu could never appear,
so the documented UI would be dead code. Making the list an input keeps the documented UX (Auto
default, checkmark on the active entry, `{height}p` labels sorted descending) and gives the port a
genuinely controlled/uncontrolled prop pair to test (constitution III). Recorded in Assumptions.

---

## R-08 — Thumbnails: `tooltipThumbnailSrc` only

**Decision**: keep the documented `tooltipThumbnailSrc?: string | ((time: number) => string)` prop as
the only thumbnail source. Drop the Mux sprite path (`mediaPreviewImage` + `mediaPreviewCoords` +
`SPRITE_CONTAINER_*` background-position maths).

**Rationale**: the sprite branch is fed exclusively by media-chrome's storyboard parsing of a
Mux-proprietary `storyboard.vtt`. With R-01 there is no such input, so the branch is unreachable.
The `<img>` branch covers every caller-supplied thumbnail, which is what the documented prop targets.
Recorded in Assumptions.

---

## R-09 — Direction: the repo's `direction-provider`

**Decision**: `useDirection({ dir: () => dirProp, element: () => rootEl })` from
`$lib/components/ui/direction-provider`, replacing `radix-ui`'s `Direction.useDirection`. The
resolved direction is put on the root's `dir` attribute, passed to both `Slider.Root`s, and exposed
on the context for `MediaPlayerTime` and `MediaPlayerControls`.

**Rationale**: constitution IV, and the same substitution every prior port made (`color-picker`,
`tags-input`). Upstream's arrow-key seek is *not* direction-sensitive; FR-024 says the port keeps it
that way, so only the visual layout mirrors.

---

## R-10 — `asChild` → `child` snippet; `forwardRef` → `ref` + `bind:this`

**Decision**: every part that upstream types with `CompositionProps` (`asChild`) exposes a
`child?: Snippet<[{ props: Record<string, unknown> }]>` prop rendered instead of the default element,
per CLAUDE.md §10 and `dialog-content.svelte`. `ref` is `$bindable(null)` everywhere and
`...restProps` is always spread. `React.useId()` → `$props.id()`.

**Rationale**: Svelte has no `React.cloneElement`. `child` is the established equivalent in this repo
and in `bits-ui`. For `Seek`/`Volume` the snippet is forwarded to `Slider.Root`'s own `child`; for
`PlaybackSpeed`/`Settings` it is forwarded to the trigger `Button`.

---

## R-11 — Tooltips need a provider

**Decision**: the root wraps its children in `Tooltip.Provider` with
`delayDuration={tooltipDelayDuration}`, and `MediaPlayerTooltip` renders
`Tooltip.Root` → `Tooltip.Trigger` (`child` snippet) → `Tooltip.Content`
(`portalProps={{ to: portalContainer }}`, `sideOffset`), collapsing to a bare `{@render children()}`
when `withoutTooltip` is set or neither `tooltip` nor `shortcut` is supplied — matching upstream's
early `return <>{children}</>`.

**Rationale**: `bits-ui` v2 requires a `Tooltip.Provider` ancestor; React Radix does not. Additive,
internal, and invisible in the public API.

---

## R-12 — Duplicate live regions: parts register themselves

**Decision**: `MediaPlayerState` keeps counters of mounted `VolumeIndicator` and `Download` parts
(`registerPart(kind)` returning a teardown, called from an `$effect` with the increment wrapped in
`untrack`). The root renders its own volume indicator **only when the tree contains no explicit
`MediaPlayerVolumeIndicator`**, and the `D` shortcut acts **only when a `MediaPlayerDownload` part is
mounted**.

**Rationale**: upstream's root unconditionally renders `<MediaPlayerVolumeIndicator />` *and* its own
demos add one, producing two `role="status" aria-live="polite"` regions announcing the same value —
a Principle III defect. Upstream's `D` gate (`mediaElement.querySelector('[data-slot="media-player-download"]')`)
queries inside the `<video>` element, where a control can never be, so the shortcut is dead code;
FR-021 specifies the intended behaviour instead. Both are recorded as deliberate divergences.
`untrack` on the increment is required — writing to reactive state read by sibling effects otherwise
self-invalidates (known trap in this repo).

---

## R-13 — Colour tokens for upstream's raw palette

Constitution VIII forbids raw palette colours. The player chrome keeps upstream's `dark` **scope**
class on the root and controls (that is a theme scope, not a `dark:` variant override, which is what
the rule bans), and every literal colour maps to a token:

| Upstream                              | Here                            |
| ------------------------------------- | ------------------------------- |
| `bg-black/80 text-white` (error)      | `bg-background/80 text-foreground` |
| `bg-black/30 text-white` (volume HUD) | `bg-background/30 text-foreground` |
| `bg-white` / `bg-white/30` (HUD bars) | `bg-foreground` / `bg-foreground/30` |
| `from-black/80` (controls overlay)    | `from-background/80`            |
| `bg-zinc-50 dark:bg-zinc-950` (chapter separator) | `bg-background`     |
| `bg-zinc-500` (volume track)          | `bg-muted-foreground/60`        |
| `dark:bg-zinc-900` (tooltip surface)  | `bg-popover`                    |

---

## R-14 — Existing components reused

`Button` (every control), `Badge` (settings submenu value pills), `DropdownMenu` (+ `Sub`,
`SubTrigger`, `SubContent`, `Group`, `Item`, `Label`, `Portal`), `Tooltip` (+ `Provider`, `Portal`),
`Spinner` (loading indicator and the error actions' pending state — constitution's composition rule
bans a hand-spun `animate-spin` icon inside `Button`), `direction-provider`. Icons come from
`@lucide/svelte` per `components.json` (`iconLibrary: lucide`), imported per-icon
(`@lucide/svelte/icons/play`), with no sizing classes inside `Button`.

`DropdownMenu.Item`/`Label`/`Sub` are wrapped in `DropdownMenu.Group` per the composition rules.

---

## R-15 — Time formatting

**Decision**: a local `time.ts` exporting `formatTime(seconds, guide)` reproducing media-chrome's
`timeUtils.formatTime`: `M:SS` normally, `H:MM:SS` once `guide` (or the value) reaches an hour,
`0:00` for `NaN`/`Infinity`, `-` prefix for negatives. Exported from the barrel so later ports can
reuse it. Upstream's `getCachedTime` memo map is *not* ported (R-16).

---

## R-16 — React-only machinery that is deliberately not ported

`useMemo`, `useCallback`, `useSyncExternalStore`, `useLazyRef`, `useComposedRefs`, the
`timeCache` `Map`, and the seek component's ~12 mutable `useRef` boxes exist to defeat React's
re-render model. In Svelte they become `$derived`, plain class fields, or nothing at all. The
*behaviour* they guard is kept: the seek commit is still throttled to one `requestAnimationFrame`
(SC-003 / spec edge case), the hover tooltip still uses the "intentional hover" heuristic
(dwell > 150 ms, or > 60 % horizontal movement, or a near-stationary pointer after 50 ms, with a
300 ms cooldown after a commit), and every timer/RAF/listener/observer is torn down in the
`$effect` cleanup.

---

## R-17 — Demo media assets

Upstream's docs-local (`/assets/cloud.mp4`, `/assets/lofi.mp3`) and ephemeral third-party
(Dropbox share link, OpenGameArt direct link) sources are replaced with long-lived public samples;
upstream's own Mux/media-chrome URLs are kept verbatim because they are the ones the credits section
names:

| Demo               | Source                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Default            | `https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`                  |
| Audio + Playlist   | `https://storage.googleapis.com/media-session/sintel/snow-fight.mp3`, `.../caminandes/short.mp3` |
| Settings           | upstream's `https://stream.mux.com/Sc89iWAyNkhJ3P1rQ02nrEdCFTnfT01CZ2KmaEcxXfB008/low.mp4` + the media-chrome `chapters.vtt` / `captions.{en,ja,sv}.vtt` tracks |
| HLS                | `https://stream.mux.com/A3VXy02VoUinw01pwyomEO3bHnG4P32xzV7u1j1FSzjNg.m3u8` (native HLS only, R-18) |
| Error              | `/media/nonexistent-video.mp4` (deliberately absent — that is the demo)                     |
| Playlist covers    | `https://picsum.photos/seed/<id>/200/200` (as upstream)                                     |

No asset is fetched during `pnpm run build` or `pnpm run test:unit`; a dead URL degrades to the
component's own error state, which is itself demonstrated.

---

## R-18 — HLS demo without `hls.js` / `@mux/mux-video-react`

**Decision**: point a plain `MediaPlayerVideo` at the `.m3u8` above. Browsers with native HLS
(Safari/iOS) play it; others surface `MEDIA_ERR_SRC_NOT_SUPPORTED` through `MediaPlayerError`. The
demo section says so in its description.

**Rationale**: upstream's demo uses `asChild` with `<MuxVideo>`, a React custom-element wrapper
around `hls.js`. Adding either package for one demo violates the zero-new-dependency constraint;
`asChild`/`child` on `MediaPlayerVideo` is still shipped, so a consumer can drop in their own
custom element. Recorded in Assumptions.

---

## R-19 — Testing a media element under jsdom

**Decision**: a test-only helper `media-player.test-utils.ts` (not a Vitest suite — the include glob
is `src/**/*.{test,spec}.{js,ts}`, and not listed in `registry.json`) installs, per test, a fake
media surface on the rendered element via `Object.defineProperty`: writable `paused`, `duration`,
`buffered`, `seekable`, `currentSrc`, `error`, `textTracks`, and `play()` / `pause()` / `load()` that
flip `paused` and dispatch the matching events. `requestFullscreen`, `exitFullscreen`,
`requestPictureInPicture`, `exitPictureInPicture` and `globalThis.MediaError` are stubbed with
`vi.fn()` and restored by the existing `vi.restoreAllMocks()` in `tests/setup.ts`.

**Rationale**: jsdom implements the media *properties* but not playback — `play()` raises
"Not implemented", and `duration` is read-only `NaN`, so `bind:paused` and every duration-derived
assertion would be meaningless. Stubbing the environment is not suppression (constitution VII
anti-cheat): no assertion, config or type check is relaxed. `tests/setup.ts` is left untouched so the
shims cannot leak into other suites.

---

## R-20 — What "controlled vs uncontrolled" means for this component

The root has no value-bearing prop upstream, so the constitution III controlled/uncontrolled floor is
satisfied against the props that do carry state:

| Area                | Uncontrolled                                   | Controlled                                                          |
| ------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| Menu open state     | `defaultOpen` seeds `PlaybackSpeed`/`Settings` | `bind:open` makes the parent authoritative; `onOpenChange` still fires |
| Quality selection   | `renditions` with no `renditionId` → "Auto"    | `bind:renditionId` + `onRenditionChange`                             |
| Playback state      | the media element is the source of truth        | `onPlay`/`onPause`/`onTimeUpdate`/`onVolumeChange`/`onMuted` fire from the element's own events |

This mapping is asserted explicitly in the test suite so `/speckit-analyze` can trace it.
