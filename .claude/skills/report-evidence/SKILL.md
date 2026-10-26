---
name: report-evidence
description: Use when writing or updating the course report. Keeps the failure (F1-F12) to user story to test-name table in docs/evidence/traceability.md and flags claims with no citable source.
---

# Report evidence

- Maintain `docs/evidence/traceability.md`: columns F-id, failure, user story (US-n), feature, test name (tests start with the story id, e.g. `US-13:`), source.
- Every factual claim about the Uber case needs a citable source; list unsourced claims under "Unsourced" instead of writing them as fact.
- Wording: "designed in alignment with", never "complies with"; clocks are "illustrative".
- After tests change, re-check each row's test name still exists (grep the tests).
