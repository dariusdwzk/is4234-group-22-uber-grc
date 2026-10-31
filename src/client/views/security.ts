// Security: the case list.
import { S } from "../store";
import { caseTable } from "./components";

export function vSecurity(): string {
  return (
    '<div class="pagehead"><div><h1>Security</h1><p class="lede">Cases open by themselves from system signals. You investigate and recommend.</p></div></div>' +
    '<section class="panel">' +
    caseTable(S.d.cases, { action: true }) +
    "</section>"
  );
}
