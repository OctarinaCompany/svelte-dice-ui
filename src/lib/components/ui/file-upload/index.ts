import Root from './file-upload.svelte';
import Dropzone from './file-upload-dropzone.svelte';
import Trigger from './file-upload-trigger.svelte';
import List from './file-upload-list.svelte';
import Item from './file-upload-item.svelte';
import ItemPreview from './file-upload-item-preview.svelte';
import ItemMetadata from './file-upload-item-metadata.svelte';
import ItemProgress from './file-upload-item-progress.svelte';
import ItemDelete from './file-upload-item-delete.svelte';
import Clear from './file-upload-clear.svelte';

export type {
	FileUploadChildProps,
	FileUploadProps,
	FileUploadRootProps
} from './file-upload.svelte';
export type {
	FileUploadDropzoneChildProps,
	FileUploadDropzoneProps
} from './file-upload-dropzone.svelte';
export type {
	FileUploadTriggerChildProps,
	FileUploadTriggerProps
} from './file-upload-trigger.svelte';
export type {
	FileUploadListChildProps,
	FileUploadListOrientation,
	FileUploadListProps
} from './file-upload-list.svelte';
export type { FileUploadItemChildProps, FileUploadItemProps } from './file-upload-item.svelte';
export type {
	FileUploadItemPreviewChildProps,
	FileUploadItemPreviewProps
} from './file-upload-item-preview.svelte';
export type {
	FileUploadItemMetadataChildProps,
	FileUploadItemMetadataProps,
	FileUploadItemMetadataSize
} from './file-upload-item-metadata.svelte';
export type {
	FileUploadItemProgressChildProps,
	FileUploadItemProgressProps,
	FileUploadItemProgressVariant
} from './file-upload-item-progress.svelte';
export type {
	FileUploadItemDeleteChildProps,
	FileUploadItemDeleteProps
} from './file-upload-item-delete.svelte';
export type { FileUploadClearChildProps, FileUploadClearProps } from './file-upload-clear.svelte';

export {
	FILE_UPLOAD_STATUSES,
	FileUploadItemState,
	FileUploadRootState,
	formatBytes,
	getFileIcon,
	getFileUploadContext,
	getFileUploadItemContext,
	setFileUploadContext,
	setFileUploadItemContext,
	useFileUpload,
	type FileUploadFileState,
	type FileUploadItemStateProps,
	type FileUploadRootStateProps,
	type FileUploadStatus,
	type FileUploadUploadOptions
} from './file-upload.svelte.js';

export {
	Root,
	Dropzone,
	Trigger,
	List,
	Item,
	ItemPreview,
	ItemMetadata,
	ItemProgress,
	ItemDelete,
	Clear,
	//
	Root as FileUpload,
	Dropzone as FileUploadDropzone,
	Trigger as FileUploadTrigger,
	List as FileUploadList,
	Item as FileUploadItem,
	ItemPreview as FileUploadItemPreview,
	ItemMetadata as FileUploadItemMetadata,
	ItemProgress as FileUploadItemProgress,
	ItemDelete as FileUploadItemDelete,
	Clear as FileUploadClear
};
