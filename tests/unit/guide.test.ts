import { beforeEach, describe, expect, it } from "vitest";
import { STEPS, atStep, stepIdx } from "@/client/guide";
import { ROLES } from "@/domain/roles";
import { S, emptyState } from "@/client/store";

const progress = (o: Partial<typeof S.d.progress>) => {
  S.d.progress = { ...S.d.progress, ...o };
};

describe("guided tour: the current step", () => {
  beforeEach(() => {
    S.d = emptyState();
    S.guideStep = 0;
    S.logFilter = "all";
  });

  it("starts at step 1 and moves on as steps are done", () => {
    expect(stepIdx()).toBe(0);
    progress({ finding: true });
    expect(stepIdx()).toBe(1);
  });

  it("follows the user when they skip ahead (GC votes before the CSO steps)", () => {
    progress({ gcDone: true });
    expect(STEPS[stepIdx()]!.title).toBe("Decide as Chief Privacy Officer");
  });

  it("acknowledging notices or filtering the log early does not skip the tour ahead", () => {
    progress({ allAcked: true });
    S.logFilter = "decision";
    expect(stepIdx()).toBe(0);
  });

  it("step 2 no longer waits for a refused attempt", () => {
    progress({ finding: true, recommended: true });
    expect(STEPS[stepIdx()]!.title).toBe("Approve as General Counsel");
  });

  it("tour copy makes no auditor or tamper-detection claim", () => {
    S.boardTab = "log";
    const all = STEPS.map((s) =>
      typeof s.text === "string" ? s.text : "",
    ).join(" ");
    const last = STEPS[STEPS.length - 1]!;
    const t = typeof last.text === "function" ? last.text() : last.text;
    expect(all + t).not.toMatch(/auditor|detected/);
  });

  it("step 1 is shown on Security's home, My work", () => {
    S.role = "security";
    S.view = ROLES.security.home;
    expect(atStep(STEPS[0]!)).toBe(true);
  });

  it("never moves back", () => {
    S.guideStep = 4;
    expect(stepIdx()).toBe(4);
  });

  it("passes over steps already done, and ends when all are done or skipped", () => {
    progress({ gcDone: true, cpoDone: true });
    S.guideStep = 2;
    expect(stepIdx()).toBe(4);
    S.guideStep = STEPS.length;
    expect(stepIdx()).toBe(-1);
  });
});
