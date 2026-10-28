import { z } from "zod";
import pack from "../../rule-packs/v1.json";
import { money } from "./money";
import type { Facts, Severity } from "./types";

const Condition = z.strictObject({
  fact: z.string(),
  op: z.enum(["isTrue", "isFalse", "positive", "aboveCap", "nonEmpty"]),
});

export const RulePackSchema = z.strictObject({
  version: z.string(),
  owner: z.string(),
  programMaxCents: z.number().int().positive(),
  rules: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      // high: makes the case HIGH. modifier/clocks: shown, but only count alongside a high rule.
      effect: z.enum(["high", "modifier", "clocks"]),
      when: z.array(Condition).min(1),
      evidence: z.string(),
      /** Shown instead of `evidence` when every number it quotes is still unknown (zero). */
      unknownEvidence: z.string().optional(),
    }),
  ),
});

export type RulePack = z.infer<typeof RulePackSchema>;

/** Rules are data owned by Legal (rule-packs/v1.json), validated once at load. */
export const RULE_PACK: RulePack = RulePackSchema.parse(pack);

export type RuleResult = {
  id: string;
  name: string;
  fired: boolean;
  ev: string;
};
/** The rules engine only ever says LOW or HIGH; PENDING is a triage state, not a rating. */
export type Evaluation = {
  severity: Exclude<Severity, "PENDING">;
  rules: RuleResult[];
};

type Inputs = Facts & { regulatorInquiryOpen: boolean; anyHigh: boolean };

function holds(
  c: z.infer<typeof Condition>,
  x: Inputs,
  capCents: number,
): boolean {
  const v = (x as Record<string, unknown>)[c.fact];
  switch (c.op) {
    case "isTrue":
      return v === true;
    case "isFalse":
      return v === false;
    case "positive":
      return typeof v === "number" && v > 0;
    case "aboveCap":
      return typeof v === "number" && v > capCents;
    case "nonEmpty":
      return Array.isArray(v) && v.length > 0;
  }
}

function evidence(
  r: Pick<RulePack["rules"][number], "evidence" | "unknownEvidence">,
  f: Facts,
  capCents: number,
): string {
  const values: Record<string, string> = {
    objects: String(f.objects),
    records: f.records,
    payment: money(f.paymentCents),
    capMultiple: (f.paymentCents / capCents).toFixed(0),
    flags: String(f.flags),
    jurisdictions: f.jurisdictions.join(", "),
  };
  const used = [...r.evidence.matchAll(/\{(\w+)\}/g)].map((m) => values[m[1]!]);
  // Never invent a scale: a staff report says data was taken but not how much.
  if (r.unknownEvidence && used.length && used.every((v) => !v || v === "0"))
    return r.unknownEvidence;
  return r.evidence.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");
}

/** The mockup's evaluate(): high rules first, then the rules that depend on them. */
export function evaluate(
  facts: Facts,
  regulatorInquiryOpen: boolean,
  p: RulePack = RULE_PACK,
): Evaluation {
  const run = (rules: RulePack["rules"], anyHigh: boolean) =>
    rules.map((r) => {
      const x = { ...facts, regulatorInquiryOpen, anyHigh };
      const fired = r.when.every((c) => holds(c, x, p.programMaxCents));
      return {
        id: r.id,
        name: r.name,
        fired,
        ev: fired ? evidence(r, facts, p.programMaxCents) : "",
      };
    });
  const high = run(
    p.rules.filter((r) => r.effect === "high"),
    false,
  );
  const anyHigh = high.some((r) => r.fired);
  const rest = run(
    p.rules.filter((r) => r.effect !== "high"),
    anyHigh,
  );
  return {
    severity: anyHigh ? "HIGH" : "LOW",
    rules: [...high, ...rest].sort((a, b) =>
      a.id.localeCompare(b.id, "en", { numeric: true }),
    ),
  };
}

export const firedIds = (e: Evaluation): string =>
  e.rules
    .filter((r) => r.fired)
    .map((r) => r.id)
    .join(", ");

/** R8: data accessed for residents of a jurisdiction starts the legal clocks. */
export const startsClocks = (f: Facts): boolean =>
  f.dataAccessed && f.jurisdictions.length > 0;
