<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { toast } from 'svelte-sonner';

	import { ComponentPreview } from '$lib/components/docs/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Editable from '$lib/components/ui/editable/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { cn } from '$lib/utils.js';

	// --- Todo List -----------------------------------------------------------
	type Todo = { id: string; text: string; completed: boolean };

	let todos = $state<Todo[]>([
		{ id: '1', text: 'Ollie', completed: false },
		{ id: '2', text: 'Kickflip', completed: false },
		{ id: '3', text: '360 flip', completed: false },
		{ id: '4', text: '540 flip', completed: false }
	]);

	function deleteTodo(id: string) {
		todos = todos.filter((todo) => todo.id !== id);
	}

	function updateTodo(id: string, text: string) {
		todos = todos.map((todo) => (todo.id === id ? { ...todo, text } : todo));
	}

	// --- With Form -----------------------------------------------------------
	// Upstream composes this example with `react-hook-form` + `zod`; neither has a counterpart in
	// this registry, so the same two rules live in plain runes here (spec Assumptions).
	let name = $state('Rodney Mullen');
	let title = $state('Skateboarder');
	let touched = $state({ name: false, title: false });

	const nameError = $derived(
		name.length < 2
			? 'Name must be at least 2 characters'
			: name.length > 50
				? 'Name must be less than 50 characters'
				: null
	);
	const titleError = $derived(
		title.length < 3
			? 'Title must be at least 3 characters'
			: title.length > 100
				? 'Title must be less than 100 characters'
				: null
	);

	function onFormSubmit(event: SubmitEvent) {
		event.preventDefault();
		touched = { name: true, title: true };
		if (nameError || titleError) return;

		toast.success(JSON.stringify({ name, title }, null, 2));
	}

	function resetForm() {
		name = 'Rodney Mullen';
		title = 'Skateboarder';
		touched = { name: false, title: false };
	}

	// --- API reference -------------------------------------------------------
	type PropRow = { prop: string; type: string; default: string; description: string };

	const rootProps: PropRow[] = [
		{
			prop: 'value',
			type: 'string',
			default: 'undefined',
			description:
				'Controlled text value. Bindable — bind:value lets the field move your state, bind:value={get, set} keeps you authoritative.'
		},
		{
			prop: 'defaultValue',
			type: 'string',
			default: "''",
			description: 'Initial value when uncontrolled, and the value the first cancel reverts to.'
		},
		{
			prop: 'onValueChange',
			type: '(value: string) => void',
			default: '—',
			description: 'Called whenever the value changes; never for a write that did not move it.'
		},
		{
			prop: 'editing',
			type: 'boolean',
			default: 'undefined',
			description: 'Controlled edit-mode state. Bindable, with the same three usages as value.'
		},
		{
			prop: 'defaultEditing',
			type: 'boolean',
			default: 'false',
			description: 'Whether the field starts in edit mode when uncontrolled.'
		},
		{
			prop: 'onEditingChange',
			type: '(editing: boolean) => void',
			default: '—',
			description: 'Called whenever edit mode changes; never for a write that did not move it.'
		},
		{
			prop: 'onEdit',
			type: '() => void',
			default: '—',
			description: 'Called after edit mode is entered and the restore-on-cancel value is captured.'
		},
		{
			prop: 'onSubmit',
			type: '(value: string) => void',
			default: '—',
			description:
				'Called on Enter, the submit button, or a committing blur — even when the value is unchanged.'
		},
		{
			prop: 'onCancel',
			type: '() => void',
			default: '—',
			description: 'Called after the value is reverted and edit mode left.'
		},
		{
			prop: 'onEnterKeyDown',
			type: '(event: KeyboardEvent) => void',
			default: '—',
			description: "Runs before the preview's Enter → edit; preventDefault() suppresses it."
		},
		{
			prop: 'onEscapeKeyDown',
			type: '(event: KeyboardEvent) => void',
			default: '—',
			description: "Runs before the input's Escape → cancel; preventDefault() suppresses it."
		},
		{
			prop: 'triggerMode',
			type: "'click' | 'dblclick' | 'focus'",
			default: "'click'",
			description: 'Which preview interaction enters edit mode.'
		},
		{
			prop: 'autosize',
			type: 'boolean',
			default: 'false',
			description: 'Input grows to fit its content, and switches from w-full to w-auto.'
		},
		{
			prop: 'maxLength',
			type: 'number',
			default: '—',
			description: "Native character cap on the input; the input's own maxLength wins over it."
		},
		{
			prop: 'placeholder',
			type: 'string',
			default: '—',
			description:
				"Shown by the preview while empty (with data-empty), and as the input's placeholder."
		},
		{
			prop: 'name',
			type: 'string',
			default: '—',
			description: 'Field name on the hidden form-associated input.'
		},
		{
			prop: 'disabled',
			type: 'boolean',
			default: 'false',
			description: 'Suppresses every interaction on every part.'
		},
		{
			prop: 'readOnly',
			type: 'boolean',
			default: 'false',
			description: 'Input permanently rendered and inert; the preview and trigger never render.'
		},
		{
			prop: 'required',
			type: 'boolean',
			default: 'false',
			description: 'data-required on the label, required/aria-required on the input.'
		},
		{
			prop: 'invalid',
			type: 'boolean',
			default: 'false',
			description: 'data-invalid on the label, aria-invalid on the input.'
		},
		{
			prop: 'dir',
			type: "'ltr' | 'rtl'",
			default: 'nearest DirectionProvider, else DOM [dir], else ltr',
			description: 'Rendered on the area, the input and the toolbar.'
		},
		{
			prop: 'id',
			type: 'string',
			default: '$props.id()',
			description: 'Always rendered on the root; every aria-controls resolves to it.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render the root onto your own element instead of the default div.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: 'The composed parts.'
		}
	];

	const labelProps: PropRow[] = [
		{
			prop: 'child',
			type: 'Snippet<[{ props: EditableLabelChildProps }]>',
			default: '—',
			description: 'Render the label onto your own element instead of the default label.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: "The label's content."
		}
	];

	const areaProps: PropRow[] = [
		{
			prop: 'child',
			type: 'Snippet<[{ props: EditableAreaChildProps }]>',
			default: '—',
			description: 'Render the area onto your own element instead of the default div.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: 'The preview and the input.'
		}
	];

	const previewProps: PropRow[] = [
		{
			prop: 'child',
			type: 'Snippet<[{ props: EditablePreviewChildProps }]>',
			default: '—',
			description: 'Render the preview onto your own element instead of the default div.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: 'the value, else the placeholder',
			description: 'Replaces the default content.'
		}
	];

	const inputProps: PropRow[] = [
		{
			prop: 'maxLength',
			type: 'number',
			default: "the root's maxLength",
			description: 'Native character cap; the part’s own prop wins.'
		},
		{
			prop: 'disabled',
			type: 'boolean',
			default: "the root's disabled",
			description: "Native disabled state; OR-ed with the root's, as upstream does."
		},
		{
			prop: 'readOnly',
			type: 'boolean',
			default: "the root's readOnly",
			description: "Native readonly state; OR-ed with the root's."
		},
		{
			prop: 'required',
			type: 'boolean',
			default: "the root's required",
			description: "Native required state; OR-ed with the root's."
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props: EditableInputChildProps }]>',
			default: '—',
			description:
				'Render the input onto your own element — a textarea, say. The caller then owns focus and selection.'
		}
	];

	const triggerProps: PropRow[] = [
		{
			prop: 'forceMount',
			type: 'boolean',
			default: 'false',
			description: 'Keeps the trigger mounted while editing or read-only.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props: EditableTriggerChildProps }]>',
			default: '—',
			description: 'Render the trigger onto your own element instead of the default button.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: "The button's content."
		}
	];

	const toolbarProps: PropRow[] = [
		{
			prop: 'orientation',
			type: "'horizontal' | 'vertical'",
			default: "'horizontal'",
			description: 'Layout and reported aria-orientation.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props: EditableToolbarChildProps }]>',
			default: '—',
			description: 'Render the toolbar onto your own element instead of the default div.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: 'The submit and cancel buttons.'
		}
	];

	const cancelProps: PropRow[] = [
		{
			prop: 'child',
			type: 'Snippet<[{ props: EditableCancelChildProps }]>',
			default: '—',
			description: 'Render the cancel button onto your own element instead of the default button.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: "The button's content."
		}
	];

	const submitProps: PropRow[] = [
		{
			prop: 'child',
			type: 'Snippet<[{ props: EditableSubmitChildProps }]>',
			default: '—',
			description: 'Render the submit button onto your own element instead of the default button.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: "The button's content."
		}
	];

	const keyboard = [
		{
			keys: 'Enter',
			description:
				'On the preview: enters edit mode, whatever triggerMode is. In the input: submits the current text.'
		},
		{
			keys: 'Escape',
			description:
				'In the input: cancels, reverts to the value edit mode started with, and returns focus to whatever started the edit.'
		},
		{
			keys: 'Tab',
			description:
				'Moves focus natively. Leaving the input commits, unless focus lands on the trigger or the cancel button.'
		}
	];
</script>

<svelte:head>
	<title>Editable — svelte-dice-ui</title>
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

{#snippet editTrigger({ props }: { props: Editable.EditableTriggerChildProps })}
	<Button size="sm" {...props} class={cn('w-fit', props.class)}>Edit</Button>
{/snippet}

{#snippet iconTrigger({ props }: { props: Editable.EditableTriggerChildProps })}
	<Button
		variant="ghost"
		size="icon"
		aria-label="Edit trick"
		{...props}
		class={cn('size-7', props.class)}
	>
		<PencilIcon />
	</Button>
{/snippet}

{#snippet saveButton({ props }: { props: Editable.EditableSubmitChildProps })}
	<Button size="sm" {...props}>Save</Button>
{/snippet}

{#snippet cancelButton({ props }: { props: Editable.EditableCancelChildProps })}
	<Button variant="outline" size="sm" {...props}>Cancel</Button>
{/snippet}

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">Editable</h1>
		<p class="text-muted-foreground">
			An accessible inline editable component for editing text content in place.
		</p>
	</div>

	<ComponentPreview
		title="Default"
		description="Mirrors editable-demo.tsx. Click the text — or the Edit button — to edit it; Enter or Save commits, Escape or Cancel reverts and hands focus back."
	>
		<Editable.Root
			defaultValue="Click to edit"
			placeholder="Enter your text here"
			class="w-[380px]"
		>
			<Editable.Label>Fruit</Editable.Label>
			<Editable.Area>
				<Editable.Preview />
				<Editable.Input />
			</Editable.Area>
			<Editable.Trigger child={editTrigger} />
			<Editable.Toolbar>
				<Editable.Submit child={saveButton} />
				<Editable.Cancel child={cancelButton} />
			</Editable.Toolbar>
		</Editable.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Double Click"
		description="Mirrors editable-double-click-demo.tsx. triggerMode=&quot;dblclick&quot; enters edit mode on a double click; Enter on the focused preview still works, because a keyboard user has no other way in."
	>
		<Editable.Root
			defaultValue="Double click to edit"
			placeholder="Enter your text here"
			triggerMode="dblclick"
			class="w-[380px]"
		>
			<Editable.Label>Fruit</Editable.Label>
			<Editable.Area>
				<Editable.Preview />
				<Editable.Input />
			</Editable.Area>
			<Editable.Toolbar>
				<Editable.Submit child={saveButton} />
				<Editable.Cancel child={cancelButton} />
			</Editable.Toolbar>
		</Editable.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Autosize"
		description="Mirrors editable-autosize-demo.tsx. autosize measures the text and writes a pixel width on the input, so the field grows as you type."
	>
		<Editable.Root
			defaultValue="Adjust the size of the input with the text inside."
			autosize
			class="w-full"
		>
			<Editable.Label>Autosize editable</Editable.Label>
			<Editable.Area>
				<Editable.Preview class="whitespace-pre-wrap" />
				<Editable.Input />
			</Editable.Area>
			<Editable.Toolbar>
				<Editable.Submit child={saveButton} />
				<Editable.Cancel child={cancelButton} />
			</Editable.Toolbar>
		</Editable.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Todo List"
		description="Mirrors editable-todo-list-demo.tsx. One root per row, each writing its onSubmit value back into the page's state, with an icon trigger rendered through the child snippet."
	>
		<div class="flex w-full min-w-0 flex-col gap-2">
			<span class="text-lg font-semibold">Tricks to learn</span>
			{#each todos as todo (todo.id)}
				<div class="flex items-center gap-2 rounded-lg border bg-card px-4 py-2">
					<Checkbox bind:checked={todo.completed} aria-label={`Mark ${todo.text} as done`} />
					<Editable.Root
						defaultValue={todo.text}
						onSubmit={(value) => updateTodo(todo.id, value)}
						class="flex flex-1 flex-row items-center gap-1.5"
					>
						<Editable.Area class="flex-1">
							<Editable.Preview
								class={cn(
									'w-full rounded-md px-1.5 py-1',
									todo.completed && 'text-muted-foreground line-through'
								)}
							/>
							<Editable.Input class="px-1.5 py-1" />
						</Editable.Area>
						<Editable.Trigger child={iconTrigger} />
					</Editable.Root>
					<Button
						variant="ghost"
						size="icon"
						class="size-7 text-destructive"
						aria-label={`Delete ${todo.text}`}
						onclick={() => deleteTodo(todo.id)}
					>
						<Trash2Icon />
					</Button>
				</div>
			{/each}
		</div>
	</ComponentPreview>

	<ComponentPreview
		title="With Form"
		description="Mirrors editable-form-demo.tsx. Two fields inside a form; each flips invalid once it has been touched, and the hidden form-associated input is what the form actually submits."
	>
		<form
			onsubmit={onFormSubmit}
			class="flex w-full flex-col gap-4 rounded-md border p-4 shadow-sm"
		>
			<Editable.Root
				name="name"
				bind:value={name}
				invalid={!!nameError && touched.name}
				onSubmit={() => (touched = { ...touched, name: true })}
			>
				<Editable.Label>Name</Editable.Label>
				<div class="flex items-start gap-4">
					<Editable.Area class="flex-1">
						<Editable.Preview />
						<Editable.Input />
					</Editable.Area>
					<Editable.Trigger child={editTrigger} />
				</div>
				<Editable.Toolbar>
					<Editable.Submit child={saveButton} />
					<Editable.Cancel child={cancelButton} />
				</Editable.Toolbar>
				{#if nameError && touched.name}
					<p class="text-sm text-destructive">{nameError}</p>
				{/if}
			</Editable.Root>

			<Editable.Root
				name="title"
				bind:value={title}
				invalid={!!titleError && touched.title}
				onSubmit={() => (touched = { ...touched, title: true })}
			>
				<Editable.Label>Title</Editable.Label>
				<div class="flex items-start gap-4">
					<Editable.Area class="flex-1">
						<Editable.Preview />
						<Editable.Input />
					</Editable.Area>
					<Editable.Trigger child={editTrigger} />
				</div>
				<Editable.Toolbar>
					<Editable.Submit child={saveButton} />
					<Editable.Cancel child={cancelButton} />
				</Editable.Toolbar>
				{#if titleError && touched.title}
					<p class="text-sm text-destructive">{titleError}</p>
				{/if}
			</Editable.Root>

			<div class="flex w-fit gap-2 self-end">
				<Button type="button" variant="outline" class="w-fit" onclick={resetForm}>Reset</Button>
				<Button type="submit" class="w-fit">Update</Button>
			</div>
		</form>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Editable.Root</h3>
			<p class="text-sm text-muted-foreground">
				The container. Every part additionally accepts <code>ref</code>, <code>class</code> and the
				rest of its element’s HTML attributes, and composes any native handler you pass it —
				<code>preventDefault()</code> suppresses the built-in behaviour.
			</p>
			{@render propsTable(rootProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Editable.Label</h3>
			<p class="text-sm text-muted-foreground">
				Labels the input through <code>for</code>, and mirrors the root’s
				<code>data-disabled</code>, <code>data-invalid</code> and <code>data-required</code>.
			</p>
			{@render propsTable(labelProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Editable.Area</h3>
			<p class="text-sm text-muted-foreground">
				The <code>role="group"</code> wrapper the preview and the input swap inside.
			</p>
			{@render propsTable(areaProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Editable.Preview</h3>
			<p class="text-sm text-muted-foreground">
				The read state. Rendered only while not editing and not read-only.
			</p>
			{@render propsTable(previewProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Editable.Input</h3>
			<p class="text-sm text-muted-foreground">
				The edit state. Rendered while editing, or permanently while read-only; it takes focus and
				selects its whole text as edit mode starts.
			</p>
			{@render propsTable(inputProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Editable.Trigger</h3>
			<p class="text-sm text-muted-foreground">
				An external way into edit mode, and the element focus returns to after a cancel.
			</p>
			{@render propsTable(triggerProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Editable.Toolbar</h3>
			<p class="text-sm text-muted-foreground">
				The <code>role="toolbar"</code> container for the action buttons. Always rendered.
			</p>
			{@render propsTable(toolbarProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Editable.Cancel</h3>
			<p class="text-sm text-muted-foreground">
				Reverts and leaves edit mode. Rendered while editing or read-only; focus moving onto it
				never commits.
			</p>
			{@render propsTable(cancelProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Editable.Submit</h3>
			<p class="text-sm text-muted-foreground">
				Commits the input’s current text. Rendered while editing or read-only.
			</p>
			{@render propsTable(submitProps)}
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
