import { describe, expect, it } from "vitest";
import { deriveFacts } from "@/domain/facts";
import { loadRulePack } from "@/domain/rule-pack";
import { evaluate } from "@/domain/rules";
import type { EventKind } from "@/domain/types";

const pack = loadRulePack("v1");
const ctx = { pack, openChallengeFlag: false };

type Ev = { kind: EventKind; payload: unknown };
const bounty = (o: Record<string, unknown> = {}): Ev => ({
  kind: "bounty_report",
  payload: {
    reporterHandle: "h",
    amountCents: 500_000,
    payeeVerified: true,
    label: "bug bounty",
    text: "found an issue",
    ...o,
  },
});
const payment = (o: Record<string, unknown> = {}): Ev => ({
  kind: "payment_request",
  payload: {
    amountCents: 500_000,
    payee: "p",
    payeeVerified: true,
    label: "bug bounty",
    linkedToIncident: false,
    ...o,
  },
});
const cloud = (o: Record<string, unknown> = {}): Ev => ({
  kind: "cloud_download_alert",
  payload: {
    resource: "bucket",
    records: 10,
    containsPersonalData: false,
    affectedJurisdictions: [],
    ...o,
  },
});

describe("deriveFacts", () => {
  it("no events → quiet facts with the pack's programme maximum", () => {
    expect(deriveFacts([], ctx)).toEqual({
      personalDataAccessed: false,
      paymentLinkedToIncident: false,
      payeeVerified: true,
      amountCents: 0,
      programmeMaxCents: pack.programmeMaxCents,
      extortionLanguage: false,
      regulatorInquiryOpen: false,
      legalDeadlineTriggered: false,
      openChallengeFlag: false,
    });
  });

  it("US-07: paymentLinkedToIncident ignores the label", () => {
    for (const label of ["bug bounty", "consulting", ""]) {
      expect(
        deriveFacts([payment({ label, linkedToIncident: true })], ctx)
          .paymentLinkedToIncident,
      ).toBe(true);
    }
    expect(
      deriveFacts([payment({ label: "incident payment" })], ctx)
        .paymentLinkedToIncident,
    ).toBe(false);
  });

  it("payeeVerified is false if any payment or bounty is unverified", () => {
    expect(
      deriveFacts([bounty(), payment({ payeeVerified: false })], ctx)
        .payeeVerified,
    ).toBe(false);
    expect(
      deriveFacts([bounty({ payeeVerified: false }), payment()], ctx)
        .payeeVerified,
    ).toBe(false);
    expect(deriveFacts([bounty(), payment()], ctx).payeeVerified).toBe(true);
  });

  it("amountCents is the max over payments and bounties", () => {
    expect(
      deriveFacts(
        [bounty({ amountCents: 100 }), payment({ amountCents: 900 })],
        ctx,
      ).amountCents,
    ).toBe(900);
  });

  it("extortionLanguage matches terms case-insensitively in bounty text and declarations", () => {
    expect(
      deriveFacts([bounty({ text: "We WILL RELEASE the data" })], ctx)
        .extortionLanguage,
    ).toBe(true);
    expect(
      deriveFacts(
        [
          {
            kind: "manual_declaration",
            payload: { description: "they said: Pay Us" },
          },
        ],
        ctx,
      ).extortionLanguage,
    ).toBe(true);
    expect(deriveFacts([bounty()], ctx).extortionLanguage).toBe(false);
  });

  it("legalDeadlineTriggered needs personal data and at least one jurisdiction", () => {
    expect(
      deriveFacts(
        [cloud({ containsPersonalData: true, affectedJurisdictions: ["EU"] })],
        ctx,
      ),
    ).toMatchObject({
      personalDataAccessed: true,
      legalDeadlineTriggered: true,
    });
    expect(
      deriveFacts([cloud({ containsPersonalData: true })], ctx),
    ).toMatchObject({
      personalDataAccessed: true,
      legalDeadlineTriggered: false,
    });
    expect(
      deriveFacts([cloud({ affectedJurisdictions: ["EU"] })], ctx)
        .legalDeadlineTriggered,
    ).toBe(false);
  });

  it("regulatorInquiryOpen only for an open inquiry; challenge flag comes from context", () => {
    const inquiry = (open: boolean): Ev => ({
      kind: "regulator_inquiry",
      payload: { regulator: "r", open },
    });
    expect(deriveFacts([inquiry(false)], ctx).regulatorInquiryOpen).toBe(false);
    expect(
      deriveFacts([inquiry(false), inquiry(true)], ctx).regulatorInquiryOpen,
    ).toBe(true);
    expect(
      deriveFacts([], { pack, openChallengeFlag: true }).openChallengeFlag,
    ).toBe(true);
  });

  it("US-06: a blocked login alone evaluates LOW", () => {
    const facts = deriveFacts(
      [{ kind: "blocked_login", payload: { account: "a" } }],
      ctx,
    );
    expect(evaluate(pack, facts)).toEqual({ tier: "LOW", firedRuleIds: [] });
  });

  it("US-08: Nov 2016 replay events evaluate HIGH with the five expected rules", () => {
    const facts = deriveFacts(
      [
        cloud({ containsPersonalData: true, affectedJurisdictions: [] }),
        bounty({
          amountCents: 10_000_000,
          payeeVerified: false,
          text: "pay us or we will release it",
        }),
        payment({
          amountCents: 10_000_000,
          payeeVerified: false,
          linkedToIncident: true,
        }),
      ],
      ctx,
    );
    expect(evaluate(pack, facts).firedRuleIds).toEqual([
      "R-PII",
      "R-PAY-LINKED",
      "R-PAYEE",
      "R-CAP",
      "R-EXTORT",
    ]);
  });

  it("rejects a malformed payload instead of guessing", () => {
    expect(() =>
      deriveFacts(
        [{ kind: "regulator_inquiry", payload: { regulator: "r" } }],
        ctx,
      ),
    ).toThrow();
    expect(() => deriveFacts([bounty({ amountCents: 1.5 })], ctx)).toThrow();
  });
});
