import type { CaseDetail } from "@/server/queries/cases";
import { closeAction, materialityAction } from "./actions";

const ROLE = { GC: "General Counsel", PCO: "Privacy/Compliance" } as const;

export function DecisionSummary({
  c,
  descriptions,
  canMateriality,
}: {
  c: CaseDetail;
  descriptions: Map<string, string>;
  canMateriality: boolean;
}) {
  const data = [
    ...(c.facts.personalDataAccessed ? ["personal data"] : []),
    ...(c.facts.amountCents > 0 ? ["payment details"] : []),
  ];
  return (
    <section aria-labelledby="summary" className="mt-4 flex flex-col gap-4">
      <h2 id="summary" className="text-xl font-semibold">
        Decision summary
      </h2>
      {c.conflicts.length > 0 && (
        <div role="alert" className="border-2 border-red-700 p-3">
          <p className="font-semibold">
            Recommendation conflicts with evidence
          </p>
          <ul>
            {c.conflicts.map((x) => (
              <li key={x.code}>{x.message}</li>
            ))}
          </ul>
        </div>
      )}
      <section aria-labelledby="events">
        <h3 id="events" className="font-semibold">
          Events
        </h3>
        <ol className="list-decimal pl-6">
          {c.events.map((e) => (
            <li key={e.id}>
              {e.kind} — {e.occurredAt}
            </li>
          ))}
        </ol>
      </section>
      <div>
        <h3 className="font-semibold">Data involved</h3>
        <p>{data.length ? data.join(", ") : "none identified"}</p>
      </div>
      <section aria-labelledby="rules">
        <h3 id="rules" className="font-semibold">
          Fired rules
        </h3>
        <ul>
          {c.firedRuleIds.map((r) => (
            <li key={r}>
              {r}: {descriptions.get(r) ?? ""}
            </li>
          ))}
        </ul>
      </section>
      <div>
        <h3 className="font-semibold">Clocks (illustrative)</h3>
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="border px-2 text-left">Clock</th>
              <th className="border px-2">Status</th>
              <th className="border px-2">Due</th>
              <th className="border px-2">Elapsed</th>
            </tr>
          </thead>
          <tbody>
            {c.clocks.map((k) => (
              <tr key={k.id} data-testid={`clock-${k.id}`}>
                <td className="border px-2">
                  {k.label}
                  {k.note && <div>{k.note}</div>}
                </td>
                <td className="border px-2">{k.status}</td>
                <td className="border px-2">{k.dueAt ?? "—"}</td>
                <td className="border px-2">
                  {k.pctElapsed === null ? "—" : `${k.pctElapsed}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {canMateriality && !c.materialityRecorded && c.status === "open" && (
          <form action={materialityAction} className="mt-2">
            <input type="hidden" name="caseId" value={c.id} />
            <button type="submit" className="border px-3 py-1">
              Record materiality determination
            </button>
          </form>
        )}
      </div>
      <div>
        <h3 className="font-semibold">Security recommendation</h3>
        {c.recommendation ? (
          <p>
            {c.recommendation.authorName}: {c.recommendation.proposedOutcome};
            data taken: {c.recommendation.dataTaken}; treat as{" "}
            {c.recommendation.treatAs}. {c.recommendation.text}
          </p>
        ) : (
          <p>None recorded.</p>
        )}
      </div>
      <div>
        <h3 className="font-semibold">Open flags</h3>
        <p>{c.openFlagCount}</p>
      </div>
      <div>
        <h3 className="font-semibold">Decision gate</h3>
        <p data-testid="gate-state">
          {c.gate.status === "awaiting" &&
            `Awaiting: ${c.gate.missing.map((r) => ROLE[r]).join(", ")}`}
          {c.gate.status === "agreed" && `Agreed: ${c.gate.outcome}`}
          {c.gate.status === "disagreement" &&
            "Disagreement — escalated to the board (Tier 2)"}
        </p>
        <ul>
          {c.decisions.map((d) => (
            <li key={d.approverRole}>
              {ROLE[d.approverRole as "GC" | "PCO"]} ({d.approverName}):{" "}
              {d.outcome}
              {d.notifyBy ? ` by ${d.notifyBy}` : ""} — {d.reasonCode}
            </li>
          ))}
        </ul>
        {c.status === "open" && (
          // Looks unavailable but still submits, so the refusal is shown and logged (US-11).
          <form action={closeAction} className="mt-2">
            <input type="hidden" name="caseId" value={c.id} />
            <button
              type="submit"
              className="border px-3 py-1 text-gray-500"
              aria-describedby="close-help"
            >
              Close case
            </button>
            <span id="close-help" className="ml-2 text-sm">
              Closes only when General Counsel and Privacy/Compliance agree.
            </span>
          </form>
        )}
      </div>
    </section>
  );
}
