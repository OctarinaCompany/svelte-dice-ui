---
description: 'Task list for the Media Player port'
---

# Tasks: Media Player

**Input**: Design documents from `/specs/035-port-media-player/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [contracts/media-player-api.md](./contracts/media-player-api.md), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Tests**: Mandatory (constitution Principle III / VII). Tests are written before the parts they cover, per the phase order requested for this port.

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- Every task names its exact file path(s) relative to the repository root

## Path Conventions

- Component source: `src/lib/components/ui/media-player/`
- Colocated tests: `src/lib/components/ui/media-player/media-player.test.ts` (+ two test-only support files)
- Demo route: `src/routes/docs/components/media-player/+page.svelte`
- Registry: `registry.json` at the repository root

---

## Phase 1: Setup

**Purpose**: Confirm the dependency surface and stand up the empty component folder + a registry stub, so every later phase has somewhere to write.

- [X] T001 Confirm no new npm dependency is required: `bits-ui` (`^2.18`, for `Slider`/`DropdownMenu`/`Tooltip`/`Portal`), `@lucide/svelte` (`^1.27`), and the existing `src/lib/components/ui/{button,badge,dropdown-menu,spinner,tooltip,direction-provider}` are already installed. Do not run `pnpm add` or `shadcn-svelte add` — record confirmation only, no file changes.
- [X] T002 Create the empty component directory `src/lib/components/ui/media-player/` (no files yet beyond what T011+ create) and the empty docs route directory `src/routes/docs/components/media-player/`, matching the layout in `plan.md` "Project Structure".
- [X] T003 [P] Append a stub entry for `media-player` to the root `registry.json` `items` array: `name: "media-player"`, `type: "registry:ui"`, `title: "Media Player"`, `description` (contract §14), `registryDependencies: ["badge", "button", "dropdown-menu", "spinner", "tooltip", "direction-provider"]`, `dependencies: ["bits-ui", "@lucide/svelte"]`, `files: []` (populated in T039). This is the only edit to `registry.json` until T039.

**Checkpoint**: folders exist, `registry.json` has a placeholder entry, dependency surface confirmed.

---

## Phase 2: Tests (write first — MANDATORY, Principle III/VII)

**Purpose**: Author the full colocated test suite and its jsdom media-stub harness against the documented contract *before* any `.svelte`/`.svelte.ts` implementation file exists. These tests MUST fail (or fail to compile against missing modules) until Phase 3 lands; do not skip or `.todo` any of them to make them pass early.

- [X] T004 [P] Create the jsdom media-stub harness in `src/lib/components/ui/media-player/media-player.test-utils.ts`: a fake `HTMLMediaElement` surface (settable `paused`/`currentTime`/`duration`/`volume`/`muted`/`playbackRate`/`buffered`/`seekable`/`ended`/`readyState`/`seeking`/`loop`/`textTracks`, working `play()`/`pause()`/`load()`, `MediaError` construction, `requestFullscreen`/`exitFullscreen`/`requestPictureInPicture`/`exitPictureInPicture` stubs, and helpers to fire `waiting`/`stalled`/`playing`/`canplay`/`seeked`/`error`/`emptied`/`loadstart` events) per `plan.md` Technical Context and `research.md` R-19. Do not modify `tests/setup.ts`.
- [X] T005 [P] Create the composition test harness `src/lib/components/ui/media-player/media-player.test.svelte`: a thin wrapper component that mounts `MediaPlayer.Root` plus a caller-supplied set of parts (via snippet/props) so `media-player.test.ts` can render arbitrary part combinations without repeating markup in every test.
- [X] T006 Write the roles/ARIA/accessible-name test suite (area A) in `src/lib/components/ui/media-player/media-player.test.ts`: root `aria-labelledby`/`aria-describedby` resolve to the sr-only label/description spans, description text differs for `Video` vs `Audio` (FR-004), `aria-controls` on every control equals the media element's id, `Play` `aria-pressed` tracks `paused`, `Seek`/`Volume` sliders expose `role="slider"` + `aria-valuetext`, `Loading` has `role="status"`/`aria-live="polite"`, `Error` has `role="alert"`/`aria-live="assertive"`, `VolumeIndicator` has `role="status"` and the documented `aria-label`. Use `render`/`screen` from `@testing-library/svelte` and the harness from T004/T005.
- [X] T007 Write the keyboard-interaction test suite (area B) in `src/lib/components/ui/media-player/media-player.test.ts`: one `user-event`-driven case per row of contract §12 / spec "Keyboard Interactions" — `Space`/`K` toggle play/pause; `ArrowRight`/`ArrowLeft` seek ±5s on video and are inert on audio without `Shift`, active with `Shift`; `J`/`L` seek ∓10s/±10s on both; digits `0`–`9` seek to 0–90% of duration; `Home`/`End` seek to start/end; `ArrowUp`/`ArrowDown` change volume ±10% and flash the volume indicator on video only, inert on audio; `M` toggles mute; `R` toggles loop; `F` toggles fullscreen and `Escape` exits it only while fullscreen; `<`/`>` step `speeds`; `C` toggles captions on video with ≥1 text track and is a no-op otherwise; `P` toggles Picture-in-Picture on video; `D` downloads only when a `Download` part is mounted and is a no-op otherwise; every key is inert when the root is `disabled`. Assert `preventDefault()` is called only for keys the root owns.
- [X] T008 Write the controlled-vs-uncontrolled test suite (area C) in `src/lib/components/ui/media-player/media-player.test.ts`: `PlaybackSpeed`/`Settings` `defaultOpen` opens the menu and internal interaction (selecting a speed) closes it; `bind:open` keeps the parent authoritative and `onOpenChange` still fires on internal interaction without the menu closing on its own; `Settings` with `renditions` and no `renditionId` shows "Auto" checked; `bind:renditionId` + `onRenditionChange` fire together and the parent's binding wins (research R-20).
- [X] T008A Write the root-callback test suite (FR-003, SC-002) in `src/lib/components/ui/media-player/media-player.test.ts`: using the T004 media stub, fire `play`/`pause`/`ended`/`timeupdate`/`volumechange`/`error` and `document`'s `fullscreenchange`, and assert each of `onPlay`, `onPause`, `onEnded`, `onTimeUpdate(currentTime)`, `onVolumeChange(volume)`, `onMuted(muted)`, `onMediaError(error)` and `onFullscreenChange(fullscreen)` fires exactly once with the documented payload; assert `onPipError(error, 'enter')` and `onPipError(error, 'exit')` fire when `requestPictureInPicture()`/`exitPictureInPicture()` reject, from both the `P` shortcut and the `PiP` part's own `onPipError`; assert every listener is removed on unmount by firing the same events after unmount and observing no further calls *and* no state change.
- [X] T009 Write the RTL test suite (area E) in `src/lib/components/ui/media-player/media-player.test.ts`: `dir="rtl"` on the root propagates to both `Slider.Root`s (`Seek`, `Volume`) and to `Time`'s `dir` attribute; `ArrowRight`/`ArrowLeft` still seek forward/backward physically regardless of `dir` (FR-024); the controls bar visually mirrors (assert the `dir` attribute chain, not computed CSS).
- [X] T010 Write the guard-rail, feedback-timing, seek-detail and time-formatting test suite (areas D/F/G/H) in `src/lib/components/ui/media-player/media-player.test.ts`: `disabled` blocks pointer *and* keyboard interaction and marks every part `data-disabled`; every non-root part rendered alone throws `` /must be used within/ `` (contract §13); `Loading` stays absent on a still-paused first load and appears within `delay` on a genuine mid-playback stall, disappearing the instant loading resolves (SC-004) — assert teardown by observing the timer no longer firing *and* a subsequent state change not applying, never merely "callback not called after unmount"; `Error` derives label/description per the `MediaError.code` table (contract §5), "Try again" calls `mediaEl.load()` by default and a custom `onRetry` overrides it, same for `onReload`/`location.reload()`; the volume HUD appears on a keyboard volume change and self-dismisses after `VOLUME_INDICATOR_DELAY`; `Loading`/`Error`/`VolumeIndicator` render nothing (assert `.queryByRole` returns `null`, not just hidden) while inactive; `Seek`'s buffered width reflects `buffered`, chapter separators render only with >1 chapter cue and `withoutChapter` is false, `withTime` renders both a current and a remaining `span`, the hover tooltip is suppressed while `menuOpen`; `tooltipTimeVariant="progress"` renders `{current} / {duration}` in the tooltip while the default renders the hovered time alone; a hover at each end of the track keeps the tooltip inside `tooltipCollisionBoundary` honouring `tooltipCollisionPadding` (assert the written `--seek-tooltip-x` value, not computed layout); with no `VolumeIndicator` in the tree the root renders exactly one, and with an explicit `<MediaPlayer.VolumeIndicator />` mounted the root renders none — assert exactly one element with `data-slot="media-player-volume-indicator"` (and one `role="status"` volume region) in both compositions after the registration effect has flushed (divergence #7); `formatTime()` from `src/lib/components/ui/media-player/time.ts` produces `M:SS`, `H:MM:SS` past an hour, `0:00` for `NaN`, and a negative-time case.
- [X] T010A Write the rendering & composition test suite (quickstart §2 row 1) in `src/lib/components/ui/media-player/media-player.test.ts`: every one of the 23 parts renders inside `MediaPlayer.Root` and carries its documented `data-slot` (contract §1–§11); the `child` snippet replaces the default element for `Root`, `Video`, `Controls`, `Play`, `Seek`, `Volume` and `Time` while still receiving the part's own props (spread assertion on the caller-rendered element); `class` from the caller is merged last on each of those parts.
- [X] T010B Write the pointer-transport test suite (quickstart §2 row 3, User Story 1) in `src/lib/components/ui/media-player/media-player.test.ts`: clicking `Play` toggles `paused` and flips `aria-label`/`aria-pressed`/`data-state`; clicking the `Video` surface toggles playback and a caller `onclick` that calls `preventDefault()` suppresses it (FR-005); clicking `SeekBackward`/`SeekForward` moves `currentTime` by their `seconds` props (5 / 10 defaults) clamped to `[0, duration]` (FR-012); pointer-dragging the `Seek` thumb updates the displayed position every frame and commits `currentTime` once on release (SC-003); dragging the `Volume` slider sets `volume` and clicking the volume trigger toggles `muted` and the `data-state`/icon level (FR-014); `expandable` keeps the slider collapsed until hover/`:focus-within`; `Time` renders `progress`, `remaining` and `duration` variants with the values `formatTime` produces (FR-015).
- [X] T010C Write the menu-contents test suite (quickstart §2 row 6, User Story 4) in `src/lib/components/ui/media-player/media-player.test.ts`: `PlaybackSpeed` lists every entry of `speeds`, checks the active one and sets `playbackRate` on selection (FR-016); `Settings` renders the Speed submenu (badge = `{rate}x`), the Captions submenu (badge = active track label or `Off`; items `Off` + each subtitle track; a single disabled "No captions available" when the media has no text tracks) and the Quality submenu only for video with a non-empty `renditions` list, sorted by height descending and labelled `{height}p` → `{width}p` → `id`, with `Auto` first and checked by default (FR-022); opening either menu sets `state.menuOpen` and suppresses the seek tooltip and the volume indicator.
- [X] T010D Write the auto-hide test suite in `src/lib/components/ui/media-player/media-player.test.ts` (FR-002, US3 AS5, spec edge case "a settings/speed dropdown open, or the seek bar being dragged, suppress `autoHide`"): with `autoHide` and the media playing, `Controls`/`ControlsOverlay` lose `data-visible` after the 3000 ms idle timer (`vi.useFakeTimers`) and the root loses `data-controls-visible`; a `mousemove` restores them and restarts the timer; a `mouseleave` hides them immediately; pausing the media, opening the settings menu, or dragging the seek thumb keeps them visible and clears the timer; with `autoHide` unset (default `false`) they never hide; assert the timer teardown positively — after unmount, advancing timers applies no further state change.

**Checkpoint**: the full test suite exists and fails to compile/run because no implementation module exists yet — expected at this point.

---

## Phase 3: Core component files

**Purpose**: Implement the shared state module and every one of the 23 exported parts named in `plan.md`'s Public API section, so the tests written in Phase 2 start passing.

- [X] T011 [P] Implement `src/lib/components/ui/media-player/time.ts`: export `formatTime(seconds: number, guide?: number): string` per data-model.md §4 — `M:SS` normally, `H:MM:SS` once `seconds` or `guide` reaches 3600, `0:00` for `NaN`/`Infinity`/negative-zero, a leading `-` for negative durations. No other exports.
- [X] T012 Implement `src/lib/components/ui/media-player/media-player.svelte.ts` (depends on T011): the `MediaPlayerState` class (data-model.md §1) with constructor props as getter functions, mirrored media `$state` fields, `$derived` fields (`isVideo`, `seekableStart`/`seekableEnd`, `volumeLevel`, `bufferedProgress`, `chapterCues`, `subtitleTracks`, `showingSubtitles`, `captionsActive`, `portalContainer`), ephemeral UI state (`controlsVisible`, `dragging`, `menuOpen`, `volumeIndicatorVisible`), part-registration counters (`volumeIndicatorCount`, `downloadCount`, `registerPart`), every method in data-model.md §1.7 (`togglePlay`, `seekTo`/`seekBy`/`seekToPercent`, `setVolume`, `toggleMute`/`toggleLoop`, `stepPlaybackRate`/`setPlaybackRate`, `toggleCaptions`, `showSubtitleTrack`/`hideSubtitles`, `toggleFullscreen`, `togglePip`, `download`, `retry`, `showControls`/`hideControls`, `flashVolumeIndicator`, `onRootKeydown`, `onRootKeyup`), the constants in data-model.md §3, the supporting types in data-model.md §2, and the `Symbol`-keyed `setMediaPlayerContext`/`getMediaPlayerContext(consumerName)` pair that throws `` `<MediaPlayer.${consumerName}>` must be used within `<MediaPlayer>`. `` per CLAUDE.md §5. Every timer/RAF/listener/observer this class starts must be stoppable from a caller-owned `$effect` teardown — do not start browser-API listeners in the constructor itself.
- [X] T013 [P] Implement `src/lib/components/ui/media-player/media-player-portal.svelte` (depends on T012): `MediaPlayerPortalProps` (`container?`, `children`) per contract §11; renders nothing when no container resolves; defaults to `context.portalContainer`. Compose `bits-ui` `Portal`.
- [X] T014 Implement `src/lib/components/ui/media-player/media-player-tooltip.svelte` (depends on T012, T013): `MediaPlayerTooltipProps` (`tooltip?`, `shortcut?`, `delayDuration?`, `sideOffset?`, `children`) per contract §11; renders `{@render children()}` bare when `withoutTooltip` is set or neither `tooltip` nor `shortcut` is given; shortcuts render as `<kbd data-slot="kbd"><abbr title={key}>{key}</abbr></kbd>`; compose the existing `tooltip` shadcn component with `portalProps={{ to: context.portalContainer }}` (research R-04).
- [X] T015 Implement `src/lib/components/ui/media-player/media-player.svelte` (Root, depends on T012): `MediaPlayerRootProps` per contract §2 — `dir`/`label`/`tooltipDelayDuration`/`tooltipSideOffset`/`autoHide`/`disabled`/`withoutTooltip`, `ref` bindable, the nine callback props, `children`/`child` snippets. Renders `data-slot="media-player"`, `tabindex={disabled ? undefined : 0}`, `aria-labelledby`/`aria-describedby`/`aria-disabled`/`dir`, a `sr-only` label span, a `sr-only` description span whose text differs for video/audio (FR-004), `data-state="fullscreen"|"windowed"`, `data-controls-visible`, `data-disabled`; wraps children in the `tooltip` component's `Provider`; instantiates `MediaPlayerState` and calls `setMediaPlayerContext`; wires `onRootKeydown` on `keydown`; renders its own `VolumeIndicator` only when `state.volumeIndicatorCount === 0` (research R-12 / divergence #7); wires `onRootKeydown` on `keydown` and `state.flashVolumeIndicator()` on `keyup` for `ArrowUp`/`ArrowDown`/`M`; wires `onmousemove` → `state.showControls()` and `onmouseleave` → immediate `state.hideControls()` (both only when `autoHide` and not `paused`/`menuOpen`/`dragging`, both forwarding the caller handler first and returning early on `defaultPrevented`); keeps `controlsVisible === true` and the hide timer cleared whenever `paused || menuOpen || dragging` (data-model §1.5 invariant, FR-002, US3 AS5).
- [X] T016 [P] Implement `src/lib/components/ui/media-player/media-player-video.svelte` (depends on T012, T015): `MediaPlayerVideoProps = WithElementRef<HTMLVideoAttributes>`; use Svelte's native media bindings (`bind:paused`, `bind:currentTime`, `bind:duration`, `bind:volume`, `bind:muted`, `bind:playbackRate`, `bind:buffered`, `bind:seekable`, `bind:ended`) to mirror onto `MediaPlayerState` instead of manual event listeners, per CLAUDE.md's component-specific guidance and research R-01; register `bind:this` as `state.mediaEl`; set `id={context.mediaId}`, `aria-labelledby`, `aria-describedby`, `data-slot="media-player-video"`; toggle playback on `click`, forwarding any caller `onclick` first and respecting `defaultPrevented` (FR-005); pass through `<source>`/`<track>` children via `children`.
- [X] T017 [P] Implement `src/lib/components/ui/media-player/media-player-audio.svelte` (depends on T012, T015): `MediaPlayerAudioProps = WithElementRef<HTMLAudioAttributes>`; identical media-binding wiring to T016 (`bind:paused`/`bind:currentTime`/`bind:duration`/`bind:volume`/`bind:muted`/`bind:playbackRate`/`bind:buffered`/`bind:seekable`/`bind:ended`), `id={context.mediaId}`, `aria-labelledby`/`aria-describedby`, `data-slot="media-player-audio"`; no click-to-toggle (audio has no visual surface to click).
- [X] T018 [P] Implement `src/lib/components/ui/media-player/media-player-controls.svelte` (depends on T012): `MediaPlayerControlsProps = WithElementRef<HTMLAttributes<HTMLDivElement>>`; `data-slot="media-player-controls"`, `data-state`, `data-visible`, `data-disabled`; hidden via opacity + `pointer-events-none` (never `display:none`) when `!state.controlsVisible` (FR-006).
- [X] T019 [P] Implement `src/lib/components/ui/media-player/media-player-controls-overlay.svelte` (depends on T012): `MediaPlayerControlsOverlayProps = WithElementRef<HTMLAttributes<HTMLDivElement>>`; `data-slot="media-player-controls-overlay"`, `data-state`, `data-visible`; decorative gradient backdrop, same visibility rule as T018 (FR-007).
- [X] T020 [P] Implement `src/lib/components/ui/media-player/media-player-loading.svelte` (depends on T012): `MediaPlayerLoadingProps` (`delay?: number = 500`); renders nothing unless `loading && !paused`; delay applies only once `hasPlayed` is true (FR-008, SC-004); `role="status"`, `aria-live="polite"`, `data-slot="media-player-loading"`; default body is the existing `spinner` component. Own `$effect` owns the delay timer and clears it in its teardown.
- [X] T021 [P] Implement `src/lib/components/ui/media-player/media-player-error.svelte` (depends on T012): `MediaPlayerErrorProps` (`error?`, `label?`, `description?`, `onRetry?`, `onReload?`); renders nothing without an error; `role="alert"`, `aria-live="assertive"`, `aria-labelledby`/`aria-describedby`, `data-slot="media-player-error"`, `data-state`; derive label/description from `MediaError.code` per the table in contract §5 unless overridden; two `button` components — "Try again" (`variant="secondary"`, calls `onRetry ?? state.retry`) and "Reload page" (`variant="outline"`, calls `onReload ?? (() => location.reload())`) — each `disabled` + `spinner` while its action is pending.
- [X] T022 [P] Implement `src/lib/components/ui/media-player/media-player-volume-indicator.svelte` (depends on T012): `MediaPlayerVolumeIndicatorProps` (no own props); renders nothing unless `state.volumeIndicatorVisible`; `role="status"`, `aria-live="polite"`, `aria-label={`Volume ${muted ? 'muted' : `${percent}%`}`}`, `data-slot="media-player-volume-indicator"`; shows the volume icon, `Muted`/`{percent}%` text, and a 10-bar graph with `ceil(volume * 10)` active bars. Call `registerPart('volume-indicator')` in an `$effect` and its teardown.
- [X] T023 [P] Implement `src/lib/components/ui/media-player/media-player-play.svelte` (depends on T012, T014): button per contract §6 — `aria-label` "Play"/"Pause", `aria-pressed={!paused}`, `data-slot="media-player-play-button"`, `data-state="off"|"on"`, wrapped in `MediaPlayerTooltip` (tooltip "Play"/"Pause", shortcut `Space`), calls `state.togglePlay()`, honors `disabled || context.disabled`.
- [X] T024 [P] Implement `src/lib/components/ui/media-player/media-player-seek-backward.svelte` (depends on T012, T014): `seconds?: number = 5`; `aria-label={`Back ${seconds} seconds`}`, `data-slot="media-player-seek-backward"`, tooltip `` `Back ${n}s` ``, shortcut `←` (or `Shift ←` on audio); calls `state.seekBy(-seconds)`.
- [X] T025 [P] Implement `src/lib/components/ui/media-player/media-player-seek-forward.svelte` (depends on T012, T014): `seconds?: number = 10`; `aria-label={`Forward ${seconds} seconds`}`, `data-slot="media-player-seek-forward"`, tooltip `` `Forward ${n}s` ``, shortcut `→` (or `Shift →` on audio); calls `state.seekBy(seconds)`.
- [X] T026 [P] Implement `src/lib/components/ui/media-player/media-player-loop.svelte` (depends on T012, T014): `aria-label` "Enable loop"/"Disable loop", `aria-pressed={loop}`, `data-slot="media-player-loop"`, `data-state`, tooltip/shortcut `R`; calls `state.toggleLoop()`; stays in sync if `loop` changes by any other means (`MutationObserver` on the element's `loop` property per data-model.md §1.3, FR-017).
- [X] T027 [P] Implement `src/lib/components/ui/media-player/media-player-fullscreen.svelte` (depends on T012, T014): `aria-label` "Enter fullscreen"/"Exit fullscreen", `data-slot="media-player-fullscreen"`, `data-state`, tooltip/shortcut `F`; calls `state.toggleFullscreen()`.
- [X] T028 [P] Implement `src/lib/components/ui/media-player/media-player-pip.svelte` (depends on T012, T014): `onPipError?`, `children?: Snippet<[boolean]>` (receives current PiP state); `aria-label` "Enter pip"/"Exit pip", `data-slot="media-player-pip"`, `data-state`, tooltip/shortcut `P`; calls `state.togglePip()`; video only.
- [X] T029 [P] Implement `src/lib/components/ui/media-player/media-player-captions.svelte` (depends on T012, T014): `aria-label` "Enable captions"/"Disable captions", `aria-pressed={captionsActive}`, `data-slot="media-player-captions"`, `data-state`, tooltip/shortcut `C`; calls `state.toggleCaptions()`; no-op when there are zero subtitle tracks (FR-020).
- [X] T030 [P] Implement `src/lib/components/ui/media-player/media-player-download.svelte` (depends on T012, T014): `aria-label` "Download", `data-slot="media-player-download"`, tooltip/shortcut `D`; calls `state.download()`; registers itself via `state.registerPart('download')` in an `$effect` + teardown so the root `D` shortcut only fires when this part is mounted (FR-021, divergence #8).
- [X] T031 [P] Implement `src/lib/components/ui/media-player/media-player-seek.svelte` (depends on T012, T014): `MediaPlayerSeekProps` per contract §7 (`withTime`, `withoutChapter`, `withoutTooltip`, `tooltipThumbnailSrc`, `tooltipTimeVariant`, `tooltipSideOffset`, `tooltipCollisionBoundary`, `tooltipCollisionPadding`, `disabled`, plus the allowed `Slider.RootProps` subset); compose `bits-ui` `Slider.Root`; `aria-controls={mediaId}`, `aria-valuetext`, `data-slider=""`, `data-hovering`, `data-disabled`; render the buffered range, hover range, chapter separators (only when `chapterCues.length > 1` and not `withoutChapter`), and — unless `withoutTooltip` — a hover/drag tooltip (bespoke rAF-driven positioning per research R-04, `--seek-hover-percent`/`--seek-tooltip-x`/`--seek-tooltip-y` CSS custom properties) showing hovered time, active chapter title, and `tooltipThumbnailSrc` when supplied; throttle the committed seek to one `requestAnimationFrame` per drag (SC-003), commit on release; `withTime` wraps the slider with current/remaining `span`s.
- [X] T032 [P] Implement `src/lib/components/ui/media-player/media-player-volume.svelte` (depends on T012, T014): `MediaPlayerVolumeProps` (`expandable?: boolean = false`, plus the allowed `Slider.RootProps` subset); a mute `button` (`data-slot="media-player-volume-trigger"`, `aria-label` "Mute"/"Unmute", `aria-pressed={muted}`, `data-state`) + `bits-ui` `Slider.Root` (`data-slot="media-player-volume"`, `data-slider=""`, `min=0 max=1 step=0.1`, `aria-valuetext={`${percent}% volume`}`) inside `data-slot="media-player-volume-container"`; `expandable` collapses the slider to `w-0 opacity-0` until the container is hovered or `:focus-within`.
- [X] T033 [P] Implement `src/lib/components/ui/media-player/media-player-time.svelte` (depends on T012): `MediaPlayerTimeProps` (`variant?: 'progress' | 'remaining' | 'duration' = 'progress'`); `data-slot="media-player-time"`, `data-variant`, `dir`; `progress` renders `<span>{current}</span><span role="separator" aria-hidden="true">/</span><span>{duration}</span>` using `formatTime` from `time.ts`; updates at least once per second during playback.
- [X] T034 [P] Implement `src/lib/components/ui/media-player/media-player-playback-speed.svelte` (depends on T012): `MediaPlayerPlaybackSpeedProps` per contract §10 (`open` bindable, `defaultOpen`, `onOpenChange`, `modal`, `sideOffset`, `speeds` default `MEDIA_PLAYER_SPEEDS`, `disabled`); compose the existing `dropdown-menu` component; trigger shows `` `${playbackRate}x` ``; menu lists each speed with a checkmark on the active one; opening sets `state.menuOpen`; `data-slot="media-player-playback-speed"`; `data-disabled` on the trigger when `disabled || context.disabled`.
- [X] T035 [P] Implement `src/lib/components/ui/media-player/media-player-settings.svelte` (depends on T012): `MediaPlayerSettingsProps` per contract §10 — everything `PlaybackSpeed` accepts plus `renditions` (default `[]`), `renditionId` (bindable), `onRenditionChange`; compose `dropdown-menu` with a `Speed` submenu (badge shows `` `${rate}x` ``), a `Quality` submenu (video + non-empty `renditions` only; `Auto` first, then renditions sorted by height descending, labelled `` `${height}p` `` → `` `${width}p` `` → `id`), a `Captions` submenu (badge shows the active track's label or "Off"; items: "Off", each subtitle track, or a single disabled "No captions available" when there are none); `aria-label="Settings"`, `data-slot="media-player-settings"`; `data-disabled` on the trigger when `disabled || context.disabled`.

**Checkpoint**: all 23 parts + the state module + `time.ts` exist; the Phase 2 test suite can now import real modules (barrel not wired yet — full green happens after Phase 4/7).

---

## Phase 4: Barrel and types

- [X] T036 Implement `src/lib/components/ui/media-player/index.ts` (depends on T011–T035): export every part under both its short name and `MediaPlayer*` prefixed alias per contract §1's table (`Root`/`MediaPlayer`, `Video`/`MediaPlayerVideo`, … `Tooltip`/`MediaPlayerTooltip`), `export type` for every `MediaPlayer*Props` type, plus `MediaPlayerState`, `setMediaPlayerContext`, `getMediaPlayerContext`, `MEDIA_PLAYER_SPEEDS`, `SEEK_STEP_SHORT`, `SEEK_STEP_LONG`, `formatTime`, and the supporting types from data-model.md §2, following the barrel shape in CLAUDE.md §3.

**Checkpoint**: `import * as MediaPlayer from '$lib/components/ui/media-player/index.js'` resolves every part/type; Phase 2's tests can now run to green (fix any implementation gaps they surface before continuing).

---

## Phase 5: Demo route

- [X] T037 Create `src/routes/docs/components/media-player/+page.svelte` with the page header and six `ComponentPreview` sections mirroring the upstream demos (FR-026, SC-007): "Default" (`media-player-demo.tsx` — video, controls, seek/volume/time/play), "Audio Player" (`media-player-audio-demo.tsx`), "With Settings Menu" (`media-player-settings-demo.tsx` — speed/captions/quality), "HLS Playback" (`media-player-hls-demo.tsx` — native-HLS `.m3u8` source per research R-18, no `hls.js`), "With Error Handling" (`media-player-error-demo.tsx` — a source that fails, retry/reload), "With Playlist" (`media-player-playlist-demo.tsx` — composes the existing `scroll-area` + `sonner` toast, swaps sources, reacts to `ended`). Use locally hosted or well-known public sample media per spec.md Assumptions (no ephemeral third-party URLs). Keep all demo state in the page with runes; no `+page.ts`.
- [X] T038 Extend `src/routes/docs/components/media-player/+page.svelte` (depends on T037, same file) with one `table` (existing shadcn `table` component) props reference per exported part (name, type, default) generated from the contract, and a "Credits" section crediting the upstream Dice UI `media-player` component per its MDX §Credits.

**Checkpoint**: `pnpm run dev` renders `/docs/components/media-player` with all six sections and props tables.

---

## Phase 6: Registry entry and docs polish

- [X] T039 Replace the `files: []` stub from T003 in the root `registry.json` `media-player` entry with the full list of 26 registry files: `index.ts`, `media-player.svelte.ts`, `time.ts`, the root part `media-player.svelte`, and the 22 `media-player-<part>.svelte` files (video, audio, controls, controls-overlay, loading, error, volume-indicator, play, seek-backward, seek-forward, seek, volume, time, playback-speed, loop, fullscreen, pip, captions, download, settings, portal, tooltip) (each `{ "path": "src/lib/components/ui/media-player/<file>", "type": "registry:ui" }`), per contract §14. Do not list the three test-only files (`media-player.test.ts`, `media-player.test.svelte`, `media-player.test-utils.ts`).
- [X] T040 Run `pnpm run registry:build` (depends on T039) and verify `static/r/media-player.json` (or the equivalent generated artifact) is produced with `$lib/...` imports rewritten to registry placeholders; fix the `registry.json` entry if the build reports a missing/misnamed file.

**Checkpoint**: the component is installable through the registry exactly like every other ported component (SC-006).

---

## Phase 7: Verification (MANDATORY — Principle VII)

**Purpose**: The feature is not complete until all four gates are green, with zero suppressions (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `svelte-ignore`, `as any`, `.skip`/`.todo`, deleted assertions, loosened configs). Fix root causes.

- [X] T041 Run `pnpm run check`, `pnpm run lint`, `pnpm run test:unit -- --run` and `pnpm run build`, and fix everything that fails.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Tests (Phase 2)**: depends on Setup (needs the empty folder to write into); T004/T005 (harnesses) before T006–T010 (suites) since every suite imports them.
- **Core component files (Phase 3)**: depends on Tests existing (T004–T010, T008A, T010A–T010D written, even though they don't pass yet). Within Phase 3: T011 (`time.ts`) before T012 (state module) before every part; T013 (`Portal`) before T014 (`Tooltip`); T014 before every button/menu part that wraps in `MediaPlayerTooltip` (T023–T032); T015 (`Root`) before T016/T017 (`Video`/`Audio`) since they read `context.mediaId`.
- **Barrel and types (Phase 4)**: depends on all of Phase 3 (T011–T035).
- **Demo route (Phase 5)**: depends on Phase 4 (imports the barrel); T038 depends on T037 (same file).
- **Registry entry and docs polish (Phase 6)**: depends on Phase 4 (needs the final file list) and, for T040, on T039.
- **Verification (Phase 7)**: depends on every prior phase; always the last task.

### Parallel Opportunities

- Phase 1: T003 can run alongside T001/T002.
- Phase 2: T004 and T005 in parallel; T006–T010 all edit the same file (`media-player.test.ts`) so they run sequentially, though they can be drafted independently before merging.
- Phase 3: T011 alone first; then T012; then T013; then T014; then T015; then T016–T035 are all `[P]` against each other (23 distinct files, no part imports another part) — the largest parallel batch in this feature.
- Phase 5: T037 then T038 (same file, sequential).

---

## Parallel Example: Phase 3 button/menu batch

```bash
# After T012 (state module) and T014 (Tooltip part) are done, these 19 parts
# have no remaining inter-part dependency and can be built in parallel:
Task: "Implement media-player-video.svelte"
Task: "Implement media-player-audio.svelte"
Task: "Implement media-player-controls.svelte"
Task: "Implement media-player-controls-overlay.svelte"
Task: "Implement media-player-loading.svelte"
Task: "Implement media-player-error.svelte"
Task: "Implement media-player-volume-indicator.svelte"
Task: "Implement media-player-play.svelte"
Task: "Implement media-player-seek-backward.svelte"
Task: "Implement media-player-seek-forward.svelte"
Task: "Implement media-player-loop.svelte"
Task: "Implement media-player-fullscreen.svelte"
Task: "Implement media-player-pip.svelte"
Task: "Implement media-player-captions.svelte"
Task: "Implement media-player-download.svelte"
Task: "Implement media-player-seek.svelte"
Task: "Implement media-player-volume.svelte"
Task: "Implement media-player-time.svelte"
Task: "Implement media-player-playback-speed.svelte"
Task: "Implement media-player-settings.svelte"
```

---

## Implementation Strategy

### Sequential (single implementer)

1. Phase 1 Setup → Phase 2 Tests (all fail/don't compile — expected) → Phase 3 Core (`time.ts` → state module → `Portal` → `Tooltip` → `Root` → the remaining 19 parts) → re-run tests, fix gaps → Phase 4 Barrel → Phase 5 Demo → Phase 6 Registry → Phase 7 Verification.
2. Do not reorder Phase 2 ahead of writing the test harnesses (T004/T005), and do not implement a part before its test rows exist — the constitution's test-first requirement applies per part, not just per feature.

### Incremental Delivery Checkpoints

1. After Phase 3 + Phase 4: the component is fully usable from a plain Svelte file via relative imports (not yet installable).
2. After Phase 6: the component is installable through `registry.json` like any other ported component (SC-006).
3. After Phase 7: shippable — all four quality gates green with zero suppressions.

---

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task.
- Every part's props, defaults, data attributes, ARIA and `data-slot` values are the ones enumerated in `contracts/media-player-api.md` — treat that file, not this one, as the source of truth for exact prop names when implementing.
- Bind to the media element with Svelte's native media bindings (`bind:currentTime`, `bind:paused`, `bind:duration`, `bind:volume`, `bind:muted`, `bind:playbackRate`, `bind:buffered`, `bind:seekable`, `bind:ended`) in T016/T017 instead of manual `addEventListener` calls, per research R-01.
- Captions/text-track support (T029, T035's Captions submenu) must not be dropped — it is FR-020 and part of the mandatory contract, not an optional extra.
- Do NOT run git write commands or touch `.reference/`, `.specify/`, `.claude/`, `scripts/`, `.port-state.json`, `.port-logs/` — the orchestrator owns the working tree and those paths (constitution Principle X).

---

## Phase 8: Convergence

**Purpose**: Close the gaps a post-implementation audit found between the shipped code and
`spec.md` / `plan.md` / the Phase 2 test contract. All four quality gates are already green
(`prettier --check` + `eslint` clean, `svelte-check` 0 errors, 2971 tests passing, `build` clean) and
`registry.json` + `static/r/media-player.json` are complete with all 26 files — every item below is a
documented behaviour that exists in the code but is never asserted, plus one missing demo section.
Re-run the Phase 7 gates after finishing.

- [X] T042 Assert the seek hover tooltip's contents in `src/lib/components/ui/media-player/media-player.test.ts`: hovering the track sets `data-hovering` on `[data-slot="media-player-seek"]` and renders `media-player-seek-tooltip`; `tooltipTimeVariant="progress"` renders `{hovered} / {duration}` in `media-player-seek-time` while the `current` default renders the hovered time alone; `tooltipThumbnailSrc` (both the string and the `(time) => string` form) renders `media-player-seek-thumbnail` with the computed `src`; a hover inside a chapter cue renders that cue's text in `media-player-seek-chapter-title`, and `withoutChapter` removes it. The harness already exposes `seekTooltipTimeVariant` / `seekTooltipThumbnailSrc` — wire them up rather than adding new props. Per FR-013 / SC-002 (partial)
- [X] T043 Assert the seek tooltip's collision clamping in `src/lib/components/ui/media-player/media-player.test.ts`: with an explicit `tooltipCollisionBoundary` and a numeric and an object `tooltipCollisionPadding`, a hover at each end of the track leaves the written `--seek-tooltip-x` inside the boundary minus its padding (read the custom property from `media-player-seek-tooltip`'s inline style — never computed layout, which jsdom does not produce). Add the two props to `media-player.test.svelte` alongside the existing seek options. Per spec Edge Cases ("hovering the seek bar near the player's edge") / plan test-plan area G (partial)
- [X] T044 Add an RTL section to `src/routes/docs/components/media-player/+page.svelte`: one `<ComponentPreview title="Right to Left">` holding a `dir="rtl"` video composition and a `dir="rtl"` audio composition, so the mirrored seek/volume sliders and controls bar are verifiable on the docs page as SC-005 requires. Keep the existing six upstream-mirroring sections and the props tables untouched. Per SC-005 (missing)
- [X] T045 Assert `MediaPlayer.Tooltip` in `src/lib/components/ui/media-player/media-player.test.ts`: a part with `tooltip` and `shortcut` renders the documented `<kbd data-slot="kbd"><abbr title={key}>{key}</abbr></kbd>` markup with one `kbd` per key of a `string[]` shortcut; `withoutTooltip` on the root renders `{@render children()}` bare with no tooltip trigger wrapper anywhere in the tree; a part given neither `tooltip` nor `shortcut` also renders bare; `delayDuration` / `sideOffset` fall back to the root's values. The harness already accepts `withoutTooltip`. Per FR-002 / contract §11 (partial)
- [X] T046 Assert `MediaPlayer.Portal` in `src/lib/components/ui/media-player/media-player.test.ts`: with no `container` prop it portals into `context.portalContainer` (`document.body` while windowed), an explicit `container` element wins over the context default, and it renders nothing at all when no container resolves. Per contract §11 / SC-002 (partial)
- [X] T047 Repair the class-merge assertion in `src/lib/components/ui/media-player/media-player.test.ts`: the current "merges the caller class last" case renders the harness without any `class` prop, so nothing about merge order is exercised. Thread a caller `class` through `media-player.test.svelte` for `Root`, `Video`, `Controls`, `Play`, `Seek`, `Volume` and `Time`, and assert on each that the caller's class is present alongside the part's own layout classes. Per T010A / constitution Principle VIII (partial)
- [X] T048 Assert the external `loop` sync in `src/lib/components/ui/media-player/media-player.test.ts`: flipping the media element's `loop` attribute outside the component (the `MutationObserver` path in `media-player.svelte.ts`) updates `state.loop`, the `MediaPlayer.Loop` button's `aria-pressed` and its `data-state`, with no click on the loop control involved. Per FR-017 (partial)
- [X] T049 Assert the error actions' pending state in `src/lib/components/ui/media-player/media-player.test.ts`: activating "Try again" disables that button and swaps its icon for the spinner until the retry resolves, and activating "Reload page" does the same, with each button's pending state independent of the other. Per FR-009 / contract §5 (partial)
- [X] T050 Assert that `MediaPlayer.Time` updates live in `src/lib/components/ui/media-player/media-player.test.ts`: advancing the stub's `currentTime` and firing `timeupdate` moves the `progress` and `remaining` readouts to the new `formatTime` output, and the `duration` variant stays put — the existing variant cases only sample `currentTime = 0`. Per FR-015 / US1 AS6 (partial)
- [X] T051 Assert `MediaPlayer.PiP`'s children snippet in `src/lib/components/ui/media-player/media-player.test.ts`: a caller-supplied `children` snippet receives the current Picture-in-Picture state and re-renders from `false` to `true` when PiP is entered, covering the Svelte replacement for upstream's `(isPictureInPicture) => ReactNode` render prop. Per contract §6 (partial)
