# Handover

**Changed:** P1 complete in code. Drizzle schema + `0000` (generated) + `0001` (roles, grants, append-only trigger; Darius-reviewed). Canonical JSON, hash, pure verify; DB ledger append/verify/export-head/genesis; `authz.ts` POLICY; `runCommand`; scrypt passwords, sessions, login throttle, logout; rule pack v1, facts, `evaluate`; `/api/health` (db probe) and `/api/ledger/verify`; CI Postgres service + `test:int`; `docs/neon-setup.md`.
**Verified (local, Postgres 16):** lint, typecheck, 85 unit, 52 integration, build.
**Not verified:** CI run of the new `test:int` job; Neon (`CREATE ROLE`, `ALTER ROLE … PASSWORD`, `FOR UPDATE` via pooled URL, Postgres 18); preview `/api/health` `db:"ok"`.
**Next:** Darius runs `docs/neon-setup.md`, then P2 (`plans/pending/P2-intake-cases.md`): seeding must create `ledger_head` (writeGenesis does) and `demo_settings` rows.
**Blocked:** nothing.
**Decisions / deviations:** `containsAny` op omitted from rule-pack schema (no string fact exists); `viewLedger` includes IA; `demo_admin` also has DELETE on all tables; owner can still TRUNCATE; login returns a result (does not throw) so failures persist; `CommandCtx.log` takes optional `actorId`; `connection()` used in routes (cacheComponents is on).
**Gotchas:** integration suite TRUNCATEs the target DB, never point `TEST_DATABASE_URL_OWNER` at main. Tests are one-file-at-a-time. Several unit tests were written after the code.
