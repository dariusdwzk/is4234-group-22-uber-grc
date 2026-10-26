# P3 — Decision Gate, Independence, Decisions (A) ∥ Clocks, Conflicts, Escalation, Summary UI (B)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans + superpowers:test-driven-development. Global Constraints in `00-master-plan.md`. Spec §6, §8. **Ponytail OFF** for Tasks 1–3, 6.

**Goal:** Security can recommend but never close; GC + PCO decide with checklist and reason code; non-independent or duplicate approvers are refused; disagreement and late clocks escalate to Tier 2 exactly once; approvers see a one-page decision summary with conflicts.

**Architecture:** Pure `gate.ts`, `independence.ts`, `clocks.ts`, `conflicts.ts` in `src/domain`; commands wire them; escalation sweep plugs into the `runCommand` hook point from P1 Task 5.

**Spec:** `docs/superpowers/specs/2026-10-26-uber-grc-prototype-design.md`

---

### Task 1: Independence (A)

**Files:** Create `src/domain/independence.ts`, `tests/unit/independence.test.ts`

**Interfaces:** `isIndependent(userId: string, reportsTo: ReadonlyMap<string, string | null>, cisoIds: ReadonlySet<string>): boolean` — walks up from `userId`'s manager; false if any ancestor (or the user) is in `cisoIds`; stops on null; on a cycle returns **false** (fail closed).

- [ ] **Step 1: Failing tests** (seed shape from P2 Task 1): `pco (→gc→ceo) independent`; `US-13: pat.quinn (→ciso) not independent`; `user reporting to sa (→ciso) not independent`; `the CISO themself not independent`; `cycle a→b→a returns false`; `unknown user id returns false`.
- [ ] **Steps 2–5:** FAIL → implement → PASS → commit.

### Task 2: Gate logic (A)

**Files:** Create `src/domain/gate.ts`, `tests/unit/gate.test.ts`

**Interfaces:**
```ts
type Decision = { approverId: string; approverRole: "GC" | "PCO"; outcome: Outcome; notifyBy: string | null; reasonCode: ReasonCode };
type ReasonCode = "LEGAL_ADVICE" | "REGULATORY_DEADLINE" | "CONTAINMENT_CONFIRMED" | "INSUFFICIENT_EVIDENCE" | "LAW_ENFORCEMENT_REQUEST" | "OTHER";
type Checklist = { reviewedEvidence: boolean; noPersonalConflict: boolean; consideredRegulatorDeadlines: boolean; consideredBoardNotice: boolean; notInstructedBySecurity: boolean };
type GateState = { status: "awaiting"; missing: ("GC" | "PCO")[] } | { status: "agreed"; outcome: Outcome; notifyBy: string | null } | { status: "disagreement" };
function gateState(decisions: readonly Decision[]): GateState;
function checkDecision(input: { approver: Actor; independent: boolean; checklist: Checklist; outcome: Outcome; notifyBy: string | null; existing: readonly Decision[] }):
  { ok: true } | { ok: false; reason: "WRONG_ROLE" | "NOT_INDEPENDENT" | "SAME_APPROVER" | "CHECKLIST_INCOMPLETE" | "NOTIFY_DATE_REQUIRED" };
```
`SAME_APPROVER` = an existing decision for the *other* role has the same `approverId`. `agreed` requires both roles present and equal `outcome` (and equal `notifyBy` for `notify_later`). Re-deciding replaces the actor's own role entry.

- [ ] **Step 1: Failing truth-table tests:** none → awaiting [GC,PCO]; GC only → awaiting [PCO]; both withhold → agreed withhold; GC withhold + PCO notify_now → disagreement; both notify_later different dates → disagreement; `US-12: only one approval → case stays open`; `US-13: same person both approvals refused` (SAME_APPROVER); `SA approver → WRONG_ROLE`; any checklist false → CHECKLIST_INCOMPLETE; notify_later without date → NOTIFY_DATE_REQUIRED.
- [ ] **Steps 2–5:** FAIL → implement → PASS → commit.

### Task 3: Recommendation, materiality, decision, close commands (A)

**Files:** Create `src/server/commands/record-recommendation.ts`, `record-materiality.ts`, `submit-decision.ts`, `close-case.ts`, `src/server/board/tier2.ts`, `tests/integration/gate-commands.test.ts`

**Interfaces:**
- `createTier2(ctx: CommandCtx, caseId: string, reasonKey: string, body: string): Promise<boolean>` — `INSERT … ON CONFLICT (case_id, reason_key) DO NOTHING`; appends `TIER2_CREATED` only when inserted; returns inserted. (Used by B in Task 6 and P4.)
- `recordRecommendation` `{caseId, proposedOutcome: Outcome, dataTaken: "yes"|"no"|"unknown", treatAs: "incident"|"bug_bounty", text: string(1..2000)}`.
- `recordMateriality` `{caseId}` → sets `materiality_determined_at = now` once (second call → `Conflict`).
- `submitDecision` `{caseId, outcome, notifyBy?: ISO date, reasonCode, checklist}` → loads users map, computes `isIndependent`, `checkDecision`; on refusal throw `Forbidden(reason)` — `runCommand` rolls back and writes `REFUSED {action, reason}` in its own tx (P1 Task 5), so the refusal persists. Upsert decision; append `DECISION_SUBMITTED`; `gateState`: agreed → case `closed`, `outcome`, `notify_by`, `closed_at`, append `CASE_CLOSED`; disagreement → `createTier2(…, "disagreement", …)`.
- `closeCase` `{caseId}` → always refused for HIGH: message `Cannot close: a HIGH case closes only when General Counsel and Privacy/Compliance agree. Missing: <roles>`; logs `REFUSED`. (LOW cases are already auto_closed; closing them → `Conflict`.)
- [ ] **Step 1: Failing tests:**
  - `US-11: SA close on HIGH refused, names missing approvals, logged`
  - `US-11: CISO close on HIGH refused`
  - `US-12: GC + PCO both withhold → case closed, both decisions stored with reason code and checklist`
  - `US-12: only GC → case stays open`
  - `US-13: pat.quinn (PCO reporting to CISO) refused "not independent" and logged`
  - `US-15: GC withhold + PCO notify_now → Tier 2 "disagreement" created in same action`
  - `resubmitting same decision is idempotent for Tier 2` (two disagreements → one Tier 2 row)
  - `submitDecision on closed case → Conflict`
- [ ] **Steps 2–5:** FAIL → implement → PASS → commit.

### Task 4: Clocks + verified regime wording (B)

**Files:** Create `src/domain/clocks.ts`, `tests/unit/clocks.test.ts`, `docs/evidence/regime-clocks.md`; Modify `rule-packs/v1.json` (clock labels/sources)

**Interfaces:**
```ts
type ClockState = { id: string; label: string; startedAt: string | null; dueAt: string | null;
  pctElapsed: number | null; status: "not_started" | "running" | "due_soon" | "overdue" | "stopped"; note?: string };
type ClockCase = { detectedAt: string; highSince: string | null; materialityDeterminedAt: string | null; closedAt: string | null; tier: Tier };
function addBusinessDays(start: Date, n: number): Date; // Mon–Fri, no holiday calendar (documented limitation)
function computeClocks(c: ClockCase, pack: RulePack, now: Date): ClockState[];
```
Clock rules (spec §8): `INT_CLASSIFY` detectedAt+24h; `INT_DECIDE` highSince+72h (not_started if not HIGH); `GDPR_33` detectedAt+72h; `PDPA_26D` highSince+3 calendar days; `SEC_1_05` materialityDeterminedAt + 4 business days, `not_started` with note `Materiality not yet determined — N days since detection` otherwise. `due_soon` at ≥ `pack.slas.escalateAtPct`%. Closed case → all `stopped`. `pctElapsed` rounded down to an integer.

- [ ] **Step 1 (research, before code):** Look up the primary text of SEC Form 8-K Item 1.05 (filing deadline and trigger), GDPR Art. 33(1), and the Singapore PDPA notification provision (check the section number — `26D` is the working assumption). Write `docs/evidence/regime-clocks.md`: one row each with exact trigger, period, source URL, accessed date, and the UI label. If any assumption in spec §8 is wrong, update `v1.json` labels and tell Darius before continuing.
- [ ] **Step 2: Failing tests:** `addBusinessDays(Fri 2026-11-06, 4) = Thu 2026-11-12`; `US-10: case detected at T shows hours since T and each clock`; `SEC not_started until materiality`; `GDPR due_soon at 54h (75% of 72h)`; `overdue after due`; `closed case → stopped`; `LOW case INT_DECIDE not_started`.
- [ ] **Steps 3–5:** FAIL → implement → PASS → commit.

### Task 5: Conflicts, decision summary, approval dialog (B)

**Files:** Create `src/domain/conflicts.ts`, `tests/unit/conflicts.test.ts`, `src/app/(app)/cases/[id]/DecisionSummary.tsx`, `ApprovalForm.tsx`, `RecommendationForm.tsx`, `actions.ts`; Modify `src/server/queries/cases.ts` (add recommendation, decisions, clocks, conflicts, gate state)

**Interfaces:**
- `type Conflict = { code: "DATA_TAKEN_CONTRADICTED" | "BOUNTY_LABEL_CONTRADICTED"; message: string }`; `detectConflicts(rec: { dataTaken: string; treatAs: string } | null, facts: CaseFacts, firedRuleIds: readonly string[]): Conflict[]`.
- Decision summary (S5, one screen): what happened (events), data involved, fired rules, clocks table, security recommendation, conflict banner `Recommendation conflicts with evidence`, open flags, gate state ("Awaiting: Privacy/Compliance"), disabled-looking Close button that still submits (so the refusal is demonstrated and logged).
- "Record materiality determination" button (GC only, hidden once recorded) calling `recordMateriality`; starts the SEC clock.
- Approval form (S6, GC/PCO only): outcome radio, notify-by date (shown for notify_later), reason code select, five checklist checkboxes with plain labels, submit; refusal reason shown inline.
- [ ] **Step 1: Failing tests:** `US-14: dataTaken "no" with personalDataAccessed → DATA_TAKEN_CONTRADICTED`; `treatAs bug_bounty with R-PAY-LINKED fired → BOUNTY_LABEL_CONTRADICTED`; `no recommendation → []`.
- [ ] **Steps 2–4:** FAIL → implement → PASS. Manual UI check as SA, GC, pat.quinn.
- [ ] **Step 5:** Commit.

### Task 6: Escalation sweep (B, A reviews)

**Files:** Modify `src/server/escalation.ts` (replace P1 stub); Create `tests/integration/escalation.test.ts`

**Interfaces:** `sweepEscalations(ctx: CommandCtx): Promise<number>` — for each open HIGH case whose `gateState` is not `agreed`: `computeClocks`; every clock with status `due_soon`/`overdue` → `createTier2(ctx, caseId, "clock:" + id, body)`. Returns number created. Also called by the board page load via a `sweep` system command (P4).

- [ ] **Step 1: Failing tests:** `US-19: GDPR clock at 75% creates one Tier 2`; `US-19: sweeping twice creates it exactly once`; `agreed case does not escalate`; `LOW case does not escalate`; `advanceClock +60h triggers escalation on next command`.
- [ ] **Steps 2–5:** FAIL → implement → PASS → commit.

### Task 7: Replay steps 4–5 e2e (B)

**Files:** Modify `tests/e2e/replay.spec.ts`

- [ ] **Step 1:** Add `Step 4 (F1): security recommends "treat as bug bounty", close is refused naming missing approvals` and `Step 5 (F2): GC and PCO sign withhold with checklist and reason code → case closed; board Tier 1 still present`; add `scenario-b.spec.ts` stub only if time (full in P4).
- [ ] **Step 2:** `npm run e2e` → green locally and CI. Commit; `/handover`.

## P3 Gate
Unit + integration green (gate truth table, independence, clocks, escalation exactly-once); `replay.spec.ts` steps 1–5 green; `docs/evidence/regime-clocks.md` exists with sources.
