import { describe, expect, it } from "vitest";
import { detectConflicts } from "@/domain/conflicts";
import type { CaseFacts } from "@/domain/facts";

const facts: CaseFacts = {
  personalDataAccessed: false,
  paymentLinkedToIncident: false,
  payeeVerified: true,
  amountCents: 0,
  programmeMaxCents: 1_000_000,
  extortionLanguage: false,
  regulatorInquiryOpen: false,
  legalDeadlineTriggered: false,
  openChallengeFlag: false,
};

describe("detectConflicts", () => {
  it('US-14: dataTaken "no" with personalDataAccessed → DATA_TAKEN_CONTRADICTED', () =>
    expect(
      detectConflicts(
        { dataTaken: "no", treatAs: "incident" },
        { ...facts, personalDataAccessed: true },
        [],
      ).map((c) => c.code),
    ).toEqual(["DATA_TAKEN_CONTRADICTED"]));
  it("treatAs bug_bounty with R-PAY-LINKED fired → BOUNTY_LABEL_CONTRADICTED", () =>
    expect(
      detectConflicts({ dataTaken: "unknown", treatAs: "bug_bounty" }, facts, [
        "R-PAY-LINKED",
      ]).map((c) => c.code),
    ).toEqual(["BOUNTY_LABEL_CONTRADICTED"]));
  it("both conflicts can fire together", () =>
    expect(
      detectConflicts(
        { dataTaken: "no", treatAs: "bug_bounty" },
        { ...facts, personalDataAccessed: true },
        ["R-PAY-LINKED"],
      ),
    ).toHaveLength(2));
  it("consistent recommendation → none", () =>
    expect(
      detectConflicts({ dataTaken: "yes", treatAs: "incident" }, facts, []),
    ).toEqual([]));
  it("no recommendation → []", () =>
    expect(detectConflicts(null, facts, ["R-PAY-LINKED"])).toEqual([]));
});
