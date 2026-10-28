// The mockup's landing page.
import { ROLES, ROLE_KEYS } from "@/domain/roles";

export function vLanding(): string {
  return (
    '<section class="hero"><h1>Who decides whether a breach is disclosed?</h1>' +
    '<p class="lede">Security investigates. The General Counsel and the Chief Privacy Officer decide. The board is told automatically. Every step is logged.</p>' +
    '<div class="row"><button class="btn primary big" data-a="startGuide">Start guided demo</button><span class="muted small">8 steps, about 4 minutes</span></div></section>' +
    '<details><summary>Or explore a role on your own</summary><div class="roles">' +
    ROLE_KEYS.map(
      (k) =>
        '<button class="rolecard" data-a="role" data-x="' +
        k +
        '"><b>' +
        ROLES[k].name +
        "</b><span>" +
        ROLES[k].short +
        "</span></button>",
    ).join("") +
    "</div></details>" +
    '<p class="muted small" style="margin-top:28px">Replays Uber’s 2016 breach with simulated data. Day 0 is the day the breach was found.</p>'
  );
}
