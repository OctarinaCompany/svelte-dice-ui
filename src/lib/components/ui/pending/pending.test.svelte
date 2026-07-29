<script lang="ts" module>
	import type { MouseEventHandler } from 'svelte/elements';

	/**
	 * Props of the prop-driven test harness used by `pending.test.ts`.
	 *
	 * `usePending()` may only be called during a component's initialisation, and `bind:ref` /
	 * `{#snippet child({ props })}` need a real parent, so a `.ts` spec cannot exercise either
	 * directly. Not collected by Vitest (`include` is `.{js,ts}`) and not listed in `registry.json`.
	 */
	export type PendingHarnessProps = {
		/** Forwarded to `usePending` / `Pending.Root`. */
		isPending?: boolean;
		/** Forwarded to `usePending` / `Pending.Root`. */
		disabled?: boolean;
		/** Forwarded to `usePending` / `Pending.Root`. */
		id?: string;
		/** Applied to a wrapping `<div dir>` around every rendering mode. */
		dir?: 'ltr' | 'rtl';
		/** Render `<Pending.Root>` in merge mode (`child` snippet) around a `<Button>`. */
		useWrapperChild?: boolean;
		/** Render `<Pending.Root>` in fallback mode (`children`) around a `<Button>`. */
		useWrapperChildren?: boolean;
		/** Render `<Pending.Root>` in merge mode around an `<a href="/x">`. */
		useLink?: boolean;
		/** Render `<Pending.Root>` in merge mode around `$lib/components/ui/switch`. */
		useSwitch?: boolean;
		/** Render `<Pending.Root>` in merge mode around `$lib/components/ui/input`. */
		useInput?: boolean;
		/** Render a `<form onsubmit>` with a required `<input>` and a hook-driven submit `<Button>`. */
		useForm?: boolean;
		/** Render `<Pending.Root>` with neither `child` nor `children` — must throw. */
		useMissingChild?: boolean;
		/** Render `<Pending.Root>` with both `child` and `children` supplied — `child` must win. */
		useBothChildren?: boolean;
		/** Forwarded onto the interactive element, spread before the pending props. */
		onclick?: MouseEventHandler<HTMLElement>;
		/** Forwarded to the form's `onsubmit`, called after `event.preventDefault()`. */
		onsubmit?: (event: SubmitEvent) => void;
		/** Bindable `checked` for the switch mode. */
		switchChecked?: boolean;
		/** Bound to `Pending.Root`'s `ref` (the fallback `<span>`, or `null` in merge mode). */
		rootRef?: HTMLElement | null;
		/** Bound to whichever element hosts the pending attributes in the selected mode. */
		targetRef?: HTMLElement | null;
	};
</script>

<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import * as Pending from './index.js';

	let {
		isPending = false,
		disabled = false,
		id,
		dir,
		useWrapperChild = false,
		useWrapperChildren = false,
		useLink = false,
		useSwitch = false,
		useInput = false,
		useForm = false,
		useMissingChild = false,
		useBothChildren = false,
		onclick,
		onsubmit,
		switchChecked = $bindable(false),
		rootRef = $bindable(null),
		targetRef = $bindable(null)
	}: PendingHarnessProps = $props();

	const pending = Pending.usePending({
		id: () => id,
		isPending: () => isPending,
		disabled: () => disabled
	});

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		onsubmit?.(event);
	}
</script>

<div {dir}>
	{#if useMissingChild}
		<Pending.Root {isPending} {disabled} {id} bind:ref={rootRef} />
	{:else if useBothChildren}
		<Pending.Root {isPending} {disabled} {id} bind:ref={rootRef}>
			{#snippet child({ props })}
				<button type="button" data-testid="child-wins" {onclick} {...props} bind:this={targetRef}
					>Submit</button
				>
			{/snippet}
			<button type="button" data-testid="children-loses">Submit</button>
		</Pending.Root>
	{:else if useWrapperChild}
		<Pending.Root {isPending} {disabled} {id} bind:ref={rootRef}>
			{#snippet child({ props })}
				<Button {onclick} {...props} bind:ref={targetRef}>Submit</Button>
			{/snippet}
		</Pending.Root>
	{:else if useWrapperChildren}
		<Pending.Root {isPending} {disabled} {id} bind:ref={rootRef}>
			<Button {onclick} bind:ref={targetRef}>Submit</Button>
		</Pending.Root>
	{:else if useLink}
		<Pending.Root {isPending} {disabled} {id} bind:ref={rootRef}>
			{#snippet child({ props })}
				<a href="/x" {onclick} {...props} bind:this={targetRef}>Go</a>
			{/snippet}
		</Pending.Root>
	{:else if useSwitch}
		<Pending.Root {isPending} {disabled} {id} bind:ref={rootRef}>
			{#snippet child({ props })}
				<Switch bind:checked={switchChecked} {...props} bind:ref={targetRef} />
			{/snippet}
		</Pending.Root>
	{:else if useInput}
		<Pending.Root {isPending} {disabled} {id} bind:ref={rootRef}>
			{#snippet child({ props })}
				<Input {...props} bind:ref={targetRef} />
			{/snippet}
		</Pending.Root>
	{:else if useForm}
		<form onsubmit={handleSubmit}>
			<input required />
			<Button type="submit" {...pending.pendingProps} bind:ref={targetRef}>Submit</Button>
		</form>
	{:else}
		<Button {onclick} {...pending.pendingProps} bind:ref={targetRef}>Submit</Button>
	{/if}
</div>
