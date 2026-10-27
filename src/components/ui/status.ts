export type Variant = "danger" | "warn" | "ok" | "info" | "neutral";
type Badge = { variant: Variant; label: string };

const words = (s: string) => s.replace(/_/g, " ");

export function tierBadge(tier: "HIGH" | "MEDIUM" | "LOW"): Badge {
  const variant: Variant = tier === "HIGH" ? "danger" : tier === "MEDIUM" ? "warn" : "neutral";
  return { variant, label: tier };
}

export function statusBadge(status: string): Badge {
  const variant: Variant =
    status === "open" ? "info"
    : ["closed", "auto_closed", "handled", "acknowledged"].includes(status) ? "ok"
    : "neutral";
  return { variant, label: words(status) };
}

// Statuses are those of ClockState in src/domain/clocks.ts.
export function clockBadge(status: string): Badge {
  const variant: Variant =
    status === "overdue" ? "danger"
    : status === "due_soon" ? "warn"
    : status === "running" ? "info"
    : status === "stopped" ? "ok"
    : "neutral";
  return { variant, label: words(status) };
}

export function barPercents(days: number | null, baseline: number): { yours: number; baseline: 100 } {
  if (days === null) return { yours: 0, baseline: 100 };
  return { yours: Math.min(100, Math.max(2, (days / baseline) * 100)), baseline: 100 };
}
