import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadRulePack } from "@/domain/rule-pack";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { statusBadge, tierBadge } from "@/components/ui/status";
import { authorize } from "@/server/authz";
import { NotFound } from "@/server/errors";
import { requireActor } from "@/server/page-guard";
import { getCaseDetail } from "@/server/queries/cases";
import { ApprovalForm } from "./ApprovalForm";
import { DecisionSummary } from "./DecisionSummary";
import { RecommendationForm } from "./RecommendationForm";

const ERROR_TEXT: Record<string, string> = {
  WRONG_ROLE: "Only General Counsel and Privacy/Compliance may decide.",
  NOT_INDEPENDENT: "You are not independent of the CISO and cannot decide.",
  SAME_APPROVER: "The same person cannot hold both approvals.",
  CHECKLIST_INCOMPLETE: "Every checklist item must be confirmed.",
  NOTIFY_DATE_REQUIRED: "A notify-by date is required for notify later.",
  NOTIFY_DATE_INVALID: "Notify-by must be between today and one year ahead.",
  CONFLICT: "That action is no longer possible for this case.",
  INVALID: "Please check the form.",
  FORBIDDEN: "You are not allowed to do that.",
};

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
  const tb = tierBadge(c.tier);
  const sb = statusBadge(c.status);
  return (
    <>
      <header className="mb-6">
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold text-ink">
          {c.ref}{" "}
          <span data-testid="tier">
            <Badge variant={tb.variant}>{c.tier}</Badge>
          </span>{" "}
          <span data-testid="status">
            <Badge variant={sb.variant}>{c.status}</Badge>
          </span>
        </h1>
      </header>
      {typeof error === "string" && (
        <div className="mb-6">
          <Alert tone="error">
            {error === "CLOSE_REFUSED"
              ? `Cannot close: a HIGH case closes only when General Counsel and Privacy/Compliance agree.${
                  c.gate.status === "awaiting"
                    ? ` Missing: ${c.gate.missing.map((r) => (r === "GC" ? "General Counsel" : "Privacy/Compliance")).join(", ")}`
                    : ""
                }`
              : (ERROR_TEXT[error] ?? ERROR_TEXT.FORBIDDEN)}
          </Alert>
        </div>
      )}
      <DecisionSummary
        c={c}
        descriptions={descriptions}
        canMateriality={authorize(actor, "recordMateriality").ok}
      />
      <div className="mt-6 flex flex-col gap-6">
        {c.status === "open" && authorize(actor, "recordRecommendation").ok && (
          <Card titleId="rec" title="Record recommendation">
            <RecommendationForm caseId={c.id} />
          </Card>
        )}
        {c.status === "open" && authorize(actor, "submitDecision").ok && (
          <Card titleId="approve" title="Your decision">
            <ApprovalForm caseId={c.id} />
          </Card>
        )}
        {c.tier1 && (
          <Card titleId="tier1" title="Tier 1 board notice">
            <blockquote className="whitespace-pre-line break-words border-l-4 border-brand pl-4 text-sm text-ink">
              {c.tier1.body}
            </blockquote>
          </Card>
        )}
      </div>
    </>
  );
}

export default function CasePage(props: PageProps<"/cases/[id]">) {
  return (
    <main className="p-6 lg:p-8">
      <Suspense fallback={null}>
        <Detail {...props} />
      </Suspense>
    </main>
  );
}
