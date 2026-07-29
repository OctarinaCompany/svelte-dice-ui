The "{{NAME}}" port ({{FEATURE_DIR}}) was implemented, but the verification gate failed.
This is fix attempt {{ATTEMPT}} of {{MAX_ATTEMPTS}}.

Failing step : {{STEP}}
Command : {{COMMAND}}
Exit code : {{EXIT_CODE}}
Working dir : {{REPO_ROOT}}

--- BEGIN OUTPUT (truncated: head + tail) ---
{{DIGEST}}
--- END OUTPUT ---
{{CHEAT_WARNING}}
Your job:

1. Diagnose the root cause. Read the failing files.
2. Fix it in the source. Do NOT suppress it: no @ts-ignore, no @ts-expect-error, no eslint-disable,
   no svelte-ignore, no `as any`, no .skip / .todo, no deleted assertions, and no loosening of the
   tsconfig, svelte-check, eslint or vitest configuration. If a test encodes a wrong expectation,
   fix the test and state in one line why the old expectation was wrong.
3. Re-run `{{COMMAND}}` yourself until it passes.
4. Then run the remaining gate steps and fix those too: {{REMAINING_STEPS}}
5. Keep the tasks.md checkboxes accurate. Do not touch git.
