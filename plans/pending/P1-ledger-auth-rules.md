# P1 — Schema, Ledger, Command Pipeline, Auth (A) ∥ Rules Engine (B)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans + superpowers:test-driven-development. Global Constraints in `00-master-plan.md` apply. Spec §4, §5, §6, §7, §9. **Ponytail OFF** for Tasks 1–6.

**Goal:** A provably append-only, hash-chained ledger; one mutation pipeline that authorises and logs; password login with server sessions; a pure rules engine with rule pack v1.

**Architecture:** Drizzle schema + hand-written SQL migration for roles/grants/trigger; pure hashing/verify in `src/domain`; DB-facing ledger in `src/server/ledger`; `runCommand` wraps every write.

**Tech Stack additions (exact versions, ≥14 days old, intake check in PR):** `drizzle-orm`, `pg`, `zod`, `server-only`; dev: `drizzle-kit`, `@types/pg`, `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-26-uber-grc-prototype-design.md`

**Parallelism:** A does Tasks 1–6, 8. B does Task 7 (pure; needs only `src/domain/types.ts` from Task 1 Step 1 — A merges that first).

---

### Task 1: Types, Drizzle schema, migrations, DB roles, test harness (A)

**Files:**
- Create: `src/domain/types.ts`, `src/server/db/schema.ts`, `src/server/db/client.ts`, `src/server/db/demo-client.ts`, `drizzle.config.ts`, `drizzle/0000_*.sql` (generated), `drizzle/0001_roles_grants_trigger.sql` (hand-written, custom migration via `drizzle-kit generate --custom`), `tests/integration/setup/db.ts`, `tests/integration/setup/global-setup.ts`, `vitest.integration.config.ts`, `tests/integration/db-roles.test.ts`
- Modify: `package.json` scripts, `.github/workflows/ci.yml` (Postgres service + `npm run test:int`; human review — protected path)

**Interfaces:**
- Produces (`src/domain/types.ts`):
  - `type Role = "SA"|"CISO"|"GC"|"PCO"|"IA"|"ACC"|"EMP"|"EXEC"|"DEMO"`
  - `type Tier = "LOW"|"HIGH"`; `type CaseStatus = "open"|"auto_closed"|"closed"`; `type Outcome = "notify_now"|"notify_later"|"withhold"`
  - `type EventKind = "bounty_report"|"payment_request"|"cloud_download_alert"|"manual_declaration"|"regulator_inquiry"|"blocked_login"`
  - `type JsonValue = string|number|boolean|null|JsonValue[]|{[k:string]:JsonValue}`
  - `type Actor = { id: string; role: Role; displayName: string }`; `const SYSTEM_ACTOR: Actor = { id: "system", role: "EXEC", displayName: "System" }`
- Produces (`schema.ts`): Drizzle tables exactly as spec §4 with those column names (snake_case in SQL, camelCase in TS). `ledger_entries.seq` bigint PK (mode `number`), `ts_iso` text, `prev_hash`/`hash` `char(64)`. `ledger_head` single row id=1.
- Produces: `db` (app_rw pool from `DATABASE_URL`), `type Tx` (Drizzle transaction type), `getDemoDb()` (throws `NotFound` unless `process.env.DEMO_MODE === "true"`; lazily creates pool from `DEMO_ADMIN_DATABASE_URL`).
- Produces: scripts `db:generate`, `db:migrate` (uses `DATABASE_URL_OWNER`), `test:int`.
- Produces (test harness): `resetTestDb()` truncates all tables as owner and inserts `ledger_head (1, 0, '000…0')`; `appDb`, `ownerDb`, `demoDb` connected to `grc_test` with the three roles; test passwords for local Docker roles are set in `global-setup.ts` via `ALTER ROLE … PASSWORD` from env `TEST_ROLE_PASSWORD` (default `test-only-local`) — never used outside Docker/CI.

`0001_roles_grants_trigger.sql` must (idempotently, `DO $$ … IF NOT EXISTS … $$`):
1. `CREATE ROLE app_rw LOGIN; CREATE ROLE demo_admin LOGIN;` (no passwords in the file)
2. `GRANT USAGE ON SCHEMA public`, `GRANT SELECT, INSERT ON ALL TABLES` to app_rw; `GRANT UPDATE` to app_rw on mutable tables only (`users, sessions, cases, decisions, board_items, challenge_flags, ledger_head, demo_settings`); `GRANT DELETE ON sessions` to app_rw; sequences `USAGE`.
3. demo_admin: app_rw's grants + `UPDATE, TRUNCATE` on `ledger_entries` and `TRUNCATE` on all state tables.
4. Trigger function `ledger_entries_append_only()` raising `ledger is append-only` on UPDATE/DELETE when `current_user <> 'demo_admin'`; `BEFORE UPDATE OR DELETE … FOR EACH ROW`. (TRUNCATE is not a row trigger; only demo_admin holds TRUNCATE.)

- [ ] **Step 1:** Write `types.ts`; open PR #1 alone so B can start Task 7.
- [ ] **Step 2:** Write `schema.ts`, `drizzle.config.ts`; `npm run db:generate` → `0000_*.sql`. Read the generated SQL.
- [ ] **Step 3: Write failing tests** `tests/integration/db-roles.test.ts`:
  - `app_rw cannot UPDATE ledger_entries` → rejects with `permission denied`
  - `app_rw cannot DELETE ledger_entries` → rejects
  - `owner UPDATE ledger_entries blocked by trigger` → rejects with `append-only`
  - `demo_admin can UPDATE ledger_entries`
  - `app_rw can INSERT and SELECT ledger_entries`
- [ ] **Step 4:** Run `npm run test:int` → FAIL. **Step 5:** Write `0001`, harness, config. **Step 6:** Run → PASS.
- [ ] **Step 7:** CI: add `services.postgres` (image pinned by digest, health-checked) to `lint-typecheck-test`, run migrations as owner, then `npm run test:int`. Push → green.
- [ ] **Step 8:** Commit `feat(db): schema, append-only ledger roles and trigger`.

### Task 2: Canonical JSON (A)

**Files:** Create `src/domain/canonical-json.ts`, `tests/unit/canonical-json.test.ts`

**Interfaces:** Produces `canonicalJson(value: unknown): string` and `class CanonicalJsonError extends Error`.

- [ ] **Step 1: Failing tests:**

```ts
expect(canonicalJson({ b: 1, a: [true, null, "x"] })).toBe('{"a":[true,null,"x"],"b":1}');
expect(canonicalJson({ a: { d: 1, c: 2 } })).toBe(canonicalJson({ a: { c: 2, d: 1 } }));
expect(canonicalJson({ name: "Zoë" })).toBe('{"name":"Zoë"}');
for (const bad of [1.5, NaN, undefined, new Date(), 10n, () => 1, Number.MAX_SAFE_INTEGER + 1])
  expect(() => canonicalJson({ v: bad })).toThrow(CanonicalJsonError);
expect(() => canonicalJson(Object.create({ inherited: 1 }))).toThrow(CanonicalJsonError); // non-plain object
```
- [ ] **Step 2:** FAIL. **Step 3:** Implement: recursive; keys sorted with default `Array.prototype.sort()` (UTF-16 code units); strings via `JSON.stringify(s)`; integers must satisfy `Number.isSafeInteger`; plain objects only (`Object.getPrototypeOf(v) === Object.prototype || null`). **Step 4:** PASS. **Step 5:** Commit.

### Task 3: Entry hash and pure verify (A)

**Files:** Create `src/domain/hash.ts`, `src/domain/ledger-verify.ts`, `tests/unit/ledger-verify.test.ts`

**Interfaces:**
- Produces: `GENESIS_PREV_HASH = "0".repeat(64)`; `sha256Hex(s: string): string` (`node:crypto`); `type LedgerHashInput = { seq: number; prevHash: string; ts: string; actorId: string | null; eventType: string; payload: JsonValue }`; `entryHash(e: LedgerHashInput): string`.
- Produces: `type LedgerRow = LedgerHashInput & { hash: string }`; `type VerifyResult = { ok: true; count: number; headHash: string } | { ok: false; failedAtSeq: number; reason: "hash_mismatch" | "prev_link" | "seq_gap" }`; `verifyEntries(rows: LedgerRow[]): VerifyResult` (rows in seq order; empty → `{ok:true,count:0,headHash:GENESIS_PREV_HASH}`).

- [ ] **Step 1: Failing tests** (build a 5-entry chain with a helper):
  - `US-21: untouched chain verifies OK with count and head hash` → `{ok:true,count:5,headHash:rows[4].hash}`
  - `US-22: payload altered at entry 3 fails at 3` → `{ok:false,failedAtSeq:3,reason:"hash_mismatch"}`
  - `hash recomputed after edit still fails at next entry` → edit row 3 payload and recompute its hash → `failedAtSeq:4, reason:"prev_link"`
  - `deleted entry detected` → remove row 3 → `failedAtSeq:4, reason:"seq_gap"`
  - known vector: `entryHash({seq:1,prevHash:GENESIS_PREV_HASH,ts:"2026-10-27T00:00:00.000Z",actorId:null,eventType:"GENESIS",payload:{rulePackVersion:"v1"}})` equals the value computed once and pinned in the test (guards accidental format change).
- [ ] **Steps 2–5:** FAIL → implement → PASS → commit.

### Task 4: DB ledger append, verify, export head (A)

**Files:** Create `src/server/ledger/append.ts`, `src/server/ledger/verify.ts`, `src/server/ledger/export-head.ts`, `src/server/ledger/genesis.ts`, `tests/integration/ledger.test.ts`

**Interfaces:**
- Consumes: `entryHash`, `verifyEntries`, `Tx`, `db`.
- Produces:
  - `type LedgerEventType` = string union including `GENESIS, REFUSED, LOGIN_OK, LOGIN_FAILED, LOGOUT, INCIDENT_DECLARED, EVENT_INGESTED, CASE_CREATED, CASE_CLASSIFIED, CASE_REOPENED, TIER1_CREATED, TIER2_CREATED, TIER2_ACKNOWLEDGED, RECOMMENDATION_RECORDED, MATERIALITY_RECORDED, DECISION_SUBMITTED, CASE_CLOSED, FLAG_RAISED, FLAG_RESOLVED, HEAD_EXPORTED, RULE_PACK_PUBLISHED, CLOCK_ADVANCED, DEMO_RESET`
  - `appendEntry(tx: Tx, e: { actorId: string | null; eventType: LedgerEventType; payload: JsonValue; ts: string }): Promise<{ seq: number; hash: string }>` — `SELECT seq, hash FROM ledger_head WHERE id=1 FOR UPDATE`, compute, insert, update head. Safe to call several times in one tx.
  - `verifyChain(client = db): Promise<VerifyResult & { exportedHead?: { seq: number; hash: string; matches: boolean } }>` — streams rows in seq order (batches of 1000) into `verifyEntries`; compares latest `head_exports` row with the entry at that seq.
  - `exportHead(tx: Tx, actorId: string, ts: string): Promise<{ seq: number; hash: string; entryCount: number }>` — writes `head_exports` and appends `HEAD_EXPORTED`.
  - `writeGenesis(tx: Tx, ts: string, rulePackVersion: string): Promise<void>`.
- [ ] **Step 1: Failing tests:**
  - `US-20: append writes contiguous seq and links prev hash`
  - `US-20: two events at the same moment do not fork` → `await Promise.all(Array.from({length:20}, (_,i)=> db.transaction(tx => appendEntry(tx,{…i…}))))` → seqs are exactly 1..20 (plus genesis), `verifyChain()` ok
  - `hash survives jsonb round trip` → payload `{z:"Zoë", a:{y:1,b:2}}`; read back; `verifyChain().ok === true`
  - `US-22: tamper via demo_admin then verify fails at that seq`
  - `rolled back transaction leaves no entry and head unchanged`
  - `export head then append more → exportedHead.matches true; tamper that seq → matches false`
- [ ] **Steps 2–5:** FAIL → implement → PASS (`npm run test:int`) → commit.

### Task 5: Clock, authz table, runCommand (A)

**Files:** Create `src/server/clock.ts`, `src/server/authz.ts`, `src/server/errors.ts`, `src/server/run-command.ts`, `tests/unit/authz.test.ts`, `tests/integration/run-command.test.ts`

**Interfaces:**
- Produces `errors.ts`: `class Forbidden extends Error { reason: string }`, `class NotFound`, `class ValidationError { issues }`, `class Conflict`.
- Produces `clock.ts`: `getNow(client = db): Promise<Date>` = `Date.now()` + `demo_settings.offset_ms` when `DEMO_MODE==="true"`, else `Date.now()`.
- Produces `authz.ts`: `type Action` = union of every command name in spec §6 plus read actions `viewCases, viewCase, viewBoard, viewLedger, viewDemo`; `POLICY: Readonly<Record<Action, readonly Role[]>>` (values exactly spec §6; `closeCase: []`); `authorize(actor: Actor | null, action: Action): { ok: true } | { ok: false; reason: string }` — null actor → `not signed in`; role absent → `role <ROLE> may not <action>`.
- Produces `run-command.ts`:
```ts
type CommandCtx = { tx: Tx; actor: Actor; now: Date; nowIso: string;
  log: (eventType: LedgerEventType, payload: JsonValue) => Promise<void> };
type CommandDef<I, O> = { action: Action; schema: z.ZodType<I>;
  handler: (ctx: CommandCtx, input: I) => Promise<O> };
function runCommand<I, O>(def: CommandDef<I, O>, actor: Actor | null, raw: unknown): Promise<O>;
```
  Order: parse (→ `ValidationError`, nothing logged) → authorize (refusal: own tx appends `REFUSED {action, reason, actorRole}`, then throw `Forbidden`) → `db.transaction`: `getNow`, call `sweepEscalations(ctx)` **hook point** (no-op stub exported from `src/server/escalation.ts`, filled in P3 Task 6), handler. If the handler throws `Forbidden` (business-rule refusal, e.g. not independent), the tx rolls back and the same `REFUSED` logger runs in its own tx, then rethrows.
- [ ] **Step 1: Failing tests:** unit: every Action has an entry; `authorize(null, x)` denied; `closeCase` denied for all roles; `approve`-type actions (`submitDecision`) denied for SA and CISO. Integration: `US-01: refused command writes REFUSED entry and throws Forbidden`; `Forbidden thrown inside handler rolls back state but persists REFUSED`; `handler error rolls back state and ledger`; `invalid input throws ValidationError and logs nothing`.
- [ ] **Steps 2–5:** FAIL → implement → PASS → commit.

### Task 6: Passwords, sessions, login throttle, getActor (A)

**Files:** Create `src/server/auth/password.ts`, `src/server/auth/session.ts`, `src/server/auth/actor.ts`, `src/server/commands/login.ts`, `src/server/commands/logout.ts`, `tests/unit/password.test.ts`, `tests/integration/auth.test.ts`

**Interfaces:**
- `hashPassword(pw: string): Promise<string>` → `scrypt$32768$8$1$<saltB64>$<hashB64>`; `verifyPassword(pw: string, stored: string): Promise<boolean>` (`timingSafeEqual`; malformed stored → false). `maxmem` set high enough for N=2^15.
- `createSession(tx: Tx, userId: string, now: Date): Promise<string>` (returns raw token; stores `sha256Hex(token)`, expires +8 h); `deleteSession(tx, token)`; `actorFromToken(token: string | undefined, now: Date): Promise<Actor | null>`.
- `getActor(): Promise<Actor | null>` reads cookie `__Host-session` via `next/headers`.
- `login` command (`authorize` returns ok for action `login` regardless of actor — the only such action; `POLICY.login` lists every Role for completeness): input `{ email, password }`; 5 failures → `locked_until = now + 15 min`; always generic `Invalid email or password`; ledger `LOGIN_FAILED {email}` / `LOGIN_OK {userId}` — never the password. Sets cookie `httpOnly, secure, sameSite:"lax", path:"/"`.
- [ ] **Step 1: Failing tests:** `hash/verify round trip`; `wrong password false`; `malformed stored false`; `expired session returns null actor`; `unknown token returns null actor`; `6th attempt within 15 min is locked even with right password`; `login ledger payload has no password field` (`JSON.stringify(payload)` does not contain the password).
- [ ] **Steps 2–5:** FAIL → implement → PASS → commit.

### Task 7: Rule pack v1, facts, evaluate (B)

**Files:** Create `src/domain/rule-pack.ts`, `src/domain/facts.ts`, `src/domain/rules.ts`, `src/domain/event-payloads.ts`, `rule-packs/v1.json`, `tests/unit/rules.test.ts`, `tests/unit/facts.test.ts`

**Interfaces:**
- `event-payloads.ts`: Zod schema per `EventKind` (exported as `EVENT_PAYLOAD_SCHEMAS: Record<EventKind, z.ZodType>`):
  - `bounty_report {reporterHandle: string, amountCents: int≥0, payeeVerified: boolean, label: string, text: string}`
  - `payment_request {amountCents: int≥0, payee: string, payeeVerified: boolean, label: string, linkedToIncident: boolean}`
  - `cloud_download_alert {resource: string, records: int≥0, containsPersonalData: boolean, affectedJurisdictions: string[]}`
  - `manual_declaration {description: string (1..2000), relatedReference?: string}`
  - `regulator_inquiry {regulator: string, open: boolean}`
  - `blocked_login {account: string}`
- `rule-pack.ts`: `RulePackSchema` per spec §7; `type RulePack = z.infer<…>`; `loadRulePack(version: "v1"): RulePack` (imports JSON, parses).
- `facts.ts`: `type CaseFacts = { personalDataAccessed: boolean; paymentLinkedToIncident: boolean; payeeVerified: boolean; amountCents: number; programmeMaxCents: number; extortionLanguage: boolean; regulatorInquiryOpen: boolean; legalDeadlineTriggered: boolean; openChallengeFlag: boolean }`; `deriveFacts(events: { kind: EventKind; payload: unknown }[], ctx: { pack: RulePack; openChallengeFlag: boolean }): CaseFacts`. `payeeVerified` = false if any payment/bounty has `payeeVerified:false` (default true when none). `amountCents` = max over payments/bounties. `extortionLanguage` = any bounty/declaration text contains a `pack.extortionTerms` entry, case-insensitive. `legalDeadlineTriggered` = any cloud alert with `containsPersonalData && affectedJurisdictions.length > 0`. `paymentLinkedToIncident` = any payment with `linkedToIncident`, **regardless of `label`**.
- `rules.ts`: `evaluate(pack: RulePack, facts: CaseFacts): { tier: Tier; firedRuleIds: string[] }` (fired in pack order).
- `v1.json`: `version "v1"`, `owner "GC"`, `programmeMaxCents 1000000` (illustrative $10,000), `extortionTerms ["pay us","unless you pay","we will release","ransom"]`, `slas {classifyH:24, decideH:72, escalateAtPct:75}`, `clocks` (ids `SEC_1_05`, `GDPR_33`, `PDPA_26D`, `INT_CLASSIFY`, `INT_DECIDE`; labels marked "illustrative"), rules: `R-PII personalDataAccessed isTrue`, `R-PAY-LINKED paymentLinkedToIncident isTrue`, `R-PAYEE payeeVerified isFalse`, `R-CAP amountCents gtFact programmeMaxCents`, `R-EXTORT extortionLanguage isTrue`, `R-REGULATOR regulatorInquiryOpen isTrue`, `R-DEADLINE legalDeadlineTriggered isTrue`, `R-FLAG openChallengeFlag isTrue`.
- [ ] **Step 1: Failing table test** — one row per rule (only that fact set → `{tier:"HIGH", firedRuleIds:[id]}`), plus:
  - `US-06: blocked login only → LOW, no rules`
  - `US-07: payment labelled "bug bounty" linked to incident → HIGH with R-PAY-LINKED`
  - `US-08: replay facts → HIGH with R-PII, R-PAY-LINKED, R-PAYEE, R-CAP, R-EXTORT` (amount 10_000_000 cents, payee unverified)
  - `v1.json parses with RulePackSchema`; `unknown fact name in a rule fails schema`
- [ ] **Steps 2–5:** FAIL → implement → PASS → commit (`feat(rules): rule pack v1 and evaluator`).

### Task 8: Health with DB, verify endpoint, Neon roles (A + Darius)

**Files:** Modify `src/app/api/health/route.ts`, `tests/unit/health.test.ts` → move to `tests/integration/health.test.ts`; Create `src/app/api/ledger/verify/route.ts`, `docs/neon-setup.md`

- [ ] **Step 1: Failing tests:** `health ok when DB reachable` → `{status:"ok", db:"ok"}`; `verify route returns {ok:true,count,headHash}` (no auth needed; read-only, exposes only hashes and counts).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5 (Darius, outside chat):** On Neon main and `preview` branches: run `npm run db:migrate` with `DATABASE_URL_OWNER` in `.env.local`; in Neon SQL editor `ALTER ROLE app_rw PASSWORD '<generated>'; ALTER ROLE demo_admin PASSWORD '<generated>';` (verify Neon permits this from the owner role — record result in `docs/neon-setup.md`); put pooled `app_rw` URL into Vercel `DATABASE_URL`, `demo_admin` URL into `DEMO_ADMIN_DATABASE_URL`.
- [ ] **Step 6: Verify on preview:** `/api/health` → `db:"ok"`; run the `db-roles` integration tests once against the Neon `preview` branch (`TEST_DATABASE_URL_OWNER` pointing there) → green. Record in `DECISIONS.md` that `SELECT … FOR UPDATE` works through the pooled URL (the concurrency test proves it).
- [ ] **Step 7:** Commit; `/handover`.

## P1 Gate
`npm test` and `npm run test:int` green locally and in CI (incl. 20-way concurrency, tamper-at-N, role denial); preview `/api/health` shows `db:"ok"`.
