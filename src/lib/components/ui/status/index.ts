import Root from './status.svelte';
import Indicator from './status-indicator.svelte';
import Label from './status-label.svelte';

export {
	statusVariants,
	STATUS_VARIANTS,
	resolveStatusVariant,
	type StatusVariant,
	type StatusRootProps,
	type StatusChildProps
} from './status.svelte';
export { type StatusIndicatorProps } from './status-indicator.svelte';
export { type StatusLabelProps } from './status-label.svelte';

export {
	Root,
	Indicator,
	Label,
	//
	Root as Status,
	Indicator as StatusIndicator,
	Label as StatusLabel
};
