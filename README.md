# Disclosure Gate (Uber 2016 GRC prototype)

A demonstrator for IS4234 that replays Uber's 2016 breach cover-up with **synthetic data**. It shows a control that would have prevented the cover-up: the team that investigates an incident can never decide whether it is disclosed, and every decision leaves evidence the board can see.

There is no login. Pick a role from the **Role** menu, or click **Start guided demo** for the 6-step walkthrough. The **UberSecure** logo (top left) always returns to the start page.

## How it works

**The guided demo (Uber 2016).** On Day 0, cloud monitoring flags a mass download, and case C-104 opens and is rated HIGH by itself. The board is told automatically.
1. Security records a finding.
2. The CSO attaches the hacker's email, recommends, and is refused when he tries to close the case.
3. The General Counsel (GC) and the Chief Privacy Officer (CPO) decide.

**Recommendations.** The CSO, or the GC / CPO on independent cases, picks one of two options:

| Option | Approvals needed | If approved |
|---|---|---|
| Escalate internally for further investigation (a reason is required) | GC **and** CPO | "Under internal investigation". The board is told and the deadlines keep running. |
| Notify regulators and affected people | GC **or** CPO | "Disclosed" |

Any rejection means "Disclosure required".

**Staff reports.** An employee describes the incident and answers 7 questions with Yes / No / Not sure. The same rules engine rates the answers; the employee never picks the severity.

| Answers | Path |
|---|---|
| The concern is about how the company or Security is handling a problem (Yes or Not sure) | **Independent.** GC and CPO handle it, and Security cannot see it. One of them investigates (findings, evidence notes, optional files) and recommends, and **the other one decides**. |
| Data, money or harm: Yes | **Normal.** HIGH, the same flow as the demo, and the board is told. |
| Data, money or harm: Not sure | **Triage.** Security adds facts and only the CPO rates it. Unrated after 24 hours, it becomes HIGH automatically. |
| Otherwise | Rated by the rules. If it's LOW, Security must review it within 3 business days, or the board is told. |

Every refused action returns 403 and is written to the evidence ledger as `Blocked: …`, which the board sees.

## Run it locally (from nothing)

These steps are for macOS. On Windows, install [WSL](https://learn.microsoft.com/windows/wsl/install) and follow them inside its Ubuntu terminal (use `apt` instead of `brew`).

### 1. Install the tools (once per computer)

Open the **Terminal** app and run these one at a time:

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

The repo is private, so ask Darius to add you on GitHub first. Then:

```bash
git clone https://github.com/dariusdwzk/is4234-group-22-uber-grc.git
cd is4234-group-22-uber-grc
git checkout viviana-dashboard1   # until this branch is merged into main
nvm install                       # installs Node 24 from .nvmrc
nvm use
node -v                           # should print v24.x
```

### 3. Start the database

Open **Docker Desktop** and wait until it says "Engine running". Then:

```bash
docker compose up -d     # Postgres 16 on localhost:5433
docker compose ps        # the db container should say "healthy"
```

### 4. Create `.env.local`

In the project folder, run:

```bash
cat > .env.local <<'EOF'
DATABASE_URL=postgres://app_rw:test-only-local@localhost:5433/grc
DATABASE_URL_OWNER=postgres://grc_owner:localdev@localhost:5433/grc
DEMO_ADMIN_DATABASE_URL=postgres://demo_admin:test-only-local@localhost:5433/grc
DEMO_MODE=true
EOF
```

This creates a file named exactly `.env.local` (with the leading dot). The passwords are local-only defaults for your own Docker database, not secrets. Note the port is **5433**. `DEMO_MODE=true` shows the Reset data button in the top bar.

`.env.local` is ignored by git. Never commit it, and never put real values in `.env.example`.

### 5. Install dependencies and set up the database

```bash
npm ci                     # installs the exact package versions from package-lock.json
bash scripts/setup.sh      # turns on the gitleaks pre-commit hook

npm run db:migrate         # applies every migration in drizzle/ (tables, logins, grants)

# give the two database logins their local passwords (the ones in .env.local)
docker compose exec db psql -U grc_owner -d grc -c "ALTER ROLE app_rw PASSWORD 'test-only-local'; ALTER ROLE demo_admin PASSWORD 'test-only-local';"

npm run db:seed            # loads the demo's starting data (Day 0, case C-104)
```

If `db:migrate` fails with `relation "cases" already exists`, your Docker database still has the old app's tables. Wipe it and start again from step 3. This deletes only your local demo data:

```bash
docker compose down -v
docker compose up -d
```

### 6. Run the app

```bash
npm run dev
```

Open <http://localhost:3000> and click **Start guided demo**. Use **Reset data** (top right) to start the story again from Day 0.

To stop the app, press `Ctrl + C`. Next time you only need to open Docker Desktop, then run `docker compose up -d`, `nvm use` and `npm run dev`.

### Updating a copy you already have

```bash
git pull
npm ci                 # in case dependencies changed
npm run db:migrate     # applies any new migrations
npm run dev
```

Then click **Reset data** (top right), so your data matches the latest version.

## Troubleshooting

| Error | Fix |
|---|---|
| `EBADENGINE ... Required: {"node":">=24"}` | Run `nvm use`, then repeat the command. |
| `Cannot connect to the Docker daemon` | Open Docker Desktop and wait for "Engine running". |
| `ECONNREFUSED ... :5432` | `.env.local` is missing, misnamed (for example `_env.local`) or uses port 5432. Fix it, then restart `npm run dev`. |
| `password authentication failed for user "app_rw"` | Run the `ALTER ROLE` command from step 5. |
| `relation "cases" does not exist` | Run `npm run db:migrate`, then `npm run db:seed`. |
| `relation "cases" already exists` | Old tables from before this version: run `docker compose down -v`, then redo steps 3 and 5. |
| `column ... does not exist` (for example `reason` or `route`) | New migrations are waiting: run `npm run db:migrate`, then Reset data (top right). |
| Reset data fails with `permission denied` | Run `npm run db:migrate`: a later migration gives the reset login its permissions. |
| `eval() is not supported` in the browser console | Restart `npm run dev`. The dev server allows it; production never uses it. |
| Old or odd data on screen | Reset data (top right). |

## Roles

The server enforces every permission. The browser only says which role you picked.

| Role | Can | Cannot |
|---|---|---|
| Employee | Report an incident (7 questions, optionally anonymous), check a receipt code | See the case list or choose a severity |
| Security team | View cases, add findings, add facts on triage cases, review LOW staff reports | Close, downgrade, approve or rate a triage case. Cannot see independent cases. |
| CSO (also Deputy GC) | Attach the out-of-band email, send a recommendation | Close, downgrade or approve (reports to Security despite the legal title). Cannot see independent cases. |
| General Counsel | Approver; on independent cases, investigate, add evidence and recommend | Approve escalating alone, or approve their own recommendation |
| Chief Privacy Officer | Approver; rates triage cases; on independent cases, as the GC | Approve escalating alone, or approve their own recommendation |
| CEO | View cases and board notices | Approve, close or change anything |
| Board (Audit Committee) | Read-only dashboard and evidence log; acknowledge notices; download evidence | Anything else; decisions happen in board meetings |

## Stack

| Part | What we use |
|---|---|
| App | [Next.js 16](https://nextjs.org) (App Router) with React 19 and TypeScript (strict) |
| Front end | HTML and CSS from the design mockup, rendered by small TypeScript view modules in `src/client/` that call the API with `fetch` |
| API | Next.js route handlers: `GET /api/state`, `POST /api/actions/<name>`, `GET /api/evidence/<id>` |
| Database | PostgreSQL 16 (Docker locally, Neon when hosted), accessed through [Drizzle ORM](https://orm.drizzle.team) |
| Validation | [zod](https://zod.dev) for every request body |
| Tests | Vitest (unit and integration), Playwright (end-to-end in the browser) |
| Hosting | Vercel and Neon (see `docs/neon-setup.md`) |

## File structure

```
src/
  app/              The only page (page.tsx) and the API routes
  client/           Browser code
    app.ts          Renders the current view and handles every click
    views/          One file per page: landing, employee, security, decisions, ceo, board
      case/         The case page: page.ts plus one panel per path (normal, independent, triage, review)
                    and timeline.ts (the progress tracker, built per path)
    guide.ts        The 6-step guided tour
  domain/           Pure logic, no I/O: rules, questionnaire, clocks, decision gate, escalations, ledger wording
  server/           Server-only code
    authz.ts        The permissions map: which role may do what
    commands/       One file per action (vote, recommend, add evidence, ...)
    cases/          Signal routing, case rating, staff reports, board notices, escalations
    ledger/         Hash-chained evidence ledger: append, verify, anchors
    db/             Drizzle schema and database connections
    seed/           The demo's starting data
rule-packs/         Rules R1–R13 and the staff report questions, as data (owned by Legal)
drizzle/            Database migrations (SQL), applied in order by npm run db:migrate
tests/              unit/, integration/ (needs Docker), e2e/ (Playwright)
scripts/            migrate, seed and git hook setup
```

Every change goes through one function, `runCommand()` in `src/server/run-command.ts`. It checks the role, runs the deadline and escalation checks, and makes the change and writes the ledger entry in the same database transaction.

## Database

PostgreSQL, with tables defined in [src/server/db/schema.ts](src/server/db/schema.ts):

- **Cases:** `cases` (including the staff report's route, answers and triage and review deadlines), `signals` (system alerts and staff reports), `recommendations`, `decisions`, `approvals` (one vote per approver, enforced by the database), `receipts`, `board_notices`
- **Evidence:** `evidence` (notes plus optional files; add only, never edited)
- **Evidence ledger:** `ledger_entries` (append-only: a database trigger refuses any edit or delete), `ledger_head`, `external_anchors` (copies of the latest fingerprint, used to detect tampering)
- **Demo:** `settings` (an offset added to the real clock; tests use it to move time)

The app connects as `app_rw`, which can add rows but never change evidence. The reset button uses `demo_admin`, which can also empty tables. Both logins are created by the migrations.

## Checks

```bash
npm run lint && npm run typecheck && npm test   # fast, no database needed
npm run test:int                                # integration tests (Docker must be running)
npm run build
PW_CHANNEL=chrome npm run e2e                   # browser tests, using your installed Chrome
```
