The Spec Kit consistency analysis for feature {{FEATURE_DIR}} (the "{{NAME}}" port) produced the
findings below. Apply the remediation now. Do not re-run the analysis; do not invoke any skill.

You may edit ONLY these files:
{{FEATURE_DIR}}/spec.md
{{FEATURE_DIR}}/plan.md
{{FEATURE_DIR}}/tasks.md
{{FEATURE_DIR}}/checklists/*.md
Do not touch any application code in this phase.

Ground truth if you need to check a claim:

- Upstream source: {{SOURCE_PATHS}}
- Upstream documentation (MDX): {{DOCS_MDX}}

FINDINGS (JSON):
{{FINDINGS_JSON}}

Rules:

- Fix every CRITICAL and every HIGH finding. Fix MEDIUM findings when the fix is local and
  unambiguous. Skip LOW.
- Preserve each template's section order and heading names.
- Keep existing task IDs stable. Append new tasks at the end of their phase; never renumber.
- After editing, re-validate {{FEATURE_DIR}}/checklists/requirements.md item by item and set every
  item that now genuinely passes to "- [X]". If an item cannot pass, keep editing the artifacts until
  it can. All items must end checked.
- Finally, re-read spec.md and confirm it contains zero occurrences of "[NEEDS CLARIFICATION".
