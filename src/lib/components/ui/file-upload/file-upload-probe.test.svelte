<script lang="ts" module>
	import type { FileUploadRootState } from './index.js';

	/**
	 * A consumer of the documented `useFileUpload()` hook (contracts §6). It exists only so a spec can
	 * observe the hook from *inside* `<FileUpload.Root>`: a `.ts` spec has no way to call a function
	 * that reads Svelte context, and the harness's own instance script runs above the root.
	 *
	 * Not collected by Vitest (`include` is `.{js,ts}`) and not listed in `registry.json`.
	 */
	export type FileUploadProbeProps = {
		/** Receives the state the hook returned, so a spec can drive its methods directly. */
		onstate?: (state: FileUploadRootState) => void;
	};
</script>

<script lang="ts">
	import { untrack } from 'svelte';

	import { useFileUpload } from './index.js';

	let { onstate }: FileUploadProbeProps = $props();

	const root = useFileUpload();

	// The state is resolved once, at initialisation, so the callback is read the same way — through a
	// closure, which is also what keeps this out of the compiler's `state_referenced_locally` net.
	untrack(() => onstate)?.(root);
</script>

<div data-testid="probe">
	<span data-testid="probe-count">{root.count}</span>
	<span data-testid="probe-files">{root.files.map((file) => file.name).join(' ')}</span>
	<span data-testid="probe-entries"
		>{root.entries
			.map((entry) => `${entry.file.name}:${entry.status}:${entry.progress}`)
			.join(' ')}</span
	>
	<span data-testid="probe-drag-over">{String(root.dragOver)}</span>
	<span data-testid="probe-invalid">{String(root.invalidState)}</span>
</div>
