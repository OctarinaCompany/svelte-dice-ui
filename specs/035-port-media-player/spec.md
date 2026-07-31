# Feature Specification: Media Player

**Feature Branch**: `035-port-media-player`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "Port the Dice UI React component \"Media Player\" (slug: media-player) to this SvelteKit + shadcn-svelte project."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Watch or listen with essential transport controls (Priority: P1)

A person opens a page containing a video or audio player. They can start and pause playback, see
elapsed and total time, drag a seek bar to jump to any point, and adjust volume — all through a
custom-styled control bar that matches the rest of the site instead of the browser's native media
chrome.

**Why this priority**: This is the baseline capability of the component — without play/pause, time
display, seeking and volume, nothing else has meaning. It must work standalone as the MVP.

**Independent Test**: Render a `MediaPlayer` root containing a video (or audio) element, a controls
bar with a play button, a seek slider, a time display and a volume slider, and no other parts;
verify play/pause toggles playback and the button's icon/label, the seek slider's thumb tracks
playback and dragging it jumps the media, and the volume slider changes and mutes/unmutes the
media's volume.

**Acceptance Scenarios**:

1. **Given** a paused player, **When** the user activates the play control, **Then** playback
   starts, the control's icon switches to "pause", and its accessible label/pressed state updates.
2. **Given** a playing player, **When** the user activates the play control again, **Then**
   playback pauses and the control reverts to "play".
3. **Given** a player with known duration, **When** the user drags the seek slider's thumb,
   **Then** the media's current time follows the drag position continuously and commits to that
   position on release, while the displayed current/duration time updates to match.
4. **Given** a player with buffered data, **When** the seek track is rendered, **Then** the
   buffered range is visually distinguished from the unplayed range and the played range.
5. **Given** a player at any volume, **When** the user drags the volume slider or activates the
   mute control, **Then** the media's volume/muted state changes accordingly and the volume
   control's icon reflects muted/low/high volume.
6. **Given** the controls bar, **When** the current/duration time is displayed, **Then** it is
   formatted as `M:SS` (or `H:MM:SS` once the duration reaches an hour) and updates at least once
   per second during playback.

---

### User Story 2 - Operate the player entirely from the keyboard (Priority: P2)

A keyboard-only or screen-reader user needs every documented shortcut to work exactly as upstream
specifies: play/pause, seek by fixed and percentage increments, volume, mute, loop, fullscreen,
speed, captions, Picture-in-Picture and download — without ever touching a pointer.

**Why this priority**: Accessibility parity is non-negotiable for this library (constitution
Principle III); keyboard coverage is what makes the extended control set in this story usable at
all, and it builds directly on the transport controls from User Story 1.

**Independent Test**: Render a fully-equipped player (all button/menu parts present) with a
focused/loaded media element; drive every key listed in the Keyboard section below through
`user-event` and assert the corresponding, single, correctly-scoped effect (e.g. `ArrowRight` on a
focused video seeks forward 5s but does nothing on a focused audio player unless `Shift` is held).

**Acceptance Scenarios**:

1. **Given** the player or the media element is focused, **When** `Space` or `K` is pressed,
   **Then** playback toggles.
2. **Given** a video player is focused, **When** `ArrowRight`/`ArrowLeft` is pressed, **Then** the
   media seeks forward/backward 5 seconds; **When** `J`/`L` is pressed, **Then** it seeks
   backward/forward 10 seconds, on both video and audio.
3. **Given** an audio player is focused, **When** `ArrowRight`/`ArrowLeft` is pressed without
   `Shift`, **Then** nothing happens; **When** pressed with `Shift`, **Then** the media seeks
   forward/backward 5 seconds.
4. **Given** a video player is focused, **When** `ArrowUp`/`ArrowDown` is pressed, **Then** volume
   increases/decreases by 10 percentage points and a transient volume indicator appears; the same
   keys do nothing on an audio-only player.
5. **Given** the player is focused, **When** a digit `0`-`9` is pressed, **Then** the media seeks
   to that percentage (0%-90%) of duration; **When** `Home`/`End` is pressed, **Then** it seeks to
   the start/end.
6. **Given** the player is focused, **When** `M` is pressed, **Then** mute toggles; **When** `R` is
   pressed, **Then** loop toggles; **When** `F` is pressed, **Then** fullscreen toggles and
   `Escape` exits it; **When** `<`/`>` is pressed, **Then** playback speed steps down/up through
   the configured speed list; **When** `C` is pressed on a video with available text tracks,
   **Then** captions toggle; **When** `P` is pressed on a video, **Then** Picture-in-Picture
   toggles; **When** `D` is pressed and a download control is rendered, **Then** the current media
   file downloads.
7. **Given** the player is `disabled`, **When** any of the above keys is pressed, **Then** no
   action occurs.

---

### User Story 3 - Understand player state through visual feedback (Priority: P3)

A viewer needs to know when media is buffering, when playback has failed (and be able to retry or
reload), when they have changed the volume via keyboard, and — while hovering the seek bar — what
moment and chapter they are about to jump to, including a thumbnail preview when one is supplied.

**Why this priority**: These are rich, additive feedback layers built on top of the transport
controls from User Story 1; the player is fully usable without them, but they are what upstream
documents as first-class parts and they materially affect perceived quality and error recovery.

**Independent Test**: Render a player with the loading indicator, error part, volume indicator and
a seek bar with chapter cues and a thumbnail source; simulate a stalled load, a media error, a
keyboard volume change, and a seek-bar hover; verify each part appears/disappears and shows the
expected content at the right time, and that retry/reload controls in the error state work.

**Acceptance Scenarios**:

1. **Given** media is buffering while playing (not on first load), **When** loading persists past
   its delay, **Then** a loading indicator appears; **When** loading resolves, **Then** it
   disappears immediately.
2. **Given** media playback fails, **When** the error occurs, **Then** an alert region with a
   label, description, "Try again" and "Reload page" action replaces the normal surface; **When**
   "Try again" is activated, **Then** the media reloads its current source; **When** "Reload page"
   is activated, **Then** the page reload is requested.
3. **Given** a video player, **When** the user changes volume via `ArrowUp`/`ArrowDown` or `M`,
   **Then** a transient, auto-dismissing volume indicator shows the percentage (or "Muted") and a
   bar-graph representation, then disappears after a short delay.
4. **Given** a seek bar with chapter cues, **When** the user hovers/drags over it, **Then** a
   tooltip shows the hovered time (and, when supplied, a thumbnail image and the active chapter's
   title), and chapter boundaries are visually marked on the track.
5. **Given** `autoHide` is enabled and the media is playing, **When** the pointer/keyboard is idle
   for the configured delay, **Then** the controls bar fades out; **When** the pointer moves,
   focus changes, or the media pauses, **Then** it reappears immediately.

---

### User Story 4 - Compose richer players from the same parts (Priority: P4)

A developer builds an audio-only player, a player with a settings menu (speed, captions, and — when
supplied — quality), and a playlist player that swaps sources, reusing the same parts in different
arrangements, under both `dir="ltr"` and `dir="rtl"`, and with the whole player `disabled`.

**Why this priority**: This proves the part-based composition model that is the point of shipping a
registry component rather than a monolithic widget; it depends on every part introduced in the
prior stories being independently usable.

**Independent Test**: Render the audio-only, settings-menu and playlist demo compositions from the
documentation page; verify each renders correctly, that the settings menu exposes speed/captions/
quality (quality only when a rendition list is supplied) with a checkmark on the active choice, and
that switching to `dir="rtl"` mirrors the seek/volume sliders' visual direction without changing
which physical key seeks which way.

**Acceptance Scenarios**:

1. **Given** an audio-only composition, **When** it is rendered, **Then** it behaves identically to
   a video composition for every part it includes (play, seek, volume, speed, loop) and requires no
   video-only parts.
2. **Given** the settings menu, **When** it is opened, **Then** it lists a "Speed" submenu (checked
   item = current rate), a "Captions" submenu (checked item = active track, "Off" when none, "No
   captions available" when the media has no text tracks), and, only when a rendition list is
   supplied, a "Quality" submenu (checked item = current selection, "Auto" default).
3. **Given** `disabled` is set on the root, **When** any control is activated by pointer or
   keyboard, **Then** no action occurs and every interactive part exposes its disabled state.
4. **Given** `dir="rtl"`, **When** the player renders, **Then** the seek and volume sliders and the
   controls bar mirror horizontally, while the physical meaning of every keyboard shortcut in User
   Story 2 is unchanged (arrow-key seek direction is not direction-sensitive upstream, and this
   port does not change that).

### Edge Cases

- A media element with no source, or a source that never resolves, never shows a loading indicator
  on first load (the delay only applies after the media has played at least once); the loading
  indicator's own delay defaults to 500ms and is configurable.
- Seeking past the end or before the start clamps to `[0, duration]`; seeking while `duration` is
  unknown (`NaN`) is a no-op.
- Rapid, repeated seek-slider drags do not each dispatch a real seek; visible position updates
  immediately while the committed seek is throttled to at most once per animation frame, with a
  final commit on release.
- Hovering the seek bar near the player's edge keeps the hover tooltip fully within the player's
  bounds (and any supplied collision boundary) instead of overflowing off-screen.
- A settings/speed dropdown open, or the seek bar being dragged, both suppress `autoHide` from
  hiding the controls and suppress the seek tooltip and volume indicator from competing with the
  open menu.
- Pressing `C` (captions) when the video has zero text tracks is a no-op; the settings menu's
  captions submenu shows "No captions available" instead of an empty list in the same situation.
- Pressing `D` (download) when no download control is rendered anywhere in the player is a no-op —
  the shortcut only acts when a `MediaPlayerDownload` part exists in the tree.
- Pressing `P` (Picture-in-Picture) or activating fullscreen when the browser does not support the
  respective API fails silently from the user's perspective while surfacing the failure through the
  root's `onPipError` callback (PiP) or leaving `data-state` at `windowed` (fullscreen).
- `MediaPlayerLoading`, `MediaPlayerError` and the volume indicator render nothing at all (not just
  visually hidden) when their triggering condition is false, so they never intercept pointer events
  or announce to assistive technology while inactive.
- Removing every interactive part except the root and a media element still yields a fully
  keyboard-operable player, since every shortcut in User Story 2 is wired on the root, not on the
  individual button parts.
- Using any non-root part outside a `MediaPlayer` root throws a descriptive error naming both the
  part and the root.

### Keyboard Interactions

| Keys                    | Effect                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `Space`, `K`             | Toggle play/pause.                                                  |
| `ArrowRight`              | Seek forward 5s (video); with `Shift`, seek forward 5s (audio).     |
| `ArrowLeft`               | Seek backward 5s (video); with `Shift`, seek backward 5s (audio).   |
| `J`                       | Seek backward 10s.                                                  |
| `L`                       | Seek forward 10s.                                                   |
| `0`-`9`                   | Seek to 0%-90% of duration.                                         |
| `Home`                    | Seek to the beginning.                                              |
| `End`                     | Seek to the end.                                                    |
| `ArrowUp`                 | Increase volume 10% (video only).                                   |
| `ArrowDown`               | Decrease volume 10% (video only).                                   |
| `M`                       | Toggle mute.                                                        |
| `R`                       | Toggle loop.                                                        |
| `F`                       | Toggle fullscreen.                                                  |
| `Escape`                  | Exit fullscreen, while fullscreen.                                  |
| `>`                       | Increase playback speed one step.                                   |
| `<`                       | Decrease playback speed one step.                                   |
| `C`                       | Toggle captions (video only, when text tracks are available).       |
| `P`                       | Toggle Picture-in-Picture (video only).                             |
| `D`                       | Download the media file (only when a download control is present). |

All shortcuts are suppressed while the root is `disabled`, and none fire unless the player root or
the focused media element has focus.

## Requirements _(mandatory)_

### Functional Requirements

**Root, context and layout**

- **FR-001**: The component MUST provide a root that establishes shared state (current media
  element, playback/volume/fullscreen/loading/error state, controls-visibility, dragging, and
  open-menu state) for every descendant part, and MUST throw a descriptive error naming both the
  part and the root when any non-root part is rendered outside it.
- **FR-002**: The root MUST accept `dir` (`"ltr" | "rtl"`), falling back to the project's existing
  direction/locale context when omitted, `label` (accessible name, defaulting to "Media player"),
  `disabled`, `autoHide` (auto-hide the controls bar while playing and idle), `withoutTooltip`
  (suppresses every part's tooltip, including the seek hover tooltip unless that part overrides it),
  and `tooltipDelayDuration`/`tooltipSideOffset` defaults applied to every part's tooltip.
- **FR-003**: The root MUST expose `onPlay`, `onPause`, `onEnded`, `onTimeUpdate`, `onVolumeChange`,
  `onMuted`, `onMediaError`, `onPipError`, and `onFullscreenChange` callbacks that fire from the
  underlying media element's/document's own native events.
- **FR-004**: The root MUST render an accessible label and a hidden description that differs for
  video ("space bar to play/pause, arrow keys to seek and adjust volume") and audio ("space bar to
  play/pause, Shift + arrow keys to seek"), and MUST expose `data-state="fullscreen"|"windowed"`,
  `data-controls-visible`, and `data-disabled` on the root element.
- **FR-005**: A video part and an audio part MUST each render the respective native media element,
  wired to the root's shared state, accepting every standard media element attribute (`src`,
  `<source>`/`<track>` children, `autoplay`, `loop`, `muted`, `playsInline`, `crossOrigin`, etc.),
  and MUST toggle play/pause when the video element itself is clicked.
- **FR-006**: A controls container MUST group the transport controls, MUST be hidden (opacity/
  pointer-events, not `display:none`) when controls are not visible, and MUST expose
  `data-visible`, `data-state` (fullscreen/windowed) and `data-disabled`.
- **FR-007**: A controls-overlay part MUST render a decorative gradient backdrop behind the controls
  container that improves legibility, following the same visibility rules as FR-006.

**Feedback parts**

- **FR-008**: A loading part MUST appear only while the media is actively loading during playback
  (never on a still-paused first load), MUST appear immediately when the media has not yet played,
  and MUST wait a configurable delay (default 500ms) before appearing once the media has played at
  least once, and MUST use `role="status"`/`aria-live="polite"`.
- **FR-009**: An error part MUST appear only when a media error is present (from the media element
  or an explicit override), MUST use `role="alert"`/`aria-live="assertive"`, MUST derive a
  human-readable label and description from the native `MediaError` code (aborted/network/decode/
  unsupported) unless overridden, and MUST offer a "Try again" control (reloads the current source)
  and a "Reload page" control, each showing a pending state while its action runs.
- **FR-010**: A volume-indicator part MUST appear transiently after a keyboard-driven volume or mute
  change, auto-dismiss after a short delay, and show the current percentage (or "Muted") both as
  text and as a segmented bar graph, using `role="status"`/`aria-live="polite"`.

**Transport controls**

- **FR-011**: A play control MUST toggle playback, reflect `aria-pressed`/`data-state`("on"|"off")
  and its accessible label/icon (Play ↔ Pause) from the media's paused state, and MUST honor the
  root's and its own `disabled`.
- **FR-012**: Seek-backward and seek-forward controls MUST jump the media by a configurable number
  of seconds (defaulting to 5 backward / 10 forward), clamped to `[0, duration]`, and MUST honor
  `disabled`.
- **FR-013**: A seek slider MUST reflect and update the media's current time, MUST show the
  buffered range distinctly from the unplayed and played ranges, MUST support an optional inline
  current/remaining time display (`withTime`), and MUST optionally render (unless
  `withoutTooltip`/`withoutChapter`) a hover/drag tooltip showing the hovered time, the active
  chapter title (parsed from a `kind="chapters"` text track when present), and a caller-supplied
  thumbnail image; chapter boundaries MUST be marked on the track when more than one chapter cue
  exists; the tooltip's time display MUST follow a `tooltipTimeVariant` prop (`current` default, or
  `progress` showing current and total), and its position MUST be clamped within a caller-supplied
  collision boundary (defaulting to the player root) with a configurable collision padding (default
  10px).
- **FR-014**: A volume control MUST include a mute toggle and a volume slider, reflect muted/low/
  high volume via icon and `data-state`, and MUST support an `expandable` mode where the slider is
  collapsed until the control is hovered or focused.
- **FR-015**: A time part MUST display, per a `variant` prop (`progress` default, `remaining`,
  `duration`), the current/duration pair, the time remaining, or the total duration, each formatted
  `M:SS`/`H:MM:SS` and updating live during playback.
- **FR-016**: A playback-speed control MUST offer a configurable list of speeds (default `[0.5,
  0.75, 1, 1.25, 1.5, 1.75, 2]`) in a menu, mark the active speed with a checkmark, apply the
  selection to the media element's playback rate, and honor `disabled`.
- **FR-017**: A loop control MUST toggle the media element's native `loop` property, reflect it via
  `aria-pressed`/`data-state`, and stay in sync if the media's `loop` property changes by any other
  means.
- **FR-018**: A fullscreen control MUST toggle the browser Fullscreen API on the player root,
  reflect the current state via `aria-label`/`data-state`, and the root MUST reflect the same state
  via `data-state="fullscreen"|"windowed"`.
- **FR-019**: A Picture-in-Picture control (video only) MUST toggle the browser PiP API on the video
  element, reflect state via `aria-label`/`data-state`, and report any rejected PiP request through
  `onPipError` with which action (`"enter"|"exit"`) failed.
- **FR-020**: A captions control (video only) MUST toggle visibility of the active text track when
  at least one exists, reflect state via `aria-pressed`/`data-state`, and be a no-op when the video
  has none.
- **FR-021**: A download control MUST trigger a browser download of the media's current resolved
  source when activated, and MUST be the sole gate for the `D` keyboard shortcut described in
  FR-023 — the shortcut is a no-op when this part is absent from the tree.
- **FR-022**: A settings control MUST open a menu combining speed selection (as FR-016), a captions
  submenu (listing every text track, "Off", and "No captions available" when none exist, video
  only), and — only when the caller supplies a non-empty list of renditions — a quality submenu
  with an "Auto" default and a checkmark on the active selection.

**Keyboard, i18n and distribution**

- **FR-023**: The root MUST implement every shortcut in the Keyboard Interactions table below,
  scoped to when the player or the focused media element has focus, suppressed entirely when
  `disabled`, and MUST NOT prevent the default browser action for keys it does not own.
- **FR-024**: The whole component tree MUST support right-to-left layouts: an explicit `dir` prop
  or the project's existing direction context flips the visual layout of sliders and the controls
  bar; no keyboard shortcut's physical direction changes with `dir`, matching upstream.
- **FR-025**: The component MUST be distributed as installable source under the project's UI
  component directory with an index barrel exporting every part and its prop types, and registered
  in the project's component registry exactly like every other ported component.
- **FR-026**: A documentation page MUST demonstrate every upstream example: default video controls,
  audio-only controls, a settings menu with speed/captions/quality, HLS/adaptive playback, error
  handling with retry/reload, and a playlist player that swaps sources and reacts to `ended`.

### Key Entities

- **Media Playback State**: The live state mirrored from the underlying `<video>`/`<audio>`
  element — paused, current time, duration, volume, muted, playback rate, loop, buffered/seekable
  ranges, fullscreen state, Picture-in-Picture state, and any active `MediaError`.
- **Chapter Cue**: A named time range (`startTime`, `endTime`, `text`) parsed from a `kind="chapters"`
  text track, used to label seek-bar segments and the seek tooltip.
- **Rendition**: A caller-supplied playback quality option (`id`, optional `width`/`height`) listed
  in the settings menu's quality submenu; selection is reported back to the caller.
- **Player UI State**: Ephemeral, non-media state owned by the root — controls-visible, dragging,
  a settings/speed menu being open, and the transient volume-indicator visibility — that several
  parts read and that drives `autoHide` and tooltip suppression.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can fully operate a player equipped with every documented control — play,
  seek, volume, speed, loop, captions, fullscreen, Picture-in-Picture, download and settings —
  using only the keyboard, reaching each control via `Tab` and each shortcut in the Keyboard
  Interactions table.
- **SC-002**: 100% of the documented upstream parts, props, callbacks, data attributes, ARIA roles/
  states and keyboard interactions are reproduced and covered by automated tests, except the
  deliberate divergences recorded under Assumptions.
- **SC-003**: The seek slider's displayed position updates within one animation frame of a drag or
  keyboard seek, and the committed media time matches the release position exactly.
- **SC-004**: The loading indicator never appears for a still-paused, first-time load; it appears
  without delay for a stall before the media has ever played, appears within its configured delay
  for a mid-playback stall after the media has played, and disappears the instant loading resolves.
- **SC-005**: The component renders and behaves correctly under `dir="rtl"` with no visual overlap
  or misaligned controls, verified on the demo page, for both the video and audio compositions.
- **SC-006**: The component is installable through the project's registry and appears in the docs
  index alongside every other ported component, with zero manual post-install edits required beyond
  what the registry CLI performs for any other component.
- **SC-007**: All six upstream example compositions (default, audio, settings, HLS, error,
  playlist) render and are individually exercised on the demo page.

## Assumptions _(mandatory)_

- **Native media bindings replace the `media-chrome` store (directed by the task, and a deliberate
  Principle IV composition choice)**. Upstream sources all playback/volume/time/fullscreen/error
  state from `media-chrome/react/media-store` (`useMediaSelector`/`useMediaDispatch`/
  `MediaProvider`), a headless external store with no Svelte equivalent and no reason to add as a
  dependency when Svelte already binds natively to `<video>`/`<audio>` elements. This port reads
  and writes playback state directly through Svelte's native media bindings (`bind:currentTime`,
  `bind:paused`, `bind:duration`, `bind:volume`, `bind:muted`, plus native `buffered`/`seekable`/
  `textTracks`/`loop`/`playbackRate` and the Fullscreen/Picture-in-Picture browser APIs) inside a
  `MediaPlayerState` rune class, instead of dispatching action objects to an external store. Every
  public prop/callback name upstream documents (`onPlay`, `onTimeUpdate`, `onVolumeChange`, etc.)
  is preserved unchanged; only the internal state mechanism differs.
- **`radix-ui`'s `Direction` and `Slot` primitives are replaced** by this project's existing
  direction/RTL context (used by other ported components) and by the established `child` snippet
  pattern (CLAUDE.md §10) wherever upstream uses `asChild`, since Svelte 5 has no
  `React.cloneElement` equivalent.
- **`useLazyRef`/`useComposedRefs`/`useId`** are React-only ref/id plumbing with no port target:
  lazy refs become plain class fields on `MediaPlayerState`, composed refs become
  `ref = $bindable(null)` + `bind:this`, and `useId()` becomes `$props.id()` (CLAUDE.md §10).
- **HLS/adaptive-bitrate playback uses the browser's native HLS support only** (e.g. Safari/iOS),
  not `hls.js` or `@mux/mux-video-react`. Upstream's HLS demo depends on `@mux/mux-video-react`, a
  React-only custom element wrapping `hls.js`; adding either as a dependency is out of scope (no
  new runtime dependency may be introduced for a single demo). The ported HLS demo points a plain
  `MediaPlayerVideo` at a public `.m3u8` stream: it plays back natively where the browser supports
  it and otherwise surfaces the same `MediaPlayerError` state as any other unsupported source —
  which is itself a faithful demonstration of the component's error-handling story from User Story 3.
- **Quality/rendition selection is caller-driven, not adaptive-stream-derived.** Upstream reads
  `mediaRenditionList`/`mediaRenditionSelected` from the Media Chrome store, which only populates
  when an HLS engine reports bitrate renditions. Without an adaptive-streaming dependency (see
  above), this port instead accepts an optional `renditions` prop (`{ id, width?, height? }[]`) and
  an `onRenditionChange` callback on the settings part; the quality submenu renders only when that
  list is non-empty. This preserves the documented UI/UX (Auto default, checkmarked selection) as
  an explicit, composable API instead of an implicit one only Mux-backed streams could exercise.
- **Storyboard/sprite thumbnail auto-parsing (Mux's proprietary `storyboard.vtt` format) is not
  reproduced.** Upstream derives seek-tooltip thumbnails from a Mux-specific `mediaPreviewImage`/
  `mediaPreviewCoords` pair supplied by the media-chrome store. This port keeps the documented
  `tooltipThumbnailSrc` prop (a static URL or a `(time) => string` callback) as the sole supported
  way to show a thumbnail, which covers every non-Mux-specific use case upstream's own prop already
  targets.
- **Chapter cues are read directly from the video's own `kind="chapters"` `TextTrack.cues`** via
  the standard `HTMLMediaElement.textTracks` API, instead of media-chrome's derived
  `mediaChaptersCues` state — same source data (a WebVTT chapters track), same resulting UI.
- **Fullscreen and Picture-in-Picture use the standard browser APIs directly**
  (`element.requestFullscreen()`/`document.exitFullscreen()`,
  `video.requestPictureInPicture()`/`document.exitPictureInPicture()`) instead of media-chrome
  dispatch actions, since those actions were themselves thin wrappers over these same native APIs.
- **The seek/volume-indicator tooltip portal reuses this project's existing popover/tooltip portal
  primitive** (the same one `dialog`/`sheet`/`tooltip` parts already use) targeted at the
  fullscreen element while the player is fullscreen and at `document.body` otherwise, replacing
  upstream's bespoke `ReactDOM.createPortal`-based `MediaPlayerPortal` and its custom
  `DropdownMenuContent`/`TooltipContent` `container` prop patch — the same portal-target capability
  the upstream installation guide's "prerequisite" step manually adds to those two components.
- **Demo media assets are swapped for locally hosted or well-known public sample files** where
  upstream points at ephemeral third-party URLs (a private Mux stream ID, a Dropbox share link, an
  OpenGameArt.org direct link) that are unsuitable for a committed demo page; each replacement
  preserves the feature being demonstrated (a playable video/audio source with the same track/
  caption/chapter structure where relevant) and full attribution stays in the demo page per
  upstream's Credits section.
- **`toast` (via the already-installed `sonner` component) and `ScrollArea` are reused as-is** for
  the playlist demo's error/loading feedback and scrollable track list, matching upstream's own
  choice of dependencies, both already present in this project's base component set.
- Only the "radix" base variant is ported (there is no separate "base"/non-Radix media-player
  variant upstream with different behaviour), consistent with the vendored source found under
  `.reference/diceui`.
- **Two upstream keyboard-table rows are treated as upstream documentation bugs.** The MDX marks
  `J`/`L` "(video only)" although the source seeks ±10s on any media element, and lists `P` without
  a media-type note although the source guards it with `isVideo`. This port reproduces the source
  behaviour in both cases (`J`/`L` on video and audio; `P` on video only) and the demo page's
  keyboard table states the source behaviour, not the MDX table.
