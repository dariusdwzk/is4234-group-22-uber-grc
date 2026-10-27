import { REASON_CODES } from "@/domain/gate";
import { Field } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { decideAction } from "./actions";

const inputCls =
  "min-h-10 rounded-lg border border-field bg-surface px-3 py-2 text-sm text-ink";

const CHECKS: [string, string][] = [
  ["reviewedEvidence", "I have reviewed the evidence on this page"],
  ["noPersonalConflict", "I have no personal conflict of interest"],
  ["consideredRegulatorDeadlines", "I have considered regulator deadlines"],
  ["consideredBoardNotice", "I have considered notice to the board"],
  ["notInstructedBySecurity", "I was not instructed by Security how to decide"],
];

export function ApprovalForm({ caseId }: { caseId: string }) {
  return (
    <form action={decideAction} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="caseId" value={caseId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">Outcome</legend>
        {(
          [
            ["notify_now", "Notify now"],
            ["notify_later", "Notify later"],
            ["withhold", "Withhold"],
          ] as const
        ).map(([v, l]) => (
          <label key={v} className="flex items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name="outcome"
              value={v}
              required
              className="size-4 accent-brand"
            />
            {l}
          </label>
        ))}
      </fieldset>
      <Field label="Notify-by date (only for notify later)">
        {({ id, describedBy }) => (
          <input
            id={id}
            aria-describedby={describedBy}
            type="date"
            name="notifyBy"
            className={inputCls}
          />
        )}
      </Field>
      <Field label="Reason code">
        {({ id, describedBy }) => (
          <select
            id={id}
            aria-describedby={describedBy}
            name="reasonCode"
            className={inputCls}
          >
            {REASON_CODES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">
          Checklist (all required)
        </legend>
        {CHECKS.map(([k, l]) => (
          <label key={k} className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name={k} className="size-4 accent-brand" />
            {l}
          </label>
        ))}
      </fieldset>
      <div>
        <SubmitButton>Submit decision</SubmitButton>
      </div>
    </form>
  );
}
