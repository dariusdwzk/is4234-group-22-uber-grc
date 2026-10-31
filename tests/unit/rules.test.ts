import { describe, expect, it } from "vitest";
import { RULE_PACK, evaluate, firedIds, startsClocks } from "@/domain/rules";
import { defaultFacts, type Facts } from "@/domain/types";

const f = (o: Partial<Facts>): Facts => ({ ...defaultFacts(), ...o });
const MASS_DOWNLOAD = f({
  dataAccessed: true,
  objects: 16,
  records: "57 million",
  licences: "600,000",
  jurisdictions: ["EU", "California", "Singapore"],
});

describe("rules (rule-packs/v1.json)", () => {
  it("the pack is data owned by Legal: R1, R5, R6, R8 from the mockup (payment rules removed), R9–R13 for staff reports", () => {
    expect(RULE_PACK.owner).toMatch(/Legal/);
    expect(RULE_PACK.rules.map((r) => r.id)).toEqual([
      "R1",
      "R5",
      "R6",
      "R8",
      "R9",
      "R10",
      "R11",
      "R12",
      "R13",
    ]);
  });

  it("nothing fires on default facts: LOW", () => {
    const e = evaluate(defaultFacts(), true);
    expect(e.severity).toBe("LOW");
    expect(firedIds(e)).toBe("");
  });

  it("Day 0 mass download: R1, R6 (regulator open) and R8, with mockup evidence", () => {
    const e = evaluate(MASS_DOWNLOAD, true);
    expect(e.severity).toBe("HIGH");
    expect(firedIds(e)).toBe("R1, R6, R8");
    const ev = Object.fromEntries(e.rules.map((r) => [r.id, r.ev]));
    expect(ev.R1).toBe("16 objects, about 57 million records");
    expect(ev.R6).toBe("FTC inquiry into the 2014 breach");
    expect(ev.R8).toBe("Residents of EU, California, Singapore");
  });

  it("R6 only counts when another high rule fired, and only while the inquiry is open", () => {
    expect(firedIds(evaluate(MASS_DOWNLOAD, false))).toBe("R1, R8");
    expect(firedIds(evaluate(f({ jurisdictions: ["EU"] }), true))).toBe("");
  });

  it("the hacker's email to the CSO fires R5", () => {
    const e = evaluate({ ...MASS_DOWNLOAD, extortion: true }, true);
    expect(firedIds(e)).toBe("R1, R5, R6, R8");
    const ev = Object.fromEntries(e.rules.map((r) => [r.id, r.ev]));
    expect(ev.R5).toBe("Attacker demands money to delete the data");
  });

  it("clocks start only for accessed data with affected residents", () => {
    expect(startsClocks(MASS_DOWNLOAD)).toBe(true);
    expect(startsClocks(f({ dataAccessed: true }))).toBe(false);
  });
});
