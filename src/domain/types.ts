export type Role =
  "SA" | "CISO" | "GC" | "PCO" | "IA" | "ACC" | "EMP" | "EXEC" | "DEMO";

export type Tier = "LOW" | "HIGH";
export type CaseStatus = "open" | "auto_closed" | "closed";
export type Outcome = "notify_now" | "notify_later" | "withhold";

export type EventKind =
  | "bounty_report"
  | "payment_request"
  | "cloud_download_alert"
  | "manual_declaration"
  | "regulator_inquiry"
  | "blocked_login";

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export type Actor = { id: string; role: Role; displayName: string };

export const SYSTEM_ACTOR: Actor = {
  id: "system",
  role: "EXEC",
  displayName: "System",
};
