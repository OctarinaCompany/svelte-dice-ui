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

END OF TURN — MANDATORY, DO NOT SKIP

Your very last output must be the PHASE_RESULT block from RULE 9, with nothing after it. A prose
summary of what you changed is NOT a substitute and does not end the turn; write the summary inside
the SUMMARY: section of the block, not instead of it.

This phase in particular tends to finish by narrating its edits and stopping there. A turn that ends
without the literal line `PHASE_RESULT: SUCCESS` is treated as a failed turn, and every edit you just
made gets re-done from scratch by a fresh session.
