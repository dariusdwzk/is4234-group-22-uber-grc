# Handover

**State (5 Nov):** `main` still has the old app (login + Next pages + Darius's UX redesign, PR #17). Viviana's rebuild is on `viviana-dashboard1`, open as PR #18 (CI green, mergeable). These docs describe PR #18; this update sits on local branch `docs/viviana-update`, cut from her branch.

**Changed by Viviana (PR #18, 28-31 Oct, 33 commits):**
- Rebuilt toward her mockup ("Disclosure Gate", branded UberSecure). New schema (signals, cases, decisions, approvals, notices, receipts, evidence, external anchors); ledger tables unchanged. Migrations regenerated from `0000`, then `0001`-`0007`.
- No login: a role picker sends `X-Role`; the server checks permissions per role and logs refusals as "Blocked: <action>". Roles: Employee, Security, CSO (also Deputy GC), GC, CPO, CEO, Board.
- Front end is a client app (`src/client/*`) over `GET /api/state` and `POST /api/actions/:name`. All old pages, `src/components/*` (PR #17) and login/session code are deleted.
- Rules R1, R5, R6, R8-R13 as data in `rule-packs/v1.json`; signals merge into cases; HIGH starts clocks and a Tier 1 board notice in the same transaction.
- Decision gate: CSO recommends; "Escalate internally" needs GC and CPO; "Notify regulators and affected people" needs GC or CPO. Tier 2 escalations; board acknowledges.
- Staff incident reports: 7 Yes/No/Not sure questions (`rule-packs/staff-report-questions.json`), anonymous option, receipt code with case timeline. Routes: INDEPENDENT (GC/CPO only; one investigates and recommends, the other decides), NORMAL, TRIAGE (CPO rates; unrated 24 h -> HIGH), SECURITY_TRIAGE (LOW, 3 business days or Tier 2).
- Evidence uploads (PDF/PNG/JPEG/text, 2 MB) on the independent path; append-only; SHA-256 in the ledger; download via `GET /api/evidence/:id`.
- Guided 8-step demo (resets data first) and an explore mode that explains the current page.
- Removed: Finance role and payments (incl. the US$100k held payment), Jump to Day 24, +1 day, Declare incident, Challenge a decision, tamper, `/api/ledger/verify`, board Legal duties/Safeguards panels and ledger-intact flag, Unlinked signals tab. Time now follows the real clock (Singapore time).

**Verified:** by Viviana per commit messages: lint, typecheck, 133 unit, 67 integration, build, 6/6 e2e in Chrome. PR #18 CI green. Darius ran it locally on 5 Nov (fresh Docker DB, migrate, seed, landing page loads, no console errors). Test suites not re-run by Darius.

**Not done / open:**
- Human review of the regenerated migrations before merging; Neon must be wiped and reseeded after merge (old tables clash).
- Ledger check and payment hold stay dropped (5 Nov). Report/slides must explain the hash chain instead (see DECISIONS).
- `docs/evidence/screens/*` and the traceability table describe the old app; the mockup HTML her commits cite is not in the repo.
- Dependabot PRs #14-#16 open. Viviana cannot trigger Vercel previews (not on the Vercel team).

**Next:** Darius clicks through PR #18 locally, then decide on merge and on the two removed features; then P5 freeze (deploy, rehearse, evidence).

**Gotchas:** `.env.local` on Darius's machine points `DATABASE_URL_OWNER` at a remote (Neon) database. For local runs, pass the README's local URLs as env vars (they take precedence over `.env.local`). Old local DB needs `docker compose down -v` before migrating (regenerated `0000`). After `db:migrate`, run the `ALTER ROLE` passwords command from the README.
