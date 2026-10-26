import type { Role } from "@/domain/types";

export type SeedKey =
  | "ceo"
  | "ciso"
  | "sa"
  | "gc"
  | "pco"
  | "pco_sec"
  | "ia"
  | "acc"
  | "emp"
  | "demo";

export type SeedUser = {
  displayName: string;
  role: Role;
  reportsTo: SeedKey | null;
  email: string;
};

// Fictional people, reserved .test domain. Ordered so every reportsTo appears before its reportee.
export const SEED_USERS: Record<SeedKey, SeedUser> = {
  ceo: {
    displayName: "Morgan Lee (CEO)",
    role: "EXEC",
    reportsTo: null,
    email: "ceo@demo.test",
  },
  ciso: {
    displayName: "Casey Tan (CISO)",
    role: "CISO",
    reportsTo: "ceo",
    email: "ciso@demo.test",
  },
  gc: {
    displayName: "Gina Park (General Counsel)",
    role: "GC",
    reportsTo: "ceo",
    email: "gc@demo.test",
  },
  acc: {
    displayName: "Alex Rahman (Audit Committee Chair)",
    role: "ACC",
    reportsTo: null,
    email: "acc@demo.test",
  },
  sa: {
    displayName: "Sam Ortiz (Security Analyst)",
    role: "SA",
    reportsTo: "ciso",
    email: "sa@demo.test",
  },
  pco: {
    displayName: "Priya Nair (Privacy & Compliance)",
    role: "PCO",
    reportsTo: "gc",
    email: "pco@demo.test",
  },
  pco_sec: {
    displayName: "Pat Quinn (Security Compliance Lead)",
    role: "PCO",
    reportsTo: "ciso",
    email: "pat.quinn@demo.test",
  },
  ia: {
    displayName: "Ivan Cho (Internal Audit)",
    role: "IA",
    reportsTo: "acc",
    email: "ia@demo.test",
  },
  emp: {
    displayName: "Eli Wong (Engineer)",
    role: "EMP",
    reportsTo: "sa",
    email: "emp@demo.test",
  },
  demo: {
    displayName: "Demo Operator",
    role: "DEMO",
    reportsTo: null,
    email: "demo@demo.test",
  },
};
