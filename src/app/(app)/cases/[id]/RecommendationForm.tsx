import { Field } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { recommendAction } from "./actions";

const inputCls =
  "min-h-10 rounded-lg border border-field bg-surface px-3 py-2 text-sm text-ink";

export function RecommendationForm({ caseId }: { caseId: string }) {
  return (
    <form action={recommendAction} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="caseId" value={caseId} />
      <Field label="Proposed outcome">
        {({ id, describedBy }) => (
          <select
            id={id}
            aria-describedby={describedBy}
            name="proposedOutcome"
            className={inputCls}
          >
            <option value="notify_now">Notify now</option>
            <option value="notify_later">Notify later</option>
            <option value="withhold">Withhold</option>
          </select>
        )}
      </Field>
      <Field label="Was data taken?">
        {({ id, describedBy }) => (
          <select
            id={id}
            aria-describedby={describedBy}
            name="dataTaken"
            className={inputCls}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="unknown">Unknown</option>
          </select>
        )}
      </Field>
      <Field label="Treat as">
        {({ id, describedBy }) => (
          <select
            id={id}
            aria-describedby={describedBy}
            name="treatAs"
            className={inputCls}
          >
            <option value="incident">Incident</option>
            <option value="bug_bounty">Bug bounty</option>
          </select>
        )}
      </Field>
      <Field label="Recommendation">
        {({ id, describedBy }) => (
          <textarea
            id={id}
            aria-describedby={describedBy}
            name="text"
            required
            maxLength={2000}
            rows={3}
            className={inputCls}
          />
        )}
      </Field>
      <div>
        <SubmitButton>Record recommendation</SubmitButton>
      </div>
    </form>
  );
}
