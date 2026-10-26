# Neon setup for P1 (human steps)

Roles and grants come from `drizzle/0001_roles_grants_trigger.sql`; passwords are never in the repo.
Do this on the Neon `main` branch and on the `preview` branch. Never paste connection strings into chat or commit them.

1. Put the **owner** URL in `.env.local` as `DATABASE_URL_OWNER` (git-ignored; never deployed to Vercel).
2. `npm run db:migrate` — creates tables, the `app_rw` and `demo_admin` roles, grants and the append-only trigger.
3. In the Neon SQL editor, as the owner role:
   ```sql
   ALTER ROLE app_rw PASSWORD '<generated>';
   ALTER ROLE demo_admin PASSWORD '<generated>';
   ```
   Verify that Neon allows this from the owner role and record the result under "Findings" below.
4. Vercel env vars (Production + Preview): `DATABASE_URL` = pooled `app_rw` URL; `DEMO_ADMIN_DATABASE_URL` = `demo_admin` URL; `DEMO_MODE=true` for the hosted demonstrator.
5. Verify: `GET /api/health` returns `{"status":"ok","db":"ok"}` and `GET /api/ledger/verify` returns `{"ok":true,...}` once the ledger is seeded (seeding arrives in P2).
6. Run the roles tests once against the `preview` branch: `TEST_DATABASE_URL_OWNER=<preview owner URL> npm run test:int` (the harness derives the `app_rw`/`demo_admin` URLs by swapping user and password; set `TEST_ROLE_PASSWORD` to the passwords from step 3).
   Warning: the suite truncates every table in that database. Use the `preview` branch, never `main`.

## Findings (fill in)
- [ ] Neon permits `ALTER ROLE … PASSWORD` from the owner role: _not yet checked_
- [ ] `SELECT … FOR UPDATE` works through the pooled URL (the 20-way concurrency test is the proof): _not yet checked_
