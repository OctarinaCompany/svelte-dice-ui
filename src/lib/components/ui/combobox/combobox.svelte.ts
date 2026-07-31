import type { Direction } from '$lib/components/ui/direction-provider/index.js';
import { getContext, hasContext, setContext, tick, untrack } from 'svelte';

import {
	ComboboxFilterStore,
	type ComboboxFilterItem,
	type ComboboxFilterRunOptions
} from './combobox-filter.js';

/**
 * The Root's public value type: a plain string in single-selection mode, an array when `multiple`.
 * Internally every consumer sees a normalised `string[]` (`ComboboxRootState.values`).
 */
export type ComboboxValue<Multiple extends boolean = false> = Multiple extends true
	? string[]
	: string;

/** The five moves `ComboboxRootState.highlightMove` understands (upstream `HighlightingDirection`). */
export type ComboboxHighlightDirection = 'next' | 'prev' | 'first' | 'last' | 'selected';

/** `"horizontal" | "vertical"` — the badge list's layout axis. */
export type ComboboxOrientation = 'horizontal' | 'vertical';

/**
 * One registered `<Combobox.Item>`.
 *
 * A plain snapshot rather than a bag of getters: the item re-registers whenever any of these move,
 * so the collection never has to reach back into a component that may already be gone.
 */
export type ComboboxItemData = {
	/**
	 * The rendered element — `null` while the item is filtered out. Collection key, scroll target
	 * and `aria-activedescendant` source.
	 */
	readonly element: HTMLElement | null;
	readonly id: string;
	readonly value: string;
	/** The explicit `label` prop, else the `<Combobox.ItemText>` text, else `''`. */
	readonly label: string;
	/** The item's own `disabled`, OR-ed with the root's. */
	readonly disabled: boolean;
	readonly onSelect: ((value: string) => void) | undefined;
	/** The id of the nearest `<Combobox.Group>`, when there is one. */
	readonly groupId: string | undefined;
};

/** A {@link ComboboxItemData} whose element is in the DOM — what navigation and selection walk. */
export type ComboboxMountedItem = ComboboxItemData & { readonly element: HTMLElement };

/** Upstream's `compareNodePosition` (`@diceui/shared` `lib/node.ts`). */
function compareNodePosition(a: Node, b: Node): number {
	const position = a.compareDocumentPosition(b);
	if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
	if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
	return 0;
}

/**
 * Upstream's `useCollection({ grouped: true })` — a DOM-ordered item registry with group membership.
 *
 * A filtered-out `<Combobox.Item>` renders nothing but stays registered (its `$effect` runs whether
 * or not its element is in the DOM), which is exactly what lets it come back when the search clears:
 * {@link entries} feeds the filter and includes every registration, while {@link getItems} feeds
 * keyboard navigation and only includes the ones with a mounted element.
 */
export class ComboboxCollection {
	// `$state.raw`: the entries are replaced wholesale, and a deep proxy would make the teardown's
	// identity comparison against the original snapshot fail.
	#items = $state.raw<readonly ComboboxItemData[]>([]);

	/** Every registered item's `(value, groupId)` pair — the filter store's input. */
	readonly entries: readonly ComboboxFilterItem[] = $derived(
		this.#items.map((item) => ({ value: item.value, groupId: item.groupId }))
	);

	/** How many items are registered, mounted or not (upstream's unfiltered `itemCount`). */
	readonly size: number = $derived(this.#items.length);

	/**
	 * Called from the item's `$effect`; the returned thunk is its teardown. Both reads of the list
	 * are untracked: the caller is an effect, and subscribing it to the very list it is appending to
	 * would re-run it forever.
	 */
	register(item: ComboboxItemData): () => void {
		this.#items = [...untrack(() => this.#items), item];
		return () => {
			this.#items = untrack(() => this.#items).filter((registered) => registered !== item);
		};
	}

	/** Every mounted item, in document order. */
	getItems(): ComboboxMountedItem[] {
		return this.#items
			.filter((item): item is ComboboxMountedItem => item.element !== null)
			.sort((a, b) => compareNodePosition(a.element, b.element));
	}

	/** The values registered under `groupId`, mounted or not. */
	getGroupValues(groupId: string): string[] {
		return this.#items.filter((item) => item.groupId === groupId).map((item) => item.value);
	}
}

export type ComboboxRootStateProps = {
	/** The normalised value: `[]`, `[one]` or the whole array when `multiple`. */
	readonly getValues: () => string[];
	readonly setValues: (values: string[]) => void;
	readonly getOpen: () => boolean;
	readonly setOpen: (open: boolean) => void;
	readonly getInputValue: () => string;
	readonly setInputValue: (value: string) => void;
	readonly getOnInputValueChange: () => ((value: string) => void) | undefined;
	readonly getOnFilter: () => ((options: string[], inputValue: string) => string[]) | undefined;
	/** `String(defaultValue)` in single mode, else `undefined` — what `setOpen` seeds the label from. */
	readonly getDefaultValueText: () => string | undefined;
	readonly getAutoHighlight: () => boolean;
	readonly getDisabled: () => boolean;
	readonly getExactMatch: () => boolean;
	readonly getManualFiltering: () => boolean;
	readonly getLoop: () => boolean;
	readonly getModal: () => boolean;
	readonly getMultiple: () => boolean;
	readonly getOpenOnFocus: () => boolean;
	readonly getPreserveInputOnBlur: () => boolean;
	readonly getReadOnly: () => boolean;
	readonly getDir: () => Direction;
	/** The one `$props.id()` every part's id derives from. */
	readonly id: string;
};

/** Keys the input consumes outright, so the caret never moves while the popover owns them. */
const PREVENTED_KEYS = [
	'ArrowDown',
	'ArrowUp',
	'Home',
	'End',
	'Enter',
	'Escape',
	'PageUp',
	'PageDown'
] as const;

/**
 * One instance per `<Combobox.Root>`, published on the root context.
 *
 * Replaces upstream's 40-field `ComboboxContextValue` (`combobox-root.tsx:47-94`) plus its
 * `useControllableState`, `useCollection`, `useFilterStore` and `useListHighlighting`. Reactive
 * inputs arrive as getter functions rather than snapshots, and the value is read straight from the
 * Root's `$bindable` props — there is no mirror `$state`, which is what lets an authoritative parent
 * decline a write.
 */
export class ComboboxRootState {
	// $derived below is lazy at runtime (evaluated only when the field is read), but svelte-check's
	// static analysis cannot see that and flags the field as used before its constructor assignment.
	#props!: ComboboxRootStateProps;

	/** The label of the current single selection; what `Escape` and blur restore. */
	selectedText = $state('');
	/** The highlighted item's element. `aria-activedescendant` and `data-highlighted` follow it. */
	highlightedElement = $state<HTMLElement | null>(null);
	/** `-1` means the caret owns the interaction rather than a badge. */
	highlightedBadgeIndex = $state(-1);
	/** The trimmed input text driving the filter — upstream's `filterStore.search`. */
	search = $state('');
	/** Set by `<Combobox.Anchor>`; decides what the popover anchors to. */
	anchorElement = $state<HTMLElement | null>(null);
	/** Every refocus target. */
	inputElement = $state<HTMLInputElement | null>(null);
	/** Set by `<Combobox.BadgeList>`; gates badge keyboard navigation in the input. */
	hasBadgeList = $state(false);

	readonly collection = new ComboboxCollection();

	readonly values: string[] = $derived(this.#props.getValues());
	readonly open: boolean = $derived(this.#props.getOpen());
	readonly inputValue: string = $derived(this.#props.getInputValue());
	readonly autoHighlight: boolean = $derived(this.#props.getAutoHighlight());
	readonly disabled: boolean = $derived(this.#props.getDisabled());
	readonly exactMatch: boolean = $derived(this.#props.getExactMatch());
	readonly manualFiltering: boolean = $derived(this.#props.getManualFiltering());
	readonly loop: boolean = $derived(this.#props.getLoop());
	readonly modal: boolean = $derived(this.#props.getModal());
	readonly multiple: boolean = $derived(this.#props.getMultiple());
	readonly openOnFocus: boolean = $derived(this.#props.getOpenOnFocus());
	readonly preserveInputOnBlur: boolean = $derived(this.#props.getPreserveInputOnBlur());
	readonly readOnly: boolean = $derived(this.#props.getReadOnly());
	readonly dir: Direction = $derived(this.#props.getDir());

	readonly hasAnchor: boolean = $derived(this.anchorElement !== null);
	readonly dataState: 'open' | 'closed' = $derived(this.open ? 'open' : 'closed');

	readonly inputId: string = $derived(`${this.#props.id}-input`);
	readonly labelId: string = $derived(`${this.#props.id}-label`);
	readonly listId: string = $derived(`${this.#props.id}-list`);

	/**
	 * The scored view of the collection. Recomputed whenever the search, the options or the item set
	 * move — upstream's explicit `onItemsFilter()` call, made automatic.
	 */
	readonly filter: ComboboxFilterStore = $derived.by(() => {
		const options: ComboboxFilterRunOptions = {
			exactMatch: this.exactMatch,
			manualFiltering: this.manualFiltering,
			onFilter: this.#props.getOnFilter()
		};
		return new ComboboxFilterStore(this.search).run(this.collection.entries, options);
	});

	/** What keyboard navigation walks: mounted, enabled and not filtered out. */
	readonly visibleItems: ComboboxMountedItem[] = $derived(
		this.collection.getItems().filter((item) => !item.disabled && this.isItemVisible(item.value))
	);

	readonly highlightedItem: ComboboxMountedItem | null = $derived.by(() => {
		const element = this.highlightedElement;
		if (!element) return null;
		return this.collection.getItems().find((item) => item.element === element) ?? null;
	});

	constructor(props: ComboboxRootStateProps) {
		this.#props = props;
	}

	isItemVisible(value: string): boolean {
		return this.filter.isItemVisible(value);
	}

	isListEmpty(manual = false): boolean {
		return this.filter.isListEmpty(manual);
	}

	isGroupVisible(groupId: string, forceMount = false): boolean {
		return this.filter.isGroupVisible(groupId, forceMount);
	}

	isSelected(value: string): boolean {
		return this.values.includes(value);
	}

	focusInput(): void {
		this.inputElement?.focus();
	}

	/**
	 * Upstream `onValueChange` (`combobox-root.tsx:333-351`): multiple toggles the value in and out
	 * and ignores the empty string, single simply replaces.
	 */
	setValue(next: string): void {
		if (this.disabled || this.readOnly) return;

		if (this.multiple) {
			if (!next) return;
			const values = this.values;
			this.#props.setValues(
				values.includes(next) ? values.filter((value) => value !== next) : [...values, next]
			);
			return;
		}

		this.#props.setValues(next === '' ? [] : [next]);
	}

	/** Upstream `onItemRemove` (`combobox-root.tsx:353-361`). */
	removeValue(value: string): void {
		this.#props.setValues(this.values.filter((current) => current !== value));
	}

	/** Upstream's `setOpen` `onChange` (`combobox-root.tsx:289-305`). */
	setOpen(next: boolean): void {
		if (next === this.open) return;

		if (!next) this.search = '';

		this.#props.setOpen(next);

		if (this.multiple) {
			this.highlightedBadgeIndex = -1;
			return;
		}

		const seed = this.#props.getDefaultValueText();
		if (seed && this.selectedText === '') this.selectedText = seed;
	}

	/**
	 * Upstream's `setInputValue` `onChange` (`combobox-root.tsx:312-322`). The `autoHighlight` move is
	 * deferred so it runs against the *filtered* list, and so it still lands when the same keystroke
	 * is what opened the popover.
	 */
	setInputValue(next: string): void {
		if (this.disabled || this.readOnly) return;

		this.#props.setInputValue(next);
		this.#props.getOnInputValueChange()?.(next);

		if (this.autoHighlight && this.open) void this.#highlightWhenReady('first');
	}

	/**
	 * Upstream `useListHighlighting`'s `onHighlightMove` (`use-list-highlighting.ts:22-73`), over the
	 * visible, enabled items only.
	 */
	highlightMove(direction: ComboboxHighlightDirection): void {
		const items = this.visibleItems;
		if (items.length === 0) return;

		const currentIndex = items.findIndex((item) => item.element === this.highlightedElement);
		const lastIndex = items.length - 1;
		let nextIndex: number;

		switch (direction) {
			case 'next': {
				nextIndex = currentIndex + 1;
				nextIndex = nextIndex > lastIndex ? (this.loop ? 0 : lastIndex) : nextIndex;
				break;
			}
			case 'prev': {
				nextIndex = currentIndex - 1;
				nextIndex = nextIndex < 0 ? (this.loop ? lastIndex : 0) : nextIndex;
				break;
			}
			case 'first':
				nextIndex = 0;
				break;
			case 'last':
				nextIndex = lastIndex;
				break;
			case 'selected': {
				const selected = this.values[0];
				nextIndex = items.findIndex((item) => item.value === selected);
				nextIndex = nextIndex === -1 ? 0 : nextIndex;
				break;
			}
		}

		const nextItem = items[nextIndex];
		if (!nextItem) return;

		nextItem.element.scrollIntoView({ block: 'nearest' });
		this.highlightedElement = nextItem.element;
	}

	/**
	 * Upstream `<ComboboxItem>`'s `onItemSelect` (`combobox-item.tsx:79-123`). `onSelect` is invoked
	 * directly rather than through a synthetic `CustomEvent` round-trip (divergence D-9).
	 */
	selectItem(item: ComboboxMountedItem): void {
		if (this.disabled || this.readOnly) return;

		item.onSelect?.(item.value);

		if (this.multiple) {
			this.setInputValue('');
		} else {
			const label = item.label || (item.element.textContent ?? '').trim();
			this.setInputValue(label);
			this.selectedText = label;
			this.highlightedElement = null;
			this.setOpen(false);
		}

		this.search = '';
		this.setValue(item.value);
		this.focusInput();
	}

	/** Upstream `<ComboboxInput>`'s `onChange` (`combobox-input.tsx:24-56`). */
	onInputChange(text: string): void {
		if (this.disabled || this.readOnly) return;

		if (!this.open) this.setOpen(true);

		const trimmed = text.trim();
		this.search = trimmed;

		if (trimmed === '') {
			this.setValue('');
			this.highlightedElement = null;
		}

		this.setInputValue(text);
	}

	/** Upstream `<ComboboxInput>`'s `onFocus` (`combobox-input.tsx:58-67`). */
	onInputFocus(): void {
		if (this.openOnFocus && !this.open && !this.readOnly && !this.disabled) this.setOpen(true);
	}

	/** Upstream `<ComboboxInput>`'s `onBlur` (`combobox-input.tsx:69-92`). */
	onInputBlur(): void {
		if (!this.multiple && this.values.length > 0) {
			this.setInputValue(this.selectedText);
			return;
		}

		if (this.inputValue && !this.preserveInputOnBlur) {
			this.setInputValue('');
			this.highlightedElement = null;
		}

		if (this.multiple) this.highlightedBadgeIndex = -1;
	}

	/** Upstream `<ComboboxTrigger>`'s click handler (`combobox-trigger.tsx:35-58`). */
	async toggleFromTrigger(): Promise<void> {
		const nextOpen = !this.open;
		this.setOpen(nextOpen);

		await tick();

		const input = this.inputElement;
		if (input) {
			input.focus();
			const length = input.value.length;
			input.setSelectionRange(length, length);
		}

		if (!nextOpen) return;

		if (this.values.length > 0) {
			await this.#highlightWhenReady('selected');
			return;
		}

		if (this.autoHighlight) await this.#highlightWhenReady('first');
	}

	/** Upstream `<ComboboxCancel>`'s click handler (`combobox-cancel.tsx:41-47`). */
	clearInput(): void {
		this.setInputValue('');
		this.search = '';
		void tick().then(() => this.focusInput());
	}

	/**
	 * Upstream `<ComboboxInput>`'s `onKeyDown` (`combobox-input.tsx:94-365`).
	 *
	 * Horizontal badge navigation is mapped through `dir` first, so `ArrowRight` is what reaches the
	 * badges under `dir="rtl"` (FR-038 — a divergence from upstream, which reads no direction here).
	 */
	onInputKeydown(event: KeyboardEvent): void {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement)) return;

		if ((PREVENTED_KEYS as readonly string[]).includes(event.key)) event.preventDefault();

		switch (event.key) {
			case 'Enter': {
				if (this.multiple && this.hasBadgeList && this.highlightedBadgeIndex > -1) {
					const valueToRemove = this.values[this.highlightedBadgeIndex];
					if (valueToRemove) {
						this.removeValue(valueToRemove);
						this.highlightedBadgeIndex = -1;
						return;
					}
				}

				if (!this.open) {
					if (this.inputValue.trim()) {
						this.#openMenu();
					} else if (!this.multiple && this.values.length > 0) {
						this.setInputValue(this.selectedText);
					}
					return;
				}

				const highlighted = this.highlightedItem;
				if (!highlighted || this.isListEmpty()) {
					this.setInputValue(!this.multiple && this.values.length > 0 ? this.selectedText : '');
					this.setOpen(false);
					return;
				}

				this.selectItem(highlighted);
				break;
			}
			case 'ArrowDown': {
				if (this.open) this.#move(this.highlightedItem ? 'next' : 'first');
				else this.#openMenu(this.values.length > 0 ? 'selected' : 'first');
				break;
			}
			case 'ArrowUp': {
				if (this.open) this.#move(this.highlightedItem ? 'prev' : 'last');
				else this.#openMenu(this.values.length > 0 ? 'selected' : 'last');
				break;
			}
			case 'ArrowLeft':
			case 'ArrowRight': {
				if (!this.multiple || !this.hasBadgeList) return;

				// The key that points at the badges is `ArrowLeft` in LTR and `ArrowRight` in RTL.
				const towardBadges = (event.key === 'ArrowLeft') === (this.dir === 'ltr');
				if (towardBadges) this.#badgeNavigateToward(event, input);
				else this.#badgeNavigateAway(event, input);
				break;
			}
			case 'Home': {
				if (this.open) this.#move('first');
				break;
			}
			case 'End': {
				if (this.open) this.#move('last');
				break;
			}
			case 'PageUp': {
				if (this.modal && this.open) this.#move('prev');
				break;
			}
			case 'PageDown': {
				if (this.modal && this.open) this.#move('next');
				break;
			}
			case 'Tab': {
				if (this.open && this.modal) {
					event.preventDefault();
					return;
				}
				this.#closeMenu();
				break;
			}
			case 'Backspace':
			case 'Delete': {
				if (!this.multiple || !this.hasBadgeList) break;
				if (this.inputValue) break;

				const values = this.values;
				if (values.length === 0) break;

				if (this.highlightedBadgeIndex > -1) {
					const valueToRemove = values[this.highlightedBadgeIndex];
					if (valueToRemove) {
						const nextIndex = Math.max(0, this.highlightedBadgeIndex - 1);
						this.removeValue(valueToRemove);
						this.highlightedBadgeIndex = values.length > 1 ? nextIndex : -1;
					}
					break;
				}

				const lastValue = values[values.length - 1];
				if (lastValue) this.removeValue(lastValue);
				break;
			}
			case 'Escape': {
				this.setInputValue(this.values.length > 0 && !this.multiple ? this.selectedText : '');
				this.#closeMenu();
				break;
			}
		}
	}

	/** Upstream's local `onHighlightMove` wrapper (`combobox-input.tsx:96-104`). */
	#move(direction: ComboboxHighlightDirection): void {
		if (direction === 'selected' && this.values.length === 0) {
			this.highlightMove('first');
			return;
		}
		this.highlightMove(direction);
	}

	/**
	 * Wait for the popover's items to mount, then move the highlight. Replaces upstream's
	 * `requestAnimationFrame` hop (research R-10): `tick()` is Svelte's "the DOM has been updated"
	 * primitive and is deterministic under Vitest, and the retry covers the extra flush `bits-ui`'s
	 * presence layer needs before the list exists.
	 */
	async #highlightWhenReady(direction: ComboboxHighlightDirection): Promise<void> {
		for (let attempt = 0; attempt < 3; attempt++) {
			await tick();
			if (this.visibleItems.length > 0) break;
		}
		this.#move(direction);
	}

	/** Upstream's local `onMenuOpen` (`combobox-input.tsx:145-152`). */
	#openMenu(direction?: ComboboxHighlightDirection): void {
		if (this.open) return;

		this.setOpen(true);
		if (direction) void this.#highlightWhenReady(direction);
	}

	/** Upstream's local `onMenuClose` (`combobox-input.tsx:154-159`). */
	#closeMenu(): void {
		if (!this.open) return;

		this.setOpen(false);
		this.highlightedElement = null;
	}

	/**
	 * The badge-ward arrow (`ArrowLeft` in LTR, `ArrowRight` in RTL), which only engages with the
	 * caret at position 0 — upstream `combobox-input.tsx:226-258`.
	 */
	#badgeNavigateToward(event: KeyboardEvent, input: HTMLInputElement): void {
		const isAtStart = input.selectionStart === 0 && input.selectionEnd === 0;
		if (!isAtStart) return;

		const values = this.values;

		if (this.open) {
			this.highlightedElement = null;
			if (values.length === 0) return;

			event.preventDefault();
			// `setOpen` resets the badge highlight in multiple mode, so claim the badge afterwards —
			// which is what upstream's `requestAnimationFrame` hop is waiting for.
			this.setOpen(false);
			this.highlightedBadgeIndex = values.length - 1;
			return;
		}

		if (this.highlightedBadgeIndex > -1) {
			event.preventDefault();
			this.highlightedBadgeIndex = Math.max(0, this.highlightedBadgeIndex - 1);
			return;
		}

		if (values.length === 0) return;

		event.preventDefault();
		this.highlightedBadgeIndex = values.length - 1;
	}

	/**
	 * The input-ward arrow (`ArrowRight` in LTR, `ArrowLeft` in RTL), which only engages with the
	 * caret at the end — upstream `combobox-input.tsx:259-282`.
	 */
	#badgeNavigateAway(event: KeyboardEvent, input: HTMLInputElement): void {
		const isAtEnd =
			input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
		if (!isAtEnd) return;

		if (this.open || this.highlightedBadgeIndex === -1) return;

		event.preventDefault();

		if (this.highlightedBadgeIndex < this.values.length - 1) {
			this.highlightedBadgeIndex += 1;
			return;
		}

		this.highlightedBadgeIndex = -1;
		input.focus();
	}
}

export type ComboboxItemStateProps = {
	readonly root: ComboboxRootState;
	readonly getValue: () => string;
	readonly getDisabled: () => boolean;
	/** The item's own `$props.id()`. */
	readonly id: string;
};

/** One instance per `<Combobox.Item>`, published on the item context for its text and indicator. */
export class ComboboxItemState {
	#props!: ComboboxItemStateProps;

	/** Set by `<Combobox.ItemText>`; the label falls back to its `textContent`. */
	labelElement = $state<HTMLElement | null>(null);

	readonly value: string = $derived(this.#props.getValue());
	readonly id: string = $derived(this.#props.id);
	readonly textId: string = $derived(`${this.#props.id}-text`);
	readonly isSelected: boolean = $derived(this.#props.root.isSelected(this.value));
	readonly isDisabled: boolean = $derived(this.#props.getDisabled() || this.#props.root.disabled);
	readonly isHighlighted: boolean = $derived(
		this.#props.root.highlightedItem?.id === this.#props.id
	);
	readonly isVisible: boolean = $derived(this.#props.root.isItemVisible(this.value));
	readonly dataState: 'checked' | 'unchecked' = $derived(this.isSelected ? 'checked' : 'unchecked');

	get root(): ComboboxRootState {
		return this.#props.root;
	}

	constructor(props: ComboboxItemStateProps) {
		this.#props = props;
	}
}

export type ComboboxGroupStateProps = {
	readonly id: string;
	readonly getForceMount: () => boolean;
};

/** One instance per `<Combobox.Group>`, published for `<Combobox.GroupLabel>` and its items. */
export class ComboboxGroupState {
	#props!: ComboboxGroupStateProps;

	readonly id: string = $derived(this.#props.id);
	readonly labelId: string = $derived(`${this.#props.id}-label`);
	readonly forceMount: boolean = $derived(this.#props.getForceMount());

	constructor(props: ComboboxGroupStateProps) {
		this.#props = props;
	}
}

export type ComboboxBadgeListStateProps = {
	readonly root: ComboboxRootState;
	readonly getOrientation: () => ComboboxOrientation;
};

/** One instance per `<Combobox.BadgeList>`, published for its badges. */
export class ComboboxBadgeListState {
	#props!: ComboboxBadgeListStateProps;

	readonly orientation: ComboboxOrientation = $derived(this.#props.getOrientation());
	readonly badgeCount: number = $derived(this.#props.root.values.length);

	constructor(props: ComboboxBadgeListStateProps) {
		this.#props = props;
	}
}

export type ComboboxBadgeItemStateProps = {
	readonly root: ComboboxRootState;
	readonly getValue: () => string;
	readonly getDisabled: () => boolean;
	readonly id: string;
};

/** One instance per `<Combobox.BadgeItem>`, published for `<Combobox.BadgeItemDelete>`. */
export class ComboboxBadgeItemState {
	#props!: ComboboxBadgeItemStateProps;

	readonly id: string = $derived(this.#props.id);
	readonly value: string = $derived(this.#props.getValue());
	readonly index: number = $derived(this.#props.root.values.indexOf(this.value));
	readonly isHighlighted: boolean = $derived(this.index === this.#props.root.highlightedBadgeIndex);
	readonly position: number = $derived(this.index + 1);
	readonly disabled: boolean = $derived(this.#props.getDisabled() || this.#props.root.disabled);

	get root(): ComboboxRootState {
		return this.#props.root;
	}

	constructor(props: ComboboxBadgeItemStateProps) {
		this.#props = props;
	}
}

export type ComboboxContentStateProps = {
	readonly getSide: () => 'top' | 'right' | 'bottom' | 'left';
	readonly getAlign: () => 'start' | 'center' | 'end';
	readonly getForceMount: () => boolean;
};

/** One instance per `<Combobox.Content>`, published for `<Combobox.Arrow>`. */
export class ComboboxContentState {
	#props!: ComboboxContentStateProps;

	readonly side: 'top' | 'right' | 'bottom' | 'left' = $derived(this.#props.getSide());
	readonly align: 'start' | 'center' | 'end' = $derived(this.#props.getAlign());
	readonly forceMount: boolean = $derived(this.#props.getForceMount());

	constructor(props: ComboboxContentStateProps) {
		this.#props = props;
	}
}

const COMBOBOX_CONTEXT_KEY = Symbol('combobox');
const COMBOBOX_ITEM_CONTEXT_KEY = Symbol('combobox-item');
const COMBOBOX_GROUP_CONTEXT_KEY = Symbol('combobox-group');
const COMBOBOX_BADGE_LIST_CONTEXT_KEY = Symbol('combobox-badge-list');
const COMBOBOX_BADGE_ITEM_CONTEXT_KEY = Symbol('combobox-badge-item');
const COMBOBOX_CONTENT_CONTEXT_KEY = Symbol('combobox-content');

export function setComboboxContext(state: ComboboxRootState): ComboboxRootState {
	return setContext(COMBOBOX_CONTEXT_KEY, state);
}

/** Read the root's state, throwing when there is no `<Combobox.Root>` ancestor. */
export function getComboboxContext(consumerName: string): ComboboxRootState {
	if (!hasContext(COMBOBOX_CONTEXT_KEY)) {
		throw new Error(`\`${consumerName}\` must be used within \`<Combobox.Root>\`.`);
	}
	return getContext<ComboboxRootState>(COMBOBOX_CONTEXT_KEY);
}

export function setComboboxItemContext(state: ComboboxItemState): ComboboxItemState {
	return setContext(COMBOBOX_ITEM_CONTEXT_KEY, state);
}

/** Read the item's state, throwing when there is no `<Combobox.Item>` ancestor. */
export function getComboboxItemContext(consumerName: string): ComboboxItemState {
	if (!hasContext(COMBOBOX_ITEM_CONTEXT_KEY)) {
		throw new Error(`\`${consumerName}\` must be used within \`<Combobox.Item>\`.`);
	}
	return getContext<ComboboxItemState>(COMBOBOX_ITEM_CONTEXT_KEY);
}

export function setComboboxGroupContext(state: ComboboxGroupState): ComboboxGroupState {
	return setContext(COMBOBOX_GROUP_CONTEXT_KEY, state);
}

/**
 * Whether a `<Combobox.Group>` is above. `<Combobox.Item>` is the one consumer for which the group
 * is optional — upstream's `useComboboxGroupContext(ITEM_NAME, true)`.
 */
export function hasComboboxGroupContext(): boolean {
	return hasContext(COMBOBOX_GROUP_CONTEXT_KEY);
}

/** Read the group's state, throwing when there is no `<Combobox.Group>` ancestor. */
export function getComboboxGroupContext(consumerName: string): ComboboxGroupState {
	if (!hasComboboxGroupContext()) {
		throw new Error(`\`${consumerName}\` must be used within \`<Combobox.Group>\`.`);
	}
	return getContext<ComboboxGroupState>(COMBOBOX_GROUP_CONTEXT_KEY);
}

export function setComboboxBadgeListContext(state: ComboboxBadgeListState): ComboboxBadgeListState {
	return setContext(COMBOBOX_BADGE_LIST_CONTEXT_KEY, state);
}

/** Read the badge list's state, throwing when there is no `<Combobox.BadgeList>` ancestor. */
export function getComboboxBadgeListContext(consumerName: string): ComboboxBadgeListState {
	if (!hasContext(COMBOBOX_BADGE_LIST_CONTEXT_KEY)) {
		throw new Error(`\`${consumerName}\` must be used within \`<Combobox.BadgeList>\`.`);
	}
	return getContext<ComboboxBadgeListState>(COMBOBOX_BADGE_LIST_CONTEXT_KEY);
}

export function setComboboxBadgeItemContext(state: ComboboxBadgeItemState): ComboboxBadgeItemState {
	return setContext(COMBOBOX_BADGE_ITEM_CONTEXT_KEY, state);
}

/** Read the badge's state, throwing when there is no `<Combobox.BadgeItem>` ancestor. */
export function getComboboxBadgeItemContext(consumerName: string): ComboboxBadgeItemState {
	if (!hasContext(COMBOBOX_BADGE_ITEM_CONTEXT_KEY)) {
		throw new Error(`\`${consumerName}\` must be used within \`<Combobox.BadgeItem>\`.`);
	}
	return getContext<ComboboxBadgeItemState>(COMBOBOX_BADGE_ITEM_CONTEXT_KEY);
}

export function setComboboxContentContext(state: ComboboxContentState): ComboboxContentState {
	return setContext(COMBOBOX_CONTENT_CONTEXT_KEY, state);
}

/** Read the content's state, throwing when there is no `<Combobox.Content>` ancestor. */
export function getComboboxContentContext(consumerName: string): ComboboxContentState {
	if (!hasContext(COMBOBOX_CONTENT_CONTEXT_KEY)) {
		throw new Error(`\`${consumerName}\` must be used within \`<Combobox.Content>\`.`);
	}
	return getContext<ComboboxContentState>(COMBOBOX_CONTENT_CONTEXT_KEY);
}
