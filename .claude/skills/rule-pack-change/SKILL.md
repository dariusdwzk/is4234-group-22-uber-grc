---
name: rule-pack-change
description: Use when adding or changing a rule in rule-packs/ or src/domain/rules.ts and facts.ts. Covers format, test row, version bump and ownership.
---

# Rule pack change

Owner of the data: GC (Legal). Code owner: B.

Format (spec §7), Zod-validated: `{version, owner:"GC", programmeMaxCents, extortionTerms[], slas{classifyH, decideH, escalateAtPct}, clocks[], rules:[{id, description, when:{fact, op, value?}, tier:"HIGH"}]}`. Ops: `isTrue`, `isFalse`, `gt`, `gtFact`, `containsAny`.

Steps:
1. Add or edit the rule; ids look like `R-XXX`.
2. Add one table-driven test row per rule in the rules test (plus the "bug bounty label does not downgrade" row stays).
3. Bump `version`; the GENESIS payload records `rulePackVersion`.
4. `evaluate(pack, facts)` stays pure. Any fired rule gives HIGH, none gives LOW.
5. Wording: "illustrative" for clocks, never "complies with".

Do not change the rule-pack schema without a human reviewer.
