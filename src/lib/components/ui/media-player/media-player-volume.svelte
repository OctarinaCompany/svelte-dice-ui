<script lang="ts" module>
	import type { Slider as SliderPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';

	/** The merged attribute payload handed to the `child` snippet. */
	export type MediaPlayerVolumeChildProps = {
		'data-slot': 'media-player-volume-container';
		'data-disabled': '' | undefined;
		class: string;
	} & Record<string, unknown>;

	/** Same `Slider.RootProps` omission set as `<MediaPlayer.Seek>` (research R-03). */
	export type MediaPlayerVolumeProps = Omit<
		SliderPrimitive.RootProps,
		| 'type'
		| 'value'
		| 'onValueChange'
		| 'onValueCommit'
		| 'min'
		| 'max'
		| 'step'
		| 'dir'
		| 'children'
		| 'child'
	> & {
		/**
		 * Collapse the slider until the control is hovered or holds focus.
		 *
		 * @default false
		 */
		expandable?: boolean;
		/**
		 * Render the volume control onto your own element. Replaces upstream's `asChild`. In `child`
		 * mode the mute button and slider are not rendered — the caller owns the element.
		 */
		child?: Snippet<[{ props: MediaPlayerVolumeChildProps }]>;
	};
</script>

<script lang="ts">
	import { Slider } from 'bits-ui';

	import Volume1Icon from '@lucide/svelte/icons/volume-1';
	import Volume2Icon from '@lucide/svelte/icons/volume-2';
	import VolumeXIcon from '@lucide/svelte/icons/volume-x';

	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	import MediaPlayerTooltip from './media-player-tooltip.svelte';
	import { getMediaPlayerContext } from './media-player.svelte.js';

	let {
		ref = $bindable(null),
		expandable = false,
		disabled,
		class: className,
		child,
		...restProps
	}: MediaPlayerVolumeProps = $props();

	const root = getMediaPlayerContext('<MediaPlayer.Volume>');

	const uid = $props.id();
	const sliderId = `${uid}-slider`;
	const triggerId = `${uid}-trigger`;

	const isDisabled = $derived(Boolean(disabled) || root.disabled);
	const effectiveVolume = $derived(root.muted ? 0 : root.volume);

	function onValueChange(value: number) {
		root.dragging = true;
		root.setVolume(value);
	}

	function onValueCommit(value: number) {
		root.dragging = false;
		root.setVolume(value);
	}

	// `bits-ui` reads `dir` as a behavioural prop and does not render it, so the container carries
	// the attribute the documented direction chain is read from.
	const containerAttrs = $derived({
		'data-disabled': isDisabled ? '' : undefined,
		'data-slot': 'media-player-volume-container',
		dir: root.dir,
		class: cn(
			'group flex items-center',
			expandable ? 'gap-0 group-focus-within:gap-2 group-hover:gap-1.5' : 'gap-1.5',
			className
		)
	} as MediaPlayerVolumeChildProps);
</script>

{#if child}
	{@render child({ props: containerAttrs })}
{:else}
	<div {...containerAttrs}>
		<MediaPlayerTooltip tooltip="Volume" shortcut="M">
			<Button
				id={triggerId}
				type="button"
				aria-controls="{root.mediaId} {sliderId}"
				aria-label={root.muted ? 'Unmute' : 'Mute'}
				aria-pressed={root.muted}
				data-slot="media-player-volume-trigger"
				data-state={root.muted ? 'on' : 'off'}
				data-disabled={isDisabled ? '' : undefined}
				variant="ghost"
				size="icon"
				class="size-8"
				disabled={isDisabled}
				onclick={() => root.toggleMute()}
			>
				{#if root.volumeLevel === 'off'}
					<VolumeXIcon />
				{:else if root.volumeLevel === 'high'}
					<Volume2Icon />
				{:else}
					<Volume1Icon />
				{/if}
			</Button>
		</MediaPlayerTooltip>
		<Slider.Root
			bind:ref
			id={sliderId}
			type="single"
			aria-controls={root.mediaId}
			aria-valuetext="{Math.round(effectiveVolume * 100)}% volume"
			data-slider=""
			data-slot="media-player-volume"
			data-disabled={isDisabled ? '' : undefined}
			dir={root.dir}
			disabled={isDisabled}
			{...restProps}
			min={0}
			max={1}
			step={0.1}
			value={effectiveVolume}
			{onValueChange}
			{onValueCommit}
			class={cn(
				'relative flex h-1 touch-none items-center overflow-hidden rounded-full bg-muted-foreground/60 select-none data-disabled:pointer-events-none data-disabled:opacity-50',
				expandable
					? 'w-0 opacity-0 transition-[width,opacity] duration-200 ease-in-out group-focus-within:w-16 group-focus-within:opacity-100 group-hover:w-16 group-hover:opacity-100'
					: 'w-16'
			)}
		>
			{#snippet children({ thumbItems })}
				<Slider.Range class="absolute h-full bg-primary will-change-[width]" />
				{#each thumbItems as thumb (thumb.index)}
					<!-- `bits-ui` puts `role="slider"` on the thumb, so the name and value text live there. -->
					<Slider.Thumb
						index={thumb.index}
						data-slot="media-player-volume-thumb"
						aria-label="Volume"
						aria-controls={root.mediaId}
						aria-valuetext="{Math.round(effectiveVolume * 100)}% volume"
						class="block size-2.5 shrink-0 rounded-full bg-primary shadow-sm ring-ring/50 transition-[color,box-shadow] will-change-transform hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
					/>
				{/each}
			{/snippet}
		</Slider.Root>
	</div>
{/if}
