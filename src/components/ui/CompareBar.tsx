import { barPercents } from "./status";

export function CompareBar({
  yoursLabel,
  yoursDays,
  baselineLabel,
  baselineDays,
  note,
  testId,
}: {
  yoursLabel: string;
  yoursDays: number | null;
  baselineLabel: string;
  baselineDays: number;
  note?: string;
  testId?: string;
}) {
  const pct = barPercents(yoursDays, baselineDays);
  const row = (label: string, text: string, width: number, color: string) => (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="tabular-nums text-muted">{text}</span>
      </div>
      <div aria-hidden="true" className="mt-1 h-3 rounded bg-neutral-soft">
        <div className={`h-3 rounded ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
  return (
    <div data-testid={testId} className="flex flex-col gap-3">
      {row(yoursLabel, yoursDays === null ? "not yet" : `${yoursDays} days`, pct.yours, "bg-brand")}
      {row(baselineLabel, `${baselineDays} days`, pct.baseline, "bg-field")}
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}
