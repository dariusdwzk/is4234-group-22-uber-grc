# Dev setup

See the README's "Local setup" section for the full steps and the `.env.local` contents.

Prerequisites: Node 24 (`.nvmrc`), Docker, gitleaks (`brew install gitleaks`).

Local DB owner: `grc_owner` (password `LOCAL_DB_PASSWORD`, default `localdev`; local only).
`app_rw` and `demo_admin` use the local-only password `test-only-local` (README step 5 sets it).
