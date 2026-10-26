import { describe, expect, it } from "vitest";
import { tier1Body } from "@/domain/board-text";

const input = {
  ref: "CASE-0001",
  source: "manual",
  firedRuleIds: ["R-PII", "R-CAP"],
  dataCategories: ["personal data", "payment details"],
  detectedAt: "2026-11-01T09:00:00.000Z",
};

describe("tier1Body", () => {
  it("names the case, source, fired rules, data categories and detection time", () => {
    const body = tier1Body(input);
    for (const part of [
      "CASE-0001",
      "manual",
      "R-PII, R-CAP",
      "personal data, payment details",
      "2026-11-01T09:00:00.000Z",
    ])
      expect(body).toContain(part);
  });
  it("is deterministic and ends with the read-only line", () => {
    expect(tier1Body(input)).toBe(tier1Body({ ...input }));
    expect(
      tier1Body(input).endsWith("Read-only notice — no action required."),
    ).toBe(true);
  });
  it("says so when no data category is known", () => {
    expect(tier1Body({ ...input, dataCategories: [] })).toContain(
      "none identified",
    );
  });
});
