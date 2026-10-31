import { describe, expect, it } from "vitest";
import { actionRequired } from "@/client/action-required";
import type { CaseView } from "@/domain/view-state";

const c = (o: Partial<CaseView>) =>
  ({
    id: "C-104",
    severity: "HIGH",
    status: "Open",
    route: "NORMAL",
    finding: null,
    rec: null,
    decision: null,
    ...o,
  }) as CaseView;
const rec = (author: "cso" | "gc" | "cpo") =>
  ({ author, act: "escalate", reason: "r", t: 0 }) as CaseView["rec"];
type Votes = NonNullable<CaseView["decision"]>["votes"];
const pending = (votes: Votes = {}) =>
  ({
    type: "x",
    need: 2,
    disclose: false,
    status: "Pending",
    votes,
  }) as CaseView["decision"];

describe("Action required, per role", () => {
  it("Security: a finding on a HIGH case, facts on triage, the review of a LOW report", () => {
    expect(actionRequired(c({}), "security")).toBe(true);
    expect(actionRequired(c({ finding: "done" }), "security")).toBe(false);
    expect(actionRequired(c({ rec: rec("cso") }), "security")).toBe(false);
    expect(
      actionRequired(
        c({ status: "Needs triage", severity: "PENDING", route: "TRIAGE" }),
        "security",
      ),
    ).toBe(true);
    expect(
      actionRequired(
        c({
          severity: "LOW",
          route: "SECURITY_TRIAGE",
          status: "Awaiting review",
        }),
        "security",
      ),
    ).toBe(true);
    expect(
      actionRequired(c({ severity: "LOW", status: "Logged" }), "security"),
    ).toBe(false);
  });

  it("CSO: a recommendation on a HIGH case", () => {
    expect(actionRequired(c({}), "cso")).toBe(true);
    expect(actionRequired(c({ rec: rec("cso") }), "cso")).toBe(false);
  });

  it("GC / CPO: their vote, triage (CPO only), disclosure required, independent work", () => {
    expect(actionRequired(c({ decision: pending() }), "gc")).toBe(true);
    expect(
      actionRequired(
        c({ decision: pending({ gc: { vote: "approve", reason: "", t: 0 } }) }),
        "gc",
      ),
    ).toBe(false);
    expect(
      actionRequired(c({ status: "Needs triage", severity: "PENDING" }), "cpo"),
    ).toBe(true);
    expect(
      actionRequired(c({ status: "Needs triage", severity: "PENDING" }), "gc"),
    ).toBe(false);
    expect(actionRequired(c({ status: "Disclosure required" }), "gc")).toBe(
      true,
    );
    expect(actionRequired(c({ route: "INDEPENDENT" }), "cpo")).toBe(true);
    const own = c({
      route: "INDEPENDENT",
      rec: rec("gc"),
      decision: pending(),
    });
    expect(actionRequired(own, "gc")).toBe(false); // never your own recommendation
    expect(actionRequired(own, "cpo")).toBe(true);
  });

  it("CEO and board never act on cases", () => {
    expect(actionRequired(c({ decision: pending() }), "ceo")).toBe(false);
    expect(actionRequired(c({}), "board")).toBe(false);
  });
});
