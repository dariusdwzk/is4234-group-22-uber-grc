import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadRulePack } from "@/domain/rule-pack";
import { authorize } from "@/server/authz";
import { NotFound } from "@/server/errors";
import { requireActor } from "@/server/page-guard";
import { getCaseDetail } from "@/server/queries/cases";
import { ApprovalForm } from "./ApprovalForm";
import { DecisionSummary } from "./DecisionSummary";
import { RecommendationForm } from "./RecommendationForm";

async function Detail({ params, searchParams }: PageProps<"/cases/[id]">) {
  const actor = await requireActor("viewCase");
  const { id } = await params;
  const { error } = await searchParams;
  const c = await getCaseDetail(actor, id).catch((e: unknown) =>
    e instanceof NotFound ? notFound() : Promise.reject(e),
  );
  const descriptions = new Map(
    loadRulePack("v1").rules.map((r) => [r.id, r.description]),
  );
  return (
    <>
      <h1 className="text-2xl font-semibold">
        {c.ref} <span data-testid="tier">{c.tier}</span>{" "}
        <span data-testid="status">{c.status}</span>
      </h1>
      {typeof error === "string" && (
        <p role="alert" className="mt-4 border-2 border-red-700 p-2">
          {error}
        </p>
      )}
      <DecisionSummary
        c={c}
        descriptions={descriptions}
        canMateriality={authorize(actor, "recordMateriality").ok}
      />
      {c.status === "open" && authorize(actor, "recordRecommendation").ok && (
        <section aria-labelledby="rec" className="mt-4">
          <h2 id="rec" className="font-semibold">
            Record recommendation
          </h2>
          <RecommendationForm caseId={c.id} />
        </section>
      )}
      {c.status === "open" && authorize(actor, "submitDecision").ok && (
        <section aria-labelledby="approve" className="mt-4">
          <h2 id="approve" className="font-semibold">
            Your decision
          </h2>
          <ApprovalForm caseId={c.id} />
        </section>
      )}
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
