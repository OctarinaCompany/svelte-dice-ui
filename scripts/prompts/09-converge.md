/speckit-converge Audit the implemented "{{NAME}}" port ({{FEATURE_DIR}}) against its spec, plan and
tasks, and append any remaining unbuilt work to tasks.md.

Ground truth for behavioural gaps:

- Upstream source: {{SOURCE_PATHS}}
- Upstream documentation (MDX): {{DOCS_MDX}}

Pay particular attention to:

- Documented upstream props, events and keyboard interactions with no corresponding implementation.
- Accessibility requirements from the spec with no assertion in the test files.
- Demo-page examples from the upstream docs that are missing from
  `src/routes/docs/components/{{SLUG}}/+page.svelte`.
- A missing or incomplete entry for "{{SLUG}}" in `registry.json`.

Remember the command contract: append-only to tasks.md, never rewrite spec.md or plan.md, never touch
application code, and leave tasks.md byte-for-byte unchanged if the codebase already satisfies
everything.
