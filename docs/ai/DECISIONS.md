# Decisions

Hard-to-reverse decisions only. Seeded from spec §2 (26 Oct, Darius).

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

## P0 human-only items (26 Oct)
- GitHub Pro (education): yes — ruleset on `main` (PR, required checks `lint-typecheck-test` + `gitleaks`, squash only).
- Vercel Node version: 24.x. Hobby + private personal repo: works (production deploy live).
- Neon: Postgres 18 (local compose is 16); project `is4234-uber-grc`, db `grc`, branch `preview`. Keep migrations portable across 16 and 18.
- `next` pinned 16.4.1 (16.4.0 has critical advisories); dependabot major bumps (eslint 10, typescript 7) rejected for now.

## Disclosure Gate rebuild (Viviana, PR #18, 28-31 Oct; recorded 5 Nov)
| Topic | Decision |
|---|---|
| Login | Replaced: no login; role picker sends `X-Role`, server checks permissions per role. Independence is per role, not per person. Demo only. |
| Roles | Employee, Security, CSO (also Deputy GC), GC, CPO, CEO, Board. Finance removed. |
| Decision outcomes | "Escalate internally" (GC and CPO, reason required) or "Notify regulators and affected people" (GC or CPO). Replaces notify_now / notify_later / withhold. |
| Payments | Removed, including the US$100k held payment; R5 becomes "Extortion demand". |
| Demo time | Real clock (Singapore time); no +N h or Day 24 jump in the UI. |
| Staff reports | Questionnaire routes to INDEPENDENT, NORMAL, TRIAGE or SECURITY_TRIAGE. |
| Tamper / verify | Tamper demo and `/api/ledger/verify` removed; ledger code and tests remain. |
| Banner | "Demonstration — synthetic data" banner dropped (Darius, 5 Nov). Data is still synthetic only. |
| Ledger check in UI | Dropped (Darius, 5 Nov). Chain stays in code + tests. **Report/slides must explain it** (hash chain, append-only DB grants, `tests/unit/ledger-verify.test.ts`, `tests/integration/ledger.test.ts`) and must not claim the demo shows tamper detection. |
| Payment hold | Stays dropped (Darius, 5 Nov). |
