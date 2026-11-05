# P6 — Workspace per role (UI/UX redesign) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the demo-style landing page, role dropdown and top bar with a sign-in screen, a sidebar workspace per role, a "My work" home and a two-column case page, without changing the server.

**Architecture:** The front end stays Viviana's string-built SPA in `src/client/*` (`render()` in `app.ts` draws `VIEWS[S.view]`, clicks go through `data-a`/`data-x` to the action map `A`). We add a shell (`views/shell.ts`) that wraps every signed-in view, a pure nav model (`nav.ts`), a pure work-list model (`work.ts`) and a new `work` view. Refusal-only buttons are deleted from the client; the server's authz is untouched.

**Tech Stack:** Next.js 16.4.1, TypeScript strict, Vitest (unit), Playwright (e2e), plain CSS in `src/app/theme.css`.

**Spec:** `docs/superpowers/specs/2026-11-05-ubersecure-workspace-redesign-design.md` (mockups: https://claude.ai/artifact/WAxvpmAR7CX2QEfuqaPz8K — ignore the people's names in them).

**Branch:** work on top of `viviana-dashboard1` (PR #18), e.g. `feat/workspace-redesign`.

## Global Constraints

- No server changes: nothing in `src/server/**`, `src/app/api/**`, `drizzle/**`, `rule-packs/**`. If a task seems to need one, stop and ask Darius.
- No new dependencies.
- Show role titles only (`ROLES[k].name`); no people's names (deferred 5 Nov).
- Never write "Cannot…", "Not allowed" or "refused" in UI copy about the signed-in user's own permissions.
- Never write "complies with"; deadline text keeps "(illustrative)" where a legal clock is shown.
- All user-entered text goes through `esc()` from `src/client/html.ts`.
- Every clickable control is a `<button>` (or `<a>` with `href`), keyboard reachable, with visible focus; respect `prefers-reduced-motion` (already handled for `.pulse` and toast).
- Laptop 1280–1440 px is primary. At 375 px wide no page scrolls horizontally.
- After every task: `npm run lint && npm run typecheck && npm test && npm run e2e` all pass. Each task updates the e2e selectors it breaks.
- Commit only on Darius's go-ahead; end commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Page refresh while signed in** → stays signed in as the same role on its home; if `sessionStorage` throws (private mode), opens on Sign in with no error. Test in Task 1.
2. **Switch account from a case the next role may not see** (e.g. CPO on an INDEPENDENT case → Security) → lands on Security's home, never "Case not found". Test in Task 3 (e2e).
3. **Nothing to do** → My work shows "Nothing is waiting on you." and the tiles still render. Test in Task 2.
4. **CSO sends without choosing a recommendation outside the tour** → toast "Choose a recommendation." and nothing is sent. Test in Task 3 (e2e).
5. **Phone width** → sign-in, My work and case page have `scrollWidth <= innerWidth` at 375 px. Test in Task 6 (e2e).

---

### Task 1: Sign-in screen and workspace shell

**Files:**
- Create: `src/client/nav.ts`, `src/client/views/shell.ts`, `tests/unit/nav.test.ts`
- Modify: `src/client/views/landing.ts` (becomes the sign-in screen; keep the view key `"landing"`), `src/client/app.ts` (`render`, `setRole`, `A.role`, `A.landing`, new `A.go`, `A.switchAccount`, `mount`, drop `onChange`/`#roleSel`), `src/client/store.ts` (add `resumeCase`), `src/domain/roles.ts` (`short` copy), `src/app/theme.css`, `tests/e2e/replay.spec.ts` (helpers)
- Delete: `src/client/views/header.ts` (move `LOGO` to `shell.ts`)

**Interfaces:**
- Produces:
  - `type NavItem = { label: string; a: string; x?: string; count?: number; current: boolean }`
  - `navFor(role: RoleKey, s: { view: string; boardTab: "overview" | "log"; d: ViewState }): NavItem[]` in `src/client/nav.ts`. Items for this task:
    - employee: `Report an incident` (a `go`, x `employee`)
    - security, cso: `All cases` (go/`security`, count = `d.cases.length`)
    - gc, cpo: `All cases` (go/`approvals`, count = `d.cases.length`)
    - ceo: `Overview` (go/`ceo`)
    - board: `Overview` (a `boardTab`, x `overview`), `Evidence log` (a `boardTab`, x `log`)
    - `current` is true when `s.view === x` (go items) or `s.view === "board" && s.boardTab === x` (board items).
  - `shell(content: string): string` in `src/client/views/shell.ts` — `<div class="shell"><nav class="side" aria-label="Workspace">…</nav><main>content</main></div>`. Sidebar: logo + "UberSecure", one `<button class="nav-item" data-a data-x aria-current="page"?>` per `NavItem` with its count, then a profile card: initials badge (`initials(ROLES[role].name)`: first letters of the first two words, e.g. "GC", "CP"), role title, `<button data-a="switchAccount">Switch account</button>`, `<button data-a="showGuide">Help</button>`.
  - `loadRole(): RoleKey | null` and `saveRole(r: RoleKey | null): void` in `src/client/store.ts`, key `"ubersecure.role"` in `sessionStorage`, both wrapped in try/catch (return `null` / do nothing on throw).
  - `S.resumeCase: string | null` — set by `A.switchAccount` to `S.caseId` when `S.view === "case"`, else `null`.

- [ ] **Step 1: Write the failing tests** in `tests/unit/nav.test.ts`:
  - `navFor("board", { view: "board", boardTab: "log", d })` → labels `["Overview", "Evidence log"]`, only the second `current`.
  - `navFor("gc", { view: "approvals", boardTab: "overview", d })` with 3 cases → one item `All cases`, `count: 3`, `current: true`.
  - `navFor("employee", …)` → `[{ label: "Report an incident", a: "go", x: "employee", current: … }]`.
  - Every role in `ROLE_KEYS` returns at least one item.
  - `loadRole()` returns `null` when `sessionStorage.getItem` throws (stub `globalThis.sessionStorage` with a throwing object), and returns `"cso"` after `saveRole("cso")` with a working stub.
- [ ] **Step 2: Run** `npx vitest run tests/unit/nav.test.ts` — expect FAIL (module not found).
- [ ] **Step 3: Implement** `nav.ts`, `loadRole`/`saveRole`, and `shell.ts`.
- [ ] **Step 4: Rewrite `vLanding()`** as the sign-in card: `<h1>Sign in</h1>`, "Choose your account.", one `<button class="acct" data-a="role" data-x="<key>">` per `ROLE_KEYS` with initials, `ROLES[k].name` and `ROLES[k].short`; then `<button class="btn" data-a="startGuide">Take the guided tour</button>`; footer "Demo environment · all data is fictional" plus `<button class="link" data-a="reset">Reset demo data</button>` only when `S.d.demoMode`.
- [ ] **Step 5: Update `ROLES[*].short`** in `src/domain/roles.ts` to positive copy:
  - employee "Report an incident, anonymously if you like"
  - security "Investigate incidents and record findings"
  - cso "Lead Security and recommend what to do"
  - gc "Approve disclosure decisions"
  - cpo "Approve disclosure decisions and rate staff reports"
  - ceo "Follow serious incidents"
  - board "Receive incident notices and oversee"
- [ ] **Step 6: Wire `app.ts`:**
  - `render()` wraps every view except `landing` in `shell(...)`; delete the header and the floating `guide-fab` (Help now lives in the sidebar). Guide/help card rendering when `S.guided` stays as is.
  - `A.role`: drop the `S.mode = "explore"; S.guided = true` lines (no auto help card); call `setRole(x, { keepCase: true })`.
  - `setRole`: reopen `S.resumeCase` (instead of checking `S.view === "case"`) when the new role's `S.d.cases` contains it; clear `S.resumeCase` after; call `saveRole(S.role)`.
  - `A.switchAccount`: set `S.resumeCase`, then `setRole(undefined)` (role null → Sign in).
  - `A.go(x)`: `S.view = x; render(); window.scrollTo(0, 0)`.
  - `A.boardTab`: also set `S.view = "board"`.
  - `mount()`: `S.role = loadRole()`, then after the first `refresh()` set `S.view = S.role ? ROLES[S.role].home : "landing"`.
  - Remove `onChange` and the `change` listener (only `#roleSel` used it).
- [ ] **Step 7: CSS** in `theme.css`: `.shell` (grid `248px 1fr`, min-height 100vh), `.side` (bg `#0B1220`, sticky, column flex), `.nav-item` (as mockup: `#CBD5E1`, current `#1E293B` bg + white), `.profile`, `.acct` (mockup screen 1), `@media (max-width:900px)` → `.shell` single column, `.side` becomes a horizontal top bar with the nav items in a scrollable row and the profile card compact. Remove now-unused `header.top`/`.rolepick` rules.
- [ ] **Step 8: Update e2e helpers** in `tests/e2e/replay.spec.ts`:
  - `asRole(page, role)`: if a "Switch account" button is visible click it; then click the sign-in button whose accessible name starts with `ROLES[role].name` (`getByRole("button", { name: new RegExp("^" + name) })`).
  - `reset(page)`: go to Sign in (Switch account if signed in) and click "Reset demo data"; expect toast "Demo reset.".
  - "Start guided demo" → "Take the guided tour".
- [ ] **Step 9: Run** `npm run lint && npm run typecheck && npm test && npm run e2e` — all pass.
- [ ] **Step 10: Commit** (after Darius's go-ahead): `feat(ui): sign-in screen and workspace sidebar`.

---

### Task 2: "My work" home

**Files:**
- Create: `src/client/work.ts`, `src/client/views/work.ts`, `tests/unit/work.test.ts`
- Modify: `src/client/nav.ts` (add My work), `src/client/app.ts` (`VIEWS.work`), `src/domain/roles.ts` (`home: "work"` for security, cso, gc, cpo), `src/app/theme.css`, `tests/unit/nav.test.ts`, `tests/e2e/replay.spec.ts`

**Interfaces:**
- Consumes: `actionRequired(c, role)` from `src/client/action-required.ts`; `NavItem` from Task 1.
- Produces:
  - `type WorkItem = { c: CaseView; line: string; verb: string }`
  - `workItems(cases: CaseView[], role: RoleKey): WorkItem[]` — cases where `actionRequired(c, role)`, HIGH first then by id.
  - `nearestDeadlineH(cases: CaseView[], clockH: number): number | null` — min of `start + dur - clockH` over clocks with `start !== null && dur !== null && !met`, on cases whose status is not `"Disclosed"`; `null` if none.
  - `vWork(): string` in `src/client/views/work.ts`.
  - `navFor` gains `My work` (a `go`, x `work`, count = `workItems(d.cases, role).length`) as the first item for security, cso, gc, cpo.

Verb and line per case (first match wins):

| Condition | verb | line |
|---|---|---|
| `status === "Needs triage"`, role cpo | Rate report | "The reporter was unsure about the impact." |
| `status === "Needs triage"` or LOW `SECURITY_TRIAGE`, role security | Record finding | "Staff report waiting for Security's facts." |
| `status === "Disclosure required"` | Approve disclosure | "The decision was rejected, so disclosure is required." |
| `route === "INDEPENDENT"` and `!c.rec` | Investigate | "One of you investigates and recommends; the other decides." |
| role cso | Recommend | "Security's finding is in. Recommend what to do." |
| role security | Record finding | "Opened automatically from system signals." |
| otherwise (decision pending) | Review and decide | `ROLES[c.rec.author].name + " recommends: " + c.decision.type` + (reason ? ` · “${reason}”` : "") |

- [ ] **Step 1: Write the failing tests** in `tests/unit/work.test.ts` (build `CaseView` fixtures with a small `mk(over: Partial<CaseView>)` helper):
  - `workItems([], "gc")` → `[]`.
  - A HIGH NORMAL case with `rec = { author: "cso", act: "escalate", reason: "Keep it in-house", t: 1 }` and a pending decision with no votes → for `"gc"`: verb `"Review and decide"`, line contains `"CSO (also Deputy GC) recommends:"` and `"Keep it in-house"`.
  - A `"Needs triage"` case → for `"cpo"` verb `"Rate report"`; for `"security"` verb `"Record finding"`.
  - `nearestDeadlineH` with clocks `{start: 0, dur: 72, met: false}` and `{start: 0, dur: 24, met: false}` at `clockH = 10` → `14`; with only met clocks → `null`; a `"Disclosed"` case is ignored.
  - `vWork()` with `S.role = "gc"` and no cases contains `"Nothing is waiting on you."` and `"Waiting on you"`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/work.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `work.ts` and `vWork()`: `<h1>My work</h1>`, three `.tile`s (Waiting on you · count; Nearest legal deadline · `remText(h)` + "(illustrative)" or "None running"; Board notices · `S.d.notices.length`), then `<h2>Waiting on you</h2>` and one `.work-item` per item (mono id, `esc(title)`, `sev(c)`, `esc(line)`, `<button class="btn primary" data-a="openCase" data-x="<id>">verb</button>`), or the empty line.
- [ ] **Step 4: Switch homes** in `roles.ts` and add My work to `navFor`; update `nav.test.ts` expectations (gc now has 2 items, first `My work`).
- [ ] **Step 5: Update e2e**: where tests open a case from a list after `asRole`, the list is now My work. `[data-a="openCase"][data-x=…]` still works when the case needs that role; where it does not (e.g. checking Security's list for C-105 absence), click "All cases" first.
- [ ] **Step 6: Run** the full check — all pass.
- [ ] **Step 7: Commit:** `feat(ui): My work home for Security, CSO, GC and CPO`.

---

### Task 3: Case page — breadcrumb, two columns, action panel

**Files:**
- Modify: `src/client/views/case/page.ts`, `src/client/views/case/normal.ts`, `src/client/views/case/triage.ts`, `src/client/app.ts` (remove `A.blocked`, `A.triageTry`; `A.rec` reads radios), `src/client/store.ts` (remove `lastBlock`), `src/app/theme.css`, `tests/e2e/replay.spec.ts`

**Interfaces:**
- Consumes: `actionRequired`, `navFor` (for the breadcrumb label).
- Produces: `#actionbox` stays the action panel's id (the tour targets it). Breadcrumb button `data-a="go" data-x="<from>"` where `<from>` is `"work"` if the case is in `workItems` for the role, else the role's All cases view.

- [ ] **Step 1: Update the e2e first** so it describes the new page, and run it to see it fail:
  - Replace `"← Back"` clicks with the breadcrumb button (`page.locator("nav[aria-label=Breadcrumb] button")`).
  - Remove the "Close case" click and its two "Not allowed" / "Security cannot close cases." assertions; remove Security's "Confirm rating" click and its assertion in the triage test.
  - "Send for decision" → "Send to approvers".
  - Ending A board check: keep the `logFilter blocked` click and the "Demo complete" assertion; delete only the "tried to close case. Not allowed." assertion (no close attempt happens any more). Task 4 moves this click to the Decisions filter.
  - New test "the CSO must choose a recommendation": reset, `asRole(cso)`, open C-104 from My work, click "Send to approvers" with nothing chosen → toast "Choose a recommendation."; then check the "Escalate internally" radio, fill reason, send → toast "Sent to the General Counsel and the Chief Privacy Officer.".
  - Review Focus 2: in the independent-path test, after the CPO rejects, `asRole(page, "security")` → expect heading "My work" visible and no "Case not found".
  - Run `npm run e2e` — expect FAIL on the changed steps.
- [ ] **Step 2: Remove refusal-only controls:** in `normal.ts` delete `act()` and both "Case actions" blocks (security/cso and ceo; CEO keeps `<h2>Read-only access</h2>` renamed to `<h2>Status</h2>` with the decision status line). In `triage.ts` delete Security's "Case actions" block. In `app.ts` delete `A.blocked`, `A.triageTry`; in `store.ts` and `page.ts` delete `lastBlock` and its alert; drop the now-unused `ATTEMPT_LABELS` import. In `guide.ts` step 2 (cso), set `done: () => P().recommended` and drop the `P().recommended ? …close…` branches from its title, text and target, otherwise the tour stalls at step 2 once Close case is gone.
- [ ] **Step 3: Recommendation radios** in `normal.ts`: replace `<select id="rAct">` with a `<fieldset><legend>Recommendation</legend>` holding two `<label class="choice"><input type="radio" name="rAct" value="escalate|disclose">` cards: "Escalate internally" / "Needs both General Counsel and Chief Privacy Officer." and "Notify regulators and affected people" / "Needs General Counsel or Chief Privacy Officer.". In tour mode (`S.mode === "demo"`) `escalate` is `checked`. Button text "Send to approvers", helper line under it "The General Counsel and the Chief Privacy Officer are notified.". In `A.rec` read `document.querySelector<HTMLInputElement>('input[name="rAct"]:checked')?.value`; if none → `toast("Choose a recommendation.")` and return.
- [ ] **Step 4: Approver badges:** replace the `.approvers` spans with `<span class="badge">` per approver: `ROLES[k].name + " · " + ("you" if k === S.role and not voted | "approved" | "rejected" | "pending")`.
- [ ] **Step 5: Layout** in `page.ts` `vCase()`:
  - `<nav aria-label="Breadcrumb"><button class="link" data-a="go" data-x="<from>"><label></button> / <id></nav>` then the existing `.case-head`.
  - Then `<div class="case-grid"><div class="case-main">tracker + escalated alert + summary + evidencePanel + tabs</div><aside class="case-aside" aria-label="Your action">eyebrow + actionBox(c)</aside></div>`. Eyebrow: `<div class="eyebrow">Waiting on you</div>` when `actionRequired(c, S.role)`, else `<div class="eyebrow muted">Status</div>`.
  - CSS: `.case-grid` grid `minmax(0,1fr) 340px`, gap 20px; `.case-aside` `position: sticky; top: 24px; align-self: start`; `.case-aside .panel` blue ring when it needs action (`.needs` class); `@media (max-width:900px)` single column with the aside first.
- [ ] **Step 6: Run** the full check — all pass.
- [ ] **Step 7: Commit:** `feat(ui): two-column case page with one action panel`.

---

### Task 4: Tour and help copy

**Files:**
- Modify: `src/client/guide.ts`, `src/client/help.ts`, `tests/unit/guide.test.ts`, `tests/unit/help.test.ts` (only if a title changes)

**Interfaces:**
- Consumes: `S.d.progress`, `S.logFilter`. No new exports.

- [ ] **Step 1: Update `tests/unit/guide.test.ts`:**
  - "acknowledging notices or filtering the log early…" sets `S.logFilter = "decision"` (not `"blocked"`).
  - New: `progress({ finding: true, recommended: true })` → `STEPS[stepIdx()]!.title === "Approve as General Counsel"` (step 2 no longer waits for `csoBlocked`).
  - New: `STEPS.map(s => typeof s.text === "string" ? s.text : "").join(" ")` and the last step's `text()` evaluated with `S.boardTab = "log"` contain neither `"auditor"` nor `"detected"`.
  - Run `npx vitest run tests/unit/guide.test.ts` — expect FAIL.
- [ ] **Step 2: Edit `STEPS`:**
  - Step 2 (cso): already changed in Task 3; check its title and text read well ("Attach the hacker’s email, then recommend" / "Recommend keeping it internal").
  - Last step (board log): target `[data-a="logFilter"][data-x="decision"]`, `done: () => S.logFilter === "decision"`, log text: "Every action on a case is added here the moment it happens. Entries are only ever added, never edited, and each one is linked to the one before it. Click “Decisions” to see who decided what, and why."
  - `"Go as " + ROLES[...]` button stays.
- [ ] **Step 3: Edit `help.ts`** texts (lines with "try", "refused", "cannot approve", "Blocked attempts") to say only what the role does. Exact replacements:
  - Security, triage: "The reporter was unsure about the impact. Record what you found; the Chief Privacy Officer then confirms the rating."
  - Security, HIGH case: "This case opened by itself and the board was already told. Record what the investigation found."
  - CSO, case: "Attach any message no system saw, then recommend: escalate internally (needs a reason) or notify regulators."
  - CEO, case: "You can follow every step of the case and see what the board has been told."
  - CSO, home: "As CSO you lead Security. Open a case to attach messages no system saw and to recommend what to do."
  - Board, log: "Every action is added here the moment it happens. Filter by type to see decisions and board notices."
- [ ] **Step 4: In the e2e** Ending A, change the `logFilter` click from `blocked` to `decision`; run `npm test` then `npm run e2e` (the e2e still drives the tour) — all pass.
- [ ] **Step 5: Commit:** `fix(ui): tour and help describe what each role does, no tamper claim`.

---

### Task 5: Board, CEO and Employee in the workspace style

**Files:**
- Modify: `src/client/views/board.ts`, `src/client/views/ceo.ts`, `src/client/views/employee.ts`, `src/client/views/security.ts`, `src/client/views/decisions.ts`, `src/app/theme.css`, `src/app/additions.css`, `tests/e2e/replay.spec.ts` (only selectors that break)

**Interfaces:**
- Consumes: `navFor` board items (`boardTab` overview/log) from Task 1.

- [ ] **Step 1: Board:** delete the in-page Overview / Evidence log tab buttons (the sidebar items now carry `data-a="boardTab"`); keep the page heading per tab ("Overview" / "Evidence log") and everything below. Keep the "Blocked attempts" chip.
- [ ] **Step 2: Headings:** every page starts with the same `.pagehead` (h1 + one-line lede): Security "All cases" / "Every case Security can see."; GC/CPO "All cases" / "High-risk cases, staff reports and cases handled without Security."; CEO "Overview" / "Serious incidents and what the board has been told."; Employee "Report an incident" / "Tell us what happened. You can stay anonymous." Remove the empty `<p class="lede"></p>` in `ceo.ts`.
- [ ] **Step 3: Employee page:** single centred column (max-width 720px), report form first, "Check a report" below it.
- [ ] **Step 4: Visual pass** against mockup screens 1–4 at 1280 px in the browser pane (`npm run dev` with local DB URLs, see HANDOVER gotchas): spacing, card style and buttons match the mockups; fix only CSS.
- [ ] **Step 5: Run** the full check — all pass. Update the e2e only where a removed tab button was clicked ("Evidence log" is now the sidebar button with the same name, so `getByRole("button", { name: "Evidence log" })` should keep working).
- [ ] **Step 6: Commit:** `feat(ui): board, CEO and employee pages in the workspace layout`.

---

### Task 6: Phone check, full verification and docs

**Files:**
- Modify: `tests/e2e/replay.spec.ts`, `docs/ai/PROGRESS.md`, `docs/ai/HANDOVER.md`, `docs/ai/DECISIONS.md`
- Create: `docs/evidence/screens/p6-*.png`

- [ ] **Step 1: Write the phone-width e2e** (Review Focus 5): `test.use({ viewport: { width: 375, height: 812 } })` in a `describe`; for Sign in, GC My work and C-104 as GC: `expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)`.
- [ ] **Step 2: Run** `npm run e2e` — fix CSS until it passes.
- [ ] **Step 3: Copy sweep:** `grep -rniE "cannot|not allowed|refused|complies with" src/client` — every hit must be a fact about someone else (e.g. "Security cannot see these"), never about the signed-in role's own buttons.
- [ ] **Step 4: Full verification:** `npm run lint && npm run typecheck && npm test && npm run test:int && npm run build && npm run e2e`; paste the summary lines into the PR.
- [ ] **Step 5: Screenshots** at 1280×800 of Sign in, CSO on C-104, GC My work, GC deciding, Board overview, Employee into `docs/evidence/screens/p6-*.png`.
- [ ] **Step 6: Docs:** PROGRESS row "P6 workspace redesign"; HANDOVER current state; DECISIONS rows "Sign-in replaces role menu", "Refusal-only buttons removed (server still refuses and logs)", "Names deferred", "Tour optional".
- [ ] **Step 7: Commit:** `test(ui): phone-width check; docs for the workspace redesign`.

---

### After P6 (Darius, not agents)

- Review the PR #18 migrations, merge PR #18 and this branch into `main`.
- Wipe and reseed Neon, deploy to Vercel, run `/demo-scenario-check` against production.
- Demo guide (role by role, both endings), film 10 Nov.
- Report/slides: explain the hash chain and the server-side refusals (see DECISIONS, 5 Nov).
