import { describe, expect, it } from "vitest";
import { mayInvestigate } from "@/domain/case-access";
import { fileProblem, safeFileName } from "@/domain/evidence";
import {
  independentDecisionFor,
  otherApprover,
  voteOutcome,
} from "@/domain/gate";
import { plainEvent, type LedgerView } from "@/domain/plain-event";

describe("independent path: who investigates", () => {
  it("GC and CPO investigate only INDEPENDENT cases; Security only the others", () => {
    expect(mayInvestigate("gc", "INDEPENDENT")).toBe(true);
    expect(mayInvestigate("cpo", "INDEPENDENT")).toBe(true);
    expect(mayInvestigate("gc", "NORMAL")).toBe(false);
    expect(mayInvestigate("security", "INDEPENDENT")).toBe(false);
    expect(mayInvestigate("security", "NORMAL")).toBe(true);
    expect(mayInvestigate(null, "NORMAL")).toBe(false);
  });
});

describe("independent path: the other one decides", () => {
  it("the decision waits for the other approver", () => {
    expect(otherApprover("gc")).toBe("cpo");
    expect(independentDecisionFor("escalate", "gc")).toEqual({
      type: "Escalate internally for further investigation",
      need: 1,
      disclose: false,
      caseStatus: "Awaiting Chief Privacy Officer",
    });
    expect(independentDecisionFor("disclose", "cpo")).toMatchObject({
      disclose: true,
      caseStatus: "Awaiting General Counsel",
    });
  });

  it("the recommendation is the author's key: the other's approval completes it", () => {
    // vote.ts passes the author's recommendation as the other key ("approve").
    expect(
      voteOutcome({ disclose: false }, "cpo", "approve", "approve"),
    ).toEqual({
      kind: "escalated",
    });
    expect(
      voteOutcome({ disclose: false }, "cpo", "reject", "approve"),
    ).toEqual({
      kind: "rejected",
    });
    expect(voteOutcome({ disclose: true }, "gc", "approve", "approve")).toEqual(
      {
        kind: "disclosed",
      },
    );
  });
});

describe("evidence files", () => {
  it("accepts small PDF, image and text files only", () => {
    expect(
      fileProblem({ name: "a.pdf", type: "application/pdf", size: 1000 }),
    ).toBeNull();
    expect(
      fileProblem({ name: "a.html", type: "text/html", size: 10 }),
    ).toMatch(/Only PDF/);
    expect(fileProblem({ name: "a.png", type: "image/png", size: 0 })).toMatch(
      /empty/,
    );
    expect(
      fileProblem({
        name: "a.png",
        type: "image/png",
        size: 2 * 1024 * 1024 + 1,
      }),
    ).toMatch(/2 MB/);
  });

  it("makes file names safe to store and to send back", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName('re"port\r\n.pdf')).toBe("re_port__.pdf");
    expect(safeFileName("")).toBe("evidence");
  });

  it("reads as plain language in the evidence log, without the file hash", () => {
    const e: LedgerView = {
      seq: 1,
      t: 0,
      actor: "General Counsel",
      action: "Evidence added",
      caseId: "C-105",
      detail: "Chat export. File: chat.txt, SHA-256 " + "a".repeat(64) + ".",
      hash: "h",
    };
    expect(plainEvent(e)).toEqual({
      cat: "work",
      text: "General Counsel added evidence: Chat export.",
    });
    expect(
      plainEvent({
        ...e,
        action: "Recommendation sent",
        detail: "Escalate internally for further investigation. No harm",
      }),
    ).toEqual({
      cat: "decision",
      text: "General Counsel recommended: Escalate internally for further investigation. No harm.",
    });
  });
});
