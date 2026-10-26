# P2 — Seed/Reset, Login UI, Demo Panel (A) ∥ Intake, Correlation, Classification, Case Pages (B)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans + superpowers:test-driven-development. Global Constraints in `00-master-plan.md`. Spec §4, §6, §7, §8 (Tier 1), §9. Read `02-Spec-Starter.md` §5 (screens S1–S5) in `docs/handoff/`.

**Goal:** Sign in as any demo role; the demo operator fires the replay events; they merge into one HIGH case with a Tier 1 notice; case list/detail visible to the right roles only. Replay steps 1–3 pass end to end.

**Architecture:** Commands in `src/server/commands/*` via `runCommand`; pages are Server Components that call `getActor()` + `authorize()` + a query in `src/server/queries/*`; forms post to Server Actions that call commands.

**Tech Stack additions:** dev `@playwright/test` (exact, ≥14 days).

**Spec:** `docs/superpowers/specs/2026-10-26-uber-grc-prototype-design.md`

---

### Task 1: Seed users and demo reset (A)

**Files:** Create `src/server/seed/users.ts`, `src/server/seed/seed.ts`, `scripts/seed.ts`, `src/server/commands/reset-demo.ts`, `tests/integration/seed-reset.test.ts`

**Interfaces:**
- `SEED_USERS` (fictional; email domain `demo.test`):

| key | displayName | role | reportsTo | email |
|---|---|---|---|---|
| ceo | Morgan Lee (CEO) | EXEC | — | ceo@demo.test |
| ciso | Casey Tan (CISO) | CISO | ceo | ciso@demo.test |
| sa | Sam Ortiz (Security Analyst) | SA | ciso | sa@demo.test |
| gc | Gina Park (General Counsel) | GC | ceo | gc@demo.test |
| pco | Priya Nair (Privacy & Compliance) | PCO | gc | pco@demo.test |
| pco_sec | Pat Quinn (Security Compliance Lead) | PCO | ciso | pat.quinn@demo.test |
| ia | Ivan Cho (Internal Audit) | IA | acc | ia@demo.test |
| acc | Alex Rahman (Audit Committee Chair) | ACC | — | acc@demo.test |
| emp | Eli Wong (Engineer) | EMP | sa | emp@demo.test |
| demo | Demo Operator | DEMO | — | demo@demo.test (only seeded when `DEMO_MODE=true`) |

- `seed(tx: Tx, opts: { demoPassword: string; now: Date }): Promise<void>` — inserts users (one shared `DEMO_PASSWORD` hash), rule pack v1 row, `demo_settings` offset 0, genesis entry.
- `npm run db:seed` → `tsx scripts/seed.ts` (refuses if `DEMO_PASSWORD` unset or < 12 chars).
- `resetDemo` command (DEMO only; uses `getDemoDb()`): in one demo_admin tx: lock head → `exportHead` (destination `simulated_auditor_inbox`, kept across reset by excluding `head_exports` from truncate) → `TRUNCATE` state tables + `ledger_entries` → reset `ledger_head` → `seed` → append `DEMO_RESET {previousHead}`.
- [ ] **Step 1: Failing tests:** `US-02: reset clears cases, seeds users and rule pack v1, ledger starts with genesis, verify OK`; `reset keeps previous head in head_exports`; `seed refuses short DEMO_PASSWORD`.
- [ ] **Steps 2–5:** FAIL → implement → PASS → commit.

### Task 2: Login page, layout, role navigation, page guards (A)

**Files:** Create `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/app/logout/route.ts` (POST), `src/app/(app)/layout.tsx`, `src/components/Banner.tsx`, `src/components/Nav.tsx`, `src/server/page-guard.ts`; Modify `next.config.ts` (security headers per spec §9)

**Interfaces:**
- `requireActor(action: Action): Promise<Actor>` — no actor → `redirect("/login")`; forbidden → `notFound()` **and** append `REFUSED` (via the same refusal logger as `runCommand`). Every page in `(app)` calls it first.
- Nav links per role: `/cases` (SA, CISO, GC, PCO, IA), `/report` (all), `/board` (ACC, IA), `/ledger` (IA, ACC, DEMO), `/demo` (DEMO).
- `next.config.ts` headers: `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'` (tighten `unsafe-inline` only if time; record as limitation), `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`.
- [ ] **Step 1:** Integration test `US-01: EMP requesting a case page is refused and logged` (call the page guard helper directly with an EMP actor → throws `NotFound`; ledger has `REFUSED`).
- [ ] **Step 2–4:** FAIL → implement → PASS. Manual check: `npm run dev`, log in as each seed user, nav matches the table; wrong password shows generic error.
- [ ] **Step 5:** Commit.

### Task 3: Intake commands, correlation, classification, Tier 1 (B)

**Files:** Create `src/server/commands/declare-incident.ts`, `src/server/commands/ingest-event.ts`, `src/server/cases/classify.ts`, `src/domain/board-text.ts`, `tests/unit/board-text.test.ts`, `tests/integration/intake.test.ts`

**Interfaces:**
- Consumes: `EVENT_PAYLOAD_SCHEMAS`, `deriveFacts`, `evaluate`, `loadRulePack`, `runCommand`, `appendEntry` via `ctx.log`.
- `declareIncident` input `{ description: string; relatedReference?: string }` → creates/attaches like ingest with kind `manual_declaration`, `source: "manual"`, `declared_by = actor.id`; returns `{ receiptId: string }` only (never the case id/ref — F11, US-04).
- `ingestEvent` input `{ kind: EventKind; occurredAt: string (ISO); correlationKey: string; payload: unknown }` (payload parsed by the kind's schema).
- Correlation: find case with same `correlation_key` and status in (`open`,`auto_closed`); none → create (`ref` = `CASE-` + zero-padded count+1, `detected_at = occurredAt`), append `CASE_CREATED`; `auto_closed` match → status `open`, append `CASE_REOPENED`. Declaration with no `relatedReference` uses `correlationKey = "decl:" + receiptId`.
- `classifyCase(ctx: CommandCtx, caseId: string): Promise<{ tier: Tier; firedRuleIds: string[]; becameHigh: boolean }>` — derive facts from all case events (+ open flag), evaluate, insert `rule_evaluations`, `tier = max(old,new)`, append `CASE_CLASSIFIED`. If became HIGH: set `high_since = now`, insert Tier 1 `board_items` (`reason_key: "tier1"`, body = `tier1Body(...)`), append `TIER1_CREATED`. If LOW and status `open`: set `auto_closed`.
- `tier1Body(input: { ref: string; source: string; firedRuleIds: string[]; dataCategories: string[]; detectedAt: string }): string` — deterministic text ending with `Read-only notice — no action required.`
- [ ] **Step 1: Failing tests:**
  - `US-03: ingested bounty report is stored and appears in the ledger`
  - `US-04: declaration creates case with source manual and declarant recorded; returns receipt only`
  - `US-05: download alert and payment request with same key attach to one case`
  - `US-05: different keys create two cases`
  - `US-06: blocked login only → LOW and auto_closed`
  - `tier only rises: HIGH case receiving a benign event stays HIGH`
  - `auto_closed LOW case reopened and raised to HIGH by a later payment event`
  - `US-16: case becoming HIGH creates exactly one Tier 1 in the same transaction`
  - `ingestEvent refused for SA (simulator is DEMO-only)`
  - `payload failing its kind schema → ValidationError, nothing written`
- [ ] **Steps 2–5:** FAIL → implement → PASS → commit.

### Task 4: Demo mode gate and demo panel (A)

**Files:** Create `src/server/demo.ts`, `src/server/demo/replay-presets.ts`, `src/server/commands/advance-clock.ts`, `src/app/(app)/demo/page.tsx`, `src/app/(app)/demo/actions.ts`, `tests/integration/demo-mode.test.ts`

**Interfaces:**
- `assertDemoMode(): void` throws `NotFound` unless `process.env.DEMO_MODE === "true"`; called first in every demo command and the demo page.
- `REPLAY_PRESETS` (all `correlationKey: "REPLAY-2016"`, synthetic): `declaration` (EMP, description: "External party emailed a security lead's personal address claiming to hold rider/driver data and demanding payment."), `cloudDownloadAlert` (`resource "s3://synthetic-backup-bucket"`, `records 57000000`, `containsPersonalData true`, `affectedJurisdictions ["US","EU","SG"]`), `bountyReport` (`reporterHandle "anon-reporter-01"`, `amountCents 10000000`, `payeeVerified false`, `label "bug bounty"`, text containing `pay us`), `paymentRequest` (`amountCents 10000000`, `payee "anon-reporter-01"`, `payeeVerified false`, `label "bug bounty"`, `linkedToIncident true`), `regulatorInquiry` (`regulator "FTC"`, `open true`), `lowRiskLogin` (`blocked_login`, key `LOW-1`).
  Note: the 57M record figure is the publicly reported scale — cite it in the report or replace with a round synthetic number; never real records.
- `advanceClock` input `{ hours: int 1..168 }` → `demo_settings.offset_ms += hours*3600000`, append `CLOCK_ADVANCED`.
- Demo page: buttons per preset (fires `ingestEvent`/`declareIncident` as the demo actor; declaration preset runs as the seeded EMP user server-side, labelled so), "Advance +24h", "Reset demo" (confirm dialog), current offset, mode indicator.
- [ ] **Step 1: Failing tests:** `DEMO_MODE=false: demo actions throw NotFound, demo client never constructed` (spy on `getDemoDb`); `US-03: DEMO_MODE=false simulator unreachable`; `advanceClock moves getNow by N hours and is logged`.
- [ ] **Steps 2–5:** FAIL → implement → PASS → commit.

### Task 5: Report page (EMP), case list, case detail (B)

**Files:** Create `src/app/(app)/report/page.tsx` + `actions.ts`, `src/app/(app)/cases/page.tsx`, `src/app/(app)/cases/[id]/page.tsx`, `src/server/queries/cases.ts`, `tests/integration/case-queries.test.ts`

**Interfaces:**
- `listCases(actor: Actor): Promise<CaseListItem[]>` (`{id, ref, tier, status, source, detectedAt, firedRuleIds, hasOpenFlag}`); `getCaseDetail(actor: Actor, id: string): Promise<CaseDetail>` (`{…CaseListItem, events[], evaluations[], tier1?: {body, createdAt}}`); both call `authorize` (`viewCases` / `viewCase`).
- Report page: description + optional related reference; on submit shows "Thank you — receipt <id>. The case is now with the incident governance process." and nothing else. Also links to the challenge-flag form (added P4).
- Case detail (S5 skeleton): header (ref, tier badge, status), events timeline, fired rules with descriptions from the rule pack, Tier 1 notice text. Gate/summary/clocks added in P3.
- [ ] **Step 1: Failing tests:** `US-01: EMP cannot list cases` (Forbidden); `case detail includes fired rule ids and Tier 1 body`.
- [ ] **Steps 2–5:** FAIL → implement → PASS → commit.

### Task 6: Playwright harness + replay steps 1–3 (B)

**Files:** Create `playwright.config.ts`, `tests/e2e/fixtures.ts`, `tests/e2e/replay.spec.ts`, `scripts/e2e-db.ts`; Modify `package.json` (`e2e`), `.github/workflows/ci.yml` (job `e2e`, needs Postgres service; human review)

**Interfaces:**
- `fixtures.ts`: `loginAs(page, key: keyof typeof SEED_USERS)`; `resetDemo(page)` (logs in as demo, clicks reset).
- Config: `webServer: { command: "npm run build && npm run start", port: 3000 }`, env `DEMO_MODE=true`, DB = `grc_test`, migrations + seed in `globalSetup`; Chromium only; `retries: 0` locally, `1` in CI; trace on first retry.
- `replay.spec.ts` tests (one `test.describe.serial`):
  - `Step 1 (F11): employee declares out-of-band demand; sees receipt only`
  - `Step 2 (F12, F3): alert + bounty + payment merge into the declared case` (demo fires presets; SA sees one case `CASE-0001` with 4 events)
  - `Step 3 (F3–F5, F8): case is HIGH with R-PII, R-PAY-LINKED, R-PAYEE, R-CAP, R-EXTORT and a Tier 1 notice exists`
  - `Scenario C: low-risk login auto-logged as LOW`
- [ ] **Step 1:** Write specs → run `npm run e2e` → FAIL where UI is missing; fix selectors using roles/labels (no CSS selectors).
- [ ] **Step 2:** PASS locally; push; CI `e2e` green.
- [ ] **Step 3:** Commit; `/handover`.

## P2 Gate
`npm test`, `npm run test:int`, `npm run e2e -- replay.spec.ts` (steps 1–3 + scenario C) green locally and in CI.
