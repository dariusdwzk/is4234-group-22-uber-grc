import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadRulePack } from "@/domain/rule-pack";
import { NotFound } from "@/server/errors";
import { requireActor } from "@/server/page-guard";
import { getCaseDetail } from "@/server/queries/cases";

async function Detail({ params }: PageProps<"/cases/[id]">) {
  const actor = await requireActor("viewCase");
  const { id } = await params;
  const c = await getCaseDetail(actor, id).catch((e: unknown) =>
    e instanceof NotFound ? notFound() : Promise.reject(e),
  );
  const descriptions = new Map(
    loadRulePack("v1").rules.map((r) => [r.id, r.description]),
  );
  return (
    <>
      <h1 className="text-2xl font-semibold">
        {c.ref} <span data-testid="tier">{c.tier}</span> <span>{c.status}</span>
      </h1>
      <section aria-labelledby="events" className="mt-4">
        <h2 id="events" className="font-semibold">
          Events
        </h2>
        <ol className="list-decimal pl-6">
          {c.events.map((e) => (
            <li key={e.id}>
              {e.kind} — {e.occurredAt}
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="rules" className="mt-4">
        <h2 id="rules" className="font-semibold">
          Fired rules
        </h2>
        <ul>
          {c.firedRuleIds.map((r) => (
            <li key={r}>
              {r}: {descriptions.get(r) ?? ""}
            </li>
          ))}
        </ul>
      </section>
      {c.tier1 && (
        <section aria-labelledby="tier1" className="mt-4">
          <h2 id="tier1" className="font-semibold">
            Tier 1 board notice
          </h2>
          <p className="whitespace-pre-line">{c.tier1.body}</p>
        </section>
      )}
    </>
  );
}

export default function CasePage(props: PageProps<"/cases/[id]">) {
  return (
    <main className="p-8">
      <Suspense fallback={null}>
        <Detail {...props} />
      </Suspense>
    </main>
  );
}
