# UberSecure: workspace per role (UI/UX redesign)

Date: 5 Nov 2026 · Owner: Darius · Builds on Viviana's PR #18 (`viviana-dashboard1`)
Mockups: https://claude.ai/artifact/WAxvpmAR7CX2QEfuqaPz8K (screens 1–4). People's names in the mockups are **not** built (see "Out of scope").

## Goal

The prototype should feel like a product a real company uses, not a demo with a demo bar. Each role signs in, lands on its own workspace, sees what is waiting on it, and acts from one clear panel. The professor will use it on a laptop with no one guiding her; we also film a video and write a demo guide.

**Success:**
- Someone who has never seen it can sign in as any role and finish that role's job without help.
- Every screen shows only what that role can do. No "Cannot…" or "Not allowed" copy, no buttons that exist only to be refused.
- Both 2016 replay endings, the staff-report routes (NORMAL, TRIAGE, SECURITY_TRIAGE, INDEPENDENT) and the board view still work.
- Laptop width (1280–1440 px) is the primary target; phone width (375 px) has no horizontal scroll.

## What changes

### 1. Sign in (replaces the landing page and the role dropdown)
- Centred card "Sign in · Choose your account", one button per role in `ROLE_KEYS` order: role title plus a one-line description of what the role does (positive wording only).
- Secondary button **Take the guided tour** (the existing tour, optional).
- Footer: "Demo environment · all data is fictional" and, when `DEMO_MODE` is on, **Reset demo data**.
- The signed-in role survives a page refresh (per-tab browser storage); if storage is unavailable the app simply opens on Sign in.

### 2. Workspace shell (replaces the top app bar)
- Dark left sidebar: product mark, the role's menu items with counts, and at the bottom a profile card (role initials, role title, **Switch account**) plus a **Help** link that opens the existing page help / tour card.
- Menu per role:

| Role | Menu |
|---|---|
| Employee | Report an incident |
| Security, CSO | My work · All cases |
| GC, CPO | My work · All cases |
| CEO | Overview |
| Board | Overview · Evidence log |

- Switch account goes to Sign in. If the next role may see the case that was open, that case reopens (keeps Viviana's "role menu keeps the open case" behaviour).
- Below 900 px the sidebar becomes a top bar with the menu in a row.

### 3. My work (new home for Security, CSO, GC, CPO)
- Heading "My work" and three tiles: **Waiting on you** (count), **Nearest legal deadline** (shortest remaining clock across visible open cases, marked "illustrative"), **Board notices** (count).
- A list of cases that need this role now (the existing `actionRequired` rule), each with id, title, severity, one line of context and one button whose verb says what happens (e.g. "Recommend", "Review and decide", "Rate report").
- Empty list: one line, "Nothing is waiting on you."

### 4. Case page
- Breadcrumb ("My work / C-104" or "All cases / C-104") replaces "← Back".
- Two columns on a laptop: left = progress tracker, case summary, finding, why high/low risk, evidence, Deadlines/Activity tabs; right = the **action panel**, with an eyebrow "Waiting on you" when the case needs this role, otherwise "Status". Single column below 900 px.
- Remove every refusal-only control: "Case actions" (Close case, Lower severity, Approve for the CSO/CEO) and Security's "Confirm rating" on triage cases, plus the "Not allowed: …" alert.
- CSO recommendation uses two radio cards (Escalate internally · needs both GC and CPO / Notify regulators and affected people · needs GC or CPO) and a reason box; button **Send to approvers**. Outside the tour nothing is preselected and the reason starts empty.
- Approver status as badges: "General Counsel · you", "Chief Privacy Officer · pending/approved/rejected".

### 5. Board, CEO, Employee
- Same shell and page header style. The board's Overview / Evidence log tabs move into the sidebar. The "Blocked attempts" log filter stays; it will usually be empty because refusals now only come from requests the UI never makes. The server still refuses and logs them (authz unchanged).

### 6. Tour and help (kept, optional)
- Off by default. Opened only from Sign in ("Take the guided tour") or the sidebar **Help** link; picking an account no longer pops the help card.
- Tour step 2 no longer asks the CSO to try "Close case"; it completes when the recommendation is sent.
- Tour step 6 points at the **Decisions** filter and no longer claims tamper detection or checking against an external auditor. New text: entries are only ever added, never edited, and each is linked to the one before it.
- Help texts drop "try … and see it refused" wording.

## Unchanged
Server, API, `authz.ts`, ledger, rule packs, migrations, seed data, actions and their payloads. The `attempt` action and blocked-attempt ledger events stay (covered by unit/integration tests). The `csoBlocked` progress flag stays on the server, unused by the tour.

## Out of scope
- Fictional people's names and display names (deferred by Darius, 5 Nov). The UI shows role titles.
- URL routing, real login, new server features, payment hold, UI ledger check.

## Risks
- The e2e (`tests/e2e/replay.spec.ts`) clicks the role dropdown, "Reset data", "Close case" and "← Back". Each build task updates the selectors it breaks, so e2e stays green after every task.
- The report/slides must explain the hash chain and the server-side refusals, since neither is visible in normal use (see DECISIONS, 5 Nov).

## Timeline
6 Nov sign-in and shell · 7 Nov My work and case page · 8 Nov tour/help copy, board/CEO/employee · 9 Nov verification, deploy, demo guide · 10 Nov film · 11 Nov buffer.
