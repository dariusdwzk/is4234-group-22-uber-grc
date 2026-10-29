// Landing: the app's name and promise, the guided demo, and every role as a profile tile.
import { ROLES, ROLE_KEYS } from "@/domain/roles";
import type { RoleKey } from "@/domain/types";

const APP_NAME = "UberSecure";

/** Initials and colour for each role's profile tile. */
const AVATAR: Record<RoleKey, { mark: string; tone: string }> = {
  employee: { mark: "EM", tone: "blue" },
  security: { mark: "SE", tone: "ink" },
  cso: { mark: "CSO", tone: "slate" },
  finance: { mark: "FI", tone: "green" },
  gc: { mark: "GC", tone: "amber" },
  cpo: { mark: "CPO", tone: "violet" },
  ceo: { mark: "CEO", tone: "red" },
  board: { mark: "AC", tone: "teal" },
};

const POINTS = [
  [
    "Cases open themselves",
    "Monitoring, HackerOne and Finance feed one case. No one has to report it.",
  ],
  [
    "Two keys to hold back",
    "Security investigates; only the General Counsel and the CPO decide, together.",
  ],
  [
    "Every step on the record",
    "A tamper-evident log the board reads in plain language.",
  ],
];

export function vLanding(): string {
  return (
    '<section class="lp-hero">' +
    '<p class="lp-eyebrow">Breach disclosure control</p>' +
    '<h1 class="lp-name">' +
    APP_NAME +
    "</h1>" +
    '<p class="lp-tagline">No incident goes undetected.</p>' +
    '<p class="lp-lede">Security investigates. The General Counsel and the Chief Privacy Officer decide. The board is told automatically.</p>' +
    '<div class="lp-cta"><button class="btn primary big" data-a="startGuide">Start guided demo</button><span class="lp-note">8 steps · about 4 minutes</span></div>' +
    '<ul class="lp-points">' +
    POINTS.map(
      ([t, d]) => "<li><b>" + t + "</b><span>" + d + "</span></li>",
    ).join("") +
    "</ul></section>" +
    '<section class="lp-who"><h2>Who’s using ' +
    APP_NAME +
    "?</h2>" +
    '<p class="muted">Pick a role to see the app as they do.</p>' +
    '<div class="lp-profiles">' +
    ROLE_KEYS.map(
      (k) =>
        '<button class="lp-profile" data-a="role" data-x="' +
        k +
        '"><span class="lp-avatar ' +
        AVATAR[k].tone +
        '" aria-hidden="true">' +
        AVATAR[k].mark +
        "</span><b>" +
        ROLES[k].name +
        '</b><span class="lp-role">' +
        ROLES[k].short +
        "</span></button>",
    ).join("") +
    "</div></section>"
  );
}
