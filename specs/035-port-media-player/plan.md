# Implementation Plan: Media Player

**Branch**: `035-port-media-player` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/035-port-media-player/spec.md`

## Summary

Port Dice UI's `media-player` (a 3118-line React registry component) to Svelte 5 as
`src/lib/components/ui/media-player/`: 23 composable parts covering a video/audio surface, a controls
bar, transport controls (play, seek ±, seek slider with buffered/chapter/thumbnail preview, volume,
time), extended controls (speed, loop, captions, fullscreen, PiP, download, settings menu), and three
feedback layers (loading, error, volume indicator), all driven by a full keyboard shortcut set.

Technical approach: one `MediaPlayerState` rune class in `media-player.svelte.ts` mirrors the media
element through **Svelte's native media bindings** (`bind:paused`, `bind:currentTime`,
`bind:duration`, `bind:volume`, `bind:muted`, `bind:playbackRate`, `bind:buffered`, `bind:seekable`,
`bind:ended`) instead of upstream's React-only `media-chrome` store, and is shared through a `Symbol`
context key with a throwing getter. Sliders compose `bits-ui` `Slider`; menus, tooltips, buttons,
badges and the spinner compose the already-installed shadcn-svelte components; portals compose
`bits-ui` `Portal` via the `portalProps={{ to }}` escape hatch our `DropdownMenu.Content` and
`Tooltip.Content` already expose — which removes upstream's documented "patch your base components
first" install step. Zero new npm dependencies. Full decision log in
[research.md](./research.md); state shape in [data-model.md](./data-model.md); exact API in
[contracts/media-player-api.md](./contracts/media-player-api.md).

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`), Svelte 5.56 (runes forced on in
`vite.config.ts`), SvelteKit 2.63

**Primary Dependencies**: `bits-ui` ^2.18 (`Slider`, `DropdownMenu`, `Tooltip`, `Portal`),
`@lucide/svelte` ^1.27 (icons, per `components.json` `iconLibrary: lucide`), `tailwind-variants`,
`clsx`/`tailwind-merge` via `cn()`. Existing UI components reused: `button`, `badge`,
`dropdown-menu`, `tooltip`, `spinner`, `direction-provider` (+ `table`, `scroll-area`, `sonner` on
the docs route only). **No new npm dependency** — upstream's `media-chrome`, `radix-ui`,
`@mux/mux-video-react` and `hls.js` are all replaced (research R-01, R-09, R-18).

**Storage**: N/A

**Testing**: Vitest 4 (jsdom, `globals: false`, `expect.requireAssertions`) +
`@testing-library/svelte` + `@testing-library/user-event`; colocated at
`src/lib/components/ui/media-player/media-player.test.ts`. jsdom implements no playback pipeline, so
a test-only `media-player.test-utils.ts` installs a fake media surface per test (research R-19);
`tests/setup.ts` is not modified.

**Target Platform**: Modern evergreen browsers (Fullscreen API, Picture-in-Picture API, `TextTrack`,
`TimeRanges`), server-rendered by SvelteKit and hydrated — every browser-API touch is inside
`$effect` or an event handler, never at module scope.

**Project Type**: shadcn-svelte registry component (source-distributed) + one docs route.

**Performance Goals**: seek position repaints within one animation frame of a drag or keyboard seek
(SC-003); the committed seek is throttled to at most one `requestAnimationFrame`; time displays
update at least once per second during playback (US1 §6).

**Constraints**: no `any`, no suppression comments, semantic Tailwind tokens only, every part carries
`data-slot` and exposes its state as `data-*`, `class` merged last, every `$effect` returns a
teardown for every timer/RAF/listener/observer it starts.

**Scale/Scope**: 23 `.svelte` parts + 1 state module + 1 shared `time.ts` + 1 barrel = 26 registry
files; 3 test-only files; 1 docs route with 6 example sections + props tables; 1 `registry.json`
entry.

## Constitution Check

_GATE: passed before Phase 0 research; re-checked after Phase 1 design (see the note below the table)._

| #    | Principle                           | Verdict | Evidence                                                                                                                                     |
| ---- | ----------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | Svelte 5 Runes Only                 | PASS    | `MediaPlayerState` in `media-player.svelte.ts` (`$state`/`$derived`/`$effect`); props via `$props()`; `ref`/`open`/`renditionId` via `$bindable`; snippets only — no store, no `export let`, no `createEventDispatcher`, no `<slot>` |
| II   | Upstream Parity (NON-NEGOTIABLE)    | PASS    | All 23 parts, every prop/default/callback/`data-*`/ARIA/keyboard row reproduced from the pinned source + `docs/types/radix/media-player.ts` (contract §2–§13); the 8 divergences are recorded in `spec.md` Assumptions and restated in "Divergence register" below |
| III  | Accessibility Is a MUST             | PASS    | WAI-ARIA slider pattern comes from `bits-ui` `Slider`; label/description ids, `aria-controls`, `aria-pressed`, `role="status"`/`role="alert"` per contract; 19-row keyboard table each with a `user-event` test; RTL, controlled/uncontrolled, `disabled`, and the out-of-provider throw all asserted (test plan §D) |
| IV   | Composition Over Reimplementation   | PASS    | `button`/`badge`/`dropdown-menu`/`tooltip`/`spinner`/`direction-provider` reused as-is; `bits-ui` `Slider` + `Portal` compose the two behaviours with real a11y risk; bespoke code is justified below |
| V    | shadcn-svelte Distribution Model    | PASS    | One folder, one part per file, `<slug>-<part>.svelte`, `media-player.svelte.ts`, `index.ts` barrel with short + prefixed names + types, `.js` import extensions, one `registry:ui` entry, no import from `src/routes/**` or `$lib/components/docs/**` |
| VI   | TypeScript Strict, No Suppressions  | PASS    | Prop types exported from `<script lang="ts" module>`, derived from `WithElementRef<…>`/`Slider.RootProps`/`ButtonProps`; `MediaError`, `TextTrack`, `TimeRanges` are typed DOM lib types; no `any`, no ignore comment, no config change |
| VII  | Green Gate Before Commit            | PASS    | `format → check → lint → test:unit --run → build` scheduled as the final phase; jsdom media stubs are environment shims, not assertion or config relaxation (research R-19) |
| VIII | Styling Discipline                  | PASS    | `cn()` everywhere, `class` merged last, every upstream raw colour mapped to a token (research R-13), no `space-*`, `size-*` where equal, no manual `dark:` variant, no manual z-index added to overlay primitives |
| IX   | Every Component Is Documented       | PASS    | `/docs/components/media-player` gets one `<ComponentPreview>` per upstream demo file (6) + props tables; demo state held in the page with runes, no `+page.ts` |
| X    | One Feature Directory Per Component | PASS    | All artefacts under `specs/035-port-media-player/`; no git write command is run by any phase |

**Post-design re-check**: the Phase 1 design introduced no new violation. Two design decisions were
reviewed against the principles and pass: (a) collapsing `bits-ui`'s trackless `Slider.Root` keeps
every documented `data-slot` on the same visual element (II/VIII); (b) the root's automatic
`VolumeIndicator` is now conditional on no explicit indicator being mounted, which *removes* a
duplicated `aria-live` region present upstream (III) and is recorded as a divergence (II).

**Bespoke behaviour justification (Principle IV)**:

1. **Seek hover-tooltip positioning** — `bits-ui` `Tooltip`/`Popover` (and our `tooltip`/`popover`/
   `hover-card` wrappers) anchor to a *trigger element*; they expose no pointer-anchored virtual
   reference, no per-frame reposition while dragging, and no caller-supplied
   `tooltipCollisionBoundary`/`tooltipCollisionPadding`. Only the maths is bespoke (two CSS custom
   properties written from a rAF callback); the portal — the part carrying the stacking/a11y risk —
   composes `Tooltip.Portal`. See research R-04.
2. **Media state mirroring** — no primitive in `bits-ui` or `src/lib/components/ui/*` models an
   `HTMLMediaElement`. Svelte's own media bindings do the mirroring; the bespoke part is limited to
   what has no binding: `loop` (property + `MutationObserver`), `loading`/`hasPlayed`/`error`
   (`waiting`/`stalled`/`playing`/`canplay`/`seeked`/`error`/`emptied` listeners), text tracks, the
   Fullscreen API and the Picture-in-Picture API. See research R-01, R-05, R-06.
3. **Auto-hide / volume-indicator / loading timers** — three `setTimeout` state machines with no
   primitive equivalent; each lives in `MediaPlayerState` and is cleared in its `$effect` teardown.
   See data-model §5.

Nothing else is hand-rolled: no focus trap, no positioner for the menus, no scroll lock, no slider.

## Project Structure

### Documentation (this feature)

```text
specs/035-port-media-player/
├── plan.md                        # This file
├── research.md                    # Phase 0 — 20 decisions, all NEEDS CLARIFICATION resolved
├── data-model.md                  # Phase 1 — MediaPlayerState, types, constants, transitions
├── quickstart.md                  # Phase 1 — how to run and verify
├── contracts/
│   └── media-player-api.md        # Phase 1 — exhaustive public API + keyboard + registry contract
├── checklists/requirements.md     # from /speckit-specify
└── tasks.md                       # Phase 2 — created by /speckit-tasks, NOT by this command
```

### Source Code (repository root)

```text
src/lib/components/ui/media-player/
├── index.ts                              # barrel: short names + MediaPlayer* aliases + all prop types
├── media-player.svelte.ts                # MediaPlayerState + Symbol context + constants   ← media-player.tsx: Store/MediaPlayerContext, MediaPlayerImpl logic
├── time.ts                               # formatTime() — shared export (deliverable 5)    ← media-chrome timeUtils.formatTime
├── media-player.svelte                   # Root                                            ← MediaPlayer + MediaPlayerImpl
├── media-player-video.svelte             #                                                 ← MediaPlayerVideo
├── media-player-audio.svelte             #                                                 ← MediaPlayerAudio
├── media-player-controls.svelte          #                                                 ← MediaPlayerControls
├── media-player-controls-overlay.svelte  #                                                 ← MediaPlayerControlsOverlay
├── media-player-loading.svelte           #                                                 ← MediaPlayerLoading
├── media-player-error.svelte             #                                                 ← MediaPlayerError
├── media-player-volume-indicator.svelte  #                                                 ← MediaPlayerVolumeIndicator
├── media-player-play.svelte              #                                                 ← MediaPlayerPlay
├── media-player-seek-backward.svelte     #                                                 ← MediaPlayerSeekBackward
├── media-player-seek-forward.svelte      #                                                 ← MediaPlayerSeekForward
├── media-player-seek.svelte              #                                                 ← MediaPlayerSeek
├── media-player-volume.svelte            #                                                 ← MediaPlayerVolume
├── media-player-time.svelte              #                                                 ← MediaPlayerTime
├── media-player-playback-speed.svelte    #                                                 ← MediaPlayerPlaybackSpeed
├── media-player-loop.svelte              #                                                 ← MediaPlayerLoop
├── media-player-fullscreen.svelte        #                                                 ← MediaPlayerFullscreen
├── media-player-pip.svelte               #                                                 ← MediaPlayerPiP
├── media-player-captions.svelte          #                                                 ← MediaPlayerCaptions
├── media-player-download.svelte          #                                                 ← MediaPlayerDownload
├── media-player-settings.svelte          #                                                 ← MediaPlayerSettings
├── media-player-portal.svelte            #                                                 ← MediaPlayerPortal
├── media-player-tooltip.svelte           #                                                 ← MediaPlayerTooltip
├── media-player.test.ts                  # colocated suite            (not in registry.json)
├── media-player.test.svelte              # composition harness        (not in registry.json)
└── media-player.test-utils.ts            # jsdom media stubs          (not in registry.json)

src/routes/docs/components/media-player/
└── +page.svelte                          # 6 <ComponentPreview> sections + props tables

registry.json                             # append exactly one registry:ui entry, then registry:build
```

**Structure Decision**: folder slug `media-player` == demo route segment `media-player` == registry
item `name` == upstream component name. Every part file maps 1:1 to an upstream function in
`.reference/diceui/docs/registry/bases/radix/ui/media-player.tsx` (arrows above). Upstream's
`useLazyRef`, `useComposedRefs` and `useStore`/`useSyncExternalStore` have no file here: they become
class fields, `bind:this`, and Svelte reactivity respectively (research R-16). 26 files are listed in
`registry.json`; the three test-only files are not.

## Public API

Derived from `.reference/diceui/docs/types/radix/media-player.ts` and the component source. Full
detail (data attributes, ARIA, defaults per button, keyboard) in
[contracts/media-player-api.md](./contracts/media-player-api.md).

**Shared by every part**: `ref` (`HTMLElement | null`, **bindable**, default `null`), `class`
(`string`, merged last), `children` (`Snippet`), `child`
(`Snippet<[{ props: Record<string, unknown> }]>` — the `asChild` replacement), and `...restProps`.
Only props *beyond* those are listed below.

### `MediaPlayer` (`Root`) — `MediaPlayerRootProps`

| Prop                   | Type                                | Default                    | Bindable |
| ---------------------- | ----------------------------------- | -------------------------- | -------- |
| `dir`                  | `'ltr' \| 'rtl'`                    | direction context → DOM → `'ltr'` | no |
| `label`                | `string`                            | `'Media player'`           | no       |
| `tooltipDelayDuration` | `number`                            | `600`                      | no       |
| `tooltipSideOffset`    | `number`                            | `10`                       | no       |
| `autoHide`             | `boolean`                           | `false`                    | no       |
| `disabled`             | `boolean`                           | `false`                    | no       |
| `withoutTooltip`       | `boolean`                           | `false`                    | no       |

Callbacks: `onPlay()`, `onPause()`, `onEnded()`, `onTimeUpdate(time: number)`,
`onVolumeChange(volume: number)`, `onMuted(muted: boolean)`,
`onMediaError(error: MediaError | null)`, `onPipError(error: unknown, state: 'enter' | 'exit')`,
`onFullscreenChange(fullscreen: boolean)`. Snippets: `children`, `child`.
Base type omits the conflicting native `onTimeUpdate`/`onVolumeChange` handlers, exactly as upstream.

### Media elements

| Component            | Extra props | Snippets            | Notes                                                         |
| -------------------- | ----------- | ------------------- | ------------------------------------------------------------- |
| `MediaPlayerVideo`   | none (`HTMLVideoAttributes`) | `children`, `child` | `<source>`/`<track>` children; click toggles playback |
| `MediaPlayerAudio`   | none (`HTMLAudioAttributes`) | `children`, `child` |                                                       |

### Containers and feedback

| Component                    | Extra props                                                                          | Callbacks              |
| ---------------------------- | ------------------------------------------------------------------------------------ | ---------------------- |
| `MediaPlayerControls`        | —                                                                                    | —                      |
| `MediaPlayerControlsOverlay` | —                                                                                    | —                      |
| `MediaPlayerLoading`         | `delay?: number = 500`                                                               | —                      |
| `MediaPlayerError`           | `error?: MediaError \| null` (default: the media's own), `label?: string`, `description?: string` | `onRetry()`, `onReload()` |
| `MediaPlayerVolumeIndicator` | —                                                                                    | —                      |

### Buttons (all extend `ButtonProps`; all accept `disabled`, default = the root's `disabled`)

| Component                 | Extra props                                              | Snippets                          | Callbacks   |
| ------------------------- | -------------------------------------------------------- | --------------------------------- | ----------- |
| `MediaPlayerPlay`         | —                                                        | `children`, `child`               | `onclick`   |
| `MediaPlayerSeekBackward` | `seconds?: number = 5`                                   | `children`, `child`               | `onclick`   |
| `MediaPlayerSeekForward`  | `seconds?: number = 10`                                  | `children`, `child`               | `onclick`   |
| `MediaPlayerLoop`         | —                                                        | `children`, `child`               | `onclick`   |
| `MediaPlayerFullscreen`   | —                                                        | `children`, `child`               | `onclick`   |
| `MediaPlayerPiP`          | `onPipError?`                                            | `children: Snippet<[boolean]>`, `child` | `onclick` |
| `MediaPlayerCaptions`     | —                                                        | `children`, `child`               | `onclick`   |
| `MediaPlayerDownload`     | —                                                        | `children`, `child`               | `onclick`   |

`MediaPlayerPiP`'s `children` snippet receives the current PiP state — the Svelte form of upstream's
`(isPictureInPicture) => ReactNode` render prop.

### Sliders and time

| Component            | Prop                       | Type                                                                 | Default     | Bindable |
| -------------------- | -------------------------- | -------------------------------------------------------------------- | ----------- | -------- |
| `MediaPlayerSeek`    | `withTime`                 | `boolean`                                                            | `false`     | no       |
|                      | `withoutChapter`           | `boolean`                                                            | `false`     | no       |
|                      | `withoutTooltip`           | `boolean`                                                            | `false`     | no       |
|                      | `tooltipThumbnailSrc`      | `string \| ((time: number) => string)`                               | —           | no       |
|                      | `tooltipTimeVariant`       | `'current' \| 'progress'`                                            | `'current'` | no       |
|                      | `tooltipSideOffset`        | `number`                                                             | root's      | no       |
|                      | `tooltipCollisionBoundary` | `Element \| Element[]`                                               | the root    | no       |
|                      | `tooltipCollisionPadding`  | `number \| Partial<Record<'top'\|'right'\|'bottom'\|'left', number>>`| `10`        | no       |
|                      | `disabled`                 | `boolean`                                                            | root's      | no       |
| `MediaPlayerVolume`  | `expandable`               | `boolean`                                                            | `false`     | no       |
|                      | `disabled`                 | `boolean`                                                            | root's      | no       |
| `MediaPlayerTime`    | `variant`                  | `'progress' \| 'remaining' \| 'duration'`                            | `'progress'`| no       |

`Seek` and `Volume` additionally accept every `bits-ui` `Slider.RootProps` except the ones the part
owns (`type`, `value`, `onValueChange`, `onValueCommit`, `min`, `max`, `step`, `dir`, `children`).

### Menus

| Component                  | Prop                | Type                                         | Default                              | Bindable |
| -------------------------- | ------------------- | -------------------------------------------- | ------------------------------------ | -------- |
| `MediaPlayerPlaybackSpeed` | `open`              | `boolean`                                    | `defaultOpen`                        | **yes**  |
|                            | `defaultOpen`       | `boolean`                                    | `false`                              | no       |
|                            | `modal`             | `boolean`                                    | `false`                              | no       |
|                            | `sideOffset`        | `number`                                     | `10`                                 | no       |
|                            | `speeds`            | `number[]`                                   | `[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]` | no       |
|                            | `disabled`          | `boolean`                                    | root's                               | no       |
| `MediaPlayerSettings`      | *(all of the above)* |                                             |                                      |          |
|                            | `renditions`        | `MediaPlayerRendition[]`                     | `[]`                                 | no       |
|                            | `renditionId`       | `string \| undefined`                        | `undefined` (= "Auto")               | **yes**  |

Callbacks: `onOpenChange(open: boolean)` on both;
`onRenditionChange(renditionId: string | undefined)` on `Settings`.

### Utility parts

| Component             | Prop            | Type                                  | Default                   |
| --------------------- | --------------- | ------------------------------------- | ------------------------- |
| `MediaPlayerPortal`   | `container`     | `Element \| DocumentFragment \| null` | `context.portalContainer` |
| `MediaPlayerTooltip`  | `tooltip`       | `string`                              | —                         |
|                       | `shortcut`      | `string \| string[]`                  | —                         |
|                       | `delayDuration` | `number`                              | root's                    |
|                       | `sideOffset`    | `number`                              | root's                    |

### Non-component exports

`MediaPlayerState`, `setMediaPlayerContext(state)`, `getMediaPlayerContext(consumerName)` (throws
`` `<MediaPlayer.Part>` must be used within `<MediaPlayer>`. ``), `formatTime(seconds, guide?)`,
`MEDIA_PLAYER_SPEEDS`, `SEEK_STEP_SHORT`, `SEEK_STEP_LONG`, and the types
`MediaPlayerDirection`, `MediaPlayerVolumeLevel`, `MediaPlayerTimeVariant`,
`MediaPlayerSeekTooltipTimeVariant`, `MediaPlayerPipErrorState`, `MediaPlayerChapterCue`,
`MediaPlayerRendition`, `MediaPlayerTextTrack`, `MediaPlayerCollisionPadding`, plus every
`MediaPlayer*Props` type. `getMediaPlayerContext` is the port's replacement for upstream's
`useMediaPlayer` / `useMediaPlayerStore` exports.

**Shared module exported for later components (deliverable 5)**: `time.ts` → `formatTime()`, the only
duration formatter in the repo; re-exported from the barrel so a future port (chapters, transcript,
timeline-style components) reuses it rather than re-deriving media-chrome's format rules.

## Divergence register (Principle II)

Each row is already recorded in `spec.md` Assumptions; repeated here so `/speckit-analyze` can trace
plan → spec.

| # | Upstream                                                        | Here                                                                     | Why                                                   |
| - | --------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------- |
| 1 | `media-chrome/react/media-store`                                | Svelte native media bindings in `MediaPlayerState`                       | React-only store; new dependency; R-01                |
| 2 | `radix-ui` `Direction` + `Slot`                                 | `direction-provider` + `child` snippet                                   | No `cloneElement` in Svelte; R-09/R-10                |
| 3 | `Slider.Root > Slider.Track > …`                                | `Slider.Root > …` (bits-ui is trackless)                                 | Primitive shape; all `data-slot`s preserved; R-03     |
| 4 | `MediaPlayerPortal` + patched `container` props on base components | `bits-ui` `Portal` via existing `portalProps={{ to }}`                  | No base component fork needed; R-04                   |
| 5 | Mux storyboard sprite thumbnails                                | `tooltipThumbnailSrc` only                                               | Sprite source is unreachable without media-chrome; R-08 |
| 6 | `mediaRenditionList` from the HLS engine                        | `renditions` / `renditionId` / `onRenditionChange` props                  | Otherwise dead UI; R-07                               |
| 7 | Root always renders a `VolumeIndicator`                         | Root renders one only when the tree has none                             | Removes a duplicated `aria-live` region; R-12         |
| 8 | `D` gate = `querySelector` inside the `<video>` (never matches)  | `D` gate = a mounted `Download` part                                     | Upstream gate is dead code; FR-021; R-12              |
| 9 | `@mux/mux-video-react` HLS demo                                 | native-HLS `.m3u8` demo + error-state fallback                           | No new dependency; R-18                               |
| 10 | `delayMs` (implementation) / `delay` (published type)          | `delay`                                                                  | Published type is the contract; contract §5           |
| 11 | MDX keyboard table: `J`/`L` "(video only)", `P` unqualified     | `J`/`L` act on video **and** audio; `P` is video-only                     | The MDX table contradicts the source (`media-player.tsx:557-576` has no `isVideo` guard for `J`/`L`; `:531` guards `P` with `isVideo`). Behaviour follows the source; the MDX rows are upstream doc bugs |
| 12 | `withoutChapter` published `@default true`                     | `@default false`                                                          | Published tag contradicts upstream behaviour; implementation wins; contract §7 |

## Implementation phases (what `/speckit-tasks` will expand)

**P0 — Foundation.** `time.ts` (+ its own unit assertions), `media-player.svelte.ts`
(`MediaPlayerState`, `Symbol` context, throwing getter, constants, `registerPart`), `index.ts`
skeleton.

**P1 — Tests (written first).** `media-player.test-utils.ts`, `media-player.test.svelte`,
`media-player.test.ts` — suites per quickstart §2 (rendering, ARIA, transport, keyboard × 19 rows,
feedback, menus, controlled/uncontrolled, RTL, guard rails).

**P2 — MVP (User Story 1).** `media-player.svelte` (root: ids, label/description, `dir`,
`Tooltip.Provider`, keydown/keyup, mouse handlers, data attributes), `media-player-video.svelte`,
`media-player-audio.svelte`, `media-player-controls.svelte`, `media-player-play.svelte`,
`media-player-seek.svelte` (slider + buffered + drag throttle), `media-player-volume.svelte`,
`media-player-time.svelte`, `media-player-tooltip.svelte`, `media-player-portal.svelte`. Ships a
usable player.

**P3 — Keyboard.** The full shortcut table on the root, `media-player-seek-backward`,
`media-player-seek-forward`, `media-player-loop`, `media-player-fullscreen`, `media-player-pip`,
`media-player-captions`, `media-player-download` (+ its `D` registration).

**P4 — Feedback.** `media-player-loading`, `media-player-error`,
`media-player-volume-indicator`, `media-player-controls-overlay`, `autoHide`, the seek hover tooltip
(chapters, thumbnail, collision clamping).

**P5 — Composition.** `media-player-playback-speed`, `media-player-settings`
(speed/quality/captions submenus), `expandable` volume, RTL pass, `disabled` pass.

**P6 — Docs route.** `src/routes/docs/components/media-player/+page.svelte`: six
`<ComponentPreview>` sections — Default (`media-player-demo.tsx`), Audio Player
(`media-player-audio-demo.tsx`), With Settings Menu (`media-player-settings-demo.tsx`), HLS Playback
(`media-player-hls-demo.tsx`), With Error Handling (`media-player-error-demo.tsx`), With Playlist
(`media-player-playlist-demo.tsx`) — plus one `Table` props table per exported part and a Credits
block (upstream MDX §Credits). Playlist demo composes `scroll-area` + `svelte-sonner` `toast`, as
upstream does. Assets per research R-17.

**P7 — Registry + gates.** Append the `registry.json` entry from contract §14, run
`pnpm run registry:build`, then `format → check → lint → test:unit --run → build` to green.

Tests are authored before the parts they cover; tasks.md Phase 2 is the authoritative expansion of
this ordering.

## Test plan (Principle III floor → concrete suites)

| Area                              | Representative assertions                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A. Roles & ARIA                   | root `aria-labelledby`/`aria-describedby` resolve to the sr-only label/description; description text differs for audio vs video; `aria-controls` on every control equals the media id; `Play` `aria-pressed` tracks `paused`; sliders expose `role="slider"` + `aria-valuetext`; `Loading` `role="status"`, `Error` `role="alert"` |
| B. Keyboard (`user-event`)        | one test per contract §12 row, incl. `ArrowRight` on audio being inert without `Shift` and active with it; `ArrowUp`/`ArrowDown` inert on audio; digits seek to the right percentage; `Escape` only exits fullscreen; `<`/`>` step through `speeds`; `C` no-op with zero text tracks; `D` no-op without a `Download` part; every key inert when `disabled` |
| C. Controlled vs uncontrolled     | `defaultOpen` opens the speed menu and internal interaction closes it; `bind:open` keeps the parent authoritative and `onOpenChange` still fires; `renditions` with no `renditionId` checks "Auto"; `bind:renditionId` + `onRenditionChange` (research R-20) |
| D. Guard rails                    | `disabled` root blocks pointer *and* keyboard and marks every part `data-disabled`; each non-root part rendered alone throws `/must be used within/` |
| E. RTL                            | `dir="rtl"` lands on the root, on both `Slider.Root`s and on `Time`; `ArrowRight` still seeks forward (FR-024) |
| F. Feedback                       | loading hidden while paused; shown immediately on a first-load stall, delayed by `delay` once `hasPlayed`; hidden the moment loading resolves; error label/description per `MediaError.code`; retry calls `load()`; custom `onRetry`/`onReload` win; volume HUD appears on `ArrowUp` and self-dismisses; nothing rendered (not just hidden) while inactive |
| G. Seek details                   | buffered width reflects `buffered`; chapter separators only with > 1 cue and not `withoutChapter`; `withTime` renders current + remaining; tooltip suppressed while a menu is open |
| H. Time formatting (`time.ts`)    | `M:SS`, `H:MM:SS` past an hour, `0:00` for `NaN`, negative prefix                                                   |
| I. Rendering & composition        | every part renders with its `data-slot`; `child` snippet replaces the default element; caller `class` merged last |
| J. Pointer transport               | click Play / click video surface / seek ± buttons / seek drag-commit / volume drag + mute / `expandable` / `Time` variants (US1) |
| K. Menus                          | `speeds` list + rate applied; Settings speed/captions/quality submenu contents and `renditions` gating (US4) |

Assertions about a teardown must observe a positive effect of the teardown (e.g. the timer no longer
fires *and* a subsequent state change is not applied), never merely "the callback was not called
after unmount", which passes vacuously.

## Complexity Tracking

> No constitution violation is carried forward. The three bespoke behaviours are justified in the
> Constitution Check above under Principle IV, which permits bespoke code with a written
> justification; they are therefore not violations and this table stays empty.

| Principle | Violation | Why Needed | Compliant Alternative Rejected Because |
| --------- | --------- | ---------- | -------------------------------------- |
| —         | none      | —          | —                                      |
