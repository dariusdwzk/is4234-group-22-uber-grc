import { describe, expect, it } from "vitest";
import { barPercents, clockBadge, statusBadge, tierBadge } from "@/components/ui/status";

describe("ui status helpers", () => {
  it("tierBadge", () => {
    expect(tierBadge("HIGH")).toEqual({ variant: "danger", label: "HIGH" });
    expect(tierBadge("MEDIUM").variant).toBe("warn");
    expect(tierBadge("LOW").variant).toBe("neutral");
  });
  it("statusBadge", () => {
    expect(statusBadge("auto_closed")).toEqual({ variant: "ok", label: "auto closed" });
    expect(statusBadge("open").variant).toBe("info");
    for (const s of ["closed", "handled", "acknowledged"]) expect(statusBadge(s).variant).toBe("ok");
    expect(statusBadge("weird").variant).toBe("neutral");
  });
  it("clockBadge covers every clocks.ts status", () => {
    expect(clockBadge("overdue").variant).toBe("danger");
    expect(clockBadge("due_soon")).toEqual({ variant: "warn", label: "due soon" });
    expect(clockBadge("running").variant).toBe("info");
    expect(clockBadge("stopped").variant).toBe("ok");
    expect(clockBadge("not_started").variant).toBe("neutral");
  });
  it("barPercents", () => {
    expect(barPercents(0, 371)).toEqual({ yours: 2, baseline: 100 });
    expect(barPercents(371, 371).yours).toBe(100);
    expect(barPercents(500, 371).yours).toBe(100);
    expect(barPercents(null, 371).yours).toBe(0);
    expect(barPercents(37.1, 371).yours).toBeCloseTo(10, 2);
  });
});
