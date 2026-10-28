// Ported from the mockup's vBoard() and logBody().
import { DAY0_ISO, dayOf, fmtT } from "@/domain/demo-time";
import { knownScale } from "@/domain/board-text";
import { ESCALATED_STATUS } from "@/domain/gate";
import { CATS, plainEvent, type EventCat } from "@/domain/plain-event";
import { CHK, esc } from "../html";
import { S, rep } from "../store";
import { discStatus, noticeRow, remText } from "./components";
import { miniTrack, waitingOn } from "./case/timeline";

const BASE = Date.parse(DAY0_ISO);
const at = (h: number) => new Date(BASE + h * 3_600_000);

function logBody(): string {
  const f = S.logFilter || "all",
    showLow = S.logLow;
  const serious = new Set(
    S.d.cases.filter((c) => c.severity === "HIGH").map((c) => c.id),
  );
  let ev = S.d.ledger
    .map((e) => ({ e, p: plainEvent(e) }))
    .filter(
      (x): x is { e: (typeof x)["e"]; p: NonNullable<(typeof x)["p"]> } =>
        !!x.p &&
        (showLow || !x.e.caseId || serious.has(x.e.caseId)) &&
        (showLow || x.e.t >= 0),
    );
  const count = (c: EventCat) => ev.filter((x) => x.p.cat === c).length;
  const counts: Record<string, number> = {
    all: ev.length,
    blocked: count("blocked"),
    decision: count("decision"),
    notice: count("notice"),
    money: count("money"),
  };
  if (f !== "all") ev = ev.filter((x) => x.p.cat === f);
  const dkey = (h: number) => at(h).toISOString().slice(0, 10);
  const days: Record<string, typeof ev> = {};
  ev.forEach((x) => {
    const k = dkey(x.e.t);
    (days[k] = days[k] || []).push(x);
  });
  const hm = (h: number) =>
    at(h).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  const chip = (k: string, l: string) =>
    '<button class="fchip ' +
    (f === k ? "on" : "") +
    '" data-a="logFilter" data-x="' +
    k +
    '">' +
    l +
    " <span>" +
    counts[k] +
    "</span></button>";
  let o = "";
  o +=
    '<div class="fchips">' +
    chip("all", "All") +
    chip("decision", "Decisions") +
    chip("blocked", "Blocked attempts") +
    chip("notice", "Board notices") +
    chip("money", "Payments") +
    '<label class="lowtoggle"><input type="checkbox" data-a="logLow" ' +
    (showLow ? "checked" : "") +
    "> Include low-risk cases</label></div>";
  const keys = Object.keys(days).sort(
    (a, b) => days[b]![0]!.e.t - days[a]![0]!.e.t,
  );
  o +=
    '<section class="panel">' +
    (keys.length
      ? keys
          .map((k) => {
            const list = days[k]!;
            return (
              '<div class="lday"><div class="lday-h">' +
              (list[0]!.e.t < 0
                ? "Before"
                : dayOf(list[list.length - 1]!.e.t)) +
              "<span>" +
              at(list[0]!.e.t).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                timeZone: "UTC",
              }) +
              '</span></div><ol class="lev">' +
              list
                .slice()
                .sort((a, b) => b.e.t - a.e.t || b.e.seq - a.e.seq)
                .map((x) => {
                  const c = CATS[x.p.cat];
                  return (
                    '<li><span class="lev-t">' +
                    hm(x.e.t) +
                    '</span><span class="lev-c ' +
                    c[1] +
                    '">' +
                    c[0] +
                    '</span><span class="grow">' +
                    esc(x.p.text) +
                    (x.e.caseId
                      ? ' <span class="muted small">' + x.e.caseId + "</span>"
                      : "") +
                    "</span></li>"
                  );
                })
                .join("") +
              "</ol></div>"
            );
          })
          .join("")
      : '<p class="muted">Nothing to show for this filter.</p>') +
    "</section>";
  o +=
    '<details class="panel"><summary>Technical record for auditors (' +
    S.d.ledger.length +
    ' entries)</summary><p class="muted small">Each entry carries a fingerprint (hash) that includes the previous entry, so a change anywhere breaks the chain.</p><div class="scroll"><table class="tbl"><thead><tr><th>#</th><th>Day</th><th>Who</th><th>Action</th><th>Case</th><th>Fingerprint</th></tr></thead><tbody>' +
    S.d.ledger
      .slice()
      .reverse()
      .map(
        (e) =>
          "<tr><td>" +
          e.seq +
          '</td><td style="white-space:nowrap">' +
          (e.t < 0 ? "Before" : dayOf(e.t)) +
          "</td><td>" +
          esc(e.actor) +
          "</td><td>" +
          esc(e.action) +
          "</td><td>" +
          e.caseId +
          '</td><td class="hash">' +
          e.hash.slice(0, 10) +
          "</td></tr>",
      )
      .join("") +
    "</tbody></table></div></details>";
  return o;
}

export function vBoard(): string {
  const tab = S.boardTab || "overview",
    c = rep(),
    hi = S.d.cases.filter((x) => x.severity === "HIGH");
  const un = S.d.notices.filter((n) => n.ack === null);
  const now = S.d.clockH;
  let o =
    '<div class="pagehead"><div><h1>Cyber and privacy risk</h1><p class="lede">Audit Committee view. Read-only: decisions are taken in board meetings.</p></div></div>' +
    '<div class="tabs"><button class="tab ' +
    (tab === "overview" ? "on" : "") +
    '" data-a="boardTab" data-x="overview">Overview' +
    (un.length ? " (" + un.length + " new)" : "") +
    '</button><button class="tab ' +
    (tab === "log" ? "on" : "") +
    '" data-a="boardTab" data-x="log">Evidence log</button></div>';
  if (tab === "log") return o + logBody();

  const gdprOf = (x: (typeof hi)[number]) =>
    x.clocks.find((k) => k.key === "gdpr");
  const open = hi.filter((x) => x.status !== "Disclosed");
  const missed = open.filter((x) => {
    const g = gdprOf(x);
    return !!g && g.start !== null && g.dur !== null && g.start + g.dur < now;
  }).length;
  const p = S.d.payments.find((x) => x.id === "PAY-2");

  // plain-language summary
  const lines: string[] = [];
  let lvl = "g";
  if (!open.length) lines.push("No serious incidents are open.");
  else {
    lvl = "a";
    lines.push(
      open.length +
        " serious incident" +
        (open.length > 1 ? "s are" : " is") +
        " open (" +
        open.map((x) => x.id).join(", ") +
        ").",
    );
  }
  if (missed) {
    lvl = "r";
    lines.push("A legal deadline to notify regulators has passed.");
  }
  if (c) {
    if (c.status === ESCALATED_STATUS) {
      lvl = "a";
      lines.push(
        "Management chose to investigate internally before disclosing. The deadlines keep running.",
      );
    } else if (c.status === "Disclosure required")
      lines.push("Disclosure has been required, but not yet made.");
    else if (c.status === "Disclosed")
      lines.push("Regulators and affected people have been notified.");
    else if (c.decision && c.decision.status === "Pending")
      lines.push(
        "A decision on disclosure is waiting on " + waitingOn(c) + ".",
      );
  }
  if (p) {
    if (p.status === "Held")
      lines.push("A US$100,000 payment to the attacker is frozen.");
    else if (p.status === "Cancelled")
      lines.push("A US$100,000 payment to the attacker was cancelled.");
  }
  o +=
    '<section class="brief ' +
    lvl +
    '"><div class="brief-k">' +
    (lvl === "r" ? "Act now" : lvl === "a" ? "Watch" : "All clear") +
    "</div><p>" +
    lines.join(" ") +
    '</p><span class="muted small">' +
    dayOf(now) +
    ", " +
    fmtT(now) +
    "</span></section>";

  // three numbers
  const k = (l: string, label: string, v: string | number, sub: string) =>
    '<div class="kpi ' +
    l +
    '"><div class="l">' +
    label +
    '</div><div class="v">' +
    v +
    '</div><div class="c">' +
    sub +
    "</div></div>";
  o +=
    '<div class="kpis">' +
    k(
      open.length ? "r" : "g",
      "Serious incidents open",
      open.length,
      open.length ? "See below" : "None",
    ) +
    k(
      missed ? "r" : "g",
      "Legal deadlines missed",
      missed,
      missed ? "Regulators not yet told" : "All on time",
    ) +
    k(
      p && p.status === "Held" ? "a" : "g",
      "Payments frozen",
      p && p.status === "Held" ? "US$100,000" : "None",
      p
        ? p.status === "Held"
          ? "To the attacker"
          : "Payment " + p.status.toLowerCase()
        : "Nothing requested",
    ) +
    "</div>";

  // incidents with their notices
  const caseIds = [
    ...new Set(hi.map((x) => x.id).concat(S.d.notices.map((n) => n.caseId))),
  ];
  o +=
    '<section class="panel"><div class="sec-head"><h2>Serious incidents</h2><span class="muted small">' +
    (un.length
      ? un.length + " unread notice" + (un.length > 1 ? "s" : "")
      : "All notices read") +
    "</span></div>" +
    (caseIds.length
      ? caseIds
          .map((id) => {
            const x = S.d.cases.find((y) => y.id === id);
            if (!x) return "";
            const ns = S.d.notices
              .filter((n) => n.caseId === id)
              .sort(
                (a, b) =>
                  Number(a.ack !== null) - Number(b.ack !== null) ||
                  b.tier - a.tier ||
                  b.t - a.t,
              );
            const u = ns.filter((n) => n.ack === null).length,
              openD = S.boardOpen[id];
            const latest = ns
              .slice()
              .sort((a, b) => b.t - a.t || b.tier - a.tier)[0];
            const g = gdprOf(x);
            return (
              '<div class="inc2' +
              (u ? " unread" : "") +
              '">' +
              '<div class="inc2-top"><div class="inc-main"><b>' +
              x.id +
              "</b> " +
              esc(x.title) +
              '<div class="muted small">' +
              (x.facts.dataAccessed
                ? knownScale(x.facts)
                  ? "About " + x.facts.records + " people’s records"
                  : "Personal data reported; scale not yet known"
                : "No personal data") +
              "</div></div>" +
              '<div class="inc-col"><span class="muted small">Stage</span>' +
              miniTrack(x) +
              '<span class="small">Waiting on ' +
              waitingOn(x) +
              "</span></div>" +
              '<div class="inc-col"><span class="muted small">Regulator deadline (GDPR)</span>' +
              (!g || g.start === null || g.dur === null
                ? '<span class="muted">None</span>'
                : x.status === "Disclosed"
                  ? '<span class="t-ok">Met</span>'
                  : remText(g.start + g.dur - now)) +
              "</div>" +
              '<div class="inc-col"><span class="muted small">Disclosure</span>' +
              discStatus(x) +
              "</div></div>" +
              (latest && !openD
                ? '<div class="inc2-latest"><span class="badge ' +
                  (latest.tier === 2 ? "high" : "") +
                  '">Latest notice</span><span class="grow">' +
                  esc(latest.body) +
                  "</span></div>"
                : "") +
              '<div class="inc2-foot">' +
              (u
                ? '<span class="unread-dot">' + u + " unread</span>"
                : '<span class="ack-ok">' +
                  CHK +
                  " All notices acknowledged</span>") +
              '<button class="btn sm" data-a="expand" data-x="' +
              id +
              '" aria-expanded="' +
              !!openD +
              '">' +
              (openD ? "Hide details" : "View details") +
              "</button></div>" +
              (openD
                ? '<div class="inc2-detail"><h3>Notices sent to the board (' +
                  ns.length +
                  ")</h3>" +
                  ns.map((n) => noticeRow(n, S.role === "board")).join("") +
                  '<div class="row" style="margin-top:10px"><button class="link" data-a="openCase" data-x="' +
                  id +
                  '">Open the full case record →</button></div></div>'
                : "") +
              "</div>"
            );
          })
          .join("")
      : '<p class="muted">No serious incidents.</p>') +
    "</section>";

  return o;
}
