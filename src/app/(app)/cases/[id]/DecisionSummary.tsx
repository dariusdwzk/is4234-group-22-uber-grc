import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable, Td, Th } from "@/components/ui/DataTable";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Timeline } from "@/components/ui/Timeline";
import { clockBadge } from "@/components/ui/status";
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
    <section aria-labelledby="summary">
      <h2 id="summary" className="mb-4 text-lg font-semibold text-ink">
        Decision summary
      </h2>
      {c.conflicts.length > 0 && (
        <div className="mb-6">
          <Alert tone="error">
            <p className="font-semibold">
              Recommendation conflicts with evidence
            </p>
            <ul className="mt-1 list-disc pl-5">
              {c.conflicts.map((x) => (
                <li key={x.code}>{x.message}</li>
              ))}
            </ul>
          </Alert>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card titleId="events" title="Events">
            <Timeline
              items={c.events.map((e) => ({
                id: e.id,
                title: `${e.kind} — ${e.occurredAt}`,
              }))}
            />
          </Card>
          <Card title="Data involved">
            <p className="text-sm text-ink">
              {data.length ? data.join(", ") : "none identified"}
            </p>
          </Card>
          <Card title="Security recommendation">
            {c.recommendation ? (
              <p className="break-words text-sm text-ink">
                {c.recommendation.authorName}: {c.recommendation.proposedOutcome};
                data taken: {c.recommendation.dataTaken}; treat as{" "}
                {c.recommendation.treatAs}. {c.recommendation.text}
              </p>
            ) : (
              <p className="text-sm text-muted">None recorded.</p>
            )}
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card titleId="gate" title="Decision gate">
            <p data-testid="gate-state" className="text-sm font-medium text-ink">
              {c.gate.status === "awaiting" &&
                `Awaiting: ${c.gate.missing.map((r) => ROLE[r]).join(", ")}`}
              {c.gate.status === "agreed" && `Agreed: ${c.gate.outcome}`}
              {c.gate.status === "disagreement" &&
                "Disagreement — escalated to the board (Tier 2)"}
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-ink">
              {c.decisions.map((d) => (
                <li key={d.approverRole} className="break-words">
                  {ROLE[d.approverRole as "GC" | "PCO"]} ({d.approverName}):{" "}
                  {d.outcome}
                  {d.notifyBy ? ` by ${d.notifyBy}` : ""} — {d.reasonCode}
                </li>
              ))}
            </ul>
            {c.status === "open" && (
              // Looks unavailable but still submits, so the refusal is shown and logged (US-11).
              <form action={closeAction} className="mt-4 flex flex-col gap-2">
                <input type="hidden" name="caseId" value={c.id} />
                <div>
                  <SubmitButton variant="secondary" aria-describedby="close-help">
                    Close case
                  </SubmitButton>
                </div>
                <span id="close-help" className="text-xs text-muted">
                  Closes only when General Counsel and Privacy/Compliance agree.
                </span>
              </form>
            )}
          </Card>
          <Card titleId="clocks" title="Clocks (illustrative)">
            <DataTable>
              <thead>
                <tr>
                  <Th>Clock</Th>
                  <Th>Status</Th>
                  <Th>Due</Th>
                  <Th>Elapsed</Th>
                </tr>
              </thead>
              <tbody>
                {c.clocks.map((k) => {
                  const cb = clockBadge(k.status);
                  return (
                    <tr key={k.id} data-testid={`clock-${k.id}`}>
                      <Td>
                        {k.label}
                        {k.note && (
                          <div className="text-xs text-muted">{k.note}</div>
                        )}
                      </Td>
                      <Td>
                        <Badge variant={cb.variant}>{k.status}</Badge>
                      </Td>
                      <Td>{k.dueAt ?? "—"}</Td>
                      <Td>
                        {k.pctElapsed === null ? "—" : `${k.pctElapsed}%`}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
            {canMateriality && !c.materialityRecorded && c.status === "open" && (
              <form action={materialityAction} className="mt-4">
                <input type="hidden" name="caseId" value={c.id} />
                <SubmitButton variant="secondary">
                  Record materiality determination
                </SubmitButton>
              </form>
            )}
          </Card>
          <Card titleId="rules" title="Fired rules">
            <ul className="flex flex-col gap-2 text-sm text-ink">
              {c.firedRuleIds.map((r) => (
                <li key={r} className="break-words">
                  <code className="rounded bg-neutral-soft px-1.5 py-0.5 font-mono text-xs text-neutral-ink">
                    {r}
                  </code>
                  : {descriptions.get(r) ?? ""}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Open flags">
            <p className="text-2xl font-semibold text-ink">{c.openFlagCount}</p>
          </Card>
        </div>
      </div>
    </section>
  );
}
