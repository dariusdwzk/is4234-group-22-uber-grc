import { describe, expect, it } from "vitest";
import {
  checkDecision,
  gateState,
  type Checklist,
  type Decision,
} from "@/domain/gate";
import type { Actor } from "@/domain/types";

const d = (
  role: "GC" | "PCO",
  outcome: Decision["outcome"],
  notifyBy: string | null = null,
  approverId = role.toLowerCase(),
): Decision => ({
  approverId,
  approverRole: role,
  outcome,
  notifyBy,
  reasonCode: "LEGAL_ADVICE",
});

describe("gateState truth table", () => {
  it("none → awaiting GC and PCO", () =>
    expect(gateState([])).toEqual({
      status: "awaiting",
      missing: ["GC", "PCO"],
    }));
  it("US-12: only one approval → awaiting the other (case stays open)", () => {
    expect(gateState([d("GC", "withhold")])).toEqual({
      status: "awaiting",
      missing: ["PCO"],
    });
    expect(gateState([d("PCO", "withhold")])).toEqual({
      status: "awaiting",
      missing: ["GC"],
    });
  });
  it("both withhold → agreed withhold", () =>
    expect(gateState([d("GC", "withhold"), d("PCO", "withhold")])).toEqual({
      status: "agreed",
      outcome: "withhold",
      notifyBy: null,
    }));
  it("withhold vs notify_now → disagreement", () =>
    expect(gateState([d("GC", "withhold"), d("PCO", "notify_now")])).toEqual({
      status: "disagreement",
    }));
  it("notify_later with different dates → disagreement", () =>
    expect(
      gateState([
        d("GC", "notify_later", "2026-11-05"),
        d("PCO", "notify_later", "2026-11-06"),
      ]),
    ).toEqual({ status: "disagreement" }));
  it("notify_later with the same date → agreed with that date", () =>
    expect(
      gateState([
        d("GC", "notify_later", "2026-11-05"),
        d("PCO", "notify_later", "2026-11-05"),
      ]),
    ).toEqual({ status: "agreed", outcome: "notify_later", notifyBy: "2026-11-05" }));
  it("re-deciding replaces the actor's own role entry (last wins)", () =>
    expect(
      gateState([
        d("GC", "withhold"),
        d("PCO", "notify_now"),
        d("PCO", "withhold"),
      ]),
    ).toMatchObject({ status: "agreed", outcome: "withhold" }));
});

const full: Checklist = {
  reviewedEvidence: true,
  noPersonalConflict: true,
  consideredRegulatorDeadlines: true,
  consideredBoardNotice: true,
  notInstructedBySecurity: true,
};
const gc: Actor = { id: "gc", role: "GC", displayName: "GC" };
const pco: Actor = { id: "pco", role: "PCO", displayName: "PCO" };
const base = {
  approver: pco,
  independent: true,
  checklist: full,
  outcome: "withhold" as const,
  notifyBy: null,
  existing: [] as Decision[],
};

describe("checkDecision", () => {
  it("accepts a valid decision", () =>
    expect(checkDecision(base)).toEqual({ ok: true }));
  it("SA approver → WRONG_ROLE", () =>
    expect(
      checkDecision({ ...base, approver: { ...pco, role: "SA" } }),
    ).toEqual({ ok: false, reason: "WRONG_ROLE" }));
  it("non-independent → NOT_INDEPENDENT", () =>
    expect(checkDecision({ ...base, independent: false })).toEqual({
      ok: false,
      reason: "NOT_INDEPENDENT",
    }));
  it("US-13: same person holding both approvals → SAME_APPROVER", () =>
    expect(
      checkDecision({
        ...base,
        approver: { ...gc, role: "PCO" },
        existing: [d("GC", "withhold", null, "gc")],
      }),
    ).toEqual({ ok: false, reason: "SAME_APPROVER" }));
  it("re-deciding one's own role is not SAME_APPROVER", () =>
    expect(
      checkDecision({ ...base, existing: [d("PCO", "notify_now", null, "pco")] }),
    ).toEqual({ ok: true }));
  it.each(Object.keys(full) as (keyof Checklist)[])(
    "checklist %s false → CHECKLIST_INCOMPLETE",
    (k) =>
      expect(
        checkDecision({ ...base, checklist: { ...full, [k]: false } }),
      ).toEqual({ ok: false, reason: "CHECKLIST_INCOMPLETE" }),
  );
  it("notify_later without a date → NOTIFY_DATE_REQUIRED", () =>
    expect(checkDecision({ ...base, outcome: "notify_later" })).toEqual({
      ok: false,
      reason: "NOTIFY_DATE_REQUIRED",
    }));
  it("notify_later with a date is ok", () =>
    expect(
      checkDecision({ ...base, outcome: "notify_later", notifyBy: "2026-11-05" }),
    ).toEqual({ ok: true }));
});
