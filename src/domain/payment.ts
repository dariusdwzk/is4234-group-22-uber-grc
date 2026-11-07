import type { Facts } from "./types";

// The 2016 payout: a payment request recorded on a case. It is held while the case is high
// risk, and nothing in the app releases it; the approvers see it before they decide.

/** Bug bounty programme limit per payout (US$10,000). */
export const BOUNTY_LIMIT_CENTS = 1_000_000;

/** "US$100,000" from integer cents. */
export const usd = (cents: number): string =>
  "US$" + Math.round(cents / 100).toLocaleString("en-US");

/** "US$100,000 to an unverified payee, above the US$10,000 limit", or null with no payment. */
export function heldPaymentText(f: Facts): string | null {
  if (f.paymentCents <= 0) return null;
  return (
    usd(f.paymentCents) +
    (f.payeeVerified ? "" : " to an unverified payee") +
    (f.paymentCents > BOUNTY_LIMIT_CENTS
      ? ", above the " + usd(BOUNTY_LIMIT_CENTS) + " limit"
      : "")
  );
}
