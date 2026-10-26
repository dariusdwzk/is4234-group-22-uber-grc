import type { CaseFacts } from "./facts";
import type { RulePack, RuleWhen } from "./rule-pack";
import type { Tier } from "./types";

function matches(when: RuleWhen, facts: CaseFacts): boolean {
  switch (when.op) {
    case "isTrue":
      return facts[when.fact] === true;
    case "isFalse":
      return facts[when.fact] === false;
    case "gt":
      return facts[when.fact] > when.value;
    case "gtFact":
      return facts[when.fact] > facts[when.value];
  }
}

// Pure. Any fired rule gives HIGH, none gives LOW; fired ids are in pack order.
export function evaluate(
  pack: RulePack,
  facts: CaseFacts,
): { tier: Tier; firedRuleIds: string[] } {
  const firedRuleIds = pack.rules
    .filter((r) => matches(r.when, facts))
    .map((r) => r.id);
  return { tier: firedRuleIds.length > 0 ? "HIGH" : "LOW", firedRuleIds };
}
