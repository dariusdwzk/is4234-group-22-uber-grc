# Uber 2016 GRC prototype

Next.js (App Router, TS strict) + Drizzle/Postgres demonstrator: a decision gate, two independent keys, automatic board notice and a hash-chained ledger. Synthetic data only.

**Read first:** `docs/ai/HANDOVER.md`, then `docs/ai/PROGRESS.md`, the phase file in `plans/pending/`, and `docs/superpowers/specs/2026-10-26-uber-grc-prototype-design.md` (source of truth).

## Commands
- `npm run lint` · `npm run typecheck` · `npm test` (unit) · `npm run test:int` (needs Docker Postgres) · `npm run build`
- `docker compose up -d` (Postgres on :5433) · `bash scripts/setup.sh` (git hooks)

## Folder map
- `src/domain/` pure TS, no I/O · `src/server/` server-only (`import "server-only"`) · `src/app/` pages and server actions
- `rule-packs/` rule data (GC owns) · `drizzle/` migrations (A owns) · `tests/{unit,integration,e2e}`
- `plans/pending|done/` phase plans · `docs/ai/` progress, handover, decisions

## Always
- Authorise on the server for every action, deny by default; role checks live in `src/server/authz.ts`.
- Every mutation goes through `runCommand()`; ledger append happens in the same transaction that locks the ledger head.
- Enforce approver independence server-side.
- Tamper/reset demo paths only when `DEMO_MODE=true`.
- Synthetic data only; amounts as integer cents; secrets only in env vars.
- TDD for `src/domain/**`, `src/server/ledger/**`, `authz.ts`, gate and command code; paste real verification output in PRs.
- Exact dependency versions, lockfile committed, 5-line intake check for any new dependency.
- Every page shows the banner `Demonstration — synthetic data`.

## Never
- Real personal data, real credentials or connection strings anywhere (code, logs, chat).
- Write "complies with" — use "designed in alignment with". Clock text is "illustrative".
- Edit CI workflows, `.claude/` config, migrations or the rule-pack schema without a human reviewer.
- Add features outside the MVP list before the replay e2e is green.
- Put an LLM or blockchain in the product.

## Ponytail off
Turn ponytail off while editing `src/server/ledger/**`, `src/server/authz.ts`, `src/server/auth/**`, `src/domain/gate.ts`, `src/domain/independence.ts`, `drizzle/**`.
