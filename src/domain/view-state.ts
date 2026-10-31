import type { Clock } from "./clocks";
import type { Answers, Route } from "./questionnaire";
import type { Approver, DecisionStatus, RecAction, Vote } from "./gate";
import type { LedgerView } from "./plain-event";
import type { RuleResult } from "./rules";
import type { Facts, RoleKey, Severity, SignalOrigin } from "./types";

// What GET /api/state returns: everything the current role may see, already filtered on
// the server. Shapes follow the mockup's in-memory state (S.cases, S.notices, ...).

export type SignalView = {
  id: string;
  src: string;
  origin: SignalOrigin;
  h: number;
  title: string;
  caseId: string | null;
};

export type CaseView = {
  id: string;
  title: string;
  detectedH: number;
  severity: Severity;
  status: string;
  facts: Facts;
  signals: string[];
  rules: RuleResult[];
  clocks: Clock[];
  finding: string | null;
  disclosedH: number | null;
  rec: {
    author: RoleKey;
    act: RecAction;
    reason: string | null;
    t: number;
  } | null;
  decision: {
    type: string;
    need: number;
    disclose: boolean;
    status: DecisionStatus;
    votes: Partial<Record<Approver, { vote: Vote; reason: string; t: number }>>;
  } | null;
  route: Route;
  /** Staff reports: hour the triage rating is due (else HIGH automatically). */
  triageDueH: number | null;
  /** LOW staff reports: hour Security's review is due. */
  reviewDueH: number | null;
  answers: Answers | null;
  evidence: EvidenceView[];
};

/** File bytes never travel in the state; they download from GET /api/evidence/:id. */
export type EvidenceView = {
  id: number;
  author: RoleKey;
  note: string;
  file: { name: string; type: string; size: number; sha256: string } | null;
  t: number;
};

export type NoticeView = {
  id: string;
  caseId: string;
  tier: 1 | 2;
  kind: string;
  body: string;
  t: number;
  ack: number | null;
  allDirs: boolean;
};

/** Guided-tour progress, computed on the server so it works whichever role is viewing. */
export type Progress = {
  finding: boolean;
  recommended: boolean;
  csoBlocked: boolean;
  gcDone: boolean;
  cpoDone: boolean;
  allAcked: boolean;
};

export type ViewState = {
  role: RoleKey | null;
  demoMode: boolean;
  clockH: number;
  regulatorOpen: boolean;
  /** The Day 0 case (mockup: S.replayId). */
  replayId: string | null;
  emailAttached: boolean;
  cases: CaseView[];
  signals: SignalView[];
  notices: NoticeView[];
  /** Board: the whole ledger. Case viewers: entries on cases they can see. */
  ledger: LedgerView[];
  progress: Progress;
};

/**
 * What an employee sees for their own report, by receipt code: just enough to draw the
 * case timeline. No findings, reasons, evidence, rules or other cases.
 */
export type ReceiptTrack = {
  case: CaseView;
  notices: NoticeView[];
  ledger: LedgerView[];
};
