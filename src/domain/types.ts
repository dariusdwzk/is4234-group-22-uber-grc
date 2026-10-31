export type RoleKey =
  "employee" | "security" | "cso" | "gc" | "cpo" | "ceo" | "board";

/** PENDING: a staff report waiting for its triage rating. */
export type Severity = "LOW" | "HIGH" | "PENDING";

export type SignalOrigin = "system" | "manual";

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

/** Who acted. `name` is what the ledger records, e.g. "General Counsel" or "Anonymous employee". */
export type Actor = { role: RoleKey | null; name: string };

export const SYSTEM_ACTOR: Actor = { role: null, name: "System" };

/** Case facts come only from signals; no role can edit them. */
export type Facts = {
  dataAccessed: boolean;
  objects: number;
  records: string;
  licences: string;
  extortion: boolean;
  jurisdictions: string[];
  // From the staff report questionnaire (src/domain/questionnaire.ts).
  moneyConcern: boolean;
  harmConcern: boolean;
  handlingConcern: boolean;
  systemsDown: boolean;
  outsidersAware: boolean;
  ongoing: boolean;
};

export const defaultFacts = (): Facts => ({
  dataAccessed: false,
  objects: 0,
  records: "0",
  licences: "",
  extortion: false,
  jurisdictions: [],
  moneyConcern: false,
  harmConcern: false,
  handlingConcern: false,
  systemsDown: false,
  outsidersAware: false,
  ongoing: false,
});
