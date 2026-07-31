<script lang="ts">
	import TrashIcon from '@lucide/svelte/icons/trash';

	import { ComponentPreview } from '$lib/components/docs/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as ResponsiveDialog from '$lib/components/ui/responsive-dialog/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import * as Table from '$lib/components/ui/table/index.js';

	// --- Confirmation Dialog -------------------------------------------------
	// Upstream renders `<Loader2 className="animate-spin" />` inside the pending button; `Button` has
	// no `isPending` prop here, so the composition is `Spinner` + `disabled` (divergence D-06).
	let isDeleting = $state(false);

	function onDelete() {
		isDeleting = true;
		// Simulate deletion.
		setTimeout(() => {
			isDeleting = false;
		}, 1000);
	}

	// --- Controlled ----------------------------------------------------------
	let controlledOpen = $state(false);
	let transitions = $state(0);

	// --- API reference -------------------------------------------------------
	type PropRow = { prop: string; type: string; default: string; description: string };

	const rootProps: PropRow[] = [
		{
			prop: 'breakpoint',
			type: 'number',
			default: '768',
			description:
				'Viewport width in px at or above which a dialog is rendered instead of a drawer.'
		},
		{
			prop: 'open',
			type: 'boolean',
			default: 'undefined',
			description:
				'Controlled open state. Bindable — bind:open lets the dialog move your state, bind:open={get, set} keeps you authoritative.'
		},
		{
			prop: 'defaultOpen',
			type: 'boolean',
			default: 'false',
			description: 'Initial open state when uncontrolled. Ignored once open is bound.'
		},
		{
			prop: 'onOpenChange',
			type: '(open: boolean) => void',
			default: '—',
			description:
				'Called on a real open ↔ closed transition only — never when the breakpoint is crossed.'
		},
		{
			prop: 'onOpenChangeComplete',
			type: '(open: boolean) => void',
			default: '—',
			description:
				'Forwarded to the dialog root once its transition settles. The drawer has no counterpart, so it never fires in drawer mode.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: 'Rendered inside whichever root is active.'
		}
	];

	const contentProps: PropRow[] = [
		{
			prop: 'ref',
			type: 'HTMLElement | null',
			default: 'null',
			description: 'Bindable reference to the active content element.'
		},
		{
			prop: 'class',
			type: 'string',
			default: '—',
			description: 'Merged last, after the drawer-mode px-4 pb-4.'
		},
		{
			prop: 'portalProps',
			type: 'WithoutChildrenOrChild<PortalProps>',
			default: '—',
			description: "Forwarded to the active content's own portal."
		},
		{
			prop: 'showCloseButton',
			type: 'boolean',
			default: 'true',
			description: 'Dialog mode only — Drawer.Content has no close button.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: 'The dialog body. Required.'
		}
	];

	const footerProps: PropRow[] = [
		{
			prop: 'showCloseButton',
			type: 'boolean',
			default: 'false',
			description: "Renders the footer's built-in close button. Dialog mode only."
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: 'The footer content, usually action buttons.'
		}
	];

	const keyboard = [
		{ keys: 'Space', description: 'Opens the dialog/drawer when focus is on the trigger.' },
		{ keys: 'Enter', description: 'Opens the dialog/drawer when focus is on the trigger.' },
		{ keys: 'Tab', description: 'Moves focus to the next focusable element.' },
		{ keys: 'Shift + Tab', description: 'Moves focus to the previous focusable element.' },
		{ keys: 'Escape', description: 'Closes the dialog/drawer and moves focus to the trigger.' }
	];
</script>

<svelte:head>
	<title>Responsive Dialog — svelte-dice-ui</title>
</svelte:head>

{#snippet propsTable(rows: PropRow[])}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Prop</Table.Head>
				<Table.Head>Type</Table.Head>
				<Table.Head>Default</Table.Head>
				<Table.Head>Description</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each rows as row (row.prop)}
				<Table.Row>
					<Table.Cell class="font-medium">{row.prop}</Table.Cell>
					<Table.Cell class="text-muted-foreground">{row.type}</Table.Cell>
					<Table.Cell class="text-muted-foreground">{row.default}</Table.Cell>
					<Table.Cell>{row.description}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/snippet}

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Responsive Dialog</h1>
		<p class="text-muted-foreground">
			A dialog that renders as a centered modal on desktop and a bottom drawer on mobile. Resize the
			window across 768px with one open — it swaps without closing.
		</p>
	</div>

	<ComponentPreview
		title="Default"
		description="Mirrors responsive-dialog-demo.tsx. One composition, two presentations."
	>
		<ResponsiveDialog.Root>
			<ResponsiveDialog.Trigger>
				{#snippet child({ props })}
					<Button variant="outline" {...props}>Edit Profile</Button>
				{/snippet}
			</ResponsiveDialog.Trigger>
			<ResponsiveDialog.Content>
				<ResponsiveDialog.Header>
					<ResponsiveDialog.Title>Edit profile</ResponsiveDialog.Title>
					<ResponsiveDialog.Description>
						Make changes to your profile here. Click save when you’re done.
					</ResponsiveDialog.Description>
				</ResponsiveDialog.Header>
				<Field.FieldGroup>
					<Field.Field>
						<Field.FieldLabel for="responsive-dialog-name">Name</Field.FieldLabel>
						<Input id="responsive-dialog-name" value="Pedro Duarte" />
					</Field.Field>
					<Field.Field>
						<Field.FieldLabel for="responsive-dialog-username">Username</Field.FieldLabel>
						<Input id="responsive-dialog-username" value="@peduarte" />
					</Field.Field>
				</Field.FieldGroup>
				<ResponsiveDialog.Footer>
					<Button type="submit">Save changes</Button>
				</ResponsiveDialog.Footer>
			</ResponsiveDialog.Content>
		</ResponsiveDialog.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Confirmation Dialog"
		description="Mirrors responsive-dialog-confirm-demo.tsx. Use the responsive dialog to confirm destructive actions like deleting items."
	>
		<ResponsiveDialog.Root>
			<ResponsiveDialog.Trigger>
				{#snippet child({ props })}
					<Button variant="destructive" {...props}>
						<TrashIcon data-icon="inline-start" />
						Delete Project
					</Button>
				{/snippet}
			</ResponsiveDialog.Trigger>
			<ResponsiveDialog.Content>
				<ResponsiveDialog.Header>
					<ResponsiveDialog.Title>Delete project?</ResponsiveDialog.Title>
					<ResponsiveDialog.Description>
						This will permanently delete “My Awesome Project” and all of its data. This action
						cannot be undone.
					</ResponsiveDialog.Description>
				</ResponsiveDialog.Header>
				<ResponsiveDialog.Footer>
					<ResponsiveDialog.Close>
						{#snippet child({ props })}
							<Button variant="outline" {...props}>Cancel</Button>
						{/snippet}
					</ResponsiveDialog.Close>
					<Button variant="destructive" onclick={onDelete} disabled={isDeleting}>
						{#if isDeleting}
							<Spinner data-icon="inline-start" />
						{/if}
						Delete
					</Button>
				</ResponsiveDialog.Footer>
			</ResponsiveDialog.Content>
		</ResponsiveDialog.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Variant Styling"
		description="Every part exposes a data-variant attribute, so one class list can style the dialog and the drawer differently."
	>
		<ResponsiveDialog.Root>
			<ResponsiveDialog.Trigger>
				{#snippet child({ props })}
					<Button variant="outline" {...props}>Open styled</Button>
				{/snippet}
			</ResponsiveDialog.Trigger>
			<ResponsiveDialog.Content class="data-[variant=dialog]:max-w-md data-[variant=drawer]:pb-8">
				<ResponsiveDialog.Header>
					<ResponsiveDialog.Title>Variant styling</ResponsiveDialog.Title>
					<ResponsiveDialog.Description>
						This content is capped at max-w-md as a dialog and gets extra bottom padding as a
						drawer.
					</ResponsiveDialog.Description>
				</ResponsiveDialog.Header>
				<ResponsiveDialog.Footer
					class="data-[variant=dialog]:flex-row data-[variant=drawer]:flex-col"
				>
					<ResponsiveDialog.Close>
						{#snippet child({ props })}
							<Button variant="outline" {...props}>Cancel</Button>
						{/snippet}
					</ResponsiveDialog.Close>
					<Button>Continue</Button>
				</ResponsiveDialog.Footer>
			</ResponsiveDialog.Content>
		</ResponsiveDialog.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Controlled"
		description="bind:open keeps the open state in the page. Crossing the breakpoint while open swaps the primitive without firing onOpenChange."
	>
		<div class="flex flex-col items-center gap-4">
			<div class="flex items-center gap-2">
				<Button variant="outline" onclick={() => (controlledOpen = true)}>Open from outside</Button>
				<span class="text-sm text-muted-foreground">
					open: {controlledOpen} · transitions: {transitions}
				</span>
			</div>
			<ResponsiveDialog.Root bind:open={controlledOpen} onOpenChange={() => (transitions += 1)}>
				<ResponsiveDialog.Trigger>
					{#snippet child({ props })}
						<Button {...props}>Open from trigger</Button>
					{/snippet}
				</ResponsiveDialog.Trigger>
				<ResponsiveDialog.Content>
					<ResponsiveDialog.Header>
						<ResponsiveDialog.Title>Controlled</ResponsiveDialog.Title>
						<ResponsiveDialog.Description>
							Resize the window across 768px while this is open — the counter does not move.
						</ResponsiveDialog.Description>
					</ResponsiveDialog.Header>
					<ResponsiveDialog.Footer>
						<ResponsiveDialog.Close>
							{#snippet child({ props })}
								<Button variant="outline" {...props}>Close</Button>
							{/snippet}
						</ResponsiveDialog.Close>
					</ResponsiveDialog.Footer>
				</ResponsiveDialog.Content>
			</ResponsiveDialog.Root>
		</div>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">ResponsiveDialog.Root</h3>
			<p class="text-sm text-muted-foreground">
				Owns the open state and the mode switch. Any prop it does not handle is spread onto
				whichever root is active, so drawer-only knobs such as <code>direction</code> apply in drawer
				mode only.
			</p>
			{@render propsTable(rootProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">ResponsiveDialog.Content</h3>
			<p class="text-sm text-muted-foreground">
				The dialog body, portalled with its own overlay. Adds <code>px-4 pb-4</code> in drawer mode only,
				and re-establishes focus inside itself when the breakpoint is crossed while open.
			</p>
			{@render propsTable(contentProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">ResponsiveDialog.Footer</h3>
			<p class="text-sm text-muted-foreground">The footer section, usually holding the actions.</p>
			{@render propsTable(footerProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">
				Trigger, Close, Portal, Overlay, Header, Title, Description
			</h3>
			<p class="text-sm text-muted-foreground">
				Pass-throughs to their <code>Dialog</code> / <code>Drawer</code> counterparts. Each carries
				<code>data-slot="responsive-dialog-&lt;part&gt;"</code> and
				<code>data-variant="dialog" | "drawer"</code>, merges the caller’s <code>class</code> last,
				and accepts the <code>child</code> snippet where the underlying part does.
				<code>Portal</code> renders no element of its own, so it carries neither attribute.
			</p>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">useIsMobile</h3>
			<p class="text-sm text-muted-foreground">
				The mode detection is a standalone rune at
				<code>$lib/hooks/is-mobile.svelte.js</code>: <code>useIsMobile(getBreakpoint?)</code>
				returns an <code>IsMobile</code> whose <code>current</code> reads
				<code>(max-width: breakpoint - 1px)</code>. It is SSR-safe (seeded <code>false</code>) and
				reusable without importing a dialog.
			</p>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Keyboard Interactions</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Key</Table.Head>
						<Table.Head>Description</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each keyboard as row (row.keys)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.keys}</Table.Cell>
							<Table.Cell>{row.description}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</section>
</article>
