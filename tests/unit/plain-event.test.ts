import { describe, expect, it } from "vitest";
import { plainEvent, type LedgerView } from "@/domain/plain-event";

const e = (actor: string, action: string, detail = "", caseId = "C-104") =>
  ({ seq: 1, t: 0, actor, action, caseId, detail, hash: "h" }) as LedgerView;

describe("plainEvent (the board's evidence log wording)", () => {
  it("signals read as detections, worded per source", () => {
    expect(
      plainEvent(
        e("Cloud monitoring", "Signal received", "SIG-201: mass download"),
      ),
    ).toEqual({
      cat: "detect",
      text: "Cloud monitoring detected a mass download.",
    });
    expect(
      plainEvent(
        e("HackerOne", "Signal received", "SIG-202: report from jdough"),
      ),
    ).toEqual({
      cat: "detect",
      text: "HackerOne received a report from jdough.",
    });
  });

  it("blocked attempts name who tried what", () => {
    expect(
      plainEvent(
        e(
          "CSO (also Deputy GC)",
          "Blocked: Close case",
          "Security cannot close cases.",
        ),
      ),
    ).toEqual({
      cat: "blocked",
      text: "CSO (also Deputy GC) tried to close case. Not allowed.",
    });
    expect(plainEvent(e("CEO", "Blocked: Approve"))!.cat).toBe("blocked");
  });

  it("votes keep only the first sentence of the detail", () => {
    expect(
      plainEvent(
        e(
          "Chief Privacy Officer",
          "Rejected",
          "Escalate internally for further investigation. Legal advice.",
        ),
      ),
    ).toEqual({
      cat: "decision",
      text: "Chief Privacy Officer rejected: escalate internally for further investigation.",
    });
  });

  it("anonymous staff stay anonymous", () => {
    expect(
      plainEvent(e("Anonymous employee", "Staff report received"))!.text,
    ).toBe("A staff member (anonymous) sent a report.");
    expect(plainEvent(e("Employee", "Staff report received"))!.text).toBe(
      "A staff member sent a report.",
    );
    expect(
      plainEvent(e("System", "Triage timed out: rated HIGH automatically")),
    ).toEqual({
      cat: "notice",
      text: "No rating within 24 hours, so the report was rated high risk automatically.",
    });
  });

  it("notices get their own category", () => {
    expect(
      plainEvent(
        e("System", "Board notice sent (Tier 2)", "GDPR deadline is close."),
      ),
    ).toEqual({
      cat: "notice",
      text: "Board notified: GDPR deadline is close.",
    });
  });

  it("low-level system entries are hidden", () => {
    for (const a of [
      "GENESIS",
      "Classified LOW",
      "Signal merged",
      "Rules re-evaluated",
    ])
      expect(plainEvent(e("System", a))).toBeNull();
  });
});
