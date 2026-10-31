import { describe, expect, it } from "vitest";
import { canAccessCase } from "@/domain/case-access";
import { clocksFrom } from "@/domain/clocks";
import { addBusinessDays } from "@/domain/demo-time";
import { dueEscalations, type EscalationInput } from "@/domain/escalations";
import {
  QUESTIONNAIRE,
  answersSummary,
  answersToFacts,
  routeReport,
  type Answers,
} from "@/domain/questionnaire";
import { evaluate, firedIds } from "@/domain/rules";
import { defaultFacts } from "@/domain/types";

const NO: Answers = {
  data: "NO",
  money: "NO",
  harm: "NO",
  handling: "NO",
  systems: "NO",
  outsiders: "NO",
  ongoing: "NO",
};
const answer = (o: Partial<Answers>): Answers => ({ ...NO, ...o });

/** What the server does with a report: route, then the rules engine rates it (unless triage). */
function classify(a: Answers) {
  const route = routeReport(a);
  const e = evaluate({ ...defaultFacts(), ...answersToFacts(a) }, true);
  const severity =
    route === "TRIAGE"
      ? "PENDING"
      : route === "INDEPENDENT"
        ? "HIGH"
        : e.severity;
  return {
    severity,
    route: severity === "LOW" ? "SECURITY_TRIAGE" : route,
    fired: firedIds(e),
  };
}

describe("questionnaire data", () => {
  it("has the seven questions, owned by Legal, with YES / NO / NOT_SURE answers", () => {
    expect(QUESTIONNAIRE.questions.map((q) => q.id)).toEqual([
      "data",
      "money",
      "harm",
      "handling",
      "systems",
      "outsiders",
      "ongoing",
    ]);
    expect(QUESTIONNAIRE.owner).toMatch(/Legal/);
    expect(answersSummary(answer({ data: "YES" }))).toBe(
      "data: YES, money: NO, harm: NO, handling: NO, systems: NO, outsiders: NO, ongoing: NO",
    );
  });

  it("never invents counts or amounts", () => {
    const f = answersToFacts(answer({ data: "YES", money: "YES" }));
    expect(f).not.toHaveProperty("objects");
    expect(f).not.toHaveProperty("records");
    const e = evaluate({ ...defaultFacts(), ...f }, true);
    expect(e.rules.find((r) => r.id === "R1")!.ev).toBe(
      "Reported by staff; scale not yet known",
    );
  });
});

describe("staff report classification (acceptance cases)", () => {
  it("1. 2016-style report: data, money, outsiders → HIGH, NORMAL", () => {
    expect(
      classify(answer({ data: "YES", money: "YES", outsiders: "YES" })),
    ).toMatchObject({ severity: "HIGH", route: "NORMAL" });
  });

  it("2. CSO calls a breach a bug bounty: handling YES → HIGH, INDEPENDENT", () => {
    expect(classify(answer({ handling: "YES" }))).toMatchObject({
      severity: "HIGH",
      route: "INDEPENDENT",
    });
  });

  it("3/4. lost laptop, data NOT_SURE → waits for triage", () => {
    expect(classify(answer({ data: "NOT_SURE" }))).toMatchObject({
      severity: "PENDING",
      route: "TRIAGE",
    });
  });

  it("5. phishing email, nobody clicked: all NO → LOW, SECURITY_TRIAGE", () => {
    expect(classify(NO)).toMatchObject({
      severity: "LOW",
      route: "SECURITY_TRIAGE",
    });
  });

  it("6. ransomware locks dispatch: money, systems, ongoing → HIGH, NORMAL", () => {
    expect(
      classify(answer({ money: "YES", systems: "YES", ongoing: "YES" })),
    ).toMatchObject({ severity: "HIGH", route: "NORMAL" });
  });

  it("7. driver address shared in a chat: data, harm → HIGH, NORMAL", () => {
    expect(classify(answer({ data: "YES", harm: "YES" }))).toMatchObject({
      severity: "HIGH",
      route: "NORMAL",
    });
  });

  it("8. app slow for an hour: systems YES only → LOW, SECURITY_TRIAGE", () => {
    expect(classify(answer({ systems: "YES" }))).toMatchObject({
      severity: "LOW",
      route: "SECURITY_TRIAGE",
    });
  });

  it("10. handling NOT_SURE is treated as YES", () => {
    expect(classify(answer({ handling: "NOT_SURE" }))).toMatchObject({
      severity: "HIGH",
      route: "INDEPENDENT",
    });
  });

  it("handling beats everything; YES on Q1–Q3 beats NOT_SURE", () => {
    expect(routeReport(answer({ handling: "YES", data: "NOT_SURE" }))).toBe(
      "INDEPENDENT",
    );
    expect(routeReport(answer({ data: "YES", money: "NOT_SURE" }))).toBe(
      "NORMAL",
    );
  });

  it("NOT_SURE on Q1–Q3 goes to triage even when systems questions would make it HIGH", () => {
    expect(
      routeReport(answer({ harm: "NOT_SURE", systems: "YES", ongoing: "YES" })),
    ).toBe("TRIAGE");
  });

  it("rule 4: systems down plus outsiders or still happening → HIGH", () => {
    expect(
      classify(answer({ systems: "YES", outsiders: "YES" })).severity,
    ).toBe("HIGH");
    expect(
      classify(answer({ outsiders: "YES", ongoing: "YES" })).severity,
    ).toBe("LOW");
  });

  it("rule 5: NOT_SURE on Q5–Q7 counts as YES before rule 4 is re-applied", () => {
    expect(
      classify(answer({ systems: "NOT_SURE", ongoing: "YES" })).severity,
    ).toBe("HIGH");
    expect(classify(answer({ outsiders: "NOT_SURE" })).severity).toBe("LOW");
  });
});

describe("independent route", () => {
  it("Security and the CSO cannot access INDEPENDENT cases; everyone else can", () => {
    expect(canAccessCase("security", "INDEPENDENT")).toBe(false);
    expect(canAccessCase("cso", "INDEPENDENT")).toBe(false);
    for (const r of ["gc", "cpo", "ceo", "board"] as const)
      expect(canAccessCase(r, "INDEPENDENT")).toBe(true);
    expect(canAccessCase("security", "TRIAGE")).toBe(true);
  });
});

describe("business days on the demo clock (Day 0 is a Monday)", () => {
  it("skips the weekend", () => {
    expect(addBusinessDays(0, 3)).toBe(72); // Mon → Thu
    expect(addBusinessDays(72, 3)).toBe(8 * 24); // Thu → Fri, Mon, Tue
    expect(addBusinessDays(4 * 24, 1)).toBe(7 * 24); // Fri → Mon
  });
});

describe("triage and review escalations", () => {
  const staffCase = (o: Partial<EscalationInput["cases"][number]>) => ({
    id: "C-105",
    severity: "PENDING",
    status: "Needs triage",
    clocks: clocksFrom(null),
    route: "TRIAGE",
    triageDueH: 24,
    reviewDueH: null,
    finding: null,
    ...o,
  });
  const at = (
    now: number,
    c: ReturnType<typeof staffCase>,
  ): EscalationInput => ({
    now,
    notices: [],
    cases: [c],
  });

  it("an unrated triage case times out at 24 hours, not before", () => {
    expect(dueEscalations(at(23, staffCase({}))).triageTimeouts).toEqual([]);
    expect(dueEscalations(at(24, staffCase({}))).triageTimeouts).toEqual([
      "C-105",
    ]);
  });

  it("a LOW staff report not reviewed in time tells the board once; a review stops it", () => {
    const low = staffCase({
      severity: "LOW",
      status: "Awaiting review",
      route: "SECURITY_TRIAGE",
      triageDueH: null,
      reviewDueH: 72,
    });
    expect(dueEscalations(at(71, low)).notices).toEqual([]);
    expect(dueEscalations(at(72, low)).notices).toEqual([
      {
        caseId: "C-105",
        kind: "review",
        body: "Low-risk staff report not reviewed in time.",
      },
    ]);
    expect(
      dueEscalations(at(72, { ...low, finding: "Checked." })).notices,
    ).toEqual([]);
  });
});
