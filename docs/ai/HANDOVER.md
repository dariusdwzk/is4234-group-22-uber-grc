# Handover

**Changed:** P0 complete: Next.js 16.4.1 scaffold with `/api/health`, local Postgres compose, gitleaks pre-commit, CI (lint/typecheck/test, gitleaks, audit), Claude guardrails (hooks, skills, reviewer), docs. CODEOWNERS has real handles.
**Verified:** clean `npm ci` + lint + typecheck + `npm test` (14 tests) + build; compose up + `select 1` on `grc_test`; CI green on PR #1; prod `/api/health` returned 200 (run by Darius).
**Not verified:** Claude Code `protect-files` hook blocking an `.env.local` edit in a live session (Darius will check).
**Next:** P1 (`plans/pending/P1-ledger-auth-rules.md`): ledger, auth, rules. Ponytail OFF for ledger/auth/authz/gate paths. Needs roles `app_rw` and `demo_admin`; Vercel env vars after that.
**Blocked:** nothing.
**Decisions:** see `docs/ai/DECISIONS.md` (Pro yes, Node 24, Neon is Postgres 18).
**Gotchas:** dependabot PRs #2–#6 open; major bumps (eslint 10, typescript 7) should be closed. Never paste connection strings into chat.
