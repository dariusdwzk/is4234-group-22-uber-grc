// The app bar: the UberSecure mark (goes Home), role picker and Reset data.
import { ROLES, ROLE_KEYS } from "@/domain/roles";
import { S } from "../store";

/** A shield with a tick: the product mark, in the app bar and on the landing page. */
export const LOGO =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" d="M12 2.8 4.5 5.6v5.9c0 4.6 3.1 8.4 7.5 9.7 4.4-1.3 7.5-5.1 7.5-9.7V5.6L12 2.8Z"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m8.6 12.2 2.4 2.4 4.5-4.7"/></svg>';

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
    '<header class="top"><button class="brand" data-a="landing" aria-label="Home"><span class="logo">' +
    LOGO +
    "</span>UberSecure<small>GRC</small></button>" +
    '<label class="rolepick">Role <select id="roleSel">' +
    opts +
    "</select></label>" +
    // Only when DEMO_MODE is on: the server refuses a reset otherwise.
    (S.d.demoMode
      ? '<button class="btn sm danger" data-a="reset">Reset data</button>'
      : "") +
    "</header>"
  );
}
