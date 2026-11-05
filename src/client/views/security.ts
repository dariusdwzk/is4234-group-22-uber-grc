// Security: the case list.
import { S } from "../store";
import { caseTable } from "./components";

export function vSecurity(): string {
  return (
    '<div class="pagehead"><div><h1>All cases</h1><p class="lede">Every case Security can see.</p></div></div>' +
    '<section class="panel">' +
    caseTable(S.d.cases, { action: true }) +
    "</section>"
  );
}
