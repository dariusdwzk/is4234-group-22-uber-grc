// The mockup's render() and action map (A), with every state change sent to the server.
// The browser keeps only view state; rules, permissions and the ledger live on the server.
import { ATTEMPT_LABELS, type Attempt } from "@/domain/blocked-reasons";
import { fileProblem } from "@/domain/evidence";
import {
  QUESTIONNAIRE,
  type Answer,
  type Answers,
} from "@/domain/questionnaire";
import { ROLES, isRoleKey } from "@/domain/roles";
import { act, fetchState, type ApiResult } from "./api";
import { STEPS, atStep, guideCard, stepIdx } from "./guide";
import { ck, toast, val } from "./html";
import { S, cur } from "./store";
import { vBoard } from "./views/board";
import { vCase } from "./views/case/page";
import { vCeo } from "./views/ceo";
import { vApprovals } from "./views/decisions";
import { vEmployee } from "./views/employee";
import { vFinance } from "./views/finance";
import { header } from "./views/header";
import { vLanding } from "./views/landing";
import { vSecurity } from "./views/security";

let root: HTMLElement | null = null;
/** The action in flight, if any. Clicks during it are dropped (no double submits). */
let inFlight: Promise<void> | null = null;

const VIEWS: Record<string, () => string> = {
  landing: vLanding,
  employee: vEmployee,
  security: vSecurity,
  finance: vFinance,
  case: vCase,
  approvals: vApprovals,
  ceo: vCeo,
  board: vBoard,
};

function render(): void {
  if (!root) return;
  const guided = S.guided && S.view !== "landing";
  root.innerHTML =
    header() +
    '<main class="' +
    (guided ? "guided" : "") +
    '">' +
    (VIEWS[S.view] ?? vLanding)() +
    "</main>" +
    (guided
      ? guideCard()
      : '<button class="guide-fab" data-a="showGuide"><span>?</span>' +
        (S.view === "landing" ? "Start guide" : "Show guide") +
        "</button>");
  if (!guided) return;
  const i = stepIdx();
  if (i === -1) return;
  const s = STEPS[i]!;
  if (s.jump || !atStep(s) || !s.target) return;
  const sel = s.target(),
    el =
      root.querySelector("main " + sel) || root.querySelector("header " + sel);
  if (!el) return;
  el.classList.add("pulse");
  const key = i + sel;
  if (S.scrolledKey !== key) {
    S.scrolledKey = key;
    el.scrollIntoView({
      block: "center",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }
}

async function refresh(): Promise<void> {
  S.d = await fetchState(S.role);
}

const clearMsgs = () => {
  S.lastBlock = null;
  S.empMsg = null;
  S.statusMsg = null;
  S.finMsg = null;
};

async function setRole(r: string | undefined): Promise<void> {
  S.role = isRoleKey(r) ? r : null;
  S.view = S.role ? ROLES[S.role].home : "landing";
  clearMsgs();
  S.showDeclare = false;
  S.menu = false;
  await refresh();
  render();
  window.scrollTo(0, 0);
}

function openCase(x: string | undefined): void {
  S.view = "case";
  S.caseId = x ?? null;
  if (x === S.d.replayId) S.seenReplay = true;
  S.caseTab = "deadlines";
  S.lastBlock = null;
  S.menu = false;
  render();
  window.scrollTo(0, 0);
}

/** Sends an action as the current role, then reloads state. Unhandled refusals become a toast. */
async function send<T>(
  name: string,
  body: unknown = {},
): Promise<ApiResult<T>> {
  const r = await act<T>(S.role, name, body);
  await refresh();
  return r;
}
const fail = (r: { ok: false; error: string }) => {
  render();
  toast(r.error);
};

const A: Record<string, (x?: string) => void | Promise<void>> = {
  role: (x) => setRole(x),
  home: () => {
    S.view = S.role ? ROLES[S.role].home : "landing";
    S.lastBlock = null;
    render();
  },
  landing: () => setRole(undefined),
  openCase: (x) => openCase(x),
  startGuide: () => {
    S.guided = true;
    S.secTab = "cases";
    return setRole("security");
  },
  goStep: async () => {
    const s = STEPS[stepIdx()];
    if (!s || s.jump || !s.role) return;
    S.role = s.role;
    clearMsgs();
    S.menu = false;
    await refresh();
    if (s.onCase) openCase(S.d.replayId ?? undefined);
    else {
      S.view = s.view!;
      S.secTab = "cases";
      render();
      window.scrollTo(0, 0);
    }
  },
  guide: () => {
    S.guided = !S.guided;
    S.menu = false;
    render();
  },
  menu: () => {
    S.menu = !S.menu;
    render();
  },
  clock: async (x) => {
    S.menu = false;
    const r = await send("clock", { hours: Number(x) });
    if (!r.ok) return fail(r);
    render();
    toast("Moved forward " + x + " hours.");
  },
  jump: async () => {
    if (S.d.jumped) {
      toast("The payment request has already arrived.");
      return;
    }
    S.menu = false;
    const r = await send<{ caseId: string }>("jump");
    if (!r.ok) return fail(r);
    render();
    toast(
      "Day 24: report and payment request merged into " +
        r.data.caseId +
        ". Payment held.",
    );
  },
  secTab: (x) => {
    S.secTab = x === "inbox" ? "inbox" : "cases";
    render();
  },
  caseTab: (x) => {
    S.caseTab = x === "log" ? "log" : "deadlines";
    render();
  },
  showDeclare: () => {
    S.showDeclare = !S.showDeclare;
    render();
  },
  declare: async () => {
    const text = val("dTxt");
    if (!text) {
      toast("Describe what happened first.");
      return;
    }
    const r = await send<{ caseId: string }>("declare", { text });
    if (!r.ok) return fail(r);
    S.showDeclare = false;
    openCase(r.data.caseId);
  },
  attach: async () => {
    const r = await send("attach", { caseId: S.caseId, text: val("aTxt") });
    if (!r.ok) return fail(r);
    render();
    toast("Email attached. R5 fired: payment demand.");
  },
  rec: async () => {
    const r = await send("recommend", {
      caseId: S.caseId,
      action: val("rAct"),
      claims: { noData: ck("rC1"), verified: ck("rC2"), routine: ck("rC3") },
    });
    if (!r.ok) return fail(r);
    render();
    toast("Sent to the General Counsel and the Chief Privacy Officer.");
  },
  /** Independent path: the GC or CPO recommends, and the other one decides. */
  irec: async () => {
    const r = await send("recommend", {
      caseId: S.caseId,
      action: val("iAct"),
      claims: { noData: false, verified: false, routine: false },
      reason: val("iReason"),
    });
    if (!r.ok) return fail(r);
    render();
    const other = ROLES[S.role === "gc" ? "cpo" : "gc"].name;
    toast("Sent to the " + other + ".");
  },
  evidence: async () => {
    const note = val("evNote");
    if (!note) {
      toast("Describe the evidence first.");
      return;
    }
    const input = document.getElementById("evFile") as HTMLInputElement | null;
    const f = input?.files?.[0];
    let file: { name: string; type: string; base64: string } | undefined;
    if (f) {
      const problem = fileProblem({ name: f.name, type: f.type, size: f.size });
      if (problem) {
        toast(problem);
        return;
      }
      file = { name: f.name, type: f.type, base64: await toBase64(f) };
    }
    const r = await send("evidence", {
      caseId: S.caseId,
      note,
      ...(file ? { file } : {}),
    });
    if (!r.ok) return fail(r);
    render();
    toast(file ? "Evidence and file added." : "Evidence added.");
  },
  download: async (x) => {
    // A plain link cannot send X-Role, so fetch the file and hand it to the browser.
    const res = await fetch("/api/evidence/" + x, {
      headers: S.role ? { "x-role": S.role } : {},
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast(j.error ?? "Could not download the file.");
      return;
    }
    const name =
      /filename="([^"]+)"/.exec(
        res.headers.get("content-disposition") ?? "",
      )?.[1] ?? "evidence";
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  },
  blocked: async (x) => {
    const what = ATTEMPT_LABELS[x as Attempt];
    const r = await send("attempt", { caseId: S.caseId, action: x });
    if (r.ok || r.status !== 403) return r.ok ? render() : fail(r);
    S.lastBlock = { what, why: r.error };
    render();
    window.scrollTo({ top: 0 });
  },
  release: async (x) => {
    const r = await send("release", { paymentId: x });
    if (r.ok)
      S.finMsg = {
        kind: "warn",
        title: "Payment released",
        text: "Both approvers signed, so the hold lifted. The board already holds the notices and the approvals are in the log.",
      };
    else if (r.status === 403)
      S.finMsg = {
        kind: "high",
        title: "Payment held",
        text: r.error + " This attempt is now in the log.",
      };
    else return fail(r);
    render();
  },
  vote: async (x) => {
    if (!ck("v1")) {
      toast("Tick the checkbox first.");
      document.getElementById("v1")?.closest("label")?.classList.add("pulse");
      return;
    }
    const r = await send("vote", {
      caseId: S.caseId,
      vote: x,
      reason: val("vReason"),
      checklist: true,
    });
    if (!r.ok) return fail(r);
    render();
    const c = cur();
    if (c?.status === "Disclosure required")
      toast("Rejected. Payment cancelled. Disclosure required.");
    else if (c?.status === "Disclosed") toast("Disclosure approved.");
    else if (c?.status === "Disclosure limited")
      toast("Both approved. The decision is permanently on record.");
    else
      toast(
        "Approved. Waiting for " +
          ROLES[S.role === "gc" ? "cpo" : "gc"].name +
          ".",
      );
  },
  finding: async () => {
    // Triage: Security also records the facts it established (the CPO still rates).
    const facts = document.getElementById("tData")
      ? {
          dataAccessed: ck("tData"),
          moneyConcern: ck("tMoney"),
          harmConcern: ck("tHarm"),
        }
      : undefined;
    const r = await send("finding", {
      caseId: S.caseId,
      text: val("fTxt"),
      ...(facts ? { facts } : {}),
    });
    if (!r.ok) return fail(r);
    render();
    toast("Finding added to the case.");
  },
  triage: async () => {
    const reason = val("tReason");
    if (!reason) {
      toast("Give a reason for the rating.");
      return;
    }
    const rating = val("tRating");
    const r = await send("triage", { caseId: S.caseId, rating, reason });
    if (!r.ok) return fail(r);
    render();
    toast(
      rating === "HIGH"
        ? "Rated HIGH. The board has been told."
        : "Rated LOW. Security reviews it within 3 business days.",
    );
  },
  /** Security's "Confirm rating" button: always refused on the server, and logged. */
  triageTry: async () => {
    const r = await send("triage", {
      caseId: S.caseId,
      rating: "LOW",
      reason: "Rated by Security",
    });
    if (r.ok || r.status !== 403) return r.ok ? render() : fail(r);
    S.lastBlock = { what: "Confirm rating", why: r.error };
    render();
    window.scrollTo({ top: 0 });
  },
  boardTab: (x) => {
    S.boardTab = x === "log" ? "log" : "overview";
    render();
  },
  discl: async () => {
    const r = await send("disclose", { caseId: S.caseId });
    if (!r.ok) return fail(r);
    render();
    toast("Disclosure approved.");
  },
  ack: async (x) => {
    if (S.role !== "board") {
      toast("Only the Audit Committee Chair can acknowledge.");
      return;
    }
    const r = await send("ack", { noticeId: x });
    if (!r.ok) return fail(r);
    render();
  },
  report: async () => {
    const text = val("eTxt");
    if (!text) {
      toast("Describe what happened first.");
      return;
    }
    const answers = readAnswers();
    if (!answers) {
      toast("Answer every question: Yes, No or Not sure.");
      return;
    }
    const r = await send<{ code: string }>("report", {
      text,
      anonymous: ck("eAnon"),
      answers,
    });
    if (!r.ok) return fail(r);
    S.empMsg = "Report sent. Receipt code: " + r.data.code;
    render();
  },
  challenge: async () => {
    const r = await send<{ code: string; caseId: string }>("challenge", {
      caseId: val("cRef"),
      text: val("cTxt"),
      anonymous: ck("cAnon"),
    });
    if (!r.ok) return fail(r);
    S.empMsg =
      "Challenge sent on " +
      r.data.caseId +
      ". Receipt code: " +
      r.data.code +
      ". If unresolved for 24 hours, the board is told.";
    render();
  },
  status: async () => {
    const r = await send<{ message: string }>("receipt", {
      code: val("sCode"),
    });
    if (!r.ok) return fail(r);
    S.statusMsg = r.data.message;
    render();
  },
  showGuide: () => {
    if (S.view === "landing") return A.startGuide!();
    S.guided = true;
    S.menu = false;
    S.scrolledKey = null;
    render();
  },
  logFilter: (x) => {
    S.logFilter = x ?? "all";
    render();
  },
  logLow: () => {
    S.logLow = !S.logLow;
    render();
  },
  expand: (x) => {
    if (!x) return;
    S.boardOpen[x] = !S.boardOpen[x];
    render();
  },
  hideGuide: () => {
    S.guided = false;
    render();
  },
  reset: async () => {
    const g = S.guided;
    S.menu = false;
    const r = await act(S.role, "reset");
    if (!r.ok) return fail(r);
    Object.assign(S, {
      role: g ? "security" : null,
      view: g ? "security" : "landing",
      caseId: null,
      secTab: "cases",
      caseTab: "deadlines",
      boardTab: "overview",
      boardOpen: {},
      logFilter: "all",
      logLow: false,
      showDeclare: false,
      seenReplay: false,
      scrolledKey: null,
    });
    clearMsgs();
    await refresh();
    render();
    window.scrollTo(0, 0);
    toast("Demo reset.");
  },
};

/** A file's bytes as base64, for the JSON request body. */
async function toBase64(f: File): Promise<string> {
  const bytes = new Uint8Array(await f.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Every question's chosen answer, or null if any is unanswered. */
function readAnswers(): Answers | null {
  const out: Partial<Answers> = {};
  for (const q of QUESTIONNAIRE.questions) {
    const el = document.querySelector<HTMLInputElement>(
      'input[name="q-' + q.id + '"]:checked',
    );
    if (!el) return null;
    out[q.id] = el.value as Answer;
  }
  return out as Answers;
}

async function run(
  name: string,
  x: string | undefined,
  queue = false,
): Promise<void> {
  const f = A[name];
  if (!f) return;
  if (inFlight) {
    if (!queue) return;
    await inFlight; // a role change must never be lost: wait, then switch
  }
  const p = (async () => {
    try {
      await f(x);
    } catch {
      toast("Could not reach the server. Is it running?");
    }
  })();
  inFlight = p;
  await p;
  if (inFlight === p) inFlight = null;
}

function onClick(e: MouseEvent): void {
  const target = e.target as Element | null;
  const b = target?.closest<HTMLElement>("[data-a]");
  if (!b) {
    if (S.menu && !target?.closest(".menu")) {
      S.menu = false;
      render();
    }
    return;
  }
  void run(b.dataset.a!, b.dataset.x);
}

function onChange(e: Event): void {
  const t = e.target as HTMLSelectElement | null;
  if (t?.id === "roleSel") void run("role", t.value, true);
}

/** Mounts the app into `el` and returns a cleanup for React's effect. */
export function mount(el: HTMLElement): () => void {
  root = el;
  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  render();
  refresh()
    .then(render)
    .catch(() => toast("Could not reach the server. Is it running?"));
  return () => {
    document.removeEventListener("click", onClick);
    document.removeEventListener("change", onChange);
    root = null;
  };
}
