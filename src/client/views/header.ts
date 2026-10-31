// The mockup's header: Home, role picker and Demo menu.
import { ROLES, ROLE_KEYS } from "@/domain/roles";
import { S } from "../store";

const HOME_ICON =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.5 1 7.4l1 1.2 1-.8V14.5h4v-4h2v4h4V7.8l1 .8 1-1.2L8 1.5Z"/></svg>';

export function header(): string {
  const opts =
    '<option value="">Choose a role</option>' +
    ROLE_KEYS.map(
      (k) =>
        '<option value="' +
        k +
        '"' +
        (S.role === k ? " selected" : "") +
        ">" +
        ROLES[k].name +
        "</option>",
    ).join("");
  return (
    '<header class="top"><button class="btn sm home" data-a="landing">' +
    HOME_ICON +
    "Home</button>" +
    '<label class="rolepick">Role <select id="roleSel">' +
    opts +
    "</select></label>" +
    '<button class="btn sm" data-a="menu" aria-expanded="' +
    S.menu +
    '">Demo ▾</button>' +
    (S.menu
      ? '<div class="menu"><div><h3>Demo</h3><div class="row"><button class="btn sm" data-a="guide">' +
        (S.guided ? "Hide guide" : "Show guide") +
        '</button><button class="btn sm danger" data-a="reset">Reset data</button></div></div></div>'
      : "") +
    "</header>"
  );
}
