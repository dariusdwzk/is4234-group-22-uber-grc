---
name: demo-scenario-check
description: Use to check that the Nov 2016 replay scenario still works end to end. Runs the replay e2e and reports which of steps 1-8 pass or fail.
---

# Demo scenario check

1. Run `npm run e2e -- replay.spec.ts` (from P2 onward; before that, say the e2e does not exist yet).
2. Report a table: step 1-8, pass/fail, and the failing assertion text for each failure.
3. For the production check (P5), run it against the deployed URL only if the human supplies it; never print credentials.
4. Do not edit tests to make them pass; report the failure.
