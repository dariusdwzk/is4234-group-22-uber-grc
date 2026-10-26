export const UBER_2016 = {
  detectionToDisclosureDays: 371,
  note: "Uber 2016: detection to public disclosure 371 days; no board involvement appears in the record.",
} as const;

const DAY = 86_400_000;

/** Days from detection to the Tier 1 board notice, one decimal, never negative. */
export function daysToBoard(detectedAt: string, tier1At: string): number {
  const ms = Date.parse(tier1At) - Date.parse(detectedAt);
  return Math.round(Math.max(0, ms / DAY) * 10) / 10;
}
