import { describe, expect, it } from "vitest";
import type { CaseFacts } from "@/domain/facts";
import { RulePackSchema, loadRulePack } from "@/domain/rule-pack";
import { evaluate } from "@/domain/rules";
import v1 from "../../rule-packs/v1.json";

const pack = loadRulePack("v1");

const quiet: CaseFacts = {
  personalDataAccessed: false,
  paymentLinkedToIncident: false,
  payeeVerified: true,
  amountCents: 0,
  programmeMaxCents: pack.programmeMaxCents,
  extortionLanguage: false,
  regulatorInquiryOpen: false,
  legalDeadlineTriggered: false,
  openChallengeFlag: false,
};

const rows: [string, Partial<CaseFacts>][] = [
  ["R-PII", { personalDataAccessed: true }],
  ["R-PAY-LINKED", { paymentLinkedToIncident: true }],
  ["R-PAYEE", { payeeVerified: false }],
  ["R-CAP", { amountCents: pack.programmeMaxCents + 1 }],
  ["R-EXTORT", { extortionLanguage: true }],
  ["R-REGULATOR", { regulatorInquiryOpen: true }],
  ["R-DEADLINE", { legalDeadlineTriggered: true }],
  ["R-FLAG", { openChallengeFlag: true }],
];

describe("evaluate", () => {
  it.each(rows)("%s alone gives HIGH with only that rule", (id, facts) => {
    expect(evaluate(pack, { ...quiet, ...facts })).toEqual({
      tier: "HIGH",
      firedRuleIds: [id],
    });
  });

  it("every rule in the pack has a table row", () => {
    expect(pack.rules.map((r) => r.id).sort()).toEqual(
      rows.map(([id]) => id).sort(),
    );
  });

  it("R-CAP is strict: the programme maximum itself does not fire", () => {
    expect(
      evaluate(pack, { ...quiet, amountCents: pack.programmeMaxCents }).tier,
    ).toBe("LOW");
  });

  it("US-06: blocked login only → LOW, no rules", () => {
    expect(evaluate(pack, quiet)).toEqual({ tier: "LOW", firedRuleIds: [] });
  });

  it('US-07: payment labelled "bug bounty" linked to incident → HIGH with R-PAY-LINKED', () => {
    // The label never reaches the facts (see facts.test.ts); linkage alone decides.
    expect(evaluate(pack, { ...quiet, paymentLinkedToIncident: true })).toEqual(
      {
        tier: "HIGH",
        firedRuleIds: ["R-PAY-LINKED"],
      },
    );
  });

  it("US-08: replay facts → HIGH with R-PII, R-PAY-LINKED, R-PAYEE, R-CAP, R-EXTORT", () => {
    const result = evaluate(pack, {
      ...quiet,
      personalDataAccessed: true,
      paymentLinkedToIncident: true,
      payeeVerified: false,
      amountCents: 10_000_000,
      extortionLanguage: true,
    });
    expect(result).toEqual({
      tier: "HIGH",
      firedRuleIds: ["R-PII", "R-PAY-LINKED", "R-PAYEE", "R-CAP", "R-EXTORT"],
    });
  });
});

describe("rule pack schema", () => {
  it("v1.json parses with RulePackSchema", () => {
    expect(RulePackSchema.safeParse(v1).success).toBe(true);
  });

  it("v1 clock labels are marked illustrative and avoid compliance claims", () => {
    for (const c of pack.clocks)
      expect(c.label.toLowerCase()).toContain("illustrative");
    expect(JSON.stringify(v1).toLowerCase()).not.toContain("complies with");
  });

  it("unknown fact name in a rule fails schema", () => {
    const bad = structuredClone(v1);
    bad.rules[0]!.when.fact = "personalDataAcessed"; // typo
    expect(RulePackSchema.safeParse(bad).success).toBe(false);
  });

  it("unknown op, wrong fact type for op, and non-GC owner fail schema", () => {
    const withWhen = (when: unknown) => ({
      ...v1,
      rules: [{ id: "R-X", description: "d", tier: "HIGH", when }],
    });
    expect(
      RulePackSchema.safeParse(withWhen({ fact: "amountCents", op: "isTrue" }))
        .success,
    ).toBe(false);
    expect(
      RulePackSchema.safeParse(
        withWhen({ fact: "personalDataAccessed", op: "isMaybe" }),
      ).success,
    ).toBe(false);
    expect(RulePackSchema.safeParse({ ...v1, owner: "SA" }).success).toBe(
      false,
    );
  });
});
