---
name: ledger-change
description: Use before changing anything in src/server/ledger, run-command.ts, canonical-json.ts, hash.ts or ledger migrations. Lists the ledger invariants and required tests.
---

# Ledger change

Ponytail OFF for these paths. Owner: A (Darius). Migrations are written by the owner only.

Invariants (spec §5):
- Entry hash = `sha256_hex(canonicalJson({seq, prevHash, ts, actorId, eventType, payload}))`.
- Canonical JSON: keys sorted by UTF-16 code unit, no whitespace; floats, `undefined`, `NaN`, dates, bigint rejected. Amounts are integer cents.
- `ts` stored as ISO text exactly as hashed (never `timestamptz`).
- Genesis: seq 1, `prevHash` = 64 zeros, event `GENESIS`.
- Append happens only inside the `runCommand()` transaction that locks `ledger_head` (`FOR UPDATE`). No other code writes the ledger.
- `app_rw` has no UPDATE/DELETE/TRUNCATE on `ledger_entries`; trigger `ledger_entries_append_only` stays.
- Verify walks seq ascending and checks hash, prevHash and contiguity.

Required tests before claiming done: canonical JSON round trip (unicode, key order), hash survives jsonb round trip, concurrent appends do not fork, role/trigger tests, tamper detected by verify, reset after concurrent appends verifies OK.

Run `npm test` and `npm run test:int`; paste the real output in the PR.
