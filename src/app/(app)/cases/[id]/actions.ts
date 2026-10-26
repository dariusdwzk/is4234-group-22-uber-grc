"use server";
import { redirect } from "next/navigation";
import { closeCase } from "@/server/commands/close-case";
import { recordMateriality } from "@/server/commands/record-materiality";
import { recordRecommendation } from "@/server/commands/record-recommendation";
import { submitDecision } from "@/server/commands/submit-decision";
import { Conflict, Forbidden, ValidationError } from "@/server/errors";
import { requireActor } from "@/server/page-guard";
import type { Action } from "@/server/authz";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

/** Runs a command; a business refusal goes back to the page as a message, never a stack trace. */
async function run(
  action: Action,
  caseId: string,
  go: (actor: Awaited<ReturnType<typeof requireActor>>) => Promise<unknown>,
): Promise<never> {
  const actor = await requireActor("viewCase");
  let error: string | null = null;
  try {
    await go(actor);
  } catch (e) {
    if (e instanceof Forbidden) error = e.reason;
    else if (e instanceof Conflict) error = e.message;
    else if (e instanceof ValidationError) error = "Please check the form.";
    else throw e;
  }
  void action;
  redirect(
    `/cases/${caseId}${error ? `?error=${encodeURIComponent(error)}` : ""}`,
  );
}

export async function recommendAction(f: FormData): Promise<void> {
  const caseId = str(f, "caseId");
  await run("recordRecommendation", caseId, (a) =>
    recordRecommendation(a, {
      caseId,
      proposedOutcome: str(f, "proposedOutcome"),
      dataTaken: str(f, "dataTaken"),
      treatAs: str(f, "treatAs"),
      text: str(f, "text"),
    }),
  );
}

export async function materialityAction(f: FormData): Promise<void> {
  const caseId = str(f, "caseId");
  await run("recordMateriality", caseId, (a) =>
    recordMateriality(a, { caseId }),
  );
}

export async function closeAction(f: FormData): Promise<void> {
  const caseId = str(f, "caseId");
  await run("closeCase", caseId, (a) => closeCase(a, { caseId }));
}

export async function decideAction(f: FormData): Promise<void> {
  const caseId = str(f, "caseId");
  const outcome = str(f, "outcome");
  const notifyBy = str(f, "notifyBy");
  const tick = (k: string) => f.get(k) === "on";
  await run("submitDecision", caseId, (a) =>
    submitDecision(a, {
      caseId,
      outcome,
      ...(outcome === "notify_later" && notifyBy ? { notifyBy } : {}),
      reasonCode: str(f, "reasonCode"),
      checklist: {
        reviewedEvidence: tick("reviewedEvidence"),
        noPersonalConflict: tick("noPersonalConflict"),
        consideredRegulatorDeadlines: tick("consideredRegulatorDeadlines"),
        consideredBoardNotice: tick("consideredBoardNotice"),
        notInstructedBySecurity: tick("notInstructedBySecurity"),
      },
    }),
  );
}
