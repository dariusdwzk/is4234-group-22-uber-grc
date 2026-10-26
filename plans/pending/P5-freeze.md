# P5 — Security Review, Production, Freeze (5–6 Nov)

> **For agentic workers:** superpowers:verification-before-completion. Use **Opus 5.5** for Task 1's review; Sonnet for the rest. No new features in this phase — bug fixes only, each with a regression test.

**Goal:** A reviewed, deployed, frozen demonstrator with evidence for the report and slides.

**Spec:** `docs/superpowers/specs/2026-10-26-uber-grc-prototype-design.md`

### Task 1: Security and wording review
- [ ] **Step 1:** Run the reviewer agent over `git diff <P0 tag or first commit>..main` for: authz on every command and page, `server-only` on every `src/server/**` file, no secrets or real personal data, `DEMO_MODE` guard on every demo path, Zod on every command, ledger append in every state change (grep each `commands/*.ts` for `ctx.log`).
- [ ] **Step 2:** Run `/security-review` (built-in) on the branch; fix Critical/High findings with a regression test each.
- [ ] **Step 3:** `grep -rni "complies with\|compliant with" src docs` → none (outside the handoff quote of the rule itself).
- [ ] **Step 4:** Make `npm audit --audit-level=high` blocking in CI if clean; otherwise record accepted advisories in `DECISIONS.md` with reason.
- [ ] **Step 5:** Commit fixes.

### Task 2: Production deploy and smoke
**Files:** Create `scripts/smoke.ts`
**Interfaces:** `tsx scripts/smoke.ts <baseUrl>` → checks `/api/health` = `{status:"ok",db:"ok"}` and `/api/ledger/verify` `ok:true`; exits non-zero otherwise; prints only status lines.
- [ ] **Step 1 (Darius):** migrate + seed Neon main branch; confirm Vercel production env vars.
- [ ] **Step 2:** `npx tsx scripts/smoke.ts https://<prod>` → both OK.
- [ ] **Step 3:** `E2E_BASE_URL=https://<prod> npm run e2e` → all green (this is `demo-scenario-check` on production); then reset demo so markers start clean.

### Task 3: Evidence and freeze
- [ ] **Step 1:** Screenshots of S1–S8 and the verify-fail state into `docs/evidence/screens/`; save CI run link, test counts (`npm test -- --reporter=json`), e2e report into `docs/evidence/`.
- [ ] **Step 2:** Update `docs/evidence/traceability.md` (F1–F12 → US → test names → screenshot) via the `report-evidence` skill.
- [ ] **Step 3:** Write `docs/test-accounts.md` (emails and roles only; password is delivered in the guide PDF, not committed).
- [ ] **Step 4:** `git tag -a v1.0-freeze -m "feature freeze"`; Darius pushes the tag.
- [ ] **Step 5:** `/handover`; PROGRESS all phases done; move phase files to `plans/done/`.

## P5 Gate
Production smoke OK · full e2e green on production · no open Critical/High findings · tag `v1.0-freeze` pushed.

## After freeze (not code)
7–8 Nov slides · 9–12 Nov guide PDF (> 2 pages, covers every item in the course spec's guide list), ≤ 5-min video (`GroupID_Demonstrator_Demo.mp4`), report with the AI-use acknowledgement table · Fri 13 Nov submit early. Before each demo: open the prod URL once (warm), run smoke, reset demo.
