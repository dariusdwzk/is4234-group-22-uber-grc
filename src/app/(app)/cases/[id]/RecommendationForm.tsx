import { recommendAction } from "./actions";

export function RecommendationForm({ caseId }: { caseId: string }) {
  return (
    <form action={recommendAction} className="flex max-w-xl flex-col gap-2">
      <input type="hidden" name="caseId" value={caseId} />
      <label className="flex flex-col gap-1">
        Proposed outcome
        <select name="proposedOutcome" className="border px-2 py-1">
          <option value="notify_now">Notify now</option>
          <option value="notify_later">Notify later</option>
          <option value="withhold">Withhold</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Was data taken?
        <select name="dataTaken" className="border px-2 py-1">
          <option value="yes">Yes</option>
          <option value="no">No</option>
          <option value="unknown">Unknown</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Treat as
        <select name="treatAs" className="border px-2 py-1">
          <option value="incident">Incident</option>
          <option value="bug_bounty">Bug bounty</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Recommendation
        <textarea
          name="text"
          required
          maxLength={2000}
          rows={3}
          className="border px-2 py-1"
        />
      </label>
      <button type="submit" className="border px-3 py-1">
        Record recommendation
      </button>
    </form>
  );
}
