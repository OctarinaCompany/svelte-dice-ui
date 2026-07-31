<script lang="ts" module>
	import type { Snippet } from 'svelte';

	export type ComboboxPortalProps = {
		/**
		 * Where the popover is portalled to — an element or a selector.
		 *
		 * @default document.body
		 */
		to?: Element | string;
		/**
		 * Whether to leave the content in place instead of portalling it.
		 *
		 * @default false
		 */
		disabled?: boolean;
		/** Normally a `<Combobox.Content>`. */
		children?: Snippet;
	};
</script>

<script lang="ts">
	import { Popover as PopoverPrimitive } from 'bits-ui';

	import { getComboboxContext } from './combobox.svelte.js';

	let { to, disabled = false, children }: ComboboxPortalProps = $props();

	// Only for the guard-rail error: the portal renders nothing of its own.
	getComboboxContext('<Combobox.Portal>');
</script>

<PopoverPrimitive.Portal {to} {disabled}>
	{@render children?.()}
</PopoverPrimitive.Portal>
