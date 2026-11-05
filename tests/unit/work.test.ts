import { describe, expect, it } from "vitest";
import { nearestDeadlineH, workItems } from "@/client/work";
import { S, emptyState } from "@/client/store";
import { vWork } from "@/client/views/work";
import type { CaseView } from "@/domain/view-state";

const mk = (o: Partial<CaseView>) =>
  ({
    id: "C-104",
    title: "t",
    severity: "HIGH",
    status: "Open",
    route: "NORMAL",
    finding: null,
    rec: null,
    decision: null,
    clocks: [],
    ...o,
  }) as CaseView;

describe("workItems", () => {
  it("is empty with no cases", () => {
    expect(workItems([], "gc")).toEqual([]);
  });
  it("a pending decision shows the recommendation to the GC", () => {
    const c = mk({
      rec: { author: "cso", act: "escalate", reason: "Keep it in-house", t: 1 },
      decision: {
        type: "Do not disclose",
        need: 2,
        disclose: false,
        status: "Pending",
        votes: {},
      },
    });
    const [w] = workItems([c], "gc");
    expect(w!.verb).toBe("Review and decide");
    expect(w!.line).toContain("CSO (also Deputy GC) recommends:");
    expect(w!.line).toContain("Keep it in-house");
  });
  it("a triage case: CPO rates, Security records facts", () => {
    const c = mk({ status: "Needs triage", severity: "PENDING" });
    expect(workItems([c], "cpo")[0]!.verb).toBe("Rate report");
    expect(workItems([c], "security")[0]!.verb).toBe("Record finding");
  });
});

describe("nearestDeadlineH", () => {
  const clock = (dur: number, met = false) =>
    ({ key: "gdpr", name: "x", start: 0, dur, met }) as never;
  it("is the smallest unmet remaining time", () => {
    const c = mk({ clocks: [clock(72), clock(24)] });
    expect(nearestDeadlineH([c], 10)).toBe(14);
  });
  it("is null for met clocks and ignores Disclosed cases", () => {
    expect(
      nearestDeadlineH([mk({ clocks: [clock(24, true)] })], 10),
    ).toBeNull();
    expect(
      nearestDeadlineH([mk({ status: "Disclosed", clocks: [clock(24)] })], 10),
    ).toBeNull();
  });
});

describe("vWork", () => {
  it("says nothing is waiting when there are no cases", () => {
    S.role = "gc";
    S.d = emptyState();
    const h = vWork();
    expect(h).toContain("Nothing is waiting on you.");
    expect(h).toContain("Waiting on you");
  });
});
