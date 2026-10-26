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
