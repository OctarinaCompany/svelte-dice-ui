/**
 * Deterministic style-conformance audit for the ported components.
 *
 * Checks every ported component folder (the `registry.json` items) against the mechanical rules of
 * CLAUDE.md §6 — the ones a pattern can enforce without judgement:
 *
 *   error  raw palette colour with a numeric step (`bg-blue-500`, `text-zinc-400/60`, …)
 *   error  `space-x-*` / `space-y-*` (use flex/grid + gap)
 *   error  a manual `dark:` variant that is neither a `*-transparent` cancellation (needed to null
 *          out a composed primitive's own dark layer) nor a verbatim copy of a `dark:` utility the
 *          stock shadcn primitives themselves use (parity copies such as mask-input mirroring
 *          Input's chrome are legitimate)
 *   warn   `h-N w-N` / `w-N h-N` with the same step (use `size-N`)
 *   warn   `overflow-hidden` + `text-ellipsis` + `whitespace-nowrap` together (use `truncate`)
 *   warn   manual `z-*` (overlays stack themselves; sticky table chrome is a known exception)
 *   warn   a solid semantic fill (`bg-primary`, `bg-destructive`, `bg-success`, …) in a class
 *          string that never sets the matching `text-*-foreground` — the faceted-filter checkbox
 *          bug. Tints (`bg-primary/10`) are exempt: they keep the normal text colour. A bar or
 *          swatch with no glyph inside is a legitimate hit to dismiss on review.
 *   warn   a part file that never sets a `data-slot` attribute
 *
 * Only string literals are scanned, after comments are stripped — utility classes cannot live
 * anywhere else, and this keeps prose (`// upstream used \`bg-blue-50\``) and API object keys
 * (qrcode's `color: { dark, light }`) out of the findings.
 *
 * What a pattern cannot decide — whether a hand-rolled affordance matches the primitive it
 * imitates, whether a control's height/radius/focus ring matches its shadcn counterpart — is the
 * AI layer's job (`tools/style-audit-workflow.js`, run through Claude Code's Workflow tool). This
 * script is the cheap, deterministic gate meant to run in CI and before every push.
 *
 * Exit code 1 when any error-level finding exists; warnings alone exit 0.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = process.cwd();
const uiRoot = join(repoRoot, 'src', 'lib', 'components', 'ui');
const manifest = JSON.parse(readFileSync(join(repoRoot, 'registry.json'), 'utf8'));
const ported = new Set(manifest.items.map((item) => item.name));

/** Tailwind palette families. `violet`, `teal` and `rose` are theme tokens when bare — only the
 * numeric-step forms (`bg-teal-500`) reach for the palette. */
const PALETTE =
	'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone';
const COLOR_UTILS =
	'bg|text|border|ring|inset-ring|fill|stroke|from|via|to|divide|outline|decoration|accent|caret|shadow';
const VARIANT_PREFIX = String.raw`(?:[\w[\]&_>~.:*/%-]+:)*`;

const paletteRe = new RegExp(
	String.raw`(?<![\w-])${VARIANT_PREFIX}(?:${COLOR_UTILS})-(?:${PALETTE})-\d{2,3}(?:/\d{1,3})?(?![\w-])`,
	'g'
);
const spaceRe = new RegExp(String.raw`(?<![\w-])${VARIANT_PREFIX}space-[xy]-[\w.[\]]+`, 'g');
const darkUtilityRe = /(?<![\w-])dark:[^\s'"`]+/g;
const zIndexRe = new RegExp(
	String.raw`(?<![\w-])${VARIANT_PREFIX}z-(?:\d+|\[[^\]]+\])(?![\w-])`,
	'g'
);
const sizePairRe = /\b([hw])-(\d+(?:\.\d+)?)((?:\s+[\w:/[\]-]+){0,2}\s+)([hw])-(\d+(?:\.\d+)?)\b/g;
const solidRe = new RegExp(
	String.raw`(?<![\w-])${VARIANT_PREFIX}bg-(primary|secondary|destructive|accent|success|warning|info)(?![\w/-])`,
	'g'
);

/** Strip JS block comments, full-line `//` comments and HTML comments. Inline `//` is kept so
 * `https://…` inside a string survives. Offsets are preserved by replacing with spaces. */
function stripComments(text) {
	return text
		.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
		.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
		.replace(/^[\t ]*\/\/[^\n]*/gm, (m) => m.replace(/[^\n]/g, ' '));
}

/** Every quoted string literal with its offset — good enough to scope class checks without a
 * Svelte parser. Template literals are treated as one span. */
function stringLiterals(text) {
	const literals = [];
	const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
	let match;
	while ((match = re.exec(text)) !== null) {
		const value = match[1] ?? match[2] ?? match[3] ?? '';
		literals.push({ value, index: match.index + 1 });
	}
	return literals;
}

function lineOf(text, index) {
	return text.slice(0, index).split('\n').length;
}

/** The final utility of a variant chain: `dark:data-invalid:ring-destructive/40` →
 * `ring-destructive/40`. Arbitrary variants (`data-[state=checked]:`) contain no whitespace, so
 * splitting on the last `:` outside brackets is enough. */
function finalUtility(chained) {
	let depth = 0;
	let cut = -1;
	for (let i = 0; i < chained.length; i++) {
		const ch = chained[i];
		if (ch === '[') depth++;
		else if (ch === ']') depth--;
		else if (ch === ':' && depth === 0) cut = i;
	}
	return chained.slice(cut + 1);
}

/** Final utilities the stock (non-ported) shadcn primitives put behind `dark:`. A ported component
 * applying one of these under `dark:` is copying primitive chrome for parity — possibly through a
 * translated variant chain (`aria-invalid` → `data-invalid`, `data-checked` →
 * `data-[state=checked]`) — which the rule allows. Colours the primitives never theme dark-side
 * remain errors. */
function collectStockDarkUtilities() {
	const allowed = new Set();
	for (const entry of readdirSync(uiRoot)) {
		if (ported.has(entry)) continue;
		const dir = join(uiRoot, entry);
		if (!statSync(dir).isDirectory()) continue;
		for (const file of readdirSync(dir)) {
			if (!/\.(svelte|svelte\.ts|ts)$/.test(file) || /\.test[.-]/.test(file)) continue;
			const text = stripComments(readFileSync(join(dir, file), 'utf8'));
			for (const { value } of stringLiterals(text)) {
				for (const m of value.matchAll(darkUtilityRe)) allowed.add(finalUtility(m[0]));
			}
		}
	}
	return allowed;
}

const stockDark = collectStockDarkUtilities();
const findings = [];

function record(severity, file, line, rule, detail) {
	findings.push({
		severity,
		file: relative(repoRoot, file).replaceAll('\\', '/'),
		line,
		rule,
		detail
	});
}

function auditFile(file) {
	const raw = readFileSync(file, 'utf8');
	const text = stripComments(raw);

	for (const { value, index } of stringLiterals(text)) {
		const at = (offset) => lineOf(text, index + offset);

		for (const [re, severity, rule, hint] of [
			[paletteRe, 'error', 'raw-palette', 'use the semantic tokens from src/app.css'],
			[spaceRe, 'error', 'space-x/y', 'use flex/grid with gap-*'],
			[zIndexRe, 'warn', 'manual-z-index', 'overlays manage their own stacking']
		]) {
			for (const m of value.matchAll(re)) {
				record(severity, file, at(m.index), rule, `\`${m[0]}\` — ${hint}`);
			}
		}

		for (const m of value.matchAll(darkUtilityRe)) {
			const utility = m[0];
			const cancelsToTransparent = /-transparent(?![\w-])/.test(utility);
			// `dark:X` next to a plain `X` in the same class string re-asserts source order against
			// a competing dark-side rule (the stock checkbox's own `dark:data-checked:bg-primary`
			// pattern) — it introduces no dark-only colour, so it is exempt.
			const reinforcesLightRule = value.includes(` ${utility.slice('dark:'.length)}`);
			if (cancelsToTransparent || reinforcesLightRule || stockDark.has(finalUtility(utility)))
				continue;
			record(
				'error',
				file,
				at(m.index),
				'manual-dark',
				`\`${utility}\` — tokens already flip with the theme (transparent cancellations and ` +
					'stock-primitive chrome are exempt)'
			);
		}

		for (const m of value.matchAll(sizePairRe)) {
			const [, axisA, stepA, , axisB, stepB] = m;
			if (axisA !== axisB && stepA === stepB) {
				record('warn', file, at(m.index), 'h+w-pair', `\`${m[0].trim()}\` — use \`size-${stepA}\``);
			}
		}

		for (const m of value.matchAll(solidRe)) {
			if (!value.includes(`text-${m[1]}-foreground`)) {
				record(
					'warn',
					file,
					at(m.index),
					'solid-without-foreground',
					`\`bg-${m[1]}\` without \`text-${m[1]}-foreground\` in the same class string — ` +
						'pair them (or confirm the element renders no glyph)'
				);
			}
		}
	}

	if (
		text.includes('text-ellipsis') &&
		text.includes('whitespace-nowrap') &&
		text.includes('overflow-hidden')
	) {
		record(
			'warn',
			file,
			lineOf(text, text.indexOf('text-ellipsis')),
			'truncate-trio',
			'use `truncate`'
		);
	}
}

function auditComponent(slug) {
	const dir = join(uiRoot, slug);
	let entries;
	try {
		entries = readdirSync(dir);
	} catch {
		record('error', dir, 1, 'missing-folder', `registry item \`${slug}\` has no component folder`);
		return;
	}

	for (const entry of entries) {
		const file = join(dir, entry);
		if (!statSync(file).isFile()) continue;
		if (/\.test[.-]/.test(entry)) continue;
		if (!/\.(svelte|svelte\.ts|ts)$/.test(entry)) continue;

		auditFile(file);

		if (entry.endsWith('.svelte') && !/data-slot['":\s=]/.test(readFileSync(file, 'utf8'))) {
			record('warn', file, 1, 'missing-data-slot', 'part renders without a `data-slot` attribute');
		}
	}
}

for (const slug of [...ported].sort()) auditComponent(slug);

const errors = findings.filter((f) => f.severity === 'error');
const warnings = findings.filter((f) => f.severity === 'warn');

for (const f of findings) {
	console.log(`${f.severity.padEnd(5)} ${f.file}:${f.line}  [${f.rule}] ${f.detail}`);
}
console.log(
	`\nstyle-audit — ${ported.size} components scanned, ${errors.length} error(s), ${warnings.length} warning(s).`
);

process.exitCode = errors.length > 0 ? 1 : 0;
