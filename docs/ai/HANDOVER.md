# Handover

**Changed:** UX redesign on branch `ux/dashboard-redesign` (not pushed, no PR). Design tokens, shared UI components (`src/components/ui/*`), app shell with sidebar, skip link and mobile menu, every page restyled (login, report, cases, case detail, board, ledger, flag, demo). Old `Nav.tsx` removed. `tests/e2e/screens.spec.ts` (skipped unless `SCREENSHOTS=1`) writes 27 PNGs to `docs/evidence/screens/{1440,768,375}/`. Board page now uses `controlClass` instead of a local `inputCls`.
**Verified (local, Postgres 16):** `npx eslint src tests` clean, typecheck clean, build OK. Unit 390/391 pass; the one failure is `.claude/worktrees/p1-.../tests/unit/authz.test.ts` (stale worktree copy, not the repo's test). Integration 136/136. `npm run e2e` 27 passed, 2 skipped (screens), including clock-cell no-clip checks at 768/1024/1440, 375px ledger column and integrity-icon (`data-state`) assertions. `SCREENSHOTS=1 npx playwright test screens` 2 passed, 27 PNGs.
**Not verified / not done:** hosted preview run; human review; PR not opened; e2e not yet a required check. Screenshots re-checked: at 768 the Clocks table shows all four columns (Due wraps after `T`, Elapsed visible, no sideways scroll); at 1440 Due stays on one line; ledger 375 shows # / Actor+time / Event; board shows "No head exported since the last reset." with the check icon after a reset (page-level fix, see carry-over).
**Next:** open PR after P4 merges, rebase onto `main`, add `E2E_BASE_URL`, then P4 Task 5.
**Decisions:** presentation only (no server/domain/migration change); status never colour-only (icon plus text); the shell wrapper is `div#main` and each page keeps its own `<main>`; screenshots are committed as evidence.
**Gotchas:** run `npx eslint src tests`, not bare `npm run lint` (scans `.claude/worktrees`). Stray macOS `.next/types/* 2.ts` duplicates break `tsc`; delete them. Playwright runs `npm run build && npm run start`, so cold-start timing matters. Integration suite TRUNCATEs the target DB.

## P4 carry-over (still open)
- Task 5 (Neon preview migrate+seed, then hosted e2e) is Darius's; needs Neon credentials.
- Mark `e2e` a required check; no reviewer-agent pass on P4 yet; human review of the `reset-demo.ts` lock change; manual click-through.
- P4 decisions: (1) unmatched `caseRef` flag is a `FLAG_RAISED` entry with `matched:false`, no Tier 2 row (no migration allowed). (2) `resetDemo` takes `LOCK TABLE ledger_head IN ACCESS EXCLUSIVE MODE` first (row-lock deadlock reproduced). (3) `viewLedger` gained DEMO; `sweep` is EXEC only; board nav is ACC only. (4) Tamper leaves the stored hash, so an exported head still matches at its seq; verify fails by chain walk. (5) +24h expires the 8 h demo session; e2e re-logs in. (6) `kpi.ts` written before its test ran red.
- Playwright has no `E2E_BASE_URL` support, so hosted runs are not possible yet.
- `board.ts` `lastExport` ignores resets while `verify.ts` ignores pre-reset exports; this branch works around it in `board/page.tsx` only. Proper server fix plus test is a separate change. A true mismatch state cannot be produced by current e2e fixtures (tamper edits payload only), so it is untested.
- Mobile ledger hides hash/payload cells (not reachable below md).
- Screens spec uses real timestamps, so entry counts differ between viewport captures.
