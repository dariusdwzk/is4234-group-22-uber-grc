// Demo time is hours (fractional) since a fixed epoch. "Now" follows the real clock, plus an
// offset tests can add; see getNow() in src/server/clock.ts.
export const DAY0_ISO = "2026-11-16T09:00:00.000Z";
const DAY0_MS = Date.parse(DAY0_ISO);
const HOUR_MS = 3_600_000;

/** Server and browser render times in one zone, so everyone reads the same text. */
export const TIME_ZONE = "Asia/Singapore";
/** Singapore has no daylight saving, so weekdays can use a fixed offset. */
const TZ_OFFSET_MS = 8 * HOUR_MS;

/** The real time now, in demo hours. */
export const wallClockH = (ms: number = Date.now()): number =>
  (ms - DAY0_MS) / HOUR_MS;

/** The ledger hashes ISO timestamps, so demo hours become canonical ISO-8601 UTC. */
export function hoursToIso(h: number): string {
  return new Date(Math.round(DAY0_MS + h * HOUR_MS)).toISOString();
}

export function isoToHours(iso: string): number {
  return wallClockH(Date.parse(iso));
}

const at = (h: number) => new Date(DAY0_MS + h * HOUR_MS);

/** "Sat 31 Oct, 14:05" */
export function fmtT(h: number): string {
  return at(h).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}

/** "Sat 31 Oct" */
export const fmtDay = (h: number): string =>
  at(h).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TIME_ZONE,
  });

/** "14:05" */
export const fmtHM = (h: number): string =>
  at(h).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });

/** The calendar date in TIME_ZONE, for grouping ("2026-10-31"). */
export const dateKey = (h: number): string =>
  new Date(DAY0_MS + h * HOUR_MS + TZ_OFFSET_MS).toISOString().slice(0, 10);

export function fmtDur(h: number): string {
  if (h >= 48) return (h / 24).toFixed(1) + " days";
  const m = Math.round(h * 60);
  return Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0") + " min";
}

const isWeekend = (h: number) => {
  const d = new Date(DAY0_MS + h * HOUR_MS + TZ_OFFSET_MS).getUTCDay();
  return d === 0 || d === 6;
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
