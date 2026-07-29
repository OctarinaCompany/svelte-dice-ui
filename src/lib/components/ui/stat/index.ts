import Root from './stat.svelte';
import Label from './stat-label.svelte';
import Indicator from './stat-indicator.svelte';
import Value from './stat-value.svelte';
import Trend from './stat-trend.svelte';
import Separator from './stat-separator.svelte';
import Description from './stat-description.svelte';

export { type StatRootProps } from './stat.svelte';
export { type StatLabelProps } from './stat-label.svelte';
export {
	statIndicatorVariants,
	STAT_INDICATOR_VARIANTS,
	STAT_INDICATOR_COLORS,
	resolveStatIndicatorVariant,
	resolveStatIndicatorColor,
	type StatIndicatorProps,
	type StatIndicatorVariant,
	type StatIndicatorColor
} from './stat-indicator.svelte';
export { type StatValueProps } from './stat-value.svelte';
export {
	statTrendVariants,
	STAT_TREND_DIRECTIONS,
	resolveStatTrendDirection,
	type StatTrendProps,
	type StatTrendDirection
} from './stat-trend.svelte';
export { type StatSeparatorProps } from './stat-separator.svelte';
export { type StatDescriptionProps } from './stat-description.svelte';

export {
	Root,
	Label,
	Indicator,
	Value,
	Trend,
	Separator,
	Description,
	//
	Root as Stat,
	Label as StatLabel,
	Indicator as StatIndicator,
	Value as StatValue,
	Trend as StatTrend,
	Separator as StatSeparator,
	Description as StatDescription
};
