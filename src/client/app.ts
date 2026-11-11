// The mockup's render() and action map (A), with every state change sent to the server.
// The browser keeps only view state; rules, permissions and the ledger live on the server.
import { fileProblem } from "@/domain/evidence";
import { ESCALATED_STATUS } from "@/domain/gate";
import type { ReceiptTrack } from "@/domain/view-state";
import {
  QUESTIONNAIRE,
  type Answer,
  type Answers,
} from "@/domain/questionnaire";
import { ROLES, isRoleKey } from "@/domain/roles";
import { act, fetchState, type ApiResult } from "./api";
import { STEPS, atStep, endTour, stepIdx } from "./guide";
import { guideOrHelp } from "./help";
import { ck, clearToast, toast, val } from "./html";
import { S, cur, loadRole, saveRole } from "./store";
import { vBoard } from "./views/board";
import { vCase } from "./views/case/page";
import { vCeo } from "./views/ceo";
import { vApprovals } from "./views/decisions";
import { vEmployee } from "./views/employee";
import { vLanding } from "./views/landing";
import { vSecurity } from "./views/security";
import { vWork } from "./views/work";
import { shell } from "./views/shell";

let root: HTMLElement | null = null;
/** The action in flight, if any. Clicks during it are dropped (no double submits). */
let inFlight: Promise<void> | null = null;

const VIEWS: Record<string, () => string> = {
  landing: vLanding,
  employee: vEmployee,
  security: vSecurity,
  case: vCase,
  approvals: vApprovals,
  ceo: vCeo,
  board: vBoard,
  work: vWork,
};

function render(): void {
  if (!root) return;
  const guided = S.guided && S.view !== "landing";
  const page = (VIEWS[S.view] ?? vLanding)();
  root.innerHTML =
    (S.view === "landing"
      ? '<main class="landing">' + page + "</main>"
      : shell(page)) + (guided ? guideOrHelp() : "");
  if (!guided || S.mode !== "demo") return; // only the guided tour highlights the page
  const i = stepIdx();
  if (i === -1) return;
  const s = STEPS[i]!;
  if (!atStep(s) || !s.target) return;
  const sel = s.target(),
    el =
      root.querySelector("main " + sel) ||
      root.querySelector("nav.side " + sel);
  if (!el) return;
  el.classList.add("pulse");
  const key = i + sel,
    card = root.querySelector(".guidecard"),
    main = root.querySelector("main") as HTMLElement | null;
  // Room to lift a target near the bottom above the fixed card.
  if (card && main)
    main.style.paddingBottom =
      Math.max(220, (card as HTMLElement).offsetHeight + 32) + "px";
  const first = S.scrolledKey !== key;
  // A target in a sticky column (case action panel, sidebar) barely moves when the page
  // scrolls: lift it once, never again on later renders, so the page does not keep jumping.
  let sticky = false;
  for (let e: Element | null = el; e && !sticky; e = e.parentElement)
    sticky = getComputedStyle(e).position === "sticky";
  if (sticky && !first) return;
  if (first) {
    S.scrolledKey = key;
    if (!sticky)
      el.scrollIntoView({
        block: "center",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  }
  // Measure the real rects once scrolling has settled; lift the target clear of the card.
  const lift = () => {
    const r = el.getBoundingClientRect(),
      c = card?.getBoundingClientRect();
    if (
      c &&
      r.right > c.left &&
      r.left < c.right &&
      r.bottom > c.top &&
      r.top < c.bottom
    )
      window.scrollBy({ top: r.bottom - c.top + 16, behavior: "auto" });
  };
  requestAnimationFrame(() => requestAnimationFrame(lift));
  if (first && !sticky) setTimeout(lift, 600); // smooth scroll may still be running
}

async function refresh(): Promise<void> {
  S.d = await fetchState(S.role);
}

const clearMsgs = () => {
  S.empMsg = null;
  S.statusMsg = null;
  S.receipt = null;
};

/**
 * Switches role. With `keepCase`, a case page stays open when the new role may see that
 * case (the server decides what each role sees); otherwise the role's home page opens.
 */
async function setRole(
  r: string | undefined,
  opts: { keepCase?: boolean } = {},
): Promise<void> {
  const onCase = opts.keepCase === true ? S.resumeCase : null;
  if (opts.keepCase) S.resumeCase = null; // Switch account keeps it for the next sign-in
  S.role = isRoleKey(r) ? r : null;
  saveRole(S.role);
  clearMsgs();
  clearToast();
  await refresh();
  const stay = !!onCase && S.d.cases.some((c) => c.id === onCase);
  if (stay) S.caseId = onCase;
  S.view = stay ? "case" : S.role ? ROLES[S.role].home : "landing";
  render();
  if (!stay) window.scrollTo(0, 0);
}

function openCase(x: string | undefined): void {
  S.view = "case";
  S.caseId = x ?? null;
  if (x === S.d.replayId) S.seenReplay = true;
  S.caseTab = "deadlines";
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
  role: (x) => setRole(x, { keepCase: true }),
  go: (x) => {
    S.view = x ?? "landing";
    render();
    window.scrollTo(0, 0);
  },
  switchAccount: () => {
    S.resumeCase = S.view === "case" ? S.caseId : null;
    return setRole(undefined);
  },
  home: () => {
    S.view = S.role ? ROLES[S.role].home : "landing";
    render();
  },
  openCase: (x) => openCase(x),
  // The tour always starts from fresh data: reset first (it then opens Security, step 1).
  startGuide: () => {
    S.guided = true;
    S.mode = "demo";
    S.guideStep = 0;
    return S.d.demoMode ? A.reset!() : setRole("security");
  },
  goStep: async () => {
    const s = STEPS[stepIdx()];
    if (!s || !s.role) return;
    S.role = s.role;
    saveRole(S.role);
    clearMsgs();
    await refresh();
    if (s.onCase) openCase(S.d.replayId ?? undefined);
    else {
      S.view = s.view!;
      render();
      window.scrollTo(0, 0);
    }
  },
  caseTab: (x) => {
    S.caseTab = x === "log" ? "log" : "deadlines";
    render();
  },
  attach: async () => {
    const r = await send("attach", { caseId: S.caseId, text: val("aTxt") });
    if (!r.ok) return fail(r);
    render();
    toast("Email attached. R5 fired: extortion demand.");
  },
  rec: async () => {
    const action = document.querySelector<HTMLInputElement>(
      'input[name="rAct"]:checked',
    )?.value;
    const reason = val("rReason");
    if (!action) {
      toast("Choose a recommendation.");
      return;
    }
    if (action === "escalate" && !reason) {
      toast("Give a reason for escalating internally.");
      return;
    }
    const r = await send("recommend", { caseId: S.caseId, action, reason });
    if (!r.ok) return fail(r);
    render();
    toast("Sent to the General Counsel and the Chief Privacy Officer.");
  },
  /** Independent path: the GC or CPO recommends, and the other one decides. */
  irec: async () => {
    const action = val("iAct"),
      reason = val("iReason");
    if (action === "escalate" && !reason) {
      toast("Give a reason for escalating internally.");
      return;
    }
    const r = await send("recommend", { caseId: S.caseId, action, reason });
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
      toast("Rejected. Disclosure required.");
    else if (c?.status === "Disclosed") toast("Disclosure approved.");
    else if (c?.status === ESCALATED_STATUS)
      toast("Both approved: escalated internally. The board has been told.");
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
  boardTab: (x) => {
    S.boardTab = x === "log" ? "log" : "overview";
    S.view = "board";
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
    // The confirmation sits next to the Send button; bring it into view.
    document.querySelector(".alert.ok")?.scrollIntoView({ block: "center" });
    toast(S.empMsg);
  },
  status: async () => {
    const code = val("sCode").toUpperCase();
    const r = await send<{ message: string; track: ReceiptTrack | null }>(
      "receipt",
      { code },
    );
    if (!r.ok) return fail(r);
    S.statusMsg = r.data.message;
    S.receipt = { code, track: r.data.track };
    render();
  },
  showGuide: () => {
    if (S.view === "landing") return A.startGuide!();
    S.guided = true;
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
  skipStep: () => {
    const i = stepIdx();
    if (i === -1) return;
    S.guideStep = i + 1;
    S.scrolledKey = null;
    render();
  },
  hideGuide: () => {
    endTour();
    render();
  },
  reset: async () => {
    const g = S.guided && S.mode === "demo";
    const r = await act(S.role, "reset");
    if (!r.ok) return fail(r);
    Object.assign(S, {
      role: g ? "security" : null,
      view: g ? ROLES.security.home : "landing",
      caseId: null,
      caseTab: "deadlines",
      boardTab: "overview",
      boardOpen: {},
      logFilter: "all",
      logLow: false,
      seenReplay: false,
      scrolledKey: null,
      guideStep: 0,
    });
    saveRole(S.role);
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

async function run(name: string, x: string | undefined): Promise<void> {
  const f = A[name];
  if (!f || inFlight) return;
  const p = (async () => {
    try {
      await f(x);
    } catch {
      toast("Could not reach the server. Is it running?");
    }
  })();
  inFlight = p;
  root?.setAttribute("aria-busy", "true");
  await p;
  if (inFlight === p) {
    inFlight = null;
    root?.removeAttribute("aria-busy");
  }
}

function onClick(e: MouseEvent): void {
  const target = e.target as Element | null;
  const b = target?.closest<HTMLElement>("[data-a]");
  if (!b) return;
  void run(b.dataset.a!, b.dataset.x);
}

/** Mounts the app into `el` and returns a cleanup for React's effect. */
export function mount(el: HTMLElement): () => void {
  root = el;
  document.addEventListener("click", onClick);
  S.role = loadRole();
  S.view = S.role ? ROLES[S.role].home : "landing";
  // a restored role waits for its data, so My work never flashes empty
  if (!S.role) render();
  else
    el.innerHTML =
      '<main class="boot" role="status">Loading your workspace…</main>';
  refresh()
    .then(render)
    .catch(() => {
      render();
      toast("Could not reach the server. Is it running?");
    });
  return () => {
    document.removeEventListener("click", onClick);
    root = null;
  };
}
