// Security: cases list and unlinked signals.
import { esc } from "../html";
import { S } from "../store";
import { caseTable } from "./components";

export function vSecurity(): string {
  const unl = S.d.signals.filter((s) => !s.caseId).sort((a, b) => b.h - a.h);
  return (
    '<div class="pagehead"><div><h1>Security</h1><p class="lede">Cases open by themselves from system signals. You investigate and recommend.</p></div><button class="btn" data-a="showDeclare">+ Declare incident</button></div>' +
    (S.showDeclare
      ? '<section class="panel action"><h2>Declare an incident</h2><div class="form"><label>What happened<textarea id="dTxt" rows="2" placeholder="For incidents no system has flagged"></textarea></label><div class="row"><button class="btn primary" data-a="declare">Declare</button><button class="btn" data-a="showDeclare">Cancel</button></div></div></section>'
      : "") +
    '<div class="tabs"><button class="tab ' +
    (S.secTab === "cases" ? "on" : "") +
    '" data-a="secTab" data-x="cases">Cases (' +
    S.d.cases.length +
    ')</button><button class="tab ' +
    (S.secTab === "inbox" ? "on" : "") +
    '" data-a="secTab" data-x="inbox">Unlinked signals (' +
    unl.length +
    ")</button></div>" +
    (S.secTab === "inbox"
      ? '<section class="panel">' +
        (unl.length
          ? '<ul class="list">' +
            unl
              .map(
                (s) =>
                  '<li><span class="badge ' +
                  (s.origin === "system" ? "sys" : "warn") +
                  '">' +
                  esc(s.src) +
                  '</span><span class="grow">' +
                  esc(s.title) +
                  "</span></li>",
              )
              .join("") +
            "</ul>"
          : '<p class="muted">Every signal is in a case.</p>') +
        "</section>"
      : '<section class="panel">' +
        caseTable(S.d.cases, { action: true }) +
        "</section>")
  );
}
