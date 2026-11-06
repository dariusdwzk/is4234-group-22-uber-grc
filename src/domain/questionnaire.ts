import { z } from "zod";
import config from "../../rule-packs/staff-report-questions.json";
import type { Facts } from "./types";

export const ANSWERS = ["YES", "NO", "NOT_SURE"] as const;
export type Answer = (typeof ANSWERS)[number];

const QUESTION_IDS = [
  "data",
  "money",
  "harm",
  "handling",
  "systems",
  "outsiders",
  "ongoing",
] as const;
export type QuestionId = (typeof QUESTION_IDS)[number];
export type Answers = Record<QuestionId, Answer>;

const QuestionnaireSchema = z.strictObject({
  version: z.string(),
  owner: z.string(),
  triageHours: z.number().int().positive(),
  reviewBusinessDays: z.number().int().positive(),
  questions: z
    .array(
      z.strictObject({
        id: z.enum(QUESTION_IDS),
        text: z.string(),
        type: z.enum(["high", "high-routing", "raises"]),
      }),
    )
    .length(QUESTION_IDS.length),
});

/** The staff report questions are data (rule-packs/staff-report-questions.json), owned by Legal. */
export const QUESTIONNAIRE = QuestionnaireSchema.parse(config);

/** Every question answered with exactly one of YES, NO, NOT_SURE. */
export const AnswersSchema = z.strictObject(
  Object.fromEntries(QUESTION_IDS.map((q) => [q, z.enum(ANSWERS)])) as Record<
    QuestionId,
    z.ZodEnum<{ YES: "YES"; NO: "NO"; NOT_SURE: "NOT_SURE" }>
  >,
);

export type Route = "NORMAL" | "INDEPENDENT" | "TRIAGE" | "SECURITY_TRIAGE";

/**
 * Where a staff report goes, in the spec's order. Severity is left to the rules engine;
 * this only decides the path and whether the rating waits for triage.
 */
export function routeReport(a: Answers): Route {
  const high = [a.data, a.money, a.harm];
  if (a.handling !== "NO") return "INDEPENDENT"; // NOT_SURE counts as YES
  if (high.includes("YES")) return "NORMAL";
  if (high.includes("NOT_SURE")) return "TRIAGE"; // uncertainty never quietly becomes LOW
  return "NORMAL"; // rules 4-6: the rules engine decides HIGH, else it is a LOW report
}

const yes = (x: Answer) => x === "YES";
const yesOrUnsure = (x: Answer) => x !== "NO";

/**
 * Answers become case facts so the same rules engine classifies them. No counts or amounts
 * are invented. For Q5–Q7, "Not sure" counts as YES (rule 5).
 */
export function answersToFacts(a: Answers): Partial<Facts> {
  return {
    dataAccessed: yes(a.data),
    moneyConcern: yes(a.money),
    harmConcern: yes(a.harm),
    handlingConcern: yesOrUnsure(a.handling),
    systemsDown: yesOrUnsure(a.systems),
    outsidersAware: yesOrUnsure(a.outsiders),
    ongoing: yesOrUnsure(a.ongoing),
  };
}

/** "data: YES, money: NOT_SURE, ..." for the ledger. */
export const answersSummary = (a: Answers): string =>
  QUESTION_IDS.map((q) => q + ": " + a[q]).join(", ");
