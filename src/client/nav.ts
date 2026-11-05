// What the sidebar lists for each role.
import type { RoleKey } from "@/domain/types";
import type { ViewState } from "@/domain/view-state";
import { workItems } from "./work";

export type NavItem = {
  label: string;
  a: string;
  x?: string;
  count?: number;
  current: boolean;
};

export function navFor(
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
    case "cpo":
      return [
        go("My work", "work", workItems(s.d.cases, role).length),
        go("All cases", "approvals", s.d.cases.length),
      ];
    case "ceo":
      return [go("Overview", "ceo")];
    case "board":
      return [tab("Overview", "overview"), tab("Evidence log", "log")];
  }
}
