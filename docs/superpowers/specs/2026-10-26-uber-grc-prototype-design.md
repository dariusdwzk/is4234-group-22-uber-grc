# Uber 2016 GRC Prototype — Design Spec

Date: 2026-10-26 · Status: **approved in chat (approach A, sections 1–4), awaiting review of this file** · Owner: Darius
Inputs: `docs/handoff/00-CONTEXT.md` (case, F1–F12, MVP, scenarios), `docs/handoff/01-Build-Setup-Plan.md` (stack, process, security rules), `docs/handoff/02-Spec-Starter.md` (US-01…US-27), course spec PDF.

## 1. Intent and success criteria

**Goal.** A hosted demonstrator in which Uber's Nov 2016 cover-up is replayed and blocked by governance technology: security recommends but cannot decide, two independent legal/compliance keys are needed, the board hears automatically, and a hash-chained ledger proves what happened.

**Who it is for.** Course markers (presentation demo, hosted link with test accounts, guide, video) and the team (must explain every module in Q&A).

**Success =**
1. Replay steps 1–8 and scenarios A–F run end to end on the hosted URL, proven by the Playwright suite.
2. Every Must story in `02-Spec-Starter.md` has its acceptance criteria as named tests (`US-xx: …`).
3. Every state change produces a ledger entry, and `verify` detects a tamper at the exact entry.
4. Feature freeze Fri 6 Nov with `v1.0-freeze` tagged and the production smoke check passing.

**Out of scope.** Real integrations, real filings, the 2022 breach, blockchain, multi-tenant hardening, AWS, any LLM in the product.

## 2. Decisions (26 Oct, Darius)

| Topic | Decision |
|---|---|
| Plan | `01-Build-Setup-Plan.md` approved as written |
| ORM | Drizzle (`drizzle-orm/node-postgres` + `pg`; `drizzle-kit` for SQL migrations) |
| Repo | Private, owned by Darius; Darius owns the Vercel project |
| Coders | 2 — A = Darius, B = teammate (split in §11) |
| Decision outcomes | `notify_now`, `notify_later` (requires date), `withhold` — each needs both keys |
| Independence | `reports_to` chain; approver rejected if the CISO is anywhere in the chain |
| Internal SLAs (illustrative) | classify within 24 h, decide within 72 h; Tier 2 escalation at 75 % elapsed |
| Regime clocks (illustrative, wording verified before release) | SEC Item 1.05, GDPR Art. 33, Singapore PDPA |
| Login | One synthetic account per role, password, server session |
| Demo time | Demo-mode clock offset ("advance +N h"), logged to the ledger |
| Stretch | Optional phase P4.5, starts only if P4 is green by Tue 3 Nov |
| Architecture | Approach A: relational state + ledger append in the same transaction |
| Password hash | Node `crypto.scrypt` (stdlib), not argon2 — no native dependency |

## 3. Architecture

One Next.js (App Router, TypeScript strict) application on Vercel, Postgres on Neon.

```
src/
  domain/            pure TS, no I/O — unit-tested
    canonical-json.ts  hash.ts  rules.ts  facts.ts  gate.ts
    independence.ts  clocks.ts  conflicts.ts  board-text.ts  types.ts
  server/            runs only on the server ("server-only")
    db/              schema.ts, client.ts (app_rw pool), demo-client.ts (demo_admin pool)
    ledger/          append.ts, verify.ts, export-head.ts
    auth/            password.ts, session.ts, actor.ts
    authz.ts         role × action table, deny by default
    clock.ts         real clock + demo offset
    run-command.ts   the single mutation pipeline
    commands/        one file per command (list in §6)
    queries/         read models for pages (authorised too)
  app/               pages S1–S8, server actions call commands only
rule-packs/v1.json   rule pack data, owned by GC
drizzle/             SQL migrations (owner: A)
tests/               unit/, integration/, e2e/
```

**The pipeline** (`run-command.ts`) — every mutation goes through it; no other code writes to the DB:

1. `zod.parse(input)` → 400-style error on failure (not logged; no actor action happened).
2. `authorize(actor, action, resource)` → on refusal: append a `REFUSED` ledger entry (own transaction), then throw `Forbidden`.
3. `BEGIN` → `SELECT … FROM ledger_head FOR UPDATE` → run escalation sweep (§8) → domain logic → write state → append one or more ledger entries → `COMMIT`.
4. Any error rolls back state and ledger together.

Locking the single `ledger_head` row serialises all writers, so the chain cannot fork. Throughput is irrelevant at demo scale.

**Clock.** `now()` = system time + `demo_settings.offset_ms` (offset only honoured when `DEMO_MODE=true`). Domain functions take `now` as a parameter, never call `Date.now()`.

## 4. Data model (Drizzle, Postgres)

| Table | Key columns / constraints |
|---|---|
| `users` | id, email (unique), display_name, role (`SA, CISO, GC, PCO, IA, ACC, EMP, EXEC, DEMO`), reports_to → users.id, password_hash, failed_logins, locked_until |
| `sessions` | token_sha256 (PK), user_id, expires_at |
| `cases` | id, ref (`CASE-0001`), correlation_key, source (`manual`, `simulator`), tier (`LOW`, `HIGH`), status (`open`, `auto_closed`, `closed`), detected_at, high_since, materiality_determined_at, declared_by, outcome, notify_by, closed_at |
| `intake_events` | id, case_id, kind (`bounty_report`, `payment_request`, `cloud_download_alert`, `manual_declaration`, `regulator_inquiry`, `blocked_login`), occurred_at, payload jsonb (Zod-typed per kind) |
| `rule_evaluations` | id, case_id, rule_pack_version, fired_rule_ids text[], tier, evaluated_at |
| `recommendations` | id, case_id, author_id, proposed_outcome, data_taken (`yes`, `no`, `unknown`), treat_as (`incident`, `bug_bounty`), text |
| `decisions` | id, case_id, approver_id, approver_role, outcome, notify_by, reason_code, checklist jsonb; unique (case_id, approver_role) — re-deciding replaces the row and appends a new ledger entry |
| `board_items` | id, case_id, tier (1, 2), reason_key, body (generated), status (`open`, `acknowledged`), ack_note, ack_by, ack_at; **unique (case_id, reason_key)** = exactly-once escalation |
| `challenge_flags` | id, case_id, raised_by, text, status (`open`, `resolved`), resolved_by, resolution |
| `rule_packs` | version (PK), body jsonb, published_by, published_at |
| `ledger_entries` | seq bigint PK, ts_iso text, actor_id, event_type, payload jsonb, prev_hash char(64), hash char(64) |
| `ledger_head` | single row (id = 1): seq, hash |
| `head_exports` | id, seq, hash, entry_count, exported_at, destination (`simulated_auditor_inbox`) |
| `demo_settings` | single row: offset_ms |

**Tier is monotonic.** Re-evaluation sets `tier = max(old, new)`; no command downgrades a case. "Cannot downgrade" is structural, not a UI rule.

**Low cases** are set `auto_closed` at classification. Correlation matches `open` and `auto_closed` cases; a new event on an auto-closed case reopens it and re-evaluates.

## 5. Ledger

- **Entry hash** = `sha256_hex(canonicalJson({seq, prevHash, ts, actorId, eventType, payload}))`.
- **Canonical JSON**: object keys sorted by UTF-16 code unit, no whitespace, only strings, safe integers, booleans, null, arrays, plain objects; floats, `undefined`, `NaN`, dates and bigint are rejected with an error (amounts are stored as integer cents).
- **`ts` is stored as ISO text** exactly as hashed. Postgres `timestamptz` has microsecond precision and would change the value on round trip.
- **Genesis**: seq 1, `prevHash` = 64 × `0`, event `GENESIS`, payload `{rulePackVersion}`.
- **Verify** walks seq ascending: recompute hash, check `prevHash` = previous hash, check seq contiguous. Returns `{ok:true, count, headHash}` or `{ok:false, failedAtSeq, reason}`. It also compares the live head with the latest `head_exports` row and reports divergence.
- **DB roles** (migration creates them; passwords set by the human in Neon/console, never in the repo):
  - owner — migrations only, URL never deployed to Vercel.
  - `app_rw` — SELECT/INSERT on all app tables, UPDATE on mutable state tables, **no UPDATE/DELETE/TRUNCATE on `ledger_entries`**.
  - `demo_admin` — UPDATE and TRUNCATE on `ledger_entries` plus reset rights; its URL is read only when `DEMO_MODE=true`.
  - Trigger `ledger_entries_append_only` raises on UPDATE/DELETE unless `current_user = 'demo_admin'` (defence in depth; also blocks the owner).
- **Tamper (demo)** changes `payload` of entry N via `demo_admin`, without recomputing the hash. It is itself announced in the UI as a demo action but deliberately *not* chained (that is the point).
- **Reset (demo)** exports the current head to `head_exports` first, then truncates state and ledger, seeds, writes genesis.
- **Export head** (US-23, MVP part): manual button for ACC/IA writes `head_exports` and shows it on the dashboard; labelled "simulated external auditor inbox".

## 6. Commands and authorisation

Deny by default. `authz.ts` is one table; tests assert at least one forbidden role per command.

| Command | Allowed | Notes / ledger event |
|---|---|---|
| `login` / `logout` | anyone | `LOGIN_OK` / `LOGIN_FAILED` (no password in payload) |
| `declareIncident` | EMP, SA, CISO, GC, PCO | creates case `source=manual`; declarant gets a confirmation only (F11) |
| `ingestEvent` | DEMO (simulator) | correlates by `correlation_key`, re-evaluates rules |
| `recordRecommendation` | SA, CISO | F1: recommend only |
| `closeCase` | nobody for HIGH | A HIGH case closes only inside `submitDecision` when both keys agree. `closeCase` exists so the attempt (SA/CISO/anyone) is refused with the missing approvals listed and `REFUSED` logged (US-11) |
| `recordMateriality` | GC | starts SEC clock |
| `submitDecision` | GC, PCO | independence (CISO not in chain; approver_id differs from the other decision's approver) + complete checklist + reason code; agreement → case closed with that outcome; disagreement → Tier 2 |
| `raiseFlag` | any signed-in user | always creates Tier 2 (F6) |
| `resolveFlag` | ACC, IA | case owner/SA/CISO cannot (US-18) |
| `acknowledgeTier2` | ACC | requires action note |
| `exportHead` | ACC, IA | §5 |
| `verifyLedger` | IA, ACC, DEMO (read, not a mutation; result shown, not chained) | |
| `publishRulePack` | GC | Should (US-09); P3 if time |
| `advanceClock`, `resetDemo`, `tamperEntry` | DEMO, only when `DEMO_MODE=true` (404 otherwise) | |

**Read access.** EMP sees only own declarations' confirmations and the flag form. SA/CISO/GC/PCO/IA see cases. ACC sees board, dashboard, ledger. Every page query calls `authorize` too.

## 7. Rules engine

- `facts.ts` derives typed facts from a case's events: `personalDataAccessed`, `paymentLinkedToIncident`, `payeeVerified`, `amountCents`, `programmeMaxCents`, `extortionLanguage`, `regulatorInquiryOpen`, `legalDeadlineTriggered`, `openChallengeFlag`.
- Rule pack format (Zod-validated): `{version, owner:"GC", programmeMaxCents, extortionTerms[], slas{classifyH, decideH, escalateAtPct}, clocks[], rules:[{id, description, when:{fact, op, value?}, tier:"HIGH"}]}`; ops: `isTrue`, `isFalse`, `gt`, `gtFact`, `containsAny`.
- v1 rules: `R-PII`, `R-PAY-LINKED` (label ignored — F3), `R-PAYEE` (F4), `R-CAP` (F5), `R-EXTORT`, `R-REGULATOR` (F7), `R-DEADLINE`, `R-FLAG`. Any fired rule → HIGH; none → LOW.
- `evaluate(pack, facts) → {tier, firedRuleIds}` is pure; one table-driven test row per rule plus the "bug bounty label does not downgrade" row.

## 8. Clocks, escalation, board

- **Internal SLAs**: classify by `detected_at + 24h`; decide by `high_since + 72h`.
- **Regime clocks (illustrative; text verified against primary sources in P3 before display)**:
  - SEC Item 1.05 — 4 business days from `materiality_determined_at` (shows "not started — materiality not yet determined, X days since detection" until GC records it).
  - GDPR Art. 33 — 72 h from awareness (`detected_at`).
  - Singapore PDPA — 3 calendar days from assessment that the breach is notifiable (proxy: `high_since`).
- **Escalation sweep** runs inside every command transaction and on dashboard load (as system actor): for each open HIGH case without an agreed decision, any clock ≥ 75 % → insert Tier 2 with `reason_key = clock:<id>`; the unique constraint makes it exactly once (US-19). No cron needed (Vercel Hobby cron is daily only).
- **Tier 1** is created in the same transaction that makes a case HIGH; body from `board-text.ts`: case ref, source, fired rules, data categories, clocks, "read-only — no action required". No command edits it.
- **Tier 2** reasons: `disagreement`, `flag:<id>`, `clock:<id>`. ACC acknowledges with a note; unacknowledged items stay on the dashboard.
- **Dashboard KPI**: "detection → board notice" for each case (Tier 1 time − `detected_at`) shown beside "Uber 2016: detection → public disclosure 371 days; no board involvement appears in the record".
- **Conflict banner** (`conflicts.ts`): recommendation `data_taken = no` while `personalDataAccessed`; `treat_as = bug_bounty` while `R-PAY-LINKED` fired.

## 9. Security

- Passwords: `crypto.scrypt` (N=2^15, r=8, p=1, 16-byte salt), `timingSafeEqual`; demo password from `DEMO_PASSWORD` env at seed time only.
- Sessions: 32 random bytes, cookie `__Host-session` httpOnly Secure SameSite=Lax, DB stores SHA-256 only, 8 h expiry, deleted on logout.
- Login throttle: 5 failures → lock 15 min per account; generic error message.
- Server Actions rely on Next.js Origin check; no custom API mutations.
- Headers via `next.config`: CSP (self only), `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`.
- `import "server-only"` on all `src/server/**`. No secrets in `NEXT_PUBLIC_*`.
- Every UI page shows a "Demonstration — synthetic data" banner.
- Hosted demonstrator runs with `DEMO_MODE=true` (markers need reset/tamper); the guide lists this as a limitation.

## 10. Testing and verification

| Layer | Tool | What |
|---|---|---|
| Unit | Vitest | canonical JSON (key order, rejects floats), hash vectors, every rule, gate truth table, independence (chain, cycle), clocks (business days, fixed clock), conflicts, board text |
| Integration | Vitest + Postgres 16 (Docker locally, service container in CI) | append/verify; tamper at N fails at N; 20 concurrent appends → contiguous seq, verify OK; `app_rw` UPDATE on ledger refused; trigger blocks owner; each command refused for a forbidden role and `REFUSED` logged; escalation exactly once |
| E2E | Playwright against `next start` + seeded DB | `replay.spec.ts` steps 1–8; `scenario-b…f.spec.ts` |
| Smoke | script | `GET /api/health` and `GET /api/ledger/verify` on the deployed URL |

Test names start with the story ID, e.g. `US-13: approver reporting to CISO is refused`.

## 11. Phases and team split (detail in `plans/pending/`)

| Phase | Dates | A (Darius) | B (teammate) | Gate (must pass to advance) |
|---|---|---|---|---|
| P0 | 26–27 Oct | scaffold, CI, hooks, `.claude/`, Docker DB, Vercel+Neon hello | read spec, set up machine | clean-install lint/typecheck/test/build; hook blocks fake secret; prod `/api/health` OK |
| P1 | 27–29 Oct | schema, roles, ledger append/verify/tamper/export, run-command, auth | `domain/rules.ts`, `facts.ts`, `rule-packs/v1.json` (pure, no DB) | integration ledger suite green; rule table tests green |
| P2 | 29 Oct–1 Nov | authz table, login UI, seed/reset, demo panel | intake commands, correlation, classification, Tier 1, case list/detail | e2e replay steps 1–3 |
| P3 | 1–3 Nov | gate, decisions, independence, close, decision summary | clocks, conflicts, materiality, escalation sweep | gate tests; e2e steps 4–5 |
| P4 | 3–5 Nov | ledger page, verify/tamper UI, export head | board dashboard, Tier 2 ack, flags, KPI | full replay + scenarios B–F e2e green on preview |
| P4.5 | only if P4 green by 3 Nov | stretch: IA sampling, evidence export | control self-test | own tests |
| P5 | 5–6 Nov | security review, reviewer agent, prod smoke, tag | screenshots to `docs/evidence/` | `demo-scenario-check` on production; `v1.0-freeze` |

## 12. Must verify before relying on it

- Neon: `CREATE ROLE … LOGIN PASSWORD` and `GRANT`/trigger via SQL from the owner role; pooled URL works with `SELECT … FOR UPDATE` inside a transaction (P0/P1).
- Vercel Hobby with a private repo on Darius's personal account (P0).
- GitHub Pro via student pack → enforceable rulesets on private repos (P0; else fallback recorded in `docs/ai/DECISIONS.md`).
- Exact SEC Item 1.05 / GDPR Art. 33 / PDPA s.26D wording before any clock text ships (P3).
- Third-party action SHAs looked up from releases pages, never from memory (P0).
- `enabledPlugins` key format (only if plugins are committed; default: none committed).
