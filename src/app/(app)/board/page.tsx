import { Suspense } from "react";
import { sweep } from "@/server/commands/sweep";
import { requireActor } from "@/server/page-guard";
import { getBoard } from "@/server/queries/board";
import { acknowledgeAction, resolveFlagAction } from "./actions";

async function Board({ searchParams }: PageProps<"/board">) {
  const actor = await requireActor("viewBoard");
  await sweep(); // escalations are evaluated on load (spec §8), as the system actor
  const b = await getBoard(actor);
  const sp = await searchParams;
  return (
    <>
      {typeof sp.error === "string" && (
        <p role="alert" className="border-2 border-red-700 p-2">
          That action could not be completed. Check the form.
        </p>
      )}
      <section aria-labelledby="kpi" className="mb-6">
        <h2 id="kpi" className="font-semibold">
          Detection to board notice
        </h2>
        <ul className="flex flex-wrap gap-4">
          {b.cases.map((c) => (
            <li key={c.id} className="border p-3" data-testid="kpi-card">
              {c.ref}: Detection → board notice:{" "}
              <strong>{c.daysToBoard ?? "n/a"} days</strong>
            </li>
          ))}
          <li className="border p-3" data-testid="kpi-uber">
            Uber 2016: {b.kpiBaseline.detectionToDisclosureDays} days to
            disclosure
            <br />
            <small>{b.kpiBaseline.note}</small>
          </li>
        </ul>
        {b.cases.map((c) => (
          <details key={c.id} className="mt-2">
            <summary>{c.ref} clocks (illustrative)</summary>
            <ul>
              {c.clocks.map((k) => (
                <li key={k.id}>
                  {k.label}: {k.status}
                  {k.pctElapsed !== null ? ` (${k.pctElapsed}%)` : ""}
                  {k.dueAt ? `, due ${k.dueAt}` : ""}
                  {k.note ? ` — ${k.note}` : ""}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>

      <section aria-labelledby="t1" className="mb-6">
        <h2 id="t1" className="font-semibold">
          Tier 1 notices (read-only)
        </h2>
        <ul>
          {b.tier1.map((t) => (
            <li key={t.id} className="border-t py-2">
              {t.body}
            </li>
          ))}
          {b.tier1.length === 0 && <li>None.</li>}
        </ul>
      </section>

      <section aria-labelledby="t2" className="mb-6">
        <h2 id="t2" className="font-semibold">
          Tier 2 inbox
        </h2>
        <ul>
          {b.tier2.map((t) => (
            <li key={t.id} className="border-t py-2" data-testid="tier2-item">
              <p>
                [{t.status}] {t.body}
              </p>
              {t.status === "open" ? (
                <form action={acknowledgeAction} className="mt-1 flex gap-2">
                  <input type="hidden" name="itemId" value={t.id} />
                  <label>
                    Action note
                    <input
                      name="actionNote"
                      required
                      minLength={5}
                      maxLength={2000}
                      className="ml-2 border px-1"
                    />
                  </label>
                  <button type="submit" className="border px-3">
                    Acknowledge
                  </button>
                </form>
              ) : (
                <p>Handled: {t.ackNote}</p>
              )}
            </li>
          ))}
          {b.tier2.length === 0 && <li>None.</li>}
        </ul>
      </section>

      <section aria-labelledby="fl" className="mb-6">
        <h2 id="fl" className="font-semibold">
          Open challenge flags
        </h2>
        <ul>
          {b.flags.map((f) => (
            <li key={f.id} className="border-t py-2">
              {f.ref} — {f.text}
              <form action={resolveFlagAction} className="mt-1 flex gap-2">
                <input type="hidden" name="flagId" value={f.id} />
                <input type="hidden" name="from" value="board" />
                <label>
                  Resolution
                  <input
                    name="resolution"
                    required
                    minLength={5}
                    maxLength={2000}
                    className="ml-2 border px-1"
                  />
                </label>
                <button type="submit" className="border px-3">
                  Resolve flag
                </button>
              </form>
            </li>
          ))}
          {b.unmatchedFlags.map((u) => (
            <li key={u.ts} className="border-t py-2">
              Unmatched case reference — {u.text}
            </li>
          ))}
          {b.flags.length + b.unmatchedFlags.length === 0 && <li>None.</li>}
        </ul>
      </section>

      <section aria-labelledby="hd">
        <h2 id="hd" className="font-semibold">
          Ledger head
        </h2>
        <p data-testid="head-status">
          {b.verify.ok
            ? `Verified: ${b.verify.count} entries, head ${b.verify.headHash.slice(0, 12)}.`
            : `Verification failed at entry ${b.verify.failedAtSeq}.`}{" "}
          {b.lastExport
            ? `Last export (simulated auditor inbox): entry ${b.lastExport.seq}, ${b.verify.exportedHead?.matches ? "matches" : "DOES NOT MATCH"}.`
            : "No head exported yet."}
        </p>
      </section>
    </>
  );
}

export default function BoardPage(props: PageProps<"/board">) {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Board dashboard</h1>
      <Suspense fallback={null}>
        <Board {...props} />
      </Suspense>
    </main>
  );
}
