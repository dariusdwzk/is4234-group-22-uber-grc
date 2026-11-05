import { isRoleKey } from "@/domain/roles";
import type { RoleKey } from "@/domain/types";
import type { CaseView, ReceiptTrack, ViewState } from "@/domain/view-state";

export type Msg = { kind: "high" | "warn" | "ok"; title: string; text: string };

/** Browser-only view state (tabs, messages, guide). Everything else comes from the server. */
export type UiState = {
  role: RoleKey | null;
  view: string;
  caseId: string | null;
  guided: boolean;
  /** demo: the 8-step guided tour. explore: the card explains whichever page is on screen. */
  mode: "demo" | "explore";
  /** The guided tour's current step; only moves forward (see guide.ts stepIdx). */
  guideStep: number;
  caseTab: "deadlines" | "log";
  boardTab: "overview" | "log";
  boardOpen: Record<string, boolean>;
  logFilter: string;
  logLow: boolean;
  seenReplay: boolean;
  statusMsg: string | null;
  /** The last receipt checked on the Employee page, and its case timeline. */
  receipt: { code: string; track: ReceiptTrack | null } | null;
  empMsg: string | null;
  lastBlock: { what: string; why: string } | null;
  scrolledKey: string | null;
  /** The case that was open when the user chose Switch account. */
  resumeCase: string | null;
};

export const emptyState = (): ViewState => ({
  role: null,
  demoMode: false,
  clockH: 0,
  regulatorOpen: true,
  replayId: null,
  emailAttached: false,
  cases: [],
  signals: [],
  notices: [],
  ledger: [],
  progress: {
    finding: false,
    recommended: false,
    csoBlocked: false,
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
  mode: "explore",
  guideStep: 0,
  caseTab: "deadlines",
  boardTab: "overview",
  boardOpen: {},
  logFilter: "all",
  logLow: false,
  seenReplay: false,
  statusMsg: null,
  receipt: null,
  empMsg: null,
  lastBlock: null,
  scrolledKey: null,
  resumeCase: null,
  d: emptyState(),
};

export const cur = (): CaseView | undefined =>
  S.d.cases.find((c) => c.id === S.caseId);
export const rep = (): CaseView | undefined =>
  S.d.cases.find((c) => c.id === S.d.replayId);

const ROLE_KEY = "ubersecure.role";
/** The signed-in role for this browser tab, if any. Storage can be blocked, so never throw. */
export function loadRole(): RoleKey | null {
  try {
    const r = sessionStorage.getItem(ROLE_KEY);
    return isRoleKey(r) ? r : null;
  } catch {
    return null;
  }
}
export function saveRole(r: RoleKey | null): void {
  try {
    if (r) sessionStorage.setItem(ROLE_KEY, r);
    else sessionStorage.removeItem(ROLE_KEY);
  } catch {
    /* storage blocked: the role just is not remembered */
  }
}
