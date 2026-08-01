import Item from './stack-item.svelte';
import Root from './stack.svelte';

export { type StackChildProps, type StackProps, type StackRootProps } from './stack.svelte';
export {
	stackItemWrapperVariants,
	type StackItemChildProps,
	type StackItemProps
} from './stack-item.svelte';
export {
	getStackContext,
	setStackContext,
	StackState,
	STACK_SIDES,
	type StackSide,
	type StackStateProps
} from './stack.svelte.js';

export {
	Root,
	Item,
	//
	Root as Stack,
	Item as StackItem
};
