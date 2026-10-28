import type { RoleKey } from "./types";

export type RoleInfo = { name: string; home: string; short: string };

// Copied from the mockup's ROLES. Order is the order of the role picker.
export const ROLES: Record<RoleKey, RoleInfo> = {
  employee: {
    name: "Employee",
    home: "employee",
    short: "Reports or challenges, anonymously",
  },
  security: {
    name: "Security team",
    home: "security",
    short: "Investigates. Cannot close cases.",
  },
  cso: {
    name: "CSO (also Deputy GC)",
    home: "security",
    short: "Leads Security and recommends. Cannot approve.",
  },
  finance: { name: "Finance", home: "finance", short: "Releases payments" },
  gc: {
    name: "General Counsel",
    home: "approvals",
    short: "Approver 1 of 2 on disclosure decisions",
  },
  cpo: {
    name: "Chief Privacy Officer",
    home: "approvals",
    short: "Approver 2 of 2 on disclosure decisions",
  },
  ceo: { name: "CEO", home: "ceo", short: "Views cases. Cannot decide." },
  board: {
    name: "Board (Audit Committee)",
    home: "board",
    short: "Told automatically. Oversees.",
  },
};

export const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];

export function isRoleKey(x: unknown): x is RoleKey {
  return typeof x === "string" && Object.hasOwn(ROLES, x);
}
