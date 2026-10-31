import { beforeEach, describe, expect, it } from "vitest";
import { stages } from "@/client/views/case/timeline";
import { S, emptyState } from "@/client/store";
import type { CaseView } from "@/domain/view-state";

const base = {
  id: "C-105",
  detectedH: 0,
  severity: "HIGH",
  status: "Open",
  route: "NORMAL",
  answers: null,
  triageDueH: null,
  reviewDueH: null,
  finding: null,
  rec: null,
  decision: null,
  evidence: [],
} as unknown as CaseView;
const c = (o: Partial<CaseView>) => ({ ...base, ...o }) as CaseView;
const labels = (x: CaseView) => stages(x).map((s) => s.label);
const now = (x: CaseView) => stages(x).find((s) => s.state === "now")?.label;

describe("case timeline per path", () => {
  beforeEach(() => {
    S.d = emptyState();
  });

  it("system case: opened, board told, Security, CSO, both approvers, outcome", () => {
    expect(labels(c({}))).toEqual([
      "Case opened",
      "Board notified",
      "Investigate",
      "Recommend",
      "Approve",
      "Outcome",
    ]);
  });

  it("triage: the CPO rates first; the board is told only afterwards", () => {
    const t = c({
      answers: {} as CaseView["answers"],
      severity: "PENDING",
      status: "Needs triage",
      route: "TRIAGE",
      triageDueH: 24,
    });
    expect(labels(t).slice(0, 3)).toEqual([
      "Report received",
      "Triage",
      "Board notified",
    ]);
    expect(now(t)).toBe("Triage");
  });

  it("low-risk staff report: just the review by Security", () => {
    const low = c({
      answers: {} as CaseView["answers"],
      severity: "LOW",
      status: "Awaiting review",
      route: "SECURITY_TRIAGE",
      reviewDueH: 72,
    });
    expect(labels(low)).toEqual(["Report received", "Review"]);
    expect(now(low)).toBe("Review");
    expect(
      now({ ...low, finding: "Checked", status: "Reviewed" }),
    ).toBeUndefined();
  });

  it("independent: GC or CPO investigates and recommends, the other approves", () => {
    const ind = c({ answers: {} as CaseView["answers"], route: "INDEPENDENT" });
    const st = stages(ind);
    expect(st.find((s) => s.label === "Approve")!.need).toBe(
      "The other one must approve",
    );
    expect(st.map((s) => s.who)).not.toContain("Security team");
  });
});
