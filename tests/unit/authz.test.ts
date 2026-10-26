import { describe, expect, it } from "vitest";
import type { Actor, Role } from "@/domain/types";
import { POLICY, authorize, type Action } from "@/server/authz";

const ROLES: Role[] = [
  "SA",
  "CISO",
  "GC",
  "PCO",
  "IA",
  "ACC",
  "EMP",
  "EXEC",
  "DEMO",
];
const ACTIONS = Object.keys(POLICY) as Action[];
const actorOf = (role: Role): Actor => ({
  id: `u-${role}`,
  role,
  displayName: role,
});

describe("authorize", () => {
  it("every spec §6 command and read action has a policy entry", () => {
    const required = [
      "login",
      "logout",
      "declareIncident",
      "ingestEvent",
      "recordRecommendation",
      "closeCase",
      "recordMateriality",
      "submitDecision",
      "raiseFlag",
      "resolveFlag",
      "acknowledgeTier2",
      "exportHead",
      "verifyLedger",
      "publishRulePack",
      "sweep",
      "advanceClock",
      "resetDemo",
      "tamperEntry",
      "viewCases",
      "viewCase",
      "viewBoard",
      "viewLedger",
      "viewDemo",
    ];
    expect(ACTIONS.sort()).toEqual([...required].sort());
  });

  it("policy only names real roles", () => {
    for (const a of ACTIONS)
      for (const r of POLICY[a]) expect(ROLES).toContain(r);
  });

  it("denies a null actor for every action except login", () => {
    for (const a of ACTIONS) {
      const res = authorize(null, a);
      if (a === "login") expect(res).toEqual({ ok: true });
      else expect(res).toEqual({ ok: false, reason: "not signed in" });
    }
  });

  it("US-11: closeCase is denied for every role", () => {
    for (const r of ROLES)
      expect(authorize(actorOf(r), "closeCase").ok).toBe(false);
  });

  it("US-01: SA and CISO cannot submit a decision; GC and PCO can", () => {
    expect(authorize(actorOf("SA"), "submitDecision")).toEqual({
      ok: false,
      reason: "role SA may not submitDecision",
    });
    expect(authorize(actorOf("CISO"), "submitDecision").ok).toBe(false);
    expect(authorize(actorOf("GC"), "submitDecision").ok).toBe(true);
    expect(authorize(actorOf("PCO"), "submitDecision").ok).toBe(true);
  });

  it("every action except login/logout/raiseFlag has at least one forbidden role", () => {
    for (const a of ACTIONS) {
      if (["login", "logout", "raiseFlag"].includes(a)) continue;
      expect(
        ROLES.some((r) => !authorize(actorOf(r), a).ok),
        a,
      ).toBe(true);
    }
  });

  it("US-18: case-side roles cannot resolve flags; ACC and IA can", () => {
    for (const r of ["SA", "CISO", "GC", "PCO", "EMP"] as Role[]) {
      expect(authorize(actorOf(r), "resolveFlag").ok).toBe(false);
    }
    expect(authorize(actorOf("ACC"), "resolveFlag").ok).toBe(true);
    expect(authorize(actorOf("IA"), "resolveFlag").ok).toBe(true);
  });

  it("denies an unknown action by default", () => {
    expect(authorize(actorOf("GC"), "bogus" as Action)).toEqual({
      ok: false,
      reason: "role GC may not bogus",
    });
  });

  it("demo-only actions are DEMO only", () => {
    for (const a of [
      "advanceClock",
      "resetDemo",
      "tamperEntry",
      "ingestEvent",
    ] as Action[]) {
      for (const r of ROLES)
        expect(authorize(actorOf(r), a).ok).toBe(r === "DEMO");
    }
  });
});
