<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { tv } from 'tailwind-variants';

	/**
	 * Upstream `stackItemWrapperVariants` (stack.tsx:206-232), rebuilt with `tv()` because this repo
	 * standardises on `tailwind-variants` and never adds `class-variance-authority` (research R-03).
	 *
	 * Two deliberate changes: the physical `left-0` / `after:left-0` become the logical `start-0` /
	 * `after:start-0` (divergence D-07), and `motion-reduce:transition-none` is appended to the base
	 * so `prefers-reduced-motion: reduce` collapses the fan-out to an instant change while keeping
	 * both end states (divergence D-02).
	 *
	 * The `::after` bridge spans the gap the fan-out opens between two items, so the pointer never
	 * leaves the stack while travelling across it — it therefore only needs a height while expanded.
	 *
	 * There are no `defaultVariants`: the root always supplies `side` and the item always computes
	 * both booleans, exactly as upstream always passes all three axes.
	 */
	export const stackItemWrapperVariants = tv({
		base: 'absolute w-full transition-all duration-300 ease-out motion-reduce:transition-none',
		variants: {
			side: {
				top: "top-0 start-0 origin-top translate-y-[calc(var(--translate)*-1)] scale-[var(--item-scale)] after:absolute after:top-full after:start-0 after:w-full after:content-['']",
				bottom:
					"bottom-0 start-0 origin-bottom translate-y-[var(--translate)] scale-[var(--item-scale)] after:absolute after:bottom-full after:start-0 after:w-full after:content-['']"
			},
			isExpanded: {
				true: 'after:h-[calc(var(--gap)+1px)]',
				false: ''
			},
			isVisible: {
				true: '',
				false: 'pointer-events-none'
			}
		}
	});

	/** The merged attribute payload handed to the `child` snippet. */
	export type StackItemChildProps = {
		'data-slot': 'stack-item';
		'data-index': number;
		'data-position': 'front' | 'back';
		'data-state': 'expanded' | 'collapsed';
		class: string;
	} & Record<string, unknown>;

	export type StackItemProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		/**
		 * Render the card onto your own element instead of the default `<div>`. The snippet receives
		 * the merged props to spread onto that element.
		 *
		 * Replaces upstream's `asChild` (Radix `Slot`), which has no Svelte equivalent. As upstream,
		 * only the **card** is replaced — the positioning wrapper around it is always a `div`. In
		 * `child` mode `children` is not rendered and `ref` stays `null`.
		 */
		child?: Snippet<[{ props: StackItemChildProps }]>;
	};
</script>

<script lang="ts">
	import { untrack } from 'svelte';

	import { getStackContext } from './stack.svelte.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		child,
		...restProps
	}: StackItemProps = $props();

	const stack = getStackContext();
	const itemId = $props.id();

	let wrapperRef = $state<HTMLDivElement | null>(null);

	// Self-registration replaces upstream's `React.Children.toArray`, which has no Svelte equivalent:
	// the collection sorts by document position, so indices, z-order and visibility survive `{#each}`
	// reordering and conditional items without a remount (research R-01/R-02).
	//
	// The measurement runs here too and is upstream's, verbatim: the rendered box is already scaled
	// by the CSS transform, so dividing by the collapsed scale recovers the natural size. Both calls
	// write `SvelteMap`s this component also reads through `stack`, so the whole block is untracked —
	// otherwise every sibling's registration would invalidate this effect and it would re-register in
	// a loop.
	$effect(() => {
		const element = wrapperRef;
		if (!element) return;

		untrack(() => {
			stack.register(itemId, element);
			const collapsedScale = 1 - stack.indexOf(itemId) * stack.scale;
			const { height } = element.getBoundingClientRect();
			stack.setSize(itemId, collapsedScale > 0 ? height / collapsedScale : height);
		});

		return () => {
			stack.unregister(itemId);
			stack.releaseSize(itemId);
		};
	});

	const index = $derived(stack.indexOf(itemId));
	const isFront = $derived(stack.isFront(index));
	const isVisible = $derived(stack.isVisible(index));

	const wrapperStyle = $derived(
		`--translate: ${stack.translate(index)}px; --item-scale: ${stack.itemScale(index)}; z-index: ${stack.zIndex(index)}; opacity: ${stack.opacity(index)};`
	);

	const wrapperClass = $derived(
		stackItemWrapperVariants({ side: stack.side, isExpanded: stack.expanded, isVisible })
	);

	const itemAttrs = $derived({
		'data-slot': 'stack-item',
		'data-index': index,
		'data-position': isFront ? 'front' : 'back',
		'data-state': stack.dataState,
		...restProps,
		class: cn(
			'rounded-lg border bg-card p-4 shadow-sm transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none',
			className
		)
	} as StackItemChildProps);
</script>

<div
	bind:this={wrapperRef}
	data-slot="stack-item-wrapper"
	data-index={index}
	data-front={isFront ? 'true' : 'false'}
	data-visible={isVisible ? 'true' : 'false'}
	data-expanded={stack.expanded ? 'true' : 'false'}
	style={wrapperStyle}
	class={wrapperClass}
>
	{#if child}
		{@render child({ props: itemAttrs })}
	{:else}
		<div bind:this={ref} {...itemAttrs}>
			{@render children?.()}
		</div>
	{/if}
</div>
