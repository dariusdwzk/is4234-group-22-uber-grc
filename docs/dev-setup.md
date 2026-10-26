# Dev setup

Prerequisites: Node 24 (`.nvmrc`), Docker, gitleaks (`brew install gitleaks`).

```bash
cp .env.example .env.local   # fill in values; never commit
docker compose up -d         # Postgres 16 on localhost:5433 (dbs: grc, grc_test)
bash scripts/setup.sh        # installs the gitleaks pre-commit hook
npm ci
npm run dev
```

Local DB owner: `grc_owner` (password `LOCAL_DB_PASSWORD`, default `localdev`; local only).
