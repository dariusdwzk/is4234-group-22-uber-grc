// Landing: the app's name and promise, the guided demo, and a button for every role.
import { ROLES, ROLE_KEYS } from "@/domain/roles";
import { LOGO } from "./header";

export function vLanding(): string {
  return (
    '<section class="lp">' +
    '<h1 class="lp-name">UberSecure</h1>' +
    '<p class="lp-tagline">No incident goes undetected.</p>' +
    '<button class="btn primary big" data-a="startGuide">Start guided demo</button>' +
    '<p class="lp-or">or explore as</p>' +
    '<div class="lp-roles">' +
    ROLE_KEYS.map(
      (k) =>
        '<button class="btn primary big" data-a="role" data-x="' +
        k +
        '">' +
        ROLES[k].name +
        "</button>",
    ).join("") +
    "</div></section>"
  );
}
