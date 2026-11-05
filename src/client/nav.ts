// What the sidebar lists for each role.
import type { RoleKey } from "@/domain/types";
import type { CaseView, ViewState } from "@/domain/view-state";
import { workItems } from "./work";

export type NavItem = {
  label: string;
  a: string;
  x?: string;
  count?: number;
  current: boolean;
};

/** The cases the GC/CPO "All cases" page lists, in its two sections. */
export function approvalsCases(cases: CaseView[]): {
  independent: CaseView[];
  other: CaseView[];
} {
  return {
    independent: cases.filter((c) => c.route === "INDEPENDENT"),
    other: cases.filter(
      (c) =>
        c.route !== "INDEPENDENT" &&
        (c.severity === "HIGH" || c.status === "Needs triage"),
    ),
  };
}

export function navFor(
  role: RoleKey,
  s: {
    view: string;
    boardTab: "overview" | "log";
    d: ViewState;
    caseId?: string | null;
  },
): NavItem[] {
  const items = base(role, s);
  if (s.view !== "case" || !s.caseId) return items;
  // On a case page, the item the breadcrumb links to is the current one.
  const inWork = workItems(s.d.cases, role).some((w) => w.c.id === s.caseId);
  const from =
    (inWork
      ? items.find((i) => i.x === "work")
      : items.find((i) => i.x !== "work")) ?? items[0];
  return items.map((i) => ({ ...i, current: i === from }));
}

function base(
  role: RoleKey,
  s: { view: string; boardTab: "overview" | "log"; d: ViewState },
): NavItem[] {
  const go = (label: string, x: string, count?: number): NavItem => ({
    label,
    a: "go",
    x,
    ...(count === undefined ? {} : { count }),
    current: s.view === x,
  });
  const tab = (label: string, x: "overview" | "log"): NavItem => ({
    label,
    a: "boardTab",
    x,
    current: s.view === "board" && s.boardTab === x,
  });
  switch (role) {
    case "employee":
      return [go("Report an incident", "employee")];
    case "security":
    case "cso":
      return [
        go("My work", "work", workItems(s.d.cases, role).length),
        go("All cases", "security", s.d.cases.length),
      ];
    case "gc":
    case "cpo": {
      const a = approvalsCases(s.d.cases);
      return [
        go("My work", "work", workItems(s.d.cases, role).length),
        go("All cases", "approvals", a.independent.length + a.other.length),
      ];
    }
    case "ceo":
      return [go("Overview", "ceo")];
    case "board": {
      const unread = s.d.notices.filter((n) => n.ack === null).length;
      return [
        {
          ...tab("Overview", "overview"),
          ...(unread ? { count: unread } : {}),
        },
        tab("Evidence log", "log"),
      ];
    }
  }
}
