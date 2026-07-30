import { SvelteMap } from 'svelte/reactivity';

/** One registered element plus whatever metadata its owner needs at read time. */
export type DomOrderedEntry<TMeta> = {
	readonly id: string;
	readonly element: HTMLElement;
	readonly meta: TMeta;
};

/**
 * Sorts two elements by document position, verbatim from upstream's `getNodes()`
 * (speed-dial.tsx:216-228).
 */
function compareDocumentOrder<TMeta>(a: DomOrderedEntry<TMeta>, b: DomOrderedEntry<TMeta>): number {
	const position = a.element.compareDocumentPosition(b.element);
	if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
	if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
	return 0;
}

/**
 * Position of every entry, by id.
 *
 * Built here rather than inside the class because the result is only ever *replaced*, never mutated
 * — the `ReadonlyMap` return type says so, and keeping the construction outside the reactive class
 * keeps that promise checkable (the same reasoning as `masonry`'s `collectVisible`).
 */
function toIndexMap<TMeta>(
	ordered: readonly DomOrderedEntry<TMeta>[]
): ReadonlyMap<string, number> {
	return new Map(ordered.map((entry, index) => [entry.id, index]));
}

/**
 * A document-ordered registry of self-registering elements.
 *
 * Replaces upstream's local `getNodes()` (speed-dial.tsx:213-229), which is itself a copy of
 * `@diceui/shared`'s `useCollection`. Speed Dial needs it twice — once for the focusable nodes that
 * bound the `Tab` exit, once for the items that derive their stagger index — so it is written once,
 * generically, and **exported from the barrel** for later ports to reuse rather than duplicate
 * (research R-16).
 *
 * The sort runs **once per structural change** inside `ordered`, and `indexById` is built from it in
 * one pass, so every consumer pays a single `Map.get` instead of its own sort. That is what keeps
 * the item stagger O(n log n) rather than the O(n²) upstream regressed on (research R-01).
 *
 * ```ts
 * const collection = new DomOrderedCollection<{ getDisabled: () => boolean }>();
 *
 * $effect(() => {
 * 	if (!ref) return;
 * 	collection.register(id, ref, { getDisabled: () => disabled });
 * 	return () => collection.unregister(id);
 * });
 * ```
 */
export class DomOrderedCollection<TMeta = undefined> {
	#entries = new SvelteMap<string, DomOrderedEntry<TMeta>>();

	/**
	 * Every registered entry in document order. Entries whose element has been detached without
	 * unregistering are dropped, mirroring upstream's `filter((node) => node.ref.current)`.
	 */
	readonly ordered: readonly DomOrderedEntry<TMeta>[] = $derived.by(() =>
		Array.from(this.#entries.values())
			.filter((entry) => entry.element.isConnected)
			.sort(compareDocumentOrder)
	);

	/** Document-order index of every entry, computed once and shared by all readers. */
	readonly indexById: ReadonlyMap<string, number> = $derived.by(() => toIndexMap(this.ordered));

	/** How many entries are currently registered and attached. */
	readonly size: number = $derived(this.ordered.length);

	/** Idempotent — re-registering the same id replaces the entry. */
	register(id: string, element: HTMLElement, meta: TMeta): void {
		this.#entries.set(id, { id, element, meta });
	}

	/** No-op for an unknown id. */
	unregister(id: string): void {
		this.#entries.delete(id);
	}

	/** A plain snapshot of the ordered elements, for use inside event handlers. */
	elements(): HTMLElement[] {
		return this.ordered.map((entry) => entry.element);
	}
}
