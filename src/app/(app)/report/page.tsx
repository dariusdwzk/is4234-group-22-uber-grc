import { Suspense } from "react";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { controlClass, Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { authorize } from "@/server/authz";
import { requireActor } from "@/server/page-guard";
import { reportAction } from "./actions";

async function Report({ searchParams }: PageProps<"/report">) {
  const actor = await requireActor("raiseFlag");
  const { receipt, error } = await searchParams;
  if (typeof receipt === "string")
    return (
      <Alert tone="success">
        Thank you — receipt {receipt}. The case is now with the incident
        governance process.
      </Alert>
    );
  if (!authorize(actor, "declareIncident").ok)
    return <p>Your role cannot declare incidents.</p>;
  return (
    <Card className="max-w-[640px]">
      <form action={reportAction} className="flex flex-col gap-4">
        {error !== undefined && (
          <Alert tone="error">
            Please describe what happened (up to 2000 characters).
          </Alert>
        )}
        <Field label="Description">
          {({ id, describedBy }) => (
            <textarea
              id={id}
              aria-describedby={describedBy}
              name="description"
              required
              maxLength={2000}
              rows={5}
              className={controlClass}
            />
          )}
        </Field>
        <Field label="Related reference (optional)">
          {({ id, describedBy }) => (
            <input
              id={id}
              aria-describedby={describedBy}
              name="relatedReference"
              maxLength={200}
              className={controlClass}
            />
          )}
        </Field>
        <div>
          <SubmitButton disableWhilePending>Submit report</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

export default function ReportPage(props: PageProps<"/report">) {
  return (
    <main className="p-6 lg:p-8">
      <PageHeader title="Report a concern" />
      <Suspense fallback={null}>
        <Report {...props} />
      </Suspense>
    </main>
  );
}
