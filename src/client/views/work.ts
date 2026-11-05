// "My work": what is waiting on the signed-in role, plus three numbers.
import { esc } from "../html";
import { S } from "../store";
import { nearestDeadline, workItems } from "../work";
import { remText, sev } from "./components";

export function vWork(): string {
  const items = S.role ? workItems(S.d.cases, S.role) : [];
  const n = nearestDeadline(S.d.cases, S.d.clockH);
  const tile = (label: string, v: string) =>
    '<div class="tile"><div class="muted">' +
    label +
    '</div><div class="v">' +
    v +
    "</div></div>";
  return (
    '<div class="pagehead"><div><h1>My work</h1><p class="lede">Cases that need you now.</p></div></div>' +
    '<div class="tiles">' +
    tile("Waiting on you", String(items.length)) +
    tile(
      "Nearest legal deadline",
      n === null
        ? "None running"
        : remText(n.h) +
            " (illustrative)" +
            '<div class="muted">' +
            esc(n.name) +
            " · " +
            esc(n.caseId) +
            "</div>",
    ) +
    tile("Board notices", String(S.d.notices.length)) +
    "</div><h2>Waiting on you</h2>" +
    (items.length
      ? items
          .map(
            ({ c, line, verb }) =>
              '<div class="work-item"><div><span class="mono">' +
              esc(c.id) +
              "</span> <strong>" +
              esc(c.title) +
              "</strong> " +
              sev(c) +
              '<div class="muted">' +
              esc(line) +
              '</div></div><button class="btn primary" data-a="openCase" data-x="' +
              esc(c.id) +
              '">' +
              verb +
              "</button></div>",
          )
          .join("")
      : '<p class="muted">Nothing is waiting on you.</p>')
  );
}
