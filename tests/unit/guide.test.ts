import { beforeEach, describe, expect, it } from "vitest";
import { STEPS, stepIdx } from "@/client/guide";
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
    S.logFilter = "blocked";
    expect(stepIdx()).toBe(0);
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
