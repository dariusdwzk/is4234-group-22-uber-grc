# P4 — Ledger UI, Verify/Tamper/Export (A) ∥ Board Dashboard, Tier 2, Flags (B) → Full Replay E2E

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans + superpowers:test-driven-development. Global Constraints in `00-master-plan.md`. Spec §5, §8. **Ponytail OFF** for Task 1.

**Goal:** Ledger page with Verify, demo-only Tamper and Export head; Audit Committee Chair dashboard with Tier 1 feed, Tier 2 inbox + acknowledge, flags and the "days to board vs 371" KPI; challenge flags; the whole replay and scenarios B–F pass on a Vercel preview.

**Spec:** `docs/superpowers/specs/2026-10-26-uber-grc-prototype-design.md`

---

### Task 1: Ledger page, verify, tamper, export head (A)

**Files:** Create `src/app/(app)/ledger/page.tsx`, `actions.ts`, `src/server/commands/tamper-entry.ts`, `src/server/commands/export-head.ts` (wraps P1 `exportHead`), `src/server/queries/ledger.ts`, `tests/integration/ledger-ui.test.ts`

**Interfaces:**
- `listLedger(actor, { page: number }): Promise<{ rows: { seq; ts; actorName; eventType; hashShort; payloadPreview }[]; total }>` (50 per page, newest first).
- `tamperEntry` `{ seq: int ≥ 2 }` — DEMO + `assertDemoMode()`; via `getDemoDb()` sets `payload = payload || '{"tampered":true}'` for that seq **without** touching `hash`; not chained (by design); returns `{ seq }`. UI: red "Demo only — alter entry N" control.
- Verify button shows OK (count, head hash) or `Verification failed at entry N (<reason>)`, plus exported-head match status.
- `resetDemo` must take the head lock before truncating (P2 Task 1) — test it here.
- [ ] **Step 1: Failing tests:** `US-22: tamper entry 5 → verify fails at 5`; `US-22: DEMO_MODE=false tamper throws NotFound`; `US-23: export head writes head_exports and HEAD_EXPORTED entry`; `export head refused for SA`; `reset after concurrent appends verifies OK` (start 10 appends and a reset concurrently; afterwards `verifyChain().ok`).
- [ ] **Steps 2–5:** FAIL → implement → PASS → commit.

### Task 2: Board dashboard and Tier 2 acknowledge (B)

**Files:** Create `src/app/(app)/board/page.tsx`, `actions.ts`, `src/server/commands/acknowledge-tier2.ts`, `src/server/commands/sweep.ts`, `src/server/queries/board.ts`, `src/domain/kpi.ts`, `tests/unit/kpi.test.ts`, `tests/integration/board.test.ts`

**Interfaces:**
- `daysToBoard(detectedAt: string, tier1At: string): number` (one decimal); constant `UBER_2016 = { detectionToDisclosureDays: 371, note: "Uber 2016: detection to public disclosure 371 days; no board involvement appears in the record." }`.
- `acknowledgeTier2` `{ itemId, actionNote: string(5..2000) }` — ACC only; open → acknowledged; append `TIER2_ACKNOWLEDGED`; second ack → `Conflict`.
- `sweep` system command (any signed-in board viewer triggers it on page load; runs as `SYSTEM_ACTOR`) — calls `sweepEscalations`.
- `getBoard(actor)`: open cases with tier/clocks, Tier 1 feed (newest first), Tier 2 inbox (open first), open flags, last head export + live verify status, KPI per case.
- Page S7: KPI cards "Detection → board notice: X days" vs "Uber 2016: 371 days to disclosure", Tier 1 feed (read-only), Tier 2 inbox with acknowledge form, flags list, head-hash status.
- [ ] **Step 1: Failing tests:** `daysToBoard same instant = 0`; `US-17: ACC acknowledges Tier 2 with note → handled and logged`; `US-17: GC cannot acknowledge`; `US-16: Tier 1 has no edit/delete command` (assert `POLICY` has no action targeting Tier 1 edits and `board_items` UPDATE path only touches ack fields for tier 2); `US-24: board query returns KPI for replay case`.
- [ ] **Steps 2–5:** FAIL → implement → PASS → commit.

### Task 3: Challenge flags (B)

**Files:** Create `src/server/commands/raise-flag.ts`, `resolve-flag.ts`, `src/app/(app)/flag/page.tsx` (+ actions), `tests/integration/flags.test.ts`

**Interfaces:**
- `raiseFlag` `{ caseRef: string, text: string(5..2000) }` — any signed-in user (EMP knows only a ref from colleagues/the demo script; unknown ref → generic "Flag recorded for review" and a Tier 2 with `reason_key = "flag:unmatched:<flagId>"` so nothing is silently dropped). Inserts flag, `createTier2(…, "flag:" + flagId, …)`, re-runs `classifyCase` (R-FLAG fires), appends `FLAG_RAISED`.
- `resolveFlag` `{ flagId, resolution: string(5..2000) }` — ACC, IA only; append `FLAG_RESOLVED`.
- [ ] **Step 1: Failing tests:** `US-18: EMP flag creates Tier 2 and R-FLAG fires`; `US-18: SA (case owner) cannot resolve flag — refused and logged`; `US-18: CISO cannot resolve`; `IA resolves flag`; `unique (case_id, reason_key): double-submitted flag form creates two flags but each Tier 2 exactly once`.
- [ ] **Steps 2–5:** FAIL → implement → PASS → commit.

### Task 4: Full replay + scenarios B–F e2e, CI e2e required (B, A reviews)

**Files:** Modify `tests/e2e/replay.spec.ts`; Create `tests/e2e/scenario-b.spec.ts`, `scenario-d.spec.ts`, `scenario-e.spec.ts`, `scenario-f.spec.ts` (C already in replay file)

- [ ] **Step 1:** `replay.spec.ts` add: `Step 6 (F6): employee challenge flag escalates to Tier 2`, `Step 7 (F10): demo tamper makes verify fail at entry N`, `Step 8 (F9): dashboard shows days-to-board vs 371`.
- [ ] **Step 2:** Scenario specs: B (one declines → Tier 2 → ACC acknowledges), D (tamper → verify fails at N; export-head mismatch shown), E (flag cannot be dismissed by SA; IA resolves), F (advance +60h → GDPR escalation Tier 2 appears once on dashboard).
- [ ] **Step 3:** `npm run e2e` all green locally; CI `e2e` green; mark `e2e` as a required check (ruleset or convention).
- [ ] **Step 4:** Commit.

### Task 5: Preview deploy verification (A)

- [ ] **Step 1 (Darius):** migrate + seed Neon `preview` branch (`DEMO_PASSWORD` from a password manager, never in chat).
- [ ] **Step 2:** Run Playwright against the preview URL: `E2E_BASE_URL=https://<preview> npm run e2e` (config skips `webServer` when `E2E_BASE_URL` is set).
- [ ] **Step 3:** All green → `/handover`; PROGRESS P4 done; if before 3 Nov end-of-day, P4.5 may start.

## P4 Gate
Replay steps 1–8 + scenarios B–F green against the Vercel **preview** URL.
