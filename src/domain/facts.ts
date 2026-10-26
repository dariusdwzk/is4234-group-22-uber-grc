import { EVENT_PAYLOAD_SCHEMAS, type EventPayloads } from "./event-payloads";
import type { RulePack } from "./rule-pack";
import type { EventKind } from "./types";

export type CaseFacts = {
  personalDataAccessed: boolean;
  paymentLinkedToIncident: boolean;
  payeeVerified: boolean;
  amountCents: number;
  programmeMaxCents: number;
  extortionLanguage: boolean;
  regulatorInquiryOpen: boolean;
  legalDeadlineTriggered: boolean;
  openChallengeFlag: boolean;
};

type TypedEvent = {
  [K in EventKind]: { kind: K; payload: EventPayloads[K] };
}[EventKind];

function parseEvent(e: { kind: EventKind; payload: unknown }): TypedEvent {
  // Payloads are validated at ingest; a bad one here is a bug, so fail loudly.
  return {
    kind: e.kind,
    payload: EVENT_PAYLOAD_SCHEMAS[e.kind].parse(e.payload),
  } as TypedEvent;
}

export function deriveFacts(
  events: { kind: EventKind; payload: unknown }[],
  ctx: { pack: RulePack; openChallengeFlag: boolean },
): CaseFacts {
  const typed = events.map(parseEvent);
  const terms = ctx.pack.extortionTerms.map((t) => t.toLowerCase());
  const mentionsExtortion = (text: string) => {
    const lower = text.toLowerCase();
    return terms.some((t) => lower.includes(t));
  };

  let personalDataAccessed = false;
  let paymentLinkedToIncident = false;
  let payeeVerified = true;
  let amountCents = 0;
  let extortionLanguage = false;
  let regulatorInquiryOpen = false;
  let legalDeadlineTriggered = false;

  for (const e of typed) {
    switch (e.kind) {
      case "bounty_report":
        payeeVerified &&= e.payload.payeeVerified;
        amountCents = Math.max(amountCents, e.payload.amountCents);
        extortionLanguage ||= mentionsExtortion(e.payload.text);
        break;
      case "payment_request":
        payeeVerified &&= e.payload.payeeVerified;
        amountCents = Math.max(amountCents, e.payload.amountCents);
        // The label ("bug bounty") is deliberately ignored: F3.
        paymentLinkedToIncident ||= e.payload.linkedToIncident;
        break;
      case "cloud_download_alert":
        personalDataAccessed ||= e.payload.containsPersonalData;
        legalDeadlineTriggered ||=
          e.payload.containsPersonalData &&
          e.payload.affectedJurisdictions.length > 0;
        break;
      case "manual_declaration":
        extortionLanguage ||= mentionsExtortion(e.payload.description);
        break;
      case "regulator_inquiry":
        regulatorInquiryOpen ||= e.payload.open;
        break;
      case "blocked_login":
        break;
    }
  }

  return {
    personalDataAccessed,
    paymentLinkedToIncident,
    payeeVerified,
    amountCents,
    programmeMaxCents: ctx.pack.programmeMaxCents,
    extortionLanguage,
    regulatorInquiryOpen,
    legalDeadlineTriggered,
    openChallengeFlag: ctx.openChallengeFlag,
  };
}
