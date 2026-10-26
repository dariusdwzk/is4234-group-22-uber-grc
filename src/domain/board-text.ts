export type Tier1Input = {
  ref: string;
  source: string;
  firedRuleIds: string[];
  dataCategories: string[];
  detectedAt: string;
};

// Deterministic: same input, same text. Clocks are added in P3 when they exist.
export function tier1Body(i: Tier1Input): string {
  return [
    `Case ${i.ref} has been classified HIGH.`,
    `Source: ${i.source}.`,
    `Detected: ${i.detectedAt}.`,
    `Rules fired: ${i.firedRuleIds.join(", ")}.`,
    `Data categories: ${i.dataCategories.length ? i.dataCategories.join(", ") : "none identified"}.`,
    "Read-only notice — no action required.",
  ].join("\n");
}
