import { describe, expect, it } from "vitest";
import { BOUNTY_LIMIT_CENTS, heldPaymentText, usd } from "@/domain/payment";
import { defaultFacts } from "@/domain/types";

describe("held payment (the 2016 payout request)", () => {
  it("formats cents as whole US dollars", () => {
    expect(usd(10_000_000)).toBe("US$100,000");
    expect(usd(BOUNTY_LIMIT_CENTS)).toBe("US$10,000");
  });

  it("describes an unverified payout above the bounty limit", () => {
    const f = {
      ...defaultFacts(),
      paymentCents: 10_000_000,
      payeeVerified: false,
    };
    expect(heldPaymentText(f)).toBe(
      "US$100,000 to an unverified payee, above the US$10,000 limit",
    );
  });

  it("says nothing when no payment was requested", () => {
    expect(heldPaymentText(defaultFacts())).toBeNull();
  });

  it("leaves out what does not apply", () => {
    const f = { ...defaultFacts(), paymentCents: 300_000, payeeVerified: true };
    expect(heldPaymentText(f)).toBe("US$3,000");
  });
});
