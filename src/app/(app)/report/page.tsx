import { Suspense } from "react";
import { authorize } from "@/server/authz";
import { requireActor } from "@/server/page-guard";
import { reportAction } from "./actions";

async function Report({ searchParams }: PageProps<"/report">) {
  const actor = await requireActor("raiseFlag");
  const { receipt, error } = await searchParams;
  if (typeof receipt === "string")
    return (
      <p role="status">
        Thank you — receipt {receipt}. The case is now with the incident
        governance process.
      </p>
    );
  if (!authorize(actor, "declareIncident").ok)
    return <p>Your role cannot declare incidents.</p>;
  return (
    <form action={reportAction} className="flex max-w-xl flex-col gap-3">
      {error !== undefined && (
        <p role="alert">
          Please describe what happened (up to 2000 characters).
        </p>
      )}
      <label className="flex flex-col gap-1">
        Description
        <textarea
          name="description"
          required
          maxLength={2000}
          rows={5}
          className="border px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1">
        Related reference (optional)
        <input
          name="relatedReference"
          maxLength={200}
          className="border px-2 py-1"
        />
      </label>
      <button type="submit" className="border px-3 py-1">
        Submit report
      </button>
    </form>
  );
}

export default function ReportPage(props: PageProps<"/report">) {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-semibold">Report a concern</h1>
      <Suspense fallback={null}>
        <Report {...props} />
      </Suspense>
    </main>
  );
}
