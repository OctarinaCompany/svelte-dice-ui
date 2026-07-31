<script lang="ts" module>
	import type { SortableStrategy } from '$lib/components/ui/sortable/index.js';

	/**
	 * A test-only window onto the root context.
	 *
	 * `strategy` is a documented no-op (research R-08): the root stores it and nothing renders from
	 * it, so the only way to assert the contract's default is to read it back off the context the way
	 * a consumer composing their own part would. `getContext` resolves against the component tree, so
	 * that read has to happen inside a component rendered below `<Kanban>` — which a `.ts` spec cannot
	 * express. Like `kanban.test.svelte`, this file is not collected by Vitest and is not listed in
	 * `registry.json`.
	 */
	export type KanbanTestProbeProps = {
		/** Called once, during initialisation, with what the root publishes on its context. */
		onStrategy: (strategy: SortableStrategy | undefined) => void;
	};
</script>

<script lang="ts">
	import { getKanbanContext } from './kanban.svelte.js';

	let { onStrategy }: KanbanTestProbeProps = $props();

	const root = getKanbanContext('Kanban.TestProbe');

	onStrategy(root.strategy);
</script>
