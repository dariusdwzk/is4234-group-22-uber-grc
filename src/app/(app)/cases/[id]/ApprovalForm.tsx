import { REASON_CODES } from "@/domain/gate";
import { decideAction } from "./actions";

const CHECKS: [string, string][] = [
  ["reviewedEvidence", "I have reviewed the evidence on this page"],
  ["noPersonalConflict", "I have no personal conflict of interest"],
  ["consideredRegulatorDeadlines", "I have considered regulator deadlines"],
  ["consideredBoardNotice", "I have considered notice to the board"],
  ["notInstructedBySecurity", "I was not instructed by Security how to decide"],
];

export function ApprovalForm({ caseId }: { caseId: string }) {
  return (
    <form action={decideAction} className="flex max-w-xl flex-col gap-2">
      <input type="hidden" name="caseId" value={caseId} />
      <fieldset className="flex flex-col gap-1">
        <legend>Outcome</legend>
        {(
          [
            ["notify_now", "Notify now"],
            ["notify_later", "Notify later"],
            ["withhold", "Withhold"],
          ] as const
        ).map(([v, l]) => (
          <label key={v}>
            <input type="radio" name="outcome" value={v} required /> {l}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1">
        Notify-by date (only for notify later)
        <input type="date" name="notifyBy" className="border px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1">
        Reason code
        <select name="reasonCode" className="border px-2 py-1">
          {REASON_CODES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend>Checklist (all required)</legend>
        {CHECKS.map(([k, l]) => (
          <label key={k}>
            <input type="checkbox" name={k} /> {l}
          </label>
        ))}
      </fieldset>
      <button type="submit" className="border px-3 py-1">
        Submit decision
      </button>
    </form>
  );
}
