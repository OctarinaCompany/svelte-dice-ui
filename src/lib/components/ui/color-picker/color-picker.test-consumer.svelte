<script lang="ts">
	import { getColorPickerContext } from './color-picker.svelte.js';

	/**
	 * A custom part built the way a consumer would build one: it reads the picker's state through the
	 * single documented accessor rather than through any prop, and re-renders because every field it
	 * touches is a rune. Test-only — Vitest collects `.{js,ts}`, so this file is never a spec, and it
	 * is not listed in `registry.json`.
	 */
	const root = getColorPickerContext('<ColorPicker.Consumer>');
</script>

<dl data-testid="consumer">
	<dt>rgb</dt>
	<dd data-testid="consumer-rgb">rgb({root.rgb.r}, {root.rgb.g}, {root.rgb.b})</dd>
	<dt>hsv</dt>
	<dd data-testid="consumer-hsv">hsv({root.hsv.h}, {root.hsv.s}, {root.hsv.v})</dd>
	<dt>hue</dt>
	<dd data-testid="consumer-hue">{root.hue}</dd>
	<dt>alpha</dt>
	<dd data-testid="consumer-alpha">{root.alpha}</dd>
	<dt>format</dt>
	<dd data-testid="consumer-format">{root.format}</dd>
	<dt>open</dt>
	<dd data-testid="consumer-open">{root.open ? 'open' : 'closed'}</dd>
</dl>
