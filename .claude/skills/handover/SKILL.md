---
name: handover
description: Write the end-of-session handover. Manual only.
disable-model-invocation: true
---

# Handover

Overwrite `docs/ai/HANDOVER.md` with these sections:
- **Changed** — files and behaviour.
- **Verified** — command and real result for each claim.
- **Next** — the next concrete task.
- **Blocked** — what waits on a human.
- **Decisions** — also append hard-to-reverse ones to `docs/ai/DECISIONS.md`.
- **Gotchas** — surprises for the next session.

Then update the phase row in `docs/ai/PROGRESS.md` (status, gate result, date). Never include secrets or connection strings.
