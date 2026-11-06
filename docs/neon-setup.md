# Hosting the Disclosure Gate (Neon + Vercel, human steps)

The `viviana-dashboard1` branch uses a new schema that cannot share a database with the old app.
It gets its **own empty database**, `disclosure_gate`, in the existing Neon project `is4234-uber-grc`.
The old `grc` database is not touched, so the current deployment keeps working until the PR is merged.

Roles and grants come from `drizzle/0001_roles_grants_trigger.sql`; passwords are never in the repo.
Never paste connection strings into chat or commit them.

## 1. Neon (project owner)

1. Neon console → project `is4234-uber-grc` → branch `main` → **Databases** → **New database**,
   name `disclosure_gate`, owner = the project's owner role.
2. Copy the **direct** (unpooled) owner connection string for `disclosure_gate`. On your machine, put it in
   `.env.local` as `DATABASE_URL_OWNER` (git-ignored; never deployed to Vercel).
3. From the repo, on branch `viviana-dashboard1`:
   ```bash
   npm run db:migrate   # tables, app_rw and demo_admin roles, grants, append-only trigger
   ```
   `app_rw` and `demo_admin` are project-wide roles; if they already exist from the old app,
   the migration reuses them and adds grants on the new database only.
4. In the Neon SQL editor on `disclosure_gate`, as the owner role, give the two roles passwords
   (skip if they already have them from the old app; reuse those):
   ```sql
   ALTER ROLE app_rw PASSWORD '<generated>';
   ALTER ROLE demo_admin PASSWORD '<generated>';
   ```
5. Seed once:
   ```bash
   DATABASE_URL='<app_rw URL for disclosure_gate>' npm run db:seed
   ```

## 2. Vercel (project owner)

Settings → Environment Variables. Scope them to **Preview, branch `viviana-dashboard1`** for now,
so the old production deployment is unchanged:

| Name | Value |
|---|---|
| `DATABASE_URL` | pooled `app_rw` URL for `disclosure_gate` |
| `DEMO_ADMIN_DATABASE_URL` | direct (unpooled) `demo_admin` URL for `disclosure_gate` (reset needs `LOCK TABLE`/`TRUNCATE`) |
| `DEMO_MODE` | `true` (enables Reset data) |

`DATABASE_URL_OWNER` is never set in Vercel. The app needs no login secrets any more.

Then push the branch; Vercel builds a preview URL for it.

## 3. Verify the preview

- `GET /api/health` returns `{"status":"ok","db":"ok"}`.
- The landing page loads, and Demo → Reset data returns to Day 0.

## 4. Switching production (after the PR is merged)

Move the three variables above from the branch-scoped Preview to **Production**, then redeploy `main`.
The professor's public link is the production URL. The old `grc` database can be dropped later,
once the team agrees nothing needs it.

## Findings (fill in)
- [ ] Neon permits `ALTER ROLE … PASSWORD` from the owner role: _not yet checked_
- [ ] `SELECT … FOR UPDATE` works through the pooled URL: _not yet checked_
