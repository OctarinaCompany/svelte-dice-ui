/speckit-analyze Analyse spec.md, plan.md and tasks.md for the "{{NAME}}" port ({{FEATURE_DIR}}).

Ground truth for coverage questions:

- Upstream source: {{SOURCE_PATHS}}
- Upstream documentation (MDX): {{DOCS_MDX}}

Focus areas, in priority order:

1. Coverage - every documented upstream behaviour, prop, event and keyboard interaction has at least
   one requirement AND at least one task.
2. Accessibility - roles, states, focus management and keyboard requirements are specified and tasked.
3. Svelte 5 idiom compliance and constitution alignment.
4. Deliverable coverage - component files, unit tests, demo route, registry entry.
5. Ambiguity, duplication and terminology drift across the three artifacts.

Do not modify any file. Return ONLY JSON conforming to the supplied output schema, with a concrete,
directly-applicable `proposedEdit` for every CRITICAL and HIGH finding. Set "verdict" to
"needs-remediation" if any CRITICAL or HIGH finding exists, otherwise "ready".
