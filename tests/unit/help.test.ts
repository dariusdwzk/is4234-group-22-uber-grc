import { beforeEach, describe, expect, it } from "vitest";
import { pageHelp } from "@/client/help";
import { S, emptyState } from "@/client/store";
import type { CaseView } from "@/domain/view-state";

const caseOf = (o: Partial<CaseView>) =>
  ({
    id: "C-105",
    severity: "HIGH",
    status: "Open",
    route: "NORMAL",
    ...o,
  }) as CaseView;

describe("guide while exploring: about this page", () => {
  beforeEach(() => {
    S.d = emptyState();
    S.boardTab = "overview";
  });

  it("explains the Employee page", () => {
    Object.assign(S, { role: "employee", view: "employee" });
    expect(pageHelp().title).toBe("Speak up");
    expect(pageHelp().text).toMatch(/anonymously/);
  });

  it("changes with the role on a shared page", () => {
    Object.assign(S, { role: "cso", view: "security" });
    expect(pageHelp().text).toMatch(/As CSO/);
    Object.assign(S, { role: "cpo", view: "approvals" });
    expect(pageHelp().text).toMatch(/rate staff reports/);
  });

  it("follows the board's tab", () => {
    Object.assign(S, { role: "board", view: "board" });
    expect(pageHelp().title).toBe("What the board is told");
    S.boardTab = "log";
    expect(pageHelp().title).toBe("The evidence log");
  });

  it("on a case page, follows the case's path and the role", () => {
    Object.assign(S, { view: "case", caseId: "C-105" });
    S.d.cases = [
      caseOf({ status: "Needs triage", severity: "PENDING", route: "TRIAGE" }),
    ];
    S.role = "cpo";
    expect(pageHelp().title).toBe("Rate this report");
    S.role = "security";
    expect(pageHelp().title).toBe("Establish the facts");
    S.d.cases = [caseOf({ route: "INDEPENDENT" })];
    S.role = "gc";
    expect(pageHelp().title).toBe("Handled without Security");
    S.d.cases = [caseOf({})];
    expect(pageHelp().title).toBe("Decide");
    S.role = "security";
    expect(pageHelp().title).toBe("Investigate");
  });
});
