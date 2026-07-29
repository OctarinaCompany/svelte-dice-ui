<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import {
		DirectionProviderState,
		setDirectionContext,
		type Direction
	} from './direction-provider.svelte.js';

	export type DirectionProviderProps = WithElementRef<
		Omit<HTMLAttributes<HTMLDivElement>, 'dir'>,
		HTMLDivElement
	> & {
		/**
		 * The direction of the text.
		 * @default "ltr"
		 */
		dir?: Direction;
	};
</script>

<script lang="ts">
	let {
		ref = $bindable(null),
		dir = 'ltr',
		class: className,
		children,
		...restProps
	}: DirectionProviderProps = $props();

	setDirectionContext(new DirectionProviderState({ getDir: () => dir }));
</script>

<div
	bind:this={ref}
	data-slot="direction-provider"
	data-dir={dir}
	{dir}
	class={cn('contents', className)}
	{...restProps}
>
	{@render children?.()}
</div>
