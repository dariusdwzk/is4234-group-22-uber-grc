import "server-only";
import { eq } from "drizzle-orm";
import { TRIAGE_STATUS } from "@/domain/escalations";
import {
  QUESTIONNAIRE,
  answersSummary,
  answersToFacts,
  routeReport,
  type Answers,
} from "@/domain/questionnaire";
import { evaluate, firedIds } from "@/domain/rules";
import { defaultFacts, type Facts } from "@/domain/types";
import { cases, signals } from "../db/schema";
import type { CommandCtx } from "../run-command";
import {
  insertSignal,
  nextId,
  rateLow,
  regulatorInquiryOpen,
  sendNotice,
} from "./engine";

export type StaffReport = {
  text: string;
  anonymous: boolean;
  answers: Answers;
};

/**
 * An employee's report opens its own case. The answers become facts, the same rules engine
 * rates them, and routeReport() picks the path. The employee never chooses the severity.
 */
export async function openStaffReport(
  ctx: CommandCtx,
  r: StaffReport,
): Promise<{ caseId: string; signalId: string }> {
  const { tx, now, log } = ctx;
  const reported = answersToFacts(r.answers);
  const facts: Facts = { ...defaultFacts(), ...reported };
  const route = routeReport(r.answers);
  const signalId = await insertSignal(tx, {
    source: "Staff report",
    origin: "manual",
    detectedH: now,
    title: (r.anonymous ? "Anonymous: " : "") + r.text.slice(0, 60),
    entityKeys: [],
    facts: reported,
    anonymous: r.anonymous,
  });
  const caseId = await nextId(tx, cases, "C", 100);
  await tx.insert(cases).values({
    id: caseId,
    title: r.text.slice(0, 70),
    severity: "PENDING",
    status: "",
    detectedH: now,
    facts,
    route,
    questionnaireAnswers: r.answers,
  });
  await tx.update(signals).set({ caseId }).where(eq(signals.id, signalId));
  await log("Staff report received", caseId, answersSummary(r.answers), {
    actor: r.anonymous ? "Anonymous employee" : "Employee",
  });
  const sys = { actor: "System" };

  if (route === "TRIAGE") {
    await tx
      .update(cases)
      .set({
        status: TRIAGE_STATUS,
        triageDueH: now + QUESTIONNAIRE.triageHours,
      })
      .where(eq(cases.id, caseId));
    await log(
      "Sent for triage: reporter unsure about impact",
      caseId,
      "The Chief Privacy Officer confirms the rating within " +
        QUESTIONNAIRE.triageHours +
        " hours, or it becomes HIGH automatically.",
      sys,
    );
    return { caseId, signalId };
  }

  if (route === "INDEPENDENT")
    await log(
      "Routed away from Security: concern about how an incident is handled",
      caseId,
      "The General Counsel and the Chief Privacy Officer handle it directly.",
      sys,
    );
  const e = evaluate(facts, await regulatorInquiryOpen(tx));
  if (route === "INDEPENDENT" || e.severity === "HIGH") {
    await tx
      .update(cases)
      .set({ severity: "HIGH", status: "Open" })
      .where(eq(cases.id, caseId));
    await log(
      "Rated HIGH from questionnaire",
      caseId,
      "Rules fired: " + firedIds(e) + ".",
      sys,
    );
    await sendNotice(ctx, caseId, 1, "t1");
  } else {
    await rateLow(tx, caseId, now);
    await log(
      "Rated LOW from questionnaire",
      caseId,
      "Security reviews it within " +
        QUESTIONNAIRE.reviewBusinessDays +
        " business days.",
      sys,
    );
  }
  return { caseId, signalId };
}
