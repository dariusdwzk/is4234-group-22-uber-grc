import { fmtT } from "./demo-time";
import type { Facts } from "./types";

/** Tier 1 notice body: generated from a template, never typed by a person (mockup: notice()). */
export function tier1Body(
  c: { id: string; title: string; facts: Facts; detectedH: number },
  regulatorInquiryOpen: boolean,
  clocksStarted: boolean,
): string {
  return (
    "New high-risk incident " +
    c.id +
    ": " +
    c.title.toLowerCase() +
    "." +
    (c.facts.dataAccessed && knownScale(c.facts)
      ? " About " + c.facts.records + " records affected."
      : "") +
    (regulatorInquiryOpen ? " FTC inquiry still open." : "") +
    (clocksStarted ? " GDPR deadline " + fmtT(c.detectedH + 72) + "." : "")
  );
}

/** Staff reports say data was involved but not how much; never print "0 records". */
export const knownScale = (f: Facts): boolean =>
  !!f.records && f.records !== "0";
