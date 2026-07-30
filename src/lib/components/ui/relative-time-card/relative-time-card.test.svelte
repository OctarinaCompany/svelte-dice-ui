<script lang="ts" module>
	import type {
		DateInput,
		RelativeTimeCardPositioningProps,
		RelativeTimeCardVariant
	} from './index.js';

	/**
	 * A `.ts` spec cannot express `{#snippet child({ props })}`, `bind:open` or `bind:ref`, so every
	 * assertion that needs a real component tree goes through this harness. It is not collected by
	 * Vitest (`include` is `.{js,ts}`) and is not listed in `registry.json`.
	 */
	export type RelativeTimeCardHarnessProps = RelativeTimeCardPositioningProps & {
		date: DateInput;
		open?: boolean;
		defaultOpen?: boolean;
		onOpenChange?: (open: boolean) => void;
		variant?: RelativeTimeCardVariant;
		class?: string;
		timezones?: readonly string[];
		updateInterval?: number;
		/** Render the trigger onto a `<Button>` through the `child` snippet instead of the default. */
		useChild?: boolean;
		/** Replace the trigger's default `<time>` with this text. */
		label?: string;
		dir?: 'ltr' | 'rtl';
		/** Reports the trigger element captured through `bind:ref`. */
		onRef?: (ref: HTMLButtonElement | null) => void;
	};
</script>

<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import type { ComponentProps } from 'svelte';

	import * as RelativeTimeCard from './index.js';
	import type { RelativeTimeCardChildProps } from './index.js';

	let {
		date,
		open = $bindable(),
		defaultOpen,
		onOpenChange,
		variant,
		class: className,
		timezones,
		updateInterval,
		side,
		sideOffset,
		align,
		alignOffset,
		avoidCollisions,
		collisionBoundary,
		collisionPadding,
		useChild = false,
		label,
		dir = 'ltr',
		onRef
	}: RelativeTimeCardHarnessProps = $props();

	let ref = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		onRef?.(ref);
	});
</script>

{#snippet triggerChild({ props }: { props: RelativeTimeCardChildProps })}
	<Button
		variant="outline"
		size="sm"
		data-testid="trigger-child"
		{...props as ComponentProps<typeof Button>}
	>
		{label ?? 'Time details'}
	</Button>
{/snippet}

{#snippet triggerChildren()}
	<span data-testid="trigger-children">{label}</span>
{/snippet}

<div {dir}>
	<RelativeTimeCard.Root
		bind:ref
		{date}
		bind:open
		{defaultOpen}
		{onOpenChange}
		{variant}
		class={className}
		{timezones}
		{updateInterval}
		{side}
		{sideOffset}
		{align}
		{alignOffset}
		{avoidCollisions}
		{collisionBoundary}
		{collisionPadding}
		child={useChild ? triggerChild : undefined}
		children={label === undefined ? undefined : triggerChildren}
	/>
</div>
