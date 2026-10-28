import { describe, expect, it } from "vitest";
import { ROLES, ROLE_KEYS } from "@/domain/roles";
import type { Actor, RoleKey } from "@/domain/types";
import { POLICY, authorize, type Action } from "@/server/authz";

const ACTIONS = Object.keys(POLICY) as Action[];
const DEMO: Action[] = ["advanceClock", "jumpToDay24", "resetDemo"];
const actorOf = (role: RoleKey): Actor => ({ role, name: ROLES[role].name });
const allowed = (a: Action) =>
  ROLE_KEYS.filter((r) => authorize(actorOf(r), a).ok);

describe("authorize", () => {
  it("policy only names real roles", () => {
    for (const a of ACTIONS)
      for (const r of POLICY[a]) expect(ROLE_KEYS).toContain(r);
  });

  it("denies a request with no role for every non-demo action", () => {
    for (const a of ACTIONS) {
      const res = authorize(null, a);
      if (DEMO.includes(a)) expect(res).toEqual({ ok: true });
      else expect(res).toEqual({ ok: false, reason: "Choose a role first." });
    }
  });

  it("the demo menu works for every role, as in the mockup", () => {
    for (const a of DEMO) expect(allowed(a)).toEqual(ROLE_KEYS);
  });

  it("nobody can close a case or lower its severity", () => {
    expect(allowed("closeCase")).toEqual([]);
    expect(allowed("lowerSeverity")).toEqual([]);
  });

  it("only the General Counsel and the Chief Privacy Officer can approve or disclose", () => {
    expect(allowed("vote")).toEqual(["gc", "cpo"]);
    expect(allowed("disclose")).toEqual(["gc", "cpo"]);
    expect(authorize(actorOf("cso"), "vote")).toEqual({
      ok: false,
      reason: "CSO (also Deputy GC) may not vote.",
    });
  });

  it("Security investigates; Security and the CSO recommend; only the CSO attaches out-of-band contact", () => {
    // GC / CPO appear only for INDEPENDENT cases; getCaseFor() enforces the route.
    expect(allowed("recommend")).toEqual(["security", "cso", "gc", "cpo"]);
    expect(allowed("recordFinding")).toEqual(["security", "gc", "cpo"]);
    expect(allowed("addEvidence")).toEqual(["gc", "cpo"]);
    expect(allowed("attachContact")).toEqual(["cso"]);
  });

  it("the board's only action is acknowledging a notice", () => {
    const boardActions = ACTIONS.filter(
      (a) =>
        !DEMO.includes(a) &&
        !a.startsWith("view") &&
        authorize(actorOf("board"), a).ok,
    );
    expect(boardActions).toEqual(["acknowledgeNotice"]);
  });

  it("the CEO can view but not change anything", () => {
    const ceoActions = ACTIONS.filter(
      (a) =>
        !DEMO.includes(a) &&
        !a.startsWith("view") &&
        authorize(actorOf("ceo"), a).ok,
    );
    expect(ceoActions).toEqual([]);
  });

  it("employees report, challenge and check receipts but cannot see the case list", () => {
    expect(allowed("reportIncident")).toEqual(["employee"]);
    expect(allowed("raiseChallenge")).toEqual(["employee"]);
    expect(authorize(actorOf("employee"), "viewCases").ok).toBe(false);
  });

  it("only Finance releases payments", () => {
    expect(allowed("releasePayment")).toEqual(["finance"]);
  });

  it("employees and Finance cannot see cases; employees see no payments or notices", () => {
    expect(authorize(actorOf("finance"), "viewCases").ok).toBe(false);
    for (const a of [
      "viewCases",
      "viewPayments",
      "viewNotices",
      "viewBoard",
    ] as Action[])
      expect(authorize(actorOf("employee"), a).ok).toBe(false);
    expect(allowed("viewBoard")).toEqual(["board"]);
  });

  it("denies an unknown action by default", () => {
    expect(authorize(actorOf("gc"), "bogus" as Action)).toEqual({
      ok: false,
      reason: "General Counsel may not bogus.",
    });
  });
});
