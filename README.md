# Disclosure Gate (Uber 2016 GRC prototype)

A demonstrator for IS4234 that replays Uber's 2016 breach cover-up with **synthetic data** and shows a control that would have prevented it: the team that investigates an incident can never decide whether it is disclosed, and every decision leaves evidence the board can see.

There is no login. Pick a role from the **Role** menu, or click **Start guided demo** for the 8-step walkthrough.

## Stack

| Part | What we use |
|---|---|
| App | [Next.js 16](https://nextjs.org) (App Router) with React 19 and TypeScript (strict) |
| Front end |  HTML and CSS, rendered by small TypeScript view modules in `src/client/`, which call the API with `fetch` |
| API | Next.js route handlers: `GET /api/state` and `POST /api/actions/<name>` |
| Database | PostgreSQL 16 (Docker locally, Neon when hosted), accessed through [Drizzle ORM](https://orm.drizzle.team) |
| Validation | [zod](https://zod.dev) for every request body |
| Tests | Vitest (unit and integration), Playwright (end-to-end in the browser) |
| Hosting | Vercel and Neon (see `docs/neon-setup.md`) |

## File structure

```
src/
  app/            Next.js pages and API routes (page.tsx, api/state, api/actions/[name])
  client/         Browser code: views per page, guided tour, API client
  domain/         Pure business logic, no I/O: rules, clocks, decision gate, escalations, ledger wording
  server/         Server-only code
    authz.ts      The permissions map: which role may do what
    commands/     One file per action (vote, release payment, recommend, ...)
    cases/        Signal routing, case classification, board notices, escalations
    ledger/       Hash-chained evidence ledger: append, verify, anchors
    db/           Drizzle schema and database connections
    seed/         The demo's starting data
rule-packs/       The R1–R8 rules as data (owned by Legal)
drizzle/          Database migrations (SQL)
tests/            unit/, integration/ (needs the database), e2e/ (Playwright)
scripts/          migrate, seed and git hook setup
```

Every change goes through one function, `runCommand()` in `src/server/run-command.ts`. It checks the role, then makes the change and writes the ledger entry in the same database transaction. A refused action returns 403 and is written to the ledger as `Blocked: …`.

## Database

PostgreSQL, with tables defined in [src/server/db/schema.ts](src/server/db/schema.ts):

- **Cases and evidence:** `cases`, `signals` (system alerts and staff reports), `recommendations`, `decisions`, `approvals` (one vote per approver, enforced by the database), `payments`, `challenge_flags`, `receipts`, `board_notices`
- **Evidence ledger:** `ledger_entries` (append-only: a database trigger refuses any edit or delete), `ledger_head`, `external_anchors` (copies of the latest fingerprint used to detect tampering)
- **Demo:** `settings` (the demo clock, as hours since Day 0)

The app connects as `app_rw`, which can add rows but never change evidence. The reset button uses `demo_admin`, which can also empty tables. Both are created by the migrations.

## Run it locally (from nothing)

These steps are for macOS. On Windows, install [WSL](https://learn.microsoft.com/windows/wsl/install) and follow them inside its Ubuntu terminal (use `apt` instead of `brew`).

### 1. Install the tools (once per computer)

Open the **Terminal** app and run these one at a time.

```bash
# Homebrew, the macOS package manager (skip if `brew --version` already works)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# git and gitleaks (gitleaks blocks commits that contain secrets)
brew install git gitleaks

# nvm, to install the right Node.js version
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Close and reopen Terminal so `nvm` is available.

Then install **Docker Desktop** from <https://www.docker.com/products/docker-desktop/>. Choose "Apple Silicon" for an M1 or newer Mac, or "Intel" otherwise. Open it once and accept the terms.

### 2. Get the code

```bash
git clone https://github.com/dariusdwzk/is4234-group-22-uber-grc.git
cd is4234-group-22-uber-grc
nvm install          # installs Node 24 from .nvmrc
nvm use
node -v              # should print v24.x
```

The repo is private, so ask Darius to add you on GitHub first.

### 3. Start the database

Open **Docker Desktop** and wait until it says "Engine running". Then:

```bash
docker compose up -d     # Postgres 16 on localhost:5433
docker compose ps        # the db container should say "healthy"
```

### 4. Create `.env.local`

In the project folder, create a file named exactly `.env.local` (with the leading dot) containing:

```
DATABASE_URL=postgres://app_rw:test-only-local@localhost:5433/grc
DATABASE_URL_OWNER=postgres://grc_owner:localdev@localhost:5433/grc
DEMO_ADMIN_DATABASE_URL=postgres://demo_admin:test-only-local@localhost:5433/grc
DEMO_MODE=true
```

These are local-only passwords for your own Docker database, not secrets. Note the port is **5433**. `DEMO_MODE=true` turns on the Demo menu (+1 day, Jump to Day 24, Reset data).

From the terminal you can create it with:

```bash
cat > .env.local <<'EOF'
DATABASE_URL=postgres://app_rw:test-only-local@localhost:5433/grc
DATABASE_URL_OWNER=postgres://grc_owner:localdev@localhost:5433/grc
DEMO_ADMIN_DATABASE_URL=postgres://demo_admin:test-only-local@localhost:5433/grc
DEMO_MODE=true
EOF
```

`.env.local` is ignored by git. Never commit it, and never put real values in `.env.example`.

### 5. Install dependencies and set up the database

```bash
npm ci                     # installs the exact package versions from package-lock.json
bash scripts/setup.sh      # turns on the gitleaks pre-commit hook

npm run db:migrate         # creates the tables and the app_rw / demo_admin logins

# give the two logins their local passwords (the ones in .env.local)
docker compose exec db psql -U grc_owner -d grc -c "ALTER ROLE app_rw PASSWORD 'test-only-local'; ALTER ROLE demo_admin PASSWORD 'test-only-local';"

npm run db:seed            # loads the demo's starting data
```

### 6. Run the app

```bash
npm run dev
```

## Troubleshooting

| Error | Fix |
|---|---|
| `EBADENGINE ... Required: {"node":">=24"}` | Run `nvm use`, then repeat the command. |
| `Cannot connect to the Docker daemon` | Open Docker Desktop and wait for "Engine running". |
| `ECONNREFUSED ... :5432` | `.env.local` is missing, misnamed (e.g. `_env.local`) or uses port 5432. Fix it, then restart `npm run dev`. |
| `password authentication failed for user "app_rw"` | Run the `ALTER ROLE` command from step 5. |
| `relation "cases" does not exist` | Run `npm run db:migrate` and `npm run db:seed`. |
| Old or odd data on screen | Demo ▾ → Reset data. |

## Roles

The server enforces every permission. The browser only says which role you picked.

| Role | Can | Cannot |
|---|---|---|
| Employee | Report an incident, challenge a decision (optionally anonymous), check a receipt code | See the case list |
| Security team | View cases, add an investigation finding, declare an incident | Close, downgrade or approve |
| CSO (also Deputy GC) | Attach the out-of-band email, send a recommendation | Close, downgrade or approve (reports to Security despite the legal title) |
| Finance | View payments, release a payment once approved | Release a held payment |
| General Counsel | Approver 1 of 2 | Approve limiting disclosure alone |
| Chief Privacy Officer | Approver 2 of 2 | Approve limiting disclosure alone |
| CEO | View cases and board notices | Approve, close or change anything |
| Board (Audit Committee) | Read-only dashboard; acknowledge notices | Anything else; decisions happen in board meetings |


