import { beforeEach, describe, expect, it } from "vitest";
import { STEPS, endTour, guideCard } from "@/client/guide";
import { guideOrHelp } from "@/client/help";
import { S, emptyState } from "@/client/store";
import { workItems } from "@/client/work";
import {
  caseTable,
  clip,
  noticeRow,
  outcomeText,
} from "@/client/views/components";
import { vBoard } from "@/client/views/board";
import { vCase } from "@/client/views/case/page";
import { normalBox } from "@/client/views/case/normal";
import { vWork } from "@/client/views/work";
import { clocksFrom } from "@/domain/clocks";
import { ESCALATED_STATUS, ESCALATE_TYPE } from "@/domain/gate";
import { plainEvent } from "@/domain/plain-event";
import { defaultFacts } from "@/domain/types";
import type { CaseView, NoticeView } from "@/domain/view-state";

const mk = (o: Partial<CaseView> = {}) =>
  ({
    id: "C-104",
    title: "Mass download of rider and driver data",
    detectedH: 0,
    severity: "HIGH",
    status: "Open",
    facts: defaultFacts(),
    signals: [],
    rules: [],
    clocks: [],
    finding: null,
    disclosedH: null,
    rec: null,
    decision: null,
    route: "NORMAL",
    triageDueH: null,
    reviewDueH: null,
    answers: null,
    evidence: [],
    ...o,
  }) as CaseView;

const escalate = (
  votes: NonNullable<CaseView["decision"]>["votes"],
  status: "Pending" | "Approved" | "Rejected",
) => ({
  type: ESCALATE_TYPE,
  need: 2,
  disclose: false,
  status,
  votes,
});

beforeEach(() => {
  S.d = emptyState();
  Object.assign(S, {
    role: null,
    view: "work",
    caseId: "C-104",
    caseTab: "deadlines",
    boardTab: "overview",
    boardOpen: {},
    guided: false,
    mode: "explore",
    guideStep: 0,
    logFilter: "all",
  });
});

describe("M3 outcomeText", () => {
  it("pending", () => {
    expect(outcomeText(mk({ decision: escalate({}, "Pending") }))).toBe(
      "Waiting for the General Counsel and the Chief Privacy Officer to decide.",
    );
  });
  it("rejected: names the approver and the decision type", () => {
    const c = mk({
      status: "Disclosure required",
      decision: escalate(
        { cpo: { vote: "reject", reason: "x", t: 1 } },
        "Rejected",
      ),
    });
    expect(outcomeText(c)).toBe(
      "The Chief Privacy Officer rejected the recommendation to escalate internally for further investigation. Disclosure to regulators and affected people is now required.",
    );
  });
  it("escalated", () => {
    const c = mk({
      status: ESCALATED_STATUS,
      decision: escalate(
        {
          gc: { vote: "approve", reason: "x", t: 1 },
          cpo: { vote: "approve", reason: "x", t: 2 },
        },
        "Approved",
      ),
    });
    expect(outcomeText(c)).toBe(
      "Both approvers agreed to escalate internally. Disclosure has not been made; the legal deadlines keep running.",
    );
  });
  it("disclosed", () => {
    expect(outcomeText(mk({ status: "Disclosed", disclosedH: 5 }))).toMatch(
      /^Disclosure approved .+\.$/,
    );
  });
});

describe("M1 Security and CSO panels show the outcome", () => {
  it("CSO after a rejection", () => {
    S.role = "cso";
    const c = mk({
      status: "Disclosure required",
      rec: { author: "cso", act: "escalate", reason: "r", t: 1 },
      decision: escalate(
        { gc: { vote: "reject", reason: "x", t: 1 } },
        "Rejected",
      ),
    });
    const h = normalBox(c);
    expect(h).toContain("The General Counsel rejected");
    expect(h).not.toContain("Recommendation sent");
  });
  it("Security once disclosed", () => {
    S.role = "security";
    const h = normalBox(
      mk({ status: "Disclosed", finding: "f", disclosedH: 3 }),
    );
    expect(h).toContain("Disclosure approved");
    expect(h).not.toContain("Finding recorded");
  });
  it("Board reads the outcome sentence, not 'Decision: Rejected'", () => {
    S.role = "board";
    const h = normalBox(
      mk({
        status: "Disclosure required",
        decision: escalate(
          { cpo: { vote: "reject", reason: "x", t: 1 } },
          "Rejected",
        ),
      }),
    );
    expect(h).toContain("rejected the recommendation");
    expect(h).not.toContain("Decision: Rejected");
  });
});

describe("M4 legal deadlines are marked illustrative", () => {
  const c = () => mk({ clocks: clocksFrom(0), severity: "HIGH" });
  it("case summary and Deadlines tab: legal clocks only", () => {
    S.role = "security";
    S.d.cases = [c()];
    const h = vCase();
    expect(h).toMatch(/GDPR deadline<\/dt><dd>[^<]*.*\(illustrative\)/);
    const rows = h.split("<tr>");
    expect(rows.find((r) => r.includes("GDPR Art. 33"))).toContain(
      "(illustrative)",
    );
    expect(rows.find((r) => r.includes("Decide materiality"))).not.toContain(
      "(illustrative)",
    );
  });
  it("All cases / CEO next deadline", () => {
    S.role = "security";
    expect(caseTable([c()])).toContain("(illustrative)");
  });
  it("Board regulator deadline and notice text", () => {
    S.role = "board";
    S.d.replayId = "C-104";
    S.d.cases = [c()];
    expect(vBoard()).toMatch(/Regulator deadline \(GDPR\).*\(illustrative\)/);
    const n: NoticeView = {
      id: "N1",
      caseId: "C-104",
      tier: 1,
      kind: "new",
      body: "New high-risk incident C-104. GDPR deadline Thu 19 Nov, 17:00.",
      t: 0,
      ack: null,
      allDirs: false,
    };
    expect(noticeRow(n, false)).toContain(
      "GDPR deadline Thu 19 Nov, 17:00 (illustrative).",
    );
  });
});

describe("M5 case rows open from the keyboard", () => {
  it("the case id is a real button", () => {
    expect(caseTable([mk()])).toContain(
      '<button class="link" data-a="openCase" data-x="C-104">',
    );
  });
});

describe("M6 an unrated report", () => {
  it("says the impact is not yet confirmed", () => {
    S.role = "security";
    S.d.cases = [mk({ severity: "PENDING", status: "Needs triage" })];
    const h = vCase();
    expect(h).toContain(
      "Impact not yet confirmed — the Chief Privacy Officer rates this report.",
    );
    expect(h).toContain("Not yet rated");
    expect(h).toContain("The rules run again once the rating is confirmed.");
    expect(h).not.toContain("No personal data involved.");
    expect(h).not.toContain("Why it is low risk");
  });
  it("still shows Security's data facts", () => {
    S.role = "cpo";
    S.d.cases = [
      mk({
        severity: "PENDING",
        status: "Needs triage",
        facts: { ...defaultFacts(), dataAccessed: true },
      }),
    ];
    expect(vCase()).toContain("Data exposed");
  });
});

describe("M7 empty My work explains what to wait for", () => {
  it.each([
    ["gc", "when the CSO sends a recommendation"],
    ["cpo", "when the CSO sends a recommendation"],
    ["cso", "when Security records a finding on a high-risk case"],
    ["security", "when monitoring opens one or a staff report arrives"],
  ] as const)("%s", (role, hint) => {
    S.role = role;
    expect(vWork()).toContain("Nothing is waiting on you. ");
    expect(vWork()).toContain(hint);
  });
  it("GC with no recommendation: secondary button and an explanation", () => {
    S.role = "gc";
    const h = normalBox(mk());
    expect(h).toContain('<button class="btn" data-a="discl">');
    expect(h).toContain(
      "You can approve disclosure at any time, without waiting for the CSO's recommendation.",
    );
  });
});

describe("I1 the tour resets when it is closed", () => {
  it("Help after closing the tour is the page help, and forms are not prefilled", () => {
    S.role = "cso";
    S.guided = true;
    S.mode = "demo";
    endTour();
    expect(S.guided).toBe(false);
    S.guided = true; // Help
    expect(guideOrHelp()).toContain("About this page");
    expect(normalBox(mk())).not.toContain("checked");
  });
});

describe("I4 Demo complete suggests the other ending", () => {
  const finish = (c: CaseView) => {
    S.d.replayId = "C-104";
    S.d.cases = [c];
    S.d.progress = {
      finding: true,
      recommended: true,
      csoBlocked: true,
      gcDone: true,
      cpoDone: true,
      allAcked: true,
    };
    S.logFilter = "decision";
    S.guideStep = STEPS.length;
  };
  it("after Reject then Approve disclosure, suggests Approve", () => {
    finish(
      mk({
        status: "Disclosed",
        decision: escalate(
          { cpo: { vote: "reject", reason: "x", t: 1 } },
          "Rejected",
        ),
      }),
    );
    expect(guideCard()).toContain(
      "choose Approve as the Chief Privacy Officer",
    );
  });
  it("after both approved, suggests Reject", () => {
    finish(
      mk({
        status: ESCALATED_STATUS,
        decision: escalate(
          {
            gc: { vote: "approve", reason: "x", t: 1 },
            cpo: { vote: "approve", reason: "x", t: 2 },
          },
          "Approved",
        ),
      }),
    );
    expect(guideCard()).toContain("choose Reject as the Chief Privacy Officer");
  });
});

describe("small copy fixes", () => {
  it("m3: staff reports are not 'opened automatically' on Security's My work", () => {
    const c = mk({
      status: "Open",
      answers: {
        data: "YES",
        money: "NO",
        harm: "NO",
        handling: "NO",
        systems: "NO",
        outsiders: "NO",
        ongoing: "NO",
      },
    });
    expect(workItems([c], "security")[0]!.line).toBe(
      "Staff report — record what you find.",
    );
  });
  it("m3: a server-cut title ends at a word boundary", () => {
    const t =
      "Someone emailed me about rider data, not sure if it is real or f";
    expect(clip(t, t.length)).toBe(
      "Someone emailed me about rider data, not sure if it is real or…",
    );
    expect(clip("Short title", 70)).toBe("Short title");
  });
  it("m9: no double full stop after a recommendation reason", () => {
    const p = plainEvent({
      seq: 1,
      t: 0,
      actor: "CSO (also Deputy GC)",
      action: "Recommendation sent",
      detail: "Escalate internally. Keep it in-house.",
      caseId: "C-104",
      hash: "h",
    } as Parameters<typeof plainEvent>[0]);
    expect(p!.text).not.toContain("..");
  });
});
