# Disclosure Gate (Uber 2016 GRC prototype)

A demonstrator built with Next.js and Postgres, using synthetic data only. It replays Uber's 2016 breach cover-up and shows a control that would have prevented it: the team that investigates an incident can never decide whether it is disclosed, and every decision leaves evidence the board can see.

There is no login. Pick a role from the **Role** menu, or start the guided demo.

Hosting: `docs/neon-setup.md`.

## Local setup

### 0. Install once

- **Node 24**: the version is pinned in `.nvmrc`. With [nvm](https://github.com/nvm-sh/nvm): `nvm install && nvm use` (optionally `nvm alias default 24`).
- **Docker Desktop**: runs the local Postgres database.
- **gitleaks**: `brew install gitleaks` (used by the pre-commit secret check).

### 1. Start Docker

Open Docker Desktop and wait until it shows "Engine running", then:

```bash
docker compose up -d     # Postgres 16 on localhost:5433
docker compose ps        # should show the db container as healthy
```

### 2. Create `.env.local`

Create a file named exactly `.env.local` in the project root (downloads sometimes rename it to `_env.local`) containing:

```
DATABASE_URL=postgres://app_rw:test-only-local@localhost:5433/grc
DATABASE_URL_OWNER=postgres://grc_owner:localdev@localhost:5433/grc
DEMO_ADMIN_DATABASE_URL=postgres://demo_admin:test-only-local@localhost:5433/grc
DEMO_MODE=true
```

These passwords are local-only defaults, not secrets. Use port **5433**, not 5432. `DEMO_MODE=true` turns on the Demo menu (+1 day, Jump to Day 24, Reset data).

The `app_rw` and `demo_admin` passwords are set the first time you run `npm run test:int`. On a fresh machine, run it once before `npm run dev`.

### 3. Install dependencies and git hooks

```bash
npm ci
bash scripts/setup.sh    # enables the gitleaks pre-commit hook
```

### 4. Set up the database (first time only)

```bash
npm run db:migrate
npm run db:seed
npm run test:int         # also sets the local passwords for app_rw and demo_admin
```

### 5. Run the app

```bash
npm run dev
```

Open http://localhost:3000. Use **Demo ▾ → Reset data** at any time to start the story again from Day 0.

After you edit `.env.local`, restart `npm run dev` so it picks up the changes.

## Roles

The role menu switches between these fictional roles. The server enforces every permission. The browser only sends the chosen role.

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

Every refused action returns 403 and writes a `Blocked: …` entry to the evidence ledger, which the board sees.

## Checks

```bash
npm run lint && npm run typecheck && npm test && npm run test:int && npm run build
PW_CHANNEL=chrome npm run e2e   # guided tour, both endings; PW_CHANNEL=chrome uses installed Chrome
```
