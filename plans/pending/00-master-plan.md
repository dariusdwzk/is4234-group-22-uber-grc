# Uber 2016 GRC Prototype — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (one phase per session) or superpowers:subagent-driven-development to implement each phase file task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read this file, the spec, and `docs/ai/HANDOVER.md` before any phase.

**Goal:** A hosted Next.js demonstrator where the Nov 2016 Uber cover-up is replayed and blocked by a decision gate, two independent keys, automatic board notice and a hash-chained ledger.

**Architecture:** One Next.js App Router app; pure domain logic in `src/domain/`; every mutation goes through `runCommand()` which authorises, then in one Postgres transaction locks the ledger head, writes state and appends ledger entries. Postgres roles make the ledger append-only for the app.

**Tech Stack:** TypeScript (strict), Next.js App Router, Drizzle ORM + `pg`, Zod, Vitest, Playwright, Postgres 16 (Docker locally/CI, Neon in prod), Vercel, GitHub Actions, gitleaks.

**Spec:** `docs/superpowers/specs/2026-10-26-uber-grc-prototype-design.md` (source of truth for names, tables, rules). Background: `docs/handoff/`.

## Phase files

| File | Phase | Dates | Owner(s) | Gate to advance |
|---|---|---|---|---|
| `P0-scaffold.md` | P0 | 26–27 Oct | A | clean-install lint/typecheck/test/build; hook + gitleaks block fake secret; CI green; prod `/api/health` 200 |
| `P1-ledger-auth-rules.md` | P1 | 27–29 Oct | A (ledger, auth) ∥ B (rules) | `npm run test:int` ledger suite green incl. concurrency + role tests; rule table green |
| `P2-intake-cases.md` | P2 | 29 Oct–1 Nov | A (authz UI, demo) ∥ B (intake, cases) | `e2e/replay.spec.ts` steps 1–3 green |
| `P3-gate-clocks.md` | P3 | 1–3 Nov | A (gate) ∥ B (clocks, conflicts) | gate tests green; replay steps 4–5 green |
| `P4-board-ledger-e2e.md` | P4 | 3–5 Nov | A (ledger UI) ∥ B (board) | replay 1–8 + scenarios B–F green on Vercel preview |
| `P4.5-stretch.md` | P4.5 | only if P4 green by 3 Nov | either | own tests |
| `P5-freeze.md` | P5 | 5–6 Nov | both | `demo-scenario-check` on production; tag `v1.0-freeze` |

## Session protocol (every phase)

1. Model: **Sonnet 5.5** for implementation. Switch to **Opus 5.5** only to re-plan or for the P5 design/security review.
2. Fresh session per phase. First read: `CLAUDE.md` → `docs/ai/HANDOVER.md` → `docs/ai/PROGRESS.md` → the phase file → spec sections it cites.
3. Branch per task group: `p<N>/<short-name>`; PR ≤ ~300 lines; squash-merge after CI green and teammate review.
4. TDD for every `src/domain/**`, `src/server/ledger/**`, `src/server/authz.ts`, gate and command code (superpowers:test-driven-development).
5. Before claiming a task done: run its verification command and paste the real output into the PR (superpowers:verification-before-completion).
6. End of phase: reviewer agent (`.claude/agents/reviewer.md`) on the phase diff → fix → run the phase gate → `/handover` skill updates `docs/ai/HANDOVER.md` and `PROGRESS.md` → move the phase file to `plans/done/`.
7. A gate that fails blocks the next phase. Fix, or re-plan with Darius; never skip.

## Global Constraints

- Node: CI and Vercel on Node 24 LTS (`.nvmrc` = `24`, `engines.node` = `">=24"`); verify Vercel offers 24 in P0.
- Dependencies: only those listed in the phase files. Any other dependency needs the 5-line intake check in its PR (exact name, install scripts, maintainers/age, why not stdlib, lockfile in same PR) and a version released ≥ 14 days ago. Exact versions (`save-exact=true` in `.npmrc`).
- `npm ci` in CI; lockfile committed; never edit the lockfile by hand.
- Every third-party GitHub Action pinned by full commit SHA with `# vX.Y.Z` comment, SHA looked up on the action's releases page at execution time — never from memory.
- Synthetic data only. No real names of Uber staff in seed users (use role titles + fictional names). Amounts as integer cents.
- UI and docs wording: "designed in alignment with", never "complies with". Clock text is "illustrative".
- Every page renders the banner text: `Demonstration — synthetic data`.
- Secrets only in env vars / Vercel / Neon. Never print, commit, or paste into chat. `.env*` gitignored except `.env.example` (names only, no values).
- `src/server/**` files start with `import "server-only";`.
- Test names start with the story ID when one exists: `US-13: …`.
- No LLM in the product. No blockchain.
- Ponytail plugin OFF (`/ponytail off` or "normal mode") while editing `src/server/ledger/**`, `src/server/authz.ts`, `src/server/auth/**`, `src/domain/gate.ts`, `src/domain/independence.ts`, `drizzle/**`.

## Review Focus

Inputs the spec implies that no story test exercises; each has a test added in the owning task:

1. **Unicode / key-order in payloads** — a payload with non-ASCII text (e.g. `"Zoë"`) and keys inserted in different orders must hash identically after a DB round trip → P1 Task 2 (`canonical JSON round-trip`) and P1 Task 4 (`hash survives jsonb round trip`).
2. **Double-submit of a decision or flag** (user clicks twice) must not create two Tier 2 items or two decisions → P3 Task 3 (`resubmitting same decision is idempotent for Tier 2`) and P4 Task 3 (`unique (case_id, reason_key)`).
3. **Expired or forged session cookie** must behave as signed-out, never as another user → P1 Task 6 (`expired session returns null actor`, `unknown token returns null actor`).
4. **Demo routes on a non-demo deployment** must 404 and the demo DB URL must never be read → P2 Task 4 (`DEMO_MODE=false: demo actions throw NotFound, demo client never constructed`).
5. **Reset while another request writes** must leave a verifiable chain (reset takes the head lock too) → P4 Task 1 (`reset after concurrent appends verifies OK`).

---

## Ownership (CODEOWNERS)

- A (Darius): `src/server/ledger/`, `src/server/auth/`, `src/server/authz.ts`, `src/server/run-command.ts`, `drizzle/`, `.github/`, `.claude/`, `src/domain/gate.ts`, `src/domain/independence.ts`, `src/domain/canonical-json.ts`, `src/domain/hash.ts`.
- B (teammate): `src/domain/rules.ts`, `src/domain/facts.ts`, `src/domain/clocks.ts`, `src/domain/conflicts.ts`, `src/domain/board-text.ts`, `rule-packs/`, `src/server/commands/ingest-*.ts`, board/dashboard pages, `tests/e2e/`.
- Schema changes go through A (migration owner); B requests columns in a PR comment.

## Human-only checklist (Darius; do after P0 Task 1, before P0 Task 6)

1. Check GitHub Pro via education.github.com on your account. Record result in `docs/ai/DECISIONS.md`.
2. Create private repo `is4234-<group>-uber-grc` on your **personal** account; push `main`.
3. Invite teammate (Write); both enable 2FA.
4. If Pro: ruleset on `main` per handoff plan §4.3. Else: record the convention fallback in `DECISIONS.md`.
5. Put real GitHub handles into `.github/CODEOWNERS`.
6. Enable Dependabot alerts (Settings → Code security).
7. Neon: create project (region nearest Singapore), database `grc`, branch `preview`. Copy the owner connection strings into your local `.env.local` only.
8. Vercel: import repo; set env vars for Production and Preview (`DATABASE_URL`, `DEMO_ADMIN_DATABASE_URL`, `DEMO_MODE=true`) after P1 creates the roles.
9. Never paste any connection string or password into Claude chat.
