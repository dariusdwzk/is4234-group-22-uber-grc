// Connection details for the throwaway test database. Roles and passwords exist only in the local
// Docker / CI Postgres (or a Neon preview branch when TEST_DATABASE_URL_OWNER points there).
export const TEST_ROLE_PASSWORD =
  process.env.TEST_ROLE_PASSWORD ?? "test-only-local";

function baseUrl(): URL {
  if (process.env.TEST_DATABASE_URL_OWNER)
    return new URL(process.env.TEST_DATABASE_URL_OWNER);
  const u = new URL("postgres://localhost:5433/grc_test");
  u.username = "grc_owner";
  u.password = process.env.LOCAL_DB_PASSWORD ?? "localdev";
  return u;
}

function as(user: string, password: string): string {
  const u = baseUrl();
  u.username = user;
  u.password = password;
  return u.toString();
}

export const OWNER_URL = baseUrl().toString();
export const APP_URL = as("app_rw", TEST_ROLE_PASSWORD);
export const DEMO_URL = as("demo_admin", TEST_ROLE_PASSWORD);
