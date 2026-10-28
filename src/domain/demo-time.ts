// Demo time is whole hours relative to Day 0, so the demo clock can move (mockup: BASE).
export const DAY0_ISO = "2026-11-16T09:00:00.000Z";
const DAY0_MS = Date.parse(DAY0_ISO);

/** 24 days: hacker email 14 Nov 2016 to payout 8 Dec 2016. */
export const JUMP_H = 24 * 24;

/** The ledger hashes ISO timestamps, so demo hours become canonical ISO-8601 UTC. */
export function hoursToIso(h: number): string {
  return new Date(DAY0_MS + h * 3_600_000).toISOString();
}

export function isoToHours(iso: string): number {
  return Math.round((Date.parse(iso) - DAY0_MS) / 3_600_000);
}

// UTC so server and browser render the same text; Day 0 is 09:00 as in the mockup.
export function fmtT(h: number): string {
  return new Date(DAY0_MS + h * 3_600_000).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function fmtDur(h: number): string {
  return h >= 48
    ? (h / 24).toFixed(1) + " days"
    : Math.floor(h) +
        " h " +
        String(Math.round((h % 1) * 60)).padStart(2, "0") +
        " min";
}

export const dayOf = (h: number): string =>
  "Day " + Math.max(0, Math.floor(h / 24));

/** Day 0 is a Monday, so day n of the demo is a weekend when n mod 7 is 5 or 6. */
const isWeekend = (h: number) => {
  const d = (((Math.floor(h / 24) % 7) + 7) % 7) as number;
  return d === 5 || d === 6;
};

/** `n` business days after hour `h`, skipping Saturdays and Sundays. */
export function addBusinessDays(h: number, n: number): number {
  let t = h;
  for (let left = n; left > 0;) {
    t += 24;
    if (!isWeekend(t)) left--;
  }
  return t;
}
