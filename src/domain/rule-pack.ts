import { z } from "zod";
import v1 from "../../rule-packs/v1.json";

export const BOOLEAN_FACTS = [
  "personalDataAccessed",
  "paymentLinkedToIncident",
  "payeeVerified",
  "extortionLanguage",
  "regulatorInquiryOpen",
  "legalDeadlineTriggered",
  "openChallengeFlag",
] as const;
export const NUMERIC_FACTS = ["amountCents", "programmeMaxCents"] as const;

const booleanFact = z.enum(BOOLEAN_FACTS);
const numericFact = z.enum(NUMERIC_FACTS);

// Unknown fact names or ops fail parsing, so a typo in a pack cannot silently never fire.
const RuleWhenSchema = z.discriminatedUnion("op", [
  z.strictObject({ fact: booleanFact, op: z.literal("isTrue") }),
  z.strictObject({ fact: booleanFact, op: z.literal("isFalse") }),
  z.strictObject({
    fact: numericFact,
    op: z.literal("gt"),
    value: z.number().int(),
  }),
  z.strictObject({
    fact: numericFact,
    op: z.literal("gtFact"),
    value: numericFact,
  }),
]);

export const RulePackSchema = z.strictObject({
  version: z.string().min(1),
  owner: z.literal("GC"),
  programmeMaxCents: z.number().int().min(0),
  extortionTerms: z.array(z.string().min(1)),
  slas: z.strictObject({
    classifyH: z.number().int().positive(),
    decideH: z.number().int().positive(),
    escalateAtPct: z.number().int().min(1).max(100),
  }),
  clocks: z.array(
    z.strictObject({ id: z.string().min(1), label: z.string().min(1) }),
  ),
  rules: z.array(
    z.strictObject({
      id: z.string().regex(/^R-[A-Z0-9-]+$/),
      description: z.string().min(1),
      when: RuleWhenSchema,
      tier: z.literal("HIGH"),
    }),
  ),
});

export type RulePack = z.infer<typeof RulePackSchema>;
export type RuleWhen = RulePack["rules"][number]["when"];

const PACKS: Record<"v1", unknown> = { v1 };

export function loadRulePack(version: "v1"): RulePack {
  return RulePackSchema.parse(PACKS[version]);
}
