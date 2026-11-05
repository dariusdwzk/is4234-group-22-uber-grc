// The signed-in frame: dark sidebar (nav + profile card) around the page content.
import { ROLES } from "@/domain/roles";
import { navFor } from "../nav";
import { S } from "../store";

/** A shield with a tick: the product mark. */
export const LOGO =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" d="M12 2.8 4.5 5.6v5.9c0 4.6 3.1 8.4 7.5 9.7 4.4-1.3 7.5-5.1 7.5-9.7V5.6L12 2.8Z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m8.6 12.2 2.4 2.4 4.5-4.7"/></svg>';

/** "CSO (also Deputy GC)" -> "CSO", "General Counsel" -> "GC", "Board" -> "B". */
export function initials(name: string): string {
  const w = name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/);
  if (w.length === 1 && /^[A-Z]+$/.test(w[0]!)) return w[0]!;
  return w
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
}

export function shell(content: string): string {
  const r = S.role;
  const items = r
    ? navFor(r, { view: S.view, boardTab: S.boardTab, d: S.d })
        .map(
          (i) =>
            '<button class="nav-item" data-a="' +
            i.a +
            '" data-x="' +
            (i.x ?? "") +
            '"' +
            (i.current ? ' aria-current="page"' : "") +
            ">" +
            i.label +
            (i.count ? '<span class="count">' + i.count + "</span>" : "") +
            "</button>",
        )
        .join("")
    : "";
  const name = r ? ROLES[r].name : "";
  return (
    '<div class="shell"><nav class="side" aria-label="Workspace">' +
    '<div class="brand"><span class="logo">' +
    LOGO +
    "</span>UberSecure</div>" +
    '<div class="nav-items">' +
    items +
    "</div>" +
    '<div class="profile"><span class="av">' +
    initials(name) +
    '</span><div class="who">' +
    name +
    '</div><div class="prof-btns"><button data-a="switchAccount">Switch account</button>' +
    '<button data-a="showGuide">Help</button></div></div>' +
    '</nav><main class="' +
    (S.guided ? "guided" : "") +
    '">' +
    content +
    "</main></div>"
  );
}
