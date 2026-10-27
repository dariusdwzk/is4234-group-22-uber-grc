import { Suspense } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CompareBar } from "@/components/ui/CompareBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, controlClass } from "@/components/ui/Field";
import { IconAlert, IconCheck } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { clockBadge, statusBadge } from "@/components/ui/status";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { sweep } from "@/server/commands/sweep";
import { requireActor } from "@/server/page-guard";
import { getBoard } from "@/server/queries/board";
import { acknowledgeAction, resolveFlagAction } from "./actions";

async function Board({ searchParams }: PageProps<"/board">) {
  const actor = await requireActor("viewBoard");
  await sweep(); // escalations are evaluated on load (spec §8), as the system actor
  const b = await getBoard(actor);
  const sp = await searchParams;
  // verify.ts ignores exports made before the last DEMO_RESET but getBoard's lastExport does not.
  const exportState = !b.lastExport
    ? "none"
    : b.verify.exportedHead === undefined
      ? "stale"
      : b.verify.exportedHead.matches
        ? "match"
        : "mismatch";
  const iconState = b.verify.ok && exportState !== "mismatch" ? "ok" : "alert";
  const openTier2 = b.tier2.filter((t) => t.status === "open").length;
  const first = b.cases[0];
  return (
    <>
      {typeof sp.error === "string" && (
        <div className="mb-4">
          <Alert tone="error">
            That action could not be completed. Check the form.
          </Alert>
        </div>
      )}

      <section aria-labelledby="kpi" className="mb-6">
        <h2 id="kpi" className="sr-only">
          Detection to board notice
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {b.cases.map((c) => (
            <StatCard
              key={c.id}
              testId="kpi-card"
              label={`${c.ref}: Detection → board notice:`}
              value={`${c.daysToBoard ?? "n/a"} days`}
            />
          ))}
          <StatCard label="Open Tier 2" value={openTier2} />
          <StatCard
            label="Open flags"
            value={b.flags.length + b.unmatchedFlags.length}
          />
          <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <span data-testid="integrity-icon" data-state={iconState}>
                {iconState === "ok" ? <IconCheck /> : <IconAlert />}
              </span>
              Ledger integrity
            </p>
            <p
              data-testid="head-status"
              className="mt-2 break-words text-sm text-muted"
            >
              {b.verify.ok
                ? `Verified: ${b.verify.count} entries, head ${b.verify.headHash.slice(0, 12)}.`
                : `Verification failed at entry ${b.verify.failedAtSeq}.`}{" "}
              {exportState === "none"
                ? "No head exported yet."
                : exportState === "stale"
                  ? "No head exported since the last reset."
                  : `Last export (simulated auditor inbox): entry ${b.lastExport!.seq}, ${exportState === "match" ? "matches" : "DOES NOT MATCH"}.`}
            </p>
          </div>
        </div>
      </section>

      <div className="mb-6 rounded-xl border border-line bg-surface p-6 shadow-sm">
        <CompareBar
          testId="kpi-uber"
          yoursLabel={first ? `${first.ref} detection to board notice` : "No case yet"}
          yoursDays={first?.daysToBoard ?? null}
          baselineLabel={`Uber 2016: ${b.kpiBaseline.detectionToDisclosureDays} days to disclosure`}
          baselineDays={b.kpiBaseline.detectionToDisclosureDays}
          note={b.kpiBaseline.note}
        />
        {b.cases.map((c) => (
          <details key={c.id} className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium text-ink">
              {c.ref} clocks (illustrative)
            </summary>
            <ul className="mt-2 flex flex-col gap-2">
              {c.clocks.map((k) => {
                const cb = clockBadge(k.status);
                return (
                  <li
                    key={k.id}
                    className="flex flex-wrap items-center gap-2 break-words"
                  >
                    <Badge variant={cb.variant}>{cb.label}</Badge>
                    <span>
                      {k.label}: {k.status}
                      {k.pctElapsed !== null ? ` (${k.pctElapsed}%)` : ""}
                      {k.dueAt ? `, due ${k.dueAt}` : ""}
                      {k.note ? ` — ${k.note}` : ""}
                    </span>
                    {k.pctElapsed !== null && (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-24 rounded bg-neutral-soft"
                      >
                        <span
                          className="block h-1.5 rounded bg-brand"
                          style={{ width: `${Math.min(100, k.pctElapsed)}%` }}
                        />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card titleId="t2" title="Tier 2 inbox">
          <ul className="flex flex-col gap-4">
            {b.tier2.map((t) => {
              const sb = statusBadge(t.status);
              return (
                <li
                  key={t.id}
                  className="border-t border-line pt-4 first:border-t-0 first:pt-0"
                  data-testid="tier2-item"
                >
                  <p className="flex flex-wrap items-start gap-2 break-words text-sm">
                    <Badge variant={sb.variant}>{sb.label}</Badge>
                    <span className="min-w-0 break-words">{t.body}</span>
                  </p>
                  {t.status === "open" ? (
                    <form
                      action={acknowledgeAction}
                      className="mt-2 flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="itemId" value={t.id} />
                      <Field label="Action note">
                        {({ id, describedBy }) => (
                          <input
                            id={id}
                            aria-describedby={describedBy}
                            name="actionNote"
                            required
                            minLength={5}
                            maxLength={2000}
                            className={controlClass}
                          />
                        )}
                      </Field>
                      <SubmitButton>Acknowledge</SubmitButton>
                    </form>
                  ) : (
                    <p className="mt-2 break-words text-sm text-muted">
                      Handled: {t.ackNote}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          {b.tier2.length === 0 && <EmptyState>None.</EmptyState>}
        </Card>

        <div className="flex flex-col gap-6">
          <Card titleId="t1" title="Tier 1 notices (read-only)">
            <ul className="flex flex-col gap-3 text-sm">
              {b.tier1.map((t) => (
                <li key={t.id} className="break-words">
                  {t.body}
                </li>
              ))}
            </ul>
            {b.tier1.length === 0 && <EmptyState>None.</EmptyState>}
          </Card>

          <Card titleId="fl" title="Open challenge flags">
            <ul className="flex flex-col gap-4">
              {b.flags.map((f) => (
                <li
                  key={f.id}
                  className="border-t border-line pt-4 text-sm first:border-t-0 first:pt-0"
                >
                  <p className="break-words">
                    {f.ref} — {f.text}
                  </p>
                  <form
                    action={resolveFlagAction}
                    className="mt-2 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="flagId" value={f.id} />
                    <input type="hidden" name="from" value="board" />
                    <Field label="Resolution">
                      {({ id, describedBy }) => (
                        <input
                          id={id}
                          aria-describedby={describedBy}
                          name="resolution"
                          required
                          minLength={5}
                          maxLength={2000}
                          className={controlClass}
                        />
                      )}
                    </Field>
                    <SubmitButton>Resolve flag</SubmitButton>
                  </form>
                </li>
              ))}
              {b.unmatchedFlags.map((u) => (
                <li
                  key={u.ts}
                  className="break-words border-t border-line pt-4 text-sm first:border-t-0 first:pt-0"
                >
                  Unmatched case reference — {u.text}
                </li>
              ))}
            </ul>
            {b.flags.length + b.unmatchedFlags.length === 0 && (
              <EmptyState>None.</EmptyState>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export default function BoardPage(props: PageProps<"/board">) {
  return (
    <main className="p-6 lg:p-8">
      <PageHeader title="Board dashboard" />
      <Suspense fallback={null}>
        <Board {...props} />
      </Suspense>
    </main>
  );
}
