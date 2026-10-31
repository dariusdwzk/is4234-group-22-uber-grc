-- DRAFT for human review. Destination: the custom migration created by
--   npx drizzle-kit generate --custom --name=evidence_grants
-- (the protect-files hook blocks Claude from writing migrations by hand).
-- app_rw already gets SELECT and INSERT on new tables from the default privileges in 0001,
-- and never UPDATE or DELETE: evidence is append-only. Reset needs to empty it.
GRANT TRUNCATE ON evidence TO demo_admin;
