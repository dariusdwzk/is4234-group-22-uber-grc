import type { Role } from "./types";

// Spec §6 navigation. Authorisation is still enforced by each page; this only decides what to show.
const LINKS: { href: string; label: string; roles: readonly Role[] }[] = [
  { href: "/cases", label: "Cases", roles: ["SA", "CISO", "GC", "PCO", "IA"] },
  {
    href: "/report",
    label: "Report",
    roles: ["SA", "CISO", "GC", "PCO", "IA", "ACC", "EMP", "EXEC", "DEMO"],
  },
  { href: "/board", label: "Board", roles: ["ACC", "IA"] },
  { href: "/ledger", label: "Ledger", roles: ["IA", "ACC", "DEMO"] },
  { href: "/demo", label: "Demo", roles: ["DEMO"] },
];

export function navLinks(role: Role): { href: string; label: string }[] {
  return LINKS.filter((l) => l.roles.includes(role)).map(({ href, label }) => ({
    href,
    label,
  }));
}

export function homeFor(role: Role): string {
  if (role === "DEMO") return "/demo";
  return navLinks(role)[0]?.href ?? "/report";
}
