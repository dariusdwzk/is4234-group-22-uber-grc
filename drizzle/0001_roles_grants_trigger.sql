-- DRAFT for human review. Destination: drizzle/0001_roles_grants_trigger.sql
-- (the protect-files hook blocks Claude from writing migrations by hand).
-- Roles, grants and the append-only trigger. Idempotent. No passwords here.
-- Portable across Postgres 16 (local/CI) and 18 (Neon).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
    CREATE ROLE app_rw LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'demo_admin') THEN
    CREATE ROLE demo_admin LOGIN;
  END IF;
END
$$;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_rw, demo_admin;
--> statement-breakpoint
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO app_rw, demo_admin;
--> statement-breakpoint
-- Rows whose state moves on. Never ledger_entries, approvals, recommendations, receipts or anchors.
GRANT UPDATE ON settings, cases, signals, decisions, payments, challenge_flags, board_notices, ledger_head TO app_rw, demo_admin;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rw, demo_admin;
--> statement-breakpoint
-- demo_admin only: reset (TRUNCATE everything). There is no tamper feature.
GRANT TRUNCATE ON ALL TABLES IN SCHEMA public TO demo_admin;
--> statement-breakpoint
-- Tables added by later migrations get the same baseline (never UPDATE/DELETE/TRUNCATE).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT ON TABLES TO app_rw, demo_admin;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_rw, demo_admin;
--> statement-breakpoint
-- Row triggers do not fire on TRUNCATE, so reset still works; every UPDATE or DELETE is refused.
CREATE OR REPLACE FUNCTION ledger_entries_append_only() RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  RAISE EXCEPTION 'ledger is append-only' USING ERRCODE = 'integrity_constraint_violation';
END
$fn$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ledger_entries_append_only ON ledger_entries;
--> statement-breakpoint
CREATE TRIGGER ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_append_only();
