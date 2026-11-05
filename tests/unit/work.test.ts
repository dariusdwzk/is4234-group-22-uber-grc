import { describe, expect, it } from "vitest";
import { nearestDeadline, workItems } from "@/client/work";
import { navFor } from "@/client/nav";
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

const pend = (type = "T") =>
  ({
    type,
    need: 2,
    disclose: false,
    status: "Pending",
    votes: {},
  }) as CaseView["decision"];

describe("workItems rows", () => {
  it("sorts HIGH before LOW, then by id", () => {
    const a = mk({ id: "C-110", severity: "LOW", route: "SECURITY_TRIAGE" });
    const b = mk({ id: "C-109" });
    const c = mk({ id: "C-108" });
    expect(workItems([a, b, c], "security").map((w) => w.c.id)).toEqual([
      "C-108",
      "C-109",
      "C-110",
    ]);
  });
  it("LOW security-triage report: Security records a finding", () => {
    const c = mk({ severity: "LOW", route: "SECURITY_TRIAGE" });
    expect(workItems([c], "security")[0]!.line).toBe(
      "Staff report waiting for Security's facts.",
    );
  });
  it("Disclosure required: Approve disclosure", () => {
    const c = mk({ status: "Disclosure required" });
    expect(workItems([c], "gc")[0]!.verb).toBe("Approve disclosure");
  });
  it("independent with no recommendation: Investigate", () => {
    const c = mk({ route: "INDEPENDENT" });
    expect(workItems([c], "gc")[0]!.verb).toBe("Investigate");
  });
  it("CSO: Recommend; Security: opened automatically", () => {
    expect(workItems([mk({})], "cso")[0]!.verb).toBe("Recommend");
    expect(workItems([mk({})], "security")[0]!.line).toBe(
      "Opened automatically from system signals.",
    );
  });
  it("no reason: no suffix; no recommendation: plain line", () => {
    const rec = { author: "cso", act: "escalate", reason: null, t: 1 } as const;
    const w = workItems([mk({ rec, decision: pend("Escalate") })], "gc")[0]!;
    expect(w.line).toBe("CSO (also Deputy GC) recommends: Escalate");
    expect(workItems([mk({ decision: pend() })], "gc")[0]!.line).toBe(
      "A decision is waiting for your vote.",
    );
  });
});

describe("navFor My work", () => {
  it("counts the work items", () => {
    const d = { ...emptyState(), cases: [mk({})] };
    const n = navFor("cso", { view: "work", boardTab: "overview", d });
    expect(n[0]).toMatchObject({ label: "My work", x: "work", count: 1 });
  });
});

describe("nearestDeadline", () => {
  const clock = (dur: number, met = false, key = "gdpr") =>
    ({ key, name: "GDPR Art. 33", start: 0, dur, met }) as never;
  it("is the smallest unmet remaining time, with its clock and case", () => {
    const c = mk({ clocks: [clock(72), clock(24)] });
    expect(nearestDeadline([c], 10)).toEqual({
      h: 14,
      name: "GDPR Art. 33",
      caseId: "C-104",
    });
  });
  it("ignores internal clocks", () => {
    const c = mk({ clocks: [clock(12, false, "mat"), clock(72)] });
    expect(nearestDeadline([c], 10)!.h).toBe(62);
  });
  it("is null for met clocks and ignores Disclosed cases", () => {
    expect(nearestDeadline([mk({ clocks: [clock(24, true)] })], 10)).toBeNull();
    expect(
      nearestDeadline([mk({ status: "Disclosed", clocks: [clock(24)] })], 10),
    ).toBeNull();
  });
  it("ignores clocks with no start or no duration", () => {
    const k = (o: object) => ({ key: "ca", name: "x", ...o }) as never;
    const c = mk({
      clocks: [k({ start: null, dur: 5 }), k({ start: 0, dur: null })],
    });
    expect(nearestDeadline([c], 1)).toBeNull();
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
  it("escapes the title and the reason", () => {
    S.role = "gc";
    const c = mk({
      title: "<b>x</b>",
      rec: { author: "cso", act: "escalate", reason: "<b>y</b>", t: 1 },
      decision: pend(),
    });
    S.d = { ...emptyState(), cases: [c] };
    const h = vWork();
    expect(h).toContain("&lt;b&gt;");
    expect(h).not.toContain("<b>");
  });
});
