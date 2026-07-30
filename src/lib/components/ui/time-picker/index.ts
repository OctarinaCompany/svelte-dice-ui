import Root from './time-picker.svelte';
import Label from './time-picker-label.svelte';
import InputGroup from './time-picker-input-group.svelte';
import Input from './time-picker-input.svelte';
import Separator from './time-picker-separator.svelte';
import Trigger from './time-picker-trigger.svelte';
import Content from './time-picker-content.svelte';
import Column from './time-picker-column.svelte';
import ColumnItem from './time-picker-column-item.svelte';
import Hour from './time-picker-hour.svelte';
import Minute from './time-picker-minute.svelte';
import Second from './time-picker-second.svelte';
import Period from './time-picker-period.svelte';
import Clear from './time-picker-clear.svelte';

export type {
	TimePickerChildProps,
	TimePickerProps,
	TimePickerRootProps
} from './time-picker.svelte';
export type { TimePickerLabelChildProps, TimePickerLabelProps } from './time-picker-label.svelte';
export type {
	TimePickerInputGroupChildProps,
	TimePickerInputGroupProps
} from './time-picker-input-group.svelte';
export type { TimePickerInputChildProps, TimePickerInputProps } from './time-picker-input.svelte';
export type {
	TimePickerSeparatorChildProps,
	TimePickerSeparatorProps
} from './time-picker-separator.svelte';
export type {
	TimePickerTriggerChildProps,
	TimePickerTriggerProps
} from './time-picker-trigger.svelte';
export type { TimePickerContentProps } from './time-picker-content.svelte';
export type {
	TimePickerColumnChildProps,
	TimePickerColumnProps
} from './time-picker-column.svelte';
export type {
	TimePickerColumnItemChildProps,
	TimePickerColumnItemProps
} from './time-picker-column-item.svelte';
export type { TimePickerHourProps } from './time-picker-hour.svelte';
export type { TimePickerMinuteProps } from './time-picker-minute.svelte';
export type { TimePickerSecondProps } from './time-picker-second.svelte';
export type { TimePickerPeriodProps } from './time-picker-period.svelte';
export type { TimePickerClearChildProps, TimePickerClearProps } from './time-picker-clear.svelte';

export {
	getTimePickerColumnContext,
	getTimePickerContentContext,
	getTimePickerContext,
	getTimePickerInputGroupContext,
	hasTimePickerColumnContext,
	hasTimePickerContentContext,
	hasTimePickerContext,
	hasTimePickerInputGroupContext,
	setTimePickerColumnContext,
	setTimePickerContentContext,
	setTimePickerContext,
	setTimePickerInputGroupContext,
	TimePickerRootState,
	type TimePickerClickAction,
	type TimePickerColumnContext,
	type TimePickerInputGroupContext,
	type TimePickerRootStateProps
} from './time-picker.svelte.js';

// The reuse surfaces this port exports for later components (contracts/time-engine.md).
export {
	ColumnNavigation,
	focusFirstOf,
	type ColumnItemMeta,
	type ColumnMeta,
	type ColumnNavigationProps
} from './column-navigation.svelte.js';

export {
	buildHourValues,
	buildStepValues,
	clamp,
	currentTime,
	DEFAULT_SEGMENT_PLACEHOLDER,
	formatColumnValue,
	formatTimeValue,
	getIs12Hour,
	maxFirstDigit,
	normalizeSegmentPlaceholder,
	parseTimeString,
	PERIODS,
	SEGMENTS,
	stepSegment,
	to12Hour,
	to24Hour,
	togglePeriod,
	// The engine's `Period` type is re-exported as `TimePeriod` here: the barrel already exports a
	// *component* named `Period` (`<TimePicker.Period>`), and one module cannot export the same name
	// twice. `Period` itself stays available from `./time-engine.js`.
	type Period as TimePeriod,
	type ResolvedSegmentPlaceholder,
	type Segment,
	type SegmentFormat,
	type SegmentPlaceholder,
	type TimeValue
} from './time-engine.js';

export {
	Root,
	Label,
	InputGroup,
	Input,
	Separator,
	Trigger,
	Content,
	Column,
	ColumnItem,
	Hour,
	Minute,
	Second,
	Period,
	Clear,
	//
	Root as TimePicker,
	Label as TimePickerLabel,
	InputGroup as TimePickerInputGroup,
	Input as TimePickerInput,
	Separator as TimePickerSeparator,
	Trigger as TimePickerTrigger,
	Content as TimePickerContent,
	Column as TimePickerColumn,
	ColumnItem as TimePickerColumnItem,
	Hour as TimePickerHour,
	Minute as TimePickerMinute,
	Second as TimePickerSecond,
	Period as TimePickerPeriod,
	Clear as TimePickerClear
};
