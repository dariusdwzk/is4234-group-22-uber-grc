// Finance: payments and the hold.
import { dayOf } from "@/domain/demo-time";
import { money } from "@/domain/money";
import { esc } from "../html";
import { S } from "../store";
import { payBadge } from "./components";

export function vFinance(): string {
  return (
    '<div class="pagehead"><div><h1>Payments</h1><p class="lede">Payments linked to an open high-risk case are frozen. No decision on the case releases them.</p></div></div>' +
    (S.finMsg
      ? '<div class="alert ' +
        S.finMsg.kind +
        '"><b>' +
        S.finMsg.title +
        "</b>" +
        esc(S.finMsg.text) +
        "</div>"
      : "") +
    '<section class="panel"><div class="scroll"><table class="tbl"><thead><tr><th>Payee</th><th>Amount</th><th>Case</th><th>Status</th><th></th></tr></thead><tbody>' +
    S.d.payments
      .slice()
      .reverse()
      .map(
        (p) =>
          "<tr><td>" +
          esc(p.payee) +
          '<div class="muted small">' +
          dayOf(p.t) +
          "</div></td><td>" +
          money(p.amountCents) +
          "</td><td>" +
          p.caseId +
          "</td><td>" +
          payBadge(p) +
          "</td><td>" +
          (p.status === "Released" || p.status === "Cancelled"
            ? ""
            : '<button class="btn sm ' +
              (p.status === "Held" ? "" : "primary") +
              '" data-a="release" data-x="' +
              p.id +
              '">Release payment</button>') +
          "</td></tr>",
      )
      .join("") +
    "</tbody></table></div>" +
    "</section>"
  );
}
