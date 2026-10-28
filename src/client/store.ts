import type { RoleKey } from "@/domain/types";
import type { CaseView, ViewState } from "@/domain/view-state";

export type Msg = { kind: "high" | "warn" | "ok"; title: string; text: string };

/** Browser-only view state (tabs, messages, guide). Everything else comes from the server. */
export type UiState = {
  role: RoleKey | null;
  view: string;
  caseId: string | null;
  guided: boolean;
  menu: boolean;
  secTab: "cases" | "inbox";
  caseTab: "deadlines" | "log";
  boardTab: "overview" | "log";
  boardOpen: Record<string, boolean>;
  logFilter: string;
  logLow: boolean;
  showDeclare: boolean;
  seenReplay: boolean;
  statusMsg: string | null;
  empMsg: string | null;
  finMsg: Msg | null;
  lastBlock: { what: string; why: string } | null;
  scrolledKey: string | null;
};

export const emptyState = (): ViewState => ({
  role: null,
  demoMode: false,
  clockH: 0,
  regulatorOpen: true,
  replayId: null,
  jumped: false,
  emailAttached: false,
  cases: [],
  signals: [],
  payments: [],
  notices: [],
  ledger: [],
  progress: {
    finding: false,
    recommended: false,
    csoBlocked: false,
    jumped: false,
    financeBlocked: false,
    gcDone: false,
    cpoDone: false,
    allAcked: false,
  },
});

/** The mockup's S: UI state plus the latest server state in S.d. */
export const S: UiState & { d: ViewState } = {
  role: null,
  view: "landing",
  caseId: null,
  guided: false,
  menu: false,
  secTab: "cases",
  caseTab: "deadlines",
  boardTab: "overview",
  boardOpen: {},
  logFilter: "all",
  logLow: false,
  showDeclare: false,
  seenReplay: false,
  statusMsg: null,
  empMsg: null,
  finMsg: null,
  lastBlock: null,
  scrolledKey: null,
  d: emptyState(),
};

export const cur = (): CaseView | undefined =>
  S.d.cases.find((c) => c.id === S.caseId);
export const rep = (): CaseView | undefined =>
  S.d.cases.find((c) => c.id === S.d.replayId);
