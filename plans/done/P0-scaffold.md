# P0 — Scaffold, CI, Guardrails, Hello-World Deploy

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Read `00-master-plan.md` (Global Constraints apply to every task) and spec §3, §9 first.

**Goal:** An empty but production-shaped repo: strict TS Next.js app with `/api/health`, tests, CI, secret scanning, Claude guardrails, deployed on Vercel.

**Architecture:** create-next-app output moved into the repo root; local Postgres via Docker for later phases; CI runs lint/typecheck/unit/gitleaks.

**Tech Stack:** Next.js (latest stable ≥14 days old, App Router, `src/`, Tailwind, ESLint), TypeScript strict, Vitest, Prettier, gitleaks (Homebrew locally, checksum-verified binary in CI).

**Spec:** `docs/superpowers/specs/2026-10-26-uber-grc-prototype-design.md`

**Owner:** A (Darius). B sets up their machine (Node 24, Docker, gitleaks) and reads the spec.

---

### Task 1: Next.js app, strict TS, Vitest, `/api/health`

**Files:**
- Create (via generator): `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `eslint.config.mjs`, Tailwind files
- Create: `src/app/api/health/route.ts`, `tests/unit/health.test.ts`, `vitest.config.ts`, `.nvmrc`, `.npmrc`, `.prettierrc.json`, `.env.example`, `README.md`
- Modify: `.gitignore`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run tests/unit`), `test:int` (`vitest run tests/integration`, placeholder passing with `--passWithNoTests`), `format`. `GET /api/health` → `200 {"status":"ok"}` (DB check added in P1 Task 8).

- [ ] **Step 1:** Check the latest stable `create-next-app` version and its publish date (`npm view create-next-app time --json | tail -5`); pick the newest ≥ 14 days old. Generate in a temp dir (repo root is not empty): `npx create-next-app@<version> /tmp/grc-scaffold --ts --app --src-dir --eslint --tailwind --use-npm --import-alias "@/*" --no-turbopack` (accept defaults for any newer prompts), then copy everything except `.git` into the repo root; merge its `.gitignore` with ours (keep `*.pdf`, add `.env*`, `!.env.example`, `.claude/settings.local.json`, `/playwright-report`, `/test-results`).
- [ ] **Step 2:** Set `"strict": true, "noUncheckedIndexedAccess": true` in `tsconfig.json`; `.nvmrc` = `24`; `.npmrc` = `save-exact=true` and `engine-strict=true`; `"engines": {"node": ">=24"}`.
- [ ] **Step 3:** `npm i -D vitest prettier` (exact). Add `vitest.config.ts` with `test.environment = "node"` and the `@` alias → `src`.
- [ ] **Step 4: Write the failing test** `tests/unit/health.test.ts`:

```ts
import { GET } from "@/app/api/health/route";
it("health returns ok", async () => {
  const res = await GET();
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});
```

- [ ] **Step 5:** `npm test` → FAIL (module not found).
- [ ] **Step 6:** Implement `export async function GET(): Promise<Response>` returning `Response.json({ status: "ok" })`; `export const dynamic = "force-dynamic"`.
- [ ] **Step 7:** Replace `page.tsx` body with a placeholder heading and the banner `Demonstration — synthetic data` in `layout.tsx`.
- [ ] **Step 8: Verify from clean:** `rm -rf node_modules .next && npm ci && npm run lint && npm run typecheck && npm test && npm run build` → all exit 0.
- [ ] **Step 9:** Commit `chore: scaffold Next.js app with health endpoint`.

### Task 2: Local Postgres and env contract

**Files:**
- Create: `docker-compose.yml`, `.env.example`, `docs/dev-setup.md`

**Interfaces:**
- Produces: local Postgres 16 on `localhost:5433`, db `grc`, owner user `grc_owner`; env var names used by all later phases:
  `DATABASE_URL` (app_rw), `DATABASE_URL_OWNER` (migrations, never on Vercel), `DEMO_ADMIN_DATABASE_URL`, `DEMO_MODE` (`true`/`false`), `DEMO_PASSWORD` (seed only), `TEST_DATABASE_URL_OWNER`.

- [ ] **Step 1:** `docker-compose.yml`: service `db`, image `postgres:16-alpine` pinned by digest (look it up: `docker pull postgres:16-alpine && docker inspect --format '{{index .RepoDigests 0}}' postgres:16-alpine`), port `5433:5432`, `POSTGRES_USER=grc_owner`, `POSTGRES_PASSWORD=${LOCAL_DB_PASSWORD:-localdev}`, `POSTGRES_DB=grc`, healthcheck `pg_isready`. Also creates db `grc_test` via an init SQL file `docker/init/01-test-db.sql`.
- [ ] **Step 2:** `.env.example` lists every variable above with empty values and a one-line comment each. No values.
- [ ] **Step 3:** `docs/dev-setup.md`: prerequisites (Node 24, Docker, gitleaks), `cp .env.example .env.local`, `docker compose up -d`, `bash scripts/setup.sh`, `npm ci`.
- [ ] **Step 4: Verify:** `docker compose up -d && docker compose exec db psql -U grc_owner -d grc_test -c 'select 1'` → `1`.
- [ ] **Step 5:** Commit `chore: local postgres and env contract`.

### Task 3: Git hooks + gitleaks pre-commit, proven to block

**Files:**
- Create: `.githooks/pre-commit`, `scripts/setup.sh`, `.gitleaks.toml`, `tests/unit/precommit-blocks-secret.test.ts`

**Interfaces:**
- Produces: `bash scripts/setup.sh` sets `core.hooksPath .githooks`. Pre-commit runs `gitleaks git --pre-commit --staged --redact --no-banner` (check exact subcommand with `gitleaks --help` for the installed version; older versions use `gitleaks protect --staged`).

- [ ] **Step 1: Write the failing test** — creates a throwaway git repo in `os.tmpdir()`, copies `.githooks/pre-commit`, sets `core.hooksPath`, writes `leak.txt` containing a **runtime-generated** fake token `"ghp_" + 36 random [A-Za-z0-9]` (never a literal in the repo), stages and commits; asserts the commit exit code ≠ 0 and stdout/stderr do not contain the token (redaction). Skip with a clear message if `gitleaks` is not on PATH.
- [ ] **Step 2:** Run → FAIL (hook missing).
- [ ] **Step 3:** Write `.githooks/pre-commit` (`#!/usr/bin/env bash`, `set -euo pipefail`, fail with install hint if gitleaks missing) and `scripts/setup.sh`; `chmod +x`. `.gitleaks.toml` extends default config; allowlist only `docs/handoff/**` if it produces false positives (check first).
- [ ] **Step 4:** Run → PASS. Also `gitleaks git --redact --no-banner .` on full history → no leaks.
- [ ] **Step 5:** Commit `chore: gitleaks pre-commit hook with blocking test`.

### Task 4: CI, Dependabot, templates, CODEOWNERS

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.github/CODEOWNERS`, `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/task.md`, `.github/ISSUE_TEMPLATE/bug.md`

**Interfaces:**
- Produces: job names `lint-typecheck-test`, `gitleaks`, `audit` (required checks use these). `e2e` job added in P2 Task 6. Postgres service container added in P1 Task 1.

- [ ] **Step 1:** `ci.yml`: `on: [push, pull_request]`, top-level `permissions: contents: read`, `concurrency` cancel-in-progress per ref. Jobs:
  - `lint-typecheck-test`: checkout, setup-node (`node-version-file: .nvmrc`, `cache: npm`), `npm ci`, lint, typecheck, `npm test`, `npm run build`.
  - `gitleaks`: checkout with `fetch-depth: 0`; download the gitleaks linux_x64 release tarball **and** its checksums file for a pinned version; `sha256sum --check --ignore-missing`; run `gitleaks git --redact --no-banner --exit-code 1 .`.
  - `audit`: `npm ci --ignore-scripts && npm audit --audit-level=high`, `continue-on-error: true` (advisory until P5).
- [ ] **Step 2:** Pin `actions/checkout` and `actions/setup-node` by full SHA from their GitHub releases pages, with `# vX.Y.Z` comments.
- [ ] **Step 3:** `dependabot.yml`: `npm` and `github-actions`, weekly, `open-pull-requests-limit: 5`.
- [ ] **Step 4:** CODEOWNERS per master plan "Ownership" with placeholders `@OWNER_A` / `@OWNER_B` (human replaces). PR template sections: What changed · How verified (command + output) · Security checklist (touches trigger path: auth/authz/ledger/CI/.claude/migrations? new dependency + intake check? secrets?) · Screenshot.
- [ ] **Step 5: Verify locally:** `npx --yes actionlint@<pinned> .github/workflows/ci.yml` (or the `rhysd/actionlint` docker image) → no errors.
- [ ] **Step 6:** Commit `ci: lint/typecheck/test, gitleaks, audit; dependabot; templates`.

### Task 5: Claude Code guardrails and handover docs

**Files:**
- Create: `CLAUDE.md`, `.claude/hooks/protect-files.mjs`, `.claude/hooks/reinject-context.mjs`, `.claude/skills/{ledger-change,rule-pack-change,demo-scenario-check,report-evidence,handover}/SKILL.md`, `.claude/agents/reviewer.md`, `docs/ai/PROGRESS.md`, `docs/ai/HANDOVER.md`, `docs/ai/DECISIONS.md`, `tests/unit/claude-hooks.test.ts`
- Create **last**: `.claude/settings.json` (once the protect hook is active, it blocks edits to this file)

**Interfaces:**
- Produces: `protect-files.mjs` reads tool-input JSON on stdin; exits **2** with a reason on stderr when `tool_input.file_path` matches `.env*` (except `.env.example`), `.github/workflows/*`, `.claude/settings*.json`, `.claude/hooks/*`, `drizzle/**`, `package-lock.json`; else exits 0. `reinject-context.mjs` prints the Always/Never list from `CLAUDE.md` and the current-phase row of `docs/ai/PROGRESS.md` to stdout.

- [ ] **Step 1: Write the failing test** `tests/unit/claude-hooks.test.ts` — spawn `node .claude/hooks/protect-files.mjs` with stdin JSON:
  - `{"tool_input":{"file_path":"/x/.env.local"}}` → exit 2, stderr mentions `protected`
  - `.github/workflows/ci.yml`, `.claude/settings.json`, `drizzle/0001_x.sql`, `package-lock.json` → exit 2
  - `src/app/page.tsx`, `.env.example` → exit 0
  - malformed JSON → exit 2 (fail closed)
  - reinject: exit 0 and stdout contains `Never`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement both hooks (no dependencies; `node:fs`, `node:path`). **Step 4:** Run → PASS.
- [ ] **Step 5:** `CLAUDE.md` (≤ 80 lines): stack, commands, folder map, "read `docs/ai/HANDOVER.md` first", Always/Never (copy spec §9 + handoff plan §3), ponytail-off paths.
- [ ] **Step 6:** Skills (each < 80 lines, frontmatter `name` + `description`): `ledger-change` (spec §5 invariants, required tests, migration owner), `rule-pack-change` (spec §7 format, test row per rule, version bump, GC owns), `demo-scenario-check` (run `npm run e2e -- replay.spec.ts`, report steps 1–8 pass/fail), `report-evidence` (keep F1–F12 ↔ US ↔ test-name table in `docs/evidence/traceability.md`, flag claims without a source), `handover` (`disable-model-invocation: true`; overwrite HANDOVER.md: changed / verified (command+result) / next / blocked / decisions / gotchas; update PROGRESS row).
- [ ] **Step 7:** `.claude/agents/reviewer.md`: frontmatter `tools: Read, Grep, Glob`; checks a diff against CLAUDE.md Always/Never, trigger paths, missing tests, secrets, "complies with" wording; outputs findings with file:line.
- [ ] **Step 8:** `docs/ai/PROGRESS.md` table (phase, status, gate result, date); `DECISIONS.md` seeded with spec §2 table; `HANDOVER.md` initial.
- [ ] **Step 9:** Write `.claude/settings.json` from handoff plan §6 with hook commands `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/protect-files.mjs` and `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/reinject-context.mjs`; allow `npm run lint|typecheck|test*|build`, `git status`, `git diff *`; ask `git push *`, `npm install *`, `npm i *`, `npx *`; deny `Read(./.env)`, `Read(./.env.*)`, `Bash(git push --force*)`, `Bash(rm -rf *)`, `Bash(curl *)`. No `enabledPlugins`.
- [ ] **Step 10: Verify:** restart Claude Code in the repo; ask it to edit `.env.local` → blocked by hook. Record result in HANDOVER.
- [ ] **Step 11:** Commit `chore: claude guardrails, skills, reviewer agent, handover docs`.

### Task 6: Push, deploy hello-world, prove the gate

Requires the human-only checklist (master plan) items 1–7.

- [ ] **Step 1:** Darius pushes `main` to the private repo; opens a trivial PR (README line) → CI: all three jobs run; `lint-typecheck-test` and `gitleaks` green.
- [ ] **Step 2:** Vercel import (Node 24, framework Next.js, no env vars yet) → production URL.
- [ ] **Step 3: Verify:** `curl -s -o /dev/null -w '%{http_code}' https://<prod>/api/health` → `200` (Darius runs this; `curl` is denied to Claude by settings).
- [ ] **Step 4:** Record in `docs/ai/DECISIONS.md`: GitHub Pro yes/no + ruleset or fallback; Vercel Node version; Hobby + private personal repo works yes/no.
- [ ] **Step 5:** `/handover`; PROGRESS P0 = done with gate evidence; move this file to `plans/done/`.

## P0 Gate
`npm ci && npm run lint && npm run typecheck && npm test && npm run build` exit 0 from clean · hook test + pre-commit test green · CI green on a PR · prod `/api/health` 200.
