import type { RoleKey } from "./types";

export type RoleInfo = { name: string; home: string; short: string };

// Copied from the mockup's ROLES. Order is the order of the role picker.
export const ROLES: Record<RoleKey, RoleInfo> = {
  employee: {
    name: "Employee",
    home: "employee",
    short: "Report an incident, anonymously if you like",
  },
  security: {
    name: "Security team",
    home: "work",
    short: "Investigate incidents and record findings",
  },
  cso: {
    name: "CSO (also Deputy GC)",
    home: "work",
    short: "Lead Security and recommend what to do",
  },
  gc: {
    name: "General Counsel",
    home: "work",
    short: "Approve disclosure decisions",
  },
  cpo: {
    name: "Chief Privacy Officer",
    home: "work",
    short: "Approve disclosure decisions and rate staff reports",
  },
  ceo: { name: "CEO", home: "ceo", short: "Follow serious incidents" },
  board: {
    name: "Board (Audit Committee)",
    home: "board",
    short: "Receive incident notices and oversee",
  },
};

export const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];

export function isRoleKey(x: unknown): x is RoleKey {
  return typeof x === "string" && Object.hasOwn(ROLES, x);
}
