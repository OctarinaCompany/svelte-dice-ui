<script lang="ts" module>
	import type { Direction } from '$lib/components/ui/direction-provider/index.js';

	import type {
		MediaPlayerCollisionPadding,
		MediaPlayerRendition,
		MediaPlayerTimeVariant
	} from './index.js';

	/**
	 * Which single composition this render exercises. A `.ts` spec cannot express `bind:open`, the
	 * `child` snippet, `<source>` / `<track>` children or a `dir`-providing ancestor, so everything
	 * needing a real component tree goes through this file. It is not collected by Vitest
	 * (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type MediaPlayerHarnessMode =
		| 'default'
		| 'root-child'
		| 'video-child'
		| 'controls-child'
		| 'play-child'
		| 'seek-child'
		| 'volume-child'
		| 'time-child'
		| 'pip-children';

	export type MediaPlayerHarnessProps = {
		/** @default 'default' */
		mode?: MediaPlayerHarnessMode;
		/** @default 'video' */
		media?: 'video' | 'audio' | 'none';
		// root configuration
		dir?: Direction;
		label?: string;
		autoHide?: boolean;
		disabled?: boolean;
		withoutTooltip?: boolean;
		tooltipDelayDuration?: number;
		tooltipSideOffset?: number;
		/** Forces a `tabindex` onto the root, so a `disabled` root can still be focused in a spec. */
		rootTabindex?: number;
		/** One caller `class`, threaded through every part that merges one, to prove the merge order. */
		partClass?: string;
		onPlay?: () => void;
		onPause?: () => void;
		onEnded?: () => void;
		onTimeUpdate?: (time: number) => void;
		onVolumeChange?: (volume: number) => void;
		onMuted?: (muted: boolean) => void;
		onMediaError?: (error: MediaError | null) => void;
		onPipError?: (error: unknown, state: 'enter' | 'exit') => void;
		onFullscreenChange?: (fullscreen: boolean) => void;
		onRootKeydown?: (event: KeyboardEvent) => void;
		// which parts to mount
		/** @default true */
		withControls?: boolean;
		/** @default false */
		withControlsOverlay?: boolean;
		/** @default true */
		withPlay?: boolean;
		/** @default true */
		withSeek?: boolean;
		/** @default true */
		withSeekButtons?: boolean;
		/** @default true */
		withVolume?: boolean;
		/** @default true */
		withTime?: boolean;
		/** @default false */
		withLoop?: boolean;
		/** @default false */
		withFullscreen?: boolean;
		/** @default false */
		withPip?: boolean;
		/** @default false */
		withCaptions?: boolean;
		/** @default false */
		withDownload?: boolean;
		/** @default false */
		withPlaybackSpeed?: boolean;
		/** @default false */
		withSettings?: boolean;
		/** @default false */
		withLoading?: boolean;
		/** @default false */
		withError?: boolean;
		/** @default false */
		withVolumeIndicator?: boolean;
		/** @default false */
		withPortal?: boolean;
		/** @default false */
		withTooltipPart?: boolean;
		// part configuration
		seekSeconds?: number;
		forwardSeconds?: number;
		seekWithTime?: boolean;
		seekWithoutChapter?: boolean;
		seekWithoutTooltip?: boolean;
		seekTooltipTimeVariant?: 'current' | 'progress';
		seekTooltipThumbnailSrc?: string | ((time: number) => string);
		seekTooltipCollisionBoundary?: Element | Element[];
		seekTooltipCollisionPadding?: MediaPlayerCollisionPadding;
		timeVariant?: MediaPlayerTimeVariant;
		volumeExpandable?: boolean;
		loadingDelay?: number;
		errorLabel?: string;
		errorDescription?: string;
		onRetry?: () => void;
		onReload?: () => void;
		speeds?: number[];
		renditions?: MediaPlayerRendition[];
		defaultOpen?: boolean;
		/** `bind:open` on whichever menu is mounted. */
		open?: boolean;
		/**
		 * Bind `open` through a setter that refuses every write, modelling a parent that stays
		 * authoritative. `onOpenChange` still fires.
		 *
		 * @default false
		 */
		declineOpen?: boolean;
		onOpenChange?: (open: boolean) => void;
		/** `bind:renditionId` on `<MediaPlayer.Settings>`. */
		renditionId?: string;
		onRenditionChange?: (renditionId: string | undefined) => void;
		/** `<source>` for the media element. */
		src?: string;
		/** `<MediaPlayer.Portal>` configuration. `undefined` leaves the context default in charge. */
		portalContainer?: Element | DocumentFragment | null;
		/** `<MediaPlayer.Tooltip>` configuration, for the standalone tooltip part. */
		tooltipText?: string;
		tooltipShortcut?: string | string[];
		partTooltipDelayDuration?: number;
		partTooltipSideOffset?: number;
	};
</script>

<script lang="ts">
	import * as MediaPlayer from './index.js';

	let {
		mode = 'default',
		media = 'video',
		dir,
		label,
		autoHide,
		disabled,
		withoutTooltip,
		tooltipDelayDuration,
		tooltipSideOffset,
		rootTabindex,
		partClass,
		onPlay,
		onPause,
		onEnded,
		onTimeUpdate,
		onVolumeChange,
		onMuted,
		onMediaError,
		onPipError,
		onFullscreenChange,
		onRootKeydown,
		withControls = true,
		withControlsOverlay = false,
		withPlay = true,
		withSeek = true,
		withSeekButtons = true,
		withVolume = true,
		withTime = true,
		withLoop = false,
		withFullscreen = false,
		withPip = false,
		withCaptions = false,
		withDownload = false,
		withPlaybackSpeed = false,
		withSettings = false,
		withLoading = false,
		withError = false,
		withVolumeIndicator = false,
		withPortal = false,
		withTooltipPart = false,
		seekSeconds,
		forwardSeconds,
		seekWithTime = false,
		seekWithoutChapter = false,
		seekWithoutTooltip = false,
		seekTooltipTimeVariant,
		seekTooltipThumbnailSrc,
		seekTooltipCollisionBoundary,
		seekTooltipCollisionPadding,
		timeVariant,
		volumeExpandable = false,
		loadingDelay,
		errorLabel,
		errorDescription,
		onRetry,
		onReload,
		speeds,
		renditions,
		defaultOpen,
		open = $bindable(),
		declineOpen = false,
		onOpenChange,
		renditionId = $bindable(),
		onRenditionChange,
		src,
		portalContainer,
		tooltipText,
		tooltipShortcut,
		partTooltipDelayDuration,
		partTooltipSideOffset
	}: MediaPlayerHarnessProps = $props();

	const rootProps = $derived({
		dir,
		label,
		autoHide,
		disabled,
		withoutTooltip,
		tooltipDelayDuration,
		tooltipSideOffset,
		class: partClass,
		onPlay,
		onPause,
		onEnded,
		onTimeUpdate,
		onVolumeChange,
		onMuted,
		onMediaError,
		onPipError,
		onFullscreenChange,
		onkeydown: onRootKeydown,
		// Spreading `tabindex: undefined` would strip the root's own `tabindex`, so the override
		// only appears when a spec asks for it.
		...(rootTabindex === undefined ? {} : { tabindex: rootTabindex }),
		'data-testid': 'root'
	});
</script>

{#snippet mediaElement()}
	{#if media === 'video'}
		{#if mode === 'video-child'}
			<MediaPlayer.Video data-testid="video">
				{#snippet child({ props })}
					<video data-child-slot="video" {...props}>
						<track kind="captions" />
					</video>
				{/snippet}
			</MediaPlayer.Video>
		{:else}
			<MediaPlayer.Video data-testid="video" {src} class={partClass}></MediaPlayer.Video>
		{/if}
	{:else if media === 'audio'}
		<MediaPlayer.Audio data-testid="audio" {src} class="sr-only" />
	{/if}
{/snippet}

{#snippet transport()}
	{#if withPlay}
		{#if mode === 'play-child'}
			<MediaPlayer.Play data-testid="play">
				{#snippet child({ props })}
					<button data-child-slot="play" {...props}>Play</button>
				{/snippet}
			</MediaPlayer.Play>
		{:else}
			<MediaPlayer.Play data-testid="play" class={partClass} />
		{/if}
	{/if}

	{#if withSeekButtons}
		<MediaPlayer.SeekBackward data-testid="seek-backward" seconds={seekSeconds} />
		<MediaPlayer.SeekForward data-testid="seek-forward" seconds={forwardSeconds} />
	{/if}

	{#if withVolume}
		{#if mode === 'volume-child'}
			<MediaPlayer.Volume data-testid="volume">
				{#snippet child({ props })}
					<div data-child-slot="volume" {...props}></div>
				{/snippet}
			</MediaPlayer.Volume>
		{:else}
			<MediaPlayer.Volume data-testid="volume" expandable={volumeExpandable} class={partClass} />
		{/if}
	{/if}

	{#if withTime}
		{#if mode === 'time-child'}
			<MediaPlayer.Time data-testid="time">
				{#snippet child({ props })}
					<span data-child-slot="time" {...props}></span>
				{/snippet}
			</MediaPlayer.Time>
		{:else}
			<MediaPlayer.Time data-testid="time" variant={timeVariant} class={partClass} />
		{/if}
	{/if}

	{#if withLoop}
		<MediaPlayer.Loop data-testid="loop" />
	{/if}
	{#if withCaptions}
		<MediaPlayer.Captions data-testid="captions" />
	{/if}
	{#if withDownload}
		<MediaPlayer.Download data-testid="download" />
	{/if}
	{#if withPip}
		{#if mode === 'pip-children'}
			<MediaPlayer.PiP data-testid="pip">
				{#snippet children(active)}
					<span data-testid="pip-state">{active ? 'on' : 'off'}</span>
				{/snippet}
			</MediaPlayer.PiP>
		{:else}
			<MediaPlayer.PiP data-testid="pip" />
		{/if}
	{/if}
	{#if withFullscreen}
		<MediaPlayer.Fullscreen data-testid="fullscreen" />
	{/if}
	{#if withPlaybackSpeed}
		{#if declineOpen}
			<MediaPlayer.PlaybackSpeed
				data-testid="playback-speed"
				bind:open={() => open ?? false, (next) => onOpenChange?.(next)}
				{defaultOpen}
				{speeds}
			/>
		{:else}
			<MediaPlayer.PlaybackSpeed
				data-testid="playback-speed"
				bind:open
				{defaultOpen}
				{onOpenChange}
				{speeds}
			/>
		{/if}
	{/if}
	{#if withSettings}
		<MediaPlayer.Settings
			data-testid="settings"
			bind:open
			bind:renditionId
			{defaultOpen}
			{onOpenChange}
			{onRenditionChange}
			{speeds}
			{renditions}
		/>
	{/if}
	{#if withTooltipPart}
		<MediaPlayer.Tooltip
			tooltip={tooltipText}
			shortcut={tooltipShortcut}
			delayDuration={partTooltipDelayDuration}
			sideOffset={partTooltipSideOffset}
		>
			<button type="button" data-testid="tooltip-target">Target</button>
		</MediaPlayer.Tooltip>
	{/if}
{/snippet}

{#snippet seekPart()}
	{#if withSeek}
		{#if mode === 'seek-child'}
			<MediaPlayer.Seek data-testid="seek">
				{#snippet child({ props })}
					<div data-child-slot="seek" {...props}></div>
				{/snippet}
			</MediaPlayer.Seek>
		{:else}
			<MediaPlayer.Seek
				data-testid="seek"
				withTime={seekWithTime}
				withoutChapter={seekWithoutChapter}
				withoutTooltip={seekWithoutTooltip}
				tooltipTimeVariant={seekTooltipTimeVariant}
				tooltipThumbnailSrc={seekTooltipThumbnailSrc}
				tooltipCollisionBoundary={seekTooltipCollisionBoundary}
				tooltipCollisionPadding={seekTooltipCollisionPadding}
				class={partClass}
			/>
		{/if}
	{/if}
{/snippet}

{#snippet controls()}
	{#if withControlsOverlay}
		<MediaPlayer.ControlsOverlay data-testid="controls-overlay" />
	{/if}
	{@render seekPart()}
	{@render transport()}
{/snippet}

{#snippet body()}
	{@render mediaElement()}

	{#if withLoading}
		<MediaPlayer.Loading data-testid="loading" delay={loadingDelay} />
	{/if}
	{#if withError}
		<MediaPlayer.Error
			data-testid="error"
			label={errorLabel}
			description={errorDescription}
			{onRetry}
			{onReload}
		/>
	{/if}
	{#if withVolumeIndicator}
		<MediaPlayer.VolumeIndicator data-testid="volume-indicator" />
	{/if}
	{#if withPortal}
		<MediaPlayer.Portal container={portalContainer}>
			<span data-testid="portalled">Portalled</span>
		</MediaPlayer.Portal>
	{/if}

	{#if withControls}
		{#if mode === 'controls-child'}
			<MediaPlayer.Controls data-testid="controls">
				{#snippet child({ props })}
					<section data-child-slot="controls" {...props}>
						{@render controls()}
					</section>
				{/snippet}
			</MediaPlayer.Controls>
		{:else}
			<MediaPlayer.Controls data-testid="controls" class={partClass}>
				{@render controls()}
			</MediaPlayer.Controls>
		{/if}
	{/if}
{/snippet}

{#if mode === 'root-child'}
	<MediaPlayer.Root {...rootProps}>
		{#snippet child({ props })}
			<section data-child-slot="root" {...props}>
				{@render body()}
			</section>
		{/snippet}
	</MediaPlayer.Root>
{:else}
	<MediaPlayer.Root {...rootProps}>
		{@render body()}
	</MediaPlayer.Root>
{/if}
