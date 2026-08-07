/**
 * AI style-conformance audit — the judgement layer above `tools/style-audit.mjs`.
 *
 * Run from Claude Code with the Workflow tool:
 *
 *   1. node tools/style-audit.mjs        → collect the deterministic warnings
 *   2. Workflow({ scriptPath: 'tools/style-audit-workflow.js',
 *                 args: { warnings: [ ...each output line... ] } })
 *
 * Every ported component is compared against the stock shadcn-svelte primitives that live in the
 * same repo — heights, radii, focus rings, disabled states, semantic-colour pairings, hand-rolled
 * affordances that imitate a primitive (the archetype: data-table's faceted filter drew a checkbox
 * with `bg-primary` but no `text-primary-foreground`, so the tick was invisible in dark mode).
 * Findings are then adversarially verified — a skeptic re-reads the file and the reference and
 * kills anything that does not hold up — so what comes out is worth acting on.
 */
export const meta = {
	name: 'style-audit',
	description:
		'Audit ported components against shadcn-svelte visual standards, verify each finding',
	whenToUse:
		'After visual changes to ported components, or periodically to catch conformance drift',
	phases: [
		{ title: 'Audit', detail: 'one auditor per component batch, stock primitives as reference' },
		{ title: 'Verify', detail: 'one adversarial verifier per bug/inconsistency finding' }
	]
};

const BATCHES = [
	['data-grid'],
	['data-table'],
	['media-player'],
	['color-picker', 'color-swatch'],
	['kanban', 'sortable'],
	['file-upload', 'tour'],
	['stepper', 'mention', 'listbox'],
	['editable', 'tags-input', 'key-value'],
	['mask-input', 'phone-input', 'segmented-input', 'checkbox-group'],
	['banner', 'status', 'stat', 'timeline', 'swap'],
	['circular-progress', 'gauge', 'angle-slider', 'qr-code', 'badge-overflow'],
	['marquee', 'scroller', 'masonry', 'stack', 'speed-dial'],
	[
		'action-bar',
		'selection-toolbar',
		'scroll-spy',
		'responsive-dialog',
		'relative-time-card',
		'direction-provider',
		'pending'
	]
];

const FINDINGS_SCHEMA = {
	type: 'object',
	required: ['findings', 'adjudications'],
	properties: {
		findings: {
			type: 'array',
			items: {
				type: 'object',
				required: [
					'file',
					'line',
					'control',
					'dimension',
					'description',
					'expected',
					'fix',
					'severity'
				],
				properties: {
					file: { type: 'string', description: 'repo-relative path' },
					line: { type: 'integer' },
					control: {
						type: 'string',
						description: 'the visual control affected, e.g. "checked box"'
					},
					dimension: {
						enum: ['color', 'size', 'radius', 'state', 'token', 'structure']
					},
					description: { type: 'string', description: 'what deviates, one sentence' },
					expected: { type: 'string', description: 'what the shadcn-svelte standard prescribes' },
					reference: {
						type: 'string',
						description: 'file:line of the primitive that sets the standard'
					},
					fix: { type: 'string', description: 'the concrete class/markup change' },
					severity: {
						enum: ['bug', 'inconsistency', 'nit'],
						description:
							'bug = user-visible defect in some theme/state; inconsistency = measurably off-standard; nit = cosmetic'
					}
				}
			}
		},
		adjudications: {
			type: 'array',
			items: {
				type: 'object',
				required: ['warning', 'verdict', 'reason'],
				properties: {
					warning: { type: 'string', description: 'the deterministic warning line, verbatim' },
					verdict: { enum: ['real', 'dismiss'] },
					reason: { type: 'string' }
				}
			}
		}
	}
};

const VERDICT_SCHEMA = {
	type: 'object',
	required: ['real', 'reason'],
	properties: {
		real: { type: 'boolean' },
		severity: { enum: ['bug', 'inconsistency', 'nit'] },
		reason: { type: 'string' }
	}
};

const warnings = Array.isArray(args?.warnings) ? args.warnings : [];
const warningsFor = (slugs) => warnings.filter((w) => slugs.some((s) => w.includes(`/ui/${s}/`)));

const auditorPrompt = (slugs) => `
You are auditing a Svelte 5 port of the Dice UI React library for visual conformance with the
shadcn-svelte design standards. Repo root: D:/Code/Shadcn/svelte-dice-ui.

Audit these ported component folders (every .svelte and .svelte.ts file, skip *.test.*):
${slugs.map((s) => `  src/lib/components/ui/${s}/`).join('\n')}

THE STANDARD you are auditing against is defined by two sources in this repo:
1. The stock shadcn-svelte primitives under src/lib/components/ui/ (button, checkbox, input,
   badge, command, popover, select, dropdown-menu, dialog, tooltip, separator, radio-group,
   switch, skeleton, spinner, ...). Read the ones relevant to what the audited components draw.
   These files are the ground truth for control heights, paddings, radii, focus rings, disabled
   treatment and colour pairings.
2. CLAUDE.md §6 (Styling) at the repo root — semantic tokens only, status-colour table,
   data-slot/data-* conventions.

CHECK EACH COMPONENT ON THESE DIMENSIONS:
- color: every solid semantic fill must pair with its -foreground companion where a glyph renders
  on it; status colours use success/warning/info tokens, never palette; highlight is a token too,
  but it marks a search match rather than a state, so a status reading of it is a finding;
  muted/accent/destructive used the way the primitives use them.
- size: interactive control heights match the primitives (buttons h-8 for sm / h-9 default per
  buttonVariants; inputs match input.svelte), icons size-4 (or the primitive's own deviation),
  consistent gap steps.
- radius: rounded-* steps match the equivalent primitive (e.g. checkbox uses rounded-[4px],
  inputs/buttons rounded-lg or rounded-md as the stock files say — read them, do not assume).
- state: focus-visible ring pattern (border-ring + ring-3 + ring-ring/50 family), disabled
  opacity/cursor treatment, aria-invalid treatment, hover/active layers — all as the primitives
  do them.
- token: any colour, shadow or spacing that bypasses the theme tokens.
- structure: hand-rolled affordances that imitate a primitive (a drawn checkbox, a badge-like
  chip, a spinner, an input-like field) must match that primitive's anatomy and state classes.
  ARCHETYPE: data-table's faceted filter drew its checkbox as a div with 'bg-primary' when
  selected but omitted 'text-primary-foreground', so the tick inherited near-white and vanished
  in dark mode. Hunt for exactly this class of drift.

Judge against what the reference files actually contain, not your prior knowledge of shadcn.
A deviation that the component documents in a comment as deliberate (with a reason) is NOT a
finding unless the reason is wrong. Upstream Dice UI source is vendored read-only under
.reference/diceui if you need intent.

ALSO ADJUDICATE these heuristic warnings from the deterministic audit that concern your files —
decide 'real' (needs a fix) or 'dismiss' (legitimate, e.g. a progress bar with no glyph, an
overlay that owns its stacking because it uses no Dialog/Popover primitive):
${
	warningsFor(slugs)
		.map((w) => `  ${w}`)
		.join('\n') || '  (none)'
}

Return findings ONLY for genuine deviations — an empty list is a valid and welcome answer.
Cite exact file:line. In 'reference' name the primitive file and line that sets the standard.
`;

const verifierPrompt = (f) => `
You are an adversarial verifier. Repo root: D:/Code/Shadcn/svelte-dice-ui. A style audit claims:

  file:      ${f.file}:${f.line}
  control:   ${f.control}
  dimension: ${f.dimension}
  claim:     ${f.description}
  expected:  ${f.expected}
  reference: ${f.reference ?? 'none given'}
  fix:       ${f.fix}
  severity:  ${f.severity}

Try to REFUTE it. Read the cited file at the cited location, read the reference primitive, and
check: (1) the deviation actually exists in the code as claimed; (2) the cited reference really
prescribes what the claim says (read it, do not trust the claim); (3) the deviation is not
documented in a nearby comment as a deliberate, reasoned divergence; (4) it would produce a
real visual difference in at least one theme or state — trace the classes, do not guess.
If any check fails, real=false. Default to real=false when uncertain. If real, set the honest
severity: 'bug' only if user-visible in some theme/state.
`;

const results = await pipeline(
	BATCHES,
	(slugs) =>
		agent(auditorPrompt(slugs), {
			label: `audit:${slugs[0]}${slugs.length > 1 ? `+${slugs.length - 1}` : ''}`,
			phase: 'Audit',
			schema: FINDINGS_SCHEMA
		}),
	(report, _slugs) => {
		if (!report) return null;
		const toVerify = report.findings.filter((f) => f.severity !== 'nit');
		if (toVerify.length === 0) return { ...report, verified: [] };
		return parallel(
			toVerify.map(
				(f) => () =>
					agent(verifierPrompt(f), {
						label: `verify:${f.file.split('/').pop()}:${f.line}`,
						phase: 'Verify',
						schema: VERDICT_SCHEMA
					}).then((v) => ({ ...f, verdict: v }))
			)
		).then((verified) => ({ ...report, verified: verified.filter(Boolean) }));
	}
);

const reports = results.filter(Boolean);
const confirmed = reports
	.flatMap((r) => r.verified ?? [])
	.filter((f) => f.verdict?.real)
	.map((f) => ({ ...f, severity: f.verdict.severity ?? f.severity }));
const refuted = reports.flatMap((r) => r.verified ?? []).filter((f) => !f.verdict?.real);
const nits = reports.flatMap((r) => r.findings.filter((f) => f.severity === 'nit'));
const adjudications = reports.flatMap((r) => r.adjudications);
const realWarnings = adjudications.filter((a) => a.verdict === 'real');

log(
	`audit done — ${confirmed.length} confirmed, ${refuted.length} refuted, ${nits.length} unverified nits, ` +
		`${realWarnings.length}/${adjudications.length} deterministic warnings judged real`
);

return { confirmed, nits, adjudications, refutedCount: refuted.length };
