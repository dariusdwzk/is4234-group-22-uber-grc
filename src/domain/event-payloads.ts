import { z } from "zod";
import type { EventKind } from "./types";

const cents = z.number().int().min(0);

const schemas = {
  bounty_report: z.strictObject({
    reporterHandle: z.string(),
    amountCents: cents,
    payeeVerified: z.boolean(),
    label: z.string(),
    text: z.string(),
  }),
  payment_request: z.strictObject({
    amountCents: cents,
    payee: z.string(),
    payeeVerified: z.boolean(),
    label: z.string(),
    linkedToIncident: z.boolean(),
  }),
  cloud_download_alert: z.strictObject({
    resource: z.string(),
    records: cents,
    containsPersonalData: z.boolean(),
    affectedJurisdictions: z.array(z.string()),
  }),
  manual_declaration: z.strictObject({
    description: z.string().min(1).max(2000),
    relatedReference: z.string().optional(),
  }),
  regulator_inquiry: z.strictObject({
    regulator: z.string(),
    open: z.boolean(),
  }),
  blocked_login: z.strictObject({
    account: z.string(),
  }),
} satisfies Record<EventKind, z.ZodType>;

export const EVENT_PAYLOAD_SCHEMAS: Record<EventKind, z.ZodType> = schemas;
export type EventPayloads = { [K in EventKind]: z.infer<(typeof schemas)[K]> };
