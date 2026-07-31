<script lang="ts">
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import CloudUploadIcon from '@lucide/svelte/icons/cloud-upload';
	import PaperclipIcon from '@lucide/svelte/icons/paperclip';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import XIcon from '@lucide/svelte/icons/x';
	import { toast } from 'svelte-sonner';

	import { ComponentPreview } from '$lib/components/docs/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as FileUpload from '$lib/components/ui/file-upload/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';

	const MB = 1024 * 1024;

	/** Upstream's shared reject handler: one toast per rejected file, naming the file. */
	function onFileReject(file: File, message: string) {
		const name = file.name.length > 20 ? `${file.name.slice(0, 20)}…` : file.name;
		toast(message, { description: `"${name}" has been rejected` });
	}

	/**
	 * The transport every progress demo uses. It is entirely consumer-supplied — the component never
	 * touches the network — so upstream's timer-simulated chunking is reproduced verbatim: ten chunks,
	 * a random 100–300 ms delay each, then a server-processing pause before success.
	 */
	async function simulateUpload(
		files: File[],
		{ onProgress, onSuccess, onError }: FileUpload.FileUploadUploadOptions
	) {
		await Promise.all(
			files.map(async (file) => {
				try {
					const totalChunks = 10;
					for (let chunk = 1; chunk <= totalChunks; chunk++) {
						await new Promise((resolve) => setTimeout(resolve, Math.random() * 200 + 100));
						onProgress(file, (chunk / totalChunks) * 100);
					}
					await new Promise((resolve) => setTimeout(resolve, 500));
					onSuccess(file);
				} catch (error) {
					onError(file, error instanceof Error ? error : new Error('Upload failed'));
				}
			})
		);
	}

	// --- Default -------------------------------------------------------------
	let files = $state<File[]>([]);

	// --- With Validation -----------------------------------------------------
	let validatedFiles = $state<File[]>([]);

	function onFileValidate(file: File): string | null {
		if (validatedFiles.length >= 2) return 'You can only upload up to 2 files';
		if (!file.type.startsWith('image/')) return 'Only image files are allowed';
		if (file.size > 2 * MB) return 'File size must be less than 2MB';
		return null;
	}

	// --- Direct Upload -------------------------------------------------------
	let uploadedFiles = $state<File[]>([]);

	// --- Circular Progress ---------------------------------------------------
	let circularFiles = $state<File[]>([]);

	// --- Fill Progress -------------------------------------------------------
	let fillFiles = $state<File[]>([]);

	// --- With Chat Input -----------------------------------------------------
	let chatFiles = $state<File[]>([]);
	let message = $state('');
	let isUploading = $state(false);

	async function onChatUpload(files: File[], options: FileUpload.FileUploadUploadOptions) {
		isUploading = true;
		try {
			await simulateUpload(files, options);
		} finally {
			isUploading = false;
		}
	}

	function onChatSubmit(event: SubmitEvent) {
		event.preventDefault();
		message = '';
		chatFiles = [];
	}

	// --- With Form -----------------------------------------------------------
	// Upstream builds this on react-hook-form + zod. Neither has an installed counterpart here and no
	// dependency may be added, so the same three rules are checked by hand against runes state
	// (research R-13); the user-visible flow — required file field, message, submit — is unchanged.
	let formFiles = $state<File[]>([]);
	let formError = $state<string | null>(null);

	function validateForm(): string | null {
		if (formFiles.length === 0) return 'Please select at least one file';
		if (formFiles.length > 2) return 'Please select up to 2 files';
		if (formFiles.some((file) => file.size > 5 * MB)) return 'File size must be less than 5MB';
		return null;
	}

	function onFormSubmit(event: SubmitEvent) {
		event.preventDefault();
		formError = validateForm();
		if (formError) return;

		toast('Submitted values:', {
			description: formFiles
				.map((file) => (file.name.length > 25 ? `${file.name.slice(0, 25)}…` : file.name))
				.join(', ')
		});
	}

	// --- API reference -------------------------------------------------------
	type PropRow = { prop: string; type: string; default: string; description: string };

	const rootProps: PropRow[] = [
		{
			prop: 'value',
			type: 'File[]',
			default: 'undefined',
			description:
				'Controlled file list. Bindable — bind:value lets the file upload move your state, bind:value={get, set} keeps you authoritative.'
		},
		{
			prop: 'defaultValue',
			type: 'File[]',
			default: '[]',
			description: 'Initial file list when uncontrolled.'
		},
		{
			prop: 'onValueChange',
			type: '(files: File[]) => void',
			default: '—',
			description: 'Called on every addition and removal, in both modes.'
		},
		{
			prop: 'onAccept',
			type: '(files: File[]) => void',
			default: '—',
			description: 'Called once per processed batch with every accepted file.'
		},
		{
			prop: 'onFileAccept',
			type: '(file: File) => void',
			default: '—',
			description: 'Called for each accepted file.'
		},
		{
			prop: 'onFileReject',
			type: '(file: File, message: string) => void',
			default: '—',
			description: 'Called for each rejected file with the reason.'
		},
		{
			prop: 'onFileValidate',
			type: '(file: File) => string | null | undefined',
			default: '—',
			description: 'Custom per-file validation; a returned string rejects the file with it.'
		},
		{
			prop: 'onUpload',
			type: '(files, { onProgress, onSuccess, onError }) => Promise<void> | void',
			default: '—',
			description:
				'The upload transport, supplied entirely by you. Omit it and accepted files are marked successful immediately.'
		},
		{
			prop: 'accept',
			type: 'string',
			default: '—',
			description: 'Comma-separated MIME types, extensions or type/* wildcards.'
		},
		{ prop: 'maxFiles', type: 'number', default: '—', description: 'Maximum number of files.' },
		{ prop: 'maxSize', type: 'number', default: '—', description: 'Maximum size per file, bytes.' },
		{
			prop: 'dir',
			type: "'ltr' | 'rtl'",
			default: 'inherited',
			description: 'Reading direction; falls back to the nearest DirectionProvider, then the DOM.'
		},
		{
			prop: 'label',
			type: 'string',
			default: "'File upload'",
			description: 'Accessible name of the hidden file input.'
		},
		{ prop: 'name', type: 'string', default: '—', description: 'Form field name.' },
		{
			prop: 'disabled',
			type: 'boolean',
			default: 'false',
			description: 'Suppresses dialog, drag and drop, paste, keyboard, delete and clear.'
		},
		{
			prop: 'invalid',
			type: 'boolean',
			default: 'false',
			description: 'Forces the dropzone invalid state on.'
		},
		{
			prop: 'multiple',
			type: 'boolean',
			default: 'false',
			description: 'Whether the native dialog allows more than one file.'
		},
		{
			prop: 'required',
			type: 'boolean',
			default: 'false',
			description: 'Marks the hidden input required for native form validation.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element instead of the default one.'
		}
	];

	const dropzoneProps: PropRow[] = [
		{
			prop: 'onclick / ondragenter / ondragover / ondragleave / ondrop / onpaste / onkeydown',
			type: 'event handler',
			default: '—',
			description:
				'Run before the internal behaviour; calling preventDefault() suppresses the internal one.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element.'
		}
	];

	const triggerProps: PropRow[] = [
		{
			prop: 'onclick',
			type: 'event handler',
			default: '—',
			description: 'Runs before opening the dialog; preventDefault() suppresses it.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element — this is how the demos use a Button.'
		}
	];

	const listProps: PropRow[] = [
		{
			prop: 'orientation',
			type: "'horizontal' | 'vertical'",
			default: "'vertical'",
			description: 'Layout direction of the list.'
		},
		{
			prop: 'forceMount',
			type: 'boolean',
			default: 'false',
			description: 'Keep the list mounted with no files, for exit animations.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element.'
		}
	];

	const itemProps: PropRow[] = [
		{
			prop: 'value',
			type: 'File',
			default: '— (required)',
			description: 'The file this row represents; identity is the File reference itself.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element.'
		}
	];

	const itemPreviewProps: PropRow[] = [
		{
			prop: 'render',
			type: 'Snippet<[{ file, fallback }]>',
			default: '—',
			description:
				'Replace or decorate the default preview; render {@render fallback()} to keep it. Upstream’s (file, fallback) callback, as a snippet.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: 'Rendered after the preview — where circular and fill progress go.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element.'
		}
	];

	const itemMetadataProps: PropRow[] = [
		{
			prop: 'size',
			type: "'default' | 'sm'",
			default: "'default'",
			description: 'Typography scale of the default name/size/error trio.'
		},
		{
			prop: 'children',
			type: 'Snippet',
			default: '—',
			description: 'Replaces the default trio entirely.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element.'
		}
	];

	const itemProgressProps: PropRow[] = [
		{
			prop: 'variant',
			type: "'linear' | 'circular' | 'fill'",
			default: "'linear'",
			description: 'Which presentation the same progress value is drawn in.'
		},
		{
			prop: 'size',
			type: 'number',
			default: '40',
			description: 'Diameter of the circular variant, in pixels.'
		},
		{
			prop: 'forceMount',
			type: 'boolean',
			default: 'false',
			description: 'Keep the bar mounted once the file reaches 100%.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element.'
		}
	];

	const itemDeleteProps: PropRow[] = [
		{
			prop: 'onclick',
			type: 'event handler',
			default: '—',
			description: 'Runs before the removal; preventDefault() suppresses it.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element.'
		}
	];

	const clearProps: PropRow[] = [
		{
			prop: 'forceMount',
			type: 'boolean',
			default: 'false',
			description: 'Keep the button mounted with no files.'
		},
		{
			prop: 'disabled',
			type: 'boolean',
			default: 'false',
			description: 'Disables the button on its own; OR-ed with the root’s disabled.'
		},
		{
			prop: 'child',
			type: 'Snippet<[{ props }]>',
			default: '—',
			description: 'Render onto your own element.'
		}
	];

	const dataAttributes = [
		{ attribute: '[data-disabled]', on: 'Root, Dropzone, Trigger, Clear', when: 'Disabled.' },
		{ attribute: '[data-dragging]', on: 'Dropzone', when: 'Files are dragged over it.' },
		{
			attribute: '[data-invalid]',
			on: 'Dropzone',
			when: 'A rejection happened in the last 2000 ms, or invalid is set.'
		},
		{ attribute: '[data-orientation]', on: 'List', when: '"vertical" | "horizontal".' },
		{ attribute: '[data-state]', on: 'List', when: '"active" with files, "inactive" otherwise.' },
		{
			attribute: '[data-status]',
			on: 'Item',
			when: '"idle" | "uploading" | "success" | "error" — an addition over upstream, which surfaces status only as screen-reader text.'
		}
	];

	const keyboard = [
		{ keys: 'Tab', description: 'Moves between dropzone, trigger, each delete button and clear.' },
		{ keys: 'Shift + Tab', description: 'From the dropzone, moves focus away from it.' },
		{
			keys: 'Enter / Space',
			description: 'On the focused dropzone or trigger, opens the native file dialog.'
		},
		{ keys: 'Enter / Space', description: 'On a delete or clear button, activates it natively.' }
	];
</script>

<svelte:head>
	<title>File Upload — svelte-dice-ui</title>
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

<!--
	Layout classes belong on the part, not on the element the `child` snippet renders: the merged
	props already carry a `class`, and repeating the attribute here would overwrite it.
-->
{#snippet browseButton({ props }: { props: FileUpload.FileUploadTriggerChildProps })}
	<Button variant="outline" size="sm" {...props}>Browse files</Button>
{/snippet}

{#snippet chooseFilesLink({ props }: { props: FileUpload.FileUploadTriggerChildProps })}
	<Button variant="link" size="sm" {...props}>choose files</Button>
{/snippet}

{#snippet attachButton({ props }: { props: FileUpload.FileUploadTriggerChildProps })}
	<Button variant="ghost" size="icon" {...props}>
		<PaperclipIcon />
		<span class="sr-only">Attach file</span>
	</Button>
{/snippet}

{#snippet removeButton({ props }: { props: FileUpload.FileUploadItemDeleteChildProps })}
	<Button variant="ghost" size="icon" {...props}>
		<XIcon />
		<span class="sr-only">Remove file</span>
	</Button>
{/snippet}

{#snippet cornerRemoveButton({ props }: { props: FileUpload.FileUploadItemDeleteChildProps })}
	<Button variant="secondary" size="icon" {...props}>
		<XIcon />
		<span class="sr-only">Remove file</span>
	</Button>
{/snippet}

{#snippet dropzoneCopy(hint: string)}
	<div class="flex flex-col items-center gap-1 text-center">
		<div class="flex items-center justify-center rounded-full border p-2.5">
			<UploadIcon class="size-6 text-muted-foreground" />
		</div>
		<p class="text-sm font-medium">Drag &amp; drop files here</p>
		<p class="text-xs text-muted-foreground">{hint}</p>
	</div>
{/snippet}

<article class="flex flex-col gap-10">
	<div class="flex flex-col gap-2">
		<h1 class="text-3xl font-semibold tracking-tight">File Upload</h1>
		<p class="text-muted-foreground">
			A file upload component with drag and drop, previewing, and progress tracking.
		</p>
	</div>

	<ComponentPreview
		title="Default"
		description="Mirrors file-upload-demo.tsx. Up to 2 files of 5 MB each; every rejection raises a toast."
	>
		<FileUpload.Root
			bind:value={files}
			class="w-full max-w-md"
			maxFiles={2}
			maxSize={5 * MB}
			{onFileReject}
			multiple
		>
			<FileUpload.Dropzone>
				{@render dropzoneCopy('Or click to browse (max 2 files, up to 5MB each)')}
				<FileUpload.Trigger class="mt-2 w-fit" child={browseButton} />
			</FileUpload.Dropzone>
			<FileUpload.List>
				{#each files as file (file)}
					<FileUpload.Item value={file}>
						<FileUpload.ItemPreview />
						<FileUpload.ItemMetadata />
						<FileUpload.ItemDelete class="size-7" child={removeButton} />
					</FileUpload.Item>
				{/each}
			</FileUpload.List>
		</FileUpload.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Validation"
		description="Mirrors file-upload-validation-demo.tsx. onFileValidate replaces the built-in rejection wording with its own."
	>
		<FileUpload.Root
			bind:value={validatedFiles}
			class="w-full max-w-md"
			{onFileValidate}
			{onFileReject}
			accept="image/*"
			maxFiles={2}
			multiple
		>
			<FileUpload.Dropzone>
				{@render dropzoneCopy('Or click to browse (max 2 files)')}
				<FileUpload.Trigger class="mt-2 w-fit" child={browseButton} />
			</FileUpload.Dropzone>
			<FileUpload.List>
				{#each validatedFiles as file (file)}
					<FileUpload.Item value={file}>
						<FileUpload.ItemPreview />
						<FileUpload.ItemMetadata />
						<FileUpload.ItemDelete class="size-7" child={removeButton} />
					</FileUpload.Item>
				{/each}
			</FileUpload.List>
		</FileUpload.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Direct Upload"
		description="Mirrors file-upload-direct-upload-demo.tsx. onUpload is the whole transport — here a timer-simulated chunked upload driving the linear progress bar."
	>
		<FileUpload.Root
			bind:value={uploadedFiles}
			class="w-full max-w-md"
			onUpload={simulateUpload}
			{onFileReject}
			maxFiles={2}
			multiple
		>
			<FileUpload.Dropzone>
				{@render dropzoneCopy('Or click to browse (max 2 files)')}
				<FileUpload.Trigger class="mt-2 w-fit" child={browseButton} />
			</FileUpload.Dropzone>
			<FileUpload.List>
				{#each uploadedFiles as file (file)}
					<FileUpload.Item value={file} class="flex-col">
						<div class="flex w-full items-center gap-2">
							<FileUpload.ItemPreview />
							<FileUpload.ItemMetadata />
							<FileUpload.ItemDelete class="size-7" child={removeButton} />
						</div>
						<FileUpload.ItemProgress />
					</FileUpload.Item>
				{/each}
			</FileUpload.List>
		</FileUpload.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Circular Progress"
		description="Mirrors file-upload-circular-progress-demo.tsx. The same progress value drawn as a ring inside the preview, in a horizontal list."
	>
		<FileUpload.Root
			bind:value={circularFiles}
			class="w-full max-w-md"
			onUpload={simulateUpload}
			{onFileReject}
			maxFiles={10}
			maxSize={5 * MB}
			multiple
		>
			<FileUpload.Dropzone>
				{@render dropzoneCopy('Or click to browse (max 10 files, up to 5MB each)')}
				<FileUpload.Trigger class="mt-2 w-fit" child={browseButton} />
			</FileUpload.Dropzone>
			<FileUpload.List orientation="horizontal">
				{#each circularFiles as file (file)}
					<FileUpload.Item value={file} class="p-0">
						<FileUpload.ItemPreview class="size-20 [&>svg]:size-12">
							<FileUpload.ItemProgress variant="circular" size={40} />
						</FileUpload.ItemPreview>
						<FileUpload.ItemMetadata class="sr-only" />
						<FileUpload.ItemDelete
							class="absolute -top-1 -right-1 size-5 rounded-full"
							child={cornerRemoveButton}
						/>
					</FileUpload.Item>
				{/each}
			</FileUpload.List>
		</FileUpload.Root>
	</ComponentPreview>

	<ComponentPreview
		title="Fill Progress"
		description="Mirrors file-upload-fill-progress-demo.tsx. The same value again, this time as a clip-path overlay filling the preview."
	>
		<FileUpload.Root
			bind:value={fillFiles}
			class="w-full max-w-md"
			onUpload={simulateUpload}
			{onFileReject}
			maxFiles={10}
			maxSize={5 * MB}
			multiple
		>
			<FileUpload.Dropzone>
				{@render dropzoneCopy('Or click to browse (max 10 files, up to 5MB each)')}
				<FileUpload.Trigger class="mt-2 w-fit" child={browseButton} />
			</FileUpload.Dropzone>
			<FileUpload.List orientation="horizontal">
				{#each fillFiles as file (file)}
					<FileUpload.Item value={file} class="p-0">
						<FileUpload.ItemPreview class="size-20">
							<FileUpload.ItemProgress variant="fill" />
						</FileUpload.ItemPreview>
						<FileUpload.ItemMetadata class="sr-only" />
						<FileUpload.ItemDelete
							class="absolute -top-1 -right-1 size-5 rounded-full"
							child={cornerRemoveButton}
						/>
					</FileUpload.Item>
				{/each}
			</FileUpload.List>
		</FileUpload.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Chat Input"
		description="Mirrors file-upload-chat-input-demo.tsx. The dropzone is absolutely positioned over the composer and only becomes visible while something is dragged onto it."
		class="min-h-[420px] items-start"
	>
		<FileUpload.Root
			bind:value={chatFiles}
			class="relative h-[380px] w-full items-center p-8"
			onUpload={onChatUpload}
			{onFileReject}
			maxFiles={10}
			maxSize={5 * MB}
			multiple
			disabled={isUploading}
		>
			<FileUpload.Dropzone
				tabindex={-1}
				onclick={(event: MouseEvent) => event.preventDefault()}
				class="absolute top-0 left-0 flex size-full items-center justify-center rounded-none border-none bg-background/50 p-0 opacity-0 backdrop-blur transition-opacity duration-200 ease-out data-dragging:opacity-100"
			>
				{@render dropzoneCopy('Upload max 10 files each up to 5MB')}
			</FileUpload.Dropzone>
			<form
				onsubmit={onChatSubmit}
				class="relative flex w-full max-w-md flex-col gap-2.5 rounded-md border border-input px-3 py-2 outline-none focus-within:ring-1 focus-within:ring-ring/50"
			>
				<FileUpload.List orientation="horizontal" class="overflow-x-auto px-0 py-1">
					{#each chatFiles as file (file)}
						<FileUpload.Item value={file} class="max-w-52 p-1.5">
							<FileUpload.ItemPreview class="size-8 [&>svg]:size-5">
								<FileUpload.ItemProgress variant="fill" />
							</FileUpload.ItemPreview>
							<FileUpload.ItemMetadata size="sm" />
							<FileUpload.ItemDelete
								class="absolute -top-1 -right-1 size-5 rounded-full"
								child={cornerRemoveButton}
							/>
						</FileUpload.Item>
					{/each}
				</FileUpload.List>
				<Textarea
					bind:value={message}
					placeholder="Type your message here..."
					class="min-h-10 w-full resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
					disabled={isUploading}
				/>
				<div class="flex items-center justify-end gap-1.5">
					<FileUpload.Trigger class="size-7 rounded-sm" child={attachButton} />
					<Button
						type="submit"
						size="icon"
						class="size-7 rounded-sm"
						disabled={!message.trim() || isUploading}
					>
						<ArrowUpIcon />
						<span class="sr-only">Send message</span>
					</Button>
				</div>
			</form>
		</FileUpload.Root>
	</ComponentPreview>

	<ComponentPreview
		title="With Form"
		description="Mirrors file-upload-form-demo.tsx. Upstream uses react-hook-form and zod; this rebuilds the same three rules on Field.* with runes state, since no form library is installed here."
	>
		<form onsubmit={onFormSubmit} class="w-full max-w-md">
			<Field.FieldGroup>
				<Field.Field data-invalid={formError ? 'true' : undefined}>
					<!--
						No `for`: the control the label would point at is the root's own hidden input, whose id
						is internal. The root's `label` prop is what names it for assistive technology.
					-->
					<Field.FieldLabel>Attachments</Field.FieldLabel>
					<FileUpload.Root
						bind:value={formFiles}
						label="Attachments"
						accept="image/*"
						maxFiles={2}
						maxSize={5 * MB}
						onFileReject={(_file, message) => (formError = message)}
						onValueChange={() => (formError = null)}
						invalid={formError !== null}
						multiple
					>
						<FileUpload.Dropzone class="flex-row flex-wrap border-dotted text-center">
							<CloudUploadIcon class="size-4" />
							Drag and drop or
							<FileUpload.Trigger class="p-0" child={chooseFilesLink} />
							to upload
						</FileUpload.Dropzone>
						<FileUpload.List>
							{#each formFiles as file (file)}
								<FileUpload.Item value={file}>
									<FileUpload.ItemPreview />
									<FileUpload.ItemMetadata />
									<FileUpload.ItemDelete class="size-7" child={removeButton} />
								</FileUpload.Item>
							{/each}
						</FileUpload.List>
					</FileUpload.Root>
					<Field.FieldDescription>Upload up to 2 images up to 5MB each.</Field.FieldDescription>
					<Field.FieldError errors={formError ? [{ message: formError }] : undefined} />
				</Field.Field>
				<Button type="submit" class="w-fit">Submit</Button>
			</Field.FieldGroup>
		</form>
	</ComponentPreview>

	<section class="flex flex-col gap-6">
		<h2 class="text-2xl font-semibold tracking-tight">API Reference</h2>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">FileUpload.Root</h3>
			<p class="text-sm text-muted-foreground">
				The container. It owns the file list and renders the hidden <code>input[type=file]</code>
				used by the native dialog and by form submission. Every part additionally accepts
				<code>ref</code>, <code>class</code> and the rest of its element’s HTML attributes.
			</p>
			{@render propsTable(rootProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">FileUpload.Dropzone</h3>
			<p class="text-sm text-muted-foreground">
				A focusable <code>role="region"</code>: <code>Enter</code> and <code>Space</code> open the dialog,
				and it accepts drag-and-drop and clipboard paste. A click originating inside a nested trigger
				is ignored so the dialog never opens twice.
			</p>
			{@render propsTable(dropzoneProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">FileUpload.Trigger</h3>
			<p class="text-sm text-muted-foreground">A button that opens the native file dialog.</p>
			{@render propsTable(triggerProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">FileUpload.List</h3>
			<p class="text-sm text-muted-foreground">
				The <code>role="list"</code> container. Not rendered while the list is empty unless
				<code>forceMount</code> is set.
			</p>
			{@render propsTable(listProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">FileUpload.Item</h3>
			<p class="text-sm text-muted-foreground">
				One file row. Renders nothing when its <code>value</code> is not in the current list, and always
				appends screen-reader-only status text.
			</p>
			{@render propsTable(itemProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">FileUpload.ItemPreview</h3>
			<p class="text-sm text-muted-foreground">
				An object-URL thumbnail for image files, otherwise the matching file-type icon. The URL is
				revoked when the file is removed, the list is cleared, or the component unmounts.
			</p>
			{@render propsTable(itemPreviewProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">FileUpload.ItemMetadata</h3>
			<p class="text-sm text-muted-foreground">
				The file name, its formatted size, and its error message when it has one.
			</p>
			{@render propsTable(itemMetadataProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">FileUpload.ItemProgress</h3>
			<p class="text-sm text-muted-foreground">
				A <code>role="progressbar"</code> in one of three presentations. Unmounts once the file
				reaches 100% unless <code>forceMount</code> is set.
			</p>
			{@render propsTable(itemProgressProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">FileUpload.ItemDelete</h3>
			<p class="text-sm text-muted-foreground">
				Removes its own file and releases its preview URL.
			</p>
			{@render propsTable(itemDeleteProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">FileUpload.Clear</h3>
			<p class="text-sm text-muted-foreground">
				Removes every file. Not rendered while the list is empty unless <code>forceMount</code> is set.
			</p>
			{@render propsTable(clearProps)}
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">useFileUpload()</h3>
			<p class="text-sm text-muted-foreground">
				Reads the root state from context — <code>files</code>, <code>entries</code>,
				<code>count</code>, <code>dragOver</code>, <code>invalidState</code> — for building your own
				parts. Throws outside <code>&lt;FileUpload.Root&gt;</code>. The module also exports
				<code>formatBytes</code> and <code>getFileIcon</code>.
			</p>
		</div>

		<div class="flex flex-col gap-3">
			<h3 class="text-lg font-medium">Data Attributes</h3>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Attribute</Table.Head>
						<Table.Head>On</Table.Head>
						<Table.Head>Present when</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each dataAttributes as row (row.attribute + row.on)}
						<Table.Row>
							<Table.Cell class="font-medium">{row.attribute}</Table.Cell>
							<Table.Cell class="text-muted-foreground">{row.on}</Table.Cell>
							<Table.Cell>{row.when}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
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
					{#each keyboard as row (row.keys + row.description)}
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
