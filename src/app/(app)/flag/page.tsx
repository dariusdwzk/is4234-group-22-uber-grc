import { Suspense } from "react";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { controlClass, Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { authorize } from "@/server/authz";
import { requireActor } from "@/server/page-guard";
import { getBoardFlags } from "@/server/queries/flags";
import { resolveFlagAction } from "../board/actions";
import { raiseFlagAction } from "./actions";

async function Flag({ searchParams }: PageProps<"/flag">) {
  const actor = await requireActor("raiseFlag");
  const sp = await searchParams;
  const flags = authorize(actor, "resolveFlag").ok
    ? await getBoardFlags(actor)
    : null;
  return (
    <div className="flex max-w-[640px] flex-col gap-6">
      {sp.recorded === "1" && (
        <Alert tone="success">Flag recorded for review.</Alert>
      )}
      {sp.error !== undefined && (
        <Alert tone="error">
          Please enter a case reference and 5–2000 characters.
        </Alert>
      )}
      <Card>
        <form action={raiseFlagAction} className="flex flex-col gap-4">
          <Field label="Case reference">
            {({ id, describedBy }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                name="caseRef"
                required
                maxLength={40}
                className={controlClass}
              />
            )}
          </Field>
          <Field label="What concerns you?">
            {({ id, describedBy }) => (
              <textarea
                id={id}
                aria-describedby={describedBy}
                name="text"
                required
                minLength={5}
                maxLength={2000}
                rows={4}
                className={controlClass}
              />
            )}
          </Field>
          <div>
            <SubmitButton disableWhilePending>Raise flag</SubmitButton>
          </div>
        </form>
      </Card>
      {flags && (
        <Card titleId="open" title="Open flags">
          {flags.length === 0 ? (
            <EmptyState>None.</EmptyState>
          ) : (
            <ul className="flex flex-col">
              {flags.map((f) => (
                <li key={f.id} className="border-t border-line py-3 first:border-t-0 first:pt-0">
                  <p className="break-words text-sm text-ink [overflow-wrap:anywhere]">
                    {f.ref} — {f.text}
                  </p>
                  <form
                    action={resolveFlagAction}
                    className="mt-2 flex flex-col gap-3"
                  >
                    <input type="hidden" name="flagId" value={f.id} />
                    <Field label="Resolution">
                      {({ id, describedBy }) => (
                        <input
                          id={id}
                          aria-describedby={describedBy}
                          name="resolution"
                          required
                          minLength={5}
                          maxLength={2000}
                          className={controlClass}
                        />
                      )}
                    </Field>
                    <div>
                      <SubmitButton variant="secondary" disableWhilePending>
                        Resolve flag
                      </SubmitButton>
                    </div>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

export default function FlagPage(props: PageProps<"/flag">) {
  return (
    <main className="p-6 lg:p-8">
      <PageHeader title="Raise a challenge flag" />
      <Suspense fallback={null}>
        <Flag {...props} />
      </Suspense>
    </main>
  );
}
