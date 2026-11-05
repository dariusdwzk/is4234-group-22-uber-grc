// Sign-in: pick an account (a role), or take the guided tour.
import { ROLES, ROLE_KEYS } from "@/domain/roles";
import { S } from "../store";
import { initials } from "./shell";

export function vLanding(): string {
  return (
    '<section class="signin"><h1>Sign in</h1><p class="muted">Choose your account.</p>' +
    ROLE_KEYS.map(
      (k) =>
        '<button class="acct" data-a="role" data-x="' +
        k +
        '"><span class="av" aria-hidden="true">' +
        initials(ROLES[k].name) +
        "</span><span><b>" +
        ROLES[k].name +
        "</b><small>" +
        ROLES[k].short +
        "</small></span></button>",
    ).join("") +
    '<button class="btn" data-a="startGuide">Take the guided tour</button>' +
    '<p class="muted small">Demo environment · all data is fictional' +
    (S.d.demoMode
      ? ' <button class="link" data-a="reset">Reset demo data</button>'
      : "") +
    "</p></section>"
  );
}
