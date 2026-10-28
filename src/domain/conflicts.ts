import { RULE_PACK } from "./rules";
import type { Facts } from "./types";

export type Claims = { noData: boolean; verified: boolean; routine: boolean };

/** Each recommendation claim the system evidence contradicts (mockup: conflicts()). */
export function conflicts(
  claims: Claims,
  f: Facts,
  capCents: number = RULE_PACK.programMaxCents,
): string[] {
  const out: string[] = [];
  if (claims.noData && f.dataAccessed)
    out.push(
      "Says the data was deleted. Monitoring shows " +
        f.objects +
        " objects downloaded.",
    );
  if (claims.verified && f.paymentCents && !f.payeeVerified)
    out.push(
      "Says the reporter is verified. The payee on the payment request is not.",
    );
  if (claims.routine && f.paymentCents > capCents)
    out.push(
      "Says this is a routine bounty. The payout is " +
        (f.paymentCents / capCents).toFixed(0) +
        "× the cap.",
    );
  if (claims.routine && f.extortion)
    out.push("Says this is a routine bounty. The attacker demanded payment.");
  return out;
}
