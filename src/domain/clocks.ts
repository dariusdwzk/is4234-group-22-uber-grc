import type { RulePack } from "./rule-pack";
import type { Tier } from "./types";

export type ClockState = {
  id: string;
  label: string;
  startedAt: string | null;
  dueAt: string | null;
  pctElapsed: number | null;
  status: "not_started" | "running" | "due_soon" | "overdue" | "stopped";
  note?: string;
};

export type ClockCase = {
  detectedAt: string;
  highSince: string | null;
  materialityDeterminedAt: string | null;
  closedAt: string | null;
  tier: Tier;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// shortcut: Mon-Fri in UTC, no holiday calendar; add one if the SEC clock must be exact.
export function addBusinessDays(start: Date, n: number): Date {
  const d = new Date(start);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) left--;
  }
  return d;
}

type Window = { start: Date | null; due: Date | null; note?: string };

export function computeClocks(
  c: ClockCase,
  pack: RulePack,
  now: Date,
): ClockState[] {
  const detected = new Date(c.detectedAt);
  const high = c.tier === "HIGH" && c.highSince ? new Date(c.highSince) : null;
  const after = (s: Date | null, ms: number): Window => ({
    start: s,
    due: s ? new Date(s.getTime() + ms) : null,
  });

  const windows: Record<string, () => Window> = {
    INT_CLASSIFY: () => after(detected, pack.slas.classifyH * HOUR),
    INT_DECIDE: () => after(high, pack.slas.decideH * HOUR),
    GDPR_33: () => after(detected, 72 * HOUR),
    PDPA_26D: () => after(high, 3 * DAY),
    SEC_1_05: () => {
      if (!c.materialityDeterminedAt) {
        const days = Math.max(
          0,
          Math.floor((now.getTime() - detected.getTime()) / DAY),
        );
        return {
          start: null,
          due: null,
          note: `Materiality not yet determined — ${days} days since detection`,
        };
      }
      const m = new Date(c.materialityDeterminedAt);
      return { start: m, due: addBusinessDays(m, 4) };
    },
  };

  return pack.clocks.map(({ id, label }) => {
    const make = windows[id];
    if (!make) throw new Error(`no clock rule for pack clock ${id}`);
    const { start, due, note } = make();
    const base = {
      id,
      label,
      startedAt: start?.toISOString() ?? null,
      dueAt: due?.toISOString() ?? null,
      ...(note ? { note } : {}),
    };
    if (c.closedAt)
      return { ...base, pctElapsed: pct(start, due, now), status: "stopped" };
    if (!start || !due)
      return { ...base, pctElapsed: null, status: "not_started" };
    const p = pct(start, due, now)!;
    const status =
      now.getTime() > due.getTime()
        ? "overdue"
        : p >= pack.slas.escalateAtPct
          ? "due_soon"
          : "running";
    return { ...base, pctElapsed: p, status };
  });
}

function pct(start: Date | null, due: Date | null, now: Date): number | null {
  if (!start || !due) return null;
  const span = due.getTime() - start.getTime();
  const done = Math.max(0, now.getTime() - start.getTime());
  return Math.floor((done * 100) / span);
}
