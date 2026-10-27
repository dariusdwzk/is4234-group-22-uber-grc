# Dashboard UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every page into a dashboard (sidebar shell, cards, badges, a board page that shows the 371-day comparison at a glance) without changing behaviour.

**Architecture:** Design tokens in `globals.css` (`@theme`) plus small props-only components in `src/components/ui/`. A new `AppShell` replaces the top `Nav` inside the existing `(app)` layout; login and the root banner stay in the root layout. Pages keep their data fetching, actions and Suspense structure; only their markup moves onto the components.

**Tech Stack:** Next.js 16 (App Router, `cacheComponents`), React 19, Tailwind v4, Vitest (unit), Playwright (e2e). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-27-dashboard-uiux-redesign-design.md`

## Global Constraints

- Presentation only. Do not touch `src/server/**`, `src/domain/**`, `drizzle/**`, `.github/**`, `.claude/**`, or any server action's behaviour. The only allowed edits outside `src/app`, `src/components`, `tests/` and docs: none.
- Banner text `Demonstration — synthetic data` stays on every page, `role="note"`, in the root layout.
- Keep every heading text, form label, button name, link text, `aria-labelledby` region name and `data-testid` that `tests/e2e/**` matches: `verify-result`, `tier2-item`, `status`, `tier`, `kpi-uber`, `kpi-card`, `head-status`, `gate-state`, `entry-count`, `clock-<id>`; regions "Events", "Fired rules", "Tier 1 board notice"; headings "Cases", "Demo panel"; buttons "Sign in", "Reset demo", "Advance +24h", "Verify ledger", "Export head", "Acknowledge", "Resolve flag", "Raise flag", "Submit report", "Submit decision", "Close case", "Record recommendation"; labels "Email", "Password", "Entry number", "Action note", "Resolution".
- Playwright strict mode: a page must contain exactly the `role="alert"` and `role="status"` elements it has today (at most one of each per state). New decorative status text must not use those roles. Icons are `aria-hidden`. Table rows stay real `<tr>` (e2e uses `getByRole("row", { name: /CASE-0002/ })`). The Events list stays one `<li>` per event. The cases list shows exactly one link whose name matches `/CASE-/`.
- "Close case" must stay enabled (it deliberately submits so the refusal is logged). Do not add `disabled` to it.
- Wording: "designed in alignment with"; clock text keeps "(illustrative)". Light theme only.
- Exact dependency versions rule: add no packages.
- Lint with `npx eslint src tests` (bare `npm run lint` scans `.claude/worktrees`).
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Long unbroken content (64-char hashes, 2000-char flag text, payload previews) must wrap or scroll inside its card at 375 px, never widen the page. Pinned in Task 3 (`ui-shell.spec.ts`, ledger and flag cases).
2. Empty states (no cases, no Tier 2, no flags, no events) keep today's strings ("None.", "No cases yet.") inside `EmptyState`. Pinned in Task 2 (`status`/`EmptyState` usage) and Task 4.
3. Every role sees only its own nav links and a working shell, including EMP (two links) and DEMO. Pinned in Task 3.
4. Failure and warning states are never colour-only: "Verification failed at entry N" and tier labels carry text. Pinned in Task 1 (`statusVariant` labels) and Task 6.
5. Keyboard: skip link is the first Tab stop; the mobile menu opens and closes by keyboard; every control shows a focus ring. Pinned in Task 3.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/app/globals.css` | Tokens (`@theme`), base styles, focus ring, reduced-motion |
| `src/components/ui/status.ts` | Pure maps: tier/status/clock → `{ variant, label }`; `barPercents()` for the compare bar |
| `src/components/ui/icons.tsx` | Inline SVG icons (no icon dependency), all `aria-hidden` |
| `src/components/ui/*.tsx` | `Card`, `PageHeader`, `Badge`, `Button`, `SubmitButton` (client), `Field`, `Alert`, `EmptyState`, `StatCard`, `CompareBar`, `DataTable`, `Timeline` |
| `src/components/shell/{AppShell,Sidebar,SidebarLinks,Topbar}.tsx` | Dashboard chrome; `SidebarLinks` is the only client part (needs `usePathname`) |
| `src/components/Banner.tsx` | Keep text and role; restyle only |
| `src/components/Nav.tsx` | Deleted once the shell replaces it |
| `src/app/**/page.tsx`, `cases/[id]/*.tsx`, `demo/ResetButton.tsx` | Restyled onto the components |
| `tests/unit/{ui-status,theme-contrast}.test.ts` | Pure-logic tests |
| `tests/e2e/{ui-shell,screens}.spec.ts` | Layout/keyboard/overflow checks; opt-in screenshots |

---

### Task 1: Branch, baseline, tokens and status helpers

**Files:**
- Create: `src/components/ui/status.ts`, `tests/unit/ui-status.test.ts`, `tests/unit/theme-contrast.test.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces:
  - `type Variant = "danger" | "warn" | "ok" | "info" | "neutral"`
  - `tierBadge(tier: "HIGH" | "MEDIUM" | "LOW"): { variant: Variant; label: string }` — HIGH→danger, MEDIUM→warn, LOW→neutral; `label` is the tier text.
  - `statusBadge(status: string): { variant: Variant; label: string }` — `open`→info, `closed`/`auto_closed`/`handled`/`acknowledged`→ok, anything else→neutral; `label` is the input with `_` replaced by a space.
  - `clockBadge(status: string): { variant: Variant; label: string }` — `overdue`/`breached`→danger, `at_risk`/`warning`→warn, `running`→info, `met`/`stopped`→ok, else neutral. (Read the real clock statuses in `src/domain/clocks.ts` first and map exactly those.)
  - `barPercents(days: number | null, baseline: number): { yours: number; baseline: 100 }` — `baseline` bar is always 100; `yours` is `days/baseline*100` clamped to `[2, 100]` (2 so a 0-day result is still visible); `null` → 0.
  - CSS tokens (exact hex) below, exposed as Tailwind colours `bg-canvas`, `bg-surface`, `border-line`, `text-ink`, `text-muted`, `bg-brand`, `bg-sidebar`, etc.

Token values (the contrast test reads these from the CSS):

| Token | Hex | Token | Hex |
|---|---|---|---|
| `--color-canvas` | `#F8FAFC` | `--color-surface` | `#FFFFFF` |
| `--color-line` | `#E2E8F0` | `--color-field` | `#64748B` (input borders) |
| `--color-ink` | `#0F172A` | `--color-muted` | `#475569` |
| `--color-sidebar` | `#0F172A` | `--color-sidebar-ink` | `#E2E8F0` |
| `--color-sidebar-muted` | `#94A3B8` | `--color-brand` | `#1D4ED8` |
| `--color-brand-hover` | `#1E40AF` | `--color-ring` | `#2563EB` |
| `--color-danger-ink` / `-soft` | `#B91C1C` / `#FEF2F2` | `--color-warn-ink` / `-soft` | `#92400E` / `#FFFBEB` |
| `--color-ok-ink` / `-soft` | `#166534` / `#F0FDF4` | `--color-info-ink` / `-soft` | `#1E40AF` / `#EFF6FF` |
| `--color-neutral-ink` / `-soft` | `#334155` / `#F1F5F9` | | |

- [ ] **Step 1: Create the branch and record the baseline.** Run `git switch -c ux/dashboard-redesign` (from `p4/board-ledger-e2e`), `docker compose up -d`, then `npx eslint src tests && npm run typecheck && npm test && npm run e2e`. Expected: all green, e2e 13/13. If anything is red, stop and report; do not start restyling on a red baseline.
- [ ] **Step 2: Write failing tests.** `tests/unit/ui-status.test.ts`: `tierBadge("HIGH")` is `{variant:"danger",label:"HIGH"}`, MEDIUM→warn, LOW→neutral; `statusBadge("auto_closed").label === "auto closed"` and variant ok; `statusBadge("open").variant === "info"`; `clockBadge` covers every status string found in `src/domain/clocks.ts`; `barPercents(0, 371).yours === 2`, `barPercents(371, 371).yours === 100`, `barPercents(500, 371).yours === 100`, `barPercents(null, 371).yours === 0`, `barPercents(37.1, 371).yours` is 10 within 0.01. `tests/unit/theme-contrast.test.ts`: read `src/app/globals.css`, parse `--color-*: #hex` declarations, compute WCAG relative-luminance contrast, assert ≥ 4.5 for ink/canvas, ink/surface, muted/surface, muted/canvas, `#FFFFFF`/brand, `#FFFFFF`/brand-hover, sidebar-ink/sidebar, sidebar-muted/sidebar, and each `*-ink` over its `*-soft` (danger, warn, ok, info, neutral); assert ≥ 3 for field/surface and ring/surface and brand/surface.
- [ ] **Step 3: Run `npm test -- ui-status theme-contrast`.** Expected: FAIL (module missing; tokens missing).
- [ ] **Step 4: Implement `status.ts`** with the signatures above, and rewrite `globals.css`: Tailwind import, `@theme` block with the table's tokens plus `--font-sans: var(--font-geist-sans)` and `--font-mono: var(--font-geist-mono)`, base `body` using `bg-canvas text-ink font-sans` (delete the `Arial` rule and the dark-mode media query), `:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px }`, `@media (prefers-reduced-motion: reduce)` disabling transitions/animations, and `html { color-scheme: light }`.
- [ ] **Step 5: Run `npm test`, `npm run typecheck`, `npx eslint src tests`.** Expected: all pass (unit count up by the new tests).
- [ ] **Step 6: Commit** `git add src/app/globals.css src/components/ui/status.ts tests/unit && git commit -m "ux: design tokens, status helpers, contrast test"`.

---

### Task 2: UI primitives

**Files:**
- Create: `src/components/ui/{icons,Card,PageHeader,Badge,Button,SubmitButton,Field,Alert,EmptyState,StatCard,CompareBar,DataTable,Timeline}.tsx`

**Interfaces:**
- Consumes: `Variant`, `barPercents` from `status.ts`.
- Produces (all named exports, props-only, server components except `SubmitButton`):
  - `Card({ title?: string; titleId?: string; as?: "section" | "div"; className?: string; children })` — when `titleId` is set renders `<section aria-labelledby={titleId}>` with an `<h2 id={titleId}>`; otherwise a plain `div`. Surface, 1 px `border-line`, radius 12, faint shadow, 24 px padding.
  - `PageHeader({ title: string; description?: string; actions?: ReactNode })` — renders the page's single `<h1>` with the exact `title`.
  - `Badge({ variant: Variant; children })` — text pill, optional leading icon per variant (`icons.tsx`), colours from the `*-ink`/`*-soft` tokens.
  - `Button({ variant?: "primary" | "secondary" | "danger"; type?; className?; ...button props })` — min-height 40 px, 44 px on `pointer: coarse`.
  - `SubmitButton({ variant?, children, ...button props })` — client component; uses `useFormStatus` to set `aria-busy` and dim while pending; does not set `disabled` unless `disableWhilePending` is passed (default false).
  - `Field({ label: string; hint?: string; error?: string; children(props: { id: string; describedBy?: string }) })` — wraps a `<label>` so `getByLabel(label)` resolves to the control; hint/error get ids used in `aria-describedby`.
  - `Alert({ tone: "error" | "success" | "info"; children })` — `tone="error"` renders `role="alert"`, `success`/`info` render `role="status"`; icon `aria-hidden`.
  - `EmptyState({ children })` — one-line muted block; callers pass the existing string.
  - `StatCard({ label: string; value: ReactNode; sub?: ReactNode; testId?: string })` — big tabular number; `testId` becomes `data-testid`.
  - `CompareBar({ yoursLabel: string; yoursDays: number | null; baselineLabel: string; baselineDays: number; note?: string })` — two bars from `barPercents`, numbers as text, bars `aria-hidden`; the container must be the element a caller can tag `data-testid="kpi-uber"` (accept `testId`).
  - `DataTable({ children; caption?: string })` — `overflow-x-auto` wrapper plus `<table>`; exports `Th`, `Td` helpers (`Th` sets `scope="col"`).
  - `Timeline({ items: { id: string; title: ReactNode; meta?: ReactNode }[] })` — `<ol>` with exactly one `<li>` per item.
- [ ] **Step 1: Implement each component to the signatures above** using only token classes (no raw hex in components). Keep each file under ~60 lines. `icons.tsx` exports `IconCases`, `IconReport`, `IconBoard`, `IconFlag`, `IconLedger`, `IconDemo`, `IconAlert`, `IconCheck`, `IconInfo`, `IconMenu`, all `aria-hidden="true" focusable="false"`.
- [ ] **Step 2: Verify.** Run `npm run typecheck && npx eslint src tests`. Expected: pass. (Components are exercised by the pages in Tasks 3–7 and by e2e; no component test harness is added.)
- [ ] **Step 3: Commit** `git add src/components/ui && git commit -m "ux: ui primitives"`.

---

### Task 3: Shell, login, banner and shell e2e

**Files:**
- Create: `src/components/shell/{AppShell,Sidebar,SidebarLinks,Topbar}.tsx`, `tests/e2e/ui-shell.spec.ts`
- Modify: `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/components/Banner.tsx`, `src/app/login/page.tsx`, `src/app/page.tsx`
- Delete: `src/components/Nav.tsx` (after the shell replaces it)

**Interfaces:**
- Consumes: `navLinks(role)` from `@/domain/nav`, `Actor` from `@/domain/types`, `getActor` from `@/server/auth/actor`, icons, `Badge`.
- Produces:
  - `AppShell({ actor: Actor; children })` — grid: sidebar (desktop ≥ 768 px, fixed 240 px, `--color-sidebar`) + main column with `Topbar`. Contains the skip link `<a href="#main">Skip to main content</a>` as the first focusable element, and `<main id="main" tabIndex={-1}>` wrapper. **Pages already render their own `<main>`**: change each page's outer `<main className="p-8">` to a `<div>` as you restyle it (Tasks 4–7) so there is exactly one `<main>`; until then the shell provides the container and pages keep theirs (nested mains are not allowed, so do the swap in the same commit as each page).
  - `SidebarLinks({ links: { href: string; label: string }[] })` — client; marks the link whose `href` is a prefix of `usePathname()` with `aria-current="page"`; icon chosen by href.
  - `Topbar({ actor })` — mobile: `<details>` menu (summary labelled "Menu") containing the same links; right side: display name, role `Badge` (`neutral`), Sign out `<form action="/logout" method="post">` with a secondary `Button` named "Sign out".
  - `<nav aria-label="Main">` remains the single nav landmark (desktop sidebar and the mobile details must not both be visible to assistive tech: hide the inactive one with `hidden md:flex` / `md:hidden`, which removes it from the accessibility tree).
- [ ] **Step 1: Write the failing e2e** `tests/e2e/ui-shell.spec.ts` using `loginAs`, `firePreset` from `./fixtures`. Cases: (a) `skip link is the first tab stop`: after `loginAs(page, "sa")` and `page.goto("/cases")`, `page.keyboard.press("Tab")` then expect the focused element's text to be "Skip to main content"; (b) `banner and one h1 on every page`: as `sa` visit `/cases`, `/report`, `/flag`; as `acc` visit `/board`, `/ledger`; as `demo` visit `/demo`; as logged-out visit `/login`: each shows `getByRole("note")` containing "Demonstration — synthetic data" and `getByRole("heading", { level: 1 })` count 1; (c) `nav shows only the role's links`: `emp` sees links "Report" and "Flag" in `getByRole("navigation", { name: "Main" })` and not "Cases", "Board", "Ledger", "Demo"; `acc` sees "Board", "Ledger"; (d) `active link has aria-current`: on `/cases` as `sa`, the "Cases" link has `aria-current="page"`; (e) `no horizontal scroll at 375 px`: `page.setViewportSize({ width: 375, height: 812 })`, for `/cases`, `/flag` (after raising a flag with a 2000-character unbroken string via the `raiseFlag` fixture), and `/ledger` (after `firePreset` calls), assert `document.documentElement.scrollWidth <= window.innerWidth`; (f) `mobile menu opens by keyboard`: at 375 px, focus the "Menu" summary, press Enter, expect the "Cases" link inside it visible, press Enter again, expect it hidden.
- [ ] **Step 2: Run `npx playwright test ui-shell` (builds the app).** Expected: FAIL on skip link, aria-current, menu, banner/h1 checks that depend on the new markup.
- [ ] **Step 3: Implement the shell files** to the interfaces above. `(app)/layout.tsx` keeps its `Suspense` + `getActor()` structure and renders `<AppShell actor={actor}>` when signed in, else children alone. `Banner.tsx`: same text and `role="note"`, 4 px vertical padding, `bg-amber-200 text-black` kept (do not change colours; contrast is known-good). `layout.tsx`: body uses the base classes only. `login/page.tsx`: centred `Card`, product name above the `h1` "Sign in", `Field`s for Email and Password (keep `name`, `type`, `autoComplete`, `required`), full-width `SubmitButton` "Sign in", failure as `Alert tone="error"` with the existing text; the page keeps its Suspense wrapper and uses a `div`, not `main`, if the login route is outside the shell (it is: give it its own `<main>`). `app/page.tsx` unchanged except the container.
- [ ] **Step 4: Run `npx playwright test ui-shell`, then the full `npm run e2e`.** Expected: ui-shell green; existing 13 still green. Fix selectors in the app, never in the existing specs.
- [ ] **Step 5: Run `npx eslint src tests && npm run typecheck && npm test`.** Expected: pass.
- [ ] **Step 6: Commit** `git add -A src tests && git commit -m "ux: dashboard shell, login, shell e2e"`.

---

### Task 4: Board (hero page)

**Files:**
- Modify: `src/app/(app)/board/page.tsx`
- Test: existing `tests/e2e/replay.spec.ts` (step 8), `scenario-b.spec.ts`, `scenario-e.spec.ts`, `scenario-f.spec.ts`; add one assertion block to `ui-shell.spec.ts`

**Interfaces:**
- Consumes: `getBoard(actor)` return shape unchanged (`cases[].daysToBoard/clocks/ref/id`, `kpiBaseline`, `tier1`, `tier2`, `flags`, `unmatchedFlags`, `verify`, `lastExport`), `StatCard`, `CompareBar`, `Card`, `Badge`, `Field`, `SubmitButton`, `EmptyState`, `Alert`, `statusBadge`, `clockBadge`.
- [ ] **Step 1: Add a failing e2e block** to `ui-shell.spec.ts`: after `firePreset` presets and a declared case, as `acc` on `/board`: `getByTestId("kpi-uber")` contains "371"; `getByTestId("head-status")` is visible and in the viewport (`toBeInViewport`) at 1440×900; the Tier 2 inbox heading is within the first screen when a Tier 2 item exists (use `toBeInViewport` on `getByRole("heading", { name: "Tier 2 inbox" })`).
- [ ] **Step 2: Run it.** Expected: FAIL (`toBeInViewport` fails with the old stacked layout, or kpi markup differs).
- [ ] **Step 3: Restyle the page** (keep `requireActor`, `await sweep()`, `getBoard`, `searchParams` error handling and both server actions as they are). Layout: `PageHeader title="Board dashboard"`; error `Alert` (same text); a 4-column `StatCard` row — one `StatCard` per case with `testId="kpi-card"` and the existing sentence text "{ref}: Detection → board notice: {n} days" inside `value`/`label` so the e2e text match still holds, an "Open Tier 2" count, an "Open flags" count (`flags.length + unmatchedFlags.length`), and a ledger-integrity card holding the existing `head-status` paragraph text verbatim (`data-testid="head-status"`) with a check or alert icon plus the word "Verified" or "Verification failed" (already in the text); a `CompareBar` card (`testId="kpi-uber"`) with the baseline note text; then a two-column grid: left `Card titleId="t2"` "Tier 2 inbox" with each item a `data-testid="tier2-item"` block (status `Badge`, body, and the acknowledge `Field` + `SubmitButton` "Acknowledge" inline; handled items show "Handled: {ackNote}"); right `Card titleId="t1"` "Tier 1 notices (read-only)" and `Card titleId="fl"` "Open challenge flags" (resolve form unchanged: `Field` "Resolution", `SubmitButton` "Resolve flag", hidden inputs kept). Clocks stay in `<details>` with an "(illustrative)" summary, each clock as a row with `clockBadge` and a thin progress bar (`aria-hidden`) beside the existing "N%" text. Empty lists use `EmptyState` with the existing "None." text. Replace the outer `<main>` with a `div`.
- [ ] **Step 4: Run `npx playwright test ui-shell replay scenario-b scenario-e scenario-f`.** Expected: all pass.
- [ ] **Step 5: Run `npx eslint src tests && npm run typecheck`.** Expected: pass.
- [ ] **Step 6: Commit** `git add -A src tests && git commit -m "ux: board dashboard"`.

---

### Task 5: Cases list and case detail

**Files:**
- Modify: `src/app/(app)/cases/page.tsx`, `src/app/(app)/cases/[id]/{page,DecisionSummary,ApprovalForm,RecommendationForm}.tsx`

**Interfaces:**
- Consumes: `listCases`, `getCaseDetail` shapes unchanged; `tierBadge`, `statusBadge`, `clockBadge`, `DataTable`/`Th`/`Td`, `Timeline`, `Card`, `Field`, `SubmitButton`, `Alert`, `Badge`.
- [ ] **Step 1: Add failing e2e assertions** to `ui-shell.spec.ts`: after the replay-style setup (fire the three presets, as `sa`), `/cases` has exactly one link matching `/CASE-/`, and the `CASE-0001` row (`getByRole("row", { name: /CASE-0001/ })`) contains a visible "HIGH" text; on the case page the elements `getByTestId("tier")` and `getByTestId("status")` still show the tier and status text, `getByRole("region", { name: "Events" }).getByRole("listitem")` count is 4, and the right-rail "Decision gate" region is in the viewport at 1440×900.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Restyle `cases/page.tsx`**: `PageHeader title="Cases"`, `DataTable` with the same six columns, case ref as the only link, tier and status via `Badge`, fired rule ids as small mono chips; empty state keeps "No cases yet."; outer `main` → `div`.
- [ ] **Step 4: Restyle the case detail.** `page.tsx`: header row = `h1` (exact current content: `{c.ref}` then `data-testid="tier"` and `data-testid="status"` spans, now rendered as `Badge`s that keep those test ids and their plain text), error `Alert` with the existing messages, then a two-column grid (main 2/3, rail 1/3). `DecisionSummary.tsx` keeps every heading and `aria-labelledby` region (`summary`, `events`, `rules`) and all test ids (`clock-<id>`, `gate-state`); Events become `Timeline` (one `<li>` per event, text unchanged `{kind} — {occurredAt}`); clocks table → `DataTable` with `clockBadge` in the Status cell; the conflicts block → `Alert tone="error"` (keep its `role="alert"` behaviour: it is the page's only alert unless `?error=` is also set, as today); "Close case" stays an enabled secondary-styled `Button` with `aria-describedby="close-help"`. Right rail: Decision gate, Clocks, Fired rules, Open flags. `ApprovalForm` and `RecommendationForm`: only swap inputs/labels to `Field` and buttons to `SubmitButton`, keeping every `name`, option value, label text ("Reason code", "Proposed outcome", "Was data taken?", "Treat as", "Recommendation", outcome radios "Notify now"/"Withhold", the "Checklist" group) and the group's accessible name unchanged. Tier 1 notice keeps `<section aria-labelledby="tier1">` with `h2` "Tier 1 board notice", shown as a quoted card.
- [ ] **Step 5: Run `npx playwright test ui-shell replay scenario-b scenario-e scenario-f`.** Expected: pass.
- [ ] **Step 6: Run `npx eslint src tests && npm run typecheck`.** Expected: pass.
- [ ] **Step 7: Commit** `git add -A src tests && git commit -m "ux: cases list and case detail"`.

---

### Task 6: Ledger

**Files:**
- Modify: `src/app/(app)/ledger/page.tsx`

**Interfaces:**
- Consumes: `listLedger`, `verifyChain`, `authorize`, `exportAction`, `tamperAction` unchanged; `DataTable`, `Alert`, `Card`, `Field`, `SubmitButton`, `Button`, `StatCard`.
- [ ] **Step 1: Add failing e2e assertions** to `ui-shell.spec.ts` (as `acc` or `ia` on `/ledger?verify=1` after presets): `getByTestId("verify-result")` contains "Ledger OK"; after a tamper (use the existing `tamper` fixture) it contains "Verification failed at entry" and the page also shows a visible text label "Failed" or the alert icon's sibling text inside the integrity card; `getByTestId("entry-count")` unchanged; the tamper button (`/alter entry/i`) is inside a region named "Demo only".
- [ ] **Step 2: Run it.** Expected: FAIL on the "Demo only" region.
- [ ] **Step 3: Restyle.** `PageHeader title="Ledger"`; integrity `Card` containing the entry count (`data-testid="entry-count"` span kept) and the verify result in the single `role="status"` element with `data-testid="verify-result"` (same strings as today; failure uses the danger variant plus the word "Failed" outside the status element, not in a second status); toolbar with Verify (GET form, hidden `verify=1`, button "Verify ledger") and Export head; `DataTable` with mono hash/payload cells using `break-all`/`min-w-0` so long values wrap inside the scroll container; pagination as `Button`-styled links ("Newer"/"Older"); the tamper form moves into a separate `Card titleId="demo-only"` with `h2` "Demo only" in the danger style, label "Entry number" and the button text unchanged ("Demo only — alter entry"). Outer `main` → `div`.
- [ ] **Step 4: Run `npx playwright test ui-shell replay scenario-d`.** Expected: pass.
- [ ] **Step 5: Run `npx eslint src tests && npm run typecheck`.** Expected: pass.
- [ ] **Step 6: Commit** `git add -A src tests && git commit -m "ux: ledger"`.

---

### Task 7: Demo panel, report, flag, home

**Files:**
- Modify: `src/app/(app)/demo/{page,ResetButton}.tsx`, `src/app/(app)/report/page.tsx`, `src/app/(app)/flag/page.tsx`

**Interfaces:**
- Consumes: `REPLAY_PRESETS`, `fireAction`, `advanceAction`, `resetAction`, `reportAction`, `raiseFlagAction`, `resolveFlagAction` unchanged; `Card`, `Field`, `SubmitButton`, `Button`, `Alert`, `PageHeader`, `EmptyState`.
- [ ] **Step 1: Add failing e2e assertions** to `ui-shell.spec.ts`: `/demo` as `demo` has a region named "Replay scenario" containing one button per preset in order, a region named "Reset" containing "Reset demo", and the "Advance +24h" button is outside the Reset region; `/report` as `emp` submit still shows `getByRole("status")` with "Thank you — receipt"; `/flag` as `emp` shows `getByRole("status")` "Flag recorded for review." after submit.
- [ ] **Step 2: Run it.** Expected: FAIL on the new regions.
- [ ] **Step 3: Restyle.** Demo: `PageHeader title="Demo panel"`, a status line "Mode: DEMO_MODE on. Clock offset: +{n}h (illustrative)." inside a small `Card`; `Card titleId="replay"` "Replay scenario" with the presets as a numbered list of secondary `Button`s inside the existing per-preset `<form>`s; a clock `Card` with "Advance +24h"; a danger-styled `Card titleId="reset"` "Reset" holding `ResetButton`. `ResetButton` keeps `window.confirm` and the exact message, button text "Reset demo", danger variant. Report: `PageHeader title="Report a concern"`; the form in a max-640 px `Card` using `Field` for "Description" (textarea) and "Related reference (optional)"; error `Alert tone="error"` with the existing text; receipt `Alert tone="success"` (it carries the one `role="status"`). Flag: `PageHeader title="Raise a challenge flag"`; form `Field`s "Case reference", "What concerns you?"; success/error `Alert`s; the open-flags section as a `Card titleId="open"` with the resolve form; "None." in `EmptyState`. Replace outer `main`s with `div`s (the demo page's root `main` too).
- [ ] **Step 4: Run the full `npm run e2e`.** Expected: 13 existing + all `ui-shell` tests pass.
- [ ] **Step 5: Run `npx eslint src tests && npm run typecheck && npm test && npm run test:int`.** Expected: all pass (integration suite is untouched but proves no server change).
- [ ] **Step 6: Commit** `git add -A src tests && git commit -m "ux: demo, report, flag pages"`.

---

### Task 8: Sweep, screenshots, close-out

**Files:**
- Create: `tests/e2e/screens.spec.ts`
- Modify: `docs/ai/PROGRESS.md`, `docs/ai/HANDOVER.md`
- Delete: `src/components/Nav.tsx` (if still present and unreferenced)

**Interfaces:**
- Consumes: fixtures `loginAs`, `firePreset`, `resetDemo`, `tamper`, `verifyLedger`.
- [ ] **Step 1: Write `screens.spec.ts`** (skipped unless `process.env.SCREENSHOTS === "1"`): run the replay setup, then for viewports 1440×900, 768×1024, 375×812 save full-page PNGs to `docs/evidence/screens/<viewport>/<name>.png` for: login, report (emp), cases (sa), case detail (sa), board (acc), ledger (ia) OK state, ledger failed state (after tamper), flag (emp), demo (demo).
- [ ] **Step 2: Manual sweep, recorded in the commit message.** Tab through each page at 1440 px and confirm: the focus ring is visible on every control, order follows the visual order, no keyboard trap, the mobile menu works; zoom to 200% and 320 px and confirm no horizontal page scroll; confirm no status is colour-only (tier, status, verify failed, clocks). Fix any gap in the component, not per page.
- [ ] **Step 3: Remove dead code.** `grep -rn "components/Nav" src tests` — if nothing references it, delete `src/components/Nav.tsx`. `grep -rn 'className="border px' src` — expected: no matches (no raw bordered inputs left).
- [ ] **Step 4: Full verification.** Run `npx eslint src tests && npm run typecheck && npm test && npm run test:int && npm run build && npm run e2e && SCREENSHOTS=1 npx playwright test screens`. Expected: all green; 27 screenshots (9 views × 3 widths) written.
- [ ] **Step 5: Update docs.** `docs/ai/PROGRESS.md`: add a "UX redesign" row (done, with the real counts from Step 4). `docs/ai/HANDOVER.md`: what changed, what was verified (paste the real output counts), what was not (hosted preview run, human review), next step (open PR after P4 merges, rebase onto `main`).
- [ ] **Step 6: Commit** `git add -A src tests docs && git commit -m "ux: screenshots, sweep, docs"`.

---

## Self-Review

- **Spec coverage:** tokens/type/space/shape (Task 1, contrast test); components list (Task 2: all twelve, with `Timeline`, `EmptyState`, `CompareBar` used in Tasks 4–5); shell, skip link, mobile menu, banner (Task 3); per-page layouts: login (3), board (4), cases and detail (5), ledger (6), demo/report/flag (7); principles (pending states via `SubmitButton`, danger separation, status not colour-only: Tasks 2, 5, 6, 7); accessibility checklist (Task 3 e2e, Task 8 sweep, Task 1 contrast); screenshots at three widths and docs (Task 8); branch and order (Task 1, task order). The optional axe scan stays out, as the spec says.
- **Types:** `Variant`, `tierBadge`, `statusBadge`, `clockBadge`, `barPercents`, `Card`, `Field`, `SubmitButton`, `Alert`, `StatCard`, `CompareBar`, `DataTable` (`Th`/`Td`), `Timeline` are defined in Tasks 1–2 and used with the same names later.
- **Open check for the implementer:** `clockBadge` statuses must be copied from `src/domain/clocks.ts`; the plan names likely values but the source file decides.
- **Proportion:** the plan is about twice the spec's length, with no component bodies; steps give signatures, strings and assertions only.
