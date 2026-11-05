// "My work": what is waiting on the signed-in role, plus three numbers.
import { esc } from "../html";
import { S } from "../store";
import { nearestDeadlineH, workItems } from "../work";
import { remText, sev } from "./components";

export function vWork(): string {
  const items = S.role ? workItems(S.d.cases, S.role) : [];
  const h = nearestDeadlineH(S.d.cases, S.d.clockH);
  const tile = (label: string, v: string) =>
    '<div class="tile"><div class="muted">' +
    label +
    '</div><div class="v">' +
    v +
    "</div></div>";
  return (
    "<h1>My work</h1>" +
    '<div class="tiles">' +
    tile("Waiting on you", String(items.length)) +
    tile(
      "Nearest legal deadline",
      h === null ? "None running" : remText(h) + " (illustrative)",
    ) +
    tile("Board notices", String(S.d.notices.length)) +
    "</div><h2>Waiting on you</h2>" +
    (items.length
      ? items
          .map(
            ({ c, line, verb }) =>
              '<div class="work-item"><div><span class="mono">' +
              c.id +
              "</span> <strong>" +
              esc(c.title) +
              "</strong> " +
              sev(c) +
              '<div class="muted">' +
              esc(line) +
              '</div></div><button class="btn primary" data-a="openCase" data-x="' +
              c.id +
              '">' +
              verb +
              "</button></div>",
          )
          .join("")
      : '<p class="muted">Nothing is waiting on you.</p>')
  );
}
