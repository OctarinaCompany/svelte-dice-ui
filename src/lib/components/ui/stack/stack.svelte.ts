import { DomOrderedCollection } from '$lib/components/ui/speed-dial/speed-dial-collection.svelte.js';
import { getContext, hasContext, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

/** Every value `side` accepts. Upstream `Side` (stack.tsx:13). */
export const STACK_SIDES = ['top', 'bottom'] as const;
export type StackSide = (typeof STACK_SIDES)[number];

/** How much opacity each collapsed item loses per position. Upstream inline literal (stack.tsx:292). */
const OPACITY_STEP = 0.15;

/** Upstream `getDataState` (stack.tsx:15-17). */
function getDataState(expanded: boolean): 'expanded' | 'collapsed' {
	return expanded ? 'expanded' : 'collapsed';
}

/**
 * Everything `<Stack.Root>` hands its state class.
 *
 * Passed as getter functions rather than snapshots so the props stay reactive inside the class —
 * a plain value captured in the constructor would freeze at its initial reading.
 */
export type StackStateProps = {
	getSide: () => StackSide;
	getItemCount: () => number;
	getExpandedItemCount: () => number | undefined;
	getGap: () => number;
	getScale: () => number;
	getOffset: () => number;
	getExpandOnHover: () => boolean;
};

/**
 * The reactive core of the stack: upstream's `StackContextValue` (stack.tsx:19-32), its two
 * `useState`s (76-78), its five handler callbacks (87-141) and the per-item layout math its
 * `StackItemWrapper` computes inline (258-292).
 *
 * Upstream can index its children because it walks `React.Children.toArray`. Svelte cannot inspect
 * a snippet's output, so each `<Stack.Item>` self-registers its wrapper element here and reads its
 * index back out of a document-ordered registry (research R-01/R-02). The formulas are unchanged;
 * only where the index comes from differs.
 */
export class StackState {
	// `$derived` below is lazy at runtime (evaluated only when a member is read), but svelte-check's
	// static analysis cannot see that and flags the field as used before its constructor assignment.
	#props!: StackStateProps;

	/** Upstream `isExpanded` (stack.tsx:76). */
	expanded = $state(false);

	/** Upstream `isInteracting` (stack.tsx:77) — a pointer is held down inside the stack. */
	interacting = $state(false);

	/** The document-ordered item registry; replaces upstream's `React.Children.toArray`. */
	#items = new DomOrderedCollection();

	/**
	 * Natural (unscaled) block size per item, keyed by the item's registration id.
	 *
	 * Upstream keys the same data by index and never removes an entry (`if (!existing)`, 269-275),
	 * so deleting a child strands its size on whichever item inherits that index. Keying by a stable
	 * id and releasing it on unmount produces identical numbers for a static stack and correct ones
	 * for a dynamic stack (research R-05, divergence D-03).
	 */
	#sizes = new SvelteMap<string, number>();

	constructor(props: StackStateProps) {
		this.#props = props;
	}

	/** Upstream `childrenCount` (stack.tsx:83). */
	readonly itemsCount: number = $derived(this.#items.size);

	/** Upstream `effectiveExpandedItemCount` (stack.tsx:85). */
	readonly visibleCount: number = $derived(this.#props.getExpandedItemCount() ?? this.itemsCount);

	readonly dataState: 'expanded' | 'collapsed' = $derived(getDataState(this.expanded));

	/** The root's three inline custom properties (stack.tsx:187-194). */
	readonly styleProps: string = $derived(
		`--gap: ${this.#props.getGap()}px; --offset: ${this.#props.getOffset()}px; --scale: ${this.#props.getScale()};`
	);

	get side(): StackSide {
		return this.#props.getSide();
	}

	get scale(): number {
		return this.#props.getScale();
	}

	// -------------------------------------------------------------------------
	// Item registry
	// -------------------------------------------------------------------------

	/** Idempotent — re-registering the same id replaces the entry. */
	register(id: string, element: HTMLElement): void {
		this.#items.register(id, element, undefined);
	}

	/** No-op for an unknown id. */
	unregister(id: string): void {
		this.#items.unregister(id);
	}

	/** Document-order position of a registered item; `0` until its registration effect has run. */
	indexOf(id: string): number {
		return this.#items.indexById.get(id) ?? 0;
	}

	/** Stores a measured natural size, clamped to `>= 0`. Writing the same value again is a no-op. */
	setSize(id: string, size: number): void {
		const next = Number.isFinite(size) && size > 0 ? size : 0;
		if (this.#sizes.get(id) === next) return;
		this.#sizes.set(id, next);
	}

	/** No-op for an unknown id. */
	releaseSize(id: string): void {
		this.#sizes.delete(id);
	}

	// -------------------------------------------------------------------------
	// Per-item layout math (stack.tsx:258-292)
	// -------------------------------------------------------------------------

	isFront(index: number): boolean {
		return index === 0;
	}

	isVisible(index: number): boolean {
		return this.expanded ? index < this.visibleCount : index < this.#props.getItemCount();
	}

	/** Upstream `itemsSizeBefore` (stack.tsx:279-284) — the natural sizes of every item in front. */
	sizeBefore(index: number): number {
		return this.#items.ordered
			.slice(0, Math.max(0, index))
			.reduce((total, entry) => total + (this.#sizes.get(entry.id) ?? 0), 0);
	}

	itemScale(index: number): number {
		return this.expanded ? 1 : 1 - index * this.#props.getScale();
	}

	translate(index: number): number {
		return this.expanded
			? index * this.#props.getGap() + this.sizeBefore(index)
			: index * this.#props.getOffset();
	}

	zIndex(index: number): number {
		return this.itemsCount - index;
	}

	opacity(index: number): number {
		if (!this.isVisible(index)) return 0;
		return this.expanded ? 1 : 1 - index * OPACITY_STEP;
	}

	// -------------------------------------------------------------------------
	// Commands — each already past the caller's handler and its `defaultPrevented` check
	// -------------------------------------------------------------------------

	onPointerEnter(): void {
		if (this.#props.getExpandOnHover()) this.expanded = true;
	}

	onPointerMove(): void {
		if (this.#props.getExpandOnHover()) this.expanded = true;
	}

	onPointerLeave(): void {
		if (this.#props.getExpandOnHover() && !this.interacting) this.expanded = false;
	}

	onPressStart(): void {
		this.interacting = true;
	}

	onPressEnd(): void {
		this.interacting = false;
	}
}

const STACK_CONTEXT_KEY = Symbol('stack');

export function setStackContext(state: StackState): StackState {
	return setContext(STACK_CONTEXT_KEY, state);
}

/** Read the root's state, throwing when there is no `<Stack.Root>` ancestor (FR-021). */
export function getStackContext(): StackState {
	if (!hasContext(STACK_CONTEXT_KEY)) {
		throw new Error('`<Stack.Item>` must be used within `<Stack.Root>`.');
	}
	return getContext<StackState>(STACK_CONTEXT_KEY);
}
