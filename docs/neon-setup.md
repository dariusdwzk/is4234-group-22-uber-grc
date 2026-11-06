# Hosting (Neon + Vercel)

How the hosted demo is set up, and how to rebuild it. Passwords and connection strings never go in the repo or in chat.

## Where things live (6 Nov 2026)

| Piece | Where |
|---|---|
| Database | Neon project `is4234-uber-grc`, branch **`preview`**, database **`grc`**. The live site and preview builds use it. |
| Unused | Neon branch `production` (its `grc` is empty) and database `neondb`. Safe to delete later. |
| App | Vercel project `is4234-group-22-uber-grc`, linked to GitHub. Merging to `main` deploys production; every PR gets a preview build. |
| Public link | https://is4234-group-22-uber-grc-ten.vercel.app |

Roles and grants come from `drizzle/0001_roles_grants_trigger.sql`. `app_rw` and `demo_admin` are created only if missing, so a rebuild keeps their existing passwords and the Vercel variables keep working.

## Vercel environment variables (Production and Preview)

| Name | Value |
|---|---|
| `DATABASE_URL` | pooled `app_rw` URL for `grc` |
| `DEMO_ADMIN_DATABASE_URL` | direct (unpooled) `demo_admin` URL for `grc` (reset needs `LOCK TABLE`/`TRUNCATE`) |
| `DEMO_MODE` | `true` (enables Reset demo data) |

`DATABASE_URL_OWNER` is never set in Vercel. `DEMO_PASSWORD` is left over from the old app and unused.

## Rebuilding the database (when a migration cannot apply)

Use this when `npm run db:migrate` fails with `relation ... already exists`, because the tables are older than the migration history. Everything in the database is synthetic demo data.

1. Neon console → `is4234-uber-grc` → branch `preview` → database `grc` → SQL Editor, as the owner role:
   ```sql
   DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;
   ```
2. From the repo, with `.env.local` pointing at that database (`DATABASE_URL_OWNER` = owner URL, `DATABASE_URL` = `app_rw` URL) and no local database variables exported in your shell:
   ```bash
   npm run db:migrate   # tables, roles if missing, grants, append-only trigger
   npm run db:seed      # Day 0 data, case C-104
   ```
3. If `app_rw` or `demo_admin` are new (a fresh Neon project), give them passwords in the SQL Editor, then put the matching URLs in Vercel:
   ```sql
   ALTER ROLE app_rw PASSWORD '<generated>';
   ALTER ROLE demo_admin PASSWORD '<generated>';
   ```

For a normal new migration (no old tables in the way), step 2's `npm run db:migrate` is enough.

## Verify

- `GET /api/health` returns `{"status":"ok","db":"ok"}`.
- `GET /api/state` shows `"demoMode":true` and `"replayId":"C-104"`.
- On the site: Sign in → Reset demo data, then click through one ending.

## Checked on 6 Nov 2026

- [x] Migrations apply on Neon: 12 tables, 8 migrations recorded.
- [x] `app_rw` can INSERT but not UPDATE `ledger_entries` (append-only).
- [x] The seeded ledger's hash chain is intact (no `prev_hash` mismatches).
- [x] Production and the PR #19 preview report healthy and read the seeded data.
- [ ] `SELECT … FOR UPDATE` through the pooled URL: not checked separately; covered once an action succeeds on the live site.
