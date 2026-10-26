# Uber Prototype — Build & Setup Plan (DRAFT v1, Sun 25 Oct 2026)

Status: **decisions Q1–Q4 answered (section 10); awaiting final approval of the plan. Nothing is built, no repo exists yet.** This extends the MVP and scenarios in `00-CONTEXT.md` (what to build) with *how to build it safely*. When the repo exists, copy this file to `plans/pending/prototype-build.md` so the plan is committed with the code.

Source for the design itself: the group's final idea document ("replay Nov 2016"); a summary is in `00-CONTEXT.md`.

## 1. What was checked (and what was not)

| Fact | Status | Source |
|---|---|---|
| GitHub Free: branch protection and rulesets are NOT available on **private** repos; available on public repos. Pro/Team/Enterprise cover private repos. | Verified | GitHub docs, "About rulesets" |
| Secret scanning is free on public repos; private repos need a paid add-on. | Verified earlier | GitHub docs |
| GitHub Student Developer Pack exists (free Copilot, Codespaces hours). Whether it includes **GitHub Pro** (which would unlock private-repo rulesets) | **Not confirmed — check on education.github.com** | — |
| Vercel Hobby: free, "non-commercial, personal use only"; **no team collaboration**; 100 deployments/day; 1M function invocations/month; functions up to 300 s | Verified | Vercel Hobby docs |
| Neon Free: no card, permanent; 1 GB storage/project; 100 CU-hours/project/month; scale-to-zero after 5 min (cannot disable); 10 branches/project | Verified | neon.com/pricing |
| Render free web service: spins down after 15 min idle, ~1 min cold start; 750 h/month; no persistent disk. **Render free Postgres expires after 30 days (+14 day grace, then deleted)** | Verified | Render docs "Deploy for Free" |
| Claude Code: committed `.claude/settings.json` is shared; `.claude/settings.local.json` is personal; `deny`/`ask` apply immediately, project `allow` rules wait for workspace trust; `defaultMode` `auto`/`bypassPermissions` do NOT take effect from project files | Verified | Claude Code settings docs |
| Hooks: `PreToolUse` exit code 2 blocks the call and feeds stderr to Claude; a hook `deny` blocks even under `--dangerously-skip-permissions`; `SessionStart` with matcher `compact` can re-inject context after compaction | Verified | Claude Code hooks docs |
| Every enabled MCP server adds tool definitions to context; `/context` shows the cost, `/mcp` disables servers | Verified (third-party guide, consistent with docs) | claudelog.com |
| Exact `enabledPlugins` key format, official-marketplace plugin names | **Not verified** — confirm via `/plugin` and `claude doctor` | — |

Consequence: **do not use Render's free Postgres** — it would be deleted around grading time. Neon's free tier is permanent.

## 2. Recommended stack (small, boring, testable)

- **App**: TypeScript, Next.js (App Router), strict `tsc`, ESLint + Prettier. One app, no microservices.
- **DB**: Postgres on Neon (free). ORM with migrations (Drizzle or Prisma — pick one, then stop debating). Zod validation on every input.
- **Tests**: Vitest (unit: hash chain, rules engine, gate logic) + Playwright (one end-to-end test that runs the whole "replay Nov 2016" scenario). The e2e test IS the demo's insurance.
- **Hosting**: Vercel (production = `main`, preview per PR) + Neon (a separate Neon *branch* for previews, free up to 10).
  - Why Vercel over Render: no 1-minute cold start in front of the markers. Trade-off: Hobby is non-commercial/no teams, so one member owns the Vercel project and everyone else works through GitHub PRs. Coursework is non-commercial; still check Vercel's terms yourself.
  - Fallback: Render free web service + Neon (never Render DB). Pre-warm the URL before every demo.
- **Not recommended**: AWS + Terraform (you know it, but it is the most time and cost risk for a 12-day build; free-tier surprises; no benefit in marks). Mention in the report as "production would use X".
- **No LLM inside the product.** This removes prompt-injection and model-output risks entirely and keeps the "ledger proves what happened" story clean.

## 3. Application security rules (these become the "Always / Never" for the agent)

Always:
- Authorisation on the **server** for every action, deny by default; role checks live in one module.
- Approver independence enforced server-side (an approver in the security reporting line is rejected, with a reason in the ledger).
- Ledger append goes through one function inside a DB transaction that locks the chain head (so two writes cannot fork the chain). App DB role has INSERT/SELECT only on the ledger table; UPDATE/DELETE revoked.
- Tamper demo uses a separate, clearly named demo-only path guarded by `DEMO_MODE=true`.
- Synthetic data only. Demo passwords and secrets only in env vars / platform secret store, never in the repo.
- Lockfile committed; `npm ci` in CI; every new dependency gets the 5-line intake check (exact name, install scripts, maintainers/age, why not stdlib, lockfile in the same PR).

Never:
- Real personal data, real Uber documents with personal data, or real credentials anywhere.
- Claims that the prototype "complies with" a standard — wording is "designed in alignment with".
- Edit CI workflows, `.claude/` config, ledger migrations, or the rule-pack schema without a human reviewer.
- Add features outside the MVP list before the MVP e2e test is green.

## 4. GitHub setup walkthrough (do once, ~1 hour, one person)

1. **Decide the owner account** (section 10, Q2) and create the repo `is4234-<group>-uber-grc`. Add a `README`, `.gitignore` (node, `.env*`, `.claude/settings.local.json`), MIT or "all rights reserved" licence note (coursework).
2. **Invite teammates** as collaborators (Write role). Everyone enables 2FA.
3. **Branch rules** (ruleset if available, else classic branch protection) on `main`: require PR, require 1 approval (2 for CODEOWNERS paths), require status checks (`ci / lint-typecheck-test`, `ci / gitleaks`), block force-push and deletion, require linear history (squash merge only), dismiss stale approvals on new commits.
   - If the repo is private on Free these cannot be enforced → fall back to: team agreement + CODEOWNERS + required CI via convention + local git hooks, and write that limitation into the decision log.
4. **Files to add in the first PR**:
   - `.github/CODEOWNERS` — `ledger/`, `rules/`, `.github/`, `.claude/`, `migrations/` need a named human owner.
   - `.github/pull_request_template.md` — what changed, how verified, security checklist (trigger path? new dependency?), screenshot.
   - `.github/ISSUE_TEMPLATE/` — task, bug.
   - `.github/dependabot.yml` — npm + github-actions, weekly.
   - `.githooks/pre-commit` running `gitleaks git --pre-commit --staged --redact --no-banner`; `scripts/setup.sh` runs `git config core.hooksPath .githooks`. Always `--redact` so a secret is never printed.
5. **Project board**: GitHub Projects with columns Backlog / Doing / Review / Done, one issue per plan step.
6. **Secrets**: GitHub Actions secrets only for what CI needs (probably none); deploy secrets live in Vercel/Neon. If a secret is ever committed: **rotate first, purge second**.

## 5. CI/CD

`ci.yml` on push and PR, `permissions: contents: read` at top, every third-party action **pinned by full commit SHA** with a `# vX.Y.Z` comment (look the SHA up on the action's releases page; Dependabot then keeps it current). Do not copy SHAs from memory.

Jobs (run in parallel):
- `lint-typecheck-test`: `npm ci`, ESLint, `tsc --noEmit`, Vitest with a Postgres service container.
- `e2e`: build, start, run the Playwright replay-scenario test (can be required only from Phase 4).
- `gitleaks`: full-history scan on PR, blocking.
- `audit`: `npm audit --audit-level=high`, **advisory** first, made blocking once the backlog is clean.

CD: Vercel Git integration — PR → preview URL (against Neon preview branch), merge to `main` → production. Migrations run as an explicit step before promoting, never from app startup. After every deploy, a smoke check: `GET /api/health` plus "verify chain" returns OK. Merged is not deployed: check the production URL, not the PR status.

## 6. Repo files that make AI-assisted work safe and resumable

```
CLAUDE.md                      # short: stack, commands, Always/Never, where things live
AGENTS.md                      # optional pointer for non-Claude tools
.claude/settings.json          # committed: permissions, hooks
.claude/settings.local.json    # personal, gitignored
.claude/hooks/                 # protect-files.sh, reinject-context.sh
.claude/skills/<name>/SKILL.md # 4-5 small project skills
.claude/agents/reviewer.md     # read-only reviewer
docs/ai/PROGRESS.md            # live status table
docs/ai/HANDOVER.md            # overwritten at end of each session
docs/ai/DECISIONS.md           # hard-to-reverse decisions only
plans/pending|done/            # plan files, one per phase group
```

**CLAUDE.md** is context, not enforcement — keep it short (commands, conventions, Always/Never, "read `docs/ai/HANDOVER.md` first"). Anything that must never happen goes in `deny` rules or a hook.

**`.claude/settings.json` starter** (adapt after verifying commands exist):

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": ["Bash(npm run lint)", "Bash(npm run typecheck)", "Bash(npm run test *)", "Bash(git status)", "Bash(git diff *)"],
    "ask": ["Bash(git push *)", "Bash(npm install *)", "Bash(npx *)"],
    "deny": ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)", "Bash(git push --force *)", "Bash(rm -rf *)", "Bash(curl *)"]
  },
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect-files.sh" }] }
    ],
    "SessionStart": [
      { "matcher": "compact",
        "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/reinject-context.sh" }] }
    ]
  }
}
```

- `protect-files.sh` reads the tool input JSON on stdin and **exits 2** with a reason on stderr when the path matches `.env*`, `.github/workflows/*`, `.claude/settings*.json`, `*/migrations/*ledger*`, or lockfiles edited by hand. A hook `deny` holds even if someone runs with permissions bypassed.
- `reinject-context.sh` prints the Always/Never list and the current PROGRESS row to stdout so a compaction does not lose them.
- Project `allow` rules only apply after each teammate trusts the folder; `deny`/`ask` apply immediately. `auto`/`bypassPermissions` modes are ignored from project files — do not rely on, or use, `--dangerously-skip-permissions`.
- Hooks run with your full credentials: review changes to `.claude/hooks/` like deploy scripts (CODEOWNERS).

**Project skills** (a skill's description is the only part always in context; bodies load on use; keep each well under 500 lines):
1. `ledger-change` — invariants (canonical JSON, sequence, prev hash, insert-only), required tests, never touch migrations without owner.
2. `rule-pack-change` — how to add/modify a rule, schema, the test table, version bump, who owns it (Legal).
3. `demo-scenario-check` — runs the replay e2e test and reports which of steps 1–8 pass.
4. `report-evidence` — keeps the failure→feature matrix and citations in sync; flags any claim with no citable source.
5. `handover` (`disable-model-invocation: true`, manual only) — writes `docs/ai/HANDOVER.md` and updates PROGRESS.

**Reviewer subagent** `.claude/agents/reviewer.md`: explicit `tools: Read, Grep, Glob` allowlist (no Bash, no Edit), checks the diff against the Always/Never list and the trigger-path list (auth/roles, CI/config, ledger, new dependency, secrets). Cheaper and safer than asking the main session to review itself.

**Handover discipline** (per session): start by reading `HANDOVER.md` + `PROGRESS.md`; end with `/handover`. HANDOVER.md answers: what changed, what's verified (command + result), what's next, what's blocked, open decisions, gotchas. Use `/clear` between unrelated tasks; compact at phase boundaries.

## 7. Plugins, skills and token hygiene

Principle: every enabled skill adds its description to context on every turn, every MCP server adds its tool schemas, and plugins are third-party code that runs with your permissions. So: **fewer, scoped, measured**.

Measure first: run `/context` in a fresh session and note the baseline; run it again after any plugin change.

| Action | What | Why |
|---|---|---|
| Keep ON | Superpowers (brainstorming, writing-plans, TDD, verification-before-completion) | Process discipline for the build. It injects a large start-up prompt — if `/context` shows it dominating, enable it only for planning/debugging sessions |
| Keep ON | Your `zizi-skills` set (planning, security-and-hardening, tdd-skill, git-sync, infrastructure) | Directly matches this build's workflow |
| Keep ON in `lite` (personal setting) | `ponytail` (DietrichGebert/ponytail, MIT; install as a **plugin**, not a copied skill file) | Writes less code; independent test (JetBrains, 80 tasks) found ~15% less code and ~10% lower cost, not the advertised 54%. Its "never trims validation/security" claim is author-tested only. Run `/ponytail off` when working on ledger, decision gate and authorisation; Always/Never list, tests and reviewer agent stay in charge; hook scripts not yet reviewed |
| Choose ONE of | `ponytail` or `caveman` | Both reshape agent behaviour; compare `/context` and keep one |
| Keep ON (optional) | `caveman` terse-reply style | Cuts output tokens on routine coding turns; switch off when you want teaching-style explanations |
| Turn OFF for this repo | `aws-*`, `deploy-on-aws`, `databases-on-aws`, `aws-serverless`, `aws-amplify`, `aws-transform`, `aws-agents-for-devsecops`, `aws-cost-guard` | We are not deploying to AWS |
| Turn OFF | `small-business`, `product-management`, `operations`, `data`, `design`, `21st`, `auth0`, `actuent` | Irrelevant to this repo; each adds skill descriptions to every turn |
| Turn OFF until needed | `vectorlab-ux-skills` | Turn on only for the UI polish pass (3–5 Nov), then off |
| Turn OFF unless chosen | `render` | Only if we pick the Render fallback |
| Turn ON late | `engineering` (deploy-checklist, testing-strategy, code-review) | Use on 5–6 Nov before freeze |
| Prefer | `gh` CLI and `npx playwright test` via Bash | Zero idle context cost, unlike a GitHub or Playwright MCP server |
| Avoid | Large community "everything" skill/plugin packs, unknown MCP servers | Supply-chain risk and context bloat; the README itself warns Anthropic can't verify third-party plugins |

How: `/plugin` to toggle per machine (user scope). Put *personal* toggles in `.claude/settings.local.json`, not the committed file, because teammates have different plugins. The committed `.claude/settings.json` should list at most one or two plugins the whole team agrees on (or none). Confirm the exact `enabledPlugins` key names with `/plugin` and `claude doctor` — not verified here.

Token habits: Sonnet for implementation, Opus (or max effort) only for planning/design reviews (`/model`, `/effort`; each model has its own prompt cache, so don't flip-flop mid-task). Name exact files in prompts. One phase per session. Ask the reviewer subagent for reviews instead of pasting diffs. Never paste secrets into a prompt.

## 8. Phases (compressed — feature freeze Fri 6 Nov; today Sun 25 Oct)

Risk-first, vertical slices. Each phase ends with a named verification and a PROGRESS update.

| # | Dates | Slice | Verify | Blocked by |
|---|---|---|---|---|
| P0 | 25–27 Oct | Repo, access, rules, CI, hooks, CLAUDE.md/settings, hello-world on Vercel + Neon with `/api/health` | CI green on a trivial PR; prod URL returns OK; gitleaks hook blocks a fake test secret | decisions Q1–Q4 |
| P1 | 27–29 Oct | **Ledger**: append, canonical JSON, hash chain, verify, tamper (demo-only), external head-hash export | Vitest: valid chain passes; altering row N fails at N; concurrent appends don't fork | P0 |
| P2 | 29 Oct–1 Nov | Roles + login (demo accounts), intake simulator, case correlation, rules engine + rule pack v1, High/Low | Rule-table tests; scenario steps 1–3 via e2e | P1 |
| P3 | 1–3 Nov | Decision gate (GC + privacy officer, independence check, reason codes), decision summary, clocks | Gate tests incl. rejected security-line approver; steps 4–5 via e2e | P2 |
| P4 | 3–5 Nov | Board Tier 1/Tier 2, challenge flag, dashboard KPI ("371 days vs 4 business days"), seed/reset | Full replay e2e (steps 1–8) green on preview | P3 |
| P5 | 5–6 Nov | Polish, reviewer-agent pass, security review of trigger paths, freeze, screenshots, prod smoke check | `demo-scenario-check` passes on production; tag `v1.0-freeze` | P4 |
| — | 7–8 Nov | Slides (due Sun 8 Nov 2359) | — | P5 |
| — | 9–12 Nov | Rehearse; guide PDF (>2 pages), ≤5-min video, ZIP; report | — | — |
| — | Fri 13 Nov | Submit early in the day | — | — |

Stretch items (control self-test, dwell-time flag, evidence export) only if P4 lands by 3 Nov. Wk13 has the presentation AND the 30% in-class test the same day: no building after 6 Nov except bug fixes.

## 9. Academic-integrity and report hooks

- Darius's decision (26 Oct): no AI-use recording scaffolding in the project (no AI-use log, no PR field). Whether and how AI use is acknowledged in the report is the team's call against the syllabus; the course overview notes that AI use must be acknowledged and that academic dishonesty can mean a FAIL.
- Teammates must be able to explain every module in Q&A. Rule of thumb: whoever opens the PR can explain it line by line; Claude helps think, draft, and review, the team owns the decisions and the report text. Re-read the spec's "Acknowledging Your Use of AI" section for code-generation limits before coding starts — not re-checked in this plan.
- Report evidence comes straight from this repo: e2e results, test counts, ledger tamper test output, CI run links.

## 10. Decisions (gate 1 answered 25 Oct) and assumptions

- Q1 **2+ people code in parallel.** Consequences: split by folder ownership (below), short-lived branches, PRs of ≤ ~300 lines, rebase on `main` daily, CODEOWNERS per area, one shared migration owner (migrations are the usual conflict point), and the e2e test is the integration referee.
- Q2 **Private repo; group already has GitHub student benefits.** Next step: one member checks whether the repo owner's account shows GitHub Pro (Settings → Billing / education.github.com). If yes → enable the ruleset in section 4 step 3. If no → convention fallback, recorded in DECISIONS.md. The repo **owner's** plan is what matters for private-repo rules (not yet verified).
- Q3 **Next.js + Neon Postgres on Vercel.** One member owns the Vercel project; the repo should be on that member's personal account (Hobby cannot deploy private org repos — to verify).
- Q4 **Lean** agent tooling.

Suggested folder ownership for parallel work (adjust to names once known): Person A = `src/ledger/` + migrations + CI; Person B = `src/rules/` + intake simulator + case correlation; Person C = decision gate + roles + board tiers; Person D (if any) = dashboard UI + seed/reset + e2e. Shared `src/lib/auth` and DB schema changes go through the migration owner.

Assumptions (correct me or I proceed): 2026 NUS group of about 4–5; one repo; coursework is non-commercial; synthetic data only; no LLM in the product; 2016 scope only; the demo stays simulated for integrations and says so; schedule above is acceptable.

Out of scope: real integrations, real regulator filings, 2022 breach, blockchain, multi-tenant production hardening, AWS/Terraform deployment.

## 11. Progress

| Item | State |
|---|---|
| Plan v1 written | Done 25 Oct |
| Decisions Q1–Q4 | Answered 25 Oct (see §10) |
| Plan approval by Darius + teammate | Pending — needed before P0 starts |
| P0–P5 | Not started |

## 12. Still to verify before relying on it

GitHub Student Pack ↔ GitHub Pro; rulesets on private repos for Pro owners; `enabledPlugins` key format; official marketplace plugin names; Vercel Hobby team/org-repo behaviour for a private repo; the spec's AI-use limits; SEC/GDPR/PDPA clock wording (see 00-CONTEXT.md §12).
