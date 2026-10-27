# Dashboard UI/UX redesign — design

Status: draft for review (2026-10-27). Source of truth for behaviour stays `2026-10-26-uber-grc-prototype-design.md`; this spec changes presentation only.

## 1. Intent

Make the demonstrator look and read like a governance dashboard: a persistent sidebar shell, card-based pages, clear status at a glance, and the headline comparison (detection → board notice vs Uber's 371 days) impossible to miss. The audience is the course assessors, who see the app through the 5-minute video, the guide PDF and screenshots (S1–S8), so the demo path gets the most care.

Success criteria:
1. Every page uses the same shell, tokens and components; no page has hand-rolled borders or inputs.
2. The board page answers "what needs my attention, and are we faster than 2016?" within 5 seconds, without scrolling at 1440×900.
3. WCAG 2.2 AA on the checks in §7; usable from 360 px to 1440 px wide.
4. `npm run e2e` (13 tests), lint, typecheck, unit and integration suites pass unchanged.
5. No change to behaviour, authorisation, data, or any file under `src/server/**` or `src/domain/**`.

Non-goals: new features or filters, charts library, dark mode, new dependencies, copy changes that alter e2e-matched text.

## 2. Hard constraints

- The banner `Demonstration — synthetic data` stays on every page (`role="note"`, in the root layout).
- E2E matches by role, label, heading text and exact strings, plus `data-testid` values `kpi-card`, `kpi-uber`, `tier2-item`, `head-status`, `tier`, `status`, `verify-result`, `entry-count`. All of these, every `h1`/`h2` text, every form label and every button name stay exactly as they are. Components may add wrapper elements, never rename.
- Wording rules from `CLAUDE.md` hold: "designed in alignment with", clock text marked "illustrative".
- Roles and navigation come from `src/domain/nav.ts`; the shell reads them, it does not decide them.

## 3. Approach (chosen)

Design tokens in Tailwind v4 `@theme` plus a small shared component set under `src/components/ui/`, then restyle each page to use them. Rejected: per-page class tweaks (drifts, leaves the "no system" problem) and a component library such as shadcn/Radix (new dependency intake, risks the label/role matching close to freeze).

## 4. Design system

**Theme:** light only. Neutral slate surfaces, a dark navy sidebar, one blue accent, semantic colours for state. Tokens live in `globals.css` as CSS variables exposed through `@theme inline`.

| Token group | Values (starting point; contrast verified in implementation) |
|---|---|
| Surface | `--bg` slate-50, `--card` white, `--sidebar` slate-900, `--border` slate-200 |
| Text | `--fg` slate-900, `--muted` slate-600 (≥4.5:1 on card and bg) |
| Accent | `--accent` blue-700, hover blue-800, focus ring blue-600 at 2 px with 2 px offset |
| Semantic | danger red-700 on red-50, warn amber-800 on amber-50, ok green-800 on green-50, info blue-800 on blue-50, neutral slate-700 on slate-100 |
| Type | Geist (fix the `Arial` override in `globals.css`); scale 12/14/16/20/24/32; page title 24 semibold; card title 16 semibold; `tabular-nums` for all numbers; Geist Mono for hashes and payloads |
| Space & shape | 4 px base unit (8/12/16/24/32); radius 8 (controls) and 12 (cards); cards are 1 px border plus a faint shadow |

**Components** (`src/components/ui/`, server components unless noted; each small and props-only):

| Component | Purpose |
|---|---|
| `AppShell`, `Sidebar`, `Topbar` | Persistent left nav with icon + label per link, active-link state (`aria-current="page"`), user chip (name, role badge), Sign out. Below 768 px the sidebar becomes a `<details>`-based menu so it needs no client JS. |
| `PageHeader` | `h1` (unchanged text), optional description, optional action slot. |
| `Card`, `CardHeader` | Section container; takes the existing `aria-labelledby` heading id. |
| `StatCard` | Big number, label, optional delta/comparison slot. |
| `CompareBar` | The 371-day comparison: two horizontal bars on one scale, with the number in text so the bar is decoration. Used on the board. |
| `Badge` | Tier (HIGH red, MEDIUM amber, LOW slate), case status, clock state, Tier 2 status. Always icon or text plus colour, never colour alone. |
| `Button` | Primary, secondary, danger; 40 px minimum height, 44 px hit area on touch. Wraps `<button>`; the forms keep their server actions. |
| `Field` | Label above input, optional hint, inline error with `aria-describedby`. Keeps the existing `<label>` association so `getByLabel` still works. |
| `Alert` | `role="alert"` (errors) or `role="status"` (results) with icon; replaces the red-bordered `<p>`s. |
| `DataTable` | Sticky header, `th scope`, mono and numeric column alignment, comfortable row height, horizontal scroll container on small screens. |
| `EmptyState` | Replaces bare "None." / "No cases yet." with a one-line explanation. Existing strings stay inside it. |
| `Timeline` | Vertical event list for case events and ledger-adjacent history. |

Status helpers (tier → badge variant, clock → progress colour) go in one `src/components/ui/status.ts` so the mapping is not repeated per page.

## 5. Shell and page layouts

Root layout: banner (kept, slimmer, still full width and first in DOM) then the shell. Signed-out pages (login) render without the sidebar. A skip link ("Skip to main content") is the first focusable element.

Content area: max-width 1200 px, 24 px gutters on desktop, 16 px on mobile, page title then a 12-column grid of cards.

| Page | Layout |
|---|---|
| **Login** | Centred card on the slate background: product name, `h1` "Sign in", Email, Password, full-width primary button, error as `Alert`. No credential hints. |
| **Board** (hero) | Row 1, four `StatCard`s: detection → board notice (per case, `data-testid="kpi-card"`), open Tier 2 count, open flags count, ledger integrity (`data-testid="head-status"` text kept; OK or failed state with icon). Row 2: `CompareBar` card (`kpi-uber` kept, including the note text). Row 3 left: Tier 2 inbox, the primary action, each item a card with the acknowledge form inline. Row 3 right: Tier 1 feed (read-only) and open flags with the resolve form. Clocks: progress bars inside each case's `<details>`, labelled "(illustrative)". |
| **Cases** | `PageHeader` plus one `DataTable`; tier and status as badges; case ref is the link; fired rules as small mono chips. |
| **Case detail** | Header: ref, tier badge, status badge (`tier`/`status` test ids kept). Main column: `DecisionSummary`, events `Timeline`, recommendation and approval forms. Right rail: gate status (who has approved, who is missing), clocks, fired rules with descriptions. Tier 1 notice as a quoted card. Errors as `Alert` at the top. |
| **Ledger** | Integrity card at top (verify result in `role="status"`, `verify-result` kept, failure shown as red with the entry number and a text label), toolbar for Verify and Export head, `DataTable` with mono hash and payload, pagination as buttons. Tamper control in a separate "Demo only" danger card, never next to normal actions. |
| **Demo panel** | Replay steps as a numbered list of preset buttons grouped under "Replay scenario", a clock card (offset, "Advance +24h"), and a "Reset" danger card. Heading stays "Demo panel". |
| **Report / Flag** | Single-column form card, 640 px max, field hints, character counts only if already present. Receipt message stays in `role="status"`. |

## 6. UX principles applied (and where)

- **Hierarchy and scanning:** one primary action per card; status first, detail second; numbers large, labels small.
- **Hick's and Miller's laws:** the sidebar shows only what the role may use (max 6 links); tables show the essential columns, detail on the case page.
- **Recognition over recall:** icons paired with labels in nav; consistent badge colours for tier and status everywhere.
- **Visibility of system status:** submit buttons show a pending state (small client wrapper using `useFormStatus`); verify and export results are announced in `role="status"`.
- **Error prevention and recovery:** destructive and demo-only actions (tamper, reset) are visually separated and keep their existing confirmation; form errors sit next to the field plus a summary `Alert`.
- **Consistency:** one spacing scale, one radius, one button family; no raw `border px-2 py-1` inputs remain.
- **Fitts's law and touch:** 44 px targets on touch, primary actions aligned to the card's bottom right, sidebar items full-width.
- **Calm motion:** transitions limited to colour and 150 ms; respect `prefers-reduced-motion`.

## 7. Accessibility checklist (WCAG 2.2 AA)

Text contrast ≥ 4.5:1 and UI-component contrast ≥ 3:1, checked token by token; visible `:focus-visible` ring on every control; one `h1` per page, ordered headings, landmarks (`header` banner note, `nav` "Main", `main`); skip link; status never conveyed by colour alone; labels programmatically tied to inputs; tables use `th scope`; layouts reflow at 320 CSS px with no horizontal page scroll; zoom to 200% without loss; `prefers-reduced-motion` honoured.

## 8. Delivery and verification

Branch `ux/dashboard-redesign`, cut from `p4/board-ledger-e2e` while P4 is unmerged and rebased onto `main` once it merges. Work in four passes, each ending with `npx eslint src tests`, `npm run typecheck`, `npm test`, and `npm run e2e` all green:

1. Tokens, font fix, shell, banner, skip link, login.
2. Board and `ui/` components it needs.
3. Cases, case detail, ledger.
4. Demo panel, report, flag; contrast and keyboard sweep.

Evidence: after pass 4, Playwright screenshots at 1440, 768 and 375 px of every page (these double as the P5 S1–S8 screenshots), saved under `docs/evidence/screens/`. An automated accessibility scan (`@axe-core/playwright`) would be a new dependency and needs the 5-line intake check; it is optional and off by default, with the manual §7 checklist as the baseline.

Risks: (1) e2e selectors broken by wrapper elements or text changes — mitigated by §2 and running e2e after every pass; (2) merge conflicts with P4 review fixes in the same page files — mitigated by branching from the P4 tip; (3) scope creep into behaviour — anything needing new logic goes to a separate item, and P5 forbids new features.

## 9. Decisions to confirm

- Light theme only (no dark mode).
- Navy sidebar with a single blue accent (tokens in §4 are a starting point, not final).
- Demo-path pages first (login, board, case detail, ledger, demo panel), then the rest.
