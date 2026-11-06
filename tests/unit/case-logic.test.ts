import { describe, expect, it } from "vitest";
import { blockedReason } from "@/domain/blocked-reasons";
import { tier1Body } from "@/domain/board-text";
import { clocksFrom, gdprRemaining } from "@/domain/clocks";
import { matchCase } from "@/domain/correlation";
import { dueEscalations, type EscalationInput } from "@/domain/escalations";
import { decisionFor, voteOutcome } from "@/domain/gate";
import { defaultFacts } from "@/domain/types";

const facts = {
  ...defaultFacts(),
  dataAccessed: true,
  objects: 16,
  records: "57 million",
  jurisdictions: ["EU"],
};

describe("clocks", () => {
  it("start at detection; SEC and PDPA wait for later decisions", () => {
    const k = clocksFrom(0);
    expect(k.map((c) => [c.key, c.start, c.dur])).toEqual([
      ["class", 0, 24],
      ["mat", 0, 48],
      ["gdpr", 0, 72],
      ["ca", 0, null],
      ["sec", null, null],
      ["pdpa", null, null],
    ]);
    expect(clocksFrom(null)).toEqual([]);
    expect(gdprRemaining(k, 60)).toBe(12);
    expect(gdprRemaining([], 60)).toBeNull();
  });
});

describe("correlation", () => {
  const cases = [
    { id: "C-101", status: "Logged", entityKeys: ["driver-portal"] },
    { id: "C-104", status: "Open", entityKeys: ["rider-backup"] },
  ];
  it("joins the case that shares an entity key", () => {
    expect(matchCase(["rider-backup", "jdough"], cases)).toEqual({
      caseId: "C-104",
      key: "rider-backup",
    });
  });
  it("opens a new case when nothing is shared, and skips closed cases", () => {
    expect(matchCase(["jdough"], cases)).toBeNull();
    expect(
      matchCase(["rider-backup"], [{ ...cases[1]!, status: "Closed" }]),
    ).toBeNull();
  });
});

describe("tier 1 board notice text", () => {
  it("keeps acronyms and never doubles the full stop", () => {
    expect(
      tier1Body(
        {
          id: "C-105",
          title: "The CSO is calling a breach a bug bounty.",
          facts: defaultFacts(),
          detectedH: 0,
        },
        false,
        false,
      ),
    ).toBe(
      "New high-risk incident C-105: the CSO is calling a breach a bug bounty.",
    );
  });

  it("is generated from the case, in the mockup's words", () => {
    expect(
      tier1Body(
        {
          id: "C-104",
          title: "Mass download of rider and driver data",
          facts,
          detectedH: 0,
        },
        true,
        true,
      ),
    ).toBe(
      "New high-risk incident C-104: mass download of rider and driver data. About 57 million records affected. FTC inquiry still open. GDPR deadline Thu 19 Nov, 17:00.",
    );
  });
});

describe("decision gate", () => {
  it("escalating internally needs 2 approvals; disclosing needs 1", () => {
    expect(decisionFor("escalate")).toMatchObject({
      type: "Escalate internally for further investigation",
      need: 2,
      disclose: false,
      caseStatus: "Awaiting 2 approvals",
    });
    expect(decisionFor("disclose")).toMatchObject({
      need: 1,
      disclose: true,
      caseStatus: "Awaiting decision",
    });
  });
  it("one approval of an escalation waits for the other key", () => {
    expect(voteOutcome({ disclose: false }, "gc", "approve", null)).toEqual({
      kind: "waiting",
      caseStatus: "Awaiting Chief Privacy Officer",
    });
  });
  it("both keys approving escalates internally; any rejection requires disclosure", () => {
    expect(
      voteOutcome({ disclose: false }, "cpo", "approve", "approve"),
    ).toEqual({ kind: "escalated" });
    expect(
      voteOutcome({ disclose: false }, "cpo", "reject", "approve"),
    ).toEqual({ kind: "rejected" });
    expect(voteOutcome({ disclose: true }, "gc", "approve", null)).toEqual({
      kind: "disclosed",
    });
  });
});

describe("blocked attempts", () => {
  it("explain the refusal in the mockup's words", () => {
    expect(blockedReason("security", "close")).toBe(
      "Security cannot close cases.",
    );
    expect(blockedReason("cso", "downgrade")).toBe(
      "Security cannot lower severity.",
    );
    expect(blockedReason("cso", "approve")).toMatch(
      /reporting line is Security/,
    );
    expect(blockedReason("ceo", "close")).toBe(
      "The CEO can view cases but cannot change them.",
    );
  });
});

describe("escalations", () => {
  const base: EscalationInput = {
    now: 0,
    notices: [],
    cases: [
      {
        id: "C-104",
        severity: "HIGH",
        status: "Open",
        clocks: clocksFrom(0),
        route: "NORMAL",
        triageDueH: null,
        reviewDueH: null,
        finding: null,
      },
    ],
  };
  it("nothing is due on Day 0", () => {
    expect(dueEscalations(base)).toEqual({
      toAllDirectors: [],
      notices: [],
      triageTimeouts: [],
    });
  });
  it("GDPR window under 25% left (or passed) without disclosure: one Tier 2 notice", () => {
    expect(dueEscalations({ ...base, now: 54 }).notices).toEqual([]); // 18 h left = 25%
    expect(dueEscalations({ ...base, now: 55 }).notices[0]!.body).toMatch(
      /is close/,
    );
    const passed = dueEscalations({ ...base, now: 576 });
    expect(passed.notices).toEqual([
      {
        caseId: "C-104",
        kind: "deadline",
        body: "GDPR 72-hour deadline on C-104 has passed and disclosure is not approved.",
      },
    ]);
    const already = {
      id: "N-2",
      caseId: "C-104",
      tier: 2 as const,
      kind: "deadline",
      t: 576,
      ack: null,
      allDirectors: false,
    };
    expect(
      dueEscalations({ ...base, now: 577, notices: [already] }).notices,
    ).toEqual([]);
  });
  it("disclosed cases do not escalate", () => {
    expect(
      dueEscalations({
        ...base,
        now: 576,
        cases: [{ ...base.cases[0]!, status: "Disclosed" }],
      }).notices,
    ).toEqual([]);
  });
  it("a Tier 2 notice unread for 24 hours goes to all directors; Tier 1 never does", () => {
    const n = (id: string, tier: 1 | 2, ack: number | null) => ({
      id,
      caseId: "C-104",
      tier,
      kind: id,
      t: 0,
      ack,
      allDirectors: false,
    });
    expect(
      dueEscalations({
        ...base,
        now: 24,
        cases: [],
        notices: [n("N-1", 1, null), n("N-2", 2, null), n("N-3", 2, 5)],
      }).toAllDirectors,
    ).toEqual(["N-2"]);
  });
});
